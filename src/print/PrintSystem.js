///------------------ PRINT TEMPLATE SYSTEM ------------------///
// #region PRINT
// This module handles print preview, boundary calculations, and PDF generation
// GeoPDF support has been removed - standard PDF output only

import { jsPDF } from "jspdf";
import { drawDataForPrinting, printSurfaceSVG, printBoundarySVG, printDataSVG } from "./PrintRendering.js";
import { printHeader, printFooter, printHeaderSVG, printFooterSVG } from "./PrintStats.js";
import { generateTrueVectorPDF } from "./PrintVectorPDF.js";
import { getTemplate, getPaperDimensions, PAPER_SIZES } from "./PrintTemplates.js";
import { PrintLayoutManager } from "./PrintLayoutManager.js";
import { showPrintDialog } from "./PrintDialog.js";
import { PrintCaptureManager } from "./PrintCaptureManager.js";
import { getBlastStatisticsPerEntity } from "../helpers/BlastStatistics.js";

// ============== PRINT STATE VARIABLES ==============
export var printMode = false;
export var printOrientation = "landscape"; // 'landscape' or 'portrait'
export var printPaperSize = "A4"; // 'A4', 'A3', 'A2', 'A1', 'A0'
export var isPrinting = false;

// Paper size ratios (width:height in mm - landscape dimensions)
export var paperRatios = PAPER_SIZES;

// Print canvas for high-res output
export var printCanvas = document.createElement("canvas");
export var printCtx = printCanvas.getContext("2d");

// 3D print boundary overlay element
var printBoundary3DOverlay = null;

// Cached layout manager for current settings
var cachedLayoutManager = null;

// ============== LAYOUT MANAGER HELPERS ==============

// Step 1) Get or create layout manager for current settings
function getLayoutManager(mode) {
    mode = mode || "2D";
    
    // Step 1a) Get paper dimensions
    var paperDims = getPaperDimensions(printPaperSize, printOrientation);
    
    // Step 1b) Get template
    var template = getTemplate(mode, printOrientation);
    
    // Step 1c) Create layout manager
    return new PrintLayoutManager(template, paperDims.width, paperDims.height);
}

// ============== PRINT BOUNDARY CALCULATIONS ==============

// Step 2) Calculate print-safe boundary on canvas (UNIFIED for 2D and 3D)
// CRITICAL: Must use SAME calculation as drawPrintBoundary() for WYSIWYG consistency
// Uses calculateFullPreviewPositions() to match what user sees in preview
export function getPrintBoundary(canvas) {
    if (!printMode) return null;

    // Step 2a) Determine current mode
    var dimension2D3DBtn = document.getElementById("dimension2D-3DBtn");
    var isIn3DMode = dimension2D3DBtn && dimension2D3DBtn.checked === true;
    var mode = isIn3DMode ? "3D" : "2D";

    // Step 2b) Get layout manager
    var layoutMgr = getLayoutManager(mode);
    
    // Step 2c) Calculate FULL preview positions (same as drawPrintBoundary uses)
    var preview = layoutMgr.calculateFullPreviewPositions(canvas.width, canvas.height, 30);
    
    // Step 2d) Return the mapInner zone - this is the blue dashed area where data should be positioned
    // The outer is the map zone (black border), inner is the safe area (blue dashed)
    var mapZone = preview.map;
    var mapInner = preview.mapInner;
    
    // Step 2e) Calculate margin percent from the difference
    var marginX = mapInner.x - mapZone.x;
    var marginPercent = marginX / mapZone.width;
    
    return {
        x: mapZone.x,
        y: mapZone.y,
        width: mapZone.width,
        height: mapZone.height,
        innerX: mapInner.x,
        innerY: mapInner.y,
        innerWidth: mapInner.width,
        innerHeight: mapInner.height,
        marginPercent: marginPercent
    };
}

