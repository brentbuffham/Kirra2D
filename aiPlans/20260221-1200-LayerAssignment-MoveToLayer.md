# Surface/KAD Layer Assignment & Move to Layer - Implementation

## Date: 2026-02-21

## Summary
Implemented centralized layer helper, auto-layer assignment for Flyrock and Triangulate tools, and "Move to Layer" context menu for surfaces and KAD entities in TreeView.

## Files Created
1. **`src/helpers/LayerHelper.js`** - Centralized `getOrCreateSurfaceLayer()` and `getOrCreateDrawingLayer()`
2. **`src/dialog/popups/generic/MoveToLayerDialog.js`** - "Move to Layer" dialog (follows AssignBlastDialog pattern)

## Files Modified
1. **`src/helpers/FlyrockShroudHelper.js`** - Assigns shroud surface to "Flyrock" layer
2. **`src/dialog/popups/generic/KADDialogs.js`** - Assigns triangulated surface to "Triangulated" layer
3. **`src/helpers/SurfaceBooleanHelper.js`** - Replaced local `getOrCreateSurfaceLayer` with import from LayerHelper
4. **`src/helpers/SolidCSGHelper.js`** - Replaced local `getOrCreateSurfaceLayer` with import from LayerHelper
5. **`src/helpers/ExtrudeKADHelper.js`** - Replaced local `getOrCreateSurfaceLayer` with import from LayerHelper
6. **`src/dialog/tree/TreeView.js`** - Added "Move to Layer" context menu item + handler + `moveToLayer()` method
7. **`kirra.html`** - Added "Move to Layer" context menu HTML item
8. **`src/kirra.js`** - Added import for MoveToLayerDialog.js

## Status: COMPLETE - Build verified
