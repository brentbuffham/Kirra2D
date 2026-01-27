---
name: Fix Print System to Match Templates
overview: Rebuild the print system to match the exact layouts from PrintoutTemplateLAND.pdf and PrintoutTemplatePORT.pdf, working in both 2D and 3D modes with vector and raster outputs.
todos:
  - id: fix-footer-table
    content: Create renderFooterTable() function in PrintVectorPDF.js that renders the exact table structure from templates with borders and content
    status: completed
  - id: fix-map-rendering
    content: Verify and fix drawDataForPrinting() in PrintRendering.js to match working printData logic from reference file
    status: in_progress
  - id: fix-vector-pdf
    content: Refactor generateTrueVectorPDF() to use renderFooterTable() and PrintLayoutManager for all positioning
    status: completed
    dependencies:
      - fix-footer-table
      - fix-map-rendering
  - id: fix-raster-pdf
    content: Refactor printCanvasHiRes() to use same template layout and render footer table on canvas
    status: pending
    dependencies:
      - fix-footer-table
      - fix-map-rendering
  - id: add-3d-support
    content: "Add 3D mode support: capture WebGL canvas, composite into map zone, render footer table"
    status: completed
    dependencies:
      - fix-vector-pdf
      - fix-raster-pdf
  - id: test-validation
    content: Test all modes (2D/3D, vector/raster, landscape/portrait) and validate against reference PDFs
    status: pending
    dependencies:
      - add-3d-support
  - id: move-redundant-code
    content: Create src/print/redundant/ folder and move all deprecated/unused/broken code there with documentation
    status: pending
---

# Fix Print System to Match Reference Templates

## Problem Analysis

The current print system has multiple files but they're not working together properly. The old `printData` function in `for-reference-kirra.js` worked but didn't match the template format. The reference PDFs show a specific table-based layout that must be matched exactly.

## Reference Template Layouts

### Landscape Template (PrintoutTemplateLAND.pdf)

```javascript
[MAP AREA - Top 75% of page]

[FOOTER TABLE - Bottom 25% of page, full width]
Row 1: [North Arrow/XYZ] | [CONNECTOR COUNT] | [BLAST STATISTICS] | [Logo/QR]
Row 2: [Logo/QR] | [Connector Data] | [Stats Data] | [TITLE] [BLASTNAME]
Row 3: [Empty] | [Empty] | [Empty] | [DATE] [LOCAL SYSTEM DATE AND TIME]
Row 4: [Empty] | [Empty] | [Empty] | Scale: [CALCULATED] | Designer: [DIALOG ENTRY]
```



### Portrait Template (PrintoutTemplatePORT.pdf)

```javascript
[MAP AREA - Top 75% of page]

[FOOTER TABLE - Bottom 25% of page, full width]
Row 1: [North Arrow/XYZ] | [CONNECTOR COUNT] | [BLAST STATISTICS] | [TITLE] [BLASTNAME]
Row 2: [Logo/QR] | [Empty] | [Empty] | [DATE] [LOCAL SYSTEM DATE AND TIME]
Row 3: [Empty] | [Empty] | [Empty] | Scale: [CALCULATED] | Designer: [DIALOG ENTRY]
```



## Key Requirements

1. **Exact Template Matching**: Output must match reference PDFs pixel-perfect
2. **2D Mode**: North arrow rotates with canvas rotation
3. **3D Mode**: XYZ gizmo shows current camera orientation
4. **Data Population**: Blast name from holes, stats calculated, designer from dialog
5. **Borders**: Table cells must have borders matching template
6. **Both Outputs**: Vector (jsPDF native drawing) and Raster (high-res PNG to PDF)

## Implementation Strategy

### Phase 1: Simplify and Fix Core System

**1.1 Refactor PrintSystem.js**

- Keep working `getPrintBoundary()` for 2D preview
- Keep working `toggle3DPrintPreview()` for 3D overlay
- Simplify `printToPDF()` to route to correct generator
- Identify and move redundant/broken code to `src/print/redundant/` folder
- Remove broken/unused code after moving to redundant folder

**1.2 Fix PrintTemplates.js**

- Templates already defined correctly
- Verify cell positions match reference PDFs exactly
- Ensure footer structure matches both LAND and PORT layouts

**1.3 Fix PrintLayoutManager.js**

- Already calculates positions correctly
- Add helper to get connector count cell
- Add helper to get stats data cell

### Phase 2: Fix Data Rendering

**2.1 Use Working printData Logic**

- Reference `for-reference-kirra.js` lines 34600-35123
- Adapt `drawDataForPrinting()` in PrintRendering.js to use this logic
- Keep WYSIWYG boundary calculation (already working)

**2.2 Map Zone Rendering**

- Use existing `drawDataForPrinting()` function
- Ensure it renders: holes, KAD entities, surfaces, images
- Match the working coordinate transformation

### Phase 3: Fix Footer/Table Rendering

**3.1 Create Footer Renderer**

- New function: `renderFooterTable()` in PrintVectorPDF.js
- Uses PrintLayoutManager to get cell positions
- Renders table borders and content

**3.2 Navigation Indicator**

- 2D: Use `PrintCaptureManager.captureNorthArrow()` (already implemented)
- 3D: Use `PrintCaptureManager.captureXYZGizmo()` (already implemented)
- Place in correct cell using layout manager

