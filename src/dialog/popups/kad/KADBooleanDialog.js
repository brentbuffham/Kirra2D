/**
 * KADBooleanDialog.js
 *
 * Dialog for 2D boolean operations on KAD polygon entities.
 * Uses screen-selected polygons (N >= 2) when available.
 * Falls back to dropdown pickers if fewer than 2 are selected.
 *
 * For Union/XOR: all selected polys are combined.
 * For Intersect/Difference: first selected is subject (A), rest are clips.
 * Uses FloatingDialog + createEnhancedFormContent.
 */

import { FloatingDialog, createEnhancedFormContent, getFormData } from "../../FloatingDialog.js";
import { kadBoolean } from "../../../helpers/KADBooleanHelper.js";

// ────────────────────────────────────────────────────────
// Public: show the KAD Boolean dialog
// ────────────────────────────────────────────────────────

export function showKADBooleanDialog() {
	// Step 1) Gather all closed polys available
	var allPolys = getAllClosedPolys();

	if (allPolys.length < 2) {
		showInfoDialog("Need at least 2 closed KAD polygons.\nCreate polygons first, then use this tool.");
		return;
	}

	// Step 2) Gather selected closed poly entity names from screen selection
	var selectedPolys = getSelectedClosedPolys();

	if (selectedPolys.length >= 2) {
		// 2+ selected — open directly with selection
		openSelectionDialog(selectedPolys);
	} else {
		// 0 or 1 selected — fall back to dropdown picker
		openPickerDialog(allPolys, selectedPolys);
	}
}

// ────────────────────────────────────────────────────────
// Selection helpers
// ────────────────────────────────────────────────────────

function getSelectedClosedPolys() {
	var result = [];
	var seen = {};

	// Multi-selection first (shift-click)
	var multi = window.selectedMultipleKADObjects || [];
	for (var i = 0; i < multi.length; i++) {
		var obj = multi[i];
		if (obj.entityType === "poly" && obj.entityName && !seen[obj.entityName]) {
			if (isClosedPoly(obj.entityName)) {
				result.push(obj.entityName);
				seen[obj.entityName] = true;
			}
		}
	}

	// Single selection
	var single = window.selectedKADObject;
	if (single && single.entityType === "poly" && single.entityName && !seen[single.entityName]) {
		if (isClosedPoly(single.entityName)) {
			result.push(single.entityName);
			seen[single.entityName] = true;
		}
	}

	return result;
}

function getAllClosedPolys() {
	var result = [];
	if (window.allKADDrawingsMap && window.allKADDrawingsMap.size > 0) {
		window.allKADDrawingsMap.forEach(function (entity, entityName) {
			if (entity.entityType === "poly" && entity.data && entity.data.length >= 3) {
				var firstPt = entity.data[0];
				if (firstPt && (firstPt.closed === true || firstPt.closed === undefined)) {
					result.push({
						name: entityName,
						pointCount: entity.data.length
					});
				}
			}
		});
	}
	return result;
}

function isClosedPoly(entityName) {
	var entity = window.allKADDrawingsMap ? window.allKADDrawingsMap.get(entityName) : null;
	if (!entity || !entity.data || entity.data.length < 3) return false;
	var firstPt = entity.data[0];
	return firstPt && (firstPt.closed === true || firstPt.closed === undefined);
}

function getPointCount(entityName) {
	var entity = window.allKADDrawingsMap ? window.allKADDrawingsMap.get(entityName) : null;
	return entity && entity.data ? entity.data.length : 0;
}

// ────────────────────────────────────────────────────────
// Dialog A: 2+ polys from screen selection
// ────────────────────────────────────────────────────────

function openSelectionDialog(entityNames) {
	var container = document.createElement("div");

	// Selection summary header
	var infoDiv = document.createElement("div");
	infoDiv.style.fontSize = "11px";
	infoDiv.style.color = "rgba(255,200,0,0.8)";
	infoDiv.style.marginBottom = "10px";
	infoDiv.style.padding = "6px 8px";
	infoDiv.style.background = "rgba(0,0,0,0.2)";
	infoDiv.style.borderRadius = "4px";
	infoDiv.textContent = entityNames.length + " polygons selected";
	container.appendChild(infoDiv);

	// Polygon list with badges
	var listDiv = createPolyList(entityNames);
	container.appendChild(listDiv);

	// Form + notes
	var formContent = createBooleanForm();
	container.appendChild(formContent);

	var dialog = new FloatingDialog({
		title: "KAD Boolean (" + entityNames.length + " polys)",
		content: container,
		layoutType: "wide",
		width: 440,
		height: 480,
		showConfirm: true,
		showCancel: true,
		confirmText: "Execute",
		cancelText: "Cancel",
		onConfirm: function () {
			executeBooleanFromForm(formContent, entityNames);
		}
	});

	dialog.show();
	initJSColor(formContent);
}

