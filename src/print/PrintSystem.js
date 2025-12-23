///------------------ PRINT TEMPLATE SYSTEM ------------------///
// #region PRINT

import { jsPDF } from "jspdf";
import { drawDataForPrinting, printSurfaceSVG, printBoundarySVG, printDataSVG } from "./PrintRendering.js";
import { printHeader, printFooter, printHeaderSVG, printFooterSVG } from "./PrintStats.js";
// GeoPDF removed - too complex
import { generateTrueVectorPDF } from "./PrintVectorPDF.js";
import { getTemplate } from "./PrintTemplates.js";
import { PrintLayoutManager } from "./PrintLayoutManager.js";
import { showPrintDialog } from "./PrintDialog.js";

// Print template configuration
export let printMode = false;
export let printOrientation = "landscape"; // 'landscape' or 'portrait'
export let printPaperSize = "A4"; // 'A4', 'A3', 'A2', 'A1', 'A0'
export let isPrinting = false;

// Paper size ratios (width:height)
export const paperRatios = {
	A4: {
		width: 297,
		height: 210,
	},
	A3: {
		width: 420,
		height: 297,
	},
	A2: {
		width: 594,
		height: 420,
	},
	A1: {
		width: 841,
		height: 594,
	},
	A0: {
		width: 1189,
		height: 841,
	},
};

// These are now declared with 'let' in the global scope to allow resizing.
export let printCanvas = document.createElement("canvas");
export let printCtx = printCanvas.getContext("2d");

// 3D print boundary overlay
let printBoundary3DOverlay = null;

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
		marginPercent: 0.02, // 2% margin inside boundary
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

// ============== 3D PRINT BOUNDARY OVERLAY SYSTEM ==============

// Step 1) Toggle 3D print preview mode
export function toggle3DPrintPreview(enabled, paperSize, orientation, threeRenderer) {
	if (enabled) {
		create3DPrintBoundaryOverlay(paperSize, orientation, threeRenderer);
	} else {
		remove3DPrintBoundaryOverlay();
	}
}

// Step 2) Create overlay canvas showing print boundaries for 3D mode
function create3DPrintBoundaryOverlay(paperSize, orientation, threeRenderer) {
	// Step 2a) Remove existing overlay if any
	remove3DPrintBoundaryOverlay();
	
	// Step 2b) Get Three.js canvas
	const threeCanvas = threeRenderer.getCanvas();
	const rect = threeCanvas.getBoundingClientRect();
	
	// Step 2c) Create overlay canvas
	const overlayCanvas = document.createElement("canvas");
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
	
	// Step 2d) Get template and calculate map zone dimensions
	const template = getTemplate("3D", orientation);
	const paper = paperRatios[paperSize];
	const pageWidth = orientation === "landscape" ? paper.width : paper.height;
	const pageHeight = orientation === "landscape" ? paper.height : paper.width;
	
	const layoutManager = new PrintLayoutManager(template, pageWidth, pageHeight);
	const mapZone = layoutManager.getZoneRect("map");
	
	// Step 2e) Calculate boundary aspect ratio from template
	const templateAspectRatio = mapZone.width / mapZone.height;
	
	// Step 2f) Fit boundary to canvas maintaining template aspect ratio
	const canvasAspect = rect.width / rect.height;
	let boundaryWidth, boundaryHeight, boundaryX, boundaryY;
	
	if (canvasAspect > templateAspectRatio) {
		// Canvas wider than paper - fit to height
		boundaryHeight = rect.height * 0.9;
		boundaryWidth = boundaryHeight * templateAspectRatio;
	} else {
		// Canvas taller than paper - fit to width
		boundaryWidth = rect.width * 0.9;
		boundaryHeight = boundaryWidth / templateAspectRatio;
	}
	
	// Center the boundary
	boundaryX = (rect.width - boundaryWidth) / 2;
	boundaryY = (rect.height - boundaryHeight) / 2;
	
	// Step 2g) Draw boundaries
	const ctx = overlayCanvas.getContext("2d");
	ctx.clearRect(0, 0, rect.width, rect.height);
	
	// Draw outer boundary (red dashed) - page edges
	ctx.strokeStyle = "red";
	ctx.setLineDash([10, 5]);
	ctx.lineWidth = 2;
	ctx.strokeRect(boundaryX, boundaryY, boundaryWidth, boundaryHeight);
	
	// Draw inner boundary (blue dashed) - print-safe area
	const innerMargin = boundaryWidth * (mapZone.printSafeMargin || 0.05);
	ctx.strokeStyle = "rgba(0, 100, 255, 0.8)";
	ctx.setLineDash([5, 3]);
	ctx.lineWidth = 1.5;
	ctx.strokeRect(
		boundaryX + innerMargin,
		boundaryY + innerMargin,
		boundaryWidth - 2 * innerMargin,
		boundaryHeight - 2 * innerMargin
	);
	
	// Step 2h) Add label
	ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
	ctx.fillRect(boundaryX, boundaryY - 25, 180, 25);
	ctx.fillStyle = "white";
	ctx.font = "12px Arial";
	ctx.fillText(
		"Print Preview: " + paperSize + " " + orientation,
		boundaryX + 5,
		boundaryY - 8
	);
	
	// Step 2i) Insert into DOM
	threeCanvas.parentElement.appendChild(overlayCanvas);
	printBoundary3DOverlay = overlayCanvas;
	
	// Step 2j) Store boundary info for capture
	overlayCanvas.boundaryInfo = {
		x: boundaryX,
		y: boundaryY,
		width: boundaryWidth,
		height: boundaryHeight,
		innerMargin: innerMargin,
		paperSize: paperSize,
		orientation: orientation
	};
}

