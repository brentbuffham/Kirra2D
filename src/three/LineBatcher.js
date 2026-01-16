/* prettier-ignore-file */
//=================================================
// LineBatcher.js - Optimized Line Batching for Large Datasets
//=================================================
// Batches all lines of same color/width into single draw calls
// Dramatically reduces GPU draw calls for complex CAD files
// Uses THREE.LineSegments2 for proper line width support

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

/**
 * LineBatcher - Accumulates line segments and creates optimized batches
 * 
 * Usage:
 *   const batcher = new LineBatcher(resolution);
 *   batcher.addSegment(x1, y1, z1, x2, y2, z2, color, width);
 *   // ... add more segments
 *   const meshes = batcher.finalize();
 *   meshes.forEach(mesh => scene.add(mesh));
 */
export class LineBatcher {
	constructor(resolution) {
		// Step 1) Store resolution for LineMaterial
		this.resolution = resolution || new THREE.Vector2(window.innerWidth, window.innerHeight);

		// Step 2) Batches grouped by color and width
		// Key format: "rrggbb_width" (e.g., "ff0000_2")
		this.batches = new Map();

		// Step 3) Metadata storage for picking/selection
		// Maps segment index to original entity data
		this.segmentMetadata = new Map();

		// Step 4) Statistics
		this.segmentCount = 0;
		this.batchCount = 0;

		// Step 5) Maximum segments per batch (WebGL limit consideration)
		this.maxSegmentsPerBatch = 65536; // ~65k segments = 128k vertices
	}

	/**
	 * Step 6) Get batch key from color and width
	 * @param {string|number} color - Color (hex string or THREE color)
	 * @param {number} width - Line width
	 * @returns {string} Batch key
	 */
	_getBatchKey(color, width) {
		var colorHex;
		if (typeof color === "string") {
			colorHex = color.replace("#", "").toLowerCase();
		} else if (typeof color === "number") {
			colorHex = color.toString(16).padStart(6, "0");
		} else if (color && color.getHexString) {
			colorHex = color.getHexString();
		} else {
			colorHex = "ffffff";
		}
		return colorHex + "_" + (width || 1);
	}

	/**
	 * Step 7) Get or create batch for color/width combination
	 * @param {string|number} color - Line color
	 * @param {number} width - Line width
	 * @returns {Object} Batch object
	 */
	_getOrCreateBatch(color, width) {
		var key = this._getBatchKey(color, width);

		if (!this.batches.has(key)) {
			this.batches.set(key, {
				key: key,
				color: color,
				width: width || 1,
				positions: [],    // Flat array [x1,y1,z1, x2,y2,z2, ...]
				segmentCount: 0,
				metadata: []      // Array of metadata per segment
			});
			this.batchCount++;
		}

		return this.batches.get(key);
	}

	/**
	 * Step 8) Add a line segment to the batcher
	 * @param {number} x1 - Start X
	 * @param {number} y1 - Start Y
	 * @param {number} z1 - Start Z
	 * @param {number} x2 - End X
	 * @param {number} y2 - End Y
	 * @param {number} z2 - End Z
	 * @param {string|number} color - Line color
	 * @param {number} width - Line width
	 * @param {Object} metadata - Optional metadata for picking
	 */
	addSegment(x1, y1, z1, x2, y2, z2, color, width, metadata) {
		var batch = this._getOrCreateBatch(color, width);

		// Step 8a) Add positions (2 vertices per segment = 6 floats)
		batch.positions.push(x1, y1, z1, x2, y2, z2);

		// Step 8b) Store metadata for this segment
		if (metadata) {
			batch.metadata.push(metadata);
		}

		batch.segmentCount++;
		this.segmentCount++;
	}

	/**
	 * Step 9) Add a polyline (connected points) to the batcher
	 * @param {Array} points - Array of {x, y, z} points
	 * @param {string|number} color - Line color
	 * @param {number} width - Line width
	 * @param {Object} metadata - Optional metadata for picking
	 * @param {boolean} closed - Whether to close the polyline
	 */
	addPolyline(points, color, width, metadata, closed) {
		if (!points || points.length < 2) return;

		var batch = this._getOrCreateBatch(color, width);

		// Step 9a) Add segments for each pair of consecutive points
		for (var i = 0; i < points.length - 1; i++) {
			var p1 = points[i];
			var p2 = points[i + 1];
			batch.positions.push(
				p1.x, p1.y, p1.z || 0,
				p2.x, p2.y, p2.z || 0
			);
			if (metadata) {
				batch.metadata.push(metadata);
			}
			batch.segmentCount++;
			this.segmentCount++;
		}

		// Step 9b) Close polyline if requested
		if (closed && points.length > 2) {
			var first = points[0];
			var last = points[points.length - 1];
			batch.positions.push(
				last.x, last.y, last.z || 0,
				first.x, first.y, first.z || 0
			);
			if (metadata) {
				batch.metadata.push(metadata);
			}
			batch.segmentCount++;
			this.segmentCount++;
		}
	}

