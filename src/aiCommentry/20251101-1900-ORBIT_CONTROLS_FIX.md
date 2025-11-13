# 3D Orbit Controls and Rotation Persistence Fix

## Problems Fixed

### 1. Rotation Resets During Zoom

**Issue**: When zooming, the Z-axis rotation was being reset to 0, losing the user's rotation angle.

**Root Cause**: The `syncCameraToThreeJS()` function in `kirra.js` was hardcoding rotation to `0`:

```javascript
cameraControls.setCameraState(localCentroid.x, localCentroid.y, currentScale, 0); // Always 0!
```

### 2. Limited Rotation (Z-axis Only)

**Issue**: Camera could only rotate around the Z-axis (2D spin), with no ability to orbit in 3D.

**User Request**: "can we include rotation or orbit as well?"

## Solutions Implemented

### 1. Rotation Persistence

Added a global `currentRotation` variable to track rotation state across zoom operations.

**File**: `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/kirra.js`

**Changes**:

```javascript
// Step 1b) Track current rotation state (in radians)
let currentRotation = 0;

// Updated sync functions
function syncCameraToThreeJS() {
    if (threeInitialized && cameraControls) {
        const localCentroid = worldToThreeLocal(centroidX, centroidY);
        // Preserve current rotation instead of resetting to 0
        cameraControls.setCameraState(localCentroid.x, localCentroid.y, currentScale, currentRotation);
    }
}

function syncCameraFromThreeJS(cameraState) {
    if (cameraState) {
        centroidX = cameraState.centroidX + threeLocalOriginX;
        centroidY = cameraState.centroidY + threeLocalOriginY;
        currentScale = cameraState.scale;

        // Preserve rotation state
        if (cameraState.rotation !== undefined) {
            currentRotation = cameraState.rotation;
        }
    }
}
```

### 2. 3D Orbit Controls

Added full 3D orbit capability with pitch (X-axis) and yaw (Y-axis) rotation.

**Files Modified**:

-   `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/three/CameraControls.js`
-   `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/three/ThreeRenderer.js`

## Camera Control Modes

### Mode 1: Pan (Default)

**Activation**: Click and drag
**Effect**: Moves the view horizontally and vertically

### Mode 2: 2D Rotation (Z-axis Spin)

**Activation**: Hold `Ctrl` or `Alt` + Click and drag
**Effect**: Rotates the view around the center (like spinning a paper on a desk)
**Preserves**: Rotation angle is now maintained during zoom

### Mode 3: 3D Orbit (NEW!)

**Activation**: Hold `Shift + Ctrl` + Click and drag
**Effect**: Orbits the camera around the scene in 3D

-   **Horizontal drag**: Rotates around vertical axis (yaw/azimuth)
-   **Vertical drag**: Rotates around horizontal axis (pitch/elevation)
-   **Pitch clamped**: Prevents camera from flipping upside down

## Implementation Details

### CameraControls.js Changes

#### 1. Added Orbit State

```javascript
this.rotation = 0; // Z-axis rotation (2D spin)
this.orbitX = 0; // X-axis rotation (pitch/elevation)
this.orbitY = 0; // Y-axis rotation (yaw/azimuth)
this.isOrbiting = false; // 3D orbit mode flag
```

#### 2. Updated Mouse Down Handler

```javascript
handleMouseDown(event) {
    // Check for orbit mode (Shift+Ctrl)
    if (event.shiftKey && event.ctrlKey) {
        this.isOrbiting = true;
        console.log("🌐 3D Orbit mode activated");
    }
    // Check for 2D rotation mode (Ctrl or Alt only)
    else if (event.ctrlKey || event.altKey) {
        this.isRotating = true;
        console.log("🔄 2D Rotation mode activated");
    }
    // Default pan mode
    else {
        this.isDragging = true;
        console.log("👆 Pan mode activated");
    }
}
```

#### 3. Added Orbit Mouse Move Logic

```javascript
else if (this.isOrbiting) {
    // 3D Orbit mode (X and Y axis rotation)
    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;

    // Horizontal movement = Y-axis rotation (yaw/azimuth)
    this.orbitY += deltaX * 0.01;

    // Vertical movement = X-axis rotation (pitch/elevation)
    // Clamp pitch to prevent flipping
    this.orbitX += deltaY * 0.01;
    this.orbitX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.orbitX));

    this.threeRenderer.updateCamera(
        this.centroidX, this.centroidY, this.scale,
        this.rotation, this.orbitX, this.orbitY
    );

    return { orbitX: this.orbitX, orbitY: this.orbitY, mode: "orbit" };
}
```

#### 4. Updated State Management

