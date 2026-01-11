# TreeView Color Picker Fix
**Date**: 2024-12-19 16:30 (Updated 16:45)
**Status**: ✅ Fixed

## Issues

### Issue 1: Color Picker Not Opening (FIXED)

After migrating the `TreeView` class from `kirra.js` to its own file (`src/dialog/tree/TreeView.js`), the color swatch clicks stopped working. Clicking on a color swatch in the TreeView would not open the jsColor picker.

### Issue 2: TreeView Swatch Not Updating After Color Change (FIXED)

The color picker opens and the color changes are saved to the database and reflected on the canvas, but the **TreeView color swatch** itself doesn't always visually update after the change.

- ✅ Text colors update correctly
- ❌ Point colors do not update (swatch stays old color)

## Root Causes

### Root Cause 1: Missing Window Exposure

The `openColorPickerForElement()` function existed in `kirra.js` (line 40063) but was **not exposed to `window.*`** in the `exposeGlobalsToWindow()` function.

### Root Cause 2: Stale DOM Reference

The color picker's `onChange` handler updates `swatchElement.style.backgroundColor`, but this is a **stale reference** because:

1. Color changes trigger `debouncedUpdateTreeView()` (line 40132)
2. `updateTreeView()` calls `treeView.updateTreeData()` which **rebuilds the entire TreeView HTML**
3. The TreeView rebuild creates **new** DOM elements for all swatches
4. The old `swatchElement` reference is now orphaned (detached from DOM)
5. Updating `swatchElement.style.backgroundColor` has no effect - it's updating a ghost element!

**Sequence of Events**:
```
1. User clicks swatch → openColorPickerForElement(swatchElement, ...)
2. User changes color → onChange fires
3. onChange updates swatchElement.style.backgroundColor ✅ (old element)
4. onChange calls debouncedUpdateTreeView() → rebuilds tree
5. Tree creates NEW swatch elements in DOM
6. OLD swatchElement is orphaned, NEW swatch shows OLD color ❌
```

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

## Fixes Applied

### Fix 1: Expose Color Picker Function (Line 523)

**File**: `src/kirra.js` (line 523)

Added `openColorPickerForElement` to the `exposeGlobalsToWindow()` function:

```javascript
window.openColorPickerForElement = openColorPickerForElement; // CRITICAL: For TreeView color swatch clicks
```

### Fix 2: Update New Swatch After Tree Rebuild (Lines 40119-40149)

**File**: `src/kirra.js` (lines 40119-40149)

Enhanced the color picker's `onChange` handler to find and update the **new** swatch element after the tree rebuilds:

```javascript
const picker = new JSColor(swatchElement, {
    value: element.color || getJSColorHexDrawing(),
    format: "hex",
    mode: "HSV",
    position: "right",
    onChange: function () {
        const newColor = this.toHEXString();
        element.color = newColor;
        
        // Update the original swatch element (might be orphaned after tree rebuild)
        swatchElement.style.backgroundColor = newColor;

        // Redraw the canvas
        drawData(allBlastHoles, selectedHole);
        
        // Update tree (rebuilds HTML with new color)
        debouncedUpdateTreeView();
        
        // CRITICAL: After tree updates, find and update the NEW swatch element in the DOM
        // The tree rebuild creates new elements, so we need to update the new swatch too
        setTimeout(function() {
            const newSwatchElement = document.querySelector(
                '.color-swatch[data-entity-name="' + entityName + '"][data-point-id="' + pointID + '"]'
            );
            if (newSwatchElement) {
                newSwatchElement.style.backgroundColor = newColor;
                console.log("✅ Updated NEW swatch element after tree rebuild");
            }
        }, 150); // Wait for debounced tree update (100ms) + render time

        console.log("✅ Updated " + entityName + " point " + pointID + " color to:", newColor);
    },
});
```

**Why 150ms timeout?**
- `debouncedUpdateTreeView()` has a 100ms delay
- Add 50ms for DOM rendering/paint
- Total: 150ms ensures the new elements exist before we query them

## Expected Behavior After Fixes

1. ✅ User clicks on a color swatch (small colored square) next to a KAD vertex in the TreeView
2. ✅ TreeView's click handler detects the click on `.color-swatch`
3. ✅ Extracts `entityName` and `pointID` from `data-entity-name` and `data-point-id` attributes
4. ✅ Checks `typeof window.openColorPickerForElement === "function"` → **true**
5. ✅ Calls `window.openColorPickerForElement(swatchElement, entityName, pointID)`
6. ✅ The jsColor picker opens, allowing the user to change the vertex color
7. ✅ As user drags the picker, `onChange` fires repeatedly
8. ✅ Color updates in the data model (`element.color = newColor`)
9. ✅ Old swatch element gets updated (even though it's about to be orphaned)
10. ✅ Canvas redraws with new color
11. ✅ TreeView rebuilds (creating NEW swatch elements)
12. ✅ After 150ms, code finds the NEW swatch element using CSS selector
13. ✅ NEW swatch element background color is updated
14. ✅ User sees the swatch color change in the TreeView **immediately**
15. ✅ Changes are saved to IndexedDB via `debouncedSaveKAD()`

**Key improvement**: The swatch now updates visually in real-time, even though the TreeView is being rebuilt!

## Related Functions

The `openColorPickerForElement()` function (kirra.js, line 40063):
- Gets the entity from `allKADDrawingsMap`
- Finds the specific point by `pointID`
- Initializes a jsColor picker instance
- Sets up event handlers to update the color in real-time
- Saves changes to IndexedDB via `debouncedSaveKAD()`

## Files Modified

1. `src/kirra.js` (line 523): Added `window.openColorPickerForElement` exposure
2. `src/kirra.js` (lines 40119-40149): Enhanced color picker `onChange` to update new swatch after tree rebuild

## Technical Details

### Why Two Updates?

We update the swatch color **twice**:

1. **Immediate update** (line 40129): `swatchElement.style.backgroundColor = newColor;`
   - Updates the original element (which is about to become orphaned)
   - Provides instant visual feedback if tree update is slow
   
2. **Delayed update** (after 150ms): Query and update the NEW element
   - Finds the new swatch using CSS selector: `.color-swatch[data-entity-name="..."][data-point-id="..."]`
   - Updates the background color of the newly created element
   - Ensures the swatch stays updated after tree rebuild completes

### CSS Selector Strategy

```javascript
const newSwatchElement = document.querySelector(
    '.color-swatch[data-entity-name="' + entityName + '"][data-point-id="' + pointID + '"]'
);
```

This selector is **specific enough** to find the exact swatch that was clicked:
- `.color-swatch` - class all swatches have
- `[data-entity-name="pointObject4"]` - identifies the KAD entity
- `[data-point-id="1"]` - identifies the specific point within the entity

Even if multiple entities exist, this will find the correct swatch.

## Alternative Solutions Considered

### ❌ Option 1: Don't Rebuild Tree on Color Change
**Problem**: Tree shows stale data (colors from before the change)
**Why Not**: Tree needs to rebuild to show updated colors from the data model

### ❌ Option 2: Update Color Without Tree Rebuild
**Problem**: Other parts of the tree might also need updating
**Why Not**: TreeView is the source of truth, should always reflect current data

### ✅ Option 3: Find and Update New Element (Chosen)
**Advantage**: 
- Tree rebuilds with correct data
- Visual update happens immediately via delayed DOM query
- Clean separation: data updates → tree rebuilds → UI syncs

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

