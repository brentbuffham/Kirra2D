/* prettier-ignore-file */
//=================================================
// LODManager.js - Level of Detail Management for 3D Scene
//=================================================
// Automatically adjusts rendering detail based on camera distance/zoom
// Provides smooth transitions between detail levels
// Optimizes performance for large datasets

import * as THREE from "three";

/**
 * LOD Level definitions
 * @typedef {Object} LODLevel
 * @property {string} name - Level name
 * @property {number} zoomThreshold - Minimum zoom level for this LOD
 * @property {number} maxTriangles - Maximum triangles to render
 * @property {number} lineDetail - Line simplification factor (1.0 = full, 0.1 = 10%)
 * @property {number} pointSize - Point size multiplier
 * @property {boolean} showText - Whether to show text labels
 * @property {boolean} showDetails - Whether to show detailed geometry
 */

// Step 1) LOD Level configurations
const LOD_LEVELS = {
	FULL: {
		name: "FULL",
		zoomThreshold: 2.0,      // zoom >= 2.0
		maxTriangles: Infinity,
		lineDetail: 1.0,
		pointSize: 1.0,
		showText: true,
		showDetails: true
	},
	HIGH: {
		name: "HIGH",
		zoomThreshold: 0.5,      // zoom >= 0.5
		maxTriangles: 200000,
		lineDetail: 1.0,
		pointSize: 1.0,
		showText: true,
		showDetails: true
	},
	MEDIUM: {
		name: "MEDIUM",
		zoomThreshold: 0.1,      // zoom >= 0.1
		maxTriangles: 100000,
		lineDetail: 0.5,
		pointSize: 1.5,
		showText: true,
		showDetails: false
	},
	LOW: {
		name: "LOW",
		zoomThreshold: 0.02,     // zoom >= 0.02
		maxTriangles: 50000,
		lineDetail: 0.25,
		pointSize: 2.0,
		showText: false,
		showDetails: false
	},
	MINIMAL: {
		name: "MINIMAL",
		zoomThreshold: 0,        // zoom < 0.02
		maxTriangles: 10000,
		lineDetail: 0.1,
		pointSize: 3.0,
		showText: false,
		showDetails: false
	}
};

export class LODManager {
	constructor(renderer) {
		// Step 2) Store renderer reference
		this.renderer = renderer;
		this.camera = renderer ? renderer.camera : null;

		// Step 3) Current LOD state
		this.currentLODLevel = LOD_LEVELS.FULL;
		this.previousLODLevel = null;

		// Step 4) LOD objects storage
		// Maps object ID to LOD versions: { id: { FULL: Object3D, MEDIUM: Object3D, LOW: Object3D } }
		this.lodObjects = new Map();

		// Step 5) Callback for LOD changes
		this.onLODChange = null;

		// Step 6) Performance tracking
		this.lastUpdateTime = 0;
		this.updateInterval = 100; // ms between LOD checks

		// Step 7) Enable/disable LOD
		this.enabled = true;

		// Step 8) Simplified geometry cache
		this.simplifiedGeometryCache = new Map();

		console.log("LODManager: Initialized with levels:", Object.keys(LOD_LEVELS).join(", "));
	}

	/**
	 * Step 9) Update LOD based on current camera zoom
	 * Call this from render loop or camera update
	 */
	update() {
		if (!this.enabled || !this.camera) return;

		// Step 9a) Throttle updates
		var now = performance.now();
		if (now - this.lastUpdateTime < this.updateInterval) {
			return;
		}
		this.lastUpdateTime = now;

		// Step 9b) Get current zoom level
		var zoom = this.camera.zoom || 1.0;

		// Step 9c) Determine appropriate LOD level
		var newLevel = this._getLODLevelForZoom(zoom);

		// Step 9d) Check if LOD changed
		if (newLevel !== this.currentLODLevel) {
			this.previousLODLevel = this.currentLODLevel;
			this.currentLODLevel = newLevel;

			console.log("LODManager: Level changed from " + (this.previousLODLevel ? this.previousLODLevel.name : "none") + " to " + newLevel.name + " (zoom: " + zoom.toFixed(3) + ")");

			// Step 9e) Apply LOD changes
			this._applyLODChanges();

			// Step 9f) Trigger callback
			if (this.onLODChange) {
				this.onLODChange(newLevel, this.previousLODLevel);
			}
		}
	}

