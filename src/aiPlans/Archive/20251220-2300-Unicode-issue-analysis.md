# Unicode Issue Analysis - Kirra.js Console.log Statements

**Generated:** 2025-12-20 13:43:33 UTC

**Analysis Summary:**
- Total console.log statements with corrupted Unicode: 182
- Source file: `src/kirra.js`
- Backup reference: `src/kirra.js.backup2`

**Analysis Method:**
- Compared current kirra.js with kirra.js.backup2
- Identified console.log statements with '??' or '?' replacements
- Matched with corresponding statements containing Unicode symbols in backup
- Used fuzzy matching to handle minor differences between versions


## Unicode Symbol Summary

The following Unicode symbols were found in the backup file and are corrupted in the current file:

| Symbol | Count | Description |
|--------|-------|-------------|
| ✅ | 35 | Check mark/Success |
| ️ | 29 | Unknown |
| 👁 | 15 | Unknown |
| ° | 14 | Unknown |
| 🎨 | 13 | Palette/Color |
| ❌ | 12 | Cross mark/Error |
| 🔍 | 10 | Magnifying glass/Search |
| 📊 | 6 | Bar chart/Statistics |
| 🔗 | 6 | Link |
| 🔄 | 5 | Reload/Refresh |
| → | 5 | Right arrow |
| 🗑 | 5 | Unknown |
| � | 5 | Unknown |
| 📍 | 4 | Pin/Location marker |
| 📐 | 4 | Ruler/Measurement |
| 📷 | 3 | Unknown |
| 🧹 | 3 | Unknown |
| 🔧 | 3 | Unknown |
| 📋 | 3 | Clipboard/List |
| 🔺 | 3 | Triangle/Triangulation |
| 📏 | 3 | Ruler |
| 🎯 | 3 | Target/Focus |
| ⚠ | 2 | Unknown |
| 🎉 | 2 | Unknown |
| ⏭ | 2 | Unknown |
| 🗺 | 2 | Unknown |
| 🎬 | 1 | Clapperboard/Start action |
| 🌍 | 1 | Unknown |
| 🔸 | 1 | Small orange diamond |
| 💥 | 1 | Unknown |
| 🔪 | 1 | Unknown |
| ✂ | 1 | Unknown |
| 🕳 | 1 | Unknown |
| 🌟 | 1 | Unknown |
| 🔥 | 1 | Unknown |
| 🔵 | 1 | Unknown |
| 📝 | 1 | Unknown |
| ⭕ | 1 | Circle |
| 🆘 | 1 | Unknown |
| 🚨 | 1 | Unknown |
| 🖼 | 1 | Unknown |
| × | 1 | Unknown |
| 🚀 | 1 | Rocket/Launch |
| 🌳 | 1 | Tree |

**Total:** 44 different Unicode symbols, 215 total occurrences

---
---

## Instructions

For each finding below:
- Review the **Current** text (with ?? or ? corruption)
- Review the **Original** text (with Unicode symbols from backup)
- Check the **Match Score** (higher is better, >0.7 is good)
- Mark as **CONFIRMED** if the line should be fixed
- Mark as **REJECTED** if the line should remain as-is or if the match is incorrect

---

## Findings

### Finding 1: Line 307

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Preferences loaded successfully");
```

**Original (from backup):**
```javascript
console.log("✅ Preferences loaded successfully");
```

---

### Finding 2: Line 540

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📍

**Current (corrupted):**
```javascript
console.log("?? Three.js local origin set from first hole:", threeLocalOriginX, threeLocalOriginY);
```

**Original (from backup):**
```javascript
console.log("📍 Three.js local origin set from first hole:", threeLocalOriginX, threeLocalOriginY);
```

---

### Finding 3: Line 568

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📍

**Current (corrupted):**
```javascript
console.log("?? Three.js local origin set to centroid:", threeLocalOriginX, threeLocalOriginY);
```

**Original (from backup):**
```javascript
console.log("📍 Three.js local origin set to centroid:", threeLocalOriginX, threeLocalOriginY);
```

---

### Finding 4: Line 714

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎬

**Current (corrupted):**
```javascript
console.log("?? Initializing Three.js rendering system...");
```

**Original (from backup):**
```javascript
console.log("🎬 Initializing Three.js rendering system...");
```

---

### Finding 5: Line 822

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📍

**Current (corrupted):**
```javascript
console.log("?? Set toggle buttons z-index to 10");
```

**Original (from backup):**
```javascript
console.log("📍 Set toggle buttons z-index to 10");
```

---

### Finding 6: Line 890

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📷

**Current (corrupted):**
```javascript
console.log("?? Camera initialized - World:", centroidX.toFixed(2), centroidY.toFixed(2), "Local:", localCentroid.x.toFixed(2), localCentroid.y.toFixed(2), "Scale:", currentScale);
```

**Original (from backup):**
```javascript
console.log("📷 Camera initialized - World:", centroidX.toFixed(2), centroidY.toFixed(2), "Local:", localCentroid.x.toFixed(2), localCentroid.y.toFixed(2), "Scale:", currentScale);
```

---

### Finding 7: Line 898

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? Three.js background set to", darkModeEnabled ? "black" : "white");
```

**Original (from backup):**
```javascript
console.log("🎨 Three.js background set to", darkModeEnabled ? "black" : "white");
```

---

### Finding 8: Line 913

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Three.js rendering system initialized");
```

**Original (from backup):**
```javascript
console.log("✅ Three.js rendering system initialized");
```

---

### Finding 9: Line 965

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📷

**Current (corrupted):**
```javascript
console.log("?? Synced camera TO Three.js - World:", centroidX.toFixed(2), centroidY.toFixed(2), "Local:", localCentroid.x.toFixed(2), localCentroid.y.toFixed(2), "Scale:", currentScale);
```

**Original (from backup):**
```javascript
console.log("📷 Synced camera TO Three.js - World:", centroidX.toFixed(2), centroidY.toFixed(2), "Local:", localCentroid.x.toFixed(2), localCentroid.y.toFixed(2), "Scale:", currentScale);
```

---

### Finding 10: Line 2426

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 0.95

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log(onlyShowThreeJS ? "?? Showing only Three.js rendering" : "?? Showing only 2D canvas");
```

**Original (from backup):**
```javascript
console.log(onlyShowThreeJS ? "🎨 Showing only Three.js rendering" : "🎨 Showing both 2D canvas and Three.js");
```

