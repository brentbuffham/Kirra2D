# Boolean Cap Pipeline Fixes — Remaining 47 Open Edges & 18 Non-Manifold

**Date**: 2026-02-23
**Status**: Analysis complete, implementation pending
**File**: `src/helpers/SurfaceBooleanHelper.js`

## Context

After implementing Task 1 (quad shortcut in `triangulateLoop`) and Task 2 (post-weld iterative capping in `applyMerge`), boundary edges dropped from **115 → 47**, but the result is still not closed. Console output reveals three cascading issues.

## Pipeline Trace

| Stage | Points | Tris | Boundary Edges | Non-Manifold | Loops |
|-------|--------|------|----------------|-------------|-------|
| After dedup+weld | 172 | 249 | — | — | — |
| After stitch | ~172 | ~279 | 139 | — | 11 |
| After stitch cap | ~172 | ~314 | — | — | — |
| Final weld | 171 | 302 | 97 | — | 6 (4,4,4,5,4,8) |
| Post-weld cap pass 1 | 171 | 320 | 74 | growing | 6 (7,4,13,4,7,3) |
| Post-weld cap pass 2 | 171 | 346 | 51 | growing | 1 (4) |
| Post-weld cap pass 3 | 171 | 348 | **47** | **18** | 1 (7) |

## Root Causes

### RC1: `triangulateLoop` Picks Degenerate 2D Projection (HIGH IMPACT)

The Newell's method normal selects one projection plane (XY, XZ, or YZ) based on the largest normal component. For near-vertical seam boundaries (pit walls), the projected polygon can be near-degenerate (nearly collinear in 2D). This causes:
- `_pointInLoop2D` centroid test to reject valid interior triangles
- **Evidence**: 8-vertex loops produce only 2 cap tris instead of 6
- The 4 missing tris leave open edges that merge with neighbouring loops

### RC2: Non-Manifold Edges Accumulate Between Cap Passes (HIGH IMPACT)

The post-weld cap loop never calls `cleanCrossingTriangles` between passes. Non-manifold edges from pass N contaminate the boundary walk in pass N+1:
- `extractBoundaryLoops` walks `count === 1` edges; at vertices adjacent to `count > 2` edges, the walk can cross into non-manifold territory
- **Evidence**: Loop sizes grow from `[4,4,4,5,4,8]` to `[7,4,13,4,7,3]` — the 13-vertex loop is two small loops merged through a non-manifold junction

### RC3: All Loops Capped Simultaneously (MEDIUM IMPACT)

`capBoundaryLoops` extracts all loops, triangulates them all, then pushes all cap tris at once. If two adjacent loops share a boundary vertex, their cap tris claim the same edges → immediate non-manifold.

### RC4: Cap Triangle Winding May Be Inverted (MEDIUM IMPACT)

After welding + `weldedToSoup`, vertex object identity changes. The `halfEdges` map in `extractBoundaryLoops` relies on string-keyed vertex comparisons. If cap triangle winding doesn't match the mesh's existing half-edge direction, the cap creates "tent" edges — closing the original boundary but opening new ones on the tent's flanks.

## Fix Plan (Priority Order)

### Fix 1: Improve `triangulateLoop` Projection Selection

**Where**: `triangulateLoop()` function, projection selection block (currently lines ~1526-1548)

**What**: Instead of using Newell's normal to pick ONE projection, try all three planes and use the one with the largest projected polygon area. Also use the signed area to correct winding before Delaunator.

```javascript
// After the loop.length === 4 shortcut and before Delaunator...

// Try all 3 projection planes — pick the one with the largest polygon area
var projections = [
    { u: function(p) { return p.x; }, v: function(p) { return p.y; } },
    { u: function(p) { return p.x; }, v: function(p) { return p.z; } },
    { u: function(p) { return p.y; }, v: function(p) { return p.z; } }
];
var bestArea = 0;
var bestIdx = 0;
for (var pi = 0; pi < 3; pi++) {
    var area = 0;
    for (var ai = 0; ai < n; ai++) {
        var aCurr = loop[ai], aNext = loop[(ai + 1) % n];
        area += projections[pi].u(aCurr) * projections[pi].v(aNext)
              - projections[pi].u(aNext) * projections[pi].v(aCurr);
    }
    if (Math.abs(area) > Math.abs(bestArea)) {
        bestArea = area;
        bestIdx = pi;
    }
}
projU = projections[bestIdx].u;
projV = projections[bestIdx].v;
```

