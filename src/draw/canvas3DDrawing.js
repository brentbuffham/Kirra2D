/* prettier-ignore-file */
//=================================================
// canvas3DDrawing.js - Three.js Drawing Functions
//=================================================
// All Three.js/WebGL drawing functions extracted from kirra.js
// This module handles 3D rendering using Three.js

import * as THREE from "three";
import { GeometryFactory } from "../three/GeometryFactory.js";

// Note: These functions access global variables from kirra.js via window object:
// - threeInitialized, threeRenderer, worldToThreeLocal
// - holeScale, currentScale, darkModeEnabled
// - currentFontSize, textFillColor, depthColor, angleDipColor
// - elevationToColor, rgbStringToThreeColor, dataCentroidZ

//=================================================
// Helper Functions
//=================================================

// Step 0) Convert hex color string to Three.js color object {r, g, b}
function hexToThreeColor(hexColor) {
	// Step 0a) Default to grey if no color provided
	if (!hexColor) {
		console.log("🎨 [hexToThreeColor] No color provided, using grey");
		return { r: 0.5, g: 0.5, b: 0.5 };
	}
	
	// Step 0b) Handle various formats
	var hex = String(hexColor).trim();
	
	// Step 0c) Remove # prefix if present
	if (hex.charAt(0) === "#") {
		hex = hex.substring(1);
	}
	
	// Step 0d) Handle 3-digit hex (e.g., "F0F" -> "FF00FF")
	if (hex.length === 3) {
		hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
	}
	
	// Step 0e) Parse hex values
	var r = parseInt(hex.substring(0, 2), 16) / 255;
	var g = parseInt(hex.substring(2, 4), 16) / 255;
	var b = parseInt(hex.substring(4, 6), 16) / 255;
	
	// Step 0f) Validate parsed values
	if (isNaN(r) || isNaN(g) || isNaN(b)) {
		console.log("🎨 [hexToThreeColor] Failed to parse color: " + hexColor + ", using grey");
		return { r: 0.5, g: 0.5, b: 0.5 }; // Default grey
	}
	
	console.log("🎨 [hexToThreeColor] Parsed " + hexColor + " -> rgb(" + Math.round(r * 255) + ", " + Math.round(g * 255) + ", " + Math.round(b * 255) + ")");
	return { r: r, g: g, b: b };
}

//=================================================
// Three.js Scene Management
//=================================================

// Step 1) Clear all Three.js geometry
export function clearThreeJS() {
	if (window.threeInitialized && window.threeRenderer) {
		window.threeRenderer.clearAllGeometry();
	}
}

// Step 2) Request render for Three.js
export function renderThreeJS() {
	if (window.threeInitialized && window.threeRenderer) {
		// Step 13a) Update orbit center Z before rendering
		window.threeRenderer.setOrbitCenterZ(window.dataCentroidZ);

		// Step 14) Just render - don't override camera state
		// Camera is controlled by CameraControls, not synced from 2D
		window.threeRenderer.requestRender();
	}
}

//=================================================
// Hole Drawing Functions (3D)
//=================================================

// Step 3) Draw complete hole in Three.js (collar + grade line + toe line)
export function drawHoleThreeJS(hole) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	// Step 1) Extract hole positions (world coordinates)
	const collarWorld = { x: hole.startXLocation, y: hole.startYLocation };
	const gradeWorld = { x: hole.gradeXLocation, y: hole.gradeYLocation };
	const toeWorld = { x: hole.endXLocation, y: hole.endYLocation };

	// Step 2) Convert to local Three.js coordinates for precision
	const collarLocal = window.worldToThreeLocal(collarWorld.x, collarWorld.y);
	const gradeLocal = window.worldToThreeLocal(gradeWorld.x, gradeWorld.y);
	const toeLocal = window.worldToThreeLocal(toeWorld.x, toeWorld.y);

	// Z coordinates stay as-is (relative elevations)
	const collarZ = hole.startZLocation || 0;
	const gradeZ = hole.gradeZLocation || 0;
	const toeZ = hole.endZLocation || 0;

	let holeGroup;

	// Step 3) Determine hole type and create appropriate geometry
	const holeLength = parseFloat(hole.holeLengthCalculated);
	const holeDiameter = parseFloat(hole.holeDiameter);

	if (holeLength === 0 || isNaN(holeLength)) {
		// Step 3a) Dummy hole (no length) - draw cross/X
		const crossSize = 0.2 * window.holeScale; // 200mm * holeScale
		const color = window.darkModeEnabled ? 0xffffff : 0x000000;
		holeGroup = GeometryFactory.createDummyHole(collarLocal.x, collarLocal.y, collarZ, crossSize, color);
	} else if (holeDiameter === 0 || isNaN(holeDiameter)) {
		// Step 3b) Zero diameter hole - draw unfilled square
		const squareSize = 10 / window.currentScale; // 10 pixels converted to world units, influenced by scale
		const color = window.darkModeEnabled ? 0xffffff : 0x000000;
		holeGroup = GeometryFactory.createZeroDiameterHole(collarLocal.x, collarLocal.y, collarZ, gradeLocal.x, gradeLocal.y, gradeZ, toeLocal.x, toeLocal.y, toeZ, squareSize, hole.subdrillAmount || 0, window.darkModeEnabled);
	} else {
		// Step 3c) Normal hole - full visualization
		holeGroup = GeometryFactory.createHole(collarLocal.x, collarLocal.y, collarZ, gradeLocal.x, gradeLocal.y, gradeZ, toeLocal.x, toeLocal.y, toeZ, hole.holeDiameter, hole.holeColor || "#FF0000", window.holeScale, hole.subdrillAmount || 0, window.darkModeEnabled);
	}

	// Step 4) Add metadata for interaction/selection
	// IMPORTANT: holeId must be UNIQUE per hole, not just the entityName (which is shared by all holes in a pattern)
	// Use entityName + ":::" + holeID to create a unique identifier (matching 2D selection logic)
	const uniqueHoleId = hole.entityName + ":::" + hole.holeID;

	holeGroup.userData = {
		type: "hole",
		holeId: uniqueHoleId, // Unique identifier for selection (entityName:::holeID)
		entityName: hole.entityName, // Pattern/entity name
		holeID: hole.holeID, // Display name (hole number)
		holeData: hole, // Full hole data for tooltips/info
	};

	// Step 4a) Also set userData on all child meshes for raycasting
	holeGroup.traverse((child) => {
		if (child.isMesh || child.isLine || child.isPoints) {
			// Copy userData to children so raycast hits work
			child.userData = Object.assign({}, holeGroup.userData, child.userData);
		}
	});

	window.threeRenderer.holesGroup.add(holeGroup);
	window.threeRenderer.holeMeshMap.set(hole.holeID, holeGroup);
}

// Step 4) Draw hole toe in Three.js
export function drawHoleToeThreeJS(worldX, worldY, worldZ, radius, color, holeId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	// Step 4a) Convert world coordinates to local Three.js coordinates for precision
	const local = window.worldToThreeLocal(worldX, worldY);

	// Step 4b) Create toe mesh at local coordinates
	let color2;
	if (window.darkModeEnabled) {
		color2 = "rgb(94, 172, 255)";
	} else {
		color2 = "rgb(38, 255, 0)";
	}
	const toeMesh = GeometryFactory.createHoleToe(local.x, local.y, worldZ, radius, color2);

	// Step 4c) Add metadata for selection
	toeMesh.userData = {
		type: "holeToe",
		holeId: holeId,
	};

	window.threeRenderer.holesGroup.add(toeMesh);
}

// Step 5) Draw hole label text in Three.js
export function drawHoleTextThreeJS(worldX, worldY, worldZ, text, fontSize, color, anchorX = "center") {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!text || text === "" || text === "null" || text === "undefined") return;

	const local = window.worldToThreeLocal(worldX, worldY);
	const textSprite = GeometryFactory.createKADText(local.x, local.y, worldZ, String(text), fontSize, color, null, anchorX);

	// Step 5a) Only add if not already in group (cached objects might already be there)
	if (!textSprite.parent) {
		window.threeRenderer.holesGroup.add(textSprite); // Hole text goes to holesGroup
	}
}

