/* prettier-ignore-file */
//=================================================
// LegendPanel.js - Left side legend display
// Shows: Slope legend, Relief legend, Voronoi legend
// Stacked vertically, each can be shown/hidden independently
//=================================================

import { OverlayEventBus, OverlayEvents } from "../OverlayEventBus.js";

// Step 1) Module state
var panelElement = null;
var activeLegends = {
    slope: null,
    relief: null,
    voronoi: null
};

// Step 2) Legend type definitions
var LegendTypes = {
    SLOPE: "slope",
    RELIEF: "relief",
    VORONOI: "voronoi"
};

// Step 3) Default slope legend colors (match existing drawLegend)
// DeepRed>Red>Orange>Yellow>Green>DarkCyan>SkyBlue>Blue
var defaultSlopeLegend = [
    { label: "0°-5°", color: "rgb(51, 139, 255)" },
    { label: "5°-7°", color: "rgb(0, 102, 204)" },
    { label: "7°-9°", color: "rgb(0, 204, 204)" },
    { label: "9°-12°", color: "rgb(102, 204, 0)" },
    { label: "12°-15°", color: "rgb(204, 204, 0)" },
    { label: "15°-17°", color: "rgb(255, 128, 0)" },
    { label: "17°-20°", color: "rgb(255, 0, 0)" },
    { label: "20°+", color: "rgb(153, 0, 76)" }
];

// Step 3b) Default relief legend - ms/m (milliseconds per meter)
// From reference: DeepRed(fast)->Red->Orange->Yellow->Green->Cyan->SkyBlue->Blue->Navy->Purple(slow)
var defaultReliefLegend = [
    { label: "0-4", color: "rgb(75, 20, 20)" },       // DeepRed - fast
    { label: "4-7", color: "rgb(255, 40, 40)" },      // Red
    { label: "7-10", color: "rgb(255, 120, 50)" },    // Orange
    { label: "10-13", color: "rgb(255, 255, 50)" },   // Yellow
    { label: "13-16", color: "rgb(50, 255, 70)" },    // Green
    { label: "16-19", color: "rgb(50, 255, 200)" },   // Cyan/Teal
    { label: "19-22", color: "rgb(50, 230, 255)" },   // SkyBlue
    { label: "22-25", color: "rgb(50, 180, 255)" },   // Blue
    { label: "25-30", color: "rgb(50, 100, 255)" },   // Blue
    { label: "30-40", color: "rgb(0, 0, 180)" },      // Navy (actual dark blue)
    { label: "40+", color: "rgb(75, 0, 150)" }        // Purple - slow
];

// Step 4) Build discrete legend HTML (Slope/Relief)
function buildDiscreteLegendHTML(title, items) {
    var html = "<div class='hud-legend-section'>";
    html += "<div class='hud-legend-title'>" + title + "</div>";
    
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        html += "<div class='hud-legend-item'>";
        html += "<span class='hud-legend-label'>" + item.label + "</span>";
        html += "<span class='hud-legend-color' style='background-color: " + item.color + ";'></span>";
        html += "</div>";
    }
    
    html += "</div>";
    return html;
}

// Step 4b) Get gradient CSS based on metric type (matching kirra.js color functions)
function getGradientForMetric(title) {
    // Hole Firing Time: green (min/early) -> red (max/late)
    // Matches getHoleFiringTimeColor: rgb(50,255,50) -> rgb(255,0,0)
    if (title.indexOf("Firing Time") !== -1) {
        return "rgb(50,255,50) 0%, rgb(150,255,50) 25%, rgb(255,255,50) 50%, rgb(255,128,0) 75%, rgb(255,0,0) 100%";
    }
    // Powder Factor: blue (min) -> cyan -> green -> yellow -> orange -> red (max)
    // Matches getPFColor
    if (title.indexOf("Powder Factor") !== -1) {
        return "rgb(0,0,255) 0%, rgb(0,255,255) 20%, rgb(0,255,0) 40%, rgb(255,255,0) 60%, rgb(255,128,0) 80%, rgb(255,0,0) 100%";
    }
    // Mass, Volume, Area, Length: blue -> cyan -> green -> yellow -> red
    // Matches getMassColor, getVolumeColor, getAreaColor, getLengthColor
    return "rgb(0,0,255) 0%, rgb(0,255,255) 25%, rgb(0,255,0) 50%, rgb(255,255,0) 75%, rgb(255,0,0) 100%";
}

// Step 4c) Build gradient legend HTML (Voronoi)
function buildGradientLegendHTML(title, minVal, maxVal, colorStops) {
    var html = "<div class='hud-legend-section hud-legend-voronoi'>";
    html += "<div class='hud-legend-title'>" + title + "</div>";
    html += "<div class='hud-legend-gradient-container'>";
    
    // Gradient bar - use metric-specific gradient or custom color stops
    var gradientCSS = "linear-gradient(to bottom";
    if (colorStops && colorStops.length > 0) {
        for (var i = 0; i < colorStops.length; i++) {
            gradientCSS += ", " + colorStops[i].color + " " + (colorStops[i].pos * 100) + "%";
        }
    } else {
        // Use metric-specific gradient based on title
        gradientCSS += ", " + getGradientForMetric(title);
    }
    gradientCSS += ")";
    
    html += "<div class='hud-legend-gradient' style='background: " + gradientCSS + ";'></div>";
    html += "<div class='hud-legend-gradient-labels'>";
    html += "<span class='hud-legend-label'>" + (minVal !== undefined ? minVal.toFixed(1) : "0.0") + "</span>";
    html += "<span class='hud-legend-label'>" + (maxVal !== undefined ? maxVal.toFixed(1) : "3.0") + "</span>";
    html += "</div>";
    html += "</div>";
    html += "</div>";
    return html;
}

