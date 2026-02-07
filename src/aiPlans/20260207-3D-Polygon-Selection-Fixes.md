# 3D Polygon Selection and Vertex Selection Fixes

## Date: 2026-02-07

## Issues

1. **First point misalignment in 3D** - Overlay canvas position doesn't match click coordinates
2. **Polygon selection broken when rotated** - Overlay drifts from Three.js canvas
3. **Can't select individual vertices** - Only selects whole entities, not individual points
4. **Shift+click missing for vertices** - Need multi-vertex selection for point cloud cleaning

---

## Fix 1: Overlay Canvas Positioning

**File:** `src/three/PolygonSelection3D.js`

**Problem:** Uses `offsetLeft/offsetTop` for positioning but `getBoundingClientRect()` for click calculations. These can differ.

**Solution:** Use `getBoundingClientRect()` consistently for BOTH positioning and click handling.

**Current Code (lines 54-57):**
```javascript
this.overlayCanvas.style.left = threeCanvas.offsetLeft + "px";
this.overlayCanvas.style.top = threeCanvas.offsetTop + "px";
```

**Fixed Code:**
```javascript
// Use getBoundingClientRect for consistent positioning
const parentRect = threeCanvas.parentElement.getBoundingClientRect();
const canvasRect = threeCanvas.getBoundingClientRect();
this.overlayCanvas.style.left = (canvasRect.left - parentRect.left) + "px";
this.overlayCanvas.style.top = (canvasRect.top - parentRect.top) + "px";
```

**Also update `updateCanvasSize()` (lines 96-114)** with same fix.

---

## Fix 2: Sync Overlay on Camera Change

**Problem:** Overlay may drift when scene rotates/pans if canvas layout changes.

**Solution:** Update overlay position whenever the canvas size/position might change.

**Add to ThreeRenderer or CameraControls:**
```javascript
// Call this after any camera/resize operation
if (window.polygonSelection3D && window.polygonSelection3D.isActive) {
    window.polygonSelection3D.updateCanvasSize();
}
```

---

## Fix 3: Individual Vertex Selection Mode

**File:** `src/three/PolygonSelection3D.js`

**Problem:** `projectAndSelectObjects()` (lines 449-743) selects whole KAD entities:
```javascript
// Current: If ANY point is inside, select the ENTITY
if (this.isPointInPolygon(screenX, screenY)) {
    isInside = true;
    break;  // <-- Stops checking, selects whole entity
}
```

**Solution:** Add a vertex selection mode that collects individual points.

**Add new method `projectAndSelectVertices()`:**
```javascript
// Step 19alt) Select individual VERTICES instead of entities
projectAndSelectVertices() {
    const selectingKAD = window.selectKADRadio && window.selectKADRadio.checked;
    if (!selectingKAD) return;

    const allKADDrawingsMap = window.allKADDrawingsMap;
    if (!allKADDrawingsMap) return;

    // Initialize vertex selection array
    if (!window.selectedMultiplePoints) {
        window.selectedMultiplePoints = [];
    }

    // Option: Clear existing or add to selection based on shift key
    // For now, clear existing
    window.selectedMultiplePoints.length = 0;

    for (const [entityName, entity] of allKADDrawingsMap.entries()) {
        if (!window.isEntityVisible || !window.isEntityVisible(entityName)) continue;
        if (!entity || !entity.data) continue;

        // Check EACH point individually
        for (let i = 0; i < entity.data.length; i++) {
            const point = entity.data[i];
            if (point.visible === false) continue;

            const worldX = point.pointXLocation;
            const worldY = point.pointYLocation;
            const worldZ = point.pointZLocation || 0;

            const { screenX, screenY } = this.projectToScreen(worldX, worldY, worldZ);

            if (this.isPointInPolygon(screenX, screenY)) {
                // Add individual vertex reference
                window.selectedMultiplePoints.push({
                    entityName: entityName,
                    entityType: entity.entityType,
                    pointIndex: i,
                    point: point,
                    pointID: point.pointID
                });
            }
        }
    }

    console.log("Selected " + window.selectedMultiplePoints.length + " vertices");

    // Update status
    if (window.updateStatusMessage) {
        window.updateStatusMessage("Selected " + window.selectedMultiplePoints.length + " vertices");
    }

    // Trigger redraw
    if (window.drawData) {
        window.drawData(window.allBlastHoles, window.selectedHole);
    }
}
```