	/**
	 * Step 10) Get LOD level for zoom value
	 * @param {number} zoom - Camera zoom value
	 * @returns {LODLevel} Appropriate LOD level
	 */
	_getLODLevelForZoom(zoom) {
		if (zoom >= LOD_LEVELS.FULL.zoomThreshold) return LOD_LEVELS.FULL;
		if (zoom >= LOD_LEVELS.HIGH.zoomThreshold) return LOD_LEVELS.HIGH;
		if (zoom >= LOD_LEVELS.MEDIUM.zoomThreshold) return LOD_LEVELS.MEDIUM;
		if (zoom >= LOD_LEVELS.LOW.zoomThreshold) return LOD_LEVELS.LOW;
		return LOD_LEVELS.MINIMAL;
	}

	/**
	 * Step 11) Apply LOD changes to all tracked objects
	 */
	_applyLODChanges() {
		var self = this;
		var level = this.currentLODLevel;

		// Step 11a) Update LOD objects
		this.lodObjects.forEach(function(lodVersions, id) {
			self._switchToLODVersion(id, lodVersions, level);
		});

		// Step 11b) Update text visibility
		this._updateTextVisibility(level.showText);

		// Step 11c) Update point sizes
		this._updatePointSizes(level.pointSize);
	}

	/**
	 * Step 12) Switch object to appropriate LOD version
	 * @param {string} id - Object ID
	 * @param {Object} lodVersions - LOD versions map
	 * @param {LODLevel} level - Target LOD level
	 */
	_switchToLODVersion(id, lodVersions, level) {
		// Step 12a) Hide all versions
		Object.values(lodVersions).forEach(function(obj) {
			if (obj) obj.visible = false;
		});

		// Step 12b) Find best available version
		var targetVersion = null;
		var levelNames = ["FULL", "HIGH", "MEDIUM", "LOW", "MINIMAL"];
		var startIndex = levelNames.indexOf(level.name);

		// Step 12c) Look for exact match or next higher detail
		for (var i = startIndex; i >= 0; i--) {
			if (lodVersions[levelNames[i]]) {
				targetVersion = lodVersions[levelNames[i]];
				break;
			}
		}

		// Step 12d) Fallback to lower detail if needed
		if (!targetVersion) {
			for (var j = startIndex; j < levelNames.length; j++) {
				if (lodVersions[levelNames[j]]) {
					targetVersion = lodVersions[levelNames[j]];
					break;
				}
			}
		}

		// Step 12e) Show target version
		if (targetVersion) {
			targetVersion.visible = true;
		}
	}

	/**
	 * Step 13) Update text label visibility based on LOD
	 * @param {boolean} showText - Whether to show text
	 */
	_updateTextVisibility(showText) {
		if (!this.renderer) return;

		var groups = [
			this.renderer.holesGroup,
			this.renderer.kadGroup,
			this.renderer.contoursGroup
		];

		groups.forEach(function(group) {
			if (!group) return;
			group.traverse(function(object) {
				if (object.userData && object.userData.isTroikaText) {
					object.visible = showText;
				}
				if (object.isSprite && object.userData && object.userData.type === "text") {
					object.visible = showText;
				}
			});
		});
	}

	/**
	 * Step 14) Update point sizes based on LOD
	 * @param {number} sizeMultiplier - Point size multiplier
	 */
	_updatePointSizes(sizeMultiplier) {
		if (!this.renderer) return;

		this.renderer.scene.traverse(function(object) {
			if (object.isPoints && object.material) {
				// Step 14a) Store original size if not stored
				if (object.userData._originalPointSize === undefined) {
					object.userData._originalPointSize = object.material.size || 1.0;
				}
				// Step 14b) Apply multiplier
				object.material.size = object.userData._originalPointSize * sizeMultiplier;
				object.material.needsUpdate = true;
			}
		});
	}

	//=================================================
	// LOD OBJECT REGISTRATION
	//=================================================

