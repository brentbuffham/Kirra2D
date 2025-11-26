# Arcball Camera Controls - Issues and Fixes

## Issue 1: THREE is not defined (Critical - Causes Scroll Wheel Error)

**Problem:** Line 207 in `ArcballCameraControls.js` uses `THREE.Vector3()` but THREE is not imported.

**Error:**
```
Uncaught ReferenceError: THREE is not defined
    handleMouseMove ArcballCameraControls.js:207
```

**Fix:** Add THREE import at the top of `ArcballCameraControls.js`

```javascript
// At line 6, change from:
import { ArcballControls } from "three/addons/controls/ArcballControls.js";

// To:
import * as THREE from "three";
import { ArcballControls } from "three/addons/controls/ArcballControls.js";
```

---

## Issue 2: Zoom Doesn't Zoom to Cursor

**Problem:** Line 38 sets `cursorZoom = false` which disables cursor zoom by default.

**Current Code (Line 38):**
```javascript
this.arcballControls.cursorZoom = false; // We'll handle cursor zoom manually
```

**Fix:** Change to `true` and ensure settings are applied:

```javascript
// Line 38 - Enable cursor zoom
this.arcballControls.cursorZoom = true;
```

**Also verify settings initialization (Lines 60-66):**
```javascript
// Step 7) Settings
this.settings = {
    dampingFactor: 0.05,
    cursorZoom: true,  // ← Make sure this is true
    enablePan: true,
    enableRotate: true,
    enableZoom: true,
};
```

---

## Issue 3: Gizmo Always On (Ignores Settings)

**Problem:** The `gizmoDisplayMode` is not being initialized or transferred from CameraControls wrapper.

**Root Cause:** In `ArcballCameraControls.js`, the `gizmoDisplayMode` property is never set during construction.

**Fix 1 - Add gizmoDisplayMode to constructor:**

In `ArcballCameraControls.js`, add after line 66:

```javascript
// Step 7) Settings
this.settings = {
    dampingFactor: 0.05,
    cursorZoom: true,
    enablePan: true,
    enableRotate: true,
    enableZoom: true,
};

// ADD THIS:
// Step 7a) Gizmo display mode (should be set by wrapper)
this.gizmoDisplayMode = "only_when_orbit_or_rotate"; // Default mode
```

**Fix 2 - Ensure CameraControls transfers gizmo mode:**

In `CameraControls.js` at line 82, modify to transfer gizmo mode:

```javascript
// Line 82 - Change from:
this.arcballControls = new ArcballCameraControls(this.threeRenderer, this.canvas2D);

// To:
this.arcballControls = new ArcballCameraControls(this.threeRenderer, this.canvas2D);
this.arcballControls.gizmoDisplayMode = this.gizmoDisplayMode; // Transfer gizmo mode
```

---

## Issue 4: Shift+Alt+Drag Doesn't Roll Camera

**Problem:** The roll rotation logic is working, but the issue is that when both Shift AND Alt are held, the event might be getting intercepted elsewhere.

**Investigation:** The code at lines 132-139 correctly detects Shift+Alt, but let me check if there's an issue with the actual rotation application.

**Potential Fix:** The rotation calculation looks correct (lines 241-260), but ensure the rotation is being preserved in the camera state.

**Verify in setCameraState (line 436):**
```javascript
// Step 13g) Apply Z-axis rotation (2D spin/roll) after lookAt
// This rotates the camera around its viewing axis
this.camera.rotateZ(rotation);
```

This should be working. **Test by adding console.log to verify rotation is changing:**

```javascript
// In handleMouseMove, line 253, add logging:
const newRotation = (currentState.rotation || 0) + deltaAngle;
console.log("🔄 Roll rotation:", newRotation, "delta:", deltaAngle);
this.setCameraState(currentState.centroidX, currentState.centroidY, currentState.scale, newRotation, currentState.orbitX, currentState.orbitY);
```

---

## Issue 5: Axis Flips When Past 90° (Not Flowing)

**Problem:** When orbitX passes ±90° (±π/2), the camera flips because of gimbal lock. The spherical coordinate conversion causes the "up" vector to flip.

**Root Cause:** Lines 417-425 use unclamped spherical coordinates:

```javascript
// Spherical to Cartesian conversion
const x = distance * Math.cos(orbitX) * Math.sin(orbitY);
const y = distance * Math.sin(orbitX);
const z = distance * Math.cos(orbitX) * Math.cos(orbitY);
```

**Fix Option 1 - Clamp orbitX to prevent flip:**

In `handleMouseMove` at line 272, clamp orbitX:

```javascript
// Change from:
const newOrbitX = currentState.orbitX + deltaOrbitX;

// To:
const newOrbitX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, currentState.orbitX + deltaOrbitX));
```

**Fix Option 2 - Use quaternions (Better solution, matches Three.js example):**

This requires using ArcballControls native rotation instead of manual spherical math. Let ArcballControls handle the rotation natively:

```javascript
// Instead of manually calculating camera position, let ArcballControls do it
// This means relying more on the built-in controls and less on custom setCameraState
```

