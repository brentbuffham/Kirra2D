# Fixed: Rendering Loops and Centroid Z Calculation

**Date:** 2025-01-06 17:20  
**Status:** ✅ FIXED

## Issues Fixed

### 1. Rendering Loops in 3D Mode ✅

**Problem:** Flattened 2D image was being drawn in 3D mode, causing duplicate rendering with the textured mesh.

**Evidence:**
```
🖼️ [3D IMAGE] Drawing image in 3D: flattened_231001_PIT_SMALLER.obj
🎥 Rendering textured mesh in 3D: 231001_PIT_SMALLER.obj
🖼️ [3D IMAGE] Checking image: flattened_231001_PIT_SMALLER.obj
```

**Root Cause:**  
The `flattenTexturedMeshToImage()` function creates a flattened 2D image for canvas rendering and stores it in `loadedImages` with `sourceType: "flattened_obj"`. The 3D rendering loop was drawing ALL images in `loadedImages`, including these flattened images, which should only be used in 2D mode.

**Fix:** Modified `drawData()` at line 24068 to skip flattened images in 3D mode:

```javascript
loadedImages.forEach((image, imageKey) => {
    // Step 2.3a) Skip flattened OBJ images in 3D mode (textured mesh is rendered instead)
    if (image.sourceType === "flattened_obj") {
        console.log("🖼️ [3D IMAGE] Skipping flattened image in 3D mode (textured mesh used instead):", imageKey);
        return;
    }
    // ... rest of rendering logic
});
```

**Result:**
- ✅ In 2D mode: Flattened image is drawn (fast 2D canvas rendering)
- ✅ In 3D mode: Textured mesh is rendered (proper 3D with lighting), flattened image skipped
- ✅ No more duplicate rendering or loops

---

### 2. Centroid Z Not Updating After OBJ Load ✅

**Problem:** After loading an OBJ surface, the Z centroid wasn't being recalculated, causing camera/view issues in 3D.

**Root Cause:**  
The `calculateDataCentroid()` function at line 625 was looking for `surface.triangles` with `tri.minZ`/`tri.maxZ` properties. However, when using Three.js OBJLoader, we extract triangles with full vertex objects but don't calculate per-triangle min/max Z values.

**Fix:** Modified `calculateDataCentroid()` at line 624 to use `surface.points` instead:

```javascript
// Step 4b) Add surface XYZ values if available
if (typeof loadedSurfaces !== "undefined" && loadedSurfaces && loadedSurfaces.size > 0) {
    for (const [surfaceId, surface] of loadedSurfaces.entries()) {
        if (surface && surface.points && Array.isArray(surface.points) && surface.points.length > 0) {
            // Step 4b.1) Surface with points array - use points for XYZ
            for (const point of surface.points) {
                if (point && typeof point === "object") {
                    sumX += parseFloat(point.x) || 0;
                    sumY += parseFloat(point.y) || 0;
                    countXY++;
                    if (point.z !== undefined) {
                        sumZ += parseFloat(point.z) || 0;
                        countZ++;
                    }
                }
            }
        } else if (surface && surface.meshBounds) {
            // Step 4b.2) Surface with meshBounds - use bounds for XYZ
            sumX += (parseFloat(surface.meshBounds.minX) || 0) + (parseFloat(surface.meshBounds.maxX) || 0);
            sumY += (parseFloat(surface.meshBounds.minY) || 0) + (parseFloat(surface.meshBounds.maxY) || 0);
            countXY += 2;
            sumZ += parseFloat(surface.meshBounds.minZ) || 0;
            sumZ += parseFloat(surface.meshBounds.maxZ) || 0;
            countZ += 2;
        }
    }
}
```

**Result:**
- ✅ Z centroid now correctly calculated from surface points
- ✅ Camera/view centers properly in 3D after OBJ load
- ✅ Works for both textured and non-textured surfaces

---

## Files Modified

1. **kirra.js** (line 24068) - Skip flattened images in 3D rendering loop
2. **kirra.js** (line 624) - Use surface points for centroid Z calculation

## Testing Results

After hard refresh:
- ✅ Textured OBJ loads correctly
- ✅ 2D mode: Shows flattened image (fast canvas rendering)
- ✅ 3D mode: Shows textured mesh (proper 3D lighting), no duplicate rendering
- ✅ Centroid Z updates correctly, camera centers on loaded surface
- ✅ No rendering loops or performance issues

## Summary

Both issues stemmed from the transition to Three.js OBJLoader:
1. The flattened image system (designed for 2D performance) needed a 3D mode filter
2. The centroid calculation needed to work with the new points-based surface structure

Both fixes are minimal, focused, and maintain backward compatibility with existing surface types.

