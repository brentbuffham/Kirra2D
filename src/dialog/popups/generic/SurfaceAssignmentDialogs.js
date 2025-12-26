// Step 1) Surface Assignment Dialogs Module
// Step 2) This module contains dialogs for assigning collar and grade elevations to holes
// Step 3) Converted from Swal2 to FloatingDialog on: 2025-12-26
// Step 4) Dependencies: FloatingDialog, createEnhancedFormContent, getFormData
// Step 5) Requires: Globals from kirra.js including selectedMultipleHoles, allBlastHoles, loadedSurfaces, etc.

console.log("✅ SurfaceAssignmentDialogs.js: Loading...");

// =====================================
// UTILITY FUNCTIONS
// =====================================

// Step 6) Calculate default grade elevation from average collar Z minus 10
function getDefaultGradeElevation() {
	var holes = window.selectedMultipleHoles && window.selectedMultipleHoles.length > 0
		? window.selectedMultipleHoles
		: window.allBlastHoles;

	if (!holes || holes.length === 0) return 274; // fallback default

	var sumZ = 0;
	var count = 0;
	for (var i = 0; i < holes.length; i++) {
		if (holes[i] && holes[i].startZLocation !== undefined) {
			sumZ += holes[i].startZLocation;
			count++;
		}
	}

	if (count === 0) return 274; // fallback

	var avgCollarZ = sumZ / count;

	// Step 7) Subtract 10m for typical bench height, round to 1 decimal
	return Math.round((avgCollarZ - 10) * 10) / 10;
}

// Step 8) Calculate default collar elevation from average collar Z
function getDefaultCollarElevation() {
	var holes = window.selectedMultipleHoles && window.selectedMultipleHoles.length > 0
		? window.selectedMultipleHoles
		: window.allBlastHoles;

	if (!holes || holes.length === 0) return 286; // fallback default

	var sumZ = 0;
	var count = 0;
	for (var i = 0; i < holes.length; i++) {
		if (holes[i] && holes[i].startZLocation !== undefined) {
			sumZ += holes[i].startZLocation;
			count++;
		}
	}

	if (count === 0) return 286; // fallback

	// Step 9) Round to 1 decimal place
	return Math.round((sumZ / count) * 10) / 10;
}

// =====================================
// ASSIGN COLLAR DIALOG
// =====================================

// Step 10) Show dialog for manual collar elevation entry (no surface loaded)
// Parameters:
//   onConfirm: function(elevation) - called when Apply is clicked
//   onCancel: function() - called when Cancel is clicked or dialog is closed
function showAssignCollarDialog(onConfirm, onCancel) {
	var defaultElevation = getDefaultCollarElevation();

	// Step 11) Create custom container for clean layout
	var container = document.createElement("div");
	container.style.display = "flex";
	container.style.flexDirection = "column";
	container.style.gap = "12px";
	container.style.padding = "8px";

	// Step 12) Info text (not an input field)
	var infoText = document.createElement("div");
	infoText.className = "labelWhite12";
	infoText.textContent = "No surface is loaded or visible.";
	infoText.style.marginBottom = "4px";
	container.appendChild(infoText);

	// Step 13) Elevation input row
	var elevationRow = document.createElement("div");
	elevationRow.style.display = "grid";
	elevationRow.style.gridTemplateColumns = "55% 45%";
	elevationRow.style.alignItems = "center";
	elevationRow.style.gap = "8px";

	var elevationLabel = document.createElement("label");
	elevationLabel.className = "labelWhite12";
	elevationLabel.textContent = "Set collar elevation to:";

	var elevationInput = document.createElement("input");
	elevationInput.type = "number";
	elevationInput.id = "collarElevationInput";
	elevationInput.value = defaultElevation;
	elevationInput.step = "0.1";
	elevationInput.className = "input-field";
	elevationInput.style.width = "100%";
	elevationInput.style.padding = "4px 8px";
	elevationInput.style.borderRadius = "4px";
	elevationInput.style.border = "1px solid var(--light-mode-border)";

	elevationRow.appendChild(elevationLabel);
	elevationRow.appendChild(elevationInput);
	container.appendChild(elevationRow);

	// Step 14) Create FloatingDialog
	var dialog = new window.FloatingDialog({
		title: "Assign Collar Elevation",
		content: container,
		layoutType: "default",
		width: 380,
		height: 200,
		showConfirm: true,
		showCancel: true,
		confirmText: "Apply",
		cancelText: "Cancel",
		onConfirm: function () {
			// Step 15) Get elevation value
			var elevation = parseFloat(elevationInput.value);

			if (isNaN(elevation)) {
				window.showModalMessage("Error", "Please enter a valid elevation", "error");
				return;
			}

			dialog.close();

			if (onConfirm && typeof onConfirm === "function") {
				onConfirm(elevation);
			}
		},
		onCancel: function () {
			dialog.close();
			// Step 15a) Call onCancel callback to reset toolbar
			if (onCancel && typeof onCancel === "function") {
				onCancel();
			}
		}
	});

	dialog.show();
	return dialog;
}

