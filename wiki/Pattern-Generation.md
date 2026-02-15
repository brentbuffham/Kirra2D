# Pattern Generation

## Overview

Kirra provides multiple methods for creating blast hole patterns, from simple rectangular grids to complex polygon-based layouts. All pattern generation tools support 3D geometry with angle, bearing, bench height, and subdrill specifications.

## Pattern Generation Methods

### 1. Add Pattern (Rectangular Grid)

**Menu**: Pattern → Add Pattern

Creates a rectangular grid of blast holes with uniform spacing and burden.

**Parameters**:
- **Pattern Name**: Entity name for the pattern
- **Number of Rows**: Holes perpendicular to pattern direction
- **Number of Columns**: Holes parallel to pattern direction
- **Burden**: Distance between rows (meters)
- **Spacing**: Distance between holes in a row (meters)
- **Collar Elevation**: Starting Z elevation for all holes (meters RL)
- **Bench Height**: Vertical distance from collar to grade (meters)
- **Subdrill**: Vertical distance below grade (meters, +ve = downhole)
- **Hole Angle**: Angle from vertical (degrees, 0° = vertical)
- **Hole Bearing**: Direction of hole angle (degrees, 0° = North)
- **Hole Diameter**: Hole diameter (millimeters)
- **Hole Type**: Production, Presplit, Buffer, etc.
- **First Hole Position**: X,Y coordinates for pattern origin

**Pattern Layout**:
```
Rows (Burden direction)
↓
•  •  •  •  •  ← Row 1
•  •  •  •  •  ← Row 2
•  •  •  •  •  ← Row 3
→ Spacing
```

**Use Cases**:
- Standard production blasts
- Uniform bench blasting
- Grid-based pattern design

**Hole Naming**:
- Sequential numbering: `H001`, `H002`, `H003`, ...
- Row-based naming optional: `R1-H01`, `R1-H02`, `R2-H01`, ...

### 2. Polygon Pattern

**Menu**: Pattern → Polygon Pattern

Creates holes within a user-defined polygon boundary with specified spacing and burden.

**Parameters**:
- **Pattern Name**: Entity name for the pattern
- **Polygon Points**: Click on canvas to define boundary vertices
- **Close Polygon**: Connect last point to first (auto-close)
- **Burden**: Distance between rows (meters)
- **Spacing**: Distance between holes in a row (meters)
- **Collar Elevation**: Z elevation for all holes (meters RL)
- **Bench Height**: Vertical distance from collar to grade (meters)
- **Subdrill**: Vertical distance below grade (meters)
- **Hole Angle**: Angle from vertical (degrees)
- **Hole Bearing**: Direction of hole angle (degrees)
- **Hole Diameter**: Hole diameter (millimeters)
- **Hole Type**: Hole classification

**Pattern Generation**:
1. User defines polygon boundary by clicking points
2. Kirra generates rectangular grid over polygon bounds
3. Filters holes to only include those inside polygon
4. Handles fractional rows/columns at edges

**Use Cases**:
- Irregular blast boundaries
- Toe-in patterns
- Complex shapes following pit design
- Selective blast areas

**Edge Handling**:
- Holes on boundary are included if center is inside polygon
- Automatic edge row adjustment
- Perimeter hole detection for presplit applications

### 3. Line Pattern

**Menu**: Pattern → Add Line

Creates a single row of holes along a straight line.

**Parameters**:
- **Pattern Name**: Entity name
- **Start Point**: X,Y coordinates for first hole
- **End Point**: X,Y coordinates for last hole
- **Hole Count**: Number of holes (including endpoints)
- **Spacing**: Distance between holes (auto-calculated if hole count specified)
- **Collar Elevation**: Z elevation (meters RL)
- **Bench Height**: Vertical distance (meters)
- **Subdrill**: Vertical distance (meters)
- **Hole Angle**: Angle from vertical (degrees)
- **Hole Bearing**: Direction of hole angle (degrees)
- **Hole Diameter**: Diameter (millimeters)
- **Hole Type**: Hole classification

**Pattern Layout**:
```
Start → •  •  •  •  •  •  • ← End
        ← Spacing →
```

**Use Cases**:
- Presplit lines
- Buffer rows
- Single-row production blasts
- Test patterns

**Spacing Calculation**:
- If hole count specified: Spacing = Distance / (Count - 1)
- If spacing specified: Count = Distance / Spacing + 1
- Holes distributed evenly along line

### 4. Polyline Pattern

**Menu**: Pattern → Add Polyline

Creates a curved or segmented row of holes following a multi-point path.

