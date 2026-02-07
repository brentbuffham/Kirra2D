// src/fileIO/LASIO/LASParser.js
//=============================================================
// LAS FILE PARSER
//=============================================================
// Step 1) Parses ASPRS LAS (LiDAR) binary format files
// Step 2) Supports LAS versions 1.2, 1.3, and 1.4
// Step 3) Supports Point Data Record Formats 0, 1, 2, 3, 6, 7, 8
// Step 4) Created: 2026-01-16
// Step 5) Reference: ASPRS LAS Specification 1.4-R15

import BaseParser from "../BaseParser.js";
import proj4 from "proj4";
import { top100EPSGCodes, isLikelyWGS84 } from "../../dialog/popups/generic/ProjectionDialog.js";
import { Delaunay } from "d3-delaunay";
import { deduplicatePoints, decimatePoints } from "../../helpers/PointDeduplication.js";

// Step 6) LAS Classification lookup table
const LAS_CLASSIFICATIONS = {
	0: "Created, never classified",
	1: "Unclassified",
	2: "Ground",
	3: "Low Vegetation",
	4: "Medium Vegetation",
	5: "High Vegetation",
	6: "Building",
	7: "Low Point (noise)",
	8: "Model Key-point",
	9: "Water",
	10: "Rail",
	11: "Road Surface",
	12: "Reserved (Overlap)",
	13: "Wire - Guard (Shield)",
	14: "Wire - Conductor (Phase)",
	15: "Transmission Tower",
	16: "Wire-structure Connector",
	17: "Bridge Deck",
	18: "High Noise"
};

// Step 7) Point Data Record sizes by format
const POINT_RECORD_SIZES = {
	0: 20, // Core: X, Y, Z, Intensity, Return info, Classification, ScanAngle, UserData, PointSourceID
	1: 28, // Format 0 + GPS Time
	2: 26, // Format 0 + RGB
	3: 34, // Format 0 + GPS Time + RGB
	4: 57, // Format 1 + Wave Packets
	5: 63, // Format 3 + Wave Packets
	6: 30, // New base format (LAS 1.4): Extended return/class + GPS Time
	7: 36, // Format 6 + RGB
	8: 38, // Format 6 + RGB + NIR
	9: 59, // Format 6 + Wave Packets
	10: 67 // Format 8 + Wave Packets
};

// Step 8) LASParser class
class LASParser extends BaseParser {
	constructor(options = {}) {
		super(options);
		this.littleEndian = true; // LAS is always little-endian
	}

	// Step 9) Main parse method
	async parse(file) {
		try {
			// Step 10) Read file as ArrayBuffer for binary parsing
			var arrayBuffer = await this.readAsArrayBuffer(file);

			// Step 11) Parse the LAS data (initial parsing without transformation)
			var rawData = this.parseLASData(arrayBuffer);

			// Step 12) Detect coordinate system from bounds
			var isWGS84 = this.detectCoordinateSystem(rawData.header);

			// Step 13) Prompt user for import configuration
			var config = await this.promptForImportConfiguration(file.name, isWGS84);

			if (config.cancelled) {
				return { success: false, message: "Import cancelled by user" };
			}

			// Step 14) Apply coordinate transformations if needed
			if (config.transform) {
				rawData = await this.applyCoordinateTransformation(rawData, config);
			}

			// Step 15) Apply master RL offset if specified
			// if (config.masterRLX !== 0 || config.masterRLY !== 0) {
			// 	rawData = this.applyMasterRLOffset(rawData, config.masterRLX, config.masterRLY);
			// }

			// Step 16) Convert to kadDrawingsMap format for Kirra compatibility
			if (config.importType === "surface") {
				// Create triangulated surface
				var surfaceResult = await this.createTriangulatedSurface(rawData.points, config);
				return {
					...surfaceResult,
					config: config,
					success: true
				};
			} else {
				// Point cloud behavior with decimation/deduplication
				var points = rawData.points;
				var originalCount = points.length;

				// Apply decimation if maxPoints specified
				if (config.maxPoints > 0 && points.length > config.maxPoints) {
					points = decimatePoints(points, config.maxPoints);
					console.log("LAS point cloud decimated: " + originalCount + " -> " + points.length + " points");
				}

				// Apply deduplication if tolerance specified
				if (config.pcXyTolerance > 0) {
					var dedupResult = deduplicatePoints(points, config.pcXyTolerance);
					console.log("LAS point cloud deduplicated: " + dedupResult.originalCount + " -> " + dedupResult.uniqueCount + " points");
					points = dedupResult.uniquePoints;
				}

				rawData.kadDrawingsMap = this.convertToKadFormat(points, rawData.header, config.pcPreserveColors);
				return {
					...rawData,
					config: config,
					dataType: "pointcloud",
					success: true,
					originalPointCount: originalCount,
					processedPointCount: points.length
				};
			}

			// Step 17) Return final processed data
			return {
				...rawData,
				config: config,
				dataType: "pointcloud",
				success: true
			};
		} catch (error) {
			console.error("LAS parse error:", error);
			throw error;
		}
	}

	// Step 12) Read file as ArrayBuffer
	readAsArrayBuffer(file) {
		return new Promise((resolve, reject) => {
			var reader = new FileReader();
			reader.onload = event => resolve(event.target.result);
			reader.onerror = error => reject(error);
			reader.readAsArrayBuffer(file);
		});
	}

	// Step 13) Parse LAS data from ArrayBuffer
	parseLASData(arrayBuffer) {
		var dataView = new DataView(arrayBuffer);
		var offset = 0;

		try {
			// Step 14) Parse and validate file signature
			var signature = this.readString(dataView, offset, 4);
			if (signature !== "LASF") {
				throw new Error("Invalid LAS file: File signature must be 'LASF', got '" + signature + "'");
			}
			offset += 4;

			// Step 15) Parse Public Header Block
			var header = this.parsePublicHeader(dataView);

			console.log("LAS Version: " + header.versionMajor + "." + header.versionMinor);
			console.log("Point Data Format: " + header.pointDataFormatID);
			console.log("Number of Points: " + header.numberOfPoints);

			// Step 16) Parse Variable Length Records (VLRs) if present
			var vlrs = [];
			if (header.numberOfVLRs > 0) {
				vlrs = this.parseVLRs(dataView, header);
			}

			// Step 17) Parse Point Data Records
			var points = this.parsePointRecords(dataView, header);

			// Step 18) Calculate statistics
			var stats = this.calculateStatistics(points, header);

			// Step 19) Return parsed data (without KAD conversion - done later)
			return {
				header: header,
				vlrs: vlrs,
				points: points,
				statistics: stats,
				successCount: points.length,
				errorCount: 0,
				centroidX: stats.centroidX,
				centroidY: stats.centroidY,
				centroidZ: stats.centroidZ
			};
		} catch (error) {
			console.error("Error parsing LAS file:", error);
			throw new Error("Error parsing LAS file: " + error.message);
		}
	}