// ────────────────────────────────────────────────────────
// Dialog B: Fallback dropdown picker (0 or 1 selected)
// ────────────────────────────────────────────────────────

function openPickerDialog(allPolys, preSelected) {
	var entityOptions = allPolys.map(function (pe) {
		return { value: pe.name, text: pe.name + " (" + pe.pointCount + " pts)" };
	});

	// Pre-set defaults from any existing selection
	var defaultA = preSelected.length > 0 ? preSelected[0] : entityOptions[0].value;
	var defaultB = entityOptions[0].value;
	for (var i = 0; i < entityOptions.length; i++) {
		if (entityOptions[i].value !== defaultA) {
			defaultB = entityOptions[i].value;
			break;
		}
	}

	var pickerFields = [
		{
			label: "Subject Polygon (A)",
			name: "subjectName",
			type: "select",
			value: defaultA,
			options: entityOptions,
			tooltip: "The primary polygon (A)"
		},
		{
			label: "Clip Polygon (B)",
			name: "clipName",
			type: "select",
			value: defaultB,
			options: entityOptions,
			tooltip: "The secondary polygon (B)"
		}
	];

	var pickerContent = createEnhancedFormContent(pickerFields, false, false);

	// Also add the boolean form fields
	var boolFields = [
		{
			label: "Operation",
			name: "operation",
			type: "select",
			value: "union",
			options: [
				{ value: "union", text: "Union (A + B)" },
				{ value: "intersect", text: "Intersect (A ∩ B)" },
				{ value: "difference", text: "Difference (A - B)" },
				{ value: "xor", text: "XOR (A △ B)" }
			]
		},
		{
			label: "Output Color",
			name: "color",
			type: "color",
			value: "#FFCC00"
		},
		{
			label: "Line Width",
			name: "lineWidth",
			type: "number",
			value: 3, step: 1, min: 1, max: 10
		},
		{
			label: "Layer Name",
			name: "layerName",
			type: "text",
			value: "BOOLS"
		}
	];

	var boolContent = createEnhancedFormContent(boolFields, false, false);

	// Combine into wrapper
	var wrapper = document.createElement("div");

	var hintDiv = document.createElement("div");
	hintDiv.style.fontSize = "10px";
	hintDiv.style.color = "#999";
	hintDiv.style.marginBottom = "8px";
	hintDiv.textContent = "Tip: Select 2+ polys on screen first, then click KAD Boolean to skip this picker.";
	wrapper.appendChild(hintDiv);
	wrapper.appendChild(pickerContent);
	wrapper.appendChild(boolContent);

	// Notes
	var notesDiv = document.createElement("div");
	notesDiv.style.gridColumn = "1 / -1";
	notesDiv.style.marginTop = "10px";
	notesDiv.style.fontSize = "10px";
	notesDiv.style.color = "#888";
	notesDiv.innerHTML =
		"<strong>Operations:</strong><br>" +
		"&bull; <b>Union</b> — merge both polygons into outer boundary<br>" +
		"&bull; <b>Intersect</b> — keep only the overlapping region<br>" +
		"&bull; <b>Difference</b> — subtract B from A<br>" +
		"&bull; <b>XOR</b> — keep everything except the overlap";
	boolContent.appendChild(notesDiv);

	var dialog = new FloatingDialog({
		title: "KAD Boolean Operation",
		content: wrapper,
		layoutType: "wide",
		width: 440,
		height: 480,
		showConfirm: true,
		showCancel: true,
		confirmText: "Execute",
		cancelText: "Cancel",
		onConfirm: function () {
			var pickerData = getFormData(pickerContent);
			var boolData = getFormData(boolContent);

			if (pickerData.subjectName === pickerData.clipName) {
				showInfoDialog("Subject and Clip must be different polygons.");
				return;
			}

			var resultCount = kadBoolean({
				entityNames: [pickerData.subjectName, pickerData.clipName],
				operation: boolData.operation,
				color: boolData.color || "#FFCC00",
				lineWidth: parseInt(boolData.lineWidth) || 3,
				layerName: boolData.layerName || "BOOLS"
			});

			if (resultCount > 0) {
				console.log("KAD Boolean: Created " + resultCount + " result polygon(s)");
			} else {
				showInfoDialog("Boolean operation produced no results.\nThe polygons may not overlap.");
			}
		}
	});

	dialog.show();
	initJSColor(pickerContent);
	initJSColor(boolContent);
}

