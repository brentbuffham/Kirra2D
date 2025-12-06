///------------------ VECTOR PDF RENDERING FUNCTIONS ------------------///
// Step 1) This module provides jsPDF vector equivalents of the canvas print functions
// The API matches PrintRendering.js so the same logic can be used

import { printCanvas, getPrintBoundary } from "./PrintSystem.js";

const magnifyFont = 1.7;
let vectorPDF = null;
let vectorScale = 1;

// Step 2) Initialize vector rendering context
export function initVectorPDF(pdf, scale) {
    vectorPDF = pdf;
    vectorScale = scale;
}

// Step 3) Helper to convert RGB string to jsPDF format
function parseColor(color) {
    // Handle hex colors
    if (color && color.startsWith("#")) {
        return color;
    }
    // Handle rgb() colors
    if (color && color.startsWith("rgb")) {
        const match = color.match(/\d+/g);
        if (match && match.length >= 3) {
            return "#" + ((1 << 24) + (parseInt(match[0]) << 16) + (parseInt(match[1]) << 8) + parseInt(match[2])).toString(16).slice(1);
        }
    }
    return color || "#000000";
}

// Step 4) Vector equivalents of print functions
export function printVectorBackgroundImage(context) {
    // Images must be rasterized - this will embed them in the PDF
    if (!context.loadedImages || context.loadedImages.size === 0) return;

    context.loadedImages.forEach(function(image) {
        if (image.visible === false || !image.canvas) return;

        const bbox = image.bbox;
        if (bbox && bbox.length >= 4) {
            const coords1 = window.worldToCanvas(bbox[0], bbox[3]);
            const coords2 = window.worldToCanvas(bbox[2], bbox[1]);
            
            const x = Math.min(coords1[0], coords2[0]);
            const y = Math.min(coords1[1], coords2[1]);
            const width = Math.abs(coords2[0] - coords1[0]);
            const height = Math.abs(coords2[1] - coords1[1]);

            try {
                const imgData = image.canvas.toDataURL("image/png");
                const alpha = image.transparency !== undefined && image.transparency !== null ? image.transparency : 1.0;
                
                if (alpha < 1.0) {
                    vectorPDF.saveGraphicsState();
                    vectorPDF.setGState(new vectorPDF.GState({ opacity: alpha }));
                }
                
                vectorPDF.addImage(imgData, "PNG", x, y, width, height);
                
                if (alpha < 1.0) {
                    vectorPDF.restoreGraphicsState();
                }
            } catch (error) {
                console.warn("Could not embed image in vector PDF:", error);
            }
        }
    });
}

export function printVectorSurface(context) {
    if (!context.loadedSurfaces || context.loadedSurfaces.size === 0) return;

    let hasSurfaces = false;
    let allMinZ = Infinity;
    let allMaxZ = -Infinity;

    // Step 1) Calculate Z range for all surfaces
    for (const surface of context.loadedSurfaces.values()) {
        if (surface.visible === false) continue;
        
        if (surface.isTexturedMesh) {
            // Textured meshes use flattened images
            if (surface.meshBounds && surface.textureCanvas) {
                const coords1 = window.worldToCanvas(surface.meshBounds.minX, surface.meshBounds.maxY);
                const coords2 = window.worldToCanvas(surface.meshBounds.maxX, surface.meshBounds.minY);
                
                const x = Math.min(coords1[0], coords2[0]);
                const y = Math.min(coords1[1], coords2[1]);
                const width = Math.abs(coords2[0] - coords1[0]);
                const height = Math.abs(coords2[1] - coords1[1]);

                try {
                    const imgData = surface.textureCanvas.toDataURL("image/png");
                    const alpha = surface.transparency !== undefined && surface.transparency !== null ? surface.transparency : 1.0;
                    
                    if (alpha < 1.0) {
                        vectorPDF.saveGraphicsState();
                        vectorPDF.setGState(new vectorPDF.GState({ opacity: alpha }));
                    }
                    
                    vectorPDF.addImage(imgData, "PNG", x, y, width, height);
                    
                    if (alpha < 1.0) {
                        vectorPDF.restoreGraphicsState();
                    }
                } catch (error) {
                    console.warn("Could not embed textured surface in vector PDF:", error);
                }
            }
            continue;
        }

        if (surface.points && surface.points.length > 0) {
            hasSurfaces = true;
            surface.points.forEach(function(point) {
                if (point.z < allMinZ) allMinZ = point.z;
                if (point.z > allMaxZ) allMaxZ = point.z;
            });
        }
    }

    if (!hasSurfaces) return;

    // Step 2) Draw triangles
    for (const surface of context.loadedSurfaces.values()) {
        if (surface.visible === false) continue;
        if (surface.isTexturedMesh) continue;
        
        if (surface.triangles && surface.triangles.length > 0) {
            surface.triangles.forEach(function(triangle) {
                printVectorTriangleWithGradient(triangle, allMinZ, allMaxZ, surface.transparency || 1.0, surface.gradient || "default", context);
            });
        }
    }
}

