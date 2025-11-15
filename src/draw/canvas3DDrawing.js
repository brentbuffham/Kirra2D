/* prettier-ignore-file */
//=================================================
// canvas3DDrawing.js - Three.js Drawing Functions
//=================================================
// All Three.js/WebGL drawing functions extracted from kirra.js
// This module handles 3D rendering using Three.js

import { GeometryFactory } from "../three/GeometryFactory.js";

// Note: These functions access global variables from kirra.js via window object:
// - threeInitialized, threeRenderer, worldToThreeLocal
// - holeScale, currentScale, darkModeEnabled
// - currentFontSize, textFillColor, depthColor, angleDipColor
// - elevationToColor, rgbStringToThreeColor, dataCentroidZ

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
		holeGroup = GeometryFactory.createSquareHole(collarLocal.x, collarLocal.y, collarZ, squareSize, color);
	} else {
		// Step 3c) Normal hole - full visualization
		holeGroup = GeometryFactory.createHole(collarLocal.x, collarLocal.y, collarZ, gradeLocal.x, gradeLocal.y, gradeZ, toeLocal.x, toeLocal.y, toeZ, hole.holeDiameter, hole.holeColor || "#FF0000", window.holeScale, hole.subdrillAmount || 0, window.darkModeEnabled);
	}

	// Step 4) Add metadata for interaction/selection
	holeGroup.userData = {
		type: "hole",
		holeId: hole.entityName, // Unique identifier for selection
		holeID: hole.holeID, // Display name
		holeData: hole, // Full hole data for tooltips/info
	};

	window.threeRenderer.holesGroup.add(holeGroup);
	window.threeRenderer.holeMeshMap.set(hole.holeID, holeGroup);
}

// Step 4) Draw hole toe in Three.js
export function drawHoleToeThreeJS(worldX, worldY, worldZ, radius, color, holeId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const toeMesh = GeometryFactory.createHoleToe(worldX, worldY, worldZ, radius, color);

	// Step 4a) Add metadata for selection
	toeMesh.userData = {
		type: "holeToe",
		holeId: holeId,
	};

	window.threeRenderer.holesGroup.add(toeMesh);
}

// Step 5) Draw hole label text in Three.js
export function drawHoleTextThreeJS(worldX, worldY, worldZ, text, fontSize, color) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!text || text === "" || text === "null" || text === "undefined") return;

	const local = window.worldToThreeLocal(worldX, worldY);
	const textSprite = GeometryFactory.createKADText(local.x, local.y, worldZ, String(text), fontSize, color, null);
	window.threeRenderer.kadGroup.add(textSprite);
}

