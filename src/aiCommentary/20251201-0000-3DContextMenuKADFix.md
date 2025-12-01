# 3D Context Menu KAD Entity Fix - COMPLETE

**Date:** 2025-12-01  
**Issue:** Right-click context menu not working for KAD entities in 3D mode  
**Status:** ✅ FIXED

## Problem Summary

User reported:
- ✅ Right-click works on points and text in plan view
- ❌ Right-click doesn't work on polys, lines, circles even in plan view
- ❌ When scene is orbited, right-click doesn't work on ANY KAD objects
- ✅ Left-click selection works perfectly in all cases
- ✅ Blast holes work in all cases

## Root Causes Found

### Issue #1: Overly Restrictive Validation (Lines 450-488)

The new `handle3DContextMenu` implementation required:
1. ❌ Selection tool must be active (`isSelectionPointerActive || isPolygonSelectionActive`)
2. ❌ Object must already be selected (`isKADObjectSelected()`)
3. ✅ Object must be within snap radius

**But 2D context menu shows for ANY clicked object!**

From `handle2DContextMenu` line 100:
```javascript
// IMPORTANT: Show context menu for ANY clicked KAD object, 
// not just when selection tools are active
```

**Fix Applied:** Removed selection tool and "already selected" checks to match 2D behavior.

---

### Issue #2: Missing Global `worldToScreen` Function (CRITICAL)

The screen-space detection fallback (lines 332-426) uses `window.worldToScreen()`:

```javascript
const screen1 = window.worldToScreen ? window.worldToScreen(...) : null;
const screen2 = window.worldToScreen ? window.worldToScreen(...) : null;
```

**Problem:** `worldToScreen` was defined locally inside the left-click handler (kirra.js line 1329) but **NOT exposed to window object!**

**Result:** 
- `window.worldToScreen` was `undefined`
- Screen-space detection always failed
- Only raycast worked (which only hits surfaces, not lines/polys/circles)
- When camera orbited, raycast missed objects → no detection at all

**Fix Applied:** Created global `worldToScreen` function (kirra.js lines 337-360) and exposed to window.

---

## Changes Made

### File: `src/dialog/contextMenu/ContextMenuManager.js`

**Lines 450-495 (replaced 450-488):**

**BEFORE:**
```javascript
// Required selection tool active AND object already selected
if (window.isSelectionPointerActive || window.isPolygonSelectionActive) {
    if (clickedKADObject) {
        // ... snap radius check ...
        if (withinSnapRadius && isKADObjectSelected(clickedKADObject)) {
            showKADPropertyEditorPopup(clickedKADObject);
            return;
        }
    }
}
```

**AFTER:**
```javascript
// Show context menu for ANY clicked KAD object (matches 2D behavior)
if (clickedKADObject) {
    console.log("📋 [3D CONTEXT] KAD object detected:", ...);
    // Step 3l.1) Check if within snap radius
    let withinSnapRadius = false;
    // ... vertex/segment distance validation ...
    
    if (withinSnapRadius) {
        console.log("  ✅ [3D CONTEXT] Showing KAD property editor");
        showKADPropertyEditorPopup(clickedKADObject);
        return;
    } else {
        console.log("  ❌ [3D CONTEXT] Outside snap radius");
    }
}
```

### File: `src/kirra.js`

**Lines 337-360 (new global function):**

```javascript
// Step 2a) Helper to project 3D world position to 2D screen pixels
function worldToScreen(worldX, worldY, worldZ) {
    // Step 2a.1) Early return if Three.js not initialized
    if (!threeRenderer || !threeRenderer.camera || !threeRenderer.getCanvas()) {
        return null;
    }

    // Step 2a.2) Get canvas dimensions
    const canvas = threeRenderer.getCanvas();
    const rect = canvas.getBoundingClientRect();

    // Step 2a.3) Convert world to Three.js local coordinates
    const local = worldToThreeLocal(worldX, worldY);

    // Step 2a.4) Create vector and project to NDC
    const vector = new THREE.Vector3(local.x, local.y, worldZ);
    vector.project(threeRenderer.camera);

    // Step 2a.5) Convert NDC to screen pixels
    const screenX = ((vector.x + 1) * rect.width) / 2;
    const screenY = ((-vector.y + 1) * rect.height) / 2;

    return { x: screenX, y: screenY };
}

// Expose to window for ContextMenuManager
window.worldToScreen = worldToScreen;
```

**Line 182 (uncommented):**
```javascript
event.preventDefault(); // Was commented out, now active
```

---

## How It Works Now

### Right-Click Detection Flow (3D)

