# Blast Design Workflow

## Overview

This guide provides a complete **step-by-step workflow** for designing blast patterns in Kirra, from initial setup through to final export. The workflow follows industry best practices and leverages Kirra's comprehensive feature set.

---

## Workflow Stages

```
┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│  1. Setup │ →  │ 2. Import │ →  │ 3. Pattern│ →  │ 4. Editing│
└───────────┘    └───────────┘    └───────────┘    └───────────┘
                                                           ↓
┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│ 8. Export │ ←  │7. Document│ ←  │ 6. Verify │ ←  │ 5. Charge │
└───────────┘    └───────────┘    └───────────┘    └───────────┘
```

---

## Stage 1: Setup

### 1.1 Initial Configuration

**Select Language**:
- File → Settings → Language
- Options: English, Russian (Русский), Spanish (Español)
- Language affects all UI text and number formatting

**Choose Theme**:
- File → Settings → Theme
- **Dark Mode** (default): Better for outdoor field work, reduces eye strain
- **Light Mode**: Better for printing, presentations

**Configure Display Units**:
- File → Settings → Display Options
- Angle: Degrees (default for mining)
- Distance: Meters
- Mass: Kilograms

### 1.2 Display Options

Enable/disable visual elements via View menu:

| Display Option | Recommended | Use Case |
|---------------|-------------|----------|
| **Hole ID** | ✅ Always | Essential for identification |
| **Hole Length** | ⬜ Optional | Verification only |
| **Hole Diameter** | ⬜ Optional | Multi-diameter patterns |
| **Angle** | ⬜ Optional | Angled holes only |
| **Bearing** | ⬜ Optional | Directional drilling |
| **Subdrill** | ⬜ Optional | Grade control designs |
| **Timing** | ✅ Always | Firing sequence visualization |
| **Connectors** | ✅ Always | Shows timing relationships |

**Toggle Shortcuts**:
- `Ctrl+I` - Hole IDs
- `Ctrl+T` - Timing display
- `Ctrl+C` - Connectors

### 1.3 Snap Tolerance

**Purpose**: Controls snapping precision for measurements and point placement.

**Setting**: File → Settings → Snap Tolerance
- **Low precision (20 pixels)**: Large patterns, approximate layouts
- **Medium (10 pixels)** - Default, general use
- **High precision (5 pixels)**: Detailed work, small areas

**Test**: Use measurement tool to verify snap behavior.

### 1.4 Workspace Preparation

**Clear Previous Data**:
```
File → New Project
  → Confirm "Clear all data and start fresh?"
```

**Initialize Canvas**:
- View → Zoom to Fit (or `Ctrl+0`)
- View → Center View
- Check 2D/3D toggle state (default: 2D)

---

## Stage 2: Import Data

### 2.1 Import Existing Blast Holes

**CSV Import** (File → Import → Blast Holes):

**Supported Formats**:
1. **4-column**: ID, X, Y, Z (dummy holes)
   ```
   1, 100.0, 200.0, 50.0
   2, 105.0, 200.0, 50.0
   ```

2. **7-column**: ID, X, Y, Z, toeX, toeY, toeZ (full holes)
   ```
   1, 100.0, 200.0, 50.0, 105.0, 200.0, 40.0
   ```

3. **9-column**: Adds Diameter, Type
   ```
   1, 100.0, 200.0, 50.0, 105.0, 200.0, 40.0, 115, Production
   ```

4. **12-column**: Adds FromHole, Delay, Color
   ```
   1, 100.0, 200.0, 50.0, 105.0, 200.0, 40.0, 115, Production, 0, 0, #FF0000
   ```

5. **14-column**: Adds entityName, entityType (full format)
   ```
   Blast_001, Pattern, 1, 100.0, 200.0, 50.0, 105.0, 200.0, 40.0, 115, Production, 0, 0, #FF0000
   ```

**Import Process**:
1. File → Import → Blast Holes
2. Select CSV file
3. System auto-detects column count
4. Holes appear on canvas immediately
5. Check TreeView panel for new entity

**Duplicate Detection**:
- Kirra warns if hole IDs already exist
- Options: Skip, Replace, Rename automatically

### 2.2 Import Reference Drawings

