# Entity Deletion Fixes - 2025-12-23 03:15

## Problem Description
The entity deletion system had three critical issues:
1. **Delete Key Error**: `showConfirmationDialog(...).then is not a function` - Promise chaining failed
2. **Right-Click Delete Inconsistency**: Segment deletion deleted wrong point - highlighted point1, deleted point2
3. **Segment Highlighting**: No visual indication of which point would be deleted in segments

## Root Cause Analysis
- **Promise Issue**: `showConfirmationDialog` returned dialog object instead of Promise
- **Selection Logic**: `selectedPoint` was set to segment start point, but deletion targeted endpoint
- **UI Inconsistency**: Highlighting and deletion behavior were misaligned

## Solution Implemented

### 1. Fixed Confirmation Dialog Promise (FloatingDialog.js)
**Before:**
```javascript
function showConfirmationDialog(...) {
    // ... create dialog ...
    dialog.show();
    return dialog; // ❌ Returns dialog object
}
```

**After:**
```javascript
function showConfirmationDialog(...) {
    return new Promise((resolve) => {
        // ... create dialog with onConfirm/onCancel callbacks ...
        onConfirm: () => {
            // ... existing logic ...
            resolve(true); // ✅ Returns Promise resolving to boolean
        },
        onCancel: () => {
            // ... existing logic ...
            resolve(false);
        }
    });
}
```

### 2. Fixed 2D Segment Highlighting (kirra.js ~line 19378)
**Before:**
```javascript
selectedPoint = entity.data[clickedKADObject.elementIndex]; // Always start point
```

**After:**
```javascript
// Step 9c) Set selectedPoint - for segments, highlight the endpoint that will be deleted
if (clickedKADObject.selectionType === "segment" && (clickedKADObject.entityType === "line" || clickedKADObject.entityType === "poly")) {
    const isPoly = clickedKADObject.entityType === "poly";
    const numPoints = entity.data.length;
    const endpointIndex = isPoly ? (clickedKADObject.elementIndex + 1) % numPoints : clickedKADObject.elementIndex + 1;
    selectedPoint = entity.data[endpointIndex]; // ✅ Highlight endpoint
} else {
    selectedPoint = entity.data[clickedKADObject.elementIndex];
}
```

### 3. Fixed 3D Segment Highlighting (kirra.js ~line 1875)
Applied identical logic to 3D click handler for consistency.

## Files Modified
- `src/dialog/FloatingDialog.js` - Fixed Promise return in `showConfirmationDialog`
- `src/kirra.js` - Updated 2D and 3D click handlers for consistent highlighting

## Testing Results
- ✅ **Delete Key**: Now works without Promise errors
- ✅ **Right-Click Context Menu**: Highlights and deletes the same point
- ✅ **Visual Consistency**: Pink highlight shows exactly which point will be deleted
- ✅ **Tree View**: Continues to work correctly (was not affected)
- ✅ **Linting**: No syntax errors introduced

## Impact Assessment
- **User Experience**: Resolved confusing deletion behavior
- **Code Quality**: Improved Promise consistency across dialog system
- **Maintainability**: Aligned selection and deletion logic
- **Backward Compatibility**: No breaking changes to existing functionality

## Future Considerations
- Consider refactoring all confirmation dialogs to use Promise pattern
- May want to add visual feedback during segment selection (different cursor/highlight)
- Could enhance UX with undo functionality for deletions

## Validation
- All modified files pass linting
- No runtime errors observed
- Follows existing code patterns and user rules
- Maintains separation of concerns between UI and business logic
