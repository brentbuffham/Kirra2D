# Print and PDF System

## Overview

Kirra's print system generates high-quality vector PDF output using SVG-based rendering. The system supports multiple paper sizes, flexible layouts, and comprehensive print statistics.

---

## SVG-Based PDF Generation

### Architecture

**Vector Pipeline:**
1. **Canvas → SVG**: Convert 2D/3D rendering to SVG elements
2. **SVG → PDF**: Use jsPDF with SVG plugin for vector output
3. **Result**: Resolution-independent, scalable PDF documents

**Advantages:**
- Crisp lines at any zoom level
- Small file sizes
- Editable in vector graphics software
- Professional print quality

### SVG Components

**Geometric Elements:**
- Lines (`<line>`, `<polyline>`)
- Circles (`<circle>`)
- Polygons (`<polygon>`)
- Paths (`<path>` for complex shapes)
- Text (`<text>` with proper font embedding)

**Styling:**
- Stroke color and width
- Fill color and opacity
- Line caps and joins
- Dash patterns

---

## Print System Architecture

### Core Modules

| File | Purpose |
|------|---------|
| `src/print/PrintSystem.js` | Main print orchestration, state management |
| `src/print/PrintRendering.js` | Canvas-to-SVG conversion (`drawDataForPrinting`, `printDataSVG`) |
| `src/print/PrintStats.js` | Statistics rendering (`printBlastStatsSVG`, `printHeaderSVG`, `printFooterSVG`) |
| `src/print/PrintVectorPDF.js` | SVG-to-PDF generation (`generateTrueVectorPDF`) |
| `src/print/PrintTemplates.js` | Layout templates and paper sizes (`getTemplate`, `PAPER_SIZES`) |
| `src/print/PrintLayoutManager.js` | Layout calculations (`PrintLayoutManager` class) |
| `src/print/PrintDialog.js` | Print preview and settings dialog (`showPrintDialog`) |
| `src/print/PrintCaptureManager.js` | Canvas capture and processing (`PrintCaptureManager` class) |
| `src/print/SVGBuilder.js` | SVG element construction helpers |

---

## Print Areas

Print layout divided into distinct areas:

### 1. Header Section

**Content:**
- Project title
- Blast entity name
- Date and time
- Author/company information
- Project metadata

**SVG Function:** `printHeaderSVG()`

**Layout:**
```
┌─────────────────────────────────────┐
│  PROJECT: Mine Site Alpha          │
│  BLAST: Pattern_A                  │
│  DATE: 2025-02-15                  │
└─────────────────────────────────────┘
```

**Customization:**
- Font size
- Text alignment
- Logo insertion
- Header height

### 2. Canvas Area

**Content:**
- Blast pattern visualization
- Holes (collars, toes, grades)
- Timing connectors
- Surfaces
- KAD drawings
- Scale bar
- North arrow
- Legend

**SVG Functions:**
- `drawSurfaceSVG()` — Surface triangulations
- `printBoundarySVG()` — Print boundary outline
- `printDataSVG()` — Main data rendering (holes, connectors, etc.)

**Layout:**
```
┌─────────────────────────────────────┐
│                                     │
│        [Blast Pattern]              │
│                                     │
│     ●──●──●──●──●                   │
│     │  │  │  │  │                   │
│     ●──●──●──●──●                   │
│                                     │
│  Scale: 1:500     N                 │
│  ┌──────┐         ↑                 │
│  0   50m                            │
└─────────────────────────────────────┘
```

**Viewport:**
- Respects print boundary margins
- Scales to fit selected paper size
- Maintains aspect ratio
- WYSIWYG (What You See Is What You Get)

### 3. Statistics Section

**Content:**
- Per-entity statistics
- Hole count
- Total length and volume
- Burden/spacing averages
- Timing summary
- Charge statistics (if charging data present)
- Voronoi metrics

**SVG Function:** `printBlastStatsSVG()`

**Layout Options:**

