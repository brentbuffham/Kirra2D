/* prettier-ignore-file */
//=================================================
// StatsPanel.js - Bottom left stats display
// Shows: Blasts, Holes, KAD counts, Mouse/World coords, Scale, Ruler, Protractor, Version
//=================================================

import { OverlayEventBus, OverlayEvents } from "../OverlayEventBus.js";

// Step 1) Module state
var panelElement = null;
var currentData = {
    blastsCount: 0,
    holesCount: 0,
    pointsCount: 0,
    linesCount: 0,
    polysCount: 0,
    circlesCount: 0,
    textsCount: 0,
    mouse2D: { x: 0, y: 0 },
    scale: 1,
    world3D: { x: 0, y: 0, z: 0 },
    snapped: false,
    ruler: { l1: null, l2: null },
    protractor: { p1p2: null, p2p3: null, inner: null, outer: null },
    version: ""
};

// Step 2) Format number with fixed decimals
function formatNum(value, decimals) {
    if (value === null || value === undefined || isNaN(value)) {
        return "---";
    }
    return value.toFixed(decimals || 3);
}

// Step 2b) Calculate map scale ratio from zoom value
// currentScale = pixels per world unit (meter)
// At 96 DPI: 1 meter on screen = 3779.52 pixels (39.37 inches/m × 96 pixels/inch)
// Scale ratio = 3779.52 / currentScale (at 96 DPI)
function calculateScaleRatio(zoomValue) {
    if (!zoomValue || zoomValue <= 0) return "---";
    
    // Step 2b.1) Calculate raw scale ratio at 96 DPI
    var PIXELS_PER_METER_96DPI = 3779.52; // 39.37 inches/meter × 96 pixels/inch
    var scaleRatio = PIXELS_PER_METER_96DPI / zoomValue;
    
    // Step 2b.2) Format the ratio nicely (round to clean numbers)
    if (scaleRatio < 1) {
        // Very zoomed in (bigger than real life on screen)
        return "1:" + (1 / scaleRatio).toFixed(0);
    } else if (scaleRatio < 10) {
        return "1:" + scaleRatio.toFixed(1);
    } else if (scaleRatio < 100) {
        return "1:" + Math.round(scaleRatio);
    } else if (scaleRatio < 1000) {
        return "1:" + (Math.round(scaleRatio / 10) * 10);
    } else if (scaleRatio < 10000) {
        return "1:" + (Math.round(scaleRatio / 100) * 100);
    } else {
        return "1:" + (Math.round(scaleRatio / 1000) * 1000);
    }
}

// Step 3) Build stats HTML
function buildStatsHTML() {
    var lines = [];
    
    // Line 1: Blasts and Holes
    lines.push("Blasts[" + currentData.blastsCount + "] Holes[" + currentData.holesCount + "]");
    
    // Line 2: KAD entity counts
    lines.push("Point[" + currentData.pointsCount + "] Line[" + currentData.linesCount + "] Poly[" + currentData.polysCount + "] Circle[" + currentData.circlesCount + "] Text[" + currentData.textsCount + "]");
    
    // Line 3: Mouse 2D + Scale (calculated from zoom as map ratio)
    var scaleDisplay = calculateScaleRatio(currentData.scale);
    lines.push("Mouse 2D [X: " + formatNum(currentData.mouse2D.x, 3) + ", Y: " + formatNum(currentData.mouse2D.y, 3) + "] Scale[" + scaleDisplay + "]");
    
    // Line 4: World 3D (with snap indicator)
    var world3DLabel = currentData.snapped ? "Snapped 3D" : "World 3D";
    var snapIcon = currentData.snapped ? " \ud83e\uddf2" : "";
    lines.push(world3DLabel + " [X: " + formatNum(currentData.world3D.x, 3) + ", Y: " + formatNum(currentData.world3D.y, 3) + ", Z: " + formatNum(currentData.world3D.z, 3) + "]" + snapIcon);
    
    // Line 5: Ruler measurements (only if active)
    if (currentData.ruler.l1 !== null || currentData.ruler.l2 !== null) {
        var rulerLine = "L1[" + formatNum(currentData.ruler.l1, 3) + "]";
        if (currentData.ruler.l2 !== null) {
            rulerLine += " L2[" + formatNum(currentData.ruler.l2, 3) + "]";
        }
        lines.push(rulerLine);
    }
    
    // Line 6: Protractor measurements (only if active)
    if (currentData.protractor.p1p2 !== null) {
        var protLine = "P1->P2[" + formatNum(currentData.protractor.p1p2, 1) + "°]";
        if (currentData.protractor.p2p3 !== null) {
            protLine += " P2->P3[" + formatNum(currentData.protractor.p2p3, 1) + "°]";
        }
        if (currentData.protractor.inner !== null) {
            protLine += " Inner[" + formatNum(currentData.protractor.inner, 1) + "°]";
        }
        if (currentData.protractor.outer !== null) {
            protLine += " Outer[" + formatNum(currentData.protractor.outer, 1) + "°]";
        }
        lines.push(protLine);
    }
    
    // Line 7: Version
    if (currentData.version) {
        lines.push("Ver: " + currentData.version);
    }
    
    return lines.join("<br>");
}

