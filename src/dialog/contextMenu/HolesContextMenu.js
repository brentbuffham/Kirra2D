// src/dialog/contextMenu/HolesContextMenu.js
//=============================================================
// HOLES CONTEXT MENU
//=============================================================

// Step 1) Show hole property editor for single or multiple holes
function showHolePropertyEditor(hole) {
	// Step 1a) CHECK VISIBILITY FIRST - Filter out hidden holes
	const visibleHoles = window.allBlastHoles.filter((hole) => window.isHoleVisible(hole));

	if (visibleHoles.length === 0) {
		console.log("❌ No visible holes to edit");
		return;
	}

	if (visibleHoles.length !== allBlastHoles.length) {
		console.log("⚠️ Some holes are hidden and will not be edited");
	}

	// Step 1b) Determine if we're dealing with single hole or multiple holes
	let candidateHoles;
	if (Array.isArray(hole)) {
		candidateHoles = hole;
	} else if (window.selectedMultipleHoles && window.selectedMultipleHoles.length > 1) {
		candidateHoles = window.selectedMultipleHoles;
	} else {
		candidateHoles = [hole];
	}
	// Step 1c) Filter candidate holes to only include visible ones
	const holes = candidateHoles.filter((h) => window.isHoleVisible(h));

	const isMultiple = holes.length > 1;
	const isArrayInput = Array.isArray(hole);

	if (holes.length === 0) return;

	// Step 2) Calculate current values and averages with proper fallbacks
	let delaySum = 0,
		diameterSum = 0,
		bearingSum = 0,
		angleSum = 0,
		subdrillSum = 0;
	let collarZSum = 0,
		gradeZSum = 0;
	let uniqueDelays = new Set(),
		uniqueDelayColors = new Set(),
		uniqueHoleTypes = new Set();
	let uniqueRowIDs = new Set(),
		uniquePosIDs = new Set();
	let typeCounts = {};
	let connectorCurveSum = 0;
	let burdenSum = 0;
	let spacingSum = 0;

	holes.forEach((h) => {
		// Basic properties
		const currentDelay = h.holeDelay !== undefined ? h.holeDelay : h.timingDelayMilliseconds || 0;
		const currentColor = h.holeDelayColor || h.colorHexDecimal || "#FF0000";
		const currentType = h.holeType || "Production";

		// Geometry properties
		const diameter = h.holeDiameter || 0;
		const bearing = h.holeBearing || 0;
		const angle = h.holeAngle || 0;
		const subdrill = h.subdrillAmount || 0;
		const collarZ = h.startZLocation || 0;
		const gradeZ = h.gradeZLocation || h.endZLocation || 0;
		const rowID = h.rowID || "";
		const posID = h.posID || "";

		// Step 2a) Add connectorCurve calculation
		const connectorCurve = h.connectorCurve || 0;
		const burden = h.burden || 0;
		const spacing = h.spacing || 0;

		// Sum for averages
		delaySum += parseFloat(currentDelay);
		diameterSum += parseFloat(diameter);
		bearingSum += parseFloat(bearing);
		angleSum += parseFloat(angle);
		subdrillSum += parseFloat(subdrill);
		collarZSum += parseFloat(collarZ);
		gradeZSum += parseFloat(gradeZ);

		// Step 2b) Add new sums

		connectorCurveSum += parseFloat(connectorCurve);
		burdenSum += parseFloat(burden);
		spacingSum += parseFloat(spacing);

		// Track unique values
		uniqueDelays.add(currentDelay);
		uniqueDelayColors.add(currentColor);
		uniqueHoleTypes.add(currentType);
		uniqueRowIDs.add(rowID);
		uniquePosIDs.add(posID);

		// Count hole types for most common
		typeCounts[currentType] = (typeCounts[currentType] || 0) + 1;
	});

	// Step 3) Calculate averages
	const count = holes.length;
	const avgDelay = delaySum / count;
	const avgDiameter = diameterSum / count;
	const avgBearing = bearingSum / count;
	const avgAngle = angleSum / count;
	const avgSubdrill = subdrillSum / count;
	const avgCollarZ = collarZSum / count;
	const avgGradeZ = gradeZSum / count;

	// Step 3a) Find most common values
	const firstDelayColor = Array.from(uniqueDelayColors)[0];
	const firstRowID = Array.from(uniqueRowIDs)[0];
	const firstPosID = Array.from(uniquePosIDs)[0];

	// Step 3b) Find most common hole type
	let mostCommonType = "Production";
	let maxCount = 0;
	for (const [type, typeCount] of Object.entries(typeCounts)) {
		if (typeCount > maxCount) {
			maxCount = typeCount;
			mostCommonType = type;
		}
	}

	// Step 4) Create combined hole types list (standard + any custom types from selection)
	const standardHoleTypes = ["Angled", "Batter", "Buffer", "Infill", "Production", "Stab", "Toe", "Trim"];
	const customTypesFromSelection = Array.from(uniqueHoleTypes).filter((type) => !standardHoleTypes.includes(type));
	const allHoleTypes = [...standardHoleTypes, ...customTypesFromSelection].sort();
	// Step 4a) Calculate averages (add after existing averages around line 37240)
	const avgConnectorCurve = connectorCurveSum / count;
	const avgBurden = burdenSum / count;
	const avgSpacing = spacingSum / count;

	// Step 5) Helper to normalize color for storage and comparison
	function normalizeColorValue(color) {
		if (!color) return "#000000";
		var c = String(color).trim().toUpperCase();
		if (!c.startsWith("#")) c = "#" + c;
		if (c.length === 4) {
			c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
		}
		return c;
	}

	// Step 5a) Add to originalValues object around line 37275
	const originalValues = {
		delay: avgDelay.toFixed(1),
		diameter: avgDiameter.toFixed(0),
		bearing: avgBearing.toFixed(1),
		angle: avgAngle.toFixed(0),
		subdrill: avgSubdrill.toFixed(1),
		collarZ: avgCollarZ.toFixed(2),
		gradeZ: avgGradeZ.toFixed(2),
		holeType: mostCommonType,
		delayColor: normalizeColorValue(firstDelayColor),
		rowID: firstRowID,
		posID: firstPosID,
		// Step 5b) Add new original values
		connectorCurve: avgConnectorCurve.toFixed(0),
		burden: avgBurden.toFixed(2),
		spacing: avgSpacing.toFixed(2),
	};

	// Step 6) Add display values around line 37285
	const displayConnectorCurve = isMultiple && new Set(holes.map((h) => h.connectorCurve || 0)).size > 1 ? "varies (avg: " + avgConnectorCurve.toFixed(0) + "°)" : avgConnectorCurve.toFixed(0) + "°";
	const displayBurden = isMultiple && new Set(holes.map((h) => h.burden || 0)).size > 1 ? "varies (avg: " + avgBurden.toFixed(2) + ")" : avgBurden.toFixed(2);
	const displaySpacing = isMultiple && new Set(holes.map((h) => h.spacing || 0)).size > 1 ? "varies (avg: " + avgSpacing.toFixed(2) + ")" : avgSpacing.toFixed(2);

	// Step 6a) Create display values with indicators for varying values
	const displayDelay = isMultiple && uniqueDelays.size > 1 ? "varies (avg: " + avgDelay.toFixed(1) + ")" : avgDelay.toFixed(1);
	const displayDiameter = isMultiple && new Set(holes.map((h) => h.holeDiameter)).size > 1 ? "varies (avg: " + avgDiameter.toFixed(0) + ")" : avgDiameter.toFixed(0);
	const displayBearing = isMultiple && new Set(holes.map((h) => h.holeBearing)).size > 1 ? "varies (avg: " + avgBearing.toFixed(1) + ")" : avgBearing.toFixed(1);
	const displayAngle = isMultiple && new Set(holes.map((h) => h.holeAngle)).size > 1 ? "varies (avg: " + avgAngle.toFixed(0) + ")" : avgAngle.toFixed(0);
	const displaySubdrill = isMultiple && new Set(holes.map((h) => h.subdrillAmount)).size > 1 ? "varies (avg: " + avgSubdrill.toFixed(1) + ")" : avgSubdrill.toFixed(1);
	const displayCollarZ = isMultiple && new Set(holes.map((h) => h.startZLocation)).size > 1 ? "varies (avg: " + avgCollarZ.toFixed(2) + ")" : avgCollarZ.toFixed(2);
	const displayGradeZ = isMultiple && new Set(holes.map((h) => h.gradeZLocation || h.endZLocation)).size > 1 ? "varies (avg: " + avgGradeZ.toFixed(2) + ")" : avgGradeZ.toFixed(2);

	// Step 6b) Create notes for multiple values
	const delayNote = isMultiple && uniqueDelays.size > 1 ? " (varying)" : "";
	const colorNote = isMultiple && uniqueDelayColors.size > 1 ? " (multiple)" : "";
	const typeNote = isMultiple && uniqueHoleTypes.size > 1 ? " (most common: " + mostCommonType + ")" : "";

	const title = isMultiple ? "Edit Multiple Holes (" + holes.length + " selected)" : "Edit Hole " + holes[0].holeID;

	// Step 7) Define form fields
	const fields = [
		{
			label: "Delay" + delayNote,
			name: "delay",
			type: "text",
			value: originalValues.delay,
			placeholder: displayDelay,
		},
		{
			label: "Delay Color" + colorNote,
			name: "delayColor",
			type: "color",
			value: normalizeColorValue(firstDelayColor),
		},
		{
			label: "Connector Curve (°)",
			name: "connectorCurve",
			type: "number",
			value: originalValues.connectorCurve,
			placeholder: displayConnectorCurve,
		},
		{
			label: "Hole Type",
			name: "holeType",
			type: "select",
			value: mostCommonType,
			options: [
				{
					value: "",
					text: "-- No Change --",
				},
				...allHoleTypes.map((type) => ({
					value: type,
					text: type,
				})),
				{
					value: "__CUSTOM__",
					text: "Other (custom)...",
				},
			],
		},
		{
			label: "Custom Type",
			name: "customType",
			type: "text",
			placeholder: "Enter custom hole type",
			disabled: true,
		},
		{
			label: "Diameter (mm)",
			name: "diameter",
			type: "text",
			value: originalValues.diameter,
			placeholder: displayDiameter,
		},
		{
			label: "Bearing (°)",
			name: "bearing",
			type: "text",
			value: originalValues.bearing,
			placeholder: displayBearing,
		},
		{
			label: "Dip/Angle (°)",
			name: "angle",
			type: "text",
			value: originalValues.angle,
			placeholder: displayAngle,
		},
		{
			label: "Subdrill (m)",
			name: "subdrill",
			type: "text",
			value: originalValues.subdrill,
			placeholder: displaySubdrill,
		},
		{
			label: "Collar Z RL (m)",
			name: "collarZ",
			type: "text",
			value: originalValues.collarZ,
			placeholder: displayCollarZ,
		},
		{
			label: "Grade Z RL (m)",
			name: "gradeZ",
			type: "text",
			value: originalValues.gradeZ,
			placeholder: displayGradeZ,
		},
		{
			label: "Burden (m)",
			name: "burden",
			type: "text",
			value: originalValues.burden,
			placeholder: displayBurden,
		},
		{
			label: "Spacing (m)",
			name: "spacing",
			type: "text",
			value: originalValues.spacing,
			placeholder: displaySpacing,
		},
	];

	// Step 8) Add Row ID and Pos ID fields only for single hole edits
	if (!isMultiple) {
		fields.push(
			{
				label: "Row ID",
				name: "rowID",
				type: "text",
				value: firstRowID,
				placeholder: "Row identifier",
			},
			{
				label: "Pos ID",
				name: "posID",
				type: "text",
				value: firstPosID,
				placeholder: "Position identifier",
			}
		);
	}

	// Step 9) Create enhanced form content with special handling
	const formContent = window.createEnhancedFormContent(fields, isMultiple);

	// Step 9a) Add note at the bottom
	const noteDiv = document.createElement("div");
	noteDiv.style.gridColumn = "1 / -1";
	noteDiv.style.marginTop = "10px";
	noteDiv.style.fontSize = "10px";
	noteDiv.style.color = "#888";
	noteDiv.textContent = isMultiple ? "Note: Use +/- for relative changes (e.g., +0.3, -0.2). Only changed values will be applied." : "Note: Use +/- for relative changes (e.g., +0.3, -0.2). Select hole type from dropdown or choose 'Other' for custom. Curved connectors are made by seting connector curve to (45° to 120°, -45° to -120°) Straight connctors are 0°";
	formContent.appendChild(noteDiv);

	// Step 10) Create dialog
	const dialog = new window.FloatingDialog({
		title: title,
		content: formContent,
		layoutType: "compact",
		showConfirm: true,
		showCancel: true,
		showOption1: true, // Hide button
		showOption2: true, // Delete button
		confirmText: "Apply",
		cancelText: "Cancel",
		option1Text: "Hide",
		option2Text: "Delete",
		width: 350,
		height: 600,
		onConfirm: () => {
			// Step 10a) Get form values and process updates
			const formData = window.getFormData(formContent);

			// Process the form data and update holes
			processHolePropertyUpdates(holes, formData, originalValues, isMultiple);

			// Clear any dragging states when dialog closes
			if (typeof window.isDragging !== "undefined") window.isDragging = false;
			if (typeof window.longPressTimeout !== "undefined") clearTimeout(window.longPressTimeout);
		},
		onCancel: () => {
			// Step 10d) Clear any dragging states and redraw when dialog closes
			if (typeof window.isDragging !== "undefined") window.isDragging = false;
			if (typeof window.longPressTimeout !== "undefined") clearTimeout(window.longPressTimeout);

			// Redraw canvas when dialog closes
			window.drawData(window.allBlastHoles, window.selectedHole);
		},
		onOption1: () => {
			// Step 10b) Hide holes - just set visible flag
			holes.forEach((hole) => {
				hole.visible = false;
			});
			window.drawData(window.allBlastHoles, window.selectedHole);
		},
		onOption2: () => {
			// Step 10c) Delete holes using Factory Code with renumber prompt
			// Close the property dialog first
			dialog.close();

			// Ask if user wants to renumber (USE FACTORY CODE)
			window.showConfirmationDialog(
				"Renumber Holes?",
				"Do you want to renumber holes after deletion?",
				"Yes",
				"No",
				() => {
					// Step 10c.1) Yes - Ask for starting number using input dialog (USE FACTORY CODE)
					window.showConfirmationDialogWithInput(
						"Renumber Starting Value",
						"Enter the starting number for renumbering:",
						"Start From",
						"text",
						"1",
						"OK",
						"Cancel",
						(startNumber) => {
							// Step 10c.2) Delete holes manually and renumber with starting value
							const entitiesToRenumber = new Set();
							
							holes.forEach((hole) => {
								const index = window.allBlastHoles.findIndex(h => 
									h.holeID === hole.holeID && h.entityName === hole.entityName
								);
								if (index !== -1) {
									window.allBlastHoles.splice(index, 1);
									entitiesToRenumber.add(hole.entityName);
								}
							});
							
							// Renumber each affected entity with user-specified starting number (USE FACTORY CODE)
							entitiesToRenumber.forEach(entityName => {
								window.renumberHolesFunction(startNumber, entityName);
							});
							
							// Debounced save and updates (USE FACTORY CODE)
							window.debouncedSaveHoles();
							window.debouncedUpdateTreeView();
							window.drawData(window.allBlastHoles, window.selectedHole);
							window.updateStatusMessage("Deleted " + holes.length + " hole(s) and renumbered from " + startNumber);
							setTimeout(() => window.updateStatusMessage(""), 2000);
						},
						() => {
							// Step 10c.3) User cancelled the starting number input
							window.updateStatusMessage("Renumber cancelled");
							setTimeout(() => window.updateStatusMessage(""), 2000);
						}
					);
				},
				() => {
					// Step 10c.4) No - Delete without renumbering
					holes.forEach((hole) => {
						const index = window.allBlastHoles.findIndex(h =>
							h.holeID === hole.holeID && h.entityName === hole.entityName
						);
						if (index !== -1) {
							window.allBlastHoles.splice(index, 1);
						}
					});

					// Debounced save and updates (USE FACTORY CODE)
					window.debouncedSaveHoles();
					window.debouncedUpdateTreeView();
					window.drawData(window.allBlastHoles, window.selectedHole);
					window.updateStatusMessage("Deleted " + holes.length + " hole(s)");
					setTimeout(() => window.updateStatusMessage(""), 2000);
				}
			);
		},
	});

	dialog.show();
}

