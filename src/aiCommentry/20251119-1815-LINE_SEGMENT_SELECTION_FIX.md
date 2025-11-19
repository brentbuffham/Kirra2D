# Line Segment Selection & Highlighting Fix
**Date**: 2025-11-19 18:15
**Status**: ✅ COMPLETE

## Overview
Fixed two critical issues with 3D KAD line/polygon selection:
1. **Lines not selectable in 3D** - Screen-space selection wasn't tracking segment index
2. **Segment highlights missing** - 3D highlighting wasn't showing selected segment in magenta or marking the owning vertex

## Problem Statement

### Issue 1: Lines Not Selecting
- **Symptom**: Clicking lines in 3D had no effect
- **Root cause**: 3D selection was hardcoding `selectionType: "entity"` instead of `"segment"`
- **Impact**: Lines completely unselectable in 3D, polys working inconsistently

### Issue 2: Missing Segment Highlights
- **2D behavior** (correct):
  - All segments shown in green
  - Clicked segment shown in magenta (thicker)
  - Vertex owning segment shown in magenta sphere
- **3D behavior** (broken):
  - All segments shown in green
  - NO magenta segment highlight
  - NO magenta vertex sphere
- **Impact**: No visual feedback about which segment was selected

## Root Cause Analysis

### Incorrect Selection Type
In `kirra.js` line 1238 (old code):
```javascript
clickedKADObject = {
    entityName: closestEntity.entityName,
    entityType: closestEntity.entityType,
    elementIndex: closestElementIndex,
    selectionType: "entity" // ❌ WRONG - should be "segment" for lines/polys
};
```

### Missing Segment Tracking
Lines/polys need:
- `segmentIndex`: Which segment (0, 1, 2, ...) was clicked
- `selectionType: "segment"`: Indicates segment vs vertex selection

The 2D code (lines 24788-24789) correctly sets these:
```javascript
segmentIndex: i, // This is the specific segment clicked
selectionType: "segment",
```

But 3D code was missing this logic entirely.

### Line Highlighting Logic Incomplete
The 3D line case (canvas3DDrawSelection.js lines 107-139) had segment checking but:
- Logic was in forEach loop using point index, not segment index
- Didn't overdraw selected segment (like 2D and poly cases do)
- Didn't highlight owning vertex in magenta

## Solution Implementation

### Fix 1: Track Segment Index in Selection (kirra.js lines 1152-1191)

**Changes to screen-space distance calculation for lines/polys**:

```javascript
// Step 12j.6.5g.2a) Store segment info for proper highlighting
let closestSegmentIndex = 0;
let closestSegmentDistance = Infinity;

for (let i = 0; i < numSegments; i++) {
    // ...calculate distance to segment...
    if (segmentDist < closestSegmentDistance) {
        closestSegmentDistance = segmentDist;
        closestSegmentIndex = i; // Track which segment
    }
}

// Step 12j.6.5g.2b) If closest segment is within tolerance, update closestEntity
if (closestSegmentDistance < closestDistance) {
    closestDistance = closestSegmentDistance;
    closestEntity = entity;
    closestElementIndex = closestSegmentIndex; // Which segment was clicked
}
```

### Fix 2: Set Proper Selection Type (kirra.js lines 1233-1248)

**Determine selection type based on entity type**:

```javascript
// Step 12j.6.5i) Determine selection type (match 2D behavior)
let selectionType = "entity";
if (closestEntity.entityType === "line" || closestEntity.entityType === "poly") {
    selectionType = "segment"; // Lines/polys use segment selection
} else if (closestEntity.entityType === "point") {
    selectionType = "point";
}

// Step 12j.6.5j) Create KAD object descriptor (match 2D structure)
clickedKADObject = {
    entityName: closestEntity.entityName,
    entityType: closestEntity.entityType,
    elementIndex: closestElementIndex,
    segmentIndex: closestElementIndex, // For lines/polys, this is the clicked segment
    selectionType: selectionType
};
```

### Fix 3: Refactor Line Highlighting (canvas3DDrawSelection.js lines 107-169)

**Rewrote line case to match poly pattern**:

```javascript
case "line":
    // Step 4c.1) Draw ALL segments first with standard green highlighting
    for (let i = 0; i < numLineSegments; i++) {
        const point1 = linePoints[i];
        const point2 = linePoints[i + 1];
        // ...project to local coords...
        
        // Draw green segment (non-selected)
        const lineMesh = GeometryFactory.createKADLineHighlight(..., 2 * 15, nonSelectedSegmentColor);
        highlightGroup.add(lineMesh);
    }
    
    // Step 4c.2) Then overdraw ONLY the selected segment in magenta
    if (kadObject.selectionType === "segment" && kadObject.segmentIndex !== undefined) {
        const segmentIndex = kadObject.segmentIndex;
        if (segmentIndex >= 0 && segmentIndex < numLineSegments) {
            const point1 = linePoints[segmentIndex];
            const point2 = linePoints[segmentIndex + 1];
            // ...project to local coords...
            
            // Overdraw with thicker magenta segment
            const selectedLineMesh = GeometryFactory.createKADLineHighlight(..., 5 * 15, selectedSegmentColor);
            highlightGroup.add(selectedLineMesh);
        }
    }
```

### Fix 4: Highlight Owning Vertex (canvas3DDrawSelection.js lines 151-169)

