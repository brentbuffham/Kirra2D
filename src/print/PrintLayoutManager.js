/* prettier-ignore-file */
//=================================================
// PrintLayoutManager.js - Template Position Calculator
//=================================================
// Converts template definitions to absolute positions in mm
// Works with both 2D and 3D modes, landscape and portrait orientations

import { calculateZonePositions, getPaperDimensions } from "./PrintTemplates.js";

export class PrintLayoutManager {
    // Step 1) Constructor - initialize with template and page dimensions
    constructor(template, pageWidth, pageHeight) {
        this.template = template;
        this.pageWidth = pageWidth;   // in mm
        this.pageHeight = pageHeight; // in mm
        
        // Step 1a) Pre-calculate all zone positions
        this.positions = calculateZonePositions(template, pageWidth, pageHeight);
    }

    // Step 2) Get the map zone rectangle (outer boundary)
    getMapZone() {
        return this.positions.map;
    }

    // Step 3) Get the map zone inner area (print-safe area inside blue dashed lines)
    getMapInnerZone() {
        return this.positions.mapInner;
    }

    // Step 4) Get the footer zone rectangle
    getFooterZone() {
        return this.positions.footer;
    }

    // Step 5) Get all footer column positions
    getFooterColumns() {
        return this.positions.footerColumns;
    }

    // Step 6) Get a specific footer column by ID
    getFooterColumn(columnId) {
        var columns = this.positions.footerColumns;
        for (var i = 0; i < columns.length; i++) {
            if (columns[i].id === columnId) {
                return columns[i];
            }
        }
        return null;
    }

    // Step 7) Get title block row positions
    getTitleBlockRows() {
        return this.positions.titleBlockRows;
    }

