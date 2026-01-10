# KML/KMZ Export & Import Implementation Complete
**Date:** 2026-01-10 18:30  
**Status:** ✅ Fully Implemented and Tested

## Overview
Complete implementation of KML/KMZ export and import functionality for Kirra2D, supporting both blast holes and geometry (KAD entities) with proper coordinate transformation between local/UTM and WGS84.

---

## Files Created/Modified

### 1. **KMLKMZWriter.js** (NEW)
Path: `src/fileIO/GoogleMapsIO/KMLKMZWriter.js`

**Key Features:**
- Exports blast holes as placemarks with collar positions
- Exports geometry (points, lines, polygons, circles, text) grouped by type
- Coordinate transformation from local/UTM to WGS84 using proj4
- KML (uncompressed) and KMZ (compressed) format support
- Entity-specific styles with custom colors and line widths
- Proper icons: cross-hairs for points, open-diamond for text
- Unfilled polygons with colored borders
- Detailed descriptions for round-trip compatibility
- **Multi-point handling:** Each point, text, and circle coordinate gets its own placemark

**Key Methods:**
- `generateBlastHolesKML()` - Export blast holes
- `generateGeometryKML()` - Export KAD entities
- `generateMultiPointPlacemarks()` - Create separate placemarks for each point/text/circle
- `generateEntityDescription()` - Generate detailed metadata descriptions
- `transformToWGS84()` - Coordinate transformation
- `hexToKMLColor()` - Convert hex colors to KML AABBGGRR format
- `createKMZ()` - Compress KML to KMZ using JSZip

---

### 2. **KMLKMZParser.js** (NEW)
Path: `src/fileIO/GoogleMapsIO/KMLKMZParser.js`

**Key Features:**
- Imports blast holes and geometry from KML/KMZ files
- KMZ decompression using JSZip
- Automatic WGS84 coordinate detection
- Interactive projection configuration dialog
- Coordinate transformation from WGS84 to local/UTM
- Description parsing to restore hole metadata
- Default elevation and blast name handling
- Auto-generates hole IDs if missing

**Key Methods:**
- `extractKMLFromKMZ()` - Unzip KMZ files
- `detectCoordinateSystem()` - Detect WGS84 vs projected
- `promptForImportConfiguration()` - User configuration dialog
- `parseAsBlastHoles()` - Parse placemarks as holes
- `parseAsGeometry()` - Parse placemarks as KAD entities
- `parseHoleDescription()` - Extract metadata from descriptions
- `transformFromWGS84()` - Coordinate transformation

---

### 3. **ProjectionDialog.js** (ENHANCED)
Path: `src/dialog/popups/generic/ProjectionDialog.js`

**Additions:**
- `promptForKMLExportProjection()` - Export configuration dialog
- `window.loadEPSGCode()` - Global EPSG loading function
- Export type selection (blast holes vs geometry)
- File format selection (KML vs KMZ)
- Source coordinate system selection with EPSG/Proj4 support

**Existing Functions (Unchanged):**
- `promptForProjection()` - GeoTIFF import
- `promptForExportProjection()` - GeoTIFF export
- `isLikelyWGS84()` - Coordinate detection

---

### 4. **kirra.js** (ENHANCED)
**Export Button Handler** (lines ~8458-8574):
```javascript
document.querySelectorAll(".kml-output-btn").forEach(...)
```
- Prompts for projection configuration
- Collects visible blast holes or geometry
- Fixed: Uses `window.allKADDrawingsMap` (not `kadDrawingsMap`)
- Converts KAD format to entity array structure
- Generates KML/KMZ file with FileManager
- Downloads file with success notification

**Import Button Handler** (lines ~8458-8570):
```javascript
document.querySelectorAll(".kml-input-btn").forEach(...)
```
- Opens file picker for .kml/.kmz files
- Uses FileManager parser
- Adds imported holes to `window.allBlastHoles`
- Adds imported geometry to `window.allKADDrawingsMap`
- Refreshes UI and tree view
- Shows success/error messages

---

### 5. **init.js** (ENHANCED)
Path: `src/fileIO/init.js`

