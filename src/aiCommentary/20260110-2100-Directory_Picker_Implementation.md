# GeoTIFF Export - Directory Picker Implementation (Option A)

**Date**: 2026-01-10 21:00  
**Status**: ✅ COMPLETE  
**Files Modified**: 3

---

## Problem

After implementing the KML pattern with automatic downloads, user identified missing functionality:

> "thats fine but where was the browser picker I never got to pick a location."

The automatic download approach sent files to the Downloads folder only, with no user control over destination.

---

## Solution - Option A: Directory Picker Once

**New Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Show Projection Dialog                         │
│   - EPSG code (required)                                │
│   - Resolution mode (screen/DPI/ppm/full)               │
└─────────────────────────────────────────────────────────┘
                        ↓
                  User confirms
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Directory Picker (ONCE for all exports)        │
│   - Browser's native directory picker                   │
│   - User selects destination folder                     │
└─────────────────────────────────────────────────────────┘
                        ↓
                  User selects folder
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Loop through each surface                       │
│   - Show filename dialog                                │
│   - User enters/edits filename or skips                 │
└─────────────────────────────────────────────────────────┘
                        ↓
                  User enters name
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: Save both files to selected directory           │
│   - [directory]/[filename].tif                          │
│   - [directory]/[filename].prj (same location)          │
└─────────────────────────────────────────────────────────┘
```

---

## Why Directory Picker? (vs File Picker)

**File Picker Limitations:**

`showSaveFilePicker()` returns a `FileSystemFileHandle`, but:
- ❌ No `fileHandle.getParent()` support (throws TypeError in most browsers)
- ❌ Can't get directory handle from file handle
- ❌ Would require TWO file pickers per surface (.tif then .prj)

**Directory Picker Benefits:**

`showDirectoryPicker()` returns a `FileSystemDirectoryHandle`, which:
- ✅ Allows creating multiple files: `dirHandle.getFileHandle(name, { create: true })`
- ✅ User picks location ONCE for all exports
- ✅ Both .tif and .prj guaranteed same directory
- ✅ Clean, predictable workflow

---

## Changes Made

### 1. GeoTIFFExporter.js

**Added directory picker after projection dialog:**

```javascript
// Step 5b) Show directory picker ONCE for all exports
var directoryHandle = null;
if (window.showDirectoryPicker) {
    try {
        directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });
        console.log("Selected directory:", directoryHandle.name);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("Directory picker cancelled by user");
            return;
        }
        throw error;
    }
} else {
    showModalMessage("Unsupported Browser", "Your browser doesn't support directory picker. Files will download to Downloads folder.", "info");
    // Continue without directory picker - files will auto-download
}
```

**Pass directory handle to writer:**

```javascript
await writer.write({
    canvas: renderResult.canvas,
    bbox: renderResult.bbox,
    width: renderResult.width,
    height: renderResult.height,
    filename: filename,
    epsgCode: exportSettings.epsgCode,
    directoryHandle: directoryHandle // Pass directory handle to writer
});
```

---

### 2. IMGWriter.js

**Use directory handle if provided:**

```javascript
// Step 5) Use directory handle if provided, otherwise auto-download
if (data.directoryHandle) {
    try {
        // Save .tif file to selected directory
        var tifFileHandle = await data.directoryHandle.getFileHandle(tifFilename, { create: true });
        var writable = await tifFileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log("Saved GeoTIFF to directory:", tifFilename);

        // Step 6) Save companion .prj file to same directory
        if (data.epsgCode) {
            var wkt = this.getWKTForEPSG(data.epsgCode);
            if (wkt) {
                var prjBlob = new Blob([wkt], { type: "text/plain" });
                var prjFileHandle = await data.directoryHandle.getFileHandle(prjFilename, { create: true });
                var prjWritable = await prjFileHandle.createWritable();
                await prjWritable.write(prjBlob);
                await prjWritable.close();
                console.log("Saved .prj file to directory:", prjFilename);
            }
        }
    } catch (error) {
        if (error.name === "AbortError") {
            console.log("Export cancelled by user");
            throw error;
        } else {
            console.error("Error saving to directory:", error);
            throw error;
        }
    }
} else {
    // Fallback to automatic download if no directory handle
    this.downloadFile(blob, tifFilename);
    console.log("Downloaded GeoTIFF: " + tifFilename);

    if (data.epsgCode) {
        var wkt = this.getWKTForEPSG(data.epsgCode);
        if (wkt) {
            var prjBlob = new Blob([wkt], { type: "text/plain" });
            this.downloadFile(prjBlob, prjFilename);
            console.log("Downloaded .prj file: " + prjFilename);
        }
    }
}
```

**Key Features:**

1. **Directory handle path**: Uses `getFileHandle()` to create files directly in selected directory
2. **Both files saved together**: .tif and .prj written sequentially to same directory
3. **Fallback support**: If browser doesn't support directory picker, falls back to auto-download
4. **Error handling**: Proper AbortError handling for user cancellation

---

### 3. ProjectionDialog.js

**Updated export information:**

```javascript
contentHTML += "<li>You will first select a <strong>directory</strong> for all exports</li>";
contentHTML += "<li>Then you will be prompted for a filename for <strong>each surface</strong></li>";
contentHTML += "<li>Both <strong>.tif</strong> and <strong>.prj</strong> files will be saved to the selected directory</li>";
```

---

## Browser Compatibility

**File System Access API Support:**

| Browser | `showDirectoryPicker` | Status |
|---------|----------------------|--------|
| Chrome 86+ | ✅ Supported | Full support |
| Edge 86+ | ✅ Supported | Full support |
| Safari 15.2+ | ⚠️ Limited | Behind flag |
| Firefox | ❌ Not supported | Falls back to download |

**Fallback Behavior:**

If `window.showDirectoryPicker` is undefined:
1. Show info dialog: "Your browser doesn't support directory picker"
2. Continue with auto-download to Downloads folder
3. User manually moves files to desired location

---

## User Instructions

**To export GeoTIFFs:**

1. File → Export Images as GeoTIFF
2. Select EPSG code and resolution → Click "Export"
3. **Directory picker appears** → Select destination folder
4. For each surface:
   - Enter desired filename (or accept default)
   - Click "Save" to export, or "Skip" to skip this surface
5. Files are saved to your selected folder:
   - `/your/chosen/folder/myfile.tif`
   - `/your/chosen/folder/myfile.prj` (same location)
6. Drag the `.tif` file into QGIS → CRS auto-detected from `.prj`

**Benefits:**

- ✅ Full control over export location
- ✅ One directory selection for all surfaces
- ✅ `.tif` and `.prj` guaranteed same directory
- ✅ No manual file moving required
- ✅ Native browser file picker (not custom dialog)

---

## .PRJ File Format

The `.prj` file contains WKT (Well-Known Text) projection definition.

**Example for EPSG:32750 (WGS 84 / UTM zone 50S):**

```
PROJCS["WGS 84 / UTM zone 50S",
  GEOGCS["WGS 84",
    DATUM["WGS_1984",
      SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],
      AUTHORITY["EPSG","6326"]],
    PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],
    UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],
    AUTHORITY["EPSG","4326"]],
  PROJECTION["Transverse_Mercator"],
  PARAMETER["latitude_of_origin",0],
  PARAMETER["central_meridian",117],
  PARAMETER["scale_factor",0.9996],
  PARAMETER["false_easting",500000],
  PARAMETER["false_northing",10000000],
  UNIT["metre",1,AUTHORITY["EPSG","9001"]],
  AUTHORITY["EPSG","32750"]]
