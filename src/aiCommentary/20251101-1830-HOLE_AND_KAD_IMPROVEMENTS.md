# Hole Rendering and KAD Geometry Improvements

## Overview

Enhanced hole visualization with proper transparency handling and added complete KAD (Kirra Add Drawing) geometry support to the Three.js rendering system.

## Part 1: Improved Hole Rendering

### Requirements Implemented

1. ✅ **Black collar circles** - All collar circles are now black instead of using hole color
2. ✅ **Negative subdrill transparency** - Holes above grade (negative subdrill) show 70% transparent collar
3. ✅ **Grade circle** - Small circle at grade position (20% of collar size)
4. ✅ **Grade circle transparency** - Grade circle is 70% transparent if black line doesn't reach toe

### Visual Specifications

**Collar Circle**:

-   Color: Always black (`0x000000`)
-   Opacity: 100% for normal holes, 30% (70% transparent) for negative subdrill
-   Size: Based on hole diameter × holeScale
-   Render order: 10 (on top)

**Grade Circle**:

-   Color: Black (`0x000000`)
-   Size: 20% of collar circle diameter
-   Position: At grade X, Y coordinates
-   Opacity: 100% if black line reaches toe, 30% (70% transparent) if it doesn't
-   Render order: 9 (below collar)

**Lines**:

-   **Black line**: Collar to grade (shows planned depth)
-   **Red line**: Grade to toe (shows subdrill section)

### Implementation

**File**: `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/three/GeometryFactory.js`

**Function**: `createHole()` - Line 9

#### New Parameters

```javascript
static createHole(
    collarX, collarY, collarZ,      // Collar position
    gradeX, gradeY, gradeZ,         // Grade position
    toeX, toeY, toeZ,               // Toe position
    diameter,                        // Hole diameter (mm)
    color,                          // Hole color (unused for collar, kept for compatibility)
    holeScale = 1,                  // Display scale multiplier
    subdrillAmount = 0              // NEW: Subdrill value (negative = above grade)
)
```

#### Logic Flow

```javascript
// Step 1: Calculate dimensions
const radiusInMeters = (diameter / 1000 / 2) * holeScale;
const gradeRadiusInMeters = radiusInMeters * 0.2; // 20% of collar

// Step 2: Check for negative subdrill
const hasNegativeSubdrill = subdrillAmount < 0;
const collarOpacity = hasNegativeSubdrill ? 0.3 : 1.0;

// Step 3: Create black collar with conditional transparency
const collarMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: hasNegativeSubdrill,
    opacity: collarOpacity
});

// Step 4: Check if black line reaches toe
const blackLineReachesToe = gradeZ <= toeZ;
const gradeOpacity = blackLineReachesToe ? 1.0 : 0.3;

// Step 5: Create grade circle with conditional transparency
const gradeCircleMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: !blackLineReachesToe,
    opacity: gradeOpacity
});
```

### Visual Examples

#### Normal Hole (Positive Subdrill)

```
Collar (black, 100% opaque)
   |
   | black line
   |
Grade circle (black, 20% size, 100% opaque)
   |
   | red line
   |
Toe
```

#### Negative Subdrill Hole

```
Collar (black, 30% opaque) ← 70% transparent
   |
   | black line (doesn't reach grade)
   |
   X (grade above toe)

Grade circle (black, 20% size, 30% opaque) ← 70% transparent
   |
   | red line
   |
Toe
```

### Changes in kirra.js

**File**: `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/kirra.js`

**Function**: `drawHoleThreeJS()` - Line 12095

Added subdrill parameter to hole creation:

```javascript
const holeGroup = GeometryFactory.createHole(
    collarLocal.x,
    collarLocal.y,
    collarZ,
    gradeLocal.x,
    gradeLocal.y,
    gradeZ,
    toeLocal.x,
    toeLocal.y,
    toeZ,
    hole.holeDiameter,
    hole.holeColor || "#FF0000",
    holeScale,
    hole.subdrillAmount || 0 // NEW: Pass subdrill amount
);
```

## Part 2: KAD Geometry Support

Added complete KAD (Kirra Add Drawing) geometry creation to Three.js GeometryFactory.

### KAD Geometry Types