**DXF Import** (File → Import → DXF):
- Imports CAD reference drawings (pit shells, roads, boundaries)
- Creates new layer automatically
- Supported entities: POINT, LINE, LWPOLYLINE, POLYLINE, CIRCLE, TEXT

**KAD Import** (File → Import → KAD Drawing):
- Imports native Kirra drawing format
- Includes layers, entities, and metadata
- Preserves all styling and properties

**Import Tips**:
- Import reference geometry before creating patterns
- Use layers to organize imported data
- Toggle visibility as needed (TreeView panel)

### 2.3 Import Surfaces

**DTM/STR Import** (File → Import → Surface):
- Surpac triangulated surfaces
- Binary or ASCII format supported
- Auto-triangulates and displays with elevation gradient

**OBJ Import** (File → Import → OBJ Mesh):
- 3D meshes with texture mapping
- Requires OBJ + MTL + texture images (JPG/PNG)
- Displays textured surface in 3D view

**Surface Tips**:
- Surfaces are heavy - limit to 1-2 active surfaces
- Use hillshade gradient for terrain visualization
- Toggle transparency for overlaying patterns

### 2.4 Import Imagery

**GeoTIFF Import** (File → Import → GeoTIFF):
- Georeferenced aerial imagery
- Automatically positioned using geotransform
- Displayed as base layer in 2D view

---

## Stage 3: Pattern Creation

### 3.1 Rectangular Grid Pattern

**Use Case**: Standard bench blasting, regular layouts

**Method**: Pattern → Add Pattern

**Parameters**:
| Parameter | Description | Typical Value |
|-----------|-------------|---------------|
| Pattern Name | Entity identifier | "Bench_150_North" |
| Start X | Origin easting | Site coordinates |
| Start Y | Origin northing | Site coordinates |
| Start Z | Collar elevation | 150.0 m |
| Rows | Number of rows | 5-10 |
| Holes per Row | Holes in each row | 10-20 |
| Burden | Row spacing (m) | 5.0 m |
| Spacing | Hole spacing (m) | 6.0 m |
| Hole Length | Depth (m) | 12.0 m |
| Angle | From vertical (°) | 0° (vertical) |
| Bearing | Direction (°) | 0° (north) |
| Diameter | Hole diameter (mm) | 115 mm |
| Hole Type | Production type | "Production" |
| Pattern Angle | Grid rotation (°) | 0° |

**Steps**:
1. Pattern → Add Pattern
2. Enter pattern name (e.g., "Bench_150")
3. Set starting position (X, Y, Z)
4. Configure rows and holes per row
5. Set burden and spacing
6. Enter hole specifications (length, angle, diameter)
7. Click "Generate Pattern"
8. Holes appear immediately on canvas

**Grid Rotation**:
- Pattern Angle rotates entire grid around start point
- 0° = grid aligned north-south
- 45° = diagonal grid
- Use for angled benches or toe-to-toe patterns

### 3.2 Polygon Pattern

**Use Case**: Irregular areas, custom boundaries

**Method**: Pattern → Generate Pattern in Polygon

**Prerequisites**:
1. Create polygon boundary:
   - Draw → Polygon Tool
   - Click points to define area
   - Double-click to close polygon
   OR
   - Import DXF with LWPOLYLINE boundary

**Parameters**:
- Burden (m): Row spacing
- Spacing (m): Hole spacing
- Spacing Offset (m): Stagger offset for alternate rows
- Collar Elevation (m): Fixed or from surface
- Use Grade Control: Enable to drape pattern on surface

**Steps**:
1. Select polygon entity in TreeView
2. Pattern → Generate Pattern in Polygon
3. Enter burden, spacing, offset
4. Choose grade control mode:
   - **Fixed Elevation**: All collars at same Z
   - **Surface Grade**: Collars follow surface topography
5. Click "Generate"
6. Holes fill polygon with specified spacing

**Duplicate Detection**:
- Automatically checks for existing holes at positions
- Warns if conflicts found
- Options: Skip duplicates, Replace, or Cancel

### 3.3 Line Pattern

**Use Case**: Single row, buffer holes, presplit

**Method**: Pattern → Holes Along Line

