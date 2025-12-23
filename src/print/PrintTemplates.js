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
    LANDSCAPE_2D: {
        name: "LAND_2D",
        mode: "2D",
        orientation: "landscape",
        referenceFile: "PrintoutTemplateLAND.pdf",
        zones: {
            // Step 1a1) Main map area - left side
            map: {
                x: 0.02,              // 2% margin from left
                y: 0.02,              // 2% margin from top
                width: 0.60,          // 60% of page width
                height: 0.96,         // 96% of page height
                printSafeMargin: 0.05 // 5% internal margin
            },
            // Step 1a2) Info panel - right side table structure
            infoPanel: {
                x: 0.64,              // After map + gap
                y: 0.02,
                width: 0.34,          // 34% of page width
                height: 0.96,
                sections: {
                    // Row 1: North Arrow | Connector Count | Blast Stats | Logo
                    row1: {
                        y: 0,
                        height: 0.20,
                        cells: [
                            {
                                id: "navigationIndicator",
                                content: "northArrow",
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
                                content: "qrcode",
                                widthPercent: 0.25
                            }
                        ]
                    },
                    // Row 2: Title and Blast Name (full width)
                    row2: {
                        y: 0.20,
                        height: 0.15,
                        cells: [
                            {
                                id: "titleBlastName",
                                content: "dynamic",
                                label: "TITLE",
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
                                content: "dynamic",
                                label: "DATE",
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

    // Step 1b) Landscape 3D Template - XYZ Gizmo (same layout, different nav indicator)
    LANDSCAPE_3D: {
        name: "LAND_3D",
        mode: "3D",
        orientation: "landscape",
        referenceFile: "PrintoutTemplateLAND.pdf",
        zones: {
            map: {
                x: 0.02,
                y: 0.02,
                width: 0.60,
                height: 0.96,
                printSafeMargin: 0.05
            },
            infoPanel: {
                x: 0.64,
                y: 0.02,
                width: 0.34,
                height: 0.96,
                sections: {
                    row1: {
                        y: 0,
                        height: 0.20,
                        cells: [
                            {
                                id: "navigationIndicator",
                                content: "xyzGizmo",  // Different from 2D
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
                                content: "qrcode",
                                widthPercent: 0.25
                            }
                        ]
                    },
                    row2: {
                        y: 0.20,
                        height: 0.15,
                        cells: [
                            {
                                id: "titleBlastName",
                                content: "dynamic",
                                label: "TITLE",
                                widthPercent: 1.0
                            }
                        ]
                    },
                    row3: {
                        y: 0.35,
                        height: 0.10,
                        cells: [
                            {
                                id: "dateTime",
                                content: "dynamic",
                                label: "DATE",
                                widthPercent: 1.0
                            }
                        ]
                    },
                    row4: {
                        y: 0.45,
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

    // Step 1c) Portrait 2D Template - North Arrow (different layout)
    PORTRAIT_2D: {
        name: "PORT_2D",
        mode: "2D",
        orientation: "portrait",
        referenceFile: "PrintoutTemplatePORT.pdf",
        zones: {
            map: {
                x: 0.02,
                y: 0.02,
                width: 0.60,
                height: 0.96,
                printSafeMargin: 0.05
            },
            infoPanel: {
                x: 0.64,
                y: 0.02,
                width: 0.34,
                height: 0.96,
                sections: {
                    // Row 1: North Arrow | Connector | Blast Stats | Title+BlastName
                    row1: {
                        y: 0,
                        height: 0.20,
                        cells: [
                            {
                                id: "navigationIndicator",
                                content: "northArrow",
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
                                id: "titleBlastName",  // Different position than landscape
                                content: "dynamic",
                                label: "TITLE",
                                widthPercent: 0.25
                            }
                        ]
                    },
                    // Row 2: Logo | empty | empty | Date+Time
                    row2: {
                        y: 0.20,
                        height: 0.15,
                        cells: [
                            {
                                id: "logo",  // Different position than landscape
                                content: "qrcode",
                                widthPercent: 0.25
                            },
                            {
                                id: "empty1",
                                content: "empty",
                                widthPercent: 0.25
                            },
                            {
                                id: "empty2",
                                content: "empty",
                                widthPercent: 0.25
                            },
                            {
                                id: "dateTime",
                                content: "dynamic",
                                label: "DATE",
                                widthPercent: 0.25
                            }
                        ]
                    },
                    // Row 3: Scale and Designer (full width)
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

    // Step 1d) Portrait 3D Template - XYZ Gizmo
    PORTRAIT_3D: {
        name: "PORT_3D",
        mode: "3D",
        orientation: "portrait",
        referenceFile: "PrintoutTemplatePORT.pdf",
        zones: {
            map: {
                x: 0.02,
                y: 0.02,
                width: 0.60,
                height: 0.96,
                printSafeMargin: 0.05
            },
            infoPanel: {
                x: 0.64,
                y: 0.02,
                width: 0.34,
                height: 0.96,
                sections: {
                    row1: {
                        y: 0,
                        height: 0.20,
                        cells: [
                            {
                                id: "navigationIndicator",
                                content: "xyzGizmo",  // Different from 2D
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
                                id: "titleBlastName",
                                content: "dynamic",
                                label: "TITLE",
                                widthPercent: 0.25
                            }
                        ]
                    },
                    row2: {
                        y: 0.20,
                        height: 0.15,
                        cells: [
                            {
                                id: "logo",
                                content: "qrcode",
                                widthPercent: 0.25
                            },
                            {
                                id: "empty1",
                                content: "empty",
                                widthPercent: 0.25
                            },
                            {
                                id: "empty2",
                                content: "empty",
                                widthPercent: 0.25
                            },
                            {
                                id: "dateTime",
                                content: "dynamic",
                                label: "DATE",
                                widthPercent: 0.25
                            }
                        ]
                    },
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

