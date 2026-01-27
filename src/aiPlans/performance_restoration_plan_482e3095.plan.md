---
name: Performance Restoration Plan
overview: "Restore smooth 15,000-hole performance in both 2D and 3D. Key optimizations: Vector Font batching (45K text objects to 3 draw calls), Frustum Culling + LOD for 3D smoothness, conditional render loops, and bug fixes for cursor zoom, raycasting, and surface snapping."
todos:
  - id: matrix-fix
    content: Add camera.updateMatrixWorld(true) and updateProjectionMatrix() before ALL raycasting in InteractionManager.js
    status: pending
  - id: surface-snap-fix
    content: Disable cached Z feature in surface snapping - rely only on raycast hits
    status: pending
  - id: cursor-zoom-fix
    content: Fix Plan View cursor zoom - use rect.width instead of canvas.width in CameraControls.js
    status: pending
  - id: stop-render-loop
    content: "Conditional render: Stop 3D loop in 2D mode, stop CameraControls.animate() when idle in 3D mode"
    status: pending
  - id: measured-tools-fix
    content: Simplify measured length/mass/comment click handlers in kirra.js
    status: pending
  - id: mouse-logic-cleanup
    content: Consolidate multi-branch mouse indicator position logic
    status: pending
  - id: dummy-batching
    content: Add X-shape and square batching to InstancedMeshManager.js
    status: pending
  - id: vector-font
    content: Create VectorFont.js with Hershey Simplex data and super-batched line text rendering
    status: pending
  - id: frustum-culling
    content: Add frustum culling to skip rendering holes outside camera view
    status: pending
  - id: lod-system
    content: Add Level of Detail system - simplify/hide distant holes based on screen pixel size
    status: pending
isProject: false
---

# Performance Restoration Plan for Kirra2D

This plan restores smooth performance with 15,000+ holes by implementing targeted optimizations from the stashed changes, plus addressing the continuous render loop issue.

---

## Problem Analysis

### Root Cause: Excessive Background Draw Calls

The current `CameraControls.js` has an "always running" animation loop (line 1088-1136) that never stops:

```javascript
// Line 1136 in CameraControls.js
this.animationFrameId = requestAnimationFrame(this.animate);
```

Combined with ThreeRenderer's render loop, this causes continuous rendering even when:

- Only 2D canvas is visible
- No user interaction is occurring
- Camera is stationary

The reference file (`for-reference-kirra.js`) only uses `requestAnimationFrame` for specific tasks like contour updates, not continuous rendering.

---

## HOW 15,000 Holes Will Render Smoothly

### Draw Call Budget Analysis

| Component | Current (15K holes) | After Optimization | Reduction |

|-----------|---------------------|-------------------|-----------|

| **Hole Text Labels** (ID, Dia, Len) | ~45,000 Troika texts | **3** LineSegments (batched) | 15,000x |

| **Hole Circles** (collar, grade, toe) | ~6 InstancedMesh | ~6 InstancedMesh | Same |

| **Hole Body Lines** | ~15,000 Lines | **~10** batched LineSegments | 1,500x |

| **Dummy Holes** (X shapes) | 1 per dummy | **1** total | Variable |

| **Zero-Diameter** (squares) | 1 per zero-dia | **1** total | Variable |

| **Connectors/Arrows** | Already batched | Already batched | Same |

| **TOTAL DRAW CALLS** | ~60,000+ | **<50** | >1,000x |

### 3D-Specific Optimizations (Zoom/Pan/Orbit)

| Optimization | When Zoomed In (close) | When Zoomed Out (far) |

|--------------|------------------------|----------------------|

| **Frustum Culling** | Skip 30-70% holes outside view | Skip 0% (all visible) |

| **LOD System** | Full detail for visible holes | 15K holes → 1 `THREE.Points` draw call |

| **Vector Font** | ~3 batched LineSegments | ~1 batched LineSegments (IDs only or none) |

| **Combined Effect** | ~20 draw calls | ~5 draw calls |