**Why**: The 8-vertex loop failure (2/6 tris) is the root cause of the cascading loop-growth problem. Fixing this alone should eliminate the 13-vertex monster loop and dramatically reduce remaining open edges.

### Fix 2: Clean Non-Manifold Edges Before Each Cap Pass

**Where**: Post-weld cap loop in `applyMerge()` (currently lines ~1178-1204)

**What**: Before calling `capBoundaryLoops`, call `cleanCrossingTriangles` to strip any non-manifold (count > 2) triangles. This prevents contaminated boundary walks.

```javascript
for (var capPass = 0; capPass < maxCapPasses; capPass++) {
    // NEW: Clean non-manifold before extracting loops
    var preStats = countOpenEdges(postSoup);
    if (preStats.overShared > 0) {
        postSoup = cleanCrossingTriangles(postSoup);
        var cleanWeld = weldVertices(postSoup, snapTol);
        postSoup = weldedToSoup(cleanWeld.triangles);
        console.log("SurfaceBooleanHelper: post-weld cap pass " + (capPass + 1) +
            " cleaned " + preStats.overShared + " non-manifold edges first");
    }

    var capResult = capBoundaryLoops(postSoup);
    // ... rest unchanged
}
```

### Fix 3: Cap Loops One at a Time

**Where**: `capBoundaryLoops()` function (line ~1492) or a new wrapper

**What**: Instead of triangulating all loops and returning all cap tris at once, process loops individually with a re-weld + non-manifold check between each:

```javascript
function capBoundaryLoopsSequential(soup, snapTol) {
    var result = extractBoundaryLoops(soup);
    if (result.loops.length === 0) return soup;

    var currentSoup = soup;
    for (var li = 0; li < result.loops.length; li++) {
        var loopTris = triangulateLoop(result.loops[li]);
        if (loopTris.length === 0) continue;

        for (var lt = 0; lt < loopTris.length; lt++) {
            currentSoup.push(loopTris[lt]);
        }

        // Re-weld after EACH loop cap
        var reW = weldVertices(currentSoup, snapTol);
        currentSoup = weldedToSoup(reW.triangles);

        // Strip any new non-manifold edges before next loop
        var stats = countOpenEdges(currentSoup);
        if (stats.overShared > 0) {
            currentSoup = cleanCrossingTriangles(currentSoup);
            var reW2 = weldVertices(currentSoup, snapTol);
            currentSoup = weldedToSoup(reW2.triangles);
        }
    }
    return currentSoup;
}
```

Then call this from `applyMerge` instead of `capBoundaryLoops`.

### Fix 4: Validate Cap Triangle Winding (Safety Net)

**Where**: Inside `capBoundaryLoops` or `triangulateLoop`

**What**: After creating cap triangles, compute each cap tri's normal. Dot it against the loop normal (from Newell's method). If negative, flip the triangle winding.

### Fix 5: Final Safety Net — `forceCloseIndexedMesh`

**Where**: `applyMerge()`, after the post-weld cap loop

**What**: If any open edges remain after all cap passes, run `forceCloseIndexedMesh` (already exists at line ~2186) as a last resort. It works in pure integer-index space, avoiding all float-key issues.

```javascript
if (closeMode === "stitch") {
    var finalStats = countOpenEdges(weldedToSoup(triangles));
    if (finalStats.openEdges > 0) {
        console.log("SurfaceBooleanHelper: " + finalStats.openEdges +
            " edges remain after capping, running forceCloseIndexedMesh...");
        var closedResult = forceCloseIndexedMesh(worldPoints, triangles);
        worldPoints = closedResult.points;
        triangles = closedResult.triangles;
    }
}
```

## Expected Outcome

- **Fix 1** alone should reduce open edges from 47 to ~10-15 (the 8-vert loop cascade accounts for ~30 boundary edges)
- **Fix 1 + Fix 2** should reach ~5-10 open edges
- **Fix 1 + Fix 2 + Fix 3** should reach 0-5 open edges
- **Fix 5** (safety net) should close any remaining stragglers

## What This Does NOT Fix

The fundamental seam vertex mismatch (each surface independently computes crossing points via `lerpVert`) means the two surfaces have different edge structures along the intersection seam. This is a larger refactor of the split algorithm (`computeSplits`) — out of scope here. The cap pipeline fixes address the symptom: closing whatever boundary loops remain after the stitch.
