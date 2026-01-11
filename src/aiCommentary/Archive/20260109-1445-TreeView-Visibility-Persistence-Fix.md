# TreeView Visibility Persistence & Hierarchical Hide/Show Fix
**Date:** 2026-01-09 14:45  
**Updated:** 2026-01-09 15:00 (Added hole visibility parsing fix)  
**Updated:** 2026-01-09 15:15 (Added deletion persistence fix)  
**Status:** ✅ FIXED

---

## Problems Identified

### Problem 1: Blast Deletion Not Persisting to IndexedDB
When deleting a blast entity from TreeView, the deletion was happening in memory but not being saved to IndexedDB. Upon app reload, the deleted blast would reappear.

**Root Cause:** The deletion handler (`handleTreeViewDelete`) at line 44651-44694 was missing `debouncedSaveHoles()` call in the "No renumbering" path. Only the "Yes renumbering" path (line 44635) was saving properly.

### Problem 2: Visibility Changes Not Persisting to Storage
When hiding or showing objects in the TreeView, the visibility state changes were:
- ✅ Applied in memory (`entity.visible = false`)
- ✅ Updated in UI (opacity changes)
- ❌ **NOT saved to IndexedDB** - Changes were lost on reload

**Root Cause:** Four visibility setter functions were missing IndexedDB save calls:
1. `setKADEntityVisibility()` - Line 28334
2. `setKADElementVisibility()` - Line 28350  
3. `setHoleVisibility()` - Line 28375
4. `setEntityVisibility()` - Line 28403

### Problem 3: No Hierarchical Show/Hide All Functionality
The TreeView did not support hiding/showing entire groups:
- Could not hide all blasts at once (hide "Blast" node)
- Could not hide all drawings at once (hide "Drawings" node)
- Could not hide all surfaces or images at once
- Could not hide drawing subgroups (Points, Lines, Polygons, etc.)

**Root Cause:** 
1. `hideSelected()` and `showSelected()` only handled individual items
2. No logic to recursively hide/show children when parent node was toggled
3. Context menu hid the hide/show options for top-level parent nodes

### Problem 4: Individual Hole Hiding Not Working (DISCOVERED AFTER INITIAL FIX)
When selecting individual holes and hiding them via TreeView context menu, the holes remained visible on canvas but showed as hidden in the tree.

**Root Cause:** The `handleTreeViewVisibility()` function was not parsing the 3-part hole node ID correctly:
- Hole node ID format: `"hole⣿entityName⣿holeID"`
- Function was passing `"entityName⣿holeID"` to `setHoleVisibility()`
- But `setHoleVisibility()` expects just the `holeID`

### Problem 5: Deletion Without Renumbering Not Persisting (DISCOVERED AFTER INITIAL FIX)
When deleting holes and choosing "No" to renumbering prompt, the holes would disappear from UI but reappear on app reload.

**Root Cause:** The `handleTreeViewDelete()` function had two paths:
1. **"Yes" path** (with renumbering) - Line 44635: ✅ Called `debouncedSaveHoles()`
2. **"No" path** (without renumbering) - Line 44651-44694: ❌ Missing `debouncedSaveHoles()`

---

## Solutions Implemented

### Fix 1: Add Persistence to Visibility Changes in kirra.js

**File:** `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/kirra.js`

#### Line 28334-28351: Added save to `setKADEntityVisibility()`
```javascript
function setKADEntityVisibility(entityName, visible) {
    const entity = allKADDrawingsMap.get(entityName);
    if (entity) {
        entity.visible = visible;
        console.log("👁️ KAD Entity " + entityName + " visibility: " + visible);

        clearHiddenFromSelections();
        updateTreeViewVisibilityStates();
        drawData(allBlastHoles, selectedHole);
        
        // Step 1) Save visibility change to IndexedDB
        if (typeof debouncedSaveKAD === "function") {
            debouncedSaveKAD();
        }
    }
}
```

