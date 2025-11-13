# Segment-Based 3D Lines and Polygons - Matching 2D Data Model

## Problem

3D KAD lines and polygons were rendering as single continuous geometries with ONE lineWidth and ONE color applied to the entire entity. This didn't match the 2D canvas behavior or the underlying data model, where **each point has its own lineWidth and color attributes**.

**Issue**: Each segment should be able to have different visual attributes based on its starting point's properties, matching the 2D canvas rendering behavior.

## Solution

Changed 3D line and polygon rendering to draw **segment-by-segment**, exactly matching the 2D canvas approach where each segment is drawn individually with its own attributes.

### Changes Made

#### 1. GeometryFactory.js (Lines 277-314)

**Replaced** multi-point `createKADLine()` and `createKADPolygon()` with segment-based functions:

**Before**:
```javascript
// Created entire line/polygon from array of points
static createKADLine(points, lineWidth, color) {
    const vector3Points = points.map(...);
    // One geometry for all segments
}
```

**After**:
```javascript
// Step 10) Create KAD line segment (single segment between two points)
// Matches 2D canvas drawKADLines() - each segment has its own lineWidth and color
static createKADLineSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color) {
    // Step 10a) Create two-point line
    const points = [
        new THREE.Vector3(startX, startY, startZ),
        new THREE.Vector3(endX, endY, endZ)
    ];
    
    // Step 10b) Create MeshLine material with proper lineWidth
    const material = new MeshLineMaterial({
        color: new THREE.Color(color),
        lineWidth: lineWidth || 3,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        sizeAttenuation: 0,
        opacity: 1.0,
    });
    // ... rest of implementation
}

// Step 11) Create KAD polygon segment (single segment between two points)
// Matches 2D canvas drawKADPolys() - each segment has its own lineWidth and color
static createKADPolygonSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color) {
    // Same as line segment - polygon is just a closed series of segments
    return GeometryFactory.createKADLineSegment(...);
}
```

#### 2. canvas3DDrawing.js (Lines 207-235)

**Updated** drawing functions to accept segment parameters:

**Before**:
```javascript
export function drawKADLineThreeJS(points, lineWidth, color, kadId) {
    const lineMesh = GeometryFactory.createKADLine(points, lineWidth, color);
    // ...
}
```

**After**:
```javascript
// Step 8) Draw KAD line segment in Three.js
// Matches 2D drawKADLines() - draws a single segment with its own attributes
export function drawKADLineSegmentThreeJS(startX, startY, startZ, endX, endY, endZ, lineWidth, color, kadId) {
    const lineMesh = GeometryFactory.createKADLineSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color);
    // ...
}

// Step 9) Draw KAD polygon segment in Three.js
// Matches 2D drawKADPolys() - draws a single segment with its own attributes
export function drawKADPolygonSegmentThreeJS(startX, startY, startZ, endX, endY, endZ, lineWidth, color, kadId) {
    const polyMesh = GeometryFactory.createKADPolygonSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color);
    // ...
}
```

#### 3. kirra.js (Lines 18579-18616 and 18798-18835)

**Updated** calling code to loop through segments (matching 2D canvas pattern from lines 18104-18124):

**Before**:
```javascript
else if (entity.entityType === "line") {
    const visiblePoints = entity.data.filter(...);
    const points = visiblePoints.map(...); // All points
    const lineWidth = visiblePoints[0]?.lineWidth || 1; // ONE width
    const color = visiblePoints[0]?.color || "#FF0000"; // ONE color
    drawKADLineThreeJS(points, lineWidth, color, entity.entityName);
}
```

