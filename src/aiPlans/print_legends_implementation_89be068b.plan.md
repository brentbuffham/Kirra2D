---
name: Print Legends Implementation
overview: Fix printout issues - add legends, refactor Blast Statistics and Connector Count (remove broken VoronoiMetrics), fix Vector PDF export.
todos:
  - id: refactor-blast-statistics
    content: Refactor BlastStatistics.js - remove VoronoiMetrics, use getBlastEntityVolume and hole-level data (like TreeView)
    status: pending
  - id: refactor-connector-count
    content: Connector Count - count actual connectors per type (holes with fromHoleID !== self), not hole delay groups
    status: pending
  - id: export-legend-state
    content: Add getActiveLegends() export to LegendPanel.js and index.js
    status: pending
  - id: vector-pdf-legends
    content: Add legend drawing functions to PrintVectorPDF.js (slope, relief, voronoi, surface)
    status: pending
  - id: update-print-context
    content: Update PrintSystem.js to pass activeLegends through context
    status: pending
  - id: raster-pdf-legends
    content: Connect PrintRendering.js legend calls to active legend state
    status: pending
  - id: test-all-legends
    content: Test all 4 legend types in both Vector and Raster PDF outputs
    status: pending
isProject: false
---

# Printout Fixes - Legends, Blast Stats, Connector Counts, Vector PDF

## Reference Templates

- [PrintoutTemplateLAND.pdf](Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf) - Landscape layout
- [PrintoutTemplatePORT.pdf](Kirra2D/src/referenceFiles/PrintoutTemplatePORT.pdf) - Portrait layout

Template structure shows CONNECTOR COUNT, BLAST STATISTICS, and LEGEND sections.

---

## Issue 1: Blast Statistics and Connector Count - Refactor (Remove Broken VoronoiMetrics)

### Background

**VoronoiMetrics was broken** - producing incorrect values. The system now uses other approaches, like the TreeView.

**TreeView approach** ([TreeView.js](Kirra2D/src/dialog/tree/TreeView.js) lines 1305-1318):

- Volume: `window.getBlastEntityVolume(holes, entityName)` - NOT VoronoiMetrics
- Burden, spacing: From hole properties (`hole.burden`, `hole.spacing`)
- Entity summary: Holes count, total length, volume

### Blast Statistics - Required Changes

**File:** [src/helpers/BlastStatistics.js](Kirra2D/src/helpers/BlastStatistics.js)

1. **Remove VoronoiMetrics dependency entirely** - do not call `getVoronoiMetrics`
2. **Volume** - Use only `window.getBlastEntityVolume` when available; if not, return 0 or fallback to hole-based estimate (no Voronoi)
3. **Burden, spacing, drill, holes** - Use hole-level data and row-based calculation (already present); fallback to hole.burden, hole.spacing properties
4. **Firing times** - Remove or derive from hole.timingDelayMilliseconds (not VoronoiMetrics); may be optional for Blast Statistics summary

**Signature change:** `getBlastStatisticsPerEntity(allBlastHoles)` - remove `getVoronoiMetrics` parameter (no longer needed).

**Callers to update:** PrintVectorPDF.js, PrintSystem.js, PrintStats.js, PrintPDFMake.js (4 files).

### Connector Count - Required Changes

**Current:** `groupHolesByDelay` groups ALL holes by `timingDelayMilliseconds` - counts holes, not connectors.

**Required:** Count **actual connectors** - holes where `fromHoleID !== entityName:::holeID` (a connector line exists). Group by type (e.g. `timingDelayMilliseconds` or `colorHexDecimal`).

**New helper:** `groupConnectorsByType(holes)` - filter to holes with connector (`fromHoleID` !== self), then group by delay (or color). Return `{ "25ms": { count: 12, color: "#..." }, ... }`.

**Files:** [PrintVectorPDF.js](Kirra2D/src/print/PrintVectorPDF.js), [PrintSystem.js](Kirra2D/src/print/PrintSystem.js) - update Connector Count section to use new connector-based grouping instead of `delayGroups` from BlastStatistics.

---

## Issue 2: Legends Not Showing on Printouts

### Problem

Voronoi, Relief, Slope, and Surfaces legends display in the view (via `LegendPanel.js` HUD overlay) but are not included in PDF printouts.

## Current Architecture

**View Legends:**

- `LegendPanel.js` manages legend state in `activeLegends` object
- State includes: `slope`, `relief`, `voronoi`, `surfaces` (array)
- Triggered via `showSlopeLegend()`, `showReliefLegend()`, `showVoronoiLegend()`, `showSurfaceLegend()`

**Printouts:**

- **Vector PDF** (`PrintVectorPDF.js`): NO legend rendering
- **Raster PDF** (`PrintRendering.js`): Has legend functions but not connected to active state

## Solution

### Step 1: Export Active Legend State

**File:** `[src/overlay/panels/LegendPanel.js](src/overlay/panels/LegendPanel.js)`

Add a new exported function to get the current legend state:

```javascript
// Step 11) Get active legends for printing
export function getActiveLegends() {
    return {
        slope: activeLegends.slope,
        relief: activeLegends.relief,
        voronoi: activeLegends.voronoi,
        surfaces: activeLegends.surfaces
    };
}
```