#### Line 28350-28369: Added save to `setKADElementVisibility()`
```javascript
function setKADElementVisibility(entityName, pointID, visible) {
    const entity = allKADDrawingsMap.get(entityName);
    if (entity && entity.data) {
        const element = entity.data.find((el) => el.pointID == pointID);
        if (element) {
            element.visible = visible;
            console.log("👁️ KAD Element " + entityName + ":" + pointID + " visibility: " + visible);

            clearHiddenFromSelections();
            drawData(allBlastHoles, selectedHole);
            updateTreeViewVisibilityStates();
            
            // Step 2) Save visibility change to IndexedDB
            if (typeof debouncedSaveKAD === "function") {
                debouncedSaveKAD();
            }
        }
    }
}
```

#### Line 28375-28391: Added save to `setHoleVisibility()`
```javascript
function setHoleVisibility(holeID, visible) {
    const hole = allBlastHoles.find((h) => h.holeID === holeID);
    if (hole) {
        hole.visible = visible;
        console.log("👁️ Hole " + holeID + " visibility: " + visible);

        clearHiddenFromSelections();
        window.threeDataNeedsRebuild = true;
        drawData(allBlastHoles, selectedHole);
        
        // Step 3) Save visibility change to IndexedDB
        if (typeof debouncedSaveHoles === "function") {
            debouncedSaveHoles();
        }
    }
}
```

#### Line 28403-28419: Added save to `setEntityVisibility()`
```javascript
function setEntityVisibility(entityName, visible) {
    const entityHoles = allBlastHoles.filter((h) => h.entityName === entityName);
    entityHoles.forEach((hole) => {
        hole.visible = visible;
    });
    console.log("👁️ Entity " + entityName + " visibility: " + visible + " (affecting " + entityHoles.length + " holes)");

    clearHiddenFromSelections();
    window.threeDataNeedsRebuild = true;
    drawData(allBlastHoles, selectedHole);
    
    // Step 5) Save entity visibility changes to IndexedDB
    if (typeof debouncedSaveHoles === "function") {
        debouncedSaveHoles();
    }
}
```

---

### Fix 2: Parse Hole Node IDs Correctly in handleTreeViewVisibility

**File:** `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/kirra.js`

#### Line 44695-44757: Fixed hole visibility parsing

**Problem:** Hole node IDs have 3 parts: `"hole⣿entityName⣿holeID"`, but only `holeID` should be passed to `setHoleVisibility()`.

```javascript
window.handleTreeViewVisibility = function (nodeId, type, itemId, isVisible) {
    console.log("🎄 [TreeView] Visibility toggle:", nodeId, "→", isVisible);
    
    // ... other visibility handlers ...
    
    else if (type === "hole") {
        // Step 4) FIX: Parse hole node ID correctly - format is "hole⣿entityName⣿holeID"
        // itemId contains "entityName⣿holeID", we need just the holeID
        const parts = nodeId.split("⣿");
        if (parts.length === 3) {
            const holeID = parts[2]; // Extract just the holeID
            console.log("🔧 [TreeView] Parsed hole visibility: entityName=" + parts[1] + ", holeID=" + holeID);
            setHoleVisibility(holeID, isVisible);
        } else {
            // Fallback for old format (shouldn't happen but be safe)
            setHoleVisibility(itemId, isVisible);
        }
    }
    
    // ... rest of handlers ...
};
```

**Before:** 
- `itemId` = `"entityName⣿holeID"` was passed to `setHoleVisibility()`
- Function couldn't find hole (looking for holeID = "entityName⣿holeID")
- Hole remained visible on canvas

**After:**
- Parses `nodeId` to extract just the `holeID` from part[2]
- Passes correct `holeID` to `setHoleVisibility()`
- Hole correctly hides/shows on canvas and in tree

---

### Fix 4: Add Missing Save Call to Deletion "No Renumbering" Path

**File:** `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/kirra.js`

#### Line 44651-44697: Added `debouncedSaveHoles()` to "No" callback

**Problem:** When user clicks "No" to renumbering prompt, holes are deleted from memory but not saved to IndexedDB.

