---
name: Kirra2D Bug Fixes Plan
overview: Address the grade/subdrill calculation bug, enable 3D hole creation tools, implement performance safeguards for large KAD selections, and protect against triangulation freezes.
todos:
  - id: fix-grade-calc
    content: Fix grade/subdrill calculation bug in addPattern() and addHole()
    status: completed
  - id: enable-3d-holes
    content: Enable hole creation tools in 3D mode handle3DClick()
    status: completed
    dependencies:
      - fix-grade-calc
  - id: kad-selection-limits
    content: Add selection limits and vertex draw optimization for large KAD selections
    status: completed
  - id: triangulation-safety
    content: Add point count warnings and chunked processing for triangulation
    status: completed
    dependencies:
      - kad-selection-limits
---

# Kirra2D Bug Fixes and Performance Optimization Plan

This plan addresses four major issues: (1) Grade/Subdrill calculation bug, (2) 3D hole creation tools not working, (3) Large KAD selection freezing the app, and (4) Triangulation freezing with large datasets.---

## Issue 1: Grade/Subdrill Elevation Bug (CRITICAL)

### Problem

When creating a pattern with Grade Elevation enabled:

- User input: CollarZ = 276.2, GradeZ = 270, Subdrill = 1.2
- Expected: GradeZ = 270, ToeZ = 268.8
- Actual: GradeZ = 268.8, ToeZ = 267.6

### Root Cause

Two bugs in the calculation chain:**Bug A** - In `addPattern()` at line 19087 of [`kirra.js`](src/kirra.js):

```19086:19087:src/kirra.js
let gradeZLocation = useGradeToCalcLength ? parseFloat(gradeZ) : parseFloat(startZLocation - (length - subdrill) * Math.cos(angle * (Math.PI / 180)));
let holeLength = useGradeToCalcLength ? parseFloat(startZLocation - (gradeZLocation - subdrill) * Math.cos(angle * (Math.PI / 180))) : parseFloat(length);
```

The formula `startZLocation - (gradeZLocation - subdrill)` calculates total length (collar to toe), but the variable is named `holeLength` which should be benchHeight (collar to grade).**Bug B** - In `addHole()` at line 19459 of [`kirra.js`](src/kirra.js):

```19456:19459:src/kirra.js
// Calculate grade locations using only hole length (no subdrill)
let gradeXLocation = parseFloat(startXLocation + holeLengthCalculated * ...);
let gradeYLocation = parseFloat(startYLocation + holeLengthCalculated * ...);
gradeZLocation = parseFloat(startZLocation - holeLengthCalculated * Math.cos(angle * (Math.PI / 180)));
```

This OVERWRITES the user-provided gradeZLocation with a value calculated from `holeLengthCalculated`, which is the total length, not benchHeight.

### Solution

1. Fix `addPattern()` line 19087 to calculate benchHeight correctly:
```javascript
// CORRECT: Calculate bench height (collar to grade) when using gradeZ
let holeLength = useGradeToCalcLength 
    ? parseFloat((startZLocation - gradeZLocation) / Math.cos(angle * (Math.PI / 180))) 
    : parseFloat(length);
```




2. Fix `addHole()` around line 19459 to NOT overwrite gradeZLocation when `useGradeZ` is true:
```javascript
// Only recalculate gradeZLocation if NOT using user-provided gradeZ
if (!useGradeZ) {
    gradeZLocation = parseFloat(startZLocation - holeLengthCalculated * Math.cos(angle * (Math.PI / 180)));
}
```


---

## Issue 2: 3D Hole Creation Tools Not Working

### Problem

The Add Hole and Add Pattern tools do not work in 3D mode.

### Root Cause

In `handle3DClick()` at line 1039 of [`kirra.js`](src/kirra.js):

```1039:1043:src/kirra.js
const isAnyDrawingToolActive = isDrawingPoint || isDrawingLine || isDrawingPoly || isDrawingCircle || isDrawingText;
if (isAnyDrawingToolActive) {
    console.log("⬇️ [3D CLICK] KAD drawing tool active, forwarding to drawing handler");
```

The check does NOT include `isAddingHole` or `isAddingPattern`, so these tools are ignored in 3D.

### Solution

Add hole/pattern tools to the 3D click handler:

1. Update line 1039 to include hole creation tools:
```javascript
const isAnyDrawingToolActive = isDrawingPoint || isDrawingLine || isDrawingPoly || isDrawingCircle || isDrawingText || isAddingHole || isAddingPattern;
```




2. Add hole/pattern-specific handlers inside the `if (isAnyDrawingToolActive)` block (after line 1133):
```javascript
} else if (isAddingHole) {
    console.log("⬇️ [3D CLICK] Adding Hole at:", worldX, worldY, worldZ);
    // Set world coordinates for AddHoleDialog
    window.worldX = worldX;
    window.worldY = worldY;
    window.worldZ = worldZ;
    // Show add hole dialog
    window.showAddHoleDialog();
} else if (isAddingPattern) {
    console.log("⬇️ [3D CLICK] Adding Pattern at:", worldX, worldY, worldZ);
    handlePatternAddingClick(event); // Reuse existing 2D handler with 3D coordinates
}
```


---

## Issue 3: Large KAD Selection Performance Freeze

### Problem

Selecting 3479+ KAD entities freezes the application. This affects both polygon selection and TreeView selection.

### Root Cause

Three performance bottlenecks:

1. **Vertex highlighting draws every vertex** - In [`canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js) lines 276-575, every vertex of every selected entity is drawn individually.
2. **No selection limit** - There's no cap on how many entities can be selected.
3. **Synchronous processing** - All selection highlighting happens synchronously without yielding to the event loop.

### Solution

**A. Implement selection limits with user warning:**

```javascript
// In polygon selection and TreeView selection handlers
const MAX_SELECTION_COUNT = 500;
if (selectedCount > MAX_SELECTION_COUNT) {
    window.showConfirmationDialog(
        "Large Selection Warning",
        "Selecting " + selectedCount + " entities may slow down the application. Continue?",
        "Yes, Continue",
        "Cancel"
    ).then((confirmed) => {
        if (confirmed) {
            // Proceed with selection
        }
    });
}
```

**B. Disable vertex highlighting for large multi-selections:**Update [`canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js) at line 276:

```javascript
// Step 4) Handle multiple selections - PERFORMANCE OPTIMIZATION
if (selectedMultipleKADObjects && selectedMultipleKADObjects.length > 0) {
    const VERTEX_DRAW_LIMIT = 50; // Only draw vertices for small selections
    const skipVertices = selectedMultipleKADObjects.length > VERTEX_DRAW_LIMIT;
    
    selectedMultipleKADObjects.forEach((kadObj, index) => {
        // Draw entity outline only (skip individual vertices for large selections)
        drawEntityOutline(kadObj, entity, skipVertices);
    });
}
```

**C. Add batched rendering for 3D** - Update [`canvas3DDrawSelection.js`](src/draw/canvas3DDrawSelection.js) with similar limits.---

## Issue 4: Triangulation Freezing with Large Datasets

### Problem

Creating triangulations from large KAD drawings (3479 entities) freezes the app.

### Root Cause

The triangulation at [`kirra.js`](src/kirra.js) line 11900 processes all points synchronously without:

1. Progress updates that yield to the event loop
2. Point count limits or warnings
3. Chunked processing

### Solution

**A. Add point count warning in [`KADDialogs.js`](src/dialog/popups/generic/KADDialogs.js):**

```javascript
// Before starting triangulation, count points
const pointCount = estimateTriangulationPoints(params);
const SAFE_POINT_LIMIT = 10000;

if (pointCount > SAFE_POINT_LIMIT) {
    const proceed = await window.showConfirmationDialog(
        "Large Dataset Warning",
        "This triangulation has approximately " + pointCount + " points. " +
        "Processing may take several minutes. Continue?",
        "Continue", "Cancel"
    );
    if (!proceed) return;
}
```

**B. Convert to chunked async processing in `createConstrainedDelaunayTriangulation()`:**

```javascript
// Process KAD vertices in chunks to prevent freeze
const CHUNK_SIZE = 1000;
for (let i = 0; i < visibleElements.visibleKADDrawings.length; i += CHUNK_SIZE) {
    const chunk = visibleElements.visibleKADDrawings.slice(i, i + CHUNK_SIZE);
    await processChunk(chunk, elementVertices, kadSourceMap);
    
    // Update progress and yield to event loop
    if (updateProgress) {
        updateProgress((i / total) * 50, "Processing entities: " + i + "/" + total);
    }
    await new Promise(resolve => setTimeout(resolve, 0)); // Yield to UI
}
```

**C. Add cancel button to progress dialog:**Update progress dialog in [`KADDialogs.js`](src/dialog/popups/generic/KADDialogs.js) line 247 to include a cancel button that sets a cancellation flag.---

## Modernization Plan Review

The attached plan [`20251220-1430-Kirra2D_Modernization_SaveExport_Plan.md`](src/aiPlans/20251220-1430-Kirra2D_Modernization_SaveExport_Plan.md) shows:

- Phase 1: COMPLETE (Delete buttons, TreeView fixes)
- Phase 2: IN PROGRESS (SWAL2 to FloatingDialog migration)
- Phase 3-5: PLANNED (Save/Export system redesign)

The reference files for export formats are ready:

- [`HoleToVulcanDXF-VBA.bas`](src/referenceFiles/HoleToVulcanDXF-VBA.bas) - Vulcan DXF with XData
- [`CBLASTExport.bas`](src/referenceFiles/CBLASTExport.bas) - CBLAST CSV format
- [`BRENTBUFFHAM_BlastToSurpac.lava`](src/referenceFiles/BRENTBUFFHAM_BlastToSurpac.lava) - Surpac STR format

---

## Files to Modify

| File | Changes |

|------|---------|

| [`src/kirra.js`](src/kirra.js) | Fix grade/subdrill calculation (lines 19087, 19459), add 3D hole creation (line 1039) |

| [`src/draw/canvas2DDrawSelection.js`](src/draw/canvas2DDrawSelection.js) | Add vertex draw limit for large selections |

| [`src/draw/canvas3DDrawSelection.js`](src/draw/canvas3DDrawSelection.js) | Add vertex draw limit for 3D |

| [`src/dialog/popups/generic/KADDialogs.js`](src/dialog/popups/generic/KADDialogs.js) | Add point count warning, cancel button |

| [`src/three/PolygonSelection3D.js`](src/three/PolygonSelection3D.js) | Add selection count warning |

| [`src/dialog/tree/TreeView.js`](src/dialog/tree/TreeView.js) | Add selection count warning |---

## Testing Checklist

- [ ] Create pattern with GradeZ=270, Subdrill=1.2 - verify GradeZ=270, ToeZ=268.8
- [ ] Test Add Hole tool in 3D mode
- [ ] Test Add Pattern tool in 3D mode
- [ ] Select 100+ KAD entities - verify no freeze, see warning if >500
- [ ] Select 3000+ KAD entities - verify warning and vertex simplification