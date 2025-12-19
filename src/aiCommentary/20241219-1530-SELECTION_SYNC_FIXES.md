# Selection Synchronization Fixes
**Date**: 2024-12-19 15:30 (Updated 16:00)
**Status**: ✅ Completed

## Issues Identified

### 1. 2D TreeView → Canvas Selection Not Working
**Problem**: TreeView correctly sets `window.selectedKADObject` and `window.selectedPoint`, but by the time the drawing functions run, `selectedKADObject` is `null`.

**Root Cause**: 
- TreeView sets `window.selectedKADObject` and `window.selectedPoint`
- TreeView calls `drawData()`
- `drawData()` immediately calls `exposeGlobalsToWindow()`
- `exposeGlobalsToWindow()` overwrites `window.selectedKADObject` with the local module variable `selectedKADObject` (which is `null` or stale)

**Log Evidence**:
```
TreeView.js:883 ✅ [TreeView] BOTH CONDITIONS MET - Pink highlight should appear!
canvas2DDrawSelection.js:513   selectedPoint: 58
canvas2DDrawSelection.js:514   selectedKADObject: null  <-- OVERWRITTEN!
```

### 2. 3D Canvas Selection Persisting Incorrectly
**Problem**: `selectedPoint: 3` persists from previous selections even after clicking on a different entity or segment.

**Root Cause**: 
- `kirra.js` has local module variables for selection state
- These local variables are cleared correctly
- BUT `exposeGlobalsToWindow()` doesn't expose `selectedPoint` or `selectedMultiplePoints` to `window.*`
- So the local variable is cleared but `window.selectedPoint` retains its old value
- Drawing functions read from `window.selectedPoint` and see the stale value

**Log Evidence**:
```
kirra.js:1806 🔄 [3D CLICK] Cleared selectedPoint (segment/entity selection)
...
canvas3DDrawSelection.js:91   selectedPoint: 3  // ❌ Still 3!
canvas3DDrawSelection.js:92   selectedKADObject: lineObject6
canvas3DDrawSelection.js:95 ✅ [3D Draw] BOTH conditions met - drawing pink sphere
```
Result: Wrong vertex (pointID: 3 from previous selection) highlighted on `lineObject6`.

### 3. 3D Pink Spheres Oversized
**Problem**: Pink vertex highlights in 3D are 5 meters in radius, appearing massive on screen.

**Root Cause**: Hardcoded radius in `canvas3DDrawSelection.js` line 111 and line 133.

## Fixes Implemented

### Fix 1: Add `selectedPoint` and `selectedMultiplePoints` to `exposeGlobalsToWindow()`
**File**: `src/kirra.js` (lines ~465-467)

Added explicit exposure of vertex selection state:
```javascript
window.selectedPoint = selectedPoint; // CRITICAL: Expose selectedPoint for vertex highlighting
window.selectedMultiplePoints = selectedMultiplePoints; // CRITICAL: Expose for multi-vertex highlighting
```

**Impact**: Ensures that when 3D canvas selection sets `selectedPoint = null`, this is properly propagated to `window.selectedPoint` so drawing functions see the correct value.

### Fix 2: Add `setSelectionFromTreeView()` Setter Function
**File**: `src/kirra.js` (lines ~3408-3432)

Created a dedicated setter function for TreeView to update the **local module variables** in kirra.js:

```javascript
function setSelectionFromTreeView(selectionState) {
	// TreeView calls this instead of setting window.* directly
	// This ensures the local module variables are updated before exposeGlobalsToWindow() runs
	if (selectionState.selectedHole !== undefined) {
		selectedHole = selectionState.selectedHole;
	}
	if (selectionState.selectedMultipleHoles !== undefined) {
		selectedMultipleHoles = selectionState.selectedMultipleHoles;
	}
	if (selectionState.selectedKADObject !== undefined) {
		selectedKADObject = selectionState.selectedKADObject;
	}
	if (selectionState.selectedMultipleKADObjects !== undefined) {
		selectedMultipleKADObjects = selectionState.selectedMultipleKADObjects;
	}
	if (selectionState.selectedPoint !== undefined) {
		selectedPoint = selectionState.selectedPoint;
	}
	if (selectionState.selectedMultiplePoints !== undefined) {
		selectedMultiplePoints = selectionState.selectedMultiplePoints;
	}
	
	console.log("🔄 [TreeView] Selection state updated:", {
		selectedKADObject: selectedKADObject ? selectedKADObject.entityName : null,
		selectedPoint: selectedPoint ? selectedPoint.pointID : null
	});
}
```

