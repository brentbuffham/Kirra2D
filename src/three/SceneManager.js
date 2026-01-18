/* prettier-ignore-file */
//=================================================
// SceneManager.js - Central 3D Scene Coordinator
//=================================================
// Provides a clean API for managing the 3D scene from kirra.js
// Coordinates all performance subsystems:
// - ThreeRendererPerf (or V1/V2)
// - BatchManager
// - LODManager
// - FrustumCuller
// - Individual renderers (Hole, Line, Surface, Text)
//
// This is the main interface between kirra.js and the 3D system
//=================================================

import * as THREE from "three";
import { BatchManager } from "./BatchManager.js";
import { LODManager } from "./LODManager.js";
import { FrustumCuller } from "./FrustumCuller.js";
import { PerformanceMonitor, getPerformanceMonitor } from "./PerformanceMonitor.js";

export class SceneManager {
	constructor(threeRenderer) {
		// Step 1) Store renderer reference
		this.renderer = threeRenderer;
		this.scene = threeRenderer ? threeRenderer.scene : null;
		this.camera = threeRenderer ? threeRenderer.camera : null;

		console.log("🎬 SceneManager initializing...");

		// Step 2) Initialize performance subsystems
		this.batchManager = new BatchManager(this.scene);
		this.lodManager = new LODManager(this.camera);
		this.frustumCuller = new FrustumCuller(this.camera);
		this.perfMonitor = getPerformanceMonitor(threeRenderer);

		// Step 3) Dirty flags for smart updates
		this.dirtyFlags = {
			holes: false,
			lines: false,
			polygons: false,
			points: false,
			text: false,
			surfaces: false,
			contours: false,
			connectors: false,
			images: false,
			all: false
		};

		// Step 4) Data caches - store processed data for quick rebuilds
		this.dataCache = {
			holes: [],       // Cached hole data
			kadEntities: [], // Cached KAD entities
			surfaces: [],    // Cached surface data
			contours: []     // Cached contour data
		};

		// Step 5) Configuration
		this.config = {
			useBatching: true,
			useLOD: true,
			useCulling: true,
			autoRebuild: true,          // Auto-rebuild dirty geometry
			maxBatchSize: 50000,        // Max vertices per batch
			lodDistances: {
				full: 100,
				medium: 500,
				low: 2000,
				culled: 5000
			}
		};

		// Step 6) Render state
		this.isRendering = false;
		this.lastRenderTime = 0;
		this.renderCount = 0;

		// Step 7) 2D/3D mode flag
		this.is3DMode = false;

		// Step 8) Initialize subsystem configurations
		this._initSubsystems();

		console.log("✅ SceneManager initialized with BatchManager, LODManager, FrustumCuller");
	}

	/**
	 * Initialize subsystem configurations
	 */
	_initSubsystems() {
		// Configure LOD distances
		this.lodManager.setDistances(
			this.config.lodDistances.full,
			this.config.lodDistances.medium,
			this.config.lodDistances.low,
			this.config.lodDistances.culled
		);

		// Configure frustum culler
		this.frustumCuller.setEnabled(this.config.useCulling);
	}

	// ========================================
	// RENDERER MANAGEMENT
	// ========================================

	/**
	 * Set renderer reference (can be called after init)
	 * @param {ThreeRenderer} threeRenderer - The renderer
	 */
	setRenderer(threeRenderer) {
		this.renderer = threeRenderer;
		this.scene = threeRenderer ? threeRenderer.scene : null;
		this.camera = threeRenderer ? threeRenderer.camera : null;

		// Update subsystems
		this.batchManager.scene = this.scene;
		this.lodManager.setCamera(this.camera);
		this.frustumCuller.setCamera(this.camera);
		this.perfMonitor.setRenderer(threeRenderer);
	}

	/**
	 * Set 3D mode active
	 * @param {boolean} active - True for 3D mode
	 */
	set3DMode(active) {
		this.is3DMode = active;

		if (this.renderer) {
			this.renderer.continuousRendering = active;
		}

		if (active) {
			console.log("🎬 SceneManager: 3D mode activated");
		} else {
			console.log("🎬 SceneManager: 2D mode activated");
		}
	}

	// ========================================
	// DIRTY FLAG MANAGEMENT
	// ========================================

	/**
	 * Mark data as dirty (needs rebuild)
	 * @param {string} type - Type: "holes", "lines", "surfaces", "all", etc.
	 */
	markDirty(type) {
		if (type === "all") {
			Object.keys(this.dirtyFlags).forEach(function(key) {
				this.dirtyFlags[key] = true;
			}, this);
		} else if (this.dirtyFlags.hasOwnProperty(type)) {
			this.dirtyFlags[type] = true;
		}

		// Propagate to renderer if it has dirty flag support
		if (this.renderer && this.renderer.markDirty) {
			this.renderer.markDirty(type);
		}
	}