**Steps**:
1. Draw → Line Tool
2. Click two points to define line
3. Pattern → Holes Along Line
4. Select line entity
5. Enter spacing and hole count
6. Holes placed along line at equal intervals

**Variations**:
- **Presplit**: Set type to "Presplit", tight spacing (1-2m)
- **Buffer Row**: Set type to "Buffer", intermediate spacing (3-4m)
- **Production Row**: Standard spacing (5-7m)

### 3.4 Polyline Pattern

**Use Case**: Curved boundaries, road following, irregular layouts

**Method**: Pattern → Holes Along Polyline

**Steps**:
1. Draw → Polyline Tool
2. Click multiple points to define path
3. Pattern → Holes Along Polyline
4. Select polyline entity
5. Enter spacing
6. Holes placed along path at equal intervals

**Curve Handling**:
- Spacing measured along polyline (chord distance)
- Holes aligned to local tangent direction
- Bearing calculated automatically at each point

---

## Stage 4: Editing

### 4.1 Individual Hole Editing

**Selection**:
- Click hole on canvas
- OR select in TreeView panel
- Selected hole highlights in yellow

**Property Editor**:
- Edit → Hole Properties (or double-click hole)
- Modify any field:
  - Collar position (X, Y, Z)
  - Toe position (endX, endY, endZ)
  - Angle, Bearing, Diameter
  - Hole Type, Color
- Click "Apply" to save changes
- Geometry recalculated automatically

**Direct Manipulation**:
- Drag hole collar to move (Shift+Drag)
- Right-click → Delete Hole
- Ctrl+C, Ctrl+V to copy/paste

### 4.2 Bulk Hole Operations

**Select Multiple Holes**:
- Draw selection box (Shift+Drag rectangle)
- Ctrl+Click to add/remove from selection
- TreeView: Select entity to select all holes in entity

**Bulk Edit**:
- Edit → Bulk Edit Selected Holes
- Modify properties for all selected:
  - Change hole type (e.g., Production → Presplit)
  - Update diameter (e.g., 115mm → 165mm)
  - Adjust angle (e.g., 0° → 5°)
  - Set color for visualization

**Bulk Delete**:
- Select holes
- Edit → Delete Selected Holes
- Confirm deletion

**Bulk Move**:
- Select holes
- Drag to new position
- Maintains relative spacing

### 4.3 Timing Configuration

**Sequential Timing**:
1. Select first hole (hole 1)
2. Timing → Set Firing Sequence
3. Click holes in firing order
4. System sets fromHoleID and delay
5. Connector lines show sequence

**Auto-Timing Algorithms**:

**Row-by-Row**:
- Timing → Auto-Time → By Rows
- Fires row 1, then row 2, etc.
- Configurable inter-row delay (e.g., 25ms per row)
- Configurable intra-hole delay (e.g., 42ms per hole)

**Echelon (Diagonal)**:
- Timing → Auto-Time → Echelon
- Fires diagonally across pattern
- Creates smooth face movement
- Ideal for production blasting

**V-Cut (Chevron)**:
- Timing → Auto-Time → V-Cut
- Fires from center outward in V-shape
- Creates relief for burden
- Ideal for tunnel blasting

**Manual Timing Adjustment**:
- Double-click connector line
- Edit delay milliseconds
- Change fromHole reference
- Recalculates total timing

### 4.4 Grade Control

**Surface-Based Collars**:
1. Import DTM/STR surface
2. Select holes
3. Edit → Apply Grade from Surface
4. Collar Z values updated to surface elevation
5. Hole angles recalculated to maintain toe position

**Fixed Subdrill**:
- Edit → Set Subdrill Amount
- Enter subdrill value (e.g., 1.5m)
- Applies to all selected holes
- Toe positions recalculated: toeZ = gradeZ - subdrill

**Bench Height Adjustment**:
- Edit → Set Bench Height
- Enter bench height (e.g., 10m)
- Collar Z recalculated: collarZ = gradeZ + benchHeight
- Maintains toe positions

---

## Stage 5: Charging (Optional)

### 5.1 Charge Configuration

**Load Charge Rules**:
1. Charging → Load Charge Config
2. Select CSV file with charge rules
3. Rules available in Charge Deck Builder

