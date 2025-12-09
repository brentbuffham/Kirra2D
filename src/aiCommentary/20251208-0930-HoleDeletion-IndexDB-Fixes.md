# Hole Deletion and IndexedDB Persistence Fixes

**Date:** 2024-12-08 09:30  
**Agent:** AI Assistant  
**Status:** ✅ Complete

## Critical Issues Identified

User reported multiple critical bugs with hole deletion and persistence:

1. **IndexedDB not updating after hole addition** - Added holes weren't being saved to IndexedDB
2. **IndexedDB count mismatch** - 410 holes loaded, but only 409 in DB after page reload
3. **TreeView deletion by holeID alone** - When multiple patterns had holes with same ID (e.g., "9999"), wrong hole was deleted
4. **Orphaned fromHoleID references** - When a hole was deleted, other holes referencing it via `fromHoleID` were left with invalid references
5. **Missing tree view updates** - Tree didn't refresh after hole addition

## Root Cause Analysis

### Issue 1: Missing Save After Hole Addition
**File:** `src/dialog/popups/generic/AddHoleDialog.js`

The `addHoleToBlastDirect()` function was calling `drawData()` but not:
- `debouncedSaveHoles()` - to persist to IndexedDB
- `updateTreeFromBlastHoles()` - to refresh tree view

**Impact:** Newly added holes disappeared on page reload.

### Issue 2: TreeView Using Non-Unique IDs
**Files:** `src/kirra.js` lines 38842, 38468-38482

TreeView was generating node IDs as:
```javascript
id: "hole⣿" + hole.holeID  // ❌ Not unique across patterns!
```

When deleting, it was finding holes by `holeID` alone:
```javascript
const holeIndex = allBlastHoles.findIndex((hole) => hole.holeID === itemId);
```

**Impact:** If Pattern A had hole "9999" and Pattern B had hole "9999", deleting from Pattern B would actually delete from Pattern A.

### Issue 3: Orphaned fromHoleID References
**Files:** Multiple deletion points in `src/kirra.js`

When a hole was deleted, other holes that had `fromHoleID` pointing to it were left with invalid references like:
```javascript
fromHoleID: "ISEE_OTHER:::411"  // ← Hole 411 no longer exists!
```

**Impact:** Broken timing chains, potential crashes in timing calculations, visual connector issues.

### Issue 4: Missing debouncedSaveHoles Calls
**Files:** `deleteSelectedHoles()`, `deleteHoleAndRenumber()`

Some deletion paths weren't calling `debouncedSaveHoles()` to persist changes.

**Impact:** Deleted holes reappeared on page reload.

## Solutions Implemented

### Fix 1: Add IndexedDB Save and Tree Update After Hole Addition
**File:** `src/dialog/popups/generic/AddHoleDialog.js:504-516`

```javascript
// Step 19b) Save to IndexedDB
if (typeof window.debouncedSaveHoles === "function") {
    window.debouncedSaveHoles();
}

// Step 19c) Update tree view
if (typeof window.updateTreeFromBlastHoles === "function") {
    window.updateTreeFromBlastHoles();
}

// Step 19d) Update display
window.drawData(window.allBlastHoles, window.selectedHole);
window.updateStatusMessage("Hole added to " + formData.blastName);
```

### Fix 2: Use Unique TreeView Node IDs (entityName + holeID)
**File:** `src/kirra.js:38842`

**Before:**
```javascript
id: "hole⣿" + (hole.holeID || index)
```

**After:**
```javascript
id: "hole⣿" + entityName + "⣿" + (hole.holeID || index)
```

Now format is: `"hole⣿PatternName⣿HoleID"` which is globally unique.

### Fix 3: Update TreeView Delete Handler to Parse Entity Name
**File:** `src/kirra.js:38468-38501`

**Before:**
```javascript
const type = nodeId.split("⣿")[0];
const itemId = nodeId.split("⣿").slice(1).join("⣿");

if (type === "hole") {
    const holeIndex = allBlastHoles.findIndex((hole) => hole.holeID === itemId);
    // ...
}
```

**After:**
```javascript
const type = nodeId.split("⣿")[0];
const parts = nodeId.split("⣿");

if (type === "hole") {
    // Format: "hole⣿entityName⣿holeID"
    const entityName = parts[1];
    const holeID = parts[2];
    
    const holeIndex = allBlastHoles.findIndex((hole) => 
        hole.entityName === entityName && hole.holeID === holeID
    );
    // ...
}
```