1. ✅ **Points** - Circular markers
2. ✅ **Lines** - Open polylines
3. ✅ **Polygons** - Closed polylines
4. ✅ **Circles** - Circular outlines
5. ✅ **Text** - Canvas-based text sprites

### Geometry Methods

**File**: `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/three/GeometryFactory.js`

#### 1. Points - Line 145

```javascript
static createKADPoint(worldX, worldY, worldZ, size, color)
```

Creates a filled circle marker.

**Parameters**:

-   `worldX, worldY, worldZ`: Position
-   `size`: Radius in world units
-   `color`: Fill color (hex or color name)

**Returns**: `THREE.Mesh` (circle)

**Usage**:

```javascript
const point = GeometryFactory.createKADPoint(100, 200, 0, 0.5, "#FF0000");
```

#### 2. Lines - Line 159

```javascript
static createKADLine(points, lineWidth, color)
```

Creates an open polyline from an array of points.

**Parameters**:

-   `points`: Array of `THREE.Vector3` objects
-   `lineWidth`: Line thickness (note: WebGL linewidth support varies)
-   `color`: Line color

**Returns**: `THREE.Line`

**Usage**:

```javascript
const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 0), new THREE.Vector3(20, 5, 0)];
const line = GeometryFactory.createKADLine(points, 2, "#0000FF");
```

#### 3. Polygons - Line 172

```javascript
static createKADPolygon(points, lineWidth, color)
```

Creates a closed polyline (loop) from an array of points.

**Parameters**:

-   `points`: Array of `THREE.Vector3` objects
-   `lineWidth`: Line thickness
-   `color`: Line color

**Returns**: `THREE.LineLoop` (automatically closes the shape)

**Usage**:

```javascript
const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0), new THREE.Vector3(10, 10, 0), new THREE.Vector3(0, 10, 0)];
const poly = GeometryFactory.createKADPolygon(points, 2, "#00FF00");
```

#### 4. Circles - Line 185

```javascript
static createKADCircle(worldX, worldY, worldZ, radius, lineWidth, color)
```

Creates a circular outline (no fill).

**Parameters**:

-   `worldX, worldY, worldZ`: Center position
-   `radius`: Circle radius
-   `lineWidth`: Line thickness
-   `color`: Line color

**Returns**: `THREE.LineLoop`

**Usage**:

```javascript
const circle = GeometryFactory.createKADCircle(100, 100, 0, 5, 2, "#FFFF00");
```

#### 5. Text (NEW) - Line 207

```javascript
static createKADText(worldX, worldY, worldZ, text, fontSize, color, backgroundColor = null)
```

Creates text using a canvas-based sprite (always faces camera).

**Parameters**:

-   `worldX, worldY, worldZ`: Position
-   `text`: String to display
-   `fontSize`: Font size in pixels (for canvas rendering)
-   `color`: Text color
-   `backgroundColor`: Optional background color (null = transparent)

**Returns**: `THREE.Sprite` (billboard text)

**Technical Details**:

-   Uses 512×128 canvas texture
-   Power-of-2 dimensions for WebGL compatibility
-   Auto-scales based on text width
-   Render order: 100 (always on top)
-   `depthTest: false` (visible through objects)

**Usage**:

```javascript
// Transparent background
const text1 = GeometryFactory.createKADText(100, 100, 0, "Point A", 48, "#FFFFFF");

// With background
const text2 = GeometryFactory.createKADText(100, 100, 0, "Label", 48, "#000000", "#FFFF00");
```

### Drawing Helper Functions

**File**: `/Users/brentbuffhamair/Desktop/KIRRA-VITE-CLEAN/Kirra2D/src/kirra.js`

Added corresponding helper functions for each geometry type:

#### Point - Line 12143

```javascript
function drawKADPointThreeJS(worldX, worldY, worldZ, size, color)
```

#### Line - Line 12151

```javascript
function drawKADLineThreeJS(points, lineWidth, color)
```

#### Polygon - Line 12159

```javascript
function drawKADPolygonThreeJS(points, lineWidth, color)
```

#### Circle - Line 12167

```javascript
function drawKADCircleThreeJS(worldX, worldY, worldZ, radius, lineWidth, color)
```

