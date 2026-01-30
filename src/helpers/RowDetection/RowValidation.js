// src/helpers/RowDetection/RowValidation.js
//=============================================================
// ROW DETECTION VALIDATION AND METRICS
//=============================================================
// Step 0) Validation functions to verify row detection quality
// and calculate metrics for detected patterns.
// Created: 2026-01-30 (Phase 6)

import { calculateDistanceXY, mean, variance, standardDeviation } from "./MathUtilities.js";

// =============================================================================
// VALIDATION RESULT TYPES
// =============================================================================

export var VALIDATION_STATUS = {
	VALID: "valid",
	WARNING: "warning",
	INVALID: "invalid"
};

export var PATTERN_TYPES = {
	STRAIGHT: "straight",
	CURVED: "curved",
	SERPENTINE: "serpentine",
	WINDING: "winding",
	MULTI_PATTERN: "multi-pattern",
	IRREGULAR: "irregular",
	UNKNOWN: "unknown"
};

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validates detected rows and calculates quality metrics
 * @param {Array} holesData - Array of hole objects with rowID/posID assigned
 * @param {Array} detectedRows - Array of arrays of hole indices per row
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result with status, issues, and metrics
 */
export function validateRowDetection(holesData, detectedRows, options) {
	options = options || {};

	var result = {
		status: VALIDATION_STATUS.VALID,
		issues: [],
		warnings: [],
		metrics: {},
		confidence: 1.0,
		patternType: PATTERN_TYPES.UNKNOWN
	};

	if (!holesData || holesData.length === 0) {
		result.status = VALIDATION_STATUS.INVALID;
		result.issues.push("No holes data provided");
		result.confidence = 0;
		return result;
	}

	if (!detectedRows || detectedRows.length === 0) {
		result.status = VALIDATION_STATUS.INVALID;
		result.issues.push("No rows detected");
		result.confidence = 0;
		return result;
	}

	// Step 1) Check for orphan holes (holes without rowID)
	var orphanCheck = checkOrphanHoles(holesData);
	if (orphanCheck.orphanCount > 0) {
		result.warnings.push("Found " + orphanCheck.orphanCount + " holes without row assignment");
		result.confidence -= 0.1 * Math.min(orphanCheck.orphanRatio, 1);
	}

	// Step 2) Check spacing consistency within rows
	var spacingCheck = checkSpacingConsistency(holesData, detectedRows);
	result.metrics.avgSpacing = spacingCheck.avgSpacing;
	result.metrics.spacingStdDev = spacingCheck.stdDev;
	result.metrics.spacingCV = spacingCheck.coefficientOfVariation;

	if (spacingCheck.coefficientOfVariation > 0.5) {
		result.warnings.push("High spacing variation (CV=" + spacingCheck.coefficientOfVariation.toFixed(2) + ")");
		result.confidence -= 0.15;
	}

	// Step 3) Check burden consistency between rows
	var burdenCheck = checkBurdenConsistency(holesData, detectedRows);
	result.metrics.avgBurden = burdenCheck.avgBurden;
	result.metrics.burdenStdDev = burdenCheck.stdDev;
	result.metrics.burdenCV = burdenCheck.coefficientOfVariation;

	if (burdenCheck.coefficientOfVariation > 0.5) {
		result.warnings.push("High burden variation (CV=" + burdenCheck.coefficientOfVariation.toFixed(2) + ")");
		result.confidence -= 0.1;
	}

	// Step 4) Check for row size imbalance
	var sizeCheck = checkRowSizeBalance(detectedRows);
	result.metrics.avgRowSize = sizeCheck.avgSize;
	result.metrics.minRowSize = sizeCheck.minSize;
	result.metrics.maxRowSize = sizeCheck.maxSize;

	if (sizeCheck.sizeRatio > 3) {
		result.warnings.push("Large row size imbalance (ratio=" + sizeCheck.sizeRatio.toFixed(1) + ")");
		result.confidence -= 0.1;
	}

	// Step 5) Check position ID sequence validity
	var positionCheck = checkPositionSequences(holesData, detectedRows);
	if (positionCheck.hasGaps) {
		result.warnings.push("Position sequence has gaps in " + positionCheck.rowsWithGaps + " rows");
		result.confidence -= 0.05;
	}
	if (positionCheck.hasDuplicates) {
		result.issues.push("Duplicate position IDs found in " + positionCheck.rowsWithDuplicates + " rows");
		result.status = VALIDATION_STATUS.WARNING;
		result.confidence -= 0.2;
	}

	// Step 6) Estimate pattern type
	result.patternType = estimatePatternType(holesData, detectedRows, spacingCheck, burdenCheck);
	result.metrics.patternType = result.patternType;

	// Step 7) Calculate overall row count metrics
	result.metrics.rowCount = detectedRows.length;
	result.metrics.totalHoles = holesData.length;
	result.metrics.holesPerRow = holesData.length / detectedRows.length;

	// Step 8) Clamp confidence to valid range
	result.confidence = Math.max(0, Math.min(1, result.confidence));

	// Step 9) Set final status based on issues
	if (result.issues.length > 0) {
		result.status = VALIDATION_STATUS.INVALID;
	} else if (result.warnings.length > 0) {
		result.status = VALIDATION_STATUS.WARNING;
	}

	console.log("Row validation: status=" + result.status +
		", confidence=" + result.confidence.toFixed(2) +
		", pattern=" + result.patternType +
		", issues=" + result.issues.length +
		", warnings=" + result.warnings.length);

	return result;
}

