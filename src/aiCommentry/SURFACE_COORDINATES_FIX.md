# Surface Coordinates Fix

## Problem

Surfaces were visible in 2D canvas mode but not visible in Three.js-only mode.

**Root Cause**: The `drawSurfaceThreeJS()` function was passing triangle vertices with large world coordinates (UTM values) directly to Three.js, causing precision issues and incorrect positioning. This is the same issue we had with holes before implementing the local coordinate system.

## Solution

Modified `drawSurfaceThreeJS()` to convert all triangle vertices from world coordinates to local Three.js coordinates before creating the mesh.

### Changes Made

**File**: `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/kirra.js`

**Function**: `drawSurfaceThreeJS()` (Line 12145)

**Implementation**:

```javascript
// Step 9a) Convert triangle vertices from world coordinates to local Three.js coordinates
const localTriangles = triangles.map((triangle) => {
    if (!triangle.vertices || triangle.vertices.length !== 3) return triangle;

    const localVertices = triangle.vertices.map((v) => {
        const local = worldToThreeLocal(v.x, v.y);
        return {
            x: local.x,
            y: local.y,
            z: v.z // Keep elevation as-is
        };
    });

    return {
        ...triangle,
        vertices: localVertices
    };
});

// Step 11) Create mesh with vertex colors (using local coordinates)
const surfaceMesh = GeometryFactory.createSurface(localTriangles, colorFunction, transparency);
```

### How It Works

1. **Coordinate Conversion**: Each triangle in the surface is mapped to a new triangle with local coordinates
2. **Vertex Transformation**: For each vertex in each triangle:
    - X and Y coordinates are converted from world to local using `worldToThreeLocal()`
    - Z coordinate (elevation) is kept as-is since it's not a large UTM value
3. **Geometry Creation**: The converted triangles are passed to `GeometryFactory.createSurface()`
4. **Consistency**: This matches the approach used for holes, ensuring all Three.js geometry uses the same coordinate system

### Triangle Structure

```javascript
// Input (world coordinates)
triangle.vertices = [
    { x: 316000.5, y: 6246000.2, z: 1250.3 },
    { x: 316001.2, y: 6246001.8, z: 1251.1 },
    { x: 316002.0, y: 6246000.9, z: 1250.8 }
];

// Output (local coordinates)
triangle.vertices = [
    { x: 0.5, y: 0.2, z: 1250.3 },
    { x: 1.2, y: 1.8, z: 1251.1 },
    { x: 2.0, y: 0.9, z: 1250.8 }
];
```

## Testing

1. Create a surface in Kirra (using triangulation or import)
2. Toggle "Only Show Three.js" checkbox
3. Verify that the surface is now visible in Three.js-only mode
4. Verify that surface colors/gradient are correct
5. Verify that transparency works correctly

## Related Fixes

-   `LOCAL_COORDINATES_FIX.md` - Initial implementation of local coordinate system for holes
-   `COORDINATE_PRECISION_FIX.md` - Camera alignment and viewport calculations

## Technical Notes

### Why Local Coordinates?

Large UTM coordinates (e.g., 316000, 6246000) cause floating-point precision issues in WebGL/Three.js. By using a local origin and converting to small relative coordinates, we maintain precision and correct rendering.

### Local Origin

The local origin is set in `updateThreeLocalOrigin()`:

-   Uses the first hole's position if available
-   Falls back to current centroid
-   All Three.js geometry is positioned relative to this origin

### Coordinate System Consistency

All Three.js drawing functions now use the same local coordinate system:

-   `drawHoleThreeJS()` - converts collar, grade, toe positions
-   `drawSurfaceThreeJS()` - converts triangle vertices (this fix)
-   Camera positioning - converts centroid position
-   Future functions should follow the same pattern

## Status

✅ **FIXED** - Surfaces now render correctly in Three.js-only mode with proper coordinate conversion.
