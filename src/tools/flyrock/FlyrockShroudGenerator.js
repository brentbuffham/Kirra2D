// src/tools/flyrock/FlyrockShroudGenerator.js

/**
 * FlyrockShroudGenerator creates a single 3D triangulated shroud surface
 * representing the flyrock envelope around blast holes.
 *
 * Uses a heightfield max-union approach:
 *   1. Compute per-hole flyrock parameters (distance, velocity)
 *   2. Create a regular XY grid over the bounding box + max distance padding
 *   3. For each grid point, compute max envelope altitude across all holes
 *   4. Triangulate grid cells (2 triangles per cell)
 *   5. Cull triangles outside envelope and steeper than endAngle
 *
 * Output: surface object compatible with saveSurfaceToDB()
 * Triangle format: { vertices: [{x,y,z}, {x,y,z}, {x,y,z}] }
 */

import { richardsMoore, envelopeAltitude, lundborg, mckenzie } from "./FlyrockCalculator.js";

var PI = Math.PI;
var GRAVITY = 9.80665;

/**
 * Generate a flyrock shroud surface for a set of blast holes.
 *
 * @param {Array} holes - Blast holes (from window.allBlastHoles)
 * @param {Object} params - Generation parameters
 * @param {string} params.algorithm - "richardsMoore" | "lundborg" | "mckenzie"
 * @param {number} params.K - Flyrock constant (Richards & Moore)
 * @param {number} params.factorOfSafety - Safety factor
 * @param {number} params.stemEjectAngleDeg - Stem eject angle (degrees)
 * @param {number} params.inholeDensity - Explosive density (kg/L)
 * @param {number} params.rockDensity - Rock density (kg/m³)
 * @param {number} params.iterations - Grid resolution factor
 * @param {number} params.endAngleDeg - Face angle culling threshold (degrees from horizontal)
 * @param {number} params.transparency - Surface transparency (0-1)
 * @returns {Object} - Surface object { id, name, points, triangles, ... }
 */