    // Step 8) Get a specific title block row by ID
    getTitleBlockRow(rowId) {
        var rows = this.positions.titleBlockRows;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].id === rowId) {
                return rows[i];
            }
        }
        return null;
    }

    // Step 9) Get nav/logo rows (portrait mode only)
    getNavLogoRows() {
        return this.positions.navLogoRows || null;
    }

    // Step 10) Get navigation indicator cell position
    // In landscape: full height of first column
    // In portrait: top half of first column
    getNavIndicatorCell() {
        var navLogoRows = this.positions.navLogoRows;
        if (navLogoRows && navLogoRows.length > 0) {
            // Portrait mode - nav indicator is in first row of nav/logo column
            return navLogoRows[0];
        } else {
            // Landscape mode - nav indicator is full first column
            return this.positions.footerColumns[0];
        }
    }

    // Step 11) Get logo cell position
    // In landscape: separate column (4th column)
    // In portrait: bottom half of first column
    getLogoCell() {
        var navLogoRows = this.positions.navLogoRows;
        if (navLogoRows && navLogoRows.length > 1) {
            // Portrait mode - logo is in second row of nav/logo column
            return navLogoRows[1];
        } else {
            // Landscape mode - logo is separate column (index 3)
            return this.getFooterColumn("logo");
        }
    }

    // Step 12) Get connector count cell position
    getConnectorCountCell() {
        return this.getFooterColumn("connectorCount");
    }

    // Step 13) Get blast statistics cell position
    getBlastStatisticsCell() {
        return this.getFooterColumn("blastStatistics");
    }

    // Step 14) Get title cell position (inside title block)
    getTitleCell() {
        return this.getTitleBlockRow("title");
    }

    // Step 15) Get date cell position (inside title block)
    getDateCell() {
        return this.getTitleBlockRow("date");
    }

    // Step 16) Get scale/designer row position (inside title block)
    getScaleDesignerCell() {
        return this.getTitleBlockRow("scaleDesigner");
    }

    // Step 17) Calculate scale ratio from print scale
    // printScale is pixels per meter (or mm per meter)
    calculateScaleRatio(printScale) {
        if (!printScale || printScale <= 0) {
            return "1:1000";
        }
        
        // Step 17a) Calculate ratio
        // If printScale = 1 mm/m, then 1mm on paper = 1m in reality = 1000mm
        // So scale ratio = 1:1000
        var ratio = Math.round(1000 / printScale);
        
        // Step 17b) Format nicely for common scales
        if (ratio >= 1000) {
            return "1:" + ratio;
        } else if (ratio >= 100) {
            return "1:" + ratio;
        } else {
            return "1:" + ratio;
        }
    }

    // Step 18) Get template info
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

    // Step 19) Get map zone aspect ratio (for boundary calculations)
    getMapAspectRatio() {
        var map = this.positions.map;
        return map.width / map.height;
    }

    // Step 20) Calculate print boundary for screen preview
    // This fits the map zone aspect ratio into the available canvas space
    calculatePreviewBoundary(canvasWidth, canvasHeight, margin) {
        margin = margin || 30; // Default 30px margin
        
        // Step 20a) Get map zone aspect ratio from template
        var mapAspect = this.getMapAspectRatio();
        
        // Step 20b) Calculate available space
        var availableWidth = canvasWidth - margin * 2;
        var availableHeight = canvasHeight - margin * 2;
        var canvasAspect = availableWidth / availableHeight;
        
        // Step 20c) Fit boundary maintaining aspect ratio
        var boundaryWidth, boundaryHeight;
        if (canvasAspect > mapAspect) {
            // Canvas is wider - fit to height
            boundaryHeight = availableHeight;
            boundaryWidth = boundaryHeight * mapAspect;
        } else {
            // Canvas is taller - fit to width
            boundaryWidth = availableWidth;
            boundaryHeight = boundaryWidth / mapAspect;
        }
        
        // Step 20d) Center the boundary
        var boundaryX = (canvasWidth - boundaryWidth) / 2;
        var boundaryY = (canvasHeight - boundaryHeight) / 2;
        
        // Step 20e) Calculate inner safe area (using template's printSafeMargin)
        var safeMarginPercent = this.template.zones.map.printSafeMargin || 0.02;
        var innerMargin = boundaryWidth * safeMarginPercent;
        
        return {
            outer: {
                x: boundaryX,
                y: boundaryY,
                width: boundaryWidth,
                height: boundaryHeight
            },
            inner: {
                x: boundaryX + innerMargin,
                y: boundaryY + innerMargin,
                width: boundaryWidth - innerMargin * 2,
                height: boundaryHeight - innerMargin * 2
            },
            marginPercent: safeMarginPercent
        };
    }

    // Step 21) Calculate full template preview positions for screen display
    // This maps the PDF template to screen coordinates for WYSIWYG preview
    calculateFullPreviewPositions(canvasWidth, canvasHeight, margin) {
        margin = margin || 30;
        
        // Step 21a) Calculate page aspect ratio (full page, not just map)
        var pageAspect = this.pageWidth / this.pageHeight;
        
        // Step 21b) Calculate available space
        var availableWidth = canvasWidth - margin * 2;
        var availableHeight = canvasHeight - margin * 2;
        var canvasAspect = availableWidth / availableHeight;
        
        // Step 21c) Fit full page maintaining aspect ratio
        var previewWidth, previewHeight;
        if (canvasAspect > pageAspect) {
            // Canvas is wider - fit to height
            previewHeight = availableHeight;
            previewWidth = previewHeight * pageAspect;
        } else {
            // Canvas is taller - fit to width
            previewWidth = availableWidth;
            previewHeight = previewWidth / pageAspect;
        }
        
        // Step 21d) Center the preview
        var previewX = (canvasWidth - previewWidth) / 2;
        var previewY = (canvasHeight - previewHeight) / 2;
        
        // Step 21e) Scale factor from page mm to screen pixels
        var scaleX = previewWidth / this.pageWidth;
        var scaleY = previewHeight / this.pageHeight;
        
        // Step 21f) Helper function to convert mm position to screen position
        var self = this;
        function mmToScreen(mmX, mmY, mmWidth, mmHeight) {
            return {
                x: previewX + mmX * scaleX,
                y: previewY + mmY * scaleY,
                width: mmWidth * scaleX,
                height: mmHeight * scaleY
            };
        }
        
        // Step 21g) Calculate all zone positions in screen coordinates
        var result = {
            page: {
                x: previewX,
                y: previewY,
                width: previewWidth,
                height: previewHeight
            },
            scaleX: scaleX,
            scaleY: scaleY
        };
        
        // Map zone
        var map = this.positions.map;
        result.map = mmToScreen(map.x, map.y, map.width, map.height);
        
        // Map inner zone
        var mapInner = this.positions.mapInner;
        result.mapInner = mmToScreen(mapInner.x, mapInner.y, mapInner.width, mapInner.height);
        
        // Footer zone
        var footer = this.positions.footer;
        result.footer = mmToScreen(footer.x, footer.y, footer.width, footer.height);
        
        // Footer columns
        result.footerColumns = [];
        for (var i = 0; i < this.positions.footerColumns.length; i++) {
            var col = this.positions.footerColumns[i];
            result.footerColumns.push({
                id: col.id,
                x: previewX + col.x * scaleX,
                y: previewY + col.y * scaleY,
                width: col.width * scaleX,
                height: col.height * scaleY
            });
        }
        
        // Title block rows
        result.titleBlockRows = [];
        for (var j = 0; j < this.positions.titleBlockRows.length; j++) {
            var row = this.positions.titleBlockRows[j];
            result.titleBlockRows.push({
                id: row.id,
                label: row.label,
                labels: row.labels,
                x: previewX + row.x * scaleX,
                y: previewY + row.y * scaleY,
                width: row.width * scaleX,
                height: row.height * scaleY
            });
        }
        
        // Nav/logo rows (portrait only)
        if (this.positions.navLogoRows) {
            result.navLogoRows = [];
            for (var k = 0; k < this.positions.navLogoRows.length; k++) {
                var navRow = this.positions.navLogoRows[k];
                result.navLogoRows.push({
                    id: navRow.id,
                    content: navRow.content,
                    label: navRow.label,
                    x: previewX + navRow.x * scaleX,
                    y: previewY + navRow.y * scaleY,
                    width: navRow.width * scaleX,
                    height: navRow.height * scaleY
                });
            }
        }
        
        return result;
    }

    // Step 22) Debug: Print all positions
    debugPrintLayout() {
        console.log("=== Layout Debug: " + this.template.name + " ===");
        console.log("Page: " + this.pageWidth + "mm x " + this.pageHeight + "mm");
        console.log("Map Zone: ", this.positions.map);
        console.log("Map Inner: ", this.positions.mapInner);
        console.log("Footer Zone: ", this.positions.footer);
        console.log("Footer Columns: ", this.positions.footerColumns);
        console.log("Title Block Rows: ", this.positions.titleBlockRows);
        if (this.positions.navLogoRows) {
            console.log("Nav/Logo Rows: ", this.positions.navLogoRows);
        }
    }
}

