# KAD Polygon Vertex Selection Fix
**Date:** 2024-12-19 16:20
**Status:** ✅ COMPLETED

## Problem

When clicking on KAD polygon/line vertices:
1. ❌ Vertex was not highlighted with pink circle/sphere
2. ❌ TreeView node was not updated to show the specific vertex
3. ⚠️ Only segments were being detected, not vertices
4. ⚠️ `selectedPoint` variable was never assigned

## Root Cause

The 3D click handling code (lines ~1690-1700) always set `selectionType = "segment"` for lines/polys, without checking if the click was closer to a vertex.

## Solution Implemented

### 1. Added Vertex Distance Checking (lines ~1693-1722)

**What Changed:**
- After finding closest segment, now also checks distance to each vertex
- If a vertex is closer than the segment AND within snap tolerance, uses vertex selection
- Mimics 2D behavior from `getClickedKADObject()` function

**Code Added:**
```javascript
// Step 12j.6.5h.1) For lines/polys, check if we're closer to a vertex than the segment
let closestVertexDistance = Infinity;
let closestVertexIndex = -1;
if (closestEntity.entityType === "line" || closestEntity.entityType === "poly") {
    // Check each vertex
    closestEntity.data.forEach(function (point, index) {
        const screenPos = worldToScreen(point.pointXLocation, point.pointYLocation, point.pointZLocation || dataCentroidZ || 0);
        const dx = screenPos.x - mouseScreenX;
        const dy = screenPos.y - mouseScreenY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < closestVertexDistance) {
            closestVertexDistance = distance;
            closestVertexIndex = index;
        }
    });
}

// Determine selection type based on distances
if (closestVertexDistance < closestDistance && closestVertexDistance <= snapTolerancePixels) {
    selectionType = "vertex";
    closestElementIndex = closestVertexIndex;
} else {
    selectionType = "segment";
}
```

### 2. Set `selectedPoint` When Vertex Selected (lines ~1798-1810)

**What Changed:**
- When single selection mode and `selectionType === "vertex"`, now sets `selectedPoint`
- Clears `selectedPoint` for segment/entity selections
- Clears `selectedPoint` in multi-selection mode

**Code Added:**
```javascript
// Step 12j.10a) Set selectedPoint if vertex was selected
if (clickedKADObject.selectionType === "vertex") {
    const entity = allKADDrawingsMap.get(clickedKADObject.entityName);
    if (entity && entity.data && entity.data[clickedKADObject.elementIndex]) {
        selectedPoint = entity.data[clickedKADObject.elementIndex];
        console.log("✅ [3D CLICK] Set selectedPoint:", selectedPoint.pointID);
    }
} else {
    selectedPoint = null;
}
```

### 3. Vertex Highlighting Already Implemented

✅ **2D Highlighting:** `src/draw/canvas2DDrawSelection.js` (lines ~508-534)
- Draws pink circle (8px radius) when `selectedPoint` is set

✅ **3D Highlighting:** `src/draw/canvas3DDrawSelection.js` (lines ~85-117)
- Draws pink sphere (5m radius) when `selectedPoint` is set

✅ **TreeView Sync:** `src/kirra.js` (`syncCanvasToTreeView()` function)
- Converts `selectedPoint` to TreeView node ID for highlighting

---

## Testing Results

### ✅ Expected Behavior

1. **Click on Segment:**
   - Green segment highlight appears
   - TreeView highlights entity node
   - No pink vertex highlight

2. **Click on Vertex:**
   - Pink circle/sphere appears on vertex
   - Green segments still visible
   - TreeView highlights specific vertex node: `Drawings > Type > EntityName > Point N`

3. **Click on Another Vertex:**
   - Pink highlight moves to new vertex
   - TreeView updates to show new vertex

4. **Click Empty Space:**
   - All highlights clear
   - TreeView selection clears

---

## Code Changes Summary

### Files Modified

1. **src/kirra.js** (~40 lines modified/added)
   - Lines ~1693-1722: Added vertex distance checking
   - Lines ~1788: Clear `selectedPoint` in multi-selection
   - Lines ~1798-1810: Set `selectedPoint` in single selection

### Total Changes: ~40 lines

---

## How It Works

### Selection Priority (matches 2D behavior):

1. **Segment Detection:** Check distance to all line segments
2. **Vertex Detection:** Check distance to all vertices
3. **Comparison:** If vertex is closer than segment → vertex selection
4. **Result:** Set appropriate `selectionType` and `elementIndex`

### Visual Feedback Chain:

```
User Clicks Near Vertex
         ↓
Vertex Distance Check (< segment distance?)
         ↓
Set selectionType = "vertex"
         ↓
Set selectedPoint = entity.data[vertexIndex]
         ↓
drawData() called
         ↓
Canvas selection drawing functions check selectedPoint
         ↓
Pink circle/sphere drawn at vertex location
         ↓
syncCanvasToTreeView() converts to node ID
         ↓
TreeView highlights vertex node
```

---

## Testing Instructions

### Test 1: Vertex Selection
1. Load a blast with KAD polygons
2. Click directly on a polygon vertex (corner point)
3. ✅ **Expected:** Pink circle appears, TreeView shows `Drawings > Polygons > EntityName > Point N`

### Test 2: Segment Selection
1. Click on the middle of a polygon edge (not near corners)
2. ✅ **Expected:** Green segment highlight, TreeView shows `Drawings > Polygons > EntityName` (entity level)

### Test 3: Vertex-to-Vertex
1. Click one vertex (pink appears)
2. Click another vertex on same polygon
3. ✅ **Expected:** Pink moves to new vertex, TreeView updates

### Test 4: 2D and 3D
1. Test in 2D mode - pink circle
2. Switch to 3D mode - pink sphere
3. ✅ **Expected:** Both work identically

---

## Known Behavior

- **Segment Priority:** If you click very close to a vertex but slightly closer to a segment, segment will be selected (by design, matches 2D)
- **Snap Tolerance:** Vertex must be within snap tolerance pixels to be selectable
- **Multi-Selection:** Vertex highlighting doesn't work in multi-selection mode (cleared for consistency)

---

**Status:** ✅ FULLY IMPLEMENTED AND READY TO TEST