export function generate(holes, params) {
	if (!holes || holes.length === 0) {
		console.warn("FlyrockShroudGenerator: No holes provided");
		return null;
	}

	params = params || {};
	var algorithm = params.algorithm || "richardsMoore";
	var iterations = params.iterations || 40;
	var endAngleDeg = params.endAngleDeg !== undefined ? params.endAngleDeg : 85;
	var transparency = params.transparency !== undefined ? params.transparency : 0.5;

	// Step 1: Compute per-hole flyrock parameters
	var holeData = [];
	for (var h = 0; h < holes.length; h++) {
		var hole = holes[h];
		var cx = hole.startXLocation || 0;
		var cy = hole.startYLocation || 0;
		var cz = hole.startZLocation || 0;

		var holeParams = getHoleFlyrockParams(hole, params);

		var maxDistance;
		var maxVelocity;

		switch (algorithm) {
			case "lundborg":
				maxDistance = lundborg(holeParams.holeDiameterMm);
				maxVelocity = Math.sqrt(maxDistance * GRAVITY);
				break;

			case "mckenzie":
				var mckResult = mckenzie(holeParams);
				maxDistance = mckResult.clearance;
				maxVelocity = mckResult.v0 || Math.sqrt(maxDistance * GRAVITY);
				break;

			case "richardsMoore":
			default:
				var rmResult = richardsMoore(holeParams);
				maxDistance = rmResult.maxDistance;
				maxVelocity = rmResult.maxVelocity;
				break;
		}

		if (maxDistance <= 0 || maxVelocity <= 0) continue;

		holeData.push({
			cx: cx,
			cy: cy,
			cz: cz,
			maxDistance: maxDistance,
			maxVelocity: maxVelocity
		});
	}

	if (holeData.length === 0) {
		console.warn("FlyrockShroudGenerator: No valid hole data");
		return null;
	}

	// Step 2: Compute grid bounding box from hole positions + max distance
	var overallMaxDist = 0;
	var gridMinX = Infinity, gridMaxX = -Infinity;
	var gridMinY = Infinity, gridMaxY = -Infinity;
	for (var i = 0; i < holeData.length; i++) {
		var hd = holeData[i];
		if (hd.maxDistance > overallMaxDist) overallMaxDist = hd.maxDistance;
		if (hd.cx - hd.maxDistance < gridMinX) gridMinX = hd.cx - hd.maxDistance;
		if (hd.cx + hd.maxDistance > gridMaxX) gridMaxX = hd.cx + hd.maxDistance;
		if (hd.cy - hd.maxDistance < gridMinY) gridMinY = hd.cy - hd.maxDistance;
		if (hd.cy + hd.maxDistance > gridMaxY) gridMaxY = hd.cy + hd.maxDistance;
	}

	// Step 3: Compute grid spacing from iterations parameter
	var gridSpacing = overallMaxDist / (iterations / 2);
	if (gridSpacing <= 0) gridSpacing = 1;

	var cols = Math.ceil((gridMaxX - gridMinX) / gridSpacing) + 1;
	var rows = Math.ceil((gridMaxY - gridMinY) / gridSpacing) + 1;

	// Safety limit — cap grid size to prevent memory blow-up
	var maxGridCells = 500;
	if (cols > maxGridCells || rows > maxGridCells) {
		var scaleDown = maxGridCells / Math.max(cols, rows);
		gridSpacing = gridSpacing / scaleDown;
		cols = Math.ceil((gridMaxX - gridMinX) / gridSpacing) + 1;
		rows = Math.ceil((gridMaxY - gridMinY) / gridSpacing) + 1;
	}

	// Step 4: Compute grid Z values (max envelope altitude across all holes)
	// gridZ[row][col] stores {z: absolute Z, alt: altitude above ground level}
	var gridZ = new Array(rows);
	var gridAlt = new Array(rows);
	for (var r = 0; r < rows; r++) {
		gridZ[r] = new Float64Array(cols);
		gridAlt[r] = new Float64Array(cols);
	}

	for (var r = 0; r < rows; r++) {
		var gy = gridMinY + r * gridSpacing;
		for (var c = 0; c < cols; c++) {
			var gx = gridMinX + c * gridSpacing;

			var bestAbsZ = -Infinity;
			var bestAlt = 0;

			for (var hi = 0; hi < holeData.length; hi++) {
				var hd = holeData[hi];
				var dx = gx - hd.cx;
				var dy = gy - hd.cy;
				var dist = Math.sqrt(dx * dx + dy * dy);
				var alt = envelopeAltitude(dist, hd.maxVelocity);
				var absZ = hd.cz + alt;

				if (absZ > bestAbsZ) {
					bestAbsZ = absZ;
					bestAlt = alt;
				}
			}

			gridZ[r][c] = bestAbsZ;
			gridAlt[r][c] = bestAlt;
		}
	}

	// Step 5: Build triangles from grid (2 per cell), skip cells outside envelope
	var allTriangles = [];
	var allPoints = [];
	var pointMap = {}; // "row,col" -> index for deduplication

	function getOrCreatePoint(row, col) {
		var key = row + "," + col;
		if (pointMap[key] !== undefined) return pointMap[key];
		var px = gridMinX + col * gridSpacing;
		var py = gridMinY + row * gridSpacing;
		var pz = gridZ[row][col];
		var idx = allPoints.length;
		allPoints.push({ x: px, y: py, z: pz });
		pointMap[key] = idx;
		return idx;
	}

	var endAngleRad = endAngleDeg * (PI / 180);
	var cosEndAngle = Math.cos(endAngleRad);

	for (var r = 0; r < rows - 1; r++) {
		for (var c = 0; c < cols - 1; c++) {
			// Four corners of the cell
			var a00 = gridAlt[r][c];
			var a10 = gridAlt[r + 1][c];
			var a01 = gridAlt[r][c + 1];
			var a11 = gridAlt[r + 1][c + 1];

			// Triangle 1: (r,c) (r+1,c) (r,c+1)
			if (!(a00 <= 0 && a10 <= 0 && a01 <= 0)) {
				var i0 = getOrCreatePoint(r, c);
				var i1 = getOrCreatePoint(r + 1, c);
				var i2 = getOrCreatePoint(r, c + 1);

				// Face angle culling
				if (passesAngleCull(allPoints[i0], allPoints[i1], allPoints[i2], cosEndAngle)) {
					allTriangles.push({
						vertices: [allPoints[i0], allPoints[i1], allPoints[i2]]
					});
				}
			}

			// Triangle 2: (r+1,c) (r+1,c+1) (r,c+1)
			if (!(a10 <= 0 && a11 <= 0 && a01 <= 0)) {
				var i0 = getOrCreatePoint(r + 1, c);
				var i1 = getOrCreatePoint(r + 1, c + 1);
				var i2 = getOrCreatePoint(r, c + 1);

				if (passesAngleCull(allPoints[i0], allPoints[i1], allPoints[i2], cosEndAngle)) {
					allTriangles.push({
						vertices: [allPoints[i0], allPoints[i1], allPoints[i2]]
					});
				}
			}
		}
	}

	if (allTriangles.length === 0) {
		console.warn("FlyrockShroudGenerator: No triangles generated");
		return null;
	}

	// Build surface object compatible with saveSurfaceToDB
	var timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
	var surfaceId = "flyrock_shroud_" + timestamp;

	return {
		id: surfaceId,
		name: "Flyrock Shroud (" + algorithm + ")",
		type: "triangulated",
		points: allPoints,
		triangles: allTriangles,
		visible: true,
		gradient: "default",
		transparency: transparency,
		isFlyrockShroud: true,
		flyrockParams: {
			algorithm: algorithm,
			K: params.K,
			factorOfSafety: params.factorOfSafety,
			stemEjectAngleDeg: params.stemEjectAngleDeg,
			inholeDensity: params.inholeDensity,
			holeCount: holes.length,
			endAngleDeg: endAngleDeg,
			gridSpacing: gridSpacing,
			gridSize: cols + "x" + rows
		},
		metadata: {
			createdAt: new Date().toISOString(),
			algorithm: algorithm
		}
	};
}

