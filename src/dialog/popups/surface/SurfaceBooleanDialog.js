/**
 * SurfaceBooleanDialog.js
 *
 * Two-phase dialog for interactive split-and-pick surface boolean (Vulcan TRIBOOL style).
 * Phase 1: Pick two surfaces (dropdown + screen pick) → Split
 * Phase 2: PICK REGIONS — toggle visibility per split with icon buttons → Apply
 * Uses FloatingDialog + createEnhancedFormContent.
 */

import * as THREE from "three";
import { FloatingDialog, createEnhancedFormContent, getFormData } from "../../FloatingDialog.js";
import {
	computeSplits,
	createSplitPreviewMeshes,
	updateSplitMeshAppearance,
	applyMerge
} from "../../../helpers/SurfaceBooleanHelper.js";

// ────────────────────────────────────────────────────────
// Split preview colors — jscolor palette (red → light grey, no black/white)
// ────────────────────────────────────────────────────────
var SPLIT_COLORS = [
	"#FF0000", "#FF9900", "#00ff00", "#00ffFF",
	"#0099ff", "#FF00FF", "#FFFF00", "#009900",
	"#AA0000", "#883300", "#33AA00", "#007F7F",
	"#002288", "#7F007F", "#AAAAAA", "#cccccc"
];

// ────────────────────────────────────────────────────────
// Module-level state
// ────────────────────────────────────────────────────────
var previewGroup = null;
var pickCallback = null;
var highlightBox = null;
var hiddenSurfaceIds = []; // surfaces hidden during phase 2

function getThreeCanvas() {
	return window.threeRenderer ? window.threeRenderer.getCanvas() : null;
}

function clearPreview() {
	if (!previewGroup) return;
	var scene = window.threeRenderer ? window.threeRenderer.scene : null;
	if (scene) {
		scene.remove(previewGroup);
	}
	previewGroup.traverse(function (child) {
		if (child.geometry) child.geometry.dispose();
		if (child.material) child.material.dispose();
	});
	previewGroup = null;
}

function hideSurface(surfaceId) {
	var surface = window.loadedSurfaces ? window.loadedSurfaces.get(surfaceId) : null;
	if (surface) surface.visible = false;

	// Also hide the Three.js mesh directly
	if (window.threeRenderer && window.threeRenderer.surfaceMeshMap) {
		var mesh = window.threeRenderer.surfaceMeshMap.get(surfaceId);
		if (mesh) mesh.visible = false;
	}
}

function restoreHiddenSurfaces() {
	for (var i = 0; i < hiddenSurfaceIds.length; i++) {
		var surface = window.loadedSurfaces ? window.loadedSurfaces.get(hiddenSurfaceIds[i]) : null;
		if (surface) surface.visible = true;

		// Also restore the Three.js mesh
		if (window.threeRenderer && window.threeRenderer.surfaceMeshMap) {
			var mesh = window.threeRenderer.surfaceMeshMap.get(hiddenSurfaceIds[i]);
			if (mesh) mesh.visible = true;
		}
	}
	hiddenSurfaceIds = [];
	if (typeof window.drawData === "function") {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}
}

// ────────────────────────────────────────────────────────
// Public: show the Surface Boolean dialog
// ────────────────────────────────────────────────────────

export function showSurfaceBooleanDialog() {
	// Step 1) Collect all surfaces with triangles
	var surfaceEntries = [];
	if (window.loadedSurfaces && window.loadedSurfaces.size > 0) {
		window.loadedSurfaces.forEach(function (surface, surfaceId) {
			if (surface.triangles && surface.triangles.length > 0) {
				surfaceEntries.push({
					id: surfaceId,
					name: surface.name || surfaceId,
					triCount: surface.triangles.length
				});
			}
		});
	}

	if (surfaceEntries.length < 2) {
		showInfoDialog("Need at least 2 surfaces for boolean operations.\nImport or create surfaces first.");
		return;
	}

	showPhase1(surfaceEntries);
}

// ────────────────────────────────────────────────────────
// Phase 1: Surface selection with screen pick
// ────────────────────────────────────────────────────────

