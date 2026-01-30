// src/dialog/popups/generic/PatternGenerationDialogs.js
//=============================================================
// PATTERN GENERATION DIALOGS MODULE
//=============================================================
// Step 0) Converted to ES Module for Vite bundling - 2025-12-26

// Step 1) Unified pattern dialog function
export function showPatternDialog(mode, worldX, worldY) {
	// Step 1a) Determine mode and defaults
	const isAddPattern = mode === "add_pattern";
	const title = isAddPattern ? "Add a Pattern?" : "Generate Pattern in Polygon";
	const localStorageKey = isAddPattern ? "savedAddPatternPopupSettings" : "savedPatternInPolygonSettings";

	// Step 1b) Load last values from localStorage
	const savedSettings = JSON.parse(localStorage.getItem(localStorageKey)) || {};
	const lastValues = {
		blastName: savedSettings.blastName || (isAddPattern ? "Created_Blast" + Date.now() : "PolygonPattern_" + Date.now()),
		nameTypeIsNumerical: savedSettings.nameTypeIsNumerical !== undefined ? savedSettings.nameTypeIsNumerical : !isAddPattern,
		startNumber: savedSettings.startNumber || 1,
		rowOrientation: savedSettings.rowOrientation || 90.0,
		x: savedSettings.x || (worldX !== undefined ? worldX : 0),
		y: savedSettings.y || (worldY !== undefined ? worldY : 0),
		z: savedSettings.z || 100,
		collarZ: savedSettings.collarZ || 0,
		useGradeZ: savedSettings.useGradeZ !== undefined ? savedSettings.useGradeZ : !isAddPattern,
		gradeZ: savedSettings.gradeZ || (isAddPattern ? 94 : 1),
		diameter: savedSettings.diameter || 115,
		type: savedSettings.type || "Production",
		angle: savedSettings.angle || 0,
		bearing: savedSettings.bearing || 180,
		length: savedSettings.length || (isAddPattern ? 6.2 : 10),
		subdrill: savedSettings.subdrill || (isAddPattern ? 1 : 1),
		spacingOffset: savedSettings.spacingOffset || 0.5,
		burden: savedSettings.burden || 3.0,
		spacing: savedSettings.spacing || 3.3,
		rows: savedSettings.rows || 6,
		holesPerRow: savedSettings.holesPerRow || 10,
		rowDirection: savedSettings.rowDirection || "return"
	};

	// Step 1c) Calculate defaults for length/gradeZ based on useGradeZ
	const elevation = isAddPattern ? lastValues.z : lastValues.collarZ;
	if (lastValues.useGradeZ) {
		const angleRad = lastValues.angle * (Math.PI / 180);
		const calculatedLength = Math.abs((elevation - lastValues.gradeZ + lastValues.subdrill) / Math.cos(angleRad));
		lastValues.length = isNaN(calculatedLength) ? lastValues.length : calculatedLength;
	} else {
		const angleRad = lastValues.angle * (Math.PI / 180);
		const calculatedGradeZ = elevation - (lastValues.length - lastValues.subdrill) * Math.cos(angleRad);
		lastValues.gradeZ = isNaN(calculatedGradeZ) ? lastValues.gradeZ : calculatedGradeZ;
	}

	// Step 1d) Ensure values are valid numbers for toFixed
	const gradeZValue = typeof lastValues.gradeZ === "number" && !isNaN(lastValues.gradeZ) ? lastValues.gradeZ.toFixed(2) : lastValues.gradeZ;
	const lengthValue = typeof lastValues.length === "number" && !isNaN(lastValues.length) ? lastValues.length.toFixed(2) : lastValues.length;

	// Step 2) Define form fields conditionally
	const fields = [{ label: "Blast Name", name: "blastName", type: "text", value: lastValues.blastName, placeholder: "Blast Name" }, { label: "Numerical Names", name: "nameTypeIsNumerical", type: "checkbox", checked: lastValues.nameTypeIsNumerical }];

	// Step 2a) Add pattern-specific fields ONLY if mode is "add_pattern"
	if (isAddPattern) {
		fields.push({ label: "Orientation", name: "rowOrientation", type: "number", value: lastValues.rowOrientation, placeholder: "Orientation", step: 0.1 }, { label: "Start X", name: "x", type: "number", value: worldX !== undefined ? worldX : lastValues.x, placeholder: "X" }, { label: "Start Y", name: "y", type: "number", value: worldY !== undefined ? worldY : lastValues.y, placeholder: "Y" }, { label: "Start Z", name: "z", type: "number", value: lastValues.z, placeholder: "Z" });
	}

	// Step 2b) Add startNumber and elevation field (different for each mode)
	if (!isAddPattern) {
		fields.push({ label: "Starting Hole Number", name: "startNumber", type: "number", value: lastValues.startNumber, step: 1 });
		fields.push({ label: "Burden (m)", name: "burden", type: "number", value: lastValues.burden, step: 0.1 });
		fields.push({ label: "Spacing (m)", name: "spacing", type: "number", value: lastValues.spacing, step: 0.1 });
		fields.push({ label: "Offset", name: "spacingOffset", type: "number", value: lastValues.spacingOffset, step: 0.1 });
		fields.push({ label: "Collar Elevation (m)", name: "collarZ", type: "number", value: lastValues.collarZ, step: 0.1 });
	}

	// Step 2c) Add common fields
	fields.push({ label: "Use Grade Z", name: "useGradeZ", type: "checkbox", checked: lastValues.useGradeZ }, { label: "Grade Elevation (m)", name: "gradeZ", type: "number", value: gradeZValue, step: 0.1, disabled: !lastValues.useGradeZ }, { label: "Length (m)", name: "length", type: "number", value: lengthValue, step: 0.1, disabled: lastValues.useGradeZ });

	// Step 2d) Add remaining common fields (different order for add pattern)
	if (isAddPattern) {
		fields.push({ label: "Diameter (mm)", name: "diameter", type: "number", value: lastValues.diameter, step: 1 });
		fields.push({ label: "Type", name: "type", type: "text", value: lastValues.type, placeholder: "Type" });
		fields.push({ label: "Angle (°)", name: "angle", type: "number", value: lastValues.angle, step: 1 });
		fields.push({ label: "Bearing (°)", name: "bearing", type: "number", value: lastValues.bearing, step: 0.1 });
		fields.push({ label: "Subdrill (m)", name: "subdrill", type: "number", value: lastValues.subdrill, step: 0.1 });
		fields.push({ label: "Offset", name: "spacingOffset", type: "number", value: lastValues.spacingOffset, step: 0.1 });
		fields.push({ label: "Burden (m)", name: "burden", type: "number", value: lastValues.burden, step: 0.1 });
		fields.push({ label: "Spacing (m)", name: "spacing", type: "number", value: lastValues.spacing, step: 0.1 });
		fields.push({ label: "Rows", name: "rows", type: "number", value: lastValues.rows, step: 1 });
		fields.push({ label: "Holes Per Row", name: "holesPerRow", type: "number", value: lastValues.holesPerRow, step: 1 });
		fields.push({ label: "Row Direction", name: "rowDirection", type: "select", options: [{ value: "return", text: "Return (Forward Only)" }, { value: "serpentine", text: "Serpentine (Forward & Back)" }], value: lastValues.rowDirection });
	} else {
		fields.push({ label: "Subdrill (m)", name: "subdrill", type: "number", value: lastValues.subdrill, step: 0.1 });
		fields.push({ label: "Hole Angle (° from vertical)", name: "angle", type: "number", value: lastValues.angle, step: 1 });
		fields.push({ label: "Hole Bearing (°)", name: "bearing", type: "number", value: lastValues.bearing, step: 0.1 });
		fields.push({ label: "Diameter (mm)", name: "diameter", type: "number", value: lastValues.diameter, step: 1 });
		fields.push({ label: "Hole Type", name: "type", type: "text", value: lastValues.type, placeholder: "Type" });
		fields.push({ label: "Row Direction", name: "rowDirection", type: "select", options: [{ value: "return", text: "Return (Forward Only)" }, { value: "serpentine", text: "Serpentine (Forward & Back)" }], value: lastValues.rowDirection });
	}

	// Step 3) Create form content using createEnhancedFormContent
	const formContent = window.createEnhancedFormContent(fields, false, false);

	// Step 3a) Add offset information note
	const offsetNote = document.createElement("div");
	offsetNote.style.gridColumn = "1 / -1";
	offsetNote.style.fontSize = "10px";
	offsetNote.style.color = "#888";
	offsetNote.style.marginTop = "5px";
	offsetNote.textContent = "Offset Information: Staggered = -0.5 or 0.5, Square = -1, 0, 1";
	formContent.appendChild(offsetNote);

	// Step 3b) Add helpful tips section
	const tipsContainer = document.createElement("div");
	tipsContainer.style.gridColumn = "1 / -1";
	tipsContainer.style.marginTop = "20px";
	tipsContainer.style.padding = "10px";
	tipsContainer.style.backgroundColor = "rgba(100, 100, 100, 0.2)";
	tipsContainer.style.borderRadius = "4px";
	tipsContainer.style.border = "1px solid rgba(255, 255, 255, 0.1)";

	const tipsTitle = document.createElement("div");
	tipsTitle.style.fontSize = "11px";
	tipsTitle.style.fontWeight = "bold";
	tipsTitle.style.color = "#aaa";
	tipsTitle.style.marginBottom = "8px";
	tipsTitle.textContent = "💡 Tips:";
	tipsContainer.appendChild(tipsTitle);

	const tip1 = document.createElement("div");
	tip1.style.fontSize = "10px";
	tip1.style.color = "#999";
	tip1.style.marginBottom = "5px";
	tip1.style.lineHeight = "1.4";
	tip1.textContent = "• Naming a blast the same as another will check the addition of holes for duplicate and overlapping holes.";
	tipsContainer.appendChild(tip1);

	const tip2 = document.createElement("div");
	tip2.style.fontSize = "10px";
	tip2.style.color = "#999";
	tip2.style.lineHeight = "1.4";
	tip2.textContent = "• Last used values are kept in the browser memory.";
	tipsContainer.appendChild(tip2);

	formContent.appendChild(tipsContainer);

	// Step 4) Create FloatingDialog with mode-specific height
	const dialogHeight = isAddPattern ? 750 : 650; // Add Pattern has more fields

	const dialog = new window.FloatingDialog({
		title: title,
		content: formContent,
		layoutType: "default",
		width: 500,
		height: dialogHeight,
		showConfirm: true,
		showCancel: true,
		confirmText: "Confirm",
		cancelText: "Cancel",
		draggable: true,
		resizable: true,
		onConfirm: () => {
			const formData = window.getFormData(formContent);
			processPatternGeneration(formData, mode, worldX, worldY);
		},
		onCancel: () => {
			// Step 4a) Truly cancel - reset any tool states
			console.log("Pattern dialog cancelled - resetting tool states");

			// Reset pattern in polygon tool if active
			if (!isAddPattern && window.patternInPolygonTool) {
				window.patternInPolygonTool.checked = false;
				window.patternInPolygonTool.dispatchEvent(new Event("change"));
			}

			// CRITICAL: Also reset the flag variable
			if (typeof window.isPatternInPolygonActive !== "undefined") {
				window.isPatternInPolygonActive = false;
			}

			// Clear any selection states
			if (window.selectedPolygon) {
				window.selectedPolygon = null;
			}
			if (window.patternStartPoint) {
				window.patternStartPoint = null;
			}
			if (window.patternEndPoint) {
				window.patternEndPoint = null;
			}
			if (window.patternReferencePoint) {
				window.patternReferencePoint = null;
			}

			// Clear window.selectedKADObject to remove highlight
			if (window.selectedKADObject) {
				window.selectedKADObject = null;
			}

			// Redraw to clear any visual indicators
			if (typeof window.drawData === "function" && window.allBlastHoles && window.selectedHole !== undefined) {
				if (typeof window.redraw3D === "function") {
					window.redraw3D();
				} else {
					window.drawData(window.allBlastHoles, window.selectedHole);
				}
			}

			dialog.close();
		}
	});

	dialog.show();

	// Step 5) Add event listeners for dynamic field updates (after show)
	setupPatternDialogEventListeners(formContent, isAddPattern);
}