// Step 3) Remove 3D print boundary overlay
function remove3DPrintBoundaryOverlay() {
	if (printBoundary3DOverlay && printBoundary3DOverlay.parentElement) {
		printBoundary3DOverlay.parentElement.removeChild(printBoundary3DOverlay);
		printBoundary3DOverlay = null;
	}
}

// Step 4) Get 3D print boundary info (for capture system)
export function get3DPrintBoundary() {
	if (!printBoundary3DOverlay) return null;
	return printBoundary3DOverlay.boundaryInfo;
}

// Step 5) Set paper size and update 3D boundary if active
export function setPrintPaperSize(size) {
	printPaperSize = size;
	
	// Update 3D boundary if in preview mode
	if (printMode && window.is3DMode && window.threeRenderer) {
		toggle3DPrintPreview(true, printPaperSize, printOrientation, window.threeRenderer);
	}
}

// Step 6) Set orientation and update 3D boundary if active
export function setPrintOrientation(orientation) {
	printOrientation = orientation;
	
	// Update 3D boundary if in preview mode
	if (printMode && window.is3DMode && window.threeRenderer) {
		toggle3DPrintPreview(true, printPaperSize, printOrientation, window.threeRenderer);
	}
}

// ============== END 3D PRINT BOUNDARY OVERLAY SYSTEM ==============

export function printToPDF(context) {
	// Step 1) Detect current mode (2D or 3D)
	const dimension2D3DBtn = document.getElementById("dimension2D-3DBtn");
	const isIn3DMode = dimension2D3DBtn && dimension2D3DBtn.checked === true;
	const mode = isIn3DMode ? "3D" : "2D";
	
	// Step 2) Enhance context with necessary print functions
	const enhancedContext = {
		...context,
		getPrintBoundary: getPrintBoundary,
		get3DPrintBoundary: get3DPrintBoundary,
		mode: mode,
		is3DMode: isIn3DMode
	};
	
    // Step 3) Show new print dialog with user input
    showPrintDialog(mode, enhancedContext, function(userInput) {
        // Step 4) Paper size and orientation already set from UI, add to userInput
        userInput.paperSize = printPaperSize;
        userInput.orientation = printOrientation;
        
        // Step 5) User confirmed - start print generation
		if (userInput.outputType === "vector") {
			// Use TRUE vector PDF generation (jsPDF native drawing API)
			generateTrueVectorPDF({
				...enhancedContext,
				printPaperSize: printPaperSize,
				printOrientation: printOrientation,
				userInput: userInput,
				mode: mode
			});
		} else {
			// Use raster PDF generation (high-res PNG to PDF)
			printCanvasHiRes({
				...enhancedContext,
				printPaperSize: printPaperSize,
				printOrientation: printOrientation,
				userInput: userInput,
				mode: mode
			});
		}
	});
}

/**
 * @deprecated Use printCanvasHiResVector() for vector PDF generation
 * This function is kept for backward compatibility and fallback scenarios
 */
export function printCanvasHiResRaster(context) {
	printCanvasHiRes(context);
}

/**
 * @deprecated Use printCanvasHiResVector() for vector PDF generation
 * This function is kept for backward compatibility and fallback scenarios
 */
