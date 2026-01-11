# Information Overlay System Plan (REVISED v2)

**Date:** 2025-12-26 17:00  
**Revised:** 2025-12-27 19:45  
**Author:** AI Assistant  
**Status:** APPROVED - Ready for implementation

## Problem Statement

Currently, information text is rendered in multiple incompatible ways:

- **2D mode**: `ctx.fillText()` draws directly on canvas
- **3D mode**: `drawToolPromptThreeJS()` renders text as 3D sprites (looks bad)
- **No shared solution**: Inconsistent display between 2D/3D modes

## Solution: Unified HUD Overlay

A **single HTML/CSS overlay** (crispest text rendering) that sits between the rendering layers and the UI controls. Both 2D and 3D modes share this HUD.

## Z-Index Sandwich Architecture

```
┌─────────────────────────────────────────────────────┐
│  TOOLBARS, SIDENAV, VIEWBUTTONS, TREEVIEW          │  z-index: 200+
├─────────────────────────────────────────────────────┤
│  HUD OVERLAY (NEW)                                  │  z-index: 100
├─────────────────────────────────────────────────────┤
│  CTX CANVAS (2D drawing)                           │  z-index: 2
├─────────────────────────────────────────────────────┤
│  THREE.JS SCENE (3D rendering)                     │  z-index: 1
└─────────────────────────────────────────────────────┘
```

## HUD Layout (User Specification)

```
+------------------------------------------------------------------------------------------+
|                        [Status/Selection/ToolTips]                                       |
|                                                                                          |
|                                                                                          |
|  [Legend]                                                    [Surface Elevation]         |
|  Slope / Relief                                              Surf1 | Surf2 | Surf3      |
|  0°-5°   ████                                                                            |
|  5°-7°   ████                                                                            |
|  7°-9°   ████                                                                            |
|  ...                                                                                     |
|                                                                                          |
|                                                                                          |
|                                                                                          |
| Blasts[#] Holes[#]                                                                       |
| Point[#] Lines[#] Poly[#] Circles[#] Text[#]                                            |
| Mouse 2D [X: #.###, Y:#.###] Scale[1:###.#]                                            |
| World 3D [X: #.###, Y: #.###, Z: #.###]                                                 |
| L1[#.###] L2[#.###]                                                                      |
| P1->P2[#.#°] P2->P3[#.#°] Inner[#.#°] Outer[#.#°]                                       |
| Ver: XXXXX.XXX                                                                           |
+------------------------------------------------------------------------------------------+
```

## HUD Panels

### 1. Status/Selection/ToolTips Panel (Top Center)

- Status messages: "Editing Hole 167 in ISEE_OTHER"
- Selection info: "Selected 5 holes"
- Tool tips: "Click to set start point"
- Auto-clears after timeout

### 2. Legend Panel (Left Side)

- **Slope legend**: Color blocks with degree ranges (0°-5°, 5°-7°, etc.)
- **Relief legend**: Color blocks with relief values
- **Voronoi legend**: Color blocks with metric values
- Shows/hides based on displayOptions

### 3. Surface Legend Panel (Right Side)

- Multiple surface names displayed
- Shows elevation range per surface
- Shows/hides when surfaces are visible

### 4. Stats Panel (Bottom Left)

All in **11pt monospace font**:

```
Blasts[3] Holes[410]
Point[25] Lines[12] Poly[8] Circles[4] Text[15]
Mouse 2D [X: 511.000, Y: 957.000] Scale[1:10.3]
World 3D [X: 478754.560, Y: 6772247.390, Z: 125.500]
L1[12.543] L2[8.221]
P1->P2[45.2°] P2->P3[32.1°] Inner[77.3°] Outer[282.7°]
Ver: 20251113.0000AWST
```

## File Structure (Simplified)

```
src/overlay/
├── HUDOverlay.js              # Main HUD manager + DOM creation
├── OverlayEventBus.js         # Event system (existing, keep)
└── panels/
    ├── StatusPanel.js         # Top: status/selection/tooltips
    ├── LegendPanel.js         # Left: slope/relief/voronoi legends
    ├── SurfaceLegendPanel.js  # Right: surface elevation legends
    └── StatsPanel.js          # Bottom left: all stats + coords
```

## What Gets Deleted

