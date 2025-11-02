# Kirra.js Refactoring Progress

## Objective
Reduce kirra.js file size from 41,413 lines to improve editor performance and maintainability by extracting drawing functions into separate modules.

## Status: Phase 1 & 2 Complete ✅ | Core Functions Extracted

---

## Phase 1: Three.js Drawing Functions ✅ COMPLETE

### What Was Done

#### 1. Created Module: `src/draw/canvas3DDrawing.js` (315 lines)
**Status**: ✅ **Complete, Tested, and Working**

**Extracted Functions** (15 total):
- `clearThreeJS()` - Clear 3D scene
- `renderThreeJS()` - Render 3D  
- `drawHoleThreeJS()` - Draw complete hole in 3D
- `drawHoleToeThreeJS()` - Draw toe in 3D
- `drawHoleTextThreeJS()` - Draw hole label text
- `drawHoleTextsAndConnectorsThreeJS()` - Draw all hole labels
- `drawKADPointThreeJS()` - KAD points in 3D
- `drawKADLineThreeJS()` - KAD lines in 3D
- `drawKADPolygonThreeJS()` - KAD polygons in 3D
- `drawKADCircleThreeJS()` - KAD circles in 3D
- `drawKADTextThreeJS()` - KAD text in 3D
- `drawSurfaceThreeJS()` - Surfaces in 3D
- `drawContoursThreeJS()` - Contours in 3D
- `drawDirectionArrowsThreeJS()` - Direction arrows in 3D
- `drawBackgroundImageThreeJS()` - Background images in 3D

#### 2. Updated kirra.js
- ✅ Added imports for all 3D functions (lines 35-51)
- ✅ Removed old 3D function definitions (replaced with comment at line 12098)
- ✅ Created `exposeGlobalsToWindow()` function to sync globals to window object
- ✅ Added `window.worldToThreeLocal` exposure
- ✅ Called `exposeGlobalsToWindow()` in `drawData()` before rendering

#### 3. Global Access Solution
**Problem**: Module functions couldn't access kirra.js globals  
**Solution**: Expose globals via `window` object
```javascript
// In kirra.js
function exposeGlobalsToWindow() {
	window.threeInitialized = threeInitialized;
	window.threeRenderer = threeRenderer;
	window.holeScale = holeScale;
	// ...etc
}

// In canvas3DDrawing.js
if (!window.threeInitialized || !window.threeRenderer) return;
```

### Results
- **kirra.js**: 41,179 lines (down from 41,413)  
- **canvas3DDrawing.js**: 315 lines
- **Net reduction**: 234 lines from main file
- **Build status**: ✅ Successful
- **Runtime status**: ✅ Working correctly

---

## Phase 2: 2D Canvas Drawing Functions ✅ CORE COMPLETE

### What Was Done

#### 1. Created Module: `src/draw/canvas2DDrawing.js` (284 lines)
**Status**: ✅ **Complete, Build Successful**

**Extracted Functions** (17 core functions):
- `clearCanvas()` - Clear 2D canvas
- `drawText()`, `drawRightAlignedText()`, `drawMultilineText()` - Text rendering
- `drawTrack()` - Hole track lines with subdrill indicators
- `drawHoleToe()`, `drawHole()` - Basic hole shapes
- `drawDummy()`, `drawNoDiameterHole()` - Special hole markers
- `drawHiHole()`, `drawExplosion()`, `drawHexagon()` - Specialized shapes
- `drawKADPoints()`, `drawKADLines()`, `drawKADPolys()` - KAD geometry
- `drawKADCircles()`, `drawKADTexts()` - KAD circles and text

#### 2. Updated kirra.js
- ✅ Added imports for all 17 core 2D functions (line 36)
- ✅ Updated `exposeGlobalsToWindow()` with 2D globals (ctx, canvas, etc.)
- ✅ Removed old function definitions from kirra.js
- ✅ All functions now access globals via `window` object

### Results
- **kirra.js**: 40,956 lines (down from 41,179)
- **canvas2DDrawing.js**: 284 lines
- **Net reduction**: 223 lines from main file
- **Build status**: ✅ Successful
- **Runtime status**: ⏳ Pending browser test

---

### Remaining 2D Functions (Not Yet Extracted)

