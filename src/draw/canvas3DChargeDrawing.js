/**
 * canvas3DChargeDrawing.js - 3D charge visualization for blast holes
 *
 * PERFORMANCE: Uses InstancedMesh for minimal draw calls regardless of hole count:
 *   1) Deck tubes (open-ended, 10 segments) - 1 draw call
 *   2) Booster solid cylinders (red, product-sized) - 1 draw call
 *   3) Initiator solid cylinders (blue, shell-sized, inside booster) - 1 draw call
 *
 * All geometries are unit CylinderGeometry(1,1,1) scaled per-instance via
 * the instance matrix (scaleX/Z = radius, scaleY = length).
 * Per-instance color via InstancedMesh.setColorAt().
 */
import * as THREE from "three";
import { DECK_TYPES, DECK_COLORS, NON_EXPLOSIVE_TYPES, BULK_EXPLOSIVE_TYPES } from "../charging/ChargingConstants.js";

// Shared template geometries (created once, reused across rebuilds)
var _deckTemplateGeo = null;
var _boosterTemplateGeo = null;
var _initiatorTemplateGeo = null;
var CYLINDER_SEGMENTS = 10;

/** Deck tubes: open-ended (no end caps) so you can see into the hole */
function getDeckTemplateGeo() {
	if (!_deckTemplateGeo) {
		_deckTemplateGeo = new THREE.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS, 1, true);
	}
	return _deckTemplateGeo;
}

/** Booster: solid cylinder (closed ends) sized to product dimensions */
function getBoosterTemplateGeo() {
	if (!_boosterTemplateGeo) {
		_boosterTemplateGeo = new THREE.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS, 1, false);
	}
	return _boosterTemplateGeo;
}

/** Initiator/detonator: solid cylinder (closed ends), fewer segments for small detail */
function getInitiatorTemplateGeo() {
	if (!_initiatorTemplateGeo) {
		_initiatorTemplateGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
	}
	return _initiatorTemplateGeo;
}

// Default dimensions (meters) when product lookup fails
var DEFAULT_BOOSTER_LENGTH_M = 0.110;   // 110mm
var DEFAULT_BOOSTER_DIAMETER_M = 0.056; // 56mm
var DEFAULT_INITIATOR_LENGTH_M = 0.098; // 98mm
var DEFAULT_INITIATOR_DIAMETER_M = 0.0076; // 7.6mm

/**
 * Look up a product by ID or name from window.loadedProducts.
 */
function findProduct(productID, productName) {
	if (!window.loadedProducts) return null;
	if (productID) {
		var p = window.loadedProducts.get(productID);
		if (p) return p;
	}
	if (productName) {
		for (var [, prod] of window.loadedProducts) {
			if (prod.name === productName) return prod;
		}
	}
	return null;
}

/**
 * Convert a hex color string (e.g. "#FF8C00") to a hex number (e.g. 0xFF8C00).
 */
function hexStringToNumber(hexStr) {
	return parseInt(hexStr.replace("#", ""), 16);
}

/**
 * Get color for a deck based on its type and product.
 * Priority: product.colorHex > productType-based color > deck type fallback.
 * Mirrors HoleSectionView.getDeckColor() logic.
 */
