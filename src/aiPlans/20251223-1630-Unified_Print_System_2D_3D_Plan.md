# Unified Print System for 2D and 3D Modes

## Overview

This plan implements a template-based PDF printing system that works seamlessly for both 2D Canvas mode and 3D Three.js mode. The system uses PDF templates as layout references, supports both vector and raster output types, and automatically adapts navigation indicators (North Arrow for 2D, XYZ Gizmo for 3D).

## Current State Analysis

### Existing Print System (2D Only)

**Files:**

- [`Kirra2D/src/print/PrintSystem.js`](Kirra2D/src/print/PrintSystem.js) - Main coordinator, print boundary calculation
- [`Kirra2D/src/print/PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js) - Vector PDF generation using jsPDF
- [`Kirra2D/src/print/PrintRendering.js`](Kirra2D/src/print/PrintRendering.js) - Canvas drawing functions for data
- [`Kirra2D/src/print/PrintStats.js`](Kirra2D/src/print/PrintStats.js) - Header/footer with statistics
- [`Kirra2D/src/print/SVGBuilder.js`](Kirra2D/src/print/SVGBuilder.js) - SVG helper functions
- [`Kirra2D/src/print/GeoPDFMetadata.js`](Kirra2D/src/print/GeoPDFMetadata.js) - ~~Georeferencing metadata~~ (NOT USED - too complex)

**Template References:**

- [`Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf`](Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf) - Landscape layout reference
- [`Kirra2D/src/referenceFiles/PrintoutTemplatePORT.pdf`](Kirra2D/src/referenceFiles/PrintoutTemplatePORT.pdf) - Portrait layout reference

**Current Features:**

- 2D Canvas print preview with boundary system
- WYSIWYG print-safe area (blue dashed lines)
- Vector PDF output (true vectors using jsPDF drawing API)
- Raster PDF output (high-resolution PNG to PDF)
- Basic header with QR code, URL, title
- Statistics table with blast data and delay groups
- ~~Georeferencing support~~ (REMOVED - too complex)

**Issues:**

- No 3D mode support
- Hardcoded layout positions (magic numbers throughout)
- No template abstraction
- Limited customization (no blast name, designer, date input)
- North arrow not properly implemented
- Inconsistent layouts between vector and raster modes

### 3D Rendering System

**Files:**

- [`Kirra2D/src/three/ThreeRenderer.js`](Kirra2D/src/three/ThreeRenderer.js) - Core Three.js renderer with `preserveDrawingBuffer: true` (ready for capture)
- [`Kirra2D/src/three/CameraControls.js`](Kirra2D/src/three/CameraControls.js) - Camera orbit, pan, zoom controls
- [`Kirra2D/src/draw/canvas3DDrawing.js`](Kirra2D/src/draw/canvas3DDrawing.js) - 3D geometry drawing functions

**Current Features:**

- WebGL rendering with orthographic camera
- XYZ axis gizmo (configurable: always/only_when_orbit/never)
- Z-up coordinate system (X=East, Y=North, Z=Up)
- Local coordinate transformation for large UTM values
- Surface rendering with triangles and textures
- Blast holes with collar, grade, toe visualization

**Ready for Printing:**

- `preserveDrawingBuffer: true` enables canvas capture
- `canvas.toDataURL()` available for screenshot
- Gizmo can be shown/hidden programmatically

## Architecture Overview

```mermaid
flowchart TB
    Templates[PrintTemplates.js<br/>LAND/PORT definitions]
    Layout[PrintLayoutManager.js<br/>Position calculator]
    Capture[PrintCaptureManager.js<br/>2D and 3D capture]
    Dialog[PrintDialog.js<br/>User input collection]
    
    Templates --> Layout
    Capture --> Vector[PrintVectorPDF.js<br/>jsPDF vector output]
    Capture --> Raster[PrintRasterPDF.js<br/>PNG to PDF output]
    Layout --> Vector
    Layout --> Raster
    Dialog --> Capture
    
    Canvas2D[2D Canvas Mode] --> Capture
    Canvas3D[3D Three.js Mode] --> Capture
    
    Vector --> PDF[Output PDF]
    Raster --> PDF
```

## New Template System

### Template Structure

Templates define layout zones as JSON-like objects with relative positioning:

```javascript
{
  name: "LAND_2D",
  mode: "2D",
  orientation: "landscape",
  zones: {
    header: {
      x: 0.02,              // 2% from left edge
      y: 0.02,              // 2% from top edge
      width: 0.96,          // 96% of page width
      height: 17,           // 17mm absolute height
      sections: {
        logo: { ... },
        title: { ... },
        navigationIndicator: {
          content: "northArrow"  // 2D mode
        }
      }
    },
    map: {
      x: 0.02,
      y: 19,                // After header + gap
      width: 0.96,
      height: "auto",       // Fill remaining space
      printSafeMargin: 0.05 // 5% internal margin
    },
    footer: {
      y: -12,               // 12mm from bottom (negative)
      height: 10,
      sections: { ... }
    }
  }
}
```

### Template Variants

Four templates to create:

1. **LANDSCAPE_2D** - 2D mode, landscape orientation, North Arrow
2. **LANDSCAPE_3D** - 3D mode, landscape orientation, XYZ Gizmo
3. **PORTRAIT_2D** - 2D mode, portrait orientation, North Arrow
4. **PORTRAIT_3D** - 3D mode, portrait orientation, XYZ Gizmo

Key difference between 2D and 3D templates is the `navigationIndicator.content` field:

- 2D: `"northArrow"`
- 3D: `"xyzGizmo"`

## Implementation Plan

### Phase 1: Core Template System

#### 1.1 Create PrintTemplates.js

**File:** [`Kirra2D/src/print/PrintTemplates.js`](Kirra2D/src/print/PrintTemplates.js) (NEW)

**Purpose:** Define all layout templates that EXACTLY match the PDF reference files

**CRITICAL REQUIREMENT:** The templates defined in this file MUST match the exact layouts shown in:

- [`Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf`](Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf)
- [`Kirra2D/src/referenceFiles/PrintoutTemplatePORT.pdf`](Kirra2D/src/referenceFiles/PrintoutTemplatePORT.pdf)

**Layout Verification Steps:**

1. Open both PDF reference files
2. Measure exact positions and proportions of each table cell
3. Note the differences between landscape and portrait layouts
4. Implement templates to match pixel-perfect

**Key Layout Differences to Preserve:**

- **Landscape**: Logo in header row, Title in separate column
- **Portrait**: Title in header row, Logo in second row
- **Both**: Navigation indicator always top-left
- **Both**: Scale and Designer always bottom-right

**Structure:**

```javascript
// CRITICAL: These templates must EXACTLY match the reference PDFs:
// - Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf
// - Kirra2D/src/referenceFiles/PrintoutTemplatePORT.pdf

export const PRINT_TEMPLATES = {
  LANDSCAPE_2D: {
    name: "LAND_2D",
    mode: "2D",
    orientation: "landscape",
    referenceFile: "PrintoutTemplateLAND.pdf",
    zones: {
      map: {
        // Main data area - fills most of page
        x: 0.02,              // 2% margin from left
        y: 0.02,              // 2% margin from top
        width: 0.60,          // 60% of page width (map takes left side)
        height: 0.96,         // 96% of page height
        printSafeMargin: 0.05 // 5% internal margin
      },
      infoPanel: {
        // Right side info panel matching template table structure
        x: 0.64,              // Starts after map + gap
        y: 0.02,              // Aligned with map top
        width: 0.34,          // 34% of page width
        height: 0.96,         // Full height available
        sections: {
          // Row 1: North Arrow | Connector Count | Blast Stats | Logo
          row1: {
            y: 0,
            height: 0.20,     // 20% of panel height
            cells: [
              {
                id: "navigationIndicator",
                content: "northArrow",  // or "xyzGizmo" for 3D
                widthPercent: 0.25
              },
              {
                id: "connectorCount",
                content: "dynamic",
                widthPercent: 0.25
              },
              {
                id: "blastStatistics",
                content: "dynamic",
                widthPercent: 0.25
              },
              {
                id: "logo",
                content: "qrcode",      // QR code + blastingapps.com
                widthPercent: 0.25
              }
            ]
          },
          // Row 2: Title and Blast Name (spans full width of right column)
          row2: {
            y: 0.20,
            height: 0.15,
            cells: [
              {
                id: "titleBlastName",
                content: "dynamic",     // "TITLE" + [BLASTNAME] from dialog
                widthPercent: 1.0
              }
            ]
          },
          // Row 3: Date and Time
          row3: {
            y: 0.35,
            height: 0.10,
            cells: [
              {
                id: "dateTime",
                content: "dynamic",     // [LOCAL SYSTEM DATE AND TIME]
                widthPercent: 1.0
              }
            ]
          },
          // Row 4: Scale and Designer
          row4: {
            y: 0.45,
            height: 0.15,
            cells: [
              {
                id: "scale",
                label: "Scale:",
                content: "calculated",  // [CALCULATED] from print scale
                widthPercent: 0.5
              },
              {
                id: "designer",
                label: "Designer:",
                content: "dialog",      // [DIALOG ENTRY] from user input
                widthPercent: 0.5
              }
            ]
          }
        }
      }
    }
  },
  
  PORTRAIT_2D: {
    name: "PORT_2D",
    mode: "2D",
    orientation: "portrait",
    referenceFile: "PrintoutTemplatePORT.pdf",
    zones: {
      map: {
        // Main data area
        x: 0.02,
        y: 0.02,
        width: 0.60,          // Map on left
        height: 0.96,
        printSafeMargin: 0.05
      },
      infoPanel: {
        // Right side panel with DIFFERENT layout than landscape
        x: 0.64,
        y: 0.02,
        width: 0.34,
        height: 0.96,
        sections: {
          // Row 1: North Arrow | Connector Count | Blast Stats | Title+BlastName
          row1: {
            y: 0,
            height: 0.20,
            cells: [
              {
                id: "navigationIndicator",
                content: "northArrow",  // or "xyzGizmo" for 3D
                widthPercent: 0.25
              },
              {
                id: "connectorCount",
                content: "dynamic",
                widthPercent: 0.25
              },
              {
                id: "blastStatistics",
                content: "dynamic",
                widthPercent: 0.25
              },
              {
                id: "titleBlastName",  // DIFFERENT: Title in row1 for portrait
                content: "dynamic",
                widthPercent: 0.25
              }
            ]
          },
          // Row 2: Logo | (empty) | (empty) | Date+Time
          row2: {
            y: 0.20,
            height: 0.15,
            cells: [
              {
                id: "logo",
                content: "qrcode",      // DIFFERENT: Logo in row2 for portrait
                widthPercent: 0.25
              },
              {
                id: "empty1",
                widthPercent: 0.25
              },
              {
                id: "empty2",
                widthPercent: 0.25
              },
              {
                id: "dateTime",
                content: "dynamic",
                widthPercent: 0.25
              }
            ]
          },
          // Row 3: Scale and Designer (spans full width)
          row3: {
            y: 0.35,
            height: 0.15,
            cells: [
              {
                id: "scale",
                label: "Scale:",
                content: "calculated",
                widthPercent: 0.5
              },
              {
                id: "designer",
                label: "Designer:",
                content: "dialog",
                widthPercent: 0.5
              }
            ]
          }
        }
      }
    }
  },
  
  // 3D templates are identical except navigationIndicator.content = "xyzGizmo"
  LANDSCAPE_3D: {
    // Clone of LANDSCAPE_2D with navigationIndicator.content = "xyzGizmo"
  },
  
  PORTRAIT_3D: {
    // Clone of PORTRAIT_2D with navigationIndicator.content = "xyzGizmo"
  }
};

// Helper to get template by mode and orientation
export function getTemplate(mode, orientation) {
  const key = orientation.toUpperCase() + "_" + mode.toUpperCase();
  return PRINT_TEMPLATES[key];
}
```

**Layout Zones to Define:**

**IMPORTANT: Templates must match EXACT layouts from reference PDFs:**

**LANDSCAPE Template Layout** (from PrintoutTemplateLAND.pdf):

```
[MAP - Main Area]

Header Table (Right side of page):
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ [NORTH ARROW]    │ CONNECTOR COUNT  │ BLAST STATISTICS │ [SVG LOGO]       │
│ or [XYZ GIZMO]   │                  │                  │ blastingapps.com │
├──────────────────┴──────────────────┴──────────────────┼──────────────────┤
│                                                         │ TITLE            │
│                                                         │ [BLASTNAME]      │
├─────────────────────────────────────────────────────────┼──────────────────┤
│                                                         │ DATE             │
│                                                         │ [DATE/TIME]      │
├─────────────────────────────────────────────────────────┼──────────────────┤
│                                                         │ Scale:           │
│                                                         │ [CALCULATED]     │
│                                                         │ Designer:        │
│                                                         │ [DIALOG ENTRY]   │
└─────────────────────────────────────────────────────────┴──────────────────┘
```

**PORTRAIT Template Layout** (from PrintoutTemplatePORT.pdf):

```
[MAP - Main Area]

Header Table (Right side of page):
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ [NORTH ARROW]    │ CONNECTOR COUNT  │ BLAST STATISTICS │ TITLE            │
│ or [XYZ GIZMO]   │                  │                  │ [BLASTNAME]      │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ {LOGO}           │                  │                  │ DATE             │
│ blastingapps.com │                  │                  │ [DATE/TIME]      │
├──────────────────┴──────────────────┴──────────────────┼──────────────────┤
│                                                         │ Scale:           │
│                                                         │ [CALCULATED]     │
│                                                         │ Designer:        │
│                                                         │ [DIALOG ENTRY]   │
└─────────────────────────────────────────────────────────┴──────────────────┘
```

**Key Differences Between Layouts:**

- **Landscape**: Logo in header table, Title/Blastname in right column
- **Portrait**: Title/Blastname in header table, Logo in second row left
- **Both**: North Arrow (2D) or XYZ Gizmo (3D) in top-left cell
- **Both**: Scale and Designer always in bottom-right area

#### 1.2 Create PrintLayoutManager.js

**File:** [`Kirra2D/src/print/PrintLayoutManager.js`](Kirra2D/src/print/PrintLayoutManager.js) (NEW)

**Purpose:** Convert template definitions to absolute positions in mm

**Key Methods:**

```javascript
class PrintLayoutManager {
  constructor(template, pageWidth, pageHeight)
  
  // Get zone rectangle in absolute mm
  getZoneRect(zoneName) // Returns {x, y, width, height}
  
  // Get section rectangle within a zone
  getSectionRect(zoneName, sectionName)
  
  // Resolve relative values (%, negative, absolute)
  resolveValue(value, parentSize)
  
  // Calculate auto height for map zone
  calculateAutoHeight(zoneName)
}
```

**Example Usage:**

```javascript
const template = getTemplate("2D", "landscape");
const layout = new PrintLayoutManager(template, 297, 210); // A4 landscape

// Get main map area
const mapRect = layout.getZoneRect("map");
// Returns: {x: 5.94, y: 4.2, width: 178.2, height: 201.6}

// Get info panel
const infoPanelRect = layout.getZoneRect("infoPanel");
// Returns: {x: 190.08, y: 4.2, width: 100.98, height: 201.6}

// Get specific cell from info panel row 1
const logoCell = layout.getCellRect("infoPanel", "row1", 3); // 4th cell (0-indexed)
// Returns: {x: 265.77, y: 4.2, width: 25.24, height: 40.32, content: "qrcode"}

// Get navigation indicator cell (different content for 2D vs 3D)
const navCell = layout.getCellRect("infoPanel", "row1", 0);
// Returns: {content: "northArrow"} for 2D or {content: "xyzGizmo"} for 3D
```

**New Methods for Table-Based Layout:**

```javascript
class PrintLayoutManager {
  // ... existing methods ...
  
  // Get a specific cell from a row in a section
  getCellRect(zoneName, rowName, cellIndex) {
    const zone = this.getZoneRect(zoneName);
    const section = this.template.zones[zoneName].sections[rowName];
    const cell = section.cells[cellIndex];
    
    // Calculate cell position within zone
    let cellX = zone.x;
    for (let i = 0; i < cellIndex; i++) {
      cellX += zone.width * section.cells[i].widthPercent;
    }
    
    const cellY = zone.y + zone.height * section.y;
    const cellWidth = zone.width * cell.widthPercent;
    const cellHeight = zone.height * section.height;
    
    return {
      x: cellX,
      y: cellY,
      width: cellWidth,
      height: cellHeight,
      ...cell  // Include content, label, etc.
    };
  }
}
```

#### 1.3 Create PrintCaptureManager.js

**File:** [`Kirra2D/src/print/PrintCaptureManager.js`](Kirra2D/src/print/PrintCaptureManager.js) (NEW)

**Purpose:** Unified capture system for both 2D and 3D modes

**Key Methods:**

```javascript
class PrintCaptureManager {
  // Main capture method - routes to 2D or 3D
  static captureCurrentView(mode, context)
  
  // 2D-specific capture
  static capture2DView(context) {
    // Use existing getPrintBoundary() logic
    // Calculate world bounds from print-safe area
    // Return {worldBounds, screenBounds, scale}
  }
  
  // 3D-specific capture
  static capture3DView(context) {
    // Get camera state from CameraControls
    // Get 3D print boundary info
    // Calculate visible frustum bounds within boundary
    // Capture WebGL canvas: canvas.toDataURL()
    // Return {worldBounds, imageData, cameraState, scale, boundaryInfo}
  }
  
  // Calculate 3D frustum bounds
  static calculate3DVisibleBounds(threeRenderer, cameraState)
  
  // Capture north arrow for 2D
  static captureNorthArrow(context) {
    // Draw arrow rotated by -currentRotation
    // Return image data URL
  }
  
  // Capture XYZ gizmo for 3D
  static captureXYZGizmo(context) {
    // Force gizmo visible at corner
    // Render and extract gizmo region
    // Restore original gizmo state
    // Return image data URL
  }
}
```

**2D Capture Logic:**

- Reuse existing `getPrintBoundary()` from [`PrintSystem.js`](Kirra2D/src/print/PrintSystem.js)
- Calculate inner boundary (blue dashed lines = print-safe area)
- Convert screen coordinates to world coordinates
- Return world bounds for data rendering

**3D Capture Logic:**

- Check if 3D print boundary overlay is active via `get3DPrintBoundary()`
- Get camera state from `cameraControls.getCameraState()`
- Calculate orthographic frustum bounds within boundary area
- Use `threeRenderer.getCanvas().toDataURL("image/png", 1.0)` to capture
- Crop captured image to boundary region (both outer and inner boundaries)
- Temporarily show gizmo at fixed position if needed

**Detailed 3D Capture Implementation:**

```javascript
static capture3DView(context) {
  const { threeRenderer, cameraControls } = context;
  
  // Step 1: Get 3D print boundary info
  const boundaryInfo = get3DPrintBoundary();
  if (!boundaryInfo) {
    throw new Error("3D Print Preview Mode must be active");
  }
  
  // Step 2: Get current camera state
  const cameraState = cameraControls.getCameraState();
  
  // Step 3: Calculate world bounds visible within boundary
  const camera = threeRenderer.camera;
  const canvas = threeRenderer.getCanvas();
  
  // Convert boundary pixels to normalized coordinates
  const boundaryLeft = (boundaryInfo.x / canvas.width) * 2 - 1;
  const boundaryRight = ((boundaryInfo.x + boundaryInfo.width) / canvas.width) * 2 - 1;
  const boundaryTop = 1 - (boundaryInfo.y / canvas.height) * 2;
  const boundaryBottom = 1 - ((boundaryInfo.y + boundaryInfo.height) / canvas.height) * 2;
  
  // Calculate world coordinates at boundary edges
  const frustumWidth = camera.right - camera.left;
  const frustumHeight = camera.top - camera.bottom;
  
  const worldLeft = camera.left + (boundaryLeft + 1) * frustumWidth / 2;
  const worldRight = camera.left + (boundaryRight + 1) * frustumWidth / 2;
  const worldTop = camera.bottom + (boundaryTop + 1) * frustumHeight / 2;
  const worldBottom = camera.bottom + (boundaryBottom + 1) * frustumHeight / 2;
  
  const worldBounds = {
    minX: worldLeft,
    maxX: worldRight,
    minY: worldBottom,
    maxY: worldTop
  };
  
  // Step 4: Capture WebGL canvas
  const imageData = canvas.toDataURL("image/png", 1.0);
  
  // Step 5: Return capture info
  return {
    worldBounds: worldBounds,
    imageData: imageData,
    boundaryInfo: boundaryInfo,
    cameraState: cameraState,
    scale: cameraState.scale
  };
}
```

### Phase 2: User Input and Print Dialog

#### 2.1 Create PrintDialog.js

**File:** [`Kirra2D/src/print/PrintDialog.js`](Kirra2D/src/print/PrintDialog.js) (NEW)

**Purpose:** Collect user input before printing using FloatingDialog

**User Input Fields:**

1. **Blast Name** (text input, default: "Untitled Blast")
2. **Designer Name** (text input, default: empty)
3. **Additional Notes** (textarea, optional)
4. **Paper Size** (dropdown: A4/A3/A2/A1/A0, default: A4)
5. **Orientation** (radio: Landscape/Portrait, default: Landscape)
6. **Output Type** (radio: Vector PDF / High-Res Image PDF, default: Vector)

**Example Structure:**

```javascript
export function showPrintDialog(mode, context) {
  const fields = [
    {
      type: "text",
      name: "blastName",
      label: "Blast Name:",
      value: "Untitled Blast",
      placeholder: "Enter blast name"
    },
    {
      type: "text",
      name: "designer",
      label: "Designer:",
      value: "",
      placeholder: "Enter designer name"
    },
    // ... more fields
  ];
  
  const dialog = new FloatingDialog({
    title: "Print Settings",
    content: formContent,
    onConfirm: (data) => {
      // Start print process with user data
      startPrint(mode, data, context);
    }
  });
  
  dialog.show();
}
```

**Dialog Flow:**

1. User clicks "Print to PDF" button
2. Dialog appears with input fields
3. User fills in details
4. User clicks "Generate PDF"
5. Print process begins with progress bar

### Phase 3: Print Generation Refactoring

#### 3.1 Refactor PrintVectorPDF.js

**File:** [`Kirra2D/src/print/PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js) (REFACTOR)