**Charge Config CSV Format**:
```csv
Rule Name, Inert Decks, Coupled Decks, Decoupled Decks, Spacer Decks
Standard_Production, [{...}], [{...}], [{...}], [{...}]
```
See [Charge Config CSV Reference](Charge-Config-CSV-Reference) for complete specification.

### 5.2 Apply Charge to Holes

**Single Hole Charging**:
1. Select hole
2. Charging → Open Deck Builder
3. Choose charge rule from dropdown
4. Preview deck layout
5. Click "Apply to Hole"

**Bulk Charging**:
1. Select multiple holes
2. Charging → Apply Charge Rule
3. Select rule
4. Apply to all selected holes

**Deck Types**:
- **Inert**: Stemming, gravel, crushed rock
- **Coupled**: Bulk explosive (ANFO, emulsion)
- **Decoupled**: Packaged explosive (cartridges, boosters)
- **Spacer**: Gas bags, stem caps, deck separators

### 5.3 Charge Visualization

**2D Deck View**:
- Shows deck layout along hole
- Color-coded by deck type
- Labels with mass and product name

**3D Charge View**:
- Toggle to 3D view
- Charge decks rendered as cylinders
- Rotate to inspect from any angle

**Charge Summary**:
- Statistics → Charge Statistics
- Total explosive mass
- Mass per hole type
- Powder factor (kg/m³)

---

## Stage 6: Verification

### 6.1 Pattern Statistics

**View Statistics**:
- Statistics → Pattern Statistics
- OR click "Stats" button in toolbar

**Key Metrics**:
| Metric | Description | Check |
|--------|-------------|-------|
| Total Holes | Count of holes | Match design |
| Avg Burden | Mean row spacing | Within tolerance |
| Avg Spacing | Mean hole spacing | Within tolerance |
| Avg Hole Length | Mean depth | Consistent |
| Total Rock | Cubic meters | Match volume estimate |
| Powder Factor | kg explosive / m³ rock | 0.3-0.8 typical |

**Per-Entity Statistics**:
- TreeView → Right-click entity → "Show Statistics"
- Breakdown by pattern/entity
- Useful for multi-pattern blasts

### 6.2 Voronoi Analysis

**Purpose**: Verify rock distribution per hole

**Run Analysis**:
1. Tools → Voronoi Analysis
2. System generates Voronoi cells
3. Display rock volume per hole
4. Identify under/over-loaded holes

**Interpretation**:
- **Large cells**: Hole handles more rock (increase charge)
- **Small cells**: Hole handles less rock (reduce charge)
- **Irregular cells**: Spacing inconsistencies

**Voronoi Metrics**:
- Cell area (m²)
- Rock volume (m³) per hole
- Burden/spacing ratios
- Powder factor per cell

### 6.3 Timing Verification

**Visual Check**:
- View → Show Timing (Ctrl+T)
- View → Show Connectors (Ctrl+C)
- Verify sequence flows logically
- Check for crossed connectors (indicates conflict)

**Timing Statistics**:
- Statistics → Timing Analysis
- Total blast duration
- Max instantaneous delay
- Delay histogram
- Critical path analysis

**Common Issues**:
- **Missing connectors**: Orphaned holes not in sequence
- **Circular references**: fromHole points back to self
- **Excessive delays**: Total time > 5 seconds (vibration concern)

### 6.4 Collision Detection

**Check for Issues**:
1. Tools → Check Pattern
2. System checks:
   - Duplicate hole IDs
   - Overlapping hole positions (< 0.5m apart)
   - Holes outside blast boundaries
   - Invalid geometry (zero-length holes)

**Fix Issues**:
- Duplicate IDs: Renumber automatically
- Overlapping: Manual adjustment or deletion
- Outside boundary: Review pattern generation

---

## Stage 7: Documentation

### 7.1 PDF Report Generation

**Create Report**:
1. File → Export → Print/PDF
2. Configure options:
   - Orientation (landscape/portrait)
   - Include statistics
   - Include legend
   - Include metadata
3. Click "Generate PDF"

