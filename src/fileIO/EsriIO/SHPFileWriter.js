//placeholeder for the Shape File Writer.
// src/fileIO/ShapefileIO/SHPFileWriter.js
//=============================================================
// SHAPEFILE WRITER - KAD to ESRI Shapefile
//=============================================================
// Step 1) Exports KAD entities to ESRI Shapefile format (.shp, .shx, .dbf, .prj)
// Step 2) Based on ESRI Shapefile Technical Description (July 1998)
// Step 3) Supports: Point, PolyLine, Polygon, PointZ, PolyLineZ, PolygonZ
// Step 4) Handles big-endian and little-endian byte ordering per spec
// Step 5) Created: 2026-01-16

import BaseWriter from "../BaseWriter.js";

// Step 6) Shape type constants
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

// Step 7) SHPFileWriter class
class SHPFileWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 8) Writer options
		this.useZ = options.useZ !== false; // Default true - export Z coordinates
		this.projectionWKT = options.projectionWKT || null;
		this.encoding = options.encoding || "UTF-8";
		this.decimalPlaces = options.decimalPlaces !== undefined ? options.decimalPlaces : 6;
	}

	// Step 9) Main write method - returns object with all shapefile components
	async write(data) {
		// Step 10) Validate input
		if (!data) {
			throw new Error("Invalid data: data object required");
		}

		// Step 11) Accept KAD drawings map or array of features
		var features = [];

		if (data.kadDrawingsMap && data.kadDrawingsMap instanceof Map) {
			features = this.kadToFeatures(data.kadDrawingsMap);
		} else if (data.features && Array.isArray(data.features)) {
			features = data.features;
		} else if (Array.isArray(data)) {
			features = data;
		} else {
			throw new Error("Invalid data: kadDrawingsMap, features array, or array of features required");
		}

		if (features.length === 0) {
			throw new Error("No features to export");
		}

		// Step 12) Determine shape type from features
		var shapeType = this.determineShapeType(features);
		console.log("Exporting as shape type:", shapeType);

		// Step 13) Generate shapefile components
		var shpData = this.generateSHP(features, shapeType);
		var shxData = this.generateSHX(shpData.recordOffsets, shpData.recordLengths);
		var dbfData = this.generateDBF(features);
		var prjData = this.generatePRJ();
		var cpgData = this.generateCPG();

		// Step 14) Return all components
		return {
			shp: this.createBlob(shpData.buffer, "application/octet-stream"),
			shx: this.createBlob(shxData, "application/octet-stream"),
			dbf: this.createBlob(dbfData, "application/octet-stream"),
			prj: prjData ? this.createBlob(prjData, "text/plain") : null,
			cpg: this.createBlob(cpgData, "text/plain")
		};
	}

	// Step 15) Convert KAD drawings map to features array
	kadToFeatures(kadDrawingsMap) {
		var features = [];

		for (var [entityName, entityData] of kadDrawingsMap.entries()) {
			var type = entityData.entityType ? entityData.entityType.trim().toLowerCase() : "point";
			var data = entityData.data;

			if (!data || !Array.isArray(data) || data.length === 0) {
				continue;
			}

			// Filter visible points
			var visibleData = data.filter(function(pt) {
				return pt.visible !== false;
			});

			if (visibleData.length === 0) {
				continue;
			}

			// Convert to feature
			var feature = {
				name: entityName,
				type: type,
				attributes: entityData.attributes || {},
				coordinates: []
			};

			// Add name to attributes if not present
			if (!feature.attributes.NAME) {
				feature.attributes.NAME = entityName;
			}

			// Extract coordinates
			for (var i = 0; i < visibleData.length; i++) {
				var pt = visibleData[i];
				feature.coordinates.push({
					x: pt.pointXLocation || 0,
					y: pt.pointYLocation || 0,
					z: pt.pointZLocation || 0
				});
			}

			features.push(feature);
		}

		return features;
	}

	// Step 16) Determine shape type from features
	determineShapeType(features) {
		var hasZ = false;
		var types = { point: 0, line: 0, poly: 0 };

		for (var i = 0; i < features.length; i++) {
			var feature = features[i];
			var type = feature.type ? feature.type.toLowerCase() : "point";

			if (type === "point") {
				types.point++;
			} else if (type === "line") {
				types.line++;
			} else if (type === "poly" || type === "polygon") {
				types.poly++;
			}

			// Check for Z values
			if (feature.coordinates) {
				for (var j = 0; j < feature.coordinates.length; j++) {
					if (feature.coordinates[j].z && feature.coordinates[j].z !== 0) {
						hasZ = true;
						break;
					}
				}
			}
		}

		// Determine dominant type
		var useZ = this.useZ && hasZ;

		if (types.poly > 0 && types.poly >= types.line) {
			return useZ ? SHAPE_TYPE.POLYGONZ : SHAPE_TYPE.POLYGON;
		} else if (types.line > 0) {
			return useZ ? SHAPE_TYPE.POLYLINEZ : SHAPE_TYPE.POLYLINE;
		} else {
			return useZ ? SHAPE_TYPE.POINTZ : SHAPE_TYPE.POINT;
		}
	}

	// Step 17) Generate SHP file content
	generateSHP(features, shapeType) {
		var records = [];
		var recordOffsets = [];
		var recordLengths = [];

		// Step 18) Build records for each feature
		for (var i = 0; i < features.length; i++) {
			var feature = features[i];
			var recordBuffer = this.createShapeRecord(feature, shapeType, i + 1);

			if (recordBuffer) {
				records.push(recordBuffer);
				recordLengths.push(recordBuffer.byteLength);
			}
		}

		// Step 19) Calculate total file size
		var headerSize = 100;
		var totalRecordsSize = 0;
		for (var j = 0; j < records.length; j++) {
			totalRecordsSize += 8 + records[j].byteLength; // 8-byte record header + content
		}
		var totalSize = headerSize + totalRecordsSize;

		// Step 20) Calculate bounding box
		var bbox = this.calculateBoundingBox(features);

		// Step 21) Create file buffer
		var buffer = new ArrayBuffer(totalSize);
		var view = new DataView(buffer);

		// Step 22) Write header
		this.writeMainFileHeader(view, totalSize, shapeType, bbox);

		// Step 23) Write records
		var offset = 100;
		for (var k = 0; k < records.length; k++) {
			recordOffsets.push(offset / 2); // Offset in 16-bit words

			// Record header (big-endian)
			view.setInt32(offset, k + 1, false); // Record number
			view.setInt32(offset + 4, records[k].byteLength / 2, false); // Content length in 16-bit words

			// Record content
			var recordArray = new Uint8Array(records[k]);
			var targetArray = new Uint8Array(buffer, offset + 8, records[k].byteLength);
			targetArray.set(recordArray);

			offset += 8 + records[k].byteLength;
		}

		return {
			buffer: buffer,
			recordOffsets: recordOffsets,
			recordLengths: recordLengths.map(function(len) {
				return len / 2;
			}) // Convert to 16-bit words
		};
	}

	// Step 24) Write main file header (100 bytes)
	writeMainFileHeader(view, fileSize, shapeType, bbox) {
		// File Code (9994, big-endian)
		view.setInt32(0, 9994, false);

		// Unused bytes 4-23
		for (var i = 4; i < 24; i += 4) {
			view.setInt32(i, 0, false);
		}

		// File Length in 16-bit words (big-endian)
		view.setInt32(24, fileSize / 2, false);

		// Version (1000, little-endian)
		view.setInt32(28, 1000, true);

		// Shape Type (little-endian)
		view.setInt32(32, shapeType, true);

		// Bounding Box (little-endian doubles)
		view.setFloat64(36, bbox.xMin, true);
		view.setFloat64(44, bbox.yMin, true);
		view.setFloat64(52, bbox.xMax, true);
		view.setFloat64(60, bbox.yMax, true);
		view.setFloat64(68, bbox.zMin, true);
		view.setFloat64(76, bbox.zMax, true);
		view.setFloat64(84, 0, true); // Mmin
		view.setFloat64(92, 0, true); // Mmax
	}

	// Step 25) Create shape record for a feature
	createShapeRecord(feature, shapeType, recordNumber) {
		var type = feature.type ? feature.type.toLowerCase() : "point";
		var coords = feature.coordinates || [];

		if (coords.length === 0) {
			return null;
		}

		// Dispatch based on shape type
		switch (shapeType) {
			case SHAPE_TYPE.POINT:
				return this.createPointRecord(coords[0], false);

			case SHAPE_TYPE.POINTZ:
				return this.createPointRecord(coords[0], true);

			case SHAPE_TYPE.POLYLINE:
				return this.createPolyLineRecord(coords, false, false);

			case SHAPE_TYPE.POLYLINEZ:
				return this.createPolyLineRecord(coords, true, false);

			case SHAPE_TYPE.POLYGON:
				return this.createPolyLineRecord(coords, false, true);

			case SHAPE_TYPE.POLYGONZ:
				return this.createPolyLineRecord(coords, true, true);

			default:
				console.warn("Unsupported shape type for writing:", shapeType);
				return null;
		}
	}

	// Step 26) Create Point record
	createPointRecord(coord, hasZ) {
		var size = hasZ ? 36 : 20; // 4 (type) + 8 (X) + 8 (Y) [+ 8 (Z) + 8 (M) for PointZ]
		var buffer = new ArrayBuffer(size);
		var view = new DataView(buffer);

		// Shape Type
		view.setInt32(0, hasZ ? SHAPE_TYPE.POINTZ : SHAPE_TYPE.POINT, true);

		// X, Y
		view.setFloat64(4, coord.x || 0, true);
		view.setFloat64(12, coord.y || 0, true);

		// Z, M for PointZ
		if (hasZ) {
			view.setFloat64(20, coord.z || 0, true);
			view.setFloat64(28, 0, true); // M value
		}

		return buffer;
	}

	// Step 27) Create PolyLine or Polygon record
	createPolyLineRecord(coords, hasZ, isPolygon) {
		var numParts = 1;
		var numPoints = coords.length;

		// For polygons, ensure ring is closed
		var points = coords.slice();
		if (isPolygon) {
			var first = points[0];
			var last = points[points.length - 1];
			if (first.x !== last.x || first.y !== last.y) {
				points.push({ x: first.x, y: first.y, z: first.z || 0 });
				numPoints = points.length;
			}
		}

		// Calculate bounding box
		var bbox = this.calculateBoundingBoxFromCoords(points);

		// Calculate buffer size
		// Base: 4 (type) + 32 (bbox) + 4 (numParts) + 4 (numPoints) + 4*numParts (parts) + 16*numPoints (points)
		var baseSize = 4 + 32 + 4 + 4 + 4 * numParts + 16 * numPoints;

		// Z section: 16 (Z range) + 8*numPoints (Z values)
		var zSize = hasZ ? 16 + 8 * numPoints : 0;

		var totalSize = baseSize + zSize;
		var buffer = new ArrayBuffer(totalSize);
		var view = new DataView(buffer);

		var offset = 0;

		// Shape Type
		var shapeType = isPolygon ? (hasZ ? SHAPE_TYPE.POLYGONZ : SHAPE_TYPE.POLYGON) : hasZ ? SHAPE_TYPE.POLYLINEZ : SHAPE_TYPE.POLYLINE;
		view.setInt32(offset, shapeType, true);
		offset += 4;

		// Bounding Box
		view.setFloat64(offset, bbox.xMin, true);
		offset += 8;
		view.setFloat64(offset, bbox.yMin, true);
		offset += 8;
		view.setFloat64(offset, bbox.xMax, true);
		offset += 8;
		view.setFloat64(offset, bbox.yMax, true);
		offset += 8;

		// NumParts
		view.setInt32(offset, numParts, true);
		offset += 4;

		// NumPoints
		view.setInt32(offset, numPoints, true);
		offset += 4;

		// Parts array (just one part starting at index 0)
		view.setInt32(offset, 0, true);
		offset += 4;

		// Points (X, Y)
		for (var i = 0; i < numPoints; i++) {
			view.setFloat64(offset, points[i].x || 0, true);
			offset += 8;
			view.setFloat64(offset, points[i].y || 0, true);
			offset += 8;
		}

		// Z section
		if (hasZ) {
			// Z Range
			view.setFloat64(offset, bbox.zMin, true);
			offset += 8;
			view.setFloat64(offset, bbox.zMax, true);
			offset += 8;

			// Z values
			for (var j = 0; j < numPoints; j++) {
				view.setFloat64(offset, points[j].z || 0, true);
				offset += 8;
			}
		}

		return buffer;
	}

	// Step 28) Generate SHX (index) file
	generateSHX(recordOffsets, recordLengths) {
		var numRecords = recordOffsets.length;
		var fileSize = 100 + numRecords * 8; // Header + 8 bytes per record

		var buffer = new ArrayBuffer(fileSize);
		var view = new DataView(buffer);

		// Copy header structure (same as SHP except file length)
		// File Code
		view.setInt32(0, 9994, false);

		// Unused
		for (var i = 4; i < 24; i += 4) {
			view.setInt32(i, 0, false);
		}

		// File Length (in 16-bit words)
		view.setInt32(24, fileSize / 2, false);

		// Version
		view.setInt32(28, 1000, true);

		// The rest of the header (shape type, bbox) should match SHP
		// For simplicity, we'll leave it zeroed (reader should use SHP header)

		// Index records
		var offset = 100;
		for (var j = 0; j < numRecords; j++) {
			view.setInt32(offset, recordOffsets[j], false); // Offset (big-endian)
			view.setInt32(offset + 4, recordLengths[j], false); // Length (big-endian)
			offset += 8;
		}

		return buffer;
	}

	// Step 29) Generate DBF file
	generateDBF(features) {
		// Step 30) Collect all unique attribute fields
		var fieldMap = new Map();
		fieldMap.set("NAME", { name: "NAME", type: "C", length: 100, decimals: 0 });

		for (var i = 0; i < features.length; i++) {
			var attrs = features[i].attributes || {};
			for (var key in attrs) {
				if (attrs.hasOwnProperty(key) && !fieldMap.has(key)) {
					var value = attrs[key];
					var fieldType = "C";
					var fieldLength = 50;
					var decimals = 0;

					if (typeof value === "number") {
						if (Number.isInteger(value)) {
							fieldType = "N";
							fieldLength = 12;
						} else {
							fieldType = "N";
							fieldLength = 18;
							decimals = 6;
						}
					} else if (typeof value === "boolean") {
						fieldType = "L";
						fieldLength = 1;
					}

					fieldMap.set(key, { name: key.substring(0, 10), type: fieldType, length: fieldLength, decimals: decimals });
				}
			}
		}

		var fields = Array.from(fieldMap.values());

		// Step 31) Calculate sizes
		var headerLength = 32 + fields.length * 32 + 1; // Header + field descriptors + terminator
		var recordLength = 1; // Deletion flag
		for (var j = 0; j < fields.length; j++) {
			recordLength += fields[j].length;
		}

		var numRecords = features.length;
		var fileSize = headerLength + numRecords * recordLength + 1; // +1 for EOF marker

		var buffer = new ArrayBuffer(fileSize);
		var view = new DataView(buffer);
		var bytes = new Uint8Array(buffer);

		// Step 32) Write DBF header
		var offset = 0;

		// Version (dBASE III)
		view.setUint8(offset++, 0x03);

		// Date (YY MM DD)
		var now = new Date();
		view.setUint8(offset++, now.getFullYear() - 1900);
		view.setUint8(offset++, now.getMonth() + 1);
		view.setUint8(offset++, now.getDate());

		// Number of records
		view.setUint32(offset, numRecords, true);
		offset += 4;

		// Header length
		view.setUint16(offset, headerLength, true);
		offset += 2;

		// Record length
		view.setUint16(offset, recordLength, true);
		offset += 2;

		// Reserved (20 bytes)
		offset += 20;

		// Step 33) Write field descriptors
		for (var k = 0; k < fields.length; k++) {
			var field = fields[k];

			// Field name (11 bytes, null-padded)
			var nameBytes = this.stringToBytes(field.name, 11);
			bytes.set(nameBytes, offset);
			offset += 11;

			// Field type
			view.setUint8(offset++, field.type.charCodeAt(0));

			// Reserved (4 bytes)
			offset += 4;

			// Field length
			view.setUint8(offset++, field.length);

			// Decimal count
			view.setUint8(offset++, field.decimals);

			// Reserved (14 bytes)
			offset += 14;
		}

		// Header terminator
		view.setUint8(offset++, 0x0d);

		// Step 34) Write records
		for (var m = 0; m < features.length; m++) {
			var feature = features[m];
			var attrs = feature.attributes || {};

			// Deletion flag (space = not deleted)
			view.setUint8(offset++, 0x20);

			// Field values
			for (var n = 0; n < fields.length; n++) {
				var fld = fields[n];
				var val = attrs[fld.name];

				if (fld.name === "NAME" && val === undefined) {
					val = feature.name || "";
				}

				var strVal = this.formatDBFValue(val, fld);
				var valBytes = this.stringToBytes(strVal, fld.length);
				bytes.set(valBytes, offset);
				offset += fld.length;
			}
		}

		// EOF marker
		view.setUint8(offset, 0x1a);

		return buffer;
	}

	// Step 35) Format value for DBF field
	formatDBFValue(value, field) {
		if (value === null || value === undefined) {
			return " ".repeat(field.length);
		}

		if (field.type === "N" || field.type === "F") {
			var numStr = typeof value === "number" ? value.toFixed(field.decimals) : String(value);
			return numStr.substring(0, field.length).padStart(field.length, " ");
		} else if (field.type === "L") {
			return value ? "T" : "F";
		} else {
			var str = String(value);
			return str.substring(0, field.length).padEnd(field.length, " ");
		}
	}

	// Step 36) Convert string to bytes
	stringToBytes(str, length) {
		var bytes = new Uint8Array(length);
		for (var i = 0; i < Math.min(str.length, length); i++) {
			bytes[i] = str.charCodeAt(i);
		}
		return bytes;
	}

	// Step 37) Generate PRJ file (projection)
	generatePRJ() {
		if (this.projectionWKT) {
			return this.projectionWKT;
		}

		// Default to WGS84 if no projection specified
		return 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
	}

	// Step 38) Generate CPG file (code page)
	generateCPG() {
		return this.encoding;
	}

	// Step 39) Calculate bounding box from features
	calculateBoundingBox(features) {
		var xMin = Infinity,
			yMin = Infinity,
			zMin = Infinity;
		var xMax = -Infinity,
			yMax = -Infinity,
			zMax = -Infinity;

		for (var i = 0; i < features.length; i++) {
			var coords = features[i].coordinates || [];
			for (var j = 0; j < coords.length; j++) {
				var pt = coords[j];
				if (pt.x < xMin) xMin = pt.x;
				if (pt.y < yMin) yMin = pt.y;
				if ((pt.z || 0) < zMin) zMin = pt.z || 0;
				if (pt.x > xMax) xMax = pt.x;
				if (pt.y > yMax) yMax = pt.y;
				if ((pt.z || 0) > zMax) zMax = pt.z || 0;
			}
		}

		// Handle empty/single-point cases
		if (xMin === Infinity) xMin = 0;
		if (yMin === Infinity) yMin = 0;
		if (zMin === Infinity) zMin = 0;
		if (xMax === -Infinity) xMax = 0;
		if (yMax === -Infinity) yMax = 0;
		if (zMax === -Infinity) zMax = 0;

		return { xMin: xMin, yMin: yMin, zMin: zMin, xMax: xMax, yMax: yMax, zMax: zMax };
	}

	// Step 40) Calculate bounding box from coordinate array
	calculateBoundingBoxFromCoords(coords) {
		return this.calculateBoundingBox([{ coordinates: coords }]);
	}

	// Step 41) Create blob helper
	createBlob(data, mimeType) {
		if (data instanceof ArrayBuffer) {
			return new Blob([data], { type: mimeType });
		} else if (typeof data === "string") {
			return new Blob([data], { type: mimeType });
		}
		return data;
	}
}

