/* prettier-ignore-file */
//=================================================
// LODManager.js - Level of Detail Management
//=================================================
// Manages level of detail for 3D blast holes based on SCREEN PIXEL SIZE
// NOT camera distance - this gives more intuitive LOD behavior
//
// Key features:
// - Pixel-based LOD bands for holes (bounding box determines visibility)
// - 4 distinct LOD levels with different geometry complexity
// - Verbose thresholds for easy tuning
//
// LOD BANDS (based on screen pixel size of hole bounding box):
// ============================================================
// PIXEL_THRESHOLDS are ADJUSTABLE - change these to tune LOD transitions
//
// Band          | Pixels      | Geometry                    | Labels
// --------------|-------------|-----------------------------|---------
// POINT_ONLY    | < 10px      | THREE.Points (2px)          | None
// POINT_TRACK   | 10-20px     | THREE.Points + track line   | None
// SIMPLE        | 20-50px     | Collar circle + track line  | Yes
// FULL          | > 50px      | Full hole structure         | Yes
//
// The pixel size is calculated from the BOUNDING BOX of the hole:
// - Considers BOTH collar diameter AND track length (collar-to-toe)
// - Uses LARGER dimension so long holes remain visible when zoomed out
//=================================================

import * as THREE from "three";

// ========================================
// Step 1) LOD level constants
// ========================================
// LOD_HOLE_LEVEL - 4 levels for blast hole rendering
// POINT_ONLY: Smallest/fastest - just a 2px point, no labels
// POINT_TRACK: Small point + single track line, no labels
// SIMPLE: Collar circle + track line + labels
// FULL: Complete hole geometry with collar, grade, toe + labels
export var LOD_HOLE_LEVEL = {
	POINT_ONLY: 0, // < 10px: Just a point
	POINT_TRACK: 1, // 10-20px: Point + track line
	SIMPLE: 2, // 20-50px: Circle + line + labels
	FULL: 3 // > 50px: Full geometry + labels
};

// ========================================
// Step 2) PIXEL THRESHOLDS - ADJUST THESE TO TUNE LOD TRANSITIONS
// ========================================
// These values determine when holes switch between LOD levels
// based on their SCREEN SIZE in pixels (bounding box dimension)
//
// VERBOSE COMMENTS for easy tuning:
// - POINT_THRESHOLD: Holes smaller than this appear as simple points
//   Increase to show more holes as points (better performance)
//   Decrease to show more detail at distance (slower)
//
// - TRACK_THRESHOLD: Holes between POINT and TRACK show point + line
//   The track line helps user see hole orientation at medium zoom
//
// - SIMPLE_THRESHOLD: Holes between TRACK and SIMPLE show circle + line
//   Full enough to see hole position clearly
//
// - Above SIMPLE_THRESHOLD: Full detail with all geometry
export var LOD_PIXEL_THRESHOLDS = {
	POINT_THRESHOLD: 10, // < 10px: POINT_ONLY (just 2px point, no labels)
	TRACK_THRESHOLD: 20, // 10-20px: POINT_TRACK (point + 1 track line, no labels)
	SIMPLE_THRESHOLD: 50 // 20-50px: SIMPLE (collar circle + line + labels)
	// > 50px: FULL (complete geometry + labels)
};

// ========================================
// Step 3) POINT SIZE - The size of points in POINT_ONLY and POINT_TRACK modes
// ========================================
// Points use sizeAttenuation: false so this is constant screen pixels
export var LOD_POINT_SIZE = 2; // 2 pixels - small but visible

