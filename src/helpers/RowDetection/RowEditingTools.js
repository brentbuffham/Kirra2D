// src/helpers/RowDetection/RowEditingTools.js
//=============================================================
// ROW EDITING TOOLS
//=============================================================
// Step 0) Post-detection editing tools for manual row/position adjustments
// Created: 2026-01-30 (Phase 9)

import { calculateDistanceXY, estimateRowDirection } from "./MathUtilities.js";

// =============================================================================
// ROW RENAME TOOL
// =============================================================================

/**
 * Rename rows by applying a mapping of old rowIDs to new rowIDs
 * @param {Array} holes - Array of hole objects to modify (or null for all holes)
 * @param {string} entityName - Entity name to filter by (or null for all)
 * @param {Object} rowMapping - Map of oldRowID -> newRowID (e.g., {1: 3, 2: 1, 3: 2})
 * @returns {Object} - Result with count of modified holes
 */
export function renameRows(holes, entityName, rowMapping) {
	var targetHoles = holes || window.allBlastHoles || [];

	if (entityName) {
		targetHoles = targetHoles.filter(function(h) {
			return h.entityName === entityName;
		});
	}

	var modifiedCount = 0;
	var oldToNew = rowMapping || {};

	targetHoles.forEach(function(hole) {
		var oldRowID = hole.rowID;
		if (oldRowID !== undefined && oldToNew[oldRowID] !== undefined) {
			hole.rowID = oldToNew[oldRowID];
			modifiedCount++;
		}
	});

	console.log("Row rename: modified " + modifiedCount + " holes");

	// Trigger redraw
	if (window.drawData && window.allBlastHoles) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	return {
		success: true,
		modifiedCount: modifiedCount,
		mapping: oldToNew
	};
}

/**
 * Assign a new rowID to selected holes
 * @param {Array} selectedHoles - Array of hole objects to modify
 * @param {number} newRowID - The new rowID to assign
 * @returns {Object} - Result with count of modified holes
 */
export function assignRowToHoles(selectedHoles, newRowID) {
	if (!selectedHoles || selectedHoles.length === 0) {
		return { success: false, error: "No holes selected" };
	}

	var modifiedCount = 0;
	selectedHoles.forEach(function(hole) {
		hole.rowID = newRowID;
		modifiedCount++;
	});

	console.log("Assigned rowID " + newRowID + " to " + modifiedCount + " holes");

	// Trigger redraw
	if (window.drawData && window.allBlastHoles) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	return {
		success: true,
		modifiedCount: modifiedCount,
		newRowID: newRowID
	};
}

// =============================================================================
// INVERT ROWS TOOL
// =============================================================================

/**
 * Invert row numbering within an entity (Row 1 becomes Row N, Row 2 becomes Row N-1, etc.)
 * @param {string} entityName - Entity name to invert rows for
 * @param {Object} options - Options for inversion
 * @param {boolean} options.invertPositions - Also invert posID within rows (default: false)
 * @returns {Object} - Result with details
 */
export function invertRowOrder(entityName, options) {
	options = options || {};
	var invertPositions = options.invertPositions || false;

	var allHoles = window.allBlastHoles || [];
	var entityHoles = allHoles.filter(function(h) {
		return h.entityName === entityName;
	});

	if (entityHoles.length === 0) {
		return { success: false, error: "No holes found for entity: " + entityName };
	}

	// Find all unique rowIDs
	var rowIDs = [];
	entityHoles.forEach(function(hole) {
		if (hole.rowID !== undefined && rowIDs.indexOf(hole.rowID) === -1) {
			rowIDs.push(hole.rowID);
		}
	});

	rowIDs.sort(function(a, b) { return a - b; });

	if (rowIDs.length < 2) {
		return { success: false, error: "Need at least 2 rows to invert" };
	}

	// Create inversion mapping
	var invertMapping = {};
	var n = rowIDs.length;
	for (var i = 0; i < n; i++) {
		invertMapping[rowIDs[i]] = rowIDs[n - 1 - i];
	}

	// Apply mapping
	var modifiedCount = 0;
	entityHoles.forEach(function(hole) {
		var oldRowID = hole.rowID;
		if (invertMapping[oldRowID] !== undefined) {
			hole.rowID = invertMapping[oldRowID];
			modifiedCount++;
		}
	});

	// Optionally invert positions within each row
	if (invertPositions) {
		invertPositionsWithinRows(entityHoles);
	}

	console.log("Inverted " + n + " rows for entity " + entityName + ", modified " + modifiedCount + " holes");

	// Trigger redraw
	if (window.drawData && window.allBlastHoles) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	return {
		success: true,
		modifiedCount: modifiedCount,
		rowCount: n,
		mapping: invertMapping
	};
}

/**
 * Helper to invert position IDs within each row
 */