// Step 4) Update panel display
function updateDisplay() {
    if (!panelElement) return;
    panelElement.innerHTML = buildStatsHTML();
}

// Step 5) Handle stats update event
function handleStatsUpdate(data) {
    if (!data) return;
    
    // Update only provided fields
    if (data.blastsCount !== undefined) currentData.blastsCount = data.blastsCount;
    if (data.holesCount !== undefined) currentData.holesCount = data.holesCount;
    if (data.pointsCount !== undefined) currentData.pointsCount = data.pointsCount;
    if (data.linesCount !== undefined) currentData.linesCount = data.linesCount;
    if (data.polysCount !== undefined) currentData.polysCount = data.polysCount;
    if (data.circlesCount !== undefined) currentData.circlesCount = data.circlesCount;
    if (data.textsCount !== undefined) currentData.textsCount = data.textsCount;
    if (data.version !== undefined) currentData.version = data.version;
    
    updateDisplay();
}

// Step 6) Handle coordinates update event (throttled by emitter)
function handleCoordsUpdate(data) {
    if (!data) return;
    
    if (data.mouse2D) {
        currentData.mouse2D.x = data.mouse2D.x;
        currentData.mouse2D.y = data.mouse2D.y;
    }
    if (data.scale !== undefined) {
        currentData.scale = data.scale;
    }
    if (data.world3D) {
        currentData.world3D.x = data.world3D.x;
        currentData.world3D.y = data.world3D.y;
        currentData.world3D.z = data.world3D.z;
    }
    // Update snap status
    currentData.snapped = data.snapped || false;
    
    updateDisplay();
}

// Step 7) Handle ruler update event
function handleRulerUpdate(data) {
    if (!data) {
        currentData.ruler.l1 = null;
        currentData.ruler.l2 = null;
    } else {
        currentData.ruler.l1 = data.l1;
        currentData.ruler.l2 = data.l2;
    }
    updateDisplay();
}

// Step 8) Handle protractor update event
function handleProtractorUpdate(data) {
    if (!data) {
        currentData.protractor.p1p2 = null;
        currentData.protractor.p2p3 = null;
        currentData.protractor.inner = null;
        currentData.protractor.outer = null;
    } else {
        currentData.protractor.p1p2 = data.p1p2;
        currentData.protractor.p2p3 = data.p2p3;
        currentData.protractor.inner = data.inner;
        currentData.protractor.outer = data.outer;
    }
    updateDisplay();
}

// Step 9) Initialize the stats panel
export function initStatsPanel(element) {
    panelElement = element;
    
    if (!panelElement) {
        console.error("[StatsPanel] No element provided");
        return;
    }
    
    // Step 9a) Subscribe to events
    OverlayEventBus.on(OverlayEvents.STATS, handleStatsUpdate);
    OverlayEventBus.on(OverlayEvents.COORDINATES, handleCoordsUpdate);
    OverlayEventBus.on(OverlayEvents.RULER, handleRulerUpdate);
    OverlayEventBus.on(OverlayEvents.PROTRACTOR, handleProtractorUpdate);
    
    // Step 9b) Initial display
    updateDisplay();
    
    console.log("[StatsPanel] Initialized");
}

// Step 10) Destroy the stats panel
export function destroyStatsPanel() {
    OverlayEventBus.off(OverlayEvents.STATS, handleStatsUpdate);
    OverlayEventBus.off(OverlayEvents.COORDINATES, handleCoordsUpdate);
    OverlayEventBus.off(OverlayEvents.RULER, handleRulerUpdate);
    OverlayEventBus.off(OverlayEvents.PROTRACTOR, handleProtractorUpdate);
    panelElement = null;
}

// Step 11) Convenience function to emit stats
export function emitStats(data) {
    OverlayEventBus.emit(OverlayEvents.STATS, data);
}

// Step 12) Convenience function to emit coordinates (throttled)
export function emitCoords(mouse2D, world3D, scale, snapped) {
    OverlayEventBus.emitThrottled(OverlayEvents.COORDINATES, {
        mouse2D: mouse2D,
        world3D: world3D,
        scale: scale,
        snapped: snapped || false
    }, 16); // 60fps throttle
}

// Step 13) Convenience function to emit ruler measurements
export function emitRuler(l1, l2) {
    OverlayEventBus.emit(OverlayEvents.RULER, { l1: l1, l2: l2 });
}

// Step 14) Convenience function to emit protractor measurements
export function emitProtractor(p1p2, p2p3, inner, outer) {
    OverlayEventBus.emit(OverlayEvents.PROTRACTOR, {
        p1p2: p1p2,
        p2p3: p2p3,
        inner: inner,
        outer: outer
    });
}

// Step 15) Clear ruler/protractor
export function clearMeasurements() {
    OverlayEventBus.emit(OverlayEvents.RULER, null);
    OverlayEventBus.emit(OverlayEvents.PROTRACTOR, null);
}