// Step 5) Update legend display
function updateDisplay() {
    if (!panelElement) return;
    
    var html = "";
    var hasAnyLegend = false;
    
    // Slope legend
    if (activeLegends.slope) {
        var slopeItems = activeLegends.slope.items || defaultSlopeLegend;
        html += buildDiscreteLegendHTML("Legend Slope (°)", slopeItems);
        hasAnyLegend = true;
    }
    
    // Relief legend
    if (activeLegends.relief) {
        var reliefItems = activeLegends.relief.items || defaultReliefLegend;
        html += buildDiscreteLegendHTML("Legend Relief (ms/m)", reliefItems);
        hasAnyLegend = true;
    }
    
    // Voronoi legend
    if (activeLegends.voronoi) {
        var voronoiData = activeLegends.voronoi;
        html += buildGradientLegendHTML(
            voronoiData.title || "Legend Voronoi",
            voronoiData.minVal,
            voronoiData.maxVal,
            voronoiData.colorStops
        );
        hasAnyLegend = true;
    }
    
    if (hasAnyLegend) {
        panelElement.innerHTML = html;
        panelElement.style.display = "block";
    } else {
        panelElement.style.display = "none";
        panelElement.innerHTML = "";
    }
}

// Step 6) Handle legend update event
function handleLegendUpdate(data) {
    if (!data) {
        // Clear all legends
        activeLegends.slope = null;
        activeLegends.relief = null;
        activeLegends.voronoi = null;
        updateDisplay();
        return;
    }
    
    var type = data.type;
    
    if (data.visible === false) {
        // Hide specific legend
        if (type === LegendTypes.SLOPE) activeLegends.slope = null;
        else if (type === LegendTypes.RELIEF) activeLegends.relief = null;
        else if (type === LegendTypes.VORONOI) activeLegends.voronoi = null;
    } else {
        // Show specific legend
        if (type === LegendTypes.SLOPE) {
            activeLegends.slope = { items: data.items };
        } else if (type === LegendTypes.RELIEF) {
            activeLegends.relief = { items: data.items };
        } else if (type === LegendTypes.VORONOI) {
            activeLegends.voronoi = {
                title: data.title || "Legend Voronoi",
                minVal: data.minVal,
                maxVal: data.maxVal,
                colorStops: data.colorStops
            };
        }
    }
    
    updateDisplay();
}

// Step 7) Initialize the legend panel
export function initLegendPanel(element) {
    panelElement = element;
    
    if (!panelElement) {
        console.error("[LegendPanel] No element provided");
        return;
    }
    
    // Step 7a) Initially hidden
    panelElement.style.display = "none";
    
    // Step 7b) Subscribe to legend events
    OverlayEventBus.on(OverlayEvents.LEGEND, handleLegendUpdate);
    
    console.log("[LegendPanel] Initialized");
}

// Step 8) Destroy the legend panel
export function destroyLegendPanel() {
    OverlayEventBus.off(OverlayEvents.LEGEND, handleLegendUpdate);
    panelElement = null;
}

// Step 9) Convenience functions to show/hide legends
export function showSlopeLegend(items) {
    OverlayEventBus.emit(OverlayEvents.LEGEND, {
        visible: true,
        type: LegendTypes.SLOPE,
        items: items
    });
}

export function showReliefLegend(items) {
    OverlayEventBus.emit(OverlayEvents.LEGEND, {
        visible: true,
        type: LegendTypes.RELIEF,
        items: items
    });
}

export function showVoronoiLegend(title, minVal, maxVal, colorStops) {
    OverlayEventBus.emit(OverlayEvents.LEGEND, {
        visible: true,
        type: LegendTypes.VORONOI,
        title: title,
        minVal: minVal,
        maxVal: maxVal,
        colorStops: colorStops
    });
}

export function hideSlopeLegend() {
    OverlayEventBus.emit(OverlayEvents.LEGEND, { visible: false, type: LegendTypes.SLOPE });
}

export function hideReliefLegend() {
    OverlayEventBus.emit(OverlayEvents.LEGEND, { visible: false, type: LegendTypes.RELIEF });
}

export function hideVoronoiLegend() {
    OverlayEventBus.emit(OverlayEvents.LEGEND, { visible: false, type: LegendTypes.VORONOI });
}

export function hideLegend() {
    OverlayEventBus.emit(OverlayEvents.LEGEND, null);
}

// Step 10) Export legend types
export { LegendTypes };
