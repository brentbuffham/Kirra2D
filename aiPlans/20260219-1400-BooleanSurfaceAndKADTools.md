# Boolean & Extrude Tools Plan
**Date:** 2026-02-19 (Updated)
**Status:** Draft v3

---

## Overview

Four tools matching industry-standard workflows:

| Tool | Button | Toolbar | Analogue |
|------|--------|---------|----------|
| **KAD Boolean** | `kadBooleanBtn` | Modify | Vulcan Polygon Boolean |
| **Surface Boolean** | `surfaceBooleanBtn` | Surface | Vulcan Triangulation Boolean (TRIBOOL) |
| **Solid CSG** | `solidBooleanBtn` | Surface | Cinema4D Boolean / three-csg-ts |
| **Extrude KAD to Solid** | `extrudeKADToSolidBtn` | Surface | Three.js ExtrudeGeometry |

All four buttons are already in `kirra.html`.

---

## Tool 1: KAD Boolean (Modify toolbar)

**Reference:** [Vulcan Polygon Boolean](https://help.maptek.com/vulcan/2024.4/Content/topics/Design/Polygon_Edit/Design_Boolean.htm)

### Concept
Pick Subject + Clip KAD polygon entities from a dialog. Perform 2D boolean ops (Union, Intersect, Difference, XOR) on their XY coordinates using ClipperLib. Result = new KAD polygon entities in "BOOLS" layer.

### Approach
- ClipperLib already imported and used in kirra.js
- Dialog lists all KAD poly entities from `allKADDrawingsMap` (user picks Subject + Clip)
- Convert vertices → ClipperLib integer paths (SCALE = 1000)
- Execute boolean → convert result paths → new KAD poly entities
- Reuse `createKADEntities()` pattern from SurfaceIntersectionHelper.js

### Files to Create
| File | Purpose |
|------|---------|
| `src/helpers/KADBooleanHelper.js` | ClipperLib boolean logic |
| `src/dialog/popups/kad/KADBooleanDialog.js` | Entity picker + operation dialog |

### Files to Modify
| File | Change |
|------|--------|
| `src/kirra.js` | Wire `kadBooleanBtn` click → async import dialog + helper |

### Operations
| Op | ClipperLib Type | Description |
|----|----------------|-------------|
| Union | `ctUnion` | Merge polygons into outer boundary |
| Intersect | `ctIntersection` | Keep only overlapping region |
| Difference | `ctDifference` | Subtract clip from subject |
| XOR | `ctXor` | Keep everything except overlap |

### Dialog Layout
```
┌──────────────────────────────────────────┐
│ KAD Boolean Operation                     │
├──────────────────────────────────────────┤
│ Subject: [dropdown of poly entities]      │
│ Clip:    [dropdown of poly entities]      │
│                                           │
│ Operation:                                │
│   ○ Union    ○ Intersect                  │
│   ○ Difference (A-B)   ○ XOR             │
│                                           │
│ Output Color:  [color picker]             │
│ Line Width:    [number: 3]                │
│ Layer Name:    [text: BOOLS]              │
│                                           │
│           [Cancel]  [Execute]             │
└──────────────────────────────────────────┘
```

### Algorithm
```javascript
import ClipperLib from "clipper-lib";
const SCALE = 1000;

export function kadBoolean(config) {
    // 1. Get subject + clip entity data from allKADDrawingsMap
    // 2. Extract XY vertices as ClipperLib integer paths
    // 3. Set up Clipper: subject path + clip path
    // 4. Execute operation (ctUnion/ctIntersection/ctDifference/ctXor)
    // 5. Convert result paths back to world coords (/SCALE)
    // 6. Z = average Z of input vertices (preserve elevation)
    // 7. Create KAD poly entities via createKADEntities() pattern
    //    entityName = "BOOLS_..." in layer "BOOLS"
    // 8. Undo batch via UndoManager
}
```

---

## Tool 2: Surface Boolean (Surface toolbar) — INTERACTIVE SPLIT & PICK

**Reference:** [Vulcan Triangulation Boolean](https://help.maptek.com/vulcan/2024.4/Content/topics/Model/Tri_Utility/Model_11BOOL.htm)

### Concept (Vulcan TRIBOOL style)
This is NOT a mathematical Z-resolution tool. It's an **interactive visual workflow**:

1. Select 2+ surfaces from a dialog
2. Tool computes intersection lines and **splits both meshes** along them into distinct pieces ("splits")
3. Each split is displayed as a clickable 3D region with a distinct color
4. User clicks on splits to **Remove** (hide) unwanted pieces
5. **Invert** toggles removed/kept (to fix mistakes)
6. **Apply** combines all visible splits into a new surface in "BOOLS" layer

### Mining Use Case (from user's image)
- Surface A = terrain/topography (gray)
- Surface B = pit/bench design (gold)
- Intersection line = where they cross
- Both get split along intersection into pieces
- User removes: terrain inside the pit boundary
- User keeps: terrain outside + pit design surface
- Apply → combined surface showing pit cut into terrain

### Algorithm (Step by Step)

#### Step 1: Compute Intersection Lines
- Reuse existing `SurfaceIntersectionHelper.js` intersection code
- `intersectSurfacePair()` gives intersection line segments between surface pairs
- Chain segments into polylines with `chainSegments()`

#### Step 2: Split Triangles Along Intersection Lines
For each triangle that an intersection segment passes through:
- The segment enters at one edge and exits at another
- Split the triangle into 2–3 sub-triangles along the segment
- Track which side of the intersection each sub-triangle is on (left/right)

```
Triangle splitting cases:
Case A: Segment cuts 2 edges → 3 sub-triangles
         /\              /\
        /  \            /||\
       /    \    →     / || \
      /______\        /__||__\

Case B: Segment cuts 1 edge + 1 vertex → 2 sub-triangles
         /\              /\
        /  \            /  \
       /    \    →     /----\
      /______\        /______\
```

#### Step 3: Identify Connected Regions (Splits)
After splitting all intersected triangles:
- Build adjacency graph: sub-triangles that share an edge are neighbors
- Non-intersected triangles from each surface are also included
- Flood-fill from each unvisited triangle to find connected regions
- Each connected region = one "split"
- Label each split with its source surface (A or B)

#### Step 4: Display Splits in 3D
- Create a separate Three.js mesh for each split (BufferGeometry with vertex colors)
- Assign distinct colors per split (alternating warm/cool palette)
- Add all splits to a temporary "boolean preview" group in the Three.js scene
- Hide the original surface meshes during the boolean session

#### Step 5: Interactive Picking
- User clicks on a split in 3D view → raycast identifies which split mesh was hit
- Toggle split state: "kept" (colored) ↔ "removed" (hidden or semi-transparent gray)
- **Remove button**: Hide the clicked-on split
- **Invert button**: Swap all kept ↔ removed splits
- **Apply button**: Combine all "kept" splits into a new surface

#### Step 6: Apply → Create New Surface
- Collect all triangles from "kept" splits
- Merge into a single points[] + triangles[] array
- Deduplicate shared vertices
- Compute meshBounds
- Store in `loadedSurfaces` as "BOOLS_{timestamp}"
- Save to IndexedDB via `saveSurfaceToDB()`
- Clean up preview meshes
- Restore original surface visibility
- Trigger redraw

### UI Flow
```
┌──────────────────────────────────────────────┐
│ Surface Boolean                               │
├──────────────────────────────────────────────┤
│ [checklist of surfaces, min 2]               │
│ ☑ Terrain_Topo.dtm (24,000 tris)            │
│ ☑ Pit_Design.dtm (8,000 tris)               │
│ ☐ Other_Surface.obj (12,000 tris)            │
│                                               │
│ Status: 2 surfaces selected                   │
│                                               │
│           [Cancel]  [Compute Splits]          │
└──────────────────────────────────────────────┘

After "Compute Splits" → switches to interactive mode:

┌──────────────────────────────────────────────┐
│ Surface Boolean — Pick Splits                 │
├──────────────────────────────────────────────┤
│ Click on mesh pieces in 3D to toggle.         │
│                                               │
│ Splits: 4 kept / 2 removed                   │
│                                               │
│  [Remove Clicked] [Invert] [Apply] [Cancel]  │
└──────────────────────────────────────────────┘
```

### Files to Create
| File | Purpose |
|------|---------|
| `src/helpers/SurfaceBooleanHelper.js` | Split triangles, identify regions, merge result |
| `src/dialog/popups/surface/SurfaceBooleanDialog.js` | Surface selection dialog + interactive split picker |

### Files to Modify
| File | Change |
|------|--------|
| `src/kirra.js` | Wire `surfaceBooleanBtn` click |

### Key Technical Details

**Triangle Splitting Algorithm:**
```
For each intersection segment (p0, p1):
    Find which triangle it came from (track during intersection)
    Find the two edges the segment crosses
    Insert the two intersection points as new vertices
    Split the triangle into 2-3 sub-triangles using these new vertices
    Assign each sub-triangle a "side" flag (which side of intersection line)
```

**Region Flood-Fill:**
```
1. Build edge → triangle adjacency map
2. For each unvisited triangle:
   a. Start new region
   b. BFS/DFS through shared edges
   c. Stop at intersection line edges (they separate regions)
   d. All reached triangles = one split
3. Return list of splits, each with its triangle list + source surface ID
```

**Raycasting for Split Selection:**
- Each split is its own Three.js Mesh with `userData.splitId`
- Use existing `threeRenderer.raycaster` for picking
- On click: find intersected mesh → toggle its split state
- Visual update: change material color/opacity or hide mesh

---

## Tool 3: Solid CSG (Surface toolbar)

**Reference:** [Cinema4D Boolean](https://help.maxon.net/c4d/s22/us/index.html#OBOOLE-ID_OBJECTPROPERTIES) / three-csg-ts

### Concept
True 3D CSG for closed meshes (OBJ imports or TIN surfaces closed into solids). Union, Intersect, Subtract operations.

### Library: `three-csg-ts`
```bash
npm install three-csg-ts
```

### When to Use
- Two imported OBJ meshes that are closed solids
- TIN surfaces auto-closed into solids (sides + bottom added)
- Any pair of Three.js Mesh objects

### Algorithm

#### Step 1: Get Source Meshes
- For textured OBJ: use `surface.threeJSMesh`
- For TIN surfaces: convert to Three.js BufferGeometry, optionally close into solid

#### Step 2: Optional — Close Open TIN into Solid
```
1. Extract boundary polygon (boundary edges from triangle mesh)
2. Bottom Z = meshBounds.minZ - userOffset
3. For each boundary edge (p1 → p2):
   - Create 2 side-wall triangles: (p1_top, p2_top, p2_bottom), (p1_top, p2_bottom, p1_bottom)
4. Triangulate boundary polygon at bottom Z using Earcut (for bottom face)
5. Combine: top surface + side walls + bottom = closed solid
```

#### Step 3: CSG Operation
```javascript
import { CSG } from 'three-csg-ts';

const csgA = CSG.fromMesh(meshA);
const csgB = CSG.fromMesh(meshB);

let result;
switch (operation) {
    case 'union':    result = csgA.union(csgB); break;
    case 'intersect': result = csgA.intersect(csgB); break;
    case 'subtract': result = csgA.subtract(csgB); break;
}

const resultMesh = CSG.toMesh(result, meshA.matrix);
```

#### Step 4: Store Result
- Extract points + triangles from result BufferGeometry
- Store in `loadedSurfaces` as "BOOLS_CSG_{operation}_{timestamp}"
- Keep `surface.threeJSMesh` for 3D rendering
- Save points + triangles to IndexedDB

### Files to Create
| File | Purpose |
|------|---------|
| `src/helpers/SolidCSGHelper.js` | CSG operations + TIN-to-solid |
| `src/dialog/popups/surface/SolidCSGDialog.js` | Mesh picker + operation dialog |

### Files to Modify
| File | Change |
|------|--------|
| `src/kirra.js` | Wire `solidBooleanBtn` click |
| `package.json` | Add `three-csg-ts` dependency |

### Dialog Layout
```
┌──────────────────────────────────────────────┐
│ Solid Boolean (CSG)                           │
├──────────────────────────────────────────────┤
│ Mesh A: [dropdown of surfaces/meshes]         │
│ Mesh B: [dropdown of surfaces/meshes]         │
│                                               │
│ ☑ Close open surfaces (create solid)          │
│   Bottom offset: [number: 10] m               │
│                                               │
│ Operation:                                    │
│   ○ Union    ○ Intersect    ○ Subtract (A-B)  │
│                                               │
│ Output Color: [color picker: #4488FF]         │
│                                               │
│             [Cancel]  [Execute]               │
└──────────────────────────────────────────────┘
```

---

## Wiring in kirra.js

All four follow the existing `surfaceIntersectionBtn` async-import-on-click pattern:

```javascript
document.addEventListener("DOMContentLoaded", function () {
    // Tool 1: KAD Boolean
    var kadBoolBtn = document.getElementById("kadBooleanBtn");
    if (kadBoolBtn) {
        kadBoolBtn.addEventListener("click", async function () {
            var { showKADBooleanDialog } = await import("./dialog/popups/kad/KADBooleanDialog.js");
            var { kadBoolean } = await import("./helpers/KADBooleanHelper.js");
            showKADBooleanDialog(function (config) { kadBoolean(config); });
        });
    }

    // Tool 2: Surface Boolean (interactive split & pick)
    var surfBoolBtn = document.getElementById("surfaceBooleanBtn");
    if (surfBoolBtn) {
        surfBoolBtn.addEventListener("click", async function () {
            var { showSurfaceBooleanDialog } = await import("./dialog/popups/surface/SurfaceBooleanDialog.js");
            showSurfaceBooleanDialog(); // Dialog manages its own interaction mode
        });
    }

    // Tool 3: Solid CSG
    var solidBoolBtn = document.getElementById("solidBooleanBtn");
    if (solidBoolBtn) {
        solidBoolBtn.addEventListener("click", async function () {
            var { showSolidCSGDialog } = await import("./dialog/popups/surface/SolidCSGDialog.js");
            var { solidCSG } = await import("./helpers/SolidCSGHelper.js");
            showSolidCSGDialog(function (config) { solidCSG(config); });
        });
    }

    // Tool 4: Extrude KAD to Solid
    var extrudeBtn = document.getElementById("extrudeKADToSolidBtn");
    if (extrudeBtn) {
        extrudeBtn.addEventListener("click", async function () {
            var { showExtrudeKADDialog } = await import("./dialog/popups/surface/ExtrudeKADDialog.js");
            showExtrudeKADDialog(); // Dialog manages preview + apply
        });
    }
});
```

---

## Tool 4: Extrude KAD to Solid (Surface toolbar)

**Reference:** [Three.js ExtrudeGeometry](https://threejs.org/docs/#api/en/geometries/ExtrudeGeometry)

### Concept
Select a closed KAD polygon, extrude it into a 3D solid using Three.js ExtrudeGeometry. Live preview in 3D (like the offsetKAD tool). Apply stores the result as a new surface in `loadedSurfaces`.

### Workflow (matches offsetKAD pattern)
1. User clicks `extrudeKADToSolidBtn` button
2. If a closed KAD poly is already selected → show dialog immediately
3. Otherwise → user clicks on a closed KAD polygon → dialog appears
4. Dialog shows all ExtrudeGeometry parameters with sliders/inputs
5. **Live 3D preview** updates as parameters change (dashed wireframe mesh in scene)
6. **Apply** → creates a new surface from the extrusion, saves to `loadedSurfaces` + IndexedDB
7. **Cancel** → clears preview, returns to normal

### ExtrudeGeometry Parameters (all exposed in dialog)
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `depth` | Number | 10 | Extrusion distance (meters). **Key parameter** |
| `steps` | Number | 1 | Subdivisions along extrusion depth |
| `bevelEnabled` | Boolean | false | Enable beveled edges |
| `bevelThickness` | Number | 2 | Bevel depth into shape |
| `bevelSize` | Number | 1 | Distance from outline to bevel edge |
| `bevelOffset` | Number | 0 | Offset from shape outline for bevel start |
| `bevelSegments` | Number | 3 | Smoothness of bevel curve |
| `curveSegments` | Number | 12 | Segments per curve in shape outline |

Note: `extrudePath` (3D spline) and `UVGenerator` are advanced — omit from initial implementation.

### Extrusion Direction
- Default: extrude **downward** (negative Z) — mining convention for pits
- Option to extrude **upward** (positive Z) — for stockpiles/embankments
- Dialog: `Direction: [Down ▼] / [Up ▲]` radio buttons

### Algorithm

#### Step 1: Convert KAD Polygon to THREE.Shape
```javascript
// Get the closed KAD polygon vertices
const entity = allKADDrawingsMap.get(selectedEntityName);
const points = entity.data;

// Create THREE.Shape from XY vertices (in local Three.js coords)
const shape = new THREE.Shape();
const first = worldToThreeLocal(points[0].pointXLocation, points[0].pointYLocation);
shape.moveTo(first.x, first.y);
for (let i = 1; i < points.length; i++) {
    const local = worldToThreeLocal(points[i].pointXLocation, points[i].pointYLocation);
    shape.lineTo(local.x, local.y);
}
shape.closePath();
```

#### Step 2: Create ExtrudeGeometry
```javascript
const extrudeSettings = {
    depth: config.depth,
    steps: config.steps,
    bevelEnabled: config.bevelEnabled,
    bevelThickness: config.bevelThickness,
    bevelSize: config.bevelSize,
    bevelOffset: config.bevelOffset,
    bevelSegments: config.bevelSegments,
    curveSegments: config.curveSegments
};

const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
```

#### Step 3: Position at Correct Z
```javascript
// KAD polygon has a Z elevation — position the extrusion there
const baseZ = points[0].pointZLocation || 0;
const mesh = new THREE.Mesh(geometry, material);

// ExtrudeGeometry extrudes along +Z by default
// For "down" direction, rotate 180° around X and position at baseZ
if (direction === "down") {
    mesh.rotation.x = Math.PI;
    mesh.position.z = baseZ;
} else {
    mesh.position.z = baseZ;
}
```

#### Step 4: Apply Gradient Coloring
Same gradient system as triangulation surfaces:
- Compute vertex colors based on Z elevation
- Use the same gradient functions (default, viridis, terrain, hillshade, etc.)
- Gradient dropdown in dialog matches surface gradient options

```javascript
// Apply vertex colors based on Z (same as SurfaceRenderer._buildGeometry pattern)
const colors = [];
const positions = geometry.attributes.position.array;
for (let i = 0; i < positions.length; i += 3) {
    const z = positions[i + 2];
    const t = (z - minZ) / (maxZ - minZ); // Normalized elevation
    const color = gradientFunction(t);
    colors.push(color.r, color.g, color.b);
}
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
```

#### Step 5: Live Preview (like offsetKAD)
```javascript
// Preview state variables (same pattern as offset preview)
let extrudePreviewEnabled = false;
let extrudePreviewMesh = null;

function updateExtrudePreview(entity, params) {
    clearExtrudePreview();
    // Create preview mesh with semi-transparent wireframe material
    const geometry = buildExtrudeGeometry(entity, params);
    const material = new THREE.MeshBasicMaterial({
        color: 0x4488FF,
        wireframe: true,
        transparent: true,
        opacity: 0.6
    });
    extrudePreviewMesh = new THREE.Mesh(geometry, material);
    extrudePreviewMesh.name = "extrudePreview";
    extrudePreviewMesh.userData = { isPreview: true };
    threeRenderer.scene.add(extrudePreviewMesh);
    extrudePreviewEnabled = true;
    threeRenderer.render();
}

function clearExtrudePreview() {
    if (extrudePreviewMesh && threeRenderer.scene) {
        threeRenderer.scene.remove(extrudePreviewMesh);
        extrudePreviewMesh.geometry.dispose();
        extrudePreviewMesh.material.dispose();
        extrudePreviewMesh = null;
    }
    extrudePreviewEnabled = false;
}
```

#### Step 6: Apply → Store as Surface
On Apply:
- Extract points + triangles from the ExtrudeGeometry BufferGeometry
- Create a surface object compatible with `loadedSurfaces`
- Save to IndexedDB
- Add to 3D scene as a proper gradient-colored surface mesh
- Clear preview

```javascript
function applyExtrusion(entity, params) {
    clearExtrudePreview();

    // Build final geometry
    const geometry = buildExtrudeGeometry(entity, params);

    // Extract points and triangles from BufferGeometry
    const positions = geometry.attributes.position.array;
    const index = geometry.index ? geometry.index.array : null;
    const points = [];
    const triangles = [];

    for (let i = 0; i < positions.length; i += 3) {
        points.push({
            x: positions[i] + threeLocalOriginX,   // Convert back to world
            y: positions[i + 1] + threeLocalOriginY,
            z: positions[i + 2]  // Z not transformed
        });
    }

    if (index) {
        for (let i = 0; i < index.length; i += 3) {
            triangles.push({ a: index[i], b: index[i + 1], c: index[i + 2] });
        }
    } else {
        // Non-indexed geometry
        for (let i = 0; i < points.length; i += 3) {
            triangles.push({ a: i, b: i + 1, c: i + 2 });
        }
    }

    // Create surface object
    const surfaceId = "EXTRUDE_" + Date.now();
    const surface = {
        id: surfaceId,
        name: surfaceId,
        points: points,
        triangles: triangles,
        visible: true,
        gradient: params.gradient || "default",
        transparency: 1.0,
        meshBounds: computeMeshBounds(points)
    };

    window.loadedSurfaces.set(surfaceId, surface);
    saveSurfaceToDB(surface);
    drawData(allBlastHoles, selectedHole);
}
```

### Files to Create
| File | Purpose |
|------|---------|
| `src/helpers/ExtrudeKADHelper.js` | Shape conversion, geometry building, surface extraction |
| `src/dialog/popups/surface/ExtrudeKADDialog.js` | Parameter dialog with live preview |

### Files to Modify
| File | Change |
|------|--------|
| `src/kirra.js` | Wire `extrudeKADToSolidBtn` click + preview state vars |

### Dialog Layout
```
┌──────────────────────────────────────────────┐
│ Extrude KAD to Solid                          │
├──────────────────────────────────────────────┤
│ Selected: [polygon entity name]               │
│                                               │
│ Direction:  ○ Down (pit)  ○ Up (stockpile)    │
│ Depth:      [slider 1-100, default 10] m      │
│ Steps:      [slider 1-10, default 1]          │
│                                               │
│ ☐ Bevel Enabled                               │
│   Thickness: [slider 0-10, default 2]         │
│   Size:      [slider 0-10, default 1]         │
│   Offset:    [slider -5 to 5, default 0]      │
│   Segments:  [slider 1-10, default 3]         │
│                                               │
│ Curve Segments: [slider 1-24, default 12]     │
│ Gradient:       [dropdown: same as surfaces]  │
│                                               │
│ Live Preview: ☑ (updates on every change)     │
│                                               │
│            [Cancel]  [Apply]                  │
└──────────────────────────────────────────────┘
```

### Preview Behavior
- Every parameter change triggers `updateExtrudePreview()` (debounced ~100ms)
- Preview mesh = wireframe + semi-transparent fill (dual material)
- Preview shows in 3D view at the correct world position
- Slider dragging gives real-time feedback
- Cancel clears preview and restores normal view
- Apply replaces preview with final gradient-colored solid surface

---

## Implementation Order

### Phase 1: Extrude KAD to Solid (simplest — no new dependencies)
1. `src/helpers/ExtrudeKADHelper.js`
2. `src/dialog/popups/surface/ExtrudeKADDialog.js`
3. Wire in `kirra.js`
4. Test with closed KAD polygons

### Phase 2: KAD Boolean (ClipperLib only)
1. `src/helpers/KADBooleanHelper.js`
2. `src/dialog/popups/kad/KADBooleanDialog.js`
3. Wire in `kirra.js`
4. Test with overlapping KAD polygons

### Phase 3: Surface Boolean (interactive split & pick)
1. `src/helpers/SurfaceBooleanHelper.js`
   - Reuse intersection code from SurfaceIntersectionHelper
   - Add triangle splitting along intersection lines
   - Add region flood-fill identification
   - Add split merge for "Apply"
2. `src/dialog/popups/surface/SurfaceBooleanDialog.js`
   - Surface picker dialog (phase 1 of UI)
   - Interactive split picker with Remove/Invert/Apply (phase 2 of UI)
   - Raycasting for split selection
3. Wire in `kirra.js`
4. Test with overlapping DTM surfaces

### Phase 4: Solid CSG
1. `npm install three-csg-ts`
2. `src/helpers/SolidCSGHelper.js` (CSG ops + TIN-to-solid)
3. `src/dialog/popups/surface/SolidCSGDialog.js`
4. Wire in `kirra.js`
5. Test with OBJ meshes and closed TIN surfaces

### Phase 5: Polish
1. Undo support for all four tools
2. Progress indicators for large datasets
3. Edge cases (non-overlapping, degenerate geometry, unclosed polygons)

---

## Dependencies
| Package | Status | Used For |
|---------|--------|----------|
| `three` | Already installed | Tool 4 (ExtrudeGeometry) |
| `clipper-lib` | Already installed | Tool 1 (KAD Boolean) |
| `delaunator` | Already installed | Tool 2 (region re-triangulation if needed) |
| `@kninnug/constrainautor` | Already installed | Tool 2 (constrained edges) |
| `earcut` | Already installed | Tool 3 (close TIN bottom face) |
| `three-mesh-bvh` | Already installed | Tool 2 (raycast split picking) |
| **`THREE-CSGMesh`** | **Installed (JS version)** | Tool 3 (Solid CSG) |

## Existing Code to Reuse
| What | Where | How |
|------|-------|-----|
| Offset KAD preview pattern | kirra.js:22160-22472 | `updateExtrudePreview()`/`clearExtrudePreview()` mirrors offset pattern |
| Offset KAD 3D preview meshes | kirra.js:22374 `draw3DOffsetPreview()` | Same add-to-scene + cleanup pattern |
| Offset KAD tool activation | kirra.js:20843 offsetKADButton handler | Same checkbox toggle + click pattern |
| `worldToThreeLocal()` | kirra.js | Convert KAD world XY to Three.js local coords |
| Surface gradient functions | SurfaceRenderer.js | `_defaultGradient()`, `_viridisGradient()` etc. |
| `saveSurfaceToDB()` | kirra.js | Persist result surface to IndexedDB |
| Triangle-triangle intersection | SurfaceIntersectionHelper.js | Tool 2: `triTriIntersection()`, `intersectSurfacePair()` |
| Segment chaining | SurfaceIntersectionHelper.js | Tool 2: `chainSegments()` |
| Triangle extraction (all formats) | SurfaceIntersectionHelper.js | Tool 2: `extractTriangles()` |
| Spatial grid acceleration | SurfaceIntersectionHelper.js | Tool 2: `buildSpatialGrid()`, `queryGrid()` |
| BBox utilities | SurfaceIntersectionHelper.js | Tool 2: `computeBBox()`, `bboxOverlap()` |
| KAD entity creation pattern | SurfaceIntersectionHelper.js | Tool 1: `createKADEntities()` |
| ClipperLib boolean pattern | kirra.js:16350, 20306, 20734 | Tool 1: Path setup + execute |
| BVH raycasting | SurfaceRenderer.js + ThreeRenderer.js | Tool 2: Ray picking for split selection |
| Dialog pattern | SurfaceIntersectionDialog.js | FloatingDialog + checklist |
| Button wiring | kirra.js:35969 | Async import on click pattern |

---

## Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| ExtrudeGeometry needs Shape in XY plane | Convert world XY to local, extrude along Z, position at correct elevation |
| Live preview lag on complex polygons | Debounce param changes (100ms); use wireframe for preview |
| KAD polygon winding order matters for extrude direction | Detect CW/CCW and flip if needed |
| Large UTM coords cause precision issues in Shape | Offset to local coords (subtract centroid) before creating Shape |
| Triangle splitting is geometrically tricky | Use robust point-on-edge tests with epsilon tolerance |
| Flood-fill region detection across thousands of triangles | Use efficient edge adjacency map (hash of sorted vertex pairs) |
| Large surfaces slow to split | Spatial grid already available; only process triangles near intersection |
| Raycast picking on split meshes | Use existing BVH infrastructure; each split is its own mesh |
| User gets confused by many small splits | Color them distinctly; show split count in dialog |
| Non-overlapping surfaces → no splits | Detect and warn: "surfaces don't overlap" |
| `three-csg-ts` slow on large meshes | Warn user for meshes > 50k tris; consider chunking |
| Open TIN not valid for CSG | Auto-close option with side walls + bottom in dialog |
