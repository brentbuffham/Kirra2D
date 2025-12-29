---
name: Fat Lines and Text FontHeight
overview: Implement Fat Lines (LineMaterial/LineSegments2) for all line-based rendering with hybrid thin/thick strategy, plus add fontHeight attribute to text KAD entities with backward compatibility. Points already handled, hole text unchanged.
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
    content: Update kirra.js line ~22837 to use hybrid lines method
    status: pending
    dependencies:
      - hybrid-lines-method
  - id: update-kirra-circles
    content: Update kirra.js line ~22860 to use hybrid circles method
    status: pending
    dependencies:
      - hybrid-circles-method
  - id: batched-highlight-methods
    content: Create batched highlight line/circle methods in GeometryFactory.js
    status: pending
    dependencies:
      - fat-line-imports
  - id: refactor-selection-highlight
    content: Refactor canvas3DDrawSelection.js to use batched highlights
    status: pending
    dependencies:
      - batched-highlight-methods
  - id: resize-handler
    content: Add window resize handler for LineMaterial resolution updates
    status: pending
    dependencies:
      - update-kirra-lines
  - id: text-entity-structure
    content: Add fontHeight to text entity data structure in kirra.js
    status: pending
  - id: text-drawing-2d3d
    content: Update 2D and 3D text drawing to use fontHeight
    status: pending
    dependencies:
      - text-entity-structure
  - id: text-property-editor
    content: Add fontHeight field to KADContextMenu.js property editor
    status: pending
    dependencies:
      - text-entity-structure
  - id: text-export-import
    content: Update KAD CSV export/import with fontHeight (backward compatible)
    status: pending
    dependencies:
      - text-entity-structure
---

#Fat Lines and Text FontHeight Implementation

## Scope Summary

| Feature | Description ||---------|-------------|| Lines/Polys Base | Hybrid: thin=LineBasic, thick=FatLines || Circles Base | Hybrid: thin=LineBasic, thick=FatLines || Selection Highlights | Batched FatLines for performance || Text KAD | New `fontHeight` attribute (default 12) || Points | Already working || Hole Text | Unchanged |---

## Part A: Fat Lines Implementation

### Files to Modify

- [src/three/GeometryFactory.js](src/three/GeometryFactory.js)
- [src/kirra.js](src/kirra.js) (lines ~22837, ~22860)
- [src/draw/canvas3DDrawSelection.js](src/draw/canvas3DDrawSelection.js)

### A1. Add Fat Line Imports (GeometryFactory.js line ~5)

```javascript
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
```



### A2. Hybrid Lines/Polys Method

Create `createHybridSuperBatchedLines()` - splits entities by lineWidth:

- lineWidth <= 1 → `LineSegments` + `LineBasicMaterial` (fast)
- lineWidth > 1 → `LineSegments2` + `LineMaterial` (fat, grouped by width)

### A3. Hybrid Circles Method

Create `createHybridSuperBatchedCircles()` - same strategy for circles.

### A4. Batched Highlight Methods

Create batched highlight methods for multi-selection performance:

- `createBatchedHighlightLines(segments, color, lineWidth, resolution)`
- `createBatchedHighlightCircles(circles, color, lineWidth, resolution)`

Refactor `drawKADEntityHighlight()` in canvas3DDrawSelection.js to collect all segments first, then create 1-2 batched LineSegments2 objects.

### A5. Resolution Resize Handler

Add window resize listener to update all `LineMaterial.resolution` values.---

## Part B: Text FontHeight Feature

### Files to Modify

- [src/kirra.js](src/kirra.js) - text entity creation, drawing, export/import
- [src/dialog/contextMenu/KADContextMenu.js](src/dialog/contextMenu/KADContextMenu.js) - property editor
- [src/draw/canvas2DDrawing.js](src/draw/canvas2DDrawing.js) - 2D text drawing
- [src/draw/canvas3DDrawing.js](src/draw/canvas3DDrawing.js) - 3D text drawing

### B1. Text Entity Data Structure

Add `fontHeight` attribute:

```javascript
{
    entityName: nameT,
    entityType: "text",
    pointID: 1,
    pointXLocation: x,
    pointYLocation: y,
    pointZLocation: z,
    text: "some text",
    color: "#FF0000",
    fontHeight: 12  // NEW - default 12 if not provided
}
```



### B2. Text Creation (kirra.js)

When creating text entities (DXF import, CSV import, manual creation):

- Add `fontHeight: fontHeight || 12` to data object

### B3. Text Drawing

Update drawing functions to use `textData.fontHeight || 12`:**2D (canvas2DDrawing.js):**

```javascript
ctx.font = (textData.fontHeight || 12) + "px Arial";
```

**3D (canvas3DDrawing.js / GeometryFactory.js):**

```javascript
const fontSize = textData.fontHeight || 12;
```



### B4. Property Editor (KADContextMenu.js)

Add fontHeight field for text entities (around line 135):

```javascript
} else if (kadObject.entityType === "text") {
    fields.push({
        label: "Text",
        name: "editText",
        type: "text",
        value: kadObject.text || ""
    });
    fields.push({
        label: "Font Height",
        name: "editFontHeight",
        type: "number",
        value: kadObject.fontHeight || 12,
        min: "1",
        max: "200",
        step: "1"
    });
}
```



### B5. KAD Export

Include `fontHeight` in CSV export for text entities.

### B6. KAD Import (Backward Compatible)

When loading KAD without `fontHeight`:

```javascript
fontHeight: parseFloat(row[X]) || 12  // Default to 12 if missing
```

---

## Performance Summary