/* prettier-ignore-file */
//=================================================
// LODManager.js - Level of Detail Management
//=================================================
// Manages level of detail for 3D blast holes based on FRUSTUM WIDTH
// NOT pixel size - this gives intuitive LOD behavior at any zoom level
//
// Key features:
// - Frustum-width based LOD thresholds (in meters)
// - Visibility toggling for instant LOD switching (no geometry rebuild)
// - 5 distinct LOD levels with different geometry complexity
//
// LOD BANDS (based on camera frustum width in meters):
// ============================================================
// LOD_FRUSTUM_THRESHOLDS are ADJUSTABLE - change these to tune LOD transitions
//
// Band          | Frustum Width | Geometry                    | Labels
// --------------|---------------|-----------------------------|---------
// FULL          | < 750m        | 32-seg circles + grade/toe  | Yes
// SIMPLE        | 750-1250m     | 8-seg circles, no grade     | Yes
// MEDIUM        | 1250-3000m    | 8-seg circles only          | No
// LOW           | 3000-10000m   | Points + track lines        | No
// MINIMAL       | > 10000m      | Points only                 | No
//=================================================

import * as THREE from "three";

// ========================================
// Step 1) LOD level constants - NEW FRUSTUM-BASED SYSTEM
// ========================================
export var LOD_LEVEL = {
	FULL: 0,     // < 750m: Full detail (32-seg, grade, toe, labels)
	SIMPLE: 1,   // 750-1250m: Simple (8-seg, no grade, labels)
	MEDIUM: 2,   // 1250-3000m: Medium (8-seg, no labels)
	LOW: 3,      // 3000-10000m: Low (points + lines)
	MINIMAL: 4   // > 10000m: Minimal (points only)
};

// ========================================
// Step 2) FRUSTUM WIDTH THRESHOLDS - ADJUST THESE TO TUNE LOD TRANSITIONS
// ========================================
// These values determine when holes switch between LOD levels
// based on the camera's visible width in METERS (frustum width)
//
// VERBOSE COMMENTS for easy tuning:
// - FULL: Viewing area smaller than this shows full detail
//   Decrease to show full detail only when very zoomed in
//   Increase to show full detail at wider zoom levels
//
// - SIMPLE: Between FULL and SIMPLE shows 8-segment circles with labels
//
// - MEDIUM: Between SIMPLE and MEDIUM shows 8-segment circles, no labels
//
// - LOW: Between MEDIUM and LOW shows points + track lines
//
// - Above LOW (MINIMAL): Shows only points
export var LOD_FRUSTUM_THRESHOLDS = {
	FULL: 750,      // < 750m: FULL (32-seg + grade + toe + labels)
	SIMPLE: 1250,   // 750-1250m: SIMPLE (8-seg, no grade, labels)
	MEDIUM: 3000,   // 1250-3000m: MEDIUM (8-seg only, no labels)
	LOW: 10000      // 3000-10000m: LOW (points + lines)
	// > 10000m: MINIMAL (points only)
};

// ========================================
// Step 3) LEGACY PIXEL THRESHOLDS - Kept for backward compatibility
// ========================================
export var LOD_HOLE_LEVEL = {
	POINT_ONLY: 0,
	POINT_TRACK: 1,
	SIMPLE: 2,
	FULL: 3
};

export var LOD_PIXEL_THRESHOLDS = {
	POINT_THRESHOLD: 10,
	TRACK_THRESHOLD: 20,
	SIMPLE_THRESHOLD: 50
};

export var LOD_POINT_SIZE = 2;

// Legacy LODLevel for backward compatibility
export var LODLevel = {
	FULL: 0,
	MEDIUM: 1,
	LOW: 2,
	CULLED: 3
};

