# Holes Along Polyline Dialog Migration to FloatingDialog

**Date**: 2025-12-22 22:12  
**Status**: ✅ COMPLETED

## Summary

Migrated `showHolesAlongPolylinePopup` function from SweetAlert2 to FloatingDialog class and moved it from `kirra.js` to `PatternGenerationDialogs.js` for better code organization and consistency with other pattern generation dialogs.

---

## Changes

### `src/dialog/popups/generic/PatternGenerationDialogs.js`

**Added Functions:**
- `showHolesAlongPolylinePopup(vertices, selectedPolyline)` - Main dialog function
- `setupHolesAlongPolylineEventListeners(formContent)` - Event listener setup for dynamic field updates

**Key Features:**
- Uses `createEnhancedFormContent` for consistent form styling
- Implements canvas click prevention while dialog is open
- Dynamic field updates for `useGradeZ` and `useLineBearing` checkboxes
- Proper boolean conversion helper (`toBool`) for checkbox values
- Modal behavior with `closeOnOutsideClick: false`
- Comprehensive error handling and debug logging

**Form Fields:**
- Blast Name (text)
- Numerical Names (checkbox)
- Starting Hole Number (number)
- Spacing (m) (number)
- Collar Elevation (m) (number)
- Use Grade Z (checkbox) - dynamically enables/disables Grade Z and Length fields
- Grade Elevation (m) (number) - disabled when Use Grade Z is unchecked
- Length (m) (number) - disabled when Use Grade Z is checked
- Subdrill (m) (number)
- Hole Angle (° from vertical) (number)
- Bearings are 90° to Segment (checkbox) - dynamically enables/disables Bearing field
- Hole Bearing (°) (number) - disabled when "Bearings are 90° to Segment" is checked
- Diameter (mm) (number)
- Hole Type (text)
- Reverse Direction (checkbox)

**Event Listeners:**
- `useGradeZ` checkbox: Calculates length from grade or grade from length based on checkbox state
- `useLineBearing` checkbox: Enables/disables bearing input field
- Real-time calculations update as user changes collarZ, gradeZ, length, angle, or subdrill values

**Canvas Click Prevention:**
- Removes `handleHolesAlongPolyLineClick` event listeners when dialog opens
- Restores event listeners on confirm or cancel
- Prevents accidental canvas interactions while dialog is active

**Tool State Management:**
- Clears selection states (`selectedPolyline`, `polylineStartPoint`, `polylineEndPoint`, `polylineStep`)
- Resets tool checkbox state on confirm/cancel
- Redraws canvas to clear visual indicators

**Exposed Globally:**
- `window.showHolesAlongPolylinePopup`
- `window.setupHolesAlongPolylineEventListeners`

### `src/kirra.js`

**Removed:**
- `showHolesAlongPolylinePopup(vertices, selectedPolyline)` function (lines 32939-33123)
- `setupHolesAlongPolylineEventListeners(formContent)` function (lines 33125-33207)
- Replaced with comment: `// Moved to src/dialog/popups/generic/PatternGenerationDialogs.js`

**Updated:**
- Line 31146: Changed `showHolesAlongPolylinePopup(pathVertices, selectedPolyline)` to `window.showHolesAlongPolylinePopup(pathVertices, selectedPolyline)`

**Added Exposures:**
- Line 31164: `window.handleHolesAlongPolyLineClick = handleHolesAlongPolyLineClick;` - Exposed for PatternGenerationDialogs.js to access
- Line 32938: `window.generateHolesAlongPolyline = generateHolesAlongPolyline;` - Exposed for PatternGenerationDialogs.js to call

---

## Issues Encountered and Resolved

### Issue 1: Function Not Found After Migration
**Problem:** After moving the function to PatternGenerationDialogs.js, holes were not being generated.

**Root Cause:** `generateHolesAlongPolyline` function was not exposed on the `window` object, so PatternGenerationDialogs.js could not access it.

**Solution:** Added `window.generateHolesAlongPolyline = generateHolesAlongPolyline;` after the function definition in kirra.js.

