# Interactive Reorder/Renumber Tools Plan

**Created**: 2026-01-31
**Status**: Draft

## Overview

Enhance the Design toolbar tools (RenumberHoles, ReorderRows, ReorderKAD) to support interactive click-based workflows, similar to existing tools like Multi-Tie Connector and Pattern in Polygon.

---

## Phase 1: Bug Fixes (Quick Wins)

### 1.1 Fix Entity Dropdown Text Display
**Issue**: Entity dropdowns show "labels" instead of text values
**Files**: `src/kirra.js` (showRenumberHolesDialog, showReorderRowsDialog)
**Fix**: Change `options` format to use `{ label: entityName, value: entityName }` correctly or just use string arrays

### 1.2 Fix ReorderKAD Entity Lookup
**Issue**: `loadedKADs` structure not matching expected format
**Investigation needed**: Check how KAD entities are stored
- `window.loadedKADs` is a Map
- Each entry may have different structure than expected
- Need to check actual entity structure

### 1.3 Fix 2D First-Point Selection
**Issue**: First point in a line can't be selected because segment is "owned" by second point
**Files**: `src/draw/canvas2DDrawing.js` or selection logic
**Solution**:
- Add separate highlight for first point (different from segment highlight)
- When checking selection, also check if click is near first point
- First point should be selectable independently of segment

---

## Phase 2: Interactive RenumberHoles Tool

### 2.1 Dialog Enhancement
**New fields in dialog**:
```
Mode: [Dropdown: "By Entity" | "Manual Selection"]
Starting Number: [Input: "1" or "A1"]
Zone Width (m): [Input: 3.0] (only shown in Manual mode)
Assign to Row: [Input: optional row number]
```

### 2.2 Manual Selection Mode Workflow
1. User clicks **first hole** → Hole highlighted in magenta
2. User clicks **last hole** → Stadium/capsule zone drawn between holes
3. Holes within zone width of the line are collected
4. Holes sorted by distance from first hole
5. Holes renumbered in order
6. If "Assign to Row" specified, all holes get that rowID

### 2.3 Stadium Visualization
- **Color**: Magenta (`#FF00FF`)
- **Shape**: Capsule/stadium (line with semicircular ends)
- **Width**: User-specified zone width
- Use existing stadium drawing logic from Multi-Tie Connector (`getHolesInLine`)

### 2.4 Implementation
**Files to modify**:
- `src/kirra.js`: Add state variables, click handlers
- `src/draw/canvas2DDrawing.js`: Add stadium preview drawing
- Reuse `getHolesInLine()` function for hole collection

**State variables**:
```javascript
let isRenumberManualMode = false;
let renumberFirstHole = null;
let renumberZoneWidth = 3.0;
let renumberStartNumber = "1";
let renumberAssignRow = null;
```

---

## Phase 3: Interactive ReorderRows Tool

### 3.1 Dialog Enhancement
**New fields in dialog**:
```
Mode: [Dropdown: "By Bearing" | "Manual Selection"]
Entity: [Dropdown of entities]
Starting ID: [Input: "A1"]
Row Tolerance (m): [Input: 2.0]
```

### 3.2 Manual Selection Mode Workflow
1. User clicks **first hole in row** → Hole highlighted
2. User clicks **last hole in row** → Line drawn between them
3. **Perpendicular arrow** displayed showing burden direction (like Pattern in Polygon)
4. Arrow can be clicked to flip direction
5. On confirm:
   - Row direction calculated from first→last hole
   - Burden direction perpendicular to row
   - All holes in entity assigned rowID/posID based on projection

### 3.3 Visualization
- **Row line**: Dashed line from first to last hole (cyan)
- **Burden arrow**: Perpendicular arrow showing row increment direction
- Similar to Pattern in Polygon bearing arrow

