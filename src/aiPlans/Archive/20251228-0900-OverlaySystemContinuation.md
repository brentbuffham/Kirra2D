# Overlay System Continuation Plan
**Created**: 2025-12-28 09:00 AWST

## Current Status: ✅ Phase 1 Complete

### Completed Features
1. **HUD Overlay Infrastructure** (`src/overlay/`)
   - `HUDOverlay.js` - Main coordinator
   - `OverlayEventBus.js` - Event-driven pub/sub system
   - `StatsPanel.js` - Stats, coords, scale, ruler, protractor, version
   - `StatusPanel.js` - Status messages, selection info, tooltips
   - `LegendPanel.js` - Slope, Relief, Voronoi legends
   - `SurfaceLegendPanel.js` - Multi-surface elevation legends

2. **2D Integration** ✅
   - Stats display (Blasts, Holes, Points, Lines, Poly, Circles, Text)
   - Mouse 2D coordinates + Scale
   - World 3D coordinates with snap indicator (🧲)
   - Snap detection via `snapHighlight`
   - Ruler L1/L2 measurements
   - Protractor angles (P1->P2, P2->P3, Inner, Outer)
   - Version display

3. **3D Integration** ✅ (just fixed)
   - `handle3DMouseMove` now emits coordinates to HUD
   - 3D snap detection working with `snapToNearestPointWithRay`
   - `snapHighlight` set correctly in 3D path

4. **Legends** ✅
   - Slope legend with degrees (°)
   - Relief legend with ms/m units and correct colors
   - Voronoi legends with appropriate units (kg/m³, kg, m³, m², m, ms)
   - Legends hide when options unchecked (2D and 3D)
   - Flat materials for 3D meshes (no Phong dulling)

5. **Selection Display** ✅
   - Pink background for selection messages
   - Multi-selection capped at 10 hole IDs + total count
   - Removed old ctx/ThreeJS pink text

---

## Phase 2: Enhancements (Next Steps)

### Priority 1: Ruler/Protractor CSS Panels
**Description**: Move ruler and protractor display from ctx canvas to CSS panels that follow the mouse.
**Files**: `src/overlay/panels/RulerPanel.js`, `src/overlay/panels/ProtractorPanel.js`
**Notes**: 
- Panel should appear near mouse position
- Update in realtime as mouse moves
- Consider: CSS transform for smooth movement or fixed position near cursor
- Need to work in both 2D and 3D

### Priority 2: Surface Legend Panel
**Description**: Implement the right-side surface elevation legend for loaded surfaces.
**Files**: `src/overlay/panels/SurfaceLegendPanel.js`
**Data Source**: `allSurfaces` array, surface name and min/max elevations
**Notes**:
- Show each loaded surface with name and elevation range
- Color-coded by surface type

### Priority 3: Tooltip System
**Description**: Context-aware tooltips on hover for holes, KAD elements.
**Files**: `src/overlay/panels/TooltipPanel.js`
**Notes**:
- Show hole info on hover (ID, position, depth, timing)
- Show KAD point/line info on hover
- Delay before showing (300ms?)
- Position near cursor but not obstructing

### Priority 4: 3D Tool Prompts via HUD
**Description**: Replace `drawToolPromptThreeJS()` with HUD-based prompts.
**Current**: 3D text sprites in scene
**Target**: CSS text at top of screen (like status messages)
**Notes**:
- Tool prompts should use same StatusPanel
- Different styling for tool hints vs status messages?

---

## Phase 3: Advanced Features (Future)

### 3.1 Mini-Map / Overview Panel
- Small overview showing full blast extent
- Current viewport rectangle
- Quick navigation by clicking

### 3.2 Time Chart Integration
- Show timing chart summary in HUD
- Link to full chart dialog

### 3.3 Print Preview Overlay
- Visual indicators for print margins
- Page break indicators

### 3.4 Dark Mode Enhancements
- Automatic color adaptation
- Contrast improvements for legends

---

## Technical Notes

### Event Bus Events
```javascript
OverlayEvents = {
    STATUS: "overlay:status",
    COORDINATES: "overlay:coordinates",
    SELECTION: "overlay:selection",
    MEASUREMENTS: "overlay:measurements",
    LEGEND: "overlay:legend",
    VIEW_TOGGLE: "overlay:viewToggle",
    MODE_CHANGE: "overlay:modeChange",
    CLEAR: "overlay:clear",
    STATS: "overlay:stats",
    SURFACE_LEGEND: "overlay:surfaceLegend",
    RULER: "overlay:ruler",
    PROTRACTOR: "overlay:protractor"
}
```