// Step 6) Create event listener setup function
export function setupPatternDialogEventListeners(formContent, isAddPattern) {
	const useGradeZCheckbox = formContent.querySelector("#useGradeZ");
	const gradeZInput = formContent.querySelector("#gradeZ");
	const lengthInput = formContent.querySelector("#length");
	const angleInput = formContent.querySelector("#angle");
	const subdrillInput = formContent.querySelector("#subdrill");

	// For polygon mode, use collarZ; for pattern mode, use z
	const elevationInput = isAddPattern ? formContent.querySelector("#z") : formContent.querySelector("#collarZ");

	function updateFieldsBasedOnUseGradeZ() {
		const useGradeZ = useGradeZCheckbox.checked;
		gradeZInput.disabled = !useGradeZ;
		lengthInput.disabled = useGradeZ;

		if (useGradeZ) {
			// Calculate length from grade
			const elevation = parseFloat(elevationInput.value) || 0;
			const gradeZ = parseFloat(gradeZInput.value) || 0;
			const subdrill = parseFloat(subdrillInput.value) || 0;
			const angle = parseFloat(angleInput.value) || 0;
			const angleRad = angle * (Math.PI / 180);

			const calculatedLength = Math.abs((elevation - gradeZ + subdrill) / Math.cos(angleRad));
			lengthInput.value = calculatedLength.toFixed(2);
		} else {
			// Calculate grade from length
			const elevation = parseFloat(elevationInput.value) || 0;
			const length = parseFloat(lengthInput.value) || 0;
			const subdrill = parseFloat(subdrillInput.value) || 0;
			const angle = parseFloat(angleInput.value) || 0;
			const angleRad = angle * (Math.PI / 180);

			const calculatedGradeZ = elevation - (length - subdrill) * Math.cos(angleRad);
			gradeZInput.value = calculatedGradeZ.toFixed(2);
		}
	}

	// Add listeners
	useGradeZCheckbox.addEventListener("change", updateFieldsBasedOnUseGradeZ);
	gradeZInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	lengthInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	elevationInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	angleInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	subdrillInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);

	// Initial update
	updateFieldsBasedOnUseGradeZ();
}

