---
name: Pattern Dialog Conversion
overview: Convert showPatternInPolygonPopup() and addPatternPopup() from Swal2 to a unified FloatingDialog-based function in a new PatternGenerationDialogs.js module, using HolesContextMenu.js as the template.
todos:
  - id: fix-kad-bug
    content: Fix selectedKADObjects undeclared bug in editBlastName/editHoleLength
    status: completed
  - id: fix-pattern-bug
    content: Debug and fix addPatternPopup broken connections
    status: completed
  - id: convert-add-hole
    content: Convert addHolePopup() Swal→FloatingDialog
    status: completed
  - id: convert-add-pattern
    content: Convert addPatternPopup() Swal→FloatingDialog
    status: completed
  - id: convert-holes-line
    content: Convert showHolesAlongLinePopup() Swal→FloatingDialog
    status: pending
  - id: convert-holes-polyline
    content: Convert showHolesAlongPolylinePopup() Swal→FloatingDialog
    status: pending
  - id: convert-pattern-polygon
    content: Convert showPatternInPolygonPopup() Swal→FloatingDialog
    status: completed
  - id: convert-aqm
    content: Convert saveAQMPopup() Swal→FloatingDialog
    status: pending
  - id: convert-update
    content: Convert updatePopup() Swal→FloatingDialog (already extracted)
    status: pending
  - id: cleanup-swal
    content: Replace redundant Swal calls with showModalMessage/showConfirmationDialog
    status: pending
---

# Pattern Dialog Conversion to FloatingDialog

## Overview

Convert the pattern generation dialogs from Swal2 to FloatingDialog by creating a unified function that handles both "Add Pattern" (grid-based with start point) and "Generate Pattern in Polygon" (polygon-based) modes. This will fix the broken addPatternPopup and modernize showPatternInPolygonPopup.

## Analysis

### Current State

**addPatternPopup()** - Line 19510-19764 (~255 lines)

- Uses Swal.fire with template literals
- Fields: blastName, nameTypeIsNumerical, rowOrientation, x, y, z, useGradeZ, gradeZ, diameter, type, angle, bearing, length, subdrill, spacingOffset, burden, spacing, rows, holesPerRow
- User reports "broken connections" issue
- Creates rectangular grid pattern from start point

**showPatternInPolygonPopup()** - Line 32929-33822 (~893 lines)

- Uses Swal.fire with template literals  
- Fields: blastName, nameTypeIsNumerical, startNumber, burden, spacing, spacingOffset, collarZ, useGradeZ, gradeZ, length, subdrill, angle, bearing, diameter, type
- Has `//! REDO with the FloatingDialog class` comment
- Creates pattern inside selected polygon

**Common Fields** (14 total):

- blastName, nameTypeIsNumerical, useGradeZ, gradeZ, diameter, type, angle, bearing, length, subdrill, spacingOffset, burden, spacing, startNumber/type selection

**Pattern-Only Fields** (5 total):

- rowOrientation, x, y, z, rows, holesPerRow

**Key Behaviors Both Share**:

- useGradeZ checkbox enables/disables gradeZ and length fields
- Real-time calculations: length ↔ gradeZ based on elevation/collarZ, angle, subdrill
- LocalStorage persistence
- Validation logic for all numeric fields

## Implementation Plan

### Step 1: Create New Module

Create [`src/dialog/popups/generic/PatternGenerationDialogs.js`](src/dialog/popups/generic/PatternGenerationDialogs.js)

### Step 2: Build Unified Pattern Dialog Function

Create `showPatternDialog(mode, worldX, worldY)` where mode is:

- `"add_pattern"` - Shows pattern-specific fields (orientation, start X/Y/Z, rows, holesPerRow)
- `"polygon_pattern"` - Hides pattern-specific fields

**Function Structure** (based on [`HolesContextMenu.js`](src/dialog/contextMenu/HolesContextMenu.js)):

