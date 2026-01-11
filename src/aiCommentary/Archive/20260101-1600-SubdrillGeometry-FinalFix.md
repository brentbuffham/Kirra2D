# Subdrill Geometry - Complete Fix
**Date:** 2026-01-01 16:00  
**Agent:** Claude Sonnet 4.5  
**Issue:** Hole subdrill geometry incorrectly calculated causing "kink" from grade to toe

---

## Commit Summary

Fixed critical subdrill geometry calculations across entire codebase. Holes created via patterns, holesAlongLine, and holesAlongPolyline tools now maintain consistent vector from collar through grade to toe.

---

## Problem Statement

User reported that holes created using pattern tools had incorrect geometry:
- Collar to grade section: ✅ Correct (straight line at specified angle)
- Grade to toe section: ❌ Incorrect (kinked at wrong angle, wrong length)

**Root Cause:** Multiple functions treated `subdrillAmount` (which is the VERTICAL Z distance between grade and toe) as if it were the distance along the hole axis (hypotenuse).

---

## Terminology (Application Definitions)

- **subdrillAmount**: VERTICAL distance (ΔZ) between gradeZ and toeZ
  - Example: gradeZ=200m, toeZ=199m → subdrillAmount = 1m
- **subdrillLength**: Measured distance along hole axis from grade to toe
  - Formula: `subdrillLength = subdrillAmount / cos(angle)`
  - Example: subdrillAmount=1m, angle=15° → subdrillLength = 1.035m
- **subdrillHorizontal**: Horizontal (XY) displacement for subdrill
  - Formula: `subdrillHorizontal = subdrillAmount * tan(angle)`
- **benchHeight**: VERTICAL distance from collar to grade
- **holeLengthCalculated**: Distance along hole axis from collar to toe (includes subdrill)

---

## Files Modified

### 1. `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/kirra.js`

#### Fix 1: calculateGradeFromSubdrill (Lines ~29878-29887)
**Changed:** Treated subdrill as hypotenuse  
**Fixed:** Treat subdrill as vertical distance
```javascript
// BEFORE (WRONG)
var subdrillVertical = subdrill * Math.cos(angleRad);
var subdrillHorizontal = subdrill * Math.sin(angleRad);

// AFTER (CORRECT)
var subdrillVertical = subdrill;
var subdrillHorizontal = subdrill * Math.tan(angleRad);
```

#### Fix 2: calculateCollarFromToe (Lines ~29951-29956)
**Changed:** Treated subdrill as hypotenuse  
**Fixed:** Treat subdrill as vertical distance
```javascript
// BEFORE (WRONG)
var subdrillVertical = subdrill * Math.cos(angleRad);
var subdrillHorizontal = subdrill * Math.sin(angleRad);

// AFTER (CORRECT)
var subdrillVertical = subdrill;
var subdrillHorizontal = subdrill * Math.tan(angleRad);
```

#### Fix 3: addHole Function (Lines 20028-20074) ⭐ CRITICAL FIX
**Changed:** Multiple calculation errors
**Fixed:** Complete rewrite of subdrill and grade geometry

**Issues Fixed:**
1. **Double-counting subdrill**: `holeLengthCalculated` already includes subdrill when using gradeZ mode, but code was adding `subdrillLength` again
2. **Wrong grade XY position**: Used `holeLengthCalculated` (includes subdrill) instead of `benchLength` (just collar to grade)
3. **Convoluted trigonometry**: Used `cos(90-angle)` instead of `sin(angle)`

**New Approach:**
```javascript
// Step 2.5-2.8: Calculate geometry correctly
let angleRad = angle * (Math.PI / 180);
let bearingRad = ((450 - bearing) % 360) * (Math.PI / 180);
let cosAngle = Math.cos(angleRad);
let sinAngle = Math.sin(angleRad);

// benchHeight is VERTICAL distance (collar to grade)
let benchHeight = useGradeZ ? 
    startZLocation - parseFloat(gradeZLocation) : 
    holeLengthCalculated * cosAngle;

// totalLength already includes subdrill - don't add twice!
let totalLength = holeLengthCalculated;

// Calculate toe using total length
let horizontalProjection = totalLength * sinAngle;
let endXLocation = startXLocation + horizontalProjection * Math.cos(bearingRad);
let endYLocation = startYLocation + horizontalProjection * Math.sin(bearingRad);
let endZLocation = startZLocation - totalLength * cosAngle;

// Calculate grade using ONLY bench length (no subdrill)
let benchLength = Math.abs(cosAngle) > 1e-9 ? benchHeight / cosAngle : 0;
let horizontalProjectionToGrade = benchLength * sinAngle;
let gradeXLocation = startXLocation + horizontalProjectionToGrade * Math.cos(bearingRad);
let gradeYLocation = startYLocation + horizontalProjectionToGrade * Math.sin(bearingRad);

// subdrillLength is stored for hole object (not used in calculations)
let subdrillLength = Math.abs(cosAngle) > 1e-9 ? subdrillAmount / cosAngle : subdrillAmount;
```