function printVectorTriangleWithGradient(triangle, globalMinZ, globalMaxZ, alpha, gradient, context) {
    const vertices = triangle.vertices;
    const p1 = vertices[0];
    const p2 = vertices[1];
    const p3 = vertices[2];

    const coords1 = context.worldToCanvas(p1.x, p1.y);
    const coords2 = context.worldToCanvas(p2.x, p2.y);
    const coords3 = context.worldToCanvas(p3.x, p3.y);

    // Calculate average color for the triangle
    const avgZ = (p1.z + p2.z + p3.z) / 3;
    const color = context.elevationToColor(avgZ, globalMinZ, globalMaxZ, gradient);

    vectorPDF.setFillColor(parseColor(color));
    vectorPDF.setDrawColor("#000000");
    vectorPDF.setLineWidth(0.1);

    if (alpha < 1.0) {
        vectorPDF.saveGraphicsState();
        vectorPDF.setGState(new vectorPDF.GState({ opacity: alpha }));
    }

    vectorPDF.triangle(coords1[0], coords1[1], coords2[0], coords2[1], coords3[0], coords3[1], "FD");

    if (alpha < 1.0) {
        vectorPDF.restoreGraphicsState();
    }
}

export function printVectorKADPoints(x, y, z, radius, color) {
    vectorPDF.setFillColor(parseColor(color));
    vectorPDF.setDrawColor(parseColor(color));
    vectorPDF.circle(x, y, radius, "F");
}

export function printVectorKADLines(sx, sy, ex, ey, sz, ez, lineWidth, color) {
    vectorPDF.setDrawColor(parseColor(color));
    vectorPDF.setLineWidth(lineWidth);
    vectorPDF.line(sx, sy, ex, ey);
}

export function printVectorKADPolys(sx, sy, ex, ey, sz, ez, lineWidth, color, isClosed) {
    vectorPDF.setDrawColor(parseColor(color));
    vectorPDF.setLineWidth(lineWidth);
    vectorPDF.line(sx, sy, ex, ey);
}

export function printVectorKADCircles(x, y, z, radius, lineWidth, strokeColor) {
    vectorPDF.setDrawColor(parseColor(strokeColor));
    vectorPDF.setLineWidth(lineWidth);
    vectorPDF.circle(x, y, radius, "S");
}

export function printVectorKADTexts(x, y, z, text, color, context) {
    vectorPDF.setTextColor(parseColor(color));
    vectorPDF.setFontSize(parseInt(context.currentFontSize * magnifyFont - 2));
    vectorPDF.text(text, x, y);
}

