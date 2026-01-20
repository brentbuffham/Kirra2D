# LAS Import Centroid and Performance Fixes
**Date:** 2026-01-20 10:45
**Issue:** LAS file import causing frame rate drops, wrong Z elevation, and cursor disappearing

## Problem Summary

When importing a LAS file:
1. **Frame rate dropped to 1-5 FPS** with large LAS point clouds
2. **World 3D Z showed extreme values** (e.g., -683885.602) when only surfaces were loaded
3. **Cursor (torus) disappeared** because it was positioned at the extreme Z value

## Root Causes Identified

### Issue 1: Performance - O(n) calculation every render frame
At line 26893 in `kirra.js`, `calculateDataZCentroid()` was being called every render frame:
```javascript
dataCentroidZ = calculateDataZCentroid();
```
For a LAS file with 30,000+ triangles and 100,000+ points, iterating through every point 60 times per second caused severe performance degradation.

### Issue 2: Missing meshBounds on LAS surfaces
The `LASParser.createTriangulatedSurface()` function created surfaces without `meshBounds`, which is needed by `calculateDataCentroid()` for efficient centroid calculation without iterating through all points.

### Issue 3: dataCentroidZ not updated by updateCentroids()
The `updateCentroids()` function only updated `centroidX` and `centroidY`, not `dataCentroidZ`. This meant `dataCentroidZ` remained at 0 until the render loop recalculated it.

### Issue 4: No validation on extreme Z values
When no valid surface intersection occurred, `currentMouseWorldZ` could receive extreme garbage values from failed plane intersections, causing the cursor to be positioned far outside the viewable area.

## Fixes Implemented

### Fix #1: Performance - Conditional centroid recalculation
**Files Modified:** `kirra.js`
- Added `centroidNeedsRecalculation` flag (line 437)
- Modified render loop to only recalculate when flag is set (line 26920-26928)
- Added `requestCentroidRecalculation()` helper function (line 757-761)
- Exposed flag and function to window for external modules

### Fix #2: Add meshBounds to LASParser
**Files Modified:** `LASParser.js`
- Added meshBounds calculation from vertices (lines 842-863)
- meshBounds includes minX, maxX, minY, maxY, minZ, maxZ
- Added to surface object for efficient centroid calculation

### Fix #3: Update dataCentroidZ in updateCentroids()
**Files Modified:** `kirra.js`
- Modified `updateCentroids()` to also update `dataCentroidZ` (lines 31333-31341)
- Sets flag to false after update to prevent redundant calculation in render loop
- Exposes updated value to window

### Fix #4: Validate extreme Z values
**Files Modified:** `kirra.js`
- Added `validateWorldZ()` helper function (lines 764-787)
- Validates Z is within 100km of centroid, uses fallback if extreme
- Applied to all places where `currentMouseWorldZ` is set (lines 2811, 11854, 46643-46651)

### Additional: Add meshBounds to All Surface-Creating Parsers
The following parsers were updated to include meshBounds calculation:

**NAVAsciiParser.js**
- Added meshBounds calculation when creating surfaces from TRIANGLE records
- Ensures NAV surface imports work correctly with centroid calculation

**DXFParser.js**
- Added meshBounds calculation for 3DFACE surface creation
- Ensures DXF 3DFACE imports work correctly with centroid calculation

**BinaryDXFParser.js**
- Added meshBounds calculation for 3DFACE surface creation
- Ensures Binary DXF 3DFACE imports work correctly with centroid calculation

**SurpacSurfaceParser.js**
- Added meshBounds calculation when creating STR/DTM surfaces
- Ensures Surpac surface imports work correctly with centroid calculation

**createSurfaceFromPointsWithOptions() (kirra.js)**
- Already had meshBounds calculation (verified as working)
- Handles point cloud to surface triangulation

## Other Parsers Checked (No Changes Needed)

The following parsers were checked and don't need meshBounds:
- **SurpacDTMParser.js** - Returns point cloud only, triangulation happens in SurpacSurfaceParser
- **SurpacBinaryDTMParser.js** - Returns point cloud only
- **PointCloudParser.js** - Returns just points array, triangulation happens in createSurfaceFromPointsWithOptions
- **SurpacSTRParser.js** - Returns vertices only, triangulation handled by SurpacSurfaceParser
- **SurpacBinarySTRParser.js** - Returns vertices only

## Expected Results

After these fixes:
1. **Frame rate should remain at 60 FPS** even with large LAS files
2. **Z centroid should show correct elevation** based on actual surface data
3. **Cursor should remain visible** at sensible Z positions
4. **Centroid updates immediately after import** without waiting for render loop

## Additional Fixes (2026-01-20 13:00)

