/* prettier-ignore-file */
//=================================================
// TextRenderer.js - High-Performance Text Rendering
//=================================================
// Renders text using Troika Three Text with performance optimizations
// Key features:
// - Troika MSDF text for crisp rendering at any scale
// - Text pooling for reduced object creation
// - Visibility culling by zoom level
// - Lazy billboard updates (only on camera rotation)
// - Batched sync calls for multiple texts
//=================================================

import * as THREE from "three";
import { Text } from "troika-three-text";

export class TextRenderer {
	constructor(sceneManager) {
		// Step 1) Store scene manager reference
		this.sceneManager = sceneManager;

		// Step 2) Text object pool for reuse
		this.textPool = [];
		this.activeTexts = new Map();  // textId -> Text object

		// Step 3) Configuration
		this.config = {
			defaultFontSize: 12,
			defaultColor: "#ffffff",
			defaultFont: null,           // Use Troika default
			maxPoolSize: 500,            // Max pooled text objects
			minScaleForVisibility: 0.5,  // Hide text below this zoom
			maxTextCount: 1000,          // Max texts to render
			billboardMode: "camera",     // "camera", "fixed", "none"
			anchorX: "center",
			anchorY: "middle"
		};

		// Step 4) Billboard tracking
		this.needsBillboardUpdate = true;
		this.lastCameraQuaternion = new THREE.Quaternion();

		// Step 5) Batch sync queue
		this.pendingSyncs = [];
		this.isSyncing = false;

		// Step 6) Statistics
		this.stats = {
			activeTextCount: 0,
			pooledTextCount: 0,
			lastSyncTime: 0,
			syncCount: 0
		};

		// Step 7) Reusable objects
		this._tempQuaternion = new THREE.Quaternion();

		console.log("📝 TextRenderer initialized");
	}

	// ========================================
	// TEXT POOL MANAGEMENT
	// ========================================

	/**
	 * Get text object from pool or create new
	 * @returns {Text} Troika Text object
	 */
	_getFromPool() {
		if (this.textPool.length > 0) {
			return this.textPool.pop();
		}

		// Create new Text object
		var text = new Text();
		text.fontSize = this.config.defaultFontSize;
		text.color = this.config.defaultColor;
		text.anchorX = this.config.anchorX;
		text.anchorY = this.config.anchorY;

		return text;
	}

	/**
	 * Return text object to pool
	 * @param {Text} text - Text object
	 */
	_returnToPool(text) {
		if (this.textPool.length >= this.config.maxPoolSize) {
			// Dispose if pool is full
			text.dispose();
			return;
		}

		// Reset text
		text.text = "";
		text.visible = false;
		if (text.parent) {
			text.parent.remove(text);
		}

		this.textPool.push(text);
	}

	// ========================================
	// TEXT CREATION
	// ========================================

	/**
	 * Create or update text
	 * @param {string} textId - Unique text ID
	 * @param {string} content - Text content
	 * @param {number} x - X position
	 * @param {number} y - Y position
	 * @param {number} z - Z position
	 * @param {Object} options - Text options
	 * @returns {Text} Text object
	 */
	setText(textId, content, x, y, z, options) {
		options = options || {};

		var text;

		// Check if text already exists
		if (this.activeTexts.has(textId)) {
			text = this.activeTexts.get(textId);
		} else {
			// Get from pool
			text = this._getFromPool();
			this.activeTexts.set(textId, text);
		}

		// Set content
		text.text = content || "";

		// Set position
		text.position.set(x, y, z);

		// Set options
		text.fontSize = options.fontSize || this.config.defaultFontSize;
		text.color = options.color || this.config.defaultColor;
		text.anchorX = options.anchorX || this.config.anchorX;
		text.anchorY = options.anchorY || this.config.anchorY;

		if (options.font) {
			text.font = options.font;
		}

		if (options.maxWidth) {
			text.maxWidth = options.maxWidth;
		}

		// Store metadata
		text.userData = {
			textId: textId,
			isTroikaText: true,
			entityType: options.entityType || "text"
		};

		text.visible = true;

		// Queue for sync
		this.pendingSyncs.push(text);

		return text;
	}

