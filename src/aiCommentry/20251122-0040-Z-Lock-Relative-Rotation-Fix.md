# Z-Lock Relative Rotation Fix
**Date:** 2025-11-22  
**Time:** 00:40  
**File Modified:** `Kirra2D/src/three/CameraControls.js`

## Problem
The Z-lock rotation was calculating **absolute** angles from the mouse position, causing the view to snap/flip to match the mouse angle when orbit started. For example:
- Current bearing: 45°
- Click at bottom of screen → View flips to 180° (mouse angle from center)
- Very disorienting with large datasets

## Root Cause
The previous fix calculated `currentAngle - lastAngle` which gave the angular delta between frames, but applied it with `this.orbitY -= deltaAngle`. This was accumulating deltas correctly, but there was no reference to the **initial** camera bearing when orbit started.

The issue: The first frame's `lastAngle` was undefined/zero, causing an initial jump.

## Solution
Track the **initial state** when Z-lock orbit starts, then calculate rotation **relative to that initial state**:

1. **On Orbit Start**: Store initial mouse angle and initial orbitY
2. **During Orbit**: Calculate how much mouse has rotated from start
3. **Apply Offset**: Add rotation offset to initial orbitY (not accumulate)

This ensures the view starts from the current bearing and rotates smoothly based on mouse movement relative to where you clicked.

## Implementation

### 1. Add Tracking Variables (`CameraControls.js` constructor)

```javascript
// Step 3a) Z-lock orbit tracking (for relative rotation calculation)
this.zLockStartAngle = 0; // Initial mouse angle from orbit center
this.zLockStartOrbitY = 0; // Initial orbitY value when Z-lock orbit starts
```

### 2. Initialize on Orbit Start (handleMouseDown, lines ~310-345)

```javascript
// Step 21b.1) Initialize Z-lock tracking if Z-axis is locked
if (this.axisLock === "z") {
    // Calculate initial angle from orbit center to mouse
    const canvas = this.threeRenderer.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Project orbit center to screen space
    const orbitCenterWorld = new THREE.Vector3(
        this.centroidX,
        this.centroidY,
        this.threeRenderer.orbitCenterZ || 0
    );
    const orbitCenterScreen = orbitCenterWorld.clone().project(camera);
    const centerScreenX = (orbitCenterScreen.x * 0.5 + 0.5) * rect.width;
    const centerScreenY = (-orbitCenterScreen.y * 0.5 + 0.5) * rect.height;

    // Store initial angle and current orbitY
    this.zLockStartAngle = Math.atan2(mouseY - centerScreenY, mouseX - centerScreenX);
    this.zLockStartOrbitY = this.orbitY;
}
```

### 3. Calculate Relative Rotation (handleMouseMove, lines ~540-590)

**Before (Accumulating Deltas):**
```javascript
const deltaAngle = currentAngle - lastAngle;
this.orbitY -= deltaAngle; // Accumulate each frame
```

**After (Relative to Start):**
```javascript
// Calculate how much mouse has rotated from initial click
let angleOffset = currentAngle - this.zLockStartAngle;

// Normalize to [-PI, PI]
if (angleOffset > Math.PI) angleOffset -= 2 * Math.PI;
if (angleOffset < -Math.PI) angleOffset += 2 * Math.PI;

// Apply offset to initial bearing (relative, not accumulated)
this.orbitY = this.zLockStartOrbitY - angleOffset;
```

## Key Difference

### Old Approach (Accumulating)
```
Frame 1: orbitY = initial + delta1
Frame 2: orbitY = (initial + delta1) + delta2
Frame 3: orbitY = (initial + delta1 + delta2) + delta3
```
Problem: If delta1 has an error (undefined lastAngle), it persists.

### New Approach (Relative)
```
Frame 1: orbitY = initial + (current - start)
Frame 2: orbitY = initial + (current - start)
Frame 3: orbitY = initial + (current - start)
```
Benefit: Always calculated from known initial state, no accumulation errors.

## User Experience

### Before Fix
1. Camera at bearing 45°
2. Enable Z-lock, Alt+drag from bottom of screen
3. **Flip!** View suddenly at 180° (angle from center to bottom)
4. Continue dragging → rotation works but started wrong

### After Fix
1. Camera at bearing 45°
2. Enable Z-lock, Alt+drag from bottom of screen
3. **Smooth!** View stays at 45° initially
4. Drag mouse in circle → rotation relative to 45° start point
5. Natural, no flipping

## Mathematical Details

### Absolute vs Relative Calculation

**Absolute (Wrong):**
```javascript
currentAngle = atan2(mouseY - centerY, mouseX - centerX)  // e.g., 180° (bottom of screen)
orbitY = -currentAngle  // Camera jumps to -180°
```

**Relative (Correct):**
```javascript
// On start:
startAngle = atan2(startMouseY - centerY, startMouseX - centerX)  // e.g., 180°
startOrbitY = 45°  // Current camera bearing

// During orbit:
currentAngle = atan2(mouseY - centerY, mouseX - centerX)  // e.g., 190° (moved 10°)
angleOffset = currentAngle - startAngle  // 190° - 180° = 10°
orbitY = startOrbitY - angleOffset  // 45° - 10° = 35°
```

### Angle Normalization
```javascript
// Handle wrapping at ±180°
if (angleOffset > Math.PI) angleOffset -= 2 * Math.PI;
if (angleOffset < -Math.PI) angleOffset += 2 * Math.PI;
```

This ensures the shortest rotation path is always taken.

## Edge Cases Handled

1. **Click Anywhere**: Works regardless of where you click (top, bottom, left, right)
2. **Any Initial Bearing**: Works from any starting camera orientation
3. **Angle Wrapping**: Handles crossing ±180° boundary smoothly
4. **Momentum**: Velocity still calculated from frame-to-frame delta for smooth damping

## Testing Scenarios

Test matrix:

| Initial Bearing | Click Location | Expected Behavior |
|----------------|----------------|-------------------|
| 0° (North) | Bottom | Stay at 0°, rotate from there |
| 45° | Bottom | Stay at 45°, rotate from there |
| 180° (South) | Top | Stay at 180°, rotate from there |
| -90° (East) | Left | Stay at -90°, rotate from there |

All should start smoothly without jumping.

## Console Logging

Added debug log on Z-lock orbit start:
```
🔒 Z-lock orbit started - Initial angle: 180.0° Initial orbitY: 45.0°
```

This helps verify the initial state is captured correctly.

## Benefits

✅ **No Flipping**: View stays at current bearing when orbit starts  
✅ **Predictable**: Rotation always relative to where you are  
✅ **Large Datasets Safe**: Won't disorient users with sudden jumps  
✅ **Any Start Point**: Works from any initial camera position  
✅ **Smooth Transitions**: Natural feel when entering/exiting Z-lock orbit  

## Related Changes

This refines:
- **Z-Lock Angular Rotation** (`20251122-0030-Z-Lock-Angular-Rotation-Fix.md`) - Now truly relative
- **Z-Axis Singularity** (`20251122-0000-Z-Axis-Singularity-Fix.md`) - Pitch clamping
- **Torus Orbit Lock** (`20251122-0020-Torus-Orbit-Focal-Lock.md`) - Visual reference

## Performance
- **Overhead**: Negligible (one angle calculation on orbit start)
- **Memory**: Two floats (zLockStartAngle, zLockStartOrbitY)
- **Runtime**: Same as previous (one atan2 per frame)

