---
name: Hybrid Fat Lines Complete
overview: "Implement Fat Lines (LineMaterial/LineSegments2) for all line-based rendering: base KAD lines/polys/circles with hybrid thin/thick strategy, plus batched highlights for multi-selection performance. Points already handled."
todos:
  - id: fat-line-imports
    content: Add LineSegments2/LineSegmentsGeometry/LineMaterial imports to GeometryFactory.js
    status: pending
  - id: hybrid-lines-method
    content: Create createHybridSuperBatchedLines() method in GeometryFactory.js
    status: pending
    dependencies:
      - fat-line-imports
  - id: hybrid-circles-method
    content: Create createHybridSuperBatchedCircles() method in GeometryFactory.js
    status: pending
    dependencies:
      - fat-line-imports
  - id: update-kirra-lines
    content: Update kirra.js line 22837 to use hybrid lines method
    status: pending
    dependencies:
      - hybrid-lines-method
  - id: update-kirra-circles
    content: Update kirra.js line 22860 to use hybrid circles method
    status: pending
    dependencies:
      - hybrid-circles-method
  - id: batched-highlight-lines
    content: Create createBatchedHighlightLines() method in GeometryFactory.js
    status: pending
    dependencies:
      - fat-line-imports
  - id: batched-highlight-circles
    content: Create createBatchedHighlightCircles() method in GeometryFactory.js
    status: pending
    dependencies:
      - fat-line-imports
  - id: refactor-selection-highlight
    content: Refactor canvas3DDrawSelection.js to use batched highlights
    status: pending
    dependencies:
      - batched-highlight-lines
      - batched-highlight-circles
  - id: resize-handler
    content: Add window resize handler for LineMaterial resolution updates
    status: pending
    dependencies:
      - update-kirra-lines
---

# Hybrid Fat Lines - Complete Implementation

## Scope

| Entity | Base Rendering | Highlight Rendering |
|--------|---------------|---------------------|
| Lines/Polys | Hybrid: thin=LineBasic, thick=FatLines | Batched FatLines |
| Circles | Hybrid: thin=LineBasic, thick=FatLines | Batched FatLines |
| Points | Already working (THREE.Points) | Already working |

## Architecture

```mermaid
flowchart TD
    subgraph base [Base Rendering - kirra.js]
        A[All KAD Entities]
        B{lineWidth > 1?}
        C[Thin Batch - LineBasicMaterial]
        D[Thick Batches - LineMaterial per width]
    end
    
    subgraph highlights [Selection Highlights - canvas3DDrawSelection.js]
        E[Selected Entities]
        F[Batched Highlight Geometry]
        G[Single LineSegments2 per highlight type]
    end
    
    A --> B
    B -->|No| C
    B -->|Yes| D
    E --> F --> G
```

## Files to Modify

1. **[src/three/GeometryFactory.js](src/three/GeometryFactory.js)** - Add Fat Line imports and hybrid methods
2. **[src/kirra.js](src/kirra.js)** - Update super-batch calls for lines and circles
3. **[src/draw/canvas3DDrawSelection.js](src/draw/canvas3DDrawSelection.js)** - Batch highlight rendering

---

## Part 1: Fat Line Imports

Add to `GeometryFactory.js` (line ~5):

```javascript
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
```

---

## Part 2: Hybrid Lines/Polys Base Rendering

Create `createHybridSuperBatchedLines()` in `GeometryFactory.js` after line 614:

- Split entities: thin (lineWidth <= 1) vs thick (lineWidth > 1)
- Thin → existing `THREE.LineSegments` + `LineBasicMaterial`
- Thick → `LineSegments2` + `LineMaterial` grouped by width
- Return `{ thinLineSegments, fatLinesByWidth, entityRanges }`

Update `kirra.js` line 22837 to call new method and add all batches to scene.

---

## Part 3: Hybrid Circles Base Rendering

Create `createHybridSuperBatchedCircles()` in `GeometryFactory.js` after `createSuperBatchedCircles()` (line ~858):

- Same strategy: thin circles → `LineSegments`, thick circles → `LineSegments2`
- Circles typically all same lineWidth, so usually 1-2 draw calls total

Update `kirra.js` line 22860 to call new method.

---

## Part 4: Batched Highlight Rendering

Refactor `drawKADEntityHighlight()` in `canvas3DDrawSelection.js` to batch all highlights:

### Current (slow for multi-select):
```
For each selected entity:
  For each segment:
    Create MeshLine mesh  // Many draw calls!
```

### New (batched):
```
Collect all highlight segments:
  - Green segments (non-selected parts)
  - Magenta segments (selected parts)
  - Vertex points (already batched via Points)

Create ONE LineSegments2 for green highlights
Create ONE LineSegments2 for magenta highlights
```

Add new methods to `GeometryFactory.js`:
- `createBatchedHighlightLines(segments, color, lineWidth, resolution)`
- `createBatchedHighlightCircles(circles, color, lineWidth, resolution)`

---

## Part 5: Resolution Resize Handler

Add to `kirra.js` Three.js init section:

```javascript
window.addEventListener("resize", function() {
    var res = new THREE.Vector2(window.innerWidth, window.innerHeight);
    if (window.threeRenderer) {
        // Update all LineMaterial instances
        window.threeRenderer.scene.traverse(function(child) {
            if (child.material && child.material.isLineMaterial) {
                child.material.resolution.copy(res);
            }
        });
    }
});
```

---

## Performance Summary

| Scenario | Before (MeshLine) | After (Fat Lines) |
|----------|------------------|-------------------|
| 3000 thin lines | 1 draw call | 1 draw call |
| 3000 lines, 10 thick | 10 MeshLine calls | 2 draw calls |
| 500 selected entities | 500+ MeshLine calls | 2 draw calls |
