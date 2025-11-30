// src/dialog/contextMenu/KADContextMenu.js
//=============================================================
// KAD CONTEXT MENU
//=============================================================

// Step 1) Show KAD property editor popup for single K AD object
function showKADPropertyEditorPopup(kadObject) {
	const isMultiElement = kadObject.entityType === "line" || kadObject.entityType === "poly" || kadObject.entityType === "point" || kadObject.entityType === "circle" || kadObject.entityType === "text";

	const entity = window.getEntityFromKADObject(kadObject);
	const hasMultipleElements = entity && entity.data.length > 1;

	// Step 1a) Determine if this is a line/poly (they share the same dialog)
	const isLineOrPoly = kadObject.entityType === "line" || kadObject.entityType === "poly";

	const title = hasMultipleElements ? "Edit " + kadObject.entityType.toUpperCase() + " - " + kadObject.entityName + " - Element " + (kadObject.elementIndex + 1) : "Edit " + kadObject.entityType.toUpperCase() + " - " + kadObject.entityName;

	const currentColor = kadObject.color || "#FF0000";

	// Step 2) Define form fields using the same pattern as showHolePropertyEditor
	const fields = [
		{
			label: "Color",
			name: "editKADColor",
			type: "color",
			value: currentColor,
		},
		{
			label: "X Location",
			name: "editXLocation",
			type: "number",
			value: kadObject.pointXLocation || 0,
			step: "0.001",
		},
		{
			label: "Y Location",
			name: "editYLocation",
			type: "number",
			value: kadObject.pointYLocation || 0,
			step: "0.001",
		},
		{
			label: "Z Location",
			name: "editZLocation",
			type: "number",
			value: kadObject.pointZLocation || 0,
			step: "0.001",
		},
		{
			label: "Only Z (set all Z values to this value)",
			name: "onlyZCheckbox",
			type: "checkbox",
			checked: kadObject.onlyZ || false,
		},
	];

	// Step 3) Add specific fields based on entity type
	if (isLineOrPoly) {
		fields.push({
			label: "Line Width",
			name: "editLineWidth",
			type: "number",
			value: kadObject.lineWidth || 1,
			min: "0.1",
			max: "10",
			step: "0.1",
		});

		fields.push({
			label: "Type",
			name: "editType",
			type: "select",
			value: kadObject.entityType,
			options: [
				{
					value: "line",
					text: "Open (Line)",
				},
				{
					value: "poly",
					text: "Closed (Polygon)",
				},
			],
		});
	} else if (kadObject.entityType === "circle") {
		fields.push({
			label: "Radius",
			name: "editRadius",
			type: "number",
			value: kadObject.radius || 1,
			min: "0.1",
			max: "100",
			step: "0.1",
		});
	} else if (kadObject.entityType === "text") {
		fields.push({
			label: "Text",
			name: "editText",
			type: "text",
			value: kadObject.text || "",
		});
	} else if (kadObject.entityType === "point") {
		fields.push({
			label: "Point Diameter/Line Width",
			name: "editLineWidth",
			type: "number",
			value: kadObject.lineWidth || 1,
			min: "0.1",
			max: "10",
			step: "0.1",
		});
	}

	// Step 4) Create enhanced form content using the existing helper function
	const formContent = window.createEnhancedFormContent(fields, hasMultipleElements, false);

	// Step 4a) Add info note
	const noteDiv = document.createElement("div");
	noteDiv.style.fontSize = "12px";
	noteDiv.style.color = "#aaa";
	noteDiv.style.gridColumn = "1 / -1";
	noteDiv.style.marginTop = "10px";
	noteDiv.innerHTML = 
        "<b>All:</b> Move all points by the same offset as this point (unless Only Z is checked).<br>" +
        "<b>This:</b> Move only this point (unless Only Z is checked).";
	formContent.appendChild(noteDiv);

	// Step 5) Create the dialog with 4 buttons
	const dialog = new window.FloatingDialog({
		title: title,
		content: formContent,
		layoutType: "compact",
		showConfirm: hasMultipleElements, // Show "All" button only for multi-element objects
		showDeny: true, // "This" button
		showCancel: true, // "Cancel" button
		showOption1: true, // "Hide" button
		confirmText: "All",
		denyText: "This",
		cancelText: "Cancel",
		option1Text: "Hide",
		width: 350,
		height: isLineOrPoly ? 400 : 350,
		onConfirm: () => {
			// Step 5a) Get form values and apply to all elements
			const formData = window.getFormData(formContent);

			// Handle line/poly conversion first
			const isLineOrPoly = kadObject.entityType === "line" || kadObject.entityType === "poly";
			if (isLineOrPoly && formData.editType && formData.editType !== kadObject.entityType) {
				convertLinePolyType(kadObject, formData.editType);
			}

			// Build properties object
			const newProperties = {
				color: formData.editKADColor,
				pointXLocation: parseFloat(formData.editXLocation),
				pointYLocation: parseFloat(formData.editYLocation),
				pointZLocation: parseFloat(formData.editZLocation),
				lineWidth: formData.editLineWidth,
				radius: formData.editRadius,
				text: formData.editText,
				onlyZ: formData.onlyZCheckbox,
			};

			// Use existing function
			updateKADObjectProperties(kadObject, newProperties, "all");
			window.debouncedSaveKAD();
			window.clearAllSelectionState();
			window.drawData(window.allBlastHoles, window.selectedHole);
		},
		onDeny: () => {
			// Step 5b) Get form values and apply to this element only
			const formData = window.getFormData(formContent);

			// Handle line/poly conversion first
			const isLineOrPoly = kadObject.entityType === "line" || kadObject.entityType === "poly";
			if (isLineOrPoly && formData.editType && formData.editType !== kadObject.entityType) {
				convertLinePolyType(kadObject, formData.editType);
			}

			// Build properties object
			const newProperties = {
				color: formData.editKADColor,
				pointXLocation: parseFloat(formData.editXLocation),
				pointYLocation: parseFloat(formData.editYLocation),
				pointZLocation: parseFloat(formData.editZLocation),
				lineWidth: formData.editLineWidth,
				radius: formData.editRadius,
				text: formData.editText,
				onlyZ: formData.onlyZCheckbox,
			};

			// Use existing function
			updateKADObjectProperties(kadObject, newProperties, "element");
			window.debouncedSaveKAD();
			window.clearAllSelectionState();
			window.drawData(window.allBlastHoles, window.selectedHole);
		},
		onCancel: () => {
			// Step 5c) Just close, no changes
			window.clearAllSelectionState();
			window.drawData(window.allBlastHoles, window.selectedHole);
		},
		onOption1: () => {
			// Step 5d) Hide entire entity using the proper visibility function
			window.setKADEntityVisibility(kadObject.entityName, false);
			window.clearAllSelectionState();
			//window.debouncedSaveKAD(); don't save visbility it is only for the view.
			window.drawData(window.allBlastHoles, window.selectedHole);
			dialog.close();
		},
	});

	dialog.show();
}

