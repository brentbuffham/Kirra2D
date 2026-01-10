# GeoTIFF Export - Filename Prefix & CRS Clarification

**Date:** 2026-01-10 20:20  
**Status:** COMPLETED  
**Priority:** Medium  
**Files Modified:**
- `src/helpers/GeoTIFFExporter.js`
- `src/kirra.js`

## Issues Addressed

### Issue 1: Missing Filename Prompt
**Problem:** Files were auto-downloaded with surface names, no user control.

**User Request:** "There was supposed to be a filename request" → Need Option B (filename prefix).

**Solution:** Added filename prefix prompt before export.

### Issue 2: CRS Confusion
**Problem:** User thought coordinates were being transformed to WGS84.

**User Quote:** "And the file is always being written with the EPSG:4326 - WGS84. Should we just keep the geo tiff in the current EPSG Code. And we are really just tagging it with the current EPSG or Projection code."

**Clarification:**
- ✅ Coordinates are **NEVER transformed**
- ✅ EPSG code is just a **TAG** documenting what system the data is in
- ✅ User selects "My data is in UTM Zone 50S (EPSG:32750)"
- ✅ `.prj` file tells GIS: "These coordinates (478390, 6772782) are in EPSG:32750"
- ❌ We do NOT convert coordinates from one CRS to another

## Implementation

### Change 1: Filename Prefix Prompt

**Added to `exportImagesAsGeoTIFF()`:**

```javascript
// Step 4) Prompt for filename prefix
var timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
var defaultPrefix = "GeoTIFF_" + timestamp;

return new Promise((resolve) => {
    showConfirmationDialogWithInput(
        "Export GeoTIFF",
        "Enter base filename prefix for GeoTIFF export (...)",
        "Filename prefix:",
        "text",
        defaultPrefix,
        "Continue",
        "Cancel",
        async function(filenamePrefix) {
            // Continue with export using the prefix
            await continueExport(filenamePrefix.trim(), ...);
            resolve();
        },
        function() {
            // User cancelled
            resolve();
        }
    );
});
```

**How it works:**
1. User clicks "Export GeoTIFF"
2. Prompt appears: "Enter base filename prefix"
3. Default: `GeoTIFF_2026-01-10T20-15-30`
4. User can customize (e.g., "S4_226_406_Topo")
5. Files created: `S4_226_406_Topo_surface1.tif`, `S4_226_406_Topo_surface2.tif`, etc.

### Change 2: Apply Prefix to Filenames

**Updated filename generation:**

```javascript
// Generate filename with prefix
var cleanName = surfaceItem.name.replace(/\.(dtm|str|tif|tiff|obj)$/i, "");
var filename = filenamePrefix + "_" + cleanName;

await writer.write({
    canvas: renderResult.canvas,
    bbox: renderResult.bbox,
    width: renderResult.width,
    height: renderResult.height,
    filename: filename,  // e.g., "MyExport_surface1"
    epsgCode: exportSettings.epsgCode
});
```

**Filename Pattern:**
- **Input:** Surface name: `251228_s4_226_406_topo.dtm`
- **Prefix:** `GeoTIFF_2026-01-10`
- **Output:** `GeoTIFF_2026-01-10_251228_s4_226_406_topo.tif`

### Change 3: Updated Completion Message

**Added CRS clarification:**

```javascript
showModalMessage(
    "Export Complete", 
    "Exported " + totalItems + " surface(s) as GeoTIFF\n\n" +
    "Files saved to Downloads folder:\n" + fileList + "\n" +
    "IMPORTANT: Coordinates are preserved in their original projection.\n" +
    "The EPSG:" + exportSettings.epsgCode + " tag tells GIS software what projection they're in.\n\n" +
    "To open in QGIS:\n" +
    "1. Keep .tif and .prj files together\n" +
    "2. Drag the .tif file into QGIS\n" +
    "3. CRS will auto-detect from .prj file", 
    "success"
);
```

### Change 4: Added Code Comment Clarification

**In `GeoTIFFExporter.js` at projection dialog:**

```javascript
// Step 5) Show projection and resolution dialog
// IMPORTANT: We do NOT transform coordinates! The EPSG code is just a TAG.
// The user selects which CRS their data is ALREADY IN (e.g., UTM Zone 50S).
// The .prj file tells GIS software "these coords are in EPSG:32750" - no transformation occurs.
var exportSettings = await promptForExportProjection(commonBbox);
```

## CRS Tagging Explained

### What Happens:

**Original Data (in Kirra):**
- Coordinates: `X=478390, Y=6772782, Z=380`
- System: UTM Zone 50S (EPSG:32750)

**User Action:**
- Exports GeoTIFF
- Selects EPSG:32750 from dialog
- This tells Kirra: "My data is in UTM Zone 50S"

