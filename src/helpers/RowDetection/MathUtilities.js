// src/helpers/RowDetection/MathUtilities.js
//=============================================================
// MATH UTILITIES FOR ROW DETECTION
//=============================================================
// Step 0) Mathematical helper functions used across row detection algorithms
// Extracted from kirra.js

// Step 1) Calculate Euclidean distance between two points (coordinate version)
export function calculateDistanceXY(x1, y1, x2, y2) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	return Math.sqrt(dx * dx + dy * dy);
}

// Step 2) Normalize angle to 0-360 range
export function normalizeAngle(angle) {
	while (angle < 0) angle += 360;
	while (angle >= 360) angle -= 360;
	return angle;
}

// Step 3) Estimate row direction using PCA (Principal Component Analysis)
// Originally at kirra.js:40324
export function estimateRowDirection(holes) {
	if (holes.length < 2) return 0;

	// Use PCA to find principal direction
	var sumX = 0, sumY = 0;
	for (var i = 0; i < holes.length; i++) {
		sumX += holes[i].startXLocation;
		sumY += holes[i].startYLocation;
	}
	var meanX = sumX / holes.length;
	var meanY = sumY / holes.length;

	var covarXX = 0, covarXY = 0, covarYY = 0;

	for (var j = 0; j < holes.length; j++) {
		var dx = holes[j].startXLocation - meanX;
		var dy = holes[j].startYLocation - meanY;
		covarXX += dx * dx;
		covarXY += dx * dy;
		covarYY += dy * dy;
	}

	// Calculate principal direction (eigenvector of covariance matrix)
	var trace = covarXX + covarYY;
	var det = covarXX * covarYY - covarXY * covarXY;
	var eigenvalue1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;

	// Principal direction angle
	if (Math.abs(covarXY) > 1e-10) {
		return Math.atan2(eigenvalue1 - covarXX, covarXY);
	} else {
		return covarXX > covarYY ? 0 : Math.PI / 2;
	}
}

// Step 4) Calculate bearing between two points (0 = North, 90 = East)
export function calculateBearing(x1, y1, x2, y2) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	var bearing = Math.atan2(dx, dy) * (180 / Math.PI);
	return normalizeAngle(bearing);
}

// Step 5) Project point onto line direction
export function projectOntoDirection(x, y, direction) {
	return x * Math.cos(direction) + y * Math.sin(direction);
}

// Step 6) Calculate point-to-line distance
export function pointToLineDistance(px, py, x1, y1, x2, y2) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	var lengthSq = dx * dx + dy * dy;

	if (lengthSq === 0) {
		return calculateDistanceXY(px, py, x1, y1);
	}

	var t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));

	var nearestX = x1 + t * dx;
	var nearestY = y1 + t * dy;

	return calculateDistanceXY(px, py, nearestX, nearestY);
}

// Step 7) Calculate mean of array
export function mean(arr) {
	if (arr.length === 0) return 0;
	var sum = 0;
	for (var i = 0; i < arr.length; i++) {
		sum += arr[i];
	}
	return sum / arr.length;
}

// Step 8) Calculate variance of array
export function variance(arr) {
	if (arr.length < 2) return 0;
	var m = mean(arr);
	var sumSq = 0;
	for (var i = 0; i < arr.length; i++) {
		var diff = arr[i] - m;
		sumSq += diff * diff;
	}
	return sumSq / (arr.length - 1);
}

// Step 9) Calculate standard deviation
export function standardDeviation(arr) {
	return Math.sqrt(variance(arr));
}

// Step 10) Get next available row ID for an entity
export function getNextRowID(entityName) {
	// This function needs access to window.allBlastHoles
	if (!window.allBlastHoles) return 1;

	var maxRowID = 0;
	for (var i = 0; i < window.allBlastHoles.length; i++) {
		var hole = window.allBlastHoles[i];
		if (hole.entityName === entityName && hole.rowID > maxRowID) {
			maxRowID = hole.rowID;
		}
	}
	return maxRowID + 1;
}

