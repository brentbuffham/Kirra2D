# File Formats

Kirra supports a comprehensive range of file formats for blast hole design, surface modeling, CAD drawings, and GIS data. This page documents the FileManager architecture and all supported formats.

## FileManager Architecture

### Overview

Kirra uses a **plugin-based FileManager system** for all file I/O operations. The system is built around three core concepts:

1. **Central Registry**: A singleton `FileManager` class maintains `Map` objects for all registered parsers and writers
2. **Base Classes**: All parsers extend `BaseParser.js`, all writers extend `BaseWriter.js`
3. **Auto-Registration**: Formats are registered at application startup via `init.js`

### FileManager Singleton

**Location**: `src/fileIO/FileManager.js`

The FileManager provides:
- **Parser registry** (`Map<string, ParserClass>`)
- **Writer registry** (`Map<string, WriterClass>`)
- **Format metadata** (extensions, descriptions, categories)
- **Format auto-detection** from file extensions
- **Binary vs ASCII detection** for formats like DXF

```javascript
// FileManager registries
this.parsers = new Map();     // format key → ParserClass
this.writers = new Map();     // format key → WriterClass
this.formatMetadata = new Map(); // format key → {extensions, description, category}
```

### Parser/Writer Lifecycle

**Registration** (`init.js`):
```javascript
fileManager.registerParser("blasthole-csv", BlastHoleCSVParser, {
  extensions: ["csv"],
  description: "Blast Hole CSV (4/7/9/12/14/20/25/30/32/35 columns)",
  category: "blasting"
});
```

**Parsing** (invoked by FileManager):
```javascript
var Parser = this.parsers.get(format);
var parser = new Parser(options);
var result = await parser.parse(file);
```

**Writing** (invoked by FileManager):
```javascript
var Writer = this.writers.get(format);
var writer = new Writer(options);
await writer.write(data);
```

### Base Classes

**BaseParser.js**:
- Abstract `async parse(file)` method
- File reading utilities (text, binary, ArrayBuffer)
- Error handling and validation

**BaseWriter.js**:
- Abstract `async write(data)` method
- File download utilities (File System Access API with fallback)
- Filename sanitization

### init.js Registration System

**Location**: `src/fileIO/init.js`

The `init.js` module:
1. Imports all parser and writer classes
2. Registers each format with metadata
3. Exports the configured `fileManager` singleton
4. Auto-executes on module load

**Registration Categories**:
- `blasting` - Blast hole formats
- `cad` - CAD drawing formats (DXF, KAD)
- `mining` - Mining software formats (Surpac, IREDES, AQM)
- `gis` - GIS/geospatial formats (GeoTIFF, KML, Shapefile)
- `3d-mesh` - 3D mesh formats (OBJ, PLY, GLTF)
- `point-cloud` - Point cloud formats (XYZ, PTS, PTX, LAS)
- `fleet-management` - Fleet management formats (Wenco NAV)

---

## FileIO Module Directory Structure

