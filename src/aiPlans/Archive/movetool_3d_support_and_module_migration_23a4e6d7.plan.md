---
name: MoveTool 3D Support and Module Migration
overview: Extract the moveTool from kirra.js into a separate module in Kirra2D/src/tools/, and enable it for 3D mode with the same features as 2D (holes and KAD entities support).
todos:
  - id: create-move-tool-module
    content: Create Kirra2D/src/tools/MoveTool.js with MoveTool class/object structure, activation/deactivation methods, and internal state management
    status: completed
  - id: implement-2d-mode
    content: Implement 2D mode handlers (mouseDown, mouseMove, mouseUp) using existing 2D logic from kirra.js lines 26184-26611
    status: completed
    dependencies:
      - create-move-tool-module
  - id: implement-3d-mode
    content: Implement 3D mode handlers using raycasting via interactionManager, with proper coordinate conversion and 3D snapping
    status: completed
    dependencies:
      - create-move-tool-module
  - id: integrate-kirra-js
    content: Update kirra.js to import MoveTool, wire moveToTool checkbox, remove old implementation (lines 26184-26611), and update handle3DClick() to respect isMoveToolActive
    status: completed
    dependencies:
      - implement-2d-mode
      - implement-3d-mode
  - id: test-tool
    content: Test moveTool in both 2D and 3D modes with holes and KAD entities, verify snapping, camera suspension, and state management
    status: completed
    dependencies:
      - integrate-kirra-js
---

# MoveTool 3D Support and Module Migration

## Overview

Extract the moveTool implementation from `kirra.js` into a modular tool (`Kirra2D/src/tools/MoveTool.js`) and enable it for 3D mode with full feature parity (holes and KAD entities).

## Architecture

### Module Structure

Create `Kirra2D/src/tools/MoveTool.js` that:

- Exports a `MoveTool` class or object with activation/deactivation methods
- Handles both 2D (canvas) and 3D (Three.js) modes
- Manages its own state (isActive, selectedHoles, selectedKAD, dragging state)
- Integrates with existing global state via window object

### Key Dependencies

The module will access these globals from `window`:

- `onlyShowThreeJS` - determines 2D vs 3D mode
- `isMoveToolActive` - tool activation flag (set by module)
- `selectedHole`, `selectedMultipleHoles` - current selections
- `selectedKADObject`, `selectedMultipleKADObjects` - KAD selections
- `allBlastHoles`, `allKADDrawingsMap` - data sources
- `interactionManager`, `threeRenderer` - 3D interaction
- `canvas` - 2D canvas element
- Snapping functions: `snapToNearestPoint`, `snapToNearestPointExcludingKAD`, `snapToNearestPointWithRay`
- Save functions: `debouncedSaveHoles`, `debouncedSaveKAD`, `debouncedUpdateTreeView`
- Drawing functions: `drawData`, `calculateHoleGeometry`
- Helper functions: `getClickedHole`, `getClickedKADObject`, `canvasToWorld`, `worldToThreeLocal`

## Implementation Steps

### Step 1: Create MoveTool Module

Create `Kirra2D/src/tools/MoveTool.js`:

- Export `MoveTool` class/object with:
- `activate()` - enable tool, attach event listeners
- `deactivate()` - disable tool, remove listeners, restore previous state
- `handleMouseDown(event)` - unified handler for 2D/3D
- `handleMouseMove(event)` - unified drag handler
- `handleMouseUp(event)` - unified release handler
- Internal state management (dragging, selected items, initial positions)

### Step 2: 2D Mode Support

- Use existing 2D logic from lines 26184-26611 in `kirra.js`
- Attach listeners to `canvas` element
- Use `getClickedHole()` and `getClickedKADObject()` for selection
- Use `canvasToWorld()` for coordinate conversion
- Use `snapToNearestPoint()` / `snapToNearestPointExcludingKAD()` for snapping

### Step 3: 3D Mode Support

