# Surface Boolean Normal Alignment Fix + Surface Context Menu Tools

**Date:** 2026-02-20 15:30
**Status:** Implemented

## Summary

Boolean operations produced meshes with open edges due to inconsistent face normals between input meshes. This plan adds automatic normal alignment before boolean operations and provides three new TreeView context menu tools for surface management.

## Changes Made

### Part A: Normal Alignment Fix for Boolean Operations

#### A1: SurfaceIntersectionHelper.js — New Utilities
- **`ensureZUpNormals(tris)`** — Enforces Z-up convention by checking each triangle's normal and flipping winding (swap v1↔v2) if normal.z < -0.01. Returns cloned array. Near-vertical faces left unchanged.
- **`countOpenEdges(tris)`** — Post-operation diagnostic counting boundary (open) and non-manifold (over-shared) edges.
- **`flipAllNormals(tris)`** — Unconditionally reverses all triangle winding. Returns cloned array.

#### A2: SurfaceBooleanHelper.js — Integration
- Added `ensureZUpNormals` and `countOpenEdges` to imports
- `computeSplits()`: Normalizes both input triangle sets after extraction
- `applyMerge()`: Logs open-edge diagnostic after final weld

#### A3: SolidCSGHelper.js — Integration
- Imported `extractTriangles` and `ensureZUpNormals`
- `surfaceToMesh()`: Uses extractTriangles + ensureZUpNormals for consistent input
- Added developer reminder comment on intentionally inverted CSG operation mapping

### Part B: TreeView Context Menu — Surface Tools

#### B1: kirra.html
- Added 3 new context menu items: Flip Normals, Align Normals, Statistics
- Added separator before Properties item

#### B2-B4: TreeView.js
- **Visibility logic**: New items shown only when surface nodes are selected (`surface⣿{id}`)
- **Action handlers**: 3 new cases in handleContextAction switch
- **`flipNormals()`**: Reverses winding on all selected surfaces, persists + redraws
- **`alignNormals()`**: Aligns to Z-up, shows FloatingDialog with per-surface flip counts
- **`showStatistics()`**: Multi-surface statistics table showing points, edges, faces, normal direction, projected areas (XY/YZ/XZ), 3D surface area, volume, closed status

#### B5: SurfaceNormalHelper.js (NEW)
- `flipSurfaceNormals(surface)` — Flip all normals, return storage-format triangles
- `alignSurfaceNormals(surface)` — Align to Z-up, return triangles + flip count
- `computeSurfaceStatistics(surface)` — Full statistics row object
- `computeProjectedArea(tris, plane)` — Projected area for XY/YZ/XZ
- `compute3DSurfaceArea(tris)` — True 3D surface area
- Internal: `countUniqueEdges`, `computeVolumeFromTris`, `soupToSurfaceTriangles`

## Files Modified
1. `src/helpers/SurfaceIntersectionHelper.js` — 3 new exported functions
2. `src/helpers/SurfaceBooleanHelper.js` — import update + 2 integration points
3. `src/helpers/SolidCSGHelper.js` — import + surfaceToMesh rewrite + comment
4. `kirra.html` — 3 new context menu items + separator
5. `src/dialog/tree/TreeView.js` — visibility logic + action handlers + 3 methods + formatArea helper

## Files Created
6. `src/helpers/SurfaceNormalHelper.js` — Reusable normal/statistics functions

## Verification
1. Boolean normal fix: Surfaces with inverted normals get auto-aligned before splitting
2. Flip Normals: Right-click surface → Flip Normals → winding reverses
3. Align Normals: Right-click → Align Normals → info dialog with counts
4. Statistics: Select surface(s) → Statistics → table with all metrics
5. Non-regression: Z-up surfaces produce identical results (0 flipped)
