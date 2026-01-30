// src/helpers/RowDetection/HoleEditingTools.js
//=============================================================
// HOLE EDITING TOOLS
//=============================================================
// Step 0) Hole renumbering and deletion functions
// Extracted from kirra.js for modularization
// Created: 2026-01-30

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Increment a letter string (A -> B, Z -> AA, AZ -> BA, etc.)
 * @param {string} str - Letter string to increment
 * @returns {string} - Incremented letter string
 */
export function incrementLetter(str) {
	var lastIndex = str.length - 1;
	var carry = false;
	var chars = str.split("").reverse();
	var newChars = [];

	for (var i = 0; i < chars.length; i++) {
		var char = chars[i];
		if (i === 0 || carry) {
			if (char === "Z") {
				carry = true;
				newChars.push("A");
			} else {
				carry = false;
				newChars.push(String.fromCharCode(char.charCodeAt(0) + 1));
			}
		} else {
			newChars.push(char);
		}
	}

	var newStr = newChars.reverse().join("");
	if (carry) {
		return "A" + newStr;
	}
	return newStr;
}

// =============================================================================
// RENUMBER HOLES FUNCTION
// =============================================================================

/**
 * Renumber holes for an entity, preserving rowID/posID structure
 * Supports both numerical and alpha-numerical (A1, B2, etc.) hole IDs
 * @param {string|number} startNumber - Starting number or alphanumeric ID (e.g., "1" or "A1")
 * @param {string} selectedEntityName - Entity name to renumber
 */
export function renumberHolesFunction(startNumber, selectedEntityName) {
	var allBlastHoles = window.allBlastHoles || [];
	console.log("Renumbering holes for Entity:", selectedEntityName, "Starting at:", startNumber);

	var oldToNewHoleIDMap = new Map();

	// Get all holes for this entity
	var entityHoles = allBlastHoles.filter(function(hole) {
		return hole.entityName === selectedEntityName;
	});

	// Sort holes by rowID first, then by posID within each row
	entityHoles.sort(function(a, b) {
		// First sort by rowID
		var rowDiff = (a.rowID || 0) - (b.rowID || 0);
		if (rowDiff !== 0) return rowDiff;

		// Then sort by posID within the same row
		return (a.posID || 0) - (b.posID || 0);
	});

	var startValue = startNumber.toString();
	var alphaMatch = startValue.match(/^([A-Z]+)(\d+)$/);
	var isAlphaNumerical = alphaMatch !== null;
	var canParseAsInt = !isNaN(parseInt(startValue)) && isFinite(startValue);

	if (isAlphaNumerical) {
		// ALPHA-NUMERICAL RENUMBERING BY ROW - Use rowID/posID structure
		console.log("Using alpha-numerical renumbering with rowID/posID structure starting at:", startValue);

		var startRowLetter = alphaMatch[1];
		var startHoleNumber = parseInt(alphaMatch[2]);

		// Group holes by rowID
		var rowGroups = new Map();
		entityHoles.forEach(function(hole) {
			var rowID = hole.rowID || 1;
			if (!rowGroups.has(rowID)) {
				rowGroups.set(rowID, []);
			}
			rowGroups.get(rowID).push(hole);
		});

		// Sort each row by posID
		rowGroups.forEach(function(holes) {
			holes.sort(function(a, b) {
				return (a.posID || 0) - (b.posID || 0);
			});
		});

		// Get sorted rowIDs
		var sortedRowIDs = Array.from(rowGroups.keys()).sort(function(a, b) {
			return a - b;
		});

		var currentRowLetter = startRowLetter;

		// Renumber each row
		sortedRowIDs.forEach(function(rowID) {
			var rowHoles = rowGroups.get(rowID);
			rowHoles.forEach(function(hole, posIndex) {
				var newHoleID = currentRowLetter + (startHoleNumber + posIndex);
				oldToNewHoleIDMap.set(hole.holeID, newHoleID);
				hole.holeID = newHoleID;
			});

			// Move to next row letter
			if (currentRowLetter === "Z") {
				currentRowLetter = "AA";
			} else if (currentRowLetter === "ZZ") {
				currentRowLetter = "AAA";
			} else {
				currentRowLetter = incrementLetter(currentRowLetter);
			}
		});
	} else {
		// NUMERICAL RENUMBERING - Respect rowID/posID order
		console.log("Using numerical renumbering with rowID/posID structure starting at:", startValue);

		var startNum = canParseAsInt ? parseInt(startValue) : 1;
		var currentNumber = startNum;

		entityHoles.forEach(function(hole) {
			oldToNewHoleIDMap.set(hole.holeID, currentNumber.toString());
			hole.holeID = currentNumber.toString();
			currentNumber++;
		});
	}

	// Update fromHoleID references
	allBlastHoles.forEach(function(hole) {
		if (hole.fromHoleID) {
			var parts = hole.fromHoleID.split(":::");
			var entity = parts[0];
			var oldHoleID = parts[1];
			if (entity === selectedEntityName && oldToNewHoleIDMap.has(oldHoleID)) {
				hole.fromHoleID = entity + ":::" + oldToNewHoleIDMap.get(oldHoleID);
			}
		}
	});

	// Trigger refresh and redraw
	if (window.refreshPoints) window.refreshPoints();
	if (window.drawData) window.drawData(window.allBlastHoles, window.selectedHole);
	console.log("Renumbered", entityHoles.length, "holes respecting rowID/posID structure");
}

