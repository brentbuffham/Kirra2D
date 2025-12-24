// Step 1) Print Vector PDF using jsPDF native drawing API (true vectors, not raster)
// This follows the EXACT same structure as the working printCanvasHiRes but uses jsPDF drawing
import { jsPDF } from "jspdf";
import { getPrintBoundary, printCanvas } from "./PrintSystem.js";
import { getBlastStatisticsPerEntity } from "../helpers/BlastStatistics.js";
import * as GeoPDF from "./GeoPDFMetadata.js";
import { PRINT_TEMPLATES, getTemplate } from "./PrintTemplates.js";
import { PrintLayoutManager } from "./PrintLayoutManager.js";
import { PrintCaptureManager } from "./PrintCaptureManager.js";

// Helper: Convert hex color to RGB for jsPDF
function hexToRgb(hex) {
	if (!hex) return { r: 0, g: 0, b: 0 };

	// Handle non-hex colors (like named colors or rgb strings)
	if (typeof hex !== "string") {
		return { r: 0, g: 0, b: 0 };
	}

	// Remove # if present
	hex = hex.replace("#", "");

	// Expand shorthand hex (e.g., "03F" -> "0033FF")
	if (hex.length === 3) {
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	}

	// Parse RGB values
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);

	// Check for NaN and return defaults
	if (isNaN(r) || isNaN(g) || isNaN(b)) {
		console.warn("Invalid hex color:", hex, "- using black");
		return { r: 0, g: 0, b: 0 };
	}

	return { r, g, b };
}

// Helper: Convert rgba string to RGB
function rgbaToRgb(rgba) {
	if (!rgba) return { r: 0, g: 0, b: 0, a: 1 };
	if (rgba.startsWith("#")) return hexToRgb(rgba);

	const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
	if (!match) return { r: 0, g: 0, b: 0, a: 1 };

	return {
		r: parseInt(match[1]),
		g: parseInt(match[2]),
		b: parseInt(match[3]),
		a: match[4] ? parseFloat(match[4]) : 1,
	};
}

// Helper functions that mirror canvas drawing with jsPDF
function drawHoleVector(pdf, x, y, radius, strokeColor) {
	const minRadius = 1.5;
	const drawRadius = radius > minRadius ? radius : minRadius;

	pdf.setDrawColor(0, 0, 0);
	pdf.setFillColor(0, 0, 0);
	pdf.setLineWidth(0.1);
	pdf.circle(x, y, drawRadius, "FD");
}

function drawHoleToeVector(pdf, x, y, fillColor, strokeColor, radius) {
	const fill = rgbaToRgb(fillColor);
	pdf.setFillColor(fill.r, fill.g, fill.b);
	pdf.setDrawColor(0, 0, 0);
	pdf.setLineWidth(0.1);
	pdf.circle(x, y, radius, "FD");
}

function drawTrackVector(pdf, lineStartX, lineStartY, lineEndX, lineEndY, gradeX, gradeY, color, subdrillAmount) {
	pdf.setLineWidth(0.1);

	if (subdrillAmount < 0) {
		// Negative subdrill: Draw collar to toe (black), then grade marker
		pdf.setDrawColor(0, 0, 0);
		pdf.line(lineStartX, lineStartY, lineEndX, lineEndY);

		// Red line from toe to grade (with transparency - we'll use lighter red)
		pdf.setDrawColor(255, 200, 200); // Light red for 20% opacity effect
		pdf.line(lineEndX, lineEndY, gradeX, gradeY);

		// Grade marker (light red)
		pdf.setFillColor(255, 200, 200);
		pdf.circle(gradeX, gradeY, 0.3, "F");
	} else {
		// Positive subdrill: collar to grade (black), grade to toe (red)
		pdf.setDrawColor(0, 0, 0);
		pdf.line(lineStartX, lineStartY, gradeX, gradeY);

		// Red subdrill portion
		pdf.setDrawColor(255, 0, 0);
		pdf.line(gradeX, gradeY, lineEndX, lineEndY);

		// Grade marker (full red)
		pdf.setFillColor(255, 0, 0);
		pdf.circle(gradeX, gradeY, 0.3, "F");
	}
}

function drawTextVector(pdf, x, y, text, color, fontSize) {
	const rgb = rgbaToRgb(color);
	pdf.setTextColor(rgb.r, rgb.g, rgb.b);
	// fontSize passed is in points, use as-is (already converted from pixels)
	pdf.setFontSize(fontSize || 4);
	pdf.text(String(text), x, y);
}

function drawRightAlignedTextVector(pdf, x, y, text, color, fontSize) {
	const rgb = rgbaToRgb(color);
	pdf.setTextColor(rgb.r, rgb.g, rgb.b);
	pdf.setFontSize(fontSize || 4);
	pdf.text(String(text), x, y, { align: "right" });
}

// Helper: Draw border around a cell/rectangle
function drawCellBorder(pdf, x, y, width, height, lineWidth) {
	pdf.setDrawColor(0, 0, 0); // Black border
	pdf.setLineWidth(lineWidth || 0.1);
	pdf.rect(x, y, width, height, "S"); // "S" = stroke only
}

