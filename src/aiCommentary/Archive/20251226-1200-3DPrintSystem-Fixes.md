# 3D Print System Fixes - December 26, 2025

## Summary

Implemented fixes for the 3D printing system to address two key issues:

1. **Print Preview Boundary Cleanup** - Removed red dashed (page edge) and blue dashed (print-safe area) lines from 3D print preview, matching the 2D behavior where only the black template boundary is shown.

2. **WYSIWYG Camera Orientation** - Ensured 3D printing captures exactly what the user sees, including orbit/rotation angles. When users rotate or orbit the 3D view to any angle, the print output reflects that exact camera orientation.

## Changes Made

### 1. PrintSystem.js - `create3DPrintBoundaryOverlay()` (Lines ~293-405)

**Before:**
- Drew red dashed page outline
- Drew blue dashed map inner zone
- Drew black solid map zone outline

**After:**
- Removed red dashed page outline
- Removed blue dashed map inner zone
- Only shows black template boundary (matches 2D behavior)
- Added "[MAP]" label in center of map zone
- Added template zone labels ("[XYZ GIZMO]", "CONNECTOR COUNT", "BLAST STATISTICS", etc.)

### 2. PrintVectorPDF.js - `generateTrueVectorPDF()` (Lines ~349-495)

**Added 3D mode handling:**
- When mode is "3D", captures WebGL canvas image instead of re-rendering from world coordinates
- Uses `context.threeRenderer.getCanvas()` to get the 3D view
- Crops the captured image using 3D print boundary info
- Inserts the captured image as a raster layer in the PDF map zone
- Skips 2D-specific data rendering (surfaces, KAD, blast holes as vectors) for 3D mode
- Footer elements remain as vectors

### 3. PrintSystem.js - `printCanvasHiRes()` (Lines ~913-963)

**Added 3D mode handling for raster PDF:**
- When mode is "3D", captures WebGL canvas image
- Draws cropped 3D view into print area using `drawImage()`
- For 2D mode, continues using existing `drawDataForPrinting()` function

## Technical Details

### Camera Orientation Preservation

The 3D camera state is preserved through:
- `CameraControls.getCameraState()` returns `orbitX`, `orbitY`, `rotation`, `scale`, `centroidX`, `centroidY`
- WebGL canvas capture happens AFTER the scene is rendered with current camera settings
- The captured image is exactly what the user sees on screen (WYSIWYG)

### Coordinate Handling

For 3D mode:
- No world-to-PDF coordinate transformation is needed
- The captured WebGL image already has all perspective/projection applied
- Boundary cropping uses pixel coordinates from the 3D print boundary overlay

For 2D mode:
- Existing `worldToPDF()` transformation function is used
- Data is re-rendered as vectors where applicable

## Files Modified

1. `src/print/PrintSystem.js`
   - `create3DPrintBoundaryOverlay()` - Simplified to show only black template boundary
   - `printCanvasHiRes()` - Added 3D WebGL canvas capture

2. `src/print/PrintVectorPDF.js`
   - `generateTrueVectorPDF()` - Added 3D mode WebGL canvas capture and raster insertion

## Testing Checklist

- [x] 3D print preview shows only black template boundary (no red/blue dashed lines)
- [x] 3D print preview label correctly shows "Print Preview: A4 landscape (3D)"
- [x] Template zone labels render correctly in 3D preview
- [x] Build completes without errors
- [ ] Generate raster PDF from 3D mode - verify WYSIWYG
- [ ] Generate vector PDF from 3D mode - verify map area shows correct 3D view
- [ ] Test with orbited 3D view (camera at non-vertical angle)
- [ ] Test with rotated Z-axis view

## Related Files

- `src/print/PrintCaptureManager.js` - Contains `capture3DView()` and `captureXYZGizmo()` methods
- `src/print/PrintLayoutManager.js` - Template layout calculations
- `src/print/PrintTemplates.js` - Template definitions

## Previous Fix Reference

See `20251225-0800-PrintSystem-2D-Fixes.md` for related 2D print system fixes.

