# Add Hole Dialog - ID Display Bug Fix

**Date:** 2024-12-08 09:00  
**Agent:** AI Assistant  
**Status:** ✅ Complete

## Issue Description

User reported that holes were being added with the correct ID (411) in the console logs, but displaying as `9999` on the canvas. This was happening regardless of whether custom IDs were enabled or disabled.

### Console Evidence
```
🔹 Calling window.addHole with holeID: 411
✅ Hole added successfully with ID: 411
```

But the hole displayed as `9999` on the canvas.

## Root Cause Analysis

### The Problem Chain

1. **Data Type Mismatch:** `FloatingDialog.js` line 842:
```javascript
data[input.name] = input.checked.toString();
```
This converts checkbox values to **strings** (`"true"` or `"false"`), not booleans.

2. **Strict Equality Check:** `kirra.js` `addHole()` function lines 19596-19613:
```javascript
if (useCustomHoleID === true) {
    // Use custom ID path
} else if (useCustomHoleID === false) {
    // Auto-generate ID path
} else {
    newHoleID = 9999; // ← Falls through here!
}
```

3. **The Bug:** When `useCustomHoleID` is the string `"false"`:
   - `useCustomHoleID === true` → false (string ≠ boolean)
   - `useCustomHoleID === false` → false (string ≠ boolean)
   - Falls through to `else` → `newHoleID = 9999`

### Why This Happened
- JavaScript's strict equality (`===`) does not perform type coercion
- `"false" === false` evaluates to `false` (string vs boolean)
- The `addHole` function received string values but expected strict booleans

## Solution Implemented

### File: `src/dialog/popups/generic/AddHoleDialog.js`

Modified `addHoleToBlastDirect()` function to explicitly convert string checkbox values to booleans before passing to `addHole()`:

```javascript
function addHoleToBlastDirect(formData, finalX, finalY, holeID) {
    if (typeof window.addHole === "function") {
        // CRITICAL: Convert string "true"/"false" to boolean
        // getFormData returns checkbox values as strings, but addHole expects strict boolean
        const useCustomIDBoolean = formData.useCustomHoleID === "true" || formData.useCustomHoleID === true;
        const useGradeZBoolean = formData.useGradeZ === "true" || formData.useGradeZ === true;
        
        window.addHole(
            useCustomIDBoolean,  // ← Now a proper boolean
            useGradeZBoolean,    // ← Now a proper boolean
            formData.blastName,
            holeID,
            // ... rest of parameters
        );
    }
}
```

### Conversion Logic
The expression `formData.useCustomHoleID === "true" || formData.useCustomHoleID === true` handles both:
- String values from `getFormData()`: `"true"` → true, `"false"` → false
- Already-boolean values (edge case): `true` → true, `false` → false

## Testing Checklist

- [x] Single mode adds holes with correct incrementing IDs (1, 2, 3...)
- [x] Multiple mode adds holes with correct incrementing IDs
- [x] Custom IDs work correctly when checkbox is enabled
- [x] Auto IDs work correctly when checkbox is disabled
- [x] IDs display correctly on canvas (no more 9999)
- [x] IDs persist correctly to IndexedDB
- [x] IDs reload correctly from IndexedDB

## Technical Notes

### Alternative Solutions Considered

1. **Fix in `FloatingDialog.js`:** Change line 842 to return actual boolean
   - **Rejected:** Would affect all dialogs using checkboxes, potential breaking change

2. **Fix in `kirra.js` `addHole()`:** Use loose equality (`==`) instead of strict (`===`)
   - **Rejected:** Bad practice, masks the real issue, could cause other bugs

3. **Fix in `AddHoleDialog.js`:** Convert at call site (SELECTED)
   - **Chosen:** Isolated fix, clear intent, handles edge cases, no breaking changes

### Related Code
- `src/dialog/FloatingDialog.js:836-850` - `getFormData()` function
- `src/kirra.js:19575-19625` - `addHole()` function
- `src/dialog/popups/generic/AddHoleDialog.js:459-493` - `addHoleToBlastDirect()` function

## Lessons Learned

1. **Type Safety:** JavaScript's loose typing requires explicit type checking/conversion at boundaries
2. **Checkbox Values:** HTML checkbox `.checked` is boolean, but serialization to/from forms may convert to strings
3. **Strict Equality:** Using `===` is good practice, but requires matching types on both sides
4. **Debug Strategy:** Console logs showing "success" but canvas showing wrong data → check data type mismatches

## Status
✅ **FIXED** - Holes now display with correct IDs on canvas

## Follow-up Fix: Checkbox State Persistence

**Date:** 2024-12-08 09:15  
**Issue:** User reported that checkbox states (e.g., "Use Custom Hole ID") were not being remembered correctly. When set to `false`, they would reappear as `true` on next dialog open.

### Root Cause
Similar data type issue with localStorage:
1. `localStorage.setItem()` stores `formData` as JSON, which includes string values `"true"`/`"false"` for checkboxes
2. When retrieving, `savedAddHolePopupSettings.useCustomHoleID` is the string `"false"`
3. JavaScript treats any non-empty string as truthy, so `"false"` → true when used in boolean context
4. The ternary check `savedAddHolePopupSettings.useCustomHoleID !== undefined ? savedAddHolePopupSettings.useCustomHoleID : false` returns the string `"false"`, which the checkbox interprets as truthy

### Solution
Added a helper function `toBool()` to properly convert stored string values back to booleans:

```javascript
// Step 3b-1) Helper to convert string "true"/"false" to boolean
const toBool = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value === "true";
    return defaultValue;
};

const lastValues = {
    blastName: savedAddHolePopupSettings.blastName || blastNameValue,
    useCustomHoleID: toBool(savedAddHolePopupSettings.useCustomHoleID, false),
    useGradeZ: toBool(savedAddHolePopupSettings.useGradeZ, false),
    // ... rest of fields
};
```

### Result
✅ Checkbox states now persist correctly across dialog opens
✅ Setting to `false` stays `false`
✅ Setting to `true` stays `true`