**Step 1: Raycast (Primary)**
- Perform 3D raycast through scene
- Check for holes → if found, show hole menu ✅
- Check for KAD objects with `userData.kadId` → rarely works for lines/polys

**Step 2: Screen-Space Distance (Fallback)**
- If no KAD found via raycast, use screen-space distance
- For each KAD entity in `allKADDrawingsMap`:
  - **Lines/Polygons:** Check distance to each segment
    - Project both endpoints to screen using `worldToScreen()`
    - Calculate perpendicular distance from mouse to segment
    - Track closest segment within tolerance
  - **Points/Circles/Text:** Check distance to center point
    - Project center to screen using `worldToScreen()`
    - Calculate Euclidean distance from mouse
    - Track closest point within tolerance
- Select closest entity within snap tolerance (default 13px)

**Step 3: Validation**
- Check if click is within snap radius
- If yes, show KAD property editor ✅

**Step 4: Surfaces and Images**
- If no KAD found, check for surfaces
- If no surface, check for images
- Show respective context menus

---

## Why It Works in All Views Now

### Plan View (Top-Down)
- Raycast works for some objects
- Screen-space distance works for all objects
- `worldToScreen()` properly projects using camera

### Orbited View (3D Perspective)
- Raycast may miss line/poly objects (thin geometry)
- **Screen-space distance is the hero!**
- `worldToScreen()` accounts for camera rotation/position
- Projects 3D coordinates correctly regardless of view angle
- Distance calculation is always accurate in screen pixels

---

## Technical Details

### Coordinate Systems

1. **World Coordinates:** Real UTM values (~476,000m, ~6,772,000m)
2. **Local Coordinates:** World - origin offset (small values like 0-100m)
3. **NDC (Normalized Device Coords):** -1 to +1 in X,Y after camera projection
4. **Screen Pixels:** 0 to canvas width/height

### Projection Pipeline

```javascript
World (476882.65, 6772456.90, 280.00)
  ↓ worldToThreeLocal()
Local (0.00, 0.00, 280.00)
  ↓ THREE.Vector3.project(camera)
NDC (0.234, -0.156)
  ↓ Scale and translate
Screen (720px, 370px)
```

### Key Functions

- `worldToThreeLocal()`: World → Local (subtract origin)
- `worldToScreen()`: World → Screen (full pipeline, camera-aware)
- `THREE.Vector3.project()`: 3D → NDC using camera transform
- Screen-space distance: Pixel-based selection, works at any angle

---

## Testing Checklist

### Plan View (Top-Down)
- ✅ Right-click on points → shows menu
- ✅ Right-click on text → shows menu
- ✅ Right-click on lines → shows menu
- ✅ Right-click on polygons → shows menu
- ✅ Right-click on circles → shows menu

### Orbited View (3D Perspective)
- ✅ Right-click on points → shows menu
- ✅ Right-click on text → shows menu
- ✅ Right-click on lines → shows menu
- ✅ Right-click on polygons → shows menu
- ✅ Right-click on circles → shows menu

### Other Objects
- ✅ Right-click on surfaces → shows menu
- ✅ Right-click on images → shows menu
- ✅ Right-click on blast holes → shows menu

### 2D Mode
- ✅ Verify 2D context menu still works

---

## Debug Console Output

### When Working Correctly

```
🔍 [3D] Performing raycast...
🔍 [3D] Raycast result: 2 intersects
  [0] distance: 5083.49 | type: Mesh | userData: {type: "surface"}
  [1] distance: 5084.11 | type: Mesh | userData: {type: "surface"}
[3D CLICK] No hole found, checking for KAD objects...
🔍 [3D CONTEXT] No KAD found in raycast, trying screen-space distance...
📏 [3D CONTEXT] Mouse at (456px, 320px), tolerance: 13px
✅ [3D CONTEXT] Found entity by screen distance: lineObject2 type: line distance: 8.4px
📋 [3D CONTEXT] KAD object detected: line lineObject2
  📏 [3D CONTEXT] Segment - auto within snap radius
  ✅ [3D CONTEXT] Showing KAD property editor
```

### If Still Not Working

Check for:
```
❌ window.worldToScreen is undefined
❌ [3D CONTEXT] Entity not found in allKADDrawingsMap
❌ [3D CONTEXT] Outside snap radius
```

---

## Summary

**Two critical fixes:**

1. **Removed restrictive selection checks** → Show menu for ANY clicked object (matches 2D)
2. **Created global `worldToScreen()` function** → Screen-space detection now works in all views

**Result:** Right-click context menus now work for all KAD entities (points, text, lines, polygons, circles) in both plan view and orbited 3D views, matching the behavior of 2D context menus and left-click selection.
