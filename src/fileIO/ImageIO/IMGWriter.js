// src/fileIO/ImageIO/IMGWriter.js
//=============================================================
// GEOTIFF IMAGE WRITER
//=============================================================
// Step 1) Exports surfaces and imagery as GeoTIFF files
// Step 2) Supports elevation data and RGB/RGBA imagery
// Step 3) Uses geotiff.js writeArrayBuffer for proper GeoTIFF export
// Step 4) Created: 2026-01-09, Updated: 2026-01-09 with full GeoTIFF support

import BaseWriter from "../BaseWriter.js";
import { writeArrayBuffer } from "geotiff";
import proj4 from "proj4";

/**
 * Writer for GeoTIFF image files
 * Uses geotiff v2.1.4+ writeArrayBuffer for proper GeoTIFF export
 * Supports both RGB/RGBA imagery and single-band elevation data
 */
class IMGWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);
		this.exportType = options.exportType || "imagery"; // "imagery" or "elevation"
	}

	/**
	 * Write image data to GeoTIFF file
	 * @param {Object} data - Data to export
	 * @param {HTMLCanvasElement} data.canvas - Canvas for imagery export
	 * @param {Array} data.elevationData - Elevation grid for elevation export
	 * @param {Array} data.bbox - Bounding box [minX, minY, maxX, maxY]
	 * @param {number} data.width - Image width
	 * @param {number} data.height - Image height
	 * @param {string} data.filename - Output filename (without extension)
	 * @param {string} data.epsgCode - Optional EPSG code for projection
	 * @returns {Promise<Blob>} GeoTIFF file blob
	 */
	async write(data) {
		try {
			// Step 1) Validate input data
			if (!data.bbox || data.bbox.length !== 4) {
				throw new Error("Invalid bounding box");
			}

			if (!data.width || !data.height) {
				throw new Error("Width and height are required");
			}

			// Step 2) Determine export type
			var exportType = data.canvas ? "imagery" : "elevation";

			// Step 3) Export based on type
			var arrayBuffer;
			var filename = data.filename || "geotiff_" + this.generateTimestamp();

			if (exportType === "imagery") {
				arrayBuffer = await this.exportImageryAsGeoTIFF(data);
			} else {
				arrayBuffer = await this.exportElevationAsGeoTIFF(data);
			}

			// Step 4) Create blob
			var blob = this.createBlobFromBuffer(arrayBuffer, "image/tiff");

			// Remove extension if present and add .tif
			filename = filename.replace(/\.(tif|tiff|png|jpg)$/i, "");
			var tifFilename = filename + ".tif";
			var prjFilename = filename + ".prj";

			// Step 5) Use directory handle if provided, otherwise auto-download
			if (data.directoryHandle) {
				try {
					// Save .tif file to selected directory
					var tifFileHandle = await data.directoryHandle.getFileHandle(tifFilename, { create: true });
					var writable = await tifFileHandle.createWritable();
					await writable.write(blob);
					await writable.close();
					console.log("Saved GeoTIFF to directory:", tifFilename);

					// Step 6) Optionally save companion .prj file (backup - CRS already embedded in TIFF)
					if (data.epsgCode) {
						var wkt = this.getWKTForEPSG(data.epsgCode);
						if (wkt) {
							var prjBlob = new Blob([wkt], { type: "text/plain" });
							var prjFileHandle = await data.directoryHandle.getFileHandle(prjFilename, { create: true });
							var prjWritable = await prjFileHandle.createWritable();
							await prjWritable.write(prjBlob);
							await prjWritable.close();
							console.log("Saved .prj file (optional backup):", prjFilename);
						}
					}
				} catch (error) {
					if (error.name === "AbortError") {
						console.log("Export cancelled by user");
						throw error;
					} else {
						console.error("Error saving to directory:", error);
						throw error;
					}
				}
			} else {
				// Fallback to automatic download if no directory handle
				this.downloadFile(blob, tifFilename);
				console.log("Downloaded GeoTIFF: " + tifFilename);

				// Optionally download .prj file (backup - CRS already embedded in TIFF)
				if (data.epsgCode) {
					var wkt = this.getWKTForEPSG(data.epsgCode);
					if (wkt) {
						var prjBlob = new Blob([wkt], { type: "text/plain" });
						this.downloadFile(prjBlob, prjFilename);
						console.log("Downloaded .prj file (optional backup): " + prjFilename);
					}
				}
			}

			return blob;
		} catch (error) {
			console.error("Error writing GeoTIFF:", error);
			throw new Error("Failed to write GeoTIFF: " + error.message);
		}
	}

	/**
	 * Export imagery as GeoTIFF (RGB or RGBA)
	 * @param {Object} data - Image data with canvas
	 * @returns {Promise<ArrayBuffer>} GeoTIFF array buffer
	 */
	async exportImageryAsGeoTIFF(data) {
		// Step 1) Verify canvas is valid
		console.log("IMGWriter received canvas: " + data.canvas.width + "x" + data.canvas.height);
		console.log("IMGWriter data dimensions: " + data.width + "x" + data.height);

		// Step 2) Get image data from canvas
		var ctx = data.canvas.getContext("2d");
		var imageData = ctx.getImageData(0, 0, data.width, data.height);
		var pixels = imageData.data; // RGBA interleaved [R,G,B,A,R,G,B,A,...]

		// Step 2a) Check canvas center for debugging
		var centerX = Math.floor(data.width / 2);
		var centerY = Math.floor(data.height / 2);
		var centerCheck = ctx.getImageData(centerX, centerY, 1, 1).data;
		console.log("Canvas center pixel in IMGWriter: R=" + centerCheck[0] + " G=" + centerCheck[1] + " B=" + centerCheck[2] + " A=" + centerCheck[3]);

		// Step 2b) Check the full imageData array directly
		var centerPixelIndex = (centerY * data.width + centerX) * 4;
		console.log("ImageData center pixel (from array): R=" + pixels[centerPixelIndex] + " G=" + pixels[centerPixelIndex + 1] + " B=" + pixels[centerPixelIndex + 2] + " A=" + pixels[centerPixelIndex + 3]);
		console.log("ImageData first pixel: R=" + pixels[0] + " G=" + pixels[1] + " B=" + pixels[2] + " A=" + pixels[3]);
		console.log("ImageData total length: " + pixels.length + " (expected: " + (data.width * data.height * 4) + ")");

		// Step 2c) Check if we have alpha channel (any pixel with alpha !== 255)
		var hasAlpha = false;
		for (var i = 3; i < pixels.length; i += 4) {
			if (pixels[i] !== 255) {
				hasAlpha = true;
				break;
			}
		}

		console.log("Exporting as " + (hasAlpha ? "RGBA (4 bands)" : "RGB (3 bands)"));

		// Step 3) Keep data in interleaved format (RGBRGBRGB... or RGBARGBA...)
		var totalPixels = data.width * data.height;
		var numBands = hasAlpha ? 4 : 3;
		var values = new Uint8Array(totalPixels * numBands);

		// Step 4) Extract RGB or RGBA in interleaved format (chunky)
		console.log("Starting extraction loop: totalPixels=" + totalPixels + ", numBands=" + numBands);
		console.log("Values array size: " + values.length + " (expected: " + (totalPixels * numBands) + ")");

		for (var i = 0; i < totalPixels; i++) {
			var pixelIndex = i * 4; // Source is always RGBA
			var outputIndex = i * numBands; // Output is RGB or RGBA
			values[outputIndex] = pixels[pixelIndex]; // R
			values[outputIndex + 1] = pixels[pixelIndex + 1]; // G
			values[outputIndex + 2] = pixels[pixelIndex + 2]; // B
			if (hasAlpha) {
				values[outputIndex + 3] = pixels[pixelIndex + 3]; // A
			}

			// Debug first colored pixel
			if (i < 1000 && (pixels[pixelIndex] !== 0 || pixels[pixelIndex + 1] !== 0 || pixels[pixelIndex + 2] !== 0)) {
				console.log("Found colored pixel at i=" + i + ": pixels[" + pixelIndex + "]=" + pixels[pixelIndex] + " → values[" + outputIndex + "]=" + values[outputIndex]);
			}
		}

		console.log("Extraction loop complete");

		// Debug: Sample interleaved data
		console.log("Interleaved sample (first pixel): R=" + values[0] + " G=" + values[1] + " B=" + values[2] + " A=" + values[3]);
		var centerPixel = Math.floor(totalPixels / 2);
		var centerIdx = centerPixel * numBands;
		console.log("Center pixel #" + centerPixel + " → values[" + centerIdx + "]: R=" + values[centerIdx] + " G=" + values[centerIdx + 1] + " B=" + values[centerIdx + 2] + " A=" + values[centerIdx + 3]);

		// Also check what we verified earlier from pixels array
		var centerPixelInPixels = centerPixel * 4;
		console.log("For comparison, pixels[" + centerPixelInPixels + "]: R=" + pixels[centerPixelInPixels] + " G=" + pixels[centerPixelInPixels + 1] + " B=" + pixels[centerPixelInPixels + 2] + " A=" + pixels[centerPixelInPixels + 3]);

		// Step 5) Create GeoTIFF metadata
		var metadata = this.createGeoTIFFMetadata(data, numBands);

		// Step 6) Set PhotometricInterpretation explicitly for RGB/RGBA
		if (numBands >= 3) {
			metadata.PhotometricInterpretation = 2; // RGB
		}

		// Step 7) If we have alpha channel, mark it properly for QGIS
		if (hasAlpha) {
			metadata.ExtraSamples = [0]; // 0 = Unassociated alpha (straight alpha)
			metadata.SamplesPerPixel = [4]; // Explicitly tell it we have 4 samples per pixel
			console.log("Alpha channel enabled: 4 bands (RGBA) with unassociated alpha");
		}

		console.log("GeoTIFF metadata:", JSON.stringify(metadata, null, 2));

		// Step 8) Write GeoTIFF with geotiff.js
		// geotiff.js automatically writes GeoKeyDirectory based on the metadata GeoKeys we set above
		var arrayBuffer = await writeArrayBuffer(values, metadata);

		console.log("Generated valid TIFF: " + arrayBuffer.byteLength + " bytes");
		return arrayBuffer;
	}

	/**
	 * Export elevation as GeoTIFF (single band)
	 * @param {Object} data - Elevation data
	 * @returns {Promise<ArrayBuffer>} GeoTIFF array buffer
	 */
	async exportElevationAsGeoTIFF(data) {
		// Step 1) Get elevation data
		var elevationData = data.elevationData || data.rasters[0];

		if (!elevationData) {
			throw new Error("No elevation data provided");
		}

		// Step 2) Convert to Float32Array (elevation values can be negative/decimal)
		var values = new Float32Array(data.width * data.height);

		for (var i = 0; i < elevationData.length; i++) {
			var elevation = elevationData[i];
			// Handle nodata values (-9999 becomes NaN for proper GeoTIFF nodata)
			values[i] = elevation === -9999 || elevation === null || isNaN(elevation) ? NaN : elevation;
		}

		// Step 3) Create GeoTIFF metadata for single band elevation
		var metadata = this.createGeoTIFFMetadata(data, 1);

		// Step 4) Add grayscale photometric interpretation
		metadata.PhotometricInterpretation = 1; // BlackIsZero (grayscale)

		// Step 5) Add nodata value if present
		metadata.GDAL_NODATA = "-9999";

		// Step 6) Write GeoTIFF
		// geotiff.js automatically writes GeoKeyDirectory based on metadata
		var arrayBuffer = await writeArrayBuffer(values, metadata);

		console.log("Generated valid elevation TIFF: " + arrayBuffer.byteLength + " bytes");
		return arrayBuffer;
	}

	/**
	 * Create GeoTIFF metadata structure
	 * @param {Object} data - Input data with bbox, width, height
	 * @param {number} numBands - Number of bands (1 for elevation, 3/4 for imagery)
	 * @returns {Object} GeoTIFF metadata
	 */
	createGeoTIFFMetadata(data, numBands) {
		var bbox = data.bbox;
		var width = data.width;
		var height = data.height;

		// Step 1) Calculate pixel scale (world units per pixel)
		var pixelScaleX = (bbox[2] - bbox[0]) / width;
		var pixelScaleY = (bbox[3] - bbox[1]) / height;

		// Step 2) Create ModelTiepoint (ties pixel 0,0 to world coordinate minX, maxY)
		// Format: [I, J, K, X, Y, Z] where (I,J,K) is pixel coords, (X,Y,Z) is world coords
		var modelTiepoint = [
			0,
			0,
			0, // Top-left pixel (0,0,0)
			bbox[0],
			bbox[3],
			0 // Top-left world coordinates (minX, maxY, 0)
		];

		// Step 3) Create ModelPixelScale (pixel size in world units)
		// IMPORTANT: Y scale must be POSITIVE (not negative) - the tiepoint handles the flip
		var modelPixelScale = [
			pixelScaleX, // X scale (meters per pixel)
			pixelScaleY, // Y scale (meters per pixel) - POSITIVE
			0 // Z scale (unused for 2D)
		];

		console.log("CRITICAL - BBox input: minX=" + bbox[0] + ", minY=" + bbox[1] + ", maxX=" + bbox[2] + ", maxY=" + bbox[3]);
		console.log("CRITICAL - ModelTiepoint: pixel(0,0) → world(" + bbox[0] + ", " + bbox[3] + ")");
		console.log("CRITICAL - ModelPixelScale: " + pixelScaleX + " × " + pixelScaleY + " meters/pixel");

		// Step 4) Build metadata object
		var metadata = {
			width: width,
			height: height,
			ModelTiepoint: modelTiepoint,
			ModelPixelScale: modelPixelScale
		};

		// Step 5) Add EPSG code if provided (geotiff.js will write GeoKeyDirectory automatically!)
		// ProjectedCSTypeGeoKey tells geotiff.js this is a projected CRS (meters/feet), not geographic (degrees)
		if (data.epsgCode) {
			var epsgCode = parseInt(data.epsgCode);
			var isGeographic = epsgCode >= 4000 && epsgCode <= 4999;

			if (isGeographic) {
				metadata.GeographicTypeGeoKey = epsgCode;
				metadata.GTModelTypeGeoKey = 2; // Geographic
			} else {
				metadata.ProjectedCSTypeGeoKey = epsgCode;
				metadata.GTModelTypeGeoKey = 1; // Projected
			}
			console.log("Set CRS to EPSG:" + epsgCode + " (" + (isGeographic ? "Geographic" : "Projected") + ")");
		}

		// Step 6) Add bits per sample (8-bit for RGB, 32-bit float for elevation)
		if (numBands === 1) {
			// Elevation - use 32-bit float
			metadata.BitsPerSample = [32];
			metadata.SampleFormat = [3]; // IEEE floating point
		} else {
			// RGB/RGBA - use 8-bit per channel
			metadata.BitsPerSample = new Array(numBands).fill(8);
			metadata.SampleFormat = new Array(numBands).fill(1); // Unsigned integer
			metadata.PlanarConfiguration = 1; // Chunky/interleaved format (RGBRGBRGB...)
		}

		return metadata;
	}

	/**
	 * Save a .prj file with WKT projection using File System Access API
	 * @param {string} filename - Base filename (without extension)
	 * @param {string} epsgCode - EPSG code
	 */
	async savePRJFile(filename, epsgCode) {
		try {
			// Get WKT string for EPSG code
			var wkt = this.getWKTForEPSG(epsgCode);
			if (!wkt) {
				console.warn("No WKT available for EPSG:" + epsgCode);
				return;
			}

			// Create blob
			var blob = new Blob([wkt], { type: "text/plain" });

			// Save using file picker
			try {
				var fileHandle = await window.showSaveFilePicker({
					suggestedName: filename + ".prj",
					types: [
						{
							description: "Projection Files",
							accept: { "text/plain": [".prj"] }
						}
					]
				});

				var writable = await fileHandle.createWritable();
				await writable.write(blob);
				await writable.close();

				console.log("Saved .prj file for EPSG:" + epsgCode);
			} catch (error) {
				if (error.name !== "AbortError") {
					console.warn("Could not save .prj file:", error);
				}
			}
		} catch (error) {
			console.error("Error creating .prj file:", error);
		}
	}

	/**
	 * Create a .prj file with WKT projection (fallback for older browsers)
	 * @param {string} filename - Base filename (without extension)
	 * @param {string} epsgCode - EPSG code
	 */
	createPRJFile(filename, epsgCode) {
		try {
			// Get WKT string for EPSG code
			var wkt = this.getWKTForEPSG(epsgCode);
			if (!wkt) {
				console.warn("No WKT available for EPSG:" + epsgCode);
				return;
			}

			// Create blob and download
			var blob = new Blob([wkt], { type: "text/plain" });
			this.downloadFile(blob, filename + ".prj");
			console.log("Created .prj file for EPSG:" + epsgCode);
		} catch (error) {
			console.error("Error creating .prj file:", error);
		}
	}

	/**
	 * Get WKT (Well-Known Text) for common EPSG codes
	 * @param {string} epsgCode - EPSG code
	 * @returns {string|null} WKT string or null
	 */
	getWKTForEPSG(epsgCode) {
		// Common EPSG codes used in Australian mining
		var wktLookup = {
			"3857":
				'PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],EXTENSION["PROJ4","+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs"],AUTHORITY["EPSG","3857"]]',
			"4326": 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',
			"4283": 'GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]]',
			// GDA94 MGA zones
			"28349":
				'PROJCS["GDA94 / MGA zone 49",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",111],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28349"]]',
			"28350":
				'PROJCS["GDA94 / MGA zone 50",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",117],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28350"]]',
			"28351":
				'PROJCS["GDA94 / MGA zone 51",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",123],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28351"]]',
			"28352":
				'PROJCS["GDA94 / MGA zone 52",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",129],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28352"]]',
			"28353":
				'PROJCS["GDA94 / MGA zone 53",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",135],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28353"]]',
			"28354":
				'PROJCS["GDA94 / MGA zone 54",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",141],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28354"]]',
			"28355":
				'PROJCS["GDA94 / MGA zone 55",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",147],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28355"]]',
			"28356":
				'PROJCS["GDA94 / MGA zone 56",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",153],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28356"]]',
			// WGS84 UTM zones (southern hemisphere) - commonly used
			"32749":
				'PROJCS["WGS 84 / UTM zone 49S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",111],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32749"]]',
			"32750":
				'PROJCS["WGS 84 / UTM zone 50S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",117],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32750"]]',
			"32751":
				'PROJCS["WGS 84 / UTM zone 51S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",123],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32751"]]',
			"32752":
				'PROJCS["WGS 84 / UTM zone 52S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",129],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32752"]]',
			"32753":
				'PROJCS["WGS 84 / UTM zone 53S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",135],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32753"]]',
			"32754":
				'PROJCS["WGS 84 / UTM zone 54S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",141],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32754"]]',
			"32755":
				'PROJCS["WGS 84 / UTM zone 55S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",147],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32755"]]',
			"32756":
				'PROJCS["WGS 84 / UTM zone 56S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",153],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32756"]]',
			// GDA2020
			"7855":
				'PROJCS["GDA2020 / MGA zone 55",GEOGCS["GDA2020",DATUM["Geocentric_Datum_of_Australia_2020",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","1168"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","7844"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",147],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","7855"]]'
		};

		return wktLookup[epsgCode] || null;
	}

	/**
	 * Inject GeoKeys into TIFF ArrayBuffer
	 * Embeds EPSG code directly in TIFF file without needing .prj file
	 * @param {ArrayBuffer} arrayBuffer - Original TIFF ArrayBuffer from geotiff.js
	 * @param {number} epsgCode - EPSG code to embed (e.g., 32750 for UTM Zone 50S)
	 * @returns {ArrayBuffer} Modified ArrayBuffer with GeoKeys embedded
	 */
	injectGeoKeysIntoTIFF(arrayBuffer, epsgCode) {
		try {
			var view = new DataView(arrayBuffer);

			// Step 1) Check TIFF byte order
			var byteOrder = view.getUint16(0, false); // Big-endian read
			var littleEndian = byteOrder === 0x4949; // "II" = little-endian, "MM" = big-endian

			// Step 2) Read IFD offset (Image File Directory)
			var ifdOffset = view.getUint32(4, littleEndian);

			// Step 3) Read number of IFD entries
			var numEntries = view.getUint16(ifdOffset, littleEndian);

			console.log("TIFF: " + (littleEndian ? "Little" : "Big") + " endian, IFD offset: " + ifdOffset + ", entries: " + numEntries);

			// Step 4) Create GeoKey directory
			// Determine if geographic (lat/lon) or projected (meters)
			var isGeographic = epsgCode >= 4000 && epsgCode <= 4999;

			// GeoKey directory format: [header, key1, key2, key3, ...]
			// Each key: [KeyID, TIFFTagLocation, Count, Value_Offset]
			var geoKeyDirectory = [
				1,
				1,
				0,
				4, // Header: KeyDirectoryVersion=1, KeyRevision=1, MinorRevision=0, NumberOfKeys=4
				1024,
				0,
				1,
				isGeographic ? 2 : 1, // GTModelTypeGeoKey: 1=Projected, 2=Geographic
				1025,
				0,
				1,
				1, // GTRasterTypeGeoKey: 1=RasterPixelIsArea
				isGeographic ? 2048 : 3072,
				0,
				1,
				epsgCode, // GeographicTypeGeoKey or ProjectedCSTypeGeoKey
				0,
				0,
				0,
				0 // End marker
			];

			// Adjust key count (4 keys in header)
			geoKeyDirectory[3] = 3; // Actually 3 keys (GTModelTypeGeoKey, GTRasterTypeGeoKey, CRS key)

			// Fix key format - should be 4 values per key
			geoKeyDirectory = [
				1,
				1,
				0,
				3, // Header: 3 keys
				1024,
				0,
				1,
				isGeographic ? 2 : 1, // Key 1: GTModelTypeGeoKey
				1025,
				0,
				1,
				1, // Key 2: GTRasterTypeGeoKey
				isGeographic ? 2048 : 3072,
				0,
				1,
				epsgCode // Key 3: CRS type key with EPSG code
			];

			// Step 5) Calculate positions and sizes
			var geoKeySize = geoKeyDirectory.length * 2; // uint16 array -> 2 bytes per value
			var originalSize = arrayBuffer.byteLength;
			var geoKeyDataOffset = originalSize; // Append GeoKey data at end
			var newSize = originalSize + 3 * 12 + geoKeySize; // Add 3 IFD entries (12 bytes each) + GeoKey data

			// Step 6) Create new ArrayBuffer with extra space
			var newBuffer = new ArrayBuffer(newSize);
			var newView = new DataView(newBuffer);
			var newArray = new Uint8Array(newBuffer);
			var originalArray = new Uint8Array(arrayBuffer);

			// Step 7) Copy entire original TIFF
			newArray.set(originalArray);

			// Step 8) Update IFD entry count (add 3 new tags)
			newView.setUint16(ifdOffset, numEntries + 3, littleEndian);

			// Step 9) Find insertion point for new IFD entries
			var insertOffset = ifdOffset + 2 + numEntries * 12; // After existing entries
			var nextIFDOffset = view.getUint32(insertOffset, littleEndian); // Read next IFD pointer

			// Step 10) Shift next IFD pointer forward by 3*12 bytes
			newView.setUint32(insertOffset + 3 * 12, nextIFDOffset, littleEndian);

			// Step 11) Write GeoKeyDirectoryTag (34735)
			newView.setUint16(insertOffset, 34735, littleEndian); // Tag
			newView.setUint16(insertOffset + 2, 3, littleEndian); // Type = SHORT
			newView.setUint32(insertOffset + 4, geoKeyDirectory.length, littleEndian); // Count
			newView.setUint32(insertOffset + 8, geoKeyDataOffset, littleEndian); // Offset

			// Step 12) Write GeoDoubleParamsTag (34736) - empty
			insertOffset += 12;
			newView.setUint16(insertOffset, 34736, littleEndian); // Tag
			newView.setUint16(insertOffset + 2, 12, littleEndian); // Type = DOUBLE
			newView.setUint32(insertOffset + 4, 0, littleEndian); // Count = 0
			newView.setUint32(insertOffset + 8, 0, littleEndian); // Offset = 0

			// Step 13) Write GeoAsciiParamsTag (34737) - empty
			insertOffset += 12;
			newView.setUint16(insertOffset, 34737, littleEndian); // Tag
			newView.setUint16(insertOffset + 2, 2, littleEndian); // Type = ASCII
			newView.setUint32(insertOffset + 4, 0, littleEndian); // Count = 0
			newView.setUint32(insertOffset + 8, 0, littleEndian); // Offset = 0

			// Step 14) Write GeoKey directory data at end of file
			for (var i = 0; i < geoKeyDirectory.length; i++) {
				newView.setUint16(geoKeyDataOffset + i * 2, geoKeyDirectory[i], littleEndian);
			}

			console.log("SUCCESS: Injected GeoKeys for EPSG:" + epsgCode + " (" + (isGeographic ? "Geographic" : "Projected") + ")");
			console.log("  TIFF size: " + originalSize + " → " + newSize + " bytes (+" + (newSize - originalSize) + ")");

			return newBuffer;
		} catch (error) {
			console.error("ERROR: Failed to inject GeoKeys:", error);
			console.error("  Returning original TIFF without CRS tags");
			return arrayBuffer; // Return original on error
		}
	}
}

// Export writer class
export { IMGWriter };
