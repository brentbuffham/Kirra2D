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
import CustomBlastHoleTextParser from "./TextIO/CustomBlastHoleTextParser.js";
import CustomBlastHoleTextWriter from "./TextIO/CustomBlastHoleTextWriter.js";
import KADParser from "./KirraIO/KADParser.js";
import KADWriter from "./KirraIO/KADWriter.js";
import DXFParser from "./AutoCadIO/DXFParser.js";
import DXFHOLESWriter from "./AutoCadIO/DXFHOLESWriter.js";
import DXFVulcanWriter from "./AutoCadIO/DXFVulcanWriter.js";
import DXF3DFACEWriter from "./AutoCadIO/DXF3DFACEWriter.js";
import OBJParser from "./ThreeJSMeshIO/OBJParser.js";
import OBJWriter from "./ThreeJSMeshIO/OBJWriter.js";
import PLYParser from "./ThreeJSMeshIO/PLYParser.js";
import PointCloudParser from "./PointCloudIO/PointCloudParser.js";
import PointCloudWriter from "./PointCloudIO/PointCloudWriter.js";
import AQMWriter from "./MinestarIO/AQMWriter.js";
import SurpacSTRParser from "./SurpacIO/SurpacSTRParser.js";
import SurpacSTRWriter from "./SurpacIO/SurpacSTRWriter.js";
import SurpacDTMParser from "./SurpacIO/SurpacDTMParser.js";
import SurpacDTMWriter from "./SurpacIO/SurpacDTMWriter.js";
import SurpacBinarySTRParser from "./SurpacIO/SurpacBinarySTRParser.js";
import SurpacBinaryDTMParser from "./SurpacIO/SurpacBinaryDTMParser.js";
import SurpacSurfaceParser from "./SurpacIO/SurpacSurfaceParser.js";
import IREDESParser from "./EpirocIO/IREDESParser.js";
import IREDESWriter from "./EpirocIO/IREDESWriter.js";
import SurfaceManagerParser from "./EpirocIO/SurfaceManagerParser.js";
import SurfaceManagerWriter from "./EpirocIO/SurfaceManagerWriter.js";
import CBLASTParser from "./CBlastIO/CBLASTParser.js";
import CBLASTWriter from "./CBlastIO/CBLASTWriter.js";
import NAVAsciiParser from "./WencoIO/NAVAsciiParser.js";
import NAVAsciiWriter from "./WencoIO/NAVAsciiWriter.js";

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

	fileManager.registerWriter("blasthole-csv-allcolumns", BlastHoleCSVWriter, {
		extensions: ["csv"],
		description: "Blast Hole CSV all columns (dynamic)",
		category: "blasting"
	});

	// Step 6a) Register Custom CSV parser
	fileManager.registerParser("custom-csv", CustomBlastHoleTextParser, {
		extensions: ["csv", "txt"],
		description: "Custom CSV with field mapping and smart row detection",
		category: "blasting"
	});

	// Step 6b) Register Custom CSV writer
	fileManager.registerWriter("custom-csv", CustomBlastHoleTextWriter, {
		extensions: ["csv"],
		description: "Custom CSV with user-defined column order",
		category: "blasting"
	});

	// Step 6c) Register Epiroc Surface Manager parser (geofence/hazard/sockets - Y,X format)
	fileManager.registerParser("surface-manager", SurfaceManagerParser, {
		extensions: ["geofence", "hazard", "sockets", "txt"],
		description: "Epiroc Surface Manager Y,X coordinate files (geofence/hazard/sockets)",
		category: "mining"
	});

	// Step 6d) Register Epiroc Surface Manager writer (geofence/hazard/sockets - Y,X format)
	fileManager.registerWriter("surface-manager", SurfaceManagerWriter, {
		extensions: ["geofence", "hazard", "sockets", "txt"],
		description: "Epiroc Surface Manager Y,X coordinate files (geofence/hazard/sockets)",
		category: "mining"
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

	// Step 10a) Register DXF Vulcan writer (3D POLYLINE with Vulcan XData)
	fileManager.registerWriter("dxf-vulcan", DXFVulcanWriter, {
		extensions: ["dxf"],
		description: "DXF Vulcan (3D POLYLINE with Vulcan XData tags)",
		category: "cad"
	});

	// Step 10b) Register DXF 3DFACE writer (surface triangles)
	fileManager.registerWriter("dxf-3dface", DXF3DFACEWriter, {
		extensions: ["dxf"],
		description: "DXF 3DFACE (surface triangles)",
		category: "cad"
	});

	// Step 11) Register OBJ parser
	fileManager.registerParser("obj", OBJParser, {
		extensions: ["obj"],
		description: "Wavefront OBJ file parser (vertices, faces, UVs, normals, materials)",
		category: "3d-mesh"
	});

	// Step 11a) Register PLY parser
	fileManager.registerParser("ply", PLYParser, {
		extensions: ["ply"],
		description: "PLY file parser (ASCII and Binary formats, vertices, faces, normals, colors)",
		category: "3d-mesh"
	});

	// Step 11b) Register OBJ writer
	fileManager.registerWriter("obj", OBJWriter, {
		extensions: ["obj"],
		description: "Wavefront OBJ file writer (vertices, faces, normals, UVs)",
		category: "3d-mesh"
	});

	// Step 12) Register Point Cloud CSV parser
	fileManager.registerParser("pointcloud-csv", PointCloudParser, {
		extensions: ["csv", "xyz", "txt"],
		description: "Point Cloud CSV (x,y,z format with optional header)",
		category: "point-cloud"
	});

	// Step 12a) Register Point Cloud writer
	fileManager.registerWriter("pointcloud-xyz", PointCloudWriter, {
		extensions: ["xyz", "txt", "csv"],
		description: "Point Cloud XYZ format (X,Y,Z or X,Y,Z,R,G,B)",
		category: "point-cloud"
	});

	// Step 13) Register MineStar AQM writer
	fileManager.registerWriter("aqm-csv", AQMWriter, {
		extensions: ["csv"],
		description: "MineStar AQM CSV format (dynamic column ordering)",
		category: "mining"
	});

	// Step 14) Register Surpac STR parser
	fileManager.registerParser("surpac-str", SurpacSTRParser, {
		extensions: ["str"],
		description: "Surpac STR (String) format - blast holes and KAD entities",
		category: "mining"
	});

	// Step 15) Register Surpac STR writer
	fileManager.registerWriter("surpac-str", SurpacSTRWriter, {
		extensions: ["str"],
		description: "Surpac STR (String) format",
		category: "mining"
	});

	// Step 16) Register Surpac DTM parser
	fileManager.registerParser("surpac-dtm", SurpacDTMParser, {
		extensions: ["dtm"],
		description: "Surpac DTM (Digital Terrain Model) format - point cloud",
		category: "mining"
	});

	// Step 17) Register Surpac DTM writer
	fileManager.registerWriter("surpac-dtm", SurpacDTMWriter, {
		extensions: ["dtm"],
		description: "Surpac DTM (Digital Terrain Model) format",
		category: "mining"
	});

	// Step 18) Register Surpac Surface parser (DTM + STR pair)
	fileManager.registerParser("surpac-surface", SurpacSurfaceParser, {
		extensions: ["dtm", "str"],
		description: "Surpac Surface (DTM + STR pair) - triangulated surface",
		category: "mining"
	});

	// Step 19) Register Epiroc IREDES parser
	fileManager.registerParser("iredes-xml", IREDESParser, {
		extensions: ["xml"],
		description: "Epiroc IREDES XML drill plan import",
		category: "mining"
	});

	// Step 20) Register Epiroc IREDES writer
	fileManager.registerWriter("iredes-xml", IREDESWriter, {
		extensions: ["xml"],
		description: "Epiroc IREDES XML drill plan export",
		category: "mining"
	});

	// Step 21) Register CBLAST parser
	fileManager.registerParser("cblast-csv", CBLASTParser, {
		extensions: ["csv"],
		description: "CBLAST CSV format (4 records per hole: HOLE, PRODUCT, DETONATOR, STRATA)",
		category: "mining"
	});

	// Step 22) Register CBLAST writer
	fileManager.registerWriter("cblast-csv", CBLASTWriter, {
		extensions: ["csv"],
		description: "CBLAST CSV format export",
		category: "mining"
	});

	// Step 23) Register Wenco NAV ASCII parser
	fileManager.registerParser("wenco-nav", NAVAsciiParser, {
		extensions: ["nav"],
		description: "Wenco NAV ASCII format (TEXT, POINT, LINE entities)",
		category: "fleet-management"
	});

	// Step 24) Register Wenco NAV ASCII writer
	fileManager.registerWriter("wenco-nav", NAVAsciiWriter, {
		extensions: ["nav"],
		description: "Wenco NAV ASCII format export",
		category: "fleet-management"
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
