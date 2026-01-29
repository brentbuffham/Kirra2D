// src/helpers/RowDetection/SerpentineDetection.js
//=============================================================
// SERPENTINE PATTERN DETECTION
//=============================================================
// Step 0) Detect if position ordering follows serpentine pattern (alternating direction)
// and apply serpentine ordering to detected rows

import { calculateDistanceXY, normalizeAngle } from "./MathUtilities.js";

// Pattern direction constants
export var DIRECTION_TYPES = {
	FORWARD: "FORWARD",      // All rows same direction (return-style)
	SERPENTINE: "SERPENTINE" // Alternating direction each row (boustrophedon)
};

// Step 1) Detect if row pattern is serpentine based on endpoint analysis
/**
 * Detect if position ordering follows serpentine pattern
 * @param {Array} holesData - Array of hole objects
 * @param {Array} detectedRows - Array of row arrays, each containing hole indices
 * @returns {Object} - { pattern: 'FORWARD'|'SERPENTINE', directions: [], confidence: number }
 */
export function detectSerpentinePattern(holesData, detectedRows) {
	if (!detectedRows || detectedRows.length < 2) {
		return {
			pattern: DIRECTION_TYPES.FORWARD,
			directions: [],
			confidence: 0
		};
	}

	console.log("Analyzing serpentine pattern for " + detectedRows.length + " rows");

	var rowDirections = [];

	// Step 1a) For each pair of adjacent rows, check direction relationship
	for (var i = 0; i < detectedRows.length - 1; i++) {
		var row1 = detectedRows[i];
		var row2 = detectedRows[i + 1];

		if (row1.length === 0 || row2.length === 0) continue;

		// Step 1b) Get endpoint positions
		var row1Start = holesData[row1[0]];
		var row1End = holesData[row1[row1.length - 1]];
		var row2Start = holesData[row2[0]];
		var row2End = holesData[row2[row2.length - 1]];

		// Step 1c) Determine direction relationship
		// In serpentine pattern, row1.end should be closer to row2.start than row1.start is
		var distEndToStart = calculateDistanceXY(
			row1End.startXLocation, row1End.startYLocation,
			row2Start.startXLocation, row2Start.startYLocation
		);
		var distStartToStart = calculateDistanceXY(
			row1Start.startXLocation, row1Start.startYLocation,
			row2Start.startXLocation, row2Start.startYLocation
		);

		// Also check end-to-end for serpentine verification
		var distEndToEnd = calculateDistanceXY(
			row1End.startXLocation, row1End.startYLocation,
			row2End.startXLocation, row2End.startYLocation
		);

		var isSerpentine = distEndToStart < distStartToStart;
		var confidence = Math.abs(distEndToStart - distStartToStart) /
			Math.max(distEndToStart, distStartToStart, 0.001);

		rowDirections.push({
			rowIndex: i,
			isSerpentine: isSerpentine,
			confidence: Math.min(1, confidence),
			distEndToStart: distEndToStart,
			distStartToStart: distStartToStart
		});
	}

	// Step 1d) Determine overall pattern
	var serpentineCount = rowDirections.filter(function(d) { return d.isSerpentine; }).length;
	var totalPairs = rowDirections.length;

	// Calculate average confidence
	var avgConfidence = 0;
	if (totalPairs > 0) {
		for (var c = 0; c < rowDirections.length; c++) {
			avgConfidence += rowDirections[c].confidence;
		}
		avgConfidence /= totalPairs;
	}

	// Serpentine if majority of row pairs show serpentine pattern
	var pattern = serpentineCount > totalPairs / 2 ? DIRECTION_TYPES.SERPENTINE : DIRECTION_TYPES.FORWARD;

	return {
		pattern: pattern,
		directions: rowDirections,
		confidence: Math.min(1, avgConfidence * (serpentineCount / Math.max(1, totalPairs)))
	};
}

// Step 2) Apply serpentine ordering to detected rows
/**
 * Reorder positions within rows to follow serpentine pattern
 * @param {Array} holesData - Array of hole objects
 * @param {Array} detectedRows - Array of row arrays
 * @param {string} direction - 'FORWARD' or 'SERPENTINE'
 * @returns {Array} - Reordered rows with correct position IDs
 */
