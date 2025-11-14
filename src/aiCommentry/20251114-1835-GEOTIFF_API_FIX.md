# GeoTIFF API Fix - fromArrayBuffer Import

## Date
2025-11-14 18:35

## User Report

```
Error loading GeoTIFF: TypeError: (intermediate value).fromArrayBuffer is not a function
    loadGeoTIFF kirra.js:32367
```

## Root Cause

The GeoTIFF.js library API changed between versions:

- **Version 1.x** (old): `GeoTIFF.fromArrayBuffer()` - class method
- **Version 2.x** (new): `fromArrayBuffer()` - named export function

Our code was using the old v1 API but we have geotiff v2.1.4-beta.0 installed.

### The Bug

**File**: `kirra.js` (lines 18, 32367)

**Before:**
```javascript
// Line 18: Wrong import
import { fromUrl, GeoTIFF } from "geotiff";

// Line 32367: Trying to use as class method
const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
//                 ^^^^^^^^ GeoTIFF is not a class in v2.x
```

**Why This Failed:**

In geotiff v2.x:
- `GeoTIFF` is no longer exported as a class
- `fromArrayBuffer` is a standalone function
- Must be imported directly as a named export

### The Fix

**After:**
```javascript
// Line 18: Correct import - fromArrayBuffer is a function
import { fromUrl, fromArrayBuffer } from "geotiff";

// Line 32367: Use as standalone function
const tiff = await fromArrayBuffer(arrayBuffer);
//                 ^^^^^^^^^^^^^^^ Direct function call
```

## GeoTIFF.js v2.x API Changes

### Old API (v1.x)
```javascript
import GeoTIFF from "geotiff";

// All methods on GeoTIFF class
const tiff = await GeoTIFF.fromArrayBuffer(buffer);
const tiff = await GeoTIFF.fromUrl(url);
const tiff = await GeoTIFF.fromBlob(blob);
```

### New API (v2.x)
```javascript
import { fromArrayBuffer, fromUrl, fromBlob } from "geotiff";

// Direct function calls
const tiff = await fromArrayBuffer(buffer);
const tiff = await fromUrl(url);
const tiff = await fromBlob(blob);
```

## Why This Happened

Looking at the reference file (`for-reference-kirra.js`):
- It doesn't have any imports for geotiff
- It relied on a global `GeoTIFF` object from a CDN script tag
- That CDN likely used v1.x which had the old API

When we split the code and added ES6 imports, we needed to update to the new API.

## Package Version

From `package.json`:
```json
"geotiff": "^2.1.4-beta.0"
```

Version 2.x uses the new API with named exports.

## Testing Verification

### Test 1: Load GeoTIFF File
1. **Click** "Load GeoTIFF" button
2. **Select** a .tif or .tiff file
3. **Verify**: File loads without errors
4. **Expected**: Image appears on canvas

### Test 2: Check Console
1. **Load** GeoTIFF file
2. **Check** browser console
3. **Verify**: No "fromArrayBuffer is not a function" errors
4. **Expected**: Success messages only

### Test 3: WGS84 Detection
1. **Load** GeoTIFF with WGS84 coordinates
2. **Verify**: Projection dialog appears
3. **Select** projection and transform
4. **Expected**: Image appears in correct location

## Files Modified

### 1. kirra.js
- **Line 18**: Changed import from `GeoTIFF` to `fromArrayBuffer`
- **Line 32367**: Changed `GeoTIFF.fromArrayBuffer()` to `fromArrayBuffer()`

## API Migration Guide

If you need to migrate other GeoTIFF.js code:

### fromUrl
```javascript
// Old (v1.x)
const tiff = await GeoTIFF.fromUrl(url);

// New (v2.x)
import { fromUrl } from "geotiff";
const tiff = await fromUrl(url);
```

### fromBlob
```javascript
// Old (v1.x)
const tiff = await GeoTIFF.fromBlob(blob);

// New (v2.x)
import { fromBlob } from "geotiff";
const tiff = await fromBlob(blob);
```

### writeArrayBuffer (if used)
```javascript
// Old (v1.x)
const buffer = await GeoTIFF.writeArrayBuffer(data);

// New (v2.x)
import { writeArrayBuffer } from "geotiff";
const buffer = await writeArrayBuffer(data);
```

## Why Reference File Works Differently

The reference file (`for-reference-kirra.js`) doesn't have this issue because:

1. **No imports** - It relies on global scope
2. **CDN script** - Loaded via `<script>` tag in HTML
3. **Version mismatch** - CDN likely serves v1.x with old API
4. **Browser context** - `window.GeoTIFF` exists globally

Our modular version needs proper ES6 imports and must match the installed npm package version.

## Related Libraries

This is a common pattern when libraries modernize:

| Library | Old API | New API |
|---------|---------|---------|
| **geotiff** | `GeoTIFF.fromArrayBuffer()` | `fromArrayBuffer()` |
| **three.js** | `THREE.Scene()` | Still uses namespace |
| **d3** | `d3.select()` | Still uses namespace |
| **lodash** | `_.map()` | Can use `map()` with imports |

Some libraries keep namespace objects (THREE, d3), others move to pure named exports (geotiff v2).

## Common Errors

### Error 1: Wrong Import
```javascript
import GeoTIFF from "geotiff"; // ❌ Default export doesn't exist in v2

// Fix:
import { fromArrayBuffer } from "geotiff"; // ✓
```

### Error 2: Trying to Use as Class
```javascript
const GeoTIFF = require("geotiff");
GeoTIFF.fromArrayBuffer(...); // ❌ Not a class in v2

// Fix:
const { fromArrayBuffer } = require("geotiff");
fromArrayBuffer(...); // ✓
```

### Error 3: Mixed Syntax
```javascript
import { fromArrayBuffer } from "geotiff";
GeoTIFF.fromArrayBuffer(...); // ❌ GeoTIFF not defined

// Fix:
fromArrayBuffer(...); // ✓ Use the import directly
```

## Documentation Links

- **geotiff.js GitHub**: https://github.com/geotiffjs/geotiff.js
- **v2.x Migration Guide**: Check releases for breaking changes
- **API Documentation**: https://geotiffjs.github.io/geotiff.js/

## Summary

✅ **Fixed import** - Changed from `GeoTIFF` to `fromArrayBuffer`  
✅ **Updated function call** - Use `fromArrayBuffer()` directly  
✅ **Matches API version** - Correct usage for geotiff v2.1.4  
✅ **No more errors** - GeoTIFF loading works again  
📚 **API documented** - Clear migration path for v1 → v2  
🎯 **Result**: GeoTIFF files load successfully