// Step 6) Draw all hole labels in Three.js
export function drawHoleTextsAndConnectorsThreeJS(hole, displayOptions) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const fontSize = parseInt(window.currentFontSize) || 12;

	// Step 0) EXACTLY match 2D: use worldToCanvas to get canvas coords, apply pixel offsets, convert back
	// In 2D: [x, y] = worldToCanvas(hole.startXLocation, hole.startYLocation) then apply pixel offsets
	const [collarCanvasX, collarCanvasY] = window.worldToCanvas(hole.startXLocation, hole.startYLocation);
	const [toeCanvasX, toeCanvasY] = window.worldToCanvas(hole.endXLocation, hole.endYLocation);

	// Step 0a) Calculate text offsets EXACTLY like 2D (in pixels)
	const textOffset = parseInt((hole.holeDiameter / 1000) * window.holeScale * window.currentScale);

	// Step 0b) Calculate canvas positions EXACTLY like 2D (matching kirra.js lines 21424-21434)
	const leftSideToe = parseInt(toeCanvasX) - textOffset;
	const rightSideToe = parseInt(toeCanvasX) + textOffset;
	const leftSideCollar = parseInt(collarCanvasX) - textOffset;
	const rightSideCollar = parseInt(collarCanvasX) + textOffset;
	const topSideToe = parseInt(toeCanvasY - textOffset);
	const middleSideToe = parseInt(toeCanvasY + textOffset + parseInt(fontSize / 4));
	const bottomSideToe = parseInt(toeCanvasY + textOffset + fontSize);
	const topSideCollar = parseInt(collarCanvasY - textOffset);
	const middleSideCollar = parseInt(collarCanvasY + parseInt(fontSize / 2));
	const bottomSideCollar = parseInt(collarCanvasY + textOffset + fontSize);

	// Step 0c) Convert canvas pixel coordinates back to world coordinates (inverse of worldToCanvas)
	// worldToCanvas: [(x - centroidX) * currentScale + canvas.width / 2, (-y + centroidY) * currentScale + canvas.height / 2]
	// Inverse: [(canvasX - canvas.width / 2) / currentScale + centroidX, -(canvasY - canvas.height / 2) / currentScale + centroidY]
	// Note: centroidX/Y are local variables, so we reverse-engineer them from known world/canvas pairs
	const canvas = window.canvas;
	const currentScale = window.currentScale;

	if (!canvas || !currentScale) {
		console.warn("⚠️ Canvas or currentScale not available, skipping text rendering");
		return; // Skip text rendering if we can't convert properly
	}

	// Reverse-engineer centroid from known world/canvas coordinate pair
	// Using collar position: canvas = (world - centroid) * scale + canvas.width/2
	// Solving for centroid: centroid = world - (canvas - canvas.width/2) / scale
	const centroidX = hole.startXLocation - (collarCanvasX - canvas.width / 2) / currentScale;
	const centroidY = hole.startYLocation + (collarCanvasY - canvas.height / 2) / currentScale; // Note: Y is flipped

	const canvasToWorld = (canvasX, canvasY) => {
		const worldX = (canvasX - canvas.width / 2) / currentScale + centroidX;
		const worldY = -(canvasY - canvas.height / 2) / currentScale + centroidY;
		return { x: worldX, y: worldY };
	};

	// Step 0d) Convert all canvas positions to world coordinates
	const leftSideCollarWorld = canvasToWorld(leftSideCollar, topSideCollar);
	const rightSideCollarWorld = canvasToWorld(rightSideCollar, topSideCollar);
	const leftSideToeWorld = canvasToWorld(leftSideToe, topSideToe);
	const rightSideToeWorld = canvasToWorld(rightSideToe, topSideToe);
	const middleSideCollarWorld = canvasToWorld(rightSideCollar, middleSideCollar);
	const bottomSideCollarWorld = canvasToWorld(rightSideCollar, bottomSideCollar);
	const middleSideToeWorld = canvasToWorld(leftSideToe, middleSideToe);
	const bottomSideToeWorld = canvasToWorld(leftSideToe, bottomSideToe);

	// Extract world coordinates
	const collarX = hole.startXLocation;
	const collarY = hole.startYLocation;
	const collarZ = hole.startZLocation || 0;
	const toeX = hole.endXLocation;
	const toeY = hole.endYLocation;
	const toeZ = hole.endZLocation || 0;

	// Step 3) Draw text at calculated world positions (matching 2D positioning exactly)
	// drawHoleTextThreeJS will convert world coords to local internally
	if (displayOptions.holeID) {
		drawHoleTextThreeJS(rightSideCollarWorld.x, rightSideCollarWorld.y, collarZ, hole.holeID, fontSize / 1.5, window.textFillColor, "left");
	}
	if (displayOptions.holeDia) {
		drawHoleTextThreeJS(middleSideCollarWorld.x, middleSideCollarWorld.y, collarZ, parseFloat(hole.holeDiameter).toFixed(0), fontSize / 1.5, "green", "left");
	}
	if (displayOptions.holeLen) {
		drawHoleTextThreeJS(bottomSideCollarWorld.x, bottomSideCollarWorld.y, collarZ, parseFloat(hole.holeLengthCalculated).toFixed(1), fontSize / 1.5, window.depthColor, "left");
	}
	if (displayOptions.holeType) {
		drawHoleTextThreeJS(middleSideCollarWorld.x, middleSideCollarWorld.y, collarZ, hole.holeType, fontSize / 1.5, "green", "left");
	}
	if (displayOptions.measuredComment) {
		drawHoleTextThreeJS(middleSideCollarWorld.x, middleSideCollarWorld.y, collarZ, hole.measuredComment, fontSize / 1.5, "#FF8800", "left");
	}

	// Step 4) Left side labels (right-aligned)
	if (displayOptions.holeAng) {
		drawHoleTextThreeJS(leftSideCollarWorld.x, leftSideCollarWorld.y, collarZ, parseFloat(hole.holeAngle).toFixed(0), fontSize / 1.5, window.angleDipColor, "right");
	}
	if (displayOptions.holeDip) {
		drawHoleTextThreeJS(leftSideToeWorld.x, leftSideToeWorld.y, toeZ, 90 - parseFloat(hole.holeAngle).toFixed(0), fontSize / 1.5, window.angleDipColor, "right");
	}
	if (displayOptions.holeBea) {
		drawHoleTextThreeJS(bottomSideToeWorld.x, bottomSideToeWorld.y, toeZ, parseFloat(hole.holeBearing).toFixed(1), fontSize / 1.5, "red", "right");
	}
	if (displayOptions.holeSubdrill) {
		drawHoleTextThreeJS(bottomSideToeWorld.x, bottomSideToeWorld.y, toeZ, parseFloat(hole.subdrillAmount).toFixed(1), fontSize / 1.5, "blue", "right");
	}
	if (displayOptions.initiationTime) {
		drawHoleTextThreeJS(leftSideCollarWorld.x, leftSideCollarWorld.y, collarZ, hole.holeTime, fontSize / 1.5, "red", "right");
	}
	// Step 5) Additional coordinate and measurement labels
	if (displayOptions.xValue) {
		drawHoleTextThreeJS(leftSideCollarWorld.x, leftSideCollarWorld.y, collarZ, parseFloat(hole.startXLocation).toFixed(2), fontSize, window.textFillColor, "right");
	}
	if (displayOptions.yValue) {
		const yPosWorld = canvasToWorld(leftSideCollar, middleSideCollar);
		drawHoleTextThreeJS(yPosWorld.x, yPosWorld.y, collarZ, parseFloat(hole.startYLocation).toFixed(2), fontSize / 1.5, window.textFillColor, "right");
	}
	if (displayOptions.zValue) {
		drawHoleTextThreeJS(bottomSideCollarWorld.x, bottomSideCollarWorld.y, collarZ, parseFloat(hole.startZLocation).toFixed(2), fontSize / 1.5, window.textFillColor, "right");
	}
	if (displayOptions.displayRowAndPosId) {
		drawHoleTextThreeJS(leftSideCollarWorld.x, leftSideCollarWorld.y, collarZ, "Row:" + hole.rowID, fontSize / 1.5, "#FF00FF", "right");
		const posPosWorld = canvasToWorld(leftSideCollar, middleSideCollar);
		drawHoleTextThreeJS(posPosWorld.x, posPosWorld.y, collarZ, "Pos:" + hole.posID, fontSize / 1.5, "#FF00FF", "right");
	}
	if (displayOptions.measuredLength) {
		const lenPosWorld = canvasToWorld(leftSideCollar, bottomSideCollar + fontSize);
		drawHoleTextThreeJS(lenPosWorld.x, lenPosWorld.y, collarZ, hole.measuredLength, fontSize / 1.5, "#FF4400", "right");
	}
	if (displayOptions.measuredMass) {
		const massPosWorld = canvasToWorld(leftSideCollar, topSideCollar - fontSize);
		drawHoleTextThreeJS(massPosWorld.x, massPosWorld.y, collarZ, hole.measuredMass, fontSize / 1.5, "#FF6600", "right");
	}
}

