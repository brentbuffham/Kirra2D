# Charge Visualization & Time Chart Enhancement Plan

## Context

The Kirra charging system (Deck, HoleCharging, Primer) exists but has no visual representation in 2D or 3D views. Users need to see charge configurations within holes, understand mass distribution over time, and export/import charging data via CBLAST. This plan adds:

1. **3D charge visualization** - Colored cylinders along hole tracks representing decks
2. **2D charge visualization** - Pie-chart/radial wedges around hole circles (per `hole_charging.html` reference)
3. **Display toggle** - Single button controlling charge visibility in both views
4. **massPerHole attribute** - Computed from `HoleCharging.getTotalExplosiveMass()`
5. **Time chart dropdown** - Replace radio buttons with 5 modes: Surface Hole Count, Measured Mass, Mass Per Hole, Deck Count, Mass Per Deck
6. **Mass Per Deck timing** - Deck fire time = holeTime (surface connector) + primer.totalDownholeDelayMs
7. **CBLAST updates** - Writer exports charging, Parser imports charging

---

## Phase 1: massPerHole Attribute & Data Plumbing

### 1.1 Add `massPerHole` to blast hole data model

**File:** `src/kirra.js` (BlastHole constructor area)
- Add `massPerHole = data.massPerHole || 0` to the blast hole object construction
- This is a **computed field** - not user-editable, not persisted to IndexedDB
- Recomputed from `window.loadedCharging` whenever charging changes

### 1.2 Create `src/helpers/ChargingMassHelper.js`

```javascript
export function recalcMassPerHole(allBlastHoles, loadedCharging) {
    // For each hole, lookup HoleCharging and set massPerHole
    for (const hole of allBlastHoles) {
        const charging = loadedCharging?.get(hole.holeID);
        if (charging) {
            hole.massPerHole = charging.getTotalExplosiveMass();
        } else {
            hole.massPerHole = 0;
        }
    }
}
```

- Call this from charging UI "Apply" actions (DeckBuilderDialog, SimpleRuleEngine)
- Call after KAP import / CBLAST import

---

## Phase 2: 3D Charge Visualization

### 2.1 Add `createChargeDeck()` to GeometryFactory

**File:** `src/three/GeometryFactory.js`
- New static method: `createChargeDeck(topPos, basePos, radiusMm, color, opacity)`
- Uses `THREE.CylinderGeometry` oriented along the collar-to-toe vector
- Returns a `THREE.Mesh` with `MeshBasicMaterial` (vertex-colored, transparent)
- Deck type colors:
  - **COUPLED** = Yellow `#f0e020`
  - **DECOUPLED** = Pink `#cc8cb8`
  - **INERT** = Brown `#c0937a`
  - **SPACER** = Light Blue `#78b0d4`
  - **PRIMER** = Red `#dd1111`

### 2.2 Create `src/draw/canvas3DChargeDrawing.js`

```javascript
export function drawChargesThreeJS(hole) {
    // 1. Lookup charging: window.loadedCharging.get(hole.holeID)
    // 2. If no charging, skip
    // 3. Compute collar-to-toe unit vector and hole direction
    // 4. For each deck:
    //    - Calculate world positions for topDepth and baseDepth along hole axis
    //    - Determine radius: COUPLED = holeDiameter, DECOUPLED = smaller (e.g., 70%)
    //    - Color by deck type
    //    - Call GeometryFactory.createChargeDeck()
    //    - Add to chargesGroup
    // 5. For each primer:
    //    - Place a small red diamond/sphere at lengthFromCollar position
    //    - Use GeometryFactory (add createPrimerMarker if needed)
}

export function clearChargesThreeJS() {
    // Remove all children from window.threeRenderer.chargesGroup
}
```

### 2.3 Add `chargesGroup` to ThreeRenderer

**File:** `src/three/ThreeRenderer.js`
- Add `this.chargesGroup = new THREE.Group()` alongside existing `holesGroup`
- Add to scene: `this.scene.add(this.chargesGroup)`
- Add `chargeMeshMap` for tracking (like `holeMeshMap`)

### 2.4 Wire into rendering pipeline

**File:** `src/kirra.js` (in the 3D drawing block, near drawHoleThreeJS calls)
- After drawing holes in 3D, if `displayOptions.charges` is true:
  - Call `clearChargesThreeJS()` then loop holes calling `drawChargesThreeJS(hole)`
- Only draw charges when toggle is on

---

## Phase 3: 2D Charge Visualization

### 3.1 Create `src/draw/canvas2DChargeDrawing.js`

Reference implementation: `src/referenceFiles/Diagrams/hole_charging.html`

