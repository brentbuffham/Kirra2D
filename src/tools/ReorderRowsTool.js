// src/tools/ReorderRowsTool.js
//=============================================================
// INTERACTIVE REORDER ROWS TOOL
//=============================================================
// Workflow:
// 1. Click button -> Dialog to configure row tolerance
// 2. Click first hole -> green highlight, line follows mouse
// 3. Click second hole -> yellow highlight, line defines row direction
// 4. Perpendicular arrow shows burden direction (row increment)
// 5. All holes get rowID/posID assigned based on directions
// Created: 2026-02-01

// =============================================================================
// STATE VARIABLES
// =============================================================================

let isReorderRowsActive = false;
let reorderFirstHole = null;
let reorderSecondHole = null;
let reorderRowTolerance = 2.0; // meters - tolerance for grouping holes into rows
let reorderBurdenFlip = false; // false = burden direction is perpendicular left, true = right
let reorderCollectedHoles = [];
let reorderEntityName = null;
let reorderRenumberAfter = true; // Whether to renumber holes after reordering
let reorderStartValue = "1"; // Starting value for renumbering
let reorderPositionOrder = "current"; // "current", "serpentine", or "return"

// =============================================================================
// START MODE - SHOW DIALOG FIRST
// =============================================================================

/**
 * Start the interactive reorder rows mode
 * Shows dialog first to configure options, then enters click mode
 */
function startReorderRowsMode() {
	// Check if there are any holes
	var allBlastHoles = window.allBlastHoles || [];
	if (allBlastHoles.length === 0) {
		if (window.showModalMessage) {
			window.showModalMessage("No Holes", "There are no blast holes to reorder.");
		}
		return;
	}

	// Show configuration dialog first
	showReorderRowsConfigDialog();
}

/**
 * Show dialog to configure reorder options before clicking
 */
function showReorderRowsConfigDialog() {
	var fields = [
		{
			label: "Row Tolerance (m)",
			name: "rowTolerance",
			type: "number",
			value: reorderRowTolerance.toString(),
			step: "0.5",
			min: "0.5",
			max: "20",
			placeholder: "Distance to group holes into rows"
		},
		{
			label: "Position Order",
			name: "positionOrder",
			type: "select",
			options: [
				{ text: "Current (keep existing posID)", value: "current" },
				{ text: "Serpentine (alternate direction)", value: "serpentine" },
				{ text: "Return (same direction)", value: "return" }
			],
			value: reorderPositionOrder
		},
		{
			label: "Renumber holes after reorder",
			name: "renumberAfter",
			type: "checkbox",
			value: reorderRenumberAfter
		},
		{
			label: "Start Renumbering #",
			name: "startValue",
			type: "text",
			value: reorderStartValue,
			placeholder: "e.g., 1, 500, A1, B1"
		}
	];

	var formContent = window.createEnhancedFormContent(fields, false, false);

	// Add info text
	var infoDiv = document.createElement("div");
	infoDiv.style.cssText = "margin-top: 10px; padding: 8px; background: rgba(100,100,255,0.1); border-radius: 4px; font-size: 11px;";
	infoDiv.innerHTML = "<b>Current:</b> Only assigns row#, keeps existing posID<br>" +
		"<b>Serpentine:</b> Alternates pos direction each row<br>" +
		"<b>Return:</b> All rows same pos direction";
	formContent.appendChild(infoDiv);

	var dialog = new window.FloatingDialog({
		title: "Reorder Rows - Setup",
		content: formContent,
		layoutType: "default",
		showConfirm: true,
		showCancel: true,
		confirmText: "Start Selection",
		cancelText: "Cancel",
		width: 400,
		height: 380,
		onConfirm: function() {
			var formData = window.getFormData(formContent);
			reorderRowTolerance = parseFloat(formData.rowTolerance) || 2.0;
			reorderPositionOrder = formData.positionOrder || "current";
			reorderRenumberAfter = formData.renumberAfter === true || formData.renumberAfter === "true";
			reorderStartValue = formData.startValue || "1";

			dialog.close();
			activateReorderRowsClickMode();
		},
		onCancel: function() {
			// Don't activate mode
		}
	});
	dialog.show();
}

/**
 * Activate click mode after dialog configuration
 */
