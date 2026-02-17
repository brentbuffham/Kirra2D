# TreeView Surfaces Hide/Show & Blast Analytics Naming Fixes
**Date:** 20260218-1200

## Issues Addressed

### 1. Surfaces Layer Node Level - Hide/Show All Not Working

**Root Cause:** `setSurfacesGroupVisibility` and `setImagesGroupVisibility` did not set `window.threeDataNeedsRebuild = true`, unlike `setBlastGroupVisibility` and `setDrawingsGroupVisibility`. This meant the 3D scene did not rebuild when Surfaces/Images visibility was toggled from the TreeView.

**Fixes Applied:**
- **kirra.js** (lines ~34108, ~34116): Added `window.threeDataNeedsRebuild = true` to `setSurfacesGroupVisibility` and `setImagesGroupVisibility` for consistency with Blast and Drawings.
- **kirra.js** (setLayerVisibility): Added `debouncedSaveSurfaces()` when surface layer visibility changes, so surface visibility persists.
- **TreeView.js**: Added `TREE_NODE_SEPARATOR = "\u28FF"` constant and used it in `buildSurfaceData()` for surface and layer-surface node IDs. Using the explicit Unicode escape prevents potential Braille character corruption from copy-paste or encoding issues.

### 2. Blast Analytics - Multiple Analyses Same Name

**Root Cause:** Generated analysis surfaces used `name: "Analysis " + modelDisplayName` (e.g. "Analysis PPV"), so multiple PPV analyses all showed the same name in the TreeView.

**Fix Applied:**
- **BlastAnalysisShaderHelper.js** (line ~97): Added 4-char uid via `Math.random().toString(36).slice(2, 6)` to the display name. New format: `"Analysis " + modelDisplayName + "_" + uid4` e.g. "Analysis PPV_a3x9" (matches KADLine style).

### 3. Surface Layer Node - Hide/Show Not Working (20260218 follow-up)

**Root Cause:** `setLayerVisibility` for surface type returned early when the layer didn't exist in `allSurfaceLayers`. Surface layers can appear in the tree (from `layerSurfaceMap` built from surfaces) before the layer is created in `allSurfaceLayers` (e.g. surfaces without layerId, or from Blast Analysis which doesn't set layerId). Also, Method 2 used `surface.layerId === layerId` which failed for surfaces without layerId (they belong to default layer).

**Fixes Applied:**
- **kirra.js** (setLayerVisibility): When layer doesn't exist for surface type, create it in `allSurfaceLayers` on-the-fly so Hide/Show works.
- **kirra.js** (setLayerVisibility): Method 2 for surfaces now uses `(surface.layerId || defaultSurfaceLayerId) === layerId` so surfaces without layerId are correctly matched to the default layer.
- **kirra.js** (setLayerVisibility): Added `updateTreeViewVisibilityStates()` and `threeDataNeedsRebuild` so tree and 3D update when layer visibility changes.

## Files Modified

- `src/kirra.js` - setSurfacesGroupVisibility, setImagesGroupVisibility, setLayerVisibility
- `src/dialog/tree/TreeView.js` - TREE_NODE_SEPARATOR constant, buildSurfaceData
- `src/helpers/BlastAnalysisShaderHelper.js` - applyBlastAnalysisShader surface name
