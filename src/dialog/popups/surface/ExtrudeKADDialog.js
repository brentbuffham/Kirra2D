/**
 * ExtrudeKADDialog.js
 *
 * Dialog for extruding a closed KAD polygon into a 3D solid.
 * Follows the offsetKAD live-preview pattern.
 * Uses FloatingDialog + createEnhancedFormContent.
 */

import { FloatingDialog, createEnhancedFormContent, getFormData } from "../../FloatingDialog.js";
import { createPreviewMesh, applyExtrusion } from "../../../helpers/ExtrudeKADHelper.js";

var SETTINGS_KEY = "kirra_extrude_kad_settings";

function loadSavedSettings() {
	try {
		var json = localStorage.getItem(SETTINGS_KEY);
		return json ? JSON.parse(json) : null;
	} catch (e) {
		return null;
	}
}

function saveSettings(settings) {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
	} catch (e) {
		console.warn("Failed to save extrude KAD settings:", e);
	}
}

// ────────────────────────────────────────────────────────
// Module-level preview state
// ────────────────────────────────────────────────────────
var previewGroup = null;

function clearPreview() {
	if (!previewGroup) return;
	var scene = window.threeRenderer ? window.threeRenderer.scene : null;
	if (scene) {
		scene.remove(previewGroup);
	}
	// Dispose geometry + materials
	previewGroup.traverse(function (child) {
		if (child.geometry) child.geometry.dispose();
		if (child.material) child.material.dispose();
	});
	previewGroup = null;
}

function updatePreview(entity, params, color) {
	clearPreview();
	if (!window.threeRenderer || !window.threeRenderer.scene) return;

	previewGroup = createPreviewMesh(entity, params, color);
	if (previewGroup) {
		window.threeRenderer.scene.add(previewGroup);
		window.threeRenderer.render();
	}
}

// ────────────────────────────────────────────────────────
// Public: show the extrude dialog
// ────────────────────────────────────────────────────────

/**
 * Show the Extrude KAD to Solid dialog.
 * If a closed polygon is already selected, opens immediately.
 * Otherwise prompts user to click on one.
 */
export function showExtrudeKADDialog() {
	// Step 1) Check for existing selection
	var kadObject = window.selectedKADObject;
	if (kadObject && kadObject.entityType === "poly") {
		var entity = window.getEntityFromKADObject
			? window.getEntityFromKADObject(kadObject)
			: (window.allKADDrawingsMap ? window.allKADDrawingsMap.get(kadObject.entityName) : null);

		if (entity && entity.data && entity.data.length >= 3) {
			openExtrudeDialog(entity, kadObject.entityName);
			return;
		}
	}

	// Step 2) No selection — prompt user to pick one
	// Build a list of closed poly entities for a picker dialog
	var polyEntities = [];
	if (window.allKADDrawingsMap && window.allKADDrawingsMap.size > 0) {
		window.allKADDrawingsMap.forEach(function (entity, entityName) {
			if (entity.entityType === "poly" && entity.data && entity.data.length >= 3) {
				// Check if closed (poly entities are closed by default)
				var firstPt = entity.data[0];
				if (firstPt && (firstPt.closed === true || firstPt.closed === undefined)) {
					polyEntities.push({
						name: entityName,
						pointCount: entity.data.length
					});
				}
			}
		});
	}

	if (polyEntities.length === 0) {
		showInfoDialog("No closed KAD polygons found. Create a polygon first, then use this tool.");
		return;
	}

	// Step 3) Show entity picker
	showEntityPickerDialog(polyEntities, function (selectedName) {
		var entity = window.allKADDrawingsMap.get(selectedName);
		if (entity) {
			openExtrudeDialog(entity, selectedName);
		}
	});
}

// ────────────────────────────────────────────────────────
// Entity picker dialog (when nothing is pre-selected)
// ────────────────────────────────────────────────────────

