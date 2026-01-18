/* prettier-ignore-file */
//=================================================
// FrustumCuller.js - View Frustum Culling System
//=================================================
// Efficiently culls objects outside the camera's view frustum
// Key features:
// - Pre-computed bounding boxes for groups
// - Fast frustum intersection tests
// - Spatial indexing with quadtree for large datasets
// - Support for instanced mesh culling
//
// This reduces GPU workload by not submitting off-screen geometry
//=================================================

import * as THREE from "three";

export class FrustumCuller {
	constructor(camera) {
		// Step 1) Store camera reference
		this.camera = camera;

		// Step 2) Frustum for culling tests
		this.frustum = new THREE.Frustum();
		this.frustumMatrix = new THREE.Matrix4();

		// Step 3) Bounding box/sphere caches
		this.boundingBoxCache = new Map();  // objectId -> THREE.Box3
		this.boundingSphereCache = new Map();  // objectId -> THREE.Sphere

		// Step 4) Quadtree for spatial indexing (2D XY plane)
		this.useQuadtree = false;
		this.quadtree = null;
		this.quadtreeBounds = null;

		// Step 5) Statistics
		this.stats = {
			objectsTested: 0,
			objectsCulled: 0,
			objectsVisible: 0,
			lastUpdateTime: 0,
			quadtreeNodes: 0
		};

		// Step 6) Configuration
		this.config = {
			enabled: true,
			useBoundingSpheres: true,  // Spheres are faster than boxes
			updateFrequency: 1,        // Update every N frames
			minObjectSize: 0.1         // Skip objects smaller than this
		};

		// Step 7) Frame counter for update frequency
		this.frameCounter = 0;

		// Step 8) Reusable objects to reduce GC
		this._tempBox = new THREE.Box3();
		this._tempSphere = new THREE.Sphere();
		this._tempVec3 = new THREE.Vector3();

		console.log("✂️ FrustumCuller initialized");
	}

	// ========================================
	// FRUSTUM MANAGEMENT
	// ========================================

	/**
	 * Update the view frustum from camera
	 */
	updateFrustum() {
		if (!this.camera) return;

		// Make sure camera matrices are up to date
		this.camera.updateMatrixWorld();
		this.camera.updateProjectionMatrix();

		// Compute frustum from camera projection
		this.frustumMatrix.multiplyMatrices(
			this.camera.projectionMatrix,
			this.camera.matrixWorldInverse
		);
		this.frustum.setFromProjectionMatrix(this.frustumMatrix);
	}

	/**
	 * Set camera reference
	 * @param {THREE.Camera} camera - New camera
	 */
	setCamera(camera) {
		this.camera = camera;
		this.updateFrustum();
	}

	// ========================================
	// BOUNDING VOLUME MANAGEMENT
	// ========================================

	/**
	 * Compute or get cached bounding box for object
	 * @param {THREE.Object3D} object - Object to get bounds for
	 * @param {string} objectId - Cache key (optional)
	 * @returns {THREE.Box3} Bounding box
	 */
	getBoundingBox(object, objectId) {
		// Check cache first
		if (objectId && this.boundingBoxCache.has(objectId)) {
			return this.boundingBoxCache.get(objectId);
		}

		// Compute bounding box
		this._tempBox.setFromObject(object);

		// Cache if ID provided
		if (objectId) {
			var cachedBox = this._tempBox.clone();
			this.boundingBoxCache.set(objectId, cachedBox);
			return cachedBox;
		}

		return this._tempBox;
	}

	/**
	 * Compute or get cached bounding sphere for object
	 * @param {THREE.Object3D} object - Object to get bounds for
	 * @param {string} objectId - Cache key (optional)
	 * @returns {THREE.Sphere} Bounding sphere
	 */
	getBoundingSphere(object, objectId) {
		// Check cache first
		if (objectId && this.boundingSphereCache.has(objectId)) {
			return this.boundingSphereCache.get(objectId);
		}

		// Compute from bounding box
		var box = this.getBoundingBox(object, objectId);
		box.getBoundingSphere(this._tempSphere);

		// Cache if ID provided
		if (objectId) {
			var cachedSphere = this._tempSphere.clone();
			this.boundingSphereCache.set(objectId, cachedSphere);
			return cachedSphere;
		}

		return this._tempSphere;
	}

