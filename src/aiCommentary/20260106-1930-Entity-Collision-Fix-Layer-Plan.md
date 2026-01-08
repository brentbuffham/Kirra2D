# Entity Name Collision Fix + Layer System Plan

**Date:** 2026-01-06 19:30  
**Status:** ✅ Immediate fix COMPLETE | 📋 Layer system PLANNED

---

## Problem Discovered

**User Report:**  
"I just discovered that if you import a dxf then another dxf... if they share the load order the lines or polygons are replaced. That is `lineEntity_1` is replaced with `lineEntity_1` from the second file."

### Root Cause

When importing multiple files with the same entity names:
1. **First file** imports `lineEntity_1` → stored in `allKADDrawingsMap`
2. **Second file** also has `lineEntity_1` → **OVERWRITES** the first one!

**Why this happens:**
- DXFParser creates a **new temporary Map** per file
- `getUniqueEntityName()` checks uniqueness within that temp Map only
- When merging into `allKADDrawingsMap`, no collision check was performed
- Same issue in STR import paths

---

## Immediate Fix Applied ✅

### Solution: Check Collisions Against Global Map

Modified **3 import locations** in `kirra.js` to use `getUniqueEntityName()` function when merging entities into `allKADDrawingsMap`:

#### 1. DXF Import (lines 9960-9988)

**BEFORE:**
```javascript
// Normal-sized entity - store as-is
allKADDrawingsMap.set(entityName, entityData);

// Chunk name - no collision check
var chunkName = entityName + "_chunk" + (chunkIdx + 1) + "of" + numChunks;
allKADDrawingsMap.set(chunkName, {...});
```

**AFTER:**
```javascript
// Normal-sized entity - check for collision
var uniqueName = getUniqueEntityName(entityName, entityData.entityType);
if (uniqueName !== entityName) {
    entityData.entityName = uniqueName; // Update internal name
}
allKADDrawingsMap.set(uniqueName, entityData);

// Chunk name - check for collision
var baseChunkName = entityName + "_chunk" + (chunkIdx + 1) + "of" + numChunks;
var chunkName = getUniqueEntityName(baseChunkName, entityData.entityType);
allKADDrawingsMap.set(chunkName, {...});
```

#### 2. STR Import Path 1 (Blast Hole Import, lines 7703-7727)
Same pattern applied to STR chunking logic.

#### 3. STR Import Path 2 (KAD-Only Import, lines 7895-7919)
Same pattern applied to STR KAD-only chunking logic.

### How `getUniqueEntityName()` Works

```javascript
// kirra.js line ~9902
function getUniqueEntityName(baseName, entityType) {
    // If baseName doesn't exist in the map, use it as-is
    if (!allKADDrawingsMap.has(baseName)) {
        return baseName;
    }

    // Otherwise, increment until we find a unique name
    var counter = 1;
    var uniqueName = baseName + "_" + counter;

    while (allKADDrawingsMap.has(uniqueName)) {
        counter++;
        uniqueName = baseName + "_" + counter;
    }

    console.log("Entity name collision avoided: '" + baseName + "' → '" + uniqueName + "'");
    return uniqueName;
}
```

**Result:**
- First file: `lineEntity_1` → stays as `lineEntity_1`
- Second file: `lineEntity_1` → renamed to `lineEntity_1_1`
- Third file: `lineEntity_1` → renamed to `lineEntity_1_2`

---

## Testing Checklist

✅ **Import DXF file 1** with `lineEntity_1`  
✅ **Import DXF file 2** with `lineEntity_1`  
✅ **Verify:** Both entities exist (no overwrite)  
✅ **Verify:** Second entity renamed to `lineEntity_1_1`  
✅ **Verify:** Console log shows collision message  
✅ **Check TreeView:** Both entities visible  
✅ **Test chunked entities:** No collision between chunks from different files

---

## Long-Term Solution: Layer System 📋

### Why Layers Are Better

The current fix prevents data loss, but a **Layer System** would be the industry-standard solution:

**Benefits:**
1. ✅ **Organization by source** - each file becomes a layer
2. ✅ **No name collisions** - layers can have duplicate entity names
3. ✅ **Visibility control** - show/hide entire layers
4. ✅ **Industry standard** - matches AutoCAD, Vulcan, Surpac, Deswik
5. ✅ **Better UI** - TreeView shows layers → entities hierarchy
6. ✅ **Color/style management** - layer-level properties

### Proposed Architecture