**Changes:**

- Accept `PrintLayoutManager` instance instead of hardcoded positions
- Accept user input data (blast name, designer, etc.)
- Support both 2D and 3D modes
- Use layout zones for positioning all elements

**New Function Signature:**

```javascript
export function generateTrueVectorPDF(context, userInput, layoutManager, capturedView) {
  // context: all app state
  // userInput: {blastName, designer, notes, paperSize, orientation, outputType}
  // layoutManager: PrintLayoutManager instance
  // capturedView: result from PrintCaptureManager.captureCurrentView()
  
  // Use layoutManager.getSectionRect() for all positioning
  // Render navigation indicator based on mode
  // Include user input in header metadata section
}
```

**Key Improvements:**

1. Replace all hardcoded positions with `layoutManager.getSectionRect()`
2. Add metadata section rendering:
   - Blast Name (from user input)
   - Designer (from user input)
   - Date/Time (auto-generated)
   - Scale (calculated)
3. Conditionally render North Arrow OR XYZ Gizmo
4. Use template-defined font sizes and spacing

#### 3.2 Create PrintRasterPDF.js

**File:** [`Kirra2D/src/print/PrintRasterPDF.js`](Kirra2D/src/print/PrintRasterPDF.js) (NEW - extract from PrintSystem.js)