// Step 6) Function to show property editor for multiple KAD objects
function showMultipleKADPropertyEditor(kadObjects) {
	if (!kadObjects || kadObjects.length === 0) return;

	// Step 6a) Create form content
	const formContent = document.createElement("div");

	// Step 6b) Common properties that can be edited for all polygons
	const fields = [
		{
			label: "Color",
			name: "editKADColor",
			type: "color",
			value: kadObjects[0].data?.[0]?.color || "#FF0000",
		},
		{
			label: "Line Width",
			name: "editLineWidth",
			type: "number",
			value: kadObjects[0].data?.[0]?.lineWidth || "2",
			step: "0.5",
			min: "0.5",
			max: "10",
		},
		{
			label: "Z Elevation",
			name: "editZLocation",
			type: "number",
			value: "0",
			step: "0.1",
		},
	];

	// Step 6c) Create form fields
	fields.forEach((field) => {
		const fieldDiv = document.createElement("div");
		fieldDiv.className = "form-field";
		fieldDiv.style.marginBottom = "10px";

		const label = document.createElement("label");
		label.textContent = field.label + ":";
		label.style.display = "inline-block";
		label.style.width = "100px";
		fieldDiv.appendChild(label);

		const input = document.createElement("input");
		input.type = field.type;
		input.name = field.name;
		input.value = field.value;

		if (field.type === "number") {
			input.step = field.step || "1";
			if (field.min) input.min = field.min;
			if (field.max) input.max = field.max;
		}

		if (field.type === "color") {
			input.className = "jscolor";
			input.setAttribute("data-jscolor", "{}");
		}

		fieldDiv.appendChild(input);
		formContent.appendChild(fieldDiv);
	});

	// Step 6d) Add note about multiple selection
	const noteDiv = document.createElement("div");
	noteDiv.style.marginTop = "15px";
	noteDiv.style.fontSize = "12px";
	noteDiv.style.color = "#666";
	noteDiv.innerHTML = "Editing " + kadObjects.length + " polygon(s)";
	formContent.appendChild(noteDiv);

	// Step 6e) Create dialog
	const dialog = new window.FloatingDialog({
		title: "Edit Multiple Polygons",
		content: formContent,
		layoutType: "default",
		width: 350,
		height: 250,
		showConfirm: true,
		showCancel: true,
		confirmText: "Apply",
		cancelText: "Cancel",
		onConfirm: () => {
			// Step 6e.1) Get form values
			const formData = window.getFormData(formContent);

			// Step 6e.2) Apply changes to all selected polygons
			kadObjects.forEach((kadObj) => {
				const entity = window.allKADDrawingsMap.get(kadObj.entityName);
				if (entity) {
					// Update all points in the polygon
					entity.data.forEach((point) => {
						if (formData.editKADColor) {
							point.color = formData.editKADColor;
						}
						if (formData.editLineWidth) {
							point.lineWidth = parseFloat(formData.editLineWidth);
						}
						if (formData.editZLocation) {
							point.pointZLocation = parseFloat(formData.editZLocation);
						}
					});
				}
			});

			// Step 6e.3) Save and redraw
			window.debouncedSaveKAD();
			window.clearAllSelectionState();
			window.drawData(window.allBlastHoles, window.selectedHole);
			window.updateStatusMessage("Updated " + kadObjects.length + " polygon(s)");
			setTimeout(() => window.updateStatusMessage(""), 2000);
		},
		onCancel: () => {
			// Step 6e.4) Just close
			window.clearAllSelectionState();
			window.drawData(window.allBlastHoles, window.selectedHole);
		},
	});

	dialog.show();

	// Step 6f) Initialize color picker if present
	if (typeof jscolor !== "undefined") {
		jscolor.install();
	}
}