	// Step 21) Parse Public Header Block
	parsePublicHeader(dataView) {
		var header = {};
		var offset = 0;

		// File Signature (already validated) - 4 bytes
		header.fileSignature = this.readString(dataView, offset, 4);
		offset += 4;

		// File Source ID - 2 bytes (unsigned short)
		header.fileSourceID = dataView.getUint16(offset, this.littleEndian);
		offset += 2;

		// Global Encoding - 2 bytes (unsigned short)
		header.globalEncoding = dataView.getUint16(offset, this.littleEndian);
		offset += 2;

		// Project ID (GUID) - 16 bytes
		header.projectID_GUID_data1 = dataView.getUint32(offset, this.littleEndian);
		offset += 4;
		header.projectID_GUID_data2 = dataView.getUint16(offset, this.littleEndian);
		offset += 2;
		header.projectID_GUID_data3 = dataView.getUint16(offset, this.littleEndian);
		offset += 2;
		header.projectID_GUID_data4 = new Uint8Array(dataView.buffer, offset, 8);
		offset += 8;

		// Version Major - 1 byte
		header.versionMajor = dataView.getUint8(offset);
		offset += 1;

		// Version Minor - 1 byte
		header.versionMinor = dataView.getUint8(offset);
		offset += 1;

		// System Identifier - 32 bytes
		header.systemIdentifier = this.readString(dataView, offset, 32);
		offset += 32;

		// Generating Software - 32 bytes
		header.generatingSoftware = this.readString(dataView, offset, 32);
		offset += 32;

		// File Creation Day of Year - 2 bytes
		header.fileCreationDayOfYear = dataView.getUint16(offset, this.littleEndian);
		offset += 2;

		// File Creation Year - 2 bytes
		header.fileCreationYear = dataView.getUint16(offset, this.littleEndian);
		offset += 2;

		// Header Size - 2 bytes
		header.headerSize = dataView.getUint16(offset, this.littleEndian);
		offset += 2;

		// Offset to Point Data - 4 bytes
		header.offsetToPointData = dataView.getUint32(offset, this.littleEndian);
		offset += 4;

		// Number of Variable Length Records - 4 bytes
		header.numberOfVLRs = dataView.getUint32(offset, this.littleEndian);
		offset += 4;

		// Point Data Record Format - 1 byte
		header.pointDataFormatID = dataView.getUint8(offset);
		offset += 1;

		// Point Data Record Length - 2 bytes
		header.pointDataRecordLength = dataView.getUint16(offset, this.littleEndian);
		offset += 2;

		// Legacy Number of Point Records - 4 bytes (LAS 1.0-1.3)
		header.legacyNumberOfPointRecords = dataView.getUint32(offset, this.littleEndian);
		offset += 4;

		// Legacy Number of Points by Return - 5 x 4 bytes = 20 bytes
		header.legacyNumberOfPointsByReturn = [];
		for (var i = 0; i < 5; i++) {
			header.legacyNumberOfPointsByReturn.push(dataView.getUint32(offset, this.littleEndian));
			offset += 4;
		}

		// X Scale Factor - 8 bytes (double)
		header.xScaleFactor = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Y Scale Factor - 8 bytes (double)
		header.yScaleFactor = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Z Scale Factor - 8 bytes (double)
		header.zScaleFactor = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// X Offset - 8 bytes (double)
		header.xOffset = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Y Offset - 8 bytes (double)
		header.yOffset = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Z Offset - 8 bytes (double)
		header.zOffset = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Max X - 8 bytes (double)
		header.maxX = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Min X - 8 bytes (double)
		header.minX = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Max Y - 8 bytes (double)
		header.maxY = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Min Y - 8 bytes (double)
		header.minY = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Max Z - 8 bytes (double)
		header.maxZ = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// Min Z - 8 bytes (double)
		header.minZ = dataView.getFloat64(offset, this.littleEndian);
		offset += 8;

		// LAS 1.3+ fields
		if (header.versionMinor >= 3) {
			// Start of Waveform Data Packet Record - 8 bytes
			header.startOfWaveformDataPacketRecord = this.readUint64(dataView, offset);
			offset += 8;
		}

		// LAS 1.4+ fields
		if (header.versionMinor >= 4) {
			// Start of First Extended Variable Length Record - 8 bytes
			header.startOfFirstEVLR = this.readUint64(dataView, offset);
			offset += 8;

			// Number of Extended Variable Length Records - 4 bytes
			header.numberOfEVLRs = dataView.getUint32(offset, this.littleEndian);
			offset += 4;

			// Number of Point Records (64-bit) - 8 bytes
			header.numberOfPoints = this.readUint64(dataView, offset);
			offset += 8;

			// Number of Points by Return (15 x 8 bytes) - 120 bytes
			header.numberOfPointsByReturn = [];
			for (var i = 0; i < 15; i++) {
				header.numberOfPointsByReturn.push(this.readUint64(dataView, offset));
				offset += 8;
			}
		} else {
			// Use legacy values for LAS 1.0-1.3
			header.numberOfPoints = header.legacyNumberOfPointRecords;
			header.numberOfPointsByReturn = header.legacyNumberOfPointsByReturn;
		}

		return header;
	}

	// Step 22) Parse Variable Length Records
	parseVLRs(dataView, header) {
		var vlrs = [];
		var offset = header.headerSize;

		for (var i = 0; i < header.numberOfVLRs; i++) {
			var vlr = {};

			// Reserved - 2 bytes
			vlr.reserved = dataView.getUint16(offset, this.littleEndian);
			offset += 2;

			// User ID - 16 bytes
			vlr.userID = this.readString(dataView, offset, 16);
			offset += 16;

			// Record ID - 2 bytes
			vlr.recordID = dataView.getUint16(offset, this.littleEndian);
			offset += 2;

			// Record Length After Header - 2 bytes
			vlr.recordLengthAfterHeader = dataView.getUint16(offset, this.littleEndian);
			offset += 2;

			// Description - 32 bytes
			vlr.description = this.readString(dataView, offset, 32);
			offset += 32;

			// VLR Data
			vlr.data = new Uint8Array(dataView.buffer, offset, vlr.recordLengthAfterHeader);
			offset += vlr.recordLengthAfterHeader;

			// Try to parse known VLR types
			vlr.parsedData = this.parseVLRData(vlr);

			vlrs.push(vlr);
		}

		return vlrs;
	}

