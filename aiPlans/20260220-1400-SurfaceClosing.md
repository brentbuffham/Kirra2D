# Surface Boolean Closing Enhancement Plan
**Date:** 2026-02-20

---

## Context

The Surface Boolean (TRIBOOL) tool works — it splits two surfaces along their intersection and merges kept regions. But the result is OPEN (not a closed solid). Diagnostic shows:
- 170 boundary edges (open edges)
- 35 over-shared edges (crossing/duplicate triangles from splitting)

This plan adds three closing features + crossing triangle cleanup, all working together or independently.

---

## Files to Modify

| File | Changes |
|---|---|
| `src/helpers/SurfaceBooleanHelper.js` | Refactor pipeline, add 6 new functions, import earcut |
| `src/dialog/popups/surface/SurfaceBooleanDialog.js` | Replace checkbox with dropdown + floor offset input |

---

## Pipeline Change: `applyMerge()` Reorder

**Current (wrong):** collect → cap → weld
**New:** collect → weld → clean crossings → stitch/curtain → re-weld → store

```
1. Collect kept triangles
2. Weld vertices (snap close vertices in 3D)
3. Clean crossing triangles (remove duplicates causing over-shared edges)
4. Stitch boundary loops (if mode = "stitch" or "stitch+curtain")
5. Curtain walls + bottom cap (if mode = "curtain" or "stitch+curtain")
6. Re-weld final soup (merge curtain/stitch seams)
7. Log boundary stats
8. Store result surface
```

New config fields: `closeMode` ("none"|"stitch"|"curtain"|"stitch+curtain"), `floorOffset` (metres below minZ).

---

## Feature 1: `cleanCrossingTriangles(tris)`

Removes duplicate triangles causing over-shared edges (count>2):
- Build edge→[triIndex] map
- Flag all triangles touching any over-shared edge
- Among flagged triangles, deduplicate by sorted-vertex-key fingerprint
- Keep first occurrence, discard duplicates
- Non-flagged triangles pass through unchanged

---

## Feature 2: `stitchBoundaryLoops(tris)` + `buildZipperWall(loopA, loopB)`

Connects paired upper/lower boundary loops with wall triangles:
- Extract boundary loops via `extractBoundaryLoops()` (refactored from `capBoundaryLoops`)
- Pair loops by XY centroid proximity (closest pairs)
- **Zipper algorithm**: align start points, two-pointer greedy walk advancing whichever pointer creates the smaller triangle
- Unpaired loops get flat-capped via existing `triangulateLoop()`

---

## Feature 3: `buildCurtainAndCap(tris, floorOffset)`

Extrudes remaining open boundary edges vertically to a floor:
- `floorZ = minZ - floorOffset`
- For each boundary edge A→B: build 2 triangles (vertical quad) from top to floorZ
- Collect floor-level vertices per loop
- Triangulate bottom cap with `earcut` (flat XY projection at floorZ)
- Reverse winding on bottom cap so normals face downward

**New import** at top of SurfaceBooleanHelper.js: `import earcut from "earcut"` (already a project dependency).

---

## Feature 4: Refactor `extractBoundaryLoops(tris)`

Extract the loop-chaining logic from `capBoundaryLoops()` into a standalone reusable function. Both stitch and curtain call it. `capBoundaryLoops()` becomes a thin wrapper.

---

## Dialog UI Changes (SurfaceBooleanDialog.js)

Replace the "Close Surface" checkbox (lines 599-616) with:

| Control | Type | Values |
|---|---|---|
| Close Mode | `<select>` dropdown | None, Stitch Boundaries, Curtain + Cap, Stitch + Curtain |
| Floor Offset | `<input type="number">` | Default 10m, shown only when curtain mode selected |

Update `onConfirm` to pass `closeMode` and `floorOffset` in config.

---

## New Functions Summary

| Function | Purpose |
|---|---|
| `weldedToSoup(weldedTriangles)` | Convert `{vertices:[...]}` back to `{v0,v1,v2}` soup |
| `extractBoundaryLoops(tris)` | Refactored loop-finder, reusable by stitch + curtain |
| `cleanCrossingTriangles(tris)` | Remove duplicate triangles from over-shared edges |
| `stitchBoundaryLoops(tris)` | Pair + connect boundary loops with zipper walls |
| `buildZipperWall(loopA, loopB)` | Greedy two-pointer quad-strip between two loops |
| `buildCurtainAndCap(tris, floorOffset)` | Vertical walls + earcut floor cap |
| `logBoundaryStats(tris, closeMode)` | Console diagnostic after capping |
| `dist3(a, b)` | 3D distance utility |

---

## Implementation Order

1. Refactor `extractBoundaryLoops()` out of `capBoundaryLoops()`
2. Add `weldedToSoup()` helper
3. Add `cleanCrossingTriangles()`
4. Reorder `applyMerge()` pipeline (weld first, then close)
5. Add `buildCurtainAndCap()` with earcut import
6. Add `stitchBoundaryLoops()` + `buildZipperWall()`
7. Add `logBoundaryStats()`
8. Update dialog UI (dropdown + floor offset)

---

## Verification

1. Run boolean on two overlapping surfaces → Apply with "None" → `window.debugSurfaceClosed()` should show fewer over-shared edges (crossing cleanup)
2. Apply with "Curtain + Cap" → should show `Closed: true` and TreeView shows `[SOLID]` with volume
3. Apply with "Stitch Boundaries" → should reduce boundary edges (walls between loops)
4. Apply with "Stitch + Curtain" → stitch first, curtain remaining → `Closed: true`
5. Snap tolerance confirmed as 3D distance (already correct)

---

## Style Rules
- `var` not `const`/`let`, no arrow functions, semicolons
- `// ────` section headers, JSDoc blocks
- Log prefix: `"SurfaceBooleanHelper: "`