export function printVectorTrack(lineStartX, lineStartY, lineEndX, lineEndY, gradeX, gradeY, color, subdrillAmount) {
    vectorPDF.setLineWidth(1);

    if (subdrillAmount < 0) {
        // Step 1) NEGATIVE SUBDRILL: Draw collar to toe (main line)
        vectorPDF.setDrawColor("#000000");
        vectorPDF.line(lineStartX, lineStartY, lineEndX, lineEndY);
        
        // Step 2) Draw grade to toe (subdrill portion - red with 20% opacity)
        vectorPDF.saveGraphicsState();
        vectorPDF.setGState(new vectorPDF.GState({ opacity: 0.2 }));
        vectorPDF.setDrawColor("#ff0000");
        vectorPDF.line(lineEndX, lineEndY, gradeX, gradeY);
        
        // Step 3) Draw grade marker with 20% opacity
        vectorPDF.setFillColor("#ff0000");
        vectorPDF.circle(gradeX, gradeY, 3, "F");
        vectorPDF.restoreGraphicsState();
    } else {
        // Step 4) POSITIVE SUBDRILL: Draw collar to grade (main line)
        vectorPDF.setDrawColor("#000000");
        vectorPDF.line(lineStartX, lineStartY, gradeX, gradeY);
        
        // Step 5) Draw grade to toe (subdrill portion - red)
        vectorPDF.setDrawColor("#ff0000");
        vectorPDF.line(gradeX, gradeY, lineEndX, lineEndY);
        
        // Step 6) Draw grade marker
        vectorPDF.setFillColor("#ff0000");
        vectorPDF.circle(gradeX, gradeY, 3, "F");
    }
}

export function printVectorHoleToe(x, y, fillColor, strokeColor, radius) {
    vectorPDF.setDrawColor(parseColor(strokeColor));
    vectorPDF.setFillColor(parseColor(fillColor));
    vectorPDF.setLineWidth(1);
    vectorPDF.circle(x, y, radius, "FD");
}

export function printVectorHole(x, y, radius, strokeColor) {
    vectorPDF.setDrawColor("#000000");
    vectorPDF.setFillColor("#000000");
    vectorPDF.setLineWidth(1);
    const minRadius = 1.5;
    const drawRadius = radius > minRadius ? radius : minRadius;
    vectorPDF.circle(x, y, drawRadius, "F");
}

export function printVectorDummy(x, y, radius, strokeColor) {
    vectorPDF.setDrawColor("#000000");
    vectorPDF.setLineWidth(2);
    vectorPDF.line(x - radius, y - radius, x + radius, y + radius);
    vectorPDF.line(x - radius, y + radius, x + radius, y - radius);
}

export function printVectorNoDiameterHole(x, y, sideLength, strokeColor) {
    vectorPDF.setDrawColor("#000000");
    vectorPDF.setLineWidth(2);
    const halfSide = sideLength / 2;
    vectorPDF.rect(x - halfSide, y - halfSide, sideLength, sideLength, "S");
}

export function printVectorText(x, y, text, color, context) {
    vectorPDF.setTextColor(parseColor(color));
    vectorPDF.setFontSize(parseInt(context.currentFontSize * magnifyFont - 2));
    vectorPDF.text(text, x, y);
}

export function printVectorRightAlignedText(x, y, text, color, context) {
    vectorPDF.setTextColor(parseColor(color));
    vectorPDF.setFontSize(parseInt(context.currentFontSize * magnifyFont - 2));
    const textWidth = vectorPDF.getTextWidth(text);
    vectorPDF.text(text, x - textWidth, y);
}

export function printVectorMultilineText(text, x, y, lineHeight, alignment, textColor, boxColor, showBox, context) {
    if (!text) return;
    const lines = text.split("\n");
    
    vectorPDF.setTextColor(parseColor(textColor));
    vectorPDF.setFontSize(parseInt(context.currentFontSize * magnifyFont - 2));
    
    let maxWidth = 0;
    lines.forEach(function(line) {
        const width = vectorPDF.getTextWidth(line);
        if (width > maxWidth) maxWidth = width;
    });

    for (let i = 0; i < lines.length; i++) {
        const lineWidth = vectorPDF.getTextWidth(lines[i]);
        let drawX = x;
        
        if (alignment === "right") {
            drawX = x - maxWidth;
        } else if (alignment === "center") {
            drawX = x - lineWidth / 2;
        }
        
        vectorPDF.text(lines[i], drawX, y + i * lineHeight);
    }

    if (showBox) {
        vectorPDF.setDrawColor(parseColor(boxColor));
        vectorPDF.setLineWidth(1);
        vectorPDF.roundedRect(x - 5 - maxWidth / 2, y - 6 - lineHeight / 2, maxWidth + 10, lines.length * lineHeight + 6, 4, 4, "S");
    }
}

