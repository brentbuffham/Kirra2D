# 2D Surface Analysis UX Improvements Plan

**Date:** 2026-01-10 02:00
**Status:** PLANNED
**Priority:** Medium
**Scope:** Voronoi, Relief, and Slope Map visualization enhancements for 2D canvas

## Overview

Improve the user experience for 2D surface analysis features (Voronoi diagrams, relief maps, slope maps) by adding interactive controls, better visual feedback, and streamlined workflows.

## Current State

### Voronoi Diagrams
- **Location:** Pattern menu → Voronoi options
- **Current Issues:**
  - No visual preview of settings before generation
  - Limited control over styling (colors, line widths)
  - No way to adjust after creation without regenerating
  - Hard to see Voronoi cells against complex backgrounds

### Relief Maps
- **Location:** Surface gradient options
- **Current Issues:**
  - Limited gradient customization
  - No real-time preview of color ramps
  - Difficult to adjust elevation range limits
  - No contour line overlay options

### Slope Maps
- **Location:** Surface analysis tools
- **Current Issues:**
  - No slope angle threshold controls
  - Limited color scheme options
  - No aspect (direction) visualization
  - Missing slope statistics display

## Goals

1. **Improve visual clarity** - Make surface analysis results easier to interpret
2. **Add real-time preview** - Show changes before applying them
3. **Enhance interactivity** - Allow adjustment of parameters with immediate feedback
4. **Better integration** - Connect analysis tools with other features (contours, holes, etc.)

## Implementation Plan

### Phase 1: Voronoi Enhancements (4-6 hours)

#### 1.1 Voronoi Settings Dialog Enhancement
**File:** `src/dialog/popups/patterns/VoronoiDialog.js`

**Add:**
- **Cell styling options:**
  - Cell fill color/opacity
  - Cell border color/width
  - Option to show/hide cell centers
  - Option to show/hide cell boundaries

- **Preview mode:**
  - Mini preview canvas showing sample Voronoi pattern
  - Updates in real-time as settings change
  - Shows actual hole colors if using pattern colors