// =====================================
// ASSIGN GRADE DIALOG (ENHANCED)
// =====================================

// Step 15) Show enhanced dialog with 4 assignment modes
// Parameters:
//   visibleSurfaces: Array of {id, name} objects for available surfaces (can be empty)
//   onConfirm: function(elevation, mode, selectedSurfaceId) - called when Apply is clicked
//   onCancel: function() - called when Cancel is clicked or dialog is closed
function showAssignGradeDialog(visibleSurfaces, onConfirm, onCancel) {
	var defaultElevation = getDefaultGradeElevation();
	var surfaceSelectInput = null; // Reference to surface dropdown

	// Step 16) Create container for custom layout with descriptions
	var container = document.createElement("div");
	container.style.display = "flex";
	container.style.flexDirection = "column";
	container.style.gap = "8px";
	container.style.padding = "8px";

	// Step 17) Surface selection dropdown (if multiple surfaces available)
	if (visibleSurfaces && visibleSurfaces.length > 1) {
		var surfaceRow = document.createElement("div");
		surfaceRow.style.display = "grid";
		surfaceRow.style.gridTemplateColumns = "45% 55%";
		surfaceRow.style.alignItems = "center";
		surfaceRow.style.gap = "8px";
		surfaceRow.style.marginBottom = "4px";
		surfaceRow.style.padding = "8px";
		surfaceRow.style.backgroundColor = "var(--light-mode-surface)";
		surfaceRow.style.borderRadius = "4px";
		surfaceRow.style.border = "1px solid var(--selected-color)";

		var surfaceLabel = document.createElement("label");
		surfaceLabel.className = "labelWhite12";
		surfaceLabel.textContent = "Multiple surfaces, pick one:";

		surfaceSelectInput = document.createElement("select");
		surfaceSelectInput.id = "gradeSurfaceSelectInput";
		surfaceSelectInput.className = "floating-dialog-select";
		surfaceSelectInput.style.width = "100%";
		surfaceSelectInput.style.padding = "4px 8px";
		surfaceSelectInput.style.borderRadius = "4px";
		surfaceSelectInput.style.border = "1px solid var(--light-mode-border)";

		// Step 18) Populate surface dropdown options
		for (var i = 0; i < visibleSurfaces.length; i++) {
			var option = document.createElement("option");
			option.value = visibleSurfaces[i].id;
			option.textContent = visibleSurfaces[i].name || ("Surface " + visibleSurfaces[i].id);
			if (i === 0) option.selected = true;
			surfaceSelectInput.appendChild(option);
		}

		surfaceRow.appendChild(surfaceLabel);
		surfaceRow.appendChild(surfaceSelectInput);
		container.appendChild(surfaceRow);
	} else if (visibleSurfaces && visibleSurfaces.length === 1) {
		// Step 18a) Single surface info label
		var singleSurfaceInfo = document.createElement("div");
		singleSurfaceInfo.className = "labelWhite12";
		singleSurfaceInfo.style.padding = "6px 8px";
		singleSurfaceInfo.style.backgroundColor = "var(--light-mode-surface)";
		singleSurfaceInfo.style.borderRadius = "4px";
		singleSurfaceInfo.style.border = "1px solid var(--selected-color)";
		singleSurfaceInfo.style.marginBottom = "4px";
		singleSurfaceInfo.textContent = "Using surface: " + (visibleSurfaces[0].name || ("Surface " + visibleSurfaces[0].id));
		container.appendChild(singleSurfaceInfo);
	}

	// Step 19) Info label for mode selection
	var infoLabel = document.createElement("div");
	infoLabel.className = "labelWhite12";
	infoLabel.textContent = "Select assignment mode:";
	container.appendChild(infoLabel);

	// Step 20) Helper function to create radio option
	function createRadioOption(id, value, label, description, isChecked) {
		var option = document.createElement("div");
		option.style.display = "flex";
		option.style.flexDirection = "column";
		option.style.gap = "2px";
		option.style.padding = "6px 8px";
		option.style.border = "1px solid var(--light-mode-border)";
		option.style.borderRadius = "4px";
		option.style.cursor = "pointer";

		var radioRow = document.createElement("div");
		radioRow.style.display = "flex";
		radioRow.style.alignItems = "center";
		radioRow.style.gap = "8px";

		var radio = document.createElement("input");
		radio.type = "radio";
		radio.name = "assignMode";
		radio.value = value;
		radio.id = id;
		radio.checked = isChecked || false;

		var radioLabel = document.createElement("label");
		radioLabel.htmlFor = id;
		radioLabel.className = "labelWhite12";
		radioLabel.style.fontWeight = "bold";
		radioLabel.textContent = label;

		radioRow.appendChild(radio);
		radioRow.appendChild(radioLabel);
		option.appendChild(radioRow);

		var desc = document.createElement("div");
		desc.className = "labelWhite10";
		desc.style.marginLeft = "24px";
		desc.style.color = "var(--light-mode-text-secondary)";
		desc.style.fontSize = "10px";
		desc.innerHTML = description;
		option.appendChild(desc);

		// Click handler to select radio
		option.addEventListener("click", function () {
			radio.checked = true;
		});

		return { container: option, radio: radio };
	}

	// Step 21) Option 1: Assign GRADE, calculate Toe from Subdrill (default)
	var opt1 = createRadioOption(
		"assignModeGrade",
		"grade",
		"Assign GRADE (calc Toe from Subdrill)",
		"&#8226; ToeZ = GradeZ - Subdrill/cos(angle)<br>&#8226; Recalculates: Length, ToeXYZ",
		true
	);
	container.appendChild(opt1.container);

	// Step 22) Option 2: Assign TOE, calculate Grade from Subdrill
	var opt2 = createRadioOption(
		"assignModeToe",
		"toe",
		"Assign TOE (calc Grade from Subdrill)",
		"&#8226; GradeZ = ToeZ + Subdrill/cos(angle)<br>&#8226; Recalculates: Length, GradeXYZ",
		false
	);
	container.appendChild(opt2.container);

	// Step 23) Option 3: Assign GRADE, keep Toe fixed, calculate Subdrill
	var opt3 = createRadioOption(
		"assignModeGradeKeepToe",
		"grade_keep_toe",
		"Assign GRADE (keep Toe, calc Subdrill)",
		"&#8226; Subdrill = ToeZ - GradeZ (along hole)<br>&#8226; Toe stays in position",
		false
	);
	container.appendChild(opt3.container);

	// Step 24) Option 4: Assign TOE, keep Grade fixed, calculate Subdrill
	var opt4 = createRadioOption(
		"assignModeToeKeepGrade",
		"toe_keep_grade",
		"Assign TOE (keep Grade, calc Subdrill)",
		"&#8226; Subdrill = ToeZ - GradeZ (along hole)<br>&#8226; Grade stays in position",
		false
	);
	container.appendChild(opt4.container);

	// Step 25) Elevation input row (only shown when no surfaces available)
	var elevationRow = document.createElement("div");
	elevationRow.style.display = "grid";
	elevationRow.style.gridTemplateColumns = "50% 50%";
	elevationRow.style.alignItems = "center";
	elevationRow.style.gap = "8px";
	elevationRow.style.marginTop = "4px";

	var elevationLabel = document.createElement("label");
	elevationLabel.className = "labelWhite12";
	elevationLabel.textContent = "Elevation (mZ):";

	var elevationInput = document.createElement("input");
	elevationInput.type = "number";
	elevationInput.id = "gradeElevationInput";
	elevationInput.value = defaultElevation;
	elevationInput.step = "0.1";
	elevationInput.className = "input-field";
	elevationInput.style.width = "100%";
	elevationInput.style.padding = "4px 8px";
	elevationInput.style.borderRadius = "4px";
	elevationInput.style.border = "1px solid var(--light-mode-border)";

	// Step 26) Show/hide elevation input based on whether surfaces are available
	if (visibleSurfaces && visibleSurfaces.length > 0) {
		// Surfaces available - hide manual elevation input, will use surface
		elevationRow.style.display = "none";
	}

	elevationRow.appendChild(elevationLabel);
	elevationRow.appendChild(elevationInput);
	container.appendChild(elevationRow);

	// Step 27) Calculate dialog height based on content
	var dialogHeight = 380; // Base height for radio options
	if (visibleSurfaces && visibleSurfaces.length > 1) {
		dialogHeight += 50; // Add space for surface dropdown
	} else if (visibleSurfaces && visibleSurfaces.length === 1) {
		dialogHeight += 40; // Add space for surface info
	}
	if (!visibleSurfaces || visibleSurfaces.length === 0) {
		dialogHeight += 40; // Add space for elevation input
	}

	// Step 28) Create FloatingDialog
	var dialog = new window.FloatingDialog({
		title: "Assign Grade/Toe Elevation",
		content: container,
		layoutType: "default",
		width: 420,
		height: dialogHeight,
		showConfirm: true,
		showCancel: true,
		confirmText: "Apply",
		cancelText: "Cancel",
		onConfirm: function () {
			// Step 29) Get selected mode
			var selectedMode = document.querySelector("input[name='assignMode']:checked");
			var mode = selectedMode ? selectedMode.value : "grade";

			// Step 30) Get selected surface ID (if surfaces available)
			var selectedSurfaceId = null;
			if (surfaceSelectInput) {
				selectedSurfaceId = surfaceSelectInput.value;
			} else if (visibleSurfaces && visibleSurfaces.length === 1) {
				selectedSurfaceId = visibleSurfaces[0].id;
			}

			// Step 31) Get manual elevation (only used if no surface)
			var elevation = parseFloat(elevationInput.value);
			if (!selectedSurfaceId && isNaN(elevation)) {
				window.showModalMessage("Error", "Please enter a valid elevation", "error");
				return;
			}

			dialog.close();

			// Step 32) Call onConfirm with elevation, mode, and selectedSurfaceId
			if (onConfirm && typeof onConfirm === "function") {
				onConfirm(elevation, mode, selectedSurfaceId);
			}
		},
		onCancel: function () {
			dialog.close();
			// Step 33) Call onCancel callback to reset toolbar
			if (onCancel && typeof onCancel === "function") {
				onCancel();
			}
		}
	});

	dialog.show();
	return dialog;
}

