///------------------ PRINT TEMPLATE SYSTEM ------------------///
// #region PRINT

import { jsPDF } from "jspdf";
import { drawDataForPrinting } from "./PrintRendering.js";
import { printHeader, printFooter } from "./PrintStats.js";
import { initVectorPDF, drawDataForPrintingVector } from "./PrintRenderingVector.js";

// Print template configuration
export let printMode = false;
export let printOrientation = "landscape"; // 'landscape' or 'portrait'
export let printPaperSize = "A4"; // 'A4', 'A3', 'A2', 'A1', 'A0'
export let isPrinting = false;

// Paper size ratios (width:height)
export const paperRatios = {
    A4: {
        width: 297,
        height: 210
    },
    A3: {
        width: 420,
        height: 297
    },
    A2: {
        width: 594,
        height: 420
    },
    A1: {
        width: 841,
        height: 594
    },
    A0: {
        width: 1189,
        height: 841
    }
};

// These are now declared with 'let' in the global scope to allow resizing.
export let printCanvas = document.createElement("canvas");
export let printCtx = printCanvas.getContext("2d");

// Calculate print-safe boundary on canvas
export function getPrintBoundary(canvas) {
    if (!printMode) return null;

    const paper = paperRatios[printPaperSize];
    const aspectRatio = printOrientation === "landscape" ? paper.width / paper.height : paper.height / paper.width;

    // Calculate boundary that fits in canvas with margins
    const canvasMargin = 30; // pixels
    const availableWidth = canvas.width - canvasMargin * 2;
    const availableHeight = canvas.height - canvasMargin * 2;

    let boundaryWidth, boundaryHeight;

    if (availableWidth / availableHeight > aspectRatio) {
        // Canvas is wider than needed - fit by height
        boundaryHeight = availableHeight;
        boundaryWidth = boundaryHeight * aspectRatio;
    } else {
        // Canvas is taller than needed - fit by width
        boundaryWidth = availableWidth;
        boundaryHeight = boundaryWidth / aspectRatio;
    }

    return {
        x: (canvas.width - boundaryWidth) / 2,
        y: (canvas.height - boundaryHeight) / 2,
        width: boundaryWidth,
        height: boundaryHeight,
        marginPercent: 0.02 // 2% margin inside boundary
    };
}

export function drawPrintBoundary(ctx, canvas) {
    if (!printMode) return;

    const boundary = getPrintBoundary(canvas);
    if (!boundary) return;

    ctx.save();

    // Only draw boundaries in preview mode, not when actually printing
    if (!isPrinting) {
        // Draw outer boundary (paper edge)
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(boundary.x, boundary.y, boundary.width, boundary.height);

        // Draw inner boundary (print-safe area)
        const margin = boundary.width * boundary.marginPercent;
        ctx.strokeStyle = "#0066cc";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(boundary.x + margin, boundary.y + margin, boundary.width - margin * 2, boundary.height - margin * 2);
    }

    ctx.restore();
}

export function printToPDF(context) {
    // Step 1) Create message content matching showConfirmationDialog style
    const FloatingDialog = context.FloatingDialog;
    const darkModeEnabled = typeof window !== "undefined" && window.darkModeEnabled || false;
    const textColor = darkModeEnabled ? "#ffffff" : "#000000";
    const message = "Would you like to produce a Raster (flat image) PDF or a Vector (crisp at all resolutions) PDF?";
    const content = '<div style="color: #ff9800; font-size: 24px; margin-bottom: 15px; text-align: center;">⚠️</div>' + '<div style="color: ' + textColor + '; font-size: 16px; line-height: 1.4;">' + message + "</div>";

    // Step 2) Create FloatingDialog with Cancel + Option1 (Raster) + Option2 (Vector) buttons
    const chooserDialog = new FloatingDialog({
        title: "PDF Output",
        content: content,
        width: 500,
        height: 350,
        showConfirm: false,
        showCancel: true,
        showDeny: false,
        showOption1: true,
        showOption2: true,
        cancelText: "Cancel",
        option1Text: "Raster",
        option2Text: "Vector",
        draggable: true,
        resizable: false,
        closeOnOutsideClick: false,
        layoutType: "default",
        onCancel: function () {
            chooserDialog.close();
        },
        onOption1: function () {
            chooserDialog.close();
            printCanvasHiRes(context);
        },
        onOption2: function () {
            chooserDialog.close();
            printCanvasVector(context);
        }
    });

    chooserDialog.show();
}

