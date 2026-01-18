/* prettier-ignore-file */
//=================================================
// LODManager.js - Level of Detail Management
//=================================================
// Manages level of detail for 3D objects to improve performance
// Key features:
// - Distance-based detail levels for holes (full detail near, circles far)
// - Point cloud decimation at distance
// - Text visibility culling by zoom level
// - Automatic LOD switching based on camera distance
//
// LOD Levels:
// - FULL: All geometry details (near camera)
// - MEDIUM: Reduced geometry (mid distance)
// - LOW: Minimal geometry (far distance)
// - CULLED: Not rendered (very far)
//=================================================

import * as THREE from "three";

// Step 1) LOD level constants
export var LODLevel = {
	FULL: 0,
	MEDIUM: 1,
	LOW: 2,
	CULLED: 3
};

export class LODManager {
	constructor(camera) {
		// Step 2) Store camera reference
		this.camera = camera;

		// Step 3) Distance thresholds (in world units)
		this.distances = {
			full: 100,      // Within 100 units = full detail
			medium: 500,    // 100-500 units = medium detail
			low: 2000,      // 500-2000 units = low detail
			culled: 5000    // Beyond 5000 = culled (not rendered)
		};

		// Step 4) Configuration per object type
		this.config = {
			holes: {
				enabled: true,
				fullSegments: 32,      // Circle segments at full detail
				mediumSegments: 16,    // Circle segments at medium
				lowSegments: 8,        // Circle segments at low
				showTrackAt: "medium", // Show hole track lines at this level and higher
				showLabelAt: "full"    // Show labels only at full detail
			},
			lines: {
				enabled: true,
				decimationFactor: 2,   // Skip every Nth point at medium
				farDecimation: 4       // Skip every Nth point at low
			},
			text: {
				enabled: true,
				minScale: 0.5,         // Hide text below this zoom scale
				maxTextCount: 500      // Max text objects to render
			},
			points: {
				enabled: true,
				decimationThreshold: 10000,  // Decimate if more than this many points
				farPointSize: 1             // Point size at far distance
			}
		};

		// Step 5) Tracking state
		this.lodObjects = new Map();  // objectId -> { object, currentLOD, lodMeshes }
		this.cameraPosition = new THREE.Vector3();
		this.targetPoint = new THREE.Vector3();

		// Step 6) Geometry caches for different LOD levels
		this.geometryCache = {
			circleHigh: null,   // 32 segments
			circleMed: null,    // 16 segments
			circleLow: null     // 8 segments
		};

		// Step 7) Statistics
		this.stats = {
			fullCount: 0,
			mediumCount: 0,
			lowCount: 0,
			culledCount: 0,
			lastUpdateTime: 0
		};

		// Step 8) Initialize cached geometries
		this._initGeometryCache();

		console.log("🔭 LODManager initialized");
	}

	// ========================================
	// GEOMETRY CACHE
	// ========================================

	/**
	 * Initialize cached geometries for different LOD levels
	 */
	_initGeometryCache() {
		// High detail circle (32 segments)
		this.geometryCache.circleHigh = new THREE.CircleGeometry(1, 32);

		// Medium detail circle (16 segments)
		this.geometryCache.circleMed = new THREE.CircleGeometry(1, 16);

		// Low detail circle (8 segments)
		this.geometryCache.circleLow = new THREE.CircleGeometry(1, 8);
	}

	/**
	 * Get cached circle geometry for LOD level
	 * @param {number} level - LOD level
	 * @returns {THREE.CircleGeometry} Cached geometry
	 */
	getCircleGeometry(level) {
		switch (level) {
			case LODLevel.FULL:
				return this.geometryCache.circleHigh;
			case LODLevel.MEDIUM:
				return this.geometryCache.circleMed;
			case LODLevel.LOW:
			default:
				return this.geometryCache.circleLow;
		}
	}

	// ========================================
	// DISTANCE CALCULATION
	// ========================================

	/**
	 * Set distance thresholds
	 * @param {number} full - Full detail distance
	 * @param {number} medium - Medium detail distance
	 * @param {number} low - Low detail distance
	 * @param {number} culled - Cull distance
	 */
	setDistances(full, medium, low, culled) {
		this.distances.full = full;
		this.distances.medium = medium;
		this.distances.low = low;
		this.distances.culled = culled;
	}

