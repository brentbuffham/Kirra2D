# Phase 2: Complete SWAL2 to FloatingDialog Migration

**Date**: 2025-12-20  
**Time**: 17:00  
**Author**: AI Assistant  
**Status**: IN PROGRESS

---

## Overview

Phase 2 continues the modernization of Kirra2D by completing the migration from SWAL2 dialogs to the custom FloatingDialog system. This phase involves:
1. Removing obsolete function implementations that have been replaced
2. Extracting remaining large dialog functions from kirra.js
3. Converting all SWAL2 dialogs to FloatingDialog
4. Ensuring consistent code style and Factory Code compliance

---

## Pre-Audit: Existing Implementations

### ✅ Already Complete (Do NOT Recreate)

1. **AddHoleDialog.js** - 528 lines
   - Location: `src/dialog/popups/generic/AddHoleDialog.js`
   - Function: `showAddHoleDialog()`
   - Status: Fully converted to FloatingDialog with Single/Multiple buttons
   - Features: Proximity checks, custom hole IDs, grade Z calculations
   - Replaces: `addHolePopup()` at line 19809
   - Current State: `addHolePopup()` is a 3-line wrapper calling `window.showAddHoleDialog()`

2. **PatternGenerationDialogs.js** - 362 lines
   - Location: `src/dialog/popups/generic/PatternGenerationDialogs.js`
   - Function: `showPatternDialog(mode, worldX, worldY)`
   - Status: Fully converted to FloatingDialog
   - Features: Unified dialog for "add_pattern" and "polygon_pattern" modes
   - Replaces: `addPatternPopup()` at line 19851
   - Current State: `addPatternPopup()` is a 2-line wrapper calling `window.showPatternDialog()`

3. **HolesContextMenu.js** - 663 lines
   - Location: `src/dialog/contextMenu/HolesContextMenu.js`
   - Functions: `showHolePropertyEditor()`, `processHolePropertyUpdates()`
   - Status: Fully converted to FloatingDialog with Delete button
   - Features: Multi-hole editing, relative adjustments, hide/delete operations
   - Fields: Delay, Color, Connector Curve, Type, Diameter, Bearing, Angle, Subdrill, CollarZ, GradeZ, Burden, Spacing, RowID, PosID
   - Current State: No duplicate in kirra.js (moved entirely)

4. **KADContextMenu.js** - 560 lines
   - Location: `src/dialog/contextMenu/KADContextMenu.js`
   - Functions: `showKADPropertyEditorPopup()`, `showMultipleKADPropertyEditor()`, `convertLinePolyType()`, `updateKADObjectProperties()`
   - Status: Fully converted to FloatingDialog with Delete button
   - Features: Single/multiple KAD editing, segment vs point handling, auto-renumbering
   - Replaces: `showKADPropertyEditorPopup()` at line 28276 (209 lines)
   - Current State: **OLD 209-LINE VERSION STILL IN KIRRA.JS** - needs replacement

---

## Phase 2.1: Fix Export Syntax Error ✅ COMPLETE

**Issue**: Plan mentioned potential ES6 export syntax errors

**Result**: ✅ No export statements found in kirra.js
- Searched for: `^export `, `module.exports`, `exports.`, `export {`, `export default`
- All clear - kirra.js uses `window.functionName` pattern correctly

---

## Phase 2.2: Remove Obsolete Functions 🔄 IN PROGRESS

### Strategy

Rather than deleting these functions entirely (which could break existing code), we'll replace them with delegation wrappers that call the new implementations. This ensures backward compatibility while keeping the code clean.

### Functions to Update

#### 1. `addHolePopup()` - Line 19809 ✅ ALREADY WRAPPER
```javascript
function addHolePopup() {
	// Moved to src/dialog/popups/generic/AddHoleDialog.js
	window.showAddHoleDialog();
}
```
**Status**: Already a proper wrapper - no action needed

