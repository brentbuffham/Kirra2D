# Plan: XY Deduplication and Decimation for LAS + Point Cloud Importers

## Overview

Fix the gap where `xyzTolerance` is collected in the LAS UI but never applied, and add the same dedup/decimation controls to the Point Cloud import dialog.

## Scope

- XY-only deduplication for point cloud surface imports
- Decimation (max points) for surface imports
- LAS import dialog + Point Cloud import dialog only
- **No changes to:** `createConstrainautorMesh.js`, line rendering, lineWidth batching

---

## Step 1: Create shared deduplication utility

**New file:** `src/helpers/PointDeduplication.js`

### `deduplicatePoints(points, tolerance)`
- XY-only dedup (2.5D surfaces)
- Spatial hash grid for O(n) performance (handles 100K-1M+ points)
- Grid cell size = tolerance; check current cell + 8 XY neighbors
- Keys: `Math.floor(x / tolerance) + "_" + Math.floor(y / tolerance)` in a `Map`
- Squared distance comparison (no sqrt)
- Returns `{ uniquePoints: [], originalCount, uniqueCount }`
- Preserves all properties on point objects

### `decimatePoints(points, targetCount)`
- Moved from `decimatePointCloud` in `kirra.js:44241`
- Uniform stride-based sampling

---

## Step 2: Wire dedup + decimation into LAS triangulation

**File:** `src/fileIO/LasFileIO/LASParser.js` - `createTriangulatedSurface()` at line 733

Insert between vertex preparation (line 743) and Delaunay creation (line 762):

1. Extract `config.xyzTolerance` (already collected at line 1121) and `config.maxSurfacePoints` (new)
2. Decimate if `maxSurfacePoints > 0` (before dedup)
3. Deduplicate using `deduplicatePoints(vertices, xyzTolerance)`
4. Pass deduplicated vertices to `Delaunay.from()`

---

## Step 3: Wire dedup + decimation into Point Cloud triangulation

**File:** `src/kirra.js` - `createSurfaceFromPointsWithOptions()` at line 44100

Insert before Delaunator creation (line 44114):

1. Extract `config.xyzTolerance` (new) and `config.maxSurfacePoints` (new)
2. Decimate if `maxSurfacePoints > 0`
3. Deduplicate using `deduplicatePoints(points, xyzTolerance)`
4. Pass deduplicated points to `new Delaunator()`

---

## Step 4: Add Max Surface Points UI to LAS import dialog

**File:** `src/fileIO/LasFileIO/LASParser.js` - import dialog (~line 1065)

xyzTolerance input already exists. Add after it:
- **Max Surface Points** input: `id="las-max-surface-points"`, value=0, min=0, max=5000000, step=10000, hint "0 = no limit"

Wire in onConfirm handler (~line 1121):
```javascript
config.maxSurfacePoints = parseInt(document.getElementById("las-max-surface-points").value) || 0;
```

---

## Step 5: Add dedup/decimation UI to Point Cloud import dialog

**File:** `src/kirra.js` - `showPointCloudImportDialog()` at line 43779

Add to surface triangulation options section (after min angle controls ~line 43926, before surface style):
- **XY Tolerance** input: `id="pc-xyz-tolerance"`, value=0.001, min=0.001, max=10, step=0.001, hint "Merge points within this XY distance"
- **Max Surface Points** input: `id="pc-max-surface-points"`, value=0, min=0, max=5000000, step=10000, hint "0 = no limit"

Wire in onConfirm handler (~line 44017):
```javascript
config.xyzTolerance = parseFloat(pcXyzToleranceEl.value) || 0.001;
config.maxSurfacePoints = parseInt(pcMaxSurfPointsEl.value) || 0;
```

Increase dialog height by ~80px.

---

## Files Summary

| File | Change |
|------|--------|
| `src/helpers/PointDeduplication.js` | **NEW** - Spatial hash XY dedup + decimation |
| `src/fileIO/LasFileIO/LASParser.js` | Wire dedup into `createTriangulatedSurface` + add Max Surface Points UI |
| `src/kirra.js` ~44100 | Wire dedup into `createSurfaceFromPointsWithOptions` |
| `src/kirra.js` ~43779 | Add XY Tolerance + Max Surface Points UI to point cloud dialog |

---

## Implementation Order

1. Create `PointDeduplication.js` (no dependencies)
2. Wire into LASParser + add LAS dialog UI (depends on 1)
3. Wire into kirra.js + add point cloud dialog UI (depends on 1)

---

## Verification

1. Import a LAS file as surface - console should log dedup stats showing reduced point count
2. Set Max Surface Points to 50000 on a large import - verify decimation occurs
3. Both dialogs show consistent dedup/decimation options in surface mode
4. Constrained triangulation (`createConstrainautorMesh`) still works unchanged
