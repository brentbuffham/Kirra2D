# FileManager Implementation Status
**Last Updated:** 2026-01-08
**Status:** Phase 2 - Core formats complete, advanced formats pending

---

## Overview

The FileManager system provides a unified API for importing/exporting mining data formats. It uses a parser/writer architecture with automatic format detection and registration.

**Architecture:**
- `FileManager.js` - Central registry and coordination
- `BaseParser.js` / `BaseWriter.js` - Base classes with common utilities
- Format-specific parsers/writers in subdirectories
- `init.js` - Auto-registration of all formats

---

## Implementation Status by Category

### ✅ COMPLETE - Blasting Formats (100%)

| Format | Parser | Writer | Status | Notes |
|--------|--------|--------|--------|-------|
| **Blast Hole CSV** | ✅ | ✅ | Complete | 4/7/9/12/14/20/25/30/32/35 column support |
| **Custom CSV** | ✅ | ✅ | Complete | User-defined column mapping, smart row detection |
| **CBLAST CSV** | ✅ | ✅ | Complete | 4 records per hole (HOLE/PRODUCT/DETONATOR/STRATA) |
| **MineStar AQM** | ❌ | ✅ | Complete | Dynamic column ordering, checkbox enable/disable |
| **Epiroc IREDES XML** | ✅ | ✅ | Complete | Drill plan import/export with checksums |

**Files:**
- `TextIO/BlastHoleCSVParser.js` + `BlastHoleCSVWriter.js`
- `TextIO/CustomBlastHoleTextParser.js` + `CustomBlastHoleTextWriter.js`
- `CBlastIO/CBLASTParser.js` + `CBLASTWriter.js`
- `MinestarIO/AQMWriter.js`
- `EpirocIO/IREDESParser.js` + `IREDESWriter.js`

---

### ✅ COMPLETE - CAD Formats (100%)

| Format | Parser | Writer | Status | Notes |
|--------|--------|--------|--------|-------|
| **Kirra KAD** | ✅ | ✅ | Complete | Point/Line/Poly/Circle/Text entities |
| **AutoCAD DXF** | ✅ | ✅ | Complete | POINT/LINE/POLYLINE/CIRCLE/ELLIPSE/TEXT/3DFACE |
| **DXF Vulcan** | ❌ | ✅ | Complete | 3D POLYLINE with Vulcan XData tags |
| **DXF 3DFACE** | ❌ | ✅ | Complete | Surface triangles export |

**Files:**
- `KirraIO/KADParser.js` + `KADWriter.js`
- `AutoCadIO/DXFParser.js`
- `AutoCadIO/DXFHOLESWriter.js` (compact 2-layer)
- `AutoCadIO/DXFVulcanWriter.js`
- `AutoCadIO/DXF3DFACEWriter.js`

---

### ✅ COMPLETE - Mining Software Formats (100%)

| Format | Parser | Writer | Status | Notes |
|--------|--------|--------|--------|-------|
| **Surpac STR (ASCII)** | ✅ | ✅ | Complete | String files - blast holes and KAD |
| **Surpac STR (Binary)** | ✅ | ❌ | Parse-only | Binary vertex data |
| **Surpac DTM (ASCII)** | ✅ | ✅ | Complete | Point cloud terrain |
| **Surpac DTM (Binary)** | ✅ | ❌ | Parse-only | Binary point cloud |
| **Surpac Surface** | ✅ | ❌ | Parse-only | DTM + STR pair (triangulated surface) |
| **Wenco NAV ASCII** | ✅ | ✅ | Complete | TEXT/POINT/LINE entities, KAD + surfaces |
| **Epiroc Surface Manager** | ✅ | ✅ | Complete | Geofence/hazard/sockets (Y,X format) |

**Files:**
- `SurpacIO/SurpacSTRParser.js` + `SurpacSTRWriter.js`
- `SurpacIO/SurpacBinarySTRParser.js`
- `SurpacIO/SurpacDTMParser.js` + `SurpacDTMWriter.js`
- `SurpacIO/SurpacBinaryDTMParser.js`
- `SurpacIO/SurpacSurfaceParser.js`
- `WencoIO/NAVAsciiParser.js` + `NAVAsciiWriter.js`
- `EpirocIO/SurfaceManagerParser.js` + `SurfaceManagerWriter.js`