Exposed to window at line ~533:
```javascript
window.setSelectionFromTreeView = setSelectionFromTreeView;
```

**Impact**: TreeView can now update the kirra.js local module variables directly, so when `drawData()` calls `exposeGlobalsToWindow()`, it propagates the correct (updated) values to `window.*`.

**Why This Works**:
- TreeView calls `setSelectionFromTreeView({ selectedKADObject: ..., selectedPoint: ... })`
- This updates the **local** `selectedKADObject` and `selectedPoint` in kirra.js module scope
- TreeView then calls `drawData()`
- `drawData()` calls `exposeGlobalsToWindow()`
- `exposeGlobalsToWindow()` copies the **local** variables (now updated by TreeView) to `window.*`
- Drawing functions read from `window.*` and see the correct values ✅

**Why NOT Bidirectional Sync**:
- Initial attempt used bidirectional sync: `selectedKADObject = window.selectedKADObject ?? selectedKADObject`
- This broke 2D canvas clicks because they set local variables, then `exposeGlobalsToWindow()` would read stale window values
- Setter function approach preserves 2D canvas behavior (it updates local vars, then they get exposed)

### Fix 3: Update TreeView to Use Setter Function
**File**: `src/dialog/tree/TreeView.js` (lines ~838-897)

Changed TreeView to call `window.setSelectionFromTreeView()` instead of directly setting `window.selectedKADObject` and `window.selectedPoint`:

```javascript
// Use setter function to update kirra.js local variables
if (typeof window.setSelectionFromTreeView === "function") {
	window.setSelectionFromTreeView({
		selectedKADObject: kadObject,
		selectedPoint: pointToSet
	});
} else {
	// Fallback to direct window assignment (if setter not available)
	window.selectedKADObject = kadObject;
	window.selectedPoint = pointToSet;
}
```

**Impact**: TreeView updates propagate correctly to drawing functions without breaking canvas clicks.

### Fix 4: Reduce 3D Pink Sphere Size
**File**: `src/draw/canvas3DDrawSelection.js` (lines 111, 133)

Changed sphere radius from 5m to 0.5m:
```javascript
// Before:
const geometry = new THREE.SphereGeometry(5, 16, 16); // 5m radius sphere

// After:
const geometry = new THREE.SphereGeometry(0.5, 16, 16); // 0.5m radius sphere (smaller, more appropriate)
```

**Impact**: Pink vertex highlights in 3D are now appropriately sized.

## Expected Behavior After Fixes

### 2D Canvas Selection (User clicks canvas)
1. User clicks vertex/entity on 2D canvas
2. Event handler sets local variables: `selectedKADObject = ...`, `selectedPoint = ...`
3. Event handler calls `drawData()`
4. `drawData()` calls `exposeGlobalsToWindow()`
5. `exposeGlobalsToWindow()` copies local vars to `window.*`
6. ✅ Works as before (NOT BROKEN)

### 2D TreeView → Canvas
1. User clicks vertex node in TreeView
2. TreeView calculates `kadObject` and `pointToSet`
3. TreeView calls `window.setSelectionFromTreeView({ selectedKADObject: kadObject, selectedPoint: pointToSet })`
4. Setter updates **local** kirra.js variables: `selectedKADObject = kadObject`, `selectedPoint = pointToSet`
5. TreeView calls `drawData()`
6. `drawData()` calls `exposeGlobalsToWindow()`
7. `exposeGlobalsToWindow()` copies local vars (now updated) to `window.*`
8. Drawing function `canvas2DDrawSelection.js` sees both `selectedPoint` and `selectedKADObject`
9. ✅ Pink circle appears on the correct vertex

### 3D Canvas Selection
1. User clicks vertex in 3D canvas
2. `kirra.js` sets `selectedPoint = entity.data[elementIndex]`
3. `kirra.js` calls `exposeGlobalsToWindow()`
4. `exposeGlobalsToWindow()` copies `selectedPoint` to `window.selectedPoint`
5. Drawing function `canvas3DDrawSelection.js` sees correct `selectedPoint`
6. ✅ Pink sphere (0.5m radius) appears on correct vertex

