# Offset Terminology Consistency Fix
**Date:** 2026-01-16 14:30  
**Status:** ✅ COMPLETED  
**Files Modified:** 2

## Problem Summary

The offset functionality had **inconsistent terminology** across dialogs, console logs, and comments:
- Dialog said "-ve = in, +ve = out" 
- Console log said "+ve = right, -ve = left" (wrong for polygons!)
- Notes mixed "right/left" with "outward/inward"

This caused confusion about what positive/negative offset values actually do.

## Terminology Rules (STANDARDIZED)

### ✅ For POLYGONS:
- **+ve offset** = **EXPAND** (outward)
- **-ve offset** = **CONTRACT** (inward)

### ✅ For LINES:
- **+ve offset** = **LEFT** (when facing from start to end)
- **-ve offset** = **RIGHT** (when facing from start to end)

### ✅ For PROJECTION ANGLE:
- **+ve angle** = **UP** (increases Z)
- **-ve angle** = **DOWN** (decreases Z)
- **0 angle** = **HORIZONTAL** (no Z change)

**Combinations:**
- +ve offset + +ve angle = expand outward and up
- -ve offset + +ve angle = contract inward and up
- +ve offset + -ve angle = expand outward and down
- -ve offset + -ve angle = contract inward and down

### ✅ For RADII:
- **+ve radius** = **EXPAND** (larger circles)
- **-ve radius** = **CONTRACT** (smaller circles)

## Changes Made

### File 1: `src/dialog/popups/generic/KADDialogs.js`

#### Change 1: Line 593 - Offset Label
**Before:**
```javascript
label: "Offset (m) -ve = in, +ve = out",
```

**After:**
```javascript
label: "Offset (m) +ve = expand, -ve = contract",
```

#### Change 2: Lines 683-692 - Notes Section
**Before:**
```javascript
• Lines: Positive values offset to the right, negative to the left
• Polygons: Positive values offset outwards, negative inwards
• 0° = horizontal, +° = up slope, -° = down slope
```

**After:**
```javascript
• Lines: +ve offsets left (facing forward), -ve offsets right
• Polygons: +ve expands outward, -ve contracts inward
• Projection: 0° = horizontal, +° = up slope, -° = down slope
• Combinations: +ve offset +ve angle = expand up, -ve offset -ve angle = contract down
```

#### Change 3: Line 817 - Radii Radius Label
**Before:**
```javascript
label: "Radius (m)",
```

**After:**
```javascript
label: "Radius (m) +ve = expand, -ve = contract",
```

### File 2: `src/kirra.js`

#### Change 4: Lines 18416-18431 - Console Log Enhancement
**Before:**
```javascript
console.log("🔧 Offset calculation:");
console.log("  offsetAmount:", offsetAmount, "(direction:", offsetAmount > 0 ? "right" : "left", ")");
console.log("  projectionAngle:", projectionAngle, "°");
console.log("  priorityMode:", priorityMode);
console.log("  isClosedPolygon:", isClosedPolygon);
```

**After:**
```javascript
// Step 1) Create descriptive direction string based on entity type
const directionDescription = isClosedPolygon 
    ? (offsetAmount > 0 ? "expand (outward)" : "contract (inward)")
    : (offsetAmount > 0 ? "left (facing forward)" : "right (facing forward)");

console.log("🔧 Offset calculation:");
console.log("  entityType:", originalEntity.entityType, "| isClosedPolygon:", isClosedPolygon);
console.log("  offsetAmount:", offsetAmount + "m | direction:", directionDescription);
console.log("  projectionAngle:", projectionAngle + "° (0°=horizontal, +ve=up, -ve=down)");
console.log("  priorityMode:", priorityMode);
console.log("  horizontalOffset:", horizontalOffset.toFixed(3) + "m");
console.log("  verticalOffset:", verticalOffset.toFixed(3) + "m");
console.log("  zDelta:", zDelta.toFixed(3) + "m (" + (zDelta > 0 ? "up" : zDelta < 0 ? "down" : "no change") + ")");
```

