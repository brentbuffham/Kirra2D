/* prettier-ignore-file */
//=================================================
// RulerPanel.js - Floating ruler measurement panel
// Shows ruler measurements in a CSS panel that follows the mouse
// Works in both 2D and 3D modes
//=================================================

import { OverlayEventBus, OverlayEvents } from "../OverlayEventBus.js";

// Step 1) Module state
var panelElement = null;
var currentData = null;
var isVisible = false;
var mouseX = 0;
var mouseY = 0;

// Step 2) Format numbers to 2 decimal places
function formatNum(value, decimals) {
    if (value === null || value === undefined || isNaN(value)) {
        return "---";
    }
    return parseFloat(value).toFixed(decimals || 2);
}

// Step 3) Build ruler HTML content
function buildRulerHTML(data) {
    if (!data) return "";
    
    var lines = [];
    
    // Line 1: Z elevations
    lines.push("<div class='ruler-row'><span class='ruler-label'>Z1:</span><span class='ruler-value'>" + formatNum(data.z1) + "m</span> <span class='ruler-label'>Z2:</span><span class='ruler-value'>" + formatNum(data.z2) + "m</span></div>");
    
    // Line 2: Distances
    lines.push("<div class='ruler-row'><span class='ruler-label'>Plan:</span><span class='ruler-value'>" + formatNum(data.planDistance) + "m</span> <span class='ruler-label'>Total:</span><span class='ruler-value'>" + formatNum(data.totalDistance) + "m</span></div>");
    
    // Line 3: Delta Z and Dip. Dip is the angle of the line from the horizontal plane.
    lines.push("<div class='ruler-row'><span class='ruler-label'>\u0394Z:</span><span class='ruler-value'>" + formatNum(data.deltaZ) + "m</span> <span class='ruler-label'>Dip:</span><span class='ruler-value'>" + formatNum(data.elevationAngle, 1) + "\u00B0</span></div>");
    
    // Line 4: Slope
    lines.push("<div class='ruler-row'><span class='ruler-label'>Slope:</span><span class='ruler-value'>" + formatNum(data.slopePercent, 1) + "%</span></div>");
    
    return lines.join("");
}

// Step 4) Update panel position to follow mouse
function updatePosition() {
    if (!panelElement || !isVisible) return;
    
    // Step 4a) Get panel dimensions
    var panelWidth = panelElement.offsetWidth || 200;
    var panelHeight = panelElement.offsetHeight || 80;
    
    // Step 4b) Calculate position with offset from mouse
    var offsetX = 15;
    var offsetY = -10;
    var posX = mouseX + offsetX;
    var posY = mouseY + offsetY - panelHeight;
    
    // Step 4c) Keep panel within viewport
    var viewWidth = window.innerWidth;
    var viewHeight = window.innerHeight;
    
    // Step 4d) Flip horizontally if too close to right edge
    if (posX + panelWidth > viewWidth - 10) {
        posX = mouseX - panelWidth - offsetX;
    }
    
    // Step 4e) Flip vertically if too close to top
    if (posY < 10) {
        posY = mouseY + offsetY + 20;
    }
    
    // Step 4f) Apply position
    panelElement.style.left = posX + "px";
    panelElement.style.top = posY + "px";
}

// Step 5) Update panel display
function updateDisplay() {
    if (!panelElement) return;
    
    if (currentData && isVisible) {
        panelElement.innerHTML = buildRulerHTML(currentData);
        panelElement.style.display = "block";
        updatePosition();
    } else {
        panelElement.style.display = "none";
    }
}

// Step 6) Handle ruler measurement update event
function handleRulerMeasurement(data) {
    if (!data) {
        // Step 6a) Clear/hide the panel
        currentData = null;
        isVisible = false;
        updateDisplay();
        return;
    }
    
    // Step 6b) Update data and show panel
    currentData = data;
    isVisible = true;
    
    // Step 6c) Update mouse position if provided
    if (data.mouseX !== undefined && data.mouseY !== undefined) {
        mouseX = data.mouseX;
        mouseY = data.mouseY;
    }
    
    updateDisplay();
}

// Step 7) Handle mouse position updates (for panel following)
function handleMousePosition(x, y) {
    mouseX = x;
    mouseY = y;
    if (isVisible) {
        updatePosition();
    }
}

// Step 8) Initialize the ruler panel
export function initRulerPanel(container) {
    // Step 8a) Create panel element
    panelElement = document.createElement("div");
    panelElement.id = "hud-ruler-panel";
    panelElement.className = "hud-panel hud-ruler-panel";
    panelElement.style.display = "none";
    
    // Step 8b) Add to container
    if (container) {
        container.appendChild(panelElement);
    } else {
        document.body.appendChild(panelElement);
    }
    
    // Step 8c) Subscribe to ruler measurement events
    OverlayEventBus.on(OverlayEvents.RULER_MEASUREMENT, handleRulerMeasurement);
    
    // Step 8d) Track mouse movement for panel positioning
    document.addEventListener("mousemove", function(e) {
        handleMousePosition(e.clientX, e.clientY);
    });
    
    console.log("[RulerPanel] Initialized");
}

// Step 9) Destroy the ruler panel
export function destroyRulerPanel() {
    OverlayEventBus.off(OverlayEvents.RULER_MEASUREMENT, handleRulerMeasurement);
    if (panelElement && panelElement.parentNode) {
        panelElement.parentNode.removeChild(panelElement);
    }
    panelElement = null;
    currentData = null;
    isVisible = false;
}

// Step 10) Show ruler panel with data
export function showRulerPanel(data, x, y) {
    if (x !== undefined && y !== undefined) {
        mouseX = x;
        mouseY = y;
    }
    currentData = data;
    isVisible = true;
    updateDisplay();
}

// Step 11) Hide ruler panel
export function hideRulerPanel() {
    currentData = null;
    isVisible = false;
    updateDisplay();
}

// Step 12) Convenience function to emit ruler measurement
export function emitRulerMeasurement(data) {
    OverlayEventBus.emit(OverlayEvents.RULER_MEASUREMENT, data);
}