	/**
	 * Step 15) Register object for LOD management
	 * @param {string} id - Unique object ID
	 * @param {THREE.Object3D} fullDetailObject - Full detail version
	 * @param {Object} options - LOD options
	 */
	registerObject(id, fullDetailObject, options) {
		options = options || {};

		var lodVersions = {
			FULL: fullDetailObject,
			HIGH: options.highDetail || null,
			MEDIUM: options.mediumDetail || null,
			LOW: options.lowDetail || null,
			MINIMAL: options.minimalDetail || null
		};

		this.lodObjects.set(id, lodVersions);

		// Step 15a) Apply current LOD level
		this._switchToLODVersion(id, lodVersions, this.currentLODLevel);
	}

	/**
	 * Step 16) Unregister object from LOD management
	 * @param {string} id - Object ID
	 */
	unregisterObject(id) {
		this.lodObjects.delete(id);
	}

	/**
	 * Step 17) Clear all registered objects
	 */
	clearAllObjects() {
		this.lodObjects.clear();
		this.simplifiedGeometryCache.clear();
	}

	//=================================================
	// LINE SIMPLIFICATION (Douglas-Peucker)
	//=================================================

	/**
	 * Step 18) Simplify line using Douglas-Peucker algorithm
	 * @param {Array} points - Array of {x, y, z} points
	 * @param {number} tolerance - Simplification tolerance
	 * @returns {Array} Simplified points
	 */
	simplifyLine(points, tolerance) {
		if (!points || points.length < 3) return points;

		// Step 18a) Douglas-Peucker implementation
		return this._douglasPeucker(points, tolerance);
	}

	/**
	 * Step 19) Douglas-Peucker recursive implementation
	 * @param {Array} points - Points array
	 * @param {number} tolerance - Tolerance value
	 * @returns {Array} Simplified points
	 */
	_douglasPeucker(points, tolerance) {
		if (points.length <= 2) return points;

		// Step 19a) Find point with maximum distance
		var maxDistance = 0;
		var maxIndex = 0;
		var first = points[0];
		var last = points[points.length - 1];

		for (var i = 1; i < points.length - 1; i++) {
			var distance = this._perpendicularDistance(points[i], first, last);
			if (distance > maxDistance) {
				maxDistance = distance;
				maxIndex = i;
			}
		}

		// Step 19b) Check if max distance exceeds tolerance
		if (maxDistance > tolerance) {
			// Step 19b.1) Recursively simplify both halves
			var left = this._douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
			var right = this._douglasPeucker(points.slice(maxIndex), tolerance);

			// Step 19b.2) Combine results (remove duplicate middle point)
			return left.slice(0, -1).concat(right);
		} else {
			// Step 19c) All points within tolerance - return endpoints only
			return [first, last];
		}
	}

	/**
	 * Step 20) Calculate perpendicular distance from point to line
	 * @param {Object} point - Point {x, y, z}
	 * @param {Object} lineStart - Line start {x, y, z}
	 * @param {Object} lineEnd - Line end {x, y, z}
	 * @returns {number} Perpendicular distance
	 */
	_perpendicularDistance(point, lineStart, lineEnd) {
		// Step 20a) 3D perpendicular distance calculation
		var dx = lineEnd.x - lineStart.x;
		var dy = lineEnd.y - lineStart.y;
		var dz = (lineEnd.z || 0) - (lineStart.z || 0);

		var lineLengthSq = dx * dx + dy * dy + dz * dz;

		if (lineLengthSq === 0) {
			// Step 20b) Line is actually a point
			var px = point.x - lineStart.x;
			var py = point.y - lineStart.y;
			var pz = (point.z || 0) - (lineStart.z || 0);
			return Math.sqrt(px * px + py * py + pz * pz);
		}

		// Step 20c) Calculate parameter t for closest point on line
		var t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy + ((point.z || 0) - (lineStart.z || 0)) * dz) / lineLengthSq;
		t = Math.max(0, Math.min(1, t));

		// Step 20d) Calculate closest point on line
		var closestX = lineStart.x + t * dx;
		var closestY = lineStart.y + t * dy;
		var closestZ = (lineStart.z || 0) + t * dz;

		// Step 20e) Calculate distance
		var distX = point.x - closestX;
		var distY = point.y - closestY;
		var distZ = (point.z || 0) - closestZ;

