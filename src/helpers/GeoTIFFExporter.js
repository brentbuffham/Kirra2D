// src/helpers/GeoTIFFExporter.js
//=============================================================
// GEOTIFF EXPORT HELPER
//=============================================================
// Step 1) Exports surfaces and images as GeoTIFF files
// Step 2) Handles both RGB imagery and elevation data
// Step 3) Asks user for projection/CRS information
// Step 4) Created: 2026-01-09

import { rasterizeSurfaceToElevationGrid, boundsToArray, renderSurfaceToCanvas } from "./SurfaceRasterizer.js";
import { promptForExportProjection } from "../dialog/popups/generic/ProjectionDialog.js";
import { FloatingDialog } from "../dialog/FloatingDialog.js";

/**
 * Show export progress dialog
 */
function showExportProgressDialog() {
	const progressContent = document.createElement("div");
	progressContent.style.textAlign = "center";
	progressContent.innerHTML = '<p>Exporting GeoTIFF files</p><p>Please wait...</p><div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;"><div id="exportProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div></div><p id="exportProgressText">Initializing...</p>';

	var dialog = new FloatingDialog({
		title: "Exporting GeoTIFF",
		content: progressContent,
		layoutType: "default",
		width: 400,
		height: 250,
		showConfirm: false,
		showCancel: false,
		showDeny: false,
		draggable: false,
		resizable: false,
		closeOnOutsideClick: false,
		modal: true // Make it modal to block interaction with background dialogs
	});

	dialog.show();
	return dialog;
}

/**
 * Update export progress dialog
 */
function updateExportProgress(dialog, message, percent) {
	if (!dialog || !dialog.element) return;

	var progressText = dialog.element.querySelector("#exportProgressText");
	var progressBar = dialog.element.querySelector("#exportProgressBar");

	if (progressText) {
		progressText.textContent = message;
	}

	if (progressBar) {
		progressBar.style.width = percent + "%";
	}
}

/**
 * Scale image canvas to target resolution
 * @param {HTMLCanvasElement} sourceCanvas - Source canvas to scale
 * @param {Array} bbox - Bounding box [minX, minY, maxX, maxY]
 * @param {number} pixelsPerMeter - Target resolution
 * @returns {Object} {canvas, width, height, bbox}
 */
function scaleImageToResolution(sourceCanvas, bbox, pixelsPerMeter) {
	var worldWidth = bbox[2] - bbox[0];
	var worldHeight = bbox[3] - bbox[1];
	var targetWidth = Math.ceil(worldWidth * pixelsPerMeter);
	var targetHeight = Math.ceil(worldHeight * pixelsPerMeter);

	// Limit max size
	var maxSize = 8192;
	if (targetWidth > maxSize || targetHeight > maxSize) {
		var scale = maxSize / Math.max(targetWidth, targetHeight);
		targetWidth = Math.ceil(targetWidth * scale);
		targetHeight = Math.ceil(targetHeight * scale);
		console.warn("Image too large, scaling down to " + targetWidth + "x" + targetHeight);
	}

	console.log("Scaling image from " + sourceCanvas.width + "x" + sourceCanvas.height + " to " + targetWidth + "x" + targetHeight);

	// Create new canvas at target resolution
	var scaledCanvas = document.createElement("canvas");
	scaledCanvas.width = targetWidth;
	scaledCanvas.height = targetHeight;
	var ctx = scaledCanvas.getContext("2d");

	// Use high-quality image scaling
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";

	// Draw source canvas scaled to target size
	ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

	return {
		canvas: scaledCanvas,
		width: targetWidth,
		height: targetHeight,
		bbox: bbox
	};
}

/**
 * Export images and cached surfaces as RGB GeoTIFF
 * @param {Map} surface2DCache - Map of cached surface canvases
 * @param {Map} loadedSurfaces - Map of loaded surfaces
 * @param {Map} loadedImages - Map of loaded images
 * @param {Object} fileManager - FileManager instance
 * @param {Function} showModalMessage - Show message function
 */