// =============================================================================
// RENUMBER PATTERN AFTER CLIPPING
// =============================================================================

/**
 * Renumber holes after pattern clipping, detecting row orientation automatically
 * @param {string} entityName - Entity name to renumber
 */
export function renumberPatternAfterClipping(entityName) {
	var allBlastHoles = window.allBlastHoles || [];
	var entityHoles = allBlastHoles.filter(function(hole) {
		return hole.entityName === entityName;
	});

	if (entityHoles.length === 0) return;

	// Step 1: Automatically detect row orientation from the pattern
	var rowOrientation = 90; // Default to East (90) if can't determine

	if (entityHoles.length >= 2) {
		// Sort holes by Y coordinate to find potential row mates
		var sortedByY = entityHoles.slice().sort(function(a, b) {
			return b.startYLocation - a.startYLocation;
		});

		// Find the first two holes that are likely in the same row (similar Y coordinates)
		var tolerance = 2.0; // 2 meter tolerance for same row
		var firstRowHoles = [sortedByY[0]];

		for (var i = 1; i < sortedByY.length; i++) {
			if (Math.abs(sortedByY[i].startYLocation - sortedByY[0].startYLocation) <= tolerance) {
				firstRowHoles.push(sortedByY[i]);
			} else {
				break; // Found different row
			}
		}

		// If we have at least 2 holes in the same row, calculate row orientation
		if (firstRowHoles.length >= 2) {
			// Sort by X coordinate to get leftmost and rightmost holes in the row
			firstRowHoles.sort(function(a, b) {
				return a.startXLocation - b.startXLocation;
			});
			var leftHole = firstRowHoles[0];
			var rightHole = firstRowHoles[firstRowHoles.length - 1];

			// Calculate bearing from left to right hole
			var deltaX = rightHole.startXLocation - leftHole.startXLocation;
			var deltaY = rightHole.startYLocation - leftHole.startYLocation;

			rowOrientation = (90 - (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 360) % 360;
		}
	}

	console.log("Detected row orientation: " + rowOrientation + " for entity: " + entityName);

	// Step 2: Convert compass bearing to math radians for projections
	var rowBearingRadians = (90 - rowOrientation) * (Math.PI / 180);
	var burdenBearingRadians = rowBearingRadians - Math.PI / 2; // Perpendicular to row direction

	// Step 3: Project each hole onto the burden axis and spacing axis
	entityHoles.forEach(function(hole) {
		hole.burdenProjection = hole.startXLocation * Math.cos(burdenBearingRadians) + hole.startYLocation * Math.sin(burdenBearingRadians);
		hole.spacingProjection = hole.startXLocation * Math.cos(rowBearingRadians) + hole.startYLocation * Math.sin(rowBearingRadians);
	});

	// Step 4: Sort by burden projection, then by spacing projection
	entityHoles.sort(function(a, b) {
		var burdenDiff = Math.abs(a.burdenProjection - b.burdenProjection);
		if (burdenDiff > 1.5) {
			return b.burdenProjection - a.burdenProjection;
		}
		return a.spacingProjection - b.spacingProjection;
	});

	// Step 5: Group holes by rows using burden projection
	var rowTolerance = 2.0;
	var rows = [];

	if (entityHoles.length > 0) {
		var currentRow = [entityHoles[0]];
		var currentBurdenPos = entityHoles[0].burdenProjection;

		for (var j = 1; j < entityHoles.length; j++) {
			var hole = entityHoles[j];
			if (Math.abs(hole.burdenProjection - currentBurdenPos) <= rowTolerance) {
				currentRow.push(hole);
			} else {
				currentRow.sort(function(a, b) {
					return a.spacingProjection - b.spacingProjection;
				});
				rows.push(currentRow);
				currentRow = [hole];
				currentBurdenPos = hole.burdenProjection;
			}
		}

		if (currentRow.length > 0) {
			currentRow.sort(function(a, b) {
				return a.spacingProjection - b.spacingProjection;
			});
			rows.push(currentRow);
		}
	}

	// Step 6: Renumber starting from A1
	var rowLetter = "A";
	for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
		var row = rows[rowIndex];

		for (var pos = 0; pos < row.length; pos++) {
			var holeToRename = row[pos];
			var newHoleID = rowLetter + (pos + 1);

			// Update fromHoleID references
			allBlastHoles.forEach(function(h) {
				if (h.fromHoleID === entityName + ":::" + holeToRename.holeID) {
					h.fromHoleID = entityName + ":::" + newHoleID;
				}
			});

			holeToRename.holeID = newHoleID;
		}

		// Move to next row letter
		if (rowLetter === "Z") {
			rowLetter = "AA";
		} else if (rowLetter === "ZZ") {
			rowLetter = "AAA";
		} else {
			rowLetter = incrementLetter(rowLetter);
		}
	}

	// Step 7: Clean up temporary projection properties
	entityHoles.forEach(function(hole) {
		delete hole.burdenProjection;
		delete hole.spacingProjection;
	});

	console.log("Renumbered " + entityHoles.length + " holes in " + rows.length + " rows for entity: " + entityName);
}