// =====================================
// SURFACE SELECT DIALOG
// =====================================

// Step 26) Show dialog for selecting from multiple surfaces
// Parameters:
//   surfaces: Array of {id, name} objects
//   assignType: String to display in title
//   onSelect: function(surfaceId) - called when Use is clicked
//   onCancel: function() - called when Cancel is clicked or dialog is closed
function showSurfaceSelectDialog(surfaces, assignType, onSelect, onCancel) {
	console.log("showSurfaceSelectDialog called with", surfaces.length, "surfaces, assignType:", assignType);

	// Step 27) Create custom container for clean layout
	var container = document.createElement("div");
	container.style.display = "flex";
	container.style.flexDirection = "column";
	container.style.gap = "12px";
	container.style.padding = "8px";

	// Step 28) Info text (not an input field)
	var infoText = document.createElement("div");
	infoText.className = "labelWhite12";
	infoText.textContent = "Multiple surfaces are visible. Select which surface to use:";
	infoText.style.marginBottom = "4px";
	container.appendChild(infoText);

	// Step 29) Surface dropdown row
	var selectRow = document.createElement("div");
	selectRow.style.display = "grid";
	selectRow.style.gridTemplateColumns = "30% 70%";
	selectRow.style.alignItems = "center";
	selectRow.style.gap = "8px";

	var selectLabel = document.createElement("label");
	selectLabel.className = "labelWhite12";
	selectLabel.textContent = "Surface:";

	var selectInput = document.createElement("select");
	selectInput.id = "surfaceSelectInput";
	selectInput.className = "floating-dialog-select";
	selectInput.style.width = "100%";
	selectInput.style.padding = "4px 8px";
	selectInput.style.borderRadius = "4px";
	selectInput.style.border = "1px solid var(--light-mode-border)";

	// Step 30) Populate dropdown options
	for (var i = 0; i < surfaces.length; i++) {
		var option = document.createElement("option");
		option.value = surfaces[i].id;
		option.textContent = surfaces[i].name || ("Surface " + surfaces[i].id);
		if (i === 0) option.selected = true;
		selectInput.appendChild(option);
	}

	selectRow.appendChild(selectLabel);
	selectRow.appendChild(selectInput);
	container.appendChild(selectRow);

	// Step 31) Create FloatingDialog
	var dialog = new window.FloatingDialog({
		title: "Select Surface for " + assignType,
		content: container,
		layoutType: "default",
		width: 400,
		height: 200,
		showConfirm: true,
		showCancel: true,
		confirmText: "Use",
		cancelText: "Cancel",
		onConfirm: function () {
			var selectedSurfaceId = selectInput.value;

			dialog.close();

			if (onSelect && typeof onSelect === "function") {
				onSelect(selectedSurfaceId);
			}
		},
		onCancel: function () {
			dialog.close();
			// Step 31a) Call onCancel callback to reset toolbar
			if (onCancel && typeof onCancel === "function") {
				onCancel();
			}
		}
	});

	dialog.show();
	return dialog;
}

