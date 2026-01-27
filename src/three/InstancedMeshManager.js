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

		// =============================================
		// DUMMY HOLE BATCHING - Batch X-shapes into single draw call
		// =============================================
		// Format: { "dummy_white": [x1,y1,z1, x2,y2,z2, ...], "dummy_black": [...] }
		this.dummyHoleBatches = new Map();
		// Track which line indices belong to which dummy hole for selection
		// Format: { "entityName:::holeID": { batchKey: "dummy_white", startIndex: 0, lineCount: 2 } }
		this.dummyHoleIndexMap = new Map();

		// =============================================
		// ZERO-DIAMETER HOLE BATCHING - Batch squares + tracks into single draw calls
		// =============================================
		// Format: { "zero_white": [x1,y1,z1, x2,y2,z2, ...], "zero_black": [...] }
		this.zeroDiameterBatches = new Map();
		// Track which line indices belong to which zero-diameter hole for selection
		// Format: { "entityName:::holeID": { batchKey: "zero_white", startIndex: 0, lineCount: 4 } }
		this.zeroDiameterIndexMap = new Map();

		// =============================================
		// LOD SIMPLE CIRCLES - 8-segment circles for LOD SIMPLE/MEDIUM levels
		// =============================================
		// Separate pool from main instancedMeshes to allow independent visibility control
		// Format: { "simple_collar_115": InstancedMesh, "simple_collar_200": InstancedMesh, ... }
		this.simpleLODMeshes = new Map();
		this.simpleLODNextIndex = new Map();
		this.simpleLODCounts = new Map();
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

	// =============================================
	// DUMMY HOLE BATCHING METHODS (X-shapes)
	// =============================================

	/**
	 * Step 1) Add a dummy hole X-shape to batch (instead of creating individual Line objects)
	 * Creates 2 line segments forming an X at the specified position
	 * @param {string} holeId - Unique hole ID (entityName:::holeID)
	 * @param {number} x - Center X position
	 * @param {number} y - Center Y position
	 * @param {number} z - Center Z position
	 * @param {number} size - Half-size of the X (radius)
	 * @param {number} color - Color as hex number (0xffffff, 0x000000, etc.)
	 */
	addDummyHoleToBatch(holeId, x, y, z, size, color) {
		// Step 2) Determine batch key based on color
		var batchKey = "dummy_" + this.colorToKey(color);

		if (!this.dummyHoleBatches.has(batchKey)) {
			this.dummyHoleBatches.set(batchKey, []);
		}

		var batch = this.dummyHoleBatches.get(batchKey);
		var startIndex = batch.length / 6; // Each line segment = 6 floats (2 vertices * 3 coords)

		// Step 3) Add X-shape lines (2 line segments)
		// Line 1: top-left to bottom-right
		batch.push(x - size, y + size, z, x + size, y - size, z);
		// Line 2: top-right to bottom-left
		batch.push(x + size, y + size, z, x - size, y - size, z);

		// Step 4) Track for selection/identification
		this.dummyHoleIndexMap.set(holeId, {
			batchKey: batchKey,
			startIndex: startIndex,
			lineCount: 2
		});

		this.linesDirty = true;
	}

	// =============================================
	// ZERO-DIAMETER HOLE BATCHING METHODS (squares + tracks)
	// =============================================

	/**
	 * Step 1) Add a zero-diameter hole to batch (square at collar + track lines)
	 * @param {string} holeId - Unique hole ID (entityName:::holeID)
	 * @param {number} collarX - Collar X position
	 * @param {number} collarY - Collar Y position
	 * @param {number} collarZ - Collar Z position
	 * @param {number} gradeX - Grade X position
	 * @param {number} gradeY - Grade Y position
	 * @param {number} gradeZ - Grade Z position
	 * @param {number} toeX - Toe X position
	 * @param {number} toeY - Toe Y position
	 * @param {number} toeZ - Toe Z position
	 * @param {number} squareSize - Size of the square at collar
	 * @param {number} subdrillAmount - Subdrill amount (negative = negative subdrill)
	 * @param {boolean} isDarkMode - Dark mode flag
	 */
	addZeroDiameterHoleToBatch(holeId, collarX, collarY, collarZ, gradeX, gradeY, gradeZ, toeX, toeY, toeZ, squareSize, subdrillAmount, isDarkMode) {
		// Step 2) Determine batch key based on dark mode
		var lineColor = isDarkMode ? 0xffffff : 0x000000;
		var batchKey = "zero_" + (isDarkMode ? "white" : "black");
		var hasNegativeSubdrill = subdrillAmount < 0;

		if (!this.zeroDiameterBatches.has(batchKey)) {
			this.zeroDiameterBatches.set(batchKey, []);
		}

		var batch = this.zeroDiameterBatches.get(batchKey);
		var startIndex = batch.length / 6;
		var lineCount = 0;

		// Step 3) Add square at collar (4 line segments for LineSegments format)
		var halfSide = squareSize / 2;
		// Bottom edge
		batch.push(collarX - halfSide, collarY - halfSide, collarZ, collarX + halfSide, collarY - halfSide, collarZ);
		// Right edge
		batch.push(collarX + halfSide, collarY - halfSide, collarZ, collarX + halfSide, collarY + halfSide, collarZ);
		// Top edge
		batch.push(collarX + halfSide, collarY + halfSide, collarZ, collarX - halfSide, collarY + halfSide, collarZ);
		// Left edge
		batch.push(collarX - halfSide, collarY + halfSide, collarZ, collarX - halfSide, collarY - halfSide, collarZ);
		lineCount += 4;

		// Step 4) Add track lines based on subdrill type
		if (hasNegativeSubdrill) {
			// NEGATIVE SUBDRILL: collar to toe (solid)
			batch.push(collarX, collarY, collarZ, toeX, toeY, toeZ);
			lineCount += 1;
			// Note: toe to grade (red transparent) goes in separate batch - handled below
		} else {
			// POSITIVE SUBDRILL: collar to grade (solid)
			batch.push(collarX, collarY, collarZ, gradeX, gradeY, gradeZ);
			lineCount += 1;
			// Note: grade to toe (red transparent) goes in separate batch - handled below
		}

		// Step 5) Track for selection/identification
		this.zeroDiameterIndexMap.set(holeId, {
			batchKey: batchKey,
			startIndex: startIndex,
			lineCount: lineCount
		});

		// Step 6) Add transparent red track segment to line batch (reuse existing line batching)
		if (hasNegativeSubdrill) {
			// Red line from toe to grade (20% opacity)
			this.addLineToBatch("transparent_red", toeX, toeY, toeZ, gradeX, gradeY, gradeZ);
		} else {
			// Red line from grade to toe (20% opacity)
			this.addLineToBatch("transparent_red", gradeX, gradeY, gradeZ, toeX, toeY, toeZ);
		}

		this.linesDirty = true;
	}

	/**
	 * Helper: Convert color hex to batch key string
	 * @param {number} color - Color as hex number
	 * @returns {string} Color key for batching
	 */
	colorToKey(color) {
		switch (color) {
			case 0xffffff: return "white";
			case 0x000000: return "black";
			case 0xff0000: return "red";
			case 0x00ff00: return "green";
			case 0x0000ff: return "blue";
			case 0xffff00: return "yellow";
			case 0xff00ff: return "magenta";
			case 0x00ffff: return "cyan";
			default: return color.toString(16).padStart(6, "0"); // Fallback to hex string
		}
	}

	/**
	 * Build all batched lines into LineSegments meshes
	 * Call this ONCE after all holes are added
	 * Includes: hole body lines, dummy hole X-shapes, zero-diameter hole squares
	 * @param {THREE.Group} targetGroup - Group to add line meshes to (e.g., holesGroup)
	 */
	flushLineBatches(targetGroup) {
		if (!this.linesDirty) return;

		// Step 1) Clear old line meshes
		this.lineMeshes.forEach(function(mesh) {
			if (mesh.parent) mesh.parent.remove(mesh);
			if (mesh.geometry) mesh.geometry.dispose();
			if (mesh.material) mesh.material.dispose();
		});
		this.lineMeshes.clear();

		var self = this;
		var totalLines = 0;
		var totalDrawCalls = 0;

		// Step 2) Build regular hole body line batches
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
			totalLines += positions.length / 6;
			totalDrawCalls++;
		});

		// Step 3) Build dummy hole X-shape batches
		this.dummyHoleBatches.forEach(function(positions, batchKey) {
			if (positions.length === 0) return;

			// Parse batch key: "dummy_white", "dummy_black", etc.
			var colorName = batchKey.split("_")[1];

			// Determine color
			var color = self.keyToColor(colorName);

			// Create geometry from positions
			var geometry = new THREE.BufferGeometry();
			geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

			// Create material (solid, no transparency)
			var material = new THREE.LineBasicMaterial({
				color: color,
				transparent: false,
				opacity: 1.0,
				depthWrite: true
			});

			// Create LineSegments
			var mesh = new THREE.LineSegments(geometry, material);
			mesh.userData = {
				type: "batchedDummyHoles",
				batchKey: batchKey,
				lineCount: positions.length / 6,
				holeIndexMap: self.dummyHoleIndexMap // Reference to index map for selection
			};

			targetGroup.add(mesh);
			self.lineMeshes.set(batchKey, mesh);
			totalLines += positions.length / 6;
			totalDrawCalls++;
		});

		// Step 4) Build zero-diameter hole batches (squares + solid track lines)
		this.zeroDiameterBatches.forEach(function(positions, batchKey) {
			if (positions.length === 0) return;

			// Parse batch key: "zero_white", "zero_black", etc.
			var colorName = batchKey.split("_")[1];

			// Determine color
			var color = self.keyToColor(colorName);

			// Create geometry from positions
			var geometry = new THREE.BufferGeometry();
			geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

			// Create material (solid, no transparency)
			var material = new THREE.LineBasicMaterial({
				color: color,
				transparent: false,
				opacity: 1.0,
				depthWrite: true
			});

			// Create LineSegments
			var mesh = new THREE.LineSegments(geometry, material);
			mesh.userData = {
				type: "batchedZeroDiameterHoles",
				batchKey: batchKey,
				lineCount: positions.length / 6,
				holeIndexMap: self.zeroDiameterIndexMap // Reference to index map for selection
			};

			targetGroup.add(mesh);
			self.lineMeshes.set(batchKey, mesh);
			totalLines += positions.length / 6;
			totalDrawCalls++;
		});

		this.linesDirty = false;

		// Step 5) Log batching stats (only once, not every frame)
		if (totalLines > 0) {
			var dummyCount = this.dummyHoleIndexMap.size;
			var zeroCount = this.zeroDiameterIndexMap.size;
			console.log("🚀 Line batching: " + totalLines + " lines in " + totalDrawCalls + " draw calls" +
				(dummyCount > 0 ? " (incl. " + dummyCount + " dummy holes)" : "") +
				(zeroCount > 0 ? " (incl. " + zeroCount + " zero-diameter holes)" : ""));
		}
	}

	/**
	 * Helper: Convert batch key string back to color hex
	 * @param {string} colorKey - Color key string
	 * @returns {number} Color as hex number
	 */
	keyToColor(colorKey) {
		switch (colorKey) {
			case "white": return 0xffffff;
			case "black": return 0x000000;
			case "red": return 0xff0000;
			case "green": return 0x00ff00;
			case "blue": return 0x0000ff;
			case "yellow": return 0xffff00;
			case "magenta": return 0xff00ff;
			case "cyan": return 0x00ffff;
			default:
				// Try to parse as hex string
				var parsed = parseInt(colorKey, 16);
				return isNaN(parsed) ? 0xffffff : parsed;
		}
	}

	/**
	 * Clear line batches (call before redrawing all holes)
	 * Includes: hole body lines, dummy hole X-shapes, zero-diameter hole squares
	 */
	clearLineBatches() {
		// Step 1) Clear regular line batches
		this.lineBatches.forEach(function(batch) {
			batch.length = 0; // Clear array without creating new one
		});

		// Step 2) Clear dummy hole batches and tracking
		this.dummyHoleBatches.forEach(function(batch) {
			batch.length = 0;
		});
		this.dummyHoleIndexMap.clear();

		// Step 3) Clear zero-diameter hole batches and tracking
		this.zeroDiameterBatches.forEach(function(batch) {
			batch.length = 0;
		});
		this.zeroDiameterIndexMap.clear();

		this.linesDirty = true;
	}

	/**
	 * Clear all instances and reset
	 * Includes: instanced meshes, line batches, dummy holes, zero-diameter holes
	 */
	clearAll() {
		// Step 1) Dispose all instanced meshes
		this.instancedMeshes.forEach((mesh, key) => {
			this.scene.remove(mesh);
			mesh.geometry.dispose();
			mesh.material.dispose();
		});

		// Step 2) Clear instanced mesh maps
		this.instancedMeshes.clear();
		this.holeInstanceMap.clear();
		this.nextIndexMap.clear();
		this.instanceCounts.clear();

		// Step 3) Clear regular line batches
		this.lineBatches.forEach(function(batch) {
			batch.length = 0;
		});

		// Step 4) Clear dummy hole batches and tracking
		this.dummyHoleBatches.forEach(function(batch) {
			batch.length = 0;
		});
		this.dummyHoleIndexMap.clear();

		// Step 5) Clear zero-diameter hole batches and tracking
		this.zeroDiameterBatches.forEach(function(batch) {
			batch.length = 0;
		});
		this.zeroDiameterIndexMap.clear();

		// Step 6) Dispose all line meshes
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

		// CRITICAL: Copy the count from old mesh to prevent rendering uninitialized instances
		// Without this, Three.js renders ALL instances up to capacity at (0,0,0)
		newMesh.count = oldMesh.count;

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
			simpleLODMeshes: this.simpleLODMeshes.size,
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

	// =============================================
	// LOD SIMPLE CIRCLES - 8-segment circles for LOD
	// =============================================

	/**
	 * Step LOD1) Get or create a simple LOD InstancedMesh (8 segments)
	 * @param {number} diameter - Hole diameter in mm
	 * @param {number} radiusMeters - Radius in meters
	 * @param {number} color - THREE color (hex)
	 * @param {boolean} isDarkMode - Dark mode flag
	 * @returns {string} meshKey for tracking
	 */
	getOrCreateSimpleLODMesh(diameter, radiusMeters, color, isDarkMode) {
		var meshKey = "simple_collar_" + diameter;

		if (!this.simpleLODMeshes.has(meshKey)) {
			// Step LOD1a) Create 8-segment circle geometry (cheaper than 32)
			var geometry = new THREE.CircleGeometry(radiusMeters, 8);

			// Step LOD1b) Create material
			var material = new THREE.MeshBasicMaterial({
				color: color,
				side: THREE.DoubleSide,
				transparent: false,
				opacity: 1.0,
				depthTest: true,
				depthWrite: true,
				vertexColors: false
			});

			// Step LOD1c) Create instanced mesh
			var instancedMesh = new THREE.InstancedMesh(geometry, material, this.defaultCapacity);
			instancedMesh.count = 0;
			instancedMesh.visible = false; // Start hidden (LOD will control visibility)

			// Step LOD1d) Set userData for identification
			instancedMesh.userData = {
				type: "instancedHolesSimpleLOD",
				holeType: "simple_collar",
				diameter: diameter,
				segments: 8
			};

			// Step LOD1e) Add to scene
			this.scene.add(instancedMesh);

			// Step LOD1f) Track it
			this.simpleLODMeshes.set(meshKey, instancedMesh);
			this.simpleLODNextIndex.set(meshKey, 0);
			this.simpleLODCounts.set(meshKey, { count: 0, capacity: this.defaultCapacity });
		}

		return meshKey;
	}

	/**
	 * Step LOD2) Add a hole to the simple LOD pool
	 * @param {string} holeId - Unique hole ID
	 * @param {number} x - X position (local coords)
	 * @param {number} y - Y position (local coords)
	 * @param {number} z - Z position (elevation)
	 * @param {number} diameter - Hole diameter in mm
	 * @param {number} radiusMeters - Radius in meters
	 * @param {number} color - THREE color (hex)
	 * @param {boolean} isDarkMode - Dark mode flag
	 */
	addSimpleLODInstance(holeId, x, y, z, diameter, radiusMeters, color, isDarkMode) {
		// Step LOD2a) Get or create the mesh
		var meshKey = this.getOrCreateSimpleLODMesh(diameter, radiusMeters, color, isDarkMode);
		var instancedMesh = this.simpleLODMeshes.get(meshKey);

		// Step LOD2b) Get next index
		var index = this.simpleLODNextIndex.get(meshKey);
		var counts = this.simpleLODCounts.get(meshKey);

		// Step LOD2c) Grow if needed
		if (index >= counts.capacity) {
			this._growSimpleLODMesh(meshKey);
			counts.capacity = this.simpleLODCounts.get(meshKey).capacity;
		}

		// Step LOD2d) Set instance matrix
		this.tempMatrix.identity();
		this.tempMatrix.setPosition(x, y, z);
		instancedMesh.setMatrixAt(index, this.tempMatrix);
		instancedMesh.instanceMatrix.needsUpdate = true;

		// Step LOD2e) Update count
		instancedMesh.count = Math.max(instancedMesh.count, index + 1);

		// Step LOD2f) Update tracking
		this.simpleLODNextIndex.set(meshKey, index + 1);
		counts.count++;

		return { meshKey: meshKey, index: index };
	}

	/**
	 * Step LOD3) Grow a simple LOD mesh when capacity is reached
	 * @param {string} meshKey - Key of mesh to grow
	 */
	_growSimpleLODMesh(meshKey) {
		var oldMesh = this.simpleLODMeshes.get(meshKey);
		if (!oldMesh) return;

		var oldCapacity = this.simpleLODCounts.get(meshKey).capacity;
		var newCapacity = oldCapacity * 2;

		// Step LOD3a) Create new larger mesh
		var newMesh = new THREE.InstancedMesh(oldMesh.geometry, oldMesh.material, newCapacity);
		newMesh.visible = oldMesh.visible;

		// CRITICAL: Copy the count from old mesh to prevent rendering uninitialized instances
		// Without this, Three.js renders ALL instances up to capacity at (0,0,0)
		newMesh.count = oldMesh.count;

		// Step LOD3b) Copy existing instances
		for (var i = 0; i < oldCapacity; i++) {
			oldMesh.getMatrixAt(i, this.tempMatrix);
			newMesh.setMatrixAt(i, this.tempMatrix);
		}

		newMesh.instanceMatrix.needsUpdate = true;
		newMesh.userData = Object.assign({}, oldMesh.userData);

		// Step LOD3c) Replace in scene
		this.scene.remove(oldMesh);
		this.scene.add(newMesh);

		// Step LOD3d) Update tracking
		this.simpleLODMeshes.set(meshKey, newMesh);
		this.simpleLODCounts.get(meshKey).capacity = newCapacity;

		console.log("LOD mesh grown: " + meshKey + " -> " + newCapacity + " capacity");
	}

	/**
	 * Step LOD4) Get all simple LOD meshes (for LODManager visibility control)
	 * @returns {Map} Map of simple LOD instanced meshes
	 */
	getSimpleLODMeshes() {
		return this.simpleLODMeshes;
	}

	/**
	 * Step LOD5) Set visibility of all simple LOD meshes
	 * @param {boolean} visible - Visibility state
	 */
	setSimpleLODVisibility(visible) {
		this.simpleLODMeshes.forEach(function(mesh) {
			mesh.visible = visible;
		});
	}

	/**
	 * Step LOD6) Clear simple LOD meshes
	 */
	clearSimpleLODMeshes() {
		var self = this;
		this.simpleLODMeshes.forEach(function(mesh, key) {
			self.scene.remove(mesh);
			mesh.geometry.dispose();
			mesh.material.dispose();
		});
		this.simpleLODMeshes.clear();
		this.simpleLODNextIndex.clear();
		this.simpleLODCounts.clear();
	}
}