**Usage**:
- Line 18719: `addHolePopup()` - fallback when no coordinates set
- Line 18724: `addHolePopup()` - main call
- Still needed as external code may call this function

#### 2. `addPatternPopup(worldX, worldY)` - Line 19851 ✅ ALREADY WRAPPER
```javascript
function addPatternPopup(worldX, worldY) {
	window.showPatternDialog("add_pattern", worldX, worldY);
}
```
**Status**: Already a proper wrapper - no action needed

**Usage**:
- Line 19842: `addPatternPopup(parseFloat(worldX.toFixed(3)), parseFloat(worldY.toFixed(3)))`
- Still needed as external code may call this function

#### 3. `showKADPropertyEditorPopup(kadObject)` - Line 28276 ⚠️ NEEDS REPLACEMENT

**Current State**: Full 209-line implementation (28276-28485) using:
- Template literals (line 28285, 28392-28395) ❌ Violates coding rules
- Old FloatingDialog without Delete button
- Missing segment endpoint fix from KADContextMenu.js
- Missing auto-renumbering on delete

**Usage**:
- Line 1997: `showKADPropertyEditorPopup(clickedKADObject)` - context menu trigger
- Line 40745: `showKADPropertyEditorPopup(kadObject)` - keyboard shortcut

**Replacement Strategy**:
Replace the 209-line implementation with a delegation wrapper:
```javascript
function showKADPropertyEditorPopup(kadObject) {
	// Step 1) Moved to src/dialog/contextMenu/KADContextMenu.js
	// Step 2) Call the new implementation which has Delete button and proper segment handling
	window.showKADPropertyEditorPopup(kadObject);
}
```

**Note**: The KADContextMenu.js version is already exposed globally via `window.showKADPropertyEditorPopup`, so this creates a proper delegation chain.

---

## Phase 2.3: Extract High-Priority Export Dialogs 📋 NEXT

### IREDES Export Dialog

**Function**: `saveIREDESPopup()` - Line 10230  
**Size**: ~200+ lines with extensive XML form  
**Status**: ⚠️ Needs extraction

**Complexity**:
- Large Swal.fire with complex HTML template
- CRC calculation logic
- XML format generation
- localStorage persistence
- Multiple template literals to convert

**Target**: `src/dialog/popups/generic/ExportDialogs.js`

### AQM Export Dialog

**Function**: `saveAQMPopup()` - Line 19402  
**Size**: ~150+ lines  
**Status**: ⚠️ Needs extraction

**Complexity**:
- Complex Swal.fire HTML template
- Custom text format generation
- localStorage persistence
- Template literals to convert

**Target**: `src/dialog/popups/generic/ExportDialogs.js`

---

## Phase 2.4: Extract Pattern Dialogs 📋 PLANNED

### Remaining Functions

1. **showHolesAlongLinePopup()** - Line 33551
   - Create holes along a line between two points
   - Current: Uses Swal.fire
   - Target: `src/dialog/popups/generic/HolePatternDialogs.js`

2. **showPatternInPolygonPopup()** - Line 34158
   - Generate pattern inside a selected polygon
   - Current: Uses FloatingDialog (already partially converted)
   - Target: `src/dialog/popups/generic/HolePatternDialogs.js`

3. **showHolesAlongPolylinePopup(vertices)** - Line 34731
   - Create holes along a polyline path
   - Current: Uses Swal.fire
   - Target: `src/dialog/popups/generic/HolePatternDialogs.js`

---

## Phase 2.5: Extract Property Dialogs 📋 PLANNED

### Functions to Verify and Extract

1. **editBlastNamePopup(selectedHole)** - Line 41565
   - Rename blast entity
   - Check for duplicate resolution logic

2. **editHoleTypePopup()** - Line 41794
   - Bulk change hole types

3. **Other property dialogs** - Need to verify existence:
   - `editHoleLengthPopup()`
   - `measuredLengthPopup()`
   - `measuredMassPopup()`
   - `measuredCommentPopup()`
   - `renameEntityDialog(entityType, oldEntityName)`

