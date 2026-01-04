// src/fileIO/AutoCadIO/DXFHOLESWriter.js
//=============================================================
// DXF HOLES WRITER - COMPACT 2-LAYER FORMAT
//=============================================================
// Step 1) Exports blast holes to DXF format with only 2 layers
// Step 2) Replaces the problematic per-hole layer approach from kirra.js
// Step 3) Layer structure: HOLES (geometry) and HOLE_TEXT (labels)
// Step 4) Maximum compatibility with all CAD programs
// Step 5) Created: 2026-01-03

import BaseWriter from "../BaseWriter.js";

// Step 6) DXFHOLESWriter class
class DXFHOLESWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 7) Writer options
		this.blastName = options.blastName || "BLAST";
		this.textHeight = options.textHeight || 0.5;
	}

	// Step 8) Main write method
	async write(data) {
		// Step 9) Validate input data
		if (!data || !Array.isArray(data.holes)) {
			throw new Error("Invalid data: holes array required");
		}

		// Step 10) Filter visible holes
		var visibleHoles = this.filterVisibleHoles(data.holes);

		if (visibleHoles.length === 0) {
			throw new Error("No visible holes to export");
		}

		// Step 11) Generate DXF content
		var dxf = this.generateDXF(visibleHoles);

		// Step 12) Create and return blob
		return this.createBlob(dxf, "application/dxf");
	}

	// Step 13) Generate DXF file content
	generateDXF(holes) {
		// Step 14) Build DXF header section
		var dxf = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n";

		// Step 15) Build TABLES section with 2 layers only
		dxf += "0\nSECTION\n2\nTABLES\n";
		dxf += "0\nTABLE\n2\nLAYER\n70\n2\n"; // 2 layers

		// Step 16) Define HOLES layer (cyan, for all geometry)
		dxf += "0\nLAYER\n2\nHOLES\n70\n0\n62\n4\n6\nCONTINUOUS\n"; // Color 4 = cyan

		// Step 17) Define HOLE_TEXT layer (white, for all text)
		dxf += "0\nLAYER\n2\nHOLE_TEXT\n70\n0\n62\n7\n6\nCONTINUOUS\n"; // Color 7 = white

		dxf += "0\nENDTAB\n0\nENDTAB\n0\nENDSEC\n";

		// Step 18) Build BLOCKS section (empty)
		dxf += "0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n";

		// Step 19) Build ENTITIES section with all hole geometry
		dxf += "0\nSECTION\n2\nENTITIES\n";

		// Step 20) Process each hole
		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];

			// Step 21) Calculate hole geometry
			var startX = hole.startXLocation || 0;
			var startY = hole.startYLocation || 0;
			var startZ = hole.startZLocation || 0;

			var length = hole.holeLengthCalculated || 0;
			var angle = (hole.holeAngle || 0) * (Math.PI / 180);
			var bearing = (hole.holeBearing || 0) * (Math.PI / 180);
			var subdrill = hole.subdrillAmount || 0;

			// Step 22) Calculate grade point (planned end without subdrill)
			var plannedLength = length - subdrill;
			var gradeX = startX + plannedLength * Math.sin(bearing) * Math.sin(angle);
			var gradeY = startY + plannedLength * Math.cos(bearing) * Math.sin(angle);
			var gradeZ = startZ - plannedLength * Math.cos(angle);

			// Step 23) Calculate toe point (actual end with subdrill)
			var toeX = startX + length * Math.sin(bearing) * Math.sin(angle);
			var toeY = startY + length * Math.cos(bearing) * Math.sin(angle);
			var toeZ = startZ - length * Math.cos(angle);

			// Step 24) Circle radii
			var collarRadius = hole.holeDiameter ? hole.holeDiameter / 1000 / 2 : 0.1;
			var gradeRadius = 0.08;
			var toeRadius = 0.06;

			// Step 25) All geometry goes on HOLES layer

			// Collar circle (green)
			dxf += "0\nCIRCLE\n8\nHOLES\n";
			dxf += "10\n" + startX + "\n20\n" + startY + "\n30\n" + startZ + "\n";
			dxf += "40\n" + collarRadius + "\n";
			dxf += "420\n65280\n"; // Green

			// Hole track line (grey - full length from collar to toe)
			dxf += "0\nLINE\n8\nHOLES\n";
			dxf += "10\n" + startX + "\n20\n" + startY + "\n30\n" + startZ + "\n";
			dxf += "11\n" + toeX + "\n21\n" + toeY + "\n31\n" + toeZ + "\n";
			dxf += "420\n9868950\n"; // Grey

			// Grade circle (orange - end of planned hole)
			if (plannedLength > 0) {
				dxf += "0\nCIRCLE\n8\nHOLES\n";
				dxf += "10\n" + gradeX + "\n20\n" + gradeY + "\n30\n" + gradeZ + "\n";
				dxf += "40\n" + gradeRadius + "\n";
				dxf += "420\n16753920\n"; // Orange
			}

			// Toe circle (red)
			dxf += "0\nCIRCLE\n8\nHOLES\n";
			dxf += "10\n" + toeX + "\n20\n" + toeY + "\n30\n" + toeZ + "\n";
			dxf += "40\n" + toeRadius + "\n";
			dxf += "420\n16711680\n"; // Red

			// Step 26) Hole ID text goes on HOLE_TEXT layer
			var holeID = hole.holeID || "Unknown";
			dxf += "0\nTEXT\n8\nHOLE_TEXT\n";
			dxf += "10\n" + startX + "\n20\n" + startY + "\n30\n" + startZ + "\n";
			dxf += "40\n" + this.textHeight + "\n";
			dxf += "50\n0.0\n";
			dxf += "1\n" + holeID + "\n";
			dxf += "420\n9868950\n"; // Grey
		}

		// Step 27) Close ENTITIES section and file
		dxf += "0\nENDSEC\n0\nEOF\n";

		return dxf;
	}
}

export default DXFHOLESWriter;