	/**
	 * Calculate distance from camera to a point
	 * @param {THREE.Vector3|Object} point - Point with x, y, z
	 * @returns {number} Distance
	 */
	getDistanceToCamera(point) {
		// Update camera position from current camera state
		this.cameraPosition.copy(this.camera.position);

		// Set target point
		if (point instanceof THREE.Vector3) {
			this.targetPoint.copy(point);
		} else {
			this.targetPoint.set(point.x || 0, point.y || 0, point.z || 0);
		}

		return this.cameraPosition.distanceTo(this.targetPoint);
	}

	/**
	 * Get LOD level for a distance
	 * @param {number} distance - Distance from camera
	 * @returns {number} LOD level
	 */
	getLODLevel(distance) {
		if (distance <= this.distances.full) {
			return LODLevel.FULL;
		} else if (distance <= this.distances.medium) {
			return LODLevel.MEDIUM;
		} else if (distance <= this.distances.low) {
			return LODLevel.LOW;
		} else {
			return LODLevel.CULLED;
		}
	}

	/**
	 * Get LOD level for a point
	 * @param {THREE.Vector3|Object} point - Point to check
	 * @returns {number} LOD level
	 */
	getLODLevelForPoint(point) {
		var distance = this.getDistanceToCamera(point);
		return this.getLODLevel(distance);
	}

	// ========================================
	// OBJECT REGISTRATION
	// ========================================

	/**
	 * Register an object for LOD management
	 * @param {string} objectId - Unique object ID
	 * @param {THREE.Object3D} object - The object
	 * @param {THREE.Vector3|Object} position - Object position
	 * @param {string} type - Object type: "hole", "line", "text", "point"
	 */
	registerObject(objectId, object, position, type) {
		this.lodObjects.set(objectId, {
			object: object,
			position: position,
			type: type,
			currentLOD: LODLevel.FULL,
			visible: true
		});
	}

	/**
	 * Unregister an object
	 * @param {string} objectId - Object ID to remove
	 */
	unregisterObject(objectId) {
		this.lodObjects.delete(objectId);
	}

	/**
	 * Clear all registered objects
	 */
	clearAll() {
		this.lodObjects.clear();
		this.stats.fullCount = 0;
		this.stats.mediumCount = 0;
		this.stats.lowCount = 0;
		this.stats.culledCount = 0;
	}

	// ========================================
	// LOD UPDATE
	// ========================================

	/**
	 * Update LOD for all registered objects
	 */
	update() {
		var startTime = performance.now();
		var self = this;

		// Reset stats
		this.stats.fullCount = 0;
		this.stats.mediumCount = 0;
		this.stats.lowCount = 0;
		this.stats.culledCount = 0;

		// Update each registered object
		this.lodObjects.forEach(function(data, objectId) {
			var newLOD = self.getLODLevelForPoint(data.position);

			// Update stats
			switch (newLOD) {
				case LODLevel.FULL:
					self.stats.fullCount++;
					break;
				case LODLevel.MEDIUM:
					self.stats.mediumCount++;
					break;
				case LODLevel.LOW:
					self.stats.lowCount++;
					break;
				case LODLevel.CULLED:
					self.stats.culledCount++;
					break;
			}

			// Skip if LOD hasn't changed
			if (data.currentLOD === newLOD) return;

			// Apply LOD change
			self._applyLOD(data, newLOD);
			data.currentLOD = newLOD;
		});

		this.stats.lastUpdateTime = performance.now() - startTime;
	}

	/**
	 * Apply LOD level to an object
	 * @param {Object} data - LOD object data
	 * @param {number} level - New LOD level
	 */
	_applyLOD(data, level) {
		var object = data.object;
		var type = data.type;

		switch (type) {
			case "hole":
				this._applyHoleLOD(object, level);
				break;
			case "text":
				this._applyTextLOD(object, level);
				break;
			case "line":
				this._applyLineLOD(object, level);
				break;
			case "point":
				this._applyPointLOD(object, level);
				break;
			default:
				// Default: just toggle visibility
				object.visible = (level !== LODLevel.CULLED);
		}
	}