// Step 5) Main vector data rendering function - mirrors drawDataForPrinting
export function drawDataForPrintingVector(printArea, context) {
    const {
        canvas,
        allBlastHoles,
        selectedHole,
        currentScale: originalScale,
        centroidX: originalCentroidX,
        centroidY: originalCentroidY
    } = context;

    // Step 1) Get print preview boundary
    const screenBoundary = getPrintBoundary(canvas);
    if (!screenBoundary) {
        throw new Error("Print Preview Mode must be active to generate a WYSIWYG print.");
    }

    // Step 2) Calculate inner boundary (print-safe area)
    const margin = screenBoundary.width * screenBoundary.marginPercent;
    const innerBoundary = {
        x: screenBoundary.x + margin,
        y: screenBoundary.y + margin,
        width: screenBoundary.width - margin * 2,
        height: screenBoundary.height - margin * 2
    };

    // Step 3) Convert to world coordinates
    const world_x1 = (innerBoundary.x - canvas.width / 2) / originalScale + originalCentroidX;
    const world_y1 = -(innerBoundary.y + innerBoundary.height - canvas.height / 2) / originalScale + originalCentroidY;
    const world_x2 = (innerBoundary.x + innerBoundary.width - canvas.width / 2) / originalScale + originalCentroidX;
    const world_y2 = -(innerBoundary.y - canvas.height / 2) / originalScale + originalCentroidY;

    const minX = Math.min(world_x1, world_x2);
    const maxX = Math.max(world_x1, world_x2);
    const minY = Math.min(world_y1, world_y2);
    const maxY = Math.max(world_y1, world_y2);

    // Step 4) Calculate scale
    const dataWidth = maxX - minX;
    const dataHeight = maxY - minY;
    if (dataWidth <= 0 || dataHeight <= 0) return;

    const scaleX = printArea.width / dataWidth;
    const scaleY = printArea.height / dataHeight;
    const printScale = Math.min(scaleX, scaleY);

    const scaledWidth = dataWidth * printScale;
    const scaledHeight = dataHeight * printScale;
    const offsetX = printArea.x + (printArea.width - scaledWidth) / 2;
    const offsetY = printArea.y + (printArea.height - scaledHeight) / 2;

    const printCentroidX = minX + dataWidth / 2;
    const printCentroidY = minY + dataHeight / 2;

    // Step 5) Coordinate transformation function
    function worldToPrint(worldX, worldY) {
        const centerX = offsetX + scaledWidth / 2;
        const centerY = offsetY + scaledHeight / 2;
        const x = (worldX - printCentroidX) * printScale + centerX;
        const y = -(worldY - printCentroidY) * printScale + centerY;
        return [x, y];
    }

    // Step 6) Temporarily override coordinate transform
    const original_worldToCanvas = window.worldToCanvas;
    const original_context_worldToCanvas = context.worldToCanvas;
    
    context.currentScale = printScale;
    context.centroidX = printCentroidX;
    context.centroidY = printCentroidY;
    window.worldToCanvas = worldToPrint;
    context.worldToCanvas = worldToPrint;

    // Step 7) RENDER IN CORRECT ORDER: Images → Surfaces → KAD → Holes
    
    // Layer 1: Background images
    printVectorBackgroundImage(context);
    
    // Layer 2: Surfaces
    printVectorSurface(context);
    
    // Layer 3: KAD entities
    printVectorKADData(allBlastHoles, context);
    
    // Layer 4: Blast holes
    printVectorBlastHoles(allBlastHoles, selectedHole, context);

    // Step 8) Restore globals
    context.currentScale = originalScale;
    context.centroidX = originalCentroidX;
    context.centroidY = originalCentroidY;
    window.worldToCanvas = original_worldToCanvas;
    if (original_context_worldToCanvas !== undefined) {
        context.worldToCanvas = original_context_worldToCanvas;
    }
}

