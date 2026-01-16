# Renderer and Entity Layers Implementation Plan

**Date:** 2026-01-16
**Branch:** cursor/renderer-and-entity-layers-c577

## Overview

This plan addresses the need for responsive handling of lines, line segments, and point clouds in Kirra's CAD mine design application. It covers:

1. **Renderer Consolidation** - Remove ThreeRenderer.js, use ThreeRendererV2.js exclusively
2. **Layer System** - Implement layers for KAD entities and surfaces
3. **LOD (Level of Detail)** - Optimize 3D rendering based on distance/zoom
4. **Super-batching & Instancing** - Maximize GPU efficiency for large datasets

## Current State Analysis

### ThreeRenderer Status
- `ThreeRendererV2.js` is already imported and aliased as `ThreeRenderer` in kirra.js (line 46)
- There's a conditional switch `useExperimental3DRenderer` that's no longer needed
- Both files have nearly identical APIs, V2 has cleaner architecture

### Existing Batching/Instancing
- `InstancedMeshManager.js` - Handles instanced rendering for blast holes (collar/grade/toe circles)
- `GeometryFactory.js` has:
  - `createSuperBatchedPoints()` - Single THREE.Points for all KAD points
  - `createSuperBatchedCircles()` - Single LineSegments for all circles
  - `createSuperBatchedLines()` - Batched lines (currently chunked)
  - `createBatchedPolyline()` - Single mesh for polyline entities

## Implementation Plan

### Phase 1: Renderer Consolidation

**Goal:** Remove ThreeRenderer.js and make ThreeRendererV2.js the sole renderer.

**Files to Modify:**
- `src/kirra.js` - Remove dual-renderer logic, direct import of V2
- `src/three/ThreeRendererV2.js` - Rename to ThreeRenderer.js

**Changes:**
1. Update import in kirra.js to use V2 directly
2. Remove `useExperimental3DRenderer` conditional
3. Delete or archive old ThreeRenderer.js
4. Rename ThreeRendererV2.js to ThreeRenderer.js

### Phase 2: Layer System for KAD Entities

**Goal:** Support multiple KAD files with individual layer visibility/properties.

**Data Structure:**
```javascript
// Layer object for KAD entities
{
  id: string,           // "kad_{filename}"
  name: string,         // Display name
  entityType: string,   // "kad"
  visible: boolean,     // Layer visibility
  opacity: number,      // 0.0 - 1.0
  color: string,        // Override color (optional)
  entities: Map(),      // entityName -> entities array
  threeObjects: [],     // THREE.Object3D references
  stats: {
    pointCount: number,
    lineCount: number,
    polygonCount: number,
    circleCount: number,
    textCount: number
  }
}
```

**New Files:**
- `src/three/LayerManager.js` - Central layer management class

**ThreeRendererV2 Updates:**
- Add `layersGroup` as parent group
- Modify `kadGroup` to be per-layer sub-groups
- Add methods: `createLayer()`, `removeLayer()`, `setLayerVisibility()`, `getLayerStats()`

### Phase 3: Layer System for Surfaces

**Goal:** Support multiple surfaces with individual layer properties.

**Data Structure:**
```javascript
// Layer object for surfaces
{
  id: string,           // "surface_{filename}"
  name: string,         // Display name
  entityType: string,   // "surface"
  visible: boolean,
  opacity: number,
  gradient: string,     // "default", "texture", "hillshade", etc.
  minLimit: number,     // Elevation clamp min
  maxLimit: number,     // Elevation clamp max
  threeObject: THREE.Mesh,
  stats: {
    triangleCount: number,
    vertexCount: number,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ }
  }
}
```

### Phase 4: LOD (Level of Detail) System

**Goal:** Automatically adjust rendering detail based on camera distance/zoom.

