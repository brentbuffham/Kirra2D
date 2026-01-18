// src/three/InstancedMeshManager.js
//=============================================================
// INSTANCED MESH MANAGER FOR HIGH-PERFORMANCE HOLE RENDERING
//=============================================================
// Manages THREE.InstancedMesh objects for rendering thousands of blast holes
// Groups holes by diameter and type (collar/grade/toe) for optimal batching
// Also batches LINE SEGMENTS to reduce draw calls from 1000s to ~10
// Provides 10-50x performance improvement over individual mesh rendering

import * as THREE from "three";

export class InstancedMeshManager {
	constructor(scene) {
		this.scene = scene;

		// Storage for instanced meshes grouped by type and size
		// Format: { "collar_115": InstancedMesh, "grade_115": InstancedMesh, ... }
		this.instancedMeshes = new Map();

		// Track which instance index belongs to which hole
		// Format: { "entityName:::holeID": { collar: {meshKey, index}, grade: {...}, toe: {...} } }
		this.holeInstanceMap = new Map();

		// Track next available index for each mesh
		// Format: { "collar_115": 0, "grade_115": 0, ... }
		this.nextIndexMap = new Map();

		// Track instance counts and capacities
		// Format: { "collar_115": { count: 0, capacity: 1000 } }
		this.instanceCounts = new Map();

		// Default capacity per instanced mesh (will grow if needed)
		this.defaultCapacity = 1000;

		// Reusable matrix and color objects to avoid allocations
		this.tempMatrix = new THREE.Matrix4();
		this.tempColor = new THREE.Color();
		this.tempVector = new THREE.Vector3();

		// =============================================
		// LINE BATCHING - Batch all hole body lines into single draw calls
		// =============================================
		// Format: { "solid_white": [x1,y1,z1, x2,y2,z2, ...], "solid_red": [...] }
		this.lineBatches = new Map();
		// Built line meshes
		this.lineMeshes = new Map();
		// Flag to track if batches need rebuilding
		this.linesDirty = false;
	}

	/**
	 * Get or create an InstancedMesh for a specific type and diameter
	 * @param {string} type - "collar", "grade", or "toe"
	 * @param {number} diameter - Hole diameter in mm
	 * @param {number} radiusMeters - Radius in meters (pre-calculated)
	 * @param {number} color - THREE color (hex)
	 * @param {boolean} isDarkMode - Dark mode flag
	 * @returns {string} meshKey for tracking
	 */
	getOrCreateInstancedMesh(type, diameter, radiusMeters, color, isDarkMode) {
		// Create unique key for this combination
		const meshKey = `${type}_${diameter}`;

		if (!this.instancedMeshes.has(meshKey)) {
			// Create new InstancedMesh
			const geometry = new THREE.CircleGeometry(radiusMeters, 32);

			// Material properties vary by type
			const isToe = type.startsWith("toe");
			const isGrade = type.startsWith("grade");
			const isNegativeGrade = type === "grade_negative";

			// IMPORTANT: All instances in this mesh use the SAME color (set via material.color)
			// We don't use per-instance colors since all collars/grades/toes of same type are same color
			const material = new THREE.MeshBasicMaterial({
				color: color, // Use the actual color passed in
				side: THREE.DoubleSide,
				transparent: (isToe || isNegativeGrade) ? true : false, // Toes and negative grade are transparent
				opacity: (isToe || isNegativeGrade) ? 0.2 : 1.0, // Toes and negative grade are 20% opaque
				depthTest: true,
				depthWrite: (isToe || isNegativeGrade) ? false : true, // Transparent items don't write to depth buffer
				vertexColors: false // NOT using per-instance colors
			});

			const instancedMesh = new THREE.InstancedMesh(geometry, material, this.defaultCapacity);

			// CRITICAL: Set count to 0 initially - only render instances we've added
			// Without this, all 1000 default instances render at (0,0,0) as black circles
			instancedMesh.count = 0;

			// Set userData for identification
			instancedMesh.userData = {
				type: "instancedHoles",
				holeType: type,
				diameter: diameter
			};

			// Add to scene
			this.scene.add(instancedMesh);

			// Track it
			this.instancedMeshes.set(meshKey, instancedMesh);
			this.nextIndexMap.set(meshKey, 0);
			this.instanceCounts.set(meshKey, { count: 0, capacity: this.defaultCapacity });
		}

		return meshKey;
	}

