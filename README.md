# Kirra

## Overview

**Kirra** is a web-based blasting pattern design application developed by Brent Buffham for mining and construction industries. The application provides comprehensive tools for creating, editing, and exporting blast hole patterns with support for multiple file formats. 

### Key Features

- **Multi-Format Support**: CSV, DXF, and KAD (Kirra App Drawing) file formats
- **Pattern Generation**: Create blast patterns using multiple methods
- **Interactive Canvas**: 2D visualization with pan, zoom, and measurement tools
- **Data Management**: Import/export blast data with various column configurations
- **Internationalization**: Support for multiple languages (English, Russian, Spanish)
- **Dark/Light Mode**: Theme toggle for different working environments
- **Vector PDF Export**: High-quality SVG-based PDF generation

## Technology Stack

- **Primary Language**: JavaScript
- **Build Tool**: Vite
- **UI Framework**:  Vanilla JavaScript with custom dialog system
- **Visualization**: Plotly.js, D3.js
- **License**: MIT License

## Application Architecture

### File Structure

```
Kirra2D/
├── kirra.html              # Main application UI
├── src/
│   ├── dialog/             # Dialog system
│   │   └── popups/
│   │       └── generic/    # Pattern generation dialogs
│   ├── helpers/            # Utility functions
│   │   └── BlastStatistics. js
│   ├── print/              # PDF/SVG export system
│   │   ├── PrintSystem.js
│   │   ├── PrintStats.js
│   │   └── PrintRendering.js
│   └── kirra.css          # Application styles
├── libs/                   # External libraries
├── icons/                  # Application icons
└── vite.config.js         # Build configuration
```

## Core Functionality

### 1. Blast Hole Management

Kirra manages blast holes with comprehensive data structures including: 

- **Hole ID**:  Unique identifier
- **Coordinates**: Collar (X, Y, Z) and Toe (X, Y, Z) positions
- **Geometry**: Diameter, length, angle, bearing, dip
- **Properties**: Type, subdrill, entity name
- **Timing**: Firing sequence and delay information
- **Visual**:  Color coding for visualization

### 2. Pattern Generation Methods

#### Add Pattern
Creates a rectangular blast pattern with:
- Orientation angle
- Starting position (X, Y, Z)
- Number of rows and holes per row
- Burden and spacing parameters
- Hole specifications (diameter, length, angle, bearing)

#### Generate Pattern in Polygon
Creates a blast pattern within a defined polygon:
- Burden and spacing values
- Spacing offset for staggered patterns
- Collar elevation and grade control
- Automatic hole numbering
- Duplicate detection

#### Holes Along Line
Generates holes along a straight line

#### Holes Along Polyline
Generates holes following a polyline path

### 3. File Import/Export

#### Import Formats (CSV - No Headers)

**4-column**:  ID, X, Y, Z (Dummy Holes)
```
1, 100. 0, 200.0, 50.0
```

**7-column**: ID, X, Y, Z, toeX, toeY, toeZ (Blast Holes)
```
1, 100.0, 200.0, 50.0, 105.0, 200.0, 40.0
```

**9-column**:  Adds Diameter, Type
```
1, 100.0, 200.0, 50.0, 105.0, 200.0, 40.0, 115, Production
```

**12-column**: Adds FromHole, Delay, Color
```
1, 100.0, 200.0, 50.0, 105.0, 200.0, 40.0, 115, Production, 0, 0, #FF0000
```

**14-column**: Adds entityName, entityType (Full format)
```
Blast_001, Pattern, 1, 100.0, 200.0, 50.0, 105.0, 200.0, 40.0, 115, Production, 0, 0, #FF0000
```

#### Export Formats

- **KIRRA CSV**: 14-column format for saving complete blast data
- **KAD Drawing**:  Kirra App Drawing format for vector data
- **EXTRA CSV**: Extended format with all hole aspects
- **Measurements**: Real-world measurement values
- **DXF**: AutoCAD-compatible format
- **AQM**: Specialized export format

### 4. Coordinate System

Kirra uses a 3D world coordinate system with camera conventions for proper spatial representation:

- **X-axis**: East-West direction
- **Y-axis**: North-South direction  
- **Z-axis**:  Elevation (vertical)
- **Angles**: Measured from horizontal
- **Bearing**: Measured from North (0-360°)
- **Dip**: Vertical angle from horizontal

### 5. Display Options

Users can toggle display of various hole properties:
- Hole ID
- Hole length
- Hole diameter
- Angle
- Dip
- Bearing
- Subdrill
- Timing information

### 6. Measurement Tools

- **Distance**: Measure distances between points
- **Area**: Calculate polygon areas
- **Ruler/Protractor**: Angle measurements
- **Snap Tolerance**: Configurable snapping for precise placement

### 7. Statistics and Reporting

The application calculates and displays per-entity statistics: 
- Hole count
- Total length
- Total volume
- Average burden and spacing
- Firing time range
- Voronoi metrics for rock distribution

## User Interface

### Menu Structure

- **File Operations**:  Import/Export, Save/Load
- **Edit Tools**: Add, Delete, Modify holes
- **Pattern Tools**: Various pattern generation methods
- **View Controls**: Zoom, Pan, Reset view
- **Display Options**: Toggle hole property labels
- **Settings**: Language, Theme, Snap tolerance
- **Help**: Version information and documentation

### Theme System

- **Light Mode**: White canvas with dark text
- **Dark Mode**: Black canvas with light text
- Customizable color scheme with CSS variables
- Persistent user preference storage

### Internationalization

Supported languages with full translation: 
- English (default)
- Russian (Русский)
- Spanish (Español)

All UI elements, tooltips, and messages are translatable. 

## Data Persistence

Kirra uses browser localStorage to save: 
- Last used pattern parameters
- Display preferences
- Theme selection
- Language preference
- Snap tolerance settings

This ensures user settings persist across sessions.

## Blast Design Workflow

### Typical Usage Pattern

1. **Setup**
   - Select language and theme
   - Configure display options
   - Set snap tolerance

2. **Import Data**
   - Import existing holes from CSV
   - Import DXF drawings for reference
   - Load saved KAD files

3. **Pattern Creation**
   - Use Add Pattern for rectangular grids
   - Use Polygon Pattern for irregular shapes
   - Use Line/Polyline tools for specific layouts

4. **Editing**
   - Select and modify individual holes
   - Adjust timing and delays
   - Update hole properties

5. **Verification**
   - View blast statistics
   - Check spacing and burden
   - Verify timing sequences

6. **Export**
   - Save to KIRRA format for future editing
   - Export to DXF for CAD systems
   - Generate PDF reports with SVG graphics

## Advanced Features

### Duplicate Detection

When naming a blast the same as an existing one, Kirra automatically: 
- Checks for duplicate hole IDs
- Detects overlapping hole positions
- Warns users of conflicts
- Prevents accidental data loss

### Grade Control

Patterns can use grade elevation (Z-values):
- Use existing surface topography
- Apply constant collar elevation
- Automatic subdrill calculation

### Voronoi Analysis

The application can calculate Voronoi metrics for: 
- Rock distribution per hole
- Blast efficiency analysis
- Powder factor calculations

## Print and PDF System

### Vector-Based Export

Modern PDF generation using SVG rendering:
- `printHeaderSVG()`: Title and metadata
- `printFooterSVG()`: Copyright and date
- `printBlastStatsSVG()`: Detailed statistics
- `printBlastStatsSimpleSVG()`: Summary statistics

### Print Areas

Configurable print layouts with:
- Header section
- Main canvas area
- Statistics section
- Footer section

## Development Information

### Build and Run

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

The dev server automatically opens `kirra.html` on port 5173.

### Browser Compatibility

- Modern browsers with ES6+ support
- Canvas and SVG support required
- localStorage for persistence
- Responsive design for various screen sizes

## Credits

**Author**: Brent Buffham  
**Copyright**: © 2023-2025  
**Website**: blastingapps.com  
**License**: MIT License

---

This documentation provides a comprehensive overview of the Kirra application.  For specific technical implementation details, refer to the source code comments and the AI commentary files in the repository. 
3D World Coordinate and Camera Conventions.

<img width="607" height="716" alt="3D and Camera" src="https://github.com/user-attachments/assets/075e39a8-828d-484e-93df-8efe60e10ee7" />