```
src/fileIO/
├── FileManager.js          # Central singleton with parser/writer registries
├── BaseParser.js           # Base class for all parsers
├── BaseWriter.js           # Base class for all writers
├── init.js                 # Registration of all parsers and writers
│
├── AutoCadIO/              # DXF ASCII + Binary parsers/writers
│   ├── DXFParser.js             # ASCII DXF parser
│   ├── BinaryDXFParser.js       # Binary DXF parser (25% smaller, 5x faster)
│   ├── DXFHOLESWriter.js        # Compact 2-layer blast hole export
│   ├── DXFKADWriter.js          # KAD drawings export
│   ├── DXFVulcanWriter.js       # Vulcan-tagged 3D POLYLINE export
│   ├── DXF3DFACEWriter.js       # 3DFACE surface triangles export
│   ├── BinaryDXFWriter.js       # Binary DXF writer
│   └── DXFUtils.js              # Shared DXF utilities
│
├── CBlastIO/               # Orica CBLAST CSV format
│   ├── CBLASTParser.js          # CBLAST CSV import (4 records per hole)
│   └── CBLASTWriter.js          # CBLAST CSV export
│
├── EpirocIO/               # Epiroc formats (IREDES XML + Surface Manager)
│   ├── IREDESParser.js          # IREDES XML drill plan import
│   ├── IREDESWriter.js          # IREDES XML drill plan export
│   ├── SurfaceManagerParser.js  # Y,X coordinate files (.geofence, .hazard, .sockets)
│   └── SurfaceManagerWriter.js  # Y,X coordinate export
│
├── EsriIO/                 # ESRI Shapefile formats
│   ├── SHPFileParser.js         # Shapefile import (Point, PolyLine, Polygon with Z)
│   └── SHPFileWriter.js         # Shapefile export (ZIP with .shp, .shx, .dbf, .prj)
│
├── GoogleMapsIO/           # KML/KMZ import/export
│   ├── KMLKMZParser.js          # Google Earth blast holes and geometry import
│   └── KMLKMZWriter.js          # Google Earth export
│
├── ImageIO/                # GeoTIFF raster formats
│   ├── IMGParser.js             # GeoTIFF elevation + RGB/RGBA imagery import
│   └── IMGWriter.js             # PNG + world file export, XYZ elevation export
│
├── KirraIO/                # Kirra native KAD format
│   ├── KADParser.js             # KAD drawing format import
│   └── KADWriter.js             # KAD drawing format export
│
├── LasFileIO/              # LiDAR LAS format
│   ├── LASParser.js             # ASPRS LAS versions 1.2, 1.3, 1.4
│   └── LASWriter.js             # LAS export
│
├── MinestarIO/             # Cat MineStar AQM format
│   └── AQMWriter.js             # AQM CSV with dynamic column ordering
│
├── OricaIO/                # Orica ShotPlus SPF format
│   └── SPFParser.js             # SPF ZIP archive with XML blast data
│
├── PointCloudIO/           # Point cloud formats
│   ├── PointCloudParser.js      # XYZ, PTS, PTX, CSV with optional RGB/intensity
│   └── PointCloudWriter.js      # XYZ, CSV, PTS, PTX export
│
├── SurpacIO/               # Surpac DTM/STR formats
│   ├── SurpacDTMParser.js       # DTM terrain model import
│   ├── SurpacDTMWriter.js       # DTM terrain model export
│   ├── SurpacSTRParser.js       # STR string format import (blast holes + KAD)
│   ├── SurpacSTRWriter.js       # STR string format export
│   └── SurpacSurfaceParser.js   # Paired DTM+STR triangulated surface import
│
├── TextIO/                 # CSV and text formats
│   ├── BlastHoleCSVParser.js    # 10 column format variants
│   ├── BlastHoleCSVWriter.js    # 5 export formats + dynamic "all columns"
│   ├── CustomBlastHoleTextParser.js  # Field mapping with smart row detection
│   └── CustomBlastHoleTextWriter.js  # Custom column order export
│
├── ThreeJSMeshIO/          # 3D mesh formats
│   ├── OBJParser.js             # Wavefront OBJ (vertices, faces, UVs, normals, materials)
│   ├── OBJWriter.js             # Wavefront OBJ export
│   ├── PLYParser.js             # PLY (ASCII and Binary)
│   ├── GLTFParser.js            # GLTF/GLB import
│   └── GLTFWriter.js            # GLTF/GLB export
│
└── WencoIO/                # Wenco NAV ASCII format
    ├── NAVAsciiParser.js        # NAV TEXT, POINT, LINE entities import
    └── NAVAsciiWriter.js        # NAV ASCII export
```

---

## Complete Format Registry

### Parsers

