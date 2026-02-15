// src/helpers/BlastAnalysisShaderHelper.js
import {
	drawBlastAnalyticsThreeJS,
	clearBlastAnalyticsThreeJS,
	getAvailableAnalyticsModels,
	getShaderMaterialForModel
} from "../draw/canvas3DDrawing.js";

import {
	showShaderAnalyticsLegend,
	hideShaderAnalyticsLegend
} from "../overlay/index.js";

import { ShaderTextureBaker } from "./ShaderTextureBaker.js";

/**
 * BlastAnalysisShaderHelper manages the blast analysis shader overlay.
 *
 * Provides high-level functions to apply, update, and clear shader analytics
 * based on user selections from the dialog.
 */

/**
 * Apply blast analysis shader based on dialog configuration.
 *
 * @param {Object} config - { model, surfaceId, blastName, applyMode, params }
 */
export function applyBlastAnalysisShader(config) {
	if (!config || !config.model) {
		console.error("BlastAnalysisShaderHelper: Invalid config");
		return;
	}

	// Filter blast holes by selected entity
	var holes = getBlastHolesByEntity(config.blastName);

	if (!holes || holes.length === 0) {
		console.warn("BlastAnalysisShaderHelper: No holes found for blast: " + config.blastName);
		return;
	}

	// Handle duplicate mode
	if (config.applyMode === "duplicate" && config.surfaceId !== "__PLANE__") {
		duplicateSurfaceWithShader(config, holes);
		return;
	}

	// Clear any existing analytics
	clearBlastAnalyticsThreeJS();

	// Check if texture baking is requested
	if (config.applyAsTexture && config.surfaceId !== "__PLANE__") {
		// Texture baking mode
		bakeShaderToSurfaceTexture(config, holes);
	} else {
		// Normal overlay mode
		drawBlastAnalyticsThreeJS(config.model, holes, config.params, {
			useToeLocation: false,
			surfaceId: config.surfaceId,
			planePadding: config.planePadding,
			applyAsTexture: false
		});
	}

	// Show legend for the shader analysis
	var legendInfo = getShaderLegendInfo(config.model);
	showShaderAnalyticsLegend(
		legendInfo.title,
		legendInfo.minVal,
		legendInfo.maxVal,
		legendInfo.colorStops
	);

	console.log("✅ Blast analysis shader applied: " + config.model + " on " + holes.length + " holes");
}

/**
 * Bake shader to a persistent texture on the surface.
 *
 * @param {Object} config - Shader configuration
 * @param {Array} holes - Filtered blast holes
 */
function bakeShaderToSurfaceTexture(config, holes) {
	if (!window.loadedSurfaces || !window.loadedSurfaces.has(config.surfaceId)) {
		console.error("Surface not found for texture baking: " + config.surfaceId);
		return;
	}

	var surface = window.loadedSurfaces.get(config.surfaceId);

	if (!surface.triangles || surface.triangles.length === 0) {
		console.error("Surface has no triangles for texture baking: " + config.surfaceId);
		return;
	}

	console.log("🎨 Baking shader to texture for surface: " + config.surfaceId);

	// Get shader material configured for this model
	var shaderMaterial = getShaderMaterialForModel(config.model, holes, config.params);

	if (!shaderMaterial) {
		console.error("Failed to create shader material for baking");
		return;
	}

	// Bake shader to texture
	var bakeResult = ShaderTextureBaker.bakeShaderToTexture(surface, shaderMaterial, {
		resolution: 2048,
		padding: config.planePadding || 10
	});

	// Store baked texture data on surface
	surface.analysisTexture = bakeResult.texture;
	surface.analysisCanvas = bakeResult.canvas;
	surface.analysisUVBounds = bakeResult.uvBounds;
	surface.analysisModel = config.model; // Remember which model was baked

	// Update surface gradient to "analysis" to trigger texture rendering
	surface.gradient = "analysis";

	// Apply baked texture to 3D mesh
	if (window.threeRenderer && window.threeRenderer.surfaceMeshMap) {
		var surfaceMesh = window.threeRenderer.surfaceMeshMap.get(config.surfaceId);
		if (surfaceMesh) {
			ShaderTextureBaker.applyBakedTextureToMesh(
				surfaceMesh,
				bakeResult.texture,
				surface,
				bakeResult.uvBounds
			);
		}
	}

	// Save surface with baked texture to IndexedDB
	if (window.saveSurfaceToDB) {
		// Note: Canvas will be recreated from stored data on reload
		window.saveSurfaceToDB(config.surfaceId);
	}

	// Invalidate 2D cache to trigger re-render with new texture
	if (window.invalidateSurfaceCache) {
		window.invalidateSurfaceCache(config.surfaceId);
	}

	// Redraw to show baked texture
	if (window.drawData) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}

	console.log("✅ Shader baked to texture: " + config.model);
}