**Key Improvement:** Console now checks entity type and displays correct direction terminology!

#### Change 5: Line 18381 - Comment Clarification
**Before:**
```javascript
// The sign of the offset amount only affects horizontal direction (left/right)
```

**After:**
```javascript
// The sign of the offset amount affects horizontal direction:
//   - Lines: +ve = left (facing forward), -ve = right
//   - Polygons: +ve = expand outward, -ve = contract inward
```

#### Change 6: Line 18404 - Comment Clarification
**Before:**
```javascript
// Horizontal offset maintains the left/right direction from offsetAmount sign
// but adjusts magnitude based on the angle
```

**After:**
```javascript
// Horizontal offset maintains direction from offsetAmount sign:
//   - Lines: +ve = left, -ve = right (when facing forward)
//   - Polygons: +ve = expand, -ve = contract
// Magnitude is adjusted based on the projection angle
```

## Technical Details

### Perpendicular Vector Calculation (Line 18456-18458)
```javascript
let perpX1 = (-dy / length) * horizontalOffset;
let perpY1 = (dx / length) * horizontalOffset;
```

This creates a **left-hand perpendicular** when facing the line direction:
- Positive `horizontalOffset` pushes points to the **left**
- Negative `horizontalOffset` pushes points to the **right**

For polygons, this same calculation results in:
- Positive `horizontalOffset` = **expand outward** (perpendicular away from center)
- Negative `horizontalOffset` = **contract inward** (perpendicular toward center)

### ClipperLib Offset (Line 18987)
```javascript
clipperOffset.Execute(offsetPaths, horizontalOffset * scale);
```

ClipperLib's offset operation naturally expands polygons with positive values and contracts with negative values, which matches our standardized terminology.

## Pattern Generation "Offset" - NOT Changed

**Note:** In `PatternGenerationDialogs.js`, the term "Offset" (lines 33, 69, 83, 105) refers to **row stagger offset** for blast hole patterns, NOT geometric offset. This is a **completely separate concept**:
- 0 = aligned rows (square pattern)
- 0.5 = half-spacing stagger
- -0.5 = opposite half-spacing stagger

This terminology is correct and was **NOT changed** as it serves a different purpose.

## Testing Recommendations

1. ✅ Test **polygon offset** with positive values → should expand outward
2. ✅ Test **polygon offset** with negative values → should contract inward
3. ✅ Test **line offset** with positive values → should offset left (facing forward)
4. ✅ Test **line offset** with negative values → should offset right (facing forward)
5. ✅ Test **projection angles** (+ve up, -ve down) with both offset directions
6. ✅ Verify console logs show correct entity type and direction description
7. ✅ Check dialog labels display consistent terminology

## Benefits

1. ✅ **Consistent terminology** across all UI elements
2. ✅ **Clear distinction** between line behavior (left/right) and polygon behavior (expand/contract)
3. ✅ **Separation of concerns**: Offset direction vs. projection angle direction
4. ✅ **Better debugging**: Console logs now accurately describe what's happening
5. ✅ **User clarity**: Dialog labels immediately show what positive/negative values do

## Related Code

- **Offset functions:**
  - `createLineOffsetCustom()` - Line 18350
  - `createOffsetEntity()` - Line 18914
  - `offsetPolygonClipper()` - Line 18242
  - `performKADOffset()` - Line 19079

- **Dialogs:**
  - `showOffsetKADPopup()` - KADDialogs.js line 586
  - `showRadiiConfigPopup()` - KADDialogs.js line 764

- **Comments (already correct):**
  - Line 18277: "positive expands and negative compresses" ✅
  - Line 18419-18420: "Polygon offset direction is now handled correctly" ✅
  - Line 18947: "offsetAmount controls expand(+) / contract(-)" ✅

## Conclusion

All offset-related terminology is now **consistent and accurate** throughout the codebase. Users will see clear, unambiguous labels in dialogs, and developers will see accurate descriptions in console logs and code comments.