### 3D Canvas Entity/Segment Selection
1. User clicks entity or segment (not a vertex)
2. `kirra.js` sets `selectedPoint = null`
3. `kirra.js` calls `exposeGlobalsToWindow()`
4. `exposeGlobalsToWindow()` copies `selectedPoint` (null) to `window.selectedPoint`
5. Drawing function sees `selectedPoint === null`
6. ✅ No pink sphere appears (correct!)

### 3D TreeView → Canvas
1. User clicks vertex node in TreeView
2. TreeView calls `window.setSelectionFromTreeView({ selectedKADObject: ..., selectedPoint: ... })`
3. Setter updates local kirra.js variables
4. TreeView calls `drawData()`
5. `drawData()` → `exposeGlobalsToWindow()` → copies to `window.*`
6. ✅ Pink sphere (0.5m radius) appears on correct vertex

## Architecture Notes

### Why Two Layers of State?
The application has a hybrid architecture:
- **Local module variables** in `kirra.js` (e.g., `let selectedKADObject = null;`)
- **Global window variables** (e.g., `window.selectedKADObject`)

This exists because:
1. `kirra.js` is the original monolithic file with module-scoped variables
2. Drawing modules (`canvas2DDrawSelection.js`, `canvas3DDrawSelection.js`) were extracted and need `window.*` access
3. TreeView was extracted and needs `window.*` access
4. Full refactor to single state layer would be massive

### State Flow Diagram
```
Canvas Click (2D/3D)
  └─> Updates LOCAL vars in kirra.js
      └─> drawData()
          └─> exposeGlobalsToWindow()
              └─> Copies LOCAL → window.*
                  └─> Drawing modules read window.*

TreeView Click
  └─> Calls setSelectionFromTreeView()
      └─> Updates LOCAL vars in kirra.js  <-- KEY FIX!
          └─> drawData()
              └─> exposeGlobalsToWindow()
                  └─> Copies LOCAL → window.*
                      └─> Drawing modules read window.*
```

### Why NOT Bidirectional Sync?
Initially attempted:
```javascript
// BAD - breaks canvas clicks
selectedKADObject = window.selectedKADObject ?? selectedKADObject;
window.selectedKADObject = selectedKADObject;
```

This breaks canvas clicks because:
1. Canvas click sets local `selectedKADObject = newValue`
2. `exposeGlobalsToWindow()` runs
3. Reads stale `window.selectedKADObject` (from previous selection)
4. Overwrites local var with stale value!
5. Then writes stale value back to window
6. ❌ Selection doesn't work

The setter function approach is unidirectional (TreeView → Local → Window) which preserves the existing canvas click behavior.

## Color Scheme (Confirmed)
- **Pink** (`rgba(255, 68, 255, *)`): Primary selection (vertex/segment/point entity)
- **Green** (`#00FF00` / `rgba(0, 255, 0, *)`): Rest of selected entity
- **Red** (`rgba(255, 0, 0, 0.5)`): Reference vertices/origin

## Files Modified
1. `src/kirra.js`:
   - Lines ~465-467: Added `window.selectedPoint` and `window.selectedMultiplePoints` exposure
   - Lines ~3408-3432: Added `setSelectionFromTreeView()` setter function
   - Line ~533: Exposed setter to window
2. `src/draw/canvas3DDrawSelection.js` (lines 111, 133): Reduced sphere radius 5m → 0.5m
3. `src/dialog/tree/TreeView.js` (lines ~838-897): Updated to use setter function

## Testing Required
- [x] 2D: Canvas clicks still work (NOT BROKEN) ✅
- [ ] 2D: Click vertex in TreeView → Pink circle appears on canvas
- [ ] 2D: Click entity in TreeView → Green highlight, no pink circle
- [ ] 3D: Click vertex in TreeView → Pink sphere appears on canvas
- [ ] 3D: Click entity in TreeView → Green highlight, no pink sphere
- [ ] 3D: Click vertex on canvas → Pink sphere appears (correctly sized)
- [ ] 3D: Click segment on canvas → No pink sphere
- [ ] 3D: Click different vertex → Old pink sphere disappears, new one appears
- [ ] 3D: Click entity after vertex → Pink sphere disappears