| Format Key | Class | Extensions | Category | Description |
|------------|-------|------------|----------|-------------|
| `blasthole-csv` | BlastHoleCSVParser | .csv | blasting | Blast Hole CSV (4/7/9/12/14/20/25/30/32/35 column formats) |
| `custom-csv` | CustomBlastHoleTextParser | .csv, .txt | blasting | Custom CSV with field mapping and smart row detection |
| `dxf` | DXFParser | .dxf | cad | ASCII DXF (POINT, LINE, POLYLINE, CIRCLE, ELLIPSE, TEXT, 3DFACE) |
| `dxf-binary` | BinaryDXFParser | .dxf | cad | Binary DXF (25% smaller, 5x faster than ASCII) |
| `orica-spf` | SPFParser | .spf | blasting | Orica ShotPlus SPF (ZIP archive with XML blast data) |
| `pointcloud-csv` | PointCloudParser | .csv, .xyz, .txt, .pts, .ptx | point-cloud | Point Cloud (XYZ, PTS, PTX, CSV with optional RGB/intensity) |
| `obj` | OBJParser | .obj | 3d-mesh | Wavefront OBJ (vertices, faces, UVs, normals, materials) |
| `ply` | PLYParser | .ply | 3d-mesh | PLY (ASCII and Binary, vertices, faces, normals, colors) |
| `surpac-str` | SurpacSTRParser | .str | mining | Surpac STR (String) format - blast holes and KAD entities |
| `surpac-dtm` | SurpacDTMParser | .dtm | mining | Surpac DTM (Digital Terrain Model) - point cloud |
| `surpac-surface` | SurpacSurfaceParser | .dtm+.str | mining | Surpac Surface (DTM + STR pair) - triangulated surface |
| `surface-manager` | SurfaceManagerParser | .geofence, .hazard, .sockets, .txt | mining | Epiroc Surface Manager Y,X coordinate files |
| `iredes-xml` | IREDESParser | .xml | mining | Epiroc IREDES XML drill plan import |
| `cblast-csv` | CBLASTParser | .csv | mining | CBLAST CSV (4 records per hole: HOLE, PRODUCT, DETONATOR, STRATA) |
| `wenco-nav` | NAVAsciiParser | .nav | fleet-management | Wenco NAV ASCII (TEXT, POINT, LINE entities) |
| `geotiff` | IMGParser | .tif, .tiff | gis | GeoTIFF raster (elevation + RGB/RGBA imagery) |
| `kml-kmz` | KMLKMZParser | .kml, .kmz | gis | Google Earth KML/KMZ (blast holes and geometry) |
| `shapefile` | SHPFileParser | .shp | gis | ESRI Shapefile (Point, PolyLine, Polygon with Z variants) |
| `las` | LASParser | .las, .laz | point-cloud | ASPRS LAS LiDAR (versions 1.2, 1.3, 1.4) |
| `kad` | KADParser | .kad, .txt | cad | Kirra KAD format (point, line, poly, circle, text) |

### Writers

| Format Key | Class | Extensions | Category | Description |
|------------|-------|------------|----------|-------------|
| `blasthole-csv-12` | BlastHoleCSVWriter | .csv | blasting | 12-column format |
| `blasthole-csv-14` | BlastHoleCSVWriter | .csv | blasting | 14-column KIRRA format |
| `blasthole-csv-35` | BlastHoleCSVWriter | .csv | blasting | 35-column all data |
| `blasthole-csv-actual` | BlastHoleCSVWriter | .csv | blasting | Actual/measured data export |
| `blasthole-csv-allcolumns` | BlastHoleCSVWriter | .csv | blasting | Dynamic all columns export |
| `custom-csv` | CustomBlastHoleTextWriter | .csv | blasting | Custom CSV with user-defined column order |
| `dxf-holes` | DXFHOLESWriter | .dxf | cad | Compact 2-layer format (collars + traces) |
| `dxf-kad` | DXFKADWriter | .dxf | cad | KAD drawings (points, lines, polygons, circles, text) |
| `dxf-3dface` | DXF3DFaceWriter | .dxf | cad | 3DFACE surface triangles |
| `dxf-vulcan` | DXFVulcanWriter | .dxf | cad | Vulcan tagged 3D POLYLINE with XData |
| `dxf-binary` | BinaryDXFWriter | .dxf | cad | Binary DXF (25% smaller than ASCII) |
| `dxf-binary-vulcan` | BinaryDXFWriter | .dxf | cad | Binary DXF with Vulcan XData |
| `kad` | KADWriter | .kad | cad | Kirra native drawing format |
| `aqm-csv` | AQMWriter | .csv | mining | Cat MineStar AQM (dynamic column ordering) |
| `surpac-str` | SurpacSTRWriter | .str | mining | Surpac STR format |
| `surpac-dtm` | SurpacDTMWriter | .dtm | mining | Surpac DTM format |
| `iredes-xml` | IREDESWriter | .xml | mining | IREDES XML export |
| `cblast-csv` | CBLASTWriter | .csv | mining | CBLAST CSV export |
| `wenco-nav` | NAVAsciiWriter | .nav | fleet-management | Wenco NAV ASCII export |
| `obj` | OBJWriter | .obj | 3d-mesh | Wavefront OBJ (vertices, faces, normals, UVs) |
| `pointcloud-xyz` | PointCloudWriter | .xyz, .txt | point-cloud | XYZ format (X Y Z or X Y Z R G B) |
| `pointcloud-csv` | PointCloudWriter | .csv | point-cloud | CSV format (X,Y,Z or X,Y,Z,R,G,B) |
| `pointcloud-pts` | PointCloudWriter | .pts | point-cloud | PTS format (count header + X Y Z I R G B) |
| `pointcloud-ptx` | PointCloudWriter | .ptx | point-cloud | PTX format (Leica scanner) |
| `surface-manager` | SurfaceManagerWriter | .geofence, .hazard, .sockets, .txt | mining | Epiroc Surface Manager export |
| `geotiff-imagery` | IMGWriter | .png, .pgw | gis | PNG + world file |
| `geotiff-elevation` | IMGWriter | .xyz, .csv | gis | XYZ point cloud elevation |
| `kml-kmz` | KMLKMZWriter | .kml, .kmz | gis | Google Earth KML/KMZ |
| `shapefile` | SHPFileWriter | .shp, .zip | gis | ESRI Shapefile export (ZIP with .shp, .shx, .dbf, .prj) |
| `las` | LASWriter | .las | point-cloud | ASPRS LAS LiDAR export |