	/**
	 * Add multiple texts at once
	 * @param {Array} texts - Array of text data objects
	 * @param {THREE.Group} targetGroup - Group to add to
	 * @param {Object} options - Common options
	 */
	addTexts(texts, targetGroup, options) {
		var self = this;
		options = options || {};

		var originX = options.originX || 0;
		var originY = options.originY || 0;

		texts.forEach(function(textData, index) {
			var textId = textData.textId || textData.entityName + "_" + index;
			var content = textData.text || textData.content || "";
			var x = (textData.x || textData.pointXLocation || 0) - originX;
			var y = (textData.y || textData.pointYLocation || 0) - originY;
			var z = textData.z || textData.pointZLocation || 0;

			var textOptions = {
				fontSize: textData.fontSize || textData.fontHeight || self.config.defaultFontSize,
				color: textData.color || self.config.defaultColor,
				entityType: textData.entityType || "text"
			};

			var text = self.setText(textId, content, x, y, z, textOptions);

			if (!text.parent) {
				targetGroup.add(text);
			}
		});

		// Trigger batch sync
		this.syncAll();
	}

	/**
	 * Add KAD text entities
	 * @param {Array} entities - KAD text entities
	 * @param {THREE.Group} targetGroup - Target group
	 * @param {Object} options - Options
	 */
	addKADTexts(entities, targetGroup, options) {
		var self = this;
		options = options || {};

		var originX = options.originX || 0;
		var originY = options.originY || 0;

		var textEntities = entities.filter(function(e) {
			return e.entityType === "text" && e.visible !== false;
		});

		textEntities.forEach(function(entity, index) {
			var textId = entity.entityName + "_text_" + (entity.pointID || index);
			var content = entity.text || "";
			var x = entity.pointXLocation - originX;
			var y = entity.pointYLocation - originY;
			var z = entity.pointZLocation || 0;

			var textOptions = {
				fontSize: entity.fontHeight || self.config.defaultFontSize,
				color: entity.color || self.config.defaultColor,
				entityType: "text"
			};

			var text = self.setText(textId, content, x, y, z, textOptions);

			if (!text.parent) {
				targetGroup.add(text);
			}
		});

		this.syncAll();
	}

	// ========================================
	// SYNC MANAGEMENT
	// ========================================

	/**
	 * Sync all pending text objects
	 */
	syncAll() {
		if (this.pendingSyncs.length === 0) return;

		var self = this;
		var startTime = performance.now();

		// Process all pending syncs
		this.pendingSyncs.forEach(function(text) {
			text.sync();
		});

		this.pendingSyncs = [];

		// Update stats
		this.stats.lastSyncTime = performance.now() - startTime;
		this.stats.syncCount++;
		this.stats.activeTextCount = this.activeTexts.size;
		this.stats.pooledTextCount = this.textPool.length;
	}

	/**
	 * Force sync a specific text
	 * @param {string} textId - Text ID
	 */
	syncText(textId) {
		var text = this.activeTexts.get(textId);
		if (text) {
			text.sync();
		}
	}

	// ========================================
	// BILLBOARD MANAGEMENT
	// ========================================

	/**
	 * Update billboards to face camera
	 * @param {THREE.Camera} camera - Camera
	 */
	updateBillboards(camera) {
		if (!camera) return;
		if (this.config.billboardMode === "none") return;

		var self = this;

		// Check if camera rotation changed
		camera.getWorldQuaternion(this._tempQuaternion);

		if (this._tempQuaternion.equals(this.lastCameraQuaternion)) {
			return; // No change, skip update
		}

		this.lastCameraQuaternion.copy(this._tempQuaternion);

		// Update all active texts
		this.activeTexts.forEach(function(text) {
			if (!text.visible) return;

			if (self.config.billboardMode === "camera") {
				text.quaternion.copy(self._tempQuaternion);
			}
		});
	}

	/**
	 * Set billboard mode
	 * @param {string} mode - "camera", "fixed", "none"
	 */
	setBillboardMode(mode) {
		this.config.billboardMode = mode;
	}

