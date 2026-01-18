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
- [ ] Fix move tool 3D visual updates during drag (code in place but may need verification)
- [ ] Fix shapefile highlight Z position matching actual geometry
- [ ] Fix CSV import not showing 3D immediately (may need investigation)
- [ ] Fix entities not removed from 3D when TreeView delete applied
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
| CSV import: 3D shows imported holes immediately | ❌ | Needs investigation |
| DXF import: 3D shows imported geometry immediately | ✅ | Working |
| Shapefile import: 3D shows imported geometry immediately | ✅ | But TreeView delete doesn't remove from 3D |
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

### TreeView Delete Not Removing 3D Geometry
- When entities are deleted via TreeView, the 3D geometry remains
- Need to add `threeDataNeedsRebuild = true` to TreeView delete handlers
- May need to explicitly remove geometry from scene

### CSV Import 3D Update
- CSV import may have a code path that doesn't trigger 3D rebuild
- Need to verify all CSV import completion paths set the flag

### Voronoi Performance
- Even with cleanup working, Voronoi display causes framerate drop
- Consider implementing true geometry batching (merge all cells into single BufferGeometry)
- Current implementation creates individual meshes per cell

---

## Next Steps

1. Retest connector 3D updates after the fix
2. Investigate geometry leak during orbit
3. Add threeDataNeedsRebuild to TreeView delete handlers
4. Verify CSV import all paths
5. Consider Voronoi geometry batching for performance

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
