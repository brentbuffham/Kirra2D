# Three.js Only Mode Empty Canvas Fix

## Problem

When "Only Show Three.js" checkbox was checked, the canvas appeared completely empty (gray background) with no holes, surfaces, or any geometry visible. The z-index swapping was working correctly, but no Three.js geometry was being created.

## Root Cause

**Three.js geometry creation was inside the 2D canvas conditional block.**

### Code Flow (Before Fix)

```javascript
function drawData(allBlastHoles, selectedHole) {
    clearThreeJS();

    if (ctx && !onlyShowThreeJS) {
        // This entire block skipped when onlyShowThreeJS = true

        clearCanvas();
        drawBackgroundImage(); // ❌ Skipped
        drawSurface(); // ❌ Skipped (includes drawSurfaceThreeJS)

        for (const hole of allBlastHoles) {
            drawHoleMainShape(hole, x, y, selectedHole); // 2D canvas
            drawHoleThreeJS(hole); // ❌ Skipped!
        }
    }

    renderThreeJS(); // ✅ Renders... but scene is empty!
}
```

**The Problem**: When `onlyShowThreeJS = true`, the condition `ctx && !onlyShowThreeJS` evaluates to `false`, so the entire block is skipped. This means:

-   `drawHoleThreeJS(hole)` is never called → No hole geometry in Three.js
-   `drawSurface()` (which calls `drawSurfaceThreeJS()`) is never called → No surfaces
-   `drawBackgroundImage()` is never called → No background images

The `renderThreeJS()` call at the end renders an empty scene!

## Solution

### Create Separate Three.js-Only Rendering Block

Added a new conditional block that runs ONLY when `onlyShowThreeJS = true` to create Three.js geometry:

```javascript
function drawData(allBlastHoles, selectedHole) {
    clearThreeJS();

    // 2D canvas rendering (skipped when onlyShowThreeJS = true)
    if (ctx && !onlyShowThreeJS) {
        clearCanvas();
        drawBackgroundImage();
        drawSurface();

        for (const hole of allBlastHoles) {
            drawHoleMainShape(hole, x, y, selectedHole);
            drawHoleThreeJS(hole); // Three.js geometry created here
        }
    }

    // NEW: Three.js-only rendering block (lines 19115-19130)
    if (onlyShowThreeJS && threeInitialized) {
        // Draw background images
        drawBackgroundImage();

        // Draw surfaces (includes Three.js rendering)
        drawSurface();

        // Draw holes
        if (allBlastHoles && Array.isArray(allBlastHoles) && allBlastHoles.length > 0) {
            for (const hole of allBlastHoles) {
                if (hole.visible === false) continue;
                drawHoleThreeJS(hole); // Three.js geometry created here
            }
        }
    }

    renderThreeJS(); // Now renders populated scene!
}
```

### Key Changes (kirra.js Lines 19113-19130)

1. **Check for Three.js-only mode**: `if (onlyShowThreeJS && threeInitialized)`
2. **Call drawBackgroundImage()**: Ensures background images render in Three.js
3. **Call drawSurface()**: Includes Three.js surface rendering
4. **Loop through holes**: Call `drawHoleThreeJS(hole)` for each visible hole

## Implementation Details

### Dual Rendering Strategy

**Mode 1: Both Visible (`onlyShowThreeJS = false`)**

```
2D Canvas Block Runs:
  - clearCanvas()
  - drawBackgroundImage()
  - drawSurface() → creates both 2D and Three.js geometry
  - for each hole:
      - drawHoleMainShape() → 2D canvas
      - drawHoleThreeJS() → Three.js

Three.js-Only Block: ❌ Skipped

renderThreeJS() → Renders Three.js geometry created above
```

**Mode 2: Three.js Only (`onlyShowThreeJS = true`)**

```
2D Canvas Block: ❌ Skipped

Three.js-Only Block Runs:
  - drawBackgroundImage()
  - drawSurface() → creates Three.js geometry (2D canvas still drawn but hidden)
  - for each hole:
      - drawHoleThreeJS() → Three.js

renderThreeJS() → Renders Three.js geometry created above
```

### Why Not Refactor drawSurface()?

**Question**: Why call `drawSurface()` which draws to both 2D canvas AND Three.js, instead of creating a separate `drawSurfaceThreeJSOnly()` function?

**Answer**: Simplicity and maintainability

-   `drawSurface()` already calls `drawSurfaceThreeJS()` first
-   The 2D canvas drawing still happens but is invisible (opacity: 0)
-   Minimal code changes required
-   Single source of truth for surface rendering logic
-   Can be optimized later if performance is a concern

