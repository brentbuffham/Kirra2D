// src/helpers/RowDetection/index.js
//=============================================================
// ROW DETECTION MODULE - Main Entry Point
//=============================================================
// Step 0) This module consolidates all row detection algorithms
// Previously in kirra.js lines 39073-40884 (~1,800 lines)
//
// Module Structure:
// - index.js (this file) - Main orchestrator and exports
// - RowDetectionCore.js - Core detection functions (line fitting, adaptive grid)
// - ClusteringAlgorithms.js - HDBSCAN, DBSCAN implementations
// - GraphBasedDetection.js - MST, KNN graph traversal
// - MathUtilities.js - PCA, distance calculations, helpers
//
// Future additions (Phase 1+):
// - PatternClassifier.js - Pattern type classification
// - CurveDetection.js - Principal Curves, B-Spline fitting
// - SerpentineDetection.js - Serpentine pattern detection
// - RowValidation.js - Validation and metrics
// - RowEditingTools.js - Post-detection editing tools

// Step 1) Import from sub-modules
import {
	trySequenceBasedDetection,
	detectRowsUsingLineFitting,
	detectRowsUsingAdaptiveGrid,
	detectRowsUsingPCAWithLOESS
} from "./RowDetectionCore.js";

import {
	detectRowsUsingHDBSCAN,
	detectRowsUsingSequenceWeightedHDBSCAN,
	runDBSCAN,
	estimateEpsilon,
	detectRowsUsingDBSCANWithDouglasPeucker
} from "./ClusteringAlgorithms.js";

import {
	buildMinimumSpanningTree,
	buildMinimumSpanningTreeFromMatrix
} from "./GraphBasedDetection.js";

import {
	estimateRowDirection,
	estimateRowOrientation,
	calculateDistanceXY,
	normalizeAngle,
	calculateBurdenAndSpacingForHoles,
	douglasPeucker,
	orderByNearestNeighborChain
} from "./MathUtilities.js";

import {
	classifyPatternType,
	separateSubPatterns,
	PATTERN_TYPES
} from "./PatternClassifier.js";

import {
	detectCurvedRows,
	fitPrincipalCurve,
	detectRowsUsingSplineFitting,
	orderHolesAlongCurve
} from "./CurveDetection.js";

import {
	detectSerpentinePattern,
	applySerpentineOrdering,
	detectSerpentineFromSequence,
	detectRowsUsingKNNBearingTraversal,
	assignSerpentinePositionIDs,
	detectRowsUsingWindingSequence,
	DIRECTION_TYPES
} from "./SerpentineDetection.js";

// Step 2) Main orchestrator function
/**
 * IMPROVED SMART ROW DETECTION
 *
 * This is the main entry point for row detection.
 * It tries multiple detection methods in order of preference:
 * 1. Sequence-based detection (using hole ID patterns)
 * 2. Sequence-weighted HDBSCAN clustering
 * 3. Pure HDBSCAN clustering
 * 4. Adaptive grid detection
 * 5. Bearing-based detection (fallback)
 *
 * After row detection, it also:
 * - Detects if pattern is serpentine (bidirectional zigzag)
 * - Applies serpentine position ordering if detected
 *
 * @param {Array} holesData - Array of hole objects
 * @param {string} entityName - Name of blast entity
 * @param {Object} options - Optional settings
 * @param {boolean} options.resetRowNumbers - Start rows at 1 instead of continuing from existing (default: true)
 * @param {boolean} options.detectSerpentine - Auto-detect and apply serpentine ordering (default: true)
 * @param {string} options.forceDirection - Force 'FORWARD' or 'SERPENTINE' instead of auto-detect
 * @returns {Object} - Detection result with rows, method used, and metadata
 */
