/**
 * SurfaceIntersectionDialog.js
 *
 * Dialog for selecting 2 surfaces and options for computing
 * triangle-mesh intersection polylines.
 * Uses screen-pick target-arrow pattern (same as SurfaceBooleanDialog).
 */

import * as THREE from "three";
import { FloatingDialog, createEnhancedFormContent, getFormData } from "../../FloatingDialog.js";
import { flashHighlight, clearHighlight, clearAllHighlights } from "../../../helpers/SurfaceHighlightHelper.js";

var SETTINGS_KEY = "kirra_surface_intersection_settings";

// ────────────────────────────────────────────────────────
// Module-level state
// ────────────────────────────────────────────────────────
var pickCallback = null;
var highlightedSurfaceId = null;

function getThreeCanvas() {
    return window.threeRenderer ? window.threeRenderer.getCanvas() : null;
}

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
        console.warn("Failed to save surface intersection settings:", e);
    }
}

// ────────────────────────────────────────────────────────
// Screen pick mode
// ────────────────────────────────────────────────────────

function enterPickMode(pickRow, onPicked) {
    exitPickMode();

    pickRow.pickBtn.style.background = "rgba(255,60,60,0.4)";
    pickRow.pickBtn.style.borderColor = "#FF4444";

    var canvas = getThreeCanvas();
    if (!canvas) {
        console.warn("Surface Intersection Pick: No 3D canvas found");
        return;
    }

    canvas.style.cursor = "crosshair";

    pickCallback = function (e) {
        e.stopPropagation();

        var surfaceId = raycastSurface(e, canvas);
        if (surfaceId) {
            onPicked(surfaceId);
            showPickHighlight(surfaceId);
            console.log("Surface Intersection Pick: " + surfaceId);
        }

        exitPickMode();
        var dk = isDarkMode();
        pickRow.pickBtn.style.background = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
        pickRow.pickBtn.style.borderColor = dk ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";
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
    flashHighlight(surfaceId, { color: 0x00FF88, opacity: 0.25 });
    highlightedSurfaceId = surfaceId;
}

function clearPickHighlight() {
    if (highlightedSurfaceId) {
        clearHighlight(highlightedSurfaceId);
        highlightedSurfaceId = null;
    }
}

function isDarkMode() {
    return typeof window.darkModeEnabled !== "undefined" ? window.darkModeEnabled : true;
}

// ────────────────────────────────────────────────────────
// Pick row builder (same pattern as SurfaceBooleanDialog)
// ────────────────────────────────────────────────────────

function createPickRow(label, options, defaultValue, onPick) {
    var dark = isDarkMode();
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
    pickBtn.style.border = dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.2)";
    pickBtn.style.borderRadius = "4px";
    pickBtn.style.background = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
    pickBtn.style.cursor = "pointer";
    pickBtn.style.flexShrink = "0";
    pickBtn.style.display = "flex";
    pickBtn.style.alignItems = "center";
    pickBtn.style.justifyContent = "center";

    var pickImg = document.createElement("img");
    pickImg.src = "icons/target-arrow.png";
    pickImg.style.width = "20px";
    pickImg.style.height = "20px";
    pickImg.style.filter = dark ? "invert(0.8)" : "invert(0.2)";
    pickBtn.appendChild(pickImg);

    pickBtn.addEventListener("click", onPick);

    var select = document.createElement("select");
    select.style.flex = "1";
    select.style.padding = "4px 6px";
    select.style.fontSize = "12px";
    select.style.borderRadius = "4px";
    select.style.border = dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid #999";
    select.style.background = dark ? "rgba(30,30,30,0.9)" : "#fff";
    select.style.color = dark ? "#eee" : "#333";
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
// Public: Show the Surface Intersection dialog
// ────────────────────────────────────────────────────────

/**
 * Show the Surface Intersection configuration dialog.
 *
 * @param {Function} callback - Called with config object on Compute
 */
export function showSurfaceIntersectionDialog(callback) {
    // Step 1) Build surface list from window.loadedSurfaces
    var surfaceEntries = [];
    if (window.loadedSurfaces && window.loadedSurfaces.size > 0) {
        for (var [surfId, surf] of window.loadedSurfaces) {
            var triCount = 0;
            if (surf.triangles && Array.isArray(surf.triangles)) {
                triCount = surf.triangles.length;
            }
            surfaceEntries.push({
                id: surfId,
                name: surf.name || surfId,
                triCount: triCount
            });
        }
    }

    if (surfaceEntries.length < 2) {
        var warnContent = document.createElement("div");
        warnContent.style.padding = "15px";
        warnContent.textContent = "At least 2 loaded surfaces are required for intersection. Currently loaded: " + surfaceEntries.length;
        var warnDialog = new FloatingDialog({
            title: "Surface Intersection",
            content: warnContent,
            width: 400,
            height: 180,
            showConfirm: true,
            confirmText: "OK",
            showCancel: false
        });
        warnDialog.show();
        return;
    }

    // Step 2) Load saved settings
    var saved = loadSavedSettings();

    // Step 3) Build surface options for dropdowns
    var surfaceOptions = surfaceEntries.map(function (se) {
        return { value: se.id, text: se.name + " (" + se.triCount + " tris)" };
    });

    // Step 4) Build container with pick rows + form fields
    var container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";
    container.style.padding = "4px 0";

    // Surface A pick row
    var defaultA = (saved && saved.surfaceIds && saved.surfaceIds[0]) || surfaceOptions[0].value;
    var rowA = createPickRow("Surface A", surfaceOptions, defaultA, function () {
        enterPickMode(rowA, function (surfaceId) {
            rowA.select.value = surfaceId;
        });
    });
    container.appendChild(rowA.row);

    // Surface B pick row
    var defaultB = (saved && saved.surfaceIds && saved.surfaceIds[1]) || (surfaceOptions.length > 1 ? surfaceOptions[1].value : surfaceOptions[0].value);
    var rowB = createPickRow("Surface B", surfaceOptions, defaultB, function () {
        enterPickMode(rowB, function (surfaceId) {
            rowB.select.value = surfaceId;
        });
    });
    container.appendChild(rowB.row);

    // Step 5) Build form fields
    var fields = [
        {
            label: "Vertex Spacing (m)",
            name: "vertexSpacing",
            type: "number",
            value: saved ? saved.vertexSpacing : 1.0,
            min: 0,
            step: 0.1,
            tooltip: "Simplification tolerance. 0 = keep all vertices"
        },
        {
            label: "Close Polygons",
            name: "closedPolygons",
            type: "checkbox",
            value: saved ? saved.closedPolygons !== false : true,
            tooltip: "Close polylines into polygons"
        },
        {
            label: "Color",
            name: "color",
            type: "color",
            value: saved ? saved.color : "#FFCC00"
        },
        {
            label: "Line Width",
            name: "lineWidth",
            type: "number",
            value: saved ? saved.lineWidth : 3,
            min: 1,
            max: 10,
            step: 1
        },
        {
            label: "Layer Name",
            name: "layerName",
            type: "text",
            value: saved ? saved.layerName : "SURF-IX"
        }
    ];

    var formContent = createEnhancedFormContent(fields);
    container.appendChild(formContent);

    // Notes
    var notesDark = isDarkMode();
    var notesDiv = document.createElement("div");
    notesDiv.style.marginTop = "10px";
    notesDiv.style.fontSize = "10px";
    notesDiv.style.color = notesDark ? "#888" : "#666";
    notesDiv.innerHTML =
        "<strong>Surface Intersection:</strong><br>" +
        "&bull; Computes intersection polylines between two surfaces<br>" +
        "&bull; Results are stored as KAD polygon entities<br>" +
        "<br><strong>Tip:</strong> Click the pick button then click a surface in the 3D view.";
    container.appendChild(notesDiv);

    // Step 6) Create dialog
    var dialog = new FloatingDialog({
        title: "Surface Intersection",
        content: container,
        layoutType: "wide",
        width: 480,
        height: 480,
        showConfirm: true,
        confirmText: "Compute",
        cancelText: "Cancel",
        onConfirm: function () {
            exitPickMode();
            clearAllHighlights();

            var surfaceIdA = rowA.select.value;
            var surfaceIdB = rowB.select.value;

            if (surfaceIdA === surfaceIdB) {
                var infoContent = document.createElement("div");
                infoContent.style.padding = "15px";
                infoContent.textContent = "Surface A and Surface B must be different.";
                var infoDialog = new FloatingDialog({
                    title: "Surface Intersection",
                    content: infoContent,
                    width: 350,
                    height: 160,
                    showConfirm: true,
                    confirmText: "OK",
                    showCancel: false
                });
                infoDialog.show();
                return false; // Prevent dialog close
            }

            var data = getFormData(formContent);

            var config = {
                surfaceIds: [surfaceIdA, surfaceIdB],
                vertexSpacing: parseFloat(data.vertexSpacing) || 0,
                closedPolygons: data.closedPolygons !== false && data.closedPolygons !== "false",
                color: data.color || "#FFCC00",
                lineWidth: parseInt(data.lineWidth) || 3,
                layerName: data.layerName || "SURF-IX"
            };

            saveSettings(config);
            callback(config);
        },
        onCancel: function () {
            exitPickMode();
            clearAllHighlights();
        }
    });

    dialog.show();
}
