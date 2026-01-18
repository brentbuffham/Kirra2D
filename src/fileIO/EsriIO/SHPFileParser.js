//Placeholder for the Esri Shape file Parser.
// src/fileIO/ShapefileIO/SHPFileParser.js
//=============================================================
// SHAPEFILE PARSER - ESRI Shapefile to KAD
//=============================================================
// Step 1) Parses ESRI Shapefiles (.shp, .shx, .dbf, .prj) to KAD entities
// Step 2) Based on ESRI Shapefile Technical Description (July 1998)
// Step 3) Supports: Point, PolyLine, Polygon, MultiPoint, PointZ, PolyLineZ, PolygonZ, MultiPointZ
// Step 4) Handles big-endian and little-endian byte ordering per spec
// Step 5) Created: 2026-01-16

import BaseParser from "../BaseParser.js";
import proj4 from "proj4";
import { top100EPSGCodes } from "../../dialog/popups/generic/ProjectionDialog.js";

// Step 6) Shape type constants (from ESRI spec)
const SHAPE_TYPE = {
	NULL: 0,
	POINT: 1,
	POLYLINE: 3,
	POLYGON: 5,
	MULTIPOINT: 8,
	POINTZ: 11,
	POLYLINEZ: 13,
	POLYGONZ: 15,
	MULTIPOINTZ: 18,
	POINTM: 21,
	POLYLINEM: 23,
	POLYGONM: 25,
	MULTIPOINTM: 28,
	MULTIPATCH: 31
};

// Step 7) Shape type names for logging
const SHAPE_TYPE_NAMES = {
	0: "Null Shape",
	1: "Point",
	3: "PolyLine",
	5: "Polygon",
	8: "MultiPoint",
	11: "PointZ",
	13: "PolyLineZ",
	15: "PolygonZ",
	18: "MultiPointZ",
	21: "PointM",
	23: "PolyLineM",
	25: "PolygonM",
	28: "MultiPointM",
	31: "MultiPatch"
};

// Step 8) SHPFileParser class
class SHPFileParser extends BaseParser {
	constructor(options = {}) {
		super(options);

		// Step 9) Parser options
		this.offsetX = options.offsetX || 0;
		this.offsetY = options.offsetY || 0;
		this.showProgress = options.showProgress !== false;
		this.useLayerFromDBF = options.useLayerFromDBF || null; // DBF field name to use for layer naming
		this.defaultLayerName = options.defaultLayerName || "SHP_Import";
	}

	// Step 10) Main parse method - expects object with ArrayBuffers
	async parse(data) {
		try {
			// Step 11) Validate input - expect shp buffer, optional shx, dbf, prj
			if (!data || !data.shpBuffer) {
				throw new Error("Invalid input: shpBuffer (ArrayBuffer) required");
			}

			var shpBuffer = data.shpBuffer;
			var shxBuffer = data.shxBuffer || null;
			var dbfBuffer = data.dbfBuffer || null;
			var prjString = data.prjString || null;

			// Step 12) Parse the shapefile (initial parsing without transformation)
			var rawData = await this.parseShapefile(shpBuffer, shxBuffer, dbfBuffer, prjString);

			// Step 13) Detect coordinate system from PRJ file or bounds
			var isWGS84 = this.detectCoordinateSystem(rawData.header, prjString);

			// Step 14) Prompt user for import configuration
			var config = await this.promptForImportConfiguration("shapefile.shp", isWGS84, prjString);

			if (config.cancelled) {
				return { success: false, cancelled: true, message: "Import cancelled by user" };
			}

			// Step 15) Apply coordinate transformations if needed
			if (config.transform) {
				rawData = await this.applyCoordinateTransformation(rawData, config);
			}

			// Step 16) Apply master RL offset if specified
			if (config.masterRLX !== 0 || config.masterRLY !== 0) {
				rawData = this.applyMasterRLOffset(rawData, config.masterRLX, config.masterRLY);
			}

			// Step 17) Convert to kadDrawingsMap format for Kirra compatibility
			rawData.kadDrawingsMap = rawData.kadDrawings;

			// Step 18) Return final processed data
			return {
				...rawData,
				config: config,
				success: true
			};
		} catch (error) {
			console.error("Shapefile parse error:", error);
			throw error;
		}
	}

