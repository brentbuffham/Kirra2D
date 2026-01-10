# GeoTIFF Export - Filename Flow Refactored to Match KML Pattern

**Date**: 2026-01-10 20:45  
**Status**: ✅ COMPLETE  
**Files Modified**: 3

---

## Problem

The GeoTIFF export workflow had filename management integrated into the projection dialog, which caused issues:

1. **Filename field in projection dialog** - User had to enter a prefix, but it was being ignored or reset when EPSG dropdown changed
2. **Wrong pattern** - Projection settings should be separate from filename selection (like KML export does it)
3. **Inconsistent UX** - KML export shows projection dialog FIRST, then filename prompt for EACH item being exported

User feedback:
> "Match the KML because that has the file name in the @Kirra2D/src/dialog/popups/generic/ProjectionDialog.js But I only want to enter it once for each TIF. So the PRJ.. I shouldn't need to name."

---

## Solution - KML Pattern

**New Flow (Matching KML Export)**:

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Show Projection Dialog                         │
│   - EPSG code (required)                                │
│   - Resolution mode (screen/DPI/ppm/full)               │
│   - NO filename field                                   │
└─────────────────────────────────────────────────────────┘
                        ↓
                  User confirms
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Loop through each surface                       │
│   - Show filename dialog for THIS surface              │
│   - Default: "GeoTIFF_2026-01-10T20-45-00_surfacename" │
│   - User can edit or skip                               │
└─────────────────────────────────────────────────────────┘
                        ↓
                  User enters name
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Export with same base name                      │
│   - Download: [filename].tif                            │
│   - Download: [filename].prj (same base name)           │
│   - Both go to Downloads folder automatically           │
└─────────────────────────────────────────────────────────┘
```

---

## Changes Made

### 1. ProjectionDialog.js

**Removed** filename prefix section from export dialog:

```javascript
// DELETED:
contentHTML += '<div style="border: 1px solid...">';
contentHTML += '<p class="labelWhite15">Filename Prefix:</p>';
contentHTML += '<input type="text" id="export-filename-prefix" value="' + defaultPrefix + '">';
contentHTML += '</div>';

// DELETED: filenamePrefix retrieval
var filenamePrefix = document.getElementById("export-filename-prefix").value.trim();
```

**Updated** info section to clarify new flow:

```javascript
contentHTML += "<li>You will be prompted for a filename for <strong>each surface</strong></li>";
contentHTML += "<li>Both <strong>.tif</strong> and <strong>.prj</strong> files will be saved automatically with the same filename</li>";
```

**Result**: Dialog now only handles EPSG + resolution, returns:

```javascript
{
    cancelled: false,
    epsgCode: "32750",
    resolutionMode: "screen",
    dpi: 300,
    pixelsPerMeter: 10
}
```

---

### 2. GeoTIFFExporter.js

**Added** filename prompt for EACH surface (matching KML pattern):

```javascript
for (var i = 0; i < exportSurfaces.length; i++) {
    var surfaceItem = exportSurfaces[i];
    
    // Generate default filename with timestamp
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    var defaultFilename = "GeoTIFF_" + timestamp + "_" + surfaceItem.name.replace(/\.(dtm|str|tif|tiff|obj)$/i, "") + ".tif";
    
    // Close progress dialog temporarily
    progressDialog.close();
    
    // Prompt for filename using showConfirmationDialogWithInput
    var filename = await new Promise((resolve) => {
        window.showConfirmationDialogWithInput(
            "Export GeoTIFF",
            "Enter filename for: " + surfaceItem.name,
            "Filename:",
            "text",
            defaultFilename,
            "Save",
            "Skip",
            function(enteredFilename) {
                // User confirmed
                if (!enteredFilename || enteredFilename.trim() === "") {
                    resolve(null); // Skip this surface
                    return;
                }
                // Ensure .tif extension
                if (!enteredFilename.toLowerCase().endsWith(".tif")) {
                    enteredFilename += ".tif";
                }
                // Remove .tif extension for internal use (writer adds it back)
                resolve(enteredFilename.replace(/\.tif$/i, ""));
            },
            function() {
                // User cancelled/skipped
                resolve(null);
            }
        );
    });
    
    // Reopen progress dialog
    progressDialog = showExportProgressDialog();
    
    if (!filename) {
        console.log("Skipped " + surfaceItem.name);
        continue;
    }
    
    // Export with user-provided filename
    await writer.write({
        canvas: renderResult.canvas,
        bbox: renderResult.bbox,
        width: renderResult.width,
        height: renderResult.height,
        filename: filename, // Base name (no extension)
        epsgCode: exportSettings.epsgCode
    });
}
```

**Same pattern** applied to `exportImages` loop.

**Removed** references to `filenamePrefix`:

```javascript
// DELETED:
var filenamePrefix = exportSettings.filenamePrefix;
var filename = filenamePrefix + "_" + surfaceItem.name;
```

---

### 3. IMGWriter.js

**Simplified** file saving - both `.tif` and `.prj` download automatically:

```javascript
// Step 5) Use automatic download for both .tif and .prj
// This ensures both files go to the same location (Downloads) with the same base name
this.downloadFile(blob, tifFilename);
console.log("Downloaded GeoTIFF: " + tifFilename);

