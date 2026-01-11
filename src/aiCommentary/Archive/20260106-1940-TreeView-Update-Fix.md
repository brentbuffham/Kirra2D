# TreeView Update Fix - Entity Import

**Date:** 2026-01-06 19:40  
**Status:** ✅ COMPLETE

---

## Problem

**User Report:**  
"Well the tree didn't update on that import."

After fixing the entity name collision issue, the TreeView was not refreshing to show newly imported entities from DXF and STR files.

---

## Root Cause

The `debouncedUpdateTreeView()` function was not being called after storing entities in `allKADDrawingsMap` in some import paths:

1. ❌ **STR Import Path 1** (Blast Holes + KAD): Missing `debouncedUpdateTreeView()`
2. ✅ **STR Import Path 2** (KAD Only): Had `debouncedUpdateTreeView()` ✓
3. ❌ **DXF Import**: Missing `debouncedUpdateTreeView()` (only called in surface save timeout)

Additionally, STR Import Path 1 was also missing `debouncedSaveKAD()` to persist entities to IndexedDB.

---

## Fix Applied

### 1. STR Import Path 1 - Added TreeView Update (line ~7767)

**Location:** After storing KAD entities, before recalculating centroids

```javascript
// Step 6a.8) Update TreeView to show new KAD entities
if (typeof debouncedUpdateTreeView === "function") {
    debouncedUpdateTreeView();
}

// CRITICAL: Recalculate everything after import
```

### 2. STR Import Path 1 - Added Database Save (line ~7816)

**Location:** After saving blast holes to IndexedDB

```javascript
// Save to IndexedDB
if (typeof debouncedSaveHoles === "function") {
    debouncedSaveHoles();
}

// Save KAD entities to IndexedDB
if (typeof debouncedSaveKAD === "function") {
    debouncedSaveKAD();
}
```

### 3. DXF Import - Added TreeView Update (line ~10041)

**Location:** After updating UI elements

```javascript
// Step 5) Update UI elements
updateCentroids();
drawData(allBlastHoles, selectedHole);
debouncedSaveKAD();
zoomToFitAll();

// Step 5a) Update TreeView to show new KAD entities
if (typeof debouncedUpdateTreeView === "function") {
    debouncedUpdateTreeView();
}
```

---

## Complete Import Flow (All Paths Now Consistent)

### STR Path 1 (Blast Holes + KAD)
```
1. Parse file
2. Store blast holes → allBlastHoles
3. Chunk & store KAD entities → allKADDrawingsMap (with collision check ✓)
4. Update TreeView ✓
5. Recalculate centroids, triangles, contours
6. Draw data
7. Save holes to DB
8. Save KAD to DB ✓
9. Show success dialog
```

### STR Path 2 (KAD Only)
```
1. Parse file
2. Chunk & store KAD entities → allKADDrawingsMap (with collision check ✓)
3. Update centroids
4. Draw data
5. Save KAD to DB ✓
6. Zoom to fit
7. Update TreeView ✓
8. Show success dialog
```

### DXF Import
```
1. Parse file
2. Chunk & store KAD entities → allKADDrawingsMap (with collision check ✓)
3. Store surfaces → loadedSurfaces
4. Update centroids
5. Draw data
6. Save KAD to DB ✓
7. Zoom to fit
8. Update TreeView ✓
9. Show success dialog
```

---

## Testing Checklist

✅ **Import DXF file** → TreeView updates  
✅ **Import STR file (blast holes)** → TreeView updates  
✅ **Import STR file (KAD only)** → TreeView updates  
✅ **Import second DXF** → TreeView shows both (with collision handling)  
✅ **Reload page** → Entities load from IndexedDB (debouncedSaveKAD working)

---

## Related Fixes in This Session

1. ✅ **Line Thickness Restored** - Hybrid rendering (thin/thick lines)
2. ✅ **Entity Name Collisions Fixed** - Auto-rename with `_1`, `_2` suffixes
3. ✅ **TreeView Updates Fixed** - Consistent across all import paths

---

## Files Modified

- `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/kirra.js`
  - Line ~7767: Added `debouncedUpdateTreeView()` to STR Path 1
  - Line ~7816: Added `debouncedSaveKAD()` to STR Path 1
  - Line ~10041: Added `debouncedUpdateTreeView()` to DXF import

---

## Impact

**Before:**
- Import file → entities stored in memory ✓
- TreeView doesn't update ❌
- User has to manually refresh or reload page ❌

**After:**
- Import file → entities stored in memory ✓
- TreeView updates automatically ✓
- Database saves entities ✓
- User sees new entities immediately ✓