	/**
	 * Add a hole instance (collar, grade, or toe marker)
	 * @param {string} holeId - Unique hole ID (entityName:::holeID)
	 * @param {string} type - "collar", "grade", or "toe"
	 * @param {number} x - X position (local Three.js coords)
	 * @param {number} y - Y position (local Three.js coords)
	 * @param {number} z - Z position (elevation)
	 * @param {number} diameter - Hole diameter in mm
	 * @param {number} radiusMeters - Radius in meters
	 * @param {number} color - THREE color (hex)
	 * @param {boolean} isDarkMode - Dark mode flag
	 */
	addHoleInstance(holeId, type, x, y, z, diameter, radiusMeters, color, isDarkMode) {
		// Get or create the InstancedMesh for this type/diameter
		const meshKey = this.getOrCreateInstancedMesh(type, diameter, radiusMeters, color, isDarkMode);
		const instancedMesh = this.instancedMeshes.get(meshKey);

		// Get next available index
		let index = this.nextIndexMap.get(meshKey);
		const counts = this.instanceCounts.get(meshKey);

		// Check if we need to grow the InstancedMesh
		if (index >= counts.capacity) {
			this.growInstancedMesh(meshKey);
			counts.capacity = this.instancedMeshes.get(meshKey).count;
		}

		// Set instance matrix (position)
		this.tempMatrix.identity();
		this.tempMatrix.setPosition(x, y, z);
		instancedMesh.setMatrixAt(index, this.tempMatrix);

		// Mark for update
		instancedMesh.instanceMatrix.needsUpdate = true;

		// CRITICAL: Update instance count so Three.js renders this instance
		// count property controls how many instances are actually rendered
		instancedMesh.count = Math.max(instancedMesh.count, index + 1);

		// Track this instance
		if (!this.holeInstanceMap.has(holeId)) {
			this.holeInstanceMap.set(holeId, {});
		}
		this.holeInstanceMap.get(holeId)[type] = { meshKey, index };

		// CRITICAL: Store reverse mapping from (meshKey, instanceId) -> holeId for raycasting
		// This allows us to identify which hole was clicked when raycasting hits an InstancedMesh
		const instanceKey = `${meshKey}_${index}`;
		if (!instancedMesh.userData.instanceToHoleMap) {
			instancedMesh.userData.instanceToHoleMap = new Map();
		}
		instancedMesh.userData.instanceToHoleMap.set(index, holeId);

		// Increment counters
		this.nextIndexMap.set(meshKey, index + 1);
		counts.count++;

		return { meshKey, index };
	}

	/**
	 * Update hole instance position (e.g., after coordinate changes)
	 * @param {string} holeId - Unique hole ID
	 * @param {string} type - "collar", "grade", or "toe"
	 * @param {number} x - New X position
	 * @param {number} y - New Y position
	 * @param {number} z - New Z position
	 */
	updateHoleInstancePosition(holeId, type, x, y, z) {
		const holeData = this.holeInstanceMap.get(holeId);
		if (!holeData || !holeData[type]) return;

		const { meshKey, index } = holeData[type];
		const instancedMesh = this.instancedMeshes.get(meshKey);
		if (!instancedMesh) return;

		// Update matrix
		this.tempMatrix.identity();
		this.tempMatrix.setPosition(x, y, z);
		instancedMesh.setMatrixAt(index, this.tempMatrix);
		instancedMesh.instanceMatrix.needsUpdate = true;
	}

	/**
	 * Update hole instance color (e.g., for selection or animation)
	 * NOTE: Not currently used since all instances share the same material color
	 * To change colors, would need to move instance to a different InstancedMesh with different color
	 * @param {string} holeId - Unique hole ID
	 * @param {string} type - "collar", "grade", or "toe"
	 * @param {number} color - THREE color (hex)
	 */
	updateHoleInstanceColor(holeId, type, color) {
		// Color updates not implemented - all instances in a mesh share the same color
		// For animation effects, use separate meshes or highlight overlays instead
		console.warn("updateHoleInstanceColor not implemented - instances share material color");
	}