// Step 7) Function to convert between line and poly
function convertLinePolyType(kadObject, newType) {
	const entity = window.getEntityFromKADObject(kadObject);
	if (!entity) return;

	// Step 7a) Update entity type
	entity.entityType = newType;

	// Step 7b) Update all data points to reflect the new type
	entity.data.forEach((point) => {
		point.entityType = newType;
		if (newType === "poly") {
			point.closed = true;
		} else {
			point.closed = false;
		}
	});

	window.updateStatusMessage("Converted " + kadObject.entityName + " to " + newType);
	window.debouncedUpdateTreeView(); // Update tree view swatches
	setTimeout(() => window.updateStatusMessage(""), 2000);
}

// Step 8) Function to update KAD object properties
function updateKADObjectProperties(kadObject, newProperties, scope = "all") {
	const map = window.allKADDrawingsMap;
	const entity = map.get(kadObject.entityName);

	if (entity) {
		const onlyZ = newProperties.onlyZ;
		if (scope === "element") {
			// Step 8a) Only this point
			const elementIndex = kadObject.elementIndex;
			if (elementIndex !== undefined && elementIndex < entity.data.length) {
				const item = entity.data[elementIndex];
				if (newProperties.color) item.color = newProperties.color;
				if (newProperties.lineWidth) item.lineWidth = parseFloat(newProperties.lineWidth);
				if (newProperties.radius) item.radius = parseFloat(newProperties.radius);
				if (newProperties.text) item.text = newProperties.text;

				if (onlyZ) {
					if (newProperties.pointZLocation !== undefined) item.pointZLocation = parseFloat(newProperties.pointZLocation);
				} else {
					if (newProperties.pointXLocation !== undefined) item.pointXLocation = parseFloat(newProperties.pointXLocation);
					if (newProperties.pointYLocation !== undefined) item.pointYLocation = parseFloat(newProperties.pointYLocation);
					if (newProperties.pointZLocation !== undefined) item.pointZLocation = parseFloat(newProperties.pointZLocation);
				}
				updateStatusMessage("Updated element " + (elementIndex + 1) + " of " + kadObject.entityType + " " + kadObject.entityName);
			}
		} else {
			// Step 8b) All points
			const elementIndex = kadObject.elementIndex;
			const item = entity.data[elementIndex];
			let dx = 0,
				dy = 0,
				dz = 0;
			if (!onlyZ && item) {
				if (newProperties.pointXLocation !== undefined) dx = parseFloat(newProperties.pointXLocation) - item.pointXLocation;
				if (newProperties.pointYLocation !== undefined) dy = parseFloat(newProperties.pointYLocation) - item.pointYLocation;
				if (newProperties.pointZLocation !== undefined) dz = parseFloat(newProperties.pointZLocation) - item.pointZLocation;
			}
			entity.data.forEach((pt) => {
				if (newProperties.color) pt.color = newProperties.color;
				if (newProperties.lineWidth) pt.lineWidth = parseFloat(newProperties.lineWidth);
				if (newProperties.radius) pt.radius = parseFloat(newProperties.radius);
				if (newProperties.text) pt.text = newProperties.text;
				if (newProperties.pointDiameter) pt.pointDiameter = parseFloat(newProperties.pointDiameter);

				if (onlyZ) {
					if (newProperties.pointZLocation !== undefined) pt.pointZLocation = parseFloat(newProperties.pointZLocation);
				} else {
					if (newProperties.pointXLocation !== undefined) pt.pointXLocation += dx;
					if (newProperties.pointYLocation !== undefined) pt.pointYLocation += dy;
					if (newProperties.pointZLocation !== undefined) pt.pointZLocation += dz;
				}
		});
		window.updateStatusMessage("Updated all elements of " + kadObject.entityType + " " + kadObject.entityName);
	}
	setTimeout(() => window.updateStatusMessage(""), 2000);
}
}

//===========================================
// KAD CONTEXT MENU END
//===========================================

// Make functions available globally
window.showKADPropertyEditorPopup = showKADPropertyEditorPopup;
window.showMultipleKADPropertyEditor = showMultipleKADPropertyEditor;
window.convertLinePolyType = convertLinePolyType;
window.updateKADObjectProperties = updateKADObjectProperties;

