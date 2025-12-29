---
name: Fix MoveTool to Match Original Behavior
overview: "Refactor MoveTool to exactly match the original implementation: prevent panning when mousedown occurs on an object, fix snapping/highlighting, and ensure proper coordinate handling in both 2D and 3D modes."
todos:
  - id: fix-panning-prevention
    content: Update kirra.js handleMouseDown to return early when isMoveToolActive is true, preventing panning setup. Also ensure handleMouseMove checks isDraggingHole flag.
    status: completed
  - id: fix-movetool-dragging-flag
    content: Update MoveTool.js to set window.isDraggingHole = true immediately when clicking on an object (in handleMouseDown), matching original behavior.
    status: completed
  - id: fix-movetool-cleanup
    content: Update MoveTool.js handleMouseUp to set window.isDraggingHole = false when drag completes, ensuring panning can resume.
    status: completed
    dependencies:
      - fix-movetool-dragging-flag
  - id: fix-3d-coordinates
    content: Fix 3D coordinate storage in MoveTool.js to use actual point position (initialX/Y) as dragStartWorldX/Y instead of mouse position, preventing immediate relocation.
    status: completed
  - id: verify-snapping
    content: Verify 2D snapping functions are called correctly with proper parameters and snap radius calculation.
    status: completed
  - id: verify-highlighting
    content: Verify highlighting works correctly - selectedKADObject should be set and drawData() called immediately after selection.
    status: completed
  - id: test-single-move
    content: "Test single move workflow: click move tool -> click point/hole -> drag -> mouseup releases"
    status: pending
    dependencies:
      - fix-panning-prevention
      - fix-movetool-dragging-flag
      - fix-movetool-cleanup
  - id: test-multiple-move
    content: "Test multiple move workflow: select multiple -> click move tool -> drag selection -> mouseup -> click empty space clears"
    status: pending
    dependencies:
      - fix-panning-prevention
      - fix-movetool-dragging-flag
      - fix-movetool-cleanup
---

# Fix MoveTool to Match Original Behavior

## Problem Analysis

The current MoveTool implementation differs from the original in several critical ways:

1. **Panning Prevention**: Original code sets `isDraggingHole = true` immediately on mousedown when clicking an object, preventing panning. Current code checks `isMoveToolDragging` which is only set after the handler runs, creating a race condition.

2. **Event Handling**: Original code attaches `handleMoveToolMouseDown` directly to canvas (not capture phase), and it calls `preventDefault()`/`stopPropagation()` immediately to prevent main handler from running.

3. **Flag Management**: Original uses global `isDraggingHole` flag that's checked in main `handleMouseMove` to prevent panning.

4. **Coordinate Issues**: 3D coordinates are being converted incorrectly, causing points to jump to wrong locations.

## Solution

### 1. Fix Panning Prevention Logic

**File**: `Kirra2D/src/kirra.js`

- **Line 6433-6454**: Remove the complex `isMoveToolDragging` check. Instead, check `isMoveToolActive` and return early to prevent panning setup entirely when move tool is active.
- **Line 6561**: Update panning check in `handleMouseMove` to check `isDraggingHole` flag (like original) instead of `isMoveToolDragging`.
- **Line 6527**: Ensure `handleMouseDown` returns early if `isDraggingHole` is true.

### 2. Fix MoveTool Event Handling

**File**: `Kirra2D/src/tools/MoveTool.js`

- **Line 261-264**: Keep `preventDefault()` and `stopPropagation()` at the very start (already correct).
- **Line 359, 397, 701**: Set `window.isDraggingHole = true` IMMEDIATELY when clicking on an object (before any other logic), matching original behavior.
- **Line 1144**: Set `window.isDraggingHole = false` in `handleMouseUp` when dragging stops.
- **Line 1153-1157**: Ensure `window.isDraggingHole = false` is set when drag completes.

### 3. Fix 2D Snapping

**File**: `Kirra2D/src/tools/MoveTool.js`

- **Line 992-999**: Ensure snapping functions are called correctly. The code looks correct, but verify `snapToNearestPoint` and `snapToNearestPointExcludingKAD` are being called with correct parameters.
- Verify snap radius is calculated correctly using `currentScale`.

### 4. Fix Highlighting

**File**: `Kirra2D/src/tools/MoveTool.js`

- **Line 344-356, 686-698**: Ensure `selectedKADObject` is set correctly with all required properties (already done, but verify).
- **Line 374-376, 723-725**: Ensure `drawData()` is called immediately after setting selection to show highlight.

### 5. Fix 3D Coordinate Conversion

**File**: `Kirra2D/src/tools/MoveTool.js`

- **Line 527-528**: Already fixed to use `threeLocalToWorld()` - verify it's working.
- **Line 705-712**: Change to store actual point position (`initialX`, `initialY`) as `dragStartWorldX/Y` instead of mouse position to prevent immediate relocation.
- **Line 920-945**: Ensure 3D coordinate conversion uses `threeLocalToWorld()` consistently.

### 6. Fix Selection Clearing

**File**: `Kirra2D/src/tools/MoveTool.js`

- **Line 1183-1187**: When mouseup occurs and selection should be cleared (clicking empty space), ensure `selectedKADObject` and `selectedPoint` are cleared.
- **Line 1190-1192**: Ensure `drawData()` is called after clearing selection.

## Implementation Steps

1. Update `kirra.js` `handleMouseDown` to return early when `isMoveToolActive` is true (prevent panning setup).
2. Update `kirra.js` `handleMouseMove` to check `isDraggingHole` flag for panning prevention.
3. Update `MoveTool.js` to set `window.isDraggingHole = true` immediately when clicking on object.
4. Update `MoveTool.js` to set `window.isDraggingHole = false` when drag completes.
5. Verify snapping functions are called correctly.
6. Verify highlighting is set correctly.
7. Fix 3D coordinate storage to use point position, not mouse position.
8. Test single move workflow.
9. Test multiple move workflow.
10. Test panning prevention during drag.

## Key Differences from Current Implementation

- **Original**: Sets `isDraggingHole = true` immediately on mousedown when clicking object
- **Current**: Sets `isDragging = true` on MoveTool instance, but doesn't set global flag immediately
- **Fix**: Set `window.isDraggingHole = true` immediately when clicking object

- **Original**: Main `handleMouseDown` doesn't run when move tool handler calls `stopPropagation()`
- **Current**: Main handler might still run due to timing
- **Fix**: Main handler should check `isMoveToolActive` and return early

- **Original**: Main `handleMouseMove` checks `isDraggingHole` to prevent panning
- **Current**: Checks `isMoveToolDragging` which might not be set yet
- **Fix**: Check `isDraggingHole` flag like original