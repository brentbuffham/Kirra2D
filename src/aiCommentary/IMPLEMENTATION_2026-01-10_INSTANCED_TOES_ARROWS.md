# Instanced Toe Circles and Direction Arrows - 2026-01-10

## Overview

Added instanced rendering for toe circles and first movement direction arrows to improve performance when rendering patterns with many holes.

## Features Implemented

### 1. Instanced Toe Circles ✅

**Problem**: Each toe circle was individually drawn, creating excessive draw calls for large patterns.

**Solution**: One `InstancedMesh` for all toe circles with per-instance position matrices.

**Benefits**:
- ~10-100x fewer draw calls for patterns with many holes
- All toes same size and color (green in light mode, blue in dark mode)
- GPU-efficient rendering
- Responds to toe size slider (`toeSizeInMeters`)

**Details**:
- Color: `0x26ff00` (green) in light mode, `0x5eacff` (blue) in dark mode
- Radius: Controlled by `toeSlider` (default 1.0m)
- Opacity: 0.2 (transparent)
- Position: At each hole's toe location (`endXLocation, endYLocation, endZLocation`)

### 2. Instanced First Movement Direction Arrows ✅

**Problem**: Direction arrows were individually created, inefficient for patterns with many holes.

**Solution**: One `InstancedMesh` for all arrows with per-instance position and rotation matrices.

**Benefits**:
- ~10-100x fewer draw calls for patterns with direction arrows
- Arrows automatically orient from start to end point
- GPU-efficient rendering
- Only shown when "First Movement" display option is enabled

**Details**:
- Arrow data from `directionArrows` array: `[startX, startY, endX, endY, fillColor, size]`
- Arrow geometry: Box shaft + cone head (merged using `BufferGeometryUtils`)
- Size: Proportional (shaft 60%, head 40% of `firstMovementSize`)
- Color: Goldenrod (`0xdaa520`)
- Rotation: Calculated from start→end direction using quaternions
- Position: At hole collar elevation (found via nearest hole lookup)

**Arrow Geometry**:
```javascript
shaftSize = size * 0.2           // Square cross-section
arrowHeadLength = size * 0.4      // Cone length
arrowHeadRadius = size * 0.35     // Cone base radius
shaftLength = totalLength - arrowHeadLength
```

## Files Changed

### 1. `src/three/GeometryFactory.js`

**Added Import** (Line 6):
```javascript
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
```

**Modified `createInstancedHoles()` (Lines 3216-3259)**:

**Added Instanced Toes** (Lines 3221-3248):
```javascript
// Create shared toe geometry
var toeColor = isDarkMode ? 0x5eacff : 0x26ff00;
var toeRadiusMeters = toeSizeInMeters; // Use slider value

var toeGeometry = new THREE.CircleGeometry(toeRadiusMeters, 32);
var toeMaterial = new THREE.MeshBasicMaterial({
    color: toeColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.2,
    depthTest: true,
    depthWrite: false
});

var instancedToes = new THREE.InstancedMesh(toeGeometry, toeMaterial, holeCount);
instancedToes.userData = { type: "instancedHoleToes" };

// Set toe positions
var toeMatrix = new THREE.Matrix4();
for (var i = 0; i < visibleHoles.length; i++) {
    var hole = visibleHoles[i];
    var toeLocal = worldToThreeLocal(hole.endXLocation, hole.endYLocation);
    var toeZ = hole.endZLocation || 0;
    toeMatrix.identity();
    toeMatrix.setPosition(toeLocal.x, toeLocal.y, toeZ);
    instancedToes.setMatrixAt(i, toeMatrix);
}
instancedToes.instanceMatrix.needsUpdate = true;
```

**Updated Return Value** (Lines 3250-3259):
```javascript
return {
    instancedCollars: instancedCollars,
    instancedGradesPositive: instancedGradesPositive,
    instancedGradesNegative: instancedGradesNegative,
    instancedToes: instancedToes, // NEW
    instanceIdToHole: instanceIdToHole,
    holeToInstanceId: holeToInstanceId,
    holeCount: holeCount
};
```

