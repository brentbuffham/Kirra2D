/* prettier-ignore-file */
//=================================================
// LayerManager.js - 3D Scene Organization (NOT Data Storage)
//=================================================
// IMPORTANT: This is for THREE.js scene organization ONLY
// 
// DATA STORAGE remains in existing Maps:
//   - window.loadedSurfaces - Surface data (saved to IndexedDB via saveSurfaceToDB)
//   - window.allKADDrawingsMap - KAD entity data (saved to IndexedDB via saveKADToDB)
//   - window.loadedImages - Image data
//
// TREEVIEW reads from the existing Maps above, NOT from LayerManager
//
// LayerManager creates THREE.Group objects to organize 3D rendering:
//   - Allows visibility toggling without re-rendering
//   - Allows opacity control per layer
//   - Groups objects for efficient scene traversal
//
// The layer-aware drawing functions are OPTIONAL enhancements.
// Existing drawing functions continue to work as before.
//=================================================

import * as THREE from "three";

/**
 * Layer data structure for KAD entities
 * @typedef {Object} KADLayer
 * @property {string} id - Unique layer ID (e.g., "kad_filename")
 * @property {string} name - Display name
 * @property {string} entityType - "kad"
 * @property {boolean} visible - Layer visibility
 * @property {number} opacity - 0.0 to 1.0
 * @property {string|null} colorOverride - Override color (optional)
 * @property {THREE.Group} threeGroup - THREE.Group containing all layer objects
 * @property {Object} stats - Entity counts
 */

/**
 * Layer data structure for surfaces
 * @typedef {Object} SurfaceLayer
 * @property {string} id - Unique layer ID (e.g., "surface_filename")
 * @property {string} name - Display name
 * @property {string} entityType - "surface"
 * @property {boolean} visible - Layer visibility
 * @property {number} opacity - 0.0 to 1.0
 * @property {string} gradient - Gradient type
 * @property {number|null} minLimit - Elevation clamp min
 * @property {number|null} maxLimit - Elevation clamp max
 * @property {THREE.Object3D|null} threeObject - THREE mesh/group
 * @property {Object} stats - Surface statistics
 */

export class LayerManager {
	constructor(scene) {
		// Step 1) Store scene reference
		this.scene = scene;

		// Step 2) Create master layers group
		this.layersGroup = new THREE.Group();
		this.layersGroup.name = "LayersGroup";
		this.scene.add(this.layersGroup);

		// Step 3) Initialize layer storage
		this.kadLayers = new Map(); // layerId -> KADLayer
		this.surfaceLayers = new Map(); // layerId -> SurfaceLayer
		this.holeLayers = new Map(); // layerId -> HoleLayer (for future use)

		// Step 4) Create organized groups for each type
		this.kadLayersGroup = new THREE.Group();
		this.kadLayersGroup.name = "KADLayers";
		this.layersGroup.add(this.kadLayersGroup);

		this.surfaceLayersGroup = new THREE.Group();
		this.surfaceLayersGroup.name = "SurfaceLayers";
		this.layersGroup.add(this.surfaceLayersGroup);

		// Step 5) Layer change callbacks
		this.onLayerChange = null; // Callback when layer properties change
	}

	//=================================================
	// KAD LAYER METHODS
	//=================================================

	/**
	 * Step 6) Create a new KAD layer
	 * @param {string} id - Unique layer ID
	 * @param {string} name - Display name
	 * @returns {KADLayer} The created layer
	 */
	createKADLayer(id, name) {
		// Step 6a) Check if layer already exists
		if (this.kadLayers.has(id)) {
			console.warn("LayerManager: KAD layer already exists: " + id);
			return this.kadLayers.get(id);
		}

		// Step 6b) Create THREE.Group for this layer
		var threeGroup = new THREE.Group();
		threeGroup.name = "KADLayer_" + id;

		// Step 6c) Create layer data structure
		var layer = {
			id: id,
			name: name,
			entityType: "kad",
			visible: true,
			opacity: 1.0,
			colorOverride: null,
			threeGroup: threeGroup,
			stats: {
				pointCount: 0,
				lineCount: 0,
				polygonCount: 0,
				circleCount: 0,
				textCount: 0,
				totalEntities: 0
			}
		};

		// Step 6d) Add to scene and storage
		this.kadLayersGroup.add(threeGroup);
		this.kadLayers.set(id, layer);

		console.log("LayerManager: Created KAD layer: " + id);
		return layer;
	}

	/**
	 * Step 7) Get KAD layer by ID
	 * @param {string} id - Layer ID
	 * @returns {KADLayer|null} Layer or null
	 */
	getKADLayer(id) {
		return this.kadLayers.get(id) || null;
	}

