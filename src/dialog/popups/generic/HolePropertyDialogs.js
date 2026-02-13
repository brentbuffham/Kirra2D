// Step 1) Hole Property Editor Dialogs Module - Completed Extraction
// Step 2) This module contains blast hole property editing dialog functions
// Step 3) ✅ EXTRACTION COMPLETE - All 7 functions extracted from kirra.js (lines 41311-42027)
// Step 4) Extracted on: 2025-12-20 at approximately 1735 UTC
// Step 5) All functions use FloatingDialog, createFormContent, and getFormData - NO Swal2
// Step 6) Dependencies: FloatingDialog, createFormContent, getFormData
// Step 7) Requires: Globals from kirra.js including selected Hole, allBlastHoles, clickedHole, blastNameValue, etc.
// Step 0) Converted to ES Module for Vite bundling - 2025-12-26

console.log("✅ HolePropertyDialogs.js: Loading...");

// =====================================
// RENAME ENTITY DIALOG
// =====================================
// Step 8) Function to rename KAD entities (lines, polygons, etc.)
// Step 9) Used by KAD context menu and tree view
// Step 10) Returns a Promise to support async/await patterns
export function renameEntityDialog(entityType, oldEntityName) {
	// Step 11) Create form with single text field
	const fields = [
		{
			label: "New name:",
			name: "entityName",
			value: oldEntityName || "",
			placeholder: "Enter new name",
		},
	];

	const formContent = window.createFormContent(fields);

	// Step 12) Return a Promise to match the calling pattern
	return new Promise((resolve) => {
		const dialog = new window.FloatingDialog({
			title: "Rename " + entityType,
			content: formContent,
			layoutType: "default",
			width: 350,
			height: 120,
			showConfirm: true,
			showCancel: true,
			confirmText: "Rename",
			cancelText: "Cancel",
			onConfirm: () => {
				// Step 13) Get form values
				const formData = window.getFormData(formContent);

				// Step 14) Validate input
				if (!formData.entityName || formData.entityName.trim() === "") {
					console.log("Invalid name entered");
					return;
				}

				// Step 15) Resolve with Swal2-like result object for compatibility
				resolve({
					isConfirmed: true,
					value: formData.entityName.trim(),
				});
			},
			onCancel: () => {
				// Step 16) Resolve with cancelled result
				resolve({
					isConfirmed: false,
					value: null,
				});
			},
		});

		dialog.show();
	});
}

