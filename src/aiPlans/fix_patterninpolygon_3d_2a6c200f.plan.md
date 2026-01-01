---
name: Fix PatternInPolygon 3D
overview: Fix the 3D Pattern in Polygon tool to precisely replicate the 2D behavior, reusing existing factory methods and cheap drawing techniques.
todos:
  - id: phase1-mouse-leading
    content: Add leading line call to handle3DMouseMove() using drawKADLeadingLineThreeJS()
    status: completed
  - id: phase2-reuse-highlight
    content: Set window.selectedKADObject in handlePatternInPolygonClick() for polygon highlight
    status: completed
  - id: phase3-cheap-lines
    content: Replace createBatchedHighlightLines with THREE.LineDashedMaterial
    status: completed
  - id: phase4-z-coords
    content: Fix Z-coordinate to use polygon's actual Z values
    status: completed
  - id: phase5-camera-callback
    content: Add onCameraChange callback to CameraControls for label updates
    status: completed
  - id: phase6-square-pyramid
    content: Replace triangular arrow with ConeGeometry(r, h, 4) square pyramid
    status: completed
---

# Pattern in Polygon 3D Tool Fix

## Design Principles

1. **Reuse existing factory code** - `GeometryFactory.createKADPointHighlight()` for all markers
2. **Cheap leading lines** - Use `THREE.LineDashedMaterial` like `drawKADLeadingLineThreeJS()`
3. **Leverage existing selection system** - Set `window.selectedKADObject` to get polygon highlight from `highlightSelectedKADThreeJS()`

## Root Cause Analysis

| Issue | Current Code | Fix (Reuse Existing) |
|-------|-------------|---------------------|
| Polygon not highlighting | Sets local `selectedPolygon` only | Set `window.selectedKADObject` - reuse `highlightSelectedKADThreeJS()` |
| No leading line | Not called during mouse move | Call existing `drawKADLeadingLineThreeJS()` from `handle3DMouseMove()` |
| Markers | Already using `createKADPointHighlight()` | Keep as-is (correct) |
| Direction line uses fat lines | `createBatchedHighlightLines()` | Use `THREE.LineDashedMaterial` (cheap) |
| Arrow is triangular | Custom BufferGeometry | Use `THREE.ConeGeometry(r, h, 4)` |

## Existing Code to Reuse

### 1. Marker Points (Already Correct)
**File:** [`src/three/GeometryFactory.js`](src/three/GeometryFactory.js) line 2572

```javascript
// Already used in drawPatternInPolygon3DVisual():
GeometryFactory.createKADPointHighlight(x, y, z, radius, color)
```

### 2. Leading Line Pattern
**File:** [`src/draw/canvas3DDrawing.js`](src/draw/canvas3DDrawing.js) lines 1151-1197

```javascript
// Existing cheap dashed line approach:
const material = new THREE.LineDashedMaterial({
    color: new THREE.Color(lineColor),
    dashSize: 0.5,
    gapSize: 0.25,
    linewidth: 2,
});
const line = new THREE.Line(geometry, material);
line.computeLineDistances(); // Required for dashed lines
```

### 3. Polygon Highlight
**File:** [`src/draw/canvas3DDrawSelection.js`](src/draw/canvas3DDrawSelection.js) line 32

```javascript
// Existing function - automatically highlights window.selectedKADObject:
highlightSelectedKADThreeJS()
```

## Implementation Plan

### Phase 1: Enable Continuous Updates in handle3DMouseMove

**File:** [`src/kirra.js`](src/kirra.js) - Add after ruler/protractor handling (~line 2700):

```javascript
// Step 13f.11) Draw Pattern In Polygon leading line if active
if (isPatternInPolygonActive && patternStartPoint && !patternEndPoint) {
    // Reuse existing drawKADLeadingLineThreeJS for cheap dashed line
    var startZ = patternStartPoint.z || dataCentroidZ || 0;
    var mouseZ = currentMouseWorldZ || startZ;
    drawKADLeadingLineThreeJS(
        patternStartPoint.x, patternStartPoint.y, startZ,
        currentMouseWorldX, currentMouseWorldY, mouseZ,
        "rgba(0, 255, 0, 0.5)" // Green to match 2D
    );
    // Also redraw markers via the visual function
    drawPatternInPolygon3DVisual();
}
```

### Phase 2: Fix Polygon Highlighting via Existing System

**File:** [`src/kirra.js`](src/kirra.js) - In `handlePatternInPolygonClick()` line 32735:

