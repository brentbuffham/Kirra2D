---
name: Hole Origin Location Feature
overview: Add a "Hole Origin Location" dropdown to hole creation dialogs that allows users to specify whether holes are created from Collar (default), Grade, or Toe positions. When creating holes along lines/polylines, the selected origin point will be placed on the line and the hole geometry will be adjusted accordingly.
todos:
  - id: helper-functions
    content: Create calculateHolePositionsFromOrigin and interpolateZAlongPolyline helper functions
    status: pending
  - id: holes-along-line-dialog
    content: Add Hole Origin Location dropdown to showHolesAlongLinePopup dialog
    status: pending
  - id: holes-along-line-generation
    content: Modify generateHolesAlongLine to calculate positions based on origin type
    status: pending
  - id: holes-along-polyline-dialog
    content: Add Hole Origin Location dropdown and Stick to Line Elevation checkbox to showHolesAlongPolylinePopup
    status: pending
  - id: holes-along-polyline-generation
    content: Modify generateHolesAlongPolyline to calculate positions based on origin type and line elevation
    status: pending
  - id: single-hole-dialog
    content: Add Hole Origin Location dropdown to Add Single Hole dialog
    status: pending
  - id: testing
    content: Test all origin modes with various hole configurations
    status: pending
---

# Hole Origin Location Feature Implementation

## Overview

This feature adds flexible hole origin positioning to hole creation tools. Users can specify whether holes should be created from their Collar (current default), Grade, or Toe position. This is particularly useful for scenarios like presplit drilling where holes target a ramp toe and need to be positioned from that toe location upward.

## Core Concept

Currently, holes are always created with the **collar** at the specified XY position. This enhancement allows users to position holes by their **toe** or **grade** instead:

- **Collar origin** (current): Collar at XY, hole extends downward based on angle/bearing
- **Grade origin** (new): Grade at XY, hole extends both ways (collar above, toe below)
- **Toe origin** (new): Toe at XY, hole extends upward based on angle/bearing

## Files to Modify

### 1. [src/dialog/popups/generic/PatternGenerationDialogs.js](src/dialog/popups/generic/PatternGenerationDialogs.js)

**Changes needed:**
- Add `holeOriginLocation` dropdown field to `showHolesAlongPolylinePopup` (lines 355-572)
- Add `holeOriginLocation` dropdown field to `showHolesAlongLinePopup` (lines 659-908)
- Add `stickToLineElevation` checkbox to `showHolesAlongPolylinePopup` for polyline-specific option
- Save/load these new settings from localStorage
- Pass `holeOriginLocation` and `stickToLineElevation` in params object to generation functions

### 2. [src/kirra.js](src/kirra.js)

**Changes needed:**

#### a) Modify `generateHolesAlongPolyline` (line 33060)
- Accept `holeOriginLocation` and `stickToLineElevation` in params
- For each hole position along polyline:
  - If `stickToLineElevation` is true, interpolate Z elevation at that point along the polyline
  - Calculate collar/grade/toe positions based on `holeOriginLocation`:
    - If "Collar": Current behavior (collar at line XY, extend downward)
    - If "Grade": Calculate collar position above the line point
    - If "Toe": Calculate collar position above the toe at line point
  - Pass the correctly calculated collar XY and Z to `addHole`

#### b) Modify `generateHolesAlongLine` (line 32193)
- Accept `holeOriginLocation` in params
- For each hole position along line:
  - Calculate collar/grade/toe positions based on `holeOriginLocation`
  - Adjust collar XY and Z accordingly
  - Pass the correctly calculated collar position to `addHole`

#### c) Create helper function `calculateHolePositionsFromOrigin`
- Input: origin point (XY, Z), hole parameters (angle, bearing, length, subdrill, gradeZ), originType ("Collar", "Grade", "Toe")
- Output: {collarX, collarY, collarZ, adjustedGradeZ}
- This centralizes the geometry calculation logic

#### d) Modify `AddHoleDialog` (search for single hole creation dialog)
- Add `holeOriginLocation` dropdown to the Add Single Hole dialog
- Apply the same origin calculation logic when adding individual holes

### 3. Add utility function in [src/kirra.js](src/kirra.js)

Create `interpolateZAlongPolyline(vertices, targetX, targetY)` function:
- Takes polyline vertices and a target XY position
- Finds the closest segment
- Linearly interpolates Z value along that segment
- Returns interpolated Z elevation

## Geometry Calculations

### Collar Origin (Current Default)
```
Collar: (x, y, collarZ)
Grade: Collar - (length * cos(angle)) in Z direction + bearing offset in XY
Toe: Collar - (totalLength * cos(angle)) in Z direction + bearing offset in XY
```

### Grade Origin (New)
```
Grade: (x, y, gradeZ or line elevation)
Collar: Grade + (length * cos(angle)) in Z direction - bearing offset in XY
Toe: Grade - (subdrill adjusted) in Z direction + bearing offset in XY
```

### Toe Origin (New)
```
Toe: (x, y, toeZ or line elevation)
Grade: Toe + (subdrill * cos(angle)) in Z direction - bearing offset in XY
Collar: Toe + (totalLength * cos(angle)) in Z direction - bearing offset in XY
```

## UI Changes

### Dropdown Options
- Label: "Hole Origin Location"
- Options: "Collar" (default), "Grade", "Toe"
- Position: After "Collar Elevation" field, before "Use Grade Z" checkbox

### Polyline-Specific Checkbox
- Label: "Stick Origin to Line Elevation"
- Only shown when: holeOriginLocation is "Grade" or "Toe"
- When checked: The selected origin point uses interpolated Z from polyline vertices

## Implementation Order

1. Create `calculateHolePositionsFromOrigin` helper function in kirra.js
2. Create `interpolateZAlongPolyline` utility function in kirra.js
3. Update `showHolesAlongLinePopup` dialog to include dropdown
4. Modify `generateHolesAlongLine` to use new origin calculation
5. Update `showHolesAlongPolylinePopup` dialog to include dropdown + checkbox
6. Modify `generateHolesAlongPolyline` to use new origin calculation
7. Add dropdown to Add Single Hole dialog
8. Update `addHole` calling logic for single holes
9. Test all three origin modes with various hole angles and bearings

## Testing Scenarios

1. **Collar origin**: Verify existing functionality unchanged
2. **Grade origin**: Verify grade point is at line XY, collar above, toe below
3. **Toe origin**: Verify toe point is at line XY, collar and grade above
4. **Polyline with elevation**: Verify interpolation and sticking works correctly
5. **Angled holes**: Verify geometry correct for non-vertical holes
6. **Negative subdrill**: Verify grade/toe positioning handles negative subdrill

## Notes

- The `addHole` function (line 18900) always expects collar position as the "start" location
- All geometry calculations must account for hole angle and bearing
- Storage keys: `savedHolesAlongPolylineSettings`, `savedHolesAlongLineSettings`, `savedAddHoleSettings`
- The bearing convention: North=0°, East=90°, South=180°, West=270°