// =====================================
// EDIT BLAST NAME DIALOG
// =====================================
// Step 17) Function to edit the blast name (entity name) of holes
// Step 18) Supports editing single hole or all holes with same name
// Step 19) Includes complex duplicate checking and merge logic
export function editBlastNamePopup(selectedHole) {
	// Step 20) CHECK VISIBILITY FIRST - Don't edit hidden holes
	if (!selectedHole || !window.isHoleVisible(selectedHole)) {
		console.log("[BAD] Cannot edit hidden hole: " + (selectedHole ? selectedHole.holeID : "none"));
		return Promise.resolve({ isConfirmed: false });
	}

	// Step 21) Get the current hole's blast name
	if (selectedHole) {
		const index = window.allBlastHoles.findIndex((hole) => hole === selectedHole);
		if (index !== -1) {
			window.clickedHole = window.allBlastHoles[index];
			window.blastNameValue = window.clickedHole.entityName;
		}
	}
	let allHoleBlastNamesValue = true;

	// Step 22) Create form content with blast name field and checkbox
	const fields = [
		{
			label: "Blast Name",
			name: "blastName",
			value: window.blastNameValue || "",
			placeholder: "Blast Name",
		},
		{
			label: "Apply to all holes with the same name",
			name: "allHoleBlastNames",
			type: "checkbox",
			checked: true,
			labelInLeftColumn: true,
		},
	];

	const formContent = window.createFormContent(fields, true);

	// Step 22a) Return a Promise to allow TreeView to wait for completion
	return new Promise((resolve) => {
		const dialog = new window.FloatingDialog({
			title: "Edit Blast Name",
			content: formContent,
			layoutType: "default",
			width: 350,
			height: 160,
			showConfirm: true,
			showCancel: true,
			confirmText: "Confirm",
			cancelText: "Cancel",
			onConfirm: async () => {
			// Step 23) Get form data - ADD THIS AT THE VERY TOP
			const formData = window.getFormData(formContent);
			const newBlastName = formData.blastName ? formData.blastName.trim() : "";
			// Step 23a) IMPORTANT: getFormData returns checkbox as STRING "true" or "false", not boolean
			const allHoleBlastNamesFromForm = formData.allHoleBlastNames === "true";

			// Step 24) Validate the new blast name
			if (!newBlastName || newBlastName === "") {
				console.log("Invalid blast name entered");
				return;
			}

			const index = window.allBlastHoles.findIndex((point) => point === selectedHole);
			if (index !== -1) {
				// Step 25) Get the current entity name before any changes
				let currentEntityName = window.allBlastHoles[index].entityName;

				// Step 26) FIRST check for duplicates BEFORE making any changes
				if (typeof window.checkAndResolveDuplicateHoleIDs === "function") {
					// Step 27) Create a temporary copy to test for duplicates
					const testBlastHoles = JSON.parse(JSON.stringify(window.allBlastHoles));

					// Step 28) Apply the rename to the test copy
					if (allHoleBlastNamesFromForm === false) {
						// Step 29) Test single hole rename
						testBlastHoles[index].entityName = newBlastName;
						const [beforeColon, afterColon] = testBlastHoles[index].fromHoleID.split(":::");
						if (beforeColon === currentEntityName) {
							testBlastHoles[index].fromHoleID = newBlastName + ":::" + afterColon;
						}
					} else {
						// Step 30) Test all holes rename
						testBlastHoles.forEach((point) => {
							if (point.entityName === currentEntityName) {
								point.entityName = newBlastName;
								const [beforeColon, afterColon] = point.fromHoleID.split(":::");
								if (beforeColon === currentEntityName) {
									point.fromHoleID = newBlastName + ":::" + afterColon;
								}
							}
						});
					}

					// Step 31) Check for duplicates in test copy
					const duplicateResult = await window.checkAndResolveDuplicateHoleIDs(testBlastHoles, "rename");

					// Step 32) If user cancelled, abort the entire operation
					if (duplicateResult && duplicateResult.cancelled) {
						console.log("Rename operation cancelled by user");
						resolve({ isConfirmed: false, cancelled: true });
						return; // Exit without making any changes
					}

					// Step 33) CRITICAL FIX: Apply resolved changes back to original array
					if (duplicateResult && !duplicateResult.cancelled) {
						console.log("🔄 Applying resolved duplicate changes to original data...");

						// Step 34) Replace the original array with the resolved test copy
						window.allBlastHoles.length = 0; // Clear original array
						window.allBlastHoles.push(...testBlastHoles); // Copy resolved data back

					console.log("[GOOD] Applied " + testBlastHoles.length + " resolved holes to original data");

					// Step 35) Since we already applied all changes (including rename), skip the manual rename section
					// Step 36) Update tree view and save
					if (typeof window.updateTreeView === "function") {
						window.debouncedUpdateTreeView();
					}
					if (typeof window.debouncedSaveHoles === "function") {
						window.debouncedSaveHoles();
					}

					window.drawData(window.allBlastHoles, selectedHole);
					resolve({ isConfirmed: true });
					return; // Exit here since all changes are applied
					}
				}

				// Step 37) If we get here, user approved or no duplicates - proceed with actual rename
				window.drawData(window.allBlastHoles, selectedHole);

				if (allHoleBlastNamesFromForm === false) {
					// Step 38) Update only the selected hole
					console.log("Before:point.fromHoleID : " + window.allBlastHoles[index].fromHoleID);
					window.allBlastHoles[index].entityName = newBlastName;

					// Step 39) Only update fromHoleID if the part before ::: matches the old blast name
					const [beforeColon, afterColon] = window.allBlastHoles[index].fromHoleID.split(":::");
					if (beforeColon === currentEntityName) {
						window.allBlastHoles[index].fromHoleID = newBlastName + ":::" + afterColon;
						console.log("Updated fromHoleID for single hole");
					} else {
						console.log("fromHoleID not updated (before ::: doesn't match old blast name)");
					}
					console.log("After:point.fromHoleID : " + window.allBlastHoles[index].fromHoleID);
				}
				if (allHoleBlastNamesFromForm === true) {
					// Step 40) Update all holes with the same current entity name
					window.allBlastHoles.forEach((point) => {
						if (point.entityName === currentEntityName) {
							console.log("Before:point.fromHoleID : " + point.fromHoleID);
							point.entityName = newBlastName;

							// Step 41) Only update fromHoleID if the part before ::: matches the old blast name
							const [beforeColon, afterColon] = point.fromHoleID.split(":::");
							if (beforeColon === currentEntityName) {
								point.fromHoleID = newBlastName + ":::" + afterColon;
								console.log("Updated fromHoleID for hole: " + point.holeID);
							} else {
								console.log("fromHoleID not updated for hole " + point.holeID + " (before ::: doesn't match old blast name)");
							}
							console.log("After:point.fromHoleID : " + point.fromHoleID);
						}
					});
				}

				// Step 42) Check for duplicate hole IDs and adjust rowIDs when merging blasts
				if (allHoleBlastNamesFromForm === true && newBlastName !== currentEntityName) {
					// Step 43) Get the max rowID in the target blast (if it exists)
					let maxRowID = 0;
					window.allBlastHoles.forEach((point) => {
						if (point.entityName === newBlastName && point.rowID) {
							maxRowID = Math.max(maxRowID, parseInt(point.rowID) || 0);
						}
					});

					// Step 44) If merging into an existing blast, adjust rowIDs of the renamed holes
					if (maxRowID > 0) {
						console.log("Merging blast - adjusting rowIDs. Current max rowID in " + newBlastName + ": " + maxRowID);

						// Step 45) Group renamed holes by their current rowID
						const rowGroups = new Map();
						window.allBlastHoles.forEach((point) => {
							if (point.entityName === newBlastName && point.fromHoleID && point.fromHoleID.startsWith(currentEntityName + ":::")) {
								const currentRow = point.rowID || 1;
								if (!rowGroups.has(currentRow)) {
									rowGroups.set(currentRow, []);
								}
								rowGroups.get(currentRow).push(point);
							}
						});

						// Step 46) Adjust rowIDs sequentially
						let newRowID = maxRowID;
						Array.from(rowGroups.keys())
							.sort((a, b) => a - b)
							.forEach((oldRowID) => {
								newRowID++;
								rowGroups.get(oldRowID).forEach((point) => {
									console.log("Adjusting hole " + point.holeID + " from row " + oldRowID + " to row " + newRowID);
									point.rowID = newRowID;
								});
							});
					}
				}

				// Step 47) Update tree view if available
				if (typeof window.updateTreeView === "function") {
					window.debouncedUpdateTreeView();
				}

			// Step 48) Save changes to DB if available
			if (typeof window.debouncedSaveHoles === "function") {
				window.debouncedSaveHoles();
			}
		}
		window.drawData(window.allBlastHoles, selectedHole);
		resolve({ isConfirmed: true });
	},
	onCancel: () => {
		// Step 49) Clear the selection
		window.selectedHole = null;
		window.selectedPoint = null;
		window.selectedMultipleHoles = [];
		window.selectedKADObject = null;
		window.selectedMultipleKADObjects = [];
		if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
		window.debouncedUpdateTreeView();
		resolve({ isConfirmed: false });
	},
		});
		dialog.show();
	});
}

