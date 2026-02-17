# User Interface

## Overview

Kirra's user interface is built with Vanilla JavaScript and a custom dialog system, providing a responsive and intuitive experience for blast pattern design. The UI supports multiple languages, dark/light themes, and a hierarchical TreeView for data organization.

---

## Menu Bar Structure

The application menu bar provides access to all major functions:

### File Menu

**Import Operations:**
- Import CSV (blast holes with flexible column mapping)
- Import DXF (AutoCAD drawings)
- Import KAD (Kirra App Drawing format)
- Import Surpac DTM/STR (surface triangulations)
- Import OBJ/PLY (3D mesh formats)
- Import Shapefile (ESRI format)
- Import KML/KMZ (Google Earth)
- Import LAS (point clouds)
- Import GeoTIFF (georeferenced imagery)
- Import ShotPlus SPF (blasting software)
- Import Charging Config (charge configuration ZIP)

**Export Operations:**
- Export CSV (blast holes)
- Export DXF (blast holes and drawings)
- Export KAD (vector drawings)
- Export Surpac DTM/STR (surfaces)
- Export OBJ (3D meshes)
- Export GeoTIFF Imagery (surface rasters with gradients)
- Export GeoTIFF Elevation (elevation rasters)
- Export Charging Config (charge configuration ZIP)
- Export PDF (SVG-based vector output)

**File Management:**
- Save Project (all data to IndexedDB)
- Load Project
- New Project (clear all data)

### Edit Menu

**Hole Operations:**
- Add Hole (manual placement)
- Delete Selected
- Rename Entity
- Duplicate Pattern
- Renumber Holes
- Edit Properties (hole attributes dialog)

**Selection Tools:**
- Select All
- Deselect All
- Select by Entity
- Invert Selection

**Editing Tools:**
- Move Holes
- Rotate Pattern
- Scale Pattern
- Mirror Pattern

### View Menu

**Display Toggles:**
- Show/Hide Hole IDs
- Show/Hide Collars
- Show/Hide Toes
- Show/Hide Grades
- Show/Hide Timing Connectors
- Show/Hide Contours
- Show/Hide Surfaces
- Show/Hide Images
- Show/Hide KAD Drawings
- Show/Hide Grid
- Show/Hide Print Preview

**Visualization Options:**
- 2D/3D Mode Toggle
- Dark/Light Theme Toggle
- Toggle Full Screen

**Camera Controls:**
- Zoom In
- Zoom Out
- Zoom to Fit All
- Reset View
- Center on Selection

### Pattern Menu

**Pattern Generation:**
- Add Pattern (rectangular grid)
- Polygon Pattern (irregular shape fill)
- Line Pattern (single line of holes)
- Polyline Pattern (multi-segment line)
- Arc Pattern (curved line)
- Circle Pattern (radial layout)
- Ring Pattern (concentric circles)

**Pattern Tools:**
- Pattern Properties (burden, spacing, angle, diameter)
- Row Detection (automatic row identification)
- Burden/Spacing Calculator

### Settings Menu

**Application Settings:**
- Language Selection (English, Russian, Spanish)
- Theme (Dark/Light Mode)
- Snap Tolerance (pixels)
- Grid Settings (spacing, color)
- Units (metric/imperial)
- Default Hole Properties
- Print Settings

**Display Options:**
- Label Font Size
- Connector Line Width
- Hole Marker Size
- Color Schemes

**Data Management:**
- Clear Cache
- Reset to Defaults
- Database Management

### Help Menu

- User Guide
- Keyboard Shortcuts
- About Kirra
- Version Information
- License Information

---

## TreeView Panel

The TreeView provides hierarchical organization of all project data using a layer-based structure.

### TreeView Architecture

**Layer System:**
- **Blast Layers**: Organize blast hole entities
- **Drawing Layers**: Organize KAD vector entities (points, lines, polygons, circles, text)
- **Surface Layers**: Organize imported surfaces
- **Image Layers**: Organize georeferenced images

### Node Structure