export function printCanvasHiRes(context) {
	const { allBlastHoles, allKADDrawingsMap, allAvailableSurfaces, showModalMessage, FloatingDialog } = context;

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
		allowOutsideClick: false,
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
					height: 297,
				},
				A3: {
					width: 297,
					height: 420,
				},
				A2: {
					width: 420,
					height: 594,
				},
				A1: {
					width: 594,
					height: 841,
				},
				A0: {
					width: 841,
					height: 1189,
				},
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
				height: printCanvas.height - 2 * margin - headerHeight - footerHeight,
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

	// Step 1) Detect current mode (2D or 3D)
	const dimension2D3DBtn = document.getElementById("dimension2D-3DBtn");
	const isIn3DMode = dimension2D3DBtn && dimension2D3DBtn.checked === true;
	
	if (printMode) {
		// Entering print preview mode
		if (isIn3DMode) {
			// Step 1a) 3D mode print preview
			if (window.threeRenderer) {
				toggle3DPrintPreview(true, printPaperSize, printOrientation, window.threeRenderer);
				if (updateStatusMessageCallback) {
					updateStatusMessageCallback("3D Print Preview Mode ON - Boundary shows what will be printed");
				}
			}
		} else {
			// Step 1b) 2D mode print preview (existing behavior)
			if (updateStatusMessageCallback) {
				updateStatusMessageCallback("Print Preview Mode ON - Position elements within the print boundary");
			}
			drawDataCallback(); // Redraw with boundary
		}
	} else {
		// Exiting print preview mode
		if (isIn3DMode) {
			// Step 1c) Remove 3D overlay
			remove3DPrintBoundaryOverlay();
			if (updateStatusMessageCallback) {
				updateStatusMessageCallback("3D Print Preview Mode OFF");
			}
		} else {
			// Step 1d) Remove 2D boundary
			if (updateStatusMessageCallback) {
				updateStatusMessageCallback("Print Preview Mode OFF");
			}
			drawDataCallback(); // Redraw without boundary
		}
	}
}

/**
 * Vector PDF generation function using SVG
 * Generates vector-based PDFs with georeferencing support
 */
