/* prettier-ignore-file */
//=================================================
// SurfaceRenderer.js - High-Performance Surface Rendering
//=================================================
// Renders surfaces and meshes with performance optimizations
// Key features:
// - Cached mesh generation
// - LOD for large surfaces
// - Optimized texture handling (compressed, mipmapped)
// - mesh-bvh for fast raycasting
// - Gradient colorization support
//=================================================

import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";

export class SurfaceRenderer {
	constructor(sceneManager) {
		// Step 1) Store scene manager reference
		this.sceneManager = sceneManager;

		// Step 2) Surface mesh cache
		// Key: surfaceId, Value: { mesh, bvh, lastModified }
		this.surfaceCache = new Map();

		// Step 3) Texture cache
		this.textureCache = new Map();

		// Step 4) Configuration
		this.config = {
			useBVH: true,                // BVH enabled for fast raycasting
			useVertexColors: true,       // Use vertex colors for gradients
			defaultGradient: "default",  // Default gradient type
			wireframe: false,            // Wireframe mode
			doubleSided: true,           // Double-sided rendering
			maxTrianglesForBVH: 1000,    // Min triangles to enable BVH
			lodEnabled: true,
			lodDistances: {
				full: 500,
				medium: 2000,
				low: 5000
			}
		};

		// Step 5) Gradient definitions
		this.gradients = {
			"default": this._defaultGradient,
			"viridis": this._viridisGradient,
			"terrain": this._terrainGradient,
			"hillshade": this._hillshadeGradient
		};

		// Step 6) Reusable objects
		this._tempColor = new THREE.Color();
		this._tempVec3 = new THREE.Vector3();

		// Step 7) Statistics
		this.stats = {
			surfacesRendered: 0,
			totalTriangles: 0,
			bvhSurfaces: 0,
			lastBuildTime: 0
		};

		console.log("🏔️ SurfaceRenderer initialized");
	}

	// ========================================
	// GRADIENT FUNCTIONS
	// ========================================

	/**
	 * Default elevation gradient (blue -> green -> yellow -> red)
	 */
	_defaultGradient(t) {
		// t is 0-1 (normalized elevation)
		var r, g, b;

		if (t < 0.25) {
			// Blue to Cyan
			var s = t / 0.25;
			r = 0;
			g = s;
			b = 1;
		} else if (t < 0.5) {
			// Cyan to Green
			var s = (t - 0.25) / 0.25;
			r = 0;
			g = 1;
			b = 1 - s;
		} else if (t < 0.75) {
			// Green to Yellow
			var s = (t - 0.5) / 0.25;
			r = s;
			g = 1;
			b = 0;
		} else {
			// Yellow to Red
			var s = (t - 0.75) / 0.25;
			r = 1;
			g = 1 - s;
			b = 0;
		}

		return { r: r, g: g, b: b };
	}

	/**
	 * Viridis gradient (perceptually uniform)
	 */
	_viridisGradient(t) {
		// Simplified viridis
		var r = Math.max(0, Math.min(1, 0.267 + 2.8 * t - 3.6 * t * t + 1.4 * t * t * t));
		var g = Math.max(0, Math.min(1, 0.004 + 1.5 * t - 0.5 * t * t));
		var b = Math.max(0, Math.min(1, 0.329 + 0.6 * t - 1.2 * t * t + 0.7 * t * t * t));

		return { r: r, g: g, b: b };
	}

