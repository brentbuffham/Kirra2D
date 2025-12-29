---
name: Fix Print System
overview: Complete rewrite of the print system to properly implement the template-based PDF layout matching the reference PDFs, with full template preview overlay and unified 2D/3D boundary handling.
todos:
  - id: fix-templates
    content: Fix PrintTemplates.js - Update zone proportions to match reference PDFs exactly
    status: completed
  - id: print-preview-overlay
    content: Rewrite drawPrintBoundary to show full template layout with all footer cells
    status: completed
  - id: unify-boundaries
    content: Make 2D and 3D print boundaries use same template-based map zone dimensions
    status: completed
  - id: vector-pdf-footer
    content: Rewrite Vector PDF footer rendering to match template with all cell borders
    status: completed
  - id: connector-count-table
    content: Implement Connector Count cell with delay timing groups and colored rows
    status: completed
  - id: blast-stats-cell
    content: Implement Blast Statistics cell with hole counts, burden, spacing, etc.
    status: completed
  - id: raster-pdf-update
    content: Update Raster PDF generation to use same template layout as Vector
    status: completed
  - id: remove-geopdf
    content: Remove GeoPDF references from PrintVectorPDF.js and PrintSystem.js
    status: completed
---

# Fix Print System - Template-Based PDF Generation

## Problem Summary

The current print system has multiple issues:

1. Print preview only shows red/blue boundary boxes, not the full template layout
2. 2D and 3D print boundaries have different sizes (inconsistent)
3. PDF output does not match the reference templates (PrintoutTemplateLAND.pdf, PrintoutTemplatePORT.pdf)
4. GeoPDF code is still referenced but should be removed
5. Both Vector and Raster PDF generation produce incorrect layouts

## Reference Template Layouts

**LANDSCAPE (from PrintoutTemplateLAND.pdf):**

```javascript
+------------------------------------------------------------------+
|                                                                   |
|                           [MAP AREA]                              |
|                         (~80% of page)                            |
|                                                                   |
+----------+----------------+----------------+---------+------------+
| [NORTH   | CONNECTOR      | BLAST          | [LOGO]  | TITLE      |
|  ARROW]  | COUNT          | STATISTICS     | QR +    | [BLASTNAME]|
|          | (delay groups) | (holes, burden)| URL     +------------+
|          |                |                |         | DATE       |
|          |                |                |         | [DATETIME] |
|          |                |                |         +------------+
|          |                |                |         | Scale:     |
|          |                |                |         | Designer:  |
+----------+----------------+----------------+---------+------------+
```

**PORTRAIT (from PrintoutTemplatePORT.pdf):**

```javascript
+-------------------------------------------------------+
|                                                        |
|                      [MAP AREA]                        |
|                    (~80% of page)                      |
|                                                        |
+----------+-------------+-------------+----------------+
| [NORTH   | CONNECTOR   | BLAST       | TITLE          |
|  ARROW]  | COUNT       | STATISTICS  | [BLASTNAME]    |
+----------+             |             +----------------+
| [LOGO]   |             |             | DATE           |
| QR + URL |             |             | [DATETIME]     |
|          |             |             +----------------+
|          |             |             | Scale:         |
|          |             |             | Designer:      |
+----------+-------------+-------------+----------------+
```



## Key Files to Modify

1. [`src/print/PrintTemplates.js`](src/print/PrintTemplates.js) - Fix template definitions to match reference PDFs
2. [`src/print/PrintSystem.js`](src/print/PrintSystem.js) - Rewrite print preview to show full template overlay
3. [`src/print/PrintVectorPDF.js`](src/print/PrintVectorPDF.js) - Rewrite to match template layout exactly
4. [`src/print/PrintLayoutManager.js`](src/print/PrintLayoutManager.js) - Minor fixes for cell calculations

## Implementation Tasks

### Phase 1: Fix Template Definitions

**File: [`src/print/PrintTemplates.js`](src/print/PrintTemplates.js)**Update templates to exactly match reference PDFs:

- Map zone: 2% margin, 78% height (leaving 20% for footer)
- Footer zone: Full width, 18% height at bottom
- Footer cells with exact proportions matching the reference PDFs
- Landscape vs Portrait have different cell arrangements (Logo position differs)

### Phase 2: Full Template Print Preview

**File: [`src/print/PrintSystem.js`](src/print/PrintSystem.js)**Replace `drawPrintBoundary()` with `drawPrintTemplatePreview()` that renders:

1. Outer page boundary (red dashed)
2. Map zone with inner print-safe area (blue dashed)
3. Footer zone outline with all cell borders
4. Placeholder text in cells: "NORTH ARROW", "CONNECTOR COUNT", "BLAST STATISTICS", "TITLE", "DATE", "Scale:", "Designer:"
5. Logo placeholder "[QR]"

This gives users a WYSIWYG preview of the final PDF layout on screen.**Unify 2D/3D Boundaries:**

- Both 2D and 3D should use the same template-based map zone aspect ratio
- Update `getPrintBoundary()` to use template map zone dimensions
- Update `create3DPrintBoundaryOverlay()` to use the same calculations

### Phase 3: Vector PDF Generation (Primary)

**File: [`src/print/PrintVectorPDF.js`](src/print/PrintVectorPDF.js)**Rewrite `generateTrueVectorPDF()` to:

1. **Map Zone Rendering:**

- Use template's map zone coordinates
- Draw map border
- Render all data (holes, KAD, surfaces, images) within map zone

2. **Footer Rendering (Template-Exact):**

- Draw outer footer border
- Draw all cell borders
- Cell 1 (Navigation): North Arrow image (2D) or XYZ Gizmo (3D)
- Cell 2 (Connector Count): Table of delay groups with colored rows
- Cell 3 (Blast Statistics): Holes count, burden, spacing, drill metres, etc.
- Cell 4 (Logo): QR code image + "blastingapps.com" text
- Cell 5 (Title): "TITLE" label + blast name
- Cell 6 (Date): "DATE" label + current date/time
- Cell 7 (Scale): "Scale:" label + calculated scale ratio
- Cell 8 (Designer): "Designer:" label + user input

3. **Remove GeoPDF references** - Delete all calls to `GeoPDFMetadata.js`

### Phase 4: Raster PDF Generation (Secondary)

**File: [`src/print/PrintSystem.js`](src/print/PrintSystem.js)**Update `printCanvasHiRes()` to use the same template layout:

- Use `PrintLayoutManager` for zone positions
- Draw the same footer table structure
- Ensure pixel-perfect match with Vector output

### Phase 5: Cleanup

1. Remove or deprecate [`src/print/GeoPDFMetadata.js`](src/print/GeoPDFMetadata.js) - not used
2. Clean up unused functions in [`src/print/PrintPDFMake.js`](src/print/PrintPDFMake.js)
3. Update [`src/print/PrintStats.js`](src/print/PrintStats.js) to work with new layout

## Testing Checklist

- [ ] Print preview shows full template layout (not just boundaries)
- [ ] 2D and 3D preview boundaries are the same size for same paper/orientation
- [ ] Vector PDF footer matches template exactly (all cells with borders)
- [ ] Connector Count shows delay timing groups with colors
- [ ] Blast Statistics shows hole counts, burden, spacing, etc.
- [ ] North Arrow renders correctly in navigation cell
- [ ] QR code and URL render in logo cell
- [ ] Title/Date/Scale/Designer all populated correctly
- [ ] Landscape and Portrait produce correct layouts (Logo position differs)