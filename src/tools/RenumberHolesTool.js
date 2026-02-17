// src/tools/RenumberHolesTool.js
//=============================================================
// INTERACTIVE RENUMBER HOLES TOOL
//=============================================================
// Workflow:
// 1. Click button -> Dialog to set zone width, starting number, row ID
// 2. Click first hole -> green highlight, stadium zone follows mouse
// 3. Click second hole -> yellow highlight, holes collected and renumbered
// Created: 2026-02-01

// =============================================================================
// STATE VARIABLES
// =============================================================================

let isRenumberHolesActive = false;
let renumberFirstHole = null;
let renumberSecondHole = null;
let renumberZoneWidth = 1.5; // meters
let renumberStartValue = "1";
let renumberRowId = null;
let renumberCollectedHoles = [];
let renumberMode = "rowOnly"; // "rowOnly" or "allHoles"

// =============================================================================
// START MODE - SHOW DIALOG FIRST
// =============================================================================

/**
 * Start the interactive renumber holes mode
 * Shows dialog first to configure options, then enters click mode
 */
function startRenumberHolesMode() {
	// Check if there are any holes
	var allBlastHoles = window.allBlastHoles || [];
	if (allBlastHoles.length === 0) {
		if (window.showModalMessage) {
			window.showModalMessage("No Holes", "There are no blast holes to renumber.");
		}
		return;
	}

	// Show configuration dialog first
	showRenumberConfigDialog();
}

/**
 * Show dialog to configure renumber options before clicking
 */