export class LODManager {
	constructor(camera, canvas) {
		// Step 4) Store camera and canvas references
		this.camera = camera;
		this.canvas = canvas;

		// Step 5) Current LOD state
		this.currentLODLevel = LOD_LEVEL.FULL;
		this.lastFrustumWidth = 0;
		this.lodOverride = null; // null = auto, 0-4 = forced level

		// Step 6) LOD layer references (set by ThreeRenderer/kirra.js)
		// These are toggled visible/invisible based on LOD level
		this.lodLayers = {
			fullCircles: null,      // 32-segment instanced circles (FULL only)
			simpleCircles: null,    // 8-segment instanced circles (SIMPLE, MEDIUM)
			gradeCircles: null,     // Grade markers (FULL only)
			toeCircles: null,       // Toe markers (FULL, SIMPLE)
			trackLines: null,       // Track line batch (FULL, SIMPLE, MEDIUM, LOW)
			pointsAll: null,        // All holes as points (LOW, MINIMAL)
			labels: null            // Text labels group (FULL, SIMPLE)
		};

		// Step 7) Legacy distance thresholds (kept for backward compatibility)
		this.distances = {
			full: 100,
			medium: 500,
			low: 2000,
			culled: 5000
		};

		// Step 8) Configuration per object type
		this.config = {
			holes: {
				enabled: true,
				fullSegments: 32,
				mediumSegments: 16,
				lowSegments: 8,
				showTrackAt: "medium",
				showLabelAt: "full"
			},
			lines: {
				enabled: true,
				decimationFactor: 2,
				farDecimation: 4
			},
			text: {
				enabled: true,
				minScale: 0.5,
				maxTextCount: 500
			},
			points: {
				enabled: true,
				decimationThreshold: 10000,
				farPointSize: 1
			}
		};

		// Step 9) Tracking state (legacy)
		this.lodObjects = new Map();
		this.cameraPosition = new THREE.Vector3();
		this.targetPoint = new THREE.Vector3();

		// Step 10) Geometry caches
		this.geometryCache = {
			circleHigh: null,
			circleMed: null,
			circleLow: null
		};

		// Step 11) Statistics
		this.stats = {
			fullCount: 0,
			mediumCount: 0,
			lowCount: 0,
			culledCount: 0,
			pointOnlyCount: 0,
			pointTrackCount: 0,
			simpleCount: 0,
			lastUpdateTime: 0,
			frustumWidth: 0,
			lodLevel: "FULL"
		};

		// Step 12) Initialize cached geometries
		this._initGeometryCache();

		console.log("LODManager initialized with frustum-based LOD (thresholds: " + 
			LOD_FRUSTUM_THRESHOLDS.FULL + "m/" + 
			LOD_FRUSTUM_THRESHOLDS.SIMPLE + "m/" + 
			LOD_FRUSTUM_THRESHOLDS.MEDIUM + "m/" + 
			LOD_FRUSTUM_THRESHOLDS.LOW + "m)");
	}

	// ========================================
	// NEW FRUSTUM-BASED LOD METHODS
	// ========================================

	/**
	 * Step 13) Get current frustum width in world units (meters)
	 * For orthographic camera: width = (right - left) / zoom
	 * @returns {number} Frustum width in meters
	 */
	getFrustumWidth() {
		if (!this.camera) return 0;
		
		// Step 13a) For orthographic camera
		if (this.camera.isOrthographicCamera) {
			var width = (this.camera.right - this.camera.left) / this.camera.zoom;
			return Math.abs(width);
		}
		
		// Step 13b) For perspective camera (fallback - estimate from FOV and distance)
		// This is approximate - uses distance to origin
		if (this.camera.isPerspectiveCamera) {
			var distance = this.camera.position.length();
			var fov = this.camera.fov * Math.PI / 180;
			var height = 2 * distance * Math.tan(fov / 2);
			var width = height * this.camera.aspect;
			return width;
		}
		
		return 1000; // Default fallback
	}

	/**
	 * Step 14) Get LOD level from frustum width
	 * @returns {number} LOD_LEVEL value
	 */
	getLODLevelFromFrustum() {
		// Step 14a) Check for manual override
		if (this.lodOverride !== null && this.lodOverride >= 0 && this.lodOverride <= 4) {
			return this.lodOverride;
		}
		
		// Step 14b) Calculate from frustum width
		var width = this.getFrustumWidth();
		
		if (width < LOD_FRUSTUM_THRESHOLDS.FULL) {
			return LOD_LEVEL.FULL;
		} else if (width < LOD_FRUSTUM_THRESHOLDS.SIMPLE) {
			return LOD_LEVEL.SIMPLE;
		} else if (width < LOD_FRUSTUM_THRESHOLDS.MEDIUM) {
			return LOD_LEVEL.MEDIUM;
		} else if (width < LOD_FRUSTUM_THRESHOLDS.LOW) {
			return LOD_LEVEL.LOW;
		} else {
			return LOD_LEVEL.MINIMAL;
		}
	}