// =============================================================================
// DELETE HOLE AND RENUMBER
// =============================================================================

/**
 * Delete a hole and renumber remaining holes in the same row
 * Supports both rowID/posID and alphanumeric holeID structures
 * @param {Object} holeToDelete - Hole object to delete
 */
export function deleteHoleAndRenumber(holeToDelete) {
	var allBlastHoles = window.allBlastHoles || [];
	var entityName = holeToDelete.entityName;
	var holeID = holeToDelete.holeID;
	var rowID = holeToDelete.rowID;
	var posID = holeToDelete.posID;
	var deletedCombinedID = entityName + ":::" + holeID;

	// Step 1: Find the hole in allBlastHoles and remove it
	var holeIndex = -1;
	for (var i = 0; i < allBlastHoles.length; i++) {
		if (allBlastHoles[i].entityName === entityName && allBlastHoles[i].holeID === holeID) {
			holeIndex = i;
			break;
		}
	}

	if (holeIndex !== -1) {
		allBlastHoles.splice(holeIndex, 1);
		console.log("Deleted hole:", entityName + ":" + holeID);

		// Clean up fromHoleID references - orphaned holes should reference themselves
		allBlastHoles.forEach(function(hole) {
			if (hole.fromHoleID === deletedCombinedID) {
				var selfReference = hole.entityName + ":::" + hole.holeID;
				console.log("Orphaned hole " + selfReference + " now references itself");
				hole.fromHoleID = selfReference;
			}
		});

		// Save to IndexedDB after deletion
		if (window.debouncedSaveHoles) window.debouncedSaveHoles();
	} else {
		console.warn("Hole not found for deletion:", entityName + ":" + holeID);
		return;
	}

	// Step 2: If rowID/posID exist, use rowID/posID logic
	if (rowID && posID) {
		var sameRowHoles = allBlastHoles.filter(function(hole) {
			return hole.entityName === entityName && hole.rowID === rowID && hole.posID > posID;
		});

		sameRowHoles.forEach(function(hole) {
			var oldHoleID = hole.holeID;
			hole.posID = hole.posID - 1;

			allBlastHoles.forEach(function(h) {
				if (h.fromHoleID === entityName + ":::" + oldHoleID) {
					h.fromHoleID = entityName + ":::" + hole.holeID;
				}
			});
		});

		console.log("Renumbered " + sameRowHoles.length + " holes in row " + rowID);
		return;
	}

	// Step 3: If not rowID/posID, check for alphanumeric holeID
	var alphaMatch = holeID && holeID.toString().match(/^([A-Z]+)(\d+)$/);
	var isAlphaNumerical = alphaMatch !== null;

	if (isAlphaNumerical) {
		var deletedRowLetter = alphaMatch[1];
		var deletedHoleNumber = parseInt(alphaMatch[2]);

		var sameRowAlphaHoles = allBlastHoles.filter(function(hole) {
			return hole.entityName === entityName && hole.holeID && hole.holeID.toString().startsWith(deletedRowLetter);
		});

		sameRowAlphaHoles.sort(function(a, b) {
			var aMatch = a.holeID.toString().match(/^[A-Z]+(\d+)$/);
			var bMatch = b.holeID.toString().match(/^[A-Z]+(\d+)$/);
			if (aMatch && bMatch) {
				return parseInt(aMatch[1]) - parseInt(bMatch[1]);
			}
			return 0;
		});

		sameRowAlphaHoles.forEach(function(hole) {
			var currentMatch = hole.holeID.toString().match(/^([A-Z]+)(\d+)$/);
			if (currentMatch) {
				var currentHoleNumber = parseInt(currentMatch[2]);
				if (currentHoleNumber > deletedHoleNumber) {
					var oldID = hole.holeID;
					var newID = deletedRowLetter + (currentHoleNumber - 1);
					hole.holeID = newID;

					allBlastHoles.forEach(function(h) {
						if (h.fromHoleID === entityName + ":::" + oldID) {
							h.fromHoleID = entityName + ":::" + newID;
						}
					});
				}
			}
		});

		console.log("Renumbered " + sameRowAlphaHoles.length + " holes in row " + deletedRowLetter);
	}

	// For numerical holes, no automatic renumbering on delete
}

// =============================================================================
// EXPOSE TO WINDOW
// =============================================================================

window.incrementLetter = incrementLetter;
window.renumberHolesFunction = renumberHolesFunction;
window.renumberPatternAfterClipping = renumberPatternAfterClipping;
window.deleteHoleAndRenumber = deleteHoleAndRenumber;