export function printCanvasHiResVector(context) {
	const { allBlastHoles, allKADDrawingsMap, allAvailableSurfaces, loadedSurfaces, loadedImages, showModalMessage, FloatingDialog } = context;

	// Step 1) Check for data - check all possible data sources
	const hasBlastHoles = allBlastHoles && allBlastHoles.length > 0;
	const hasKAD = allKADDrawingsMap && allKADDrawingsMap.size > 0;
	const hasSurfaces = (loadedSurfaces && loadedSurfaces.size > 0) || (allAvailableSurfaces && allAvailableSurfaces.length > 0);
	const hasImages = loadedImages && loadedImages.size > 0;

	if (!hasBlastHoles && !hasKAD && !hasSurfaces && !hasImages) {
		showModalMessage("No Data", "No data available for printing (no blast holes, KAD drawings, surfaces, or images)", "warning");
		return;
	}

	// Step 2) Create progress dialog
	const progressContent = document.createElement("div");
	progressContent.style.textAlign = "center";
	progressContent.innerHTML = `
		<p>Generating Vector PDF</p>
		<p>Please wait, this may take a moment...</p>
		<div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">
			<div id="pdfProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>
		</div>
		<p id="pdfProgressText">Starting...</p>
	`;

	const progressDialog = new FloatingDialog({
		title: "PDF Generation",
		content: progressContent,
		layoutType: "standard",
		width: 350,
		height: 200,
		showConfirm: false,
		showCancel: false,
		allowOutsideClick: false,
	});

	progressDialog.show();

	const bar = document.getElementById("pdfProgressBar");
	const text = document.getElementById("pdfProgressText");

	setTimeout(() => {
		let originalWorldToCanvas = undefined; // Declare and initialize outside try block for error handling
		try {
			const dpi = 300;
			const mmToPx = dpi / 25.4;

			const paperSizes = {
				A4: { width: 210, height: 297 },
				A3: { width: 297, height: 420 },
				A2: { width: 420, height: 594 },
				A1: { width: 594, height: 841 },
				A0: { width: 841, height: 1189 },
			};

			const paperSize = paperSizes[printPaperSize] || paperSizes["A4"];
			const isLandscape = printOrientation === "landscape";
			const pageWidth = isLandscape ? paperSize.height : paperSize.width;
			const pageHeight = isLandscape ? paperSize.width : paperSize.height;

			// Create PDF
			const orientation = isLandscape ? "l" : "p";
			const pdf = new jsPDF(orientation, "mm", printPaperSize.toLowerCase());

			bar.style.width = "20%";
			text.textContent = "Calculating coordinates...";

			// Step 3) Calculate coordinate bounds for georeferencing
			let utmMinX = Infinity,
				utmMaxX = -Infinity;
			let utmMinY = Infinity,
				utmMaxY = -Infinity;

			const visibleBlastHoles = allBlastHoles ? allBlastHoles.filter((hole) => hole.visible !== false) : [];
			if (visibleBlastHoles.length > 0) {
				visibleBlastHoles.forEach((hole) => {
					if (hole.startXLocation < utmMinX) utmMinX = hole.startXLocation;
					if (hole.startXLocation > utmMaxX) utmMaxX = hole.startXLocation;
					if (hole.startYLocation < utmMinY) utmMinY = hole.startYLocation;
					if (hole.startYLocation > utmMaxY) utmMaxY = hole.startYLocation;
				});
			}

			// Also check KAD drawings and surfaces for bounds if no holes
			if (visibleBlastHoles.length === 0) {
				if (allKADDrawingsMap && allKADDrawingsMap.size > 0) {
					for (const [name, entity] of allKADDrawingsMap.entries()) {
						if (entity.visible === false) continue;
						if (entity.data && entity.data.length > 0) {
							entity.data.forEach((point) => {
								const x = point.pointXLocation || point.x;
								const y = point.pointYLocation || point.y;
								if (x !== undefined && x < utmMinX) utmMinX = x;
								if (x !== undefined && x > utmMaxX) utmMaxX = x;
								if (y !== undefined && y < utmMinY) utmMinY = y;
								if (y !== undefined && y > utmMaxY) utmMaxY = y;
							});
						}
					}
				}
			}

			// Detect UTM zone
			const utmInfo = GeoPDF.detectUTMZone(utmMinX, utmMaxX, utmMinY, utmMaxY);

			bar.style.width = "40%";
			text.textContent = "Generating SVG layers...";

			// Step 4) Calculate print area and coordinate transformation (same as raster version)
			const margin = pageWidth * mmToPx * 0.02;
			const headerHeight = 200;
			const footerHeight = 20;
			const printArea = {
				x: margin,
				y: margin + headerHeight,
				width: pageWidth * mmToPx - 2 * margin,
				height: pageHeight * mmToPx - 2 * margin - headerHeight - footerHeight,
			};

			// Use the same coordinate transformation logic as drawDataForPrinting
			const canvas = context.canvas;
			const screenBoundary = getPrintBoundary(canvas);
			if (!screenBoundary) {
				throw new Error("Print Preview Mode must be active to generate a WYSIWYG print.");
			}

			const innerMargin = screenBoundary.width * screenBoundary.marginPercent;
			const innerBoundary = {
				x: screenBoundary.x + innerMargin,
				y: screenBoundary.y + innerMargin,
				width: screenBoundary.width - innerMargin * 2,
				height: screenBoundary.height - innerMargin * 2,
			};

			// Convert boundary to world coordinates
			const world_x1 = (innerBoundary.x - canvas.width / 2) / context.currentScale + context.centroidX;
			const world_y1 = -(innerBoundary.y + innerBoundary.height - canvas.height / 2) / context.currentScale + context.centroidY;
			const world_x2 = (innerBoundary.x + innerBoundary.width - canvas.width / 2) / context.currentScale + context.centroidX;
			const world_y2 = -(innerBoundary.y - canvas.height / 2) / context.currentScale + context.centroidY;

			const minX = Math.min(world_x1, world_x2);
			const maxX = Math.max(world_x1, world_x2);
			const minY = Math.min(world_y1, world_y2);
			const maxY = Math.max(world_y1, world_y2);

			// Calculate scale to fit world view into print area
			const dataWidth = maxX - minX;
			const dataHeight = maxY - minY;
			if (dataWidth <= 0 || dataHeight <= 0) {
				throw new Error("Invalid data bounds for printing");
			}

			const scaleX = printArea.width / dataWidth;
			const scaleY = printArea.height / dataHeight;
			const printScale = Math.min(scaleX, scaleY);

			const scaledWidth = dataWidth * printScale;
			const scaledHeight = dataHeight * printScale;
			const offsetX = printArea.x + (printArea.width - scaledWidth) / 2;
			const offsetY = printArea.y + (printArea.height - scaledHeight) / 2;

			const printCentroidX = minX + dataWidth / 2;
			const printCentroidY = minY + dataHeight / 2;

			// Create world-to-print coordinate transformation function
			function worldToPrint(worldX, worldY) {
				const centerX = offsetX + scaledWidth / 2;
				const centerY = offsetY + scaledHeight / 2;
				const x = (worldX - printCentroidX) * printScale + centerX;
				const y = -(worldY - printCentroidY) * printScale + centerY;
				return [x, y];
			}

			// Create SVG context with coordinate transformation
			// IMPORTANT: Set window.worldToCanvas so printDataSVG functions can use it
			if (typeof window !== "undefined") {
				originalWorldToCanvas = window.worldToCanvas;
				window.worldToCanvas = worldToPrint;
			}

			const svgCanvasWidth = pageWidth * mmToPx;
			const svgCanvasHeight = pageHeight * mmToPx;
			const svgContext = {
				...context,
				worldToCanvas: worldToPrint,
				currentScale: printScale,
				centroidX: printCentroidX,
				centroidY: printCentroidY,
				canvasWidth: svgCanvasWidth,
				canvasHeight: svgCanvasHeight,
				canvas: { width: svgCanvasWidth, height: svgCanvasHeight },
				// Ensure data is explicitly passed
				allBlastHoles: context.allBlastHoles,
				allKADDrawingsMap: context.allKADDrawingsMap,
				loadedSurfaces: context.loadedSurfaces,
				loadedImages: context.loadedImages,
				// Set imageVisible and surfaceVisible to false so printDataSVG doesn't try to render them
				// (we'll add images as a separate raster layer)
				imageVisible: false,
				surfaceVisible: false,
			};

			// Debug: Log context data before rendering
			console.log("SVG Context Check:");
			console.log("  allBlastHoles:", svgContext.allBlastHoles ? svgContext.allBlastHoles.length : 0);
			console.log("  allKADDrawingsMap:", svgContext.allKADDrawingsMap ? svgContext.allKADDrawingsMap.size : 0);
			console.log("  loadedSurfaces:", svgContext.loadedSurfaces ? svgContext.loadedSurfaces.size : 0);
			console.log("  loadedImages:", svgContext.loadedImages ? svgContext.loadedImages.size : 0);

			bar.style.width = "50%";
			text.textContent = "Rendering background images...";

			// Step 5a) Create a canvas for rendering images and SVG
			const renderCanvas = document.createElement("canvas");
			renderCanvas.width = pageWidth * mmToPx;
			renderCanvas.height = pageHeight * mmToPx;
			const renderCtx = renderCanvas.getContext("2d");

			// Fill white background
			renderCtx.fillStyle = "white";
			renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

			// Render background images (as raster layer)
			if (context.loadedImages && context.loadedImages.size > 0) {
				context.loadedImages.forEach((image) => {
					if (image.visible === false || !image.canvas) return;
					const bbox = image.bbox;
					if (bbox && bbox.length >= 4) {
						const [x1, y1] = worldToPrint(bbox[0], bbox[3]);
						const [x2, y2] = worldToPrint(bbox[2], bbox[1]);
						renderCtx.save();
						renderCtx.globalAlpha = image.transparency !== undefined && image.transparency !== null ? image.transparency : 1.0;
						const width = Math.abs(x2 - x1);
						const height = Math.abs(y2 - y1);
						renderCtx.drawImage(image.canvas, Math.min(x1, x2), Math.min(y1, y2), width, height);
						renderCtx.restore();
					}
				});
			}

			// Render QR code (as raster image) - load and draw it, then generate SVG
			const qrCodeImg = new Image();
			qrCodeImg.onload = function () {
				const qrX = margin;
				const qrY = margin + 35;
				const qrSize = 110;
				renderCtx.drawImage(qrCodeImg, qrX, qrY, qrSize, qrSize);

				bar.style.width = "55%";
				text.textContent = "Generating SVG layers...";

				// Step 5b) Generate SVG content using printDataSVG function
				let svgContent = "";

				// Header SVG
				const headerSvg = printHeaderSVG(margin, margin, pageWidth * mmToPx - 2 * margin, headerHeight, svgContext);
				svgContent += headerSvg;

				// Generate SVG for all data layers (surfaces, KAD, holes)
				const dataSvg = printDataSVG(context.allBlastHoles, context.selectedHole, svgContext);
				svgContent += dataSvg;

				// Footer SVG
				const footerSvg = printFooterSVG(margin, pageHeight * mmToPx - margin, pageWidth * mmToPx - 2 * margin, footerHeight, svgContext);
				svgContent += footerSvg;

				// Debug: Log SVG content length and actual content
				console.log("SVG Content Length:", svgContent.length);
				console.log("Header SVG Length:", headerSvg.length);
				console.log("Data SVG Length:", dataSvg.length);
				console.log("Footer SVG Length:", footerSvg.length);
				console.log("Header SVG Preview:", headerSvg.substring(0, 500));
				console.log("Data SVG Preview:", dataSvg.substring(0, 500));
				console.log("Footer SVG:", footerSvg);
				console.log("Visible Holes Count:", context.allBlastHoles ? context.allBlastHoles.filter((h) => h.visible !== false).length : 0);
				console.log("KAD Map Size:", context.allKADDrawingsMap ? context.allKADDrawingsMap.size : 0);
				console.log("Loaded Surfaces Size:", context.loadedSurfaces ? context.loadedSurfaces.size : 0);

				bar.style.width = "60%";
				text.textContent = "Converting SVG to image...";

				// Step 5c) Convert SVG to image and composite onto render canvas
				const svgWidth = pageWidth * mmToPx;
				const svgHeight = pageHeight * mmToPx;
				const svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="' + svgWidth + '" height="' + svgHeight + '">' + svgContent + "</svg>";

				// Debug: Log the full SVG string to console for inspection
				console.log("Full SVG String (first 2000 chars):", svgString.substring(0, 2000));
				console.log("SVG String Length:", svgString.length);

				// Also save SVG to a downloadable file for debugging
				const svgBlobForDownload = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
				const svgDownloadUrl = URL.createObjectURL(svgBlobForDownload);
				const downloadLink = document.createElement("a");
				downloadLink.href = svgDownloadUrl;
				downloadLink.download = "debug-svg-output.svg";
				downloadLink.textContent = "Download SVG";
				downloadLink.style.display = "none";
				document.body.appendChild(downloadLink);
				downloadLink.click();
				setTimeout(() => {
					document.body.removeChild(downloadLink);
					URL.revokeObjectURL(svgDownloadUrl);
				}, 1000);

				const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
				const svgUrl = URL.createObjectURL(svgBlob);

				// Create a temporary image to load the SVG
				const svgImage = new Image();
				svgImage.onload = function () {
					try {
						// Draw the SVG image onto the render canvas (on top of background images)
						renderCtx.drawImage(svgImage, 0, 0, renderCanvas.width, renderCanvas.height);

						// Clean up
						URL.revokeObjectURL(svgUrl);
						if (typeof window !== "undefined" && typeof originalWorldToCanvas !== "undefined") {
							window.worldToCanvas = originalWorldToCanvas; // Restore original
						}

						bar.style.width = "70%";
						text.textContent = "Adding image to PDF...";

						// Convert the composite canvas to image data URL
						const canvasDataUrl = renderCanvas.toDataURL("image/png", 1.0);

						// Add the composite image to PDF
						pdf.addImage(canvasDataUrl, "PNG", 0, 0, pageWidth, pageHeight);

						bar.style.width = "80%";
						text.textContent = "Adding georeferencing...";

						// Step 6) Add georeferencing metadata
						if (utmMinX !== Infinity && utmMaxX !== -Infinity) {
							const pdfBounds = {
								minX: 0,
								minY: 0,
								maxX: pageWidth,
								maxY: pageHeight,
							};
							const utmBounds = {
								minX: utmMinX,
								minY: utmMinY,
								maxX: utmMaxX,
								maxY: utmMaxY,
							};
							const transform = GeoPDF.calculateGeoreferencingTransform(pdfBounds.minX, pdfBounds.minY, pdfBounds.maxX, pdfBounds.maxY, utmBounds.minX, utmBounds.minY, utmBounds.maxX, utmBounds.maxY);

							const geoMetadata = GeoPDF.generateGeoPDFMetadata({
								zone: utmInfo.zone,
								hemisphere: utmInfo.hemisphere,
								bounds: utmBounds,
								transform: transform,
							});

							// Attempt to inject GeoPDF metadata
							// Note: jsPDF may not expose internal PDF object structure
							// This may require custom PDF object manipulation
							try {
								// Set basic metadata
								pdf.setProperties({
									title: "Kirra Blast Design",
									subject: "Georeferenced Blast Design PDF",
									author: "Kirra Blast Design Software",
									keywords: "blast design, georeferenced, UTM " + utmInfo.zone + utmInfo.hemisphere,
									creator: "Kirra",
								});

								// TODO: Inject GeoPDF metadata objects into PDF structure
								// This may require accessing pdf.internal.pdfObject or similar
								console.log("GeoPDF metadata generated:", geoMetadata);
							} catch (error) {
								console.warn("Could not inject GeoPDF metadata:", error);
							}
						}

						bar.style.width = "100%";
						text.textContent = "Saving PDF...";

						// Step 7) Save PDF
						pdf.save("kirra-2d-vector-PDF" + new Date().toISOString().split("T")[0] + ".pdf");

						setTimeout(() => {
							progressDialog.close();
						}, 300);
					} catch (error) {
						URL.revokeObjectURL(svgUrl);
						if (typeof window !== "undefined" && typeof originalWorldToCanvas !== "undefined") {
							window.worldToCanvas = originalWorldToCanvas; // Restore original
						}
						progressDialog.close();
						console.error("Vector PDF Generation Error:", error);
						showModalMessage("PDF Creation Failed", "Could not generate the vector PDF. <br><small>Error: " + error.message + "</small>", "error");
					}
				};

				svgImage.onerror = function () {
					URL.revokeObjectURL(svgUrl);
					if (typeof window !== "undefined" && typeof originalWorldToCanvas !== "undefined") {
						window.worldToCanvas = originalWorldToCanvas; // Restore original
					}
					progressDialog.close();
					showModalMessage("PDF Creation Failed", "Could not load SVG image for PDF generation.", "error");
				};

				svgImage.src = svgUrl;
			};

			qrCodeImg.onerror = function () {
				console.warn("QR code image failed to load, continuing without it");
				// Continue with SVG generation even if QR code fails
				bar.style.width = "55%";
				text.textContent = "Generating SVG layers...";

				let svgContent = "";
				const headerSvg = printHeaderSVG(margin, margin, pageWidth * mmToPx - 2 * margin, headerHeight, svgContext);
				svgContent += headerSvg;
				const dataSvg = printDataSVG(context.allBlastHoles, context.selectedHole, svgContext);
				svgContent += dataSvg;
				const footerSvg = printFooterSVG(margin, pageHeight * mmToPx - margin, pageWidth * mmToPx - 2 * margin, footerHeight, svgContext);
				svgContent += footerSvg;

				bar.style.width = "60%";
				text.textContent = "Converting SVG to image...";

				const svgWidth = pageWidth * mmToPx;
				const svgHeight = pageHeight * mmToPx;
				const svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="' + svgWidth + '" height="' + svgHeight + '">' + svgContent + "</svg>";
				const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
				const svgUrl = URL.createObjectURL(svgBlob);

				const svgImage = new Image();
				svgImage.onload = function () {
					try {
						renderCtx.drawImage(svgImage, 0, 0, renderCanvas.width, renderCanvas.height);
						URL.revokeObjectURL(svgUrl);
						if (typeof window !== "undefined" && typeof originalWorldToCanvas !== "undefined") {
							window.worldToCanvas = originalWorldToCanvas;
						}

						bar.style.width = "70%";
						text.textContent = "Adding image to PDF...";

						const canvasDataUrl = renderCanvas.toDataURL("image/png", 1.0);
						pdf.addImage(canvasDataUrl, "PNG", 0, 0, pageWidth, pageHeight);

						bar.style.width = "80%";
						text.textContent = "Adding georeferencing...";

						// Step 6) Add georeferencing metadata
						if (utmMinX !== Infinity && utmMaxX !== -Infinity) {
							const pdfBounds = {
								minX: 0,
								minY: 0,
								maxX: pageWidth,
								maxY: pageHeight,
							};
							const utmBounds = {
								minX: utmMinX,
								minY: utmMinY,
								maxX: utmMaxX,
								maxY: utmMaxY,
							};
							const transform = GeoPDF.calculateGeoreferencingTransform(pdfBounds.minX, pdfBounds.minY, pdfBounds.maxX, pdfBounds.maxY, utmBounds.minX, utmBounds.minY, utmBounds.maxX, utmBounds.maxY);

							const geoMetadata = GeoPDF.generateGeoPDFMetadata({
								zone: utmInfo.zone,
								hemisphere: utmInfo.hemisphere,
								bounds: utmBounds,
								transform: transform,
							});

							try {
								pdf.setProperties({
									title: "Kirra Blast Design",
									subject: "Georeferenced Blast Design PDF",
									author: "Kirra Blast Design Software",
									keywords: "blast design, georeferenced, UTM " + utmInfo.zone + utmInfo.hemisphere,
									creator: "Kirra",
								});
								console.log("GeoPDF metadata generated:", geoMetadata);
							} catch (error) {
								console.warn("Could not inject GeoPDF metadata:", error);
							}
						}

						bar.style.width = "100%";
						text.textContent = "Saving PDF...";
						pdf.save("kirra-2d-vector-PDF" + new Date().toISOString().split("T")[0] + ".pdf");

						setTimeout(() => {
							progressDialog.close();
						}, 300);
					} catch (error) {
						URL.revokeObjectURL(svgUrl);
						if (typeof window !== "undefined" && typeof originalWorldToCanvas !== "undefined") {
							window.worldToCanvas = originalWorldToCanvas;
						}
						progressDialog.close();
						console.error("Vector PDF Generation Error:", error);
						showModalMessage("PDF Creation Failed", "Could not generate the vector PDF. <br><small>Error: " + error.message + "</small>", "error");
					}
				};
				svgImage.onerror = function () {
					URL.revokeObjectURL(svgUrl);
					if (typeof window !== "undefined" && typeof originalWorldToCanvas !== "undefined") {
						window.worldToCanvas = originalWorldToCanvas;
					}
					progressDialog.close();
					showModalMessage("PDF Creation Failed", "Could not load SVG image for PDF generation.", "error");
				};
				svgImage.src = svgUrl;
			};

			qrCodeImg.src = "icons/kirra2d-qr-code.png";
		} catch (error) {
			// Restore window.worldToCanvas if it was set
			if (typeof originalWorldToCanvas !== "undefined" && typeof window !== "undefined") {
				window.worldToCanvas = originalWorldToCanvas;
			}
			progressDialog.close();
			console.error("Vector PDF Generation Error:", error);
			showModalMessage("PDF Creation Failed", "Could not generate the vector PDF. <br><small>Error: " + error.message + "</small>", "error");
		}
	}, 250);
}

