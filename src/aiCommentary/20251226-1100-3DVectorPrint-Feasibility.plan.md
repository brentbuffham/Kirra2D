# 3D Vector Print Feasibility Assessment

## Overview

This document assesses the feasibility of implementing true vector output for 3D print views, analyzing each entity type and proposing a hybrid layered approach.

## Current State

- **2D Print**: True vector output - all entities rendered as PDF drawing commands
- **3D Print**: Raster capture of WebGL canvas - works but resolution-limited

## The Core Question

Can we project 3D entities through the camera matrix and render them as vectors in the PDF?

**Short answer**: Yes, for geometry. No, for shaded/textured content.

---

## Entity Analysis

### ✅ VECTOR CAPABLE - Geometry Only

| Entity Type | Complexity | Approach | Notes |
|-------------|------------|----------|-------|
| **Blast Holes** | Low | Project center point, draw circle at fixed screen size | Most common entity, high impact |
| **Connectors/Arrows** | Low | Project start/end points, draw line/arrow | Simple line projection |
| **KAD Points** | Low | Project point, draw marker | Trivial |
| **KAD Lines** | Low | Project endpoints, draw line | Trivial |
| **KAD Polylines** | Low | Project all vertices, draw path | Trivial |
| **KAD Circles** | Medium | Project center, but circle becomes ellipse in perspective | Need ellipse math |
| **KAD Polygons** | Medium | Project vertices, draw filled polygon | Need to handle self-intersection |
| **KAD Text** | Medium | Project position, draw text | Rotation/scaling from camera angle |
| **Contour Lines** | Low | Project all vertices, draw polylines | Already 2D polylines |
| **Hole Labels** | Medium | Project hole position, offset for label | Text positioning |
| **Delay Numbers** | Low | Project connector midpoint, draw text | Simple |

### ⚠️ HYBRID - Vector Outline, Raster Fill

| Entity Type | Complexity | Approach | Notes |
|-------------|------------|----------|-------|
| **Surfaces (wireframe)** | Medium | Project triangle edges, draw lines | Hidden line removal needed |
| **Surfaces (flat shaded)** | High | Project triangles, fill with solid color | Z-sorting for painter's algorithm |
| **Voronoi Cells** | Medium | Project cell vertices, draw polygons | Color fill is solid, can be vector |

### ❌ RASTER ONLY

| Entity Type | Why Raster? | Notes |
|-------------|-------------|-------|
| **Background Images** | Pixel data | No vector representation exists |
| **Surfaces (gradient/texture)** | Per-pixel shading | Lighting calculations are inherently raster |
| **Slope Maps** | Color gradients | Gradient fills per triangle |
| **Relief Maps** | Color gradients | Same as slope maps |

---

## Proposed Architecture: Layered Rendering

### Layer 1: Raster Background (if needed)
```
┌─────────────────────────────────────┐
│  Background Image (if visible)      │
│  + Shaded Surface (if gradient)     │
│                                     │
│  Rendered at 2x-4x resolution       │
│  Embedded as PNG in PDF             │
└─────────────────────────────────────┘
```

### Layer 2: Vector Geometry (always)
```
┌─────────────────────────────────────┐
│  • Blast holes (circles)            │
│  • Connectors (lines + arrows)      │
│  • KAD entities (paths)             │
│  • Contour lines (polylines)        │
│  • Labels/text                      │
│                                     │
│  Rendered as PDF vector commands    │
│  Infinitely scalable                │
└─────────────────────────────────────┘
```

### Rendering Decision Tree

```
For each entity in 3D view:
│
├─ Is it a background image?
│   └─ YES → Raster layer
│
├─ Is it a surface?
│   ├─ Wireframe mode? → Vector layer (lines)
│   ├─ Flat color fill? → Vector layer (polygons) [with z-sort]
│   └─ Gradient/textured? → Raster layer
│
├─ Is it geometry (holes, KAD, contours)?
│   └─ YES → Vector layer (always)
│
└─ Is it text/labels?
    └─ YES → Vector layer (always)
```

---

## Technical Implementation

### Camera Projection Math

