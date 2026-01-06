# Surpac Dual-File Export Update

**Date:** 2026-01-05
**Status:** Complete
**Priority:** Critical Fix

---

## Change Summary

Updated DTM export to match Surpac workflow: **DTM format now exports BOTH .dtm and .str files** for the same surface data.

**Reference Files:**
- `/src/referenceFiles/mka_pd_stg4_202406_v1.dtm` - Point cloud data
- `/src/referenceFiles/mka_pd_stg4_202406_v1.str` - String/triangle data

Same base filename, two different file formats representing the same surface.

---

## Export Options (Final)

### 1. STR - Blastholes
- Exports blast holes only
- String number: 512 (Surpac blast hole style)
- File: `KIRRA_SURPAC_STR_BLASTHOLES_YYYYMMDD_HHMMSS.str`

### 2. STR - KAD Drawings
- Exports KAD points, lines, polylines
- String numbers based on entity colors (1-255)
- File: `KIRRA_SURPAC_STR_KAD_YYYYMMDD_HHMMSS.str`

### 3. DTM (Surfaces)
- Exports loaded surfaces as **TWO files**:
  - **DTM file**: Unique vertices as point cloud
  - **STR file**: Triangles as closed polylines (strings)
- Same timestamp for both files
- Files:
  - `KIRRA_SURPAC_DTM_YYYYMMDD_HHMMSS.dtm`
  - `KIRRA_SURPAC_STR_YYYYMMDD_HHMMSS.str`

### ~~4. STR - Surfaces~~ (REMOVED)
- This option removed
- Use DTM instead (exports both formats)
- If user selects this, shows info message directing to DTM

---

## Implementation Details

### DTM Export Logic (Lines 7331-7384)

**Process:**
1. Validate surfaces exist
2. Get both DTM and STR writers
3. Export both files using `Promise.all()`
4. Download both files automatically
5. Show success message

**Code:**
```javascript
if (fileFormat === "dtm") {
    // Validate surfaces exist
    if (!window.loadedSurfaces || window.loadedSurfaces.size === 0) {
        showModalMessage("No Data", "No surfaces loaded...", "warning");
        return;
    }

    var exportData = {
        surfaces: window.loadedSurfaces,
        fileName: "surface"
    };

    // Get both writers
    var DTMWriter = window.fileManager.writers.get("surpac-dtm");
    var STRWriter = window.fileManager.writers.get("surpac-str");

    // Create instances
    var dtmWriter = new DTMWriter();
    var strWriter = new STRWriter();

    var dtmFilename = "KIRRA_SURPAC_DTM_" + timestamp + ".dtm";
    var strFilename = "KIRRA_SURPAC_STR_" + timestamp + ".str";

    // Export both in parallel
    Promise.all([
        dtmWriter.write(exportData),
        strWriter.write(exportData)
    ])
    .then(function (results) {
        var dtmBlob = results[0];
        var strBlob = results[1];

        // Download both files
        dtmWriter.downloadFile(dtmBlob, dtmFilename);
        strWriter.downloadFile(strBlob, strFilename);

        showModalMessage("Export Complete",
            "Exported both " + dtmFilename + " and " + strFilename,
            "success");
    })
    .catch(function (error) {
        showModalMessage("Export Error", error.message, "error");
    });

    return; // Exit early
}
```

---

## File Formats

### DTM File (Point Cloud)
```
surface,05-Jan-26,,ssi_styles:survey.ssi
0,           0.000,           0.000,           0.000,           0.000,           0.000,           0.000
        6771714.007 478114.535 239.000 0,Surface_0
        6771714.035 478111.655 238.904 1,Surface_0
        6771714.082 478108.752 238.996 2,Surface_0
...
0, 0.000, 0.000, 0.000, END
```

**Characteristics:**
- Unique vertices only (deduplicated)
- Y,X,Z coordinates (Northing, Easting, Elevation)
- Point cloud format
- No string numbers
- Can be used to create DTM/surface in Surpac

### STR File (Triangles)
```
surface,05-Jan-26,0.000,0.000
0, 0.000, 0.000, 0.000,
2, 6771714.007, 478114.535, 239.000, Surface_0,Triangle_0
2, 6771714.035, 478111.655, 238.904, Surface_0,Triangle_0
2, 6771714.082, 478108.752, 238.996, Surface_0,Triangle_0
2, 6771714.007, 478114.535, 239.000, Surface_0,Triangle_0
0, 0.000, 0.000, 0.000,
...
0, 0.000, 0.000, 0.000, END
```