function showPhase1(surfaceEntries) {
	var surfaceOptions = surfaceEntries.map(function (se) {
		return { value: se.id, text: se.name + " (" + se.triCount + " tris)" };
	});

	// Build container with pick rows + gradient field
	var container = document.createElement("div");
	container.style.display = "flex";
	container.style.flexDirection = "column";
	container.style.gap = "8px";
	container.style.padding = "4px 0";

	// Surface A row
	var rowA = createPickRow("Surface A", surfaceOptions, surfaceOptions[0].value, function () {
		enterPickMode(rowA, function (surfaceId) {
			rowA.select.value = surfaceId;
		});
	});
	container.appendChild(rowA.row);

	// Surface B row
	var defaultB = surfaceOptions.length > 1 ? surfaceOptions[1].value : surfaceOptions[0].value;
	var rowB = createPickRow("Surface B", surfaceOptions, defaultB, function () {
		enterPickMode(rowB, function (surfaceId) {
			rowB.select.value = surfaceId;
		});
	});
	container.appendChild(rowB.row);

	// Gradient field
	var gradientFields = [
		{
			label: "Result Gradient",
			name: "gradient",
			type: "select",
			value: "default",
			options: [
				{ value: "default", text: "Default" },
				{ value: "hillshade", text: "Hillshade" },
				{ value: "viridis", text: "Viridis" },
				{ value: "turbo", text: "Turbo" },
				{ value: "parula", text: "Parula" },
				{ value: "cividis", text: "Cividis" },
				{ value: "terrain", text: "Terrain" }
			]
		}
	];
	var formContent = createEnhancedFormContent(gradientFields, false, false);
	container.appendChild(formContent);

	// Notes
	var notesDiv = document.createElement("div");
	notesDiv.style.marginTop = "10px";
	notesDiv.style.fontSize = "10px";
	notesDiv.style.color = "#888";
	notesDiv.innerHTML =
		"<strong>Surface Boolean (TRIBOOL):</strong><br>" +
		"&bull; Computes the intersection line between two surfaces<br>" +
		"&bull; Splits each surface into regions<br>" +
		"&bull; You then pick which regions to keep or remove<br>" +
		"&bull; Apply merges kept regions into a new surface<br>" +
		"<br><strong>Tip:</strong> Click the pick button then click a surface in the 3D view.";
	container.appendChild(notesDiv);

	var dialog = new FloatingDialog({
		title: "Surface Boolean — Select Surfaces",
		content: container,
		layoutType: "wide",
		width: 480,
		height: 400,
		showConfirm: true,
		showCancel: true,
		confirmText: "Split",
		cancelText: "Cancel",
		onConfirm: function () {
			exitPickMode();

			var surfaceIdA = rowA.select.value;
			var surfaceIdB = rowB.select.value;
			var data = getFormData(formContent);

			if (surfaceIdA === surfaceIdB) {
				showInfoDialog("Surface A and Surface B must be different.");
				return;
			}

			// Show progress
			var progressDialog = showProgressDialog("Computing intersection splits...\nThis may take a moment for large surfaces.");

			setTimeout(function () {
				var result = computeSplits(surfaceIdA, surfaceIdB);

				if (progressDialog && progressDialog.close) {
					progressDialog.close();
				}

				if (!result || !result.splits || result.splits.length === 0) {
					showInfoDialog("No intersection found between the selected surfaces.\nThe surfaces may not overlap.");
					return;
				}

				showPhase2(result, data.gradient);
			}, 50);
		},
		onCancel: function () {
			exitPickMode();
		}
	});

	dialog.show();
}

// ────────────────────────────────────────────────────────
// Pick row builder (reused from SolidCSGDialog pattern)
// ────────────────────────────────────────────────────────