---

### Finding 11: Line 3133

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🧹

**Current (corrupted):**
```javascript
console.log("?? All selected stores and pattern states reset");
```

**Original (from backup):**
```javascript
console.log("🧹 All selected stores and pattern states reset");
```

---

### Finding 12: Line 3385

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🧹

**Current (corrupted):**
```javascript
console.log("?? All selection state cleared");
```

**Original (from backup):**
```javascript
console.log("🧹 All selection state cleared");
```

---

### Finding 13: Line 5713

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔄

**Current (corrupted):**
```javascript
console.log("?? Three.js canvas resized:", width, height);
```

**Original (from backup):**
```javascript
console.log("🔄 Three.js canvas resized:", width, height);
```

---

### Finding 14: Line 6977

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? User cancelled duplicate resolution");
```

**Original (from backup):**
```javascript
console.log("✅ User cancelled duplicate resolution");
```

---

### Finding 15: Line 7196

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔧 →

**Current (corrupted):**
```javascript
console.log("?? Renumbered duplicate hole:", duplicate.entityName + ":" + oldID, "?", newID);
```

**Original (from backup):**
```javascript
console.log("🔧 Renumbered duplicate hole:", duplicate.entityName + ":" + oldID, "→", newID);
```

---

### Finding 16: Line 7213

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🗑 ️

**Current (corrupted):**
```javascript
console.log("??? Removed duplicate hole:", duplicate.entityName + ":" + duplicate.holeID);
```

**Original (from backup):**
```javascript
console.log("🗑️ Removed duplicate hole:", duplicate.entityName + ":" + duplicate.holeID);
```

---

### Finding 17: Line 7237

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🗑 ️

**Current (corrupted):**
```javascript
console.log("??? Removed original hole:", duplicate.entityName + ":" + duplicate.holeID);
```

**Original (from backup):**
```javascript
console.log("🗑️ Removed original hole:", duplicate.entityName + ":" + duplicate.holeID);
```

---

### Finding 18: Line 7682

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ⚠ ️ →

**Current (corrupted):**
```javascript
console.log("?? Entity name collision avoided: '" + baseName + "' ? '" + uniqueName + "'");
```

**Original (from backup):**
```javascript
console.log("⚠️ Entity name collision avoided: '" + baseName + "' → '" + uniqueName + "'");
```

---

### Finding 19: Line 8086

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? DXF surface saved to database: " + surfaceId);
```

**Original (from backup):**
```javascript
console.log("✅ DXF surface saved to database: " + surfaceId);
```

---

### Finding 20: Line 10673

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** �

**Current (corrupted):**
```javascript
console.log("?? getVisibleHolesAndKADDrawings - allBlastHoles:", allBlastHoles.length);
```

**Original (from backup):**
```javascript
console.log("�� getVisibleHolesAndKADDrawings - allBlastHoles:", allBlastHoles.length);
```

---

### Finding 21: Line 10674

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** �

**Current (corrupted):**
```javascript
console.log("?? getVisibleHolesAndKADDrawings - allKADDrawings:", allKADDrawings.length);
```

**Original (from backup):**
```javascript
console.log("�� getVisibleHolesAndKADDrawings - allKADDrawings:", allKADDrawings.length);
```

---

### Finding 22: Line 10675

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** �

**Current (corrupted):**
```javascript
console.log("?? getVisibleHolesAndKADDrawings - visibleHoles:", visibleHoles.length);
```

**Original (from backup):**
```javascript
console.log("�� getVisibleHolesAndKADDrawings - visibleHoles:", visibleHoles.length);
```

---

### Finding 23: Line 10676

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** �

**Current (corrupted):**
```javascript
console.log("?? getVisibleHolesAndKADDrawings - visibleKADDrawings:", visibleKADDrawings.length);
```

**Original (from backup):**
```javascript
console.log("�� getVisibleHolesAndKADDrawings - visibleKADDrawings:", visibleKADDrawings.length);
```

---

### Finding 24: Line 10778

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📋

**Current (corrupted):**
```javascript
console.log(`?? Entity "${entityName}": type=${entity.entityType}, points=${entity.data ? entity.data.length : 0}, visible=${isVisible}`);
```

**Original (from backup):**
```javascript
console.log(`📋 Entity "${entityName}": type=${entity.entityType}, points=${entity.data ? entity.data.length : 0}, visible=${isVisible}`);
```

---

### Finding 25: Line 10780

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log(`? Why not visible: drawingsGroupVisible=${drawingsGroupVisible}, entity.visible=${entity.visible}, typeGroupVisible=${getTypeGroupVisible(entity.entityType)}`);
```

**Original (from backup):**
```javascript
console.log(`❌ Why not visible: drawingsGroupVisible=${drawingsGroupVisible}, entity.visible=${entity.visible}, typeGroupVisible=${getTypeGroupVisible(entity.entityType)}`);
```

---

### Finding 26: Line 10799

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔺

**Current (corrupted):**
```javascript
console.log("?? Delaunay triangulation action triggered");
```

**Original (from backup):**
```javascript
console.log("🔺 Delaunay triangulation action triggered");
```

---

### Finding 27: Line 10802

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Debugging triangulation visibility:");
```

**Original (from backup):**
```javascript
console.log("🔍 Debugging triangulation visibility:");
```

---

### Finding 28: Line 10803

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📊

**Current (corrupted):**
```javascript
console.log("?? allKADDrawingsMap size:", allKADDrawingsMap ? allKADDrawingsMap.size : 0);
```

**Original (from backup):**
```javascript
console.log("📊 allKADDrawingsMap size:", allKADDrawingsMap ? allKADDrawingsMap.size : 0);
```

---

### Finding 29: Line 10804

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🌍

**Current (corrupted):**
```javascript
console.log("?? drawingsGroupVisible:", drawingsGroupVisible);
```

**Original (from backup):**
```javascript
console.log("🌍 drawingsGroupVisible:", drawingsGroupVisible);
```

---

### Finding 30: Line 10805

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** �

**Current (corrupted):**
```javascript
console.log("?? pointsGroupVisible:", pointsGroupVisible);
```

**Original (from backup):**
```javascript
console.log("�� pointsGroupVisible:", pointsGroupVisible);
```

---

### Finding 31: Line 10806

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📏