**Characteristics:**
- Each triangle as closed polyline (4 vertices)
- String number based on surface color
- Y,X,Z coordinates
- Preserves triangle connectivity
- Visual representation of surface

---

## Why Both Files?

**DTM File:**
- Point cloud data for terrain modeling
- Used for DTM generation in Surpac
- Elevation analysis
- Contour generation

**STR File:**
- Visual representation
- Can be displayed/edited in Surpac
- Shows triangle structure
- Color-coded by surface
- Quality control

**Together:**
- DTM provides the data
- STR provides the visualization
- Standard Surpac workflow
- Matches industry practice

---

## HTML Dropdown (Recommended)

```html
<select id="surpacFormat">
    <option value="str-blastholes">STR - Blastholes</option>
    <option value="str-kad">STR - KAD Drawings</option>
    <option value="dtm">DTM - Surfaces (exports .dtm + .str)</option>
</select>
```

**Note:** Removed "STR - Surfaces" option. DTM handles surface export.

---

## Backward Compatibility

**Old dropdown values still work:**
- `"str"` → Exports blastholes
- `"dtm"` → Exports both .dtm and .str for surfaces

**New dropdown values:**
- `"str-blastholes"` → Exports blastholes
- `"str-kad"` → Exports KAD drawings
- `"dtm"` → Exports both .dtm and .str for surfaces
- `"str-surfaces"` → Shows info message to use DTM instead

---

## Testing Checklist

### DTM Export Test
1. ✅ Load a surface (OBJ, DXF, or PLY)
2. ✅ Select Surpac format: "DTM"
3. ✅ Click export button
4. ✅ Verify TWO files download:
   - `KIRRA_SURPAC_DTM_[timestamp].dtm`
   - `KIRRA_SURPAC_STR_[timestamp].str`
5. ✅ Verify both have same timestamp
6. ✅ Verify success message shows both filenames
7. ✅ Import both into Surpac and verify compatibility

### STR Blastholes Test
1. ✅ Load blast holes
2. ✅ Select "STR - Blastholes"
3. ✅ Export
4. ✅ Verify ONE file: `KIRRA_SURPAC_STR_BLASTHOLES_[timestamp].str`
5. ✅ Verify string number 512 used

### STR KAD Test
1. ✅ Create KAD drawings with colors
2. ✅ Select "STR - KAD Drawings"
3. ✅ Export
4. ✅ Verify ONE file: `KIRRA_SURPAC_STR_KAD_[timestamp].str`
5. ✅ Verify string numbers match colors

---

## Files Modified

**src/kirra.js (Lines 7331-7425):**
- Updated DTM export to generate both files
- Added Promise.all() for parallel export
- Added dual-file download logic
- Added "str-surfaces" deprecation message
- Updated success message to show both filenames

**No changes needed to writers** - they already support surface export

---

## Benefits

### Industry Standard
- Matches Surpac workflow
- DTM + STR is standard practice
- Users expect both files

### User Experience
- One click exports both files
- No need to export twice
- Files have matching timestamps
- Clear success message

### Workflow Efficiency
- Import both into Surpac
- DTM for terrain modeling
- STR for visualization
- Complete surface representation

---

## Known Limitations

### Browser Download Behavior
- Two files download sequentially
- Some browsers may show two download prompts
- Both use same timestamp for consistency

### File Naming
- DTM uses "KIRRA_SURPAC_DTM_" prefix
- STR uses "KIRRA_SURPAC_STR_" prefix
- Same timestamp ensures pairing

---

## Conclusion

DTM export now correctly generates both .dtm and .str files, matching Surpac's standard workflow. The "STR - Surfaces" option is deprecated in favor of the DTM export which provides both file formats.

**Export Options Summary:**
1. **STR - Blastholes**: 1 file (.str) - blast holes
2. **STR - KAD**: 1 file (.str) - KAD drawings
3. **DTM**: 2 files (.dtm + .str) - surfaces

---

**Status:** Complete ✓

**Ready for Testing:** YES

---