**Full Statistics:**
```
┌─────────────────────────────────────┐
│  STATISTICS                         │
│  Entity: Pattern_A                  │
│  Holes: 156                         │
│  Total Length: 1,234.56 m           │
│  Average Length: 7.92 m             │
│  Avg Burden: 3.5 m                  │
│  Avg Spacing: 4.0 m                 │
│  Rock Volume: 22,995 m³             │
│  Total Explosive: 7,234 kg          │
│  Powder Factor: 0.31 kg/m³          │
└─────────────────────────────────────┘
```

**Simple Statistics:**
`printBlastStatsSimpleSVG()` — Compact summary

```
┌─────────────────────────────────────┐
│  156 holes | 1,234m | 7,234kg       │
└─────────────────────────────────────┘
```

### 4. Footer Section

**Content:**
- Copyright notice
- Application name and version
- Timestamp
- Page number (for multi-page documents)
- Custom footer text

**SVG Function:** `printFooterSVG()`

**Layout:**
```
┌─────────────────────────────────────┐
│  Kirra v1.0 | © 2025 Brent Buffham  │
│  Printed: 2025-02-15 14:32:45       │
└─────────────────────────────────────┘
```

---

## Print Statistics Rendering

### Statistics Calculation

**Process:**
1. Group holes by entity
2. Calculate per-entity statistics (see [Statistics-and-Reporting.md](Statistics-and-Reporting.md))
3. Format values with appropriate units and precision
4. Render to SVG elements

**Statistics Included:**
- Hole count (total and by type)
- Total length and average
- Total drill volume
- Burden/spacing averages and modes
- Timing range
- Connector counts
- Voronoi metrics (if calculated)
- Charge statistics (if charging data present)

### Layout Styles

**Table Format:**
```svg
<text x="10" y="20">Entity: Pattern_A</text>
<text x="10" y="40">Holes: 156</text>
<text x="10" y="60">Total Length: 1,234.56 m</text>
```

**Two-Column Format:**
```svg
<text x="10" y="20">Holes:</text>
<text x="150" y="20" text-anchor="end">156</text>
<text x="10" y="40">Total Length:</text>
<text x="150" y="40" text-anchor="end">1,234.56 m</text>
```

**Compact Format:**
One-line summary for minimal layouts.

---

## PDF Generation Workflow

### Step-by-Step Process

**1. Activate Print Preview**
- User clicks "Print Preview" button
- Print boundary overlay displayed on canvas
- WYSIWYG layout shown

**2. Configure Print Settings**
- Open `PrintDialog` (Settings → Print Settings)
- Select paper size (A0-A4)
- Choose orientation (landscape/portrait)
- Select template (2D/3D)
- Enable/disable statistics section

**3. Calculate Layout**
- `PrintLayoutManager` calculates zones
- Header zone, canvas zone, statistics zone, footer zone
- Margins applied (configurable)
- Preview positions rendered on canvas

**4. Generate PDF**
- User clicks "Export PDF"
- Show progress indicator
- Execute generation pipeline:

**Generation Pipeline:**
```javascript
// Step A) Create high-resolution print canvas
var printCanvas = document.createElement("canvas");
printCanvas.width = paperWidth * dpi / 25.4;  // Convert mm to pixels
printCanvas.height = paperHeight * dpi / 25.4;

// Step B) Render to print canvas
drawDataForPrinting(printCanvas, printCtx, layoutManager);

// Step C) Convert canvas to SVG
var svgElements = [];
svgElements.push(printHeaderSVG(layoutManager.header));
svgElements.push(printDataSVG(layoutManager.canvas));
svgElements.push(printBlastStatsSVG(layoutManager.stats));
svgElements.push(printFooterSVG(layoutManager.footer));

// Step D) Create PDF document
var pdf = generateTrueVectorPDF(svgElements, paperSize, orientation);

// Step E) Save PDF file
pdf.save("Kirra_Blast_Pattern.pdf");
```

**5. Download PDF**
- PDF file generated
- Browser download dialog
- Default filename: `Kirra_Blast_Pattern_YYYYMMDD_HHMMSS.pdf`

---

## Paper Sizes and Templates

### Supported Paper Sizes

