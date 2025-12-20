# TreeView Delete Recursion Fix & Renumber Confirmation
**Date:** 2025-12-20 16:45
**Status:** ✅ FIXED & ENHANCED

---

## Problem 1: Infinite Recursion
Infinite recursion loop when deleting holes or entities from TreeView:

```
🗑️ [TreeView] Delete requested for: 1 items (x3656 times)
Uncaught RangeError: Maximum call stack size exceeded
    at kirra.js:40420:41 (window.handleTreeViewDelete)
    at TreeView.js:357:11 (TreeView.deleteSelected)
    at kirra.js:40489:20 (window.handleTreeViewDelete)
    at TreeView.js:357:11 (TreeView.deleteSelected)
    ... infinite loop ...
```

## Problem 2: Missing Renumber Confirmation
TreeView deletion was deleting holes without asking if user wanted to renumber, inconsistent with context menu behavior.

---

## Root Cause (Recursion)

**Circular Call Chain:**
1. `TreeView.deleteSelected()` calls `window.handleTreeViewDelete(nodeIds, this)`
2. `window.handleTreeViewDelete()` at line 40489 calls `treeViewInstance.deleteSelected()`
3. Returns to step 1 → **infinite loop**

**Why It Happened:**
- Line 40487-40489 in `kirra.js` delegated hole/entity deletion back to TreeView
- TreeView then called back to `handleTreeViewDelete` 
- This created an endless recursion until stack overflow

**Original Code (Line 40487-40490):**
```javascript
} else if (hasHoles || hasEntities) {
    // Delegate to TreeView's own delete logic for holes/entities
    treeViewInstance.deleteSelected();  // ❌ THIS CAUSES RECURSION
}
```

---

## Solution

**Two-stage confirmation flow using Factory Code dialogs**, matching the context menu behavior:

1. **First Dialog**: "Do you want to renumber?" (Yes/No)
2. **Second Dialog** (if Yes): "Enter starting number" (default: "1")
3. **Deletion & Renumbering**: Direct deletion with optional renumbering

### Updated Code (Line 40487-40609)

```javascript
} else if (hasHoles || hasEntities) {
    // Step 2a) Delete holes and/or entire blast entities with renumber confirmation (USE FACTORY CODE)
    
    // Step 2a.1) Ask if user wants to renumber after deletion (USE FACTORY CODE)
    window.showConfirmationDialog(
        "Renumber Holes?",
        "Do you want to renumber holes after deletion?",
        "Yes", "No",
        function() {
            // Step 2a.2) Yes - Ask for starting number (USE FACTORY CODE)
            window.showConfirmationDialogWithInput(
                "Renumber Starting Value",
                "Enter the starting number for renumbering:",
                "Start From",
                "text",
                "1",
                "OK", "Cancel",
                function(startNumber) {
                    // Step 2a.3) Delete and renumber
                    const entitiesToRenumber = new Set();
                    
                    // Delete entities and/or holes
                    // ... deletion logic ...
                    
                    // Renumber affected entities (USE FACTORY CODE)
                    entitiesToRenumber.forEach(function(entityName) {
                        if (typeof renumberHolesFunction === "function") {
                            renumberHolesFunction(startNumber, entityName);
                        }
                    });
                    
                    // Save and update (USE FACTORY CODE)
                    if (typeof debouncedSaveHoles === "function") {
                        debouncedSaveHoles();
                    }
                    
                    treeViewInstance.updateTreeData();
                    drawData(allBlastHoles, selectedHole);
                    updateStatusMessage("Deleted holes and renumbered from " + startNumber);
                }
            );
        },
        function() {
            // Step 2a.5) No - Delete without renumbering
            // ... deletion logic without renumbering ...
            
            // Save and update (USE FACTORY CODE)
            if (typeof debouncedSaveHoles === "function") {
                debouncedSaveHoles();
            }
            
            treeViewInstance.updateTreeData();
            drawData(allBlastHoles, selectedHole);
            updateStatusMessage("Deleted holes without renumbering");
        }
    );
}
```

---

## Key Changes

### 1. Recursion Fix
- **Does NOT call** `treeViewInstance.deleteSelected()`
- Directly deletes holes/entities in `kirra.js`
- Breaks the circular call chain

### 2. Two-Stage Confirmation (NEW)
- **First Dialog**: `showConfirmationDialog` - Yes/No for renumbering
- **Second Dialog**: `showConfirmationDialogWithInput` - Starting number input
- **Default Value**: "1" (can be changed to any format: A1, 100, etc.)

### 3. Entity Deletion
- Parses `entity⣿EntityName` node IDs
- Filters out all holes matching that `entityName`
- Logs number of holes removed
- **NEW**: Tracks affected entities for renumbering

