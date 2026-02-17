# Measurement Tools

## Overview

Kirra provides comprehensive measurement tools for analyzing blast patterns, including distance measurement, area calculation, ruler/protractor tools, and configurable snap tolerance.

---

## Distance Measurement Tool

Calculate distances between any two points in the workspace with 2D/3D support.

### Features

**Measurement Modes:**
- **2D Distance**: Planar distance (X-Y only)
- **3D Distance**: Spatial distance including elevation (X-Y-Z)
- **Horizontal Distance**: X-Y projection ignoring Z
- **Vertical Distance**: Z difference only

**Snap Support:**
- Snap to hole collars
- Snap to hole toes
- Snap to hole grades
- Snap to KAD vertices
- Snap to grid points

### Usage

**Activate Tool:**
1. Click **Ruler Tool** button (toolbar)
2. Press `R` keyboard shortcut
3. Select from Tools menu

**Measure Distance:**
1. Click first point (or snap to feature)
2. Move mouse to second point
3. Click second point (or snap to feature)
4. Distance displayed on canvas with units

**Display Format:**
```
Distance: 45.23m
Horizontal: 44.12m
Vertical: 8.50m
Bearing: 63.5°
```

**Clear Measurement:**
- Press `Escape`
- Click **Clear** button
- Start new measurement

### 3D Distance Measurement

In 3D mode, distance measurements include elevation:

**3D Features:**
- Ray-cast from camera through mouse position
- Snap to 3D features (hole collars, toes, surfaces)
- Display elevation of clicked points
- Full 3D vector distance calculation

**Snap Behavior:**
- Snap radius configurable (default 15 pixels)
- Priority: COLLAR > GRADE > TOE
- Visual feedback on snap target
- Status bar shows snap target description

---

## Area Calculation Tool

Calculate area of polygons defined by multiple points.

### Features

**Area Modes:**
- **Planar Area**: 2D polygon area (X-Y plane)
- **Surface Area**: 3D surface area on terrain
- **Projected Area**: Area projected onto horizontal plane

**Polygon Types:**
- Open polygon (line segments)
- Closed polygon (last point connects to first)
- Self-intersecting polygons handled

### Usage

**Create Area Measurement:**
1. Click **Area Tool** button
2. Click vertices to define polygon boundary
3. Double-click to close polygon
4. Area displayed in center of polygon

**Display Format:**
```
Area: 1234.56 m²
Perimeter: 145.23 m
Vertices: 12
```

**Edit Polygon:**
- Click vertex to drag and reposition
- Right-click vertex to delete
- Add vertex by clicking on edge

**Clear Polygon:**
- Press `Escape`
- Click **Clear** button
- Start new polygon

### Surface Area Calculation

When a surface is loaded, area can be calculated on 3D terrain:

**Process:**
1. Define polygon vertices (X-Y coordinates)
2. Project vertices onto surface mesh
3. Calculate triangulated surface area
4. Display surface area vs projected area

**Example Output:**
```
Projected Area: 1000.00 m²
Surface Area: 1085.34 m²
Relief Factor: 1.085
```

---

## Ruler and Protractor

Interactive measurement overlay tools for visual analysis.

### Ruler Tool

Display a calibrated ruler overlay for on-screen measurements.

**Features:**
- Draggable ruler
- Rotatable orientation
- Calibrated tick marks
- Unit display (metres, feet)
- Scale adjusts with zoom

**Usage:**
1. Click **Ruler** button
2. Drag ruler to desired location
3. Rotate using handle
4. Read measurements from tick marks

**Ruler Settings:**
- Unit system (metric/imperial)
- Tick spacing
- Ruler length
- Color and transparency

### Protractor Tool

Measure angles between three points or two lines.

**Features:**
- **3-Point Angle**: Angle formed by three clicked points
- **Line-to-Line**: Angle between two selected lines
- **Bearing**: Compass bearing from north
- **Dip**: Angle from horizontal

**Usage:**

**3-Point Angle:**
1. Click **Protractor** button
2. Click point 1 (vertex)
3. Click point 2 (first ray)
4. Click point 3 (second ray)
5. Angle displayed with arc

**Display Format:**
```
Angle: 63.5°
Bearing: 156.5°
```

**Line-to-Line Angle:**
1. Select first line (KAD entity or hole)
2. Select second line
3. Angle displayed at intersection

---

## Snap Tolerance

Configurable snap tolerance controls how close the cursor must be to a feature for snapping to occur.

### Snap System

**Snap Targets:**
- Hole collars (start points)
- Hole toes (end points)
- Hole grades (floor intersections)
- KAD vertices (points, line endpoints, polygon vertices)
- Grid intersections
- Surface edges and vertices

**Snap Priority:**
When multiple features are within snap radius, priority determines which one is selected:

1. **COLLAR** (highest priority)
2. **GRADE**
3. **TOE**
4. **KAD Vertex**
5. **Grid Point** (lowest priority)

### Snap Tolerance Settings

**Configuration:**
- Settings Menu → Snap Tolerance
- Slider control (1-50 pixels)
- Default: 15 pixels