// Step 11) Process hole property updates (extracted from original logic)
function processHolePropertyUpdates(holes, formData, originalValues, isMultiple) {
	// Step 11a) Helper function to handle relative/absolute value changes
	function processNumericValue(inputValue, originalValue, currentHoleValue) {
		if (inputValue === "" || inputValue === originalValue) {
			return null; // No change
		}

		if (inputValue.startsWith("+") || inputValue.startsWith("-")) {
			// Relative adjustment
			const delta = parseFloat(inputValue);
			if (!isNaN(delta)) {
				return currentHoleValue + delta;
			}
		} else {
			// Absolute value
			const absoluteValue = parseFloat(inputValue);
			if (!isNaN(absoluteValue)) {
				return absoluteValue;
			}
		}
		return null; // Invalid input
	}

	// Step 11b) NEW: Track which fields were actually modified by the user
	const modifiedFields = new Set();

	// Step 11b.1) Helper to normalize color values for comparison
	function normalizeColor(color) {
		if (!color) return "#000000";
		var c = String(color).trim().toUpperCase();
		if (!c.startsWith("#")) c = "#" + c;
		// Ensure 6 digits
		if (c.length === 4) {
			c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
		}
		return c;
	}

	// Check each field to see if it was actually changed from the original average
	if (formData.delay !== originalValues.delay) modifiedFields.add("delay");
	// Step 11b.2) Normalize colors before comparing
	if (normalizeColor(formData.delayColor) !== normalizeColor(originalValues.delayColor)) modifiedFields.add("delayColor");
	if (formData.holeType !== originalValues.holeType) modifiedFields.add("holeType");
	if (formData.diameter !== originalValues.diameter) modifiedFields.add("diameter");
	if (formData.bearing !== originalValues.bearing) modifiedFields.add("bearing");
	if (formData.angle !== originalValues.angle) modifiedFields.add("angle");
	if (formData.subdrill !== originalValues.subdrill) modifiedFields.add("subdrill");
	if (formData.collarZ !== originalValues.collarZ) modifiedFields.add("collarZ");
	if (formData.gradeZ !== originalValues.gradeZ) modifiedFields.add("gradeZ");
	if (formData.connectorCurve !== originalValues.connectorCurve) modifiedFields.add("connectorCurve");
	if (formData.burden !== originalValues.burden) modifiedFields.add("burden");
	if (formData.spacing !== originalValues.spacing) modifiedFields.add("spacing");

	// For single hole edits, also check Row ID and Pos ID
	if (!isMultiple) {
		if (formData.rowID !== originalValues.rowID) modifiedFields.add("rowID");
		if (formData.posID !== originalValues.posID) modifiedFields.add("posID");
	}

	// Step 11c) Handle hole type: check if custom or standard
	let newHoleType = formData.holeType;
	if (newHoleType === "__CUSTOM__") {
		newHoleType = formData.customType.trim();
		if (newHoleType !== originalValues.holeType) modifiedFields.add("holeType");
	}

	// Step 11d) Track if any timing-related properties were changed
	let timingChanged = false;
	let geometryChanged = false;

	holes.forEach((h) => {
		// Step 11d.1) ONLY process fields that were actually modified
		if (modifiedFields.has("delay")) {
			const processedDelay = processNumericValue(formData.delay, originalValues.delay, h.holeDelay !== undefined ? h.holeDelay : h.timingDelayMilliseconds || 0);
			if (processedDelay !== null) {
				h.holeDelay = processedDelay;
				if (h.timingDelayMilliseconds !== undefined) {
					h.timingDelayMilliseconds = processedDelay;
				}
				timingChanged = true;
			}
		}

		if (modifiedFields.has("delayColor")) {
			h.holeDelayColor = formData.delayColor;
			if (h.colorHexDecimal !== undefined) {
				h.colorHexDecimal = formData.delayColor;
			}
			timingChanged = true;
		}

		if (modifiedFields.has("holeType")) {
			h.holeType = newHoleType;
		}

		// Update geometry properties only if modified
		if (modifiedFields.has("diameter")) {
			const processedDiameter = processNumericValue(formData.diameter, originalValues.diameter, h.holeDiameter || 0);
			if (processedDiameter !== null) {
				window.calculateHoleGeometry(h, processedDiameter, 7);
				geometryChanged = true;
			}
		}

		if (modifiedFields.has("bearing")) {
			const processedBearing = processNumericValue(formData.bearing, originalValues.bearing, h.holeBearing || 0);
			if (processedBearing !== null) {
				window.calculateHoleGeometry(h, processedBearing, 3);
				geometryChanged = true;
			}
		}

		if (modifiedFields.has("angle")) {
			const processedAngle = processNumericValue(formData.angle, originalValues.angle, h.holeAngle || 0);
			if (processedAngle !== null) {
				window.calculateHoleGeometry(h, processedAngle, 2);
				geometryChanged = true;
			}
		}

		if (modifiedFields.has("subdrill")) {
			const processedSubdrill = processNumericValue(formData.subdrill, originalValues.subdrill, h.subdrillAmount || 0);
			if (processedSubdrill !== null) {
				window.calculateHoleGeometry(h, processedSubdrill, 8);
				geometryChanged = true;
			}
		}

		if (modifiedFields.has("collarZ")) {
			const processedCollarZ = processNumericValue(formData.collarZ, originalValues.collarZ, h.startZLocation || 0);
			if (processedCollarZ !== null) {
				h.startZLocation = processedCollarZ;
				geometryChanged = true;
			}
		}

		if (modifiedFields.has("gradeZ")) {
			const processedGradeZ = processNumericValue(formData.gradeZ, originalValues.gradeZ, h.gradeZLocation || h.endZLocation || 0);
			if (processedGradeZ !== null) {
				h.gradeZLocation = processedGradeZ;
				h.endZLocation = processedGradeZ;
				geometryChanged = true;
			}
		}

		if (modifiedFields.has("connectorCurve")) {
			// Step 11d.2) Treat connectorCurve as absolute value only (no relative adjustments)
			const curveValue = parseFloat(formData.connectorCurve);
			if (!isNaN(curveValue)) {
				h.connectorCurve = curveValue;
				timingChanged = true; // Since this affects visual display
			}
		}

		if (modifiedFields.has("burden")) {
			const processedBurden = processNumericValue(formData.burden, originalValues.burden, h.burden || 0);
			if (processedBurden !== null) {
				h.burden = processedBurden;
			}
		}

		if (modifiedFields.has("spacing")) {
			const processedSpacing = processNumericValue(formData.spacing, originalValues.spacing, h.spacing || 0);
			if (processedSpacing !== null) {
				h.spacing = processedSpacing;
			}
		}

		// Update Row ID and Pos ID only for single hole edits
		if (!isMultiple) {
			if (modifiedFields.has("rowID")) {
				h.rowID = formData.rowID;
			}
			if (modifiedFields.has("posID")) {
				h.posID = formData.posID;
			}
		}
	});

	// Step 12) Trigger updates
	if (timingChanged) {
		// Note: calculateAllHoleDelays and generateDelayColorRamp don't exist yet
		// TODO: Implement or remove these function calls
		// if (window.autoCalculateTimingEnabled) {
		// 	window.calculateAllHoleDelays();
		// }
		// window.generateDelayColorRamp();
	}

	if (geometryChanged) {
		// Update 3D meshes if in 3D mode
		// Note: updateHoleMeshes doesn't exist yet
		// TODO: Implement or remove this function call
		// if (window.onlyShowThreeJS && window.threeInitialized) {
		// 	window.updateHoleMeshes(holes);
		// }
	}

	// Redraw and save
	window.drawData(window.allBlastHoles, window.selectedHole);
	window.debouncedUpdateTreeView();
	window.debouncedSaveHoles();

	// Show status message
	const message = isMultiple ? "Updated " + holes.length + " holes" : "Updated hole " + holes[0].holeID;
	window.updateStatusMessage(message);
	setTimeout(() => window.updateStatusMessage(""), 2000);
}

//===========================================
// HOLES CONTEXT MENU END
//===========================================

// Make functions available globally
window.showHolePropertyEditor = showHolePropertyEditor;
window.processHolePropertyUpdates = processHolePropertyUpdates;