**Purpose:** High-resolution raster PDF generation (existing `printCanvasHiRes` logic)

**Changes:**

- Extract `printCanvasHiRes()` from [`PrintSystem.js`](Kirra2D/src/print/PrintSystem.js)
- Refactor to use `PrintLayoutManager` for positioning
- Support both 2D and 3D modes
- For 3D: composite captured WebGL image into print canvas

**Key Logic:**

```javascript
export function generateRasterPDF(context, userInput, layoutManager, capturedView) {
  // Step 1: Create high-DPI print canvas (300 DPI)
  // Step 2: Draw header using layoutManager positions
  // Step 3: Draw map area:
  //    - For 2D: render data using existing drawDataForPrinting()
  //    - For 3D: paste captured WebGL imageData
  // Step 4: Draw footer using layoutManager positions
  // Step 5: Convert canvas to PNG
  // Step 6: Create PDF with jsPDF.addImage()
}
```

**3D Mode Specifics:**

- Don't re-render 3D geometry on print canvas
- Use pre-captured `capturedView.imageData` from WebGL
- Composite the image into the map zone
- Add header/footer around it

#### 3.3 Update PrintSystem.js

**File:** [`Kirra2D/src/print/PrintSystem.js`](Kirra2D/src/print/PrintSystem.js) (REFACTOR)