function activateReorderRowsClickMode() {
	// Initialize state
	isReorderRowsActive = true;
	window.isReorderRowsActive = true;
	reorderFirstHole = null;
	reorderSecondHole = null;
	reorderCollectedHoles = [];
	reorderBurdenFlip = false;
	reorderEntityName = null;
	window.reorderFirstHole = null;
	window.reorderSecondHole = null;

	// Deactivate other tools
	window.isSelectionPointerActive = false;
	window.isPolygonSelectionActive = false;

	// Uncheck selection tools
	var selectPointerTool = document.getElementById("selectPointer");
	if (selectPointerTool) selectPointerTool.checked = false;
	var selectByPolygonTool = document.getElementById("selectByPolygon");
	if (selectByPolygonTool) selectByPolygonTool.checked = false;

	// Ensure Holes selection mode is active
	var selectHolesRadio = document.getElementById("selectHoles");
	if (selectHolesRadio && !selectHolesRadio.checked) {
		selectHolesRadio.checked = true;
		selectHolesRadio.dispatchEvent(new Event("change"));
	}

	// Add click handler to 2D canvas only
	// NOTE: 3D clicks are handled by handle3DClick in kirra.js which calls handleReorderRowsClick
	var canvas = document.getElementById("canvas");
	if (canvas) {
		canvas.addEventListener("click", handleReorderRowsClick2D);
		canvas.addEventListener("touchstart", handleReorderRowsClick2D);
	}

	// Show button as active
	var reorderRowsBtn = document.getElementById("reorderRowsBtn");
	if (reorderRowsBtn) {
		reorderRowsBtn.classList.add("active");
	}

	// Turn on Row and Position display
	var rowAndPosDisplayBtn = document.getElementById("rowAndPosDisplayBtn");
	if (rowAndPosDisplayBtn && !rowAndPosDisplayBtn.checked) {
		rowAndPosDisplayBtn.checked = true;
		rowAndPosDisplayBtn.dispatchEvent(new Event("change"));
	}

	if (window.updateStatusMessage) {
		window.updateStatusMessage("Click first hole in row (Tolerance: " + reorderRowTolerance + "m)");
	}
	console.log("ReorderRows click mode activated - tolerance:", reorderRowTolerance);
}

// =============================================================================
// CLICK HANDLERS
// =============================================================================

/**
 * Internal click handler for ReorderRows mode (2D canvas only)
 * Note: 3D clicks are handled by handle3DClick in kirra.js which calls handleReorderRowsClick directly
 */
function handleReorderRowsClick2D(event) {
	if (!isReorderRowsActive) return;

	// Skip if in 3D mode - 3D clicks are handled by kirra.js
	if (window.onlyShowThreeJS) return;

	event.preventDefault();
	event.stopPropagation();

	// Get click coordinates
	var canvas = event.target;
	var rect = canvas.getBoundingClientRect();
	var clickX = event.clientX - rect.left;
	var clickY = event.clientY - rect.top;

	// 2D mode: use standard 2D selection
	var clickedHole = null;
	if (window.getClickedHole) {
		clickedHole = window.getClickedHole(clickX, clickY);
	}

	handleReorderRowsClick(clickedHole);
}

/**
 * Handle click during ReorderRows mode
 * @param {Object} clickedHole - The clicked hole object
 * @returns {boolean} - True if click was handled
 */
