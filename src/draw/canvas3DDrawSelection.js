/* prettier-ignore-file */
//=================================================
// canvas3DDrawSelection.js - 3D KAD Selection Visuals
// Mimics 2D selection highlighting for Three.js
//=================================================

import * as THREE from "three";
import { GeometryFactory } from "../three/GeometryFactory.js";

// Step 1) Highlight selected KAD objects in Three.js
// Mimics drawKADHighlightSelectionVisuals() for 2D canvas
export function highlightSelectedKADThreeJS() {
    // Step 1a) Check if Three.js is initialized
    if (!window.threeInitialized || !window.threeRenderer) {
        console.log("⚠️ highlightSelectedKADThreeJS - Three.js not initialized");
        return;
    }

    // Step 1b) Access globals from window object
    const selectedKADObject = window.selectedKADObject;
    const selectedMultipleKADObjects = window.selectedMultipleKADObjects;
    const isSelectionPointerActive = window.isSelectionPointerActive;
    const developerModeEnabled = window.developerModeEnabled;
    const getEntityFromKADObject = window.getEntityFromKADObject;
    const worldToThreeLocal = window.worldToThreeLocal;
    const dataCentroidZ = window.dataCentroidZ;

    if (developerModeEnabled) {
        console.log("=== 3D SELECTION DRAWING DEBUG ===");
        console.log("🎨 highlightSelectedKADThreeJS called:");
        console.log("  selectedKADObject:", selectedKADObject);
        console.log("  selectedMultipleKADObjects.length:", selectedMultipleKADObjects ? selectedMultipleKADObjects.length : 0);

        // Step 1c) Early exit if no selection
        if (!selectedKADObject && (!selectedMultipleKADObjects || selectedMultipleKADObjects.length === 0)) {
            console.log("  → Early exit: No KAD selection");
            return;
        }
    }

    // Step 1d) Define colors (match 2D)
    const selectedSegmentColor = "rgba(255, 68, 255, 0.8)";
    const selectedVertexColor = "rgba(255, 68, 255, 0.8)";
    const nonSelectedSegmentColor = "#00FF00"; // Green for non-selected segments
    const nonSelectedPointColor = "rgba(0, 255, 0, 0.5)"; // Green for non-selected points
    const verticesColor = "rgba(255,0,0,0.5)";

    // Step 2) Handle single selection
    if (selectedKADObject && isSelectionPointerActive) {
        const entity = getEntityFromKADObject(selectedKADObject);
        if (!entity) return;

        drawKADEntityHighlight(selectedKADObject, entity, selectedSegmentColor, nonSelectedSegmentColor, verticesColor, worldToThreeLocal, dataCentroidZ, developerModeEnabled);
    }

    // Step 3) Handle multiple selections
    // PERFORMANCE FIX 2025-12-28: Use BATCHED fat lines (LineSegments2) instead of individual MeshLine objects
    if (selectedMultipleKADObjects && selectedMultipleKADObjects.length > 0) {
        // Step 3.0) Count selected entities by type (same pattern as HUD stats)
        var kadPointCount = 0, kadLineCount = 0, kadPolyCount = 0, kadCircleCount = 0, kadTextCount = 0;
        for (var i = 0; i < selectedMultipleKADObjects.length; i++) {
            var type = selectedMultipleKADObjects[i].entityType;
            if (type === "point") kadPointCount++;
            else if (type === "line") kadLineCount++;
            else if (type === "poly") kadPolyCount++;
            else if (type === "circle") kadCircleCount++;
            else if (type === "text") kadTextCount++;
        }

        // Step 3.0a) Only draw vertices if NO type has more than 1 entity
        var maxTypeCount = Math.max(kadPointCount, kadLineCount, kadPolyCount, kadCircleCount, kadTextCount);
        var skipVertices3D = maxTypeCount > 1;

        // Step 3.0b) No render cap needed with batched approach - collect ALL segments
        var selectionCount = selectedMultipleKADObjects.length;
        
        console.log("🎨 Drawing 3D multiple KAD selections (BATCHED):", selectionCount, "objects");
        console.log("Type counts - Point:" + kadPointCount + " Line:" + kadLineCount + " Poly:" + kadPolyCount + " Circle:" + kadCircleCount + " Text:" + kadTextCount);
        console.log("Performance mode: skipVertices3D=" + skipVertices3D + " (maxTypeCount=" + maxTypeCount + ")");

        // Step 3.1) Collect ALL segments for batched rendering
        var greenSegments = [];  // Non-selected segments (green)
        var greenCircles = [];   // Non-selected circles
        
        selectedMultipleKADObjects.forEach(function(kadObj) {
            var entity = getEntityFromKADObject(kadObj);
            if (!entity || !entity.data) return;
            
            var entityType = kadObj.entityType || entity.entityType;
            
            if (entityType === "line" || entityType === "poly") {
                // Step 3.1a) Collect line/poly segments
                var points = entity.data;
                var isClosedShape = entityType === "poly";
                var numSegments = isClosedShape ? points.length : points.length - 1;
                
                for (var i = 0; i < numSegments; i++) {
                    var point1 = points[i];
                    var point2 = isClosedShape ? points[(i + 1) % points.length] : points[i + 1];
                    
                    var local1 = worldToThreeLocal(point1.pointXLocation, point1.pointYLocation);
                    var local2 = worldToThreeLocal(point2.pointXLocation, point2.pointYLocation);
                    
                    var z1 = point1.pointZLocation || dataCentroidZ || 0;
                    var z2 = point2.pointZLocation || dataCentroidZ || 0;
                    
                    greenSegments.push({
                        x1: local1.x, y1: local1.y, z1: z1,
                        x2: local2.x, y2: local2.y, z2: z2
                    });
                }
            } else if (entityType === "circle") {
                // Step 3.1b) Collect circles
                entity.data.forEach(function(circle) {
                    var centerX = circle.centerX || circle.pointXLocation;
                    var centerY = circle.centerY || circle.pointYLocation;
                    var centerZ = circle.centerZ || circle.pointZLocation || dataCentroidZ || 0;
                    var radius = circle.radius * 1.1 || 1;
                    var local = worldToThreeLocal(centerX, centerY);
                    
                    greenCircles.push({
                        cx: local.x, cy: local.y, cz: centerZ, radius: radius
                    });
                });
            }
            // Note: Points and Text entities are handled individually (they're already efficient)
        });
        
        // Step 3.2) Create batched highlight geometry (ONE object for all segments)
        var resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
        var greenLineWidth = 3;  // Pixel width for highlights
        
        if (greenSegments.length > 0) {
            var batchedLines = GeometryFactory.createBatchedHighlightLines(greenSegments, null, greenLineWidth, 0, resolution);
            if (batchedLines.greenLines) {
                batchedLines.greenLines.userData.type = "kadSelectionHighlight";
                window.threeRenderer.kadGroup.add(batchedLines.greenLines);
            }
        }
        
        if (greenCircles.length > 0) {
            var batchedCircles = GeometryFactory.createBatchedHighlightCircles(greenCircles, null, greenLineWidth, 0, resolution);
            if (batchedCircles.greenCircles) {
                batchedCircles.greenCircles.userData.type = "kadSelectionHighlight";
                window.threeRenderer.kadGroup.add(batchedCircles.greenCircles);
            }
        }
        
        console.log("✅ Batched highlights created - Segments:" + greenSegments.length + " Circles:" + greenCircles.length);
    }

    // Step 4) Draw individual vertex highlight if selectedPoint is set
    const selectedPoint = window.selectedPoint;

    if (developerModeEnabled) {// DEBUG: Log what we're checking
        console.log("🔍 [3D Draw] Checking for pink vertex highlight:");
        console.log("  selectedPoint:", selectedPoint ? selectedPoint.pointID : "null");
        console.log("  selectedKADObject:", selectedKADObject ? selectedKADObject.entityName : "null");
    }

    if (selectedPoint && selectedKADObject) {
        if (developerModeEnabled) {
            console.log("✅ [3D Draw] BOTH conditions met - drawing pink sphere");
        }
        const entity = getEntityFromKADObject(selectedKADObject);
        const allKADDrawingsMap = window.allKADDrawingsMap;
        let entityToUse = entity;
        if (!entityToUse && allKADDrawingsMap) {
            entityToUse = allKADDrawingsMap.get(selectedKADObject.entityName);
        }

        if (entityToUse && entityToUse.data) {
            // Find the selected point
            const point = entityToUse.data.find(function (p) { return p.pointID === selectedPoint.pointID; });
            if (point) {
                const localPos = worldToThreeLocal(point.pointXLocation, point.pointYLocation);
                // Step #) Use Z directly WITHOUT subtracting dataCentroidZ - must match entity vertex Z
                const worldZ = point.pointZLocation || dataCentroidZ || 0;

                // Use factory method for consistency (matches line 260 - selected segment vertex)
                const sphere = GeometryFactory.createKADPointHighlight(
                    localPos.x,
                    localPos.y,
                    worldZ,
                    1.0, // radius - matches selected segment vertex
                    selectedVertexColor // Pink
                );
                sphere.userData.type = "vertexSelectionHighlight";
                window.threeRenderer.kadGroup.add(sphere);
            }
        }
    }

    // Step 5) Draw multiple selected vertices (from TreeView multi-select)
    const selectedMultiplePoints = window.selectedMultiplePoints;
    if (selectedMultiplePoints && selectedMultiplePoints.length > 0) {
        selectedMultiplePoints.forEach(function (point) {
            if (point && point.pointXLocation !== undefined && point.pointYLocation !== undefined) {
                const localPos = worldToThreeLocal(point.pointXLocation, point.pointYLocation);
                // Step #) Use Z directly WITHOUT subtracting dataCentroidZ - must match entity vertex Z
                const worldZ = point.pointZLocation || dataCentroidZ || 0;

                // Use factory method for consistency
                const sphere = GeometryFactory.createKADPointHighlight(
                    localPos.x,
                    localPos.y,
                    worldZ,
                    1.0, // radius - matches selected segment vertex
                    selectedVertexColor // Pink
                );
                sphere.userData.type = "vertexSelectionHighlight";
                window.threeRenderer.kadGroup.add(sphere);

                if (developerModeEnabled) {
                    console.log("🩷 [3D] Drew pink sphere for vertex:", point.pointID);
                }
            }
        });
    }
}