// Step 11) Estimate row orientation (compass bearing 0° = North, 90° = East)
export function estimateRowOrientation(holes) {
	if (!holes || holes.length < 2) return 0;

	// Use PCA (Principal Component Analysis) to find dominant direction
	var meanX = 0;
	var meanY = 0;
	holes.forEach(function(hole) {
		meanX += hole.startXLocation;
		meanY += hole.startYLocation;
	});
	meanX /= holes.length;
	meanY /= holes.length;

	var covarXX = 0;
	var covarXY = 0;
	var covarYY = 0;

	holes.forEach(function(hole) {
		var dx = hole.startXLocation - meanX;
		var dy = hole.startYLocation - meanY;
		covarXX += dx * dx;
		covarXY += dx * dy;
		covarYY += dy * dy;
	});

	// Calculate principal direction (eigenvector of covariance matrix)
	var trace = covarXX + covarYY;
	var det = covarXX * covarYY - covarXY * covarXY;
	var eigenvalue1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;

	// Principal direction angle
	var angle;
	if (Math.abs(covarXY) > 1e-10) {
		angle = Math.atan2(eigenvalue1 - covarXX, covarXY);
	} else {
		angle = covarXX > covarYY ? 0 : Math.PI / 2;
	}

	// Convert to compass bearing (0° = North, 90° = East)
	var bearing = 90 - (angle * 180) / Math.PI;
	if (bearing < 0) bearing += 360;
	if (bearing >= 360) bearing -= 360;

	return bearing;
}

// Step 12) Calculate burden and spacing for holes based on row assignments
/**
 * Calculates burden and spacing for holes based on their row assignments:
 * - Spacing: Distance to next hole in the same row (along row direction)
 * - Burden: PERPENDICULAR distance between rows (not hypotenuse)
 */
