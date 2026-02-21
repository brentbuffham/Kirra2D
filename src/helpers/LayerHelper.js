/**
 * LayerHelper.js
 *
 * Centralized layer management utilities for surfaces and drawings.
 * Replaces duplicated getOrCreateSurfaceLayer in SolidCSGHelper,
 * SurfaceBooleanHelper, and ExtrudeKADHelper.
 */

/**
 * Get or create a named surface layer in allSurfaceLayers.
 * @param {string} layerName - Name of the layer
 * @returns {string|null} layerId
 */
export function getOrCreateSurfaceLayer(layerName) {
	if (!window.allSurfaceLayers) return null;

	for (var [layerId, layer] of window.allSurfaceLayers) {
		if (layer.layerName === layerName) return layerId;
	}

	var newLayerId = "slayer_" + Math.random().toString(36).substring(2, 6);
	window.allSurfaceLayers.set(newLayerId, {
		layerId: newLayerId,
		layerName: layerName,
		visible: true,
		sourceFile: null,
		importDate: new Date().toISOString(),
		entities: new Set()
	});

	if (typeof window.debouncedSaveLayers === "function") window.debouncedSaveLayers();
	return newLayerId;
}

/**
 * Get or create a named drawing layer in allDrawingLayers.
 * @param {string} layerName - Name of the layer
 * @returns {string|null} layerId
 */
export function getOrCreateDrawingLayer(layerName) {
	if (!window.allDrawingLayers) return null;

	for (var [layerId, layer] of window.allDrawingLayers) {
		if (layer.layerName === layerName) return layerId;
	}

	var newLayerId = "dlayer_" + Math.random().toString(36).substring(2, 6);
	window.allDrawingLayers.set(newLayerId, {
		layerId: newLayerId,
		layerName: layerName,
		visible: true,
		sourceFile: null,
		importDate: new Date().toISOString(),
		entities: new Set()
	});

	if (typeof window.debouncedSaveLayers === "function") window.debouncedSaveLayers();
	return newLayerId;
}