	/**
	 * Invalidate cached bounds for an object
	 * @param {string} objectId - Object ID to invalidate
	 */
	invalidateBounds(objectId) {
		this.boundingBoxCache.delete(objectId);
		this.boundingSphereCache.delete(objectId);
	}

	/**
	 * Clear all cached bounds
	 */
	clearBoundsCache() {
		this.boundingBoxCache.clear();
		this.boundingSphereCache.clear();
	}

	// ========================================
	// CULLING TESTS
	// ========================================

	/**
	 * Test if a point is inside the frustum
	 * @param {THREE.Vector3|Object} point - Point to test
	 * @returns {boolean} True if inside frustum
	 */
	isPointInFrustum(point) {
		if (point instanceof THREE.Vector3) {
			this._tempVec3.copy(point);
		} else {
			this._tempVec3.set(point.x || 0, point.y || 0, point.z || 0);
		}
		return this.frustum.containsPoint(this._tempVec3);
	}

	/**
	 * Test if a bounding sphere intersects the frustum
	 * @param {THREE.Sphere} sphere - Sphere to test
	 * @returns {boolean} True if intersects
	 */
	isSphereInFrustum(sphere) {
		return this.frustum.intersectsSphere(sphere);
	}

	/**
	 * Test if a bounding box intersects the frustum
	 * @param {THREE.Box3} box - Box to test
	 * @returns {boolean} True if intersects
	 */
	isBoxInFrustum(box) {
		return this.frustum.intersectsBox(box);
	}

	/**
	 * Test if an object is in the frustum
	 * @param {THREE.Object3D} object - Object to test
	 * @param {string} objectId - Cache key (optional)
	 * @returns {boolean} True if visible
	 */
	isObjectInFrustum(object, objectId) {
		if (!this.config.enabled) return true;

		// Use bounding sphere for faster test
		if (this.config.useBoundingSpheres) {
			var sphere = this.getBoundingSphere(object, objectId);
			return this.isSphereInFrustum(sphere);
		}

		// Use bounding box for more accurate test
		var box = this.getBoundingBox(object, objectId);
		return this.isBoxInFrustum(box);
	}

	/**
	 * Test if a mesh at given position/scale is visible
	 * @param {number} x - X position
	 * @param {number} y - Y position
	 * @param {number} z - Z position
	 * @param {number} radius - Approximate bounding radius
	 * @returns {boolean} True if visible
	 */
	isVisibleAt(x, y, z, radius) {
		if (!this.config.enabled) return true;
		if (radius === undefined) radius = 1;

		this._tempSphere.center.set(x, y, z);
		this._tempSphere.radius = radius;

		return this.isSphereInFrustum(this._tempSphere);
	}

	// ========================================
	// GROUP CULLING
	// ========================================

	/**
	 * Cull objects in a group, setting visibility based on frustum
	 * @param {THREE.Group} group - Group to cull
	 * @param {Function} getObjectId - Function to get object ID (optional)
	 * @returns {Object} Culling statistics
	 */
	cullGroup(group, getObjectId) {
		if (!this.config.enabled) return { tested: 0, culled: 0, visible: 0 };

		var self = this;
		var tested = 0;
		var culled = 0;
		var visible = 0;

		// Update frustum before culling
		this.updateFrustum();

		group.children.forEach(function(child, index) {
			tested++;

			// Skip non-renderable objects
			if (!child.isMesh && !child.isLine && !child.isPoints && !child.isSprite) {
				return;
			}

			// Get object ID if provided
			var objectId = getObjectId ? getObjectId(child, index) : null;

			// Test frustum intersection
			var inFrustum = self.isObjectInFrustum(child, objectId);

			// Set visibility
			child.visible = inFrustum;

			if (inFrustum) {
				visible++;
			} else {
				culled++;
			}
		});

		// Update stats
		this.stats.objectsTested = tested;
		this.stats.objectsCulled = culled;
		this.stats.objectsVisible = visible;

		return { tested: tested, culled: culled, visible: visible };
	}