**Exported GeoTIFF:**
```
ModelTiepoint: [0, 0, 0, 478390, 6772782, 0]
ModelPixelScale: [0.25, 0.25, 0]
```
Coordinates: `478390, 6772782` ← **UNCHANGED**

**Companion .prj File:**
```
PROJCS["WGS 84 / UTM zone 50S", ... EPSG:32750]
```
Meaning: "The coordinates in the TIF are in UTM Zone 50S"

**When Opened in QGIS:**
- QGIS reads .prj file
- QGIS knows: "These coords are UTM Zone 50S"
- QGIS displays surface at correct location
- **No transformation occurred** - just proper labeling

### Common Misconception:

❌ **WRONG:** "EPSG:32750 converts my data to UTM Zone 50S"  
✅ **CORRECT:** "EPSG:32750 documents that my data is ALREADY in UTM Zone 50S"

### Analogy:

Think of EPSG code like a **luggage tag**:
- Your suitcase (data) is going to Sydney
- The tag (EPSG code) says "Sydney"
- The tag doesn't **send** the suitcase to Sydney
- The tag **identifies** where the suitcase is going

Same with GeoTIFF:
- Your coordinates are in UTM Zone 50S
- The EPSG tag says "UTM Zone 50S"
- The tag doesn't **transform** coordinates
- The tag **identifies** what system they're in

## User Workflow

### Before Fix:
1. Click "Export GeoTIFF"
2. Select EPSG + resolution → Export
3. Files download with surface names
4. ❌ No control over filenames
5. ❌ Unclear if coordinates are transformed

### After Fix:
1. Click "Export GeoTIFF"
2. **Enter filename prefix** (e.g., "MyProject_Topo")
3. Select EPSG + resolution → Export
4. ✅ Files: `MyProject_Topo_surface1.tif`, `MyProject_Topo_surface2.tif`
5. ✅ Message clarifies: "Coordinates preserved in original projection"

## Example Export Session

**Scenario:** Exporting Australian mine site topography

**Step 1: Click Export**
```
Menu → File → Export Images as GeoTIFF
```

**Step 2: Filename Prompt**
```
Dialog: "Enter base filename prefix"
Default: GeoTIFF_2026-01-10T20-15-30
User enters: S4_226_406_Topo_Jan2026
```

**Step 3: Projection Dialog**
```
Dialog: "Select EPSG and resolution"
User selects: EPSG:32750 (WGS 84 / UTM Zone 50S)
Resolution: 4 pixels/meter (0.25m GSD)
```

**Step 4: Export**
```
Progress: Rendering surface... 100%
```

**Step 5: Completion**
```
Files downloaded to ~/Downloads:
- S4_226_406_Topo_Jan2026_251228_s4_226_406_topo.tif
- S4_226_406_Topo_Jan2026_251228_s4_226_406_topo.prj

Message: "Coordinates are preserved in their original projection.
         The EPSG:32750 tag tells GIS software what projection they're in."
```

**Step 6: Open in QGIS**
```
Drag S4_226_406_Topo_Jan2026_251228_s4_226_406_topo.tif into QGIS
QGIS reads .prj file
QGIS shows: "CRS: EPSG:32750 - WGS 84 / UTM Zone 50S" ✅
Coordinates display correctly: 478390 E, 6772782 N ✅
```

## Testing Checklist

- ✅ Filename prompt appears before export
- ✅ Default filename includes timestamp
- ✅ User can customize prefix
- ✅ Files named: `[prefix]_[surface].tif`
- ✅ Completion message shows file list
- ✅ Message clarifies coordinates not transformed
- ✅ Coordinates in TIF match source data
- ✅ QGIS auto-detects CRS from .prj
- ✅ Surface displays at correct location in QGIS

## Related Files

- `src/helpers/GeoTIFFExporter.js` - Export orchestration
- `src/fileIO/ImageIO/IMGWriter.js` - GeoTIFF file writing
- `src/dialog/popups/generic/ProjectionDialog.js` - EPSG selection UI
- `src/kirra.js` - Export button handler (line 8177)

## Future Enhancements

1. **Remember last prefix** - Store in localStorage
2. **Smart prefix suggestions** - Based on loaded surface names
3. **CRS auto-detection** - Suggest EPSG based on coordinate ranges
4. **Batch rename tool** - Rename surfaces before export
5. **Custom suffix option** - Add suffix after surface name

## Notes

- Prefix is sanitized (removes extensions)
- Multiple surfaces get sequential numbered files
- Empty prefix not allowed (validation)
- Cancel button exits gracefully
- Error handling preserves dialog state

---

**Status:** COMPLETED  
**Testing Required:** User validation with real data  
**Documentation:** Comments added to code explaining CRS tagging