/**
 * Sets up print event handlers
 * Moves event handler setup from kirra.js to this module
 */
export function setupPrintEventHandlers(contextOrGetter) {
	// If it's a function, call it to get context; otherwise use it directly
	const getContext = typeof contextOrGetter === "function" ? contextOrGetter : () => contextOrGetter;
	const context = getContext();
	const { updateStatusMessage, drawData } = context;

	const printPreviewToggle = document.getElementById("addPrintPreviewToggle");
	if (printPreviewToggle) {
		printPreviewToggle.addEventListener("change", function () {
			const ctx = getContext();
			togglePrintMode(ctx.updateStatusMessage, ctx.drawData);
		});
	}

	const paperSizeSelect = document.getElementById("paperSize");
	if (paperSizeSelect) {
		paperSizeSelect.addEventListener("change", function () {
			const ctx = getContext();
			changePaperSize(ctx.drawData);
		});
	}

	const orientationSelect = document.getElementById("orientation");
	if (orientationSelect) {
		orientationSelect.addEventListener("change", function () {
			const ctx = getContext();
			changeOrientation(ctx.drawData);
		});
	}

	const printToPDFBtn = document.getElementById("printToPDFBtn");
	if (printToPDFBtn) {
		printToPDFBtn.addEventListener("click", function () {
			// Get fresh context when button is clicked
			const context = getContext();
			// Create comprehensive context object
			const printContext = {
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
				isAddingConnector: context.isAddingConnector,
				isAddingMultiConnector: context.isAddingMultiConnector,
				fromHoleStore: context.fromHoleStore,
				firstSelectedHole: context.firstSelectedHole,
				secondSelectedHole: context.secondSelectedHole,
				selectedMultipleHoles: context.selectedMultipleHoles,
				loadedSurfaces: context.loadedSurfaces,
				showSurfaceLegend: context.showSurfaceLegend,
				elevationToColor: context.elevationToColor,
				currentGradient: context.currentGradient,
				surfaceTextureData: context.surfaceTextureData,
				loadedImages: context.loadedImages,
				buildVersion: context.buildVersion,
				showModalMessage: context.showModalMessage,
				FloatingDialog: context.FloatingDialog,
			};
			printToPDF(printContext);
		});
	}
}

// #endregion PRINT