---

### ✅ COMPLETE - 3D Mesh Formats (66%)

| Format | Parser | Writer | Status | Notes |
|--------|--------|--------|--------|-------|
| **Wavefront OBJ** | ✅ | ✅ | Complete | Vertices/faces/normals/UVs/materials |
| **PLY** | ✅ | ❌ | Parse-only | ASCII and binary formats |
| **GLTF/GLB** | 🟡 | 🟡 | Placeholder | Needs three.js GLTFLoader integration |

**Files:**
- `ThreeJSMeshIO/OBJParser.js` + `OBJWriter.js`
- `ThreeJSMeshIO/PLYParser.js`
- `ThreeJSMeshIO/GLTFParser.js` (placeholder)
- `ThreeJSMeshIO/GLTFWriter.js` (placeholder)

---

### ✅ COMPLETE - Point Cloud Formats (50%)

| Format | Parser | Writer | Status | Notes |
|--------|--------|--------|--------|-------|
| **XYZ CSV** | ✅ | ✅ | Complete | X,Y,Z or X,Y,Z,R,G,B format |
| **LAS/LAZ** | 🟡 | 🟡 | Placeholder | Needs LAS library integration |

**Files:**
- `PointCloudIO/PointCloudParser.js` + `PointCloudWriter.js`
- `LasFileIO/LASParser.js` (placeholder - 1 line)
- `LasFileIO/LASWriter.js` (placeholder - 1 line)

---

### 🟡 PENDING - GIS Formats (0%)

| Format | Parser | Writer | Status | Notes |
|--------|--------|--------|--------|-------|
| **KML (Holes)** | 🔴 | 🔴 | Not Started | Blast holes as LineString |
| **KML (KAD)** | 🔴 | 🔴 | Not Started | Points/Lines/Polygons |
| **KMZ (Holes)** | 🔴 | 🔴 | Not Started | Zipped KML for holes |
| **KMZ (KAD)** | 🔴 | 🔴 | Not Started | Zipped KML for KAD |
| **ESRI Shapefile** | 🔴 | 🔴 | Not Started | .shp/.shx/.dbf support |

**Files:**
- `GoogleMapsIO/KMLKMZParser.js` (stub with pseudocode)
- `GoogleMapsIO/KMLKMZWriter.js` (stub with pseudocode)
- `EsriIO/SHPFileParser.js` (placeholder - 1 line)
- `EsriIO/SHPFileWriter.js` (placeholder - 1 line)

**Technical Notes:**
- KML/KMZ: Use `togeojson` and `tokml` libraries + `JSZip` for compression
- Shapefile: Use `shapefile` library, requires .shp/.shx/.dbf handling

---

### 🟡 PENDING - Raster Formats (0%)

| Format | Parser | Writer | Status | Notes |
|--------|--------|--------|--------|-------|
| **GeoTIFF** | 🔴 | 🔴 | Not Started | Georeferenced raster images |
| **Elevation GeoTIFF** | 🔴 | 🔴 | Not Started | DEM/DTM as TIFF |
| **Image GeoTIFF** | 🔴 | 🔴 | Not Started | Aerial/satellite imagery |

**Files:**
- `ImageIO/IMGParser.js` (placeholder - 1 line)
- `ImageIO/IMGWriter.js` (placeholder - 1 line)

**Technical Notes:**
- Use `geotiff.js` library for reading/writing
- Support projection systems (GDA94, GDA2020, custom Proj4/WKT)
- Handle large raster data efficiently (tiling, streaming)

---

## Not Started - Implementation Required

### 1. KML/KMZ Export (Blast Holes)
**Priority:** High
**Complexity:** Medium
**Dependencies:** `togeojson`, `tokml`, `JSZip`

**Requirements:**
- Convert BlastHole objects to GeoJSON LineString features
- Properties: holeID, entityName, diameter, angle, bearing, length
- Style: Color from `colorHexDecimal`, line width from diameter
- Support coordinate system transformation (GDA94/GDA2020)
- KMZ: Zip KML with `JSZip`