//=================================================
// KAD Drawing Functions (3D)
//=================================================

// Step 7) Draw KAD point in Three.js
export function drawKADPointThreeJS(worldX, worldY, worldZ, size, color, kadId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const pointMesh = GeometryFactory.createKADPoint(worldX, worldY, worldZ, size, color);

	// Step 7a) Add metadata for selection
	if (kadId) {
		pointMesh.userData = { type: "kadPoint", kadId: kadId };
	}

	window.threeRenderer.kadGroup.add(pointMesh);
}

// Step 8) Draw KAD line segment in Three.js
// Matches 2D drawKADLines() - draws a single segment with its own attributes
export function drawKADLineSegmentThreeJS(startX, startY, startZ, endX, endY, endZ, lineWidth, color, kadId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	if (developerModeEnabled) {
		console.log("🔧 [drawKADLineSegmentThreeJS] kadId:", kadId);
	}

	const lineMesh = GeometryFactory.createKADLineSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color);

	// Step 8a) Add metadata for selection
	if (kadId) {
		lineMesh.userData = { type: "kadLine", kadId: kadId };
		if (developerModeEnabled) {
			console.log("✅ [drawKADLineSegmentThreeJS] userData set:", lineMesh.userData);
		}
	} else {
		if (developerModeEnabled) {
			console.log("❌ [drawKADLineSegmentThreeJS] kadId is falsy, NOT setting userData");
		}
	}

	window.threeRenderer.kadGroup.add(lineMesh);
}

// Step 9) Draw KAD polygon segment in Three.js
// Matches 2D drawKADPolys() - draws a single segment with its own attributes
export function drawKADPolygonSegmentThreeJS(startX, startY, startZ, endX, endY, endZ, lineWidth, color, kadId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	if (developerModeEnabled) {
		console.log("🔧 [drawKADPolygonSegmentThreeJS] kadId:", kadId);
	}

	const polyMesh = GeometryFactory.createKADPolygonSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color);

	// Step 9a) Add metadata for selection
	if (kadId) {
		polyMesh.userData = { type: "kadPolygon", kadId: kadId };
		if (developerModeEnabled) {
			console.log("✅ [drawKADPolygonSegmentThreeJS] userData set:", polyMesh.userData);
		}
	} else {
		if (developerModeEnabled) {
			console.log("❌ [drawKADPolygonSegmentThreeJS] kadId is falsy, NOT setting userData");
		}
	}

	window.threeRenderer.kadGroup.add(polyMesh);
}

// Step 9b) FAST: Draw entire polyline/line entity with ONE draw call (batched)
// This is the key optimization for large DXF files
// Instead of creating one mesh per segment, create ONE mesh for all points
export function drawKADBatchedPolylineThreeJS(pointsArray, lineWidth, color, kadId, isPolygon) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!pointsArray || pointsArray.length < 2) return;
	
	// Step 9b.1) Create batched polyline (ONE object for entire entity!)
	var batchedLine = GeometryFactory.createBatchedPolyline(pointsArray, lineWidth, color, isPolygon);
	if (!batchedLine) return; // Handle null return for invalid data
	
	// Step 9b.2) Add metadata for selection
	if (kadId) {
		batchedLine.userData = { 
			type: isPolygon ? "kadPolygon" : "kadLine", 
			kadId: kadId,
			isBatched: true // Flag to indicate this is a batched object
		};
	}
	
	window.threeRenderer.kadGroup.add(batchedLine);
}

// Step 9c) SUPER-BATCH: Draw ALL KAD points in ONE draw call
// This creates a single THREE.Points object containing all KAD points
export function drawKADSuperBatchedPointsThreeJS(allPointEntities, worldToThreeLocal) {
	if (!window.threeInitialized || !window.threeRenderer) return null;
	if (!allPointEntities || allPointEntities.length === 0) return null;
	
	// Step 9c.1) Create super-batched points (ONE object for ALL points!)
	var result = GeometryFactory.createSuperBatchedPoints(allPointEntities, worldToThreeLocal);
	if (!result || !result.points) return null;
	
	// Step 9c.2) Add to KAD group
	window.threeRenderer.kadGroup.add(result.points);
	
	return result;
}

// Step 9d) SUPER-BATCH: Draw ALL KAD circles in ONE draw call
// This creates a single THREE.LineSegments object containing all KAD circles
export function drawKADSuperBatchedCirclesThreeJS(allCircleEntities, worldToThreeLocal) {
	if (!window.threeInitialized || !window.threeRenderer) return null;
	if (!allCircleEntities || allCircleEntities.length === 0) return null;
	
	// Step 9d.1) Create super-batched circles (ONE object for ALL circles!)
	var result = GeometryFactory.createSuperBatchedCircles(allCircleEntities, worldToThreeLocal);
	if (!result || !result.lineSegments) return null;
	
	// Step 9d.2) Add to KAD group
	window.threeRenderer.kadGroup.add(result.lineSegments);
	
	return result;
}

// Step 10) Draw KAD circle in Three.js
export function drawKADCircleThreeJS(worldX, worldY, worldZ, radius, lineWidth, color, kadId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	if (developerModeEnabled) {
		console.log("🔧 [drawKADCircleThreeJS] kadId:", kadId);
	}

	const circleMesh = GeometryFactory.createKADCircle(worldX, worldY, worldZ, radius, lineWidth, color);

	// Step 10a) Add metadata for selection
	if (kadId) {
		circleMesh.userData = { type: "kadCircle", kadId: kadId };
		if (developerModeEnabled) {
			console.log("✅ [drawKADCircleThreeJS] userData set:", circleMesh.userData);
		}
	}

	window.threeRenderer.kadGroup.add(circleMesh);
}

// Step 11) Draw KAD text in Three.js
export function drawKADTextThreeJS(worldX, worldY, worldZ, text, fontSize, color, backgroundColor = null, kadId = null) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	if (developerModeEnabled) {
		console.log("🔧 [drawKADTextThreeJS] kadId:", kadId);
	}

	const textSprite = GeometryFactory.createKADText(worldX, worldY, worldZ, text, fontSize, color, backgroundColor);

	// Step 11a) Add metadata for selection
	if (kadId) {
		// Preserve existing userData if it exists (for cached objects)
		if (!textSprite.userData) {
			textSprite.userData = {};
		}
		textSprite.userData.type = "kadText";
		textSprite.userData.kadId = kadId;
		if (developerModeEnabled) {
			console.log("✅ [drawKADTextThreeJS] userData set:", textSprite.userData);
		}
	}

	// Step 11b) Only add if not already in group (cached objects might already be there)
	if (!textSprite.parent) {
		window.threeRenderer.kadGroup.add(textSprite);
	}
}

//=================================================
// Surface & Other 3D Drawing
//=================================================