	/**
	 * Step 15) Get LOD level name for display
	 * @param {number} level - LOD_LEVEL value
	 * @returns {string} Human-readable level name
	 */
	getLODLevelName(level) {
		switch (level) {
			case LOD_LEVEL.FULL: return "FULL";
			case LOD_LEVEL.SIMPLE: return "SIMPLE";
			case LOD_LEVEL.MEDIUM: return "MEDIUM";
			case LOD_LEVEL.LOW: return "LOW";
			case LOD_LEVEL.MINIMAL: return "MINIMAL";
			default: return "UNKNOWN";
		}
	}

	/**
	 * Step 16) Update visibility of LOD layers based on current frustum
	 * Called every frame from render loop - MUST BE FAST
	 * @returns {boolean} True if LOD level changed
	 */
	updateVisibility() {
		var newLevel = this.getLODLevelFromFrustum();
		var frustumWidth = this.getFrustumWidth();

		// Step 16a) Update stats
		this.stats.frustumWidth = frustumWidth;
		this.stats.lodLevel = this.getLODLevelName(newLevel);

		// DEBUG: Log every call to see if it's running
		if (window.lodDebugCounter === undefined) window.lodDebugCounter = 0;
		if (++window.lodDebugCounter % 60 === 0) { // Log every 60 frames (~1 second at 60fps)
			console.log("🔍 LOD Update: frustum=" + frustumWidth.toFixed(0) + "m, level=" + this.getLODLevelName(newLevel));
		}

		// Step 16b) Skip if no change
		if (newLevel === this.currentLODLevel) {
			return false;
		}
		
		// Step 16c) Log LOD change with DEBUG info
		console.log("🔍 LOD DEBUG: " + this.getLODLevelName(this.currentLODLevel) + 
			" -> " + this.getLODLevelName(newLevel) + 
			" (frustum: " + frustumWidth.toFixed(0) + "m)");
		
		// Step 16c.1) DEBUG: Log layer status
		var layers = this.lodLayers;
		console.log("🔍 LOD layers status:", {
			fullCircles: layers.fullCircles ? (layers.fullCircles instanceof Map ? "Map(" + layers.fullCircles.size + ")" : "Object") : "NULL",
			simpleCircles: layers.simpleCircles ? (layers.simpleCircles instanceof Map ? "Map(" + layers.simpleCircles.size + ")" : "Object") : "NULL",
			gradeCircles: layers.gradeCircles ? "Set" : "NULL",
			toeCircles: layers.toeCircles ? "Set" : "NULL",
			trackLines: layers.trackLines ? (layers.trackLines instanceof Map ? "Map(" + layers.trackLines.size + ")" : "Object") : "NULL",
			pointsAll: layers.pointsAll ? "Object" : "NULL",
			labels: layers.labels ? "Object" : "NULL"
		});
		
		this.currentLODLevel = newLevel;
		
		// Step 16d) FULL: Everything visible (32-seg + grade + toe + labels)
		if (newLevel === LOD_LEVEL.FULL) {
			console.log("🎯 Applying FULL LOD visibility:");
			console.log("  fullCircles=ON, simpleCircles=OFF, grade=ON, toe=ON, tracks=ON, points=OFF, labels=ON");
			this._setLayerVisibility(layers.fullCircles, true);
			this._setLayerVisibility(layers.simpleCircles, false);
			this._setLayerVisibility(layers.gradeCircles, true);
			this._setLayerVisibility(layers.toeCircles, true);
			this._setLayerVisibility(layers.trackLines, true);
			this._setLayerVisibility(layers.pointsAll, false);
			this._setLayerVisibility(layers.labels, true);
		}
		// Step 16e) SIMPLE: 8-seg circles, no grade, with labels
		else if (newLevel === LOD_LEVEL.SIMPLE) {
			console.log("🎯 Applying SIMPLE LOD visibility:");
			console.log("  fullCircles=OFF, simpleCircles=ON, grade=OFF, toe=ON, tracks=ON, points=OFF, labels=ON");
			this._setLayerVisibility(layers.fullCircles, false);
			this._setLayerVisibility(layers.simpleCircles, true);
			this._setLayerVisibility(layers.gradeCircles, false);
			this._setLayerVisibility(layers.toeCircles, true);
			this._setLayerVisibility(layers.trackLines, true);
			this._setLayerVisibility(layers.pointsAll, false);
			this._setLayerVisibility(layers.labels, true);
		}
		// Step 16f) MEDIUM: 8-seg circles only, no labels
		else if (newLevel === LOD_LEVEL.MEDIUM) {
			console.log("🎯 Applying MEDIUM LOD visibility:");
			console.log("  fullCircles=OFF, simpleCircles=ON, grade=OFF, toe=OFF, tracks=ON, points=OFF, labels=OFF");
			this._setLayerVisibility(layers.fullCircles, false);
			this._setLayerVisibility(layers.simpleCircles, true);
			this._setLayerVisibility(layers.gradeCircles, false);
			this._setLayerVisibility(layers.toeCircles, false);
			this._setLayerVisibility(layers.trackLines, true);
			this._setLayerVisibility(layers.pointsAll, false);
			this._setLayerVisibility(layers.labels, false);
		}
		// Step 16g) LOW: Points + lines only
		else if (newLevel === LOD_LEVEL.LOW) {
			console.log("🎯 Applying LOW LOD visibility:");
			console.log("  fullCircles=OFF, simpleCircles=OFF, grade=OFF, toe=OFF, tracks=ON, points=ON, labels=OFF");
			this._setLayerVisibility(layers.fullCircles, false);
			this._setLayerVisibility(layers.simpleCircles, false);
			this._setLayerVisibility(layers.gradeCircles, false);
			this._setLayerVisibility(layers.toeCircles, false);
			this._setLayerVisibility(layers.trackLines, true);
			this._setLayerVisibility(layers.pointsAll, true);
			this._setLayerVisibility(layers.labels, false);
		}
		// Step 16h) MINIMAL: Points only
		else {
			console.log("🎯 Applying MINIMAL LOD visibility:");
			console.log("  fullCircles=OFF, simpleCircles=OFF, grade=OFF, toe=OFF, tracks=OFF, points=ON, labels=OFF");
			this._setLayerVisibility(layers.fullCircles, false);
			this._setLayerVisibility(layers.simpleCircles, false);
			this._setLayerVisibility(layers.gradeCircles, false);
			this._setLayerVisibility(layers.toeCircles, false);
			this._setLayerVisibility(layers.trackLines, false);
			this._setLayerVisibility(layers.pointsAll, true);
			this._setLayerVisibility(layers.labels, false);
		}
		
		return true; // LOD changed
	}