	/**
	 * Step 8) Get or create KAD layer
	 * @param {string} id - Layer ID
	 * @param {string} name - Display name (used if creating)
	 * @returns {KADLayer} The layer
	 */
	getOrCreateKADLayer(id, name) {
		if (this.kadLayers.has(id)) {
			return this.kadLayers.get(id);
		}
		return this.createKADLayer(id, name || id);
	}

	/**
	 * Step 9) Remove KAD layer and dispose resources
	 * @param {string} id - Layer ID
	 */
	removeKADLayer(id) {
		var layer = this.kadLayers.get(id);
		if (!layer) {
			console.warn("LayerManager: KAD layer not found: " + id);
			return;
		}

		// Step 9a) Dispose all objects in the layer
		this._disposeGroup(layer.threeGroup);

		// Step 9b) Remove from parent
		this.kadLayersGroup.remove(layer.threeGroup);

		// Step 9c) Remove from storage
		this.kadLayers.delete(id);

		console.log("LayerManager: Removed KAD layer: " + id);

		// Step 9d) Trigger callback
		if (this.onLayerChange) {
			this.onLayerChange("remove", "kad", id);
		}
	}

	/**
	 * Step 10) Set KAD layer visibility
	 * @param {string} id - Layer ID
	 * @param {boolean} visible - Visibility state
	 */
	setKADLayerVisibility(id, visible) {
		var layer = this.kadLayers.get(id);
		if (!layer) {
			console.warn("LayerManager: KAD layer not found: " + id);
			return;
		}

		layer.visible = visible;
		layer.threeGroup.visible = visible;

		// Step 10a) Trigger callback
		if (this.onLayerChange) {
			this.onLayerChange("visibility", "kad", id, visible);
		}
	}

	/**
	 * Step 11) Set KAD layer opacity
	 * @param {string} id - Layer ID
	 * @param {number} opacity - Opacity (0.0 to 1.0)
	 */
	setKADLayerOpacity(id, opacity) {
		var layer = this.kadLayers.get(id);
		if (!layer) {
			console.warn("LayerManager: KAD layer not found: " + id);
			return;
		}

		layer.opacity = Math.max(0, Math.min(1, opacity));

		// Step 11a) Update all materials in the layer
		layer.threeGroup.traverse(function(object) {
			if (object.material) {
				if (Array.isArray(object.material)) {
					object.material.forEach(function(mat) {
						mat.opacity = layer.opacity;
						mat.transparent = layer.opacity < 1.0;
						mat.needsUpdate = true;
					});
				} else {
					object.material.opacity = layer.opacity;
					object.material.transparent = layer.opacity < 1.0;
					object.material.needsUpdate = true;
				}
			}
		});

		// Step 11b) Trigger callback
		if (this.onLayerChange) {
			this.onLayerChange("opacity", "kad", id, opacity);
		}
	}

	/**
	 * Step 12) Update KAD layer statistics
	 * @param {string} id - Layer ID
	 * @param {Object} stats - Statistics object
	 */
	updateKADLayerStats(id, stats) {
		var layer = this.kadLayers.get(id);
		if (!layer) return;

		layer.stats = Object.assign({}, layer.stats, stats);
		layer.stats.totalEntities =
			(layer.stats.pointCount || 0) +
			(layer.stats.lineCount || 0) +
			(layer.stats.polygonCount || 0) +
			(layer.stats.circleCount || 0) +
			(layer.stats.textCount || 0);
	}

	/**
	 * Step 13) Clear all objects from KAD layer (but keep layer)
	 * @param {string} id - Layer ID
	 */
	clearKADLayer(id) {
		var layer = this.kadLayers.get(id);
		if (!layer) return;

		// Step 13a) Dispose and remove all children
		this._disposeGroup(layer.threeGroup);

		// Step 13b) Reset stats
		layer.stats = {
			pointCount: 0,
			lineCount: 0,
			polygonCount: 0,
			circleCount: 0,
			textCount: 0,
			totalEntities: 0
		};
	}

	//=================================================
	// SURFACE LAYER METHODS
	//=================================================

