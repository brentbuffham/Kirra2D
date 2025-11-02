# Kirra.js Refactoring Progress

## Objective
Reduce kirra.js file size from 41,413 lines to improve editor performance and maintainability by extracting drawing functions into separate modules.

## Status: Phase 1 Complete ✅

### Completed Work

#### 1. Three.js Drawing Functions → `src/draw/canvas3DDrawing.js`
**Status**: ✅ **Complete and Tested**

**Extracted**: 15 functions, ~300 lines
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

**Import added to kirra.js**: Lines 35-51
**Functions removed from kirra.js**: Lines 12099-12291 (replaced with comment)
**Build status**: ✅ Successful (tested with `npm run build`)

### Current File Sizes
- **kirra.js**: 41,172 lines (down from 41,413)  
- **canvas3DDrawing.js**: 315 lines
- **Net reduction**: 241 lines

---

## Next Steps: Phase 2 & 3

### Phase 2: 2D Drawing Functions → `src/draw/canvas2DDrawing.js`
**Status**: 🔄 **Ready to Extract**

**Target**: 58 functions, estimated ~3,000-4,000 lines

**Core Functions to Extract**:

**Hole Drawing** (~400 lines):
- `drawTrack()` - collar-to-toe track lines
- `drawHoleToe()` - toe circles  
- `drawHole()` - basic hole circle
- `drawDummy()` - X for dummy holes
- `drawNoDiameterHole()` - square for zero-diameter
- `drawHiHole()` - highlighted hole
- `drawHexagon()` - hexagonal holes
- `drawExplosion()` - explosion effect
- `drawHoleMainShape()` - main hole dispatcher
- `drawHoleTextsAndConnectors()` - hole labels/connectors

**KAD Drawing** (~400 lines):
- `drawKADPoints()` - KAD point circles
- `drawKADLines()` - KAD line segments
- `drawKADPolys()` - KAD polygons/lines
- `drawKADCircles()` - KAD circles
- `drawKADTexts()` - KAD text labels
- `drawKADCoordinates()` - coordinate labels
- `drawKADPreviewLine()` - preview during drawing
- `drawKADPolyUnified()` - unified poly drawing
- `drawPolyPath()` - polygon path
- `drawPolygonSelection()` - selection polygon
- `drawAllKADSelectionVisuals()` - all selection visuals
- `drawKADPolygonHighlightSelectedVisuals()` - highlight selected
- `drawKADHighlightSelectionVisuals()` - selection visuals

**Text Drawing** (~100 lines):
- `drawText()` - left-aligned text
- `drawRightAlignedText()` - right-aligned text
- `drawMultilineText()` - multi-line with box

**Surface Drawing** (~800 lines):
- `drawSurface()` - main surface rendering
- `drawTriangleWithGradient()` - triangle with gradient
- `drawLinearGradientTriangle()` - linear gradient
- `drawRadialGradientTriangle()` - radial gradient
- `drawBarycentricGradientTriangle()` - barycentric gradient
- `drawSurfaceLegend()` - surface color legend

**Slope/Relief/Voronoi** (~600 lines):
- `drawDelauanySlopeMap()` - slope visualization
- `drawDelauanyBurdenRelief()` - burden relief map
- `drawTriangleAngleText()` - angle labels
- `drawTriangleBurdenReliefText()` - relief labels
- `drawVoronoiLegendAndCells()` - voronoi cells + legend
- `drawVoronoiMetric()` - voronoi metric values

**Connectors/Arrows** (~300 lines):
- `drawDirectionArrow()` - direction arrows
- `drawArrow()` - curved connector arrows
- `drawArrowDelayText()` - delay text on arrows

**Legends** (~200 lines):
- `drawLegend()` - general legend
- `drawReliefLegend()` - relief legend

**Tools/Measurement** (~200 lines):
- `drawRuler()` - ruler tool
- `drawProtractor()` - protractor tool
- `drawMouseCrossHairs()` - mouse crosshairs
- `drawMousePosition()` - mouse position display
- `drawSnapHighlight()` - snap point highlight

**Contours** (~200 lines):
- `drawContoursOnOverlayFixed()` - contour overlay
- `drawBrightContoursFixed()` - bright contours
- `drawAlternatingDashLine()` - dashed contour lines
- `drawTimeLabelFixed()` - timing labels
- `drawTestContourLine()` - test contour

**Background/Boundary** (~200 lines):
- `drawBackgroundImage()` - background images
- `drawBlastBoundary()` - blast boundary polygon

**Canvas Utils** (~50 lines):
- `clearCanvas()` - clear 2D canvas

### Phase 3: Print Functions → `src/draw/canvas2DPrinting.js`
**Status**: 📦 **Deferred** (Complex dependencies)

**Target**: 39+ functions, 2,455 lines

**Main Entry Points**:
- `getPrintBoundary()` - calculate print boundary
- `drawPrintBoundary()` - draw print boundary
- `printToPDF()` - export to PDF
- `printCanvasHiRes()` - high-res printing
- `drawDataForPrinting()` - main print (WYSIWYG)
- `drawCompleteBlastDataForPrint()` - complete data print

**Note**: Print functions have complex interdependencies and share many global variables. Recommend extracting after 2D functions are complete.

---

## Expected Final Results

**After Phase 2 (2D extraction)**:
- kirra.js: ~37,000 lines (down 4,000+)
- canvas3DDrawing.js: 315 lines
- canvas2DDrawing.js: ~3,500 lines

**After Phase 3 (Print extraction)**:
- kirra.js: ~34,500 lines (down 7,000+)
- canvas3DDrawing.js: 315 lines
- canvas2DDrawing.js: ~3,500 lines
- canvas2DPrinting.js: ~2,500 lines

**Total reduction**: ~17% smaller main file, better organization, improved maintainability

---

## Implementation Notes

### Dependencies
All extracted functions depend on global variables from kirra.js:
- Canvas context: `ctx`, `canvas`, `currentScale`
- Colors: `strokeColor`, `fillColor`, `textFillColor`
- State: `darkModeEnabled`, `displayOptions`
- Utilities: `worldToCanvas()`, `worldToThreeLocal()`
- Constants: `holeScale`, `currentFontSize`

### Module Pattern
Functions are exported from modules and imported into kirra.js:
```javascript
// In module:
export function drawHole(x, y, radius, fillColor, strokeColor) { ... }

// In kirra.js:
import { drawHole, drawHoleToe, ... } from './draw/canvas2DDrawing.js';
```

### Testing After Each Phase
1. Run `npm run build` to verify no syntax errors
2. Test in browser to verify functionality
3. Check console for errors
4. Verify all drawing features work correctly

---

## How to Continue

### Option A: Continue in New Context
Since this is a large refactoring, you can continue with Phase 2 in a fresh context:
1. Read this document for current status
2. Extract 2D drawing functions following the same pattern as 3D
3. Test after extraction

### Option B: Manual Completion
If you prefer to complete manually:
1. Create `src/draw/canvas2DDrawing.js`
2. Copy functions listed in Phase 2 from kirra.js
3. Add `export` keyword to each function
4. Add import statement to kirra.js (after line 51)
5. Remove original functions from kirra.js
6. Test with `npm run build` and browser

---

## Architecture Notes

The refactored structure provides:
- **Separation of Concerns**: 2D vs 3D vs Print drawing
- **Easier Navigation**: Find functions by category
- **Better Performance**: Smaller files load faster in editor
- **Parallel Development**: Multiple developers can work on different modules
- **Clearer Dependencies**: Import statements show what each module needs

This is **work in progress** - Phase 1 (3D) is complete and working. Continue with Phase 2 when ready.