// =====================================
// EDIT HOLE TYPE DIALOG
// =====================================
// Step 50) Function to edit the hole type (Production, Perimeter, etc.)
export function editHoleTypePopup() {
	// Step 51) CHECK VISIBILITY FIRST - Don't edit hidden holes
	if (!window.selectedHole || !window.isHoleVisible(window.selectedHole)) {
		console.log("❌ Cannot edit hidden hole: " + (window.selectedHole ? window.selectedHole.holeID : "none"));
		return;
	}

	// Step 52) Get the current hole
	if (window.selectedHole) {
		const index = window.allBlastHoles.findIndex((hole) => hole === window.selectedHole);
		if (index !== -1) {
			window.clickedHole = window.allBlastHoles[index];
		}
	}

	let lastValue = window.clickedHole.holeType;

	// Step 53) Create form content with hole type field
	const fields = [
		{
			label: "Type of Hole",
			name: "holeType",
			value: lastValue || "",
			placeholder: "Type",
		},
	];

	const formContent = window.createFormContent(fields);

	const dialog = new window.FloatingDialog({
		title: 'Edit the Type of hole "' + window.selectedHole.holeID + '" ?',
		content: formContent,
		layoutType: "default",
		width: 350,
		height: 160,
		showConfirm: true,
		showCancel: true,
		confirmText: "Confirm",
		cancelText: "Cancel",
		onConfirm: () => {
			// Step 54) Get form values
			const holeTypeInput = formContent.querySelector("input[name='holeType']");
			const typeValue = holeTypeInput.value;

			if (window.selectedHole) {
				// Step 55) Update the hole type
				const index = window.allBlastHoles.findIndex((hole) => hole === window.selectedHole);
				if (index !== -1) {
					window.clickedHole = window.allBlastHoles[index];
					window.clickedHole.holeType = typeValue;

					if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
					window.debouncedUpdateTreeView();
					
					// Step 56a) Save changes to IndexedDB
					if (typeof window.debouncedSaveHoles === "function") {
						window.debouncedSaveHoles();
					}
				}
			}
		},
		onCancel: () => {
			// Step 56) Clear the selection
			window.selectedHole = null;
			window.selectedPoint = null;
			window.selectedMultipleHoles = [];
			window.selectedKADObject = null;
			window.selectedMultipleKADObjects = [];
			if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
			window.debouncedUpdateTreeView();
		},
	});

	dialog.show();

	// Step 57) Highlight the input value after dialog shows
	setTimeout(() => {
		const holeTypeInput = formContent.querySelector("input[name='holeType']");
		if (holeTypeInput) {
			holeTypeInput.focus();
			holeTypeInput.select();
		}
	}, 100);
}

