# Undo System Implementation Progress
**Date:** 2026-01-22 16:00
**Status:** In Progress

## Overview
Implementing comprehensive undo/redo support across Kirra2D operations. The system uses an `UndoManager` with action classes that can be batched for multi-item operations.

---

## Architecture

### Core Files
- `src/tools/UndoManager.js` - UndoManager class with batch support
- `src/tools/UndoActions.js` - Action classes for holes and KAD entities

### Action Classes Available

#### Hole Actions
| Class | Purpose | Status |
|-------|---------|--------|
| `AddHoleAction` | Single hole addition | ✅ Working |
| `AddMultipleHolesAction` | Batch hole addition | ✅ Working |
| `DeleteHoleAction` | Single hole deletion | ✅ Working |
| `DeleteMultipleHolesAction` | Batch hole deletion | ✅ Working |
| `MoveHoleAction` | Single hole move | ⚠️ Defined, not integrated |
| `MoveMultipleHolesAction` | Batch hole move | ⚠️ Defined, not integrated |
| `EditHolePropsAction` | Single hole property edit | ⚠️ Defined, not integrated |
| `EditMultipleHolesPropsAction` | Batch hole property edit | ⚠️ Defined, not integrated |

#### KAD Actions
| Class | Purpose | Status |
|-------|---------|--------|
| `AddKADEntityAction` | Single entity addition | ✅ Working |
| `AddMultipleKADEntitiesAction` | Batch entity addition | ✅ NEW - For radii tool |
| `DeleteKADEntityAction` | Single entity deletion | ✅ Working |
| `DeleteMultipleKADEntitiesAction` | Batch entity deletion | ✅ NEW |
| `AddKADVertexAction` | Single vertex addition | ✅ Working |
| `DeleteKADVertexAction` | Single vertex deletion | ✅ Working |
| `MoveKADVertexAction` | Single vertex move | ⚠️ Defined, not integrated |
| `MoveMultipleKADVerticesAction` | Batch vertex move | ⚠️ Defined, not integrated |
| `EditKADPropsAction` | Entity/vertex property edit | ⚠️ Defined, not integrated |

---

## Completed Items ✅

### 1. HolesContextMenu.js Delete (Lines ~370-442)
- Added undo support for both "delete with renumber" and "delete without renumber" paths
- Uses `DeleteHoleAction` for single hole, `DeleteMultipleHolesAction` for multiple

### 2. KADContextMenu.js Delete Vertex (Lines ~317-369)
- Added undo support using `DeleteKADVertexAction`
- Captures vertex data before deletion

### 3. TreeView Hole Deletion (kirra.js ~48728-48860)
- Added undo support for both entity deletion and individual hole deletion
- Uses `DeleteMultipleHolesAction` for batch operations

### 4. Radii Tool - Both Cases (kirra.js ~19111-19295)
- Non-Union Case: Added tracking of created entity names, creates `AddMultipleKADEntitiesAction`
- Union Case: Added tracking of created union entity names, creates `AddMultipleKADEntitiesAction`
- ✅ Both cases now have full undo support

### 5. New Action Classes Added (UndoActions.js)
- `AddMultipleKADEntitiesAction` - For batch KAD additions (radii, offset, etc.)
- `DeleteMultipleKADEntitiesAction` - For batch KAD deletions

### 6. Imports & Window Exposure Updated (kirra.js)
- Added imports for new action classes (lines 31-49)
- Exposed on window object (lines ~654-660)

### 7. Pattern Generation - Batch Undo Support ✅
All three pattern generation tools now use batch undo:

#### generateHolesAlongLine (kirra.js ~41278-41430)
- Calls `undoManager.beginBatch()` before loop
- Calls `undoManager.endBatch()` on success
- Calls `undoManager.cancelBatch()` on user cancellation

#### generatePatternInPolygon (kirra.js ~40969-41275)
- Calls `undoManager.beginBatch()` before processing rows
- Calls `undoManager.endBatch()` on success
- Calls `undoManager.cancelBatch()` on user cancellation