// Step 3) Draw full template preview on 2D canvas
// Shows map zone, footer zone with all cells, and labels
export function drawPrintBoundary(ctx, canvas) {
    if (!printMode) return;

    // Step 3a) Determine current mode
    var dimension2D3DBtn = document.getElementById("dimension2D-3DBtn");
    var isIn3DMode = dimension2D3DBtn && dimension2D3DBtn.checked === true;
    var mode = isIn3DMode ? "3D" : "2D";

    // Step 3b) Get layout manager
    var layoutMgr = getLayoutManager(mode);
    
    // Step 3c) Get full template preview positions
    var preview = layoutMgr.calculateFullPreviewPositions(canvas.width, canvas.height, 30);

    ctx.save();

    // Only draw preview in non-printing mode
    if (!isPrinting) {
        // Step 3d) Draw page outline (outer boundary - red dashed)
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(preview.page.x, preview.page.y, preview.page.width, preview.page.height);

        // Step 3e) Draw map zone outline
        ctx.strokeStyle = "#333333";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(preview.map.x, preview.map.y, preview.map.width, preview.map.height);

        // Step 3f) Draw map inner zone (print-safe area - blue dashed)
        ctx.strokeStyle = "#0066cc";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(preview.mapInner.x, preview.mapInner.y, preview.mapInner.width, preview.mapInner.height);

        // Step 3g) Draw "[MAP]" label in center of map zone
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("[MAP]", preview.map.x + preview.map.width / 2, preview.map.y + preview.map.height / 2);

        // Step 3h) Draw footer zone outline
        ctx.strokeStyle = "#333333";
        ctx.lineWidth = 1;
        ctx.strokeRect(preview.footer.x, preview.footer.y, preview.footer.width, preview.footer.height);

        // Step 3i) Draw footer column borders and labels
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000000";

        for (var i = 0; i < preview.footerColumns.length; i++) {
            var col = preview.footerColumns[i];
            
            // Draw column border
            ctx.strokeStyle = "#666666";
            ctx.lineWidth = 0.5;
            ctx.strokeRect(col.x, col.y, col.width, col.height);

            // Draw column label based on ID
            var colLabel = "";
            if (col.id === "navIndicator" || col.id === "navLogoColumn") {
                colLabel = mode === "3D" ? "[XYZ GIZMO]" : "[NORTH ARROW]";
            } else if (col.id === "connectorCount") {
                colLabel = "CONNECTOR\nCOUNT";
            } else if (col.id === "blastStatistics") {
                colLabel = "BLAST\nSTATISTICS";
            } else if (col.id === "logo") {
                colLabel = "[LOGO]\nblastingapps.com";
            } else if (col.id === "titleBlock") {
                // Title block has internal rows - don't label the whole column
                colLabel = "";
            }

            if (colLabel) {
                // Draw multi-line label
                var lines = colLabel.split("\n");
                var lineHeight = 12;
                var startY = col.y + col.height / 2 - (lines.length - 1) * lineHeight / 2;
                for (var l = 0; l < lines.length; l++) {
                    ctx.fillText(lines[l], col.x + col.width / 2, startY + l * lineHeight);
                }
            }
        }

        // Step 3j) Draw title block rows
        for (var j = 0; j < preview.titleBlockRows.length; j++) {
            var row = preview.titleBlockRows[j];
            
            // Draw row border
            ctx.strokeStyle = "#666666";
            ctx.lineWidth = 0.5;
            ctx.strokeRect(row.x, row.y, row.width, row.height);

            // Draw row label
            var rowLabel = "";
            if (row.id === "title") {
                rowLabel = "TITLE\n[BLASTNAME]";
            } else if (row.id === "date") {
                rowLabel = "DATE\n[DATE/TIME]";
            } else if (row.id === "scaleDesigner") {
                rowLabel = "Scale: [CALC]\nDesigner: [ENTRY]";
            }

            if (rowLabel) {
                var rLines = rowLabel.split("\n");
                var rLineHeight = 10;
                var rStartY = row.y + row.height / 2 - (rLines.length - 1) * rLineHeight / 2;
                ctx.font = "9px Arial";
                for (var rl = 0; rl < rLines.length; rl++) {
                    ctx.fillText(rLines[rl], row.x + row.width / 2, rStartY + rl * rLineHeight);
                }
            }
        }

        // Step 3k) Draw nav/logo rows for portrait mode
        if (preview.navLogoRows) {
            for (var k = 0; k < preview.navLogoRows.length; k++) {
                var navRow = preview.navLogoRows[k];
                
                // Draw row border
                ctx.strokeStyle = "#666666";
                ctx.lineWidth = 0.5;
                ctx.strokeRect(navRow.x, navRow.y, navRow.width, navRow.height);

                // Draw row label
                var navLabel = "";
                if (navRow.id === "navIndicator") {
                    navLabel = mode === "3D" ? "[XYZ]" : "[N]";
                } else if (navRow.id === "logo") {
                    navLabel = "[QR]";
                }

                if (navLabel) {
                    ctx.font = "8px Arial";
                    ctx.fillText(navLabel, navRow.x + navRow.width / 2, navRow.y + navRow.height / 2);
                }
            }
        }

        // Step 3l) Draw print preview label
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(preview.page.x, preview.page.y - 22, 200, 20);
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Print Preview: " + printPaperSize + " " + printOrientation + " (" + mode + ")", preview.page.x + 5, preview.page.y - 8);
    }

    ctx.restore();
}

// ============== 3D PRINT BOUNDARY OVERLAY SYSTEM ==============

// Step 4) Toggle 3D print preview mode
export function toggle3DPrintPreview(enabled, paperSize, orientation, threeRenderer) {
    if (enabled) {
        create3DPrintBoundaryOverlay(paperSize, orientation, threeRenderer);
    } else {
        remove3DPrintBoundaryOverlay();
    }
}