// Step 6) Render KAD data
function printVectorKADData(allBlastHoles, context) {
    for (const entity of context.allKADDrawingsMap.values()) {
        if (entity.visible === false) continue;
        
        if (entity.entityType === "point") {
            entity.data.forEach(function(point) {
                const coords = context.worldToCanvas(point.pointXLocation, point.pointYLocation);
                let lineWidthForDisplay = point.lineWidth;
                if (point.lineWidth < 2) lineWidthForDisplay = 4;
                printVectorKADPoints(coords[0], coords[1], point.pointZLocation, lineWidthForDisplay, point.color);
            });
        } else if (entity.entityType === "circle") {
            entity.data.forEach(function(circle) {
                const coords = context.worldToCanvas(circle.pointXLocation, circle.pointYLocation);
                const radiusInPixels = circle.radius * context.currentScale;
                printVectorKADCircles(coords[0], coords[1], circle.pointZLocation, radiusInPixels, circle.lineWidth, circle.color);
            });
        } else if (entity.entityType === "text") {
            entity.data.forEach(function(textData) {
                if (textData && textData.text) {
                    const coords = context.worldToCanvas(textData.pointXLocation, textData.pointYLocation);
                    printVectorKADTexts(coords[0], coords[1], textData.pointZLocation, textData.text, textData.color, context);
                }
            });
        } else if (entity.entityType === "line" || entity.entityType === "poly") {
            const points = entity.data;
            if (points.length < 2) return;

            for (let i = 0; i < points.length - 1; i++) {
                const currentPoint = points[i];
                const nextPoint = points[i + 1];
                const start = context.worldToCanvas(currentPoint.pointXLocation, currentPoint.pointYLocation);
                const end = context.worldToCanvas(nextPoint.pointXLocation, nextPoint.pointYLocation);
                printVectorKADPolys(start[0], start[1], end[0], end[1], currentPoint.pointZLocation, nextPoint.pointZLocation, currentPoint.lineWidth, currentPoint.color, false);
            }

            const isClosed = entity.entityType === "poly";
            if (isClosed && points.length > 2) {
                const firstPoint = points[0];
                const lastPoint = points[points.length - 1];
                const start = context.worldToCanvas(lastPoint.pointXLocation, lastPoint.pointYLocation);
                const end = context.worldToCanvas(firstPoint.pointXLocation, firstPoint.pointYLocation);
                printVectorKADPolys(start[0], start[1], end[0], end[1], lastPoint.pointZLocation, firstPoint.pointZLocation, lastPoint.lineWidth, lastPoint.color, false);
            }
        }
    }
}