export async function exportImagesAsGeoTIFF(surface2DCache, loadedSurfaces, loadedImages, fileManager, showModalMessage) {
	try {
		// Step 1) Collect all exportable surfaces and images
		var exportSurfaces = [];
		var exportImages = [];

		// Step 2) Collect visible surfaces
		loadedSurfaces.forEach((surface, surfaceId) => {
			if (surface && surface.visible && surface.triangles && surface.triangles.length > 0) {
				exportSurfaces.push({
					type: "surface",
					name: surface.name || surfaceId,
					surface: surface,
					cachedCanvas: surface2DCache.get(surfaceId)
				});
			}
		});

		// Step 3) Collect loaded images (GeoTIFF imports)
		loadedImages.forEach((image, imageId) => {
			if (image.visible && image.canvas) {
				exportImages.push({
					type: "image",
					name: image.name || imageId,
					canvas: image.canvas,
					bbox: image.bbox
				});
			}
		});

		// Step 3b) Include flattened blast analysis overlay if available
		if (window.blastAnalyticsFlattenedCanvas && window.blastAnalyticsFlattenedBounds) {
			var analysisBounds = window.blastAnalyticsFlattenedBounds; // [minX, minY, maxX, maxY]
			exportImages.push({
				type: "analysis",
				name: "BlastAnalysis_" + (window.blastAnalyticsSettings ? window.blastAnalyticsSettings.model : "overlay"),
				canvas: window.blastAnalyticsFlattenedCanvas,
				bbox: analysisBounds
			});
		}

		if (exportSurfaces.length === 0 && exportImages.length === 0) {
			showModalMessage("No Images", "No visible surfaces or images to export", "info");
			return;
		}

		// Step 4) Get common bounding box FIRST (before any prompts)
	var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

	exportSurfaces.forEach(function(item) {
		item.surface.points.forEach(function(point) {
			minX = Math.min(minX, point.x);
			maxX = Math.max(maxX, point.x);
			minY = Math.min(minY, point.y);
			maxY = Math.max(maxY, point.y);
		});
	});

	exportImages.forEach(function(item) {
		if (item.bbox && item.bbox.length === 4) {
			minX = Math.min(minX, item.bbox[0]);
			minY = Math.min(minY, item.bbox[1]);
			maxX = Math.max(maxX, item.bbox[2]);
			maxY = Math.max(maxY, item.bbox[3]);
		}
	});

	var commonBbox = [minX, minY, maxX, maxY];

	// Step 5) Show projection and resolution dialog (NO filename)
	// IMPORTANT: We do NOT transform coordinates! The EPSG code is just a TAG.
	// The user selects which CRS their data is ALREADY IN (e.g., UTM Zone 50S).
	// The .prj file tells GIS software "these coords are in EPSG:32750" - no transformation occurs.
	var exportSettings = await promptForExportProjection(commonBbox);
	if (exportSettings.cancelled) {
		console.log("Export cancelled by user");
		return;
	}

	// Step 5b) Show directory picker ONCE for all exports
	var directoryHandle = null;
	if (window.showDirectoryPicker) {
		try {
			directoryHandle = await window.showDirectoryPicker({
				mode: 'readwrite'
			});
			console.log("Selected directory:", directoryHandle.name);
		} catch (error) {
			if (error.name === 'AbortError') {
				console.log("Directory picker cancelled by user");
				return;
			}
			throw error;
		}
	} else {
		showModalMessage("Unsupported Browser", "Your browser doesn't support directory picker. Files will download to Downloads folder.", "info");
		// Continue without directory picker - files will auto-download
	}

		// Step 6) Show progress dialog
		var totalItems = exportSurfaces.length + exportImages.length;
		var progressDialog = showExportProgressDialog();
		updateExportProgress(progressDialog, "Preparing export...", 0);

		// Step 7) Yield to UI to show progress dialog
		await new Promise(resolve => setTimeout(resolve, 50));

		// Step 8) Calculate pixels per meter based on resolution mode
		var pixelsPerMeter = 1.0;
		switch (exportSettings.resolutionMode) {
			case "screen":
				// Get resolution from first cached surface
				var firstCached = exportSurfaces.find(s => s.cachedCanvas);
				if (firstCached) {
					var cache = firstCached.cachedCanvas;
					var paddedWidth = cache.bounds.maxX - cache.bounds.minX;
					var paddedHeight = cache.bounds.maxY - cache.bounds.minY;
					pixelsPerMeter = (cache.canvas.width / paddedWidth + cache.canvas.height / paddedHeight) / 2;
				} else {
					pixelsPerMeter = 5; // Fallback
				}
				break;
			case "dpi":
				pixelsPerMeter = exportSettings.dpi / 0.0254;
				break;
			case "ppm":
				pixelsPerMeter = exportSettings.pixelsPerMeter;
				break;
			case "full":
				pixelsPerMeter = 10;
				break;
		}

		console.log("Exporting at " + pixelsPerMeter.toFixed(2) + " pixels/meter");
		updateExportProgress(progressDialog, "Calculating resolution: " + pixelsPerMeter.toFixed(2) + " pixels/meter", 5);

		// Step 8) Get elevationToColor function
		var elevationToColor = window.elevationToColor;
		if (!elevationToColor) {
			throw new Error("elevationToColor function not found");
		}

		// Step 9) Export surfaces
		var writer = fileManager.getWriter("geotiff-imagery");
		if (!writer) {
			throw new Error("GeoTIFF imagery writer not found");
		}

		var exportedCount = 0;

	for (var i = 0; i < exportSurfaces.length; i++) {
		var surfaceItem = exportSurfaces[i];

		// Update progress
		exportedCount++;
		var percent = Math.floor((exportedCount / totalItems) * 100);
		updateExportProgress(progressDialog, "Rendering " + exportedCount + " / " + totalItems + ": " + surfaceItem.name, percent);

		// Yield to UI to update progress
		await new Promise(resolve => setTimeout(resolve, 0));

		// Re-render at specified resolution
		var renderResult = renderSurfaceToCanvas(surfaceItem.surface, pixelsPerMeter, elevationToColor);
		if (!renderResult) {
			console.warn("Skipping " + surfaceItem.name + " - rendering failed");
			continue;
		}

		// Prompt for filename (matching KML export pattern)
		var timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
		var defaultFilename = "GeoTIFF_" + timestamp + "_" + surfaceItem.name.replace(/\.(dtm|str|tif|tiff|obj)$/i, "") + ".tif";

		// Close progress dialog temporarily to show filename dialog
		progressDialog.close();

		var filename = await new Promise((resolve) => {
			window.showConfirmationDialogWithInput(
				"Export GeoTIFF",
				"Enter filename for: " + surfaceItem.name,
				"Filename:",
				"text",
				defaultFilename,
				"Save",
				"Skip",
				function(enteredFilename) {
					// User confirmed
					if (!enteredFilename || enteredFilename.trim() === "") {
						resolve(null); // Skip this surface
						return;
					}
					// Ensure .tif extension
					if (!enteredFilename.toLowerCase().endsWith(".tif")) {
						enteredFilename += ".tif";
					}
					// Remove .tif extension for internal use (writer adds it back)
					resolve(enteredFilename.replace(/\.tif$/i, ""));
				},
				function() {
					// User cancelled/skipped
					resolve(null);
				}
			);
		});

		// Reopen progress dialog
		progressDialog = showExportProgressDialog();
		updateExportProgress(progressDialog, "Exporting " + exportedCount + " / " + totalItems + ": " + surfaceItem.name, percent);

		if (!filename) {
			console.log("Skipped " + surfaceItem.name);
			continue;
		}

		await writer.write({
			canvas: renderResult.canvas,
			bbox: renderResult.bbox,
			width: renderResult.width,
			height: renderResult.height,
			filename: filename,
			epsgCode: exportSettings.epsgCode,
			directoryHandle: directoryHandle // Pass directory handle to writer
		});
	}

	// Step 10) Export loaded images
	for (var i = 0; i < exportImages.length; i++) {
		var imageItem = exportImages[i];

		exportedCount++;
		var percent = Math.floor((exportedCount / totalItems) * 100);
		updateExportProgress(progressDialog, "Scaling " + exportedCount + " / " + totalItems + ": " + imageItem.name, percent);

		// Yield to UI to update progress
		await new Promise(resolve => setTimeout(resolve, 0));

		// Scale image to target resolution
		var scaledImage = scaleImageToResolution(imageItem.canvas, imageItem.bbox, pixelsPerMeter);

		// Prompt for filename (matching KML export pattern)
		var timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
		var defaultFilename = "GeoTIFF_" + timestamp + "_" + imageItem.name.replace(/\.(tif|tiff|png|jpg)$/i, "") + ".tif";

		// Close progress dialog temporarily to show filename dialog
		progressDialog.close();

		var filename = await new Promise((resolve) => {
			window.showConfirmationDialogWithInput(
				"Export GeoTIFF",
				"Enter filename for: " + imageItem.name,
				"Filename:",
				"text",
				defaultFilename,
				"Save",
				"Skip",
				function(enteredFilename) {
					// User confirmed
					if (!enteredFilename || enteredFilename.trim() === "") {
						resolve(null); // Skip this image
						return;
					}
					// Ensure .tif extension
					if (!enteredFilename.toLowerCase().endsWith(".tif")) {
						enteredFilename += ".tif";
					}
					// Remove .tif extension for internal use (writer adds it back)
					resolve(enteredFilename.replace(/\.tif$/i, ""));
				},
				function() {
					// User cancelled/skipped
					resolve(null);
				}
			);
		});

		// Reopen progress dialog
		progressDialog = showExportProgressDialog();
		updateExportProgress(progressDialog, "Exporting " + exportedCount + " / " + totalItems + ": " + imageItem.name, percent);

		if (!filename) {
			console.log("Skipped " + imageItem.name);
			continue;
		}

		await writer.write({
			canvas: scaledImage.canvas,
			bbox: scaledImage.bbox,
			width: scaledImage.width,
			height: scaledImage.height,
			filename: filename,
			epsgCode: exportSettings.epsgCode,
			directoryHandle: directoryHandle // Pass directory handle to writer
		});
	}

	// Step 11) Complete
	updateExportProgress(progressDialog, "Export complete! Exported " + exportedCount + " file(s)", 100);
	setTimeout(function() {
		if (progressDialog) progressDialog.close();
		
		showModalMessage(
			"Export Complete", 
			"Exported " + exportedCount + " surface(s) as GeoTIFF\n\n" +
			"Files saved (.tif + .prj with same base name)\n\n" +
			"IMPORTANT: Coordinates are preserved in their original projection.\n" +
			"The EPSG:" + exportSettings.epsgCode + " tag tells GIS software what projection they're in.\n\n" +
			"To open in QGIS:\n" +
			"1. Keep .tif and .prj files together\n" +
			"2. Drag the .tif file into QGIS\n" +
			"3. CRS will auto-detect from .prj file", 
			"success"
		);
	}, 800);
	} catch (error) {
		// Close progress dialog
		if (progressDialog) progressDialog.close();

		// Don't show error if user cancelled
		if (error.name === 'AbortError') {
			console.log("Export cancelled by user");
			return;
		}

		console.error("Error exporting images:", error);
		showModalMessage("Export Error", error.message, "error");
		throw error;
	}
}