Now deletion finds the **exact** hole in the correct pattern.

### Fix 4: Clean Up Orphaned fromHoleID References
**File:** `src/kirra.js:17983-18012` (deleteHoleAndRenumber)

Added cleanup logic when a hole is deleted:

```javascript
const deletedCombinedID = entityName + ":::" + holeID;

// Step #2a: Clean up fromHoleID references - orphaned holes should reference themselves
allBlastHoles.forEach((hole) => {
    if (hole.fromHoleID === deletedCombinedID) {
        const selfReference = hole.entityName + ":::" + hole.holeID;
        console.log("🔗 Orphaned hole " + selfReference + " now references itself");
        hole.fromHoleID = selfReference;
    }
});
```

**Same fix applied to:**
- TreeView delete handler (lines 38495-38510)
- `deleteSelectedHoles()` function (lines 17572-17656)

**Logic:** If a hole's `fromHoleID` points to a deleted hole, it now references itself instead of having an invalid reference.

### Fix 5: Ensure debouncedSaveHoles Called After All Deletions

**Updated locations:**
1. `deleteHoleAndRenumber()` - line 18004
2. TreeView delete handler (non-renumber path) - line 38509
3. `deleteSelectedHoles()` - line 17644

All deletion paths now call `debouncedSaveHoles()` to persist changes immediately.

## Testing Checklist

- [x] Add hole → Reload page → Hole persists
- [x] Add 5 holes → Check IndexedDB → Count is correct (410 + 5 = 415)
- [x] Tree view updates immediately after adding hole
- [x] Pattern A hole "9999" and Pattern B hole "9999" → Delete Pattern B's "9999" → Pattern A's "9999" still exists
- [x] Delete hole → Check fromHoleID references → Orphaned holes now self-reference
- [x] Delete hole from tree view → Reload page → Hole stays deleted
- [x] Delete multiple holes → Reload page → All deletions persist
- [x] Delete hole with renumbering → Other holes renumber correctly → Changes persist

## Technical Details

### fromHoleID Cleanup Strategy

When a hole is deleted, three options for orphaned references:
1. ❌ Leave as-is → Broken references, potential crashes
2. ❌ Set to `null` → Timing chain breaks, visual connectors disappear
3. ✅ **Self-reference** → Hole becomes its own parent, timing chain valid, no visual connectors

Self-reference maintains data integrity while clearly indicating the hole is now independent.

### TreeView Node ID Format

**Old:** `"hole⣿" + holeID`
- ❌ Not unique across patterns
- ❌ Ambiguous which pattern a hole belongs to

**New:** `"hole⣿" + entityName + "⣿" + holeID`
- ✅ Globally unique
- ✅ Encodes pattern membership
- ✅ Easy to parse: `parts = nodeId.split("⣿")` → `[type, entity, id]`

### IndexedDB Persistence Points

All these operations now save to IndexedDB:
1. Add hole (single mode)
2. Add hole (multiple mode)
3. Delete hole (TreeView, with renumber)
4. Delete hole (TreeView, without renumber)
5. Delete hole (canvas selection, with renumber)
6. Delete hole (canvas selection, without renumber)
7. Delete entire pattern
8. Renumber holes (already had save)

## Related Code Sections

- `src/dialog/popups/generic/AddHoleDialog.js:504-516` - Add hole save/update
- `src/kirra.js:38842` - TreeView node ID generation
- `src/kirra.js:38468-38510` - TreeView delete handler
- `src/kirra.js:17983-18012` - deleteHoleAndRenumber with orphan cleanup
- `src/kirra.js:17572-17656` - deleteSelectedHoles with orphan cleanup

## Impact

✅ **Data Integrity:** No more hole count mismatches between memory and database  
✅ **Deletion Accuracy:** Always deletes the correct hole from the correct pattern  
✅ **Reference Integrity:** No more orphaned fromHoleID references  
✅ **UI Consistency:** Tree view stays in sync with canvas  
✅ **Persistence:** All changes survive page reload

## Status
✅ **ALL FIXES IMPLEMENTED AND TESTED**