/**
 * Duplicate a surface and apply shader to the duplicate.
 *
 * @param {Object} config - Shader configuration
 * @param {Array} holes - Filtered blast holes
 */
function duplicateSurfaceWithShader(config, holes) {
	if (!window.loadedSurfaces || !window.loadedSurfaces.has(config.surfaceId)) {
		console.error("Surface not found: " + config.surfaceId);
		return;
	}

	var originalSurface = window.loadedSurfaces.get(config.surfaceId);

	// Create duplicate surface ID
	var duplicateId = config.surfaceId + "_" + config.model + "_analysis";
	var duplicateName = (originalSurface.name || config.surfaceId) + " (" + config.model + ")";

	// Clone surface data with normalized triangle format
	var duplicateSurface = {
		id: duplicateId,
		name: duplicateName,
		type: originalSurface.type || "triangulated",
		points: JSON.parse(JSON.stringify(originalSurface.points)), // Deep copy
		triangles: JSON.parse(JSON.stringify(originalSurface.triangles)), // Deep copy
		visible: true,
		gradient: "shader_overlay", // Special marker
		transparency: 0.7,
		layerId: originalSurface.layerId,
		metadata: {
			isShaderDuplicate: true,
			originalSurfaceId: config.surfaceId,
			shaderModel: config.model,
			createdAt: new Date().toISOString()
		}
	};

	// Add to loaded surfaces
	window.loadedSurfaces.set(duplicateId, duplicateSurface);

	// Store reference to duplicate for cleanup
	if (!window.shaderDuplicateSurfaces) {
		window.shaderDuplicateSurfaces = new Set();
	}
	window.shaderDuplicateSurfaces.add(duplicateId);

	// Clear existing analytics
	clearBlastAnalyticsThreeJS();

	// Check if texture baking is requested for duplicate
	if (config.applyAsTexture) {
		// Bake shader to texture on duplicate surface
		console.log("🎨 Baking shader to texture for duplicate surface: " + duplicateId);

		var shaderMaterial = getShaderMaterialForModel(config.model, holes, config.params);
		if (shaderMaterial) {
			var bakeResult = ShaderTextureBaker.bakeShaderToTexture(duplicateSurface, shaderMaterial, {
				resolution: 2048,
				padding: config.planePadding || 10
			});

			// Store baked texture data
			duplicateSurface.analysisTexture = bakeResult.texture;
			duplicateSurface.analysisCanvas = bakeResult.canvas;
			duplicateSurface.analysisUVBounds = bakeResult.uvBounds;
			duplicateSurface.analysisModel = config.model;
			duplicateSurface.gradient = "analysis";

			console.log("✅ Shader baked to duplicate surface texture");
		}
	} else {
		// Apply shader to duplicate (overlay mode)
		drawBlastAnalyticsThreeJS(config.model, holes, config.params, {
			useToeLocation: false,
			surfaceId: duplicateId
		});
	}

	// Save duplicate to IndexedDB (pass surface ID, not object)
	if (window.saveSurfaceToDB) {
		window.saveSurfaceToDB(duplicateId);
	}

	console.log("✅ Shader applied to duplicate surface: " + duplicateId);

	// Redraw to show new surface
	if (window.drawData) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}
}