**Parameters**:
- **Pattern Name**: Entity name
- **Polyline Points**: Click on canvas to define path vertices
- **Spacing**: Distance between holes along path (meters)
- **Collar Elevation**: Z elevation (meters RL)
- **Bench Height**: Vertical distance (meters)
- **Subdrill**: Vertical distance (meters)
- **Hole Angle**: Angle from vertical (degrees)
- **Hole Bearing**: Can vary per segment or use global bearing
- **Hole Diameter**: Diameter (millimeters)
- **Hole Type**: Hole classification

**Pattern Layout**:
```
        •―•―•
       ↗      ↘
      •         •―•―•
     ↗              ↘
    •                •
```

**Use Cases**:
- Curved presplit lines
- Following pit contours
- Non-linear buffer rows
- Complex perimeter patterns

**Bearing Options**:
- **Follow Path**: Each hole angled perpendicular to path segment
- **Fixed Bearing**: All holes use same bearing
- **Manual Per-Segment**: Specify bearing for each line segment

## Pattern Parameters

### Collar Elevation Options

**1. Constant Elevation**:
All holes use specified Z value
```
Collar Z = User Input (e.g., 335.0m)
```

**2. Surface Elevation**:
Interpolate collar Z from loaded surface
```
Collar Z = Surface.interpolate(X, Y)
```

**3. Grade Elevation + Bench**:
Calculate collar from grade and bench height
```
Collar Z = Grade Z + Bench Height
```

### Hole Geometry Calculations

When creating patterns, Kirra calculates:
1. **Collar Position**: `(startX, startY, startZ)` from pattern parameters
2. **Grade Position**: `gradeZ = startZ - benchHeight`
3. **Toe Position**:
   - `Vertical Drop = benchHeight + subdrillAmount`
   - `Horizontal Displacement = verticalDrop × tan(angle)`
   - `endX = startX + horizDisp × sin(bearing)`
   - `endY = startY + horizDisp × cos(bearing)`
   - `endZ = startZ - verticalDrop`
4. **Calculated Attributes**: Length, angle, bearing (verified)

See [Blast Attribute Calculations](Blast-Attribute-Calculations) for complete formulas.

## Pattern Editing

### Individual Hole Editing

**Select Hole** → Right-Click → **Properties**:
- Modify any hole field
- Recalculates dependent fields automatically
- Updates visualization in real-time

### Bulk Editing

**Select Multiple Holes**:
- Shift+Click for multi-select
- Drag rectangle to select region
- TreeView: Select entity to select all holes in pattern

**Bulk Operations**:
- Delete selected holes
- Change hole type (all selected)
- Update diameter (all selected)
- Adjust timing delays
- Move pattern (drag selection)

### Pattern Transformations

**Rotate Pattern**:
- Select all holes in entity
- Specify rotation angle and center point
- Recalculates X,Y coordinates
- Preserves Z elevations and hole orientations

**Mirror Pattern**:
- Select all holes in entity
- Specify mirror axis (X or Y)
- Creates mirrored copy or modifies in place

**Scale Pattern**:
- Select all holes in entity
- Specify scale factors for X, Y
- Useful for adjusting burden/spacing

## Advanced Pattern Features

### Duplicate Detection

When creating or importing patterns with existing names:
1. Kirra checks for duplicate `holeID` values
2. Detects overlapping hole positions (within tolerance)
3. Warns user with conflict list
4. Options: Skip duplicates, Rename, Overwrite

### Auto-Timing

After pattern creation:
1. **Pattern → Auto-Timing** assigns delays
2. Options:
   - Row-by-row (V-pattern)
   - Echelon timing
   - Center-out timing
   - Custom sequence
3. Sets `fromHoleID` and `timingDelayMilliseconds` automatically

### Grade Control

**Using Surfaces**:
1. Import surface (DTM, STR, OBJ)
2. Pattern generation interpolates `gradeZ` from surface at X,Y
3. Collar elevation calculated as `gradeZ + benchHeight`
4. Enables adaptive patterns following terrain

**Manual Grade Assignment**:
1. Create pattern with constant collar elevation
2. Select holes
3. **Edit → Set Grade from Surface**
4. Updates collar/toe/grade elevations

### Pattern Templates

Save frequently-used pattern parameters:
1. Create pattern with desired settings
2. **Pattern → Save as Template**
3. Reuse template for new patterns
4. Templates store: spacing, burden, angle, bearing, diameter, type

## Pattern Statistics

After pattern creation, view statistics:
- Total hole count
- Total length (sum of all hole lengths)
- Total volume (volume of rock broken)
- Average burden/spacing
- Burden range (min, max, mean)
- Spacing range (min, max, mean)

Access via: **View → Pattern Statistics** or select entity in TreeView

---

*For hole field definitions, see [Blast Hole Management](Blast-Hole-Management).*  
*For geometry calculations, see [Blast Attribute Calculations](Blast-Attribute-Calculations).*