**LOD Levels:**
```javascript
LOD_LEVELS = {
  FULL: { maxTriangles: Infinity, lineDetail: 1.0, pointSize: 1.0 },
  HIGH: { maxTriangles: 100000, lineDetail: 1.0, pointSize: 1.0 },
  MEDIUM: { maxTriangles: 50000, lineDetail: 0.5, pointSize: 1.5 },
  LOW: { maxTriangles: 10000, lineDetail: 0.25, pointSize: 2.0 },
  MINIMAL: { maxTriangles: 1000, lineDetail: 0.1, pointSize: 4.0 }
}
```

**Implementation:**
1. Create `LODManager.js` class
2. Monitor camera zoom level changes
3. Swap geometry/materials based on LOD level
4. Use simplified geometry for distant/zoomed-out views

**LOD Strategies:**
- **Points:** Use larger point sizes at lower LOD (fewer draw calls with bigger sprites)
- **Lines:** Reduce vertex count via Douglas-Peucker simplification
- **Surfaces:** Pre-generate multiple triangle mesh LODs using mesh decimation
- **Text:** Hide text labels at lower LOD levels, show only at high zoom

### Phase 5: Enhanced Super-batching

**Goal:** Maximize GPU efficiency by merging all geometries of same type.

**Line Super-batching:**
```javascript
// Before: One LineSegments per entity
// After: Single LineSegments2 for ALL lines of same color/width

class LineBatcher {
  constructor() {
    this.batches = new Map(); // "color_width" -> {positions: [], colors: []}
  }
  
  addLine(points, color, width) { /* accumulate */ }
  
  finalize() {
    // Create single LineSegments2 per batch
  }
}
```

**Point Super-batching:**
```javascript
// Already implemented in createSuperBatchedPoints
// Enhance with:
// - Size variation per point
// - Color variation per point
// - GPU-based point picking
```

### Phase 6: KAD Point Instancing with THREE.Points

**Current State:** Points use individual meshes or single super-batched Points object.

**Enhancement:**
- Use THREE.Points with custom shader for:
  - Size-in-world-units (consistent visual size regardless of zoom)
  - Color per point via vertex colors
  - Selection highlighting via uniform/attribute

## File Changes Summary

### New Files
1. `src/three/LayerManager.js` - Layer management class
2. `src/three/LODManager.js` - Level of detail management
3. `src/three/LineBatcher.js` - Optimized line batching
4. `src/three/PointBatcher.js` - Optimized point batching (THREE.Points)

### Modified Files
1. `src/kirra.js` - Renderer import, layer integration
2. `src/three/ThreeRendererV2.js` - Rename to ThreeRenderer.js, add layer support
3. `src/three/GeometryFactory.js` - LOD geometry generation
4. `src/draw/canvas3DDrawing.js` - Use LayerManager for drawing

### Deleted Files
1. `src/three/ThreeRenderer.js` - Old renderer (archived)

## Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| 10k points render | ~200ms | <50ms |
| 100k lines render | ~500ms | <100ms |
| Surface 50k tri | ~300ms | <100ms |
| Frame time (complex scene) | 30-50ms | <16ms |

## Testing Checklist

1. [ ] Load large KAD file (>100k entities) - verify performance
2. [ ] Toggle layer visibility - verify instant response
3. [ ] Zoom in/out - verify LOD transitions are smooth
4. [ ] Load multiple KAD files - verify independent layers
5. [ ] Load multiple surfaces - verify independent layers
6. [ ] Selection in super-batched geometry - verify accuracy
7. [ ] Dark mode toggle - verify all elements update
8. [ ] Export with layers - verify layer data preserved

## Implementation Order

1. Phase 1: Renderer Consolidation (minimal risk, cleanup)
2. Phase 2: KAD Layer System (foundational for other phases)
3. Phase 5: Enhanced Super-batching (immediate performance win)
4. Phase 3: Surface Layer System
5. Phase 6: Point Instancing
6. Phase 4: LOD System (most complex, depends on other phases)

## Notes

- All changes must maintain backward compatibility with existing KAD/surface data
- Layer system should integrate with existing TreeView for UI
- LOD system should be transparent to user (automatic quality adjustment)
- Super-batching must preserve selection/picking capability