**After**:
```javascript
else if (entity.entityType === "line" || entity.entityType === "poly") {
    // Step 7) Lines and Polygons: Draw segment-by-segment (matches 2D canvas behavior)
    // Each segment gets its own lineWidth and color from point data
    const visiblePoints = entity.data.filter((point) => point.visible !== false);
    
    if (visiblePoints.length >= 2) {
        // Step 7a) Draw segments between consecutive points
        for (let i = 0; i < visiblePoints.length - 1; i++) {
            const currentPoint = visiblePoints[i];
            const nextPoint = visiblePoints[i + 1];
            
            const currentLocal = worldToThreeLocal(currentPoint.pointXLocation, currentPoint.pointYLocation);
            const nextLocal = worldToThreeLocal(nextPoint.pointXLocation, nextPoint.pointYLocation);
            
            const lineWidth = currentPoint.lineWidth || 1; // EACH segment's width
            const color = currentPoint.color || "#FF0000"; // EACH segment's color
            
            if (entity.entityType === "line") {
                drawKADLineSegmentThreeJS(currentLocal.x, currentLocal.y, currentPoint.pointZLocation || 0,
                    nextLocal.x, nextLocal.y, nextPoint.pointZLocation || 0,
                    lineWidth, color, entity.entityName);
            } else {
                drawKADPolygonSegmentThreeJS(currentLocal.x, currentLocal.y, currentPoint.pointZLocation || 0,
                    nextLocal.x, nextLocal.y, nextPoint.pointZLocation || 0,
                    lineWidth, color, entity.entityName);
            }
        }
        
        // Step 7b) For polygons, close the loop with final segment
        if (entity.entityType === "poly" && visiblePoints.length > 2) {
            const firstPoint = visiblePoints[0];
            const lastPoint = visiblePoints[visiblePoints.length - 1];
            
            const firstLocal = worldToThreeLocal(firstPoint.pointXLocation, firstPoint.pointYLocation);
            const lastLocal = worldToThreeLocal(lastPoint.pointXLocation, lastPoint.pointYLocation);
            
            const lineWidth = lastPoint.lineWidth || 1;
            const color = lastPoint.color || "#FF0000";
            
            drawKADPolygonSegmentThreeJS(lastLocal.x, lastLocal.y, lastPoint.pointZLocation || 0,
                firstLocal.x, firstLocal.y, firstPoint.pointZLocation || 0,
                lineWidth, color, entity.entityName);
        }
    }
}
```

## Data Model Consistency

### Point Data Structure
Each point in `entity.data` has:
```javascript
{
    pointXLocation: number,
    pointYLocation: number,
    pointZLocation: number,
    lineWidth: number,    // ← Segment attribute
    color: string,        // ← Segment attribute
    visible: boolean
}
```

### Rendering Flow

**2D Canvas** (canvas2DDrawing.js, lines 18104-18124):
```javascript
for (let i = 0; i < visiblePoints.length - 1; i++) {
    const currentPoint = visiblePoints[i];
    const nextPoint = visiblePoints[i + 1];
    drawKADPolys(sx, sy, ex, ey, 
        currentPoint.pointZLocation, nextPoint.pointZLocation,
        currentPoint.lineWidth,  // ← From current point
        currentPoint.color,      // ← From current point
        false);
}
```

**3D ThreeJS** (now matches 2D):
```javascript
for (let i = 0; i < visiblePoints.length - 1; i++) {
    const currentPoint = visiblePoints[i];
    const nextPoint = visiblePoints[i + 1];
    drawKADLineSegmentThreeJS(
        currentLocal.x, currentLocal.y, currentPoint.pointZLocation,
        nextLocal.x, nextLocal.y, nextPoint.pointZLocation,
        currentPoint.lineWidth,  // ← From current point
        currentPoint.color,      // ← From current point
        entity.entityName);
}
```

## Benefits

1. **Data Model Consistency**: 3D rendering now respects per-segment attributes
2. **2D/3D Parity**: Both rendering modes behave identically
3. **Visual Flexibility**: Each segment can have different color/width for data visualization
4. **Code Clarity**: Segment-based approach is more intuitive and matches canvas API

## Comparison with createLine.js

The existing `createLine.js` (lines 1-35) already uses a segment-based approach:
```javascript
export function createLine(start, end, color, lineWidth, ...) {
    const points = [start, end]; // Two points only
    // ...
}
```

The new `createKADLineSegment()` follows this same pattern, ensuring consistency across the codebase.

## Related Documentation

- `KAD_CIRCLE_PRECISION_FIX.md` - Similar fix for circle precision
- `LOCAL_COORDINATES_FIX.md` - Local coordinate system for UTM precision
- `canvas2DDrawing.js` (lines 246-265) - 2D segment drawing functions

