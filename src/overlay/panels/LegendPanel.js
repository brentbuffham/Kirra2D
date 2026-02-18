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
    voronoi: null,
    surfaces: [], // Step 1a) Changed from single object to array for multiple surfaces
    shaderAnalytics: null // Step 1b) Shader analytics legend
};

// Step 2) Legend type definitions
var LegendTypes = {
    SLOPE: "slope",
    RELIEF: "relief",
    VORONOI: "voronoi",
    SURFACE: "surface",
    SHADER_ANALYTICS: "shader_analytics"
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
    // SDoB: red (low/flyrock risk) -> orange -> lime (target) -> cyan -> blue (high/safe)
    // Matches getSDoBColor
    if (title.indexOf("SDoB") !== -1) {
        return "rgb(255,0,0) 0%, rgb(255,160,0) 25%, rgb(80,255,0) 50%, rgb(0,200,255) 75%, rgb(0,50,255) 100%";
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

    // Add tick marks for readability
    var min = (minVal !== undefined ? minVal : 0);
    var max = (maxVal !== undefined ? maxVal : 3);

    // Use custom ticks if provided (e.g. log-scale), otherwise generate linear ticks
    var ticks;
    if (colorStops && colorStops.tickValues) {
        ticks = colorStops.tickValues;
    } else {
        var range = max - min;
        ticks = [
            { value: min, pos: 0 },
            { value: min + range * 0.25, pos: 0.25 },
            { value: min + range * 0.5, pos: 0.5 },
            { value: min + range * 0.75, pos: 0.75 },
            { value: max, pos: 1.0 }
        ];
    }

    for (var i = 0; i < ticks.length; i++) {
        var tick = ticks[i];
        var tickPos = tick.pos * 100;
        var label = tick.label !== undefined ? tick.label : tick.value.toFixed(1);
        html += "<span class='hud-legend-label' style='position: absolute; top: " + tickPos + "%;";
        html += "transform: translateY(-50%); font-size: 11px;'>" + label + "</span>";
    }

    html += "</div>";
    html += "</div>";
    html += "</div>";
    return html;
}

// Step 4d) Surface gradient presets - MUST match actual color functions in kirra.js
var surfaceGradients = {
    // Default (Spectrum): Blue -> Cyan -> Green -> Yellow -> Red (matches elevationToColor default case)
    "default": "rgb(0,0,255) 0%, rgb(0,255,255) 25%, rgb(0,255,0) 50%, rgb(255,255,0) 75%, rgb(255,0,0) 100%",
    // Viridis: Dark purple -> Blue-purple -> Teal -> Green -> Yellow (matches getViridisColor)
    "viridis": "rgb(68,1,84) 0%, rgb(59,82,139) 25%, rgb(33,144,140) 50%, rgb(92,200,99) 75%, rgb(253,231,37) 100%",
    // Turbo: Dark purple -> Blue -> Green -> Yellow -> Red (matches getTurboColor)
    "turbo": "rgb(48,18,59) 0%, rgb(50,136,189) 25%, rgb(94,201,98) 50%, rgb(253,231,37) 75%, rgb(240,21,22) 100%",
    // Parula: Dark blue -> Blue -> Light blue -> Cyan -> Teal -> Green -> Yellow-green -> Yellow (matches getParulaColor)
    "parula": "rgb(53,42,135) 0%, rgb(15,92,221) 15%, rgb(18,125,216) 30%, rgb(7,156,207) 45%, rgb(21,177,180) 55%, rgb(89,189,140) 70%, rgb(170,194,97) 85%, rgb(249,251,14) 100%",
    // Cividis: Dark blue -> Purple-blue -> Gray -> Yellow-brown -> Yellow (matches getCividisColor)
    "cividis": "rgb(0,34,78) 0%, rgb(61,67,107) 25%, rgb(122,122,122) 50%, rgb(188,175,111) 75%, rgb(255,234,70) 100%",
    // Terrain: Dark green -> Green -> Pale green -> Brown -> Gray -> White (matches getTerrainColor)
    "terrain": "rgb(0,68,27) 0%, rgb(65,174,118) 25%, rgb(186,228,179) 40%, rgb(120,85,45) 55%, rgb(160,118,74) 70%, rgb(200,200,200) 85%, rgb(255,255,255) 100%",
    // Hillshade: Not used for gradient (uses solid color swatch instead)
    "hillshade": null
};

// Step 4d-2) Display names for gradients
var gradientDisplayNames = {
    "default": "Spectrum",
    "viridis": "Viridis",
    "turbo": "Turbo",
    "parula": "Parula",
    "cividis": "Cividis",
    "terrain": "Terrain",
    "hillshade": "Hillshade"
};

// Step 4e) Build single surface legend entry HTML (compact format)
function buildSingleSurfaceLegendHTML(surface) {
    // Step 4e-1) Get gradient name and CSS
    var gradientName = surface.gradient || "default";
    var gradientCSS = surfaceGradients[gradientName] || surfaceGradients["default"];
    var displayName = gradientDisplayNames[gradientName] || gradientName;
    
    // Step 4e-2) Check if this is hillshade - show solid color swatch instead of gradient
    var isHillshade = (gradientName === "hillshade");
    var hillshadeColor = surface.hillshadeColor || "#808080"; // Default grey
    
    // Step 4e-3) Build compact legend entry
    var html = "<div class='hud-legend-surface-entry'>";
    html += "<div class='hud-legend-surface-name'>" + (surface.name || "Surface") + "</div>";
    html += "<div class='hud-legend-gradient-container hud-legend-compact'>";
    
    if (isHillshade) {
        // Step 4e-4) Hillshade: show solid color swatch
        html += "<div class='hud-legend-color-swatch' style='background-color: " + hillshadeColor + ";'></div>";
    } else {
        // Step 4e-5) Regular gradient bar
        html += "<div class='hud-legend-gradient' style='background: linear-gradient(to top, " + gradientCSS + ");'></div>";
    }
    
    // Step 4e-5a) Use display values (custom limits) if available, otherwise fall back to actual values
    var legendMinZ = surface.displayMinZ !== undefined ? surface.displayMinZ : (surface.actualMinZ !== undefined ? surface.actualMinZ : surface.minZ);
    var legendMaxZ = surface.displayMaxZ !== undefined ? surface.displayMaxZ : (surface.actualMaxZ !== undefined ? surface.actualMaxZ : surface.maxZ);
    
    html += "<div class='hud-legend-gradient-labels'>";
    html += "<span class='hud-legend-label'>" + (legendMaxZ !== undefined ? legendMaxZ.toFixed(1) + "m" : "---") + "</span>";
    if (!isHillshade) {
        // Step 4e-6) Show middle value for gradients
        var midZ = (legendMinZ !== undefined && legendMaxZ !== undefined) ? ((legendMinZ + legendMaxZ) / 2) : undefined;
        html += "<span class='hud-legend-label hud-legend-label-mid'>" + (midZ !== undefined ? midZ.toFixed(1) + "m" : "-") + "</span>";
        // Step 4e-7) Show min label for gradients
        html += "<span class='hud-legend-label'>" + (legendMinZ !== undefined ? legendMinZ.toFixed(1) + "m" : "---") + "</span>";
    }
    html += "</div>";
    html += "</div>";
    html += "<div class='hud-legend-gradient-name'>" + displayName + "</div>";
    html += "</div>";
    
    return html;
}

// Step 4e-7) Build multiple surfaces legend HTML (stacked)
function buildSurfacesLegendHTML(surfaces) {
    if (!surfaces || surfaces.length === 0) return "";
    
    var html = "<div class='hud-legend-section hud-legend-surfaces'>";
    html += "<div class='hud-legend-title'>Elevation</div>";
    html += "<div class='hud-legend-surfaces-container'>";
    
    // Step 4e-8) Build compact entry for each surface
    for (var i = 0; i < surfaces.length; i++) {
        html += buildSingleSurfaceLegendHTML(surfaces[i]);
    }
    
    html += "</div>";
    html += "</div>";
    return html;
}

// Step 5) Update legend display
function updateDisplay() {
    if (!panelElement) return;
    
    var html = "";
    var hasAnyLegend = false;
    
    // Step 5a) Slope legend
    if (activeLegends.slope) {
        var slopeItems = activeLegends.slope.items || defaultSlopeLegend;
        html += buildDiscreteLegendHTML("Legend Slope (°)", slopeItems);
        hasAnyLegend = true;
    }
    
    // Step 5b) Relief legend
    if (activeLegends.relief) {
        var reliefItems = activeLegends.relief.items || defaultReliefLegend;
        html += buildDiscreteLegendHTML("Legend Relief (ms/m)", reliefItems);
        hasAnyLegend = true;
    }
    
    // Step 5c) Voronoi legend
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
    
    // Step 5d) Surface elevation legends (multiple surfaces stacked)
    if (activeLegends.surfaces && activeLegends.surfaces.length > 0) {
        html += buildSurfacesLegendHTML(activeLegends.surfaces);
        hasAnyLegend = true;
    }

    // Step 5d-2) Shader analytics legend
    if (activeLegends.shaderAnalytics) {
        var shaderData = activeLegends.shaderAnalytics;
        html += buildGradientLegendHTML(
            shaderData.title || "Blast Analysis",
            shaderData.minVal,
            shaderData.maxVal,
            shaderData.colorStops
        );
        hasAnyLegend = true;
    }

    // Step 5e) Update panel visibility
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
        // Step 6a) Clear all legends
        activeLegends.slope = null;
        activeLegends.relief = null;
        activeLegends.voronoi = null;
        activeLegends.surfaces = [];
        updateDisplay();
        return;
    }
    
    var type = data.type;
    
    if (data.visible === false) {
        // Step 6b) Hide specific legend
        if (type === LegendTypes.SLOPE) activeLegends.slope = null;
        else if (type === LegendTypes.RELIEF) activeLegends.relief = null;
        else if (type === LegendTypes.VORONOI) activeLegends.voronoi = null;
        else if (type === LegendTypes.SURFACE) activeLegends.surfaces = [];
        else if (type === LegendTypes.SHADER_ANALYTICS) activeLegends.shaderAnalytics = null;
    } else {
        // Step 6c) Show specific legend
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
        } else if (type === LegendTypes.SURFACE) {
            // Step 6d) Handle surfaces as array (multiple surfaces support)
            if (data.surfaces && Array.isArray(data.surfaces)) {
                // New format: array of surface objects
                activeLegends.surfaces = data.surfaces;
            } else {
                // Legacy single surface format - convert to array
                activeLegends.surfaces = [{
                    name: data.name || "Surface",
                    minZ: data.minZ,
                    maxZ: data.maxZ,
                    gradient: data.gradient || "viridis",
                    hillshadeColor: data.hillshadeColor || null
                }];
            }
        } else if (type === LegendTypes.SHADER_ANALYTICS) {
            // Step 6e) Shader analytics legend
            activeLegends.shaderAnalytics = {
                title: data.title || "Blast Analysis",
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
        items: items || defaultSlopeLegend
    });
}

