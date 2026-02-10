# KAP Import Fixes - Plan

**Date:** 2026-02-10
**Status:** DEFERRED (parked for later, charging fixes take priority)

## Context

KAP import (Kirra App Project) has multiple issues discovered during first real testing. These are documented here for future work.

## Issues

| # | Issue | Root Cause | Severity |
|---|-------|-----------|----------|
| 1 | Images import as black | Race condition: blob URL revoked before image loads in `restoreImageFromBlob()` | HIGH |
| 2 | Blast holes appear then get overwritten | Debounced saves may fire after import, overwriting with stale data | HIGH |
| 3 | KAD drawings overwritten | `clearAllDataStructures()` called before loading new data, no merge option | MED |
| 4 | Products overwritten | Same clear-then-load pattern, no rollback on partial failure | MED |
| 5 | Surfaces not textured | Texture blobs not loaded if metadata incomplete; async rebuild timing issue | MED |

## Files

- **KAP Parser:** `src/fileIO/KirraIO/KAPParser.js`
- **KAP Writer:** `src/fileIO/KirraIO/KAPWriter.js`
- **Import trigger:** `src/kirra.js` (lines 8240-8284)
- **Data clearing:** `src/kirra.js` `clearAllDataStructures()` (line ~5500)
- **Texture rebuild:** `src/kirra.js` `rebuildTexturedMesh()` (line ~14996)

## KAP File Structure

ZIP archive containing:
- `manifest.json` - Version and metadata
- `holes.json` - Array of blast holes
- `drawings.json` - KAD drawing entities (Map entries)
- `surfaces.json` - Surface metadata (points, triangles, texture info)
- `images.json` - Image metadata
- `products.json` - Charging products (Map entries)
- `charging.json` - Hole charging data (Map entries)
- `configs.json` - Charge configurations (Map entries)
- `layers.json` - Drawing and surface layers
- `textures/` folder - Texture blobs for OBJ meshes
- `images/` folder - Image blobs

## Import Flow (current)

1. Show confirmation dialog
2. Parse manifest.json
3. **CLEAR ALL existing data** (`window.clearAllDataStructures()`)
4. Clear 3D scene objects
5. Load blast holes → overwrite `window.allBlastHoles`
6. Load KAD drawings → overwrite `window.allKADDrawingsMap`
7. Load surfaces → populate `window.loadedSurfaces`
8. Load images → populate `window.loadedImages`
9. Load products → populate `window.loadedProducts`
10. Load hole charging → populate `window.loadedCharging`
11. Load configs → populate `window.loadedChargeConfigs`
12. Load layers
13. Refresh application (drawData, save to IndexedDB)

## Planned Fixes

### Fix 1: Image Blob Loading Race Condition
**File:** `KAPParser.js` `restoreImageFromBlob()` (lines 343-378)

- Wrap image loading in a proper Promise with timeout
- Don't revoke blob URL until canvas has been drawn
- Validate canvas has actual pixel data (not all zeros) before accepting
- Add error counting to import summary

### Fix 2: Debounced Save Interference
**File:** `KAPParser.js` and `kirra.js`

- During KAP import, set `window._kapImporting = true` flag to disable debounced saves
- After all data loaded, do ONE explicit save of each data type
- Re-enable debounced saves after import complete
- Alternative: flush all pending debounced operations before `clearAllDataStructures()`

### Fix 3: Merge vs Overwrite Dialog
**File:** `KAPParser.js` (line 49)

- Before clearing, ask user: "Merge with existing data?" or "Replace all?"
- Merge mode: add new items, skip duplicates (by ID or name)
- Replace mode: current behavior (clear then load)

### Fix 4: Product Import Validation
**File:** `KAPParser.js` (lines 186-208)

- Count expected products from JSON vs actually loaded
- If mismatch, log errors and warn user
- Consider rollback: save existing products before clearing, restore on failure

### Fix 5: Texture Blob Loading
**File:** `KAPParser.js` (lines 125-155)

- Validate `textureFileNames` and `textureFolderKey` exist before attempting load
- Log warning if texture files not found in ZIP
- Ensure `rebuildTexturedMesh()` runs AFTER `drawData()` completes (use callback or await)
- Known issue: MeshPhongMaterial reconstruction doesn't perfectly match MTLLoader (documented in CLAUDE.md)

## Verification (when implemented)

1. Export KAP with blast holes + images + surfaces + products → Re-import → verify all data intact
2. Import KAP with textured OBJ → verify textures visible after import
3. Import KAP with images → verify images render correctly (not black)
4. Import KAP into project with existing data → verify merge dialog appears
5. Import KAP with missing texture files → verify graceful degradation with warning
