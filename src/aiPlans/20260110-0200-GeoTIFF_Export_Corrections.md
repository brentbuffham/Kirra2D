# GeoTIFF Export Corrections Plan

**Date:** 2026-01-10 02:00
**Status:** PLANNED
**Priority:** High
**Scope:** Fix CRS metadata and improve GeoTIFF export functionality

## Overview

Address issues with GeoTIFF export, particularly CRS (Coordinate Reference System) metadata, geotransform accuracy, and export workflow UX. Ensure exported GeoTIFFs open correctly in QGIS, ArcGIS, and other GIS software with proper georeferencing.

## Current State

### Existing Implementation
**Files:**
- `src/helpers/GeoTIFFExporter.js` - Main export orchestration
- `src/helpers/SurfaceRasterizer.js` - Surface-to-canvas rendering
- `src/dialog/popups/generic/ProjectionDialog.js` - CRS/resolution UI
- `src/io/writers/GeoTIFFImageryWriter.js` - RGB GeoTIFF generation
- `src/io/writers/GeoTIFFElevationWriter.js` - Elevation raster export

### Reported Issues
1. **CRS Problem** - User mentioned CRS issue (specifics unknown)
2. **Geotransform** - May not correctly handle UTM coordinates
3. **Resolution** - User confusion about DPI vs pixels-per-meter
4. **EPSG Codes** - Limited preset list, manual entry error-prone

## Investigation Required

### Issue 1: CRS Metadata
**Investigate:**
- What specific CRS problem was reported?
- Is EPSG code being written to TIFF tags correctly?
- Does geotiff.js support all required CRS metadata?

**Test Cases:**
- Export with EPSG:32756 (UTM Zone 56S - Australia)
- Export with EPSG:28356 (MGA Zone 56 - Australia)
- Export with EPSG:4326 (WGS84 Geographic)
- Open in QGIS and verify CRS auto-detection

### Issue 2: Geotransform Accuracy
**Investigate:**
- Are world coordinates correctly mapped to pixel coordinates?
- Is pixel size calculation correct for UTM units (meters)?
- Does rotation/skew handling work (should be zero for axis-aligned)?

**Geotransform Definition:**
```
[originX, pixelWidth, rotation1, originY, rotation2, -pixelHeight]
```

For UTM coordinates (478000, 6772000):
- `originX = 478000` (world X of top-left pixel center)
- `originY = 6772000` (world Y of top-left pixel center)
- `pixelWidth = worldWidth / imageWidth` (meters per pixel)
- `pixelHeight = worldHeight / imageHeight` (meters per pixel)

### Issue 3: Resolution Confusion
**Current Options:**
- Screen resolution (matches canvas)
- DPI (e.g., 300 DPI)
- Pixels-per-meter (e.g., 10 px/m)
- Full resolution (maximum detail)

**User Confusion:**
- DPI is printing concept, not meaningful for GIS rasters
- Should emphasize **ground sample distance (GSD)** - meters per pixel
- Example: 1 meter GSD = 1 pixel represents 1m x 1m on ground

## Implementation Plan

### Phase 1: CRS Metadata Fix (2-3 hours)

#### 1.1 Investigate Current CRS Handling
**File:** `src/io/writers/GeoTIFFImageryWriter.js`

**Review:**
- How is EPSG code passed to geotiff.js?
- What TIFF tags are being written?
- Does geotiff.js support GeoKeyDirectoryTag?

**Test:**
```javascript
// Write test GeoTIFF with known EPSG
const metadata = {
    GeographicTypeGeoKey: 4326, // WGS84
    ProjectedCSTypeGeoKey: 32756, // UTM 56S
    // ... other required keys
};
```

#### 1.2 Verify Geotransform Calculation
**File:** `src/helpers/GeoTIFFExporter.js`

**Current Code (verify this is correct):**
```javascript
function calculateGeotransform(bounds, imageWidth, imageHeight) {
    const { minX, maxX, minY, maxY } = bounds;

    // World coordinates of image corners
    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;

    // Pixel size in world units
    const pixelWidth = worldWidth / imageWidth;
    const pixelHeight = worldHeight / imageHeight;

    // Geotransform: [originX, pixelWidth, 0, originY, 0, -pixelHeight]
    // Origin is top-left corner in world coordinates
    return [
        minX,              // X of top-left pixel center
        pixelWidth,        // Pixel width in world units
        0,                 // Row rotation (0 for north-up)
        maxY,              // Y of top-left pixel center (NORTH UP!)
        0,                 // Column rotation (0 for north-up)
        -pixelHeight       // Pixel height (negative for north-up)
    ];
}
```

