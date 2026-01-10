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
			var filename = data.filename || ("geotiff_" + this.generateTimestamp());

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

			// Step 5) Use modern File System Access API if available
			if (window.showSaveFilePicker) {
				try {
					// Save .tif file
					var fileHandle = await window.showSaveFilePicker({
						suggestedName: tifFilename,
						types: [{
							description: 'GeoTIFF Files',
							accept: { 'image/tiff': ['.tif', '.tiff'] }
						}]
					});

					var writable = await fileHandle.createWritable();
					await writable.write(blob);
					await writable.close();

					console.log("Saved GeoTIFF: " + fileHandle.name);

					// Step 6) Save companion .prj file with exact matching name
					if (data.epsgCode) {
						// Extract the actual filename chosen by user (without extension)
						var actualFilename = fileHandle.name.replace(/\.(tif|tiff)$/i, "");
						console.log("Saving .prj file for: " + actualFilename);

						// Prompt user to save .prj in same directory with matching name
						await this.savePRJFile(actualFilename, data.epsgCode);
					}
				} catch (error) {
					if (error.name === 'AbortError') {
						console.log("Export cancelled by user");
						throw error;
					} else {
						console.error("Error saving file:", error);
						throw error;
					}
				}
			} else {
				// Fallback to automatic download
				this.downloadFile(blob, tifFilename);
				if (data.epsgCode) {
					this.createPRJFile(filename, data.epsgCode);
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
		// Step 1) Get image data from canvas
		var ctx = data.canvas.getContext("2d");
		var imageData = ctx.getImageData(0, 0, data.width, data.height);
		var pixels = imageData.data; // RGBA interleaved [R,G,B,A,R,G,B,A,...]

		// Step 2) Check if we have alpha channel (any pixel with alpha !== 255)
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
		for (var i = 0; i < totalPixels; i++) {
			var pixelIndex = i * 4; // Source is always RGBA
			var outputIndex = i * numBands; // Output is RGB or RGBA
			values[outputIndex] = pixels[pixelIndex]; // R
			values[outputIndex + 1] = pixels[pixelIndex + 1]; // G
			values[outputIndex + 2] = pixels[pixelIndex + 2]; // B
			if (hasAlpha) {
				values[outputIndex + 3] = pixels[pixelIndex + 3]; // A
			}
		}

		// Debug: Sample interleaved data
		console.log("Interleaved sample (first pixel): R=" + values[0] + " G=" + values[1] + " B=" + values[2]);
		var centerIdx = Math.floor(totalPixels / 2) * numBands;
		console.log("Interleaved sample (center pixel): R=" + values[centerIdx] + " G=" + values[centerIdx + 1] + " B=" + values[centerIdx + 2]);

		// Step 5) Create GeoTIFF metadata
		var metadata = this.createGeoTIFFMetadata(data, numBands);

		// Step 6) Let geotiff.js auto-detect RGB from samplesPerPixel
		// Don't set PhotometricInterpretation - let library handle it

		// Step 7) If we have alpha channel, mark it as unassociated alpha
		if (hasAlpha) {
			metadata.ExtraSamples = [0]; // 0 = Unassociated alpha (straight alpha)
		}

		console.log("GeoTIFF metadata:", JSON.stringify(metadata, null, 2));

		// Step 8) Write GeoTIFF with geotiff.js
		var arrayBuffer = await writeArrayBuffer(values, metadata);

		// Step 9) Inject GeoKeys with EPSG code if provided
		// This ensures QGIS/ArcGIS can read the CRS directly from the TIFF
		// without relying on the companion .prj file
		if (data.epsgCode) {
			console.log("Injecting EPSG:" + data.epsgCode + " into TIFF");
			arrayBuffer = this.injectGeoKeysIntoTIFF(arrayBuffer, parseInt(data.epsgCode));
		}

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
			values[i] = (elevation === -9999 || elevation === null || isNaN(elevation)) ? NaN : elevation;
		}

		// Step 3) Create GeoTIFF metadata for single band elevation
		var metadata = this.createGeoTIFFMetadata(data, 1);

		// Step 4) Add grayscale photometric interpretation
		metadata.PhotometricInterpretation = 1; // BlackIsZero (grayscale)

		// Step 5) Add nodata value if present
		metadata.GDAL_NODATA = "-9999";

		// Step 6) Write GeoTIFF
		var arrayBuffer = await writeArrayBuffer(values, metadata);

		// Step 7) Inject GeoKeys with EPSG code if provided
		if (data.epsgCode) {
			console.log("Injecting EPSG:" + data.epsgCode + " into elevation TIFF");
			arrayBuffer = this.injectGeoKeysIntoTIFF(arrayBuffer, parseInt(data.epsgCode));
		}

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

		// Step 2) Create ModelTiepoint
		// Ties pixel (0,0) to world coordinate (bbox[0], bbox[3])
		// Format: [I, J, K, X, Y, Z] where (I,J,K) is pixel coords, (X,Y,Z) is world coords
		var modelTiepoint = [
			0, 0, 0, // Top-left pixel (0,0,0)
			bbox[0], bbox[3], 0 // Top-left world coordinates (minX, maxY)
		];

		// Step 3) Create ModelPixelScale
		// IMPORTANT: Y scale must be NEGATIVE for north-up images
		// As we go DOWN in pixels (increasing J), we go DOWN in world Y (decreasing latitude/northing)
		var modelPixelScale = [
			pixelScaleX,
			-pixelScaleY, // NEGATIVE for north-up orientation
			0
		];

		// Step 4) Build metadata object
		// NOTE: Don't set samplesPerPixel - let geotiff.js infer it from BitsPerSample array length
		var metadata = {
			width: width,
			height: height,
			ModelTiepoint: modelTiepoint,
			ModelPixelScale: modelPixelScale
		};

		// Step 5) Do NOT add EPSG/GeoKey metadata - geotiff.js beta doesn't handle it properly
		// The .prj file provides all CRS information that QGIS/ArcGIS needs
		// Adding GeoKeys here causes QGIS to misread the CRS (e.g., showing 3857 instead of 32750)

		// Step 6) Add bits per sample (8-bit for RGB, 32-bit float for elevation)
		// This is safe - these are standard TIFF tags that work correctly
		if (numBands === 1) {
			// Elevation - use 32-bit float
			metadata.BitsPerSample = [32];
			metadata.SampleFormat = [3]; // IEEE floating point
		} else {
			// RGB/RGBA - use 8-bit per channel
			metadata.BitsPerSample = new Array(numBands).fill(8);
			metadata.SampleFormat = new Array(numBands).fill(1); // Unsigned integer
		}

		return metadata;
	}

	/**
	 * Inject GeoKeys into TIFF ArrayBuffer (workaround for geotiff.js beta limitations)
	 * @param {ArrayBuffer} arrayBuffer - Original TIFF ArrayBuffer
	 * @param {number} epsgCode - EPSG code to embed
	 * @returns {ArrayBuffer} Modified ArrayBuffer with GeoKeys
	 */
	injectGeoKeysIntoTIFF(arrayBuffer, epsgCode) {
		try {
			var view = new DataView(arrayBuffer);

			// Step 1) Check TIFF byte order
			var byteOrder = view.getUint16(0, false); // Big-endian read
			var littleEndian = byteOrder === 0x4949; // "II" = little-endian, "MM" = big-endian

			// Step 2) Read IFD offset
			var ifdOffset = view.getUint32(4, littleEndian);

			// Step 3) Read number of IFD entries
			var numEntries = view.getUint16(ifdOffset, littleEndian);

			console.log("TIFF: " + (littleEndian ? "Little" : "Big") + " endian, IFD offset: " + ifdOffset + ", entries: " + numEntries);

			// Step 4) Create GeoKey directory
			var isGeographic = (epsgCode >= 4000 && epsgCode <= 4999);
			var geoKeyDirectory = [
				1, 1, 0, 4, // Header: KeyDirectoryVersion=1, KeyRevision=1, MinorRevision=0, NumberOfKeys=4
				1024, 0, 1, 1, // GTModelTypeGeoKey = 1 (Projected) or 2 (Geographic)
				1025, 0, 1, 1, // GTRasterTypeGeoKey = 1 (RasterPixelIsArea)
				0, 0, 0, 0,    // Will be replaced with CRS key
				0, 0, 0, 0     // Will be replaced with CRS value
			];

			if (isGeographic) {
				geoKeyDirectory[8] = 2; // GTModelTypeGeoKey = 2 (Geographic)
				geoKeyDirectory[12] = 2048; // GeographicTypeGeoKey
				geoKeyDirectory[15] = epsgCode;
			} else {
				geoKeyDirectory[8] = 1; // GTModelTypeGeoKey = 1 (Projected)
				geoKeyDirectory[12] = 3072; // ProjectedCSTypeGeoKey
				geoKeyDirectory[15] = epsgCode;
			}

			// Step 5) Calculate positions and sizes
			var geoKeySize = geoKeyDirectory.length * 2; // uint16 array
			var originalSize = arrayBuffer.byteLength;
			var geoKeyDataOffset = originalSize; // Append GeoKey data at end
			var newSize = originalSize + (3 * 12) + geoKeySize; // Add space for 3 tags + data

			// Step 6) Create new ArrayBuffer
			var newBuffer = new ArrayBuffer(newSize);
			var newView = new DataView(newBuffer);
			var newArray = new Uint8Array(newBuffer);
			var originalArray = new Uint8Array(arrayBuffer);

			// Step 7) Copy entire original TIFF
			newArray.set(originalArray);

			// Step 8) Update IFD entry count
			newView.setUint16(ifdOffset, numEntries + 3, littleEndian);

			// Step 9) Find where to insert new IFD entries (after existing entries, before next IFD offset)
			var insertOffset = ifdOffset + 2 + (numEntries * 12);
			var nextIFDOffset = view.getUint32(insertOffset, littleEndian);

			// Step 10) Shift next IFD offset forward by 3*12 bytes (3 new entries)
			newView.setUint32(insertOffset + (3 * 12), nextIFDOffset, littleEndian);

			// Step 11) Add GeoKeyDirectoryTag (34735)
			newView.setUint16(insertOffset, 34735, littleEndian); // Tag
			newView.setUint16(insertOffset + 2, 3, littleEndian); // Type = SHORT
			newView.setUint32(insertOffset + 4, geoKeyDirectory.length, littleEndian); // Count
			newView.setUint32(insertOffset + 8, geoKeyDataOffset, littleEndian); // Offset to data

			// Step 12) Add GeoDoubleParamsTag (34736) - empty
			insertOffset += 12;
			newView.setUint16(insertOffset, 34736, littleEndian);
			newView.setUint16(insertOffset + 2, 12, littleEndian); // Type = DOUBLE
			newView.setUint32(insertOffset + 4, 0, littleEndian); // Count = 0
			newView.setUint32(insertOffset + 8, 0, littleEndian);

			// Step 13) Add GeoAsciiParamsTag (34737) - empty
			insertOffset += 12;
			newView.setUint16(insertOffset, 34737, littleEndian);
			newView.setUint16(insertOffset + 2, 2, littleEndian); // Type = ASCII
			newView.setUint32(insertOffset + 4, 0, littleEndian); // Count = 0
			newView.setUint32(insertOffset + 8, 0, littleEndian);

			// Step 14) Write GeoKey directory data at end of file
			for (var i = 0; i < geoKeyDirectory.length; i++) {
				newView.setUint16(geoKeyDataOffset + (i * 2), geoKeyDirectory[i], littleEndian);
			}

			console.log("Injected GeoKeys: EPSG:" + epsgCode + " (" + (isGeographic ? "Geographic" : "Projected") + ")");

			return newBuffer;
		} catch (error) {
			console.error("Error injecting GeoKeys:", error);
			return arrayBuffer; // Return original on error
		}
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
					types: [{
						description: 'Projection Files',
						accept: { 'text/plain': ['.prj'] }
					}]
				});

				var writable = await fileHandle.createWritable();
				await writable.write(blob);
				await writable.close();

				console.log("Saved .prj file for EPSG:" + epsgCode);
			} catch (error) {
				if (error.name !== 'AbortError') {
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
			"3857": 'PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],EXTENSION["PROJ4","+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs"],AUTHORITY["EPSG","3857"]]',
			"4326": 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',
			"4283": 'GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]]',
			// GDA94 MGA zones
			"28349": 'PROJCS["GDA94 / MGA zone 49",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",111],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28349"]]',
			"28350": 'PROJCS["GDA94 / MGA zone 50",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",117],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28350"]]',
			"28351": 'PROJCS["GDA94 / MGA zone 51",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",123],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28351"]]',
			"28352": 'PROJCS["GDA94 / MGA zone 52",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",129],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28352"]]',
			"28353": 'PROJCS["GDA94 / MGA zone 53",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",135],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28353"]]',
			"28354": 'PROJCS["GDA94 / MGA zone 54",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",141],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28354"]]',
			"28355": 'PROJCS["GDA94 / MGA zone 55",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",147],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28355"]]',
			"28356": 'PROJCS["GDA94 / MGA zone 56",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",153],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28356"]]',
			// WGS84 UTM zones (southern hemisphere) - commonly used
			"32749": 'PROJCS["WGS 84 / UTM zone 49S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",111],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32749"]]',
			"32750": 'PROJCS["WGS 84 / UTM zone 50S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",117],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32750"]]',
			"32751": 'PROJCS["WGS 84 / UTM zone 51S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",123],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32751"]]',
			"32752": 'PROJCS["WGS 84 / UTM zone 52S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",129],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32752"]]',
			"32753": 'PROJCS["WGS 84 / UTM zone 53S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",135],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32753"]]',
			"32754": 'PROJCS["WGS 84 / UTM zone 54S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",141],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32754"]]',
			"32755": 'PROJCS["WGS 84 / UTM zone 55S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",147],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32755"]]',
			"32756": 'PROJCS["WGS 84 / UTM zone 56S",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",153],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32756"]]',
			// GDA2020
			"7855": 'PROJCS["GDA2020 / MGA zone 55",GEOGCS["GDA2020",DATUM["Geocentric_Datum_of_Australia_2020",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","1168"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","7844"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",147],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","7855"]]'
		};

		return wktLookup[epsgCode] || null;
	}
}

// Export writer class
export { IMGWriter };
