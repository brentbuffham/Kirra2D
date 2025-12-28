/* prettier-ignore-file */
//=================================================
// PatternToolPanel.js - Visual feedback for pattern creation tools
// Shows labels (START, END, REF) and distance for pattern-in-polygon,
// holes-along-line, and holes-along-polyline tools
// Works in both 2D and 3D modes
//=================================================

import { OverlayEventBus, OverlayEvents } from "../OverlayEventBus.js";

// Step 1) Module state
var panelElement = null;
var labelElements = new Map(); // Map of label id -> DOM element
var currentData = null;
var isVisible = false;

// Step 2) Format numbers
function formatNum(value, decimals) {
    if (value === null || value === undefined || isNaN(value)) {
        return "---";
    }
    return parseFloat(value).toFixed(decimals || 2);
}

// Step 3) Create a label element
function createLabel(id, text, color, x, y) {
    var label = document.createElement("div");
    label.id = "pattern-label-" + id;
    label.className = "pattern-tool-label";
    label.style.position = "absolute";
    label.style.left = x + "px";
    label.style.top = y + "px";
    // Use darker colors for better readability on light backgrounds
    var displayColor = color;
    if (color === "#00ff00") {
        displayColor = "#00aa00"; // Darker green for START label
    }
    label.style.color = displayColor;
    label.style.backgroundColor = "rgba(40, 40, 40, 0.85)";
    label.style.padding = "3px 8px";
    label.style.borderRadius = "3px";
    label.style.fontSize = "12px";
    label.style.fontWeight = "bold";
    label.style.fontFamily = "'Consolas', 'Monaco', 'Courier New', monospace";
    label.style.pointerEvents = "none";
    label.style.zIndex = "150";
    label.style.whiteSpace = "nowrap";
    label.style.textShadow = "1px 1px 2px rgba(0,0,0,0.9)";
    label.style.border = "1px solid rgba(100, 100, 100, 0.5)";
    label.textContent = text;
    return label;
}

// Step 4) Create distance indicator element
function createDistanceIndicator(distance, x, y) {
    var indicator = document.createElement("div");
    indicator.id = "pattern-distance-indicator";
    indicator.className = "pattern-tool-distance";
    indicator.style.position = "absolute";
    indicator.style.left = x + "px";
    indicator.style.top = y + "px";
    indicator.style.transform = "translate(-50%, -50%)";
    indicator.style.backgroundColor = "rgba(40, 40, 40, 0.85)";
    indicator.style.border = "1px solid rgba(0, 170, 0, 0.8)";
    indicator.style.padding = "3px 10px";
    indicator.style.borderRadius = "3px";
    indicator.style.fontSize = "12px";
    indicator.style.fontWeight = "bold";
    indicator.style.fontFamily = "'Consolas', 'Monaco', 'Courier New', monospace";
    indicator.style.color = "#00cc00"; // Darker green for readability
    indicator.style.pointerEvents = "none";
    indicator.style.zIndex = "150";
    indicator.style.whiteSpace = "nowrap";
    indicator.style.textShadow = "1px 1px 2px rgba(0,0,0,0.9)";
    indicator.textContent = formatNum(distance) + "m";
    return indicator;
}

// Step 5) Clear all labels
function clearLabels() {
    labelElements.forEach(function(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });
    labelElements.clear();
}