---

## CSV Blast Hole Formats (Detailed)

### Import Format Support

Kirra's `BlastHoleCSVParser` supports **10 column count variants** with automatic format detection:

#### 4-Column Format (Dummy Holes)
```csv
HoleID,X,Y,Z
H001,477750.5,6771850.2,335.0
H002,477755.5,6771850.2,335.0
```
Creates collar-only holes (dummy/placeholder holes with zero-length).

**Field Mapping**:
1. `holeID`
2. `startXLocation` (collar easting)
3. `startYLocation` (collar northing)
4. `startZLocation` (collar elevation)

#### 7-Column Format (Basic Geometry)
```csv
HoleID,CollarX,CollarY,CollarZ,ToeX,ToeY,ToeZ
H001,477750.5,6771850.2,335.0,477751.2,6771849.8,320.0
H002,477755.5,6771850.2,335.0,477756.2,6771849.8,320.0
```
Full 3D hole geometry with collar and toe coordinates.

**Field Mapping**:
1. `holeID`
2. `startXLocation`, 3. `startYLocation`, 4. `startZLocation`
5. `endXLocation`, 6. `endYLocation`, 7. `endZLocation`

#### 9-Column Format (+ Diameter + Type)
```csv
HoleID,CollarX,CollarY,CollarZ,ToeX,ToeY,ToeZ,Diameter,Type
H001,477750.5,6771850.2,335.0,477751.2,6771849.8,320.0,115,Production
H002,477755.5,6771850.2,335.0,477756.2,6771849.8,320.0,115,Production
```

**Field Mapping** (adds):
8. `holeDiameter` (millimeters)
9. `holeType` (e.g., Production, Presplit, Buffer)

#### 12-Column Format (+ Timing + Color)
```csv
HoleID,CollarX,CollarY,CollarZ,ToeX,ToeY,ToeZ,Diameter,Type,FromHole,Delay,Color
H001,477750.5,6771850.2,335.0,477751.2,6771849.8,320.0,115,Production,,0,#FF0000
H002,477755.5,6771850.2,335.0,477756.2,6771849.8,320.0,115,Production,H001,25,#FF0000
```

**Field Mapping** (adds):
10. `fromHoleID` (timing connection source)
11. `timingDelayMilliseconds`
12. `colorHexDecimal` (timing arrow color)

#### 14-Column Format (KIRRA Standard)
```csv
EntityName,EntityType,HoleID,CollarX,CollarY,CollarZ,ToeX,ToeY,ToeZ,Diameter,Type,FromHole,Delay,Color
Pattern_A,hole,H001,477750.5,6771850.2,335.0,477751.2,6771849.8,320.0,115,Production,,0,#FF0000
Pattern_A,hole,H002,477755.5,6771850.2,335.0,477756.2,6771849.8,320.0,115,Production,H001,25,#FF0000
```

**Field Mapping** (adds):
1. `entityName` (blast pattern name)
2. `entityType` (always "hole")

**This is the recommended format for Kirra exports.**

#### 20-Column Format (Extended Attributes)
Adds: `gradeX`, `gradeY`, `gradeZ`, `subdrill`, `benchHeight`, `holeLength`