export function improvedSmartRowDetection(holesData, entityName, options) {
	options = options || {};
	var resetRowNumbers = options.resetRowNumbers !== false; // Default true
	var detectSerpentineFlag = options.detectSerpentine !== false; // Default true
	var forceDirection = options.forceDirection || null;

	// Step 2a) Validate input
	if (!holesData || holesData.length === 0) {
		console.warn("improvedSmartRowDetection: No holes data provided");
		return { success: false, method: "none", rows: [], serpentinePattern: null };
	}

	console.log("=== Starting improvedSmartRowDetection for entity:", entityName, "with", holesData.length, "holes ===");
	console.log("Options: resetRowNumbers=" + resetRowNumbers + ", detectSerpentine=" + detectSerpentineFlag);

	// Step 2b) If resetting row numbers, temporarily override getNextRowID behavior
	var originalStartRowID = 1;
	if (resetRowNumbers) {
		// We'll renumber rows after detection
		console.log("Will reset row numbers to start at 1");
	}

	// Step 2c) Try winding/curved sequence detection FIRST (for S-curve patterns)
	// This MUST run BEFORE line fitting to avoid grouping spatially-close
	// but sequence-distant holes (different "passes" of winding path)
	console.log("Attempting winding sequence detection...");
	var windingResult = detectRowsUsingWindingSequence(holesData, entityName);
	var detectionMethod = null;
	var detectedRows = null;

	if (windingResult && windingResult.success) {
		console.log("Winding sequence detection successful with", windingResult.rows.length, "rows");
		detectionMethod = "winding-sequence";
		detectedRows = windingResult.rows;
		// Skip serpentine detection later - winding already handles direction
	}

	// Step 2c2) Try sequence-based detection (uses hole ID patterns like A1, B1...)
	// This uses line fitting which groups spatially - only for non-winding patterns
	if (!detectedRows) {
		console.log("Attempting sequence-based detection...");
		var sequenceResult = trySequenceBasedDetection(holesData, entityName);
		if (sequenceResult) {
			console.log("Sequence-based detection successful");
			detectionMethod = "sequence";
			detectedRows = buildRowArrays(holesData);
		}
	}

	// Step 2d) Try sequence-weighted HDBSCAN
	if (!detectedRows) {
		console.log("Attempting sequence-weighted HDBSCAN...");
		var weightedResult = detectRowsUsingSequenceWeightedHDBSCAN(holesData, entityName);
		if (weightedResult && weightedResult.length > 0) {
			console.log("Sequence-weighted HDBSCAN successful with", weightedResult.length, "rows");
			detectionMethod = "sequence-weighted-hdbscan";
			detectedRows = buildRowArrays(holesData);
		}
	}

	// Step 2e) Try pure HDBSCAN
	if (!detectedRows) {
		console.log("Attempting pure HDBSCAN...");
		var hdbscanResult = detectRowsUsingHDBSCAN(holesData, entityName);
		if (hdbscanResult && hdbscanResult.length > 0) {
			console.log("Pure HDBSCAN successful with", hdbscanResult.length, "rows");
			detectionMethod = "hdbscan";
			detectedRows = buildRowArrays(holesData);
		}
	}

	// Step 2f) Try adaptive grid detection
	if (!detectedRows) {
		console.log("Attempting adaptive grid detection...");
		var gridResult = detectRowsUsingAdaptiveGrid(holesData, entityName);
		if (gridResult) {
			console.log("Adaptive grid detection successful");
			detectionMethod = "adaptive-grid";
			detectedRows = buildRowArrays(holesData);
		}
	}

	// Step 2f2) Try DBSCAN + Douglas-Peucker fallback (Phase 5)
	if (!detectedRows) {
		console.log("Attempting DBSCAN + Douglas-Peucker fallback...");
		var dbscanDpResult = detectRowsUsingDBSCANWithDouglasPeucker(holesData, entityName);
		if (dbscanDpResult && dbscanDpResult.success) {
			console.log("DBSCAN + Douglas-Peucker successful with", dbscanDpResult.rows.length, "rows");
			detectionMethod = "dbscan-douglas-peucker";
			detectedRows = buildRowArrays(holesData);
		}
	}

	// Step 2g) Fallback - assign all holes to single row
	if (!detectedRows) {
		console.log("All detection methods failed, falling back to single row");
		holesData.forEach(function(hole, index) {
			hole.rowID = 1;
			hole.posID = index + 1;
		});
		detectionMethod = "fallback-single-row";
		detectedRows = [holesData.map(function(h, i) { return i; })];
	}

	// Step 2h) Reset row numbers to start at 1 if requested
	if (resetRowNumbers && detectedRows && detectedRows.length > 0) {
		renumberRowsFromOne(holesData);
		detectedRows = buildRowArrays(holesData); // Rebuild after renumbering
	}

	// Step 2i) Check if hole IDs already encode serpentine pattern
	// If holes have numeric IDs that already follow serpentine order, use ID-based positioning
	// SKIP this for winding detection - it already handles row segmentation and position ordering
	var useHoleIDForPositions = { encodedInIDs: false, confidence: 0 };
	var serpentineResult = null;

	if (detectionMethod === "winding-sequence") {
		// Winding detection already properly segmented rows by direction reversals
		console.log("Skipping serpentine detection - winding sequence already handled row segmentation");
		serpentineResult = {
			pattern: DIRECTION_TYPES.SERPENTINE,
			confidence: 1,
			isWinding: true
		};
	} else {
		useHoleIDForPositions = checkIfHoleIDsEncodeSerpentine(holesData, detectedRows);

		if (useHoleIDForPositions.encodedInIDs) {
			console.log("Hole IDs already encode serpentine pattern - using ID order for positions");
			applyHoleIDBasedPositions(holesData, detectedRows);
			serpentineResult = {
				pattern: DIRECTION_TYPES.SERPENTINE,
				confidence: useHoleIDForPositions.confidence,
				encodedInIDs: true
			};
		} else {
			// Step 2j) Detect and apply serpentine pattern via spatial analysis
			if (detectedRows && detectedRows.length > 1) {
				if (forceDirection) {
					// User forced a specific direction
					console.log("Forcing direction:", forceDirection);
					serpentineResult = { pattern: forceDirection, confidence: 1, forced: true };
					if (forceDirection === DIRECTION_TYPES.SERPENTINE) {
						applySerpentineOrdering(holesData, detectedRows, DIRECTION_TYPES.SERPENTINE);
					}
				} else if (detectSerpentineFlag) {
					// Auto-detect serpentine pattern
					serpentineResult = detectSerpentinePattern(holesData, detectedRows);
					console.log("Serpentine detection result:", serpentineResult.pattern, "confidence:", serpentineResult.confidence.toFixed(2));

					if (serpentineResult.pattern === DIRECTION_TYPES.SERPENTINE && serpentineResult.confidence > 0.3) {
						console.log("Applying serpentine ordering to positions");
						applySerpentineOrdering(holesData, detectedRows, DIRECTION_TYPES.SERPENTINE);
					}
				}
			}
		}
	}

	return {
		success: true,
		method: detectionMethod,
		rows: detectedRows,
		rowCount: detectedRows ? detectedRows.length : 0,
		serpentinePattern: serpentineResult
	};
}

