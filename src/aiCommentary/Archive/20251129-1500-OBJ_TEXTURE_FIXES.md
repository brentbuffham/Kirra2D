# OBJ Texture and 2D/3D Rendering Fixes

## Date
2025-11-29 15:00 (Updated 15:30)

## Overview

Fixed multiple issues with OBJ/MTL/JPG texture loading, 2D flattened image display, GeoTIFF Z elevation in 3D, 3D cursor positioning, and migrated surface context menu to FloatingDialog.

## Changes Made

### 1. Fix Texture Loading Reliability (kirra.js lines ~7520-7620)

**Problem:** `materials.preload()` does not wait for textures to load - `TextureLoader.load()` is async. Also, the code relied on `mat.map.sourceFile` which may not exist in MTLLoader parsed materials.

**Solution:** Completely rewrote texture loading approach:

- Pre-load ALL texture blobs into a `loadedTextures` map before parsing OBJ
- Use `extractTextureRefsFromMTL()` to get texture filenames directly from MTL content
- After OBJ parsing, traverse mesh and apply textures directly to materials
- Added `texture.flipY = true` for standard UV convention
- Added extensive logging for debugging texture loading
- Applied same fix to `rebuildTexturedMesh()` function

### 2. Fix Flattened Image Format (kirra.js lines ~7934-7996)

**Problem:** `flattenTexturedMeshToImage()` stored `dataURL` string and `bounds` object, but drawing functions expected `canvas` (HTMLCanvasElement) and `bbox` (array format).

**Solution:** 
- Create HTMLCanvasElement from rendered image
- Store `canvas` property with actual canvas element
- Store `bbox` in array format `[minX, minY, maxX, maxY]`
- Added `zElevation` property initialized to `drawingZLevel`
- Used `img.onload` callback to ensure image is loaded before storing

### 3. Add Z Elevation Parameter for Images (GeometryFactory.js, canvas3DDrawing.js)

**Problem:** Image plane Z position was hardcoded to -100.

**Solution:**
- Added `zElevation` parameter to `GeometryFactory.createImagePlane()`
- Priority: explicit zElevation > drawingZLevel > dataCentroidZ > 0
- Updated `drawBackgroundImageThreeJS()` to accept and pass zElevation
- Updated both calls in kirra.js to pass `image.zElevation`

### 4. Fix 3D Cursor View Plane (InteractionManager.js, kirra.js)

**Problem:** Cursor was stuck on XY plane when not raycasting an object.

**Solution:** Added prominent AGENT NOTEs to prevent future reversions:

```javascript
//=============================================================================
// AGENT NOTE - DO NOT REVERT THIS FUNCTION OR ITS USAGE
//=============================================================================
// This function returns mouse position on a plane PERPENDICULAR to the camera
// view direction. This is the CORRECT method for 3D cursor positioning when
// NOT raycasting an object.
//
// DO NOT replace calls to getMouseWorldPositionOnViewPlane() with 
// getMouseWorldPositionOnPlane() for cursor/torus positioning.
//
// getMouseWorldPositionOnViewPlane() = plane perpendicular to camera (CORRECT)
// getMouseWorldPositionOnPlane() = horizontal XY plane at Z level (WRONG for cursor)
//=============================================================================
```

### 5. Migrate Surface Context Menu to FloatingDialog (kirra.js lines ~27125-27315)

**Problem:** Raw DOM manipulation for surface context menu was inconsistent with other dialogs. Buttons were too narrow and slider didn't match app styling.

**Solution:** Completely rewrote `showSurfaceContextMenu()`:

**Buttons:**
- Full-width buttons with proper padding (10px 16px)
- Consistent styling with hover effects
- Three action buttons: Hide/Show, Remove Surface, Delete All Surfaces

**Transparency Slider:**
- Custom styled range slider matching app theme
- Red gradient fill showing current value
- Value display next to slider (e.g., "75%")
- Real-time updates on slide

**Gradient Options:**
- Added "Texture (Original)" option for textured meshes
- Dropdown select for all gradient options
- Textured OBJs can now use elevation-based gradients

**Other Controls:**
- Checkbox for Show/Hide Legend
- All controls have real-time updates

### 6. Textured Mesh Gradient Support (canvas3DDrawing.js)

**Problem:** Textured OBJs could only display with their original texture, not elevation-based color gradients.

