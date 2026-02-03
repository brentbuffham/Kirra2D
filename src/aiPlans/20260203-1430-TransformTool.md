# Transform Tool Implementation Plan

**Date**: 2026-02-03
**Feature**: Transform Tool with Dialog and 3D Gizmo

## Overview

Implement a Transform Tool that allows users to translate and rotate selected blast holes and KAD entities. Features:
- **Dialog** with position (centroid) and rotation inputs
- **3D Gizmo** with translation arrows (X/Y/Z) and rotation arcs (Bearing/Pitch/Roll)
- **Live Preview** with non-destructive editing until Apply
- **Multi-selection** support for holes + KAD entities

---

## File Structure

```
src/
  tools/
    TransformTool.js           # Main tool (state, dialog, handlers) - NEW
  three/
    TransformGizmo.js          # 3D gizmo (arrows, arcs, interaction) - NEW
  helpers/
    TransformMath.js           # Rotation/translation utilities - NEW
```

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `src/kirra.js` | Import TransformTool, wire button handler, add to handle3DClick |
| `kirra.html` | Button already exists: `id="transformTool"` at line 2815 |

---

## Implementation Steps

### Phase 1: TransformMath.js (Math Utilities)

Create `/src/helpers/TransformMath.js`:
- `rotatePointAroundPivot(point, pivot, bearingRad, pitchRad, rollRad)` - Euler YXZ rotation
- `applyTransform(point, pivot, translation, rotation)` - Combined transform
- `recalculateHoleGeometry(hole)` - Update bearing/angle/length after transform

### Phase 2: TransformTool.js (Core Module)

Create `/src/tools/TransformTool.js`:

**State Variables:**
```javascript
let isTransformToolActive = false;
let originalHolePositions = new Map();    // Store originals for Cancel
let originalKADPositions = new Map();
let transformTranslation = { x: 0, y: 0, z: 0 };
let transformRotation = { bearing: 0, pitch: 0, roll: 0 };
let selectionCentroid = { x: 0, y: 0, z: 0 };
let previewEnabled = true;
```

**Functions:**
- `startTransformMode()` - Check selection, compute centroid, store originals, show dialog, create gizmo
- `showTransformDialog()` - FloatingDialog with position/rotation inputs
- `computeSelectionCentroid()` - Calculate from selectedHole, selectedKADObject, multi-selections
- `storeOriginalPositions()` - Save hole/KAD positions for Cancel restore
- `applyPreviewTransform()` - Apply transform to selected entities (non-destructive)
- `restoreOriginalPositions()` - Revert to original state (Cancel)
- `applyTransformPermanent()` - Commit changes, save to IndexedDB (Apply)
- `cancelTransformMode()` - Restore originals, cleanup gizmo, close dialog
- `updateDialogFromGizmo()` - Sync dialog inputs when gizmo is dragged
- `updateGizmoFromDialog()` - Sync gizmo when dialog inputs change

**Dialog Layout:**
```
+------------------------------------------+
|  Transform                            [X] |
+------------------------------------------+
| X Position: [______] Bearing: [______]   |
| Y Position: [______] Pitch:   [______]   |
| Z Position: [______] Roll:    [______]   |
|                                          |
| [x] Preview Transform                    |
+------------------------------------------+
|                    [CANCEL] [APPLY]      |
+------------------------------------------+
```

### Phase 3: TransformGizmo.js (3D Visualization)

Create `/src/three/TransformGizmo.js`:

**Components:**
- Translation arrows: Red (X), Green (Y), Blue (Z) using cone + cylinder
- Rotation arcs: Semi-transparent circular arcs for Bearing (Z), Pitch (X), Roll (Y)
- Screen-space scaling (like axis helper) to maintain fixed pixel size

