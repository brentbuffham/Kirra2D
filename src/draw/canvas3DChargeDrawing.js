/**
 * canvas3DChargeDrawing.js - 3D charge visualization for blast holes
 *
 * PERFORMANCE: Uses InstancedMesh to render ALL charge decks in 1 draw call
 * and ALL primer markers in 1 draw call (2 total, regardless of hole count).
 *
 * Deck cylinders are unit CylinderGeometry(1,1,1) scaled per-instance via
 * the instance matrix (scaleX/Z = radius, scaleY = length).
 * Per-instance color via InstancedMesh.setColorAt().
 */
import * as THREE from "three";
import { DECK_TYPES, DECK_COLORS, NON_EXPLOSIVE_TYPES, BULK_EXPLOSIVE_TYPES } from "../charging/ChargingConstants.js";

// Shared template geometries (created once, reused across rebuilds)
var _deckTemplateGeo = null;
var _primerTemplateGeo = null;
var CYLINDER_SEGMENTS = 8;

function getDeckTemplateGeo() {
	if (!_deckTemplateGeo) {
		_deckTemplateGeo = new THREE.CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS, 1, false);
	}
	return _deckTemplateGeo;
}

function getPrimerTemplateGeo() {
	if (!_primerTemplateGeo) {
		_primerTemplateGeo = new THREE.OctahedronGeometry(1, 0);
	}
	return _primerTemplateGeo;
}

var PRIMER_COLOR = 0xdd1111;

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
var _identityQuat = new THREE.Quaternion();

/**
 * Draw ALL 3D charge visualizations for visible holes using instanced rendering.
 * Creates 1 InstancedMesh for all deck cylinders and 1 for all primer markers.
 * Total: 2 draw calls regardless of hole count.
 *
 * @param {Array} visibleHoles - Array of visible blast hole objects
 */
export function drawAllChargesThreeJS(visibleHoles) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!window.loadedCharging || window.loadedCharging.size === 0) return;

	var chargesGroup = window.threeRenderer.chargesGroup;
	if (!chargesGroup) return;

	var holeScale = window.holeScale || 1;

	// First pass: collect all deck and primer data across all holes
	var deckList = [];
	var primerList = [];

	for (var h = 0; h < visibleHoles.length; h++) {
		var hole = visibleHoles[h];
		var charging = window.loadedCharging.get(hole.holeID);
		if (!charging || !charging.decks || charging.decks.length === 0) continue;

		var holeLength = charging.holeLength || hole.holeLengthCalculated || 0;
		if (holeLength <= 0) continue;

		var diameterMm = charging.holeDiameterMm || hole.holeDiameter || 115;
		var radiusMeters = (diameterMm / 1000) / 2;
		var scaledRadius = radiusMeters * holeScale * 2;

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
		}

		if (charging.primers) {
			for (var p = 0; p < charging.primers.length; p++) {
				var primer = charging.primers[p];
				if (primer.lengthFromCollar == null) continue;

				var pw = positionAtDepth(hole, primer.lengthFromCollar, holeLength);
				var pl = window.worldToThreeLocal(pw.x, pw.y);

				primerList.push(pl.x, pl.y, pw.z, scaledRadius * 1.5);
			}
		}
	}

	// Build instanced mesh for deck cylinders (1 draw call)
	var deckCount = deckList.length / 8; // 8 values per deck
	if (deckCount > 0) {
		var deckMesh = new THREE.InstancedMesh(getDeckTemplateGeo(), new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.7,
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

	// Build instanced mesh for primer markers (1 draw call)
	var primerCount = primerList.length / 4; // 4 values per primer
	if (primerCount > 0) {
		var primerMesh = new THREE.InstancedMesh(getPrimerTemplateGeo(), new THREE.MeshBasicMaterial({
			color: PRIMER_COLOR,
			depthTest: true,
			depthWrite: true,
		}), primerCount);
		primerMesh.name = "charge-primers-instanced";

		for (var pi = 0; pi < primerCount; pi++) {
			var pOff = pi * 4;
			_position.set(primerList[pOff], primerList[pOff + 1], primerList[pOff + 2]);
			var sz = primerList[pOff + 3];
			_scale.set(sz, sz, sz);
			_matrix.compose(_position, _identityQuat, _scale);
			primerMesh.setMatrixAt(pi, _matrix);
		}

		primerMesh.instanceMatrix.needsUpdate = true;
		chargesGroup.add(primerMesh);
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
