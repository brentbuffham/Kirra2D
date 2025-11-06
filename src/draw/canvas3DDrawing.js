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
	const fontSize = parseInt(window.currentFontSize) || 12;
	const textOffset = (hole.holeDiameter / 1000) * window.holeScale;

	// Step 1) Calculate world positions for text placement
	const collarX = hole.startXLocation;
	const collarY = hole.startYLocation;
	const collarZ = hole.startZLocation || 0;
	const toeX = hole.endXLocation;
	const toeY = hole.endYLocation;
	const toeZ = hole.endZLocation || 0;

	// Step 2) Right side of collar labels (positive X offset)
	if (displayOptions.holeID) {
		drawHoleTextThreeJS(collarX + textOffset, collarY + textOffset, collarZ, hole.holeID, fontSize, window.textFillColor);
	}
	if (displayOptions.holeDia) {
		drawHoleTextThreeJS(collarX + textOffset, collarY, collarZ, parseFloat(hole.holeDiameter).toFixed(0), fontSize, "green");
	}
	if (displayOptions.holeLen) {
		drawHoleTextThreeJS(collarX + textOffset, collarY - textOffset, collarZ, parseFloat(hole.holeLengthCalculated).toFixed(1), fontSize, window.depthColor);
	}
	if (displayOptions.holeType) {
		drawHoleTextThreeJS(collarX + textOffset, collarY, collarZ, hole.holeType, fontSize, "green");
	}
	if (displayOptions.measuredComment) {
		drawHoleTextThreeJS(collarX + textOffset, collarY, collarZ, hole.measuredComment, fontSize, "#FF8800");
	}

	// Step 3) Left side of collar labels (negative X offset)
	if (displayOptions.holeAng) {
		drawHoleTextThreeJS(collarX - textOffset, collarY + textOffset, collarZ, parseFloat(hole.holeAngle).toFixed(0), fontSize, window.angleDipColor);
	}
	if (displayOptions.initiationTime) {
		drawHoleTextThreeJS(collarX - textOffset, collarY, collarZ, hole.holeTime, fontSize, "red");
	}
	if (displayOptions.xValue) {
		drawHoleTextThreeJS(collarX - textOffset, collarY + textOffset, collarZ, parseFloat(hole.startXLocation).toFixed(2), fontSize, window.textFillColor);
	}
	if (displayOptions.yValue) {
		drawHoleTextThreeJS(collarX - textOffset, collarY, collarZ, parseFloat(hole.startYLocation).toFixed(2), fontSize, window.textFillColor);
	}
	if (displayOptions.zValue) {
		drawHoleTextThreeJS(collarX - textOffset, collarY - textOffset, collarZ, parseFloat(hole.startZLocation).toFixed(2), fontSize, window.textFillColor);
	}
	if (displayOptions.displayRowAndPosId) {
		drawHoleTextThreeJS(collarX - textOffset, collarY + textOffset, collarZ, "Row:" + hole.rowID, fontSize, "#FF00FF");
		drawHoleTextThreeJS(collarX - textOffset, collarY, collarZ, "Pos:" + hole.posID, fontSize, "#FF00FF");
	}
	if (displayOptions.measuredLength) {
		drawHoleTextThreeJS(collarX - textOffset, collarY - textOffset * 2, collarZ, hole.measuredLength, fontSize, "#FF4400");
	}
	if (displayOptions.measuredMass) {
		drawHoleTextThreeJS(collarX - textOffset, collarY + textOffset * 2, collarZ, hole.measuredMass, fontSize, "#FF6600");
	}

	// Step 4) Toe labels
	if (displayOptions.holeDip) {
		drawHoleTextThreeJS(toeX - textOffset, toeY + textOffset, toeZ, (90 - parseFloat(hole.holeAngle)).toFixed(0), fontSize, window.angleDipColor);
	}
	if (displayOptions.holeBea) {
		drawHoleTextThreeJS(toeX - textOffset, toeY - textOffset, toeZ, parseFloat(hole.holeBearing).toFixed(1), fontSize, "red");
	}
	if (displayOptions.holeSubdrill) {
		drawHoleTextThreeJS(toeX - textOffset, toeY - textOffset, toeZ, parseFloat(hole.subdrillAmount).toFixed(1), fontSize, "blue");
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

// Step 8) Draw KAD line in Three.js
export function drawKADLineThreeJS(points, lineWidth, color, kadId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const lineMesh = GeometryFactory.createKADLine(points, lineWidth, color);
	
	// Step 8a) Add metadata for selection
	if (kadId) {
		lineMesh.userData = { type: "kadLine", kadId: kadId };
	}
	
	window.threeRenderer.kadGroup.add(lineMesh);
}

// Step 9) Draw KAD polygon in Three.js
export function drawKADPolygonThreeJS(points, lineWidth, color, kadId) {
	if (!window.threeInitialized || !window.threeRenderer) return;

	const polyMesh = GeometryFactory.createKADPolygon(points, lineWidth, color);
	
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