```javascript
setCameraState(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0) {
    this.centroidX = centroidX;
    this.centroidY = centroidY;
    this.scale = scale;
    this.rotation = rotation;
    this.orbitX = orbitX;
    this.orbitY = orbitY;
    this.threeRenderer.updateCamera(centroidX, centroidY, scale, rotation, orbitX, orbitY);
}

getCameraState() {
    return {
        centroidX: this.centroidX,
        centroidY: this.centroidY,
        scale: this.scale,
        rotation: this.rotation,
        orbitX: this.orbitX,
        orbitY: this.orbitY
    };
}
```

### ThreeRenderer.js Changes

#### Updated Camera Positioning

```javascript
updateCamera(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0) {
    const cameraDistance = 1000; // Fixed distance from centroid

    // If orbit angles are non-zero, calculate 3D camera position
    if (orbitX !== 0 || orbitY !== 0) {
        // Spherical to Cartesian conversion
        const x = cameraDistance * Math.cos(orbitX) * Math.sin(orbitY);
        const y = cameraDistance * Math.sin(orbitX);
        const z = cameraDistance * Math.cos(orbitX) * Math.cos(orbitY);

        this.camera.position.set(
            centroidX + x,
            centroidY + y,
            z
        );

        // Look at the centroid
        this.camera.lookAt(centroidX, centroidY, 0);

        // Apply Z-axis rotation (2D spin)
        this.camera.rotateZ(rotation);
    } else {
        // Standard 2D top-down view
        this.camera.position.x = centroidX;
        this.camera.position.y = centroidY;
        this.camera.position.z = 1000;

        // Reset camera rotation to default
        this.camera.rotation.set(0, 0, 0);
        this.camera.up.set(0, 1, 0);

        // Apply Z-axis rotation only
        this.camera.rotation.z = rotation;
    }

    // Update orthographic bounds
    // ... (existing code)
}
```

## How Orbit Works

### Spherical Coordinates

The camera orbits on a sphere of radius 1000 units around the centroid:

-   **orbitX** (pitch): Vertical angle, -90° to +90° (clamped to prevent flipping)
-   **orbitY** (yaw): Horizontal angle, unlimited rotation

### Cartesian Conversion

```javascript
x = distance * cos(pitch) * sin(yaw);
y = distance * sin(pitch);
z = distance * cos(pitch) * cos(yaw);
```

### Look-At Target

Camera always looks at `(centroidX, centroidY, 0)` - the centroid at ground level.

## User Experience

### Visual Feedback

Console messages indicate current mode:

-   "👆 Pan mode activated"
-   "🔄 2D Rotation mode activated"
-   "🌐 3D Orbit mode activated"

### Keyboard Shortcuts

-   **Mouse drag**: Pan
-   **Ctrl + drag**: 2D rotation (Z-axis spin)
-   **Shift + Ctrl + drag**: 3D orbit
-   **Mouse wheel**: Zoom (preserves rotation)

### Rotation Persistence

-   Z-axis rotation is now preserved during:
    -   Zoom operations
    -   Pan operations
    -   Mode switches
-   Orbit angles are independent of Z-axis rotation
-   Can combine 2D spin with 3D orbit

## Testing

1. **Load holes** in Three.js-only mode
2. **Test 2D rotation**:
    - Hold Ctrl, drag to rotate
    - Zoom in/out
    - Verify rotation is maintained
3. **Test 3D orbit**:
    - Hold Shift+Ctrl, drag left/right (yaw)
    - Drag up/down (pitch)
    - Verify camera orbits smoothly
    - Try extreme angles
4. **Test combinations**:
    - Rotate 2D, then orbit 3D
    - Zoom while orbiting
    - Pan while maintaining rotation

## Benefits

1. **Rotation Persistence**: Users won't lose their view angle when zooming
2. **3D Visualization**: Can view terrain/surfaces from any angle
3. **Intuitive Controls**: Standard orbit controls similar to CAD software
4. **Smooth Transitions**: Camera movement is fluid and predictable
5. **No Gimbal Lock**: Pitch clamping prevents camera flipping

## Known Limitations

-   Orbit controls only available in Three.js-only mode
-   Pitch is clamped to ±90° (prevents upside-down view)
-   2D canvas overlay not visible when orbiting (as intended)

## Future Enhancements

Possible additions:

-   Reset rotation button (R key)
-   Damping/smoothing for camera movement
-   Animation transitions between views
-   Preset camera angles (Top, Front, Side, Iso)
-   Touch gesture support for orbit on mobile

## Status

✅ **IMPLEMENTED** - Rotation now persists during zoom, and full 3D orbit controls are available via Shift+Ctrl+drag.