	// Step 23) Parse known VLR data types
	parseVLRData(vlr) {
		// GeoTIFF GeoKeyDirectoryTag
		if (vlr.userID.trim() === "LASF_Projection" && vlr.recordID === 34735) {
			return this.parseGeoKeyDirectory(vlr.data);
		}
		// WKT Coordinate System
		if (vlr.userID.trim() === "LASF_Projection" && vlr.recordID === 2112) {
			return { wkt: this.readString(new DataView(vlr.data.buffer, vlr.data.byteOffset), 0, vlr.data.length) };
		}
		return null;
	}

	// Step 24) Parse GeoKey Directory
	parseGeoKeyDirectory(data) {
		if (data.length < 8) return null;

		var dv = new DataView(data.buffer, data.byteOffset, data.length);
		var keys = {};

		keys.keyDirectoryVersion = dv.getUint16(0, this.littleEndian);
		keys.keyRevision = dv.getUint16(2, this.littleEndian);
		keys.minorRevision = dv.getUint16(4, this.littleEndian);
		keys.numberOfKeys = dv.getUint16(6, this.littleEndian);

		keys.entries = [];
		var offset = 8;
		for (var i = 0; i < keys.numberOfKeys && offset + 8 <= data.length; i++) {
			keys.entries.push({
				keyID: dv.getUint16(offset, this.littleEndian),
				tiffTagLocation: dv.getUint16(offset + 2, this.littleEndian),
				count: dv.getUint16(offset + 4, this.littleEndian),
				valueOffset: dv.getUint16(offset + 6, this.littleEndian)
			});
			offset += 8;
		}

		return keys;
	}

	// Step 25) Parse Point Data Records
	parsePointRecords(dataView, header) {
		var points = [];
		var offset = header.offsetToPointData;
		var recordLength = header.pointDataRecordLength;
		var formatID = header.pointDataFormatID;
		var numPoints = Number(header.numberOfPoints);

		// Limit for performance - can be adjusted
		var maxPoints = this.options.maxPoints || Infinity;
		var pointsToRead = Math.min(numPoints, maxPoints);

		console.log("Reading " + pointsToRead + " of " + numPoints + " points");

		for (var i = 0; i < pointsToRead; i++) {
			try {
				var point = this.parsePointRecord(dataView, offset, formatID, header);
				point.pointID = i;
				points.push(point);
			} catch (e) {
				console.warn("Error parsing point " + i + ": " + e.message);
			}
			offset += recordLength;
		}

		return points;
	}

	// Step 26) Parse individual point record based on format
	parsePointRecord(dataView, offset, formatID, header) {
		var point = {};
		var startOffset = offset;

		// Step 27) Core point data (common to all formats)
		// X, Y, Z as signed 32-bit integers
		var xRaw = dataView.getInt32(offset, this.littleEndian);
		offset += 4;
		var yRaw = dataView.getInt32(offset, this.littleEndian);
		offset += 4;
		var zRaw = dataView.getInt32(offset, this.littleEndian);
		offset += 4;

		// Apply scale and offset to get actual coordinates
		point.x = xRaw * header.xScaleFactor + header.xOffset;
		point.y = yRaw * header.yScaleFactor + header.yOffset;
		point.z = zRaw * header.zScaleFactor + header.zOffset;

		// Store raw values too
		point.xRaw = xRaw;
		point.yRaw = yRaw;
		point.zRaw = zRaw;

		// Intensity - 2 bytes (unsigned short)
		point.intensity = dataView.getUint16(offset, this.littleEndian);
		offset += 2;

		// Step 28) Format-specific parsing
		if (formatID <= 5) {
			// Legacy formats (0-5)
			// Return Number (3 bits), Number of Returns (3 bits),
			// Scan Direction Flag (1 bit), Edge of Flight Line (1 bit) - 1 byte
			var flagByte = dataView.getUint8(offset);
			offset += 1;

			point.returnNumber = flagByte & 0x07; // bits 0-2
			point.numberOfReturns = (flagByte >> 3) & 0x07; // bits 3-5
			point.scanDirectionFlag = (flagByte >> 6) & 0x01; // bit 6
			point.edgeOfFlightLine = (flagByte >> 7) & 0x01; // bit 7

			// Classification - 1 byte
			var classificationByte = dataView.getUint8(offset);
			offset += 1;

			point.classification = classificationByte & 0x1f; // bits 0-4
			point.synthetic = (classificationByte >> 5) & 0x01; // bit 5
			point.keyPoint = (classificationByte >> 6) & 0x01; // bit 6
			point.withheld = (classificationByte >> 7) & 0x01; // bit 7
			point.classificationName = LAS_CLASSIFICATIONS[point.classification] || "Reserved";

			// Scan Angle Rank - 1 byte (signed char, -90 to +90)
			point.scanAngleRank = dataView.getInt8(offset);
			offset += 1;

			// User Data - 1 byte
			point.userData = dataView.getUint8(offset);
			offset += 1;

			// Point Source ID - 2 bytes
			point.pointSourceID = dataView.getUint16(offset, this.littleEndian);
			offset += 2;
		} else {
			// New formats (6-10) - LAS 1.4
			// Return Number (4 bits), Number of Returns (4 bits) - 1 byte
			var returnByte = dataView.getUint8(offset);
			offset += 1;

			point.returnNumber = returnByte & 0x0f; // bits 0-3
			point.numberOfReturns = (returnByte >> 4) & 0x0f; // bits 4-7

			// Classification Flags and Scanner Channel - 1 byte
			var flagsByte = dataView.getUint8(offset);
			offset += 1;

			point.classificationFlags = flagsByte & 0x0f; // bits 0-3
			point.scannerChannel = (flagsByte >> 4) & 0x03; // bits 4-5
			point.scanDirectionFlag = (flagsByte >> 6) & 0x01; // bit 6
			point.edgeOfFlightLine = (flagsByte >> 7) & 0x01; // bit 7

			// Classification - 1 byte (full byte in 1.4)
			point.classification = dataView.getUint8(offset);
			point.classificationName = LAS_CLASSIFICATIONS[point.classification] || "Reserved";
			offset += 1;

			// User Data - 1 byte
			point.userData = dataView.getUint8(offset);
			offset += 1;

			// Scan Angle - 2 bytes (scaled by 0.006 degrees)
			var scanAngleRaw = dataView.getInt16(offset, this.littleEndian);
			point.scanAngle = scanAngleRaw * 0.006;
			offset += 2;

			// Point Source ID - 2 bytes
			point.pointSourceID = dataView.getUint16(offset, this.littleEndian);
			offset += 2;
		}

		// Step 29) GPS Time (formats 1, 3, 4, 5, 6, 7, 8, 9, 10)
		if (formatID === 1 || formatID === 3 || formatID === 4 || formatID === 5 || formatID >= 6) {
			point.gpsTime = dataView.getFloat64(offset, this.littleEndian);
			offset += 8;
		}

		// Step 30) RGB Color (formats 2, 3, 5, 7, 8, 10)
		if (formatID === 2 || formatID === 3 || formatID === 5 || formatID === 7 || formatID === 8 || formatID === 10) {
			point.red = dataView.getUint16(offset, this.littleEndian);
			offset += 2;
			point.green = dataView.getUint16(offset, this.littleEndian);
			offset += 2;
			point.blue = dataView.getUint16(offset, this.littleEndian);
			offset += 2;

			// Convert 16-bit color to hex string for Kirra
			point.color = this.rgb16ToHex(point.red, point.green, point.blue);
			point.hasRgbColor = true; // Flag: this color came from actual RGB data
		} else {
			// No RGB in this format - will use elevation color in convertToKadFormat
			point.color = null;
			point.hasRgbColor = false;
		}

		// Step 31) NIR (formats 8, 10)
		if (formatID === 8 || formatID === 10) {
			point.nir = dataView.getUint16(offset, this.littleEndian);
			offset += 2;
		}

		// Step 32) Wave Packet info (formats 4, 5, 9, 10)
		if (formatID === 4 || formatID === 5 || formatID === 9 || formatID === 10) {
			point.wavePacketDescriptorIndex = dataView.getUint8(offset);
			offset += 1;
			point.byteOffsetToWaveformData = this.readUint64(dataView, offset);
			offset += 8;
			point.waveformPacketSizeInBytes = dataView.getUint32(offset, this.littleEndian);
			offset += 4;
			point.returnPointWaveformLocation = dataView.getFloat32(offset, this.littleEndian);
			offset += 4;
			point.xt = dataView.getFloat32(offset, this.littleEndian);
			offset += 4;
			point.yt = dataView.getFloat32(offset, this.littleEndian);
			offset += 4;
			point.zt = dataView.getFloat32(offset, this.littleEndian);
			offset += 4;
		}

		return point;
	}

