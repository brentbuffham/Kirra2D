# OBJ-MTL-Texture Import Enhancement

## Date
2025-11-26 12:00

## Overview

Enhanced the OBJ import system to properly load OBJ-MTL-JPG files for textured 3D rendering in ThreeJS mode, while creating a georeferenced flattened image for 2D canvas mode.

## Changes Made

### 1. Enhanced OBJ Parser (`parseOBJFile()` - Line ~33285)

The parser now extracts:
- Vertex positions (v lines)
- Texture coordinates (vt lines)
- Vertex normals (vn lines)
- Face indices (f lines) with fan triangulation
- Material library references (mtllib)
- Material usage (usemtl)

Returns rich data structure including:
- `points` - backward compatible vertex array
- `vertices`, `faces`, `uvs`, `normals` - detailed mesh data
- `triangles` - Kirra-format triangles with minZ/maxZ
- `hasTexture`, `hasFaces` - flags
- `materialLibrary`, `materialGroups` - material info

### 2. Three.js Loader Integration (Lines ~28-35)

Added imports:
```javascript
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
```

### 3. New Functions Added

#### `loadOBJWithMTL()` (Line ~7452)
- Detects MTL and texture files (JPG/PNG) in upload
- Routes to `loadOBJWithTextureThreeJS()` for textured meshes
- Falls back to existing point cloud method for non-textured OBJs

#### `loadOBJWithTextureThreeJS()` (Line ~7530)
- Creates Three.js mesh with proper texture binding
- Uses MTLLoader + OBJLoader for material handling
- Stores mesh in `loadedSurfaces` with all necessary data
- Triggers `flattenTexturedMeshToImage()` for 2D rendering

#### `rebuildTexturedMesh()` (Line ~7662)
- Rebuilds Three.js mesh from stored OBJ/MTL/texture data
- Called on app reload when surfaces are loaded from IndexedDB
- Re-creates blob URLs for textures

#### `flattenTexturedMeshToImage()` (Line ~7760)
- Creates orthographic top-down render of textured mesh
- Stores as georeferenced image in `loadedImages`
- Uses mesh XY bounds for proper world coordinate alignment
- Resolution up to 2048px, maintains aspect ratio

### 4. Surface Data Structure Extension

`loadedSurfaces` entries now support:
```javascript
{
    // Standard fields
    id, name, points, triangles, visible, gradient, transparency,
    
    // Textured mesh fields
    isTexturedMesh: true,
    threeJSMesh: Object3D,      // Runtime mesh (not persisted)
    objContent: string,          // For DB persistence
    mtlContent: string,          // For DB persistence
    textureBlobs: { name: Blob }, // For DB persistence
    meshBounds: { minX, maxX, minY, maxY, minZ, maxZ }
}
```

### 5. Database Persistence

#### `saveSurfaceToDB()` (Line ~23439)
- Now stores `isTexturedMesh`, `objContent`, `mtlContent`, `textureBlobs`, `meshBounds`

#### `loadAllSurfacesIntoMemory()` (Line ~23535)
- Detects textured surfaces via `isTexturedMesh` flag
- Calls `rebuildTexturedMesh()` to recreate Three.js mesh on reload

### 6. 3D Rendering Update

#### `drawSurfaceThreeJS()` (canvas3DDrawing.js ~Line 357)
- Checks for `isTexturedMesh` flag
- Uses pre-loaded `threeJSMesh` for textured surfaces
- Falls back to standard vertex-colored rendering otherwise

## Data Flow

```
Upload OBJ+MTL+JPG
        |
        v
loadOBJWithMTL()
  - Parse files
  - Create Three.js mesh
        |
   +----+----+
   |         |
   v         v
loadedSurfaces    flattenTexturedMeshToImage()
  |                       |
  v                       v
saveSurfaceToDB()   loadedImages
  |                 (georeferenced)
  v
IndexedDB
  |
  v (on reload)
loadAllSurfacesIntoMemory()
  |
  v
rebuildTexturedMesh()
```

## App Reload Sequence

1. `loadAllSurfacesIntoMemory()` runs
2. Surface entry restored - appears in Data Explorer immediately
3. If `isTexturedMesh: true`:
   - `rebuildTexturedMesh()` called
   - Creates Three.js mesh from stored OBJ/MTL/texture Blob
   - `flattenTexturedMeshToImage()` recreates 2D image
4. 3D view ready with textured mesh
5. 2D view has georeferenced flattened image

## Files Modified

- `src/kirra.js` - Main implementation
- `src/draw/canvas3DDrawing.js` - 3D rendering update for textured meshes

---

## Update: Auto-Discovery of Companion Files

### Problem
When loading an OBJ file via `loadPointCloudFile()`, the user had to manually select MTL and texture files. Other point cloud formats (xyz, csv, asc, txt, pts, ply) don't need companion files.

### Solution
Modified `loadPointCloudFile()` to:
1. Detect OBJ files and route to new `loadOBJWithAutoDiscovery()` function
2. Other formats continue using standard point cloud loading

### New Functions Added

#### `loadOBJWithAutoDiscovery()` (Line ~33640)
- Parses OBJ to check for material library reference
- Attempts auto-discovery via File System Access API
- Falls back to fetch-based discovery for server-hosted files
- Routes to appropriate loader based on what's found

#### `discoverCompanionFiles()` (Line ~33730)
- Uses File System Access API directory handle
- Scans for MTL files with matching base name
- Scans for texture files (JPG, PNG, etc.)

#### `discoverCompanionFilesViaFetch()` (Line ~33770)
- For server-hosted files
- Fetches MTL from same directory
- Parses MTL to find texture references
- Fetches referenced textures

#### `extractTextureRefsFromMTL()` (Line ~33830)
- Parses MTL content for texture references
- Looks for map_Kd, map_Ka, map_Ks, map_Bump, bump lines

#### `createSurfaceFromOBJData()` (Line ~33850)
- Creates surface using original OBJ face topology
- Preserves mesh structure without re-triangulation
- Falls back to Delaunator if no faces found

### Auto-Discovery Flow

```
OBJ File Selected
      |
      v
loadOBJWithAutoDiscovery()
      |
      +-- Try File System Access API
      |       |
      |       v
      |   discoverCompanionFiles()
      |       |
      |       +-- Found MTL + textures --> loadOBJWithTextureThreeJS()
      |       +-- Found MTL only --------> loadOBJWithTextureThreeJS()
      |       +-- Not found -------------> Continue below
      |
      +-- Try fetch-based discovery
      |       |
      |       v
      |   discoverCompanionFilesViaFetch()
      |       |
      |       +-- Found --> loadOBJWithTextureThreeJS()
      |       +-- Not found --> Continue below
      |
      +-- Check OBJ structure
              |
              +-- Has faces --> createSurfaceFromOBJData()
              +-- No faces ---> processSurfacePoints() (point cloud)
```

### Benefits
- OBJ files automatically get MTL/texture support when available
- Point cloud formats (xyz, csv, etc.) unaffected
- Original mesh topology preserved when OBJ has faces
- Graceful fallback to point cloud if no faces found

