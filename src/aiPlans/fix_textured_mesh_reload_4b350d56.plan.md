---
name: Fix Textured Mesh Reload
overview: Fix the race condition where textured OBJ meshes lose their texture on browser reload. The issue is that `loadAllSurfacesIntoMemory()` resolves before `rebuildTexturedMesh()` completes, causing `drawData()` to render surfaces before textures are ready.
todos:
  - id: promise-rebuild
    content: Convert rebuildTexturedMesh() to return a Promise
    status: completed
  - id: await-rebuilds
    content: Modify loadAllSurfacesIntoMemory() to await all textured mesh rebuilds
    status: completed
    dependencies:
      - promise-rebuild
---

# Fix Textured OBJ Mesh Display on Browser Reload

## Root Cause Analysis

The issue is a **timing race condition** in the reload flow:

```mermaid
sequenceDiagram
    participant Load as loadAllSurfacesIntoMemory
    participant Rebuild as rebuildTexturedMesh
    participant Draw as drawData/drawSurfaceThreeJS
    
    Load->>Load: Load surface data from IndexedDB
    Load->>Load: Set threeJSMesh = null
    Load->>Rebuild: Schedule via setTimeout (50ms stagger)
    Load-->>Load: resolve() immediately
    Note over Load,Draw: Race condition here!
    Load->>Draw: zoomToFitAll calls drawData
    Draw->>Draw: Check threeJSMesh = null
    Draw->>Draw: Falls through to standard rendering (no texture)
    Note over Rebuild: Still loading textures...
    Rebuild->>Rebuild: Promise.all completes
    Rebuild->>Rebuild: Store threeJSMesh = object3D
    Rebuild->>Rebuild: Remove old mesh from scene
    Note over Rebuild: No redraw triggered!
```

**Key Problem**: `loadAllSurfacesIntoMemory()` calls `resolve()` at line 24535 BEFORE the textured meshes are rebuilt. By the time `drawData()` runs, `surface.threeJSMesh` is still `null`.

## Solution

Convert `rebuildTexturedMesh()` to return a Promise and have `loadAllSurfacesIntoMemory()` await all rebuilds before resolving.

### Changes in [kirra.js](Kirra2D/src/kirra.js)

**1. Modify `rebuildTexturedMesh()` (line 8495) to return a Promise:**

- Wrap the function body in `return new Promise()`
- Move the `Promise.all(texturePromises).then()` to use `resolve()` 
- Handle errors with `reject()`
- This ensures callers can await the full texture loading and mesh creation

**2. Modify `loadAllSurfacesIntoMemory()` (line 24524-24535) to await all rebuilds:**

Current code schedules rebuilds via `setTimeout` and resolves immediately:
```javascript
texturedSurfaceIds.forEach(function (surfaceId, index) {
    setTimeout(function () {
        rebuildTexturedMesh(surfaceId);
    }, index * 50);
});
resolve(); // Resolves before rebuilds complete!
```

Change to:
```javascript
// Build array of promises for all textured mesh rebuilds
var rebuildPromises = texturedSurfaceIds.map(function (surfaceId) {
    return rebuildTexturedMesh(surfaceId);
});

// Wait for ALL rebuilds to complete before resolving
Promise.all(rebuildPromises).then(function () {
    console.log("All textured meshes rebuilt");
    resolve();
}).catch(function (error) {
    console.error("Error rebuilding textured meshes:", error);
    resolve(); // Still resolve to continue app loading
});
```

### Expected Result After Fix

```mermaid
sequenceDiagram
    participant Load as loadAllSurfacesIntoMemory
    participant Rebuild as rebuildTexturedMesh
    participant Draw as drawData/drawSurfaceThreeJS
    
    Load->>Load: Load surface data from IndexedDB
    Load->>Load: Set threeJSMesh = null
    Load->>Rebuild: Call rebuildTexturedMesh (returns Promise)
    Rebuild->>Rebuild: Load textures via Promise.all
    Rebuild->>Rebuild: Parse OBJ with materials
    Rebuild->>Rebuild: Store threeJSMesh = object3D
    Rebuild-->>Load: Promise resolves
    Load-->>Load: All rebuilds complete, resolve()
    Load->>Draw: zoomToFitAll calls drawData
    Draw->>Draw: Check threeJSMesh = valid mesh
    Draw->>Draw: Renders textured mesh correctly
```

## Additional Cleanup (per user request)

Remove `onlyShowThreeJS` flag usage and ensure 2D/3D mode is controlled by `dimension2D-3DBtn.checked`.