export function applySerpentineOrdering(holesData, detectedRows, direction) {
	if (!detectedRows || detectedRows.length === 0) {
		return detectedRows;
	}

	console.log("Applying " + direction + " ordering to " + detectedRows.length + " rows");

	var reorderedRows = [];

	for (var r = 0; r < detectedRows.length; r++) {
		var row = detectedRows[r].slice(); // Copy
		var isReversed = (direction === DIRECTION_TYPES.SERPENTINE) && (r % 2 === 1);

		if (isReversed) {
			row.reverse();
		}

		// Update posID for each hole
		for (var p = 0; p < row.length; p++) {
			holesData[row[p]].posID = p + 1;
		}

		reorderedRows.push(row);
	}

	return reorderedRows;
}

// Step 3) Detect serpentine pattern from hole ID sequence
/**
 * Analyze hole ID sequence to detect serpentine pattern
 * @param {Array} holesData - Array of hole objects sorted by holeID
 * @returns {Object} - { isSerpentine: boolean, rowBreaks: [], confidence: number }
 */
export function detectSerpentineFromSequence(holesData) {
	if (!holesData || holesData.length < 4) {
		return { isSerpentine: false, rowBreaks: [], confidence: 0 };
	}

	// Step 3a) Sort by numeric ID
	var sortedHoles = holesData.slice().filter(function(h) {
		return /^\d+$/.test(h.holeID);
	}).sort(function(a, b) {
		return parseInt(a.holeID) - parseInt(b.holeID);
	});

	if (sortedHoles.length < 4) {
		return { isSerpentine: false, rowBreaks: [], confidence: 0 };
	}

	// Step 3b) Calculate direction (bearing) between consecutive holes
	var directions = [];
	for (var i = 1; i < sortedHoles.length; i++) {
		var dx = sortedHoles[i].startXLocation - sortedHoles[i - 1].startXLocation;
		var dy = sortedHoles[i].startYLocation - sortedHoles[i - 1].startYLocation;
		var bearing = normalizeAngle(Math.atan2(dx, dy) * 180 / Math.PI);
		directions.push({
			index: i - 1,
			bearing: bearing,
			distance: Math.sqrt(dx * dx + dy * dy)
		});
	}

	// Step 3c) Find direction reversals (>150 degree change)
	var reversals = [];
	for (var j = 1; j < directions.length; j++) {
		var bearingChange = Math.abs(directions[j].bearing - directions[j - 1].bearing);
		if (bearingChange > 180) bearingChange = 360 - bearingChange;

		if (bearingChange > 150) {
			reversals.push({
				index: j,
				bearingChange: bearingChange
			});
		}
	}

	// Step 3d) Check if reversals occur at regular intervals (suggesting serpentine)
	if (reversals.length < 2) {
		return {
			isSerpentine: reversals.length === 1,
			rowBreaks: reversals.map(function(r) { return r.index; }),
			confidence: reversals.length > 0 ? 0.5 : 0
		};
	}

	// Calculate interval variance
	var intervals = [];
	for (var k = 1; k < reversals.length; k++) {
		intervals.push(reversals[k].index - reversals[k - 1].index);
	}

	var avgInterval = 0;
	for (var m = 0; m < intervals.length; m++) {
		avgInterval += intervals[m];
	}
	avgInterval /= intervals.length;

	var variance = 0;
	for (var n = 0; n < intervals.length; n++) {
		var diff = intervals[n] - avgInterval;
		variance += diff * diff;
	}
	variance /= intervals.length;

	// Low variance = regular serpentine pattern
	var coefficientOfVariation = Math.sqrt(variance) / avgInterval;
	var confidence = Math.max(0, 1 - coefficientOfVariation);

	return {
		isSerpentine: confidence > 0.5,
		rowBreaks: reversals.map(function(r) { return r.index; }),
		confidence: confidence,
		avgHolesPerRow: avgInterval
	};
}