// =====================================
// EDIT HOLE LENGTH DIALOG
// =====================================
// Step 58) Function to edit the calculated hole length
// Step 59) Includes validation and automatic geometry recalculation
export function editHoleLengthPopup() {
	// Step 60) CHECK VISIBILITY FIRST - Don't edit hidden holes
	if (!window.selectedHole || !window.isHoleVisible(window.selectedHole)) {
		console.log("❌ Cannot edit hidden hole: " + (window.selectedHole ? window.selectedHole.holeID : "none"));
		return;
	}

	// Step 61) Get the current hole
	if (window.selectedHole) {
		const index = window.allBlastHoles.findIndex((hole) => hole === window.selectedHole);
		if (index !== -1) {
			window.clickedHole = window.allBlastHoles[index];
		}
	}

	// Step 62) Get current calculated hole length
	let currentLength = window.clickedHole.holeLengthCalculated || 0;

	// Step 63) Create form content with hole length field
	const fields = [
		{
			label: "Hole Length (m)",
			name: "holeLength",
			type: "number",
			value: currentLength.toFixed(1),
			placeholder: "Length",
			min: "0",
			max: "100",
			step: "0.1",
		},
	];

	const formContent = window.createFormContent(fields);

	const dialog = new window.FloatingDialog({
		title: "Edit the length of hole. Hole: " + window.selectedHole.holeID + " ?",
		content: formContent,
		layoutType: "default",
		width: 350,
		height: 160,
		showConfirm: true,
		showCancel: true,
		confirmText: "Confirm",
		cancelText: "Cancel",
		onConfirm: () => {
			// Step 64) Get form values
			const lengthInput = formContent.querySelector("input[name='holeLength']");
			const lengthValue = parseFloat(lengthInput.value);

			// Step 65) Validate input
			if (isNaN(lengthValue) || lengthValue < 0 || lengthValue > 100) {
				// Step 66) Show error using FloatingDialog
				const errorDialog = new window.FloatingDialog({
					title: "Invalid Length",
					content: "Please enter a length between 0 and 100 meters.",
					layoutType: "default",
					width: 300,
					height: 120,
					showConfirm: true,
					confirmText: "OK",
					showCancel: false,
				});
				errorDialog.show();
				return;
			}

			if (window.selectedHole) {
				// Step 67) Update the hole length
				const index = window.allBlastHoles.findIndex((hole) => hole === window.selectedHole);
				if (index !== -1) {
					window.clickedHole = window.allBlastHoles[index];

					// Step 68) Update the hole length
					window.clickedHole.holeLengthCalculated = lengthValue;

					// Step 69) Calculate endXYZ and draw allBlastHoles
					window.calculateHoleGeometry(window.clickedHole, lengthValue, 1);

					// Step 70) Update the hole length label if it exists
					if (typeof window.holeLengthLabel !== "undefined" && window.holeLengthLabel) {
						window.holeLengthLabel.textContent = "Hole Length : " + lengthValue.toFixed(1) + "m";
					}

				if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }

				// Step 71a) Save changes to IndexedDB
				if (typeof window.debouncedUpdateTreeView === "function") {
					window.debouncedUpdateTreeView();
				}
				if (typeof window.debouncedSaveHoles === "function") {
					window.debouncedSaveHoles();
				}
				}
			}
		},
		onCancel: () => {
			// Step 72) Clear the selection
			window.selectedHole = null;
			window.selectedPoint = null;
			window.selectedMultipleHoles = [];
			window.selectedKADObject = null;
			window.selectedMultipleKADObjects = [];
			if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
			window.debouncedUpdateTreeView();
		},
	});

	dialog.show();

	// Step 73) Highlight the input value after dialog shows
	setTimeout(() => {
		const lengthInput = formContent.querySelector("input[name='holeLength']");
		if (lengthInput) {
			lengthInput.focus();
			lengthInput.select();
		}
	}, 100);
}

