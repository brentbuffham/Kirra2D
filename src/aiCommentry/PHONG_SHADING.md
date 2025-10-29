# Phong Shading for Surfaces

## Enhancement

Added Phong shading to surface rendering in Three.js for realistic 3D lighting and depth perception.

## Changes Made

**File**: `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/three/GeometryFactory.js`

**Function**: `createSurface()` (Line 219)

### Before

```javascript
const material = new THREE.MeshBasicMaterial({
    vertexColors: colors.length > 0,
    side: THREE.DoubleSide,
    transparent: transparency < 1.0,
    opacity: transparency
});
```

### After

```javascript
const material = new THREE.MeshPhongMaterial({
    vertexColors: colors.length > 0,
    side: THREE.DoubleSide,
    transparent: transparency < 1.0,
    opacity: transparency,
    shininess: 30,
    specular: 0x222222,
    flatShading: false
});
```

## What Changed

**Material Type**: `MeshBasicMaterial` → `MeshPhongMaterial`

**New Properties**:

-   `shininess: 30` - Moderate shininess for subtle highlights
-   `specular: 0x222222` - Dark gray specular highlights (subtle, not too bright)
-   `flatShading: false` - Smooth shading using vertex normals for better terrain appearance

**Preserved Properties**:

-   `vertexColors` - Maintains elevation gradient colors
-   `side: DoubleSide` - Visible from both sides
-   `transparent` & `opacity` - Transparency support

## Benefits

1. **Realistic Depth**: Phong shading responds to scene lighting, showing elevation changes more clearly
2. **Better Visualization**: Terrain features (hills, valleys) are more visible with shading
3. **3D Appearance**: Surfaces look properly three-dimensional instead of flat
4. **Preserved Colors**: Vertex colors (elevation gradients) are maintained and enhanced by lighting

## How It Works

### Phong Shading Model

Phong shading calculates lighting per-pixel using:

-   **Ambient**: Base illumination from ambient light
-   **Diffuse**: Surface color based on light angle (vertex colors preserved)
-   **Specular**: Highlights based on view angle and shininess

### Lighting Setup

The scene already has lights configured in `ThreeRenderer.js`:

```javascript
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1);
```

### Normal Calculation

```javascript
geometry.computeVertexNormals();
```

This is already called before material creation, providing smooth normals for Phong shading.

## Visual Impact

**Before (MeshBasicMaterial)**:

-   Flat appearance
-   No depth perception
-   Colors only show elevation
-   No response to lighting

**After (MeshPhongMaterial)**:

-   3D depth visible
-   Terrain features pronounced
-   Colors enhanced by lighting
-   Subtle specular highlights on peaks

## Testing

1. Load a surface with elevation variation
2. Toggle "Only Show Three.js" checkbox
3. Observe the shading on the surface:
    - Peaks should be brighter (facing light)
    - Valleys should be darker (away from light)
    - Subtle highlights on high points
4. Pan/zoom to see lighting from different angles
5. Verify elevation colors are still visible
6. Test transparency still works

## Performance

**Impact**: Minimal

-   Phong shading is hardware-accelerated
-   Modern GPUs handle this efficiently
-   No noticeable performance difference for typical surface sizes

## Future Enhancements

Possible additions:

-   Adjustable shininess/specular via UI controls
-   Optional flat shading for faceted appearance
-   Environment maps for reflections
-   Normal maps for fine detail

## Status

✅ **IMPLEMENTED** - Surfaces now use Phong shading for realistic 3D appearance while preserving elevation gradient colors.