**Implementation Plan:**
```javascript
// 1. Convert holes to GeoJSON
const features = holes.map(hole => ({
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [hole.startXLocation, hole.startYLocation, hole.startZLocation],
      [hole.endXLocation, hole.endYLocation, hole.endZLocation]
    ]
  },
  properties: {
    name: hole.holeID,
    blast: hole.entityName,
    diameter: hole.holeDiameter,
    // ... other properties
  }
}));

// 2. Convert to KML using tokml
const kml = tokml(geojson);

// 3. For KMZ: zip with JSZip
const zip = new JSZip();
zip.file('doc.kml', kml);
const kmz = await zip.generateAsync({type: 'blob'});
```

---

### 2. KML/KMZ Import (Blast Holes)
**Priority:** High
**Complexity:** Medium
**Dependencies:** `togeojson`, `JSZip`, `DOMParser`

**Requirements:**
- Parse KML/KMZ files containing LineString geometries
- Extract hole properties from feature attributes
- Handle KMZ unzipping automatically
- Map GeoJSON features back to BlastHole objects

**Implementation Plan:**
```javascript
// 1. For KMZ: unzip first
if (isKMZ) {
  const zip = await JSZip.loadAsync(file);
  kmlString = await zip.file('doc.kml').async('string');
}

// 2. Parse KML to GeoJSON
const xml = new DOMParser().parseFromString(kmlString, 'text/xml');
const geojson = toGeoJSON.kml(xml);

// 3. Convert GeoJSON features to BlastHole objects
const holes = geojson.features
  .filter(f => f.geometry.type === 'LineString')
  .map(f => new BlastHole({
    holeID: f.properties.name,
    entityName: f.properties.blast,
    startXLocation: f.geometry.coordinates[0][0],
    startYLocation: f.geometry.coordinates[0][1],
    startZLocation: f.geometry.coordinates[0][2],
    // ...
  }));
```

---

### 3. KML/KMZ (KAD Objects)
**Priority:** Medium
**Complexity:** Medium
**Dependencies:** Same as above

**Requirements:**
- Export/import KAD entities (points, lines, polylines, circles, text)
- Map geometry types: Point → Point, Line → LineString, Poly → Polygon
- Circles: Export as approximate polygons (20-30 segments)
- Text: Use KML Placemark with name/description
- Preserve colors and styling

---

### 4. ESRI Shapefile Support
**Priority:** Medium
**Complexity:** High
**Dependencies:** `shapefile` library (or shpjs)

**Requirements:**
- Parse .shp (geometry), .shx (index), .dbf (attributes) files
- Write .shp/.shx/.dbf file sets
- Support point, line, and polygon geometries
- Map attributes to hole/KAD properties
- Handle coordinate system (require .prj file or user input)

**Technical Challenges:**
- Binary format parsing
- Multi-file coordination (.shp + .shx + .dbf)
- Large file handling
- Projection system conversion

---

### 5. GeoTIFF Support
**Priority:** Low
**Complexity:** High
**Dependencies:** `geotiff.js`, `proj4`

**Requirements:**
- **GeoTIFF Parser:** Load georeferenced raster images
  - Extract elevation data (DEM/DTM)
  - Extract RGB imagery (aerial photos)
  - Read georeferencing metadata (origin, pixel size, projection)
- **GeoTIFF Writer:** Export surfaces/imagery as GeoTIFF
  - Elevation export: Convert surface triangles to elevation grid
  - Image export: Render canvas view to georeferenced TIFF
  - Support GDA94, GDA2020, custom projections

**Technical Challenges:**
- Large raster data handling (tiling/streaming)
- Projection transformations
- Compression support (LZW, JPEG, etc.)
- Memory efficiency for elevation grids

---

### 6. LAS/LAZ Point Cloud Support
**Priority:** Low
**Complexity:** High
**Dependencies:** `laz-perf` or `copc.js`

**Requirements:**
- Parse LAS 1.2/1.4 files (point records, classification, RGB)
- Parse LAZ compressed files
- Write LAS files from point clouds
- Support massive point clouds (millions of points)
- Optional: COPC (Cloud Optimized Point Cloud)

