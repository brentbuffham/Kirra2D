---
name: Dialog Migration Phase 2 Update
overview: Complete SWAL2 to FloatingDialog migration for remaining dialogs (updatePopup, showCalculationErrorPopup, saveAQMPopup, showHolesAlongLinePopup, showHolesAlongPolylinePopup) and move all canvas drawing visual functions to src/draw/ modules for architectural consistency.
todos:
  - id: calc-error-extract
    content: Extract CalculationErrorDialog to info/CalculationErrorDialog.js
    status: completed
  - id: move-drawing-visuals
    content: Move 4 drawing functions to canvas2DDrawPatternVisuals.js
    status: completed
  - id: welcome-dialog
    content: Create unified WelcomeDialog combining updatePopup and showPopup
    status: completed
  - id: holes-along-line
    content: Extract and convert showHolesAlongLinePopup to HolePatternDialogs.js
    status: completed
  - id: holes-along-polyline
    content: Extract and convert showHolesAlongPolylinePopup to HolePatternDialogs.js
    status: completed
    dependencies:
      - holes-along-line
  - id: aqm-export
    content: Extract and convert saveAQMPopup to ExportAQMDialog.js
    status: pending
  - id: update-kirra-html
    content: Add 5 new script tags to kirra.html for new modules
    status: completed
    dependencies:
      - calc-error-extract
      - move-drawing-visuals
      - welcome-dialog
      - holes-along-line
      - holes-along-polyline
      - aqm-export
  - id: update-plan
    content: Update modernization plan with Phase 2 completion status
    status: pending
    dependencies:
      - update-kirra-html
  - id: testing
    content: Complete all testing checklist items for dialogs and visuals
    status: pending
    dependencies:
      - update-plan
---

# Dialog Migration & Code Organization - Pha

se 2 Update

## Overview

This plan completes the SWAL2 to FloatingDialog migration and improves code organization by:

1. Migrating 5 remaining SWAL2 dialogs to FloatingDialog
2. Moving all canvas drawing visual functions from kirra.js to src/draw/ modules
3. Adding proper "Moved to..." comments for refactored functions
4. Updating the modernization plan document

## Current Status Review

### Already Migrated (DO NOT REDO)

- AddHoleDialog.js (528 lines) - COMPLETE
- PatternGenerationDialogs.js (362 lines) - COMPLETE
- HolesContextMenu.js (663 lines) - COMPLETE
- KADContextMenu.js (560 lines) - COMPLETE
- HolePropertyDialogs.js (798 lines) - COMPLETE

### Remaining to Migrate (5 functions)

1. `updatePopup()` - [kirra.js:187-273](src/kirra.js) - 87 lines, uses Swal2
2. `showPopup()` - [kirra.js:23853-23994](src/kirra.js) - 142 lines, already uses FloatingDialog
3. `showCalculationErrorPopup()` - [kirra.js:17700-17778](src/kirra.js) - 79 lines, already uses FloatingDialog
4. `saveAQMPopup()` - [kirra.js:17874-18276](src/kirra.js) - 403 lines, uses Swal2 with massive form
5. `showHolesAlongLinePopup()` - [kirra.js:31855-32087](src/kirra.js) - 233 lines, uses Swal2
6. `showHolesAlongPolylinePopup()` - [kirra.js:33035-33222](src/kirra.js) - 188 lines, uses Swal2

## Phase 2A: Welcome Dialog Migration

### 2A.1 Create Unified Welcome Dialog

**File**: Create `src/dialog/popups/info/WelcomeDialog.js`**Strategy**: Combine `updatePopup()` and `showPopup()` into one smart welcome dialog**Logic**:

```javascript
// Step 1) Determine if first launch or returning user
function showWelcomeDialog(isDBReady) {
    if (isDBReady and data exists) {
        // Show "Continue Previous / Start Fresh" dialog
        // Reuse existing showPopup() logic (already FloatingDialog)
    } else {
        // First launch - show features & updates
        // Convert updatePopup() from Swal to FloatingDialog
        // Show "Buy me a coffee" and bug report links
    }
}
```

**Implementation Pattern** (based on [AddHoleDialog.js](src/dialog/popups/generic/AddHoleDialog.js)):