// Step 7) Create processing function with validation
export function processPatternGeneration(formData, mode, worldX, worldY) {
	const isAddPattern = mode === "add_pattern";

	// Step 7a) Basic validation checks (removed restrictive min/max limits)
	if (!formData.blastName || formData.blastName.trim() === "") {
		window.showModalMessage("Invalid Blast Name", "Please enter a Blast Name.", "warning");
		return;
	}

	if (!formData.type || formData.type.trim() === "") {
		window.showModalMessage("Invalid Type", "Please enter a hole type.", "warning");
		return;
	}

	// Step 7b) Save to localStorage
	const localStorageKey = isAddPattern ? "savedAddPatternPopupSettings" : "savedPatternInPolygonSettings";
	localStorage.setItem(localStorageKey, JSON.stringify(formData));

	// Step 7c) Call appropriate generation function
	if (isAddPattern) {
		// Call addPattern with all parameters including rowDirection
		console.log("patternnameTypeIsNumerical set to:", formData.nameTypeIsNumerical);
		console.log("rowDirection set to:", formData.rowDirection);
		window.addPattern(formData.spacingOffset, formData.blastName, formData.nameTypeIsNumerical, formData.useGradeZ, formData.rowOrientation, formData.x, formData.y, formData.z, formData.gradeZ, formData.diameter, formData.type, formData.angle, formData.bearing, formData.length, formData.subdrill, formData.burden, formData.spacing, formData.rows, formData.holesPerRow, formData.rowDirection);

		// Update TreeView after adding the pattern
		if (typeof window.debouncedUpdateTreeView === "function") {
			window.debouncedUpdateTreeView();
		} else if (typeof window.updateTreeView === "function") {
			window.updateTreeView();
		}
	} else {
		// Initialize allBlastHoles array if it's null
		if (window.allBlastHoles === null) {
			window.allBlastHoles = [];
		}

		// Call generatePatternInPolygon with parameters object including rowDirection
		window.generatePatternInPolygon({
			blastName: formData.blastName,
			nameTypeIsNumerical: formData.nameTypeIsNumerical,
			useGradeZ: formData.useGradeZ,
			startNumber: formData.startNumber,
			burden: formData.burden,
			spacing: formData.spacing,
			spacingOffset: formData.spacingOffset,
			collarZ: formData.collarZ,
			gradeZ: formData.gradeZ,
			length: formData.length,
			subdrill: formData.subdrill,
			angle: formData.angle,
			bearing: formData.bearing,
			diameter: formData.diameter,
			type: formData.type,
			patternType: formData.spacingOffset === 0 ? "square" : "staggered",
			rowDirection: formData.rowDirection || "return"
		});

		// Update TreeView
		if (typeof window.debouncedUpdateTreeView === "function") {
			window.debouncedUpdateTreeView();
		}

		// Reset pattern in polygon tool
		if (window.patternInPolygonTool) {
			window.patternInPolygonTool.checked = false;
			window.patternInPolygonTool.dispatchEvent(new Event("change"));
		}
	}
}

