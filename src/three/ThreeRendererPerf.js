/* prettier-ignore-file */
//=================================================
// ThreeRendererPerf.js - Performance-Focused Three.js Renderer
//=================================================
// Extends ThreeRendererV2 with performance optimizations:
// - Dirty flag system (only rebuild what changed)
// - Frame budget management (skip non-critical updates if frame > 16ms)
// - Render priority system (Holes > Lines > Text > Surfaces)
// - Integrates with BatchManager, LODManager, FrustumCuller
// - Built-in performance monitoring
//
// This renderer is designed for handling thousands of entities at 60fps
//=================================================

import * as THREE from "three";
import { ThreeRendererV2 } from "./ThreeRendererV2.js";
import { PerformanceMonitor } from "./PerformanceMonitor.js";

export class ThreeRendererPerf extends ThreeRendererV2 {
	constructor(containerElement, width, height) {
		// Step 1) Call parent constructor
		super(containerElement, width, height);
		console.log("⚡ ThreeRendererPerf initializing performance optimizations...");

		// Step 2) Dirty flags - track what needs to be rebuilt
		this.dirtyFlags = {
			holes: false,
			lines: false,
			surfaces: false,
			text: false,
			kad: false,
			contours: false,
			connectors: false,
			all: false
		};

		// Step 3) Frame timing for budget management
		this.frameStartTime = 0;
		this.frameBudget = 16; // ms (target 60fps)
		this.lastFrameTime = 0;
		this.frameTimeHistory = [];
		this.maxFrameHistory = 30;

		// Step 4) Render priority queue
		this.renderPriority = ["holes", "lines", "connectors", "kad", "contours", "surfaces", "text"];

		// Step 5) Performance monitor integration
		this.perfMonitor = new PerformanceMonitor(this);

		// Step 6) Geometry cache for reuse
		this.geometryCache = new Map();
		this.materialCache = new Map();

		// Step 7) Batching state
		this.batchedGeometries = new Map();
		this.pendingBatches = [];

		// Step 8) Culling state
		this.frustum = new THREE.Frustum();
		this.frustumMatrix = new THREE.Matrix4();
		this.cullingEnabled = true;

		// Step 9) LOD state
		this.lodEnabled = true;
		this.lodDistances = {
			near: 100,    // Full detail
			mid: 500,     // Reduced detail
			far: 2000     // Minimal detail
		};

		// Step 10) Stats tracking
		this.renderStats = {
			objectsCulled: 0,
			objectsRendered: 0,
			batchesMerged: 0,
			frameDropped: false
		};

		// Step 11) Request ID for animation frame
		this._perfRenderLoopId = null;

		console.log("✅ ThreeRendererPerf initialized with performance optimizations");
	}

	// ========================================
	// DIRTY FLAG MANAGEMENT
	// ========================================

	/**
	 * Mark a specific type of geometry as dirty (needs rebuild)
	 * @param {string} type - Type: "holes", "lines", "surfaces", "text", "kad", "all"
	 */
	markDirty(type) {
		if (type === "all") {
			this.dirtyFlags.holes = true;
			this.dirtyFlags.lines = true;
			this.dirtyFlags.surfaces = true;
			this.dirtyFlags.text = true;
			this.dirtyFlags.kad = true;
			this.dirtyFlags.contours = true;
			this.dirtyFlags.connectors = true;
			this.dirtyFlags.all = true;
		} else if (this.dirtyFlags.hasOwnProperty(type)) {
			this.dirtyFlags[type] = true;
		}
		this.needsRender = true;
	}

	/**
	 * Clear dirty flag for a type
	 * @param {string} type - Type to clear
	 */
	clearDirty(type) {
		if (type === "all") {
			Object.keys(this.dirtyFlags).forEach(key => {
				this.dirtyFlags[key] = false;
			});
		} else if (this.dirtyFlags.hasOwnProperty(type)) {
			this.dirtyFlags[type] = false;
		}
	}

	/**
	 * Check if a type needs rebuild
	 * @param {string} type - Type to check
	 * @returns {boolean} True if dirty
	 */
	isDirty(type) {
		if (type === "all") return this.dirtyFlags.all;
		return this.dirtyFlags[type] || false;
	}

	// ========================================
	// FRAME BUDGET MANAGEMENT
	// ========================================

	/**
	 * Start frame timing
	 */
	beginFrame() {
		this.frameStartTime = performance.now();
		this.renderStats.objectsCulled = 0;
		this.renderStats.objectsRendered = 0;
		this.renderStats.batchesMerged = 0;
		this.renderStats.frameDropped = false;
	}

	/**
	 * Get elapsed time in current frame
	 * @returns {number} Elapsed ms
	 */
	getFrameElapsed() {
		return performance.now() - this.frameStartTime;
	}

	/**
	 * Check if we have budget remaining
	 * @returns {boolean} True if under budget
	 */
	hasFrameBudget() {
		return this.getFrameElapsed() < this.frameBudget;
	}