	// ========================================
	// VISIBILITY / CULLING
	// ========================================

	/**
	 * Update text visibility based on zoom scale
	 * @param {number} scale - Current zoom scale
	 */
	updateVisibility(scale) {
		var self = this;
		var shouldShow = scale >= this.config.minScaleForVisibility;

		this.activeTexts.forEach(function(text) {
			// Only toggle if necessary
			if (text.userData && text.userData.wasVisible === undefined) {
				text.userData.wasVisible = text.visible;
			}

			if (shouldShow) {
				text.visible = text.userData.wasVisible !== false;
			} else {
				text.userData.wasVisible = text.visible;
				text.visible = false;
			}
		});
	}

	/**
	 * Set individual text visibility
	 * @param {string} textId - Text ID
	 * @param {boolean} visible - Visibility
	 */
	setVisible(textId, visible) {
		var text = this.activeTexts.get(textId);
		if (text) {
			text.visible = visible;
			text.userData.wasVisible = visible;
		}
	}

	// ========================================
	// UPDATE
	// ========================================

	/**
	 * Update text content
	 * @param {string} textId - Text ID
	 * @param {string} content - New content
	 */
	updateContent(textId, content) {
		var text = this.activeTexts.get(textId);
		if (text) {
			text.text = content;
			this.pendingSyncs.push(text);
		}
	}

	/**
	 * Update text position
	 * @param {string} textId - Text ID
	 * @param {number} x - X position
	 * @param {number} y - Y position
	 * @param {number} z - Z position
	 */
	updatePosition(textId, x, y, z) {
		var text = this.activeTexts.get(textId);
		if (text) {
			text.position.set(x, y, z);
		}
	}

	/**
	 * Update text color
	 * @param {string} textId - Text ID
	 * @param {string|number} color - New color
	 */
	updateColor(textId, color) {
		var text = this.activeTexts.get(textId);
		if (text) {
			text.color = color;
			this.pendingSyncs.push(text);
		}
	}

	// ========================================
	// REMOVE
	// ========================================

	/**
	 * Remove text by ID
	 * @param {string} textId - Text ID
	 */
	removeText(textId) {
		var text = this.activeTexts.get(textId);
		if (!text) return;

		this.activeTexts.delete(textId);
		this._returnToPool(text);
	}

	/**
	 * Remove all texts with matching prefix
	 * @param {string} prefix - ID prefix
	 */
	removeByPrefix(prefix) {
		var self = this;
		var toRemove = [];

		this.activeTexts.forEach(function(text, textId) {
			if (textId.startsWith(prefix)) {
				toRemove.push(textId);
			}
		});

		toRemove.forEach(function(textId) {
			self.removeText(textId);
		});
	}

	// ========================================
	// CLEAR / DISPOSE
	// ========================================

	/**
	 * Clear all texts (return to pool)
	 */
	clear() {
		var self = this;

		this.activeTexts.forEach(function(text, textId) {
			self._returnToPool(text);
		});

		this.activeTexts.clear();
		this.pendingSyncs = [];

		this.stats.activeTextCount = 0;
	}

	/**
	 * Get statistics
	 * @returns {Object} Stats
	 */
	getStats() {
		return {
			activeTextCount: this.activeTexts.size,
			pooledTextCount: this.textPool.length,
			pendingSyncs: this.pendingSyncs.length,
			lastSyncTime: this.stats.lastSyncTime.toFixed(2) + "ms",
			syncCount: this.stats.syncCount,
			billboardMode: this.config.billboardMode
		};
	}

	/**
	 * Dispose all resources
	 */
	dispose() {
		// Dispose active texts
		this.activeTexts.forEach(function(text) {
			text.dispose();
		});
		this.activeTexts.clear();

		// Dispose pooled texts
		this.textPool.forEach(function(text) {
			text.dispose();
		});
		this.textPool = [];

		this.pendingSyncs = [];
		this.sceneManager = null;

		console.log("📝 TextRenderer disposed");
	}
}

export default TextRenderer;
