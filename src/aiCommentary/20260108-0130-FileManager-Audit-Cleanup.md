# FileManager System Audit & Cleanup

**Date:** 2026-01-08 01:30
**Status:** AUDIT COMPLETE - VIOLATIONS FOUND
**Priority:** HIGH - Multiple Rule #9 Violations

---

## Executive Summary

Found **3 CRITICAL Rule #9 violations** in existing import handlers:
1. ❌ **CSV Import** (parseK2Dcsv) - line 10356
2. ❌ **Surpac STR Import** - line 7717
3. ❌ **Custom CSV Import** - line 31789

Also found:
- ✅ Wenco NAV buttons NOT wired up (needs implementation)
- ⚠️ Surface Manager button name confusing (handles both IREDES and Surface Manager)
- ✅ Most FileManager parsers/writers properly registered and wired

---

## CRITICAL: Rule #9 Violations Found

### 1. CSV Import - parseK2Dcsv() (Line 10356)

**Location:** `src/kirra.js:10343-10396`

**Current Code (WRONG):**
```javascript
function parseK2Dcsv(data) {
    try {
        var parser = new BlastHoleCSVParser();
        var result = parser.parseCSVData(data);

        // ❌ RULE #9 VIOLATION!
        if (!allBlastHoles || !Array.isArray(allBlastHoles)) allBlastHoles = [];
        allBlastHoles.push(...result.holes);

        var duplicateCheck = checkAndResolveDuplicateHoleIDs(allBlastHoles, "CSV import");

        calculateBurdenAndSpacingForHoles(holesNeedingCalculation);
        holeTimes = calculateTimes(allBlastHoles);
        drawData(allBlastHoles, selectedHole);

        return allBlastHoles;
    } catch (error) {
        console.error("Error during CSV parsing:", error);
        alert("Error importing CSV file: " + error.message);
        throw error;
    }
}
```

**Problem:**
- Directly pushes holes to `allBlastHoles` array
- Bypasses `addHole()` geometry calculations
- **benchHeight = 0** for all imported holes!
- **No grade marker calculations**

**Impact:**
- Every CSV import produces holes with wrong geometry
- benchHeight always 0
- Grade markers missing or incorrect
- Hole adjustment broken

**Fix Required:**
- Refactor CSV parser to return minimal hole data
- Call `addHole()` for each parsed hole
- Same pattern as IREDES/CBLAST imports

---

### 2. Surpac STR Import (Line 7717)

**Location:** `src/kirra.js:7710-7720`

**Current Code (WRONG):**
```javascript
parser.parse(content)
    .then(function (data) {
        if (!isDTM && data.blastHoles && data.blastHoles.length > 0) {
            // ❌ RULE #9 VIOLATION!
            if (!allBlastHoles) allBlastHoles = [];
            var importedHoles = data.blastHoles;
            allBlastHoles.push(...importedHoles);

            console.log("Imported " + importedHoles.length + " blast holes from STR");
        }
        // ... KAD entities handling ...
    })
```

**Problem:**
- Same issue as CSV import
- Directly pushes Surpac blast holes to array
- Bypasses `addHole()` calculations

**Impact:**
- Surpac STR blast hole imports have wrong geometry
- benchHeight = 0
- No grade markers

**Fix Required:**
- Refactor SurpacSTRParser to return minimal hole data
- Call `addHole()` for each parsed hole
- Post-import pipeline (HDBSCAN, burden/spacing, etc.)

---

### 3. Custom CSV Import (Line 31789)

**Location:** `src/kirra.js:31789` (function name TBD)

**Current Code (WRONG):**
```javascript
// Add to tracking arrays
if (isUpdate) {
    updatedHoles.push(hole);
} else {
    allBlastHoles.push(hole); // ❌ RULE #9 VIOLATION!
    addedHoles.push(hole);
}
```

