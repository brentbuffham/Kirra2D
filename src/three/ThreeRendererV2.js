/* prettier-ignore-file */
//=================================================
// ThreeRendererV2.js - Rebuilt Three.js rendering system
//
// IMPROVEMENTS OVER V1:
// - Cleaner initialization sequence (renderer → scene → camera → lighting → groups)
// - Explicit Z-up coordinate system configuration with detailed comments
// - Better organized private methods (_prefixed) vs public API
// - Memory-optimized WebGL renderer settings
// - Identical public API for drop-in replacement
//=================================================
import * as THREE from "three";
import { clearTextCache } from "./GeometryFactory.js";
import { InstancedMeshManager } from "./InstancedMeshManager.js";

export class ThreeRendererV2 {
	constructor(containerElement, width, height) {
		console.log("🎨 ThreeRendererV2 initializing with cleaner architecture...");

		// Cleaner initialization sequence
		this._initializeBasics(containerElement, width, height);
		this._createRenderer();
		this._createScene();
		this._createCamera();
		this._createLighting();
		this._createGroups();
		this._initializeMaps();
		this._initializeInstancing();
		this._createHelpers();
		this._setupEventHandlers();
		this._exposeAPI();

		console.log("✅ ThreeRendererV2 initialization complete");
	}

	// ========================================
	// PRIVATE INITIALIZATION METHODS
	// ========================================

	/**
	 * Step 1: Store basic properties
	 */
	_initializeBasics(containerElement, width, height) {
		this.container = containerElement;
		this.width = width;
		this.height = height;

		// Orbit center coordinates (for 3D orbit around data centroid)
		this.orbitCenterX = 0;
		this.orbitCenterY = 0;
		this.orbitCenterZ = 0;

		// Camera state tracking
		this.cameraState = {
			centroidX: 0,
			centroidY: 0,
			scale: 1,
			rotation: 0,
			orbitX: 0,
			orbitY: 0,
			orbitZ: 0
		};

		// Rotation change tracking (for billboard optimization)
		this.cameraRotationChanged = false;
		this.lastRotation = 0;
		this.lastOrbitX = 0;
		this.lastOrbitY = 0;

		// Render control flags
		this.needsRender = true;
		this.animationFrameId = null;
		this.contextLost = false;
	}

	/**
	 * Step 2: Create WebGL renderer FIRST (establishes context)
	 *
	 * MEMORY OPTIMIZATION:
	 * - antialias: false saves ~25% GPU memory
	 * - preserveDrawingBuffer: false saves 20-50MB GPU memory
	 */
	_createRenderer() {
		this.renderer = new THREE.WebGLRenderer({
			antialias: false, // Save ~25% GPU memory
			alpha: true, // Transparency support
			preserveDrawingBuffer: false, // Save 20-50MB GPU memory
			powerPreference: "high-performance"
		});

		this.renderer.setSize(this.width, this.height);
		this.renderer.setPixelRatio(window.devicePixelRatio);

		// CRITICAL: sRGB color space (Three.js r150+)
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.setClearColor(0x000000, 0); // Transparent
	}

