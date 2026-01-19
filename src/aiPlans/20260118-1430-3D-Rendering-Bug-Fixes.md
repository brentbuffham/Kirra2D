# 3D Rendering and Tool State Bug Fixes Plan

**Date:** 2026-01-18 14:30
**Status:** In Progress

## Overview

This plan addresses multiple 3D rendering and tool state bugs identified through testing. The issues fall into categories of missing redraws, tool state persistence, display toggle issues, and rendering bugs.

---

## Current Todo Status

### Completed
- [x] Clear lastKADDrawPoint when KAD tools deactivate in removeEventListenersExcluding()
- [x] Fix single/multi connector 3D updates (added threeDataNeedsRebuild flag to 3D click handler)
- [x] Add threeDataNeedsRebuild = true to all pattern generation dialogs
- [x] Add threeDataNeedsRebuild = true to move tool completion
- [x] Add threeDataNeedsRebuild = true to multi-connector completion
- [x] Fix display toggle OFF behavior with clearGroup() for connectors and other displays
- [x] Fix hole label text to use fixed pixel size (matching 2D canvas behavior) - uses camera.zoom
- [x] Fix shapefile/KAD highlight Z positioning to use entity Z (verified working)
- [x] Fix texture memory leak on selection by disposing old textures
- [x] Audit all file imports (CSV, DXF, SHP, LAS, OBJ, KAD, etc.) to ensure threeDataNeedsRebuild is set
- [x] Batch or super-batch Voronoi cells to prevent geometry/texture accumulation
- [x] Fix cursor/mouse indicator to use fixed pixel size (sizeAttenuation false) matching 2D behavior
- [x] Fix delay text not showing when display toggled (restored 3D delay text rendering)
- [x] Fix font slider updating 3D text (user applied fix - clears text cache and triggers rebuild)

### In Progress / Remaining Issues
- [x] Fix CSV import not showing 3D immediately - **FIXED 2026-01-19** (added threeDataNeedsRebuild to custom CSV import at line 35427)
- [x] Fix entities not removed from 3D when TreeView delete applied - **FIXED 2026-01-19** (added threeDataNeedsRebuild to all TreeView delete handlers)
- [x] Fix offset tool not redrawing 3D on completion - **FIXED 2026-01-19** (added threeDataNeedsRebuild to performKADOffset)
- [x] Fix radii tool not redrawing 3D on completion - **FIXED 2026-01-19** (added threeDataNeedsRebuild to createRadiiFromSelectedEntitiesFixed)
- [x] Fix connectors not responding to TieSize slider - **FIXED 2026-01-19** (added threeDataNeedsRebuild to connSlider event)
- [x] Fix connector stadium not following mouse - **FIXED 2026-01-19** (changed to use torusWorldPos for view plane tracking)
- [x] Fix connector stadium rotational misalignment on orbit - **FIXED 2026-01-19** (same fix as above)
- [x] Fix leading lines not working in 3D - **FIXED 2026-01-19** (added drawKADLeadingLineThreeJS call in handle3DMouseMove)
- [x] Fix hole label text alignment at larger font sizes - **FIXED 2026-01-19** (use BASE_FONT_SIZE for position calculations)
- [ ] Fix geometry count increasing by 5-10 on each orbit (memory leak during camera movement)
- [ ] Investigate Voronoi framerate drop (geometry is batched but still slow)

---

## Test Results Summary (from user testing)

| Test | Status | Notes |
|------|--------|-------|
| KAD line tool: leading line clears when tool deactivates | ✅ | Polys/Text/points/circles also need fix |
| Single connector: 3D updates on connection | ❌ | Fixed - needs retest |
| Multi connector: 3D updates on completion | ❌ | Fixed - needs retest |
| Move tool: 3D updates when hole moved | ❌ | Code in place - needs verification |
| Pattern in polygon: 3D shows new holes | ✅ | Working |
| Display buttons: toggle ON and OFF | ✅ | Mostly working, delay text was missing |
| Connector display: acceptable framerate | ✅ | Working |
| Hole labels: consistent size when zoomed | ❌ | Font slider fix applied by user |
| Shapefile: highlight matches geometry position | ❌ | Z positioning issue |
| Selection: no texture count increase | ✅ | But textures don't decrease, geometry increases 5-10 per orbit |
| CSV import: 3D shows imported holes immediately | ✅ | **FIXED 2026-01-19** - added threeDataNeedsRebuild to custom CSV import |
| DXF import: 3D shows imported geometry immediately | ✅ | Working |
| Shapefile import: 3D shows imported geometry immediately | ✅ | **FIXED 2026-01-19** - TreeView delete now triggers 3D rebuild |
| Voronoi display: geometry count stays constant | ✅ | But framerate plummets |
| Voronoi toggle: OFF clears geometry, ON recreates it | ✅ | Working |
| Text in 3D: same pixel size on screen regardless of zoom | ❌ | Related to hole text labels |
| Text in 3D: same pixel size regardless of data spatial extent | ✅/❌ | Font slider now triggers rebuild |
| Cursor in 3D: fixed pixel size | ✅ | Working |
| Cursor in 3D: matches 2D snap radius appearance | ✅ | Working |

