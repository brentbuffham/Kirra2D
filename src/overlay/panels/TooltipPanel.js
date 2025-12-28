/* prettier-ignore-file */
//=================================================
// TooltipPanel.js - Context-aware tooltip panel
// Shows info when hovering over holes, KAD elements
// Appears near cursor with delay before showing
//=================================================

import { OverlayEventBus, OverlayEvents } from "../OverlayEventBus.js";

// Step 1) Module state
var panelElement = null;
var currentData = null;
var isVisible = false;
var mouseX = 0;
var mouseY = 0;
var showTimeout = null;
var SHOW_DELAY = 300; // ms delay before showing tooltip

// Step 2) Format numbers
function formatNum(value, decimals) {
    if (value === null || value === undefined || isNaN(value)) {
        return "---";
    }
    return parseFloat(value).toFixed(decimals || 2);
}

// Step 3) Build hole tooltip HTML
function buildHoleTooltipHTML(hole) {
    if (!hole) return "";
    
    var lines = [];
    
    // Header with hole ID and entity name
    lines.push("<div class='tooltip-header'>" + (hole.entityName || "Unknown") + " / " + (hole.holeID || "?") + "</div>");
    
    // Position
    lines.push("<div class='tooltip-section'>");
    lines.push("<div class='tooltip-row'><span class='tooltip-label'>X:</span><span class='tooltip-value'>" + formatNum(hole.startXLocation, 3) + "</span></div>");
    lines.push("<div class='tooltip-row'><span class='tooltip-label'>Y:</span><span class='tooltip-value'>" + formatNum(hole.startYLocation, 3) + "</span></div>");
    lines.push("<div class='tooltip-row'><span class='tooltip-label'>Z:</span><span class='tooltip-value'>" + formatNum(hole.startZLocation, 2) + "m</span></div>");
    lines.push("</div>");
    
    // Hole properties
    lines.push("<div class='tooltip-section'>");
    if (hole.holeDiameter !== undefined) {
        lines.push("<div class='tooltip-row'><span class='tooltip-label'>Dia:</span><span class='tooltip-value'>" + formatNum(hole.holeDiameter, 0) + "mm</span></div>");
    }
    if (hole.holeLengthCalculated !== undefined) {
        lines.push("<div class='tooltip-row'><span class='tooltip-label'>Len:</span><span class='tooltip-value'>" + formatNum(hole.holeLengthCalculated, 2) + "m</span></div>");
    }
    if (hole.holeAngle !== undefined) {
        lines.push("<div class='tooltip-row'><span class='tooltip-label'>Angle:</span><span class='tooltip-value'>" + formatNum(hole.holeAngle, 1) + "\u00B0</span></div>");
    }
    if (hole.holeBearing !== undefined) {
        lines.push("<div class='tooltip-row'><span class='tooltip-label'>Bearing:</span><span class='tooltip-value'>" + formatNum(hole.holeBearing, 1) + "\u00B0</span></div>");
    }
    lines.push("</div>");
    
    // Timing (if available)
    if (hole.timingDelayMilliseconds !== undefined && hole.timingDelayMilliseconds !== null) {
        lines.push("<div class='tooltip-section'>");
        lines.push("<div class='tooltip-row'><span class='tooltip-label'>Time:</span><span class='tooltip-value'>" + formatNum(hole.timingDelayMilliseconds, 0) + "ms</span></div>");
        lines.push("</div>");
    }
    
    return lines.join("");
}

// Step 4) Build KAD point tooltip HTML
function buildKADPointTooltipHTML(point) {
    if (!point) return "";
    
    var lines = [];
    
    lines.push("<div class='tooltip-header'>Point</div>");
    lines.push("<div class='tooltip-section'>");
    lines.push("<div class='tooltip-row'><span class='tooltip-label'>X:</span><span class='tooltip-value'>" + formatNum(point.pointXLocation, 3) + "</span></div>");
    lines.push("<div class='tooltip-row'><span class='tooltip-label'>Y:</span><span class='tooltip-value'>" + formatNum(point.pointYLocation, 3) + "</span></div>");
    if (point.pointZLocation !== undefined) {
        lines.push("<div class='tooltip-row'><span class='tooltip-label'>Z:</span><span class='tooltip-value'>" + formatNum(point.pointZLocation, 2) + "m</span></div>");
    }
    lines.push("</div>");
    
    return lines.join("");
}

