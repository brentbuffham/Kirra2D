// src/fileIO/init.js
//=============================================================
// FILEMANAGER INITIALIZATION
//=============================================================
// Step 1) Initialize FileManager and register all parsers/writers
// Step 2) Import this module to setup the file IO system
// Step 3) Created: 2026-01-03, Updated: 2026-01-17

import fileManager from "./FileManager.js";

// Text/CSV Parsers and Writers
import BlastHoleCSVParser from "./TextIO/BlastHoleCSVParser.js";
import BlastHoleCSVWriter from "./TextIO/BlastHoleCSVWriter.js";
import CustomBlastHoleTextParser from "./TextIO/CustomBlastHoleTextParser.js";
import CustomBlastHoleTextWriter from "./TextIO/CustomBlastHoleTextWriter.js";

// Kirra Native Format
import KADParser from "./KirraIO/KADParser.js";
import KADWriter from "./KirraIO/KADWriter.js";

// ShotPlus Format
import SPFParser from "./OricaIO/SPFParser.js";
//import SPFWriter from "./OricaIO/SPFWriter.js"; //not implemented yet

// AutoCAD DXF (ASCII and Binary)
import DXFParser from "./AutoCadIO/DXFParser.js";
import BinaryDXFParser from "./AutoCadIO/BinaryDXFParser.js";
import BinaryDXFWriter from "./AutoCadIO/BinaryDXFWriter.js";
import DXFHOLESWriter from "./AutoCadIO/DXFHOLESWriter.js";
import DXFVulcanWriter from "./AutoCadIO/DXFVulcanWriter.js";
import DXF3DFACEWriter from "./AutoCadIO/DXF3DFACEWriter.js";
import DXFKADWriter from "./AutoCadIO/DXFKADWriter.js";

// ESRI Shapefile
import SHPFileParser from "./EsriIO/SHPFileParser.js";
import SHPFileWriter from "./EsriIO/SHPFileWriter.js";

// LiDAR LAS Format
import LASParser from "./LasFileIO/LASParser.js";
import LASWriter from "./LasFileIO/LASWriter.js";

// 3D Mesh Formats
import OBJParser from "./ThreeJSMeshIO/OBJParser.js";
import OBJWriter from "./ThreeJSMeshIO/OBJWriter.js";
import PLYParser from "./ThreeJSMeshIO/PLYParser.js";

// Point Cloud
import PointCloudParser from "./PointCloudIO/PointCloudParser.js";
import PointCloudWriter from "./PointCloudIO/PointCloudWriter.js";

// Mining Software Formats
import AQMWriter from "./MinestarIO/AQMWriter.js";
import SurpacSTRParser from "./SurpacIO/SurpacSTRParser.js";
import SurpacSTRWriter from "./SurpacIO/SurpacSTRWriter.js";
import SurpacDTMParser from "./SurpacIO/SurpacDTMParser.js";
import SurpacDTMWriter from "./SurpacIO/SurpacDTMWriter.js";
import SurpacSurfaceParser from "./SurpacIO/SurpacSurfaceParser.js";

// Epiroc Formats
import IREDESParser from "./EpirocIO/IREDESParser.js";
import IREDESWriter from "./EpirocIO/IREDESWriter.js";
import SurfaceManagerParser from "./EpirocIO/SurfaceManagerParser.js";
import SurfaceManagerWriter from "./EpirocIO/SurfaceManagerWriter.js";

// CBLAST Format
import CBLASTParser from "./CBlastIO/CBLASTParser.js";
import CBLASTWriter from "./CBlastIO/CBLASTWriter.js";

// Wenco NAV Format
import NAVAsciiParser from "./WencoIO/NAVAsciiParser.js";
import NAVAsciiWriter from "./WencoIO/NAVAsciiWriter.js";

// Image/GIS Formats
import { IMGParser } from "./ImageIO/IMGParser.js";
import { IMGWriter } from "./ImageIO/IMGWriter.js";
import KMLKMZWriter from "./GoogleMapsIO/KMLKMZWriter.js";
import KMLKMZParser from "./GoogleMapsIO/KMLKMZParser.js";

