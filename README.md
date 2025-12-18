# Kirra2D

## Overview

**Kirra 2D** is a web-based blasting pattern design application developed by Brent Buffham for mining and construction industries. The application provides comprehensive tools for creating, editing, and exporting blast hole patterns with support for multiple file formats. 

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

Kirra 2D manages blast holes with comprehensive data structures including: 

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

Kirra 2D uses a 3D world coordinate system with camera conventions for proper spatial representation:

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

Kirra 2D uses browser localStorage to save: 
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

When naming a blast the same as an existing one, Kirra 2D automatically: 
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

This documentation provides a comprehensive overview of the Kirra 2D application.  For specific technical implementation details, refer to the source code comments and the AI commentary files in the repository. 
3D World Coordinate and Camera Conventions.

<img width="607" height="716" alt="3D and Camera" src="https://github.com/user-attachments/assets/075e39a8-828d-484e-93df-8efe60e10ee7" />

