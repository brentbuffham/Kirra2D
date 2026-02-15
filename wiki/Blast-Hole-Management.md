# Blast Hole Management

## Overview

Kirra manages blast holes as comprehensive data structures containing geometric, operational, and metadata properties. Each blast hole is stored with complete 3D geometry, calculated attributes, timing information, and measured data.

## Blast Hole Data Structure

### Complete Field Definition

Every blast hole in Kirra contains the following fields with their default values:

```javascript
{
  // Entity Grouping
  entityName: "",              // Blast pattern name (e.g., "Pattern_A")
  entityType: "hole",          // Always "hole" for blast holes
  holeID: null,                // Unique hole identifier within entity (required)

  // Collar Position (Start Point)
  startXLocation: 0,           // Collar easting (meters)
  startYLocation: 0,           // Collar northing (meters)
  startZLocation: 0,           // Collar elevation (meters RL)

  // Toe Position (End Point)
  endXLocation: 0,             // Toe easting (meters)
  endYLocation: 0,             // Toe northing (meters)
  endZLocation: 0,             // Toe elevation (meters RL)

  // Grade Position (Floor Intersection)
  gradeXLocation: 0,           // Grade easting (meters) - CALCULATED
  gradeYLocation: 0,           // Grade northing (meters) - CALCULATED
  gradeZLocation: 0,           // Grade elevation (meters RL) - CALCULATED

  // Subdrill Dimensions
  subdrillAmount: 0,           // Vertical distance: gradeZ to toeZ (meters, +ve = downhole)
  subdrillLength: 0,           // Vector distance: grade to toe along hole (meters) - CALCULATED

  // Bench Dimensions
  benchHeight: 0,              // Vertical distance: collarZ to gradeZ (meters, always absolute)

  // Hole Properties
  holeDiameter: 115,           // Hole diameter (millimeters)
  holeType: "Undefined",       // Hole type (Production, Presplit, Buffer, etc.)
  holeLengthCalculated: 0,     // Collar to toe distance (meters) - CALCULATED
  holeAngle: 0,                // Angle from vertical (degrees, 0° = vertical)
  holeBearing: 0,              // Bearing from north (degrees, 0° = north, clockwise)

  // Timing/Initiation
  fromHoleID: "",              // Timing connection source (format: "entityName:::holeID")
  timingDelayMilliseconds: 0,  // Delay from previous hole (milliseconds)
  colorHexDecimal: "red",      // Timing connector color (#RRGGBB)

  // Measured/Actual Data
  measuredLength: 0,           // Actual drilled length (meters, ≥ 0)
  measuredLengthTimeStamp: "09/05/1975 00:00:00",  // Measurement timestamp
  measuredMass: 0,             // Actual explosive mass (kg, ≥ 0)
  measuredMassTimeStamp: "09/05/1975 00:00:00",    // Measurement timestamp
  measuredComment: "None",     // Measurement notes/comments
  measuredCommentTimeStamp: "09/05/1975 00:00:00", // Comment timestamp

  // Pattern Analysis (HDBScan Clustering)
  rowID: null,                 // Row number in pattern (auto-calculated)
  posID: null,                 // Position number in row (auto-calculated)
  burden: 1,                   // Burden distance to next row (meters)
  spacing: 1,                  // Spacing to next hole in row (meters)

  // UI Properties
  visible: true,               // Visibility flag for display/export
  connectorCurve: 0            // Timing connector curve amount (0 = straight)
}
```

### Field Categories

#### 1. Required Fields
- `entityName` - Blast pattern identifier
- `holeID` - Unique hole name within entity
- Must be unique: No two holes in same entity can share `holeID`

#### 2. Survey/Design Input Fields
- **Collar**: `startXLocation`, `startYLocation`, `startZLocation`
- **Toe**: `endXLocation`, `endYLocation`, `endZLocation`
- **Grade**: `gradeZLocation` (elevation only, X/Y calculated)
- **Dimensions**: `subdrillAmount`, `benchHeight`
- **Orientation**: `holeAngle`, `holeBearing`
- **Properties**: `holeDiameter`, `holeType`