**Key Methods:**
- `constructor(threeRenderer)` - Create gizmo group, add to scene
- `createArrow(color, direction, length)` - Cylinder shaft + cone head
- `createRotationArc(color, axis, radius)` - EllipseCurve-based arc
- `updatePosition(x, y, z)` - Move gizmo to centroid (worldToThreeLocal)
- `updateRotation(bearing, pitch, roll)` - Rotate gizmo to show current transform
- `updateScale(scale)` - Screen-space scaling for fixed visual size
- `raycastGizmo(mouseNDC)` - Detect which handle was clicked
- `setVisible(visible)` - Show/hide gizmo
- `dispose()` - Remove from scene, cleanup geometry/materials

### Phase 4: Gizmo Interaction

Add to TransformTool.js:
- `handleTransformGizmoMouseDown(event)` - Detect gizmo handle click, start drag
- `handleTransformGizmoMouseMove(event)` - Update translation/rotation based on drag delta
- `handleTransformGizmoMouseUp(event)` - End drag

**Drag Behavior:**
- Arrow drag → translate along single axis (project screen delta to world axis)
- Arc drag → rotate around axis (horizontal mouse movement = rotation)

### Phase 5: Integration

**Wire button in kirra.js:**
```javascript
import { startTransformMode, cancelTransformMode, handleTransformGizmoInteraction } from "./tools/TransformTool.js";

// Button handler
const transformToolBtn = document.getElementById("transformTool");
if (transformToolBtn) {
  transformToolBtn.addEventListener("change", function() {
    if (this.checked) {
      startTransformMode();
    } else {
      cancelTransformMode();
    }
  });
}
```

**Add to handle3DClick (kirra.js):**
```javascript
// Check transform gizmo first
if (window.isTransformToolActive && window.handleTransformGizmoInteraction) {
  if (window.handleTransformGizmoInteraction(event)) {
    return; // Gizmo handled the click
  }
}
```

**Add escape handler:**
```javascript
if (event.key === "Escape" && window.isTransformToolActive) {
  cancelTransformMode();
  document.getElementById("transformTool").checked = false;
  event.preventDefault();
}
```

---

## Data Flow

```
User Interaction:

 [Dialog Input Change]──────┐
                            │ sync
 [Gizmo Drag]───────────────┼─────→ transformTranslation/Rotation
                            │
                            ▼
              ┌─────────────────────────┐
              │  applyPreviewTransform  │
              │  (if preview enabled)   │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  Update hole/KAD        │
              │  positions in memory    │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  drawData() + gizmo     │
              │  position update        │
              └─────────────────────────┘
```

---

## Key Patterns to Follow

**From RenumberHolesTool.js:**
- Module-level state variables
- `start*Mode()` → dialog → `activate*ClickMode()` pattern
- Deactivate other tools before activating
- Export to window for global access
- 3D clicks handled via handle3DClick in kirra.js

**From FloatingDialog.js:**
- Use `createEnhancedFormContent(fields)` for forms
- Use `getFormData(formContent)` to extract values
- Add `input` event listeners for live preview

**From ThreeRenderer.js (axis helper):**
- Screen-space scaling: `scaleFactor = desiredPixels / scale / baseSize`
- Add gizmo to scene directly (not to a group)

---

## Centroid Calculation

```javascript
function computeSelectionCentroid() {
  let sumX = 0, sumY = 0, sumZ = 0, count = 0;

  // Single selected hole
  if (window.selectedHole) {
    sumX += window.selectedHole.startXLocation;
    sumY += window.selectedHole.startYLocation;
    sumZ += window.selectedHole.startZLocation;
    count++;
  }

  // Multi-selected holes (if implemented)
  // Multi-selected KAD objects
  (window.selectedMultipleKADObjects || []).forEach(kadObj => {
    // Get entity points and sum
  });

  return count > 0 ? { x: sumX/count, y: sumY/count, z: sumZ/count } : null;
}
```

---

## Transform Application

