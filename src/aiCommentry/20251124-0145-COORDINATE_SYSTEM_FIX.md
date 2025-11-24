# 3D Polygon Selection - Coordinate System Fix
**Date**: 2025-11-24 01:45
**Status**: ✅ CRITICAL FIX APPLIED

## The Root Cause

### Problem: Screen Coordinates Were Completely Wrong

Console output showed:
```
Hole 0 - World: 476882.65 6772456.90 280.00 Screen: 3091464.42 -31855844.58
```

**Screen X should be 0-1440, but was 3,091,464!**
**Screen Y should be 0-740, but was -31,855,844!**

### Why This Happened

The world coordinates are real UTM coordinates (hundreds of thousands of meters):
- World X: ~476,882 meters  
- World Y: ~6,772,456 meters

These are HUGE numbers that cause floating-point precision issues in WebGL/Three.js.

### Three.js Uses a Local Coordinate System

To avoid precision problems, Kirra uses a **local coordinate system** in Three.js:
- Sets an origin point from the first hole/data point
- All objects are positioned relative to this local origin
- Internally, Three.js works with small local coordinates (like 71.40, 62.14)

From console:
```
📍 Three.js local origin set from first hole: 476882.64973422576 6772456.90473906
```

### The Bug

I was projecting **world coordinates** directly:
```javascript
// WRONG - Projects huge UTM coordinates
const vector = new THREE.Vector3(worldX, worldY, worldZ);
vector.project(this.camera);
// Result: Screen coordinates in the millions!
```

## The Fix

Convert world coordinates to **local coordinates** BEFORE projecting:

```javascript
// Step 1) Convert world to local coordinates
const localCoords = worldToThreeLocal(worldX, worldY);
// Example: 476882.65 → 0.00 (if it's the origin)
//          476954.05 → 71.40 (71 meters from origin)

// Step 2) Create vector in LOCAL space
const vector = new THREE.Vector3(localCoords.x, localCoords.y, worldZ);

// Step 3) Now projection works correctly
vector.project(this.camera);
// Result: NDC coordinates (-1 to +1)

// Step 4) Convert to screen pixels
const screenX = (vector.x * 0.5 + 0.5) * canvas.width;
const screenY = (vector.y * -0.5 + 0.5) * canvas.height;
// Result: Screen coordinates 0-1440, 0-740
```

## worldToThreeLocal() Function

Already exists in kirra.js (line 324):
```javascript
function worldToThreeLocal(worldX, worldY) {
    return {
        x: worldX - threeLocalOriginX,
        y: worldY - threeLocalOriginY
    };
}
```

Already exposed to window object (line 332):
```javascript
window.worldToThreeLocal = worldToThreeLocal;
```

## Changes Made

**File**: `src/three/PolygonSelection3D.js`

**Method**: `projectToScreen()` (lines ~521-543)

**Before**:
```javascript
projectToScreen(worldX, worldY, worldZ) {
    const vector = new THREE.Vector3(worldX, worldY, worldZ);
    vector.project(this.camera);
    const screenX = (vector.x * 0.5 + 0.5) * this.overlayCanvas.width;
    const screenY = (vector.y * -0.5 + 0.5) * this.overlayCanvas.height;
    return { screenX, screenY };
}
```

**After**:
```javascript
projectToScreen(worldX, worldY, worldZ) {
    // Convert world to local coordinates
    const worldToThreeLocal = window.worldToThreeLocal;
    const localCoords = worldToThreeLocal(worldX, worldY);
    
    // Create vector in LOCAL space
    const vector = new THREE.Vector3(localCoords.x, localCoords.y, worldZ);
    
    // Project and convert to screen
    vector.project(this.camera);
    const screenX = (vector.x * 0.5 + 0.5) * this.overlayCanvas.width;
    const screenY = (vector.y * -0.5 + 0.5) * this.overlayCanvas.height;
    return { screenX, screenY };
}
```

## Expected Results Now

When you test again, console should show:
```
Hole 0 (1):
  World: 476882.65 6772456.90 280.00
  Local: 0.00 0.00
  Screen: 720.0 370.0
  Inside polygon: [true/false]

Hole 1 (2):
  World: 476873.26 6772460.35 280.00
  Local: -9.39 3.45
  Screen: 685.2 362.8
  Inside polygon: [true/false]
```

- **World coordinates**: Large UTM values (hundreds of thousands)
- **Local coordinates**: Small relative values (-100 to +100 typically)
- **Screen coordinates**: Valid screen pixels (0-1440, 0-740)

Now the point-in-polygon test will actually work because screen coordinates are in the correct range!

## Why This Matters

✅ **Screen coordinates now in valid range** (0-1440, 0-740)
✅ **Point-in-polygon tests will work** (comparing valid coordinates)
✅ **Holes inside polygon will be selected** correctly
✅ **Matches how 3D rendering already works** (uses local coordinates throughout)

## Testing Checklist

- [ ] Screen X coordinates are 0-1440 (not millions)
- [ ] Screen Y coordinates are 0-740 (not millions)
- [ ] Local coordinates are small relative values
- [ ] Some holes show "Inside polygon: true"
- [ ] Selected holes get highlighted in 3D view
- [ ] Status shows "Selected N holes" where N > 0