// Step 6) Draw all hole labels in Three.js
export function drawHoleTextsAndConnectorsThreeJS(hole, displayOptions) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const fontSize = parseInt(window.currentFontSize) || 12;

	// Step 0) Convert world position to screen coordinates, apply pixel offsets, convert back
	// This matches 2D behavior where offsets are in screen/pixel space
	const camera = window.threeRenderer.camera;
	const renderer = window.threeRenderer.renderer;

	// Helper function to convert screen pixel offset to world offset
	const pixelToWorldOffset = (pixelOffset, isVertical = true) => {
		if (!camera || !renderer) return pixelOffset / window.currentScale; // Fallback

		// For orthographic camera, calculate world size of one pixel
		const height = renderer.domElement.height;
		const width = renderer.domElement.width;

		if (camera.isOrthographicCamera) {
			// Orthographic: world size = camera size / viewport size
			const worldHeight = camera.top - camera.bottom;
			const worldWidth = camera.right - camera.left;
			const pixelWorldHeight = worldHeight / height;
			const pixelWorldWidth = worldWidth / width;

			return isVertical ? pixelOffset * pixelWorldHeight : pixelOffset * pixelWorldWidth;
		} else {
			// Perspective: approximate using distance and FOV
			// For now, use currentScale as fallback
			return pixelOffset / window.currentScale;
		}
	};

	// Step 0a) Calculate text offset in pixels (matching 2D)
	const multiplier = 2;
	const textOffsetPixels = parseInt((hole.holeDiameter / 1000) * multiplier * window.holeScale * window.currentScale);
	const textOffsetWorld = pixelToWorldOffset(textOffsetPixels, false); // Horizontal offset

	// Step 0b) Calculate font size offsets in pixels (matching 2D exactly)
	const fontSizeOffsetWorld = pixelToWorldOffset(fontSize, true); // Vertical offset
	const fontSizeHalfOffsetWorld = pixelToWorldOffset(fontSize / 2, true);
	const fontSizeQuarterOffsetWorld = pixelToWorldOffset(fontSize / 4, true);

	// Step 1) Calculate world positions for text placement
	const collarX = hole.startXLocation;
	const collarY = hole.startYLocation;
	const collarZ = hole.startZLocation || 0;
	const toeX = hole.endXLocation;
	const toeY = hole.endYLocation;
	const toeZ = hole.endZLocation || 0;

	// Step 2) Calculate vertical positions matching 2D logic (in screen space, then convert):
	// topSideCollar = y - textOffset (pixels)
	// middleSideCollar = y + currentFontSize / 2 (pixels)
	// bottomSideCollar = y + textOffset + currentFontSize (pixels)
	const topSideCollar = collarY + textOffsetWorld;
	const middleSideCollar = collarY - fontSizeHalfOffsetWorld;
	const bottomSideCollar = collarY - textOffsetWorld - fontSizeOffsetWorld;
	const topSideToe = toeY - textOffsetWorld;
	const middleSideToe = toeY + textOffsetWorld + fontSizeQuarterOffsetWorld;
	const bottomSideToe = toeY + textOffsetWorld + fontSizeOffsetWorld;

	// Step 3) Right side of collar labels (positive X offset)
	if (displayOptions.holeID) {
		drawHoleTextThreeJS(collarX + textOffsetWorld, topSideCollar, collarZ, hole.holeID, fontSize, window.textFillColor);
	}
	if (displayOptions.holeDia) {
		drawHoleTextThreeJS(collarX + textOffsetWorld, middleSideCollar, collarZ, parseFloat(hole.holeDiameter).toFixed(0), fontSize, "green");
	}
	if (displayOptions.holeLen) {
		drawHoleTextThreeJS(collarX + textOffsetWorld, bottomSideCollar, collarZ, parseFloat(hole.holeLengthCalculated).toFixed(1), fontSize, window.depthColor);
	}
	if (displayOptions.holeType) {
		drawHoleTextThreeJS(collarX + textOffsetWorld, middleSideCollar, collarZ, hole.holeType, fontSize, "green");
	}
	if (displayOptions.measuredComment) {
		drawHoleTextThreeJS(collarX + textOffsetWorld, middleSideCollar, collarZ, hole.measuredComment, fontSize, "#FF8800");
	}

	// Step 4) Left side of collar labels (negative X offset)
	if (displayOptions.holeAng) {
		drawHoleTextThreeJS(collarX - textOffsetWorld, topSideCollar, collarZ, parseFloat(hole.holeAngle).toFixed(0), fontSize, window.angleDipColor);
	}
	if (displayOptions.initiationTime) {
		drawHoleTextThreeJS(collarX - textOffsetWorld, middleSideCollar, collarZ, hole.holeTime, fontSize, "red");
	}
	// Step 4a) XYZ coordinates with proper vertical spacing (matching 2D)
	if (displayOptions.xValue) {
		drawHoleTextThreeJS(collarX - textOffsetWorld, topSideCollar, collarZ, parseFloat(hole.startXLocation).toFixed(2), fontSize, window.textFillColor);
	}
	if (displayOptions.yValue) {
		drawHoleTextThreeJS(collarX - textOffsetWorld, middleSideCollar, collarZ, parseFloat(hole.startYLocation).toFixed(2), fontSize, window.textFillColor);
	}
	if (displayOptions.zValue) {
		drawHoleTextThreeJS(collarX - textOffsetWorld, bottomSideCollar, collarZ, parseFloat(hole.startZLocation).toFixed(2), fontSize, window.textFillColor);
	}
	if (displayOptions.displayRowAndPosId) {
		drawHoleTextThreeJS(collarX - textOffsetWorld, topSideCollar, collarZ, "Row:" + hole.rowID, fontSize, "#FF00FF");
		drawHoleTextThreeJS(collarX - textOffsetWorld, middleSideCollar, collarZ, "Pos:" + hole.posID, fontSize, "#FF00FF");
	}
	if (displayOptions.measuredLength) {
		drawHoleTextThreeJS(collarX - textOffsetWorld, bottomSideCollar + fontSizeOffsetWorld, collarZ, hole.measuredLength, fontSize, "#FF4400");
	}
	if (displayOptions.measuredMass) {
		drawHoleTextThreeJS(collarX - textOffsetWorld, topSideCollar - fontSizeOffsetWorld, collarZ, hole.measuredMass, fontSize, "#FF6600");
	}

	// Step 5) Toe labels with proper spacing (matching 2D)
	if (displayOptions.holeDip) {
		drawHoleTextThreeJS(toeX - textOffsetWorld, topSideToe, toeZ, (90 - parseFloat(hole.holeAngle)).toFixed(0), fontSize, window.angleDipColor);
	}
	if (displayOptions.holeBea) {
		drawHoleTextThreeJS(toeX - textOffsetWorld, bottomSideToe, toeZ, parseFloat(hole.holeBearing).toFixed(1), fontSize, "red");
	}
	if (displayOptions.holeSubdrill) {
		drawHoleTextThreeJS(toeX - textOffsetWorld, bottomSideToe + fontSizeOffsetWorld, toeZ, parseFloat(hole.subdrillAmount).toFixed(1), fontSize, "blue");
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

	const lineMesh = GeometryFactory.createKADLineSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color);

	// Step 8a) Add metadata for selection
	if (kadId) {
		lineMesh.userData = { type: "kadLine", kadId: kadId };
	}

	window.threeRenderer.kadGroup.add(lineMesh);
}

