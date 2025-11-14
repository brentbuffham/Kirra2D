/* prettier-ignore-file */
//=================================================
// GeometryFactory.js - Reusable Three.js geometry creators
//=================================================
import * as THREE from "three";
import { MeshLine, MeshLineMaterial } from "../helpers/meshLineModified.js";

export class GeometryFactory {
	// Step 1) Create complete hole visualization (collar + grade circle + lines)
	// Matches 2D canvas drawTrack() implementation
	static createHole(collarX, collarY, collarZ, gradeX, gradeY, gradeZ, toeX, toeY, toeZ, diameter, color, holeScale = 1, subdrillAmount = 0, isDarkMode = false) {
		const group = new THREE.Group();

		// Step 2) Calculate dimensions
		const diameterInMeters = diameter / 1000;
		const radiusInMeters = (diameterInMeters / 2) * (holeScale * 2);
		const gradeRadiusInMeters = radiusInMeters * 0.5; // Grade circle is 30% of collar size

		// Step 3) Check if subdrill is negative
		const hasNegativeSubdrill = subdrillAmount < 0;

		// Step 4) Determine colors based on dark mode
		const collarColor = isDarkMode ? 0xffffff : 0x000000; // White in dark mode, black in light mode
		const lineColor = isDarkMode ? 0xffffff : 0x000000;

		// Step 5) Create collar circle (ALWAYS solid, never transparent)
		const collarGeometry = new THREE.CircleGeometry(radiusInMeters, 32);
		const collarMaterial = new THREE.MeshBasicMaterial({
			color: collarColor,
			side: THREE.DoubleSide,
			transparent: false, // Collar is NEVER transparent
			opacity: 1.0,
			depthTest: true, // Enable depth testing so holes don't show through surfaces
			depthWrite: true, // Write to depth buffer
		});
		const collarMesh = new THREE.Mesh(collarGeometry, collarMaterial);
		collarMesh.position.set(collarX, collarY, collarZ);
		group.add(collarMesh);

		if (hasNegativeSubdrill) {
			// NEGATIVE SUBDRILL CASE
			// Step 6a) Draw line from collar to toe (solid)
			const collarToToePoints = [new THREE.Vector3(collarX, collarY, collarZ), new THREE.Vector3(toeX, toeY, toeZ)];
			const collarToToeGeometry = new THREE.BufferGeometry().setFromPoints(collarToToePoints);
			const collarToToeMaterial = new THREE.LineBasicMaterial({
				color: lineColor,
				linewidth: 1,
				transparent: false,
				opacity: 1.0,
			});
			const collarToToeLine = new THREE.Line(collarToToeGeometry, collarToToeMaterial);
			group.add(collarToToeLine);

			// Step 6b) Draw RED line from toe to grade (20% opacity = 80% transparent)
			const toeToGradePoints = [new THREE.Vector3(toeX, toeY, toeZ), new THREE.Vector3(gradeX, gradeY, gradeZ)];
			const toeToGradeGeometry = new THREE.BufferGeometry().setFromPoints(toeToGradePoints);
			const toeToGradeMaterial = new THREE.LineBasicMaterial({
				color: 0xff0000,
				linewidth: 1,
				transparent: true,
				opacity: 0.2,
			});
			const toeToGradeLine = new THREE.Line(toeToGradeGeometry, toeToGradeMaterial);
			group.add(toeToGradeLine);

			// Step 6c) Create RED grade circle (20% opacity)
			const gradeCircleGeometry = new THREE.CircleGeometry(gradeRadiusInMeters, 32);
			const gradeCircleMaterial = new THREE.MeshBasicMaterial({
				color: 0xff0000, // RED
				side: THREE.DoubleSide,
				transparent: true,
				opacity: 0.2,
				depthTest: true, // Enable depth testing
				depthWrite: false, // Transparent objects shouldn't write to depth buffer
			});
			const gradeCircleMesh = new THREE.Mesh(gradeCircleGeometry, gradeCircleMaterial);
			gradeCircleMesh.position.set(gradeX, gradeY, gradeZ);
			group.add(gradeCircleMesh);
		} else {
			// POSITIVE SUBDRILL CASE (normal)
			// Step 7a) Draw line from collar to grade (solid, black/white)
			const collarToGradePoints = [new THREE.Vector3(collarX, collarY, collarZ), new THREE.Vector3(gradeX, gradeY, gradeZ)];
			const collarToGradeGeometry = new THREE.BufferGeometry().setFromPoints(collarToGradePoints);
			const collarToGradeMaterial = new THREE.LineBasicMaterial({
				color: lineColor,
				linewidth: 1,
				transparent: false,
				opacity: 1.0,
			});
			const collarToGradeLine = new THREE.Line(collarToGradeGeometry, collarToGradeMaterial);
			group.add(collarToGradeLine);

			// Step 7b) Draw RED line from grade to toe (solid)
			const gradeToToePoints = [new THREE.Vector3(gradeX, gradeY, gradeZ), new THREE.Vector3(toeX, toeY, toeZ)];
			const gradeToToeGeometry = new THREE.BufferGeometry().setFromPoints(gradeToToePoints);
			const gradeToToeMaterial = new THREE.LineBasicMaterial({
				color: 0xff0000,
				linewidth: 1,
				transparent: false,
				opacity: 1.0,
			});
			const gradeToToeLine = new THREE.Line(gradeToToeGeometry, gradeToToeMaterial);
			group.add(gradeToToeLine);

			// Step 7c) Create RED grade circle (solid)
			const gradeCircleGeometry = new THREE.CircleGeometry(gradeRadiusInMeters, 32);
			const gradeCircleMaterial = new THREE.MeshBasicMaterial({
				color: 0xff0000, // RED
				side: THREE.DoubleSide,
				transparent: false,
				opacity: 1.0,
				depthTest: true, // Enable depth testing
				depthWrite: true, // Write to depth buffer
			});
			const gradeCircleMesh = new THREE.Mesh(gradeCircleGeometry, gradeCircleMaterial);
			gradeCircleMesh.position.set(gradeX, gradeY, gradeZ);
			group.add(gradeCircleMesh);
		}

		return group;
	}