// Step 2.1) Build row arrays from holes that have rowID assigned
function buildRowArrays(holesData) {
	var rowMap = new Map();

	holesData.forEach(function(hole, index) {
		var rowID = hole.rowID || 0;
		if (!rowMap.has(rowID)) {
			rowMap.set(rowID, []);
		}
		rowMap.get(rowID).push(index);
	});

	// Sort rows by rowID and return as array of arrays
	var sortedRowIDs = Array.from(rowMap.keys()).sort(function(a, b) { return a - b; });
	return sortedRowIDs.map(function(rowID) {
		var indices = rowMap.get(rowID);
		// Sort by posID within each row
		indices.sort(function(a, b) {
			return (holesData[a].posID || 0) - (holesData[b].posID || 0);
		});
		return indices;
	});
}

// Step 2.2) Renumber rows to start at 1
function renumberRowsFromOne(holesData) {
	// Find all unique rowIDs
	var rowIDs = new Set();
	holesData.forEach(function(hole) {
		if (hole.rowID) rowIDs.add(hole.rowID);
	});

	// Create mapping from old to new
	var sortedRowIDs = Array.from(rowIDs).sort(function(a, b) { return a - b; });
	var rowMapping = new Map();
	sortedRowIDs.forEach(function(oldID, index) {
		rowMapping.set(oldID, index + 1);
	});

	// Apply mapping
	holesData.forEach(function(hole) {
		if (hole.rowID && rowMapping.has(hole.rowID)) {
			hole.rowID = rowMapping.get(hole.rowID);
		}
	});

	console.log("Renumbered rows: " + sortedRowIDs.join(",") + " -> 1.." + sortedRowIDs.length);
}