```javascript
export function drawCharges2D(ctx, hole, x, y, radius, displayOptions) {
    // 1. Lookup charging: window.loadedCharging.get(hole.holeID)
    // 2. If no charging or !displayOptions.charges, skip
    // 3. Compute angular extent for each deck:
    //    - Total angle = 360 degrees
    //    - Each deck's angle = (deck.length / holeLength) * 360
    //    - Start from 270 degrees (top of circle, representing collar/stem)
    //    - Draw clockwise
    // 4. For each deck:
    //    - drawWedge/drawArc with appropriate color and radius:
    //      COUPLED: radius slightly smaller than borehole (fills hole)
    //      DECOUPLED: ring/arc (inner/outer radii) showing annular gap
    //      INERT: radius = borehole wall
    //      SPACER: extends slightly past borehole
    //    - Use same color scheme as 3D
    // 5. Draw black center circle (the hole) on top
    // 6. Draw primer indicators (small red wedges with blue diamond)
    // 7. Draw stem bar at 270 degrees (collar indicator)
}
```

- Colors match `hole_charging.html`: Brown=INERT, Yellow=COUPLED, Pink=DECOUPLED, Blue=SPACER, Red=PRIMER

### 3.2 Wire into 2D rendering

**File:** `src/kirra.js` (in `drawHoleMainShape` at line 31824 or after `drawHole()` call)
- After drawing the main hole circle, if `displayOptions.charges`:
  - Call `drawCharges2D(ctx, hole, x, y, diameterPx, displayOptions)`
  - This overlays charge visualization on top of the standard hole circle

---

## Phase 4: Display Toggle Button

### 4.1 Add HTML checkbox

**File:** `kirra.html` (in the display options toolbar, after `display16` / Voronoi)
- Add new checkbox with ID `displayCharges`:
```html
<input type="checkbox" id="displayCharges" name="display" value="charges">
<label for="displayCharges" class="icon-button" title="Charges">
    <!-- charge icon SVG or text -->
</label>
```

### 4.2 Add to getDisplayOptions()

**File:** `src/kirra.js` (line ~29004 `getDisplayOptions()`)
- Add: `charges: document.getElementById("displayCharges")?.checked || false`

### 4.3 Both 2D and 3D respect this single toggle

- 2D: `drawCharges2D` checks `displayOptions.charges`
- 3D: `drawChargesThreeJS` rendering block checks `displayOptions.charges`

---

## Phase 5: Time Chart Dropdown Enhancement

### 5.1 Replace radio buttons with dropdown

**File:** `kirra.html` (where `measuredMassRadio` and `holeCountRadio` are defined)
- Remove the two radio buttons
- Add a `<select>` dropdown:
```html
<select id="timeChartMode">
    <option value="holeCount">Surface Hole Count</option>
    <option value="measuredMass">Measured Mass</option>
    <option value="massPerHole">Mass Per Hole</option>
    <option value="deckCount">Deck Count</option>
    <option value="massPerDeck">Mass Per Deck</option>
</select>
```

### 5.2 Update timeChart() function

**File:** `src/kirra.js` (line ~28417, `timeChart()` function)
- Replace `measuredMassRadio`/`holeCountRadio` logic with `document.getElementById("timeChartMode").value`
- Mode logic:

| Mode | X-Axis | Y-Axis | Source |
|------|--------|--------|--------|
| `holeCount` | Time bin center | Count of holes in bin | `hole.holeTime` |
| `measuredMass` | Time bin center | Sum of `hole.measuredMass` | `hole.measuredMass` |
| `massPerHole` | Time bin center | Sum of `hole.massPerHole` | Computed from charging |
| `deckCount` | Time bin center | Count of explosive decks firing in bin | Decks with COUPLED/DECOUPLED type |
| `massPerDeck` | Time bin center | Sum of explosive deck masses firing in bin | Deck mass at deck fire time |

### 5.3 Mass Per Deck timing logic

For `massPerDeck` and `deckCount` modes:
```javascript
// For each hole with charging:
const charging = window.loadedCharging?.get(hole.holeID);
if (!charging) continue;
const holeTime = hole.holeTime || 0;  // Surface connector time

for (const deck of charging.decks) {
    // Only count explosive decks
    if (deck.deckType !== "COUPLED" && deck.deckType !== "DECOUPLED") continue;

    // Find primer for this deck
    const primer = charging.primers.find(p => p.deckID === deck.deckID);
    const downholeDelay = primer ? primer.totalDownholeDelayMs : 0;
    const deckFireTime = holeTime + downholeDelay;

    // Bin by deckFireTime instead of holeTime
    const binIndex = Math.floor((deckFireTime - binStart) / timeRange);
    if (binIndex >= 0 && binIndex < numBins) {
        deckCounts[binIndex]++;
        deckMassSum[binIndex] += deck.calculateMass(charging.holeDiameterMm);
    }
}
```