#### 3. Calculated Fields (Auto-Updated)
- `gradeXLocation`, `gradeYLocation` - Interpolated from collar/toe and gradeZ
- `subdrillLength` - Vector distance from grade to toe
- `holeLengthCalculated` - 3D distance from collar to toe
- `benchHeight` - If gradeZ provided, calculated from collarZ - gradeZ
- `holeAngle`, `holeBearing` - If collar and toe provided
- `rowID`, `posID`, `burden`, `spacing` - Via HDBScan clustering

#### 4. Operational Fields
- `fromHoleID` - Timing sequence connection
- `timingDelayMilliseconds` - Delay increment
- `colorHexDecimal` - Visual timing indicator

#### 5. Measured/Actual Fields
- `measuredLength` - As-built hole length
- `measuredMass` - Actual explosive mass loaded
- `measuredComment` - Field notes
- All measured fields have associated timestamps

#### 6. UI/Display Fields
- `visible` - Show/hide in canvas and exports
- `connectorCurve` - Visual curve for timing connectors

## Important Warnings

### IREDES X/Y Swap

**⚠️ CRITICAL**: The IREDES XML format uses **X for Northing, Y for Easting** (opposite of standard convention).

Kirra automatically handles this swap on import/export, but be aware when:
- Manually editing IREDES XML files
- Comparing IREDES data with other formats
- Debugging coordinate issues

**Standard Kirra Convention**:
- `X` = Easting
- `Y` = Northing
- `Z` = Elevation

**IREDES Convention**:
- `X` = Northing
- `Y` = Easting
- `Z` = Elevation

Always verify coordinate order when working with IREDES files.

## Angle Conventions

See [Coordinate System](Coordinate-System) for complete angle definitions:
- **Angle**: From vertical (0° = vertical, 90° = horizontal)
- **Dip**: 90° - Angle (90° = vertical, 0° = horizontal) - Also known as **Mast Angle**
- **Bearing**: 0° = North, 90° = East, 180° = South, 270° = West (clockwise)

Different mining software systems use different conventions:
- **Kirra**: Angle from vertical (0° = vertical)
- **Surpac**: -90° = vertical down
- Always ask if unsure about angle conventions in imported data

## Display Options

### Hole Labels
Toggle visibility of hole properties on canvas:
- Hole ID
- Hole type
- Diameter
- Length
- Angle/Bearing
- Timing delay
- Row/Position

### Hole Visualization
- **2D Canvas**: Circles at collar with timing connectors
- **3D View**: Cylinders from collar to toe with gradient coloring
- **Color Coding**: By hole type, timing, or custom schemes

### Selection and Interaction
- Click to select individual holes
- Shift+Click for multi-select
- Right-click for context menu
- Drag to move holes (updates coordinates)

## Hole Validation

### Geometry Validation
- Collar and toe cannot be identical points (unless 4-column import)
- Hole length must be positive
- Angle must be 0-90 degrees
- Bearing must be 0-359.99 degrees

### Timing Validation
- `fromHoleID` must reference existing hole in same entity or be empty
- Timing delay must be ≥ 0
- No circular timing dependencies

### Data Integrity
- `holeID` uniqueness within entity
- Valid coordinate ranges (no NaN or Infinity)
- Diameter > 0 (if specified)

## Hole Types

Common hole type values:
- `Production` - Standard production holes
- `Presplit` - Pre-split perimeter holes
- `Buffer` - Buffer holes between production and presplit
- `Trim` - Trim/control holes
- `Relief` - Relief holes for burn cuts
- `Undefined` - Unassigned type

Custom hole types are supported - any string value is valid.

## HDBScan Clustering

Kirra uses HDBScan (Hierarchical Density-Based Spatial Clustering) to automatically determine:
- **rowID** - Row number in blast pattern
- **posID** - Position within row
- **burden** - Distance to next row
- **spacing** - Distance to next hole in row

This enables:
- Automatic pattern analysis
- Burden/spacing statistics
- Row-based operations
- Pattern optimization

---

*For geometry calculations, see [Blast Attribute Calculations](Blast-Attribute-Calculations).*  
*For pattern creation, see [Pattern Generation](Pattern-Generation).*
