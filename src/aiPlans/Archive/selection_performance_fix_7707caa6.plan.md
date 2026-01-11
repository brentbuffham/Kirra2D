---
name: Selection Performance Fix
overview: "Fix application freezing during multi-selection by implementing a type-based vertex rendering limit: only show vertices when the selection contains at most 2 entities of any single KAD type. This prevents render freeze while maintaining vertex editing capability for small mixed selections."
todos:
  - id: type-count-logic
    content: Add entity type counting logic to canvas2DDrawSelection.js
    status: pending
  - id: vertex-limit-update
    content: Update vertex skip condition to use type count > 2 rule
    status: pending
  - id: status-message
    content: Add user feedback when vertices are hidden for large selections
    status: pending
  - id: 3d-selection-update
    content: Update PolygonSelection3D.js warning threshold and messaging
    status: pending
---

# Selection Performance Optimization Plan

## Problem Statement

When selecting large numbers of KAD entities (e.g., 3000+ lines from a DXF import), the application freezes without warning. The root cause is the vertex rendering loop in `drawKADHighlightSelectionVisuals()` which draws individual vertices for every point in every selected entity.

## Current State

The existing performance limits in [`src/draw/canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js) (lines 280-287) are count-based:
- `VERTEX_DRAW_LIMIT = 50` - only draw vertices for selections < 50 entities
- `SIMPLIFIED_DRAW_LIMIT = 500` - use bounding boxes above 500
- `MAX_RENDER_COUNT = 2000` - hard cap on render count

## Proposed Solution: Type-Based Vertex Limit

Instead of a simple entity count, implement the user's suggested approach:

**Rule**: Only render vertices if the selection has 2 or fewer entities of each KAD type (line, poly, point, circle, text).

This allows:
- 1 line + 1 poly + 2 circles = vertices shown (useful for editing)
- 3 lines = NO vertices shown (likely a bulk selection, not editing)
- 50 lines = NO vertices shown, use simplified rendering

## Implementation

### Step 1: Add type-counting logic to selection drawing

In [`src/draw/canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js), replace the current count-based check at line 280 with type-counting:

```javascript
// Step 4.0) Count entities by type for vertex rendering decision
var typeCounts = { line: 0, poly: 0, point: 0, circle: 0, text: 0 };
for (var i = 0; i < selectedMultipleKADObjects.length; i++) {
    var type = selectedMultipleKADObjects[i].entityType;
    if (typeCounts[type] !== undefined) {
        typeCounts[type]++;
    }
}

// Step 4.0a) Only draw vertices if no type has more than 2 entities
var maxTypeCount = Math.max(typeCounts.line, typeCounts.poly, typeCounts.point, typeCounts.circle, typeCounts.text);
var skipVertices = maxTypeCount > 2;

// Step 4.0b) Use simplified rendering for very large selections
var SIMPLIFIED_DRAW_LIMIT = 500;
var MAX_RENDER_COUNT = 2000;
var useSimplifiedRendering = selectionCount > SIMPLIFIED_DRAW_LIMIT;
var renderCount = Math.min(selectionCount, MAX_RENDER_COUNT);
```

### Step 2: Add status message for large selections

Update status bar to inform users when vertices are hidden:

```javascript
if (skipVertices && typeof window.updateStatusMessage === "function") {
    window.updateStatusMessage("Vertices hidden for large selection (" + selectionCount + " entities)");
}
```

### Step 3: Performance guard at selection time

In [`src/three/PolygonSelection3D.js`](src/three/PolygonSelection3D.js) line 680, update the warning threshold to match:

```javascript
var LARGE_SELECTION_WARNING_THRESHOLD = 100;
if (selectedKAD.length > LARGE_SELECTION_WARNING_THRESHOLD) {
    // Count by type for more informative message
    var typeCounts = {};
    // ... count logic ...
    if (window.updateStatusMessage) {
        window.updateStatusMessage("Selected " + selectedKAD.length + " entities - vertices hidden for performance");
    }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| [`src/draw/canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js) | Replace count-based vertex limit with type-counting logic |
| [`src/three/PolygonSelection3D.js`](src/three/PolygonSelection3D.js) | Lower warning threshold, add type-counting to warning message |

## Expected Behavior After Fix

| Selection | Vertices Shown | Rendering Mode |
|-----------|----------------|----------------|
| 1 line + 1 poly | Yes | Full |
| 2 lines + 2 circles | Yes | Full |
| 3 lines | No | Full (outlines only) |
| 100 lines | No | Full (outlines only) |
| 600 lines | No | Simplified (bounding boxes) |
| 3000 lines | No | Simplified (capped at 2000) |

## Testing

1. Select 2 lines - verify vertices appear
2. Select 3 lines - verify vertices hidden, outlines shown
3. Select 500+ entities - verify bounding box mode, no freeze
4. Select 3000+ entities - verify status message, render cap applies