// Step 4) Initialize FileManager with all parsers and writers
export function initializeFileManager() {
	console.log("Initializing FileManager with parsers and writers...");

	// =========================================================================
	// BLASTING FORMATS
	// =========================================================================

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

	// =========================================================================
	// CAD FORMATS
	// =========================================================================

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

	// Step 9) Register DXF parser (ASCII) - auto-detection handled in FileManager
	fileManager.registerParser("dxf", DXFParser, {
		extensions: ["dxf"],
		description: "DXF ASCII file parser (POINT, LINE, POLYLINE, CIRCLE, ELLIPSE, TEXT, 3DFACE)",
		category: "cad"
	});

	// Step 9a) Register Binary DXF parser
	fileManager.registerParser("dxf-binary", BinaryDXFParser, {
		extensions: ["dxf"],
		description: "DXF Binary file parser (25% smaller, 5x faster than ASCII)",
		category: "cad"
	});

	// Step 10) Register DXF writer (compact 2-layer format)
	fileManager.registerWriter("dxf-holes", DXFHOLESWriter, {
		extensions: ["dxf"],
		description: "DXF Holes (compact 2-layer format)",
		category: "cad"
	});

	// Step 10a) Register DXF KAD writer (KAD drawings export)
	fileManager.registerWriter("dxf-kad", DXFKADWriter, {
		extensions: ["dxf"],
		description: "DXF KAD drawings (points, lines, polygons, circles, text)",
		category: "cad"
	});

	// Step 10b) Register DXF Vulcan writer (3D POLYLINE with Vulcan XData)
	fileManager.registerWriter("dxf-vulcan", DXFVulcanWriter, {
		extensions: ["dxf"],
		description: "DXF Vulcan (3D POLYLINE with Vulcan XData tags)",
		category: "cad"
	});

	// Step 10c) Register DXF 3DFACE writer (surface triangles)
	fileManager.registerWriter("dxf-3dface", DXF3DFACEWriter, {
		extensions: ["dxf"],
		description: "DXF 3DFACE (surface triangles)",
		category: "cad"
	});

	// Step 10d) Register Binary DXF writer (KAD, holes, surfaces)
	fileManager.registerWriter("dxf-binary", BinaryDXFWriter, {
		extensions: ["dxf"],
		description: "DXF Binary format (25% smaller, 5x faster than ASCII)",
		category: "cad"
	});

	// Step 10e) Register Binary DXF Vulcan writer (with Vulcan XData)
	fileManager.registerWriter("dxf-binary-vulcan", BinaryDXFWriter, {
		extensions: ["dxf"],
		description: "DXF Binary with Vulcan XData tags",
		category: "cad"
	});

	// =========================================================================
	// ORICA SHOTPLUS FORMAT
	// =========================================================================

	// Step 10f) Register Orica ShotPlus SPF parser
	fileManager.registerParser("orica-spf", SPFParser, {
		extensions: ["spf"],
		description: "Orica ShotPlus SPF file (ZIP archive with XML blast data)",
		category: "blasting"
	});

	// =========================================================================
	// GIS / SHAPEFILE FORMATS
	// =========================================================================

	// Step 11) Register ESRI Shapefile parser
	fileManager.registerParser("shapefile", SHPFileParser, {
		extensions: ["shp"],
		description: "ESRI Shapefile (Point, PolyLine, Polygon, with Z variants)",
		category: "gis"
	});

	// Step 11a) Register ESRI Shapefile writer
	fileManager.registerWriter("shapefile", SHPFileWriter, {
		extensions: ["shp", "zip"],
		description: "ESRI Shapefile export (.shp, .shx, .dbf, .prj as ZIP)",
		category: "gis"
	});

	// =========================================================================
	// LIDAR / POINT CLOUD FORMATS
	// =========================================================================

	// Step 12) Register LAS (LiDAR) parser
	fileManager.registerParser("las", LASParser, {
		extensions: ["las", "laz"],
		description: "ASPRS LAS LiDAR format (versions 1.2, 1.3, 1.4)",
		category: "point-cloud"
	});

	// Step 12a) Register LAS (LiDAR) writer
	fileManager.registerWriter("las", LASWriter, {
		extensions: ["las"],
		description: "ASPRS LAS LiDAR format export",
		category: "point-cloud"
	});

	// Step 12b) Register Point Cloud CSV parser
	fileManager.registerParser("pointcloud-csv", PointCloudParser, {
		extensions: ["csv", "xyz", "txt"],
		description: "Point Cloud CSV (x,y,z format with optional header)",
		category: "point-cloud"
	});

	// Step 12c) Register Point Cloud writer
	fileManager.registerWriter("pointcloud-xyz", PointCloudWriter, {
		extensions: ["xyz", "txt", "csv"],
		description: "Point Cloud XYZ format (X,Y,Z or X,Y,Z,R,G,B)",
		category: "point-cloud"
	});

	// =========================================================================
	// 3D MESH FORMATS
	// =========================================================================

	// Step 13) Register OBJ parser
	fileManager.registerParser("obj", OBJParser, {
		extensions: ["obj"],
		description: "Wavefront OBJ file parser (vertices, faces, UVs, normals, materials)",
		category: "3d-mesh"
	});

	// Step 13a) Register PLY parser
	fileManager.registerParser("ply", PLYParser, {
		extensions: ["ply"],
		description: "PLY file parser (ASCII and Binary formats, vertices, faces, normals, colors)",
		category: "3d-mesh"
	});

	// Step 13b) Register OBJ writer
	fileManager.registerWriter("obj", OBJWriter, {
		extensions: ["obj"],
		description: "Wavefront OBJ file writer (vertices, faces, normals, UVs)",
		category: "3d-mesh"
	});

	// =========================================================================
	// MINING SOFTWARE FORMATS
	// =========================================================================

	// Step 14) Register MineStar AQM writer
	fileManager.registerWriter("aqm-csv", AQMWriter, {
		extensions: ["csv"],
		description: "MineStar AQM CSV format (dynamic column ordering)",
		category: "mining"
	});

	// Step 15) Register Surpac STR parser
	fileManager.registerParser("surpac-str", SurpacSTRParser, {
		extensions: ["str"],
		description: "Surpac STR (String) format - blast holes and KAD entities",
		category: "mining"
	});

	// Step 15a) Register Surpac STR writer
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

	// Step 16a) Register Surpac DTM writer
	fileManager.registerWriter("surpac-dtm", SurpacDTMWriter, {
		extensions: ["dtm"],
		description: "Surpac DTM (Digital Terrain Model) format",
		category: "mining"
	});

	// Step 17) Register Surpac Surface parser (DTM + STR pair)
	fileManager.registerParser("surpac-surface", SurpacSurfaceParser, {
		extensions: ["dtm", "str"],
		description: "Surpac Surface (DTM + STR pair) - triangulated surface",
		category: "mining"
	});

	// Step 18) Register Epiroc Surface Manager parser
	fileManager.registerParser("surface-manager", SurfaceManagerParser, {
		extensions: ["geofence", "hazard", "sockets", "txt"],
		description: "Epiroc Surface Manager Y,X coordinate files (geofence/hazard/sockets)",
		category: "mining"
	});

	// Step 18a) Register Epiroc Surface Manager writer
	fileManager.registerWriter("surface-manager", SurfaceManagerWriter, {
		extensions: ["geofence", "hazard", "sockets", "txt"],
		description: "Epiroc Surface Manager Y,X coordinate files (geofence/hazard/sockets)",
		category: "mining"
	});

	// Step 19) Register Epiroc IREDES parser
	fileManager.registerParser("iredes-xml", IREDESParser, {
		extensions: ["xml"],
		description: "Epiroc IREDES XML drill plan import",
		category: "mining"
	});

	// Step 19a) Register Epiroc IREDES writer
	fileManager.registerWriter("iredes-xml", IREDESWriter, {
		extensions: ["xml"],
		description: "Epiroc IREDES XML drill plan export",
		category: "mining"
	});

	// Step 20) Register CBLAST parser
	fileManager.registerParser("cblast-csv", CBLASTParser, {
		extensions: ["csv"],
		description: "CBLAST CSV format (4 records per hole: HOLE, PRODUCT, DETONATOR, STRATA)",
		category: "mining"
	});

	// Step 20a) Register CBLAST writer
	fileManager.registerWriter("cblast-csv", CBLASTWriter, {
		extensions: ["csv"],
		description: "CBLAST CSV format export",
		category: "mining"
	});

	// =========================================================================
	// FLEET MANAGEMENT FORMATS
	// =========================================================================

	// Step 21) Register Wenco NAV ASCII parser
	fileManager.registerParser("wenco-nav", NAVAsciiParser, {
		extensions: ["nav"],
		description: "Wenco NAV ASCII format (TEXT, POINT, LINE entities)",
		category: "fleet-management"
	});

	// Step 21a) Register Wenco NAV ASCII writer
	fileManager.registerWriter("wenco-nav", NAVAsciiWriter, {
		extensions: ["nav"],
		description: "Wenco NAV ASCII format export",
		category: "fleet-management"
	});

	// =========================================================================
	// IMAGE / GIS RASTER FORMATS
	// =========================================================================

	// Step 22) Register GeoTIFF parser
	fileManager.registerParser("geotiff", IMGParser, {
		extensions: ["tif", "tiff"],
		description: "GeoTIFF raster image (elevation data and RGB/RGBA imagery)",
		category: "gis"
	});

	// Step 22a) Register GeoTIFF imagery writer (PNG + world file)
	fileManager.registerWriter("geotiff-imagery", IMGWriter, {
		extensions: ["png", "pgw"],
		description: "GeoTIFF imagery export (PNG + world file)",
		category: "gis"
	});

	// Step 22b) Register GeoTIFF elevation writer (XYZ point cloud)
	fileManager.registerWriter("geotiff-elevation", IMGWriter, {
		extensions: ["xyz", "csv"],
		description: "GeoTIFF elevation export (XYZ point cloud)",
		category: "gis"
	});

	// Step 23) Register KML/KMZ parser
	fileManager.registerParser("kml-kmz", KMLKMZParser, {
		extensions: ["kml", "kmz"],
		description: "KML/KMZ import for Google Earth (blast holes and geometry)",
		category: "gis"
	});

	// Step 23a) Register KML/KMZ writer
	fileManager.registerWriter("kml-kmz", KMLKMZWriter, {
		extensions: ["kml", "kmz"],
		description: "KML/KMZ export for Google Earth (blast holes and geometry)",
		category: "gis"
	});

	// =========================================================================
	// SUMMARY
	// =========================================================================

	console.log("FileManager initialized successfully");
	console.log("Supported parsers:", fileManager.getSupportedFormats().parsers);
	console.log("Supported writers:", fileManager.getSupportedFormats().writers);

	return fileManager;
}

// Step 24) Export the fileManager singleton
export { fileManager };

// Step 25) Auto-initialize when module loads
initializeFileManager();