// Draw surface legend as vectors
function drawSurfaceLegendVector(pdf, pageWidth, pageHeight, margin, context) {
	if (!context.showSurfaceLegend || !context.loadedSurfaces || context.loadedSurfaces.size === 0) return;

	// Get first visible surface for legend
	const visibleSurface = Array.from(context.loadedSurfaces.values()).find((s) => s.visible);
	if (!visibleSurface || !visibleSurface.points || visibleSurface.points.length === 0) return;

	// Calculate elevation range
	let minZ = Infinity;
	let maxZ = -Infinity;
	visibleSurface.points.forEach((point) => {
		if (point.z < minZ) minZ = point.z;
		if (point.z > maxZ) maxZ = point.z;
	});

	if (minZ === Infinity || maxZ === -Infinity || maxZ <= minZ) return;

	// Legend dimensions and position (right side of page)
	const legendWidth = 5; // 20px → ~5mm
	const legendHeight = 50; // 200px → ~50mm
	const legendX = pageWidth - margin - legendWidth - 15; // Right side with margin
	const legendY = margin + 20; // Below header
	const steps = 50;

	// Draw color gradient rectangles
	for (let i = 0; i < steps; i++) {
		const ratio = i / (steps - 1);
		const y = legendY + legendHeight - (i * legendHeight) / steps;
		const height = legendHeight / steps + 0.5;

		const elevation = minZ + ratio * (maxZ - minZ);
		let color = "#888888"; // Default gray
		if (context.elevationToColor) {
			color = context.elevationToColor(elevation, minZ, maxZ);
		}

		const rgb = rgbaToRgb(color);
		if (!isNaN(rgb.r) && !isNaN(rgb.g) && !isNaN(rgb.b)) {
			pdf.setFillColor(rgb.r, rgb.g, rgb.b);
			pdf.rect(legendX, y, legendWidth, height, "F");
		}
	}

	// Draw elevation labels
	pdf.setFontSize(5); // 12px → ~5pt
	pdf.setFont("helvetica", "bold");
	pdf.setTextColor(0, 0, 0);

	const labelCount = 5;
	for (let i = 0; i < labelCount; i++) {
		const ratio = i / (labelCount - 1);
		const elevation = minZ + ratio * (maxZ - minZ);
		const y = legendY + legendHeight - ratio * legendHeight;

		// Draw tick mark
		pdf.setDrawColor(0, 0, 0);
		pdf.setLineWidth(0.1);
		pdf.line(legendX + legendWidth, y, legendX + legendWidth + 2, y);

		// Draw elevation text
		pdf.text(elevation.toFixed(1) + "m", legendX + legendWidth + 3, y);
	}

	// Draw title
	pdf.setFontSize(6); // 14px → ~6pt
	pdf.text("Elevation", legendX + legendWidth / 2, legendY - 3, { align: "center" });

	// Draw gradient name
	pdf.setFontSize(4); // 10px → ~4pt
	const gradientNames = {
		default: "Default",
		viridis: "Viridis",
		turbo: "Turbo",
		parula: "Parula",
		cividis: "Cividis",
		terrain: "Terrain",
	};
	const gradientName = gradientNames[context.currentGradient] || "Default";
	pdf.text(gradientName, legendX + legendWidth / 2, legendY + legendHeight + 5, { align: "center" });
}

// Draw statistics table as vectors
function drawStatsTableVector(pdf, x, y, stats, context) {
	// Increased font sizes for better readability
	const lineHeight = 2.5; // Increased from 1.7mm
	let currentY = y;

	Object.keys(stats).forEach((entityName) => {
		const s = stats[entityName];

		// Entity name (bold) - Increased from 6pt to 8pt
		pdf.setFontSize(8);
		pdf.setFont("helvetica", "bold");
		pdf.setTextColor(0, 0, 0);
		pdf.text("Blast Entity: " + entityName, x, currentY);
		currentY += lineHeight;

		// Statistics - Increased from 6pt to 7pt
		pdf.setFontSize(7);
		pdf.setFont("helvetica", "normal");
		pdf.text("Holes: " + s.holeCount, x, currentY);
		currentY += lineHeight;
		pdf.text("Common Burden: " + s.burden.toFixed(2) + "m", x, currentY);
		currentY += lineHeight;
		pdf.text("Common Spacing: " + s.spacing.toFixed(2) + "m", x, currentY);
		currentY += lineHeight;
		pdf.text("Drill Metres: " + s.drillMetres.toFixed(1) + "m", x, currentY);
		currentY += lineHeight;
		pdf.text("Exp. Mass: " + s.expMass.toFixed(1) + "kg", x, currentY);
		currentY += lineHeight;
		pdf.text("Volume: " + s.volume.toFixed(1) + "m³", x, currentY);
		currentY += lineHeight;
		pdf.text("Surface Area: " + s.surfaceArea.toFixed(1) + "m²", x, currentY);
		currentY += lineHeight;

		if (s.minFiringTime !== null) {
			pdf.text("Min Firing: " + s.minFiringTime + "ms", x, currentY);
			currentY += lineHeight;
		}
		if (s.maxFiringTime !== null) {
			pdf.text("Max Firing: " + s.maxFiringTime + "ms", x, currentY);
			currentY += lineHeight;
		}

		// Delays table - Increased sizes
		currentY += 2;
		const tableX = x;
		const tableY = currentY;
		const col1Width = 10; // Increased from 6.8mm
		const col2Width = 6; // Increased from 4.2mm
		const rowHeight = 3; // Increased from 2mm

		// Table header
		pdf.setDrawColor(0);
		pdf.setFillColor(255, 255, 255);
		pdf.rect(tableX, tableY, col1Width + col2Width, rowHeight, "FD");
		pdf.setFontSize(7); // Increased from 5.3pt
		pdf.setFont("helvetica", "bold");
		pdf.setTextColor(0, 0, 0);
		pdf.text("Delays:", tableX + 0.5, tableY + 2);

		let row = 1;
		Object.keys(s.delayGroups)
			.sort((a, b) => {
				if (a === "Unknown") return 1;
				if (b === "Unknown") return -1;
				return parseFloat(a) - parseFloat(b);
			})
			.forEach((delay) => {
				const group = s.delayGroups[delay];

				// Get RGB color with fallback to white
				let rgb = { r: 255, g: 255, b: 255 };
				if (group.color) {
					try {
						rgb = hexToRgb(group.color);
					} catch (e) {
						console.warn("Failed to parse delay color:", group.color, e);
					}
				}

				// Delay cell with color background
				pdf.setFillColor(rgb.r, rgb.g, rgb.b);
				pdf.setDrawColor(0, 0, 0);
				pdf.rect(tableX, tableY + row * rowHeight, col1Width, rowHeight, "FD");

				// Determine text color (white on dark, black on light)
				const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
				if (luminance < 0.5) {
					pdf.setTextColor(255, 255, 255);
				} else {
					pdf.setTextColor(0, 0, 0);
				}
				pdf.setFontSize(7); // Increased from 5.3pt
				pdf.setFont("helvetica", "normal");
				const delayText = delay === "Unknown" ? "Unknown" : delay + "ms";
				pdf.text(delayText + ":", tableX + 0.5, tableY + row * rowHeight + 2);

				// Count cell (white background)
				pdf.setFillColor(255, 255, 255);
				pdf.rect(tableX + col1Width, tableY + row * rowHeight, col2Width, rowHeight, "FD");
				pdf.setTextColor(0, 0, 0);
				pdf.text(String(group.count), tableX + col1Width + 3, tableY + row * rowHeight + 2);

				row++;
			});

		currentY += row * rowHeight + 4;
	});
}