// =============================================================================
// INDIVIDUAL CHECK FUNCTIONS
// =============================================================================

/**
 * Check for holes that don't have a row assignment
 */
function checkOrphanHoles(holesData) {
	var orphanCount = 0;

	holesData.forEach(function(hole) {
		if (!hole.rowID || hole.rowID === 0) {
			orphanCount++;
		}
	});

	return {
		orphanCount: orphanCount,
		orphanRatio: orphanCount / holesData.length
	};
}

/**
 * Check spacing consistency within rows
 */
function checkSpacingConsistency(holesData, detectedRows) {
	var allSpacings = [];

	detectedRows.forEach(function(rowIndices) {
		if (rowIndices.length < 2) return;

		// Sort by posID
		var sortedIndices = rowIndices.slice().sort(function(a, b) {
			return (holesData[a].posID || 0) - (holesData[b].posID || 0);
		});

		// Calculate spacings between consecutive holes
		for (var i = 0; i < sortedIndices.length - 1; i++) {
			var hole1 = holesData[sortedIndices[i]];
			var hole2 = holesData[sortedIndices[i + 1]];
			var spacing = calculateDistanceXY(
				hole1.startXLocation, hole1.startYLocation,
				hole2.startXLocation, hole2.startYLocation
			);
			allSpacings.push(spacing);
		}
	});

	if (allSpacings.length === 0) {
		return { avgSpacing: 0, stdDev: 0, coefficientOfVariation: 0 };
	}

	var avg = mean(allSpacings);
	var std = standardDeviation(allSpacings);
	var cv = avg > 0 ? std / avg : 0;

	return {
		avgSpacing: avg,
		stdDev: std,
		coefficientOfVariation: cv,
		spacings: allSpacings
	};
}

/**
 * Check burden consistency between rows
 */
function checkBurdenConsistency(holesData, detectedRows) {
	if (detectedRows.length < 2) {
		return { avgBurden: 0, stdDev: 0, coefficientOfVariation: 0 };
	}

	var burdens = [];

	// Calculate centroid for each row
	var rowCentroids = detectedRows.map(function(rowIndices) {
		var sumX = 0, sumY = 0;
		rowIndices.forEach(function(idx) {
			sumX += holesData[idx].startXLocation;
			sumY += holesData[idx].startYLocation;
		});
		return {
			x: sumX / rowIndices.length,
			y: sumY / rowIndices.length
		};
	});

	// Calculate distances between consecutive row centroids
	for (var i = 0; i < rowCentroids.length - 1; i++) {
		var burden = calculateDistanceXY(
			rowCentroids[i].x, rowCentroids[i].y,
			rowCentroids[i + 1].x, rowCentroids[i + 1].y
		);
		burdens.push(burden);
	}

	if (burdens.length === 0) {
		return { avgBurden: 0, stdDev: 0, coefficientOfVariation: 0 };
	}

	var avg = mean(burdens);
	var std = standardDeviation(burdens);
	var cv = avg > 0 ? std / avg : 0;

	return {
		avgBurden: avg,
		stdDev: std,
		coefficientOfVariation: cv,
		burdens: burdens
	};
}

