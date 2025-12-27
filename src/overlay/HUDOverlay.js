/* prettier-ignore-file */
//=================================================
// HUDOverlay.js - Heads Up Display overlay manager
// Creates unified HUD for both 2D and 3D modes
// Sits between canvas/3D and UI controls (z-index: 100)
//=================================================

import { OverlayEventBus, OverlayEvents } from "./OverlayEventBus.js";
import { initStatusPanel } from "./panels/StatusPanel.js";
import { initStatsPanel } from "./panels/StatsPanel.js";
import { initLegendPanel } from "./panels/LegendPanel.js";
import { initSurfaceLegendPanel } from "./panels/SurfaceLegendPanel.js";

// Step 1) Module state
var hudContainer = null;
var isInitialized = false;

// Step 2) Create the HUD DOM structure
function createHUDDOM(parentContainer) {
    // Step 2a) Create main HUD container
    hudContainer = document.createElement("div");
    hudContainer.id = "hud-overlay";
    hudContainer.className = "hud-overlay";
    
    // Step 2b) Create panel containers
    // Status panel - top center
    var statusPanel = document.createElement("div");
    statusPanel.id = "hud-status";
    statusPanel.className = "hud-panel hud-status";
    
    // Legend panel - left side
    var legendPanel = document.createElement("div");
    legendPanel.id = "hud-legend";
    legendPanel.className = "hud-panel hud-legend";
    
    // Surface legend panel - right side
    var surfaceLegendPanel = document.createElement("div");
    surfaceLegendPanel.id = "hud-surface-legend";
    surfaceLegendPanel.className = "hud-panel hud-surface-legend";
    
    // Stats panel - bottom left
    var statsPanel = document.createElement("div");
    statsPanel.id = "hud-stats";
    statsPanel.className = "hud-panel hud-stats";
    
    // Step 2c) Add panels to container
    hudContainer.appendChild(statusPanel);
    hudContainer.appendChild(legendPanel);
    hudContainer.appendChild(surfaceLegendPanel);
    hudContainer.appendChild(statsPanel);
    
    // Step 2d) Insert into parent
    if (parentContainer) {
        parentContainer.appendChild(hudContainer);
    } else {
        document.body.appendChild(hudContainer);
    }
    
    console.log("[HUDOverlay] DOM structure created");
    return hudContainer;
}

// Step 3) Initialize the HUD system
export function initHUD(parentContainer, options) {
    if (isInitialized) {
        console.warn("[HUDOverlay] Already initialized");
        return hudContainer;
    }
    
    options = options || {};
    
    // Step 3a) Create DOM
    createHUDDOM(parentContainer);
    
    // Step 3b) Initialize each panel
    initStatusPanel(document.getElementById("hud-status"));
    initStatsPanel(document.getElementById("hud-stats"));
    initLegendPanel(document.getElementById("hud-legend"));
    initSurfaceLegendPanel(document.getElementById("hud-surface-legend"));
    
    // Step 3c) Subscribe to clear event
    OverlayEventBus.on(OverlayEvents.CLEAR, function() {
        clearHUD();
    });
    
    isInitialized = true;
    console.log("[HUDOverlay] HUD system initialized");
    
    return hudContainer;
}

// Step 4) Clear all HUD panels
export function clearHUD() {
    OverlayEventBus.emit(OverlayEvents.STATUS, { message: "", type: "clear" });
    OverlayEventBus.emit(OverlayEvents.LEGEND, { visible: false });
}

// Step 5) Destroy the HUD system (cleanup)
export function destroyHUD() {
    if (hudContainer && hudContainer.parentNode) {
        hudContainer.parentNode.removeChild(hudContainer);
    }
    hudContainer = null;
    isInitialized = false;
    OverlayEventBus.clear();
    console.log("[HUDOverlay] HUD system destroyed");
}

// Step 6) Get HUD container reference
export function getHUDContainer() {
    return hudContainer;
}

// Step 7) Check if HUD is initialized
export function isHUDInitialized() {
    return isInitialized;
}

// Step 8) Show/hide entire HUD
export function setHUDVisible(visible) {
    if (hudContainer) {
        hudContainer.style.display = visible ? "block" : "none";
    }
}

