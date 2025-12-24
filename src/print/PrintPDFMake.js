//=================================================
// PrintPDFMake.js - PDF Generation using jsPDF
//=================================================
// Simple, reliable PDF generation using jsPDF

import { jsPDF } from "jspdf";

// Step 2) Render map area (vector graphics) to canvas/image
// Returns: { canvas, printScale } - canvas with rendered graphics and the scale used
function renderMapToCanvas(context, widthMM, heightMM) {
    const dpi = 300;
    const mmToPx = dpi / 25.4;
    const widthPx = widthMM * mmToPx;
    const heightPx = heightMM * mmToPx;

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");

    // Fill white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, widthPx, heightPx);

    // Get print boundary for WYSIWYG
    const screenBoundary = getPrintBoundary(context.canvas);
    if (!screenBoundary) {
        throw new Error("Print Preview Mode must be active");
    }

    // Calculate inner boundary (print-safe area)
    const innerMargin = screenBoundary.width * screenBoundary.marginPercent;
    const innerBoundary = {
        x: screenBoundary.x + innerMargin,
        y: screenBoundary.y + innerMargin,
        width: screenBoundary.width - innerMargin * 2,
        height: screenBoundary.height - innerMargin * 2
    };

    // Convert to world coordinates
    const world_x1 = (innerBoundary.x - context.canvas.width / 2) / context.currentScale + context.centroidX;
    const world_y1 = -(innerBoundary.y + innerBoundary.height - context.canvas.height / 2) / context.currentScale + context.centroidY;
    const world_x2 = (innerBoundary.x + innerBoundary.width - context.canvas.width / 2) / context.currentScale + context.centroidX;
    const world_y2 = -(innerBoundary.y - context.canvas.height / 2) / context.currentScale + context.centroidY;

    const minX = Math.min(world_x1, world_x2);
    const maxX = Math.max(world_x1, world_x2);
    const minY = Math.min(world_y1, world_y2);
    const maxY = Math.max(world_y1, world_y2);

    // Calculate scale
    const dataWidth = maxX - minX;
    const dataHeight = maxY - minY;
    if (dataWidth <= 0 || dataHeight <= 0) {
        throw new Error("Invalid data dimensions");
    }

    const scaleX = widthPx / dataWidth;
    const scaleY = heightPx / dataHeight;
    const printScale = Math.min(scaleX, scaleY);

    const scaledWidth = dataWidth * printScale;
    const scaledHeight = dataHeight * printScale;
    const offsetX = (widthPx - scaledWidth) / 2;
    const offsetY = (heightPx - scaledHeight) / 2;

    const printCentroidX = minX + dataWidth / 2;
    const printCentroidY = minY + dataHeight / 2;

    // World to canvas transformation
    function worldToCanvas(worldX, worldY) {
        const centerX = offsetX + scaledWidth / 2;
        const centerY = offsetY + scaledHeight / 2;
        const x = (worldX - printCentroidX) * printScale + centerX;
        const y = -(worldY - printCentroidY) * printScale + centerY;
        return [x, y];
    }

    // Render background images
    if (context.loadedImages && context.loadedImages.size > 0) {
        context.loadedImages.forEach(function (image) {
            if (image.visible === false || !image.canvas) return;
            const bbox = image.bbox;
            if (bbox && bbox.length >= 4) {
                const [x1, y1] = worldToCanvas(bbox[0], bbox[3]);
                const [x2, y2] = worldToCanvas(bbox[2], bbox[1]);
                const width = Math.abs(x2 - x1);
                const height = Math.abs(y2 - y1);

                ctx.save();
                ctx.globalAlpha = image.transparency !== undefined ? image.transparency : 1.0;
                ctx.drawImage(image.canvas, Math.min(x1, x2), Math.min(y1, y2), width, height);
                ctx.restore();
            }
        });
    }

    // Render surfaces
    if (context.loadedSurfaces && context.loadedSurfaces.size > 0) {
        // Calculate global Z range
        let allMinZ = Infinity;
        let allMaxZ = -Infinity;
        for (const [surfaceId, surface] of context.loadedSurfaces.entries()) {
            if (surface.visible === false || surface.isTexturedMesh) continue;
            if (surface.points && surface.points.length > 0) {
                surface.points.forEach(function (point) {
                    if (point.z < allMinZ) allMinZ = point.z;
                    if (point.z > allMaxZ) allMaxZ = point.z;
                });
            }
        }

        // Draw triangles
        for (const [surfaceId, surface] of context.loadedSurfaces.entries()) {
            if (surface.visible === false || surface.isTexturedMesh) continue;
            if (surface.triangles && surface.triangles.length > 0) {
                surface.triangles.forEach(function (triangle) {
                    const v1 = triangle.vertices[0];
                    const v2 = triangle.vertices[1];
                    const v3 = triangle.vertices[2];

                    const [x1, y1] = worldToCanvas(v1.x, v1.y);
                    const [x2, y2] = worldToCanvas(v2.x, v2.y);
                    const [x3, y3] = worldToCanvas(v3.x, v3.y);

                    const avgZ = (v1.z + v2.z + v3.z) / 3;
                    let color = "#888888";
                    if (context.elevationToColor && allMaxZ > allMinZ) {
                        color = context.elevationToColor(avgZ, allMinZ, allMaxZ);
                    }

                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.lineTo(x3, y3);
                    ctx.closePath();
                    ctx.fill();
                });
            }
        }
    }

    // Render KAD entities
    if (context.allKADDrawingsMap && context.allKADDrawingsMap.size > 0) {
        for (const [name, entity] of context.allKADDrawingsMap.entries()) {
            if (entity.visible === false) continue;

            if (entity.entityType === "point") {
                const simplifiedPoints = context.simplifyByPxDist ? context.simplifyByPxDist(entity.data, 3) : entity.data;
                simplifiedPoints.forEach(function (point) {
                    const [x, y] = worldToCanvas(point.pointXLocation, point.pointYLocation);
                    ctx.fillStyle = point.color || "#000000";
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, 2 * Math.PI);
                    ctx.fill();
                });
            } else if (entity.entityType === "circle") {
                entity.data.forEach(function (circle) {
                    const [x, y] = worldToCanvas(circle.pointXLocation, circle.pointYLocation);
                    const radiusPx = circle.radius * printScale;
                    ctx.strokeStyle = circle.color || "#000000";
                    ctx.lineWidth = (circle.lineWidth || 1) * printScale * 0.1;
                    ctx.beginPath();
                    ctx.arc(x, y, radiusPx, 0, 2 * Math.PI);
                    ctx.stroke();
                });
            } else if (entity.entityType === "text") {
                entity.data.forEach(function (textData) {
                    if (textData && textData.text) {
                        const [x, y] = worldToCanvas(textData.pointXLocation, textData.pointYLocation);
                        ctx.fillStyle = textData.color || "#000000";
                        ctx.font = (8 * printScale) + "px Arial";
                        ctx.fillText(textData.text, x, y);
                    }
                });
            } else if (entity.entityType === "line" || entity.entityType === "poly") {
                const points = entity.data;
                if (points.length >= 2) {
                    ctx.strokeStyle = points[0].color || "#000000";
                    ctx.lineWidth = (points[0].lineWidth || 1) * printScale * 0.1;
                    ctx.beginPath();
                    for (let i = 0; i < points.length - 1; i++) {
                        const [x1, y1] = worldToCanvas(points[i].pointXLocation, points[i].pointYLocation);
                        const [x2, y2] = worldToCanvas(points[i + 1].pointXLocation, points[i + 1].pointYLocation);
                        if (i === 0) ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                    }
                    if (entity.entityType === "poly" && points.length > 2) {
                        const [x1, y1] = worldToCanvas(points[points.length - 1].pointXLocation, points[points.length - 1].pointYLocation);
                        const [x2, y2] = worldToCanvas(points[0].pointXLocation, points[0].pointYLocation);
                        ctx.lineTo(x2, y2);
                    }
                    ctx.stroke();
                }
            }
        }
    }

    // Render blast holes
    const visibleBlastHoles = context.allBlastHoles ? context.allBlastHoles.filter(function (hole) { return hole.visible !== false; }) : [];
    const displayOptions = context.getDisplayOptions ? context.getDisplayOptions() : {};
    const toeSizeInMeters = parseFloat(document.getElementById("toeSlider")?.value || 3);
    const printHoleScale = parseFloat(document.getElementById("holeSize")?.value || 3);

    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#000000";
    ctx.font = (7 * printScale) + "px Arial";

    visibleBlastHoles.forEach(function (hole) {
        const [x, y] = worldToCanvas(hole.startXLocation, hole.startYLocation);
        const [gradeX, gradeY] = worldToCanvas(hole.gradeXLocation, hole.gradeYLocation);
        const [lineEndX, lineEndY] = worldToCanvas(hole.endXLocation, hole.endYLocation);

        // Draw collar-to-toe track if angled
        if (hole.holeAngle > 0) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            if (hole.subdrillAmount < 0) {
                ctx.lineTo(lineEndX, lineEndY);
                ctx.stroke();
                ctx.strokeStyle = "rgba(255, 0, 0, 0.2)";
                ctx.beginPath();
                ctx.moveTo(lineEndX, lineEndY);
                ctx.lineTo(gradeX, gradeY);
                ctx.stroke();
                ctx.strokeStyle = "#000000";
            } else {
                ctx.lineTo(gradeX, gradeY);
                ctx.stroke();
                ctx.strokeStyle = "rgba(255, 0, 0, 1.0)";
                ctx.beginPath();
                ctx.moveTo(gradeX, gradeY);
                ctx.lineTo(lineEndX, lineEndY);
                ctx.stroke();
                ctx.strokeStyle = "#000000";
            }
        }

        // Draw toe
        if (parseFloat(hole.holeLengthCalculated).toFixed(1) != 0.0) {
            const radiusPx = toeSizeInMeters * printScale;
            ctx.beginPath();
            ctx.arc(lineEndX, lineEndY, radiusPx, 0, 2 * Math.PI);
            ctx.stroke();
        }

        // Draw collar
        const holeRadius = (hole.holeDiameter / 1000 / 2) * printHoleScale * printScale * 0.14;
        ctx.beginPath();
        ctx.arc(x, y, holeRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Draw labels
        const textOffset = holeRadius * 2.2;
        if (displayOptions.holeID) {
            ctx.fillStyle = "#000000";
            ctx.fillText(hole.holeID, x + textOffset, y - textOffset);
        }
        if (displayOptions.holeDia) {
            ctx.fillStyle = "rgb(0, 50, 0)";
            ctx.fillText(parseFloat(hole.holeDiameter).toFixed(0), x + textOffset, y);
        }
        if (displayOptions.holeLen) {
            ctx.fillStyle = "rgb(0, 0, 67)";
            ctx.fillText(parseFloat(hole.holeLengthCalculated).toFixed(1), x + textOffset, y + textOffset);
        }
    });

    return { canvas: canvas, printScale: printScale };
}