// Step 42) Static method to download shapefile as ZIP
SHPFileWriter.downloadAsZip = async function(data, filename, options) {
	var writer = new SHPFileWriter(options || {});
	var result = await writer.write(data);

	// Check if JSZip is available
	if (typeof JSZip === "undefined") {
		throw new Error("JSZip library required for ZIP export. Include it from https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
	}

	var zip = new JSZip();
	var baseName = filename.replace(/\.zip$/i, "");

	zip.file(baseName + ".shp", result.shp);
	zip.file(baseName + ".shx", result.shx);
	zip.file(baseName + ".dbf", result.dbf);
	if (result.prj) {
		zip.file(baseName + ".prj", result.prj);
	}
	zip.file(baseName + ".cpg", result.cpg);

	var zipBlob = await zip.generateAsync({ type: "blob" });

	// Trigger download
	var link = document.createElement("a");
	link.href = URL.createObjectURL(zipBlob);
	link.download = baseName + ".zip";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(link.href);

	return zipBlob;
};

// Step 43) Static method to get individual file blobs
SHPFileWriter.getFiles = async function(data, filename, options) {
	var writer = new SHPFileWriter(options || {});
	var result = await writer.write(data);
	var baseName = filename || "export";

	return {
		shp: { blob: result.shp, filename: baseName + ".shp" },
		shx: { blob: result.shx, filename: baseName + ".shx" },
		dbf: { blob: result.dbf, filename: baseName + ".dbf" },
		prj: result.prj ? { blob: result.prj, filename: baseName + ".prj" } : null,
		cpg: { blob: result.cpg, filename: baseName + ".cpg" }
	};
};

export default SHPFileWriter;