### 5.4 Update event listeners

**File:** `src/kirra.js` (line ~5783-5788)
- Remove radio button listeners
- Add: `document.getElementById("timeChartMode")?.addEventListener("change", timeChart);`

### 5.5 Update language translations

**File:** `src/kirra.js` (language system near line 6140)
- Add translations for new dropdown option labels

---

## Phase 6: CBLAST Format Updates

### 6.1 CBLASTWriter - Export charging data

**File:** `src/fileIO/CBlastIO/CBLASTWriter.js`
- After existing 4 records per hole (HOLE, PRODUCT, DETONATOR, STRATA), add:
  - **CHARGE** records: One per deck, with fields: deckType, topDepth, baseDepth, productName, density, mass
  - **PRIMER** records: One per primer, with fields: lengthFromCollar, detonatorName, delayMs, boosterName, boosterMass
- Source: `window.loadedCharging.get(hole.holeID)`
- If no charging for hole, omit CHARGE/PRIMER records (backward compatible)

### 6.2 CBLASTParser - Import charging data

**File:** `src/fileIO/CBlastIO/CBLASTParser.js`
- After parsing existing records, look for CHARGE and PRIMER records
- Create `HoleCharging` entry per hole that has charge data
- Store in returned result as `chargingEntries` array
- Import handler in kirra.js populates `window.loadedCharging` from these entries

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/helpers/ChargingMassHelper.js` | `recalcMassPerHole()` utility |
| `src/draw/canvas3DChargeDrawing.js` | 3D charge rendering (drawChargesThreeJS, clearChargesThreeJS) |
| `src/draw/canvas2DChargeDrawing.js` | 2D charge rendering (drawCharges2D) |

## Files to Modify

| File | Changes |
|------|---------|
| `src/three/GeometryFactory.js` | Add `createChargeDeck()`, `createPrimerMarker()` |
| `src/three/ThreeRenderer.js` | Add `chargesGroup`, `chargeMeshMap` |
| `kirra.html` | Add charges toggle checkbox, replace time chart radio with dropdown |
| `src/kirra.js` | Add `massPerHole` field, update `getDisplayOptions()`, update `timeChart()`, wire charge rendering, update event listeners |
| `src/fileIO/CBlastIO/CBLASTWriter.js` | Add CHARGE/PRIMER record export |
| `src/fileIO/CBlastIO/CBLASTParser.js` | Add CHARGE/PRIMER record import |

## Existing Code to Reuse

| Utility | File | Usage |
|---------|------|-------|
| `GeometryFactory.createHole()` | `src/three/GeometryFactory.js:71` | Pattern for cylinder creation |
| `drawHole()` | `src/draw/canvas2DDrawing.js:177` | Pattern for 2D circle rendering |
| `HoleCharging.getTotalExplosiveMass()` | `src/charging/HoleCharging.js:183` | Mass computation |
| `Deck.calculateMass()` | `src/charging/Deck.js:82` | Per-deck mass |
| `Primer.totalDownholeDelayMs` | `src/charging/Primer.js:42` | Deck fire timing |
| `DECK_TYPES` | `src/charging/ChargingConstants.js:7` | Type enum |
| `drawWedge()/drawArc()` | `hole_charging.html` reference | 2D pie chart pattern |
| `window.worldToThreeLocal()` | Used in canvas3DDrawing.js | Coordinate transform |

## Implementation Order

1. **Phase 1** - massPerHole (small, foundational)
2. **Phase 4** - Display toggle (needed before rendering)
3. **Phase 2** - 3D charge visualization
4. **Phase 3** - 2D charge visualization
5. **Phase 5** - Time chart dropdown
6. **Phase 6** - CBLAST updates

## Verification

1. **massPerHole**: Apply charging to a hole via DeckBuilderDialog, verify `hole.massPerHole` updates in console
2. **3D charges**: Toggle charges on, verify colored cylinders along hole tracks in 3D view
3. **2D charges**: Toggle charges on, verify pie-chart wedges around hole circles in 2D view
4. **Toggle**: Confirm single button controls both 2D and 3D visibility
5. **Time chart**: Select each dropdown mode, verify correct Y-axis values and labels
6. **Mass Per Deck**: Verify decks with different primers fire at different times in chart
7. **CBLAST export**: Export with charging, re-import, verify charging data round-trips
