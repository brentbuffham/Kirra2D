// src/dialog/popups/generic/AssignBlastDialog.js
//=============================================================
// ASSIGN BLAST DIALOG
//=============================================================
// Reusable dialog to reassign selected holes to a different blast (entityName).
// Uses the same duplicate-resolution and fromHoleID update pattern as editBlastNamePopup.

console.log("✅ AssignBlastDialog.js: Loading...");

/**
 * Show the Assign Blast dialog for one or more holes.
 * @param {Array} holes - Array of blast hole objects to reassign
 */
export function assignBlastDialog(holes) {
	if (!holes || holes.length === 0) {
		if (typeof window.showModalMessage === "function") {
			window.showModalMessage("No Selection", "No holes selected to reassign.", "warning");
		}
		return;
	}

	// Step 1) Gather existing blast names from all holes
	var existingNames = [];
	if (window.allBlastHoles) {
		var nameSet = new Set();
		window.allBlastHoles.forEach(function (h) {
			if (h.entityName) nameSet.add(h.entityName);
		});
		existingNames = Array.from(nameSet).sort();
	}

	// Step 2) Determine current blast name(s) of selected holes
	var sourceNames = new Set();
	holes.forEach(function (h) {
		if (h.entityName) sourceNames.add(h.entityName);
	});
	var sourceNameText = Array.from(sourceNames).join(", ");

	// Step 3) Build select options: existing blasts + "Create New" option
	var selectOptions = existingNames.map(function (name) {
		return { value: name, text: name };
	});
	selectOptions.push({ value: "__NEW__", text: "+ Create New Blast..." });

	// Step 4) Build form fields
	var fields = [
		{
			label: "Selected Holes",
			name: "selectedCount",
			type: "text",
			value: holes.length + " hole(s) from: " + sourceNameText,
			disabled: true
		},
		{
			label: "Target Blast",
			name: "targetBlast",
			type: "select",
			value: existingNames.length > 0 ? existingNames[0] : "__NEW__",
			options: selectOptions
		},
		{
			label: "New Blast Name",
			name: "newBlastName",
			type: "text",
			value: "",
			placeholder: "Enter new blast name",
			disabled: true
		}
	];

	var formContent = window.createEnhancedFormContent(fields, false);

	// Step 5) Wire up the select to enable/disable newBlastName field
	var targetSelect = formContent.querySelector("[name='targetBlast']");
	var newNameRow = formContent.querySelector("[data-field='newBlastName']");
	var newNameInput = newNameRow ? newNameRow.querySelector("input") : null;
	var newNameLabel = newNameRow ? newNameRow.querySelector("label") : null;

	if (targetSelect && newNameInput) {
		// Set initial state based on default selection
		var updateNewNameState = function () {
			if (targetSelect.value === "__NEW__") {
				newNameInput.disabled = false;
				newNameInput.style.opacity = "1";
				if (newNameLabel) newNameLabel.style.opacity = "1";
				newNameInput.focus();
			} else {
				newNameInput.disabled = true;
				newNameInput.style.opacity = "0.3";
				if (newNameLabel) newNameLabel.style.opacity = "0.3";
				newNameInput.value = "";
			}
		};

		updateNewNameState();
		targetSelect.addEventListener("change", updateNewNameState);
	}

	// Step 6) Create and show the dialog
	var dialog = new window.FloatingDialog({
		title: "Assign Blast",
		content: formContent,
		layoutType: "compact",
		width: 400,
		height: 220,
		showConfirm: true,
		showCancel: true,
		confirmText: "Assign",
		cancelText: "Cancel",
		onConfirm: function () {
			// Step 7) Get form data and determine target blast name
			var formData = window.getFormData(formContent);
			var targetName = formData.targetBlast;

			if (targetName === "__NEW__") {
				targetName = (formData.newBlastName || "").trim();
				if (!targetName) {
					window.showModalMessage("Invalid Name", "Please enter a new blast name.", "warning");
					return false; // Prevent dialog close
				}
			}

			// Step 8) Validate: no-op if all selected holes already belong to target
			var allAlreadyTarget = holes.every(function (h) {
				return h.entityName === targetName;
			});
			if (allAlreadyTarget) {
				window.showModalMessage("No Change", "All selected holes already belong to '" + targetName + "'.", "info");
				return false;
			}

			// Step 9) Perform the reassignment using test-copy pattern
			performAssignment(holes, targetName);
		}
	});

	dialog.show();
}

/**
 * Perform the blast reassignment with duplicate detection and fromHoleID updates.
 * Follows the same pattern as editBlastNamePopup in HolePropertyDialogs.js.
 * @param {Array} holes - Holes to reassign
 * @param {string} targetName - Target blast name (entityName)
 */
