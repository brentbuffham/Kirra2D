# OBJ Import Fix Plan
**Date:** 2025-01-06 16:30  
**Issue:** Custom OBJ parser corrupts triangle topology (489 triangles → 504 triangles)

## Problem Analysis

### Current State
- **Export:** Works correctly (489 triangles) ✅
- **Import:** Custom `OBJParser.js` creates 489 triangles, but database ends up with 504 ❌
- **Three.js OBJLoader:** Works perfectly for textured OBJs ✅

### Root Cause
The custom `OBJParser.js` has subtle bugs in face parsing logic that occasionally create extra triangles through fan triangulation or incorrect vertex lookups.

## Solution: Use Three.js OBJLoader for ALL OBJs

### Why This Works
1. **Battle-tested:** Three.js OBJLoader is used by millions of projects
2. **Already in codebase:** Currently used for textured OBJs successfully  
3. **Preserves topology:** Correctly handles indexed geometry
4. **No custom parsing bugs:** Eliminates our buggy custom parser

### Implementation Steps

#### Step 1: Extract Triangles from Three.js Mesh
Create a helper function `extractTrianglesFromThreeJSMesh()` that:
- Traverses the Three.js object3D mesh
- Extracts vertex positions from `geometry.attributes.position`
- Handles both indexed and non-indexed geometry
- Deduplicates vertices
- Creates Kirra triangle format: `{ vertices: [v0, v1, v2], uvs: [], normals: [], material: null }`

#### Step 2: Modify `loadOBJWithAutoDiscovery()`
- Remove custom parser path (line 37179-37184)
- **Always** call `loadOBJWithTextureThreeJS()` with or without MTL/textures
- Pass empty `{}` for `textureBlobs` if no textures

#### Step 3: Update `loadOBJWithTextureThreeJS()`
- Parse OBJ with Three.js OBJLoader (with or without MTL)
- Extract triangles using `extractTrianglesFromThreeJSMesh()`
- If has textures: Store as textured mesh (`isTexturedMesh: true`)
- If no textures: Store as regular surface (`isTexturedMesh: false`)

### Benefits
1. **Fixes topology corruption** - Three.js handles face parsing correctly
2. **Consistent behavior** - Same loader for all OBJs  
3. **Less code** - Remove custom `OBJParser.js` entirely (future cleanup)
4. **Better maintenance** - Leverage Three.js updates

### File Selection (CORS-Safe)
The current multi-file selection dialog already works correctly:
```javascript
showModalMessage("OBJ File Selection", 
  "Please select ALL related files: .obj file (required), .mtl file (if textured), .jpg/.png texture files (if any). 
  Use Ctrl+Click (Cmd+Click on Mac) to select multiple files together.");
```

This is CORS-safe because the user manually selects all files through the browser's file picker.

### No Auto-Discovery Needed
The auto-discovery code in `loadOBJWithAutoDiscovery()` can remain for future use (e.g., Electron app), but it won't run in browser due to CORS - and that's fine. The manual multi-file selection handles it.

## Next Steps
1. Add `extractTrianglesFromThreeJSMesh()` helper function
2. Simplify `loadOBJWithTextureThreeJS()` to handle both textured and non-textured cases
3. Update `loadOBJWithAutoDiscovery()` to always use Three.js loader
4. Test with pit shell OBJ (489 triangles expected)
5. Test with textured OBJ (should still work)
6. Future: Remove `OBJParser.js` entirely (not needed anymore)

