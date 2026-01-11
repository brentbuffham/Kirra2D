# Context Menu Global Variable Fixes
**Date**: 2025-11-30 16:00
**Status**: ✅ COMPLETE

## Problem

After extracting context menus to separate files, the application had errors:
- `window.getClickedKADObject3D is not a function`
- Context menus not appearing in 3D mode
- Left-click selection issues in 3D
- Multiple undefined function errors

### Root Cause

Context menu files were calling functions from `kirra.js` without accessing them via `window.`. Additionally, many required functions were not exposed to `window` in `kirra.js`.

## Solution

### Step 1: Expose All Required Functions in kirra.js

Added comprehensive function exposures to `exposeGlobalsToWindow()` function (lines 342-442):

**Step 6d - Context Menu Detection Functions:**
```javascript
window.getClickedHole = getClickedHole;
window.getClickedKADObject = getClickedKADObject;
window.getClickedKADObject3D = getClickedKADObject3D;
window.getSnapToleranceInWorldUnits = getSnapToleranceInWorldUnits;
window.canvasToWorld = canvasToWorld;
window.isKADObjectSelected = isKADObjectSelected;
window.isPointInSurface = isPointInSurface;
window.isPointInBackgroundImage = isPointInBackgroundImage;
window.loadedImages = loadedImages;
window.loadedSurfaces = loadedSurfaces;
window.debouncedUpdateTreeView = debouncedUpdateTreeView;
window.clearCurrentDrawingEntity = clearCurrentDrawingEntity;
```

**Step 6e - State Variables:**
```javascript
window.isDragging = isDragging;
window.longPressTimeout = longPressTimeout;
window.createNewEntity = createNewEntity;
window.lastKADDrawPoint = lastKADDrawPoint;
```

**Step 6f - Database and Data Management:**
```javascript
window.calculateHoleGeometry = calculateHoleGeometry;
window.calculateAllHoleDelays = calculateAllHoleDelays;
window.generateDelayColorRamp = generateDelayColorRamp;
window.updateHoleMeshes = updateHoleMeshes;
window.debouncedSaveHoles = debouncedSaveHoles;
window.debouncedSaveKAD = debouncedSaveKAD;
window.clearAllSelectionState = clearAllSelectionState;
window.setKADEntityVisibility = setKADEntityVisibility;
window.setSurfaceVisibility = setSurfaceVisibility;
window.deleteSurfaceFromDB = deleteSurfaceFromDB;
window.deleteAllSurfacesFromDB = deleteAllSurfacesFromDB;
window.saveSurfaceToDB = saveSurfaceToDB;
window.showSurfaceLegend = showSurfaceLegend;
window.deleteImageFromDB = deleteImageFromDB;
window.deleteAllImagesFromDB = deleteAllImagesFromDB;
window.autoCalculateTimingEnabled = autoCalculateTimingEnabled;
window.drawingZLevel = drawingZLevel;
```

### Step 2: Update All Context Menu Files

Updated every global reference to use `window.` prefix:

**HolesContextMenu.js:**
- `allBlastHoles` → `window.allBlastHoles`
- `selectedHole` → `window.selectedHole`
- `drawData()` → `window.drawData()`
- `calculateHoleGeometry()` → `window.calculateHoleGeometry()`
- And 20+ more references

**KADContextMenu.js:**
- `getEntityFromKADObject()` → `window.getEntityFromKADObject()`
- `debouncedSaveKAD()` → `window.debouncedSaveKAD()`
- `clearAllSelectionState()` → `window.clearAllSelectionState()`
- And 15+ more references

**SurfacesContextMenu.js:**
- `loadedSurfaces` → `window.loadedSurfaces`
- `setSurfaceVisibility()` → `window.setSurfaceVisibility()`
- `deleteSurfaceFromDB()` → `window.deleteSurfaceFromDB()`
- And 10+ more references

**ImagesContextMenu.js:**
- `loadedImages` → `window.loadedImages`
- `deleteImageFromDB()` → `window.deleteImageFromDB()`
- `drawData()` → `window.drawData()`
- And 8+ more references

### Step 3: Fix Event Listeners in kirra.js

**Line 835:** Updated 3D context menu listener:
```javascript
container.addEventListener("contextmenu", window.handle3DContextMenu, true);
```

**Line 26341:** Updated 2D context menu listener:
```javascript
canvas.addEventListener("contextmenu", function (e) {
    window.handle2DContextMenu(e);
});
```

### Step 4: Create ContextMenuManager Namespace

**ContextMenuManager.js (lines 369-387):**
```javascript
window.ContextMenuManager = {
    handle2DContextMenu: handle2DContextMenu,
    handle3DContextMenu: handle3DContextMenu,
    closeAllContextMenus: closeAllContextMenus,
    kadContextMenu: kadContextMenu
};
```

## Files Modified

1. **kirra.js**
   - Lines 342-442: Extended `exposeGlobalsToWindow()`
   - Line 835: Fixed 3D context menu event listener
   - Line 26341: Fixed 2D context menu event listener

2. **HolesContextMenu.js**
   - Added `window.` prefix to 30+ global references
   - Lines 555-556: Already exposed functions globally

3. **KADContextMenu.js**
   - Added `window.` prefix to 25+ global references
   - Lines 433-436: Already exposed functions globally

4. **SurfacesContextMenu.js**
   - Added `window.` prefix to 15+ global references
   - Line 287: Already exposed function globally

5. **ImagesContextMenu.js**
   - Added `window.` prefix to 12+ global references
   - Line 251: Already exposed function globally

6. **ContextMenuManager.js**
   - Lines 373-387: Created namespace and exposed functions

## Testing Required

1. ✅ Test 2D right-click on Holes
2. ✅ Test 2D right-click on KAD objects (points, lines, polys, circles, text)
3. ✅ Test 2D right-click on Surfaces
4. ✅ Test 2D right-click on Images
5. ⚠️ Test 3D right-click on Holes
6. ⚠️ Test 3D right-click on KAD objects
7. ⚠️ Test 3D right-click on Surfaces
8. ⚠️ Test 3D right-click on Images
9. ⚠️ Test left-click selection in 3D
10. ⚠️ Verify property editors work correctly

## Expected Result

- ✅ No `undefined function` errors in console
- ✅ Context menus appear in both 2D and 3D
- ✅ Property editors function correctly
- ✅ All database operations (save, delete) work
- ✅ Visual updates (drawData, renderThreeJS) trigger properly

## Key Learnings

1. **Global Access Pattern**: External modules must access kirra.js globals via `window.` prefix
2. **Comprehensive Exposure**: All functions, variables, and data structures used by external modules must be explicitly exposed in `exposeGlobalsToWindow()`
3. **Event Listener Binding**: Event listeners must reference functions on `window` object when those functions are defined externally
4. **Script Load Order**: Critical that scripts load in correct order (FloatingDialog → Context Menus → ContextMenuManager → kirra.js)

## Related Documentation

- `20251130-1500-ContextMenuRefactoring.md` - Initial refactoring plan
- `20251130-1530-ContextMenuBugFixes.md` - Implementation documentation