// Step 3) Extract blast names from holes
function extractBlastNames(allBlastHoles) {
    if (!allBlastHoles || allBlastHoles.length === 0) return null;
    const blastNames = new Set();
    allBlastHoles.forEach(function (hole) {
        if (hole.entityName) {
            blastNames.add(hole.entityName);
        }
    });
    return Array.from(blastNames).join(", ");
}

// Step 4) Build statistics table rows for PDFMake
function buildStatisticsTableRows(stats) {
    const rows = [];

    // Ensure stats is an object
    if (!stats || typeof stats !== "object") {
        return [{ text: "No statistics available", margin: [0, 2, 0, 0] }];
    }

    const entityNames = Object.keys(stats);
    if (entityNames.length === 0) {
        return [{ text: "No statistics available", margin: [0, 2, 0, 0] }];
    }

    entityNames.forEach(function (entityName) {
        const s = stats[entityName];
        if (!s) return;

        // Ensure all numeric values are valid
        const holeCount = (s.holeCount !== undefined && s.holeCount !== null) ? s.holeCount : 0;
        const burden = (s.burden !== undefined && s.burden !== null && !isNaN(s.burden)) ? s.burden : 0;
        const spacing = (s.spacing !== undefined && s.spacing !== null && !isNaN(s.spacing)) ? s.spacing : 0;
        const drillMetres = (s.drillMetres !== undefined && s.drillMetres !== null && !isNaN(s.drillMetres)) ? s.drillMetres : 0;
        const expMass = (s.expMass !== undefined && s.expMass !== null && !isNaN(s.expMass)) ? s.expMass : 0;
        const volume = (s.volume !== undefined && s.volume !== null && !isNaN(s.volume)) ? s.volume : 0;
        const surfaceArea = (s.surfaceArea !== undefined && s.surfaceArea !== null && !isNaN(s.surfaceArea)) ? s.surfaceArea : 0;

        rows.push({ text: "Blast Entity: " + (entityName || "Unknown"), bold: true, margin: [0, 2, 0, 0] });
        rows.push({ text: "Holes: " + holeCount, margin: [0, 1, 0, 0] });
        rows.push({ text: "Common Burden: " + burden.toFixed(2) + "m", margin: [0, 1, 0, 0] });
        rows.push({ text: "Common Spacing: " + spacing.toFixed(2) + "m", margin: [0, 1, 0, 0] });
        rows.push({ text: "Drill Metres: " + drillMetres.toFixed(1) + "m", margin: [0, 1, 0, 0] });
        rows.push({ text: "Exp. Mass: " + expMass.toFixed(1) + "kg", margin: [0, 1, 0, 0] });
        rows.push({ text: "Volume: " + volume.toFixed(1) + "m³", margin: [0, 1, 0, 0] });
        rows.push({ text: "Surface Area: " + surfaceArea.toFixed(1) + "m²", margin: [0, 1, 0, 0] });

        if (s.minFiringTime !== null && s.minFiringTime !== undefined) {
            rows.push({ text: "Min Firing: " + s.minFiringTime + "ms", margin: [0, 1, 0, 0] });
        }
        if (s.maxFiringTime !== null && s.maxFiringTime !== undefined) {
            rows.push({ text: "Max Firing: " + s.maxFiringTime + "ms", margin: [0, 1, 0, 0] });
        }

        // Delays table
        if (s.delayGroups && typeof s.delayGroups === "object") {
            rows.push({ text: "Delays:", bold: true, margin: [0, 4, 0, 2] });

            const delayRows = [];
            Object.keys(s.delayGroups)
                .sort(function (a, b) {
                    if (a === "Unknown") return 1;
                    if (b === "Unknown") return -1;
                    return parseFloat(a) - parseFloat(b);
                })
                .forEach(function (delay) {
                    const group = s.delayGroups[delay];
                    if (!group) return;

                    const delayText = delay === "Unknown" ? "Unknown" : delay + "ms";
                    const count = (group.count !== undefined && group.count !== null) ? group.count : 0;
                    const color = group.color || "#ffffff";

                    delayRows.push([
                        {
                            text: delayText + ":",
                            fillColor: color,
                            color: getContrastColor(color),
                            border: [true, true, true, true]
                        },
                        {
                            text: String(count),
                            border: [true, true, true, true]
                        }
                    ]);
                });

            if (delayRows.length > 0) {
                // Validate delayRows for undefined values
                delayRows.forEach((row, index) => {
                    if (!Array.isArray(row) || row.length !== 2) {
                        console.error("Invalid delay row structure at index " + index);
                        return;
                    }
                    row.forEach((cell, cellIndex) => {
                        if (cell === undefined || cell === null) {
                            console.error("Undefined cell in delay row " + index + ", cell " + cellIndex);
                            row[cellIndex] = { text: "Error", border: [true, true, true, true] };
                        } else if (typeof cell === "object") {
                            for (const key in cell) {
                                if (cell[key] === undefined) {
                                    console.error("Undefined property " + key + " in delay row " + index + ", cell " + cellIndex);
                                    cell[key] = ""; // Replace with empty string
                                }
                            }
                        }
                    });
                });

                rows.push({
                    table: {
                        widths: ["*", "auto"],
                        body: delayRows
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 0.1; },
                        vLineWidth: function (i, node) { return 0.1; },
                        hLineColor: function (i, node) { return "black"; },
                        vLineColor: function (i, node) { return "black"; },
                        paddingLeft: function (i, node) { return 0; },
                        paddingRight: function (i, node) { return 0; },
                        paddingTop: function (i, node) { return 0; },
                        paddingBottom: function (i, node) { return 0; }
                    },
                    margin: [0, 2, 0, 4]
                });
            }
        }
    });

    // Ensure we always return at least one row
    if (rows.length === 0) {
        return [{ text: "No statistics available", margin: [0, 2, 0, 0] }];
    }

    // Final validation - ensure no undefined values in rows
    rows.forEach((row, index) => {
        if (row === undefined || row === null) {
            console.error("buildStatisticsTableRows: row " + index + " is undefined/null");
            rows[index] = { text: "Error: undefined row", margin: [0, 2, 0, 0] };
        } else if (typeof row === "object") {
            // Check for undefined properties in the row object
            for (const key in row) {
                if (row[key] === undefined) {
                    console.error("buildStatisticsTableRows: row " + index + " has undefined property: " + key);
                    row[key] = ""; // Replace undefined with empty string
                }
            }
        }
    });

    return rows;
}