// Step 9) Draw KAD polygon segment in Three.js
// Matches 2D drawKADPolys() - draws a single segment with its own attributes
export function drawKADPolygonSegmentThreeJS(startX, startY, startZ, endX, endY, endZ, lineWidth, color, kadId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const polyMesh = GeometryFactory.createKADPolygonSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color);

	// Step 9a) Add metadata for selection
	if (kadId) {
		polyMesh.userData = { type: "kadPolygon", kadId: kadId };
	}

	window.threeRenderer.kadGroup.add(polyMesh);
}

// Step 10) Draw KAD circle in Three.js
export function drawKADCircleThreeJS(worldX, worldY, worldZ, radius, lineWidth, color, kadId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const circleMesh = GeometryFactory.createKADCircle(worldX, worldY, worldZ, radius, lineWidth, color);

	// Step 10a) Add metadata for selection
	if (kadId) {
		circleMesh.userData = { type: "kadCircle", kadId: kadId };
	}

	window.threeRenderer.kadGroup.add(circleMesh);
}

// Step 11) Draw KAD text in Three.js
export function drawKADTextThreeJS(worldX, worldY, worldZ, text, fontSize, color, backgroundColor = null) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const textSprite = GeometryFactory.createKADText(worldX, worldY, worldZ, text, fontSize, color, backgroundColor);
	window.threeRenderer.kadGroup.add(textSprite);
}

//=================================================
// Surface & Other 3D Drawing
//=================================================

// Step 12) Draw surface in Three.js
export function drawSurfaceThreeJS(surfaceId, triangles, minZ, maxZ, gradient, transparency) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	// Step 9a) Convert triangle vertices from world coordinates to local Three.js coordinates
	const localTriangles = triangles.map((triangle) => {
		if (!triangle.vertices || triangle.vertices.length !== 3) return triangle;

		const localVertices = triangle.vertices.map((v) => {
			const local = window.worldToThreeLocal(v.x, v.y);
			return {
				x: local.x,
				y: local.y,
				z: v.z, // Keep elevation as-is
			};
		});

		return {
			...triangle,
			vertices: localVertices,
		};
	});

	// Step 10) Create color function for this surface
	const colorFunction = (z) => {
		const rgbString = window.elevationToColor(z, minZ, maxZ, gradient);
		return window.rgbStringToThreeColor(rgbString);
	};

	// Step 11) Create mesh with vertex colors (using local coordinates)
	const surfaceMesh = GeometryFactory.createSurface(localTriangles, colorFunction, transparency);
	surfaceMesh.userData = {
		type: "surface",
		surfaceId: surfaceId,
	};

	window.threeRenderer.surfacesGroup.add(surfaceMesh);
	window.threeRenderer.surfaceMeshMap.set(surfaceId, surfaceMesh);
}