- Use FloatingDialog with custom HTML content for features list
- Include build version display
- Handle "Continue Previous" vs "Start Fresh" buttons (already implemented in showPopup)
- Add "Get Started" button for first launch flow

**Key Changes**:

- Convert `updatePopup()` Swal.fire to FloatingDialog
- Keep existing `showPopup()` FloatingDialog implementation
- Remove template literals: `"Version: Build " + buildVersion` not `` `Version: Build ${buildVersion}` ``
- Add combined function that detects context

**After Migration**:

```javascript
// kirra.js (lines 187-273)
// Moved to src/dialog/popups/info/WelcomeDialog.js - Combined with showPopup()

// kirra.js (lines 23853-23994)  
// Moved to src/dialog/popups/info/WelcomeDialog.js - Combined with updatePopup()
```



### 2A.2 Expose Welcome Dialog Globally

Add to WelcomeDialog.js:

```javascript
window.showWelcomeDialog = showWelcomeDialog;
```

Add script tag to kirra.html:

```html
<script src="src/dialog/popups/info/WelcomeDialog.js"></script>
```

---

## Phase 2B: Calculation Error Dialog Migration

### 2B.1 Extract Calculation Error Dialog

**File**: Create `src/dialog/popups/info/CalculationErrorDialog.js`**Status**: Already uses FloatingDialog - just needs extraction**Implementation**:

- Copy `showCalculationErrorPopup()` from [kirra.js:17700-17778](src/kirra.js)
- NO CHANGES NEEDED - already uses FloatingDialog correctly
- Expose globally: `window.showCalculationErrorPopup = showCalculationErrorPopup`

**After Extraction**:

```javascript
// kirra.js (lines 17700-17778)
// Moved to src/dialog/popups/info/CalculationErrorDialog.js
```

---

## Phase 2C: AQM Export Dialog Migration

### 2C.1 Extract and Convert AQM Dialog

**File**: Create `src/dialog/popups/generic/ExportAQMDialog.js`**Challenge**: Massive 403-line Swal2 form with 11 dropdown columns**Strategy** (leverage existing patterns from [PatternGenerationDialogs.js](src/dialog/popups/generic/PatternGenerationDialogs.js)):

1. **Use Factory Code** - `window.createEnhancedFormContent(fields)`
2. Break form into logical sections:

- File/Blast/Pattern names (5 text inputs)
- Checkboxes (useHoleTypeAsInstruction, writeIgnoreColumn)
- 11 column dropdowns (use select type with shared options)

**Field Structure**:

```javascript
const columnOptions = ["Angle", "Azimuth", "Blast", "Diameter", "Easting", "Elevation", "Ignore", "Instruction", "Material Type", "Name", "Northing", "Pattern"];

const fields = [
    { label: "File Name", name: "fileName", type: "text", value: blastNameFromVisibleBlastHoles + "_AQM" },
    { label: "Blast Name", name: "blastName", type: "text", value: blastNameFromVisibleBlastHoles },
    // ... 5 more text fields
    { label: "Use hole type as instruction", name: "useHoleTypeAsInstruction", type: "checkbox", checked: false },
    { label: "Write Ignore Columns", name: "writeIgnoreColumn", type: "checkbox", checked: true },
    { label: "Column 1", name: "column1Dropdown", type: "select", value: "Blast", options: columnOptions },
    // ... 10 more column selects
];
```

**CRITICAL**: Reuse existing CSV conversion function `convertPointsToAQMCSV()` - DO NOT RECREATE**After Migration**:

```javascript
// kirra.js (lines 17874-18276)
// Moved to src/dialog/popups/generic/ExportAQMDialog.js
```

---

## Phase 2D: Holes Along Line Dialog Migration

### 2D.1 Extract and Convert Holes Along Line

**File**: Update `src/dialog/popups/generic/HolePatternDialogs.js` (currently placeholder)**Pattern**: Follow [PatternGenerationDialogs.js](src/dialog/popups/generic/PatternGenerationDialogs.js) structure closely**Key Features to Preserve**:

- Use Grade Z checkbox with dynamic length/gradeZ calculation
- Use Line Bearing checkbox (perpendicular to row at 90 degrees)
- Display calculated row bearing and perpendicular bearing
- Load/save from localStorage (`savedHolesAlongLineSettings`)

**Implementation Pattern**:

```javascript
function showHolesAlongLinePopup() {
    // Step 1) Load saved settings from localStorage
    const savedSettings = JSON.parse(localStorage.getItem("savedHolesAlongLineSettings")) || {};
    
    // Step 2) Calculate line bearing from lineStartPoint and lineEndPoint
    const lineBearing = calculateLineBearing(lineStartPoint, lineEndPoint);
    const perpBearing = (lineBearing + 90) % 360;
    
    // Step 3) Build fields array (18 fields total)
    const fields = [
        { label: "Blast Name", name: "blastName", type: "text", value: lastValues.blastName },
        { label: "Numerical Names", name: "nameTypeIsNumerical", type: "checkbox", checked: true },
        // ... 16 more fields
    ];
    
    // Step 4) USE FACTORY CODE - createEnhancedFormContent
    const formContent = window.createEnhancedFormContent(fields, false);
    
    // Step 5) Add info notes (Row Bearing, Perpendicular Bearing)
    // Step 6) Create FloatingDialog
    // Step 7) Setup event listeners (same as PatternGenerationDialogs.js)
}
```

**Event Listeners** (reuse pattern from PatternGenerationDialogs.js:212-262):

- `useGradeZCheckbox` change -> recalculate length/gradeZ
- `useLineBearingCheckbox` change -> enable/disable bearing input
- Input changes -> update calculations dynamically

**After Migration**:

```javascript
// kirra.js (lines 31855-32087)
// Moved to src/dialog/popups/generic/HolePatternDialogs.js
```

---

## Phase 2E: Holes Along Polyline Dialog Migration

### 2E.1 Extract and Convert Holes Along Polyline

**File**: Update `src/dialog/popups/generic/HolePatternDialogs.js` (add second function)**Pattern**: Nearly identical to Holes Along Line, with additions:

- `reverseDirection` checkbox
- Display vertex count instead of bearing calculation
- Handle `finalVertices` array reversal if checkbox checked

**Implementation**:

- 95% code reuse from `showHolesAlongLinePopup()`
- Only differences:
- No bearing calculations displayed
- Add reverseDirection checkbox
- Reverse vertices array if needed before calling `generateHolesAlongPolyline()`

**After Migration**:

```javascript
// kirra.js (lines 33035-33222)
// Moved to src/dialog/popups/generic/HolePatternDialogs.js
```

---

## Phase 2F: Move Canvas Drawing Visuals to src/draw/

### 2F.1 Analysis of Drawing Functions

**Current Location**: All in kirra.js**Functions to Move** (4 total):

1. `drawKADPolygonHighlightSelectedVisuals()` - [kirra.js:32752-32789](src/kirra.js) - 38 lines
2. `drawPatternInPolygonVisual()` - [kirra.js:32466-32678](src/kirra.js) - 213 lines
3. `drawPatternOnPolylineVisual()` - [kirra.js:32680-32751](src/kirra.js) - 72 lines
4. `drawHolesAlongLineVisuals()` - [kirra.js:32798-32902](src/kirra.js) - 105 lines

**Total**: 428 lines to relocate

### 2F.2 Create New Drawing Module

**File**: Create `src/draw/canvas2DDrawPatternVisuals.js`**Purpose**: Centralize all pattern/tool visual overlays (crosshairs, selection highlights, preview lines)**Structure**:

```javascript
// src/draw/canvas2DDrawPatternVisuals.js
//=============================================================
// CANVAS 2D PATTERN VISUAL OVERLAYS
//=============================================================
// Step 1) Drawing functions for pattern generation tool visuals

// Step 2) Draw selected KAD polygon highlight (green outline, red vertices)
function drawKADPolygonHighlightSelectedVisuals() {
    // Copy from kirra.js:32752-32789
}

// Step 3) Draw pattern in polygon tool visuals (start/end/ref points, preview lines)
function drawPatternInPolygonVisual() {
    // Copy from kirra.js:32466-32678
}

// Step 4) Draw holes along polyline tool visuals
function drawPatternOnPolylineVisual() {
    // Copy from kirra.js:32680-32751
}

// Step 5) Draw holes along line tool visuals (start/end points, preview line with length)
function drawHolesAlongLineVisuals() {
    // Copy from kirra.js:32798-32902
}

// Step 6) Expose functions globally
window.drawKADPolygonHighlightSelectedVisuals = drawKADPolygonHighlightSelectedVisuals;
window.drawPatternInPolygonVisual = drawPatternInPolygonVisual;
window.drawPatternOnPolylineVisual = drawPatternOnPolylineVisual;
window.drawHolesAlongLineVisuals = drawHolesAlongLineVisuals;
```



### 2F.3 Update kirra.js with Relocation Comments

```javascript
// kirra.js (lines 32466-32678)
// Moved to src/draw/canvas2DDrawPatternVisuals.js

// kirra.js (lines 32680-32751)
// Moved to src/draw/canvas2DDrawPatternVisuals.js

// kirra.js (lines 32752-32789)
// Moved to src/draw/canvas2DDrawPatternVisuals.js

// kirra.js (lines 32798-32902)
// Moved to src/draw/canvas2DDrawPatternVisuals.js
```



### 2F.4 Add Script Tag to kirra.html

```html
<script src="src/draw/canvas2DDrawPatternVisuals.js"></script>
```

**Insert Location**: After existing draw module script tags (around line 2520-2525)---

## Phase 2G: Update Modernization Plan

### 2G.1 Update Plan Status

**File**: [src/aiPlans/20251220-1430-Kirra2D_Modernization_SaveExport_Plan.md](src/aiPlans/20251220-1430-Kirra2D_Modernization_SaveExport_Plan.md)**Updates Required**:

1. **Phase 2 Status** (lines 159-277):

- Mark 2.3 "Extract Pattern Dialogs" as COMPLETE
- Update checklist items 4-6 to COMPLETE
- Add completion dates

2. **New Section** - Phase 2.7 Canvas Drawing Organization:
```markdown
### 2.7 Canvas Drawing Organization COMPLETE

**Status**: All pattern visual drawing functions moved from kirra.js to dedicated module

**File Created**: src/draw/canvas2DDrawPatternVisuals.js (428 lines)

**Functions Relocated**:
1. drawKADPolygonHighlightSelectedVisuals() - 38 lines
2. drawPatternInPolygonVisual() - 213 lines
3. drawPatternOnPolylineVisual() - 72 lines
4. drawHolesAlongLineVisuals() - 105 lines

**Benefits**:
- Consistent architecture with canvas2DDrawing.js, canvas2DDrawSelection.js
- Separation of concerns: core drawing vs tool/pattern visuals
- Easier maintenance and debugging
- Clear module boundaries
```




3. **File Structure Update** (lines 516-539):

- Add canvas2DDrawPatternVisuals.js to src/draw/ section
- Add WelcomeDialog.js, CalculationErrorDialog.js, ExportAQMDialog.js to popups/
- Mark HolePatternDialogs.js as COMPLETE

4. **Testing Checklist Update** (lines 481-487):

- Add checkboxes for all 6 migrated dialogs
- Add canvas drawing visual tests

---

## Implementation Order

### Priority 1 (High Impact, Low Risk)

1. Phase 2B: Extract CalculationErrorDialog (already FloatingDialog, 10 min)
2. Phase 2F: Move drawing visuals to src/draw/ (copy/paste, 20 min)

### Priority 2 (Medium Impact, Low Risk)

3. Phase 2A: Create unified WelcomeDialog (combine existing, 45 min)

### Priority 3 (High Impact, Medium Risk)

4. Phase 2D: Extract HolesAlongLinePopup (convert Swal, 60 min)
5. Phase 2E: Extract HolesAlongPolylinePopup (convert Swal, 45 min)

### Priority 4 (High Impact, High Risk - Complex Form)

6. Phase 2C: Extract AQM Export Dialog (large Swal form, 90 min)

### Final Step

7. Phase 2G: Update modernization plan (15 min)

**Total Estimated Time**: 4-5 hours---