// Step 2.3) Check if hole IDs already encode serpentine pattern
/**
 * Detects if hole IDs are numbered in a way that already encodes serpentine ordering.
 * For example, if Row 1 has holes 1-17 going left-to-right spatially,
 * and Row 2 has holes 18-35 going right-to-left spatially (where hole 18 is at the
 * spatial end opposite to hole 17), then hole IDs encode serpentine.
 *
 * @param {Array} holesData - Array of hole objects
 * @param {Array} detectedRows - Array of arrays of hole indices per row
 * @returns {Object} - { encodedInIDs: boolean, confidence: number }
 */
function checkIfHoleIDsEncodeSerpentine(holesData, detectedRows) {
	if (!detectedRows || detectedRows.length < 2) {
		return { encodedInIDs: false, confidence: 0 };
	}

	// Check if holes have numeric IDs we can parse
	var hasNumericIDs = holesData.every(function(hole) {
		var id = hole.holeID || hole.id || "";
		var numericPart = String(id).replace(/[^0-9]/g, "");
		return numericPart.length > 0;
	});

	if (!hasNumericIDs) {
		return { encodedInIDs: false, confidence: 0 };
	}

	// Extract numeric IDs for each hole
	var holeNumericIDs = holesData.map(function(hole) {
		var id = hole.holeID || hole.id || "0";
		var numericPart = String(id).replace(/[^0-9]/g, "");
		return parseInt(numericPart, 10) || 0;
	});

	// For each consecutive pair of rows, check if ID order is spatially inverted
	var serpentineScores = [];

	for (var r = 0; r < detectedRows.length - 1; r++) {
		var row1Indices = detectedRows[r];
		var row2Indices = detectedRows[r + 1];

		if (row1Indices.length < 2 || row2Indices.length < 2) continue;

		// Get holes for each row, sorted by their numeric ID
		var row1ByID = row1Indices.slice().sort(function(a, b) {
			return holeNumericIDs[a] - holeNumericIDs[b];
		});
		var row2ByID = row2Indices.slice().sort(function(a, b) {
			return holeNumericIDs[a] - holeNumericIDs[b];
		});

		// Get first and last hole of each row (by ID order)
		var row1FirstByID = holesData[row1ByID[0]];
		var row1LastByID = holesData[row1ByID[row1ByID.length - 1]];
		var row2FirstByID = holesData[row2ByID[0]];
		var row2LastByID = holesData[row2ByID[row2ByID.length - 1]];

		// Calculate spatial distances
		// In serpentine, row1's last hole (by ID) should be close to row2's first hole (by ID)
		var serpentineDist = calculateDistanceXY(
			row1LastByID.startXLocation, row1LastByID.startYLocation,
			row2FirstByID.startXLocation, row2FirstByID.startYLocation
		);

		// In forward pattern, row1's first hole should be close to row2's first hole
		var forwardDist = calculateDistanceXY(
			row1FirstByID.startXLocation, row1FirstByID.startYLocation,
			row2FirstByID.startXLocation, row2FirstByID.startYLocation
		);

		// If serpentine distance is significantly smaller, IDs encode serpentine
		if (serpentineDist < forwardDist * 0.7) {
			serpentineScores.push(1);
		} else if (forwardDist < serpentineDist * 0.7) {
			serpentineScores.push(0);
		} else {
			serpentineScores.push(0.5); // Ambiguous
		}
	}

	if (serpentineScores.length === 0) {
		return { encodedInIDs: false, confidence: 0 };
	}

	// Calculate average score
	var avgScore = serpentineScores.reduce(function(a, b) { return a + b; }, 0) / serpentineScores.length;

	console.log("Hole ID serpentine check: scores=" + serpentineScores.join(",") + ", avg=" + avgScore.toFixed(2));

	return {
		encodedInIDs: avgScore > 0.6,
		confidence: avgScore
	};
}

// Step 2.4) Apply position IDs based on hole ID order within each row
/**
 * Assigns posID to holes based on their numeric hole ID order within each row,
 * rather than spatial order. Use this when hole IDs already encode serpentine pattern.
 *
 * @param {Array} holesData - Array of hole objects
 * @param {Array} detectedRows - Array of arrays of hole indices per row
 */