	/**
	 * Terrain gradient
	 */
	_terrainGradient(t) {
		var r, g, b;

		if (t < 0.2) {
			// Deep blue (water)
			r = 0.0;
			g = 0.2;
			b = 0.6;
		} else if (t < 0.4) {
			// Green (lowlands)
			var s = (t - 0.2) / 0.2;
			r = 0.2 * s;
			g = 0.5 + 0.3 * s;
			b = 0.2 - 0.2 * s;
		} else if (t < 0.6) {
			// Brown (hills)
			var s = (t - 0.4) / 0.2;
			r = 0.6 + 0.2 * s;
			g = 0.5 - 0.1 * s;
			b = 0.2;
		} else if (t < 0.8) {
			// Grey (mountains)
			var s = (t - 0.6) / 0.2;
			r = 0.6 + 0.1 * s;
			g = 0.4 + 0.2 * s;
			b = 0.4 + 0.2 * s;
		} else {
			// White (peaks)
			var s = (t - 0.8) / 0.2;
			r = 0.7 + 0.3 * s;
			g = 0.7 + 0.3 * s;
			b = 0.7 + 0.3 * s;
		}

		return { r: r, g: g, b: b };
	}

	/**
	 * Hillshade gradient (greyscale based on slope)
	 */
	_hillshadeGradient(t) {
		var v = 0.2 + 0.8 * t;
		return { r: v, g: v, b: v };
	}

	// ========================================
	// SURFACE BUILDING
	// ========================================

	/**
	 * Build surface from triangulated data
	 * @param {string} surfaceId - Surface ID
	 * @param {Object} surfaceData - Surface data with points and triangles
	 * @param {THREE.Group} targetGroup - Group to add mesh to
	 * @param {Object} options - Build options
	 */
	build(surfaceId, surfaceData, targetGroup, options) {
		var startTime = performance.now();
		options = options || {};

		var originX = options.originX || 0;
		var originY = options.originY || 0;
		var gradient = options.gradient || this.config.defaultGradient;
		var transparency = options.transparency !== undefined ? options.transparency : 1.0;

		// Check cache
		if (this.surfaceCache.has(surfaceId)) {
			var cached = this.surfaceCache.get(surfaceId);
			if (cached.lastModified === surfaceData.lastModified) {
				// Use cached mesh
				if (!targetGroup.children.includes(cached.mesh)) {
					targetGroup.add(cached.mesh);
				}
				cached.mesh.visible = true;
				return cached.mesh;
			}
			// Remove old cached mesh
			this._disposeCachedSurface(surfaceId);
		}

		// Get points and triangles
		var points = surfaceData.points || [];
		var triangles = surfaceData.triangles || [];

		if (points.length === 0 || triangles.length === 0) {
			console.warn("SurfaceRenderer: No data for surface " + surfaceId);
			return null;
		}

		// Calculate elevation range for gradient
		var minZ = Infinity;
		var maxZ = -Infinity;
		points.forEach(function(p) {
			var z = p.z || 0;
			if (z < minZ) minZ = z;
			if (z > maxZ) maxZ = z;
		});

		// Use surface limits if provided
		if (surfaceData.minLimit !== undefined && surfaceData.minLimit !== null) {
			minZ = surfaceData.minLimit;
		}
		if (surfaceData.maxLimit !== undefined && surfaceData.maxLimit !== null) {
			maxZ = surfaceData.maxLimit;
		}

		var elevationRange = maxZ - minZ || 1;

		// Build geometry
		var geometry = this._buildGeometry(points, triangles, originX, originY, minZ, elevationRange, gradient);

		// Build material
		var material = this._buildMaterial(gradient, transparency);

		// Create mesh
		var mesh = new THREE.Mesh(geometry, material);
		mesh.userData = {
			type: "surface",
			surfaceId: surfaceId,
			triangleCount: triangles.length,
			gradient: gradient
		};

		// Add BVH if enabled and large enough
		if (this.config.useBVH && triangles.length >= this.config.maxTrianglesForBVH) {
			this._addBVH(mesh);
			this.stats.bvhSurfaces++;
		}

		// Add to scene
		targetGroup.add(mesh);

		// Cache
		this.surfaceCache.set(surfaceId, {
			mesh: mesh,
			bvh: null,  // Would store BVH reference
			lastModified: surfaceData.lastModified || Date.now()
		});

		// Update stats
		this.stats.surfacesRendered++;
		this.stats.totalTriangles += triangles.length;
		this.stats.lastBuildTime = performance.now() - startTime;

		console.log("🏔️ SurfaceRenderer: Built " + surfaceId + " with " +
			triangles.length + " triangles in " + this.stats.lastBuildTime.toFixed(2) + "ms");

		return mesh;
	}