	// Step 13) Parse shapefile components
	async parseShapefile(shpBuffer, shxBuffer, dbfBuffer, prjString) {
		// Step 14) Create DataView for binary reading
		var shpView = new DataView(shpBuffer);

		// Step 15) Parse main file header (100 bytes)
		var header = this.parseMainFileHeader(shpView);
		console.log("Shapefile Header:", header);
		console.log("Shape Type:", SHAPE_TYPE_NAMES[header.shapeType] || "Unknown");

		// Step 16) Parse DBF if provided
		var dbfRecords = [];
		var dbfFields = [];
		if (dbfBuffer) {
			var dbfResult = this.parseDBF(dbfBuffer);
			dbfRecords = dbfResult.records;
			dbfFields = dbfResult.fields;
			console.log(
				"DBF Fields:",
				dbfFields.map(function(f) {
					return f.name;
				})
			);
			console.log("DBF Records:", dbfRecords.length);
		}

		// Step 17) Parse index file if provided (for validation/faster access)
		var indexRecords = [];
		if (shxBuffer) {
			indexRecords = this.parseIndexFile(shxBuffer);
			console.log("Index Records:", indexRecords.length);
		}

		// Step 18) Create progress dialog
		var progressDialog = null;
		var progressBar = null;
		var progressText = null;

		if (this.showProgress && window.FloatingDialog) {
			var progressContent = "<p>Parsing Shapefile</p>" + "<p>Please wait, this may take a moment...</p>" + '<div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">' + '<div id="shpProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>' + "</div>" + '<p id="shpProgressText">Initializing...</p>';

			progressDialog = new window.FloatingDialog({
				title: "Shapefile Import Progress",
				content: progressContent,
				layoutType: "standard",
				width: 400,
				height: 200,
				showConfirm: false,
				showCancel: false,
				draggable: true
			});

			progressDialog.show();

			await new Promise(function(resolve) {
				setTimeout(resolve, 50);
			});

			progressBar = document.getElementById("shpProgressBar");
			progressText = document.getElementById("shpProgressText");
		}

		// Step 19) Initialize result maps
		var kadDrawingsMap = new Map();
		var counts = {
			point: 0,
			line: 0,
			poly: 0,
			multipoint: 0,
			null: 0
		};

		// Step 20) Parse shape records
		var offset = 100; // Start after header
		var recordNumber = 0;
		var totalFileSize = header.fileLength * 2; // Convert from 16-bit words to bytes

		while (offset < totalFileSize) {
			// Step 21) Update progress
			if (progressBar && progressText) {
				var percent = Math.round(offset / totalFileSize * 100);
				progressBar.style.width = percent + "%";
				progressText.textContent = "Processing record " + (recordNumber + 1) + "...";

				// Yield to UI every 50 records
				if (recordNumber % 50 === 0) {
					await new Promise(function(resolve) {
						setTimeout(resolve, 0);
					});
				}
			}

			// Step 22) Parse record header (8 bytes, big-endian)
			if (offset + 8 > shpBuffer.byteLength) {
				console.warn("Unexpected end of file at offset", offset);
				break;
			}

			var recNumber = shpView.getInt32(offset, false); // Big-endian
			var contentLength = shpView.getInt32(offset + 4, false); // Big-endian (16-bit words)
			var contentLengthBytes = contentLength * 2;

			offset += 8; // Move past record header

			// Step 23) Validate record
			if (offset + contentLengthBytes > shpBuffer.byteLength) {
				console.warn("Record", recNumber, "extends beyond file end");
				break;
			}

			// Step 24) Get DBF attributes for this record
			var attributes = dbfRecords[recordNumber] || {};

			// Step 25) Parse shape based on type
			var shapeType = shpView.getInt32(offset, true); // Little-endian

			// Step 26) Determine entity name from DBF or default
			var entityName = this.getEntityName(attributes, recordNumber, header.shapeType);

			// Step 27) Parse the shape record
			var parseResult = this.parseShapeRecord(shpView, offset, shapeType, entityName, attributes, kadDrawingsMap, counts);

			offset += contentLengthBytes;
			recordNumber++;
		}

		// Step 28) Close progress dialog
		if (progressDialog) {
			if (progressBar) progressBar.style.width = "100%";
			if (progressText) progressText.textContent = "Import complete!";
			setTimeout(function() {
				progressDialog.close();
			}, 500);
		}

		// Step 29) Log summary
		console.log("=== Shapefile Import Summary ===");
		console.log("Total records:", recordNumber);
		console.log("Points:", counts.point);
		console.log("Lines:", counts.line);
		console.log("Polygons:", counts.poly);
		console.log("MultiPoints:", counts.multipoint);
		console.log("Null shapes:", counts.null);
		console.log("KAD entities created:", kadDrawingsMap.size);

		// Step 30) Return parsed data
		return {
			kadDrawings: kadDrawingsMap,
			header: header,
			projection: prjString,
			dbfFields: dbfFields,
			entityCounts: counts
		};
	}