/**
 * Check if a triangle passes face angle culling.
 * Returns false if the triangle is steeper than the end angle threshold.
 *
 * @param {Object} v0 - {x, y, z}
 * @param {Object} v1 - {x, y, z}
 * @param {Object} v2 - {x, y, z}
 * @param {number} cosEndAngle - cosine of the max allowed slope angle from horizontal
 * @returns {boolean} - true if triangle passes (not too steep)
 */
function passesAngleCull(v0, v1, v2, cosEndAngle) {
	// Edge vectors
	var e1x = v1.x - v0.x, e1y = v1.y - v0.y, e1z = v1.z - v0.z;
	var e2x = v2.x - v0.x, e2y = v2.y - v0.y, e2z = v2.z - v0.z;

	// Cross product (face normal)
	var nx = e1y * e2z - e1z * e2y;
	var ny = e1z * e2x - e1x * e2z;
	var nz = e1x * e2y - e1y * e2x;

	var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
	if (len < 1e-10) return false; // Degenerate triangle

	// Slope angle from horizontal = acos(|nz| / len)
	// Triangle is too steep if acos(|nz|/len) > endAngle
	// i.e., |nz|/len < cos(endAngle)
	var absNzNorm = Math.abs(nz) / len;
	return absNzNorm >= cosEndAngle;
}

/**
 * Extract flyrock-relevant parameters from a hole, using charging data when available.
 *
 * @param {Object} hole - Blast hole object
 * @param {Object} defaults - Default parameters from dialog
 * @returns {Object} - Parameters for FlyrockCalculator functions
 */
function getHoleFlyrockParams(hole, defaults) {
	var holeDiamMm = parseFloat(hole.holeDiameter) || defaults.holeDiameterMm || 115;
	var burden = parseFloat(hole.burden) || defaults.burden || 3.6;
	var benchHeight = parseFloat(hole.benchHeight) || defaults.benchHeight || 12;
	var subdrill = parseFloat(hole.subdrillAmount) || defaults.subdrill || 1;
	var inholeDensity = defaults.inholeDensity || 1.2;
	var rockDensity = defaults.rockDensity || 2600;

	// Try to get stemming from charging data
	var stemmingLength = defaults.stemmingLength || 2;
	var chargeLength = benchHeight + subdrill - stemmingLength;

	if (window.loadedCharging && window.loadedCharging.has(hole.holeID)) {
		var charging = window.loadedCharging.get(hole.holeID);
		if (charging && charging.decks && charging.decks.length > 0) {
			// Find topmost explosive deck depth (stemming length)
			var topExplosiveDepth = null;
			var bottomExplosiveDepth = 0;
			for (var i = 0; i < charging.decks.length; i++) {
				var deck = charging.decks[i];
				if (deck.deckType === "COUPLED" || deck.deckType === "DECOUPLED") {
					var deckTop = Math.min(deck.topDepth, deck.baseDepth);
					var deckBase = Math.max(deck.topDepth, deck.baseDepth);
					if (topExplosiveDepth === null || deckTop < topExplosiveDepth) {
						topExplosiveDepth = deckTop;
					}
					if (deckBase > bottomExplosiveDepth) {
						bottomExplosiveDepth = deckBase;
					}
				}
			}
			if (topExplosiveDepth !== null) {
				stemmingLength = topExplosiveDepth;
				chargeLength = bottomExplosiveDepth - topExplosiveDepth;
			}
		}
	}

	return {
		holeDiameterMm: holeDiamMm,
		benchHeight: benchHeight,
		stemmingLength: stemmingLength,
		burden: burden,
		subdrill: subdrill,
		inholeDensity: inholeDensity,
		rockDensity: rockDensity,
		chargeLength: chargeLength,
		K: defaults.K || 20,
		factorOfSafety: defaults.factorOfSafety || 2,
		stemEjectAngleDeg: defaults.stemEjectAngleDeg || 80
	};
}
