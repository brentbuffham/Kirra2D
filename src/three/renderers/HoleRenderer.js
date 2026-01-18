/* prettier-ignore-file */
//=================================================
// HoleRenderer.js - High-Performance Blast Hole Rendering
//=================================================
// Renders blast holes using instanced meshes for maximum performance
// Key features:
// - InstancedMesh for ALL hole circles (collar, grade, toe)
// - Batched hole body lines into single LineSegments geometry
// - Supports different hole types (production, presplit, etc.)
// - Target: 10,000 holes at 60fps
//
// Geometry Structure per hole:
// - Collar circle (InstancedMesh)
// - Grade circle (InstancedMesh) - optional
// - Toe circle (InstancedMesh)
// - Body line (batched LineSegments)
// - Labels (Troika text, LOD culled)
//=================================================

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export class HoleRenderer {
	constructor(sceneManager) {
		// Step 1) Store scene manager reference
		this.sceneManager = sceneManager;
		this.threeRenderer = sceneManager ? sceneManager.renderer : null;

		// Step 2) Instanced mesh storage by type/diameter
		// Key: "type_diameter" e.g., "Production_115"
		this.collarMeshes = new Map();
		this.gradeMeshes = new Map();
		this.toeMeshes = new Map();

		// Step 3) Batched line geometry for hole bodies
		this.bodyLineGeometry = null;
		this.bodyLineMaterial = null;
		this.bodyLineMesh = null;

		// Step 4) Instance tracking
		this.holeInstanceMap = new Map();  // holeID -> { collarIndex, gradeIndex, toeIndex, meshKey }
		this.instanceCounts = new Map();   // meshKey -> current count

		// Step 5) Configuration
		this.config = {
			defaultDiameter: 115,        // mm
			circleSegments: 32,          // Segments for circle geometry
			collarColor: 0x00ff00,       // Green
			gradeColor: 0xffff00,        // Yellow
			toeColor: 0xff0000,          // Red
			bodyLineWidth: 2,            // Pixels
			maxInstancesPerMesh: 10000,  // Max instances before creating new mesh
			renderGradeCircle: true,     // Whether to render grade circles
			renderLabels: false          // Whether to render hole labels (LOD)
		};

		// Step 6) Reusable objects for transforms
		this._tempMatrix = new THREE.Matrix4();
		this._tempPosition = new THREE.Vector3();
		this._tempQuaternion = new THREE.Quaternion();
		this._tempScale = new THREE.Vector3(1, 1, 1);
		this._tempColor = new THREE.Color();

		// Step 7) Geometry cache
		this._circleGeometry = null;
		this._initCircleGeometry();

		// Step 8) Statistics
		this.stats = {
			holesRendered: 0,
			instancedMeshCount: 0,
			bodyLineVertices: 0,
			lastBuildTime: 0
		};

		console.log("🕳️ HoleRenderer initialized");
	}

	/**
	 * Initialize shared circle geometry
	 */
	_initCircleGeometry() {
		// Create a flat circle in XY plane (will be rotated to XZ for horizontal display)
		this._circleGeometry = new THREE.CircleGeometry(1, this.config.circleSegments);

		// Rotate to be horizontal (XZ plane) since Kirra uses Z-up
		this._circleGeometry.rotateX(-Math.PI / 2);
	}

	// ========================================
	// INSTANCED MESH MANAGEMENT
	// ========================================

	/**
	 * Get or create instanced mesh for hole circles
	 * @param {Map} meshMap - Map to store mesh (collarMeshes, gradeMeshes, toeMeshes)
	 * @param {string} key - Mesh key (type_diameter)
	 * @param {number} color - Circle color
	 * @param {number} diameter - Hole diameter in mm
	 * @returns {THREE.InstancedMesh} The instanced mesh
	 */
	_getOrCreateInstancedMesh(meshMap, key, color, diameter) {
		if (meshMap.has(key)) {
			return meshMap.get(key);
		}

		// Create material
		var material = new THREE.MeshBasicMaterial({
			color: color,
			side: THREE.DoubleSide,
			transparent: false
		});

		// Create instanced mesh with initial capacity
		var mesh = new THREE.InstancedMesh(
			this._circleGeometry,
			material,
			this.config.maxInstancesPerMesh
		);

		// Set initial count to 0
		mesh.count = 0;
		mesh.frustumCulled = false;  // We handle culling ourselves

		// Store metadata
		mesh.userData = {
			type: "holeCircle",
			key: key,
			diameter: diameter,
			color: color
		};

		meshMap.set(key, mesh);
		this.instanceCounts.set(key, 0);

		return mesh;
	}

	/**
	 * Add instance to instanced mesh
	 * @param {THREE.InstancedMesh} mesh - The instanced mesh
	 * @param {string} key - Mesh key
	 * @param {number} x - X position
	 * @param {number} y - Y position
	 * @param {number} z - Z position
	 * @param {number} radius - Circle radius
	 * @param {number} colorOverride - Optional color override
	 * @returns {number} Instance index
	 */
	_addInstance(mesh, key, x, y, z, radius, colorOverride) {
		var index = this.instanceCounts.get(key) || 0;

		// Check capacity
		if (index >= this.config.maxInstancesPerMesh) {
			console.warn("HoleRenderer: Max instances reached for " + key);
			return -1;
		}

		// Set transform matrix
		this._tempPosition.set(x, y, z);
		this._tempQuaternion.identity();
		this._tempScale.set(radius, radius, radius);

		this._tempMatrix.compose(this._tempPosition, this._tempQuaternion, this._tempScale);
		mesh.setMatrixAt(index, this._tempMatrix);

		// Set color if override provided
		if (colorOverride !== undefined) {
			this._tempColor.set(colorOverride);
			mesh.setColorAt(index, this._tempColor);
		}

		// Increment count
		this.instanceCounts.set(key, index + 1);
		mesh.count = index + 1;

		return index;
	}

	// ========================================
	// HOLE BUILDING
	// ========================================

	/**
	 * Build all holes from data array
	 * @param {Array} holes - Array of hole objects
	 * @param {THREE.Group} targetGroup - Group to add meshes to
	 * @param {Object} options - Build options
	 */
	build(holes, targetGroup, options) {
		var startTime = performance.now();
		options = options || {};

		var originX = options.originX || 0;
		var originY = options.originY || 0;

		// Step 1) Clear existing geometry
		this.clear();

		// Step 2) Prepare line positions array for batching
		var linePositions = [];

		// Step 3) Process each hole
		var self = this;
		var visibleHoles = 0;

		holes.forEach(function(hole) {
			// Skip invisible holes
			if (!hole.visible) return;
			visibleHoles++;

			// Get hole properties
			var diameter = hole.holeDiameter || self.config.defaultDiameter;
			var radius = (diameter / 1000) / 2;  // Convert mm to meters, then to radius
			var holeType = hole.holeType || "Production";
			var color = hole.colorHexDecimal || "#ff0000";

			// Get positions (convert to local coordinates)
			var collarX = hole.startXLocation - originX;
			var collarY = hole.startYLocation - originY;
			var collarZ = hole.startZLocation || 0;

			var toeX = hole.endXLocation - originX;
			var toeY = hole.endYLocation - originY;
			var toeZ = hole.endZLocation || 0;

			var gradeX = hole.gradeXLocation - originX;
			var gradeY = hole.gradeYLocation - originY;
			var gradeZ = hole.gradeZLocation || 0;

			// Build mesh key
			var meshKey = holeType + "_" + diameter;

			// Add collar circle instance
			var collarMesh = self._getOrCreateInstancedMesh(
				self.collarMeshes, meshKey + "_collar",
				self.config.collarColor, diameter
			);
			var collarIndex = self._addInstance(collarMesh, meshKey + "_collar",
				collarX, collarY, collarZ, radius);

			// Add grade circle instance (optional)
			var gradeIndex = -1;
			if (self.config.renderGradeCircle) {
				var gradeMesh = self._getOrCreateInstancedMesh(
					self.gradeMeshes, meshKey + "_grade",
					self.config.gradeColor, diameter
				);
				gradeIndex = self._addInstance(gradeMesh, meshKey + "_grade",
					gradeX, gradeY, gradeZ, radius * 0.8);  // Slightly smaller
			}

			// Add toe circle instance
			var toeMesh = self._getOrCreateInstancedMesh(
				self.toeMeshes, meshKey + "_toe",
				self.config.toeColor, diameter
			);
			var toeIndex = self._addInstance(toeMesh, meshKey + "_toe",
				toeX, toeY, toeZ, radius * 0.6);  // Smallest

			// Add body line (collar to toe)
			linePositions.push(collarX, collarY, collarZ, toeX, toeY, toeZ);

			// Store instance mapping for later updates/selection
			self.holeInstanceMap.set(hole.holeID, {
				collarIndex: collarIndex,
				gradeIndex: gradeIndex,
				toeIndex: toeIndex,
				meshKey: meshKey,
				hole: hole
			});
		});

		// Step 4) Add instanced meshes to scene
		this.collarMeshes.forEach(function(mesh) {
			mesh.instanceMatrix.needsUpdate = true;
			if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
			targetGroup.add(mesh);
		});

		this.gradeMeshes.forEach(function(mesh) {
			mesh.instanceMatrix.needsUpdate = true;
			if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
			targetGroup.add(mesh);
		});

		this.toeMeshes.forEach(function(mesh) {
			mesh.instanceMatrix.needsUpdate = true;
			if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
			targetGroup.add(mesh);
		});

		// Step 5) Build batched body lines
		if (linePositions.length > 0) {
			this._buildBodyLines(linePositions, targetGroup, options);
		}

		// Step 6) Update stats
		this.stats.holesRendered = visibleHoles;
		this.stats.instancedMeshCount = this.collarMeshes.size + this.gradeMeshes.size + this.toeMeshes.size;
		this.stats.bodyLineVertices = linePositions.length / 3;
		this.stats.lastBuildTime = performance.now() - startTime;

		console.log("🕳️ HoleRenderer: Built " + visibleHoles + " holes in " +
			this.stats.lastBuildTime.toFixed(2) + "ms (" +
			this.stats.instancedMeshCount + " instanced meshes)");
	}

	/**
	 * Build batched body lines
	 */
	_buildBodyLines(positions, targetGroup, options) {
		// Create geometry
		this.bodyLineGeometry = new LineSegmentsGeometry();
		this.bodyLineGeometry.setPositions(positions);

		// Create material
		var resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
		this.bodyLineMaterial = new LineMaterial({
			color: 0xffffff,
			linewidth: this.config.bodyLineWidth,
			resolution: resolution,
			worldUnits: false,
			vertexColors: false
		});

		// Create mesh
		this.bodyLineMesh = new LineSegments2(this.bodyLineGeometry, this.bodyLineMaterial);
		this.bodyLineMesh.computeLineDistances();
		this.bodyLineMesh.userData = {
			type: "holeBodyLines",
			lineCount: positions.length / 6
		};

		targetGroup.add(this.bodyLineMesh);
	}

	// ========================================
	// UPDATE OPERATIONS
	// ========================================

	/**
	 * Update a single hole's color
	 * @param {string} holeID - Hole ID
	 * @param {number} color - New color
	 */
	updateHoleColor(holeID, color) {
		var mapping = this.holeInstanceMap.get(holeID);
		if (!mapping) return;

		this._tempColor.set(color);

		// Update collar
		var collarMesh = this.collarMeshes.get(mapping.meshKey + "_collar");
		if (collarMesh && mapping.collarIndex >= 0) {
			collarMesh.setColorAt(mapping.collarIndex, this._tempColor);
			collarMesh.instanceColor.needsUpdate = true;
		}

		// Update toe
		var toeMesh = this.toeMeshes.get(mapping.meshKey + "_toe");
		if (toeMesh && mapping.toeIndex >= 0) {
			toeMesh.setColorAt(mapping.toeIndex, this._tempColor);
			toeMesh.instanceColor.needsUpdate = true;
		}
	}

	/**
	 * Update hole visibility
	 * @param {string} holeID - Hole ID
	 * @param {boolean} visible - Visibility
	 */
	updateHoleVisibility(holeID, visible) {
		// For instanced meshes, we can't hide individual instances directly
		// We'd need to rebuild or use custom shaders
		// For now, mark hole as needing rebuild
		if (this.sceneManager) {
			this.sceneManager.markDirty("holes");
		}
	}

	/**
	 * Update resolution for line materials
	 * @param {number} width - Canvas width
	 * @param {number} height - Canvas height
	 */
	updateResolution(width, height) {
		if (this.bodyLineMaterial) {
			this.bodyLineMaterial.resolution.set(width, height);
		}
	}

	// ========================================
	// CLEAR / DISPOSE
	// ========================================

	/**
	 * Clear all geometry
	 */
	clear() {
		var self = this;

		// Dispose collar meshes
		this.collarMeshes.forEach(function(mesh) {
			if (mesh.parent) mesh.parent.remove(mesh);
			mesh.dispose();
		});
		this.collarMeshes.clear();

		// Dispose grade meshes
		this.gradeMeshes.forEach(function(mesh) {
			if (mesh.parent) mesh.parent.remove(mesh);
			mesh.dispose();
		});
		this.gradeMeshes.clear();

		// Dispose toe meshes
		this.toeMeshes.forEach(function(mesh) {
			if (mesh.parent) mesh.parent.remove(mesh);
			mesh.dispose();
		});
		this.toeMeshes.clear();

		// Dispose body lines
		if (this.bodyLineMesh) {
			if (this.bodyLineMesh.parent) this.bodyLineMesh.parent.remove(this.bodyLineMesh);
			if (this.bodyLineGeometry) this.bodyLineGeometry.dispose();
			if (this.bodyLineMaterial) this.bodyLineMaterial.dispose();
			this.bodyLineMesh = null;
			this.bodyLineGeometry = null;
			this.bodyLineMaterial = null;
		}

		// Clear tracking
		this.holeInstanceMap.clear();
		this.instanceCounts.clear();

		// Reset stats
		this.stats.holesRendered = 0;
		this.stats.instancedMeshCount = 0;
		this.stats.bodyLineVertices = 0;
	}

	/**
	 * Get statistics
	 * @returns {Object} Stats
	 */
	getStats() {
		return {
			holesRendered: this.stats.holesRendered,
			instancedMeshCount: this.stats.instancedMeshCount,
			bodyLineVertices: this.stats.bodyLineVertices,
			lastBuildTime: this.stats.lastBuildTime.toFixed(2) + "ms",
			collarMeshes: this.collarMeshes.size,
			gradeMeshes: this.gradeMeshes.size,
			toeMeshes: this.toeMeshes.size
		};
	}

	/**
	 * Dispose all resources
	 */
	dispose() {
		this.clear();

		if (this._circleGeometry) {
			this._circleGeometry.dispose();
			this._circleGeometry = null;
		}

		this.sceneManager = null;
		this.threeRenderer = null;

		console.log("🕳️ HoleRenderer disposed");
	}
}

export default HoleRenderer;
