// src/fileIO/AutoCadIO/DXFVulcanWriter.js
//=============================================================
// DXF VULCAN WRITER - 3D POLYLINE WITH VULCAN XDATA
//=============================================================
// Step 1) Exports blast holes to DXF format with Vulcan XData tags
// Step 2) Based on HoleToVulcanDXF-VBA.bas reference code
// Step 3) Creates 3D POLYLINE entities with 3 vertices (Collar, Grade, Toe)
// Step 4) Adds Vulcan-specific application data for MAPTEK_VULCAN
// Step 5) Supports 3DFACE entities for triangular mesh faces
// Step 6) Created: 2026-01-04

import BaseWriter from "../BaseWriter.js";

// Step 7) DXFVulcanWriter class
class DXFVulcanWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 8) Writer options
		this.blastName = options.blastName || "BLAST";
		this.coordinateSystem = options.coordinateSystem || "MGA"; // "MGA" or "LOCAL"
		this.includeText = options.includeText !== false; // Default true
		this.include3DFaces = options.include3DFaces || false; // Default false
		this.textHeight = options.textHeight || 0.5;
		this.handleCounter = 100; // Starting handle value
	}

	// Step 9) Main write method
	async write(data) {
		// Step 10) Validate input data
		if (!data || !Array.isArray(data.holes)) {
			throw new Error("Invalid data: holes array required");
		}

		// Step 11) Filter visible holes
		var visibleHoles = this.filterVisibleHoles(data.holes);

		if (visibleHoles.length === 0) {
			throw new Error("No visible holes to export");
		}

		// Step 12) Generate DXF content
		var dxf = this.generateDXF(visibleHoles);

		// Step 13) Create and return blob
		return this.createBlob(dxf, "application/dxf");
	}

	// Step 14) Generate DXF file content
	generateDXF(holes) {
		// Step 15) Build DXF header section
		var dxf = "";
		dxf += "0\nSECTION\n";
		dxf += "2\nHEADER\n";
		dxf += "9\n$ACADVER\n1\nAC1015\n"; // AutoCAD 2000 format
		dxf += "9\n$INSUNITS\n70\n4\n"; // Millimeters
		dxf += "0\nENDSEC\n";

		// Step 16) Build TABLES section
		dxf += this.generateTables(holes);

		// Step 17) Build BLOCKS section (empty)
		dxf += "0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n";

		// Step 18) Build ENTITIES section with all hole geometry
		dxf += "0\nSECTION\n2\nENTITIES\n";

		// Step 19) Process each hole as 3D POLYLINE
		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			dxf += this.generate3DPolyline(hole);

			// Step 20) Add text label if enabled
			if (this.includeText) {
				dxf += this.generateText(hole);
			}
		}

		// Step 21) Add 3D faces if enabled
		if (this.include3DFaces && data.faces) {
			for (var i = 0; i < data.faces.length; i++) {
				dxf += this.generate3DFace(data.faces[i]);
			}
		}

		// Step 22) Close ENTITIES section and file
		dxf += "0\nENDSEC\n0\nEOF\n";

		return dxf;
	}

	// Step 23) Generate TABLES section with layers
	generateTables(holes) {
		// Step 24) Get unique blast names for layers
		var blastNames = {};
		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var blastName = hole.entityName || this.blastName;
			blastNames[blastName] = true;
		}

		// Step 25) Build TABLES section
		var dxf = "";
		dxf += "0\nSECTION\n2\nTABLES\n";

		// Step 26) LTYPE table (line types)
		dxf += "0\nTABLE\n2\nLTYPE\n70\n1\n";
		dxf += "0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n";
		dxf += "0\nENDTAB\n";

		// Step 27) LAYER table
		var layerCount = Object.keys(blastNames).length;
		dxf += "0\nTABLE\n2\nLAYER\n70\n" + layerCount + "\n";

		// Step 28) Create layer for each blast name
		for (var blastName in blastNames) {
			var layerName = blastName + "_" + this.coordinateSystem;
			dxf += "0\nLAYER\n";
			dxf += "2\n" + layerName + "\n"; // Layer name
			dxf += "70\n0\n"; // Standard flags
			dxf += "62\n1\n"; // Color (red)
			dxf += "6\nCONTINUOUS\n"; // Line type
		}

		dxf += "0\nENDTAB\n";

		// Step 29) APPID table (register Vulcan application)
		dxf += "0\nTABLE\n2\nAPPID\n70\n1\n";
		dxf += "0\nAPPID\n2\nMAPTEK_VULCAN\n70\n0\n";
		dxf += "0\nENDTAB\n";

		dxf += "0\nENDSEC\n";

		return dxf;
	}

	// Step 30) Generate 3D POLYLINE entity for a hole
	generate3DPolyline(hole) {
		// Step 31) Calculate hole geometry
		var startX = hole.startXLocation || 0;
		var startY = hole.startYLocation || 0;
		var startZ = hole.startZLocation || 0;

		var length = hole.holeLengthCalculated || 0;
		var angle = (hole.holeAngle || 0) * (Math.PI / 180);
		var bearing = (hole.holeBearing || 0) * (Math.PI / 180);
		var subdrill = hole.subdrillAmount || 0;

		// Step 32) Calculate grade point (planned end without subdrill)
		var plannedLength = length - subdrill;
		var gradeX = startX + plannedLength * Math.sin(bearing) * Math.sin(angle);
		var gradeY = startY + plannedLength * Math.cos(bearing) * Math.sin(angle);
		var gradeZ = startZ - plannedLength * Math.cos(angle);

		// Step 33) Calculate toe point (actual end with subdrill)
		var toeX = startX + length * Math.sin(bearing) * Math.sin(angle);
		var toeY = startY + length * Math.cos(bearing) * Math.sin(angle);
		var toeZ = startZ - length * Math.cos(angle);

		// Step 34) Get layer name
		var blastName = hole.entityName || this.blastName;
		var layerName = blastName + "_" + this.coordinateSystem;

		// Step 35) Get hole ID
		var holeID = hole.holeID || "Unknown";

		// Step 36) Build POLYLINE entity header
		var dxf = "";
		dxf += "0\nPOLYLINE\n";
		dxf += "5\n" + this.getNextHandle() + "\n"; // Handle
		dxf += "8\n" + layerName + "\n"; // Layer
		dxf += "62\n1\n"; // Color (red)
		dxf += "66\n1\n"; // Vertices follow flag
		dxf += "70\n8\n"; // Polyline flag (8 = 3D polyline)

		// Step 37) Add Vulcan XData application data
		dxf += "1001\nMAPTEK_VULCAN\n";
		dxf += "1000\nVulcanName=" + holeID + "\n";
		dxf += "1000\nVulcanGroup=\n";
		dxf += "1000\nVulcanValue=0\n";
		dxf += "1000\nVulcanDescription=Imported from Kirra - ADB\n";

		// Step 38) Calculate bearing and dip for Vulcan tags
		var bearingDeg = (hole.holeBearing || 0).toFixed(2);
		var dipDeg = (90 - (hole.holeAngle || 0)).toFixed(2); // Convert angle to dip

		dxf += "1000\nVulcanBearing=" + bearingDeg + "\n";
		dxf += "1000\nVulcanDip=" + dipDeg + "\n";
		dxf += "1000\nVulcanLength=" + length.toFixed(2) + "\n";

		// Step 39) Add three VERTEX entities (Collar, Grade, Toe)

		// Vertex 1: Collar (start point)
		dxf += "0\nVERTEX\n";
		dxf += "5\n" + this.getNextHandle() + "\n"; // Handle
		dxf += "8\n" + layerName + "\n"; // Layer
		dxf += "10\n" + this.formatCoordinate(startX) + "\n";
		dxf += "20\n" + this.formatCoordinate(startY) + "\n";
		dxf += "30\n" + this.formatCoordinate(startZ) + "\n";
		dxf += "70\n32\n"; // 3D polyline vertex

		// Vertex 2: Grade (planned end)
		dxf += "0\nVERTEX\n";
		dxf += "5\n" + this.getNextHandle() + "\n"; // Handle
		dxf += "8\n" + layerName + "\n"; // Layer
		dxf += "10\n" + this.formatCoordinate(gradeX) + "\n";
		dxf += "20\n" + this.formatCoordinate(gradeY) + "\n";
		dxf += "30\n" + this.formatCoordinate(gradeZ) + "\n";
		dxf += "70\n32\n"; // 3D polyline vertex

		// Vertex 3: Toe (actual end)
		dxf += "0\nVERTEX\n";
		dxf += "5\n" + this.getNextHandle() + "\n"; // Handle
		dxf += "8\n" + layerName + "\n"; // Layer
		dxf += "10\n" + this.formatCoordinate(toeX) + "\n";
		dxf += "20\n" + this.formatCoordinate(toeY) + "\n";
		dxf += "30\n" + this.formatCoordinate(toeZ) + "\n";
		dxf += "70\n32\n"; // 3D polyline vertex

		// Step 40) Close POLYLINE with SEQEND
		dxf += "0\nSEQEND\n";
		dxf += "5\n" + this.getNextHandle() + "\n"; // Handle
		dxf += "8\n" + layerName + "\n"; // Layer

		return dxf;
	}

	// Step 41) Generate TEXT entity for hole label
	generateText(hole) {
		// Step 42) Get hole coordinates
		var startX = hole.startXLocation || 0;
		var startY = hole.startYLocation || 0;
		var startZ = hole.startZLocation || 0;

		// Step 43) Get layer name
		var blastName = hole.entityName || this.blastName;
		var layerName = blastName + "_" + this.coordinateSystem;

		// Step 44) Get hole ID
		var holeID = hole.holeID || "Unknown";

		// Step 45) Build TEXT entity
		var dxf = "";
		dxf += "0\nTEXT\n";
		dxf += "5\n" + this.getNextHandle() + "\n"; // Handle
		dxf += "8\n" + layerName + "\n"; // Layer
		dxf += "10\n" + this.formatCoordinate(startX) + "\n";
		dxf += "20\n" + this.formatCoordinate(startY) + "\n";
		dxf += "30\n" + this.formatCoordinate(startZ) + "\n";
		dxf += "40\n" + this.textHeight + "\n"; // Text height
		dxf += "1\n" + holeID + "\n"; // Text string
		dxf += "50\n0.0\n"; // Rotation angle

		return dxf;
	}

	// Step 46) Generate 3DFACE entity for triangular face
	generate3DFace(face) {
		// Step 47) Validate face has 3 or 4 vertices
		if (!face.vertices || face.vertices.length < 3) {
			console.warn("DXFVulcanWriter: Face must have at least 3 vertices");
			return "";
		}

		// Step 48) Get layer name
		var layerName = face.layer || this.blastName + "_" + this.coordinateSystem;

		// Step 49) Build 3DFACE entity
		var dxf = "";
		dxf += "0\n3DFACE\n";
		dxf += "5\n" + this.getNextHandle() + "\n"; // Handle
		dxf += "8\n" + layerName + "\n"; // Layer

		// Step 50) Add vertices (minimum 3, maximum 4)
		var v1 = face.vertices[0];
		var v2 = face.vertices[1];
		var v3 = face.vertices[2];
		var v4 = face.vertices[3] || v3; // If only 3 vertices, repeat last one

		// First corner
		dxf += "10\n" + this.formatCoordinate(v1.x) + "\n";
		dxf += "20\n" + this.formatCoordinate(v1.y) + "\n";
		dxf += "30\n" + this.formatCoordinate(v1.z) + "\n";

		// Second corner
		dxf += "11\n" + this.formatCoordinate(v2.x) + "\n";
		dxf += "21\n" + this.formatCoordinate(v2.y) + "\n";
		dxf += "31\n" + this.formatCoordinate(v2.z) + "\n";

		// Third corner
		dxf += "12\n" + this.formatCoordinate(v3.x) + "\n";
		dxf += "22\n" + this.formatCoordinate(v3.y) + "\n";
		dxf += "32\n" + this.formatCoordinate(v3.z) + "\n";

		// Fourth corner (same as third for triangles)
		dxf += "13\n" + this.formatCoordinate(v4.x) + "\n";
		dxf += "23\n" + this.formatCoordinate(v4.y) + "\n";
		dxf += "33\n" + this.formatCoordinate(v4.z) + "\n";

		return dxf;
	}

	// Step 51) Get next unique handle (increments counter)
	getNextHandle() {
		var handle = this.handleCounter.toString(16).toUpperCase();
		this.handleCounter++;
		return handle;
	}

	// Step 52) Format coordinate to 4 decimal places
	formatCoordinate(value) {
		return parseFloat(value).toFixed(4);
	}
}

export default DXFVulcanWriter;