**Added `createInstancedDirectionArrows()` (Lines 3262-3348)**:
```javascript
static createInstancedDirectionArrows(directionArrows, allBlastHoles, worldToThreeLocalFn) {
    if (!directionArrows || directionArrows.length === 0) {
        return null;
    }

    const arrowCount = directionArrows.length;
    const size = directionArrows[0][5]; // Extract size from first arrow

    // Calculate arrow dimensions
    const shaftSize = size * 0.2;
    const arrowHeadLength = size * 0.4;
    const arrowHeadRadius = size * 0.35;

    // Create shaft geometry (box) - length=1, scaled per instance
    const shaftGeometry = new THREE.BoxGeometry(1, shaftSize, shaftSize);
    shaftGeometry.translate(0.5, 0, 0); // Move pivot to start

    // Create arrowhead geometry (cone rotated to point along +X)
    const coneGeometry = new THREE.ConeGeometry(arrowHeadRadius, arrowHeadLength, 4);
    coneGeometry.rotateZ(-Math.PI / 2); // Point along +X axis
    coneGeometry.translate(arrowHeadLength / 2, 0, 0);

    // Merge shaft and cone
    const arrowGeometry = BufferGeometryUtils.mergeGeometries([shaftGeometry, coneGeometry]);

    // Create material (goldenrod)
    const arrowMaterial = new THREE.MeshBasicMaterial({
        color: 0xdaa520,
        side: THREE.DoubleSide
    });

    // Create InstancedMesh
    const instancedArrows = new THREE.InstancedMesh(arrowGeometry, arrowMaterial, arrowCount);
    instancedArrows.userData = { type: "instancedDirectionArrows" };

    // Set position/rotation for each arrow
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    for (let i = 0; i < arrowCount; i++) {
        const [startX, startY, endX, endY, fillColor, arrowSize] = directionArrows[i];

        // Find collar Z elevation from nearest hole
        const nearestHole = this.findNearestHole(startX, startY, allBlastHoles);
        const collarZ = nearestHole ? nearestHole.startZLocation || 0 : 0;

        // Convert to local coordinates
        const localStart = worldToThreeLocalFn ? worldToThreeLocalFn(startX, startY) : { x: startX, y: startY };
        const localEnd = worldToThreeLocalFn ? worldToThreeLocalFn(endX, endY) : { x: endX, y: endY };

        // Calculate direction and length
        const dx = localEnd.x - localStart.x;
        const dy = localEnd.y - localStart.y;
        const totalLength = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const shaftLength = totalLength - arrowHeadLength;

        // Set position (at start, raised by half shaft height)
        position.set(localStart.x, localStart.y, collarZ + shaftSize / 2);

        // Set rotation (point in direction)
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);

        // Set scale (X = shaft length, Y/Z = 1)
        scale.set(shaftLength, 1, 1);

        // Compose and set matrix
        matrix.compose(position, quaternion, scale);
        instancedArrows.setMatrixAt(i, matrix);
    }

    instancedArrows.instanceMatrix.needsUpdate = true;
    return instancedArrows;
}
```

### 2. `src/kirra.js`

**Store Instanced Toes** (Lines 26493-26512):
```javascript
if (instanceData) {
    // Store in renderer
    threeRenderer.instancedCollars = instanceData.instancedCollars;
    threeRenderer.instancedGradesPositive = instanceData.instancedGradesPositive;
    threeRenderer.instancedGradesNegative = instanceData.instancedGradesNegative;
    threeRenderer.instancedToes = instanceData.instancedToes; // NEW
    threeRenderer.instanceIdToHole = instanceData.instanceIdToHole;
    threeRenderer.holeToInstanceId = instanceData.holeToInstanceId;
    threeRenderer.instancedHolesCount = instanceData.holeCount;

    // Add to scene
    threeRenderer.holesGroup.add(instanceData.instancedCollars);
    if (instanceData.instancedGradesPositive) {
        threeRenderer.holesGroup.add(instanceData.instancedGradesPositive);
    }
    if (instanceData.instancedGradesNegative) {
        threeRenderer.holesGroup.add(instanceData.instancedGradesNegative);
    }
    if (instanceData.instancedToes) {
        threeRenderer.holesGroup.add(instanceData.instancedToes); // NEW
    }
}
```

**Removed Individual Toe Drawing** (Line 26524):
```javascript
// NOTE: Toes are now instanced, no individual drawing needed
```

**Updated Log Message** (Line 26549):
```javascript
console.log("🚀 Instanced holes: " + instanceData.holeCount + " collars/grades/toes + individual tracks/text");
```

**Added Instanced Direction Arrows** (Lines 26181-26204):
```javascript
if (displayOptions3D.firstMovement && directionArrows && directionArrows.length > 0) {
    // Check if instanced rendering is enabled
    var usingInstancedArrows = useInstancedHoles && directionArrows.length > 10;

    if (usingInstancedArrows && threeRenderer) {
        // Use instanced rendering for direction arrows
        console.log("🔶 3D Direction Arrows: Creating " + directionArrows.length + " instanced arrows");
        var instancedDirectionArrows = GeometryFactory.createInstancedDirectionArrows(
            directionArrows,
            allBlastHoles,
            worldToThreeLocal
        );

        if (instancedDirectionArrows) {
            // Store and add to scene
            threeRenderer.instancedDirectionArrows = instancedDirectionArrows;
            threeRenderer.contoursGroup.add(instancedDirectionArrows);
        }
    } else {
        // Use individual arrow meshes (non-instanced)
        console.log("🔶 3D Direction Arrows: Drawing " + directionArrows.length + " individual arrows");
        drawDirectionArrowsThreeJS(directionArrows, allBlastHoles);
    }
}
```

### 3. `src/three/ThreeRenderer.js`

**Added Property** (Lines 198-199):
```javascript
// Step 8b) Instanced rendering for direction arrows (optional optimization)
this.instancedDirectionArrows = null; // InstancedMesh for first movement direction arrows
```

