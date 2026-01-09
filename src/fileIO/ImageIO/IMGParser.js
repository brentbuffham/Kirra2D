// src/fileIO/ImageIO/IMGParser.js
//=============================================================
// GEOTIFF IMAGE PARSER
//=============================================================
// Step 1) Parses GeoTIFF files (elevation and imagery)
// Step 2) Handles WGS84 to MGA/UTM projection conversion
// Step 3) Supports single-band elevation and multi-band RGB/RGBA imagery
// Step 4) Created: 2026-01-09

import BaseParser from "../BaseParser.js";
import { fromArrayBuffer } from "geotiff";
import { promptForProjection, isLikelyWGS84 } from "../../dialog/popups/generic/ProjectionDialog.js";

/**
 * Parser for GeoTIFF image files
 * Supports both elevation data (single band) and RGB/RGBA imagery (multi-band)
 */
class IMGParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	/**
	 * Parse GeoTIFF file
	 * @param {File} file - The GeoTIFF file to parse
	 * @returns {Promise<Object>} Parsed image data with type, bbox, rasters, dimensions
	 */
	async parse(file) {
		try {
			// Step 1) Read file as array buffer
			var arrayBuffer = await this.readAsArrayBuffer(file);

			// Step 2) Parse GeoTIFF using geotiff.js library
			var tiff = await fromArrayBuffer(arrayBuffer);
			var image = await tiff.getImage();
			var rasters = await image.readRasters();

			// Step 3) Extract geospatial metadata
			var bbox = image.getBoundingBox();
			var width = image.getWidth();
			var height = image.getHeight();
			var bandCount = image.getSamplesPerPixel();

			// Step 4) Check if coordinates are in WGS84 and need conversion
			var transformedBbox = bbox;
			var projectionInfo = null;

			if (isLikelyWGS84(bbox)) {
				// Step 5) Show projection dialog and get user selection
				var result = await promptForProjection(bbox);

				if (!result.transformed) {
					// User cancelled transformation
					throw new Error("Coordinate transformation cancelled by user");
				}

				transformedBbox = result.bbox;
				projectionInfo = {
					epsgCode: result.epsgCode,
					customProj4: result.customProj4
				};
			}

			// Step 6) Determine image type based on band count
			var imageType = bandCount >= 3 ? "imagery" : "elevation";

			// Step 7) Prepare result based on image type
			var result = {
				type: imageType,
				bbox: transformedBbox,
				width: width,
				height: height,
				bandCount: bandCount,
				rasters: rasters,
				filename: file.name,
				projectionInfo: projectionInfo
			};

			// Step 8) For imagery, create canvas immediately
			if (imageType === "imagery") {
				result.canvas = this.createImageCanvas(rasters, width, height, bandCount);
			}

			return result;
		} catch (error) {
			console.error("Error parsing GeoTIFF:", error);
			throw new Error("Failed to parse GeoTIFF: " + error.message);
		}
	}

	/**
	 * Create canvas from RGB/RGBA raster data
	 * @param {Array} rasters - Array of raster bands
	 * @param {number} width - Image width
	 * @param {number} height - Image height
	 * @param {number} bandCount - Number of bands
	 * @returns {HTMLCanvasElement} Canvas with rendered image
	 */
	createImageCanvas(rasters, width, height, bandCount) {
		// Step 1) Create canvas element
		var canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		var ctx = canvas.getContext("2d");

		// Step 2) Create ImageData
		var imageData = ctx.createImageData(width, height);
		var data = imageData.data;

		// Step 3) Convert raster data to RGBA
		for (var i = 0; i < width * height; i++) {
			var pixelIndex = i * 4;

			// RGB bands
			data[pixelIndex] = rasters[0][i]; // Red
			data[pixelIndex + 1] = rasters[1][i]; // Green
			data[pixelIndex + 2] = rasters[2][i]; // Blue
			data[pixelIndex + 3] = bandCount >= 4 ? rasters[3][i] : 255; // Alpha
		}

		// Step 4) Put image data on canvas
		ctx.putImageData(imageData, 0, 0);

		return canvas;
	}

	/**
	 * Helper: Interpolate elevation from raster data at world coordinates
	 * Used for querying elevation at arbitrary points
	 * @param {number} worldX - World X coordinate
	 * @param {number} worldY - World Y coordinate
	 * @param {Object} rasterSurface - Object with bbox, width, height, rasterData
	 * @returns {number|null} Interpolated elevation or null if outside bounds
	 */
	static interpolateZFromRaster(worldX, worldY, rasterSurface) {
		var bbox = rasterSurface.bbox;
		var width = rasterSurface.width;
		var height = rasterSurface.height;
		var elevationData = rasterSurface.rasterData;

		// Step 1) Check if point is within raster bounds
		if (worldX < bbox[0] || worldX > bbox[2] || worldY < bbox[1] || worldY > bbox[3]) {
			return null;
		}

		// Step 2) Convert world coordinates to pixel coordinates
		var pixelX = ((worldX - bbox[0]) / (bbox[2] - bbox[0])) * width;
		var pixelY = ((bbox[3] - worldY) / (bbox[3] - bbox[1])) * height; // Y is flipped

		// Step 3) Get integer pixel coordinates for bilinear interpolation
		var x1 = Math.floor(pixelX);
		var y1 = Math.floor(pixelY);
		var x2 = Math.min(x1 + 1, width - 1);
		var y2 = Math.min(y1 + 1, height - 1);

		// Step 4) Get the four surrounding elevation values
		var z11 = elevationData[y1 * width + x1];
		var z12 = elevationData[y2 * width + x1];
		var z21 = elevationData[y1 * width + x2];
		var z22 = elevationData[y2 * width + x2];

		// Step 5) Check for nodata values
		if (z11 === -9999 || z12 === -9999 || z21 === -9999 || z22 === -9999) {
			return null;
		}

		// Step 6) Bilinear interpolation
		var fx = pixelX - x1;
		var fy = pixelY - y1;

		var z1 = z11 * (1 - fx) + z21 * fx;
		var z2 = z12 * (1 - fx) + z22 * fx;
		var z = z1 * (1 - fy) + z2 * fy;

		return z;
	}
}

// Export parser class
export { IMGParser };