function handleReorderRowsClick(clickedHole) {
	console.log("🔵 [REORDER] handleReorderRowsClick called");
	console.log("  isReorderRowsActive:", isReorderRowsActive);
	console.log("  clickedHole:", clickedHole ? (clickedHole.holeID + " @ " + clickedHole.entityName) : "null");
	console.log("  reorderFirstHole:", reorderFirstHole ? (reorderFirstHole.holeID + " @ " + reorderFirstHole.entityName) : "null");
	console.log("  reorderSecondHole:", reorderSecondHole ? (reorderSecondHole.holeID + " @ " + reorderSecondHole.entityName) : "null");
	console.log("  onlyShowThreeJS:", window.onlyShowThreeJS);

	if (!isReorderRowsActive) {
		console.log("  ❌ Early exit: isReorderRowsActive is false");
		return false;
	}

	if (!reorderFirstHole) {
		// Step 1: Select first hole
		if (!clickedHole) {
			console.log("  ❌ No hole clicked for first selection");
			if (window.updateStatusMessage) {
				window.updateStatusMessage("Click on a hole to set as first in row");
			}
			return true;
		}

		reorderFirstHole = clickedHole;
		reorderEntityName = clickedHole.entityName;
		window.reorderFirstHole = clickedHole;

		if (window.updateStatusMessage) {
			window.updateStatusMessage("Click last hole in row - line shows row direction");
		}

		// Redraw to show green highlight
		if (window.drawData) {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}

		console.log("🟢 [REORDER] First hole selected -", clickedHole.holeID, "in", clickedHole.entityName);
		return true;

	} else if (!reorderSecondHole) {
		// Step 2: Select second hole
		console.log("  Checking second hole selection...");

		if (!clickedHole) {
			console.log("  ❌ No hole clicked for second selection");
			if (window.updateStatusMessage) {
				window.updateStatusMessage("Click on a hole to set as last in row");
			}
			return true;
		}

		// Compare by ID instead of reference for 3D compatibility
		var isSameHole = (clickedHole.entityName === reorderFirstHole.entityName &&
		                  clickedHole.holeID === reorderFirstHole.holeID);
		console.log("  isSameHole check:", isSameHole,
			"(clicked:", clickedHole.entityName + ":::" + clickedHole.holeID,
			"vs first:", reorderFirstHole.entityName + ":::" + reorderFirstHole.holeID + ")");

		if (isSameHole) {
			console.log("  ❌ Same hole as first - skipping");
			if (window.updateStatusMessage) {
				window.updateStatusMessage("Please select a different hole");
			}
			return true;
		}

		// Must be same entity
		if (clickedHole.entityName !== reorderEntityName) {
			console.log("  ❌ Different entity:", clickedHole.entityName, "vs", reorderEntityName);
			if (window.updateStatusMessage) {
				window.updateStatusMessage("Select a hole from the same entity: " + reorderEntityName);
			}
			return true;
		}

		reorderSecondHole = clickedHole;
		window.reorderSecondHole = clickedHole;

		if (window.updateStatusMessage) {
			window.updateStatusMessage("Arrow shows burden direction. Click arrow to flip, or press Enter to confirm, Escape to cancel.");
		}

		// Redraw to show yellow highlight and arrow
		if (window.drawData) {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}

		// Show confirmation dialog
		console.log("🟡 [REORDER] Second hole selected -", clickedHole.holeID, "- showing dialog");
		showReorderConfirmDialog();

		return true;
	}

	console.log("  ❌ Unhandled state - returning false");
	return false;
}

/**
 * Show confirmation dialog with flip option
 */
function showReorderConfirmDialog() {
	var rowDirection = getRowDirectionInfo();

	var content = document.createElement("div");
	content.innerHTML =
		"<p><b>Row Direction:</b> " + rowDirection.bearing.toFixed(1) + "°</p>" +
		"<p><b>Burden Direction:</b> " + rowDirection.burdenBearing.toFixed(1) + "° " +
		(reorderBurdenFlip ? "(flipped)" : "") + "</p>" +
		"<p style='font-size:11px; color:#888;'>Rows will be numbered from burden direction.<br>" +
		"Position 1 is at the first hole clicked.</p>";

	var flipBtn = document.createElement("button");
	flipBtn.textContent = "Flip Burden Direction";
	flipBtn.style.cssText = "margin-top: 10px; padding: 8px 16px; cursor: pointer; width: 100%;";
	flipBtn.onclick = function() {
		reorderBurdenFlip = !reorderBurdenFlip;
		console.log("🔄 [REORDER] Burden flipped to:", reorderBurdenFlip);
		// Update dialog content
		var newInfo = getRowDirectionInfo();
		content.querySelector("p:nth-child(2)").innerHTML =
			"<b>Burden Direction:</b> " + newInfo.burdenBearing.toFixed(1) + "° " +
			(reorderBurdenFlip ? "(flipped)" : "");
		// Force 3D rebuild and redraw to update arrow
		window.threeDataNeedsRebuild = true;
		if (window.drawData) {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}
	};
	content.appendChild(flipBtn);

	var dialog = new window.FloatingDialog({
		title: "Confirm Row Reorder",
		content: content,
		layoutType: "default",
		showConfirm: true,
		showCancel: true,
		confirmText: "Apply",
		cancelText: "Cancel",
		width: 320,
		height: 250,
		onConfirm: function() {
			dialog.close();
			executeReorderRows();
			cancelReorderRowsMode();
		},
		onCancel: function() {
			dialog.close();
			cancelReorderRowsMode();
		}
	});
	dialog.show();
}

