# Print System Rewrite - December 24, 2024

## Summary

Complete rewrite of the print system to implement template-based PDF generation matching the reference templates:
- `src/referenceFiles/PrintoutTemplateLAND.pdf`
- `src/referenceFiles/PrintoutTemplatePORT.pdf`

## Changes Made

### 1. PrintTemplates.js - Template Definitions
- Defined 4 templates: LANDSCAPE_2D, LANDSCAPE_3D, PORTRAIT_2D, PORTRAIT_3D
- Map zone: 78% of page height for data rendering
- Footer zone: 18.5% of page height with column-based layout
- Landscape columns: NavIndicator(10%) | ConnectorCount(22%) | BlastStats(22%) | Logo(12%) | TitleBlock(34%)
- Portrait has nav/logo stacked vertically in first column
- 2D templates use North Arrow, 3D templates use XYZ Gizmo

### 2. PrintLayoutManager.js - Position Calculator
- Converts template percentages to absolute mm positions
- Calculates preview positions for screen display
- Unified aspect ratio calculation for 2D and 3D boundaries
- Helper methods for all footer cells (getNavIndicatorCell, getConnectorCountCell, etc.)

### 3. PrintSystem.js - Core Print System
- **Full Template Preview**: `drawPrintBoundary()` now renders complete template layout with:
  - Page outline (red dashed)
  - Map zone with print-safe area (blue dashed)
  - Footer zone with all column borders
  - Labels in each cell showing what will be printed
- **Unified Boundaries**: 2D and 3D now use same template-based map zone aspect ratio
- **3D Overlay**: Shows full template preview on WebGL canvas
- **Raster PDF**: Updated to use template layout with proper footer cells
- **Removed**: All GeoPDF/georeferencing code

### 4. PrintVectorPDF.js - Vector PDF Generation
- Complete rewrite using jsPDF drawing commands
- WYSIWYG rendering: exactly what's in print preview appears in PDF
- Template-exact footer with:
  - North Arrow (2D) or XYZ Gizmo (3D) in navigation cell
  - Connector Count with colored delay timing groups
  - Blast Statistics with hole counts, burden, spacing, etc.
  - QR code logo with blastingapps.com URL
  - Title with blast entity names
  - Date/time (auto-generated)
  - Scale (calculated from print scale)
  - Designer (from user input)
- All visible data rendered as vectors: holes, KAD entities, surfaces, images

## Template Layout

```
+------------------------------------------------------------------+
|                           [MAP AREA]                              |
|                      (78% of page height)                         |
|                                                                   |
+----------+----------------+----------------+---------+------------+
| NORTH    | CONNECTOR      | BLAST          | [LOGO]  | TITLE      |
| ARROW    | COUNT          | STATISTICS     | QR +    | [BLASTNAME]|
| or XYZ   | (delay groups  | (holes, burden | URL     +------------+
| GIZMO    | with colors)   | spacing, etc.) |         | DATE       |
|          |                |                |         +------------+
|          |                |                |         | Scale:     |
|          |                |                |         | Designer:  |
+----------+----------------+----------------+---------+------------+
```

## Print Preview vs Print Output

The print preview now shows the **exact template layout** on screen:
- Users can see the map zone and footer zone boundaries
- Cell labels indicate what content will appear in each section
- Blue dashed inner boundary shows the print-safe area for data

## Files Modified

1. `src/print/PrintTemplates.js` - Completely rewritten
2. `src/print/PrintLayoutManager.js` - Completely rewritten  
3. `src/print/PrintSystem.js` - Major updates to preview and raster generation
4. `src/print/PrintVectorPDF.js` - Completely rewritten

## Files Not Modified (No Changes Needed)

- `src/print/PrintRendering.js` - Still works with new getPrintBoundary
- `src/print/PrintCaptureManager.js` - Used for navigation indicators
- `src/print/PrintDialog.js` - User input collection unchanged
- `src/print/SVGBuilder.js` - SVG utilities unchanged

## Removed Dependencies

- `src/print/GeoPDFMetadata.js` - No longer imported (georeferencing too complex for JS)

## Testing Checklist

- [ ] Print preview shows full template with all cells
- [ ] 2D and 3D boundaries are same size for same paper/orientation
- [ ] Vector PDF matches template exactly
- [ ] Raster PDF matches template exactly
- [ ] Landscape and Portrait layouts correct
- [ ] Connector Count shows delay timing groups with colors
- [ ] Blast Statistics shows correct data
- [ ] North Arrow (2D) and XYZ Gizmo (3D) render correctly
- [ ] All visible data (holes, KAD, surfaces, images) renders in PDF


