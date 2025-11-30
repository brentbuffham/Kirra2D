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
	const selectedSegmentColor = "rgba(255, 68, 255, 0.8)"; // Magenta
	const nonSelectedSegmentColor = "#00FF00"; // Green
	const verticesColor = "rgba(255,0,0,0.5)"; // Red

	// Step 2) Handle single selection
	if (selectedKADObject && isSelectionPointerActive) {
		const entity = getEntityFromKADObject(selectedKADObject);
		if (!entity) return;

		drawKADEntityHighlight(selectedKADObject, entity, selectedSegmentColor, nonSelectedSegmentColor, verticesColor, worldToThreeLocal, dataCentroidZ, developerModeEnabled);
	}

	// Step 3) Handle multiple selections
	if (selectedMultipleKADObjects && selectedMultipleKADObjects.length > 0) {
		console.log("🎨 Drawing 3D multiple KAD selections:", selectedMultipleKADObjects.length, "objects");

		selectedMultipleKADObjects.forEach((kadObj, index) => {
			if (index < 3) {
				console.log("=== DRAWING 3D KAD OBJECT " + index + " ===");
				console.log("kadObj:", kadObj);
				console.log("kadObj.entityName:", kadObj.entityName);
				console.log("kadObj.entity:", kadObj.entity);
			}

			const entity = getEntityFromKADObject(kadObj);
			if (index < 3) {
				console.log("Entity from getEntityFromKADObject:", entity);
			}

			if (entity) {
				if (index < 3) {
					console.log("✓ Drawing highlight for:", kadObj.entityName, "entityType:", kadObj.entityType || entity.entityType);
				}
				drawKADEntityHighlight(kadObj, entity, selectedSegmentColor, nonSelectedSegmentColor, verticesColor, worldToThreeLocal, dataCentroidZ, developerModeEnabled);
			} else {
				console.log("❌ ERROR: No entity found for:", kadObj.entityName);
			}
		});

		console.log("✅ Finished drawing all KAD highlights");
	}
}

// Step 4) Draw highlight for a single KAD entity
function drawKADEntityHighlight(kadObject, entity, selectedSegmentColor, nonSelectedSegmentColor, verticesColor, worldToThreeLocal, dataCentroidZ, developerModeEnabled) {
	// Step 4a) Create group for highlights
	const highlightGroup = new THREE.Group();
	highlightGroup.userData = {
		type: "kadSelectionHighlight",
		kadId: kadObject.entityName,
	};

	// Step 4a.1) Convert snap tolerance from pixels to world units to match selection tolerance
	const snapRadiusPixels = window.snapRadiusPixels || 20;
	const currentScale = window.currentScale || 5;
	const tolerance = snapRadiusPixels / currentScale; // 3D tolerance in world units

	// Debug: Check entityType
	const entityType = kadObject.entityType || entity.entityType;
	console.log("🔍 drawKADEntityHighlight - entityName:", kadObject.entityName, "entityType:", entityType);

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

				// Step 4b.3) Add red vertex markers for all points
				const vertex = GeometryFactory.createKADPointHighlight(local.x, local.y, z, 0.5, verticesColor);
				highlightGroup.add(vertex);
			});
			break;

		case "line":
		case "poly":
			// Step 4c) Highlight line/poly segments using tube geometry (unified - only difference is closed vs open)
			const points = entity.data;
			const isClosedShape = entityType === "poly";
			const numSegments = isClosedShape ? points.length : points.length - 1;

			console.log("🎨 [3D HIGHLIGHT] Drawing " + entityType + " with " + numSegments + " segments, isClosedShape:", isClosedShape);

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

			// Step 4c.4) Draw vertices for all points (with zoom-based scaling)
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
	const childCount = highlightGroup.children.length;
	console.log("✅ Adding highlight group to scene - Children count:", childCount, "for entity:", kadObject.entityName);
	window.threeRenderer.kadGroup.add(highlightGroup);
	console.log("✓ Highlight group added to kadGroup");
}
