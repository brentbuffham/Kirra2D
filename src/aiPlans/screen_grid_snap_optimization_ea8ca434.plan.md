---
name: Screen Grid Snap Optimization
overview: Implement a 10x10 screen-space grid partitioning system (zones A-J horizontally, 1-10 vertically) to optimize snapping and raycasting performance for large surfaces. The mouse location determines which zone to query, dramatically reducing the number of candidates to evaluate.
todos:
  - id: create-grid-class
    content: Create src/helpers/ScreenSpaceGrid.js with zone calculation, indexing, and query methods
    status: pending
  - id: integrate-snap2d
    content: Modify snapToNearestPoint() to use grid-filtered candidates with fallback
    status: pending
  - id: integrate-snap3d
    content: Modify snapToNearestPointWithRay() to use screen-projected grid zones
    status: pending
  - id: add-rebuild-triggers
    content: Add dirty flag and rebuild triggers on camera/data changes
    status: pending
  - id: expose-debug
    content: Add optional debug overlay showing current zone (B5) and candidate count
    status: pending
---

# Screen-Space Grid Partitioning for Snap Optimization

## Problem Analysis

The current snap functions ([`kirra.js`](D:\GIT_WORKSPACE\GIT_KIRRA-2D-3D\Kirra2D\src\kirra.js) ~line 46458) iterate through **all** snap targets (holes, KAD vertices, segments) for every mouse move/click, calculating distances for each. For large surfaces with thousands of points, this becomes a performance bottleneck.

## Solution Overview

Implement a **screen-space grid partitioning** system:

- Divide the viewport into a 10x10 grid (100 zones)
- Label zones A-J horizontally (columns) and 1-10 vertically (rows)
- Pre-index snap targets by their screen-space zone
- Only evaluate candidates in the mouse's current zone (plus adjacent zones for boundary tolerance)
```
Screen Layout:
  A   B   C   D   E   F   G   H   I   J
+---+---+---+---+---+---+---+---+---+---+
| 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Row 1
+---+---+---+---+---+---+---+---+---+---+
| 2 | 2 | B2| 2 | 2 | 2 | 2 | 2 | 2 | 2 | Row 2 <- Mouse in zone B2
...
+---+---+---+---+---+---+---+---+---+---+
|10 |10 |10 |10 |10 |10 |10 |10 |10 |10 | Row 10
+---+---+---+---+---+---+---+---+---+---+
```


## Key Files to Modify/Create

1. **NEW**: `src/helpers/ScreenSpaceGrid.js` - Grid partitioning class
2. **MODIFY**: [`src/kirra.js`](D:\GIT_WORKSPACE\GIT_KIRRA-2D-3D\Kirra2D\src\kirra.js) - Integrate grid into snap functions

## Implementation Details

### Step 1: Create ScreenSpaceGrid Class

New file `src/helpers/ScreenSpaceGrid.js`:

```javascript
// Key methods:
- constructor(gridCols=10, gridRows=10)
- updateViewport(canvasWidth, canvasHeight)
- worldToScreenZone(worldX, worldY, camera)
- getZoneLabel(col, row) // Returns "B5", "J10", etc.
- buildIndex(snapTargets, camera) // Pre-index all targets
- queryZone(col, row, includeAdjacent=true) // Get targets in zone(s)
- getMouseZone(mouseScreenX, mouseScreenY) // Returns {col, row, label}
```

### Step 2: Integrate into Snap Functions

Modify `snapToNearestPoint()` (~line 46458):

```javascript
// BEFORE (iterates ALL targets):
allBlastHoles.forEach((hole) => { ... });

// AFTER (only targets in mouse zone):
var grid = window.screenSpaceSnapGrid;
if (grid && grid.isValid()) {
    var mouseZone = grid.getMouseZone(mouseScreenX, mouseScreenY);
    var zoneCandidates = grid.queryZone(mouseZone.col, mouseZone.row, true);
    zoneCandidates.forEach((target) => { ... });
} else {
    // Fallback to full search
    allBlastHoles.forEach((hole) => { ... });
}
```

### Step 3: Index Rebuilding Strategy

The grid index needs rebuilding when:

- Camera zoom/pan changes (screen positions change)
- Data changes (holes/KAD added/removed)
- Window resizes

Strategy: Lazy rebuild with dirty flag + throttling (max 10 rebuilds/sec)

```javascript
// In render loop or camera change handler:
if (screenSpaceSnapGrid.isDirty() && performance.now() - lastGridRebuild > 100) {
    screenSpaceSnapGrid.buildIndex(getSnapTargets(), threeRenderer.camera);
    lastGridRebuild = performance.now();
}
```

### Step 4: 3D Ray-Based Snapping

For `snapToNearestPointWithRay()` (~line 46666), the approach is similar but uses projected screen coordinates:

```javascript
// Project world point to screen, get zone
var screenPos = projectToScreen(worldX, worldY, worldZ, camera);
var zone = grid.getZoneLabel(screenPos.x, screenPos.y);
```

## Performance Expectations

- **Before**: O(n) distance calculations per mouse event (n = total snap targets)
- **After**: O(n/100) on average (only 1-9 zones searched depending on boundary)
- For 10,000 holes: ~100 candidates per zone instead of 10,000
- Significant improvement for surfaces with 50,000+ triangles

## Existing Code to Leverage

- [`FrustumCuller.js`](D:\GIT_WORKSPACE\GIT_KIRRA-2D-3D\Kirra2D\src\three\FrustumCuller.js) has quadtree implementation (world-space) - similar pattern
- Existing `createSpatialIndex()` at line 17100 uses grid cells for vertex lookup
- `worldToScreen()` function already exists for coordinate conversion

## Edge Cases

- Targets near zone boundaries: Query adjacent zones (3x3 = 9 zones max)
- Empty zones: Return empty array, fallback gracefully
- Zoomed out (many targets per zone): Grid still helps vs full search
- 3D orbited view: Screen projection handles rotation correctly