**3.3 Statistics Table**

- Use existing `getBlastStatisticsPerEntity()` function
- Render in "blastStatsData" cell (row2, column 3)
- Format matches template (compact, bordered)

**3.4 Connector Count**

- Calculate from `allBlastHoles` (count connectors)
- Render in "connectorData" cell (row2, column 2)
- Format: "CONNECTOR COUNT" header, count below

**3.5 Title and Blast Name**

- Extract from `allBlastHoles` entityName field
- Fallback to userInput.blastName
- Render in "titleBlastName" cell

**3.6 Date/Time**

- Use `new Date().toLocaleString()`
- Render in "dateTime" cell

**3.7 Scale and Designer**

- Scale: Calculate from printScale using `layoutMgr.calculateScaleRatio()`
- Designer: From userInput.designer
- Render in row3/row4 cells

**3.8 Logo/QR Code**

- Use existing QR code image loading
- Render in "logo" cell
- Add "blastingapps.com" text below

### Phase 4: Fix Vector PDF Generation

**4.1 Refactor PrintVectorPDF.js**

- Simplify `generateTrueVectorPDF()` function
- Use PrintLayoutManager for all positioning
- Render map zone using `drawDataForPrinting()`
- Render footer table using new `renderFooterTable()`
- Move duplicate/broken code to `src/print/redundant/` folder
- Remove redundant functions after moving

**4.2 Table Border Rendering**

- Draw borders around all cells
- Use jsPDF `rect()` with stroke
- Match template border style (thin black lines)

### Phase 5: Fix Raster PDF Generation

**5.1 Refactor printCanvasHiRes() in PrintSystem.js**

- Use same template layout as vector
- Render to high-DPI canvas (300 DPI)
- Draw map using `drawDataForPrinting()`
- Draw footer table using canvas drawing
- Convert to PNG and add to PDF

**5.2 3D Mode Support**

- Capture WebGL canvas using `canvas.toDataURL()`
- Crop to boundary region
- Composite into map zone
- Add footer table around it

### Phase 6: Testing and Validation

**6.1 Visual Comparison**

- Generate PDFs and compare side-by-side with reference PDFs
- Verify cell positions match exactly
- Verify borders match
- Verify content placement

**6.2 Data Validation**

- Test with blast holes loaded
- Test with KAD drawings
- Test with surfaces
- Test with images
- Test in both 2D and 3D modes

## File Changes Summary

### Files to Modify

1. **PrintSystem.js**

- Simplify `printToPDF()` routing
- Keep working boundary functions
- Fix `printCanvasHiRes()` to use templates
- Move redundant code to `src/print/redundant/PrintSystem.redundant.js`

2. **PrintVectorPDF.js**

- Simplify `generateTrueVectorPDF()`
- Add `renderFooterTable()` function
- Use PrintLayoutManager for all positioning
- Move broken/duplicate code to `src/print/redundant/PrintVectorPDF.redundant.js`

3. **PrintRendering.js**

- Verify `drawDataForPrinting()` works correctly
- May need minor fixes based on reference implementation
- Move unused rendering functions to `src/print/redundant/PrintRendering.redundant.js`

4. **PrintStats.js**

- Add helper to format statistics for table cell
- Keep existing `getBlastStatisticsPerEntity()` usage
- Move deprecated functions to `src/print/redundant/PrintStats.redundant.js`

5. **PrintPDFMake.js**

- Review for redundant/unused code
- Move to `src/print/redundant/PrintPDFMake.redundant.js` if not being used

### Files to Keep As-Is

- **PrintTemplates.js** - Templates are correct
- **PrintLayoutManager.js** - Layout calculation works
- **PrintCaptureManager.js** - Capture functions work
- **PrintDialog.js** - Dialog works
- **SVGBuilder.js** - SVG helpers work

## Critical Success Factors

1. **Match Templates Exactly**: Every cell position, border, and content must match reference PDFs
2. **Use Working Code**: Leverage the working `printData` logic from reference file
3. **Simplify**: Remove broken code, keep only what works
4. **Test Incrementally**: Test each component before moving to next
5. **WYSIWYG**: Print output must match preview boundary exactly

## Implementation Order

1. **Create redundant folder structure** (`src/print/redundant/`)
2. **Identify redundant code** in all print files
3. **Move redundant code** to redundant folder (preserve for reference)
4. Fix footer table rendering (most critical)
5. Fix map zone rendering (verify working code)
6. Fix vector PDF generation
7. Fix raster PDF generation
8. Add 3D mode support
9. Test and validate against reference PDFs

## Redundant Code Identification

### Code to Move to Redundant Folder

1. **Deprecated functions** marked with `@deprecated` comments
2. **Unused SVG rendering functions** if not being used
3. **Duplicate rendering logic** that's been replaced
4. **Broken implementations** that don't work
5. **Old template structures** if templates were refactored
6. **Unused helper functions** that aren't called anywhere

### Redundant Folder Structure

```javascript
src/print/redundant/
├── PrintSystem.redundant.js          (deprecated print functions)
├── PrintVectorPDF.redundant.js       (old vector PDF code)
├── PrintRendering.redundant.js       (unused rendering functions)
├── PrintStats.redundant.js           (deprecated stats functions)
├── PrintPDFMake.redundant.js         (if PDFMake not being used)
└── README.md                          (explanation of what was moved and why)

```