// Step 4) KNN graph with bearing-based traversal for serpentine detection
/**
 * Build KNN graph and traverse using bearing continuity
 * @param {Array} holesData - Array of hole objects
 * @param {number} k - Number of nearest neighbors
 * @returns {Object} - { rows: [], isSerpentine: boolean }
 */
export function detectRowsUsingKNNBearingTraversal(holesData, k) {
	if (!holesData || holesData.length < 3) {
		return { rows: [], isSerpentine: false };
	}

	k = k || Math.min(6, Math.floor(holesData.length / 5));
	console.log("Building KNN graph with k=" + k);

	// Step 4a) Build KNN graph
	var graph = buildKNNGraph(holesData, k);

	// Step 4b) Find endpoints (degree 1-2 nodes at edges)
	var endpoints = findGraphEndpoints(graph, holesData);

	if (endpoints.length === 0) {
		// No clear endpoints - use extremes
		endpoints = findExtremePoints(holesData);
	}

	// Step 4c) Trace rows from endpoints using bearing continuity
	var visited = new Array(holesData.length).fill(false);
	var rows = [];

	for (var e = 0; e < endpoints.length; e++) {
		if (visited[endpoints[e]]) continue;

		var row = traceRowWithBearingContinuity(endpoints[e], graph, holesData, visited, 30);

		if (row.length >= 2) {
			rows.push(row);
		}
	}

	// Step 4d) Detect serpentine from traced rows
	var serpentineResult = detectSerpentinePattern(holesData, rows);

	return {
		rows: rows,
		isSerpentine: serpentineResult.pattern === DIRECTION_TYPES.SERPENTINE,
		serpentineConfidence: serpentineResult.confidence
	};
}

// Step 5) Build KNN graph
function buildKNNGraph(holesData, k) {
	var n = holesData.length;
	var graph = [];

	for (var i = 0; i < n; i++) {
		// Calculate distances to all other points
		var distances = [];
		for (var j = 0; j < n; j++) {
			if (i === j) continue;
			var dist = calculateDistanceXY(
				holesData[i].startXLocation, holesData[i].startYLocation,
				holesData[j].startXLocation, holesData[j].startYLocation
			);
			distances.push({ index: j, dist: dist });
		}

		// Sort by distance and take k nearest
		distances.sort(function(a, b) { return a.dist - b.dist; });
		var neighbors = distances.slice(0, k);

		graph.push({
			index: i,
			neighbors: neighbors
		});
	}

	return graph;
}

// Step 6) Find endpoints in graph (low degree nodes)
function findGraphEndpoints(graph, holesData) {
	var endpoints = [];

	// Build adjacency count (undirected)
	var degrees = new Array(graph.length).fill(0);
	var connections = [];
	for (var i = 0; i < graph.length; i++) {
		connections.push(new Set());
	}

	for (var g = 0; g < graph.length; g++) {
		for (var n = 0; n < graph[g].neighbors.length; n++) {
			var neighbor = graph[g].neighbors[n].index;
			connections[g].add(neighbor);
			connections[neighbor].add(g);
		}
	}

	for (var d = 0; d < connections.length; d++) {
		degrees[d] = connections[d].size;
	}

	// Find nodes with low degree (endpoints)
	for (var e = 0; e < degrees.length; e++) {
		if (degrees[e] <= 2) {
			endpoints.push(e);
		}
	}

	// If too few endpoints, use spatial extremes
	if (endpoints.length < 2) {
		return findExtremePoints(holesData);
	}

	return endpoints;
}

// Step 7) Find extreme points (corners of bounding box)
function findExtremePoints(holesData) {
	var minX = Infinity, maxX = -Infinity;
	var minY = Infinity, maxY = -Infinity;
	var minXIdx = 0, maxXIdx = 0, minYIdx = 0, maxYIdx = 0;

	for (var i = 0; i < holesData.length; i++) {
		var x = holesData[i].startXLocation;
		var y = holesData[i].startYLocation;
		if (x < minX) { minX = x; minXIdx = i; }
		if (x > maxX) { maxX = x; maxXIdx = i; }
		if (y < minY) { minY = y; minYIdx = i; }
		if (y > maxY) { maxY = y; maxYIdx = i; }
	}

	var extremes = [minXIdx, maxXIdx, minYIdx, maxYIdx];
	// Remove duplicates
	var unique = [];
	for (var j = 0; j < extremes.length; j++) {
		if (unique.indexOf(extremes[j]) === -1) {
			unique.push(extremes[j]);
		}
	}

	return unique;
}

