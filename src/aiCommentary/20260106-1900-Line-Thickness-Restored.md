# Line Thickness Restored in 3D

**Date:** 2026-01-06 19:00  
**Status:** ✅ COMPLETE - Hybrid rendering approach implemented

---

## Problem

After the GPU exhaustion fixes, line thickness was lost in 3D view. All lines appeared as 1-pixel thickness regardless of their `lineWidth` property.

**User Observation:**  
"When I loaded a dxf and then another over the top the line thickness in 3D came back."

This revealed that:
1. Individual chunked entities were using `LineBasicMaterial` (no thickness support)
2. Super-batched DXF entities were using `LineMaterial` (proper thickness support)
3. The two rendering paths were inconsistent

---

## Root Cause

`LineBasicMaterial` in WebGL does **not support** the `linewidth` property. This is a WebGL limitation - the `linewidth` parameter is deprecated and ignored by all modern browsers.

**Only `LineMaterial` (from three-fatlines) supports variable line thickness** via screen-space rendering.

The previous fix for GPU exhaustion switched chunked entities to `LineBasicMaterial` to avoid shader compilation complexity, but this sacrificed line thickness entirely.

---

## Solution: Hybrid Rendering

Implemented a **hybrid approach** that chooses the rendering path based on line thickness:

### Thin Lines (lineWidth ≤ 1)
- Uses `THREE.LineBasicMaterial` + `THREE.LineSegments`
- **Advantages:**
  - Simple, fast
  - No shader compilation issues
  - Lower GPU memory
- **Limitation:** 1-pixel thickness only (acceptable for thin lines)

### Thick Lines (lineWidth > 1)
- Uses `LineMaterial` + `LineSegments2` (from three-fatlines)
- **Advantages:**
  - Variable thickness support
  - Screen-space rendering (thickness independent of zoom)
  - Matches 2D rendering behavior
- **Considerations:**
  - Each chunk gets its own `LineMaterial` (no sharing to avoid shader errors)
  - Resolution must be updated on window resize

---

## Files Modified

### 1. `/src/three/GeometryFactory.js` (lines 536-628)

**Function:** `createBatchedPolyline()`

**Changes:**
```javascript
// BEFORE: Always used LineBasicMaterial (no thickness)
static createBatchedPolyline(pointsArray, lineWidth, defaultColor, isPolygon) {
    // ... always create LineBasicMaterial ...
}

// AFTER: Hybrid approach based on lineWidth
static createBatchedPolyline(pointsArray, lineWidth, defaultColor, isPolygon) {
    // ... build segment arrays ...
    
    var effectiveLineWidth = lineWidth || 1;
    
    if (effectiveLineWidth > 1) {
        // THICK LINES: Use LineMaterial + LineSegments2
        var geometry = new LineSegmentsGeometry();
        var material = new LineMaterial({
            linewidth: effectiveLineWidth,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
            // ... other properties ...
        });
        return new LineSegments2(geometry, material);
    } else {
        // THIN LINES: Use LineBasicMaterial
        var geometry = new THREE.BufferGeometry();
        var material = new THREE.LineBasicMaterial({ /* ... */ });
        return new THREE.LineSegments(geometry, material);
    }
}
```

**Key Points:**
- Single function handles both thin and thick lines
- No `if (true)` hack - proper conditional logic
- Each thick line chunk gets a **new unique `LineMaterial`** (no sharing)
- Resolution set to current window dimensions

---

### 2. `/src/three/ThreeRenderer.js` (lines 870-896)

**Function:** `resize()`

**Changes:**
```javascript
resize(width, height) {
    // ... existing resize logic ...
    
    // NEW: Update LineMaterial resolutions for all fat lines
    this.scene.traverse(function(child) {
        if (child.material && child.material.isLineMaterial) {
            child.material.resolution.set(width, height);
        }
    });
    
    this.needsRender = true;
}
```

**Why This Matters:**
- `LineMaterial` renders lines in **screen-space pixels**
- When window resizes, resolution must be updated or lines render incorrectly
- This traverses the entire scene and updates all LineMaterial instances

---

## Why This Works

### 1. **Respects WebGL Limitations**
- Doesn't try to use `linewidth` property on `LineBasicMaterial` (ignored by WebGL)
- Uses proper screen-space rendering for thick lines

### 2. **Optimizes for Common Case**
- Most CAD entities use thin lines (lineWidth = 1)
- These use fast `LineBasicMaterial` path
- Only thick lines pay the LineMaterial cost

### 3. **Avoids Shader Sharing Issues**
- Each chunk gets its own LineMaterial instance
- No material caching/sharing between chunks
- Prevents "no valid shader program" errors we saw before

### 4. **Maintains GPU Memory Efficiency**
- Chunking still active (storage-level)
- Each chunk is < 10k vertices
- Combined with renderer optimizations (no `preserveDrawingBuffer`, no `antialias`)

---

## Testing Checklist

✅ **Load STR file with thick lines**
- Verify line thickness visible in 3D
- Verify chunked entities show proper thickness

✅ **Load DXF file with mixed line widths**
- Thin lines (≤1) render correctly
- Thick lines (>1) show variable thickness
- No shader errors in console

✅ **Resize window**
- Line thickness remains correct after resize
- No visual distortion

✅ **Load large polyline (72k+ vertices)**
- Still chunks correctly
- No GPU exhaustion
- Thickness preserved across chunks

---

## Performance Impact

### Memory
- **Thin lines:** Same as before (LineBasicMaterial)
- **Thick lines:** Slightly higher (LineMaterial per chunk)
- **Overall:** Acceptable - most entities are thin

### Rendering
- **Thin lines:** Fast (simple shader)
- **Thick lines:** Moderate (screen-space shader)
- **Overall:** Much better than single 72k vertex buffer!

### Draw Calls
- Each chunk = 1 draw call (same as before)
- No increase in draw call count

---

## Conclusion

The hybrid approach provides the **best of both worlds**:
- ✅ Variable line thickness support (user requirement)
- ✅ GPU memory efficiency (chunking + renderer opts)
- ✅ No shader compilation errors (unique materials per chunk)
- ✅ Good performance (thin lines use fast path)

**Result:** Line thickness is restored, large files still work, and GPU doesn't explode! 🎉



