/* prettier-ignore-file */
//=================================================
// PrintVectorPDF.js - Vector PDF Generation using jsPDF
//=================================================
// Generates true vector PDFs matching the template layout exactly
// GeoPDF support removed - standard PDF output only

import { jsPDF } from "jspdf";
import { getPrintBoundary } from "./PrintSystem.js";
import { getBlastStatisticsPerEntity } from "../helpers/BlastStatistics.js";
import { getTemplate, getPaperDimensions } from "./PrintTemplates.js";
import { PrintLayoutManager } from "./PrintLayoutManager.js";
import { PrintCaptureManager } from "./PrintCaptureManager.js";

// ============== HELPER FUNCTIONS ==============

// Step 1) Convert hex color to RGB
function hexToRgb(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    if (typeof hex !== "string") return { r: 0, g: 0, b: 0 };

    hex = hex.replace("#", "");

    // Expand shorthand hex
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return { r: 0, g: 0, b: 0 };
    }

    return { r: r, g: g, b: b };
}

// Step 2) Convert rgba string to RGB
function rgbaToRgb(rgba) {
    if (!rgba) return { r: 0, g: 0, b: 0, a: 1 };
    if (rgba.startsWith("#")) return hexToRgb(rgba);

    var match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return { r: 0, g: 0, b: 0, a: 1 };

    return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? parseFloat(match[4]) : 1
    };
}

// Step 3) Get luminance for contrast calculation
function getLuminance(r, g, b) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Step 4) Get contrast color (black or white)
function getContrastColor(bgColor) {
    var rgb = hexToRgb(bgColor);
    var luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    return luminance < 0.5 ? "#ffffff" : "#000000";
}

// Step 5) Draw a cell border
function drawCellBorder(pdf, x, y, width, height, lineWidth) {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(lineWidth || 0.2);
    pdf.rect(x, y, width, height, "S");
}

// Step 6) Draw text centered in a cell
function drawCenteredText(pdf, text, x, y, width, height, fontSize, bold) {
    pdf.setFontSize(fontSize || 8);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(0, 0, 0);
    pdf.text(text, x + width / 2, y + height / 2, { align: "center", baseline: "middle" });
}

// Step 7) Draw multi-line text in a cell
function drawMultilineText(pdf, lines, x, y, width, height, fontSize, lineSpacing) {
    lineSpacing = lineSpacing || fontSize * 0.4;
    var totalHeight = lines.length * fontSize + (lines.length - 1) * lineSpacing;
    var startY = y + (height - totalHeight) / 2 + fontSize / 2;

    pdf.setFontSize(fontSize || 8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);

    for (var i = 0; i < lines.length; i++) {
        pdf.text(lines[i], x + width / 2, startY + i * (fontSize + lineSpacing), { align: "center" });
    }
}

// ============== MAIN VECTOR PDF GENERATION ==============

/**
 * Generate a true vector PDF matching the template layout exactly
 * @param {Object} context - Application context with all data
 * @param {Object} userInput - User input: {blastName, designer, notes, outputType}
 * @param {string} mode - "2D" or "3D"
 */