	/**
	 * Clear dirty flag
	 * @param {string} type - Type to clear
	 */
	clearDirty(type) {
		if (type === "all") {
			Object.keys(this.dirtyFlags).forEach(function(key) {
				this.dirtyFlags[key] = false;
			}, this);
		} else if (this.dirtyFlags.hasOwnProperty(type)) {
			this.dirtyFlags[type] = false;
		}
	}

	/**
	 * Check if type is dirty
	 * @param {string} type - Type to check
	 * @returns {boolean} True if dirty
	 */
	isDirty(type) {
		return this.dirtyFlags[type] || false;
	}

	// ========================================
	// HOLE RENDERING
	// ========================================

	/**
	 * Update holes data and mark for rebuild
	 * @param {Array} holes - Array of hole objects
	 */
	setHolesData(holes) {
		this.dataCache.holes = holes || [];
		this.markDirty("holes");
	}

	/**
	 * Build/rebuild hole geometry using batching and instancing
	 * @param {THREE.Group} targetGroup - Group to add holes to
	 * @param {Object} options - Rendering options
	 */
	buildHoles(targetGroup, options) {
		if (!this.isDirty("holes") && !this.dirtyFlags.all) return;

		options = options || {};
		var holes = this.dataCache.holes;
		var self = this;

		console.log("🔨 SceneManager: Building " + holes.length + " holes");

		// Clear existing batch
		this.batchManager.clearType("lines");

		// Process each hole
		holes.forEach(function(hole) {
			if (!hole.visible) return;

			// Get hole positions (converted to local coords)
			var startX = hole.startXLocation - (options.originX || 0);
			var startY = hole.startYLocation - (options.originY || 0);
			var startZ = hole.startZLocation || 0;
			var endX = hole.endXLocation - (options.originX || 0);
			var endY = hole.endYLocation - (options.originY || 0);
			var endZ = hole.endZLocation || 0;

			var color = hole.colorHexDecimal || "#ff0000";
			var lineWidth = options.lineWidth || 2;

			// Add hole body line to batch
			self.batchManager.addLine(
				startX, startY, startZ,
				endX, endY, endZ,
				color, lineWidth
			);
		});

		// Flush batches to target group
		this.batchManager.flushLineBatches(targetGroup);

		this.clearDirty("holes");
	}

	// ========================================
	// LINE/KAD RENDERING
	// ========================================

	/**
	 * Update KAD entities data
	 * @param {Array} entities - Array of KAD entities
	 */
	setKADData(entities) {
		this.dataCache.kadEntities = entities || [];
		this.markDirty("lines");
		this.markDirty("polygons");
		this.markDirty("points");
		this.markDirty("text");
	}

	/**
	 * Build KAD geometry using batching
	 * @param {THREE.Group} targetGroup - Group to add to
	 * @param {Object} options - Rendering options
	 */
	buildKAD(targetGroup, options) {
		options = options || {};
		var entities = this.dataCache.kadEntities;
		var self = this;

		if (entities.length === 0) return;

		console.log("🔨 SceneManager: Building " + entities.length + " KAD entities");

		// Separate entities by type
		var lines = [];
		var polygons = [];
		var points = [];
		var texts = [];

		entities.forEach(function(entity) {
			if (!entity.visible) return;

			var type = entity.entityType || "point";
			switch (type) {
				case "line":
					lines.push(entity);
					break;
				case "poly":
				case "polygon":
					polygons.push(entity);
					break;
				case "point":
					points.push(entity);
					break;
				case "text":
					texts.push(entity);
					break;
			}
		});

		// Build lines with batching
		if (this.config.useBatching && lines.length > 0) {
			this._buildBatchedLines(lines, targetGroup, options);
		}

		// Build polygons
		if (polygons.length > 0) {
			this._buildBatchedPolygons(polygons, targetGroup, options);
		}

		// Build points
		if (this.config.useBatching && points.length > 0) {
			this._buildBatchedPoints(points, targetGroup, options);
		}

		this.clearDirty("lines");
		this.clearDirty("polygons");
		this.clearDirty("points");
	}