| Size | Width (mm) | Height (mm) | Landscape | Portrait |
|------|------------|-------------|-----------|----------|
| A0 | 841 | 1189 | 1189 × 841 | 841 × 1189 |
| A1 | 594 | 841 | 841 × 594 | 594 × 841 |
| A2 | 420 | 594 | 594 × 420 | 420 × 594 |
| A3 | 297 | 420 | 420 × 297 | 297 × 420 |
| A4 | 210 | 297 | 297 × 210 | 210 × 297 |

**Default:** A4 Landscape

### Layout Templates

**2D Template:**
- Header: 10% of height
- Canvas: 70% of height
- Statistics: 15% of height
- Footer: 5% of height

**3D Template:**
- Header: 8% of height
- Canvas: 77% of height
- Statistics: 10% of height
- Footer: 5% of height

**Compact Template:**
- Header: 5% of height
- Canvas: 85% of height
- Statistics: inline in header
- Footer: 5% of height

**Custom Template:**
User-defined zone percentages.

---

## Print Boundary Calculations

### Print-Safe Area

**getPrintBoundary(canvas):**

Calculates the print-safe boundary for coordinate transformation.

**Process:**
1. Check if print preview is active
2. Determine current mode (2D/3D)
3. Get layout manager for paper size/orientation
4. Calculate full preview positions
5. Return map zone (outer) and mapInner (data area)

**Return Value:**
```javascript
{
  x: mapZone.x,
  y: mapZone.y,
  width: mapZone.width,
  height: mapZone.height,
  innerX: mapInner.x,
  innerY: mapInner.y,
  innerWidth: mapInner.width,
  innerHeight: mapInner.height,
  marginPercent: marginPercent
}
```

**WYSIWYG Consistency:**
Print boundary calculation MUST match `drawPrintBoundary()` display for accurate preview.

### Margin System

**Margins:**
- Outer margin: 5% of paper dimension (configurable)
- Inner margin: 3% of print zone (configurable)
- Statistics margin: 2% between sections

**Margin Percent:**
```
marginPercent = (innerX - outerX) / outerWidth
```

Used for coordinate transformation between screen space and print space.

---

## Coordinate Transformation

### Screen to Print Space

When rendering to print canvas, coordinates must be transformed:

**Process:**
1. Get print boundary
2. Calculate scale factors
3. Transform world coordinates to print space
4. Apply margins

**Transformation:**
```javascript
// World coordinates (UTM)
var worldX = 123456.78;
var worldY = 654321.09;

// Transform to local coordinates (relative to centroid)
var localX = worldX - window.centroidX;
var localY = worldY - window.centroidY;

// Transform to print canvas space
var printX = (localX - dataMinX) / (dataMaxX - dataMinX) * printWidth + printMarginX;
var printY = (localY - dataMinY) / (dataMaxY - dataMinY) * printHeight + printMarginY;
```

### Print Scale

**Scale Bar:**
Display scale on printed output:

```javascript
var worldWidth = dataMaxX - dataMinX;  // metres
var printWidth = canvasWidth * 0.8;    // pixels (80% of canvas)
var pixelsPerMetre = printWidth / worldWidth;
var scale = "1:" + Math.round(1 / (pixelsPerMetre * 0.001));  // mm to m
```

**Example:**
- Data width: 500m
- Print width: 250mm at 300dpi = 2953 pixels
- Pixels per metre: 5.91
- Scale: 1:169

---

## Print Preview

### Preview Overlay

**drawPrintBoundary():**

Draws print boundary on canvas for WYSIWYG preview.

**Visual Elements:**
- Outer rectangle (black border) — print zone
- Inner rectangle (dashed border) — data zone with margins
- Zone labels (Header, Canvas, Statistics, Footer)
- Dimensions in millimetres

**Preview Toggle:**
- Checkbox: "Show Print Preview"
- Keyboard: `Ctrl+P`
- Menu: View → Print Preview

**Preview Update:**
- Recalculate on window resize
- Update when paper size/orientation changes
- Live preview when adjusting margins

---

## Print Dialog