**Current (corrupted):**
```javascript
console.log("?? linesGroupVisible:", linesGroupVisible);
```

**Original (from backup):**
```javascript
console.log("📏 linesGroupVisible:", linesGroupVisible);
```

---

### Finding 32: Line 10807

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔸

**Current (corrupted):**
```javascript
console.log("?? polygonsGroupVisible:", polygonsGroupVisible);
```

**Original (from backup):**
```javascript
console.log("🔸 polygonsGroupVisible:", polygonsGroupVisible);
```

---

### Finding 33: Line 10808

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 💥

**Current (corrupted):**
```javascript
console.log("?? blastGroupVisible:", blastGroupVisible);
```

**Original (from backup):**
```javascript
console.log("💥 blastGroupVisible:", blastGroupVisible);
```

---

### Finding 34: Line 10816

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Checking KAD drawings for visibility:");
```

**Original (from backup):**
```javascript
console.log("🔍 Checking KAD drawings for visibility:");
```

---

### Finding 35: Line 10829

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Checking blast holes for visibility:");
```

**Original (from backup):**
```javascript
console.log("🔍 Checking blast holes for visibility:");
```

---

### Finding 36: Line 10843

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? No visible data found for triangulation");
```

**Original (from backup):**
```javascript
console.log("❌ No visible data found for triangulation");
```

---

### Finding 37: Line 10844

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📋

**Current (corrupted):**
```javascript
console.log("?? Visible entities found:", visibleEntities);
```

**Original (from backup):**
```javascript
console.log("📋 Visible entities found:", visibleEntities);
```

---

### Finding 38: Line 10849

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Found visible data for triangulation:", visibleEntities);
```

**Original (from backup):**
```javascript
console.log("✅ Found visible data for triangulation:", visibleEntities);
```

---

### Finding 39: Line 10893

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Debug - visibleElements:", visibleElements);
```

**Original (from backup):**
```javascript
console.log("🔍 Debug - visibleElements:", visibleElements);
```

---

### Finding 40: Line 10894

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Debug - allKADDrawingsMap size:", allKADDrawingsMap ? allKADDrawingsMap.size : 0);
```

**Original (from backup):**
```javascript
console.log("🔍 Debug - allKADDrawingsMap size:", allKADDrawingsMap ? allKADDrawingsMap.size : 0);
```

---

### Finding 41: Line 10895

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Debug - visibleKADDrawings count:", visibleElements.visibleKADDrawings ? visibleElements.visibleKADDrawings.length : 0);
```

**Original (from backup):**
```javascript
console.log("🔍 Debug - visibleKADDrawings count:", visibleElements.visibleKADDrawings ? visibleElements.visibleKADDrawings.length : 0);
```

---

### Finding 42: Line 10961

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎯

**Current (corrupted):**
```javascript
console.log("?? Unique vertices after deduplication:", elementVertices.length);
```

**Original (from backup):**
```javascript
console.log("🎯 Unique vertices after deduplication:", elementVertices.length);
```

---

### Finding 43: Line 10971

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Creating triangulation with", elementVertices.length, "vertices");
```

**Original (from backup):**
```javascript
console.log("✅ Creating triangulation with", elementVertices.length, "vertices");
```

---

### Finding 44: Line 11051

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎉

**Current (corrupted):**
```javascript
console.log("?? Generated", resultTriangles.length, "triangles");
```

**Original (from backup):**
```javascript
console.log("🎉 Generated", resultTriangles.length, "triangles");
```

---

### Finding 45: Line 11069

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔪

**Current (corrupted):**
```javascript
console.log("?? Clipping triangles from surface:", surfaceId, "option:", option);
```

**Original (from backup):**
```javascript
console.log("🔪 Clipping triangles from surface:", surfaceId, "option:", option);
```

---