**Changes:**

- Keep print boundary calculation for 2D preview
- Add print boundary overlay for 3D preview (NEW)
- Remove `printCanvasHiRes()` (moved to PrintRasterPDF.js)
- Update `printToPDF()` to use new system
- Update `togglePrintMode()` to handle both 2D and 3D
- Add 3D print mode state management

**New Main Flow:**

```javascript
export function printToPDF(context) {
  // Step 1: Detect mode (2D or 3D)
  const mode = context.is3DMode ? "3D" : "2D";
  
  // Step 2: Show print dialog
  showPrintDialog(mode, context);
  // Dialog handles rest of flow when user confirms
}
```

**New 3D Print Boundary System:**

Add functions for 3D print preview overlay:

```javascript
// Global state for 3D print boundary
let printBoundary3DOverlay = null;

// Toggle 3D print preview mode
export function toggle3DPrintPreview(enabled, paperSize, orientation, threeRenderer) {
  if (enabled) {
    create3DPrintBoundaryOverlay(paperSize, orientation, threeRenderer);
  } else {
    remove3DPrintBoundaryOverlay();
  }
}

// Create overlay canvas showing print boundaries for 3D mode
function create3DPrintBoundaryOverlay(paperSize, orientation, threeRenderer) {
  // Step 1: Get Three.js canvas
  const threeCanvas = threeRenderer.getCanvas();
  const rect = threeCanvas.getBoundingClientRect();
  
  // Step 2: Create overlay canvas
  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.id = "print-boundary-3d";
  overlayCanvas.width = rect.width;
  overlayCanvas.height = rect.height;
  overlayCanvas.style.position = "absolute";
  overlayCanvas.style.left = threeCanvas.offsetLeft + "px";
  overlayCanvas.style.top = threeCanvas.offsetTop + "px";
  overlayCanvas.style.width = rect.width + "px";
  overlayCanvas.style.height = rect.height + "px";
  overlayCanvas.style.pointerEvents = "none";
  overlayCanvas.style.zIndex = "4"; // Above Three.js canvas
  
  // Step 3: Get template and calculate map zone dimensions
  const template = getTemplate("3D", orientation);
  const paper = paperRatios[paperSize];
  const pageWidth = orientation === "landscape" ? paper.width : paper.height;
  const pageHeight = orientation === "landscape" ? paper.height : paper.width;
  
  const layoutManager = new PrintLayoutManager(template, pageWidth, pageHeight);
  const mapZone = layoutManager.getZoneRect("map");
  
  // Step 4: Calculate boundary aspect ratio from template
  // This includes header/footer margins - the actual printable area
  const templateAspectRatio = mapZone.width / mapZone.height;
  
  // Step 5: Fit boundary to canvas maintaining template aspect ratio
  const canvasAspect = rect.width / rect.height;
  let boundaryWidth, boundaryHeight, boundaryX, boundaryY;
  
  if (canvasAspect > templateAspectRatio) {
    // Canvas wider than paper - fit to height
    boundaryHeight = rect.height * 0.9; // 90% of canvas height
    boundaryWidth = boundaryHeight * templateAspectRatio;
  } else {
    // Canvas taller than paper - fit to width
    boundaryWidth = rect.width * 0.9; // 90% of canvas width
    boundaryHeight = boundaryWidth / templateAspectRatio;
  }
  
  // Center the boundary
  boundaryX = (rect.width - boundaryWidth) / 2;
  boundaryY = (rect.height - boundaryHeight) / 2;
  
  // Step 6: Draw boundaries
  const ctx = overlayCanvas.getContext("2d");
  ctx.clearRect(0, 0, rect.width, rect.height);
  
  // Draw outer boundary (red dashed) - represents page edges
  ctx.strokeStyle = "red";
  ctx.setLineDash([10, 5]);
  ctx.lineWidth = 2;
  ctx.strokeRect(boundaryX, boundaryY, boundaryWidth, boundaryHeight);
  
  // Draw inner boundary (blue dashed) - represents print-safe area
  // Uses template's printSafeMargin (5% internal margin)
  const innerMargin = boundaryWidth * (mapZone.printSafeMargin || 0.05);
  ctx.strokeStyle = "rgba(0, 100, 255, 0.8)";
  ctx.setLineDash([5, 3]);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    boundaryX + innerMargin,
    boundaryY + innerMargin,
    boundaryWidth - 2 * innerMargin,
    boundaryHeight - 2 * innerMargin
  );
  
  // Step 7: Add label
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(boundaryX, boundaryY - 25, 180, 25);
  ctx.fillStyle = "white";
  ctx.font = "12px Arial";
  ctx.fillText(
    "Print Preview: " + paperSize + " " + orientation,
    boundaryX + 5,
    boundaryY - 8
  );
  
  // Step 8: Insert into DOM
  threeCanvas.parentElement.appendChild(overlayCanvas);
  printBoundary3DOverlay = overlayCanvas;
  
  // Step 9: Store boundary info for capture
  overlayCanvas.boundaryInfo = {
    x: boundaryX,
    y: boundaryY,
    width: boundaryWidth,
    height: boundaryHeight,
    innerMargin: innerMargin,
    paperSize: paperSize,
    orientation: orientation
  };
}

// Remove 3D print boundary overlay
function remove3DPrintBoundaryOverlay() {
  if (printBoundary3DOverlay && printBoundary3DOverlay.parentElement) {
    printBoundary3DOverlay.parentElement.removeChild(printBoundary3DOverlay);
    printBoundary3DOverlay = null;
  }
}

// Get 3D print boundary info (for capture system)
export function get3DPrintBoundary() {
  if (!printBoundary3DOverlay) return null;
  return printBoundary3DOverlay.boundaryInfo;
}
```