	// Step 31) Parse main file header (100 bytes)
	parseMainFileHeader(view) {
		// Bytes 0-3: File Code (9994, big-endian)
		var fileCode = view.getInt32(0, false);
		if (fileCode !== 9994) {
			throw new Error("Invalid shapefile: File code is " + fileCode + ", expected 9994");
		}

		// Bytes 4-23: Unused
		// Byte 24-27: File Length (big-endian, in 16-bit words)
		var fileLength = view.getInt32(24, false);

		// Byte 28-31: Version (little-endian, should be 1000)
		var version = view.getInt32(28, true);

		// Byte 32-35: Shape Type (little-endian)
		var shapeType = view.getInt32(32, true);

		// Bytes 36-99: Bounding Box (little-endian doubles)
		var xMin = view.getFloat64(36, true);
		var yMin = view.getFloat64(44, true);
		var xMax = view.getFloat64(52, true);
		var yMax = view.getFloat64(60, true);
		var zMin = view.getFloat64(68, true);
		var zMax = view.getFloat64(76, true);
		var mMin = view.getFloat64(84, true);
		var mMax = view.getFloat64(92, true);

		return {
			fileCode: fileCode,
			fileLength: fileLength,
			version: version,
			shapeType: shapeType,
			shapeTypeName: SHAPE_TYPE_NAMES[shapeType] || "Unknown",
			boundingBox: {
				xMin: xMin,
				yMin: yMin,
				xMax: xMax,
				yMax: yMax,
				zMin: zMin,
				zMax: zMax,
				mMin: mMin,
				mMax: mMax
			}
		};
	}

	// Step 32) Parse shape record based on type
	parseShapeRecord(view, offset, shapeType, entityName, attributes, kadDrawingsMap, counts) {
		var offsetX = this.offsetX;
		var offsetY = this.offsetY;

		switch (shapeType) {
			case SHAPE_TYPE.NULL:
				counts.null++;
				return null;

			case SHAPE_TYPE.POINT:
				return this.parsePoint(view, offset, entityName, attributes, kadDrawingsMap, counts, false);

			case SHAPE_TYPE.POINTZ:
				return this.parsePoint(view, offset, entityName, attributes, kadDrawingsMap, counts, true);

			case SHAPE_TYPE.POINTM:
				return this.parsePointM(view, offset, entityName, attributes, kadDrawingsMap, counts);

			case SHAPE_TYPE.MULTIPOINT:
				return this.parseMultiPoint(view, offset, entityName, attributes, kadDrawingsMap, counts, false);

			case SHAPE_TYPE.MULTIPOINTZ:
				return this.parseMultiPoint(view, offset, entityName, attributes, kadDrawingsMap, counts, true);

			case SHAPE_TYPE.POLYLINE:
			case SHAPE_TYPE.POLYLINEM:
				return this.parsePolyLine(view, offset, entityName, attributes, kadDrawingsMap, counts, false, false);

			case SHAPE_TYPE.POLYLINEZ:
				return this.parsePolyLine(view, offset, entityName, attributes, kadDrawingsMap, counts, true, false);

			case SHAPE_TYPE.POLYGON:
			case SHAPE_TYPE.POLYGONM:
				return this.parsePolyLine(view, offset, entityName, attributes, kadDrawingsMap, counts, false, true);

			case SHAPE_TYPE.POLYGONZ:
				return this.parsePolyLine(view, offset, entityName, attributes, kadDrawingsMap, counts, true, true);

			case SHAPE_TYPE.MULTIPATCH:
				console.warn("MultiPatch shapes not yet supported");
				return null;

			default:
				console.warn("Unknown shape type:", shapeType);
				return null;
		}
	}

