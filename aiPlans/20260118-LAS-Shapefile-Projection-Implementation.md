# LAS and Shapefile Import/Export with Projection Support

## Current Status
- LAS and Shapefile parsers/writers are registered in FileManager but UI buttons show "Coming Soon"
- KML import/export has comprehensive projection handling via ProjectionDialog
- Need to implement similar functionality for LAS and Shapefile formats

## Coordinate System Considerations

### LAS Files
- **Common Coordinate Systems**: WGS84 (lat/lon), UTM zones, local mining grids
- **Header Information**: LAS header contains bounding box and coordinate system info (VLR records)
- **Import Challenges**: Need to detect coordinate system, offer transformation to local/projected coords
- **Export Requirements**: Allow user to specify target coordinate system, scale factors, offsets

### Shapefiles
- **Coordinate Systems**: Any projection possible (.prj file contains definition)
- **File Structure**: .shp (geometry), .shx (index), .dbf (attributes), .prj (projection)
- **Import Requirements**: Read .prj file, detect coordinate system, offer transformation
- **Export Requirements**: Generate all 4+ files, allow user to specify target CRS

## Implementation Plan

### 1. LAS Import Dialog (`promptForLASImportProjection`)
- Similar to KML import dialog but adapted for LAS format
- **Detection**: Sample coordinates from LAS header to detect WGS84 vs projected
- **Options**:
  - Keep original coordinates (if already projected)
  - Transform from WGS84 to projected system
  - EPSG code selection or custom Proj4
  - Master RL offset
  - Default elevation for missing Z values
- **Integration**: Add to LASParser.js

### 2. LAS Export Dialog (`promptForLASExportProjection`)
- Similar to GeoTIFF export dialog but for point cloud data
- **Options**:
  - Required EPSG code for coordinate system
  - Point format (0, 1, 2, 3, 6, 7, 8)
  - Version (1.2, 1.3, 1.4)
  - Scale factors and offsets
- **Integration**: Add to LASWriter.js

### 3. Shapefile Import Dialog (`promptForShapefileImportProjection`)
- Similar to KML import dialog but for vector data
- **Detection**: Parse .prj file to determine coordinate system
- **Options**:
  - Keep original coordinates
  - Transform to different projection
  - EPSG selection or custom Proj4
  - Master RL offset
  - Entity type mapping (Point → KAD points, Polyline → KAD lines, etc.)
- **Integration**: Add to SHPFileParser.js

### 4. Shapefile Export Dialog (`promptForShapefileExportProjection`)
- Similar to GeoTIFF export dialog
- **Options**:
  - Required EPSG code for coordinate system
  - Export type (Point, PolyLine, Polygon, with Z variants)
  - Use Z coordinates (yes/no)
  - Decimal precision
- **Integration**: Add to SHPFileWriter.js

### 5. UI Wiring in kirra.js
Replace "Coming Soon" handlers with actual import/export logic:

```javascript
// LAS IMPORT - Replace Coming Soon
document.querySelectorAll(".las-input-btn").forEach(function (button) {
    button.addEventListener("click", async function () {
        // Create file input, use FileManager LAS parser with projection dialog
    });
});

// LAS EXPORT - Replace Coming Soon
document.querySelectorAll(".las-output-btn").forEach(function (button) {
    button.addEventListener("click", async function () {
        // Use projection dialog, then FileManager LAS writer
    });
});

// SHAPEFILE IMPORT - Replace Coming Soon
document.querySelectorAll(".shape-input-btn").forEach(function (button) {
    button.addEventListener("click", async function () {
        // Create file input, use FileManager SHP parser with projection dialog
    });
});

// SHAPEFILE EXPORT - Replace Coming Soon
document.querySelectorAll(".shape-output-btn").forEach(function (button) {
    button.addEventListener("click", async function () {
        // Use projection dialog, then FileManager SHP writer
    });
});
```

## Technical Implementation Details

### LAS Coordinate Detection
- Sample first few points from LAS file
- Use `isLikelyWGS84()` function from ProjectionDialog.js
- Check LAS header bounds for lat/lon vs projected coordinate ranges

### Shapefile Coordinate Detection
- Parse .prj file content using proj4 or custom parser
- Extract EPSG code or Proj4 definition
- Offer transformation if coordinates appear to be WGS84 or other geographic system

### Projection Integration
- Use existing `loadEPSGCode()` function from ProjectionDialog.js
- Leverage proj4 library for coordinate transformations
- Apply master RL offsets after projection transformation

### File Handling
- **LAS Import**: Single file (.las or .laz)
- **LAS Export**: Single file with configurable format/version
- **Shapefile Import**: Handle multiple files (.shp, .shx, .dbf, .prj optional)
- **Shapefile Export**: Generate ZIP with all required files

## Error Handling
- Validate EPSG codes before transformation
- Handle missing .prj files in shapefile imports
- Provide clear error messages for projection failures
- Allow users to cancel and retry with different settings

## Testing Scenarios
1. LAS file with WGS84 coordinates → transform to UTM
2. LAS file with local coordinates → keep as-is
3. Shapefile with UTM coordinates → transform to different zone
4. Shapefile without .prj file → prompt user for CRS
5. Export LAS with custom EPSG code
6. Export Shapefile with Z coordinates

## Files to Modify
- `src/kirra.js` - Replace Coming Soon handlers (lines ~10416-10428)
- `src/fileIO/LasFileIO/LASParser.js` - Add projection dialog integration
- `src/fileIO/LasFileIO/LASWriter.js` - Add projection dialog integration
- `src/fileIO/EsriIO/SHPFileParser.js` - Add projection dialog integration
- `src/fileIO/EsriIO/SHPFileWriter.js` - Add projection dialog integration
- `src/dialog/popups/generic/ProjectionDialog.js` - May need LAS/Shapefile specific dialogs

## Dependencies
- Existing: proj4, JSZip, FloatingDialog
- ProjectionDialog.js functions: `top100EPSGCodes`, `isLikelyWGS84`, `loadEPSGCode`
- FileManager integration already working