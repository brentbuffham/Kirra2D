# Camera Control Improvements

## Problems Fixed

### 1. Context Menu on Ctrl+Drag

**Issue**: On Mac, Ctrl+click triggers the browser context menu, interfering with rotation controls.

**Root Cause**: No prevention of default context menu behavior.

### 2. Pan Direction Misaligned with Rotation

**Issue**: When the view is rotated, panning doesn't follow the rotated coordinate system. Dragging "up" would sometimes move the view in unexpected directions depending on the rotation angle.

**Root Cause**: Pan delta values were applied directly without accounting for the current Z-axis rotation.

### 3. Mac Compatibility

**Issue**: Ctrl key on Mac triggers system shortcuts and context menu. Mac users expect Command (⌘) key for application shortcuts.

**Root Cause**: Only checking `event.ctrlKey`, not `event.metaKey` (Command on Mac).

### 4. No Right-Click Support

**Issue**: Users wanted right-click as an alternative to keyboard modifiers for rotation.

**Request**: "the right click should only be available with the mouse right button"

## Solutions Implemented

### 1. Prevent Context Menu

Added context menu prevention on the Three.js canvas.

**File**: `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/three/CameraControls.js`

```javascript
// Prevent context menu on right-click
canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    return false;
});
```

Also added `event.preventDefault()` in mouse down handler for rotation modes.

### 2. Rotation-Aware Panning

Pan deltas are now rotated to match the current Z-axis rotation, so panning always follows the screen direction.

**Implementation**:

```javascript
// Step 19) Pan mode - account for current rotation
const deltaX = event.clientX - this.lastMouseX;
const deltaY = event.clientY - this.lastMouseY;

// Rotate the delta values to account for current Z-axis rotation
// This makes panning follow the rotated coordinate system
const cos = Math.cos(-this.rotation); // Negative because we're rotating screen space
const sin = Math.sin(-this.rotation);

const rotatedDeltaX = deltaX * cos - deltaY * sin;
const rotatedDeltaY = deltaX * sin + deltaY * cos;

this.centroidX -= rotatedDeltaX / this.scale;
this.centroidY += rotatedDeltaY / this.scale;
```

**How It Works**:

1. Get screen-space mouse delta (deltaX, deltaY)
2. Apply inverse rotation matrix to convert to world space
3. Apply rotated delta to centroid position

This ensures that:

-   Dragging right always moves view right (on screen)
-   Dragging up always moves view up (on screen)
-   Direction is independent of current rotation angle

### 3. Mac Command Key Support

Added detection for Command key (metaKey) on Mac.

**Implementation**:

```javascript
// metaKey = Command on Mac, Windows key on PC
const isCommandOrCtrl = event.metaKey || event.ctrlKey;

if (event.shiftKey && isCommandOrCtrl) {
    // 3D Orbit mode
} else if (isCommandOrCtrl || event.altKey || event.button === 2) {
    // 2D Rotation mode
}
```

### 4. Right-Click Rotation

Added right mouse button (button 2) as a trigger for 2D rotation mode.

**Implementation**:

```javascript
// Step 17) Prevent context menu on right-click
if (event.button === 2) {
    event.preventDefault();
}

// Step 19) Check for 2D rotation mode (Command/Ctrl, Alt, or right-click)
else if (isCommandOrCtrl || event.altKey || event.button === 2) {
    event.preventDefault();
    this.isRotating = true;
    console.log("🔄 2D Rotation mode activated (⌘/Ctrl/Alt/Right-click)");
}
```

## Updated Control Scheme

### Pan Mode (Default)

**Activation**:

-   Left-click + drag
-   Single finger touch

**Behavior**: Moves view in screen space, respects current rotation

### 2D Rotation Mode (Z-axis Spin)

**Activation** (any of):

-   ⌘ Command (Mac) + left-click drag
-   Ctrl (Windows/Linux) + left-click drag
-   Alt + left-click drag
-   Right-click + drag

**Behavior**: Rotates view around center point

### 3D Orbit Mode

**Activation**:

-   Shift + ⌘/Ctrl + left-click drag

**Behavior**: Orbits camera in 3D space

### Zoom

**Activation**: Mouse wheel

**Behavior**: Zooms in/out, preserves rotation and position

## Mathematical Details

### Rotation Matrix (2D)

```javascript
// Rotate vector (x, y) by angle θ
rotatedX = x * cos(θ) - y * sin(θ);
rotatedY = x * sin(θ) + y * cos(θ);
```

### Why Negative Rotation?

We use `-this.rotation` because:

1. Screen-space delta is in rotated coordinates
2. We need to convert back to world coordinates
3. This requires inverse rotation (negative angle)

**Example**:

-   View rotated 90° clockwise
-   Drag right on screen (deltaX = 10, deltaY = 0)
-   After inverse rotation: moves view down in world space
-   Result: screen pans right (as expected)

## Touch Support

Touch panning also respects rotation:

```javascript
// Step 27) Single touch pan - account for rotation
const deltaX = event.touches[0].clientX - this.lastMouseX;
const deltaY = event.touches[0].clientY - this.lastMouseY;

// Rotate the delta values to account for current Z-axis rotation
const cos = Math.cos(-this.rotation);
const sin = Math.sin(-this.rotation);

const rotatedDeltaX = deltaX * cos - deltaY * sin;
const rotatedDeltaY = deltaX * sin + deltaY * cos;
```

## Platform Detection

The code automatically detects the platform:

-   **Mac**: Command (⌘) key works for rotation
-   **Windows/Linux**: Ctrl key works for rotation
-   **All platforms**: Alt and right-click work

## Testing

1. **Rotation-aware panning**:

    - Rotate view 90° (⌘/Ctrl + drag)
    - Try panning in all directions
    - Verify pan direction matches screen direction

2. **Mac compatibility**:

    - On Mac: Use Command (⌘) + drag for rotation
    - Verify no system shortcuts are triggered
    - Verify no context menu appears

3. **Right-click rotation**:

    - Right-click + drag to rotate
    - Verify no context menu appears
    - Verify smooth rotation

4. **Combined operations**:
    - Rotate view to 45°
    - Pan around
    - Zoom in/out
    - Verify all operations work smoothly

## Benefits

1. **Intuitive Panning**: Pan direction always matches screen direction, regardless of rotation
2. **Mac Compatibility**: Command key works as expected for Mac users
3. **No Context Menu**: Right-click can be used for controls without interference
4. **Flexible Controls**: Multiple ways to trigger each mode
5. **Platform Agnostic**: Works correctly on Mac, Windows, and Linux

## Console Messages

Updated console messages reflect new controls:

-   "👆 Pan mode activated"
-   "🔄 2D Rotation mode activated (⌘/Ctrl/Alt/Right-click)"
-   "🌐 3D Orbit mode activated (Shift+⌘/Ctrl held)"

## Keyboard Reference

| Action    | Mac              | Windows/Linux       | All Platforms                    |
| --------- | ---------------- | ------------------- | -------------------------------- |
| Pan       | Drag             | Drag                | Drag                             |
| 2D Rotate | ⌘ + Drag         | Ctrl + Drag         | Alt + Drag<br>Right-click + Drag |
| 3D Orbit  | Shift + ⌘ + Drag | Shift + Ctrl + Drag | N/A                              |
| Zoom      | Scroll           | Scroll              | Scroll                           |

## Status

✅ **IMPLEMENTED** - All control improvements complete:

-   ✅ Context menu prevented
-   ✅ Pan direction follows rotation
-   ✅ Mac Command key support
-   ✅ Right-click rotation support
-   ✅ Touch support updated
