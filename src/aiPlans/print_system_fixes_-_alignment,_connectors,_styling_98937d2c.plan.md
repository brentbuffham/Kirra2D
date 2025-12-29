---
name: Print System Fixes - Alignment, Connectors, Styling
overview: Fix map zone alignment, add missing connectors/contour lines/gizmo rendering, fix font colors/sizes, update PrintDialog styling, and ensure raster PDF includes all elements.
todos:
  - id: fix-print-dialog
    content: Update PrintDialog.js to use FloatingDialog createFormContent helper, remove Blast Name field, fix label font sizes to 12px
    status: completed
  - id: fix-map-alignment
    content: Fix map zone alignment in PrintVectorPDF.js by reviewing worldToPDF coordinate transformation and mapInnerZone calculations
    status: completed
  - id: add-connectors-vector
    content: Add connector rendering to vector PDF in PrintVectorPDF.js - iterate holes and draw connectors using worldToPDF transformation
    status: completed
    dependencies:
      - fix-map-alignment
  - id: add-contour-lines
    content: Add contour line rendering to vector PDF in PrintVectorPDF.js - render context.contourLinesArray segments
    status: completed
    dependencies:
      - fix-map-alignment
  - id: fix-gizmo-capture
    content: Fix XYZ Gizmo capture timing in PrintCaptureManager.js - ensure render completes before capturing
    status: completed
  - id: fix-font-colors
    content: Fix font colors in PrintVectorPDF.js - ensure hole labels and footer text use correct colors matching display options
    status: completed
  - id: increase-footer-fonts
    content: Increase footer font sizes in PrintVectorPDF.js - connector count, blast stats, title, date, scale/designer
    status: completed
  - id: fix-raster-pdf
    content: Fix raster PDF rendering in PrintSystem.js - ensure north arrow, connectors, and all elements are included
    status: completed
  - id: test-2d-vector
    content: Test 2D landscape and portrait vector PDFs - verify alignment, connectors, colors, footer
    status: pending
    dependencies:
      - fix-map-alignment
      - add-connectors-vector
      - fix-font-colors
      - increase-footer-fonts
  - id: test-3d-vector
    content: Test 3D landscape and portrait vector PDFs - verify gizmo, connectors, contour lines, rotation, alignment
    status: pending
    dependencies:
      - fix-map-alignment
      - add-connectors-vector
      - add-contour-lines
      - fix-gizmo-capture
---

# Print System Fixes - Alignmen

t, Connectors, Styling

## Overview

Address multiple issues in the print system: map zone misalignment, missing connectors/contour lines/gizmo in vector PDFs, font color/size issues, PrintDialog styling, and raster PDF element rendering.

## Issues to Fix

### 1. Vector PDF Map Zone Alignment (2D & 3D)

**Problem**: Map zone is misaligned in landscape and portrait orientations (images 4, 5, 7, 8)**Files**: `src/print/PrintVectorPDF.js`

- Review coordinate transformation in `worldToPDF` function (lines 276-282)
- Verify `getPrintBoundary` returns correct screen boundary
- Check `mapInnerZone` calculation matches template safe area
- Ensure coordinate system conversion accounts for canvas vs PDF coordinate systems

### 2. Missing Connectors in Vector PDF

**Problem**: Connectors (arrows between holes) are not rendered in vector PDF output**Files**: `src/print/PrintVectorPDF.js`

- Add connector rendering loop after hole rendering (around line 507)
- Use `printArrowSVG` from `PrintRendering.js` or implement direct jsPDF drawing
- Check `displayOptions.connector` flag
- Iterate through holes and draw connectors using `worldToPDF` transformation
- Handle curved connectors using quadratic bezier curves in jsPDF

### 3. Missing Contour Lines in Vector PDF

**Problem**: Contour lines are not rendered in vector PDF (especially 3D)**Files**: `src/print/PrintVectorPDF.js`

- Add contour line rendering after surfaces (around line 374)
- Check `displayOptions.contour` flag
- Access `context.contourLinesArray` and render each line segment
- Use `worldToPDF` to transform coordinates
- Set line color to magenta (matching raster output)

### 4. Missing XYZ Gizmo in 3D Vector PDF

**Problem**: XYZ Gizmo not showing in 3D portrait/landscape PDFs**Files**: `src/print/PrintCaptureManager.js`, `src/print/PrintVectorPDF.js`