// Step 5) Get contrast color for text
function getContrastColor(hexColor) {
    if (!hexColor) return "#000000";
    hexColor = hexColor.replace("#", "");
    if (hexColor.length === 3) {
        hexColor = hexColor[0] + hexColor[0] + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2];
    }
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.5 ? "#ffffff" : "#000000";
}

// Step 6) Calculate scale ratio
function calculateScaleRatio(printScale) {
    if (!printScale || printScale <= 0) return "1:1000";
    const ratio = Math.round(1000 / printScale);
    return "1:" + ratio;
}

// Step 7) Main PDF generation function using jsPDF (reliable alternative to PDFMake)
export function generatePDFWithPDFMake(context, userInput, mode) {
    // Clean, reliable jsPDF implementation
    // Simple, reliable jsPDF implementation
    const { allBlastHoles, showModalMessage, FloatingDialog, printPaperSize, printOrientation, getVoronoiMetrics, buildVersion } = context;

    // Default userInput
    if (!userInput) {
        userInput = {
            blastName: "Untitled Blast",
            designer: "",
            notes: "",
            outputType: "vector"
        };
    }

    // Default mode
    if (!mode) {
        mode = context.is3DMode ? "3D" : "2D";
    }

    // Check for data
    if ((!allBlastHoles || allBlastHoles.length === 0) &&
        (!context.allKADDrawingsMap || context.allKADDrawingsMap.size === 0) &&
        (!context.allAvailableSurfaces || context.allAvailableSurfaces.length === 0)) {
        showModalMessage("No Data", "No data available for printing", "warning");
        return;
    }

    // Progress dialog
    const progressContent = document.createElement("div");
    progressContent.style.textAlign = "center";
    progressContent.innerHTML = `
        <p>Generating PDF with jsPDF</p>
        <p>Please wait...</p>
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
        allowOutsideClick: false
    });

    progressDialog.show();

    const bar = document.getElementById("pdfProgressBar");
    const text = document.getElementById("pdfProgressText");

    // Paper sizes
    const paperSizes = {
        A4: { width: 210, height: 297 },
        A3: { width: 297, height: 420 },
        A2: { width: 420, height: 594 },
        A1: { width: 594, height: 841 },
        A0: { width: 841, height: 1189 }
    };

    // Validate printPaperSize and printOrientation
    const validPrintPaperSize = (printPaperSize && paperSizes[printPaperSize]) ? printPaperSize : "A4";
    const validPrintOrientation = (printOrientation === "landscape" || printOrientation === "portrait") ? printOrientation : "portrait";

    const paperSize = paperSizes[validPrintPaperSize];
    const isLandscape = validPrintOrientation === "landscape";

    console.log("Creating PDF with jsPDF...");

    try {
        // Create PDF using jsPDF
        const pdf = new jsPDF({
            orientation: isLandscape ? 'landscape' : 'portrait',
            unit: 'mm',
            format: paperSize.width > paperSize.height ? [paperSize.width, paperSize.height] : [paperSize.height, paperSize.width]
        });

        // Add title
        pdf.setFontSize(16);
        pdf.text("Blast Report: " + (userInput.blastName || "Untitled"), 20, 30);

        // Add date
        pdf.setFontSize(10);
        pdf.text("Generated: " + new Date().toLocaleString(), 20, 40);

        // Add placeholder for map (in a real implementation, you'd capture the canvas)
        pdf.setFontSize(12);
        pdf.text("Map Area - Not implemented in basic version", 20, 60);

        // Add statistics if available
        if (getVoronoiMetrics && allBlastHoles && allBlastHoles.length > 0) {
            try {
                const stats = getBlastStatisticsPerEntity(allBlastHoles, getVoronoiMetrics);
                let yPos = 80;

                pdf.setFontSize(14);
                pdf.text("Blast Statistics:", 20, yPos);
                yPos += 10;

                pdf.setFontSize(10);
                Object.keys(stats).forEach(function (entityName) {
                    const entityStats = stats[entityName];
                    if (entityStats && typeof entityStats === "object") {
                        pdf.text("Entity: " + entityName, 30, yPos);
                        yPos += 8;

                        if (entityStats.holeCount !== undefined) {
                            pdf.text("Holes: " + entityStats.holeCount, 40, yPos);
                            yPos += 6;
                        }
                        if (entityStats.burden !== undefined) {
                            pdf.text("Burden: " + entityStats.burden.toFixed(2) + "m", 40, yPos);
                            yPos += 6;
                        }
                        if (entityStats.spacing !== undefined) {
                            pdf.text("Spacing: " + entityStats.spacing.toFixed(2) + "m", 40, yPos);
                            yPos += 6;
                        }
                    }
                });
            } catch (statsError) {
                console.warn("Error generating statistics:", statsError);
                pdf.text("Statistics: Error loading statistics", 20, 80);
            }
        }

        // Add footer
        const pageHeight = pdf.internal.pageSize.height;
        pdf.setFontSize(8);
        pdf.text("Generated by Kirra Blast Design Software", 20, pageHeight - 10);

        // Generate and download
        const pdfBlob = pdf.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = "kirra-blast-" + new Date().toISOString().split("T")[0] + ".pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 100);

        console.log("✅ PDF created and downloaded successfully with jsPDF");

        setTimeout(function () {
            progressDialog.close();
            showModalMessage("Success", "PDF created successfully!", "success");
        }, 300);

    } catch (error) {
        progressDialog.close();
        console.error("jsPDF creation error:", error);
        showModalMessage("PDF Creation Failed", "Error creating PDF: " + error.message, "error");
    }
}