	// Step 5) Create a hole toe mesh (simple circle)
	static createHoleToe(worldX, worldY, worldZ, radius, color) {
		const geometry = new THREE.CircleGeometry(radius, 32);
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(color),
			side: THREE.DoubleSide,
			transparent: false,
		});

		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(worldX, worldY, worldZ);

		return mesh;
	}

	// Step 6) Create a dummy hole (X shape) - 200mm * holeScale
	static createDummyHole(worldX, worldY, worldZ, radius, color) {
		const group = new THREE.Group();

		// Step 7) Create X with two lines
		const material = new THREE.LineBasicMaterial({
			color: color, // Use color directly (already a hex number)
			linewidth: 2,
		});

		// Line 1: top-left to bottom-right
		const points1 = [];
		points1.push(new THREE.Vector3(-radius, radius, 0));
		points1.push(new THREE.Vector3(radius, -radius, 0));
		const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
		const line1 = new THREE.Line(geometry1, material);

		// Line 2: top-right to bottom-left
		const points2 = [];
		points2.push(new THREE.Vector3(radius, radius, 0));
		points2.push(new THREE.Vector3(-radius, -radius, 0));
		const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
		const line2 = new THREE.Line(geometry2, material);

		group.add(line1);
		group.add(line2);
		group.position.set(worldX, worldY, worldZ);

		return group;
	}

	// Step 6b) Create a square hole (unfilled square) for zero diameter holes WITH track
	// This replaces the old createSquareHole which didn't include the track
	static createZeroDiameterHole(collarX, collarY, collarZ, gradeX, gradeY, gradeZ, toeX, toeY, toeZ, squareSize, subdrillAmount = 0, isDarkMode = false) {
		const group = new THREE.Group();

		// Step 7b) Determine colors based on dark mode
		const lineColor = isDarkMode ? 0xffffff : 0x000000;
		const hasNegativeSubdrill = subdrillAmount < 0;

		// Step 7c) Create unfilled square at collar
		const squareMaterial = new THREE.LineBasicMaterial({
			color: lineColor,
			linewidth: 2,
			depthTest: true, // Enable depth testing
		});

		const halfSide = squareSize / 2;
		const squarePoints = [new THREE.Vector3(-halfSide, -halfSide, 0), new THREE.Vector3(halfSide, -halfSide, 0), new THREE.Vector3(halfSide, halfSide, 0), new THREE.Vector3(-halfSide, halfSide, 0)];

		const squareGeometry = new THREE.BufferGeometry().setFromPoints(squarePoints);
		const square = new THREE.LineLoop(squareGeometry, squareMaterial);
		square.position.set(collarX, collarY, collarZ);
		square.renderOrder = 10;
		group.add(square);

		// Step 7d) Draw hole track (same logic as normal holes)
		if (hasNegativeSubdrill) {
			// NEGATIVE SUBDRILL: collar to toe (solid), toe to grade (transparent red)
			const collarToToePoints = [new THREE.Vector3(collarX, collarY, collarZ), new THREE.Vector3(toeX, toeY, toeZ)];
			const collarToToeGeometry = new THREE.BufferGeometry().setFromPoints(collarToToePoints);
			const collarToToeMaterial = new THREE.LineBasicMaterial({
				color: lineColor,
				linewidth: 1,
				transparent: false,
				opacity: 1.0,
			});
			const collarToToeLine = new THREE.Line(collarToToeGeometry, collarToToeMaterial);
			group.add(collarToToeLine);

			// Red line from toe to grade (20% opacity)
			const toeToGradePoints = [new THREE.Vector3(toeX, toeY, toeZ), new THREE.Vector3(gradeX, gradeY, gradeZ)];
			const toeToGradeGeometry = new THREE.BufferGeometry().setFromPoints(toeToGradePoints);
			const toeToGradeMaterial = new THREE.LineBasicMaterial({
				color: 0xff0000,
				linewidth: 1,
				transparent: true,
				opacity: 0.2,
			});
			const toeToGradeLine = new THREE.Line(toeToGradeGeometry, toeToGradeMaterial);
			group.add(toeToGradeLine);
		} else {
			// POSITIVE SUBDRILL: collar to grade (solid black/white), grade to toe (solid red)
			const collarToGradePoints = [new THREE.Vector3(collarX, collarY, collarZ), new THREE.Vector3(gradeX, gradeY, gradeZ)];
			const collarToGradeGeometry = new THREE.BufferGeometry().setFromPoints(collarToGradePoints);
			const collarToGradeMaterial = new THREE.LineBasicMaterial({
				color: lineColor,
				linewidth: 1,
				transparent: false,
				opacity: 1.0,
			});
			const collarToGradeLine = new THREE.Line(collarToGradeGeometry, collarToGradeMaterial);
			group.add(collarToGradeLine);

			// Red line from grade to toe (solid)
			const gradeToToePoints = [new THREE.Vector3(gradeX, gradeY, gradeZ), new THREE.Vector3(toeX, toeY, toeZ)];
			const gradeToToeGeometry = new THREE.BufferGeometry().setFromPoints(gradeToToePoints);
			const gradeToToeMaterial = new THREE.LineBasicMaterial({
				color: 0xff0000,
				linewidth: 1,
				transparent: false,
				opacity: 1.0,
			});
			const gradeToToeLine = new THREE.Line(gradeToToeGeometry, gradeToToeMaterial);
			group.add(gradeToToeLine);
		}

		return group;
	}

	// Step 8) Create hexagon hole
	static createHexagonHole(worldX, worldY, worldZ, sideLength, fillColor, strokeColor) {
		const geometry = new THREE.CircleGeometry(sideLength, 6);
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(fillColor),
			side: THREE.DoubleSide,
		});

		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(worldX, worldY, worldZ);
		mesh.rotation.z = Math.PI / 6; // Rotate 30 degrees

		return mesh;
	}

	// Step 9) Create KAD point
	static createKADPoint(worldX, worldY, worldZ, size, color) {
		const geometry = new THREE.CircleGeometry(size, 16);
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(color),
			side: THREE.DoubleSide,
		});

		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(worldX, worldY, worldZ);

		return mesh;
	}

	// Step 10) Create KAD line segment (single segment between two points)
	// Matches 2D canvas drawKADLines() - each segment has its own lineWidth and color
	static createKADLineSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color) {
		// Step 10a) Create two-point line
		const points = [new THREE.Vector3(startX, startY, startZ), new THREE.Vector3(endX, endY, endZ)];

		// Step 10b) Create MeshLine material with proper lineWidth
		const material = new MeshLineMaterial({
			color: new THREE.Color(color),
			lineWidth: lineWidth || 3, // Direct pixel width
			resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
			sizeAttenuation: 0, // 0 = constant screen size
			opacity: 1.0,
		});
		material.transparent = true;
		material.depthTest = true;
		material.depthWrite = true;

		// Step 10c) Create geometry from points
		const geometry = new THREE.BufferGeometry().setFromPoints(points);

		// Step 10d) Create MeshLine and set geometry
		const line = new MeshLine();
		line.setGeometry(geometry);

		// Step 10e) Create and return mesh
		const mesh = new THREE.Mesh(line, material);
		mesh.name = "kad-line-segment";

		return mesh;
	}

	// Step 11) Create KAD polygon segment (single segment between two points)
	// Matches 2D canvas drawKADPolys() - each segment has its own lineWidth and color
	static createKADPolygonSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color) {
		// Step 11a) Same as line segment - polygon is just a closed series of segments
		return GeometryFactory.createKADLineSegment(startX, startY, startZ, endX, endY, endZ, lineWidth, color);
	}

	// Step 12) Create KAD circle with MeshLine
	static createKADCircle(worldX, worldY, worldZ, radius, lineWidth, color) {
		// Step 12a) Create MeshLine material
		const material = new MeshLineMaterial({
			color: new THREE.Color(color),
			lineWidth: lineWidth || 3, // Direct pixel width
			resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
			sizeAttenuation: 0, // Constant screen size
			opacity: 1.0,
		});
		material.transparent = true;
		material.depthTest = true;
		material.depthWrite = true;

		// Step 12b) Create circle points centered at (0, 0, 0) for precision
		const segments = 64;
		const positions = [];
		for (let i = 0; i <= segments; i++) {
			const theta = (i / segments) * Math.PI * 2;
			const x = radius * Math.cos(theta);
			const y = radius * Math.sin(theta);
			positions.push(x, y, 0); // Centered at origin
		}

		// Step 12c) Create geometry from positions
		const circleGeometry = new THREE.BufferGeometry();
		circleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

		// Step 12d) Create MeshLine and set geometry
		const circle = new MeshLine();
		circle.setGeometry(circleGeometry);

		// Step 12e) Create mesh and position it at world coordinates
		const circleMesh = new THREE.Mesh(circle.geometry, material);
		circleMesh.position.set(worldX, worldY, worldZ);
		circleMesh.name = "kad-circle";

		return circleMesh;
	}

	// Step 12b) Create KAD text using canvas texture
	static createKADText(worldX, worldY, worldZ, text, fontSize, color, backgroundColor = null) {
		// Step 1) Create canvas for text rendering
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");

		// Step 2) Set canvas size (power of 2 for better WebGL performance)
		canvas.width = 512;
		canvas.height = 128;

		// Step 3) Configure text style
		context.font = fontSize + "px Arial";
		context.textAlign = "center";
		context.textBaseline = "middle";

		// Step 4) Draw background if specified
		if (backgroundColor) {
			context.fillStyle = backgroundColor;
			context.fillRect(0, 0, canvas.width, canvas.height);
		}

		// Step 5) Draw text
		context.fillStyle = color;
		context.fillText(text, canvas.width / 2, canvas.height / 2);

		// Step 6) Create texture from canvas
		const texture = new THREE.CanvasTexture(canvas);
		texture.needsUpdate = true;

		// Step 7) Create sprite material with texture
		const material = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			depthTest: true,
			depthWrite: false,
		});

		// Step 8) Create sprite and position it
		const sprite = new THREE.Sprite(material);
		sprite.position.set(worldX, worldY, worldZ);

		// Step 9) Scale sprite to match text size (scaled up for visibility in 3D)
		// Estimate text width for proper scaling
		const textWidth = context.measureText(text).width;
		const baseScale = (textWidth / canvas.width) * fontSize;

		// Step 9a) Scale up significantly for 3D world coordinates
		// Multiply by 20 to make text large enough to see in 3D space
		const worldScale = baseScale * 20;
		sprite.scale.set(worldScale, worldScale * 0.25, 1);

		sprite.renderOrder = 100; // Render on top

		return sprite;
	}

	// Step 13) Create surface from triangle objects (Kirra format)
	static createSurface(triangles, colorFunction, transparency = 1.0) {
		// Step 14) Build geometry from triangles
		// Each triangle has: { vertices: [{x, y, z}, {x, y, z}, {x, y, z}], minZ, maxZ }
		const positions = [];
		const colors = [];

		for (let triangle of triangles) {
			if (!triangle.vertices || triangle.vertices.length !== 3) continue;

			const [p1, p2, p3] = triangle.vertices;

			// Add vertices
			positions.push(p1.x, p1.y, p1.z);
			positions.push(p2.x, p2.y, p2.z);
			positions.push(p3.x, p3.y, p3.z);

			// Add colors if colorFunction provided
			if (colorFunction) {
				const color1 = colorFunction(p1.z);
				const color2 = colorFunction(p2.z);
				const color3 = colorFunction(p3.z);

				colors.push(color1.r, color1.g, color1.b);
				colors.push(color2.r, color2.g, color2.b);
				colors.push(color3.r, color3.g, color3.b);
			}
		}

		if (positions.length === 0) {
			// Return empty mesh if no triangles
			const geometry = new THREE.BufferGeometry();
			const material = new THREE.MeshBasicMaterial();
			return new THREE.Mesh(geometry, material);
		}

		// Step 15) Create BufferGeometry
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

		if (colors.length > 0) {
			geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
		}

		geometry.computeVertexNormals();

		// Step 16) Create material with vertex colors and Phong shading
		const material = new THREE.MeshPhongMaterial({
			vertexColors: colors.length > 0,
			side: THREE.DoubleSide,
			transparent: transparency < 1.0,
			opacity: transparency,
			shininess: 30,
			specular: 0x222222,
			flatShading: false,
		});

		const mesh = new THREE.Mesh(geometry, material);
		return mesh;
	}

	// Step 17) Create contour lines
	static createContourLines(contourLinesArray, color) {
		const group = new THREE.Group();

		for (let levelIndex = 0; levelIndex < contourLinesArray.length; levelIndex++) {
			const contourLines = contourLinesArray[levelIndex];

			for (let i = 0; i < contourLines.length; i++) {
				const line = contourLines[i];
				if (line.length === 2) {
					const points = [new THREE.Vector3(line[0].x, line[0].y, 0), new THREE.Vector3(line[1].x, line[1].y, 0)];

					const geometry = new THREE.BufferGeometry().setFromPoints(points);
					const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
					const lineSegment = new THREE.Line(geometry, material);
					group.add(lineSegment);
				}
			}
		}

		return group;
	}

	// Step 18) Create direction arrows
	static createDirectionArrows(directionArrows) {
		const group = new THREE.Group();

		for (const arrow of directionArrows) {
			const [startX, startY, endX, endY, color, size] = arrow;

			// Step 19) Create arrow line
			const points = [new THREE.Vector3(startX, startY, 0), new THREE.Vector3(endX, endY, 0)];

			const geometry = new THREE.BufferGeometry().setFromPoints(points);
			const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
			const line = new THREE.Line(geometry, material);

			// Step 20) Create arrowhead
			const direction = new THREE.Vector3(endX - startX, endY - startY, 0).normalize();
			const arrowSize = size * 0.3;

			const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0);
			const arrowBase = new THREE.Vector3(endX, endY, 0);

			const arrowPoints = [
				new THREE.Vector3(endX, endY, 0),
				arrowBase
					.clone()
					.add(direction.clone().multiplyScalar(-arrowSize))
					.add(perpendicular.clone().multiplyScalar(arrowSize * 0.5)),
				arrowBase
					.clone()
					.add(direction.clone().multiplyScalar(-arrowSize))
					.add(perpendicular.clone().multiplyScalar(-arrowSize * 0.5)),
				new THREE.Vector3(endX, endY, 0),
			];

			const arrowGeometry = new THREE.BufferGeometry().setFromPoints(arrowPoints);
			const arrowLine = new THREE.Line(arrowGeometry, material);

			group.add(line);
			group.add(arrowLine);
		}

		return group;
	}

	// Step 21) Create voronoi cells
	static createVoronoiCells(cells, getColorFunction) {
		const group = new THREE.Group();

		for (const cell of cells) {
			if (!cell.polygon || cell.polygon.length < 3) continue;

			// Step 22) Triangulate polygon for filling
			const shape = new THREE.Shape();
			shape.moveTo(cell.polygon[0][0], cell.polygon[0][1]);
			for (let i = 1; i < cell.polygon.length; i++) {
				shape.lineTo(cell.polygon[i][0], cell.polygon[i][1]);
			}
			shape.closePath();

			const geometry = new THREE.ShapeGeometry(shape);
			const color = getColorFunction(cell.powderFactor);
			const material = new THREE.MeshBasicMaterial({
				color: new THREE.Color(color),
				side: THREE.DoubleSide,
				transparent: true,
				opacity: 0.6,
			});

			const mesh = new THREE.Mesh(geometry, material);
			group.add(mesh);
		}

		return group;
	}

	// Step 23) Create background image plane
	static createImagePlane(imageCanvas, bbox, transparency = 1.0) {
		// Step 24) Calculate dimensions
		const width = bbox[2] - bbox[0];
		const height = bbox[3] - bbox[1];
		const centerX = (bbox[0] + bbox[2]) / 2;
		const centerY = (bbox[1] + bbox[3]) / 2;

		// Step 25) Create texture from canvas
		const texture = new THREE.CanvasTexture(imageCanvas);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;

		// Step 26) Create plane geometry
		const geometry = new THREE.PlaneGeometry(width, height);
		const material = new THREE.MeshBasicMaterial({
			map: texture,
			transparent: transparency < 1.0,
			opacity: transparency,
			side: THREE.DoubleSide,
		});

		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(centerX, centerY, -100); // Behind other geometry

		return mesh;
	}

	// Step 27) Create highlight mesh for selection
	static createHighlightMesh(originalMesh, highlightColor) {
		const geometry = originalMesh.geometry.clone();
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(highlightColor),
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide,
		});

		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.copy(originalMesh.position);
		mesh.rotation.copy(originalMesh.rotation);
		mesh.scale.copy(originalMesh.scale);

		return mesh;
	}
}