	/**
	 * Build batched lines from KAD line entities
	 */
	_buildBatchedLines(lineEntities, targetGroup, options) {
		var self = this;
		var originX = options.originX || 0;
		var originY = options.originY || 0;

		// Group lines by entityName to get connected segments
		var lineGroups = new Map();

		lineEntities.forEach(function(entity) {
			var key = entity.entityName || "default";
			if (!lineGroups.has(key)) {
				lineGroups.set(key, []);
			}
			lineGroups.get(key).push(entity);
		});

		// Process each line group
		lineGroups.forEach(function(entities, entityName) {
			if (entities.length < 2) return;

			// Sort by pointID if available
			entities.sort(function(a, b) {
				return (a.pointID || 0) - (b.pointID || 0);
			});

			// Get color from first entity
			var color = entities[0].color || "#ffffff";
			var lineWidth = entities[0].lineWidth || 2;

			// Build connected line segments
			for (var i = 0; i < entities.length - 1; i++) {
				var p1 = entities[i];
				var p2 = entities[i + 1];

				var x1 = p1.pointXLocation - originX;
				var y1 = p1.pointYLocation - originY;
				var z1 = p1.pointZLocation || 0;
				var x2 = p2.pointXLocation - originX;
				var y2 = p2.pointYLocation - originY;
				var z2 = p2.pointZLocation || 0;

				self.batchManager.addLine(x1, y1, z1, x2, y2, z2, color, lineWidth);
			}

			// Close if needed
			if (entities[0].closed && entities.length > 2) {
				var first = entities[0];
				var last = entities[entities.length - 1];
				self.batchManager.addLine(
					last.pointXLocation - originX,
					last.pointYLocation - originY,
					last.pointZLocation || 0,
					first.pointXLocation - originX,
					first.pointYLocation - originY,
					first.pointZLocation || 0,
					color, lineWidth
				);
			}
		});

		// Flush to scene
		this.batchManager.flushLineBatches(targetGroup);
	}

	/**
	 * Build batched polygons
	 */
	_buildBatchedPolygons(polygonEntities, targetGroup, options) {
		// Similar to lines but with closed flag
		var self = this;
		var originX = options.originX || 0;
		var originY = options.originY || 0;

		// Group by entityName
		var polyGroups = new Map();

		polygonEntities.forEach(function(entity) {
			var key = entity.entityName || "default";
			if (!polyGroups.has(key)) {
				polyGroups.set(key, []);
			}
			polyGroups.get(key).push(entity);
		});

		// Process each polygon
		polyGroups.forEach(function(entities, entityName) {
			if (entities.length < 2) return;

			entities.sort(function(a, b) {
				return (a.pointID || 0) - (b.pointID || 0);
			});

			var color = entities[0].color || "#ffffff";
			var lineWidth = entities[0].lineWidth || 2;

			// Build polygon outline
			for (var i = 0; i < entities.length - 1; i++) {
				var p1 = entities[i];
				var p2 = entities[i + 1];

				self.batchManager.addLine(
					p1.pointXLocation - originX,
					p1.pointYLocation - originY,
					p1.pointZLocation || 0,
					p2.pointXLocation - originX,
					p2.pointYLocation - originY,
					p2.pointZLocation || 0,
					color, lineWidth
				);
			}

			// Close polygon
			if (entities.length > 2) {
				var first = entities[0];
				var last = entities[entities.length - 1];
				self.batchManager.addLine(
					last.pointXLocation - originX,
					last.pointYLocation - originY,
					last.pointZLocation || 0,
					first.pointXLocation - originX,
					first.pointYLocation - originY,
					first.pointZLocation || 0,
					color, lineWidth
				);
			}
		});

		this.batchManager.flushLineBatches(targetGroup);
	}

	/**
	 * Build batched points
	 */
	_buildBatchedPoints(pointEntities, targetGroup, options) {
		var self = this;
		var originX = options.originX || 0;
		var originY = options.originY || 0;

		// Group by color for batching
		var colorGroups = new Map();

		pointEntities.forEach(function(entity) {
			var color = entity.color || "#ffffff";
			if (!colorGroups.has(color)) {
				colorGroups.set(color, []);
			}
			colorGroups.get(color).push({
				x: entity.pointXLocation - originX,
				y: entity.pointYLocation - originY,
				z: entity.pointZLocation || 0
			});
		});

		// Add to batch manager
		colorGroups.forEach(function(points, color) {
			self.batchManager.addPoints(points, color, 5);
		});

		this.batchManager.flushPointBatches(targetGroup);
	}

	// ========================================
	// RENDERING
	// ========================================

	/**
	 * Request a render
	 */
	requestRender() {
		if (this.renderer) {
			this.renderer.requestRender();
		}
	}