	/**
	 * Step 14) Create a new surface layer
	 * @param {string} id - Unique layer ID
	 * @param {string} name - Display name
	 * @param {Object} options - Surface options (gradient, limits, etc.)
	 * @returns {SurfaceLayer} The created layer
	 */
	createSurfaceLayer(id, name, options) {
		// Step 14a) Check if layer already exists
		if (this.surfaceLayers.has(id)) {
			console.warn("LayerManager: Surface layer already exists: " + id);
			return this.surfaceLayers.get(id);
		}

		options = options || {};

		// Step 14b) Create layer data structure
		var layer = {
			id: id,
			name: name,
			entityType: "surface",
			visible: options.visible !== false,
			opacity: options.opacity !== undefined ? options.opacity : 1.0,
			gradient: options.gradient || "default",
			minLimit: options.minLimit !== undefined ? options.minLimit : null,
			maxLimit: options.maxLimit !== undefined ? options.maxLimit : null,
			threeObject: null,
			stats: {
				triangleCount: 0,
				vertexCount: 0,
				bounds: null
			}
		};

		// Step 14c) Add to storage
		this.surfaceLayers.set(id, layer);

		console.log("LayerManager: Created surface layer: " + id);
		return layer;
	}

	/**
	 * Step 15) Get surface layer by ID
	 * @param {string} id - Layer ID
	 * @returns {SurfaceLayer|null} Layer or null
	 */
	getSurfaceLayer(id) {
		return this.surfaceLayers.get(id) || null;
	}

	/**
	 * Step 16) Get or create surface layer
	 * @param {string} id - Layer ID
	 * @param {string} name - Display name
	 * @param {Object} options - Surface options
	 * @returns {SurfaceLayer} The layer
	 */
	getOrCreateSurfaceLayer(id, name, options) {
		if (this.surfaceLayers.has(id)) {
			return this.surfaceLayers.get(id);
		}
		return this.createSurfaceLayer(id, name || id, options);
	}

	/**
	 * Step 17) Set surface layer THREE object
	 * @param {string} id - Layer ID
	 * @param {THREE.Object3D} threeObject - THREE mesh/group
	 */
	setSurfaceLayerObject(id, threeObject) {
		var layer = this.surfaceLayers.get(id);
		if (!layer) {
			console.warn("LayerManager: Surface layer not found: " + id);
			return;
		}

		// Step 17a) Dispose old object if exists
		if (layer.threeObject) {
			this.surfaceLayersGroup.remove(layer.threeObject);
			this._disposeObject(layer.threeObject);
		}

		// Step 17b) Set new object
		layer.threeObject = threeObject;
		threeObject.visible = layer.visible;

		// Step 17c) Apply opacity
		this._applyOpacityToObject(threeObject, layer.opacity);

		// Step 17d) Add to scene
		this.surfaceLayersGroup.add(threeObject);
	}

	/**
	 * Step 18) Remove surface layer
	 * @param {string} id - Layer ID
	 */
	removeSurfaceLayer(id) {
		var layer = this.surfaceLayers.get(id);
		if (!layer) {
			console.warn("LayerManager: Surface layer not found: " + id);
			return;
		}

		// Step 18a) Dispose THREE object
		if (layer.threeObject) {
			this.surfaceLayersGroup.remove(layer.threeObject);
			this._disposeObject(layer.threeObject);
		}

		// Step 18b) Remove from storage
		this.surfaceLayers.delete(id);

		console.log("LayerManager: Removed surface layer: " + id);

		// Step 18c) Trigger callback
		if (this.onLayerChange) {
			this.onLayerChange("remove", "surface", id);
		}
	}

	/**
	 * Step 19) Set surface layer visibility
	 * @param {string} id - Layer ID
	 * @param {boolean} visible - Visibility state
	 */
	setSurfaceLayerVisibility(id, visible) {
		var layer = this.surfaceLayers.get(id);
		if (!layer) {
			console.warn("LayerManager: Surface layer not found: " + id);
			return;
		}

		layer.visible = visible;
		if (layer.threeObject) {
			layer.threeObject.visible = visible;
		}

		// Step 19a) Trigger callback
		if (this.onLayerChange) {
			this.onLayerChange("visibility", "surface", id, visible);
		}
	}

	/**
	 * Step 20) Set surface layer opacity
	 * @param {string} id - Layer ID
	 * @param {number} opacity - Opacity (0.0 to 1.0)
	 */
	setSurfaceLayerOpacity(id, opacity) {
		var layer = this.surfaceLayers.get(id);
		if (!layer) {
			console.warn("LayerManager: Surface layer not found: " + id);
			return;
		}

		layer.opacity = Math.max(0, Math.min(1, opacity));

		// Step 20a) Apply to THREE object
		if (layer.threeObject) {
			this._applyOpacityToObject(layer.threeObject, layer.opacity);
		}

		// Step 20b) Trigger callback
		if (this.onLayerChange) {
			this.onLayerChange("opacity", "surface", id, opacity);
		}
	}