	/**
	 * Cull multiple groups at once
	 * @param {Array<THREE.Group>} groups - Array of groups to cull
	 */
	cullGroups(groups) {
		var self = this;
		var totalStats = { tested: 0, culled: 0, visible: 0 };

		// Update frustum once
		this.updateFrustum();

		groups.forEach(function(group) {
			if (!group) return;

			var stats = self.cullGroup(group);
			totalStats.tested += stats.tested;
			totalStats.culled += stats.culled;
			totalStats.visible += stats.visible;
		});

		return totalStats;
	}

	// ========================================
	// INSTANCED MESH CULLING
	// ========================================

	/**
	 * Update visibility for instanced mesh instances
	 * Note: Three.js InstancedMesh doesn't support per-instance culling directly
	 * This method provides info for custom culling implementations
	 * @param {THREE.InstancedMesh} instancedMesh - Instanced mesh
	 * @param {Function} getInstancePosition - Function(instanceIndex) returns {x,y,z}
	 * @param {number} instanceRadius - Bounding radius per instance
	 * @returns {Array<boolean>} Array of visibility flags per instance
	 */
	getInstanceVisibility(instancedMesh, getInstancePosition, instanceRadius) {
		if (!this.config.enabled) return null;
		if (instanceRadius === undefined) instanceRadius = 1;

		var visibilityArray = [];
		var count = instancedMesh.count;

		// Update frustum
		this.updateFrustum();

		for (var i = 0; i < count; i++) {
			var pos = getInstancePosition(i);
			var visible = this.isVisibleAt(pos.x, pos.y, pos.z, instanceRadius);
			visibilityArray.push(visible);
		}

		return visibilityArray;
	}

	// ========================================
	// QUADTREE SPATIAL INDEXING
	// ========================================

	/**
	 * Initialize quadtree for spatial queries
	 * @param {number} minX - Min X bound
	 * @param {number} minY - Min Y bound
	 * @param {number} maxX - Max X bound
	 * @param {number} maxY - Max Y bound
	 * @param {number} maxDepth - Maximum tree depth (default 8)
	 */
	initQuadtree(minX, minY, maxX, maxY, maxDepth) {
		if (maxDepth === undefined) maxDepth = 8;

		this.quadtreeBounds = {
			minX: minX,
			minY: minY,
			maxX: maxX,
			maxY: maxY
		};

		// Simple quadtree implementation
		this.quadtree = {
			bounds: this.quadtreeBounds,
			objects: [],
			children: null,
			depth: 0,
			maxDepth: maxDepth,
			maxObjects: 10
		};

		this.useQuadtree = true;
		console.log("✂️ Quadtree initialized with bounds:", this.quadtreeBounds);
	}

	/**
	 * Insert object into quadtree
	 * @param {Object} data - Object data with x, y properties
	 */
	quadtreeInsert(data) {
		if (!this.quadtree || !this.useQuadtree) return;
		this._insertIntoNode(this.quadtree, data);
	}

	/**
	 * Internal: Insert into quadtree node
	 */
	_insertIntoNode(node, data) {
		// If node has children, insert into appropriate child
		if (node.children) {
			var index = this._getQuadrantIndex(node, data.x, data.y);
			if (index !== -1) {
				this._insertIntoNode(node.children[index], data);
				return;
			}
		}

		// Add to this node
		node.objects.push(data);

		// Split if needed
		if (node.objects.length > node.maxObjects && node.depth < node.maxDepth) {
			if (!node.children) {
				this._splitNode(node);
			}

			// Redistribute objects
			var self = this;
			var objects = node.objects;
			node.objects = [];

			objects.forEach(function(obj) {
				var index = self._getQuadrantIndex(node, obj.x, obj.y);
				if (index !== -1) {
					self._insertIntoNode(node.children[index], obj);
				} else {
					node.objects.push(obj);
				}
			});
		}
	}