	/**
	 * Apply LOD to a hole object
	 * @param {THREE.Object3D} hole - Hole group/mesh
	 * @param {number} level - LOD level
	 */
	_applyHoleLOD(hole, level) {
		if (!this.config.holes.enabled) return;

		if (level === LODLevel.CULLED) {
			hole.visible = false;
			return;
		}

		hole.visible = true;

		// Traverse hole children and adjust based on LOD
		hole.traverse(function(child) {
			// Handle text labels
			if (child.userData && child.userData.isTroikaText) {
				child.visible = (level === LODLevel.FULL);
			}

			// Handle track lines (collar-to-toe lines)
			if (child.isLine) {
				child.visible = (level <= LODLevel.MEDIUM);
			}
		});
	}

	/**
	 * Apply LOD to text object
	 * @param {THREE.Object3D} text - Text object
	 * @param {number} level - LOD level
	 */
	_applyTextLOD(text, level) {
		if (!this.config.text.enabled) return;

		// Text only visible at full detail
		text.visible = (level === LODLevel.FULL);
	}

	/**
	 * Apply LOD to line object
	 * @param {THREE.Object3D} line - Line object
	 * @param {number} level - LOD level
	 */
	_applyLineLOD(line, level) {
		if (!this.config.lines.enabled) return;

		if (level === LODLevel.CULLED) {
			line.visible = false;
			return;
		}

		line.visible = true;

		// Could implement line decimation here if needed
		// For now, just toggle visibility
	}

	/**
	 * Apply LOD to point object
	 * @param {THREE.Object3D} point - Point object
	 * @param {number} level - LOD level
	 */
	_applyPointLOD(point, level) {
		if (!this.config.points.enabled) return;

		if (level === LODLevel.CULLED) {
			point.visible = false;
			return;
		}

		point.visible = true;

		// Adjust point size based on distance
		if (point.material && point.material.size !== undefined) {
			if (level === LODLevel.LOW) {
				point.material.size = this.config.points.farPointSize;
			}
		}
	}

	// ========================================
	// UTILITY METHODS
	// ========================================

	/**
	 * Get circle segments for LOD level
	 * @param {number} level - LOD level
	 * @returns {number} Number of segments
	 */
	getCircleSegments(level) {
		switch (level) {
			case LODLevel.FULL:
				return this.config.holes.fullSegments;
			case LODLevel.MEDIUM:
				return this.config.holes.mediumSegments;
			case LODLevel.LOW:
			default:
				return this.config.holes.lowSegments;
		}
	}

	/**
	 * Check if text should be visible at current zoom
	 * @param {number} scale - Current zoom scale
	 * @returns {boolean} True if text should be visible
	 */
	shouldShowText(scale) {
		return scale >= this.config.text.minScale;
	}

	/**
	 * Get decimation factor for lines at given LOD
	 * @param {number} level - LOD level
	 * @returns {number} Decimation factor (1 = no decimation)
	 */
	getLineDecimation(level) {
		if (!this.config.lines.enabled) return 1;

		switch (level) {
			case LODLevel.FULL:
				return 1;
			case LODLevel.MEDIUM:
				return this.config.lines.decimationFactor;
			case LODLevel.LOW:
				return this.config.lines.farDecimation;
			default:
				return 1;
		}
	}

	/**
	 * Get statistics
	 * @returns {Object} LOD statistics
	 */
	getStats() {
		return {
			totalObjects: this.lodObjects.size,
			fullDetail: this.stats.fullCount,
			mediumDetail: this.stats.mediumCount,
			lowDetail: this.stats.lowCount,
			culled: this.stats.culledCount,
			updateTime: this.stats.lastUpdateTime.toFixed(2) + "ms"
		};
	}

	/**
	 * Set camera reference
	 * @param {THREE.Camera} camera - New camera
	 */
	setCamera(camera) {
		this.camera = camera;
	}

	/**
	 * Dispose and cleanup
	 */
	dispose() {
		// Dispose cached geometries
		if (this.geometryCache.circleHigh) this.geometryCache.circleHigh.dispose();
		if (this.geometryCache.circleMed) this.geometryCache.circleMed.dispose();
		if (this.geometryCache.circleLow) this.geometryCache.circleLow.dispose();

		this.lodObjects.clear();
		this.camera = null;

		console.log("🔭 LODManager disposed");
	}
}

export default LODManager;