// Step 13) Draw contour lines in Three.js
export function drawContoursThreeJS(contourLinesArray, color) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const contourGroup = GeometryFactory.createContourLines(contourLinesArray, color);
	window.threeRenderer.contoursGroup.add(contourGroup);
}

// Step 14) Draw direction arrows in Three.js
export function drawDirectionArrowsThreeJS(directionArrows) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const arrowGroup = GeometryFactory.createDirectionArrows(directionArrows);
	window.threeRenderer.contoursGroup.add(arrowGroup);
}

// Step 15) Draw background image in Three.js
export function drawBackgroundImageThreeJS(imageId, imageCanvas, bbox, transparency) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const imageMesh = GeometryFactory.createImagePlane(imageCanvas, bbox, transparency);
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

	// Step 18b) Determine colors based on highlight type
	let fillColor, strokeColor, radius;

	const holeDiameter = parseFloat(hole.holeDiameter) || 0;
	const baseRadius = 10 + (holeDiameter / 900) * window.holeScale * window.currentScale;

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
			fillColor = "rgba(255, 150, 0, 0.7)";
			strokeColor = "rgba(200, 200, 0, 0.7)";
			radius = 10 + (holeDiameter / 400) * window.holeScale * window.currentScale;
			break;
		case "animation-paused":
			// Animation paused: green
			fillColor = "rgba(0, 255, 0, 0.5)";
			strokeColor = "rgba(0, 255, 0, 0.7)";
			radius = 10 + (holeDiameter / 500) * window.holeScale * window.currentScale;
			break;
		default:
			fillColor = "rgba(255, 0, 150, 0.2)";
			strokeColor = "rgba(255, 0, 150, .8)";
			radius = baseRadius;
	}

	// Step 18c) Create highlight geometry
	const highlightGroup = GeometryFactory.createSelectionHighlight(local.x, local.y, z, radius, fillColor, strokeColor);

	// Step 18d) Add metadata
	highlightGroup.userData = {
		type: "selectionHighlight",
		holeId: hole.entityName + ":::" + hole.holeID,
		highlightType: highlightType,
	};

	window.threeRenderer.holesGroup.add(highlightGroup);
}

// Step 19) Draw connection stadium zone in Three.js
export function drawConnectStadiumZoneThreeJS(fromHole, toMousePos, connectAmount) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!fromHole || !toMousePos) return;

	// Step 19a) Convert world coordinates to local Three.js coordinates
	const fromLocal = window.worldToThreeLocal(fromHole.startXLocation, fromHole.startYLocation);
	const toLocal = window.worldToThreeLocal(toMousePos.x, toMousePos.y);

	// Step 19b) Use collar Z elevation
	const z = fromHole.startZLocation || 0;

	// Step 19c) Calculate radius in world units (connectAmount is in meters)
	const radius = connectAmount;

	// Step 19d) Create stadium zone geometry
	const stadiumGroup = GeometryFactory.createStadiumZone(
		fromLocal.x,
		fromLocal.y,
		z,
		toLocal.x,
		toLocal.y,
		z,
		radius,
		"rgba(0, 255, 0, 0.4)", // stroke
		"rgba(0, 255, 0, 0.15)" // fill
	);

	// Step 19e) Add metadata
	stadiumGroup.userData = {
		type: "stadiumZone",
		fromHoleId: fromHole.entityName + ":::" + fromHole.holeID,
	};

	window.threeRenderer.connectorsGroup.add(stadiumGroup);
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
}

// Step 22) Draw Voronoi cells in Three.js
export function drawVoronoiCellsThreeJS(clippedCells, getColorFunction, allBlastHoles, extrusionHeight = 1.0) {
	if (!window.threeInitialized || !window.threeRenderer) return;
	if (!clippedCells || clippedCells.length === 0) return;

	// Step 22a) Create Voronoi cells geometry
	const voronoiGroup = GeometryFactory.createVoronoiCells(clippedCells, getColorFunction, allBlastHoles, window.worldToThreeLocal, extrusionHeight);

	// Step 22b) Add metadata
	voronoiGroup.userData = {
		type: "voronoiCells",
	};

	window.threeRenderer.surfacesGroup.add(voronoiGroup);
}