/**
 * Export surfaces as elevation GeoTIFF (rasterized triangle mesh)
 * @param {Map} loadedSurfaces - Map of loaded surfaces
 * @param {Object} fileManager - FileManager instance
 * @param {Function} showModalMessage - Show message function
 */
export async function exportSurfacesAsElevationGeoTIFF(loadedSurfaces, fileManager, showModalMessage) {
	try {
		// Step 1) Get all visible surfaces
		var exportableSurfaces = [];
		loadedSurfaces.forEach((surface, surfaceId) => {
			if (surface.visible && surface.triangles && surface.triangles.length > 0) {
				exportableSurfaces.push(surface);
			}
		});

		if (exportableSurfaces.length === 0) {
			showModalMessage("No Surfaces", "No visible surfaces to export", "info");
			return;
		}

		// Step 2) Export each surface
		var writer = fileManager.getWriter("geotiff-elevation");
		if (!writer) {
			throw new Error("GeoTIFF elevation writer not found");
		}

		for (var i = 0; i < exportableSurfaces.length; i++) {
			var surface = exportableSurfaces[i];

			// Step 3) Rasterize surface to elevation grid
			var rasterData = rasterizeSurfaceToElevationGrid(surface, 1.0); // 1 meter resolution

			if (!rasterData) {
				console.warn("Skipping " + surface.name + " - rasterization failed");
				continue;
			}

			// Step 4) Export as elevation GeoTIFF
			await writer.write({
				elevationData: rasterData.elevationData,
				bbox: rasterData.bbox,
				width: rasterData.width,
				height: rasterData.height,
				filename: surface.name || ("surface_" + surface.id)
			});
		}

		showModalMessage("Export Complete", "Exported " + exportableSurfaces.length + " surface(s) as elevation GeoTIFF", "success");
	} catch (error) {
		// Don't show error if user cancelled
		if (error.name === 'AbortError') {
			console.log("Export cancelled by user");
			return;
		}

		console.error("Error exporting elevation surfaces:", error);
		showModalMessage("Export Error", error.message, "error");
		throw error;
	}
}
