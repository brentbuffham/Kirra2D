# Surface Boolean — Normal Fix + Connected-Component Refactor

**Date:** 2026-02-22 14:30 (normals) / 2026-02-22 18:00 (connected components)  
**Status:** Implemented

## Part 1: Normal Preprocessing Fix (14:30)

The Surface Boolean tool showed the yellow intersection line correctly but the red mesh did not get split. Root cause: **inconsistent normal preprocessing** between tools.

- **SolidCSGHelper** applied `ensureZUpNormals()` — extrude worked.
- **SurfaceBooleanHelper** did not — splitting failed on inverted normals.

**Fix:** Added `ensureZUpNormals(trisA)` and `ensureZUpNormals(trisB)` in SurfaceBooleanHelper before intersection. Also applied in SurfaceIntersectionHelper for yellow KAD polylines.

## Part 2: Connected-Component Splitting (18:00)

### Problem

The original classification (Steps 5-7) used Z-interpolation to label split triangles as "above", "below", or "outside" the other surface. This was fundamentally wrong for the Surface Boolean purpose: **the tool should cut meshes along intersection lines into connected pieces**, not classify by Z height.

### Solution

Replaced Z-classification with **connected-component flood-fill** (BFS on edge adjacency). After `splitSurfaceAlongSegments` creates new vertices along the intersection seam, triangles on opposite sides of the seam no longer share edges. A simple connected-component analysis naturally separates the regions.

### What Changed

**SurfaceBooleanHelper.js:**
- **Added** `findConnectedComponents(tris)` — builds edge-to-triangle adjacency from vertex keys, then BFS flood-fill to assign component IDs. Returns array of triangle arrays (one per component), sorted largest-first.
- **Replaced** Steps 5-7 in `computeSplits` (Z grids, centroid classification, above/below/outside grouping) with `findConnectedComponents()` calls per surface + simple loop to build split groups.
- **New labels:** `SURF-A[1]`, `SURF-A[2]`, `SURF-B[1]` etc. (with triangle count) instead of `above`, `below`, `outside`.
- **Removed dead code:** `refineStraddlingTriangles`, `findCoverageBoundary`, `triCentroid`, `pointInTriangle2D`, `interpolateZOnTriangle`, `interpolateZAtPoint`, `reclassifyOutsideByAdjacency`.
- **Removed unused imports:** `estimateAvgEdge`, `buildSpatialGrid`, `queryGrid` from SurfaceIntersectionHelper.

### What Stayed the Same

- Triangle extraction and normal alignment (Steps 1-1b)
- Moller intersection and tagged segments (Step 2)
- Triangle splitting along segments (Steps 3-4) including 3D line-edge intersection fix
- `splitOneTriangleBySegment`, `splitTriangleAtCrossings`, `lerpVert`, `lineEdgeIntersection3D`
- `applyMerge`, preview meshes, undo, all dialog interaction

### Expected Result

For terrain (26837 tris) intersected by an extruded polygon (40 tris):
- Terrain splits into 2 components: inside and outside the polygon footprint
- Extruded polygon stays as 1 component (fully connected solid)
- Result: **3 split groups** — user can select/exclude each piece independently

## Part 3: Cut-Edge Aware Flood-Fill (18:30)

### Problem

Connected-component flood-fill alone cannot detect split regions. When `splitTriangleAtCrossings` splits a triangle into 3 sub-triangles, the lone-side triangle (T1) and one quad-side triangle (T3) **share the cut edge Pa-Pb**. The flood-fill crosses this edge and treats both sides as one component.

Additionally, `splitOneTriangleBySegment` fails for vertex-touching cases (crossings=0 or crossings=1) where the intersection line passes through/near a triangle vertex. The EDGE_EPS filter rejects crossings at t≈0 or t≈1, producing 0 or 1 crossing instead of 2. These unsplit triangles act as "bridges".

### Solution

Two-part fix:

1. **Cut edge tracking**: Every split now records the cut edge key (Pa-Pb vertex key pair). The `cutEdgeKey` function uses `toFixed(6)` vertex keys for consistent matching. Cut edges are collected through the pipeline: `splitOneTriangleBySegment` → `splitTriangleBySegments` → `splitSurfaceAlongSegments` → `computeSplits`.

2. **Seam-aware flood-fill**: `findConnectedComponents(tris, cutEdgeKeys)` now accepts an optional `Set` of cut edge keys. When building the edge-to-triangle adjacency map, edges in the cut set are skipped. The flood-fill cannot cross cut edges, so sub-triangles on opposite sides of the cut end up in different components.

3. **Vertex-touching handling**: `splitOneTriangleBySegment` now handles:
   - **crossings=1 + vertex on line**: Detects vertices near the intersection line (perpendicular distance < tolerance). Splits into 2 sub-triangles (P→V cut). Records cut edge.
   - **crossings=0 + 2 vertices on line**: Line goes along an existing edge. No geometric split needed, but the edge is recorded as a cut edge to break adjacency.