export function calculateBurdenAndSpacingForHoles(holes) {
	if (!holes || holes.length === 0) return;

	// Group holes by entity name
	var entitiesByName = new Map();
	holes.forEach(function(hole) {
		if (!entitiesByName.has(hole.entityName)) {
			entitiesByName.set(hole.entityName, []);
		}
		entitiesByName.get(hole.entityName).push(hole);
	});

	// Calculate burden and spacing for each entity
	entitiesByName.forEach(function(entityHoles, entityName) {
		// Group holes by row
		var rowMap = new Map();
		entityHoles.forEach(function(hole) {
			var rowKey = hole.rowID || 0;
			if (!rowMap.has(rowKey)) {
				rowMap.set(rowKey, []);
			}
			rowMap.get(rowKey).push(hole);
		});

		// Sort holes within each row by posID
		rowMap.forEach(function(rowHoles) {
			rowHoles.sort(function(a, b) {
				return (a.posID || 0) - (b.posID || 0);
			});
		});

		// Calculate spacing (distance to next hole in same row)
		rowMap.forEach(function(rowHoles) {
			for (var i = 0; i < rowHoles.length; i++) {
				var hole = rowHoles[i];
				if (i < rowHoles.length - 1) {
					var nextHole = rowHoles[i + 1];
					var dx = nextHole.startXLocation - hole.startXLocation;
					var dy = nextHole.startYLocation - hole.startYLocation;
					hole.spacing = Math.round(Math.sqrt(dx * dx + dy * dy) * 1000) / 1000;
				} else {
					// Last hole in row - use average spacing of row
					if (rowHoles.length > 1) {
						var totalSpacing = 0;
						for (var j = 0; j < rowHoles.length - 1; j++) {
							totalSpacing += rowHoles[j].spacing;
						}
						hole.spacing = Math.round((totalSpacing / (rowHoles.length - 1)) * 1000) / 1000;
					} else {
						hole.spacing = 0;
					}
				}
			}
		});

		// Determine row orientation (direction along rows)
		var rowOrientation = estimateRowOrientation(entityHoles);
		console.log("Row orientation for " + entityName + ": " + rowOrientation.toFixed(2) + "°");

		// Convert compass bearing to radians
		var rowBearingRadians = ((90 - rowOrientation) * Math.PI) / 180;
		var burdenBearingRadians = rowBearingRadians - Math.PI / 2; // Perpendicular to row

		// Project all holes onto burden axis (perpendicular to rows)
		entityHoles.forEach(function(hole) {
			hole.burdenProjection =
				hole.startXLocation * Math.cos(burdenBearingRadians) +
				hole.startYLocation * Math.sin(burdenBearingRadians);
		});

		// Calculate burden as perpendicular distance between rows
		var sortedRows = Array.from(rowMap.keys()).sort(function(a, b) { return a - b; });

		sortedRows.forEach(function(rowID, rowIndex) {
			var rowHoles = rowMap.get(rowID);

			// Calculate average burden projection for this row
			var avgBurdenProj = 0;
			rowHoles.forEach(function(hole) {
				avgBurdenProj += hole.burdenProjection;
			});
			avgBurdenProj /= rowHoles.length;

			// Find burden to adjacent rows
			var burdenToNext = 0;
			var burdenToPrev = 0;

			if (rowIndex < sortedRows.length - 1) {
				var nextRowID = sortedRows[rowIndex + 1];
				var nextRowHoles = rowMap.get(nextRowID);
				var nextAvgProj = 0;
				nextRowHoles.forEach(function(hole) {
					nextAvgProj += hole.burdenProjection;
				});
				nextAvgProj /= nextRowHoles.length;
				burdenToNext = Math.abs(nextAvgProj - avgBurdenProj);
			}

			if (rowIndex > 0) {
				var prevRowID = sortedRows[rowIndex - 1];
				var prevRowHoles = rowMap.get(prevRowID);
				var prevAvgProj = 0;
				prevRowHoles.forEach(function(hole) {
					prevAvgProj += hole.burdenProjection;
				});
				prevAvgProj /= prevRowHoles.length;
				burdenToPrev = Math.abs(avgBurdenProj - prevAvgProj);
			}

			// Assign burden to each hole in row (rounded to 3 decimal places)
			rowHoles.forEach(function(hole) {
				if (rowIndex === 0) {
					// First row - use burden to next row
					hole.burden = Math.round((burdenToNext || 0) * 1000) / 1000;
				} else if (rowIndex === sortedRows.length - 1) {
					// Last row - use burden to previous row
					hole.burden = Math.round((burdenToPrev || 0) * 1000) / 1000;
				} else {
					// Middle rows - use average of both
					hole.burden = Math.round(((burdenToPrev + burdenToNext) / 2) * 1000) / 1000;
				}
			});
		});

		// Clean up temporary projection properties
		entityHoles.forEach(function(hole) {
			delete hole.burdenProjection;
		});

		console.log("Calculated burden and spacing for " + entityHoles.length + " holes in entity: " + entityName);
	});
}

// Step 13) Douglas-Peucker algorithm for polyline simplification
/**
 * Simplifies a polyline using the Ramer-Douglas-Peucker algorithm
 * @param {Array} points - Array of {x, y} or {startXLocation, startYLocation} objects
 * @param {number} epsilon - Maximum perpendicular distance threshold
 * @returns {Array} - Simplified array of point indices
 */
export function douglasPeucker(points, epsilon) {
	if (!points || points.length < 3) {
		return points.map(function(p, i) { return i; });
	}

	// Helper to get coordinates from point
	function getX(p) { return p.startXLocation !== undefined ? p.startXLocation : p.x; }
	function getY(p) { return p.startYLocation !== undefined ? p.startYLocation : p.y; }

	// Find point with maximum perpendicular distance from line
	var start = points[0];
	var end = points[points.length - 1];
	var maxDist = 0;
	var maxIndex = 0;

	for (var i = 1; i < points.length - 1; i++) {
		var dist = pointToLineDistance(
			getX(points[i]), getY(points[i]),
			getX(start), getY(start),
			getX(end), getY(end)
		);
		if (dist > maxDist) {
			maxDist = dist;
			maxIndex = i;
		}
	}

	// If max distance exceeds epsilon, recursively simplify
	if (maxDist > epsilon) {
		// Recursively simplify the two halves
		var left = douglasPeuckerRecursive(points.slice(0, maxIndex + 1), epsilon);
		var right = douglasPeuckerRecursive(points.slice(maxIndex), epsilon);

		// Combine results, excluding duplicate middle point
		return left.slice(0, -1).concat(right);
	} else {
		// All points between start and end are within epsilon - keep only endpoints
		return [points[0], points[points.length - 1]];
	}
}