// =============================================================================
// ROW DIRECTION CALCULATION
// =============================================================================

/**
 * Get row direction info based on first and second hole
 */
function getRowDirectionInfo() {
	if (!reorderFirstHole || !reorderSecondHole) {
		return { bearing: 0, burdenBearing: 90, dirX: 1, dirY: 0, perpX: 0, perpY: 1, burdenFlip: reorderBurdenFlip };
	}

	var dx = reorderSecondHole.startXLocation - reorderFirstHole.startXLocation;
	var dy = reorderSecondHole.startYLocation - reorderFirstHole.startYLocation;
	var length = Math.sqrt(dx * dx + dy * dy);

	if (length < 0.001) {
		return { bearing: 0, burdenBearing: 90, dirX: 1, dirY: 0, perpX: 0, perpY: 1, burdenFlip: reorderBurdenFlip };
	}

	// Normalize direction
	var dirX = dx / length;
	var dirY = dy / length;

	// Calculate bearing (0 = North, 90 = East, etc.)
	var bearing = Math.atan2(dx, dy) * (180 / Math.PI);
	if (bearing < 0) bearing += 360;

	// Perpendicular direction (burden direction)
	// Default: 90 degrees clockwise from row direction
	var perpX = reorderBurdenFlip ? -dirY : dirY;
	var perpY = reorderBurdenFlip ? dirX : -dirX;

	var burdenBearing = bearing + (reorderBurdenFlip ? -90 : 90);
	if (burdenBearing < 0) burdenBearing += 360;
	if (burdenBearing >= 360) burdenBearing -= 360;

	return {
		bearing: bearing,
		burdenBearing: burdenBearing,
		dirX: dirX,
		dirY: dirY,
		perpX: perpX,
		perpY: perpY,
		length: length,
		burdenFlip: reorderBurdenFlip
	};
}

// =============================================================================
// EXECUTE REORDER
// =============================================================================

/**
 * Execute the row reordering on all holes in the entity
 */
