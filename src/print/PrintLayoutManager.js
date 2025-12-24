/* prettier-ignore-file */
//=================================================
// PrintLayoutManager.js - Template Position Calculator
//=================================================
// Converts template definitions to absolute positions in mm

export class PrintLayoutManager {
    constructor(template, pageWidth, pageHeight) {
        // Step 1) Store template and page dimensions
        this.template = template;
        this.pageWidth = pageWidth;   // in mm
        this.pageHeight = pageHeight; // in mm
    }

    // Step 2) Get zone rectangle in absolute mm coordinates
    getZoneRect(zoneName) {
        const zone = this.template.zones[zoneName];
        if (!zone) {
            console.error("Zone not found: " + zoneName);
            return null;
        }

        // Step 2a) Calculate absolute positions
        const x = this.resolveValue(zone.x, this.pageWidth);
        const y = this.resolveValue(zone.y, this.pageHeight);
        const width = this.resolveValue(zone.width, this.pageWidth);
        
        // Step 2b) Handle auto height for map zone
        let height;
        if (zone.height === "auto") {
            height = this.calculateAutoHeight(zoneName);
        } else {
            height = this.resolveValue(zone.height, this.pageHeight);
        }

        return {
            x: x,
            y: y,
            width: width,
            height: height,
            printSafeMargin: zone.printSafeMargin || 0
        };
    }

    // Step 3) Resolve value (handles percentages, absolute, negative)
    resolveValue(value, parentSize) {
        // Step 3a) Handle string percentages
        if (typeof value === "string") {
            if (value.includes("%")) {
                const percent = parseFloat(value) / 100;
                return percent * parentSize;
            } else if (value === "auto") {
                return null; // Calculate separately
            }
            // Try to parse as number
            return parseFloat(value);
        }
        
        // Step 3b) Handle negative (from bottom/right)
        if (value < 0) {
            return parentSize + value;
        }
        
        // Step 3c) Handle percentages (0 to 1)
        if (value > 0 && value < 1) {
            return value * parentSize;
        }
        
        // Step 3d) Absolute value in mm
        return value;
    }

    // Step 4) Calculate auto height (for map zone that fills remaining space)
    calculateAutoHeight(zoneName) {
        if (zoneName !== "map") {
            return this.pageHeight * 0.9; // Default 90%
        }

        // Calculate available height after margins
        const topMargin = this.resolveValue(this.template.zones.map.y, this.pageHeight);
        const bottomMargin = this.resolveValue(0.02, this.pageHeight); // Match top margin
        
        return this.pageHeight - topMargin - bottomMargin;
    }

    // Step 5) Get a specific cell from info panel
    getCellRect(zoneName, rowName, cellIndex) {
        const zone = this.getZoneRect(zoneName);
        if (!zone) return null;

        const section = this.template.zones[zoneName].sections[rowName];
        if (!section) {
            console.error("Section not found: " + rowName + " in zone: " + zoneName);
            return null;
        }

        if (!section.cells || cellIndex >= section.cells.length) {
            console.error("Cell index out of bounds: " + cellIndex + " in " + rowName);
            return null;
        }

        const cell = section.cells[cellIndex];

        // Step 5a) Calculate cell X position (accumulate widths of previous cells)
        let cellX = zone.x;
        for (let i = 0; i < cellIndex; i++) {
            cellX += zone.width * section.cells[i].widthPercent;
        }

        // Step 5b) Calculate cell Y position (based on row position)
        const cellY = zone.y + zone.height * section.y;

        // Step 5c) Calculate cell dimensions
        const cellWidth = zone.width * cell.widthPercent;
        const cellHeight = zone.height * section.height;

        // Step 5d) Return cell rectangle with all properties
        return {
            x: cellX,
            y: cellY,
            width: cellWidth,
            height: cellHeight,
            id: cell.id,
            content: cell.content,
            label: cell.label || "",
            widthPercent: cell.widthPercent
        };
    }

