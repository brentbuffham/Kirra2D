---
name: Selection Performance Fix
overview: "Fix application freezing during multi-selection in both 2D and 3D by implementing a type-based vertex rendering rule: only show vertices when the selection contains at most 1 entity of each KAD type. Apply same logic to 3D selection highlights."
todos:
  - id: 2d-type-count
    content: Add type counting logic to canvas2DDrawSelection.js
    status: pending
  - id: 2d-remove-bbox
    content: Remove bounding box simplified rendering mode
    status: pending
  - id: 3d-type-count
    content: Add type counting logic to canvas3DDrawSelection.js
    status: pending
  - id: 3d-skip-vertices
    content: Pass skipVertices flag and conditionally skip vertex geometry creation in 3D
    status: pending
---

# Selection Performance Optimization Plan

## Problem Statement

When selecting large numbers of KAD entities, both 2D and 3D modes freeze. The 2D has some limits but 3D is worse because:

1. 3D selection creates THREE.js geometry objects for each vertex (expensive)
2. No type-counting vertex skip logic in 3D
3. No simplification applied to 3D selection highlights

## Solution: Type-Based Vertex Rule (Both 2D and 3D)

**Rule**: Only render vertices if the selection has **at most 1 entity of each KAD type**.

## Implementation

### File 1: [`src/draw/canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js)

Replace count-based logic at line 280 with type-counting:

```javascript
// Step 4.0) Count entities by type for vertex rendering decision
var typeCounts = { line: 0, poly: 0, point: 0, circle: 0, text: 0 };
for (var i = 0; i < selectedMultipleKADObjects.length; i++) {
    var type = selectedMultipleKADObjects[i].entityType;
    if (typeCounts[type] !== undefined) {
        typeCounts[type]++;
    }
}

// Step 4.0a) Only draw vertices if NO type has more than 1 entity
var maxTypeCount = Math.max(typeCounts.line, typeCounts.poly, typeCounts.point, typeCounts.circle, typeCounts.text);
var skipVertices = maxTypeCount > 1;

// Step 4.0b) Keep render cap for safety
var MAX_RENDER_COUNT = 2000;
var renderCount = Math.min(selectionCount, MAX_RENDER_COUNT);
```

Also **remove the bounding box mode** (delete lines 306-336) - always draw full outlines.---

### File 2: [`src/draw/canvas3DDrawSelection.js`](src/draw/canvas3DDrawSelection.js)

#### Change 1: Add type-counting logic (after line 58)

```javascript
// Step 3.0) Count entities by type for vertex rendering decision
var typeCounts = { line: 0, poly: 0, point: 0, circle: 0, text: 0 };
for (var i = 0; i < selectedMultipleKADObjects.length; i++) {
    var type = selectedMultipleKADObjects[i].entityType;
    if (typeCounts[type] !== undefined) {
        typeCounts[type]++;
    }
}

// Step 3.0a) Only draw vertices if NO type has more than 1 entity
var maxTypeCount = Math.max(typeCounts.line, typeCounts.poly, typeCounts.point, typeCounts.circle, typeCounts.text);
var skipVertices3D = maxTypeCount > 1;
```



#### Change 2: Pass `skipVertices` to drawKADEntityHighlight (line 94)

```javascript
drawKADEntityHighlight(kadObj, entity, selectedSegmentColor, nonSelectedSegmentColor, verticesColor, worldToThreeLocal, dataCentroidZ, developerModeEnabled, skipVertices3D);
```



#### Change 3: Update drawKADEntityHighlight function signature (line 174)

```javascript
function drawKADEntityHighlight(kadObject, entity, selectedSegmentColor, nonSelectedSegmentColor, verticesColor, worldToThreeLocal, dataCentroidZ, developerModeEnabled, skipVertices) {
```



#### Change 4: Skip vertex rendering in line/poly case (lines 271-288)

```javascript
// Step 4c.4) Draw vertices for all points ONLY if not skipping
if (!skipVertices) {
    points.forEach((point, index) => {
        // ... existing vertex drawing code ...
    });
}
```

Apply same pattern to point, circle, and text cases.---

## Expected Behavior After Fix

| Selection | 2D Vertices | 3D Vertices | Rendering |

|-----------|-------------|-------------|-----------|

| 1 line | Yes | Yes | Full |

| 1 line + 1 poly | Yes | Yes | Full |

| 2 lines | No | No | Color/thickness only |

| 500 lines | No | No | Capped at 2000/500 |

## Files to Modify

| File | Changes |

|------|---------|

| [`src/draw/canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js) | Add type-counting, remove bounding box mode |