// Step 8) Holes along polyline dialog function
export function showHolesAlongPolylinePopup(vertices, selectedPolyline) {
	// Step 8a) Generate default blast name with timestamp
	let blastNameValue = "PolylinePattern_" + Date.now();

	// Step 8b) Retrieve the last entered values from local storage
	let savedHolesAlongPolylineSettings = JSON.parse(localStorage.getItem("savedHolesAlongPolylineSettings")) || {};

	// Step 8c) Helper to convert string "true"/"false" to boolean
	const toBool = (value, defaultValue = false) => {
		if (value === undefined || value === null) return defaultValue;
		if (typeof value === "boolean") return value;
		if (typeof value === "string") return value === "true";
		return defaultValue;
	};

	let lastValues = {
		blastName: savedHolesAlongPolylineSettings.blastName || blastNameValue,
		spacing: savedHolesAlongPolylineSettings.spacing || 3.0,
		burden: savedHolesAlongPolylineSettings.burden || 3.0,
		collarZ: savedHolesAlongPolylineSettings.collarZ || 0,
		gradeZ: savedHolesAlongPolylineSettings.gradeZ || -10,
		subdrill: savedHolesAlongPolylineSettings.subdrill || 1,
		angle: savedHolesAlongPolylineSettings.angle || 0,
		bearing: savedHolesAlongPolylineSettings.bearing || 180,
		diameter: savedHolesAlongPolylineSettings.diameter || 115,
		type: savedHolesAlongPolylineSettings.type || "Production",
		startNumber: savedHolesAlongPolylineSettings.startNumber || 1,
		nameTypeIsNumerical: savedHolesAlongPolylineSettings.nameTypeIsNumerical !== undefined ? savedHolesAlongPolylineSettings.nameTypeIsNumerical : true,
		useGradeZ: savedHolesAlongPolylineSettings.useGradeZ !== undefined ? savedHolesAlongPolylineSettings.useGradeZ : true,
		useLineBearing: savedHolesAlongPolylineSettings.useLineBearing !== undefined ? savedHolesAlongPolylineSettings.useLineBearing : true,
		length: savedHolesAlongPolylineSettings.length || 10,
		reverseDirection: savedHolesAlongPolylineSettings.reverseDirection !== undefined ? savedHolesAlongPolylineSettings.reverseDirection : false
	};

	// Step 8d) Calculate default length if using grade Z
	const defaultLength = lastValues.useGradeZ ? Math.abs((lastValues.collarZ - lastValues.gradeZ + lastValues.subdrill) / Math.cos(lastValues.angle * (Math.PI / 180))) : lastValues.length;

	// Step 8e) Calculate default grade if using length
	const defaultGradeZ = !lastValues.useGradeZ ? lastValues.collarZ - (lastValues.length - lastValues.subdrill) * Math.cos(lastValues.angle * (Math.PI / 180)) : lastValues.gradeZ;

	// Step 8f) Ensure values are valid numbers for toFixed
	const gradeZValue = typeof defaultGradeZ === "number" && !isNaN(defaultGradeZ) ? defaultGradeZ.toFixed(2) : defaultGradeZ;
	const lengthValue = typeof defaultLength === "number" && !isNaN(defaultLength) ? defaultLength.toFixed(2) : defaultLength;

	// Step 8g) Build form fields array
	const fields = [
		{ label: "Blast Name", name: "blastName", type: "text", value: lastValues.blastName, placeholder: "Blast Name" },
		{ label: "Numerical Names", name: "nameTypeIsNumerical", type: "checkbox", checked: lastValues.nameTypeIsNumerical },
		{ label: "Starting Hole Number", name: "startNumber", type: "number", value: lastValues.startNumber, step: 1, min: 1, max: 9999 },
		{ label: "Spacing (m)", name: "spacing", type: "number", value: lastValues.spacing, step: 0.1, min: 0.1, max: 50 },
		{ label: "Burden (m)", name: "burden", type: "number", value: lastValues.burden, step: 0.1, min: 0.1, max: 50 },
		{ label: "Collar Elevation (m)", name: "collarZ", type: "number", value: lastValues.collarZ, step: 0.1, min: -1000, max: 5000 },
		{ label: "Use Grade Z", name: "useGradeZ", type: "checkbox", checked: lastValues.useGradeZ },
		{ label: "Grade Elevation (m)", name: "gradeZ", type: "number", value: gradeZValue, step: 0.1, min: -1000, max: 5000, disabled: !lastValues.useGradeZ },
		{ label: "Length (m)", name: "length", type: "number", value: lengthValue, step: 0.1, min: 0.1, max: 1000, disabled: lastValues.useGradeZ },
		{ label: "Subdrill (m)", name: "subdrill", type: "number", value: lastValues.subdrill, step: 0.1, min: -50, max: 50 },
		{ label: "Hole Angle (° from vertical)", name: "angle", type: "number", value: lastValues.angle, step: 1, min: 0, max: 60 },
		{ label: "Bearings are 90° to Segment", name: "useLineBearing", type: "checkbox", checked: lastValues.useLineBearing },
		{ label: "Hole Bearing (°)", name: "bearing", type: "number", value: lastValues.bearing, step: 0.1, min: 0, max: 359.999, disabled: lastValues.useLineBearing },
		{ label: "Diameter (mm)", name: "diameter", type: "number", value: lastValues.diameter, step: 1, min: 1, max: 1000 },
		{ label: "Hole Type", name: "type", type: "text", value: lastValues.type, placeholder: "Type" },
		{ label: "Reverse Direction", name: "reverseDirection", type: "checkbox", checked: lastValues.reverseDirection }
	];

	// Step 8h) Create form content using createEnhancedFormContent
	const formContent = window.createEnhancedFormContent(fields, false, false);

	// Step 8i) Add info note about selected points and bearing directions
	const infoNote = document.createElement("div");
	infoNote.style.gridColumn = "1 / -1";
	infoNote.style.fontSize = "10px";
	infoNote.style.color = "#888";
	infoNote.style.marginTop = "5px";
	infoNote.style.textAlign = "center";
	infoNote.textContent = "Selected " + vertices.length + " points | Directions: N=0°, E=90°, S=180°, W=270°";
	formContent.appendChild(infoNote);

	// Step 8j) CRITICAL: Remove canvas event listeners to prevent clicks while dialog is open
	const originalClickHandler = window.handleHolesAlongPolyLineClick;
	const originalTouchHandler = window.handleHolesAlongPolyLineClick;
	if (window.canvas) {
		window.canvas.removeEventListener("click", originalClickHandler);
		window.canvas.removeEventListener("touchstart", originalTouchHandler);
	}

	// Step 8k) Create FloatingDialog
	const dialog = new window.FloatingDialog({
		title: "Generate Holes Along Polyline",
		content: formContent,
		layoutType: "default",
		width: 350,
		height: 520,
		showConfirm: true,
		showCancel: true,
		confirmText: "OK",
		cancelText: "Cancel",
		draggable: true,
		resizable: true,
		closeOnOutsideClick: false, // Modal behavior - prevent clicks outside
		onConfirm: () => {
			// Step 8l) Retrieve values from the input fields
			const formData = window.getFormData(formContent);

			// Step 8m) Convert checkbox values to boolean
			const params = {
				blastName: formData.blastName,
				nameTypeIsNumerical: toBool(formData.nameTypeIsNumerical, true),
				useGradeZ: toBool(formData.useGradeZ, true),
				useLineBearing: toBool(formData.useLineBearing, true),
				startNumber: parseInt(formData.startNumber) || 1,
				spacing: parseFloat(formData.spacing) || 3.0,
				burden: parseFloat(formData.burden) || 3.0,
				collarZ: parseFloat(formData.collarZ) || 0,
				gradeZ: parseFloat(formData.gradeZ) || -10,
				length: parseFloat(formData.length) || 10,
				subdrill: parseFloat(formData.subdrill) || 1,
				angle: parseFloat(formData.angle) || 0,
				bearing: parseFloat(formData.bearing) || 180,
				diameter: parseFloat(formData.diameter) || 115,
				type: formData.type || "Production",
				reverseDirection: toBool(formData.reverseDirection, false)
			};

			// Step 8n) Reverse the vertices if checkbox is checked
			let finalVertices = vertices;
			if (params.reverseDirection) {
				finalVertices = [...vertices].reverse(); // Create a reversed copy
			}

			// Step 8o) Save values to localStorage
			localStorage.setItem("savedHolesAlongPolylineSettings", JSON.stringify(params));

			// Step 8p) Generate the holes along the polyline
			console.log("🔹 Calling generateHolesAlongPolyline with params:", params);
			console.log("🔹 Final vertices:", finalVertices);
			if (typeof window.generateHolesAlongPolyline === "function") {
				try {
					window.generateHolesAlongPolyline(params, finalVertices);
					console.log("✅ generateHolesAlongPolyline completed");
				} catch (error) {
					console.error("❌ Error in generateHolesAlongPolyline:", error);
					window.showModalMessage("Error", "Error generating holes: " + error.message, "error");
				}
			} else {
				console.error("❌ generateHolesAlongPolyline function not found on window object");
				window.showModalMessage("Error", "Could not generate holes - function not available.", "error");
			}

			// Step 8q) Restore canvas event listeners
			if (window.canvas) {
				window.canvas.addEventListener("click", originalClickHandler);
				window.canvas.addEventListener("touchstart", originalTouchHandler);
			}

			// Step 8r) Clear selection and reset tool state
			if (typeof window.selectedVertices !== "undefined") {
				window.selectedVertices = [];
			}
			if (typeof window.debouncedUpdateTreeView === "function") {
				window.debouncedUpdateTreeView();
			}
			if (typeof window.drawData === "function" && window.allBlastHoles !== undefined && window.selectedHole !== undefined) {
				if (typeof window.redraw3D === "function") {
					window.redraw3D();
				} else {
					window.drawData(window.allBlastHoles, window.selectedHole);
				}
			}

			// Step 8s) Deactivate tool
			if (window.holesAlongPolyLineTool) {
				window.holesAlongPolyLineTool.checked = false;
				window.holesAlongPolyLineTool.dispatchEvent(new Event("change"));
			}

			dialog.close();
		},
		onCancel: () => {
			// Step 8t) Handle cancel - restore event listeners and reset tool state
			console.log("Holes along polyline dialog cancelled - resetting tool states");

			// Step 8u) Restore canvas event listeners
			if (window.canvas) {
				window.canvas.addEventListener("click", originalClickHandler);
				window.canvas.addEventListener("touchstart", originalTouchHandler);
			}

			// Step 8v) Clear selection states
			if (typeof window.selectedPolyline !== "undefined") {
				window.selectedPolyline = null;
			}
			if (typeof window.polylineStartPoint !== "undefined") {
				window.polylineStartPoint = null;
			}
			if (typeof window.polylineEndPoint !== "undefined") {
				window.polylineEndPoint = null;
			}
			if (typeof window.polylineStep !== "undefined") {
				window.polylineStep = 0;
			}
			if (typeof window.selectedVertices !== "undefined") {
				window.selectedVertices = [];
			}

			// Step 8w) Redraw to clear any visual indicators
			if (typeof window.drawData === "function" && window.allBlastHoles !== undefined && window.selectedHole !== undefined) {
				if (typeof window.redraw3D === "function") {
					window.redraw3D();
				} else {
					window.drawData(window.allBlastHoles, window.selectedHole);
				}
			}

			// Step 8x) Reset tool
			if (window.holesAlongPolyLineTool) {
				window.holesAlongPolyLineTool.checked = false;
				window.holesAlongPolyLineTool.dispatchEvent(new Event("change"));
			}

			dialog.close();
		}
	});

	// Step 8y) Show dialog
	dialog.show();

	// Step 8z) Add event listeners for dynamic field updates (after show)
	setupHolesAlongPolylineEventListeners(formContent);
}