**Problem:**
- Custom CSV import also bypasses `addHole()`
- Directly creates hole objects and pushes to array

**Fix Required:**
- Use `addHole()` instead of direct push

---

## Button Wiring Status

### ✅ Properly Wired Formats

| Format | Import Button | Export Button | Parser | Writer | Notes |
|--------|---------------|---------------|--------|--------|-------|
| **IREDES XML** | `.surfaceManager-input-btn` | `.surfaceManager-output-btn` | ✅ iredes-xml | ✅ iredes-xml | Uses addHole() ✅ |
| **Surface Manager** | `.surfaceManager-input-btn` | `.surfaceManager-output-btn` | ✅ surface-manager | ✅ surface-manager | Geofence/hazard/sockets |
| **CBLAST** | `.cblast-input-btn` | `.cblast-output-btn` | ✅ cblast-csv | ✅ cblast-csv | Uses addHole() ✅ |
| **KAD** | `.kad-input-btn` | `.kad-output-btn` | ✅ kad | ✅ kad | Line 7218 |
| **DXF** | `.dxf-input-btn` | `.dxf-output-btn` | ✅ dxf | ✅ dxf-holes, dxf-vulcan, dxf-3dface | Line 7246 |
| **OBJ** | `.obj-input-btn` | (separate buttons) | ✅ obj | ✅ obj | Line 8061 |
| **CSV** | (default file input) | (multiple buttons) | ✅ blasthole-csv | ✅ blasthole-csv-* | ❌ Violates Rule #9! |
| **Custom CSV** | `#fileInputCustomCSV` | (button) | ✅ custom-csv | ✅ custom-csv | ❌ Violates Rule #9! |
| **Surpac STR** | (button) | (button) | ✅ surpac-str | ✅ surpac-str | ❌ Violates Rule #9! |
| **Surpac DTM** | (button) | (button) | ✅ surpac-dtm | ✅ surpac-dtm | Points only (no holes) |
| **Point Cloud** | (button) | (button) | ✅ pointcloud-csv | ✅ pointcloud-xyz | Points only (no holes) |

### ❌ NOT Wired - "Coming Soon"

| Format | Button Class | Parser | Writer | Notes |
|--------|--------------|--------|--------|-------|
| **Wenco NAV** | `.wenco-input-btn`, `.wenco-output-btn` | ✅ wenco-nav | ✅ wenco-nav | Line 8697-8702: "Coming Soon" |
| **LAS Point Cloud** | `.las-input-btn`, `.las-output-btn` | ❌ Not implemented | ❌ Not implemented | Line 8824 |

### ⚠️ Confusing Button Naming

**`.surfaceManager-input-btn`** handles TWO different formats:
1. **IREDES XML** (`format === "iredes"`) - Blast holes
2. **Surface Manager** (`format === "geofence"/"hazard"/"socket"`) - Polylines

**Recommendation:** Consider renaming or splitting into separate buttons for clarity.

---

## FileManager Registration Status

All parsers/writers from `src/fileIO/init.js` are properly registered:

### Parsers (12 registered)
✅ blasthole-csv
✅ custom-csv
✅ surface-manager (geofence/hazard/sockets)
✅ kad
✅ dxf
✅ obj
✅ ply
✅ pointcloud-csv
✅ surpac-str
✅ surpac-dtm
✅ surpac-surface (DTM + STR pair)
✅ iredes-xml
✅ cblast-csv
✅ wenco-nav

### Writers (15 registered)
✅ blasthole-csv-12
✅ blasthole-csv-14
✅ blasthole-csv-35
✅ blasthole-csv-actual
✅ blasthole-csv-allcolumns
✅ custom-csv
✅ surface-manager
✅ kad
✅ dxf-holes
✅ dxf-vulcan
✅ dxf-3dface
✅ obj
✅ pointcloud-xyz
✅ aqm-csv (MineStar)
✅ surpac-str
✅ surpac-dtm
✅ iredes-xml
✅ cblast-csv
✅ wenco-nav

