// src/helpers/RowDetection/CurveDetection.js
//=============================================================
// CURVE DETECTION ALGORITHMS
//=============================================================
// Step 0) Principal Curves, B-Spline fitting for curved row detection
// Used when pattern is classified as CURVED

import { calculateDistanceXY, estimateRowDirection, getNextRowID } from "./MathUtilities.js";

// Step 1) Detect curved rows using Principal Curves (Hastie-Stuetzle algorithm)
/**
 * Detect rows in curved/winding patterns using Principal Curves
 * @param {Array} holesData - Array of hole objects
 * @param {string} entityName - Name of blast entity
 * @param {number} expectedRowCount - Optional hint for number of rows
 * @returns {Array} - Array of row arrays, each containing hole indices
 */
export function detectCurvedRows(holesData, entityName, expectedRowCount) {
	if (!holesData || holesData.length < 4) {
		console.log("Not enough holes for curved row detection");
		return [];
	}

	console.log("Detecting curved rows for " + holesData.length + " holes");

	// Step 1a) Estimate number of rows if not provided
	if (!expectedRowCount) {
		expectedRowCount = estimateRowCount(holesData);
	}
	console.log("Estimated row count:", expectedRowCount);

	// Step 1b) Fit principal curve to data
	var principalCurve = fitPrincipalCurve(holesData, 0.3); // smoothing param

	// Step 1c) Project holes onto curve and get arc-length positions
	var projections = projectHolesOntoCurve(holesData, principalCurve);

	// Step 1d) Cluster by perpendicular distance to identify rows
	var rows = clusterByPerpendicularDistance(holesData, projections, expectedRowCount);

	// Step 1e) Order holes within each row by arc-length position
	rows = orderHolesWithinRows(rows, projections);

	// Step 1f) Assign row and position IDs
	assignRowAndPositionIDs(holesData, rows, entityName);

	console.log("Curved row detection found " + rows.length + " rows");
	return rows;
}

// Step 2) Fit Principal Curve using Hastie-Stuetzle algorithm
/**
 * Fit a principal curve through point distribution
 * @param {Array} holes - Array of hole objects
 * @param {number} smoothingParam - LOESS bandwidth (0.1-0.5)
 * @returns {Object} - { points: [], arcLengths: [] }
 */
export function fitPrincipalCurve(holes, smoothingParam) {
	var n = holes.length;
	smoothingParam = smoothingParam || 0.3;

	// Step 2a) Initialize curve with first principal component (PCA line)
	var pca = calculatePCA(holes);
	var curve = initializeCurveFromPCA(holes, pca, 50); // 50 points on initial curve

	// Step 2b) Iterative refinement
	var maxIterations = 20;
	var tolerance = 0.001;
	var previousCurve = null;

	for (var iter = 0; iter < maxIterations; iter++) {
		// Step 2b.i) Project each point onto current curve
		var projections = [];
		for (var i = 0; i < n; i++) {
			var proj = projectPointOntoCurve(holes[i], curve);
			projections.push(proj);
		}

		// Step 2b.ii) Smooth curve through projected points using LOESS
		var newCurve = loessSmooth(projections, smoothingParam);

		// Step 2b.iii) Check convergence
		if (previousCurve && curveConverged(newCurve, previousCurve, tolerance)) {
			console.log("Principal curve converged after " + (iter + 1) + " iterations");
			break;
		}

		previousCurve = curve;
		curve = newCurve;
	}

	// Step 2c) Calculate arc lengths
	curve.arcLengths = calculateArcLengths(curve.points);

	return curve;
}