**Target**: ~41 additional functions, ~2,700 lines

### Target Functions by Category

#### A. Hole Drawing Functions (10 functions, ~250 lines)
**Lines 12506-12659 in kirra.js**
```javascript
- drawTrack(lineStartX, lineStartY, lineEndX, lineEndY, gradeX, gradeY, strokeColor, subdrillAmount)
- drawHoleToe(x, y, fillColor, strokeColor, radius)
- drawHole(x, y, radius, fillColor, strokeColor)
- drawDummy(x, y, radius, strokeColor)
- drawNoDiameterHole(x, y, sideLength, strokeColor)
- drawHiHole(x, y, radius, fillColor, strokeColor)
- drawExplosion(x, y, spikes, outerRadius, innerRadius, color1, color2)
- drawHexagon(x, y, sideLength, fillColor, strokeColor)
- drawHoleMainShape(hole, x, y, selectedHole)  // Line 19415
- drawHoleTextsAndConnectors(hole, x, y, lineEndX, lineEndY, ctxObj)  // Line 19270
```

#### B. Text Drawing Functions (3 functions, ~60 lines)
**Lines 12661-12710 in kirra.js**
```javascript
- drawText(x, y, text, color)
- drawRightAlignedText(x, y, text, color)
- drawMultilineText(ctx, text, x, y, lineHeight, alignment, textColor, boxColor, showBox)
```

#### C. KAD Drawing Functions (13 functions, ~400 lines)
**Lines 12089-12176 and 19130-19202 in kirra.js**
```javascript
- drawKADPoints(x, y, z, lineWidth, strokeColor)
- drawKADLines(sx, sy, ex, ey, sz, ez, lineWidth, strokeColor)
- drawKADPolys(sx, sy, ex, ey, sz, ez, lineWidth, strokeColor, isClosed)
- drawKADCircles(x, y, z, radius, lineWidth, strokeColor)
- drawKADTexts(x, y, z, text, color)
- drawKADCoordinates(kadPoint, screenX, screenY)  // Line 19176
- drawKADPreviewLine(ctx)  // Line 12270
- drawKADTESTPreviewLine(ctx)  // Line 12454
- drawKADPolyUnified(points)  // Line 12176
- drawPolyPath(pathPoints, closed)  // Line ~12381
- drawPolygonSelection(ctx)  // Line ~12410
- drawKADPolygonHighlightSelectedVisuals()  // Line 29130
- drawKADHighlightSelectionVisuals()  // Line 29202
- drawAllKADSelectionVisuals()  // Line 12136
```

#### D. Arrow/Connector Functions (3 functions, ~350 lines)
**Lines 12712-13091 in kirra.js**
```javascript
- drawDirectionArrow(startX, startY, endX, endY, fillColor, strokeColor, connScale)
- drawArrow(startX, startY, endX, endY, color, connScale, connectorCurve)
- drawArrowDelayText(startX, startY, endX, endY, color, text, connectorCurve)
```

#### E. Surface Drawing Functions (8 functions, ~1,200 lines)
**Lines 30620-31589 in kirra.js**
```javascript
- drawSurface()  // Line 30620
- drawSurfaceLegend()  // Line 30664
- drawTriangleWithGradient(triangle, surfaceMinZ, surfaceMaxZ, targetCtx, alpha, gradient, gradientMethod, lightBearing, lightElevation)
- drawLinearGradientTriangle(...)  // Line 31128
- drawRadialGradientTriangle(...)  // Line 31209
- drawBarycentricGradientTriangle(...)  // Line 31261
- drawBackgroundImage()  // Line 32885
- drawBlastBoundary(polygon, strokeColor)  // Line 11935
```

#### F. Analysis/Overlay Functions (8 functions, ~800 lines)
**Lines 10012-13392 in kirra.js**
```javascript
- drawVoronoiMetric(metrics, metricName, getColorForMetric)  // Line 10012
- drawVoronoiLegendAndCells(...)  // Line 19206
- drawDelauanySlopeMap(triangles, centroid, strokeColor)  // Line 12919
- drawDelauanyBurdenRelief(triangles, centroid, strokeColor)  // Line 13033
- drawTriangleAngleText(triangle, centroid, strokeColor)  // Line 13211
- drawTriangleBurdenReliefText(triangle, centroid, strokeColor)  // Line 13218
- drawLegend(strokecolor)  // Line 18166
- drawReliefLegend(strokecolor)  // Line 13151
```

