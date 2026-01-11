# Critical Bugfix: getSnapRadiusInWorldUnits3D ReferenceError

**Date**: 2025-12-20  
**Time**: 19:50  
**Severity**: 🔴 CRITICAL - App won't load  
**Status**: ✅ Fixed

## Error

```
kirra.js:421 Uncaught ReferenceError: getSnapRadiusInWorldUnits3D is not defined
    at kirra.js:421:38
```

## Root Cause

**Problem**: Function exposure happened before function definition

**Line 421** (WRONG - Too early):
```javascript
// Expose globals for canvas3DDrawing.js module
window.worldToThreeLocal = worldToThreeLocal;
window.worldToScreen = worldToScreen;
window.getSnapRadiusInWorldUnits3D = getSnapRadiusInWorldUnits3D; // ❌ Function not defined yet!
```

**Line 36575** (Function definition):
```javascript
function getSnapRadiusInWorldUnits3D(pixelRadius) {
    // ... 43 lines of code ...
}
```

**Issue**: The exposure on line 421 happens in the initialization phase, before the parser reaches the function definition on line 36575. While JavaScript function declarations are hoisted, the assignment to `window.*` happens at runtime in order, causing the ReferenceError.

## Fix Applied

### 1. Removed premature exposure (Line 421)
**Changed**:
```javascript
// Expose globals for canvas3DDrawing.js module
window.worldToThreeLocal = worldToThreeLocal;
window.worldToScreen = worldToScreen;
// Note: getSnapRadiusInWorldUnits3D exposed near its definition (line ~36617)
```

### 2. Added exposure after function definition (Line 36620)
**Added**:
```javascript
function getSnapRadiusInWorldUnits3D(pixelRadius) {
    // ... function body ...
}

// Expose for canvas3DDrawing.js module
window.getSnapRadiusInWorldUnits3D = getSnapRadiusInWorldUnits3D;
```

## Why This Happened

This exposure was likely added during development to make the function available to the `canvas3DDrawing.js` module, and was placed near other similar exposures (`worldToThreeLocal`, `worldToScreen`) without checking if the function was defined nearby.

The functions `worldToThreeLocal` and `worldToScreen` are defined immediately above (lines 384-416), so their exposures work fine. But `getSnapRadiusInWorldUnits3D` is defined much later in the file (36575), causing the error.

## Impact

**Before Fix**: 🔴 **App completely broken** - JavaScript execution stopped at line 421, preventing app from loading

**After Fix**: ✅ **App loads normally** - Function properly exposed after definition

## Files Modified

- **src/kirra.js**:
  - Line 421: Removed premature exposure, added comment
  - Line 36620: Added exposure after function definition
  - Net change: +3 lines (1 removed, 4 added)

## Testing

- [x] Verify app loads without errors
- [x] Verify no `ReferenceError` in console
- [x] Verify 3D functionality works (snapping uses this function)

## Summary

Fixed critical ReferenceError that prevented app from loading by moving the `window.getSnapRadiusInWorldUnits3D` exposure from line 421 (before definition) to line 36620 (after definition).

**Key Lesson**: When exposing functions globally, always ensure they are defined before the exposure statement, or place exposures at the end of the file.

