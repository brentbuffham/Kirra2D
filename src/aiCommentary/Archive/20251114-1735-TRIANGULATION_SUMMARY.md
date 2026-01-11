# Triangulation Tool Summary

## Date
2025-11-14 17:35

## Overview

The triangulation tool now correctly uses Constrainautor via npm install (not CDN). The implementation matches the working reference in `for-reference-kirra.js`.

## Package Installation

✅ **Constrainautor is installed via npm**

```bash
# Verified installation
ls node_modules/@kninnug/constrainautor
# Output: Package exists with all files

# Version
package.json line 17: "@kninnug/constrainautor": "^4.0.1"
```

## Files Available

```
node_modules/@kninnug/constrainautor/lib/
├── Constrainautor.cjs        (CommonJS format)
├── Constrainautor.js         (UMD format)
├── Constrainautor.min.js     (Minified UMD)
├── Constrainautor.min.mjs    (Minified ES6 module)
└── Constrainautor.mjs        (ES6 module - used by Vite)
```

## Import Statement

**File**: `Kirra2D/src/kirra.js` (line 9)

```javascript
import Constrainautor from "@kninnug/constrainautor";
```

Vite automatically resolves this to the appropriate module format (.mjs for ES6).

## Key Functions

### 1. Basic Delaunay (No Constraints)

```javascript
function createDelaunayTriangulation(params)
```

**Location**: `kirra.js` line 8169  
**Uses**: Delaunator library  
**Output**: Triangulated surface with optional filtering

### 2. Constrained Delaunay (With Breaklines)

```javascript
async function createConstrainedDelaunayTriangulation(params)
```

**Location**: `kirra.js` line 8706  
**Uses**: Delaunator + Constrainautor  
**Output**: Triangulated surface honoring KAD line/polygon constraints

### 3. Constrainautor Implementation

```javascript
function createConstrainautorTriangulation(points, constraintSegments, options)
```

**Location**: `kirra.js` line 9050  
**Fixed**: Line 9054 - Now checks imported module instead of `window.Constrainautor`

## Triangulation Workflow

```
1. User clicks Triangulation Tool
   ↓
2. handleTriangulationAction() - validates visible data
   ↓
3. showTriangulationPopup() - user configures parameters
   ↓
4. User clicks "Create"
   ↓
5. processTriangulationFormData() - converts form to params
   ↓
6. Choose triangulation method:
   ├── useBreaklines = "yes" → createConstrainedDelaunayTriangulation()
   └── useBreaklines = "no"  → createDelaunayTriangulation()
   ↓
7. Collect vertices from:
   - Blast holes (collars, grade, toe, mLength)
   - KAD drawings (points, lines, polygons, circles)
   ↓
8. Deduplicate vertices (tolerance-based)
   ↓
9. Extract constraints from KAD lines/polygons
   ↓
10. Create Delaunay triangulation (Delaunator)
   ↓
11. Apply constraints (Constrainautor) [if useBreaklines = "yes"]
   ↓
12. Filter triangles:
    - Boundary clipping (inside/outside polygon)
    - Edge length (2D or 3D)
    - Internal angle (2D or 3D)
   ↓
13. Create surface and add to loadedSurfaces
   ↓
14. Save to database
   ↓
15. Redraw canvas (2D and 3D)
```

## Parameters

From `showTriangulationPopup()` (line 9208):

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| surfaceName | text | Surface_[timestamp] | Unique surface identifier |
| blastHolePoints | select | none | Which hole points to use |
| useBreaklines | select | yes | Include KAD lines/polygons as constraints |
| clipToBoundary | select | none | Boundary clipping mode |
| xyzTolerance | number | 0.001 | Duplicate point detection threshold |
| minInternalAngle | number | 0 | Minimum triangle angle (degrees) |
| consider3DAngle | checkbox | false | Use 3D angle calculation |
| maxEdgeLength | number | 0 | Maximum triangle edge length |
| consider3DLength | checkbox | false | Use 3D edge length |
| surfaceStyle | select | hillshade | Gradient/rendering style |

## Constraint Extraction

### How Constraints Are Created

1. **Deduplicate vertices** with tolerance (default 0.001m)
2. **Create spatial index** for efficient vertex lookup
3. **For each KAD line/polygon**:
   - Get consecutive point pairs
   - Find nearest deduplicated vertex for each point
   - Create constraint edge `[startIndex, endIndex]`
   - For polygons: add closing edge if first ≠ last
4. **Remove duplicate constraints**

### Example