	/**
	 * Step 21) Update surface layer statistics
	 * @param {string} id - Layer ID
	 * @param {Object} stats - Statistics object
	 */
	updateSurfaceLayerStats(id, stats) {
		var layer = this.surfaceLayers.get(id);
		if (!layer) return;

		layer.stats = Object.assign({}, layer.stats, stats);
	}

	//=================================================
	// UTILITY METHODS
	//=================================================

	/**
	 * Step 22) Get all layers (both KAD and surface)
	 * @returns {Array} Array of all layers
	 */
	getAllLayers() {
		var layers = [];
		this.kadLayers.forEach(function(layer) {
			layers.push(layer);
		});
		this.surfaceLayers.forEach(function(layer) {
			layers.push(layer);
		});
		return layers;
	}

	/**
	 * Step 23) Get all KAD layers
	 * @returns {Array} Array of KAD layers
	 */
	getAllKADLayers() {
		return Array.from(this.kadLayers.values());
	}

	/**
	 * Step 24) Get all surface layers
	 * @returns {Array} Array of surface layers
	 */
	getAllSurfaceLayers() {
		return Array.from(this.surfaceLayers.values());
	}

	/**
	 * Step 25) Clear all layers
	 */
	clearAllLayers() {
		// Step 25a) Clear KAD layers
		var kadIds = Array.from(this.kadLayers.keys());
		var self = this;
		kadIds.forEach(function(id) {
			self.removeKADLayer(id);
		});

		// Step 25b) Clear surface layers
		var surfaceIds = Array.from(this.surfaceLayers.keys());
		surfaceIds.forEach(function(id) {
			self.removeSurfaceLayer(id);
		});

		console.log("LayerManager: Cleared all layers");
	}

	/**
	 * Step 26) Get layer statistics summary
	 * @returns {Object} Statistics summary
	 */
	getStatsSummary() {
		var totalKADEntities = 0;
		var totalSurfaceTriangles = 0;

		this.kadLayers.forEach(function(layer) {
			totalKADEntities += layer.stats.totalEntities || 0;
		});

		this.surfaceLayers.forEach(function(layer) {
			totalSurfaceTriangles += layer.stats.triangleCount || 0;
		});

		return {
			kadLayerCount: this.kadLayers.size,
			surfaceLayerCount: this.surfaceLayers.size,
			totalKADEntities: totalKADEntities,
			totalSurfaceTriangles: totalSurfaceTriangles
		};
	}

	//=================================================
	// PRIVATE HELPER METHODS
	//=================================================

	/**
	 * Step 27) Dispose a THREE.Group and all children
	 * @param {THREE.Group} group - Group to dispose
	 */
	_disposeGroup(group) {
		if (!group) return;

		var toRemove = [];
		var self = this;

		group.traverse(function(object) {
			if (object !== group) {
				self._disposeObject(object);
				toRemove.push(object);
			}
		});

		toRemove.forEach(function(obj) {
			group.remove(obj);
		});
	}

	/**
	 * Step 28) Dispose a single THREE object
	 * @param {THREE.Object3D} object - Object to dispose
	 */
	_disposeObject(object) {
		if (!object) return;

		// Step 28a) Handle Troika text
		if (object.userData && object.userData.isTroikaText) {
			if (typeof object.dispose === "function") {
				object.dispose();
			}
		}

		// Step 28b) Dispose geometry
		if (object.geometry) {
			object.geometry.dispose();
		}

		// Step 28c) Dispose material(s)
		if (object.material) {
			if (Array.isArray(object.material)) {
				object.material.forEach(function(mat) {
					if (mat.map) mat.map.dispose();
					mat.dispose();
				});
			} else {
				if (object.material.map) object.material.map.dispose();
				object.material.dispose();
			}
		}
	}

	/**
	 * Step 29) Apply opacity to THREE object and all children
	 * @param {THREE.Object3D} object - Object to modify
	 * @param {number} opacity - Opacity value
	 */
	_applyOpacityToObject(object, opacity) {
		object.traverse(function(child) {
			if (child.material) {
				if (Array.isArray(child.material)) {
					child.material.forEach(function(mat) {
						mat.opacity = opacity;
						mat.transparent = opacity < 1.0;
						mat.needsUpdate = true;
					});
				} else {
					child.material.opacity = opacity;
					child.material.transparent = opacity < 1.0;
					child.material.needsUpdate = true;
				}
			}
		});
	}

	/**
	 * Step 30) Dispose layer manager and all resources
	 */
	dispose() {
		this.clearAllLayers();

		if (this.layersGroup) {
			this.scene.remove(this.layersGroup);
		}

		this.kadLayers.clear();
		this.surfaceLayers.clear();
		this.holeLayers.clear();

		console.log("LayerManager: Disposed");
	}
}
