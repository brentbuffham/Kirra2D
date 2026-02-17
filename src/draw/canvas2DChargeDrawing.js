/**
 * canvas2DChargeDrawing.js - 2D charge visualization for blast holes
 * Renders pie-chart/radial wedges around hole circles in canvas 2D.
 * Reference: src/referenceFiles/Diagrams/hole_charging.html
 */
import { DECK_TYPES, DECK_COLORS, NON_EXPLOSIVE_TYPES, BULK_EXPLOSIVE_TYPES } from "../charging/ChargingConstants.js";
import { chargingKey } from "../charging/HoleCharging.js";

var PRIMER_2D_COLOR = "#dd1111";     // Red
var DETONATOR_2D_COLOR = "#2858a8";  // Blue diamond

var DEG_TO_RAD = Math.PI / 180;

/**
 * Draw a filled wedge (pie slice) on the 2D canvas.
 */
function drawWedge(ctx, cx, cy, startDeg, endDeg, radius, color) {
	ctx.beginPath();
	ctx.moveTo(cx, cy);
	var s = startDeg;
	var e = endDeg;
	if (e < s) e += 360;
	ctx.arc(cx, cy, radius, s * DEG_TO_RAD, e * DEG_TO_RAD);
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.strokeStyle = "#222";
	ctx.lineWidth = 0.5;
	ctx.stroke();
}

/**
 * Draw a filled arc (ring segment) on the 2D canvas.
 */
function drawArc(ctx, cx, cy, startDeg, endDeg, innerR, outerR, color) {
	ctx.beginPath();
	var s = startDeg;
	var e = endDeg;
	if (e < s) e += 360;
	ctx.arc(cx, cy, outerR, s * DEG_TO_RAD, e * DEG_TO_RAD);
	ctx.arc(cx, cy, innerR, e * DEG_TO_RAD, s * DEG_TO_RAD, true);
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.strokeStyle = "#222";
	ctx.lineWidth = 0.5;
	ctx.stroke();
}

/**
 * Draw a small diamond shape (detonator indicator).
 */
function drawDiamond(ctx, x, y, size, color) {
	ctx.beginPath();
	ctx.moveTo(x, y - size);
	ctx.lineTo(x + size, y);
	ctx.lineTo(x, y + size);
	ctx.lineTo(x - size, y);
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
}

/**
 * Get the 2D color for a deck based on its type and product.
 * Priority: product.colorHex > productType-based color > deck type fallback.
 * Mirrors HoleSectionView.getDeckColor() logic.
 */
function getDeckColor2D(deck) {
	if (!deck) return "#CCCCCC";

	// Use product color if available (highest priority)
	if (deck.product && deck.product.colorHex) {
		return deck.product.colorHex;
	}

	switch (deck.deckType) {
		case DECK_TYPES.INERT:
			if (deck.product) {
				var pName = (deck.product.name || "").toLowerCase();
				var pType = deck.product.productType || "";
				if (pType === NON_EXPLOSIVE_TYPES.WATER || pName.indexOf("water") !== -1) return DECK_COLORS.INERT_WATER;
				if (pType === NON_EXPLOSIVE_TYPES.STEMMING || pName.indexOf("stemm") !== -1) return DECK_COLORS.INERT_STEMMING;
				if (pType === NON_EXPLOSIVE_TYPES.STEM_GEL || pName.indexOf("gel") !== -1) return DECK_COLORS.INERT_STEM_GEL;
				if (pType === NON_EXPLOSIVE_TYPES.DRILL_CUTTINGS || pName.indexOf("drill") !== -1) return DECK_COLORS.INERT_DRILL_CUTTINGS;
			}
			return DECK_COLORS.INERT_AIR;

		case DECK_TYPES.COUPLED:
			if (deck.product) {
				var bType = deck.product.productType || "";
				if (bType === BULK_EXPLOSIVE_TYPES.ANFO || (deck.product.name || "").toUpperCase().indexOf("ANFO") !== -1) return DECK_COLORS.COUPLED_ANFO;
				if (bType === BULK_EXPLOSIVE_TYPES.EMULSION) return DECK_COLORS.COUPLED_EMULSION;
			}
			return DECK_COLORS.COUPLED;

		case DECK_TYPES.DECOUPLED:
			return DECK_COLORS.DECOUPLED;

		case DECK_TYPES.SPACER:
			return DECK_COLORS.SPACER;

		default:
			return "#CCCCCC";
	}
}