	/**
	 * Build geometry from points and triangles
	 */
	_buildGeometry(points, triangles, originX, originY, minZ, elevationRange, gradient) {
		var self = this;

		// Create position and color arrays
		var positions = [];
		var colors = [];
		var normals = [];

		var gradientFn = this.gradients[gradient] || this._defaultGradient;

		// Process each triangle
		triangles.forEach(function(tri) {
			// Get triangle vertices
			var p1 = points[tri.a] || points[0];
			var p2 = points[tri.b] || points[0];
			var p3 = points[tri.c] || points[0];

			// Add positions (converted to local coordinates)
			positions.push(
				p1.x - originX, p1.y - originY, p1.z || 0,
				p2.x - originX, p2.y - originY, p2.z || 0,
				p3.x - originX, p3.y - originY, p3.z || 0
			);

			// Calculate vertex colors based on elevation
			[p1, p2, p3].forEach(function(p) {
				var z = p.z || 0;
				var t = Math.max(0, Math.min(1, (z - minZ) / elevationRange));
				var c = gradientFn.call(self, t);
				colors.push(c.r, c.g, c.b);
			});

			// Calculate face normal
			self._tempVec3.set(
				(p2.x - p1.x), (p2.y - p1.y), ((p2.z || 0) - (p1.z || 0))
			);
			var v2 = new THREE.Vector3(
				(p3.x - p1.x), (p3.y - p1.y), ((p3.z || 0) - (p1.z || 0))
			);
			self._tempVec3.cross(v2).normalize();

			// Add same normal for all 3 vertices (flat shading)
			for (var i = 0; i < 3; i++) {
				normals.push(self._tempVec3.x, self._tempVec3.y, self._tempVec3.z);
			}
		});

		// Create geometry
		var geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
		geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));

		return geometry;
	}

	/**
	 * Build material for surface
	 */
	_buildMaterial(gradient, transparency) {
		var material;

		if (gradient === "texture") {
			// Textured material would be different
			material = new THREE.MeshPhongMaterial({
				side: this.config.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
				transparent: transparency < 1.0,
				opacity: transparency,
				wireframe: this.config.wireframe
			});
		} else {
			// Vertex colored material
			material = new THREE.MeshBasicMaterial({
				vertexColors: true,
				side: this.config.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
				transparent: transparency < 1.0,
				opacity: transparency,
				wireframe: this.config.wireframe
			});
		}

		return material;
	}

	/**
	 * Add BVH to mesh for fast raycasting
	 * BVH (Bounding Volume Hierarchy) accelerates raycasting from O(n) to O(log n)
	 */
	_addBVH(mesh) {
		try {
			// Step 1) Build BVH from geometry
			var startTime = performance.now();
			mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
			
			// Step 2) Replace default raycast with accelerated version
			mesh.raycast = acceleratedRaycast;
			
			// Step 3) Store reference for disposal
			mesh.userData.hasBVH = true;
			
			var buildTime = performance.now() - startTime;
			console.log("🏔️ BVH built for " + mesh.userData.surfaceId + 
				" (" + mesh.userData.triangleCount + " triangles) in " + 
				buildTime.toFixed(2) + "ms");
		} catch (error) {
			console.warn("🏔️ BVH build failed for " + mesh.userData.surfaceId + ": " + error.message);
			mesh.userData.hasBVH = false;
		}
	}

	// ========================================
	// UPDATE
	// ========================================

	/**
	 * Update surface visibility
	 * @param {string} surfaceId - Surface ID
	 * @param {boolean} visible - Visibility
	 */
	setVisible(surfaceId, visible) {
		var cached = this.surfaceCache.get(surfaceId);
		if (cached && cached.mesh) {
			cached.mesh.visible = visible;
		}
	}

	/**
	 * Update surface transparency
	 * @param {string} surfaceId - Surface ID
	 * @param {number} transparency - Transparency (0-1)
	 */
	setTransparency(surfaceId, transparency) {
		var cached = this.surfaceCache.get(surfaceId);
		if (cached && cached.mesh && cached.mesh.material) {
			cached.mesh.material.transparent = transparency < 1.0;
			cached.mesh.material.opacity = transparency;
			cached.mesh.material.needsUpdate = true;
		}
	}

	/**
	 * Update surface gradient (requires rebuild)
	 * @param {string} surfaceId - Surface ID
	 * @param {string} gradient - Gradient name
	 */
	setGradient(surfaceId, gradient) {
		// Mark for rebuild
		if (this.sceneManager) {
			this.sceneManager.markDirty("surfaces");
		}
	}

	/**
	 * Toggle wireframe mode
	 * @param {boolean} enabled - Wireframe enabled
	 */
	setWireframe(enabled) {
		this.config.wireframe = enabled;

		// Update all cached surfaces
		this.surfaceCache.forEach(function(cached) {
			if (cached.mesh && cached.mesh.material) {
				cached.mesh.material.wireframe = enabled;
			}
		});
	}

	// ========================================
	// RAYCASTING
	// ========================================

	/**
	 * Raycast against all surfaces
	 * @param {THREE.Raycaster} raycaster - Raycaster
	 * @returns {Array} Intersections
	 */
	raycast(raycaster) {
		var intersects = [];

		this.surfaceCache.forEach(function(cached, surfaceId) {
			if (!cached.mesh || !cached.mesh.visible) return;

			var results = raycaster.intersectObject(cached.mesh);
			results.forEach(function(hit) {
				hit.userData = { surfaceId: surfaceId };
				intersects.push(hit);
			});
		});

		// Sort by distance
		intersects.sort(function(a, b) {
			return a.distance - b.distance;
		});

		return intersects;
	}

	// ========================================
	// CLEAR / DISPOSE
	// ========================================

	/**
	 * Dispose cached surface
	 */
	_disposeCachedSurface(surfaceId) {
		var cached = this.surfaceCache.get(surfaceId);
		if (!cached) return;

		if (cached.mesh) {
			if (cached.mesh.parent) cached.mesh.parent.remove(cached.mesh);
			
			// Step 1) Dispose BVH if present
			if (cached.mesh.geometry && cached.mesh.geometry.boundsTree) {
				cached.mesh.geometry.boundsTree.dispose();
				cached.mesh.geometry.boundsTree = null;
			}
			
			// Step 2) Dispose geometry and material
			if (cached.mesh.geometry) cached.mesh.geometry.dispose();
			if (cached.mesh.material) cached.mesh.material.dispose();
		}

		this.surfaceCache.delete(surfaceId);
	}

	/**
	 * Clear all surfaces
	 */
	clear() {
		var self = this;
		this.surfaceCache.forEach(function(cached, surfaceId) {
			self._disposeCachedSurface(surfaceId);
		});
		this.surfaceCache.clear();

		// Clear texture cache
		this.textureCache.forEach(function(texture) {
			texture.dispose();
		});
		this.textureCache.clear();

		// Reset stats
		this.stats.surfacesRendered = 0;
		this.stats.totalTriangles = 0;
		this.stats.bvhSurfaces = 0;
	}

	/**
	 * Get statistics
	 * @returns {Object} Stats
	 */
	getStats() {
		return {
			surfacesRendered: this.stats.surfacesRendered,
			totalTriangles: this.stats.totalTriangles,
			bvhSurfaces: this.stats.bvhSurfaces,
			cachedSurfaces: this.surfaceCache.size,
			lastBuildTime: this.stats.lastBuildTime.toFixed(2) + "ms"
		};
	}

	/**
	 * Dispose all resources
	 */
	dispose() {
		this.clear();
		this.sceneManager = null;
		console.log("🏔️ SurfaceRenderer disposed");
	}
}

export default SurfaceRenderer;
