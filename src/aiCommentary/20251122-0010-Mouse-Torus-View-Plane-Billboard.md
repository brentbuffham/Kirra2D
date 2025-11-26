# Mouse Torus View Plane and Billboard Fix
**Date:** 2025-11-22  
**Time:** 00:10  
**Files Modified:**
- `Kirra2D/src/three/InteractionManager.js`
- `Kirra2D/src/three/ThreeRenderer.js`
- `Kirra2D/src/three/GeometryFactory.js`
- `Kirra2D/src/draw/canvas3DDrawing.js`
- `Kirra2D/src/kirra.js`

## Problem
The mouse position torus was incorrectly positioned on the world XY plane (horizontal ground plane) instead of the camera's view plane (frustum plane). This caused the torus to "disappear" when looking at the scene from oblique angles, as it was stuck on the ground rather than floating at the cursor position in the camera's view.

## Solution Overview
Implemented a three-part solution:

1. **View Plane Raycasting**: Added `getMouseWorldPositionOnViewPlane()` method to calculate mouse position on a plane perpendicular to the camera's view direction
2. **Billboard Rendering**: Made the torus face the camera at all times (billboard effect)
3. **Smart Position Priority**: Use hit objects first, then view plane, then ground plane

## Technical Details

### 1. View Plane Calculation (`InteractionManager.js`)

Added `getMouseWorldPositionOnViewPlane()` method (lines ~189-248):

```javascript
getMouseWorldPositionOnViewPlane(centerPoint = null) {
    // Get camera view direction
    const viewDirection = new THREE.Vector3();
    currentCamera.getWorldDirection(viewDirection);
    
    // Create plane perpendicular to camera, passing through orbit center
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(viewDirection, planeCenter);
    
    // Raycast to find intersection
    const intersectionPoint = new THREE.Vector3();
    const hasIntersection = this.raycaster.ray.intersectPlane(plane, intersectionPoint);
    
    return { x: worldX, y: worldY, z: worldZ };
}
```

**Key Concept:** The view plane is perpendicular to the camera's look direction and passes through the orbit center. This ensures the torus appears at the cursor location regardless of camera angle.

### 2. Billboard Rendering

#### GeometryFactory.js
Updated `createMousePositionIndicator()` to accept a `billboard` parameter (default: true). When enabled, marks the torus mesh for billboarding via `userData.billboard = true`.

#### ThreeRenderer.js
Added `updateBillboardedObjects()` method (lines ~623-630):
```javascript
updateBillboardedObjects() {
    this.connectorsGroup.traverse((object) => {
        if (object.userData && object.userData.billboard) {
            object.quaternion.copy(this.camera.quaternion);
        }
    });
}
```

Called in `render()` method before rendering each frame, ensuring the torus always faces the camera.

#### canvas3DDrawing.js
Updated `drawMousePositionIndicatorThreeJS()` to:
- Pass `true` for billboard parameter
- Explicitly mark torus meshes for billboarding

### 3. Smart Position Logic (`kirra.js`)

Updated `handle3DMouseMove()` with priority-based positioning:

1. **Hit Object** (highest priority): If raycast hits an object, use that position
2. **View Plane**: If no hit, use view plane intersection (torus at cursor)
3. **Ground Plane**: For interactions (stadium zones, etc.), still use ground plane
4. **Camera Centroid** (fallback): If all else fails

```javascript
// Calculate view plane position for torus
let torusWorldPos = null;
if (interactionManager && typeof interactionManager.getMouseWorldPositionOnViewPlane === "function") {
    torusWorldPos = interactionManager.getMouseWorldPositionOnViewPlane();
}

// Priority logic for indicator
let indicatorPos = null;
if (intersects && intersects.length > 0 && mouseWorldPos) {
    indicatorPos = mouseWorldPos; // Hit object
} else if (torusWorldPos) {
    indicatorPos = torusWorldPos; // View plane
} else {
    indicatorPos = fallbackPos; // Camera centroid
}
```

## Benefits

1. **Always Visible**: Torus now appears at cursor position regardless of camera angle
2. **Selection Tunnel**: The torus forms a conceptual "tunnel" perpendicular to the screen - objects within this tunnel are selectable
3. **Correct Raycasting**: Objects behind the torus (further from camera) are still selectable through the torus ring
4. **No Disappearing**: Torus no longer gets "lost" when viewing from oblique angles
5. **Dual Planes**: Interactions (stadium zones) still use ground plane, but torus uses view plane

## Coordinate System Context

- **Z-Up World**: X=Easting, Y=Northing, Z=Elevation
- **View Plane**: Perpendicular to camera look direction, passes through orbit center
- **Ground Plane**: Horizontal at Z=orbitCenterZ, used for interactions
- **Billboard**: Torus rotates to match camera quaternion each frame

## Testing Recommendations

1. **Oblique Views**: Rotate camera to extreme angles - torus should remain visible at cursor
2. **Object Selection**: Click objects through the torus - raycasting should work correctly
3. **Stadium Zones**: Multi-connector mode should still create zones on ground plane
4. **Performance**: Billboard update runs every frame - monitor FPS with many objects
5. **Z-Axis Lock**: With Z-lock fix, orbit around data while torus tracks cursor

## Related Files

- Previous fix: `20251122-0000-Z-Axis-Singularity-Fix.md`
- Coordinate system: Z-up (from previous camera fixes)
- Raycasting: Uses Three.js Raycaster with orthographic camera

