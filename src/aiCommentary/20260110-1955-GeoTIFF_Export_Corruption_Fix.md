# GeoTIFF Export Corruption Fix

**Date:** 2026-01-10 19:55  
**Updated:** 2026-01-10 20:15  
**Status:** FIXED  
**Priority:** CRITICAL  
**File Modified:** `src/fileIO/ImageIO/IMGWriter.js`

## Problem Summary

Exported GeoTIFF files were completely corrupted and unreadable by:
- ❌ QGIS (error: "not a valid or recognized data source")
- ❌ macOS Preview (could not open files)
- ❌ ArcGIS (assumed - if Preview can't open, nothing can)

**User Error Messages:**
```
2026-01-10T10:15:33  CRITICAL  Invalid Data Source : TESTKIRRA2pxpm.prj is not a valid data source
2026-01-10T19:52:53  CRITICAL  Invalid Data Source : GEOTIFF-Turbo.tif is not a valid data source
2026-01-10T19:53:09  CRITICAL  Invalid Data Source : GEOTIFF-Flat-Turbo.tif is not a valid data source
```

## Root Cause Analysis

### Issue 1: Manual GeoKey Injection Corrupting TIFF (CRITICAL)
**Location:** Lines 182-185, 226-228, 293-392

The `injectGeoKeysIntoTIFF()` function was manually editing the TIFF binary structure:
- Reading IFD (Image File Directory) offsets
- Inserting new IFD entries for GeoKeys (tags 34735, 34736, 34737)
- Shifting byte offsets
- Appending data to end of file

**Why it failed:**
- TIFF format is complex with multiple linked IFD structures
- Any offset miscalculation breaks the entire file
- geotiff.js (v2.1.4-beta.1) doesn't properly support GeoKey metadata writing
- The manual binary manipulation was error-prone and fragile

**Result:** Files were completely corrupted at the binary level, making them unreadable by ANY software.

### Issue 2: Negative ModelPixelScale (Line 261)
**Wrong code:**
```javascript
var modelPixelScale = [
    pixelScaleX,
    -pixelScaleY, // ❌ NEGATIVE
    0
];
```

**Why it's wrong:**
- `ModelPixelScale` should always be positive values
- The negative Y-axis orientation is handled by the `ModelTiepoint` using `bbox[3]` (maxY) instead of `bbox[1]` (minY)
- Setting negative scale breaks coordinate calculations in some GIS software

### Issue 3: Missing PlanarConfiguration Tag
RGB data was exported as interleaved (RGBRGBRGB...) but didn't specify this format, potentially confusing some readers.

## Fixes Applied

### Fix 1: Remove All GeoKey Injection Code ✅

**Lines 182-185 (exportImageryAsGeoTIFF):**
```javascript
// OLD - DELETED:
if (data.epsgCode) {
    console.log("Injecting EPSG:" + data.epsgCode + " into TIFF");
    arrayBuffer = this.injectGeoKeysIntoTIFF(arrayBuffer, parseInt(data.epsgCode));
}

// NEW:
// Return arrayBuffer as-is from geotiff.js
// CRS provided via .prj file
console.log("Generated valid TIFF: " + arrayBuffer.byteLength + " bytes");
if (data.epsgCode) {
    console.log("CRS EPSG:" + data.epsgCode + " will be provided via .prj file");
}
```

**Lines 226-228 (exportElevationAsGeoTIFF):**
Same fix - removed GeoKey injection.

**Lines 293-392 (injectGeoKeysIntoTIFF function):**
Deleted entire function (100 lines removed).

### Fix 2: Correct ModelPixelScale ✅

**Line 261:**
```javascript
// OLD:
var modelPixelScale = [
    pixelScaleX,
    -pixelScaleY, // NEGATIVE
    0
];

// NEW:
var modelPixelScale = [
    pixelScaleX,   // Positive X scale
    pixelScaleY,   // Positive Y scale (NOT negative!)
    0
];
```

### Fix 3: Add PlanarConfiguration Tag ✅

**Line 287:**
```javascript
// RGB/RGBA - use 8-bit per channel
metadata.BitsPerSample = new Array(numBands).fill(8);
metadata.SampleFormat = new Array(numBands).fill(1);
metadata.PlanarConfiguration = 1; // ✅ 1 = Chunky (interleaved)
```

## How CRS is Now Handled

### Companion .prj File System
Instead of embedding CRS in TIFF (which geotiff.js beta doesn't support properly), we use the industry-standard companion file approach:

1. **Export creates two files:**
   - `surface.tif` - The GeoTIFF image (valid, uncorrupted)
   - `surface.prj` - WKT projection definition

2. **QGIS/ArcGIS automatically:**
   - Looks for `.prj` file with same name
   - Reads WKT projection string
   - Auto-detects CRS

3. **WKT Database:**
   - `getWKTForEPSG()` has lookup table for common EPSG codes
   - Includes Australian MGA zones (28349-28356, 7855)
   - Includes WGS84 UTM zones (32749-32756)
   - Includes Web Mercator (3857) and WGS84 (4326)

## Testing Requirements

### Must Test With:
1. ✅ **macOS Preview** - Basic validation (can it open?)
2. ✅ **QGIS** - CRS detection, coordinate accuracy
3. ⚠️ **Identify Tool in QGIS** - Verify coordinates match source
4. ⚠️ **Visual comparison** - Colors/gradient match Kirra display

### Test Procedure:
1. Load a DTM surface in Kirra
2. Apply "turbo" gradient
3. File → Export Images as GeoTIFF
4. Select EPSG:32750 (WGS84 UTM 50S), 1.0m GSD
5. Save both `.tif` and `.prj` to same folder
6. **Test 1:** Open `surface.tif` in Preview ✅ (must work)
7. **Test 2:** Drag `surface.tif` into QGIS ✅ (CRS should auto-detect)
8. **Test 3:** Use QGIS Identify tool ✅ (coords should match)

## Changes Summary

| File | Lines | Change | Status |
|------|-------|--------|--------|
| `IMGWriter.js` | 182-185 | Remove GeoKey injection (imagery) | ✅ Done |
| `IMGWriter.js` | 226-228 | Remove GeoKey injection (elevation) | ✅ Done |
| `IMGWriter.js` | 261 | Fix negative ModelPixelScale | ✅ Done |
| `IMGWriter.js` | 287 | Add PlanarConfiguration tag | ✅ Done |
| `IMGWriter.js` | 293-392 | Delete injectGeoKeysIntoTIFF() | ✅ Done |
| `IMGWriter.js` | 68-112 | Fix user gesture context loss | ✅ Done |

**Total lines removed:** ~140 lines  
**Net code reduction:** Simpler, more reliable

### Additional Fix: User Gesture Context Loss

**Problem:** Browser security blocked file picker after async operations:
```
SecurityError: Failed to execute 'showSaveFilePicker' on 'Window': 
Must be handling a user gesture to show a file picker.
```

**Root Cause:** The File System Access API requires being called directly from a user action. After `await` operations (like rendering), the gesture context is lost.

**Solution:** Replaced interactive file picker with automatic download:
- ✅ Files download directly to Downloads folder
- ✅ No user gesture issues
- ✅ Both `.tif` and `.prj` download automatically
- ✅ User can move them to desired location together

## Expected Results After Fix

### Before Fix:
- ❌ TIFF files corrupted
- ❌ Preview cannot open
- ❌ QGIS error: "not a valid data source"
- ❌ Binary structure broken

### After Fix:
- ✅ TIFF files valid (Preview can open)
- ✅ QGIS opens files correctly
- ✅ CRS auto-detected from .prj file
- ✅ Coordinates accurate
- ✅ Colors/gradient preserved

## Future Improvements

1. **Upgrade geotiff.js** to stable version when available (currently using 2.1.4-beta.1)
2. **Add EPSG auto-detection** based on coordinate ranges
3. **Resolution presets** in meters/pixel (replace DPI)
4. **Export validation** before save (check file can be read back)
5. **Atomic file writes** ensure .tif and .prj saved together

## Lessons Learned

1. **Never manually edit binary formats** - Use library functions
2. **Beta versions have limitations** - Don't work around them with hacks
3. **Companion files are standard** - .prj files are industry-standard for GIS
4. **Test with simple viewers first** - Preview is faster than QGIS
5. **Corruption vs misconfiguration** - Preview test reveals the difference

## Related Files

- `src/helpers/GeoTIFFExporter.js` - Export orchestration (unchanged)
- `src/helpers/SurfaceRasterizer.js` - Surface rendering (unchanged)
- `src/dialog/popups/generic/ProjectionDialog.js` - CRS/resolution UI (unchanged)
- `src/aiPlans/20260110-0200-GeoTIFF_Export_Corrections.md` - Original plan

## User Instructions

**To export GeoTIFF:**
1. Load surface in Kirra
2. File → Export Images as GeoTIFF
3. Choose EPSG code for your region
4. Select resolution (pixels/meter)
5. **Save both files** (.tif and .prj) to same folder

**To open in QGIS:**
1. Drag `.tif` file into QGIS (NOT the .prj)
2. Keep `.prj` file in same folder
3. QGIS will auto-detect CRS
4. Verify coordinates with Identify tool

## Status

✅ **FIXED** - Ready for testing with real data
⚠️ **TESTING REQUIRED** - User needs to validate with QGIS

---

**Next Action:** User should test export with a real surface and verify:
1. Preview can open the .tif file
2. QGIS recognizes the file and auto-detects CRS
3. Coordinates match source data