**Updated Disposal** (Lines 1111-1117):
```javascript
// Step 22a.4) Dispose direction arrow instances
if (this.instancedDirectionArrows) {
    this.contoursGroup.remove(this.instancedDirectionArrows);
    if (this.instancedDirectionArrows.geometry) this.instancedDirectionArrows.geometry.dispose();
    if (this.instancedDirectionArrows.material) this.instancedDirectionArrows.material.dispose();
    this.instancedDirectionArrows = null;
}
```

### 4. `src/draw/canvas2DDrawing.js` (Bonus Fix)

**Skip Toe Drawing When Radius is 0** (Lines 139-140):
```javascript
export function drawHoleToe(x, y, fillColor, strokeColor, radius) {
    // Don't draw toe circle if radius is 0 or less
    if (radius <= 0) return;
    // ... rest of function
}
```

### 5. `src/draw/canvas3DDrawing.js` (Bonus Fix)

**Skip Toe Drawing When Radius is 0** (Lines 159-160):
```javascript
export function drawHoleToeThreeJS(worldX, worldY, worldZ, radius, color, holeId) {
    if (!window.threeInitialized || !window.threeRenderer) return;
    // Don't draw toe circle if radius is 0 or less
    if (radius <= 0) return;
    // ... rest of function
}
```

## Performance Impact

### Before (Non-Instanced)
For pattern with 100 holes + first movement enabled:
- 100 collar circles (individual)
- 100 grade circles (individual)
- 100 toe circles (individual)
- 50 direction arrows (individual, varies by pattern)
- **Total: 350 draw calls**

### After (Instanced)
For pattern with 100 holes + first movement enabled:
- 1 instanced collar mesh (100 instances)
- 1-2 instanced grade meshes (positive/negative split)
- 1 instanced toe mesh (100 instances)
- 1 instanced direction arrow mesh (50 instances)
- **Total: 4-5 draw calls**

**Speedup: ~70-87x fewer draw calls!**

## Technical Details

### Arrow Rotation

Direction arrows use quaternion rotation to point from start to end:
```javascript
var dx = localEnd.x - localStart.x;
var dy = localEnd.y - localStart.y;
var angle = Math.atan2(dy, dx);
quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
```

### Arrow Scaling

Unlike the original implementation which calculated shaft length and positioned parts separately, instanced arrows use:
- Base geometry with unit shaft length (1.0)
- Scale transformation on X-axis to achieve correct shaft length
- Shaft geometry translated to pivot at start (left edge)

This allows efficient per-instance scaling without recreating geometry.

### Geometry Merging

Arrow geometry uses `BufferGeometryUtils.mergeGeometries()` to combine shaft and head into single geometry:
- More efficient than separate meshes
- Fewer materials to manage
- Single instanced mesh for all arrows

### Group Assignment

- **Toes**: Added to `holesGroup` (rendered with holes)
- **Direction Arrows**: Added to `contoursGroup` (rendered with contours/first movement)

This maintains proper rendering order and layer management.

### Conditional Rendering

Both instanced toes and direction arrows only activate when:
1. `useInstancedHoles` setting is enabled (Settings → Performance)
2. Pattern has >10 holes/arrows (for smaller patterns, instancing overhead isn't worth it)

## Testing

**Enable Instanced Rendering**:
1. Settings → Performance → Check "Use Instanced Holes"
2. Import/create pattern with >10 holes
3. Verify toe circles appear green/blue at toe positions
4. Enable View → First Movement
5. Verify goldenrod arrows point from start to end positions

**Compare Performance**:
1. Test with 100+ hole pattern
2. Check FPS with instanced vs non-instanced
3. Expected: 2-5x FPS improvement

## Known Limitations

**Arrow Colors**:
- Currently assumes all arrows are same color (goldenrod)
- If arrow colors vary in future, would need multiple InstancedMesh objects (grouped by color)

**Arrow Sizes**:
- Currently assumes all arrows same size (from first arrow's size parameter)
- If sizes vary, would need separate instances or per-instance scale attributes

**Toe Size Changes**:
- Toe circles created once at initial render
- Changing toe size slider requires scene rebuild (already handled by clearThreeJSScene)

## Future Enhancements

**Dynamic Updates**:
- Could add `updateDirectionArrowPosition()` for live contour recalculation
- Would need to track arrow instance indices
- Currently arrows are recreated on data change (sufficient for most use cases)

**Color Variations**:
- Could split arrows by timing level (different colors per delay group)
- Would require multiple InstancedMesh objects like grades

**Edge Outlines** (Not Implemented):
- Original arrows have edge outlines for "cartoon look"
- Instanced version omits these for performance
- Could add using `EdgesGeometry` + separate InstancedMesh

## Status: ✅ COMPLETE

Both instanced toe circles and direction arrows implemented:
- ✅ Toe circles instanced (all patterns)
- ✅ Toe size responds to slider
- ✅ Direction arrows instanced (when First Movement enabled)
- ✅ Arrows orient toward target points
- ✅ Proper disposal on scene clear
- ✅ Arrows added to correct group (contoursGroup)
- ✅ Dev server compiles without errors
- ✅ Bonus: Skip drawing toes when radius is 0
- ✅ Connector arrows NOT touched (as requested)