	// Step 33) Convert to Kirra kadDrawingsMap format
	convertToKadFormat(points, header, preserveColors) {
		var kadDrawingsMap = new Map();
		var entityName = "LAS_Points";
		var self = this;

		// Default to true if not specified
		if (preserveColors === undefined) preserveColors = true;

		// Get Z range for elevation-based fallback colors
		var minZ = header.minZ;
		var maxZ = header.maxZ;

		// Group points by classification for different layers
		var pointsByClass = new Map();

		for (var i = 0; i < points.length; i++) {
			var point = points[i];
			var classKey = "Class_" + point.classification + "_" + (point.classificationName || "Unknown").replace(/[^a-zA-Z0-9]/g, "_");

			if (!pointsByClass.has(classKey)) {
				pointsByClass.set(classKey, []);
			}
			pointsByClass.get(classKey).push(point);
		}

		// Convert each classification group to a KAD entity
		for (var [className, classPoints] of pointsByClass) {
			var kadData = [];

			for (var j = 0; j < classPoints.length; j++) {
				var pt = classPoints[j];
				// Use LAS RGB color if available and preserveColors is true, otherwise use elevation-based color
				var pointColor;
				if (preserveColors && pt.hasRgbColor && pt.color) {
					pointColor = pt.color;
				} else {
					// Fallback to elevation-based color (blue->cyan->green->yellow->red)
					pointColor = self.getElevationColor(pt.z, minZ, maxZ);
				}
				kadData.push({
					entityName: className,
					entityType: "point",
					pointID: pt.pointID,
					pointXLocation: pt.x,
					pointYLocation: pt.y,
					pointZLocation: pt.z,
					lineWidth: 1,
					color: pointColor,
					intensity: pt.intensity,
					classification: pt.classification,
					returnNumber: pt.returnNumber,
					numberOfReturns: pt.numberOfReturns,
					gpsTime: pt.gpsTime,
					connected: false,
					closed: false
				});
			}

			kadDrawingsMap.set(className, {
				entityName: className,
				entityType: "point",
				data: kadData
			});
		}

		return kadDrawingsMap;
	}

	// Step 33b) Get elevation-based color (blue->cyan->green->yellow->red spectrum)
	getElevationColor(z, minZ, maxZ) {
		var range = maxZ - minZ;
		if (range < 0.001) {
			return "#FFA500"; // Orange for flat data
		}

		var ratio = (z - minZ) / range;
		ratio = Math.max(0, Math.min(1, ratio)); // Clamp to 0-1

		var r, g, b;
		if (ratio < 0.25) {
			// Blue to Cyan
			r = 0;
			g = Math.floor(ratio * 4 * 255);
			b = 255;
		} else if (ratio < 0.5) {
			// Cyan to Green
			r = 0;
			g = 255;
			b = Math.floor(255 - (ratio - 0.25) * 4 * 255);
		} else if (ratio < 0.75) {
			// Green to Yellow
			r = Math.floor((ratio - 0.5) * 4 * 255);
			g = 255;
			b = 0;
		} else {
			// Yellow to Red
			r = 255;
			g = Math.floor(255 - (ratio - 0.75) * 4 * 255);
			b = 0;
		}

		return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
	}

	// Step 34) Calculate statistics
	calculateStatistics(points, header) {
		var stats = {
			totalPoints: points.length,
			minX: header.minX,
			maxX: header.maxX,
			minY: header.minY,
			maxY: header.maxY,
			minZ: header.minZ,
			maxZ: header.maxZ,
			centroidX: (header.minX + header.maxX) / 2,
			centroidY: (header.minY + header.maxY) / 2,
			centroidZ: (header.minZ + header.maxZ) / 2,
			classifications: {},
			returnNumbers: {}
		};

		// Count by classification and return number
		for (var i = 0; i < points.length; i++) {
			var pt = points[i];

			if (!stats.classifications[pt.classification]) {
				stats.classifications[pt.classification] = {
					count: 0,
					name: pt.classificationName
				};
			}
			stats.classifications[pt.classification].count++;

			if (!stats.returnNumbers[pt.returnNumber]) {
				stats.returnNumbers[pt.returnNumber] = 0;
			}
			stats.returnNumbers[pt.returnNumber]++;
		}

		return stats;
	}

	// Step 35) Helper: Read string from DataView
	readString(dataView, offset, length) {
		var chars = [];
		for (var i = 0; i < length; i++) {
			var charCode = dataView.getUint8(offset + i);
			if (charCode === 0) break; // Null terminator
			chars.push(String.fromCharCode(charCode));
		}
		return chars.join("");
	}

	// Step 36) Helper: Read 64-bit unsigned integer
	readUint64(dataView, offset) {
		// JavaScript doesn't have native 64-bit integer support
		// Read as two 32-bit values and combine
		var low = dataView.getUint32(offset, this.littleEndian);
		var high = dataView.getUint32(offset + 4, this.littleEndian);
		// For values that fit in 53 bits (Number.MAX_SAFE_INTEGER)
		return high * 0x100000000 + low;
	}

