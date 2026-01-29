// src/helpers/RowDetection/PatternClassifier.js
//=============================================================
// PATTERN TYPE CLASSIFICATION
//=============================================================
// Step 0) Classify blast patterns as STRAIGHT, CURVED, or MULTI_PATTERN
// This determines which row detection algorithm to use

import { calculateDistanceXY, estimateRowDirection, normalizeAngle } from "./MathUtilities.js";

// Pattern type constants
export var PATTERN_TYPES = {
	STRAIGHT: "STRAIGHT",
	CURVED: "CURVED",
	MULTI_PATTERN: "MULTI_PATTERN"
};

// Classification thresholds
var CLASSIFICATION_THRESHOLDS = {
	varianceRatioHigh: 5.0,      // Above this = likely straight
	varianceRatioLow: 3.0,       // Below this = likely curved
	curvatureLow: 0.1,           // Below this = low curvature (straight)
	curvatureHigh: 0.3,          // Above this = high curvature (curved)
	orientationTolerance: 15     // Degrees - clusters within this are same orientation
};

// Step 1) Main pattern classification function
/**
 * Classify the pattern type of a blast hole set
 * @param {Array} holesData - Array of hole objects with startXLocation, startYLocation
 * @returns {Object} - { type: 'STRAIGHT'|'CURVED'|'MULTI_PATTERN', subPatterns: [], isSerpentineCandidate: boolean, confidence: number }
 */
export function classifyPatternType(holesData) {
	if (!holesData || holesData.length < 3) {
		return {
			type: PATTERN_TYPES.STRAIGHT,
			subPatterns: [],
			isSerpentineCandidate: false,
			confidence: 0
		};
	}

	console.log("Classifying pattern type for " + holesData.length + " holes");

	// Step 1a) Calculate global curvature using PCA
	var pcaResult = calculatePCAMetrics(holesData);
	console.log("PCA variance ratio:", pcaResult.varianceRatio);

	// Step 1b) Calculate local curvature
	var curvatureResult = calculateLocalCurvature(holesData);
	console.log("Average curvature:", curvatureResult.avgCurvature);

	// Step 1c) Cluster by local orientation
	var orientationClusters = clusterByOrientation(holesData);
	console.log("Orientation clusters found:", orientationClusters.length);

	// Step 1d) Determine pattern type
	var patternType = PATTERN_TYPES.STRAIGHT;
	var confidence = 0;

	// Check for multi-pattern (multiple distinct orientations)
	if (orientationClusters.length > 1) {
		patternType = PATTERN_TYPES.MULTI_PATTERN;
		confidence = orientationClusters.length / 3; // More clusters = higher confidence
	}
	// Check for curved pattern
	else if (pcaResult.varianceRatio < CLASSIFICATION_THRESHOLDS.varianceRatioLow ||
		curvatureResult.avgCurvature > CLASSIFICATION_THRESHOLDS.curvatureHigh) {
		patternType = PATTERN_TYPES.CURVED;
		confidence = Math.min(1, curvatureResult.avgCurvature / CLASSIFICATION_THRESHOLDS.curvatureHigh);
	}
	// Straight pattern
	else if (pcaResult.varianceRatio > CLASSIFICATION_THRESHOLDS.varianceRatioHigh &&
		curvatureResult.avgCurvature < CLASSIFICATION_THRESHOLDS.curvatureLow) {
		patternType = PATTERN_TYPES.STRAIGHT;
		confidence = Math.min(1, pcaResult.varianceRatio / 10);
	}
	// Ambiguous - default to straight with lower confidence
	else {
		patternType = PATTERN_TYPES.STRAIGHT;
		confidence = 0.5;
	}

	// Step 1e) Check for serpentine candidate based on hole ID sequence
	var isSerpentineCandidate = checkSerpentineCandidate(holesData);

	return {
		type: patternType,
		subPatterns: orientationClusters.length > 1 ? orientationClusters : [],
		isSerpentineCandidate: isSerpentineCandidate,
		confidence: Math.min(1, confidence),
		metrics: {
			varianceRatio: pcaResult.varianceRatio,
			avgCurvature: curvatureResult.avgCurvature,
			orientationClusterCount: orientationClusters.length
		}
	};
}