**Critical Check:**
- Is `originY = maxY` (top-left is NORTH for UTM)?
- Is pixel height negative?
- Are world coordinates in correct units (meters for UTM)?

#### 1.3 Add CRS Validation
**File:** `src/dialog/popups/generic/ProjectionDialog.js`

**Add:**
- Validate EPSG code format (4-6 digits)
- Look up EPSG description if possible
- Warn if uncommon EPSG code entered
- Suggest appropriate EPSG for detected coordinate range

**Example:**
```javascript
function validateEPSGCode(epsg) {
    if (!/^\d{4,6}$/.test(epsg)) {
        return { valid: false, error: "EPSG must be 4-6 digits" };
    }

    // Heuristic: Check coordinate range matches CRS type
    if (epsg >= 32600 && epsg <= 32760) {
        // UTM zones - expect coords in 100k-900k range
        if (minX < 100000 || maxX > 900000) {
            return {
                valid: true,
                warning: "Coordinate range unusual for UTM. Verify EPSG code."
            };
        }
    }

    return { valid: true };
}
```

### Phase 2: Resolution UX Improvements (2-3 hours)

#### 2.1 Redesign Resolution Selector
**File:** `src/dialog/popups/generic/ProjectionDialog.js`

**Change from DPI to Ground Sample Distance (GSD):**

**Old UI:**
```
Resolution:
○ Screen (current)
○ 150 DPI
○ 300 DPI
○ Pixels-per-meter: [____]
```

**New UI:**
```
Ground Sample Distance (meters per pixel):
○ Auto (match surface detail)      [~0.5m]
○ Fine (high detail)                [0.25m]
○ Medium (balanced)                 [1.0m]
○ Coarse (overview)                 [5.0m]
● Custom: [1.0] meters/pixel

Resulting image size: 512 x 384 pixels (197 KB)
```

**Benefits:**
- More intuitive for GIS users
- Directly relates to map scale
- Shows file size estimate

#### 2.2 Add Resolution Calculator
**File:** `src/helpers/GeoTIFFExporter.js`

**Add:**
```javascript
class ResolutionCalculator {
    static calculateGSD(bounds, targetPixels = 2048) {
        // Calculate GSD to produce target pixel count
        const { minX, maxX, minY, maxY } = bounds;
        const worldWidth = maxX - minX;
        const worldHeight = maxY - minY;
        const aspectRatio = worldWidth / worldHeight;

        // Determine dimensions maintaining aspect ratio
        let width, height;
        if (aspectRatio > 1) {
            width = targetPixels;
            height = Math.round(targetPixels / aspectRatio);
        } else {
            height = targetPixels;
            width = Math.round(targetPixels * aspectRatio);
        }

        const gsdX = worldWidth / width;
        const gsdY = worldHeight / height;
        return Math.max(gsdX, gsdY); // Return coarser GSD
    }

    static calculateDimensions(bounds, gsd) {
        const { minX, maxX, minY, maxY } = bounds;
        const worldWidth = maxX - minX;
        const worldHeight = maxY - minY;

        const width = Math.ceil(worldWidth / gsd);
        const height = Math.ceil(worldHeight / gsd);

        return { width, height };
    }

    static estimateFileSize(width, height, format = 'RGB') {
        const bytesPerPixel = format === 'RGB' ? 3 : (format === 'RGBA' ? 4 : 2);
        const uncompressed = width * height * bytesPerPixel;
        const compressed = uncompressed * 0.3; // Assume 30% compression
        return Math.round(compressed);
    }
}
```

#### 2.3 Add Live Preview
**File:** `src/dialog/popups/generic/ProjectionDialog.js`

**Add:**
- Show preview of output image dimensions
- Update in real-time as GSD changes
- Show estimated file size
- Warn if dimensions exceed 8192x8192 (common limit)

**Example:**
```javascript
function updatePreview() {
    const gsd = parseFloat(document.getElementById('gsd-input').value);
    const { width, height } = ResolutionCalculator.calculateDimensions(bounds, gsd);
    const fileSize = ResolutionCalculator.estimateFileSize(width, height, 'RGB');

    document.getElementById('dimensions-preview').textContent =
        `${width} x ${height} pixels`;
    document.getElementById('filesize-preview').textContent =
        `~${(fileSize / 1024 / 1024).toFixed(1)} MB`;

    if (width > 8192 || height > 8192) {
        showWarning("Image dimensions exceed 8192px. May fail in some software.");
    }
}
```