```javascript
function showPatternDialog(mode, worldX, worldY) {
    // Step 1) Determine mode and defaults
    const isAddPattern = (mode === "add_pattern");
    const title = isAddPattern ? "Add a Pattern?" : "Generate Pattern in Polygon";
    const localStorageKey = isAddPattern ? "savedAddPatternPopupSettings" : "savedPatternInPolygonSettings";
    
    // Step 2) Load last values from localStorage
    const savedSettings = JSON.parse(localStorage.getItem(localStorageKey)) || {};
    const lastValues = {
        blastName: savedSettings.blastName || (isAddPattern ? "Created_Blast" + Date.now() : "PolygonPattern_" + Date.now()),
        nameTypeIsNumerical: savedSettings.nameTypeIsNumerical !== undefined ? savedSettings.nameTypeIsNumerical : !isAddPattern,
        // ... all 19 fields
    };
    
    // Step 3) Define form fields conditionally
    const fields = [
        { label: "Blast Name", name: "blastName", type: "text", value: lastValues.blastName },
        { label: "Numerical Names", name: "nameTypeIsNumerical", type: "checkbox", checked: lastValues.nameTypeIsNumerical },
        { label: "Starting Hole Number", name: "startNumber", type: "number", value: lastValues.startNumber }
    ];
    
    // Step 3a) Add pattern-specific fields ONLY if mode is "add_pattern"
    if (isAddPattern) {
        fields.push(
            { label: "Orientation", name: "rowOrientation", type: "number", value: lastValues.rowOrientation },
            { label: "Start X", name: "x", type: "number", value: worldX || lastValues.x },
            { label: "Start Y", name: "y", type: "number", value: worldY || lastValues.y },
            { label: "Start Z", name: "z", type: "number", value: lastValues.z }
        );
    }
    
    // Step 3b) Add collar Z for polygon mode only
    if (!isAddPattern) {
        fields.push({ label: "Collar Elevation (m)", name: "collarZ", type: "number", value: lastValues.collarZ });
    }
    
    // Step 3c) Add common fields
    fields.push(
        { label: "Use Grade Z", name: "useGradeZ", type: "checkbox", checked: lastValues.useGradeZ },
        { label: "Grade Elevation (m)", name: "gradeZ", type: "number", value: lastValues.gradeZ, disabled: !lastValues.useGradeZ },
        { label: "Length (m)", name: "length", type: "number", value: lastValues.length, disabled: lastValues.useGradeZ },
        { label: "Subdrill (m)", name: "subdrill", type: "number", value: lastValues.subdrill },
        { label: "Hole Angle (° from vert)", name: "angle", type: "number", value: lastValues.angle },
        { label: "Hole Bearing (°)", name: "bearing", type: "number", value: lastValues.bearing },
        { label: "Diameter (mm)", name: "diameter", type: "number", value: lastValues.diameter },
        { label: "Hole Type", name: "type", type: "text", value: lastValues.type },
        { label: "Burden (m)", name: "burden", type: "number", value: lastValues.burden },
        { label: "Spacing (m)", name: "spacing", type: "number", value: lastValues.spacing },
        { label: "Offset", name: "spacingOffset", type: "number", value: lastValues.spacingOffset }
    );
    
    // Step 3d) Add pattern-specific dimension fields
    if (isAddPattern) {
        fields.push(
            { label: "Rows", name: "rows", type: "number", value: lastValues.rows },
            { label: "Holes Per Row", name: "holesPerRow", type: "number", value: lastValues.holesPerRow }
        );
    }
    
    // Step 4) Create form content using createEnhancedFormContent
    const formContent = window.createEnhancedFormContent(fields, false);
    
    // Step 4a) Add offset information note
    const offsetNote = document.createElement("div");
    offsetNote.style.gridColumn = "1 / -1";
    offsetNote.style.fontSize = "10px";
    offsetNote.style.color = "#888";
    offsetNote.textContent = "Offset Information: Staggered = -0.5 or 0.5, Square = -1, 0, 1";
    formContent.appendChild(offsetNote);
    
    // Step 5) Create FloatingDialog
    const dialog = new window.FloatingDialog({
        title: title,
        content: formContent,
        layoutType: "default",
        width: 500,
        height: 700,
        showConfirm: true,
        showCancel: true,
        confirmText: "Confirm",
        cancelText: "Cancel",
        draggable: true,
        resizable: true,
        onConfirm: () => {
            const formData = window.getFormData(formContent);
            processPatternGeneration(formData, mode);
        }
    });
    
    dialog.show();
    
    // Step 6) Add event listeners for dynamic field updates (after show)
    setupPatternDialogEventListeners(formContent, isAddPattern);
}
```

### Step 3: Create Event Listener Setup Function

```javascript
function setupPatternDialogEventListeners(formContent, isAddPattern) {
    const useGradeZCheckbox = formContent.querySelector('#useGradeZ');
    const gradeZInput = formContent.querySelector('#gradeZ');
    const lengthInput = formContent.querySelector('#length');
    const angleInput = formContent.querySelector('#angle');
    const subdrillInput = formContent.querySelector('#subdrill');
    
    // For polygon mode, use collarZ; for pattern mode, use z
    const elevationInput = isAddPattern 
        ? formContent.querySelector('#z') 
        : formContent.querySelector('#collarZ');
    
    function updateFieldsBasedOnUseGradeZ() {
        const useGradeZ = useGradeZCheckbox.checked;
        gradeZInput.disabled = !useGradeZ;
        lengthInput.disabled = useGradeZ;
        
        if (useGradeZ) {
            // Calculate length from grade
            const elevation = parseFloat(elevationInput.value) || 0;
            const gradeZ = parseFloat(gradeZInput.value) || 0;
            const subdrill = parseFloat(subdrillInput.value) || 0;
            const angle = parseFloat(angleInput.value) || 0;
            const angleRad = angle * (Math.PI / 180);
            
            const calculatedLength = Math.abs((elevation - gradeZ + subdrill) / Math.cos(angleRad));
            lengthInput.value = calculatedLength.toFixed(2);
        } else {
            // Calculate grade from length
            const elevation = parseFloat(elevationInput.value) || 0;
            const length = parseFloat(lengthInput.value) || 0;
            const subdrill = parseFloat(subdrillInput.value) || 0;
            const angle = parseFloat(angleInput.value) || 0;
            const angleRad = angle * (Math.PI / 180);
            
            const calculatedGradeZ = elevation - (length - subdrill) * Math.cos(angleRad);
            gradeZInput.value = calculatedGradeZ.toFixed(2);
        }
    }
    
    // Add listeners
    useGradeZCheckbox.addEventListener("change", updateFieldsBasedOnUseGradeZ);
    gradeZInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
    lengthInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
    elevationInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
    angleInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
    subdrillInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
    
    // Initial update
    updateFieldsBasedOnUseGradeZ();
}
```

