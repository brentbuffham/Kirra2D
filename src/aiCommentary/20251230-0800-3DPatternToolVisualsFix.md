# 3D Pattern Tool Visuals Fix
**Date:** 2025-12-30 08:00
**Issue:** 3D visuals for pattern tools not rendering + visual aesthetic mismatch

## Problem 1: Functions Not Being Called

The 3D visual functions for pattern creation tools were placed INSIDE the 2D-only rendering block in `drawData()`. The code structure was:

```javascript
// Line 21581: 2D-only block begins
if (ctx && !onlyShowThreeJS) {
    // ... 2D rendering code ...
    
    // Lines 22537-22549: 3D calls inside 2D block (BUG!)
    if (onlyShowThreeJS && threeInitialized) {  // Always FALSE here!
        drawPatternInPolygon3DVisual();
    }
    // etc.
}
```

This meant the condition `onlyShowThreeJS && threeInitialized` was **always false** inside this block, so the 3D functions were **never called**.

## Problem 2: Visual Aesthetic Mismatch

The 3D visuals used bloated, oversized elements:
- Tube radius 1.5 for polygon outline (WAY too thick)
- Sphere radius 3-6 for vertices/markers (WAY too big)
- Pyramid 12 height, 6 radius (huge and ugly)

The 2D version uses clean, minimal lines (2-3px) and small dots.

## Fix Applied

### 1. Moved 3D calls to correct location (line ~23368)
Added inside the `if (onlyShowThreeJS && threeInitialized)` block, before `renderThreeJS()`:

```javascript
// Step B) Draw 3D visuals for pattern tools (MUST be in 3D block to actually render!)
drawPatternInPolygon3DVisual();
drawHolesAlongPolyline3DVisual();
drawHolesAlongLine3DVisual();
```

### 2. Scaled down all 3D visual elements to match 2D aesthetic

| Element | Old Size | New Size |
|---------|----------|----------|
| Polygon outline tube | radius 1.5 | radius 0.15 |
| Direction line tube | radius 1.0 | radius 0.1 |
| Vertex spheres | radius 3 | radius 0.4 |
| Start/End/Ref spheres | radius 5-6 | radius 0.6 |
| Pyramid height | 12 | 2.5 |
| Pyramid radius | 6 | 1.2 |
| Pyramid offset | 15 | 3 |

### 3. Updated all three 3D visual functions

All functions now use:
- `createThinTube()` - helper for thin tube geometry
- `createMarkerSphere()` - helper for small marker spheres
- `EdgesGeometry` + `LineBasicMaterial` for pyramid wireframe (cleaner than MeshBasicMaterial wireframe)
- Reduced tube segments (6 radial segments instead of 8) for performance

## Affected Functions

| Function | Purpose | Active Flag |
|----------|---------|-------------|
| `drawPatternInPolygon3DVisual()` | Pattern in polygon 3D feedback | `isPatternInPolygonActive` |
| `drawHolesAlongLine3DVisual()` | Holes along line 3D feedback | `isHolesAlongLineActive` |
| `drawHolesAlongPolyline3DVisual()` | Holes along polyline 3D feedback | `isHolesAlongPolyLineActive` |

## Design Principle

**3D visuals should match 2D aesthetic as closely as practicable:**
- Thin lines (not fat tubes)
- Small markers (not giant spheres)
- Clean, minimal appearance
- Same colors (green, red, magenta, cyan, orange)

## Files Changed
- `src/kirra.js` - Lines 34202-34390 (drawPatternInPolygon3DVisual)
- `src/kirra.js` - Lines 34392-34525 (drawHolesAlongLine3DVisual)  
- `src/kirra.js` - Lines 34692-34868 (drawHolesAlongPolyline3DVisual)

