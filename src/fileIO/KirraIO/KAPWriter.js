/**
 * @fileoverview KAP (Kirra Application Project) Writer
 * Exports the entire project as a .kap ZIP archive containing JSON files.
 *
 * ZIP structure:
 *   project.kap
 *   ├── manifest.json     (version, metadata)
 *   ├── holes.json        (allBlastHoles array)
 *   ├── drawings.json     (KAD drawings Map entries)
 *   ├── surfaces.json     (surface metadata + points/triangles)
 *   ├── images.json       (image metadata, blobs stored separately)
 *   ├── products.json     (charging products)
 *   ├── charging.json     (hole charging data)
 *   ├── configs.json      (charge configurations)
 *   ├── layers.json       (drawing + surface layers)
 *   ├── textures/         (texture blobs for OBJ meshes)
 *   └── images/           (image blobs)
 */

import BaseWriter from "../BaseWriter.js";
import JSZip from "jszip";
import { KAP_VERSION, SCHEMA_VERSION } from "../../charging/ChargingConstants.js";

class KAPWriter extends BaseWriter {
	constructor(options) {
		super(options || {});
	}

	/**
	 * Export full project as .kap ZIP
	 * @param {Object} data - Project data (optional, reads from window globals if not provided)
	 * @returns {Promise<{blob: Blob, filename: string}>}
	 */
	async write(data) {
		var zip = new JSZip();
		var d = data || {};

		// Gather data from globals
		var allBlastHoles = d.allBlastHoles || window.allBlastHoles || [];
		var kadDrawingsMap = d.kadDrawingsMap || window.allKADDrawingsMap || new Map();
		var surfacesMap = d.surfacesMap || window.loadedSurfaces || new Map();
		var imagesMap = d.imagesMap || window.loadedImages || new Map();
		var productsMap = d.productsMap || window.loadedProducts || new Map();
		var chargingMap = d.chargingMap || window.loadedCharging || new Map();
		var configsMap = d.configsMap || window.loadedChargeConfigs || new Map();
		var drawingLayers = d.drawingLayers || window.allDrawingLayers || new Map();
		var surfaceLayers = d.surfaceLayers || window.allSurfaceLayers || new Map();

		// ============ MANIFEST ============
		zip.file("manifest.json", JSON.stringify({
			kapVersion: KAP_VERSION,
			schemaVersion: SCHEMA_VERSION,
			application: "Kirra2D",
			created: new Date().toISOString(),
			projectName: d.projectName || "Untitled Project",
			counts: {
				holes: allBlastHoles.length,
				drawings: kadDrawingsMap.size,
				surfaces: surfacesMap.size,
				images: imagesMap.size,
				products: productsMap.size,
				charging: chargingMap.size,
				configs: configsMap.size
			}
		}, null, 2));

		// ============ BLAST HOLES ============
		if (allBlastHoles.length > 0) {
			zip.file("holes.json", JSON.stringify(allBlastHoles));
		}

		// ============ KAD DRAWINGS ============
		if (kadDrawingsMap.size > 0) {
			var drawingsData = Array.from(kadDrawingsMap.entries());
			zip.file("drawings.json", JSON.stringify(drawingsData));
		}

		// ============ SURFACES ============
		if (surfacesMap.size > 0) {
			var surfacesData = [];
			var textureFolder = zip.folder("textures");

			surfacesMap.forEach(function(surface, surfaceId) {
				var record = {
					id: surfaceId,
					name: surface.name,
					type: surface.type || "triangulated",
					points: surface.points,
					triangles: surface.triangles,
					visible: surface.visible !== undefined ? surface.visible : true,
					gradient: surface.isTexturedMesh ? "texture" : (surface.gradient || "default"),
					transparency: surface.transparency || 1.0,
					hillshadeColor: surface.hillshadeColor || null,
					minLimit: surface.minLimit || null,
					maxLimit: surface.maxLimit || null,
					layerId: surface.layerId || null,
					created: surface.created || null,
					metadata: surface.metadata || {},
					isTexturedMesh: surface.isTexturedMesh || false,
					meshBounds: surface.meshBounds || null
				};

				// For textured meshes, include OBJ/MTL content and material properties
				if (surface.isTexturedMesh) {
					record.objContent = surface.objContent || null;
					record.mtlContent = surface.mtlContent || null;
					record.materialProperties = surface.materialProperties || null;

					// Store texture blobs as separate files in ZIP
					if (surface.textureBlobs) {
						var safeSurfaceId = surfaceId.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
						var textureNames = [];
						for (var texName in surface.textureBlobs) {
							if (surface.textureBlobs.hasOwnProperty(texName)) {
								textureFolder.file(safeSurfaceId + "/" + texName, surface.textureBlobs[texName]);
								textureNames.push(texName);
							}
						}
						record.textureFileNames = textureNames;
						record.textureFolderKey = safeSurfaceId;
					}
				}

				surfacesData.push(record);
			});

			zip.file("surfaces.json", JSON.stringify(surfacesData));
		}

		// ============ IMAGES ============
		if (imagesMap.size > 0) {
			var imagesData = [];
			var imagesFolder = zip.folder("images");

			imagesMap.forEach(function(image, imageId) {
				var record = {
					id: imageId,
					name: image.name || imageId,
					type: image.type || "imagery",
					bbox: image.bbox || null,
					visible: image.visible !== undefined ? image.visible : true,
					transparency: image.transparency || 1.0,
					zElevation: image.zElevation || 0,
					savedAt: image.savedAt || null
				};

				// Store image blob as separate file in ZIP
				if (image.blob) {
					var safeImageId = imageId.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
					imagesFolder.file(safeImageId + ".blob", image.blob);
					record.blobFileName = safeImageId + ".blob";
				}

				imagesData.push(record);
			});

			zip.file("images.json", JSON.stringify(imagesData));
		}

		// ============ CHARGING: PRODUCTS ============
		if (productsMap.size > 0) {
			var productsData = [];
			productsMap.forEach(function(product, productID) {
				productsData.push([productID, product.toJSON()]);
			});
			zip.file("products.json", JSON.stringify(productsData));
		}

		// ============ CHARGING: HOLE CHARGING ============
		if (chargingMap.size > 0) {
			var chargingData = [];
			chargingMap.forEach(function(holeCharging, holeID) {
				chargingData.push([holeID, holeCharging.toJSON()]);
			});
			zip.file("charging.json", JSON.stringify(chargingData));
		}

		// ============ CHARGING: CONFIGS ============
		if (configsMap.size > 0) {
			var configsData = [];
			configsMap.forEach(function(config, configID) {
				configsData.push([configID, config.toJSON()]);
			});
			zip.file("configs.json", JSON.stringify(configsData));
		}

		// ============ LAYERS ============
		var hasDrawingLayers = drawingLayers && drawingLayers.size > 0;
		var hasSurfaceLayers = surfaceLayers && surfaceLayers.size > 0;

		if (hasDrawingLayers || hasSurfaceLayers) {
			var layersData = { drawingLayers: [], surfaceLayers: [] };

			if (hasDrawingLayers) {
				drawingLayers.forEach(function(layer) {
					layersData.drawingLayers.push({
						layerId: layer.layerId,
						layerName: layer.layerName,
						visible: layer.visible,
						sourceFile: layer.sourceFile,
						importDate: layer.importDate,
						entities: Array.from(layer.entities || [])
					});
				});
			}

			if (hasSurfaceLayers) {
				surfaceLayers.forEach(function(layer) {
					layersData.surfaceLayers.push({
						layerId: layer.layerId,
						layerName: layer.layerName,
						visible: layer.visible,
						sourceFile: layer.sourceFile,
						importDate: layer.importDate,
						entities: Array.from(layer.entities || [])
					});
				});
			}

			zip.file("layers.json", JSON.stringify(layersData));
		}

		// ============ GENERATE ZIP ============
		var blob = await zip.generateAsync({
			type: "blob",
			compression: "DEFLATE",
			compressionOptions: { level: 6 }
		});

		var timestamp = this.generateTimestamp();
		var filename = "KirraProject_" + timestamp + ".kap";

		return { blob: blob, filename: filename };
	}
}

export default KAPWriter;
