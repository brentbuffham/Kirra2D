# Z-Axis Lock Angular Rotation Fix
**Date:** 2025-11-22  
**Time:** 00:30  
**File Modified:** `Kirra2D/src/three/CameraControls.js`

## Problem
When Z-axis lock was active, the rotation calculation had two major issues:

1. **Wrong Calculation Method**: Used linear screen-space mouse delta instead of angular rotation from orbit center
2. **Initial Bearing Jump**: View would jump to an arbitrary 180° bearing when Z-lock orbit started
3. **Linear Motion Control**: Rotation was controlled by linear mouse movement rather than circular/angular movement around the orbit focal point

This made Z-axis rotation feel unnatural and disorienting.

## Root Cause

The previous implementation used:
```javascript
deltaOrbitY = deltaX * sensitivity; // Linear screen delta
```

This treats rotation as a linear function of horizontal mouse movement, which:
- Doesn't account for the orbit center position on screen
- Creates arbitrary jumps when orbit starts
- Feels unnatural (not circular around center)

## Solution

Calculate the **angular change from orbit center to mouse position** in screen space:

1. Project orbit center to screen space
2. Calculate angle from center to current mouse position
3. Calculate angle from center to previous mouse position
4. Apply the angular difference to rotation (yaw)

## Implementation

### New Z-Lock Calculation (`CameraControls.js` lines ~512-550)

```javascript
if (this.axisLock === "z") {
    // Step 1) Get mouse position in canvas space
    const canvas = this.threeRenderer.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Step 2) Project orbit center to screen space
    const camera = this.threeRenderer.camera;
    const orbitCenterWorld = new THREE.Vector3(
        this.centroidX,
        this.centroidY,
        this.threeRenderer.orbitCenterZ || 0
    );
    const orbitCenterScreen = orbitCenterWorld.clone().project(camera);
    const centerScreenX = (orbitCenterScreen.x * 0.5 + 0.5) * rect.width;
    const centerScreenY = (-orbitCenterScreen.y * 0.5 + 0.5) * rect.height;

    // Step 3) Calculate angles
    const currentAngle = Math.atan2(mouseY - centerScreenY, mouseX - centerScreenX);
    const lastAngle = Math.atan2(lastMouseYCanvas - centerScreenY, lastMouseXCanvas - centerScreenX);

    // Step 4) Calculate angular change
    let deltaAngle = currentAngle - lastAngle;
    
    // Step 5) Normalize to [-PI, PI]
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    // Step 6) Apply to yaw (inverted for correct rotation direction)
    this.orbitY -= deltaAngle;
    
    // Step 7) Keep pitch in safe range (avoid singularity)
    this.orbitX = Math.max(minPitch, Math.min(maxPitch, this.orbitX));
}
```

### Key Improvements

**1. Angular Calculation**
- Uses `Math.atan2(dy, dx)` to get angle from orbit center to mouse
- Calculates delta between current and previous angles
- Natural circular motion around orbit center

**2. No Initial Jump**
- Angle is calculated from current position
- First movement is relative to where you clicked
- Smooth transition into Z-lock orbit

**3. Correct Rotation Direction**
- Inverted sign (`this.orbitY -= deltaAngle`) for intuitive rotation
- Mouse moving clockwise around center → camera rotates clockwise
- Matches user expectations

**4. Singularity Prevention**
- Pitch clamped to safe range [0.1, π - 0.1]
- Prevents gimbal lock at poles
- Maintains smooth yaw rotation

## Mathematical Details

### Screen Space Projection
```javascript
// World coordinates → NDC (-1 to 1)
const orbitCenterScreen = orbitCenterWorld.clone().project(camera);

// NDC → Screen pixels
const centerScreenX = (orbitCenterScreen.x * 0.5 + 0.5) * rect.width;
const centerScreenY = (-orbitCenterScreen.y * 0.5 + 0.5) * rect.height;
```

### Angular Delta Calculation
```javascript
// Get angles in radians
const currentAngle = Math.atan2(mouseY - centerY, mouseX - centerX);
const lastAngle = Math.atan2(lastMouseY - centerY, lastMouseX - centerX);

// Delta might wrap around ±π boundary
let deltaAngle = currentAngle - lastAngle;

// Normalize to shortest path
if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
```

### Coordinate System
- **Screen Space**: Origin top-left, Y-down
- **World Space**: X=Easting, Y=Northing, Z=Elevation (Z-up)
- **Rotation**: Yaw around Z-axis (vertical)
- **Sign Convention**: Negative delta for clockwise screen rotation

## User Experience

### Before Fix
1. Enable Z-axis lock
2. Start orbit (Alt+drag)
3. **Jump**: View suddenly jumps to ~180° bearing
4. **Linear**: Horizontal mouse movement = linear rotation
5. **Disorienting**: Doesn't feel like rotating around a point

### After Fix
1. Enable Z-axis lock
2. Start orbit (Alt+drag)
3. **Smooth**: No jump, starts from current position
4. **Angular**: Moving mouse in circle around center = circular rotation
5. **Intuitive**: Feels like spinning around the torus (orbit center)

## Visual Behavior

### Orbit Center (Torus)
- Torus locked to orbit focal point during Z-lock orbit (from previous fix)
- Mouse moves in circle around torus on screen
- Camera rotates around Z-axis (yaw) by same angle

### Rotation Direction
- **Clockwise mouse around center** → Camera rotates clockwise (view rotates CCW)
- **Counter-clockwise mouse** → Camera rotates CCW (view rotates CW)
- Matches natural circular motion expectations

## Edge Cases Handled

1. **Angle Wrapping**: Normalized to [-π, π] to avoid discontinuities
2. **Singularity**: Pitch clamped to safe range [0.1, π-0.1]
3. **Momentum**: Velocity stored as angular delta for smooth damping
4. **First Frame**: Uses last mouse position to avoid initial jump

## Comparison: X/Y Lock vs Z Lock

| Mode | Calculation | Behavior |
|------|-------------|----------|
| **X Lock** | Linear delta Y → pitch | Vertical mouse = tilt up/down |
| **Y Lock** | Linear delta Y → pitch | Vertical mouse = tilt up/down |
| **Z Lock** | Angular from center | Circular mouse = rotate around Z |
| **No Lock** | Linear delta X/Y → pitch/yaw | Free orbit |

Only Z-lock uses angular calculation because it's the only pure rotation mode (yaw around vertical axis).

## Related Fixes

This builds on:
1. **Z-Axis Singularity Fix** (`20251122-0000-Z-Axis-Singularity-Fix.md`) - Pitch clamping
2. **Torus Orbit Lock** (`20251122-0020-Torus-Orbit-Focal-Lock.md`) - Visual reference
3. **View Plane Billboard** (`20251122-0010-Mouse-Torus-View-Plane-Billboard.md`) - Torus positioning

## Testing Notes

Test scenarios:
1. **Enable Z-Lock**: Set axis lock to Z
2. **Start Orbit**: Alt+drag → should start smoothly without jump
3. **Circular Motion**: Move mouse in circle around torus → smooth rotation
4. **Horizontal Line**: Move mouse horizontally → rotation rate varies by distance from center
5. **Close to Center**: Mouse near torus → slow rotation
6. **Far from Center**: Mouse far from torus → fast rotation
7. **Release and Re-engage**: No jump when starting new orbit

## Performance
- **Overhead**: One `Math.atan2()` call per frame during Z-lock orbit
- **Projection**: One world-to-screen projection per frame
- **Impact**: Negligible (< 0.1ms on modern hardware)