function invertPositionsWithinRows(holes) {
	// Group by rowID
	var rowMap = new Map();
	holes.forEach(function(hole) {
		var rowID = hole.rowID || 0;
		if (!rowMap.has(rowID)) {
			rowMap.set(rowID, []);
		}
		rowMap.get(rowID).push(hole);
	});

	// Invert positions within each row
	rowMap.forEach(function(rowHoles) {
		// Find min and max posID
		var posIDs = rowHoles.map(function(h) { return h.posID || 0; });
		var minPos = Math.min.apply(null, posIDs);
		var maxPos = Math.max.apply(null, posIDs);

		// Invert: newPos = maxPos - (oldPos - minPos)
		rowHoles.forEach(function(hole) {
			var oldPos = hole.posID || minPos;
			hole.posID = maxPos - (oldPos - minPos);
		});
	});
}

// =============================================================================
// RESEQUENCE POSITIONS TOOL
// =============================================================================

/**
 * Resequence position IDs within rows
 * @param {string} entityName - Entity name to resequence
 * @param {Object} options - Options for resequencing
 * @param {string} options.direction - "forward" (all same direction) or "serpentine" (alternating)
 * @param {number} options.startPos - Starting position ID (default: 1)
 * @param {string} options.orderBy - How to order: "spatial" (by location) or "existing" (by current posID)
 * @returns {Object} - Result with details
 */
export function resequencePositions(entityName, options) {
	options = options || {};
	var direction = options.direction || "forward";
	var startPos = options.startPos || 1;
	var orderBy = options.orderBy || "spatial";

	var allHoles = window.allBlastHoles || [];
	var entityHoles = allHoles.filter(function(h) {
		return h.entityName === entityName;
	});

	if (entityHoles.length === 0) {
		return { success: false, error: "No holes found for entity: " + entityName };
	}

	// Group by rowID
	var rowMap = new Map();
	entityHoles.forEach(function(hole) {
		var rowID = hole.rowID || 0;
		if (!rowMap.has(rowID)) {
			rowMap.set(rowID, []);
		}
		rowMap.get(rowID).push(hole);
	});

	// Sort rows by rowID
	var sortedRowIDs = Array.from(rowMap.keys()).sort(function(a, b) { return a - b; });

	var modifiedCount = 0;

	sortedRowIDs.forEach(function(rowID, rowIndex) {
		var rowHoles = rowMap.get(rowID);

		// Sort holes within row
		if (orderBy === "spatial") {
			// Sort by spatial position along row direction
			var rowDirection = estimateRowDirection(rowHoles);
			rowHoles.sort(function(a, b) {
				var projA = a.startXLocation * Math.cos(rowDirection) + a.startYLocation * Math.sin(rowDirection);
				var projB = b.startXLocation * Math.cos(rowDirection) + b.startYLocation * Math.sin(rowDirection);
				return projA - projB;
			});
		} else {
			// Sort by existing posID
			rowHoles.sort(function(a, b) {
				return (a.posID || 0) - (b.posID || 0);
			});
		}

		// Determine if this row should be reversed (for serpentine)
		var shouldReverse = (direction === "serpentine") && (rowIndex % 2 === 1);

		if (shouldReverse) {
			rowHoles.reverse();
		}

		// Assign new position IDs
		rowHoles.forEach(function(hole, index) {
			hole.posID = startPos + index;
			modifiedCount++;
		});
	});

	console.log("Resequenced positions for " + sortedRowIDs.length + " rows, " + modifiedCount + " holes (" + direction + ")");

	// Trigger redraw
	if (window.drawData && window.allBlastHoles) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	return {
		success: true,
		modifiedCount: modifiedCount,
		rowCount: sortedRowIDs.length,
		direction: direction
	};
}

// =============================================================================
// KAD EDITING TOOLS
// =============================================================================

/**
 * Rename KAD entity segments/points
 * @param {string} kadId - KAD entity ID
 * @param {Object} pointMapping - Map of old pointID to new pointID
 * @returns {Object} - Result with details
 */
export function renameKADPoints(kadId, pointMapping) {
	var loadedKADs = window.loadedKADs;
	if (!loadedKADs) {
		return { success: false, error: "No KAD data loaded" };
	}

	var kadEntity = null;
	loadedKADs.forEach(function(kad) {
		if (kad.id === kadId || kad.entityName === kadId) {
			kadEntity = kad;
		}
	});

	if (!kadEntity || !kadEntity.points) {
		return { success: false, error: "KAD entity not found: " + kadId };
	}

	var modifiedCount = 0;
	kadEntity.points.forEach(function(point) {
		var oldID = point.pointID;
		if (oldID !== undefined && pointMapping[oldID] !== undefined) {
			point.pointID = pointMapping[oldID];
			modifiedCount++;
		}
	});

	console.log("Renamed " + modifiedCount + " KAD points");

	// Trigger redraw
	if (window.drawData && window.allBlastHoles) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	return {
		success: true,
		modifiedCount: modifiedCount
	};
}