// =====================================
// MEASURED LENGTH DIALOG
// =====================================
// Step 74) Function to record measured (actual) hole length in field
// Step 75) Includes timestamp recording
export function measuredLengthPopup() {
	// Step 76) CHECK VISIBILITY FIRST - Don't edit hidden holes
	if (!window.selectedHole || !window.isHoleVisible(window.selectedHole)) {
		console.log("❌ Cannot edit hidden hole: " + (window.selectedHole ? window.selectedHole.holeID : "none"));
		return;
	}

	// Step 77) Create form content with length field
	const fields = [
		{
			label: "Length",
			name: "length",
			type: "number",
			value: "0",
			placeholder: "Length",
		},
	];

	const formContent = window.createFormContent(fields);

	const dialog = new window.FloatingDialog({
		title: "Record the measured length of hole. Hole: " + window.selectedHole.holeID + " ?",
		content: formContent,
		layoutType: "default",
		width: 350,
		height: 160,
		showConfirm: true,
		showCancel: true,
		confirmText: "Confirm",
		cancelText: "Cancel",
		onConfirm: () => {
			// Step 78) Get form values
			const lengthInput = formContent.querySelector("input[name='length']");
			const lengthValue = parseFloat(lengthInput.value);

			if (window.selectedHole) {
				console.log("selectedHole: " + window.selectedHole.holeID + " | Hole Length : " + lengthValue + "m");
				const index = window.allBlastHoles.findIndex((hole) => hole === window.selectedHole);
				if (index !== -1) {
					window.clickedHole = window.allBlastHoles[index];
					// Step 79) Set the measured length and timestamp
					window.clickedHole.measuredLength = parseFloat(lengthValue);
					window.clickedHole.measuredLengthTimeStamp = window.setMeasuredDate();

				console.log("The Hole " + window.clickedHole.holeID + " Length is : " + window.clickedHole.measuredLength + " @ " + window.clickedHole.measuredLengthTimeStamp);

				if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
				
				// Step 80a) Save changes to IndexedDB
				if (typeof window.debouncedSaveHoles === "function") {
					window.debouncedSaveHoles();
				}
				}
			}
		},
		onCancel: () => {
			// Step 80) Clear the selection
			window.selectedHole = null;
			window.selectedPoint = null;
			window.selectedMultipleHoles = [];
			window.selectedKADObject = null;
			window.selectedMultipleKADObjects = [];
			if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
			window.debouncedUpdateTreeView();
		},
	});

	dialog.show();

	// Step 81) Highlight the input value after dialog shows
	setTimeout(() => {
		const lengthInput = formContent.querySelector("input[name='length']");
		if (lengthInput) {
			lengthInput.focus();
			lengthInput.select();
		}
	}, 100);
}

