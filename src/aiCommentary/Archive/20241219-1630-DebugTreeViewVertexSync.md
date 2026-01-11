# Debug Logging for TreeView-Canvas Vertex Sync
**Date:** 2024-12-19 16:30
**Status:** 🔍 Debugging in Progress

## Overview
Added comprehensive debug logging to trace the exact flow of vertex selection from TreeView to Canvas rendering, to identify why pink highlights are not appearing.

## Debug Logging Added

### 1. TreeView.js (Lines 877-892)
**Location:** Right before `drawData()` is called
**Purpose:** Verify that both `selectedPoint` and `selectedKADObject` are set correctly

```javascript
// VERIFICATION: Check if drawing conditions are met for vertex selection
if (window.selectedKADObject && window.selectedKADObject.selectionType === "vertex") {
    console.log("🔍 [TreeView] Verification before drawData:");
    console.log("  selectedKADObject:", window.selectedKADObject);
    console.log("  selectedPoint:", window.selectedPoint);
    
    if (window.selectedPoint && window.selectedKADObject) {
        console.log("✅ [TreeView] BOTH CONDITIONS MET - Pink highlight should appear!");
    } else {
        console.error("❌ [TreeView] MISSING CONDITIONS - Pink highlight will NOT appear!");
        console.error("  selectedPoint:", window.selectedPoint ? "SET" : "NULL");
        console.error("  selectedKADObject:", window.selectedKADObject ? "SET" : "NULL");
    }
}
```

### 2. canvas2DDrawSelection.js (Lines 508-518)
**Location:** At the start of vertex highlighting code
**Purpose:** Verify what values the 2D drawing function receives

```javascript
// Step 5) Draw individual vertex highlight if selectedPoint is set
const selectedPoint = window.selectedPoint;

// DEBUG: Log what we're checking
console.log("🔍 [2D Draw] Checking for pink vertex highlight:");
console.log("  selectedPoint:", selectedPoint ? selectedPoint.pointID : "null");
console.log("  selectedKADObject:", selectedKADObject ? selectedKADObject.entityName : "null");

if (selectedPoint && selectedKADObject) {
    console.log("✅ [2D Draw] BOTH conditions met - drawing pink circle");
    // ... drawing code
}
```

### 3. canvas3DDrawSelection.js (Lines 86-96)
**Location:** At the start of vertex highlighting code
**Purpose:** Verify what values the 3D drawing function receives

```javascript
// Step 4) Draw individual vertex highlight if selectedPoint is set
const selectedPoint = window.selectedPoint;

// DEBUG: Log what we're checking
console.log("🔍 [3D Draw] Checking for pink vertex highlight:");
console.log("  selectedPoint:", selectedPoint ? selectedPoint.pointID : "null");
console.log("  selectedKADObject:", selectedKADObject ? selectedKADObject.entityName : "null");

if (selectedPoint && selectedKADObject) {
    console.log("✅ [3D Draw] BOTH conditions met - drawing pink sphere");
    // ... drawing code
}
```

## Testing Instructions

### Test Case: Click Vertex Node in TreeView

1. Open the application
2. Open TreeView (Data Explorer)
3. Expand a polygon entity (e.g., "polyObjects1")
4. Click on a vertex node (e.g., "Point 1")
5. **Watch the console for these messages:**

**Expected Output (if working):**
```
✅ [TreeView] Set selectedPoint for vertex selection: P1
🔍 [TreeView] Verification before drawData:
  selectedKADObject: {entityName: "polyObjects1", entityType: "poly", ...}
  selectedPoint: {pointID: "P1", pointXLocation: 123, ...}
✅ [TreeView] BOTH CONDITIONS MET - Pink highlight should appear!
🔍 [2D Draw] Checking for pink vertex highlight:
  selectedPoint: P1
  selectedKADObject: polyObjects1
✅ [2D Draw] BOTH conditions met - drawing pink circle
```

**If Pink NOT Appearing (diagnostic):**

**Scenario A: TreeView verification fails**
```
✅ [TreeView] Set selectedPoint for vertex selection: P1
🔍 [TreeView] Verification before drawData:
❌ [TreeView] MISSING CONDITIONS - Pink highlight will NOT appear!
  selectedPoint: NULL  ← Problem: selectedPoint not being set!
  selectedKADObject: SET
```
**Cause:** Issue in TreeView lines 845-850 (setting selectedPoint)

**Scenario B: Drawing function not seeing values**
```
✅ [TreeView] BOTH CONDITIONS MET - Pink highlight should appear!
🔍 [2D Draw] Checking for pink vertex highlight:
  selectedPoint: null  ← Problem: Value lost between TreeView and drawing!
  selectedKADObject: polyObjects1
```
**Cause:** Global variable being cleared somewhere between TreeView and drawing

**Scenario C: Drawing function never called**
```
✅ [TreeView] BOTH CONDITIONS MET - Pink highlight should appear!
(No 2D Draw messages)  ← Problem: drawKADHighlightSelectionVisuals not called!
```
**Cause:** Issue in drawData() function not calling highlight functions

## What We're Investigating

### The Critical Path:
```
1. User clicks TreeView vertex node
   ↓
2. TreeView.onSelectionChange() sets:
   - window.selectedKADObject = {...}
   - window.selectedPoint = {...}
   ↓
3. TreeView calls window.drawData()
   ↓
4. drawData() calls drawKADHighlightSelectionVisuals()
   ↓
5. Drawing function checks: if (selectedPoint && selectedKADObject)
   ↓
6. If BOTH true: Draw pink circle/sphere
```

### Possible Failure Points:
- ❌ Step 2: selectedPoint not set correctly
- ❌ Between 2-3: Values cleared before drawData()
- ❌ Between 3-4: drawKADHighlightSelectionVisuals() not called
- ❌ Step 5: Values lost/cleared before check
- ❌ Step 6: Drawing code has bugs

## Files Modified

1. **src/dialog/tree/TreeView.js** (Lines 877-892)
   - Added verification before drawData()

2. **src/draw/canvas2DDrawSelection.js** (Lines 508-518)
   - Added debug logging before drawing

3. **src/draw/canvas3DDrawSelection.js** (Lines 86-96)
   - Added debug logging before drawing

## Next Steps

1. **Run the test** - Click a vertex in TreeView
2. **Check console** - Look for the debug messages
3. **Identify failure point** - See which check fails
4. **Fix the issue** - Based on where it fails

## Expected Results

If everything works:
- ✅ All checks pass
- ✅ Pink circle/sphere appears on canvas
- ✅ TreeView node highlighted
- ✅ Entity shown in green, vertex in pink

If something fails:
- ❌ One of the checks will fail
- ❌ Error message shows exactly which variable is NULL
- ❌ We know exactly where to fix

## Success Criteria

This debug session is successful when we:
1. Identify the exact point of failure
2. See which variable is NULL when it should be SET
3. Can then fix that specific issue

**Ready to test! Open the console and click a vertex node in TreeView.**