### Z-Index Architecture
```
Background           z-index: 0
Three.js Scene       z-index: 1 (canvas)
2D Canvas (ctx)      z-index: 2
HUD Overlay          z-index: 100
Toolbars/Sidenav     z-index: 500+
Dialogs/Modals       z-index: 1000+
```

### Data Sources for HUD
| Display Item | Source Variable | Update Trigger |
|-------------|-----------------|----------------|
| Blasts | `allEntities.size` | drawData |
| Holes | `allBlastHoles.length` | drawData |
| Points/Lines/etc | KAD counts | drawData |
| Mouse 2D | `canvasMouseX/Y` | handleMouseMove / handle3DMouseMove |
| World 3D | `currentMouseWorldX/Y/Z` | handleMouseMove / handle3DMouseMove |
| Scale | `currentScale` | drawData |
| Snapped | `snapHighlight !== null` | handleMouseMove / handle3DMouseMove |
| Version | `buildVersion` | static |

---

## Files Modified in Phase 1

### New Files Created
- `src/overlay/OverlayEventBus.js`
- `src/overlay/HUDOverlay.js`
- `src/overlay/panels/StatusPanel.js`
- `src/overlay/panels/StatsPanel.js`
- `src/overlay/panels/LegendPanel.js`
- `src/overlay/panels/SurfaceLegendPanel.js`
- `src/overlay/index.js`

### Files Modified
- `src/kirra.js` - HUD integration, emitCoords calls, legend show/hide
- `src/kirra.css` - HUD panel styling
- `src/three/GeometryFactory.js` - Flat materials, color fixes

### Files Deleted
- `src/overlay/OverlayManager.js` (renamed to HUDOverlay.js)
- `src/overlay/panels/CoordinatesPanel.js` (merged into StatsPanel)
- `src/overlay/panels/SelectionPanel.js` (merged into StatusPanel)
- `src/overlay/panels/ViewButtonsPanel.js` (removed - existing UI handles this)

---

## Known Issues / TODO
1. [ ] Test snap indicator in various 3D view angles
2. [ ] Verify legend colors match mesh colors exactly
3. [ ] Test performance with large datasets (1000+ holes)
4. [ ] Add localStorage persistence for HUD preferences
5. [ ] Consider collapsible/expandable legend sections
6. [ ] Scale display calculation needs proper implementation (see Bug section)
7. [ ] Ruler tool info box (Z1, Z2, Plan, Total, ΔZ, Angle, Slope) - works well, consider CSS panel
8. [ ] 3D HUD coordinate updates need testing
9. [ ] Snap magnet icon (🧲) needs verification in both 2D and 3D

---

## Bug Fixes Required

### BUG: Scale Display Not Working Correctly 🔴 NEEDS FIX
**Issue**: Scale display showing `1:0.0` - the calculation is not correct.

**Current Symptoms**:
- Image shows `Scale[1:0.0]` regardless of zoom level
- The `1/currentScale` approach produces very small numbers that round to 0.0

**Expected Behavior**:
- Zoomed IN (close to data) → Scale approaches **1:1** (1m on screen = 1m in world)
- Zoomed OUT (far from data) → Scale shows **1:1000** or larger (1m on screen = 1000m in world)
- The red 1m scale bar in image 2 should correlate with the displayed ratio

**Root Cause Analysis Needed**:
1. What does `currentScale` actually represent? (zoom multiplier? pixels per unit?)
2. Need to understand the relationship between:
   - `currentScale` variable
   - The 1m scale bar size in pixels
   - Canvas width/height
   - World coordinate extent

**Proper Scale Calculation**:
```javascript
// Option 1: Based on screen DPI and world extent
// scaleRatio = (worldExtent in meters) / (canvasWidth in meters at screen)

// Option 2: Based on 1m reference
// If 1m = X pixels on screen, and screen is 96 DPI (standard)
// Then scale = X pixels / (1m * 96 pixels/inch * 39.37 inches/m)

// Option 3: Use existing scale bar logic
// The red "1m" box is already calculating pixel size for 1 meter
// scaleRatio = canvasWidthPixels / (1mInPixels)
```

**Files to Investigate**:
- `src/kirra.js` - search for scale bar drawing code (the red 1m box)
- `src/overlay/panels/StatsPanel.js` - current display logic
- Look for `drawScaleBar` or similar function

**Reference**: Image 2 shows a red "1m" scale bar - that calculation is correct, we should derive the ratio from the same logic.