// Step 9) Create event listener setup function for dynamic field updates
export function setupHolesAlongPolylineEventListeners(formContent) {
	const useGradeZCheckbox = formContent.querySelector("#useGradeZ");
	const gradeZInput = formContent.querySelector("#gradeZ");
	const lengthInput = formContent.querySelector("#length");
	const collarZInput = formContent.querySelector("#collarZ");
	const angleInput = formContent.querySelector("#angle");
	const subdrillInput = formContent.querySelector("#subdrill");
	const useLineBearingCheckbox = formContent.querySelector("#useLineBearing");
	const bearingInput = formContent.querySelector("#bearing");

	if (!useGradeZCheckbox || !gradeZInput || !lengthInput || !collarZInput || !angleInput || !subdrillInput || !useLineBearingCheckbox || !bearingInput) {
		console.error("Missing required form elements for Holes Along Polyline dialog");
		return;
	}

	// Step 9a) Function to update fields based on checkbox state
	function updateFieldsBasedOnUseGradeZ() {
		const useGradeZ = useGradeZCheckbox.checked;

		// Step 9b) Enable/disable fields
		gradeZInput.disabled = !useGradeZ;
		lengthInput.disabled = useGradeZ;

		// Step 9c) Update opacity to match disabled state
		if (useGradeZ) {
			gradeZInput.style.opacity = "1";
			lengthInput.style.opacity = "0.5";
		} else {
			gradeZInput.style.opacity = "0.5";
			lengthInput.style.opacity = "1";
		}

		// Step 9d) Update calculations
		if (useGradeZ) {
			// Calculate length from grade
			const collarZ = parseFloat(collarZInput.value) || 0;
			const gradeZ = parseFloat(gradeZInput.value) || 0;
			const subdrill = parseFloat(subdrillInput.value) || 0;
			const angle = parseFloat(angleInput.value) || 0;
			const angleRad = angle * (Math.PI / 180);

			const calculatedLength = Math.abs((collarZ - gradeZ + subdrill) / Math.cos(angleRad));
			lengthInput.value = calculatedLength.toFixed(2);
		} else {
			// Calculate grade from length
			const collarZ = parseFloat(collarZInput.value) || 0;
			const length = parseFloat(lengthInput.value) || 0;
			const subdrill = parseFloat(subdrillInput.value) || 0;
			const angle = parseFloat(angleInput.value) || 0;
			const angleRad = angle * (Math.PI / 180);

			const calculatedGradeZ = collarZ - (length - subdrill) * Math.cos(angleRad);
			gradeZInput.value = calculatedGradeZ.toFixed(2);
		}
	}

	// Step 9e) Function to handle line bearing checkbox
	function updateBearingField() {
		const useLineBearing = useLineBearingCheckbox.checked;
		bearingInput.disabled = useLineBearing;

		// Step 9f) Update opacity to match disabled state
		if (useLineBearing) {
			bearingInput.style.opacity = "0.5";
		} else {
			bearingInput.style.opacity = "1";
		}
	}

	// Step 9g) Add event listeners for changes
	useGradeZCheckbox.addEventListener("change", updateFieldsBasedOnUseGradeZ);
	gradeZInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	lengthInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	collarZInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	angleInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	subdrillInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	useLineBearingCheckbox.addEventListener("change", updateBearingField);

	// Step 9h) Initial update
	updateFieldsBasedOnUseGradeZ();
	updateBearingField();
}