---

# Kirra2D Blast Attribute Calculation Relationships

## Primary Inputs (Survey/Design Data)
```
┌─────────────────────────────────────────────────────────────┐
│  COLLAR (Start)     │  TOE (End)        │  GRADE (Floor)    │
│  StartX, StartY, StartZ │ EndX, EndY, EndZ │ GradeX, GradeY, GradeZ │
└─────────────────────────────────────────────────────────────┘
```

---

## Vertical Calculations (Z-only)

| Attribute | Primary Formula | Equivalent Formulas |
|-----------|-----------------|---------------------|
| **BenchHeight** | `StartZ - GradeZ` | `HoleLength×cos(Angle) - SubdrillAmount` |
| **SubdrillAmount** | `GradeZ - EndZ` | `HoleLength×cos(Angle) - BenchHeight` |
| **VerticalDrop** | `StartZ - EndZ` | `BenchHeight + SubdrillAmount` = `HoleLength × cos(Angle)` |

---

## Length Calculations

| Attribute | Primary Formula | Equivalent Formulas |
|-----------|-----------------|---------------------|
| **HoleLength** | `√[(ΔX)² + (ΔY)² + (ΔZ)²]` | `VerticalDrop / cos(Angle)` = `(BenchHeight + Subdrill) / cos(Angle)` |
| **HorizontalDisplacement** | `√[(EndX-StartX)² + (EndY-StartY)²]` | `HoleLength × sin(Angle)` = `VerticalDrop × tan(Angle)` |

---

## Angle Calculations

| Attribute | Primary Formula | Equivalent Formulas |
|-----------|-----------------|---------------------|
| **HoleAngle** (from vertical) | `arccos(VerticalDrop / HoleLength)` | `arcsin(HorizDisp / HoleLength)` = `arctan(HorizDisp / VerticalDrop)` |
| **HoleBearing** (azimuth) | `atan2(ΔX, ΔY)` | — |

---

## Equation Chains (What Calculates What)

```
                    ┌──────────────┐
                    │   StartZ     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ GradeZ  │  │  EndZ   │  │ StartXY │
        └────┬────┘  └────┬────┘  └────┬────┘
             │            │            │
             │            │            ▼
             │            │       ┌─────────┐
             │            │       │  EndXY  │
             │            │       └────┬────┘
             │            │            │
             ▼            ▼            ▼
      ┌─────────────────────────────────────┐
      │         DERIVED ATTRIBUTES          │
      └─────────────────────────────────────┘

StartZ - GradeZ ──────────────────────────────► BenchHeight
GradeZ - EndZ ────────────────────────────────► SubdrillAmount  
StartZ - EndZ ────────────────────────────────► VerticalDrop

√(ΔX² + ΔY² + ΔZ²) ───────────────────────────► HoleLength
√(ΔX² + ΔY²) ─────────────────────────────────► HorizontalDisplacement

arccos(VerticalDrop / HoleLength) ────────────► HoleAngle
atan2(ΔX, ΔY) ────────────────────────────────► HoleBearing
```

---

## Cross-Check Equivalencies (Validation)

These should all resolve to TRUE if data is consistent:

```
✓ BenchHeight + SubdrillAmount = VerticalDrop

✓ SubdrillAmount = HoleLength × cos(Angle) - BenchHeight

✓ HoleLength² = HorizontalDisplacement² + VerticalDrop²

✓ HoleLength = (BenchHeight + SubdrillAmount) / cos(Angle)

✓ tan(Angle) = HorizontalDisplacement / VerticalDrop

✓ GradeXY = StartXY + (HorizontalDisplacement × BenchHeight/VerticalDrop) × [sin(Bearing), cos(Bearing)]
```

---

## For Angled Holes: Grade Point Interpolation

```
                     Start (Collar)
                        ●
                       /│
                      / │ BenchHeight
                     /  │
                    /   │
           Grade  ●─────┤ ← GradeZ elevation
                  │    /│
      SubdrillLen │   / │ SubdrillAmount (vertical)
                  │  /  │
                  │ /   │
                  ▼/    ▼
                 ● Toe (End)

GradeX = StartX + (EndX - StartX) × (BenchHeight / VerticalDrop)
GradeY = StartY + (EndY - StartY) × (BenchHeight / VerticalDrop)
```