function createPickRow(label, options, defaultValue, onPick) {
	var row = document.createElement("div");
	row.style.display = "flex";
	row.style.alignItems = "center";
	row.style.gap = "8px";

	var labelEl = document.createElement("label");
	labelEl.textContent = label;
	labelEl.style.minWidth = "80px";
	labelEl.style.fontSize = "13px";
	labelEl.style.fontWeight = "bold";
	labelEl.style.flexShrink = "0";

	var pickBtn = document.createElement("button");
	pickBtn.type = "button";
	pickBtn.title = "Pick a surface from 3D view";
	pickBtn.style.width = "28px";
	pickBtn.style.height = "28px";
	pickBtn.style.padding = "2px";
	pickBtn.style.border = "1px solid rgba(255,255,255,0.2)";
	pickBtn.style.borderRadius = "4px";
	pickBtn.style.background = "rgba(255,255,255,0.08)";
	pickBtn.style.cursor = "pointer";
	pickBtn.style.flexShrink = "0";
	pickBtn.style.display = "flex";
	pickBtn.style.alignItems = "center";
	pickBtn.style.justifyContent = "center";

	var pickImg = document.createElement("img");
	pickImg.src = "icons/target-arrow.png";
	pickImg.style.width = "20px";
	pickImg.style.height = "20px";
	pickImg.style.filter = "invert(0.8)";
	pickBtn.appendChild(pickImg);

	pickBtn.addEventListener("click", onPick);

	var select = document.createElement("select");
	select.style.flex = "1";
	select.style.padding = "4px 6px";
	select.style.fontSize = "12px";
	select.style.borderRadius = "4px";
	select.style.border = "1px solid rgba(255,255,255,0.2)";
	select.style.background = "rgba(30,30,30,0.9)";
	select.style.color = "#eee";
	select.style.minWidth = "0";

	for (var i = 0; i < options.length; i++) {
		var opt = document.createElement("option");
		opt.value = options[i].value;
		opt.textContent = options[i].text;
		if (options[i].value === defaultValue) opt.selected = true;
		select.appendChild(opt);
	}

	row.appendChild(labelEl);
	row.appendChild(pickBtn);
	row.appendChild(select);

	return { row: row, select: select, pickBtn: pickBtn };
}

// ────────────────────────────────────────────────────────
// Screen pick mode
// ────────────────────────────────────────────────────────

function enterPickMode(pickRow, onPicked) {
	exitPickMode();

	// Highlight button red (Kirra convention)
	pickRow.pickBtn.style.background = "rgba(255,60,60,0.4)";
	pickRow.pickBtn.style.borderColor = "#FF4444";

	var canvas = getThreeCanvas();
	if (!canvas) {
		console.warn("Surface Boolean Pick: No 3D canvas found");
		return;
	}

	canvas.style.cursor = "crosshair";

	pickCallback = function (e) {
		e.stopPropagation();

		var surfaceId = raycastSurface(e, canvas);
		if (surfaceId) {
			onPicked(surfaceId);
			showPickHighlight(surfaceId);
			console.log("Surface Boolean Pick: " + surfaceId);
		}

		exitPickMode();
		pickRow.pickBtn.style.background = "rgba(255,255,255,0.08)";
		pickRow.pickBtn.style.borderColor = "rgba(255,255,255,0.2)";
	};

	canvas.addEventListener("pointerup", pickCallback, { once: true, capture: true });
}

function exitPickMode() {
	var canvas = getThreeCanvas();
	if (canvas) {
		canvas.style.cursor = "";
		if (pickCallback) {
			canvas.removeEventListener("pointerup", pickCallback, { capture: true });
		}
	}
	pickCallback = null;
	clearPickHighlight();
}

function raycastSurface(event, canvas) {
	var tr = window.threeRenderer;
	if (!tr || !tr.scene || !tr.camera || !tr.surfaceMeshMap) return null;

	var rect = canvas.getBoundingClientRect();
	var mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
	var mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

	var raycaster = new THREE.Raycaster();
	raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), tr.camera);

	var meshes = [];
	tr.surfaceMeshMap.forEach(function (mesh, surfaceId) {
		if (mesh && mesh.visible) {
			mesh.traverse(function (child) {
				if (child.isMesh) {
					child.userData._pickSurfaceId = surfaceId;
					meshes.push(child);
				}
			});
		}
	});

	var hits = raycaster.intersectObjects(meshes, false);
	if (hits.length > 0) {
		return hits[0].object.userData._pickSurfaceId || null;
	}
	return null;
}

