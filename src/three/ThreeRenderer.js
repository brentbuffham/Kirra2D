/* prettier-ignore-file */
//=================================================
// ThreeRenderer.js - Core Three.js rendering system
//=================================================
import * as THREE from "three";
import { clearTextCache } from "./GeometryFactory.js";

export class ThreeRenderer {
	constructor(containerElement, width, height) {
		// Step 1) Store container reference
		this.container = containerElement;
		this.width = width;
		this.height = height;

		// Step 1a) Orbit center coordinates (for 3D orbit around data centroid)
		this.orbitCenterX = 0;
		this.orbitCenterY = 0;
		this.orbitCenterZ = 0;

		// Step 2) Create scene with white background (will update based on dark mode)
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0xffffff); // White for light mode

		// Step 3) Create orthographic camera with Z-up coordinate system
		// Camera coordinates: +X East, +Y North, +Z Up
		const aspect = width / height;
		const frustumSize = 1000;
		this.camera = new THREE.OrthographicCamera(
			(-frustumSize * aspect) / 2, // left
			(frustumSize * aspect) / 2, // right
			frustumSize / 2, // top
			-frustumSize / 2, // bottom
			-50000, // near (large range for mining elevations)
			50000 // far (large range for mining elevations)
		);

		// Step 4) Position camera looking down at origin (will be updated to look at data centroid)
		this.camera.position.set(0, 0, 5000);
		this.camera.lookAt(0, 0, 0);
		this.camera.up.set(0, 0, 1); // Z-up orientation

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
		this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
		this.scene.add(this.ambientLight);

		// Step 6a) Store directional light reference to update position with camera
		this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		this.directionalLight.position.set(0, 0, 5000);
		this.scene.add(this.directionalLight);

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

		this.connectorsGroup = new THREE.Group();
		this.connectorsGroup.name = "Connectors";
		this.scene.add(this.connectorsGroup);

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

		// Step 13) Create grid helper (default 10m divisions, 50 divisions = 500m total)
		// Step 13a) Grid is created but hidden by default - visibility controlled by settings
		const defaultGridSize = 10; // meters per division
		const gridDivisions = 50;
		const totalGridSize = defaultGridSize * gridDivisions;
		const gridColor = 0x888888; // Grey
		this.gridHelper = new THREE.GridHelper(totalGridSize, gridDivisions, gridColor, gridColor);
		this.gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane (Z-up)
		this.gridHelper.position.z = 0;
		this.gridHelper.material.opacity = 0.3;
		this.gridHelper.material.transparent = true;
		this.gridHelper.visible = false; // Step 13b) Hidden by default - controlled by settings
		this.scene.add(this.gridHelper);