**Technical Challenges:**
- LAZ decompression
- Large file streaming
- Point classification handling
- Memory management

---

### 7. GLTF/GLB Support
**Priority:** Low
**Complexity:** Medium
**Dependencies:** `three.js` GLTFLoader/GLTFExporter

**Requirements:**
- Parse GLTF/GLB using three.js loader
- Export 3D meshes as GLTF/GLB
- Preserve materials, textures, animations
- Support embedded textures (GLB)

---

## Registered Formats Summary

### Currently Registered in `init.js` (24 formats)

**Parsers (18):**
1. blasthole-csv
2. custom-csv
3. kad
4. dxf
5. obj
6. ply
7. pointcloud-csv
8. surpac-str
9. surpac-dtm
10. surpac-surface
11. iredes-xml
12. cblast-csv
13. wenco-nav
14. surface-manager
15. surpac-binary-str (not registered yet)
16. surpac-binary-dtm (not registered yet)
17. shpfile (stub)
18. kmlkmz (stub)

**Writers (19):**
1. blasthole-csv-12
2. blasthole-csv-14
3. blasthole-csv-35
4. blasthole-csv-actual
5. blasthole-csv-allcolumns
6. custom-csv
7. kad
8. dxf-holes
9. dxf-vulcan
10. dxf-3dface
11. obj
12. pointcloud-xyz
13. aqm-csv
14. surpac-str
15. surpac-dtm
16. iredes-xml
17. cblast-csv
18. wenco-nav
19. surface-manager

---

## Priority Roadmap

### Phase 1: ✅ COMPLETE
- Core blast hole formats (CSV, AQM, IREDES, CBLAST)
- CAD formats (KAD, DXF)
- Mining software (Surpac, Wenco, Epiroc)
- Basic 3D mesh (OBJ, PLY)
- Point clouds (XYZ)

### Phase 2: 🟡 IN PROGRESS
- KML/KMZ blast holes (high priority)
- KML/KMZ KAD objects (medium priority)

### Phase 3: 🔴 NOT STARTED
- ESRI Shapefile (medium priority)
- GeoTIFF raster (low priority)
- LAS/LAZ point clouds (low priority)
- GLTF/GLB mesh (low priority)

---

## Technical Architecture Notes

### FileManager Design Pattern
```javascript
// Registration
fileManager.registerParser(formatId, ParserClass, metadata);
fileManager.registerWriter(writerId, WriterClass, metadata);

// Usage
const parser = fileManager.getParser(formatId);
const result = await parser.parse(content);

const writer = fileManager.getWriter(writerId);
const blob = await writer.write(data);
```

### Base Classes
- **BaseParser:** Common utilities (line parsing, visibility filtering, validation)
- **BaseWriter:** Common utilities (blob creation, visibility filtering, file saving)

### Metadata Schema
```javascript
{
  extensions: ["csv", "txt"],
  description: "Format description",
  category: "blasting" | "cad" | "3d-mesh" | "point-cloud" | "mining" | "gis"
}
```

---

## Dependencies Required

### Already Installed
- `jszip` - KMZ compression (already in package.json)
- `proj4` - Coordinate transformations (check if installed)

### Need to Install
- `@mapbox/togeojson` - KML to GeoJSON conversion
- `tokml` - GeoJSON to KML conversion
- `shapefile` or `shpjs` - Shapefile support
- `geotiff` - GeoTIFF support
- `laz-perf` or `copc.js` - LAS/LAZ support

---

## Summary Statistics

- **Total Formats:** 31 (planned)
- **Fully Complete:** 22 (71%)
- **Partially Complete:** 3 (10%)
- **Not Started:** 6 (19%)
- **Parser Coverage:** 18/31 (58%)
- **Writer Coverage:** 19/31 (61%)

**Estimated Work Remaining:**
- KML/KMZ (Holes): 2-3 days
- KML/KMZ (KAD): 2-3 days
- Shapefile: 5-7 days
- GeoTIFF: 5-7 days
- LAS/LAZ: 7-10 days
- GLTF: 3-4 days

**Total:** ~4-5 weeks for all remaining formats