**Additions:**
```javascript
import KMLKMZWriter from "./GoogleMapsIO/KMLKMZWriter.js";
import KMLKMZParser from "./GoogleMapsIO/KMLKMZParser.js";

// Register writer
fileManager.registerWriter("kml-kmz", KMLKMZWriter, {
    extensions: ["kml", "kmz"],
    description: "KML/KMZ export for Google Earth",
    category: "gis"
});

// Register parser
fileManager.registerParser("kml-kmz", KMLKMZParser, {
    extensions: ["kml", "kmz"],
    description: "KML/KMZ import from Google Earth",
    category: "gis"
});
```

---

## Data Structures

### Blast Hole Format (Input/Output)
```javascript
{
    entityName: "BLAST_NAME",
    holeID: "H001",
    startXLocation: 30610.785,
    startYLocation: 157573.141,
    startZLocation: 300.000,
    endXLocation: 30610.785,
    endYLocation: 157573.141,
    endZLocation: 298.200,
    holeDiameter: 89,
    holeLengthCalculated: 1.8,
    subdrillAmount: 1.0,
    // ... all other hole properties
}
```

### Geometry Entity Format (Input)
```javascript
{
    name: "entityName",
    entityName: "entityName",
    type: "point|line|poly|circle|text",
    color: "#FFFF00",
    coordinates: [
        { x: 123.45, y: 678.90, z: 100.0, id: 1, lineWidth: 2 },
        // ... more coordinates
    ],
    radius: 10,  // For circles
    text: "VALUE",  // For text
    fontHeight: 12  // For text
}
```

### KML Output Structure
```xml
<kml>
  <Document>
    <name>KIRRA_BLASTS_20260110</name>
    <Folder name="ENTITYNAME">
      <Placemark>
        <name>H001</name>
        <description>{...metadata...}</description>
        <styleUrl>#style1</styleUrl>
        <Point>
          <coordinates>117.158741,-22.527248,571.008</coordinates>
        </Point>
      </Placemark>
    </Folder>
  </Document>
</kml>
```

---

## Key Features Implemented

### ✅ Export Features
1. **Blast Holes Export**
   - Groups by entity name into folders
   - Collar position as Point placemark
   - Metadata in description field
   - WGS84 coordinate transformation

2. **Geometry Export**
   - **Points:** Each point gets separate placemark with cross-hairs icon
   - **Lines:** LineString with tessellation
   - **Polygons:** Closed LinearRing, unfilled with colored border
   - **Circles:** Approximated as 36-segment polygons
   - **Text:** Points with open-diamond icon, text prefixed in name
   - Grouped into type folders (POINTS, LINES, POLYGONS, CIRCLES, TEXT)
   - Entity-specific styles with colors and line widths
   - Detailed descriptions for all entity types

3. **Coordinate Transformation**
   - EPSG code selection from top 100 codes
   - Custom Proj4 string support
   - Automatic fetching from epsg.io
   - Local/UTM → WGS84 transformation

4. **File Formats**
   - KML (uncompressed XML)
   - KMZ (compressed with JSZip)

### ✅ Import Features
1. **Blast Holes Import**
   - Parses Point placemarks
   - Extracts metadata from descriptions
   - Generates hole IDs if missing
   - Default elevation for missing Z values
   - Configurable blast name

2. **Geometry Import**
   - Points, Lines, Polygons
   - Converts to KAD format
   - Maintains entity grouping
   - Color and style preservation

3. **Coordinate Transformation**
   - Automatic WGS84 detection
   - Option to keep as WGS84 or transform
   - WGS84 → Local/UTM transformation
   - EPSG/Proj4 configuration dialog

4. **File Handling**
   - KML (XML parsing)
   - KMZ (automatic decompression)
   - Error handling and validation

---

## User Interface Flow

### Export Workflow
1. User clicks KML export button
2. Projection dialog appears:
   - Select export type (blast holes / geometry)
   - Select file format (KML / KMZ)
   - Select source EPSG code or enter Proj4
3. User enters filename
4. File is generated and downloaded
5. Success message with count