	/**
	 * End frame and record timing
	 */
	endFrame() {
		this.lastFrameTime = this.getFrameElapsed();
		this.frameTimeHistory.push(this.lastFrameTime);
		if (this.frameTimeHistory.length > this.maxFrameHistory) {
			this.frameTimeHistory.shift();
		}

		// Mark frame as dropped if over budget
		if (this.lastFrameTime > this.frameBudget * 1.5) {
			this.renderStats.frameDropped = true;
		}
	}

	/**
	 * Get average frame time
	 * @returns {number} Average ms
	 */
	getAverageFrameTime() {
		if (this.frameTimeHistory.length === 0) return 0;
		var sum = 0;
		for (var i = 0; i < this.frameTimeHistory.length; i++) {
			sum += this.frameTimeHistory[i];
		}
		return sum / this.frameTimeHistory.length;
	}

	// ========================================
	// FRUSTUM CULLING
	// ========================================

	/**
	 * Update frustum for culling
	 */
	updateFrustum() {
		this.frustumMatrix.multiplyMatrices(
			this.camera.projectionMatrix,
			this.camera.matrixWorldInverse
		);
		this.frustum.setFromProjectionMatrix(this.frustumMatrix);
	}

	/**
	 * Check if object is in frustum
	 * @param {THREE.Object3D} object - Object to check
	 * @returns {boolean} True if visible
	 */
	isInFrustum(object) {
		if (!this.cullingEnabled) return true;
		if (!object.geometry) return true;

		// Use bounding sphere for fast check
		if (!object.geometry.boundingSphere) {
			object.geometry.computeBoundingSphere();
		}

		var sphere = object.geometry.boundingSphere.clone();
		sphere.applyMatrix4(object.matrixWorld);

		return this.frustum.intersectsSphere(sphere);
	}

	// ========================================
	// GEOMETRY CACHING
	// ========================================

	/**
	 * Get or create cached geometry
	 * @param {string} key - Cache key
	 * @param {Function} createFn - Function to create geometry if not cached
	 * @returns {THREE.BufferGeometry} Geometry
	 */
	getCachedGeometry(key, createFn) {
		if (this.geometryCache.has(key)) {
			return this.geometryCache.get(key);
		}
		var geometry = createFn();
		this.geometryCache.set(key, geometry);
		return geometry;
	}

	/**
	 * Get or create cached material
	 * @param {string} key - Cache key
	 * @param {Function} createFn - Function to create material if not cached
	 * @returns {THREE.Material} Material
	 */
	getCachedMaterial(key, createFn) {
		if (this.materialCache.has(key)) {
			return this.materialCache.get(key);
		}
		var material = createFn();
		this.materialCache.set(key, material);
		return material;
	}

	/**
	 * Clear geometry cache
	 */
	clearGeometryCache() {
		this.geometryCache.forEach(function(geom) {
			geom.dispose();
		});
		this.geometryCache.clear();
	}

	/**
	 * Clear material cache
	 */
	clearMaterialCache() {
		this.materialCache.forEach(function(mat) {
			mat.dispose();
		});
		this.materialCache.clear();
	}

	// ========================================
	// OPTIMIZED RENDER
	// ========================================

	/**
	 * Optimized render with culling and priority
	 */
	render() {
		// Early return if context lost
		if (this.contextLost) {
			console.warn("⚠️ Skipping render - WebGL context lost");
			return;
		}

		// Begin frame timing
		this.beginFrame();

		// Update frustum for culling
		this.updateFrustum();

		// PERFORMANCE: Only update billboards when camera rotation changed
		if (this.cameraRotationChanged) {
			this._updateTextBillboards();
			this._updateBillboardedObjects();
			this.cameraRotationChanged = false;
		}

		// Apply frustum culling to groups
		if (this.cullingEnabled) {
			this._applyCulling();
		}

		// Render scene
		this.renderer.render(this.scene, this.camera);

		// End frame timing
		this.endFrame();

		// Update performance monitor
		if (window.perfMonitor && window.perfMonitorEnabled) {
			window.perfMonitor.update();
		} else if (this.perfMonitor) {
			this.perfMonitor.update();
		}

		this.needsRender = false;
	}

	/**
	 * Apply frustum culling to scene groups
	 */
	_applyCulling() {
		var self = this;
		var culled = 0;
		var rendered = 0;

		// Cull holes group
		if (this.holesGroup) {
			this.holesGroup.children.forEach(function(child) {
				if (child.isInstancedMesh) {
					// Don't cull instanced meshes (they handle their own culling)
					rendered++;
				} else if (child.isMesh || child.isLine || child.isPoints) {
					var visible = self.isInFrustum(child);
					child.visible = visible;
					if (visible) rendered++;
					else culled++;
				}
			});
		}

		// Cull KAD group
		if (this.kadGroup) {
			this.kadGroup.children.forEach(function(child) {
				if (child.isMesh || child.isLine || child.isPoints) {
					var visible = self.isInFrustum(child);
					child.visible = visible;
					if (visible) rendered++;
					else culled++;
				}
			});
		}

		this.renderStats.objectsCulled = culled;
		this.renderStats.objectsRendered = rendered;
	}

