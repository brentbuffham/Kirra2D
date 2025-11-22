# Camera Roll Controls Update
Date: 2024-11-21 22:00

## Overview
Updated camera controls to use proper nomenclature and fix roll (Z-axis rotation) interaction.

## Nomenclature (for reference)
- **Pan**: Move camera left/right/up/down
- **Tilt**: Rotate camera up/down (pitch)
- **Roll**: Rotate camera around its viewing axis (Z-axis spin)
- **Tumble/Orbit**: Rotate camera around the scene in 3D space (yaw and pitch combined)

## Changes Made

### 1. Camera Roll (Z-axis Rotation) - NEW
**Activation**: `Shift + Alt + Left-click drag`  
**Effect**: Rotates the camera around its focal line (Z-axis spin/2D rotation)  
**Works in**: Both Custom and Arcball control modes  

**Implementation**:
- Added in `CameraControls.js` processMouseDown()
- Added in `ArcballCameraControls.js` handleMouseDown()
- Checks for `event.shiftKey && event.altKey` first (before checking Alt alone)
- Console message: "🔄 Roll mode activated (Shift+Alt held)"

### 2. Tumble/Orbit (3D Rotation) - UPDATED
**Activation**: `Alt + Left-click drag` (unchanged)  
**Effect**: Rotates camera in 3D space around the orbit center  
**Works in**: Both Custom and Arcball control modes  
**Console message**: "🌐 Tumble/Orbit mode activated (Alt held)"

### 3. Right-Click - SIMPLIFIED
**Activation**: Right-click  
**Effect**: Shows contextual menus ONLY (no camera rotation)  
**Removed**: All right-click drag rotation functionality  
**Removed**: Right-click drag delay mechanism  

**Files Modified**:
- `CameraControls.js`: Removed processRightClickDrag() and cancelRightClickDrag() methods
- `CameraControls.js`: Simplified handleMouseDown() to ignore right-clicks entirely
- `ArcballCameraControls.js`: Removed right-click rotation setup

### 4. Pan (Default) - UNCHANGED
**Activation**: Left-click drag  
**Effect**: Moves the view horizontally and vertically  
**Works in**: Both Custom and Arcball control modes  

### 5. Zoom - FIXED
**Activation**: Mouse wheel  
**Effect**: Zooms in/out  
**Works in**: Both Custom and Arcball control modes  
**Fix**: Added fallback values (`|| 0`) in `setCameraState()` to prevent orbit angles from being reset to undefined  

**Implementation in `ArcballCameraControls.js`**:
```javascript
setCameraState(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0) {
    this.centroidX = centroidX;
    this.centroidY = centroidY;
    this.scale = scale;
    this.rotation = rotation || 0;       // Fallback to 0 if undefined
    this.orbitX = orbitX || 0;           // Fallback to 0 if undefined
    this.orbitY = orbitY || 0;           // Fallback to 0 if undefined
    this.threeRenderer.updateCamera(centroidX, centroidY, scale, this.rotation, this.orbitX, this.orbitY);
}
```

## Complete Interaction Map

| Input | Mode | Action |
|-------|------|--------|
| Left-click drag | Pan | Move camera position |
| Alt + Left-click drag | Tumble/Orbit | Rotate camera in 3D |
| Shift + Alt + Left-click drag | Roll | Rotate camera around focal line (Z-axis) |
| Right-click | Menu | Show contextual menus |
| Mouse wheel | Zoom | Zoom in/out |

## Key Detection Order (Important!)
The order of modifier key checks is critical:
1. **First**: Check for `Shift + Alt` (Roll)
2. **Second**: Check for `Alt` only (Tumble/Orbit)
3. **Third**: Default to Pan

This ensures Roll takes precedence over Orbit when both Shift and Alt are held.

## Files Modified
1. `/Kirra2D/src/three/CameraControls.js`
   - Updated processMouseDown() for Roll (Shift+Alt)
   - Updated handleMouseMove() to check for Shift+Alt release
   - Removed processRightClickDrag() method
   - Removed cancelRightClickDrag() method
   - Simplified handleMouseDown() to ignore right-click

2. `/Kirra2D/src/three/ArcballCameraControls.js`
   - Updated handleMouseDown() for Roll (Shift+Alt)
   - Updated handleMouseMove() to check for Shift+Alt release
   - Removed right-click rotation setup
   - Added fallback values in setCameraState() and getCameraState()

## Testing Checklist
- [ ] Shift+Alt+drag rotates camera around Z-axis (Roll) in Custom mode
- [ ] Shift+Alt+drag rotates camera around Z-axis (Roll) in Arcball mode
- [ ] Alt+drag orbits camera in 3D in Custom mode
- [ ] Alt+drag orbits camera in 3D in Arcball mode
- [ ] Left-click drag pans camera in both modes
- [ ] Right-click shows contextual menus (no camera rotation)
- [ ] Mouse wheel zooms without resetting orbit angles
- [ ] Releasing Shift while holding Alt switches from Roll to Orbit
- [ ] Releasing Alt stops Orbit and returns to Pan

## Benefits
1. **Clear Nomenclature**: Using industry-standard camera control terms
2. **No Conflicts**: Right-click is dedicated to context menus
3. **Intuitive**: Shift+Alt for Roll is similar to other 3D applications
4. **Consistent**: Works the same in both Custom and Arcball modes
5. **Bug Fixed**: Zoom no longer resets orbit angles to plan view

## Status
✅ **IMPLEMENTED** - Camera Roll is now accessible via Shift+Alt+drag, right-click is contextual menu only, and zoom preserves orbit angles.

