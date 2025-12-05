///------------------ PRINT TEMPLATE SYSTEM ------------------///
// #region PRINT

import { jsPDF } from "jspdf";
import { drawDataForPrinting } from "./PrintRendering.js";
import { printHeader, printFooter } from "./PrintStats.js";

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
    printCanvasHiRes(context);
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
                    // Step 1: Drawing header
                    printHeader(printCtx, margin, margin, printCanvas.width - 2 * margin, headerHeight, context);
                    bar.style.width = "20%";
                    text.textContent = "Drawing header...";

                    setTimeout(() => {
                        // Step 2: Drawing footer
                        printFooter(printCtx, margin, printCanvas.height - margin, printCanvas.width - 2 * margin, footerHeight, context);
                        bar.style.width = "40%";
                        text.textContent = "Drawing footer...";

                        setTimeout(() => {
                            // Step 3: Drawing data - use the calculated print area that excludes header/footer
                            drawDataForPrinting(printCtx, printArea, context);
                            bar.style.width = "60%";
                            text.textContent = "Drawing data...";

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