	/**
	 * Step 17) Helper to set layer visibility
	 * Handles both single objects and groups/arrays
	 * @param {Object|Array} layer - Three.js object, group, or array of objects
	 * @param {boolean} visible - Visibility state
	 */
	_setLayerVisibility(layer, visible) {
		if (!layer) {
			// DEBUG: Layer is null
			return;
		}
		
		// Step 17a) Single object with .visible property
		if (layer.visible !== undefined) {
			console.log("  🔧 Setting single object visible=" + visible + " (was " + layer.visible + ")");
			layer.visible = visible;
			return;
		}
		
		// Step 17b) Map of instanced meshes (InstancedMeshManager style)
		if (layer instanceof Map) {
			var count = 0;
			layer.forEach(function(mesh) {
				if (mesh && mesh.visible !== undefined) {
					mesh.visible = visible;
					count++;
				}
			});
			console.log("  🔧 Set " + count + " meshes in Map to visible=" + visible);
			return;
		}
		
		// Step 17c) Array of objects
		if (Array.isArray(layer)) {
			var count = 0;
			for (var i = 0; i < layer.length; i++) {
				if (layer[i] && layer[i].visible !== undefined) {
					layer[i].visible = visible;
					count++;
				}
			}
			console.log("  🔧 Set " + count + " objects in Array to visible=" + visible);
			return;
		}
		
		// Step 17d) Object with instancedMeshes property (InstancedMeshManager)
		if (layer.instancedMeshes && layer.instancedMeshes instanceof Map) {
			var count = 0;
			layer.instancedMeshes.forEach(function(mesh) {
				if (mesh && mesh.visible !== undefined) {
					mesh.visible = visible;
					count++;
				}
			});
			console.log("  🔧 Set " + count + " meshes via instancedMeshes to visible=" + visible);
		}
	}

