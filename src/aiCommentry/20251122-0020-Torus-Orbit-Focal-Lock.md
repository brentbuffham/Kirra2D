# Torus Orbit Focal Point Lock
**Date:** 2025-11-22  
**Time:** 00:20  
**File Modified:** `Kirra2D/src/kirra.js`

## Problem
During orbit mode (Alt+drag), the mouse torus would jump around erratically as the camera rotated. This was disorienting and made it difficult to focus on the orbit center point.

## Solution
Lock the torus to the orbit focal point during active orbiting, then resume normal mouse tracking when orbit is released.

## Implementation

### Orbit State Detection
Added check for active orbit mode via `CameraControls.isOrbiting`:

```javascript
const isOrbitingNow = window.cameraControls && window.cameraControls.isOrbiting;
```

### New Position Priority (in handle3DMouseMove)

Updated torus position logic with new priority system:

1. **Orbit Focal Point** (highest priority if orbiting)
   - Position: Camera centroid + orbit center Z
   - Active when: `cameraControls.isOrbiting === true`
   - Result: Torus stays fixed at the point you're orbiting around

2. **Hit Object** (if not orbiting and raycast hits)
   - Position: Intersection point on hit object
   - Active when: Raycast intersects with scene object

3. **View Plane** (if not orbiting and no hit)
   - Position: Mouse cursor on camera view plane
   - Active when: Normal mouse movement without orbit

4. **Camera Centroid** (fallback)
   - Position: Current camera centroid
   - Active when: All calculations fail

### Code Changes

**File:** `Kirra2D/src/kirra.js` (lines ~1740-1785)

```javascript
// Step 13f.6a) Check if orbit mode is active
const isOrbitingNow = window.cameraControls && window.cameraControls.isOrbiting;

if (isOrbitingNow) {
    // Step 13f.6b) During orbit: Lock torus to orbit focal point
    const cameraState = window.cameraControls.getCameraState();
    const orbitZ = window.threeRenderer.orbitCenterZ || 0;
    indicatorPos = {
        x: cameraState.centroidX + originX,
        y: cameraState.centroidY + originY,
        z: orbitZ
    };
} else if (intersects && mouseWorldPos) {
    // Normal tracking: hit object
    indicatorPos = mouseWorldPos;
} else if (torusWorldPos) {
    // Normal tracking: view plane
    indicatorPos = torusWorldPos;
} else {
    // Fallback: camera centroid
    indicatorPos = fallbackPos;
}
```

## User Experience

### During Orbit (Alt+Drag)
1. User presses Alt and starts dragging
2. `cameraControls.isOrbiting` becomes `true`
3. Torus immediately locks to orbit focal point
4. Camera rotates around the torus (which stays fixed)
5. Provides clear visual reference of rotation center

### After Orbit Release
1. User releases Alt or mouse button
2. `cameraControls.isOrbiting` becomes `false`
3. Torus resumes following mouse cursor
4. Normal view plane tracking behavior restored

## Benefits

✅ **Stable Reference Point**: Torus provides clear visual indicator of orbit center  
✅ **No Jumping**: Torus stays fixed during orbit, preventing disorientation  
✅ **Intuitive**: User can see exactly what point they're orbiting around  
✅ **Seamless**: Automatic transition between orbit lock and mouse tracking  
✅ **Compatible**: Works with all orbit modes (X-lock, Y-lock, Z-lock, free)

## Technical Details

### Orbit Focal Point Coordinates
- **X, Y**: Camera centroid (world coordinates)
- **Z**: `threeRenderer.orbitCenterZ` (data centroid Z or 0)
- **Coordinate Transform**: Local coordinates → World coordinates via `threeLocalOriginX/Y`

### State Management
- **Orbit Active**: `CameraControls.isOrbiting === true` (Alt key held + dragging)
- **Orbit Inactive**: `CameraControls.isOrbiting === false` (normal mode)
- **State Checked**: Every frame in `handle3DMouseMove()`
- **Transition**: Instant (no animation needed)

### Coordinate System
- **Z-Up World**: X=Easting, Y=Northing, Z=Elevation
- **Orbit Center**: Same as camera look-at point
- **Billboard**: Torus still faces camera during orbit lock

## Related Changes

This builds on previous fixes:
- **View Plane Positioning**: `20251122-0010-Mouse-Torus-View-Plane-Billboard.md`
- **Z-Axis Singularity**: `20251122-0000-Z-Axis-Singularity-Fix.md`
- **Billboard Rendering**: Torus always faces camera (from view plane fix)

## Testing Notes

Test scenarios:
1. **Start Orbit**: Hold Alt, drag → torus should lock to center
2. **During Orbit**: Move mouse → torus stays fixed
3. **Release Orbit**: Release Alt → torus resumes tracking mouse
4. **Axis Lock**: Test with X, Y, Z axis locks → torus should remain locked at center
5. **Object Hits**: Click object during orbit → selection should still work
6. **Roll Mode**: Shift+Alt (roll) → torus should NOT lock (only orbit locks)

## Performance

- **Overhead**: Minimal (one boolean check per frame)
- **Memory**: No additional allocations
- **Render**: Billboard update still runs (torus faces camera)

