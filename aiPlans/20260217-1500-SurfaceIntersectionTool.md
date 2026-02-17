# Surface Intersection Tool

**Date:** 2026-02-17
**Status:** Plan

## Overview

Add a "Surface Intersection" tool to the Surface toolbar that selects 2+ loaded surfaces, computes 3D triangle-mesh intersections (Moller method), simplifies the result by vertex spacing, and stores closed KAD polygon entities.

## Architecture

Same pattern as Flyrock Shroud: button → dialog → helper → KAD output.

```
Toolbar Button → SurfaceIntersectionDialog.js → SurfaceIntersectionHelper.js
                                                       ↓
                                              loadedSurfaces triangles
                                                       ↓
                                              Moller tri-tri intersection
                                                       ↓
                                              Point ordering + simplification
                                                       ↓
                                              KAD poly entities (closed=true)
                                                       ↓
                                              UndoManager batch → IndexedDB → TreeView
```

## Files to Create

### 1. Dialog: `src/dialog/popups/surface/SurfaceIntersectionDialog.js`

Exports `showSurfaceIntersectionDialog(callback)`. Uses `FloatingDialog` with `createEnhancedFormContent()` and `getFormData()`.

**Surface checklist** — dynamically built from `window.loadedSurfaces`:
- Each surface gets a checkbox with name + triangle count
- Minimum 2 must be selected before Compute is enabled

**Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| Vertex spacing | number (m) | 1.0 | Simplification tolerance — points closer than this along the polyline are merged. 0 = no simplification. |
| Close polygons | checkbox | checked | Sets `closed: true` on KAD poly entities |
| Result color | color picker | `#FFCC00` | Color for intersection polylines |
| Line width | number | 3 | Line width for KAD poly entities |
| Layer name | text | `"SURF-IX"` | Layer to assign results to |

**Buttons:**
- "Compute Intersections" — disabled until 2+ surfaces selected
- "Cancel" — closes dialog

**Callback returns:**
```javascript
{
    surfaceIds: ["surface1", "surface2"],  // selected surface IDs
    vertexSpacing: 1.0,
    closedPolygons: true,
    color: "#FFCC00",
    lineWidth: 3,
    layerName: "SURF-IX"
}
```

### 2. Helper: `src/helpers/SurfaceIntersectionHelper.js`

Exports `computeSurfaceIntersections(config)`. Pure computation + KAD entity creation.

**Step 1) Extract world-space triangles** from each selected surface.

Handle all triangle formats in the codebase:
```javascript
// Format A: inline vertex objects {vertices: [{x,y,z}, {x,y,z}, {x,y,z}]}
// Format B: index-based {a, b, c} referencing surface.points[]
// Format C: index array {indices: [0, 1, 2]} referencing surface.points[]
```

Build flat arrays of triangle vertices (9 floats per tri) for fast intersection.

**Step 2) Compute bounding boxes** from `surface.points[]` directly — do NOT rely on `surface.meshBounds` (only exists on textured OBJ meshes). Skip surface pairs whose bounding boxes don't overlap in XYZ.

**Step 3) Build spatial grid** for the smaller surface's triangles.
- Cell size = `2 × averageEdgeLength` of the smaller mesh
- Each cell stores indices of triangles whose AABB overlaps the cell

**Step 4) Moller triangle-triangle intersection** (plane-clipping method):
- Compute plane for each triangle (normal + distance)
- Skip near-parallel planes (abs dot product > 0.9999)
- Clip each triangle to the other's plane to find line segments
- Find overlap of segments along intersection line direction
- Collect intersection segment endpoints as `{x, y, z}` pairs

**Step 5) Order intersection segments** into connected polylines:
- Nearest-neighbor chaining with deduplication threshold (0.01m)
- Multiple disconnected chains become separate KAD poly entities

**Step 6) Simplify polylines** by vertex spacing:
- Walk along each polyline accumulating distance
- Keep a vertex only when accumulated distance >= `config.vertexSpacing`
- Always keep first and last point
- If `vertexSpacing <= 0`, skip simplification (keep all points)

**Step 7) Create KAD poly entities** with undo batch:

```javascript
// Step 7a) Begin undo batch
if (window.undoManager && polylines.length > 1) {
    window.undoManager.beginBatch("Surface Intersection (" + polylines.length + " polygons)");
}

// Step 7b) Get or create target layer
var activeLayer = null;
var activeLayerId = null;
if (window.loadedLayers) {
    // Find existing layer or create new one
    for (var [layerId, layer] of window.loadedLayers) {
        if (layer.name === config.layerName) {
            activeLayer = layer;
            activeLayerId = layerId;
            break;
        }
    }
    if (!activeLayer) {
        activeLayerId = "layer_" + Date.now();
        activeLayer = {
            id: activeLayerId,
            name: config.layerName,
            visible: true,
            entities: new Set()
        };
        window.loadedLayers.set(activeLayerId, activeLayer);
    }
}

// Step 7c) Create KAD entity for each polyline
polylines.forEach(function(points, idx) {
    var entityName = config.layerName + "_" + Date.now() + "_" + idx;

    var entityData = {
        entityType: "poly",
        layerId: activeLayerId,
        data: points.map(function(pt, i) {
            return {
                entityName: entityName,
                entityType: "poly",
                pointID: i + 1,
                pointXLocation: pt.x,
                pointYLocation: pt.y,
                pointZLocation: pt.z,
                lineWidth: config.lineWidth || 3,
                color: config.color || "#FFCC00",
                closed: config.closedPolygons !== false,
                visible: true
            };
        })
    };

    window.allKADDrawingsMap.set(entityName, entityData);
    if (activeLayer) activeLayer.entities.add(entityName);

    // Step 7d) Push undo action
    if (window.undoManager) {
        var action = new AddKADEntityAction(entityName, JSON.parse(JSON.stringify(entityData)));
        window.undoManager.pushAction(action);
    }
});

// Step 7e) End undo batch
if (window.undoManager && polylines.length > 1) {
    window.undoManager.endBatch();
}
```