	/**
	 * Internal: Split quadtree node into 4 children
	 */
	_splitNode(node) {
		var midX = (node.bounds.minX + node.bounds.maxX) / 2;
		var midY = (node.bounds.minY + node.bounds.maxY) / 2;

		node.children = [
			// NE
			{
				bounds: { minX: midX, minY: midY, maxX: node.bounds.maxX, maxY: node.bounds.maxY },
				objects: [],
				children: null,
				depth: node.depth + 1,
				maxDepth: node.maxDepth,
				maxObjects: node.maxObjects
			},
			// NW
			{
				bounds: { minX: node.bounds.minX, minY: midY, maxX: midX, maxY: node.bounds.maxY },
				objects: [],
				children: null,
				depth: node.depth + 1,
				maxDepth: node.maxDepth,
				maxObjects: node.maxObjects
			},
			// SW
			{
				bounds: { minX: node.bounds.minX, minY: node.bounds.minY, maxX: midX, maxY: midY },
				objects: [],
				children: null,
				depth: node.depth + 1,
				maxDepth: node.maxDepth,
				maxObjects: node.maxObjects
			},
			// SE
			{
				bounds: { minX: midX, minY: node.bounds.minY, maxX: node.bounds.maxX, maxY: midY },
				objects: [],
				children: null,
				depth: node.depth + 1,
				maxDepth: node.maxDepth,
				maxObjects: node.maxObjects
			}
		];

		this.stats.quadtreeNodes += 4;
	}

	/**
	 * Internal: Get quadrant index for a point
	 */
	_getQuadrantIndex(node, x, y) {
		var midX = (node.bounds.minX + node.bounds.maxX) / 2;
		var midY = (node.bounds.minY + node.bounds.maxY) / 2;

		var top = y > midY;
		var right = x > midX;

		if (top && right) return 0;  // NE
		if (top && !right) return 1; // NW
		if (!top && !right) return 2; // SW
		if (!top && right) return 3; // SE

		return -1;
	}

	/**
	 * Query quadtree for objects in a rectangular area
	 * @param {number} minX - Query min X
	 * @param {number} minY - Query min Y
	 * @param {number} maxX - Query max X
	 * @param {number} maxY - Query max Y
	 * @returns {Array} Objects in the area
	 */
	quadtreeQuery(minX, minY, maxX, maxY) {
		if (!this.quadtree || !this.useQuadtree) return [];

		var results = [];
		this._queryNode(this.quadtree, minX, minY, maxX, maxY, results);
		return results;
	}

	/**
	 * Internal: Query a quadtree node
	 */
	_queryNode(node, minX, minY, maxX, maxY, results) {
		// Check if query intersects this node
		if (maxX < node.bounds.minX || minX > node.bounds.maxX ||
			maxY < node.bounds.minY || minY > node.bounds.maxY) {
			return;
		}

		// Add objects from this node
		var self = this;
		node.objects.forEach(function(obj) {
			if (obj.x >= minX && obj.x <= maxX && obj.y >= minY && obj.y <= maxY) {
				results.push(obj);
			}
		});

		// Query children
		if (node.children) {
			node.children.forEach(function(child) {
				self._queryNode(child, minX, minY, maxX, maxY, results);
			});
		}
	}

	/**
	 * Clear quadtree
	 */
	clearQuadtree() {
		this.quadtree = null;
		this.quadtreeBounds = null;
		this.useQuadtree = false;
		this.stats.quadtreeNodes = 0;
	}

	// ========================================
	// UTILITY METHODS
	// ========================================

	/**
	 * Enable/disable culling
	 * @param {boolean} enabled - Enable flag
	 */
	setEnabled(enabled) {
		this.config.enabled = enabled;
	}

	/**
	 * Get statistics
	 * @returns {Object} Culling statistics
	 */
	getStats() {
		return {
			enabled: this.config.enabled,
			objectsTested: this.stats.objectsTested,
			objectsCulled: this.stats.objectsCulled,
			objectsVisible: this.stats.objectsVisible,
			cullRate: this.stats.objectsTested > 0
				? ((this.stats.objectsCulled / this.stats.objectsTested) * 100).toFixed(1) + "%"
				: "0%",
			cachedBoxes: this.boundingBoxCache.size,
			cachedSpheres: this.boundingSphereCache.size,
			quadtreeEnabled: this.useQuadtree,
			quadtreeNodes: this.stats.quadtreeNodes
		};
	}

	/**
	 * Dispose and cleanup
	 */
	dispose() {
		this.clearBoundsCache();
		this.clearQuadtree();
		this.camera = null;
		console.log("✂️ FrustumCuller disposed");
	}
}

export default FrustumCuller;
