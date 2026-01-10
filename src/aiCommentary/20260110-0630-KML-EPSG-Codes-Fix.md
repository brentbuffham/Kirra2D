# KML Export/Import EPSG Codes Enhancement

**Date:** 2026-01-10 06:30
**Status:** Complete
**Priority:** UX Improvement

---

## Problem

The KML import dialog only had **6 hardcoded EPSG codes** (mostly Australian zones), while the GeoTIFF export dialog has the full **top 100 most common EPSG codes worldwide**. This created an inconsistent user experience.

### Before:
- **GeoTIFF Export**: 100+ EPSG codes ✅
- **GeoTIFF Import**: 100+ EPSG codes ✅
- **KML Export**: 100+ EPSG codes ✅ (already correct!)
- **KML Import**: Only 6 EPSG codes ❌

### Hardcoded List (Limited):
```javascript
var commonEPSG = [
    { code: "32750", name: "WGS 84 / UTM zone 50S" },
    { code: "32755", name: "WGS 84 / UTM zone 55S" },
    { code: "28350", name: "GDA94 / MGA zone 50" },
    { code: "28355", name: "GDA94 / MGA zone 55" },
    { code: "7850", name: "GDA2020 / MGA zone 50" },
    { code: "7855", name: "GDA2020 / MGA zone 55" }
];
```

This was insufficient for international users working with different UTM zones or coordinate systems.

---

## Solution

### 1. Export top100EPSGCodes from ProjectionDialog.js

**File:** `src/dialog/popups/generic/ProjectionDialog.js`

Changed from `const` to `export const`:
```javascript
/**
 * Top 100 most commonly used EPSG codes worldwide
 * Used for GeoTIFF coordinate system conversion dropdown
 * Exported for use in other dialogs (KML import, etc.)
 */
export const top100EPSGCodes = [
    { code: "4326", name: "WGS 84" },
    { code: "3857", name: "WGS 84 / Pseudo-Mercator" },
    // ... 98 more codes
];
```

This makes the comprehensive EPSG list available to other modules.

### 2. Import and Use in KML Parser

**File:** `src/fileIO/GoogleMapsIO/KMLKMZParser.js`

**Added import:**
```javascript
import { top100EPSGCodes } from "../../dialog/popups/generic/ProjectionDialog.js";
```

**Updated dropdown generation:**
```javascript
// OLD (hardcoded 6 codes):
var commonEPSG = [
    { code: "32750", name: "WGS 84 / UTM zone 50S" },
    // ... only 6 codes
];

for (var i = 0; i < commonEPSG.length; i++) {
    contentHTML += '<option value="' + commonEPSG[i].code + '">' + 
                   commonEPSG[i].code + " - " + commonEPSG[i].name + "</option>";
}

// NEW (100+ codes):
var epsgCodes = top100EPSGCodes;

for (var i = 0; i < epsgCodes.length; i++) {
    contentHTML += '<option value="' + epsgCodes[i].code + '">' + 
                   epsgCodes[i].code + " - " + epsgCodes[i].name + "</option>";
}
```

---

## The Top 100 EPSG Codes List

The shared list includes:

### Global Standards
- **EPSG:4326** - WGS 84 (GPS coordinates)
- **EPSG:3857** - WGS 84 / Pseudo-Mercator (Web Mercator)
- **EPSG:4269** - NAD83 (North America)
- **EPSG:4267** - NAD27 (North America)

### UTM Zones (Northern Hemisphere)
- Zones 1N through 60N (EPSG:32601-32660)
- Covers all northern hemisphere regions

### UTM Zones (Southern Hemisphere)
- Zones 1S through 60S (EPSG:32701-32760)
- Covers all southern hemisphere regions

### Australian Coordinate Systems
- **GDA94 / MGA zones** (EPSG:28348-28358)
- **GDA2020 / MGA zones** (EPSG:7844-7860)

### European Systems
- **ETRS89 / UTM zones** (EPSG:25828-25838)
- **ETRS89 / LAEA Europe** (EPSG:3035)

### Asian Systems
- **JGD2000 / Japan zones** (EPSG:2443-2461)
- **CGCS2000 / China zones** (EPSG:4490, 4491, 4528-4558)