// Step 12) Draw surface in Three.js
export function drawSurfaceThreeJS(surfaceId, triangles, minZ, maxZ, gradient, transparency, surfaceData) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	// Step 12a) Check if this is a textured mesh with pre-loaded Three.js object
	// Check if mesh actually has textures
	var hasTexture = false;
	if (surfaceData && surfaceData.threeJSMesh) {
		surfaceData.threeJSMesh.traverse(function (child) {
			if (child.isMesh && child.material) {
				if (Array.isArray(child.material)) {
					hasTexture = child.material.some(function (mat) {
						return mat.map !== null && mat.map !== undefined;
					});
				} else {
					hasTexture = child.material.map !== null && child.material.map !== undefined;
				}
			}
		});
	}

	// Only use texture rendering if gradient is "texture" AND mesh has textures
	var useTextureRendering = surfaceData && surfaceData.isTexturedMesh && surfaceData.threeJSMesh && gradient === "texture" && hasTexture;

	if (useTextureRendering) {
		if (developerModeEnabled) {
			console.log("🎨 drawSurfaceThreeJS: Using textured mesh rendering for " + surfaceId + ", gradient: " + gradient + ", hasTexture: " + hasTexture);
		}

		// Step 12b) Check if already added to scene
		var existingMesh = window.threeRenderer.surfaceMeshMap.get(surfaceId);
		if (existingMesh) {
			if (developerModeEnabled) {
				// Already in scene, just ensure visibility
				if (developerModeEnabled) {
					console.log("🎨 drawSurfaceThreeJS: Mesh already in scene for " + surfaceId + ", setting visible");
				}
				existingMesh.visible = true;

				// Log mesh position and bounding box for debugging
				if (developerModeEnabled) {
					console.log("🎨 Existing mesh position: (" + existingMesh.position.x.toFixed(2) + ", " + existingMesh.position.y.toFixed(2) + ", " + existingMesh.position.z.toFixed(2) + ")");
				}

				return;
			}
		}
		if (developerModeEnabled) {
			console.log("🎨 Mesh NOT in scene yet, creating new instance for " + surfaceId);
		}

		// Step 12c) Clone the pre-loaded mesh for rendering
		// CRITICAL: Use deep clone with geometry cloning to preserve original mesh
		var texturedMesh = surfaceData.threeJSMesh.clone(true); // true = deep clone including geometries

		// Step 12c.0) DIAGNOSTIC: Check original vertex positions BEFORE any transformation
		var firstVertexOriginal = null;
		texturedMesh.traverse(function (child) {
			if (!firstVertexOriginal && child.isMesh && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
				var pos = child.geometry.attributes.position.array;
				firstVertexOriginal = { x: pos[0], y: pos[1], z: pos[2] };
			}
		});
		if (developerModeEnabled) {
			console.log("🎨 First vertex BEFORE transform: (" + (firstVertexOriginal ? firstVertexOriginal.x.toFixed(2) : "N/A") + ", " + (firstVertexOriginal ? firstVertexOriginal.y.toFixed(2) : "N/A") + ", " + (firstVertexOriginal ? firstVertexOriginal.z.toFixed(2) : "N/A") + ")");
			console.log("🎨 Mesh group position BEFORE transform: (" + texturedMesh.position.x.toFixed(2) + ", " + texturedMesh.position.y.toFixed(2) + ", " + texturedMesh.position.z.toFixed(2) + ")");
		}

		// Step 12c.1) CRITICAL FIX: OBJ vertices are already in relative coordinates (centered around their own origin)
		// DO NOT transform vertices! Instead, position the mesh GROUP at the correct local coordinates.
		// Calculate where the mesh center should be in local Three.js coordinates
		var originX = window.threeLocalOriginX || 0;
		var originY = window.threeLocalOriginY || 0;

		// Get mesh center from surfaceData (world coordinates)
		var meshCenterWorldX = surfaceData.meshBounds ? (surfaceData.meshBounds.minX + surfaceData.meshBounds.maxX) / 2 : 0;
		var meshCenterWorldY = surfaceData.meshBounds ? (surfaceData.meshBounds.minY + surfaceData.meshBounds.maxY) / 2 : 0;

		// Convert mesh center from world to local coordinates
		var meshCenterLocalX = meshCenterWorldX - originX;
		var meshCenterLocalY = meshCenterWorldY - originY;

		if (developerModeEnabled) {
			console.log("🎨 Mesh center in world coords: (" + meshCenterWorldX.toFixed(2) + ", " + meshCenterWorldY.toFixed(2) + ")");
		}
		if (developerModeEnabled) {
			console.log("🎨 Positioning mesh group at local coords: (" + meshCenterLocalX.toFixed(2) + ", " + meshCenterLocalY.toFixed(2) + ")");
		}

		// Position the mesh group (NOT the vertices)
		texturedMesh.position.set(meshCenterLocalX, meshCenterLocalY, 0);

		// Step 12c.2) Deep clone materials and preserve textures
		texturedMesh.traverse(function (child) {
			if (child.isMesh) {
				// Clone materials and preserve textures
				if (child.material) {
					if (Array.isArray(child.material)) {
						child.material = child.material.map(function (mat) {
							var clonedMat = mat.clone();
							if (mat.map) {
								clonedMat.map = mat.map;
								clonedMat.needsUpdate = true;
							}
							return clonedMat;
						});
					} else {
						var clonedMat = child.material.clone();
						if (child.material.map) {
							clonedMat.map = child.material.map;
							clonedMat.needsUpdate = true;
						}
						child.material = clonedMat;
					}
				}

				// Clone geometry to avoid modifying original
				if (child.geometry) {
					child.geometry = child.geometry.clone();
				}
			}
		});

		// Step 12d) Mesh vertices are in relative coordinates, group is positioned in local coordinates
		// No additional transformation needed

		// Step 12e) Set userData for selection
		texturedMesh.userData = {
			type: "surface",
			surfaceId: surfaceId,
			isTexturedMesh: true,
		};

		// Step 12f) Apply transparency if specified
		if (transparency < 1.0) {
			texturedMesh.traverse(function (child) {
				if (child.isMesh && child.material) {
					child.material.transparent = true;
					child.material.opacity = transparency;
				}
			});
		}

		// Step 12g) Add to scene
		window.threeRenderer.surfacesGroup.add(texturedMesh);
		window.threeRenderer.surfaceMeshMap.set(surfaceId, texturedMesh);

		// Step 12g.1) Log final mesh position and details
		if (developerModeEnabled) {
			console.log("🎨 Added textured mesh to 3D scene: " + surfaceId);
		}
		if (developerModeEnabled) {
			console.log("🎨 Mesh position: (" + texturedMesh.position.x.toFixed(2) + ", " + texturedMesh.position.y.toFixed(2) + ", " + texturedMesh.position.z.toFixed(2) + ")");
		}
		if (developerModeEnabled) {
			console.log("🎨 Mesh visible: " + texturedMesh.visible + ", children count: " + texturedMesh.children.length);
		}

		// Step 12h) Request render
		if (window.threeRenderer.needsRender !== undefined) {
			window.threeRenderer.needsRender = true;
		}

		return;
	}

	// Step 12i) For textured meshes with non-texture gradient, fall through to standard rendering
	// This allows textured OBJs to use elevation-based color gradients

	// Step 9a) Standard surface rendering - Convert triangle vertices from world coordinates to local Three.js coordinates
	var localTriangles = triangles.map(function (triangle) {
		if (!triangle.vertices || triangle.vertices.length !== 3) return triangle;

		var localVertices = triangle.vertices.map(function (v) {
			var local = window.worldToThreeLocal(v.x, v.y);
			return {
				x: local.x,
				y: local.y,
				z: v.z, // Keep elevation as-is
			};
		});

		return Object.assign({}, triangle, { vertices: localVertices });
	});

	// Step 10) Create color function for this surface
	var colorFunction;
	
	// Step 10a) Handle hillshade - use solid color instead of elevation gradient
	if (gradient === "hillshade") {
		var hillshadeHex = (surfaceData && surfaceData.hillshadeColor) ? surfaceData.hillshadeColor : "#808080";
		console.log("🎨 [drawSurfaceThreeJS] Hillshade mode - surfaceId: " + surfaceId + ", hillshadeColor from data: " + (surfaceData ? surfaceData.hillshadeColor : "N/A") + ", using: " + hillshadeHex);
		// Step 10a-1) Convert hex color to Three.js RGB format
		var fixedColor = hexToThreeColor(hillshadeHex);
		colorFunction = function (z) {
			return fixedColor;
		};
	} else {
		// Step 10b) Regular elevation-based color gradient
		colorFunction = function (z) {
			var rgbString = window.elevationToColor(z, minZ, maxZ, gradient);
			return window.rgbStringToThreeColor(rgbString);
		};
	}

	// Step 11) Create mesh with vertex colors (using local coordinates)
	var surfaceMesh = GeometryFactory.createSurface(localTriangles, colorFunction, transparency);
	surfaceMesh.userData = {
		type: "surface",
		surfaceId: surfaceId,
	};

	window.threeRenderer.surfacesGroup.add(surfaceMesh);
	window.threeRenderer.surfaceMeshMap.set(surfaceId, surfaceMesh);
}

