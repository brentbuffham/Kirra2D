# Coordinate System

## Overview

Kirra uses a right-handed 3D coordinate system with conventions common in mining and surveying. Understanding these conventions is critical for accurate data import, pattern generation, and coordinate transformations.

## World Coordinate System

### Axis Definitions

**X-axis (Easting)**:
- Positive X = East
- Negative X = West
- Measured in meters

**Y-axis (Northing)**:
- Positive Y = North
- Negative Y = South
- Measured in meters

**Z-axis (Elevation)**:
- Positive Z = Up (higher elevation)
- Negative Z = Down (lower elevation)
- Measured in meters above reference datum (e.g., sea level)

### Typical Coordinate Range

**UTM Coordinates** (most common):
- X (Easting): 200,000 - 800,000 meters
- Y (Northing): 1,000,000 - 10,000,000 meters
- Z (Elevation): -100 to 5,000 meters (varies by site)

**Local/Mine Grid**:
- X, Y, Z: Can be any range, often centered at (0,0) or offset to positive values
- Kirra handles large coordinate values (UTM) and local grids transparently

## Angle Conventions

### Hole Angle (from Vertical)

**Definition**: Deviation from vertical axis

```
      │ Z-axis (Up)
      │
      │     ○ Hole at Angle
      │    ↙︎ θ
      │  ↙︎
      │↙︎
     ┼────────→ Horizontal
```

**Range**: 0° to 90°
- **0°** = Vertical hole (straight down)
- **45°** = 45° from vertical
- **90°** = Horizontal hole

**Relationship to Dip** (Mast Angle):
```
Dip = 90° - Angle
```
- Vertical hole: Angle = 0°, Dip = 90°
- Horizontal hole: Angle = 90°, Dip = 0°

**⚠️ Software Variations**:
- **Kirra**: Angle from vertical (0° = vertical)
- **Surpac**: -90° = vertical down, 0° = horizontal
- **Some systems**: Use dip (90° = vertical, 0° = horizontal)

Always verify angle conventions when importing/exporting data.

### Hole Bearing (Compass Direction)

**Definition**: Horizontal direction of hole projection

```
         N (0°)
         │
         │
W (270°) ┼─────→ E (90°)
         │
         │
        S (180°)
```

**Range**: 0° to 359.99°
- **0°** = North
- **90°** = East
- **180°** = South
- **270°** = West

**Clockwise Rotation**: Bearing increases clockwise from North

**Examples**:
- Bearing 45° = Northeast
- Bearing 135° = Southeast
- Bearing 225° = Southwest
- Bearing 315° = Northwest

### Combined Angle and Bearing

A hole with **Angle = 30°** and **Bearing = 45°** is:
- Tilted 30° from vertical
- Angled toward the Northeast

## Canvas Coordinate System (2D View)

### Canvas Axes

In Kirra's 2D canvas view:
- **Positive X** (Right) = East
- **Negative X** (Left) = West
- **Positive Y** (Up) = North
- **Negative Y** (Down) = South

**Note**: Canvas Y-axis is inverted from typical screen coordinates:
- Screen: Y+ = Down
- Kirra Canvas: Y+ = North (Up)

### Coordinate Transformation (2D)

Kirra uses a **centroid-based transformation** for 2D rendering:

1. **Calculate Centroid**:
```javascript
centroidX = (minX + maxX) / 2
centroidY = (minY + maxY) / 2
```

2. **Transform to Canvas**:
```javascript
canvasX = (worldX - centroidX) * scale + canvasWidth/2
canvasY = -(worldY - centroidY) * scale + canvasHeight/2  // Note: Y inverted
```

3. **Transform from Canvas**:
```javascript
worldX = (canvasX - canvasWidth/2) / scale + centroidX
worldY = -((canvasY - canvasHeight/2) / scale) + centroidY
```

**Benefits**:
- Handles large UTM coordinates without precision loss
- Centers data in viewport
- Maintains aspect ratio

## Three.js 3D Coordinate System

### Three.js Local Origin

**Problem**: Three.js has precision issues with large coordinate values (UTM).