**Solution:** Modified `drawSurfaceThreeJS()`:
- Added check for `gradient === "texture"` or `gradient === "default"` to use texture rendering
- If gradient is set to hillshade/viridis/turbo/etc., falls through to standard triangle rendering
- Deep cloning of materials to preserve texture references
- Improved material cloning with `needsUpdate = true`

### 7. FloatingDialog handleOutsideClick Fix (kirra.js + FloatingDialog.js)

**Problem:** Error `this.element is null` when clicking outside a dialog that was already closed.

**Solution:**
- Added null guard in `handleOutsideClick()`: `if (!this.element) return;`
- Fixed event listener cleanup by storing bound function reference:
  - Changed `document.addEventListener("click", this.handleOutsideClick.bind(this))` 
  - To: `this.handleOutsideClickBound = this.handleOutsideClick.bind(this); document.addEventListener("click", this.handleOutsideClickBound);`
- This ensures proper cleanup in `close()` method

### 8. Image Context Menu Migration (kirra.js)

**Problem:** Image context menu used raw DOM manipulation, inconsistent with Surface context menu.

**Solution:** Rewrote `showImageContextMenu()` to use FloatingDialog:
- Full-width styled buttons matching Surface context menu
- Transparency slider with red gradient fill and percentage display
- Z Elevation input for 3D positioning
- Real-time updates for all controls
- Proper event cleanup and dialog positioning

### 9. Flattened Image Texture Cloning (kirra.js)

**Problem:** Flattened 2D images showing as blank because texture references weren't preserved during mesh cloning.

**Solution:** In `flattenTexturedMeshToImage()`:
- Deep traverse the cloned mesh
- Clone each material individually
- Preserve texture references: `clonedMat.map = originalMat.map`
- Set `needsUpdate = true` and `side = THREE.DoubleSide`

### 10. Window Function Exposure Fix (kirra.js)

**Problem:** `window.showSurfaceContextMenu is not a function` error when right-clicking surfaces from tree view.

**Solution:** Added to `exposeGlobalsToWindow()`:
```javascript
// Step 6c) Expose context menu functions for tree view and 3D interactions
window.showSurfaceContextMenu = showSurfaceContextMenu;
window.showImageContextMenu = showImageContextMenu;
```

### 11. Floating-Point Precision Fix for Textured Meshes (canvas3DDrawing.js, kirra.js)

**Problem:** Textured OBJ meshes had jittery/hunting edges during rotation, while gradient-colored surfaces were crisp. This was caused by large world coordinates (e.g., 478000, 6772000) causing GPU floating-point precision issues.

**Root Cause:** The code was only offsetting the mesh GROUP position, but the actual vertex positions in the geometry buffer still contained large world coordinates. GPU shaders have limited floating-point precision, causing jitter.

**Solution in `drawSurfaceThreeJS()` (canvas3DDrawing.js):**
- Transform ACTUAL VERTEX POSITIONS, not just group position
- Subtract `threeLocalOriginX/Y` from each vertex coordinate
- Same transformation approach as 2D canvas and non-textured surfaces
- Call `positions.needsUpdate = true` and recompute bounding volumes

**Solution in `flattenTexturedMeshToImage()` (kirra.js):**
- Calculate local bounds by subtracting origin from mesh bounds
- Use local coordinates for camera frustum (OrthographicCamera)
- Transform cloned mesh vertex positions to local coordinates
- This ensures the offscreen render doesn't suffer precision issues

**Key Code:**
```javascript
// Transform vertex positions from world to local coordinates
var originX = window.threeLocalOriginX || 0;
var originY = window.threeLocalOriginY || 0;

if (child.geometry && child.geometry.attributes.position) {
    var posArray = child.geometry.attributes.position.array;
    for (var i = 0; i < posArray.length; i += 3) {
        posArray[i] -= originX;     // X
        posArray[i + 1] -= originY; // Y
        // Z stays unchanged
    }
    positions.needsUpdate = true;
    child.geometry.computeBoundingBox();
    child.geometry.computeBoundingSphere();
}
```

### 12. Flattening Coordinate Fix (kirra.js)

**Problem:** Flattened 2D image had content in top-left corner instead of centered. This was because the flattening used `threeLocalOriginX/Y` which might be 0 or set from unrelated data.