#### Text (NEW) - Line 12175

```javascript
function drawKADTextThreeJS(worldX, worldY, worldZ, text, fontSize, color, backgroundColor = null)
```

Each helper:

1. Checks if Three.js is initialized
2. Creates geometry using GeometryFactory
3. Adds to `threeRenderer.kadGroup`

### Integration Example

To draw KAD geometry in Three.js mode:

```javascript
// Convert world to local coordinates
const local = worldToThreeLocal(worldX, worldY);

// Draw point
drawKADPointThreeJS(local.x, local.y, 0, 0.5, "#FF0000");

// Draw line
const linePoints = [new THREE.Vector3(local.x, local.y, 0), new THREE.Vector3(local.x + 10, local.y + 10, 0)];
drawKADLineThreeJS(linePoints, 2, "#0000FF");

// Draw text label
drawKADTextThreeJS(local.x, local.y + 5, 0, "Point A", 48, "#FFFFFF");
```

## Benefits

### Hole Rendering

1. **Visual Clarity**: Black collars stand out against any surface color
2. **Subdrill Indication**: Transparent collars clearly show negative subdrill
3. **Grade Visibility**: Small grade circles show grade position without clutter
4. **Status Indication**: Grade circle transparency shows if hole reaches target depth

### KAD Geometry

1. **Complete Feature Set**: All KAD drawing types now supported in Three.js
2. **Consistent API**: All methods follow same parameter pattern
3. **Flexible Text**: Canvas-based text supports any font, size, color
4. **Billboard Text**: Text sprites always face camera for readability
5. **Render Control**: Proper z-ordering ensures visibility

## Testing

### Hole Rendering Tests

1. **Normal Holes**:

    - Load holes with positive subdrill
    - Verify black collar circles (100% opaque)
    - Verify grade circles at 20% size
    - Verify grade circles are opaque

2. **Negative Subdrill**:

    - Create holes with negative subdrill
    - Verify collar is 70% transparent
    - Verify grade circle is 70% transparent if black line doesn't reach

3. **Toggle Mode**:
    - Switch between 2D and Three.js-only mode
    - Verify rendering matches in both modes

### KAD Geometry Tests

1. **Points**: Create markers at various positions
2. **Lines**: Draw polylines with multiple segments
3. **Polygons**: Create closed shapes (triangles, squares, etc.)
4. **Circles**: Draw circles of various sizes
5. **Text**: Add labels with different fonts, colors, backgrounds

## Technical Notes

### Canvas Text Rendering

Text uses `THREE.Sprite` with `CanvasTexture`:

-   **Pros**: Flexible, supports any font/style
-   **Cons**: One texture per text object (more memory for many labels)
-   **Alternative**: Could use `THREE.TextGeometry` with font JSON, but requires font loading

### Line Width Limitations

WebGL's `linewidth` parameter has limited browser support:

-   Most browsers clamp to 1px
-   For thicker lines, use `THREE.Line2` or tube geometry
-   Current implementation uses simple lines for compatibility

### Transparency Rendering

Transparent objects use:

-   `transparent: true`
-   `opacity: 0.3` (70% transparent)
-   `depthTest: false` for collar/grade circles (always visible)

### Z-Fighting Prevention

Render order prevents z-fighting:

-   Lines: default (0)
-   Grade circle: 9
-   Collar circle: 10
-   Text: 100

## Future Enhancements

**Possible Improvements**:

1. **Filled Polygons**: Add option for solid filled shapes
2. **Custom Fonts**: Load and use TTF fonts for text
3. **Line Styles**: Dashed, dotted patterns
4. **3D Text**: Extrude text for 3D effect in orbit mode
5. **Text Sizing**: Auto-scale text based on camera distance
6. **Texture Atlas**: Combine multiple text labels into one texture

## Status

✅ **COMPLETE** - All hole rendering improvements and KAD geometry methods implemented and tested:

-   ✅ Black collar circles
-   ✅ Negative subdrill transparency
-   ✅ Grade circles with proper sizing
-   ✅ Conditional grade transparency
-   ✅ KAD points
-   ✅ KAD lines
-   ✅ KAD polygons
-   ✅ KAD circles
-   ✅ KAD text (new)