function showEntityPickerDialog(polyEntities, onSelect) {
	var container = document.createElement("div");
	container.style.padding = "10px";

	var label = document.createElement("div");
	label.style.fontWeight = "bold";
	label.style.marginBottom = "8px";
	label.style.fontSize = "13px";
	label.textContent = "Select a closed polygon to extrude:";
	container.appendChild(label);

	var listDiv = document.createElement("div");
	listDiv.style.maxHeight = "250px";
	listDiv.style.overflowY = "auto";
	listDiv.style.border = "1px solid rgba(255,255,255,0.15)";
	listDiv.style.borderRadius = "4px";
	listDiv.style.padding = "6px";
	listDiv.style.background = "rgba(0,0,0,0.15)";

	var selectedRadio = null;

	polyEntities.forEach(function (pe) {
		var row = document.createElement("label");
		row.style.display = "flex";
		row.style.alignItems = "center";
		row.style.padding = "4px 6px";
		row.style.cursor = "pointer";
		row.style.borderRadius = "3px";
		row.style.fontSize = "12px";

		row.addEventListener("mouseenter", function () { row.style.background = "rgba(255,255,255,0.08)"; });
		row.addEventListener("mouseleave", function () { row.style.background = "transparent"; });

		var radio = document.createElement("input");
		radio.type = "radio";
		radio.name = "extrudeEntityPicker";
		radio.value = pe.name;
		radio.style.marginRight = "8px";
		radio.style.flexShrink = "0";
		if (!selectedRadio) {
			radio.checked = true;
			selectedRadio = radio;
		}

		var text = document.createElement("span");
		text.textContent = pe.name + " (" + pe.pointCount + " pts)";
		text.style.overflow = "hidden";
		text.style.textOverflow = "ellipsis";
		text.style.whiteSpace = "nowrap";

		row.appendChild(radio);
		row.appendChild(text);
		listDiv.appendChild(row);
	});

	container.appendChild(listDiv);

	var dialog = new FloatingDialog({
		title: "Extrude KAD — Select Polygon",
		content: container,
		width: 400,
		height: 360,
		showConfirm: true,
		confirmText: "Next",
		cancelText: "Cancel",
		onConfirm: function () {
			var radios = listDiv.querySelectorAll("input[type=radio]");
			var selected = null;
			radios.forEach(function (r) { if (r.checked) selected = r.value; });
			if (selected) {
				onSelect(selected);
			}
		}
	});
	dialog.show();
}

// ────────────────────────────────────────────────────────
// Main extrude parameter dialog with live preview
// ────────────────────────────────────────────────────────