- `ViewButtonsPanel.js` - DELETE (wrong approach)
- `CoordinatesPanel.js` - MERGE into StatsPanel
- `SelectionPanel.js` - MERGE into StatusPanel
- ViewButtonsPanel CSS in kirra.css - DELETE

## Implementation Phases

### Phase 1: Restructure Overlay (30 mins)

- [ ] Delete ViewButtonsPanel.js
- [ ] Create HUDOverlay.js (replaces OverlayManager.js)
- [ ] Set up proper z-index layering
- [ ] Create basic DOM structure

### Phase 2: StatsPanel (1 hour)

- [ ] Create StatsPanel.js
- [ ] Display: Blasts, Holes, KAD entity counts
- [ ] Display: Mouse 2D coordinates
- [ ] Display: World 3D coordinates
- [ ] Display: Ruler measurements (L1, L2)
- [ ] Display: Protractor measurements (angles)
- [ ] Display: Version
- [ ] 11pt monospace font
- [ ] Wire up to mouse move + data events

### Phase 3: StatusPanel (30 mins)

- [ ] Rewrite StatusPanel.js
- [ ] Combine status + selection + tooltips
- [ ] Top center positioning
- [ ] Auto-clear with configurable timeout

### Phase 4: LegendPanel (1 hour)

- [ ] Create LegendPanel.js
- [ ] Slope legend with color blocks
- [ ] Relief legend with color blocks
- [ ] Voronoi legend with color blocks
- [ ] Show/hide based on displayOptions
- [ ] Match existing legend colors exactly

### Phase 5: SurfaceLegendPanel (30 mins)

- [ ] Create SurfaceLegendPanel.js
- [ ] Display multiple surface names
- [ ] Show when surfaces visible
- [ ] Right side positioning

### Phase 6: Wire Up Events (1 hour)

- [ ] Connect to existing displayOptions
- [ ] Replace ctx.fillText() coordinate calls
- [ ] Replace drawLegend() canvas drawing
- [ ] Replace drawToolPromptThreeJS()
- [ ] Test in both 2D and 3D modes

**Total Estimated Time: 4-5 hours**

## CSS Styling

```css
/* HUD uses HTML for crispest text */
.hud-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 100;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 11pt;
}

.hud-panel {
    position: absolute;
    pointer-events: auto;
    color: #ffffff;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
}

/* Bottom left stats - no background, just text with shadow */
.hud-stats {
    bottom: 10px;
    left: 10px;
    line-height: 1.4;
}

/* Top center status */
.hud-status {
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    background: rgba(0, 0, 0, 0.7);
    padding: 6px 12px;
    border-radius: 4px;
}

/* Left legend */
.hud-legend {
    top: 80px;
    left: 10px;
}

/* Right surface legend */
.hud-surface-legend {
    top: 80px;
    right: 10px;
}
```

## Testing Checklist

- [ ] HUD visible in 2D mode
- [ ] HUD visible in 3D mode (same position/content)
- [ ] Stats update on mouse move
- [ ] Stats show correct counts (blasts, holes, KAD entities)
- [ ] Ruler measurements show when ruler active
- [ ] Protractor measurements show when protractor active
- [ ] Slope legend shows when slope enabled
- [ ] Relief legend shows when relief enabled
- [ ] Surface legend shows when surfaces visible
- [ ] Status messages appear and auto-clear
- [ ] Selection info shows when items selected
- [ ] All existing UI controls still work
- [ ] Text is crisp at all zoom levels (HTML/CSS rendering)

## Data Sources for Stats

| Stat | Source Variable |
|------|-----------------|
| Blasts count | `allBlastHoles` grouped by entityName |
| Holes count | `allBlastHoles.length` |
| Points count | KAD entities where entityType === "point" |
| Lines count | KAD entities where entityType === "line" |
| Polys count | KAD entities where entityType === "poly" |
| Circles count | KAD entities where entityType === "circle" |
| Text count | KAD entities where entityType === "text" |
| Mouse 2D | `event.offsetX`, `event.offsetY` (canvas coords) |
| Scale | `currentScale` (zoom level) |
| World 3D | `currentMouseWorldX`, `currentMouseWorldY`, `currentMouseWorldZ` |
| L1, L2 | Ruler tool measurements |
| Angles | Protractor tool measurements |
| Version | `buildVersion` |