### Finding 46: Line 11082

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Found polygon entity:", selectedKADObject.entityName, "with data:", selectedPolygon ? selectedPolygon.data?.length : "none");
```

**Original (from backup):**
```javascript
console.log("🔍 Found polygon entity:", selectedKADObject.entityName, "with data:", selectedPolygon ? selectedPolygon.data?.length : "none");
```

---

### Finding 47: Line 11090

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📐

**Current (corrupted):**
```javascript
console.log("?? Clipping polygon:", selectedPolygon.entityName, "with", selectedPolygon.data.length, "points");
```

**Original (from backup):**
```javascript
console.log("📐 Clipping polygon:", selectedPolygon.entityName, "with", selectedPolygon.data.length, "points");
```

---

### Finding 48: Line 11119

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✂ ️

**Current (corrupted):**
```javascript
console.log("?? Clipping complete:", deletedCount, "triangles deleted,", filteredTriangles.length, "triangles remaining");
```

**Original (from backup):**
```javascript
console.log("✂️ Clipping complete:", deletedCount, "triangles deleted,", filteredTriangles.length, "triangles remaining");
```

---

### Finding 49: Line 11134

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📏

**Current (corrupted):**
```javascript
console.log("?? Filtering triangles by edge length:", surfaceId, "min:", minEdgeLength, "max:", maxEdgeLength, "3D:", use3DLength);
```

**Original (from backup):**
```javascript
console.log("📏 Filtering triangles by edge length:", surfaceId, "min:", minEdgeLength, "max:", maxEdgeLength, "3D:", use3DLength);
```

---

### Finding 50: Line 11138

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ⏭ ️

**Current (corrupted):**
```javascript
console.log("?? Skipping edge length filtering (both min and max = 0)");
```

**Original (from backup):**
```javascript
console.log("⏭️ Skipping edge length filtering (both min and max = 0)");
```

---

### Finding 51: Line 11196

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📏

**Current (corrupted):**
```javascript
console.log("?? Edge length filtering complete:", deletedCount, "triangles deleted,", filteredTriangles.length, "triangles remaining");
```

**Original (from backup):**
```javascript
console.log("📏 Edge length filtering complete:", deletedCount, "triangles deleted,", filteredTriangles.length, "triangles remaining");
```

---

### Finding 52: Line 11212

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📐 °

**Current (corrupted):**
```javascript
console.log("?? Filtering triangles by internal angle:", surfaceId, "min angle:", internalAngleMin + "?", "3D:", use3DAngle);
```

**Original (from backup):**
```javascript
console.log("📐 Filtering triangles by internal angle:", surfaceId, "min angle:", internalAngleMin + "°", "3D:", use3DAngle);
```

---

### Finding 53: Line 11216

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ⏭ ️

**Current (corrupted):**
```javascript
console.log("?? Skipping angle filtering (min angle = 0)");
```

**Original (from backup):**
```javascript
console.log("⏭️ Skipping angle filtering (min angle = 0)");
```

---

### Finding 54: Line 11265

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📐

**Current (corrupted):**
```javascript
console.log("?? Angle filtering complete:", deletedCount, "triangles deleted,", filteredTriangles.length, "triangles remaining");
```

**Original (from backup):**
```javascript
console.log("📐 Angle filtering complete:", deletedCount, "triangles deleted,", filteredTriangles.length, "triangles remaining");
```

---

### Finding 55: Line 11327

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📋

**Current (corrupted):**
```javascript
console.log("?? Found", visibleEntities.length, "visible KAD entities for constraints");
```

**Original (from backup):**
```javascript
console.log("📋 Found", visibleEntities.length, "visible KAD entities for constraints");
```

---

### Finding 56: Line 11422

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔗

**Current (corrupted):**
```javascript
console.log("?? Using FIXED Constrained Delaunay Triangulation (Constrainautor)");
```

**Original (from backup):**
```javascript
console.log("🔗 Using FIXED Constrained Delaunay Triangulation (Constrainautor)");
```

---

### Finding 57: Line 11428

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📊

**Current (corrupted):**
```javascript
console.log("?? Found " + (visibleElements.visibleHoles?.length || 0) + " visible holes, " + (visibleElements.visibleKADDrawings?.length || 0) + " visible KAD drawings");
```

**Original (from backup):**
```javascript
console.log("📊 Found " + (visibleElements.visibleHoles?.length || 0) + " visible holes, " + (visibleElements.visibleKADDrawings?.length || 0) + " visible KAD drawings");
```

---

### Finding 58: Line 11437

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🕳 ️

**Current (corrupted):**
```javascript
console.log("??? Processing " + visibleHoles.length + " blast holes");
```

**Original (from backup):**
```javascript
console.log("🕳️ Processing " + visibleHoles.length + " blast holes");
```

---

### Finding 59: Line 11510

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📐

**Current (corrupted):**
```javascript
console.log('?? Processing entity "' + entityName + '" (' + entity.entityType + ") with " + entity.data.length + " points");
```

**Original (from backup):**
```javascript
console.log('📐 Processing entity "' + entityName + '" (' + entity.entityType + ") with " + entity.data.length + " points");
```

---

### Finding 60: Line 11548

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📊

**Current (corrupted):**
```javascript
console.log("?? Collected " + elementVertices.length + " vertices before deduplication");
```

**Original (from backup):**
```javascript
console.log("📊 Collected " + elementVertices.length + " vertices before deduplication");
```

---

### Finding 61: Line 11554

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔄 →

**Current (corrupted):**
```javascript
console.log("?? Deduplication: " + originalVertexCount + " ? " + elementVertices.length + " vertices");
```

**Original (from backup):**
```javascript
console.log("🔄 Deduplication: " + originalVertexCount + " → " + elementVertices.length + " vertices");
```

---

### Finding 62: Line 11565

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔗

**Current (corrupted):**
```javascript
console.log("?? Extracted " + constraintSegments.length + " constraints from deduplicated vertices");
```

**Original (from backup):**
```javascript
console.log("🔗 Extracted " + constraintSegments.length + " constraints from deduplicated vertices");
```

---

### Finding 63: Line 11607

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔗

**Current (corrupted):**
```javascript
console.log("?? Extracting constraints from deduplicated vertices...");
```

**Original (from backup):**
```javascript
console.log("🔗 Extracting constraints from deduplicated vertices...");
```

---

### Finding 64: Line 11624

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔗

**Current (corrupted):**
```javascript
console.log("?? Processing constraints for " + entity.entityType + ' "' + entityName + '"');
```

**Original (from backup):**
```javascript
console.log("🔗 Processing constraints for " + entity.entityType + ' "' + entityName + '"');
```

---

### Finding 65: Line 11700

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("  ? Added " + entityConstraints.length + " constraints for entity " + entityName);
```

**Original (from backup):**
```javascript
console.log("  ✅ Added " + entityConstraints.length + " constraints for entity " + entityName);
```

---

### Finding 66: Line 11703

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Total constraints extracted: " + constraints.length);
```

**Original (from backup):**
```javascript
console.log("✅ Total constraints extracted: " + constraints.length);
```

---

### Finding 67: Line 11717

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🗺 ️

**Current (corrupted):**
```javascript
console.log("??? Creating spatial index for " + vertices.length + " vertices with tolerance " + tolerance);
```

**Original (from backup):**
```javascript
console.log("🗺️ Creating spatial index for " + vertices.length + " vertices with tolerance " + tolerance);
```

---

### Finding 68: Line 11748

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🗺 ️

**Current (corrupted):**
```javascript
console.log("??? Spatial index created with " + index.size + " grid cells");
```

**Original (from backup):**
```javascript
console.log("🗺️ Spatial index created with " + index.size + " grid cells");
```

---

### Finding 69: Line 11803

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔺

**Current (corrupted):**
```javascript
console.log("?? Starting Constrainautor with " + points.length + " points, " + constraintSegments.length + " constraints");
```

**Original (from backup):**
```javascript
console.log("🔺 Starting Constrainautor with " + points.length + " points, " + constraintSegments.length + " constraints");
```

---

### Finding 70: Line 11816

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔺

**Current (corrupted):**
```javascript
console.log("?? Initial Delaunay: " + delaunay.triangles.length / 3 + " triangles");
```

**Original (from backup):**
```javascript
console.log("🔺 Initial Delaunay: " + delaunay.triangles.length / 3 + " triangles");
```

---

### Finding 71: Line 11837

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔗

**Current (corrupted):**
```javascript
console.log("?? Prepared " + constraintEdges.length + " valid constraint edges");
```

**Original (from backup):**
```javascript
console.log("🔗 Prepared " + constraintEdges.length + " valid constraint edges");
```

---

### Finding 72: Line 11892

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔧

**Current (corrupted):**
```javascript
console.log("?? Applying " + constraintEdges.length + " constraints...");
```

**Original (from backup):**
```javascript
console.log("🔧 Applying " + constraintEdges.length + " constraints...");
```

---

### Finding 73: Line 12115

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎉

**Current (corrupted):**
```javascript
console.log("?? Constrainautor complete: " + resultTriangles.length + " triangles");
```

**Original (from backup):**
```javascript
console.log("🎉 Constrainautor complete: " + resultTriangles.length + " triangles");
```

---

### Finding 74: Line 13315

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🌟

**Current (corrupted):**
```javascript
console.log("?? Creating enhanced radii polygons:");
```

**Original (from backup):**
```javascript
console.log("🌟 Creating enhanced radii polygons:");
```

---

### Finding 75: Line 13317

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("   Rotation: " + (rotationOffset || 0) + "? (" + rotationRadians.toFixed(4) + " rad)");
```

