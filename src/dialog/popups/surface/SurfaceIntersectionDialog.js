/**
 * SurfaceIntersectionDialog.js
 *
 * Dialog for selecting 2+ surfaces and options for computing
 * triangle-mesh intersection polylines.
 */

import { FloatingDialog, createEnhancedFormContent, getFormData } from "../../FloatingDialog.js";

var SETTINGS_KEY = "kirra_surface_intersection_settings";

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

/**
 * Show the Surface Intersection configuration dialog.
 *
 * @param {Function} callback - Called with config object on Compute
 */
export function showSurfaceIntersectionDialog(callback) {
    // Step 1) Build surface checklist from window.loadedSurfaces
    var surfaces = [];
    if (window.loadedSurfaces && window.loadedSurfaces.size > 0) {
        for (var [surfId, surf] of window.loadedSurfaces) {
            var triCount = 0;
            if (surf.triangles && Array.isArray(surf.triangles)) {
                triCount = surf.triangles.length;
            }
            surfaces.push({
                id: surfId,
                name: surf.name || surfId,
                triCount: triCount
            });
        }
    }

    if (surfaces.length < 2) {
        var warnContent = document.createElement("div");
        warnContent.style.padding = "15px";
        warnContent.textContent = "At least 2 loaded surfaces are required for intersection. Currently loaded: " + surfaces.length;
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

    // Step 3) Build form fields
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

    // Step 4) Build surface checklist UI
    var container = document.createElement("div");

    var checklistLabel = document.createElement("div");
    checklistLabel.style.fontWeight = "bold";
    checklistLabel.style.marginBottom = "8px";
    checklistLabel.style.fontSize = "13px";
    checklistLabel.textContent = "Select Surfaces (min 2):";
    container.appendChild(checklistLabel);

    var checklistDiv = document.createElement("div");
    checklistDiv.style.maxHeight = "180px";
    checklistDiv.style.overflowY = "auto";
    checklistDiv.style.border = "1px solid rgba(255,255,255,0.15)";
    checklistDiv.style.borderRadius = "4px";
    checklistDiv.style.padding = "6px";
    checklistDiv.style.marginBottom = "12px";
    checklistDiv.style.background = "rgba(0,0,0,0.15)";

    var checkboxes = [];
    surfaces.forEach(function(surf) {
        var row = document.createElement("label");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.padding = "4px 6px";
        row.style.cursor = "pointer";
        row.style.borderRadius = "3px";
        row.style.fontSize = "12px";

        row.addEventListener("mouseenter", function() {
            row.style.background = "rgba(255,255,255,0.08)";
        });
        row.addEventListener("mouseleave", function() {
            row.style.background = "transparent";
        });

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = surf.id;
        cb.style.marginRight = "8px";
        cb.style.flexShrink = "0";
        // Pre-check if saved
        if (saved && saved.surfaceIds && saved.surfaceIds.indexOf(surf.id) !== -1) {
            cb.checked = true;
        }
        checkboxes.push(cb);

        var text = document.createElement("span");
        text.textContent = surf.name + " (" + surf.triCount + " tris)";
        text.style.overflow = "hidden";
        text.style.textOverflow = "ellipsis";
        text.style.whiteSpace = "nowrap";

        row.appendChild(cb);
        row.appendChild(text);
        checklistDiv.appendChild(row);
    });

    container.appendChild(checklistDiv);

    // Step 5) Status line for selection count
    var statusLine = document.createElement("div");
    statusLine.style.fontSize = "11px";
    statusLine.style.marginBottom = "10px";
    statusLine.style.color = "rgba(255,200,0,0.8)";
    statusLine.textContent = "0 surfaces selected";
    container.appendChild(statusLine);

    function updateStatus() {
        var count = 0;
        checkboxes.forEach(function(cb) { if (cb.checked) count++; });
        statusLine.textContent = count + " surface" + (count !== 1 ? "s" : "") + " selected";
        if (count < 2) {
            statusLine.style.color = "rgba(255,100,100,0.9)";
        } else {
            statusLine.style.color = "rgba(100,255,100,0.9)";
        }
    }
    checkboxes.forEach(function(cb) {
        cb.addEventListener("change", updateStatus);
    });
    updateStatus();

    // Step 6) Append form fields below checklist
    container.appendChild(formContent);

    // Step 7) Create dialog
    var dialog = new FloatingDialog({
        title: "Surface Intersection",
        content: container,
        width: 480,
        height: 560,
        showConfirm: true,
        confirmText: "Compute",
        cancelText: "Cancel",
        onConfirm: function() {
            // Gather selected surface IDs
            var selectedIds = [];
            checkboxes.forEach(function(cb) {
                if (cb.checked) selectedIds.push(cb.value);
            });

            if (selectedIds.length < 2) {
                statusLine.textContent = "Please select at least 2 surfaces!";
                statusLine.style.color = "rgba(255,80,80,1)";
                return false; // Prevent dialog close
            }

            var data = getFormData(formContent);

            var config = {
                surfaceIds: selectedIds,
                vertexSpacing: parseFloat(data.vertexSpacing) || 0,
                closedPolygons: data.closedPolygons !== false && data.closedPolygons !== "false",
                color: data.color || "#FFCC00",
                lineWidth: parseInt(data.lineWidth) || 3,
                layerName: data.layerName || "SURF-IX"
            };

            saveSettings(config);
            callback(config);
        }
    });

    dialog.show();
}
