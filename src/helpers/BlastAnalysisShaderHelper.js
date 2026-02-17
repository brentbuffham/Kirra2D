// src/helpers/BlastAnalysisShaderHelper.js
import * as THREE from "three";
import {
	getAvailableAnalyticsModels,
	getShaderMaterialForModel
} from "../draw/canvas3DDrawing.js";

import {
	showShaderAnalyticsLegend,
	hideShaderAnalyticsLegend
} from "../overlay/index.js";

import { ShaderTextureBaker } from "./ShaderTextureBaker.js";
import { exportAnalysisMeshToGLB } from "./AnalysisTextureRebuilder.js";
import { AddSurfaceAction } from "../tools/UndoActions.js";
import { ColourRampFactory } from "../shaders/core/ColourRampFactory.js";

/**
 * BlastAnalysisShaderHelper manages blast analysis surfaces.
 *
 * Always creates a permanent surface with baked texture, registered via
 * AddSurfaceAction for undo support. Surfaces appear in TreeView and
 * persist to IndexedDB.
 */

/**
 * Model display names for surface naming.
 */
var MODEL_DISPLAY_NAMES = {
	ppv: "PPV",
	heelan_original: "Heelan Original",
	scaled_heelan: "Scaled Heelan",
	nonlinear_damage: "Nonlinear Damage",
	sdob: "SDoB"
};

/**
 * Apply blast analysis shader — creates a permanent surface with baked texture.
 *
 * @param {Object} config - { model, surfaceId, blastName, planePadding, params }
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

	// Build surface geometry (triangles + points)
	var surfaceData = buildAnalysisSurfaceData(config, holes);
	if (!surfaceData) {
		console.error("BlastAnalysisShaderHelper: Failed to build surface geometry");
		return;
	}

	// Get shader material and bake to texture
	var shaderMaterial = getShaderMaterialForModel(config.model, holes, config.params);
	if (!shaderMaterial) {
		console.error("BlastAnalysisShaderHelper: Failed to create shader material");
		return;
	}

	// Calculate resolution from surface extent at 30 px/m, capped at 8192
	var bakeResolution = 2048;
	if (surfaceData.points && surfaceData.points.length > 0) {
		var bx = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
		for (var pi = 0; pi < surfaceData.points.length; pi++) {
			var pt = surfaceData.points[pi];
			if (pt.x < bx.minX) bx.minX = pt.x;
			if (pt.x > bx.maxX) bx.maxX = pt.x;
			if (pt.y < bx.minY) bx.minY = pt.y;
			if (pt.y > bx.maxY) bx.maxY = pt.y;
		}
		var extentMax = Math.max(bx.maxX - bx.minX, bx.maxY - bx.minY);
		var pxPerM = 30;
		bakeResolution = Math.min(Math.max(Math.ceil(extentMax * pxPerM), 2048), 8192);
	}

	var bakeResult = ShaderTextureBaker.bakeShaderToTexture(surfaceData, shaderMaterial, {
		resolution: bakeResolution,
		padding: config.planePadding || 10
	});

	if (!bakeResult || !bakeResult.texture) {
		console.error("BlastAnalysisShaderHelper: Shader bake failed");
		return;
	}

	// Build permanent surface object
	var modelDisplayName = MODEL_DISPLAY_NAMES[config.model] || config.model;
	var uid4 = Math.random().toString(36).slice(2, 6); // 4-char uid for unique display names
	var surfaceId = "Analysis_" + config.model + "_" + Date.now();

	var surface = {
		id: surfaceId,
		name: "Analysis " + modelDisplayName + "_" + uid4,
		type: "triangulated",
		points: surfaceData.points,
		triangles: surfaceData.triangles,
		visible: true,
		gradient: "analysis",
		transparency: 1.0,
		isAnalysisSurface: true,
		analysisModelName: config.model,
		analysisParams: config.params,
		analysisTexture: bakeResult.texture,
		analysisCanvas: bakeResult.canvas,
		analysisUVBounds: bakeResult.uvBounds
	};

	// Add surface to loadedSurfaces directly (keeps non-serializable canvas/texture intact)
	if (window.loadedSurfaces) {
		window.loadedSurfaces.set(surfaceId, surface);
	}

	// Build and register the 3D mesh
	buildAndRegisterAnalysisMesh(surfaceId, surface, bakeResult);

	// Create flattened image for 2D rendering (same pattern as textured OBJs)
	createFlattenedAnalysisImage(surfaceId, surface, bakeResult);

	// Push undo action (without re-executing — surface is already added)
	if (window.undoManager) {
		var action = new AddSurfaceAction(surface);
		window.undoManager.pushAction(action);
	}

	// Update TreeView — do NOT set threeDataNeedsRebuild (that would
	// clearAllGeometry and destroy the analysis mesh we just registered)
	if (window.debouncedUpdateTreeView) {
		window.debouncedUpdateTreeView();
	}
	// Redraw 2D view (the 3D mesh is already in the scene)
	if (window.drawData) {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}
	// Request a 3D render
	if (window.threeRenderer && window.threeRenderer.needsRender !== undefined) {
		window.threeRenderer.needsRender = true;
	}

	// Show legend
	var legendInfo = getShaderLegendInfo(config.model);
	showShaderAnalyticsLegend(
		legendInfo.title,
		legendInfo.minVal,
		legendInfo.maxVal,
		legendInfo.colorStops
	);

	console.log("Blast analysis surface created: " + surfaceId + " (" + config.model + " on " + holes.length + " holes)");
}

/**
 * Build surface geometry data for analysis — either from existing surface or generated plane.
 *
 * @param {Object} config - { surfaceId, planePadding }
 * @param {Array} holes - Blast holes
 * @returns {Object|null} - { points, triangles } or null
 */