function applyHoleIDBasedPositions(holesData, detectedRows) {
	// Extract numeric IDs for each hole
	var holeNumericIDs = holesData.map(function(hole) {
		var id = hole.holeID || hole.id || "0";
		var numericPart = String(id).replace(/[^0-9]/g, "");
		return parseInt(numericPart, 10) || 0;
	});

	detectedRows.forEach(function(rowIndices, rowIndex) {
		// Sort indices by their numeric hole ID
		var sortedByID = rowIndices.slice().sort(function(a, b) {
			return holeNumericIDs[a] - holeNumericIDs[b];
		});

		// Assign posID based on ID order
		sortedByID.forEach(function(holeIndex, pos) {
			holesData[holeIndex].posID = pos + 1;
		});

		console.log("Row " + (rowIndex + 1) + ": assigned posID 1-" + sortedByID.length + " by hole ID order");
	});
}

// Step 3) Export all functions for external use
export {
	// Core detection
	trySequenceBasedDetection,
	detectRowsUsingLineFitting,
	detectRowsUsingAdaptiveGrid,
	detectRowsUsingPCAWithLOESS,

	// Clustering
	detectRowsUsingHDBSCAN,
	detectRowsUsingSequenceWeightedHDBSCAN,
	runDBSCAN,
	estimateEpsilon,
	detectRowsUsingDBSCANWithDouglasPeucker,

	// Graph-based
	buildMinimumSpanningTree,
	buildMinimumSpanningTreeFromMatrix,

	// Math utilities
	estimateRowDirection,
	estimateRowOrientation,
	calculateDistanceXY,
	normalizeAngle,
	calculateBurdenAndSpacingForHoles,
	douglasPeucker,
	orderByNearestNeighborChain,

	// Pattern classification
	classifyPatternType,
	separateSubPatterns,
	PATTERN_TYPES,

	// Curve detection
	detectCurvedRows,
	fitPrincipalCurve,
	detectRowsUsingSplineFitting,
	orderHolesAlongCurve,

	// Serpentine detection
	detectSerpentinePattern,
	applySerpentineOrdering,
	detectSerpentineFromSequence,
	detectRowsUsingKNNBearingTraversal,
	assignSerpentinePositionIDs,
	detectRowsUsingWindingSequence,
	DIRECTION_TYPES
};

// Step 4) Expose to window for backward compatibility with kirra.js
window.improvedSmartRowDetection = improvedSmartRowDetection;
window.trySequenceBasedDetection = trySequenceBasedDetection;
window.detectRowsUsingLineFitting = detectRowsUsingLineFitting;
window.detectRowsUsingAdaptiveGrid = detectRowsUsingAdaptiveGrid;
window.detectRowsUsingPCAWithLOESS = detectRowsUsingPCAWithLOESS;
window.detectRowsUsingHDBSCAN = detectRowsUsingHDBSCAN;
window.detectRowsUsingSequenceWeightedHDBSCAN = detectRowsUsingSequenceWeightedHDBSCAN;
window.runDBSCAN = runDBSCAN;
window.estimateEpsilon = estimateEpsilon;
window.detectRowsUsingDBSCANWithDouglasPeucker = detectRowsUsingDBSCANWithDouglasPeucker;
window.douglasPeucker = douglasPeucker;
window.orderByNearestNeighborChain = orderByNearestNeighborChain;
window.buildMinimumSpanningTree = buildMinimumSpanningTree;
window.buildMinimumSpanningTreeFromMatrix = buildMinimumSpanningTreeFromMatrix;
window.estimateRowDirection = estimateRowDirection;
window.estimateRowOrientation = estimateRowOrientation;
window.calculateBurdenAndSpacingForHoles = calculateBurdenAndSpacingForHoles;
window.classifyPatternType = classifyPatternType;
window.separateSubPatterns = separateSubPatterns;
window.PATTERN_TYPES = PATTERN_TYPES;
window.detectCurvedRows = detectCurvedRows;
window.fitPrincipalCurve = fitPrincipalCurve;
window.detectRowsUsingSplineFitting = detectRowsUsingSplineFitting;
window.orderHolesAlongCurve = orderHolesAlongCurve;
window.detectSerpentinePattern = detectSerpentinePattern;
window.applySerpentineOrdering = applySerpentineOrdering;
window.detectSerpentineFromSequence = detectSerpentineFromSequence;
window.detectRowsUsingKNNBearingTraversal = detectRowsUsingKNNBearingTraversal;
window.assignSerpentinePositionIDs = assignSerpentinePositionIDs;
window.detectRowsUsingWindingSequence = detectRowsUsingWindingSequence;
window.DIRECTION_TYPES = DIRECTION_TYPES;