**Original (from backup):**
```javascript
console.log("   Rotation: " + (rotationOffset || 0) + "° (" + rotationRadians.toFixed(4) + " rad)");
```

---

### Finding 76: Line 13356

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("     Point " + i + ": angle=" + ((angle * 180) / Math.PI).toFixed(1) + "?, radius=" + currentRadius.toFixed(2) + "m, coords=(" + x.toFixed(2) + "," + y.toFixed(2) + ")");
```

**Original (from backup):**
```javascript
console.log("     Point " + i + ": angle=" + ((angle * 180) / Math.PI).toFixed(1) + "°, radius=" + currentRadius.toFixed(2) + "m, coords=(" + x.toFixed(2) + "," + y.toFixed(2) + ")");
```

---

### Finding 77: Line 13393

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Created enhanced polygon: " + entityName + " with " + polygon.length + " points");
```

**Original (from backup):**
```javascript
console.log("✅ Created enhanced polygon: " + entityName + " with " + polygon.length + " points");
```

---

### Finding 78: Line 13400

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔗

**Current (corrupted):**
```javascript
console.log("?? Performing union operation on " + rawPolygons.length + " polygons...");
```

**Original (from backup):**
```javascript
console.log("🔗 Performing union operation on " + rawPolygons.length + " polygons...");
```

---

### Finding 79: Line 13423

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Union successful, created " + solution.length + " combined polygon(s)");
```

**Original (from backup):**
```javascript
console.log("✅ Union successful, created " + solution.length + " combined polygon(s)");
```

---

### Finding 80: Line 13485

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Created enhanced union polygon: " + entityName + " with " + polygon.length + " points");
```

**Original (from backup):**
```javascript
console.log("✅ Created enhanced union polygon: " + entityName + " with " + polygon.length + " points");
```

---

### Finding 81: Line 13786

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔧

**Current (corrupted):**
```javascript
console.log("?? Offset calculation:");
```

**Original (from backup):**
```javascript
console.log("🔧 Offset calculation:");
```

---

### Finding 82: Line 13788

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("  projectionAngle:", projectionAngle, "?");
```

**Original (from backup):**
```javascript
console.log("  projectionAngle:", projectionAngle, "°");
```

---

### Finding 83: Line 13918

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Created crossover-handled line offset:", newEntityName, "with", newEntityData.length, "points");
```

**Original (from backup):**
```javascript
console.log("✅ Created crossover-handled line offset:", newEntityName, "with", newEntityData.length, "points");
```

---

### Finding 84: Line 14285

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔥

**Current (corrupted):**
```javascript
console.log("?? Calling getRadiiPolygons with " + pointsForRadii.length + " points:");
```

**Original (from backup):**
```javascript
console.log("🔥 Calling getRadiiPolygons with " + pointsForRadii.length + " points:");
```

---

### Finding 85: Line 14286

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("   Rotation: " + params.rotationOffset + "?, Starburst: " + params.starburstOffset * 100 + "%");
```

**Original (from backup):**
```javascript
console.log("   Rotation: " + params.rotationOffset + "°, Starburst: " + params.starburstOffset * 100 + "%");
```

---

### Finding 86: Line 14305

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? getRadiiPolygonsEnhanced returned " + polygons.length + " polygon(s)");
```

**Original (from backup):**
```javascript
console.log("✅ getRadiiPolygonsEnhanced returned " + polygons.length + " polygon(s)");
```

---

### Finding 87: Line 14448

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Processing selectedKADObject:", selectedKADObject);
```

**Original (from backup):**
```javascript
console.log("🔍 Processing selectedKADObject:", selectedKADObject);
```

---

### Finding 88: Line 14452

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📊

**Current (corrupted):**
```javascript
console.log("?? KAD object has data array with " + selectedKADObject.data.length + " items");
```

**Original (from backup):**
```javascript
console.log("📊 KAD object has data array with " + selectedKADObject.data.length + " items");
```

---

### Finding 89: Line 14457

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔵

**Current (corrupted):**
```javascript
console.log("?? Processing point " + (index + 1) + ":", point);
```

**Original (from backup):**
```javascript
console.log("🔵 Processing point " + (index + 1) + ":", point);
```

---

### Finding 90: Line 14472

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📍

**Current (corrupted):**
```javascript
console.log("?? Processing vertex " + (index + 1) + ":", point);
```

**Original (from backup):**
```javascript
console.log("📍 Processing vertex " + (index + 1) + ":", point);
```

---

### Finding 91: Line 14487

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📝

**Current (corrupted):**
```javascript
console.log("?? Processing text " + (index + 1) + ":", textPoint);
```

**Original (from backup):**
```javascript
console.log("📝 Processing text " + (index + 1) + ":", textPoint);
```

---

### Finding 92: Line 14502

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ⭕

**Current (corrupted):**
```javascript
console.log("? Processing circle " + (index + 1) + ":", circlePoint);
```

**Original (from backup):**
```javascript
console.log("⭕ Processing circle " + (index + 1) + ":", circlePoint);
```

---

### Finding 93: Line 14524

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Found entity in allKADDrawingsMap with " + entity.data.length + " points");
```

**Original (from backup):**
```javascript
console.log("✅ Found entity in allKADDrawingsMap with " + entity.data.length + " points");
```

---

### Finding 94: Line 14527

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔄

**Current (corrupted):**
```javascript
console.log("?? Processing entity point " + (index + 1) + ":", point);
```

**Original (from backup):**
```javascript
console.log("🔄 Processing entity point " + (index + 1) + ":", point);
```

---

### Finding 95: Line 14544

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🆘