function buildAnalysisSurfaceData(config, holes) {
	// If using an existing surface, deep-copy its triangles and points
	if (config.surfaceId && config.surfaceId !== "__PLANE__" && window.loadedSurfaces) {
		var existingSurface = window.loadedSurfaces.get(config.surfaceId);
		if (existingSurface && existingSurface.triangles && existingSurface.triangles.length > 0) {
			return {
				points: JSON.parse(JSON.stringify(existingSurface.points)),
				triangles: JSON.parse(JSON.stringify(existingSurface.triangles))
			};
		}
	}

	// Generate analysis plane from hole bounds
	var bounds = calculateHoleBounds(holes);
	var padding = config.planePadding || 200;
	var planeZ = (window.drawingZLevel !== undefined && isFinite(window.drawingZLevel) && window.drawingZLevel !== 0)
		? window.drawingZLevel
		: calculateAverageCollarZ(holes);

	var minX = bounds.minX - padding;
	var maxX = bounds.maxX + padding;
	var minY = bounds.minY - padding;
	var maxY = bounds.maxY + padding;

	// Two triangles forming a quad (inline vertex format — required by 2D renderer + IndexedDB)
	var p0 = { x: minX, y: minY, z: planeZ };
	var p1 = { x: maxX, y: minY, z: planeZ };
	var p2 = { x: maxX, y: maxY, z: planeZ };
	var p3 = { x: minX, y: maxY, z: planeZ };
	var points = [p0, p1, p2, p3];
	var triangles = [
		{ vertices: [p0, p1, p2] },
		{ vertices: [p0, p2, p3] }
	];

	return { points: points, triangles: triangles };
}

/**
 * Build a textured analysis mesh directly and register it in the scene.
 *
 * @param {string} surfaceId - Surface ID
 * @param {Object} surface - Surface object with triangles/points
 * @param {Object} bakeResult - { texture, canvas, uvBounds }
 */
