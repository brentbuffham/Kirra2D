---
name: fix-print-and-camera
overview: Fix print surface visibility/order and 3D camera framing to visible data.
todos:
  - id: audit-print
    content: Audit print pipeline and surface render ordering in print files
    status: completed
  - id: fix-print-order
    content: Enforce visible-only rendering order and textured-surface raster fallback
    status: completed
  - id: header-top
    content: Render headers/stats after data layers
    status: completed
  - id: vector-option
    content: Add Raster/Vector dialog and wire to matching outputs
    status: completed
  - id: fix-camera
    content: Keep camera unless Reset View; use visible-data bounds
    status: completed
  - id: smoke-test
    content: Test print layers and 3D camera behavior
    status: completed
---

# Plan

- Audit current print pipeline in `src/print/PrintSystem.js` and `src/print/PrintRendering.js` to locate surface rendering paths and ordering (images/surfaces/KAD/holes/header) and identify where textured surfaces fallback to images.
- Implement visibility-filtered rendering order: 0) images (visible only), 1) surfaces (non-textured as vector fills, textured as raster underlay), 2) KAD (visible only), 3) holes (visible only), 4) headers/footers last so they stay on top. Ensure stats/title render after data.
- Ensure surface rendering uses visibility checks and handles textured surfaces by drawing their image when flagged; add legend layering after surfaces.
- Add post-print-button FloatingDialog asking Raster vs Vector; route Raster to existing raster path and Vector to jsPDF draw-tools path. Make both outputs visually identical.
- Fix 3D camera behavior: leave camera where the user puts it (no auto re-frame except the Reset View button). Use visible-data bounds for any clamping/centering to avoid disappearing scenes; adjust orbit/pan handlers in `src/draw/canvas3DDrawSelection.js` or related camera helpers accordingly.
- Smoke-test: print with visible textured surface and without to verify layers/legend; 3D orbit/pan over visible subset to confirm camera stays in view and only Reset View recenters.