```javascript
// KAD line with 3 points: A → B → C
// Creates 2 constraints: [A,B], [B,C]

// KAD polygon with 4 points: A → B → C → D (→ A)
// Creates 4 constraints: [A,B], [B,C], [C,D], [D,A]
```

## Filtering Options

### 1. Boundary Clipping

**Function**: `deleteTrianglesByClippingPolygon()`  
**Location**: line 8372

- **Outside**: Keep triangles inside polygon, delete outside
- **Inside**: Keep triangles outside polygon, delete inside
- Uses triangle centroid for inside/outside test

### 2. Edge Length Filter

**Function**: `deleteTrianglesByEdgeLength()`  
**Location**: line 8437

- Tests longest edge of each triangle
- Option for 2D (XY only) or 3D (XYZ) length
- Deletes triangles with edges longer than max

### 3. Internal Angle Filter

**Function**: `deleteTrianglesByInternalAngle()`  
**Location**: line 8515

- Tests smallest angle of each triangle
- Option for 2D (XY only) or 3D (XYZ) angles
- Deletes triangles with angles smaller than min

## Testing Steps

1. **Load project** with blast holes and/or KAD entities
2. **Ensure visibility**:
   - Blast Group visible
   - Drawings Group visible
   - Specific KAD entities visible
3. **Select constraint entities** (optional):
   - Click KAD line or polygon to use as breakline
4. **Click Triangulation Tool** (toolbar)
5. **Configure parameters**:
   - Enter unique surface name
   - Choose blast hole points (if any)
   - Choose "Include as constraints" for breaklines
   - Set boundary clipping (if polygon selected)
   - Set filtering parameters
6. **Click "Create"**
7. **Verify**:
   - Surface appears in Data Explorer
   - Surface renders in 2D and 3D
   - Constraints are honored (triangles don't cross breaklines)
   - Console shows successful constraint application

## Expected Console Output

```
🔗 Using FIXED Constrained Delaunay Triangulation (Constrainautor)
📊 Found 50 visible holes, 3 visible KAD drawings
🔄 Deduplication: 150 → 145 vertices
🔗 Extracted 12 constraints from deduplicated vertices
🔺 Starting Constrainautor with 145 points, 12 constraints
🔺 Initial Delaunay: 250 triangles
🔗 Prepared 12 valid constraint edges
🔧 Applying 12 constraints...
✅ Successfully applied 12/12 constraints
🎉 Constrainautor complete: 250 triangles
✅ CDT Success: 250 triangles created with 12 constraints applied
```

## Key Differences from Reference

The current implementation (`kirra.js`) and reference (`for-reference-kirra.js`) are now aligned:

| Feature | Reference | Current | Status |
|---------|-----------|---------|--------|
| Constrainautor import | CDN script tag | npm module | ✅ Fixed |
| Deduplication | getUniqueElementVertices() | Same | ✅ Matching |
| Spatial indexing | createSpatialIndex() | Same | ✅ Matching |
| Constraint extraction | extractConstraintsFromDeduplicatedVertices() | Same | ✅ Matching |
| Triangulation | createConstrainautorTriangulation() | Same | ✅ Fixed |
| Filtering | deleteTrianglesBy*() | Same | ✅ Matching |

## Common Issues & Solutions

### Issue: "Constrainautor library not loaded"

**Solution**: Fixed by changing line 9054 from `window.Constrainautor` to `typeof Constrainautor === "undefined"`

### Issue: "No constraints applied"

**Possible causes**:
1. No KAD lines/polygons visible
2. KAD entities not selected
3. Tolerance too small (vertices don't match)
4. Deduplication removed constraint points

**Solution**:
1. Ensure KAD entities are visible in Data Explorer
2. Increase xyzTolerance if needed
3. Check console for constraint extraction logs

### Issue: "Empty triangulation"

**Possible causes**:
1. Insufficient points (< 3)
2. All points collinear
3. Filtering removed all triangles

**Solution**:
1. Add more data points
2. Reduce filtering parameters (edge length, angle)
3. Check boundary clipping polygon

## Related Documentation

- **20251114-1700-SURFACE_2D_3D_MODE_FIX.md**: Surface rendering in 2D/3D modes
- **20251113-1630-MEMORY_LEAK_FIX.md**: Three.js disposal fix
- **20251101-1230-SURFACE_RENDERING_COMPLETE.md**: Surface rendering implementation

## Summary

✅ Constrainautor is installed via npm  
✅ Import statement is correct  
✅ Fixed `window.Constrainautor` reference  
✅ No CDN script tag needed  
✅ Vite handles bundling automatically  
✅ Implementation matches working reference  
✅ Triangulation tool ready to use

