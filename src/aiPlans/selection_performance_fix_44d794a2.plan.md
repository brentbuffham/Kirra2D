---
name: Selection Performance Fix
overview: Fix application freezing during multi-selection in both 2D and 3D by implementing a type-based vertex rendering rule using the same inline counting pattern as the HUD stats. Only show vertices when the selection contains at most 1 entity of each KAD type.
todos:
  - id: 2d-type-count
    content: Add inline type counting to canvas2DDrawSelection.js using HUD pattern
    status: completed
  - id: 2d-remove-bbox
    content: Remove bounding box simplified rendering mode from 2D
    status: completed
  - id: 3d-type-count
    content: Add inline type counting to canvas3DDrawSelection.js
    status: completed
  - id: 3d-skip-vertices
    content: Pass skipVertices flag and wrap vertex drawing in conditionals
    status: completed
---

# Selection Performance Optimization

Plan

## Problem

Large multi-selections freeze the app due to vertex rendering overhead in both 2D and 3D.

## Solution

Use the same inline type counting pattern as the HUD stats (kirra.js lines 22178-22188):

- Count selected entities by type

- Skip vertices if any type has more than 1 entity

- Always draw entity outlines (color/thickness), never bounding boxes

---

## File 1: [`src/draw/canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js)

### Change at line ~278 (inside the multi-selection block)

Replace the current count-based logic with:

```javascript
// Step 4.0) Count selected entities by type (same pattern as HUD stats)
var kadPointCount = 0, kadLineCount = 0, kadPolyCount = 0, kadCircleCount = 0, kadTextCount = 0;
for (var i = 0; i < selectedMultipleKADObjects.length; i++) {
    var type = selectedMultipleKADObjects[i].entityType;
    if (type === "point") kadPointCount++;
    else if (type === "line") kadLineCount++;
    else if (type === "poly") kadPolyCount++;
    else if (type === "circle") kadCircleCount++;
    else if (type === "text") kadTextCount++;
}

// Step 4.0a) Only draw vertices if NO type has more than 1 entity
var maxTypeCount = Math.max(kadPointCount, kadLineCount, kadPolyCount, kadCircleCount, kadTextCount);
var skipVertices = maxTypeCount > 1;

// Step 4.0b) Cap render count for safety
var MAX_RENDER_COUNT = 2000;
var selectionCount = selectedMultipleKADObjects.length;
var renderCount = Math.min(selectionCount, MAX_RENDER_COUNT);
```



### Also: Remove bounding box mode (delete lines 306-336)

The `if (useSimplifiedRendering)` block that draws bounding boxes should be removed entirely.---

## File 2: [`src/draw/canvas3DDrawSelection.js`](src/draw/canvas3DDrawSelection.js)

### Change 1: Add type counting after line 58

```javascript
// Step 3.0) Count selected entities by type (same pattern as HUD stats)
var kadPointCount = 0, kadLineCount = 0, kadPolyCount = 0, kadCircleCount = 0, kadTextCount = 0;
for (var i = 0; i < selectedMultipleKADObjects.length; i++) {
    var type = selectedMultipleKADObjects[i].entityType;
    if (type === "point") kadPointCount++;
    else if (type === "line") kadLineCount++;
    else if (type === "poly") kadPolyCount++;
    else if (type === "circle") kadCircleCount++;
    else if (type === "text") kadTextCount++;
}

// Step 3.0a) Only draw vertices if NO type has more than 1 entity
var maxTypeCount = Math.max(kadPointCount, kadLineCount, kadPolyCount, kadCircleCount, kadTextCount);
var skipVertices3D = maxTypeCount > 1;
```



### Change 2: Pass skipVertices flag to drawKADEntityHighlight (line ~94)

```javascript
drawKADEntityHighlight(kadObj, entity, selectedSegmentColor, nonSelectedSegmentColor, verticesColor, worldToThreeLocal, dataCentroidZ, developerModeEnabled, skipVertices3D);
```



### Change 3: Update function signature (line 174)

```javascript
function drawKADEntityHighlight(kadObject, entity, selectedSegmentColor, nonSelectedSegmentColor, verticesColor, worldToThreeLocal, dataCentroidZ, developerModeEnabled, skipVertices) {
```



### Change 4: Conditionally skip vertex geometry in each entity type case

Wrap vertex drawing code with `if (!skipVertices)` - affects:

- Line 196-213 (point case)

- Lines 271-288 (line/poly case) 

- Lines 307-308 (circle center point)
- Lines 345-346 (text anchor point)

---

## Expected Behavior

| Selection | Vertices | Outlines |

|-----------|----------|----------|

| 1 line | Yes | Green |

| 1 line + 1 poly | Yes | Green |

| 2 lines | No | Green |

| 1 line + 2 circles | No | Green |