**Visual Feedback:**
- Cursor changes when snap available
- Highlight target feature
- Status bar shows snap target
- Crosshair on snap point

### Snap Modes

**Always Snap (Default):**
- Automatically snap when within tolerance
- No modifier key required

**Manual Snap:**
- Hold `Shift` to enable snapping
- Normal clicking without snap when `Shift` not held

**Disable Snap:**
- Hold `Ctrl` to temporarily disable snapping
- Useful for precise free-hand placement

### 2D vs 3D Snapping

**2D Snapping:**
- Uses screen-space distance (pixels)
- Snap radius is circle around cursor
- X-Y coordinates only

**3D Snapping:**
- Uses ray-cast cylinder from camera
- "Fat ray" technique for depth selection
- Includes Z coordinate in snap target
- Cursor jumps to 3D snap position (including depth)

**3D Snap Example:**
```javascript
// Fat ray cast from camera through mouse
// Finds all targets within cylinder radius
// Priority determines which one (COLLAR > GRADE > TOE)
// Cursor position updated to snap target (X, Y, Z)
```

---

## Coordinate Display

Real-time display of cursor position and selected object coordinates.

### Status Bar Coordinates

**Mouse Coordinates:**
- World X (metres east)
- World Y (metres north)
- World Z (elevation) — when hovering over surface or 3D feature

**Format Examples:**
```
X: 123456.78 E   Y: 654321.09 N   Z: 245.56 m
```

**Selected Object Coordinates:**
When a hole is selected:
```
Collar: (123456.78, 654321.09, 245.56)
Toe: (123458.23, 654323.45, 230.12)
Grade: (123457.89, 654322.67, 234.00)
```

### Coordinate Probe Tool

Click anywhere to display coordinates:

**2D Probe:**
- Click on canvas
- Display X, Y coordinates
- Optional: Snap to nearest feature

**3D Probe:**
- Click on 3D scene
- Ray-cast to find surface intersection
- Display X, Y, Z coordinates
- Distance from camera

### Coordinate Copy

Right-click coordinates in status bar or dialog to copy:
- Copy as comma-separated: `123456.78, 654321.09, 245.56`
- Copy as tab-separated (paste into spreadsheet)
- Copy as formatted string: `X: 123456.78 E, Y: 654321.09 N, Z: 245.56 m`

---

## Grid Overlay

Configurable grid overlay for visual reference.

### Grid Features

**Grid Types:**
- Cartesian grid (square cells)
- Polar grid (concentric circles)
- Custom spacing grid

**Grid Settings:**
- Spacing (auto or manual)
- Major/minor line intervals
- Color (theme-aware)
- Line width
- Opacity

### Grid Snapping

Enable grid snapping for alignment:

**Grid Snap Modes:**
- Snap to intersections
- Snap to major lines
- Snap to nearest grid point

**Snap Tolerance:**
- Uses same snap radius as feature snapping
- Lowest priority (features snap first)

---

## Measurement Accuracy

### Precision

**Coordinate Precision:**
- X, Y: 0.01 metres (10mm)
- Z: 0.01 metres (10mm)
- Distances: 0.01 metres
- Angles: 0.1 degrees

**Floating Point:**
- JavaScript Number (IEEE 754 double precision)
- Effective precision ~15 decimal digits
- Suitable for UTM coordinates (up to 7 digits)

### Coordinate Systems

**Measurements respect coordinate system:**
- UTM coordinates (large values)
- Local mine grid
- Custom CRS via projection dialog

**Distance Calculations:**
- Euclidean distance (not geodetic)
- Suitable for project areas <50km
- For larger areas, consider geodetic calculations

---

## Measurement Export

Export measurement results to CSV or report.

### Export Format

**Measurement Table:**
```csv
Type,From X,From Y,From Z,To X,To Y,To Z,Distance 2D,Distance 3D,Bearing
Distance,123456.78,654321.09,245.56,123501.23,654365.78,238.12,62.45,63.21,63.5
```

**Area Measurements:**
```csv
Type,Vertices,Area 2D,Perimeter,Surface Area,Relief Factor
Area,"[(x1,y1),(x2,y2)...]",1234.56,145.23,1285.34,1.041
```

### Measurement History

All measurements stored in session:
- Accessible via Measurements panel
- List all distance/area measurements
- Re-display on canvas
- Export to CSV

---

## Tools Integration

Measurement tools integrate with other Kirra features:

### Pattern Generation

Use measured distances for pattern parameters:
- Measure burden → Use in pattern dialog
- Measure spacing → Apply to pattern
- Measure angle → Set hole angle

### Hole Properties

Measure and verify hole attributes:
- Hole length
- Bench height
- Subdrill length
- Horizontal displacement

### Surface Analysis

Measure terrain features:
- Slope angles
- Bench heights
- Ramp gradients
- Berm widths

---

See also:
- [Coordinate System](Coordinate-System) — Coordinate conventions and transformations
- [User Interface](User-Interface) — UI components and tools
- [Statistics and Reporting](Statistics-and-Reporting) — Analysis and reporting
