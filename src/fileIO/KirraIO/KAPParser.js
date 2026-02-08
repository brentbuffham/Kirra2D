/**
 * @fileoverview KAP (Kirra Application Project) Parser
 * Imports a .kap ZIP archive and restores the full project state.
 *
 * Import flow:
 *   1. Read ZIP file
 *   2. Parse manifest.json for version check
 *   3. Clear existing data (clearAllDataStructures)
 *   4. Restore all data: holes, drawings, surfaces, images, charging, layers
 *   5. Rebuild 3D meshes for textured surfaces
 *   6. Trigger refresh: calculateTimes, drawData, updateTreeView, centroid recalculation
 *   7. Save all to IndexedDB
 */

import BaseParser from "../BaseParser.js";
import JSZip from "jszip";
import { KAP_VERSION } from "../../charging/ChargingConstants.js";
import { createProductFromJSON } from "../../charging/products/productFactory.js";
import { HoleCharging } from "../../charging/HoleCharging.js";
import { ChargeConfig } from "../../charging/ChargeConfig.js";

class KAPParser extends BaseParser {
	constructor(options) {
		super(options || {});
	}

	/**
	 * Parse a .kap ZIP file and restore project state
	 * @param {File} file - The .kap file
	 * @returns {Promise<Object>} Import summary
	 */
	async parse(file) {
		var zip = await JSZip.loadAsync(file);
		var summary = { holes: 0, drawings: 0, surfaces: 0, images: 0, products: 0, charging: 0, configs: 0, errors: [] };

		// ============ MANIFEST ============
		var manifest = null;
		var manifestFile = zip.file("manifest.json");
		if (manifestFile) {
			try {
				manifest = JSON.parse(await manifestFile.async("string"));
				console.log("KAP manifest: version=" + manifest.kapVersion + ", project=" + manifest.projectName);
			} catch (err) {
				summary.errors.push("Failed to parse manifest: " + err.message);
			}
		}

		// ============ CLEAR EXISTING DATA ============
		if (typeof window.clearAllDataStructures === "function") {
			window.clearAllDataStructures();
		}

		// Clear 3D scene objects
		if (window.threeRenderer && window.threeRenderer.surfaceMeshMap) {
			window.threeRenderer.surfaceMeshMap.forEach(function(mesh, id) {
				window.threeRenderer.scene.remove(mesh);
			});
			window.threeRenderer.surfaceMeshMap.clear();
		}

		// ============ BLAST HOLES ============
		var holesFile = zip.file("holes.json");
		if (holesFile) {
			try {
				var holesData = JSON.parse(await holesFile.async("string"));
				if (Array.isArray(holesData)) {
					window.allBlastHoles = holesData;
					summary.holes = holesData.length;
				}
			} catch (err) {
				summary.errors.push("Failed to parse holes: " + err.message);
			}
		}

		// ============ KAD DRAWINGS ============
		var drawingsFile = zip.file("drawings.json");
		if (drawingsFile) {
			try {
				var drawingsData = JSON.parse(await drawingsFile.async("string"));
				if (Array.isArray(drawingsData)) {
					window.allKADDrawingsMap = new Map(drawingsData);
					summary.drawings = window.allKADDrawingsMap.size;
				}
			} catch (err) {
				summary.errors.push("Failed to parse drawings: " + err.message);
			}
		}

		// ============ SURFACES ============
		var surfacesFile = zip.file("surfaces.json");
		if (surfacesFile) {
			try {
				var surfacesData = JSON.parse(await surfacesFile.async("string"));
				var texturedSurfaceIds = [];

				for (var si = 0; si < surfacesData.length; si++) {
					var sd = surfacesData[si];
					var surfaceEntry = {
						id: sd.id,
						name: sd.name,
						type: sd.type || "triangulated",
						points: sd.points,
						triangles: sd.triangles,
						visible: sd.visible !== false,
						gradient: sd.isTexturedMesh ? "texture" : (sd.gradient || "default"),
						transparency: sd.transparency || 1.0,
						hillshadeColor: sd.hillshadeColor || null,
						minLimit: sd.minLimit || null,
						maxLimit: sd.maxLimit || null,
						layerId: sd.layerId || null,
						created: sd.created || null,
						metadata: sd.metadata || {},
						isTexturedMesh: sd.isTexturedMesh || false,
						meshBounds: sd.meshBounds || null
					};

					// Restore textured mesh data
					if (sd.isTexturedMesh) {
						surfaceEntry.objContent = sd.objContent || null;
						surfaceEntry.mtlContent = sd.mtlContent || null;
						surfaceEntry.materialProperties = sd.materialProperties || null;
						surfaceEntry.threeJSMesh = null; // Will be rebuilt

						// Restore texture blobs from ZIP
						if (sd.textureFileNames && sd.textureFolderKey) {
							surfaceEntry.textureBlobs = {};
							for (var ti = 0; ti < sd.textureFileNames.length; ti++) {
								var texName = sd.textureFileNames[ti];
								var texPath = "textures/" + sd.textureFolderKey + "/" + texName;
								var texFile = zip.file(texPath);
								if (texFile) {
									surfaceEntry.textureBlobs[texName] = await texFile.async("blob");
								}
							}
						}

						texturedSurfaceIds.push(sd.id);
					}

					window.loadedSurfaces.set(sd.id, surfaceEntry);
					summary.surfaces++;
				}

				// Rebuild textured meshes (staggered)
				if (texturedSurfaceIds.length > 0 && typeof window.rebuildTexturedMesh === "function") {
					texturedSurfaceIds.forEach(function(surfaceId, index) {
						setTimeout(function() {
							window.rebuildTexturedMesh(surfaceId);
						}, index * 50);
					});
				}
			} catch (err) {
				summary.errors.push("Failed to parse surfaces: " + err.message);
			}
		}

		// ============ IMAGES ============
		var imagesFile = zip.file("images.json");
		if (imagesFile) {
			try {
				var imagesData = JSON.parse(await imagesFile.async("string"));

				for (var ii = 0; ii < imagesData.length; ii++) {
					var imgRecord = imagesData[ii];

					// Restore image blob from ZIP
					var imgBlob = null;
					if (imgRecord.blobFileName) {
						var imgBlobFile = zip.file("images/" + imgRecord.blobFileName);
						if (imgBlobFile) {
							imgBlob = await imgBlobFile.async("blob");
						}
					}

					if (imgBlob) {
						// Reconstruct canvas from blob
						await restoreImageFromBlob(imgRecord, imgBlob);
						summary.images++;
					}
				}
			} catch (err) {
				summary.errors.push("Failed to parse images: " + err.message);
			}
		}

		// ============ CHARGING: PRODUCTS ============
		var productsFile = zip.file("products.json");
		if (productsFile) {
			try {
				var productsData = JSON.parse(await productsFile.async("string"));
				if (Array.isArray(productsData)) {
					for (var pi = 0; pi < productsData.length; pi++) {
						var entry = productsData[pi];
						var productID = entry[0];
						var productJSON = entry[1];
						try {
							var product = createProductFromJSON(productJSON);
							window.loadedProducts.set(productID, product);
							summary.products++;
						} catch (prodErr) {
							summary.errors.push("Product " + productID + ": " + prodErr.message);
						}
					}
				}
			} catch (err) {
				summary.errors.push("Failed to parse products: " + err.message);
			}
		}

		// ============ CHARGING: HOLE CHARGING ============
		var chargingFile = zip.file("charging.json");
		if (chargingFile) {
			try {
				var chargingData = JSON.parse(await chargingFile.async("string"));
				if (Array.isArray(chargingData)) {
					for (var ci = 0; ci < chargingData.length; ci++) {
						var cEntry = chargingData[ci];
						var holeID = cEntry[0];
						var chargingJSON = cEntry[1];
						try {
							var holeCharging = HoleCharging.fromJSON(chargingJSON);
							window.loadedCharging.set(holeID, holeCharging);
							summary.charging++;
						} catch (chgErr) {
							summary.errors.push("Charging for hole " + holeID + ": " + chgErr.message);
						}
					}
				}
			} catch (err) {
				summary.errors.push("Failed to parse charging: " + err.message);
			}
		}

		// ============ CHARGING: CONFIGS ============
		var configsFile = zip.file("configs.json");
		if (configsFile) {
			try {
				var configsData = JSON.parse(await configsFile.async("string"));
				if (Array.isArray(configsData)) {
					for (var cfi = 0; cfi < configsData.length; cfi++) {
						var cfEntry = configsData[cfi];
						var configID = cfEntry[0];
						var configJSON = cfEntry[1];
						try {
							var config = ChargeConfig.fromJSON(configJSON);
							window.loadedChargeConfigs.set(configID, config);
							summary.configs++;
						} catch (cfgErr) {
							summary.errors.push("Config " + configID + ": " + cfgErr.message);
						}
					}
				}
			} catch (err) {
				summary.errors.push("Failed to parse configs: " + err.message);
			}
		}

		// ============ LAYERS ============
		var layersFile = zip.file("layers.json");
		if (layersFile) {
			try {
				var layersData = JSON.parse(await layersFile.async("string"));

				if (layersData.drawingLayers && window.allDrawingLayers) {
					window.allDrawingLayers.clear();
					for (var dli = 0; dli < layersData.drawingLayers.length; dli++) {
						var dl = layersData.drawingLayers[dli];
						dl.entities = new Set(dl.entities || []);
						window.allDrawingLayers.set(dl.layerId, dl);
					}
				}

				if (layersData.surfaceLayers && window.allSurfaceLayers) {
					window.allSurfaceLayers.clear();
					for (var sli = 0; sli < layersData.surfaceLayers.length; sli++) {
						var sl = layersData.surfaceLayers[sli];
						sl.entities = new Set(sl.entities || []);
						window.allSurfaceLayers.set(sl.layerId, sl);
					}
				}
			} catch (err) {
				summary.errors.push("Failed to parse layers: " + err.message);
			}
		}

		// ============ REFRESH APPLICATION STATE ============
		try {
			// Recalculate timing
			if (typeof window.calculateTimes === "function" && window.allBlastHoles.length > 0) {
				window.calculateTimes(window.allBlastHoles);
			}

			// Recalculate centroid
			if (typeof window.requestCentroidRecalculation === "function") {
				window.requestCentroidRecalculation();
			}

			// Redraw
			if (typeof window.drawData === "function") {
				window.drawData(window.allBlastHoles, window.selectedHole);
			}

			// Update tree view
			if (typeof window.debouncedUpdateTreeView === "function") {
				window.debouncedUpdateTreeView();
			}

			// Save everything to IndexedDB
			if (typeof window.debouncedSaveHoles === "function") window.debouncedSaveHoles();
			if (typeof window.debouncedSaveKAD === "function") window.debouncedSaveKAD();
			if (typeof window.debouncedSaveLayers === "function") window.debouncedSaveLayers();

			// Save surfaces to IndexedDB
			if (typeof window.saveSurfaceToDB === "function") {
				window.loadedSurfaces.forEach(function(surface, surfaceId) {
					window.saveSurfaceToDB(surfaceId);
				});
			}

			// Save images to IndexedDB
			if (typeof window.saveImageToDB === "function") {
				window.loadedImages.forEach(function(image, imageId) {
					window.saveImageToDB(imageId);
				});
			}

			// Save charging data
			if (typeof window.debouncedSaveProducts === "function") window.debouncedSaveProducts();
			if (typeof window.debouncedSaveCharging === "function") window.debouncedSaveCharging();
			if (typeof window.debouncedSaveConfigs === "function") window.debouncedSaveConfigs();
		} catch (refreshErr) {
			summary.errors.push("Refresh error: " + refreshErr.message);
		}

		summary.projectName = manifest ? manifest.projectName : file.name;
		return summary;
	}
}

/**
 * Restore an image entry from blob data (reconstructs canvas)
 */
function restoreImageFromBlob(imgRecord, blob) {
	return new Promise(function(resolve) {
		var img = new Image();
		var canvas = document.createElement("canvas");
		var ctx = canvas.getContext("2d");

		img.onload = function() {
			canvas.width = img.width;
			canvas.height = img.height;
			ctx.drawImage(img, 0, 0);

			window.loadedImages.set(imgRecord.id, {
				id: imgRecord.id,
				name: imgRecord.name || imgRecord.id,
				canvas: canvas,
				blob: blob,
				bbox: imgRecord.bbox,
				type: imgRecord.type || "imagery",
				visible: imgRecord.visible !== false,
				transparency: imgRecord.transparency || 1.0,
				zElevation: imgRecord.zElevation || 0
			});

			URL.revokeObjectURL(img.src);
			resolve();
		};

		img.onerror = function() {
			console.error("Failed to restore image: " + imgRecord.id);
			URL.revokeObjectURL(img.src);
			resolve();
		};

		img.src = URL.createObjectURL(blob);
	});
}

export default KAPParser;