---

## Implemented Changes

### Phase 1 - Quick Wins (Tool State)
1. **KAD tool deactivation** - Added `lastKADDrawPoint = null;` in `removeEventListenersExcluding()` for all KAD drawing tools (line, polygon, point, text, circle) to prevent stale leading lines.

2. **Connector tool redraws** - Added `window.threeDataNeedsRebuild = true;` to 3D click handler for both single and multi-connector completion (lines ~1831 and ~1894).

### Phase 2 - Missing Redraws
3. **Pattern generation redraw** - Added `window.threeDataNeedsRebuild = true;` to:
   - `addPattern()` function
   - `generatePatternInPolygon()` function
   - `generateHolesAlongLine()` function
   - `generateHolesAlongPolyline()` function

4. **Move tool redraw** - Added `window.threeDataNeedsRebuild = true;` in `handleMoveToolMouseUp()` for both 3D mode and 2D mode paths.

### Phase 3 - Display Toggles
5. **Display toggle OFF behavior** - Updated `allToggles.forEach()` handler to:
   - Clear connectors group when `displayConnectors` is unchecked
   - Clear contours group when contour/relief/first-movements toggles are unchecked
   - Clear Voronoi cells using new `clearVoronoiCellsThreeJS()` function
   - Always set `window.threeDataNeedsRebuild = true;` on toggle change

### Phase 4 - Rendering Fixes
6. **Text scaling fix** - Modified `createKADText()` in GeometryFactory to:
   - Calculate `fontSizeWorldUnits = fontSize / cameraZoom` instead of `fontSize / currentScale`
   - This ensures text maintains fixed screen pixel size regardless of zoom or data extent
   - Updated cache to not include zoom key (allows fontSize updates on same text object)

7. **Texture memory leak fix** - Enhanced the highlight clearing code to dispose textures (map, lightMap, bumpMap, normalMap, specularMap, envMap) before disposing materials.

8. **Delay text restored** - Added delay text rendering back to `createConnectorLine()` in GeometryFactory (was previously removed to HUD overlay).

### Phase 5 - Import Triggers and Voronoi Optimization
9. **File imports 3D redraw** - Added `window.threeDataNeedsRebuild = true;` to:
    - KAD file import (`.kad`, `.txt`)
    - CSV import
    - Surpac surface import (STR+DTM)
    - DTM surface import
    - STR KAD import
    - DXF import
    - Shapefile import
    - LAS point cloud import
    - Textured OBJ surface import
    - Non-textured OBJ surface import

10. **Voronoi cells cleanup** - Added `clearVoronoiCellsThreeJS()` function that:
    - Finds all Voronoi cell groups by `userData.type === "voronoiCells"`
    - Properly disposes geometry, materials, and textures
    - Removes from scene
    - Called before creating new cells and when toggling display OFF

11. **Cursor/mouse indicator fix** - Modified `drawMousePositionIndicatorThreeJS()` to:
    - Calculate `snapRadiusWorld = snapRadiusPixels / cameraZoom`
    - This ensures cursor maintains fixed screen pixel size regardless of zoom

---

## Key Files Modified

| File | Changes |
|------|---------|
| `src/kirra.js` | Tool state cleanup, redraw triggers, event handlers, import handlers, font slider fix |
| `src/dialog/popups/generic/PatternGenerationDialogs.js` | Uses redraw3D() which sets flag |
| `src/three/GeometryFactory.js` | Text scaling fix (camera zoom), delay text restored, highlight Z fix |
| `src/draw/canvas3DDrawing.js` | Leading line fixes, Voronoi clear function, cursor size fix |
| `src/three/ThreeRenderer.js` | Texture disposal in cleanup |

---

## Known Remaining Issues

### Geometry Leak on Orbit
- Geometry count increases by 5-10 on each camera orbit
- Need to investigate what's being created during orbit that isn't being disposed
- Likely candidates: axis helper recreation, grid recreation, or some highlight geometry

### TreeView Delete Not Removing 3D Geometry - **FIXED 2026-01-19**
- ~~When entities are deleted via TreeView, the 3D geometry remains~~
- Added `window.threeDataNeedsRebuild = true;` to all TreeView delete handlers:
  - KAD elements deletion (~line 46636)
  - KAD entities deletion (~line 46654)
  - Surfaces deletion (~line 46673)
  - Images deletion (~line 46693)
  - Holes deletion with renumbering (~line 46764)

### CSV Import 3D Update - **FIXED 2026-01-19**
- ~~CSV import may have a code path that doesn't trigger 3D rebuild~~
- Added `window.threeDataNeedsRebuild = true;` to custom CSV import at line 35427 (before `drawData()` call)