**Solution:** Use mesh's OWN center as origin for flattening:
```javascript
var meshCenterX = (meshBounds.minX + meshBounds.maxX) / 2;
var meshCenterY = (meshBounds.minY + meshBounds.maxY) / 2;
var halfWidth = worldWidth / 2;
var halfHeight = worldHeight / 2;

// Symmetric camera frustum centered at origin
var camera = new THREE.OrthographicCamera(
    -halfWidth, halfWidth, halfHeight, -halfHeight, -10000, 10000
);
camera.position.set(0, 0, meshBounds.maxZ + 1000);

// Transform vertices to center at origin
posArray[i] -= meshCenterX;
posArray[i + 1] -= meshCenterY;
```

### 13. Textured Mesh Support in Centroid Functions (kirra.js)

**Problem:** Camera not looking at textured mesh because centroid calculations didn't include OBJ meshes.

**Solution:** Updated three functions:

1. **`updateThreeLocalOrigin()`**: Added check for `isTexturedMesh && meshBounds`
2. **`updateCentroids()`**: Added mesh center to centroid sum for textured meshes
3. **`calculateDataZCentroid()`**: Added mesh Z bounds for textured meshes

### 14. Fixed drawSurface for Textured Meshes (kirra.js)

**Problem:** Textured meshes (OBJ files) weren't showing in 3D mode because `drawSurface()` required `surface.triangles` and `surface.points`, but textured meshes use `meshBounds` and `threeJSMesh` instead.

**Solution:** Added early handling for textured meshes in `drawSurface()`:
```javascript
// Handle textured meshes (OBJ files) separately
if (surface.isTexturedMesh && surface.threeJSMesh) {
    let surfaceMinZ = surface.meshBounds ? surface.meshBounds.minZ : 0;
    let surfaceMaxZ = surface.meshBounds ? surface.meshBounds.maxZ : 100;
    drawSurfaceThreeJS(surfaceId, surface.triangles || [], surfaceMinZ, surfaceMaxZ, 
                       surface.gradient || "texture", surface.transparency || 1.0, surface);
    return; // Textured meshes don't have 2D triangle rendering
}
```

### 15. Increased Flattened Image Resolution (kirra.js)

**Problem:** Flattened 2D image had poor resolution (max 2048px).

**Solution:** Increased resolution parameters for ~300 DPI equivalent:
- Max resolution: 4096px (was 2048px)
- Min resolution: 1024px (was 256px)
- Target: 15 pixels per meter (for mine site data)

### 16. Separated 2D and 3D Rendering (kirra.js)

**Problem:** Both 2D and 3D rendering were occurring simultaneously at startup and in 2D mode, causing overlapping renders and the 3D surface to appear under the 2D canvas.

**Solution:** Modified rendering logic to enforce strict separation:
1. **Removed 3D calls from 2D block** (lines 21311-21321): Removed `drawBackgroundImageThreeJS` and `drawSurfaceThreeJS` calls that were inside the `!onlyShowThreeJS` block
2. **Updated `drawSurface()`** to check rendering mode:
   - Added `should3DRender = threeInitialized && (onlyShowThreeJS || isIn3DMode)` check
   - Only calls `drawSurfaceThreeJS` when `should3DRender` is true
   - For textured meshes with "texture" or "default" gradient, only renders 3D mesh when in 3D mode
   - For other gradients (hillshade, viridis, terrain), uses standard triangle rendering with color gradients
3. **Added debug logging** to track rendering decisions and gradient usage

**Result:**
- In 2D-only mode: Only 2D canvas renders, no 3D geometry added
- In 3D-only mode: Only 3D WebGL renders, no 2D canvas drawing
- Textured meshes can use either original texture ("texture"/"default") or elevation-based gradients (all others)

## Files Modified

1. **kirra.js** - Texture loading, flattened image format, cursor AGENT NOTE, surface context menu, window function exposure, vertex coordinate transformation for flattening, centroid functions for textured meshes, drawSurface fix for textured meshes, increased image resolution, separated 2D/3D rendering
2. **GeometryFactory.js** - Added zElevation parameter to createImagePlane
3. **canvas3DDrawing.js** - Updated drawBackgroundImageThreeJS signature, vertex coordinate transformation for 3D rendering, added debug logging
4. **InteractionManager.js** - Added AGENT NOTE for view plane function

## Testing Notes

1. Load OBJ + MTL + JPG files - textures should appear correctly (not black)
2. Switch to 2D mode - flattened texture image should be visible
3. Load GeoTIFF/images - should appear at drawingZLevel elevation in 3D
4. Rotate camera in 3D - cursor should follow view plane, not be stuck on XY
5. Right-click surface - FloatingDialog should appear with slider and controls

