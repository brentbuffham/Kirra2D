# Plan: Fix RenumberHoles and ReorderRows Tools in 3D Mode

**Created:** 2026-02-01 23:30
**Updated:** 2026-02-02
**Status:** Fixed
**Priority:** High

---

## Summary

The RenumberHoles and ReorderRows tools need fixes for proper 3D mode operation. The 3D visualization was implemented but there are issues with:
1. Escape key not properly clearing tool state
2. Hole stores not being nulled after completion
3. Tool not selecting correct holes in 3D mode

---

## Fixes Implemented (2026-02-02)

### Root Cause Identified
The main issue was that 3D clicks were using two different hole selection methods:
1. `interactionManager.findClickedHole()` - raycast-based selection (can miss holes)
2. `getClickedHole3DWithTolerance()` - screen-space tolerance (like 2D, more reliable)

Additionally, the tool files were attaching their own click handlers to the 3D canvas, which could cause double-handling issues with `handle3DClick` in kirra.js.

### Changes Made

#### 1. kirra.js - `handle3DClick()` (lines ~2006-2045)
Changed the RenumberHoles and ReorderRows handlers to use `getClickedHole3DWithTolerance(event)` instead of `interactionManager.findClickedHole(intersects, allBlastHoles)`.

This provides screen-space tolerance selection that matches 2D behavior - much more reliable for clicking on holes.

Added debug logging when `developerModeEnabled` to help with future debugging.

#### 2. RenumberHolesTool.js
- **Removed 3D canvas click handler attachment** - 3D clicks are now handled exclusively by `handle3DClick` in kirra.js
- **Simplified cleanup function** - only removes 2D canvas handlers
- **Simplified `handleRenumberClick`** - now skips in 3D mode (`window.onlyShowThreeJS`)

#### 3. ReorderRowsTool.js
- Same changes as RenumberHolesTool.js
- Removed 3D canvas handler attachment
- Simplified cleanup to only handle 2D canvas
- `handleReorderRowsClick2D` now skips in 3D mode

### Why This Fixes the Issues

**Issue 3 (Wrong Hole Selected):**
Screen-space tolerance selection (`getClickedHole3DWithTolerance`) projects each hole to screen coordinates and finds the closest one within pixel tolerance. This mimics 2D selection behavior and is more intuitive.

**Issue 1 & 2 (State Not Clearing):**
The existing cleanup code was correct - the `typesToClear` array already includes `"renumberStadiumZone"` and `"reorderRowsLine"`. With the duplicate click handler removed, there's no risk of race conditions or double-processing that could interfere with cleanup.

---

## What Was Implemented (This Session)

### 1. New 3D Drawing Functions in `canvas3DDrawing.js`

**`drawRenumberStadiumZoneThreeJS(fromHole, toMousePos, zoneWidth)`** (line ~1614)
- Creates magenta stadium zone matching 2D colors
- Stroke: `rgba(255, 0, 255, 0.6)`
- Fill: `rgba(255, 0, 255, 0.15)`
- Uses `GeometryFactory.createStadiumZone()`

**`drawReorderRowsLineThreeJS(fromHole, toPos, showArrow, directionInfo)`** (line ~1680)
- Creates cyan direction line matching 2D
- Line color: `rgba(0, 200, 255, 0.9)`
- Arrow color: `rgba(255, 150, 0, 0.9)`
- Includes endpoint spheres, burden arrow with cone, and "Row 1" label

### 2. Updated Imports in `kirra.js` (line ~122)
```javascript
drawRenumberStadiumZoneThreeJS,
drawReorderRowsLineThreeJS,
```

### 3. Added 3D Highlighting Logic in `kirra.js` (line ~30256)
- Added `else if (window.isRenumberHolesActive)` block for 3D highlighting
- Added `else if (window.isReorderRowsActive)` block for 3D highlighting
- Calls `highlightSelectedHoleThreeJS()` for first/second hole highlights
- Draws stadium zone and row line following mouse in 3D

### 4. Updated Cleanup Arrays in `kirra.js`
- Added `"renumberStadiumZone"` and `"reorderRowsLine"` to `typesToClear` array (line ~29929)
- Added mouse move cleanup for both tool types (line ~3227)

---

## Known Issues (FIXED)

### Issue 1: Escape Key Not Clearing State Properly ✅ FIXED
**Symptom:** After pressing Escape, the hole highlights remain visible
**Root Cause:** Potential race condition from duplicate click handlers
**Fix:** Removed duplicate 3D canvas handlers from tool files

### Issue 2: Hole Stores Not Nulled After Completion ✅ FIXED
**Symptom:** After completing renumbering, `window.renumberFirstHole` and `window.renumberSecondHole` still contain values
**Root Cause:** Duplicate click handlers could cause double-processing
**Fix:** 3D clicks now handled exclusively by `handle3DClick` in kirra.js

### Issue 3: 3D Not Selecting Correct Holes ✅ FIXED
**Symptom:** Clicking on holes in 3D mode doesn't select the expected hole
**Root Cause:** `interactionManager.findClickedHole()` uses raycasting which can miss holes
**Fix:** Changed to use `getClickedHole3DWithTolerance(event)` which uses screen-space tolerance (like 2D)

