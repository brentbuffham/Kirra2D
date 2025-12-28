/* prettier-ignore-file */
//=================================================
// OverlayEventBus.js - Lightweight pub/sub event system for overlay panels
// This keeps kirra.js lean - just emit events, panels subscribe
//=================================================

// Step 1) Private listeners storage
var listeners = {};

// Step 2) Throttle helper for high-frequency events like mouse move
var throttleTimers = {};

function throttle(eventName, delay) {
    return function(callback) {
        if (throttleTimers[eventName]) return;
        throttleTimers[eventName] = setTimeout(function() {
            throttleTimers[eventName] = null;
        }, delay);
        callback();
    };
}

// Step 3) Export the event bus
export var OverlayEventBus = {
    // Step 3a) Subscribe to an event
    on: function(event, callback) {
        if (!listeners[event]) {
            listeners[event] = [];
        }
        listeners[event].push(callback);
        return callback; // Return for unsubscribe reference
    },

    // Step 3b) Unsubscribe from an event
    off: function(event, callback) {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(function(cb) {
            return cb !== callback;
        });
    },

    // Step 3c) Emit an event to all subscribers
    emit: function(event, data) {
        if (!listeners[event]) return;
        for (var i = 0; i < listeners[event].length; i++) {
            try {
                listeners[event][i](data);
            } catch (err) {
                console.error("[OverlayEventBus] Error in " + event + " handler:", err);
            }
        }
    },

    // Step 3d) Emit with throttling (for coordinates, mouse move)
    emitThrottled: function(event, data, delay) {
        var self = this;
        throttle(event, delay || 16)(function() {
            self.emit(event, data);
        });
    },

    // Step 3e) Clear all listeners (for cleanup/testing)
    clear: function() {
        listeners = {};
        throttleTimers = {};
    },

    // Step 3f) Debug: list all registered events
    debug: function() {
        var events = Object.keys(listeners);
        console.log("[OverlayEventBus] Registered events:", events);
        for (var i = 0; i < events.length; i++) {
            console.log("  - " + events[i] + ": " + listeners[events[i]].length + " listeners");
        }
    }
};

// Step 4) Event name constants for consistency
export var OverlayEvents = {
    // Status/Selection/Tooltips
    STATUS: "overlay:status",
    TOOLTIP: "overlay:tooltip",
    
    // Stats panel events
    STATS: "overlay:stats",
    COORDINATES: "overlay:coordinates",
    RULER: "overlay:ruler",
    PROTRACTOR: "overlay:protractor",
    
    // Floating measurement panels
    RULER_MEASUREMENT: "overlay:rulerMeasurement",
    PROTRACTOR_MEASUREMENT: "overlay:protractorMeasurement",
    DRAWING_DISTANCE: "overlay:drawingDistance",
    
    // Legend events
    LEGEND: "overlay:legend",
    SURFACE_LEGEND: "overlay:surfaceLegend",
    
    // General
    MODE_CHANGE: "overlay:modeChange",
    CLEAR: "overlay:clear"
};

