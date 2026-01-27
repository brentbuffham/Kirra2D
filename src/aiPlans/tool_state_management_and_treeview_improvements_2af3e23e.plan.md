---
name: Tool State Management and TreeView Improvements
overview: Implement centralized tool state management, improve TreeView selection synchronization for individual holes/vertices, move TreeView to its own module, and remove FloatingDialog duplication from kirra.js.
todos:
  - id: create-tool-state-manager
    content: Create centralized resetToolState() function to manage all tool state resets with preserveSelections option
    status: pending
  - id: enhance-treeview-selection
    content: Enhance TreeView.onSelectionChange() and highlightNodes() to handle individual holes and KAD elements
    status: pending
  - id: create-sync-function
    content: Create syncTreeViewFromCanvas() function to sync canvas selections to TreeView
    status: pending
    dependencies:
      - enhance-treeview-selection
  - id: move-treeview-module
    content: Move TreeView class and related functions to src/dialog/tree/TreeView.js and update imports
    status: pending
    dependencies:
      - enhance-treeview-selection
  - id: remove-floatingdialog-duplication
    content: Remove FloatingDialog duplication from kirra.js and uncomment import statement
    status: pending
  - id: update-tool-listeners
    content: Update all tool event listeners to use resetToolState() with appropriate preserveSelections flags
    status: pending
    dependencies:
      - create-tool-state-manager
  - id: add-selection-sync-hooks
    content: Add syncTreeViewFromCanvas() calls in drawData() and selection tool operations
    status: pending
    dependencies:
      - create-sync-function
---

# Tool State Management and TreeView Improvements

## Overview

This plan addresses tool state management issues, improves TreeView selection synchronization, and reorganizes code structure. The main goals are:

1. Create centralized tool state management system
2. Enhance TreeView to sync individual holes and vertices
3. Move TreeView class to its own module
4. Remove FloatingDialog duplication

## Architecture

### Tool State Management Flow

```javascript
Tool Switch Event
    ↓
resetToolState(excludingTool)
    ↓
    ├─→ Reset Drawing Tools (KAD)
    ├─→ Reset Measure Tools (Ruler, Protractor)
    ├─→ Reset Selection Tools (Pointer, Polygon) [optional]
    ├─→ Reset Modify Tools (Move, Bearing)
    └─→ Preserve Selection State (if switching to modify tools)
```



### TreeView Selection Sync Flow

```javascript
Canvas Selection → selectedMultipleHoles/selectedMultipleKADObjects
    ↓
syncTreeViewFromCanvas()
    ↓
TreeView.highlightNodes([nodeIds])
    ↓
TreeView.onSelectionChange()
    ↓
Canvas Selection (if tree selection changed)
```



## Implementation Tasks

### Task 1: Create Centralized Tool State Manager

**File**: `src/kirra.js`**Changes**:

- Create `resetToolState(excludingTool, preserveSelections = false)` function that:
- Resets all drawing tool states (`isDrawingPoint`, `isDrawingLine`, `isDrawingPoly`, `isDrawingCircle`, `isDrawingText`, `createNewEntity`, `entityName`, `lastKADDrawPoint`)
- Resets all measure tool states (`rulerStartPoint`, `rulerEndPoint`, `rulerProtractorPoints`, `isMeasureRecording`)
- Resets modify tool states (`moveToolSelectedHole`, `bearingToolSelectedHole`, `isDraggingHole`, `isDraggingBearing`)
- Conditionally resets selection tools based on `preserveSelections` flag
- Calls `endKadTools()` if any KAD tool was active
- Removes event listeners for deactivated tools
- Preserves `selectedMultipleHoles` and `selectedMultipleKADObjects` when `preserveSelections = true`

**Location**: Around line 3363, replace/enhance `resetFloatingToolbarButtons()`**Integration Points**:

- Update all tool checkbox event listeners to call `resetToolState()` instead of `resetFloatingToolbarButtons()`
- Modify tools (move, bearing) should call with `preserveSelections = true`
- Drawing and measure tools should call with `preserveSelections = false`

### Task 2: Enhance TreeView Selection Synchronization

**File**: `src/kirra.js` (before moving to module)**Changes**:

- Update `TreeView.onSelectionChange()` (line 41222) to:
- Handle individual hole selections: `hole⣿entityName⣿holeID` format
- Handle individual KAD element selections: `entityType⣿entityName⣿element⣿pointID` format
- Set `selectedHole` for single hole selection
- Set `selectedKADObject` for single element selection with proper structure
- Update `TreeView.highlightNodes()` (line 40006) to:
- Accept node IDs for individual holes and elements
- Handle both entity-level and element-level highlighting
- Set `isSyncing = true` to prevent feedback loops
- Create `syncTreeViewFromCanvas()` function:
- Called after canvas selection changes
- Converts `selectedMultipleHoles` to tree node IDs: `hole⣿entityName⣿holeID`
- Converts `selectedMultipleKADObjects` to tree node IDs: `entityType⣿entityName⣿element⣿pointID`
- Calls `treeView.highlightNodes()` with converted IDs

**Integration Points**:

- Call `syncTreeViewFromCanvas()` in `drawData()` after selection highlighting
- Call `syncTreeViewFromCanvas()` after selection tool operations (pointer, polygon)

### Task 3: Move TreeView to Module