---

## Code That Can Be Removed

### ✅ Already Removed

**Line 10398-10400:**
```javascript
// REMOVED OLD IMPLEMENTATION (317 lines) - Now using FileManager BlastHoleCSVParser
// Old code handled: 4, 7, 9, 12, 14, 20, 25, 30, 32, 35 column formats
// All parsing logic moved to src/fileIO/TextIO/BlastHoleCSVParser.js
```

Good! Old CSV parsing code already removed.

### ⚠️ Wrapper Functions (Keep for Now)

These wrapper functions call FileManager parsers - **KEEP** them as they're used by legacy button handlers:

- `parseK2Dcsv()` - Line 10343 (but needs Rule #9 fix!)
- `parseKADFile()` - Line 11783
- `parseDXFtoKadMaps()` - Line 10452
- `parseOBJFile()` - Line 38386
- `parseCSVPointCloud()` - Line 38641

**Note:** These are transition layers - eventually buttons should call FileManager directly, but for now they provide backwards compatibility.

---

## Recommended Actions

### CRITICAL (Fix Immediately)

1. **Fix parseK2Dcsv()** (Line 10343-10396)
   - Refactor BlastHoleCSVParser to return minimal hole data
   - Call `addHole()` for each parsed hole in parseK2Dcsv()
   - Add post-import pipeline (HDBSCAN, burden/spacing, etc.)

2. **Fix Surpac STR Import** (Line 7710-7720)
   - Refactor SurpacSTRParser to return minimal hole data for blast holes
   - Call `addHole()` for each parsed hole
   - Add post-import pipeline

3. **Fix Custom CSV Import** (Line 31789)
   - Replace direct array push with `addHole()` call
   - Ensure proper geometry calculations

### HIGH PRIORITY

4. **Wire Up Wenco NAV Buttons** (Line 8697-8702)
   - Parser and writer exist and are registered
   - Just need button handler implementation
   - Check if NAV files contain holes or just CAD entities

### MEDIUM PRIORITY

5. **Consider Refactoring Button Names**
   - `.surfaceManager-input-btn` is confusing (handles IREDES + Surface Manager)
   - Consider separate buttons or clearer dropdown labels

6. **Add Export Handlers for Formats Missing Them**
   - Check which formats have parsers but no export buttons
   - Implement export handlers where needed

---

## Testing Checklist

After fixes are complete:

### Test CSV Import (parseK2Dcsv)
- [ ] Import 12-column CSV
- [ ] Import 14-column CSV
- [ ] Import 35-column CSV
- [ ] Verify benchHeight > 0 for all holes
- [ ] Verify grade markers appear
- [ ] Verify hole adjustment works
- [ ] Verify burden/spacing calculated

### Test Surpac STR Import
- [ ] Import STR file with blast holes
- [ ] Verify benchHeight > 0
- [ ] Verify grade markers appear
- [ ] Verify hole adjustment works

### Test Custom CSV Import
- [ ] Import custom CSV with field mapping
- [ ] Verify benchHeight > 0
- [ ] Verify grade markers appear

### Test Wenco NAV (After Wiring)
- [ ] Import NAV file
- [ ] Verify entities imported correctly
- [ ] Export NAV file
- [ ] Verify round-trip integrity

---

## Summary of Violations

**Rule #9 Violations Found:** 3
1. CSV Import (parseK2Dcsv) - Line 10356
2. Surpac STR Import - Line 7717
3. Custom CSV Import - Line 31789

**Missing Button Wiring:** 1
1. Wenco NAV ASCII - Line 8697-8702

**All violations MUST be fixed before Phase 6 can be considered complete.**

---

**Audit Completed:** 2026-01-08 01:30
**Status:** VIOLATIONS FOUND - FIXES REQUIRED
**Next Action:** Fix CSV import Rule #9 violation

---