**Current (corrupted):**
```javascript
console.log("?? Using fallback direct coordinates");
```

**Original (from backup):**
```javascript
console.log("🆘 Using fallback direct coordinates");
```

---

### Finding 96: Line 14559

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎯

**Current (corrupted):**
```javascript
console.log("?? Final selectedEntities array has " + selectedEntities.length + " entities:");
```

**Original (from backup):**
```javascript
console.log("🎯 Final selectedEntities array has " + selectedEntities.length + " entities:");
```

---

### Finding 97: Line 16401

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? Cannot delete point from hidden entity: " + entityName);
```

**Original (from backup):**
```javascript
console.log("❌ Cannot delete point from hidden entity: " + entityName);
```

---

### Finding 98: Line 16436

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? Cannot delete object from hidden entity: " + entityName);
```

**Original (from backup):**
```javascript
console.log("❌ Cannot delete object from hidden entity: " + entityName);
```

---

### Finding 99: Line 16459

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? No visible entities of type " + entityType + " to delete");
```

**Original (from backup):**
```javascript
console.log("❌ No visible entities of type " + entityType + " to delete");
```

---

### Finding 100: Line 16468

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🗑 ️

**Current (corrupted):**
```javascript
console.log("??? Deleted " + visibleEntitiesToDelete.length + " visible " + entityType + " entities");
```

**Original (from backup):**
```javascript
console.log("🗑️ Deleted " + visibleEntitiesToDelete.length + " visible " + entityType + " entities");
```

---

### Finding 101: Line 16549

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Renumbered " + entity.data.length + " points in " + entity.entityType + " entity");
```

**Original (from backup):**
```javascript
console.log("✅ Renumbered " + entity.data.length + " points in " + entity.entityType + " entity");
```

---

### Finding 102: Line 16707

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🚨

**Current (corrupted):**
```javascript
console.log("?? deleteSelectedAllPatterns called!");
```

**Original (from backup):**
```javascript
console.log("🚨 deleteSelectedAllPatterns called!");
```

---

### Finding 103: Line 16912

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("Detected row orientation: " + rowOrientation + "? for entity: " + entityName);
```

**Original (from backup):**
```javascript
console.log("Detected row orientation: " + rowOrientation + "° for entity: " + entityName);
```

---

### Finding 104: Line 17000

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("Renumbered " + entityHoles.length + " holes in " + rows.length + " rows for entity: " + entityName + " with detected row orientation: " + rowOrientation + "?");
```

**Original (from backup):**
```javascript
console.log("Renumbered " + entityHoles.length + " holes in " + rows.length + " rows for entity: " + entityName + " with detected row orientation: " + rowOrientation + "°");
```

---

### Finding 105: Line 17260

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🗑 ️

**Current (corrupted):**
```javascript
console.log("??? Removed point from " + currentDrawingEntityName + ". Points remaining: " + remainingPoints);
```

**Original (from backup):**
```javascript
console.log("🗑️ Removed point from " + currentDrawingEntityName + ". Points remaining: " + remainingPoints);
```

---

### Finding 106: Line 17277

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? Set current drawing entity: " + entityName);
```

**Original (from backup):**
```javascript
console.log("🎨 Set current drawing entity: " + entityName);
```

---

### Finding 107: Line 17283

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🧹

**Current (corrupted):**
```javascript
console.log("?? Cleared current drawing entity");
```

**Original (from backup):**
```javascript
console.log("🧹 Cleared current drawing entity");
```

---

### Finding 108: Line 22361

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📷

**Current (corrupted):**
```javascript
console.log("?? Camera reset to top-down view");
```

**Original (from backup):**
```javascript
console.log("📷 Camera reset to top-down view");
```

---

### Finding 109: Line 22630

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? //-- LOADED UNIFIED DRAWING OBJECTS FROM IndexedDB --//");
```

**Original (from backup):**
```javascript
console.log("✅ //-- LOADED UNIFIED DRAWING OBJECTS FROM IndexedDB --//");
```

---

### Finding 110: Line 22843

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Surface saved successfully to database:", surfaceId);
```

**Original (from backup):**
```javascript
console.log("✅ Surface saved successfully to database:", surfaceId);
```

---

### Finding 111: Line 22861

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Surface record stored successfully");
```

**Original (from backup):**
```javascript
console.log("✅ Surface record stored successfully");
```

---

### Finding 112: Line 22897

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Surface " + surfaceData.name + " loaded into memory");
```

**Original (from backup):**
```javascript
console.log("✅ Surface " + surfaceData.name + " loaded into memory");
```

---

### Finding 113: Line 22986

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 0.72

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("?? User cancelled data loading");
```

**Original (from backup):**
```javascript
console.log("✅ User cancelled duplicate resolution");
```

*Note: Match score is 0.72 - please verify this is the correct match*

---

### Finding 114: Line 23076

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📊

**Current (corrupted):**
```javascript
console.log("?? Loaded " + loadedSurfaces.size + " surfaces into memory");
```

**Original (from backup):**
```javascript
console.log("📊 Loaded " + loadedSurfaces.size + " surfaces into memory");
```

---

### Finding 115: Line 23207

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Surface " + surface.name + " visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Surface " + surface.name + " visibility: " + visible);
```

---

### Finding 116: Line 23313

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? KAD Entity " + entityName + " visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ KAD Entity " + entityName + " visibility: " + visible);
```

---

### Finding 117: Line 23331

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? KAD Element " + entityName + ":" + pointID + " visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ KAD Element " + entityName + ":" + pointID + " visibility: " + visible);
```

---

### Finding 118: Line 23354

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Hole " + holeID + " visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Hole " + holeID + " visibility: " + visible);
```

---

### Finding 119: Line 23367

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Entity " + entityName + " visibility: " + visible + " (affecting " + entityHoles.length + " holes)");
```

**Original (from backup):**
```javascript
console.log("👁️ Entity " + entityName + " visibility: " + visible + " (affecting " + entityHoles.length + " holes)");
```

---

### Finding 120: Line 23385

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Blast Group visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Blast Group visibility: " + visible);
```

---

### Finding 121: Line 23393

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Drawings Group visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Drawings Group visibility: " + visible);
```

---

### Finding 122: Line 23401

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Surfaces Group visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Surfaces Group visibility: " + visible);
```

---