---

## Accuracy Hierarchy

| Rank | Calculation | Error Source | Typical Accuracy |
|------|-------------|--------------|------------------|
| 1 | BenchHeight | Single Z difference | ±0.01m |
| 2 | SubdrillAmount | Single Z difference | ±0.01m |
| 3 | VerticalDrop | Single Z difference | ±0.01m |
| 4 | HoleBearing | 2D XY ratio | ±0.5° (degrades near vertical) |
| 5 | HoleLength | 3D compound | ±0.02m |
| 6 | HoleAngle | Inverse trig | ±1° (very poor near vertical) |
| 7 | GradeXY interpolation | Depends on angle accuracy | ±0.05m to ±0.5m |
| 8 | Burden/Spacing | Pattern geometry | ±0.1m |

---

## Quick Reference: "I have X, I need Y"

| If you have... | You can calculate... |
|----------------|---------------------|
| StartZ, GradeZ | BenchHeight |
| GradeZ, EndZ | SubdrillAmount |
| StartZ, EndZ | VerticalDrop |
| StartXYZ, EndXYZ | HoleLength, HoleAngle, HoleBearing |
| BenchHeight, SubdrillAmount | VerticalDrop |
| HoleLength, Angle | VerticalDrop, HorizontalDisplacement |
| VerticalDrop, Angle | HoleLength |
| BenchHeight, HoleLength, Angle | SubdrillAmount |
| StartXY, EndXY, BenchHeight, VerticalDrop | GradeXY |

---

## Input Scenarios: "I have these inputs, what can I calculate?"

### Scenario 1: StartXYZ + BenchHeight (Design from Collar)
```
GIVEN:  StartX, StartY, StartZ, BenchHeight
CALC:   GradeZ = StartZ - BenchHeight
NEED:   Angle, Bearing, (Subdrill OR Length OR ToeXYZ) to complete
```
| Can Calculate | Formula | Missing for Full Geometry |
|---------------|---------|---------------------------|
| GradeZ | StartZ - BenchHeight | — |
| — | — | ToeXYZ, Length, Angle, Bearing, Subdrill |

**To complete the hole, add ONE of:**
- Subdrill + Angle + Bearing → ToeXYZ, Length, GradeXY
- Length + Angle + Bearing → ToeXYZ, Subdrill, GradeXY
- ToeXYZ → Length, Angle, Bearing, Subdrill, GradeXY

---

### Scenario 2: StartXYZ + BenchHeight + Subdrill (Vertical Hole, Bench Design)
```
GIVEN:  StartX, StartY, StartZ, BenchHeight, SubdrillAmount
ASSUME: Vertical hole (Angle = 0°)
```
| Can Calculate | Formula |
|---------------|---------|
| GradeZ | StartZ - BenchHeight |
| EndZ (ToeZ) | GradeZ - SubdrillAmount |
| VerticalDrop | BenchHeight + SubdrillAmount |
| HoleLength | VerticalDrop (same for vertical) |
| EndX, EndY | StartX, StartY (vertical = no XY change) |
| GradeX, GradeY | StartX, StartY |
| Angle | 0° |
| Bearing | Undefined (vertical) |

✅ **Complete geometry for vertical holes**

---

### Scenario 3: StartXYZ + BenchHeight + Subdrill + Angle + Bearing (Angled Hole Design)
```
GIVEN:  StartX, StartY, StartZ, BenchHeight, SubdrillAmount, Angle, Bearing
```
| Can Calculate | Formula |
|---------------|---------|
| GradeZ | StartZ - BenchHeight |
| EndZ (ToeZ) | GradeZ - SubdrillAmount |
| VerticalDrop | BenchHeight + SubdrillAmount |
| HoleLength | VerticalDrop / cos(Angle) |
| HorizDisplacement | HoleLength × sin(Angle) |
| EndX | StartX + HorizDisp × sin(Bearing) |
| EndY | StartY + HorizDisp × cos(Bearing) |
| GradeX | StartX + (HorizDisp × BenchHeight/VerticalDrop) × sin(Bearing) |
| GradeY | StartY + (HorizDisp × BenchHeight/VerticalDrop) × cos(Bearing) |

