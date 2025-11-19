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
    if (!window.threeInitialized || !window.threeRenderer) return;

    // Step 1b) Access globals from window object
    const selectedKADObject = window.selectedKADObject;
    const selectedMultipleKADObjects = window.selectedMultipleKADObjects;
    const isSelectionPointerActive = window.isSelectionPointerActive;
    const developerModeEnabled = window.developerModeEnabled;
    const getEntityFromKADObject = window.getEntityFromKADObject;
    const worldToThreeLocal = window.worldToThreeLocal;
    const dataCentroidZ = window.dataCentroidZ;

    // Step 1c) Early exit if no selection
    if (!selectedKADObject && (!selectedMultipleKADObjects || selectedMultipleKADObjects.length === 0)) return;

    if (developerModeEnabled) {
        console.log("=== 3D SELECTION DRAWING DEBUG ===");
        console.log("selectedKADObject:", selectedKADObject);
        console.log("isSelectionPointerActive:", isSelectionPointerActive);
        console.log("selectedMultipleKADObjects:", selectedMultipleKADObjects);
    }

    // Step 1d) Define colors (match 2D)
    const selectedSegmentColor = "rgba(255, 68, 255, 0.8)"; // Magenta
    const nonSelectedSegmentColor = "#00FF00"; // Green
    const verticesColor = "rgba(255,0,0,0.5)"; // Red

    // Step 2) Handle single selection
    if (selectedKADObject && isSelectionPointerActive) {
        const entity = getEntityFromKADObject(selectedKADObject);
        if (!entity) return;

        drawKADEntityHighlight(
            selectedKADObject,
            entity,
            selectedSegmentColor,
            nonSelectedSegmentColor,
            verticesColor,
            worldToThreeLocal,
            dataCentroidZ,
            developerModeEnabled
        );
    }

    // Step 3) Handle multiple selections
    if (selectedMultipleKADObjects && selectedMultipleKADObjects.length > 0) {
        if (developerModeEnabled) {
            console.log("Drawing 3D multiple selections:", selectedMultipleKADObjects.length, "objects");
        }

        selectedMultipleKADObjects.forEach((kadObj, index) => {
            if (developerModeEnabled) {
                console.log("=== DRAWING 3D OBJECT " + index + " ===");
                console.log("kadObj:", kadObj);
            }

            const entity = getEntityFromKADObject(kadObj);
            if (entity) {
                drawKADEntityHighlight(
                    kadObj,
                    entity,
                    selectedSegmentColor,
                    nonSelectedSegmentColor,
                    verticesColor,
                    worldToThreeLocal,
                    dataCentroidZ,
                    developerModeEnabled
                );
            } else {
                console.log("ERROR: No entity found for:", kadObj.entityName);
            }
        });
    }
}

