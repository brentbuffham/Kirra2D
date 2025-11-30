# 3D userData Missing - Debug Logging Added
**Date**: 2025-11-30 17:30
**Status**: 🔍 DEBUGGING

## Problem Identified

From console output:
```
🔍 [3D] Raycast result: 3 intersects
  [0] distance: 5083.49 | type: Mesh | userData: Object { }  ← EMPTY!
  [1] distance: 5084.11 | type: Mesh | userData: Object { }  ← EMPTY!
  [2] distance: 5084.62 | type: Mesh | userData: Object { }  ← EMPTY!
🎯3D ❌ No KAD mesh in raycast results
```

**Raycast IS working** - hitting objects.
**But userData is EMPTY** - should be `{type: "kadLine", kadId: "lineObject2"}`

## Root Cause Hypothesis

The draw functions have code to set userData:
```javascript
if (kadId) {
    lineMesh.userData = { type: "kadLine", kadId: kadId };
}
```

**BUT**: Either `kadId` parameter is `undefined`/`null`, OR userData is being cleared after being set.

## Debug Logging Added

### canvas3DDrawing.js - drawKADLineSegmentThreeJS (Line 288)
```javascript
console.log("🔧 [drawKADLineSegmentThreeJS] kadId:", kadId);
if (kadId) {
    lineMesh.userData = { type: "kadLine", kadId: kadId };
    console.log("✅ [drawKADLineSegmentThreeJS] userData set:", lineMesh.userData);
} else {
    console.log("❌ [drawKADLineSegmentThreeJS] kadId is falsy, NOT setting userData");
}
```

### canvas3DDrawing.js - drawKADPolygonSegmentThreeJS (Line 307)
```javascript
console.log("🔧 [drawKADPolygonSegmentThreeJS] kadId:", kadId);
if (kadId) {
    polyMesh.userData = { type: "kadPolygon", kadId: kadId };
    console.log("✅ [drawKADPolygonSegmentThreeJS] userData set:", polyMesh.userData);
} else {
    console.log("❌ [drawKADPolygonSegmentThreeJS] kadId is falsy, NOT setting userData");
}
```

## Expected Console Output

### If kadId is undefined:
```
🔧 [drawKADPolygonSegmentThreeJS] kadId: undefined
❌ [drawKADPolygonSegmentThreeJS] kadId is falsy, NOT setting userData
```
**Fix**: Check how kadId is passed when calling these functions in kirra.js

### If kadId is correct but userData lost:
```
🔧 [drawKADPolygonSegmentThreeJS] kadId: "polyObject6"
✅ [drawKADPolygonSegmentThreeJS] userData set: {type: "kadPolygon", kadId: "polyObject6"}
...
[Later during raycast]
🔍 [3D] Raycast result: 3 intersects
  [0] userData: Object { }  ← STILL EMPTY!
```
**Fix**: userData is being cleared somewhere - check if ThreeJS groups or renderer clears userData

### If everything works:
```
🔧 [drawKADPolygonSegmentThreeJS] kadId: "polyObject6"
✅ [drawKADPolygonSegmentThreeJS] userData set: {type: "kadPolygon", kadId: "polyObject6"}
...
[Later during raycast]
🔍 [3D] Raycast result: 3 intersects
  [0] distance: 5083.49 | userData: {type: "kadPolygon", kadId: "polyObject6"}
🎯3D ✅ Found KAD mesh! Type: kadPolygon | kadId: polyObject6
```

## Testing Instructions

1. **Refresh the application**
2. **Switch to 3D mode**
3. **Watch console during loading** - look for `🔧 [drawKADLineSegmentThreeJS]` and `🔧 [drawKADPolygonSegmentThreeJS]` messages
4. **Right-click on a line or poly**
5. **Send me the FULL console output**

## Files Modified

1. **canvas3DDrawing.js** (Lines 288-304, 307-323): Added kadId debug logging

## Critical Questions to Answer

1. Is `kadId` being passed correctly when calling the draw functions?
2. If yes, is userData being set correctly?
3. If yes, is userData being cleared/lost before raycasting?

The console output will tell us exactly where the chain breaks!

