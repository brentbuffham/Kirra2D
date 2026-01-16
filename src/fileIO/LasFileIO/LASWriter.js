// src/fileIO/LASIO/LASWriter.js
//=============================================================
// LAS FILE WRITER
//=============================================================
// Step 1) Writes ASPRS LAS (LiDAR) binary format files
// Step 2) Supports LAS versions 1.2, 1.3, and 1.4
// Step 3) Supports Point Data Record Formats 0, 1, 2, 3, 6, 7, 8
// Step 4) Created: 2026-01-16
// Step 5) Reference: ASPRS LAS Specification 1.4-R15

import BaseWriter from "../BaseWriter.js";

// Step 6) Point Data Record sizes by format
const POINT_RECORD_SIZES = {
	0: 20, // Core: X, Y, Z, Intensity, Return info, Classification, ScanAngle, UserData, PointSourceID
	1: 28, // Format 0 + GPS Time
	2: 26, // Format 0 + RGB
	3: 34, // Format 0 + GPS Time + RGB
	6: 30, // New base format (LAS 1.4): Extended return/class + GPS Time
	7: 36, // Format 6 + RGB
	8: 38 // Format 6 + RGB + NIR
};

// Step 7) Header sizes by version
const HEADER_SIZES = {
	"1.2": 227,
	"1.3": 235,
	"1.4": 375
};

// Step 8) VLR Header size
const VLR_HEADER_SIZE = 54;