Update exports in `[src/overlay/index.js](src/overlay/index.js)` to include `getActiveLegends`.

### Step 2: Add Legend Drawing to Vector PDF

**File:** `[src/print/PrintVectorPDF.js](src/print/PrintVectorPDF.js)`

Add legend rendering functions after the map zone is drawn (around line 985, before footer rendering). Create helper functions:

- `drawSlopeLegendPDF(pdf, mapZone)` - Draw discrete slope color legend
- `drawReliefLegendPDF(pdf, mapZone)` - Draw discrete relief color legend  
- `drawVoronoiLegendPDF(pdf, mapZone, voronoiData)` - Draw gradient legend with min/max
- `drawSurfaceLegendPDF(pdf, mapZone, surfaces)` - Draw surface elevation legend

Position legends in top-left corner of map zone (matching view position).

### Step 3: Update Print Context

**File:** `[src/print/PrintSystem.js](src/print/PrintSystem.js)`

Add `getActiveLegends` import and pass legend state through context (lines 1173-1236):

```javascript
import { getActiveLegends } from "../overlay/index.js";
// In printContext object:
activeLegends: getActiveLegends()
```

### Step 4: Connect Raster PDF to Legend State

**File:** `[src/print/PrintRendering.js](src/print/PrintRendering.js)`

Modify `drawDataForPrinting()` to check `context.activeLegends` and call appropriate legend functions:

```javascript
// After data rendering, draw active legends
if (context.activeLegends) {
    if (context.activeLegends.slope) printLegend("black");
    if (context.activeLegends.relief) printReliefLegend("black");
    if (context.activeLegends.voronoi) printVoronoiLegendAndCells(...);
    if (context.activeLegends.surfaces?.length > 0) printSurfaceLegend(context);
}
```

## Legend Specifications

**Position:** Top-left corner of map zone with 5mm padding (matching HUD position)

**Dimensions (mm):**

- Slope: 35w x 55h (8 color categories)
- Relief: 45w x 75h (11 color categories)
- Voronoi: 35w x 50h (gradient bar with min/max)
- Surface: 40w x 70h per surface (gradient + elevation labels)

**Colors:** Use same color values as `LegendPanel.js` defaults:

- Slope: Blue to Purple gradient (8 steps)
- Relief: DeepRed to Purple (11 steps) 
- Voronoi: Blue-Cyan-Green-Yellow-Red gradient
- Surface: Matches surface gradient setting (viridis, turbo, etc.)

**Background:** White with thin black border (matching existing print legend style from commentary)

## Files to Modify

1. `**[src/helpers/BlastStatistics.js](Kirra2D/src/helpers/BlastStatistics.js)**` - Remove VoronoiMetrics. Use getBlastEntityVolume for volume; hole-level burden/spacing. Add `groupConnectorsByType(holes)`. Remove getVoronoiMetrics parameter.
2. `**[src/print/PrintVectorPDF.js](Kirra2D/src/print/PrintVectorPDF.js)**` - Connector Count: use `groupConnectorsByType` instead of delayGroups. Pass allBlastHoles only (no getVoronoiMetrics).
3. `**[src/print/PrintSystem.js](Kirra2D/src/print/PrintSystem.js)**` - Connector Count (raster): same change. Remove getVoronoiMetrics from print context.
4. `**[src/print/PrintStats.js](Kirra2D/src/print/PrintStats.js)**` - Update getBlastStatisticsPerEntity(allBlastHoles) calls (remove getVoronoiMetrics).
5. `**[src/print/PrintPDFMake.js](Kirra2D/src/print/PrintPDFMake.js)**` - Same update.
6. `[src/overlay/panels/LegendPanel.js](src/overlay/panels/LegendPanel.js)` - Add `getActiveLegends()` export
7. `[src/overlay/index.js](src/overlay/index.js)` - Export getActiveLegends
8. `[src/print/PrintSystem.js](Kirra2D/src/print/PrintSystem.js)` - Import getActiveLegends, pass activeLegends through context
9. `[src/print/PrintVectorPDF.js](Kirra2D/src/print/PrintVectorPDF.js)` - Add vector legend drawing functions
10. `[src/print/PrintRendering.js](Kirra2D/src/print/PrintRendering.js)` - Connect raster legends to active state

## Implementation Order

1. **Refactor BlastStatistics.js** - Remove VoronoiMetrics; add groupConnectorsByType
2. **Update PrintVectorPDF.js and PrintSystem.js** - Use new BlastStatistics API; Connector Count via groupConnectorsByType
3. **Add legends** - getActiveLegends, legend drawing in Vector/Raster PDF

## Testing

- Vector PDF export - should complete without failure
- Connector Count cell - should show connectors per type (e.g. "25ms: 12") for holes with fromHoleID !== self
- Blast Statistics cell - should show Holes, Burden, Spacing, Drill, Volume
- Print with Voronoi (PF metric) enabled - legend should appear
- Print with Slope map enabled - legend should appear
- Print with Relief/Burden map enabled - legend should appear
- Print with Surface elevation coloring - legend should appear
- Print with multiple legends active - all should stack vertically
- Test both Vector and Raster PDF output types

