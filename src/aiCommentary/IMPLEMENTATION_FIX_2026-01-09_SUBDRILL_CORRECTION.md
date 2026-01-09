# Subdrill Calculation Correction - 2026-01-09

## Critical Correction

### The Misunderstanding

**WRONG ASSUMPTION**: I initially treated `subdrillAmount` as if it were a 3D vector distance along the hole.

**CORRECT**: There are TWO distinct measurements:

1. **subdrillAmount** = VERTICAL distance (deltaZ) from grade to toe
   - Like `benchHeight`, it's a vertical measurement
   - `subdrillAmount = gradeZ - toeZ`
   - Positive: downhole (grade ABOVE toe)
   - Negative: uphole (grade BELOW toe)

2. **subdrillLength** = 3D distance ALONG hole vector from grade to toe
   - Measured along the hole track
   - `subdrillLength = subdrillAmount / cos(holeAngle)`

---

## The Correct Formulas

### From Hole Geometry Diagram

```
Subdrill Amount (SA) = VERTICAL distance = gradeZ - toeZ
Subdrill Length (SL) = VECTOR distance = SA / cos(Hole Angle)

Relationships:
- Hole Length = HL = (benchHeight + subdrillAmount) / cos(holeAngle)
- Subdrill Length = SL = subdrillAmount / cos(holeAngle)
- Horizontal offset = subdrillAmount * tan(holeAngle)
```

### Grade Calculation from subdrillAmount

**Given**: Collar XYZ, Toe XYZ, subdrillAmount (vertical), holeAngle, holeBearing

**Calculate Grade XYZ**:
```javascript
// 1. Grade Z is simple vertical offset
gradeZ = toeZ + subdrillAmount;

// 2. Calculate horizontal offset (projection on XY plane)
horizontalOffset = subdrillAmount * tan(holeAngle);

// 3. Grade XY moves back toward collar
angleRad = holeAngle * (PI / 180);
bearingRad = holeBearing * (PI / 180);

gradeX = toeX - horizontalOffset * sin(bearingRad);
gradeY = toeY - horizontalOffset * cos(bearingRad);

// 4. Calculate subdrillLength (vector distance)
subdrillLength = subdrillAmount / cos(angleRad);
```

### Example: Vertical Hole (0° angle)

```
subdrillAmount = 1.0 m (vertical)
holeAngle = 0° (vertical)

gradeZ = toeZ + 1.0
horizontalOffset = 1.0 * tan(0°) = 0
gradeX = toeX - 0 = toeX
gradeY = toeY - 0 = toeY

subdrillLength = 1.0 / cos(0°) = 1.0 m

Result: Grade directly above toe, both distances equal
```

### Example: 45° Angled Hole

```
subdrillAmount = 1.0 m (vertical)
holeAngle = 45°
holeBearing = 90° (East)

gradeZ = toeZ + 1.0
horizontalOffset = 1.0 * tan(45°) = 1.0 m
gradeX = toeX - 1.0 * sin(90°) = toeX - 1.0
gradeY = toeY - 1.0 * cos(90°) = toeY - 0 = toeY

subdrillLength = 1.0 / cos(45°) = 1.414 m

Result: Grade 1.0m above and 1.0m west of toe, vector distance 1.414m
```

### Example: Negative Subdrill (Uphole)

```
subdrillAmount = -0.5 m (negative = uphole)
holeAngle = 30°
holeBearing = 0° (North)

gradeZ = toeZ - 0.5 (BELOW toe)
horizontalOffset = -0.5 * tan(30°) = -0.289 m
gradeX = toeX - (-0.289) * sin(0°) = toeX
gradeY = toeY - (-0.289) * cos(0°) = toeY + 0.289 (forward past toe)

subdrillLength = -0.5 / cos(30°) = -0.577 m (negative = past toe)

Result: Grade 0.5m BELOW toe, continuing down the hole
```

---

## Files Fixed

### 1. BlastHoleCSVParser.js (Lines 257-294)

**Fixed**: Changed from vector-based to vertical-based calculation

**Before (WRONG)**:
```javascript
// Treated subdrill as vector distance
var gradeX = endX - unitX * subdrill;
var gradeY = endY - unitY * subdrill;
var gradeZ = endZ - unitZ * subdrill;
```

**After (CORRECT)**:
```javascript
// Subdrill is VERTICAL distance
var gradeZ = endZ + subdrill; // Simple vertical offset

// Horizontal offset on XY plane
var horizontalOffset = subdrill * Math.tan(angleRad);

// Grade XY moves back toward collar
var gradeX = endX - horizontalOffset * Math.sin(bearingRad);
var gradeY = endY - horizontalOffset * Math.cos(bearingRad);

// Also calculate vector distance
var subdrillLength = Math.abs(angle) < 0.001 ? subdrill : subdrill / Math.cos(angleRad);
```

### 2. CustomBlastHoleTextParser.js (Lines 677-699)

**Status**: Was ALREADY CORRECT, I broke it then reverted

**Original (CORRECT)** - Restored:
```javascript
// Grade Z is simple: toeZ + vertical subdrill amount
hole.gradeZLocation = hole.endZLocation + subdrillAmount;

// Horizontal offset from toe to grade
var horizontalOffset = subdrillAmount * Math.tan(angleRad);

// Grade XY moves horizontally back toward collar
hole.gradeXLocation = hole.endXLocation - horizontalOffset * Math.sin(bearingRad);
hole.gradeYLocation = hole.endYLocation - horizontalOffset * Math.cos(bearingRad);

// Also calculate subdrillLength
hole.subdrillLength = Math.abs(hole.holeAngle) < 0.001 ? subdrillAmount : subdrillAmount / Math.cos(angleRad);
```