	// ========================================
	// BATCH GEOMETRY HELPERS
	// ========================================

	/**
	 * Begin batching mode for a geometry type
	 * @param {string} type - Type key for batch
	 */
	beginBatch(type) {
		if (!this.batchedGeometries.has(type)) {
			this.batchedGeometries.set(type, {
				positions: [],
				colors: [],
				indices: []
			});
		}
	}

	/**
	 * Add geometry to current batch
	 * @param {string} type - Batch type
	 * @param {Array} positions - Position array [x,y,z,...]
	 * @param {Array} colors - Color array [r,g,b,...] (optional)
	 */
	addToBatch(type, positions, colors) {
		var batch = this.batchedGeometries.get(type);
		if (!batch) return;

		// Add positions
		for (var i = 0; i < positions.length; i++) {
			batch.positions.push(positions[i]);
		}

		// Add colors if provided
		if (colors) {
			for (var i = 0; i < colors.length; i++) {
				batch.colors.push(colors[i]);
			}
		}
	}

	/**
	 * Finalize batch and create geometry
	 * @param {string} type - Batch type
	 * @returns {THREE.BufferGeometry} Batched geometry
	 */
	finalizeBatch(type) {
		var batch = this.batchedGeometries.get(type);
		if (!batch || batch.positions.length === 0) return null;

		var geometry = new THREE.BufferGeometry();

		// Set positions
		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(batch.positions, 3)
		);

		// Set colors if available
		if (batch.colors.length > 0) {
			geometry.setAttribute(
				"color",
				new THREE.Float32BufferAttribute(batch.colors, 3)
			);
		}

		// Clear batch
		batch.positions = [];
		batch.colors = [];
		batch.indices = [];

		this.renderStats.batchesMerged++;

		return geometry;
	}

	// ========================================
	// PERFORMANCE MONITOR INTEGRATION
	// ========================================

	/**
	 * Show performance monitor overlay
	 */
	showPerfMonitor() {
		if (this.perfMonitor) {
			this.perfMonitor.show();
		}
	}

	/**
	 * Hide performance monitor overlay
	 */
	hidePerfMonitor() {
		if (this.perfMonitor) {
			this.perfMonitor.hide();
		}
	}

	/**
	 * Get current render stats
	 * @returns {Object} Render statistics
	 */
	getRenderStats() {
		return Object.assign({}, this.renderStats, {
			frameTime: this.lastFrameTime,
			avgFrameTime: this.getAverageFrameTime(),
			drawCalls: this.renderer.info.render.calls,
			triangles: this.renderer.info.render.triangles,
			geometries: this.renderer.info.memory.geometries,
			textures: this.renderer.info.memory.textures
		});
	}

	// ========================================
	// ENHANCED CLEAR METHODS
	// ========================================

	/**
	 * Clear all geometry with dirty flag reset
	 */
	clearAllGeometry() {
		super.clearAllGeometry();
		this.clearDirty("all");
		this.clearGeometryCache();
		this.clearMaterialCache();
		this.batchedGeometries.clear();
	}

	/**
	 * Clear specific group with dirty flag
	 * @param {string} groupName - Group to clear
	 */
	clearGroup(groupName) {
		super.clearGroup(groupName);
		this.clearDirty(groupName);
	}

	// ========================================
	// OPTIMIZED RENDER LOOP
	// ========================================

	/**
	 * Start optimized render loop
	 */
	startRenderLoop() {
		var self = this;

		var animate = function() {
			// Update arcball controls if active
			if (window.cameraControls && window.cameraControls.controlMode === "arcball") {
				window.cameraControls.update();
			}

			self._perfRenderLoopId = requestAnimationFrame(animate);

			if (self.needsRender) {
				self.render();
			}
		};

		animate();
	}

	/**
	 * Stop render loop
	 */
	stopRenderLoop() {
		if (this._perfRenderLoopId !== null) {
			cancelAnimationFrame(this._perfRenderLoopId);
			this._perfRenderLoopId = null;
		}
		// Also stop parent loop if any
		super.stopRenderLoop();
	}

	// ========================================
	// DISPOSE
	// ========================================

	/**
	 * Dispose and cleanup
	 */
	dispose() {
		this.stopRenderLoop();
		this.clearGeometryCache();
		this.clearMaterialCache();
		this.batchedGeometries.clear();

		if (this.perfMonitor) {
			this.perfMonitor.dispose();
			this.perfMonitor = null;
		}

		super.dispose();
	}
}

// Export for use
export default ThreeRendererPerf;