export function generateTrueVectorPDF(context, userInput, mode) {
    // Step 8) Handle call signatures
    if (!userInput && context.userInput) {
        userInput = context.userInput;
    }
    if (!mode && context.mode) {
        mode = context.mode;
    }
    if (!userInput) {
        userInput = {
            blastName: "Untitled Blast",
            designer: "",
            notes: "",
            outputType: "vector"
        };
    }
    if (!mode) {
        mode = context.is3DMode ? "3D" : "2D";
    }

    var allBlastHoles = context.allBlastHoles;
    var allKADDrawingsMap = context.allKADDrawingsMap;
    var allAvailableSurfaces = context.allAvailableSurfaces;
    var loadedSurfaces = context.loadedSurfaces;
    var loadedImages = context.loadedImages;
    var showModalMessage = context.showModalMessage;
    var FloatingDialog = context.FloatingDialog;
    var printPaperSize = context.printPaperSize;
    var printOrientation = context.printOrientation;
    var getVoronoiMetrics = context.getVoronoiMetrics;
    var buildVersion = context.buildVersion;
    var getDisplayOptions = context.getDisplayOptions;
    var simplifyByPxDist = context.simplifyByPxDist;

    // Step 9) Check for data
    if ((!allBlastHoles || allBlastHoles.length === 0) &&
        (!allKADDrawingsMap || allKADDrawingsMap.size === 0) &&
        (!allAvailableSurfaces || allAvailableSurfaces.length === 0)) {
        showModalMessage("No Data", "No data available for printing", "warning");
        return;
    }

    // Step 10) Create progress dialog
    var progressContent = document.createElement("div");
    progressContent.style.textAlign = "center";
    progressContent.innerHTML = '<p>Generating Vector PDF</p>' +
        '<p>Please wait...</p>' +
        '<div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">' +
        '<div id="pdfProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>' +
        '</div>' +
        '<p id="pdfProgressText">Starting...</p>';

    var progressDialog = new FloatingDialog({
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

    var bar = document.getElementById("pdfProgressBar");
    var text = document.getElementById("pdfProgressText");

    // Step 11) Pre-load QR code
    var qrCodeDataURL = null;
    var qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = function() {
        try {
            var qrCanvas = document.createElement("canvas");
            qrCanvas.width = 110;
            qrCanvas.height = 110;
            var qrCtx = qrCanvas.getContext("2d");
            qrCtx.drawImage(qrImg, 0, 0, 110, 110);
            qrCodeDataURL = qrCanvas.toDataURL("image/png");
        } catch (e) {
            console.warn("Failed to prepare QR code:", e);
        }
    };
    qrImg.onerror = function() {
        console.warn("QR code image not found");
    };
    qrImg.src = "icons/kirra2d-qr-code.png";

    // Step 12) Wait for QR code, then generate PDF
    setTimeout(function() {
        try {
            bar.style.width = "10%";
            text.textContent = "Setting up page...";

            // Step 12a) Get paper dimensions
            var paperDims = getPaperDimensions(printPaperSize, printOrientation);
            var pageWidth = paperDims.width;
            var pageHeight = paperDims.height;

            // Step 12b) Get template and layout manager
            var template = getTemplate(mode, printOrientation);
            var layoutMgr = new PrintLayoutManager(template, pageWidth, pageHeight);

            // Step 12c) Create PDF
            var orientation = printOrientation === "landscape" ? "l" : "p";
            var pdf = new jsPDF(orientation, "mm", printPaperSize.toLowerCase());

            // Step 12d) Get zone positions
            var mapZone = layoutMgr.getMapZone();
            var mapInnerZone = layoutMgr.getMapInnerZone();
            var footerZone = layoutMgr.getFooterZone();
            var footerColumns = layoutMgr.getFooterColumns();
            var titleBlockRows = layoutMgr.getTitleBlockRows();
            var navLogoRows = layoutMgr.getNavLogoRows();

            bar.style.width = "20%";
            text.textContent = "Drawing map zone...";

            // ============== MAP ZONE ==============
            
            // Step 13) Draw map zone border
            drawCellBorder(pdf, mapZone.x, mapZone.y, mapZone.width, mapZone.height, 0.3);

            // Step 14) Calculate WYSIWYG coordinate transformation
            var canvas = context.canvas;
            var screenBoundary = getPrintBoundary(canvas);
            if (!screenBoundary) {
                throw new Error("Print Preview Mode must be active");
            }

            // Use explicit inner boundary from getPrintBoundary (matches preview exactly)
            var innerBoundary = {
                x: screenBoundary.innerX !== undefined ? screenBoundary.innerX : screenBoundary.x + screenBoundary.width * screenBoundary.marginPercent,
                y: screenBoundary.innerY !== undefined ? screenBoundary.innerY : screenBoundary.y + screenBoundary.height * screenBoundary.marginPercent,
                width: screenBoundary.innerWidth !== undefined ? screenBoundary.innerWidth : screenBoundary.width * (1 - 2 * screenBoundary.marginPercent),
                height: screenBoundary.innerHeight !== undefined ? screenBoundary.innerHeight : screenBoundary.height * (1 - 2 * screenBoundary.marginPercent)
            };

            // Convert screen to world coordinates
            var world_x1 = (innerBoundary.x - canvas.width / 2) / context.currentScale + context.centroidX;
            var world_y1 = -(innerBoundary.y + innerBoundary.height - canvas.height / 2) / context.currentScale + context.centroidY;
            var world_x2 = (innerBoundary.x + innerBoundary.width - canvas.width / 2) / context.currentScale + context.centroidX;
            var world_y2 = -(innerBoundary.y - canvas.height / 2) / context.currentScale + context.centroidY;

            var minX = Math.min(world_x1, world_x2);
            var maxX = Math.max(world_x1, world_x2);
            var minY = Math.min(world_y1, world_y2);
            var maxY = Math.max(world_y1, world_y2);

            var dataWidth = maxX - minX;
            var dataHeight = maxY - minY;
            if (dataWidth <= 0 || dataHeight <= 0) {
                throw new Error("Invalid data dimensions");
            }

            // Calculate scale to fit in map inner zone
            var scaleX = mapInnerZone.width / dataWidth;
            var scaleY = mapInnerZone.height / dataHeight;
            var printScale = Math.min(scaleX, scaleY);

            var scaledWidth = dataWidth * printScale;
            var scaledHeight = dataHeight * printScale;
            var offsetX = mapInnerZone.x + (mapInnerZone.width - scaledWidth) / 2;
            var offsetY = mapInnerZone.y + (mapInnerZone.height - scaledHeight) / 2;

            var printCentroidX = minX + dataWidth / 2;
            var printCentroidY = minY + dataHeight / 2;

            // Step 15) World to PDF transformation function
            function worldToPDF(worldX, worldY) {
                var centerX = offsetX + scaledWidth / 2;
                var centerY = offsetY + scaledHeight / 2;
                var x = (worldX - printCentroidX) * printScale + centerX;
                var y = -(worldY - printCentroidY) * printScale + centerY;
                return [x, y];
            }

            bar.style.width = "30%";
            text.textContent = "Drawing background images...";

            // Step 16) Render background images as raster layer
            if (loadedImages && loadedImages.size > 0) {
                var dpi = 150; // Lower DPI for images to keep file size reasonable
                var mmToPx = dpi / 25.4;
                var imgCanvas = document.createElement("canvas");
                imgCanvas.width = mapZone.width * mmToPx;
                imgCanvas.height = mapZone.height * mmToPx;
                var imgCtx = imgCanvas.getContext("2d");
                imgCtx.fillStyle = "white";
                imgCtx.fillRect(0, 0, imgCanvas.width, imgCanvas.height);

                loadedImages.forEach(function(image) {
                    if (image.visible === false || !image.canvas) return;
                    var bbox = image.bbox;
                    if (bbox && bbox.length >= 4) {
                        var coords1 = worldToPDF(bbox[0], bbox[3]);
                        var coords2 = worldToPDF(bbox[2], bbox[1]);
                        var px1 = (coords1[0] - mapZone.x) * mmToPx;
                        var py1 = (coords1[1] - mapZone.y) * mmToPx;
                        var px2 = (coords2[0] - mapZone.x) * mmToPx;
                        var py2 = (coords2[1] - mapZone.y) * mmToPx;
                        var width = Math.abs(px2 - px1);
                        var height = Math.abs(py2 - py1);

                        imgCtx.save();
                        imgCtx.globalAlpha = image.transparency !== undefined ? image.transparency : 1.0;
                        imgCtx.drawImage(image.canvas, Math.min(px1, px2), Math.min(py1, py2), width, height);
                        imgCtx.restore();
                    }
                });

                try {
                    var imgData = imgCanvas.toDataURL("image/png", 0.9);
                    if (imgData && imgData.length > 100) {
                        pdf.addImage(imgData, "PNG", mapZone.x, mapZone.y, mapZone.width, mapZone.height);
                    }
                } catch (e) {
                    console.warn("Failed to add background images:", e);
                }
            }

            bar.style.width = "40%";
            text.textContent = "Drawing surfaces...";

            // Step 17) Draw surfaces as vector triangles
            if (loadedSurfaces && loadedSurfaces.size > 0) {
                var allMinZ = Infinity;
                var allMaxZ = -Infinity;

                loadedSurfaces.forEach(function(surface) {
                    if (surface.visible === false || surface.isTexturedMesh) return;
                    if (surface.points && surface.points.length > 0) {
                        surface.points.forEach(function(point) {
                            if (point.z < allMinZ) allMinZ = point.z;
                            if (point.z > allMaxZ) allMaxZ = point.z;
                        });
                    }
                });

                if (allMinZ !== Infinity && allMaxZ !== -Infinity) {
                    loadedSurfaces.forEach(function(surface) {
                        if (surface.visible === false || surface.isTexturedMesh) return;
                        if (surface.triangles && surface.triangles.length > 0) {
                            surface.triangles.forEach(function(triangle) {
                                var v1 = triangle.vertices[0];
                                var v2 = triangle.vertices[1];
                                var v3 = triangle.vertices[2];

                                var c1 = worldToPDF(v1.x, v1.y);
                                var c2 = worldToPDF(v2.x, v2.y);
                                var c3 = worldToPDF(v3.x, v3.y);

                                var avgZ = (v1.z + v2.z + v3.z) / 3;
                                var color = "#888888";
                                if (context.elevationToColor && allMaxZ > allMinZ) {
                                    color = context.elevationToColor(avgZ, allMinZ, allMaxZ);
                                }

                                var rgb = rgbaToRgb(color);
                                pdf.setFillColor(rgb.r, rgb.g, rgb.b);
                                pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
                                pdf.setLineWidth(0.05);
                                pdf.triangle(c1[0], c1[1], c2[0], c2[1], c3[0], c3[1], "FD");
                            });
                        }
                    });
                }
            }

            bar.style.width = "50%";
            text.textContent = "Drawing KAD entities...";

            // Step 18) Draw KAD entities as vectors
            if (allKADDrawingsMap && allKADDrawingsMap.size > 0) {
                allKADDrawingsMap.forEach(function(entity, name) {
                    if (entity.visible === false) return;

                    if (entity.entityType === "point") {
                        var simplifiedPoints = simplifyByPxDist ? simplifyByPxDist(entity.data, 3) : entity.data;
                        simplifiedPoints.forEach(function(point) {
                            var coords = worldToPDF(point.pointXLocation, point.pointYLocation);
                            var rgb = hexToRgb(point.color || "#000000");
                            pdf.setFillColor(rgb.r, rgb.g, rgb.b);
                            pdf.circle(coords[0], coords[1], 0.3, "F");
                        });
                    } else if (entity.entityType === "circle") {
                        entity.data.forEach(function(circle) {
                            var coords = worldToPDF(circle.pointXLocation, circle.pointYLocation);
                            var radiusMM = circle.radius * printScale;
                            var rgb = hexToRgb(circle.color || "#000000");
                            pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
                            pdf.setLineWidth((circle.lineWidth || 1) * 0.1);
                            pdf.circle(coords[0], coords[1], radiusMM, "S");
                        });
                    } else if (entity.entityType === "text") {
                        entity.data.forEach(function(textData) {
                            if (textData && textData.text) {
                                var coords = worldToPDF(textData.pointXLocation, textData.pointYLocation);
                                var rgb = hexToRgb(textData.color || "#000000");
                                pdf.setTextColor(rgb.r, rgb.g, rgb.b);
                                pdf.setFontSize(8);
                                pdf.text(String(textData.text), coords[0], coords[1]);
                            }
                        });
                    } else if (entity.entityType === "line" || entity.entityType === "poly") {
                        var points = entity.data;
                        if (points.length >= 2) {
                            var rgb = hexToRgb(points[0].color || "#000000");
                            pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
                            pdf.setLineWidth((points[0].lineWidth || 1) * 0.1);

                            for (var i = 0; i < points.length - 1; i++) {
                                var c1 = worldToPDF(points[i].pointXLocation, points[i].pointYLocation);
                                var c2 = worldToPDF(points[i + 1].pointXLocation, points[i + 1].pointYLocation);
                                pdf.line(c1[0], c1[1], c2[0], c2[1]);
                            }

                            if (entity.entityType === "poly" && points.length > 2) {
                                var cLast = worldToPDF(points[points.length - 1].pointXLocation, points[points.length - 1].pointYLocation);
                                var cFirst = worldToPDF(points[0].pointXLocation, points[0].pointYLocation);
                                pdf.line(cLast[0], cLast[1], cFirst[0], cFirst[1]);
                            }
                        }
                    }
                });
            }

            bar.style.width = "60%";
            text.textContent = "Drawing blast holes...";

            // Step 19) Draw blast holes as vectors
            var visibleBlastHoles = allBlastHoles ? allBlastHoles.filter(function(hole) { return hole.visible !== false; }) : [];
            var displayOptions = getDisplayOptions ? getDisplayOptions() : {};

            var toeSizeInMeters = parseFloat(document.getElementById("toeSlider")?.value || 3);
            var printHoleScale = parseFloat(document.getElementById("holeSize")?.value || 3);

            visibleBlastHoles.forEach(function(hole) {
                var collarCoords = worldToPDF(hole.startXLocation, hole.startYLocation);
                var gradeCoords = worldToPDF(hole.gradeXLocation, hole.gradeYLocation);
                var toeCoords = worldToPDF(hole.endXLocation, hole.endYLocation);

                // Draw collar-to-toe track if angled
                if (hole.holeAngle > 0) {
                    pdf.setLineWidth(0.1);
                    if (hole.subdrillAmount < 0) {
                        pdf.setDrawColor(0, 0, 0);
                        pdf.line(collarCoords[0], collarCoords[1], toeCoords[0], toeCoords[1]);
                        pdf.setDrawColor(255, 200, 200);
                        pdf.line(toeCoords[0], toeCoords[1], gradeCoords[0], gradeCoords[1]);
                    } else {
                        pdf.setDrawColor(0, 0, 0);
                        pdf.line(collarCoords[0], collarCoords[1], gradeCoords[0], gradeCoords[1]);
                        pdf.setDrawColor(255, 0, 0);
                        pdf.line(gradeCoords[0], gradeCoords[1], toeCoords[0], toeCoords[1]);
                    }
                }

                // Draw toe
                if (parseFloat(hole.holeLengthCalculated).toFixed(1) != "0.0") {
                    var toeRadius = toeSizeInMeters * printScale;
                    pdf.setFillColor(255, 255, 255);
                    pdf.setDrawColor(0, 0, 0);
                    pdf.setLineWidth(0.1);
                    pdf.circle(toeCoords[0], toeCoords[1], toeRadius, "FD");
                }

                // Draw collar
                var holeRadius = (hole.holeDiameter / 1000 / 2) * printHoleScale * printScale * 0.14;
                holeRadius = Math.max(holeRadius, 0.5); // Minimum radius
                pdf.setFillColor(0, 0, 0);
                pdf.setDrawColor(0, 0, 0);
                pdf.circle(collarCoords[0], collarCoords[1], holeRadius, "F");

                // Draw labels
                var textOffset = holeRadius * 2.5;
                var fontSize = 6;
                pdf.setFontSize(fontSize);
                pdf.setFont("helvetica", "normal");

                if (displayOptions.holeID) {
                    pdf.setTextColor(0, 0, 0); // Black
                    pdf.text(hole.holeID, collarCoords[0] + textOffset, collarCoords[1] - textOffset);
                }
                if (displayOptions.holeDia) {
                    pdf.setTextColor(0, 128, 0); // Green (rgb(0, 50, 0) was too dark, use rgb(0, 128, 0))
                    pdf.text(parseFloat(hole.holeDiameter).toFixed(0), collarCoords[0] + textOffset, collarCoords[1]);
                }
                if (displayOptions.holeLen) {
                    pdf.setTextColor(0, 0, 255); // Blue (rgb(0, 0, 67) was too dark, use rgb(0, 0, 255))
                    pdf.text(parseFloat(hole.holeLengthCalculated).toFixed(1), collarCoords[0] + textOffset, collarCoords[1] + textOffset);
                }
                if (displayOptions.holeAng) {
                    pdf.setTextColor(128, 64, 0); // Brown/Orange (rgb(67, 30, 0) was too dark, use rgb(128, 64, 0))
                    pdf.text(parseFloat(hole.holeAngle).toFixed(0) + "deg", collarCoords[0] - textOffset, collarCoords[1] - textOffset, { align: "right" });
                }
                if (displayOptions.holeBea) {
                    pdf.setTextColor(255, 0, 0); // Red
                    pdf.text(parseFloat(hole.holeBearing).toFixed(1) + "deg", toeCoords[0] - textOffset, toeCoords[1] + textOffset, { align: "right" });
                }
            });

            bar.style.width = "65%";
            text.textContent = "Drawing connectors...";

            // Step 19a) Draw connectors (arrows between holes)
            if (displayOptions.connector) {
                var connScale = parseFloat(document.getElementById("connSlider")?.value || 17);
                var holeMap = new Map();
                visibleBlastHoles.forEach(function(hole) {
                    var key = hole.entityName + ":::" + hole.holeID;
                    holeMap.set(key, hole);
                });

                visibleBlastHoles.forEach(function(hole) {
                    if (hole.fromHoleID) {
                        try {
                            var parts = hole.fromHoleID.split(":::");
                            if (parts.length === 2) {
                                var fromKey = parts[0] + ":::" + parts[1];
                                var fromHole = holeMap.get(fromKey);
                                if (fromHole) {
                                    var startCoords = worldToPDF(fromHole.startXLocation, fromHole.startYLocation);
                                    var endCoords = worldToPDF(hole.startXLocation, hole.startYLocation);
                                    var connColor = hole.colorHexDecimal || "#000000";
                                    var curve = hole.connectorCurve || 0;
                                    
                                    // Convert color to RGB
                                    var rgb = hexToRgb(connColor);
                                    pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
                                    pdf.setFillColor(rgb.r, rgb.g, rgb.b);
                                    
                                    // Calculate arrow size based on scale
                                    var arrowLength = (connScale / 4) * printScale * 2;
                                    var arrowWidth = (connScale / 4) * printScale;
                                    
                                    if (curve === 0) {
                                        // Straight connector
                                        pdf.setLineWidth(0.2);
                                        pdf.line(startCoords[0], startCoords[1], endCoords[0], endCoords[1]);
                                        
                                        // Draw arrowhead - angle from start TO end (direction arrow points)
                                        var angle = Math.atan2(endCoords[1] - startCoords[1], endCoords[0] - startCoords[0]);
                                        var arrowX1 = endCoords[0] - arrowLength * Math.cos(angle - Math.PI / 6);
                                        var arrowY1 = endCoords[1] - arrowLength * Math.sin(angle - Math.PI / 6);
                                        var arrowX2 = endCoords[0] - arrowLength * Math.cos(angle + Math.PI / 6);
                                        var arrowY2 = endCoords[1] - arrowLength * Math.sin(angle + Math.PI / 6);
                                        
                                        pdf.triangle(endCoords[0], endCoords[1], arrowX1, arrowY1, arrowX2, arrowY2, "F");
                                    } else {
                                        // Curved connector using quadratic bezier
                                        var midX = (startCoords[0] + endCoords[0]) / 2;
                                        var midY = (startCoords[1] + endCoords[1]) / 2;
                                        var dx = endCoords[0] - startCoords[0];
                                        var dy = endCoords[1] - startCoords[1];
                                        var distance = Math.sqrt(dx * dx + dy * dy);
                                        
                                        var curveFactor = (curve / 90) * distance * 0.5;
                                        var perpX = -dy / distance;
                                        var perpY = dx / distance;
                                        var controlX = midX + perpX * curveFactor;
                                        var controlY = midY + perpY * curveFactor;
                                        
                                        // Draw curved path (jsPDF doesn't support bezier directly, so approximate with line segments)
                                        var segments = 20;
                                        pdf.setLineWidth(0.2);
                                        var prevX = startCoords[0];
                                        var prevY = startCoords[1];
                                        for (var s = 1; s <= segments; s++) {
                                            var t = s / segments;
                                            var x = (1 - t) * (1 - t) * startCoords[0] + 2 * (1 - t) * t * controlX + t * t * endCoords[0];
                                            var y = (1 - t) * (1 - t) * startCoords[1] + 2 * (1 - t) * t * controlY + t * t * endCoords[1];
                                            if (s === 1) {
                                                pdf.line(prevX, prevY, x, y);
                                            } else {
                                                pdf.line(prevX, prevY, x, y);
                                            }
                                            prevX = x;
                                            prevY = y;
                                        }
                                        
                                        // Draw arrowhead at end
                                        var tangentX = 2 * (endCoords[0] - controlX);
                                        var tangentY = 2 * (endCoords[1] - controlY);
                                        var angle = Math.atan2(tangentY, tangentX);
                                        var arrowX1 = endCoords[0] - arrowLength * Math.cos(angle - Math.PI / 6);
                                        var arrowY1 = endCoords[1] - arrowLength * Math.sin(angle - Math.PI / 6);
                                        var arrowX2 = endCoords[0] - arrowLength * Math.cos(angle + Math.PI / 6);
                                        var arrowY2 = endCoords[1] - arrowLength * Math.sin(angle + Math.PI / 6);
                                        
                                        pdf.triangle(endCoords[0], endCoords[1], arrowX1, arrowY1, arrowX2, arrowY2, "F");
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn("Failed to draw connector:", e);
                        }
                    }
                });
            }

            bar.style.width = "70%";
            text.textContent = "Drawing contour lines...";

            // Step 19b) Draw contour lines
            if (displayOptions.contour && context.contourLinesArray) {
                pdf.setDrawColor(255, 0, 255); // Magenta
                pdf.setLineWidth(0.3);
                
                for (var c = 0; c < context.contourLinesArray.length; c++) {
                    var contourLines = context.contourLinesArray[c];
                    if (contourLines && Array.isArray(contourLines)) {
                        for (var l = 0; l < contourLines.length; l++) {
                            var line = contourLines[l];
                            if (line && line.length >= 2) {
                                var startPt = line[0];
                                var endPt = line[1];
                                if (startPt && endPt) {
                                    var startCoords = worldToPDF(startPt.x !== undefined ? startPt.x : startPt[0], startPt.y !== undefined ? startPt.y : startPt[1]);
                                    var endCoords = worldToPDF(endPt.x !== undefined ? endPt.x : endPt[0], endPt.y !== undefined ? endPt.y : endPt[1]);
                                    pdf.line(startCoords[0], startCoords[1], endCoords[0], endCoords[1]);
                                }
                            }
                        }
                    }
                }
            }

            bar.style.width = "75%";
            text.textContent = "Drawing footer...";

            // ============== FOOTER ZONE ==============

            // Step 20) Draw footer zone border
            drawCellBorder(pdf, footerZone.x, footerZone.y, footerZone.width, footerZone.height, 0.3);

            // Step 21) Draw footer column borders
            for (var c = 0; c < footerColumns.length; c++) {
                var col = footerColumns[c];
                drawCellBorder(pdf, col.x, col.y, col.width, col.height, 0.2);
            }

            // Step 22) Draw title block row borders
            for (var r = 0; r < titleBlockRows.length; r++) {
                var row = titleBlockRows[r];
                drawCellBorder(pdf, row.x, row.y, row.width, row.height, 0.2);
            }

            // Step 23) Draw nav/logo row borders (portrait mode)
            if (navLogoRows) {
                for (var n = 0; n < navLogoRows.length; n++) {
                    var navRow = navLogoRows[n];
                    drawCellBorder(pdf, navRow.x, navRow.y, navRow.width, navRow.height, 0.2);
                }
            }

            // Step 24) Render navigation indicator (North Arrow or XYZ Gizmo)
            var navCell = layoutMgr.getNavIndicatorCell();
            if (navCell) {
                try {
                    var navImageDataURL = null;
                    if (mode === "2D") {
                        navImageDataURL = PrintCaptureManager.captureNorthArrow(context);
                    } else {
                        navImageDataURL = PrintCaptureManager.captureXYZGizmo(context);
                    }
                    
                    if (navImageDataURL) {
                        // Use 60% of cell size to prevent cutting off
                        var navSize = Math.min(navCell.width, navCell.height) * 0.6;
                        var navX = navCell.x + (navCell.width - navSize) / 2;
                        var navY = navCell.y + (navCell.height - navSize) / 2;
                        pdf.addImage(navImageDataURL, "PNG", navX, navY, navSize, navSize);
                    } else {
                        // Fallback text
                        drawCenteredText(pdf, mode === "2D" ? "N" : "XYZ", navCell.x, navCell.y, navCell.width, navCell.height, 14, true);
                    }
                } catch (e) {
                    console.warn("Failed to render navigation indicator:", e);
                    drawCenteredText(pdf, mode === "2D" ? "N" : "XYZ", navCell.x, navCell.y, navCell.width, navCell.height, 14, true);
                }
            }

            // Step 25) Render Connector Count (delay timing groups)
            var connectorCell = layoutMgr.getConnectorCountCell();
            if (connectorCell && allBlastHoles && allBlastHoles.length > 0 && getVoronoiMetrics) {
                try {
                    var stats = getBlastStatisticsPerEntity(allBlastHoles, getVoronoiMetrics);
                    var entityNames = Object.keys(stats);
                    
                    // Draw header
                    pdf.setFontSize(9);
                    pdf.setFont("helvetica", "bold");
                    pdf.setTextColor(0, 0, 0);
                    pdf.text("CONNECTOR COUNT", connectorCell.x + connectorCell.width / 2, connectorCell.y + 4, { align: "center" });
                    
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
                                pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
                                pdf.rect(connectorCell.x + padding, rowY, connectorCell.width - padding * 2, rowHeight, "F");
                                
                                // Draw text
                                var delayText = delay === "Unknown" ? "Unk" : delay + "ms";
                                var txtRgb = hexToRgb(txtColor);
                                pdf.setTextColor(txtRgb.r, txtRgb.g, txtRgb.b);
                                pdf.setFontSize(7);
                                pdf.setFont("helvetica", "normal");
                                pdf.text(delayText + ": " + group.count, connectorCell.x + padding + 1, rowY + 2.5);
                                
                                rowY += rowHeight + 0.5;
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Failed to render connector count:", e);
                    drawCenteredText(pdf, "CONNECTOR\nCOUNT", connectorCell.x, connectorCell.y, connectorCell.width, connectorCell.height, 7, true);
                }
            } else {
                drawCenteredText(pdf, "CONNECTOR\nCOUNT", connectorCell.x, connectorCell.y, connectorCell.width, connectorCell.height, 7, true);
            }

            // Step 26) Render Blast Statistics
            var statsCell = layoutMgr.getBlastStatisticsCell();
            if (statsCell && allBlastHoles && allBlastHoles.length > 0 && getVoronoiMetrics) {
                try {
                    var blastStats = getBlastStatisticsPerEntity(allBlastHoles, getVoronoiMetrics);
                    var entityKeys = Object.keys(blastStats);
                    
                    // Draw header
                    pdf.setFontSize(9);
                    pdf.setFont("helvetica", "bold");
                    pdf.setTextColor(0, 0, 0);
                    pdf.text("BLAST STATISTICS", statsCell.x + statsCell.width / 2, statsCell.y + 4, { align: "center" });
                    
                    // Draw statistics
                    var statY = statsCell.y + 9;
                    var lineHeight = 3;
                    pdf.setFontSize(7);
                    pdf.setFont("helvetica", "normal");
                    
                    for (var ek = 0; ek < entityKeys.length && statY < statsCell.y + statsCell.height - 3; ek++) {
                        var es = blastStats[entityKeys[ek]];
                        if (es) {
                            pdf.text("Holes: " + es.holeCount, statsCell.x + 2, statY);
                            statY += lineHeight;
                            if (statY < statsCell.y + statsCell.height - 3) {
                                pdf.text("Burden: " + es.burden.toFixed(2) + "m", statsCell.x + 2, statY);
                                statY += lineHeight;
                            }
                            if (statY < statsCell.y + statsCell.height - 3) {
                                pdf.text("Spacing: " + es.spacing.toFixed(2) + "m", statsCell.x + 2, statY);
                                statY += lineHeight;
                            }
                            if (statY < statsCell.y + statsCell.height - 3) {
                                pdf.text("Drill: " + es.drillMetres.toFixed(1) + "m", statsCell.x + 2, statY);
                                statY += lineHeight;
                            }
                            if (statY < statsCell.y + statsCell.height - 3) {
                                pdf.text("Volume: " + es.volume.toFixed(0) + "m3", statsCell.x + 2, statY);
                                statY += lineHeight;
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Failed to render blast statistics:", e);
                    drawCenteredText(pdf, "BLAST\nSTATISTICS", statsCell.x, statsCell.y, statsCell.width, statsCell.height, 7, true);
                }
            } else {
                drawCenteredText(pdf, "BLAST\nSTATISTICS", statsCell.x, statsCell.y, statsCell.width, statsCell.height, 7, true);
            }

            // Step 27) Render Logo and URL
            var logoCell = layoutMgr.getLogoCell();
            if (logoCell) {
                if (qrCodeDataURL) {
                    try {
                        var qrSize = Math.min(logoCell.width, logoCell.height) * 0.6;
                        var qrX = logoCell.x + (logoCell.width - qrSize) / 2;
                        var qrY = logoCell.y + (logoCell.height - qrSize) / 2 - 2;
                        pdf.addImage(qrCodeDataURL, "PNG", qrX, qrY, qrSize, qrSize);
                        
                        // URL below QR
                        pdf.setFontSize(5);
                        pdf.setFont("helvetica", "normal");
                        pdf.setTextColor(0, 0, 0);
                        pdf.text("blastingapps.com", logoCell.x + logoCell.width / 2, logoCell.y + logoCell.height - 2, { align: "center" });
                    } catch (e) {
                        console.warn("Failed to render QR code:", e);
                        drawMultilineText(pdf, ["[QR]", "blastingapps.com"], logoCell.x, logoCell.y, logoCell.width, logoCell.height, 6);
                    }
                } else {
                    drawMultilineText(pdf, ["[QR]", "blastingapps.com"], logoCell.x, logoCell.y, logoCell.width, logoCell.height, 6);
                }
            }

            // Step 28) Render Title and Blast Name
            var titleRow = layoutMgr.getTitleCell();
            if (titleRow) {
                // Get blast names
                var blastNames = new Set();
                if (allBlastHoles && allBlastHoles.length > 0) {
                    allBlastHoles.forEach(function(hole) {
                        if (hole.entityName) {
                            blastNames.add(hole.entityName);
                        }
                    });
                }
                var blastNameList = Array.from(blastNames).join(", ");
                var displayBlastName = blastNameList || userInput.blastName || "Untitled Blast";
                
                pdf.setFontSize(10);
                pdf.setFont("helvetica", "bold");
                pdf.setTextColor(0, 0, 0);
                pdf.text("TITLE", titleRow.x + 2, titleRow.y + titleRow.height * 0.35);
                pdf.setFontSize(8);
                pdf.setFont("helvetica", "normal");
                pdf.text("[" + displayBlastName + "]", titleRow.x + 2, titleRow.y + titleRow.height * 0.7);
            }

            // Step 29) Render Date and Time
            var dateRow = layoutMgr.getDateCell();
            if (dateRow) {
                var now = new Date();
                var dateStr = now.toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
                var timeStr = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
                
                pdf.setFontSize(8);
                pdf.setFont("helvetica", "bold");
                pdf.setTextColor(0, 0, 0);
                pdf.text("DATE", dateRow.x + 2, dateRow.y + dateRow.height * 0.35);
                pdf.setFontSize(7);
                pdf.setFont("helvetica", "normal");
                pdf.text("[" + dateStr + " " + timeStr + "]", dateRow.x + 2, dateRow.y + dateRow.height * 0.7);
            }

            // Step 30) Render Scale and Designer
            var scaleDesignerRow = layoutMgr.getScaleDesignerCell();
            if (scaleDesignerRow) {
                var scaleRatio = layoutMgr.calculateScaleRatio(printScale);
                var designerName = userInput.designer || "";
                
                pdf.setFontSize(8);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(0, 0, 0);
                
                // Scale in top half
                pdf.text("Scale:", scaleDesignerRow.x + 2, scaleDesignerRow.y + scaleDesignerRow.height * 0.25);
                pdf.text("[" + scaleRatio + "]", scaleDesignerRow.x + 15, scaleDesignerRow.y + scaleDesignerRow.height * 0.25);
                
                // Designer in bottom half
                pdf.text("Designer:", scaleDesignerRow.x + 2, scaleDesignerRow.y + scaleDesignerRow.height * 0.65);
                pdf.text("[" + designerName + "]", scaleDesignerRow.x + 18, scaleDesignerRow.y + scaleDesignerRow.height * 0.65);
            }

            bar.style.width = "95%";
            text.textContent = "Finalizing...";

            // Step 31) Add version footer
            if (buildVersion) {
                pdf.setFontSize(5);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(128, 128, 128);
                pdf.text("Kirra v" + buildVersion, pageWidth - 2, pageHeight - 2, { align: "right" });
            }

            bar.style.width = "100%";
            text.textContent = "Complete!";

            // Step 32) Save PDF
            var fileName = "kirra-blast-" + mode + "-" + new Date().toISOString().split("T")[0] + ".pdf";
            pdf.save(fileName);

            setTimeout(function() {
                progressDialog.close();
                showModalMessage("Success", "Vector PDF created successfully!", "success");
            }, 300);

        } catch (error) {
            progressDialog.close();
            console.error("Vector PDF Generation Error:", error);
            showModalMessage("PDF Creation Failed", "Error: " + error.message, "error");
        }
    }, 500); // Wait for QR code to load
}