// This is the complete, robust printing system.
export function printCanvasHiRes(context) {
    const {
        allBlastHoles,
        allKADDrawingsMap,
        allAvailableSurfaces,
        showModalMessage,
        FloatingDialog
    } = context;

    // Step 1) Fix the condition to allow printing if there are KAD drawings/surfaces/images even without blast holes
    if ((!allBlastHoles || allBlastHoles.length === 0) && (!allKADDrawingsMap || allKADDrawingsMap.size === 0) && (!allAvailableSurfaces || allAvailableSurfaces.length === 0)) {
        showModalMessage("No Data", "No data available for printing (no blast holes, KAD drawings, surfaces, or images)", "warning");
        return;
    }

    // Step 1) Create progress content with optional progress bar
    const progressContent = document.createElement("div");
    progressContent.style.textAlign = "center";
    progressContent.innerHTML = `
		<p>Generating High-Resolution PDF</p>
		<p>Please wait, this may take a moment...</p>
		<div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">
			<div id="pdfProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>
		</div>
		<p id="pdfProgressText">Starting...</p>
	`;

    // Step 2) Show FloatingDialog with progress indicator
    const progressDialog = new FloatingDialog({
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

    // Step 1: Get the bar and text elements
    const bar = document.getElementById("pdfProgressBar");
    const text = document.getElementById("pdfProgressText");
    // Use a short delay to ensure the browser has time to process before we
    // try to convert the canvas to an image. This avoids race conditions.
    setTimeout(() => {
        try {
            const dpi = 300;
            const mmToPx = dpi / 25.4;

            const paperSizes = {
                A4: {
                    width: 210,
                    height: 297
                },
                A3: {
                    width: 297,
                    height: 420
                },
                A2: {
                    width: 420,
                    height: 594
                },
                A1: {
                    width: 594,
                    height: 841
                },
                A0: {
                    width: 841,
                    height: 1189
                }
            };

            const paperSize = paperSizes[printPaperSize] || paperSizes["A4"];
            const isLandscape = printOrientation === "landscape";

            const pageWidth = isLandscape ? paperSize.height : paperSize.width;
            const pageHeight = isLandscape ? paperSize.width : paperSize.height;

            // Safety check for maximum canvas size to prevent browser errors
            const MAX_CANVAS_SIDE = 16384; // Most browsers support up to 16384px
            if (pageWidth * mmToPx > MAX_CANVAS_SIDE || pageHeight * mmToPx > MAX_CANVAS_SIDE) {
                throw new Error("The selected paper size (" + printPaperSize + ") creates an image too large for the browser to handle.");
            }

            // Resize the canvas and get a new context (resizing wipes the old one)
            printCanvas.width = pageWidth * mmToPx;
            printCanvas.height = pageHeight * mmToPx;
            printCtx = printCanvas.getContext("2d");

            printCtx.imageSmoothingEnabled = true;
            printCtx.imageSmoothingQuality = "high";
            printCtx.fillStyle = "white";
            printCtx.fillRect(0, 0, printCanvas.width, printCanvas.height);

            const margin = pageWidth * mmToPx * 0.02;
            const headerHeight = 200; // Approximate header height
            const footerHeight = 20; // Approximate footer height

            // Calculate the actual print area excluding header and footer
            const printArea = {
                x: margin,
                y: margin + headerHeight,
                width: printCanvas.width - 2 * margin,
                height: printCanvas.height - 2 * margin - headerHeight - footerHeight
            };

            setTimeout(() => {
                try {
                    // Step 1: Drawing data FIRST (bottom layer) - use the calculated print area that excludes header/footer
                    drawDataForPrinting(printCtx, printArea, context);
                    bar.style.width = "20%";
                    text.textContent = "Drawing data...";

                    setTimeout(() => {
                        // Step 2: Drawing header SECOND (on top of data)
                        printHeader(printCtx, margin, margin, printCanvas.width - 2 * margin, headerHeight, context);
                        bar.style.width = "40%";
                        text.textContent = "Drawing header...";

                        setTimeout(() => {
                            // Step 3: Drawing footer LAST (on top of everything)
                            printFooter(printCtx, margin, printCanvas.height - margin, printCanvas.width - 2 * margin, footerHeight, context);
                            bar.style.width = "60%";
                            text.textContent = "Drawing footer...";

                            setTimeout(() => {
                                // Step 4: Generating image
                                const imgData = printCanvas.toDataURL("image/png", 1.0);
                                bar.style.width = "80%";
                                text.textContent = "Generating image...";

                                if (!imgData || imgData.length < 100 || imgData === "data:,") {
                                    throw new Error("The browser failed to generate the canvas image. This can happen if the image is too large or memory is low.");
                                }

                                setTimeout(() => {
                                    // Step 5: Saving PDF
                                    const orientation = isLandscape ? "l" : "p";
                                    const pdf = new jsPDF(orientation, "mm", printPaperSize.toLowerCase());
                                    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
                                    pdf.save("kirra-2d-PDF" + new Date().toISOString().split("T")[0] + ".pdf");
                                    bar.style.width = "100%";
                                    text.textContent = "Saving PDF...";

                                    setTimeout(() => {
                                        progressDialog.close();
                                    }, 300);
                                }, 100);
                            }, 100);
                        }, 100);
                    }, 100);
                } catch (error) {
                    progressDialog.close();
                    console.error("PDF Generation Error:", error);
                    showModalMessage("PDF Creation Failed", "Could not generate the PDF. <br><small>Error: " + error.message + "</small>", "error");
                }
            }, 250);
        } catch (error) {
            progressDialog.close();
            console.error("PDF Generation Error:", error);
        }
    }, 250); // 250ms delay
}

// Step 1) Vector PDF generation using jsPDF vector capabilities
export function printCanvasVector(context) {
    const {
        allBlastHoles,
        allKADDrawingsMap,
        allAvailableSurfaces,
        showModalMessage,
        FloatingDialog
    } = context;

    // Step 2) Check if there is data to print
    if ((!allBlastHoles || allBlastHoles.length === 0) && (!allKADDrawingsMap || allKADDrawingsMap.size === 0) && (!allAvailableSurfaces || allAvailableSurfaces.length === 0)) {
        showModalMessage("No Data", "No data available for printing (no blast holes, KAD drawings, surfaces, or images)", "warning");
        return;
    }

    // Step 3) Create progress dialog
    const progressContent = document.createElement("div");
    progressContent.style.textAlign = "center";
    progressContent.innerHTML = '<p>Generating Vector PDF</p>' + '<p>Please wait, this may take a moment...</p>' + '<div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">' + '<div id="pdfProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>' + '</div>' + '<p id="pdfProgressText">Starting...</p>';

    const progressDialog = new FloatingDialog({
        title: "Vector PDF Generation",
        content: progressContent,
        layoutType: "standard",
        width: 350,
        height: 200,
        showConfirm: false,
        showCancel: false,
        allowOutsideClick: false
    });

    progressDialog.show();

    const bar = document.getElementById("pdfProgressBar");
    const text = document.getElementById("pdfProgressText");

    setTimeout(() => {
        try {
            // Step 4) Set up paper dimensions
            const paperSizes = {
                A4: { width: 210, height: 297 },
                A3: { width: 297, height: 420 },
                A2: { width: 420, height: 594 },
                A1: { width: 594, height: 841 },
                A0: { width: 841, height: 1189 }
            };

            const paperSize = paperSizes[printPaperSize] || paperSizes["A4"];
            const isLandscape = printOrientation === "landscape";
            const pageWidth = isLandscape ? paperSize.height : paperSize.width;
            const pageHeight = isLandscape ? paperSize.width : paperSize.height;

            // Step 5) Create jsPDF instance
            const orientation = isLandscape ? "l" : "p";
            const pdf = new jsPDF(orientation, "mm", printPaperSize.toLowerCase());

            const margin = pageWidth * 0.02;
            const headerHeight = 30;
            const footerHeight = 10;

            // Step 6) Calculate print area
            const printArea = {
                x: margin,
                y: margin + headerHeight,
                width: pageWidth - 2 * margin,
                height: pageHeight - 2 * margin - headerHeight - footerHeight
            };

            bar.style.width = "20%";
            text.textContent = "Calculating bounds...";

            setTimeout(() => {
                try {
                    // Step 7) Get data bounds
                    const visibleBlastHoles = allBlastHoles ? allBlastHoles.filter(function (hole) { return hole.visible !== false; }) : [];

                    let minX = Infinity;
                    let maxX = -Infinity;
                    let minY = Infinity;
                    let maxY = -Infinity;

                    // Step 8) Calculate bounds from holes
                    if (visibleBlastHoles.length > 0) {
                        visibleBlastHoles.forEach(function (hole) {
                            if (hole.startXLocation < minX) minX = hole.startXLocation;
                            if (hole.startXLocation > maxX) maxX = hole.startXLocation;
                            if (hole.startYLocation < minY) minY = hole.startYLocation;
                            if (hole.startYLocation > maxY) maxY = hole.startYLocation;
                        });
                    }

                    // Step 9) Calculate bounds from KAD drawings
                    if (allKADDrawingsMap && allKADDrawingsMap.size > 0) {
                        allKADDrawingsMap.forEach(function (entity) {
                            if (entity.visible === false || !entity.data) return;
                            entity.data.forEach(function (point) {
                                if (point.pointXLocation < minX) minX = point.pointXLocation;
                                if (point.pointXLocation > maxX) maxX = point.pointXLocation;
                                if (point.pointYLocation < minY) minY = point.pointYLocation;
                                if (point.pointYLocation > maxY) maxY = point.pointYLocation;
                            });
                        });
                    }

                    // Step 10) Add padding
                    const padding = Math.max(maxX - minX, maxY - minY) * 0.05;
                    minX -= padding;
                    maxX += padding;
                    minY -= padding;
                    maxY += padding;

                    const dataWidth = maxX - minX;
                    const dataHeight = maxY - minY;

                    // Step 11) Calculate scale
                    const scaleX = printArea.width / dataWidth;
                    const scaleY = printArea.height / dataHeight;
                    const scale = Math.min(scaleX, scaleY);

                    const scaledWidth = dataWidth * scale;
                    const scaledHeight = dataHeight * scale;
                    const offsetX = printArea.x + (printArea.width - scaledWidth) / 2;
                    const offsetY = printArea.y + (printArea.height - scaledHeight) / 2;

                    const centroidX = minX + dataWidth / 2;
                    const centroidY = minY + dataHeight / 2;

                    // Step 12) Transform function
                    function worldToPDF(worldX, worldY) {
                        const x = (worldX - centroidX) * scale + offsetX + scaledWidth / 2;
                        const y = -(worldY - centroidY) * scale + offsetY + scaledHeight / 2;
                        return [x, y];
                    }

                    bar.style.width = "40%";
                    text.textContent = "Drawing vector elements...";

                    setTimeout(() => {
                        try {
                            // Step 13) Draw KAD entities
                            if (allKADDrawingsMap && allKADDrawingsMap.size > 0) {
                                allKADDrawingsMap.forEach(function (entity) {
                                    if (entity.visible === false) return;

                                    if (entity.entityType === "point") {
                                        entity.data.forEach(function (point) {
                                            const coords = worldToPDF(point.pointXLocation, point.pointYLocation);
                                            pdf.setDrawColor(point.color || "#000000");
                                            pdf.setFillColor(point.color || "#000000");
                                            pdf.circle(coords[0], coords[1], 0.5, "F");
                                        });
                                    } else if (entity.entityType === "line" || entity.entityType === "poly") {
                                        const points = entity.data;
                                        if (points.length < 2) return;

                                        pdf.setDrawColor(points[0].color || "#000000");
                                        pdf.setLineWidth(points[0].lineWidth || 0.1);

                                        for (let i = 0; i < points.length - 1; i++) {
                                            const start = worldToPDF(points[i].pointXLocation, points[i].pointYLocation);
                                            const end = worldToPDF(points[i + 1].pointXLocation, points[i + 1].pointYLocation);
                                            pdf.line(start[0], start[1], end[0], end[1]);
                                        }

                                        // Step 14) Close polygon if needed
                                        if (entity.entityType === "poly" && points.length > 2) {
                                            const start = worldToPDF(points[points.length - 1].pointXLocation, points[points.length - 1].pointYLocation);
                                            const end = worldToPDF(points[0].pointXLocation, points[0].pointYLocation);
                                            pdf.line(start[0], start[1], end[0], end[1]);
                                        }
                                    } else if (entity.entityType === "text") {
                                        entity.data.forEach(function (textData) {
                                            if (textData && textData.text) {
                                                const coords = worldToPDF(textData.pointXLocation, textData.pointYLocation);
                                                pdf.setTextColor(textData.color || "#000000");
                                                pdf.setFontSize(8);
                                                pdf.text(textData.text, coords[0], coords[1]);
                                            }
                                        });
                                    }
                                });
                            }

                            bar.style.width = "60%";
                            text.textContent = "Drawing blast holes...";

                            setTimeout(() => {
                                // Step 15) Draw blast holes
                                if (visibleBlastHoles.length > 0) {
                                    const displayOptions = context.getDisplayOptions();

                                    visibleBlastHoles.forEach(function (hole) {
                                        const collar = worldToPDF(hole.startXLocation, hole.startYLocation);
                                        const toe = worldToPDF(hole.endXLocation, hole.endYLocation);
                                        const grade = worldToPDF(hole.gradeXLocation, hole.gradeYLocation);

                                        // Step 16) Draw track if angled
                                        if (hole.holeAngle > 0) {
                                            pdf.setDrawColor("#000000");
                                            pdf.setLineWidth(0.1);
                                            pdf.line(collar[0], collar[1], grade[0], grade[1]);

                                            if (hole.subdrillAmount > 0) {
                                                pdf.setDrawColor("#ff0000");
                                                pdf.line(grade[0], grade[1], toe[0], toe[1]);
                                            }
                                        }

                                        // Step 17) Draw toe
                                        if (parseFloat(hole.holeLengthCalculated).toFixed(1) != 0.0) {
                                            pdf.setDrawColor("#000000");
                                            pdf.setFillColor("#ffffff");
                                            pdf.circle(toe[0], toe[1], 1, "FD");
                                        }

                                        // Step 18) Draw collar
                                        const diameterMM = (hole.holeDiameter / 1000) * scale;
                                        const radius = Math.max(0.5, diameterMM / 2);

                                        pdf.setDrawColor("#000000");
                                        pdf.setFillColor("#000000");
                                        pdf.circle(collar[0], collar[1], radius, "F");

                                        // Step 19) Draw labels if enabled
                                        pdf.setFontSize(6);
                                        pdf.setTextColor("#000000");

                                        if (displayOptions.holeID) {
                                            pdf.text(hole.holeID, collar[0] + 2, collar[1] - 1);
                                        }

                                        if (displayOptions.holeDia) {
                                            pdf.text(parseFloat(hole.holeDiameter).toFixed(0), collar[0] + 2, collar[1]);
                                        }

                                        if (displayOptions.holeLen) {
                                            pdf.text(parseFloat(hole.holeLengthCalculated).toFixed(1), collar[0] + 2, collar[1] + 1);
                                        }
                                    });
                                }

                                bar.style.width = "80%";
                                text.textContent = "Adding header and footer...";

                                setTimeout(() => {
                                    // Step 20) Add header
                                    pdf.setFontSize(16);
                                    pdf.setTextColor("#000000");
                                    pdf.text("Kirra 2D - Blast Design", pageWidth / 2, margin + 10, { align: "center" });

                                    // Step 21) Add footer
                                    pdf.setFontSize(8);
                                    const now = new Date();
                                    const dateStr = now.toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" }) + " " + now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
                                    pdf.text("Generated: " + dateStr, margin, pageHeight - margin + 5);
                                    pdf.text("Version: " + context.buildVersion, pageWidth - margin, pageHeight - margin + 5, { align: "right" });

                                    bar.style.width = "100%";
                                    text.textContent = "Saving PDF...";

                                    setTimeout(() => {
                                        // Step 22) Save the PDF
                                        pdf.save("kirra-2d-vector-PDF-" + new Date().toISOString().split("T")[0] + ".pdf");
                                        progressDialog.close();
                                        showModalMessage("Success", "Vector PDF generated successfully!", "success");
                                    }, 300);
                                }, 100);
                            }, 100);
                        } catch (error) {
                            progressDialog.close();
                            console.error("Vector PDF Drawing Error:", error);
                            showModalMessage("PDF Creation Failed", "Could not draw vector PDF. <br><small>Error: " + error.message + "</small>", "error");
                        }
                    }, 100);
                } catch (error) {
                    progressDialog.close();
                    console.error("Vector PDF Calculation Error:", error);
                    showModalMessage("PDF Creation Failed", "Could not calculate PDF layout. <br><small>Error: " + error.message + "</small>", "error");
                }
            }, 100);
        } catch (error) {
            progressDialog.close();
            console.error("Vector PDF Setup Error:", error);
            showModalMessage("PDF Creation Failed", "Could not set up vector PDF. <br><small>Error: " + error.message + "</small>", "error");
        }
    }, 250);
}


export function changePaperSize(drawDataCallback) {
    const paperSizeSelect = document.getElementById("paperSize");
    if (paperSizeSelect) {
        printPaperSize = paperSizeSelect.value;
        if (printMode) {
            drawDataCallback(); // Redraw with new paper size
        }
    }
}

export function changeOrientation(drawDataCallback) {
    const orientationSelect = document.getElementById("orientation");
    if (orientationSelect) {
        printOrientation = orientationSelect.value;
        if (printMode) {
            drawDataCallback(); // Redraw with new orientation
        }
    }
}

export function togglePrintMode(updateStatusMessageCallback, drawDataCallback) {
    printMode = !printMode;

    // Sync the checkbox state
    const toggle = document.getElementById("addPrintPreviewToggle");
    if (toggle) toggle.checked = printMode;

    if (printMode) {
        updateStatusMessageCallback("Print Preview Mode ON - Position elements within the print boundary");
    } else {
        updateStatusMessageCallback("Print Preview Mode OFF");
    }

    drawDataCallback(); // Redraw with/without print boundary
}

// #endregion PRINT