**Zoomed Out Scenario (15,000 holes at < 5px each):**

- ALL 15,000 collar positions → **1** `THREE.Points` geometry (2px dots)
- Body lines batched → **1-2** LineSegments
- No labels (too small to read anyway)
- **TOTAL: ~3-5 draw calls for entire scene**

**Target: 60fps (16ms frame time) during all 3D interactions**

### Conditional Render Loop Strategy

**2D-Only Mode (`onlyShowThreeJS === false`):**

- ThreeRenderer render loop: **STOPPED** completely
- CameraControls animation: **STOPPED** completely  
- 2D canvas: Redraws only on `drawData()` calls (pan, zoom, data change)
- CPU usage: Near zero when idle

**3D Mode (`onlyShowThreeJS === true`):**

- ThreeRenderer render loop: **RUNNING** but respects `needsRender` flag
- CameraControls animation: **CONDITIONAL** - only runs when:
  - `hasVelocity` (momentum damping active)
  - `isDragging`, `isOrbiting`, or `isRotating` (user interacting)
- When camera is stationary: Loop stops, restarts on next mouse/wheel event

**Mode Switching:**

```javascript
// When switching TO 3D mode:
if (onlyShowThreeJS) {
    threeRenderer.startRenderLoop();
    // CameraControls.animate() starts on first interaction
}

// When switching TO 2D mode:
if (!onlyShowThreeJS) {
    threeRenderer.stopRenderLoop();
    cameraControls.resetStateFlags(); // Stops animate loop
}
```

### Vector Font Super-Batching Architecture

Instead of creating 45,000 individual text objects:

```
FRAME START
  ├── Collect all text requests: { x, y, z, text, size, color }[]
  ├── Build single Float32Array of line vertices for ALL text
  ├── Create ONE BufferGeometry with all vertices
  ├── Create ONE LineSegments mesh
  └── Add to scene
FRAME END: 1 draw call for ALL text
```

**Font Data:** Hershey Simplex embedded directly in `VectorFont.js` (~50KB)

- Each glyph is an array of [x,y] line segments
- Glyphs scaled and positioned at render time
- No texture atlas, no async loading, no GPU texture memory

### Why This Works

1. **GPU Batching**: Modern GPUs are optimized for few large draw calls, not many small ones
2. **CPU Overhead**: Each draw call has ~0.1-1ms CPU overhead; 60,000 calls = 6-60 seconds/frame
3. **Memory**: Troika creates texture per text; vector font uses pure geometry
4. **Idle Efficiency**: No render = no GPU/CPU usage when nothing changes

---

## Priority Changes to Implement

### 1. Vector Font (Hershey Simplex) - NEW FEATURE

**Purpose:** Replace expensive Troika text with batched line geometry (10-40x faster)

**Files to Create/Modify:**

- `src/three/VectorFont.js` (NEW) - Hershey Simplex font data and rendering
- `src/three/GeometryFactory.js` - Add `createVectorText()` and `createVectorTextFixed()`
- `src/draw/canvas2DDrawing.js` - Add vector text option for 2D
- `src/draw/canvas3DDrawing.js` - Use vector text for hole labels
- `kirra.html` - Add "Vector Text (Hershey)" toggle checkbox

**Key Implementation:**

- **Embedded Font Data:** Hershey Simplex glyphs embedded directly in VectorFont.js (~50KB)
- Each glyph stored as array of [x,y] line segment pairs
- Batch ALL text in frame into single LineSegments geometry = 1 draw call
- Add `window.useVectorText` global flag (default: true)
- Super-batch architecture:

  1. Collect all text requests during frame: `{x, y, z, text, size, color}[]`
  2. Build single Float32Array of ALL line vertices
  3. Create ONE BufferGeometry, ONE LineSegments mesh
  4. Result: 45,000 labels → 1-3 draw calls

### 2. Dummy Hole and Zero-Diameter Batching - PERFORMANCE

**Purpose:** Reduce thousands of individual X-shape and square draw calls to 1-2 total

**Files to Modify:**

