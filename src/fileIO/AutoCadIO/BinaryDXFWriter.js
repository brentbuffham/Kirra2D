// src/fileIO/AutoCadIO/BinaryDXFWriter.js
//=============================================================
// BINARY DXF WRITER
//=============================================================
// Step 1) Writes Binary DXF files from KAD entities and surfaces
// Step 2) Binary DXF format introduced in AutoCAD Release 10 (1988)
// Step 3) Binary format is 25% smaller and 5x faster to load than ASCII
// Step 4) Supports: POINT, LINE, POLYLINE, LWPOLYLINE, CIRCLE, TEXT, 3DFACE
// Step 5) Created: 2026-01-16, Updated: 2026-01-17

import BaseWriter from "../BaseWriter.js";

// Step 6) Binary DXF Constants
const BINARY_DXF_SENTINEL = "AutoCAD Binary DXF\r\n\x1a\x00";
const SENTINEL_LENGTH = 22;

// Step 7) BinaryDXFWriter class
class BinaryDXFWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 8) Writer options - use BaseWriter centroid for coordinate transform
		this.includeVulcanXData = options.includeVulcanXData || false;
		this.coordinateSystem = options.coordinateSystem || this.coordinateSystem || "LOCAL";
		this.usePolylines = options.usePolylines !== false; // Default true (POLYLINE vs LWPOLYLINE)
		this.decimalPlaces = options.decimalPlaces !== undefined ? options.decimalPlaces : 6;

		// Step 9) Internal buffer management
		this.buffer = [];
		this.bufferPosition = 0;
		this.handleCounter = 256;
	}

	// Step 10) Main write method
	async write(data) {
		// Step 11) Reset buffer
		this.buffer = [];
		this.handleCounter = 256;

		// Step 12) Validate input
		if (!data) {
			throw new Error("Invalid data: data object required");
		}

		// Step 13) Write binary DXF sentinel
		this.writeSentinel();

		// Step 14) Write HEADER section
		this.writeHeaderSection();

		// Step 15) Write TABLES section
		this.writeTablesSection(data);

		// Step 16) Write BLOCKS section (empty)
		this.writeBlocksSection();

		// Step 17) Write ENTITIES section
		this.writeEntitiesSection(data);

		// Step 18) Write EOF
		this.writeGroupCode(0);
		this.writeString("EOF");

		// Step 19) Create Uint8Array from buffer
		var result = new Uint8Array(this.buffer);

		// Step 20) Return as blob
		return new Blob([result], { type: "application/octet-stream" });
	}

	// Step 21) Write binary DXF sentinel (22 bytes)
	writeSentinel() {
		for (var i = 0; i < BINARY_DXF_SENTINEL.length; i++) {
			this.buffer.push(BINARY_DXF_SENTINEL.charCodeAt(i));
		}
	}

	// Step 22) Write group code (1 or 3 bytes)
	writeGroupCode(code) {
		if (code > 254) {
			// Step 23) Extended group code (3 bytes: 255 + 2-byte code)
			this.buffer.push(255);
			this.writeInt16(code);
		} else {
			// Step 24) Normal group code (1 byte)
			this.buffer.push(code & 0xff);
		}
	}

	// Step 25) Write null-terminated string
	writeString(str) {
		for (var i = 0; i < str.length; i++) {
			this.buffer.push(str.charCodeAt(i) & 0xff);
		}
		this.buffer.push(0); // Null terminator
	}

	// Step 26) Write 2-byte signed integer (little-endian)
	writeInt16(value) {
		this.buffer.push(value & 0xff);
		this.buffer.push((value >> 8) & 0xff);
	}

	// Step 27) Write 4-byte signed integer (little-endian)
	writeInt32(value) {
		this.buffer.push(value & 0xff);
		this.buffer.push((value >> 8) & 0xff);
		this.buffer.push((value >> 16) & 0xff);
		this.buffer.push((value >> 24) & 0xff);
	}

	// Step 28) Write 8-byte IEEE double (little-endian)
	writeDouble(value) {
		// Step 29) Create Float64Array to get binary representation
		var float64 = new Float64Array(1);
		float64[0] = value;
		var bytes = new Uint8Array(float64.buffer);

		// Step 30) Push bytes in little-endian order
		for (var i = 0; i < 8; i++) {
			this.buffer.push(bytes[i]);
		}
	}

	// Step 31) Write group-value pair (string)
	writeGroupString(groupCode, value) {
		this.writeGroupCode(groupCode);
		this.writeString(value);
	}

	// Step 32) Write group-value pair (double)
	writeGroupDouble(groupCode, value) {
		this.writeGroupCode(groupCode);
		this.writeDouble(value);
	}

	// Step 33) Write group-value pair (16-bit integer)
	writeGroupInt16(groupCode, value) {
		this.writeGroupCode(groupCode);
		this.writeInt16(value);
	}

	// Step 34) Write group-value pair (32-bit integer)
	writeGroupInt32(groupCode, value) {
		this.writeGroupCode(groupCode);
		this.writeInt32(value);
	}

	// Step 35) Write HEADER section
	writeHeaderSection() {
		this.writeGroupString(0, "SECTION");
		this.writeGroupString(2, "HEADER");

		// Step 36) AutoCAD version (AC1015 = AutoCAD 2000)
		this.writeGroupString(9, "$ACADVER");
		this.writeGroupString(1, "AC1015");

		// Step 37) Units (1 = inches, 4 = millimeters)
		this.writeGroupString(9, "$INSUNITS");
		this.writeGroupInt16(70, 4);

		// Step 38) End HEADER section
		this.writeGroupString(0, "ENDSEC");
	}

	// Step 39) Write TABLES section
	writeTablesSection(data) {
		this.writeGroupString(0, "SECTION");
		this.writeGroupString(2, "TABLES");

		// Step 40) Collect unique layer names
		var layers = this.collectLayers(data);

		// Step 41) Write LTYPE table (line types)
		this.writeGroupString(0, "TABLE");
		this.writeGroupString(2, "LTYPE");
		this.writeGroupInt16(70, 1);

		// CONTINUOUS line type
		this.writeGroupString(0, "LTYPE");
		this.writeGroupString(2, "CONTINUOUS");
		this.writeGroupInt16(70, 0);
		this.writeGroupString(3, "Solid line");
		this.writeGroupInt16(72, 65);
		this.writeGroupInt16(73, 0);
		this.writeGroupDouble(40, 0.0);

		this.writeGroupString(0, "ENDTAB");

		// Step 42) Write LAYER table
		this.writeGroupString(0, "TABLE");
		this.writeGroupString(2, "LAYER");
		this.writeGroupInt16(70, layers.length || 1);

		// Write each layer
		for (var i = 0; i < layers.length; i++) {
			this.writeGroupString(0, "LAYER");
			this.writeGroupString(2, layers[i]);
			this.writeGroupInt16(70, 0);
			this.writeGroupInt16(62, 7); // Color white
			this.writeGroupString(6, "CONTINUOUS");
		}

		// Default layer 0 if no layers
		if (layers.length === 0) {
			this.writeGroupString(0, "LAYER");
			this.writeGroupString(2, "0");
			this.writeGroupInt16(70, 0);
			this.writeGroupInt16(62, 7);
			this.writeGroupString(6, "CONTINUOUS");
		}

		this.writeGroupString(0, "ENDTAB");

		// Step 43) Write APPID table for Vulcan XData
		if (this.includeVulcanXData) {
			this.writeGroupString(0, "TABLE");
			this.writeGroupString(2, "APPID");
			this.writeGroupInt16(70, 1);

			this.writeGroupString(0, "APPID");
			this.writeGroupString(2, "MAPTEK_VULCAN");
			this.writeGroupInt16(70, 0);

			this.writeGroupString(0, "ENDTAB");
		}

		// Step 44) End TABLES section
		this.writeGroupString(0, "ENDSEC");
	}

	// Step 45) Write BLOCKS section (empty)
	writeBlocksSection() {
		this.writeGroupString(0, "SECTION");
		this.writeGroupString(2, "BLOCKS");
		this.writeGroupString(0, "ENDSEC");
	}

	// Step 46) Write ENTITIES section
	writeEntitiesSection(data) {
		this.writeGroupString(0, "SECTION");
		this.writeGroupString(2, "ENTITIES");

		// Step 47) Write KAD drawings
		if (data.kadDrawingsMap) {
			this.writeKADEntities(data.kadDrawingsMap);
		}

		// Step 48) Write holes (if present)
		if (data.holes && Array.isArray(data.holes)) {
			this.writeHoleEntities(data.holes);
		}

		// Step 49) Write surfaces (3DFACE triangles)
		if (data.surfaces) {
			this.writeSurfaceEntities(data.surfaces);
		}

		// Step 50) Write triangles directly (if present)
		if (data.triangles && Array.isArray(data.triangles)) {
			this.writeTriangles(data.triangles, data.layerName || "SURFACE");
		}

		// Step 51) End ENTITIES section
		this.writeGroupString(0, "ENDSEC");
	}

	// Step 52) Write KAD entities to binary DXF
	writeKADEntities(kadDrawingsMap) {
		for (var [entityName, entityData] of kadDrawingsMap.entries()) {
			var type = entityData.entityType ? entityData.entityType.trim() : "point";
			var data = entityData.data;

			if (!data || !Array.isArray(data) || data.length === 0) {
				continue;
			}

			// Step 53) Get color for entity
			var color = 7; // Default white
			if (data[0] && data[0].color) {
				color = this.hexToColorIndex(data[0].color);
			}

			// Step 54) Write based on entity type
			if (type === "point") {
				for (var i = 0; i < data.length; i++) {
					this.writePoint(data[i], entityName, color);
				}
			} else if (type === "line" || type === "poly") {
				this.writePolylineFromKAD(data, entityName, color, type === "poly");
			} else if (type === "circle") {
				for (var i = 0; i < data.length; i++) {
					this.writeCircle(data[i], entityName, color);
				}
			} else if (type === "text") {
				for (var i = 0; i < data.length; i++) {
					this.writeText(data[i], entityName, color);
				}
			}
		}
	}

	// Step 55) Write POINT entity
	writePoint(point, layerName, color) {
		this.writeGroupString(0, "POINT");
		this.writeGroupString(5, this.getNextHandle());
		this.writeGroupString(8, layerName);
		this.writeGroupInt16(62, color);
		this.writeGroupDouble(10, point.pointXLocation || 0);
		this.writeGroupDouble(20, point.pointYLocation || 0);
		this.writeGroupDouble(30, point.pointZLocation || 0);
	}

	// Step 56) Write POLYLINE entity from KAD data
	writePolylineFromKAD(points, layerName, color, closed) {
		if (points.length < 2) {
			return;
		}

		if (this.usePolylines) {
			// Step 57) Use 3D POLYLINE with VERTEX entities
			this.writeGroupString(0, "POLYLINE");
			this.writeGroupString(5, this.getNextHandle());
			this.writeGroupString(8, layerName);
			this.writeGroupInt16(62, color);
			this.writeGroupInt16(66, 1); // Vertices follow
			this.writeGroupInt16(70, closed ? 9 : 8); // 8 = 3D polyline, 1 = closed

			// Step 58) Add Vulcan XData if enabled
			if (this.includeVulcanXData) {
				var vulcanName = layerName;
				if (layerName.indexOf("lineVN_") === 0) {
					vulcanName = layerName.substring(7);
				}
				this.writeVulcanXData(vulcanName);
			}

			// Step 59) Write vertices
			for (var i = 0; i < points.length; i++) {
				var pt = points[i];
				this.writeGroupString(0, "VERTEX");
				this.writeGroupString(5, this.getNextHandle());
				this.writeGroupString(8, layerName);
				this.writeGroupDouble(10, pt.pointXLocation || 0);
				this.writeGroupDouble(20, pt.pointYLocation || 0);
				this.writeGroupDouble(30, pt.pointZLocation || 0);
				this.writeGroupInt16(70, 32); // 3D polyline vertex
			}

			// Step 60) Close POLYLINE
			this.writeGroupString(0, "SEQEND");
			this.writeGroupString(5, this.getNextHandle());
			this.writeGroupString(8, layerName);
		} else {
			// Step 61) Use LWPOLYLINE (lightweight, 2D)
			this.writeGroupString(0, "LWPOLYLINE");
			this.writeGroupString(5, this.getNextHandle());
			this.writeGroupString(8, layerName);
			this.writeGroupInt16(62, color);
			this.writeGroupInt32(90, points.length); // Number of vertices
			this.writeGroupInt16(70, closed ? 1 : 0);

			// Write vertices inline
			for (var i = 0; i < points.length; i++) {
				var pt = points[i];
				this.writeGroupDouble(10, pt.pointXLocation || 0);
				this.writeGroupDouble(20, pt.pointYLocation || 0);
			}
		}
	}

	// Step 62) Write CIRCLE entity
	writeCircle(circle, layerName, color) {
		this.writeGroupString(0, "CIRCLE");
		this.writeGroupString(5, this.getNextHandle());
		this.writeGroupString(8, layerName);
		this.writeGroupInt16(62, color);
		this.writeGroupDouble(10, circle.pointXLocation || 0);
		this.writeGroupDouble(20, circle.pointYLocation || 0);
		this.writeGroupDouble(30, circle.pointZLocation || 0);
		this.writeGroupDouble(40, circle.radius || 1);
	}

	// Step 63) Write TEXT entity
	writeText(text, layerName, color) {
		this.writeGroupString(0, "TEXT");
		this.writeGroupString(5, this.getNextHandle());
		this.writeGroupString(8, layerName);
		this.writeGroupInt16(62, color);
		this.writeGroupDouble(10, text.pointXLocation || 0);
		this.writeGroupDouble(20, text.pointYLocation || 0);
		this.writeGroupDouble(30, text.pointZLocation || 0);
		this.writeGroupDouble(40, text.fontHeight || 12);
		this.writeGroupString(1, text.text || "");
		this.writeGroupDouble(50, 0.0); // Rotation angle
	}

	// Step 64) Write LINE entity
	writeLine(startX, startY, startZ, endX, endY, endZ, layerName, color) {
		this.writeGroupString(0, "LINE");
		this.writeGroupString(5, this.getNextHandle());
		this.writeGroupString(8, layerName);
		this.writeGroupInt16(62, color);
		this.writeGroupDouble(10, startX);
		this.writeGroupDouble(20, startY);
		this.writeGroupDouble(30, startZ);
		this.writeGroupDouble(11, endX);
		this.writeGroupDouble(21, endY);
		this.writeGroupDouble(31, endZ);
	}

	// Step 65) Write 3DFACE entity
	write3DFace(v1, v2, v3, v4, layerName, color) {
		this.writeGroupString(0, "3DFACE");
		this.writeGroupString(5, this.getNextHandle());
		this.writeGroupString(8, layerName);
		if (color !== undefined) {
			this.writeGroupInt16(62, color);
		}

		// First vertex
		this.writeGroupDouble(10, v1.x || 0);
		this.writeGroupDouble(20, v1.y || 0);
		this.writeGroupDouble(30, v1.z || 0);

		// Second vertex
		this.writeGroupDouble(11, v2.x || 0);
		this.writeGroupDouble(21, v2.y || 0);
		this.writeGroupDouble(31, v2.z || 0);

		// Third vertex
		this.writeGroupDouble(12, v3.x || 0);
		this.writeGroupDouble(22, v3.y || 0);
		this.writeGroupDouble(32, v3.z || 0);

		// Fourth vertex (same as third for triangles)
		var v4Final = v4 || v3;
		this.writeGroupDouble(13, v4Final.x || 0);
		this.writeGroupDouble(23, v4Final.y || 0);
		this.writeGroupDouble(33, v4Final.z || 0);
	}

	// Step 66) Write hole entities (from DXFVulcanWriter style)
	writeHoleEntities(holes) {
		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];

			// Calculate hole geometry
			var startX = hole.startXLocation || 0;
			var startY = hole.startYLocation || 0;
			var startZ = hole.startZLocation || 0;

			var length = hole.holeLengthCalculated || 0;
			var angle = (hole.holeAngle || 0) * (Math.PI / 180);
			var bearing = (hole.holeBearing || 0) * (Math.PI / 180);
			var subdrill = hole.subdrillAmount || 0;

			// Calculate grade point
			var plannedLength = length - subdrill;
			var gradeX = startX + plannedLength * Math.sin(bearing) * Math.sin(angle);
			var gradeY = startY + plannedLength * Math.cos(bearing) * Math.sin(angle);
			var gradeZ = startZ - plannedLength * Math.cos(angle);

			// Calculate toe point
			var toeX = startX + length * Math.sin(bearing) * Math.sin(angle);
			var toeY = startY + length * Math.cos(bearing) * Math.sin(angle);
			var toeZ = startZ - length * Math.cos(angle);

			var blastName = hole.entityName || "BLAST";
			var holeID = hole.holeID || "H" + (i + 1);

			// Step 67) Write 3D POLYLINE for hole
			this.writeGroupString(0, "POLYLINE");
			this.writeGroupString(5, this.getNextHandle());
			this.writeGroupString(8, blastName);
			this.writeGroupInt16(62, 1); // Red
			this.writeGroupInt16(66, 1);
			this.writeGroupInt16(70, 8);

			// Add Vulcan XData
			if (this.includeVulcanXData) {
				this.writeVulcanXDataForHole(holeID, hole.holeBearing, hole.holeAngle, length);
			}

			// Collar vertex
			this.writeGroupString(0, "VERTEX");
			this.writeGroupString(5, this.getNextHandle());
			this.writeGroupString(8, blastName);
			this.writeGroupDouble(10, startX);
			this.writeGroupDouble(20, startY);
			this.writeGroupDouble(30, startZ);
			this.writeGroupInt16(70, 32);

			// Grade vertex
			this.writeGroupString(0, "VERTEX");
			this.writeGroupString(5, this.getNextHandle());
			this.writeGroupString(8, blastName);
			this.writeGroupDouble(10, gradeX);
			this.writeGroupDouble(20, gradeY);
			this.writeGroupDouble(30, gradeZ);
			this.writeGroupInt16(70, 32);

			// Toe vertex
			this.writeGroupString(0, "VERTEX");
			this.writeGroupString(5, this.getNextHandle());
			this.writeGroupString(8, blastName);
			this.writeGroupDouble(10, toeX);
			this.writeGroupDouble(20, toeY);
			this.writeGroupDouble(30, toeZ);
			this.writeGroupInt16(70, 32);

			// SEQEND
			this.writeGroupString(0, "SEQEND");
			this.writeGroupString(5, this.getNextHandle());
			this.writeGroupString(8, blastName);

			// Step 68) Write TEXT label
			this.writeGroupString(0, "TEXT");
			this.writeGroupString(5, this.getNextHandle());
			this.writeGroupString(8, blastName);
			this.writeGroupDouble(10, startX);
			this.writeGroupDouble(20, startY);
			this.writeGroupDouble(30, startZ);
			this.writeGroupDouble(40, 0.5);
			this.writeGroupString(1, holeID);
			this.writeGroupDouble(50, 0.0);
		}
	}

	// Step 69) Write surface entities as 3DFACE
	writeSurfaceEntities(surfaces) {
		for (var [surfaceId, surface] of surfaces.entries()) {
			var layerName = surface.name || surfaceId || "SURFACE";
			var triangles = surface.triangles || [];

			for (var i = 0; i < triangles.length; i++) {
				var tri = triangles[i];
				if (tri.vertices && tri.vertices.length >= 3) {
					this.write3DFace(tri.vertices[0], tri.vertices[1], tri.vertices[2], null, layerName, 7);
				}
			}
		}
	}

	// Step 70) Write triangles directly
	writeTriangles(triangles, layerName) {
		for (var i = 0; i < triangles.length; i++) {
			var tri = triangles[i];
			if (tri.vertices && tri.vertices.length >= 3) {
				this.write3DFace(tri.vertices[0], tri.vertices[1], tri.vertices[2], null, layerName, 7);
			}
		}
	}

	// Step 71) Write Vulcan XData
	writeVulcanXData(vulcanName) {
		this.writeGroupCode(1001);
		this.writeString("MAPTEK_VULCAN");
		this.writeGroupCode(1000);
		this.writeString("VulcanName=" + vulcanName);
		this.writeGroupCode(1000);
		this.writeString("VulcanGroup=");
		this.writeGroupCode(1000);
		this.writeString("VulcanValue=0");
		this.writeGroupCode(1000);
		this.writeString("VulcanDescription=Exported from Kirra Binary DXF Writer");
	}

	// Step 72) Write Vulcan XData for hole
	writeVulcanXDataForHole(holeID, bearing, angle, length) {
		var dipDeg = (90 - (angle || 0)).toFixed(2);
		var bearingDeg = (bearing || 0).toFixed(2);

		this.writeGroupCode(1001);
		this.writeString("MAPTEK_VULCAN");
		this.writeGroupCode(1000);
		this.writeString("VulcanName=" + holeID);
		this.writeGroupCode(1000);
		this.writeString("VulcanGroup=");
		this.writeGroupCode(1000);
		this.writeString("VulcanValue=0");
		this.writeGroupCode(1000);
		this.writeString("VulcanDescription=Hole exported from Kirra");
		this.writeGroupCode(1000);
		this.writeString("VulcanBearing=" + bearingDeg);
		this.writeGroupCode(1000);
		this.writeString("VulcanDip=" + dipDeg);
		this.writeGroupCode(1000);
		this.writeString("VulcanLength=" + length.toFixed(2));
	}

	// Step 73) Collect unique layer names from data
	collectLayers(data) {
		var layers = new Set();

		if (data.kadDrawingsMap) {
			for (var [entityName, entityData] of data.kadDrawingsMap.entries()) {
				layers.add(entityName);
			}
		}

		if (data.holes && Array.isArray(data.holes)) {
			for (var i = 0; i < data.holes.length; i++) {
				var hole = data.holes[i];
				if (hole.entityName) {
					layers.add(hole.entityName);
				}
			}
		}

		if (data.surfaces) {
			for (var [surfaceId, surface] of data.surfaces.entries()) {
				layers.add(surface.name || surfaceId || "SURFACE");
			}
		}

		if (data.layerName) {
			layers.add(data.layerName);
		}

		return Array.from(layers);
	}

	// Step 74) Get next unique handle
	getNextHandle() {
		var handle = this.handleCounter.toString(16).toUpperCase();
		this.handleCounter++;
		return handle;
	}

	// Step 75) Convert hex color to DXF color index (1-255)
	hexToColorIndex(hexColor) {
		var colorMap = {
			"#FF0000": 1,
			"#FFFF00": 2,
			"#00FF00": 3,
			"#00FFFF": 4,
			"#0000FF": 5,
			"#FF00FF": 6,
			"#FFFFFF": 7,
			"#808080": 8,
			"#C0C0C0": 9,
			"#FFA500": 30,
			"#800080": 200
		};

		if (hexColor && colorMap[hexColor.toUpperCase()]) {
			return colorMap[hexColor.toUpperCase()];
		}

		// Hash color to 1-255 range
		if (hexColor && hexColor.startsWith("#")) {
			var hash = 0;
			for (var i = 1; i < hexColor.length; i++) {
				hash = hexColor.charCodeAt(i) + ((hash << 5) - hash);
			}
			return Math.abs(hash) % 255 + 1;
		}

		return 7; // Default white
	}
}

export default BinaryDXFWriter;
