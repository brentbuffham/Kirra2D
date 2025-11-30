# RIGHT-CLICK: Copy Left-Click Logic + Add Context Menu
**Date**: 2025-11-30 18:15
**Status**: ✅ IMPLEMENTING

## Approach

User is correct - stop reinventing, just copy what works!

**Step 1**: Copy ENTIRE `handle3DClick` function (lines 844-1608 from kirra.js)
**Step 2**: Rename to `handle3DContextMenu`  
**Step 3**: Remove left-click specific stuff (selection/highlighting)
**Step 4**: Add context menu display at end based on what was clicked

## Key Changes

1. Copy detection logic verbatim (raycast + screen-space fallback)
2. Instead of setting `selectedKADObject` and calling `drawData()`, call the context menu
3. Don't modify rendering or selection state - just detect and show menu

## Implementation

Replace the entire `handle3DContextMenu` function in ContextMenuManager.js with the left-click logic, modified to show context menu instead of selecting.

