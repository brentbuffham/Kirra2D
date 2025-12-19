# TreeView Color Picker Fix
**Date**: 2024-12-19 16:30
**Status**: ✅ Fixed

## Issue

After migrating the `TreeView` class from `kirra.js` to its own file (`src/dialog/tree/TreeView.js`), the color swatch clicks stopped working. Clicking on a color swatch in the TreeView would not open the jsColor picker.

## Root Cause

The `openColorPickerForElement()` function existed in `kirra.js` (line 40063) but was **not exposed to `window.*`** in the `exposeGlobalsToWindow()` function.

When TreeView was in `kirra.js`, it could access the function directly (same module scope). After migration, TreeView needed to call `window.openColorPickerForElement()`, but this was undefined.

## Code Flow

### TreeView Click Handler (src/dialog/tree/TreeView.js, lines 54-65)

```javascript
// Color swatch event delegation
this.container.addEventListener("click", (e) => {
    if (e.target.classList.contains("color-swatch")) {
        e.stopPropagation();

        const entityName = e.target.dataset.entityName;
        const pointID = parseInt(e.target.dataset.pointId);

        if (entityName && !isNaN(pointID) && typeof window.openColorPickerForElement === "function") {
            window.openColorPickerForElement(e.target, entityName, pointID);
        }
    }
});
```

**What was happening**:
- Check: `typeof window.openColorPickerForElement === "function"` → **false** (undefined)
- Result: Function was never called

### Color Swatch HTML (src/dialog/tree/TreeView.js, line 755)

```javascript
colorSwatchHtml = '<span class="color-swatch" style="background-color: ' + color + ';" 
    data-element-id="' + node.id + '" 
    data-entity-name="' + node.elementData.entityName + '" 
    data-point-id="' + node.elementData.pointID + '"></span>';
```

The HTML structure was correct - it was creating the swatch with all necessary data attributes.

## Fix Applied

**File**: `src/kirra.js` (line 523)

Added `openColorPickerForElement` to the `exposeGlobalsToWindow()` function:

```javascript
// Step 6f) ONLY expose functions that actually exist in kirra.js
window.calculateHoleGeometry = calculateHoleGeometry;
window.debouncedSaveHoles = debouncedSaveHoles;
window.debouncedSaveKAD = debouncedSaveKAD;
window.clearAllSelectionState = clearAllSelectionState;
window.setSelectionFromTreeView = setSelectionFromTreeView; // CRITICAL: For TreeView to update selection
window.openColorPickerForElement = openColorPickerForElement; // CRITICAL: For TreeView color swatch clicks ← NEW
window.setKADEntityVisibility = setKADEntityVisibility;
// ... rest of exposed functions
```

## Expected Behavior After Fix

1. User clicks on a color swatch (small colored square) next to a KAD vertex in the TreeView
2. TreeView's click handler detects the click on `.color-swatch`
3. Extracts `entityName` and `pointID` from `data-entity-name` and `data-point-id` attributes
4. Checks `typeof window.openColorPickerForElement === "function"` → **true** ✅
5. Calls `window.openColorPickerForElement(swatchElement, entityName, pointID)`
6. The jsColor picker opens, allowing the user to change the vertex color
7. Color changes are saved to the database and reflected in both 2D and 3D views

## Related Functions

The `openColorPickerForElement()` function (kirra.js, line 40063):
- Gets the entity from `allKADDrawingsMap`
- Finds the specific point by `pointID`
- Initializes a jsColor picker instance
- Sets up event handlers to update the color in real-time
- Saves changes to IndexedDB via `debouncedSaveKAD()`

## Files Modified

- `src/kirra.js` (line 523): Added `window.openColorPickerForElement` exposure

## Pattern

This is the same pattern used for other TreeView delegation functions:
- `window.handleTreeViewDelete`
- `window.handleTreeViewRename`
- `window.handleTreeViewVisibility`
- `window.handleTreeViewShowProperties`
- `window.handleTreeViewResetConnections`
- `window.setSelectionFromTreeView` ← Added earlier in this session
- `window.openColorPickerForElement` ← Added now

All these functions exist in `kirra.js` and need to be exposed to `window.*` for TreeView (and other modules) to call them.

## Testing

- [ ] Click color swatch in TreeView → jsColor picker opens
- [ ] Change color in picker → color updates in real-time on canvas
- [ ] Close picker → color persists (saved to DB)
- [ ] Reload page → color remains changed

## Notes

This is a **common migration issue** when extracting classes from a monolithic file:
1. Functions work fine when in the same file (module scope)
2. After extraction, they need explicit `window.*` exposure
3. The caller correctly checks `typeof window.func === "function"` before calling
4. The function exists but isn't exposed → silent failure (check evaluates to false)

Always check `exposeGlobalsToWindow()` when migrating interactive components from `kirra.js`.

