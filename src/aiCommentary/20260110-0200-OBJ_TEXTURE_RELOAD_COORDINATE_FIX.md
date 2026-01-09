# OBJ Textured Mesh Reload Coordinate Transform Fix

**Date:** 2026-01-10 02:00
**Status:** FIXED ✅
**Issue:** Textured OBJ meshes visible on initial import but invisible after page reload

## Problem Summary

Textured OBJ/MTL/JPG meshes imported via Three.js OBJLoader and MTLLoader would display correctly on initial load but become invisible after page reload from IndexedDB. All diagnostics showed correct material properties, texture loading, and UV coordinates, but the mesh was not visible in the 3D viewport.

## Root Cause

The issue was a **coordinate transformation mismatch** between initial load and rebuild:

### Initial Load (Working)
- **OBJLoader behavior**: Automatically centers vertices around mesh origin
- **Vertex coordinates**: Relative to mesh center (e.g., -190.94, 142.25)
- **Mesh group position**: Positioned at mesh center in local Three.js space (190.94, -142.25)
- **Result**: Mesh appears at correct location in viewport

### Reload from IndexedDB (Broken)
- **OBJ content stored**: Raw OBJ file with world coordinates (UTM: 478478, 6772462)
- **Rebuild parsing**: OBJLoader parsed raw OBJ → vertices in world coords
- **Mesh group position**: Positioned at mesh center offset (190.94, -142.25)
- **Actual vertex position**: Group position + vertex world coords = (478669, 6772319)
- **Result**: Mesh rendered millions of units away from camera (on Mars!)

## Key Diagnostic Evidence

**Initial Load:**
```
First vertex (local coords): (-190.94, 142.25, 382.56)
Mesh group position: (190.94, -142.25, 0.00)
Camera position: (173.72, -149.41, 5000.00)
```

**Reload (Before Fix):**
```
First vertex (local coords): (478478.06, 6772462.00, 382.56)  ← WORLD COORDS!
Mesh group position: (190.94, -142.25, 0.00)
Camera position: (190.94, -142.25, 5000.00)
```

## Solution

Transform OBJ vertices during rebuild to match OBJLoader's initial behavior by centering them around the mesh origin.

### Code Changes

**File:** `src/kirra.js` - `rebuildTexturedMesh()` function

Added vertex transformation after parsing OBJ content:

```javascript
// Step 5a) CRITICAL FIX: Transform OBJ vertices from world coordinates to mesh-centered coordinates
// The OBJ file stores vertices in world coordinates (UTM)
// We need to center them around the mesh origin (like OBJLoader does on first load)
// Then the mesh group will be positioned at mesh center in local Three.js space
var meshCenterX = surface.meshBounds ? (surface.meshBounds.minX + surface.meshBounds.maxX) / 2 : 0;
var meshCenterY = surface.meshBounds ? (surface.meshBounds.minY + surface.meshBounds.maxY) / 2 : 0;

console.log("🎨 REBUILD: Centering OBJ vertices around mesh center: (" + meshCenterX.toFixed(2) + ", " + meshCenterY.toFixed(2) + ")");

object3D.traverse(function(child) {
    if (child.isMesh && child.geometry) {
        var positions = child.geometry.attributes.position;
        if (positions) {
            var posArray = positions.array;
            // Transform each vertex: subtract mesh center from X and Y to center around origin
            for (var i = 0; i < posArray.length; i += 3) {
                posArray[i] -= meshCenterX;     // X coordinate
                posArray[i + 1] -= meshCenterY;  // Y coordinate
                // Z coordinate stays as-is (elevation)
            }
            positions.needsUpdate = true;
            child.geometry.computeBoundingSphere(); // Recompute bounding sphere after transform
            console.log("🎨 REBUILD: Centered " + (posArray.length / 3) + " vertices around mesh origin");
        }
    }
});
```

**File:** `src/draw/canvas3DDrawing.js` - `drawSurfaceThreeJS()` function

No changes needed - mesh group positioning already correct:

```javascript
// Get mesh center from surfaceData (world coordinates)
var meshCenterWorldX = surfaceData.meshBounds ? (surfaceData.meshBounds.minX + surfaceData.meshBounds.maxX) / 2 : 0;
var meshCenterWorldY = surfaceData.meshBounds ? (surfaceData.meshBounds.minY + surfaceData.meshBounds.maxY) / 2 : 0;

// Convert mesh center from world to local coordinates
var meshCenterLocalX = meshCenterWorldX - originX;
var meshCenterLocalY = meshCenterWorldY - originY;

// Position the mesh group
texturedMesh.position.set(meshCenterLocalX, meshCenterLocalY, 0);
```

## Verification

**After Fix:**
```
🎨 REBUILD: Centering OBJ vertices around mesh center: (478669.00, 6772319.75)
🎨 REBUILD: Centered 18660 vertices around mesh origin
First vertex (local coords): (-190.94, 142.25, 382.56)  ← CORRECT!
Mesh group position: (190.94, -142.25, 0.00)
Camera position: (190.94, -142.25, 5000.00)
```

Vertices now match initial load behavior - centered around mesh origin.

## Lessons Learned

1. **User was correct from the start** - Issue diagnosed as coordinate system problem early on, but was initially dismissed in favor of material/lighting/texture investigations
2. **Compare behaviors directly** - Should have compared vertex positions between first load and reload immediately
3. **UTM coordinates are large** - Kirra always works in UTM coordinates (hundreds of thousands of meters), requiring careful coordinate transformations for Three.js
4. **Three.js expects local coordinates** - All geometry must be transformed to local space relative to `threeLocalOriginX/Y`
5. **OBJLoader centers vertices automatically** - When manually parsing OBJ files, must replicate this centering behavior

## Related Files

- `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/kirra.js` - Line ~12428 (rebuildTexturedMesh)
- `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/draw/canvas3DDrawing.js` - Line ~580 (mesh positioning)
- `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/aiCommentary/IMPLEMENTATION_FIX_2026-01-09_OBJ_TEXTURE.md` - Previous investigation (incorrect approach)

## Testing

1. Clear IndexedDB
2. Import textured OBJ/MTL/JPG files
3. Verify texture visible in 3D mode (gradient = "texture")
4. Reload page (F5)
5. Switch to 3D mode, set gradient to "texture"
6. Verify texture still visible ✅

## Performance Impact

Minimal - one-time vertex transformation during rebuild (O(n) where n = vertex count, typically 10k-50k vertices). Transformation takes ~10-50ms for typical meshes.

## Future Considerations

- All OBJ imports must remember to center vertices around mesh origin if parsing manually
- Consider storing transformed vertices in IndexedDB to avoid rebuild transformation
- Document UTM → Local coordinate transform requirements in CLAUDE.md
