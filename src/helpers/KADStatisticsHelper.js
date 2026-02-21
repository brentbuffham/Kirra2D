/**
 * KADStatisticsHelper.js
 *
 * Computes statistics for KAD poly and line entities:
 * vertices, segments, total length, projected areas, winding direction, closed status.
 */

/**
 * Compute the 2D segment length between two points in XY.
 */
function segmentLength3D(p1, p2) {
	var dx = p2.pointXLocation - p1.pointXLocation;
	var dy = p2.pointYLocation - p1.pointYLocation;
	var dz = p2.pointZLocation - p1.pointZLocation;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Compute the signed area of a polygon projected onto a plane using the shoelace formula.
 * axisA and axisB are the two coordinate accessors (e.g., "pointXLocation", "pointYLocation").
 * Returns signed area (positive = CCW in that projection).
 */
function signedProjectedArea(points, axisA, axisB) {
	var n = points.length;
	if (n < 3) return 0;
	var sum = 0;
	for (var i = 0; i < n; i++) {
		var j = (i + 1) % n;
		sum += points[i][axisA] * points[j][axisB];
		sum -= points[j][axisA] * points[i][axisB];
	}
	return sum / 2;
}

/**
 * Determine winding direction from signed XY area.
 * Kirra convention: X+ = East, Y+ = North.
 * Positive signed area (CCW in math) = counter-clockwise when viewed from above.
 */
function windingDirection(signedAreaXY) {
	if (signedAreaXY > 0) return "CCW";
	if (signedAreaXY < 0) return "CW";
	return "N/A";
}

/**
 * Compute statistics for a single KAD poly or line entity.
 *
 * @param {Object} entity - Entity from window.allKADDrawingsMap
 * @returns {Object} Statistics row
 */
export function computeKADEntityStatistics(entity) {
	var data = entity.data || [];
	var numVertices = data.length;
	var isClosed = entity.entityType === "poly" || (data.length > 0 && data[0].closed === true);

	// Count segments and compute total length
	var numSegments = 0;
	var totalLength = 0;
	if (numVertices >= 2) {
		numSegments = isClosed ? numVertices : numVertices - 1;
		for (var i = 0; i < numSegments; i++) {
			var j = (i + 1) % numVertices;
			totalLength += segmentLength3D(data[i], data[j]);
		}
	}

	// Projected areas (only meaningful for closed polys with >= 3 vertices)
	var areaXY = 0;
	var areaYZ = 0;
	var areaXZ = 0;
	var signedXY = 0;
	if (isClosed && numVertices >= 3) {
		signedXY = signedProjectedArea(data, "pointXLocation", "pointYLocation");
		areaXY = Math.abs(signedXY);
		areaYZ = Math.abs(signedProjectedArea(data, "pointYLocation", "pointZLocation"));
		areaXZ = Math.abs(signedProjectedArea(data, "pointXLocation", "pointZLocation"));
	}

	var winding = isClosed && numVertices >= 3 ? windingDirection(signedXY) : "N/A";

	return {
		name: entity.entityName || "Unnamed",
		vertices: numVertices,
		segments: numSegments,
		length: totalLength,
		areaXY: areaXY,
		areaYZ: areaYZ,
		areaXZ: areaXZ,
		windingDirection: winding,
		closed: isClosed ? "Yes" : "No"
	};
}
