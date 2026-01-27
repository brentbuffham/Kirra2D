---
name: 3D Print System Fixes
overview: Fix the 3D print preview to match 2D behavior (removing red/blue dashed lines) and ensure WYSIWYG functionality captures the exact camera orientation from user interaction.
todos:
  - id: fix-3d-preview-boundary
    content: Remove red/blue dashed lines from 3D print preview overlay in PrintSystem.js
    status: completed
  - id: update-3d-vector-pdf
    content: Update PrintVectorPDF.js to use WebGL canvas capture for 3D mode map area
    status: completed
  - id: verify-camera-capture
    content: Verify 3D capture correctly preserves camera orientation in PrintCaptureManager.js
    status: completed
  - id: test-3d-printing
    content: Test 3D printing with various camera angles to confirm WYSIWYG behavior
    status: completed
---

# 3D Print System Fixes

## Problem Summary

1. **3D Print Preview shows extra boundary lines**: The 3D print preview currently displays red dashed (page edge) and blue dashed (print-safe area) lines, while the 2D preview was fixed to only show the black template boundary.
2. **WYSIWYG Camera Orientation**: 3D printing must capture exactly what the user sees - if they orbit/rotate the model to view it from any angle (cross-sectional, horizontal, rotated around Z-axis), the print output should reflect that exact camera orientation.

## Files to Modify

### Primary Changes

1. **[src/print/PrintSystem.js](src/print/PrintSystem.js)** - Remove red/blue dashed lines from 3D preview overlay

- Modify `create3DPrintBoundaryOverlay()` (lines 262-360) to match 2D behavior
- Remove the red dashed page outline drawing (lines 294-297)
- Remove the blue dashed map inner zone drawing (lines 306-309)
- Keep only the black template boundary drawing

2. **[src/print/PrintVectorPDF.js](src/print/PrintVectorPDF.js)** - Handle 3D mode properly

- For 3D mode, vector PDF cannot re-render from coordinates (camera could be at any angle)
- Should use WebGL canvas capture for 3D data area (raster image in the map zone)
- Footer/template elements remain as vectors

### Secondary Considerations

3. **[src/print/PrintCaptureManager.js](src/print/PrintCaptureManager.js)** - Verify 3D capture works correctly

- `capture3DView()` captures WebGL canvas - verify boundary cropping is correct
- `captureXYZGizmo()` should reflect current camera orientation

## Implementation Details

### Step 1: Fix 3D Print Preview Boundary

In `create3DPrintBoundaryOverlay()`, remove:

- Red dashed page outline (`ctx.strokeStyle = "red"` section)
- Blue dashed map inner zone (`ctx.strokeStyle = "rgba(0, 100, 255, 0.8)"` section)

Keep only:

- Black solid map zone outline
- Footer zone outline and column borders
- Title block row borders
- Preview label

### Step 2: Update 3D Vector PDF Handling

For 3D mode in `generateTrueVectorPDF()`:

- Use `PrintCaptureManager.capture3DView()` to get WebGL canvas image
- Insert the captured image into the map zone as a raster layer
- Continue rendering footer elements as vectors (statistics, title, QR code, etc.)

This ensures the 3D view is printed exactly as the user sees it, regardless of orbit/rotation angles.

### Step 3: Verify Camera State Preservation

The camera state from `CameraControls.getCameraState()` includes:

- `orbitX`, `orbitY` - 3D orbit angles (pitch and yaw)
- `rotation` - Z-axis rotation
- `centroidX`, `centroidY`, `scale`

The WebGL canvas capture in `capture3DView()` already captures the rendered view which includes all camera transformations - verify this works correctly.

## Testing Checklist

- Enable 3D print preview and verify only black boundary shows (no red/blue dashed lines)
- Orbit the 3D model to various angles and verify print preview boundary updates correctly
- Generate raster PDF from 3D mode and verify WYSIWYG (matches screen view)