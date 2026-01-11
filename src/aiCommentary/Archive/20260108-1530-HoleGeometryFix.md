# Hole Geometry Update Fix - Holistic Solution

**Date:** 2026-01-08 15:30  
**Issue:** Multiple hole property edits (subdrill, grade Z, collar Z) were not updating hole geometry correctly in 2D/3D views

## Problem Summary

When editing hole properties through the context menu (both single and multiple hole edits):
1. **Subdrill changes** - Data updated but grade point XY coordinates not recalculated, causing 3D subdrill segment to render horizontally
2. **Grade Z changes** - Only Z values updated directly, not following the hole vector trajectory
3. **Collar Z changes** - Only collar moved, grade and toe points stayed in place

## Root Cause

The geometry calculation was **not holistic** - changes didn't respect the hole vector (angle + bearing). When a property changed, the entire hole geometry needed to be recalculated along the hole trajectory.

## Solution Implemented

### 1. Fixed Mode 8 (Subdrill) in calculateHoleGeometry()
**Location:** `kirra.js` lines 23606-23628

**Changes:**
- Added grade point XY calculation when subdrill changes
- Grade point now properly slides along hole vector at bench height
- Maintains hole angle and bearing

```javascript
// Step 1) Update grade point (grade is at bench level, before subdrill)
hole.gradeZLocation = startZ - benchHeight;
const benchDrillLength = Math.abs(cosAngle) > 1e-9 ? benchHeight / cosAngle : 0;
const horizontalProjectionToGrade = benchDrillLength * sinAngle;
hole.gradeXLocation = startX + horizontalProjectionToGrade * Math.cos(radBearing);
hole.gradeYLocation = startY + horizontalProjectionToGrade * Math.sin(radBearing);
```

### 2. Added Mode 9 (BenchHeight) in calculateHoleGeometry()
**Location:** `kirra.js` after mode 8

**Purpose:** Handle grade Z changes by recalculating bench height and sliding grade point along hole vector

**Implementation:**
- Calculates new bench height from grade Z change
- Recalculates hole length based on bench height + subdrill
- Updates grade point XY coordinates along hole trajectory
- Updates toe/end point maintaining hole angle and bearing

### 3. Fixed Collar Z Handling in HolesContextMenu.js
**Location:** `HolesContextMenu.js` lines 832-838

**Changes:**
- Changed from single value update to delta shift
- All Z coordinates (collar, grade, toe) now shift together
- Maintains hole geometry (length, angle, bearing unchanged)

```javascript
// Step 1) Calculate the delta (shift amount)
const deltaZ = processedCollarZ - h.startZLocation;

// Step 2) Shift all Z coordinates by the same delta to maintain hole geometry
h.startZLocation = processedCollarZ;
h.gradeZLocation += deltaZ;
h.endZLocation += deltaZ;
```

### 4. Fixed Grade Z Handling in HolesContextMenu.js
**Location:** `HolesContextMenu.js` lines 840-852

**Changes:**
- Calculates new bench height from grade Z
- Uses new mode 9 to recalculate geometry holistically
- Grade point slides along hole vector at new depth

```javascript
// Step 1) Calculate new benchHeight from the new gradeZ
// The grade point slides along the hole vector, maintaining angle and bearing
const newBenchHeight = h.startZLocation - processedGradeZ;

// Step 2) Use mode 9 (BenchHeight) to recalculate all geometry properly
window.calculateHoleGeometry(h, newBenchHeight, 9);
```

## Geometry Calculation Modes Reference

| Mode | Property | Behavior |
|------|----------|----------|
| 1 | Length | Recalculates grade/toe from new length |
| 2 | Angle | Recalculates all points with new angle |
| 3 | Bearing | Recalculates all XY positions with new bearing |
| 4 | Easting (X) | Delta shift all X coordinates |
| 5 | Northing (Y) | Delta shift all Y coordinates |
| 6 | Collar Z | Delta shift all Z coordinates |
| 7 | Diameter | Simple value update |
| 8 | Subdrill | Recalculates length and all points |
| **9** | **BenchHeight** | **NEW - Recalculates from grade Z change** |

## Key Principle

**All geometry changes must respect the hole vector:**
- Hole angle and bearing define the trajectory
- Grade point is at bench height along this trajectory
- Toe point is at bench height + subdrill along this trajectory
- Any property change recalculates positions along the vector

## Testing Verification

Before fix:
- 2D view: Correct (only shows collar-toe line)
- 3D view: Grade point incorrect, subdrill segment horizontal

After fix:
- 2D view: Still correct
- 3D view: Grade point follows hole angle, subdrill segment at correct angle
- Single hole edit: Geometry updates correctly
- Multiple hole edit: All selected holes update correctly

## Files Modified

1. `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/kirra.js`
   - Fixed mode 8 (subdrill)
   - Added mode 9 (bench height)

2. `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/dialog/contextMenu/HolesContextMenu.js`
   - Fixed collar Z handling
   - Fixed grade Z handling

## No Linter Errors

All changes validated - no linter errors introduced.