	// Step 33) Parse Point shape
	parsePoint(view, offset, entityName, attributes, kadDrawingsMap, counts, hasZ) {
		// Shape type already read, skip it
		offset += 4;

		var x = view.getFloat64(offset, true) - this.offsetX;
		var y = view.getFloat64(offset + 8, true) - this.offsetY;
		var z = 0;

		if (hasZ) {
			z = view.getFloat64(offset + 16, true);
		}

		counts.point++;

		var uniqueName = this.getUniqueEntityName(entityName, "point", kadDrawingsMap);
		var color = this.getColorFromAttributes(attributes);

		kadDrawingsMap.set(uniqueName, {
			entityName: uniqueName,
			entityType: "point",
			attributes: attributes,
			data: [
				{
					entityName: uniqueName,
					entityType: "point",
					pointID: 1,
					pointXLocation: x,
					pointYLocation: y,
					pointZLocation: z,
					color: color
				}
			]
		});

		return uniqueName;
	}

	// Step 34) Parse PointM shape
	parsePointM(view, offset, entityName, attributes, kadDrawingsMap, counts) {
		offset += 4; // Skip shape type

		var x = view.getFloat64(offset, true) - this.offsetX;
		var y = view.getFloat64(offset + 8, true) - this.offsetY;
		var m = view.getFloat64(offset + 16, true);

		counts.point++;

		var uniqueName = this.getUniqueEntityName(entityName, "point", kadDrawingsMap);
		var color = this.getColorFromAttributes(attributes);

		kadDrawingsMap.set(uniqueName, {
			entityName: uniqueName,
			entityType: "point",
			attributes: attributes,
			data: [
				{
					entityName: uniqueName,
					entityType: "point",
					pointID: 1,
					pointXLocation: x,
					pointYLocation: y,
					pointZLocation: 0,
					measure: m,
					color: color
				}
			]
		});

		return uniqueName;
	}

	// Step 35) Parse MultiPoint shape
	parseMultiPoint(view, offset, entityName, attributes, kadDrawingsMap, counts, hasZ) {
		offset += 4; // Skip shape type

		// Bounding box (32 bytes)
		offset += 32;

		// Number of points
		var numPoints = view.getInt32(offset, true);
		offset += 4;

		counts.multipoint++;

		var uniqueName = this.getUniqueEntityName(entityName, "point", kadDrawingsMap);
		var color = this.getColorFromAttributes(attributes);
		var data = [];

		// Read X,Y coordinates
		var pointsOffset = offset;
		for (var i = 0; i < numPoints; i++) {
			var x = view.getFloat64(pointsOffset + i * 16, true) - this.offsetX;
			var y = view.getFloat64(pointsOffset + i * 16 + 8, true) - this.offsetY;

			data.push({
				entityName: uniqueName,
				entityType: "point",
				pointID: i + 1,
				pointXLocation: x,
				pointYLocation: y,
				pointZLocation: 0,
				color: color
			});
		}

		// Read Z values if present
		if (hasZ) {
			var zOffset = pointsOffset + numPoints * 16 + 16; // Skip Z range
			for (var j = 0; j < numPoints; j++) {
				data[j].pointZLocation = view.getFloat64(zOffset + j * 8, true);
			}
		}

		kadDrawingsMap.set(uniqueName, {
			entityName: uniqueName,
			entityType: "point",
			attributes: attributes,
			data: data
		});

		return uniqueName;
	}