### Dialog Components

**showPrintDialog():**

Opens print settings dialog with:

**Settings:**
- Paper size dropdown (A0-A4)
- Orientation radio (Landscape/Portrait)
- Template selection (2D/3D/Compact/Custom)
- DPI setting (72, 150, 300, 600)
- Margins (outer, inner, statistics)

**Preview:**
- Thumbnail preview of layout
- Dimensions display
- Scale calculation

**Statistics:**
- Enable/disable statistics section
- Full or simple statistics
- Statistics position (bottom, side, separate page)

**Buttons:**
- **Preview** — Show preview on canvas
- **Export PDF** — Generate and download
- **Cancel** — Close dialog

---

## Advanced Features

### Multi-Page Output

For large patterns that exceed single page:

**Page Tiling:**
1. Divide data into grid cells
2. Generate PDF page per cell
3. Include overlap for seamless assembly
4. Add page numbers and assembly guides

**Implementation:**
```javascript
// Calculate tiles
var tilesX = Math.ceil(dataWidth / pageWidth);
var tilesY = Math.ceil(dataHeight / pageHeight);

// Generate PDF with multiple pages
for (var y = 0; y < tilesY; y++) {
  for (var x = 0; x < tilesX; x++) {
    pdf.addPage();
    renderTile(x, y, overlap);
  }
}
```

### Legend Generation

**Automatic Legend:**
- Hole types (color coded)
- Timing delays (color coded)
- Surface gradients (color bar)
- Scale bar
- North arrow

**Legend Placement:**
- Top-right corner (default)
- Bottom-left
- Separate page

### Layer Control

**Print Layers:**
Select which layers to include:
- Blast holes (by entity)
- Timing connectors
- Surfaces
- Images
- KAD drawings
- Grid
- Annotations

**Layer Visibility:**
Controlled independently from screen display.

---

## Performance Optimization

### Canvas Caching

**Print Canvas:**
- Separate offscreen canvas for print rendering
- Reused across print operations
- High DPI for quality (300dpi default)

**Surface Cache:**
- Pre-rendered surface data
- Cached SVG paths for complex geometries
- Invalidate cache on surface change

### Progressive Rendering

For very large patterns:
1. Render header immediately
2. Render canvas incrementally
3. Show progress indicator
4. Render statistics
5. Render footer
6. Generate PDF

### Memory Management

**Large PDFs:**
- Stream SVG elements to PDF (don't hold all in memory)
- Clear intermediate canvases after use
- Garbage collect between pages

---

## Print Quality Settings

### DPI (Dots Per Inch)

| DPI | Quality | Use Case | File Size |
|-----|---------|----------|-----------|
| 72 | Screen | Digital viewing only | Small |
| 150 | Standard | Office printing | Medium |
| 300 | High | Professional printing | Large |
| 600 | Very High | Poster printing, archival | Very Large |

**Note:** SVG output is resolution-independent; DPI only affects raster elements (images, surface gradients).

### Line Weights

**Stroke Widths:**
- Thin: 0.25 pt (grid lines)
- Standard: 0.5 pt (hole markers)
- Medium: 1.0 pt (connectors)
- Bold: 2.0 pt (print boundary)

**Scaling:**
Line weights scale with output size to maintain visibility.

---

## Troubleshooting

### Common Issues

**Print boundary not visible:**
- Check print preview toggle is enabled
- Verify paper size selection
- Ensure canvas is in correct mode (2D/3D)

**PDF generation fails:**
- Check browser console for errors
- Verify jsPDF library loaded
- Ensure sufficient memory (large patterns)

**Statistics not rendering:**
- Verify statistics data calculated
- Check statistics section enabled
- Ensure sufficient space in layout

**Scale incorrect:**
- Verify centroid calculation
- Check coordinate transformation
- Ensure print boundary calculated correctly

---

See also:
- [Statistics-and-Reporting.md](Statistics-and-Reporting.md) — Statistics calculation
- [User-Interface.md](User-Interface.md) — Print dialog and settings
- [File-Formats.md](File-Formats.md) — PDF format details