// Step 3) Calculate PCA for initialization
function calculatePCA(holes) {
	var n = holes.length;

	// Calculate mean
	var sumX = 0, sumY = 0;
	for (var i = 0; i < n; i++) {
		sumX += holes[i].startXLocation;
		sumY += holes[i].startYLocation;
	}
	var meanX = sumX / n;
	var meanY = sumY / n;

	// Calculate covariance matrix
	var covarXX = 0, covarXY = 0, covarYY = 0;
	for (var j = 0; j < n; j++) {
		var dx = holes[j].startXLocation - meanX;
		var dy = holes[j].startYLocation - meanY;
		covarXX += dx * dx;
		covarXY += dx * dy;
		covarYY += dy * dy;
	}

	// Calculate eigenvector for largest eigenvalue
	var trace = covarXX + covarYY;
	var det = covarXX * covarYY - covarXY * covarXY;
	var lambda1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;

	// Eigenvector calculation
	var vx, vy;
	if (Math.abs(covarXY) > 0.0001) {
		vx = lambda1 - covarYY;
		vy = covarXY;
	} else if (covarXX > covarYY) {
		vx = 1;
		vy = 0;
	} else {
		vx = 0;
		vy = 1;
	}

	// Normalize
	var len = Math.sqrt(vx * vx + vy * vy);
	if (len > 0) {
		vx /= len;
		vy /= len;
	}

	return {
		meanX: meanX,
		meanY: meanY,
		direction: { x: vx, y: vy }
	};
}

// Step 4) Initialize curve from PCA line
function initializeCurveFromPCA(holes, pca, numPoints) {
	// Find extent of data projected onto principal direction
	var minProj = Infinity, maxProj = -Infinity;

	for (var i = 0; i < holes.length; i++) {
		var dx = holes[i].startXLocation - pca.meanX;
		var dy = holes[i].startYLocation - pca.meanY;
		var proj = dx * pca.direction.x + dy * pca.direction.y;
		if (proj < minProj) minProj = proj;
		if (proj > maxProj) maxProj = proj;
	}

	// Add margin
	var margin = (maxProj - minProj) * 0.1;
	minProj -= margin;
	maxProj += margin;

	// Create initial curve points
	var points = [];
	for (var p = 0; p < numPoints; p++) {
		var t = minProj + (maxProj - minProj) * p / (numPoints - 1);
		points.push({
			x: pca.meanX + t * pca.direction.x,
			y: pca.meanY + t * pca.direction.y,
			arcLength: 0
		});
	}

	return { points: points };
}

// Step 5) Project point onto curve (find closest point)
function projectPointOntoCurve(hole, curve) {
	var minDist = Infinity;
	var bestPoint = null;
	var bestIndex = 0;
	var bestT = 0;

	for (var i = 0; i < curve.points.length - 1; i++) {
		var p1 = curve.points[i];
		var p2 = curve.points[i + 1];

		// Project onto line segment
		var result = projectPointOntoSegment(
			hole.startXLocation, hole.startYLocation,
			p1.x, p1.y, p2.x, p2.y
		);

		if (result.dist < minDist) {
			minDist = result.dist;
			bestPoint = { x: result.x, y: result.y };
			bestIndex = i;
			bestT = result.t;
		}
	}

	return {
		x: bestPoint ? bestPoint.x : hole.startXLocation,
		y: bestPoint ? bestPoint.y : hole.startYLocation,
		perpDistance: minDist,
		segmentIndex: bestIndex,
		t: bestT
	};
}

// Step 6) Project point onto line segment
function projectPointOntoSegment(px, py, x1, y1, x2, y2) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	var lengthSq = dx * dx + dy * dy;

	if (lengthSq < 0.0001) {
		return {
			x: x1,
			y: y1,
			t: 0,
			dist: calculateDistanceXY(px, py, x1, y1)
		};
	}

	var t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));

	var nearestX = x1 + t * dx;
	var nearestY = y1 + t * dy;

	return {
		x: nearestX,
		y: nearestY,
		t: t,
		dist: calculateDistanceXY(px, py, nearestX, nearestY)
	};
}

