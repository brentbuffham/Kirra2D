# Coordinate System Diagnosis Plan - 2026-01-11

## Problem Summary

After instancing commit (737d822), multiple coordinate-related issues appeared:

1. ❌ **Cursor sphere ≠ mouse position** (major offset visible in screenshot)
2. ❌ **Gizmo never shows** even with "always on" setting
3. ❌ **Mouse locked to XY plane** (view plane calculation broken)
4. ❌ **200ms render time** (performance regression)
5. ❌ **Cursor moves away during pan** (depth/perspective effect with orthographic camera)
6. ❌ **80ms+ pan delay** (interaction lag)
7. ❌ **Screen space snapping broken** (coordinate space mismatch)

All issues point to **coordinate transformation bugs** between different spaces.

## Coordinate Spaces in Kirra

1. **Screen Space** - Pixels from browser window top-left (mouse events)
2. **Canvas Space** - Pixels from canvas element top-left (after rect offset)
3. **NDC (Normalized Device Coords)** - (-1,-1) to (1,1) for Three.js
4. **World Space** - Large UTM coordinates (477040, 6772549)
5. **Local Space** - Three.js geometry coordinates (world - origin)
6. **Camera Space** - Relative to camera position
7. **View Plane** - Plane perpendicular to camera view direction

## Diagnostic Tool: CoordinateDebugger

I've created a comprehensive debugging tool that traces mouse position through ALL coordinate transforms.

### How to Use

**1. Hard refresh browser** (Cmd+Shift+R)

**2. In browser console, activate the debugger:**
```javascript
window.coordinateDebugger.enable();
```

**3. Move your mouse over the 3D canvas**

You'll see a green overlay in the top-right corner showing:
- Screen Space coords
- Canvas Space coords
- NDC (should match InteractionManager.mouse)
- Camera state
- World coords (from view plane intersection)
- Local coords (world - origin)
- Cursor torus position
- **Mismatch indicators** (red = broken, green = OK)

**4. Look for RED text** - this indicates where transforms break:
- `✗ NDC MISMATCH!` = InteractionManager.updateMousePosition broken
- `✗ OFF by (X, Y)` = Cursor position doesn't match calculated world position

### Key Things to Check

1. **Does NDC match InteractionManager.mouse?**
   - If NO → InteractionManager.updateMousePosition is using wrong canvas rect

2. **Is View Plane World position reasonable?**
   - Should be near camera centroid
   - If huge/NaN → raycasting broken

3. **Does Cursor Torus match calculated position?**
   - Compare "Cursor Torus Pos" with "View Plane Local"
   - If different → drawMousePositionIndicatorThreeJS using wrong coords

4. **What's the Local Origin?**
   - Should be near first blast hole or data centroid
   - If (0, 0) → updateThreeLocalOrigin never called

## Expected Diagnosis Flow

### Scenario A: NDC Mismatch
```
✗ NDC MISMATCH!
  NDC: (-0.234, 0.567)
  InteractionManager: (-0.999, 0.123)
```

**Cause**: Canvas rect calculation wrong, or InteractionManager using wrong canvas

**Fix Location**: `InteractionManager.updateMousePosition()` or `handle3DMouseMove()` canvas retrieval

### Scenario B: Cursor Way Off
```
✓ NDC matches
View Plane World: (477040.5, 6772549.2, 258.3)
View Plane Local: (0.5, 0.2, 258.3)
Cursor Torus: (12345.6, 67890.1, 258.3)
✗ OFF by (12345.1, 67889.9)
```

**Cause**: `drawMousePositionIndicatorThreeJS()` receiving world coords but expecting local coords (or vice versa)

**Fix Location**: `handle3DMouseMove()` cursor drawing calls

### Scenario B: View Plane Returns Null
```
View Plane World: getMouseWorldPositionOnViewPlane returned null
```

**Cause**: Raycaster not set up correctly, or view plane calculation failing

**Fix Location**: `InteractionManager.getMouseWorldPositionOnViewPlane()`

### Scenario D: Local Origin Zero
```
Local Origin: (0, 0)
```

**Cause**: `updateThreeLocalOrigin()` never called, or called with no data

**Fix Location**: Data loading sequence in `drawData()` or file import

## Next Steps After Diagnosis

Once the debugger shows WHERE the transform breaks:

1. **Post the debug overlay text** (screenshot or copy/paste)
2. I'll identify the exact broken function
3. Fix the coordinate transform
4. Test with debugger still enabled
5. Confirm all transforms show green checkmarks
6. Disable debugger and test normal operation

## Performance Note

The debugger adds ~1-2ms per mouse move when enabled. **Disable it after diagnosis** for normal operation:

```javascript
window.coordinateDebugger.disable();
```

## Files Modified

1. **src/helpers/CoordinateDebugger.js** - New diagnostic tool (280 lines)
2. **src/kirra.js** - Import and integrate debugger
   - Line 96: Import CoordinateDebugger
   - Line 386: Declare coordinateDebugger variable
   - Line 873-875: Create debugger instance
   - Line 2455-2458: Call traceMousePosition() when enabled

## Status

✅ Debugger created and integrated
⏳ Waiting for user to activate and report findings

## User Action Required

**Please run this in browser console after hard refresh:**

```javascript
window.coordinateDebugger.enable();
```

Then move your mouse over the 3D canvas and:
1. **Screenshot the green debug overlay** or
2. **Copy/paste the debug text from the overlay**
3. **Note where you see RED** (error indicators)

This will tell us exactly which coordinate transform is broken.
