/* prettier-ignore-file */
//=================================================
// LineRenderer.js - High-Performance Line Rendering
//=================================================
// Renders lines and polylines using batched geometry for performance
// Key features:
// - Batches DXF lines by color/width into single draw calls
// - Uses LineSegments2 for fat lines (single draw call per batch)
// - Uses BufferGeometry LineSegments for thin lines
// - Supports polylines, polygons, and individual line segments
// - Target: 100,000 line segments at 60fps
//=================================================

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export class LineRenderer {
	constructor(sceneManager) {
		// Step 1) Store scene manager reference
		this.sceneManager = sceneManager;

		// Step 2) Batch storage
		// Key format: "color_width" e.g., "ffffff_2"
		this.lineBatches = new Map();

		// Step 3) Built mesh references
		this.builtMeshes = [];

		// Step 4) Configuration
		this.config = {
			useFatLines: true,           // Use LineSegments2 for all lines
			thinLineThreshold: 1.0,      // Width below this uses thin lines
			defaultLineWidth: 2,
			defaultColor: "#ffffff",
			maxVerticesPerBatch: 100000, // Split large batches
			colorPrecision: 6            // Hex color precision for batching
		};

		// Step 5) Resolution for fat lines
		this.resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

		// Step 6) Reusable objects
		this._tempColor = new THREE.Color();

		// Step 7) Statistics
		this.stats = {
			linesRendered: 0,
			batchCount: 0,
			totalVertices: 0,
			lastBuildTime: 0
		};

		console.log("📏 LineRenderer initialized");
	}

	// ========================================
	// BATCH KEY MANAGEMENT
	// ========================================

	/**
	 * Get batch key for line with given properties
	 * @param {string|number} color - Line color
	 * @param {number} width - Line width
	 * @returns {string} Batch key
	 */
	_getBatchKey(color, width) {
		// Normalize color
		var colorHex;
		if (typeof color === "number") {
			colorHex = color.toString(16).padStart(6, "0");
		} else if (typeof color === "string") {
			colorHex = color.replace("#", "").toLowerCase();
		} else {
			colorHex = "ffffff";
		}

		// Round width to reduce fragmentation
		var roundedWidth = Math.round(width * 2) / 2;  // Round to 0.5
		if (roundedWidth < 0.5) roundedWidth = 0.5;

		return colorHex + "_" + roundedWidth;
	}

	/**
	 * Get or create batch for key
	 * @param {string} key - Batch key
	 * @param {string} color - Color
	 * @param {number} width - Width
	 * @returns {Object} Batch object
	 */
	_getOrCreateBatch(key, color, width) {
		if (!this.lineBatches.has(key)) {
			this.lineBatches.set(key, {
				positions: [],
				color: color,
				width: width,
				mesh: null
			});
		}
		return this.lineBatches.get(key);
	}

	// ========================================
	// LINE ADDITION
	// ========================================

	/**
	 * Add a single line segment
	 * @param {number} x1 - Start X
	 * @param {number} y1 - Start Y
	 * @param {number} z1 - Start Z
	 * @param {number} x2 - End X
	 * @param {number} y2 - End Y
	 * @param {number} z2 - End Z
	 * @param {string|number} color - Line color
	 * @param {number} width - Line width
	 */
	addLine(x1, y1, z1, x2, y2, z2, color, width) {
		if (color === undefined) color = this.config.defaultColor;
		if (width === undefined) width = this.config.defaultLineWidth;

		var key = this._getBatchKey(color, width);
		var batch = this._getOrCreateBatch(key, color, width);

		// Add segment (6 floats: x1,y1,z1, x2,y2,z2)
		batch.positions.push(x1, y1, z1, x2, y2, z2);
	}

	/**
	 * Add multiple connected line segments (polyline)
	 * @param {Array} points - Array of {x, y, z} or [x, y, z]
	 * @param {string|number} color - Color
	 * @param {number} width - Width
	 * @param {boolean} closed - Close the polyline
	 */
	addPolyline(points, color, width, closed) {
		if (!points || points.length < 2) return;
		if (color === undefined) color = this.config.defaultColor;
		if (width === undefined) width = this.config.defaultLineWidth;
		if (closed === undefined) closed = false;

		for (var i = 0; i < points.length - 1; i++) {
			var p1 = points[i];
			var p2 = points[i + 1];

			var x1 = Array.isArray(p1) ? p1[0] : p1.x;
			var y1 = Array.isArray(p1) ? p1[1] : p1.y;
			var z1 = Array.isArray(p1) ? p1[2] : (p1.z || 0);
			var x2 = Array.isArray(p2) ? p2[0] : p2.x;
			var y2 = Array.isArray(p2) ? p2[1] : p2.y;
			var z2 = Array.isArray(p2) ? p2[2] : (p2.z || 0);

			this.addLine(x1, y1, z1, x2, y2, z2, color, width);
		}

		// Close if requested
		if (closed && points.length > 2) {
			var first = points[0];
			var last = points[points.length - 1];

			var fx = Array.isArray(first) ? first[0] : first.x;
			var fy = Array.isArray(first) ? first[1] : first.y;
			var fz = Array.isArray(first) ? first[2] : (first.z || 0);
			var lx = Array.isArray(last) ? last[0] : last.x;
			var ly = Array.isArray(last) ? last[1] : last.y;
			var lz = Array.isArray(last) ? last[2] : (last.z || 0);

			this.addLine(lx, ly, lz, fx, fy, fz, color, width);
		}
	}

	/**
	 * Add a polygon (closed polyline)
	 * @param {Array} points - Array of points
	 * @param {string|number} color - Color
	 * @param {number} width - Width
	 */
	addPolygon(points, color, width) {
		this.addPolyline(points, color, width, true);
	}

	/**
	 * Add a circle as line segments
	 * @param {number} cx - Center X
	 * @param {number} cy - Center Y
	 * @param {number} cz - Center Z
	 * @param {number} radius - Radius
	 * @param {string|number} color - Color
	 * @param {number} width - Width
	 * @param {number} segments - Number of segments (default 32)
	 */
	addCircle(cx, cy, cz, radius, color, width, segments) {
		if (segments === undefined) segments = 32;

		var points = [];
		for (var i = 0; i <= segments; i++) {
			var angle = (i / segments) * Math.PI * 2;
			points.push({
				x: cx + Math.cos(angle) * radius,
				y: cy + Math.sin(angle) * radius,
				z: cz
			});
		}

		this.addPolyline(points, color, width, false);  // Already closed
	}

	/**
	 * Add an arc
	 * @param {number} cx - Center X
	 * @param {number} cy - Center Y
	 * @param {number} cz - Center Z
	 * @param {number} radius - Radius
	 * @param {number} startAngle - Start angle (radians)
	 * @param {number} endAngle - End angle (radians)
	 * @param {string|number} color - Color
	 * @param {number} width - Width
	 * @param {number} segments - Segments
	 */
	addArc(cx, cy, cz, radius, startAngle, endAngle, color, width, segments) {
		if (segments === undefined) segments = 32;

		var points = [];
		var angleRange = endAngle - startAngle;

		for (var i = 0; i <= segments; i++) {
			var t = i / segments;
			var angle = startAngle + t * angleRange;
			points.push({
				x: cx + Math.cos(angle) * radius,
				y: cy + Math.sin(angle) * radius,
				z: cz
			});
		}

		this.addPolyline(points, color, width, false);
	}

	// ========================================
	// BULK ADDITION
	// ========================================

	/**
	 * Add KAD line entities (grouped by entityName)
	 * @param {Array} entities - Array of KAD entities
	 * @param {Object} options - Options with originX, originY
	 */
	addKADLines(entities, options) {
		options = options || {};
		var originX = options.originX || 0;
		var originY = options.originY || 0;
		var self = this;

		// Group by entityName
		var groups = new Map();

		entities.forEach(function(entity) {
			if (entity.entityType !== "line") return;
			if (!entity.visible) return;

			var key = entity.entityName || "default";
			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key).push(entity);
		});

		// Build lines for each group
		groups.forEach(function(groupEntities, entityName) {
			if (groupEntities.length < 2) return;

			// Sort by pointID
			groupEntities.sort(function(a, b) {
				return (a.pointID || 0) - (b.pointID || 0);
			});

			var color = groupEntities[0].color || "#ffffff";
			var width = groupEntities[0].lineWidth || 2;

			// Build connected segments
			for (var i = 0; i < groupEntities.length - 1; i++) {
				var p1 = groupEntities[i];
				var p2 = groupEntities[i + 1];

				self.addLine(
					p1.pointXLocation - originX,
					p1.pointYLocation - originY,
					p1.pointZLocation || 0,
					p2.pointXLocation - originX,
					p2.pointYLocation - originY,
					p2.pointZLocation || 0,
					color, width
				);
			}

			// Close if needed
			if (groupEntities[0].closed && groupEntities.length > 2) {
				var first = groupEntities[0];
				var last = groupEntities[groupEntities.length - 1];

				self.addLine(
					last.pointXLocation - originX,
					last.pointYLocation - originY,
					last.pointZLocation || 0,
					first.pointXLocation - originX,
					first.pointYLocation - originY,
					first.pointZLocation || 0,
					color, width
				);
			}
		});
	}

	/**
	 * Add KAD polygon entities
	 * @param {Array} entities - Array of polygon entities
	 * @param {Object} options - Options
	 */
	addKADPolygons(entities, options) {
		options = options || {};
		var originX = options.originX || 0;
		var originY = options.originY || 0;
		var self = this;

		// Group by entityName
		var groups = new Map();

		entities.forEach(function(entity) {
			if (entity.entityType !== "poly" && entity.entityType !== "polygon") return;
			if (!entity.visible) return;

			var key = entity.entityName || "default";
			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key).push(entity);
		});

		// Build polygons
		groups.forEach(function(groupEntities, entityName) {
			if (groupEntities.length < 2) return;

			groupEntities.sort(function(a, b) {
				return (a.pointID || 0) - (b.pointID || 0);
			});

			var color = groupEntities[0].color || "#ffffff";
			var width = groupEntities[0].lineWidth || 2;

			var points = groupEntities.map(function(e) {
				return {
					x: e.pointXLocation - originX,
					y: e.pointYLocation - originY,
					z: e.pointZLocation || 0
				};
			});

			// Polygons are always closed
			self.addPolygon(points, color, width);
		});
	}

	// ========================================
	// BUILD
	// ========================================

	/**
	 * Build all batched lines into meshes
	 * @param {THREE.Group} targetGroup - Group to add meshes to
	 */
	build(targetGroup) {
		var startTime = performance.now();
		var self = this;

		// Clear existing meshes
		this.clearMeshes();

		var batchCount = 0;
		var totalLines = 0;
		var totalVertices = 0;

		this.lineBatches.forEach(function(batch, key) {
			if (batch.positions.length === 0) return;

			var mesh;
			var isFatLine = self.config.useFatLines && batch.width >= self.config.thinLineThreshold;

			if (isFatLine) {
				// Use LineSegments2 for fat lines
				mesh = self._buildFatLineMesh(batch);
			} else {
				// Use regular LineSegments for thin lines
				mesh = self._buildThinLineMesh(batch);
			}

			mesh.userData = {
				type: "batchedLines",
				batchKey: key,
				lineCount: batch.positions.length / 6,
				color: batch.color,
				width: batch.width
			};

			targetGroup.add(mesh);
			self.builtMeshes.push(mesh);

			batchCount++;
			totalLines += batch.positions.length / 6;
			totalVertices += batch.positions.length / 3;
		});

		// Update stats
		this.stats.batchCount = batchCount;
		this.stats.linesRendered = totalLines;
		this.stats.totalVertices = totalVertices;
		this.stats.lastBuildTime = performance.now() - startTime;

		console.log("📏 LineRenderer: Built " + totalLines + " lines in " +
			batchCount + " batches (" + this.stats.lastBuildTime.toFixed(2) + "ms)");
	}

	/**
	 * Build fat line mesh (LineSegments2)
	 */
	_buildFatLineMesh(batch) {
		var geometry = new LineSegmentsGeometry();
		geometry.setPositions(batch.positions);

		this._tempColor.set(batch.color);

		var material = new LineMaterial({
			color: this._tempColor.getHex(),
			linewidth: batch.width,
			resolution: this.resolution,
			worldUnits: false,
			dashed: false
		});

		var mesh = new LineSegments2(geometry, material);
		mesh.computeLineDistances();

		return mesh;
	}

	/**
	 * Build thin line mesh (regular LineSegments)
	 */
	_buildThinLineMesh(batch) {
		var geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(batch.positions, 3)
		);

		this._tempColor.set(batch.color);

		var material = new THREE.LineBasicMaterial({
			color: this._tempColor.getHex()
		});

		return new THREE.LineSegments(geometry, material);
	}

	// ========================================
	// UPDATE
	// ========================================

	/**
	 * Update resolution for fat line materials
	 * @param {number} width - Canvas width
	 * @param {number} height - Canvas height
	 */
	updateResolution(width, height) {
		this.resolution.set(width, height);

		// Update all built fat line meshes
		this.builtMeshes.forEach(function(mesh) {
			if (mesh.material && mesh.material.resolution) {
				mesh.material.resolution.set(width, height);
			}
		});
	}

	// ========================================
	// CLEAR / DISPOSE
	// ========================================

	/**
	 * Clear all batched data (before rebuilding)
	 */
	clearBatches() {
		this.lineBatches.forEach(function(batch) {
			batch.positions = [];
		});
	}

	/**
	 * Clear built meshes from scene
	 */
	clearMeshes() {
		this.builtMeshes.forEach(function(mesh) {
			if (mesh.parent) mesh.parent.remove(mesh);
			if (mesh.geometry) mesh.geometry.dispose();
			if (mesh.material) mesh.material.dispose();
		});
		this.builtMeshes = [];
	}

	/**
	 * Clear everything
	 */
	clear() {
		this.clearMeshes();
		this.lineBatches.clear();

		this.stats.linesRendered = 0;
		this.stats.batchCount = 0;
		this.stats.totalVertices = 0;
	}

	/**
	 * Get statistics
	 * @returns {Object} Stats
	 */
	getStats() {
		return {
			linesRendered: this.stats.linesRendered,
			batchCount: this.stats.batchCount,
			totalVertices: this.stats.totalVertices,
			lastBuildTime: this.stats.lastBuildTime.toFixed(2) + "ms"
		};
	}

	/**
	 * Dispose all resources
	 */
	dispose() {
		this.clear();
		this.sceneManager = null;
		console.log("📏 LineRenderer disposed");
	}
}

export default LineRenderer;