// ────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────

function createPolyList(entityNames) {
	var listDiv = document.createElement("div");
	listDiv.style.maxHeight = "150px";
	listDiv.style.overflowY = "auto";
	listDiv.style.border = "1px solid rgba(255,255,255,0.15)";
	listDiv.style.borderRadius = "4px";
	listDiv.style.padding = "4px";
	listDiv.style.background = "rgba(0,0,0,0.15)";
	listDiv.style.marginBottom = "10px";

	for (var i = 0; i < entityNames.length; i++) {
		var row = document.createElement("div");
		row.style.display = "flex";
		row.style.alignItems = "center";
		row.style.padding = "3px 6px";
		row.style.fontSize = "12px";
		row.style.gap = "6px";

		var badge = document.createElement("span");
		badge.style.fontSize = "10px";
		badge.style.padding = "1px 5px";
		badge.style.borderRadius = "3px";
		badge.style.flexShrink = "0";
		badge.textContent = String.fromCharCode(65 + i); // A, B, C, D, ...
		if (i === 0) {
			badge.style.background = "rgba(68,136,255,0.3)";
			badge.style.color = "#88CCFF";
		} else {
			badge.style.background = "rgba(255,136,68,0.2)";
			badge.style.color = "#FFAA88";
		}

		var label = document.createElement("span");
		label.style.overflow = "hidden";
		label.style.textOverflow = "ellipsis";
		label.style.whiteSpace = "nowrap";
		label.style.flex = "1";
		label.textContent = entityNames[i] + " (" + getPointCount(entityNames[i]) + " pts)";

		row.appendChild(badge);
		row.appendChild(label);
		listDiv.appendChild(row);
	}

	return listDiv;
}

function createBooleanForm() {
	var fields = [
		{
			label: "Operation",
			name: "operation",
			type: "select",
			value: "union",
			options: [
				{ value: "union", text: "Union — merge all into outer boundary" },
				{ value: "intersect", text: "Intersect — common region of all" },
				{ value: "difference", text: "Difference — A minus all others" },
				{ value: "xor", text: "XOR — symmetric difference" }
			]
		},
		{
			label: "Output Color",
			name: "color",
			type: "color",
			value: "#FFCC00"
		},
		{
			label: "Line Width",
			name: "lineWidth",
			type: "number",
			value: 3, step: 1, min: 1, max: 10
		},
		{
			label: "Layer Name",
			name: "layerName",
			type: "text",
			value: "BOOLS"
		}
	];

	var formContent = createEnhancedFormContent(fields, false, false);

	var notesDiv = document.createElement("div");
	notesDiv.style.gridColumn = "1 / -1";
	notesDiv.style.marginTop = "10px";
	notesDiv.style.fontSize = "10px";
	notesDiv.style.color = "#888";
	notesDiv.innerHTML =
		"<strong>Operations:</strong><br>" +
		"&bull; <b>Union</b> — merge all polygons into outer boundary<br>" +
		"&bull; <b>Intersect</b> — keep region common to all (A ∩ B ∩ ...)<br>" +
		"&bull; <b>Difference</b> — subtract B,C,... from A<br>" +
		"&bull; <b>XOR</b> — symmetric difference of all";
	formContent.appendChild(notesDiv);

	return formContent;
}

function executeBooleanFromForm(formContent, entityNames) {
	var data = getFormData(formContent);

	var resultCount = kadBoolean({
		entityNames: entityNames,
		operation: data.operation,
		color: data.color || "#FFCC00",
		lineWidth: parseInt(data.lineWidth) || 3,
		layerName: data.layerName || "BOOLS"
	});

	if (resultCount > 0) {
		console.log("KAD Boolean: Created " + resultCount + " result polygon(s) from " + entityNames.length + " inputs");
	} else {
		showInfoDialog("Boolean operation produced no results.\nThe polygons may not overlap.");
	}
}

function initJSColor(container) {
	setTimeout(function () {
		if (typeof jscolor !== "undefined") {
			jscolor.install();
			var colorInputs = container.querySelectorAll("[data-jscolor]");
			colorInputs.forEach(function (input) {
				if (input.jscolor) {
					input.jscolor.option("zIndex", 20000);
				}
			});
		}
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
		title: "KAD Boolean",
		content: content,
		width: 400,
		height: 200,
		showConfirm: true,
		confirmText: "OK",
		showCancel: false
	});
	dialog.show();
}