// Step 9) LASWriter class
class LASWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);
		this.littleEndian = true; // LAS is always little-endian

		// Default options
		this.version = options.version || "1.2";
		this.pointFormat = options.pointFormat !== undefined ? options.pointFormat : 0;
		this.systemIdentifier = options.systemIdentifier || "Kirra2D";
		this.generatingSoftware = options.generatingSoftware || "Kirra2D LASWriter";
	}

	// Step 10) Main write method
	async write(data) {
		// Step 11) Validate input data
		if (!data) {
			throw new Error("Invalid data: No data provided");
		}

		// Step 12) Extract points from various input formats
		var points = this.extractPoints(data);

		if (!points || points.length === 0) {
			throw new Error("No points to export");
		}

		console.log("Exporting " + points.length + " points to LAS format");

		// Step 13) Calculate bounds and statistics
		var stats = this.calculateBounds(points);

		// Step 14) Determine optimal scale and offset
		var scaleOffset = this.calculateScaleOffset(stats);

		// Step 15) Build the LAS file
		var lasBuffer = this.buildLASFile(points, stats, scaleOffset);

		// Step 16) Create blob
		var blob = new Blob([lasBuffer], { type: "application/octet-stream" });

		// Step 17) Generate filename
		var timestamp = this.generateTimestamp();
		var filename = "LAS_EXPORT_" + timestamp + ".las";

		// Step 18) Return file data
		return {
			lasFile: blob,
			filename: filename,
			pointCount: points.length,
			bounds: stats
		};
	}

	// Step 19) Extract points from various input formats
	extractPoints(data) {
		var points = [];

		// If data is already an array of points
		if (Array.isArray(data)) {
			return this.normalizePoints(data);
		}

		// If data has a points array
		if (data.points && Array.isArray(data.points)) {
			return this.normalizePoints(data.points);
		}

		// If data has kadDrawingsMap (Kirra format)
		if (data.kadDrawingsMap) {
			for (var [entityName, entityData] of data.kadDrawingsMap.entries()) {
				if (entityData && entityData.data && Array.isArray(entityData.data)) {
					for (var i = 0; i < entityData.data.length; i++) {
						var item = entityData.data[i];
						// Convert KAD point to LAS point
						var point = {
							x: item.pointXLocation,
							y: item.pointYLocation,
							z: item.pointZLocation,
							intensity: item.intensity || 0,
							classification: item.classification || 1, // Unclassified
							returnNumber: item.returnNumber || 1,
							numberOfReturns: item.numberOfReturns || 1,
							scanDirectionFlag: 0,
							edgeOfFlightLine: 0,
							scanAngleRank: 0,
							userData: 0,
							pointSourceID: item.pointSourceID || 0,
							gpsTime: item.gpsTime || 0,
							red: 0,
							green: 0,
							blue: 0
						};

						// Parse color if available
						if (item.color) {
							var rgb = this.hexToRgb16(item.color);
							point.red = rgb.r;
							point.green = rgb.g;
							point.blue = rgb.b;
						}

						points.push(point);
					}
				}
			}
			return points;
		}

		throw new Error("Unrecognized data format");
	}

	// Step 20) Normalize points to consistent format
	normalizePoints(inputPoints) {
		var points = [];

		for (var i = 0; i < inputPoints.length; i++) {
			var p = inputPoints[i];
			var point = {
				x: p.x !== undefined ? p.x : p.pointXLocation || 0,
				y: p.y !== undefined ? p.y : p.pointYLocation || 0,
				z: p.z !== undefined ? p.z : p.pointZLocation || 0,
				intensity: p.intensity || 0,
				classification: p.classification || 1,
				returnNumber: p.returnNumber || 1,
				numberOfReturns: p.numberOfReturns || 1,
				scanDirectionFlag: p.scanDirectionFlag || 0,
				edgeOfFlightLine: p.edgeOfFlightLine || 0,
				scanAngleRank: p.scanAngleRank || p.scanAngle || 0,
				userData: p.userData || 0,
				pointSourceID: p.pointSourceID || 0,
				gpsTime: p.gpsTime || 0,
				red: p.red || 0,
				green: p.green || 0,
				blue: p.blue || 0,
				nir: p.nir || 0
			};

			// Parse color if available
			if (p.color && !p.red) {
				var rgb = this.hexToRgb16(p.color);
				point.red = rgb.r;
				point.green = rgb.g;
				point.blue = rgb.b;
			}

			points.push(point);
		}

		return points;
	}

	// Step 21) Calculate bounds from points
	calculateBounds(points) {
		var minX = Infinity,
			maxX = -Infinity;
		var minY = Infinity,
			maxY = -Infinity;
		var minZ = Infinity,
			maxZ = -Infinity;

		var returnCounts = [0, 0, 0, 0, 0];

		for (var i = 0; i < points.length; i++) {
			var p = points[i];
			minX = Math.min(minX, p.x);
			maxX = Math.max(maxX, p.x);
			minY = Math.min(minY, p.y);
			maxY = Math.max(maxY, p.y);
			minZ = Math.min(minZ, p.z);
			maxZ = Math.max(maxZ, p.z);

			// Count returns (1-indexed, array is 0-indexed)
			var returnIdx = Math.min(Math.max(p.returnNumber - 1, 0), 4);
			returnCounts[returnIdx]++;
		}

		return {
			minX: minX,
			maxX: maxX,
			minY: minY,
			maxY: maxY,
			minZ: minZ,
			maxZ: maxZ,
			returnCounts: returnCounts
		};
	}

	// Step 22) Calculate scale and offset for coordinate storage
	calculateScaleOffset(stats) {
		// Use center of bounds as offset
		var xOffset = (stats.minX + stats.maxX) / 2;
		var yOffset = (stats.minY + stats.maxY) / 2;
		var zOffset = (stats.minZ + stats.maxZ) / 2;

		// Default scale factor for millimeter precision
		var scaleFactor = 0.001;

		// Check if scale factor is appropriate for the data range
		var xRange = stats.maxX - stats.minX;
		var yRange = stats.maxY - stats.minY;
		var zRange = stats.maxZ - stats.minZ;
		var maxRange = Math.max(xRange, yRange, zRange);

		// Adjust scale if range is too large for 32-bit integers
		// Max int32 is ~2.1 billion, so max range at 0.001 scale is ~2.1 million
		while (maxRange / scaleFactor > 2000000000) {
			scaleFactor *= 10;
		}

		// Adjust scale if range is too small
		while (maxRange / scaleFactor < 1000 && scaleFactor > 0.0000001) {
			scaleFactor /= 10;
		}

		return {
			xScale: scaleFactor,
			yScale: scaleFactor,
			zScale: scaleFactor,
			xOffset: xOffset,
			yOffset: yOffset,
			zOffset: zOffset
		};
	}

	// Step 23) Build the complete LAS file
	buildLASFile(points, stats, scaleOffset) {
		var version = this.version;
		var pointFormat = this.pointFormat;

		// Validate version and format compatibility
		if (version === "1.2" && pointFormat > 3) {
			console.warn("Point format " + pointFormat + " not supported in LAS 1.2, using format 0");
			pointFormat = 0;
		}
		if (version !== "1.4" && pointFormat >= 6) {
			console.warn("Point format " + pointFormat + " requires LAS 1.4, upgrading version");
			version = "1.4";
		}

		var headerSize = HEADER_SIZES[version];
		var pointRecordLength = POINT_RECORD_SIZES[pointFormat];
		var numPoints = points.length;

		// Calculate file size
		var offsetToPointData = headerSize; // No VLRs for now
		var totalSize = offsetToPointData + numPoints * pointRecordLength;

		// Create buffer
		var buffer = new ArrayBuffer(totalSize);
		var dataView = new DataView(buffer);
		var offset = 0;

		// Step 24) Write Public Header Block
		offset = this.writePublicHeader(dataView, offset, {
			version: version,
			pointFormat: pointFormat,
			pointRecordLength: pointRecordLength,
			headerSize: headerSize,
			offsetToPointData: offsetToPointData,
			numPoints: numPoints,
			stats: stats,
			scaleOffset: scaleOffset
		});

		// Step 25) Write Point Data Records
		for (var i = 0; i < numPoints; i++) {
			offset = this.writePointRecord(dataView, offset, points[i], pointFormat, scaleOffset);
		}

		return buffer;
	}

	// Step 26) Write Public Header Block
	writePublicHeader(dataView, offset, config) {
		var version = config.version;
		var versionParts = version.split(".");
		var versionMajor = parseInt(versionParts[0]);
		var versionMinor = parseInt(versionParts[1]);

		// File Signature - 4 bytes
		this.writeString(dataView, offset, "LASF", 4);
		offset += 4;

		// File Source ID - 2 bytes
		dataView.setUint16(offset, 0, this.littleEndian);
		offset += 2;

		// Global Encoding - 2 bytes
		var globalEncoding = 0;
		if (config.pointFormat === 1 || config.pointFormat >= 3) {
			globalEncoding |= 0x01; // GPS Time Type: GPS Week Time
		}
		dataView.setUint16(offset, globalEncoding, this.littleEndian);
		offset += 2;

		// Project ID (GUID) - 16 bytes
		for (var i = 0; i < 16; i++) {
			dataView.setUint8(offset + i, 0);
		}
		offset += 16;

		// Version Major - 1 byte
		dataView.setUint8(offset, versionMajor);
		offset += 1;

		// Version Minor - 1 byte
		dataView.setUint8(offset, versionMinor);
		offset += 1;

		// System Identifier - 32 bytes
		this.writeString(dataView, offset, this.systemIdentifier, 32);
		offset += 32;

		// Generating Software - 32 bytes
		this.writeString(dataView, offset, this.generatingSoftware, 32);
		offset += 32;

		// File Creation Day of Year - 2 bytes
		var now = new Date();
		var startOfYear = new Date(now.getFullYear(), 0, 0);
		var dayOfYear = Math.floor((now - startOfYear) / 86400000);
		dataView.setUint16(offset, dayOfYear, this.littleEndian);
		offset += 2;

		// File Creation Year - 2 bytes
		dataView.setUint16(offset, now.getFullYear(), this.littleEndian);
		offset += 2;

		// Header Size - 2 bytes
		dataView.setUint16(offset, config.headerSize, this.littleEndian);
		offset += 2;

		// Offset to Point Data - 4 bytes
		dataView.setUint32(offset, config.offsetToPointData, this.littleEndian);
		offset += 4;

		// Number of Variable Length Records - 4 bytes
		dataView.setUint32(offset, 0, this.littleEndian); // No VLRs
		offset += 4;

		// Point Data Record Format - 1 byte
		dataView.setUint8(offset, config.pointFormat);
		offset += 1;

		// Point Data Record Length - 2 bytes
		dataView.setUint16(offset, config.pointRecordLength, this.littleEndian);
		offset += 2;

		// Legacy Number of Point Records - 4 bytes
		var legacyCount = config.numPoints <= 0xffffffff ? config.numPoints : 0;
		dataView.setUint32(offset, legacyCount, this.littleEndian);
		offset += 4;

		// Legacy Number of Points by Return - 20 bytes (5 x 4 bytes)
		for (var i = 0; i < 5; i++) {
			var count = config.stats.returnCounts[i] || 0;
			if (count > 0xffffffff) count = 0;
			dataView.setUint32(offset, count, this.littleEndian);
			offset += 4;
		}

		// X Scale Factor - 8 bytes
		dataView.setFloat64(offset, config.scaleOffset.xScale, this.littleEndian);
		offset += 8;

		// Y Scale Factor - 8 bytes
		dataView.setFloat64(offset, config.scaleOffset.yScale, this.littleEndian);
		offset += 8;

		// Z Scale Factor - 8 bytes
		dataView.setFloat64(offset, config.scaleOffset.zScale, this.littleEndian);
		offset += 8;

		// X Offset - 8 bytes
		dataView.setFloat64(offset, config.scaleOffset.xOffset, this.littleEndian);
		offset += 8;

		// Y Offset - 8 bytes
		dataView.setFloat64(offset, config.scaleOffset.yOffset, this.littleEndian);
		offset += 8;

		// Z Offset - 8 bytes
		dataView.setFloat64(offset, config.scaleOffset.zOffset, this.littleEndian);
		offset += 8;

		// Max X - 8 bytes
		dataView.setFloat64(offset, config.stats.maxX, this.littleEndian);
		offset += 8;

		// Min X - 8 bytes
		dataView.setFloat64(offset, config.stats.minX, this.littleEndian);
		offset += 8;

		// Max Y - 8 bytes
		dataView.setFloat64(offset, config.stats.maxY, this.littleEndian);
		offset += 8;

		// Min Y - 8 bytes
		dataView.setFloat64(offset, config.stats.minY, this.littleEndian);
		offset += 8;

		// Max Z - 8 bytes
		dataView.setFloat64(offset, config.stats.maxZ, this.littleEndian);
		offset += 8;

		// Min Z - 8 bytes
		dataView.setFloat64(offset, config.stats.minZ, this.littleEndian);
		offset += 8;

		// LAS 1.3+ fields
		if (versionMinor >= 3) {
			// Start of Waveform Data Packet Record - 8 bytes
			this.writeUint64(dataView, offset, 0);
			offset += 8;
		}

		// LAS 1.4+ fields
		if (versionMinor >= 4) {
			// Start of First EVLR - 8 bytes
			this.writeUint64(dataView, offset, 0);
			offset += 8;

			// Number of EVLRs - 4 bytes
			dataView.setUint32(offset, 0, this.littleEndian);
			offset += 4;

			// Number of Point Records (64-bit) - 8 bytes
			this.writeUint64(dataView, offset, config.numPoints);
			offset += 8;

			// Number of Points by Return (15 x 8 bytes) - 120 bytes
			for (var i = 0; i < 15; i++) {
				var count = i < 5 ? config.stats.returnCounts[i] || 0 : 0;
				this.writeUint64(dataView, offset, count);
				offset += 8;
			}
		}

		return offset;
	}

	// Step 27) Write Point Data Record
	writePointRecord(dataView, offset, point, formatID, scaleOffset) {
		// Calculate scaled integer coordinates
		var xScaled = Math.round((point.x - scaleOffset.xOffset) / scaleOffset.xScale);
		var yScaled = Math.round((point.y - scaleOffset.yOffset) / scaleOffset.yScale);
		var zScaled = Math.round((point.z - scaleOffset.zOffset) / scaleOffset.zScale);

		// X, Y, Z - 12 bytes (3 x 4-byte signed integers)
		dataView.setInt32(offset, xScaled, this.littleEndian);
		offset += 4;
		dataView.setInt32(offset, yScaled, this.littleEndian);
		offset += 4;
		dataView.setInt32(offset, zScaled, this.littleEndian);
		offset += 4;

		// Intensity - 2 bytes
		dataView.setUint16(offset, point.intensity || 0, this.littleEndian);
		offset += 2;

		if (formatID <= 5) {
			// Legacy formats (0-5)

			// Flag byte: Return Number (3 bits), Number of Returns (3 bits),
			// Scan Direction Flag (1 bit), Edge of Flight Line (1 bit)
			var flagByte = (point.returnNumber & 0x07) | ((point.numberOfReturns & 0x07) << 3) | ((point.scanDirectionFlag & 0x01) << 6) | ((point.edgeOfFlightLine & 0x01) << 7);
			dataView.setUint8(offset, flagByte);
			offset += 1;

			// Classification byte: Classification (5 bits), Synthetic (1 bit),
			// Key-point (1 bit), Withheld (1 bit)
			var classificationByte = (point.classification & 0x1f) | ((point.synthetic || 0) << 5) | ((point.keyPoint || 0) << 6) | ((point.withheld || 0) << 7);
			dataView.setUint8(offset, classificationByte);
			offset += 1;

			// Scan Angle Rank - 1 byte (signed)
			var scanAngle = Math.max(-90, Math.min(90, point.scanAngleRank || 0));
			dataView.setInt8(offset, scanAngle);
			offset += 1;

			// User Data - 1 byte
			dataView.setUint8(offset, point.userData || 0);
			offset += 1;

			// Point Source ID - 2 bytes
			dataView.setUint16(offset, point.pointSourceID || 0, this.littleEndian);
			offset += 2;
		} else {
			// New formats (6-10) - LAS 1.4

			// Return Number (4 bits), Number of Returns (4 bits)
			var returnByte = (point.returnNumber & 0x0f) | ((point.numberOfReturns & 0x0f) << 4);
			dataView.setUint8(offset, returnByte);
			offset += 1;

			// Classification Flags (4 bits), Scanner Channel (2 bits),
			// Scan Direction Flag (1 bit), Edge of Flight Line (1 bit)
			var flagsByte = ((point.classificationFlags || 0) & 0x0f) | ((point.scannerChannel || 0) << 4) | ((point.scanDirectionFlag & 0x01) << 6) | ((point.edgeOfFlightLine & 0x01) << 7);
			dataView.setUint8(offset, flagsByte);
			offset += 1;

			// Classification - 1 byte
			dataView.setUint8(offset, point.classification || 0);
			offset += 1;

			// User Data - 1 byte
			dataView.setUint8(offset, point.userData || 0);
			offset += 1;

			// Scan Angle - 2 bytes (scaled by 0.006 degrees)
			var scanAngleDeg = point.scanAngle !== undefined ? point.scanAngle : point.scanAngleRank || 0;
			var scanAngleScaled = Math.round(scanAngleDeg / 0.006);
			scanAngleScaled = Math.max(-30000, Math.min(30000, scanAngleScaled));
			dataView.setInt16(offset, scanAngleScaled, this.littleEndian);
			offset += 2;

			// Point Source ID - 2 bytes
			dataView.setUint16(offset, point.pointSourceID || 0, this.littleEndian);
			offset += 2;
		}

		// GPS Time (formats 1, 3, 6, 7, 8)
		if (formatID === 1 || formatID === 3 || formatID >= 6) {
			dataView.setFloat64(offset, point.gpsTime || 0, this.littleEndian);
			offset += 8;
		}

		// RGB Color (formats 2, 3, 7, 8)
		if (formatID === 2 || formatID === 3 || formatID === 7 || formatID === 8) {
			dataView.setUint16(offset, point.red || 0, this.littleEndian);
			offset += 2;
			dataView.setUint16(offset, point.green || 0, this.littleEndian);
			offset += 2;
			dataView.setUint16(offset, point.blue || 0, this.littleEndian);
			offset += 2;
		}

		// NIR (format 8)
		if (formatID === 8) {
			dataView.setUint16(offset, point.nir || 0, this.littleEndian);
			offset += 2;
		}

		return offset;
	}

	// Step 28) Helper: Write string to DataView
	writeString(dataView, offset, str, length) {
		for (var i = 0; i < length; i++) {
			if (i < str.length) {
				dataView.setUint8(offset + i, str.charCodeAt(i));
			} else {
				dataView.setUint8(offset + i, 0); // Null padding
			}
		}
	}

	// Step 29) Helper: Write 64-bit unsigned integer
	writeUint64(dataView, offset, value) {
		// JavaScript doesn't have native 64-bit integer support
		// Write as two 32-bit values
		var low = value & 0xffffffff;
		var high = Math.floor(value / 0x100000000) & 0xffffffff;
		dataView.setUint32(offset, low, this.littleEndian);
		dataView.setUint32(offset + 4, high, this.littleEndian);
	}

	// Step 30) Helper: Convert hex color to 16-bit RGB
	hexToRgb16(hex) {
		// Remove # if present
		hex = hex.replace(/^#/, "");

		// Parse hex values
		var r8 = parseInt(hex.substring(0, 2), 16) || 0;
		var g8 = parseInt(hex.substring(2, 4), 16) || 0;
		var b8 = parseInt(hex.substring(4, 6), 16) || 0;

		// Convert from 8-bit (0-255) to 16-bit (0-65535)
		return {
			r: r8 * 256,
			g: g8 * 256,
			b: b8 * 256
		};
	}

	// Step 31) Static method to get supported formats
	static getSupportedFormats() {
		return {
			versions: ["1.2", "1.3", "1.4"],
			pointFormats: {
				"1.2": [0, 1, 2, 3],
				"1.3": [0, 1, 2, 3],
				"1.4": [0, 1, 2, 3, 6, 7, 8]
			},
			pointFormatDescriptions: {
				0: "Core (20 bytes): XYZ, Intensity, Returns, Classification",
				1: "Core + GPS Time (28 bytes)",
				2: "Core + RGB (26 bytes)",
				3: "Core + GPS Time + RGB (34 bytes)",
				6: "LAS 1.4 Extended Core + GPS Time (30 bytes)",
				7: "LAS 1.4 Extended Core + GPS Time + RGB (36 bytes)",
				8: "LAS 1.4 Extended Core + GPS Time + RGB + NIR (38 bytes)"
			}
		};
	}
}

export default LASWriter;
