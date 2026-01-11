# 3D Initialization and Performance Fix - 2026-01-11

## Problem
3D mode had multiple critical issues:
1. **Not correctly initialized** - scene doesn't render on startup
2. **Gizmo not showing** - axis helper not visible
3. **Mouse tracking broken** - cursor indicator not working
4. **Terrible performance** - choppy/laggy even with simple lines

Previous fix documented in `20251125-1445-3DQuirksFixes.md` addressed jerkiness but didn't fully resolve issues.

## Root Cause Analysis

### Dual Animation Loop Architecture
Kirra uses TWO separate animation loops that must work together:

1. **CameraControls.animate()** - Updates camera state, handles momentum/damping
   - Only calls `updateCamera()` when there's velocity (user movement)
   - Continues running even without velocity (for responsiveness)

2. **ThreeRenderer.startRenderLoop()** - Renders the scene
   - Uses flag-based rendering: only renders when `needsRender = true`
   - Flag is set by `updateCamera()` or `requestRender()`
   - Flag is reset after each render

### The Problem
On 3D mode startup or when switching to 3D:

1. `resetPanState()` is called (line 3148 in kirra.js) which **stops** the CameraControls animation loop
2. `attachEvents()` is called to re-enable controls
3. **OLD CODE**: attachEvents() did NOT restart the animation loop
4. **RESULT**: No animation loop running → no camera updates → needsRender never set → nothing renders

Additionally:
- CameraControls.animate() only calls `updateCamera()` when there's velocity
- On initial startup with no user interaction, velocity = 0
- Without an initial `updateCamera()` call, `needsRender` never gets set to true
- Scene remains black/frozen until user interacts

## Fixes Applied

### Fix 1: Start Animation Loop in attachEvents()
**File**: `src/three/CameraControls.js`
**Location**: Line 154-161 (Step 8e)

```javascript
// Step 8e) START ANIMATION LOOP IMMEDIATELY for smooth 3D rendering
// This ensures the scene renders continuously even without user interaction
// Fixes QUIRK 1: Jerkiness on startup until user drags 2D then returns to 3D
// Critical: Must restart loop here because resetPanState() stops it during mode switching
if (this.animationFrameId === null) {
    this.animationFrameId = requestAnimationFrame(this.animate);
    console.log("✅ Started CameraControls animation loop for smooth 3D rendering");
}
```

**Why**: Ensures animation loop is always running when controls are attached, even after resetPanState() stops it.

### Fix 2: Force Initial Render in attachEvents()
**File**: `src/three/CameraControls.js`
**Location**: Line 163-168 (Step 8f)

```javascript
// Step 8f) CRITICAL FIX: Force initial render when controls attach
// Without this, the scene won't render until user creates velocity (moves camera)
// The animate() loop only calls updateCamera() when there's velocity
// This ensures the scene renders immediately on 3D mode switch
this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);
console.log("🎬 Forced initial camera update and render on attach");
```

**Why**: Ensures `needsRender` is set to true immediately when entering 3D mode, even with no user interaction.

## Testing

### Expected Console Output on 3D Mode Switch:
```
🔄 Pan state reset (prevented stuck drag) - wasDragging: false pendingPan: false
✅ Started CameraControls animation loop for smooth 3D rendering
🎬 Forced initial camera update and render on attach
🎮 Unified orthographic camera controls attached
```

### Test Procedure:
1. **Clear browser cache** and reload app
2. **Switch to 3D-only mode** (cube icon)
3. **Check console** for the above messages
4. **Verify 3D scene renders** immediately (no black screen)
5. **Test camera controls**:
   - Left-drag: Pan
   - Right-drag: Orbit
   - Scroll: Zoom
6. **Verify smooth rendering** (no jerkiness or lag)

### If Issue Persists:

#### Diagnostic Steps:

1. **Check if ThreeRenderer render loop is running:**
```javascript
// In browser console:
console.log("ThreeRenderer animation ID:", window.threeRenderer.animationFrameId);
console.log("Needs render:", window.threeRenderer.needsRender);
```

2. **Check if CameraControls animation loop is running:**
```javascript
// In browser console:
console.log("CameraControls animation ID:", window.cameraControls.animationFrameId);
```

3. **Check scene contents:**
```javascript
// In browser console:
console.log("Scene children count:", window.threeRenderer.scene.children.length);
window.threeRenderer.scene.traverse(obj => console.log(obj.type, obj.name, obj.visible));
```

4. **Check camera position:**
```javascript
// In browser console:
console.log("Camera position:", window.threeRenderer.camera.position);
console.log("Camera looking at:", window.threeRenderer.orbitCenterX, window.threeRenderer.orbitCenterY, window.threeRenderer.orbitCenterZ);
```

5. **Force manual render:**
```javascript
// In browser console:
window.threeRenderer.needsRender = true;
// Wait for next frame, then check if scene rendered
```

#### Possible Additional Issues:

If diagnostics reveal:
- **Scene is empty**: Data not loaded or geometry not created
  - Check `window.allBlastHoles` has data
  - Check `window.loadedSurfaces` has surfaces
  - Verify `window.threeDataNeedsRebuild` triggers geometry creation

- **Camera positioned incorrectly**: Looking at wrong location
  - Check centroid calculation in `calculateDataCentroid()`
  - Verify `worldToThreeLocal()` conversion
  - Check orbit center Z is set correctly

- **Canvas not visible**: CSS/DOM issue
  - Check `#threeCanvas` has `opacity: 1` and `z-index: 2`
  - Check `pointer-events: auto` is set
  - Verify canvas dimensions match viewport

- **WebGL context lost**: GPU memory exhausted
  - Check console for WebGL errors
  - Try `window.threeRenderer.contextLost` flag
  - Reduce geometry complexity or texture count

## Related Files

- `src/three/CameraControls.js` - Camera control system (MODIFIED)
- `src/three/ThreeRenderer.js` - Core rendering system
- `src/kirra.js` - Main application file
  - Line 696-924: initializeThreeJS()
  - Line 3135-3293: 3D mode toggle handler
  - Line 25370-27235: drawData() function

## Success Criteria

✅ 3D mode renders immediately on startup
✅ 3D mode renders immediately when switching from 2D
✅ Camera controls (pan/orbit/zoom) work smoothly
✅ No jerkiness or lag during camera movement
✅ Scene updates when data changes
✅ No console errors related to rendering or animation loops

## Rollback

If this fix causes issues, revert `src/three/CameraControls.js` by removing:
- Lines 154-161 (Step 8e - animation loop start)
- Lines 163-168 (Step 8f - forced initial render)

The original `attachEvents()` method should just attach event listeners without starting the animation loop or forcing a render.