/**
 * Check for row size balance
 */
function checkRowSizeBalance(detectedRows) {
	var sizes = detectedRows.map(function(row) { return row.length; });

	var minSize = Math.min.apply(null, sizes);
	var maxSize = Math.max.apply(null, sizes);
	var avgSize = mean(sizes);
	var sizeRatio = minSize > 0 ? maxSize / minSize : Infinity;

	return {
		minSize: minSize,
		maxSize: maxSize,
		avgSize: avgSize,
		sizeRatio: sizeRatio
	};
}

/**
 * Check position ID sequences for gaps and duplicates
 */
function checkPositionSequences(holesData, detectedRows) {
	var hasGaps = false;
	var hasDuplicates = false;
	var rowsWithGaps = 0;
	var rowsWithDuplicates = 0;

	detectedRows.forEach(function(rowIndices) {
		var posIDs = rowIndices.map(function(idx) {
			return holesData[idx].posID || 0;
		}).sort(function(a, b) { return a - b; });

		// Check for duplicates
		var uniquePosIDs = [];
		var duplicateFound = false;
		posIDs.forEach(function(pos) {
			if (uniquePosIDs.indexOf(pos) !== -1) {
				duplicateFound = true;
			} else {
				uniquePosIDs.push(pos);
			}
		});

		if (duplicateFound) {
			hasDuplicates = true;
			rowsWithDuplicates++;
		}

		// Check for gaps (assuming posID should be sequential)
		var gapFound = false;
		for (var i = 0; i < uniquePosIDs.length - 1; i++) {
			if (uniquePosIDs[i + 1] - uniquePosIDs[i] > 1) {
				gapFound = true;
				break;
			}
		}

		if (gapFound) {
			hasGaps = true;
			rowsWithGaps++;
		}
	});

	return {
		hasGaps: hasGaps,
		hasDuplicates: hasDuplicates,
		rowsWithGaps: rowsWithGaps,
		rowsWithDuplicates: rowsWithDuplicates
	};
}

/**
 * Estimate the pattern type based on metrics
 */
function estimatePatternType(holesData, detectedRows, spacingCheck, burdenCheck) {
	// Check if serpentine was already detected
	var hasSerpentine = holesData.some(function(hole) {
		return hole.serpentineDirection !== undefined;
	});

	if (hasSerpentine) {
		return PATTERN_TYPES.SERPENTINE;
	}

	// Check spacing/burden ratio to determine pattern regularity
	var spacingCV = spacingCheck.coefficientOfVariation || 0;
	var burdenCV = burdenCheck.coefficientOfVariation || 0;

	// High variation suggests curved or irregular pattern
	if (spacingCV > 0.3 || burdenCV > 0.3) {
		if (spacingCV > 0.5 || burdenCV > 0.5) {
			return PATTERN_TYPES.IRREGULAR;
		}
		return PATTERN_TYPES.CURVED;
	}

	// Low variation suggests straight pattern
	if (spacingCV < 0.15 && burdenCV < 0.15) {
		return PATTERN_TYPES.STRAIGHT;
	}

	return PATTERN_TYPES.UNKNOWN;
}

// =============================================================================
// METRICS CALCULATION
// =============================================================================

/**
 * Calculate comprehensive burden and spacing metrics for display
 * @param {Array} holesData - Array of hole objects
 * @param {Array} detectedRows - Array of arrays of hole indices
 * @returns {Object} - Detailed metrics object
 */