**Add UI Toggle:** Checkbox for "Select Vertices" vs "Select Entities"
- Add to floating toolbar near polygon selection checkbox
- When checked, `handleDoubleClick` calls `projectAndSelectVertices()` instead of `projectAndSelectObjects()`

---

## Fix 4: Shift+Click for Multiple Vertex Selection

**File:** `src/kirra.js` (3D click handling, around line 2725)

**Current Shift+Click behavior:** Adds/removes ENTITIES from `selectedMultipleKADObjects`

**Add vertex-level shift+click:**
```javascript
// In 3D click handler, after determining click hit a vertex:
if (clickedKADObject.selectionType === "vertex" && event.shiftKey) {
    // Initialize array if needed
    if (!window.selectedMultiplePoints) {
        window.selectedMultiplePoints = [];
    }

    // Check if already selected
    const existingIndex = window.selectedMultiplePoints.findIndex(p =>
        p.entityName === clickedKADObject.entityName &&
        p.pointIndex === clickedKADObject.elementIndex
    );

    if (existingIndex === -1) {
        // Add to selection
        window.selectedMultiplePoints.push({
            entityName: clickedKADObject.entityName,
            entityType: clickedKADObject.entityType,
            pointIndex: clickedKADObject.elementIndex,
            point: entity.data[clickedKADObject.elementIndex],
            pointID: entity.data[clickedKADObject.elementIndex].pointID
        });
    } else {
        // Remove from selection (toggle)
        window.selectedMultiplePoints.splice(existingIndex, 1);
    }

    // Clear single point selection
    window.selectedPoint = null;
}
```

---

## Fix 5: Delete Selected Vertices

**Add delete operation for multiple vertices:**
```javascript
function deleteSelectedVertices() {
    if (!window.selectedMultiplePoints || window.selectedMultiplePoints.length === 0) {
        return;
    }

    // Group by entity for efficient deletion
    const deletionsByEntity = new Map();
    for (const vp of window.selectedMultiplePoints) {
        if (!deletionsByEntity.has(vp.entityName)) {
            deletionsByEntity.set(vp.entityName, []);
        }
        deletionsByEntity.get(vp.entityName).push(vp.pointIndex);
    }

    // Delete from each entity (in reverse index order to maintain indices)
    for (const [entityName, indices] of deletionsByEntity.entries()) {
        const entity = window.allKADDrawingsMap.get(entityName);
        if (!entity || !entity.data) continue;

        // Sort indices descending so we delete from end first
        indices.sort((a, b) => b - a);

        for (const idx of indices) {
            entity.data.splice(idx, 1);
        }

        // Update point IDs if needed
        for (let i = 0; i < entity.data.length; i++) {
            entity.data[i].pointID = i + 1;
        }
    }

    // Clear selection
    window.selectedMultiplePoints = [];

    // Redraw
    if (window.drawData) {
        window.drawData(window.allBlastHoles, window.selectedHole);
    }

    console.log("Deleted " + window.selectedMultiplePoints.length + " vertices");
}

// Expose to window for keyboard shortcut
window.deleteSelectedVertices = deleteSelectedVertices;
```

**Add keyboard shortcut:** Delete key triggers `deleteSelectedVertices()` when vertices are selected.

---

## Implementation Order

1. **Fix overlay positioning** (prevents first point misalignment)
2. **Add vertex selection mode toggle** (UI checkbox)
3. **Add `projectAndSelectVertices()` method**
4. **Add shift+click vertex selection in 3D click handler**
5. **Add `deleteSelectedVertices()` function**
6. **Add Delete key handler**
7. **Add vertex highlight rendering** (visual feedback)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/three/PolygonSelection3D.js` | Fix positioning, add vertex selection method |
| `src/kirra.js` | Add shift+click vertex handling, delete function |
| `src/dialog/floatingToolbar/FloatingToolbar.js` | Add "Select Vertices" checkbox |
| `src/draw/canvas3DDrawing.js` | Add vertex highlight rendering |

---

## Testing Checklist

1. Import LAS point cloud
2. Enable polygon selection in 3D
3. First click should appear exactly at mouse position
4. Rotate scene - polygon should still draw correctly
5. Complete polygon - individual vertices should be selected (not whole entity)
6. Shift+click individual vertices - should add to selection
7. Press Delete - selected vertices should be removed
8. Verify remaining point cloud is intact