✅ **Complete geometry**

---

### Scenario 4: ToeXYZ + Length + Subdrill (Working Backwards from Toe)
```
GIVEN:  EndX, EndY, EndZ, HoleLength, SubdrillAmount
NEED:   Angle + Bearing to solve
```
| Can Calculate | Formula | Notes |
|---------------|---------|-------|
| GradeZ | EndZ + SubdrillAmount | ✅ Always |
| — | — | Need Angle to continue |

**With Angle added:**
| Can Calculate | Formula |
|---------------|---------|
| VerticalDrop | HoleLength × cos(Angle) |
| StartZ | EndZ + VerticalDrop |
| BenchHeight | VerticalDrop - SubdrillAmount |
| HorizDisplacement | HoleLength × sin(Angle) |

**With Angle + Bearing added:**
| Can Calculate | Formula |
|---------------|---------|
| StartX | EndX - HorizDisp × sin(Bearing) |
| StartY | EndY - HorizDisp × cos(Bearing) |
| GradeX | EndX - (HorizDisp × Subdrill/VerticalDrop) × sin(Bearing) |
| GradeY | EndY - (HorizDisp × Subdrill/VerticalDrop) × cos(Bearing) |

✅ **Complete geometry (with Angle + Bearing)**

---

### Scenario 5: ToeXYZ + GradeZ + Angle + Bearing (Toe Survey + Grade RL)
```
GIVEN:  EndX, EndY, EndZ, GradeZ, Angle, Bearing
```
| Can Calculate | Formula |
|---------------|---------|
| SubdrillAmount | GradeZ - EndZ |
| SubdrillLength | SubdrillAmount / cos(Angle) |

**Need StartZ OR BenchHeight OR Length to complete**

---

### Scenario 6: StartXYZ + ToeXYZ (Full Survey - Most Common)
```
GIVEN:  StartX, StartY, StartZ, EndX, EndY, EndZ
```
| Can Calculate | Formula |
|---------------|---------|
| HoleLength | √[(ΔX)² + (ΔY)² + (ΔZ)²] |
| VerticalDrop | StartZ - EndZ |
| HorizDisplacement | √[(ΔX)² + (ΔY)²] |
| HoleAngle | arccos(VerticalDrop / HoleLength) |
| HoleBearing | atan2(ΔX, ΔY) |

**Need GradeZ to get Bench/Subdrill split:**
| With GradeZ | Formula |
|-------------|---------|
| BenchHeight | StartZ - GradeZ |
| SubdrillAmount | GradeZ - EndZ |
| GradeX | StartX + ΔX × (BenchHeight / VerticalDrop) |
| GradeY | StartY + ΔY × (BenchHeight / VerticalDrop) |

---

### Scenario 7: StartXYZ + Length + Angle + Bearing (Design Projection)
```
GIVEN:  StartX, StartY, StartZ, HoleLength, Angle, Bearing
```
| Can Calculate | Formula |
|---------------|---------|
| VerticalDrop | HoleLength × cos(Angle) |
| HorizDisplacement | HoleLength × sin(Angle) |
| EndX | StartX + HorizDisp × sin(Bearing) |
| EndY | StartY + HorizDisp × cos(Bearing) |
| EndZ | StartZ - VerticalDrop |

**Need GradeZ OR BenchHeight OR Subdrill to split:**
| With GradeZ | Formula |
|-------------|---------|
| BenchHeight | StartZ - GradeZ |
| SubdrillAmount | GradeZ - EndZ |

| With BenchHeight | Formula |
|------------------|---------|
| GradeZ | StartZ - BenchHeight |
| SubdrillAmount | VerticalDrop - BenchHeight |

| With SubdrillAmount | Formula |
|---------------------|---------|
| BenchHeight | VerticalDrop - SubdrillAmount |
| GradeZ | EndZ + SubdrillAmount |

---

## Summary Matrix: Minimum Inputs Required

