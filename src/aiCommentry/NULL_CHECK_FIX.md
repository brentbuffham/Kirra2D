# Null Check Fix for allBlastHoles

## Problem

When refreshing the page or zooming before holes are loaded, the application threw an error:

```
Uncaught TypeError: can't access property "length", allBlastHoles is null
    <anonymous> kirra.js:3607
```

This occurred during:

-   Page refresh/initial load
-   Zoom operations (mouse wheel)
-   Pan/drag operations

## Root Cause

The code was attempting to access `allBlastHoles.length` without first checking if `allBlastHoles` was `null` or `undefined`. On page load or before any holes are loaded, `allBlastHoles` is `null`, causing the error.

## Solution

Added null checks before accessing `allBlastHoles.length` in event handlers that can fire before holes are loaded.

### Changes Made

**File**: `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/kirra.js`

#### 1. Zoom Event Handler (Line 3607)

**Before**:

```javascript
if (allBlastHoles.length > 0) {
    const result = recalculateContours(allBlastHoles, deltaX, deltaY);
    // ...
}
```

**After**:

```javascript
if (allBlastHoles && allBlastHoles.length > 0) {
    const result = recalculateContours(allBlastHoles, deltaX, deltaY);
    // ...
}
```

#### 2. Pan/Drag Event Handler (Line 4045)

**Before**:

```javascript
if (allBlastHoles.length > 0 && (displayContours.checked || displayFirstMovements.checked)) {
    const result = recalculateContours(allBlastHoles, deltaX, deltaY);
    // ...
}
```

**After**:

```javascript
if (allBlastHoles && allBlastHoles.length > 0 && (displayContours.checked || displayFirstMovements.checked)) {
    const result = recalculateContours(allBlastHoles, deltaX, deltaY);
    // ...
}
```

## How It Works

### JavaScript Short-Circuit Evaluation

The condition `allBlastHoles && allBlastHoles.length > 0` uses short-circuit evaluation:

1. **First check**: `allBlastHoles` - If `null` or `undefined`, stops here and returns `false`
2. **Second check**: `allBlastHoles.length > 0` - Only evaluates if first check passed

This prevents the `TypeError` by ensuring `allBlastHoles` exists before trying to access its `length` property.

### When allBlastHoles is null

-   On initial page load
-   After clearing all holes
-   Before importing/loading any data
-   During error recovery

In all these cases, the code now safely skips contour recalculation instead of crashing.

## Testing

1. **Fresh page load**:

    - Open the app
    - Try zooming with mouse wheel
    - Try panning/dragging
    - Should work without errors

2. **After clearing holes**:

    - Load holes
    - Clear all holes
    - Try zooming/panning
    - Should work without errors

3. **Normal operation**:
    - Load holes
    - Zoom/pan normally
    - Contours should still recalculate correctly

## Related Code

### Other Safe Checks

Many other places in the code already have proper null checks:

```javascript
if (allBlastHoles && Array.isArray(allBlastHoles) && allBlastHoles.length > 0)
```

### Future Prevention

When accessing `allBlastHoles.length` or any property, always check for null first:

-   ✅ `if (allBlastHoles && allBlastHoles.length > 0)`
-   ✅ `if (allBlastHoles?.length > 0)` (optional chaining)
-   ❌ `if (allBlastHoles.length > 0)` (will throw if null)

## Performance Impact

**None** - The additional null check is virtually instant and prevents crashes.

## Status

✅ **FIXED** - Application no longer crashes on zoom/pan when no holes are loaded.