- `src/three/InstancedMeshManager.js` - Add batching for X-shapes and squares

**Key Implementation:**

- Add `dummyHoleIndexMap` and `zeroDiameterIndexMap` tracking
- Batch X-shapes (dummy holes) into single LineSegments
- Batch squares (zero-diameter holes) into single LineSegments
- Similar pattern to existing `lineBatches` system

### 8. Cursor Zoom Fix - BUG FIX

**Purpose:** Fix Plan View cursor zoom using correct canvas dimensions

**Files to Modify:**

- `src/three/CameraControls.js` - Lines 300-380

**Current Bug (lines 314-318):**

```javascript
const worldX = (mouseX - canvas.width / 2) / oldScale + this.centroidX;
```

**Fix:** Use `rect.width` instead of `canvas.width`:

```javascript
const worldX = (mouseX - rect.width / 2) / oldScale + this.centroidX;
```

Also add `cursorZoom` setting toggle to enable/disable cursor-following zoom.

### 11. Measured Tools Behavior - BUG FIX

**Purpose:** Simplify click handlers for measured length/mass/comment

**Files to Modify:**

- `src/kirra.js` - Search for measured tool handlers

**Implementation:**

- When switch is ON and hole clicked: select hole and show popup
- Remove the previous "if switch OFF, set fromHoleStore" logic
- Simplify the conditional branching

### 12. InteractionManager Matrix Update Fix - BUG FIX

**Purpose:** Fix "facing south" raycasting bug due to stale camera matrices

**Files to Modify:**

- `src/three/InteractionManager.js` - Before ALL raycasting operations

**Key Fix (add before every `this.raycaster.setFromCamera()`):**

```javascript
// CRITICAL: Update camera matrices before raycasting
// Without this, raycasting fails when camera is facing south
// DO NOT REMOVE - has been incorrectly reverted multiple times
this.camera.updateMatrixWorld(true);
this.camera.updateProjectionMatrix();
```

**Locations to update:**

- `raycast()` method (line ~49)
- `getMouseWorldPositionOnViewPlane()` method (line ~340)
- `getMouseWorldPositionOnPlane()` method (line ~415)

### 13. Surface Snap - Disabled Cached Z - BUG FIX

**Purpose:** Fix false snaps when mouse is NOT over surface

**Files to Modify:**

- `src/kirra.js` - Surface snapping logic

**Implementation:**

- Disable the cached Z feature for surface snapping
- Was causing false snaps based on old/stale Z values
- Now rely only on actual raycast hits (no fallback to cached position)

### 14. Mouse Indicator Logic Cleanup - CLEANUP

**Purpose:** Simplify the multi-branch indicator position logic

**Files to Modify:**

- `src/kirra.js` - Mouse indicator/cursor logic

**Implementation:**

- Consolidate the verbose multi-branch position logic
- Remove redundant developer mode logging
- Add cursor debug info to Performance Monitor instead

---

## Additional Critical Fix: Conditional Render Loop Strategy

**Purpose:** Stop 3D render loop entirely in 2D mode; use needsRender flag in 3D mode

**Files to Modify:**

- `src/three/CameraControls.js` - `animate()`, `attachEvents()`, `detachEvents()`
- `src/three/ThreeRenderer.js` - `startRenderLoop()`, `stopRenderLoop()`
- `src/kirra.js` - Mode switching logic (search for `onlyShowThreeJS`)

### Part A: CameraControls.animate() - Stop When Idle in 3D Mode

**Current Problem (line 1136):**

```javascript
// ALWAYS continues, never stops
this.animationFrameId = requestAnimationFrame(this.animate);
```

**Fix - Only continue if there's work to do:**

```javascript
animate() {
    // Apply damping to velocities...
    
    if (hasVelocity) {
        // Update camera positions...
        this.threeRenderer.updateCamera(...);
    }
    
    // CONDITIONAL: Only continue loop if needed
    if (hasVelocity || this.isDragging || this.isOrbiting || this.isRotating) {
        this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
        // STOP loop - no velocity, no interaction
        this.animationFrameId = null;
    }
}
```