// Step 7) Render blast holes
function printVectorBlastHoles(allBlastHoles, selectedHole, context) {
    const visibleBlastHoles = allBlastHoles.filter(function(hole) { return hole.visible !== false; });
    if (!visibleBlastHoles || visibleBlastHoles.length === 0) return;

    const displayOptions = context.getDisplayOptions();
    let holeMap = new Map();
    if (visibleBlastHoles.length > 0) {
        holeMap = context.buildHoleMap(visibleBlastHoles);
    }

    vectorPDF.setLineWidth(1);
    vectorPDF.setFontSize(parseInt(context.currentFontSize * magnifyFont));

    for (const hole of visibleBlastHoles) {
        const collar = context.worldToCanvas(hole.startXLocation, hole.startYLocation);
        const grade = context.worldToCanvas(hole.gradeXLocation, hole.gradeYLocation);
        const toe = context.worldToCanvas(hole.endXLocation, hole.endYLocation);

        const toeSizeInMeters = 3; // Default toe size
        const diameterPx = parseInt((hole.holeDiameter / 1000) * context.currentScale * context.holeScale);

        // Step 1) Draw track if angled
        if (hole.holeAngle > 0) {
            printVectorTrack(collar[0], collar[1], toe[0], toe[1], grade[0], grade[1], "#000000", hole.subdrillAmount);
        }

        // Step 2) Draw toe
        if (parseFloat(hole.holeLengthCalculated).toFixed(1) != 0.0) {
            const radiusInPixels = toeSizeInMeters * context.currentScale;
            printVectorHoleToe(toe[0], toe[1], context.transparentFillColor, "#000000", radiusInPixels);
        }

        // Step 3) Calculate text offsets
        const textOffset = parseInt((hole.holeDiameter / 1000) * context.holeScale * context.currentScale);
        const leftSideToe = parseInt(toe[0]) - textOffset;
        const rightSideToe = parseInt(toe[0]) + textOffset;
        const leftSideCollar = parseInt(collar[0]) - textOffset;
        const rightSideCollar = parseInt(collar[0]) + textOffset;
        const topSideToe = parseInt(toe[1] - textOffset);
        const middleSideToe = parseInt(toe[1] + textOffset + parseInt((context.currentFontSize * magnifyFont) / 4));
        const bottomSideToe = parseInt(toe[1] + textOffset + parseInt(context.currentFontSize * magnifyFont));
        const topSideCollar = parseInt(collar[1] - textOffset);
        const middleSideCollar = parseInt(collar[1] + parseInt((context.currentFontSize * magnifyFont) / 2));
        const bottomSideCollar = parseInt(collar[1] + textOffset + parseInt(context.currentFontSize * magnifyFont));

        // Step 4) Draw text labels
        printVectorHoleTexts(hole, collar[0], collar[1], toe[0], toe[1], {
            leftSideToe,
            rightSideToe,
            leftSideCollar,
            rightSideCollar,
            topSideToe,
            middleSideToe,
            bottomSideToe,
            topSideCollar,
            middleSideCollar,
            bottomSideCollar,
            holeMap,
            displayOptions
        }, context);

        // Step 5) Draw hole collar
        if (parseFloat(hole.holeLengthCalculated).toFixed(1) == 0.0) {
            printVectorDummy(collar[0], collar[1], parseInt(0.2 * context.holeScale * context.currentScale), "#000000");
        } else if (hole.holeDiameter == 0) {
            printVectorNoDiameterHole(collar[0], collar[1], 10, "#000000");
        } else {
            printVectorHole(collar[0], collar[1], diameterPx, "#000000");
        }
    }
}

// Step 8) Print hole text labels
function printVectorHoleTexts(hole, x, y, lineEndX, lineEndY, positions, context) {
    const { leftSideToe, rightSideToe, leftSideCollar, rightSideCollar, topSideToe, middleSideToe, bottomSideToe, topSideCollar, middleSideCollar, bottomSideCollar, holeMap, displayOptions } = positions;

    if (displayOptions.holeID) {
        printVectorText(rightSideCollar, topSideCollar, hole.holeID, "#000000", context);
    }
    if (displayOptions.holeDia) {
        printVectorText(rightSideCollar, middleSideCollar, parseFloat(hole.holeDiameter).toFixed(0), "rgb(0, 50, 0)", context);
    }
    if (displayOptions.holeLen) {
        printVectorText(rightSideCollar, bottomSideCollar, parseFloat(hole.holeLengthCalculated).toFixed(1), "rgb(0, 0, 67)", context);
    }
    if (displayOptions.holeAng) {
        printVectorRightAlignedText(leftSideCollar, topSideCollar, parseFloat(hole.holeAngle).toFixed(0) + "°", "rgb(67, 30, 0)", context);
    }
    if (displayOptions.holeDip) {
        printVectorRightAlignedText(leftSideToe, topSideToe, (90 - parseFloat(hole.holeAngle)).toFixed(0) + "°", "rgb(67, 30, 0)", context);
    }
    if (displayOptions.holeBea) {
        printVectorRightAlignedText(leftSideToe, bottomSideToe, parseFloat(hole.holeBearing).toFixed(1) + "°", "#ff0000", context);
    }
    if (displayOptions.holeSubdrill) {
        printVectorRightAlignedText(leftSideToe, bottomSideToe, parseFloat(hole.subdrillAmount).toFixed(1), "#0000ff", context);
    }
    if (displayOptions.initiationTime) {
        printVectorRightAlignedText(leftSideCollar, middleSideCollar, hole.holeTime, "#ff0000", context);
    }
}

