# AI Commentary: Contour Update on Connector Addition Fix
**Date:** 2025-12-26 09:30 AWST  
**Session Focus:** Fixing contours and direction arrows not updating when connectors are added

---

## Issue Reported

User reported that contours and direction arrows do not update immediately when using the connector tool (both single and multi-connector) in 2D and 3D modes. The contours would only update when zooming or panning the view.

---

## Root Cause Analysis

The contour rendering in Kirra2D uses an overlay canvas system (`contourOverlayCanvas`) for smooth pan/zoom performance. The function `updateOverlayColorsForTheme()` is responsible for redrawing the contour overlay by calling `drawContoursOnOverlayFixed()`.

### The Problem

The connector tool code paths were missing the `updateOverlayColorsForTheme()` call after recalculating contours:

**Working code (throttledRecalculateContours at line ~6549):**
```javascript
var result = recalculateContours(allBlastHoles, 0, 0);
contourLinesArray = result.contourLinesArray;
directionArrows = result.directionArrows;
updateOverlayColorsForTheme();  // <-- This was present
drawData(allBlastHoles, selectedHole);
```

**Broken code (connector tools):**
```javascript
const result = recalculateContours(allBlastHoles, deltaX, deltaY);
contourLinesArray = result.contourLinesArray;
directionArrows = result.directionArrows;
// updateOverlayColorsForTheme() was MISSING here!
debouncedSaveHoles();
timeChart();
drawData(allBlastHoles, selectedHole);
```

### Why Zoom/Pan Worked

The zoom and pan handlers explicitly call `updateOverlayColorsForTheme()`:
- **Zoom:** Line ~6154
- **Pan:** Line ~6769

This is why contours would appear correct after zooming or panning - those actions trigger the overlay redraw that was missing from the connector code.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/kirra.js` | Added `updateOverlayColorsForTheme()` to 5 locations |

### Specific Locations Fixed

1. **3D Single Connector Tool** (line ~1306)
   - After `recalculateContours()` in the 3D click handler

2. **3D Multi-Connector Tool** (line ~1367)
   - After `recalculateContours()` in the 3D multi-connector click handler

3. **connectHolesInLine() Function** (line ~16149)
   - Used by both 2D and 3D multi-connector tools

4. **2D handleConnectorClick - Single** (line ~16050)
   - Single connector mode in 2D

5. **2D handleConnectorClick - Multi** (line ~16081)
   - Multi-connector mode in 2D

---

## Technical Details

### The Overlay System

The contour overlay uses a separate canvas (`contourOverlayCanvas`) that sits on top of the main canvas. This architecture provides:
- Smooth pan/zoom without recalculating contours on every frame
- Separate rendering layer for contour styling

### Call Chain

```
updateOverlayColorsForTheme()
    └── drawContoursOnOverlayFixed()
            └── drawBrightContoursFixed()
                    └── Draws contour lines to overlay canvas
```

When `useContourOverlay` is true, the main `drawData()` function skips 2D contour drawing (line ~21255) because the overlay handles it. This means without the overlay update call, contours never redraw after connector changes.

---

## Testing Checklist

- [ ] 2D single connector: contours update immediately after second hole click
- [ ] 2D multi-connector: contours update immediately after connection created
- [ ] 3D single connector: contours update immediately after second hole click
- [ ] 3D multi-connector: contours update immediately after connection created
- [ ] Direction arrows also update with contours
- [ ] Contours still update correctly on zoom/pan (regression test)

---

## Lessons Learned

1. **Consistency in code patterns**: When a function call is needed in one code path (like `throttledRecalculateContours`), it's likely needed in similar code paths (like direct connector handling).

2. **Overlay systems need explicit updates**: Unlike direct canvas drawing where `drawData()` handles everything, overlay systems require explicit refresh calls when underlying data changes.

3. **Follow the working code**: The zoom/pan code showed the correct pattern - `updateOverlayColorsForTheme()` after contour recalculation. The connector code should have mirrored this pattern.

---

## Related Files

- Previous fix: `src/aiCommentary/20251225-2045-3D_Contours_Arrows_Complete_Fix.md`
- Contour overlay: `drawContoursOnOverlayFixed()` at line ~39981
- Theme update: `updateOverlayColorsForTheme()` at line ~40175