	/**
	 * Step 18) Register LOD layers
	 * Called after hole geometry is created
	 * @param {Object} layers - Object containing LOD layer references
	 */
	setLayers(layers) {
		this.lodLayers = Object.assign(this.lodLayers, layers);
		console.log("LOD layers registered:", Object.keys(layers).filter(function(k) { 
			return layers[k] !== null; 
		}).join(", "));
		
		// Step 18a) CRITICAL: Force visibility update when layers are registered
		// Without this, if currentLODLevel is already set, visibility won't be applied
		// to the newly registered layers
		var savedLevel = this.currentLODLevel;
		this.currentLODLevel = -1; // Force change detection
		this.updateVisibility();
		console.log("🔧 Forced LOD visibility update after layer registration");
	}

	/**
	 * Step 19) Set LOD override (for developer testing)
	 * @param {number|null} level - LOD_LEVEL value or null for auto
	 */
	setOverride(level) {
		if (level === null || level === "auto") {
			this.lodOverride = null;
			console.log("LOD override: AUTO");
		} else {
			var numLevel = parseInt(level);
			if (numLevel >= 0 && numLevel <= 4) {
				this.lodOverride = numLevel;
				console.log("LOD override: " + this.getLODLevelName(numLevel));
				// Force update
				this.currentLODLevel = -1;
				this.updateVisibility();
			}
		}
	}

	/**
	 * Step 20) Update thresholds (for developer tuning)
	 * @param {Object} thresholds - New threshold values
	 */
	setThresholds(thresholds) {
		if (thresholds.full !== undefined) LOD_FRUSTUM_THRESHOLDS.FULL = thresholds.full;
		if (thresholds.simple !== undefined) LOD_FRUSTUM_THRESHOLDS.SIMPLE = thresholds.simple;
		if (thresholds.medium !== undefined) LOD_FRUSTUM_THRESHOLDS.MEDIUM = thresholds.medium;
		if (thresholds.low !== undefined) LOD_FRUSTUM_THRESHOLDS.LOW = thresholds.low;
		
		console.log("LOD thresholds updated: " + 
			LOD_FRUSTUM_THRESHOLDS.FULL + "m/" + 
			LOD_FRUSTUM_THRESHOLDS.SIMPLE + "m/" + 
			LOD_FRUSTUM_THRESHOLDS.MEDIUM + "m/" + 
			LOD_FRUSTUM_THRESHOLDS.LOW + "m");
		
		// Force update
		this.currentLODLevel = -1;
		this.updateVisibility();
	}

	// ========================================
	// LEGACY METHODS - Kept for backward compatibility
	// ========================================

	/**
	 * Step 21) Calculate screen pixel size for a hole's bounding box (LEGACY)
	 * @param {Object} hole - Blast hole object
	 * @returns {number} Screen pixel size
	 */
	getHoleBoundingBoxPixelSize(hole) {
		if (!hole || !this.camera || !this.canvas) {
			return 0;
		}

		var collarDiameter = (hole.holeDiameter || 115) / 1000;
		var dx = (hole.endXLocation || 0) - (hole.startXLocation || 0);
		var dy = (hole.endYLocation || 0) - (hole.startYLocation || 0);
		var dz = (hole.endZLocation || 0) - (hole.startZLocation || 0);
		var trackLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
		var largestWorldDimension = Math.max(collarDiameter, trackLength);

		if (largestWorldDimension <= 0) {
			largestWorldDimension = collarDiameter || 0.115;
		}

		var frustumHeight = this.camera.top - this.camera.bottom;
		if (frustumHeight <= 0) frustumHeight = 1;

		var canvasHeight = this.canvas.height || 800;
		var pixelScale = canvasHeight / frustumHeight;
		var screenPixelSize = largestWorldDimension * this.camera.zoom * pixelScale;

		return screenPixelSize;
	}

