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
    hideSlopeLegend,
    hideReliefLegend,
    hideVoronoiLegend,
    hideLegend,
    LegendTypes
} from "./panels/LegendPanel.js";

// Step 5) Surface legend panel exports
export {
    showSurfaceLegend,
    hideSurfaceLegend,
    updateSurface,
    removeSurface
} from "./panels/SurfaceLegendPanel.js";