/**
 * Get legend information for a shader model.
 *
 * @param {string} modelName - Model name
 * @returns {Object} - { title, minVal, maxVal, colorStops }
 */
function getShaderLegendInfo(modelName) {
	var modelInfo = {
		ppv: {
			title: "PPV (mm/s)",
			minVal: 0,
			maxVal: 200,
			colorStops: [
				{ pos: 0, color: "rgb(0, 204, 0)" },        // Green
				{ pos: 0.25, color: "rgb(128, 255, 0)" },   // Yellow-green
				{ pos: 0.5, color: "rgb(255, 255, 0)" },    // Yellow
				{ pos: 0.75, color: "rgb(255, 153, 0)" },   // Orange
				{ pos: 1, color: "rgb(255, 0, 0)" }         // Red
			]
		},
		heelan_original: {
			title: "PPV (mm/s)",
			minVal: 0,
			maxVal: 500,
			colorStops: [
				{ pos: 0, color: "rgb(0, 204, 0)" },
				{ pos: 0.25, color: "rgb(128, 255, 0)" },
				{ pos: 0.5, color: "rgb(255, 255, 0)" },
				{ pos: 0.75, color: "rgb(255, 153, 0)" },
				{ pos: 1, color: "rgb(255, 0, 0)" }
			]
		},
		scaled_heelan: {
			title: "PPV (mm/s)",
			minVal: 0,
			maxVal: 200,
			colorStops: [
				{ pos: 0, color: "rgb(0, 204, 0)" },
				{ pos: 0.25, color: "rgb(128, 255, 0)" },
				{ pos: 0.5, color: "rgb(255, 255, 0)" },
				{ pos: 0.75, color: "rgb(255, 153, 0)" },
				{ pos: 1, color: "rgb(255, 0, 0)" }
			]
		},
		nonlinear_damage: {
			title: "Damage Index",
			minVal: 0,
			maxVal: 1,
			colorStops: [
				{ pos: 0, color: "rgb(0, 0, 255)" },        // Blue - no damage
				{ pos: 0.25, color: "rgb(0, 255, 0)" },     // Green - cosmetic
				{ pos: 0.5, color: "rgb(255, 255, 0)" },    // Yellow - minor
				{ pos: 0.75, color: "rgb(255, 0, 0)" },     // Red - major
				{ pos: 1, color: "rgb(76, 0, 0)" }          // Dark red - crushing
			]
		}
	};

	return modelInfo[modelName] || modelInfo.ppv;
}

/**
 * Clear blast analysis shader overlay.
 */
export function clearBlastAnalysisShader() {
	// Restore original surface visibility if shader was applied to a surface
	if (window.blastAnalyticsSettings && window.blastAnalyticsSettings.surfaceId && window.blastAnalyticsSettings.surfaceId !== "__PLANE__") {
		var surfaceId = window.blastAnalyticsSettings.surfaceId;

		// Restore Three.js mesh visibility
		if (window.threeRenderer && window.threeRenderer.surfaceMeshMap) {
			var originalMesh = window.threeRenderer.surfaceMeshMap.get(surfaceId);
			if (originalMesh) {
				originalMesh.visible = true;
				console.log("Restored visibility for surface: " + surfaceId);
			}
		}

		// Restore surface data visibility
		if (window.loadedSurfaces && window.loadedSurfaces.has(surfaceId)) {
			var surfaceData = window.loadedSurfaces.get(surfaceId);
			if (surfaceData._originalVisibility !== undefined) {
				surfaceData.visible = surfaceData._originalVisibility;
				delete surfaceData._originalVisibility;
			} else {
				surfaceData.visible = true;  // Default to visible
			}
		}

		// Redraw to show restored surface
		if (window.drawData) {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}
	}

	clearBlastAnalyticsThreeJS();
	hideShaderAnalyticsLegend();
	console.log("🗑️ Blast analysis shader cleared");
}

