# Surface Assignment Dialogs & CSV Import Geometry Fix
**Date**: 2025-12-26 15:00 UTC
**Status**: COMPLETE (Updated 15:30 UTC - Fixed dialog always showing)

---

## Overview

This update addresses two related improvements:
1. **Surface Assignment Dialogs** - Converted from SweetAlert2 to FloatingDialog with enhanced Grade mode
2. **CSV Import Geometry Conflicts** - Implemented priority-based calculation to resolve conflicting data

---

## Part A: Surface Assignment Dialog Modernization

### Changes Made

#### 1. New File Created: `src/dialog/popups/generic/SurfaceAssignmentDialogs.js`

**Functions Implemented:**
- `showAssignCollarDialog(onConfirm)` - Manual collar elevation entry
- `showAssignGradeDialog(onConfirm)` - Enhanced dialog with Grade-first radio selector
- `showSurfaceSelectDialog(surfaces, assignType, onSelect)` - Multi-surface picker
- `showAssignmentCompleteDialog(count, targetName, type)` - Success message
- `assignHoleToSurfaceElevation(hole, targetElevation, type)` - Core assignment logic
- `assignHolesToFixedElevation(elevation, type)` - Batch assignment
- `getDefaultGradeElevation()` - Returns average CollarZ - 10
- `getDefaultCollarElevation()` - Returns average CollarZ

**Enhanced Grade Dialog Features:**
- **Grade mode first** (default selected)
- **Radio buttons with calculation descriptions:**
  - "Assign GRADE Elevation" - Calculates: ToeZ = GradeZ - Subdrill; Recalculates: Length, ToeXYZ
  - "Assign TOE Elevation" - Calculates: GradeZ = ToeZ + Subdrill; Recalculates: Length, GradeXYZ
- **Pre-filled elevation** = average CollarZ - 10 (typical bench height)

#### 2. Updated: `src/kirra.js`

**Lines Modified: 35228-35330 (assignSurfaceTool handler)**
- Replaced 3x Swal.fire() calls with FloatingDialog functions
- Uses `window.showAssignCollarDialog()`, `window.showSurfaceSelectDialog()`
- Converted arrow functions to regular functions for compatibility

**Lines Modified: 35460-35535 (assignGradeTool handler)**
- Replaced 3x Swal.fire() calls with FloatingDialog functions
- Uses `window.showAssignGradeDialog()` with mode selector
- **ALWAYS shows Grade/Toe mode dialog first** (not just when no surfaces loaded)
- Supports both "grade" and "toe" assignment modes
- Stores selected mode in `window._gradeAssignMode` for click handler

**Lines Modified: 35397-35430 (assignHolesToFixedElevation)**
- Now delegates to window.assignHolesToFixedElevation from SurfaceAssignmentDialogs.js
- Fallback implementation for backward compatibility

**Lines Modified: 35186-35250 (assignHoleToSurfaceElevation)**
- Added support for "toe" type in addition to "collar" and "grade"
- Step comments added for readability

#### 3. Updated: `src/kirra.js` (Import)
- Added: `import "./dialog/popups/generic/SurfaceAssignmentDialogs.js";` at line 100

---

## Part B: CSV Import Geometry Conflict Resolution

### Problem Solved

When importing CSV files with **both** coordinates (CollarXYZ, ToeXYZ) **and** design parameters (Length, Angle, Bearing), conflicts arise because:
- Imported coordinates may not match calculated L/A/B values
- Previous code did nothing when both data types existed

### Priority Hierarchy Implemented

| Priority | Has Collar | Has Toe | Has L/A/B | Has Subdrill | Action |
|----------|-----------|---------|-----------|--------------|--------|
| **1** | Yes | Yes | Any | Yes | **IGNORE L/A/B** - Calculate from coordinates |
| **2** | Yes | No | Yes | Yes | Calculate ToeXYZ, GradeXYZ from design params |
| **3** | No | Yes | Yes | Yes | **REVERSE CALC** - Calculate CollarXYZ from ToeXYZ |
| **4** | Yes | No | Yes | No | Calculate with default subdrill (1m) |
| **5** | Yes | No | No | No | Use defaults (vertical, 10m bench) |

### New Functions Added

**Lines 28195-28365 in kirra.js:**

1. `calculateMissingGeometry(hole)` - Completely rewritten with priority logic
2. `isValidCoordinate(value)` - Helper to check valid coordinate values
3. `coordsDifferFromCollar(hole, type)` - Helper to check if coordinates differ
4. `calculateFromCollarAndToe(hole, hasSubdrill)` - Priority 1 calculation
5. `calculateGradeFromSubdrill(hole)` - Calculate GradeXYZ from ToeXYZ + subdrill
6. `calculateFromDesignParams(hole)` - Forward calculation from L/A/B
7. `applyDefaultGeometry(hole)` - Apply default values
8. `calculateCollarFromToe(hole)` - **NEW: Reverse geometry calculation**

### Reverse Hole Geometry

The new `calculateCollarFromToe()` function supports importing data that only has toe coordinates:

```javascript
// Given: ToeXYZ + Length + Angle + Bearing + Subdrill
// Calculates: CollarXYZ + GradeXYZ + BenchHeight

// CollarXYZ = ToeXYZ - (direction vector)
hole.startXLocation = hole.endXLocation - horizontalDist * Math.sin(bearingRad);
hole.startYLocation = hole.endYLocation - horizontalDist * Math.cos(bearingRad);
hole.startZLocation = hole.endZLocation + verticalDist; // Up from toe
```

---

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `src/dialog/popups/generic/SurfaceAssignmentDialogs.js` | CREATE | New dialog file (~350 lines) |
| `src/kirra.js` | MODIFY | Lines 95-100 (import), 28195-28415 (geometry), 35186-35430 (handlers) |

---

## Testing Checklist

### Surface Assignment Dialogs
- [ ] Assign Collar - manual elevation dialog (no surface)
- [ ] Assign Collar - single surface auto-assign
- [ ] Assign Collar - multiple surface selection dialog
- [ ] Assign Grade - Assign Grade mode (default) - verify ToeZ calculated
- [ ] Assign Grade - Assign Toe mode - verify GradeZ calculated
- [ ] Default elevation = average CollarZ - 10
- [ ] Success message dialogs display correctly

### CSV Import Geometry
- [ ] CollarXYZ + ToeXYZ - verify L/A/B calculated (ignores imported L/A/B)
- [ ] CollarXYZ + ToeXYZ + Subdrill - verify GradeXYZ calculated correctly
- [ ] CollarXYZ + L/A/B + Subdrill - verify ToeXYZ, GradeXYZ calculated
- [ ] ToeXYZ + L/A/B + Subdrill - verify CollarXYZ back-calculated (reverse geometry)
- [ ] CollarXYZ only - verify defaults applied

---

## Coding Standards Compliance

- No template literals - string concatenation only
- Step comments (// Step 1), 2), etc.)
- Factory code used: `window.createEnhancedFormContent()`, `window.FloatingDialog`
- Functions exposed via `window.functionName = functionName`
- No ES6 exports (except import statement in kirra.js)

---

## Summary

This update modernizes the Surface/Grade assignment tools by:
1. Converting 8x Swal.fire() calls to FloatingDialog
2. Adding Grade-first mode selector with calculation descriptions
3. Pre-filling elevation with average CollarZ - 10
4. Supporting both "grade" and "toe" assignment types

And fixes CSV import conflicts by:
1. Implementing priority-based geometry calculation
2. Coordinates take precedence over design parameters
3. Adding reverse geometry support (ToeXYZ → CollarXYZ)
4. Proper console logging for debugging import issues