function buildAndRegisterAnalysisMesh(surfaceId, surface, bakeResult) {
	if (!window.threeRenderer || !surface.triangles || surface.triangles.length === 0) {
		return;
	}

	// Build BufferGeometry directly with positions + UVs (no vertex colors)
	var triCount = surface.triangles.length;
	var positions = new Float32Array(triCount * 9); // 3 verts x 3 coords
	var uvs = new Float32Array(triCount * 6);       // 3 verts x 2 UV coords

	var uvBounds = bakeResult.uvBounds;
	var uvW = uvBounds.maxU - uvBounds.minU;
	var uvH = uvBounds.maxV - uvBounds.minV;

	for (var i = 0; i < triCount; i++) {
		var tri = surface.triangles[i];

		// Resolve triangle vertices — handle multiple formats
		var verts;
		if (tri.a !== undefined && tri.b !== undefined && tri.c !== undefined) {
			verts = [surface.points[tri.a], surface.points[tri.b], surface.points[tri.c]];
		} else if (tri.indices && Array.isArray(tri.indices)) {
			verts = [surface.points[tri.indices[0]], surface.points[tri.indices[1]], surface.points[tri.indices[2]]];
		} else if (tri.vertices && Array.isArray(tri.vertices) && tri.vertices.length === 3) {
			if (typeof tri.vertices[0] === "object") {
				verts = tri.vertices;
			} else {
				verts = [surface.points[tri.vertices[0]], surface.points[tri.vertices[1]], surface.points[tri.vertices[2]]];
			}
		} else {
			continue;
		}

		if (!verts[0] || !verts[1] || !verts[2]) continue;

		for (var j = 0; j < 3; j++) {
			var v = verts[j];
			var local = window.worldToThreeLocal(v.x, v.y);

			// Position in local Three.js space
			positions[i * 9 + j * 3]     = local.x;
			positions[i * 9 + j * 3 + 1] = local.y;
			positions[i * 9 + j * 3 + 2] = v.z;

			// Planar UV from world XY
			uvs[i * 6 + j * 2]     = (v.x - uvBounds.minU) / uvW;
			uvs[i * 6 + j * 2 + 1] = (v.y - uvBounds.minV) / uvH;
		}
	}

	var geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
	geometry.computeVertexNormals();

	// Texture-only material
	var material = new THREE.MeshBasicMaterial({
		map: bakeResult.texture,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: surface.transparency || 1.0
	});

	var mesh = new THREE.Mesh(geometry, material);
	mesh.userData = { type: "surface", surfaceId: surfaceId, isAnalysisSurface: true };

	// Register in scene and surfaceMeshMap
	window.threeRenderer.surfacesGroup.add(mesh);
	window.threeRenderer.surfaceMeshMap.set(surfaceId, mesh);

	// Export to GLB for IndexedDB persistence
	exportAnalysisMeshToGLB(mesh).then(function(glbData) {
		if (glbData) {
			surface.analysisGLB = glbData;
			console.log("GLB export for analysis: " + (glbData.byteLength / 1024).toFixed(1) + " KB");
		}
		if (window.saveSurfaceToDB) {
			window.saveSurfaceToDB(surfaceId);
		}
	}).catch(function(err) {
		console.warn("GLB export failed:", err);
		if (window.saveSurfaceToDB) {
			window.saveSurfaceToDB(surfaceId);
		}
	});

	console.log("Built and registered texture-mapped analysis mesh for " + surfaceId);
}

/**
 * Create a flattened image from the baked analysis canvas and register it
 * in loadedImages for 2D rendering. Also stores data URL on the surface
 * for IndexedDB persistence (same pattern as textured OBJ flattening).
 *
 * @param {string} surfaceId - Surface ID
 * @param {Object} surface - Surface object
 * @param {Object} bakeResult - { texture, canvas, uvBounds }
 */
function createFlattenedAnalysisImage(surfaceId, surface, bakeResult) {
	var texCanvas = bakeResult.canvas;
	var uvBounds = bakeResult.uvBounds;
	if (!texCanvas || !uvBounds) return;

	var imageId = "flattened_" + surfaceId;
	var meshBounds = {
		minX: uvBounds.minU,
		maxX: uvBounds.maxU,
		minY: uvBounds.minV,
		maxY: uvBounds.maxV,
		minZ: surface.points && surface.points.length > 0 ? surface.points[0].z : 0,
		maxZ: surface.points && surface.points.length > 0 ? surface.points[0].z : 0
	};
	var worldWidth = meshBounds.maxX - meshBounds.minX;
	var worldHeight = meshBounds.maxY - meshBounds.minY;

	// Convert baked canvas to data URL for IndexedDB persistence
	var imageDataURL = texCanvas.toDataURL("image/png");

	// Store on surface for saveSurfaceToDB
	surface.flattenedImageDataURL = imageDataURL;
	surface.flattenedImageBounds = meshBounds;
	surface.flattenedImageDimensions = { width: texCanvas.width, height: texCanvas.height };

	// Register in loadedImages for immediate 2D rendering
	var imageEntry = {
		id: imageId,
		name: surface.name + "_flattened",
		canvas: texCanvas,
		bbox: [meshBounds.minX, meshBounds.minY, meshBounds.maxX, meshBounds.maxY],
		width: texCanvas.width,
		height: texCanvas.height,
		visible: true,
		transparency: surface.transparency || 1.0,
		zElevation: meshBounds.minZ || 0,
		isGeoReferenced: true,
		bounds: {
			minX: meshBounds.minX,
			maxX: meshBounds.maxX,
			minY: meshBounds.minY,
			maxY: meshBounds.maxY
		},
		pixelWidth: worldWidth / texCanvas.width,
		pixelHeight: worldHeight / texCanvas.height,
		sourceType: "flattened_analysis",
		sourceSurfaceId: surfaceId
	};

	if (window.loadedImages) {
		window.loadedImages.set(imageId, imageEntry);
	}

	// Save to IndexedDB (with the flattenedImageDataURL now stored)
	if (window.saveSurfaceToDB) {
		window.saveSurfaceToDB(surfaceId).catch(function(err) {
			console.error("Failed to save analysis surface to IndexedDB:", err);
		});
	}

	console.log("Created flattened analysis image: " + imageId + " (" + texCanvas.width + "x" + texCanvas.height + ")");
}