// Legacy LODLevel for backward compatibility with existing code
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

		// Step 5) Legacy distance thresholds (kept for backward compatibility)
		// NOTE: Hole LOD now uses pixel-based thresholds instead
		this.distances = {
			full: 100,
			medium: 500,
			low: 2000,
			culled: 5000
		};

		// Step 6) Configuration per object type
		this.config = {
			holes: {
				enabled: true,
				// NOTE: Holes now use pixel-based LOD (see LOD_PIXEL_THRESHOLDS)
				fullSegments: 32, // Circle segments at full detail
				mediumSegments: 16, // Circle segments at medium
				lowSegments: 8, // Circle segments at low
				showTrackAt: "medium", // Legacy - now always shown except POINT_ONLY
				showLabelAt: "full" // Legacy - labels shown at SIMPLE and FULL
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

		// Step 7) Tracking state
		this.lodObjects = new Map(); // objectId -> { object, currentLOD, position, type }
		this.cameraPosition = new THREE.Vector3();
		this.targetPoint = new THREE.Vector3();

		// Step 8) Geometry caches
		this.geometryCache = {
			circleHigh: null,
			circleMed: null,
			circleLow: null
		};

		// Step 9) Statistics
		this.stats = {
			fullCount: 0,
			mediumCount: 0,
			lowCount: 0,
			culledCount: 0,
			// New stats for pixel-based LOD
			pointOnlyCount: 0,
			pointTrackCount: 0,
			simpleCount: 0,
			lastUpdateTime: 0
		};

		// Step 10) Initialize cached geometries
		this._initGeometryCache();

		console.log("🔭 LODManager initialized with pixel-based hole LOD");
	}

	// ========================================
	// SCREEN PIXEL SIZE CALCULATION
	// ========================================

	/**
	 * Step 11) Calculate screen pixel size for a hole's bounding box
	 * Uses the LARGER of: collar diameter OR track length (collar-to-toe)
	 * This ensures holes remain visible when zoomed out based on their full extent
	 *
	 * @param {Object} hole - Blast hole object with start/end locations and diameter
	 * @returns {number} Screen pixel size of hole's largest dimension
	 */
	getHoleBoundingBoxPixelSize(hole) {
		// Step 11a) Validate inputs
		if (!hole || !this.camera || !this.canvas) {
			return 0;
		}

		// Step 11b) Get world-space dimensions
		// Collar diameter in meters (holeDiameter is in mm)
		var collarDiameter = (hole.holeDiameter || 115) / 1000;

		// Step 11c) Calculate track length (3D distance from collar to toe)
		var dx = (hole.endXLocation || 0) - (hole.startXLocation || 0);
		var dy = (hole.endYLocation || 0) - (hole.startYLocation || 0);
		var dz = (hole.endZLocation || 0) - (hole.startZLocation || 0);
		var trackLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

		// Step 11d) Use LARGER dimension for LOD decision
		// This ensures long holes remain visible (as track lines) even when zoomed out
		var largestWorldDimension = Math.max(collarDiameter, trackLength);

		// Step 11e) Handle zero dimension case
		if (largestWorldDimension <= 0) {
			largestWorldDimension = collarDiameter || 0.115; // Default to ~115mm
		}

		// Step 11f) Convert world size to screen pixels for ORTHOGRAPHIC camera
		// For orthographic camera: pixelSize = worldSize * camera.zoom * (canvasHeight / frustumHeight)
		var frustumHeight = this.camera.top - this.camera.bottom;
		if (frustumHeight <= 0) frustumHeight = 1; // Prevent division by zero

		var canvasHeight = this.canvas.height || 800;
		var pixelScale = canvasHeight / frustumHeight;
		var screenPixelSize = largestWorldDimension * this.camera.zoom * pixelScale;

		return screenPixelSize;
	}

	/**
	 * Step 12) Get LOD level for a hole based on its screen pixel size
	 * Uses pixel thresholds defined in LOD_PIXEL_THRESHOLDS
	 *
	 * @param {Object} hole - Blast hole object
	 * @returns {number} LOD_HOLE_LEVEL value
	 */
	getHoleLODLevel(hole) {
		var pixelSize = this.getHoleBoundingBoxPixelSize(hole);

		// Step 12a) Determine LOD band based on pixel size
		// Thresholds are defined in LOD_PIXEL_THRESHOLDS for easy tuning
		if (pixelSize < LOD_PIXEL_THRESHOLDS.POINT_THRESHOLD) {
			// Very small on screen - just show a point
			return LOD_HOLE_LEVEL.POINT_ONLY;
		} else if (pixelSize < LOD_PIXEL_THRESHOLDS.TRACK_THRESHOLD) {
			// Small but visible - show point + track line
			return LOD_HOLE_LEVEL.POINT_TRACK;
		} else if (pixelSize < LOD_PIXEL_THRESHOLDS.SIMPLE_THRESHOLD) {
			// Medium size - show collar circle + track + labels
			return LOD_HOLE_LEVEL.SIMPLE;
		} else {
			// Large on screen - show full detail
			return LOD_HOLE_LEVEL.FULL;
		}
	}

	/**
	 * Step 13) Check if labels should be shown for a hole at given LOD level
	 * Labels are only shown at SIMPLE and FULL levels
	 *
	 * @param {number} lodLevel - LOD_HOLE_LEVEL value
	 * @returns {boolean} True if labels should be shown
	 */
	shouldShowLabels(lodLevel) {
		// Labels visible at SIMPLE (20-50px) and FULL (>50px)
		return lodLevel >= LOD_HOLE_LEVEL.SIMPLE;
	}

	/**
	 * Step 14) Check if track line should be shown for a hole at given LOD level
	 * Track line visible at POINT_TRACK, SIMPLE, and FULL
	 *
	 * @param {number} lodLevel - LOD_HOLE_LEVEL value
	 * @returns {boolean} True if track line should be shown
	 */
	shouldShowTrackLine(lodLevel) {
		// Track line visible at all levels except POINT_ONLY
		return lodLevel >= LOD_HOLE_LEVEL.POINT_TRACK;
	}

	/**
	 * Step 15) Check if collar circle should be shown for a hole at given LOD level
	 * Collar circle visible at SIMPLE and FULL only
	 *
	 * @param {number} lodLevel - LOD_HOLE_LEVEL value
	 * @returns {boolean} True if collar circle should be shown
	 */
	shouldShowCollarCircle(lodLevel) {
		// Collar circle only at SIMPLE and FULL
		return lodLevel >= LOD_HOLE_LEVEL.SIMPLE;
	}

	/**
	 * Step 16) Check if full hole geometry should be shown
	 * Full geometry (collar, grade, toe circles) only at FULL level
	 *
	 * @param {number} lodLevel - LOD_HOLE_LEVEL value
	 * @returns {boolean} True if full geometry should be shown
	 */
	shouldShowFullGeometry(lodLevel) {
		return lodLevel === LOD_HOLE_LEVEL.FULL;
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
			case LOD_HOLE_LEVEL.FULL:
				return this.geometryCache.circleHigh;
			case LODLevel.MEDIUM:
			case LOD_HOLE_LEVEL.SIMPLE:
				return this.geometryCache.circleMed;
			case LODLevel.LOW:
			case LOD_HOLE_LEVEL.POINT_TRACK:
			case LOD_HOLE_LEVEL.POINT_ONLY:
			default:
				return this.geometryCache.circleLow;
		}
	}

	// ========================================
	// LEGACY DISTANCE-BASED METHODS (kept for backward compatibility)
	// ========================================

	/**
	 * Set distance thresholds (legacy)
	 */
	setDistances(full, medium, low, culled) {
		this.distances.full = full;
		this.distances.medium = medium;
		this.distances.low = low;
		this.distances.culled = culled;
	}

	/**
	 * Calculate distance from camera to a point (legacy)
	 */
	getDistanceToCamera(point) {
		this.cameraPosition.copy(this.camera.position);

		if (point instanceof THREE.Vector3) {
			this.targetPoint.copy(point);
		} else {
			this.targetPoint.set(point.x || 0, point.y || 0, point.z || 0);
		}

		return this.cameraPosition.distanceTo(this.targetPoint);
	}

	/**
	 * Get LOD level for a distance (legacy)
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
	 * Get LOD level for a point (legacy)
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
		this.stats.pointOnlyCount = 0;
		this.stats.pointTrackCount = 0;
		this.stats.simpleCount = 0;
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
				object.visible = level !== LODLevel.CULLED;
		}
	}

	/**
	 * Apply LOD to a hole object
	 */
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

	/**
	 * Apply LOD to text object
	 */
	_applyTextLOD(text, level) {
		if (!this.config.text.enabled) return;
		text.visible = level === LODLevel.FULL;
	}

	/**
	 * Apply LOD to line object
	 */
	_applyLineLOD(line, level) {
		if (!this.config.lines.enabled) return;

		if (level === LODLevel.CULLED) {
			line.visible = false;
			return;
		}

		line.visible = true;
	}

	/**
	 * Apply LOD to point object
	 */
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

	/**
	 * Get circle segments for LOD level
	 */
	getCircleSegments(level) {
		switch (level) {
			case LODLevel.FULL:
			case LOD_HOLE_LEVEL.FULL:
				return this.config.holes.fullSegments;
			case LODLevel.MEDIUM:
			case LOD_HOLE_LEVEL.SIMPLE:
				return this.config.holes.mediumSegments;
			case LODLevel.LOW:
			case LOD_HOLE_LEVEL.POINT_TRACK:
			case LOD_HOLE_LEVEL.POINT_ONLY:
			default:
				return this.config.holes.lowSegments;
		}
	}

	/**
	 * Check if text should be visible at current zoom
	 */
	shouldShowText(scale) {
		return scale >= this.config.text.minScale;
	}

	/**
	 * Get decimation factor for lines at given LOD
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
	 */
	getStats() {
		return {
			totalObjects: this.lodObjects.size,
			fullDetail: this.stats.fullCount,
			mediumDetail: this.stats.mediumCount,
			lowDetail: this.stats.lowCount,
			culled: this.stats.culledCount,
			// New pixel-based stats
			pointOnly: this.stats.pointOnlyCount,
			pointTrack: this.stats.pointTrackCount,
			simple: this.stats.simpleCount,
			updateTime: this.stats.lastUpdateTime.toFixed(2) + "ms",
			// Thresholds for debugging
			thresholds: {
				pointThreshold: LOD_PIXEL_THRESHOLDS.POINT_THRESHOLD + "px",
				trackThreshold: LOD_PIXEL_THRESHOLDS.TRACK_THRESHOLD + "px",
				simpleThreshold: LOD_PIXEL_THRESHOLDS.SIMPLE_THRESHOLD + "px"
			}
		};
	}

	/**
	 * Set camera reference
	 */
	setCamera(camera) {
		this.camera = camera;
	}

	/**
	 * Set canvas reference (needed for pixel calculations)
	 */
	setCanvas(canvas) {
		this.canvas = canvas;
	}

	/**
	 * Dispose and cleanup
	 */
	dispose() {
		if (this.geometryCache.circleHigh) this.geometryCache.circleHigh.dispose();
		if (this.geometryCache.circleMed) this.geometryCache.circleMed.dispose();
		if (this.geometryCache.circleLow) this.geometryCache.circleLow.dispose();

		this.lodObjects.clear();
		this.camera = null;
		this.canvas = null;

		console.log("🔭 LODManager disposed");
	}
}

export default LODManager;