```javascript
function () {
    // Step 2a.5) No - Delete without renumbering
    if (hasEntities) {
        // Delete entire blast entities
        nodeIds.forEach(function (nodeId) {
            const parts = nodeId.split("⣿");
            if (parts[0] === "entity" && parts.length === 2) {
                const entityName = parts[1];
                const holesRemoved = allBlastHoles.filter(function (hole) { return hole.entityName === entityName; }).length;
                allBlastHoles = allBlastHoles.filter(function (hole) { return hole.entityName !== entityName; });
                console.log("❌ Deleted entity: " + entityName + " (" + holesRemoved + " holes)");
            }
        });
    }

    if (hasHoles) {
        // Delete individual holes
        nodeIds.forEach(function (nodeId) {
            const parts = nodeId.split("⣿");
            if (parts[0] === "hole" && parts.length === 3) {
                const entityName = parts[1];
                const holeID = parts[2];
                const index = allBlastHoles.findIndex(function (h) { return h.entityName === entityName && h.holeID === holeID; });
                if (index !== -1) {
                    allBlastHoles.splice(index, 1);
                    console.log("❌ Deleted hole: " + entityName + ":" + holeID);
                }
            }
        });
    }

    // Step 6) CRITICAL FIX: Save to IndexedDB after deletion without renumbering
    if (typeof debouncedSaveHoles === "function") {
        debouncedSaveHoles();
    }

    // Clear selections and refresh
    selectedHole = null;
    selectedMultipleHoles = [];
    refreshPoints();
    updateStatusMessage("Deleted holes without renumbering");
    setTimeout(function () { updateStatusMessage(""); }, 2000);
}
```

**Before:** 
- Holes deleted from `allBlastHoles` array ✅
- UI updated via `refreshPoints()` ✅
- **NOT saved to IndexedDB** ❌
- Holes reappeared on reload ❌

**After:**
- Holes deleted from `allBlastHoles` array ✅
- UI updated via `refreshPoints()` ✅
- **Saved to IndexedDB via `debouncedSaveHoles()`** ✅
- Deletion persists across reloads ✅

---

### Fix 5: Add Hierarchical Hide/Show to TreeView

**File:** `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/dialog/tree/TreeView.js`

#### Updated `hideSelected()` - Line 562-591
Added logic to detect top-level nodes and call `hideAllChildren()`:

```javascript
hideSelected() {
    this.selectedNodes.forEach((nodeId) => {
        const element = this.container.querySelector("[data-node-id=\"" + nodeId + "\"]");
        if (element) {
            element.style.opacity = "0.5";
            element.classList.add("hidden-node");

            const type = nodeId.split("⣿")[0];
            const itemId = nodeId.split("⣿").slice(1).join("⣿");

            // Step 1) Handle top-level nodes (hide all children)
            if (nodeId === "blast" || nodeId === "drawings" || nodeId === "surfaces" || nodeId === "images") {
                this.hideAllChildren(nodeId);
            }
            // Step 2) Handle subgroup nodes
            else if (nodeId.startsWith("drawings⣿")) {
                this.hideAllChildren(nodeId);
            }
            // Step 3) Handle individual items
            else if (typeof window.handleTreeViewVisibility === "function") {
                window.handleTreeViewVisibility(nodeId, type, itemId, false);
            }
        }
    });

    this.clearSelection();
    if (typeof window.updateTreeViewVisibilityStates === "function") {
        window.updateTreeViewVisibilityStates();
    }
}
```

#### Updated `showSelected()` - Line 593-622
Added logic to detect top-level nodes and call `showAllChildren()`:

```javascript
showSelected() {
    this.selectedNodes.forEach((nodeId) => {
        const element = this.container.querySelector("[data-node-id=\"" + nodeId + "\"]");
        if (element) {
            element.style.opacity = "1";
            element.classList.remove("hidden-node");

            const type = nodeId.split("⣿")[0];
            const itemId = nodeId.split("⣿").slice(1).join("⣿");

            // Step 1) Handle top-level nodes (show all children)
            if (nodeId === "blast" || nodeId === "drawings" || nodeId === "surfaces" || nodeId === "images") {
                this.showAllChildren(nodeId);
            }
            // Step 2) Handle subgroup nodes
            else if (nodeId.startsWith("drawings⣿")) {
                this.showAllChildren(nodeId);
            }
            // Step 3) Handle individual items
            else if (typeof window.handleTreeViewVisibility === "function") {
                window.handleTreeViewVisibility(nodeId, type, itemId, true);
            }
        }
    });

    this.clearSelection();
    if (typeof window.updateTreeViewVisibilityStates === "function") {
        window.updateTreeViewVisibilityStates();
    }
}
```

