/* prettier-ignore-file */
//=================================================
// PrintTemplates.js - PDF Layout Template Definitions
//=================================================
// CRITICAL: These templates EXACTLY match the reference PDFs:
// - Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf
// - Kirra2D/src/referenceFiles/PrintoutTemplatePORT.pdf
//
// Template Structure:
// - Map Zone: Main drawing area (~80% of page)
// - Footer Zone: Info table at bottom (~20% of page)

// Step 1) Paper size definitions (in mm)
export const PAPER_SIZES = {
    A4: { width: 297, height: 210 },  // Landscape dimensions
    A3: { width: 420, height: 297 },
    A2: { width: 594, height: 420 },
    A1: { width: 841, height: 594 },
    A0: { width: 1189, height: 841 }
};

// Step 2) Template definitions matching reference PDFs
export const PRINT_TEMPLATES = {
    // =========================================================
    // LANDSCAPE 2D Template - North Arrow in navigation cell
    // =========================================================
    // Layout from PrintoutTemplateLAND.pdf:
    // +------------------------------------------------------------------+
    // |                           [MAP AREA]                             |
    // |                         (78% of page)                            |
    // +----------+----------------+----------------+---------+-----------+
    // | NORTH    | CONNECTOR      | BLAST          | [LOGO]  | TITLE     |
    // | ARROW    | COUNT          | STATISTICS     | QR+URL  | [BLAST]   |
    // |          |                |                |         +-----------+
    // |          |                |                |         | DATE      |
    // |          |                |                |         +-----------+
    // |          |                |                |         | Scale:    |
    // |          |                |                |         | Designer: |
    // +----------+----------------+----------------+---------+-----------+
    LANDSCAPE_2D: {
        name: "LAND_2D",
        mode: "2D",
        orientation: "landscape",
        referenceFile: "PrintoutTemplateLAND.pdf",
        pageMargin: 0.015,  // 1.5% margin from page edges
        zones: {
            // Step 2a) Map zone - main drawing area
            map: {
                x: 0.015,             // 1.5% from left
                y: 0.015,             // 1.5% from top
                width: 0.97,          // 97% of page width
                height: 0.78,         // 78% of page height
                printSafeMargin: 0.02 // 2% internal safe margin
            },
            // Step 2b) Footer zone - info table at bottom
            footer: {
                x: 0.015,             // 1.5% from left
                y: 0.80,              // Starts at 80% from top
                width: 0.97,          // 97% of page width
                height: 0.185,        // 18.5% of page height
                // Footer is divided into columns and rows
                // Columns: NavIndicator(10%) | ConnectorCount(22%) | BlastStats(22%) | Logo(12%) | TitleBlock(34%)
                columns: [
                    { id: "navIndicator", widthPercent: 0.10 },
                    { id: "connectorCount", widthPercent: 0.22 },
                    { id: "blastStatistics", widthPercent: 0.22 },
                    { id: "logo", widthPercent: 0.12 },
                    { id: "titleBlock", widthPercent: 0.34 }
                ],
                // TitleBlock column has internal rows
                titleBlockRows: [
                    { id: "title", heightPercent: 0.35, label: "TITLE" },
                    { id: "date", heightPercent: 0.25, label: "DATE" },
                    { id: "scaleDesigner", heightPercent: 0.40, labels: ["Scale:", "Designer:"] }
                ],
                // Content definitions
                cells: {
                    navIndicator: {
                        id: "navigationIndicator",
                        content: "northArrow",
                        label: ""
                    },
                    connectorCount: {
                        id: "connectorCount",
                        content: "delayGroups",
                        label: "CONNECTOR COUNT"
                    },
                    blastStatistics: {
                        id: "blastStatistics",
                        content: "statistics",
                        label: "BLAST STATISTICS"
                    },
                    logo: {
                        id: "logo",
                        content: "qrcode",
                        label: "blastingapps.com"
                    },
                    title: {
                        id: "title",
                        content: "blastName",
                        label: "TITLE"
                    },
                    date: {
                        id: "date",
                        content: "dateTime",
                        label: "DATE"
                    },
                    scale: {
                        id: "scale",
                        content: "calculated",
                        label: "Scale:"
                    },
                    designer: {
                        id: "designer",
                        content: "userInput",
                        label: "Designer:"
                    }
                }
            }
        }
    },

    // =========================================================
    // LANDSCAPE 3D Template - XYZ Gizmo in navigation cell
    // =========================================================
    LANDSCAPE_3D: {
        name: "LAND_3D",
        mode: "3D",
        orientation: "landscape",
        referenceFile: "PrintoutTemplateLAND.pdf",
        pageMargin: 0.015,
        zones: {
            map: {
                x: 0.015,
                y: 0.015,
                width: 0.97,
                height: 0.78,
                printSafeMargin: 0.02
            },
            footer: {
                x: 0.015,
                y: 0.80,
                width: 0.97,
                height: 0.185,
                columns: [
                    { id: "navIndicator", widthPercent: 0.10 },
                    { id: "connectorCount", widthPercent: 0.22 },
                    { id: "blastStatistics", widthPercent: 0.22 },
                    { id: "logo", widthPercent: 0.12 },
                    { id: "titleBlock", widthPercent: 0.34 }
                ],
                titleBlockRows: [
                    { id: "title", heightPercent: 0.35, label: "TITLE" },
                    { id: "date", heightPercent: 0.25, label: "DATE" },
                    { id: "scaleDesigner", heightPercent: 0.40, labels: ["Scale:", "Designer:"] }
                ],
                cells: {
                    navIndicator: {
                        id: "navigationIndicator",
                        content: "xyzGizmo",  // 3D uses XYZ Gizmo instead of North Arrow
                        label: ""
                    },
                    connectorCount: {
                        id: "connectorCount",
                        content: "delayGroups",
                        label: "CONNECTOR COUNT"
                    },
                    blastStatistics: {
                        id: "blastStatistics",
                        content: "statistics",
                        label: "BLAST STATISTICS"
                    },
                    logo: {
                        id: "logo",
                        content: "qrcode",
                        label: "blastingapps.com"
                    },
                    title: {
                        id: "title",
                        content: "blastName",
                        label: "TITLE"
                    },
                    date: {
                        id: "date",
                        content: "dateTime",
                        label: "DATE"
                    },
                    scale: {
                        id: "scale",
                        content: "calculated",
                        label: "Scale:"
                    },
                    designer: {
                        id: "designer",
                        content: "userInput",
                        label: "Designer:"
                    }
                }
            }
        }
    },

    // =========================================================
    // PORTRAIT 2D Template - North Arrow in navigation cell
    // =========================================================
    // Layout from PrintoutTemplatePORT.pdf:
    // +-------------------------------------------------------+
    // |                      [MAP AREA]                        |
    // |                    (78% of page)                       |
    // +----------+-------------+-------------+-----------------+
    // | NORTH    | CONNECTOR   | BLAST       | TITLE           |
    // | ARROW    | COUNT       | STATISTICS  | [BLASTNAME]     |
    // +----------+             |             +-----------------+
    // | [LOGO]   |             |             | DATE            |
    // | QR+URL   |             |             | [DATETIME]      |
    // |          |             |             +-----------------+
    // |          |             |             | Scale:          |
    // |          |             |             | Designer:       |
    // +----------+-------------+-------------+-----------------+
    PORTRAIT_2D: {
        name: "PORT_2D",
        mode: "2D",
        orientation: "portrait",
        referenceFile: "PrintoutTemplatePORT.pdf",
        pageMargin: 0.015,
        zones: {
            map: {
                x: 0.015,
                y: 0.015,
                width: 0.97,
                height: 0.78,
                printSafeMargin: 0.02
            },
            footer: {
                x: 0.015,
                y: 0.80,
                width: 0.97,
                height: 0.185,
                // Portrait has different column layout
                // Columns: NavIndicator+Logo(10%) | ConnectorCount(22%) | BlastStats(22%) | TitleBlock(46%)
                columns: [
                    { id: "navLogoColumn", widthPercent: 0.10 },
                    { id: "connectorCount", widthPercent: 0.22 },
                    { id: "blastStatistics", widthPercent: 0.22 },
                    { id: "titleBlock", widthPercent: 0.46 }
                ],
                // NavLogoColumn has two rows: North Arrow (top) and Logo (bottom)
                navLogoRows: [
                    { id: "navIndicator", heightPercent: 0.50, content: "northArrow" },
                    { id: "logo", heightPercent: 0.50, content: "qrcode", label: "blastingapps.com" }
                ],
                titleBlockRows: [
                    { id: "title", heightPercent: 0.35, label: "TITLE" },
                    { id: "date", heightPercent: 0.25, label: "DATE" },
                    { id: "scaleDesigner", heightPercent: 0.40, labels: ["Scale:", "Designer:"] }
                ],
                cells: {
                    navIndicator: {
                        id: "navigationIndicator",
                        content: "northArrow",
                        label: ""
                    },
                    logo: {
                        id: "logo",
                        content: "qrcode",
                        label: "blastingapps.com"
                    },
                    connectorCount: {
                        id: "connectorCount",
                        content: "delayGroups",
                        label: "CONNECTOR COUNT"
                    },
                    blastStatistics: {
                        id: "blastStatistics",
                        content: "statistics",
                        label: "BLAST STATISTICS"
                    },
                    title: {
                        id: "title",
                        content: "blastName",
                        label: "TITLE"
                    },
                    date: {
                        id: "date",
                        content: "dateTime",
                        label: "DATE"
                    },
                    scale: {
                        id: "scale",
                        content: "calculated",
                        label: "Scale:"
                    },
                    designer: {
                        id: "designer",
                        content: "userInput",
                        label: "Designer:"
                    }
                }
            }
        }
    },

    // =========================================================
    // PORTRAIT 3D Template - XYZ Gizmo in navigation cell
    // =========================================================
    PORTRAIT_3D: {
        name: "PORT_3D",
        mode: "3D",
        orientation: "portrait",
        referenceFile: "PrintoutTemplatePORT.pdf",
        pageMargin: 0.015,
        zones: {
            map: {
                x: 0.015,
                y: 0.015,
                width: 0.97,
                height: 0.78,
                printSafeMargin: 0.02
            },
            footer: {
                x: 0.015,
                y: 0.80,
                width: 0.97,
                height: 0.185,
                columns: [
                    { id: "navLogoColumn", widthPercent: 0.10 },
                    { id: "connectorCount", widthPercent: 0.22 },
                    { id: "blastStatistics", widthPercent: 0.22 },
                    { id: "titleBlock", widthPercent: 0.46 }
                ],
                navLogoRows: [
                    { id: "navIndicator", heightPercent: 0.50, content: "xyzGizmo" },  // 3D uses XYZ Gizmo
                    { id: "logo", heightPercent: 0.50, content: "qrcode", label: "blastingapps.com" }
                ],
                titleBlockRows: [
                    { id: "title", heightPercent: 0.35, label: "TITLE" },
                    { id: "date", heightPercent: 0.25, label: "DATE" },
                    { id: "scaleDesigner", heightPercent: 0.40, labels: ["Scale:", "Designer:"] }
                ],
                cells: {
                    navIndicator: {
                        id: "navigationIndicator",
                        content: "xyzGizmo",
                        label: ""
                    },
                    logo: {
                        id: "logo",
                        content: "qrcode",
                        label: "blastingapps.com"
                    },
                    connectorCount: {
                        id: "connectorCount",
                        content: "delayGroups",
                        label: "CONNECTOR COUNT"
                    },
                    blastStatistics: {
                        id: "blastStatistics",
                        content: "statistics",
                        label: "BLAST STATISTICS"
                    },
                    title: {
                        id: "title",
                        content: "blastName",
                        label: "TITLE"
                    },
                    date: {
                        id: "date",
                        content: "dateTime",
                        label: "DATE"
                    },
                    scale: {
                        id: "scale",
                        content: "calculated",
                        label: "Scale:"
                    },
                    designer: {
                        id: "designer",
                        content: "userInput",
                        label: "Designer:"
                    }
                }
            }
        }
    }
};