// Step 5) Create overlay canvas showing print boundaries for 3D mode
function create3DPrintBoundaryOverlay(paperSize, orientation, threeRenderer) {
    // Step 5a) Remove existing overlay if any
    remove3DPrintBoundaryOverlay();
    
    // Step 5b) Get Three.js canvas
    var threeCanvas = threeRenderer.getCanvas();
    var rect = threeCanvas.getBoundingClientRect();
    
    // Step 5c) Create overlay canvas
    var overlayCanvas = document.createElement("canvas");
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
    
    // Step 5d) Get layout manager
    var layoutMgr = getLayoutManager("3D");
    
    // Step 5e) Calculate full template preview positions
    var preview = layoutMgr.calculateFullPreviewPositions(rect.width, rect.height, 30);
    
    // Step 5f) Draw template preview
    var ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // Page outline (red dashed)
    ctx.strokeStyle = "red";
    ctx.setLineDash([10, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(preview.page.x, preview.page.y, preview.page.width, preview.page.height);
    
    // Map zone outline
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(preview.map.x, preview.map.y, preview.map.width, preview.map.height);
    
    // Map inner zone (blue dashed)
    ctx.strokeStyle = "rgba(0, 100, 255, 0.8)";
    ctx.setLineDash([5, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(preview.mapInner.x, preview.mapInner.y, preview.mapInner.width, preview.mapInner.height);
    
    // Footer zone outline
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(preview.footer.x, preview.footer.y, preview.footer.width, preview.footer.height);
    
    // Footer column borders
    ctx.strokeStyle = "#666666";
    ctx.lineWidth = 0.5;
    for (var i = 0; i < preview.footerColumns.length; i++) {
        var col = preview.footerColumns[i];
        ctx.strokeRect(col.x, col.y, col.width, col.height);
    }
    
    // Title block row borders
    for (var j = 0; j < preview.titleBlockRows.length; j++) {
        var row = preview.titleBlockRows[j];
        ctx.strokeRect(row.x, row.y, row.width, row.height);
    }
    
    // Nav/logo rows for portrait
    if (preview.navLogoRows) {
        for (var k = 0; k < preview.navLogoRows.length; k++) {
            var navRow = preview.navLogoRows[k];
            ctx.strokeRect(navRow.x, navRow.y, navRow.width, navRow.height);
        }
    }
    
    // Label
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(preview.page.x, preview.page.y - 22, 200, 20);
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText("Print Preview: " + paperSize + " " + orientation + " (3D)", preview.page.x + 5, preview.page.y - 8);
    
    // Step 5g) Insert into DOM
    threeCanvas.parentElement.appendChild(overlayCanvas);
    printBoundary3DOverlay = overlayCanvas;
    
    // Step 5h) Store boundary info for capture (use mapInner for data capture)
    overlayCanvas.boundaryInfo = {
        x: preview.mapInner.x,
        y: preview.mapInner.y,
        width: preview.mapInner.width,
        height: preview.mapInner.height,
        innerMargin: 0, // Already the inner margin
        paperSize: paperSize,
        orientation: orientation
    };
}

// Step 6) Remove 3D print boundary overlay
function remove3DPrintBoundaryOverlay() {
    if (printBoundary3DOverlay && printBoundary3DOverlay.parentElement) {
        printBoundary3DOverlay.parentElement.removeChild(printBoundary3DOverlay);
        printBoundary3DOverlay = null;
    }
}

// Step 7) Get 3D print boundary info (for capture system)
export function get3DPrintBoundary() {
    if (!printBoundary3DOverlay) return null;
    return printBoundary3DOverlay.boundaryInfo;
}

// Step 8) Set paper size and update boundaries
export function setPrintPaperSize(size) {
    printPaperSize = size;
    cachedLayoutManager = null; // Clear cache
    
    // Update 3D boundary if in preview mode
    if (printMode && window.is3DMode && window.threeRenderer) {
        toggle3DPrintPreview(true, printPaperSize, printOrientation, window.threeRenderer);
    }
}

// Step 9) Set orientation and update boundaries
export function setPrintOrientation(orientation) {
    printOrientation = orientation;
    cachedLayoutManager = null; // Clear cache
    
    // Update 3D boundary if in preview mode
    if (printMode && window.is3DMode && window.threeRenderer) {
        toggle3DPrintPreview(true, printPaperSize, printOrientation, window.threeRenderer);
    }
}

// ============== PRINT TO PDF ==============

// Step 10) Main print to PDF function
export function printToPDF(context) {
    // Step 10a) Detect current mode (2D or 3D)
    var dimension2D3DBtn = document.getElementById("dimension2D-3DBtn");
    var isIn3DMode = dimension2D3DBtn && dimension2D3DBtn.checked === true;
    var mode = isIn3DMode ? "3D" : "2D";
    
    // Step 10b) Enhance context with necessary print functions
    var enhancedContext = Object.assign({}, context, {
        getPrintBoundary: getPrintBoundary,
        get3DPrintBoundary: get3DPrintBoundary,
        mode: mode,
        is3DMode: isIn3DMode,
        printPaperSize: printPaperSize,
        printOrientation: printOrientation
    });
    
    // Step 10c) Show print dialog with user input
    showPrintDialog(mode, enhancedContext, function(userInput) {
        // Step 10d) Add paper settings to userInput
        userInput.paperSize = printPaperSize;
        userInput.orientation = printOrientation;
        
        // Step 10e) Generate PDF based on output type
        if (userInput.outputType === "vector") {
            // Vector PDF using jsPDF drawing commands
            generateTrueVectorPDF(
                Object.assign({}, enhancedContext, {
                    printPaperSize: printPaperSize,
                    printOrientation: printOrientation,
                    userInput: userInput,
                    mode: mode
                }),
                userInput,
                mode
            );
        } else {
            // Raster PDF (high-res PNG to PDF)
            printCanvasHiRes(
                Object.assign({}, enhancedContext, {
                    printPaperSize: printPaperSize,
                    printOrientation: printOrientation,
                    userInput: userInput,
                    mode: mode
                })
            );
        }
    });
}

// Step 11) High-resolution raster PDF generation with template layout
export function printCanvasHiRes(context) {
    var allBlastHoles = context.allBlastHoles;
    var allKADDrawingsMap = context.allKADDrawingsMap;
    var allAvailableSurfaces = context.allAvailableSurfaces;
    var showModalMessage = context.showModalMessage;
    var FloatingDialog = context.FloatingDialog;
    var userInput = context.userInput || { blastName: "Untitled Blast", designer: "" };
    var mode = context.mode || "2D";

    // Step 11a) Check for data
    if ((!allBlastHoles || allBlastHoles.length === 0) && 
        (!allKADDrawingsMap || allKADDrawingsMap.size === 0) && 
        (!allAvailableSurfaces || allAvailableSurfaces.length === 0)) {
        showModalMessage("No Data", "No data available for printing", "warning");
        return;
    }

    // Step 11b) Create progress dialog
    var progressContent = document.createElement("div");
    progressContent.style.textAlign = "center";
    progressContent.innerHTML = '<p>Generating High-Resolution PDF</p>' +
        '<p>Please wait, this may take a moment...</p>' +
        '<div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">' +
        '<div id="pdfProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>' +
        '</div>' +
        '<p id="pdfProgressText">Starting...</p>';

    var progressDialog = new FloatingDialog({
        title: "PDF Generation",
        content: progressContent,
        layoutType: "standard",
        width: 350,
        height: 200,
        showConfirm: false,
        showCancel: false,
        allowOutsideClick: false
    });

    progressDialog.show();

    var bar = document.getElementById("pdfProgressBar");
    var text = document.getElementById("pdfProgressText");

    setTimeout(function() {
        try {
            var dpi = 300;
            var mmToPx = dpi / 25.4;

            // Step 11c) Get paper dimensions
            var paperDims = getPaperDimensions(printPaperSize, printOrientation);
            var pageWidth = paperDims.width;
            var pageHeight = paperDims.height;

            // Step 11d) Safety check for maximum canvas size
            var MAX_CANVAS_SIDE = 16384;
            if (pageWidth * mmToPx > MAX_CANVAS_SIDE || pageHeight * mmToPx > MAX_CANVAS_SIDE) {
                throw new Error("The selected paper size (" + printPaperSize + ") creates an image too large for the browser.");
            }

            // Step 11e) Resize print canvas
            printCanvas.width = pageWidth * mmToPx;
            printCanvas.height = pageHeight * mmToPx;
            printCtx = printCanvas.getContext("2d");

            printCtx.imageSmoothingEnabled = true;
            printCtx.imageSmoothingQuality = "high";
            printCtx.fillStyle = "white";
            printCtx.fillRect(0, 0, printCanvas.width, printCanvas.height);

            // Step 11f) Get layout manager for template positions
            var layoutMgr = getLayoutManager(mode);
            var mapZone = layoutMgr.getMapZone();
            var mapInnerZone = layoutMgr.getMapInnerZone();
            var footerZone = layoutMgr.getFooterZone();
            var footerColumns = layoutMgr.getFooterColumns();
            var titleBlockRows = layoutMgr.getTitleBlockRows();
            var navLogoRows = layoutMgr.getNavLogoRows();

            // Step 11g) Convert mm to pixels for print area
            // Use mapZone (not mapInnerZone) to match vector PDF - data fills to border edge
            var printArea = {
                x: mapZone.x * mmToPx,
                y: mapZone.y * mmToPx,
                width: mapZone.width * mmToPx,
                height: mapZone.height * mmToPx
            };

            bar.style.width = "20%";
            text.textContent = "Drawing template...";

            setTimeout(function() {
                try {
                    // Step 11h) Draw map zone border
                    printCtx.strokeStyle = "#000000";
                    printCtx.lineWidth = 2;
                    printCtx.strokeRect(mapZone.x * mmToPx, mapZone.y * mmToPx, mapZone.width * mmToPx, mapZone.height * mmToPx);
                    
                    // Step 11i) Draw footer zone border
                    printCtx.strokeRect(footerZone.x * mmToPx, footerZone.y * mmToPx, footerZone.width * mmToPx, footerZone.height * mmToPx);
                    
                    // Step 11j) Draw footer column borders
                    printCtx.lineWidth = 1;
                    for (var c = 0; c < footerColumns.length; c++) {
                        var col = footerColumns[c];
                        printCtx.strokeRect(col.x * mmToPx, col.y * mmToPx, col.width * mmToPx, col.height * mmToPx);
                    }
                    
                    // Step 11k) Draw title block row borders
                    for (var r = 0; r < titleBlockRows.length; r++) {
                        var row = titleBlockRows[r];
                        printCtx.strokeRect(row.x * mmToPx, row.y * mmToPx, row.width * mmToPx, row.height * mmToPx);
                    }
                    
                    // Step 11l) Draw nav/logo row borders (portrait mode)
                    if (navLogoRows) {
                        for (var n = 0; n < navLogoRows.length; n++) {
                            var navRow = navLogoRows[n];
                            printCtx.strokeRect(navRow.x * mmToPx, navRow.y * mmToPx, navRow.width * mmToPx, navRow.height * mmToPx);
                        }
                    }
                    
                    // Step 11m) Draw navigation indicator (North Arrow or XYZ Gizmo)
                    var navCell = layoutMgr.getNavIndicatorCell();
                    if (navCell) {
                        // Use 60% of cell size to prevent cutting off (same as vector PDF)
                        var navSizeMM = Math.min(navCell.width, navCell.height) * 0.6;
                        var navSize = navSizeMM * mmToPx;
                        var navCenterX = (navCell.x + navCell.width / 2) * mmToPx;
                        var navCenterY = (navCell.y + navCell.height / 2) * mmToPx;
                        
                        if (mode === "2D") {
                            // Draw North Arrow directly (more reliable than Image object)
                            printCtx.save();
                            printCtx.translate(navCenterX, navCenterY);
                            printCtx.rotate(-(context.currentRotation || 0)); // Counter-rotate canvas rotation
                            
                            // Draw arrow shape scaled to navSize
                            var arrowScale = navSize / 120; // Original arrow canvas was 120x120
                            printCtx.fillStyle = "#000000";
                            printCtx.beginPath();
                            printCtx.moveTo(0, -30 * arrowScale);      // Arrow point (top)
                            printCtx.lineTo(-12 * arrowScale, 25 * arrowScale);     // Left wing
                            printCtx.lineTo(0, 15 * arrowScale);       // Center notch
                            printCtx.lineTo(12 * arrowScale, 25 * arrowScale);      // Right wing
                            printCtx.closePath();
                            printCtx.fill();
                            
                            // Draw "N" label above arrow
                            printCtx.font = "bold " + (18 * arrowScale) + "px Arial";
                            printCtx.textAlign = "center";
                            printCtx.textBaseline = "bottom";
                            printCtx.fillText("N", 0, -35 * arrowScale);
                            
                            printCtx.restore();
                        } else {
                            // For 3D mode, try to capture gizmo image
                            try {
                                var navImageDataURL = PrintCaptureManager.captureXYZGizmo(context);
                                if (navImageDataURL && navImageDataURL.length > 100) {
                                    var navImg = new Image();
                                    navImg.src = navImageDataURL;
                                    var navX = (navCell.x + (navCell.width - navSizeMM) / 2) * mmToPx;
                                    var navY = (navCell.y + (navCell.height - navSizeMM) / 2) * mmToPx;
                                    
                                    // Data URLs load synchronously for basic canvas-generated images
                                    printCtx.drawImage(navImg, navX, navY, navSize, navSize);
                                } else {
                                    // Fallback text for 3D
                                    printCtx.fillStyle = "#000000";
                                    printCtx.font = "bold " + (20 * mmToPx / 3) + "px Arial";
                                    printCtx.textAlign = "center";
                                    printCtx.textBaseline = "middle";
                                    printCtx.fillText("XYZ", navCenterX, navCenterY);
                                }
                            } catch (e) {
                                console.warn("Failed to capture XYZ gizmo:", e);
                                printCtx.fillStyle = "#000000";
                                printCtx.font = "bold " + (20 * mmToPx / 3) + "px Arial";
                                printCtx.textAlign = "center";
                                printCtx.textBaseline = "middle";
                                printCtx.fillText("XYZ", navCenterX, navCenterY);
                            }
                        }
                    }
                    
                    // Step 11n) Draw footer content (matching vector PDF)
                    var getVoronoiMetrics = context.getVoronoiMetrics;
                    
                    // Helper: hex to rgb
                    function hexToRgb(hex) {
                        if (!hex || typeof hex !== "string") return { r: 0, g: 0, b: 0 };
                        hex = hex.replace("#", "");
                        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
                        var r = parseInt(hex.substring(0, 2), 16);
                        var g = parseInt(hex.substring(2, 4), 16);
                        var b = parseInt(hex.substring(4, 6), 16);
                        return isNaN(r) ? { r: 0, g: 0, b: 0 } : { r: r, g: g, b: b };
                    }
                    
                    // Helper: get contrast color
                    function getContrastColor(bgColor) {
                        var rgb = hexToRgb(bgColor);
                        var luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
                        return luminance < 0.5 ? "#ffffff" : "#000000";
                    }
                    
                    // Step 11n1) Draw Connector Count with delay groups
                    var connectorCell = layoutMgr.getConnectorCountCell();
                    if (connectorCell && allBlastHoles && allBlastHoles.length > 0 && getVoronoiMetrics) {
                        try {
                            var stats = getBlastStatisticsPerEntity(allBlastHoles, getVoronoiMetrics);
                            var entityNames = Object.keys(stats);
                            
                            // Draw header
                            printCtx.fillStyle = "#000000";
                            printCtx.font = "bold " + (9 * mmToPx / 3) + "px Arial";
                            printCtx.textAlign = "center";
                            printCtx.fillText("CONNECTOR COUNT", (connectorCell.x + connectorCell.width / 2) * mmToPx, (connectorCell.y + 4) * mmToPx);
                            
                            // Draw delay groups as colored rows
                            var rowY = connectorCell.y + 9;
                            var rowHeight = 3.5;
                            var padding = 1;
                            
                            for (var e = 0; e < entityNames.length; e++) {
                                var entityStats = stats[entityNames[e]];
                                if (entityStats && entityStats.delayGroups) {
                                    var delays = Object.keys(entityStats.delayGroups).sort(function(a, b) {
                                        if (a === "Unknown") return 1;
                                        if (b === "Unknown") return -1;
                                        return parseFloat(a) - parseFloat(b);
                                    });
                                    
                                    for (var d = 0; d < delays.length && rowY < connectorCell.y + connectorCell.height - 3; d++) {
                                        var delay = delays[d];
                                        var group = entityStats.delayGroups[delay];
                                        var bgColor = group.color || "#ffffff";
                                        var txtColor = getContrastColor(bgColor);
                                        
                                        // Draw colored background
                                        var bgRgb = hexToRgb(bgColor);
                                        printCtx.fillStyle = "rgb(" + bgRgb.r + "," + bgRgb.g + "," + bgRgb.b + ")";
                                        printCtx.fillRect((connectorCell.x + padding) * mmToPx, rowY * mmToPx, (connectorCell.width - padding * 2) * mmToPx, rowHeight * mmToPx);
                                        
                                        // Draw text
                                        var delayText = delay === "Unknown" ? "Unk" : delay + "ms";
                                        printCtx.fillStyle = txtColor;
                                        printCtx.font = (7 * mmToPx / 3) + "px Arial";
                                        printCtx.textAlign = "left";
                                        printCtx.fillText(delayText + ": " + group.count, (connectorCell.x + padding + 1) * mmToPx, (rowY + 2.5) * mmToPx);
                                        
                                        rowY += rowHeight + 0.5;
                                    }
                                }
                            }
                        } catch (e) {
                            printCtx.fillStyle = "#000000";
                            printCtx.font = "bold " + (9 * mmToPx / 3) + "px Arial";
                            printCtx.textAlign = "center";
                            printCtx.fillText("CONNECTOR COUNT", (connectorCell.x + connectorCell.width / 2) * mmToPx, (connectorCell.y + connectorCell.height / 2) * mmToPx);
                        }
                    } else if (connectorCell) {
                        printCtx.fillStyle = "#000000";
                        printCtx.font = "bold " + (9 * mmToPx / 3) + "px Arial";
                        printCtx.textAlign = "center";
                        printCtx.fillText("CONNECTOR COUNT", (connectorCell.x + connectorCell.width / 2) * mmToPx, (connectorCell.y + connectorCell.height / 2) * mmToPx);
                    }
                    
                    // Step 11n2) Draw Blast Statistics
                    var statsCell = layoutMgr.getBlastStatisticsCell();
                    if (statsCell && allBlastHoles && allBlastHoles.length > 0 && getVoronoiMetrics) {
                        try {
                            var blastStats = getBlastStatisticsPerEntity(allBlastHoles, getVoronoiMetrics);
                            var entityKeys = Object.keys(blastStats);
                            
                            // Draw header
                            printCtx.fillStyle = "#000000";
                            printCtx.font = "bold " + (9 * mmToPx / 3) + "px Arial";
                            printCtx.textAlign = "center";
                            printCtx.fillText("BLAST STATISTICS", (statsCell.x + statsCell.width / 2) * mmToPx, (statsCell.y + 4) * mmToPx);
                            
                            // Draw statistics
                            var statY = statsCell.y + 9;
                            var lineHeight = 3;
                            printCtx.font = (7 * mmToPx / 3) + "px Arial";
                            printCtx.textAlign = "left";
                            
                            for (var ek = 0; ek < entityKeys.length && statY < statsCell.y + statsCell.height - 3; ek++) {
                                var es = blastStats[entityKeys[ek]];
                                if (es) {
                                    printCtx.fillText("Holes: " + es.holeCount, (statsCell.x + 2) * mmToPx, statY * mmToPx);
                                    statY += lineHeight;
                                    if (statY < statsCell.y + statsCell.height - 3) {
                                        printCtx.fillText("Burden: " + es.burden.toFixed(2) + "m", (statsCell.x + 2) * mmToPx, statY * mmToPx);
                                        statY += lineHeight;
                                    }
                                    if (statY < statsCell.y + statsCell.height - 3) {
                                        printCtx.fillText("Spacing: " + es.spacing.toFixed(2) + "m", (statsCell.x + 2) * mmToPx, statY * mmToPx);
                                        statY += lineHeight;
                                    }
                                    if (statY < statsCell.y + statsCell.height - 3) {
                                        printCtx.fillText("Drill: " + es.drillMetres.toFixed(1) + "m", (statsCell.x + 2) * mmToPx, statY * mmToPx);
                                        statY += lineHeight;
                                    }
                                    if (statY < statsCell.y + statsCell.height - 3) {
                                        printCtx.fillText("Volume: " + es.volume.toFixed(0) + "m3", (statsCell.x + 2) * mmToPx, statY * mmToPx);
                                        statY += lineHeight;
                                    }
                                }
                            }
                        } catch (e) {
                            printCtx.fillStyle = "#000000";
                            printCtx.font = "bold " + (9 * mmToPx / 3) + "px Arial";
                            printCtx.textAlign = "center";
                            printCtx.fillText("BLAST STATISTICS", (statsCell.x + statsCell.width / 2) * mmToPx, (statsCell.y + statsCell.height / 2) * mmToPx);
                        }
                    } else if (statsCell) {
                        printCtx.fillStyle = "#000000";
                        printCtx.font = "bold " + (9 * mmToPx / 3) + "px Arial";
                        printCtx.textAlign = "center";
                        printCtx.fillText("BLAST STATISTICS", (statsCell.x + statsCell.width / 2) * mmToPx, (statsCell.y + statsCell.height / 2) * mmToPx);
                    }
                    
                    // Step 11n3) Draw Logo/QR code
                    var logoCell = layoutMgr.getLogoCell();
                    if (logoCell) {
                        // Load and draw QR code
                        var qrImg = new Image();
                        qrImg.crossOrigin = "anonymous";
                        qrImg.src = "icons/kirra2d-qr-code.png";
                        
                        // Try to draw immediately if cached
                        if (qrImg.complete && qrImg.naturalWidth > 0) {
                            var qrSize = Math.min(logoCell.width, logoCell.height) * 0.6 * mmToPx;
                            var qrX = (logoCell.x + (logoCell.width - logoCell.width * 0.6) / 2) * mmToPx;
                            var qrY = (logoCell.y + (logoCell.height - logoCell.height * 0.6) / 2 - 2) * mmToPx;
                            try {
                                printCtx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
                            } catch (e) {
                                console.warn("Could not draw QR code:", e);
                            }
                        }
                        
                        // URL below
                        printCtx.fillStyle = "#000000";
                        printCtx.font = (5 * mmToPx / 3) + "px Arial";
                        printCtx.textAlign = "center";
                        printCtx.fillText("blastingapps.com", (logoCell.x + logoCell.width / 2) * mmToPx, (logoCell.y + logoCell.height - 2) * mmToPx);
                    }
                    
                    // Step 11n4) Title block rows
                    printCtx.fillStyle = "#000000";
                    for (var tr = 0; tr < titleBlockRows.length; tr++) {
                        var trow = titleBlockRows[tr];
                        printCtx.textAlign = "left";
                        
                        if (trow.id === "title") {
                            printCtx.font = "bold " + (10 * mmToPx / 3) + "px Arial";
                            printCtx.fillText("TITLE", (trow.x + 2) * mmToPx, (trow.y + trow.height * 0.35) * mmToPx);
                            var blastNames = [];
                            if (allBlastHoles) {
                                allBlastHoles.forEach(function(hole) {
                                    if (hole.entityName && blastNames.indexOf(hole.entityName) === -1) {
                                        blastNames.push(hole.entityName);
                                    }
                                });
                            }
                            var displayName = blastNames.join(", ") || userInput.blastName || "Untitled";
                            printCtx.font = (8 * mmToPx / 3) + "px Arial";
                            printCtx.fillText("[" + displayName + "]", (trow.x + 2) * mmToPx, (trow.y + trow.height * 0.7) * mmToPx);
                        } else if (trow.id === "date") {
                            printCtx.font = "bold " + (8 * mmToPx / 3) + "px Arial";
                            printCtx.fillText("DATE", (trow.x + 2) * mmToPx, (trow.y + trow.height * 0.35) * mmToPx);
                            var now = new Date();
                            var dateStr = now.toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
                            var timeStr = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
                            printCtx.font = (7 * mmToPx / 3) + "px Arial";
                            printCtx.fillText("[" + dateStr + " " + timeStr + "]", (trow.x + 2) * mmToPx, (trow.y + trow.height * 0.7) * mmToPx);
                        } else if (trow.id === "scaleDesigner") {
                            printCtx.font = (8 * mmToPx / 3) + "px Arial";
                            printCtx.fillText("Scale: [1:1000]", (trow.x + 2) * mmToPx, (trow.y + trow.height * 0.25) * mmToPx);
                            printCtx.fillText("Designer: [" + (userInput.designer || "") + "]", (trow.x + 2) * mmToPx, (trow.y + trow.height * 0.65) * mmToPx);
                        }
                    }
                    
                    bar.style.width = "40%";
                    text.textContent = "Drawing data...";

                    setTimeout(function() {
                        // Step 11o) Draw data in print area with clipping to prevent overflow into footer
                        printCtx.save();
                        
                        // Create clipping region for map zone
                        printCtx.beginPath();
                        printCtx.rect(printArea.x, printArea.y, printArea.width, printArea.height);
                        printCtx.clip();
                        
                        // Now draw the data - it will be clipped to the map zone
                        drawDataForPrinting(printCtx, printArea, context);
                        
                        // Restore context to remove clipping
                        printCtx.restore();
                        
                        bar.style.width = "80%";
                        text.textContent = "Generating image...";

                        setTimeout(function() {
                            // Step 11p) Generate PDF
                            var imgData = printCanvas.toDataURL("image/png", 1.0);

                            if (!imgData || imgData.length < 100 || imgData === "data:,") {
                                throw new Error("Failed to generate canvas image.");
                            }

                            var orientation = printOrientation === "landscape" ? "l" : "p";
                            var pdf = new jsPDF(orientation, "mm", printPaperSize.toLowerCase());
                            pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
                            pdf.save("kirra-blast-raster-" + new Date().toISOString().split("T")[0] + ".pdf");
                            
                            bar.style.width = "100%";
                            text.textContent = "Complete!";

                            setTimeout(function() {
                                progressDialog.close();
                                showModalMessage("Success", "Raster PDF created successfully!", "success");
                            }, 300);
                        }, 100);
                    }, 100);
                } catch (error) {
                    progressDialog.close();
                    console.error("PDF Generation Error:", error);
                    showModalMessage("PDF Creation Failed", "Error: " + error.message, "error");
                }
            }, 250);
        } catch (error) {
            progressDialog.close();
            console.error("PDF Generation Error:", error);
            showModalMessage("PDF Creation Failed", "Error: " + error.message, "error");
        }
    }, 250);
}

// Step 12) Deprecated function kept for backward compatibility
export function printCanvasHiResRaster(context) {
    printCanvasHiRes(context);
}

// ============== UI EVENT HANDLERS ==============

// Step 13) Change paper size
export function changePaperSize(drawDataCallback) {
    var paperSizeSelect = document.getElementById("paperSize");
    if (paperSizeSelect) {
        printPaperSize = paperSizeSelect.value;
        cachedLayoutManager = null;
        if (printMode && drawDataCallback) {
            drawDataCallback(); // Redraw with new paper size
        }
    }
}

// Step 14) Change orientation
export function changeOrientation(drawDataCallback) {
    var orientationSelect = document.getElementById("orientation");
    if (orientationSelect) {
        printOrientation = orientationSelect.value;
        cachedLayoutManager = null;
        if (printMode && drawDataCallback) {
            drawDataCallback(); // Redraw with new orientation
        }
    }
}

// Step 15) Toggle print preview mode
export function togglePrintMode(updateStatusMessageCallback, drawDataCallback) {
    printMode = !printMode;

    // Sync the checkbox state
    var toggle = document.getElementById("addPrintPreviewToggle");
    if (toggle) toggle.checked = printMode;

    // Detect current mode
    var dimension2D3DBtn = document.getElementById("dimension2D-3DBtn");
    var isIn3DMode = dimension2D3DBtn && dimension2D3DBtn.checked === true;

    if (printMode) {
        // Entering print preview mode
        if (isIn3DMode) {
            // 3D mode - show overlay
            if (window.threeRenderer) {
                toggle3DPrintPreview(true, printPaperSize, printOrientation, window.threeRenderer);
                if (updateStatusMessageCallback) {
                    updateStatusMessageCallback("3D Print Preview Mode ON - Template shows what will be printed");
                }
            }
        } else {
            // 2D mode - redraw with template preview
            if (updateStatusMessageCallback) {
                updateStatusMessageCallback("Print Preview Mode ON - Position elements within the map zone");
            }
            if (drawDataCallback) {
                drawDataCallback();
            }
        }
    } else {
        // Exiting print preview mode
        if (isIn3DMode) {
            remove3DPrintBoundaryOverlay();
            if (updateStatusMessageCallback) {
                updateStatusMessageCallback("3D Print Preview Mode OFF");
            }
        } else {
            if (updateStatusMessageCallback) {
                updateStatusMessageCallback("Print Preview Mode OFF");
            }
            if (drawDataCallback) {
                drawDataCallback();
            }
        }
    }
}

// Step 16) Setup print event handlers
export function setupPrintEventHandlers(contextOrGetter) {
    // If it's a function, call it to get context; otherwise use it directly
    var getContext = typeof contextOrGetter === "function" ? contextOrGetter : function() { return contextOrGetter; };

    var printPreviewToggle = document.getElementById("addPrintPreviewToggle");
    if (printPreviewToggle) {
        printPreviewToggle.addEventListener("change", function() {
            var ctx = getContext();
            togglePrintMode(ctx.updateStatusMessage, ctx.drawData);
        });
    }

    var paperSizeSelect = document.getElementById("paperSize");
    if (paperSizeSelect) {
        paperSizeSelect.addEventListener("change", function() {
            var ctx = getContext();
            changePaperSize(ctx.drawData);
        });
    }

    var orientationSelect = document.getElementById("orientation");
    if (orientationSelect) {
        orientationSelect.addEventListener("change", function() {
            var ctx = getContext();
            changeOrientation(ctx.drawData);
        });
    }

    var printToPDFBtn = document.getElementById("printToPDFBtn");
    if (printToPDFBtn) {
        printToPDFBtn.addEventListener("click", function() {
            var context = getContext();
            var printContext = {
                allBlastHoles: context.allBlastHoles,
                allKADDrawingsMap: context.allKADDrawingsMap,
                allAvailableSurfaces: context.allAvailableSurfaces,
                loadedSurfaces: context.loadedSurfaces,
                loadedImages: context.loadedImages,
                selectedHole: context.selectedHole,
                canvas: context.canvas,
                currentScale: context.currentScale,
                centroidX: context.centroidX,
                centroidY: context.centroidY,
                currentRotation: context.currentRotation,
                imageVisible: context.imageVisible,
                surfaceVisible: context.surfaceVisible,
                getDisplayOptions: context.getDisplayOptions,
                buildHoleMap: context.buildHoleMap,
                developerModeEnabled: context.developerModeEnabled,
                simplifyByPxDist: context.simplifyByPxDist,
                worldToCanvas: context.worldToCanvas,
                delaunayTriangles: context.delaunayTriangles,
                maxEdgeLength: context.maxEdgeLength,
                createBlastBoundaryPolygon: context.createBlastBoundaryPolygon,
                offsetPolygonClipper: context.offsetPolygonClipper,
                getAverageDistance: context.getAverageDistance,
                selectedVoronoiMetric: context.selectedVoronoiMetric,
                isVoronoiLegendFixed: context.isVoronoiLegendFixed,
                getVoronoiMetrics: context.getVoronoiMetrics,
                useToeLocation: context.useToeLocation,
                clipVoronoiCells: context.clipVoronoiCells,
                getPFColor: context.getPFColor,
                getMassColor: context.getMassColor,
                getVolumeColor: context.getVolumeColor,
                getAreaColor: context.getAreaColor,
                getLengthColor: context.getLengthColor,
                getHoleFiringTimeColor: context.getHoleFiringTimeColor,
                strokeColor: context.strokeColor,
                directionArrows: context.directionArrows,
                contourLinesArray: context.contourLinesArray,
                firstMovementSize: context.firstMovementSize,
                currentFontSize: context.currentFontSize,
                holeScale: context.holeScale,
                transparentFillColor: context.transparentFillColor,
                textFillColor: context.textFillColor,
                fillColor: context.fillColor,
                depthColor: context.depthColor,
                angleDipColor: context.angleDipColor,
                darkModeEnabled: context.darkModeEnabled,
                isAddingConnector: context.isAddingConnector,
                isAddingMultiConnector: context.isAddingMultiConnector,
                fromHoleStore: context.fromHoleStore,
                firstSelectedHole: context.firstSelectedHole,
                secondSelectedHole: context.secondSelectedHole,
                selectedMultipleHoles: context.selectedMultipleHoles,
                showSurfaceLegend: context.showSurfaceLegend,
                elevationToColor: context.elevationToColor,
                currentGradient: context.currentGradient,
                surfaceTextureData: context.surfaceTextureData,
                buildVersion: context.buildVersion,
                showModalMessage: context.showModalMessage,
                FloatingDialog: context.FloatingDialog,
                threeRenderer: context.threeRenderer,
                cameraControls: context.cameraControls
            };
            printToPDF(printContext);
        });
    }
}

// #endregion PRINT

