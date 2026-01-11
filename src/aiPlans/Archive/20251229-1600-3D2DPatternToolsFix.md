# 3D/2D Pattern Tools Fix Plan
**Date**: 2025-12-29 16:00 AWST
**Status**: COMPLETE

---

## Overview

Fixed 8 issues related to 3D fat lines, pattern tool visual feedback, HUD overlay consistency, and multiple hole mode in 3D. Standardized all pattern creation tools to use the HUD overlay system and added proper 3D visual feedback with pyramids and fat lines.

---

## Issues Addressed

| Issue | Root Cause | Solution | Status |
|-------|------------|----------|--------|
| 1. Fat lines not rendering | Resolution not updated on initial render | Created updateAllLineMaterialResolution() function | FIXED |
| 2. 3D patternInPolygon not working | drawPatternInPolygon3DVisual() not being called | Verified call at line 22533 in drawData | VERIFIED |
| 3. 2D holesAlongLine wrong style | Used ctx.fillText instead of HUD overlay | Converted to showPatternToolLabels() | FIXED |
| 4. 3D holesAlongPolyline no feedback | No 3D visual function existed | Created drawHolesAlongPolyline3DVisual() | FIXED |
| 5. 3D pattern tools no feedback | 3D visuals exist but not rendering | Added calls in drawData for all 3D visual functions | FIXED |
| 6. 3D Add Hole multiple mode broken | Always called showAddHoleDialog() | Added isAddingSingleHole check | FIXED |
| 7. 2D tools inconsistent styling | Mix of ctx.fillText and HUD overlay | Standardized all to HUD overlay | FIXED |
| 8. 3D needs pyramid arrows | Used basic spheres/lines | Added pyramid geometry for direction arrows | FIXED |

---

## Phase 1: Fix 3D Fat Lines Resolution (Issue 1)

**File:** src/kirra.js (lines 6255-6320)

### Root Cause
LineMaterial resolution was set using `window.innerWidth/innerHeight` but the Three.js canvas uses `canvas.clientWidth/clientHeight` which are different dimensions.

### Fix Applied
1. Created reusable `updateAllLineMaterialResolution()` function that uses **canvas dimensions**:
```javascript
var canvasWidth = canvas ? canvas.clientWidth : window.innerWidth;
var canvasHeight = canvas ? canvas.clientHeight : window.innerHeight;
var res = new THREE.Vector2(canvasWidth, canvasHeight);
```

2. Fixed resolution in `createHybridSuperBatchedLines()` call (line 23109):
```javascript
var resolution = new THREE.Vector2(canvas.clientWidth, canvas.clientHeight);
```

3. Fixed resolution in `createHybridSuperBatchedCircles()` call (line 23144):
```javascript
var circleResolution = new THREE.Vector2(canvas.clientWidth, canvas.clientHeight);
```

4. Added call to `updateAllLineMaterialResolution()` after adding fat lines (line 23167)

Called on:
- Window resize
- After 3D initialization (line 864)
- After adding hybrid batched lines to kadGroup (line 23167)
- After adding new 3D visual groups

---

## Phase 2: Fix 3D Add Hole Multiple Mode (Issue 6)

**File:** src/kirra.js (lines 1156-1183)

Added conditional check in 3D click handler matching 2D behavior:
```javascript
if (window.isAddingSingleHole && window.multipleAddHoleFormData) {
    window.addHoleMultipleMode(worldX, worldY);
} else {
    window.showAddHoleDialog();
}
```

---

## Phase 3: Standardize 2D Tools to HUD Overlay (Issues 3, 7)

### drawHolesAlongLineVisuals() - src/kirra.js (lines 34574-34666)
- Removed ctx.fillText("START") and ctx.fillText("END")
- Builds overlayData object with startPoint, endPoint, distance
- Calls showPatternToolLabels(overlayData) at end

### drawPatternOnPolylineVisual() - src/kirra.js (lines 34541-34700)
- Removed ctx.fillText("START") and ctx.fillText("END")
- Added segment highlighting (cyan for active segment)
- Builds overlayData object with startPoint, endPoint, distance
- Calls showPatternToolLabels(overlayData) at end

---

## Phase 4: Add 3D Visual Feedback Functions (Issues 2, 4, 5)

### Verified drawPatternInPolygon3DVisual is called
- Called at line 22533 when onlyShowThreeJS && threeInitialized

### Added calls for new 3D functions (lines 22535-22544):
```javascript
drawPatternOnPolylineVisual();
if (onlyShowThreeJS && threeInitialized) {
    drawHolesAlongPolyline3DVisual();
}
drawKADPolygonHighlightSelectedVisuals();
drawHolesAlongLineVisuals();
if (onlyShowThreeJS && threeInitialized) {
    drawHolesAlongLine3DVisual();
}
```

### Created drawHolesAlongLine3DVisual() - src/kirra.js (lines 34429-34536)
Features:
- Green sphere at START point
- Red sphere at END point
- Tube geometry for fat line between points
- Pyramid arrow at midpoint showing perpendicular direction
- Preview line to mouse cursor during selection

### Created drawHolesAlongPolyline3DVisual() - src/kirra.js (lines 34703-34881)
Features:
- Green tube outline of selected polyline
- Orange spheres at vertices
- Cyan highlighted tube for active segment (where holes will be placed)
- Green sphere at START point
- Red sphere at END point
- Cyan pyramid arrow showing direction

---

## Phase 5: Add Pyramid Arrow Indicators (Issue 8)

Pyramid arrows added to all 3D visual functions:

### drawPatternInPolygon3DVisual()
- Green pyramid at midpoint showing burden direction (perpendicular to start-end line)
- Wireframe outline for visibility

### drawHolesAlongLine3DVisual()
- Green pyramid at midpoint showing row direction (perpendicular to line)
- Wireframe outline for visibility

### drawHolesAlongPolyline3DVisual()
- Cyan pyramid at midpoint of active segment
- Wireframe outline for visibility

---

## Files Modified

| File | Changes |
|------|---------|
| src/kirra.js | All implementations (fat line resolution, multiple hole mode, 2D visual functions, 3D visual functions, pyramid arrows) |

---

## Testing Checklist

- [x] Fat lines render correctly on initial 3D view
- [x] Fat lines update on window resize
- [x] Add Hole multiple mode works in 3D without reopening dialog
- [x] Holes Along Line shows START/END labels via HUD in 2D
- [x] Holes Along Polyline shows START/END labels via HUD in 2D
- [x] Pattern in Polygon shows visual feedback in 3D
- [x] Holes Along Line shows visual feedback in 3D
- [x] Holes Along Polyline shows visual feedback in 3D with segment highlight
- [x] Pyramid arrows show direction in 3D for all pattern tools

---

## Coding Standards Compliance

- No template literals used - string concatenation only
- Step comments added (// Step #)
- Functions exposed via window object where needed
- Backward compatible with existing code paths
- Used existing patterns from drawPatternInPolygon3DVisual() as template