- **Advanced options:**
  - Relaxation iterations (Lloyd's algorithm)
  - Boundary constraints (rectangular vs convex hull)
  - Random seed for reproducibility

#### 1.2 Voronoi Layer Control
**File:** `src/kirra.js` (add Voronoi state management)

**Add:**
- Store Voronoi data as separate layer (like KADs)
- Toggle visibility without regenerating
- Adjust opacity after creation
- Export Voronoi cells as DXF/SHP

**State Structure:**
```javascript
window.voronoiLayers = new Map(); // layerId -> {cells, style, visible}
```

#### 1.3 Interactive Voronoi Editing
**File:** `src/draw/canvas2DDrawing.js`

**Add:**
- Click to select Voronoi cell
- Highlight selected cell
- Right-click context menu:
  - "Assign hole to cell"
  - "Change cell color"
  - "Delete cell"
  - "Export cell boundary"

### Phase 2: Relief Map Enhancements (3-4 hours)

#### 2.1 Enhanced Gradient Picker
**File:** `src/dialog/popups/surfaces/SurfacePropertiesDialog.js`

**Add:**
- **Visual gradient editor:**
  - Show gradient bar preview
  - Click to add/remove color stops
  - Drag stops to adjust positions
  - Color picker for each stop

- **Preset gradients:**
  - Terrain (green → brown → white)
  - Rainbow (ROYGBIV)
  - Thermal (black → red → yellow → white)
  - Viridis/Turbo/Parula (existing scientific)
  - Custom (user-defined)

- **Elevation range controls:**
  - Min/max sliders with numeric input
  - "Auto" button to fit data range
  - "Symmetric" option to center around zero
  - Show histogram of elevation distribution

#### 2.2 Contour Overlay Integration
**File:** `src/kirra.js` (surface rendering)

**Add:**
- Option to overlay contour lines on relief maps
- Contour line styling (color, width, labels)
- Contour interval control (auto or manual)
- Toggle major/minor contours

**UI Location:** Surface Properties → "Show Contours" checkbox

#### 2.3 Relief Map Statistics
**File:** `src/helpers/SurfaceAnalysis.js` (new file)

**Add:**
- Calculate and display:
  - Min/max/mean elevation
  - Elevation range
  - Surface area (2D and 3D)
  - Volume above/below reference plane
  - Standard deviation

**UI Location:** Surface Properties → "Statistics" section

### Phase 3: Slope Map Implementation (4-6 hours)

#### 3.1 Slope Calculation Engine
**File:** `src/helpers/SurfaceAnalysis.js`

**Add:**
```javascript
class SurfaceAnalysis {
    // Calculate slope angle (degrees) for each triangle
    static calculateSlope(surface) {
        // For each triangle:
        // 1. Calculate normal vector
        // 2. Calculate angle from vertical
        // 3. Return slope in degrees
    }

    // Calculate aspect (direction) for each triangle
    static calculateAspect(surface) {
        // For each triangle:
        // 1. Project normal onto horizontal plane
        // 2. Calculate bearing (0-360)
        // 3. Return aspect direction
    }

    // Generate slope statistics
    static getSlopeStats(surface) {
        // Return: min, max, mean, histogram bins
    }
}
```

#### 3.2 Slope Map Visualization
**File:** `src/draw/canvas2DDrawing.js`

**Add:**
- **Slope gradient modes:**
  - Slope angle (0-90°)
  - Slope percentage (0-∞%)
  - Slope category (flat/gentle/moderate/steep/very steep)

- **Color schemes:**
  - Green (flat) → Red (steep)
  - Categorical (5 slope classes)
  - Custom thresholds

- **Rendering:**
  - Per-triangle coloring based on slope
  - Cache slope calculations (expensive)
  - Smooth interpolation option

#### 3.3 Slope Analysis Dialog
**File:** `src/dialog/popups/surfaces/SlopeAnalysisDialog.js` (new file)

**Create:**
```javascript
class SlopeAnalysisDialog extends FloatingDialog {
    constructor(surface) {
        // Dialog with:
        // - Surface selector dropdown
        // - Slope mode: Angle/Percentage/Category
        // - Color scheme selector with preview
        // - Threshold controls (min/max slider)
        // - Statistics display (histogram, mean, etc.)
        // - "Apply" button to render slope map
        // - "Export" button to save as raster/vector
    }
}
```

#### 3.4 Aspect Map Visualization
**File:** `src/draw/canvas2DDrawing.js`

**Add:**
- Aspect color wheel (N=red, E=yellow, S=cyan, W=magenta)
- Arrow overlays showing slope direction
- Integration with hillshade rendering

### Phase 4: Integration & Polish (2-3 hours)

#### 4.1 Menu Organization
**File:** `src/dialog/menuBar/viewMenu.js`

**Reorganize:**
```
View Menu
├── Surface Display
│   ├── Relief Map
│   │   ├── Gradient: [dropdown]
│   │   ├── Elevation Range...
│   │   └── Show Contours
│   ├── Slope Map...
│   ├── Aspect Map...
│   └── Hillshade Settings...
├── Voronoi Diagrams
│   ├── Generate Voronoi...
│   ├── Show/Hide Voronoi
│   └── Voronoi Settings...
└── Analysis Tools
    ├── Surface Statistics...
    ├── Volume Calculator...
    └── Profile Tool
```

#### 4.2 Keyboard Shortcuts
**File:** `src/helpers/KeyboardShortcuts.js`

**Add:**
- `V` - Toggle Voronoi visibility
- `Shift+R` - Relief map settings
- `Shift+S` - Slope analysis
- `Shift+C` - Toggle contours

#### 4.3 Performance Optimization
**Files:** `src/draw/canvas2DDrawing.js`, `src/helpers/SurfaceCache.js`

**Optimize:**
- Cache slope calculations per surface
- Invalidate cache only when surface changes
- Use Web Workers for expensive calculations
- Progressive rendering for large surfaces

#### 4.4 Export Capabilities
**File:** `src/io/writers/` (various)

**Add:**
- Export slope/aspect as GeoTIFF raster
- Export Voronoi cells as DXF/SHP polygons
- Export relief map as PNG with world file
- Export statistics as CSV/JSON

## Technical Considerations

### Coordinate System
- All calculations in **world coordinates (UTM)**
- Canvas rendering transforms to screen space
- Elevation values preserved (no Z scaling)

### Performance Targets
- Slope calculation: < 100ms for 10k triangles
- Voronoi generation: < 500ms for 1000 holes
- Relief map rendering: < 50ms (cached)
- Interactive preview: < 16ms (60 FPS)

### Memory Management
- Cache slope/aspect per surface (clear on modification)
- Limit Voronoi layer count (warn at 5+)
- Use typed arrays for large datasets
- Dispose canvas caches when not visible

### Browser Compatibility
- Canvas 2D API (all modern browsers)
- No WebGL required (2D only)
- Fallback for missing features (graceful degradation)

## Testing Plan

### Unit Tests
- Slope angle calculation (known triangles)
- Aspect direction calculation (8 cardinal directions)
- Voronoi cell generation (simple patterns)
- Gradient interpolation (color accuracy)

### Integration Tests
- Generate Voronoi from blast holes
- Apply slope map to imported surface
- Change relief gradient and verify update
- Export/import analysis results

### User Acceptance Tests
1. Load DTM surface (10k+ triangles)
2. Apply relief map with custom gradient
3. Generate slope map and verify colors
4. Create Voronoi diagram from holes
5. Toggle visibility and adjust opacity
6. Export results as GeoTIFF and DXF

## Dependencies

### Existing Code
- `src/helpers/SurfaceRasterizer.js` - Relief map rendering
- `src/fileIO/SurpacIO/DTMParser.js` - Surface import
- `src/draw/canvas2DDrawing.js` - 2D rendering
- `src/dialog/FloatingDialog.js` - Dialog framework

### New Dependencies
- None (use existing Canvas 2D API)

### Optional Libraries
- **d3-delaunay** - Already used for Voronoi
- **chroma.js** - Advanced color interpolation (consider if needed)

## Timeline Estimate

- **Phase 1 (Voronoi):** 4-6 hours
- **Phase 2 (Relief):** 3-4 hours
- **Phase 3 (Slope):** 4-6 hours
- **Phase 4 (Polish):** 2-3 hours
- **Testing:** 2-3 hours

**Total:** 15-22 hours (2-3 days)

## Success Criteria

1. ✅ Users can customize Voronoi cell appearance
2. ✅ Relief maps show real-time gradient preview
3. ✅ Slope maps display with configurable thresholds
4. ✅ All analysis results can be exported
5. ✅ Performance meets targets (< 100ms calculations)
6. ✅ UI is intuitive and discoverable

## Future Enhancements

- **3D slope visualization** - Extrude steep areas
- **Curvature analysis** - Convex/concave regions
- **Drainage analysis** - Flow direction/accumulation
- **Cut/fill volumes** - Compare surfaces
- **Blast design overlay** - Show holes on slope map
- **Time series analysis** - Track surface changes