### Fix #5: updateCentroids() now updates threeRenderer.setOrbitCenter()
**Files Modified:** `kirra.js` (line ~31366)

**Problem:** When importing LAS files or any surface data, `updateCentroids()` updated `dataCentroidZ` but did NOT update `threeRenderer.orbitCenterZ`. This caused:
- The 3D cursor (torus) to use the wrong Z plane when orbiting
- Cursor disappeared because the view plane was at Z=0 instead of the actual data elevation

**Solution:** Added call to `threeRenderer.setOrbitCenter(fullCentroid.x, fullCentroid.y, fullCentroid.z)` after updating centroids.

```javascript
// Step 5c) CRITICAL FIX: Update threeRenderer orbit center when centroids change
if (threeRenderer && typeof threeRenderer.setOrbitCenter === "function") {
    threeRenderer.setOrbitCenter(fullCentroid.x, fullCentroid.y, fullCentroid.z);
}
```

### Fix #6: Surface vertex snapping now uses spatial filtering
**Files Modified:** `kirra.js` (line ~46352)

**Problem:** The 3D snap function `snapToNearestPointWithRay()` only checked the first 100 surface points for snapping:
```javascript
const MAX_SURFACE_POINTS = 100; // Only first 100 points!
```
For LAS files with 100,000+ points, the first 100 points are likely clustered in one area of the surface, not near where the user's cursor is.

**Solution:** Use mouse world position as a spatial hint to filter surface points:
1. Get approximate mouse world position from view plane intersection
2. Calculate search radius (5x snap radius for generous coverage)
3. Pre-filter surface points by XY distance from mouse position
4. Only do detailed ray-distance checking on nearby points

```javascript
// Step 5a) Get approximate mouse world position for spatial filtering
var viewPlanePos = im.getMouseWorldPositionOnViewPlane();
mouseHintX = viewPlanePos.x;
mouseHintY = viewPlanePos.y;

// Step 5c) PERFORMANCE: Pre-filter points by XY distance from mouse hint
for (var pi = 0; pi < surface.points.length; pi++) {
    var distSqFromHint = dxHint * dxHint + dyHint * dyHint;
    if (distSqFromHint <= surfaceSearchRadiusSq) {
        nearbyPoints.push({ point: sp, index: pi });
    }
}
```

### Fix #7: updateCentroids() now calls updateThreeLocalOrigin() and exposeGlobalsToWindow()
**Files Modified:** `kirra.js` (line ~31375)

**Problem:** When importing LAS files as the first/only data type, the 3D cursor (torus) didn't follow the mouse because:
- `threeLocalOriginX/Y` weren't being set from the surface data
- `window.threeLocalOriginX/Y` weren't being synced
- `InteractionManager.getMouseWorldPositionOnViewPlane()` used wrong origin values (0,0)
- The view plane intersection returned wrong world coordinates

This worked when holes were present because holes triggered `updateThreeLocalOrigin()` first.

**Solution:** Added calls to `updateThreeLocalOrigin()` and `exposeGlobalsToWindow()` in `updateCentroids()`:

```javascript
// Step 5d) CRITICAL FIX: Update local origin for coordinate conversion
updateThreeLocalOrigin();

// Step 5e) CRITICAL FIX: Sync all globals to window AFTER updating origin
exposeGlobalsToWindow();
```

### Fix #8: updateThreeLocalOrigin() now handles meshBounds for all surface types
**Files Modified:** `kirra.js` (line ~643)

**Problem:** The function only checked for `isTexturedMesh && meshBounds` but LAS surfaces have meshBounds without being textured.

**Solution:** Changed to check for `meshBounds` on any surface type:

```javascript
// Check for meshBounds (LAS surfaces, OBJ files, any surface with bounds)
if (surface.meshBounds) {
    threeLocalOriginX = (surface.meshBounds.minX + surface.meshBounds.maxX) / 2;
    threeLocalOriginY = (surface.meshBounds.minY + surface.meshBounds.maxY) / 2;
}
```

## Technical Notes

- The `centroidNeedsRecalculation` flag should be set by any code that modifies data (imports, deletes)
- The `validateWorldZ()` function uses 100km as the max deviation threshold - this is generous for any real-world mining/construction data
- meshBounds allows efficient centroid calculation using only min/max values instead of iterating through every point
- There is only ONE `threeRenderer` variable that can be ThreeRenderer, ThreeRendererV2, or ThreeRendererPerf - they share the same interface including `setOrbitCenter()`
- The `updateCentroids()` function is called by ALL import operations (LAS, DXF, CSV, KAD, etc.) so all fixes apply universally
- The `updateThreeLocalOrigin()` function sets the coordinate system origin for Three.js local coordinates
- The `exposeGlobalsToWindow()` function syncs module-level variables to window.* for InteractionManager access