#### generateHolesAlongPolyline (kirra.js ~42756-42950)
- Calls `undoManager.beginBatch()` before processing segments
- Calls `undoManager.endBatch()` on success
- Calls `undoManager.cancelBatch()` on user cancellation

---

## In Progress 🔄

*All immediate tasks completed!*

---

## Remaining Items ❌

### Medium Priority (Complex - Needs Refactoring)

#### 3. Move Tool - Holes
**Challenge:** Drag-based interaction captures initial positions at mousedown, needs to create undo action at mouseup.
**Location:** `handleMoveToolMouseDown`, `handleMoveToolMouseUp` (~33768-34820)

**Variables tracking positions:**
- `dragInitialPositions` - Array of original hole positions
- `moveToolSelectedHole` - Currently selected hole(s)

#### 4. Move Tool - KAD Vertices
**Challenge:** Same drag interaction pattern
**Variables:**
- `dragInitialKADPositions` - Array of original vertex positions
- `moveToolSelectedKAD` - Currently selected KAD object

#### 5. Rotate Hole Tool
**Challenge:** Similar to move tool, drag-based bearing rotation
**Location:** Search for `bearingTool`, `isBearingToolActive`

### Low Priority

#### 6. Property Edits
- Hole property editor (HolesContextMenu.js)
- KAD property editor (KADContextMenu.js)
- These create many small changes - may want batch support

---

## User's Architectural Question

> "Rather than looking at the tool should we be looking at the hole modifications and putting a listener on the hole and if any of the hole attributes are altered via any tool then record it?"

### Options Considered:

#### Option 1: Proxy/Observer Pattern
Wrap `allBlastHoles` in a Proxy to intercept all modifications.
- **Pro:** Catches ALL modifications regardless of tool
- **Con:** Performance overhead, complex deep proxying

#### Option 2: Setter Functions
Force all modifications through functions like `setHoleProperty()`.
- **Pro:** Clean, explicit
- **Con:** Requires refactoring ALL code that modifies holes

#### Option 3: Diff-Based (For Batch Operations)
Take snapshots before/after large operations.
- **Pro:** Simple for pattern generation
- **Con:** Doesn't help with granular edits

### Current Decision:
Proceeding with tool-level instrumentation for now. Pattern generation will use batch wrapping. Move/rotate tools will capture before/after states.

---

## Testing Checklist

| Feature | Test Case | Status |
|---------|-----------|--------|
| Delete hole from context menu | Select hole → right-click → Delete → Ctrl+Z | ✅ Implemented |
| Delete vertex from KAD context menu | Select vertex → right-click → Delete → Ctrl+Z | ✅ Implemented |
| Delete hole from TreeView | Select in TreeView → Delete → Ctrl+Z | ✅ Implemented |
| Delete entity from TreeView | Select entity → Delete → Ctrl+Z | ✅ Implemented |
| Radii tool (non-union) | Create radii → Ctrl+Z removes all | ✅ Implemented |
| Radii tool (union) | Create unioned radii → Ctrl+Z | ✅ Implemented |
| Holes along line | Generate → Ctrl+Z removes all (batch) | ✅ Implemented |
| Holes along polyline | Generate → Ctrl+Z removes all (batch) | ✅ Implemented |
| Pattern in polygon | Generate → Ctrl+Z removes all (batch) | ✅ Implemented |
| Move hole | Move → Ctrl+Z restores position | ⬜ Needs work |
| Move KAD vertex | Move → Ctrl+Z restores position | ⬜ Needs work |
| Rotate hole | Rotate → Ctrl+Z restores bearing | ⬜ Needs work |

---

## Next Steps

1. **Expose new classes on window** (quick fix)
2. **Add union case to radii tool** (similar to non-union)
3. **Pattern generation batch undo** (wrap with beginBatch/endBatch)
4. **Verify DELETE key vertex deletion**
5. **Move tool integration** (complex but well-defined)
6. **Rotate tool integration** (follows move tool pattern)
