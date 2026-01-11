# Coordinate Precision Fix - Matching 2D Canvas Transformation

## Problem

Three.js geometry was not aligning with the 2D canvas rendering. The holes and other elements appeared in the wrong positions or at the wrong scale, causing precision issues.

## Root Cause

**Mismatch between 2D canvas and Three.js coordinate transformations.**

### 2D Canvas Approach (kirra.js Line 18297-18299)

```javascript
function worldToCanvas(x, y) {
    return [(x - centroidX) * currentScale + canvas.width / 2, (-y + centroidY) * currentScale + canvas.height / 2];
}
```

This transformation means:

1. **Translate** by `-centroidX, -centroidY` (center on view)
2. **Scale** by `currentScale`
3. **Flip Y** (canvas has Y-down, world has Y-up)
4. **Translate** to center of canvas

**Key insight**: The viewport shows `canvas.width / currentScale` world units horizontally.

### Three.js Original Approach (WRONG)

```javascript
// BEFORE - WRONG
const frustumSize = 1000 / scale; // Fixed size, not viewport-relative!
this.camera.left = (-frustumSize * aspect) / 2;
this.camera.right = (frustumSize * aspect) / 2;
```

**Problems**:

-   Fixed frustum size (1000 units) didn't match viewport size
-   Didn't account for canvas dimensions
-   Scale factor applied incorrectly

## Solution

### Updated Three.js Camera (ThreeRenderer.js Line 102-135)

```javascript
updateCamera(centroidX, centroidY, scale, rotation = 0) {
    // Position camera to look at centroid
    this.camera.position.x = centroidX;
    this.camera.position.y = centroidY;
    // Z stays at 1000 (fixed distance)

    // Calculate viewport size in world units
    const viewportWidthInWorldUnits = this.width / scale;
    const viewportHeightInWorldUnits = this.height / scale;

    // Set orthographic bounds
    this.camera.left = -viewportWidthInWorldUnits / 2;
    this.camera.right = viewportWidthInWorldUnits / 2;
    this.camera.top = viewportHeightInWorldUnits / 2;
    this.camera.bottom = -viewportHeightInWorldUnits / 2;

    this.camera.updateProjectionMatrix();
}
```

### Key Changes

1. **Viewport-relative frustum**: `viewportWidth / scale` instead of fixed 1000
2. **Correct world unit mapping**: 1 world unit = scale pixels (matches 2D canvas)
3. **Proper aspect ratio**: Uses actual canvas dimensions
4. **Camera positioning**: Moves to centroid position, looks down -Z axis

### Coordinate System Alignment

```
2D Canvas Transform:           Three.js Camera:
┌─────────────────────┐       ┌─────────────────────┐
│ World coordinates:  │  ←→   │ World coordinates:  │
│ (worldX, worldY)    │       │ (worldX, worldY, 0) │
│                     │       │                     │
│ Centered at:        │  ←→   │ Camera looks at:    │
│ (centroidX,         │       │ (centroidX,         │
│  centroidY)         │       │  centroidY, 0)      │
│                     │       │                     │
│ Scale:              │  ←→   │ Frustum:            │
│ currentScale        │       │ width/scale units   │
│ pixels per world    │       │ height/scale units  │
│ unit                │       │                     │
└─────────────────────┘       └─────────────────────┘
```

## Verification

### Expected Behavior

1. **Holes align**: Three.js circles match 2D canvas circles exactly
2. **Same zoom level**: Zooming affects both layers identically
3. **Same pan**: Panning moves both layers together
4. **Precision**: No floating-point errors with large UTM coordinates

### Test in Console

```javascript
// 1. Check camera state
cameraControls.getCameraState();
// Should show: { centroidX: X, centroidY: Y, scale: S, rotation: 0 }

// 2. Check camera bounds
threeRenderer.camera.left;
threeRenderer.camera.right;
threeRenderer.camera.top;
threeRenderer.camera.bottom;
// Should be: ±(canvas.width or height / scale) / 2

// 3. Verify world-to-screen for a known hole
const hole = allBlastHoles[0];
const [canvasX, canvasY] = worldToCanvas(hole.startXLocation, hole.startYLocation);
console.log("2D canvas pos:", canvasX, canvasY);
// Three.js mesh should be at hole.startXLocation, hole.startYLocation in world space
// and project to the same canvas position
```

### Visual Verification

1. **Load holes** - should see:

    - Red test square at center
    - Black collar circles exactly aligned with 2D canvas circles
    - Black/red lines (collar→grade→toe) in correct positions

2. **Zoom in/out**:

    - Both layers zoom together
    - No drift or misalignment
    - Precise positioning at all zoom levels

3. **Pan around**:
    - Both layers move together
    - Holes stay aligned
    - No coordinate overflow

## Technical Details

### Why This Works

**Orthographic Camera Frustum**: Defines a rectangular box in world space that maps to the screen.

```
Screen coordinates (pixels):     World coordinates:
    0,0 ──────────► W,0         left,top ──────► right,top
     │               │              │                 │
     │    Canvas     │              │   Frustum       │
     │               │              │                 │
    0,H ──────────► W,H         left,bottom ─► right,bottom

Mapping: screen_x = (world_x - camera_x + right) / (right - left) * canvas_width
```

For our setup:

-   `right - left = viewportWidthInWorldUnits = canvas.width / scale`
-   Camera at `(centroidX, centroidY, 1000)`
-   So world point `(centroidX + 1, centroidY)` appears `scale` pixels to the right of center

This exactly matches the 2D canvas formula:

-   `canvasX = (worldX - centroidX) * scale + canvas.width / 2`
-   When `worldX = centroidX + 1`: `canvasX = scale + canvas.width / 2` ✓

### Handling Large Coordinates

UTM coordinates can be millions of meters (e.g., `500000, 6000000`). By positioning the camera at the centroid and using relative frustum bounds, we avoid floating-point precision issues:

-   Camera at `(500000, 6000000, 1000)` looking at `(500000, 6000000, 0)`
-   Frustum `±100` world units from camera position
-   Objects rendered relative to camera, not absolute origin
-   Maintains sub-millimeter precision even with km-scale coordinates

## Files Changed

-   **src/three/ThreeRenderer.js**:
    -   Line 102-135: `updateCamera()` - Fixed frustum calculation
    -   Line 138-155: `resize()` - Fixed resize frustum calculation
    -   Added detailed comments explaining coordinate transformation

## Related Fixes

-   **THREEJS_TIMING_FIX.md**: Initialization timing
-   **RESTORATION_FIX.md**: Canvas layering and interaction
-   **CAMERA_CONTROLS_FIX.md**: Camera controls and event handling