**Added magenta sphere for segment's start vertex**:

```javascript
// Step 4c.3) Draw vertices for all points
linePoints.forEach((point, index) => {
    // ...get local coords...
    
    // Step 4c.3a) If this is the start vertex of the selected segment, draw it in magenta
    const isSelectedSegmentVertex = kadObject.selectionType === "segment" && kadObject.segmentIndex === index;
    
    if (isSelectedSegmentVertex) {
        // Larger magenta sphere for selected segment's start vertex
        const selectedVertex = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 1.0, selectedSegmentColor);
        highlightGroup.add(selectedVertex);
    } else {
        // Standard red vertex marker
        const vertex = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 0.5, verticesColor);
        highlightGroup.add(vertex);
    }
});
```

### Fix 5: Apply Same Logic to Polygons (canvas3DDrawSelection.js lines 196-214)

**Updated poly vertex highlighting to match lines**:

Same pattern as lines - check if vertex is start of selected segment, draw magenta if yes, red otherwise.

## Technical Details

### Segment Indexing
- **Segment 0**: Between points 0 and 1
- **Segment 1**: Between points 1 and 2
- **Segment i**: Between points i and i+1
- **Polygons**: Segment i wraps around (last segment connects last point to first)

### Highlighting Order
1. Draw all segments in green (lineWidth: 2 * 15)
2. Overdraw selected segment in magenta (lineWidth: 5 * 15)
3. Draw all vertices in red (radius: 0.5)
4. Overdraw selected segment's start vertex in magenta (radius: 1.0)

### Color Codes
- **Green** (`#00FF00`): Non-selected segments/points
- **Magenta** (`rgba(255, 68, 255, 0.8)`): Selected segment/vertex
- **Red** (`rgba(255, 0, 0, 0.5)`): All vertices/markers

## Console Logging

### Selection
- "🔍 [3D LINE SELECT] Checking [type] '[name]' with [N] segments"
- "  Segment [i]: p1=(X,Y) p2=(X,Y) dist=Npx"
- "✅ [3D CLICK] Found entity by screen distance: [name] type: [type] distance: Npx"

### Highlighting
- "🎨 [3D HIGHLIGHT] Drawing selected segment [i] in magenta" (developer mode only)

## Expected Behavior

### Before Fix
- **2D Mode**: ✅ Lines selectable, segment highlights visible
- **3D Plan View**: ❌ Lines not selectable
- **3D Orbited**: ❌ Lines not selectable
- **3D Highlights**: ❌ No magenta segment, no magenta vertex

### After Fix
- **2D Mode**: ✅ Unchanged (still working)
- **3D Plan View**: ✅ Lines selectable with screen-space distance
- **3D Orbited**: ✅ Lines selectable at any angle
- **3D Highlights**: ✅ Magenta segment + magenta vertex (matches 2D)

## Testing Checklist
✅ Lines selectable in 3D plan view
✅ Lines selectable in 3D orbited view
✅ Polys selectable in 3D plan view
✅ Polys selectable in 3D orbited view
✅ Selected segment shows magenta in 3D
✅ Other segments show green in 3D
✅ Selected segment's vertex shows magenta sphere
✅ Other vertices show red markers
✅ Matches 2D visual appearance
✅ No linter errors

## Files Modified

### 1. src/kirra.js

**Lines 1152-1191**: Fixed line/poly segment tracking
- Added `closestSegmentIndex` and `closestSegmentDistance` variables
- Loop tracks which segment is closest
- Set `closestElementIndex = closestSegmentIndex`

**Lines 1233-1268**: Fixed selection type determination
- Determine `selectionType` based on entity type
- Set `segmentIndex` for lines/polys
- Match 2D structure exactly

### 2. src/draw/canvas3DDrawSelection.js

**Lines 107-169**: Rewrote line highlighting
- Draw all segments in green first
- Overdraw selected segment in magenta
- Highlight owning vertex in magenta sphere
- Added developer mode logging

**Lines 196-214**: Enhanced poly vertex highlighting
- Check if vertex is start of selected segment
- Draw magenta sphere for owning vertex
- Red markers for other vertices

## Comparison: 2D vs 3D (Now Matching)

| Feature | 2D | 3D (Before) | 3D (After) |
|---------|----|-----------| ------------|
| Line Selection | ✅ | ❌ | ✅ |
| Segment Tracking | ✅ | ❌ | ✅ |
| Magenta Segment | ✅ | ❌ | ✅ |
| Magenta Vertex | ✅ | ❌ | ✅ |
| Green Segments | ✅ | ✅ | ✅ |
| Red Vertices | ✅ | ✅ | ✅ |

## Performance Impact
- **Negligible** - Same number of segments drawn
- Selection tracking: O(1) additional storage
- Highlighting: One additional sphere per entity (magenta vertex)

## Integration
- Works with existing screen-space selection
- Works with shift-click multiple selection
- Works with tree view highlighting
- Works at any camera angle/zoom
- No breaking changes to 2D mode

## Code Quality
- Step-numbered comments throughout
- No template literals (per user rules)
- Matches 2D code structure
- Developer mode debug logging
- Consistent naming conventions

---
**Implementation Time**: ~40 minutes
**Complexity**: Medium
**Risk**: Low (isolated to selection/highlighting)
**Status**: ✅ TESTED & WORKING

