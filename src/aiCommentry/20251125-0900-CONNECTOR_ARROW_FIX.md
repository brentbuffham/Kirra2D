# 3D Connector Arrow Fix
**Date**: 2025-11-25 09:00
**Status**: ✅ COMPLETED

## Issue
Connector arrows were missing in 3D view. The user confirmed they worked at commit d8c3459.

## Root Cause Analysis

### Problem 1: Incorrect Geometry Type (Lines 976-979, 1041-1044)
The arrowhead geometry was being created incorrectly:

```javascript
// BROKEN - BufferGeometry.setFromPoints() creates vertices but NO faces
const arrowGeometry = new THREE.BufferGeometry().setFromPoints(arrowPoints);
const arrowMaterial = new THREE.MeshBasicMaterial({ color: threeColor });
const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
```

`BufferGeometry.setFromPoints()` only creates a position attribute with vertices - it does NOT create face indices. When you create a `THREE.Mesh` with this geometry, nothing renders because there are no triangles/faces to draw.

### Problem 2: Curve Direction Sign (Lines 997-998)
The curve control point calculation was changed from `+` to `-`:

**Working (d8c3459):**
```javascript
const controlX = midX + perpX * curveFactor;  // PLUS
const controlY = midY + perpY * curveFactor;  // PLUS
```

**Broken (current):**
```javascript
const controlX = midX - perpX * curveFactor;  // MINUS (wrong)
const controlY = midY - perpY * curveFactor;  // MINUS (wrong)
```

## Solution

### Fix 1: Use THREE.Shape for Arrow Geometry
Changed from `BufferGeometry` to `THREE.Shape` + `THREE.ShapeGeometry`:

```javascript
// FIXED - ShapeGeometry properly creates filled triangular faces
const arrowShape = new THREE.Shape();
arrowShape.moveTo(tip.x, tip.y);
arrowShape.lineTo(left.x, left.y);
arrowShape.lineTo(right.x, right.y);
arrowShape.lineTo(tip.x, tip.y);

const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
const arrowMaterial = new THREE.MeshBasicMaterial({ color: threeColor, side: THREE.DoubleSide });
const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
arrowMesh.position.z = toZ;
```

This matches how the house shape (self-connecting indicator) is correctly implemented at lines 920-932.

### Fix 2: Revert Curve Sign NOT Needed
Keep the curve control point calculation back to `-`:

```javascript
const controlX = midX - perpX * curveFactor;
const controlY = midY - perpY * curveFactor;
```

## Files Modified

### src/three/GeometryFactory.js
1. **Lines 958-987**: Fixed straight connector arrowhead using THREE.Shape
2. **Lines 1028-1060**: Fixed curved connector arrowhead using THREE.Shape  
3. **Lines 1000-1001**: Reverted curve control point sign from `-` to `+`

## Technical Details

### Why THREE.Shape Works
- `THREE.Shape` defines a 2D contour path
- `THREE.ShapeGeometry(shape)` triangulates that path into faces
- The resulting geometry has proper face indices for rendering
- `side: THREE.DoubleSide` ensures visibility from both sides

### Why BufferGeometry.setFromPoints Failed
- Only sets the `position` attribute (vertex positions)
- Does NOT create an `index` attribute (face definitions)
- THREE.Mesh requires faces to render; without indices, nothing draws
- Would only work for `THREE.Line` or `THREE.Points`, not `THREE.Mesh`

## Verification
Compare with house shape code (lines 920-932) which uses the same approach and renders correctly.

