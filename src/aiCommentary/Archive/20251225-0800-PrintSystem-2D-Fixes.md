# Print System 2D Fixes
**Date:** 2025-12-25 08:00
**Session Focus:** Fixing 2D Print System issues for both Raster and Vector output

---

## Summary

This session addressed multiple issues identified in the 2D print output, fixing both Raster and Vector PDF generation to improve consistency and match the WYSIWYG preview.

---

## Issues Fixed

### 1. Slope Map Error - `context.getDipAngle is not a function`
**Files Modified:** `kirra.js`, `PrintSystem.js`

- Added `getDipAngle` function to the print context in `setupPrintEventHandlers()` in `kirra.js`
- Added `getDipAngle` to the `printContext` object in `PrintSystem.js`
- Also added `currentRotation` to the context

### 2. Raster PDF - Incorrect Clipping
**File Modified:** `PrintSystem.js`

- Changed print area from using `mapZone` to `mapInnerZone` to match Vector PDF behavior
- This ensures the raster data is scaled to fit within the blue dashed preview boundary (print-safe area)

### 3. Raster PDF - Missing QR Code  
**File Modified:** `PrintSystem.js`

- Added pre-loading of QR code image before starting the render process
- Created `startRasterRendering(preloadedQRCode)` inner function
- QR code now loads asynchronously before canvas rendering begins
- Added 2-second timeout fallback if image fails to load

### 4. Vector PDF - Font Size Too Large
**File Modified:** `PrintVectorPDF.js`

- Reduced hole label font size from 6pt to 4pt to better match screen display

### 5. Vector PDF - Missing Text Values and Colors
**File Modified:** `PrintVectorPDF.js`

Added rendering for additional display options:
- `holeDip` - dip angle (brown/orange color)
- `holeSubdrill` - subdrill amount (blue color)
- `initiationTime` - initiation time (red color)

Improved color consistency to match screen display.

### 6. Remove Square Braces from Title Block
**Files Modified:** `PrintSystem.js`, `PrintVectorPDF.js`

Removed `[` and `]` brackets from:
- Title (blast name)
- Date/Time
- Scale ratio
- Designer name

### 7. PrintDialog - Add File Name Field
**File Modified:** `PrintDialog.js`

- Added new "File Name" input field at top of dialog
- Auto-generates default filename if left blank: `YYYYMMDD-Kirra-Vector-Print.pdf` or `YYYYMMDD-Kirra-Raster-Print.pdf`
- Persists last entered filename in localStorage

### 8. PrintDialog - Increased Height
**File Modified:** `PrintDialog.js`

- Increased dialog height from 180px to 230px to accommodate the new file name field

---

## Files Modified

| File | Changes |
|------|---------|
| `src/kirra.js` | Added `getDipAngle` and `currentRotation` to print context |
| `src/print/PrintSystem.js` | Fixed clipping, QR code preload, square braces, filename, getDipAngle |
| `src/print/PrintVectorPDF.js` | Fixed font size, added display options, removed square braces, filename |
| `src/print/PrintDialog.js` | Added file name field, increased dialog height |

---

## Testing Checklist

| Test | Status |
|------|--------|
| 2D Landscape Vector PDF | Ready to test |
| 2D Landscape Raster PDF | Ready to test |
| 2D Portrait Vector PDF | Ready to test |
| 2D Portrait Raster PDF | Ready to test |
| Slope Map rendering | Ready to test |
| QR Code in Raster | Ready to test |
| Custom filename | Ready to test |
| Auto-generated filename | Ready to test |

---

## Notes

- The 3D print system has separate issues that were not addressed in this session
- Colors for hole labels use fixed values that approximate the screen colors:
  - Black for HoleID (textFillColor)
  - Green (0, 128, 0) for HoleDia
  - Blue (0, 0, 255) for HoleLen (depthColor)
  - Brown/Orange (128, 64, 0) for HoleAng (angleDipColor)
  - Red (255, 0, 0) for HoleBea, initiationTime
  - Blue for holeSubdrill