### Phase 3: EPSG Code Management (2 hours)

#### 3.1 Common EPSG Presets
**File:** `src/dialog/popups/generic/ProjectionDialog.js`

**Add Dropdown with Common Projections:**
```javascript
const commonEPSG = {
    // World Geographic
    4326: "WGS 84 (World Geographic)",
    3857: "Web Mercator (Google Maps)",

    // Australia (MGA 2020)
    7844: "GDA2020 (Australia Geographic)",
    7850: "MGA2020 Zone 50 (Perth)",
    7851: "MGA2020 Zone 51",
    7852: "MGA2020 Zone 52",
    7853: "MGA2020 Zone 53",
    7854: "MGA2020 Zone 54",
    7855: "MGA2020 Zone 55 (Melbourne)",
    7856: "MGA2020 Zone 56 (Sydney)",
    7857: "MGA2020 Zone 57",

    // Australia (MGA 1994 - legacy)
    28349: "MGA94 Zone 49",
    28350: "MGA94 Zone 50",
    28351: "MGA94 Zone 51",
    28352: "MGA94 Zone 52",
    28353: "MGA94 Zone 53",
    28354: "MGA94 Zone 54",
    28355: "MGA94 Zone 55",
    28356: "MGA94 Zone 56",
    28357: "MGA94 Zone 57",

    // North America (UTM NAD83)
    26910: "NAD83 UTM Zone 10N (California)",
    26911: "NAD83 UTM Zone 11N (Nevada)",
    26912: "NAD83 UTM Zone 12N (Utah)",
    26913: "NAD83 UTM Zone 13N (Colorado)",

    // Custom
    0: "Custom (enter EPSG code)"
};
```

#### 3.2 Auto-Detect EPSG from Coordinates
**File:** `src/helpers/EPSGDetector.js` (new file)

**Add:**
```javascript
class EPSGDetector {
    static detectFromCoordinates(minX, maxX, minY, maxY) {
        // Heuristic detection based on coordinate ranges

        // Geographic coordinates (-180 to 180, -90 to 90)
        if (Math.abs(minX) <= 180 && Math.abs(maxX) <= 180 &&
            Math.abs(minY) <= 90 && Math.abs(maxY) <= 90) {
            return { epsg: 4326, confidence: 'high', name: 'WGS 84' };
        }

        // UTM coordinates (100k-900k easting)
        if (minX >= 100000 && maxX <= 900000) {
            // Determine hemisphere from northing
            const isNorth = minY >= 1000000;

            // Estimate zone from easting (rough)
            const centralMeridian = Math.round((minX + maxX) / 2 / 1000000) * 6 - 183;
            const zone = Math.floor((centralMeridian + 180) / 6) + 1;

            // MGA2020 for Australia (zones 49-57, south)
            if (!isNorth && zone >= 49 && zone <= 57) {
                return {
                    epsg: 7849 + zone, // MGA2020 base = 7800
                    confidence: 'medium',
                    name: `MGA2020 Zone ${zone}`
                };
            }

            // Generic UTM
            const epsg = isNorth ? 32600 + zone : 32700 + zone;
            return {
                epsg,
                confidence: 'medium',
                name: `UTM Zone ${zone}${isNorth ? 'N' : 'S'}`
            };
        }

        return { epsg: null, confidence: 'none', name: 'Unknown' };
    }
}
```

**Use in Dialog:**
```javascript
const detected = EPSGDetector.detectFromCoordinates(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
if (detected.epsg && detected.confidence === 'high') {
    setDefaultEPSG(detected.epsg);
    showInfo(`Detected CRS: ${detected.name} (EPSG:${detected.epsg})`);
}
```

### Phase 4: Export Validation & Testing (2-3 hours)

#### 4.1 Add Export Validation
**File:** `src/helpers/GeoTIFFExporter.js`

**Validate Before Export:**
```javascript
function validateExportParameters(bounds, epsg, gsd) {
    const errors = [];
    const warnings = [];

    // Validate bounds
    if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
        errors.push("Invalid bounds: min >= max");
    }

    // Validate EPSG
    if (!epsg || epsg <= 0) {
        errors.push("Invalid EPSG code");
    }

    // Validate GSD
    if (gsd <= 0 || !isFinite(gsd)) {
        errors.push("Invalid ground sample distance");
    }

    // Calculate dimensions
    const { width, height } = ResolutionCalculator.calculateDimensions(bounds, gsd);

    // Warn if too large
    if (width > 8192 || height > 8192) {
        warnings.push(`Large image dimensions (${width}x${height}). Export may be slow.`);
    }

    // Warn if too small
    if (width < 100 || height < 100) {
        warnings.push(`Small image dimensions (${width}x${height}). Increase resolution?`);
    }

    return { valid: errors.length === 0, errors, warnings };
}
```