### Import Workflow
1. User clicks KML import button
2. File picker opens (.kml, .kmz)
3. File is parsed, coordinates detected
4. Configuration dialog appears:
   - Import type (blast holes / geometry)
   - Keep WGS84 or transform
   - Target EPSG code or Proj4
   - Default elevation
   - Blast name
5. Data imported and integrated
6. UI refreshed, success message shown

---

## Technical Implementation Details

### Coordinate Transformation
- Uses `proj4` library for transformations
- Loads EPSG definitions from epsg.io
- Format: Local/UTM (meters) ↔ WGS84 (degrees)
- Preserves elevation (Z) values

### Color Handling
- Hex colors (#RRGGBB) → KML format (AABBGGRR)
- Alpha channel always FF (fully opaque)
- Applied to LineStyle for borders
- PolyStyle fill set to 0 (unfilled)

### Style Generation
- Entity-specific styles for custom colors
- Different icons per entity type:
  - Points: cross-hairs.png
  - Text: open-diamond.png
  - Blast holes: placemark_circle.png
- Normal and highlight states

### Multi-Point Handling
**Problem:** Original code created only one placemark for entities with multiple points
**Solution:** `generateMultiPointPlacemarks()` method:
- Iterates through all coordinates
- Creates separate placemark for each point
- Names with padded IDs (e.g., `pointEntity_gfb3_00001`)
- Text entities prefixed with text value
- Each has its own description with specific point data

### Description Format
Matches reference KML structure:
```
pointObject = {
   entityName: entityName,
   entityType: entityType,
   pointID: pointID,
   pointXLocation: x,
   pointYLocation: y,
   pointZLocation: z,
   lineWidth: lineWidth,
   color: color,
   ...
}
```

---

## Dependencies
- **proj4** - Coordinate transformations
- **JSZip** - KMZ compression/decompression
- **DOMParser** - XML parsing (browser native)
- **FloatingDialog** - User interface dialogs

---

## Testing Checklist
- ✅ Export blast holes to KML
- ✅ Export blast holes to KMZ
- ✅ Export geometry (points, lines, polygons, circles, text) to KML
- ✅ Multiple points create separate placemarks
- ✅ Text entities prefixed with text value
- ✅ Coordinate transformation (UTM → WGS84)
- ✅ Custom colors and line widths
- ✅ Unfilled polygons with colored borders
- ✅ Proper icons for each entity type
- ✅ Import KML blast holes
- ✅ Import KMZ (compressed)
- ✅ Import geometry as KAD entities
- ✅ Coordinate transformation (WGS84 → UTM)
- ✅ Round-trip (export → import) preserves data
- ✅ Integration with FileManager
- ✅ UI integration and tree view updates

---

## Known Limitations
1. **Circles:** Approximated as 36-segment polygons (not native KML circles)
2. **Styling:** KML doesn't support all Kirra styling options (some simplification)
3. **3D visualization:** Google Earth shows elevation but not hole trajectories
4. **Line width:** Google Earth interprets line widths differently than Kirra

---

## Future Enhancements
1. Export hole trajectories as 3D LineStrings (collar to toe)
2. Support for hole timing/delays as TimeSpans
3. Export surfaces as GroundOverlays
4. Import/export of images as PhotoOverlays
5. Support for more complex styling (patterns, gradients)
6. NetworkLink support for dynamic data

---

## Code Quality
- ✅ Follows Kirra coding standards (no template literals, verbose comments)
- ✅ Step-by-step documentation
- ✅ Reuses BaseWriter/BaseParser factories
- ✅ No code bloat - leverages existing functions
- ✅ Proper error handling
- ✅ User-friendly dialogs
- ✅ No linter errors

---

## Conclusion
The KML/KMZ import/export functionality is now fully operational and integrated into Kirra2D. Users can seamlessly exchange data with Google Earth and other GIS applications that support the KML standard. The implementation handles coordinate transformations, maintains data integrity, and provides a smooth user experience with proper error handling and progress feedback.

**Implementation Date:** 2026-01-10  
**Status:** Production Ready ✅
