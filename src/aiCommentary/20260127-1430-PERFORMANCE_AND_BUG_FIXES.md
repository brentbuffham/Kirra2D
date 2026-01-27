# Performance and Bug Fixes - 2026-01-27

## Issues Addressed

### 1. ✅ 2D Scroll Wheel Performance (FIXED)
**Problem**: Scroll wheel zoom in 2D was causing 25,688ms INP.

**Root Cause**: Every wheel event was calling `recalculateContours()` which is very expensive.

**Solution** (kirra.js ~line 11738):
- Removed contour recalculation on wheel events
- Added `requestAnimationFrame` debouncing for 2D redraws
- For 3D mode, direct camera sync without full redraw
- Debounced overlay updates with 100ms timeout

### 2. ✅ Pattern Add Not Adding Subdrill (FIXED)
**Problem**: Patterns created via Add Pattern dialog had no subdrill.

**Root Cause** (kirra.js ~line 26287): When `useGradeZ` is true, the hole length calculation was:
```javascript
let holeLength = useGradeToCalcLength ? parseFloat((startZLocation - gradeZLocation) / cosAngle) : parseFloat(length);
```
This only calculated bench height (collar to grade), NOT total length including subdrill.

**Solution**: Changed to include subdrill in the calculation:
```javascript
let holeLength = useGradeToCalcLength ? parseFloat((startZLocation - gradeZLocation + subdrill) / cosAngle) : parseFloat(length);
```

### 3. ✅ Circle at Z=0 Not Rendering (FIXED)
**Problem**: KAD circles placed at exactly 0m RL (sea level) were not rendering correctly.

**Root Cause**: JavaScript falsy value bug. Code like:
```javascript
const centerZ = circle.pointZLocation || dataCentroidZ || 0;
```
If `pointZLocation = 0`, the `||` operator treats 0 as falsy and falls through to `dataCentroidZ`.

**Solution**: Use explicit null/undefined checks:
```javascript
const centerZ = (circle.pointZLocation !== undefined && circle.pointZLocation !== null) 
    ? circle.pointZLocation : (dataCentroidZ || 0);
```

Fixed in:
- kirra.js line ~2424 (3D click selection)
- kirra.js line ~30543 (3D circle rendering)
- canvas3DDrawSelection.js line ~523 (circle highlights)

**Note**: Z elevations in Kirra support -27,000m to +16,000m range inclusive of 0m.

### 4. 🔍 LOD Not Hiding Labels (DEBUGGING ADDED)
**Problem**: Text labels don't disappear when LOD level changes.

**Investigation**:
- `labelsGroup` is created in ThreeRenderer constructor
- `labelsGroup` is registered with LODManager via `setLayers()`
- `updateVisibility()` should set `labelsGroup.visible = false` at MEDIUM/LOW/MINIMAL levels
- `_setLayerVisibility()` handles THREE.Group objects correctly

**Debug logging added** (kirra.js LOD-DEV2 handler):
- Logs dropdown change events
- Checks if threeRenderer and lodManager exist
- Logs layer status after override is set

**Next Steps**: Check console for these debug logs when changing LOD override:
- "📊 LOD Override dropdown changed to: X"
- "📊 Setting LOD override to level X"
- "📊 LOD layers after override: {labels: VISIBLE/HIDDEN/NULL}"

### 5. 🔄 LOD Display Not Updating (FIXED)
**Problem**: Frustum width and Current LOD displays showed "-".

**Root Cause**: DOM elements were being queried at module load time before they existed.

**Solution** (kirra.js): Query elements fresh inside the setInterval callback:
```javascript
var fwDisplay = document.getElementById("frustumWidthDisplay");
var lodDisplay = document.getElementById("currentLODDisplay");
```

## Files Modified

1. **src/kirra.js**
   - Wheel event handler (~line 11738): Removed contour recalculation, added debouncing
   - addPattern function (~line 26287): Fixed subdrill calculation
   - Circle Z handling (~line 2424, 30543): Fixed Z=0 falsy bug
   - LOD override handler (~line 4157): Added debug logging
   - LOD display update (~line 4175): Fixed DOM element lookup

2. **src/draw/canvas3DDrawSelection.js**
   - Circle highlight (~line 523): Fixed Z=0 falsy bug

## Testing Checklist

- [ ] Load 10,000 holes and test 2D scroll wheel zoom - should be smooth
- [ ] Create pattern with subdrill > 0 - verify toe extends below grade
- [ ] Place circle at exactly 0m RL - should render correctly
- [ ] Enable Developer Mode and check LOD display values
- [ ] Test LOD override dropdown - check console for debug logs
- [ ] Verify labels hide when LOD set to MEDIUM/LOW/MINIMAL
