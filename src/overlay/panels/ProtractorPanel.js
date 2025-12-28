/* prettier-ignore-file */
//=================================================
// ProtractorPanel.js - Floating protractor measurement panel
// Shows protractor measurements in a CSS panel that follows the mouse
// Works in both 2D and 3D modes
//=================================================

import { OverlayEventBus, OverlayEvents } from "../OverlayEventBus.js";

// Step 1) Module state
var panelElement = null;
var currentData = null;
var isVisible = false;
var mouseX = 0;
var mouseY = 0;

// Step 2) Format numbers
function formatNum(value, decimals) {
    if (value === null || value === undefined || isNaN(value)) {
        return "---";
    }
    return parseFloat(value).toFixed(decimals || 2);
}

// Step 3) Build protractor HTML content
function buildProtractorHTML(data) {
    if (!data) return "";
    
    var lines = [];
    
    // Line 1: First leg (P1 -> P2) distance and bearing
    if (data.d1 !== undefined && data.d1 > 0) {
        lines.push("<div class='protractor-row'><span class='protractor-label'>P1\u2192P2:</span><span class='protractor-value'>" + formatNum(data.d1) + "m @ " + formatNum(data.bearing1, 1) + "\u00B0</span></div>");
    }
    
    // Line 2: Second leg (P1 -> P3) distance and bearing
    if (data.d2 !== undefined && data.d2 > 0) {
        lines.push("<div class='protractor-row'><span class='protractor-label'>P1\u2192P3:</span><span class='protractor-value'>" + formatNum(data.d2) + "m @ " + formatNum(data.bearing2, 1) + "\u00B0</span></div>");
    }
    
    // Line 3: Inner and outer angles
    if (data.innerAngle !== undefined) {
        lines.push("<div class='protractor-row'><span class='protractor-label'>Inner:</span><span class='protractor-value'>" + formatNum(data.innerAngle, 1) + "\u00B0</span></div>");
    }
    if (data.outerAngle !== undefined) {
        lines.push("<div class='protractor-row'><span class='protractor-label'>Outer:</span><span class='protractor-value'>" + formatNum(data.outerAngle, 1) + "\u00B0</span></div>");
    }
    
    return lines.join("");
}

// Step 4) Update panel position to follow mouse
function updatePosition() {
    if (!panelElement || !isVisible) return;
    
    var panelWidth = panelElement.offsetWidth || 180;
    var panelHeight = panelElement.offsetHeight || 80;
    
    var offsetX = 15;
    var offsetY = -10;
    var posX = mouseX + offsetX;
    var posY = mouseY + offsetY - panelHeight;
    
    var viewWidth = window.innerWidth;
    var viewHeight = window.innerHeight;
    
    // Flip horizontally if too close to right edge
    if (posX + panelWidth > viewWidth - 10) {
        posX = mouseX - panelWidth - offsetX;
    }
    
    // Flip vertically if too close to top
    if (posY < 10) {
        posY = mouseY + offsetY + 20;
    }
    
    panelElement.style.left = posX + "px";
    panelElement.style.top = posY + "px";
}

// Step 5) Update panel display
function updateDisplay() {
    if (!panelElement) return;
    
    if (currentData && isVisible) {
        panelElement.innerHTML = buildProtractorHTML(currentData);
        panelElement.style.display = "block";
        updatePosition();
    } else {
        panelElement.style.display = "none";
    }
}

// Step 6) Handle protractor measurement update event
function handleProtractorMeasurement(data) {
    if (!data) {
        currentData = null;
        isVisible = false;
        updateDisplay();
        return;
    }
    
    currentData = data;
    isVisible = true;
    
    if (data.mouseX !== undefined && data.mouseY !== undefined) {
        mouseX = data.mouseX;
        mouseY = data.mouseY;
    }
    
    updateDisplay();
}

// Step 7) Initialize the protractor panel
export function initProtractorPanel(container) {
    panelElement = document.createElement("div");
    panelElement.id = "hud-protractor-panel";
    panelElement.className = "hud-panel hud-protractor-panel";
    panelElement.style.display = "none";
    
    if (container) {
        container.appendChild(panelElement);
    } else {
        document.body.appendChild(panelElement);
    }
    
    // Subscribe to protractor measurement events
    OverlayEventBus.on(OverlayEvents.PROTRACTOR_MEASUREMENT, handleProtractorMeasurement);
    
    // Track mouse movement
    document.addEventListener("mousemove", function(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (isVisible) {
            updatePosition();
        }
    });
    
    console.log("[ProtractorPanel] Initialized");
}

// Step 8) Destroy the protractor panel
export function destroyProtractorPanel() {
    OverlayEventBus.off(OverlayEvents.PROTRACTOR_MEASUREMENT, handleProtractorMeasurement);
    if (panelElement && panelElement.parentNode) {
        panelElement.parentNode.removeChild(panelElement);
    }
    panelElement = null;
    currentData = null;
    isVisible = false;
}

// Step 9) Show protractor panel with data
export function showProtractorPanel(data, x, y) {
    if (x !== undefined && y !== undefined) {
        mouseX = x;
        mouseY = y;
    }
    currentData = data;
    isVisible = true;
    updateDisplay();
}

// Step 10) Hide protractor panel
export function hideProtractorPanel() {
    currentData = null;
    isVisible = false;
    updateDisplay();
}

// Step 11) Emit protractor measurement
export function emitProtractorMeasurement(data) {
    OverlayEventBus.emit(OverlayEvents.PROTRACTOR_MEASUREMENT, data);
}


