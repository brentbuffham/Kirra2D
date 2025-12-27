# 3D Level of Detail (LOD) Performance Optimization Plan

**Date**: 2025-12-27
**Status**: Implementation Complete - Testing Required

## Problem Statement

Large DXF imports crash the 3D view because:

1. KAD lines/polygons in 3D draw EVERY segment without simplification (unlike 2D which uses `simplifyByPxDist`)
2. Each segment creates a separate MeshLine mesh (100K segments = 100K draw calls)
3. Each hole creates a separate THREE.Group with multiple child meshes

## Implementation Summary

### Stage 1: LOD Simplification for KAD Entities (COMPLETE)

**Goal**: Apply the same pixel-distance simplification to 3D that 2D already uses.

**Files Modified**:
- `src/kirra.js` - Added `simplifyByPxDist3D()` and `worldToScreen3D()` functions
- `src/kirra.js` - Modified 3D KAD drawing loop to use simplification when `use3DSimplification` is enabled

**Key Changes**:
1. Added `simplifyByPxDist3D(points, pxThreshold)` function that projects 3D points to screen space
2. Added `worldToScreen3D(worldX, worldY, worldZ, camera, canvas)` helper function
3. Modified line/polygon drawing to use simplified points when enabled
4. Vertex selection markers still use original points (not simplified) for accurate selection

### Stage 2: Instanced Rendering for Holes (COMPLETE)

**Goal**: Replace individual hole Groups with THREE.InstancedMesh for performance gains.

**Files Modified**:
- `src/three/ThreeRenderer.js` - Added instance management properties and methods
- `src/three/GeometryFactory.js` - Added `createInstancedHoles()` method
- `src/three/InteractionManager.js` - Modified `findClickedHole()` to handle instanceId
- `src/kirra.js` - Added feature flag logic and instanced rendering integration

**Key Changes**:
1. ThreeRenderer now has `instancedCollars`, `instancedGrades`, and mapping tables
2. GeometryFactory can create InstancedMesh objects for all holes in one call
3. InteractionManager detects instanceId in raycasts and maps to hole data
4. Move tool supports both instanced and non-instanced holes

## UI Controls

Added to `kirra.html` (lines 2019-2021):
```html
<input type="checkbox" id="use3DSimplification" checked> Use 3D Simplification
<input type="checkbox" id="useInstancedHoles" > Use Instanced Holes
```

- **Use 3D Simplification**: Enabled by default - reduces segments when zoomed out
- **Use Instanced Holes**: Disabled by default - use for testing with large hole counts

## Validation Checklist

### Stage 1 Testing (LOD Simplification)
- [ ] Load small DXF - verify all lines render correctly
- [ ] Zoom out - verify lines simplify (fewer segments drawn)
- [ ] Zoom in - verify detail returns
- [ ] Select KAD line - verify selection still works
- [ ] Right-click KAD line - verify context menu works
- [ ] Move KAD vertex - verify manipulation works
- [ ] Performance: Check render time with large DXF before/after

### Stage 2 Testing (Instanced Holes)
- [ ] Load pattern with 10 holes - verify rendering matches original
- [ ] Load pattern with 1000+ holes - verify performance improvement
- [ ] Single-click hole - verify selection works
- [ ] Shift-click multiple holes - verify multi-select works
- [ ] Box select holes - verify selection works
- [ ] Right-click hole - verify context menu works
- [ ] Move tool: drag single hole - verify position updates
- [ ] Move tool: drag multiple holes - verify all update
- [ ] Undo/redo hole move - verify works
- [ ] Delete hole - verify instance removed correctly
- [ ] Add new hole - verify instance added correctly
- [ ] Toggle between 2D/3D - verify consistency

## Rollback Strategy

Both features are controlled by UI checkboxes that can be toggled at runtime:
1. Uncheck "Use 3D Simplification" to disable LOD
2. Uncheck "Use Instanced Holes" to disable instancing

## Performance Expectations

| Metric | Before | After Stage 1 | After Stage 2 |
|--------|--------|---------------|---------------|
| Large DXF load time | Crashes | Under 5 seconds | Under 3 seconds |
| Draw calls (1000 holes) | ~3000 | ~3000 | ~100 |
| FPS during orbit | Low | 30+ FPS | 60 FPS |

## Technical Notes

1. **3D Simplification** uses the camera's projection matrix to calculate screen-space pixel distances
2. **Instanced Holes** only kicks in when there are >10 holes (to avoid overhead for small patterns)
3. Vertex selection markers are NOT simplified to maintain accurate vertex picking
4. Connectors, text labels, and highlights are still drawn per-hole (not instanced)