```javascript
case 0: // Select polygon
    const clickedEntityInfo = getClickedKADEntity(worldX, worldY);
    if (clickedEntityInfo && clickedEntityInfo.entity.entityType === "poly") {
        selectedPolygon = clickedEntityInfo.entity;
        // REUSE: Set window.selectedKADObject so highlightSelectedKADThreeJS() handles highlight
        window.selectedKADObject = clickedEntityInfo;
        patternPolygonStep = 1;
        updateStatusMessage("Step 2: Click to select pattern start point");
    }
    break;
```

### Phase 3: Replace Fat Lines with Cheap Dashed Lines

**File:** [`src/kirra.js`](src/kirra.js) - In `drawPatternInPolygon3DVisual()`:

Replace lines 34280-34313 (createBatchedHighlightLines calls) with cheap dashed line:

```javascript
// Step 4a) Draw dashed line using cheap THREE.LineDashedMaterial (like drawKADLeadingLineThreeJS)
var linePoints = [
    new THREE.Vector3(sLocal.x, sLocal.y, drawZ + 0.1),
    new THREE.Vector3(eLocal.x, eLocal.y, drawZ + 0.1)
];
var lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
var lineMat = new THREE.LineDashedMaterial({
    color: 0x00ff00, // Green
    dashSize: 1.0,
    gapSize: 0.5,
    transparent: true,
    opacity: 0.7
});
var dirLine = new THREE.Line(lineGeom, lineMat);
dirLine.computeLineDistances();
window.patternTool3DGroup.add(dirLine);
```

### Phase 4: Fix Z-Coordinate Alignment

**File:** [`src/kirra.js`](src/kirra.js) - In `drawPatternInPolygon3DVisual()`:

```javascript
// Get Z from selected polygon's actual point data
var drawZ = dataCentroidZ || 0;
if (selectedPolygon && selectedPolygon.data && selectedPolygon.data.length > 0) {
    var firstPt = selectedPolygon.data[0];
    drawZ = firstPt.pointZLocation || firstPt.z || dataCentroidZ || 0;
}
drawZ += 0.5; // Slight offset above polygon
```

### Phase 5: Camera Change Callback for Label Updates

**File:** [`src/three/CameraControls.js`](src/three/CameraControls.js) - In `handleMouseMove()` after camera update:

```javascript
// Notify pattern tools to update label positions
if (this.onCameraChange) {
    this.onCameraChange();
}
```

**File:** [`src/kirra.js`](src/kirra.js) - After CameraControls initialization:

```javascript
cameraControls.onCameraChange = function() {
    if (isPatternInPolygonActive) {
        drawPatternInPolygon3DVisual(); // Updates HUD label positions via worldToScreen()
    }
};
```

### Phase 6: Square Pyramid Arrow

**File:** [`src/kirra.js`](src/kirra.js) - Replace BufferGeometry triangle with:

```javascript
// Step 5f) Create square pyramid (4 sides) perpendicular to direction line
var pyramidGeom = new THREE.ConeGeometry(1.5, 3.0, 4); // radius, height, 4 sides
var pyramidMat = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
});
var pyramid = new THREE.Mesh(pyramidGeom, pyramidMat);

// Position at midpoint offset perpendicular to line
pyramid.position.set(tipX, tipY, drawZ + 0.3);

// Rotate: ConeGeometry points up (+Y), we need it pointing along perpendicular
// First rotate 90° around X to lay flat, then rotate around Z for direction
pyramid.rotation.x = Math.PI / 2;
pyramid.rotation.z = Math.atan2(perpY, perpX);

window.patternTool3DGroup.add(pyramid);
```

## Files to Modify

| File | Changes |
|------|---------|
| [`src/kirra.js`](src/kirra.js) | `handle3DMouseMove()` - add pattern tool calls |
| [`src/kirra.js`](src/kirra.js) | `handlePatternInPolygonClick()` - set `window.selectedKADObject` |
| [`src/kirra.js`](src/kirra.js) | `drawPatternInPolygon3DVisual()` - cheap dashed lines, fix Z, square pyramid |
| [`src/three/CameraControls.js`](src/three/CameraControls.js) | Add `onCameraChange` callback |

## Testing Checklist

- [ ] Select polygon - highlights green via existing system
- [ ] Move mouse after start click - dashed leading line follows cursor
- [ ] Markers use billboarded points (same as KAD selection vertices)
- [ ] Direction line is cheap dashed (not fat lines)
- [ ] Arrow is square pyramid perpendicular to line
- [ ] Labels update position when orbiting
- [ ] Pattern generates holes correctly