**Report Sections**:
- **Header**: Project name, date, author
- **Canvas View**: Blast pattern visualization
- **Statistics Table**: Comprehensive metrics
- **Timing Diagram**: Sequence visualization
- **Footer**: Copyright, timestamp

**Vector Quality**:
- PDF uses SVG rendering (not rasterized)
- Scalable to any size without pixelation
- Ideal for printing and archival

### 7.2 Screenshots

**2D Canvas Screenshot**:
- View → Screenshot → 2D View
- Saves PNG to downloads
- Resolution matches screen

**3D View Screenshot**:
- Switch to 3D view
- Position camera
- View → Screenshot → 3D View
- Saves current viewport

**High-Resolution Export**:
- File → Export → GeoTIFF (for surfaces)
- Select DPI (300+ for printing)
- Georeferenced output

### 7.3 Metadata Export

**Project Summary**:
- File → Export → Project Summary
- JSON file with:
  - Hole count and distribution
  - Pattern parameters
  - Statistics summary
  - Timestamp and user info

**Useful For**:
- Project archival
- Data analysis in external tools
- Reporting to management

---

## Stage 8: Export

### 8.1 KIRRA Format (Recommended)

**Purpose**: Native format preserving ALL data

**Export**:
- File → Export → KAD Drawing
- Saves:
  - Blast holes with complete properties
  - Drawings and annotations
  - Surface references (not texture data)
  - Layers and organization
  - Charge configurations
  - Metadata

**File Structure**:
```json
{
  "version": "1.0",
  "blastHoles": [...],
  "drawings": [...],
  "surfaces": ["surface_ids"],
  "layers": {...},
  "metadata": {...}
}
```

**Round-Trip Editing**:
1. Export to KAD
2. Send to colleague
3. They import KAD
4. Make edits
5. Export KAD
6. You re-import with changes

### 8.2 CSV Export

**Format Options**:

**KIRRA CSV (14-column)**:
```
entityName, entityType, holeID, X, Y, Z, toeX, toeY, toeZ, diameter, type, fromHole, delay, color
```
- Complete data for re-import
- Use for archival and data exchange

**EXTRA CSV (All Fields)**:
```
entityName, entityType, holeID, X, Y, Z, toeX, toeY, toeZ, gradeX, gradeY, gradeZ, 
length, angle, bearing, diameter, type, subdrill, benchHeight, burden, spacing, 
rowID, posID, fromHole, delay, totalTime, color, measuredLength, measuredMass, ...
```
- Every field exported
- Use for analysis in Excel/Python
- Not recommended for re-import (redundant calculated fields)

**Measurements CSV**:
```
holeID, measuredLength, measuredLengthTimestamp, measuredMass, measuredMassTimestamp, comments
```
- Field measurement data only
- For uploading to drill rigs or field tablets

### 8.3 DXF Export

**Purpose**: CAD compatibility (AutoCAD, MicroStation, etc.)

**Export**:
- File → Export → DXF
- Exports:
  - Holes as POINT entities (collar and toe)
  - Timing connectors as LINE entities
  - Annotations as TEXT entities
  - Drawings as POLYLINE/LWPOLYLINE

**Layer Organization**:
```
HOLES_COLLAR   - Collar points
HOLES_TOE      - Toe points
HOLES_LINES    - Hole traces (collar to toe)
CONNECTORS     - Timing connectors
ANNOTATIONS    - Labels and text
DRAWINGS       - Imported drawing entities
```

**DXF Version**:
- ASCII DXF R2000 format
- Compatible with AutoCAD 2000+
- Supports all entity types

### 8.4 GeoTIFF Export (Surfaces)

**Purpose**: Georeferenced raster imagery

**Export**:
1. Load surface (DTM, OBJ)
2. Apply gradient (hillshade, viridis, etc.)
3. File → Export → Export Images as GeoTIFF
4. Select resolution:
   - Screen resolution (fast)
   - DPI (e.g., 300 DPI for printing)
   - Pixels per meter (e.g., 10 px/m)
5. Enter EPSG code (e.g., EPSG:32755 for UTM 55S)
6. Export

**Use Cases**:
- Import into GIS (QGIS, ArcGIS)
- Overlay in Google Earth (convert to KML)
- Base maps for reports

### 8.5 Batch Export