```javascript
// For each 3D point (worldX, worldY, worldZ):

// 1. Create Three.js Vector3
const point = new THREE.Vector3(worldX, worldY, worldZ);

// 2. Project through camera (applies view + projection matrices)
point.project(camera);

// 3. Convert NDC (-1 to +1) to screen coordinates
const screenX = (point.x + 1) / 2 * canvasWidth;
const screenY = (1 - point.y) / 2 * canvasHeight;

// 4. Convert screen to PDF coordinates
const pdfX = mapZone.x + (screenX / canvasWidth) * mapZone.width;
const pdfY = mapZone.y + (screenY / canvasHeight) * mapZone.height;

// 5. Check if point is in front of camera (not behind)
const isVisible = point.z >= -1 && point.z <= 1;
```

### Hidden Line Removal (for surfaces)

**Option A: Painter's Algorithm (Simple)**
- Sort triangles by distance from camera (far to near)
- Draw in order - near triangles overwrite far ones
- Works for convex shapes, fails for complex intersections

**Option B: Z-Buffer Check (Medium)**
- Before drawing each vector element, sample the depth buffer
- Skip if something is in front
- Requires WebGL depth texture readback

**Option C: BSP Tree (Complex)**
- Build binary space partition of geometry
- Traverse front-to-back based on camera position
- Correct results but expensive to compute

**Recommendation**: For blast patterns, Option A is sufficient. Holes rarely occlude each other significantly.

---

## Implementation Phases

### Phase 1: High-Resolution Raster (Current Task)
- [ ] Render WebGL at 2x-4x resolution
- [ ] Capture and embed in PDF
- [ ] Works for all entity types
- **Effort**: 1-2 hours

### Phase 2: Vector Blast Holes + Connectors
- [ ] Project hole centers through camera matrix
- [ ] Draw as PDF circles at screen-space size
- [ ] Project connector endpoints, draw as lines
- [ ] Layer on top of raster background
- **Effort**: 4-6 hours

### Phase 3: Vector KAD Entities
- [ ] Project KAD points, lines, polylines
- [ ] Handle KAD polygons (filled)
- [ ] KAD circles → ellipses in perspective
- [ ] KAD text with rotation
- **Effort**: 6-8 hours

### Phase 4: Vector Contour Lines
- [ ] Project contour polyline vertices
- [ ] Draw as PDF paths with appropriate styling
- **Effort**: 2-3 hours

### Phase 5: Surface Wireframe (Optional)
- [ ] Project triangle edges
- [ ] Simple hidden line removal
- [ ] Draw as thin lines
- **Effort**: 8-12 hours

---

## User Options (Print Dialog)

```
3D Output Mode:
  ○ Raster Only (current - all entities as image)
  ○ Hybrid (raster background + vector geometry)  [RECOMMENDED]
  ○ Vector Only (geometry only, no images/shading)

Raster Resolution:
  ○ Screen (1x) - Fast, lower quality
  ○ Print (2x) - Balanced
  ○ High (4x) - Best quality, larger file
```

---

## Benefits of Hybrid Approach

1. **Best of both worlds**: Shaded surfaces look good, geometry is crisp
2. **Scalable text/labels**: Text remains sharp at any zoom
3. **Smaller file size**: Vector geometry is tiny compared to high-res raster
4. **Searchable text**: PDF text is selectable/searchable
5. **Editable in vector software**: Geometry can be modified in Illustrator/Inkscape

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Z-fighting between raster and vector layers | Ensure vector layer draws slightly "in front" |
| Performance with many holes | Batch hole drawing, use PDF optimization |
| Coordinate precision | Use double precision for projection math |
| Edge cases (camera inside geometry) | Clip to near plane, skip degenerate cases |

---

## Conclusion

**Recommended approach**: Implement hybrid layered rendering

1. **Immediate**: High-res raster capture (Phase 1) - quick win
2. **Short-term**: Vector blast holes + connectors (Phase 2) - biggest impact
3. **Medium-term**: Full vector geometry (Phases 3-4)
4. **Optional**: Surface wireframe (Phase 5) - only if requested

This gives users the option to have crisp, scalable geometry while preserving the visual fidelity of shaded surfaces and background images.