/**
 * Generate a true vector PDF matching the EXACT working printCanvasHiRes logic
 * but using jsPDF native drawing API instead of canvas
 * @param {Object} context - Application context with all data and functions
 * @param {Object} userInput - Optional user input from PrintDialog: {blastName, designer, notes, outputType}
 * @param {string} mode - Optional mode: "2D" or "3D"
 */
export function generateTrueVectorPDF(context, userInput, mode) {
	// Step 1a) Handle both old and new call signatures
	// Old: generateTrueVectorPDF({...allContext, userInput, mode})
	// New: generateTrueVectorPDF(context, userInput, mode)
	if (!userInput && context.userInput) {
		userInput = context.userInput;
	}
	if (!mode && context.mode) {
		mode = context.mode;
	}
	
	const { allBlastHoles, allKADDrawingsMap, allAvailableSurfaces, loadedSurfaces, loadedImages, showModalMessage, FloatingDialog, printPaperSize, printOrientation, getVoronoiMetrics, buildVersion, getDisplayOptions, simplifyByPxDist } = context;
	
	// Step 1b) Default userInput if not provided (backward compatibility)
	if (!userInput) {
		userInput = {
			blastName: "Untitled Blast",
			designer: "",
			notes: "",
			outputType: "vector"
		};
	}
	
	// Step 1c) Default mode if not provided
	if (!mode) {
		mode = context.is3DMode ? "3D" : "2D";
	}

	// Step 1) Check for data (same logic as working version)
	if ((!allBlastHoles || allBlastHoles.length === 0) && (!allKADDrawingsMap || allKADDrawingsMap.size === 0) && (!allAvailableSurfaces || allAvailableSurfaces.length === 0)) {
		showModalMessage("No Data", "No data available for printing (no blast holes, KAD drawings, surfaces, or images)", "warning");
		return;
	}

	// Step 2) Create progress dialog (same as working version)
	const progressContent = document.createElement("div");
	progressContent.style.textAlign = "center";
	progressContent.innerHTML = `
        <p>Generating High-Resolution Vector PDF</p>
        <p>Please wait, this may take a moment...</p>
        <div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">
            <div id="pdfProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>
        </div>
        <p id="pdfProgressText">Starting...</p>
    `;

	const progressDialog = new FloatingDialog({
		title: "Vector PDF Generation",
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

	// Pre-load QR code image before starting PDF generation
	let qrCodeDataURL = null;
	const qrImg = new Image();
	qrImg.crossOrigin = "anonymous";
	qrImg.onload = function () {
		try {
			const qrCanvas = document.createElement("canvas");
			qrCanvas.width = 110;
			qrCanvas.height = 110;
			const qrCtx = qrCanvas.getContext("2d");
			qrCtx.drawImage(qrImg, 0, 0, 110, 110);
			qrCodeDataURL = qrCanvas.toDataURL("image/png");
		} catch (e) {
			console.warn("Failed to prepare QR code:", e);
		}
	};
	qrImg.onerror = function () {
		console.warn("Failed to load QR code image");
	};
	qrImg.src = "icons/kirra2d-qr-code.png";

	// Wait a moment for QR code to load, then start PDF generation
	setTimeout(() => {
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

			// Step 2) Get template and create layout manager
			const template = getTemplate(mode, printOrientation);
			const layoutMgr = new PrintLayoutManager(template, pageWidth, pageHeight);
			
			// Step 2a) Get map zone with print-safe area
			const mapZoneWithSafeArea = layoutMgr.getMapZoneWithSafeArea();
			const mapZone = mapZoneWithSafeArea.inner; // Use inner safe area for data rendering
			
			// Create PDF
			const orientation = isLandscape ? "l" : "p";
			const pdf = new jsPDF(orientation, "mm", printPaperSize.toLowerCase());

			// Step 2b) Calculate print area from map zone
			const printArea = {
				x: mapZone.x,
				y: mapZone.y,
				width: mapZone.width,
				height: mapZone.height
			};
			
			// Step 2c) Calculate margin (2% of page width, matching template)
			const margin = pageWidth * 0.02;
			
			// Step 2d) Draw border around map zone
			drawCellBorder(pdf, mapZone.x, mapZone.y, mapZone.width, mapZone.height, 0.2);

			bar.style.width = "10%";
			text.textContent = "Calculating coordinates...";

			// === WYSIWYG LOGIC: EXACT same as working version ===
			const canvas = context.canvas;
			const screenBoundary = getPrintBoundary(canvas);
			if (!screenBoundary) {
				throw new Error("Print Preview Mode must be active to generate a WYSIWYG print.");
			}

			// Calculate the INNER boundary (blue dashed lines - print-safe area)
			const innerMargin = screenBoundary.width * screenBoundary.marginPercent;
			const innerBoundary = {
				x: screenBoundary.x + innerMargin,
				y: screenBoundary.y + innerMargin,
				width: screenBoundary.width - innerMargin * 2,
				height: screenBoundary.height - innerMargin * 2,
			};

			// Convert the BLUE boundary to world coordinates
			const world_x1 = (innerBoundary.x - canvas.width / 2) / context.currentScale + context.centroidX;
			const world_y1 = -(innerBoundary.y + innerBoundary.height - canvas.height / 2) / context.currentScale + context.centroidY;
			const world_x2 = (innerBoundary.x + innerBoundary.width - canvas.width / 2) / context.currentScale + context.centroidX;
			const world_y2 = -(innerBoundary.y - canvas.height / 2) / context.currentScale + context.centroidY;

			const minX = Math.min(world_x1, world_x2);
			const maxX = Math.max(world_x1, world_x2);
			const minY = Math.min(world_y1, world_y2);
			const maxY = Math.max(world_y1, world_y2);

			// Calculate the scale to fit this world view into the PDF's printArea
			const dataWidth = maxX - minX;
			const dataHeight = maxY - minY;
			if (dataWidth <= 0 || dataHeight <= 0) {
				throw new Error("Invalid data dimensions");
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

			// World to PDF (mm) transformation - EXACT same formula
			function worldToPDF(worldX, worldY) {
				const centerX = offsetX + scaledWidth / 2;
				const centerY = offsetY + scaledHeight / 2;
				const x = (worldX - printCentroidX) * printScale + centerX;
				const y = -(worldY - printCentroidY) * printScale + centerY;
				return [x, y];
			}

			bar.style.width = "20%";
			text.textContent = "Drawing background images...";

			// === BACKGROUND IMAGES AS RASTER ===
			// Render images to a temporary canvas, then add as raster to PDF
			if (loadedImages && loadedImages.size > 0) {
				// Create a temporary canvas for compositing background images
				const imgCanvas = document.createElement("canvas");
				imgCanvas.width = pageWidth * mmToPx;
				imgCanvas.height = pageHeight * mmToPx;
				const imgCtx = imgCanvas.getContext("2d");
				imgCtx.fillStyle = "white";
				imgCtx.fillRect(0, 0, imgCanvas.width, imgCanvas.height);

				loadedImages.forEach((image) => {
					if (image.visible === false || !image.canvas) return;

					const bbox = image.bbox;
					if (bbox && bbox.length >= 4) {
						// Transform world coordinates to PDF canvas coordinates
						const [x1, y1] = worldToPDF(bbox[0], bbox[3]);
						const [x2, y2] = worldToPDF(bbox[2], bbox[1]);

						// Convert mm to pixels for canvas
						const px1 = x1 * mmToPx;
						const py1 = y1 * mmToPx;
						const px2 = x2 * mmToPx;
						const py2 = y2 * mmToPx;

						const width = Math.abs(px2 - px1);
						const height = Math.abs(py2 - py1);

						imgCtx.save();
						imgCtx.globalAlpha = image.transparency !== undefined && image.transparency !== null ? image.transparency : 1.0;
						imgCtx.drawImage(image.canvas, Math.min(px1, px2), Math.min(py1, py2), width, height);
						imgCtx.restore();
					}
				});

				// Add the composite image layer to PDF as raster underlay
				try {
					const imgData = imgCanvas.toDataURL("image/png", 1.0);
					if (imgData && imgData.length > 100) {
						pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight, undefined, "NONE", 0); // z-index 0 for background
					}
				} catch (imgError) {
					console.warn("Failed to add background images to PDF:", imgError);
				}
			}

			bar.style.width = "40%";
			text.textContent = "Drawing surfaces...";

			// === SURFACES AS VECTORS ===
			// Draw surfaces as filled triangles with gradient colors
			if (loadedSurfaces && loadedSurfaces.size > 0) {
				// Calculate global Z range for all visible surfaces
				let allMinZ = Infinity;
				let allMaxZ = -Infinity;
				let hasSurfaces = false;

				for (const [surfaceId, surface] of loadedSurfaces.entries()) {
					if (surface.visible === false) continue;
					if (surface.isTexturedMesh) continue; // Textured meshes are in background images

					if (surface.points && surface.points.length > 0) {
						hasSurfaces = true;
						surface.points.forEach((point) => {
							if (point.z < allMinZ) allMinZ = point.z;
							if (point.z > allMaxZ) allMaxZ = point.z;
						});
					}
				}

				// Draw triangles
				if (hasSurfaces) {
					for (const [surfaceId, surface] of loadedSurfaces.entries()) {
						if (surface.visible === false) continue;
						if (surface.isTexturedMesh) continue;

						if (surface.triangles && surface.triangles.length > 0) {
							surface.triangles.forEach((triangle) => {
								// Get triangle vertices in world coordinates
								const v1 = triangle.vertices[0];
								const v2 = triangle.vertices[1];
								const v3 = triangle.vertices[2];

								// Transform to PDF coordinates
								const [x1, y1] = worldToPDF(v1.x, v1.y);
								const [x2, y2] = worldToPDF(v2.x, v2.y);
								const [x3, y3] = worldToPDF(v3.x, v3.y);

								// Calculate average Z for color
								const avgZ = (v1.z + v2.z + v3.z) / 3;

								// Get color from elevation gradient
								let color = "#888888"; // Default gray
								if (context.elevationToColor && allMaxZ > allMinZ) {
									color = context.elevationToColor(avgZ, allMinZ, allMaxZ);
								}

								// Convert color to RGB
								const rgb = rgbaToRgb(color);

								// Set fill color with transparency
								const alpha = surface.transparency !== undefined ? surface.transparency : 1.0;
								pdf.setFillColor(rgb.r, rgb.g, rgb.b);
								pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
								pdf.setLineWidth(0.05);

								// Draw filled triangle
								pdf.triangle(x1, y1, x2, y2, x3, y3, "FD");
							});
						}
					}
				}
			}

			// Draw surface legend after surfaces
			drawSurfaceLegendVector(pdf, pageWidth, pageHeight, margin, context);

			bar.style.width = "50%";
			text.textContent = "Drawing KAD entities...";

			// === KAD ENTITIES AS VECTORS ===
			if (allKADDrawingsMap && allKADDrawingsMap.size > 0) {
				for (const [name, entity] of allKADDrawingsMap.entries()) {
					if (entity.visible === false) continue;

					if (entity.entityType === "point") {
						const simplifiedPoints = simplifyByPxDist ? simplifyByPxDist(entity.data, 3) : entity.data;
						simplifiedPoints.forEach((point) => {
							const [x, y] = worldToPDF(point.pointXLocation, point.pointYLocation);
							const rgb = hexToRgb(point.color || "#000000");
							// Validate RGB values before setting
							if (!isNaN(rgb.r) && !isNaN(rgb.g) && !isNaN(rgb.b)) {
								pdf.setFillColor(rgb.r, rgb.g, rgb.b);
								pdf.circle(x, y, 0.3, "F");
							}
						});
					} else if (entity.entityType === "circle") {
						entity.data.forEach((circle) => {
							const [x, y] = worldToPDF(circle.pointXLocation, circle.pointYLocation);
							const radiusMM = circle.radius * printScale;
							const rgb = hexToRgb(circle.color || "#000000");
							if (!isNaN(rgb.r) && !isNaN(rgb.g) && !isNaN(rgb.b)) {
								pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
								pdf.setLineWidth((circle.lineWidth || 1) * 0.1);
								pdf.circle(x, y, radiusMM, "S");
							}
						});
					} else if (entity.entityType === "text") {
						entity.data.forEach((textData) => {
							if (textData && textData.text) {
								const [x, y] = worldToPDF(textData.pointXLocation, textData.pointYLocation);
								drawTextVector(pdf, x, y, textData.text, textData.color || "#000000", 8);
							}
						});
					} else if (entity.entityType === "line" || entity.entityType === "poly") {
						const points = entity.data;
						if (points.length >= 2) {
							const rgb = hexToRgb(points[0].color || "#000000");
							if (!isNaN(rgb.r) && !isNaN(rgb.g) && !isNaN(rgb.b)) {
								pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
								pdf.setLineWidth((points[0].lineWidth || 1) * 0.1);

								for (let i = 0; i < points.length - 1; i++) {
									const [x1, y1] = worldToPDF(points[i].pointXLocation, points[i].pointYLocation);
									const [x2, y2] = worldToPDF(points[i + 1].pointXLocation, points[i + 1].pointYLocation);
									pdf.line(x1, y1, x2, y2);
								}

								// Close polygon
								if (entity.entityType === "poly" && points.length > 2) {
									const [x1, y1] = worldToPDF(points[points.length - 1].pointXLocation, points[points.length - 1].pointYLocation);
									const [x2, y2] = worldToPDF(points[0].pointXLocation, points[0].pointYLocation);
									pdf.line(x1, y1, x2, y2);
								}
							}
						}
					}
				}
			}

			bar.style.width = "70%";
			text.textContent = "Drawing blast holes...";

			// === BLAST HOLES AS VECTORS ===
			const visibleBlastHoles = allBlastHoles ? allBlastHoles.filter((hole) => hole.visible !== false) : [];
			const displayOptions = getDisplayOptions ? getDisplayOptions() : {};

			const toeSizeInMeters = parseFloat(document.getElementById("toeSlider")?.value || 3);
			const magnifyFont = 1.0; // Could make this adjustable

			pdf.setFont("helvetica", "normal");
			// Canvas: 12px * magnifyFont → PDF: ~4pt
			const holeFontSizePt = 4 * magnifyFont;
			pdf.setFontSize(holeFontSizePt);

			for (const hole of visibleBlastHoles) {
				const [x, y] = worldToPDF(hole.startXLocation, hole.startYLocation);
				const [gradeX, gradeY] = worldToPDF(hole.gradeXLocation, hole.gradeYLocation);
				const [lineEndX, lineEndY] = worldToPDF(hole.endXLocation, hole.endYLocation);

				// Draw collar-to-toe track if angled
				if (hole.holeAngle > 0) {
					drawTrackVector(pdf, x, y, lineEndX, lineEndY, gradeX, gradeY, "black", hole.subdrillAmount);
				}

				// Draw toe if hole length is not zero
				if (parseFloat(hole.holeLengthCalculated).toFixed(1) != 0.0) {
					const radiusInMM = toeSizeInMeters * printScale;
					drawHoleToeVector(pdf, lineEndX, lineEndY, context.transparentFillColor || "rgba(255,255,255,0.5)", "black", radiusInMM);
				}

				// Step 3) Calculate text offsets (in mm, scaled)
				// Fix collar size - reduce by 75% (was oversized)
				// Original was 0.25, but still 75% too large, so reduce to ~0.14 (0.25 / 1.75)
				const printHoleScale = parseFloat(document.getElementById("holeSize")?.value || 3);
				const holeRadius = (hole.holeDiameter / 1000 / 2) * printHoleScale * printScale * 0.14; // Fixed: reduced from 0.25 to 0.14
				const textOffset = holeRadius * 2.2; // Increased spacing for better readability
				const leftSideToe = lineEndX - textOffset;
				const rightSideToe = lineEndX + textOffset;
				const leftSideCollar = x - textOffset;
				const rightSideCollar = x + textOffset;
				const fontSize = 7; // Increased to 7pt for better readability (was 6pt)

				// Draw hole main shape
				drawHoleVector(pdf, x, y, holeRadius, "black");

				// Draw hole labels
				if (displayOptions.holeID) {
					drawTextVector(pdf, rightSideCollar, y - textOffset, hole.holeID, "black", fontSize);
				}
				if (displayOptions.holeDia) {
					drawTextVector(pdf, rightSideCollar, y, parseFloat(hole.holeDiameter).toFixed(0), "rgb(0, 50, 0)", fontSize);
				}
				if (displayOptions.holeLen) {
					drawTextVector(pdf, rightSideCollar, y + textOffset, parseFloat(hole.holeLengthCalculated).toFixed(1), "rgb(0, 0, 67)", fontSize);
				}
				if (displayOptions.holeAng) {
					drawRightAlignedTextVector(pdf, leftSideCollar, y - textOffset, parseFloat(hole.holeAngle).toFixed(0) + "°", "rgb(67, 30, 0)", fontSize);
				}
				if (displayOptions.holeDip) {
					drawRightAlignedTextVector(pdf, leftSideToe, lineEndY - textOffset, 90 - parseFloat(hole.holeAngle).toFixed(0) + "°", "rgb(67, 30, 0)", fontSize);
				}
				if (displayOptions.holeBea) {
					drawRightAlignedTextVector(pdf, leftSideToe, lineEndY + textOffset, parseFloat(hole.holeBearing).toFixed(1) + "°", "red", fontSize);
				}
			}

			bar.style.width = "90%";
			text.textContent = "Adding header and footer...";

			// === FOOTER SECTION - USING TEMPLATE LAYOUT ===
			// Step 4) Render footer using template layout (footer is at bottom, full width)
			const footer = layoutMgr.getFooterRect() || layoutMgr.getInfoPanelRect();
			const footerZoneName = footer === layoutMgr.getZoneRect("footer") ? "footer" : "infoPanel";
			
			// Step 4a) Draw outer border around entire footer zone
			drawCellBorder(pdf, footer.x, footer.y, footer.width, footer.height, 0.2);
			
			// Step 4b) Get all cells from footer rows
			const row1Cells = layoutMgr.getRowCells(footerZoneName, "row1");
			const row2Cells = layoutMgr.getRowCells(footerZoneName, "row2");
			const row3Cells = layoutMgr.getRowCells(footerZoneName, "row3");
			const row4Cells = layoutMgr.getRowCells(footerZoneName, "row4"); // May not exist in new structure
			
			// Step 4c) Draw borders around all cells and render content
			// Helper function to draw borders for a row of cells
			function drawRowBorders(cells) {
				if (!cells) return;
				for (let i = 0; i < cells.length; i++) {
					const cell = cells[i];
					if (cell && cell.id !== "emptyLeft" && cell.id !== "empty1" && cell.id !== "empty2") {
						drawCellBorder(pdf, cell.x, cell.y, cell.width, cell.height, 0.1);
					}
				}
			}
			
			// Draw borders for all rows
			drawRowBorders(row1Cells);
			drawRowBorders(row2Cells);
			drawRowBorders(row3Cells);
			drawRowBorders(row4Cells);
			
			// Step 4d) Render Row 1: Navigation Indicator | Connector Count | Blast Stats | Logo
			for (let i = 0; i < row1Cells.length; i++) {
				const cell = row1Cells[i];
				if (!cell) continue;
				
				if (cell.id === "navigationIndicator") {
					// Step 4b1) Draw navigation indicator (North Arrow for 2D, XYZ Gizmo for 3D)
					if (cell.content === "northArrow" && mode === "2D") {
						try {
							const northArrowDataURL = PrintCaptureManager.captureNorthArrow(context);
							if (northArrowDataURL) {
								const arrowSize = Math.min(cell.width, cell.height) * 0.8; // 80% of cell size
								const arrowX = cell.x + (cell.width - arrowSize) / 2;
								const arrowY = cell.y + (cell.height - arrowSize) / 2;
								pdf.addImage(northArrowDataURL, "PNG", arrowX, arrowY, arrowSize, arrowSize);
							}
						} catch (e) {
							console.warn("Failed to capture north arrow:", e);
							// Draw placeholder
							pdf.setFontSize(8);
							pdf.setFont("helvetica", "bold");
							pdf.setTextColor(0, 0, 0);
							pdf.text("N", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: "center" });
						}
					} else if (cell.content === "xyzGizmo" && mode === "3D") {
						try {
							const gizmoDataURL = PrintCaptureManager.captureXYZGizmo(context);
							if (gizmoDataURL) {
								const gizmoSize = Math.min(cell.width, cell.height) * 0.8;
								const gizmoX = cell.x + (cell.width - gizmoSize) / 2;
								const gizmoY = cell.y + (cell.height - gizmoSize) / 2;
								pdf.addImage(gizmoDataURL, "PNG", gizmoX, gizmoY, gizmoSize, gizmoSize);
							}
						} catch (e) {
							console.warn("Failed to capture XYZ gizmo:", e);
							// Draw placeholder
							pdf.setFontSize(6);
							pdf.setTextColor(0, 0, 0);
							pdf.text("XYZ", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: "center" });
						}
					}
				} else if (cell.id === "connectorCount") {
					// Step 4b2) Draw connector count (placeholder for now)
					pdf.setFontSize(7);
					pdf.setFont("helvetica", "normal");
					pdf.setTextColor(0, 0, 0);
					pdf.text("CONNECTOR", cell.x + cell.width / 2, cell.y + cell.height * 0.3, { align: "center" });
					pdf.text("COUNT", cell.x + cell.width / 2, cell.y + cell.height * 0.6, { align: "center" });
				} else if (cell.id === "blastStatistics") {
					// Step 4b3) Draw blast statistics header
					pdf.setFontSize(7);
					pdf.setFont("helvetica", "bold");
					pdf.setTextColor(0, 0, 0);
					pdf.text("BLAST", cell.x + cell.width / 2, cell.y + cell.height * 0.3, { align: "center" });
					pdf.text("STATISTICS", cell.x + cell.width / 2, cell.y + cell.height * 0.6, { align: "center" });
				} else if (cell.id === "logo") {
					// Step 4b4) Draw QR code logo
					if (qrCodeDataURL) {
						try {
							const qrSize = Math.min(cell.width, cell.height) * 0.7;
							const qrX = cell.x + (cell.width - qrSize) / 2;
							const qrY = cell.y + (cell.height - qrSize) / 2;
							pdf.addImage(qrCodeDataURL, "PNG", qrX, qrY, qrSize, qrSize);
							
							// Add URL below QR code
							pdf.setFontSize(5);
							pdf.setFont("helvetica", "normal");
							pdf.setTextColor(0, 0, 0);
							pdf.text("blastingapps.com", cell.x + cell.width / 2, cell.y + cell.height - 2, { align: "center" });
						} catch (qrError) {
							console.warn("Failed to add QR code:", qrError);
							pdf.setFontSize(6);
							pdf.text("[QR]", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: "center" });
						}
					} else {
						pdf.setFontSize(6);
						pdf.text("[QR]", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: "center" });
					}
				}
			}
			
			// Step 4e) Render Row 2: Logo | Connector Data | Stats Data | Date/Time (or Title/BlastName for landscape)
			// First handle row2 cells that aren't titleBlastName
			if (row2Cells && row2Cells.length > 0) {
				for (let i = 0; i < row2Cells.length; i++) {
					const cell = row2Cells[i];
					if (!cell) continue;
					
					if (cell.id === "logo") {
						// Draw QR code logo (already handled above, but need to handle if in row2)
						if (qrCodeDataURL) {
							try {
								const qrSize = Math.min(cell.width, cell.height) * 0.7;
								const qrX = cell.x + (cell.width - qrSize) / 2;
								const qrY = cell.y + (cell.height - qrSize) / 2;
								pdf.addImage(qrCodeDataURL, "PNG", qrX, qrY, qrSize, qrSize);
								
								// Add URL below QR code
								pdf.setFontSize(5);
								pdf.setFont("helvetica", "normal");
								pdf.setTextColor(0, 0, 0);
								pdf.text("blastingapps.com", cell.x + cell.width / 2, cell.y + cell.height - 2, { align: "center" });
							} catch (qrError) {
								console.warn("Failed to add QR code:", qrError);
								pdf.setFontSize(6);
								pdf.text("[QR]", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: "center" });
							}
						} else {
							pdf.setFontSize(6);
							pdf.text("[QR]", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: "center" });
						}
					} else if (cell.id === "dateTime") {
						// Date/Time in row2 (portrait mode)
						const now = new Date();
						const dateStr = now.toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" }) + " " + now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
						
						pdf.setFontSize(7);
						pdf.setFont("helvetica", "bold");
						pdf.setTextColor(0, 0, 0);
						pdf.text("DATE", cell.x + 2, cell.y + cell.height * 0.3);
						pdf.setFontSize(6);
						pdf.setFont("helvetica", "normal");
						pdf.text("[" + dateStr + "]", cell.x + 2, cell.y + cell.height * 0.7);
					}
				}
			}
			
			// Step 4e) Render Row 2 cells: Logo | Connector Data | Stats Data | Date/Time (or Title/BlastName for landscape)
			if (row2Cells && row2Cells.length > 0) {
				for (let i = 0; i < row2Cells.length; i++) {
					const cell = row2Cells[i];
					if (!cell) continue;
					
					if (cell.id === "logo") {
						// Draw QR code logo in row2 (portrait mode)
						if (qrCodeDataURL) {
							try {
								const qrSize = Math.min(cell.width, cell.height) * 0.7;
								const qrX = cell.x + (cell.width - qrSize) / 2;
								const qrY = cell.y + (cell.height - qrSize) / 2;
								pdf.addImage(qrCodeDataURL, "PNG", qrX, qrY, qrSize, qrSize);
								
								// Add URL below QR code
								pdf.setFontSize(5);
								pdf.setFont("helvetica", "normal");
								pdf.setTextColor(0, 0, 0);
								pdf.text("blastingapps.com", cell.x + cell.width / 2, cell.y + cell.height - 2, { align: "center" });
							} catch (qrError) {
								console.warn("Failed to add QR code:", qrError);
								pdf.setFontSize(6);
								pdf.text("[QR]", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: "center" });
							}
						} else {
							pdf.setFontSize(6);
							pdf.text("[QR]", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: "center" });
						}
					} else if (cell.id === "dateTime") {
						// Date/Time in row2 (portrait mode)
						const now = new Date();
						const dateStr = now.toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" }) + " " + now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
						
						pdf.setFontSize(7);
						pdf.setFont("helvetica", "bold");
						pdf.setTextColor(0, 0, 0);
						pdf.text("DATE", cell.x + 2, cell.y + cell.height * 0.3);
						pdf.setFontSize(6);
						pdf.setFont("helvetica", "normal");
						pdf.text("[" + dateStr + "]", cell.x + 2, cell.y + cell.height * 0.7);
					}
				}
			}
			
			// Step 4f) Render Title and Blast Name (landscape: row2, portrait: row1)
			const titleCell = (row2Cells && row2Cells.find(function(c) { return c && c.id === "titleBlastName"; })) ||
			                  (row1Cells && row1Cells.find(function(c) { return c && c.id === "titleBlastName"; }));
			if (titleCell) {
				// Get blast names from allBlastHoles
				const blastNames = new Set();
				if (allBlastHoles && allBlastHoles.length > 0) {
					allBlastHoles.forEach(function(hole) {
						if (hole.entityName) {
							blastNames.add(hole.entityName);
						}
					});
				}
				const blastNameList = Array.from(blastNames).join(", ");
				const displayBlastName = blastNameList || userInput.blastName || "Untitled Blast";
				
				const isInRow1 = row1Cells && row1Cells.find(function(c) { return c && c.id === "titleBlastName"; });
				if (isInRow1) {
					// Portrait mode: smaller font
					pdf.setFontSize(8);
					pdf.setFont("helvetica", "bold");
					pdf.setTextColor(0, 0, 0);
					pdf.text("TITLE", titleCell.x + 2, titleCell.y + titleCell.height * 0.3);
					pdf.setFontSize(7);
					pdf.setFont("helvetica", "normal");
					pdf.text("[" + displayBlastName + "]", titleCell.x + 2, titleCell.y + titleCell.height * 0.7);
				} else {
					// Landscape mode: larger font
					pdf.setFontSize(10);
					pdf.setFont("helvetica", "bold");
					pdf.setTextColor(0, 0, 0);
					pdf.text("TITLE", titleCell.x + 2, titleCell.y + titleCell.height * 0.3);
					pdf.setFontSize(9);
					pdf.setFont("helvetica", "normal");
					pdf.text("[" + displayBlastName + "]", titleCell.x + 2, titleCell.y + titleCell.height * 0.7);
				}
			}
			
			// Step 4d) Render Row 3: Date and Time
			if (row3Cells && row3Cells.length > 0) {
				const dateCell = row3Cells.find(function(c) { return c && c.id === "dateTime"; });
				if (dateCell) {
					const now = new Date();
					const dateStr = now.toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" }) + " " + now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
					
					pdf.setFontSize(7);
					pdf.setFont("helvetica", "bold");
					pdf.setTextColor(0, 0, 0);
					pdf.text("DATE", dateCell.x + 2, dateCell.y + dateCell.height * 0.3);
					pdf.setFontSize(6);
					pdf.setFont("helvetica", "normal");
					pdf.text("[" + dateStr + "]", dateCell.x + 2, dateCell.y + dateCell.height * 0.7);
				}
			}
			
			// Step 4h) Render Scale and Designer (row3 in new structure, row4 in old structure)
			const scaleCell = (row3Cells && row3Cells.find(function(c) { return c && c.id === "scale"; })) ||
			                  (row4Cells && row4Cells.find(function(c) { return c && c.id === "scale"; }));
			const designerCell = (row3Cells && row3Cells.find(function(c) { return c && c.id === "designer"; })) ||
			                     (row4Cells && row4Cells.find(function(c) { return c && c.id === "designer"; }));
			
			if (scaleCell) {
				const scaleRatio = layoutMgr.calculateScaleRatio(printScale);
				pdf.setFontSize(7);
				pdf.setFont("helvetica", "normal");
				pdf.setTextColor(0, 0, 0);
				pdf.text(scaleCell.label + " " + scaleRatio, scaleCell.x + 2, scaleCell.y + scaleCell.height / 2);
			}
			
			if (designerCell) {
				const designerName = userInput.designer || "";
				pdf.setFontSize(7);
				pdf.setFont("helvetica", "normal");
				pdf.setTextColor(0, 0, 0);
				pdf.text(designerCell.label + " [" + designerName + "]", designerCell.x + 2, designerCell.y + designerCell.height / 2);
			}
			
			// Step 4i) Draw full statistics table in connectorData or blastStatsData cells
			// For new footer structure, statistics go in the data cells (connectorData/blastStatsData)
			// For old infoPanel structure, draw below rows
			if (allBlastHoles && allBlastHoles.length > 0 && getVoronoiMetrics) {
				const stats = getBlastStatisticsPerEntity(allBlastHoles, getVoronoiMetrics);
				
				if (footerZoneName === "footer") {
					// New structure: Draw stats in blastStatsData cell (row2, cell index 2)
					const statsDataCell = row2Cells && row2Cells.length > 2 ? row2Cells[2] : null;
					if (statsDataCell && statsDataCell.id === "blastStatsData") {
						drawStatsTableVector(pdf, statsDataCell.x, statsDataCell.y, stats, context);
					}
				} else {
					// Old structure: Draw below rows
					let statsStartY = footer.y;
					if (row4Cells && row4Cells.length > 0) {
						const lastRow4Cell = row4Cells[row4Cells.length - 1];
						if (lastRow4Cell) {
							statsStartY = lastRow4Cell.y + lastRow4Cell.height + 2;
						}
					} else if (row3Cells && row3Cells.length > 0) {
						const lastRow3Cell = row3Cells[row3Cells.length - 1];
						if (lastRow3Cell) {
							statsStartY = lastRow3Cell.y + lastRow3Cell.height + 2;
						}
					}
					drawStatsTableVector(pdf, footer.x, statsStartY, stats, context);
				}
			}
			
			// Step 4g) Footer: Generated by text and version
			pdf.setFontSize(6);
			pdf.setFont("helvetica", "normal");
			pdf.setTextColor(0, 0, 0);
			pdf.text("Generated by KIRRA Blast Design Software", pageWidth / 2, pageHeight - 5, { align: "center" });
			if (buildVersion) {
				pdf.text("Version: " + buildVersion, pageWidth - 5, pageHeight - 5, { align: "right" });
			}

			bar.style.width = "100%";
			text.textContent = "Saving PDF...";

			// Save the PDF
			pdf.save("kirra-2d-vector-" + new Date().toISOString().split("T")[0] + ".pdf");

			setTimeout(() => {
				progressDialog.close();
				showModalMessage("Success", "Vector PDF created with all features!", "success");
			}, 300);
		} catch (error) {
			progressDialog.close();
			console.error("Vector PDF Generation Error:", error);
			showModalMessage("PDF Creation Failed", "Error: " + error.message, "error");
		}
	}, 500); // Increased timeout to allow QR code to load
}