#### 25-Column Format (With Geometry)
Adds: `holeAngle`, `holeBearing`, `subdrillLength`, `measuredLength`, `measuredMass`

#### 30-Column Format (Full Metadata)
Adds: `rowID`, `posID`, `burden`, `spacing`, `connectorCurve`

#### 32-Column Format (With Timestamps)
Adds: `measuredLengthTimeStamp`, `measuredMassTimeStamp`

#### 35-Column Format (Complete Data)
Adds: `measuredComment`, `measuredCommentTimeStamp`, `visible`

**All extended columns** are documented in [Blast Hole Management](Blast-Hole-Management).

### Export Format Support

#### 12-Column Export
Essential data for CAD import (geometry + basic properties).

#### 14-Column Export (KIRRA)
Standard Kirra format with entity grouping.

#### 35-Column Export (All Data)
Complete export with all fields including calculated, measured, and metadata.

#### Actual Data Export
Exports measured/actual data fields only (for as-built documentation).

#### All Columns Export (Dynamic)
Dynamically detects which fields are populated and exports only those columns.

---

## DXF Format Details

### DXF Holes Export (`dxf-holes`)

**Format**: Compact 2-layer DXF
**Layers**:
- `COLLAR` - POINT entities for collar positions
- `TRACK` - 3D POLYLINE entities from collar to toe

**Use Case**: Simple hole visualization in CAD systems.

### DXF KAD Export (`dxf-kad`)

**Format**: Entity-per-layer with type-specific conversion
**Entity Types**:
- Points → POINT entities
- Lines → POLYLINE entities
- Polygons → Closed POLYLINE entities
- Circles → CIRCLE entities
- Text → TEXT entities