// Step 6) Automatically save companion .prj file
if (data.epsgCode) {
    var wkt = this.getWKTForEPSG(data.epsgCode);
    if (wkt) {
        var prjBlob = new Blob([wkt], { type: "text/plain" });
        this.downloadFile(prjBlob, prjFilename);
        console.log("Downloaded .prj file: " + prjFilename);
    }
}
```

**Removed** complex file picker logic:

```javascript
// DELETED: ~50 lines of showSaveFilePicker() code
// DELETED: Attempts to use fileHandle.getParent() (not supported)
// DELETED: Separate picker/download logic branches
```

**Why automatic download instead of file picker?**

The File System Access API's `showSaveFilePicker()` doesn't provide a way to:
1. Get the directory handle of the saved file
2. Automatically save a second file (`.prj`) to the same location

**Alternatives considered:**
- ❌ Two file pickers (like STR/DTM) - User rejected: "I only want to enter it once for each TIF"
- ❌ File System Access API directory picker - Would require extra user interaction
- ✅ **Automatic download** - Both files go to Downloads folder with guaranteed same base name

**User can then move both files together** to their desired location, and QGIS will recognize them.

---

## Comparison: Old vs New Flow

### Old Flow (BROKEN)

```
User clicks "Export GeoTIFF"
  ↓
Projection Dialog shows:
  - EPSG dropdown
  - Resolution options
  - Filename prefix input ❌ (was being ignored)
  ↓
User clicks "Export"
  ↓
File picker shows for FIRST surface ❌ (unexpected)
  ↓
User saves .tif file
  ↓
.prj auto-downloads ❌ (different location)
  ↓
File picker shows for SECOND surface ❌ (tedious)
...repeat...
```

### New Flow (FIXED)

```
User clicks "Export GeoTIFF"
  ↓
Projection Dialog shows:
  - EPSG dropdown (required)
  - Resolution options (screen/DPI/ppm/full)
  ✅ NO filename field
  ↓
User clicks "Export"
  ↓
FOR EACH SURFACE:
  ↓
  Filename dialog shows:
    - "Enter filename for: [surface name]"
    - Default: "GeoTIFF_2026-01-10T20-45-00_[name].tif"
    - Buttons: "Save" or "Skip"
  ↓
  User enters/edits filename OR clicks "Skip"
  ↓
  Both files download automatically:
    ✅ [filename].tif → Downloads folder
    ✅ [filename].prj → Downloads folder (same base name)
```

---

## User Instructions

**To export GeoTIFFs:**

1. File → Export Images as GeoTIFF
2. Select EPSG code and resolution → Click "Export"
3. For each surface:
   - Enter desired filename (or accept default)
   - Click "Save" to export, or "Skip" to skip this surface
4. Files download to your Downloads folder in pairs:
   - `myfile.tif`
   - `myfile.prj` (same base name)
5. Move both files together to your working folder
6. Drag the `.tif` file into QGIS → CRS auto-detected from `.prj`

**Benefits:**

- ✅ One filename entry per surface (not per file)
- ✅ `.tif` and `.prj` guaranteed same base name
- ✅ Can skip surfaces individually
- ✅ Matches familiar KML export pattern
- ✅ No risk of files going to different locations

---

## Testing Checklist

- [ ] Single surface export → 2 files download (`.tif` + `.prj`)
- [ ] Multiple surfaces export → Filename prompt for each surface
- [ ] Skip button → Surface skipped, continues to next
- [ ] EPSG code → Included in `.prj` file
- [ ] Open in QGIS → CRS auto-detected
- [ ] File pairs have matching base names
- [ ] Default filename includes timestamp and surface name

---

## Related Files

- `src/dialog/popups/generic/ProjectionDialog.js` - Projection/resolution dialog (no filename)
- `src/helpers/GeoTIFFExporter.js` - Export orchestration with per-surface filename prompts
- `src/fileIO/ImageIO/IMGWriter.js` - Writes `.tif` + `.prj` to Downloads
- `src/kirra.js` (lines 8590-8720) - KML export reference pattern

---

## Technical Notes

**Why not use File System Access API for both files?**

The API's `showSaveFilePicker()` returns a `FileSystemFileHandle`, but:
- `fileHandle.getParent()` is **not supported** in most browsers (threw TypeError)
- No standardized way to get the directory handle
- Would require experimental File System Access API directory operations

**Alternative approach (not implemented):**
```javascript
// Get directory handle first
var dirHandle = await window.showDirectoryPicker();
var fileHandle = await dirHandle.getFileHandle(filename + ".tif", { create: true });
var prjHandle = await dirHandle.getFileHandle(filename + ".prj", { create: true });
```

This requires **two user gestures** (directory picker + file creation) and is more complex than automatic download.

**Chosen solution:** Automatic download is simpler, guaranteed to work, and matches user expectations from other software.

---

## Conclusion

The GeoTIFF export now follows the same pattern as KML export:

1. **Projection settings FIRST** (applies to all surfaces)
2. **Filename prompt for EACH surface** (user has full control)
3. **Automatic paired file saving** (`.tif` + `.prj` with same base name)

This provides a clean, predictable workflow that matches industry-standard GIS software export patterns.