export function showReliefLegend(items) {
    OverlayEventBus.emit(OverlayEvents.LEGEND, {
        visible: true,
        type: LegendTypes.RELIEF,
        items: items || defaultReliefLegend
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

// Step 9d) Show surface legend - supports both single surface (legacy) and multiple surfaces
export function showSurfaceLegend(nameOrSurfaces, minZ, maxZ, gradient, hillshadeColor) {
    // Step 9d-1) Check if first param is an array of surfaces (new format)
    if (Array.isArray(nameOrSurfaces)) {
        OverlayEventBus.emit(OverlayEvents.LEGEND, {
            visible: true,
            type: LegendTypes.SURFACE,
            surfaces: nameOrSurfaces
        });
    } else {
        // Step 9d-2) Legacy single surface format
        OverlayEventBus.emit(OverlayEvents.LEGEND, {
            visible: true,
            type: LegendTypes.SURFACE,
            surfaces: [{
                name: nameOrSurfaces,
                minZ: minZ,
                maxZ: maxZ,
                gradient: gradient,
                hillshadeColor: hillshadeColor || null
            }]
        });
    }
}

// Step 9e) Show multiple surfaces legend
export function showSurfacesLegend(surfaces) {
    OverlayEventBus.emit(OverlayEvents.LEGEND, {
        visible: true,
        type: LegendTypes.SURFACE,
        surfaces: surfaces
    });
}

export function hideSurfaceLegend() {
    OverlayEventBus.emit(OverlayEvents.LEGEND, { visible: false, type: LegendTypes.SURFACE });
}

// Step 9f) Show shader analytics legend
export function showShaderAnalyticsLegend(title, minVal, maxVal, colorStops) {
    OverlayEventBus.emit(OverlayEvents.LEGEND, {
        visible: true,
        type: LegendTypes.SHADER_ANALYTICS,
        title: title,
        minVal: minVal,
        maxVal: maxVal,
        colorStops: colorStops
    });
}

export function hideShaderAnalyticsLegend() {
    OverlayEventBus.emit(OverlayEvents.LEGEND, { visible: false, type: LegendTypes.SHADER_ANALYTICS });
}

export function hideLegend() {
    OverlayEventBus.emit(OverlayEvents.LEGEND, null);
}

// Step 10) Export legend types
export { LegendTypes };

// Step 11) Get active legends for printing
// Returns copy of current legend state for use in print system
export function getActiveLegends() {
    return {
        slope: activeLegends.slope ? { items: activeLegends.slope.items || null } : null,
        relief: activeLegends.relief ? { items: activeLegends.relief.items || null } : null,
        voronoi: activeLegends.voronoi ? {
            title: activeLegends.voronoi.title,
            minVal: activeLegends.voronoi.minVal,
            maxVal: activeLegends.voronoi.maxVal,
            colorStops: activeLegends.voronoi.colorStops
        } : null,
        surfaces: activeLegends.surfaces ? activeLegends.surfaces.slice() : []
    };
}