All TreeView nodes use the **Braille Pattern U+28FF character `⣿`** as a separator for composite keys:

| Node Type | ID Format | Example |
|-----------|-----------|---------|
| Blast Entity | `entity⣿entityName` | `entity⣿Pattern_A` |
| Hole | `hole⣿entityName⣿holeID` | `hole⣿Pattern_A⣿H001` |
| KAD Point Entity | `points⣿entityName` | `points⣿SurveyPts` |
| KAD Line Entity | `line⣿entityName` | `line⣿Boundary` |
| KAD Polygon Entity | `poly⣿entityName` | `poly⣿Pit_Shell` |
| KAD Circle Entity | `circle⣿entityName` | `circle⣿DrillHoles` |
| KAD Text Entity | `text⣿entityName` | `text⣿Labels` |
| KAD Element | `entityType⣿entityName⣿element⣿pointID` | `line⣿Boundary⣿element⣿42` |
| Surface | `surface⣿surfaceId` | `surface⣿dtm_001` |
| Image | `image⣿imageId` | `image⣿ortho_01` |

### TreeView Features

**Visibility Control:**
- Eye icon toggles visibility for entities, elements, or layers
- Cascading visibility (hiding entity hides all its children)
- Bulk operations via layer visibility

**Selection:**
- Click node to select entity/element
- Multi-select with Ctrl+Click (planned)
- Right-click for context menu

**Organization:**
- Drag-and-drop to reorder entities (planned)
- Collapsible nodes to manage large datasets
- Search/filter to find specific entities

**Color Swatches:**
- Color indicator next to each entity
- Click swatch to open color picker
- Propagates color to all elements in entity

**Lazy Loading:**
- Large KAD entities (>50 elements) load in chunks
- Chunk nodes: `entityType⣿entityName⣿chunk⣿start-end`
- Improves performance with huge datasets

---

## Theme System

Kirra provides a comprehensive theme system with Dark and Light modes.

### Theme Architecture

**CSS Variables:**
All theme colors are defined using CSS custom properties (variables) for consistent styling:

```css
/* Dark Theme */
--color-background: #1e1e1e;
--color-canvas: #000000;
--color-text: #ffffff;
--color-text-secondary: #cccccc;
--color-border: #3c3c3c;
--color-button: #2d2d2d;
--color-button-hover: #3d3d3d;
--color-input: #2d2d2d;
--color-highlight: #007acc;
--color-selection: rgba(0, 122, 204, 0.3);

/* Light Theme */
--color-background: #f4f4f4;
--color-canvas: #ffffff;
--color-text: #000000;
--color-text-secondary: #666666;
--color-border: #cccccc;
--color-button: #e7e7e7;
--color-button-hover: #d0d0d0;
--color-input: #ffffff;
--color-highlight: #007acc;
--color-selection: rgba(0, 122, 204, 0.2);
```

### Theme Switching

**Toggle Methods:**
1. View Menu → Toggle Dark/Light Mode
2. Keyboard Shortcut: `Ctrl+Shift+T`
3. Settings → Theme Selection

**Persistence:**
Theme preference is saved to `localStorage` and persists across sessions.

### Canvas Theme Integration

**2D Canvas:**
- Background color matches theme
- Text color inverts based on theme
- Grid color adjusts for visibility

**3D Three.js:**
- Scene background color matches theme
- Lighting adjusts for theme (darker ambient in light mode)
- Text labels use theme-appropriate colors

### Component Styling

All UI components respect theme variables:
- Dialogs and floating windows
- Buttons and inputs
- TreeView panel
- Context menus
- Tooltips
- Status bar

---

## Internationalization (i18n)

Kirra supports multiple languages with full UI translation.

### Supported Languages

| Language | Code | Status |
|----------|------|--------|
| English | `en` | Default, 100% complete |
| Russian | `ru` | 100% complete (Русский) |
| Spanish | `es` | 100% complete (Español) |

### Translation Architecture

**Translation Keys:**
All UI text uses translation keys that map to language-specific strings:

```javascript
// Translation key examples
"menu.file.import"
"menu.file.export"
"dialog.pattern.title"
"dialog.pattern.burden"
"dialog.pattern.spacing"
"message.import.success"
"error.file.invalid"
```

**Translation Loading:**
- Language files stored as JSON
- Loaded on application startup
- Can be switched dynamically without reload

### Language Switching

**Change Methods:**
1. Settings Menu → Language
2. Language selector in header bar

**Persistence:**
Language preference saved to `localStorage`.

### Translated Elements

**Full Coverage:**
- All menu items and submenus
- Dialog titles and content
- Button labels
- Form field labels and placeholders
- Tooltips and help text
- Status messages and notifications
- Error messages and warnings
- Context menus

**Units and Formats:**
- Number formatting (decimal separator)
- Date/time formatting
- Unit labels (metres, feet, etc.)

### Adding New Languages

To add a new language:
1. Create translation JSON file
2. Map all translation keys to target language
3. Add language option to settings menu
4. Test all UI elements for proper display

---

## Dialog System

Kirra uses a custom `FloatingDialog` class for all modal interactions.

### FloatingDialog Architecture

**Features:**
- Draggable by title bar
- Resizable from corners/edges
- Modal and non-modal modes
- Multiple button configurations
- Theme-aware styling
- Keyboard navigation (Tab, Enter, Escape)

**Dialog Types:**

| Type | Usage |
|------|-------|
| Confirmation | Yes/No/Cancel actions |
| Form | Data entry with multiple fields |
| Info | Display messages |
| Warning | User warnings |
| Error | Error messages |
| Custom | Complex multi-section layouts |

### Dialog Components

**Standard Components:**
- Text inputs
- Number inputs (with validation)
- Dropdowns/selects
- Checkboxes
- Sliders
- Color pickers
- File inputs
- Date pickers

**Form Builder:**
`createEnhancedFormContent(fields)` generates form HTML from field definitions:

```javascript
var fields = [
  { name: "burden", label: "Burden (m)", type: "number", value: 3.5, min: 0 },
  { name: "spacing", label: "Spacing (m)", type: "number", value: 4.0, min: 0 },
  { name: "angle", label: "Angle (°)", type: "number", value: 0, min: 0, max: 90 },
  { name: "pattern", label: "Pattern", type: "select", options: ["Square", "Staggered"] }
];
var content = createEnhancedFormContent(fields);
```

**Form Data Extraction:**
`getFormData(formElement)` extracts values from form:

```javascript
var data = getFormData(dialog.element.querySelector("form"));
// Returns: { burden: 3.5, spacing: 4.0, angle: 0, pattern: "Square" }
```

### Common Dialog Patterns

**Confirmation Dialog:**
```javascript
showConfirmationDialog("Delete Entity", "Are you sure?", function() {
  // Confirmed
}, function() {
  // Cancelled
});
```

**Property Editor:**
```javascript
var dialog = new FloatingDialog({
  title: "Hole Properties",
  content: createEnhancedFormContent(fields),
  width: 400,
  height: 500,
  onConfirm: function() {
    var data = getFormData(formContent);
    // Apply changes
  }
});
dialog.show();
```

**Multi-Button Dialog:**
```javascript
var dialog = new FloatingDialog({
  title: "Save Changes?",
  content: "You have unsaved changes.",
  showConfirm: true,
  showDeny: true,
  showCancel: true,
  confirmText: "Save",
  denyText: "Don't Save",
  cancelText: "Cancel",
  onConfirm: function() { /* Save */ },
  onDeny: function() { /* Discard */ },
  onCancel: function() { /* Cancel */ }
});
dialog.show();
```

---

## Display Options and Toggles

The View menu provides extensive control over what is displayed on the canvas.

### Hole Display Options

**Marker Types:**
- Collar (start point) markers
- Toe (end point) markers
- Grade (floor intersection) markers
- Full hole lines (collar to toe)

**Label Options:**
- Hole IDs
- Hole angles
- Hole lengths
- Burden values
- Spacing values
- Timing delays
- Charge masses

### Connector Display