		return Math.sqrt(distX * distX + distY * distY + distZ * distZ);
	}

	//=================================================
	// GEOMETRY SIMPLIFICATION
	//=================================================

	/**
	 * Step 21) Create simplified version of BufferGeometry
	 * @param {THREE.BufferGeometry} geometry - Original geometry
	 * @param {number} targetRatio - Target vertex ratio (0.0 to 1.0)
	 * @returns {THREE.BufferGeometry} Simplified geometry
	 */
	simplifyGeometry(geometry, targetRatio) {
		if (!geometry || !geometry.attributes || !geometry.attributes.position) {
			return geometry;
		}

		// Step 21a) Check cache
		var cacheKey = geometry.uuid + "_" + targetRatio;
		if (this.simplifiedGeometryCache.has(cacheKey)) {
			return this.simplifiedGeometryCache.get(cacheKey);
		}

		// Step 21b) Get position attribute
		var positions = geometry.attributes.position.array;
		var vertexCount = positions.length / 3;

		// Step 21c) Calculate target vertex count
		var targetCount = Math.max(3, Math.floor(vertexCount * targetRatio));

		// Step 21d) Simple vertex stride reduction
		var stride = Math.ceil(vertexCount / targetCount);
		var newPositions = [];

		for (var i = 0; i < positions.length; i += stride * 3) {
			if (i + 2 < positions.length) {
				newPositions.push(positions[i], positions[i + 1], positions[i + 2]);
			}
		}

		// Step 21e) Create new geometry
		var simplified = new THREE.BufferGeometry();
		simplified.setAttribute("position", new THREE.Float32BufferAttribute(newPositions, 3));

		// Step 21f) Copy other attributes with same stride
		if (geometry.attributes.color) {
			var colors = geometry.attributes.color.array;
			var newColors = [];
			for (var j = 0; j < colors.length; j += stride * 3) {
				if (j + 2 < colors.length) {
					newColors.push(colors[j], colors[j + 1], colors[j + 2]);
				}
			}
			simplified.setAttribute("color", new THREE.Float32BufferAttribute(newColors, 3));
		}

		// Step 21g) Cache result
		this.simplifiedGeometryCache.set(cacheKey, simplified);

		return simplified;
	}

	//=================================================
	// UTILITY METHODS
	//=================================================

	/**
	 * Step 22) Get current LOD level info
	 * @returns {LODLevel} Current LOD level
	 */
	getCurrentLevel() {
		return this.currentLODLevel;
	}

	/**
	 * Step 23) Get all LOD level definitions
	 * @returns {Object} LOD levels
	 */
	getLODLevels() {
		return LOD_LEVELS;
	}

	/**
	 * Step 24) Force specific LOD level (for testing)
	 * @param {string} levelName - Level name (FULL, HIGH, MEDIUM, LOW, MINIMAL)
	 */
	forceLODLevel(levelName) {
		if (LOD_LEVELS[levelName]) {
			this.previousLODLevel = this.currentLODLevel;
			this.currentLODLevel = LOD_LEVELS[levelName];
			this._applyLODChanges();
			console.log("LODManager: Forced level to " + levelName);
		}
	}

	/**
	 * Step 25) Enable/disable LOD system
	 * @param {boolean} enabled - Enable state
	 */
	setEnabled(enabled) {
		this.enabled = enabled;
		if (!enabled) {
			// Step 25a) Reset to full detail when disabled
			this.currentLODLevel = LOD_LEVELS.FULL;
			this._applyLODChanges();
		}
		console.log("LODManager: " + (enabled ? "Enabled" : "Disabled"));
	}

	/**
	 * Step 26) Get LOD statistics
	 * @returns {Object} Statistics
	 */
	getStats() {
		return {
			enabled: this.enabled,
			currentLevel: this.currentLODLevel.name,
			registeredObjects: this.lodObjects.size,
			cachedGeometries: this.simplifiedGeometryCache.size
		};
	}

	/**
	 * Step 27) Dispose LOD manager
	 */
	dispose() {
		this.clearAllObjects();
		this.simplifiedGeometryCache.clear();
		console.log("LODManager: Disposed");
	}
}

// Step 28) Export LOD levels for external use
export { LOD_LEVELS };