function openExtrudeDialog(entity, entityName) {
	var saved = loadSavedSettings();

	// Step 1) Debounce timer for preview updates
	var previewDebounceTimer = null;
	var PREVIEW_DEBOUNCE_MS = 100;

	// Step 2) Build form fields
	var fields = [
		{
			label: "Depth (m) +ve=up, -ve=down",
			name: "depth",
			type: "number",
			value: saved ? saved.depth : -10,
			step: 0.5,
			min: -1000,
			max: 1000,
			tooltip: "Extrusion depth: positive = up, negative = down"
		},
		{
			label: "Steps",
			name: "steps",
			type: "number",
			value: saved ? saved.steps : 1,
			step: 1,
			min: 1,
			max: 50,
			tooltip: "Side wall vertical subdivisions"
		},
		{
			label: "Solid Color",
			name: "solidColor",
			type: "color",
			value: saved ? saved.solidColor : "#4488FF",
			tooltip: "Color of the created extruded surface"
		}
	];

	var formContent = createEnhancedFormContent(fields, false, false);

	// Step 3) Add entity info header
	var infoDiv = document.createElement("div");
	infoDiv.style.fontSize = "11px";
	infoDiv.style.color = "rgba(255,200,0,0.8)";
	infoDiv.style.marginBottom = "8px";
	infoDiv.style.padding = "4px 8px";
	infoDiv.style.background = "rgba(0,0,0,0.2)";
	infoDiv.style.borderRadius = "4px";
	infoDiv.textContent = "Polygon: " + entityName + " (" + entity.data.length + " pts, Z=" + ((entity.data[0].pointZLocation || 0).toFixed(1)) + ")";

	var wrapper = document.createElement("div");
	wrapper.appendChild(infoDiv);
	wrapper.appendChild(formContent);

	// Step 4) Add notes
	var notesDiv = document.createElement("div");
	notesDiv.style.gridColumn = "1 / -1";
	notesDiv.style.marginTop = "10px";
	notesDiv.style.fontSize = "10px";
	notesDiv.style.color = "#888";
	notesDiv.innerHTML =
		"<strong>Notes:</strong><br>" +
		"&bull; Depth: +ve = extrude up, -ve = extrude down<br>" +
		"&bull; Steps subdivide the side walls vertically<br>" +
		"&bull; Preview updates live as you change values<br>" +
		"&bull; Supports irregular Z per vertex<br>" +
		"&bull; Solid Color becomes the surface colour on creation";
	formContent.appendChild(notesDiv);

	// Step 5) Get current params from form
	function getCurrentParams() {
		var data = getFormData(formContent);
		return {
			depth: data.depth !== "" && !isNaN(parseFloat(data.depth)) ? parseFloat(data.depth) : -10,
			steps: parseInt(data.steps) || 1,
			solidColor: data.solidColor || "#4488FF"
		};
	}

	// Step 6) Debounced preview update
	function triggerPreviewUpdate() {
		if (previewDebounceTimer) {
			clearTimeout(previewDebounceTimer);
		}
		previewDebounceTimer = setTimeout(function () {
			var params = getCurrentParams();
			updatePreview(entity, params, params.solidColor);
		}, PREVIEW_DEBOUNCE_MS);
	}

	// Step 7) Attach event listeners for live preview on all inputs
	var allInputs = formContent.querySelectorAll("input, select");
	allInputs.forEach(function (input) {
		input.addEventListener("input", triggerPreviewUpdate);
		input.addEventListener("change", triggerPreviewUpdate);
	});

	// Step 8) Create dialog
	var dialog = new FloatingDialog({
		title: "Extrude KAD to Solid",
		content: wrapper,
		layoutType: "wide",
		width: 420,
		height: 400,
		showConfirm: true,
		showCancel: true,
		confirmText: "Apply",
		cancelText: "Cancel",
		onConfirm: function () {
			// Cancel pending preview updates
			if (previewDebounceTimer) {
				clearTimeout(previewDebounceTimer);
				previewDebounceTimer = null;
			}

			// Clear preview
			clearPreview();

			// Get final parameters
			var params = getCurrentParams();

			// Save settings for next time
			saveSettings(params);

			// Apply the extrusion
			var surfaceId = applyExtrusion(entity, params);
			if (surfaceId) {
				console.log("Extrude KAD applied: " + surfaceId);
			}
		},
		onCancel: function () {
			// Cancel pending preview updates
			if (previewDebounceTimer) {
				clearTimeout(previewDebounceTimer);
				previewDebounceTimer = null;
			}

			// Clear preview and redraw
			clearPreview();

			if (typeof window.redraw3D === "function") {
				window.redraw3D();
			} else if (typeof window.drawData === "function") {
				window.drawData(window.allBlastHoles, window.selectedHole);
			}
		}
	});

	dialog.show();

	// Step 9) Initialize JSColor and trigger initial preview after dialog renders
	setTimeout(function () {
		if (typeof jscolor !== "undefined") {
			jscolor.install();
			var colorInputs = formContent.querySelectorAll("[data-jscolor]");
			colorInputs.forEach(function (input) {
				if (input.jscolor) {
					input.jscolor.option("zIndex", 20000);
					input.jscolor.onFineChange = function () {
						triggerPreviewUpdate();
					};
				}
			});
		}
		// Initial preview
		triggerPreviewUpdate();
	}, 200);
}

// ────────────────────────────────────────────────────────
// Info dialog utility
// ────────────────────────────────────────────────────────

function showInfoDialog(message) {
	var content = document.createElement("div");
	content.style.padding = "15px";
	content.style.whiteSpace = "pre-wrap";
	content.textContent = message;

	var dialog = new FloatingDialog({
		title: "Extrude KAD to Solid",
		content: content,
		width: 400,
		height: 200,
		showConfirm: true,
		confirmText: "OK",
		showCancel: false
	});
	dialog.show();
}