	/**
	 * Perform render with all optimizations
	 */
	render() {
		if (!this.renderer || !this.is3DMode) return;

		this.isRendering = true;
		var startTime = performance.now();

		// Update frustum culler
		if (this.config.useCulling) {
			this.frustumCuller.updateFrustum();
		}

		// Update LOD
		if (this.config.useLOD) {
			this.lodManager.update();
		}

		// Call renderer's render
		this.renderer.render();

		// Update stats
		this.lastRenderTime = performance.now() - startTime;
		this.renderCount++;
		this.isRendering = false;
	}

	/**
	 * Rebuild all dirty geometry
	 */
	rebuildDirtyGeometry() {
		if (this.dirtyFlags.all) {
			// Full rebuild needed
			this.clearAllGeometry();
		}

		// Rebuild individual types as needed
		// (Delegated to specific renderer modules)
	}

	// ========================================
	// CLEAR OPERATIONS
	// ========================================

	/**
	 * Clear all geometry
	 */
	clearAllGeometry() {
		this.batchManager.clearAll();
		this.lodManager.clearAll();
		this.frustumCuller.clearBoundsCache();

		if (this.renderer && this.renderer.clearAllGeometry) {
			this.renderer.clearAllGeometry();
		}

		this.clearDirty("all");
		console.log("🗑️ SceneManager: All geometry cleared");
	}

	/**
	 * Clear specific geometry type
	 * @param {string} type - Type to clear
	 */
	clearGeometry(type) {
		switch (type) {
			case "lines":
				this.batchManager.clearType("lines");
				break;
			case "points":
				this.batchManager.clearType("points");
				break;
			case "triangles":
				this.batchManager.clearType("triangles");
				break;
		}

		this.markDirty(type);
	}

	// ========================================
	// STATISTICS
	// ========================================

	/**
	 * Get comprehensive statistics
	 * @returns {Object} Combined stats from all subsystems
	 */
	getStats() {
		return {
			// Scene stats
			renderCount: this.renderCount,
			lastRenderTime: this.lastRenderTime.toFixed(2) + "ms",
			is3DMode: this.is3DMode,

			// Data stats
			holesCount: this.dataCache.holes.length,
			kadEntitiesCount: this.dataCache.kadEntities.length,

			// Subsystem stats
			batching: this.batchManager.getStats(),
			lod: this.lodManager.getStats(),
			culling: this.frustumCuller.getStats(),

			// Dirty flags
			dirtyFlags: Object.assign({}, this.dirtyFlags)
		};
	}

	/**
	 * Log statistics to console
	 */
	logStats() {
		var stats = this.getStats();
		console.log("📊 SceneManager Stats:");
		console.log("  Render count:", stats.renderCount);
		console.log("  Last render:", stats.lastRenderTime);
		console.log("  Holes:", stats.holesCount);
		console.log("  KAD entities:", stats.kadEntitiesCount);
		console.log("  Batching:", stats.batching);
		console.log("  LOD:", stats.lod);
		console.log("  Culling:", stats.culling);
	}

	// ========================================
	// CONFIGURATION
	// ========================================

	/**
	 * Set configuration option
	 * @param {string} key - Config key
	 * @param {any} value - Config value
	 */
	setConfig(key, value) {
		if (this.config.hasOwnProperty(key)) {
			this.config[key] = value;

			// Apply config changes to subsystems
			if (key === "useCulling") {
				this.frustumCuller.setEnabled(value);
			}
		}
	}

	/**
	 * Get configuration
	 * @returns {Object} Current config
	 */
	getConfig() {
		return Object.assign({}, this.config);
	}

	// ========================================
	// DISPOSE
	// ========================================

	/**
	 * Dispose and cleanup all resources
	 */
	dispose() {
		console.log("🎬 SceneManager disposing...");

		this.batchManager.dispose();
		this.lodManager.dispose();
		this.frustumCuller.dispose();

		this.dataCache.holes = [];
		this.dataCache.kadEntities = [];
		this.dataCache.surfaces = [];
		this.dataCache.contours = [];

		this.renderer = null;
		this.scene = null;
		this.camera = null;

		console.log("✅ SceneManager disposed");
	}
}

// Export singleton creator
var _sceneManagerInstance = null;

export function getSceneManager(threeRenderer) {
	if (!_sceneManagerInstance) {
		_sceneManagerInstance = new SceneManager(threeRenderer);
	} else if (threeRenderer) {
		_sceneManagerInstance.setRenderer(threeRenderer);
	}
	return _sceneManagerInstance;
}

export default SceneManager;