#### G. Tool/Helper Functions (8 functions, ~400 lines)
**Lines 13380-32885 in kirra.js**
```javascript
- drawMousePosition(x, y)  // Line 13380
- drawMouseCrossHairs(mouseX, mouseY, snapRadiusPixels, showSnapRadius, showMouseLines)  // Line 18258
- drawSnapHighlight()  // Line 32590
- drawRuler(startX, startY, startZ, endX, endY, endZ)  // Line 26684
- drawProtractor(p1X, p1Y, p2X, p2Y, p3X, p3Y)  // Line ~27088
- drawPatternInPolygonVisual()  // Line ~29083
- drawPatternOnPolylineVisual()  // Line ~29297
- drawHolesAlongLineVisuals()  // Line 29654
```

#### H. Contour Functions (5 functions, ~300 lines)
**Lines 40463-40710 in kirra.js**
```javascript
- drawContoursOnOverlayFixed()  // Line 40463
- drawBrightContoursFixed()  // Line 40478
- drawAlternatingDashLine(x1, y1, x2, y2)  // Line 40549
- drawTimeLabelFixed(x, y, text, color)  // Line 40590
- drawTestContourLine()  // Line 40710
```

#### I. Canvas Utility (2 functions)
```javascript
- clearCanvas()  // Line 12076
- drawConnectStadiumZone(sx, sy, endX, endY, connectAmount)  // Line 19350
```

---

## Implementation Guide for Phase 2

### Step 1: Create Module Skeleton
Create `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/draw/canvas2DDrawing.js`:

```javascript
/* prettier-ignore-file */
//=================================================
// canvas2DDrawing.js - 2D Canvas Drawing Functions
//=================================================

// These functions access globals via window object:
// - ctx, canvas, currentScale, currentFontSize
// - strokeColor, fillColor, textFillColor, depthColor, angleDipColor
// - holeScale, toeSizeInMeters, connScale, firstMovementSize
// - darkModeEnabled, displayOptions, worldToCanvas()
// - selectedHole, selectedMultipleHoles, fromHoleStore, etc.

//=================================================
// Canvas Utilities
//=================================================

export function clearCanvas() {
	window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
}

//=================================================
// Hole Drawing Functions
//=================================================

export function drawTrack(lineStartX, lineStartY, lineEndX, lineEndY, gradeX, gradeY, strokeColor, subdrillAmount) {
	// ... paste function body from kirra.js, replace ctx with window.ctx
}

// ... continue for all functions
```

### Step 2: Update kirra.js Imports
Add after line 51 (after 3D imports):

```javascript
import {
	clearCanvas,
	drawTrack,
	drawHoleToe,
	drawHole,
	drawDummy,
	drawNoDiameterHole,
	drawHiHole,
	drawExplosion,
	drawHexagon,
	drawText,
	drawRightAlignedText,
	drawMultilineText,
	drawKADPoints,
	drawKADLines,
	drawKADPolys,
	drawKADCircles,
	drawKADTexts,
	drawKADCoordinates,
	drawKADPreviewLine,
	drawKADTESTPreviewLine,
	drawKADPolyUnified,
	drawPolyPath,
	drawPolygonSelection,
	drawAllKADSelectionVisuals,
	drawKADPolygonHighlightSelectedVisuals,
	drawKADHighlightSelectionVisuals,
	drawDirectionArrow,
	drawArrow,
	drawArrowDelayText,
	drawSurface,
	drawSurfaceLegend,
	drawTriangleWithGradient,
	drawLinearGradientTriangle,
	drawRadialGradientTriangle,
	drawBarycentricGradientTriangle,
	drawBackgroundImage,
	drawBlastBoundary,
	drawVoronoiMetric,
	drawVoronoiLegendAndCells,
	drawDelauanySlopeMap,
	drawDelauanyBurdenRelief,
	drawTriangleAngleText,
	drawTriangleBurdenReliefText,
	drawLegend,
	drawReliefLegend,
	drawMousePosition,
	drawMouseCrossHairs,
	drawSnapHighlight,
	drawRuler,
	drawProtractor,
	drawPatternInPolygonVisual,
	drawPatternOnPolylineVisual,
	drawHolesAlongLineVisuals,
	drawContoursOnOverlayFixed,
	drawBrightContoursFixed,
	drawAlternatingDashLine,
	drawTimeLabelFixed,
	drawTestContourLine,
	drawConnectStadiumZone,
	drawHoleMainShape,
	drawHoleTextsAndConnectors,
} from "./draw/canvas2DDrawing.js";
```