/**
 * Draw 2D charge visualization around a hole circle.
 * Uses radial wedges (pie chart) to show deck proportions.
 * Angular extent is proportional to deck length / hole length.
 * Starts at 270 degrees (top of circle = collar/stem).
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {Object} hole - Blast hole object
 * @param {number} cx - Screen X of hole center
 * @param {number} cy - Screen Y of hole center
 * @param {number} radius - Screen radius of hole circle (in pixels)
 */
export function drawCharges2D(ctx, hole, cx, cy, radius) {
	if (!window.loadedCharging) return;

	var charging = window.loadedCharging.get(chargingKey(hole));
	if (!charging || !charging.decks || charging.decks.length === 0) return;

	var holeLength = charging.holeLength || hole.holeLengthCalculated || 0;
	if (holeLength <= 0) return;

	// Radii for different deck types (relative to the display radius, 1.2x base scale)
	var s = 1.2; // base scale factor
	var boreholeR = radius * 1.8 * s;  // Overall borehole ring radius
	var coupledR = radius * 1.5 * s;   // Coupled fills the hole (slightly smaller)
	var decoupledOuterR = radius * 1.7 * s;
	var decoupledInnerR = radius * 1.3 * s;
	var spacerR = radius * 2.0 * s;    // Spacer extends past borehole
	var inertR = boreholeR;            // Inert = borehole wall
	var centerR = radius * 0.8 * s;    // Inner edge of charge ring

	// Calculate angular extent for each deck
	// Start at 270 degrees (top = collar), go clockwise
	var currentAngle = 270;

	// Save canvas state
	ctx.save();

	// Draw each deck as a wedge/arc
	for (var i = 0; i < charging.decks.length; i++) {
		var deck = charging.decks[i];
		var deckLen = Math.abs((deck.baseDepth || 0) - (deck.topDepth || 0));
		var angularExtent = (deckLen / holeLength) * 360;
		if (angularExtent < 0.5) continue; // Skip tiny decks

		var startAngle = currentAngle;
		var endAngle = currentAngle + angularExtent;
		var color = getDeckColor2D(deck);

		if (deck.deckType === DECK_TYPES.COUPLED) {
			drawWedge(ctx, cx, cy, startAngle, endAngle, coupledR, color);
		} else if (deck.deckType === DECK_TYPES.DECOUPLED) {
			drawArc(ctx, cx, cy, startAngle, endAngle, decoupledInnerR, decoupledOuterR, color);
		} else if (deck.deckType === DECK_TYPES.SPACER) {
			drawWedge(ctx, cx, cy, startAngle, endAngle, spacerR, color);
		} else {
			// INERT
			drawWedge(ctx, cx, cy, startAngle, endAngle, inertR, color);
		}

		currentAngle = endAngle;
	}

	// Draw primer indicators
	if (charging.primers) {
		for (var p = 0; p < charging.primers.length; p++) {
			var primer = charging.primers[p];
			var primerDepth = primer.lengthFromCollar;
			if (primerDepth == null) continue;

			// Calculate angular position of primer
			var primerFraction = primerDepth / holeLength;
			var primerAngle = 270 + primerFraction * 360;

			// Draw primer wedge (small red)
			drawWedge(ctx, cx, cy, primerAngle - 3, primerAngle + 3, boreholeR + radius * 0.3, PRIMER_2D_COLOR);

			// Draw detonator diamond
			var diamondAngle = primerAngle * DEG_TO_RAD;
			var diamondR = boreholeR + radius * 0.1;
			var dx = cx + diamondR * Math.cos(diamondAngle);
			var dy = cy + diamondR * Math.sin(diamondAngle);
			drawDiamond(ctx, dx, dy, radius * 0.15, DETONATOR_2D_COLOR);
		}
	}

	// Draw start/end marker line at 270 degrees (top = collar) - responsive to dark mode
	var dark = typeof window.darkModeEnabled !== "undefined" ? window.darkModeEnabled : false;
	var markerColor = dark ? "#cccccc" : "#333333";

	var markerAngle = 270 * DEG_TO_RAD;
	var markerInner = centerR;
	var markerOuter = boreholeR + radius * 0.4;

	ctx.strokeStyle = markerColor;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(cx + markerInner * Math.cos(markerAngle), cy + markerInner * Math.sin(markerAngle));
	ctx.lineTo(cx + markerOuter * Math.cos(markerAngle), cy + markerOuter * Math.sin(markerAngle));
	ctx.stroke();

	ctx.restore();
}