**Timing Connectors:**
- Show/hide all connectors
- Color by delay value
- Line width settings
- Curve amount control

**Connector Types:**
- Straight lines
- Bezier curves (variable curvature)
- Arrows indicating direction

### Pattern Display

**Contours:**
- Show/hide timing contours
- Contour interval setting
- Contour label toggle
- Direction arrows

**Triangulation:**
- Show/hide Delaunay triangles
- Edge length limit
- Color by timing

### Surface Display

**Surface Options:**
- Gradient selection (texture, viridis, turbo, hillshade, etc.)
- Transparency control (0-100%)
- Elevation limits (min/max clamping)
- Wireframe overlay

**Surface Gradients:**
- `texture` — Use imported OBJ/MTL texture
- `viridis` — Scientific colormap (blue-yellow-green)
- `turbo` — Google colormap (blue-cyan-yellow-red)
- `parula` — MATLAB colormap
- `terrain` — Topographic elevation
- `hillshade` — Lighting-based shading

### Drawing Display

**KAD Entities:**
- Points (show/hide, size control)
- Lines (width, color, closed/open)
- Polygons (fill, outline, transparency)
- Circles (radius, fill)
- Text (font size, color)

### Image Display

**GeoTIFF Images:**
- Opacity control
- Layering order
- Resampling mode

### Grid Display

**Canvas Grid:**
- Show/hide grid
- Grid spacing (auto or manual)
- Grid color (theme-aware)
- Major/minor lines

### Print Preview

**Print Boundary:**
- Show/hide print area
- Paper size selection (A0-A4)
- Orientation (landscape/portrait)
- Margin settings

---

## Context Menus

Right-click context menus provide quick access to common operations.

### Canvas Context Menu

**2D Canvas Right-Click:**
- Add Hole Here
- Paste (if holes copied)
- Zoom to Fit
- Reset View

### Hole Context Menu

**Right-Click on Hole:**
- Edit Properties
- Delete
- Copy
- Duplicate
- Renumber
- Change Entity
- Change Color

### Entity Context Menu (TreeView)

**Right-Click on Entity Node:**
- Rename Entity
- Delete Entity
- Export Entity
- Change Color
- Duplicate Entity
- Hide/Show Entity

### Surface Context Menu

**Right-Click on Surface:**
- Surface Properties
- Change Gradient
- Set Transparency
- Delete Surface
- Export Surface

### KAD Context Menu

**Right-Click on KAD Element:**
- Edit Element
- Delete Element
- Change Color
- Change Line Width
- Convert Type (point↔line↔poly)

---

## Status Bar

The bottom status bar displays real-time information:

**Left Section:**
- Current mode (Pan, Select, Add Hole, etc.)
- Tool status
- Snap status

**Center Section:**
- Mouse coordinates (world X, Y, Z)
- Selected object information
- Operation status

**Right Section:**
- Zoom level
- Frame rate (in 3D mode)
- Active layer count

---

## Keyboard Shortcuts

### General
- `Ctrl+N` — New Project
- `Ctrl+O` — Open Project
- `Ctrl+S` — Save Project
- `Ctrl+Z` — Undo
- `Ctrl+Y` — Redo
- `Escape` — Cancel Current Operation

### View
- `Ctrl+Shift+T` — Toggle Dark/Light Theme
- `F` — Zoom to Fit All
- `Ctrl++` — Zoom In
- `Ctrl+-` — Zoom Out
- `Home` — Reset View
- `Space` — Pan (hold and drag)

### Selection
- `Ctrl+A` — Select All
- `Ctrl+D` — Deselect All
- `Delete` — Delete Selected

### Editing
- `Ctrl+C` — Copy
- `Ctrl+V` — Paste
- `Ctrl+X` — Cut
- `Ctrl+Shift+D` — Duplicate

### Tools
- `H` — Add Hole Mode
- `R` — Ruler Tool
- `P` — Protractor Tool
- `M` — Measurement Tool

---

See also:
- [Application Architecture](Application-Architecture) — UI component structure
- [Home](Home) — Getting started guide