### Step 3: Expose Additional Globals
Update `exposeGlobalsToWindow()` in kirra.js to include:

```javascript
function exposeGlobalsToWindow() {
	// Existing...
	window.threeInitialized = threeInitialized;
	window.threeRenderer = threeRenderer;
	// ... existing globals ...
	
	// Add for 2D drawing:
	window.ctx = ctx;
	window.canvas = canvas;
	window.strokeColor = strokeColor;
	window.fillColor = fillColor;
	window.transparentFillColor = transparentFillColor;
	window.toeSizeInMeters = toeSizeInMeters;
	window.connScale = connScale;
	window.firstMovementSize = firstMovementSize;
	window.worldToCanvas = worldToCanvas;
	window.selectedHole = selectedHole;
	window.selectedMultipleHoles = selectedMultipleHoles;
	window.fromHoleStore = fromHoleStore;
	window.firstSelectedHole = firstSelectedHole;
	window.secondSelectedHole = secondSelectedHole;
	window.isAddingConnector = isAddingConnector;
	window.isAddingMultiConnector = isAddingMultiConnector;
}
```

### Step 4: Replace Global References in Extracted Functions
In canvas2DDrawing.js, replace all direct global access with `window.`:
- `ctx` → `window.ctx`
- `currentScale` → `window.currentScale`
- `currentFontSize` → `window.currentFontSize`
- `strokeColor` → `window.strokeColor`
- etc.

### Step 5: Remove Old Functions from kirra.js
After extraction, replace function bodies with comments:
```javascript
// Note: Drawing functions moved to src/draw/canvas2DDrawing.js
```

### Step 6: Test
```bash
cd /Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D
npm run build
# Then test in browser
```

---

## Expected Results After Phase 2

### File Sizes
- **kirra.js**: ~37,500 lines (down ~3,500 from 41,179)
- **canvas3DDrawing.js**: 315 lines
- **canvas2DDrawing.js**: ~3,500 lines (new)
- **Total reduction**: ~10% of main file extracted

### Benefits
- ✅ Improved editor performance
- ✅ Better code organization
- ✅ Easier to find functions
- ✅ Clearer dependencies via imports

---

## Phase 3: Print Functions (Deferred)

**Status**: 📦 **Pending** (Complex dependencies)

**Scope**: 39+ functions, 2,455 lines  
**Location**: Lines 33827-36281 in kirra.js

**Reason for Deferral**: Print functions have complex interdependencies with many global variables and internal helper functions. Best completed after 2D extraction when patterns are well-established.

---

## Quick Reference: Current State

```
✅ Phase 1: 3D Functions → COMPLETE (295 lines extracted)
✅ Phase 2: 2D Core Functions → COMPLETE (284 lines extracted)
🔄 Phase 2b: Remaining 2D Functions → PENDING (~41 functions, ~2,700 lines)
📦 Phase 3: Print Functions → DEFERRED (39 functions, 2,455 lines)
```

**Original kirra.js**: 41,413 lines  
**After Phase 1**: 41,179 lines (↓ 234)  
**After Phase 2 (Core)**: 40,956 lines (↓ 457 total)  
**Target after Phase 2b**: ~38,000 lines  
**Final target after Phase 3**: ~35,500 lines  

---

## Notes

- All extracted functions use `window.globalName` to access kirra.js globals
- `exposeGlobalsToWindow()` is called before each render to ensure fresh values
- Build and runtime tests confirm Phase 1 is working correctly
- This refactoring maintains full backward compatibility

**Last Updated**: Phase 1 & 2 (Core) complete, build successful ✅ (Pending browser test)