// Step 2) Calculate PCA metrics for pattern analysis
function calculatePCAMetrics(holesData) {
	var n = holesData.length;
	if (n < 2) return { varianceRatio: Infinity, eigenvalue1: 0, eigenvalue2: 0 };

	// Calculate mean
	var sumX = 0, sumY = 0;
	for (var i = 0; i < n; i++) {
		sumX += holesData[i].startXLocation;
		sumY += holesData[i].startYLocation;
	}
	var meanX = sumX / n;
	var meanY = sumY / n;

	// Calculate covariance matrix elements
	var covarXX = 0, covarXY = 0, covarYY = 0;
	for (var j = 0; j < n; j++) {
		var dx = holesData[j].startXLocation - meanX;
		var dy = holesData[j].startYLocation - meanY;
		covarXX += dx * dx;
		covarXY += dx * dy;
		covarYY += dy * dy;
	}
	covarXX /= (n - 1);
	covarXY /= (n - 1);
	covarYY /= (n - 1);

	// Calculate eigenvalues of 2x2 covariance matrix
	var trace = covarXX + covarYY;
	var det = covarXX * covarYY - covarXY * covarXY;
	var discriminant = Math.sqrt(Math.max(0, trace * trace - 4 * det));

	var eigenvalue1 = (trace + discriminant) / 2;
	var eigenvalue2 = (trace - discriminant) / 2;

	// Variance ratio (high = linear, low = circular/irregular)
	var varianceRatio = eigenvalue2 > 0.001 ? eigenvalue1 / eigenvalue2 : Infinity;

	return {
		varianceRatio: varianceRatio,
		eigenvalue1: eigenvalue1,
		eigenvalue2: eigenvalue2,
		meanX: meanX,
		meanY: meanY
	};
}

// Step 3) Calculate local curvature for each point
function calculateLocalCurvature(holesData) {
	var n = holesData.length;
	if (n < 5) return { avgCurvature: 0, curvatures: [] };

	var k = Math.min(5, Math.floor(n / 3)); // k nearest neighbors
	var curvatures = [];

	for (var i = 0; i < n; i++) {
		var neighbors = findKNearestNeighbors(holesData, i, k);
		if (neighbors.length < 3) {
			curvatures.push(0);
			continue;
		}

		// Fit a curve through neighbors and measure curvature
		var curvature = estimateLocalCurvature(holesData, i, neighbors);
		curvatures.push(curvature);
	}

	// Calculate average curvature
	var sum = 0;
	for (var c = 0; c < curvatures.length; c++) {
		sum += curvatures[c];
	}
	var avgCurvature = sum / curvatures.length;

	return {
		avgCurvature: avgCurvature,
		curvatures: curvatures
	};
}

// Step 4) Find k nearest neighbors for a point
function findKNearestNeighbors(holesData, pointIndex, k) {
	var distances = [];
	var point = holesData[pointIndex];

	for (var i = 0; i < holesData.length; i++) {
		if (i === pointIndex) continue;
		var dist = calculateDistanceXY(
			point.startXLocation, point.startYLocation,
			holesData[i].startXLocation, holesData[i].startYLocation
		);
		distances.push({ index: i, dist: dist });
	}

	distances.sort(function(a, b) { return a.dist - b.dist; });
	return distances.slice(0, k).map(function(d) { return d.index; });
}

// Step 5) Estimate local curvature using Menger curvature
function estimateLocalCurvature(holesData, centerIndex, neighborIndices) {
	// Use Menger curvature: curvature = 4 * area / (|AB| * |BC| * |CA|)
	// where area is the triangle formed by three points

	var center = holesData[centerIndex];
	var neighbors = neighborIndices.map(function(i) { return holesData[i]; });

	if (neighbors.length < 2) return 0;

	// Find two neighbors that form the widest angle (most representative)
	var bestCurvature = 0;
	var count = 0;

	for (var i = 0; i < neighbors.length - 1; i++) {
		for (var j = i + 1; j < neighbors.length; j++) {
			var A = neighbors[i];
			var B = center;
			var C = neighbors[j];

			// Calculate side lengths
			var AB = calculateDistanceXY(A.startXLocation, A.startYLocation, B.startXLocation, B.startYLocation);
			var BC = calculateDistanceXY(B.startXLocation, B.startYLocation, C.startXLocation, C.startYLocation);
			var CA = calculateDistanceXY(C.startXLocation, C.startYLocation, A.startXLocation, A.startYLocation);

			// Calculate area using cross product
			var area = Math.abs(
				(B.startXLocation - A.startXLocation) * (C.startYLocation - A.startYLocation) -
				(C.startXLocation - A.startXLocation) * (B.startYLocation - A.startYLocation)
			) / 2;

			// Menger curvature
			var denom = AB * BC * CA;
			if (denom > 0.001) {
				var curvature = 4 * area / denom;
				bestCurvature += curvature;
				count++;
			}
		}
	}

	return count > 0 ? bestCurvature / count : 0;
}