**Key Features of 3D Print Boundary:**

1. **Template-Aware Aspect Ratio**: Uses actual map zone dimensions from template (after header/footer)
2. **WYSIWYG**: Shows exactly what will be captured and printed
3. **Visual Feedback**: Red outer = page edges, Blue inner = print-safe area
4. **Same Style as 2D**: Consistent user experience across modes
5. **Non-Interactive**: Overlay doesn't block 3D camera controls
6. **Responsive**: Recalculates when paper size or orientation changes

#### 3.4 Update Button Handlers

**File:** [`Kirra2D/src/print/PrintSystem.js`](Kirra2D/src/print/PrintSystem.js) (line 889-989)

**Changes to `setupPrintEventHandlers()`:**

- Detect if 3D mode is active
- Show appropriate print preview (2D boundary or 3D overlay)
- Route to correct print generation path
- Handle paper size and orientation changes for 3D boundary updates

**Updated Print Preview Toggle:**

```javascript
export function togglePrintMode(updateStatusMessageCallback, drawDataCallback) {
  printMode = !printMode;
  
  if (printMode) {
    // Entering print preview mode
    const mode = window.is3DMode ? "3D" : "2D";
    
    if (mode === "2D") {
      // Existing 2D boundary logic
      updateStatusMessageCallback("Print Preview Mode: ON");
      drawDataCallback(); // Redraw with boundary
    } else {
      // New 3D overlay logic
      updateStatusMessageCallback("3D Print Preview Mode: ON");
      toggle3DPrintPreview(
        true,
        printPaperSize,
        printOrientation,
        window.threeRenderer
      );
    }
  } else {
    // Exiting print preview mode
    const mode = window.is3DMode ? "3D" : "2D";
    
    if (mode === "2D") {
      updateStatusMessageCallback("Print Preview Mode: OFF");
      drawDataCallback(); // Redraw without boundary
    } else {
      updateStatusMessageCallback("3D Print Preview Mode: OFF");
      remove3DPrintBoundaryOverlay();
    }
  }
}

// Handle paper size changes
export function setPrintPaperSize(size) {
  printPaperSize = size;
  
  // Update 3D boundary if in preview mode
  if (printMode && window.is3DMode) {
    toggle3DPrintPreview(true, printPaperSize, printOrientation, window.threeRenderer);
  }
}

// Handle orientation changes
export function setPrintOrientation(orientation) {
  printOrientation = orientation;
  
  // Update 3D boundary if in preview mode
  if (printMode && window.is3DMode) {
    toggle3DPrintPreview(true, printPaperSize, printOrientation, window.threeRenderer);
  }
}
```