**Files**:

- Create: `src/dialog/tree/TreeView.js`
- Update: `src/kirra.js`

**Changes**:

1. Create `src/dialog/tree/TreeView.js`:

- Move entire `TreeView` class (lines 39849-41437)
- Move `openColorPickerForElement()` function (lines 41439-41516)
- Move `debouncedUpdateTreeView` and `updateTreeView()` functions (lines 41519-41701)
- Move `updateTreeViewVisibilityStates()` function (lines 41532-41691)
- Export all functions and class

2. Update `src/kirra.js`:

- Remove TreeView class and related functions (lines 39846-41702)
- Add import: `import { TreeView, openColorPickerForElement, updateTreeView, debouncedUpdateTreeView, updateTreeViewVisibilityStates } from "./dialog/tree/TreeView.js";`
- Ensure all global variables used by TreeView are accessible (via window object or imports)

**Dependencies Check**:

- Verify TreeView uses: `allBlastHoles`, `allKADDrawingsMap`, `selectedHole`, `selectedMultipleHoles`, `selectedMultipleKADObjects`, `drawData()`, `debouncedSaveKAD()`, `debouncedSaveHoles()`, visibility functions, etc.
- These should be passed as parameters or accessed via window object

### Task 4: Remove FloatingDialog Duplication

**Files**:

- `src/kirra.js` (lines 41703-42438)
- `src/dialog/FloatingDialog.js`

**Changes**:

1. Verify `src/dialog/FloatingDialog.js` contains complete FloatingDialog implementation
2. Remove FloatingDialog class and helper functions from `src/kirra.js` (lines 41703-42438)
3. Uncomment import in `src/kirra.js` (line 76):
   ```javascript
               import { FloatingDialog, createFormContent, createEnhancedFormContent, getFormData, showConfirmationDialog, showConfirmationThreeDialog, showModalMessage } from "./dialog/FloatingDialog.js";
   ```




4. Verify `src/dialog/FloatingDialog.js` exports all needed functions:

- `FloatingDialog` class
- `createFormContent()`
- `createEnhancedFormContent()`
- `getFormData()` (if exists)
- `showConfirmationDialog()`
- `showConfirmationThreeDialog()` (if exists)
- `showModalMessage()` (if exists)

**Note**: The comment at line 41704 says "MOVED TO A MODULE" but the code is still duplicated. This task removes the duplication.

### Task 5: Update Tool Event Listeners

**File**: `src/kirra.js`**Changes**:

- Update all floating toolbar tool event listeners (starting around line 4400) to:
- Call `resetToolState(toolName, preserveSelections)` instead of `resetFloatingToolbarButtons()`
- Set `preserveSelections = true` for modify tools (move, bearing)
- Set `preserveSelections = false` for drawing and measure tools

**Affected Tools**:

- Drawing tools: `addKADPointsTool`, `addKADLineTool`, `addKADPolygonTool`, `addKADCircleTool`, `addKADTextTool`
- Measure tools: `rulerTool`, `rulerProtractorTool`
- Modify tools: `moveToTool`, `bearingTool` (preserve selections)
- Selection tools: `selectPointerTool`, `selectByPolygonTool` (preserve selections)
- Other tools: `holesAddingTool`, `tieConnectTool`, `tieConnectMultiTool`, etc.

### Task 6: Add Selection Sync Hooks

**File**: `src/kirra.js`**Changes**:

- In `drawData()` function, after selection highlighting, add:
  ```javascript
          if (treeView && !treeView.isSyncing) {
              syncTreeViewFromCanvas();
          }
  ```




- After selection tool operations (pointer, polygon), call `syncTreeViewFromCanvas()`
- Ensure `syncTreeViewFromCanvas()` handles:
- Empty selections (clears tree selection)
- Single selections (highlights single node)
- Multiple selections (highlights multiple nodes)

## Testing Checklist

1. **Tool State Reset**:

- Switch from drawing tool to measure tool → drawing state cleared
- Switch from measure tool to selection tool → measure state cleared
- Switch from selection tool to modify tool → selections preserved
- Switch from modify tool to drawing tool → modify state cleared, selections preserved

2. **TreeView Sync**:

- Select hole in canvas → TreeView highlights individual hole node
- Select multiple holes in canvas → TreeView highlights multiple hole nodes
- Select KAD element in canvas → TreeView highlights element node
- Select entity in TreeView → Canvas highlights all holes/elements in entity
- Select individual hole in TreeView → Canvas highlights single hole

3. **2D/3D Mode Switching**:

- Switch from 2D to 3D → selections maintained
- Switch from 3D to 2D → selections maintained
- Tool states reset appropriately

4. **Code Organization**:

- TreeView class accessible via import
- FloatingDialog accessible via import
- No duplicate code in kirra.js

## File Structure After Changes

```javascript
src/
├── dialog/
│   ├── FloatingDialog.js (complete, no duplication)
│   └── tree/
│       └── TreeView.js (new file)
└── kirra.js (TreeView and FloatingDialog removed, imports added)
```



## Notes

- **Selection Preservation**: Modify tools (move, bearing) should preserve selections because users need to see what they're modifying. Drawing and measure tools should clear selections to avoid confusion.
- **TreeView Node IDs**: Current format uses `⣿` separator:
- Holes: `hole⣿entityName⣿holeID`