/**
 * Get legend information for a shader model.
 * Dynamically samples colours from ColourRampFactory.RAMPS.
 *
 * @param {string} modelName - Model name
 * @returns {Object} - { title, minVal, maxVal, colorStops }
 */
function getShaderLegendInfo(modelName) {
	var models = {
		ppv: { title: "PPV (mm/s)", ramp: "ppv", min: 0, max: 200 },
		heelan_original: { title: "PPV (mm/s)", ramp: "jet", min: 0, max: 300 },
		scaled_heelan: { title: "PPV (mm/s)", ramp: "jet", min: 0, max: 300 },
		nonlinear_damage: { title: "Damage Index", ramp: "damage", min: 0, max: 1 },
		sdob: { title: "SDoB (m/kg^1/3)", ramp: "sdob", min: 0, max: 3 }
	};
	var info = models[modelName] || models.ppv;
	var stops = ColourRampFactory.RAMPS[info.ramp] || ColourRampFactory.RAMPS["jet"];

	// Sample 5 colours at positions 0, 0.25, 0.5, 0.75, 1.0
	var colorStops = [];
	for (var i = 0; i < 5; i++) {
		var t = i / 4;
		var rgb = ColourRampFactory._interpolate(stops, t);
		colorStops.push({
			pos: t,
			color: "rgb(" + Math.round(rgb[0] * 255) + "," + Math.round(rgb[1] * 255) + "," + Math.round(rgb[2] * 255) + ")"
		});
	}
	return { title: info.title, minVal: info.min, maxVal: info.max, colorStops: colorStops };
}

/**
 * Clear blast analysis legend overlay.
 * Surface removal is handled via TreeView delete or undo.
 */
export function clearBlastAnalysisShader() {
	hideShaderAnalyticsLegend();
	clearFlattenedAnalysis();
	console.log("Blast analysis legend cleared");
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
 * Calculate bounding box for holes.
 *
 * @param {Array} holes - Blast holes
 * @returns {Object} - { minX, maxX, minY, maxY }
 */
function calculateHoleBounds(holes) {
	var bounds = {
		minX: Infinity, maxX: -Infinity,
		minY: Infinity, maxY: -Infinity
	};

	holes.forEach(function(hole) {
		if (hole.startXLocation < bounds.minX) bounds.minX = hole.startXLocation;
		if (hole.startXLocation > bounds.maxX) bounds.maxX = hole.startXLocation;
		if (hole.startYLocation < bounds.minY) bounds.minY = hole.startYLocation;
		if (hole.startYLocation > bounds.maxY) bounds.maxY = hole.startYLocation;
	});

	return bounds;
}

/**
 * Calculate average collar Z elevation.
 *
 * @param {Array} holes - Blast holes
 * @returns {number} - Average Z
 */
function calculateAverageCollarZ(holes) {
	var sum = 0;
	holes.forEach(function(hole) {
		sum += hole.startZLocation || 0;
	});
	return holes.length > 0 ? sum / holes.length : 0;
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

/**
 * Flatten the current analysis shader to a 2D canvas and store globally
 * for overlay rendering in the 2D view and GeoTIFF export.
 *
 * @param {number} pixelsPerMetre - Resolution (default 1.0)
 */
export function flattenAnalysisTo2D(pixelsPerMetre) {
	pixelsPerMetre = pixelsPerMetre || 1.0;

	import("../draw/canvas3DDrawing.js").then(function(module) {
		if (!module.flattenBlastAnalytics) return;

		var result = module.flattenBlastAnalytics(pixelsPerMetre);
		if (result && result.canvas) {
			window.blastAnalyticsFlattenedCanvas = result.canvas;
			window.blastAnalyticsFlattenedBounds = result.bounds; // [minX, minY, maxX, maxY]
			console.log("Analysis flattened to 2D: " + result.width + "x" + result.height + " px");

			// Redraw 2D to show overlay
			if (window.drawData) {
				window.drawData(window.allBlastHoles, window.selectedHole);
			}
		}
	}).catch(function(err) {
		console.warn("Failed to flatten analysis to 2D:", err);
	});
}

/**
 * Clear the flattened analysis overlay from 2D view.
 */
export function clearFlattenedAnalysis() {
	window.blastAnalyticsFlattenedCanvas = null;
	window.blastAnalyticsFlattenedBounds = null;
}