		// Store grid settings
		this.gridOpacity = 0.3;
		this.gridSize = defaultGridSize;
		this.gridPlane = "XY"; // Default plane
	}

	// Step 11b) Create XYZ axis helper widget (fixed 50px screen size)
	createAxisHelper(size) {
		const group = new THREE.Group();
		group.name = "AxisHelper"; // Name for easy identification

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
	updateCamera(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0, orbitZ = 0, skipRender = false) {
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
		// Camera distance from data centroid (use larger value for mining elevations)
		const cameraDistance = 5000; // Increased for large elevation ranges

		// If orbit angles are non-zero, calculate 3D camera position
		if (orbitX !== 0 || orbitY !== 0) {
			// Spherical to Cartesian conversion (Z-up)
			// orbitX = pitch (elevation from XY plane), orbitY = yaw (azimuth in XY plane)

			// Note: In standard math, x=cos(pitch)cos(yaw), y=cos(pitch)sin(yaw), z=sin(pitch)
			// But we want to match standard camera controls feel:
			// orbitX (Pitch): 0 = Top Down (looking -Z), 90 = Horizon
			// Actually, let's check CameraControls.
			// If orbitX is 0, we are looking Down.

			// Z-up Spherical:
			// Position relative to centroid
			// If Pitch(orbitX) = 0, we want camera at (0, 0, dist).
			// If Pitch(orbitX) = 90 deg, we want camera at (dist, 0, 0) (Side view).

			// Let's use:
			// Z = dist * cos(pitch)
			// RadiusXY = dist * sin(pitch)
			// X = RadiusXY * sin(yaw)
			// Y = RadiusXY * cos(yaw)

			// Use orbitX directly as angle from Z-axis (Zenith)
			// 0 = Top, PI/2 = Horizon

			const x = cameraDistance * Math.sin(orbitX) * Math.sin(orbitY);
			const y = cameraDistance * Math.sin(orbitX) * Math.cos(orbitY); // Swap sin/cos for alignment?
			const z = cameraDistance * Math.cos(orbitX);

			// Position camera relative to orbit center (centroidX, centroidY, orbitCenterZ)
			this.camera.position.set(centroidX + x, centroidY + y, this.orbitCenterZ + z);

			// Look at the orbit center (using data Z centroid)
			this.camera.lookAt(centroidX, centroidY, this.orbitCenterZ);

			// Apply Z-axis rotation (2D spin) via Roll if needed, or rely on Up vector
			// this.camera.rotateZ(rotation); // RotateZ might conflict with LookAt/Up.
			// For Z-up camera, "Roll" is rotation around Z (View Axis).
			// OrthographicCamera rotation.z corresponds to Roll.
			this.camera.rotation.z += rotation;
		} else {
			// Standard 2D top-down view - position camera above data centroid
			this.camera.position.x = centroidX;
			this.camera.position.y = centroidY;
			this.camera.position.z = this.orbitCenterZ + cameraDistance;

			// Look at the data centroid
			this.camera.lookAt(centroidX, centroidY, this.orbitCenterZ);

			// Reset camera rotation to default (looking down)
			this.camera.rotation.set(0, 0, 0);
			this.camera.up.set(0, 0, 1); // Z-up

			// Apply Z-axis rotation only (Roll)
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

		// Step 15a) Update directional light to be above camera (on camera side)
		if (this.directionalLight) {
			// Step 15a1) Position light above camera position (camera side)
			// Light should be above the camera, not at camera position
			const lightOffset = 1000; // Offset above camera
			this.directionalLight.position.set(this.camera.position.x, this.camera.position.y + lightOffset, this.camera.position.z);
			// Step 15a2) Make light point at the orbit center
			this.directionalLight.target.position.set(centroidX, centroidY, this.orbitCenterZ);
			this.directionalLight.target.updateMatrixWorld();
		}

		// Step 15b) Skip render during wheel zoom for performance (text billboard updates are expensive)
		if (!skipRender) {
			this.needsRender = true;
		}
		// Step 15c) Track if camera rotation changed (for billboard updates)
		const rotationChanged = this.lastRotation !== rotation || this.lastOrbitX !== orbitX || this.lastOrbitY !== orbitY;

		if (rotationChanged) {
			this.cameraRotationChanged = true;
			this.lastRotation = rotation;
			this.lastOrbitX = orbitX;
			this.lastOrbitY = orbitY;
		}
	}

	// Step 16) Set orbit center Z coordinate (backward compatibility - use setOrbitCenter for full 3D)
	setOrbitCenterZ(z) {
		this.orbitCenterZ = z || 0;
		console.log("🎯 Orbit center Z set to:", this.orbitCenterZ);
	}

	// Step 16a) Update lighting based on bearing and elevation
	updateLighting(bearingDeg, elevationDeg) {
		// Step 16a1) Convert bearing and elevation to radians
		// Bearing: 0° = North, 90° = West, 180° = South, 270° = East
		// Elevation: 0° = horizontal, 90° = vertical
		const bearingRad = (bearingDeg * Math.PI) / 180;
		const elevationRad = (elevationDeg * Math.PI) / 180;

		// Step 16a2) Calculate light direction vector
		// X = East/West (positive = East)
		// Y = Up/Down (positive = Up)
		// Z = North/South (positive = North)
		// For bearing: 0° = North (Z+), 90° = West (X-), 180° = South (Z-), 270° = East (X+)
		const distance = 10000; // Distance from target
		const x = -distance * Math.sin(bearingRad) * Math.cos(elevationRad);
		const y = distance * Math.sin(elevationRad);
		const z = distance * Math.cos(bearingRad) * Math.cos(elevationRad);

		// Step 16a3) Get current camera state to position light relative to camera
		const cameraState = this.cameraState;
		const targetX = cameraState.centroidX || 0;
		const targetY = cameraState.centroidY || 0;
		const targetZ = this.orbitCenterZ || 0;

		// Step 16a4) Position light relative to camera position (above camera side)
		if (this.directionalLight) {
			// Step 16a5) Calculate light position relative to camera
			// Light should be above camera, positioned based on bearing/elevation
			const cameraPos = this.camera.position;
			const lightOffsetY = 1000; // Offset above camera

			// Position light above camera, offset by bearing/elevation
			this.directionalLight.position.set(
				cameraPos.x + x * 0.1, // Small offset based on bearing
				cameraPos.y + lightOffsetY, // Above camera
				cameraPos.z + z * 0.1 // Small offset based on bearing
			);

			// Step 16a6) Make light point at target (orbit center)
			this.directionalLight.target.position.set(targetX, targetY, targetZ);
			this.directionalLight.target.updateMatrixWorld();
		}

		// Step 16a7) Request render
		this.requestRender();
	}

	// Step 16b) Update clipping planes
	updateClippingPlanes(near, far) {
		// Step 16b1) Update camera near and far planes
		this.camera.near = near;
		this.camera.far = far;

		// Step 16b2) Update projection matrix
		this.camera.updateProjectionMatrix();

		// Step 16b3) Update clipping plane helpers if they exist
		if (this.clippingPlaneNearHelper) {
			const clippingPlaneNear = new THREE.Plane(new THREE.Vector3(0, 0, -1), -near);
			this.clippingPlaneNearHelper.plane.copy(clippingPlaneNear);
			console.log("✂️ Near clipping plane helper updated to:", near);
		}

		if (this.clippingPlaneFarHelper) {
			const clippingPlaneFar = new THREE.Plane(new THREE.Vector3(0, 0, 1), -far);
			this.clippingPlaneFarHelper.plane.copy(clippingPlaneFar);
			console.log("✂️ Far clipping plane helper updated to:", far);
		}

		// Step 16b4) Request render
		this.requestRender();
		console.log("✂️ Clipping planes updated: near=" + near + ", far=" + far);
	}

	// Step 16c) Update ambient light intensity
	updateAmbientLightIntensity(intensity) {
		if (this.ambientLight) {
			this.ambientLight.intensity = intensity;
			this.requestRender();
		}
	}

	// Step 16d) Update directional light intensity
	updateDirectionalLightIntensity(intensity) {
		if (this.directionalLight) {
			this.directionalLight.intensity = intensity;
			this.requestRender();
		}
	}

	// Step 16e) Update shadow intensity
	updateShadowIntensity(intensity) {
		// Store the shadow intensity setting
		this.shadowIntensity = intensity;

		// Update all shadow-casting lights
		if (this.directionalLight && this.directionalLight.shadow) {
			// Adjust shadow darkness (0 = no shadow, 1 = max shadow)
			this.directionalLight.shadow.darkness = intensity;
			this.requestRender();
		}

		// Note: For more advanced shadow control, this could also affect:
		// - Shadow bias
		// - Shadow map resolution
		// - Shadow camera bounds
		console.log("🌑 Shadow intensity updated to:", intensity);
	}

	// Step 16f) Set clipping plane visualization
	setClippingPlaneVisualization(visible) {
		console.log("✂️ setClippingPlaneVisualization called with visible =", visible, "type:", typeof visible);

		if (visible) {
			// Step 16f.1) Create near clipping plane helper if it doesn't exist
			if (!this.clippingPlaneNearHelper) {
				console.log("✂️ Creating new near clipping plane helper");
				const nearDistance = this.camera.near || -50000;
				const clippingPlaneNear = new THREE.Plane(new THREE.Vector3(0, 0, -1), -nearDistance);
				this.clippingPlaneNearHelper = new THREE.PlaneHelper(clippingPlaneNear, 5000, 0xff3333);
				this.clippingPlaneNearHelper.userData = { type: "clippingPlaneNearHelper" };
				this.clippingPlaneNearHelper.material.opacity = 0.3;
				this.clippingPlaneNearHelper.material.transparent = true;
				this.clippingPlaneNearHelper.material.side = THREE.DoubleSide;
				this.scene.add(this.clippingPlaneNearHelper);
			}

			// Step 16f.2) Create far clipping plane helper if it doesn't exist
			if (!this.clippingPlaneFarHelper) {
				console.log("✂️ Creating new far clipping plane helper");
				const farDistance = this.camera.far || 50000;
				const clippingPlaneFar = new THREE.Plane(new THREE.Vector3(0, 0, 1), -farDistance);
				this.clippingPlaneFarHelper = new THREE.PlaneHelper(clippingPlaneFar, 5000, 0x3333ff);
				this.clippingPlaneFarHelper.userData = { type: "clippingPlaneFarHelper" };
				this.clippingPlaneFarHelper.material.opacity = 0.3;
				this.clippingPlaneFarHelper.material.transparent = true;
				this.clippingPlaneFarHelper.material.side = THREE.DoubleSide;
				this.scene.add(this.clippingPlaneFarHelper);
			}

			this.clippingPlaneNearHelper.visible = true;
			this.clippingPlaneFarHelper.visible = true;
			console.log("✂️ Clipping plane helpers are now visible");
		} else {
			// Step 16f.3) Hide and dispose clipping plane helpers
			if (this.clippingPlaneNearHelper) {
				this.scene.remove(this.clippingPlaneNearHelper);
				if (this.clippingPlaneNearHelper.geometry) this.clippingPlaneNearHelper.geometry.dispose();
				if (this.clippingPlaneNearHelper.material) this.clippingPlaneNearHelper.material.dispose();
				this.clippingPlaneNearHelper = null;
				console.log("✂️ Near clipping plane helper disposed");
			}

			if (this.clippingPlaneFarHelper) {
				this.scene.remove(this.clippingPlaneFarHelper);
				if (this.clippingPlaneFarHelper.geometry) this.clippingPlaneFarHelper.geometry.dispose();
				if (this.clippingPlaneFarHelper.material) this.clippingPlaneFarHelper.material.dispose();
				this.clippingPlaneFarHelper = null;
				console.log("✂️ Far clipping plane helper disposed");
			}
		}

		this.requestRender();
		console.log("✂️ Clipping plane visualization final state:", visible ? "ON" : "OFF");
	}

	// Step 16g) Set grid visibility
	setGridVisible(visible) {
		console.log("📐 setGridVisible called with visible =", visible, "type:", typeof visible);

		if (visible) {
			// Step 16g.1) Show grid if exists, or create it
			if (this.gridHelper) {
				// Step 16g.1a) Ensure grid is visible
				this.gridHelper.visible = true;
				console.log("📐 Grid visibility set to ON");
			} else {
				// Step 16g.2) Grid doesn't exist - recreate it with current settings
				console.log("📐 Grid helper doesn't exist - creating new grid");
				const size = this.gridSize || 10;
				const divisions = 50;
				const totalSize = size * divisions;
				const gridColor = window.darkModeEnabled ? 0x444444 : 0xcccccc;

				this.gridHelper = new THREE.GridHelper(totalSize, divisions, gridColor, gridColor);

				// Step 16g.2a) Ensure grid is visible
				this.gridHelper.visible = true;

				// Apply grid plane orientation
				const gridPlane = this.gridPlane || "XY";
				this.applyGridPlaneOrientation(gridPlane);

				// Position grid at data centroid
				this.gridHelper.position.set(this.orbitCenterX || 0, this.orbitCenterY || 0, this.orbitCenterZ || 0);

				// Step 16g.2b) Apply current opacity (use default 0.3 if not set)
				const opacity = this.gridOpacity !== undefined ? this.gridOpacity : 0.3;
				this.gridHelper.material.opacity = opacity;
				this.gridHelper.material.transparent = true;

				// Step 16g.2c) Store opacity if it wasn't set
				if (this.gridOpacity === undefined) {
					this.gridOpacity = opacity;
				}

				this.scene.add(this.gridHelper);
				console.log("📐 Grid created and added to scene with opacity:", opacity);
			}
		} else {
			// Step 16g.3) Hide AND dispose grid to free memory
			if (this.gridHelper) {
				console.log("📐 Disposing grid helper");
				this.scene.remove(this.gridHelper);
				if (this.gridHelper.geometry) this.gridHelper.geometry.dispose();
				if (this.gridHelper.material) {
					// Step 16g.3a) Handle both single material and material array
					if (Array.isArray(this.gridHelper.material)) {
						this.gridHelper.material.forEach(function (mat) {
							if (mat) mat.dispose();
						});
					} else {
						this.gridHelper.material.dispose();
					}
				}
				this.gridHelper = null;
				console.log("📐 Grid disposed and removed");
			} else {
				console.log("📐 Grid helper doesn't exist - nothing to dispose");
			}
		}

		this.requestRender();
	}

	// Step 16h) Update grid size
	updateGridSize(size) {
		// Step 16h.1) Store grid size
		this.gridSize = size;

		// Step 16h.2) Only update if grid exists
		if (!this.gridHelper) {
			console.log("📐 Grid size stored:", size, "(grid not created yet)");
			return;
		}

		// Step 16h.3) Remove old grid
		this.scene.remove(this.gridHelper);
		this.gridHelper.geometry.dispose();
		this.gridHelper.material.dispose();

		// Step 16h.4) Create new grid with updated size
		const divisions = 50; // Number of grid divisions
		const gridSize = size * divisions; // Total grid size
		const gridColor = window.darkModeEnabled ? 0x444444 : 0xcccccc;

		this.gridHelper = new THREE.GridHelper(gridSize, divisions, gridColor, gridColor);

		// Step 16h.5) Apply grid plane orientation
		const gridPlane = this.gridPlane || "XY";
		this.applyGridPlaneOrientation(gridPlane);

		// Step 16h.6) Position grid at data centroid
		this.gridHelper.position.set(this.orbitCenterX || 0, this.orbitCenterY || 0, this.orbitCenterZ || 0);

		// Step 16h.7) Apply current opacity (use default 0.3 if not set)
		const opacity = this.gridOpacity !== undefined ? this.gridOpacity : 0.3;
		this.gridHelper.material.opacity = opacity;
		this.gridHelper.material.transparent = true;

		// Step 16h.8) Ensure grid is visible
		this.gridHelper.visible = true;

		this.scene.add(this.gridHelper);
		this.requestRender();
		console.log("📐 Grid size updated to:", size, "m per division at centroid (" + (this.orbitCenterX || 0).toFixed(2) + ", " + (this.orbitCenterY || 0).toFixed(2) + ", " + (this.orbitCenterZ || 0).toFixed(2) + ")");
	}

	// Step 16i) Update grid opacity
	updateGridOpacity(opacity) {
		// Step 16i.1) Validate and store opacity (ensure it's a number between 0 and 1)
		const validOpacity = Math.max(0, Math.min(1, parseFloat(opacity) || 0.3));
		this.gridOpacity = validOpacity;

		// Step 16i.2) Only update if grid exists
		if (this.gridHelper && this.gridHelper.material) {
			// Step 16i.2a) Ensure grid remains visible even if opacity is 0
			this.gridHelper.visible = true;

			// Step 16i.2b) Update material opacity
			this.gridHelper.material.opacity = validOpacity;
			this.gridHelper.material.transparent = true;

			this.requestRender();
			console.log("📐 Grid opacity updated to:", validOpacity, "(grid visible:", this.gridHelper.visible + ")");
		} else {
			console.log("📐 Grid opacity stored:", validOpacity, "(grid not created yet)");
		}
	}

	// Step 16j) Update grid plane orientation
	updateGridPlane(plane) {
		// Step 16j.1) Store plane setting
		this.gridPlane = plane;
		console.log("📐 updateGridPlane called with plane:", plane);

		// Step 16j.2) Only update if grid exists
		if (this.gridHelper) {
			this.applyGridPlaneOrientation(plane);
			// Reposition grid at data centroid
			this.gridHelper.position.set(this.orbitCenterX || 0, this.orbitCenterY || 0, this.orbitCenterZ || 0);
			this.requestRender();
			console.log("📐 Grid plane updated to:", plane);
		} else {
			console.log("📐 Grid plane stored:", plane, "(grid not created yet)");
		}
	}

	// Step 16k) Apply grid plane orientation (helper method)
	applyGridPlaneOrientation(plane) {
		if (!this.gridHelper) return;

		// Step 16k.1) Reset rotation
		this.gridHelper.rotation.set(0, 0, 0);

		// Step 16k.2) Apply rotation based on plane
		switch (plane) {
			case "XY":
				// XY plane (horizontal, looking down Z axis)
				this.gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane (Z-up)
				break;
			case "XZ":
				// XZ plane (vertical, looking down Y axis)
				// No rotation needed (GridHelper default is XZ)
				break;
			case "YZ":
				// YZ plane (vertical, looking down X axis)
				this.gridHelper.rotation.z = Math.PI / 2;
				break;
			case "Camera":
				// Camera frustum plane - align with camera orientation
				this.gridHelper.rotation.copy(this.camera.rotation);
				break;
			default:
				// Default to XY
				this.gridHelper.rotation.x = Math.PI / 2;
				break;
		}
		console.log("📐 Applied grid plane orientation:", plane);
	}

	// Step 16L) Set orbit center (data centroid)
	setOrbitCenter(x, y, z) {
		this.orbitCenterX = x || 0;
		this.orbitCenterY = y || 0;
		this.orbitCenterZ = z || 0;
		console.log("🎯 Orbit center set to: (" + this.orbitCenterX.toFixed(2) + ", " + this.orbitCenterY.toFixed(2) + ", " + this.orbitCenterZ.toFixed(2) + ")");

		// Step 16L.1) Update grid position if it exists
		if (this.gridHelper) {
			this.gridHelper.position.set(this.orbitCenterX, this.orbitCenterY, this.orbitCenterZ);
			this.requestRender();
			console.log("📐 Grid repositioned to centroid");
		}
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
		// Step 19a) Dispose troika text objects (special handling)
		if (object.userData && object.userData.isTroikaText) {
			// Troika text has its own dispose method that cleans up workers and resources
			if (object.dispose && typeof object.dispose === "function") {
				object.dispose();
			}
			// Also dispose geometry and material if they exist
			if (object.geometry) {
				object.geometry.dispose();
			}
			if (object.material) {
				if (object.material.map) object.material.map.dispose();
				object.material.dispose();
			}
			return; // Don't continue with standard disposal
		}

		// Step 19b) Dispose geometry
		if (object.geometry) {
			object.geometry.dispose();
		}

		// Step 19c) Dispose material(s)
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

		// Step 19d) Dispose textures on sprites
		if (object.isSprite && object.material && object.material.map) {
			object.material.map.dispose();
		}
	}

	// Step 20) Dispose group and all children
	disposeGroup(group) {
		// Step 20a) Traverse and remove objects (but preserve cached text)
		const toRemove = [];
		group.traverse((object) => {
			if (object !== group) {
				// Step 20a.1) Check if this is a cached text object
				if (object.userData && object.userData.isCachedText) {
					// Don't dispose - just remove from group (will be reused)
					toRemove.push(object);
				} else {
					// Normal objects - dispose normally
					this.disposeObject(object);
					toRemove.push(object);
				}
			}
		});

		// Step 20b) Remove all objects from group
		toRemove.forEach((obj) => {
			group.remove(obj);
		});
	}

	// Step 21) Clear all geometry from scene
	clearAllGeometry() {
		// Step 21a) Dispose all groups to prevent memory leaks
		this.disposeGroup(this.holesGroup);
		this.disposeGroup(this.surfacesGroup);
		this.disposeGroup(this.kadGroup);
		this.disposeGroup(this.contoursGroup);
		this.disposeGroup(this.imagesGroup);
		this.disposeGroup(this.connectorsGroup);

		// Step 21b) Clear mesh maps
		this.holeMeshMap.clear();
		this.surfaceMeshMap.clear();
		this.kadMeshMap.clear();

		// Step 21c) Dispose axis helper if it exists
		if (this.axisHelper) {
			this.disposeAxisHelper();
		}

		// Step 21d) DON'T clear text cache - persist across redraws
		// Text cache is only cleared when data actually changes (see clearTextCacheOnDataChange)

		this.needsRender = true;
	}

	// Step 21e) Dispose axis helper and recreate
	disposeAxisHelper() {
		if (this.axisHelper) {
			// Traverse and dispose all geometries and materials
			this.axisHelper.traverse((child) => {
				if (child.geometry) {
					child.geometry.dispose();
				}
				if (child.material) {
					if (Array.isArray(child.material)) {
						child.material.forEach((mat) => mat.dispose());
					} else {
						child.material.dispose();
					}
				}
				// Dispose sprite textures
				if (child.material && child.material.map) {
					child.material.map.dispose();
				}
			});
			this.scene.remove(this.axisHelper);
			this.axisHelper = null;
		}
	}

	// Step 21d) Clear text cache when data changes (not on every redraw)
	clearTextCacheOnDataChange() {
		clearTextCache();
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
			case "connectors":
				this.disposeGroup(this.connectorsGroup);
				break;
		}
		this.needsRender = true;
	}

	// Step 23) Render the scene

	render() {
		// // Step 23a) Update billboard text rotation ONLY if camera rotated
		// // Skip during pure zoom/pan for performance with thousands of labels
		// const keepTextFlatOnXZPlane = false;
		// if (this.cameraRotationChanged && !keepTextFlatOnXZPlane) {
		// 	this.updateTextBillboards();
		// 	this.updateBillboardedObjects();
		// 	this.cameraRotationChanged = false;
		// } // Didn't work well enough.

		// Allways update Billboards.
		this.updateTextBillboards();
		this.updateBillboardedObjects();

		this.renderer.render(this.scene, this.camera);
		this.needsRender = false;
	}

	// Step 23b) Update all troika text objects to face camera (billboard behavior)
	updateTextBillboards() {
		// Step 23b.0) Create frustum for culling
		const frustum = new THREE.Frustum();
		const projScreenMatrix = new THREE.Matrix4();
		projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
		frustum.setFromProjectionMatrix(projScreenMatrix);

		const updateGroup = (group) => {
			group.traverse((object) => {
				// Check if this is a troika text object
				if (object.userData && object.userData.isTroikaText) {
					// Make text face camera (billboard effect)
					if (frustum.containsPoint(object.position)) {
						object.quaternion.copy(this.camera.quaternion);
					}
				}
				// Also check for text inside groups (with backgrounds)
				if (object.userData && object.userData.textMesh) {
					if (frustum.containsPoint(object.position)) {
						object.userData.textMesh.quaternion.copy(this.camera.quaternion);
					}
					// Rotate background too if it exists
					object.traverse((child) => {
						if (child.isMesh && child.geometry && child.geometry.type === "PlaneGeometry") {
							if (frustum.containsPoint(child.position)) {
								child.quaternion.copy(this.camera.quaternion);
							}
						}
					});
				}
			});
		};

		// Update text in all groups
		updateGroup(this.kadGroup);
		updateGroup(this.holesGroup);
		updateGroup(this.connectorsGroup);
		updateGroup(this.contoursGroup); // Step 23b.1) Also update contour labels
		updateGroup(this.surfacesGroup); // Step 23b.2) Also update slope/relief labels
	}

	// Step 23c) Update billboarded objects (mouse torus, etc.) to face camera
	updateBillboardedObjects() {
		// Step 23c.1) Update connectors group (contains mouse indicator)
		this.connectorsGroup.traverse((object) => {
			if (object.userData && object.userData.billboard) {
				// Rotate object to face camera
				object.quaternion.copy(this.camera.quaternion);
			}
		});
	}

	// Step 24) Start animation loop (only renders when needed)
	startRenderLoop() {
		const animate = () => {
			// Step 24a) Update arcball controls if active
			if (window.cameraControls && window.cameraControls.controlMode === "arcball") {
				window.cameraControls.update();
			}

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
		// Step 28a) Check if gizmo display mode is "never" - if so, always hide
		// This check should be done by the caller, but we add a safety check here
		// The caller should pass show=false when mode is "never"

		// Step 28b) Create axis helper if it doesn't exist
		if (!this.axisHelper) {
			this.axisHelper = this.createAxisHelper(50);
			this.axisHelper.visible = false;
			this.scene.add(this.axisHelper);
			this.axisHelperBaseSize = 50;
		}

		if (this.axisHelper) {
			this.axisHelper.visible = show;
			if (show) {
				this.axisHelper.position.set(positionX, positionY, 0);

				// Step 28c) Scale to maintain fixed screen size (50 pixels)
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