// Step 6) Update display based on current data
function updateDisplay() {
    if (!panelElement) return;
    
    // Clear existing labels
    clearLabels();
    
    if (!currentData || !isVisible) {
        return;
    }
    
    var data = currentData;
    
    // Step 6a) Add START label
    if (data.startPoint && data.startCanvasX !== undefined) {
        var startLabel = createLabel("start", "START", "#00ff00", data.startCanvasX + 12, data.startCanvasY - 20);
        panelElement.appendChild(startLabel);
        labelElements.set("start", startLabel);
    }
    
    // Step 6b) Add END label
    if (data.endPoint && data.endCanvasX !== undefined) {
        var endLabel = createLabel("end", "END", "#ff0000", data.endCanvasX + 12, data.endCanvasY - 20);
        panelElement.appendChild(endLabel);
        labelElements.set("end", endLabel);
    }
    
    // Step 6c) Add REF label
    if (data.refPoint && data.refCanvasX !== undefined) {
        var refLabel = createLabel("ref", "REF", "#ff00ff", data.refCanvasX + 12, data.refCanvasY - 20);
        panelElement.appendChild(refLabel);
        labelElements.set("ref", refLabel);
    }
    
    // Step 6d) Add distance indicator at midpoint
    if (data.distance !== undefined && data.midCanvasX !== undefined) {
        var distIndicator = createDistanceIndicator(data.distance, data.midCanvasX, data.midCanvasY);
        panelElement.appendChild(distIndicator);
        labelElements.set("distance", distIndicator);
    }
    
    // Step 6e) Add step indicator
    if (data.stepText) {
        var stepLabel = createLabel("step", data.stepText, "#ffffff", 10, 10);
        stepLabel.style.position = "relative";
        stepLabel.style.display = "inline-block";
        stepLabel.style.marginBottom = "5px";
        // Don't add to panel - this goes to status message
    }
}

// Step 7) Handle pattern tool update event
function handlePatternToolUpdate(data) {
    if (!data) {
        currentData = null;
        isVisible = false;
        updateDisplay();
        return;
    }
    
    currentData = data;
    isVisible = true;
    updateDisplay();
}

// Step 8) Initialize the pattern tool panel
export function initPatternToolPanel(container) {
    panelElement = document.createElement("div");
    panelElement.id = "hud-pattern-tool-panel";
    panelElement.className = "hud-panel hud-pattern-tool-panel";
    panelElement.style.position = "absolute";
    panelElement.style.top = "0";
    panelElement.style.left = "0";
    panelElement.style.width = "100%";
    panelElement.style.height = "100%";
    panelElement.style.pointerEvents = "none";
    panelElement.style.zIndex = "100";
    
    if (container) {
        container.appendChild(panelElement);
    } else {
        document.body.appendChild(panelElement);
    }
    
    // Subscribe to pattern tool events
    OverlayEventBus.on(OverlayEvents.PATTERN_TOOL, handlePatternToolUpdate);
    
    console.log("[PatternToolPanel] Initialized");
}

// Step 9) Destroy the panel
export function destroyPatternToolPanel() {
    OverlayEventBus.off(OverlayEvents.PATTERN_TOOL, handlePatternToolUpdate);
    clearLabels();
    if (panelElement && panelElement.parentNode) {
        panelElement.parentNode.removeChild(panelElement);
    }
    panelElement = null;
    currentData = null;
    isVisible = false;
}

// Step 10) Show pattern tool labels
// data = {
//   startPoint: {x, y},
//   startCanvasX, startCanvasY,
//   endPoint: {x, y},
//   endCanvasX, endCanvasY,
//   refPoint: {x, y},
//   refCanvasX, refCanvasY,
//   distance: number,
//   midCanvasX, midCanvasY,
//   toolType: "polygon" | "line" | "polyline"
// }
export function showPatternToolLabels(data) {
    currentData = data;
    isVisible = true;
    updateDisplay();
}

// Step 11) Hide pattern tool labels
export function hidePatternToolLabels() {
    currentData = null;
    isVisible = false;
    updateDisplay();
}

// Step 12) Update a single label position (for dynamic updates)
export function updateLabelPosition(labelId, x, y) {
    var label = labelElements.get(labelId);
    if (label) {
        label.style.left = x + "px";
        label.style.top = y + "px";
    }
}

// Step 13) Emit pattern tool data
export function emitPatternTool(data) {
    OverlayEventBus.emit(OverlayEvents.PATTERN_TOOL, data);
}