// Step 13) Draw contour lines in Three.js (positioned at collar elevation)
export function drawContoursThreeJS(contourLinesArray, color, allBlastHoles) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!contourLinesArray || contourLinesArray.length === 0) return;

	// Step 13a) Pass allBlastHoles and worldToThreeLocal for collar Z positioning
	const contourGroup = GeometryFactory.createContourLines(contourLinesArray, color, allBlastHoles, window.worldToThreeLocal);
	window.threeRenderer.contoursGroup.add(contourGroup);

	// Step 13b) Add 3D text labels for each contour level (matching 2D overlay behavior)
	const interval = window.intervalAmount || 100;

	for (let level = 0; level < contourLinesArray.length; level++) {
		const contourLevel = contourLinesArray[level];
		if (!contourLevel || contourLevel.length === 0) continue;

		const contourTime = level * interval;
		const labelText = contourTime + "ms";
		const totalLines = contourLevel.length;

		// Step 13c) Add labels at 1/3 and 2/3 marks of this contour level
		const oneThirdMark = Math.floor(totalLines / 3);
		const twoThirdsMark = Math.floor((totalLines * 2) / 3);

		for (let i = 0; i < contourLevel.length; i++) {
			if (i === oneThirdMark || i === twoThirdsMark) {
				const line = contourLevel[i];
				if (!line || !line[0] || !line[1]) continue;

				// Step 13d) Calculate midpoint of the line segment
				const midX = (line[0].x + line[1].x) / 2;
				const midY = (line[0].y + line[1].y) / 2;

				// Step 13e) Find nearest hole for Z elevation
				const nearestHole = GeometryFactory.findNearestHole(midX, midY, allBlastHoles);
				const midZ = nearestHole ? nearestHole.startZLocation || 0 : 0;

				// Step 13f) Convert to local coordinates
				const local = window.worldToThreeLocal ? window.worldToThreeLocal(midX, midY) : { x: midX, y: midY };

				// Step 13g) Create text label for contour (billboarded, italicized, dark/light mode aware)
				// Step 13g.1) Use white text in dark mode, black in light mode
				const labelColor = window.darkModeEnabled ? "#FFFFFF" : "#000000";
				const textMesh = GeometryFactory.createContourLabel(
					local.x,
					local.y,
					midZ + 0.5, // Slightly above the line
					labelText,
					12,
					labelColor
				);

				if (textMesh) {
					textMesh.userData = { type: "contourLabel", time: contourTime, billboard: true };
					window.threeRenderer.contoursGroup.add(textMesh);
				}
			}
		}
	}
}

// Step 14) Draw direction arrows in Three.js (positioned at collar elevation)
export function drawDirectionArrowsThreeJS(directionArrows, allBlastHoles) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	// Step 14a) Pass allBlastHoles and worldToThreeLocal for collar Z positioning
	const arrowGroup = GeometryFactory.createDirectionArrows(directionArrows, allBlastHoles, window.worldToThreeLocal);
	window.threeRenderer.contoursGroup.add(arrowGroup);
}

// Step 15) Draw background image in Three.js
// zElevation parameter positions image at specific Z level (default uses drawingZLevel)
export function drawBackgroundImageThreeJS(imageId, imageCanvas, bbox, transparency, zElevation) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	// Convert world bbox to local Three.js coordinates
	// bbox format: [minX, minY, maxX, maxY] in world coordinates
	const minLocal = window.worldToThreeLocal(bbox[0], bbox[1]);
	const maxLocal = window.worldToThreeLocal(bbox[2], bbox[3]);

	// Create local bbox
	const localBbox = [minLocal.x, minLocal.y, maxLocal.x, maxLocal.y];

	if (developerModeEnabled) {
		console.log("🖼️ [3D IMAGE COORDS] World bbox:", bbox, "-> Local bbox:", localBbox);
	}

	const imageMesh = GeometryFactory.createImagePlane(imageCanvas, localBbox, transparency, zElevation);
	imageMesh.userData = {
		type: "image",
		imageId: imageId,
	};

	window.threeRenderer.imagesGroup.add(imageMesh);
}

// Step 16) Draw connector line in Three.js
export function drawConnectorThreeJS(fromHole, toHole, color, curve, delayText, connScale) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!fromHole || !toHole) return;

	// Step 16a) Convert world coordinates to local Three.js coordinates
	const fromLocal = window.worldToThreeLocal(fromHole.startXLocation, fromHole.startYLocation);
	const toLocal = window.worldToThreeLocal(toHole.startXLocation, toHole.startYLocation);

	// Step 16b) Use collar Z elevations
	const fromZ = fromHole.startZLocation || 0;
	const toZ = toHole.startZLocation || 0;

	// Step 16c) Check if self-connecting (same hole)
	const isSelfConnecting = fromHole.entityName === toHole.entityName && fromHole.holeID === toHole.holeID;

	// Step 16d) Create connector line geometry
	// For self-connecting holes, use same position for both ends
	const connectorGroup = GeometryFactory.createConnectorLine(
		fromLocal.x,
		fromLocal.y,
		fromZ,
		isSelfConnecting ? fromLocal.x : toLocal.x, // Use same position for self-connecting
		isSelfConnecting ? fromLocal.y : toLocal.y, // Use same position for self-connecting
		toZ,
		color,
		curve || 0,
		delayText,
		connScale || 100
	);

	// Step 16d) Add metadata for selection
	connectorGroup.userData = {
		type: "connector",
		fromHoleId: fromHole.entityName + ":::" + fromHole.holeID,
		toHoleId: toHole.entityName + ":::" + toHole.holeID,
	};

	window.threeRenderer.connectorsGroup.add(connectorGroup);
}
//TODO: This is too verbose for it to be rendered in the scene! We should have a shared 2D canvas overlay that displays the selected holes and their IDs. That both 2D and 3D use.
// Step 17) Draw tool prompt text in Three.js
export function drawToolPromptThreeJS(text, position, color) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!text || text === "") return;

	// Step 17a) Convert world coordinates to local Three.js coordinates
	const local = window.worldToThreeLocal(position.x, position.y);
	const z = position.z || 0;

	// Step 17b) Parse color (can be RGBA string or hex)
	let textColor = color;
	if (color && color.startsWith("rgba")) {
		// Extract RGB from RGBA for text sprite (opacity handled separately if needed)
		const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (match) {
			const r = parseInt(match[1]);
			const g = parseInt(match[2]);
			const b = parseInt(match[3]);
			textColor = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
		}
	}

	// Step 17c) Split multiline text
	const lines = text.split("\n");
	const fontSize = 12;
	const lineHeight = 16;
	const offsetY = 20; // Offset above hole

	// Step 17d) Create text sprites for each line
	lines.forEach((line, index) => {
		if (line.trim() === "") return;
		const textSprite = GeometryFactory.createKADText(
			local.x,
			local.y + offsetY + index * lineHeight,
			z + 1, // Slightly above collar
			line,
			fontSize,
			textColor,
			null
		);
		window.threeRenderer.kadGroup.add(textSprite);
	});
}