	// Step 37) Helper: Convert 16-bit RGB to hex color string
	rgb16ToHex(r, g, b) {
		// Convert from 16-bit (0-65535) to 8-bit (0-255)
		var r8 = Math.round(r / 256);
		var g8 = Math.round(g / 256);
		var b8 = Math.round(b / 256);

		// Clamp values
		r8 = Math.min(255, Math.max(0, r8));
		g8 = Math.min(255, Math.max(0, g8));
		b8 = Math.min(255, Math.max(0, b8));

		return "#" + r8.toString(16).padStart(2, "0") + g8.toString(16).padStart(2, "0") + b8.toString(16).padStart(2, "0");
	}

	async createTriangulatedSurface(points, config) {
		// Step 1) Get triangulation options from config
		var maxEdgeLength = config.maxEdgeLength || 0;
		var consider3DLength = config.consider3DLength || false;
		var minAngle = config.minAngle || 0;
		var consider3DAngle = config.consider3DAngle || false;
		var surfaceName = config.surfaceName || "LAS_Surface";
		var surfaceStyle = config.surfaceStyle || "default";
		var xyzTolerance = config.xyzTolerance || 0.001;
		var maxSurfacePoints = config.maxSurfacePoints || 0;
		var useLasColors = surfaceStyle === "lasColors";

		// Get Z range for elevation color fallback
		var minZ = Infinity, maxZ = -Infinity;
		for (var i = 0; i < points.length; i++) {
			var z = parseFloat(points[i].z);
			if (z < minZ) minZ = z;
			if (z > maxZ) maxZ = z;
		}
		var self = this;

		// Step 2) Prepare points for triangulation (preserve colors if using lasColors)
		var vertices = points.map(function(pt) {
			var vertex = {
				x: parseFloat(pt.x),
				y: parseFloat(pt.y),
				z: parseFloat(pt.z)
			};
			// Preserve LAS RGB color if using lasColors gradient, otherwise use elevation color
			if (useLasColors) {
				if (pt.hasRgbColor && pt.color) {
					vertex.color = pt.color;
				} else {
					// Fallback to elevation-based color
					vertex.color = self.getElevationColor(vertex.z, minZ, maxZ);
				}
			}
			return vertex;
		});

		// Step 2.5) Decimate if maxSurfacePoints is set (before dedup for performance)
		if (maxSurfacePoints > 0 && vertices.length > maxSurfacePoints) {
			var originalCount = vertices.length;
			vertices = decimatePoints(vertices, maxSurfacePoints);
			if (window.developerModeEnabled) {
				console.log("Decimated: " + originalCount + " -> " + vertices.length + " points (target: " + maxSurfacePoints + ")");
			}
		}

		// Step 2.6) Deduplicate points by XY distance within tolerance
		if (xyzTolerance > 0) {
			var dedupResult = deduplicatePoints(vertices, xyzTolerance);
			if (window.developerModeEnabled) {
				console.log("Deduplication: " + dedupResult.originalCount + " -> " + dedupResult.uniqueCount + " points (tolerance: " + xyzTolerance + ")");
			}
			vertices = dedupResult.uniquePoints;
		}

		// Step 3) Check minimum points for triangulation
		if (vertices.length < 3) {
			throw new Error("Insufficient points for triangulation: " + vertices.length + " (minimum 3 required)");
		}

		// Step 4a) Debug logging (only in developer mode)
		if (window.developerModeEnabled) {
			console.log("Creating Delaunay triangulation from " + vertices.length + " LAS points");
			console.log("Options: maxEdgeLength=" + maxEdgeLength + ", minAngle=" + minAngle + ", 3DLength=" + consider3DLength + ", 3DAngle=" + consider3DAngle);
		}

		// Step 4) Create Delaunay triangulation directly using d3-delaunay
		var delaunay = Delaunay.from(
			vertices,
			function(d) {
				return d.x;
			},
			function(d) {
				return d.y;
			}
		);
		var triangleIndices = delaunay.triangles;

		// Step 5) Helper function to calculate distance
		function distanceSquared(p1, p2, use3D) {
			var dx = p2.x - p1.x;
			var dy = p2.y - p1.y;
			if (use3D) {
				var dz = p2.z - p1.z;
				return dx * dx + dy * dy + dz * dz;
			}
			return dx * dx + dy * dy;
		}

		// Step 6) Convert to triangle format with culling
		// Format: { vertices: [{ x, y, z }, { x, y, z }, { x, y, z }] }
		var resultTriangles = [];
		var culledByEdge = 0;
		var culledByAngle = 0;

		for (var i = 0; i < triangleIndices.length; i += 3) {
			var aIdx = triangleIndices[i];
			var bIdx = triangleIndices[i + 1];
			var cIdx = triangleIndices[i + 2];

			var p1 = vertices[aIdx];
			var p2 = vertices[bIdx];
			var p3 = vertices[cIdx];

			// Step 6a) Edge length culling
			if (maxEdgeLength > 0) {
				var edge1Sq = distanceSquared(p1, p2, consider3DLength);
				var edge2Sq = distanceSquared(p2, p3, consider3DLength);
				var edge3Sq = distanceSquared(p3, p1, consider3DLength);
				var maxEdgeSq = maxEdgeLength * maxEdgeLength;

				if (edge1Sq > maxEdgeSq || edge2Sq > maxEdgeSq || edge3Sq > maxEdgeSq) {
					culledByEdge++;
					continue; // Skip this triangle
				}
			}

			// Step 6b) Minimum angle culling
			if (minAngle > 0) {
				var edge1 = Math.sqrt(distanceSquared(p1, p2, consider3DAngle));
				var edge2 = Math.sqrt(distanceSquared(p2, p3, consider3DAngle));
				var edge3 = Math.sqrt(distanceSquared(p3, p1, consider3DAngle));

				// Calculate angles using law of cosines
				var angle1 = Math.acos(Math.max(-1, Math.min(1, (edge2 * edge2 + edge3 * edge3 - edge1 * edge1) / (2 * edge2 * edge3)))) * (180 / Math.PI);
				var angle2 = Math.acos(Math.max(-1, Math.min(1, (edge1 * edge1 + edge3 * edge3 - edge2 * edge2) / (2 * edge1 * edge3)))) * (180 / Math.PI);
				var angle3 = Math.acos(Math.max(-1, Math.min(1, (edge1 * edge1 + edge2 * edge2 - edge3 * edge3) / (2 * edge1 * edge2)))) * (180 / Math.PI);

				var minTriAngle = Math.min(angle1, angle2, angle3);

				if (minTriAngle < minAngle) {
					culledByAngle++;
					continue; // Skip this triangle
				}
			}

			// Step 6c) Add triangle in correct format
			resultTriangles.push({
				vertices: [{ x: p1.x, y: p1.y, z: p1.z }, { x: p2.x, y: p2.y, z: p2.z }, { x: p3.x, y: p3.y, z: p3.z }]
			});
		}

		// Step 6d) Debug logging (only in developer mode)
		if (window.developerModeEnabled) {
			console.log("✅ Generated " + resultTriangles.length + " triangles from LAS point cloud");
			console.log("🔺 Culled: " + culledByEdge + " by edge length, " + culledByAngle + " by angle");
		}

		// Step 6e) Calculate meshBounds from vertices for centroid calculation
		// CRITICAL: Without meshBounds, centroid calculation cannot use this surface data
		var minX = Infinity, maxX = -Infinity;
		var minY = Infinity, maxY = -Infinity;
		var minZ = Infinity, maxZ = -Infinity;
		for (var j = 0; j < vertices.length; j++) {
			var v = vertices[j];
			if (v.x < minX) minX = v.x;
			if (v.x > maxX) maxX = v.x;
			if (v.y < minY) minY = v.y;
			if (v.y > maxY) maxY = v.y;
			if (v.z < minZ) minZ = v.z;
			if (v.z > maxZ) maxZ = v.z;
		}
		var meshBounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ };

		if (window.developerModeEnabled) {
			console.log("📐 LAS meshBounds calculated: X[" + minX.toFixed(2) + "," + maxX.toFixed(2) + "] Y[" + minY.toFixed(2) + "," + maxY.toFixed(2) + "] Z[" + minZ.toFixed(2) + "," + maxZ.toFixed(2) + "]");
		}

		// Step 7) Create the surface object with gradient
		var surfaceId = surfaceName.replace(/\s+/g, "_") + "_" + Date.now();
		var hasVertexColors = useLasColors && vertices.some(function(v) { return v.color; });
		var surface = {
			id: surfaceId,
			name: surfaceName,
			type: "delaunay",
			points: vertices,
			triangles: resultTriangles,
			meshBounds: meshBounds, // CRITICAL: Add meshBounds for centroid calculation
			visible: true,
			gradient: surfaceStyle, // Uses selected gradient style (including "lasColors")
			hasVertexColors: hasVertexColors, // Flag for renderer to use vertex colors
			transparency: 1.0,
			metadata: {
				source: "LAS_import",
				pointCount: vertices.length,
				triangleCount: resultTriangles.length,
				culledByEdge: culledByEdge,
				culledByAngle: culledByAngle,
				maxEdgeLength: maxEdgeLength,
				minAngle: minAngle,
				useLasColors: useLasColors
			}
		};