- Check `onlyShowThreeJS` flag to determine mode
- In 3D mode:
- Use `interactionManager.raycast()` for object detection
- Use `interactionManager.findClickedHole()` for hole selection
- Use `interactionManager.findClickedKAD()` or screen-space projection for KAD selection
- Use `snapToNearestPointWithRay()` for 3D snapping
- Convert world coordinates using `worldToThreeLocal()` when updating KAD
- Attach listeners to Three.js canvas container (not canvas element)
- Prevent camera panning by checking `isMoveToolActive` in CameraControls (already implemented at line 6422)

### Step 4: Integration Points

Update `kirra.js`:

- Remove moveTool code (lines 26184-26611)
- Import MoveTool module
- Wire `moveToTool` checkbox to `MoveTool.activate()` / `MoveTool.deactivate()`
- Ensure `isMoveToolActive` flag is set/cleared by the module
- Update `resetFloatingToolbarButtons()` to exclude "moveToTool" (already at line 3385)
- Update `handle3DClick()` to check `isMoveToolActive` and skip selection when active (similar to polygon tool check at line 1058)

### Step 5: Event Handling

- 2D: Attach to `canvas` element (mousedown, mousemove, mouseup, touchstart, touchmove, touchend)
- 3D: Attach to Three.js container (same events)
- Prevent event propagation when tool is active to avoid camera controls interference
- Handle both mouse and touch events

### Step 6: Selection Logic

- Respect radio button selection (`selectHolesRadio` vs `selectKADRadio`)
- Support existing selections (use `selectedMultipleHoles` / `selectedHole` if available)
- Allow clicking to select if no selection exists
- Clear selection on empty space click

### Step 7: Snapping Support

- Support 'S' key for self-snap (already implemented at lines 26464-26475)
- Use appropriate snap function based on mode:
- 2D: `snapToNearestPoint()` or `snapToNearestPointExcludingKAD()`
- 3D: `snapToNearestPointWithRay()`
- Apply snapping to both holes and KAD vertices

### Step 8: State Management

- Store initial positions when drag starts
- Update positions during drag
- Save changes on mouse up:
- `debouncedSaveHoles()` for holes
- `debouncedSaveKAD()` + `debouncedUpdateTreeView()` for KAD
- Recalculate contours/triangulation after hole moves (existing logic at lines 26587-26599)

### Step 9: Drawing Updates

- Call `drawData()` after position updates to refresh display
- Ensure 3D rendering updates via `renderThreeJS()` or `drawData()` (which should handle both)

### Step 10: Cleanup

- Remove duplicate code in `kirra.js` (lines 26184-26611)
- Remove global variables if they become module-internal:
- `moveToolSelectedHole` → module state
- `moveToolSelectedKAD` → module state
- `moveToolKADOriginalZ` → module state
- Keep `isMoveToolActive` as global flag for CameraControls integration

## Files to Modify

1. **Create**: `Kirra2D/src/tools/MoveTool.js` - new module
2. **Modify**: `Kirra2D/src/kirra.js`:

- Remove lines 26184-26611 (moveTool implementation)
- Add import for MoveTool
- Wire moveToTool checkbox to MoveTool methods
- Update `handle3DClick()` to check `isMoveToolActive` (around line 1058)
- Ensure `isMoveToolActive` is accessible globally (already at line 2800)

## Testing Considerations

- Test tool activation/deactivation in both 2D and 3D modes
- Test hole movement (single and multiple selection)
- Test KAD vertex movement
- Test snapping (regular and self-snap with 'S' key)
- Test that camera panning is suspended when tool is active
- Test touch events on mobile devices
- Verify selections are preserved when switching between tools
- Verify contours/triangulation recalculate after moves

## Notes

- The tool should suspend normal panning behavior (already handled at line 6422)
- Self-snap key ('S') handling is already implemented globally (lines 26464-26475)
- The module should follow the same pattern as other tools (e.g., PolygonSelection3D.js)
- Coordinate conversion differs between 2D (canvas coordinates) and 3D (raycasting + world coordinates)