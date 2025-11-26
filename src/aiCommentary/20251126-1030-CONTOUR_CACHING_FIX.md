# Contour Caching and 2D/3D Separation Fix

**Date**: 2025-11-26 10:30  
**Issue**: 2D contours rendering over 3D, contours not appearing until relief button pressed, contour performance issues during drag

## Problems Identified

### 1. 2D Contour Overlay Showing in 3D Mode
The `drawContoursOnOverlayFixed()` function was drawing on the 2D overlay canvas even when in 3D-only mode (`onlyShowThreeJS = true`).

### 2. Contours Only Appearing After Relief Button Press
The `recalculateContours()` function was gated by display options check at the top:
```javascript
if (!displayContours.checked && !displayFirstMovements.checked && !displayRelief.checked) {
    return { contourLinesArray: [], directionArrows: [] };
}
```
This meant contours weren't calculated until one of these options was enabled.

### 3. Contours Not Syncing During Drag
Contours were being recalculated on every draw call, causing performance issues and lag during pan/drag operations.

## Solutions Implemented

### Fix 1: Guard 2D Overlay in 3D Mode
**File**: `src/kirra.js` (line ~43434)

Added check in `drawContoursOnOverlayFixed()`:
```javascript
// Step 6.1) Don't draw 2D contour overlay when in 3D-only mode
if (onlyShowThreeJS) {
    contourOverlayCtx.clearRect(0, 0, contourOverlayCanvas.width, contourOverlayCanvas.height);
    return;
}
```

### Fix 2: Contour Caching System
**File**: `src/kirra.js` (lines ~2346-2349)

Added cache variables:
```javascript
let cachedContourHash = null;
let cachedContourLinesArray = [];
let cachedDirectionArrows = [];
```

Added helper functions:
- `computeContourHash(holes)` - Creates hash from hole positions and times
- `invalidateContourCache()` - Clears cache when holes change
- `forceRecalculateContours(blastHoles)` - Calculates contours regardless of display options

### Fix 3: Pre-calculate Contours on Load
**File**: `src/kirra.js` (line ~22914)

When holes are loaded from IndexedDB, contours are now pre-calculated and cached:
```javascript
// Force pre-calculate contours regardless of display options
invalidateContourCache();
var forceCalcResult = forceRecalculateContours(allBlastHoles);
contourLinesArray = forceCalcResult.contourLinesArray;
directionArrows = forceCalcResult.directionArrows;
```

### Fix 4: Use Cache in Throttled Recalculate
**File**: `src/kirra.js` (line ~5703)

`throttledRecalculateContours()` now checks cache first:
```javascript
if (cachedContourLinesArray && cachedContourLinesArray.length > 0) {
    contourLinesArray = cachedContourLinesArray;
    directionArrows = cachedDirectionArrows;
} else {
    var result = recalculateContours(allBlastHoles, 0, 0);
    // ...
}
```

### Fix 5: Cache-Aware Recalculate
**File**: `src/kirra.js` (line ~19830)

`recalculateContours()` now:
1. Returns cached results if display options are off but cache exists
2. Computes hash to check if recalculation is needed
3. Returns cached results on cache hit
4. Only recalculates on cache miss

## Performance Benefits

1. **Immediate Display**: Contours appear immediately when display option is enabled (from cache)
2. **No Lag on Pan/Drag**: Contours don't recalculate during drag - cache is reused
3. **Smart Invalidation**: Cache only invalidates when hole positions or times actually change

## Cache Invalidation
The cache should be invalidated when:
- Holes are added/deleted
- Hole positions change (move tool)
- Hole times change (connector tool)

Call `invalidateContourCache()` in these scenarios.

