/* prettier-ignore-file */
//=================================================
// ThreeRenderer.js - Core Three.js rendering system
//=================================================
import * as THREE from "three";

export class ThreeRenderer {
	constructor(containerElement, width, height) {
		// Step 1) Store container reference
		this.container = containerElement;
		this.width = width;
		this.height = height;

		// Step 1a) Orbit center Z coordinate (for 3D orbit around data centroid)
		this.orbitCenterZ = 0;

		// Step 2) Create scene with white background (will update based on dark mode)
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0xffffff); // White for light mode

		// Step 3) Create orthographic camera with Y-up coordinate system
		// Camera coordinates: +X right, +Y up, -Z into screen
		const aspect = width / height;
		const frustumSize = 1000;
		this.camera = new THREE.OrthographicCamera(
			(-frustumSize * aspect) / 2, // left
			(frustumSize * aspect) / 2, // right
			frustumSize / 2, // top
			-frustumSize / 2, // bottom
			0.1, // near
			10000 // far
		);

		// Step 4) Position camera looking down negative Z axis (into screen)
		this.camera.position.set(0, 0, 1000);
		this.camera.lookAt(0, 0, 0);
		this.camera.up.set(0, 1, 0); // Y-up orientation

		// Step 5) Create WebGL renderer with transparency
		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
			preserveDrawingBuffer: true, // Needed for screenshots/printing
		});
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setClearColor(0x000000, 0); // Transparent

		// Step 6) Add lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight.position.set(0, 0, 1000);
		this.scene.add(directionalLight);

		// Step 7) Initialize object groups for organization
		this.holesGroup = new THREE.Group();
		this.holesGroup.name = "Holes";
		this.scene.add(this.holesGroup);

		this.surfacesGroup = new THREE.Group();
		this.surfacesGroup.name = "Surfaces";
		this.scene.add(this.surfacesGroup);

		this.kadGroup = new THREE.Group();
		this.kadGroup.name = "KAD";
		this.scene.add(this.kadGroup);

		this.contoursGroup = new THREE.Group();
		this.contoursGroup.name = "Contours";
		this.scene.add(this.contoursGroup);

		this.imagesGroup = new THREE.Group();
		this.imagesGroup.name = "Images";
		this.scene.add(this.imagesGroup);

		// Step 8) Store mesh references for selection
		this.holeMeshMap = new Map(); // holeId -> mesh
		this.surfaceMeshMap = new Map(); // surfaceId -> mesh
		this.kadMeshMap = new Map(); // kadId -> mesh

		// Step 9) Raycaster for selection
		this.raycaster = new THREE.Raycaster();
		this.raycaster.params.Line.threshold = 5; // Increase line selection tolerance

		// Step 10) Camera state for external sync
		this.cameraState = {
			centroidX: 0,
			centroidY: 0,
			scale: 1,
			rotation: 0,
			orbitX: 0,
			orbitY: 0,
		};

		// Step 11) Animation control
		this.needsRender = true;
		this.animationFrameId = null;

		// Step 12) Create XYZ axis helper (hidden by default)
		// Size is in world units but will be scaled to maintain fixed screen size
		this.axisHelper = this.createAxisHelper(50); // Base size for calculations
		this.axisHelper.visible = false;
		this.scene.add(this.axisHelper);
		this.axisHelperBaseSize = 50; // Store base size for screen-space scaling
	}

	// Step 11b) Create XYZ axis helper widget (fixed 50px screen size)
	createAxisHelper(size) {
		const group = new THREE.Group();

		// X-axis (Red) - points East
		const xGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(size, 0, 0)]);
		const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
		const xLine = new THREE.Line(xGeometry, xMaterial);
		group.add(xLine);

		// Y-axis (Green) - points North (up)
		const yGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, size, 0)]);
		const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 });
		const yLine = new THREE.Line(yGeometry, yMaterial);
		group.add(yLine);

		// Z-axis (Blue) - points up out of screen
		const zGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, size)]);
		const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 });
		const zLine = new THREE.Line(zGeometry, zMaterial);
		group.add(zLine);

		// Add labels using sprites
		const xLabel = this.createTextSprite("X", 0xff0000);
		xLabel.position.set(size + 10, 0, 0);
		group.add(xLabel);

		const yLabel = this.createTextSprite("Y", 0x00ff00);
		yLabel.position.set(0, size + 10, 0);
		group.add(yLabel);

		const zLabel = this.createTextSprite("Z", 0x0000ff);
		zLabel.position.set(0, 0, size + 10);
		group.add(zLabel);

		return group;
	}

	// Step 11c) Create text sprite for axis labels
	createTextSprite(text, color) {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		canvas.width = 128;
		canvas.height = 64;

		context.font = "Bold 48px Arial";
		context.fillStyle = "#" + color.toString(16).padStart(6, "0");
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.fillText(text, 64, 32);

		const texture = new THREE.CanvasTexture(canvas);
		const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
		const sprite = new THREE.Sprite(material);
		sprite.scale.set(25, 12.5, 1);
		sprite.renderOrder = 1000; // Render on top

		return sprite;
	}

	// Step 12) Get the canvas element for DOM insertion
	getCanvas() {
		return this.renderer.domElement;
	}

	// Step 13) Update camera to match world coordinates and 2D canvas transformation
	updateCamera(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0, orbitZ = 0) {
		this.cameraState.centroidX = centroidX;
		this.cameraState.centroidY = centroidY;
		this.cameraState.scale = scale;
		this.cameraState.rotation = rotation;
		this.cameraState.orbitX = orbitX;
		this.cameraState.orbitY = orbitY;
		this.cameraState.orbitZ = orbitZ;

		// Step 13a) Update axis helper position if it's visible (but don't auto-show)
		// The axis helper is controlled by mouse/touch events in CameraControls
		if (this.axisHelper && this.axisHelper.visible) {
			this.axisHelper.position.set(centroidX, centroidY, this.orbitCenterZ);

			// Maintain fixed screen size
			const desiredScreenPixels = 50;
			const worldUnitsForFixedScreenSize = desiredScreenPixels / scale;
			const scaleFactor = worldUnitsForFixedScreenSize / this.axisHelperBaseSize;
			this.axisHelper.scale.set(scaleFactor, scaleFactor, scaleFactor);
		}

		// Step 14) Calculate camera position based on orbit angles
		const cameraDistance = 1000; // Fixed distance from centroid

		// If orbit angles are non-zero, calculate 3D camera position
		if (orbitX !== 0 || orbitY !== 0) {
			// Spherical to Cartesian conversion
			// orbitX = pitch (elevation), orbitY = yaw (azimuth)
			const x = cameraDistance * Math.cos(orbitX) * Math.sin(orbitY);
			const y = cameraDistance * Math.sin(orbitX);
			const z = cameraDistance * Math.cos(orbitX) * Math.cos(orbitY);

			// Position camera relative to orbit center (centroidX, centroidY, orbitCenterZ)
			this.camera.position.set(centroidX + x, centroidY + y, this.orbitCenterZ + z);

			// Look at the orbit center (using data Z centroid)
			this.camera.lookAt(centroidX, centroidY, this.orbitCenterZ);

			// Apply Z-axis rotation (2D spin)
			this.camera.rotateZ(rotation);
		} else {
			// Standard 2D top-down view
			this.camera.position.x = centroidX;
			this.camera.position.y = centroidY;
			this.camera.position.z = 1000;

			// Reset camera rotation to default (looking down)
			this.camera.rotation.set(0, 0, 0);
			this.camera.up.set(0, 1, 0);

			// Apply Z-axis rotation only
			this.camera.rotation.z = rotation;
		}

		// Step 15) Update orthographic bounds to match 2D canvas coordinate system
		const viewportWidthInWorldUnits = this.width / scale;
		const viewportHeightInWorldUnits = this.height / scale;

		this.camera.left = -viewportWidthInWorldUnits / 2;
		this.camera.right = viewportWidthInWorldUnits / 2;
		this.camera.top = viewportHeightInWorldUnits / 2;
		this.camera.bottom = -viewportHeightInWorldUnits / 2;

		this.camera.updateProjectionMatrix();
		this.needsRender = true;
	}

	// Step 16) Set orbit center Z coordinate
	setOrbitCenterZ(z) {
		this.orbitCenterZ = z || 0;
	}

	// Step 17) Resize renderer and update camera bounds
	resize(width, height) {
		this.width = width;
		this.height = height;
		this.renderer.setSize(width, height);

		// Recalculate orthographic bounds based on new canvas size
		const scale = this.cameraState.scale;
		const viewportWidthInWorldUnits = width / scale;
		const viewportHeightInWorldUnits = height / scale;

		this.camera.left = -viewportWidthInWorldUnits / 2;
		this.camera.right = viewportWidthInWorldUnits / 2;
		this.camera.top = viewportHeightInWorldUnits / 2;
		this.camera.bottom = -viewportHeightInWorldUnits / 2;
		this.camera.updateProjectionMatrix();

		this.needsRender = true;
	}

	// Step 18) Convert world coordinates to Three.js coordinates
	worldToThree(worldX, worldY, worldZ = 0) {
		// World coords already match Three.js: +X right, +Y up
		// Z: use worldZ directly (positive = out of screen)
		return new THREE.Vector3(worldX, worldY, worldZ);
	}

	// Step 19) Helper method to dispose object resources
	disposeObject(object) {
		// Step 19a) Dispose geometry
		if (object.geometry) {
			object.geometry.dispose();
		}

		// Step 19b) Dispose material(s)
		if (object.material) {
			if (Array.isArray(object.material)) {
				object.material.forEach((material) => {
					if (material.map) material.map.dispose();
					if (material.lightMap) material.lightMap.dispose();
					if (material.bumpMap) material.bumpMap.dispose();
					if (material.normalMap) material.normalMap.dispose();
					if (material.specularMap) material.specularMap.dispose();
					if (material.envMap) material.envMap.dispose();
					material.dispose();
				});
			} else {
				if (object.material.map) object.material.map.dispose();
				if (object.material.lightMap) object.material.lightMap.dispose();
				if (object.material.bumpMap) object.material.bumpMap.dispose();
				if (object.material.normalMap) object.material.normalMap.dispose();
				if (object.material.specularMap) object.material.specularMap.dispose();
				if (object.material.envMap) object.material.envMap.dispose();
				object.material.dispose();
			}
		}

		// Step 19c) Dispose textures on sprites
		if (object.isSprite && object.material && object.material.map) {
			object.material.map.dispose();
		}
	}

	// Step 20) Dispose group and all children
	disposeGroup(group) {
		// Step 20a) Traverse and dispose all objects
		group.traverse((object) => {
			if (object !== group) {
				this.disposeObject(object);
			}
		});

		// Step 20b) Clear the group
		group.clear();
	}

	// Step 21) Clear all geometry from scene
	clearAllGeometry() {
		// Step 21a) Dispose all groups to prevent memory leaks
		this.disposeGroup(this.holesGroup);
		this.disposeGroup(this.surfacesGroup);
		this.disposeGroup(this.kadGroup);
		this.disposeGroup(this.contoursGroup);
		this.disposeGroup(this.imagesGroup);

		// Step 21b) Clear mesh maps
		this.holeMeshMap.clear();
		this.surfaceMeshMap.clear();
		this.kadMeshMap.clear();

		this.needsRender = true;
	}

	// Step 22) Clear specific group
	clearGroup(groupName) {
		switch (groupName) {
			case "holes":
				this.disposeGroup(this.holesGroup);
				this.holeMeshMap.clear();
				break;
			case "surfaces":
				this.disposeGroup(this.surfacesGroup);
				this.surfaceMeshMap.clear();
				break;
			case "kad":
				this.disposeGroup(this.kadGroup);
				this.kadMeshMap.clear();
				break;
			case "contours":
				this.disposeGroup(this.contoursGroup);
				break;
			case "images":
				this.disposeGroup(this.imagesGroup);
				break;
		}
		this.needsRender = true;
	}

	// Step 23) Render the scene
	render() {
		this.renderer.render(this.scene, this.camera);
		this.needsRender = false;
	}

	// Step 24) Start animation loop (only renders when needed)
	startRenderLoop() {
		const animate = () => {
			this.animationFrameId = requestAnimationFrame(animate);
			if (this.needsRender) {
				this.render();
			}
		};
		animate();
	}

	// Step 25) Stop animation loop
	stopRenderLoop() {
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	// Step 26) Request render on next frame
	requestRender() {
		this.needsRender = true;
	}

	// Step 27) Update background color based on dark mode
	setBackgroundColor(isDarkMode) {
		const backgroundColor = isDarkMode ? 0x000000 : 0xffffff; // Black in dark mode, white in light mode
		this.scene.background = new THREE.Color(backgroundColor);
		this.needsRender = true;
	}

	// Step 28) Show/hide axis helper with fixed screen size (50 pixels)
	showAxisHelper(show, positionX = 0, positionY = 0, scale = 1) {
		if (this.axisHelper) {
			this.axisHelper.visible = show;
			if (show) {
				this.axisHelper.position.set(positionX, positionY, 0);

				// Step 28a) Scale to maintain fixed screen size (50 pixels)
				// Screen size (pixels) = world size * scale
				// To get 50 pixels: world size = 50 / scale
				const desiredScreenPixels = 50;
				const worldUnitsForFixedScreenSize = desiredScreenPixels / scale;
				const scaleFactor = worldUnitsForFixedScreenSize / this.axisHelperBaseSize;
				this.axisHelper.scale.set(scaleFactor, scaleFactor, scaleFactor);

				console.log("🎯 Axis helper at orbit point:", positionX.toFixed(2), positionY.toFixed(2), "scale:", scaleFactor.toFixed(3));
			}
			this.needsRender = true;
		}
	}

	// Step 29) Raycast for object selection
	raycast(mouseX, mouseY) {
		// Convert mouse coordinates to normalized device coordinates (-1 to +1)
		const mouse = new THREE.Vector2();
		mouse.x = (mouseX / this.width) * 2 - 1;
		mouse.y = -(mouseY / this.height) * 2 + 1;

		this.raycaster.setFromCamera(mouse, this.camera);

		// Check intersections with all objects
		const intersects = this.raycaster.intersectObjects(this.scene.children, true);
		return intersects;
	}

	// Step 30) Get scene statistics
	getStats() {
		return {
			holes: this.holeMeshMap.size,
			surfaces: this.surfaceMeshMap.size,
			kad: this.kadMeshMap.size,
			triangles: this.renderer.info.render.triangles,
			calls: this.renderer.info.render.calls,
		};
	}

	// Step 31) Cleanup
	dispose() {
		this.stopRenderLoop();

		// Dispose all geometries and materials
		this.scene.traverse((object) => {
			if (object.geometry) {
				object.geometry.dispose();
			}
			if (object.material) {
				if (Array.isArray(object.material)) {
					object.material.forEach((material) => material.dispose());
				} else {
					object.material.dispose();
				}
			}
		});

		this.renderer.dispose();
	}
}
