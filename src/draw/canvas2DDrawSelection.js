/* prettier-ignore-file */
//=================================================
// canvas2DDrawSelection.js - 2D KAD Selection Visuals
// Extracted from kirra.js for modularity
//=================================================

// Step 1) Helper function to calculate exact text dimensions (matches drawKADTexts)
function calculateTextDimensions(text) {
    if (!text)
        return {
            width: 0,
            height: 0,
            lines: []
        };

    // Step 1a) Set the same font as drawKADTexts
    const ctx = window.ctx;
    const currentFontSize = window.currentFontSize;
    ctx.font = parseInt(currentFontSize - 2) + "px Arial";

    const lines = text.split("\n");
    const lineHeight = currentFontSize; // Same as drawMultilineText

    // Step 1b) Calculate the width of the widest line (same logic as drawMultilineText)
    let maxWidth = 0;
    for (let i = 0; i < lines.length; i++) {
        const lineWidth = ctx.measureText(lines[i]).width;
        if (lineWidth > maxWidth) {
            maxWidth = lineWidth;
        }
    }

    const totalHeight = lines.length * lineHeight;

    return {
        width: maxWidth,
        height: totalHeight,
        lineHeight: lineHeight,
        lines: lines,
        numLines: lines.length
    };
}

// Step 2) Draw KAD selection highlights in 2D canvas
// ENHANCED: Fix segment highlighting to show only the clicked segment
export function drawKADHighlightSelectionVisuals() {
    // Step 2a) Access globals from window object
    const selectedKADObject = window.selectedKADObject;
    const selectedMultipleKADObjects = window.selectedMultipleKADObjects;
    const isSelectionPointerActive = window.isSelectionPointerActive;
    const developerModeEnabled = window.developerModeEnabled;
    const ctx = window.ctx;
    const worldToCanvas = window.worldToCanvas;
    const currentScale = window.currentScale;
    const getEntityFromKADObject = window.getEntityFromKADObject;

    // Step 2b) Early exit if no selection
    if (!selectedKADObject && (!selectedMultipleKADObjects || selectedMultipleKADObjects.length === 0)) return;

    if (developerModeEnabled) {
        console.log("=== DRAWING FUNCTION DEBUG ===");
        console.log("selectedKADObject:", selectedKADObject);
        console.log("isSelectionPointerActive:", isSelectionPointerActive);
        console.log("selectedMultipleKADObjects:", selectedMultipleKADObjects);
        console.log("selectedMultipleKADObjects.length:", selectedMultipleKADObjects?.length);
    }

    // Step 2c) Define colors
    const selectedSegmentColor = "rgba(255, 68, 255, 0.8)";
    const selectedVertexColor = "rgba(255, 68, 255, 0.8)";
    const nonSelectedSegmentColor = "#00FF00"; // Green for non-selected segments
    const nonSelectedPointColor = "rgba(0, 255, 0, 0.5)"; // Green for non-selected points
    const verticesColor = "rgba(255,0,0,0.5)";

    // Step 3) Handle single selection
    if (selectedKADObject && isSelectionPointerActive) {
        const tolerance = 5;
        let entity = getEntityFromKADObject(selectedKADObject);
        if (!entity) return;

        // Step 3a) Common selection styling
        ctx.strokeStyle = nonSelectedSegmentColor; // Bright green
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.fillStyle = verticesColor || "rgba(255,0,0,0.5)"; // Red for vertices/points

        switch (selectedKADObject.entityType) {
            case "point":
                // Step 3b) Highlight the selected point with extra emphasis
                const [px, py] = worldToCanvas(selectedKADObject.pointXLocation, selectedKADObject.pointYLocation);

                ctx.strokeStyle = selectedSegmentColor;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(px, py, tolerance + 3, 0, 2 * Math.PI);
                ctx.stroke();

                // Step 3c) Draw all other points in the entity with standard highlighting
                ctx.strokeStyle = nonSelectedSegmentColor;
                ctx.lineWidth = 5;
                entity.data.forEach((point, index) => {
                    if (index !== selectedKADObject.elementIndex) {
                        const [opx, opy] = worldToCanvas(point.pointXLocation, point.pointYLocation);
                        ctx.beginPath();
                        ctx.arc(opx, opy, tolerance, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                });
                break;

            case "line":
                // Step 3d) Draw ALL segments first with standard highlighting
                entity.data.forEach((point, index) => {
                    if (index > 0) {
                        const [prevX, prevY] = worldToCanvas(entity.data[index - 1].pointXLocation, entity.data[index - 1].pointYLocation);
                        const [x, y] = worldToCanvas(point.pointXLocation, point.pointYLocation);

                        ctx.strokeStyle = nonSelectedSegmentColor; // Green for non-selected segments
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(prevX, prevY);
                        ctx.lineTo(x, y);
                        ctx.stroke();
                    }
                });

                // Step 3e) Then highlight ONLY the selected segment
                if (selectedKADObject.selectionType === "segment") {
                    const segmentIndex = selectedKADObject.segmentIndex;
                    if (segmentIndex < entity.data.length - 1) {
                        const point1 = entity.data[segmentIndex];
                        const point2 = entity.data[segmentIndex + 1];
                        const [x1, y1] = worldToCanvas(point1.pointXLocation, point1.pointYLocation);
                        const [x2, y2] = worldToCanvas(point2.pointXLocation, point2.pointYLocation);

                        ctx.strokeStyle = selectedSegmentColor;
                        ctx.lineWidth = 5;
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                }

                // Step 3f) Draw all vertices
                entity.data.forEach((point) => {
                    const [x, y] = worldToCanvas(point.pointXLocation, point.pointYLocation);
                    ctx.fillStyle = verticesColor;
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, 2 * Math.PI);
                    ctx.fill();
                });
                break;

            case "poly":
                const polygonPoints = entity.data;

                // Step 3g) Draw ALL segments first with standard highlighting
                for (let i = 0; i < polygonPoints.length; i++) {
                    const point1 = polygonPoints[i];
                    const point2 = polygonPoints[(i + 1) % polygonPoints.length];
                    const [x1, y1] = worldToCanvas(point1.pointXLocation, point1.pointYLocation);
                    const [x2, y2] = worldToCanvas(point2.pointXLocation, point2.pointYLocation);

                    ctx.strokeStyle = nonSelectedSegmentColor; // Green for non-selected segments
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }

                // Step 3h) Then highlight ONLY the selected segment
                if (selectedKADObject.selectionType === "segment") {
                    const segmentIndex = selectedKADObject.segmentIndex;
                    const point1 = polygonPoints[segmentIndex];
                    const point2 = polygonPoints[(segmentIndex + 1) % polygonPoints.length];

                    // Step 3i) Check if points exist before accessing properties
                    if (point1 && point2 && point1.pointXLocation !== undefined && point2.pointXLocation !== undefined) {
                        const [x1, y1] = worldToCanvas(point1.pointXLocation, point1.pointYLocation);
                        const [x2, y2] = worldToCanvas(point2.pointXLocation, point2.pointYLocation);

                        ctx.strokeStyle = selectedSegmentColor;
                        ctx.lineWidth = 5;
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                }

                // Step 3j) Draw all vertices
                polygonPoints.forEach((point) => {
                    // Step 3k) Check if point exists before accessing properties
                    if (point && point.pointXLocation !== undefined) {
                        const [x, y] = worldToCanvas(point.pointXLocation, point.pointYLocation);
                        ctx.fillStyle = verticesColor;
                        ctx.beginPath();
                        ctx.arc(x, y, 4, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                });
                break;

            case "circle":
                // Step 3l) Circle highlighting
                const [cx, cy] = worldToCanvas(selectedKADObject.pointXLocation, selectedKADObject.pointYLocation);

                ctx.strokeStyle = selectedSegmentColor;
                ctx.lineWidth = 4;
                const radiusCanvas = selectedKADObject.radius * currentScale;
                ctx.beginPath();
                ctx.arc(cx, cy, radiusCanvas, 0, 2 * Math.PI);
                ctx.stroke();

                ctx.fillStyle = verticesColor;
                ctx.beginPath();
                ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
                ctx.fill();

                // Step 3m) Other circles...
                ctx.strokeStyle = nonSelectedSegmentColor;
                ctx.lineWidth = 2;
                entity.data.forEach((circle, index) => {
                    if (index !== selectedKADObject.elementIndex) {
                        const [ocx, ocy] = worldToCanvas(circle.pointXLocation, circle.pointYLocation);
                        const oradiusCanvas = circle.radius * currentScale;
                        ctx.beginPath();
                        ctx.arc(ocx, ocy, oradiusCanvas + 5, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                });
                break;

            case "text":
                // Step 3n) Text highlighting
                const [tx, ty] = worldToCanvas(selectedKADObject.pointXLocation, selectedKADObject.pointYLocation);
                const textDimensions = calculateTextDimensions(selectedKADObject.text || "Text");

                ctx.strokeStyle = selectedSegmentColor;
                ctx.lineWidth = 4;

                const rectX = tx - 5;
                const rectY = ty - textDimensions.lineHeight + 2;
                const rectWidth = textDimensions.width + 10;
                const rectHeight = textDimensions.height + 6;

                ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

                ctx.fillStyle = verticesColor;
                ctx.beginPath();
                ctx.arc(tx, ty, 4, 0, 2 * Math.PI);
                ctx.fill();

                // Step 3o) Other text elements...
                ctx.strokeStyle = nonSelectedSegmentColor;
                ctx.lineWidth = 2;
                entity.data.forEach((textData, index) => {
                    if (index !== selectedKADObject.elementIndex) {
                        const [otx, oty] = worldToCanvas(textData.pointXLocation, textData.pointYLocation);
                        const otherTextDimensions = calculateTextDimensions(textData.text || "Text");

                        const otherRectX = otx - 5;
                        const otherRectY = oty - otherTextDimensions.lineHeight + 2;
                        const otherRectWidth = otherTextDimensions.width + 10;
                        const otherRectHeight = otherTextDimensions.height + 6;

                        ctx.strokeRect(otherRectX, otherRectY, otherRectWidth, otherRectHeight);
                    }
                });
                break;
        }
    }

    // Step 4) Handle multiple selections - reuse the single selection drawing code
    // PERFORMANCE FIX 2025-12-28: Type-based vertex skip to prevent freeze with large selections
    if (selectedMultipleKADObjects && selectedMultipleKADObjects.length > 0) {
        // Step 4.0) Count selected entities by type (same pattern as HUD stats)
        var kadPointCount = 0, kadLineCount = 0, kadPolyCount = 0, kadCircleCount = 0, kadTextCount = 0;
        for (var i = 0; i < selectedMultipleKADObjects.length; i++) {
            var type = selectedMultipleKADObjects[i].entityType;
            if (type === "point") kadPointCount++;
            else if (type === "line") kadLineCount++;
            else if (type === "poly") kadPolyCount++;
            else if (type === "circle") kadCircleCount++;
            else if (type === "text") kadTextCount++;
        }

        // Step 4.0a) Only draw vertices if NO type has more than 1 entity
        var maxTypeCount = Math.max(kadPointCount, kadLineCount, kadPolyCount, kadCircleCount, kadTextCount);
        var skipVertices = maxTypeCount > 1;

        // Step 4.0b) Cap render count for safety (2D canvas is fast, can handle many)
        var MAX_RENDER_COUNT = 5000;
        var selectionCount = selectedMultipleKADObjects.length;
        var renderCount = Math.min(selectionCount, MAX_RENDER_COUNT);
        
        if (developerModeEnabled) {
            console.log("Drawing multiple selections:", selectionCount, "objects");
            console.log("Type counts - Point:" + kadPointCount + " Line:" + kadLineCount + " Poly:" + kadPolyCount + " Circle:" + kadCircleCount + " Text:" + kadTextCount);
            console.log("Performance mode: skipVertices=" + skipVertices + " (maxTypeCount=" + maxTypeCount + ")");
        }
        
        // Step 4.0c) Show warning if selection was truncated
        if (selectionCount > MAX_RENDER_COUNT && !window._largeSelectionWarningShown) {
            window._largeSelectionWarningShown = true;
            if (typeof window.updateStatusMessage === "function") {
                window.updateStatusMessage("Large selection: rendering " + MAX_RENDER_COUNT + " of " + selectionCount + " entities");
                setTimeout(function() { window.updateStatusMessage(""); }, 3000);
            }
        } else if (selectionCount <= MAX_RENDER_COUNT) {
            window._largeSelectionWarningShown = false;
        }

        selectedMultipleKADObjects.slice(0, renderCount).forEach((kadObj, index) => {
            if (developerModeEnabled && index < 3) {
                console.log("=== DRAWING OBJECT " + index + " ===");
                console.log("kadObj:", kadObj);
            }

            // Step 4a) Temporarily replace selectedKADObject with this one
            const temp = window.selectedKADObject;
            window.selectedKADObject = kadObj;

            // Step 4b) Declare variables
            const tolerance = 5;
            let entity = getEntityFromKADObject(kadObj);
            
            // Step 4b.1) Skip vertex drawing if selection is large
            const drawVerticesForThis = !skipVertices;

            if (developerModeEnabled) {
                console.log("Entity found by getEntityFromKADObject:", entity);
                console.log("Entity type check:", kadObj.entityType);
            }

            if (entity) {
                if (developerModeEnabled) {
                    console.log("Entity found - proceeding with drawing for:", kadObj.entityType);
                }

                // Step 4c) Common selection styling
                ctx.strokeStyle = nonSelectedSegmentColor; // Bright green
                ctx.lineWidth = 3;
                ctx.setLineDash([]);
                ctx.fillStyle = verticesColor;

                switch (kadObj.entityType) {
                    case "point":
                        // Step 4d) Highlight the selected point with extra emphasis
                        const [px, py] = worldToCanvas(kadObj.pointXLocation, kadObj.pointYLocation);

                        ctx.strokeStyle = selectedSegmentColor; // Orange for selected element
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.arc(px, py, tolerance + 3, 0, 2 * Math.PI);
                        ctx.stroke();

                        // Step 4e) Draw all other points in the entity with standard highlighting
                        // PERFORMANCE FIX: Skip if large selection
                        if (drawVerticesForThis) {
                            ctx.strokeStyle = nonSelectedSegmentColor;
                            ctx.lineWidth = 2;
                            entity.data.forEach((point, index) => {
                                if (index !== kadObj.elementIndex) {
                                    const [opx, opy] = worldToCanvas(point.pointXLocation, point.pointYLocation);
                                    ctx.beginPath();
                                    ctx.arc(opx, opy, tolerance, 0, 2 * Math.PI);
                                    ctx.stroke();
                                }
                            });
                        }
                        break;

                    case "line":
                        // Step 4f) Draw ALL segments first with standard highlighting
                        entity.data.forEach((point, index) => {
                            if (index > 0) {
                                const [prevX, prevY] = worldToCanvas(entity.data[index - 1].pointXLocation, entity.data[index - 1].pointYLocation);
                                const [x, y] = worldToCanvas(point.pointXLocation, point.pointYLocation);

                                ctx.strokeStyle = nonSelectedSegmentColor; // Green for non-selected segments
                                ctx.lineWidth = 2;
                                ctx.beginPath();
                                ctx.moveTo(prevX, prevY);
                                ctx.lineTo(x, y);
                                ctx.stroke();
                            }
                        });

                        // Step 4g) Then highlight ONLY the selected segment
                        if (kadObj.selectionType === "segment") {
                            const segmentIndex = kadObj.segmentIndex;
                            if (segmentIndex < entity.data.length - 1) {
                                const point1 = entity.data[segmentIndex];
                                const point2 = entity.data[segmentIndex + 1];
                                const [x1, y1] = worldToCanvas(point1.pointXLocation, point1.pointYLocation);
                                const [x2, y2] = worldToCanvas(point2.pointXLocation, point2.pointYLocation);

                                ctx.strokeStyle = selectedSegmentColor; // Orange for selected segment
                                ctx.lineWidth = 5;
                                ctx.beginPath();
                                ctx.moveTo(x1, y1);
                                ctx.lineTo(x2, y2);
                                ctx.stroke();
                            }
                        }

                        // Step 4h) Draw all vertices
                        // PERFORMANCE FIX: Skip if large selection
                        if (drawVerticesForThis) {
                            entity.data.forEach((point) => {
                                const [x, y] = worldToCanvas(point.pointXLocation, point.pointYLocation);
                                ctx.fillStyle = verticesColor;
                                ctx.beginPath();
                                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                                ctx.fill();
                            });
                        }
                        break;

                    case "poly":
                        const polygonPoints = entity.data;

                        // Step 4i) Draw ALL segments first with standard highlighting
                        for (let i = 0; i < polygonPoints.length; i++) {
                            const point1 = polygonPoints[i];
                            const point2 = polygonPoints[(i + 1) % polygonPoints.length];
                            const [x1, y1] = worldToCanvas(point1.pointXLocation, point1.pointYLocation);
                            const [x2, y2] = worldToCanvas(point2.pointXLocation, point2.pointYLocation);

                            ctx.strokeStyle = nonSelectedSegmentColor; // Green for non-selected segments
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x2, y2);
                            ctx.stroke();
                        }

                        // Step 4j) Then highlight ONLY the selected segment
                        if (kadObj.selectionType === "segment") {
                            const segmentIndex = kadObj.segmentIndex;
                            const point1 = polygonPoints[segmentIndex];
                            const point2 = polygonPoints[(segmentIndex + 1) % polygonPoints.length];
                            const [x1, y1] = worldToCanvas(point1.pointXLocation, point1.pointYLocation);
                            const [x2, y2] = worldToCanvas(point2.pointXLocation, point2.pointYLocation);

                            ctx.strokeStyle = selectedSegmentColor; // Orange for selected segment
                            ctx.lineWidth = 5;
                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x2, y2);
                            ctx.stroke();
                        }

                        // Step 4k) Draw all vertices
                        // PERFORMANCE FIX: Skip if large selection
                        if (drawVerticesForThis) {
                            polygonPoints.forEach((point) => {
                                const [x, y] = worldToCanvas(point.pointXLocation, point.pointYLocation);
                                ctx.fillStyle = verticesColor;
                                ctx.beginPath();
                                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                                ctx.fill();
                            });
                        }
                        break;

                    case "circle":
                        // Step 4l) Circle highlighting
                        const [cx, cy] = worldToCanvas(kadObj.pointXLocation, kadObj.pointYLocation);

                        ctx.strokeStyle = selectedSegmentColor; // Orange for selected segment
                        ctx.lineWidth = 4;
                        const radiusCanvas = kadObj.radius * currentScale;
                        ctx.beginPath();
                        ctx.arc(cx, cy, radiusCanvas, 0, 2 * Math.PI);
                        ctx.stroke();

                        ctx.fillStyle = verticesColor;
                        ctx.beginPath();
                        ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
                        ctx.fill();

                        // Step 4m) Other circles...
                        // PERFORMANCE FIX: Skip if large selection
                        if (drawVerticesForThis) {
                            ctx.strokeStyle = nonSelectedSegmentColor;
                            ctx.lineWidth = 2;
                            entity.data.forEach((circle, index) => {
                                if (index !== kadObj.elementIndex) {
                                    const [ocx, ocy] = worldToCanvas(circle.pointXLocation, circle.pointYLocation);
                                    const oradiusCanvas = circle.radius * currentScale;
                                    ctx.beginPath();
                                    ctx.arc(ocx, ocy, oradiusCanvas + 5, 0, 2 * Math.PI);
                                    ctx.stroke();
                                }
                            });
                        }
                        break;

                    case "text":
                        // Step 4n) Text highlighting
                        const [tx, ty] = worldToCanvas(kadObj.pointXLocation, kadObj.pointYLocation);
                        const textDimensions = calculateTextDimensions(kadObj.text || "Text");

                        ctx.strokeStyle = selectedSegmentColor; // Orange for selected segment
                        ctx.lineWidth = 4;

                        const rectX = tx - 5;
                        const rectY = ty - textDimensions.lineHeight + 2;
                        const rectWidth = textDimensions.width + 10;
                        const rectHeight = textDimensions.height + 6;

                        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

                        ctx.fillStyle = verticesColor;
                        ctx.beginPath();
                        ctx.arc(tx, ty, 4, 0, 2 * Math.PI);
                        ctx.fill();

                        // Step 4o) Other text elements...
                        // PERFORMANCE FIX: Skip if large selection
                        if (drawVerticesForThis) {
                            ctx.strokeStyle = nonSelectedSegmentColor;
                            ctx.lineWidth = 2;
                            entity.data.forEach((textData, index) => {
                                if (index !== kadObj.elementIndex) {
                                    const [otx, oty] = worldToCanvas(textData.pointXLocation, textData.pointYLocation);
                                    const otherTextDimensions = calculateTextDimensions(textData.text || "Text");

                                    const otherRectX = otx - 5;
                                    const otherRectY = oty - otherTextDimensions.lineHeight + 2;
                                    const otherRectWidth = otherTextDimensions.width + 10;
                                    const otherRectHeight = otherTextDimensions.height + 6;

                                    ctx.strokeRect(otherRectX, otherRectY, otherRectWidth, otherRectHeight);
                                }
                            });
                        }
                        break;
                }
            } else {
                if (developerModeEnabled) {
                    console.log("ERROR: No entity found for:", kadObj.entityName);
                }
                if (developerModeEnabled) {
                    console.log("Available entities in allKADDrawingsMap:");
                }
                const allKADDrawingsMap = window.allKADDrawingsMap;
                if (allKADDrawingsMap) {
                    for (const [name, ent] of allKADDrawingsMap.entries()) {
                        if (developerModeEnabled) {
                            console.log("  -", name, "type:", ent.entityType);
                        }
                    }
                }
            }

            // Step 4p) Restore original
            window.selectedKADObject = temp;
        });
    }

    // Step 5) Draw individual vertex highlight if selectedPoint is set
    const selectedPoint = window.selectedPoint;

    if (developerModeEnabled) {
        // DEBUG: Log what we're checking
        console.log("🔍 [2D Draw] Checking for pink vertex highlight:");
        console.log("  selectedPoint:", selectedPoint ? selectedPoint.pointID : "null");
        console.log("  selectedKADObject:", selectedKADObject ? selectedKADObject.entityName : "null");
    }

    if (selectedPoint && selectedKADObject) {
        if (developerModeEnabled) {
            console.log("✅ [2D Draw] BOTH conditions met - drawing pink circle");
        }
        let entity = getEntityFromKADObject(selectedKADObject);
        const allKADDrawingsMap = window.allKADDrawingsMap;
        if (!entity && allKADDrawingsMap) {
            // Try to get entity by name
            entity = allKADDrawingsMap.get(selectedKADObject.entityName);
        }

        if (entity && entity.data) {
            // Find the selected point
            const point = entity.data.find(function (p) { return p.pointID === selectedPoint.pointID; });
            if (point) {
                const canvasPos = worldToCanvas(point.pointXLocation, point.pointYLocation);

                // Draw pink circle for selected vertex
                ctx.beginPath();
                ctx.arc(canvasPos.x, canvasPos.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255, 68, 255, 0.4)"; // Pink with transparency
                ctx.fill();
                ctx.strokeStyle = "rgba(255, 68, 255, 1.0)"; // Solid pink
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }

    // Step 6) Draw multiple selected vertices (from TreeView multi-select)
    const selectedMultiplePoints = window.selectedMultiplePoints;
    if (selectedMultiplePoints && selectedMultiplePoints.length > 0) {
        selectedMultiplePoints.forEach(function (point) {
            if (point && point.pointXLocation !== undefined && point.pointYLocation !== undefined) {
                const canvasPos = worldToCanvas(point.pointXLocation, point.pointYLocation);

                // Draw pink circle for each selected vertex
                ctx.beginPath();
                ctx.arc(canvasPos.x, canvasPos.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255, 68, 255, 0.4)"; // Pink with transparency
                ctx.fill();
                ctx.strokeStyle = "rgba(255, 68, 255, 1.0)"; // Solid pink
                ctx.lineWidth = 2;
                ctx.stroke();

                if (developerModeEnabled) {
                    console.log("🩷 [2D] Drew pink circle for vertex:", point.pointID);
                }
            }
        });
    }
}