### Phase 4: Navigation Indicators

#### 4.1 North Arrow for 2D

**Implementation in PrintCaptureManager.js:**

```javascript
static captureNorthArrow(context) {
  const { currentRotation, darkModeEnabled } = context;
  
  // Create 100x100px canvas
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");
  
  // Draw arrow rotated to show true north
  ctx.translate(50, 50);
  ctx.rotate(-currentRotation); // Counter-rotate canvas rotation
  
  // Draw arrow shape
  ctx.fillStyle = darkModeEnabled ? "#ffffff" : "#000000";
  ctx.beginPath();
  ctx.moveTo(0, -40);      // Arrow point
  ctx.lineTo(-10, 20);     // Left wing
  ctx.lineTo(0, 10);       // Center notch
  ctx.lineTo(10, 20);      // Right wing
  ctx.closePath();
  ctx.fill();
  
  // Draw "N" label
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.fillText("N", 0, -50);
  
  return canvas.toDataURL("image/png");
}
```

#### 4.2 XYZ Gizmo for 3D

**Implementation in PrintCaptureManager.js:**

```javascript
static captureXYZGizmo(context) {
  const { threeRenderer, cameraControls } = context;
  
  // Step 1: Save current gizmo state
  const originalMode = cameraControls.gizmoDisplayMode;
  
  // Step 2: Force gizmo visible at corner position
  const cameraState = cameraControls.getCameraState();
  const cornerX = -threeRenderer.camera.right * 0.8;
  const cornerY = -threeRenderer.camera.top * 0.8;
  threeRenderer.showAxisHelper(true, cornerX, cornerY, cameraState.scale);
  
  // Step 3: Render scene
  threeRenderer.requestRender();
  
  // Step 4: Extract gizmo region from canvas
  const canvas = threeRenderer.getCanvas();
  const gizmoCanvas = document.createElement("canvas");
  gizmoCanvas.width = 150;
  gizmoCanvas.height = 150;
  const ctx = gizmoCanvas.getContext("2d");
  
  // Copy bottom-left corner (where gizmo is positioned)
  ctx.drawImage(canvas, 
    50, canvas.height - 200,  // Source x, y
    150, 150,                 // Source w, h
    0, 0,                     // Dest x, y
    150, 150                  // Dest w, h
  );
  
  // Step 5: Restore original gizmo state
  if (originalMode !== "always") {
    threeRenderer.showAxisHelper(false);
  }
  
  return gizmoCanvas.toDataURL("image/png");
}
```

