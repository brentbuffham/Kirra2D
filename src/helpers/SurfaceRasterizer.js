// src/helpers/SurfaceRasterizer.js
//=============================================================
// SURFACE RASTERIZATION HELPER
//=============================================================
// Step 1) Converts triangle mesh surfaces to elevation grids
// Step 2) Used for GeoTIFF elevation export
// Step 3) Created: 2026-01-09

/**
 * Rasterize triangle mesh to elevation grid
 * @param {Object} surface - Surface object with triangles array
 * @param {number} resolution - Grid resolution in world units (e.g., 1.0 = 1 meter)
 * @returns {Object|null} {elevationData, bbox, width, height, resolution} or null on error
 */
export function rasterizeSurfaceToElevationGrid(surface, resolution) {
	try {
		// Step 1) Calculate bounding box from triangles
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		var minZ = Infinity, maxZ = -Infinity;

		surface.triangles.forEach(function(tri) {
			tri.vertices.forEach(function(v) {
				minX = Math.min(minX, v.x);
				minY = Math.min(minY, v.y);
				maxX = Math.max(maxX, v.x);
				maxY = Math.max(maxY, v.y);
				minZ = Math.min(minZ, v.z);
				maxZ = Math.max(maxZ, v.z);
			});
		});

		var bbox = [minX, minY, maxX, maxY];

		// Step 2) Calculate grid dimensions
		var width = Math.ceil((maxX - minX) / resolution);
		var height = Math.ceil((maxY - minY) / resolution);

		// Limit grid size to prevent memory issues
		var maxGridSize = 10000;
		if (width > maxGridSize || height > maxGridSize) {
			console.warn("Grid too large (" + width + "x" + height + "), using coarser resolution");
			var scale = Math.max(width, height) / maxGridSize;
			resolution *= scale;
			width = Math.ceil((maxX - minX) / resolution);
			height = Math.ceil((maxY - minY) / resolution);
		}

		console.log("Rasterizing surface: " + width + "x" + height + " grid at " + resolution.toFixed(2) + "m resolution");

		// Step 3) Create elevation grid
		var elevationData = new Float32Array(width * height);
		elevationData.fill(-9999); // Initialize with nodata value

		// Step 4) Rasterize each triangle
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				// Calculate world coordinates for this pixel
				var worldX = minX + (x + 0.5) * resolution;
				var worldY = maxY - (y + 0.5) * resolution; // Y axis is flipped

				// Find triangle containing this point and interpolate Z
				var z = interpolateZFromTriangles(worldX, worldY, surface.triangles);

				if (z !== null) {
					elevationData[y * width + x] = z;
				}
			}
		}

		return {
			elevationData: elevationData,
			bbox: bbox,
			width: width,
			height: height,
			resolution: resolution
		};
	} catch (error) {
		console.error("Error rasterizing surface:", error);
		return null;
	}
}

/**
 * Interpolate Z value from triangles at given XY position
 * Uses barycentric coordinate interpolation
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @param {Array} triangles - Array of triangle objects with vertices
 * @returns {number|null} Interpolated Z value or null if point not in any triangle
 */
export function interpolateZFromTriangles(x, y, triangles) {
	// Find triangle containing point (x, y)
	for (var i = 0; i < triangles.length; i++) {
		var tri = triangles[i];
		var v0 = tri.vertices[0];
		var v1 = tri.vertices[1];
		var v2 = tri.vertices[2];

		// Check if point is inside triangle using barycentric coordinates
		var denominator = ((v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y));
		if (Math.abs(denominator) < 0.0001) continue; // Degenerate triangle

		var a = ((v1.y - v2.y) * (x - v2.x) + (v2.x - v1.x) * (y - v2.y)) / denominator;
		var b = ((v2.y - v0.y) * (x - v2.x) + (v0.x - v2.x) * (y - v2.y)) / denominator;
		var c = 1 - a - b;

		// Point is inside triangle if all barycentric coords are in [0, 1]
		if (a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1) {
			// Interpolate Z using barycentric coordinates
			return a * v0.z + b * v1.z + c * v2.z;
		}
	}

	return null; // Point not in any triangle
}

/**
 * Convert bounds object to bbox array
 * @param {Object} bounds - Bounds object with {minX, maxX, minY, maxY}
 * @returns {Array} Bbox array [minX, minY, maxX, maxY]
 */
export function boundsToArray(bounds) {
	if (!bounds) return null;
	if (Array.isArray(bounds)) return bounds;
	return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
}