// =====================================
// ASSIGNMENT COMPLETE DIALOG
// =====================================

// Step 31) Show success message after assignment
function showAssignmentCompleteDialog(count, targetName, type) {
	var message = "Successfully adjusted " + count + " holes to " + targetName + " " + type + " elevation.";

	// Step 32) Use showModalMessage for simple success dialogs
	if (window.showModalMessage) {
		window.showModalMessage("Assignment Complete", message, "success");
	} else {
		// Step 33) Fallback to FloatingDialog
		var dialog = new window.FloatingDialog({
			title: type === "collar" ? "Surface Assignment Complete" : "Grade Assignment Complete",
			content: '<div style="text-align: center; padding: 16px;">' + message + '</div>',
			layoutType: "default",
			width: 400,
			height: 200,
			showConfirm: true,
			showCancel: false,
			confirmText: "OK",
			onConfirm: function () {
				dialog.close();
			}
		});
		dialog.show();
	}
}

// =====================================
// HOLE ELEVATION ASSIGNMENT FUNCTIONS
// =====================================

// Step 34) Assign a single hole to surface/fixed elevation
// Supports 5 modes: collar, grade, toe, grade_keep_toe, toe_keep_grade
function assignHoleToSurfaceElevation(hole, targetElevation, type) {
	if (!hole) return;

	var radAngle = hole.holeAngle * (Math.PI / 180);
	var cosAngle = Math.cos(radAngle);
	var sinAngle = Math.sin(radAngle);
	var radBearing = ((450 - hole.holeBearing) % 360) * (Math.PI / 180);

	if (type === "collar") {
		// Step 35) Keep TOE fixed, keep ANGLE and BEARING fixed
		// Move collar ALONG the existing hole vector to reach target Z elevation
		// This changes collar XYZ for angled holes, but preserves the hole direction

		// Step 35a) Save existing toe position and geometry
		var toeX = hole.endXLocation;
		var toeY = hole.endYLocation;
		var toeZ = hole.endZLocation;
		var existingSubdrill = hole.subdrillAmount;
		var existingAngle = hole.holeAngle;
		var existingBearing = hole.holeBearing;

		// Step 35b) Calculate angle components
		var radAngle = existingAngle * (Math.PI / 180);
		var cosAngle = Math.cos(radAngle);
		var sinAngle = Math.sin(radAngle);
		var radBearing = ((450 - existingBearing) % 360) * (Math.PI / 180);

		// Step 35c) Check if hole is too horizontal (can't reach target Z)
		if (Math.abs(cosAngle) < 0.001) {
			console.warn("Cannot assign collar for near-horizontal hole (angle: " + existingAngle + "°)");
			return;
		}

		// Step 35d) Calculate vertical distance from toe to new collar
		var verticalDistance = targetElevation - toeZ;

		// Step 35e) Calculate new hole length along the vector
		// Length = vertical distance / cos(angle)
		var newLength = verticalDistance / cosAngle;

		// Step 35f) Calculate horizontal distance along the vector
		var horizontalDistance = newLength * sinAngle;

		// Step 35g) Calculate new collar position (moving FROM toe TOWARD collar along vector)
		// The hole vector points from collar to toe, so we go opposite direction
		hole.startXLocation = toeX - horizontalDistance * Math.cos(radBearing);
		hole.startYLocation = toeY - horizontalDistance * Math.sin(radBearing);
		hole.startZLocation = targetElevation;

		// Step 35h) Update hole length (angle and bearing stay the same)
		hole.holeLengthCalculated = newLength;
		hole.holeAngle = existingAngle;
		hole.holeBearing = existingBearing;

		// Step 35i) Toe stays fixed
		hole.endXLocation = toeX;
		hole.endYLocation = toeY;
		hole.endZLocation = toeZ;
		hole.subdrillAmount = existingSubdrill;

		// Step 35j) Recalculate grade position (subdrill distance from toe toward collar)
		var subdrillVertical = existingSubdrill * cosAngle;
		var subdrillHorizontal = existingSubdrill * sinAngle;

		hole.gradeZLocation = toeZ + subdrillVertical;
		hole.gradeXLocation = toeX - subdrillHorizontal * Math.cos(radBearing);
		hole.gradeYLocation = toeY - subdrillHorizontal * Math.sin(radBearing);

		// Step 35k) Update bench height
		hole.benchHeight = hole.startZLocation - hole.gradeZLocation;

		console.log("Collar moved along vector to: (" + hole.startXLocation.toFixed(2) + ", " + hole.startYLocation.toFixed(2) + ", " + targetElevation.toFixed(2) + "), Length: " + newLength.toFixed(2) + "m, Angle: " + existingAngle.toFixed(1) + "° (preserved)");
	} else if (type === "grade") {
		// Step 37) Keep COLLAR fixed, keep ANGLE and BEARING fixed
		// Move GRADE along the hole vector to reach target Z, then calculate TOE from subdrill

		// Step 37a) Save existing geometry
		var collarX = hole.startXLocation;
		var collarY = hole.startYLocation;
		var collarZ = hole.startZLocation;
		var existingSubdrill = hole.subdrillAmount;
		var existingAngle = hole.holeAngle;
		var existingBearing = hole.holeBearing;

		// Step 37b) Calculate angle components
		var gradeRadAngle = existingAngle * (Math.PI / 180);
		var gradeCosAngle = Math.cos(gradeRadAngle);
		var gradeSinAngle = Math.sin(gradeRadAngle);
		var gradeRadBearing = ((450 - existingBearing) % 360) * (Math.PI / 180);

		// Step 37c) Check if hole is too horizontal
		if (Math.abs(gradeCosAngle) < 0.001) {
			console.warn("Cannot assign grade for near-horizontal hole");
			return;
		}

		// Step 37d) Calculate vertical distance from collar to grade (bench height)
		var newBenchHeight = collarZ - targetElevation;
		hole.benchHeight = newBenchHeight;

		// Step 37e) Calculate distance from collar to grade along the hole vector
		var collarToGradeLength = newBenchHeight / gradeCosAngle;
		var collarToGradeHorizontal = collarToGradeLength * gradeSinAngle;

		// Step 37f) Calculate new grade position (sliding along vector from collar)
		hole.gradeXLocation = collarX + collarToGradeHorizontal * Math.cos(gradeRadBearing);
		hole.gradeYLocation = collarY + collarToGradeHorizontal * Math.sin(gradeRadBearing);
		hole.gradeZLocation = targetElevation;

		// Step 37g) Calculate toe position (subdrill distance beyond grade along vector)
		var subdrillHorizontal = existingSubdrill * gradeSinAngle;
		var subdrillVertical = existingSubdrill * gradeCosAngle;

		hole.endXLocation = hole.gradeXLocation + subdrillHorizontal * Math.cos(gradeRadBearing);
		hole.endYLocation = hole.gradeYLocation + subdrillHorizontal * Math.sin(gradeRadBearing);
		hole.endZLocation = hole.gradeZLocation - subdrillVertical;

		// Step 37h) Calculate new hole length
		var newLength = collarToGradeLength + existingSubdrill;
		hole.holeLengthCalculated = newLength;

		// Step 37i) Angle and bearing stay the same
		hole.holeAngle = existingAngle;
		hole.holeBearing = existingBearing;
		hole.subdrillAmount = existingSubdrill;

		console.log("Grade moved along vector to: (" + hole.gradeXLocation.toFixed(2) + ", " + hole.gradeYLocation.toFixed(2) + ", " + targetElevation.toFixed(2) + "), Angle: " + existingAngle.toFixed(1) + "° (preserved)");

	} else if (type === "toe") {
		// Step 39) Keep COLLAR fixed, keep ANGLE and BEARING fixed
		// Move TOE along the hole vector to reach target Z, then calculate GRADE from subdrill

		// Step 39a) Save existing geometry
		var collarX = hole.startXLocation;
		var collarY = hole.startYLocation;
		var collarZ = hole.startZLocation;
		var existingSubdrill = hole.subdrillAmount;
		var existingAngle = hole.holeAngle;
		var existingBearing = hole.holeBearing;

		// Step 39b) Calculate angle components
		var toeRadAngle = existingAngle * (Math.PI / 180);
		var toeCosAngle = Math.cos(toeRadAngle);
		var toeSinAngle = Math.sin(toeRadAngle);
		var toeRadBearing = ((450 - existingBearing) % 360) * (Math.PI / 180);

		// Step 39c) Check if hole is too horizontal
		if (Math.abs(toeCosAngle) < 0.001) {
			console.warn("Cannot assign toe for near-horizontal hole");
			return;
		}

		// Step 39d) Calculate vertical distance from collar to toe
		var collarToToeVertical = collarZ - targetElevation;

		// Step 39e) Calculate new hole length (from collar to toe along vector)
		var newLength = collarToToeVertical / toeCosAngle;
		var collarToToeHorizontal = newLength * toeSinAngle;

		// Step 39f) Calculate new toe position (sliding along vector from collar)
		hole.endXLocation = collarX + collarToToeHorizontal * Math.cos(toeRadBearing);
		hole.endYLocation = collarY + collarToToeHorizontal * Math.sin(toeRadBearing);
		hole.endZLocation = targetElevation;

		// Step 39g) Calculate grade position (subdrill distance back from toe toward collar)
		var subdrillHorizontal = existingSubdrill * toeSinAngle;
		var subdrillVertical = existingSubdrill * toeCosAngle;

		hole.gradeXLocation = hole.endXLocation - subdrillHorizontal * Math.cos(toeRadBearing);
		hole.gradeYLocation = hole.endYLocation - subdrillHorizontal * Math.sin(toeRadBearing);
		hole.gradeZLocation = hole.endZLocation + subdrillVertical;

		// Step 39h) Update bench height and hole length
		hole.benchHeight = collarZ - hole.gradeZLocation;
		hole.holeLengthCalculated = newLength;

		// Step 39i) Angle and bearing stay the same
		hole.holeAngle = existingAngle;
		hole.holeBearing = existingBearing;
		hole.subdrillAmount = existingSubdrill;

		console.log("Toe moved along vector to: (" + hole.endXLocation.toFixed(2) + ", " + hole.endYLocation.toFixed(2) + ", " + targetElevation.toFixed(2) + "), Angle: " + existingAngle.toFixed(1) + "° (preserved)");
	} else if (type === "grade_keep_toe") {
		// Step 41) Assign GRADE elevation - keep Toe fixed, calculate new Subdrill
		// GradeZ is the input, Toe stays in place, Subdrill = (GradeZ - ToeZ) along hole direction
		hole.gradeZLocation = targetElevation;

		// Calculate new bench height
		var newBenchHeight = hole.startZLocation - targetElevation;
		hole.benchHeight = newBenchHeight;

		// Calculate new subdrill from the vertical distance between grade and toe
		// Subdrill (along hole) = vertical distance / cos(angle)
		var verticalSubdrill = targetElevation - hole.endZLocation; // Grade is above Toe
		if (Math.abs(cosAngle) > 1e-9) {
			hole.subdrillAmount = Math.abs(verticalSubdrill) / cosAngle;
		} else {
			hole.subdrillAmount = Math.abs(verticalSubdrill);
		}

		// Ensure subdrill is non-negative
		if (hole.subdrillAmount < 0) hole.subdrillAmount = 0;

		// Recalculate GradeXY based on new grade position
		var benchDrillLength = newBenchHeight / (Math.abs(cosAngle) > 1e-9 ? cosAngle : 1);
		var horizontalToGrade = benchDrillLength * sinAngle;
		hole.gradeXLocation = hole.startXLocation + horizontalToGrade * Math.cos(radBearing);
		hole.gradeYLocation = hole.startYLocation + horizontalToGrade * Math.sin(radBearing);

		// Hole length stays the same (toe is fixed)
		console.log("Grade assigned: " + targetElevation + "mZ, Toe kept at: " + hole.endZLocation.toFixed(2) + "mZ, New subdrill: " + hole.subdrillAmount.toFixed(2) + "m");

	} else if (type === "toe_keep_grade") {
		// Step 42) Assign TOE elevation - keep Grade fixed, calculate new Subdrill
		// ToeZ is the input, Grade stays in place, Subdrill = (GradeZ - ToeZ) along hole direction

		// Calculate new subdrill from the vertical distance between grade and new toe
		var verticalSubdrill = hole.gradeZLocation - targetElevation; // Grade is above Toe
		if (Math.abs(cosAngle) > 1e-9) {
			hole.subdrillAmount = Math.abs(verticalSubdrill) / cosAngle;
		} else {
			hole.subdrillAmount = Math.abs(verticalSubdrill);
		}

		// Ensure subdrill is non-negative
		if (hole.subdrillAmount < 0) hole.subdrillAmount = 0;

		// Calculate new hole length: (benchHeight + new subdrill) / cos(angle)
		if (Math.abs(cosAngle) > 1e-9) {
			var newLength = (hole.benchHeight + hole.subdrillAmount) / cosAngle;
			hole.holeLengthCalculated = newLength;

			// Recalculate ToeXYZ
			var horizontalDist = newLength * sinAngle;
			hole.endXLocation = hole.startXLocation + horizontalDist * Math.cos(radBearing);
			hole.endYLocation = hole.startYLocation + horizontalDist * Math.sin(radBearing);
			hole.endZLocation = targetElevation;
		}

		console.log("Toe assigned: " + targetElevation + "mZ, Grade kept at: " + hole.gradeZLocation.toFixed(2) + "mZ, New subdrill: " + hole.subdrillAmount.toFixed(2) + "m");
	}

	// Step 43) Save changes
	if (window.debouncedSaveHoles) {
		window.debouncedSaveHoles();
	}
}