function getDeckColor(deck) {
	if (!deck) return 0xcccccc;

	if (deck.product && deck.product.colorHex) {
		return hexStringToNumber(deck.product.colorHex);
	}

	switch (deck.deckType) {
		case DECK_TYPES.INERT:
			if (deck.product) {
				var pName = (deck.product.name || "").toLowerCase();
				var pType = deck.product.productType || "";
				if (pType === NON_EXPLOSIVE_TYPES.WATER || pName.indexOf("water") !== -1) return hexStringToNumber(DECK_COLORS.INERT_WATER);
				if (pType === NON_EXPLOSIVE_TYPES.STEMMING || pName.indexOf("stemm") !== -1) return hexStringToNumber(DECK_COLORS.INERT_STEMMING);
				if (pType === NON_EXPLOSIVE_TYPES.STEM_GEL || pName.indexOf("gel") !== -1) return hexStringToNumber(DECK_COLORS.INERT_STEM_GEL);
				if (pType === NON_EXPLOSIVE_TYPES.DRILL_CUTTINGS || pName.indexOf("drill") !== -1) return hexStringToNumber(DECK_COLORS.INERT_DRILL_CUTTINGS);
			}
			return hexStringToNumber(DECK_COLORS.INERT_AIR);

		case DECK_TYPES.COUPLED:
			if (deck.product) {
				var bType = deck.product.productType || "";
				if (bType === BULK_EXPLOSIVE_TYPES.ANFO || (deck.product.name || "").toUpperCase().indexOf("ANFO") !== -1) return hexStringToNumber(DECK_COLORS.COUPLED_ANFO);
				if (bType === BULK_EXPLOSIVE_TYPES.EMULSION) return hexStringToNumber(DECK_COLORS.COUPLED_EMULSION);
			}
			return hexStringToNumber(DECK_COLORS.COUPLED);

		case DECK_TYPES.DECOUPLED:
			return hexStringToNumber(DECK_COLORS.DECOUPLED);

		case DECK_TYPES.SPACER:
			return hexStringToNumber(DECK_COLORS.SPACER);

		default:
			return 0xcccccc;
	}
}

/**
 * Compute a world position at a given depth along a hole axis.
 */
function positionAtDepth(hole, depth, holeLength) {
	if (holeLength <= 0) return { x: hole.startXLocation, y: hole.startYLocation, z: hole.startZLocation };
	var t = Math.min(depth / holeLength, 1.0);
	return {
		x: hole.startXLocation + (hole.endXLocation - hole.startXLocation) * t,
		y: hole.startYLocation + (hole.endYLocation - hole.startYLocation) * t,
		z: hole.startZLocation + (hole.endZLocation - hole.startZLocation) * t,
	};
}

// Reusable math objects (avoid per-frame allocation)
var _matrix = new THREE.Matrix4();
var _color = new THREE.Color();
var _yAxis = new THREE.Vector3(0, 1, 0);
var _direction = new THREE.Vector3();
var _quaternion = new THREE.Quaternion();
var _position = new THREE.Vector3();
var _scale = new THREE.Vector3();

/**
 * Draw ALL 3D charge visualizations for visible holes using instanced rendering.
 * Creates 3 InstancedMeshes: deck tubes, booster cylinders, initiator cylinders.
 *
 * @param {Array} visibleHoles - Array of visible blast hole objects
 */