**Solution**: Kirra uses a **local origin** for Three.js rendering:
```javascript
window.threeLocalOriginX = centroidX
window.threeLocalOriginY = centroidY
window.threeLocalOriginZ = averageZ
```

**Transformation**:
```javascript
// World to Three.js Local
localX = worldX - threeLocalOriginX
localY = worldY - threeLocalOriginY
localZ = worldZ - threeLocalOriginZ

// Three.js Local to World
worldX = localX + threeLocalOriginX
worldY = localY + threeLocalOriginY
worldZ = localZ + threeLocalOriginZ
```

**Important Rules**:
1. **Do NOT scale** 3D coordinates - use same scale as 2D
2. **Do NOT transform Z** - use actual elevation values
3. **All Three.js objects** must be positioned in local coordinates
4. **Camera orbit** is around local origin (0, 0, averageZ)

### 3D Visualization

**Camera Controls**:
- **Orbit**: Rotate around data centroid
- **Zoom**: Zoom in/out from mouse position
- **Pan**: Translate camera (default mode)

**Orbit Target**: Always at `(0, 0, dataZCentroid)` in local coordinates

## Coordinate Precision

### Display Precision

**2D Labels**: 2 decimal places (e.g., `477750.50`)
**3D Labels**: 2 decimal places
**Export**: 3 decimal places (default, configurable)

### Vertex Deduplication

When exporting surfaces (DTM/STR), Kirra deduplicates vertices using **3 decimal place precision**:
```javascript
key = x.toFixed(3) + "_" + y.toFixed(3) + "_" + z.toFixed(3)
```

This ensures:
- Consistent precision across export/import cycles
- Proper triangle connectivity
- No floating-point comparison errors

## IREDES XML X/Y Swap Warning

**⚠️ CRITICAL**: The IREDES XML format uses **X for Northing, Y for Easting** (opposite of Kirra's standard convention).

**Standard Kirra**:
- X = Easting
- Y = Northing
- Z = Elevation

**IREDES XML**:
- X = Northing (opposite!)
- Y = Easting (opposite!)
- Z = Elevation

**Kirra's Handling**:
- Automatically swaps X/Y on IREDES import
- Automatically swaps X/Y on IREDES export
- Internal storage always uses standard convention

**When to Be Careful**:
- Manually editing IREDES XML files
- Comparing IREDES data with other formats
- Debugging coordinate discrepancies
- Verifying import accuracy

**Verification Method**:
1. Import IREDES file
2. Check hole positions on canvas
3. If holes appear rotated 90°, X/Y swap may be incorrect

## Coordinate System Diagrams

### 3D World and Camera Conventions

```
         Z (Up)
         ↑
         │
         │       Y (North)
         │      ↗︎
         │    ↗︎
         │  ↗︎
         │↗︎
         ●──────────→ X (East)
       Origin

Camera:
- LookAt: Data centroid
- Orbit: Around Z-axis (vertical)
- Pan: XY plane
- Zoom: Along view vector
```

### Blast Hole Geometry

```
Collar (Start)
    ●────────────────────── Z = startZ (elevation)
    │╲ Angle (from vertical)
    │  ╲
    │    ╲ Bearing (direction)
    │      ╲
    │        ╲
    ●──────────── Z = gradeZ (floor)
Grade │          ╲
      │            ╲
      │              ╲
      ●─────────────────── Z = endZ (toe)
Subdrill         Toe (End)
```

**Vertical Calculations**:
- Bench Height = startZ - gradeZ
- Subdrill Amount = gradeZ - endZ
- Vertical Drop = startZ - endZ = Bench Height + Subdrill

**3D Vector**:
- Hole Length = √[(ΔX)² + (ΔY)² + (ΔZ)²]
- Horizontal Displacement = √[(ΔX)² + (ΔY)²]
- Angle = arccos(VerticalDrop / HoleLength)
- Bearing = atan2(ΔX, ΔY)

---

*For geometry calculations, see [Blast Attribute Calculations](Blast-Attribute-Calculations).*  
*For hole data structure, see [Blast Hole Management](Blast-Hole-Management).*