**Export All Formats**:
1. File → Export → Batch Export
2. Select formats:
   - ✅ KAD (native)
   - ✅ CSV (KIRRA 14-column)
   - ✅ DXF
   - ✅ PDF Report
3. Choose output folder
4. Click "Export All"
5. All formats generated simultaneously

**Naming Convention**:
```
ProjectName_YYYY-MM-DD_HHmmss.kad
ProjectName_YYYY-MM-DD_HHmmss.csv
ProjectName_YYYY-MM-DD_HHmmss.dxf
ProjectName_YYYY-MM-DD_HHmmss.pdf
```

---

## Advanced Workflow Tips

### Save Frequently

**Auto-Save**:
- Enable in Settings → Auto-Save
- Saves to IndexedDB every 5 minutes
- Prevents data loss on browser crash

**Manual Save**:
- File → Save Project (Ctrl+S)
- Saves all data to IndexedDB
- Quick and non-destructive

### Use Layers for Organization

**Layer Strategy**:
```
Layer: Production_Blast_Jan2025
  ├─ Production holes
  └─ Production timing

Layer: Presplit_Boundary
  ├─ Presplit holes
  └─ Presplit timing

Layer: Reference_Drawings
  ├─ Pit shell (DXF)
  ├─ Roads (DXF)
  └─ Survey points (CSV)
```

**Benefits**:
- Toggle visibility by layer
- Export layer independently
- Organize complex multi-stage blasts

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New project |
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save project |
| `Ctrl+I` | Toggle hole IDs |
| `Ctrl+T` | Toggle timing |
| `Ctrl+C` | Toggle connectors |
| `Ctrl+0` | Zoom to fit |
| `Ctrl+Z` | Undo (limited) |
| `Delete` | Delete selected holes |
| `Shift+Drag` | Select multiple holes |

### Quality Checks Checklist

Before finalizing design:

- [ ] All holes have valid IDs
- [ ] No duplicate hole positions
- [ ] Timing sequence complete (no orphans)
- [ ] Burden/spacing within tolerance (±10%)
- [ ] Hole lengths appropriate for bench height
- [ ] Subdrill values correct for grade
- [ ] Powder factor reasonable (0.3-0.8 kg/m³)
- [ ] Statistics match project requirements
- [ ] PDF report generated and reviewed
- [ ] Exported to CSV and DXF for records

---

## Troubleshooting Common Issues

### Issue: Holes not visible after import

**Causes**:
- Holes outside viewport
- Layer visibility toggled off
- Entity visibility toggled off

**Solutions**:
1. View → Zoom to Fit (Ctrl+0)
2. Check TreeView visibility checkboxes
3. Check layer visibility in TreeView

### Issue: Timing connectors crossed

**Causes**:
- Incorrect firing sequence
- Holes numbered out of order

**Solutions**:
1. Clear timing: Timing → Clear All Timing
2. Re-sequence: Timing → Set Firing Sequence
3. Click holes in correct order

### Issue: Statistics show incorrect volumes

**Causes**:
- Missing surface for grade control
- Incorrect bench height values
- Holes outside blast boundary

**Solutions**:
1. Import DTM surface for grade
2. Edit → Set Bench Height
3. Tools → Check Pattern → Review warnings

### Issue: Export fails or incomplete

**Causes**:
- Browser storage quota exceeded
- Large surfaces not saved

**Solutions**:
1. Check storage: Tools → Check Storage Quota
2. Delete old surfaces
3. Export surfaces separately to OBJ
4. Export holes/drawings to KAD

---

## Related Documentation

- [Pattern Generation](Pattern-Generation) - Detailed pattern creation methods
- [Blast Hole Management](Blast-Hole-Management) - Hole data structures and editing
- [Charging System](Charging-System) - Charge configuration and deck builder
- [Statistics and Reporting](Statistics-and-Reporting) - Analysis and Voronoi metrics
- [Print and PDF System](Print-and-PDF-System) - Report generation
- [File Formats](File-Formats) - Import/export specifications
- [Advanced Features](Advanced-Features) - Duplicate detection, grade control, clustering

---

*For step-by-step tutorials with screenshots, see the [User Interface](User-Interface) guide.*