export function calculateDetailedMetrics(holesData, detectedRows) {
	var spacingCheck = checkSpacingConsistency(holesData, detectedRows);
	var burdenCheck = checkBurdenConsistency(holesData, detectedRows);
	var sizeCheck = checkRowSizeBalance(detectedRows);

	// Calculate pattern offset (stagger)
	var offsetRatio = calculatePatternOffset(holesData, detectedRows);

	// Determine pattern style
	var patternStyle = "unknown";
	if (Math.abs(offsetRatio) < 0.15) {
		patternStyle = "square";
	} else if (Math.abs(offsetRatio - 0.5) < 0.15) {
		patternStyle = "staggered";
	} else {
		patternStyle = "irregular";
	}

	return {
		// Spacing metrics
		avgSpacing: Math.round(spacingCheck.avgSpacing * 100) / 100,
		spacingStdDev: Math.round(spacingCheck.stdDev * 100) / 100,
		spacingCV: Math.round(spacingCheck.coefficientOfVariation * 100) / 100,

		// Burden metrics
		avgBurden: Math.round(burdenCheck.avgBurden * 100) / 100,
		burdenStdDev: Math.round(burdenCheck.stdDev * 100) / 100,
		burdenCV: Math.round(burdenCheck.coefficientOfVariation * 100) / 100,

		// Row metrics
		rowCount: detectedRows.length,
		avgRowSize: Math.round(sizeCheck.avgSize * 10) / 10,
		minRowSize: sizeCheck.minSize,
		maxRowSize: sizeCheck.maxSize,

		// Pattern metrics
		offsetRatio: Math.round(offsetRatio * 100) / 100,
		patternStyle: patternStyle,

		// Summary
		totalHoles: holesData.length,
		avgHolesPerRow: Math.round((holesData.length / detectedRows.length) * 10) / 10
	};
}

/**
 * Calculate pattern offset ratio (how much rows are staggered)
 * 0 = square pattern (holes aligned), 0.5 = staggered (half-spacing offset)
 */
function calculatePatternOffset(holesData, detectedRows) {
	if (detectedRows.length < 2) return 0;

	var offsets = [];

	for (var i = 0; i < detectedRows.length - 1; i++) {
		var row1 = detectedRows[i];
		var row2 = detectedRows[i + 1];

		if (row1.length < 2 || row2.length < 2) continue;

		// Get first hole of each row (by posID)
		var row1Sorted = row1.slice().sort(function(a, b) {
			return (holesData[a].posID || 0) - (holesData[b].posID || 0);
		});
		var row2Sorted = row2.slice().sort(function(a, b) {
			return (holesData[a].posID || 0) - (holesData[b].posID || 0);
		});

		var hole1First = holesData[row1Sorted[0]];
		var hole1Second = holesData[row1Sorted[1]];
		var hole2First = holesData[row2Sorted[0]];

		// Calculate row direction
		var rowDirX = hole1Second.startXLocation - hole1First.startXLocation;
		var rowDirY = hole1Second.startYLocation - hole1First.startYLocation;
		var rowLength = Math.sqrt(rowDirX * rowDirX + rowDirY * rowDirY);

		if (rowLength === 0) continue;

		// Normalize direction
		rowDirX /= rowLength;
		rowDirY /= rowLength;

		// Project row2's first hole onto row1's direction
		var dx = hole2First.startXLocation - hole1First.startXLocation;
		var dy = hole2First.startYLocation - hole1First.startYLocation;
		var projection = dx * rowDirX + dy * rowDirY;

		// Calculate spacing in row1
		var spacing = calculateDistanceXY(
			hole1First.startXLocation, hole1First.startYLocation,
			hole1Second.startXLocation, hole1Second.startYLocation
		);

		if (spacing > 0) {
			// Offset as fraction of spacing (modulo 1 to handle multi-spacing offsets)
			var offset = Math.abs(projection % spacing) / spacing;
			// Normalize to 0-0.5 range (0.6 is same as 0.4 offset)
			if (offset > 0.5) offset = 1 - offset;
			offsets.push(offset);
		}
	}

	return offsets.length > 0 ? mean(offsets) : 0;
}

// =============================================================================
// CONFIDENCE SCORE CALCULATION
// =============================================================================

/**
 * Calculate a confidence score for the detection result
 * @param {Object} validationResult - Result from validateRowDetection
 * @param {string} detectionMethod - The method used for detection
 * @returns {number} - Confidence score 0-1
 */
export function calculateConfidenceScore(validationResult, detectionMethod) {
	var baseConfidence = validationResult.confidence || 0.5;

	// Adjust based on detection method reliability
	var methodBonus = {
		"sequence": 0.1,
		"winding-sequence": 0.1,
		"sequence-weighted-hdbscan": 0.05,
		"hdbscan": 0,
		"adaptive-grid": -0.05,
		"dbscan-douglas-peucker": -0.1,
		"fallback-single-row": -0.3
	};

	var bonus = methodBonus[detectionMethod] || 0;
	var finalConfidence = baseConfidence + bonus;

	return Math.max(0, Math.min(1, finalConfidence));
}