function showRenumberConfigDialog() {
	var fields = [
		{
			label: "Renumber Mode",
			name: "renumberMode",
			type: "select",
			options: [
				{ text: "Renumber Row from #", value: "rowOnly" },
				{ text: "Renumber All from #", value: "allHoles" }
			],
			value: renumberMode
		},
		{
			label: "Start Renumbering #",
			name: "startValue",
			type: "text",
			value: renumberStartValue,
			placeholder: "e.g., 1, 500, A1, B1"
		},
		{
			label: "Zone Width (m)",
			name: "zoneWidth",
			type: "number",
			value: renumberZoneWidth.toString(),
			step: "0.5",
			min: "0.5",
			max: "50"
		},
		{
			label: "Row ID to assign",
			name: "rowId",
			type: "number",
			value: "1",
			placeholder: "Row number for selected holes"
		}
	];

	var formContent = window.createEnhancedFormContent(fields, false, false);

	// Add info text
	var infoDiv = document.createElement("div");
	infoDiv.style.cssText = "margin-top: 10px; padding: 8px; background: rgba(100,100,255,0.1); border-radius: 4px; font-size: 11px;";
	infoDiv.innerHTML = "<b>Row from #:</b> Renumber only selected holes from start value<br><b>All from #:</b> Reposition selected holes to row, then renumber ALL holes<br>Connections are automatically remapped.";
	formContent.appendChild(infoDiv);

	var dialog = new window.FloatingDialog({
		title: "Renumber Holes - Setup",
		content: formContent,
		layoutType: "default",
		showConfirm: true,
		showCancel: true,
		confirmText: "Start Selection",
		cancelText: "Cancel",
		width: 400,
		height: 320,
		onConfirm: function() {
			var formData = window.getFormData(formContent);
			renumberMode = formData.renumberMode || "rowOnly";
			renumberStartValue = formData.startValue || "1";
			renumberZoneWidth = parseFloat(formData.zoneWidth) || 1.5;
			renumberRowId = formData.rowId ? parseInt(formData.rowId) : 1;

			dialog.close();
			activateRenumberClickMode();
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
function activateRenumberClickMode() {
	// Initialize state
	isRenumberHolesActive = true;
	window.isRenumberHolesActive = true;
	renumberFirstHole = null;
	renumberSecondHole = null;
	renumberCollectedHoles = [];
	window.renumberFirstHole = null;
	window.renumberSecondHole = null;

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
	// NOTE: 3D clicks are handled by handle3DClick in kirra.js which calls handleRenumberHolesClick
	var canvas = document.getElementById("canvas");
	if (canvas) {
		canvas.addEventListener("click", handleRenumberClick);
		canvas.addEventListener("touchstart", handleRenumberClick);
	}

	// Show button as active
	var renumberHolesBtn = document.getElementById("renumberHolesBtn");
	if (renumberHolesBtn) {
		renumberHolesBtn.classList.add("active");
	}

	// Turn on Row and Position display when tool is active
	var rowAndPosDisplayBtn = document.getElementById("rowAndPosDisplayBtn");
	if (rowAndPosDisplayBtn && !rowAndPosDisplayBtn.checked) {
		rowAndPosDisplayBtn.checked = true;
		rowAndPosDisplayBtn.dispatchEvent(new Event("change"));
	}

	if (window.updateStatusMessage) {
		var modeText = renumberMode === "allHoles" ? "All holes" : "Row " + renumberRowId;
		window.updateStatusMessage("Click first hole (" + modeText + " from " + renumberStartValue + ", Zone: " + renumberZoneWidth + "m)");
	}
	console.log("RenumberHoles click mode activated - mode:", renumberMode, "start:", renumberStartValue, "zone:", renumberZoneWidth, "row:", renumberRowId);
}

/**
 * Internal click handler for RenumberHoles mode (2D canvas only)
 * Note: 3D clicks are handled by handle3DClick in kirra.js which calls handleRenumberHolesClick directly
 */
function handleRenumberClick(event) {
	if (!isRenumberHolesActive) return;

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

	handleRenumberHolesClick(clickedHole);
}

// =============================================================================
// HANDLE CLICK
// =============================================================================

/**
 * Handle click during RenumberHoles mode
 * @param {Object} clickedHole - The clicked hole object
 * @returns {boolean} - True if click was handled
 */
function handleRenumberHolesClick(clickedHole) {
	console.log("🔵 [RENUMBER] handleRenumberHolesClick called");
	console.log("  isRenumberHolesActive:", isRenumberHolesActive);
	console.log("  clickedHole:", clickedHole ? (clickedHole.holeID + " @ " + clickedHole.entityName) : "null");
	console.log("  renumberFirstHole:", renumberFirstHole ? (renumberFirstHole.holeID + " @ " + renumberFirstHole.entityName) : "null");
	console.log("  onlyShowThreeJS:", window.onlyShowThreeJS);

	if (!isRenumberHolesActive) {
		console.log("  ❌ Early exit: isRenumberHolesActive is false");
		return false;
	}

	if (!renumberFirstHole) {
		// Step 1: Select first hole
		if (!clickedHole) {
			console.log("  ❌ No hole clicked for first selection");
			if (window.updateStatusMessage) {
				window.updateStatusMessage("Click on a hole to set as first in sequence");
			}
			return true;
		}

		renumberFirstHole = clickedHole;
		window.renumberFirstHole = clickedHole;

		if (window.updateStatusMessage) {
			window.updateStatusMessage("Click last hole - stadium zone shows collection area");
		}

		// Redraw to show green highlight
		if (window.drawData) {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}

		console.log("🟢 [RENUMBER] First hole selected -", clickedHole.holeID, "in", clickedHole.entityName);
		return true;

	} else {
		// Step 2: Select second hole - execute immediately
		console.log("  Checking second hole selection...");

		if (!clickedHole) {
			console.log("  ❌ No hole clicked for second selection");
			if (window.updateStatusMessage) {
				window.updateStatusMessage("Click on a hole to set as last in sequence");
			}
			return true;
		}

		// Compare by ID instead of reference for 3D compatibility
		var isSameHole = (clickedHole.entityName === renumberFirstHole.entityName &&
		                  clickedHole.holeID === renumberFirstHole.holeID);
		console.log("  isSameHole check:", isSameHole,
			"(clicked:", clickedHole.entityName + ":::" + clickedHole.holeID,
			"vs first:", renumberFirstHole.entityName + ":::" + renumberFirstHole.holeID + ")");

		if (isSameHole) {
			console.log("  ❌ Same hole as first - skipping");
			if (window.updateStatusMessage) {
				window.updateStatusMessage("Please select a different hole as the last hole");
			}
			return true;
		}

		renumberSecondHole = clickedHole;
		window.renumberSecondHole = clickedHole;

		// Collect holes in the stadium zone
		renumberCollectedHoles = getHolesInStadiumZone(renumberFirstHole, renumberSecondHole, renumberZoneWidth);

		console.log("🟡 [RENUMBER] Second hole selected -", clickedHole.holeID, "in", clickedHole.entityName);
		console.log("🟡 [RENUMBER] Collected", renumberCollectedHoles.length, "holes in zone");

		// Check for ID conflicts before renumbering
		var conflict = checkForIdConflicts(renumberCollectedHoles, renumberStartValue);
		if (conflict) {
			console.log("  ❌ ID conflict detected:", conflict);
			if (window.showModalMessage) {
				window.showModalMessage("ID Conflict", conflict);
			}
			cancelRenumberHolesMode();
			return true;
		}

		// Execute renumbering immediately
		console.log("🚀 [RENUMBER] Executing renumber...");
		executeRenumberHoles();

		// Done - cancel mode
		cancelRenumberHolesMode();
		console.log("✅ [RENUMBER] Complete");
		return true;
	}
}

// =============================================================================
// GET HOLES IN STADIUM ZONE
// =============================================================================

/**
 * Get all holes within the stadium zone between two holes
 * @param {Object} startHole - First hole
 * @param {Object} endHole - Second hole
 * @param {number} tolerance - Zone width in meters
 * @returns {Array} - Holes within the zone, sorted by distance from first hole
 */
function getHolesInStadiumZone(startHole, endHole, tolerance) {
	var allBlastHoles = window.allBlastHoles || [];
	var holesInZone = [];

	var dx = endHole.startXLocation - startHole.startXLocation;
	var dy = endHole.startYLocation - startHole.startYLocation;
	var length = Math.sqrt(dx * dx + dy * dy);

	if (length < 0.001) {
		return [startHole, endHole];
	}

	var dirX = dx / length;
	var dirY = dy / length;

	for (var i = 0; i < allBlastHoles.length; i++) {
		var hole = allBlastHoles[i];

		var vecX = hole.startXLocation - startHole.startXLocation;
		var vecY = hole.startYLocation - startHole.startYLocation;

		var dotProduct = vecX * dirX + vecY * dirY;

		if (dotProduct >= -tolerance && dotProduct <= length + tolerance) {
			var distanceToLine = Math.abs(vecX * dirY - vecY * dirX);

			if (distanceToLine <= tolerance) {
				holesInZone.push(hole);
			}
		}
	}

	// Sort by distance from first hole
	holesInZone.sort(function(a, b) {
		var distA = Math.sqrt(
			Math.pow(a.startXLocation - startHole.startXLocation, 2) +
			Math.pow(a.startYLocation - startHole.startYLocation, 2)
		);
		var distB = Math.sqrt(
			Math.pow(b.startXLocation - startHole.startXLocation, 2) +
			Math.pow(b.startYLocation - startHole.startYLocation, 2)
		);
		return distA - distB;
	});

	return holesInZone;
}

// =============================================================================
// NUMBERING FORMAT HELPERS
// =============================================================================

/**
 * Parse the start value to determine numbering format
 * Returns { isAlphaNumeric, letterPrefix, startNumber }
 */
function parseStartValue(startValue) {
	// Check for alphanumeric format like A1, B1, AA1, etc.
	var alphaMatch = startValue.match(/^([A-Za-z]+)(\d+)$/);
	if (alphaMatch) {
		return {
			isAlphaNumeric: true,
			letterPrefix: alphaMatch[1].toUpperCase(),
			startNumber: parseInt(alphaMatch[2])
		};
	}

	// Pure numeric format
	var numericValue = parseInt(startValue);
	if (!isNaN(numericValue)) {
		return {
			isAlphaNumeric: false,
			letterPrefix: "",
			startNumber: numericValue
		};
	}

	// Default fallback
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
// CHECK FOR ID CONFLICTS
// =============================================================================

/**
 * Check if renumbering would create duplicate IDs
 * @param {Array} holesToRenumber - Holes that will be renumbered
 * @param {string} startValue - Starting number/ID
 * @returns {string|null} - Error message if conflict, null if OK
 */
function checkForIdConflicts(holesToRenumber, startValue) {
	var allBlastHoles = window.allBlastHoles || [];
	var newIds = [];
	var entityName = holesToRenumber.length > 0 ? holesToRenumber[0].entityName : null;

	// Parse the start value to determine format
	var format = parseStartValue(startValue);

	if (renumberMode === "allHoles") {
		// "Renumber All" mode - ALL holes in entity get renumbered, so no conflicts possible
		// within the entity (all IDs will be new)
		return null;
	} else {
		// "Renumber Row" mode - check for conflicts with holes NOT being renumbered
		for (var j = 0; j < holesToRenumber.length; j++) {
			newIds.push(generateHoleID(format, j));
		}
	}

	// Get entity name from first hole (assuming all holes in selection are same entity)
	var entityName = holesToRenumber.length > 0 ? holesToRenumber[0].entityName : null;

	// Check if any new IDs conflict with existing holes NOT in the renumber set
	var holesToRenumberSet = new Set(holesToRenumber);
	var existingIds = new Set();

	for (var k = 0; k < allBlastHoles.length; k++) {
		var hole = allBlastHoles[k];
		// Only check holes in the same entity that are NOT being renumbered
		if (hole.entityName === entityName && !holesToRenumberSet.has(hole)) {
			existingIds.add(hole.holeID);
		}
	}

	// Check for conflicts
	var conflicts = [];
	for (var m = 0; m < newIds.length; m++) {
		if (existingIds.has(newIds[m])) {
			conflicts.push(newIds[m]);
		}
	}

	if (conflicts.length > 0) {
		return "The following IDs already exist in entity '" + entityName + "': " + conflicts.join(", ") +
			"\n\nPlease choose a different starting number to avoid duplicates.";
	}

	return null;
}

// =============================================================================
// EXECUTE RENUMBER
// =============================================================================

/**
 * Execute the renumbering on collected holes
 * Mode "sequential": Uses start value to determine holeID format (numeric or alphanumeric)
 * Mode "rowBased": Uses RowLetter + PosID (e.g., A1, A2, B1, B2)
 */
function executeRenumberHoles() {
	if (renumberCollectedHoles.length === 0) {
		if (window.showModalMessage) {
			window.showModalMessage("No Holes", "No holes were collected in the zone.");
		}
		return;
	}

	var allBlastHoles = window.allBlastHoles || [];
	var entityName = renumberCollectedHoles[0].entityName;
	var targetRowId = renumberRowId || 1;
	var format = parseStartValue(renumberStartValue);

	// Map to track old holeID -> new holeID for connection remapping
	var idRemapMap = new Map();
	var firstHoleID, lastHoleID;
	var totalRenumbered = 0;

	if (renumberMode === "allHoles") {
		// ============================================================
		// "Renumber All from #" - Reposition stadium holes, then renumber ALL holes
		// ============================================================
		// 1. Stadium-selected holes get repositioned (new rowID and posIDs based on selection order)
		// 2. ALL holes in entity get renumbered from start value, sorted by row then position

		// Step 1: Find max posID in target row (excluding stadium-selected holes)
		var renumberSet = new Set(renumberCollectedHoles);
		var maxPosIdInRow = 0;

		allBlastHoles.forEach(function(hole) {
			if (hole.entityName === entityName &&
				hole.rowID === targetRowId &&
				!renumberSet.has(hole)) {
				if (hole.posID && hole.posID > maxPosIdInRow) {
					maxPosIdInRow = hole.posID;
				}
			}
		});

		// Step 2: Assign new rowID and posID to stadium-selected holes
		var startPosId = maxPosIdInRow + 1;
		renumberCollectedHoles.forEach(function(hole, index) {
			hole.rowID = targetRowId;
			hole.posID = startPosId + index;
		});

		// Step 3: Get all holes in the same entity and sort by row then position
		var entityHoles = allBlastHoles.filter(function(h) {
			return h.entityName === entityName;
		});

		if (entityHoles.length === 0) {
			if (window.showModalMessage) {
				window.showModalMessage("No Holes", "No holes found in entity.");
			}
			return;
		}

		// Sort by rowID first, then by posID
		entityHoles.sort(function(a, b) {
			var rowA = a.rowID || 0;
			var rowB = b.rowID || 0;
			if (rowA !== rowB) return rowA - rowB;
			var posA = a.posID || 0;
			var posB = b.posID || 0;
			return posA - posB;
		});

		// Step 4: Renumber all holes sequentially
		entityHoles.forEach(function(hole, index) {
			var oldHoleID = hole.holeID;
			var newHoleID = generateHoleID(format, index);

			// Store mapping for connection remapping
			if (oldHoleID !== newHoleID) {
				idRemapMap.set(entityName + ":::" + oldHoleID, entityName + ":::" + newHoleID);
			}

			hole.holeID = newHoleID;
		});

		firstHoleID = generateHoleID(format, 0);
		lastHoleID = generateHoleID(format, entityHoles.length - 1);
		totalRenumbered = entityHoles.length;

		console.log("Repositioned", renumberCollectedHoles.length, "holes to row " + targetRowId +
			", then renumbered ALL", totalRenumbered, "holes: " + firstHoleID + " to " + lastHoleID);

	} else {
		// ============================================================
		// "Renumber Row from #" - Only renumber selected holes in stadium zone
		// ============================================================

		// Find the max posID currently in this row (excluding holes we're about to renumber)
		var renumberSet = new Set(renumberCollectedHoles);
		var maxPosIdInRow = 0;

		allBlastHoles.forEach(function(hole) {
			if (hole.entityName === entityName &&
				hole.rowID === targetRowId &&
				!renumberSet.has(hole)) {
				if (hole.posID && hole.posID > maxPosIdInRow) {
					maxPosIdInRow = hole.posID;
				}
			}
		});

		// Starting posID for our selection
		var startPosId = maxPosIdInRow + 1;

		// Renumber collected holes
		renumberCollectedHoles.forEach(function(hole, index) {
			var oldHoleID = hole.holeID;
			var newPosId = startPosId + index;
			var newHoleID = generateHoleID(format, index);

			// Store mapping for connection remapping
			if (oldHoleID !== newHoleID) {
				idRemapMap.set(entityName + ":::" + oldHoleID, entityName + ":::" + newHoleID);
			}

			hole.rowID = targetRowId;
			hole.posID = newPosId;
			hole.holeID = newHoleID;
		});

		firstHoleID = generateHoleID(format, 0);
		lastHoleID = generateHoleID(format, renumberCollectedHoles.length - 1);
		totalRenumbered = renumberCollectedHoles.length;

		console.log("Renumbered", totalRenumbered, "holes in row " + targetRowId + ": " +
			firstHoleID + " to " + lastHoleID);
	}

	// ============================================================
	// Remap connections (fromHoleID references)
	// ============================================================
	if (idRemapMap.size > 0) {
		var connectionsRemapped = 0;
		allBlastHoles.forEach(function(hole) {
			if (hole.fromHoleID && idRemapMap.has(hole.fromHoleID)) {
				hole.fromHoleID = idRemapMap.get(hole.fromHoleID);
				connectionsRemapped++;
			}
		});
		if (connectionsRemapped > 0) {
			console.log("Remapped", connectionsRemapped, "connections");
		}

		// Remap charging keys to follow hole ID changes (keys are already composite entityName:::holeID)
		if (window.remapChargingKeys) {
			window.remapChargingKeys(idRemapMap);
		}
	}

	// Save and refresh
	if (window.debouncedSaveHoles) {
		window.debouncedSaveHoles();
	}
	if (window.debouncedUpdateTreeView) {
		window.debouncedUpdateTreeView();
	}

	// Force 3D rebuild to update hole labels/IDs
	window.threeDataNeedsRebuild = true;

	// Update status message
	if (window.updateStatusMessage) {
		var msg;
		if (renumberMode === "allHoles") {
			msg = "Moved " + renumberCollectedHoles.length + " holes to row " + targetRowId +
				", renumbered all " + totalRenumbered + ": " + firstHoleID + " → " + lastHoleID;
		} else {
			msg = "Renumbered " + totalRenumbered + " holes in row " + targetRowId + ": " +
				firstHoleID + " → " + lastHoleID;
		}
		window.updateStatusMessage(msg);
		setTimeout(function() {
			if (window.updateStatusMessage) window.updateStatusMessage("");
		}, 3000);
	}
}

/**
 * Convert row number to letter (1=A, 2=B, ..., 26=Z, 27=AA, etc.)
 */
function getRowLetter(rowNum) {
	var result = "";
	while (rowNum > 0) {
		rowNum--; // Make 0-indexed
		result = String.fromCharCode(65 + (rowNum % 26)) + result;
		rowNum = Math.floor(rowNum / 26);
	}
	return result || "A";
}

// =============================================================================
// CANCEL MODE
// =============================================================================

/**
 * Cancel the interactive renumber holes mode
 */
function cancelRenumberHolesMode() {
	isRenumberHolesActive = false;
	renumberFirstHole = null;
	renumberSecondHole = null;
	renumberCollectedHoles = [];

	window.renumberFirstHole = null;
	window.renumberSecondHole = null;
	window.isRenumberHolesActive = false;

	// Remove click handlers from 2D canvas
	// NOTE: 3D clicks are handled by handle3DClick in kirra.js
	var canvas = document.getElementById("canvas");
	if (canvas) {
		canvas.removeEventListener("click", handleRenumberClick);
		canvas.removeEventListener("touchstart", handleRenumberClick);
	}

	// Remove button active state
	var renumberHolesBtn = document.getElementById("renumberHolesBtn");
	if (renumberHolesBtn) {
		renumberHolesBtn.classList.remove("active");
	}

	if (window.updateStatusMessage) {
		window.updateStatusMessage("");
	}

	if (window.drawData) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	console.log("RenumberHoles mode ended");
}

// =============================================================================
// DRAWING HELPERS
// =============================================================================

function isRenumberFirstHole(hole) {
	return isRenumberHolesActive && renumberFirstHole && renumberFirstHole === hole;
}

function isRenumberSecondHole(hole) {
	return isRenumberHolesActive && renumberSecondHole && renumberSecondHole === hole;
}

function isHoleInRenumberZone(hole) {
	return isRenumberHolesActive && renumberCollectedHoles.includes(hole);
}

function getRenumberStadiumZone() {
	if (!isRenumberHolesActive || !renumberFirstHole) {
		return null;
	}

	return {
		startX: renumberFirstHole.startXLocation,
		startY: renumberFirstHole.startYLocation,
		endX: renumberSecondHole ? renumberSecondHole.startXLocation : window.currentMouseWorldX,
		endY: renumberSecondHole ? renumberSecondHole.startYLocation : window.currentMouseWorldY,
		width: renumberZoneWidth,
		color: "magenta"
	};
}

// =============================================================================
// EXPOSE TO WINDOW
// =============================================================================

window.isRenumberHolesActive = false;
window.renumberFirstHole = null;
window.renumberSecondHole = null;
window.startRenumberHolesMode = startRenumberHolesMode;
window.handleRenumberHolesClick = handleRenumberHolesClick;
window.cancelRenumberHolesMode = cancelRenumberHolesMode;
window.isRenumberFirstHole = isRenumberFirstHole;
window.isRenumberSecondHole = isRenumberSecondHole;
window.isHoleInRenumberZone = isHoleInRenumberZone;
window.getRenumberStadiumZone = getRenumberStadiumZone;

export {
	startRenumberHolesMode,
	handleRenumberHolesClick,
	cancelRenumberHolesMode,
	isRenumberFirstHole,
	isRenumberSecondHole,
	isHoleInRenumberZone,
	getRenumberStadiumZone
};
