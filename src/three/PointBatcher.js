/* prettier-ignore-file */
//=================================================
// PointBatcher.js - Optimized Point Rendering using THREE.Points
//=================================================
// Batches all points into single draw call using THREE.Points
// Supports per-point colors, sizes, and selection
// Dramatically reduces GPU draw calls for point clouds

import * as THREE from "three";

/**
 * PointBatcher - Accumulates points and creates optimized batch
 * 
 * Usage:
 *   const batcher = new PointBatcher();
 *   batcher.addPoint(x, y, z, color, size, metadata);
 *   // ... add more points
 *   const points = batcher.finalize();
 *   scene.add(points);
 */
export class PointBatcher {
	constructor() {
		// Step 1) Point data arrays
		this.positions = [];  // Float32: x, y, z
		this.colors = [];     // Float32: r, g, b
		this.sizes = [];      // Float32: size

		// Step 2) Metadata for picking/selection
		this.metadata = [];   // Array of metadata objects

		// Step 3) Statistics
		this.pointCount = 0;

		// Step 4) Default values
		this.defaultColor = new THREE.Color(0xffffff);
		this.defaultSize = 5.0;

		// Step 5) Maximum points per batch (WebGL buffer limit)
		this.maxPointsPerBatch = 1000000; // 1M points

		// Step 6) For multi-batch support
		this.batches = [];
	}

	/**
	 * Step 7) Add a single point
	 * @param {number} x - X coordinate
	 * @param {number} y - Y coordinate
	 * @param {number} z - Z coordinate
	 * @param {string|number|THREE.Color} color - Point color
	 * @param {number} size - Point size
	 * @param {Object} metadata - Optional metadata for picking
	 */
	addPoint(x, y, z, color, size, metadata) {
		// Step 7a) Add position
		this.positions.push(x, y, z || 0);

		// Step 7b) Parse and add color
		var colorObj = this._parseColor(color);
		this.colors.push(colorObj.r, colorObj.g, colorObj.b);

		// Step 7c) Add size
		this.sizes.push(size || this.defaultSize);

		// Step 7d) Store metadata
		this.metadata.push(metadata || null);

		this.pointCount++;

		// Step 7e) Check if we need to start a new batch
		if (this.pointCount >= this.maxPointsPerBatch) {
			this._createBatch();
			this.positions = [];
			this.colors = [];
			this.sizes = [];
			this.metadata = [];
			this.pointCount = 0;
		}
	}

	/**
	 * Step 8) Add multiple points from array
	 * @param {Array} points - Array of point objects {x, y, z, color?, size?, metadata?}
	 */
	addPoints(points) {
		var self = this;
		points.forEach(function(p) {
			self.addPoint(p.x, p.y, p.z, p.color, p.size, p.metadata);
		});
	}

	/**
	 * Step 9) Add points from flat position array
	 * @param {Float32Array|Array} positions - Flat array [x,y,z,x,y,z,...]
	 * @param {string|number|THREE.Color} color - Common color for all points
	 * @param {number} size - Common size for all points
	 * @param {Object} metadata - Common metadata for all points
	 */
	addPointsFromArray(positions, color, size, metadata) {
		var colorObj = this._parseColor(color);

		for (var i = 0; i < positions.length; i += 3) {
			this.positions.push(positions[i], positions[i + 1], positions[i + 2] || 0);
			this.colors.push(colorObj.r, colorObj.g, colorObj.b);
			this.sizes.push(size || this.defaultSize);
			this.metadata.push(metadata || null);
			this.pointCount++;
		}
	}

	/**
	 * Step 10) Parse color to THREE.Color
	 * @param {string|number|THREE.Color} color - Input color
	 * @returns {THREE.Color} Parsed color
	 */
	_parseColor(color) {
		if (!color) return this.defaultColor;

		if (color.isColor) return color;

		if (typeof color === "string") {
			// Handle rgb() strings
			if (color.startsWith("rgb")) {
				var match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
				if (match) {
					return new THREE.Color(
						parseInt(match[1]) / 255,
						parseInt(match[2]) / 255,
						parseInt(match[3]) / 255
					);
				}
			}
			return new THREE.Color(color);
		}

		if (typeof color === "number") {
			return new THREE.Color(color);
		}

		return this.defaultColor;
	}