		// Step 8) Return in surfaces format expected by import system
		return {
			surfaces: new Map([[surfaceId, surface]]),
			dataType: "surfaces"
		};
	}
	// Step 38) Helper: Get default color for classification
	getClassificationColor(classification) {
		var colors = {
			0: "#000000", // Never classified - Black
			1: "#CCCCCC", // Unclassified - Gray
			2: "#8B4513", // Ground - Brown
			3: "#228B22", // Low Vegetation - Forest Green
			4: "#6B8E23", // Medium Vegetation - Olive
			5: "#00FF7F", // High Vegetation - Spring Green
			6: "#FFD700", // Building - Gold
			7: "#FFA500", // Low Point (noise) - Orange
			8: "#9370DB", // Model Key-point - Medium Purple
			9: "#0000FF", // Water - Blue
			10: "#800080", // Rail - Purple
			11: "#696969", // Road Surface - Dim Gray
			12: "#A9A9A9", // Overlap - Dark Gray
			13: "#FFFF00", // Wire Guard - Yellow
			14: "#FFFFE0", // Wire Conductor - Light Yellow
			15: "#90EE90", // Transmission Tower - Light Green
			16: "#FF00FF", // Wire Connector - Magenta
			17: "#ADD8E6", // Bridge Deck - Light Blue
			18: "#FF0000" // High Noise - Red
		};

		return colors[classification] || "#808080"; // Default gray
	}

	// Step 39) Detect coordinate system from LAS header bounds
	detectCoordinateSystem(header) {
		var bbox = [header.minX, header.minY, header.maxX, header.maxY];
		return isLikelyWGS84(bbox);
	}

	// Step 40) Prompt user for import configuration
	async promptForImportConfiguration(filename, isWGS84) {
		return new Promise(function(resolve) {
			// Step 41) Create dialog content HTML
			var contentHTML = '<div style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">';

			// Step 42) File information
			contentHTML += '<div style="text-align: left;">';
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 10px 0;"><strong>File:</strong> ' + filename + "</p>";
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 10px 0;">Detected coordinate system: <strong>' + (isWGS84 ? "WGS84 (latitude/longitude)" : "Projected (UTM/local)") + "</strong></p>";
			contentHTML += '<p class="labelWhite15" style="margin: 0;">LAS files contain point cloud data. How would you like to import this data?</p>';
			contentHTML += "</div>";

			// Step 43) Import type selection
			contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Import As:</p>';

			contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
			contentHTML += '<input type="radio" id="import-pointcloud" name="import-type" value="pointcloud" checked style="margin: 0;">';
			contentHTML += '<label for="import-pointcloud" class="labelWhite15" style="margin: 0; cursor: pointer;">Point Cloud (KAD points by classification)</label>';
			contentHTML += "</div>";

			contentHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
			contentHTML += '<input type="radio" id="import-surface" name="import-type" value="surface" style="margin: 0;">';
			contentHTML += '<label for="import-surface" class="labelWhite15" style="margin: 0; cursor: pointer;">Surface (triangulated mesh)</label>';
			contentHTML += "</div>";

			contentHTML += "</div>";

			// Step 44) Coordinate transformation options (only if WGS84 detected)
			if (isWGS84) {
				contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
				contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Coordinate Transformation:</p>';

				contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
				contentHTML += '<input type="radio" id="keep-wgs84-las" name="transform" value="keep" style="margin: 0;">';
				contentHTML += '<label for="keep-wgs84-las" class="labelWhite15" style="margin: 0; cursor: pointer;">Keep as WGS84 (latitude/longitude)</label>';
				contentHTML += "</div>";

				contentHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
				contentHTML += '<input type="radio" id="transform-utm-las" name="transform" value="transform" checked style="margin: 0;">';
				contentHTML += '<label for="transform-utm-las" class="labelWhite15" style="margin: 0; cursor: pointer;">Transform to projected coordinates</label>';
				contentHTML += "</div>";

				// EPSG dropdown
				contentHTML += '<div id="las-epsg-section" style="margin-top: 10px; display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: center;">';
				contentHTML += '<label class="labelWhite15">EPSG Code:</label>';
				contentHTML += '<select id="las-import-epsg-code" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
				contentHTML += '<option value="">-- Select EPSG Code --</option>';

				// Add EPSG codes
				top100EPSGCodes.forEach(function(item) {
					contentHTML += '<option value="' + item.code + '">' + item.code + " - " + item.name + "</option>";
				});

				contentHTML += "</select>";
				contentHTML += "</div>";

				// Custom Proj4
				contentHTML += '<div style="margin-top: 8px; display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: start;">';
				contentHTML += '<label class="labelWhite15" style="padding-top: 4px;">Or Custom Proj4:</label>';
				contentHTML += '<textarea id="las-import-custom-proj4" placeholder="+proj=utm +zone=50 +south +datum=WGS84 +units=m +no_defs" style="height: 60px; padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 11px; font-family: monospace; resize: vertical;"></textarea>';
				contentHTML += "</div>";

				contentHTML += "</div>";
			}

			// Step 45) Master RL offset
			// contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
			// contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Master Reference Location (Optional):</p>';
			// contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-size: 11px; opacity: 0.8;">Apply offset to all imported coordinates</p>';

			// contentHTML += '<div style="display: grid; grid-template-columns: 80px 1fr 80px 1fr; gap: 8px; align-items: center;">';
			// contentHTML += '<label class="labelWhite15">Easting:</label>';
			// contentHTML += '<input type="number" id="las-master-rl-x" value="0" step="0.001" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			// contentHTML += '<label class="labelWhite15">Northing:</label>';
			// contentHTML += '<input type="number" id="las-master-rl-y" value="0" step="0.001" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			// contentHTML += "</div>";

			// contentHTML += "</div>";

			// Step 46) Point decimation options (shown for Point Cloud import)
			contentHTML += '<div id="las-pointcloud-options" style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Point Cloud Options:</p>';

			// Max Points (decimation)
			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">Max Points:</label>';
			contentHTML += '<input type="number" id="las-max-points" value="50000" min="1000" max="1000000" step="1000" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += '<p class="labelWhite15" style="font-size: 10px; opacity: 0.7; margin: 2px 0 0 0; grid-column: 2;">Decimates to this count (0 = no limit).</p>';
			contentHTML += "</div>";

			// XY Tolerance (deduplication)
			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">XY Tolerance:</label>';
			contentHTML += '<input type="number" id="las-pc-xy-tolerance" value="0.01" min="0" max="10" step="0.001" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += '<p class="labelWhite15" style="font-size: 10px; opacity: 0.7; margin: 2px 0 0 0; grid-column: 2;">Deduplicates points within XY distance (0 = disabled).</p>';
			contentHTML += "</div>";

			// Classification Filter
			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">Classification Filter:</label>';
			contentHTML += '<select id="las-classification-filter" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += '<option value="all">All Classifications</option>';
			contentHTML += '<option value="ground">Ground Only (2)</option>';
			contentHTML += '<option value="vegetation">Vegetation (3,4,5)</option>';
			contentHTML += '<option value="buildings">Buildings (6)</option>';
			contentHTML += '<option value="unclassified">Unclassified Only (1)</option>';
			contentHTML += "</select>";
			contentHTML += "</div>";

			// Preserve LAS Colors
			contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">';
			contentHTML += '<input type="checkbox" id="las-pc-preserve-colors" checked style="margin: 0;">';
			contentHTML += '<label for="las-pc-preserve-colors" class="labelWhite15" style="margin: 0; cursor: pointer; font-size: 11px;">Preserve LAS point colors (if available)</label>';
			contentHTML += "</div>";

			contentHTML += "</div>";

			// Step 46b) Surface triangulation options (shown for Surface import)
			contentHTML += '<div id="las-surface-options" style="display: none; border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Surface Triangulation Options:</p>';

			// Surface Name
			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">Surface Name:</label>';
			contentHTML += '<input type="text" id="las-surface-name" value="LAS_Surface" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += "</div>";

			// Max Edge Length
			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">Max Edge Length:</label>';
			contentHTML += '<input type="number" id="las-max-edge-length" value="0" min="0" max="10000" step="1" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += '<p class="labelWhite15" style="font-size: 10px; opacity: 0.7; margin: 2px 0 0 0; grid-column: 2;">0 = disabled. Removes convex hull triangles with long edges.</p>';
			contentHTML += "</div>";

			// Consider 3D Edge Length
			contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; margin-left: 140px;">';
			contentHTML += '<input type="checkbox" id="las-consider-3d-length" style="margin: 0;">';
			contentHTML += '<label for="las-consider-3d-length" class="labelWhite15" style="margin: 0; cursor: pointer; font-size: 11px;">Consider 3D edge length (includes Z difference)</label>';
			contentHTML += "</div>";

			// Min Internal Angle
			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">Min Internal Angle:</label>';
			contentHTML += '<input type="number" id="las-min-angle" value="0" min="0" max="60" step="1" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += '<p class="labelWhite15" style="font-size: 10px; opacity: 0.7; margin: 2px 0 0 0; grid-column: 2;">0 = disabled. Removes skinny triangles (degrees).</p>';
			contentHTML += "</div>";

			// Consider 3D Angle
			contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; margin-left: 140px;">';
			contentHTML += '<input type="checkbox" id="las-consider-3d-angle" style="margin: 0;">';
			contentHTML += '<label for="las-consider-3d-angle" class="labelWhite15" style="margin: 0; cursor: pointer; font-size: 11px;">Consider 3D angle (includes Z in calculation)</label>';
			contentHTML += "</div>";

			// XY Tolerance (for deduplication)
			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">XY Tolerance:</label>';
			contentHTML += '<input type="number" id="las-xyz-tolerance" value="0.001" min="0.001" max="10" step="0.001" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += '<p class="labelWhite15" style="font-size: 10px; opacity: 0.7; margin: 2px 0 0 0; grid-column: 2;">Merge points within this XY distance.</p>';
			contentHTML += "</div>";

			// Max Surface Points (decimation before triangulation)
			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">Max Surface Points:</label>';
			contentHTML += '<input type="number" id="las-max-surface-points" value="0" min="0" max="5000000" step="10000" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += '<p class="labelWhite15" style="font-size: 10px; opacity: 0.7; margin: 2px 0 0 0; grid-column: 2;">0 = no limit. Decimates before triangulation.</p>';
			contentHTML += "</div>";

			// Surface Style (gradient)
			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">Surface Style:</label>';
			contentHTML += '<select id="las-surface-style" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += '<option value="default">Default (elevation)</option>';
			contentHTML += '<option value="lasColors">LAS Point Colors</option>';
			contentHTML += '<option value="hillshade">Hillshade</option>';
			contentHTML += '<option value="viridis">Viridis</option>';
			contentHTML += '<option value="turbo">Turbo</option>';
			contentHTML += '<option value="parula">Parula</option>';
			contentHTML += '<option value="cividis">Cividis</option>';
			contentHTML += '<option value="terrain">Terrain</option>';
			contentHTML += "</select>";
			contentHTML += '<p class="labelWhite15" style="font-size: 10px; opacity: 0.7; margin: 2px 0 0 0; grid-column: 2;">LAS Point Colors uses RGB from LAS file (if available).</p>';
			contentHTML += "</div>";

			contentHTML += "</div>";

			// Error message
			contentHTML += '<div id="las-import-error-message" style="display: none; margin-top: 8px; padding: 6px; background: #f44336; color: white; border-radius: 3px; font-size: 11px;"></div>';

			contentHTML += "</div>";

			// Step 47) Create dialog
			var dialog = new window.FloatingDialog({
				title: "Import LAS Point Cloud",
				content: contentHTML,
				layoutType: "default",
				width: 650,
				height: 780,
				showConfirm: true,
				showCancel: true,
				confirmText: "Import",
				cancelText: "Cancel",
				onConfirm: async function() {
					try {
						// Get form values
						var importType = document.querySelector('input[name="import-type"]:checked').value;
						var maxPoints = parseInt(document.getElementById("las-max-points").value) || 0;
						var classificationFilter = document.getElementById("las-classification-filter").value;
						var errorDiv = document.getElementById("las-import-error-message");

						var config = { cancelled: false, importType: importType, maxPoints: maxPoints, classificationFilter: classificationFilter, transform: false, epsgCode: null, proj4Source: null };

						// Step 47a) Get point cloud options
						if (importType === "pointcloud") {
							config.pcXyTolerance = parseFloat(document.getElementById("las-pc-xy-tolerance").value) || 0;
							config.pcPreserveColors = document.getElementById("las-pc-preserve-colors").checked;
						}

						// Step 47b) Get surface triangulation options if surface import selected
						if (importType === "surface") {
							config.surfaceName = document.getElementById("las-surface-name").value || "LAS_Surface";
							config.maxEdgeLength = parseFloat(document.getElementById("las-max-edge-length").value) || 0;
							config.consider3DLength = document.getElementById("las-consider-3d-length").checked;
							config.minAngle = parseFloat(document.getElementById("las-min-angle").value) || 0;
							config.consider3DAngle = document.getElementById("las-consider-3d-angle").checked;
							config.xyzTolerance = parseFloat(document.getElementById("las-xyz-tolerance").value) || 0.001;
							config.maxSurfacePoints = parseInt(document.getElementById("las-max-surface-points").value) || 0;
							config.surfaceStyle = document.getElementById("las-surface-style").value || "default";
						}

						// Check transformation options if WGS84
						if (isWGS84) {
							var transformRadio = document.querySelector('input[name="transform"]:checked');
							if (transformRadio && transformRadio.value === "transform") {
								config.masterRLX = masterRLX;
								config.masterRLY = masterRLY;
								config.transform = true;
								var epsgCode = document.getElementById("las-import-epsg-code").value.trim();
								var customProj4 = document.getElementById("las-import-custom-proj4").value.trim();

								if (!epsgCode && !customProj4) {
									errorDiv.textContent = "Please select an EPSG code or provide a custom Proj4 definition for transformation";
									errorDiv.style.display = "block";
									return;
								}

								config.epsgCode = epsgCode || null;
								config.proj4Source = customProj4 || null;

								// Load EPSG definition if needed
								if (epsgCode) {
									await window.loadEPSGCode(epsgCode);
								}
							}
						}

						dialog.close();
						resolve(config);
					} catch (error) {
						var errorDiv = document.getElementById("las-import-error-message");
						if (errorDiv) {
							errorDiv.textContent = "Configuration error: " + error.message;
							errorDiv.style.display = "block";
						}
						console.error("LAS import configuration error:", error);
					}
				},
				onCancel: function() {
					dialog.close();
					resolve({ cancelled: true });
				}
			});

			dialog.show();

			// Toggle EPSG section visibility
			if (isWGS84) {
				var transformRadios = document.querySelectorAll('input[name="transform"]');
				var epsgSection = document.getElementById("las-epsg-section");

				transformRadios.forEach(function(radio) {
					radio.addEventListener("change", function() {
						if (radio.value === "transform") {
							epsgSection.style.display = "grid";
						} else {
							epsgSection.style.display = "none";
						}
					});
				});
			}

			// Step 47b) Toggle Point Cloud / Surface options visibility based on import type
			var importTypeRadios = document.querySelectorAll('input[name="import-type"]');
			var pointcloudOptions = document.getElementById("las-pointcloud-options");
			var surfaceOptions = document.getElementById("las-surface-options");

			importTypeRadios.forEach(function(radio) {
				radio.addEventListener("change", function() {
					if (radio.value === "surface" && radio.checked) {
						pointcloudOptions.style.display = "none";
						surfaceOptions.style.display = "block";
					} else if (radio.value === "pointcloud" && radio.checked) {
						pointcloudOptions.style.display = "block";
						surfaceOptions.style.display = "none";
					}
				});
			});
		});
	}

	// Step 48) Apply coordinate transformation to points
	async applyCoordinateTransformation(data, config) {
		if (!config.transform) {
			return data;
		}

		console.log("Transforming LAS coordinates from WGS84 to projected system...");

		var sourceDef = "+proj=longlat +datum=WGS84 +no_defs";
		var targetDef = config.proj4Source || "EPSG:" + config.epsgCode;

		// Transform each point
		for (var i = 0; i < data.points.length; i++) {
			var point = data.points[i];
			var transformed = proj4(sourceDef, targetDef, [point.x, point.y]);

			point.x = transformed[0];
			point.y = transformed[1];
			// Z coordinate typically stays the same (elevation)
		}

		// Update header bounds
		var stats = this.calculateStatistics(data.points, data.header);
		data.header.minX = stats.minX;
		data.header.maxX = stats.maxX;
		data.header.minY = stats.minY;
		data.header.maxY = stats.maxY;

		return data;
	}

	// Step 49) Apply master RL offset NOT NEEDED
	// applyMasterRLOffset(data, offsetX, offsetY) {
	// 	if (offsetX === 0 && offsetY === 0) {
	// 		return data;
	// 	}

	// 	console.log("Applying master RL offset:", offsetX, offsetY);

	// 	for (var i = 0; i < data.points.length; i++) {
	// 		data.points[i].x += offsetX;
	// 		data.points[i].y += offsetY;
	// 	}

	// 	// Update header bounds
	// 	var stats = this.calculateStatistics(data.points, data.header);
	// 	data.header.minX = stats.minX;
	// 	data.header.maxX = stats.maxX;
	// 	data.header.minY = stats.minY;
	// 	data.header.maxY = stats.maxY;

	// 	return data;
	// }
}

export default LASParser;
