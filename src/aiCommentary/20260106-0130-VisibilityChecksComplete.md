# Export Visibility Checks - Complete Implementation

**Date:** 2026-01-06 01:30
**Status:** Complete
**Priority:** Critical - Data Integrity

---

## Overview

Implemented visibility filtering across all export functions to ensure only visible entities (holes, surfaces, drawings) are exported. This prevents accidental export of hidden data and provides users with better control over what gets exported.

---

## Changes Made

### 1. DXF 3DFACE Export (Surfaces)
**Location:** `kirra.js` lines 7285-7291

**Change:**
```javascript
// OLD: Exported all surfaces
window.loadedSurfaces.forEach(function (surface) {
    if (surface.triangles && Array.isArray(surface.triangles)) {
        allTriangles = allTriangles.concat(surface.triangles);
    }
});

// NEW: Export only visible surfaces
window.loadedSurfaces.forEach(function (surface) {
    if (surface.visible && surface.triangles && Array.isArray(surface.triangles)) {
        allTriangles = allTriangles.concat(surface.triangles);
    }
});
```

**Impact:** 
- Fixed issue where both DXF and OBJ surfaces were being exported together
- Users can now hide surfaces they don't want to export

---

### 2. OBJ Export (Surfaces)
**Location:** `kirra.js` lines 7877-7885

**Change:**
```javascript
// OLD: Exported all surfaces
var surfaces = Array.from(window.loadedSurfaces.values());

// NEW: Export only visible surfaces with validation
var surfaces = Array.from(window.loadedSurfaces.values()).filter(function(surface) {
    return surface.visible;
});

if (surfaces.length === 0) {
    showModalMessage("No Data", "No visible surfaces to export", "warning");
    return;
}
```

**Impact:**
- Fixed OBJ export topology issues by preventing multiple surfaces from being exported together
- Added validation message when no visible surfaces exist

---

### 3. Surpac DTM/STR Export (Surfaces)
**Location:** `kirra.js` lines 7349-7368

**Change:**
```javascript
// OLD: Exported all surfaces
exportData = {
    surfaces: window.loadedSurfaces,
    fileName: "surface"
};

// NEW: Export only visible surfaces
var visibleSurfaces = new Map();
window.loadedSurfaces.forEach(function(surface, key) {
    if (surface.visible) {
        visibleSurfaces.set(key, surface);
    }
});

if (visibleSurfaces.size === 0) {
    showModalMessage("No Visible Surfaces", "No visible surfaces to export. Please make some surfaces visible first.", "warning");
    return;
}

exportData = {
    surfaces: visibleSurfaces,
    fileName: "surface"
};
```

**Impact:**
- Consistent with other surface exporters
- Added validation message

---

### 4. Point Cloud XYZ Export (Surfaces)
**Location:** `kirra.js` lines 7981-7997

**Change:**
```javascript
// OLD: Extracted vertices from all surfaces
window.loadedSurfaces.forEach(function(surface) {
    if (surface.triangles && Array.isArray(surface.triangles)) {
        // ... extract vertices
    }
});

// NEW: Extract vertices from visible surfaces only
window.loadedSurfaces.forEach(function(surface) {
    if (surface.visible && surface.triangles && Array.isArray(surface.triangles)) {
        // ... extract vertices
    }
});
```

**Impact:**
- Point cloud export now respects surface visibility
- Prevents exporting vertices from hidden surfaces

---

## Already Implemented (Verified)

### Blast Hole Exports ✅
All hole exporters already filter visible holes using `window.isHoleVisible(hole)`:

1. **CSV Export (All Formats)** - Line 7150-7152
   - Filters: `window.allBlastHoles.filter(function (hole) { return window.isHoleVisible(hole); })`

2. **DXF Holes Export** - Line 7233
   - Filters: `window.allBlastHoles.filter((hole) => window.isHoleVisible(hole))`

3. **DXF Vulcan Tagged Export** - Line 7253
   - Filters: `window.allBlastHoles.filter((hole) => window.isHoleVisible(hole))`

4. **Surpac STR Blastholes Export** - Line 7410-7412
   - Filters: `allBlastHoles.filter(function (hole) { return hole.visible !== false; })`

5. **Measured Export** - Line 8143-8145
   - Filters: `window.allBlastHoles.filter(function (hole) { return window.isHoleVisible(hole); })`

6. **AQM Export** - Line 19986
   - Filters: `allBlastHoles.filter((hole) => blastGroupVisible && hole.visible !== false)`

