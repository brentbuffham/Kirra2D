# 3D Camera Transform Fix - Use Transform Not Scale

**Date**: 2024-12-15  
**Issue**: 3D camera controls were using scale to adjust frustum size, causing jittery movement with large UTM coordinates
**Fix**: Changed to use fixed frustum with camera.zoom property, matching 2D transform approach
**Additional Fix**: Updated `getSnapRadiusInWorldUnits3D()` to account for camera.zoom in snap radius calculation

## Problem

The 3D camera system was adjusting the orthographic frustum size based on the `scale` parameter:

```javascript
// BEFORE - WRONG: Scales frustum size
const viewportWidthInWorldUnits = this.width / scale;
const viewportHeightInWorldUnits = this.height / scale;

this.camera.left = -viewportWidthInWorldUnits / 2;
this.camera.right = viewportWidthInWorldUnits / 2;
this.camera.top = viewportHeightInWorldUnits / 2;
this.camera.bottom = -viewportHeightInWorldUnits / 2;
```

**Why this causes jitter with large UTM coordinates:**
- Large UTM coordinates (e.g., 500,000 meters) combined with varying frustum sizes causes floating-point precision errors
- The frustum bounds change with every zoom level, requiring recalculation of projection matrix
- Geometry coordinates remain large (even after worldToThreeLocal translation), and varying frustum creates inconsistent precision

## User Instructions Reference

From project rules:
- "Data used in this application can be very large values. It is often UTM. 2D approach is to transform the data based on the data centroid. The data centroid is 0,0 and the XY needs to be transformed. Do not scale the 3D use the same 2D transform."
- "Do not scale the 3D transform. Use the same XY transform as 2D."

## 2D Approach (Correct Reference)

```javascript
// kirra.js line 21679-21680
function worldToCanvas(x, y) {
    return [(x - centroidX) * currentScale + canvas.width / 2, 
            (-y + centroidY) * currentScale + canvas.height / 2];
}
```

**2D transformation steps:**
1. **Translate** to local coordinates: `(x - centroidX)`
2. **Scale** for zoom: `* currentScale`
3. **Offset** to canvas center: `+ canvas.width / 2`

## Solution

Changed 3D camera to use **fixed frustum** with **camera.zoom** property (ThreeRenderer.js lines 285-312):

```javascript
// AFTER - CORRECT: Fixed frustum + camera.zoom
const frustumWidth = this.width;
const frustumHeight = this.height;

this.camera.left = -frustumWidth / 2;
this.camera.right = frustumWidth / 2;
this.camera.top = frustumHeight / 2;
this.camera.bottom = -frustumHeight / 2;

// Apply zoom using camera.zoom property
this.camera.zoom = scale;

this.camera.updateProjectionMatrix();
```

**3D transformation steps (now matches 2D):**
1. **Translate** geometry via `worldToThreeLocal()`: `x - threeLocalOriginX` ✓ (already done)
2. **Scale** for zoom via projection: `camera.zoom = scale` ✓ (now fixed)
3. **Position** camera at centroid: `camera.position.set(centroidX, centroidY, z)` ✓ (already done)

## How camera.zoom Works

Three.js OrthographicCamera.zoom property:
- **zoom = 1.0**: Default, shows frustum as defined
- **zoom = 2.0**: Zoomed in 2x (shows half the frustum area, objects appear 2x larger)
- **zoom = 0.5**: Zoomed out 2x (shows double the frustum area, objects appear 2x smaller)

This is mathematically equivalent to:
```
Effective frustum = Original frustum / zoom
```

So `camera.zoom = scale` with fixed frustum is equivalent to the old `frustum / scale` approach, but:
- ✓ Better precision (frustum bounds don't change)
- ✓ Faster (no frustum recalculation, only zoom matrix update)
- ✓ Matches 2D approach exactly (transform first, then scale)

## Coordinate System Comparison

### 2D Canvas (kirra.js)
```
World coords (UTM) → Local coords → Scale → Screen coords
  (500000, 600000) → (0, 0)       → *scale → (canvas.width/2, canvas.height/2)
  
Translation: (x - centroidX)
Zoom: * currentScale
```

### 3D Three.js (ThreeRenderer.js - AFTER fix)
```
World coords (UTM) → Local coords → Camera projection with zoom → Screen coords
  (500000, 600000) → (0, 0)       → frustum * camera.zoom     → (canvas.width/2, canvas.height/2)
  
Translation: worldToThreeLocal() [x - threeLocalOriginX]
Zoom: camera.zoom = scale
```

Both approaches now use:
1. **Transform to local** (subtract centroid/origin)
2. **Apply zoom** (multiply by scale factor)
3. **Position relative to viewport** (camera at centroid)

## Benefits

1. **Smooth movement**: Fixed frustum eliminates precision errors from varying bounds
2. **Matches 2D**: Same transformation pipeline as 2D canvas
3. **CAD-appropriate**: Transform-based approach standard for CAD applications with large coordinates
4. **Performance**: camera.zoom updates are faster than frustum bound changes

## Follow-up Fix: Snap Radius Calculation

After changing to `camera.zoom`, the snap radius calculation needed updating because it was calculating based on frustum size alone, not accounting for zoom.

**Problem**: Cursor sphere (snap tolerance indicator) was massive because `getSnapRadiusInWorldUnits3D()` didn't account for `camera.zoom`.

**Fix** (kirra.js line 36755-36768):

```javascript
// BEFORE - Wrong: Doesn't account for camera.zoom
const worldUnitsPerPixelX = frustumWidth / canvasWidth;
const worldUnitsPerPixelY = frustumHeight / canvasHeight;

// AFTER - Correct: Divides by zoom
const zoom = camera.zoom || 1.0;
const worldUnitsPerPixelX = frustumWidth / canvasWidth / zoom;
const worldUnitsPerPixelY = frustumHeight / canvasHeight / zoom;
```

**Why this matters**:
- With fixed frustum, `frustumWidth / canvasWidth` is now constant
- But effective visible area = `frustum / zoom`
- So world units per pixel = `frustumWidth / canvasWidth / zoom`
- Now cursor sphere correctly represents snap tolerance in screen pixels (e.g., 5px) regardless of zoom

## Testing

Test with:
- Large UTM coordinates (e.g., 500,000+ meters)
- Various zoom levels (scale from 0.1 to 100)
- Pan, zoom, and orbit operations in 3D mode
- Verify smooth, non-jittery camera movement

Expected: Smooth, precise camera controls at all zoom levels and coordinate ranges.