### 3. CBLASTParser.js & IREDESParser.js

**Status**: ✅ CORRECT (subdrill = 0, so grade = toe)

Both formats don't provide subdrill, so:
```javascript
subdrillAmount = 0
grade = toe (directly set)
```

---

## Data Structure (from User)

```javascript
// VERTICAL distance (deltaZ)
subdrillAmount = 0; // deltaZ of gradeZ to toeZ -> downhole =+ve uphole =-ve

// VECTOR distance (along hole)
subdrillLength = 0; // distance from gradeXYZ to toeXYZ -> downhole =+ve uphole =-ve

// VERTICAL distance (deltaZ) - always positive
benchHeight = 0; // deltaZ of collarZ to gradeZ -> always Absolute
```

### Relationships

```
benchHeight = collarZ - gradeZ (always positive, absolute)
subdrillAmount = gradeZ - toeZ (can be negative for uphole)
subdrillLength = subdrillAmount / cos(holeAngle)

Hole Length = √[(collarX-toeX)² + (collarY-toeY)² + (collarZ-toeZ)²]
Hole Length = (benchHeight + subdrillAmount) / cos(holeAngle)
```

---

## Key Insights from Hole Geometry Diagram

From the provided diagram:

1. **Subdrill Amount (SA)** is drawn VERTICALLY (like benchHeight)
2. **Subdrill Length (SL)** is drawn ALONG the hole vector
3. **Relationship**: `SL = SA / cos(HA)` where HA = Hole Angle
4. **Horizontal component**: `horizontal = SA * tan(HA)`

5. **Grade lies ON the hole vector** but is calculated from vertical subdrill amount

6. **Collar can slide along hole vector** (generally fixed to bench surface)
7. **Grade is fixed to hole vector** (at subdrill distance from toe)
8. **Toe is movable** (slides along hole vector)

9. **Extension of hole** moves along the hole vector (past toe for negative subdrill)

---

## Testing

### Test 1: Vertical Hole
```
Input:
- Collar: (100, 200, 50)
- Toe: (100, 200, 40)
- subdrillAmount: 1.0
- holeAngle: 0°

Expected:
- gradeZ = 40 + 1.0 = 41.0
- gradeX = 100
- gradeY = 200
- subdrillLength = 1.0 / cos(0°) = 1.0
```

### Test 2: 45° Angled Hole (East)
```
Input:
- Collar: (100, 200, 50)
- Toe: (110, 200, 40)
- subdrillAmount: 1.0
- holeAngle: 45°
- holeBearing: 90° (East)

Expected:
- gradeZ = 40 + 1.0 = 41.0
- horizontalOffset = 1.0 * tan(45°) = 1.0
- gradeX = 110 - 1.0 * sin(90°) = 109.0 (west of toe)
- gradeY = 200 - 1.0 * cos(90°) = 200.0
- subdrillLength = 1.0 / cos(45°) = 1.414
```

### Test 3: Negative Subdrill (Grade Below Toe)
```
Input:
- Collar: (100, 200, 50)
- Toe: (100, 210, 40)
- subdrillAmount: -0.5 (uphole)
- holeAngle: 30°
- holeBearing: 0° (North)

Expected:
- gradeZ = 40 - 0.5 = 39.5 (BELOW toe)
- horizontalOffset = -0.5 * tan(30°) = -0.289
- gradeX = 100 - (-0.289) * sin(0°) = 100.0
- gradeY = 210 - (-0.289) * cos(0°) = 210.289 (forward past toe)
- subdrillLength = -0.5 / cos(30°) = -0.577
```

---

## Impact

### What Changed
1. ✅ BlastHoleCSVParser now correctly calculates grade from vertical subdrill
2. ✅ CustomBlastHoleTextParser restored to correct implementation
3. ✅ Both parsers now calculate subdrillLength (vector distance)
4. ✅ CBLAST and IREDES already correct (subdrill = 0)

### What Didn't Change
- Data structure definitions (were already correct)
- CBLAST and IREDES parsers (already correct)
- Import handlers in kirra.js (unaffected)

### Breaking Changes
- **None** - This fixes incorrect implementation to match correct formulas

---

## Lessons Learned

1. **Terminology Matters**: "subdrill" is ambiguous - always specify "subdrillAmount" (vertical) or "subdrillLength" (vector)

2. **Vertical vs Vector**: Like benchHeight, subdrillAmount is a VERTICAL measurement, not a vector distance

3. **Trust the Diagram**: The provided hole geometry diagram clearly shows the distinction

4. **Original Code Was Correct**: CustomBlastHoleTextParser had it right from the start

5. **Validate Against Examples**: Run test cases with known inputs/outputs to verify formulas

---

## Related Documentation

- User-provided hole geometry diagram (shows SA as vertical, SL as vector)
- Data structure definitions with clear field descriptions
- `IMPLEMENTATION_FIX_2026-01-09_IMPORT_COMPLETE.md` (now superseded by this correction)

---

## Status: ✅ CORRECTED

All parsers now correctly calculate grade from vertical subdrillAmount:
- ✅ Vertical component: `gradeZ = toeZ + subdrillAmount`
- ✅ Horizontal component: `horizontalOffset = subdrillAmount * tan(angle)`
- ✅ Grade XY: Moves back toward collar on XY plane
- ✅ Vector distance: `subdrillLength = subdrillAmount / cos(angle)`
- ✅ Handles negative subdrill (grade below/past toe)
