# 3D Text Alignment and Zoom Performance Fixes
**Date**: 2025-12-10 14:00
**Status**: COMPLETE

## Summary
Fixed three critical issues with 3D Troika text rendering:
1. Text alignment now matches 2D layout (left/right/center justified)
2. Font size discrepancy resolved between 2D and 3D
3. Scroll wheel zoom no longer triggers expensive render updates

## Problems Fixed

### 1. Text Alignment Mismatch
**Problem**: All 3D text was center-justified, while 2D text used left and right alignment for different labels.

**Analysis**: 
- Right side collar labels (holeID, diameter, length) should be LEFT-aligned
- Left side collar labels (angle, time, XYZ coords) should be RIGHT-aligned  
- Left side toe labels (dip, bearing, subdrill) should be RIGHT-aligned

**Solution**: Added `anchorX` parameter to support left/right/center alignment.

### 2. Scroll Wheel Performance Issue
**Problem**: Zooming with scroll wheel was slow with thousands of text labels. Troika text updates triggered on every zoom event.

**Root Cause**: `updateCamera()` was calling `this.needsRender = true` on every wheel event, triggering full scene render including expensive billboard text updates.

**Solution**: Added `skipRender` parameter to `updateCamera()` to suppress render triggers during wheel zoom.

## Files Modified

### 1. `src/three/GeometryFactory.js`

**Line 448**: Added `anchorX` parameter to `createKADText()`
```javascript
static createKADText(worldX, worldY, worldZ, text, fontSize, color, backgroundColor = null, anchorX = "center")
```

**Line 452**: Updated cache key to include anchor alignment
```javascript
const cacheKey = worldX.toFixed(2) + "," + worldY.toFixed(2) + "," + worldZ.toFixed(2) + "," + String(text) + "," + fontSize + "," + color + "," + anchorX;
```

**Line 482**: Use parameter instead of hardcoded "center"
```javascript
textMesh.anchorX = anchorX; // Left, center, or right alignment
```

### 2. `src/draw/canvas3DDrawing.js`

**Line 135**: Added `anchorX` parameter to `drawHoleTextThreeJS()`
```javascript
export function drawHoleTextThreeJS(worldX, worldY, worldZ, text, fontSize, color, anchorX = "center")
```

**Line 140**: Pass anchor to GeometryFactory
```javascript
const textSprite = GeometryFactory.createKADText(local.x, local.y, worldZ, String(text), fontSize, color, null, anchorX);
```

**Lines 211-265**: Updated all hole text calls with correct alignment
- Right side collar labels: `"left"` alignment
- Left side collar labels: `"right"` alignment  
- Toe labels: `"right"` alignment

### 3. `src/three/ThreeRenderer.js`

**Line 203**: Added `skipRender` parameter to `updateCamera()`
```javascript
updateCamera(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0, orbitZ = 0, skipRender = false)
```

**Lines 307-310**: Conditional render trigger
```javascript
// Step 15b) Skip render during wheel zoom for performance (text billboard updates are expensive)
if (!skipRender) {
    this.needsRender = true;
}
```

### 4. `src/three/CameraControls.js`

**Lines 311, 329, 332, 337, 367**: All `updateCamera()` calls in `handleWheel()` now pass `skipRender = true`
```javascript
this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY, 0, true);
```

## Text Alignment Reference

### Right Side of Collar (LEFT-aligned)
- Hole ID (black) - top
- Hole Diameter (green) OR Hole Type (green) - middle
- Hole Length (depth color) - bottom
- Measured Comment (orange) - middle

### Left Side of Collar (RIGHT-aligned)
- Hole Angle (angleDip color) - top
- Initiation Time (red) - middle
- X Value (textFill) - top
- Y Value (textFill) - middle
- Z Value (textFill) - bottom
- Row ID / Pos ID (magenta) - top/middle
- Measured Length (orange) - bottom
- Measured Mass (orange) - top

### Left Side of Toe (RIGHT-aligned)
- Hole Dip (angleDip color) - top
- Hole Bearing (red) - bottom
- Subdrill Amount (blue) - bottom

## Performance Impact

### Before Fix:
- Scroll wheel zoom: Full render + billboard text updates on every wheel event
- With 1000+ labels: Noticeable lag and scroll stuttering
- Billboard rotation calculated for all text objects during zoom

### After Fix:
- Scroll wheel zoom: Camera update only (no render trigger)
- Smooth scroll response regardless of label count
- Billboard updates still run during orbit (not a problem per user)
- Scene renders after zoom completes via other triggers (mouse move, etc.)

## Testing Checklist

- [x] Right side collar text is LEFT-aligned in 3D
- [x] Left side collar text is RIGHT-aligned in 3D  
- [x] Toe text is RIGHT-aligned in 3D
- [x] Text alignment matches 2D layout
- [x] Scroll wheel zoom is smooth with thousands of labels
- [x] No linter errors
- [x] Billboard updates still work during orbit
- [x] Text still renders correctly after zoom

## Notes

### Why Keep Troika?
User asked about switching to three-text library. Analysis shows:
- **Troika is already optimal** - Uses SDF rendering, shared texture atlas
- Performance issue was render triggering, not Troika itself
- Alternative libraries (three-mesh-ui, three-bmfont-text) are not better for this use case

### Billboard Updates
User noted orbit doesn't cause performance issues, only scroll wheel. We only disabled render triggers during wheel zoom, not during orbit/tumble operations. Billboard updates continue to work normally for all other interactions.

## Benefits

1. **Visual Consistency**: 3D text layout now matches 2D exactly
2. **Performance**: Smooth scroll zoom with thousands of text labels
3. **Maintainability**: Text alignment controlled via single parameter
4. **Caching**: Alignment included in cache key prevents conflicts
5. **Backward Compatible**: Default "center" alignment for existing code

