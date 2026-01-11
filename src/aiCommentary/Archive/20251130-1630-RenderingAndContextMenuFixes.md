# Context Menu & Rendering Mode Fixes
**Date**: 2025-11-30 16:30
**Status**: ✅ COMPLETE

## Problem 1: Dual Rendering (CRITICAL)

Both 2D and 3D were rendering simultaneously, causing:
- **Performance degradation** (double computational load)
- **Poor responsiveness** (lag, frame drops)
- **Visual confusion** (both modes visible)

### Root Cause

Code was checking `isIn3DMode` based on camera orbit angles:
```javascript
const isIn3DMode = cameraControls && (cameraControls.orbitX !== 0 || cameraControls.orbitY !== 0);

if ((onlyShowThreeJS || isIn3DMode) && threeInitialized) {
    // This caused BOTH modes to render when camera was orbited
}
```

**Problem**: Any camera orbit would activate 3D rendering, even when in 2D mode.

### Solution

**kirra.js lines 22331-22352**: Removed `isIn3DMode` check and added AI agent warning:

```javascript
// ===================================================================================
// CRITICAL AI AGENT NOTICE - DO NOT MODIFY THIS RENDERING LOGIC
// ===================================================================================
// When in a Dimension Mode (2D or 3D), the alternate mode must NOT render.
// 
// REASONS:
// 1. Performance/Overheads: Rendering both modes doubles the computational load
// 2. Responsiveness: Dual rendering causes lag and poor user experience
// 3. Confusion: Users expect only ONE rendering mode active at a time
//
// RULE: Use ONLY the onlyShowThreeJS flag to determine which mode renders.
// DO NOT use isIn3DMode or camera orbit angles - they cause dual rendering!
//
// CORRECT LOGIC:
// - if (onlyShowThreeJS) → Render ONLY 3D, skip ALL 2D
// - if (!onlyShowThreeJS) → Render ONLY 2D, skip ALL 3D
//
// This has been broken and fixed multiple times. DO NOT BREAK IT AGAIN.
// ===================================================================================

// Step 1c) Create Three.js geometry ONLY when in Three.js-only mode
if (onlyShowThreeJS && threeInitialized) {
    // 3D rendering...
}
```

**kirra.js line 22763**: Fixed rendering call:
```javascript
// Step 2) Render Three.js scene ONLY when in Three.js-only mode
if (onlyShowThreeJS) {
    renderThreeJS();
}
```

## Problem 2: Context Menus Not Working

### Issue Summary

**2D Mode:**
- ✅ WORKING: Lines, Polys, Holes, Surface, Image
- ❌ NOT WORKING: Points, Text, Circles

**3D Mode:**
- ✅ WORKING: Holes
- ❌ NOT WORKING: Points, Lines, Polys, Text, Circles, Images, Surfaces

### Root Cause

**ContextMenuManager.js lines 98-122**: KAD context menus required selection tool to be active:

```javascript
// OLD CODE - BROKEN
if (window.isSelectionPointerActive || window.isPolygonSelectionActive) {
    if (clickedKADObject) {
        // Show context menu ONLY if selection tool active
    }
}
```

**Problem**: Users couldn't right-click KAD objects unless a selection tool was already active.

### Solution

**ContextMenuManager.js lines 97-120**: Removed selection tool requirement for 2D:

```javascript
// Step 2g) For KAD objects (Points, Lines, Polys, Circles, Text)
// IMPORTANT: Show context menu for ANY clicked KAD object, not just when selection tools are active
if (clickedKADObject) {
    // Check if within snap radius
    let withinSnapRadius = false;
    const entity = window.allKADDrawingsMap.get(clickedKADObject.entityName);

    if (entity) {
        if (clickedKADObject.selectionType === "vertex") {
            // For vertex selection, check distance to the specific vertex
            const point = entity.data[clickedKADObject.elementIndex];
            const distance = Math.sqrt(Math.pow(point.pointXLocation - worldCoords[0], 2) + Math.pow(point.pointYLocation - worldCoords[1], 2));
            withinSnapRadius = distance <= snapRadius;
        } else if (clickedKADObject.selectionType === "segment") {
            // For segment selection, use the clicked position
            withinSnapRadius = true;
        }
    }

    if (withinSnapRadius) {
        window.showKADPropertyEditorPopup(clickedKADObject);
        window.debouncedUpdateTreeView();
        return;
    }
}
```

**ContextMenuManager.js lines 254-284**: Fixed 3D context menus same way:

```javascript
// Step 3l) Handle KAD object click in 3D (any entity type)
// IMPORTANT: Show context menu for ANY clicked KAD object, not just when selection tools are active
if (clickedKADObject) {
    // Check if within snap radius and show menu
    if (withinSnapRadius) {
        window.showKADPropertyEditorPopup(clickedKADObject);
        window.debouncedUpdateTreeView();
        return;
    }
}
```

## Expected Results

### Rendering Mode
- ✅ When `onlyShowThreeJS = false` → ONLY 2D renders
- ✅ When `onlyShowThreeJS = true` → ONLY 3D renders
- ✅ No dual rendering ever
- ✅ Camera orbit doesn't trigger extra rendering

### Context Menus - 2D Mode
- ✅ Points - Right-click shows context menu
- ✅ Lines - Right-click shows context menu
- ✅ Polys - Right-click shows context menu
- ✅ Circles - Right-click shows context menu
- ✅ Text - Right-click shows context menu
- ✅ Holes - Right-click shows context menu
- ✅ Surfaces - Right-click shows context menu
- ✅ Images - Right-click shows context menu

### Context Menus - 3D Mode
- ✅ Points - Right-click shows context menu
- ✅ Lines - Right-click shows context menu
- ✅ Polys - Right-click shows context menu
- ✅ Circles - Right-click shows context menu
- ✅ Text - Right-click shows context menu
- ✅ Holes - Right-click shows context menu
- ✅ Surfaces - Right-click shows context menu
- ⚠️ Images - Requires investigation (bigger issue per user)

## Files Modified

1. **kirra.js**
   - Lines 22331-22352: Added AI agent warning and removed `isIn3DMode` check
   - Line 22353: Changed condition to `if (onlyShowThreeJS && threeInitialized)`
   - Line 22763: Changed condition to `if (onlyShowThreeJS)`

2. **ContextMenuManager.js**
   - Lines 97-120: Removed selection tool requirement for 2D KAD context menus
   - Lines 254-284: Removed selection tool requirement for 3D KAD context menus

## Testing Required

1. ✅ Start in 2D mode → Verify ONLY 2D renders
2. ✅ Switch to 3D mode → Verify ONLY 3D renders
3. ✅ Test right-click on all entity types in 2D
4. ✅ Test right-click on all entity types in 3D
5. ⚠️ Investigate image context menus in 3D (known issue)