// Step 18) Highlight selected hole in Three.js (matching 2D style)
export function highlightSelectedHoleThreeJS(hole, highlightType) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!hole) return;

	// Step 18a) Convert world coordinates to local Three.js coordinates
	const local = window.worldToThreeLocal(hole.startXLocation, hole.startYLocation);
	const z = hole.startZLocation || 0;

	// Step 18a.1) Convert collar and toe coordinates to local Three.js coordinates for tube geometry
	const collarLocal = window.worldToThreeLocal(hole.startXLocation, hole.startYLocation);
	const collarZ = hole.startZLocation || 0;
	const toeLocal = window.worldToThreeLocal(hole.endXLocation, hole.endYLocation);
	const toeZ = hole.endZLocation || 0;

	// Step 18b) Determine colors based on highlight type
	let fillColor, strokeColor, radius;

	const holeDiameter = parseFloat(hole.holeDiameter) || 0;
	// Step 18b.1) Radius = 1m + hole diameter (in meters)
	// Convert hole diameter from mm to meters, then add 1m
	const holeDiameterMeters = holeDiameter / 1000; // Convert mm to meters
	const baseRadius = 1.0 + holeDiameterMeters; // 1m + hole diameter in meters

	switch (highlightType) {
		case "first":
			// First connector hole: green
			fillColor = "rgba(0, 255, 0, 0.2)";
			strokeColor = "rgba(0, 190, 0, .8)";
			radius = baseRadius;
			break;
		case "second":
			// Second connector hole: yellow
			fillColor = "rgba(255, 255, 0, 0.2)";
			strokeColor = "rgba(255, 200, 0, .8)";
			radius = baseRadius;
			break;
		case "selected":
		case "multi":
			// Regular selection: pink/magenta
			fillColor = "rgba(255, 0, 150, 0.2)";
			strokeColor = "rgba(255, 0, 150, .8)";
			radius = baseRadius;
			break;
		case "animation-playing":
			// Animation playing: orange/yellow
			fillColor = "rgba(255, 0, 0, 0.4)";
			strokeColor = "rgba(250, 250, 0, 0.8)";
			radius = baseRadius + 0.5;
			break;
		case "animation-paused":
			// Animation paused: green
			fillColor = "rgba(0, 255, 0, 0.2)";
			strokeColor = "rgba(0, 255, 0, 0.6)";
			radius = baseRadius + 0.5;
			break;
		default:
			fillColor = "rgba(255, 0, 150, 0.2)";
			strokeColor = "rgba(255, 0, 150, .8)";
			radius = baseRadius;
	}

	// Step 18c) Create highlight geometry with collar and toe coordinates for tube
	const highlightGroup = GeometryFactory.createSelectionHighlight(local.x, local.y, z, radius, fillColor, strokeColor, collarLocal.x, collarLocal.y, collarZ, toeLocal.x, toeLocal.y, toeZ);

	// Step 18d) Add metadata
	highlightGroup.userData = {
		type: "selectionHighlight",
		holeId: hole.entityName + ":::" + hole.holeID,
		highlightType: highlightType,
	};

	window.threeRenderer.holesGroup.add(highlightGroup);
}

// Step 18.5) Highlight selected KAD point in Three.js (matching 2D style)
export function highlightSelectedKADPointThreeJS(kadObject, highlightType) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!kadObject) return;

	// Step 18.5a) Convert world coordinates to local Three.js coordinates
	const local = window.worldToThreeLocal(kadObject.pointXLocation, kadObject.pointYLocation);
	const z = kadObject.pointZLocation || 0;

	// Step 18.5b) Determine colors based on highlight type
	let color, baseRadius;

	switch (highlightType) {
		case "selected":
		case "multi":
			// Regular selection: pink/magenta (matching holes and canvas3DDrawSelection.js)
			color = "rgba(255, 0, 150, .8)";
			baseRadius = 1.0; // Base radius in world units
			break;
		default:
			color = "rgba(255, 0, 150, .8)";
			baseRadius = 1.0;
	}

	// Step 18.5c) Create highlight using GeometryFactory.createKADPointHighlight
	// This matches the style in canvas3DDrawSelection.js:193 - uses Points geometry with circular texture
	// Points always face camera and maintain consistent screen-space size
	const highlightMesh = GeometryFactory.createKADPointHighlight(local.x, local.y, z, baseRadius, color);

	// Step 18.5d) Add metadata
	const kadId = kadObject.entityName + ":::" + kadObject.elementIndex;
	highlightMesh.userData = {
		type: "kadHighlight",
		kadId: kadId,
		highlightType: highlightType,
	};

	window.threeRenderer.kadGroup.add(highlightMesh);
}

// Step 19) Draw connection stadium zone (multi-connector indicator) in Three.js
export function drawConnectStadiumZoneThreeJS(fromHole, toMousePos, connectAmount) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!fromHole || !toMousePos) return;

	// Step 19a) Validate inputs
	if (!isFinite(fromHole.startXLocation) || !isFinite(fromHole.startYLocation) || !isFinite(toMousePos.x) || !isFinite(toMousePos.y) || !isFinite(connectAmount) || connectAmount <= 0) {
		console.warn("drawConnectStadiumZoneThreeJS: Invalid inputs", {
			fromHole: fromHole ? { x: fromHole.startXLocation, y: fromHole.startYLocation, z: fromHole.startZLocation } : null,
			toMousePos: toMousePos,
			connectAmount: connectAmount,
		});
		return;
	}

	// Step 19b) Convert BOTH positions to Three.js local coordinates
	// worldToThreeLocal only accepts 2 parameters (x, y) - Z stays as-is
	const fromLocal = window.worldToThreeLocal(fromHole.startXLocation, fromHole.startYLocation);
	const toLocal = window.worldToThreeLocal(toMousePos.x, toMousePos.y);

	// Step 19c) Extract Z coordinates separately (Z coordinates stay as-is, no conversion needed)
	const fromZ = fromHole.startZLocation || 0;
	const toZ = toMousePos.z !== undefined && isFinite(toMousePos.z) ? toMousePos.z : fromHole.startZLocation || 0;

	const radius = connectAmount;

	// Step 19d) Create simplified stadium zone using MeshLineModified
	const stadiumGroup = GeometryFactory.createStadiumZone(
		fromLocal.x,
		fromLocal.y,
		fromZ,
		toLocal.x,
		toLocal.y,
		toZ,
		radius,
		"rgba(0, 255, 0, 0.6)", // stroke - more opaque green
		"rgba(0, 255, 0, 0.2)" // fill - semi-transparent green
	);

	// Step 19e) Add metadata
	stadiumGroup.userData = {
		type: "stadiumZone",
		fromHoleId: fromHole.entityName + ":::" + fromHole.holeID,
	};

	window.threeRenderer.connectorsGroup.add(stadiumGroup);
}

// Step 19.5) Draw mouse position indicator (crosshairs) in Three.js
// Now uses view plane positioning and billboard rendering
// Optional color parameter to change torus color (e.g., when drawing tools are active)
export function drawMousePositionIndicatorThreeJS(worldX, worldY, worldZ, indicatorColor) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (worldX === undefined || worldY === undefined || worldZ === undefined) return;

	// Step 19.5a) Convert world coordinates to local Three.js coordinates
	const local = window.worldToThreeLocal(worldX, worldY);
	const z = worldZ || 0;

	// Step 19.5a.1) Use provided color or apply cursor opacity setting
	const cursorOpacity = 0.2;
	let sphereColor = indicatorColor;

	// If no custom color provided, use default grey with user-defined opacity
	if (!sphereColor) {
		sphereColor = `rgba(128, 128, 128, ${cursorOpacity})`;
	} else if (sphereColor.startsWith("rgba")) {
		// If custom color provided, replace its opacity with user setting
		//sphereColor = sphereColor.replace(/[\d.]+\)$/, `${cursorOpacity})`);
	}

	// Step 19.5b) Remove existing mouse indicator if present
	const connectorsGroup = window.threeRenderer.connectorsGroup;
	const toRemove = [];
	connectorsGroup.children.forEach((child) => {
		if (child.userData && child.userData.type === "mouseIndicator") {
			toRemove.push(child);
		}
	});
	toRemove.forEach((obj) => {
		connectorsGroup.remove(obj);
		if (obj.geometry) obj.geometry.dispose();
		if (obj.material) {
			if (Array.isArray(obj.material)) {
				obj.material.forEach((mat) => mat.dispose());
			} else {
				obj.material.dispose();
			}
		}
		// Dispose children if it's a group
		if (obj.isGroup) {
			obj.traverse((child) => {
				if (child.geometry) child.geometry.dispose();
				if (child.material) {
					if (Array.isArray(child.material)) {
						child.material.forEach((mat) => mat.dispose());
					} else {
						child.material.dispose();
					}
				}
			});
		}
	});

	// Step 19.5c) Create mouse position indicator sphere
	// Size based on snap radius - properly scaled for current 3D view
	const snapRadiusPixels = window.snapRadiusPixels !== undefined ? window.snapRadiusPixels : 15; // Default 15px

	// Use 3D-aware conversion that accounts for camera frustum
	let snapRadiusWorld;
	if (typeof window.getSnapRadiusInWorldUnits3D === "function") {
		snapRadiusWorld = window.getSnapRadiusInWorldUnits3D(snapRadiusPixels);
	} else {
		// Fallback to 2D calculation if function not available
		snapRadiusWorld = snapRadiusPixels / (window.currentScale || 1.0);
	}

	const indicatorSize = snapRadiusWorld;
	const indicatorGroup = GeometryFactory.createMousePositionIndicator(
		local.x,
		local.y,
		z,
		indicatorSize,
		sphereColor, // Use sphere color with user-defined opacity
		false // No billboarding needed for sphere!
	);

	// Step 19.5d) Add metadata
	indicatorGroup.userData = {
		type: "mouseIndicator",
	};

	// No billboarding markup needed - sphere looks the same from all angles

	connectorsGroup.add(indicatorGroup);
}

