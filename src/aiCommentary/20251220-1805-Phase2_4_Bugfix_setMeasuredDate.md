# Phase 2.4 Bugfix - Missing setMeasuredDate Exposure
**Date**: 2025-12-20 18:05 UTC  
**Issue**: `window.setMeasuredDate is not a function`  
**Status**: ✅ FIXED

---

## Error Details

**Error Message**:
```
HolePropertyDialogs.js:555 Uncaught TypeError: window.setMeasuredDate is not a function
    at Object.onConfirm (HolePropertyDialogs.js:555:58)
    at HTMLButtonElement.<anonymous> (FloatingDialog.js:206:46)
```

**Triggered By**: Using "Record the measured length of hole" dialog (measuredLengthPopup)

**Root Cause**: The `setMeasuredDate()` function was used by the extracted property dialogs but was not exposed globally via `window.setMeasuredDate`.

---

## Fix Applied

### Modified: `src/kirra.js` (line 18665)

Added global exposure:

```javascript
// Expose setMeasuredDate for HolePropertyDialogs.js
window.setMeasuredDate = setMeasuredDate;
```

**Function Location**: Line 20060-20069 in kirra.js

**Function Purpose**: Returns a formatted timestamp string for measured data (length, mass, comments)

**Format**: `DD/MM/YYYY HH:MM:SS`

---

## Functions Using setMeasuredDate

The following extracted functions in `HolePropertyDialogs.js` depend on this:

1. `measuredLengthPopup()` - Records measured hole length with timestamp
2. `measuredMassPopup()` - Records measured explosive mass with timestamp  
3. `measuredCommentPopup()` - Records field comments with timestamp

---

## Testing Checklist

- [x] Error identified in browser console
- [x] Function located in kirra.js (line 20060)
- [x] Global exposure added (line 18665)
- [ ] Test measuredLengthPopup dialog
- [ ] Test measuredMassPopup dialog
- [ ] Test measuredCommentPopup dialog
- [ ] Verify timestamps are correctly recorded

---

## Lesson Learned

**When extracting dialog functions, check for ALL dependencies:**
1. ✅ Direct dependencies (FloatingDialog, createFormContent, getFormData)
2. ✅ Global state variables (selectedHole, allBlastHoles, clickedHole)
3. ⚠️ **Helper functions** (setMeasuredDate, isHoleVisible, etc.)
4. ✅ Debounced functions (debouncedUpdateTreeView, debouncedSaveHoles)

**Recommendation**: Before marking extraction complete, perform a dependency scan:
```bash
grep -n "window\." HolePropertyDialogs.js | grep -v "window\.\(FloatingDialog\|createFormContent\|getFormData\|allBlastHoles\|selectedHole\)"
```

This would have caught the missing `window.setMeasuredDate` exposure.

---

## Status

✅ **FIXED** - Please reload Kirra2D and test the measured length/mass/comment dialogs to confirm.

**File Modified**: `src/kirra.js` (1 line added)  
**Time to Fix**: 2 minutes