	/**
	 * Step 22) Get LOD level for a hole based on pixel size (LEGACY)
	 * @param {Object} hole - Blast hole object
	 * @returns {number} LOD_HOLE_LEVEL value
	 */
	getHoleLODLevel(hole) {
		var pixelSize = this.getHoleBoundingBoxPixelSize(hole);

		if (pixelSize < LOD_PIXEL_THRESHOLDS.POINT_THRESHOLD) {
			return LOD_HOLE_LEVEL.POINT_ONLY;
		} else if (pixelSize < LOD_PIXEL_THRESHOLDS.TRACK_THRESHOLD) {
			return LOD_HOLE_LEVEL.POINT_TRACK;
		} else if (pixelSize < LOD_PIXEL_THRESHOLDS.SIMPLE_THRESHOLD) {
			return LOD_HOLE_LEVEL.SIMPLE;
		} else {
			return LOD_HOLE_LEVEL.FULL;
		}
	}

	shouldShowLabels(lodLevel) {
		return lodLevel >= LOD_HOLE_LEVEL.SIMPLE;
	}

	shouldShowTrackLine(lodLevel) {
		return lodLevel >= LOD_HOLE_LEVEL.POINT_TRACK;
	}

	shouldShowCollarCircle(lodLevel) {
		return lodLevel >= LOD_HOLE_LEVEL.SIMPLE;
	}

	shouldShowFullGeometry(lodLevel) {
		return lodLevel === LOD_HOLE_LEVEL.FULL;
	}

	// ========================================
	// GEOMETRY CACHE
	// ========================================

	_initGeometryCache() {
		this.geometryCache.circleHigh = new THREE.CircleGeometry(1, 32);
		this.geometryCache.circleMed = new THREE.CircleGeometry(1, 16);
		this.geometryCache.circleLow = new THREE.CircleGeometry(1, 8);
	}

	getCircleGeometry(level) {
		switch (level) {
			case LODLevel.FULL:
			case LOD_HOLE_LEVEL.FULL:
			case LOD_LEVEL.FULL:
				return this.geometryCache.circleHigh;
			case LODLevel.MEDIUM:
			case LOD_HOLE_LEVEL.SIMPLE:
			case LOD_LEVEL.SIMPLE:
			case LOD_LEVEL.MEDIUM:
				return this.geometryCache.circleMed;
			case LODLevel.LOW:
			case LOD_HOLE_LEVEL.POINT_TRACK:
			case LOD_HOLE_LEVEL.POINT_ONLY:
			case LOD_LEVEL.LOW:
			case LOD_LEVEL.MINIMAL:
			default:
				return this.geometryCache.circleLow;
		}
	}

	// ========================================
	// LEGACY DISTANCE-BASED METHODS
	// ========================================

	setDistances(full, medium, low, culled) {
		this.distances.full = full;
		this.distances.medium = medium;
		this.distances.low = low;
		this.distances.culled = culled;
	}

	getDistanceToCamera(point) {
		this.cameraPosition.copy(this.camera.position);

		if (point instanceof THREE.Vector3) {
			this.targetPoint.copy(point);
		} else {
			this.targetPoint.set(point.x || 0, point.y || 0, point.z || 0);
		}

		return this.cameraPosition.distanceTo(this.targetPoint);
	}

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

	getLODLevelForPoint(point) {
		var distance = this.getDistanceToCamera(point);
		return this.getLODLevel(distance);
	}

	// ========================================
	// OBJECT REGISTRATION (Legacy)
	// ========================================

	registerObject(objectId, object, position, type) {
		this.lodObjects.set(objectId, {
			object: object,
			position: position,
			type: type,
			currentLOD: LODLevel.FULL,
			visible: true
		});
	}

	unregisterObject(objectId) {
		this.lodObjects.delete(objectId);
	}

	clearAll() {
		this.lodObjects.clear();
		this.stats.fullCount = 0;
		this.stats.mediumCount = 0;
		this.stats.lowCount = 0;
		this.stats.culledCount = 0;
		this.stats.pointOnlyCount = 0;
		this.stats.pointTrackCount = 0;
		this.stats.simpleCount = 0;
		
		// Reset LOD layers
		this.lodLayers = {
			fullCircles: null,
			simpleCircles: null,
			gradeCircles: null,
			toeCircles: null,
			trackLines: null,
			pointsAll: null,
			labels: null
		};
	}

	// ========================================
	// LEGACY UPDATE METHOD
	// ========================================