**Recommended:** Use Fix Option 1 for quick solution, or redesign to use ArcballControls more natively for better behavior.

---

## Issue 6: Should Follow Three.js Example Behavior

**Problem:** The implementation is manually calculating camera positions instead of using ArcballControls native functionality.

**Three.js Example:** https://threejs.org/examples/?q=arcball#misc_controls_arcball

**Key Differences:**
1. Example uses ArcballControls natively without manual camera positioning
2. Example doesn't manually override all mouse events
3. Example lets ArcballControls handle its own state

**Recommended Architecture Change:**

Instead of overriding all ArcballControls behavior, configure it properly and let it work:

```javascript
// Simpler approach - configure ArcballControls and use it directly:
constructor(threeRenderer, canvas2D) {
    this.threeRenderer = threeRenderer;
    this.camera = threeRenderer.camera;
    this.renderer = threeRenderer.renderer;
    this.scene = threeRenderer.scene;
    
    // Initialize ArcballControls
    this.arcballControls = new ArcballControls(
        this.camera, 
        this.renderer.domElement, 
        this.scene
    );
    
    // Configure settings
    this.arcballControls.dampingFactor = 0.05;
    this.arcballControls.cursorZoom = true;
    this.arcballControls.enablePan = true;
    this.arcballControls.enableRotate = true;
    this.arcballControls.enableZoom = true;
    
    // Listen for changes
    this.arcballControls.addEventListener('change', () => {
        this.threeRenderer.requestRender();
    });
}

attachEvents() {
    this.arcballControls.enabled = true;
}

detachEvents() {
    this.arcballControls.enabled = false;
}
```

This simpler approach would eliminate most issues by leveraging Three.js's tested implementation.

---

## Summary of Quick Fixes

### Priority 1 - Critical (Breaks functionality):
1. ✅ Add `import * as THREE from "three";` to ArcballCameraControls.js

### Priority 2 - High (User experience):
2. ✅ Change `cursorZoom = false` to `true` (line 38)
3. ✅ Initialize `gizmoDisplayMode` and transfer from CameraControls
4. ✅ Clamp orbitX to prevent axis flip: `Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, newOrbitX))`

### Priority 3 - Investigation:
5. 🔍 Test Shift+Alt+drag with console logging to verify rotation changes
6. 🔍 Consider simplifying to use ArcballControls natively (architectural change)

---

## Code Changes Required

### File: `ArcballCameraControls.js`

**Change 1 - Line 6 (Add THREE import):**
```javascript
import * as THREE from "three";
import { ArcballControls } from "three/addons/controls/ArcballControls.js";
```

**Change 2 - Line 38 (Enable cursor zoom):**
```javascript
this.arcballControls.cursorZoom = true; // Enable cursor zoom for orthographic cameras
```

**Change 3 - After line 66 (Initialize gizmo mode):**
```javascript
// Step 7a) Gizmo display mode
this.gizmoDisplayMode = "only_when_orbit_or_rotate"; // Default mode
```

**Change 4 - Line 272 (Clamp orbitX to prevent flip):**
```javascript
// Step 11g4a) Clamp orbitX to prevent gimbal lock flip at ±90°
const clampedNewOrbitX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, currentState.orbitX + deltaOrbitX));
const newOrbitY = currentState.orbitY + deltaOrbitY;

this.setCameraState(currentState.centroidX, currentState.centroidY, currentState.scale, currentState.rotation, clampedNewOrbitX, newOrbitY);
```

### File: `CameraControls.js`

**Change 5 - Line 82 (Transfer gizmo mode):**
```javascript
if (!this.arcballControls) {
    this.arcballControls = new ArcballCameraControls(this.threeRenderer, this.canvas2D);
    this.arcballControls.gizmoDisplayMode = this.gizmoDisplayMode; // Transfer gizmo display mode
}
```

---

## Testing Checklist

After applying fixes, test:

- [ ] Scroll wheel zoom works without errors
- [ ] Zoom centers on cursor position (cursor zoom works)
- [ ] Gizmo respects "Only When Orbit or Rotate" setting
- [ ] Gizmo respects "Always" setting
- [ ] Gizmo respects "Never" setting
- [ ] Shift+Alt+drag rolls the view (Z-axis rotation)
- [ ] Alt+drag tumbles the view (3D orbit)
- [ ] Camera doesn't flip past 90° elevation
- [ ] Camera rotation is smooth and continuous
- [ ] Left-click drag pans the view
- [ ] Damping factor slider affects rotation smoothness

---

## Additional Recommendations

### For Production Quality:

1. **Consider using ArcballControls more natively** - The current implementation fights against ArcballControls by overriding everything. A simpler wrapper that just configures ArcballControls would be more maintainable.

2. **Add mouse button configuration** - Currently Alt+drag is hardcoded for orbit. Consider making this configurable.

3. **Test with perspective camera** - All logic assumes orthographic. If you ever need perspective, this will need updates.

4. **Add zoom limits** - Currently zoom is unlimited. Consider adding min/max scale limits.

5. **Improve roll UX** - Shift+Alt is awkward. Consider middle-mouse button for roll instead.
