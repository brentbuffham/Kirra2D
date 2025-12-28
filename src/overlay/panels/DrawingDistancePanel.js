/* prettier-ignore-file */
//=================================================
// DrawingDistancePanel.js - Distance display for KAD drawing tools
// Shows distance and bearing when drawing lines/polys
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

// Step 3) Build distance HTML content
function buildDistanceHTML(data) {
    if (!data) return "";
    
    var lines = [];
    
    // Distance
    if (data.distance !== undefined) {
        lines.push("<div class='drawing-row'><span class='drawing-label'>Dist:</span><span class='drawing-value'>" + formatNum(data.distance) + "m</span></div>");
    }
    
    // Bearing
    if (data.bearing !== undefined) {
        lines.push("<div class='drawing-row'><span class='drawing-label'>Brg:</span><span class='drawing-value'>" + formatNum(data.bearing, 1) + "\u00B0</span></div>");
    }
    
    // Note: Total removed per user request - only show distance and bearing
    
    return lines.join("");
}

// Step 3b) Tool color classes removed - using single unified color scheme

// Step 4) Update panel position to follow mouse
function updatePosition() {
    if (!panelElement || !isVisible) return;
    
    var panelWidth = panelElement.offsetWidth || 120;
    var panelHeight = panelElement.offsetHeight || 50;
    
    var offsetX = 20;
    var offsetY = 20;
    var posX = mouseX + offsetX;
    var posY = mouseY + offsetY;
    
    var viewWidth = window.innerWidth;
    var viewHeight = window.innerHeight;
    
    // Flip horizontally if too close to right edge
    if (posX + panelWidth > viewWidth - 10) {
        posX = mouseX - panelWidth - offsetX;
    }
    
    // Flip vertically if too close to bottom
    if (posY + panelHeight > viewHeight - 10) {
        posY = mouseY - panelHeight - offsetY;
    }
    
    panelElement.style.left = posX + "px";
    panelElement.style.top = posY + "px";
}

// Step 5) Update panel display
function updateDisplay() {
    if (!panelElement) return;
    
    if (currentData && isVisible) {
        panelElement.innerHTML = buildDistanceHTML(currentData);
        panelElement.style.display = "block";
        panelElement.className = "hud-panel hud-drawing-distance-panel";
        updatePosition();
    } else {
        panelElement.style.display = "none";
    }
}

// Step 6) Handle drawing distance update event
function handleDrawingDistance(data) {
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

// Step 7) Initialize the drawing distance panel
export function initDrawingDistancePanel(container) {
    panelElement = document.createElement("div");
    panelElement.id = "hud-drawing-distance-panel";
    panelElement.className = "hud-panel hud-drawing-distance-panel";
    panelElement.style.display = "none";
    
    if (container) {
        container.appendChild(panelElement);
    } else {
        document.body.appendChild(panelElement);
    }
    
    // Subscribe to drawing distance events
    OverlayEventBus.on(OverlayEvents.DRAWING_DISTANCE, handleDrawingDistance);
    
    // Track mouse movement
    document.addEventListener("mousemove", function(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (isVisible) {
            updatePosition();
        }
    });
    
    console.log("[DrawingDistancePanel] Initialized");
}

// Step 8) Destroy the panel
export function destroyDrawingDistancePanel() {
    OverlayEventBus.off(OverlayEvents.DRAWING_DISTANCE, handleDrawingDistance);
    if (panelElement && panelElement.parentNode) {
        panelElement.parentNode.removeChild(panelElement);
    }
    panelElement = null;
    currentData = null;
    isVisible = false;
}

// Step 9) Show drawing distance panel
export function showDrawingDistance(distance, bearing, toolType, x, y) {
    if (x !== undefined && y !== undefined) {
        mouseX = x;
        mouseY = y;
    }
    currentData = {
        distance: distance,
        bearing: bearing,
        toolType: toolType || "line"
    };
    isVisible = true;
    updateDisplay();
}

// Step 10) Hide drawing distance panel
export function hideDrawingDistance() {
    currentData = null;
    isVisible = false;
    updateDisplay();
}

// Step 11) Emit drawing distance data
export function emitDrawingDistance(data) {
    OverlayEventBus.emit(OverlayEvents.DRAWING_DISTANCE, data);
}