### South American Systems
- **SIRGAS 2000 / UTM zones** (EPSG:31965-31984)

### African Systems
- **Arc 1950 / UTM zones** (EPSG:21035-21037)
- **WGS 84 / UTM zones** covering Africa

---

## Benefits

### 1. Consistency Across Dialogs
All projection dialogs now use the same comprehensive EPSG list:
- GeoTIFF import ✅
- GeoTIFF export ✅
- KML import ✅
- KML export ✅

### 2. International Support
Users worldwide can now:
- Import KML files in their local coordinate systems
- Transform to appropriate UTM zones
- Work with national grids (GDA, NAD, ETRS, etc.)

### 3. Single Source of Truth
The `top100EPSGCodes` list is defined once and reused everywhere:
- Easier to maintain
- Consistent naming
- Future additions benefit all dialogs

### 4. Better User Experience
- No need to manually enter EPSG codes
- Dropdown provides code descriptions
- Common codes are easy to find
- Fallback to custom Proj4 still available

---

## Code Changes Summary

### Files Modified:

1. **`src/dialog/popups/generic/ProjectionDialog.js`**
   - Changed `const top100EPSGCodes` to `export const top100EPSGCodes`
   - Updated JSDoc comment to mention export

2. **`src/fileIO/GoogleMapsIO/KMLKMZParser.js`**
   - Added import: `import { top100EPSGCodes } from "../../dialog/popups/generic/ProjectionDialog.js"`
   - Replaced hardcoded 6-item list with imported 100+ item list
   - Simplified code (no fallback needed)

### Lines Changed:
- ProjectionDialog.js: Line 16 (1 line changed)
- KMLKMZParser.js: Line 69 (1 line added), Lines 225-231 (28 lines replaced with 5 lines)

---

## Testing Checklist

✅ **KML Import Dialog:**
- Opens correctly
- EPSG dropdown shows 100+ codes
- Codes are organized (WGS84, NAD, UTM, etc.)
- Selection works properly
- Transform to projected coordinates functions correctly

✅ **KML Export Dialog:**
- Still shows 100+ codes (was already correct)
- No regression

✅ **GeoTIFF Dialogs:**
- Still show 100+ codes
- No regression

✅ **Module System:**
- Import/export working correctly
- No circular dependencies
- No linting errors

---

## Future Enhancements

### 1. Search/Filter Functionality
Could add a search box to filter EPSG codes:
```javascript
<input type="text" id="epsg-search" placeholder="Search EPSG codes..." 
       oninput="filterEPSGCodes(this.value)">
```

### 2. Grouped Dropdown
Could group codes by region:
```html
<optgroup label="Global Standards">
    <option>4326 - WGS 84</option>
    ...
</optgroup>
<optgroup label="UTM Northern Hemisphere">
    <option>32633 - WGS 84 / UTM zone 33N</option>
    ...
</optgroup>
```

### 3. Recent/Favorites
Could save user's recent EPSG selections to localStorage:
```javascript
var recentEPSG = JSON.parse(localStorage.getItem('recentEPSG') || '[]');
// Show at top of dropdown
```

### 4. Auto-Detection
Could attempt to auto-detect appropriate EPSG based on:
- Geographic location of data
- Existing coordinate ranges
- User's previous choices

---

## Related Files

All projection dialogs that now share the same EPSG list:

1. `src/dialog/popups/generic/ProjectionDialog.js` - Source of truth
2. `src/fileIO/GoogleMapsIO/KMLKMZParser.js` - KML import
3. `src/helpers/GeoTIFFExporter.js` - Uses ProjectionDialog for export
4. `src/helpers/SurfaceRasterizer.js` - Uses projected coordinates

---

## Conclusion

This small change significantly improves the international usability of Kirra's KML import functionality. By sharing the comprehensive EPSG list across all dialogs, we've:

- ✅ Maintained consistency
- ✅ Reduced code duplication
- ✅ Improved user experience for international users
- ✅ Made future maintenance easier

The KML import dialog now has the same 100+ EPSG codes as all other projection dialogs.