// Step 7) LOESS smoothing for curve refinement
function loessSmooth(projections, bandwidth) {
	// Sort projections by arc length (approximate by segment index + t)
	var sorted = projections.slice().map(function(p, i) {
		return {
			originalIndex: i,
			sortKey: p.segmentIndex + p.t,
			x: p.x,
			y: p.y
		};
	});
	sorted.sort(function(a, b) { return a.sortKey - b.sortKey; });

	var n = sorted.length;
	var windowSize = Math.max(3, Math.floor(n * bandwidth));

	var smoothedPoints = [];

	for (var i = 0; i < n; i++) {
		// Find window of points
		var halfWindow = Math.floor(windowSize / 2);
		var startIdx = Math.max(0, i - halfWindow);
		var endIdx = Math.min(n, i + halfWindow + 1);

		// Calculate weighted average (tricube weights)
		var sumWeights = 0;
		var sumX = 0, sumY = 0;

		for (var j = startIdx; j < endIdx; j++) {
			var u = Math.abs(j - i) / halfWindow;
			if (u >= 1) continue;

			var weight = Math.pow(1 - Math.pow(u, 3), 3); // Tricube
			sumWeights += weight;
			sumX += weight * sorted[j].x;
			sumY += weight * sorted[j].y;
		}

		if (sumWeights > 0) {
			smoothedPoints.push({
				x: sumX / sumWeights,
				y: sumY / sumWeights,
				arcLength: 0
			});
		}
	}

	return { points: smoothedPoints };
}

// Step 8) Check curve convergence
function curveConverged(newCurve, oldCurve, tolerance) {
	if (newCurve.points.length !== oldCurve.points.length) return false;

	var maxDiff = 0;
	for (var i = 0; i < newCurve.points.length; i++) {
		var diff = calculateDistanceXY(
			newCurve.points[i].x, newCurve.points[i].y,
			oldCurve.points[i].x, oldCurve.points[i].y
		);
		if (diff > maxDiff) maxDiff = diff;
	}

	return maxDiff < tolerance;
}

// Step 9) Calculate arc lengths along curve
function calculateArcLengths(points) {
	var arcLengths = [0];
	var totalLength = 0;

	for (var i = 1; i < points.length; i++) {
		var dist = calculateDistanceXY(
			points[i - 1].x, points[i - 1].y,
			points[i].x, points[i].y
		);
		totalLength += dist;
		arcLengths.push(totalLength);
		points[i].arcLength = totalLength;
	}

	return arcLengths;
}

// Step 10) Project all holes onto curve and get arc positions
function projectHolesOntoCurve(holes, curve) {
	var projections = [];

	for (var i = 0; i < holes.length; i++) {
		var proj = projectPointOntoCurve(holes[i], curve);

		// Calculate arc length at projection point
		var baseArcLength = curve.arcLengths ? curve.arcLengths[proj.segmentIndex] : 0;
		if (proj.segmentIndex < curve.points.length - 1) {
			var segmentLength = calculateDistanceXY(
				curve.points[proj.segmentIndex].x, curve.points[proj.segmentIndex].y,
				curve.points[proj.segmentIndex + 1].x, curve.points[proj.segmentIndex + 1].y
			);
			baseArcLength += proj.t * segmentLength;
		}

		projections.push({
			holeIndex: i,
			x: proj.x,
			y: proj.y,
			arcLength: baseArcLength,
			perpDistance: proj.perpDistance
		});
	}

	return projections;
}

// Step 11) Cluster holes by perpendicular distance to identify rows
function clusterByPerpendicularDistance(holes, projections, expectedRowCount) {
	// Get all perpendicular distances
	var distances = projections.map(function(p) { return p.perpDistance; });

	// Estimate row spacing from perpendicular distances
	var sortedDistances = distances.slice().sort(function(a, b) { return a - b; });

	// Find natural gaps in perpendicular distances
	var rows = [];

	if (expectedRowCount <= 1) {
		// Single row - all holes
		rows.push(projections.map(function(p) { return p.holeIndex; }));
	} else {
		// Cluster by perpendicular distance using k-means style
		rows = kMeansClusterByDistance(projections, expectedRowCount);
	}

	return rows;
}