	// Step 36) Parse PolyLine or Polygon shape
	parsePolyLine(view, offset, entityName, attributes, kadDrawingsMap, counts, hasZ, isPolygon) {
		offset += 4; // Skip shape type

		// Bounding box (32 bytes)
		offset += 32;

		// Number of parts and points
		var numParts = view.getInt32(offset, true);
		var numPoints = view.getInt32(offset + 4, true);
		offset += 8;

		// Read parts array (indices to first point of each part)
		var parts = [];
		for (var i = 0; i < numParts; i++) {
			parts.push(view.getInt32(offset + i * 4, true));
		}
		offset += numParts * 4;

		// Read points
		var points = [];
		for (var j = 0; j < numPoints; j++) {
			var x = view.getFloat64(offset + j * 16, true) - this.offsetX;
			var y = view.getFloat64(offset + j * 16 + 8, true) - this.offsetY;
			points.push({ x: x, y: y, z: 0 });
		}
		offset += numPoints * 16;

		// Read Z values if present
		if (hasZ) {
			offset += 16; // Skip Z range
			for (var k = 0; k < numPoints; k++) {
				points[k].z = view.getFloat64(offset + k * 8, true);
			}
		}

		// Create KAD entities for each part
		var entityType = isPolygon ? "poly" : "line";
		if (isPolygon) {
			counts.poly++;
		} else {
			counts.line++;
		}

		// For single-part shapes, create one entity
		// For multi-part shapes, create one entity per part with _Part suffix
		for (var p = 0; p < numParts; p++) {
			var startIdx = parts[p];
			var endIdx = p < numParts - 1 ? parts[p + 1] : numPoints;

			var partName = numParts > 1 ? entityName + "_Part" + (p + 1) : entityName;
			var uniqueName = this.getUniqueEntityName(partName, entityType, kadDrawingsMap);
			var color = this.getColorFromAttributes(attributes);

			var data = [];
			for (var idx = startIdx; idx < endIdx; idx++) {
				var pt = points[idx];
				data.push({
					entityName: uniqueName,
					entityType: entityType,
					pointID: idx - startIdx + 1,
					pointXLocation: pt.x,
					pointYLocation: pt.y,
					pointZLocation: pt.z,
					lineWidth: 1,
					color: color,
					closed: isPolygon
				});
			}

			kadDrawingsMap.set(uniqueName, {
				entityName: uniqueName,
				entityType: entityType,
				attributes: attributes,
				data: data
			});
		}

		return entityName;
	}

	// Step 37) Parse dBASE file
	parseDBF(buffer) {
		var view = new DataView(buffer);
		var fields = [];
		var records = [];

		// DBF Header
		var version = view.getUint8(0);
		var numRecords = view.getUint32(4, true);
		var headerLength = view.getUint16(8, true);
		var recordLength = view.getUint16(10, true);

		console.log("DBF Version:", version.toString(16));
		console.log("DBF Records:", numRecords);
		console.log("DBF Header Length:", headerLength);
		console.log("DBF Record Length:", recordLength);

		// Parse field descriptors (32 bytes each, starting at byte 32)
		var fieldOffset = 32;
		while (fieldOffset < headerLength - 1) {
			var firstByte = view.getUint8(fieldOffset);
			if (firstByte === 0x0d) break; // Field descriptor terminator

			var fieldName = this.readString(buffer, fieldOffset, 11).replace(/\0/g, "").trim();
			var fieldType = String.fromCharCode(view.getUint8(fieldOffset + 11));
			var fieldLength = view.getUint8(fieldOffset + 16);
			var decimalCount = view.getUint8(fieldOffset + 17);

			fields.push({
				name: fieldName,
				type: fieldType,
				length: fieldLength,
				decimals: decimalCount
			});

			fieldOffset += 32;
		}

		// Parse records
		var recordOffset = headerLength;
		for (var i = 0; i < numRecords; i++) {
			var record = {};
			var deleted = view.getUint8(recordOffset);

			if (deleted === 0x2a) {
				// Deleted record marker '*'
				recordOffset += recordLength;
				records.push(null);
				continue;
			}

			var fieldPos = recordOffset + 1; // Skip deletion flag
			for (var j = 0; j < fields.length; j++) {
				var field = fields[j];
				var value = this.readString(buffer, fieldPos, field.length).trim();

				// Convert based on field type
				if (field.type === "N" || field.type === "F") {
					value = value === "" ? null : parseFloat(value);
				} else if (field.type === "L") {
					value = value === "T" || value === "Y" || value === "t" || value === "y";
				}

				record[field.name] = value;
				fieldPos += field.length;
			}

			records.push(record);
			recordOffset += recordLength;
		}

		return { fields: fields, records: records };
	}

	// Step 38) Parse index file (.shx)
	parseIndexFile(buffer) {
		var view = new DataView(buffer);
		var records = [];

		// Skip 100-byte header
		var offset = 100;
		var fileLength = view.getInt32(24, false) * 2; // Big-endian, convert to bytes

		while (offset < fileLength) {
			var recordOffset = view.getInt32(offset, false) * 2; // Big-endian, convert to bytes
			var contentLength = view.getInt32(offset + 4, false) * 2;

			records.push({
				offset: recordOffset,
				contentLength: contentLength
			});

			offset += 8;
		}

		return records;
	}