#### 4.2 Add QGIS Test Suite
**File:** `tests/geotiff-export-test.md` (manual test procedure)

**Test Cases:**
1. **Export RGB surface with MGA2020 Zone 56**
   - Load DTM surface
   - Apply "terrain" gradient
   - Export GeoTIFF with EPSG:7856, GSD=1.0m
   - Open in QGIS, verify CRS detected automatically
   - Verify coordinates match original surface

2. **Export elevation raster with UTM**
   - Load surface
   - Export elevation GeoTIFF with EPSG:32756, GSD=0.5m
   - Open in QGIS as DEM
   - Run "Identify" tool, verify elevation values match

3. **Export with geographic CRS**
   - Load surface
   - Export with EPSG:4326 (WGS84)
   - Verify coordinates in degrees (-180 to 180)

4. **Large export (>4096px)**
   - Load large surface
   - Export with GSD=0.25m (expect >4096px)
   - Verify no crashes, reasonable export time

#### 4.3 Add Export Report
**File:** `src/helpers/GeoTIFFExporter.js`

**Generate Report After Export:**
```javascript
function generateExportReport(params, result) {
    const report = {
        timestamp: new Date().toISOString(),
        filename: result.filename,
        crs: {
            epsg: params.epsg,
            name: params.crsName
        },
        bounds: {
            minX: params.bounds.minX,
            maxX: params.bounds.maxX,
            minY: params.bounds.minY,
            maxY: params.bounds.maxY,
            width: params.bounds.maxX - params.bounds.minX,
            height: params.bounds.maxY - params.bounds.minY
        },
        resolution: {
            gsd: params.gsd,
            width: result.imageWidth,
            height: result.imageHeight
        },
        geotransform: result.geotransform,
        fileSize: result.fileSize,
        exportTime: result.exportTime
    };

    // Save report as JSON
    const reportJSON = JSON.stringify(report, null, 2);
    const blob = new Blob([reportJSON], { type: 'application/json' });
    saveAs(blob, result.filename.replace('.tif', '_report.json'));

    console.log("GeoTIFF Export Report:", report);
}
```

## Testing Requirements

### Automated Tests
- ✅ Geotransform calculation for known bounds
- ✅ GSD to pixel dimensions conversion
- ✅ EPSG code validation
- ✅ File size estimation accuracy

### Manual QGIS Tests
- ✅ CRS auto-detection (EPSG:7856, EPSG:32756, EPSG:4326)
- ✅ Coordinate accuracy (identify tool matches source)
- ✅ Elevation values correct (DEM exports)
- ✅ Image appearance matches Kirra display

### Performance Tests
- ✅ Export 2048x2048 RGB < 5 seconds
- ✅ Export 4096x4096 RGB < 15 seconds
- ✅ Export 8192x8192 RGB < 60 seconds
- ✅ Memory usage < 500MB for typical exports

## Success Criteria

1. ✅ Exported GeoTIFFs open in QGIS with correct CRS auto-detected
2. ✅ Coordinates match source data within 1 meter precision
3. ✅ User understands resolution options (GSD vs DPI)
4. ✅ Common EPSG codes available in preset list
5. ✅ Auto-detection suggests appropriate EPSG
6. ✅ Export validation prevents invalid parameters
7. ✅ Export completes without errors for sizes up to 8192x8192

## Timeline Estimate

- **Phase 1 (CRS Fix):** 2-3 hours
- **Phase 2 (Resolution UX):** 2-3 hours
- **Phase 3 (EPSG Management):** 2 hours
- **Phase 4 (Validation):** 2-3 hours
- **Testing:** 2 hours

**Total:** 10-13 hours (1.5-2 days)

## Dependencies

- **geotiff.js** - Current library for writing GeoTIFF
- **file-saver** - Already used for downloads
- **SurfaceRasterizer** - Already implemented for rendering

## Future Enhancements

- **World file export** - .tfw for non-GeoTIFF formats
- **COG (Cloud Optimized GeoTIFF)** - Tiled format for web
- **Multi-band export** - RGB + elevation as 4-band TIFF
- **EPSG database** - Full lookup table for descriptions
- **Coordinate transform** - Export in different CRS than source