// Step 12) K-means clustering by perpendicular distance
function kMeansClusterByDistance(projections, k) {
	var n = projections.length;
	if (n < k) k = n;

	// Initialize cluster centers using perpendicular distances
	var perpDistances = projections.map(function(p) { return p.perpDistance; });
	var minD = Math.min.apply(null, perpDistances);
	var maxD = Math.max.apply(null, perpDistances);

	var centers = [];
	for (var c = 0; c < k; c++) {
		centers.push(minD + (maxD - minD) * (c + 0.5) / k);
	}

	// Iterate
	var assignments = new Array(n).fill(0);
	var maxIter = 20;

	for (var iter = 0; iter < maxIter; iter++) {
		// Assign to nearest center
		var changed = false;
		for (var i = 0; i < n; i++) {
			var bestCluster = 0;
			var bestDist = Infinity;
			for (var j = 0; j < k; j++) {
				var dist = Math.abs(perpDistances[i] - centers[j]);
				if (dist < bestDist) {
					bestDist = dist;
					bestCluster = j;
				}
			}
			if (assignments[i] !== bestCluster) {
				assignments[i] = bestCluster;
				changed = true;
			}
		}

		if (!changed) break;

		// Update centers
		for (var m = 0; m < k; m++) {
			var sum = 0;
			var count = 0;
			for (var p = 0; p < n; p++) {
				if (assignments[p] === m) {
					sum += perpDistances[p];
					count++;
				}
			}
			if (count > 0) {
				centers[m] = sum / count;
			}
		}
	}

	// Group by assignment
	var rows = [];
	for (var r = 0; r < k; r++) {
		var row = [];
		for (var h = 0; h < n; h++) {
			if (assignments[h] === r) {
				row.push(projections[h].holeIndex);
			}
		}
		if (row.length > 0) {
			rows.push(row);
		}
	}

	return rows;
}

// Step 13) Order holes within each row by arc-length position
function orderHolesWithinRows(rows, projections) {
	var orderedRows = [];

	for (var r = 0; r < rows.length; r++) {
		var row = rows[r];

		// Get arc lengths for holes in this row
		var holesWithArc = row.map(function(holeIndex) {
			var proj = projections.find(function(p) { return p.holeIndex === holeIndex; });
			return {
				holeIndex: holeIndex,
				arcLength: proj ? proj.arcLength : 0
			};
		});

		// Sort by arc length
		holesWithArc.sort(function(a, b) { return a.arcLength - b.arcLength; });

		orderedRows.push(holesWithArc.map(function(h) { return h.holeIndex; }));
	}

	// Sort rows by average perpendicular distance (row 1 = front row)
	orderedRows.sort(function(rowA, rowB) {
		var avgA = 0, avgB = 0;
		for (var i = 0; i < rowA.length; i++) {
			var proj = projections.find(function(p) { return p.holeIndex === rowA[i]; });
			avgA += proj ? proj.perpDistance : 0;
		}
		avgA /= rowA.length;

		for (var j = 0; j < rowB.length; j++) {
			var projB = projections.find(function(p) { return p.holeIndex === rowB[j]; });
			avgB += projB ? projB.perpDistance : 0;
		}
		avgB /= rowB.length;

		return avgA - avgB;
	});

	return orderedRows;
}

// Step 14) Assign row and position IDs
function assignRowAndPositionIDs(holesData, rows, entityName) {
	var startingRowID = getNextRowID(entityName);

	for (var r = 0; r < rows.length; r++) {
		var row = rows[r];
		var rowID = startingRowID + r;

		for (var p = 0; p < row.length; p++) {
			var holeIndex = row[p];
			holesData[holeIndex].rowID = rowID;
			holesData[holeIndex].posID = p + 1;
		}
	}
}