### Finding 123: Line 23409

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Images Group visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Images Group visibility: " + visible);
```

---

### Finding 124: Line 23417

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Points Group visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Points Group visibility: " + visible);
```

---

### Finding 125: Line 23425

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Lines Group visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Lines Group visibility: " + visible);
```

---

### Finding 126: Line 23433

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Polygons Group visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Polygons Group visibility: " + visible);
```

---

### Finding 127: Line 23441

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Circles Group visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Circles Group visibility: " + visible);
```

---

### Finding 128: Line 23449

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Texts Group visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Texts Group visibility: " + visible);
```

---

### Finding 129: Line 23459

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? Cannot delete surface - database not available");
```

**Original (from backup):**
```javascript
console.log("❌ Cannot delete surface - database not available");
```

---

### Finding 130: Line 23469

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Surface " + surfaceId + " deleted from IndexedDB");
```

**Original (from backup):**
```javascript
console.log("✅ Surface " + surfaceId + " deleted from IndexedDB");
```

---

### Finding 131: Line 23494

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? Cannot delete surfaces - database not available");
```

**Original (from backup):**
```javascript
console.log("❌ Cannot delete surfaces - database not available");
```

---

### Finding 132: Line 23504

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? All surfaces deleted from IndexedDB");
```

**Original (from backup):**
```javascript
console.log("✅ All surfaces deleted from IndexedDB");
```

---

### Finding 133: Line 23602

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Image " + imageData.name + " loaded into memory");
```

**Original (from backup):**
```javascript
console.log("✅ Image " + imageData.name + " loaded into memory");
```

---

### Finding 134: Line 23662

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🖼 ️

**Current (corrupted):**
```javascript
console.log("??? Loaded " + loadedImages.size + " images into memory");
```

**Original (from backup):**
```javascript
console.log("🖼️ Loaded " + loadedImages.size + " images into memory");
```

---

### Finding 135: Line 23680

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 👁 ️

**Current (corrupted):**
```javascript
console.log("??? Image " + image.name + " visibility: " + visible);
```

**Original (from backup):**
```javascript
console.log("👁️ Image " + image.name + " visibility: " + visible);
```

---

### Finding 136: Line 23698

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? Cannot delete image - database not available");
```

**Original (from backup):**
```javascript
console.log("❌ Cannot delete image - database not available");
```

---

### Finding 137: Line 23709

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log(`? Image "${imageId}" deleted from IndexedDB`);
```

**Original (from backup):**
```javascript
console.log(`✅ Image "${imageId}" deleted from IndexedDB`);
```

---

### Finding 138: Line 23740

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? All images deleted from IndexedDB");
```

**Original (from backup):**
```javascript
console.log("✅ All images deleted from IndexedDB");
```

---

### Finding 139: Line 23771

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Surfaces in database:", surfaceRequest.result.length);
```

**Original (from backup):**
```javascript
console.log("🔍 Surfaces in database:", surfaceRequest.result.length);
```

---

### Finding 140: Line 23783

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔍

**Current (corrupted):**
```javascript
console.log("?? Images in database:", imageRequest.result.length);
```

**Original (from backup):**
```javascript
console.log("🔍 Images in database:", imageRequest.result.length);
```

---

### Finding 141: Line 24496

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Database initialized successfully");
```

**Original (from backup):**
```javascript
console.log("✅ Database initialized successfully");
```

---

### Finding 142: Line 24519

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? Colors updated for dark mode:", darkModeEnabled);
```

**Original (from backup):**
```javascript
console.log("🎨 Colors updated for dark mode:", darkModeEnabled);
```

---

### Finding 143: Line 24591

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? All database data cleared");
```

**Original (from backup):**
```javascript
console.log("✅ All database data cleared");
```

---

### Finding 144: Line 26369

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🗑 ️

**Current (corrupted):**
```javascript
console.log("??? Removed existing context menu");
```

**Original (from backup):**
```javascript
console.log("🗑️ Removed existing context menu");
```

---

### Finding 145: Line 29231

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** →

**Current (corrupted):**
```javascript
console.log("Row " + rowLetter + " ? rowID " + rowID + " with " + row.length + " holes");
```

**Original (from backup):**
```javascript
console.log("Row " + rowLetter + " → rowID " + rowID + " with " + row.length + " holes");
```

---

### Finding 146: Line 29565

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ×

**Current (corrupted):**
```javascript
console.log("Running HDBSCAN with pre-calculated " + n + "?" + n + " distance matrix");
```

**Original (from backup):**
```javascript
console.log("Running HDBSCAN with pre-calculated " + n + "×" + n + " distance matrix");
```

---

### Finding 147: Line 31627

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("Line bearing (Start to End):", orientation.toFixed(2) + "?");
```

**Original (from backup):**
```javascript
console.log("Line bearing (Start to End):", orientation.toFixed(2) + "°");
```

---

### Finding 148: Line 31667

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("Row bearing:", rowBearing.toFixed(2) + "?");
```

**Original (from backup):**
```javascript
console.log("Row bearing:", rowBearing.toFixed(2) + "°");
```

---

### Finding 149: Line 31668

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("Column bearing:", columnBearing.toFixed(2) + "?");
```

**Original (from backup):**
```javascript
console.log("Column bearing:", columnBearing.toFixed(2) + "°");
```

---

### Finding 150: Line 32117

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("Line bearing:", lineBearing.toFixed(2) + "?");
```

**Original (from backup):**
```javascript
console.log("Line bearing:", lineBearing.toFixed(2) + "°");
```

---

### Finding 151: Line 32126

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("Using hole bearing:", holeBearing.toFixed(2) + "?");
```

**Original (from backup):**
```javascript
console.log("Using hole bearing:", holeBearing.toFixed(2) + "°");
```

---

### Finding 152: Line 33732

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 0.94

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("?? OBJ surface saved to database: " + surfaceId);
```

**Original (from backup):**
```javascript
console.log("✅ DXF surface saved to database: " + surfaceId);
```

---

### Finding 153: Line 33758

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Surface saved from processSurfacePoints:", fileName);
```

**Original (from backup):**
```javascript
console.log("✅ Surface saved from processSurfacePoints:", fileName);
```

---

### Finding 154: Line 34250

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Full surface saved from decimation dialog:", fileName);
```

**Original (from backup):**
```javascript
console.log("✅ Full surface saved from decimation dialog:", fileName);
```