	/**
	 * Hide hole instance (e.g., for animation or filtering)
	 * @param {string} holeId - Unique hole ID
	 * @param {string} type - "collar", "grade", or "toe"
	 */
	hideHoleInstance(holeId, type) {
		const holeData = this.holeInstanceMap.get(holeId);
		if (!holeData || !holeData[type]) return;

		const { meshKey, index } = holeData[type];
		const instancedMesh = this.instancedMeshes.get(meshKey);
		if (!instancedMesh) return;

		// Move instance far away (cheaper than visibility toggling)
		this.tempMatrix.identity();
		this.tempMatrix.setPosition(0, 0, -999999);
		instancedMesh.setMatrixAt(index, this.tempMatrix);
		instancedMesh.instanceMatrix.needsUpdate = true;
	}

	/**
	 * Show hole instance (restore after hiding)
	 * @param {string} holeId - Unique hole ID
	 * @param {string} type - "collar", "grade", or "toe"
	 * @param {number} x - Original X position
	 * @param {number} y - Original Y position
	 * @param {number} z - Original Z position
	 */
	showHoleInstance(holeId, type, x, y, z) {
		this.updateHoleInstancePosition(holeId, type, x, y, z);
	}

	/**
	 * Remove a hole and all its instances
	 * @param {string} holeId - Unique hole ID
	 */
	removeHole(holeId) {
		const holeData = this.holeInstanceMap.get(holeId);
		if (!holeData) return;

		// Hide all instances for this hole
		["collar", "grade", "toe"].forEach(type => {
			if (holeData[type]) {
				this.hideHoleInstance(holeId, type);
			}
		});

		// Remove from tracking
		this.holeInstanceMap.delete(holeId);
	}

	// =============================================
	// LINE BATCHING METHODS
	// =============================================

	/**
	 * Add a line segment to a batch (instead of creating individual Line object)
	 * @param {string} batchKey - Batch key (e.g., "solid_white", "solid_red", "transparent_red")
	 * @param {number} x1 - Start X
	 * @param {number} y1 - Start Y
	 * @param {number} z1 - Start Z
	 * @param {number} x2 - End X
	 * @param {number} y2 - End Y
	 * @param {number} z2 - End Z
	 */
	addLineToBatch(batchKey, x1, y1, z1, x2, y2, z2) {
		if (!this.lineBatches.has(batchKey)) {
			this.lineBatches.set(batchKey, []);
		}
		var batch = this.lineBatches.get(batchKey);
		batch.push(x1, y1, z1, x2, y2, z2);
		this.linesDirty = true;
	}

	/**
	 * Build all batched lines into LineSegments meshes
	 * Call this ONCE after all holes are added
	 * @param {THREE.Group} targetGroup - Group to add line meshes to (e.g., holesGroup)
	 */
	flushLineBatches(targetGroup) {
		if (!this.linesDirty) return;

		// Clear old line meshes
		this.lineMeshes.forEach(function(mesh) {
			if (mesh.parent) mesh.parent.remove(mesh);
			if (mesh.geometry) mesh.geometry.dispose();
			if (mesh.material) mesh.material.dispose();
		});
		this.lineMeshes.clear();

		var self = this;

		// Build each batch
		this.lineBatches.forEach(function(positions, batchKey) {
			if (positions.length === 0) return;

			// Parse batch key for properties
			var parts = batchKey.split("_");
			var style = parts[0]; // "solid" or "transparent"
			var colorName = parts[1]; // "white", "black", "red"

			// Determine color
			var color;
			switch (colorName) {
				case "white": color = 0xffffff; break;
				case "black": color = 0x000000; break;
				case "red": color = 0xff0000; break;
				default: color = 0xffffff;
			}

			// Create geometry from positions
			var geometry = new THREE.BufferGeometry();
			geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

			// Create material
			var material = new THREE.LineBasicMaterial({
				color: color,
				transparent: (style === "transparent"),
				opacity: (style === "transparent") ? 0.2 : 1.0,
				depthWrite: (style !== "transparent")
			});

			// Create LineSegments (pairs of vertices = line segments)
			var mesh = new THREE.LineSegments(geometry, material);
			mesh.userData = {
				type: "batchedHoleLines",
				batchKey: batchKey,
				lineCount: positions.length / 6
			};

			targetGroup.add(mesh);
			self.lineMeshes.set(batchKey, mesh);
		});

		this.linesDirty = false;

		// Log batching stats (only once, not every frame)
		var totalLines = 0;
		this.lineBatches.forEach(function(positions) {
			totalLines += positions.length / 6;
		});
		// Only log if we actually built new lines
		if (totalLines > 0) {
			console.log("🚀 Line batching: " + totalLines + " lines in " + this.lineMeshes.size + " draw calls");
		}
	}