	// Step 39) Read string from buffer
	readString(buffer, offset, length) {
		var bytes = new Uint8Array(buffer, offset, length);
		var str = "";
		for (var i = 0; i < bytes.length; i++) {
			if (bytes[i] === 0) break;
			str += String.fromCharCode(bytes[i]);
		}
		return str;
	}

	// Step 40) Get entity name from attributes or generate default
	getEntityName(attributes, recordNumber, shapeType) {
		// Try to use specified DBF field
		if (this.useLayerFromDBF && attributes[this.useLayerFromDBF]) {
			return String(attributes[this.useLayerFromDBF]);
		}

		// Try common name fields
		var nameFields = ["NAME", "name", "Name", "LAYER", "layer", "Layer", "ID", "id", "FID", "OBJECTID"];
		for (var i = 0; i < nameFields.length; i++) {
			if (attributes[nameFields[i]]) {
				return String(attributes[nameFields[i]]);
			}
		}

		// Generate default name based on shape type
		var typeNames = {
			1: "Point",
			3: "Line",
			5: "Polygon",
			8: "MultiPoint",
			11: "PointZ",
			13: "LineZ",
			15: "PolygonZ",
			18: "MultiPointZ"
		};

		var typeName = typeNames[shapeType] || "Shape";
		return this.defaultLayerName + "_" + typeName + "_" + (recordNumber + 1);
	}

	// Step 41) Get unique entity name (avoid collisions)
	getUniqueEntityName(baseName, entityType, existingMap) {
		if (!existingMap.has(baseName)) {
			return baseName;
		}

		var counter = 1;
		var uniqueName = baseName + "_" + counter;
		while (existingMap.has(uniqueName)) {
			counter++;
			uniqueName = baseName + "_" + counter;
		}

		return uniqueName;
	}

	// Step 42) Get color from attributes (look for common color fields)
	getColorFromAttributes(attributes) {
		var colorFields = ["COLOR", "color", "Color", "COLOUR", "colour"];
		for (var i = 0; i < colorFields.length; i++) {
			if (attributes[colorFields[i]]) {
				return attributes[colorFields[i]];
			}
		}
		return "#3388FF"; // Default blue
	}
}

// Step 43) Static method to read shapefile from File objects
SHPFileParser.readFromFiles = async function(shpFile, shxFile, dbfFile, prjFile, cpgFile) {
	var result = {
		shpBuffer: null,
		shxBuffer: null,
		dbfBuffer: null,
		prjString: null,
		cpgString: null
	};

	// Read .shp file (required)
	if (shpFile) {
		result.shpBuffer = await shpFile.arrayBuffer();
	}

	// Read .shx file (optional)
	if (shxFile) {
		result.shxBuffer = await shxFile.arrayBuffer();
	}

	// Read .dbf file (optional)
	if (dbfFile) {
		result.dbfBuffer = await dbfFile.arrayBuffer();
	}

	// Read .prj file (optional)
	if (prjFile) {
		result.prjString = await prjFile.text();
	}

	// Read .cpg file (optional)
	if (cpgFile) {
		result.cpgString = await cpgFile.text();
	}

	return result;
};

// Step 44) Convenience method to parse from File objects directly
SHPFileParser.parseFiles = async function(shpFile, shxFile, dbfFile, prjFile, cpgFile, options) {
	var data = await SHPFileParser.readFromFiles(shpFile, shxFile, dbfFile, prjFile, cpgFile);
	var parser = new SHPFileParser(options || {});
	return await parser.parse(data);
};

// Step 44) Detect coordinate system from header bounds and PRJ file
SHPFileParser.prototype.detectCoordinateSystem = function(header, prjString) {
	// If we have a PRJ file, try to detect WGS84 from it
	if (prjString) {
		var prjLower = prjString.toLowerCase();
		if (prjLower.includes("wgs84") || prjLower.includes("wgs_1984") || prjLower.includes("4326")) {
			return true;
		}
	}

	// Fall back to coordinate bounds detection
	var bbox = [header.boundingBox.xMin, header.boundingBox.yMin, header.boundingBox.xMax, header.boundingBox.yMax];
	return isLikelyWGS84 ? isLikelyWGS84(bbox) : false;
};

