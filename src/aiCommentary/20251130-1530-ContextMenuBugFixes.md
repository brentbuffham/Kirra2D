# Context Menu Bug Fixes - Variable Scope Issues
## Date: 20251130-1530
## Author: AI Assistant

## Issues Fixed

### 1. ReferenceError: cameraControls is not defined
**Location**: ContextMenuManager.js:162  
**Cause**: External script files don't have access to kirra.js global variables  
**Solution**: Changed all direct variable references to use `window.` prefix

### 2. ReferenceError: longPressTimeout is not defined
**Location**: ContextMenuManager.js:16  
**Cause**: Same issue - external script can't access kirra.js variables  
**Solution**: Added window. prefix and safety checks

## Changes Made to ContextMenuManager.js

### Before:
```javascript
isDragging = false;
clearTimeout(longPressTimeout);
const anyKADToolActive = addPointDraw.checked || addLineDraw.checked...
```

### After:
```javascript
if (typeof window.isDragging !== "undefined") {
    window.isDragging = false;
}
if (typeof window.longPressTimeout !== "undefined") {
    clearTimeout(window.longPressTimeout);
}
const anyKADToolActive = window.addPointDraw.checked || window.addLineDraw.checked...
```

## Complete List of Variables Now Using window. Prefix

### 2D Context Menu (handle2DContextMenu):
- window.isDragging
- window.longPressTimeout
- window.addPointDraw, addLineDraw, addCircleDraw, addPolyDraw, addTextDraw
- window.canvas
- window.clearCurrentDrawingEntity
- window.getClickedHole
- window.getClickedKADObject
- window.getSnapToleranceInWorldUnits
- window.canvasToWorld
- window.selectedMultipleKADObjects
- window.allKADDrawingsMap
- window.showMultipleKADPropertyEditor
- window.debouncedUpdateTreeView
- window.selectedMultipleHoles
- window.showHolePropertyEditor
- window.isSelectionPointerActive
- window.isPolygonSelectionActive
- window.isKADObjectSelected
- window.showKADPropertyEditorPopup
- window.isPointInSurface
- window.showSurfaceContextMenu
- window.loadedImages
- window.isPointInBackgroundImage
- window.showImageContextMenu
- window.showContextMenu
- window.updateStatusMessage

### 3D Context Menu (handle3DContextMenu):
- window.onlyShowThreeJS
- window.cameraControls
- window.threeInitialized
- window.threeRenderer
- window.interactionManager
- window.allBlastHoles
- window.getClickedKADObject3D
- (All other variables same as 2D)

### KAD Context Menu (kadContextMenu):
- window.createNewEntity
- window.lastKADDrawPoint
- window.drawData
- window.allBlastHoles
- window.selectedHole

### Helper Function (closeAllContextMenus):
- window.debouncedUpdateTreeView

## Why This Fix Was Necessary

When scripts are loaded externally (like our context menu files), they don't automatically have access to variables defined in kirra.js. The `window` object is the global scope in browsers, so by attaching variables to `window` in kirra.js and accessing them via `window.` in external scripts, we create a proper connection between the modules.

## Testing Notes

After this fix:
- Context menus should work in both 2D and 3D modes
- No more ReferenceError messages in console
- Right-click detection should function correctly
- All context menu types (Holes, KAD, Surfaces, Images) should appear

## 3D Rendering Issue

The user also mentioned "3D is rendering below the 2D canvas until a mode swap is conducted". This is likely a z-index or canvas layering issue in the CSS or initialization order, not related to the context menu refactoring. This may need to be investigated separately.