function executeReorderRows() {
	var allBlastHoles = window.allBlastHoles || [];
	var entityHoles = allBlastHoles.filter(function(h) {
		return h.entityName === reorderEntityName;
	});

	if (entityHoles.length === 0) {
		if (window.showModalMessage) {
			window.showModalMessage("No Holes", "No holes found in entity.");
		}
		return;
	}

	var info = getRowDirectionInfo();

	// Project each hole onto the row direction and burden direction
	// Row direction: perpendicular component determines row number
	// Position direction: parallel component determines position in row
	var origin = {
		x: reorderFirstHole.startXLocation,
		y: reorderFirstHole.startYLocation
	};

	entityHoles.forEach(function(hole) {
		// Vector from origin to hole
		var vx = hole.startXLocation - origin.x;
		var vy = hole.startYLocation - origin.y;

		// Project onto burden direction (perpendicular) to get row position
		var burdenDist = vx * info.perpX + vy * info.perpY;

		// Project onto row direction (parallel) to get position in row
		var rowDist = vx * info.dirX + vy * info.dirY;

		// Store for sorting
		hole._burdenDist = burdenDist;
		hole._rowDist = rowDist;
	});

	// Group holes into rows based on burden distance
	var rows = [];
	var sortedByBurden = entityHoles.slice().sort(function(a, b) {
		return a._burdenDist - b._burdenDist;
	});

	var currentRow = [sortedByBurden[0]];
	var currentBurdenDist = sortedByBurden[0]._burdenDist;

	for (var i = 1; i < sortedByBurden.length; i++) {
		var hole = sortedByBurden[i];
		if (Math.abs(hole._burdenDist - currentBurdenDist) <= reorderRowTolerance) {
			// Same row
			currentRow.push(hole);
		} else {
			// New row
			rows.push(currentRow);
			currentRow = [hole];
			currentBurdenDist = hole._burdenDist;
		}
	}
	rows.push(currentRow); // Don't forget the last row

	// Sort holes within each row based on position order mode
	if (reorderPositionOrder === "current") {
		// Current: Sort by existing posID to preserve order
		rows.forEach(function(row) {
			row.sort(function(a, b) {
				return (a.posID || 0) - (b.posID || 0);
			});
		});
	} else if (reorderPositionOrder === "serpentine") {
		// Serpentine: Sort by row distance, reverse for even rows
		rows.forEach(function(row, rowIndex) {
			row.sort(function(a, b) {
				return a._rowDist - b._rowDist;
			});
			// Reverse even rows (0-indexed, so rows 1, 3, 5... are even indices)
			if (rowIndex % 2 === 1) {
				row.reverse();
			}
		});
	} else {
		// Return: Sort by row distance, same direction for all rows
		rows.forEach(function(row) {
			row.sort(function(a, b) {
				return a._rowDist - b._rowDist;
			});
		});
	}

	// Assign rowID and posID
	var totalHoles = 0;
	var idRemapMap = new Map();
	var firstHoleID = null;
	var lastHoleID = null;

	// Parse start value for renumbering
	var format = null;
	if (reorderRenumberAfter) {
		format = parseStartValue(reorderStartValue);
	}

	var holeIndex = 0;
	rows.forEach(function(row, rowIndex) {
		var rowID = rowIndex + 1;
		row.forEach(function(hole, posIndex) {
			hole.rowID = rowID;
			// For "current" mode, preserve existing posID; otherwise assign new posID
			if (reorderPositionOrder !== "current") {
				hole.posID = posIndex + 1;
			}

			// Renumber holeID if enabled
			if (reorderRenumberAfter && format) {
				var oldHoleID = hole.holeID;
				var newHoleID = generateHoleID(format, holeIndex);

				// Store mapping for connection remapping
				if (oldHoleID !== newHoleID) {
					idRemapMap.set(reorderEntityName + ":::" + oldHoleID, reorderEntityName + ":::" + newHoleID);
				}

				hole.holeID = newHoleID;

				if (holeIndex === 0) firstHoleID = newHoleID;
				lastHoleID = newHoleID;
			}

			holeIndex++;
			totalHoles++;

			// Clean up temp properties
			delete hole._burdenDist;
			delete hole._rowDist;
		});
	});

	// Remap connections if renumbering was done
	if (reorderRenumberAfter && idRemapMap.size > 0) {
		var connectionsRemapped = 0;
		allBlastHoles.forEach(function(hole) {
			if (hole.fromHoleID && idRemapMap.has(hole.fromHoleID)) {
				hole.fromHoleID = idRemapMap.get(hole.fromHoleID);
				connectionsRemapped++;
			}
		});
		if (connectionsRemapped > 0) {
			console.log("ReorderRows: Remapped", connectionsRemapped, "connections");
		}

		// Remap charging keys to follow hole ID changes
		if (window.remapChargingKeys && window.extractPlainIdRemap) {
			var plainRemap = window.extractPlainIdRemap(idRemapMap);
			window.remapChargingKeys(plainRemap);
		}
	}

	console.log("ReorderRows: Assigned", totalHoles, "holes to", rows.length, "rows" +
		(reorderRenumberAfter ? ", renumbered " + firstHoleID + " to " + lastHoleID : ""));

	// Save and refresh
	if (window.debouncedSaveHoles) {
		window.debouncedSaveHoles();
	}
	if (window.debouncedUpdateTreeView) {
		window.debouncedUpdateTreeView();
	}

	// Force 3D rebuild to update hole labels/IDs
	window.threeDataNeedsRebuild = true;

	if (window.updateStatusMessage) {
		var msg = "Reordered " + totalHoles + " holes into " + rows.length + " rows";
		if (reorderRenumberAfter && firstHoleID && lastHoleID) {
			msg += " (" + firstHoleID + " → " + lastHoleID + ")";
		}
		window.updateStatusMessage(msg);
		setTimeout(function() {
			if (window.updateStatusMessage) window.updateStatusMessage("");
		}, 3000);
	}
}

// =============================================================================
// NUMBERING FORMAT HELPERS (same as RenumberHolesTool)
// =============================================================================

/**
 * Parse the start value to determine numbering format
 */