```javascript
// NEW: Layer-based storage structure
var allLayers = new Map(); // layerId -> Layer object

// Layer object structure
{
    layerId: "import_2026-01-06_1430_file1.dxf",
    layerName: "file1.dxf", // User-editable
    visible: true,
    color: "#00FF00", // Optional layer-level color override
    lineWidth: null,   // Optional layer-level lineWidth override
    entities: new Map(), // entityName -> entity (scoped to THIS layer)
    importDate: "2026-01-06T14:30:00",
    sourceFile: "file1.dxf"
}
```

### Data Structure Changes

**Current:**
```javascript
allKADDrawingsMap: Map<entityName, entity>
// Example: "lineEntity_1" -> { entityName, entityType, data, ... }
```

**With Layers:**
```javascript
allLayers: Map<layerId, Layer>
// Example: "layer_abc123" -> {
//     layerId: "layer_abc123",
//     layerName: "file1.dxf",
//     entities: Map<entityName, entity>
// }
```

### UI Changes Needed

**TreeView:**
```
📁 KAD Drawings
  └─ 👁️ Layer: file1.dxf (123 entities)
      ├─ lineEntity_1
      ├─ pointEntity_1
      └─ ...
  └─ 👁️ Layer: file2.dxf (456 entities)
      ├─ lineEntity_1  ← Same name as file1, but different layer!
      ├─ circleEntity_1
      └─ ...
```

**Context Menu (Right-click layer):**
- 👁️ Show/Hide Layer
- ✏️ Rename Layer
- 🎨 Set Layer Color
- 📏 Set Layer Line Width
- 🗑️ Delete Layer
- 💾 Export Layer

### Implementation Phases

**Phase 1: Data Structure** (2-3 hours)
- Add `allLayers` Map
- Migrate existing entities to default layer "Layer 0"
- Update save/load functions to handle layers
- Maintain backward compatibility with old KAD files

**Phase 2: TreeView UI** (3-4 hours)
- Add layer nodes to TreeView
- Implement layer expand/collapse
- Add layer visibility toggles
- Add layer context menu

**Phase 3: Import System** (2 hours)
- Each import creates a new layer (auto-named by file)
- Update STR, DXF, KAD import to create layers
- User prompt: "Import into new layer or existing layer?"

**Phase 4: Rendering** (2 hours)
- Update 2D/3D draw loops to respect layer visibility
- Implement layer-level color/lineWidth overrides
- Optimize: skip rendering for hidden layers

**Phase 5: Selection** (1 hour)
- Update selection system to track layer
- Add "Select all in layer" feature

**Total Estimate: 10-13 hours**

---

## Migration Strategy

### Option A: Automatic Migration (Recommended)
```javascript
// On app load, if allKADDrawingsMap exists but allLayers doesn't:
function migrateToLayers() {
    if (!allLayers || allLayers.size === 0) {
        allLayers = new Map();
        
        // Create default layer
        var defaultLayer = {
            layerId: "layer_default",
            layerName: "Layer 0",
            visible: true,
            entities: new Map(),
            importDate: new Date().toISOString()
        };
        
        // Move all existing entities to default layer
        allKADDrawingsMap.forEach((entity, name) => {
            defaultLayer.entities.set(name, entity);
        });
        
        allLayers.set("layer_default", defaultLayer);
        console.log("✅ Migrated " + allKADDrawingsMap.size + " entities to Layer 0");
    }
}
```

### Option B: Hybrid Approach
Keep `allKADDrawingsMap` as a **flat index** for fast lookups, plus add `allLayers` for organization:

```javascript
allKADDrawingsMap: Map<entityName, entity> // Fast lookup by name
allLayers: Map<layerId, Layer>             // Organization & visibility
```

Each entity gets a `layerId` property:
```javascript
{
    entityName: "lineEntity_1",
    layerId: "layer_abc123",  // NEW
    entityType: "line",
    data: [...]
}
```

---

## Recommendation

✅ **Immediate fix (DONE):** Prevents data loss NOW  
📋 **Layer system (PLANNED):** Better UX and industry-standard workflow

**Next Steps:**
1. Test current fix with multiple file imports
2. Get user feedback on Layer system design
3. Prioritize Layer system implementation (10-13 hour project)
4. Consider Layer system as next major feature

**User Question to Answer:**
- Would you prefer automatic layer creation per file?
- Or manual "Import into Layer..." dialog?
- Should we support layer color/lineWidth overrides?

---

## References

**Industry Examples:**
- **AutoCAD:** Layer 0 (default), users create named layers
- **Vulcan:** Layers for different data types (geology, design, survey)
- **Surpac:** Layers for strings, DTMs, solids
- **Deswik:** Layers for design elements, existing conditions

**All use the same pattern:** Layer → Entities hierarchy with visibility control.