// Step 19.6) Draw KAD leading line preview in Three.js
export function drawKADLeadingLineThreeJS(fromWorldX, fromWorldY, fromWorldZ, toWorldX, toWorldY, toWorldZ, color) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (fromWorldX === undefined || fromWorldY === undefined) return;
	if (toWorldX === undefined || toWorldY === undefined) return;

	// Step 19.6a) Convert world coordinates to local Three.js coordinates
	const fromLocal = window.worldToThreeLocal(fromWorldX, fromWorldY);
	const toLocal = window.worldToThreeLocal(toWorldX, toWorldY);
	const fromZ = fromWorldZ || 0;
	const toZ = toWorldZ || 0;

	// Step 19.6b) Remove existing leading line if present
	const connectorsGroup = window.threeRenderer.connectorsGroup;
	const toRemove = [];
	connectorsGroup.children.forEach(function (child) {
		if (child.userData && child.userData.type === "kadLeadingLine") {
			toRemove.push(child);
		}
	});
	toRemove.forEach(function (obj) {
		connectorsGroup.remove(obj);
		if (obj.geometry) obj.geometry.dispose();
		if (obj.material) obj.material.dispose();
	});

	// Step 19.6c) Create dashed line geometry from last point to current mouse position
	const lineColor = color || "rgba(0, 255, 255, 0.8)";
	const points = [new THREE.Vector3(fromLocal.x, fromLocal.y, fromZ), new THREE.Vector3(toLocal.x, toLocal.y, toZ)];

	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	const material = new THREE.LineDashedMaterial({
		color: new THREE.Color(lineColor),
		dashSize: 0.5,
		gapSize: 0.25,
		linewidth: 2,
	});

	const line = new THREE.Line(geometry, material);
	line.computeLineDistances(); // Required for dashed lines

	// Step 19.6d) Add metadata
	line.userData = {
		type: "kadLeadingLine",
	};

	connectorsGroup.add(line);
}

// Step 19.7) Clear KAD leading line preview in Three.js
export function clearKADLeadingLineThreeJS() {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const connectorsGroup = window.threeRenderer.connectorsGroup;
	const toRemove = [];
	connectorsGroup.children.forEach(function (child) {
		if (child.userData && child.userData.type === "kadLeadingLine") {
			toRemove.push(child);
		}
	});
	toRemove.forEach(function (obj) {
		connectorsGroup.remove(obj);
		if (obj.geometry) obj.geometry.dispose();
		if (obj.material) obj.material.dispose();
	});
}

//=================================================
// Ruler and Protractor 3D Drawing Functions
//=================================================

// Step 19.8) Draw ruler leading line in Three.js
export function drawRulerThreeJS(startWorldX, startWorldY, startWorldZ, endWorldX, endWorldY, endWorldZ) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (startWorldX === undefined || startWorldY === undefined) return;
	if (endWorldX === undefined || endWorldY === undefined) return;

	// Step 19.8a) Convert world coordinates to local Three.js coordinates
	const startLocal = window.worldToThreeLocal(startWorldX, startWorldY);
	const endLocal = window.worldToThreeLocal(endWorldX, endWorldY);
	const startZ = startWorldZ || 0;
	const endZ = endWorldZ || 0;

	// Step 19.8b) Remove existing ruler line if present
	const connectorsGroup = window.threeRenderer.connectorsGroup;
	const toRemove = [];
	connectorsGroup.children.forEach(function (child) {
		if (child.userData && child.userData.type === "rulerLine") {
			toRemove.push(child);
		}
	});
	toRemove.forEach(function (obj) {
		connectorsGroup.remove(obj);
		if (obj.geometry) obj.geometry.dispose();
		if (obj.material) obj.material.dispose();
	});

	// Step 19.8c) Create solid cyan line from start to end
	const lineColor = window.darkModeEnabled ? 0x00cccc : 0x004444;
	const points = [new THREE.Vector3(startLocal.x, startLocal.y, startZ), new THREE.Vector3(endLocal.x, endLocal.y, endZ)];

	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	const material = new THREE.LineBasicMaterial({
		color: lineColor,
		linewidth: 2,
	});

	const line = new THREE.Line(geometry, material);

	// Step 19.8d) Add tick marks at both ends
	const tickSize = 0.5;
	const dx = endLocal.x - startLocal.x;
	const dy = endLocal.y - startLocal.y;
	const len = Math.sqrt(dx * dx + dy * dy);
	if (len > 0) {
		const perpX = -dy / len * tickSize;
		const perpY = dx / len * tickSize;

		// Start tick
		const startTick = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(startLocal.x - perpX, startLocal.y - perpY, startZ),
			new THREE.Vector3(startLocal.x + perpX, startLocal.y + perpY, startZ)
		]);
		const startTickLine = new THREE.Line(startTick, material.clone());
		startTickLine.userData = { type: "rulerLine" };
		connectorsGroup.add(startTickLine);

		// End tick
		const endTick = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(endLocal.x - perpX, endLocal.y - perpY, endZ),
			new THREE.Vector3(endLocal.x + perpX, endLocal.y + perpY, endZ)
		]);
		const endTickLine = new THREE.Line(endTick, material.clone());
		endTickLine.userData = { type: "rulerLine" };
		connectorsGroup.add(endTickLine);
	}

	// Step 19.8e) Add metadata
	line.userData = {
		type: "rulerLine",
	};

	connectorsGroup.add(line);
}

// Step 19.9) Clear ruler line in Three.js
export function clearRulerThreeJS() {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const connectorsGroup = window.threeRenderer.connectorsGroup;
	const toRemove = [];
	connectorsGroup.children.forEach(function (child) {
		if (child.userData && child.userData.type === "rulerLine") {
			toRemove.push(child);
		}
	});
	toRemove.forEach(function (obj) {
		connectorsGroup.remove(obj);
		if (obj.geometry) obj.geometry.dispose();
		if (obj.material) obj.material.dispose();
	});
}