```

**Supported EPSG Codes:**

The `getWKTForEPSG()` function includes WKT definitions for:
- WGS84: 4326, 3857
- GDA94: 4283, 28349-28356 (MGA zones 49-56)
- GDA2020: 7848-7858 (MGA zones 48-58)
- WGS84 UTM: 32749-32756 (zones 49S-56S)

**If EPSG code not found:**

- Returns `null`
- Console warning: "WKT not found for EPSG:XXXXX"
- `.prj` file not created
- User can manually create `.prj` from epsg.io

---

## Testing Checklist

- [ ] Projection dialog shows → User selects EPSG + resolution
- [ ] Directory picker appears → User selects folder
- [ ] Filename prompts for each surface
- [ ] Both .tif and .prj saved to selected directory
- [ ] Files have matching base names
- [ ] Skip button works (surface skipped, continues to next)
- [ ] Cancel directory picker → Export cancelled
- [ ] .prj file contains correct WKT for selected EPSG
- [ ] Open .tif in QGIS → CRS auto-detected from .prj
- [ ] Fallback works in Firefox (auto-download)

---

## Debugging .PRJ Issues

If QGIS doesn't recognize the .prj file:

**Check 1: File exists and same name**
```bash
ls -l myfile.*
# Should show: myfile.tif, myfile.prj
```

**Check 2: .prj content is valid WKT**
```bash
cat myfile.prj
# Should show: PROJCS["WGS 84 / UTM zone 50S", ...
```

**Check 3: EPSG code in WKT matches**
Look for: `AUTHORITY["EPSG","32750"]` at the end

**Check 4: Compare with reference .prj**
Download known-good .prj from epsg.io:
```bash
curl https://epsg.io/32750.wkt > reference.prj
diff myfile.prj reference.prj
```

**Check 5: QGIS log**
Open QGIS → View → Panels → Log Messages
Look for CRS errors when loading .tif

---

## Related Files

- `src/helpers/GeoTIFFExporter.js` - Added directory picker, passes handle to writer
- `src/fileIO/ImageIO/IMGWriter.js` - Uses directory handle to save both files
- `src/dialog/popups/generic/ProjectionDialog.js` - Updated info text
- MDN: [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)

---

## Future Improvements

**Potential enhancements:**

1. **Remember last directory**: Store directory handle in IndexedDB for next export
2. **Bulk filename pattern**: "Surface_{01}.tif", "Surface_{02}.tif", etc.
3. **Online WKT lookup**: Fetch WKT from epsg.io if not in local lookup table
4. **GeoTIFF embedded tags**: Include CRS in GeoTIFF metadata (complex, risky)

---

## Conclusion

The GeoTIFF export now provides full control over export location:

1. **Directory picker ONCE** (applies to all surfaces)
2. **Filename prompt for EACH surface** (user has full control)
3. **Both files saved together** (.tif + .prj in selected directory)

This matches industry-standard GIS software export patterns and provides a clean, predictable workflow with proper .prj file support for QGIS/ArcGIS CRS detection.