// Step 6) Cluster holes by local orientation
function clusterByOrientation(holesData) {
	var n = holesData.length;
	if (n < 3) return [{ indices: holesData.map(function(_, i) { return i; }), orientation: 0 }];

	// Calculate local orientation for each hole
	var orientations = [];
	for (var i = 0; i < n; i++) {
		var neighbors = findKNearestNeighbors(holesData, i, Math.min(5, n - 1));
		if (neighbors.length === 0) {
			orientations.push(0);
			continue;
		}

		// Calculate bearing to centroid of neighbors
		var centroidX = 0, centroidY = 0;
		for (var j = 0; j < neighbors.length; j++) {
			centroidX += holesData[neighbors[j]].startXLocation;
			centroidY += holesData[neighbors[j]].startYLocation;
		}
		centroidX /= neighbors.length;
		centroidY /= neighbors.length;

		var dx = centroidX - holesData[i].startXLocation;
		var dy = centroidY - holesData[i].startYLocation;
		var bearing = Math.atan2(dx, dy) * 180 / Math.PI;
		orientations.push(normalizeAngle(bearing));
	}

	// Cluster orientations using circular statistics
	var clusters = clusterCircularValues(orientations, CLASSIFICATION_THRESHOLDS.orientationTolerance);

	// Convert to hole indices
	var result = [];
	for (var c = 0; c < clusters.length; c++) {
		var cluster = clusters[c];
		var indices = [];
		for (var k = 0; k < cluster.members.length; k++) {
			indices.push(cluster.members[k]);
		}
		result.push({
			indices: indices,
			orientation: cluster.mean
		});
	}

	return result;
}

// Step 7) Cluster circular values (angles) with given tolerance
function clusterCircularValues(values, tolerance) {
	if (values.length === 0) return [];

	var assigned = new Array(values.length).fill(false);
	var clusters = [];

	for (var i = 0; i < values.length; i++) {
		if (assigned[i]) continue;

		var cluster = { members: [i], mean: values[i] };
		assigned[i] = true;

		// Find all values within tolerance
		for (var j = i + 1; j < values.length; j++) {
			if (assigned[j]) continue;

			var diff = Math.abs(values[j] - cluster.mean);
			if (diff > 180) diff = 360 - diff;

			if (diff <= tolerance) {
				cluster.members.push(j);
				assigned[j] = true;
				// Update circular mean
				cluster.mean = circularMean(cluster.members.map(function(m) { return values[m]; }));
			}
		}

		clusters.push(cluster);
	}

	return clusters;
}

// Step 8) Calculate circular mean of angles
function circularMean(angles) {
	var sinSum = 0, cosSum = 0;
	for (var i = 0; i < angles.length; i++) {
		var rad = angles[i] * Math.PI / 180;
		sinSum += Math.sin(rad);
		cosSum += Math.cos(rad);
	}
	return normalizeAngle(Math.atan2(sinSum, cosSum) * 180 / Math.PI);
}

// Step 9) Check if pattern is a serpentine candidate
function checkSerpentineCandidate(holesData) {
	// Check if hole IDs suggest sequential numbering that could be serpentine
	var numericCount = 0;
	var hasSequentialPattern = false;

	for (var i = 0; i < holesData.length; i++) {
		if (/^\d+$/.test(holesData[i].holeID)) {
			numericCount++;
		}
	}

	// If most holes have numeric IDs, check for sequential pattern
	if (numericCount > holesData.length * 0.7) {
		var sortedHoles = holesData.slice().sort(function(a, b) {
			return parseInt(a.holeID) - parseInt(b.holeID);
		});

		// Check if sequential numbers correspond to spatial proximity
		// that would suggest serpentine ordering
		var directionChanges = 0;
		var prevDx = 0;

		for (var j = 1; j < sortedHoles.length; j++) {
			var dx = sortedHoles[j].startXLocation - sortedHoles[j - 1].startXLocation;
			if (j > 1 && prevDx * dx < 0) {
				directionChanges++;
			}
			prevDx = dx;
		}

		// If direction changes frequently, likely serpentine
		hasSequentialPattern = directionChanges > sortedHoles.length / 10;
	}

	return hasSequentialPattern;
}