// Step 4) Draw highlight for a single KAD entity
function drawKADEntityHighlight(
    kadObject,
    entity,
    selectedSegmentColor,
    nonSelectedSegmentColor,
    verticesColor,
    worldToThreeLocal,
    dataCentroidZ,
    developerModeEnabled
) {
    // Step 4a) Create group for highlights
    const highlightGroup = new THREE.Group();
    highlightGroup.userData = {
        type: "kadSelectionHighlight",
        kadId: kadObject.entityName
    };

    const tolerance = window.snapRadiusPixels || 1; // 3D tolerance in world units

    switch (kadObject.entityType) {
        case "point":
            // Step 4b) Highlight points
            entity.data.forEach((point, index) => {
                const local = worldToThreeLocal(point.pointXLocation, point.pointYLocation);
                const z = point.pointZLocation || dataCentroidZ || 0;

                // Step 4b.1) Selected point gets magenta highlight
                if (index === kadObject.elementIndex) {
                    const sphere = GeometryFactory.createKADPointHighlight(
                        local.x,
                        local.y,
                        z,
                        tolerance + 0.3,
                        selectedSegmentColor
                    );
                    highlightGroup.add(sphere);
                } else {
                    // Step 4b.2) Other points get green highlight
                    const sphere = GeometryFactory.createKADPointHighlight(local.x, local.y, z, tolerance, nonSelectedSegmentColor);
                    highlightGroup.add(sphere);
                }

                // Step 4b.3) Add red vertex markers for all points
                const vertex = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 0.5, verticesColor);
                highlightGroup.add(vertex);
            });
            break;

        case "line":
            // Step 4c) Highlight line segments
            entity.data.forEach((point, index) => {
                if (index > 0) {
                    const prevPoint = entity.data[index - 1];
                    const currentPoint = point;

                    const prevLocal = worldToThreeLocal(prevPoint.pointXLocation, prevPoint.pointYLocation);
                    const currentLocal = worldToThreeLocal(currentPoint.pointXLocation, currentPoint.pointYLocation);

                    const prevZ = prevPoint.pointZLocation || dataCentroidZ || 0;
                    const currentZ = currentPoint.pointZLocation || dataCentroidZ || 0;

                    // Step 4c.1) Check if this is the selected segment
                    const isSelectedSegment = kadObject.selectionType === "segment" && kadObject.segmentIndex === index - 1;

                    // Step 4c.2) Draw segment with appropriate color
                    const lineColor = isSelectedSegment ? selectedSegmentColor : nonSelectedSegmentColor;
                    const lineWidth = isSelectedSegment ? 5 : 2;

                    const lineMesh = GeometryFactory.createKADLineHighlight(
                        prevLocal.x,
                        prevLocal.y,
                        prevZ,
                        currentLocal.x,
                        currentLocal.y,
                        currentZ,
                        lineWidth * 15,
                        lineColor
                    );
                    highlightGroup.add(lineMesh);
                }
            });

            // Step 4c.3) Draw vertices
            entity.data.forEach((point) => {
                const local = worldToThreeLocal(point.pointXLocation, point.pointYLocation);
                const z = point.pointZLocation || dataCentroidZ || 0;
                const vertex = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 0.5, verticesColor);
                highlightGroup.add(vertex);
            });
            break;

        case "poly":
            // Step 4d) Highlight polygon segments
            const polygonPoints = entity.data;

            for (let i = 0; i < polygonPoints.length; i++) {
                const point1 = polygonPoints[i];
                const point2 = polygonPoints[(i + 1) % polygonPoints.length];

                const local1 = worldToThreeLocal(point1.pointXLocation, point1.pointYLocation);
                const local2 = worldToThreeLocal(point2.pointXLocation, point2.pointYLocation);

                const z1 = point1.pointZLocation || dataCentroidZ || 0;
                const z2 = point2.pointZLocation || dataCentroidZ || 0;

                // Step 4d.1) Check if this is the selected segment
                const isSelectedSegment = kadObject.selectionType === "segment" && kadObject.segmentIndex === i;

                // Step 4d.2) Draw segment with appropriate color
                const lineColor = isSelectedSegment ? selectedSegmentColor : nonSelectedSegmentColor;
                const lineWidth = isSelectedSegment ? 5 : 2;

                const lineMesh = GeometryFactory.createKADLineHighlight(local1.x, local1.y, z1, local2.x, local2.y, z2, lineWidth * 15, lineColor);
                highlightGroup.add(lineMesh);
            }

            // Step 4d.3) Draw vertices
            polygonPoints.forEach((point) => {
                const local = worldToThreeLocal(point.pointXLocation, point.pointYLocation);
                const z = point.pointZLocation || dataCentroidZ || 0;
                const vertex = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 0.5, verticesColor);
                highlightGroup.add(vertex);
            });
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

                    // Step 4e.2) Add center point
                    const centerPoint = GeometryFactory.createKADPointHighlight(local.x, local.y, centerZ, 0.5, verticesColor);
                    highlightGroup.add(centerPoint);
                } else {
                    // Step 4e.3) Other circles get green highlight
                    const circleMesh = GeometryFactory.createKADCircleHighlight(local.x, local.y, centerZ, radius, 30, nonSelectedSegmentColor);
                    highlightGroup.add(circleMesh);
                }
            });
            break;

        case "text":
            // Step 4f) Highlight text
            entity.data.forEach((textData, index) => {
                const local = worldToThreeLocal(textData.pointXLocation, textData.pointYLocation);
                const z = textData.pointZLocation || dataCentroidZ || 0;

                // Step 4f.1) Estimate text dimensions (rough approximation for 3D)
                const text = textData.text || "Text";
                const fontSize = textData.fontSize || 12;
                const charWidth = fontSize * 0.6; // Approximate character width
                const lineHeight = fontSize * 1.2;
                const lines = text.split("\n");
                const maxLineLength = Math.max(...lines.map((line) => line.length));
                const width = maxLineLength * charWidth;
                const height = lines.length * lineHeight;

                // Step 4f.2) Selected text gets magenta box
                if (index === kadObject.elementIndex) {
                    const boxHighlight = GeometryFactory.createKADTextBoxHighlight(local.x, local.y, z, width, height, selectedSegmentColor);
                    highlightGroup.add(boxHighlight);

                    // Step 4f.3) Add anchor point
                    const anchorPoint = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 0.5, verticesColor);
                    highlightGroup.add(anchorPoint);
                } else {
                    // Step 4f.4) Other text gets green box
                    const boxHighlight = GeometryFactory.createKADTextBoxHighlight(local.x, local.y, z, width, height, nonSelectedSegmentColor);
                    highlightGroup.add(boxHighlight);
                }
            });
            break;
    }

    // Step 5) Add highlight group to scene
    window.threeRenderer.kadGroup.add(highlightGroup);
}