// Step 10) Holes along line dialog function
export function showHolesAlongLinePopup() {
	// Step 10a) Generate default blast name with timestamp
	let blastNameValue = "LinePattern_" + Date.now();

	// Step 10b) Retrieve the last entered values from local storage
	let savedHolesAlongLineSettings = JSON.parse(localStorage.getItem("savedHolesAlongLineSettings")) || {};

	// Step 10c) Helper to convert string "true"/"false" to boolean
	const toBool = (value, defaultValue = false) => {
		if (value === undefined || value === null) return defaultValue;
		if (typeof value === "boolean") return value;
		if (typeof value === "string") return value === "true";
		return defaultValue;
	};

	let lastValues = {
		blastName: savedHolesAlongLineSettings.blastName || blastNameValue,
		spacing: savedHolesAlongLineSettings.spacing || 3.0,
		burden: savedHolesAlongLineSettings.burden || 3.0,
		collarZ: savedHolesAlongLineSettings.collarZ || 0,
		gradeZ: savedHolesAlongLineSettings.gradeZ || -10,
		subdrill: savedHolesAlongLineSettings.subdrill || 1,
		angle: savedHolesAlongLineSettings.angle || 0,
		bearing: savedHolesAlongLineSettings.bearing || 180,
		diameter: savedHolesAlongLineSettings.diameter || 115,
		type: savedHolesAlongLineSettings.type || "Production",
		startNumber: savedHolesAlongLineSettings.startNumber || 1,
		nameTypeIsNumerical: savedHolesAlongLineSettings.nameTypeIsNumerical !== undefined ? savedHolesAlongLineSettings.nameTypeIsNumerical : true,
		useGradeZ: savedHolesAlongLineSettings.useGradeZ !== undefined ? savedHolesAlongLineSettings.useGradeZ : true,
		useLineBearing: savedHolesAlongLineSettings.useLineBearing !== undefined ? savedHolesAlongLineSettings.useLineBearing : true,
		length: savedHolesAlongLineSettings.length || 10
	};

	// Step 10d) Calculate default length if using grade Z
	const defaultLength = lastValues.useGradeZ ? Math.abs((lastValues.collarZ - lastValues.gradeZ + lastValues.subdrill) / Math.cos(lastValues.angle * (Math.PI / 180))) : lastValues.length;

	// Step 10e) Calculate default grade if using length
	const defaultGradeZ = !lastValues.useGradeZ ? lastValues.collarZ - (lastValues.length - lastValues.subdrill) * Math.cos(lastValues.angle * (Math.PI / 180)) : lastValues.gradeZ;

	// Step 10f) Ensure values are valid numbers for toFixed
	const gradeZValue = typeof defaultGradeZ === "number" && !isNaN(defaultGradeZ) ? defaultGradeZ.toFixed(2) : defaultGradeZ;
	const lengthValue = typeof defaultLength === "number" && !isNaN(defaultLength) ? defaultLength.toFixed(2) : defaultLength;

	// Step 10g) Calculate line bearing for display
	let lineBearing = 0;
	if (window.lineStartPoint && window.lineEndPoint) {
		const dx = window.lineEndPoint.x - window.lineStartPoint.x;
		const dy = window.lineEndPoint.y - window.lineStartPoint.y;
		// In world coordinates: North = 0°, East = 90°, South = 180°, West = 270°
		// Since +Y is North in world coordinates, we need to use atan2(dx, dy) not atan2(dy, dx)
		lineBearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
	}
	const perpBearing = (lineBearing + 90) % 360;

	// Step 10h) Build form fields array
	const fields = [
		{ label: "Blast Name", name: "blastName", type: "text", value: lastValues.blastName, placeholder: "Blast Name" },
		{ label: "Numerical Names", name: "nameTypeIsNumerical", type: "checkbox", checked: lastValues.nameTypeIsNumerical },
		{ label: "Starting Hole Number", name: "startNumber", type: "number", value: lastValues.startNumber, step: 1, min: 1, max: 9999 },
		{ label: "Spacing (m)", name: "spacing", type: "number", value: lastValues.spacing, step: 0.1, min: 0.1, max: 50 },
		{ label: "Burden (m)", name: "burden", type: "number", value: lastValues.burden, step: 0.1, min: 0.1, max: 50 },
		{ label: "Collar Elevation (m)", name: "collarZ", type: "number", value: lastValues.collarZ, step: 0.1, min: -1000, max: 5000 },
		{ label: "Use Grade Z", name: "useGradeZ", type: "checkbox", checked: lastValues.useGradeZ },
		{ label: "Grade Elevation (m)", name: "gradeZ", type: "number", value: gradeZValue, step: 0.1, min: -1000, max: 5000, disabled: !lastValues.useGradeZ },
		{ label: "Length (m)", name: "length", type: "number", value: lengthValue, step: 0.1, min: 0.1, max: 1000, disabled: lastValues.useGradeZ },
		{ label: "Subdrill (m)", name: "subdrill", type: "number", value: lastValues.subdrill, step: 0.1, min: -50, max: 50 },
		{ label: "Hole Angle (° from vertical)", name: "angle", type: "number", value: lastValues.angle, step: 1, min: 0, max: 60 },
		{ label: "Bearings are 90° to Row", name: "useLineBearing", type: "checkbox", checked: lastValues.useLineBearing },
		{ label: "Hole Bearing (°)", name: "bearing", type: "number", value: lastValues.bearing, step: 0.1, min: 0, max: 359.999, disabled: lastValues.useLineBearing },
		{ label: "Diameter (mm)", name: "diameter", type: "number", value: lastValues.diameter, step: 1, min: 1, max: 1000 },
		{ label: "Hole Type", name: "type", type: "text", value: lastValues.type, placeholder: "Type" }
	];

	// Step 10i) Create form content using createEnhancedFormContent
	const formContent = window.createEnhancedFormContent(fields, false, false);

	// Step 10j) Add info notes about line bearing and directions
	const bearingInfo = document.createElement("div");
	bearingInfo.style.gridColumn = "1 / -1";
	bearingInfo.style.fontSize = "10px";
	bearingInfo.style.color = "#888";
	bearingInfo.style.marginTop = "5px";
	bearingInfo.style.textAlign = "center";
	bearingInfo.style.display = "flex";
	bearingInfo.style.flexDirection = "column";
	bearingInfo.style.gap = "2px";

	const rowBearingDiv = document.createElement("div");
	rowBearingDiv.textContent = "Row Bearing: " + lineBearing.toFixed(1) + "°";
	bearingInfo.appendChild(rowBearingDiv);

	const perpBearingDiv = document.createElement("div");
	perpBearingDiv.textContent = "Perpendicular Bearing: " + perpBearing.toFixed(1) + "°";
	bearingInfo.appendChild(perpBearingDiv);

	const directionsDiv = document.createElement("div");
	directionsDiv.textContent = "Directions: N=0°, E=90°, S=180°, W=270°";
	bearingInfo.appendChild(directionsDiv);

	formContent.appendChild(bearingInfo);

	// Step 10k) CRITICAL: Remove canvas event listeners to prevent clicks while dialog is open
	const originalClickHandler = window.handleHolesAlongLineClick;
	const originalTouchHandler = window.handleHolesAlongLineClick;
	if (window.canvas) {
		window.canvas.removeEventListener("click", originalClickHandler);
		window.canvas.removeEventListener("touchstart", originalTouchHandler);
	}

	// Step 10l) Create FloatingDialog
	const dialog = new window.FloatingDialog({
		title: "Generate Holes Along Line",
		content: formContent,
		layoutType: "default",
		width: 350,
		height: 520,
		showConfirm: true,
		showCancel: true,
		confirmText: "OK",
		cancelText: "Cancel",
		draggable: true,
		resizable: true,
		closeOnOutsideClick: false, // Modal behavior - prevent clicks outside
		onConfirm: () => {
			// Step 10m) Retrieve values from the input fields
			const formData = window.getFormData(formContent);

			// Step 10n) Convert checkbox values to boolean
			const params = {
				blastName: formData.blastName,
				nameTypeIsNumerical: toBool(formData.nameTypeIsNumerical, true),
				useGradeZ: toBool(formData.useGradeZ, true),
				useLineBearing: toBool(formData.useLineBearing, true),
				startNumber: parseInt(formData.startNumber) || 1,
				spacing: parseFloat(formData.spacing) || 3.0,
				burden: parseFloat(formData.burden) || 3.0,
				collarZ: parseFloat(formData.collarZ) || 0,
				gradeZ: parseFloat(formData.gradeZ) || -10,
				length: parseFloat(formData.length) || 10,
				subdrill: parseFloat(formData.subdrill) || 1,
				angle: parseFloat(formData.angle) || 0,
				bearing: parseFloat(formData.bearing) || 180,
				diameter: parseFloat(formData.diameter) || 115,
				type: formData.type || "Production"
			};

			// Step 10o) Validation checks
			if (!params.blastName || params.blastName.trim() === "") {
				window.showModalMessage("Invalid Blast Name", "Please enter a Blast Name.", "warning");
				// Restore canvas event listeners before returning
				if (window.canvas) {
					window.canvas.addEventListener("click", originalClickHandler);
					window.canvas.addEventListener("touchstart", originalTouchHandler);
				}
				return;
			}

			if (isNaN(params.spacing) || params.spacing <= 0) {
				window.showModalMessage("Invalid Spacing", "Please enter a positive spacing value.", "warning");
				// Restore canvas event listeners before returning
				if (window.canvas) {
					window.canvas.addEventListener("click", originalClickHandler);
					window.canvas.addEventListener("touchstart", originalTouchHandler);
				}
				return;
			}

			// Step 10p) Save values to localStorage
			localStorage.setItem("savedHolesAlongLineSettings", JSON.stringify(params));

			// Step 10q) Generate the holes along the line
			// Note: bearing adjustment (-90) is handled in generateHolesAlongLine
			if (typeof window.generateHolesAlongLine === "function") {
				window.generateHolesAlongLine({
					blastName: params.blastName,
					nameTypeIsNumerical: params.nameTypeIsNumerical,
					useGradeZ: params.useGradeZ,
					useLineBearing: params.useLineBearing,
					startNumber: params.startNumber,
					spacing: params.spacing,
					burden: params.burden,
					collarZ: params.collarZ,
					gradeZ: params.gradeZ,
					length: params.length,
					subdrill: params.subdrill,
					angle: params.angle,
					bearing: params.bearing - 90,
					diameter: params.diameter,
					type: params.type
				});
			} else {
				console.error("❌ generateHolesAlongLine function not found on window object");
				window.showModalMessage("Error", "Could not generate holes - function not available.", "error");
			}

			// Step 10r) Restore canvas event listeners
			if (window.canvas) {
				window.canvas.addEventListener("click", originalClickHandler);
				window.canvas.addEventListener("touchstart", originalTouchHandler);
			}

			// Step 10s) Reset tool state
			if (typeof window.debouncedUpdateTreeView === "function") {
				window.debouncedUpdateTreeView();
			}
			if (window.holesAlongLineTool) {
				window.holesAlongLineTool.checked = false;
				window.holesAlongLineTool.dispatchEvent(new Event("change"));
			}

			dialog.close();
		},
		onCancel: () => {
			// Step 10t) Handle cancel - restore event listeners and reset tool state
			console.log("Holes along line dialog cancelled - resetting tool states");

			// Step 10u) Restore canvas event listeners
			if (window.canvas) {
				window.canvas.addEventListener("click", originalClickHandler);
				window.canvas.addEventListener("touchstart", originalTouchHandler);
			}

			// Step 10v) Clear selection states
			if (typeof window.lineStartPoint !== "undefined") {
				window.lineStartPoint = null;
			}
			if (typeof window.lineEndPoint !== "undefined") {
				window.lineEndPoint = null;
			}
			if (typeof window.holesLineStep !== "undefined") {
				window.holesLineStep = 0;
			}

			// Step 10w) Redraw to clear any visual indicators
			if (typeof window.drawData === "function" && window.allBlastHoles !== undefined && window.selectedHole !== undefined) {
				if (typeof window.redraw3D === "function") {
					window.redraw3D();
				} else {
					window.drawData(window.allBlastHoles, window.selectedHole);
				}
			}

			// Step 10x) Reset tool
			if (window.holesAlongLineTool) {
				window.holesAlongLineTool.checked = false;
				window.holesAlongLineTool.dispatchEvent(new Event("change"));
			}

			dialog.close();
		}
	});

	// Step 10y) Show dialog
	dialog.show();

	// Step 10z) Add event listeners for dynamic field updates (after show)
	setupHolesAlongLineEventListeners(formContent);
}