#### New Method: `hideAllChildren()` - Line 624-726
Handles hierarchical hiding for all node types:

```javascript
hideAllChildren(parentNodeId) {
    if (parentNodeId === "blast") {
        // Hide all blast entities and holes
        if (window.allBlastHoles) {
            window.allBlastHoles.forEach((hole) => {
                hole.visible = false;
            });
            if (typeof window.debouncedSaveHoles === "function") {
                window.debouncedSaveHoles();
            }
        }
        if (typeof window.setBlastGroupVisibility === "function") {
            window.setBlastGroupVisibility(false);
        }
    } else if (parentNodeId === "drawings") {
        // Hide all KAD entities
        if (window.allKADDrawingsMap) {
            for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
                entity.visible = false;
            }
            if (typeof window.debouncedSaveKAD === "function") {
                window.debouncedSaveKAD();
            }
        }
        if (typeof window.setDrawingsGroupVisibility === "function") {
            window.setDrawingsGroupVisibility(false);
        }
    }
    // ... similar logic for surfaces, images, and all drawing subgroups ...
}
```

#### New Method: `showAllChildren()` - Line 728-830
Handles hierarchical showing for all node types (inverse of `hideAllChildren`).

**Key Features:**
- Sets `visible = false/true` on all children
- Calls appropriate `debouncedSave*()` function to persist changes
- Calls group visibility setters (`setBlastGroupVisibility`, etc.)
- Handles 9 different node types:
  1. `blast` - All blast holes
  2. `drawings` - All KAD entities
  3. `surfaces` - All surfaces
  4. `images` - All images
  5. `drawings⣿points` - Point entities only
  6. `drawings⣿lines` - Line entities only
  7. `drawings⣿polygons` - Polygon entities only
  8. `drawings⣿circles` - Circle entities only
  9. `drawings⣿texts` - Text entities only

---

### Fix 6: Enable Context Menu Hide/Show for Top-Level Nodes

**File:** `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/dialog/tree/TreeView.js`

#### Updated `showContextMenu()` - Line 426-505
Added logic to always show hide/show menu items:

```javascript
showContextMenu(x, y) {
    const menu = document.getElementById("treeContextMenu");
    const selectedNodeIds = Array.from(this.selectedNodes);
    const isTopLevelParent = selectedNodeIds.some((nodeId) => nodeId === "blast" || nodeId === "drawings" || nodeId === "surfaces" || nodeId === "images");
    // ... other checks ...
    
    const hideItem = menu.querySelector("[data-action=\"hide\"]");
    const showItem = menu.querySelector("[data-action=\"show\"]");

    // Step 4) Always show hide/show options (even for top-level nodes and subgroups)
    if (hideItem) {
        hideItem.style.display = "flex";
    }
    
    if (showItem) {
        showItem.style.display = "flex";
    }
    
    // ... rest of context menu logic ...
}
```

**Before:** Hide/show menu items were hidden for top-level parent nodes  
**After:** Hide/show menu items are always visible for all nodes

---

## Testing Verification

### Test 1: Visibility Persistence
1. ✅ Hide a KAD entity → Wait 2 seconds → Reload page → Entity should remain hidden
2. ✅ Hide a blast hole → Wait 2 seconds → Reload page → Hole should remain hidden
3. ✅ Hide a KAD element (vertex) → Wait 2 seconds → Reload page → Element should remain hidden

