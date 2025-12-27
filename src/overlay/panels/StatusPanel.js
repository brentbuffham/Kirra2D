/* prettier-ignore-file */
//=================================================
// StatusPanel.js - Top center status/selection/tooltips display
// Combines status messages, selection info, and tool tips
//=================================================

import { OverlayEventBus, OverlayEvents } from "../OverlayEventBus.js";

// Step 1) Module state
var panelElement = null;
var hideTimeout = null;
var defaultDuration = 5000; // Auto-hide after 5 seconds

// Step 2) Status type CSS classes
var statusClasses = {
    info: "hud-status-info",
    success: "hud-status-success",
    warning: "hud-status-warning",
    error: "hud-status-error",
    selection: "hud-status-selection",
    tooltip: "hud-status-tooltip"
};

// Step 3) Show status message
function showStatus(data) {
    if (!panelElement) return;
    
    var message = data.message || "";
    var type = data.type || "info";
    var duration = data.duration !== undefined ? data.duration : defaultDuration;
    
    // Step 3a) Clear previous timeout
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
    
    // Step 3b) Handle clear
    if (type === "clear" || message === "") {
        panelElement.style.display = "none";
        panelElement.textContent = "";
        panelElement.className = "hud-panel hud-status";
        return;
    }
    
    // Step 3c) Reset classes
    panelElement.className = "hud-panel hud-status";
    
    // Step 3d) Add type class
    if (statusClasses[type]) {
        panelElement.classList.add(statusClasses[type]);
    }
    
    // Step 3e) Set message and show
    // Support multi-line messages (replace \n with <br>)
    panelElement.innerHTML = message.replace(/\n/g, "<br>");
    panelElement.style.display = "block";
    
    // Step 3f) Auto-hide after duration (0 = no auto-hide)
    if (duration > 0) {
        hideTimeout = setTimeout(function() {
            panelElement.style.display = "none";
            panelElement.className = "hud-panel hud-status";
            hideTimeout = null;
        }, duration);
    }
}

// Step 4) Initialize the status panel
export function initStatusPanel(element) {
    panelElement = element;
    
    if (!panelElement) {
        console.error("[StatusPanel] No element provided");
        return;
    }
    
    // Step 4a) Initially hidden
    panelElement.style.display = "none";
    
    // Step 4b) Subscribe to status events
    OverlayEventBus.on(OverlayEvents.STATUS, showStatus);
    
    console.log("[StatusPanel] Initialized");
}

// Step 5) Destroy the status panel
export function destroyStatusPanel() {
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
    OverlayEventBus.off(OverlayEvents.STATUS, showStatus);
    panelElement = null;
}

// Step 6) Convenience functions to emit different status types
export function showStatusMessage(message, duration) {
    OverlayEventBus.emit(OverlayEvents.STATUS, {
        message: message,
        type: "info",
        duration: duration
    });
}

export function showSuccessMessage(message, duration) {
    OverlayEventBus.emit(OverlayEvents.STATUS, {
        message: message,
        type: "success",
        duration: duration
    });
}

export function showWarningMessage(message, duration) {
    OverlayEventBus.emit(OverlayEvents.STATUS, {
        message: message,
        type: "warning",
        duration: duration
    });
}

export function showErrorMessage(message, duration) {
    OverlayEventBus.emit(OverlayEvents.STATUS, {
        message: message,
        type: "error",
        duration: duration
    });
}

export function showSelectionMessage(message, duration) {
    OverlayEventBus.emit(OverlayEvents.STATUS, {
        message: message,
        type: "selection",
        duration: duration !== undefined ? duration : 0 // Selection messages don't auto-hide by default
    });
}

export function showTooltip(message, duration) {
    OverlayEventBus.emit(OverlayEvents.STATUS, {
        message: message,
        type: "tooltip",
        duration: duration !== undefined ? duration : 3000
    });
}

export function clearStatus() {
    OverlayEventBus.emit(OverlayEvents.STATUS, { type: "clear" });
}