export function drawAllChargesThreeJS(visibleHoles) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!window.loadedCharging || window.loadedCharging.size === 0) return;

	var chargesGroup = window.threeRenderer.chargesGroup;
	if (!chargesGroup) return;

	var holeScale = window.holeScale || 1;

	// First pass: collect all deck, booster and initiator data across all holes
	var deckList = [];
	var boosterList = [];    // 8 values per booster: topX,topY,topZ, baseX,baseY,baseZ, radius, colorHex
	var initiatorList = [];  // 8 values per initiator: topX,topY,topZ, baseX,baseY,baseZ, radius, colorHex
	var embeddedList = [];   // 8 values per embedded content: topX,topY,topZ, baseX,baseY,baseZ, radius, colorHex

	for (var h = 0; h < visibleHoles.length; h++) {
		var hole = visibleHoles[h];
		var charging = window.loadedCharging.get(hole.holeID);
		if (!charging || !charging.decks || charging.decks.length === 0) continue;

		var holeLength = charging.holeLength || hole.holeLengthCalculated || 0;
		if (holeLength <= 0) continue;

		var diameterMm = charging.holeDiameterMm || hole.holeDiameter || 115;
		var radiusMeters = (diameterMm / 1000) / 2;
		var scaledRadius = radiusMeters * holeScale * 2;

		// Hole direction vector (collar to toe, normalized)
		var hdx = hole.endXLocation - hole.startXLocation;
		var hdy = hole.endYLocation - hole.startYLocation;
		var hdz = hole.endZLocation - hole.startZLocation;
		var hMag = Math.sqrt(hdx * hdx + hdy * hdy + hdz * hdz);
		if (hMag > 0) { hdx /= hMag; hdy /= hMag; hdz /= hMag; }

		for (var i = 0; i < charging.decks.length; i++) {
			var deck = charging.decks[i];
			if (deck.topDepth == null || deck.baseDepth == null) continue;
			if (Math.abs(deck.baseDepth - deck.topDepth) < 0.001) continue;

			var topWorld = positionAtDepth(hole, deck.topDepth, holeLength);
			var baseWorld = positionAtDepth(hole, deck.baseDepth, holeLength);
			var topLocal = window.worldToThreeLocal(topWorld.x, topWorld.y);
			var baseLocal = window.worldToThreeLocal(baseWorld.x, baseWorld.y);

			var deckRadius = scaledRadius;
			if (deck.deckType === DECK_TYPES.DECOUPLED) deckRadius = scaledRadius * 0.7;
			else if (deck.deckType === DECK_TYPES.SPACER) deckRadius = scaledRadius * 1.1;

			deckList.push(
				topLocal.x, topLocal.y, topWorld.z,
				baseLocal.x, baseLocal.y, baseWorld.z,
				deckRadius, getDeckColor(deck)
			);

			// Collect embedded content (Physical items inside decks)
			if (deck.contains && deck.contains.length > 0) {
				for (var ec = 0; ec < deck.contains.length; ec++) {
					var content = deck.contains[ec];
					if (content.contentCategory !== "Physical") continue;
					if (!content.length || !content.diameter) continue;

					var cTopWorld = positionAtDepth(hole, content.lengthFromCollar, holeLength);
					var cBaseWorld = positionAtDepth(hole, content.lengthFromCollar + content.length, holeLength);
					var cTopLocal = window.worldToThreeLocal(cTopWorld.x, cTopWorld.y);
					var cBaseLocal = window.worldToThreeLocal(cBaseWorld.x, cBaseWorld.y);
					var cRadius = (content.diameter / 2) * holeScale * 2;

					// Look up product color
					var cColorHex = 0xFF6600; // default orange
					var cProd = findProduct(content.productID, content.productName);
					if (cProd && cProd.colorHex) {
						cColorHex = hexStringToNumber(cProd.colorHex);
					}

					embeddedList.push(
						cTopLocal.x, cTopLocal.y, cTopWorld.z,
						cBaseLocal.x, cBaseLocal.y, cBaseWorld.z,
						cRadius, cColorHex
					);
				}
			}
		}

		if (charging.primers) {
			for (var p = 0; p < charging.primers.length; p++) {
				var primer = charging.primers[p];
				if (primer.lengthFromCollar == null) continue;

				var primerWorld = positionAtDepth(hole, primer.lengthFromCollar, holeLength);
				var primerLocal = window.worldToThreeLocal(primerWorld.x, primerWorld.y);
				var px = primerLocal.x, py = primerLocal.y, pz = primerWorld.z;

				// --- Booster ---
				var boosterProd = primer.booster ? findProduct(primer.booster.productID, primer.booster.productName) : null;
				var bLenM = (boosterProd && boosterProd.lengthMm) ? boosterProd.lengthMm / 1000 : DEFAULT_BOOSTER_LENGTH_M;
				var bDiaM = (boosterProd && boosterProd.diameterMm) ? boosterProd.diameterMm / 1000 : DEFAULT_BOOSTER_DIAMETER_M;
				var bRadius = (bDiaM / 2) * holeScale * 2;
				var bHalfLen = bLenM / 2;

				// Top and base of booster cylinder along hole axis (in local coords)
				var bTopX = px - hdx * bHalfLen, bTopY = py - hdy * bHalfLen, bTopZ = pz - hdz * bHalfLen;
				var bBaseX = px + hdx * bHalfLen, bBaseY = py + hdy * bHalfLen, bBaseZ = pz + hdz * bHalfLen;

				boosterList.push(bTopX, bTopY, bTopZ, bBaseX, bBaseY, bBaseZ, bRadius, hexStringToNumber(DECK_COLORS.BOOSTER));

				// --- Initiator/Detonator ---
				var detProd = primer.detonator ? findProduct(primer.detonator.productID, primer.detonator.productName) : null;
				var iLenM = (detProd && detProd.shellLengthMm) ? detProd.shellLengthMm / 1000 : DEFAULT_INITIATOR_LENGTH_M;
				var iDiaM = (detProd && detProd.shellDiameterMm) ? detProd.shellDiameterMm / 1000 : DEFAULT_INITIATOR_DIAMETER_M;
				var iRadius = (iDiaM / 2) * holeScale * 2;
				var iHalfLen = iLenM / 2;

				var iTopX = px - hdx * iHalfLen, iTopY = py - hdy * iHalfLen, iTopZ = pz - hdz * iHalfLen;
				var iBaseX = px + hdx * iHalfLen, iBaseY = py + hdy * iHalfLen, iBaseZ = pz + hdz * iHalfLen;

				initiatorList.push(iTopX, iTopY, iTopZ, iBaseX, iBaseY, iBaseZ, iRadius, hexStringToNumber(DECK_COLORS.DETONATOR));
			}
		}
	}

	// Build instanced mesh for deck cylinders (1 draw call)
	var deckCount = deckList.length / 8; // 8 values per deck
	if (deckCount > 0) {
		var deckMesh = new THREE.InstancedMesh(getDeckTemplateGeo(), new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.4,
			side: THREE.DoubleSide,
			depthWrite: false,
		}), deckCount);
		deckMesh.name = "charge-decks-instanced";

		for (var d = 0; d < deckCount; d++) {
			var off = d * 8;
			var dx = deckList[off + 3] - deckList[off];
			var dy = deckList[off + 4] - deckList[off + 1];
			var dz = deckList[off + 5] - deckList[off + 2];
			var length = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (length < 0.001) continue;

			_direction.set(dx, dy, dz).normalize();
			_quaternion.setFromUnitVectors(_yAxis, _direction);

			_position.set(
				(deckList[off] + deckList[off + 3]) / 2,
				(deckList[off + 1] + deckList[off + 4]) / 2,
				(deckList[off + 2] + deckList[off + 5]) / 2
			);

			var radius = deckList[off + 6];
			_scale.set(radius, length, radius);

			_matrix.compose(_position, _quaternion, _scale);
			deckMesh.setMatrixAt(d, _matrix);

			_color.setHex(deckList[off + 7]);
			deckMesh.setColorAt(d, _color);
		}

		deckMesh.instanceMatrix.needsUpdate = true;
		if (deckMesh.instanceColor) deckMesh.instanceColor.needsUpdate = true;
		chargesGroup.add(deckMesh);
	}

	// Build instanced mesh for booster cylinders (1 draw call)
	var boosterCount = boosterList.length / 8;
	if (boosterCount > 0) {
		var boosterMesh = new THREE.InstancedMesh(getBoosterTemplateGeo(), new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide,
			depthTest: true,
			depthWrite: false,
		}), boosterCount);
		boosterMesh.name = "charge-boosters-instanced";

		for (var bi = 0; bi < boosterCount; bi++) {
			var bOff = bi * 8;
			var bdx = boosterList[bOff + 3] - boosterList[bOff];
			var bdy = boosterList[bOff + 4] - boosterList[bOff + 1];
			var bdz = boosterList[bOff + 5] - boosterList[bOff + 2];
			var bLen = Math.sqrt(bdx * bdx + bdy * bdy + bdz * bdz);
			if (bLen < 0.0001) bLen = 0.001;

			_direction.set(bdx, bdy, bdz).normalize();
			_quaternion.setFromUnitVectors(_yAxis, _direction);
			_position.set(
				(boosterList[bOff] + boosterList[bOff + 3]) / 2,
				(boosterList[bOff + 1] + boosterList[bOff + 4]) / 2,
				(boosterList[bOff + 2] + boosterList[bOff + 5]) / 2
			);
			_scale.set(boosterList[bOff + 6], bLen, boosterList[bOff + 6]);
			_matrix.compose(_position, _quaternion, _scale);
			boosterMesh.setMatrixAt(bi, _matrix);

			_color.setHex(boosterList[bOff + 7]);
			boosterMesh.setColorAt(bi, _color);
		}

		boosterMesh.instanceMatrix.needsUpdate = true;
		if (boosterMesh.instanceColor) boosterMesh.instanceColor.needsUpdate = true;
		chargesGroup.add(boosterMesh);
	}

	// Build instanced mesh for initiator/detonator cylinders (1 draw call)
	var initiatorCount = initiatorList.length / 8;
	if (initiatorCount > 0) {
		var initiatorMesh = new THREE.InstancedMesh(getInitiatorTemplateGeo(), new THREE.MeshBasicMaterial({
			color: 0xffffff,
			depthTest: true,
			depthWrite: true,
		}), initiatorCount);
		initiatorMesh.name = "charge-initiators-instanced";

		for (var ii = 0; ii < initiatorCount; ii++) {
			var iOff = ii * 8;
			var idx = initiatorList[iOff + 3] - initiatorList[iOff];
			var idy = initiatorList[iOff + 4] - initiatorList[iOff + 1];
			var idz = initiatorList[iOff + 5] - initiatorList[iOff + 2];
			var iLen = Math.sqrt(idx * idx + idy * idy + idz * idz);
			if (iLen < 0.0001) iLen = 0.001;

			_direction.set(idx, idy, idz).normalize();
			_quaternion.setFromUnitVectors(_yAxis, _direction);
			_position.set(
				(initiatorList[iOff] + initiatorList[iOff + 3]) / 2,
				(initiatorList[iOff + 1] + initiatorList[iOff + 4]) / 2,
				(initiatorList[iOff + 2] + initiatorList[iOff + 5]) / 2
			);
			_scale.set(initiatorList[iOff + 6], iLen, initiatorList[iOff + 6]);
			_matrix.compose(_position, _quaternion, _scale);
			initiatorMesh.setMatrixAt(ii, _matrix);

			_color.setHex(initiatorList[iOff + 7]);
			initiatorMesh.setColorAt(ii, _color);
		}

		initiatorMesh.instanceMatrix.needsUpdate = true;
		if (initiatorMesh.instanceColor) initiatorMesh.instanceColor.needsUpdate = true;
		chargesGroup.add(initiatorMesh);
	}

	// Build instanced mesh for embedded content cylinders (1 draw call)
	var embeddedCount = embeddedList.length / 8;
	if (embeddedCount > 0) {
		var embeddedMesh = new THREE.InstancedMesh(getBoosterTemplateGeo(), new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.6,
			side: THREE.DoubleSide,
			depthTest: true,
			depthWrite: false,
		}), embeddedCount);
		embeddedMesh.name = "charge-embedded-instanced";

		for (var ei = 0; ei < embeddedCount; ei++) {
			var eOff = ei * 8;
			var edx = embeddedList[eOff + 3] - embeddedList[eOff];
			var edy = embeddedList[eOff + 4] - embeddedList[eOff + 1];
			var edz = embeddedList[eOff + 5] - embeddedList[eOff + 2];
			var eLen = Math.sqrt(edx * edx + edy * edy + edz * edz);
			if (eLen < 0.0001) eLen = 0.001;

			_direction.set(edx, edy, edz).normalize();
			_quaternion.setFromUnitVectors(_yAxis, _direction);
			_position.set(
				(embeddedList[eOff] + embeddedList[eOff + 3]) / 2,
				(embeddedList[eOff + 1] + embeddedList[eOff + 4]) / 2,
				(embeddedList[eOff + 2] + embeddedList[eOff + 5]) / 2
			);
			_scale.set(embeddedList[eOff + 6], eLen, embeddedList[eOff + 6]);
			_matrix.compose(_position, _quaternion, _scale);
			embeddedMesh.setMatrixAt(ei, _matrix);

			_color.setHex(embeddedList[eOff + 7]);
			embeddedMesh.setColorAt(ei, _color);
		}

		embeddedMesh.instanceMatrix.needsUpdate = true;
		if (embeddedMesh.instanceColor) embeddedMesh.instanceColor.needsUpdate = true;
		chargesGroup.add(embeddedMesh);
	}
}

/**
 * Clear all 3D charge visualizations.
 * Disposes only the instanced meshes (template geometry is preserved for reuse).
 */
export function clearChargesThreeJS() {
	if (!window.threeRenderer || !window.threeRenderer.chargesGroup) return;
	var group = window.threeRenderer.chargesGroup;
	while (group.children.length > 0) {
		var child = group.children[0];
		group.remove(child);
		// Dispose instance-specific resources (not the shared template geometry)
		if (child.isInstancedMesh) {
			child.dispose(); // disposes instanceMatrix/instanceColor buffers
			if (child.material) child.material.dispose();
		} else {
			if (child.geometry) child.geometry.dispose();
			if (child.material) child.material.dispose();
		}
	}
}