// Step 11) Create event listener setup function for dynamic field updates
export function setupHolesAlongLineEventListeners(formContent) {
	const useGradeZCheckbox = formContent.querySelector("#useGradeZ");
	const gradeZInput = formContent.querySelector("#gradeZ");
	const lengthInput = formContent.querySelector("#length");
	const collarZInput = formContent.querySelector("#collarZ");
	const angleInput = formContent.querySelector("#angle");
	const subdrillInput = formContent.querySelector("#subdrill");
	const useLineBearingCheckbox = formContent.querySelector("#useLineBearing");
	const bearingInput = formContent.querySelector("#bearing");

	if (!useGradeZCheckbox || !gradeZInput || !lengthInput || !collarZInput || !angleInput || !subdrillInput || !useLineBearingCheckbox || !bearingInput) {
		console.error("Missing required form elements for Holes Along Line dialog");
		return;
	}

	// Step 11a) Function to update fields based on checkbox state
	function updateFieldsBasedOnUseGradeZ() {
		const useGradeZ = useGradeZCheckbox.checked;

		// Step 11b) Enable/disable fields
		gradeZInput.disabled = !useGradeZ;
		lengthInput.disabled = useGradeZ;

		// Step 11c) Update opacity to match disabled state
		if (useGradeZ) {
			gradeZInput.style.opacity = "1";
			lengthInput.style.opacity = "0.5";
		} else {
			gradeZInput.style.opacity = "0.5";
			lengthInput.style.opacity = "1";
		}

		// Step 11d) Update calculations
		if (useGradeZ) {
			// Calculate length from grade
			const collarZ = parseFloat(collarZInput.value) || 0;
			const gradeZ = parseFloat(gradeZInput.value) || 0;
			const subdrill = parseFloat(subdrillInput.value) || 0;
			const angle = parseFloat(angleInput.value) || 0;
			const angleRad = angle * (Math.PI / 180);

			const calculatedLength = Math.abs((collarZ - gradeZ + subdrill) / Math.cos(angleRad));
			lengthInput.value = calculatedLength.toFixed(2);
		} else {
			// Calculate grade from length
			const collarZ = parseFloat(collarZInput.value) || 0;
			const length = parseFloat(lengthInput.value) || 0;
			const subdrill = parseFloat(subdrillInput.value) || 0;
			const angle = parseFloat(angleInput.value) || 0;
			const angleRad = angle * (Math.PI / 180);

			const calculatedGradeZ = collarZ - (length - subdrill) * Math.cos(angleRad);
			gradeZInput.value = calculatedGradeZ.toFixed(2);
		}
	}

	// Step 11e) Function to handle line bearing checkbox
	function updateBearingField() {
		const useLineBearing = useLineBearingCheckbox.checked;
		bearingInput.disabled = useLineBearing;

		// Step 11f) Update opacity to match disabled state
		if (useLineBearing) {
			bearingInput.style.opacity = "0.5";
		} else {
			bearingInput.style.opacity = "1";
		}
	}

	// Step 11g) Add event listeners for changes
	useGradeZCheckbox.addEventListener("change", updateFieldsBasedOnUseGradeZ);
	gradeZInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	lengthInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	collarZInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	angleInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	subdrillInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
	useLineBearingCheckbox.addEventListener("change", updateBearingField);

	// Step 11h) Initial update
	updateFieldsBasedOnUseGradeZ();
	updateBearingField();
}

//=============================================================
// EXPOSE GLOBALS
//=============================================================

window.showPatternDialog = showPatternDialog;
window.setupPatternDialogEventListeners = setupPatternDialogEventListeners;
window.processPatternGeneration = processPatternGeneration;
window.showHolesAlongPolylinePopup = showHolesAlongPolylinePopup;
window.setupHolesAlongPolylineEventListeners = setupHolesAlongPolylineEventListeners;
window.showHolesAlongLinePopup = showHolesAlongLinePopup;
window.setupHolesAlongLineEventListeners = setupHolesAlongLineEventListeners;