---

### Finding 155: Line 34261

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Decimated surface saved from decimation dialog:", fileName);
```

**Original (from backup):**
```javascript
console.log("✅ Decimated surface saved from decimation dialog:", fileName);
```

---

### Finding 156: Line 34289

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? drawSurface called");
```

**Original (from backup):**
```javascript
console.log("🎨 drawSurface called");
```

---

### Finding 157: Line 34290

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? surfacesGroupVisible:", surfacesGroupVisible);
```

**Original (from backup):**
```javascript
console.log("🎨 surfacesGroupVisible:", surfacesGroupVisible);
```

---

### Finding 158: Line 34291

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? loadedSurfaces.size:", loadedSurfaces.size);
```

**Original (from backup):**
```javascript
console.log("🎨 loadedSurfaces.size:", loadedSurfaces.size);
```

---

### Finding 159: Line 34297

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? Processing surface:", surfaceId, surface);
```

**Original (from backup):**
```javascript
console.log("🎨 Processing surface:", surfaceId, surface);
```

---

### Finding 160: Line 34298

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? Surface visible:", surface.visible);
```

**Original (from backup):**
```javascript
console.log("🎨 Surface visible:", surface.visible);
```

---

### Finding 161: Line 34329

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 0.80

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? drawSurface textured mesh: " + surfaceId + ", gradient: " + gradient + ", hasTexture: " + hasTexture + ", should3DRender: " + should3DRender + ", onlyShowThreeJS: " + onlyShowThreeJS);
```

**Original (from backup):**
```javascript
console.log("🎨 drawSurface called");
```

*Note: Match score is 0.80 - please verify this is the correct match*

---

### Finding 162: Line 34376

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? First triangle structure:", triangle);
```

**Original (from backup):**
```javascript
console.log("🎨 First triangle structure:", triangle);
```

---

### Finding 163: Line 34377

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? First triangle vertices:", triangle.vertices);
```

**Original (from backup):**
```javascript
console.log("🎨 First triangle vertices:", triangle.vertices);
```

---

### Finding 164: Line 35172

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("- Light Bearing: " + lightBearing + "?");
```

**Original (from backup):**
```javascript
console.log("- Light Bearing: " + lightBearing + "°");
```

---

### Finding 165: Line 35173

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** °

**Current (corrupted):**
```javascript
console.log("- Light Elevation: " + lightElevation + "?");
```

**Original (from backup):**
```javascript
console.log("- Light Elevation: " + lightElevation + "°");
```

---

### Finding 166: Line 37426

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Image saved to database:", surfaceName);
```

**Original (from backup):**
```javascript
console.log("✅ Image saved to database:", surfaceName);
```

---

### Finding 167: Line 37770

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** →

**Current (corrupted):**
```javascript
console.log(`Loaded EPSG:${epsgCode} ?`, proj4def.trim());
```

**Original (from backup):**
```javascript
console.log(`Loaded EPSG:${epsgCode} →`, proj4def.trim());
```

---

### Finding 168: Line 38388

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 📊

**Current (corrupted):**
```javascript
console.log("?? Entity found:", entity);
```

**Original (from backup):**
```javascript
console.log("📊 Entity found:", entity);
```

---

### Finding 169: Line 38391

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? Entity not found:", entityName);
```

**Original (from backup):**
```javascript
console.log("❌ Entity not found:", entityName);
```

---

### Finding 170: Line 38406

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎯

**Current (corrupted):**
```javascript
console.log("?? Element found:", element);
```

**Original (from backup):**
```javascript
console.log("🎯 Element found:", element);
```

---

### Finding 171: Line 38409

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? Element not found with pointID:", pointID);
```

**Original (from backup):**
```javascript
console.log("❌ Element not found with pointID:", pointID);
```

---

### Finding 172: Line 38412

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔄

**Current (corrupted):**
```javascript
console.log("?? Trying as string:", element);
```

**Original (from backup):**
```javascript
console.log("🔄 Trying as string:", element);
```

---

### Finding 173: Line 38416

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🔄

**Current (corrupted):**
```javascript
console.log("?? Trying both as strings:", element);
```

**Original (from backup):**
```javascript
console.log("🔄 Trying both as strings:", element);
```

---

### Finding 174: Line 38419

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? Element still not found after all attempts");
```

**Original (from backup):**
```javascript
console.log("❌ Element still not found after all attempts");
```

---

### Finding 175: Line 38465

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Updated " + entityName + " point " + pointID + " color to:", newColor);
```

**Original (from backup):**
```javascript
console.log("✅ Updated " + entityName + " point " + pointID + " color to:", newColor);
```

---

### Finding 176: Line 39287

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ❌

**Current (corrupted):**
```javascript
console.log("? No visible holes to edit");
```

**Original (from backup):**
```javascript
console.log("❌ No visible holes to edit");
```

---

### Finding 177: Line 39292

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ⚠ ️

**Current (corrupted):**
```javascript
console.log("?? Some holes are hidden and will not be edited");
```

**Original (from backup):**
```javascript
console.log("⚠️ Some holes are hidden and will not be edited");
```

---

### Finding 178: Line 40098

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🎨

**Current (corrupted):**
```javascript
console.log("?? Overlay hooked into theme system");
```

**Original (from backup):**
```javascript
console.log("🎨 Overlay hooked into theme system");
```

---

### Finding 179: Line 40517

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Contour calculations now run in main thread (synchronous)");
```

**Original (from backup):**
```javascript
console.log("✅ Contour calculations now run in main thread (synchronous)");
```

---

### Finding 180: Line 40524

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🚀

**Current (corrupted):**
```javascript
console.log("?? Starting application initialization...");
```

**Original (from backup):**
```javascript
console.log("🚀 Starting application initialization...");
```

---

### Finding 181: Line 40549

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** 🌳

**Current (corrupted):**
```javascript
console.log("?? Creating TreeView for first time...");
```

**Original (from backup):**
```javascript
console.log("🌳 Creating TreeView for first time...");
```

---

### Finding 182: Line 40599

**Status:** [ ] CONFIRMED / [ ] REJECTED

**Match Score:** 1.00

**Unicode symbols found:** ✅

**Current (corrupted):**
```javascript
console.log("? Application initialization complete");
```

**Original (from backup):**
```javascript
console.log("✅ Application initialization complete");
```

---