### Part B: Restart Loop on User Interaction

Add to `handleMouseDown()` and `handleWheel()`:

```javascript
// Restart animation loop if it was stopped
if (this.animationFrameId === null) {
    this.animationFrameId = requestAnimationFrame(this.animate);
}
```

### Part C: Mode Switching - Stop 3D When in 2D Mode

In `kirra.js` where `onlyShowThreeJS` is toggled:

```javascript
function setViewMode(is3D) {
    onlyShowThreeJS = is3D;
    
    if (is3D) {
        // Start 3D rendering
        threeRenderer.startRenderLoop();
    } else {
        // STOP 3D rendering entirely - critical for 2D performance
        threeRenderer.stopRenderLoop();
        if (cameraControls) {
            cameraControls.resetStateFlags(); // Stops CameraControls animate loop
        }
    }
}
```

This ensures **zero GPU/CPU usage** from Three.js when working in 2D-only mode.

---

## 3D Smoothness Optimizations (Zoom/Pan/Orbit)

### Frustum Culling - Skip Holes Outside View

**Purpose:** Don't waste GPU cycles on holes that aren't visible

**Files to Modify:**

- `src/three/ThreeRenderer.js` or `src/draw/canvas3DDrawing.js`

**Implementation:**

```javascript
// Before rendering holes, check if they're in view
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();
projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
frustum.setFromProjectionMatrix(projScreenMatrix);

// For each hole group or instanced mesh:
if (!frustum.containsPoint(holePosition)) {
    // Skip this hole - it's outside the view
    continue;
}
```

**For InstancedMesh:** Set instance matrix to far away (-999999) for culled holes, or use visibility flags.

### Level of Detail (LOD) - Simplify Distant Holes

**Purpose:** Reduce geometry complexity for holes that appear small on screen

**LOD Levels:**

| Screen Size | What to Render |

|-------------|----------------|

| > 20 pixels | Full detail: collar circle, grade circle, toe circle, body lines, all labels |

| 10-20 pixels | Medium: collar circle, single body line, holeID label only |

| 5-10 pixels | Low: `THREE.Points` at 2px + single body line, no labels |

| < 5 pixels | Minimal: `THREE.Points` at 2px only, no lines, no labels |

**Note:** Using `THREE.Points` with fixed 2px size for distant holes is extremely efficient - all points can be batched into a single draw call regardless of count.

**Files to Create/Modify:**

- `src/three/HoleLODManager.js` (NEW) - Manages LOD state per hole
- `src/draw/canvas3DDrawing.js` - Check LOD level before drawing

**Implementation:**

```javascript
function calculateHoleLODLevel(holeWorldPosition, camera, screenHeight) {
    // Step 1) Calculate approximate screen size (pixels)
    // For orthographic: screenSize = (worldSize * camera.zoom * screenHeight) / frustumHeight
    const worldSize = 2; // Approximate hole diameter in meters
    const frustumHeight = (camera.top - camera.bottom) / camera.zoom;
    const screenPixels = (worldSize / frustumHeight) * screenHeight;
    
    // Step 2) Return LOD level
    if (screenPixels < 5) return 'minimal';   // THREE.Points 2px only
    if (screenPixels < 10) return 'low';      // THREE.Points 2px + body line
    if (screenPixels < 20) return 'medium';   // Collar circle + body line + holeID
    return 'full';                            // All geometry + all labels
}
```

**Rendering by LOD Level:**

```javascript
// 'minimal' - Single THREE.Points geometry for ALL minimal holes (1 draw call)
// 'low' - THREE.Points + batched body lines (2 draw calls)  
// 'medium' - InstancedMesh collars + batched lines + vector text IDs
// 'full' - Full InstancedMesh circles + all lines + all vector text labels
```

**Batch by LOD Level:**

