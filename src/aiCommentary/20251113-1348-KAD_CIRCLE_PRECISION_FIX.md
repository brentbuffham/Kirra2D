# KAD Circle Precision Fix - Matching 2D Coordinate Transformation

## Problem

KAD circles in the 3D ThreeJS canvas had precision issues and did not match the 2D canvas rendering. The circles appeared offset or distorted when working with large UTM coordinates (e.g., 477040, 6772549).

**Root Cause**: The `createKADCircle()` function in `GeometryFactory.js` (lines 348-385) was embedding large world coordinates directly into the vertex positions array, causing floating-point precision errors.

```javascript
// BEFORE - WRONG (Line 369)
positions.push(x + worldX, y + worldY, worldZ);
```

This violated the established coordinate system pattern where:
1. Geometry should be created centered at origin (0, 0, 0)
2. The mesh should then be positioned at the desired world/local coordinates
3. This avoids floating-point precision loss with large UTM coordinates

## Solution

Modified both `GeometryFactory.createKADCircle()` and `createCircle.js` to follow the same pattern used by `createKADPoint()` and other geometry functions:

### 1. GeometryFactory.createKADCircle() Fix

**File**: `Kirra2D/src/three/GeometryFactory.js` (Lines 348-386)

**Changes**:
- Create circle geometry centered at (0, 0, 0)
- Position the mesh at (worldX, worldY, worldZ) after creation

```javascript
// Step 12b) Create circle points centered at (0, 0, 0) for precision
const segments = 64;
const positions = [];
for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    positions.push(x, y, 0); // Centered at origin
}

// ... create geometry and MeshLine ...

// Step 12e) Create mesh and position it at world coordinates
const circleMesh = new THREE.Mesh(circle.geometry, material);
circleMesh.position.set(worldX, worldY, worldZ);
```

### 2. createCircle.js Fix

**File**: `Kirra2D/src/three/shapes/createCircle.js` (Lines 40-60)

**Changes**:
- Same pattern: create centered geometry, then position mesh

```javascript
// Step 1) Create circle centered at origin for precision
for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    positions.push(x, y, 0); // Centered at origin
}

// ... create geometry and MeshLine ...

// Step 2) Position the mesh at the desired location
circleMesh.position.set(vector.x, vector.y, vector.z);
```

## How It Works

### Coordinate Flow

1. **World Coordinates** (kirra.js, lines 18618-18619):
   ```javascript
   const local = worldToThreeLocal(centerX, centerY);
   drawKADCircleThreeJS(local.x, local.y, centerZ, ...);
   ```

2. **Local Coordinates** (canvas3DDrawing.js, line 239):
   ```javascript
   const circleMesh = GeometryFactory.createKADCircle(worldX, worldY, worldZ, ...);
   ```

3. **Geometry Creation** (GeometryFactory.js):
   - Circle points created at origin: `positions.push(x, y, 0)`
   - Mesh positioned at local coords: `circleMesh.position.set(worldX, worldY, worldZ)`

4. **Rendering** (ThreeJS):
   - Camera positioned relative to local origin
   - All geometry rendered with proper precision

### Consistency with Other Geometry

This fix ensures KAD circles follow the same pattern as:

- **createKADPoint()** (Line 264-275):
  ```javascript
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(worldX, worldY, worldZ);
  ```

- **createHole()** (Lines 11-121):
  - Receives local coordinates after worldToThreeLocal conversion
  - Creates geometry with those local coordinates
  - Camera/scene positioned relative to local origin

## Benefits

1. **Precision**: Avoids floating-point errors with large UTM coordinates
2. **Consistency**: Matches pattern used by all other geometry creation functions
3. **Alignment**: 3D circles now perfectly match 2D canvas circles
4. **Scalability**: Works correctly at any zoom level or rotation

## Testing

Verify circles align correctly:
1. Load data with large UTM coordinates (400,000+)
2. Create KAD circles in both 2D and 3D views
3. Zoom in/out to verify no jitter or misalignment
4. Rotate 3D view to verify circles maintain position
5. Pan across scene to verify precision maintained

## Related Documentation

- `LOCAL_COORDINATES_FIX.md` - Original local coordinate system implementation
- `COORDINATE_PRECISION_FIX.md` - Camera coordinate matching between 2D/3D
- `SURFACE_COORDINATES_FIX.md` - Similar fix for surface triangles