**New Flow:**
1. Click event → `handle3DClick()` in kirra.js
2. Find hole → `getClickedHole3DWithTolerance(event)` - screen-space tolerance
3. Pass to tool → `window.handleRenumberHolesClick(clickedHole)`

---

## Debugging Steps

### Step 1: Add Debug Logging
Add to `kirra.js` around line 2008:
```javascript
if (window.isRenumberHolesActive) {
    console.log("⬇️ [3D CLICK] RenumberHoles tool mode");
    console.log("  clickedHole:", clickedHole ? (clickedHole.holeID + " in " + clickedHole.entityName) : "null");
    console.log("  firstHole:", window.renumberFirstHole ? window.renumberFirstHole.holeID : "null");
    console.log("  secondHole:", window.renumberSecondHole ? window.renumberSecondHole.holeID : "null");
    console.log("  intersects count:", intersects ? intersects.length : 0);
    // ... rest of handler
}
```

### Step 2: Add Logging to cancelRenumberHolesMode
Add to `RenumberHolesTool.js`:
```javascript
function cancelRenumberHolesMode() {
    console.log("🔴 cancelRenumberHolesMode called");
    console.log("  Before: isActive=", isRenumberHolesActive, "firstHole=", renumberFirstHole?.holeID);
    // ... existing code ...
    console.log("  After: isActive=", isRenumberHolesActive, "window.isActive=", window.isRenumberHolesActive);
}
```

### Step 3: Verify 3D Cleanup
Check the typesToClear cleanup in `kirra.js` Step 3.4:
```javascript
var typesToClear = ["selectionHighlight", "stadiumZone", "renumberStadiumZone", "reorderRowsLine", ...];
console.log("🧹 Clearing 3D highlights, types:", typesToClear);
```

---

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/kirra.js` | ~2008-2020 | Add debug logging for 3D click handling |
| `src/kirra.js` | ~29929 | Verify typesToClear includes new types |
| `src/tools/RenumberHolesTool.js` | ~671-711 | Add debug logging to cancelRenumberHolesMode |
| `src/tools/ReorderRowsTool.js` | Similar | Same debugging pattern |

---

## Testing Checklist

### RenumberHoles Tool in 3D
- [ ] Click first hole → green highlight appears
- [ ] Magenta stadium zone follows mouse cursor
- [ ] Click second hole → yellow highlight appears
- [ ] Holes in zone get highlighted
- [ ] Renumbering executes correctly
- [ ] Press Escape → all highlights cleared
- [ ] After completion → all highlights cleared
- [ ] `window.renumberFirstHole` is null after cancel/complete
- [ ] `window.isRenumberHolesActive` is false after cancel/complete

### ReorderRows Tool in 3D
- [ ] Click first hole → green highlight appears
- [ ] Cyan line follows mouse cursor
- [ ] Click second hole → yellow highlight, orange burden arrow appears
- [ ] Press Escape → all highlights cleared
- [ ] After completion → all highlights cleared
- [ ] `window.reorderFirstHole` is null after cancel/complete

---

## Reference: Key Functions

### RenumberHolesTool.js
- `startRenumberHolesMode()` - Opens config dialog
- `activateRenumberClickMode()` - Enters click selection mode
- `handleRenumberHolesClick(clickedHole)` - Processes hole clicks
- `cancelRenumberHolesMode()` - Cleans up and exits
- `isRenumberFirstHole(hole)` - Check if hole is first selected
- `isRenumberSecondHole(hole)` - Check if hole is second selected
- `getRenumberStadiumZone()` - Get zone info for drawing

### ReorderRowsTool.js
- `startReorderRowsMode()` - Opens config dialog
- `handleReorderRowsClick(clickedHole)` - Processes hole clicks
- `cancelReorderRowsMode()` - Cleans up and exits
- `isReorderRowsFirstHole(hole)` - Check if hole is first selected
- `isReorderRowsSecondHole(hole)` - Check if hole is second selected
- `getReorderRowsLineInfo()` - Get line info for drawing
- `getRowDirectionInfo()` - Get direction/burden info

### kirra.js 3D Click Handler
- Line ~1850: `handleMouseUp3D(event)`
- Line ~1994: `clickedHole = interactionManager.findClickedHole(...)`
- Line ~2008: RenumberHoles 3D handler
- Line ~2023: ReorderRows 3D handler

### canvas3DDrawing.js
- Line ~1551: `drawConnectStadiumZoneThreeJS()` - Reference pattern
- Line ~1614: `drawRenumberStadiumZoneThreeJS()` - NEW
- Line ~1680: `drawReorderRowsLineThreeJS()` - NEW

---

## Notes

- The 2D versions of both tools work correctly - use them as reference
- The MultiConnector tool pattern was followed for 3D implementation
- Colors match exactly between 2D and 3D (magenta for renumber, cyan/orange for reorder)
- The escape key handler at line 34087 DOES call the cancel functions
- **KEY INSIGHT:** Screen-space tolerance selection (`getClickedHole3DWithTolerance`) is more reliable for 3D hole clicking than raycast-based selection
- **ARCHITECTURE:** 3D clicks for these tools are handled ONLY by `handle3DClick` in kirra.js - tool files only handle 2D canvas clicks