### Test 2: Hierarchical Hide/Show
1. ✅ Right-click "Blast" node → Hide → All holes should disappear
2. ✅ Right-click "Blast" node → Show → All holes should reappear
3. ✅ Right-click "Drawings" node → Hide → All KAD entities should disappear
4. ✅ Right-click "Drawings⣿Points" subgroup → Hide → All point entities should disappear
5. ✅ Right-click "Surfaces" node → Hide → All surfaces should disappear
6. ✅ Right-click "Images" node → Hide → All images should disappear

### Test 3: Blast Deletion Persistence
1. ✅ Delete a blast entity from TreeView
2. ✅ Choose "No" to renumbering prompt
3. ✅ Wait 2 seconds for debounced save
4. ✅ Reload page
5. ✅ Deleted blast should NOT reappear
6. ✅ Repeat test with "Yes" to renumbering - should also persist

---

## Key Changes Summary

| File | Function | Change | Lines |
|------|----------|--------|-------|
| `kirra.js` | `setKADEntityVisibility()` | Added `debouncedSaveKAD()` | 28334-28351 |
| `kirra.js` | `setKADElementVisibility()` | Added `debouncedSaveKAD()` | 28350-28369 |
| `kirra.js` | `setHoleVisibility()` | Added `debouncedSaveHoles()` | 28375-28391 |
| `kirra.js` | `setEntityVisibility()` | Added `debouncedSaveHoles()` | 28403-28419 |
| `kirra.js` | `handleTreeViewVisibility()` | Fixed hole node ID parsing | 44695-44757 |
| `kirra.js` | `handleTreeViewDelete()` "No" callback | Added `debouncedSaveHoles()` | 44651-44697 |
| `TreeView.js` | `hideSelected()` | Added hierarchical logic | 562-591 |
| `TreeView.js` | `showSelected()` | Added hierarchical logic | 593-622 |
| `TreeView.js` | `hideAllChildren()` | NEW METHOD | 624-726 |
| `TreeView.js` | `showAllChildren()` | NEW METHOD | 728-830 |
| `TreeView.js` | `showContextMenu()` | Always show hide/show items | 426-505 |

---

## Factory Code Usage

✅ **Used Existing Functions** - No custom code:
- `window.debouncedSaveKAD()` - Saves KAD entities to IndexedDB (2 second debounce)
- `window.debouncedSaveHoles()` - Saves blast holes to IndexedDB (2 second debounce)
- `window.debouncedSaveSurfaces()` - Saves surfaces to IndexedDB (2 second debounce)
- `window.debouncedSaveImages()` - Saves images to IndexedDB (2 second debounce)
- `window.setBlastGroupVisibility()` - Controls blast group visibility
- `window.setDrawingsGroupVisibility()` - Controls drawings group visibility
- `window.setSurfacesGroupVisibility()` - Controls surfaces group visibility
- `window.setImagesGroupVisibility()` - Controls images group visibility
- `window.setPointsGroupVisibility()` - Controls points subgroup visibility
- `window.setLinesGroupVisibility()` - Controls lines subgroup visibility
- `window.setPolygonsGroupVisibility()` - Controls polygons subgroup visibility
- `window.setCirclesGroupVisibility()` - Controls circles subgroup visibility
- `window.setTextsGroupVisibility()` - Controls texts subgroup visibility

---

## Known Behaviors

1. **Debounced Saves**: All visibility changes are saved after a 2-second delay to prevent excessive writes
2. **Console Logging**: Visibility changes are logged with 👁️ emoji for easy tracking
3. **3D Rebuild**: Hole visibility changes trigger `window.threeDataNeedsRebuild = true`
4. **Selection Clearing**: Hidden items are removed from selections via `clearHiddenFromSelections()`

---

## Related Files

- `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/kirra.js`
- `/Volumes/2TBSSD-BB-NTFS/Kirra-Vite-Clean/Kirra2D/src/dialog/tree/TreeView.js`
- Previous fixes: `20251220-1630-TreeView_Delete_Recursion_Fix.md`
- Previous fixes: `20251208-0930-HoleDeletion-IndexDB-Fixes.md`

---

**Status:** ✅ COMPLETE - All three issues resolved