**Notes:**

- Gizmo is already implemented in [`ThreeRenderer.js`](Kirra2D/src/three/ThreeRenderer.js) (line 1103-1135)
- Uses Three.js AxesHelper with X=red, Y=green, Z=blue
- Position calculated to stay at fixed screen size (50 pixels)

### Phase 5: Data Rendering

#### 5.1 2D Data Rendering

**Use existing functions from [`PrintRendering.js`](Kirra2D/src/print/PrintRendering.js):**

- `drawDataForPrinting()` - Main data rendering function (line 8)
- Already handles: holes, KAD, surfaces, images, contours
- Already supports both canvas and SVG/vector output

**Integration:**

- Pass layout-calculated map zone to `drawDataForPrinting()`
- Use captured world bounds from `PrintCaptureManager.capture2DView()`

#### 5.2 3D Data Rendering

**Two approaches:**

**Approach A: Pre-captured Image (Simpler, Recommended for Phase 1)**

- Capture WebGL canvas as PNG via `toDataURL()`
- Composite captured image into print canvas
- No re-rendering needed
- Preserves exact view including lighting, shadows, textures

**Approach B: Re-render Vector (Complex, Future Enhancement)**

- Extract geometry from Three.js scene
- Convert to 2D projections
- Render as vectors in PDF
- Allows vector-based 3D prints
- More complex, requires projection math

**Recommended: Use Approach A for initial implementation**

### Phase 6: Surfaces and Images Support

#### 6.1 2D Surfaces

**Current Support:**

- Already implemented in [`PrintRendering.js`](Kirra2D/src/print/PrintRendering.js)
- Surface triangles with elevation-based colors
- Transparency support
- Surface legend with gradient scale

**Verification:**

- Test with loaded surfaces
- Ensure legend renders correctly
- Check transparency in both vector and raster modes

#### 6.2 3D Surfaces

**Current Support:**

- Three.js renders surfaces with vertex colors
- Textured mesh support (OBJ files)
- Gradient-based coloring

**Print Handling:**

- Captured in WebGL screenshot (Approach A)
- Surfaces render exactly as shown on screen
- No special handling needed for Phase 1

#### 6.3 Background Images

**2D Images:**

- GeoTIFF support already implemented
- ~~Rendered with correct georeferencing~~ (georeferencing not included in print)
- Images rendered at their world coordinate positions
- Transparency support

**3D Images:**

- Images placed on planes at elevation Z
- Captured in WebGL screenshot

**Print Handling:**

- Both 2D and 3D images captured in respective view captures
- No additional code needed

### Phase 7: Future Enhancements (NOT in this implementation)

**Cross-Sections:**

- Vertical slice through 3D data
- Requires clipping plane implementation
- Future feature

**Clipping Planes:**

- Hide geometry beyond plane
- Complex Three.js modification
- Future feature

## File Summary

### Files to Create

1. **[`Kirra2D/src/print/PrintTemplates.js`](Kirra2D/src/print/PrintTemplates.js)** - Template definitions (~400 lines)
2. **[`Kirra2D/src/print/PrintLayoutManager.js`](Kirra2D/src/print/PrintLayoutManager.js)** - Layout calculator (~200 lines)
3. **[`Kirra2D/src/print/PrintCaptureManager.js`](Kirra2D/src/print/PrintCaptureManager.js)** - Capture system (~400 lines)
4. **[`Kirra2D/src/print/PrintDialog.js`](Kirra2D/src/print/PrintDialog.js)** - User input dialog (~300 lines)
5. **[`Kirra2D/src/print/PrintRasterPDF.js`](Kirra2D/src/print/PrintRasterPDF.js)** - Raster output (extract ~300 lines from PrintSystem.js)

### Files to Modify

1. **[`Kirra2D/src/print/PrintSystem.js`](Kirra2D/src/print/PrintSystem.js)**
   - Remove `printCanvasHiRes()` (move to PrintRasterPDF.js)
   - Update `printToPDF()` to use new dialog flow
   - Keep `getPrintBoundary()` and `togglePrintMode()` for 2D preview
   - Add `toggle3DPrintPreview()` for 3D overlay boundary
   - Add `create3DPrintBoundaryOverlay()` to draw 3D boundaries
   - Add `remove3DPrintBoundaryOverlay()` to cleanup
   - Add `get3DPrintBoundary()` to retrieve boundary info
   - Add `setPrintPaperSize()` and `setPrintOrientation()` handlers
   - Add 3D print mode detection

