# Blast Analytics Overhaul: Permanent Surfaces, Legend Fix, SDoB Shader

**Date:** 2026-02-17
**Status:** Implemented

## Changes Made

### 1. Fixed Legend Colour Ramps (BlastAnalysisShaderHelper.js)
- Replaced hardcoded `colorStops` in `getShaderLegendInfo()` with dynamic sampling from `ColourRampFactory.RAMPS`
- Legends now always match the actual shader ramp (jet for Heelan, sdob for SDoB, etc.)
- Imported `ColourRampFactory` and uses `_interpolate()` to sample 5 evenly-spaced colours

### 2. Changed SDoB from Voronoi to IDW Smooth Shader (SDoBModel.js)
- Replaced nearest-hole Voronoi `main()` with inverse-distance-weighted (IDW) blending
- Each pixel now computes SDoB for every nearby hole and blends with `w = 1/(dist^2)`
- Produces smooth gradient transitions between holes instead of sharp Voronoi cell edges
- Target SDoB contour and edge fade preserved

### 3. Made Blast Analytics Create Permanent Surfaces (BlastAnalysisShaderHelper.js)
- Rewrote `applyBlastAnalysisShader()` to always create a permanent surface with baked texture
- Uses `AddSurfaceAction` via `undoManager.execute()` (same pattern as flyrock shroud)
- Surfaces appear in TreeView, persist to IndexedDB, and support undo
- Removed `bakeShaderToSurfaceTexture()` and `duplicateSurfaceWithShader()` (merged into single flow)
- Simplified `clearBlastAnalysisShader()` to only hide legend overlay
- Added `buildAnalysisSurfaceData()` to generate plane geometry or copy existing surface triangles

### 4. Simplified Dialog (BlastAnalysisShaderDialog.js)
- Removed "Apply Mode" dropdown (overlay/duplicate no longer needed)
- Removed "Bake as Texture" checkbox (always bakes now)
- Kept: model, surface/plane, blast pattern, padding, model-specific params

### 5. Updated Context Menu (SurfaceShaderContextMenu.js)
- Removed `revertShaderOnSurface` import (function removed)
- Removed shader duplicate revert option (surfaces managed via TreeView/undo)
- Simplified to: "Apply Blast Analysis Shader" and "Hide Analysis Legend"

## Files Modified
- `src/helpers/BlastAnalysisShaderHelper.js` — Major rewrite
- `src/shaders/analytics/models/SDoBModel.js` — main() rewritten to IDW
- `src/dialog/popups/analytics/BlastAnalysisShaderDialog.js` — Simplified fields
- `src/dialog/contextMenu/SurfaceShaderContextMenu.js` — Removed revert option