// Step 8) Trace row with bearing continuity
function traceRowWithBearingContinuity(startIndex, graph, holesData, visited, maxBearingChange) {
	maxBearingChange = maxBearingChange || 30; // degrees - allows gentle curves

	var path = [startIndex];
	visited[startIndex] = true;

	var current = startIndex;
	var prevBearing = null;

	while (true) {
		var node = graph[current];
		var bestNeighbor = null;
		var bestScore = -Infinity;

		for (var n = 0; n < node.neighbors.length; n++) {
			var neighbor = node.neighbors[n];
			if (visited[neighbor.index]) continue;

			// Calculate bearing to neighbor
			var currentHole = holesData[current];
			var neighborHole = holesData[neighbor.index];

			var dx = neighborHole.startXLocation - currentHole.startXLocation;
			var dy = neighborHole.startYLocation - currentHole.startYLocation;
			var bearing = normalizeAngle(Math.atan2(dx, dy) * 180 / Math.PI);

			var score = 1 / neighbor.dist; // Prefer closer neighbors

			if (prevBearing !== null) {
				var bearingDiff = Math.abs(bearing - prevBearing);
				if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;

				// Check for direction reversal (serpentine turn)
				if (bearingDiff > 150) {
					// This is a row break, not a continuation
					continue;
				}

				if (bearingDiff > maxBearingChange) {
					// Too sharp a turn
					score *= 0.1;
				} else {
					// Bonus for bearing continuity
					score *= (1 + (maxBearingChange - bearingDiff) / maxBearingChange);
				}
			}

			if (score > bestScore) {
				bestScore = score;
				bestNeighbor = neighbor;
			}
		}

		if (!bestNeighbor) break;

		// Calculate bearing for next iteration
		var currentHole2 = holesData[current];
		var nextHole = holesData[bestNeighbor.index];
		var dx2 = nextHole.startXLocation - currentHole2.startXLocation;
		var dy2 = nextHole.startYLocation - currentHole2.startYLocation;
		prevBearing = normalizeAngle(Math.atan2(dx2, dy2) * 180 / Math.PI);

		visited[bestNeighbor.index] = true;
		path.push(bestNeighbor.index);
		current = bestNeighbor.index;
	}

	return path;
}

// Step 9) Assign position IDs respecting serpentine pattern
/**
 * Assign posID values respecting detected direction pattern
 * @param {Array} holesData - Array of hole objects
 * @param {Array} rows - Array of row arrays
 * @param {string} pattern - 'FORWARD' or 'SERPENTINE'
 * @param {number} startingPosID - Starting position ID (usually 1)
 */
export function assignSerpentinePositionIDs(holesData, rows, pattern, startingPosID) {
	startingPosID = startingPosID || 1;

	var globalPosID = startingPosID;

	for (var r = 0; r < rows.length; r++) {
		var row = rows[r];
		var isReversed = (pattern === DIRECTION_TYPES.SERPENTINE) && (r % 2 === 1);

		if (isReversed) {
			// Assign in reverse order
			for (var p = row.length - 1; p >= 0; p--) {
				holesData[row[p]].posID = globalPosID++;
			}
		} else {
			// Assign in forward order
			for (var q = 0; q < row.length; q++) {
				holesData[row[q]].posID = globalPosID++;
			}
		}
	}
}