/**
 * Invert point order within a KAD line/polyline
 * @param {string} kadId - KAD entity ID
 * @returns {Object} - Result with details
 */
export function invertKADPointOrder(kadId) {
	var loadedKADs = window.loadedKADs;
	if (!loadedKADs) {
		return { success: false, error: "No KAD data loaded" };
	}

	var kadEntity = null;
	loadedKADs.forEach(function(kad) {
		if (kad.id === kadId || kad.entityName === kadId) {
			kadEntity = kad;
		}
	});

	if (!kadEntity || !kadEntity.points) {
		return { success: false, error: "KAD entity not found: " + kadId };
	}

	// Only invert for line/poly types
	if (kadEntity.entityType !== "line" && kadEntity.entityType !== "poly") {
		return { success: false, error: "Can only invert line or poly entities" };
	}

	// Get all pointIDs and reverse them
	var pointIDs = kadEntity.points.map(function(p) { return p.pointID; });
	var reversedIDs = pointIDs.slice().reverse();

	// Apply reversed IDs
	kadEntity.points.forEach(function(point, index) {
		point.pointID = reversedIDs[index];
	});

	console.log("Inverted " + pointIDs.length + " KAD points for " + kadId);

	// Trigger redraw
	if (window.drawData && window.allBlastHoles) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	return {
		success: true,
		modifiedCount: pointIDs.length
	};
}

/**
 * Resequence KAD points with new IDs starting from 1
 * @param {string} kadId - KAD entity ID
 * @param {Object} options - Options
 * @param {boolean} options.reverse - Reverse order before resequencing
 * @returns {Object} - Result with details
 */
export function resequenceKADPoints(kadId, options) {
	options = options || {};
	var reverse = options.reverse || false;

	var loadedKADs = window.loadedKADs;
	if (!loadedKADs) {
		return { success: false, error: "No KAD data loaded" };
	}

	var kadEntity = null;
	loadedKADs.forEach(function(kad) {
		if (kad.id === kadId || kad.entityName === kadId) {
			kadEntity = kad;
		}
	});

	if (!kadEntity || !kadEntity.points) {
		return { success: false, error: "KAD entity not found: " + kadId };
	}

	// Sort by current pointID
	var sortedPoints = kadEntity.points.slice().sort(function(a, b) {
		return (a.pointID || 0) - (b.pointID || 0);
	});

	if (reverse) {
		sortedPoints.reverse();
	}

	// Assign new sequential IDs
	sortedPoints.forEach(function(point, index) {
		point.pointID = index + 1;
	});

	console.log("Resequenced " + sortedPoints.length + " KAD points for " + kadId);

	// Trigger redraw
	if (window.drawData && window.allBlastHoles) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	return {
		success: true,
		modifiedCount: sortedPoints.length
	};
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get unique row IDs for an entity
 * @param {string} entityName - Entity name
 * @returns {Array} - Sorted array of unique rowIDs
 */
export function getEntityRowIDs(entityName) {
	var allHoles = window.allBlastHoles || [];
	var rowIDs = [];

	allHoles.forEach(function(hole) {
		if (hole.entityName === entityName && hole.rowID !== undefined) {
			if (rowIDs.indexOf(hole.rowID) === -1) {
				rowIDs.push(hole.rowID);
			}
		}
	});

	return rowIDs.sort(function(a, b) { return a - b; });
}

/**
 * Get holes for a specific row
 * @param {string} entityName - Entity name
 * @param {number} rowID - Row ID
 * @returns {Array} - Array of holes in the row, sorted by posID
 */
export function getRowHoles(entityName, rowID) {
	var allHoles = window.allBlastHoles || [];

	var rowHoles = allHoles.filter(function(hole) {
		return hole.entityName === entityName && hole.rowID === rowID;
	});

	rowHoles.sort(function(a, b) {
		return (a.posID || 0) - (b.posID || 0);
	});

	return rowHoles;
}

/**
 * Get all unique entity names from blast holes
 * @returns {Array} - Array of entity names
 */
export function getBlastEntityNames() {
	var allHoles = window.allBlastHoles || [];
	var names = [];

	allHoles.forEach(function(hole) {
		if (hole.entityName && names.indexOf(hole.entityName) === -1) {
			names.push(hole.entityName);
		}
	});

	return names.sort();
}

// =============================================================================
// EXPOSE TO WINDOW
// =============================================================================

window.renameRows = renameRows;
window.assignRowToHoles = assignRowToHoles;
window.invertRowOrder = invertRowOrder;
window.resequencePositions = resequencePositions;
window.renameKADPoints = renameKADPoints;
window.invertKADPointOrder = invertKADPointOrder;
window.resequenceKADPoints = resequenceKADPoints;
window.getEntityRowIDs = getEntityRowIDs;
window.getRowHoles = getRowHoles;
window.getBlastEntityNames = getBlastEntityNames;