---

## Phase 2.6: Extract KAD Dialogs 📋 PLANNED

### Remaining Functions

1. **showOffsetKADPopup(kadObject)** - Line 14849
   - Create offset copies of KAD entities
   - Geometric offset calculations

2. **showRadiiConfigPopup(selectedEntities)** - Line 15508
   - Configure radii for multiple entities
   - Bulk property editing

3. **showTriangulationPopup()** - Line 13285
   - Triangulate surfaces from points
   - Complex geometric algorithms

---

## Coding Standards Compliance

### Template Literal Violations Found

**Line 28285** (showKADPropertyEditorPopup):
```javascript
// ❌ BAD
const title = hasMultipleElements 
    ? `Edit ${kadObject.entityType.toUpperCase()} - ${kadObject.entityName} - Element ${kadObject.elementIndex + 1}` 
    : `Edit ${kadObject.entityType.toUpperCase()} - ${kadObject.entityName}`;

// ✅ GOOD (KADContextMenu.js version)
const title = hasMultipleElements 
    ? "Edit " + kadObject.entityType.toUpperCase() + " - " + kadObject.entityName + " - " + elementTypeLabel + " " + displayIndex 
    : "Edit " + kadObject.entityType.toUpperCase() + " - " + kadObject.entityName;
```

**Lines 28392-28395**:
```javascript
// ❌ BAD
noteDiv.innerHTML = `
    <b>All:</b> Move all points by the same offset as this point (unless Only Z is checked).<br>
    <b>This:</b> Move only this point (unless Only Z is checked).
`;

// ✅ GOOD (KADContextMenu.js version)
noteDiv.innerHTML = "<b>All:</b> Move all points by the same offset as this point (unless Only Z is checked).<br>" + 
    "<b>This:</b> Move only this point (unless Only Z is checked).";
```

---

## Implementation Progress

### Completed ✅
- [x] Phase 1: All delete buttons and renumber logic
- [x] AddHoleDialog.js extraction and conversion
- [x] PatternGenerationDialogs.js extraction and conversion
- [x] HolesContextMenu.js with delete button
- [x] KADContextMenu.js with delete button
- [x] Export syntax error check

### In Progress 🔄
- [ ] Replace showKADPropertyEditorPopup() with wrapper
- [ ] Remove template literal violations

### Planned 📋
- [ ] Extract saveIREDESPopup()
- [ ] Extract saveAQMPopup()
- [ ] Extract showHolesAlongLinePopup()
- [ ] Extract showPatternInPolygonPopup()
- [ ] Extract showHolesAlongPolylinePopup()
- [ ] Extract remaining property dialogs
- [ ] Extract remaining KAD dialogs

---

## Testing Checklist

### Before Replacement
- [ ] Verify all calls to showKADPropertyEditorPopup() work correctly
- [ ] Test context menu (right-click on KAD object)
- [ ] Test keyboard shortcuts

### After Replacement
- [ ] Verify wrapper delegation works
- [ ] Test Delete button functionality
- [ ] Test segment vs point selection
- [ ] Test auto-renumbering
- [ ] Test line/poly conversion
- [ ] Verify no template literal errors in console

---

## Next Steps

1. ✅ Replace `showKADPropertyEditorPopup()` with wrapper delegation
2. ⚠️ Extract `saveIREDESPopup()` to ExportDialogs.js
3. ⚠️ Extract `saveAQMPopup()` to ExportDialogs.js
4. Test all changes thoroughly
5. Continue with remaining dialog extractions

---

## Notes

- All wrapper functions should include Step comments explaining delegation
- Preserve original line numbers in comments for reference
- Keep wrapper functions for backward compatibility
- The KADContextMenu.js version is superior (has Delete, proper segment handling, no template literals)
- Export dialogs are high priority as users need them for file generation


