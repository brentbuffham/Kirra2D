/* prettier-ignore-file */
//=================================================
// BatchManager.js - Geometry Batching for Performance
//=================================================
// Merges similar geometries into single draw calls for massive performance gains
// Key features:
// - Groups lines by color/width into LineSegments2 batches
// - Groups points into single Points geometry
// - Groups triangles by material into single meshes
// - Automatic rebatching when dirty flag set
//
// Target: Reduce draw calls from 1000s to <50 for typical scenes
//=================================================

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export class BatchManager {
	constructor(scene) {
		// Step 1) Store scene reference
		this.scene = scene;

		// Step 2) Batch storage by type
		// Format: { "lines_#ffffff_2": { positions: [], colors: [], mesh: null }, ... }
		this.lineBatches = new Map();
		this.pointBatches = new Map();
		this.triangleBatches = new Map();

		// Step 3) Track which batches are dirty
		this.dirtyBatches = new Set();

		// Step 4) Configuration
		this.config = {
			maxVerticesPerBatch: 100000,  // Split large batches
			autoFlush: true,              // Auto-rebuild when dirty
			lineWidthPrecision: 0.5       // Group lines within this width tolerance
		};

		// Step 5) Statistics
		this.stats = {
			lineBatches: 0,
			pointBatches: 0,
			triangleBatches: 0,
			totalVertices: 0,
			drawCallsSaved: 0
		};

		// Step 6) Reusable objects
		this._tempColor = new THREE.Color();
		this._tempVec3 = new THREE.Vector3();

		console.log("📦 BatchManager initialized");
	}

	// ========================================
	// LINE BATCHING
	// ========================================

	/**
	 * Get batch key for a line with given properties
	 * @param {string|number} color - Hex color
	 * @param {number} lineWidth - Line width in pixels
	 * @returns {string} Batch key
	 */
	_getLineBatchKey(color, lineWidth) {
		// Normalize color to hex string
		var colorHex;
		if (typeof color === "number") {
			colorHex = color.toString(16).padStart(6, "0");
		} else if (typeof color === "string") {
			colorHex = color.replace("#", "").toLowerCase();
		} else {
			colorHex = "ffffff";
		}

		// Round lineWidth to reduce batch fragmentation
		var roundedWidth = Math.round(lineWidth / this.config.lineWidthPrecision) * this.config.lineWidthPrecision;
		if (roundedWidth < 1) roundedWidth = 1;

		return "lines_" + colorHex + "_" + roundedWidth;
	}

	/**
	 * Add line segment to batch
	 * @param {number} x1 - Start X
	 * @param {number} y1 - Start Y
	 * @param {number} z1 - Start Z
	 * @param {number} x2 - End X
	 * @param {number} y2 - End Y
	 * @param {number} z2 - End Z
	 * @param {string|number} color - Line color
	 * @param {number} lineWidth - Line width (default 1)
	 */
	addLine(x1, y1, z1, x2, y2, z2, color, lineWidth) {
		if (lineWidth === undefined) lineWidth = 1;

		var key = this._getLineBatchKey(color, lineWidth);

		// Get or create batch
		if (!this.lineBatches.has(key)) {
			this.lineBatches.set(key, {
				positions: [],
				color: color,
				lineWidth: lineWidth,
				mesh: null
			});
		}

		var batch = this.lineBatches.get(key);

		// Add line segment (two points)
		batch.positions.push(x1, y1, z1, x2, y2, z2);

		// Mark batch as dirty
		this.dirtyBatches.add(key);
	}

	/**
	 * Add multiple connected line segments (polyline)
	 * @param {Array} points - Array of {x, y, z} or [x, y, z]
	 * @param {string|number} color - Line color
	 * @param {number} lineWidth - Line width
	 * @param {boolean} closed - Close the polyline
	 */
	addPolyline(points, color, lineWidth, closed) {
		if (!points || points.length < 2) return;
		if (lineWidth === undefined) lineWidth = 1;
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

			this.addLine(x1, y1, z1, x2, y2, z2, color, lineWidth);
		}

		// Close the polyline if requested
		if (closed && points.length > 2) {
			var first = points[0];
			var last = points[points.length - 1];

			var fx = Array.isArray(first) ? first[0] : first.x;
			var fy = Array.isArray(first) ? first[1] : first.y;
			var fz = Array.isArray(first) ? first[2] : (first.z || 0);
			var lx = Array.isArray(last) ? last[0] : last.x;
			var ly = Array.isArray(last) ? last[1] : last.y;
			var lz = Array.isArray(last) ? last[2] : (last.z || 0);

			this.addLine(lx, ly, lz, fx, fy, fz, color, lineWidth);
		}
	}

	/**
	 * Build/rebuild dirty line batches
	 * @param {THREE.Group} targetGroup - Group to add meshes to
	 */
	flushLineBatches(targetGroup) {
		var self = this;
		var resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

		this.dirtyBatches.forEach(function(key) {
			if (!key.startsWith("lines_")) return;

			var batch = self.lineBatches.get(key);
			if (!batch || batch.positions.length === 0) return;

			// Remove old mesh if exists
			if (batch.mesh) {
				targetGroup.remove(batch.mesh);
				if (batch.mesh.geometry) batch.mesh.geometry.dispose();
				if (batch.mesh.material) batch.mesh.material.dispose();
				batch.mesh = null;
			}

			// Create new geometry
			var geometry = new LineSegmentsGeometry();
			geometry.setPositions(batch.positions);

			// Parse color
			self._tempColor.set(batch.color);

			// Create material
			var material = new LineMaterial({
				color: self._tempColor.getHex(),
				linewidth: batch.lineWidth,
				resolution: resolution,
				worldUnits: false,
				dashed: false
			});

			// Create mesh
			var mesh = new LineSegments2(geometry, material);
			mesh.computeLineDistances();
			mesh.userData = {
				type: "batchedLines",
				batchKey: key,
				lineCount: batch.positions.length / 6
			};

			// Add to group
			targetGroup.add(mesh);
			batch.mesh = mesh;

			self.stats.lineBatches++;
		});

		// Clear dirty flags for processed batches
		this.dirtyBatches.forEach(function(key) {
			if (key.startsWith("lines_")) {
				self.dirtyBatches.delete(key);
			}
		});
	}

	// ========================================
	// POINT BATCHING
	// ========================================

	/**
	 * Get batch key for points with given properties
	 * @param {string|number} color - Point color
	 * @param {number} size - Point size
	 * @returns {string} Batch key
	 */
	_getPointBatchKey(color, size) {
		var colorHex;
		if (typeof color === "number") {
			colorHex = color.toString(16).padStart(6, "0");
		} else if (typeof color === "string") {
			colorHex = color.replace("#", "").toLowerCase();
		} else {
			colorHex = "ffffff";
		}

		var roundedSize = Math.round(size);
		if (roundedSize < 1) roundedSize = 1;

		return "points_" + colorHex + "_" + roundedSize;
	}

	/**
	 * Add point to batch
	 * @param {number} x - X coordinate
	 * @param {number} y - Y coordinate
	 * @param {number} z - Z coordinate
	 * @param {string|number} color - Point color
	 * @param {number} size - Point size (default 3)
	 */
	addPoint(x, y, z, color, size) {
		if (size === undefined) size = 3;

		var key = this._getPointBatchKey(color, size);

		// Get or create batch
		if (!this.pointBatches.has(key)) {
			this.pointBatches.set(key, {
				positions: [],
				color: color,
				size: size,
				mesh: null
			});
		}

		var batch = this.pointBatches.get(key);
		batch.positions.push(x, y, z);

		this.dirtyBatches.add(key);
	}

	/**
	 * Add multiple points at once
	 * @param {Array} points - Array of {x, y, z} or [x, y, z]
	 * @param {string|number} color - Point color
	 * @param {number} size - Point size
	 */
	addPoints(points, color, size) {
		if (!points || points.length === 0) return;
		if (size === undefined) size = 3;

		for (var i = 0; i < points.length; i++) {
			var p = points[i];
			var x = Array.isArray(p) ? p[0] : p.x;
			var y = Array.isArray(p) ? p[1] : p.y;
			var z = Array.isArray(p) ? p[2] : (p.z || 0);
			this.addPoint(x, y, z, color, size);
		}
	}

	/**
	 * Build/rebuild dirty point batches
	 * @param {THREE.Group} targetGroup - Group to add meshes to
	 */
	flushPointBatches(targetGroup) {
		var self = this;

		this.dirtyBatches.forEach(function(key) {
			if (!key.startsWith("points_")) return;

			var batch = self.pointBatches.get(key);
			if (!batch || batch.positions.length === 0) return;

			// Remove old mesh if exists
			if (batch.mesh) {
				targetGroup.remove(batch.mesh);
				if (batch.mesh.geometry) batch.mesh.geometry.dispose();
				if (batch.mesh.material) batch.mesh.material.dispose();
				batch.mesh = null;
			}

			// Create geometry
			var geometry = new THREE.BufferGeometry();
			geometry.setAttribute(
				"position",
				new THREE.Float32BufferAttribute(batch.positions, 3)
			);

			// Parse color
			self._tempColor.set(batch.color);

			// Create material
			var material = new THREE.PointsMaterial({
				color: self._tempColor.getHex(),
				size: batch.size,
				sizeAttenuation: false
			});

			// Create mesh
			var mesh = new THREE.Points(geometry, material);
			mesh.userData = {
				type: "batchedPoints",
				batchKey: key,
				pointCount: batch.positions.length / 3
			};

			// Add to group
			targetGroup.add(mesh);
			batch.mesh = mesh;

			self.stats.pointBatches++;
		});

		// Clear dirty flags
		this.dirtyBatches.forEach(function(key) {
			if (key.startsWith("points_")) {
				self.dirtyBatches.delete(key);
			}
		});
	}

	// ========================================
	// TRIANGLE BATCHING
	// ========================================

	/**
	 * Get batch key for triangles
	 * @param {string|number} color - Triangle color
	 * @param {boolean} transparent - Transparency flag
	 * @param {number} opacity - Opacity value
	 * @returns {string} Batch key
	 */
	_getTriangleBatchKey(color, transparent, opacity) {
		var colorHex;
		if (typeof color === "number") {
			colorHex = color.toString(16).padStart(6, "0");
		} else if (typeof color === "string") {
			colorHex = color.replace("#", "").toLowerCase();
		} else {
			colorHex = "ffffff";
		}

		var opacityKey = transparent ? "_" + Math.round(opacity * 100) : "_100";
		return "tris_" + colorHex + opacityKey;
	}

	/**
	 * Add triangle to batch
	 * @param {Array} vertices - [x1,y1,z1, x2,y2,z2, x3,y3,z3]
	 * @param {string|number} color - Triangle color
	 * @param {boolean} transparent - Transparency flag
	 * @param {number} opacity - Opacity value (0-1)
	 */
	addTriangle(vertices, color, transparent, opacity) {
		if (transparent === undefined) transparent = false;
		if (opacity === undefined) opacity = 1.0;

		var key = this._getTriangleBatchKey(color, transparent, opacity);

		// Get or create batch
		if (!this.triangleBatches.has(key)) {
			this.triangleBatches.set(key, {
				positions: [],
				color: color,
				transparent: transparent,
				opacity: opacity,
				mesh: null
			});
		}

		var batch = this.triangleBatches.get(key);

		// Add 9 floats (3 vertices * 3 components)
		for (var i = 0; i < vertices.length; i++) {
			batch.positions.push(vertices[i]);
		}

		this.dirtyBatches.add(key);
	}

	/**
	 * Add multiple triangles at once
	 * @param {Array} triangles - Array of triangle vertex arrays
	 * @param {string|number} color - Color
	 * @param {boolean} transparent - Transparency
	 * @param {number} opacity - Opacity
	 */
	addTriangles(triangles, color, transparent, opacity) {
		for (var i = 0; i < triangles.length; i++) {
			this.addTriangle(triangles[i], color, transparent, opacity);
		}
	}

	/**
	 * Build/rebuild dirty triangle batches
	 * @param {THREE.Group} targetGroup - Group to add meshes to
	 */
	flushTriangleBatches(targetGroup) {
		var self = this;

		this.dirtyBatches.forEach(function(key) {
			if (!key.startsWith("tris_")) return;

			var batch = self.triangleBatches.get(key);
			if (!batch || batch.positions.length === 0) return;

			// Remove old mesh
			if (batch.mesh) {
				targetGroup.remove(batch.mesh);
				if (batch.mesh.geometry) batch.mesh.geometry.dispose();
				if (batch.mesh.material) batch.mesh.material.dispose();
				batch.mesh = null;
			}

			// Create geometry
			var geometry = new THREE.BufferGeometry();
			geometry.setAttribute(
				"position",
				new THREE.Float32BufferAttribute(batch.positions, 3)
			);
			geometry.computeVertexNormals();

			// Parse color
			self._tempColor.set(batch.color);

			// Create material
			var material = new THREE.MeshBasicMaterial({
				color: self._tempColor.getHex(),
				side: THREE.DoubleSide,
				transparent: batch.transparent,
				opacity: batch.opacity
			});

			// Create mesh
			var mesh = new THREE.Mesh(geometry, material);
			mesh.userData = {
				type: "batchedTriangles",
				batchKey: key,
				triangleCount: batch.positions.length / 9
			};

			targetGroup.add(mesh);
			batch.mesh = mesh;

			self.stats.triangleBatches++;
		});

		// Clear dirty flags
		this.dirtyBatches.forEach(function(key) {
			if (key.startsWith("tris_")) {
				self.dirtyBatches.delete(key);
			}
		});
	}

	// ========================================
	// BATCH MANAGEMENT
	// ========================================

	/**
	 * Flush all dirty batches
	 * @param {THREE.Group} linesGroup - Group for line batches
	 * @param {THREE.Group} pointsGroup - Group for point batches
	 * @param {THREE.Group} meshGroup - Group for triangle batches
	 */
	flushAll(linesGroup, pointsGroup, meshGroup) {
		if (linesGroup) this.flushLineBatches(linesGroup);
		if (pointsGroup) this.flushPointBatches(pointsGroup);
		if (meshGroup) this.flushTriangleBatches(meshGroup);
	}

	/**
	 * Clear all batches
	 */
	clearAll() {
		var self = this;

		// Dispose line batches
		this.lineBatches.forEach(function(batch) {
			if (batch.mesh) {
				if (batch.mesh.parent) batch.mesh.parent.remove(batch.mesh);
				if (batch.mesh.geometry) batch.mesh.geometry.dispose();
				if (batch.mesh.material) batch.mesh.material.dispose();
			}
		});
		this.lineBatches.clear();

		// Dispose point batches
		this.pointBatches.forEach(function(batch) {
			if (batch.mesh) {
				if (batch.mesh.parent) batch.mesh.parent.remove(batch.mesh);
				if (batch.mesh.geometry) batch.mesh.geometry.dispose();
				if (batch.mesh.material) batch.mesh.material.dispose();
			}
		});
		this.pointBatches.clear();

		// Dispose triangle batches
		this.triangleBatches.forEach(function(batch) {
			if (batch.mesh) {
				if (batch.mesh.parent) batch.mesh.parent.remove(batch.mesh);
				if (batch.mesh.geometry) batch.mesh.geometry.dispose();
				if (batch.mesh.material) batch.mesh.material.dispose();
			}
		});
		this.triangleBatches.clear();

		this.dirtyBatches.clear();

		// Reset stats
		this.stats.lineBatches = 0;
		this.stats.pointBatches = 0;
		this.stats.triangleBatches = 0;
		this.stats.totalVertices = 0;
		this.stats.drawCallsSaved = 0;
	}

	/**
	 * Clear specific batch type
	 * @param {string} type - "lines", "points", or "triangles"
	 */
	clearType(type) {
		var self = this;

		if (type === "lines") {
			this.lineBatches.forEach(function(batch) {
				if (batch.mesh) {
					if (batch.mesh.parent) batch.mesh.parent.remove(batch.mesh);
					if (batch.mesh.geometry) batch.mesh.geometry.dispose();
					if (batch.mesh.material) batch.mesh.material.dispose();
				}
			});
			this.lineBatches.clear();
		} else if (type === "points") {
			this.pointBatches.forEach(function(batch) {
				if (batch.mesh) {
					if (batch.mesh.parent) batch.mesh.parent.remove(batch.mesh);
					if (batch.mesh.geometry) batch.mesh.geometry.dispose();
					if (batch.mesh.material) batch.mesh.material.dispose();
				}
			});
			this.pointBatches.clear();
		} else if (type === "triangles") {
			this.triangleBatches.forEach(function(batch) {
				if (batch.mesh) {
					if (batch.mesh.parent) batch.mesh.parent.remove(batch.mesh);
					if (batch.mesh.geometry) batch.mesh.geometry.dispose();
					if (batch.mesh.material) batch.mesh.material.dispose();
				}
			});
			this.triangleBatches.clear();
		}
	}

	/**
	 * Get batch statistics
	 * @returns {Object} Stats
	 */
	getStats() {
		var totalVertices = 0;
		var lineVertices = 0;
		var pointVertices = 0;
		var triangleVertices = 0;

		this.lineBatches.forEach(function(batch) {
			lineVertices += batch.positions.length / 3;
		});

		this.pointBatches.forEach(function(batch) {
			pointVertices += batch.positions.length / 3;
		});

		this.triangleBatches.forEach(function(batch) {
			triangleVertices += batch.positions.length / 3;
		});

		totalVertices = lineVertices + pointVertices + triangleVertices;

		return {
			lineBatches: this.lineBatches.size,
			pointBatches: this.pointBatches.size,
			triangleBatches: this.triangleBatches.size,
			totalBatches: this.lineBatches.size + this.pointBatches.size + this.triangleBatches.size,
			lineVertices: lineVertices,
			pointVertices: pointVertices,
			triangleVertices: triangleVertices,
			totalVertices: totalVertices,
			dirtyBatches: this.dirtyBatches.size
		};
	}

	/**
	 * Dispose and cleanup
	 */
	dispose() {
		this.clearAll();
		this.scene = null;
		console.log("📦 BatchManager disposed");
	}
}

export default BatchManager;