### 3.4 Implementation
**Files to modify**:
- `src/kirra.js`: Add state variables, click handlers
- `src/draw/canvas2DDrawing.js`: Add row line and arrow preview
- Reuse arrow drawing from Pattern in Polygon tool

**State variables**:
```javascript
let isReorderRowsManualMode = false;
let reorderRowsFirstHole = null;
let reorderRowsLastHole = null;
let reorderRowsBurdenFlipped = false;
```

---

## Phase 4: Simplified ReorderKAD Tool

### 4.1 New Workflow
**Simplified interaction**:
1. User selects KAD entity (line/polygon) in tree or by clicking
2. User clicks "Reorder KAD" button
3. Dialog shows: "Click on the point to be the first point"
4. Options: `Increment Order: [Left | Right]`
5. User clicks a point in the entity
6. Points reordered so clicked point becomes first
7. Order follows left or right winding from that point

### 4.2 Visual Feedback
- Highlight all points in the entity
- When hovering over a point, show it as potential "first point"
- After selection, show direction arrows along the line

### 4.3 Implementation
**Files to modify**:
- `src/kirra.js`: Click handler for point selection
- `src/draw/canvas2DDrawing.js`: Point highlighting

**Algorithm for reordering**:
```javascript
function reorderKADFromPoint(entity, startPointIndex, windingDirection) {
    // windingDirection: 'left' = keep current order, 'right' = reverse
    const points = entity.points;
    const n = points.length;

    // Rotate array so startPointIndex becomes index 0
    const reordered = [];
    for (let i = 0; i < n; i++) {
        const idx = (startPointIndex + i) % n;
        reordered.push(points[idx]);
    }

    // Reverse if right winding
    if (windingDirection === 'right') {
        reordered.reverse();
        // Put the start point back at index 0
        const startPoint = reordered.pop();
        reordered.unshift(startPoint);
    }

    // Reassign pointIDs
    reordered.forEach((p, i) => p.pointID = i + 1);
    entity.points = reordered;
}
```

---

## Phase 5: Integration & Testing

### 5.1 Tool State Management
- Ensure only one interactive tool is active at a time
- Add to `switches` array for mutual exclusivity
- Reset state when tool is deactivated

### 5.2 Keyboard Shortcuts
- `Escape`: Cancel current operation
- `Enter`: Confirm (where applicable)

### 5.3 Testing Scenarios
1. **RenumberHoles Manual**:
   - Create pattern, select first/last hole, verify renumbering
   - Test with row assignment
   - Test alphanumeric IDs (A1, B1, etc.)

2. **ReorderRows Manual**:
   - Create pattern, define row direction
   - Flip burden direction and verify
   - Test with irregular patterns

3. **ReorderKAD**:
   - Create line, click middle point
   - Test left vs right winding
   - Test with closed polygons

---

## File Summary

| File | Changes |
|------|---------|
| `src/kirra.js` | Dialog enhancements, state variables, click handlers |
| `src/draw/canvas2DDrawing.js` | Stadium preview, row line/arrow, point highlighting |
| `src/draw/canvas3DDrawing.js` | 3D equivalents (if needed) |

---

## Questions for User

1. **Row assignment in RenumberHoles**: When user specifies a row number, should it:
   - a) Assign ALL selected holes to that row (same rowID)?
   - b) Auto-increment rowID based on existing structure?

2. **ReorderRows arrow behavior**: Should clicking the arrow:
   - a) Flip the burden direction only?
   - b) Also swap first/last hole?

3. **ReorderKAD for closed polygons**: Should "left/right" refer to:
   - a) Clockwise/counter-clockwise?
   - b) Visual left/right from clicked point?

---

## Implementation Order

1. **Phase 1** - Bug fixes (30 min)
2. **Phase 4** - ReorderKAD simplification (1 hr) - simplest interactive change
3. **Phase 2** - RenumberHoles interactive (2 hr)
4. **Phase 3** - ReorderRows interactive (2 hr)
5. **Phase 5** - Testing & polish (1 hr)