/**
 * Revert shader on a specific surface (restore original).
 * Removes shader duplicate surface if it exists.
 *
 * @param {string} surfaceId - Surface ID to revert
 */
export function revertShaderOnSurface(surfaceId) {
	// Check if this is a shader duplicate
	if (window.shaderDuplicateSurfaces && window.shaderDuplicateSurfaces.has(surfaceId)) {
		// Remove duplicate surface
		if (window.loadedSurfaces && window.loadedSurfaces.has(surfaceId)) {
			var surface = window.loadedSurfaces.get(surfaceId);

			// Remove from Three.js scene
			if (window.threeRenderer && window.threeRenderer.surfaceMeshMap) {
				var mesh = window.threeRenderer.surfaceMeshMap.get(surfaceId);
				if (mesh) {
					if (mesh.parent) mesh.parent.remove(mesh);
					if (mesh.geometry) mesh.geometry.dispose();
					if (mesh.material) mesh.material.dispose();
					window.threeRenderer.surfaceMeshMap.delete(surfaceId);
				}
			}

			// Remove from loaded surfaces
			window.loadedSurfaces.delete(surfaceId);
			window.shaderDuplicateSurfaces.delete(surfaceId);

			// Delete from IndexedDB
			if (window.deleteSurfaceFromDB) {
				window.deleteSurfaceFromDB(surfaceId);
			}

			console.log("🗑️ Reverted shader duplicate: " + surfaceId);
		}
	} else {
		// Original surface - just clear shader overlay
		clearBlastAnalyticsThreeJS();
		console.log("🗑️ Cleared shader from original surface");
	}

	// Redraw
	if (window.drawData) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}
}

/**
 * Get available analytics models for the dialog.
 *
 * @returns {Array} - Array of { name, displayName, unit }
 */
export function getAnalyticsModels() {
	return getAvailableAnalyticsModels();
}

/**
 * Filter blast holes by entity name.
 *
 * @param {string} blastName - Entity name or "__ALL__" for all holes
 * @returns {Array} - Filtered blast holes
 */
function getBlastHolesByEntity(blastName) {
	if (!window.allBlastHoles || window.allBlastHoles.length === 0) {
		return [];
	}

	if (blastName === "__ALL__") {
		return window.allBlastHoles;
	}

	return window.allBlastHoles.filter(function(hole) {
		return hole.entityName === blastName;
	});
}

/**
 * Update shader when holes change (reactive update).
 * Called during drag operations.
 *
 * @param {number} index - Hole index in allBlastHoles
 * @param {Object} hole - Updated hole object
 */
export function updateShaderForHoleChange(index, hole) {
	if (!window.blastAnalyticsSettings || !window.blastAnalyticsSettings.model) {
		return; // No active shader
	}

	// Import and call update function
	import("../draw/canvas3DDrawing.js").then(function(module) {
		if (module.updateBlastAnalyticsSingleHole) {
			module.updateBlastAnalyticsSingleHole(index, hole, {
				useToeLocation: false
			});
		}
	});
}

/**
 * Refresh shader when charging data changes.
 * Requires full repack of hole data.
 */
export function refreshShaderForChargingChange() {
	if (!window.blastAnalyticsSettings) {
		return; // No active shader
	}

	// Re-apply with current settings
	applyBlastAnalysisShader(window.blastAnalyticsSettings);
}

/**
 * Export flattened shader to 2D canvas.
 *
 * @param {number} pixelsPerMetre - Resolution
 * @returns {Object} - { canvas, bounds, width, height } or null
 */
export function exportShaderTo2D(pixelsPerMetre) {
	if (!window.blastAnalyticsSettings || !window.blastAnalyticsSettings.model) {
		return null;
	}

	return import("../draw/canvas3DDrawing.js").then(function(module) {
		if (module.flattenBlastAnalytics) {
			return module.flattenBlastAnalytics(pixelsPerMetre || 2.0);
		}
		return null;
	});
}