// Step 15) Estimate expected row count from data
function estimateRowCount(holes) {
	// Use extent and estimated spacing
	var minX = Infinity, maxX = -Infinity;
	var minY = Infinity, maxY = -Infinity;

	for (var i = 0; i < holes.length; i++) {
		if (holes[i].startXLocation < minX) minX = holes[i].startXLocation;
		if (holes[i].startXLocation > maxX) maxX = holes[i].startXLocation;
		if (holes[i].startYLocation < minY) minY = holes[i].startYLocation;
		if (holes[i].startYLocation > maxY) maxY = holes[i].startYLocation;
	}

	var extentX = maxX - minX;
	var extentY = maxY - minY;

	// Estimate spacing as average nearest neighbor distance
	var spacing = estimateSpacing(holes);

	// Estimate rows based on perpendicular extent
	var perpExtent = Math.min(extentX, extentY);
	var estimatedRows = Math.max(1, Math.round(perpExtent / spacing));

	return Math.min(estimatedRows, Math.floor(holes.length / 2));
}

// Step 16) Estimate spacing from hole data
function estimateSpacing(holes) {
	if (holes.length < 2) return 3.0;

	var distances = [];
	var sampleSize = Math.min(20, holes.length);

	for (var i = 0; i < sampleSize; i++) {
		var minDist = Infinity;
		for (var j = 0; j < holes.length; j++) {
			if (i === j) continue;
			var dist = calculateDistanceXY(
				holes[i].startXLocation, holes[i].startYLocation,
				holes[j].startXLocation, holes[j].startYLocation
			);
			if (dist < minDist) minDist = dist;
		}
		if (minDist < Infinity) distances.push(minDist);
	}

	if (distances.length === 0) return 3.0;

	distances.sort(function(a, b) { return a - b; });
	return distances[Math.floor(distances.length / 2)];
}

// Step 17) B-Spline curve fitting for ordered sequences
/**
 * Detect rows using B-Spline fitting for holes with reliable sequence numbers
 * @param {Array} orderedHoles - Holes sorted by sequence number
 * @param {string} entityName - Entity name for ID assignment
 * @returns {boolean} - Success flag
 */
export function detectRowsUsingSplineFitting(orderedHoles, entityName) {
	if (!orderedHoles || orderedHoles.length < 4) {
		console.log("Not enough holes for spline fitting");
		return false;
	}

	console.log("Detecting rows using B-Spline fitting for " + orderedHoles.length + " holes");

	// Step 17a) Fit cubic B-spline to sequence
	var controlPoints = extractControlPoints(orderedHoles, 5); // Every 5th hole
	var spline = fitBSpline(controlPoints, 3); // Cubic B-spline

	// Step 17b) Measure distance from each hole to spline
	var spacing = estimateSpacing(orderedHoles);
	var tolerance = spacing * 0.5;

	var rows = [];
	var currentRow = [];
	var currentRowIndex = 0;

	for (var i = 0; i < orderedHoles.length; i++) {
		var dist = pointToSplineDistance(orderedHoles[i], spline);

		if (dist > tolerance && currentRow.length > 0) {
			// Hole deviates - start new row
			rows.push(currentRow);
			currentRow = [i];
			currentRowIndex++;
		} else {
			currentRow.push(i);
		}
	}

	if (currentRow.length > 0) {
		rows.push(currentRow);
	}

	// Step 17c) Assign IDs
	if (rows.length === 1 && rows[0].length === orderedHoles.length) {
		// All holes fit one spline - need different clustering
		console.log("All holes fit single spline - falling back to perpendicular clustering");
		return false;
	}

	var startingRowID = getNextRowID(entityName);
	for (var r = 0; r < rows.length; r++) {
		for (var p = 0; p < rows[r].length; p++) {
			orderedHoles[rows[r][p]].rowID = startingRowID + r;
			orderedHoles[rows[r][p]].posID = p + 1;
		}
	}

	console.log("B-Spline fitting found " + rows.length + " rows");
	return true;
}