	/**
	 * Step 11) Create a batch from current data
	 */
	_createBatch() {
		if (this.positions.length === 0) return;

		var batch = {
			positions: new Float32Array(this.positions),
			colors: new Float32Array(this.colors),
			sizes: new Float32Array(this.sizes),
			metadata: this.metadata.slice(),
			pointCount: this.pointCount
		};

		this.batches.push(batch);
	}

	/**
	 * Step 12) Finalize and create THREE.Points object(s)
	 * @param {Object} options - Options for material
	 * @returns {THREE.Points|THREE.Group} Points object or group of points
	 */
	finalize(options) {
		options = options || {};

		// Step 12a) Create batch from remaining data
		this._createBatch();

		// Step 12b) If only one batch, return single Points
		if (this.batches.length === 1) {
			return this._createPointsFromBatch(this.batches[0], options);
		}

		// Step 12c) Multiple batches - return group
		var group = new THREE.Group();
		group.name = "BatchedPointsGroup";

		var self = this;
		this.batches.forEach(function(batch, index) {
			var points = self._createPointsFromBatch(batch, options);
			points.name = "BatchedPoints_" + index;
			group.add(points);
		});

		console.log("PointBatcher: Created " + this.batches.length + " batches with " + this.getTotalPointCount() + " total points");
		return group;
	}

	/**
	 * Step 13) Create THREE.Points from batch data
	 * @param {Object} batch - Batch data
	 * @param {Object} options - Material options
	 * @returns {THREE.Points} Points object
	 */
	_createPointsFromBatch(batch, options) {
		// Step 13a) Create geometry
		var geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.BufferAttribute(batch.positions, 3));
		geometry.setAttribute("color", new THREE.BufferAttribute(batch.colors, 3));

		// Step 13b) Add size attribute if varying sizes
		var hasVaryingSizes = false;
		var firstSize = batch.sizes[0];
		for (var i = 1; i < batch.sizes.length; i++) {
			if (batch.sizes[i] !== firstSize) {
				hasVaryingSizes = true;
				break;
			}
		}

		if (hasVaryingSizes) {
			geometry.setAttribute("size", new THREE.BufferAttribute(batch.sizes, 1));
		}

		// Step 13c) Create material
		var material;
		if (hasVaryingSizes && options.useShader !== false) {
			// Step 13c.1) Use custom shader for varying sizes
			material = this._createSizeVaryingMaterial(options);
		} else {
			// Step 13c.2) Standard PointsMaterial
			material = new THREE.PointsMaterial({
				size: firstSize || options.size || this.defaultSize,
				sizeAttenuation: options.sizeAttenuation !== false,
				vertexColors: true,
				transparent: options.transparent !== false,
				opacity: options.opacity !== undefined ? options.opacity : 1.0,
				depthTest: options.depthTest !== false,
				depthWrite: options.depthWrite !== false
			});
		}

		// Step 13d) Create Points object
		var points = new THREE.Points(geometry, material);

		// Step 13e) Store metadata in userData
		points.userData = {
			type: "batchedPoints",
			pointCount: batch.pointCount,
			metadata: batch.metadata,
			hasVaryingSizes: hasVaryingSizes
		};