| Hole Type | Minimum Inputs | What You Get |
|-----------|----------------|--------------|
| **Vertical** | StartXYZ + BenchHeight + Subdrill | Full geometry |
| **Angled** | StartXYZ + BenchHeight + Subdrill + Angle + Bearing | Full geometry |
| **From Survey** | StartXYZ + ToeXYZ + GradeZ | Full geometry |
| **From Toe** | ToeXYZ + Length + Subdrill + Angle + Bearing | Full geometry |
| **Design** | StartXYZ + Length + Angle + Bearing + (GradeZ OR Bench OR Sub) | Full geometry |

---

## The Three Ways to Define a Hole

```
METHOD 1: Two Points + Grade
┌─────────────────────────────────────┐
│  StartXYZ + ToeXYZ + GradeZ         │
│  (Survey data - most accurate)      │
└─────────────────────────────────────┘

METHOD 2: Collar + Vector + Depths
┌─────────────────────────────────────┐
│  StartXYZ + Angle + Bearing +       │
│  BenchHeight + Subdrill             │
│  (Design data - typical input)      │
└─────────────────────────────────────┘

METHOD 3: Toe + Vector + Depths
┌─────────────────────────────────────┐
│  ToeXYZ + Angle + Bearing +         │
│  Length + Subdrill                  │
│  (Reverse engineering)              │
└─────────────────────────────────────┘
```

# What is a blasthole?
A blasthole consists of these fields (for it to be valid all field but be there.)
```
entityName                 || "" //BlastName
entityType                 || "hole" //for future use when creating a binary KDB file (Drawings and Holes)
holeID                     || notNull //unique hole name with in a blast, no two holes within a blast can be called the same ID
-> Important as IREDES swaps the Easting and Northing X Y nomenclature WARNING: Ask about this isf not understood.
startXLocation             || 0 //Collar Easting  location 
startYLocation             || 0 //Collar Northing Location
startZLocation             || 0 // Collar Elevation
endXLocation               || 0 //Toe Easting
endYLocation               || 0 //Toe Northing
endZLocation               || 0 //Toe Elevation
gradeXLocation             || 0 //Always Calculate,Grade Easting
gradeYLocation             || 0 //Always Calculate,Grade Northing
gradeZLocation             || 0 //Always Calculate,Grade Elevation
subdrillAmount             || 0 //deltaZ of gradeZ to toeZ -> downhole =+ve uphole =-ve
subdrillLength             || 0 //Always Calculate,distance of subdrill from gradeXYZ to toeXYZ -> downhole =+ve uphole =-ve
benchHeight                || 0 //Always Calculate, deltaZ of collarZ to gradeZ -> always Absolute
holeDiameter               || 115 //Always convert to millimeters
holeType                   || "Undefined" //If not assigned always "undefined"
fromHoleID                 || "" // the ENTITYNAME:::HOLEID (must be at least connected to itself )
timingDelayMilliseconds    || 0 // The delay Connection amount not the holetime
colorHexDecimal            || "red" //Color of the delay arrow
holeLengthCalculated       || 0 // Always Calculate, Distance from the collarXYZ to the ToeXYZ
holeAngle                  || 0; //Angle of the blast hole from Collar to Toe --> 0° = Vertical - Hole Dip is = 90-holeAngle
holeBearing                || 0 //North is 0°
measuredLength             || 0 //Can be Zero but not -ve
measuredLengthTimeStamp    || "09/05/1975 00:00:00";
measuredMass               || 0 //Can Zero but not -ve
measuredMassTimeStamp      || "09/05/1975 00:00:00";
measuredComment            || "None" //Any Text string
measuredCommentTimeStamp   || "09/05/1975 00:00:00";
rowID                      || null // Always use HDBScan to determine if not assigned.
posID                      || null // Always use HDBScan to determine if not assigned.
visible                    || true (default) //Boolean Value not text only visible entities can be exported.
burden                     || 1 // Always use HDBScan to determine if not assigned.
spacing                    || 1 // Always use HDBScan to determine if not assigned.
connectorCurve             || 0 // the bend of the connector.
```
<img width="2002" height="1040" alt="image" src="https://github.com/user-attachments/assets/08eb1ace-4ecf-4373-8fe6-3c2273133bb5" />