- Fix `captureXYZGizmo` timing - wait for render completion before capturing
- Add async/await or callback mechanism to ensure gizmo is rendered
- Verify gizmo position calculation matches 3D viewport
- Check if `threeRenderer.showAxisHelper` is working correctly

### 5. Missing Rotation Indicator in 3D PDF

**Problem**: 3D rotation not reflected in PDF (image 8)**Files**: `src/print/PrintVectorPDF.js`, `src/print/PrintCaptureManager.js`

- Ensure 3D scene capture includes current camera rotation
- Verify `capture3DView` captures the rotated view correctly
- Check if 3D vector PDF needs to capture scene as raster layer

### 6. Font Color Issues

**Problem**: Font colors are incorrect in vector PDF**Files**: `src/print/PrintVectorPDF.js`

- Review all `pdf.setTextColor` calls (lines 488-505)
- Ensure colors match display options (e.g., holeDia should be green, holeLen blue)
- Fix connector count text colors (line 604)
- Verify footer text uses correct colors

### 7. Footer Font Sizes Too Small

**Problem**: Footer text needs to be larger**Files**: `src/print/PrintVectorPDF.js`

- Increase font sizes in footer sections:
- Connector count header: 7 → 9
- Connector count rows: 5 → 7
- Blast statistics header: 7 → 9
- Blast statistics rows: 5 → 7
- Title: 8 → 10
- Date: 6 → 8
- Scale/Designer: 6 → 8

### 8. PrintDialog Styling Issues

**Problem**: PrintDialog not styled like other FloatingDialogs, font sizes too large, redundant Blast Name field**Files**: `src/print/PrintDialog.js`

- Remove commented-out Blast Name field (lines 13-20)
- Replace `createFormContent` with FloatingDialog's `createFormContent` helper
- Use `createEnhancedFormContent` from FloatingDialog.js for proper styling
- Ensure labels use `labelWhite12` class with 12px font size
- Match styling of other FloatingDialogs in the app

### 9. Raster PDF Issues

**Problem**: North arrow, connectors, and other elements missing in raster PDF**Files**: `src/print/PrintSystem.js` (printCanvasHiRes function)

- Verify `drawDataForPrinting` is called with correct context
- Check if `printHoleTextsAndConnectors` is being called
- Ensure `displayOptions` are passed correctly
- Add north arrow rendering in footer (use `PrintCaptureManager.captureNorthArrow`)
- Verify contour lines are rendered via `drawDataForPrinting`

### 10. 3D Vector PDF Rendering

**Problem**: 3D elements not properly rendered in vector PDF**Files**: `src/print/PrintVectorPDF.js`

- Consider capturing 3D scene as high-res raster layer for map zone
- Or implement proper 3D-to-2D projection for vector rendering
- Ensure connectors work in 3D mode
- Verify contour lines work in 3D mode

## Implementation Steps

1. **Fix PrintDialog styling** - Update to use FloatingDialog helpers, remove Blast Name, fix font sizes
2. **Fix map zone alignment** - Review and correct coordinate transformations
3. **Add connector rendering** - Implement connector drawing in vector PDF
4. **Add contour line rendering** - Implement contour line drawing in vector PDF
5. **Fix XYZ Gizmo capture** - Add proper timing/rendering for gizmo capture
6. **Fix font colors** - Update all text color settings
7. **Increase footer font sizes** - Update all footer text sizes
8. **Fix raster PDF rendering** - Ensure all elements are included
9. **Test 2D landscape/portrait** - Verify alignment and all elements
10. **Test 3D landscape/portrait** - Verify gizmo, connectors, contour lines, rotation

## Key Code Locations

- **Connector rendering**: `src/print/PrintRendering.js` lines 497-599 (`printArrow`), 2196-2251 (`printArrowSVG`)
- **Contour rendering**: `src/print/PrintRendering.js` lines 1397-1412
- **Hole connector logic**: `src/print/PrintRendering.js` lines 1599-1624
- **Coordinate transformation**: `src/print/PrintVectorPDF.js` lines 230-282
- **Dialog styling**: `src/dialog/FloatingDialog.js` lines 328-469 (`createFormContent`)

## Testing Checklist

- [ ] 2D landscape vector PDF - alignment, connectors, colors, footer sizes
- [ ] 2D portrait vector PDF - alignment, connectors, colors, footer sizes
- [ ] 3D landscape vector PDF - gizmo, connectors, contour lines, rotation, alignment
- [ ] 3D portrait vector PDF - gizmo, connectors, contour lines, rotation, alignment