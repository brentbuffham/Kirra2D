# Z-Axis Lock Singularity Fix
**Date:** 2025-11-22  
**Time:** 00:00  
**File Modified:** `Kirra2D/src/three/CameraControls.js`

## Issue
When using Z-axis lock (rotation around Z-axis/yaw only), a singularity occurred at the poles (looking straight down or up). This is a classic gimbal lock problem in spherical coordinates.

## Root Cause
The spherical to Cartesian conversion in `ThreeRenderer.js` uses:
```javascript
const x = cameraDistance * Math.sin(orbitX) * Math.sin(orbitY);
const y = cameraDistance * Math.sin(orbitX) * Math.cos(orbitY);
const z = cameraDistance * Math.cos(orbitX);
```

When `orbitX` approaches 0 (top-down) or π (bottom-up), `sin(orbitX)` approaches 0, making the XY radius zero. At this point, changing `orbitY` (yaw) has no effect because the camera is at the pole of the sphere, causing the singularity shown in the user's image.

## Solution
Added pitch clamping when Z-axis lock is active in `CameraControls.js` (lines ~531-537):

```javascript
// Step 25a) Prevent Z-axis singularity when Z-lock is active
// When rotating around Z-axis (yaw only), avoid poles (orbitX = 0 or PI)
// Clamp orbitX to safe range to prevent gimbal lock at zenith/nadir
if (this.axisLock === "z") {
    const minPitch = 0.1; // ~5.7 degrees from top
    const maxPitch = Math.PI - 0.1; // ~5.7 degrees from bottom
    this.orbitX = Math.max(minPitch, Math.min(maxPitch, this.orbitX));
}
```

This ensures that when Z-axis is locked (allowing only yaw rotation), the pitch angle stays at least 5.7 degrees away from the poles, preventing the singularity while still allowing near-vertical views.

## Technical Details
- **Coordinate System:** Z-up (X=Easting, Y=Northing, Z=Elevation)
- **orbitX:** Pitch angle from Z-axis (0 = top-down, π/2 = horizon, π = bottom-up)
- **orbitY:** Yaw angle in XY plane (rotation around Z-axis)
- **Singularity:** Occurs at orbitX = 0 or π where yaw becomes undefined

## Testing
User should verify:
1. Z-axis lock no longer exhibits singularity behavior
2. Camera can rotate smoothly around Z-axis (yaw only)
3. Pitch is automatically constrained to safe range when Z-lock is active
4. Other axis locks (X, Y, none) remain unaffected