// Step 10) Detect rows for winding/curved patterns using sequence-based direction analysis
/**
 * Detects rows for winding patterns where holes are numbered sequentially
 * and the path curves back on itself. Uses sliding window direction comparison
 * to detect when path has "curved back" (S-curve patterns).
 *
 * Key insight: Winding patterns follow hole ID sequence but spatially wind back.
 * Holes spatially close may be on different "passes" of the winding path.
 * For gradual S-curves, we compare direction over a window, not just consecutive holes.
 *
 * @param {Array} holesData - Array of hole objects
 * @param {string} entityName - Entity name for row assignment
 * @param {Object} options - Optional settings
 * @param {number} options.windowSize - Holes to look back for direction comparison (default: 4)
 * @param {number} options.reversalThreshold - Bearing change to consider a reversal (default: 90°)
 * @param {number} options.minHolesPerRow - Minimum holes to form a row (default: 3)
 * @returns {Object|null} - { success, rows, method } or null if not applicable
 */
export function detectRowsUsingWindingSequence(holesData, entityName, options) {
	options = options || {};
	var windowSize = options.windowSize || 4; // Look back 4 holes for direction comparison
	// Use global snakeRowAngle setting if available, otherwise default to 90
	var defaultThreshold = (typeof window !== "undefined" && window.snakeRowAngle) ? window.snakeRowAngle : 90;
	var reversalThreshold = options.reversalThreshold || defaultThreshold; // degrees - path has "turned around"
	var minHolesPerRow = options.minHolesPerRow || 3;

	console.log("Winding detection using threshold: " + reversalThreshold + "°");

	if (!holesData || holesData.length < 6) {
		return null; // Need at least 6 holes for winding pattern
	}

	// Step 10a) Check if holes have sequential numeric IDs
	var holeIDMap = [];
	var hasSequentialIDs = true;

	for (var i = 0; i < holesData.length; i++) {
		var id = holesData[i].holeID || holesData[i].id || "";
		var numericPart = String(id).replace(/[^0-9]/g, "");
		if (numericPart.length === 0) {
			hasSequentialIDs = false;
			break;
		}
		holeIDMap.push({
			index: i,
			numericID: parseInt(numericPart, 10),
			hole: holesData[i]
		});
	}

	if (!hasSequentialIDs) {
		console.log("Winding detection: Holes don't have numeric IDs");
		return null;
	}

	// Step 10b) Sort by numeric ID
	holeIDMap.sort(function(a, b) {
		return a.numericID - b.numericID;
	});

	// Step 10c) Check if IDs are mostly sequential (allow small gaps)
	var totalGap = 0;
	for (var j = 1; j < holeIDMap.length; j++) {
		var gap = holeIDMap[j].numericID - holeIDMap[j - 1].numericID;
		if (gap > 5) {
			// Large gap - might be multiple entities mixed
			console.log("Winding detection: Large gap in hole IDs at " + holeIDMap[j - 1].numericID);
			return null;
		}
		totalGap += gap - 1;
	}

	// Step 10d) Calculate bearing and distance from each hole to the next (in sequence order)
	var bearings = [];
	var distances = [];
	for (var k = 1; k < holeIDMap.length; k++) {
		var h1 = holeIDMap[k - 1].hole;
		var h2 = holeIDMap[k].hole;
		var dx = h2.startXLocation - h1.startXLocation;
		var dy = h2.startYLocation - h1.startYLocation;
		var bearing = normalizeAngle(Math.atan2(dx, dy) * 180 / Math.PI);
		var distance = Math.sqrt(dx * dx + dy * dy);
		distances.push(distance);
		bearings.push({
			fromIndex: k - 1,
			toIndex: k,
			bearing: bearing,
			distance: distance
		});
	}

	// Step 10d2) Check for distance consistency - reject if large jumps exist
	// Large jumps indicate traditional serpentine (row-to-row return carriage), not winding
	if (distances.length > 2) {
		distances.sort(function(a, b) { return a - b; });
		var medianDist = distances[Math.floor(distances.length / 2)];
		var maxAllowedJump = medianDist * 3; // Allow up to 3x median spacing

		// Check for any large jumps
		var hasLargeJump = bearings.some(function(b) {
			return b.distance > maxAllowedJump;
		});

		if (hasLargeJump) {
			console.log("Winding detection: Large distance jump detected (>" + maxAllowedJump.toFixed(1) + "m) - not a winding pattern");
			console.log("Winding detection: Median spacing=" + medianDist.toFixed(1) + "m, likely traditional serpentine");
			return null;
		}
	}

	// Step 10e) Find direction reversals using sliding window comparison
	// Compare current bearing with bearing from 'windowSize' holes back
	// When they differ by >90°, the path has curved back (row break)
	var rowBreaks = [0]; // First row starts at index 0
	var lastBreakIndex = 0;

	// Track the "entry direction" of the current row segment
	var rowEntryBearing = bearings.length > 0 ? bearings[0].bearing : 0;

	for (var m = windowSize; m < bearings.length; m++) {
		// Compare current bearing with bearing from windowSize steps back
		var currentBearing = bearings[m].bearing;
		var pastBearing = bearings[m - windowSize].bearing;

		var windowBearingChange = Math.abs(currentBearing - pastBearing);
		if (windowBearingChange > 180) windowBearingChange = 360 - windowBearingChange;

		// Also compare with the row entry direction (overall path reversal)
		var entryBearingChange = Math.abs(currentBearing - rowEntryBearing);
		if (entryBearingChange > 180) entryBearingChange = 360 - entryBearingChange;

		// Reversal detected if:
		// 1. Direction changed significantly from windowSize holes back (gradual curve completed)
		// 2. AND we've moved enough holes since last break (min row size)
		var holesSinceLastBreak = m - lastBreakIndex;

		if ((windowBearingChange > reversalThreshold || entryBearingChange > reversalThreshold) &&
			holesSinceLastBreak >= minHolesPerRow) {

			// Found reversal - row break at position m (this hole starts new row)
			rowBreaks.push(m);
			lastBreakIndex = m;
			rowEntryBearing = currentBearing; // Reset entry direction for new row

			console.log("Winding: Row break at hole " + holeIDMap[m].numericID +
				" (window change: " + windowBearingChange.toFixed(1) + "°" +
				", entry change: " + entryBearingChange.toFixed(1) + "°)");
		}
	}

	// Step 10f) Check if we found valid winding pattern
	if (rowBreaks.length < 2) {
		console.log("Winding detection: No direction reversals found (not a winding pattern)");
		return null;
	}

	// Step 10g) Validate row sizes and add end marker
	rowBreaks.push(holeIDMap.length); // End marker

	// Check if any row is too small (except possibly first/last)
	var rowSizes = [];
	for (var v = 1; v < rowBreaks.length; v++) {
		var rowSize = rowBreaks[v] - rowBreaks[v - 1];
		rowSizes.push(rowSize);
	}
	console.log("Winding detection: Row sizes = " + rowSizes.join(", "));

	// If too many very small rows, this might not be a winding pattern
	var smallRowCount = rowSizes.filter(function(s) { return s < minHolesPerRow; }).length;
	if (smallRowCount > rowSizes.length / 2) {
		console.log("Winding detection: Too many small rows - rejecting as not a valid winding pattern");
		return null;
	}

	console.log("Winding detection: Found " + (rowBreaks.length - 1) + " rows from direction reversals");

	// Step 10h) Assign rowID and posID based on segments
	var rowID = 1;
	var rows = [];

	for (var r = 0; r < rowBreaks.length - 1; r++) {
		var startIdx = rowBreaks[r];
		var endIdx = rowBreaks[r + 1];
		var rowIndices = [];

		for (var h = startIdx; h < endIdx; h++) {
			var holeIndex = holeIDMap[h].index;
			holesData[holeIndex].rowID = rowID;
			holesData[holeIndex].posID = h - startIdx + 1;
			rowIndices.push(holeIndex);
		}

		rows.push(rowIndices);
		rowID++;
	}

	console.log("Winding sequence detection assigned " + holesData.length + " holes to " + rows.length + " rows");

	return {
		success: true,
		rows: rows,
		method: "winding-sequence",
		rowBreaks: rowBreaks.slice(0, -1),
		isWinding: true
	};
}
