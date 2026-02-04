/**
 * PointDeduplication.js
 *
 * XY-only point deduplication using spatial hash grid (O(n) amortized).
 * Designed for 2.5D surface triangulation where one Z per XY location is expected.
 * Also provides uniform stride-based decimation.
 */

/**
 * Deduplicate points based on XY distance using a spatial hash grid.
 * Points within the tolerance distance (XY only) are merged - the first
 * encountered point is kept and subsequent duplicates are discarded.
 *
 * @param {Array} points - Array of point objects with x, y, z properties
 * @param {number} tolerance - XY distance tolerance for merging (default 0.001)
 * @returns {{ uniquePoints: Array, originalCount: number, uniqueCount: number }}
 */
export function deduplicatePoints(points, tolerance) {
	if (!points || points.length === 0) {
		return { uniquePoints: [], originalCount: 0, uniqueCount: 0 };
	}

	tolerance = tolerance || 0.001;
	if (tolerance <= 0) tolerance = 0.001;

	var toleranceSq = tolerance * tolerance;
	var cellSize = tolerance;
	var grid = new Map();
	var uniquePoints = [];

	for (var i = 0; i < points.length; i++) {
		var point = points[i];
		var px = point.x;
		var py = point.y;

		// Compute grid cell indices
		var cellX = Math.floor(px / cellSize);
		var cellY = Math.floor(py / cellSize);

		// Check current cell and 8 XY neighbors for existing points within tolerance
		var foundDuplicate = false;

		for (var dx = -1; dx <= 1 && !foundDuplicate; dx++) {
			for (var dy = -1; dy <= 1 && !foundDuplicate; dy++) {
				var key = (cellX + dx) + "_" + (cellY + dy);
				var cell = grid.get(key);
				if (!cell) continue;

				for (var j = 0; j < cell.length; j++) {
					var existing = cell[j];
					var ex = existing.x - px;
					var ey = existing.y - py;
					if (ex * ex + ey * ey <= toleranceSq) {
						foundDuplicate = true;
						break;
					}
				}
			}
		}

		if (!foundDuplicate) {
			// Add to grid and unique list
			var ownKey = cellX + "_" + cellY;
			var ownCell = grid.get(ownKey);
			if (!ownCell) {
				ownCell = [];
				grid.set(ownKey, ownCell);
			}
			ownCell.push(point);
			uniquePoints.push(point);
		}
	}

	return {
		uniquePoints: uniquePoints,
		originalCount: points.length,
		uniqueCount: uniquePoints.length
	};
}

/**
 * Decimate a point array to a target count using uniform stride-based sampling.
 * Always keeps the first point. Evenly samples across the array.
 *
 * @param {Array} points - Array of point objects
 * @param {number} targetCount - Maximum number of points to keep
 * @returns {Array} Decimated array of points
 */
export function decimatePoints(points, targetCount) {
	if (!points || points.length <= targetCount) return points;
	if (targetCount <= 0) return points;

	var step = Math.floor(points.length / targetCount);
	if (step < 1) step = 1;

	var decimatedPoints = [];
	for (var i = 0; i < points.length; i += step) {
		decimatedPoints.push(points[i]);
	}

	return decimatedPoints;
}
