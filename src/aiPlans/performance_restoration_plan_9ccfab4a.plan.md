---
name: Performance Restoration Plan
overview: "Restore smooth 15,000-hole performance by implementing priority optimizations: Vector Font batching, Dummy/Zero-diameter hole batching, Cursor Zoom fix, InteractionManager matrix fix, Surface Snap cache fix, and Mouse Logic cleanup. Also addresses excessive background draw calls."
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
    content: Make CameraControls.animate() stop when no velocity/interaction - restart on user input
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

- Load Hershey Simplex font glyphs as line segments
- Batch all text into single LineSegments geometry per draw call
- Add `window.useVectorText` global flag (default: true)
- Super-batch: collect all text in frame, build single geometry, one draw call

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

## Additional Critical Fix: Stop Continuous Animation Loop

**Purpose:** Stop render loop when nothing is happening (2D only mode, no interaction)

**Files to Modify:**

- `src/three/CameraControls.js` - `animate()` method (lines 1088-1136)

**Current Problem:**

```javascript
// Line 1136 - ALWAYS continues, never stops
this.animationFrameId = requestAnimationFrame(this.animate);
```

**Fix:** Restore conditional stopping:

```javascript
// Only continue animation if there's velocity or active interaction
if (hasVelocity || this.isDragging || this.isOrbiting || this.isRotating) {
    this.animationFrameId = requestAnimationFrame(this.animate);
} else {
    this.animationFrameId = null;
    // Stop loop - will restart on next user interaction
}
```

Also add restart trigger in `handleMouseDown()` and `handleWheel()`.

---

## Changes NOT to Implement

### 3. Async Hole Drawing with Progress Dialog

**Status: DO NOT IMPLEMENT**

The async approach adds complexity without addressing the root cause. Instead, focus on reducing draw calls through:

- Vector font batching (item 1)
- Dummy/zero-diameter batching (item 2)
- Stopping unnecessary render loops

---

## Implementation Order

1. **InteractionManager Matrix Fix (12)** - Small, low-risk, immediate benefit
2. **Surface Snap Cache Fix (13)** - Small fix for snapping accuracy
3. **Cursor Zoom Fix (8)** - Fix 2D/3D zoom behavior
4. **Stop Continuous Animation Loop** - Critical for performance
5. **Measured Tools Fix (11)** - Simplify click handlers
6. **Mouse Logic Cleanup (14)** - Code quality improvement
7. **Dummy Hole Batching (2)** - Reduce draw calls
8. **Vector Font Implementation (1)** - Largest change, biggest performance gain

---

## Files Summary

| File | Changes |

|------|---------|

| `src/three/InteractionManager.js` | Add matrix updates before raycasting |

| `src/three/CameraControls.js` | Fix cursor zoom, stop continuous loop |

| `src/three/InstancedMeshManager.js` | Add dummy/zero batching |

| `src/three/VectorFont.js` | NEW - Hershey font implementation |

| `src/three/GeometryFactory.js` | Add vector text factory methods |

| `src/draw/canvas3DDrawing.js` | Use vector text for labels |

| `src/kirra.js` | Surface snap fix, measured tools, mouse logic |

| `kirra.html` | Add vector text toggle |

---

## Testing Checklist

- [ ] Load 15,000 holes - verify smooth pan/zoom in 2D
- [ ] Switch to 3D - verify smooth orbit
- [ ] Switch back to 2D - verify render loop stops (check CPU usage)
- [ ] Test surface snapping - verify no false snaps
- [ ] Test cursor zoom in Plan View - verify zoom to cursor
- [ ] Test raycasting when facing south - verify selection works
- [ ] Test measured tools - verify click/select behavior