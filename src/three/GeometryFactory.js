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

		// Step 9) Scale sprite to fixed size based on fontSize (not text width)
		// This ensures all text labels are the same size regardless of content
		// Use fixed scale based on fontSize to maintain consistent sizing
		// Scale factor converts font size to world units for 3D visibility
		const scaleFactor = 0.5; // Adjust this to control text size in 3D
		const fixedTextHeight = fontSize * scaleFactor; // Height in world units
		const fixedTextWidth = fontSize * scaleFactor * 4; // Width in world units (aspect ratio for typical text)

		sprite.scale.set(fixedTextWidth, fixedTextHeight, 1);

		sprite.renderOrder = 100; // Render on top

		return sprite;
	}

	// Step 12.5) Helper function to find nearest hole for a point
	static findNearestHole(x, y, allBlastHoles) {
		if (!allBlastHoles || allBlastHoles.length === 0) return null;

		let nearestHole = null;
		let minDistance = Infinity;

		for (const hole of allBlastHoles) {
			const dx = x - hole.startXLocation;
			const dy = y - hole.startYLocation;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < minDistance) {
				minDistance = distance;
				nearestHole = hole;
			}
		}

		return nearestHole;
	}

	// Step 12.6) Helper function to get slope color based on angle
	static getSlopeColor(slopeAngle) {
		if (slopeAngle >= 0 && slopeAngle < 5) {
			return "rgb(51, 139, 255)";
		} else if (slopeAngle >= 5 && slopeAngle < 7) {
			return "rgb(0, 102, 204)";
		} else if (slopeAngle >= 7 && slopeAngle < 9) {
			return "rgb(0, 204, 204)";
		} else if (slopeAngle >= 9 && slopeAngle < 12) {
			return "rgb(102, 204, 0)";
		} else if (slopeAngle >= 12 && slopeAngle < 15) {
			return "rgb(204, 204, 0)";
		} else if (slopeAngle >= 15 && slopeAngle < 17) {
			return "rgb(255, 128, 0)";
		} else if (slopeAngle >= 17 && slopeAngle < 20) {
			return "rgb(255, 0, 0)";
		} else {
			return "rgb(153, 0, 76)";
		}
	}

	// Step 12.7) Helper function to get burden relief color
	static getBurdenReliefColor(burdenRelief) {
		if (burdenRelief < 4) {
			return "rgb(75, 20, 20)";
		} else if (burdenRelief < 7) {
			return "rgb(255, 40, 40)";
		} else if (burdenRelief < 10) {
			return "rgb(255, 120, 50)";
		} else if (burdenRelief < 13) {
			return "rgb(255, 255, 50)";
		} else if (burdenRelief < 16) {
			return "rgb(50, 255, 70)";
		} else if (burdenRelief < 19) {
			return "rgb(50, 255, 200)";
		} else if (burdenRelief < 22) {
			return "rgb(50, 230, 255)";
		} else if (burdenRelief < 25) {
			return "rgb(50, 180, 255)";
		} else if (burdenRelief < 30) {
			return "rgb(50, 100, 255)";
		} else if (burdenRelief < 40) {
			return "rgb(50, 0, 255)";
		} else {
			return "rgb(75, 0, 150)";
		}
	}

	// Step 12.8) Helper function to calculate dip angle from triangle vertices
	static getDipAngle(triangle) {
		const edge1 = [triangle[1][0] - triangle[0][0], triangle[1][1] - triangle[0][1], triangle[1][2] - triangle[0][2]];
		const edge2 = [triangle[2][0] - triangle[0][0], triangle[2][1] - triangle[0][1], triangle[2][2] - triangle[0][2]];

		// Calculate the normal vector of the triangle's plane
		const normalVector = [edge1[1] * edge2[2] - edge1[2] * edge2[1], edge1[2] * edge2[0] - edge1[0] * edge2[2], edge1[0] * edge2[1] - edge1[1] * edge2[0]];

		// Calculate the dot product with the vertical direction (0, 0, 1)
		const dotProduct = normalVector[0] * 0 + normalVector[1] * 0 + normalVector[2] * 1;
		const magNormal = Math.sqrt(normalVector[0] ** 2 + normalVector[1] ** 2 + normalVector[2] ** 2);

		const epsilon = 1e-6;
		if (Math.abs(magNormal) < epsilon) {
			return 0;
		}

		const angleRadians = Math.acos(dotProduct / magNormal);
		const angleDegrees = (angleRadians * 180) / Math.PI;

		const dipAngle = 180 - angleDegrees;
		return dipAngle;
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

	// Step 16) Create slope surface (triangles positioned at collar Z, colored by slope angle)
	static createSlopeSurface(triangles, allBlastHoles, worldToThreeLocalFn, transparency = 1.0) {
		if (!triangles || triangles.length === 0) {
			const geometry = new THREE.BufferGeometry();
			const material = new THREE.MeshBasicMaterial();
			return new THREE.Mesh(geometry, material);
		}

		const positions = [];
		const colors = [];

		for (const triangle of triangles) {
			if (!triangle || triangle.length !== 3) continue;

			// Step 16a) For each vertex, find nearest hole and use its collar Z
			const vertices = [];
			for (let i = 0; i < 3; i++) {
				const [worldX, worldY, originalZ] = triangle[i];
				const nearestHole = this.findNearestHole(worldX, worldY, allBlastHoles);
				const collarZ = nearestHole ? nearestHole.startZLocation || 0 : originalZ;

				// Step 16a.1) Convert to local Three.js coordinates
				const local = worldToThreeLocalFn ? worldToThreeLocalFn(worldX, worldY) : { x: worldX, y: worldY };
				vertices.push({ x: local.x, y: local.y, z: collarZ });
			}

			// Step 16b) Calculate slope angle from triangle vertices (using collar Z)
			const triangleForSlope = [
				[vertices[0].x, vertices[0].y, vertices[0].z],
				[vertices[1].x, vertices[1].y, vertices[1].z],
				[vertices[2].x, vertices[2].y, vertices[2].z],
			];
			const slopeAngle = this.getDipAngle(triangleForSlope);

			// Step 16c) Get color based on slope angle
			const colorString = this.getSlopeColor(slopeAngle);
			const colorMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
			const color = colorMatch
				? {
						r: parseInt(colorMatch[1]) / 255,
						g: parseInt(colorMatch[2]) / 255,
						b: parseInt(colorMatch[3]) / 255,
				  }
				: { r: 1, g: 1, b: 1 };

			// Step 16d) Add vertices and colors
			positions.push(vertices[0].x, vertices[0].y, vertices[0].z);
			positions.push(vertices[1].x, vertices[1].y, vertices[1].z);
			positions.push(vertices[2].x, vertices[2].y, vertices[2].z);

			colors.push(color.r, color.g, color.b);
			colors.push(color.r, color.g, color.b);
			colors.push(color.r, color.g, color.b);
		}

		if (positions.length === 0) {
			const geometry = new THREE.BufferGeometry();
			const material = new THREE.MeshBasicMaterial();
			return new THREE.Mesh(geometry, material);
		}

		// Step 16e) Create BufferGeometry
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
		geometry.computeVertexNormals();

		// Step 16f) Create material with vertex colors
		const material = new THREE.MeshPhongMaterial({
			vertexColors: true,
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

	// Step 16.5) Create burden relief surface (triangles positioned at collar Z, colored by burden relief)
	static createReliefSurface(triangles, allBlastHoles, worldToThreeLocalFn, transparency = 1.0) {
		if (!triangles || triangles.length === 0) {
			const geometry = new THREE.BufferGeometry();
			const material = new THREE.MeshBasicMaterial();
			return new THREE.Mesh(geometry, material);
		}

		const positions = [];
		const colors = [];

		for (const triangle of triangles) {
			if (!triangle || triangle.length !== 3) continue;

			// Step 16.5a) Extract original timing values from triangle Z (for burden relief calculation)
			const [tAX, tAY, tAZ] = triangle[0]; // timing in Z
			const [tBX, tBY, tBZ] = triangle[1]; // timing in Z
			const [tCX, tCY, tCZ] = triangle[2]; // timing in Z

			// Step 16.5b) Find nearest holes for each vertex to get collar Z
			const vertices = [];
			for (let i = 0; i < 3; i++) {
				const [worldX, worldY] = triangle[i];
				const nearestHole = this.findNearestHole(worldX, worldY, allBlastHoles);
				const collarZ = nearestHole ? nearestHole.startZLocation || 0 : 0;

				// Step 16.5b.1) Convert to local Three.js coordinates
				const local = worldToThreeLocalFn ? worldToThreeLocalFn(worldX, worldY) : { x: worldX, y: worldY };
				vertices.push({ x: local.x, y: local.y, z: collarZ });
			}

			// Step 16.5c) Calculate burden relief from timing data (using original world coordinates)
			const earliestTime = Math.min(tAZ, tBZ, tCZ);
			const latestTime = Math.max(tAZ, tBZ, tCZ);
			const timeDifference = latestTime - earliestTime;

			// Find points corresponding to earliest and latest times
			let p1, p2;
			if (earliestTime === tAZ) {
				p1 = { x: tAX, y: tAY };
			} else if (earliestTime === tBZ) {
				p1 = { x: tBX, y: tBY };
			} else {
				p1 = { x: tCX, y: tCY };
			}

			if (latestTime === tAZ) {
				p2 = { x: tAX, y: tAY };
			} else if (latestTime === tBZ) {
				p2 = { x: tBX, y: tBY };
			} else {
				p2 = { x: tCX, y: tCY };
			}

			const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
			const burdenRelief = distance > 0 ? timeDifference / distance : 0;

			// Step 16.5d) Get color based on burden relief
			const colorString = this.getBurdenReliefColor(burdenRelief);
			const colorMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
			const color = colorMatch
				? {
						r: parseInt(colorMatch[1]) / 255,
						g: parseInt(colorMatch[2]) / 255,
						b: parseInt(colorMatch[3]) / 255,
				  }
				: { r: 1, g: 1, b: 1 };

			// Step 16.5e) Add vertices (using collar Z) and colors
			positions.push(vertices[0].x, vertices[0].y, vertices[0].z);
			positions.push(vertices[1].x, vertices[1].y, vertices[1].z);
			positions.push(vertices[2].x, vertices[2].y, vertices[2].z);

			colors.push(color.r, color.g, color.b);
			colors.push(color.r, color.g, color.b);
			colors.push(color.r, color.g, color.b);
		}

		if (positions.length === 0) {
			const geometry = new THREE.BufferGeometry();
			const material = new THREE.MeshBasicMaterial();
			return new THREE.Mesh(geometry, material);
		}

		// Step 16.5f) Create BufferGeometry
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
		geometry.computeVertexNormals();

		// Step 16.5g) Create material with vertex colors
		const material = new THREE.MeshPhongMaterial({
			vertexColors: true,
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

	// Step 20.5) Create connector line with curve and arrowhead
	static createConnectorLine(fromX, fromY, fromZ, toX, toY, toZ, color, curve, delayText, connScale) {
		const group = new THREE.Group();

		// Step 20.5a) Convert color string to Three.js Color
		const threeColor = new THREE.Color(color);

		// Step 20.5b) Calculate arrow size based on connScale
		const arrowSize = (connScale / 4) * 2; // Match 2D sizing

		// Step 20.5c) Check if self-connecting (fromHole === toHole)
		const isSelfConnecting = Math.abs(fromX - toX) < 0.001 && Math.abs(fromY - toY) < 0.001;

		if (isSelfConnecting) {
			// Step 20.5c.1) Draw house shape for self-referencing (matching 2D style)
			const size = arrowSize;
			// Create shape geometry for filled house
			const shape = new THREE.Shape();
			shape.moveTo(toX, toY); // Peak
			shape.lineTo(toX - size / 2, toY + size); // Left bottom
			shape.lineTo(toX - size / 2, toY + 1.5 * size); // Left top
			shape.lineTo(toX + size / 2, toY + 1.5 * size); // Right top
			shape.lineTo(toX + size / 2, toY + size); // Right bottom
			shape.lineTo(toX, toY); // Close back to peak

			const houseGeometry = new THREE.ShapeGeometry(shape);
			const houseMaterial = new THREE.MeshBasicMaterial({ color: threeColor, side: THREE.DoubleSide });
			const houseMesh = new THREE.Mesh(houseGeometry, houseMaterial);
			houseMesh.position.z = toZ;
			group.add(houseMesh);

			// Step 20.5c.2) Draw outline/stroke
			const houseOutlinePoints = [
				new THREE.Vector3(toX, toY, toZ), // Peak
				new THREE.Vector3(toX - size / 2, toY + size, toZ), // Left bottom
				new THREE.Vector3(toX - size / 2, toY + 1.5 * size, toZ), // Left top
				new THREE.Vector3(toX + size / 2, toY + 1.5 * size, toZ), // Right top
				new THREE.Vector3(toX + size / 2, toY + size, toZ), // Right bottom
				new THREE.Vector3(toX, toY, toZ), // Close back to peak
			];

			const houseOutlineGeometry = new THREE.BufferGeometry().setFromPoints(houseOutlinePoints);
			const houseOutlineMaterial = new THREE.LineBasicMaterial({ color: threeColor, linewidth: 2 });
			const houseOutline = new THREE.Line(houseOutlineGeometry, houseOutlineMaterial);
			group.add(houseOutline);
		}
		// Step 20.5d) Handle straight connector (curve = 0)
		else if (curve === 0) {
			// Straight line
			const points = [new THREE.Vector3(fromX, fromY, fromZ), new THREE.Vector3(toX, toY, toZ)];
			const geometry = new THREE.BufferGeometry().setFromPoints(points);
			const material = new THREE.LineBasicMaterial({ color: threeColor, linewidth: 2 });
			const line = new THREE.Line(geometry, material);
			group.add(line);

			// Step 20.5d.1) Create arrowhead for straight line
			const direction = new THREE.Vector3(toX - fromX, toY - fromY, toZ - fromZ).normalize();
			const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0);
			const arrowBase = new THREE.Vector3(toX, toY, toZ);

			const arrowPoints = [
				new THREE.Vector3(toX, toY, toZ),
				arrowBase
					.clone()
					.add(direction.clone().multiplyScalar(-arrowSize))
					.add(perpendicular.clone().multiplyScalar(arrowSize * 0.5)),
				arrowBase
					.clone()
					.add(direction.clone().multiplyScalar(-arrowSize))
					.add(perpendicular.clone().multiplyScalar(-arrowSize * 0.5)),
				new THREE.Vector3(toX, toY, toZ),
			];

			const arrowGeometry = new THREE.BufferGeometry().setFromPoints(arrowPoints);
			const arrowMaterial = new THREE.MeshBasicMaterial({ color: threeColor });
			const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
			group.add(arrowMesh);
		} else {
			// Step 20.5e) Handle curved connector
			const midX = (fromX + toX) / 2;
			const midY = (fromY + toY) / 2;
			const midZ = (fromZ + toZ) / 2;
			const dx = toX - fromX;
			const dy = toY - fromY;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// Step 20.5f) Calculate control point based on curve angle
			const radians = (curve * Math.PI) / 180;
			const curveFactor = (curve / 90) * distance * 0.5;

			// Perpendicular vector for curve direction
			const perpX = -dy / distance;
			const perpY = dx / distance;

			const controlX = midX + perpX * curveFactor;
			const controlY = midY + perpY * curveFactor;
			const controlZ = midZ;

			// Step 20.5g) Create quadratic bezier curve
			const curvePoints = [];
			const segments = 20; // Number of segments for smooth curve
			for (let i = 0; i <= segments; i++) {
				const t = i / segments;
				const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * controlX + t * t * toX;
				const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * controlY + t * t * toY;
				const z = (1 - t) * (1 - t) * fromZ + 2 * (1 - t) * t * controlZ + t * t * toZ;
				curvePoints.push(new THREE.Vector3(x, y, z));
			}

			const curveGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
			const curveMaterial = new THREE.LineBasicMaterial({ color: threeColor, linewidth: 2 });
			const curveLine = new THREE.Line(curveGeometry, curveMaterial);
			group.add(curveLine);

			// Step 20.5h) Create arrowhead for curved line (tangent at end point)
			// Calculate tangent at end point (derivative of quadratic bezier at t=1)
			const tangentX = 2 * (toX - controlX);
			const tangentY = 2 * (toY - controlY);
			const tangentZ = 2 * (toZ - controlZ);
			const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ);
			const direction = new THREE.Vector3(tangentX / tangentLength, tangentY / tangentLength, tangentZ / tangentLength);

			const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0);
			const arrowBase = new THREE.Vector3(toX, toY, toZ);

			const arrowPoints = [
				new THREE.Vector3(toX, toY, toZ),
				arrowBase
					.clone()
					.add(direction.clone().multiplyScalar(-arrowSize))
					.add(perpendicular.clone().multiplyScalar(arrowSize * 0.5)),
				arrowBase
					.clone()
					.add(direction.clone().multiplyScalar(-arrowSize))
					.add(perpendicular.clone().multiplyScalar(-arrowSize * 0.5)),
				new THREE.Vector3(toX, toY, toZ),
			];

			const arrowGeometry = new THREE.BufferGeometry().setFromPoints(arrowPoints);
			const arrowMaterial = new THREE.MeshBasicMaterial({ color: threeColor });
			const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
			group.add(arrowMesh);
		}

		// Step 20.5i) Add delay text if provided
		if (delayText !== null && delayText !== undefined && delayText !== "") {
			const midX = (fromX + toX) / 2;
			const midY = (fromY + toY) / 2;
			const midZ = (fromZ + toZ) / 2;
			const textSprite = this.createKADText(midX, midY, midZ, String(delayText), 12, color, null);
			group.add(textSprite);
		}

		return group;
	}

	// Step 20.6) Create selection highlight ring (matching drawHiHole style)
	static createSelectionHighlight(x, y, z, radius, fillColor, strokeColor) {
		const group = new THREE.Group();

		// Step 20.6a) Parse RGBA colors
		const fillColorObj = this.parseRGBA(fillColor);
		const strokeColorObj = this.parseRGBA(strokeColor);

		// Step 20.6b) Create ring geometry (torus-like but flat)
		const ringGeometry = new THREE.RingGeometry(radius * 0.8, radius, 32);
		const fillMaterial = new THREE.MeshBasicMaterial({
			color: new THREE.Color(fillColorObj.r, fillColorObj.g, fillColorObj.b),
			transparent: true,
			opacity: fillColorObj.a,
			side: THREE.DoubleSide,
		});
		const fillMesh = new THREE.Mesh(ringGeometry, fillMaterial);
		fillMesh.position.set(x, y, z);
		fillMesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
		group.add(fillMesh);

		// Step 20.6c) Create stroke ring (outer edge)
		const strokeGeometry = new THREE.RingGeometry(radius * 0.99, radius, 32);
		const strokeMaterial = new THREE.MeshBasicMaterial({
			color: new THREE.Color(strokeColorObj.r, strokeColorObj.g, strokeColorObj.b),
			transparent: true,
			opacity: strokeColorObj.a,
			side: THREE.DoubleSide,
		});
		const strokeMesh = new THREE.Mesh(strokeGeometry, strokeMaterial);
		strokeMesh.position.set(x, y, z);
		strokeMesh.rotation.x = -Math.PI / 2;
		group.add(strokeMesh);

		return group;
	}

	// Step 20.7) Parse RGBA color string to object
	static parseRGBA(rgbaString) {
		const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
		if (match) {
			return {
				r: parseInt(match[1]) / 255,
				g: parseInt(match[2]) / 255,
				b: parseInt(match[3]) / 255,
				a: match[4] ? parseFloat(match[4]) : 1.0,
			};
		}
		// Fallback to white
		return { r: 1, g: 1, b: 1, a: 1 };
	}

	// Step 20.8) Create stadium zone (ellipsoid indicator for multi-connector)
	static createStadiumZone(startX, startY, startZ, endX, endY, endZ, radius, strokeColor, fillColor) {
		const group = new THREE.Group();

		// Step 20.8a) Parse colors
		const strokeColorObj = this.parseRGBA(strokeColor);
		const fillColorObj = this.parseRGBA(fillColor);

		// Step 20.8b) Calculate direction and perpendicular vectors
		const dx = endX - startX;
		const dy = endY - startY;
		const length = Math.sqrt(dx * dx + dy * dy);

		if (length < 0.001) return group; // Avoid division by zero

		const dirX = dx / length;
		const dirY = dy / length;
		const perpX = -dirY;
		const perpY = dirX;

		// Step 20.8c) Calculate four corners
		const corner1X = startX + perpX * radius;
		const corner1Y = startY + perpY * radius;
		const corner2X = startX - perpX * radius;
		const corner2Y = startY - perpY * radius;
		const corner3X = endX - perpX * radius;
		const corner3Y = endY - perpY * radius;
		const corner4X = endX + perpX * radius;
		const corner4Y = endY + perpY * radius;

		// Step 20.8d) Create shape for rounded rectangle
		const shape = new THREE.Shape();
		shape.moveTo(corner1X, corner1Y);
		shape.lineTo(corner4X, corner4Y);
		shape.arc(endX, endY, radius, Math.atan2(perpY, perpX), Math.atan2(-perpY, -perpX), false);
		shape.lineTo(corner3X, corner3Y);
		shape.lineTo(corner2X, corner2Y);
		shape.arc(startX, startY, radius, Math.atan2(-perpY, -perpX), Math.atan2(perpY, perpX), false);
		shape.closePath();

		// Step 20.8e) Create geometry and material
		const geometry = new THREE.ShapeGeometry(shape);
		const fillMaterial = new THREE.MeshBasicMaterial({
			color: new THREE.Color(fillColorObj.r, fillColorObj.g, fillColorObj.b),
			transparent: true,
			opacity: fillColorObj.a,
			side: THREE.DoubleSide,
		});
		const fillMesh = new THREE.Mesh(geometry, fillMaterial);
		fillMesh.position.z = startZ;
		fillMesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
		group.add(fillMesh);

		// Step 20.8f) Create dashed stroke (using line segments)
		const strokeMaterial = new THREE.LineDashedMaterial({
			color: new THREE.Color(strokeColorObj.r, strokeColorObj.g, strokeColorObj.b),
			transparent: true,
			opacity: strokeColorObj.a,
			dashSize: 5,
			gapSize: 5,
		});

		// Create stroke outline
		const strokePoints = [new THREE.Vector3(corner1X, corner1Y, startZ), new THREE.Vector3(corner4X, corner4Y, startZ), new THREE.Vector3(corner3X, corner3Y, startZ), new THREE.Vector3(corner2X, corner2Y, startZ), new THREE.Vector3(corner1X, corner1Y, startZ)];
		const strokeGeometry = new THREE.BufferGeometry().setFromPoints(strokePoints);
		const strokeLine = new THREE.Line(strokeGeometry, strokeMaterial);
		strokeLine.computeLineDistances(); // Required for dashed lines
		group.add(strokeLine);

		return group;
	}

	// Step 21) Create voronoi cells (extruded, positioned at collar Z)
	static createVoronoiCells(cells, getColorFunction, allBlastHoles, worldToThreeLocalFn, extrusionHeight = 1.0) {
		const group = new THREE.Group();

		for (const cell of cells) {
			if (!cell.polygon || cell.polygon.length < 3) continue;

			// Step 21a) Find nearest hole to get collar Z
			const cellCenterX = cell.polygon.reduce((sum, pt) => sum + (pt.x !== undefined ? pt.x : pt[0]), 0) / cell.polygon.length;
			const cellCenterY = cell.polygon.reduce((sum, pt) => sum + (pt.y !== undefined ? pt.y : pt[1]), 0) / cell.polygon.length;
			const nearestHole = this.findNearestHole(cellCenterX, cellCenterY, allBlastHoles);
			const collarZ = nearestHole ? nearestHole.startZLocation || 0 : 0;

			// Step 21b) Create shape from polygon (convert to local coordinates)
			const shape = new THREE.Shape();
			const firstPt = cell.polygon[0];
			const firstX = firstPt.x !== undefined ? firstPt.x : firstPt[0];
			const firstY = firstPt.y !== undefined ? firstPt.y : firstPt[1];
			const firstLocal = worldToThreeLocalFn ? worldToThreeLocalFn(firstX, firstY) : { x: firstX, y: firstY };
			shape.moveTo(firstLocal.x, firstLocal.y);

			for (let i = 1; i < cell.polygon.length; i++) {
				const pt = cell.polygon[i];
				const x = pt.x !== undefined ? pt.x : pt[0];
				const y = pt.y !== undefined ? pt.y : pt[1];
				const local = worldToThreeLocalFn ? worldToThreeLocalFn(x, y) : { x: x, y: y };
				shape.lineTo(local.x, local.y);
			}
			shape.closePath();

			// Step 21c) Get color based on selected metric
			const value = cell.powderFactor || cell.mass || cell.volume || cell.length || cell.holeFiringTime || 0;
			const color = getColorFunction(value);

			// Step 21d) Create extruded geometry
			const extrudeSettings = {
				depth: extrusionHeight,
				bevelEnabled: false,
			};
			const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
			geometry.translate(0, 0, collarZ);

			const material = new THREE.MeshPhongMaterial({
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