// Step 45) Prompt user for import configuration
SHPFileParser.prototype.promptForImportConfiguration = async function(filename, isWGS84, prjString) {
	return new Promise(function(resolve) {
		// Step 46) Create dialog content HTML
		var contentHTML = '<div style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">';

		// Step 47) File information
		contentHTML += '<div style="text-align: left;">';
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 10px 0;"><strong>File:</strong> ' + filename + "</p>";
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 10px 0;">Detected coordinate system: <strong>' + (isWGS84 ? "WGS84 (latitude/longitude)" : "Projected (UTM/local)") + "</strong></p>";
		if (prjString) {
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 10px 0;">PRJ file found with projection definition</p>';
		}
		contentHTML += '<p class="labelWhite15" style="margin: 0;">ESRI Shapefiles contain vector geometry (points, lines, polygons).</p>';
		contentHTML += "</div>";

		// Step 48) Import type selection
		contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Import As:</p>';

		contentHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
		contentHTML += '<input type="radio" id="import-geometry-shp" name="import-type" value="geometry" checked style="margin: 0;">';
		contentHTML += '<label for="import-geometry-shp" class="labelWhite15" style="margin: 0; cursor: pointer;">Geometry (KAD entities)</label>';
		contentHTML += "</div>";

		contentHTML += "</div>";

		// Step 49) Coordinate transformation options
		if (isWGS84) {
			contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Coordinate Transformation:</p>';

			contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
			contentHTML += '<input type="radio" id="keep-wgs84-shp" name="transform" value="keep" style="margin: 0;">';
			contentHTML += '<label for="keep-wgs84-shp" class="labelWhite15" style="margin: 0; cursor: pointer;">Keep as WGS84 (latitude/longitude)</label>';
			contentHTML += "</div>";

			contentHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
			contentHTML += '<input type="radio" id="transform-utm-shp" name="transform" value="transform" checked style="margin: 0;">';
			contentHTML += '<label for="transform-utm-shp" class="labelWhite15" style="margin: 0; cursor: pointer;">Transform to projected coordinates</label>';
			contentHTML += "</div>";

			// EPSG dropdown
			contentHTML += '<div id="shp-epsg-section" style="margin-top: 10px; display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: center;">';
			contentHTML += '<label class="labelWhite15">EPSG Code:</label>';
			contentHTML += '<select id="shp-import-epsg-code" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
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
			contentHTML += '<textarea id="shp-import-custom-proj4" placeholder="+proj=utm +zone=50 +south +datum=WGS84 +units=m +no_defs" style="height: 60px; padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 11px; font-family: monospace; resize: vertical;"></textarea>';
			contentHTML += "</div>";

			contentHTML += "</div>";
		}

		// Step 50) Master RL offset
		contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Master Reference Location (Optional):</p>';
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-size: 11px; opacity: 0.8;">Apply offset to all imported coordinates</p>';

		contentHTML += '<div style="display: grid; grid-template-columns: 80px 1fr 80px 1fr; gap: 8px; align-items: center;">';
		contentHTML += '<label class="labelWhite15">Easting:</label>';
		contentHTML += '<input type="number" id="shp-master-rl-x" value="0" step="0.001" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
		contentHTML += '<label class="labelWhite15">Northing:</label>';
		contentHTML += '<input type="number" id="shp-master-rl-y" value="0" step="0.001" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
		contentHTML += "</div>";

		contentHTML += "</div>";

		// Error message
		contentHTML += '<div id="shp-import-error-message" style="display: none; margin-top: 8px; padding: 6px; background: #f44336; color: white; border-radius: 3px; font-size: 11px;"></div>';

		contentHTML += "</div>";

		// Step 51) Create dialog
		var dialog = new window.FloatingDialog({
			title: "Import ESRI Shapefile",
			content: contentHTML,
			layoutType: "default",
			width: 650,
			height: 650,
			showConfirm: true,
			showCancel: true,
			confirmText: "Import",
			cancelText: "Cancel",
			onConfirm: async function() {
				try {
					// Get form values
					var importType = document.querySelector('input[name="import-type"]:checked').value;
					var masterRLX = parseFloat(document.getElementById("shp-master-rl-x").value) || 0;
					var masterRLY = parseFloat(document.getElementById("shp-master-rl-y").value) || 0;
					var errorDiv = document.getElementById("shp-import-error-message");

					var config = {
						cancelled: false,
						importType: importType,
						masterRLX: masterRLX,
						masterRLY: masterRLY,
						transform: false,
						epsgCode: null,
						proj4Source: null
					};

					// Check transformation options if WGS84
					if (isWGS84) {
						var transformRadio = document.querySelector('input[name="transform"]:checked');
						if (transformRadio && transformRadio.value === "transform") {
							config.transform = true;
							var epsgCode = document.getElementById("shp-import-epsg-code").value.trim();
							var customProj4 = document.getElementById("shp-import-custom-proj4").value.trim();

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
					var errorDiv = document.getElementById("shp-import-error-message");
					if (errorDiv) {
						errorDiv.textContent = "Configuration error: " + error.message;
						errorDiv.style.display = "block";
					}
					console.error("Shapefile import configuration error:", error);
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
			var epsgSection = document.getElementById("shp-epsg-section");

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
	});
};

// Step 52) Apply coordinate transformation to geometry
SHPFileParser.prototype.applyCoordinateTransformation = async function(data, config) {
	if (!config.transform) {
		return data;
	}

	console.log("Transforming shapefile coordinates from WGS84 to projected system...");

	var sourceDef = "+proj=longlat +datum=WGS84 +no_defs";
	var targetDef = config.proj4Source || "EPSG:" + config.epsgCode;

	// Transform each entity
	for (var [entityName, entityData] of data.kadDrawings.entries()) {
		if (entityData.data && Array.isArray(entityData.data)) {
			entityData.data.forEach(function(point) {
				if (point.pointXLocation !== undefined && point.pointYLocation !== undefined) {
					var transformed = proj4(sourceDef, targetDef, [point.pointXLocation, point.pointYLocation]);
					point.pointXLocation = transformed[0];
					point.pointYLocation = transformed[1];
				}
			});
		}
	}

	// Update header bounds
	var allPoints = [];
	for (var [entityName, entityData] of data.kadDrawings.entries()) {
		if (entityData.data && Array.isArray(entityData.data)) {
			entityData.data.forEach(function(point) {
				allPoints.push({ x: point.pointXLocation, y: point.pointYLocation });
			});
		}
	}

	if (allPoints.length > 0) {
		var minX = Math.min.apply(null, allPoints.map(p => p.x));
		var maxX = Math.max.apply(null, allPoints.map(p => p.x));
		var minY = Math.min.apply(null, allPoints.map(p => p.y));
		var maxY = Math.max.apply(null, allPoints.map(p => p.y));

		data.header.boundingBox.xMin = minX;
		data.header.boundingBox.xMax = maxX;
		data.header.boundingBox.yMin = minY;
		data.header.boundingBox.yMax = maxY;
	}

	return data;
};

// Step 53) Apply master RL offset
SHPFileParser.prototype.applyMasterRLOffset = function(data, offsetX, offsetY) {
	if (offsetX === 0 && offsetY === 0) {
		return data;
	}

	console.log("Applying master RL offset:", offsetX, offsetY);

	for (var [entityName, entityData] of data.kadDrawings.entries()) {
		if (entityData.data && Array.isArray(entityData.data)) {
			entityData.data.forEach(function(point) {
				if (point.pointXLocation !== undefined) point.pointXLocation += offsetX;
				if (point.pointYLocation !== undefined) point.pointYLocation += offsetY;
			});
		}
	}

	// Update header bounds
	var allPoints = [];
	for (var [entityName, entityData] of data.kadDrawings.entries()) {
		if (entityData.data && Array.isArray(entityData.data)) {
			entityData.data.forEach(function(point) {
				allPoints.push({ x: point.pointXLocation, y: point.pointYLocation });
			});
		}
	}

	if (allPoints.length > 0) {
		var minX = Math.min.apply(null, allPoints.map(p => p.x));
		var maxX = Math.max.apply(null, allPoints.map(p => p.x));
		var minY = Math.min.apply(null, allPoints.map(p => p.y));
		var maxY = Math.max.apply(null, allPoints.map(p => p.y));

		data.header.boundingBox.xMin = minX;
		data.header.boundingBox.xMax = maxX;
		data.header.boundingBox.yMin = minY;
		data.header.boundingBox.yMax = maxY;
	}

	return data;
};

export default SHPFileParser;