// Step 3) Helper function to get template by mode and orientation
export function getTemplate(mode, orientation) {
    // Step 3a) Build template key
    var key = orientation.toUpperCase() + "_" + mode.toUpperCase();
    var template = PRINT_TEMPLATES[key];
    
    // Step 3b) Fallback to 2D if not found
    if (!template) {
        console.warn("Template not found for mode: " + mode + ", orientation: " + orientation + " - using LANDSCAPE_2D");
        return PRINT_TEMPLATES.LANDSCAPE_2D;
    }
    
    return template;
}

// Step 4) Helper to get paper dimensions for orientation
export function getPaperDimensions(paperSize, orientation) {
    var paper = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
    
    if (orientation === "landscape") {
        return {
            width: Math.max(paper.width, paper.height),
            height: Math.min(paper.width, paper.height)
        };
    } else {
        return {
            width: Math.min(paper.width, paper.height),
            height: Math.max(paper.width, paper.height)
        };
    }
}

// Step 5) Helper to get all available templates
export function getAvailableTemplates() {
    return Object.keys(PRINT_TEMPLATES);
}

// Step 6) Calculate absolute positions for a template zone
export function calculateZonePositions(template, pageWidth, pageHeight) {
    var zones = template.zones;
    var result = {};
    
    // Step 6a) Calculate map zone in mm
    var map = zones.map;
    result.map = {
        x: map.x * pageWidth,
        y: map.y * pageHeight,
        width: map.width * pageWidth,
        height: map.height * pageHeight,
        printSafeMargin: map.printSafeMargin
    };
    
    // Step 6b) Calculate inner (print-safe) map area
    var mapMargin = result.map.width * map.printSafeMargin;
    result.mapInner = {
        x: result.map.x + mapMargin,
        y: result.map.y + mapMargin,
        width: result.map.width - mapMargin * 2,
        height: result.map.height - mapMargin * 2
    };
    
    // Step 6c) Calculate footer zone in mm
    var footer = zones.footer;
    result.footer = {
        x: footer.x * pageWidth,
        y: footer.y * pageHeight,
        width: footer.width * pageWidth,
        height: footer.height * pageHeight
    };
    
    // Step 6d) Calculate footer column positions
    result.footerColumns = [];
    var columnX = result.footer.x;
    for (var i = 0; i < footer.columns.length; i++) {
        var col = footer.columns[i];
        var colWidth = footer.width * pageWidth * col.widthPercent;
        result.footerColumns.push({
            id: col.id,
            x: columnX,
            y: result.footer.y,
            width: colWidth,
            height: result.footer.height
        });
        columnX += colWidth;
    }
    
    // Step 6e) Calculate title block rows (last column)
    var titleBlockCol = result.footerColumns[result.footerColumns.length - 1];
    result.titleBlockRows = [];
    var rowY = titleBlockCol.y;
    for (var j = 0; j < footer.titleBlockRows.length; j++) {
        var row = footer.titleBlockRows[j];
        var rowHeight = titleBlockCol.height * row.heightPercent;
        result.titleBlockRows.push({
            id: row.id,
            label: row.label,
            labels: row.labels,
            x: titleBlockCol.x,
            y: rowY,
            width: titleBlockCol.width,
            height: rowHeight
        });
        rowY += rowHeight;
    }
    
    // Step 6f) Calculate nav/logo rows for portrait mode
    if (footer.navLogoRows) {
        var navLogoCol = result.footerColumns[0];
        result.navLogoRows = [];
        var navRowY = navLogoCol.y;
        for (var k = 0; k < footer.navLogoRows.length; k++) {
            var navRow = footer.navLogoRows[k];
            var navRowHeight = navLogoCol.height * navRow.heightPercent;
            result.navLogoRows.push({
                id: navRow.id,
                content: navRow.content,
                label: navRow.label,
                x: navLogoCol.x,
                y: navRowY,
                width: navLogoCol.width,
                height: navRowHeight
            });
            navRowY += navRowHeight;
        }
    }
    
    return result;
}