/**
 * Render surface to canvas at specific resolution (no padding, tight crop)
 * @param {Object} surface - Surface object with triangles and points
 * @param {number} pixelsPerMeter - Target resolution in pixels per meter
 * @param {Function} elevationToColor - Color mapping function from kirra.js
 * @returns {Object} {canvas, bbox, width, height} or null on error
 */
export function renderSurfaceToCanvas(surface, pixelsPerMeter, elevationToColor) {
	try {
		// Step 1) Calculate tight surface bounds (NO padding)
		var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		var minZ = Infinity, maxZ = -Infinity;

		surface.points.forEach(function (point) {
			minX = Math.min(minX, point.x);
			maxX = Math.max(maxX, point.x);
			minY = Math.min(minY, point.y);
			maxY = Math.max(maxY, point.y);
			minZ = Math.min(minZ, point.z);
			maxZ = Math.max(maxZ, point.z);
		});

		var bbox = [minX, minY, maxX, maxY];

		// Step 2) Calculate canvas size based on resolution
		var worldWidth = maxX - minX;
		var worldHeight = maxY - minY;
		var width = Math.ceil(worldWidth * pixelsPerMeter);
		var height = Math.ceil(worldHeight * pixelsPerMeter);

		// Step 3) Limit max size to prevent memory issues
		var maxSize = 8192;
		if (width > maxSize || height > maxSize) {
			var scale = maxSize / Math.max(width, height);
			width = Math.ceil(width * scale);
			height = Math.ceil(height * scale);
			pixelsPerMeter *= scale;
			console.warn("Canvas too large, scaling down to " + width + "x" + height);
		}

		console.log("Rendering surface at " + pixelsPerMeter.toFixed(2) + " pixels/meter → " + width + "x" + height + " canvas");

		// Step 5) Create canvas with alpha channel support
		var canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		var ctx = canvas.getContext("2d", { alpha: true });

		// Step 6) Clear canvas to TRANSPARENT (rgba 0,0,0,0)
		// Areas outside triangles will remain transparent (alpha = 0)
		// Triangle areas will have opacity based on surface.transparency
		ctx.clearRect(0, 0, width, height);
		console.log("Canvas initialized with transparent background");
		console.log("Surface transparency: " + (surface.transparency || 1.0));

		// Step 6) Get surface rendering settings
		var gradient = surface.gradient || "default";
		var surfaceMinZ = surface.minLimit !== null ? surface.minLimit : minZ;
		var surfaceMaxZ = surface.maxLimit !== null ? surface.maxLimit : maxZ;

		console.log("Surface Z range: " + minZ.toFixed(2) + " to " + maxZ.toFixed(2));
		console.log("Using gradient: " + gradient);

		// Step 7) Draw each triangle
		var triangleCount = 0;
		surface.triangles.forEach(function (triangle) {
			triangleCount++;
			var p1 = triangle.vertices[0];
			var p2 = triangle.vertices[1];
			var p3 = triangle.vertices[2];

			// Convert world coords to canvas coords (tight bounds, no padding)
			var x1 = (p1.x - minX) * pixelsPerMeter;
			var y1 = (maxY - p1.y) * pixelsPerMeter; // Y flipped
			var x2 = (p2.x - minX) * pixelsPerMeter;
			var y2 = (maxY - p2.y) * pixelsPerMeter;
			var x3 = (p3.x - minX) * pixelsPerMeter;
			var y3 = (maxY - p3.y) * pixelsPerMeter;

			// Calculate average elevation for solid color
			var avgZ = (p1.z + p2.z + p3.z) / 3;

			// Draw triangle
			ctx.globalAlpha = surface.transparency || 1.0;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.lineTo(x3, y3);
			ctx.closePath();

			// Use elevation color from kirra.js
			var color = elevationToColor(avgZ, surfaceMinZ, surfaceMaxZ, gradient, surface.minLimit, surface.maxLimit);

			// Debug first triangle
			if (triangleCount === 1) {
				console.log("First triangle: avgZ=" + avgZ.toFixed(2) + ", color=" + color);
			}

			ctx.fillStyle = color;
			ctx.fill();
		});

		console.log("Drew " + triangleCount + " triangles");

		return {
			canvas: canvas,
			bbox: bbox,
			width: width,
			height: height,
			pixelsPerMeter: pixelsPerMeter
		};
	} catch (error) {
		console.error("Error rendering surface to canvas:", error);
		return null;
	}
}