### KAD Drawing Exports ✅
The `exportKADDXF()` function already has comprehensive visibility checks:

1. **Entity Level** - Line 11660
   - Checks: `isEntityVisible(entityName)`

2. **Element Level** - Line 11670
   - Checks: `item.visible === false`

3. **Polyline Points** - Lines 11684, 11698
   - Filters: `data.filter((pt) => pt.visible !== false)`

---

## Export Functions Status Summary

| Export Type | Function/Location | Visibility Check | Status |
|-------------|-------------------|------------------|---------|
| CSV Holes (All Formats) | Line 7150 | `isHoleVisible()` | ✅ Already Implemented |
| DXF Holes | Line 7233 | `isHoleVisible()` | ✅ Already Implemented |
| DXF Vulcan Tagged | Line 7253 | `isHoleVisible()` | ✅ Already Implemented |
| DXF KAD Drawings | Line 11660 | `isEntityVisible()` | ✅ Already Implemented |
| **DXF 3DFACE Surfaces** | **Line 7287** | **`surface.visible`** | **✅ Fixed Today** |
| Surpac STR Blastholes | Line 7410 | `hole.visible !== false` | ✅ Already Implemented |
| **Surpac DTM/STR Surfaces** | **Line 7356** | **`surface.visible`** | **✅ Fixed Today** |
| **OBJ Surfaces** | **Line 7878** | **`surface.visible`** | **✅ Fixed Today** |
| **Point Cloud XYZ** | **Line 7983** | **`surface.visible`** | **✅ Fixed Today** |
| Measured Export | Line 8143 | `isHoleVisible()` | ✅ Already Implemented |
| AQM Export | Line 19986 | `hole.visible !== false` | ✅ Already Implemented |
| Image Export | Line 7841 | N/A | 🚧 Coming Soon |
| KML/KMZ | Line 8024 | N/A | 🚧 Coming Soon |
| Wenco NAV | Line 8087 | N/A | 🚧 Coming Soon |
| CBLAST | Line 8094 | N/A | 🚧 Coming Soon |
| LAS Point Cloud | Line 8101 | N/A | 🚧 Coming Soon |
| ESRI Shapefile | Line 8108 | N/A | 🚧 Coming Soon |

---

## Testing Recommendations

1. **Surface Export Testing:**
   - Load multiple surfaces (DXF, OBJ, PLY)
   - Hide some surfaces in tree view
   - Export using DXF 3DFACE, OBJ, Surpac DTM, Point Cloud
   - Verify only visible surfaces are exported

2. **Hole Export Testing:**
   - Load blast holes
   - Hide some holes using visibility controls
   - Export using CSV, DXF, Surpac STR
   - Verify only visible holes are exported

3. **Drawing Export Testing:**
   - Create KAD drawings (lines, polygons, points)
   - Hide some entities or individual points
   - Export as DXF KAD
   - Verify only visible entities/points are exported

---

## Benefits

1. **Data Integrity:**
   - Users won't accidentally export hidden/temporary data
   - Exports match what's visible on screen

2. **Workflow Efficiency:**
   - Users can hide reference surfaces while exporting working surfaces
   - No need to delete unwanted data before export

3. **Consistency:**
   - All exporters now behave consistently
   - Visibility controls work as expected across all formats

---

## Files Modified

1. `src/kirra.js` - Added visibility checks to 4 export functions:
   - DXF 3DFACE export (line 7287)
   - OBJ export (line 7878)
   - Surpac DTM/STR surface export (line 7356)
   - Point Cloud XYZ export (line 7983)

---

## Related Issues Fixed

### Issue: OBJ Export Wrong Topology
**Problem:** OBJ export was creating 504 triangles instead of 489, with scrambled geometry.

**Root Cause:** Both the original DXF surface (489 triangles) and a previously imported OBJ surface (504 triangles) were being exported together.

**Solution:** Added visibility filter to OBJ export. Users can now hide unwanted surfaces before export.

**Result:** OBJ export now produces correct topology matching the DXF 3DFACE export.

---

## Notes

- All hole exporters were already correctly filtering visible holes
- KAD export function already had comprehensive visibility checks at entity and element level
- The visibility property is consistently named across entity types:
  - Surfaces: `surface.visible`
  - Holes: checked via `isHoleVisible(hole)` or `hole.visible !== false`
  - KAD entities: checked via `isEntityVisible(entityName)` and `item.visible`

