# Context Menu Global Variable Fixes - CORRECTED
**Date**: 2025-11-30 16:15
**Status**: ✅ FIXED

## Problem

Application was completely broken due to exposing non-existent functions in `exposeGlobalsToWindow()`:

```
Uncaught ReferenceError: calculateAllHoleDelays is not defined
Uncaught ReferenceError: generateDelayColorRamp is not defined
Uncaught ReferenceError: updateHoleMeshes is not defined
```

## Root Cause

I made a critical error by adding function exposures **WITHOUT VERIFYING** they existed in kirra.js:
- `calculateAllHoleDelays` - DOES NOT EXIST
- `generateDelayColorRamp` - DOES NOT EXIST  
- `updateHoleMeshes` - DOES NOT EXIST
- `autoCalculateTimingEnabled` - DOES NOT EXIST
- `drawingZLevel` - DOES NOT EXIST

## Solution Applied

### Step 1: Removed Non-Existent Function Exposures (kirra.js lines 432-445)

**BEFORE (BROKEN):**
```javascript
window.calculateHoleGeometry = calculateHoleGeometry;
window.calculateAllHoleDelays = calculateAllHoleDelays; // ❌ DOESN'T EXIST
window.generateDelayColorRamp = generateDelayColorRamp; // ❌ DOESN'T EXIST
window.updateHoleMeshes = updateHoleMeshes; // ❌ DOESN'T EXIST
window.autoCalculateTimingEnabled = autoCalculateTimingEnabled; // ❌ DOESN'T EXIST
window.drawingZLevel = drawingZLevel; // ❌ DOESN'T EXIST
```

**AFTER (FIXED):**
```javascript
// Step 6f) ONLY expose functions that actually exist in kirra.js
window.calculateHoleGeometry = calculateHoleGeometry; // ✅ EXISTS at line 20515
window.debouncedSaveHoles = debouncedSaveHoles; // ✅ EXISTS at line 23703
window.debouncedSaveKAD = debouncedSaveKAD; // ✅ EXISTS at line 23550
window.clearAllSelectionState = clearAllSelectionState; // ✅ EXISTS at line 2982
window.setKADEntityVisibility = setKADEntityVisibility; // ✅ EXISTS at line 24137
window.setSurfaceVisibility = setSurfaceVisibility; // ✅ EXISTS at line 24031
window.showSurfaceLegend = showSurfaceLegend; // ✅ EXISTS at line 33511
window.deleteSurfaceFromDB = deleteSurfaceFromDB; // ✅ EXISTS at line 24274
window.deleteAllSurfacesFromDB = deleteAllSurfacesFromDB; // ✅ EXISTS at line 24309
window.saveSurfaceToDB = saveSurfaceToDB; // ✅ EXISTS at line 23709
window.deleteImageFromDB = deleteImageFromDB; // ✅ EXISTS at line 24510
window.deleteAllImagesFromDB = deleteAllImagesFromDB; // ✅ EXISTS at line 24544
```

### Step 2: Commented Out Non-Existent Function Calls (HolesContextMenu.js lines 523-538)

```javascript
// Step 12) Trigger updates
if (timingChanged) {
    // Note: calculateAllHoleDelays and generateDelayColorRamp don't exist yet
    // TODO: Implement or remove these function calls
    // if (window.autoCalculateTimingEnabled) {
    // 	window.calculateAllHoleDelays();
    // }
    // window.generateDelayColorRamp();
}

if (geometryChanged) {
    // Update 3D meshes if in 3D mode
    // Note: updateHoleMeshes doesn't exist yet
    // TODO: Implement or remove this function call
    // if (window.onlyShowThreeJS && window.threeInitialized) {
    // 	window.updateHoleMeshes(holes);
    // }
}
```

## Key Learning

**ALWAYS verify a function exists before exposing it to window.**

Use grep to confirm:
```bash
grep "^function functionName" kirra.js
grep "^const functionName" kirra.js
grep "^let functionName" kirra.js
grep "^var functionName" kirra.js
```

## Files Modified

1. **kirra.js** (lines 432-445)
   - Removed 5 non-existent function exposures
   - Kept only verified existing functions

2. **HolesContextMenu.js** (lines 523-538)
   - Commented out calls to non-existent functions
   - Added TODO notes for future implementation

## Status

✅ Application should now load without ReferenceErrors
✅ Context menus will appear (though some features disabled)
⚠️ 3D mesh updates and timing calculations temporarily disabled until functions are implemented