function parseStartValue(startValue) {
	var alphaMatch = startValue.match(/^([A-Za-z]+)(\d+)$/);
	if (alphaMatch) {
		return {
			isAlphaNumeric: true,
			letterPrefix: alphaMatch[1].toUpperCase(),
			startNumber: parseInt(alphaMatch[2])
		};
	}

	var numericValue = parseInt(startValue);
	if (!isNaN(numericValue)) {
		return {
			isAlphaNumeric: false,
			letterPrefix: "",
			startNumber: numericValue
		};
	}

	return {
		isAlphaNumeric: false,
		letterPrefix: "",
		startNumber: 1
	};
}

/**
 * Generate holeID based on format and index
 */
function generateHoleID(format, index) {
	var number = format.startNumber + index;
	if (format.isAlphaNumeric) {
		return format.letterPrefix + number;
	}
	return number.toString();
}

// =============================================================================
// CANCEL MODE
// =============================================================================

/**
 * Cancel the interactive reorder rows mode
 */
function cancelReorderRowsMode() {
	isReorderRowsActive = false;
	reorderFirstHole = null;
	reorderSecondHole = null;
	reorderCollectedHoles = [];
	reorderEntityName = null;
	reorderBurdenFlip = false;

	window.reorderFirstHole = null;
	window.reorderSecondHole = null;
	window.isReorderRowsActive = false;

	// Remove click handlers from 2D canvas
	// NOTE: 3D clicks are handled by handle3DClick in kirra.js
	var canvas = document.getElementById("canvas");
	if (canvas) {
		canvas.removeEventListener("click", handleReorderRowsClick2D);
		canvas.removeEventListener("touchstart", handleReorderRowsClick2D);
	}

	// Remove button active state
	var reorderRowsBtn = document.getElementById("reorderRowsBtn");
	if (reorderRowsBtn) {
		reorderRowsBtn.classList.remove("active");
	}

	if (window.updateStatusMessage) {
		window.updateStatusMessage("");
	}

	if (window.drawData) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	console.log("ReorderRows mode ended");
}

// =============================================================================
// DRAWING HELPERS
// =============================================================================

/**
 * Check if hole is the first selected hole in ReorderRows mode
 */
function isReorderRowsFirstHole(hole) {
	return isReorderRowsActive && reorderFirstHole && reorderFirstHole === hole;
}

/**
 * Check if hole is the second selected hole in ReorderRows mode
 */
function isReorderRowsSecondHole(hole) {
	return isReorderRowsActive && reorderSecondHole && reorderSecondHole === hole;
}

/**
 * Get the row line info for drawing
 */
function getReorderRowsLineInfo() {
	if (!isReorderRowsActive || !reorderFirstHole) {
		return null;
	}

	var endX, endY;
	if (reorderSecondHole) {
		endX = reorderSecondHole.startXLocation;
		endY = reorderSecondHole.startYLocation;
	} else {
		endX = window.currentMouseWorldX || reorderFirstHole.startXLocation;
		endY = window.currentMouseWorldY || reorderFirstHole.startYLocation;
	}

	return {
		startX: reorderFirstHole.startXLocation,
		startY: reorderFirstHole.startYLocation,
		endX: endX,
		endY: endY,
		showArrow: reorderSecondHole !== null,
		burdenFlip: reorderBurdenFlip
	};
}

// =============================================================================
// EXPOSE TO WINDOW
// =============================================================================

window.isReorderRowsActive = false;
window.reorderFirstHole = null;
window.reorderSecondHole = null;
window.startReorderRowsMode = startReorderRowsMode;
window.handleReorderRowsClick = handleReorderRowsClick;
window.cancelReorderRowsMode = cancelReorderRowsMode;
window.isReorderRowsFirstHole = isReorderRowsFirstHole;
window.isReorderRowsSecondHole = isReorderRowsSecondHole;
window.getReorderRowsLineInfo = getReorderRowsLineInfo;
window.getRowDirectionInfo = getRowDirectionInfo;

export {
	startReorderRowsMode,
	handleReorderRowsClick,
	cancelReorderRowsMode,
	isReorderRowsFirstHole,
	isReorderRowsSecondHole,
	getReorderRowsLineInfo,
	getRowDirectionInfo
};
