/* prettier-ignore-file */
//=================================================
// PrintTemplates.js - PDF Layout Template Definitions
//=================================================
// Defines exact layouts matching reference PDFs:
// - Kirra2D/src/referenceFiles/PrintoutTemplateLAND.pdf
// - Kirra2D/src/referenceFiles/PrintoutTemplatePORT.pdf

// Step 1) Template definitions with table-based layouts
export const PRINT_TEMPLATES = {
    // Step 1a) Landscape 2D Template - North Arrow
    // CORRECTED: Footer is at BOTTOM spanning full width, not right side panel
    LANDSCAPE_2D: {
        name: "LAND_2D",
        mode: "2D",
        orientation: "landscape",
        referenceFile: "PrintoutTemplateLAND.pdf",
        zones: {
            // Step 1a1) Main map area - takes up top portion of page
            map: {
                x: 0.02,              // 2% margin from left
                y: 0.02,              // 2% margin from top
                width: 0.96,          // 96% of page width (full width)
                height: 0.75,         // 75% of page height (leaves room for footer)
                printSafeMargin: 0.05 // 5% internal margin
            },
            // Step 1a2) Footer panel - BOTTOM of page, full width
            // Structure: Leftmost column (vertical: North Arrow top, Logo bottom) | 
            //            Second column (CONNECTOR COUNT header + data) |
            //            Third column (BLAST STATISTICS header + data) |
            //            Rightmost section (multi-row: TITLE/BLASTNAME, DATE/TIME, Scale/Designer)
            footer: {
                x: 0.02,              // 2% margin from left
                y: 0.77,              // Starts at 77% from top (after map)
                width: 0.96,          // 96% of page width (full width)
                height: 0.21,         // 21% of page height (footer height)
                sections: {
                    // Top row: North Arrow (leftmost) | Connector Header | Stats Header | Title/BlastName (rightmost)
                    row1: {
                        y: 0,
                        height: 0.50,  // 50% of footer height (top half)
                        cells: [
                            {
                                id: "navigationIndicator",
                                content: "northArrow",
                                widthPercent: 0.12  // Leftmost column (spans top half)
                            },
                            {
                                id: "connectorCount",
                                content: "dynamic",
                                widthPercent: 0.20   // Second column header
                            },
                            {
                                id: "blastStatistics",
                                content: "dynamic",
                                widthPercent: 0.20   // Third column header
                            },
                            {
                                id: "titleBlastName",
                                content: "dynamic",
                                label: "TITLE",
                                widthPercent: 0.48    // Rightmost section
                            }
                        ]
                    },
                    // Second row: Logo (leftmost, below North Arrow) | Connector Data | Stats Data | Date/Time
                    row2: {
                        y: 0.50,
                        height: 0.25,  // 25% of footer height
                        cells: [
                            {
                                id: "logo",
                                content: "qrcode",
                                widthPercent: 0.12    // Logo below North Arrow (leftmost column bottom)
                            },
                            {
                                id: "connectorData",
                                content: "dynamic",
                                widthPercent: 0.20    // Connector count data cell
                            },
                            {
                                id: "blastStatsData",
                                content: "dynamic",
                                widthPercent: 0.20    // Blast statistics data cell
                            },
                            {
                                id: "dateTime",
                                content: "dynamic",
                                label: "DATE",
                                widthPercent: 0.48    // Date/Time in right section
                            }
                        ]
                    },
                    // Third row: Empty (left columns) | Scale | Designer
                    row3: {
                        y: 0.75,
                        height: 0.25,  // 25% of footer height (bottom row)
                        cells: [
                            {
                                id: "emptyLeft",
                                content: "empty",
                                widthPercent: 0.52     // Empty space (navigation + connector + stats columns)
                            },
                            {
                                id: "scale",
                                label: "Scale:",
                                content: "calculated",
                                widthPercent: 0.24     // Scale in right section
                            },
                            {
                                id: "designer",
                                label: "Designer:",
                                content: "dialog",
                                widthPercent: 0.24     // Designer in right section
                            }
                        ]
                    }
                }
            }
        }
    },

    // Step 1b) Landscape 3D Template - XYZ Gizmo (same layout as 2D, different nav indicator)
    LANDSCAPE_3D: {
        name: "LAND_3D",
        mode: "3D",
        orientation: "landscape",
        referenceFile: "PrintoutTemplateLAND.pdf",
        zones: {
            map: {
                x: 0.02,
                y: 0.02,
                width: 0.96,
                height: 0.75,
                printSafeMargin: 0.05
            },
            footer: {
                x: 0.02,
                y: 0.77,
                width: 0.96,
                height: 0.21,
                sections: {
                    row1: {
                        y: 0,
                        height: 0.50,
                        cells: [
                            {
                                id: "navigationIndicator",
                                content: "xyzGizmo",  // Different from 2D
                                widthPercent: 0.12
                            },
                            {
                                id: "connectorCount",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "blastStatistics",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "titleBlastName",
                                content: "dynamic",
                                label: "TITLE",
                                widthPercent: 0.48
                            }
                        ]
                    },
                    row2: {
                        y: 0.50,
                        height: 0.25,
                        cells: [
                            {
                                id: "logo",
                                content: "qrcode",
                                widthPercent: 0.12
                            },
                            {
                                id: "connectorData",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "blastStatsData",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "dateTime",
                                content: "dynamic",
                                label: "DATE",
                                widthPercent: 0.48
                            }
                        ]
                    },
                    row3: {
                        y: 0.75,
                        height: 0.25,
                        cells: [
                            {
                                id: "emptyLeft",
                                content: "empty",
                                widthPercent: 0.52
                            },
                            {
                                id: "scale",
                                label: "Scale:",
                                content: "calculated",
                                widthPercent: 0.24
                            },
                            {
                                id: "designer",
                                label: "Designer:",
                                content: "dialog",
                                widthPercent: 0.24
                            }
                        ]
                    }
                }
            }
        }
    },

    // Step 1c) Portrait 2D Template - North Arrow (footer at bottom, same structure as landscape)
    PORTRAIT_2D: {
        name: "PORT_2D",
        mode: "2D",
        orientation: "portrait",
        referenceFile: "PrintoutTemplatePORT.pdf",
        zones: {
            map: {
                x: 0.02,
                y: 0.02,
                width: 0.96,
                height: 0.75,
                printSafeMargin: 0.05
            },
            footer: {
                x: 0.02,
                y: 0.77,
                width: 0.96,
                height: 0.21,
                sections: {
                    row1: {
                        y: 0,
                        height: 0.50,
                        cells: [
                            {
                                id: "navigationIndicator",
                                content: "northArrow",
                                widthPercent: 0.12
                            },
                            {
                                id: "connectorCount",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "blastStatistics",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "titleBlastName",
                                content: "dynamic",
                                label: "TITLE",
                                widthPercent: 0.48
                            }
                        ]
                    },
                    row2: {
                        y: 0.50,
                        height: 0.25,
                        cells: [
                            {
                                id: "logo",
                                content: "qrcode",
                                widthPercent: 0.12
                            },
                            {
                                id: "connectorData",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "blastStatsData",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "dateTime",
                                content: "dynamic",
                                label: "DATE",
                                widthPercent: 0.48
                            }
                        ]
                    },
                    row3: {
                        y: 0.75,
                        height: 0.25,
                        cells: [
                            {
                                id: "emptyLeft",
                                content: "empty",
                                widthPercent: 0.52
                            },
                            {
                                id: "scale",
                                label: "Scale:",
                                content: "calculated",
                                widthPercent: 0.24
                            },
                            {
                                id: "designer",
                                label: "Designer:",
                                content: "dialog",
                                widthPercent: 0.24
                            }
                        ]
                    }
                }
            }
        }
    },

    // Step 1d) Portrait 3D Template - XYZ Gizmo (same structure as portrait 2D)
    PORTRAIT_3D: {
        name: "PORT_3D",
        mode: "3D",
        orientation: "portrait",
        referenceFile: "PrintoutTemplatePORT.pdf",
        zones: {
            map: {
                x: 0.02,
                y: 0.02,
                width: 0.96,
                height: 0.75,
                printSafeMargin: 0.05
            },
            footer: {
                x: 0.02,
                y: 0.77,
                width: 0.96,
                height: 0.21,
                sections: {
                    row1: {
                        y: 0,
                        height: 0.50,
                        cells: [
                            {
                                id: "navigationIndicator",
                                content: "xyzGizmo",  // Different from 2D
                                widthPercent: 0.12
                            },
                            {
                                id: "connectorCount",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "blastStatistics",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "titleBlastName",
                                content: "dynamic",
                                label: "TITLE",
                                widthPercent: 0.48
                            }
                        ]
                    },
                    row2: {
                        y: 0.50,
                        height: 0.25,
                        cells: [
                            {
                                id: "logo",
                                content: "qrcode",
                                widthPercent: 0.12
                            },
                            {
                                id: "connectorData",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "blastStatsData",
                                content: "dynamic",
                                widthPercent: 0.20
                            },
                            {
                                id: "dateTime",
                                content: "dynamic",
                                label: "DATE",
                                widthPercent: 0.48
                            }
                        ]
                    },
                    row3: {
                        y: 0.75,
                        height: 0.25,
                        cells: [
                            {
                                id: "emptyLeft",
                                content: "empty",
                                widthPercent: 0.52
                            },
                            {
                                id: "scale",
                                label: "Scale:",
                                content: "calculated",
                                widthPercent: 0.24
                            },
                            {
                                id: "designer",
                                label: "Designer:",
                                content: "dialog",
                                widthPercent: 0.24
                            }
                        ]
                    }
                }
            }
        }
    }
};

// Step 2) Helper function to get template by mode and orientation
export function getTemplate(mode, orientation) {
    const key = orientation.toUpperCase() + "_" + mode.toUpperCase();
    const template = PRINT_TEMPLATES[key];
    
    if (!template) {
        console.error("Template not found for mode: " + mode + ", orientation: " + orientation);
        return PRINT_TEMPLATES.LANDSCAPE_2D; // Default fallback
    }
    
    return template;
}

// Step 3) Helper to get all available templates
export function getAvailableTemplates() {
    return Object.keys(PRINT_TEMPLATES);
}