// Step 5) Build KAD line tooltip HTML
function buildKADLineTooltipHTML(line) {
    if (!line) return "";
    
    var lines = [];
    
    lines.push("<div class='tooltip-header'>Line</div>");
    lines.push("<div class='tooltip-section'>");
    if (line.vertices && line.vertices.length > 0) {
        lines.push("<div class='tooltip-row'><span class='tooltip-label'>Points:</span><span class='tooltip-value'>" + line.vertices.length + "</span></div>");
    }
    lines.push("</div>");
    
    return lines.join("");
}

// Step 6) Build tooltip content based on data type
function buildTooltipHTML(data) {
    if (!data) return "";
    
    if (data.type === "hole") {
        return buildHoleTooltipHTML(data.hole);
    } else if (data.type === "point") {
        return buildKADPointTooltipHTML(data.point);
    } else if (data.type === "line") {
        return buildKADLineTooltipHTML(data.line);
    } else if (data.type === "custom") {
        return "<div class='tooltip-header'>" + (data.title || "Info") + "</div>" +
               "<div class='tooltip-section'>" + (data.content || "") + "</div>";
    }
    
    return "";
}

// Step 7) Update panel position
function updatePosition() {
    if (!panelElement || !isVisible) return;
    
    var panelWidth = panelElement.offsetWidth || 160;
    var panelHeight = panelElement.offsetHeight || 100;
    
    var offsetX = 15;
    var offsetY = 15;
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

// Step 8) Show the tooltip
function showTooltip() {
    if (!panelElement || !currentData) return;
    
    panelElement.innerHTML = buildTooltipHTML(currentData);
    panelElement.style.display = "block";
    isVisible = true;
    updatePosition();
}

// Step 9) Hide the tooltip
function hideTooltip() {
    if (showTimeout) {
        clearTimeout(showTimeout);
        showTimeout = null;
    }
    
    if (panelElement) {
        panelElement.style.display = "none";
    }
    isVisible = false;
    currentData = null;
}

// Step 10) Handle tooltip event
function handleTooltipEvent(data) {
    // Cancel any pending show
    if (showTimeout) {
        clearTimeout(showTimeout);
        showTimeout = null;
    }
    
    if (!data || data.hide) {
        hideTooltip();
        return;
    }
    
    // Update position immediately
    if (data.mouseX !== undefined && data.mouseY !== undefined) {
        mouseX = data.mouseX;
        mouseY = data.mouseY;
    }
    
    // Set data and show after delay
    currentData = data;
    showTimeout = setTimeout(showTooltip, SHOW_DELAY);
}

// Step 11) Initialize the tooltip panel
export function initTooltipPanel(container) {
    panelElement = document.createElement("div");
    panelElement.id = "hud-tooltip-panel";
    panelElement.className = "hud-panel hud-tooltip-panel";
    panelElement.style.display = "none";
    
    if (container) {
        container.appendChild(panelElement);
    } else {
        document.body.appendChild(panelElement);
    }
    
    // Subscribe to tooltip events
    OverlayEventBus.on(OverlayEvents.TOOLTIP, handleTooltipEvent);
    
    // Track mouse movement
    document.addEventListener("mousemove", function(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (isVisible) {
            updatePosition();
        }
    });
    
    console.log("[TooltipPanel] Initialized");
}

// Step 12) Destroy the tooltip panel
export function destroyTooltipPanel() {
    if (showTimeout) {
        clearTimeout(showTimeout);
        showTimeout = null;
    }
    OverlayEventBus.off(OverlayEvents.TOOLTIP, handleTooltipEvent);
    if (panelElement && panelElement.parentNode) {
        panelElement.parentNode.removeChild(panelElement);
    }
    panelElement = null;
}

// Step 13) Show hole tooltip
export function showHoleTooltip(hole, x, y) {
    handleTooltipEvent({
        type: "hole",
        hole: hole,
        mouseX: x,
        mouseY: y
    });
}

// Step 14) Show KAD point tooltip
export function showPointTooltip(point, x, y) {
    handleTooltipEvent({
        type: "point",
        point: point,
        mouseX: x,
        mouseY: y
    });
}

// Step 15) Show custom tooltip
export function showCustomTooltip(title, content, x, y) {
    handleTooltipEvent({
        type: "custom",
        title: title,
        content: content,
        mouseX: x,
        mouseY: y
    });
}

// Step 16) Hide tooltip (exported)
export function hideTooltipPanel() {
    handleTooltipEvent({ hide: true });
}

// Step 17) Emit tooltip event (for external use)
export function emitTooltip(data) {
    OverlayEventBus.emit(OverlayEvents.TOOLTIP, data);
}