- Group all "full" detail holes → full InstancedMesh circles + all lines + all labels
- Group all "medium" detail holes → collar circle + body line + holeID only
- Group all "low" detail holes → `THREE.Points` (2px) + body line
- Group all "minimal" detail holes → `THREE.Points` (2px) only

**Key Insight:** All "minimal" and "low" points can be batched into a single `THREE.Points` geometry, regardless of how many thousands there are. This is why zooming out stays smooth even with 15,000 holes.

### Combined Effect for 3D Smoothness

| Optimization | Benefit for 3D Interaction |

|--------------|---------------------------|

| Vector Font | No billboard rotation needed during orbit |

| Frustum Culling | Skip 30-70% of holes when zoomed in |

| LOD System | Reduce geometry 80% when zoomed out |

| Conditional Loop | Only render when camera actually moves |

**Result:** Smooth 60fps zoom/pan/orbit with 15,000 holes.

---

## Changes NOT to Implement

### 3. Async Hole Drawing with Progress Dialog

**Status: DO NOT IMPLEMENT**

The async approach adds complexity without addressing the root cause. Instead, focus on reducing draw calls through:

- Vector font batching (item 1)
- Dummy/zero-diameter batching (item 2)
- Stopping unnecessary render loops
- LOD and frustum culling for 3D

---

## Implementation Order

**Phase 1: Quick Fixes (Low Risk)**

1. **InteractionManager Matrix Fix (12)** - Small, immediate benefit
2. **Surface Snap Cache Fix (13)** - Small fix for snapping accuracy
3. **Cursor Zoom Fix (8)** - Fix 2D/3D zoom behavior

**Phase 2: Render Loop Optimization**

4. **Conditional Render Loop** - Stop 3D in 2D mode, stop when idle in 3D

**Phase 3: Draw Call Reduction**

5. **Dummy Hole Batching (2)** - Batch X-shapes and squares
6. **Vector Font Implementation (1)** - Super-batch all text labels

**Phase 4: 3D Smoothness**

7. **Frustum Culling** - Skip holes outside camera view
8. **LOD System** - Simplify distant holes

**Phase 5: Cleanup**

9. **Measured Tools Fix (11)** - Simplify click handlers
10. **Mouse Logic Cleanup (14)** - Code quality improvement

---

## Files Summary

| File | Changes |

|------|---------|

| `src/three/InteractionManager.js` | Add matrix updates before raycasting |

| `src/three/CameraControls.js` | Fix cursor zoom, conditional animate loop |

| `src/three/ThreeRenderer.js` | Mode switching, frustum culling integration |

| `src/three/InstancedMeshManager.js` | Add dummy/zero batching |

| `src/three/VectorFont.js` | NEW - Hershey font + super-batched text |

| `src/three/HoleLODManager.js` | NEW - Level of detail system |

| `src/three/GeometryFactory.js` | Add vector text factory methods |

| `src/draw/canvas3DDrawing.js` | Use vector text, LOD-aware rendering |

| `src/kirra.js` | Surface snap fix, measured tools, mouse logic, mode switching |

| `kirra.html` | Add vector text toggle |

---

## Testing Checklist

**2D Performance:**

- [ ] Load 15,000 holes - verify smooth pan/zoom in 2D
- [ ] Switch back to 2D from 3D - verify render loop stops (check CPU usage in DevTools)

**3D Performance:**

- [ ] Switch to 3D - verify smooth orbit/pan/zoom
- [ ] Zoom in close - verify full detail rendering
- [ ] Zoom out far - verify LOD reduces detail (fewer draw calls)
- [ ] Pan rapidly - verify consistent frame rate

**Bug Fixes:**

- [ ] Test surface snapping - verify no false snaps when mouse not over surface
- [ ] Test cursor zoom in Plan View - verify zoom centers on cursor
- [ ] Test raycasting when facing south - verify selection works
- [ ] Test measured tools - verify click/select behavior

**Performance Metrics (DevTools):**

- [ ] Draw calls < 50 with 15,000 holes visible
- [ ] Frame time < 16ms (60fps) during 3D interaction
- [ ] CPU near 0% when idle in 2D mode