**Color Conversion**: Hex colors (#RRGGBB) converted to DXF color indices (1-255).

**Layer Naming**: Each KAD entity creates its own layer named after the entity.

### DXF Vulcan Export (`dxf-vulcan`)

**Format**: 3D POLYLINE with Vulcan XData tags
**XData Structure**:
```
1001 VULCAN
1000 HOLECOLLAR
1040 [holeDiameter]
1000 HOLEID
1000 [holeID]
```

**Use Case**: Import into Vulcan mine planning software with hole properties preserved.

### DXF 3DFACE Export (`dxf-3dface`)

**Format**: 3DFACE entities for surface triangles
**Structure**: Each triangle becomes one 3DFACE entity with 3-4 vertices.
**Use Case**: Export triangulated surfaces to CAD.

### Binary DXF (`dxf-binary`)

**Advantages**:
- **25% smaller** file size than ASCII DXF
- **5x faster** parsing and writing
- **Identical structure** to ASCII (just binary encoding)

**Auto-Detection**: Kirra automatically detects binary vs ASCII DXF on import by checking the first bytes (`AC1024` header for binary).

### DXF Import

**Supported Entity Types**:
- `POINT` - Imported as KAD points or blast hole collars (auto-detection based on attributes)
- `LINE` - Imported as 2-point polylines
- `POLYLINE` / `LWPOLYLINE` - Imported as KAD lines or polygons (based on CLOSED flag)
- `CIRCLE` - Imported as KAD circles
- `ELLIPSE` - Approximated as polylines with arc segments
- `TEXT` - Imported as KAD text entities
- `3DFACE` - Imported as surface triangles

**Coordinate Handling**: Full 3D support with Z-coordinates.

---

## KAD Native Format

**Extension**: `.kad`  
**Type**: Text-based, entity-per-line format  
**Purpose**: Kirra's native drawing format for polylines, points, circles, and text

### Structure

Each entity is stored as a line with the format:
```
[entityName, entityObject]
```

**entityObject** contains:
- `entityType`: "point", "line", "poly", "circle", "text"
- `geometryData`: Array of coordinate/property objects
- `layerId`: Layer reference
- `visible`: Boolean

### Example KAD File

```kad
["Boundary", {"entityType":"poly","geometryData":[{"pointID":1,"pointXLocation":477750.5,"pointYLocation":6771850.2,"pointZLocation":335.0},...], "layerId":"layer_default_drawings","visible":true}]
["Labels", {"entityType":"text","geometryData":[{"pointID":1,"pointXLocation":477755.0,"pointYLocation":6771855.0,"pointZLocation":335.0,"text":"BENCH 1","fontHeight":12},...]}]
```

### Use Cases

- Saving blast pattern layouts with annotations
- Preserving multi-layer drawing structure
- Round-trip editing with Kirra

---

## Surpac DTM/STR Format (Detailed)

### Overview

Kirra supports the **Surpac DTM/STR dual-file format** for triangulated surfaces. This format is widely used in mining software (Surpac, Vulcan, MineSight) for terrain modeling, pit design, and geological surfaces.

The DTM/STR system uses **two paired files**:
- **STR file**: Contains unique vertex coordinates (point cloud)
- **DTM file**: Contains triangle topology (TRISOLATION)

### STR File (String File) - Vertex Coordinates

The STR file stores unique 3D vertices with **1-based indexing**:

```
filename, dd-Mmm-yy,,description
0, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
32000, Y1, X1, Z1, 
32000, Y2, X2, Z2, 
32000, Y3, X3, Z3, 
...
0, 0.000, 0.000, 0.000, END
```

**Format Details**:
- **Header Line**: `filename, date, empty, description`
- **Second Line**: Seven zeros (spacing preserved from Surpac format)
- **Vertex Lines**: `32000, Y, X, Z,` (note: **Y before X** - Northing, Easting, Elevation)
  - String number `32000` indicates surface vertices
  - Trailing space after Z coordinate
  - **No duplicate vertices** - each point appears exactly once
- **End Marker**: `0, 0.000, 0.000, 0.000, END`

**Coordinate Order**: Y (Northing), X (Easting), Z (Elevation)

### DTM File (Digital Terrain Model) - Triangle Topology

The DTM file defines **how vertices connect** to form triangles:

```
filename.str,
0, 0.000, 0.000, 0.000, END
OBJECT, 1,
TRISOLATION, 1, neighbours=no,validated=true,closed=no
1, 2, 3, 1, 0, 0, 0,
2, 3, 4, 1, 0, 0, 0,
3, 5, 6, 2, 0, 0, 0,
...
END
```

**Format Details**:
- **Header Line**: References the STR filename (e.g., `mysurf.str,`)
- **Second Line**: Simple END marker
- **OBJECT Line**: Object identifier
- **TRISOLATION Line**: Triangle isolation metadata
  - `neighbours=no`: No neighbor calculations performed
  - `validated=true`: Topology is valid
  - `closed=no`: Surface is not closed (not a solid)

**Triangle Definition** (7 values per line):
```
TriangleID, Vertex1, Vertex2, Vertex3, Neighbor1, Neighbor2, Neighbor3, 0,
```

| Field | Description | Example |
|-------|-------------|---------|
| **TriangleID** | Sequential triangle number (1-based) | `1` |
| **Vertex1** | Index of first vertex from STR file | `2` |
| **Vertex2** | Index of second vertex from STR file | `3` |
| **Vertex3** | Index of third vertex from STR file | `1` |
| **Neighbor1** | Triangle sharing edge V1-V2 (0 = boundary) | `8` |
| **Neighbor2** | Triangle sharing edge V2-V3 (0 = boundary) | `4` |
| **Neighbor3** | Triangle sharing edge V3-V1 (0 = boundary) | `0` |
| **Terminator** | Always 0 | `0` |

**Vertex Indexing**:
- Vertices are **1-based** (first vertex in STR = index 1)
- Vertex order matches the STR file exactly
- Triangle vertices can be in any order (not necessarily sequential)

**Neighbor Information**:
- Value of `0` = **boundary edge** (no adjacent triangle)
- Non-zero value = ID of neighboring triangle
- Enables efficient surface traversal and topology operations

### Example Files

#### Example STR File: `24m-west-wall.str`
```
24m-west-wall,10-Jan-26,,mine-design
0, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
32000, 477743.285, 6771826.348, 334.000, 
32000, 477743.916, 6771819.412, 322.000, 
32000, 477767.820, 6771877.700, 322.000, 
32000, 477764.866, 6771878.971, 334.000, 
32000, 477744.698, 6771812.573, 310.000, 
0, 0.000, 0.000, 0.000, END
```

#### Example DTM File: `24m-west-wall.dtm`
```
24m-west-wall.str,
0, 0.000, 0.000, 0.000, END
OBJECT, 1,
TRISOLATION, 1, neighbours=no,validated=true,closed=no
1, 2, 3, 1, 8, 4, 0,
2, 3, 4, 1, 10, 0, 2,
3, 5, 6, 2, 0, 8, 0,
END
```

**Reading the Triangle Data**:
- Triangle #1: Connects vertices 2→3→1 (from STR lines 4, 5, 3)
- Triangle #2: Connects vertices 3→4→1 (from STR lines 5, 6, 3)
- Triangle #3: Connects vertices 5→6→2 (from STR lines 7, 8, 4)

### Import/Export in Kirra

#### Importing DTM/STR Surfaces

1. **File → Import → Surpac DTM Surface**
2. Select **both .dtm AND .str files** (must share same base filename)
3. Kirra parses:
   - Unique vertices from STR file
   - Triangle topology from DTM TRISOLATION section
   - Creates internal surface representation with gradient visualization

**Import Requirements**:
- Both files must have matching base filenames (e.g., `surface.dtm` + `surface.str`)
- Vertices must be numbered 1-based
- Triangle indices must reference valid vertices

#### Exporting DTM/STR Surfaces

1. **File → Export → Surpac DTM (Surfaces)**
2. Enter base filename (e.g., `mysurf`)
3. Kirra generates:
   - `mysurf.str` - Unique vertices from all visible surfaces
   - `mysurf.dtm` - TRISOLATION with triangle topology

**Export Process**:
1. **Collect Unique Vertices**: Scans all visible surface triangles
2. **Deduplicate**: Uses 3 decimal place precision matching
3. **Assign Indices**: Sequential 1-based numbering
4. **Write STR**: Outputs unique vertices in order
5. **Write DTM**: References STR filename and writes triangle indices

**Export Features**:
- Automatically deduplicates shared vertices between triangles
- Maintains coordinate precision (3 decimal places)
- Writes both files with matching base filename
- Supports multiple surfaces (merged into single DTM/STR pair)

### Technical Details

#### Coordinate System
- **X**: Easting (meters)
- **Y**: Northing (meters)
- **Z**: Elevation (meters)
- **File Format**: Y,X,Z (Northing first)
- **Typical Range**: UTM coordinates (6-7 digit values)

#### Vertex Deduplication
Kirra uses **formatted coordinate matching** to identify duplicate vertices:
```javascript
// Vertices match if coordinates are identical to 3 decimal places
key = formatNumber(x, 3) + "_" + formatNumber(y, 3) + "_" + formatNumber(z, 3);
```

This ensures:
- Consistent precision across export/import cycles
- Proper triangle connectivity
- No floating-point comparison errors

#### Triangle Winding Order
- **Clockwise or Counter-clockwise**: Format supports both
- **Normals**: Calculated from vertex order
- **Consistency**: All triangles in same surface should use same winding

### Troubleshooting

#### Problem: "Missing Files" Error on Import
**Solution**: Both .dtm and .str files must be selected together. They must share the same base filename.

#### Problem: Corrupted Surface After Export
**Solution**: Ensure surfaces are triangulated. Some import formats (CSV points) require triangulation before export.

#### Problem: Duplicate Vertices Warning
**Solution**: The STR writer automatically deduplicates. If Surpac reports duplicates, check coordinate precision.

#### Problem: Triangle Topology Errors in Surpac
**Solution**: Verify triangle vertices are wound consistently. Use Surpac's validation tools to check topology.

---

## Mining Software Formats

### IREDES XML (Epiroc)

**Extension**: `.xml`  
**Description**: Epiroc IREDES (Intelligent Rock Excavation Data Exchange Standard) drill plan format

**Features**:
- Full drill plan definition with hole geometry
- Supports pattern templates
- Includes drill parameters and machine settings

**⚠️ IREDES X/Y Swap Warning**:
IREDES XML uses **X for Northing, Y for Easting** (opposite of standard convention). Kirra automatically swaps these on import/export. Always verify coordinate order when working with IREDES files.

### CBLAST CSV (Orica)

**Extension**: `.csv`  
**Description**: Orica CBLAST format with 4 records per hole

**Record Types**:
1. **HOLE** - Hole geometry and properties
2. **PRODUCT** - Explosive products loaded
3. **DETONATOR** - Initiation system details
4. **STRATA** - Geological strata information

**Import**: Parses multi-record structure and consolidates into Kirra hole objects.  
**Export**: Expands hole data into 4-record format for CBLAST import.

### ShotPlus SPF (Orica)

**Extension**: `.spf`  
**Description**: Orica ShotPlus file format (ZIP archive with XML)

**Import Only**: Extracts blast hole data from SPF ZIP structure.

### MineStar AQM (Caterpillar)

**Extension**: `.csv`  
**Description**: Cat MineStar Activity Queue Manager format

**Dynamic Column Ordering**: User specifies column order in export dialog. Supports all standard blast hole fields.

### Surface Manager (Epiroc)

**Extensions**: `.geofence`, `.hazard`, `.sockets`, `.txt`  
**Description**: Epiroc Surface Manager coordinate files

**Format**: Y,X coordinate pairs (Northing, Easting)
**Use Case**: Geofence boundaries, hazard zones, socket locations

### Wenco NAV (Wenco)

**Extension**: `.nav`  
**Description**: Wenco NAV ASCII format for fleet management

**Entity Types**:
- `TEXT` - Text labels
- `POINT` - Point markers
- `LINE` - Line entities

---

## 3D Mesh Formats

### OBJ/MTL (Wavefront)

**Extension**: `.obj` (with optional `.mtl` for materials)

**Import Features**:
- Vertices, faces, UVs, normals
- Material properties (Ka, Kd, Ks, Ns, illum)
- Texture mapping (diffuse, specular, bump maps)
- Texture blobs stored in IndexedDB for persistence

**Export Features**:
- Vertices, faces, normals, UVs
- Material definitions
- Texture references

**Texture Persistence**: When importing textured OBJ files, Kirra stores:
- OBJ file content as string
- MTL file content as string
- Texture image blobs (JPEG/PNG)
- Material properties object
- Reconstructs textured mesh on page reload from IndexedDB

### PLY (Polygon File Format)

**Extension**: `.ply`

**Import Features**:
- ASCII and Binary formats
- Vertices, faces, normals, colors
- Per-vertex RGB colors

**Use Case**: Point cloud visualization, mesh import from 3D scanners.

---

## Point Cloud Formats

### XYZ Format

**Extensions**: `.xyz`, `.txt`

**Format**: Space-separated or comma-separated
```
X Y Z
X Y Z R G B
```

**Optional RGB**: Color values (0-255) or normalized (0.0-1.0)

### PTS Format

**Extension**: `.pts`

**Format**: Count header + space-separated data
```
5
X Y Z I R G B
X Y Z I R G B
...
```

**Fields**: X, Y, Z, Intensity, Red, Green, Blue

### PTX Format (Leica)

**Extension**: `.ptx`

**Description**: Leica scanner format with single scan metadata
**Use Case**: Import raw scanner data

### CSV Point Cloud

**Extension**: `.csv`

**Format**: Comma-separated with optional header
```
X,Y,Z
X,Y,Z,R,G,B
```

### LAS/LAZ (LiDAR)

**Extensions**: `.las`, `.laz`

**Description**: ASPRS LAS LiDAR format (versions 1.2, 1.3, 1.4)
**Features**: Point classification, intensity, RGB, GPS time, waveform data

---

## GIS/Image Formats

### GeoTIFF

**Extensions**: `.tif`, `.tiff`

**Import**: 
- Elevation rasters (single-band)
- RGB/RGBA imagery (multi-band)
- Geotransform metadata for coordinate mapping

**Export**:
- **Imagery**: PNG + world file (.pgw)
- **Elevation**: XYZ point cloud

### KML/KMZ (Google Earth)

**Extensions**: `.kml`, `.kmz`

**Import/Export**:
- Blast holes as Placemarks with ExtendedData
- Polylines, polygons, points
- 3D geometry with altitude mode

**Use Case**: Visualize blast patterns in Google Earth.

### Shapefile (ESRI)

**Extension**: `.shp` (with .shx, .dbf, .prj)

**Import**: Point, PolyLine, Polygon with Z variants
**Export**: ZIP archive with all shapefile components

---

## File System Access API

Kirra uses the modern **File System Access API** (`window.showSaveFilePicker`) for file exports, with fallback to traditional blob download for unsupported browsers.

**Advantages**:
- User selects save location and filename
- No automatic download folder clutter
- Overwrite confirmation handled by browser

**Fallback**: If File System Access API is unavailable, Kirra falls back to `<a download>` blob URL method.

---

*For coordinate system conventions, see [Coordinate System](Coordinate-System).*  
*For blast hole field definitions, see [Blast Hole Management](Blast-Hole-Management).*