	/**
	 * Step 3: Create scene (simple, no background yet)
	 */
	_createScene() {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0xffffff); // White for light mode
	}

	/**
	 * Step 4: Create camera with EXPLICIT Z-up configuration
	 *
	 * CRITICAL Z-UP WORLD CONVENTION:
	 * - Kirra uses UTM/mining coordinates where Z = elevation
	 * - +X = East, +Y = North, +Z = Up (altitude)
	 * - Camera positioned ABOVE origin, looking DOWN (-Z direction)
	 * - Up vector = (0, 0, 1) to maintain Z-up orientation
	 *
	 * ORTHOGRAPHIC PROJECTION:
	 * - Fixed frustum size matching canvas dimensions (1:1 pixel mapping)
	 * - Zoom applied via camera.zoom property (not frustum scaling)
	 * - Near/far planes: Large range for mining elevations (-50000 to +50000)
	 */
	_createCamera() {
		const aspect = this.width / this.height;
		const frustumSize = 1000; // Base frustum size (will be overridden by updateCamera)

		this.camera = new THREE.OrthographicCamera(
			-frustumSize * aspect / 2, // left
			frustumSize * aspect / 2, // right
			frustumSize / 2, // top
			-frustumSize / 2, // bottom
			-50000, // near (large for mining depths)
			50000 // far (large for mining elevations)
		);

		// CRITICAL: Z-up camera setup
		// Position: Above origin (Z = +5000), looking down (-Z direction)
		this.camera.position.set(0, 0, 5000);

		// Up vector: +Z axis (CRITICAL for Z-up world)
		this.camera.up.set(0, 0, 1);

		// Look at origin (will be updated to data centroid)
		this.camera.lookAt(0, 0, 0);

		// Default zoom (1:1 pixel mapping)
		this.camera.zoom = 1;
		this.camera.updateProjectionMatrix();
	}

	/**
	 * Step 5: Create lighting (after scene exists)
	 *
	 * LIGHTING SETUP:
	 * - Ambient light (0.8 intensity) - fills all areas for visibility
	 * - Directional light (0.5 intensity) - positioned to camera side
	 * - MeshPhongMaterial compatible (for textured OBJ surfaces)
	 */
	_createLighting() {
		// Ambient light - fill lighting for visibility
		this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
		this.scene.add(this.ambientLight);

		// Store default intensity for restoration
		this._defaultAmbientIntensity = 0.8;

		// Directional light - key light from camera side
		this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		this.directionalLight.position.set(0, 0, 5000);
		this.scene.add(this.directionalLight);

		// Store default intensity for restoration
		this._defaultDirectionalIntensity = 0.5;
	}

	/**
	 * Step 6: Create organized scene groups
	 *
	 * SCENE ORGANIZATION:
	 * Each group represents a logical layer in the 3D visualization:
	 * - holesGroup: Blast holes (cylinders, text labels)
	 * - surfacesGroup: DTM surfaces, textured meshes
	 * - kadGroup: KAD vector drawings (points, lines, polygons)
	 * - contoursGroup: Contour lines, elevation markers
	 * - imagesGroup: GeoTIFF imagery, raster data
	 * - connectorsGroup: UI elements (mouse indicator, connectors)
	 */
	_createGroups() {
		// Blast holes group
		this.holesGroup = new THREE.Group();
		this.holesGroup.name = "Blast Holes";
		this.scene.add(this.holesGroup);

		// Surfaces group (DTM, textured meshes)
		this.surfacesGroup = new THREE.Group();
		this.surfacesGroup.name = "Surfaces/DTM";
		this.scene.add(this.surfacesGroup);

		// KAD drawings group (vector data)
		this.kadGroup = new THREE.Group();
		this.kadGroup.name = "KAD Drawings";
		this.scene.add(this.kadGroup);

		// Contours group (elevation lines)
		this.contoursGroup = new THREE.Group();
		this.contoursGroup.name = "Contours";
		this.scene.add(this.contoursGroup);

		// Images group (GeoTIFF, raster imagery)
		this.imagesGroup = new THREE.Group();
		this.imagesGroup.name = "Images/GeoTIFF";
		this.scene.add(this.imagesGroup);

		// Connectors group (UI elements, mouse indicator)
		this.connectorsGroup = new THREE.Group();
		this.connectorsGroup.name = "Connectors/UI";
		this.scene.add(this.connectorsGroup);
	}

	/**
	 * Step 7: Initialize mesh maps for object tracking
	 */
	_initializeMaps() {
		// Store mesh references for selection and updates
		this.holeMeshMap = new Map(); // holeId -> mesh
		this.surfaceMeshMap = new Map(); // surfaceId -> mesh
		this.kadMeshMap = new Map(); // kadId -> mesh

		// Legacy instanced hole tracking (V1 compatibility)
		this.instancedCollars = null;
		this.instancedGradesPositive = null;
		this.instancedGradesNegative = null;
		this.instancedToes = null;
		this.instancedDirectionArrows = null;
		this.instanceIdToHole = new Map();
		this.holeToInstanceId = new Map();
		this.instancedHolesCount = 0;
	}

	/**
	 * Step 8: Initialize advanced instancing system
	 *
	 * INSTANCED RENDERING:
	 * - InstancedMeshManager automatically groups holes by diameter/type
	 * - Provides 10-50x performance improvement for large blasts (500+ holes)
	 * - Enabled by default for all rendering
	 */
	_initializeInstancing() {
		this.instancedMeshManager = new InstancedMeshManager(this.holesGroup);
		this.useInstancing = true; // Enable by default

		// Raycaster for selection (configured for instanced meshes)
		this.raycaster = new THREE.Raycaster();
		this.raycaster.params.Line.threshold = 5; // Line selection tolerance
	}

	/**
	 * Step 9: Create visual helpers (grid, axis)
	 *
	 * GRID HELPER:
	 * - Default: 10m divisions, 50 divisions = 500m total
	 * - Rotated to XY plane (Z-up coordinate system)
	 * - Hidden by default, controlled by settings
	 *
	 * AXIS HELPER:
	 * - X = Red (East), Y = Green (North), Z = Blue (Up)
	 * - Fixed 50px screen size, positioned at orbit center
	 * - Hidden by default, shown during orbit
	 */
	_createHelpers() {
		// Grid helper (hidden by default)
		const defaultGridSize = 10; // meters per division
		const gridDivisions = 50;
		const totalGridSize = defaultGridSize * gridDivisions;
		const gridColor = 0x888888; // Grey

		this.gridHelper = new THREE.GridHelper(totalGridSize, gridDivisions, gridColor, gridColor);
		this.gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane (Z-up)
		this.gridHelper.position.z = 0;
		this.gridHelper.material.opacity = 0.3;
		this.gridHelper.material.transparent = true;
		this.gridHelper.visible = false; // Hidden by default
		this.scene.add(this.gridHelper);

		// Store grid settings
		this.gridOpacity = 0.3;
		this.gridSize = defaultGridSize;
		this.gridPlane = "XY"; // Default plane

		// Axis helper (hidden by default)
		this.axisHelper = this._createAxisHelper(111); // Base size
		this.axisHelper.visible = false;
		this.scene.add(this.axisHelper);
		this.axisHelperBaseSize = 111;
	}

	/**
	 * Step 10: Setup event handlers (context loss, etc.)
	 */
	_setupEventHandlers() {
		const self = this;

		// WebGL context loss handler
		this.renderer.domElement.addEventListener(
			"webglcontextlost",
			function(event) {
				event.preventDefault();
				console.error("⚠️ WebGL context lost! GPU memory exhausted.");
				self.contextLost = true;
				self.stopRenderLoop();

				// Show user-friendly dialog after delay
				setTimeout(function() {
					const FloatingDialog = window.FloatingDialog;
					if (FloatingDialog) {
						try {
							const dialog = new FloatingDialog({
								title: "GPU Memory Exhausted",
								content: "<div style='padding: 10px;'>" + "<p><strong>WebGL context lost!</strong></p>" + "<p>The 3D rendering system has run out of GPU memory.</p>" + "<p>Click OK to reload the application.</p>" + "</div>",
								width: 500,
								height: 250,
								buttons: [
									{
										text: "OK - Reload App",
										callback: function() {
											location.reload();
										}
									}
								]
							});
							dialog.show();
						} catch (e) {
							if (confirm("GPU context lost. Click OK to reload.")) {
								location.reload();
							}
						}
					} else {
						if (confirm("GPU context lost. Click OK to reload.")) {
							location.reload();
						}
					}
				}, 100);
			},
			false
		);

		// WebGL context restored handler
		this.renderer.domElement.addEventListener(
			"webglcontextrestored",
			function() {
				console.log("✅ WebGL context restored");
				self.contextLost = false;
				self.startRenderLoop();
				self.needsRender = true;
			},
			false
		);
	}

	/**
	 * Step 11: Expose public API properties (compatibility)
	 */
	_exposeAPI() {
		// All public properties already defined as instance properties
		// This method exists for future API additions

		// Ensure backward compatibility flags
		this.continuousRendering = false; // Legacy flag (not used in V2)
	}

	// ========================================
	// PRIVATE HELPER METHODS
	// ========================================

	/**
	 * Create XYZ axis helper widget
	 * @param {number} size - Base size in world units
	 * @returns {THREE.Group} Axis helper group
	 */
	_createAxisHelper(size) {
		const group = new THREE.Group();
		group.name = "AxisHelper";

		// X-axis (Red) - East
		const xGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(size, 0, 0)]);
		const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
		const xLine = new THREE.Line(xGeometry, xMaterial);
		group.add(xLine);

		// Y-axis (Green) - North
		const yGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, size, 0)]);
		const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 });
		const yLine = new THREE.Line(yGeometry, yMaterial);
		group.add(yLine);

		// Z-axis (Blue) - Up
		const zGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, size)]);
		const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 });
		const zLine = new THREE.Line(zGeometry, zMaterial);
		group.add(zLine);

		// Labels using sprites
		const xLabel = this._createTextSprite("X", 0xff0000);
		xLabel.position.set(size + 10, 0, 0);
		group.add(xLabel);

		const yLabel = this._createTextSprite("Y", 0x00ff00);
		yLabel.position.set(0, size + 10, 0);
		group.add(yLabel);

		const zLabel = this._createTextSprite("Z", 0x0000ff);
		zLabel.position.set(0, 0, size + 10);
		group.add(zLabel);

		return group;
	}

	/**
	 * Create text sprite for axis labels
	 * @param {string} text - Label text
	 * @param {number} color - Label color (hex)
	 * @returns {THREE.Sprite} Text sprite
	 */
	_createTextSprite(text, color) {
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

	/**
	 * Apply grid plane orientation
	 * @param {string} plane - Plane orientation ("XY", "XZ", "YZ", "Camera")
	 */
	_applyGridPlaneOrientation(plane) {
		if (!this.gridHelper) return;

		// Reset rotation
		this.gridHelper.rotation.set(0, 0, 0);

		// Apply rotation based on plane
		switch (plane) {
			case "XY":
				// XY plane (horizontal, looking down Z axis)
				this.gridHelper.rotation.x = Math.PI / 2;
				break;
			case "XZ":
				// XZ plane (vertical, looking down Y axis)
				// No rotation needed (GridHelper default)
				break;
			case "YZ":
				// YZ plane (vertical, looking down X axis)
				this.gridHelper.rotation.z = Math.PI / 2;
				break;
			case "Camera":
				// Align with camera orientation
				this.gridHelper.rotation.copy(this.camera.rotation);
				break;
			default:
				// Default to XY
				this.gridHelper.rotation.x = Math.PI / 2;
				break;
		}
	}

	/**
	 * Dispose single object resources
	 * @param {THREE.Object3D} object - Object to dispose
	 */
	_disposeObject(object) {
		// Troika text special handling
		if (object.userData && object.userData.isTroikaText) {
			if (object.dispose && typeof object.dispose === "function") {
				object.dispose();
			}
			if (object.geometry) object.geometry.dispose();
			if (object.material) {
				if (object.material.map) object.material.map.dispose();
				object.material.dispose();
			}
			return;
		}

		// Dispose geometry
		if (object.geometry) {
			object.geometry.dispose();
		}

		// Dispose material(s)
		if (object.material) {
			if (Array.isArray(object.material)) {
				object.material.forEach(material => {
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

		// Dispose sprite textures
		if (object.isSprite && object.material && object.material.map) {
			object.material.map.dispose();
		}
	}

	/**
	 * Update text billboards to face camera
	 * PERFORMANCE: Direct quaternion copy (4 float copies) is faster than frustum culling
	 */
	_updateTextBillboards() {
		// Get billboard setting
		const billboardSetting = window.load3DSettings ? window.load3DSettings().textBillboarding : "all";

		// Cache camera quaternion (single reference, copied to all billboards)
		const cameraQuat = this.camera.quaternion;

		const updateGroup = (group, shouldBillboard) => {
			if (!shouldBillboard) return;
			
			group.traverse(object => {
				if (object.userData && object.userData.isTroikaText) {
					object.quaternion.copy(cameraQuat);
				}
				if (object.userData && object.userData.textMesh) {
					object.userData.textMesh.quaternion.copy(cameraQuat);
					// Rotate background
					object.traverse(child => {
						if (child.isMesh && child.geometry && child.geometry.type === "PlaneGeometry") {
							child.quaternion.copy(cameraQuat);
						}
					});
				}
			});
		};

		const billboardAll = billboardSetting === "all";
		const billboardHoles = billboardSetting === "holes" || billboardAll;
		const billboardKAD = billboardSetting === "kad" || billboardAll;

		updateGroup(this.holesGroup, billboardHoles);
		updateGroup(this.kadGroup, billboardKAD);
		updateGroup(this.connectorsGroup, billboardAll);
		updateGroup(this.contoursGroup, billboardAll);
		updateGroup(this.surfacesGroup, billboardAll);
	}

	/**
	 * Update billboarded objects (mouse torus, etc.)
	 */
	_updateBillboardedObjects() {
		this.connectorsGroup.traverse(object => {
			if (object.userData && object.userData.billboard) {
				object.quaternion.copy(this.camera.quaternion);
			}
		});
	}

	// ========================================
	// PUBLIC API METHODS (V1 Compatibility)
	// ========================================

	/**
	 * Get canvas element
	 * @returns {HTMLCanvasElement} WebGL canvas
	 */
	getCanvas() {
		return this.renderer.domElement;
	}

	/**
	 * Update camera to match world coordinates
	 * @param {number} centroidX - World X coordinate
	 * @param {number} centroidY - World Y coordinate
	 * @param {number} scale - Zoom scale
	 * @param {number} rotation - Camera rotation (radians)
	 * @param {number} orbitX - Orbit pitch angle
	 * @param {number} orbitY - Orbit yaw angle
	 * @param {number} orbitZ - Orbit center Z
	 * @param {boolean} skipRender - Skip render request
	 */
	updateCamera(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0, orbitZ = 0, skipRender = false) {
		// Store camera state
		this.cameraState.centroidX = centroidX;
		this.cameraState.centroidY = centroidY;
		this.cameraState.scale = scale;
		this.cameraState.rotation = rotation;
		this.cameraState.orbitX = orbitX;
		this.cameraState.orbitY = orbitY;
		this.cameraState.orbitZ = orbitZ;

		// Update axis helper position if visible
		if (this.axisHelper && this.axisHelper.visible) {
			this.axisHelper.position.set(centroidX, centroidY, this.orbitCenterZ || 0);

			// Maintain fixed screen size
			const desiredScreenPixels = 50;
			const worldUnitsForFixedScreenSize = desiredScreenPixels / scale;
			const scaleFactor = worldUnitsForFixedScreenSize / this.axisHelperBaseSize;
			this.axisHelper.scale.set(scaleFactor, scaleFactor, scaleFactor);
		}

		// Calculate camera position based on orbit angles
		const cameraDistance = 5000;

		if (orbitX !== 0 || orbitY !== 0) {
			// 3D orbit mode - spherical to Cartesian conversion
			const x = cameraDistance * Math.sin(orbitX) * Math.sin(orbitY);
			const y = cameraDistance * Math.sin(orbitX) * Math.cos(orbitY);
			const z = cameraDistance * Math.cos(orbitX);

			// Position camera relative to orbit center
			this.camera.position.set(centroidX + x, centroidY + y, this.orbitCenterZ + z);

			// Look at orbit center
			this.camera.lookAt(centroidX, centroidY, this.orbitCenterZ);

			// Apply Z-axis rotation
			this.camera.rotation.z += rotation;
		} else {
			// 2D top-down view
			this.camera.position.x = centroidX;
			this.camera.position.y = centroidY;
			this.camera.position.z = this.orbitCenterZ + cameraDistance;

			// Look at centroid
			this.camera.lookAt(centroidX, centroidY, this.orbitCenterZ);

			// Reset rotation
			this.camera.rotation.set(0, 0, 0);
			this.camera.up.set(0, 0, 1); // Z-up

			// Apply Z-axis rotation
			this.camera.rotation.z = rotation;
		}

		// Update orthographic camera frustum
		// CRITICAL: Fixed frustum size matching canvas dimensions (1:1 pixel mapping)
		const frustumWidth = this.width;
		const frustumHeight = this.height;

		this.camera.left = -frustumWidth / 2;
		this.camera.right = frustumWidth / 2;
		this.camera.top = frustumHeight / 2;
		this.camera.bottom = -frustumHeight / 2;

		// Apply zoom via camera.zoom property
		this.camera.zoom = scale;
		this.camera.updateProjectionMatrix();

		// Update directional light position
		if (this.directionalLight) {
			const lightOffset = 1000;
			this.directionalLight.position.set(this.camera.position.x, this.camera.position.y + lightOffset, this.camera.position.z);
			this.directionalLight.target.position.set(centroidX, centroidY, this.orbitCenterZ);
			this.directionalLight.target.updateMatrixWorld();
		}

		// Skip render during wheel zoom for performance
		if (!skipRender) {
			this.needsRender = true;
		}

		// Track rotation changes for billboard optimization
		const rotationChanged = this.lastRotation !== rotation || this.lastOrbitX !== orbitX || this.lastOrbitY !== orbitY;

		if (rotationChanged) {
			this.cameraRotationChanged = true;
			this.lastRotation = rotation;
			this.lastOrbitX = orbitX;
			this.lastOrbitY = orbitY;
		}
	}

	/**
	 * Set orbit center (data centroid)
	 * @param {number} x - World X coordinate
	 * @param {number} y - World Y coordinate
	 * @param {number} z - World Z coordinate
	 */
	setOrbitCenter(x, y, z) {
		this.orbitCenterX = x || 0;
		this.orbitCenterY = y || 0;
		this.orbitCenterZ = z || 0;

		// Update grid position if exists
		if (this.gridHelper) {
			this.gridHelper.position.set(this.orbitCenterX, this.orbitCenterY, this.orbitCenterZ);
			this.requestRender();
		}
	}

	/**
	 * Set orbit center Z coordinate (backward compatibility)
	 * @param {number} z - Z coordinate
	 */
	setOrbitCenterZ(z) {
		this.orbitCenterZ = z || 0;
	}

	/**
	 * Update lighting based on bearing and elevation
	 * @param {number} bearingDeg - Bearing in degrees (0 = North)
	 * @param {number} elevationDeg - Elevation in degrees (0 = horizontal)
	 */
	updateLighting(bearingDeg, elevationDeg) {
		const bearingRad = bearingDeg * Math.PI / 180;
		const elevationRad = elevationDeg * Math.PI / 180;

		const distance = 10000;
		const x = -distance * Math.sin(bearingRad) * Math.cos(elevationRad);
		const y = distance * Math.sin(elevationRad);
		const z = distance * Math.cos(bearingRad) * Math.cos(elevationRad);

		const cameraState = this.cameraState;
		const targetX = cameraState.centroidX || 0;
		const targetY = cameraState.centroidY || 0;
		const targetZ = this.orbitCenterZ || 0;

		if (this.directionalLight) {
			const cameraPos = this.camera.position;
			const lightOffsetY = 1000;

			this.directionalLight.position.set(cameraPos.x + x * 0.1, cameraPos.y + lightOffsetY, cameraPos.z + z * 0.1);

			this.directionalLight.target.position.set(targetX, targetY, targetZ);
			this.directionalLight.target.updateMatrixWorld();
		}

		this.requestRender();
	}

	/**
	 * Update ambient light intensity
	 * @param {number} intensity - Light intensity (0-1)
	 */
	updateAmbientLightIntensity(intensity) {
		if (this.ambientLight) {
			this.ambientLight.intensity = intensity;
			this.requestRender();
		}
	}

	/**
	 * Update directional light intensity
	 * @param {number} intensity - Light intensity (0-1)
	 */
	updateDirectionalLightIntensity(intensity) {
		if (this.directionalLight) {
			this.directionalLight.intensity = intensity;
			this.requestRender();
		}
	}

	/**
	 * Update shadow intensity
	 * @param {number} intensity - Shadow intensity (0-1)
	 */
	updateShadowIntensity(intensity) {
		this.shadowIntensity = intensity;
		if (this.directionalLight && this.directionalLight.shadow) {
			this.directionalLight.shadow.darkness = intensity;
			this.requestRender();
		}
	}

	/**
	 * Set grid visibility
	 * @param {boolean} visible - Show/hide grid
	 */
	setGridVisible(visible) {
		if (visible) {
			if (this.gridHelper) {
				this.gridHelper.visible = true;
			} else {
				// Create grid if doesn't exist
				const size = this.gridSize || 10;
				const divisions = 50;
				const totalSize = size * divisions;
				const gridColor = window.darkModeEnabled ? 0x444444 : 0xcccccc;

				this.gridHelper = new THREE.GridHelper(totalSize, divisions, gridColor, gridColor);
				this.gridHelper.visible = true;

				this._applyGridPlaneOrientation(this.gridPlane || "XY");
				this.gridHelper.position.set(this.orbitCenterX || 0, this.orbitCenterY || 0, this.orbitCenterZ || 0);

				const opacity = this.gridOpacity !== undefined ? this.gridOpacity : 0.3;
				this.gridHelper.material.opacity = opacity;
				this.gridHelper.material.transparent = true;
				this.gridOpacity = opacity;

				this.scene.add(this.gridHelper);
			}
		} else {
			if (this.gridHelper) {
				this.scene.remove(this.gridHelper);
				if (this.gridHelper.geometry) this.gridHelper.geometry.dispose();
				if (this.gridHelper.material) {
					if (Array.isArray(this.gridHelper.material)) {
						this.gridHelper.material.forEach(mat => mat && mat.dispose());
					} else {
						this.gridHelper.material.dispose();
					}
				}
				this.gridHelper = null;
			}
		}

		this.requestRender();
	}

	/**
	 * Update grid size
	 * @param {number} size - Grid division size in meters
	 */
	updateGridSize(size) {
		this.gridSize = size;

		if (!this.gridHelper) return;

		// Remove old grid
		this.scene.remove(this.gridHelper);
		this.gridHelper.geometry.dispose();
		this.gridHelper.material.dispose();

		// Create new grid
		const divisions = 50;
		const gridSize = size * divisions;
		const gridColor = window.darkModeEnabled ? 0x444444 : 0xcccccc;

		this.gridHelper = new THREE.GridHelper(gridSize, divisions, gridColor, gridColor);
		this._applyGridPlaneOrientation(this.gridPlane || "XY");
		this.gridHelper.position.set(this.orbitCenterX || 0, this.orbitCenterY || 0, this.orbitCenterZ || 0);

		const opacity = this.gridOpacity !== undefined ? this.gridOpacity : 0.3;
		this.gridHelper.material.opacity = opacity;
		this.gridHelper.material.transparent = true;
		this.gridHelper.visible = true;

		this.scene.add(this.gridHelper);
		this.requestRender();
	}

	/**
	 * Update grid opacity
	 * @param {number} opacity - Opacity value (0-1)
	 */
	updateGridOpacity(opacity) {
		const validOpacity = Math.max(0, Math.min(1, parseFloat(opacity) || 0.3));
		this.gridOpacity = validOpacity;

		if (this.gridHelper && this.gridHelper.material) {
			this.gridHelper.visible = true;
			this.gridHelper.material.opacity = validOpacity;
			this.gridHelper.material.transparent = true;
			this.requestRender();
		}
	}

	/**
	 * Update grid plane orientation
	 * @param {string} plane - Plane orientation ("XY", "XZ", "YZ", "Camera")
	 */
	updateGridPlane(plane) {
		this.gridPlane = plane;

		if (this.gridHelper) {
			this._applyGridPlaneOrientation(plane);
			this.gridHelper.position.set(this.orbitCenterX || 0, this.orbitCenterY || 0, this.orbitCenterZ || 0);
			this.requestRender();
		}
	}

	/**
	 * Resize renderer and camera
	 * @param {number} width - New width in pixels
	 * @param {number} height - New height in pixels
	 */
	resize(width, height) {
		this.width = width;
		this.height = height;
		this.renderer.setSize(width, height);

		// Update camera frustum
		const frustumWidth = width;
		const frustumHeight = height;

		this.camera.left = -frustumWidth / 2;
		this.camera.right = frustumWidth / 2;
		this.camera.top = frustumHeight / 2;
		this.camera.bottom = -frustumHeight / 2;

		this.camera.updateProjectionMatrix();

		// Update LineMaterial resolutions
		this.scene.traverse(child => {
			if (child.material && child.material.isLineMaterial) {
				child.material.resolution.set(width, height);
			}
		});

		this.needsRender = true;
	}

	/**
	 * Convert world coordinates to Three.js coordinates
	 * @param {number} worldX - World X coordinate
	 * @param {number} worldY - World Y coordinate
	 * @param {number} worldZ - World Z coordinate
	 * @returns {THREE.Vector3} Three.js position
	 */
	worldToThree(worldX, worldY, worldZ = 0) {
		return new THREE.Vector3(worldX, worldY, worldZ);
	}

	/**
	 * Dispose group and all children
	 * @param {THREE.Group} group - Group to dispose
	 */
	disposeGroup(group) {
		const toRemove = [];
		group.traverse(object => {
			if (object !== group) {
				// Skip cached text objects (will be reused)
				if (object.userData && object.userData.isCachedText) {
					toRemove.push(object);
				} else if (object.userData && object.userData.type === "instancedHoles") {
					// Skip instanced meshes (handled separately)
					toRemove.push(object);
				} else {
					// Normal objects - dispose
					this._disposeObject(object);
					toRemove.push(object);
				}
			}
		});

		toRemove.forEach(obj => group.remove(obj));
	}

	/**
	 * Clear all geometry from scene
	 */
	clearAllGeometry() {
		// Clear instanced meshes FIRST
		this.clearInstancedHoles();

		// Dispose all groups
		this.disposeGroup(this.holesGroup);
		this.disposeGroup(this.surfacesGroup);
		this.disposeGroup(this.kadGroup);
		this.disposeGroup(this.contoursGroup);
		this.disposeGroup(this.imagesGroup);
		this.disposeGroup(this.connectorsGroup);

		// Clear mesh maps
		this.holeMeshMap.clear();
		this.surfaceMeshMap.clear();
		this.kadMeshMap.clear();

		this.needsRender = true;
	}

	/**
	 * Clear specific group
	 * @param {string} groupName - Group name to clear
	 */
	clearGroup(groupName) {
		switch (groupName) {
			case "holes":
				this.clearInstancedHoles();
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

	/**
	 * Clear instanced holes
	 */
	clearInstancedHoles() {
		// Dispose collar instances
		if (this.instancedCollars) {
			this.holesGroup.remove(this.instancedCollars);
			if (this.instancedCollars.geometry) this.instancedCollars.geometry.dispose();
			if (this.instancedCollars.material) this.instancedCollars.material.dispose();
			this.instancedCollars = null;
		}

		// Dispose grade instances (positive)
		if (this.instancedGradesPositive) {
			this.holesGroup.remove(this.instancedGradesPositive);
			if (this.instancedGradesPositive.geometry) this.instancedGradesPositive.geometry.dispose();
			if (this.instancedGradesPositive.material) this.instancedGradesPositive.material.dispose();
			this.instancedGradesPositive = null;
		}

		// Dispose grade instances (negative)
		if (this.instancedGradesNegative) {
			this.holesGroup.remove(this.instancedGradesNegative);
			if (this.instancedGradesNegative.geometry) this.instancedGradesNegative.geometry.dispose();
			if (this.instancedGradesNegative.material) this.instancedGradesNegative.material.dispose();
			this.instancedGradesNegative = null;
		}

		// Dispose toe instances
		if (this.instancedToes) {
			this.holesGroup.remove(this.instancedToes);
			if (this.instancedToes.geometry) this.instancedToes.geometry.dispose();
			if (this.instancedToes.material) this.instancedToes.material.dispose();
			this.instancedToes = null;
		}

		// Dispose direction arrow instances
		if (this.instancedDirectionArrows) {
			this.contoursGroup.remove(this.instancedDirectionArrows);
			this.instancedDirectionArrows.traverse(child => {
				if (child.isInstancedMesh) {
					if (child.geometry) child.geometry.dispose();
					if (child.material) child.material.dispose();
				}
			});
			this.instancedDirectionArrows = null;
		}

		// Clear mapping tables
		this.instanceIdToHole.clear();
		this.holeToInstanceId.clear();
		this.instancedHolesCount = 0;

		// Clear advanced instanced mesh manager
		if (this.instancedMeshManager) {
			this.instancedMeshManager.clearAll();
		}

		this.needsRender = true;
	}

	/**
	 * Update single hole position (for move tool)
	 * @param {string} holeId - Hole ID
	 * @param {number} newWorldX - New world X
	 * @param {number} newWorldY - New world Y
	 * @param {number} newWorldZ - New world Z
	 */
	updateHolePosition(holeId, newWorldX, newWorldY, newWorldZ) {
		const instanceId = this.holeToInstanceId.get(holeId);
		if (instanceId === undefined) {
			// Not instanced, use holeMeshMap
			const holeGroup = this.holeMeshMap.get(holeId);
			if (holeGroup) {
				const local = window.worldToThreeLocal(newWorldX, newWorldY);
				holeGroup.position.set(local.x, local.y, newWorldZ);
				this.needsRender = true;
			}
			return;
		}

		// Update instanced mesh position
		const local = window.worldToThreeLocal(newWorldX, newWorldY);
		const matrix = new THREE.Matrix4();
		matrix.setPosition(local.x, local.y, newWorldZ);

		if (this.instancedCollars) {
			this.instancedCollars.setMatrixAt(instanceId, matrix);
			this.instancedCollars.instanceMatrix.needsUpdate = true;
		}

		if (this.instancedToes) {
			this.instancedToes.setMatrixAt(instanceId, matrix);
			this.instancedToes.instanceMatrix.needsUpdate = true;
		}

		this.needsRender = true;
	}

	/**
	 * Get hole data from instance ID
	 * @param {number} instanceId - Instance ID
	 * @returns {Object} Hole data
	 */
	getHoleByInstanceId(instanceId) {
		return this.instanceIdToHole.get(instanceId);
	}

	/**
	 * Check if instanced rendering is active
	 * @returns {boolean} True if using instanced holes
	 */
	isUsingInstancedHoles() {
		return this.instancedCollars !== null && this.instancedHolesCount > 0;
	}

	/**
	 * Render the scene
	 */
	render() {
		// Early return if context lost
		if (this.contextLost) {
			console.warn("⚠️ Skipping render - WebGL context lost");
			return;
		}

		// PERFORMANCE: Only update billboards when camera rotation changed
		if (this.cameraRotationChanged) {
			this._updateTextBillboards();
			this._updateBillboardedObjects();
			this.cameraRotationChanged = false;
		}

		this.renderer.render(this.scene, this.camera);
		this.needsRender = false;
	}

	/**
	 * Start render loop
	 */
	startRenderLoop() {
		const animate = () => {
			// Update arcball controls if active
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

	/**
	 * Stop render loop
	 */
	stopRenderLoop() {
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	/**
	 * Request render on next frame
	 */
	requestRender() {
		this.needsRender = true;
	}

	/**
	 * Set background color
	 * @param {boolean} isDarkMode - Dark mode flag
	 */
	setBackgroundColor(isDarkMode) {
		const backgroundColor = isDarkMode ? 0x000000 : 0xffffff;
		this.scene.background = new THREE.Color(backgroundColor);
		this.needsRender = true;
	}

	/**
	 * Show/hide axis helper
	 * @param {boolean} show - Show/hide flag
	 * @param {number} positionX - X position
	 * @param {number} positionY - Y position
	 * @param {number} scale - Scale factor
	 */
	showAxisHelper(show, positionX = 0, positionY = 0, scale = 1) {
		if (!this.axisHelper) {
			this.axisHelper = this._createAxisHelper(50);
			this.axisHelper.visible = false;
			this.scene.add(this.axisHelper);
			this.axisHelperBaseSize = 50;
		}

		if (this.axisHelper) {
			this.axisHelper.visible = show;
			if (show) {
				this.axisHelper.position.set(positionX, positionY, this.orbitCenterZ || 0);

				// Scale to maintain fixed screen size
				const desiredScreenPixels = 111;
				const worldUnitsForFixedScreenSize = desiredScreenPixels / scale;
				const scaleFactor = worldUnitsForFixedScreenSize / this.axisHelperBaseSize;
				this.axisHelper.scale.set(scaleFactor, scaleFactor, scaleFactor);
			}
			this.needsRender = true;
		}
	}

	/**
	 * Raycast for object selection
	 * @param {number} mouseX - Mouse X in pixels
	 * @param {number} mouseY - Mouse Y in pixels
	 * @returns {Array} Intersection results
	 */
	raycast(mouseX, mouseY) {
		const mouse = new THREE.Vector2();
		mouse.x = mouseX / this.width * 2 - 1;
		mouse.y = -(mouseY / this.height) * 2 + 1;

		this.raycaster.setFromCamera(mouse, this.camera);
		const intersects = this.raycaster.intersectObjects(this.scene.children, true);
		return intersects;
	}

	/**
	 * Get scene statistics
	 * @returns {Object} Scene stats
	 */
	getStats() {
		return {
			holes: this.holeMeshMap.size,
			surfaces: this.surfaceMeshMap.size,
			kad: this.kadMeshMap.size,
			triangles: this.renderer.info.render.triangles,
			calls: this.renderer.info.render.calls
		};
	}

	/**
	 * Get detailed memory statistics
	 * @returns {Object} Memory stats
	 */
	getMemoryStats() {
		const memory = this.renderer.info.memory;
		const render = this.renderer.info.render;
		return {
			geometries: memory.geometries,
			textures: memory.textures,
			triangles: render.triangles,
			drawCalls: render.calls,
			holesGroupChildren: this.holesGroup.children.length,
			kadGroupChildren: this.kadGroup.children.length,
			surfacesGroupChildren: this.surfacesGroup.children.length,
			contoursGroupChildren: this.contoursGroup.children.length,
			imagesGroupChildren: this.imagesGroup.children.length,
			connectorsGroupChildren: this.connectorsGroup.children.length,
			contextLost: this.contextLost
		};
	}

	/**
	 * Log memory stats to console
	 * @returns {Object} Memory stats
	 */
	logMemoryStats() {
		const stats = this.getMemoryStats();
		console.log("📊 Three.js Memory Stats (V2):");
		console.log("   Geometries:", stats.geometries);
		console.log("   Textures:", stats.textures);
		console.log("   Triangles:", stats.triangles);
		console.log("   Draw Calls:", stats.drawCalls);
		console.log("   Context Lost:", stats.contextLost);
		return stats;
	}

	/**
	 * Clear text cache when data changes
	 */
	clearTextCacheOnDataChange() {
		clearTextCache();
	}

	/**
	 * Update clipping planes
	 * @param {number} near - Near plane distance
	 * @param {number} far - Far plane distance
	 */
	updateClippingPlanes(near, far) {
		this.camera.near = near;
		this.camera.far = far;
		this.camera.updateProjectionMatrix();
		this.requestRender();
	}

	/**
	 * Set clipping plane visualization
	 * @param {boolean} visible - Show/hide clipping planes
	 */
	setClippingPlaneVisualization(visible) {
		// Not implemented in V2 - stub for compatibility
		this.requestRender();
	}

	/**
	 * Cleanup and dispose
	 */
	dispose() {
		this.stopRenderLoop();

		// Dispose all scene objects
		this.scene.traverse(object => {
			if (object.geometry) {
				object.geometry.dispose();
			}
			if (object.material) {
				if (Array.isArray(object.material)) {
					object.material.forEach(material => material.dispose());
				} else {
					object.material.dispose();
				}
			}
		});

		this.renderer.dispose();
	}
}