// Recursive helper that returns points (not indices)
function douglasPeuckerRecursive(points, epsilon) {
	if (!points || points.length < 3) {
		return points;
	}

	function getX(p) { return p.startXLocation !== undefined ? p.startXLocation : p.x; }
	function getY(p) { return p.startYLocation !== undefined ? p.startYLocation : p.y; }

	var start = points[0];
	var end = points[points.length - 1];
	var maxDist = 0;
	var maxIndex = 0;

	for (var i = 1; i < points.length - 1; i++) {
		var dist = pointToLineDistance(
			getX(points[i]), getY(points[i]),
			getX(start), getY(start),
			getX(end), getY(end)
		);
		if (dist > maxDist) {
			maxDist = dist;
			maxIndex = i;
		}
	}

	if (maxDist > epsilon) {
		var left = douglasPeuckerRecursive(points.slice(0, maxIndex + 1), epsilon);
		var right = douglasPeuckerRecursive(points.slice(maxIndex), epsilon);
		return left.slice(0, -1).concat(right);
	} else {
		return [points[0], points[points.length - 1]];
	}
}

// Step 14) Order points using nearest-neighbor chain
/**
 * Orders points using greedy nearest-neighbor chain starting from an endpoint
 * @param {Array} points - Array of point objects with startXLocation, startYLocation
 * @returns {Array} - Array of indices in chain order
 */
export function orderByNearestNeighborChain(points) {
	if (!points || points.length === 0) return [];
	if (points.length === 1) return [0];

	var n = points.length;
	var visited = new Array(n).fill(false);
	var chain = [];

	// Find the point furthest from centroid as starting point (likely an endpoint)
	var centroidX = 0, centroidY = 0;
	for (var i = 0; i < n; i++) {
		centroidX += points[i].startXLocation;
		centroidY += points[i].startYLocation;
	}
	centroidX /= n;
	centroidY /= n;

	var startIdx = 0;
	var maxDistFromCentroid = 0;
	for (var i = 0; i < n; i++) {
		var dist = calculateDistanceXY(
			points[i].startXLocation, points[i].startYLocation,
			centroidX, centroidY
		);
		if (dist > maxDistFromCentroid) {
			maxDistFromCentroid = dist;
			startIdx = i;
		}
	}

	// Build chain using nearest unvisited neighbor
	var current = startIdx;
	while (chain.length < n) {
		chain.push(current);
		visited[current] = true;

		// Find nearest unvisited neighbor
		var nearestIdx = -1;
		var nearestDist = Infinity;
		for (var j = 0; j < n; j++) {
			if (!visited[j]) {
				var dist = calculateDistanceXY(
					points[current].startXLocation, points[current].startYLocation,
					points[j].startXLocation, points[j].startYLocation
				);
				if (dist < nearestDist) {
					nearestDist = dist;
					nearestIdx = j;
				}
			}
		}

		if (nearestIdx === -1) break;
		current = nearestIdx;
	}

	return chain;
}

// Step 15) Assign clusters to rows (helper for clustering algorithms)
export function assignClustersToRows(holesData, clusters, entityName) {
	var startingRowID = getNextRowID(entityName);

	clusters.forEach(function(cluster, clusterIndex) {
		var rowID = startingRowID + clusterIndex;
		var rowHoles = cluster.map(function(pointIndex) {
			return holesData[pointIndex];
		});

		// Sort holes within row by spatial position
		var direction = estimateRowDirection(rowHoles);
		rowHoles.sort(function(a, b) {
			var projA = a.startXLocation * Math.cos(direction) + a.startYLocation * Math.sin(direction);
			var projB = b.startXLocation * Math.cos(direction) + b.startYLocation * Math.sin(direction);
			return projA - projB;
		});

		// Assign row and position IDs
		rowHoles.forEach(function(hole, pos) {
			hole.rowID = rowID;
			hole.posID = pos + 1;
		});
	});
}