2. **[`Kirra2D/src/print/PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js)**
   - Replace hardcoded positions with layoutManager calls
   - Add user input data rendering
   - Support both 2D and 3D modes
   - Add navigation indicator rendering

3. **[`Kirra2D/src/print/PrintStats.js`](Kirra2D/src/print/PrintStats.js)**
   - Update to use layout positions
   - Add user metadata rendering

### Files to Reference (No Changes)

1. **[`Kirra2D/src/print/PrintRendering.js`](Kirra2D/src/print/PrintRendering.js)** - Keep existing data rendering
2. **[`Kirra2D/src/print/SVGBuilder.js`](Kirra2D/src/print/SVGBuilder.js)** - Keep SVG helpers
3. **[`Kirra2D/src/print/GeoPDFMetadata.js`](Kirra2D/src/print/GeoPDFMetadata.js)** - ~~Keep georeferencing~~ (IGNORE - not using)
4. **[`Kirra2D/src/three/ThreeRenderer.js`](Kirra2D/src/three/ThreeRenderer.js)** - Use existing gizmo and capture
5. **[`Kirra2D/src/three/CameraControls.js`](Kirra2D/src/three/CameraControls.js)** - Use camera state getter

## Testing Checklist

### 2D Mode Testing

- [ ] Print preview boundary shows correctly
- [ ] WYSIWYG: printed output matches preview
- [ ] North arrow rotates with canvas rotation
- [ ] Blast holes render correctly
- [ ] KAD entities (points, lines, circles, text) render
- [ ] Surfaces with elevation gradient render
- [ ] Background images (GeoTIFF) render
- [ ] Statistics table shows correct data
- [ ] Delay groups table with colors
- [ ] User input (blast name, designer) appears in header
- [ ] Both vector and raster outputs work
- [ ] Both landscape and portrait orientations work
- [ ] All paper sizes (A4/A3/A2/A1/A0) work

### 3D Mode Testing

- [ ] 3D print boundary overlay displays correctly
- [ ] Boundary has correct aspect ratio for selected paper size
- [ ] Red outer boundary shows page edges
- [ ] Blue inner boundary shows print-safe area
- [ ] Boundary updates when paper size changes
- [ ] Boundary updates when orientation changes
- [ ] Boundary respects template proportions (header/footer space)
- [ ] WYSIWYG: printed output matches boundary preview
- [ ] WebGL canvas captures correctly
- [ ] Captured image crops to boundary region
- [ ] XYZ gizmo appears in print
- [ ] Gizmo shows current camera orientation
- [ ] 3D surfaces render in print
- [ ] Textured surfaces (OBJ) render in print
- [ ] Blast holes in 3D render correctly
- [ ] Background images on planes render
- [ ] Lighting and shadows captured
- [ ] Statistics table shows correct data
- [ ] User input appears in header
- [ ] Both landscape and portrait work
- [ ] All paper sizes work

## Implementation Notes

### Coordinate Systems

**2D Canvas:**

- World coordinates: Large UTM values (e.g., 476882, 6772456)
- Canvas coordinates: Screen pixels
- Print coordinates: PDF mm
- Transformation: `worldToCanvas()` then scale to PDF mm

**3D Three.js:**

- World coordinates: Large UTM values
- Local coordinates: Translated to origin (small values for precision)
- Screen coordinates: Canvas pixels after camera projection
- Print coordinates: WebGL canvas captured as image

### Key Considerations

1. **Preserve Drawing Buffer:** Already enabled in ThreeRenderer.js (line 46)
2. **Image Quality:** Use 300 DPI for raster prints (11.8 px/mm)
3. **Vector Quality:** jsPDF native drawing for scalable output
4. **User Experience:** Show progress dialog during generation
5. **Memory:** Large canvases may fail; handle errors gracefully
6. **Dark Mode:** Navigation indicators adapt to theme

### Error Handling

- Print boundary not active (2D mode)
- No data to print
- Canvas too large for browser
- Image generation failure
- User cancels dialog

## Continuation on Another Computer

All information needed to continue this work:

1. **Template References:** See [`Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf`](Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf) and PORT.pdf for layout
2. **Current Print System:** Study [`PrintSystem.js`](Kirra2D/src/print/PrintSystem.js) and [`PrintVectorPDF.js`](Kirra2D/src/print/PrintVectorPDF.js)
3. **3D Rendering:** Study [`ThreeRenderer.js`](Kirra2D/src/three/ThreeRenderer.js) for capture capability
4. **Coordinate System:** Read [`20251124-0145-COORDINATE_SYSTEM_FIX.md`](Kirra2D/src/aiCommentary/20251124-0145-COORDINATE_SYSTEM_FIX.md)
5. **This Plan:** Located in [`aiPlans/`](Kirra2D/src/aiPlans/) folder

### Key Dependencies

- jsPDF library (already installed)
- Three.js library (already installed)
- FloatingDialog class (already implemented)
- GeometryFactory for 3D objects (already implemented)

### Excluded Features

- **Georeferencing/GeoPDF**: Too complex - PDFs will not include embedded coordinate systems
- **Spatial metadata**: Not included in this implementation
- **GIS integration**: Standard PDF output only (no GeoTIFF metadata preservation)

### Testing Data

- Test with blast holes loaded
- Test with KAD drawings (points, lines, polygons, circles, text)
- Test with surfaces (elevation-based and textured)
- Test with background images (GeoTIFF)
- Test in both 2D and 3D modes
- Test all paper sizes and orientations

## TODO List

- [ ] Create PrintTemplates.js with LANDSCAPE_2D, LANDSCAPE_3D, PORTRAIT_2D, PORTRAIT_3D definitions
- [ ] Create PrintLayoutManager.js to convert template positions to absolute mm coordinates
- [ ] Create PrintCaptureManager.js for unified 2D/3D view capture and navigation indicators
- [ ] Create PrintDialog.js to collect user input (blast name, designer, paper size, orientation, output type)
- [ ] Create PrintRasterPDF.js by extracting and refactoring printCanvasHiRes from PrintSystem.js
- [ ] Refactor PrintVectorPDF.js to use PrintLayoutManager and support both 2D and 3D modes
- [ ] Refactor PrintSystem.js to coordinate new print flow with mode detection
- [ ] Implement 3D print boundary overlay system in PrintSystem.js (toggle3DPrintPreview, create/remove overlay, get boundary)
- [ ] Update togglePrintMode() to handle both 2D boundaries and 3D overlays
- [ ] Add setPrintPaperSize() and setPrintOrientation() handlers that update 3D boundary
- [ ] Update PrintCaptureManager.capture3DView() to use boundary info for cropping
- [ ] Implement captureNorthArrow() in PrintCaptureManager for 2D mode
- [ ] Implement captureXYZGizmo() in PrintCaptureManager for 3D mode
- [ ] Test 2D printing: preview, holes, KAD, surfaces, images, north arrow, both output types
- [ ] Test 3D boundary overlay: correct aspect ratio, updates with paper size/orientation changes
- [ ] Test 3D printing: WebGL capture, boundary cropping, XYZ gizmo, surfaces, textures, lighting
- [ ] Test all paper sizes (A4/A3/A2/A1/A0) and orientations (landscape/portrait)