// =====================================
// MEASURED MASS DIALOG
// =====================================
// Step 82) Function to record measured mass (explosive mass) for hole
// Step 83) Includes timestamp recording
export function measuredMassPopup() {
	// Step 84) CHECK VISIBILITY FIRST - Don't edit hidden holes
	if (!window.selectedHole || !window.isHoleVisible(window.selectedHole)) {
		console.log("❌ Cannot edit hidden hole: " + (window.selectedHole ? window.selectedHole.holeID : "none"));
		return;
	}

	// Step 85) Create form content with mass field
	const fields = [
		{
			label: "Mass",
			name: "mass",
			type: "number",
			value: "0",
			placeholder: "Mass",
		},
	];

	const formContent = window.createFormContent(fields);

	const dialog = new window.FloatingDialog({
		title: "Record the measured mass of hole (kg/lb) Hole: " + window.selectedHole.holeID + " ?",
		content: formContent,
		layoutType: "default",
		width: 350,
		height: 160,
		showConfirm: true,
		showCancel: true,
		confirmText: "Confirm",
		cancelText: "Cancel",
		onConfirm: () => {
			// Step 86) Get form values
			const massInput = formContent.querySelector("input[name='mass']");
			const massValue = massInput.value;

			if (window.selectedHole) {
				// Step 87) Update the hole
				const index = window.allBlastHoles.findIndex((hole) => hole === window.selectedHole);
				if (index !== -1) {
					window.clickedHole = window.allBlastHoles[index];
					// Step 88) Set the measured mass and timestamp
					window.clickedHole.measuredMass = massValue;
					window.clickedHole.measuredMassTimeStamp = window.setMeasuredDate();

				console.log("The Hole " + window.clickedHole.holeID + " Mass is : " + window.clickedHole.measuredMass + " @ " + window.clickedHole.measuredMassTimeStamp);

				if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
				
				// Step 89a) Save changes to IndexedDB
				if (typeof window.debouncedSaveHoles === "function") {
					window.debouncedSaveHoles();
				}
				}
			}
		},
		onCancel: () => {
			// Step 89) Clear the selection
			window.selectedHole = null;
			window.selectedPoint = null;
			window.selectedMultipleHoles = [];
			window.selectedKADObject = null;
			window.selectedMultipleKADObjects = [];
			if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
			window.debouncedUpdateTreeView();
		},
	});

	dialog.show();

	// Step 90) Highlight the input value after dialog shows
	setTimeout(() => {
		const massInput = formContent.querySelector("input[name='mass']");
		if (massInput) {
			massInput.focus();
			massInput.select();
		}
	}, 100);
}

// =====================================
// MEASURED COMMENT DIALOG
// =====================================
// Step 91) Function to record a comment on a hole
// Step 92) Includes timestamp recording
export function measuredCommentPopup() {
	// Step 93) CHECK VISIBILITY FIRST - Don't edit hidden holes
	if (!window.selectedHole || !window.isHoleVisible(window.selectedHole)) {
		console.log("❌ Cannot edit hidden hole: " + (window.selectedHole ? window.selectedHole.holeID : "none"));
		return;
	}

	// Step 94) Get the current hole
	if (window.selectedHole) {
		const index = window.allBlastHoles.findIndex((hole) => hole === window.selectedHole);
		if (index !== -1) {
			window.clickedHole = window.allBlastHoles[index];
		}
	}

	let lastValue = window.clickedHole.measuredComment;

	// Step 95) Create form content with comment field
	const fields = [
		{
			label: "Record Comment",
			name: "comment",
			value: lastValue || "",
			placeholder: "Comment",
		},
	];

	const formContent = window.createFormContent(fields);

	const dialog = new window.FloatingDialog({
		title: 'Record a comment on the hole "' + window.selectedHole.holeID + '" ?',
		content: formContent,
		layoutType: "default",
		width: 350,
		height: 160,
		showConfirm: true,
		showCancel: true,
		confirmText: "Confirm",
		cancelText: "Cancel",
		onConfirm: () => {
			// Step 96) Get form values
			const commentInput = formContent.querySelector("input[name='comment']");
			const commentValue = commentInput.value;

			if (window.selectedHole) {
				// Step 97) Update the hole
				const index = window.allBlastHoles.findIndex((hole) => hole === window.selectedHole);
				if (index !== -1) {
					window.clickedHole = window.allBlastHoles[index];
					// Step 98) Set the measured comment and timestamp
					window.clickedHole.measuredComment = commentValue;
					window.clickedHole.measuredCommentTimeStamp = window.setMeasuredDate();

				console.log("The Hole " + window.clickedHole.holeID + " Comment is : " + window.clickedHole.measuredComment + " @ " + window.clickedHole.measuredCommentTimeStamp);

				if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
				
				// Step 98a) Save changes to IndexedDB
				if (typeof window.debouncedSaveHoles === "function") {
					window.debouncedSaveHoles();
				}
				}
			}
		},
		onCancel: () => {
			// Step 99) Clear the selection
			window.selectedHole = null;
			window.selectedPoint = null;
			window.selectedMultipleHoles = [];
			window.selectedKADObject = null;
			window.selectedMultipleKADObjects = [];
			if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
			window.debouncedUpdateTreeView();
		},
	});

	dialog.show();

	// Step 100) Highlight the input value after dialog shows
	setTimeout(() => {
		const commentInput = formContent.querySelector("input[name='comment']");
		if (commentInput) {
			commentInput.focus();
			commentInput.select();
		}
	}, 100);
}