// Step 10) Separate holes into sub-patterns based on orientation
/**
 * Separate distinct pattern groups (main rows, batter rows, buffer rows)
 * @param {Array} holesData - Array of hole objects
 * @returns {Array} - subPatterns[] where each has { holes: [], type: 'MAIN'|'BATTER'|'BUFFER', orientation: number }
 */
export function separateSubPatterns(holesData) {
	if (!holesData || holesData.length < 3) {
		return [{
			holes: holesData,
			type: "MAIN",
			orientation: 0,
			indices: holesData ? holesData.map(function(_, i) { return i; }) : []
		}];
	}

	// Step 10a) Get orientation clusters
	var orientationClusters = clusterByOrientation(holesData);

	if (orientationClusters.length <= 1) {
		return [{
			holes: holesData,
			type: "MAIN",
			orientation: orientationClusters.length > 0 ? orientationClusters[0].orientation : 0,
			indices: holesData.map(function(_, i) { return i; })
		}];
	}

	// Step 10b) Refine by spatial connectivity within each orientation cluster
	var subPatterns = [];

	for (var c = 0; c < orientationClusters.length; c++) {
		var cluster = orientationClusters[c];
		var clusterHoles = cluster.indices.map(function(i) { return holesData[i]; });

		// Check spatial connectivity
		var connectedGroups = findSpatiallyConnectedGroups(clusterHoles, cluster.indices);

		for (var g = 0; g < connectedGroups.length; g++) {
			subPatterns.push({
				holes: connectedGroups[g].holes,
				type: "UNKNOWN",
				orientation: cluster.orientation,
				indices: connectedGroups[g].indices
			});
		}
	}

	// Step 10c) Classify sub-patterns
	// Largest cluster = MAIN, smaller perpendicular clusters = BATTER or BUFFER
	subPatterns.sort(function(a, b) { return b.holes.length - a.holes.length; });

	if (subPatterns.length > 0) {
		subPatterns[0].type = "MAIN";
		var mainOrientation = subPatterns[0].orientation;

		for (var p = 1; p < subPatterns.length; p++) {
			var orientationDiff = Math.abs(subPatterns[p].orientation - mainOrientation);
			if (orientationDiff > 180) orientationDiff = 360 - orientationDiff;

			// Perpendicular (60-120 degrees difference)
			if (orientationDiff > 60 && orientationDiff < 120) {
				subPatterns[p].type = "BATTER";
			} else {
				subPatterns[p].type = "BUFFER";
			}
		}
	}

	return subPatterns;
}

// Step 11) Find spatially connected groups within a set of holes
function findSpatiallyConnectedGroups(holes, originalIndices) {
	if (holes.length === 0) return [];

	// Estimate connection distance (average spacing * 2)
	var avgSpacing = estimateAverageSpacing(holes);
	var connectionThreshold = avgSpacing * 2;

	var visited = new Array(holes.length).fill(false);
	var groups = [];

	for (var start = 0; start < holes.length; start++) {
		if (visited[start]) continue;

		var group = { holes: [], indices: [] };
		var stack = [start];

		while (stack.length > 0) {
			var current = stack.pop();
			if (visited[current]) continue;
			visited[current] = true;
			group.holes.push(holes[current]);
			group.indices.push(originalIndices[current]);

			// Find connected neighbors
			for (var j = 0; j < holes.length; j++) {
				if (visited[j]) continue;
				var dist = calculateDistanceXY(
					holes[current].startXLocation, holes[current].startYLocation,
					holes[j].startXLocation, holes[j].startYLocation
				);
				if (dist < connectionThreshold) {
					stack.push(j);
				}
			}
		}

		groups.push(group);
	}

	return groups;
}

// Step 12) Estimate average spacing from sample of holes
function estimateAverageSpacing(holes) {
	if (holes.length < 2) return 3.0; // Default

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
		if (minDist < Infinity) {
			distances.push(minDist);
		}
	}

	if (distances.length === 0) return 3.0;

	// Return median
	distances.sort(function(a, b) { return a - b; });
	return distances[Math.floor(distances.length / 2)];
}