	/**
	 * Step 10) Add a circle as line segments
	 * @param {number} centerX - Center X
	 * @param {number} centerY - Center Y
	 * @param {number} centerZ - Center Z
	 * @param {number} radius - Circle radius
	 * @param {string|number} color - Line color
	 * @param {number} width - Line width
	 * @param {Object} metadata - Optional metadata for picking
	 * @param {number} segments - Number of segments (default 32)
	 */
	addCircle(centerX, centerY, centerZ, radius, color, width, metadata, segments) {
		segments = segments || 32;
		var batch = this._getOrCreateBatch(color, width);
		var angleStep = (Math.PI * 2) / segments;

		for (var i = 0; i < segments; i++) {
			var angle1 = i * angleStep;
			var angle2 = (i + 1) * angleStep;

			var x1 = centerX + Math.cos(angle1) * radius;
			var y1 = centerY + Math.sin(angle1) * radius;
			var x2 = centerX + Math.cos(angle2) * radius;
			var y2 = centerY + Math.sin(angle2) * radius;

			batch.positions.push(x1, y1, centerZ, x2, y2, centerZ);
			if (metadata) {
				batch.metadata.push(metadata);
			}
			batch.segmentCount++;
			this.segmentCount++;
		}
	}

	/**
	 * Step 11) Finalize batches and create THREE.js objects
	 * @returns {Array} Array of LineSegments2 objects
	 */
	finalize() {
		var meshes = [];
		var self = this;

		this.batches.forEach(function(batch) {
			if (batch.positions.length === 0) return;

			// Step 11a) Create geometry
			var geometry = new LineSegmentsGeometry();
			geometry.setPositions(batch.positions);

			// Step 11b) Parse color
			var colorValue;
			if (typeof batch.color === "string") {
				colorValue = new THREE.Color(batch.color);
			} else if (typeof batch.color === "number") {
				colorValue = new THREE.Color(batch.color);
			} else if (batch.color && batch.color.isColor) {
				colorValue = batch.color;
			} else {
				colorValue = new THREE.Color(0xffffff);
			}

			// Step 11c) Create material
			var material = new LineMaterial({
				color: colorValue,
				linewidth: batch.width,
				resolution: self.resolution,
				dashed: false,
				alphaToCoverage: false
			});

			// Step 11d) Create mesh
			var mesh = new LineSegments2(geometry, material);
			mesh.computeLineDistances();

			// Step 11e) Store metadata in userData
			mesh.userData = {
				type: "batchedLines",
				batchKey: batch.key,
				segmentCount: batch.segmentCount,
				metadata: batch.metadata
			};

			meshes.push(mesh);
		});

		console.log("LineBatcher: Created " + meshes.length + " batches from " + this.segmentCount + " segments");
		return meshes;
	}

	/**
	 * Step 12) Create batched LineSegments (basic lines, no width support)
	 * Faster than LineSegments2 but no line width control
	 * @returns {Array} Array of THREE.LineSegments objects
	 */
	finalizeBasic() {
		var meshes = [];

		this.batches.forEach(function(batch) {
			if (batch.positions.length === 0) return;

			// Step 12a) Create BufferGeometry
			var geometry = new THREE.BufferGeometry();
			geometry.setAttribute("position", new THREE.Float32BufferAttribute(batch.positions, 3));

			// Step 12b) Parse color
			var colorValue;
			if (typeof batch.color === "string") {
				colorValue = new THREE.Color(batch.color);
			} else if (typeof batch.color === "number") {
				colorValue = new THREE.Color(batch.color);
			} else {
				colorValue = new THREE.Color(0xffffff);
			}

			// Step 12c) Create basic line material
			var material = new THREE.LineBasicMaterial({
				color: colorValue
			});

			// Step 12d) Create LineSegments
			var mesh = new THREE.LineSegments(geometry, material);

			// Step 12e) Store metadata
			mesh.userData = {
				type: "batchedLinesBasic",
				batchKey: batch.key,
				segmentCount: batch.segmentCount,
				metadata: batch.metadata
			};

			meshes.push(mesh);
		});

		return meshes;
	}

	/**
	 * Step 13) Clear all batches
	 */
	clear() {
		this.batches.clear();
		this.segmentMetadata.clear();
		this.segmentCount = 0;
		this.batchCount = 0;
	}

	/**
	 * Step 14) Get statistics
	 * @returns {Object} Statistics
	 */
	getStats() {
		var batchStats = [];
		this.batches.forEach(function(batch) {
			batchStats.push({
				key: batch.key,
				segmentCount: batch.segmentCount,
				vertexCount: batch.positions.length / 3
			});
		});

		return {
			totalSegments: this.segmentCount,
			totalBatches: this.batchCount,
			batches: batchStats
		};
	}

	/**
	 * Step 15) Update resolution (call on window resize)
	 * @param {number} width - New width
	 * @param {number} height - New height
	 */
	updateResolution(width, height) {
		this.resolution.set(width, height);
	}

	/**
	 * Step 16) Find segment at ray intersection
	 * @param {THREE.Raycaster} raycaster - Raycaster
	 * @param {Array} meshes - Array of batched line meshes
	 * @returns {Object|null} Hit info with metadata
	 */
	static findSegmentAtRay(raycaster, meshes) {
		var intersects = raycaster.intersectObjects(meshes, false);

		if (intersects.length > 0) {
			var hit = intersects[0];
			var mesh = hit.object;

			// Step 16a) Calculate which segment was hit
			if (mesh.userData && mesh.userData.metadata) {
				// For LineSegments2, faceIndex corresponds to segment
				var segmentIndex = hit.faceIndex !== undefined ? hit.faceIndex : 0;

				if (segmentIndex < mesh.userData.metadata.length) {
					return {
						point: hit.point,
						distance: hit.distance,
						segmentIndex: segmentIndex,
						metadata: mesh.userData.metadata[segmentIndex],
						mesh: mesh
					};
				}
			}

			return {
				point: hit.point,
				distance: hit.distance,
				segmentIndex: 0,
				metadata: null,
				mesh: mesh
			};
		}

		return null;
	}
}