// Step 42) Assign multiple holes to a fixed elevation
function assignHolesToFixedElevation(elevation, type) {
	var assignedCount = 0;
	var holes = window.selectedMultipleHoles;

	if (holes && holes.length > 0) {
		for (var i = 0; i < holes.length; i++) {
			assignHoleToSurfaceElevation(holes[i], elevation, type);
			assignedCount++;
		}

		// Step 43) Save all changes to IndexedDB
		if (window.debouncedSaveHoles) {
			window.debouncedSaveHoles();
		}

		// Step 44) Show success message
		var typeLabel = type === "collar" ? "collar" : (type === "grade" ? "grade" : "toe");
		showAssignmentCompleteDialog(assignedCount, elevation.toFixed(2) + "mZ", typeLabel);
	} else {
		if (window.updateStatusMessage) {
			window.updateStatusMessage("No holes selected for elevation assignment.");
		}
	}

	// Step 45) Redraw
	if (window.drawData && window.allBlastHoles) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	return assignedCount;
}

// =====================================
// EXPOSE FUNCTIONS GLOBALLY
// =====================================

// Step 46) Expose all functions via window object for backward compatibility
window.showAssignCollarDialog = showAssignCollarDialog;
window.showAssignGradeDialog = showAssignGradeDialog;
window.showSurfaceSelectDialog = showSurfaceSelectDialog;
window.showAssignmentCompleteDialog = showAssignmentCompleteDialog;
window.assignHoleToSurfaceElevation = assignHoleToSurfaceElevation;
window.assignHolesToFixedElevation = assignHolesToFixedElevation;
window.getDefaultGradeElevation = getDefaultGradeElevation;
window.getDefaultCollarElevation = getDefaultCollarElevation;

console.log("✅ SurfaceAssignmentDialogs.js: Loaded successfully");