// =====================================
// SHORT HOLE OVERRIDE DIALOG
// =====================================
export function editShortHoleOverridePopup() {
	if (!window.selectedHole || !window.isHoleVisible(window.selectedHole)) {
		console.log("Cannot edit hidden hole: " + (window.selectedHole ? window.selectedHole.holeID : "none"));
		return;
	}

	var hole = window.selectedHole;
	var currentApply = hole.applyShortHoleCharging;
	var currentThreshold = hole.shortHoleThreshold;

	var fields = [
		{
			label: "Apply Short Hole Charging",
			name: "applyShortHole",
			type: "select",
			options: [
				{ value: "config", text: "Use config default" },
				{ value: "true", text: "Yes" },
				{ value: "false", text: "No" }
			],
			value: currentApply == null ? "config" : (currentApply ? "true" : "false")
		},
		{
			label: "Short Hole Threshold (m)",
			name: "shortHoleThreshold",
			value: currentThreshold != null ? String(currentThreshold) : "",
			placeholder: "config default"
		}
	];

	var formContent = window.createFormContent(fields);

	var dialog = new window.FloatingDialog({
		title: "Short Hole Override — " + hole.holeID,
		content: formContent,
		layoutType: "default",
		width: 380,
		height: 180,
		showConfirm: true,
		showCancel: true,
		confirmText: "Save",
		cancelText: "Cancel",
		onConfirm: function () {
			var formData = window.getFormData(formContent);

			// Parse apply value: "config" -> null, "true" -> true, "false" -> false
			if (formData.applyShortHole === "config") {
				hole.applyShortHoleCharging = null;
			} else {
				hole.applyShortHoleCharging = formData.applyShortHole === "true";
			}

			// Parse threshold: empty -> null, number -> number
			var threshStr = (formData.shortHoleThreshold || "").trim();
			if (threshStr === "") {
				hole.shortHoleThreshold = null;
			} else {
				var val = parseFloat(threshStr);
				hole.shortHoleThreshold = isNaN(val) ? null : val;
			}

			if (typeof window.debouncedSaveHoles === "function") {
				window.debouncedSaveHoles();
			}
			if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
		}
	});
	dialog.show();
}

// =====================================
// EXPOSE GLOBALLY
// =====================================
window.renameEntityDialog = renameEntityDialog;
window.editBlastNamePopup = editBlastNamePopup;
window.editHoleTypePopup = editHoleTypePopup;
window.editHoleLengthPopup = editHoleLengthPopup;
window.measuredLengthPopup = measuredLengthPopup;
window.measuredMassPopup = measuredMassPopup;
window.measuredCommentPopup = measuredCommentPopup;
window.editShortHoleOverridePopup = editShortHoleOverridePopup;

console.log("✅ HolePropertyDialogs.js: All 8 property dialog functions loaded and exposed globally");