	/**
	 * Clear line batches (call before redrawing all holes)
	 */
	clearLineBatches() {
		this.lineBatches.forEach(function(batch) {
			batch.length = 0; // Clear array without creating new one
		});
		this.linesDirty = true;
	}

	/**
	 * Clear all instances and reset
	 */
	clearAll() {
		// Dispose all instanced meshes
		this.instancedMeshes.forEach((mesh, key) => {
			this.scene.remove(mesh);
			mesh.geometry.dispose();
			mesh.material.dispose();
		});

		// Clear maps
		this.instancedMeshes.clear();
		this.holeInstanceMap.clear();
		this.nextIndexMap.clear();
		this.instanceCounts.clear();

		// Clear line batches
		this.lineBatches.forEach(function(batch) {
			batch.length = 0;
		});
		this.lineMeshes.forEach(function(mesh) {
			if (mesh.parent) mesh.parent.remove(mesh);
			if (mesh.geometry) mesh.geometry.dispose();
			if (mesh.material) mesh.material.dispose();
		});
		this.lineMeshes.clear();
		this.linesDirty = false;
	}

	/**
	 * Grow an InstancedMesh when capacity is reached
	 * @param {string} meshKey - Key of mesh to grow
	 */
	growInstancedMesh(meshKey) {
		const oldMesh = this.instancedMeshes.get(meshKey);
		if (!oldMesh) return;

		const oldCapacity = this.instanceCounts.get(meshKey).capacity;
		const newCapacity = oldCapacity * 2;

		// Create new larger InstancedMesh
		const newMesh = new THREE.InstancedMesh(oldMesh.geometry, oldMesh.material, newCapacity);

		// Copy existing instances
		for (let i = 0; i < oldCapacity; i++) {
			oldMesh.getMatrixAt(i, this.tempMatrix);
			newMesh.setMatrixAt(i, this.tempMatrix);
		}

		newMesh.instanceMatrix.needsUpdate = true;

		// Copy userData (including instanceToHoleMap for raycasting)
		newMesh.userData = Object.assign({}, oldMesh.userData);
		if (oldMesh.userData.instanceToHoleMap) {
			newMesh.userData.instanceToHoleMap = new Map(oldMesh.userData.instanceToHoleMap);
		}

		// Replace in scene
		this.scene.remove(oldMesh);
		this.scene.add(newMesh);

		// Don't dispose geometry/material (shared with new mesh)

		// Update tracking
		this.instancedMeshes.set(meshKey, newMesh);
		this.instanceCounts.get(meshKey).capacity = newCapacity;
	}

	/**
	 * Get instance info for a hole (for debugging)
	 * @param {string} holeId - Unique hole ID
	 * @returns {Object} Instance data
	 */
	getHoleInstanceInfo(holeId) {
		return this.holeInstanceMap.get(holeId);
	}

	/**
	 * Get statistics about current instancing usage
	 * @returns {Object} Stats
	 */
	getStats() {
		const stats = {
			totalMeshes: this.instancedMeshes.size,
			totalHoles: this.holeInstanceMap.size,
			meshDetails: []
		};

		this.instanceCounts.forEach((counts, key) => {
			stats.meshDetails.push({
				meshKey: key,
				instanceCount: counts.count,
				capacity: counts.capacity,
				usage: `${(counts.count / counts.capacity * 100).toFixed(1)}%`
			});
		});

		return stats;
	}
}
