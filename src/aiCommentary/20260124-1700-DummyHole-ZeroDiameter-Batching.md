# Dummy Hole and Zero-Diameter Hole Batching Optimization + Async Hole Drawing

**Date:** 2026-01-24 17:00
**Updated:** 2026-01-24 17:30 (Added async hole drawing with progress dialog)
**Issue:** Performance degradation with 5,342 draw calls and 11,187 geometries for 5,578 holes

## Problem Analysis

The Performance Monitor showed:
- 4 FPS (extremely low)
- Frame time: 150ms (avg: 72651.8ms!)
- Draw Calls: 5,342 (very high)
- Geometries: 11,187 (too many for 5,578 holes)

**Root Cause:** Dummy holes (holeLength === 0) and zero-diameter holes (holeDiameter === 0) were NOT using instanced/batched rendering. Each was creating individual `THREE.Group` and `THREE.Line` objects:

- Each dummy hole = 1 Group + 2 Line objects + 2 BufferGeometry instances
- Each zero-diameter hole = 1 Group + 2-3 Line objects + 2-3 BufferGeometry instances

This caused thousands of unnecessary draw calls and geometry allocations.

## Solution Implemented

### 1. InstancedMeshManager.js Changes

Added new batching infrastructure for dummy and zero-diameter holes:

**New Properties:**
- `dummyHoleBatches` - Map storing batched X-shape line segments by color
- `dummyHoleIndexMap` - Maps holeId to batch position for selection
- `zeroDiameterBatches` - Map storing batched square + track line segments
- `zeroDiameterIndexMap` - Maps holeId to batch position for selection

**New Methods:**
- `addDummyHoleToBatch(holeId, x, y, z, size, color)` - Adds X-shape as 2 line segments to batch
- `addZeroDiameterHoleToBatch(holeId, collarX, collarY, collarZ, gradeX, gradeY, gradeZ, toeX, toeY, toeZ, squareSize, subdrillAmount, isDarkMode)` - Adds square (4 segments) + track line to batch
- `colorToKey(color)` - Helper to convert hex color to batch key
- `keyToColor(colorKey)` - Helper to convert batch key back to hex color

**Updated Methods:**
- `flushLineBatches()` - Now builds batched meshes for dummy holes and zero-diameter holes in addition to regular hole body lines
- `clearLineBatches()` - Now clears dummy and zero-diameter batches and index maps
- `clearAll()` - Now clears all new batch types

### 2. canvas3DDrawing.js Changes

Updated `drawHoleThreeJS_Instanced()` to use batching instead of GeometryFactory:

**Before:**
```javascript
if (holeLength === 0 || isNaN(holeLength)) {
    const dummyGroup = GeometryFactory.createDummyHole(...);
    window.threeRenderer.holesGroup.add(dummyGroup);
    window.threeRenderer.holeMeshMap.set(hole.holeID, dummyGroup);
    return;
}
```

**After:**
```javascript
if (holeLength === 0 || isNaN(holeLength)) {
    manager.addDummyHoleToBatch(uniqueHoleId, collarLocal.x, collarLocal.y, collarZ, crossSize, collarColor);
    return; // Batched - no further processing needed
}
```

## Performance Impact

**Expected Improvement:**
- All dummy holes → 1-2 draw calls (one per color)
- All zero-diameter holes → 1-2 draw calls (one per color)
- Geometry count reduced from N*3 to just 1-2 per batch type

**Before:** N dummy holes = N*3 scene objects, N*2 geometries, N*2 draw calls
**After:** N dummy holes = 1-2 scene objects, 1-2 geometries, 1-2 draw calls

## Selection Behavior

**Note:** Batched dummy and zero-diameter holes no longer have individual mesh entries in `holeMeshMap`. Selection is still possible through:
1. Selection from 2D view
2. Box/polygon selection tools
3. The tracking maps (`dummyHoleIndexMap`, `zeroDiameterIndexMap`) can be used to implement click selection if needed later

The highlight functionality (`highlightSelectedHoleThreeJS`) still works because it creates highlight geometry from hole data, not from the hole mesh.

## Files Modified

1. `/src/three/InstancedMeshManager.js`
   - Added batching infrastructure for dummy and zero-diameter holes
   - Added helper methods for color conversion
   - Updated flush and clear methods

2. `/src/draw/canvas3DDrawing.js`
   - Updated `drawHoleThreeJS_Instanced()` to use batching for dummy and zero-diameter holes

## Part 2: Async Hole Drawing with Progress Dialog

### Problem
When loading large datasets (> 500 holes), the UI would freeze during 3D hole creation with no feedback to the user.

### Solution
Implemented async hole drawing that:
1. **Always uses async** for all hole counts (keeps UI responsive)
2. **Shows progress dialog** only when > 500 holes
3. **Processes holes in batches** of 100 with `requestAnimationFrame` yields

### Implementation

**New Function:** `drawHolesAsync()` in `kirra.js` (before `drawData`)

```javascript
async function drawHolesAsync(allBlastHoles, toeSizeInMeters3D, displayOptions3D, threeInitialized, threeRenderer, developerModeEnabled) {
    var HOLE_PROGRESS_THRESHOLD = 500;
    var BATCH_SIZE = 100;
    
    // Show progress dialog for > 500 holes
    if (totalHoles > HOLE_PROGRESS_THRESHOLD) {
        // Create FloatingDialog with progress bar
    }
    
    // Process holes in batches
    for (var batchStart = 0; batchStart < totalHoles; batchStart += BATCH_SIZE) {
        // Draw batch of holes
        // Update progress
        // Yield to browser: await requestAnimationFrame
    }
    
    // Flush batched lines
    // Close dialog
    // Trigger render
}
```

**Modified `drawData()`:**
- Uses `window._holeDrawingInProgress` flag to prevent duplicate async calls
- Calls `drawHolesAsync()` instead of synchronous loop

### Key Features
- **Progress bar** with percentage and hole count
- **Non-blocking UI** during hole creation
- **Batch processing** (100 holes at a time)
- **Automatic completion** - dialog closes after 500ms showing "Complete"

## Testing Checklist

- [ ] Load a dataset with dummy holes (holeLength = 0)
- [ ] Load a dataset with zero-diameter holes (holeDiameter = 0)
- [ ] Verify Performance Monitor shows reduced draw calls
- [ ] Verify Performance Monitor shows reduced geometry count
- [ ] Verify FPS improves
- [ ] Verify dummy holes display correctly (X shapes)
- [ ] Verify zero-diameter holes display correctly (squares with tracks)
- [ ] Verify highlighting works when selecting dummy/zero-diameter holes from 2D
- [ ] Test dark mode and light mode (color batching)
- [ ] Load dataset with > 500 holes - verify progress dialog appears
- [ ] Verify progress bar updates smoothly
- [ ] Verify UI remains responsive during hole creation
- [ ] Verify holes appear correctly after async completion