### Issue 2: Canvas Event Handler Not Accessible
**Problem:** `handleHolesAlongPolyLineClick` was not accessible from PatternGenerationDialogs.js for removing/restoring event listeners.

**Root Cause:** Function was not exposed on `window` object.

**Solution:** Added `window.handleHolesAlongPolyLineClick = handleHolesAlongPolyLineClick;` after the function definition in kirra.js.

### Issue 3: Missing Error Handling
**Problem:** No visibility into why holes weren't being generated when function calls failed silently.

**Solution:** Added comprehensive debug logging:
- Logs when `generateHolesAlongPolyline` is called
- Logs parameters and vertices being passed
- Logs completion or errors
- Shows user-friendly error messages if function not found

---

## Technical Details

### Dialog Structure
- **Width:** 350px (compact layout)
- **Height:** 520px
- **Layout Type:** default
- **Draggable:** Yes
- **Resizable:** Yes
- **Modal:** Yes (`closeOnOutsideClick: false`)

### Variable Access Pattern
The migrated function accesses global variables through `window` object:
- `window.canvas` - Canvas element
- `window.handleHolesAlongPolyLineClick` - Click handler function
- `window.generateHolesAlongPolyline` - Hole generation function
- `window.getFormData` - Form data extraction
- `window.createEnhancedFormContent` - Form content creation
- `window.FloatingDialog` - Dialog class
- `window.showModalMessage` - Error/success messages
- `window.drawData` - Canvas redraw function
- `window.debouncedUpdateTreeView` - Tree view update
- `window.holesAlongPolyLineTool` - Tool checkbox element
- `window.allBlastHoles` - Holes array
- `window.selectedHole` - Selected hole reference

### Boolean Conversion
Checkbox values from `getFormData` return as strings ("true"/"false"), so a `toBool` helper function converts them to actual booleans for use in the generation function.

### Dynamic Calculations
The dialog performs real-time calculations:
- **When Use Grade Z is checked:** Calculates length from collarZ, gradeZ, subdrill, and angle
- **When Use Grade Z is unchecked:** Calculates gradeZ from collarZ, length, subdrill, and angle
- Updates occur on any change to collarZ, gradeZ, length, angle, or subdrill inputs

---

## Testing Notes

**Before Migration:**
- Function worked correctly with SweetAlert2
- Holes were generated successfully
- Dialog appeared and functioned as expected

**After Migration:**
- Dialog appears correctly using FloatingDialog
- Form fields render properly
- Dynamic field updates work (useGradeZ, useLineBearing)
- Canvas click prevention works (no accidental interactions)
- Holes are generated successfully after exposing functions on window
- Tool state resets correctly on confirm/cancel

**Verification Steps:**
1. Select a polyline/line using holes along polyline tool
2. Select start and end points
3. Dialog appears with FloatingDialog styling
4. Modify form fields and verify dynamic updates
5. Click OK - holes should be generated
6. Verify holes appear on canvas
7. Verify tool deactivates after generation

---

## Related Files

- `src/dialog/FloatingDialog.js` - Base dialog class
- `src/dialog/popups/generic/PatternGenerationDialogs.js` - Pattern generation dialogs module
- `src/dialog/popups/generic/AddHoleDialog.js` - Reference implementation
- `src/kirra.js` - Main application file (contains `generateHolesAlongPolyline`)

---

## Future Considerations

1. Consider extracting `generateHolesAlongPolyline` to a separate module for better organization
2. Consider exposing more variables on window object or using a dependency injection pattern
3. Consider consolidating boolean conversion helper into a shared utility
4. Consider adding unit tests for the dialog form validation and calculations

---

## Migration Pattern

This migration follows the same pattern as other dialog migrations:
1. Convert from SweetAlert2 to FloatingDialog
2. Use `createEnhancedFormContent` for form structure
3. Move to appropriate dialog module file
4. Expose necessary functions/variables on window object
5. Add comprehensive error handling and logging
6. Update call sites to use `window.functionName`

