// src/helpers/AnalysisTextureRebuilder.js
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * AnalysisTextureRebuilder handles persistence of baked analysis textures
 * using glTF (GLB) format for reliable serialization of mesh + texture.
 *
 * Export: baked mesh → GLB ArrayBuffer → stored in IndexedDB
 * Import: GLB ArrayBuffer → loaded mesh → added to Three.js scene
 */

/**
 * Export a baked analysis mesh to GLB binary ArrayBuffer.
 * The mesh must have a MeshBasicMaterial with a CanvasTexture map.
 *
 * @param {THREE.Mesh} mesh - Baked analysis mesh with texture
 * @returns {Promise<ArrayBuffer>} - GLB binary data
 */
export async function exportAnalysisMeshToGLB(mesh) {
	if (!mesh) {
		console.error("AnalysisTextureRebuilder: No mesh to export");
		return null;
	}

	var exporter = new GLTFExporter();

	return new Promise(function(resolve, reject) {
		exporter.parse(
			mesh,
			function(result) {
				// result is an ArrayBuffer when binary:true
				resolve(result);
			},
			function(error) {
				console.error("AnalysisTextureRebuilder: GLB export failed:", error);
				reject(error);
			},
			{ binary: true }
		);
	});
}

/**
 * Rebuild a baked analysis mesh from a GLB ArrayBuffer stored in IndexedDB.
 * Also restores analysisCanvas/analysisTexture on the surface for 2D rendering.
 *
 * @param {string} surfaceId - Surface ID to apply the rebuilt mesh to
 * @param {ArrayBuffer} glbData - GLB binary data from IndexedDB
 * @param {Object} analysisParams - { modelName, params, uvBounds } for metadata
 * @returns {Promise<THREE.Group|null>} - Loaded mesh group or null
 */
export async function rebuildAnalysisFromGLB(surfaceId, glbData, analysisParams) {
	if (!glbData || !surfaceId) {
		console.warn("AnalysisTextureRebuilder: Missing data for rebuild");
		return null;
	}

	var loader = new GLTFLoader();

	return new Promise(function(resolve) {
		loader.parse(
			glbData,
			"",
			function(gltf) {
				var scene = gltf.scene;
				if (!scene) {
					console.warn("AnalysisTextureRebuilder: No scene in GLB data");
					resolve(null);
					return;
				}

				// Get the surface to restore metadata
				var surface = window.loadedSurfaces ? window.loadedSurfaces.get(surfaceId) : null;
				if (surface && analysisParams) {
					surface.isAnalysisSurface = true;
					surface.analysisModelName = analysisParams.modelName || null;
					surface.analysisParams = analysisParams.params || null;
					surface.analysisUVBounds = analysisParams.uvBounds || null;
					surface.gradient = "analysis";
				}

				// Apply to 3D scene — replace existing surface mesh
				if (window.threeRenderer && window.threeRenderer.surfaceMeshMap) {
					var existingMesh = window.threeRenderer.surfaceMeshMap.get(surfaceId);
					if (existingMesh && existingMesh.parent) {
						existingMesh.parent.remove(existingMesh);
					}

					// Tag for identification
					scene.userData = {
						type: "surface",
						isAnalysisSurface: true,
						surfaceId: surfaceId,
						modelName: analysisParams ? analysisParams.modelName : null
					};

					// Make all child materials double-sided and transparent
					// Also extract the texture for 2D rendering
					var extractedTexture = null;
					scene.traverse(function(child) {
						if (child.isMesh && child.material) {
							child.material.side = THREE.DoubleSide;
							child.material.transparent = true;
							child.material.opacity = surface ? (surface.transparency || 1.0) : 1.0;
							// Extract texture from first mesh that has one
							if (!extractedTexture && child.material.map) {
								extractedTexture = child.material.map;
							}
						}
					});

					window.threeRenderer.surfaceMeshMap.set(surfaceId, scene);
					window.threeRenderer.surfacesGroup.add(scene);

					// Restore analysisTexture and analysisCanvas on the surface
					// so the 2D renderer can use drawImage with the baked texture
					if (surface && extractedTexture && extractedTexture.image) {
						var img = extractedTexture.image;
						var canvas2D = document.createElement("canvas");
						canvas2D.width = img.width || img.naturalWidth || 1024;
						canvas2D.height = img.height || img.naturalHeight || 1024;
						var ctx2D = canvas2D.getContext("2d");
						ctx2D.drawImage(img, 0, 0, canvas2D.width, canvas2D.height);

						surface.analysisCanvas = canvas2D;
						surface.analysisTexture = extractedTexture;
						console.log("Restored analysis canvas from GLB texture: " + canvas2D.width + "x" + canvas2D.height);
					}

					console.log("Rebuilt analysis mesh from GLB for surface: " + surfaceId);
				}

				// Invalidate 2D cache so it redraws with the restored canvas
				if (window.invalidateSurfaceCache) {
					window.invalidateSurfaceCache(surfaceId);
				}

				resolve(scene);
			},
			function(error) {
				console.error("AnalysisTextureRebuilder: GLB parse failed:", error);
				resolve(null);
			}
		);
	});
}