function showPickHighlight(surfaceId) {
	clearPickHighlight();

	var tr = window.threeRenderer;
	if (!tr || !tr.surfaceMeshMap) return;

	var mesh = tr.surfaceMeshMap.get(surfaceId);
	if (!mesh) return;

	var box = new THREE.Box3().setFromObject(mesh);
	if (box.isEmpty()) return;

	var helper = new THREE.Box3Helper(box, 0x00FF00);
	helper.name = "surfBoolPickHighlight";
	helper.userData = { isPickHighlight: true };
	tr.scene.add(helper);
	highlightBox = helper;
	tr.render();
}

function clearPickHighlight() {
	if (highlightBox) {
		var tr = window.threeRenderer;
		if (tr && tr.scene) {
			tr.scene.remove(highlightBox);
		}
		if (highlightBox.geometry) highlightBox.geometry.dispose();
		if (highlightBox.material) highlightBox.material.dispose();
		highlightBox = null;
		if (tr) tr.render();
	}
}

// ────────────────────────────────────────────────────────
// Phase 2: PICK REGIONS — interactive split picker
// ────────────────────────────────────────────────────────

function showPhase2(splitResult, gradient) {
	var splits = splitResult.splits;

	// Step 1) Assign colors from SPLIT_COLORS palette
	for (var c = 0; c < splits.length; c++) {
		splits[c].color = SPLIT_COLORS[c % SPLIT_COLORS.length];
		splits[c].kept = true;
	}

	// Step 2) Label splits as SURF-A[1], SURF-A[2], SURF-B[1], SURF-B[2]
	var countA = 0;
	var countB = 0;
	for (var i = 0; i < splits.length; i++) {
		if (splits[i].surfaceId === splitResult.surfaceIdA) {
			countA++;
			splits[i].label = "SURF-A[" + countA + "] (" + splits[i].triangles.length + " tris)";
		} else {
			countB++;
			splits[i].label = "SURF-B[" + countB + "] (" + splits[i].triangles.length + " tris)";
		}
	}

	// Step 3) Hide original surfaces A and B
	hiddenSurfaceIds = [];
	hideSurface(splitResult.surfaceIdA);
	hiddenSurfaceIds.push(splitResult.surfaceIdA);
	hideSurface(splitResult.surfaceIdB);
	hiddenSurfaceIds.push(splitResult.surfaceIdB);

	// Step 4) Create colored preview meshes
	clearPreview();
	if (window.threeRenderer && window.threeRenderer.scene) {
		previewGroup = createSplitPreviewMeshes(splits);
		if (previewGroup) {
			window.threeRenderer.scene.add(previewGroup);
		}
		// Redraw to reflect hidden originals + new previews
		if (typeof window.drawData === "function") {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}
	}

	// Step 5) Build PICK REGIONS dialog UI
	var container = document.createElement("div");
	container.style.padding = "8px";

	// Header
	var headerDiv = document.createElement("div");
	headerDiv.style.fontSize = "11px";
	headerDiv.style.color = "rgba(255,200,0,0.8)";
	headerDiv.style.marginBottom = "8px";
	headerDiv.style.padding = "4px 8px";
	headerDiv.style.background = "rgba(0,0,0,0.2)";
	headerDiv.style.borderRadius = "4px";
	headerDiv.textContent = splits.length + " split regions — toggle visibility, then Apply to merge visible regions.";
	container.appendChild(headerDiv);

	// Split list
	var listDiv = document.createElement("div");
	listDiv.style.maxHeight = "220px";
	listDiv.style.overflowY = "auto";
	listDiv.style.border = "1px solid rgba(255,255,255,0.15)";
	listDiv.style.borderRadius = "4px";
	listDiv.style.padding = "6px";
	listDiv.style.background = "rgba(0,0,0,0.15)";

	var splitRows = [];

	for (var s = 0; s < splits.length; s++) {
		(function (index) {
			var split = splits[index];

			var row = document.createElement("div");
			row.style.display = "flex";
			row.style.alignItems = "center";
			row.style.justifyContent = "space-between";
			row.style.padding = "5px 8px";
			row.style.marginBottom = "3px";
			row.style.borderRadius = "3px";
			row.style.fontSize = "12px";
			row.style.background = "rgba(255,255,255,0.05)";

			// Left: color swatch + label
			var leftDiv = document.createElement("div");
			leftDiv.style.display = "flex";
			leftDiv.style.alignItems = "center";
			leftDiv.style.gap = "8px";
			leftDiv.style.flex = "1";
			leftDiv.style.overflow = "hidden";

			var swatch = document.createElement("div");
			swatch.style.width = "14px";
			swatch.style.height = "14px";
			swatch.style.borderRadius = "3px";
			swatch.style.backgroundColor = split.color;
			swatch.style.border = "1px solid rgba(255,255,255,0.3)";
			swatch.style.flexShrink = "0";

			var label = document.createElement("span");
			label.style.overflow = "hidden";
			label.style.textOverflow = "ellipsis";
			label.style.whiteSpace = "nowrap";
			label.textContent = split.label;

			leftDiv.appendChild(swatch);
			leftDiv.appendChild(label);

			// Right: remove/add icon buttons
			var btnDiv = document.createElement("div");
			btnDiv.style.display = "flex";
			btnDiv.style.gap = "4px";
			btnDiv.style.flexShrink = "0";

			var removeBtn = createIconButton("icons/triangle-minus.png", "Hide / Remove from result", function () {
				split.kept = false;
				updateRowAppearance(row, swatch, split);
				updateSplitPreview(index, false);
			});

			var addBtn = createIconButton("icons/triangle-plus.png", "Show / Add to result", function () {
				split.kept = true;
				updateRowAppearance(row, swatch, split);
				updateSplitPreview(index, true);
			});

			btnDiv.appendChild(removeBtn);
			btnDiv.appendChild(addBtn);

			row.appendChild(leftDiv);
			row.appendChild(btnDiv);
			listDiv.appendChild(row);

			splitRows.push({ row: row, swatch: swatch, split: split, index: index });
		})(s);
	}

	container.appendChild(listDiv);

	// Button bar: Invert All
	var buttonBar = document.createElement("div");
	buttonBar.style.display = "flex";
	buttonBar.style.gap = "8px";
	buttonBar.style.marginTop = "10px";
	buttonBar.style.alignItems = "center";

	var invertBtn = createIconButton("icons/switch.png", "Invert visible regions", function () {
		for (var i = 0; i < splitRows.length; i++) {
			var sr = splitRows[i];
			sr.split.kept = !sr.split.kept;
			updateRowAppearance(sr.row, sr.swatch, sr.split);
			updateSplitPreview(sr.index, sr.split.kept);
		}
	});
	invertBtn.style.width = "32px";
	invertBtn.style.height = "32px";

	var invertLabel = document.createElement("span");
	invertLabel.textContent = "Invert All";
	invertLabel.style.fontSize = "11px";
	invertLabel.style.color = "#aaa";

	buttonBar.appendChild(invertBtn);
	buttonBar.appendChild(invertLabel);

	// Snap Vertices tolerance
	var snapLabel = document.createElement("label");
	snapLabel.style.display = "flex";
	snapLabel.style.alignItems = "center";
	snapLabel.style.gap = "4px";
	snapLabel.style.marginLeft = "auto";
	snapLabel.style.fontSize = "11px";
	snapLabel.style.color = "#ccc";

	snapLabel.appendChild(document.createTextNode("Snap Vertices:"));

	var snapInput = document.createElement("input");
	snapInput.type = "number";
	snapInput.value = "0.001";
	snapInput.step = "0.001";
	snapInput.min = "0";
	snapInput.style.width = "60px";
	snapInput.style.fontSize = "11px";
	snapInput.style.padding = "2px 4px";
	snapInput.style.background = "#333";
	snapInput.style.color = "#ccc";
	snapInput.style.border = "1px solid #555";
	snapInput.style.borderRadius = "3px";

	snapLabel.appendChild(snapInput);
	snapLabel.appendChild(document.createTextNode("m"));
	buttonBar.appendChild(snapLabel);

	// Close Surface checkbox
	var closeLabel = document.createElement("label");
	closeLabel.style.display = "flex";
	closeLabel.style.alignItems = "center";
	closeLabel.style.gap = "4px";
	closeLabel.style.marginLeft = "8px";
	closeLabel.style.fontSize = "11px";
	closeLabel.style.color = "#ccc";
	closeLabel.style.cursor = "pointer";

	var closeCheckbox = document.createElement("input");
	closeCheckbox.type = "checkbox";
	closeCheckbox.checked = false;
	closeCheckbox.style.cursor = "pointer";

	closeLabel.appendChild(closeCheckbox);
	closeLabel.appendChild(document.createTextNode("Close Surface"));
	buttonBar.appendChild(closeLabel);

	container.appendChild(buttonBar);

	// Step 6) Create dialog
	var dialog = new FloatingDialog({
		title: "Surface Boolean — Pick Regions",
		content: container,
		layoutType: "wide",
		width: 480,
		height: 460,
		showConfirm: true,
		showCancel: true,
		confirmText: "Apply",
		cancelText: "Cancel",
		onConfirm: function () {
			// Check at least one split is kept
			var anyKept = false;
			for (var i = 0; i < splits.length; i++) {
				if (splits[i].kept) { anyKept = true; break; }
			}
			if (!anyKept) {
				showInfoDialog("No regions are visible. Add at least one region to keep.");
				return;
			}

			clearPreview();
			restoreHiddenSurfaces();

			var snapTol = parseFloat(snapInput.value) || 0;
			var resultId = applyMerge(splits, {
				gradient: gradient,
				surfaceIdA: splitResult.surfaceIdA,
				surfaceIdB: splitResult.surfaceIdB,
				closeSurface: closeCheckbox.checked,
				snapTolerance: snapTol
			});

			if (resultId) {
				console.log("Surface Boolean applied: " + resultId);
			} else {
				showInfoDialog("Surface Boolean failed to produce a result.");
			}
		},
		onCancel: function () {
			clearPreview();
			restoreHiddenSurfaces();
		}
	});

	dialog.show();
}