### Step 4: Create Processing Function

Extract validation and generation logic into `processPatternGeneration(formData, mode)`:

```javascript
function processPatternGeneration(formData, mode) {
    const isAddPattern = (mode === "add_pattern");
    
    // Step 1) Validation (11 checks matching original)
    if (!formData.blastName || formData.blastName.trim() === "") {
        window.showModalMessage("Invalid Blast Name", "Please enter a Blast Name.", "warning");
        return;
    }
    
    if (isNaN(formData.diameter) || formData.diameter < 0 || formData.diameter > 1000) {
        window.showModalMessage("Invalid Diameter", "Please enter diameter between 0 and 1000mm.", "warning");
        return;
    }
    
    // ... all validation checks from original
    
    // Step 2) Save to localStorage
    const localStorageKey = isAddPattern ? "savedAddPatternPopupSettings" : "savedPatternInPolygonSettings";
    localStorage.setItem(localStorageKey, JSON.stringify(formData));
    
    // Step 3) Call appropriate generation function
    if (isAddPattern) {
        generateRectangularPattern(formData);
    } else {
        generatePolygonPattern(formData);
    }
}
```

### Step 5: Update kirra.js

Replace existing functions with calls to new unified dialog:

**Line 19510** - Replace `addPatternPopup(worldX, worldY)`:

```javascript
function addPatternPopup(worldX, worldY) {
    // Moved to src/dialog/popups/generic/PatternGenerationDialogs.js
    window.showPatternDialog("add_pattern", worldX, worldY);
}
```

**Line 32929** - Replace `showPatternInPolygonPopup()`:

```javascript
function showPatternInPolygonPopup() {
    // Moved to src/dialog/popups/generic/PatternGenerationDialogs.js
    window.showPatternDialog("polygon_pattern", null, null);
}
```

### Step 6: Update HTML

Add script tag to [`kirra.html`](kirra.html) before kirra.js:

```html
<script src="src/dialog/popups/generic/PatternGenerationDialogs.js"></script>
```

### Step 7: Expose Globals

In PatternGenerationDialogs.js:

```javascript
window.showPatternDialog = showPatternDialog;
window.setupPatternDialogEventListeners = setupPatternDialogEventListeners;
window.processPatternGeneration = processPatternGeneration;
```

## Key Conversion Details

### Template Literal Conversion

All template literals must be converted to string concatenation:

- BEFORE: `` `value="${lastValues.x}"` ``
- AFTER: `"value=\"" + (worldX || lastValues.x) + "\""`

### Conditional Field Rendering

Instead of hiding with CSS or disabled attributes in HTML, simply don't add fields to the fields array when not needed.

### Form Data Retrieval

Use `window.getFormData(formContent)` instead of manual `document.getElementById()` calls.

### Event Listeners

Move from Swal's `didOpen` callback to standard addEventListener after `dialog.show()`.

### Validation

Keep all 11+ validation checks from original implementations.

## Testing Checklist

1. Test Add Pattern dialog opens correctly
2. Test Pattern in Polygon dialog opens correctly
3. Verify pattern-specific fields (orientation, start X/Y/Z, rows, holesPerRow) only show in Add Pattern mode
4. Test useGradeZ checkbox toggles gradeZ/length fields
5. Test length ↔ gradeZ calculations work correctly
6. Test all validation error messages display properly
7. Test localStorage persistence works for both modes
8. Test actual pattern generation completes successfully
9. Verify no console errors or ReferenceErrors
10. Test with both numerical and non-numerical naming modes

## Benefits

1. Fixes broken addPatternPopup "connections" issue
2. Reduces code duplication (2 dialogs → 1 unified function)
3. Uses modern FloatingDialog (draggable, resizable, better UX)
4. Removes Swal2 dependency for these 2 critical dialogs
5. Follows same pattern as HolesContextMenu.js for consistency
6. Estimated reduction: ~1100 lines → ~400 lines (60% reduction)

## Files Modified

- NEW: [`src/dialog/popups/generic/PatternGenerationDialogs.js`](src/dialog/popups/generic/PatternGenerationDialogs.js) (~400 lines)
- MODIFIED: [`src/kirra.js`](src/kirra.js) - Replace 2 large functions with 2 wrapper calls
- MODIFIED: [`kirra.html`](kirra.html) - Add 1 script tag

## Estimated Effort

3-4 hours (combines both dialog conversions into one unified implementation)