    // Step 6) Get all cells in a row
    getRowCells(zoneName, rowName) {
        const zone = this.getZoneRect(zoneName);
        if (!zone) return [];

        const section = this.template.zones[zoneName].sections[rowName];
        if (!section || !section.cells) return [];

        const cells = [];
        for (let i = 0; i < section.cells.length; i++) {
            cells.push(this.getCellRect(zoneName, rowName, i));
        }

        return cells;
    }

    // Step 7) Get cell by ID (searches all rows)
    getCellById(zoneName, cellId) {
        const zone = this.template.zones[zoneName];
        if (!zone || !zone.sections) return null;

        // Step 7a) Search through all rows
        for (const rowName in zone.sections) {
            const section = zone.sections[rowName];
            if (!section.cells) continue;

            // Step 7b) Search cells in this row
            for (let i = 0; i < section.cells.length; i++) {
                const cell = section.cells[i];
                if (cell.id === cellId) {
                    return this.getCellRect(zoneName, rowName, i);
                }
            }
        }

        return null;
    }

    // Step 8) Get map zone with print-safe area calculated
    getMapZoneWithSafeArea() {
        const mapZone = this.getZoneRect("map");
        if (!mapZone) return null;

        // Step 8a) Calculate inner safe area
        const margin = mapZone.width * mapZone.printSafeMargin;

        return {
            outer: {
                x: mapZone.x,
                y: mapZone.y,
                width: mapZone.width,
                height: mapZone.height
            },
            inner: {
                x: mapZone.x + margin,
                y: mapZone.y + margin,
                width: mapZone.width - 2 * margin,
                height: mapZone.height - 2 * margin
            },
            margin: margin
        };
    }

    // Step 9) Helper to get info panel dimensions (backward compatibility)
    getInfoPanelRect() {
        // Try footer first (new structure), then infoPanel (old structure)
        const footer = this.getZoneRect("footer");
        if (footer) return footer;
        return this.getZoneRect("infoPanel");
    }
    
    // Step 9a) Helper to get footer dimensions
    getFooterRect() {
        return this.getZoneRect("footer");
    }

    // Step 10) Get template info
    getTemplateInfo() {
        return {
            name: this.template.name,
            mode: this.template.mode,
            orientation: this.template.orientation,
            referenceFile: this.template.referenceFile,
            pageWidth: this.pageWidth,
            pageHeight: this.pageHeight
        };
    }

    // Step 11) Calculate scale ratio from print scale
    // printScale is in mm/meter (e.g., 1mm on paper = 1m in reality = scale 1:1000)
    calculateScaleRatio(printScale) {
        if (!printScale || printScale <= 0) return "1:1000";
        
        // Scale ratio = 1000 / printScale
        // If printScale = 1 mm/m, then 1mm = 1m = 1000mm, so scale = 1:1000
        const ratio = Math.round(1000 / printScale);
        return "1:" + ratio;
    }

    // Step 12) Debug: Print all cell positions
    debugPrintLayout() {
        console.log("=== Layout Debug: " + this.template.name + " ===");
        console.log("Page: " + this.pageWidth + "mm x " + this.pageHeight + "mm");
        
        // Map zone
        const mapZone = this.getMapZoneWithSafeArea();
        console.log("Map Outer: ", mapZone.outer);
        console.log("Map Inner (safe): ", mapZone.inner);
        
        // Info panel
        const infoPanel = this.getInfoPanelRect();
        console.log("Info Panel: ", infoPanel);
        
        // All cells
        const zones = this.template.zones;
        for (const zoneName in zones) {
            const zone = zones[zoneName];
            if (zone.sections) {
                for (const rowName in zone.sections) {
                    console.log("--- " + zoneName + "." + rowName + " ---");
                    const cells = this.getRowCells(zoneName, rowName);
                    cells.forEach(function(cell) {
                        console.log("  " + cell.id + ": x=" + cell.x.toFixed(1) + " y=" + cell.y.toFixed(1) + 
                                    " w=" + cell.width.toFixed(1) + " h=" + cell.height.toFixed(1) +
                                    " [" + cell.content + "]");
                    });
                }
            }
        }
    }
}