async function performAssignment(holes, targetName) {
	// Step 10) Build a set of selected hole identifiers for quick lookup
	var selectedHoleKeys = new Set();
	holes.forEach(function (h) {
		selectedHoleKeys.add(h.entityName + ":::" + h.holeID);
	});

	// Step 11) Create deep copy of allBlastHoles for testing
	var testBlastHoles = JSON.parse(JSON.stringify(window.allBlastHoles));

	// Step 12) Apply entityName rename to selected holes in the test copy
	testBlastHoles.forEach(function (point) {
		var key = point.entityName + ":::" + point.holeID;
		if (selectedHoleKeys.has(key)) {
			var oldEntityName = point.entityName;
			point.entityName = targetName;

			// Step 13) Update fromHoleID if it references the old entity name
			if (point.fromHoleID) {
				var parts = point.fromHoleID.split(":::");
				if (parts.length === 2 && parts[0] === oldEntityName) {
					point.fromHoleID = targetName + ":::" + parts[1];
				}
			}
		}
	});

	// Step 14) Also update fromHoleID references in OTHER holes that point to renamed holes
	testBlastHoles.forEach(function (point) {
		if (point.fromHoleID && !selectedHoleKeys.has(point.entityName + ":::" + point.holeID)) {
			var parts = point.fromHoleID.split(":::");
			if (parts.length === 2) {
				// Check if this fromHoleID points to a hole that was renamed
				var refKey = parts[0] + ":::" + parts[1];
				if (selectedHoleKeys.has(refKey)) {
					point.fromHoleID = targetName + ":::" + parts[1];
				}
			}
		}
	});

	// Step 15) Check for duplicate hole IDs in the target blast
	if (typeof window.checkAndResolveDuplicateHoleIDs === "function") {
		var duplicateResult = await window.checkAndResolveDuplicateHoleIDs(testBlastHoles, "reassign");

		// Step 16) If user cancelled, abort
		if (duplicateResult && duplicateResult.cancelled) {
			console.log("Assign Blast: operation cancelled by user");
			return;
		}
	}

	// Step 17) Apply resolved changes back to the original array
	window.allBlastHoles.length = 0;
	window.allBlastHoles.push.apply(window.allBlastHoles, testBlastHoles);

	// Step 18) Handle rowID merge adjustment when merging into an existing blast
	// Gather the source entity names before rename
	var sourceEntityNames = new Set();
	holes.forEach(function (h) {
		sourceEntityNames.add(h.entityName);
	});

	// Check if we're merging into an existing blast that already has holes
	var targetHolesBeforeMerge = window.allBlastHoles.filter(function (h) {
		return h.entityName === targetName && !selectedHoleKeys.has(targetName + ":::" + h.holeID);
	});

	if (targetHolesBeforeMerge.length > 0) {
		// Step 19) Get the max rowID in the existing target blast
		var maxRowID = 0;
		targetHolesBeforeMerge.forEach(function (point) {
			if (point.rowID) {
				var rowNum = parseInt(point.rowID) || 0;
				if (rowNum > maxRowID) maxRowID = rowNum;
			}
		});

		if (maxRowID > 0) {
			console.log("Assign Blast: Merging - adjusting rowIDs. Max rowID in target: " + maxRowID);

			// Step 20) Group the reassigned holes by their current rowID
			var rowGroups = new Map();
			window.allBlastHoles.forEach(function (point) {
				if (point.entityName === targetName && selectedHoleKeys.has(targetName + ":::" + point.holeID)) {
					var currentRow = point.rowID || 1;
					if (!rowGroups.has(currentRow)) {
						rowGroups.set(currentRow, []);
					}
					rowGroups.get(currentRow).push(point);
				}
			});

			// Step 21) Adjust rowIDs sequentially after max
			var newRowID = maxRowID;
			var sortedKeys = Array.from(rowGroups.keys()).sort(function (a, b) { return a - b; });
			sortedKeys.forEach(function (oldRowID) {
				newRowID++;
				rowGroups.get(oldRowID).forEach(function (point) {
					console.log("Assign Blast: Adjusting hole " + point.holeID + " from row " + oldRowID + " to row " + newRowID);
					point.rowID = newRowID;
				});
			});
		}
	}

	// Step 22) Save, update tree view, and redraw
	if (typeof window.debouncedSaveHoles === "function") {
		window.debouncedSaveHoles();
	}
	if (typeof window.debouncedUpdateTreeView === "function") {
		window.debouncedUpdateTreeView();
	}
	if (typeof window.redraw3D === "function") {
		window.redraw3D();
	} else {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	// Step 23) Status message
	if (typeof window.updateStatusMessage === "function") {
		window.updateStatusMessage("Assigned " + holes.length + " hole(s) to blast '" + targetName + "'");
		setTimeout(function () { window.updateStatusMessage(""); }, 3000);
	}
}

// Make available globally
window.assignBlastDialog = assignBlastDialog;
