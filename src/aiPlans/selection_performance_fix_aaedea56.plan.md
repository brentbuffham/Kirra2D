---
name: Selection Performance Fix
overview: "Fix application freezing during multi-selection by implementing a type-based vertex rendering rule: only show vertices when the selection contains at most 1 entity of each KAD type. When vertices are hidden, still draw full entity outlines with color/thickness highlighting (no bounding boxes)."
todos:
  - id: type-count-logic
    content: Add entity type counting to determine max entities per type
    status: pending
  - id: vertex-skip-rule
    content: "Update skipVertices condition: maxTypeCount > 1 means skip vertices"
    status: pending
  - id: remove-bounding-box
    content: Remove simplified bounding box rendering mode entirely
    status: pending
---

# Selection Performance Optimization Plan

## Problem Statement

When selecting large numbers of KAD entities, the application freezes due to vertex rendering overhead. The current simplified rendering mode uses bounding boxes which the user does not want.

## Proposed Solution: Type-Based Vertex Rule

**Rule**: Only render vertices if the selection has **at most 1 entity of each KAD type**.

| Selection | Vertices Shown | Rendering |
|-----------|----------------|-----------|
| 1 line | Yes | Full with vertices |
| 1 line + 1 poly + 1 point | Yes | Full with vertices |
| 2 lines | No | Color/thickness only |
| 1 line + 2 polys | No | Color/thickness only |
| 500 lines | No | Color/thickness only (capped at 2000 entities) |

## Implementation

### File: [`src/draw/canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js)

#### Change 1: Replace type counting logic (around line 280)

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

// Step 4.0b) Cap render count for very large selections (prevent total freeze)
var MAX_RENDER_COUNT = 2000;
var renderCount = Math.min(selectionCount, MAX_RENDER_COUNT);
```

#### Change 2: Remove simplified bounding box mode (delete lines 306-336)

Remove the entire `if (useSimplifiedRendering)` block that draws bounding boxes. Always draw actual entity outlines.

#### Change 3: Keep vertex skip logic in entity drawing

The existing `drawVerticesForThis` variable usage at lines 384, 434, 481, 510, 547 remains - these correctly skip vertex drawing when `skipVertices` is true while still drawing entity outlines.

## Files to Modify

| File | Changes |
|------|---------|
| [`src/draw/canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js) | Update vertex skip logic to "max 1 per type" rule, remove bounding box mode |

## Expected Behavior

- **1 line selected**: Green outline + red vertex dots
- **1 line + 1 poly selected**: Both have green outlines + red vertex dots  
- **2 lines selected**: Both have green outlines, NO vertex dots
- **1000 lines selected**: All have green outlines (up to 2000 cap), NO vertex dots, no freeze