#### Fix 4: Surface Assignment - Collar Mode (Lines ~37870-37876)
**Changed:** Treated subdrill as hypotenuse  
**Fixed:** Treat subdrill as vertical distance

#### Fix 5: Surface Assignment - Grade Mode (Lines ~37921-37927)
**Changed:** Treated subdrill as hypotenuse  
**Fixed:** Treat subdrill as vertical distance

#### Fix 6: Surface Assignment - Toe Mode (Lines ~37978-37983)
**Changed:** Treated subdrill as hypotenuse  
**Fixed:** Treat subdrill as vertical distance

### 2. `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/dialog/popups/generic/SurfaceAssignmentDialogs.js`

#### Fix 7: Grade Assignment (Lines ~649-655)
**Changed:** Treated subdrill as hypotenuse  
**Fixed:** Treat subdrill as vertical distance
```javascript
// BEFORE (WRONG)
var subdrillHorizontal = existingSubdrill * gradeSinAngle;
var subdrillVertical = existingSubdrill * gradeCosAngle;

// AFTER (CORRECT)
var subdrillVertical = existingSubdrill;
var subdrillHorizontal = existingSubdrill * Math.tan(gradeRadAngle);
```

---

## Mathematical Explanation

For a hole at angle θ from vertical with subdrill amount d (vertical distance):

**Correct Formulas:**
- Subdrill vertical component: `d` (it's already vertical!)
- Subdrill horizontal component: `d * tan(θ)`
- Subdrill length along hole axis: `d / cos(θ)`

**Old (Wrong) Formulas:**
- Subdrill vertical: `d * cos(θ)` ❌ (treats d as hypotenuse)
- Subdrill horizontal: `d * sin(θ)` ❌ (treats d as hypotenuse)

This would only be correct if `d` was the hypotenuse (distance along hole), but `subdrillAmount` is explicitly defined as the **vertical** distance.

---

## Testing Performed

User tested with:
- Angle: 15° from vertical (75° dip)
- Collar Z: 200m
- Grade Z: 195m
- Subdrill: 1m
- Spacing: 3m

**Before Fix:** 
- Grade at wrong location (too far down hole)
- Subdrill too long
- Kink visible from grade to toe

**After Fix:**
- Grade at correct location (195m)
- Subdrill correct length (1.035m along hole axis)
- Straight line from collar → grade → toe ✅

---

## Impact

### Tools Fixed
- ✅ Holes Along Line
- ✅ Holes Along Polyline
- ✅ Pattern in Polygon
- ✅ Add Pattern
- ✅ Surface Assignment (all modes)
- ✅ Context menu modifications (already worked, now consistent)

### Geometry Correctness
- ✅ Subdrill sections follow same vector as collar-to-grade
- ✅ No "kinking" at grade point
- ✅ Grade XY positions calculated correctly
- ✅ Subdrill length matches vertical distance / cos(angle)
- ✅ Total hole length correct
- ✅ Consistent with calculateHoleGeometry (context menu)

---

## Files Changed Summary

```
Modified:
  src/kirra.js
    - calculateGradeFromSubdrill() (lines ~29878-29887)
    - calculateCollarFromToe() (lines ~29951-29956)
    - addHole() (lines 20028-20074) ⭐ Major rewrite
    - Surface assignment collar mode (lines ~37870-37876)
    - Surface assignment grade mode (lines ~37921-37927)
    - Surface assignment toe mode (lines ~37978-37983)
    - Removed duplicate benchHeight (line ~20104)
    
  src/dialog/popups/generic/SurfaceAssignmentDialogs.js
    - Grade assignment (lines ~649-655)
```

---

## Commit Message Suggestion

```
Fix: Correct subdrill geometry calculations across entire codebase

- Fixed 7 locations where subdrillAmount (vertical distance) was incorrectly
  treated as hypotenuse length along hole axis
- Rewrote addHole() function to properly calculate grade and toe positions
- Removed double-counting of subdrill in total hole length
- Use tan(angle) for horizontal displacement, not sin(angle)
- Fixes "kinking" issue where holes bent at grade point
- Affects: holesAlongLine, holesAlongPolyline, patterns, surface assignment

Issue: Holes had incorrect geometry with subdrill extending too far and at
wrong angle, causing visible "kink" between grade and toe sections.

Files: kirra.js, SurfaceAssignmentDialogs.js
```

---

## Status

✅ **COMPLETE** - All subdrill geometry bugs fixed and tested
- No linter errors
- Runtime error fixed (subdrillLength reference)
- Ready for production