**Step 8) Post-creation sequence** — save, redraw, update tree:

```javascript
// Step 8a) Mark 3D KAD scene for rebuild
window.threeKADNeedsRebuild = true;

// Step 8b) Redraw 2D + 3D
if (window.drawData) {
    window.drawData(window.allBlastHoles, window.selectedHole);
}

// Step 8c) Save KAD entities to IndexedDB
if (typeof window.debouncedSaveKAD === "function") {
    window.debouncedSaveKAD();
}

// Step 8d) Save layers to IndexedDB
if (typeof window.debouncedSaveLayers === "function") {
    window.debouncedSaveLayers();
}

// Step 8e) Update TreeView
if (typeof window.debouncedUpdateTreeView === "function") {
    window.debouncedUpdateTreeView();
}
```

### 3. Toolbar button in `kirra.html`

Inside `toolbarPanelSurface > .toolbar-grid`, after the flyrock shroud button:

```html
<button id="surfaceIntersectionBtn" class="toggle-buttons-custom icon-button"
    title="Surface Intersection">
    <img src="icons/intersection.png" alt="Surface Intersection">
</button>
```

Icon: `icons/intersection.png` — 48×48 PNG, Tabler icon style (two overlapping triangles with a highlighted intersection line).

### 4. Event listener in `src/kirra.js` (~line 35710)

After flyrock shroud button listener:

```javascript
var surfaceIxBtn = document.getElementById("surfaceIntersectionBtn");
if (surfaceIxBtn) {
    surfaceIxBtn.addEventListener("click", async function() {
        try {
            var mod1 = await import("./dialog/popups/surface/SurfaceIntersectionDialog.js");
            var mod2 = await import("./helpers/SurfaceIntersectionHelper.js");
            mod1.showSurfaceIntersectionDialog(function(config) {
                mod2.computeSurfaceIntersections(config);
            });
        } catch (error) {
            console.error("Failed to load Surface Intersection:", error);
        }
    });
}
```

## Key Technical Notes

### Triangle format handling
Surfaces use multiple triangle formats across the codebase. The helper MUST handle all of them:
- `{vertices: [{x,y,z}, {x,y,z}, {x,y,z}]}` — inline objects (generated planes, analysis surfaces)
- `{a, b, c}` — index references to `surface.points[]`
- `{indices: [0, 1, 2]}` — index array references to `surface.points[]`

### Bounding boxes
Do NOT use `surface.meshBounds` — only textured OBJ meshes have it. Compute bounds from `surface.points[]` directly.

### Coordinate space
All computation in world-space UTM. KAD entities store UTM coordinates. The 2D canvas transform handles centroid offset at render time. No Z transform.

### Vertex spacing simplification
Dense triangulated surfaces (e.g. 10,000+ triangles) can produce thousands of intersection points. The vertex spacing parameter (default 1m) merges nearby points along the polyline to produce cleaner results. The dialog should allow 0 for "keep all points" if the user wants full resolution.

### Performance
- Spatial grid acceleration is essential for large surfaces
- For 2 surfaces of N and M triangles, brute force is O(N×M). Grid reduces to ~O(N+M) for well-distributed meshes.
- Show "Computing..." status during intersection (can be a simple console.log or a temporary overlay)

### Code style
- Use `var` not `const`/`let`
- String concatenation with `+` not template literals
- `// Step N)` comments throughout
- Reuse `FloatingDialog`, `createEnhancedFormContent()`, `getFormData()` from existing dialog system

## Files Modified

| File | Change |
|------|--------|
| `kirra.html` | Add toolbar button |
| `src/kirra.js` | Add click event listener (~line 35710) |

## Files Created

| File | Purpose |
|------|---------|
| `src/dialog/popups/surface/SurfaceIntersectionDialog.js` | Dialog UI |
| `src/helpers/SurfaceIntersectionHelper.js` | Intersection computation + KAD creation |
| `icons/intersection.png` | Toolbar icon |

## Verification

1. Load 2+ overlapping surfaces (e.g. pit shell + bench surface)
2. Click Surface Intersection button
3. Select both surfaces, set vertex spacing to 1.0m
4. Click Compute
5. Verify: closed KAD polygon(s) appear at the intersection line
6. Verify: entities appear in TreeView under the SURF-IX layer
7. Verify: Ctrl+Z undoes all intersection polygons as a batch
8. Verify: page reload preserves the intersection polygons (IndexedDB)
9. Test with vertex spacing = 0 (full resolution) and 5.0 (simplified)