// ────────────────────────────────────────────────────────
// UI helpers
// ────────────────────────────────────────────────────────

function createIconButton(iconSrc, tooltip, onClick) {
	var btn = document.createElement("button");
	btn.type = "button";
	btn.title = tooltip;
	btn.style.width = "26px";
	btn.style.height = "26px";
	btn.style.padding = "2px";
	btn.style.border = "1px solid rgba(255,255,255,0.2)";
	btn.style.borderRadius = "4px";
	btn.style.background = "rgba(255,255,255,0.08)";
	btn.style.cursor = "pointer";
	btn.style.display = "flex";
	btn.style.alignItems = "center";
	btn.style.justifyContent = "center";
	btn.style.flexShrink = "0";

	var img = document.createElement("img");
	img.src = iconSrc;
	img.style.width = "18px";
	img.style.height = "18px";
	img.style.filter = "invert(0.8)";
	btn.appendChild(img);

	btn.addEventListener("click", onClick);
	return btn;
}

function updateRowAppearance(row, swatch, split) {
	if (split.kept) {
		row.style.opacity = "1";
		swatch.style.backgroundColor = split.color;
	} else {
		row.style.opacity = "0.4";
		swatch.style.backgroundColor = "#444";
	}
}

function updateSplitPreview(splitIndex, kept) {
	if (!previewGroup) return;
	var children = previewGroup.children;
	for (var i = 0; i < children.length; i++) {
		if (children[i].userData && children[i].userData.splitIndex === splitIndex) {
			updateSplitMeshAppearance(children[i], kept);
			break;
		}
	}
	if (window.threeRenderer) {
		window.threeRenderer.render();
	}
}

// ────────────────────────────────────────────────────────
// Info / progress dialogs
// ────────────────────────────────────────────────────────

function showInfoDialog(message) {
	var content = document.createElement("div");
	content.style.padding = "15px";
	content.style.whiteSpace = "pre-wrap";
	content.textContent = message;

	var dialog = new FloatingDialog({
		title: "Surface Boolean",
		content: content,
		width: 400,
		height: 200,
		showConfirm: true,
		confirmText: "OK",
		showCancel: false
	});
	dialog.show();
}

function showProgressDialog(message) {
	var content = document.createElement("div");
	content.style.padding = "15px";
	content.style.whiteSpace = "pre-wrap";
	content.style.textAlign = "center";
	content.textContent = message;

	var dialog = new FloatingDialog({
		title: "Surface Boolean",
		content: content,
		width: 350,
		height: 160,
		showConfirm: false,
		showCancel: false
	});
	dialog.show();
	return dialog;
}