		return points;
	}

	/**
	 * Step 14) Create custom shader material for varying point sizes
	 * @param {Object} options - Material options
	 * @returns {THREE.ShaderMaterial} Shader material
	 */
	_createSizeVaryingMaterial(options) {
		var vertexShader = [
			"attribute float size;",
			"varying vec3 vColor;",
			"void main() {",
			"  vColor = color;",
			"  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
			"  gl_PointSize = size * (300.0 / -mvPosition.z);",
			"  gl_Position = projectionMatrix * mvPosition;",
			"}"
		].join("\n");

		var fragmentShader = [
			"varying vec3 vColor;",
			"uniform float opacity;",
			"void main() {",
			"  // Circular point",
			"  float r = length(gl_PointCoord - vec2(0.5, 0.5));",
			"  if (r > 0.5) discard;",
			"  gl_FragColor = vec4(vColor, opacity);",
			"}"
		].join("\n");

		return new THREE.ShaderMaterial({
			uniforms: {
				opacity: { value: options.opacity !== undefined ? options.opacity : 1.0 }
			},
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			vertexColors: true,
			transparent: options.transparent !== false,
			depthTest: options.depthTest !== false,
			depthWrite: options.depthWrite !== false
		});
	}

	/**
	 * Step 15) Clear all data
	 */
	clear() {
		this.positions = [];
		this.colors = [];
		this.sizes = [];
		this.metadata = [];
		this.batches = [];
		this.pointCount = 0;
	}

	/**
	 * Step 16) Get total point count across all batches
	 * @returns {number} Total points
	 */
	getTotalPointCount() {
		var total = this.pointCount;
		this.batches.forEach(function(batch) {
			total += batch.pointCount;
		});
		return total;
	}

	/**
	 * Step 17) Get statistics
	 * @returns {Object} Statistics
	 */
	getStats() {
		return {
			currentBatchPoints: this.pointCount,
			completedBatches: this.batches.length,
			totalPoints: this.getTotalPointCount()
		};
	}

	/**
	 * Step 18) Find point at ray intersection
	 * @param {THREE.Raycaster} raycaster - Raycaster
	 * @param {THREE.Points|THREE.Group} pointsObject - Points object from finalize()
	 * @param {number} threshold - Selection threshold (default 1.0)
	 * @returns {Object|null} Hit info with metadata
	 */
	static findPointAtRay(raycaster, pointsObject, threshold) {
		threshold = threshold || 1.0;

		// Step 18a) Store original threshold
		var originalThreshold = raycaster.params.Points.threshold;
		raycaster.params.Points.threshold = threshold;

		// Step 18b) Get all Points objects
		var pointsObjects = [];
		if (pointsObject.isPoints) {
			pointsObjects.push(pointsObject);
		} else if (pointsObject.isGroup) {
			pointsObject.children.forEach(function(child) {
				if (child.isPoints) {
					pointsObjects.push(child);
				}
			});
		}

		// Step 18c) Raycast
		var intersects = raycaster.intersectObjects(pointsObjects, false);

		// Step 18d) Restore threshold
		raycaster.params.Points.threshold = originalThreshold;

		// Step 18e) Process results
		if (intersects.length > 0) {
			var hit = intersects[0];
			var points = hit.object;

			if (points.userData && points.userData.metadata) {
				var pointIndex = hit.index;

				if (pointIndex < points.userData.metadata.length) {
					return {
						point: hit.point,
						distance: hit.distance,
						index: pointIndex,
						metadata: points.userData.metadata[pointIndex],
						object: points
					};
				}
			}

			return {
				point: hit.point,
				distance: hit.distance,
				index: hit.index,
				metadata: null,
				object: points
			};
		}

		return null;
	}

	/**
	 * Step 19) Highlight specific points (selection)
	 * @param {THREE.Points} pointsObject - Points object
	 * @param {Array} indices - Array of point indices to highlight
	 * @param {THREE.Color} highlightColor - Highlight color
	 */
	static highlightPoints(pointsObject, indices, highlightColor) {
		if (!pointsObject || !pointsObject.geometry) return;

		var colors = pointsObject.geometry.attributes.color;
		if (!colors) return;

		var colorArray = colors.array;
		var color = highlightColor || new THREE.Color(0xff00ff);

		indices.forEach(function(idx) {
			var i = idx * 3;
			if (i + 2 < colorArray.length) {
				colorArray[i] = color.r;
				colorArray[i + 1] = color.g;
				colorArray[i + 2] = color.b;
			}
		});

		colors.needsUpdate = true;
	}

	/**
	 * Step 20) Reset point colors to original
	 * @param {THREE.Points} pointsObject - Points object
	 * @param {Array} originalColors - Original colors array (from backup)
	 */
	static resetPointColors(pointsObject, originalColors) {
		if (!pointsObject || !pointsObject.geometry || !originalColors) return;

		var colors = pointsObject.geometry.attributes.color;
		if (!colors) return;

		colors.array.set(originalColors);
		colors.needsUpdate = true;
	}

	/**
	 * Step 21) Backup original colors before highlighting
	 * @param {THREE.Points} pointsObject - Points object
	 * @returns {Float32Array} Backup of color array
	 */
	static backupPointColors(pointsObject) {
		if (!pointsObject || !pointsObject.geometry) return null;

		var colors = pointsObject.geometry.attributes.color;
		if (!colors) return null;

		return new Float32Array(colors.array);
	}
}
