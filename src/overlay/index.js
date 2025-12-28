/* prettier-ignore-file */
//=================================================
// index.js - HUD Overlay system public API
// Single import point for HUD functionality
//=================================================

// Step 1) Core exports
export { OverlayEventBus, OverlayEvents } from "./OverlayEventBus.js";
export { 
    initHUD, 
    clearHUD, 
    destroyHUD, 
    getHUDContainer,
    isHUDInitialized,
    setHUDVisible 
} from "./HUDOverlay.js";

// Step 2) Status panel exports
export { 
    showStatusMessage,
    showSuccessMessage,
    showWarningMessage,
    showErrorMessage,
    showSelectionMessage,
    showTooltip,
    clearStatus
} from "./panels/StatusPanel.js";

// Step 3) Stats panel exports
export { 
    emitStats,
    emitCoords,
    emitRuler,
    emitProtractor,
    clearMeasurements
} from "./panels/StatsPanel.js";

// Step 4) Legend panel exports
export {
    showSlopeLegend,
    showReliefLegend,
    showVoronoiLegend,
    showSurfaceLegend,
    showSurfacesLegend, // Step 4a) New export for multiple surfaces
    hideSlopeLegend,
    hideReliefLegend,
    hideVoronoiLegend,
    hideSurfaceLegend,
    hideLegend,
    LegendTypes
} from "./panels/LegendPanel.js";

// Step 5) Surface legend panel - additional exports (main show/hide from LegendPanel)
export {
    updateSurface,
    removeSurface
} from "./panels/SurfaceLegendPanel.js";

// Step 6) Ruler panel exports
export {
    showRulerPanel,
    hideRulerPanel,
    emitRulerMeasurement
} from "./panels/RulerPanel.js";

// Step 6b) Protractor panel exports
export {
    showProtractorPanel,
    hideProtractorPanel,
    emitProtractorMeasurement
} from "./panels/ProtractorPanel.js";

// Step 6c) Drawing distance panel exports
export {
    showDrawingDistance,
    hideDrawingDistance,
    emitDrawingDistance
} from "./panels/DrawingDistancePanel.js";

// Step 7) Tooltip panel exports
export {
    showHoleTooltip,
    showPointTooltip,
    showCustomTooltip,
    hideTooltipPanel,
    emitTooltip
} from "./panels/TooltipPanel.js";
