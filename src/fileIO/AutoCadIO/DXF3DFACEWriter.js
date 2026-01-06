// src/fileIO/AutoCadIO/DXF3DFACEWriter.js
//=============================================================
// DXF 3DFACE WRITER - SURFACE TRIANGLES
//=============================================================
// Step 1) Exports surface triangles as DXF 3DFACE entities
// Step 2) Creates one 3DFACE per triangle
// Step 3) Compatible with AutoCAD, QCAD, LibreCAD, etc.
// Step 4) Created: 2026-01-05

import BaseWriter from "../BaseWriter.js";

// Step 5) DXF3DFACEWriter class
class DXF3DFACEWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 6) Writer options
		this.layerName = options.layerName || "SURFACE";
		this.decimalPlaces = options.decimalPlaces !== undefined ? options.decimalPlaces : 3;
		this.handleCounter = 256; // DXF handle counter
	}

	// Step 7) Main write method
	async write(data) {
		// Step 8) Validate input data
		if (!data) {
			throw new Error("Invalid data: data object required");
		}

		// Step 9) Generate DXF content
		var dxf = "";

		if (data.triangles && Array.isArray(data.triangles)) {
			// Step 10) Export triangles directly
			dxf = this.generateDXF(data.triangles, data.layerName || this.layerName);
		} else if (data.surface && data.surface.triangles && Array.isArray(data.surface.triangles)) {
			// Step 11) Export triangles from surface object
			dxf = this.generateDXF(data.surface.triangles, data.layerName || this.layerName);
		} else if (data.faces && Array.isArray(data.faces)) {
			// Step 12) Export faces (from OBJ-style data)
			dxf = this.generateDXFFromFaces(data.faces, data.vertices, data.layerName || this.layerName);
		} else {
			throw new Error("Invalid data: triangles, surface, or faces required");
		}

		// Step 13) Create and return blob
		return this.createBlob(dxf, "application/dxf");
	}

	// Step 14) Generate DXF from triangles
	generateDXF(triangles, layerName) {
		var dxf = "";

		// Step 15) Write DXF header
		dxf += this.writeDXFHeader();

		// Step 16) Write DXF tables section
		dxf += this.writeDXFTables(layerName);

		// Step 17) Write ENTITIES section
		dxf += "0\nSECTION\n2\nENTITIES\n";

		// Step 18) Write each triangle as a 3DFACE
		for (var i = 0; i < triangles.length; i++) {
			var triangle = triangles[i];
			dxf += this.write3DFace(triangle.vertices, layerName);
		}

		// Step 19) End ENTITIES section
		dxf += "0\nENDSEC\n";

		// Step 20) Write DXF EOF
		dxf += "0\nEOF\n";

		return dxf;
	}

	// Step 21) Generate DXF from faces (OBJ-style)
	generateDXFFromFaces(faces, vertices, layerName) {
		var dxf = "";

		// Step 22) Write DXF header
		dxf += this.writeDXFHeader();

		// Step 23) Write DXF tables section
		dxf += this.writeDXFTables(layerName);

		// Step 24) Write ENTITIES section
		dxf += "0\nSECTION\n2\nENTITIES\n";

		// Step 25) Write each face as a 3DFACE
		for (var i = 0; i < faces.length; i++) {
			var face = faces[i];

			// Step 26) Extract vertices for this face
			var faceVertices = [];
			for (var j = 0; j < face.length && j < 4; j++) {
				var vertexIndex = face[j];
				if (vertexIndex < vertices.length) {
					faceVertices.push(vertices[vertexIndex]);
				}
			}

			// Step 27) Only export if we have at least 3 vertices
			if (faceVertices.length >= 3) {
				dxf += this.write3DFace(faceVertices, layerName);
			}
		}

		// Step 28) End ENTITIES section
		dxf += "0\nENDSEC\n";

		// Step 29) Write DXF EOF
		dxf += "0\nEOF\n";

		return dxf;
	}

	// Step 30) Write DXF header section
	writeDXFHeader() {
		var header = "";
		header += "0\nSECTION\n2\nHEADER\n";
		header += "9\n$ACADVER\n1\nAC1015\n"; // AutoCAD 2000 format
		header += "9\n$INSUNITS\n70\n1\n"; // Units: inches
		header += "0\nENDSEC\n";
		return header;
	}

	// Step 31) Write DXF tables section
	writeDXFTables(layerName) {
		var tables = "";
		tables += "0\nSECTION\n2\nTABLES\n";

		// Step 32) LAYER table
		tables += "0\nTABLE\n2\nLAYER\n70\n1\n";
		tables += "0\nLAYER\n";
		tables += "2\n" + layerName + "\n";
		tables += "70\n0\n"; // Flags
		tables += "62\n7\n"; // Color (7 = white)
		tables += "6\nCONTINUOUS\n"; // Linetype
		tables += "0\nENDTAB\n";

		// Step 33) End TABLES section
		tables += "0\nENDSEC\n";
		return tables;
	}

	// Step 34) Write single 3DFACE entity
	write3DFace(vertices, layerName) {
		var face = "";

		// Step 35) 3DFACE requires at least 3 vertices
		if (!vertices || vertices.length < 3) {
			console.warn("3DFACE requires at least 3 vertices");
			return "";
		}

		// Step 36) Get handle for this entity
		var handle = this.handleCounter.toString(16).toUpperCase();
		this.handleCounter++;

		// Step 37) Write 3DFACE entity
		face += "0\n3DFACE\n";
		face += "5\n" + handle + "\n"; // Handle
		face += "8\n" + layerName + "\n"; // Layer

		// Step 38) Write first vertex
		var v1 = vertices[0];
		face += "10\n" + this.formatCoord(v1.x) + "\n";
		face += "20\n" + this.formatCoord(v1.y) + "\n";
		face += "30\n" + this.formatCoord(v1.z || 0) + "\n";

		// Step 39) Write second vertex
		var v2 = vertices[1];
		face += "11\n" + this.formatCoord(v2.x) + "\n";
		face += "21\n" + this.formatCoord(v2.y) + "\n";
		face += "31\n" + this.formatCoord(v2.z || 0) + "\n";

		// Step 40) Write third vertex
		var v3 = vertices[2];
		face += "12\n" + this.formatCoord(v3.x) + "\n";
		face += "22\n" + this.formatCoord(v3.y) + "\n";
		face += "32\n" + this.formatCoord(v3.z || 0) + "\n";

		// Step 41) Write fourth vertex (use third if only 3 vertices)
		var v4 = vertices.length > 3 ? vertices[3] : v3;
		face += "13\n" + this.formatCoord(v4.x) + "\n";
		face += "23\n" + this.formatCoord(v4.y) + "\n";
		face += "33\n" + this.formatCoord(v4.z || 0) + "\n";

		return face;
	}

	// Step 42) Format coordinate with specified decimal places
	formatCoord(value) {
		if (value === undefined || value === null || isNaN(value)) {
			return "0.000";
		}

		return parseFloat(value).toFixed(this.decimalPlaces);
	}
}

export default DXF3DFACEWriter;