For blast holes, transform ALL three points:
- Collar: (startXLocation, startYLocation, startZLocation)
- Toe: (endXLocation, endYLocation, endZLocation)
- Grade: (gradeXLocation, gradeYLocation, gradeZLocation)

Then recalculate:
- `holeBearing` from new collar→toe vector
- `holeAngle` from vertical
- `holeLengthCalculated` from collar→toe distance

For KAD entities, transform each point in `entity.data[]`:
- (pointXLocation, pointYLocation, pointZLocation)

---

## Undo/Redo, Save, and TreeView

**On Apply (commit transform):**

```javascript
function applyTransformPermanent() {
  // 1. Register undo action BEFORE committing
  if (window.undoManager) {
    window.undoManager.storeAction({
      actionType: "transform",
      targetEntities: getSelectedEntityIds(),
      beforeState: {
        holes: originalHolePositions,
        kads: originalKADPositions
      },
      afterState: {
        holes: getCurrentHolePositions(),
        kads: getCurrentKADPositions()
      },
      undo: function() {
        restorePositions(this.beforeState);
        window.threeDataNeedsRebuild = true;
        window.drawData(window.allBlastHoles, window.selectedHole);
      },
      redo: function() {
        restorePositions(this.afterState);
        window.threeDataNeedsRebuild = true;
        window.drawData(window.allBlastHoles, window.selectedHole);
      }
    });
  }

  // 2. Save to IndexedDB (debounced)
  if (window.debouncedSaveHoles) {
    window.debouncedSaveHoles();
  }
  if (window.saveKADDrawingsToDB) {
    window.saveKADDrawingsToDB();
  }

  // 3. Update tree view
  if (window.debouncedUpdateTreeView) {
    window.debouncedUpdateTreeView();
  }

  // 4. Force 3D rebuild and redraw
  window.threeDataNeedsRebuild = true;
  window.drawData(window.allBlastHoles, window.selectedHole);

  // 5. Cleanup
  cleanupTransformMode();
}
```

**State Capture for Undo:**

```javascript
function storeOriginalPositions() {
  originalHolePositions.clear();
  originalKADPositions.clear();

  // Capture hole positions
  if (window.selectedHole) {
    const h = window.selectedHole;
    originalHolePositions.set(h.entityName + ":::" + h.holeID, {
      startX: h.startXLocation, startY: h.startYLocation, startZ: h.startZLocation,
      endX: h.endXLocation, endY: h.endYLocation, endZ: h.endZLocation,
      gradeX: h.gradeXLocation, gradeY: h.gradeYLocation, gradeZ: h.gradeZLocation,
      holeBearing: h.holeBearing, holeAngle: h.holeAngle
    });
  }

  // Capture KAD positions
  (window.selectedMultipleKADObjects || []).forEach(kadObj => {
    const entity = window.allKADDrawingsMap.get(kadObj.entityName);
    if (entity && entity.data) {
      entity.data.forEach((pt, idx) => {
        originalKADPositions.set(kadObj.entityName + ":::" + pt.pointID, {
          x: pt.pointXLocation, y: pt.pointYLocation, z: pt.pointZLocation
        });
      });
    }
  });
}
```

---

## Verification

1. **Basic Test**: Select a hole, activate transform, drag X arrow → hole moves along X
2. **Rotation Test**: Enter 90° bearing → hole rotates 90° clockwise around centroid
3. **Preview Toggle**: Uncheck preview → changes don't appear until Apply
4. **Cancel Test**: Make changes, click Cancel → hole returns to original position
5. **Multi-Selection**: Select multiple KAD points, transform → all move together
6. **2D/3D Sync**: Changes in 3D gizmo appear in 2D canvas and vice versa

---

## Edge Cases

- **No selection**: Show warning, don't activate
- **Single point**: Rotation does nothing (pivot = point)
- **Mixed holes + KAD**: Combined centroid, uniform transform
- **Escape key**: Same as Cancel
- **Selection changes**: Recompute centroid, preserve transform deltas