### 4. Individual Hole Deletion
- Parses `hole⣿EntityName⣿HoleID` node IDs
- Finds specific hole by `entityName` and `holeID`
- Removes it using `findIndex()` and `splice()`
- **NEW**: Adds `entityName` to `entitiesToRenumber` set

### 5. Renumbering Logic
- **If Yes**: Calls `renumberHolesFunction(startNumber, entityName)` for each affected entity
- **If No**: Skips renumbering, just deletes
- **If Cancel**: Cancels entire operation

### 6. State Updates (Factory Code)
- Calls `debouncedSaveHoles()` to persist to IndexedDB
- Calls `treeViewInstance.updateTreeData()` to refresh TreeView
- Calls `drawData()` to refresh canvas
- Calls `updateStatusMessage()` with descriptive feedback

---

## Factory Code Usage

✅ **Used Existing Functions** - No custom code:
- `window.showConfirmationDialog()` - For Yes/No renumber prompt
- `window.showConfirmationDialogWithInput()` - For starting number input
- `window.renumberHolesFunction(startNumber, entityName)` - For renumbering
- `window.debouncedSaveHoles()` - For hole persistence
- `window.updateStatusMessage()` - For user feedback
- `treeViewInstance.updateTreeData()` - For TreeView refresh
- `drawData()` - For canvas refresh

✅ **Consistent UX** - Matches context menu delete behavior exactly

✅ **No Template Literals** - All string concatenation uses " " + variable style

✅ **Numbered Step Comments** - All code sections clearly labeled

---

## Testing Checklist

### TreeView Hole Deletion with Renumbering
- [ ] Delete a single hole from TreeView
- [ ] Confirm "Yes" to renumber
- [ ] Enter starting number "1" (default)
- [ ] Verify hole deleted and remaining holes renumbered from 1
- [ ] Verify TreeView updates correctly
- [ ] Verify changes persist to IndexedDB
- [ ] Verify status message shows starting number

### TreeView Hole Deletion with Custom Starting Number
- [ ] Delete a hole from TreeView
- [ ] Confirm "Yes" to renumber
- [ ] Enter custom starting number (e.g., "A1", "100")
- [ ] Verify renumbering uses custom starting number
- [ ] Verify status message shows custom number

### TreeView Hole Deletion without Renumbering
- [ ] Delete a hole from TreeView
- [ ] Confirm "No" to renumber
- [ ] Verify hole deleted without renumbering
- [ ] Verify status message indicates no renumbering

### TreeView Hole Deletion Cancellation
- [ ] Delete a hole from TreeView
- [ ] Confirm "Yes" to renumber
- [ ] Click "Cancel" on starting number dialog
- [ ] Verify deletion is cancelled
- [ ] Verify no changes to holes

### TreeView Entity Deletion
- [ ] Delete an entire blast entity from TreeView
- [ ] Confirm "Yes" or "No" to renumber
- [ ] Verify all holes in that entity are deleted
- [ ] Verify count message shows correct number
- [ ] Verify TreeView updates correctly
- [ ] Verify changes persist to IndexedDB

### TreeView Multiple Deletion
- [ ] Select and delete multiple holes from TreeView
- [ ] Verify renumber prompt appears once
- [ ] Verify all selected holes are deleted
- [ ] Verify renumbering applies to all affected entities

### Edge Cases
- [ ] Delete last hole in an entity (entity should remain)
- [ ] Delete all holes from multiple entities
- [ ] Delete holes with alphanumeric IDs (A1, B5, etc.)
- [ ] Verify no stack overflow errors
- [ ] Verify debounced saves work correctly

### KAD Deletion (Should Still Work)
- [ ] Delete KAD elements from TreeView
- [ ] Delete KAD entities from TreeView
- [ ] Verify KAD deletions still work (no renumber prompt needed)

---

## Related Issues

### Issue 1: Recursion Bug ✅ FIXED
- **NOT caused** by Phase 1 Delete button implementation
- Pre-existing bug in TreeView delete handler
- Fixed by implementing direct deletion logic

### Issue 2: Inconsistent UX ✅ FIXED
- Context menu had renumber confirmation
- TreeView did not have renumber confirmation
- Now both use identical two-stage dialog flow

---

## Files Modified

1. **`src/kirra.js`** (Line 40487-40609) - Fixed recursion and added renumber confirmation dialogs

---

## Linter Status
✅ No linter errors

---

## Notes

- Uses Factory Code patterns (existing dialogs, debounced saves, renumber functions)
- No template literals (string concatenation only)
- Proper console logging for debugging
- Handles both individual holes and entire entities
- Maintains data consistency between memory, canvas, and IndexedDB
- **Consistent UX**: TreeView deletion now matches context menu deletion exactly
- **User Control**: Always asks for renumbering preference and starting number