// Step 18) Extract control points from ordered holes
function extractControlPoints(holes, interval) {
	var controlPoints = [];
	for (var i = 0; i < holes.length; i += interval) {
		controlPoints.push({
			x: holes[i].startXLocation,
			y: holes[i].startYLocation
		});
	}
	// Always include last point
	if (controlPoints.length > 0) {
		var lastHole = holes[holes.length - 1];
		var lastCP = controlPoints[controlPoints.length - 1];
		if (lastCP.x !== lastHole.startXLocation || lastCP.y !== lastHole.startYLocation) {
			controlPoints.push({
				x: lastHole.startXLocation,
				y: lastHole.startYLocation
			});
		}
	}
	return controlPoints;
}

// Step 19) Fit cubic B-spline to control points
function fitBSpline(controlPoints, degree) {
	var n = controlPoints.length;
	if (n < degree + 1) {
		return { points: controlPoints, degree: 1 };
	}

	// Generate uniform knot vector
	var m = n + degree + 1;
	var knots = [];
	for (var i = 0; i < m; i++) {
		if (i < degree + 1) {
			knots.push(0);
		} else if (i >= m - degree - 1) {
			knots.push(1);
		} else {
			knots.push((i - degree) / (m - 2 * degree - 1));
		}
	}

	// Evaluate spline at regular intervals
	var numSamples = 100;
	var splinePoints = [];

	for (var s = 0; s <= numSamples; s++) {
		var t = s / numSamples;
		var point = evaluateBSpline(controlPoints, knots, degree, t);
		splinePoints.push(point);
	}

	return {
		points: splinePoints,
		controlPoints: controlPoints,
		knots: knots,
		degree: degree
	};
}

// Step 20) Evaluate B-spline at parameter t using Cox-de Boor recursion
function evaluateBSpline(controlPoints, knots, degree, t) {
	var n = controlPoints.length;
	var x = 0, y = 0;

	for (var i = 0; i < n; i++) {
		var basis = bSplineBasis(i, degree, t, knots);
		x += basis * controlPoints[i].x;
		y += basis * controlPoints[i].y;
	}

	return { x: x, y: y };
}

// Step 21) Cox-de Boor recursion for B-spline basis function
function bSplineBasis(i, degree, t, knots) {
	if (degree === 0) {
		if (knots[i] <= t && t < knots[i + 1]) {
			return 1;
		}
		if (t === 1 && knots[i] < 1 && knots[i + 1] === 1) {
			return 1; // Handle endpoint
		}
		return 0;
	}

	var left = 0, right = 0;

	var denom1 = knots[i + degree] - knots[i];
	if (denom1 > 0) {
		left = ((t - knots[i]) / denom1) * bSplineBasis(i, degree - 1, t, knots);
	}

	var denom2 = knots[i + degree + 1] - knots[i + 1];
	if (denom2 > 0) {
		right = ((knots[i + degree + 1] - t) / denom2) * bSplineBasis(i + 1, degree - 1, t, knots);
	}

	return left + right;
}

// Step 22) Calculate distance from point to B-spline
function pointToSplineDistance(hole, spline) {
	var minDist = Infinity;

	for (var i = 0; i < spline.points.length - 1; i++) {
		var result = projectPointOntoSegment(
			hole.startXLocation, hole.startYLocation,
			spline.points[i].x, spline.points[i].y,
			spline.points[i + 1].x, spline.points[i + 1].y
		);
		if (result.dist < minDist) {
			minDist = result.dist;
		}
	}

	return minDist;
}

// Step 23) Order holes along a curve using their arc-length positions
/**
 * Order holes along a principal curve
 * @param {Array} clusterHoles - Holes belonging to a cluster
 * @param {Object} principalCurve - Fitted principal curve
 * @returns {Array} - Ordered array of hole indices
 */
export function orderHolesAlongCurve(clusterHoles, principalCurve) {
	var projections = projectHolesOntoCurve(clusterHoles, principalCurve);

	// Sort by arc length
	projections.sort(function(a, b) { return a.arcLength - b.arcLength; });

	return projections.map(function(p) { return p.holeIndex; });
}
