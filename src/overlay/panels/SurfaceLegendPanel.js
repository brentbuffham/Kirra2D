/* prettier-ignore-file */
//=================================================
// SurfaceLegendPanel.js - Right side surface elevation legend
// Shows: Multiple surface names with elevation info
//=================================================

import { OverlayEventBus, OverlayEvents } from "../OverlayEventBus.js";

// Step 1) Module state
var panelElement = null;
var currentSurfaces = [];

// Step 2) Build surface legend HTML
function buildSurfaceLegendHTML() {
    if (currentSurfaces.length === 0) return "";
    
    var html = "<div class='hud-surface-legend-title'>Surface Elevation</div>";
    html += "<div class='hud-surface-legend-items'>";
    
    for (var i = 0; i < currentSurfaces.length; i++) {
        var surface = currentSurfaces[i];
        html += "<div class='hud-surface-legend-item'>";
        html += "<span class='hud-surface-name'>" + (surface.name || "Surface " + (i + 1)) + "</span>";
        if (surface.displayMinZ !== undefined && surface.displayMaxZ !== undefined) {
            html += "<span class='hud-surface-range'>";
            if (surface.hasCustomLimits) {
                // Show custom range with indication it's limited
                html += "Z: " + surface.displayMinZ.toFixed(1) + " - " + surface.displayMaxZ.toFixed(1) + " (limited)";
            } else {
                // Show actual range
                html += "Z: " + surface.displayMinZ.toFixed(1) + " - " + surface.displayMaxZ.toFixed(1);
            }
            html += "</span>";

            // Optional: Show actual range if different from display range
            if (surface.hasCustomLimits &&
                (Math.abs(surface.actualMinZ - surface.displayMinZ) > 0.1 ||
                 Math.abs(surface.actualMaxZ - surface.displayMaxZ) > 0.1)) {
                html += "<span class='hud-surface-actual-range'>";
                html += "(actual: " + surface.actualMinZ.toFixed(1) + " - " + surface.actualMaxZ.toFixed(1) + ")";
                html += "</span>";
            }
        }
        if (surface.color) {
            html += "<span class='hud-surface-color' style='background-color: " + surface.color + ";'></span>";
        }
        html += "</div>";
    }
    
    html += "</div>";
    return html;
}

// Step 3) Update display
function updateDisplay() {
    if (!panelElement) return;
    
    if (currentSurfaces.length === 0) {
        panelElement.style.display = "none";
        panelElement.innerHTML = "";
        return;
    }
    
    panelElement.innerHTML = buildSurfaceLegendHTML();
    panelElement.style.display = "block";
}

// Step 4) Handle surface legend update event
function handleSurfaceLegendUpdate(data) {
    if (!data || !data.surfaces || data.surfaces.length === 0) {
        currentSurfaces = [];
        updateDisplay();
        return;
    }
    
    if (data.visible === false) {
        currentSurfaces = [];
    } else {
        currentSurfaces = data.surfaces;
    }
    
    updateDisplay();
}

// Step 5) Initialize the surface legend panel
export function initSurfaceLegendPanel(element) {
    panelElement = element;
    
    if (!panelElement) {
        console.error("[SurfaceLegendPanel] No element provided");
        return;
    }
    
    // Step 5a) Initially hidden
    panelElement.style.display = "none";
    
    // Step 5b) Subscribe to surface legend events
    OverlayEventBus.on(OverlayEvents.SURFACE_LEGEND, handleSurfaceLegendUpdate);
    
    console.log("[SurfaceLegendPanel] Initialized");
}

// Step 6) Destroy the surface legend panel
export function destroySurfaceLegendPanel() {
    OverlayEventBus.off(OverlayEvents.SURFACE_LEGEND, handleSurfaceLegendUpdate);
    panelElement = null;
}

// Step 7) Convenience function to show surface legend
export function showSurfaceLegend(surfaces) {
    OverlayEventBus.emit(OverlayEvents.SURFACE_LEGEND, {
        visible: true,
        surfaces: surfaces
    });
}

// Step 8) Convenience function to hide surface legend
export function hideSurfaceLegend() {
    OverlayEventBus.emit(OverlayEvents.SURFACE_LEGEND, { visible: false, surfaces: [] });
}

// Step 9) Convenience function to update single surface
export function updateSurface(name, minZ, maxZ, color) {
    // Find and update existing, or add new
    var found = false;
    for (var i = 0; i < currentSurfaces.length; i++) {
        if (currentSurfaces[i].name === name) {
            currentSurfaces[i].minZ = minZ;
            currentSurfaces[i].maxZ = maxZ;
            if (color) currentSurfaces[i].color = color;
            found = true;
            break;
        }
    }
    if (!found) {
        currentSurfaces.push({ name: name, minZ: minZ, maxZ: maxZ, color: color });
    }
    updateDisplay();
}

// Step 10) Convenience function to remove surface
export function removeSurface(name) {
    currentSurfaces = currentSurfaces.filter(function(s) {
        return s.name !== name;
    });
    updateDisplay();
}