	update() {
		var startTime = performance.now();
		var self = this;

		this.stats.fullCount = 0;
		this.stats.mediumCount = 0;
		this.stats.lowCount = 0;
		this.stats.culledCount = 0;

		this.lodObjects.forEach(function(data, objectId) {
			var newLOD = self.getLODLevelForPoint(data.position);

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

			if (data.currentLOD === newLOD) return;

			self._applyLOD(data, newLOD);
			data.currentLOD = newLOD;
		});

		this.stats.lastUpdateTime = performance.now() - startTime;
	}

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
				object.visible = level !== LODLevel.CULLED;
		}
	}

	_applyHoleLOD(hole, level) {
		if (!this.config.holes.enabled) return;

		if (level === LODLevel.CULLED) {
			hole.visible = false;
			return;
		}

		hole.visible = true;

		hole.traverse(function(child) {
			if (child.userData && child.userData.isTroikaText) {
				child.visible = level === LODLevel.FULL;
			}

			if (child.isLine) {
				child.visible = level <= LODLevel.MEDIUM;
			}
		});
	}

	_applyTextLOD(text, level) {
		if (!this.config.text.enabled) return;
		text.visible = level === LODLevel.FULL;
	}

	_applyLineLOD(line, level) {
		if (!this.config.lines.enabled) return;

		if (level === LODLevel.CULLED) {
			line.visible = false;
			return;
		}

		line.visible = true;
	}

	_applyPointLOD(point, level) {
		if (!this.config.points.enabled) return;

		if (level === LODLevel.CULLED) {
			point.visible = false;
			return;
		}

		point.visible = true;

		if (point.material && point.material.size !== undefined) {
			if (level === LODLevel.LOW) {
				point.material.size = this.config.points.farPointSize;
			}
		}
	}

	// ========================================
	// UTILITY METHODS
	// ========================================

	getCircleSegments(level) {
		switch (level) {
			case LODLevel.FULL:
			case LOD_HOLE_LEVEL.FULL:
			case LOD_LEVEL.FULL:
				return this.config.holes.fullSegments;
			case LODLevel.MEDIUM:
			case LOD_HOLE_LEVEL.SIMPLE:
			case LOD_LEVEL.SIMPLE:
			case LOD_LEVEL.MEDIUM:
				return this.config.holes.mediumSegments;
			case LODLevel.LOW:
			case LOD_HOLE_LEVEL.POINT_TRACK:
			case LOD_HOLE_LEVEL.POINT_ONLY:
			case LOD_LEVEL.LOW:
			case LOD_LEVEL.MINIMAL:
			default:
				return this.config.holes.lowSegments;
		}
	}

	shouldShowText(scale) {
		return scale >= this.config.text.minScale;
	}

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

	getStats() {
		return {
			totalObjects: this.lodObjects.size,
			fullDetail: this.stats.fullCount,
			mediumDetail: this.stats.mediumCount,
			lowDetail: this.stats.lowCount,
			culled: this.stats.culledCount,
			pointOnly: this.stats.pointOnlyCount,
			pointTrack: this.stats.pointTrackCount,
			simple: this.stats.simpleCount,
			updateTime: this.stats.lastUpdateTime.toFixed(2) + "ms",
			// NEW: Frustum-based stats
			frustumWidth: this.stats.frustumWidth.toFixed(0) + "m",
			lodLevel: this.stats.lodLevel,
			lodOverride: this.lodOverride !== null ? this.getLODLevelName(this.lodOverride) : "AUTO",
			thresholds: {
				full: LOD_FRUSTUM_THRESHOLDS.FULL + "m",
				simple: LOD_FRUSTUM_THRESHOLDS.SIMPLE + "m",
				medium: LOD_FRUSTUM_THRESHOLDS.MEDIUM + "m",
				low: LOD_FRUSTUM_THRESHOLDS.LOW + "m"
			}
		};
	}

	setCamera(camera) {
		this.camera = camera;
	}

	setCanvas(canvas) {
		this.canvas = canvas;
	}

	dispose() {
		if (this.geometryCache.circleHigh) this.geometryCache.circleHigh.dispose();
		if (this.geometryCache.circleMed) this.geometryCache.circleMed.dispose();
		if (this.geometryCache.circleLow) this.geometryCache.circleLow.dispose();

		this.lodObjects.clear();
		this.camera = null;
		this.canvas = null;

		console.log("LODManager disposed");
	}
}

export default LODManager;