### What Changed

- Added module-level `cutVKey`, `cutEdgeKey` helpers
- `splitOneTriangleBySegment` now accepts `cutEdgeKeysOut` param, handles vertex-touching, records cut edges for all cases
- `splitTriangleBySegments` and `splitSurfaceAlongSegments` thread `cutEdgeKeysOut` through
- `computeSplits` collects cut edges per surface and passes to `findConnectedComponents`
- `findConnectedComponents` accepts optional `cutEdgeKeys` Set, excludes cut edges from adjacency

## Part 4: Two-Pass Component Detection (19:00)

### Problem

Recording cut edges for every split fragmented the solid (B-surface) into 262 single-triangle components. The terrain had ~234 cut edges forming one clean seam (1 segment per triangle). The solid had ~234 cut edges from ~15 segments per triangle — each triangle got cut into ~16 pieces, all isolated by cut edges.

### Solution: Two-pass refinement

**Pass 1**: `findConnectedComponents` WITHOUT cut edges (baseline). The terrain stays as 1 component (bridge triangles keep it connected). The solid stays as 1-3 components (natural topology from splitting).

**Pass 2**: `refineComponentsWithCutEdges` — for each base component, try sub-splitting WITH cut edges. Accept the sub-split ONLY if:
- It produces more than 1 sub-component
- At most 10 sub-components (not fragmentation)
- Every sub-component has at least 0.5% of the base component's triangles (no tiny slivers)

If the sub-split is rejected (fragmentation), the base component stays whole.

### Expected Result

- Terrain (27000 tris, 1 base component): cut edges sub-split into 2 large components (~13500 each) → accepted ✓
- Solid (19000 tris, 1-3 base components): cut edges sub-split into 260+ fragments → rejected, stays whole ✓
- Total: 3 split groups (2 terrain pieces + 1 solid)

## Part 5: Robustness Fixes for Bridge Triangles (22:30)

### Problem

Even with the two-pass approach, the terrain (A) stayed as 1 component instead of splitting into 2. Root cause: 3 "bridge" triangles from failed `splitOneTriangleBySegment` calls (crossings=0 or crossings=1 with no vertex on line). These unsplit triangles connected both sides of the seam, and their edges were NOT recorded as cut edges, letting the flood-fill leak across.

### Solution: Multi-layered robustness

**1. Relaxed `findCrossingsFromSegmentEndpoints` tolerance**
The point-on-edge test used `tol = max(edgeLen * 1e-8, 1e-6)` — far too tight for UTM coordinates (500000+). Relaxed to `max(edgeLen * 5e-5, 1e-4)`. Also added same-edge vertex reassignment: when both segment endpoints match the same edge (one at a shared vertex), reassign the vertex endpoint to its other edge.

**2. New Step 4c: crossings=1, vertOnLine=0**
When one edge crossing is found but no vertex lies on the line (precision gap), split from the crossing point to the opposite vertex. Geometrically approximate but topologically correct — breaks the cut adjacency.

**3. New Step 4d: crossings=0, nearest-edge projection**
When line-edge intersection finds nothing, project segment endpoints onto their nearest triangle edges. If they project onto different edges with interior parameters, split at those projections.

**4. New `nearestEdgeProjection` helper**
Projects a 3D point onto the nearest point on any of the 3 triangle edges. Returns edge index, parameter t, projected point, and distance.

**5. Last resort: isolate bridge triangles**
If all fallbacks fail, record ALL 3 edges of the unsplit triangle as cut edges. This fully isolates it from all neighbors in the flood-fill, preventing any leakage.

**6. Shard-tolerant `refineComponentsWithCutEdges`**
Isolated bridge triangles become 1-triangle "shards." The old logic rejected the entire sub-split if ANY component was too small. New logic separates "significant" components (>= minSize) from "shards" (< minSize). Accepts if 2+ significant components exist. Shards are merged into the first significant component.

**7. Widened `deduplicateCrossings` threshold**
Changed `DIST_SQ_THRESH` from `1e-12` to `1e-8` for better UTM precision.

**8. Surface names in labels**
Split group labels now include the original surface name: `TOE POTENTIAL [1/2] (13500 tris)` instead of `SURF-A[1] (13500 tris)`.

### Non-Destructive Behavior

The `applyMerge` function produces a NEW surface (`BOOL_SURFACE_xxxx`) added to `window.loadedSurfaces`. Original surfaces are hidden during the preview and restored on both Apply and Cancel. They are NEVER modified or deleted.

### Stitch Intersection

- **Stitch ON**: Vertices along the intersection line are welded (shared) via `deduplicateSeamVertices` and `weldVertices`
- **Stitch OFF**: Vertices remain duplicated, creating a geometric "tear" at the intersection

## Files Modified

- `src/helpers/SurfaceBooleanHelper.js` — all changes above
- `src/helpers/SurfaceIntersectionHelper.js` — ensureZUpNormals in computeSurfaceIntersections
