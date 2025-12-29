---
name: Fat Lines Text and Dialog Fix
overview: Implement Fat Lines for line rendering, add fontHeight to text entities, and fix KAD property dialog to only apply explicitly changed values (preventing unwanted Z flattening when clicking "All").
todos:
  - id: dialog-initial-values
    content: Store initial form values when KAD property dialog opens
    status: completed
  - id: dialog-dirty-tracking
    content: Build newProperties with only changed fields on All click
    status: completed
    dependencies:
      - dialog-initial-values
  - id: text-entity-structure
    content: Add fontHeight attribute to text entity data structure
    status: completed
  - id: text-drawing
    content: Update 2D and 3D text drawing to use fontHeight
    status: completed
    dependencies:
      - text-entity-structure
  - id: text-property-editor
    content: Add fontHeight field to property editor for text entities
    status: completed
    dependencies:
      - text-entity-structure
  - id: text-export-import
    content: Update KAD CSV export/import with fontHeight (backward compatible)
    status: completed
    dependencies:
      - text-entity-structure
  - id: fat-line-imports
    content: Add LineSegments2/LineMaterial imports to GeometryFactory.js
    status: completed
  - id: hybrid-lines-method
    content: Create createHybridSuperBatchedLines() in GeometryFactory.js
    status: completed
    dependencies:
      - fat-line-imports
  - id: hybrid-circles-method
    content: Create createHybridSuperBatchedCircles() in GeometryFactory.js
    status: completed
    dependencies:
      - fat-line-imports
  - id: update-kirra-batches
    content: Update kirra.js to use hybrid batch methods
    status: completed
    dependencies:
      - hybrid-lines-method
      - hybrid-circles-method
  - id: batched-highlights
    content: Create batched highlight methods and refactor selection drawing
    status: completed
    dependencies:
      - fat-line-imports
  - id: resize-handler
    content: Add window resize handler for LineMaterial resolution
    status: completed
    dependencies:
      - update-kirra-batches
---

# Fat Lines, Text FontHeight, and Dialog Fix

## Scope Summary

| Feature | Description |

|---------|-------------|

| Lines/Polys/Circles Base | Hybrid: thin=LineBasic, thick=FatLines |

| Selection Highlights | Batched FatLines for performance |

| Text KAD | New `fontHeight` attribute (default 12) |

| KAD Dialog Fix | Only apply explicitly changed values on "All" |---

## Part A: Fat Lines Implementation

### Files

- [src/three/GeometryFactory.js](src/three/GeometryFactory.js)
- [src/kirra.js](src/kirra.js) (~lines 22837, 22860)
- [src/draw/canvas3DDrawSelection.js](src/draw/canvas3DDrawSelection.js)

### A1. Add Fat Line Imports

```javascript
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
```



### A2. Hybrid Methods

- `createHybridSuperBatchedLines()` - thin vs thick split
- `createHybridSuperBatchedCircles()` - same pattern

### A3. Batched Highlights

- `createBatchedHighlightLines()` for multi-select performance
- `createBatchedHighlightCircles()`

### A4. Resolution Resize Handler

---

## Part B: Text FontHeight Feature

### Files

- [src/kirra.js](src/kirra.js) - entity creation, drawing, export/import
- [src/dialog/contextMenu/KADContextMenu.js](src/dialog/contextMenu/KADContextMenu.js)

### B1. Add `fontHeight` to text entity data (default 12)

### B2. Update drawing to use `textData.fontHeight || 12`

### B3. Add fontHeight field to property editor

### B4. Update KAD CSV export/import (backward compatible)

---

## Part C: KAD Dialog "All" Fix (Explicit Changes Only)

### Problem

When editing a KAD object and clicking "All":

- User changes only color and lineWidth
- Dialog sends ALL values including unchanged Z elevation
- All points get flattened to the displayed Z value

### Solution: Dirty Field Tracking

Track which fields were **explicitly modified** by the user.

### Files

- [src/dialog/contextMenu/KADContextMenu.js](src/dialog/contextMenu/KADContextMenu.js)

### C1. Store Initial Values When Dialog Opens

```javascript
// Step 4b) Store initial values for dirty tracking
const initialValues = {
    editKADColor: kadObject.color || "#FF0000",
    editXLocation: String(kadObject.pointXLocation || 0),
    editYLocation: String(kadObject.pointYLocation || 0),
    editZLocation: String(kadObject.pointZLocation || 0),
    editLineWidth: String(kadObject.lineWidth || 1),
    editRadius: String(kadObject.radius || 1),
    editText: kadObject.text || "",
    editFontHeight: String(kadObject.fontHeight || 12)
};
```



### C2. Build Properties Object with Only Changed Fields

In `onConfirm` (All button) - replace current code:

```javascript
onConfirm: () => {
    const formData = window.getFormData(formContent);
    
    // Step 5a.1) Build properties object with ONLY changed fields
    const newProperties = {};
    
    // Only include if value changed from initial
    if (formData.editKADColor !== initialValues.editKADColor) {
        newProperties.color = formData.editKADColor;
    }
    if (formData.editLineWidth !== initialValues.editLineWidth) {
        newProperties.lineWidth = formData.editLineWidth;
    }
    if (formData.editXLocation !== initialValues.editXLocation) {
        newProperties.pointXLocation = parseFloat(formData.editXLocation);
    }
    if (formData.editYLocation !== initialValues.editYLocation) {
        newProperties.pointYLocation = parseFloat(formData.editYLocation);
    }
    if (formData.editZLocation !== initialValues.editZLocation) {
        newProperties.pointZLocation = parseFloat(formData.editZLocation);
    }
    if (formData.editRadius !== initialValues.editRadius) {
        newProperties.radius = formData.editRadius;
    }
    if (formData.editText !== initialValues.editText) {
        newProperties.text = formData.editText;
    }
    if (formData.editFontHeight !== initialValues.editFontHeight) {
        newProperties.fontHeight = formData.editFontHeight;
    }
    
    // Always include onlyZ flag (behavior flag, not data)
    newProperties.onlyZ = formData.onlyZCheckbox;
    
    // Handle line/poly conversion (explicit action)
    if (isLineOrPoly && formData.editType !== kadObject.entityType) {
        convertLinePolyType(kadObject, formData.editType);
    }
    
    // Only update if something changed
    if (Object.keys(newProperties).length > 1) { // More than just onlyZ
        updateKADObjectProperties(kadObject, newProperties, "all");
    }
    
    window.debouncedSaveKAD();
    window.clearAllSelectionState();
    window.drawData(window.allBlastHoles, window.selectedHole);
}
```



### C3. Keep "This" Button Behavior

For single element edits, keep applying all values (user is intentionally editing that specific point).

### Expected Behavior After Fix

| User Action | Result |

|-------------|--------|

| Change color only, click All | Only color changes on all points |

| Change lineWidth only, click All | Only lineWidth changes on all points |

| Change Z, click All | Z offset applied to all points |

| Change color + lineWidth, click All | Both change, Z unchanged |

| Any change, click This | All form values apply to single point |---

## Implementation Order

1. **Part C first** (Dialog fix) - standalone bug fix
2. **Part B** (Text fontHeight) - simple addition