## Testing Checklist

### Welcome Dialog

- [ ] First launch shows features/updates with "Get Started" button
- [ ] Subsequent launch with data shows "Continue Previous / Start Fresh"
- [ ] "Continue Previous" loads data correctly
- [ ] "Start Fresh" clears data correctly
- [ ] Build version displays correctly

### Calculation Error Dialog

- [ ] Shows correct error message and suggestions
- [ ] "Fix It" keeps text field focused
- [ ] "Cancel" discards changes
- [ ] "As Text" saves without = prefix

### AQM Export Dialog

- [ ] All 11 column dropdowns populate correctly
- [ ] Last used settings load from localStorage
- [ ] Column selections save to localStorage
- [ ] Export generates valid AQM file
- [ ] "Use hole type as instruction" checkbox works

### Holes Along Line Dialog

- [ ] Calculates row bearing correctly (North=0, East=90, South=180, West=270)
- [ ] Shows perpendicular bearing (row bearing + 90 degrees)
- [ ] "Use Grade Z" checkbox toggles length/gradeZ fields
- [ ] "Bearings are 90° to Row" checkbox enables/disables bearing input
- [ ] Dynamic recalculation works on input changes
- [ ] Settings persist to localStorage
- [ ] Generated holes have correct spacing and orientation

### Holes Along Polyline Dialog

- [ ] Displays correct vertex count
- [ ] "Reverse Direction" checkbox reverses hole order
- [ ] All other features same as Holes Along Line work correctly
- [ ] Generated holes follow polyline segments correctly

### Canvas Drawing Visuals

- [ ] Pattern in polygon tool shows start/end/ref points correctly
- [ ] Preview lines display during tool use
- [ ] KAD polygon highlights show in bright green
- [ ] Holes along line tool shows start/end with distance label
- [ ] All visuals clear when tool is deactivated

---

## Files Modified Summary

### New Files (6)

1. `src/dialog/popups/info/WelcomeDialog.js` (~200 lines)
2. `src/dialog/popups/info/CalculationErrorDialog.js` (~80 lines)
3. `src/dialog/popups/generic/ExportAQMDialog.js` (~450 lines)
4. `src/dialog/popups/generic/HolePatternDialogs.js` (~500 lines - 2 functions)
5. `src/draw/canvas2DDrawPatternVisuals.js` (~450 lines)
6. `src/aiCommentary/20251222-HHMM-Phase2_Dialog_Migration_Complete.md`

### Updated Files (3)

1. `src/kirra.js` - Remove 1,349 lines, add "Moved to..." comments
2. `kirra.html` - Add 5 new script tags
3. `src/aiPlans/20251220-1430-Kirra2D_Modernization_SaveExport_Plan.md` - Update Phase 2 status

### Total Impact

- **Lines Removed from kirra.js**: ~1,349
- **Lines Added to modules**: ~1,680 (includes new wrapper code, comments)
- **Net Code Organization**: +331 lines (better structured, more maintainable)

---

## Success Criteria

- All 6 remaining Swal2 dialogs converted to FloatingDialog
- Zero Swal2 references remain in migrated code (except as backup fallback)
- All drawing visual functions in dedicated src/draw/ module
- kirra.js reduced by ~1,300 lines
- All "Moved to..." comments in place for refactored functions
- Modernization plan updated to reflect Phase 2 completion
- All tests pass

---

## Notes

**Factory Code Compliance**:

- Use `window.createEnhancedFormContent(fields)` for ALL forms
- Use `window.getFormData(formContent)` for ALL form extraction
- Use `window.FloatingDialog` for ALL dialogs (NO Swal2)
- NO template literals - use `"string " + variable` only

**String Concatenation Examples**:

- ❌ BAD: `` `Row Bearing: ${lineBearing.toFixed(1)}°` ``
- ✅ GOOD: `"Row Bearing: " + lineBearing.toFixed(1) + "°"`

**Coordinate System Reminder**:

- North = 0°, East = 90°, South = 180°, West = 270°
- Bearing moves clockwise
- Y up is North (+ve), Y down is South (-ve)

**3D Pattern Design**:

- NOT included in this plan