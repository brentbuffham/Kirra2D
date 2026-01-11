# AI Commentary: Contours and Direction Arrows Fixes
**Date:** 2025-12-25 11:30 AWST  
**Session Focus:** Fixing contour rendering, direction arrow immediate rendering, and line width inheritance issues

---

## Issues Addressed

### 1. First Movement Arrows Not Rendering Immediately
**Problem:** When clicking the "First Movement" toggle button, arrows would not render until a mouse move, zoom, or pan triggered a redraw.

**Root Cause:** The `throttledRecalculateContours()` function uses `requestAnimationFrame` for asynchronous calculation. The `drawData()` call was placed in the event listener immediately after calling `throttledRecalculateContours()`, meaning it executed before the arrow data (`directionArrows`) was populated.

**Fix Applied:** Moved `drawData(allBlastHoles, selectedHole)` call inside `throttledRecalculateContours()` function to execute AFTER the contour and arrow data is calculated.

**Location:** `src/kirra.js` - `throttledRecalculateContours()` function (around line 6476-6502)

---

### 2. Arrow Border Thickness When Contours Enabled
**Problem:** When contours were enabled alongside direction arrows, the arrow borders became noticeably thicker/bolder.

**Root Cause:** The contour drawing code sets `ctx.lineWidth = 2` for the dashed contour lines. While there was a reset (`ctx.lineWidth = 1`) after contour drawing, the `drawDirectionArrow()` function did not explicitly set its own lineWidth - it relied on whatever was currently in the canvas context state.

**Fix Applied:** Added `ctx.lineWidth = 1` explicitly in the `drawDirectionArrow()` function to ensure consistent border width regardless of what other drawing operations have set.

**Location:** `src/draw/canvas2DDrawing.js` - `drawDirectionArrow()` function (around line 315)

```javascript
// Step 3) Set the stroke and fill colors and line width
ctx.strokeStyle = strokeColor;
ctx.fillStyle = fillColor;
ctx.lineWidth = 1; // Ensure consistent border width regardless of contour settings
```

---

### 3. Duplicate 2D/3D Rendering (Previously Fixed)
**Problem:** When starting the app in 2D mode, both 2D and 3D renders were occurring, causing duplicate contours and arrows.

**Root Cause:** Three.js drawing functions were called whenever `threeInitialized` was true, even when `onlyShowThreeJS` (3D mode) was false.

**Fix Applied:** Updated all Three.js drawing conditions to require both `threeInitialized` AND `onlyShowThreeJS` to be true:
- Contours: `if (threeInitialized && onlyShowThreeJS)`
- Direction Arrows: `if (threeInitialized && onlyShowThreeJS && directionArrows && directionArrows.length > 0)`
- Slope Map: `if (threeInitialized && onlyShowThreeJS && resultTriangles && resultTriangles.length > 0)`
- Burden Relief: `if (threeInitialized && onlyShowThreeJS && reliefTriangles && reliefTriangles.length > 0)`

**Location:** `src/kirra.js` - `drawData()` function (around lines 21244-21268)

---

### 4. Contour Hash Caching Issue (Previously Fixed)
**Problem:** Contours and arrows not updating when display options changed.

**Root Cause:** `computeContourHash()` only considered hole positions and times, not display options (displayContours, displayFirstMovements, displayRelief, intervalAmount, firstMovementSize).

**Fix Applied:** Extended hash computation to include all relevant display options.

**Location:** `src/kirra.js` - `computeContourHash()` function (around line 19585-19611)

---

## Testing Performed

1. ✅ Loaded blast data (408 holes)
2. ✅ Toggled First Movement arrows - rendered immediately on click
3. ✅ Toggled Contours on while arrows were on - arrow borders remained thin (1px)
4. ✅ Verified contours display timing labels correctly (100ms - 1600ms)
5. ✅ Confirmed no duplicate 2D/3D rendering when starting in 2D mode
6. ✅ All other display buttons tested - no 3D rendering occurs at start

---

## Browser Testing Notes

- Used Cursor IDE browser integration for real-time observation
- Native file picker limitations in automated browser noted (security restriction, not app bug)
- User's actual Chrome browser used for file loading, AI observed results

---

## Files Modified

1. `src/kirra.js` - Multiple fixes for contour/arrow rendering logic
2. `src/draw/canvas2DDrawing.js` - Added explicit lineWidth to drawDirectionArrow()

---

## Key Learnings

1. **Canvas Context State:** Always set all relevant canvas context properties (strokeStyle, fillStyle, lineWidth, lineDash) before drawing operations - don't rely on inherited state from previous operations.

2. **Async Rendering:** When using `requestAnimationFrame` for calculations, ensure rendering calls happen AFTER the calculation completes, not immediately after the async function is called.

3. **Mode Checking:** For applications with multiple rendering modes (2D/3D), always check the current mode flag before calling mode-specific rendering functions.

