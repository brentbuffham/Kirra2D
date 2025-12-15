# 3D Camera Resize Scale Fix - Fixed Frustum in resize() Method

**Date**: 2025-12-15 12:15  
**Issue**: 3D camera resize() method was still using old scale-based frustum calculation, causing jittery movement  
**Fix**: Changed resize() to use fixed frustum + camera.zoom, matching updateCamera() approach  

## Problem

The `updateCamera()` method was correctly updated on 2024-12-15 to use fixed frustum with `camera.zoom` property (see `20251215-0000-3D_TRANSFORM_NOT_SCALE_FIX.md`). However, the `resize()` method still used the old incorrect approach:

```javascript
// BEFORE - WRONG: Scales frustum size in resize()
const scale = this.cameraState.scale;
const viewportWidthInWorldUnits = width / scale;
const viewportHeightInWorldUnits = height / scale;

this.camera.left = -viewportWidthInWorldUnits / 2;
this.camera.right = viewportWidthInWorldUnits / 2;
this.camera.top = viewportHeightInWorldUnits / 2;
this.camera.bottom = -viewportHeightInWorldUnits / 2;
```

**Why this causes jitter:**
- When canvas is resized, the frustum bounds would change based on the current scale
- This creates inconsistent frustum sizes between resize() and updateCamera()
- With large UTM coordinates, varying frustum sizes cause floating-point precision errors
- The jitter is especially noticeable during pan/zoom operations after a resize

## User Instructions Reference

From project rules:
- "Data used in this application can be very large values. It is often UTM. 2D approach is to transform the data based on the data centroid. The data centroid is 0,0 and the XY needs to be transformed. Do not scale the 3D use the same 2D transform."
- "Do not scale the 3D transform. Use the same XY transform as 2D."

## Solution

Updated `resize()` method (ThreeRenderer.js lines 707-725) to use fixed frustum:

```javascript
// AFTER - CORRECT: Fixed frustum + camera.zoom
const frustumWidth = width;
const frustumHeight = height;

this.camera.left = -frustumWidth / 2;
this.camera.right = frustumWidth / 2;
this.camera.top = frustumHeight / 2;
this.camera.bottom = -frustumHeight / 2;

// camera.zoom already set in updateCamera(), just update projection matrix
this.camera.updateProjectionMatrix();
```

**Benefits:**
- ✓ Consistent frustum calculation between resize() and updateCamera()
- ✓ Fixed frustum size eliminates floating-point precision errors
- ✓ camera.zoom property handles all scaling (set by updateCamera())
- ✓ No jitter when panning/zooming after resize
- ✓ Matches 2D approach: transform first (worldToThreeLocal), then zoom (camera.zoom)

## Implementation Consistency

Both methods now use the same approach:

### updateCamera() - lines 285-307
```javascript
const frustumWidth = this.width;
const frustumHeight = this.height;

this.camera.left = -frustumWidth / 2;
this.camera.right = frustumWidth / 2;
this.camera.top = frustumHeight / 2;
this.camera.bottom = -frustumHeight / 2;

this.camera.zoom = scale;  // <-- Sets zoom
this.camera.updateProjectionMatrix();
```

### resize() - lines 707-725
```javascript
const frustumWidth = width;
const frustumHeight = height;

this.camera.left = -frustumWidth / 2;
this.camera.right = frustumWidth / 2;
this.camera.top = frustumHeight / 2;
this.camera.bottom = -frustumHeight / 2;

// camera.zoom already set, just update projection
this.camera.updateProjectionMatrix();
```

## Testing Verification

To verify the fix:
1. Load data with large UTM coordinates (e.g., 500,000+ meters)
2. Resize browser window multiple times
3. Pan and zoom after each resize
4. Movement should be smooth with no jitter
5. 3D and 2D views should behave consistently

## Related Files

- `ThreeRenderer.js` - Fixed resize() method (lines 707-725)
- `CameraControls.js` - Already correct (uses this.scale properly)
- `20251215-0000-3D_TRANSFORM_NOT_SCALE_FIX.md` - Original updateCamera() fix

## Key Principle

**DO NOT SCALE THE FRUSTUM. USE FIXED FRUSTUM + CAMERA.ZOOM.**

This matches the 2D approach:
1. **Transform** geometry to local coordinates (worldToThreeLocal)
2. **Zoom** using camera.zoom property (not frustum scaling)
3. **Position** camera at centroid (camera.position)