// Step 19.10) Draw protractor (two lines + arc) in Three.js
export function drawProtractorThreeJS(centerWorldX, centerWorldY, centerWorldZ, p2WorldX, p2WorldY, p2WorldZ, p3WorldX, p3WorldY, p3WorldZ) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (centerWorldX === undefined || centerWorldY === undefined) return;

	// Step 19.10a) Convert world coordinates to local Three.js coordinates
	const centerLocal = window.worldToThreeLocal(centerWorldX, centerWorldY);
	const centerZ = centerWorldZ || 0;

	// Step 19.10b) Remove existing protractor lines if present
	const connectorsGroup = window.threeRenderer.connectorsGroup;
	const toRemove = [];
	connectorsGroup.children.forEach(function (child) {
		if (child.userData && child.userData.type === "protractorLine") {
			toRemove.push(child);
		}
	});
	toRemove.forEach(function (obj) {
		connectorsGroup.remove(obj);
		if (obj.geometry) obj.geometry.dispose();
		if (obj.material) obj.material.dispose();
	});

	const lineColor = window.darkModeEnabled ? 0x00cccc : 0x004444;
	const arcColor = 0xff0000; // Red for arc

	// Step 19.10c) Draw first line (center to p2) if p2 is defined
	if (p2WorldX !== undefined && p2WorldY !== undefined) {
		const p2Local = window.worldToThreeLocal(p2WorldX, p2WorldY);
		const p2Z = p2WorldZ || 0;

		const points1 = [new THREE.Vector3(centerLocal.x, centerLocal.y, centerZ), new THREE.Vector3(p2Local.x, p2Local.y, p2Z)];
		const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
		const material1 = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 2 });
		const line1 = new THREE.Line(geometry1, material1);
		line1.userData = { type: "protractorLine" };
		connectorsGroup.add(line1);
	}

	// Step 19.10d) Draw second line (center to p3) if p3 is defined and different from center
	if (p3WorldX !== undefined && p3WorldY !== undefined && !(p3WorldX === centerWorldX && p3WorldY === centerWorldY)) {
		const p2Local = window.worldToThreeLocal(p2WorldX, p2WorldY);
		const p3Local = window.worldToThreeLocal(p3WorldX, p3WorldY);
		const p2Z = p2WorldZ || 0;
		const p3Z = p3WorldZ || 0;

		const points2 = [new THREE.Vector3(centerLocal.x, centerLocal.y, centerZ), new THREE.Vector3(p3Local.x, p3Local.y, p3Z)];
		const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
		const material2 = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 2 });
		const line2 = new THREE.Line(geometry2, material2);
		line2.userData = { type: "protractorLine" };
		connectorsGroup.add(line2);

		// Step 19.10e) Draw arc between the two lines
		const d1 = Math.sqrt(Math.pow(p2Local.x - centerLocal.x, 2) + Math.pow(p2Local.y - centerLocal.y, 2));
		const d2 = Math.sqrt(Math.pow(p3Local.x - centerLocal.x, 2) + Math.pow(p3Local.y - centerLocal.y, 2));
		const arcRadius = Math.min(d1, d2) / 3;

		if (arcRadius > 0.1) {
			// Calculate angles
			const angle1 = Math.atan2(p2Local.y - centerLocal.y, p2Local.x - centerLocal.x);
			const angle2 = Math.atan2(p3Local.y - centerLocal.y, p3Local.x - centerLocal.x);

			// Generate arc points
			var arcPoints = [];
			var startAngle = angle1;
			var endAngle = angle2;
			var angleDiff = endAngle - startAngle;
			
			// Normalize to [-PI, PI]
			while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
			while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

			// Draw smaller arc
			var numSegments = 32;
			for (var i = 0; i <= numSegments; i++) {
				var t = i / numSegments;
				var angle = startAngle + t * angleDiff;
				arcPoints.push(new THREE.Vector3(
					centerLocal.x + arcRadius * Math.cos(angle),
					centerLocal.y + arcRadius * Math.sin(angle),
					centerZ
				));
			}

			if (arcPoints.length > 1) {
				const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
				const arcMaterial = new THREE.LineBasicMaterial({ color: arcColor, linewidth: 2 });
				const arcLine = new THREE.Line(arcGeometry, arcMaterial);
				arcLine.userData = { type: "protractorLine" };
				connectorsGroup.add(arcLine);
			}
		}
	}
}

// Step 19.11) Clear protractor lines in Three.js
export function clearProtractorThreeJS() {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const connectorsGroup = window.threeRenderer.connectorsGroup;
	const toRemove = [];
	connectorsGroup.children.forEach(function (child) {
		if (child.userData && child.userData.type === "protractorLine") {
			toRemove.push(child);
		}
	});
	toRemove.forEach(function (obj) {
		connectorsGroup.remove(obj);
		if (obj.geometry) obj.geometry.dispose();
		if (obj.material) obj.material.dispose();
	});
}

// Step 20) Draw slope map in Three.js
export function drawSlopeMapThreeJS(triangles, allBlastHoles) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!triangles || triangles.length === 0) return;

	// Step 20a) Create slope surface geometry
	const slopeMesh = GeometryFactory.createSlopeSurface(triangles, allBlastHoles, window.worldToThreeLocal, 1.0);

	// Step 20b) Add metadata
	slopeMesh.userData = {
		type: "slopeMap",
	};

	window.threeRenderer.surfacesGroup.add(slopeMesh);

	// Step 20c) Add text labels for slope values on each triangle
	for (const triangle of triangles) {
		if (!triangle || triangle.length !== 3) continue;

		// Step 20c.1) Calculate triangle centroid
		const centroidX = (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3;
		const centroidY = (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3;

		// Step 20c.2) Find nearest hole for Z elevation
		const nearestHole = GeometryFactory.findNearestHole(centroidX, centroidY, allBlastHoles);
		const centroidZ = nearestHole ? nearestHole.startZLocation || 0 : 0;

		// Step 20c.3) Calculate slope angle using GeometryFactory helper
		const triangleForSlope = [
			[triangle[0][0], triangle[0][1], triangle[0][2] || centroidZ],
			[triangle[1][0], triangle[1][1], triangle[1][2] || centroidZ],
			[triangle[2][0], triangle[2][1], triangle[2][2] || centroidZ],
		];
		const slopeAngle = GeometryFactory.getDipAngle(triangleForSlope);

		// Step 20c.4) Convert to local coordinates
		const local = window.worldToThreeLocal ? window.worldToThreeLocal(centroidX, centroidY) : { x: centroidX, y: centroidY };

		// Step 20c.5) Create text label showing slope angle
		const labelText = slopeAngle.toFixed(1) + "°";
		const textColor = window.darkModeEnabled ? "#FFFFFF" : "#000000";
		const textMesh = GeometryFactory.createKADText(
			local.x,
			local.y,
			centroidZ + 0.3,
			labelText,
			8,
			textColor,
			null // No background
		);

		if (textMesh) {
			textMesh.userData = { type: "slopeLabel" };
			window.threeRenderer.surfacesGroup.add(textMesh);
		}
	}
}

// Step 21) Draw burden relief map in Three.js
export function drawBurdenReliefMapThreeJS(triangles, allBlastHoles) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!triangles || triangles.length === 0) return;

	// Step 21a) Create relief surface geometry
	const reliefMesh = GeometryFactory.createReliefSurface(triangles, allBlastHoles, window.worldToThreeLocal, 1.0);

	// Step 21b) Add metadata
	reliefMesh.userData = {
		type: "burdenReliefMap",
	};

	window.threeRenderer.surfacesGroup.add(reliefMesh);

	// Step 21c) Add text labels for relief values on each triangle
	// Relief triangle format: [[x, y, holeTime], [x, y, holeTime], [x, y, holeTime]]
	for (const triangle of triangles) {
		if (!triangle || triangle.length !== 3) continue;

		// Step 21c.1) Calculate triangle centroid (X and Y only)
		const centroidX = (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3;
		const centroidY = (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3;

		// Step 21c.2) Find nearest hole for Z elevation (relief triangles have holeTime in index 2, not Z)
		const nearestHole = GeometryFactory.findNearestHole(centroidX, centroidY, allBlastHoles);
		const centroidZ = nearestHole ? nearestHole.startZLocation || 0 : 0;

		// Step 21c.3) Calculate burden relief value using GeometryFactory helper
		// Relief triangles already have the correct format: [[x, y, holeTime], ...]
		const burdenRelief = GeometryFactory.getBurdenRelief(triangle);

		// Step 21c.4) Convert to local coordinates
		const local = window.worldToThreeLocal ? window.worldToThreeLocal(centroidX, centroidY) : { x: centroidX, y: centroidY };

		// Step 21c.5) Create text label showing burden relief value (ms/m)
		const labelText = burdenRelief.toFixed(1);
		const textColor = window.darkModeEnabled ? "#FFFFFF" : "#000000";
		const textMesh = GeometryFactory.createKADText(
			local.x,
			local.y,
			centroidZ + 0.3,
			labelText,
			8,
			textColor,
			null // No background
		);

		if (textMesh) {
			textMesh.userData = { type: "reliefLabel" };
			window.threeRenderer.surfacesGroup.add(textMesh);
		}
	}
}

// Step 22) Draw Voronoi cells in Three.js
// selectedMetric: the metric name to use for coloring (e.g., "powderFactor", "mass", "volume", "area", "measuredLength", "designedLength", "holeFiringTime")
export function drawVoronoiCellsThreeJS(clippedCells, getColorFunction, allBlastHoles, extrusionHeight, useToeLocation, selectedMetric) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!clippedCells || clippedCells.length === 0) return;

	// Step 22a) Default extrusionHeight if not provided
	if (extrusionHeight === undefined || extrusionHeight === null) {
		extrusionHeight = 0.2;
	}

	// Step 22b) Create Voronoi cells geometry
	// Positioning: collar mode = 0.1m below collar, toe mode = 0.1m above toe
	var voronoiGroup = GeometryFactory.createVoronoiCells(clippedCells, getColorFunction, allBlastHoles, window.worldToThreeLocal, extrusionHeight, useToeLocation, selectedMetric);

	// Step 22c) Add metadata
	voronoiGroup.userData = {
		type: "voronoiCells",
	};

	window.threeRenderer.surfacesGroup.add(voronoiGroup);
}