## Performance Considerations

### Current Approach

**Three.js-Only Mode** currently:

1. ✅ Skips most 2D canvas drawing
2. ❌ Still draws surfaces to 2D canvas (but hidden)
3. ✅ Creates all Three.js geometry
4. ✅ Renders only Three.js

**Performance Impact**: Minor

-   Hidden 2D canvas surface drawing wastes a bit of CPU
-   Not noticeable for typical datasets (< 1000 holes)
-   Can be optimized later if needed

### Future Optimization

If performance becomes an issue:

```javascript
function drawSurface() {
    allSurfaces.forEach((surface, surfaceId) => {
        // Always create Three.js geometry
        drawSurfaceThreeJS(surfaceId, surface.triangles, ...);

        // Only draw 2D canvas if not in Three.js-only mode
        if (!onlyShowThreeJS) {
            surface.triangles.forEach((triangle) => {
                drawTriangleWithGradient(triangle, ...);
            });
        }
    });
}
```

## Testing Verification

### Before Fix

**Symptom**: Empty gray canvas

```
✅ Console: "🎨 Showing only Three.js rendering"
✅ Console: "📊 Layers: Three.js (z:2, top), 2D canvas (z:0, hidden)"
✅ Z-index correct
✅ renderThreeJS() called
❌ NO geometry visible
❌ Empty scene
```

### After Fix

**Expected**: Holes and surfaces visible

```
✅ Console: "🎨 Showing only Three.js rendering"
✅ Console: "📊 Layers: Three.js (z:2, top), 2D canvas (z:0, hidden)"
✅ Z-index correct
✅ renderThreeJS() called
✅ Holes visible (circles + lines)
✅ Surfaces visible (if loaded)
✅ Background images visible (if loaded)
```

## What You Should See Now

### Three.js Only Mode (Checkbox Checked)

1. **Holes**:

    - ✅ Collar circles (colored)
    - ✅ Black lines (collar → grade)
    - ✅ Red lines (grade → toe)
    - ✅ Positioned correctly

2. **Surfaces** (if loaded):

    - ✅ Triangulated mesh
    - ✅ Elevation gradient colors
    - ✅ Correct transparency

3. **Background Images** (if loaded):

    - ✅ Visible as texture-mapped planes

4. **UI**:
    - ❌ No text labels (2D canvas hidden)
    - ❌ No hole IDs
    - ✅ Pure WebGL rendering

### Both Visible Mode (Checkbox Unchecked)

1. **Everything from above** PLUS:
2. **2D Canvas Overlays**:
    - ✅ Text labels
    - ✅ Hole IDs
    - ✅ Coordinates
    - ✅ UI elements

## Debug Commands

```javascript
// In browser console:

// Check if geometry is being created
threeRenderer.holeMeshMap.size;
// Should show: number of holes loaded

// Check scene contents
threeRenderer.scene.children;
// Should show: lights, groups (holesGroup, surfacesGroup, etc.)

// Check holes group
threeRenderer.holesGroup.children.length;
// Should match number of visible holes

// Check if rendering
threeRenderer.needsRender;
// Should be: true when scene updates

// Manual render
renderThreeJS();
```

## Troubleshooting

### Still Empty After Fix

**Check**:

```javascript
// Are holes loaded?
allBlastHoles.length; // Should be > 0

// Is Three.js initialized?
threeInitialized; // Should be true

// Is onlyShowThreeJS true?
onlyShowThreeJS; // Should be true

// Is the block executing?
// Add console.log in the Three.js-only block to verify
```

### Holes Visible But Surfaces Not

**Check**:

```javascript
// Are surfaces loaded?
allSurfaces.size; // Should be > 0

// Check surface rendering
drawSurface(); // Manually call

// Check Three.js surfaces group
threeRenderer.surfacesGroup.children.length; // Should be > 0
```

### Duplicate Geometry When Toggling

**Symptom**: Seeing double holes after toggling checkbox

**Cause**: `clearThreeJS()` not working properly

**Fix**: Ensure `clearThreeJS()` is called at the start of `drawData()`

## Files Changed

-   **src/kirra.js**:
    -   Line 19113-19130: Added Three.js-only rendering block
    -   Creates geometry for holes, surfaces, and backgrounds when in Three.js-only mode
    -   Prevents empty scene issue

## Related Documentation

-   **THREEJS_TOGGLE_FIX.md**: Z-index swapping and layer management
-   **THREEJS_ONLY_MODE.md**: Original toggle feature
-   **LOCAL_COORDINATES_FIX.md**: Coordinate system for precision
