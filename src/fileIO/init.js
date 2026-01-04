// src/fileIO/init.js
//=============================================================
// FILEMANAGER INITIALIZATION
//=============================================================
// Step 1) Initialize FileManager and register all parsers/writers
// Step 2) Import this module to setup the file IO system
// Step 3) Created: 2026-01-03

import fileManager from "./FileManager.js";
import BlastHoleCSVParser from "./TextIO/BlastHoleCSVParser.js";
import BlastHoleCSVWriter from "./TextIO/BlastHoleCSVWriter.js";
import KADParser from "./KirraIO/KADParser.js";
import KADWriter from "./KirraIO/KADWriter.js";
import DXFParser from "./AutoCadIO/DXFParser.js";
import DXFHOLESWriter from "./AutoCadIO/DXFHOLESWriter.js";
import OBJParser from "./ThreeJSMeshIO/OBJParser.js";
import PointCloudParser from "./PointCloudIO/PointCloudParser.js";
import AQMWriter from "./MinestarIO/AQMWriter.js";

// Step 4) Initialize FileManager with all parsers and writers
export function initializeFileManager() {
	console.log("Initializing FileManager with parsers and writers...");

	// Step 5) Register BlastHole CSV parser
	fileManager.registerParser("blasthole-csv", BlastHoleCSVParser, {
		extensions: ["csv"],
		description: "Blast Hole CSV (4/7/9/12/14/20/25/30/32/35 columns)",
		category: "blasting"
	});

	// Step 6) Register BlastHole CSV writer (multiple formats)
	fileManager.registerWriter("blasthole-csv-12", BlastHoleCSVWriter, {
		extensions: ["csv"],
		description: "Blast Hole CSV 12-column format",
		category: "blasting"
	});

	fileManager.registerWriter("blasthole-csv-14", BlastHoleCSVWriter, {
		extensions: ["csv"],
		description: "Blast Hole CSV 14-column format",
		category: "blasting"
	});

	fileManager.registerWriter("blasthole-csv-35", BlastHoleCSVWriter, {
		extensions: ["csv"],
		description: "Blast Hole CSV 35-column format (all data)",
		category: "blasting"
	});

	fileManager.registerWriter("blasthole-csv-actual", BlastHoleCSVWriter, {
		extensions: ["csv"],
		description: "Blast Hole CSV actual data (measured)",
		category: "blasting"
	});

	// Step 7) Register KAD parser
	fileManager.registerParser("kad", KADParser, {
		extensions: ["kad", "txt"],
		description: "Kirra KAD format (point, line, poly, circle, text)",
		category: "cad"
	});

	// Step 8) Register KAD writer
	fileManager.registerWriter("kad", KADWriter, {
		extensions: ["kad", "txt"],
		description: "Kirra KAD format export",
		category: "cad"
	});

	// Step 9) Register DXF parser
	fileManager.registerParser("dxf", DXFParser, {
		extensions: ["dxf"],
		description: "DXF file parser (POINT, LINE, POLYLINE, CIRCLE, ELLIPSE, TEXT, 3DFACE)",
		category: "cad"
	});

	// Step 10) Register DXF writer (compact 2-layer format)
	fileManager.registerWriter("dxf-holes", DXFHOLESWriter, {
		extensions: ["dxf"],
		description: "DXF Holes (compact 2-layer format)",
		category: "cad"
	});

	// Step 11) Register OBJ parser
	fileManager.registerParser("obj", OBJParser, {
		extensions: ["obj"],
		description: "Wavefront OBJ file parser (vertices, faces, UVs, normals, materials)",
		category: "3d-mesh"
	});

	// Step 12) Register Point Cloud CSV parser
	fileManager.registerParser("pointcloud-csv", PointCloudParser, {
		extensions: ["csv", "xyz", "txt"],
		description: "Point Cloud CSV (x,y,z format with optional header)",
		category: "point-cloud"
	});

	// Step 13) Register MineStar AQM writer
	fileManager.registerWriter("aqm-csv", AQMWriter, {
		extensions: ["csv"],
		description: "MineStar AQM CSV format (dynamic column ordering)",
		category: "mining"
	});

	console.log("FileManager initialized successfully");
	console.log("Supported parsers:", fileManager.getSupportedFormats().parsers);
	console.log("Supported writers:", fileManager.getSupportedFormats().writers);

	return fileManager;
}

// Step 10) Export the fileManager singleton
export { fileManager };

// Step 11) Auto-initialize when module loads
initializeFileManager();