// Step 4) Draw highlight for a single KAD entity
// skipVertices parameter controls whether to skip vertex geometry for performance
function drawKADEntityHighlight(kadObject, entity, selectedSegmentColor, nonSelectedSegmentColor, verticesColor, worldToThreeLocal, dataCentroidZ, developerModeEnabled, skipVertices) {
    // Step 4a) Create group for highlights
    const highlightGroup = new THREE.Group();
    highlightGroup.userData = {
        type: "kadSelectionHighlight",
        kadId: kadObject.entityName
    };

    // Step 4a.1) Convert snap tolerance from pixels to world units to match selection tolerance
    const snapRadiusPixels = window.snapRadiusPixels || 20;
    const currentScale = window.currentScale || 5;
    const tolerance = snapRadiusPixels / currentScale; // 3D tolerance in world units

    // Debug: Check entityType
    const entityType = kadObject.entityType || entity.entityType;
    if (developerModeEnabled) {
        console.log("🔍 drawKADEntityHighlight - entityName:", kadObject.entityName, "entityType:", entityType);
    }

    switch (entityType) {
        case "point":
            // Step 4b) Highlight points
            entity.data.forEach((point, index) => {
                const local = worldToThreeLocal(point.pointXLocation, point.pointYLocation);
                const z = point.pointZLocation || dataCentroidZ || 0;

                // Step 4b.1) Selected point gets magenta highlight
                if (index === kadObject.elementIndex) {
                    const sphere = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 1, selectedSegmentColor);
                    highlightGroup.add(sphere);
                } else {
                    // Step 4b.2) Other points get green highlight
                    const sphere = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 1, nonSelectedSegmentColor);
                    highlightGroup.add(sphere);
                }

                // Step 4b.3) Add red vertex markers for all points - SKIP if large selection
                if (!skipVertices) {
                    const vertex = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 0.5, verticesColor);
                    highlightGroup.add(vertex);
                }
            });
            break;

        case "line":
        case "poly":
            // Step 4c) Highlight line/poly segments using tube geometry (unified - only difference is closed vs open)
            const points = entity.data;
            const isClosedShape = entityType === "poly";
            const numSegments = isClosedShape ? points.length : points.length - 1;

            if (developerModeEnabled) {
                console.log("🎨 [3D HIGHLIGHT] Drawing " + entityType + " with " + numSegments + " segments, isClosedShape:", isClosedShape);
            }

            // Step 4c.1) Base radius for tube highlights (in world units)
            // Non-selected segments use smaller radius, selected uses larger
            const baseRadiusNonSelected = 0.3; // Base radius for non-selected segments
            const baseRadiusSelected = 0.6; // Base radius for selected segment

            // Step 4c.2) Draw ALL segments first with standard green highlighting
            for (let i = 0; i < numSegments; i++) {
                const point1 = points[i];
                const point2 = isClosedShape ? points[(i + 1) % points.length] : points[i + 1];

                const local1 = worldToThreeLocal(point1.pointXLocation, point1.pointYLocation);
                const local2 = worldToThreeLocal(point2.pointXLocation, point2.pointYLocation);

                const z1 = point1.pointZLocation || dataCentroidZ || 0;
                const z2 = point2.pointZLocation || dataCentroidZ || 0;

                // Draw green segment (non-selected) using tube geometry
                const lineMesh = GeometryFactory.createKADLineHighlight(local1.x, local1.y, z1, local2.x, local2.y, z2, baseRadiusNonSelected, nonSelectedSegmentColor);
                highlightGroup.add(lineMesh);
            }

            // Step 4c.3) Then overdraw ONLY the selected segment in magenta
            if (kadObject.selectionType === "segment" && kadObject.segmentIndex !== undefined) {
                const segmentIndex = kadObject.segmentIndex;
                if (segmentIndex >= 0 && segmentIndex < numSegments) {
                    const point1 = points[segmentIndex];
                    const point2 = isClosedShape ? points[(segmentIndex + 1) % points.length] : points[segmentIndex + 1];

                    const local1 = worldToThreeLocal(point1.pointXLocation, point1.pointYLocation);
                    const local2 = worldToThreeLocal(point2.pointXLocation, point2.pointYLocation);

                    const z1 = point1.pointZLocation || dataCentroidZ || 0;
                    const z2 = point2.pointZLocation || dataCentroidZ || 0;

                    // Overdraw with thicker magenta segment using tube geometry
                    const selectedLineMesh = GeometryFactory.createKADLineHighlight(local1.x, local1.y, z1, local2.x, local2.y, z2, baseRadiusSelected, selectedSegmentColor);
                    highlightGroup.add(selectedLineMesh);

                    if (developerModeEnabled) {
                        console.log("🎨 [3D HIGHLIGHT] Drawing selected segment " + segmentIndex + " in magenta for " + kadObject.entityType);
                    }
                }
            }

            // Step 4c.4) Draw vertices for all points - SKIP if large selection
            if (!skipVertices) {
                points.forEach((point, index) => {
                    const local = worldToThreeLocal(point.pointXLocation, point.pointYLocation);
                    const z = point.pointZLocation || dataCentroidZ || 0;

                    // Step 4c.4a) If this is the start vertex of the selected segment, draw it in magenta
                    const isSelectedSegmentVertex = kadObject.selectionType === "segment" && kadObject.segmentIndex === index;

                    if (isSelectedSegmentVertex) {
                        // Larger magenta sphere for selected segment's start vertex (with zoom scaling)
                        const selectedVertex = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 1.0, selectedSegmentColor);
                        highlightGroup.add(selectedVertex);
                    } else {
                        // Standard red vertex marker (with zoom scaling)
                        const vertex = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 0.5, verticesColor);
                        highlightGroup.add(vertex);
                    }
                });
            }
            break;

        case "circle":
            // Step 4e) Highlight circles
            entity.data.forEach((circle, index) => {
                const centerX = circle.centerX || circle.pointXLocation;
                const centerY = circle.centerY || circle.pointYLocation;
                const centerZ = circle.centerZ || circle.pointZLocation || dataCentroidZ || 0;
                const radius = circle.radius * 1.1 || 1;

                const local = worldToThreeLocal(centerX, centerY);

                // Step 4e.1) Selected circle gets magenta highlight
                if (index === kadObject.elementIndex) {
                    const circleMesh = GeometryFactory.createKADCircleHighlight(local.x, local.y, centerZ, radius, 30, selectedSegmentColor);
                    highlightGroup.add(circleMesh);

                    // Step 4e.2) Add center point - SKIP if large selection
                    if (!skipVertices) {
                        const centerPoint = GeometryFactory.createKADPointHighlight(local.x, local.y, centerZ, 0.5, verticesColor);
                        highlightGroup.add(centerPoint);
                    }
                } else {
                    // Step 4e.3) Other circles get green highlight
                    const circleMesh = GeometryFactory.createKADCircleHighlight(local.x, local.y, centerZ, radius, 30, nonSelectedSegmentColor);
                    highlightGroup.add(circleMesh);
                }
            });
            break;

        case "text":
            // Step 4f) Highlight text (match troika text dimensions)
            entity.data.forEach((textData, index) => {
                const local = worldToThreeLocal(textData.pointXLocation, textData.pointYLocation);
                const z = textData.pointZLocation || dataCentroidZ || 0;

                // Step 4f.1) Calculate text dimensions matching GeometryFactory.createKADText()
                // Troika text uses fontSize / currentScale for world units
                const fontSize = textData.fontSize || 12;
                const text = textData.text || "Text";
                const currentScale = window.currentScale || 5;
                const fontSizeWorldUnits = fontSize / currentScale; // Match GeometryFactory scaling

                // Step 4f.1a) Estimate width based on character count (more accurate than fixed width)
                const charWidth = fontSizeWorldUnits * 0.6; // Approximate character width
                const textWidth = text.length * charWidth;
                const textHeight = fontSizeWorldUnits;

                // Step 4f.1b) Make highlight box slightly larger for visibility
                const width = textWidth * 1.2;
                const height = textHeight * 1.5;

                // Step 4f.2) Selected text gets magenta box
                if (index === kadObject.elementIndex) {
                    const boxHighlight = GeometryFactory.createKADTextBoxHighlight(local.x, local.y, z, width, height, selectedSegmentColor);
                    highlightGroup.add(boxHighlight);

                    // Step 4f.3) Add anchor point - SKIP if large selection
                    if (!skipVertices) {
                        const anchorPoint = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 0.5, verticesColor);
                        highlightGroup.add(anchorPoint);
                    }
                } else {
                    // Step 4f.4) Other text gets green box
                    const boxHighlight = GeometryFactory.createKADTextBoxHighlight(local.x, local.y, z, width, height, nonSelectedSegmentColor);
                    highlightGroup.add(boxHighlight);
                }
            });
            break;
    }

    // Step 5) Add highlight group to scene
    const childCount = highlightGroup.children.length;
    if (developerModeEnabled) {
        console.log("✅ Adding highlight group to scene - Children count:", childCount, "for entity:", kadObject.entityName);
    }
    window.threeRenderer.kadGroup.add(highlightGroup);
    if (developerModeEnabled) {
        console.log("✓ Highlight group added to kadGroup");
    }
}
