---
name: Fix PDF Positioning and Scale
overview: Fix the vector PDF output to match the print preview exactly by correcting header height calculation, printArea positioning, and coordinate transformation to ensure content aligns properly and scale displays correctly.
todos:
  - id: match-header-height
    content: Set headerHeight = 17mm (200px equivalent) to match raster version exactly
    status: pending
  - id: match-printarea
    content: "Ensure printArea calculation matches raster version exactly: y = margin + headerHeight"
    status: pending
    dependencies:
      - match-header-height
  - id: match-coordinate-transform
    content: Copy exact coordinate transformation formula from drawDataForPrinting, convert pixels to mm
    status: pending
    dependencies:
      - match-printarea
  - id: fix-surface-rendering
    content: Ensure surfaces use worldToPDF transformation correctly to match raster version
    status: pending
    dependencies:
      - match-coordinate-transform
  - id: reduce-hole-size
    content: Reduce hole radius multiplier from 0.35 to 0.25-0.3
    status: pending
  - id: verify-wysiwyg
    content: Test PDF output matches print preview exactly (positions, sizes, surfaces)
    status: pending
    dependencies:
      - match-header-height
      - match-printarea
      - match-coordinate-transform
      - fix-surface-rendering
      - reduce-hole-size
---

# Fix Vector PDF to Match Raster Code Exactly (WYSIWYG)

## Problem Analysis

User reports:

1. **Surface not showing correctly** in PDF vs print preview
2. **Size mismatch**: Elements in print preview don't match PDF output (WYSIWYG broken)
3. **Holes too large**: Need to make holes smaller
4. **Content positioning**: PDF doesn't match print preview layout

## Root Cause Analysis

The working raster version (`printCanvasHiRes`):

- Creates canvas at **300 DPI** (pixels): `printCanvas.width = pageWidth * mmToPx` where `mmToPx = 300/25.4 = 11.8`
- Uses `headerHeight = 200` **pixels** (not mm!)
- Calculates `printArea` in **pixels**: `{x: margin, y: margin + 200, ...}` where margin is also in pixels
- Calls `drawDataForPrinting(printCtx, printArea, context)` which:
- Gets screen boundary (blue dashed lines)
- Converts to world coordinates
- Calculates `printScale = printArea.width / dataWidth` (pixels per meter)
- Creates `worldToPrint()` that returns **pixel coordinates**
- Renders everything using `printData()` which uses `context.worldToCanvas = worldToPrint`
- Then converts entire canvas to image and adds to PDF

The vector PDF version:

- Creates PDF directly in **mm**
- Calculates `printArea` in **mm**
- Calculates `printScale` in **mm/meter** (different units!)
- `worldToPDF()` returns **mm coordinates**

**Key Issue**: Units mismatch! Raster uses pixels, vector uses mm. Need to convert properly.

## Solution: Match Raster Code Exactly

### 1. Fix Header Height to Match Raster Version

**File**: [`Kirra2D/src/print/PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js) (lines 397-424)

- Raster uses: `headerHeight = 200` pixels at 300 DPI
- Convert to mm: `200 / 11.8 = ~17mm`
- **Change**: Use `headerHeight = 17` mm (or calculate dynamically but match 200px equivalent)

### 2. Fix PrintArea Calculation to Match Exactly

**File**: [`Kirra2D/src/print/PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js) (lines 419-424)

- Raster: `printArea = {x: margin, y: margin + 200, ...}` in pixels
- Vector: Convert to mm: `printArea = {x: margin, y: margin + 17, ...}` in mm
- **Change**: Match exact formula: `y: margin + headerHeight` where headerHeight = 17mm

### 3. Fix Coordinate Transformation to Match Exactly

**File**: [`Kirra2D/src/print/PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js) (lines 456-482)

- Must match `drawDataForPrinting` exactly:
- Same `printScale` calculation: `printArea.width / dataWidth` (but in mm/meter for vector)
- Same `offsetX/Y` calculation: `printArea.x + (printArea.width - scaledWidth) / 2`
- Same `worldToPDF` formula: `(worldX - printCentroidX) * printScale + centerX`
- **Change**: Ensure formula matches line-by-line with `drawDataForPrinting`

### 4. Fix Surface Rendering

**File**: [`Kirra2D/src/print/PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js) (lines 554-617)

- Raster calls `printSurface(context)` which uses `context.worldToCanvas`
- Vector needs to use same coordinate transformation
- **Change**: Ensure surfaces use `worldToPDF` transformation correctly

### 5. Make Holes Smaller

**File**: [`Kirra2D/src/print/PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js) (line ~718)

- Current: `holeRadius * 0.35` (35% of original)
- **Change**: Reduce further to `0.25` or `0.3` (25-30% of original)

### 6. Fix Scale Display

**File**: [`Kirra2D/src/print/PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js) (line ~751)

- `printScale` is in mm/meter
- Scale ratio should be: if 1mm = X meters, then scale is 1:X
- But scale typically means: 1 unit on paper = X units in reality
- **Change**: Verify calculation: `scaleRatio = Math.round(1000 / printScale)` where 1000 converts mm to meters

## Implementation Steps

1. **Match header height exactly**:

- Use `headerHeight = 17` mm (200px / 11.8)
- Or calculate dynamically but ensure it matches 200px equivalent

2. **Match printArea calculation exactly**:

- `printArea.y = margin + headerHeight` (same formula as raster)

3. **Match coordinate transformation exactly**:

- Copy the exact formula from `drawDataForPrinting` lines 54-78
- Convert pixel-based to mm-based but keep same logic

4. **Fix surface rendering**:

- Ensure surfaces use `worldToPDF` transformation
- Match the surface rendering logic from raster version

5. **Reduce hole size**:

- Change multiplier from 0.35 to 0.25 or 0.3

6. **Test WYSIWYG**:

- Generate PDF and compare element positions/sizes with print preview
- Verify surfaces render correctly
- Verify scale matches

## Key Changes

- **Line ~398**: Set `headerHeight = 17` (200px equivalent at 300 DPI)
- **Line ~421**: Ensure `printArea.y = margin + headerHeight` matches raster
- **Lines 456-482**: Verify coordinate transformation matches `drawDataForPrinting` exactly
- **Lines 554-617**: Ensure surface rendering uses correct transformation
- **Line ~718**: Reduce hole radius multiplier to 0.25-0.3
- **Line ~751**: Verify scale calculation