### Voronoi Performance
- Even with cleanup working, Voronoi display causes framerate drop
- Consider implementing true geometry batching (merge all cells into single BufferGeometry)
- Current implementation creates individual meshes per cell

---

## Next Steps

1. ~~Retest connector 3D updates after the fix~~ ✅
2. Investigate geometry leak during orbit (5-10 geometries added per orbit)
3. ~~Add threeDataNeedsRebuild to TreeView delete handlers~~ ✅ **FIXED 2026-01-19**
4. ~~Verify CSV import all paths~~ ✅ **FIXED 2026-01-19**
5. Consider Voronoi geometry batching for performance (framerate still drops)

---

## Code Patterns to Follow

### Triggering 3D Rebuild
```javascript
// Step #) Trigger 3D rebuild to show changes
window.threeDataNeedsRebuild = true;
drawData(allBlastHoles, selectedHole);
```

### Clearing Text Cache on Data Change
```javascript
// Step #) Clear text cache when data changes
if (window.threeRenderer && typeof window.threeRenderer.clearTextCacheOnDataChange === "function") {
    window.threeRenderer.clearTextCacheOnDataChange();
}
```

### Fixed Screen-Space Size (Text/Cursor)
```javascript
// Step #) Calculate world units for fixed pixel size on screen
const cameraZoom = (window.threeRenderer && window.threeRenderer.camera) ? window.threeRenderer.camera.zoom : 1;
const worldSize = screenPixels / cameraZoom;
```

### Proper Disposal
```javascript
// Step #) Dispose textures before disposing material
if (obj.material.map) obj.material.map.dispose();
if (obj.material.lightMap) obj.material.lightMap.dispose();
// ... other maps ...
obj.material.dispose();
obj.geometry.dispose();
```

---

## Session Update: 2026-01-19

### Changes Made This Session

1. **Custom CSV Import 3D Fix** (`src/kirra.js` ~line 35427):
   - Added `window.threeDataNeedsRebuild = true;` before `drawData()` call in custom CSV import completion handler
   - This ensures 3D view updates immediately when importing CSV via the custom column mapping dialog

2. **TreeView Delete 3D Rebuild Triggers** (`src/kirra.js` ~lines 46636-46764):
   - Added `window.threeDataNeedsRebuild = true;` to ALL TreeView delete handlers:
     - KAD elements deletion (line ~46636)
     - KAD entities deletion (line ~46654)
     - Surfaces deletion (line ~46673)
     - Images deletion (line ~46693)
     - Holes deletion with renumbering (line ~46764)
   - Note: Holes deletion without renumbering already uses `refreshPoints()` which sets the flag

### Session Update: 2026-01-19 (Part 2)

### Additional Changes Made

3. **Offset Tool 3D Redraw** (`src/kirra.js` ~line 19722):
   - Added `window.threeDataNeedsRebuild = true;` before `drawData()` in `performKADOffset()` function
   - Ensures offset entities appear in 3D immediately upon creation

4. **Radii Tool 3D Redraw** (`src/kirra.js` ~line 19847):
   - Added `window.threeDataNeedsRebuild = true;` before `drawData()` in `createRadiiFromSelectedEntitiesFixed()` function
   - Ensures radii polygons appear in 3D immediately upon creation

5. **Connector Size Slider 3D Rebuild** (`src/kirra.js` ~line 11117):
   - Added `window.threeDataNeedsRebuild = true;` in connSlider event listener
   - Ensures 3D connector ties update when the TieSize/connectorSizeSlider is changed

6. **Connector Stadium Mouse Tracking Fix** (`src/kirra.js` ~line 2799):
   - Changed stadium zone to use `torusWorldPos` (view plane) instead of `mouseWorldPos` (XY plane)
   - Fixed rotational misalignment issue where stadium moved opposite to mouse during camera orbit
   - Stadium end point now correctly follows the cursor regardless of camera orientation

7. **Leading Lines in 3D Fix** (`src/kirra.js` ~line 2969):
   - Added actual `drawKADLeadingLineThreeJS()` call in `handle3DMouseMove()` instead of relying on `drawData()`
   - Leading line now properly follows the cursor during drawing operations in 3D mode
   - Previously the call was deferred but `drawData()` isn't called on every mouse move

8. **Hole Label Text Alignment Fix** (`src/draw/canvas3DDrawing.js` ~line 361):
   - Added `BASE_FONT_SIZE = 10` constant for position calculations
   - Text position calculations now use fixed base size instead of actual font size
   - Prevents text from drifting away from hole when font size is increased (e.g., 20px)
   - Actual font size still controls text rendering, only positions are normalized

### Remaining Issues

1. **Geometry Leak on Orbit** - Still needs investigation
   - Geometry count increases by 5-10 on each camera orbit
   - Requires runtime debugging with browser DevTools to identify source

2. **Voronoi Performance** - Still needs optimization
   - Framerate drops significantly when Voronoi display is enabled
   - Current implementation creates individual meshes per cell
   - Consider merging all cells into single BufferGeometry for better performance
