/**
 * SurfaceHighlightHelper.js
 *
 * Reusable transparent overlay highlight for surfaces and solids.
 * Adds a semi-transparent mesh clone over the target surface to
 * indicate selection/pick state without modifying the original mesh.
 */

import * as THREE from "three";

// Track active highlights by surfaceId
var activeHighlights = new Map();

/**
 * Add a transparent overlay highlight to a surface.
 * If the surface is already highlighted, clears the old one first.
 *
 * @param {string} surfaceId - ID in surfaceMeshMap
 * @param {object} [options]
 * @param {number} [options.color=0x00FF88]    - Highlight color
 * @param {number} [options.opacity=0.25]      - Overlay opacity (0-1)
 * @param {boolean} [options.depthTest=false]   - Whether to depth-test overlay
 * @returns {THREE.Group|null} - The highlight group, or null on failure
 */
export function highlightSurface(surfaceId, options) {
	var tr = window.threeRenderer;
	if (!tr || !tr.surfaceMeshMap) return null;

	var mesh = tr.surfaceMeshMap.get(surfaceId);
	if (!mesh) return null;

	// Clear any existing highlight for this surface
	clearHighlight(surfaceId);

	var opts = options || {};
	var color = opts.color !== undefined ? opts.color : 0x00FF88;
	var opacity = opts.opacity !== undefined ? opts.opacity : 0.25;
	var depthTest = opts.depthTest !== undefined ? opts.depthTest : false;

	var highlightGroup = new THREE.Group();
	highlightGroup.name = "surfaceHighlight_" + surfaceId;
	highlightGroup.userData = { isHighlight: true, surfaceId: surfaceId };

	var highlightMaterial = new THREE.MeshBasicMaterial({
		color: color,
		transparent: true,
		opacity: opacity,
		depthTest: depthTest,
		side: THREE.DoubleSide
	});

	// Traverse the surface mesh and create overlay clones
	mesh.traverse(function (child) {
		if (child.isMesh && child.geometry) {
			var overlay = new THREE.Mesh(child.geometry, highlightMaterial);
			// Copy the child's world transform so overlay aligns exactly
			overlay.matrixAutoUpdate = false;
			child.updateWorldMatrix(true, false);
			overlay.matrix.copy(child.matrixWorld);
			highlightGroup.add(overlay);
		}
	});

	if (highlightGroup.children.length === 0) {
		highlightMaterial.dispose();
		return null;
	}

	tr.scene.add(highlightGroup);
	activeHighlights.set(surfaceId, highlightGroup);

	tr.needsRender = true;
	return highlightGroup;
}

/**
 * Remove the highlight for a specific surface.
 *
 * @param {string} surfaceId
 */
export function clearHighlight(surfaceId) {
	var group = activeHighlights.get(surfaceId);
	if (!group) return;

	var tr = window.threeRenderer;
	if (tr && tr.scene) {
		tr.scene.remove(group);
	}

	// Dispose materials only (geometry is shared with original mesh)
	group.traverse(function (child) {
		if (child.isMesh && child.material) {
			child.material.dispose();
		}
	});

	activeHighlights.delete(surfaceId);

	if (tr) tr.needsRender = true;
}

/**
 * Flash-highlight a surface 3 times in ~400ms for clear visual feedback.
 * Schedule: ON 0-100ms, OFF 100-150ms, ON 150-250ms, OFF 250-300ms, ON 300-400ms (stays visible).
 * Returns a Promise that resolves when the flash sequence completes.
 *
 * @param {string} surfaceId - ID in surfaceMeshMap
 * @param {object} [options] - Passed through to highlightSurface()
 * @returns {Promise<void>}
 */
export function flashHighlight(surfaceId, options) {
	return new Promise(function (resolve) {
		// Flash 1: ON at 0ms
		highlightSurface(surfaceId, options);

		// Flash 1: OFF at 100ms
		setTimeout(function () {
			clearHighlight(surfaceId);
		}, 100);

		// Flash 2: ON at 150ms
		setTimeout(function () {
			highlightSurface(surfaceId, options);
		}, 150);

		// Flash 2: OFF at 250ms
		setTimeout(function () {
			clearHighlight(surfaceId);
		}, 250);

		// Flash 3: ON at 300ms (stays visible)
		setTimeout(function () {
			highlightSurface(surfaceId, options);
			resolve();
		}, 300);
	});
}

/**
 * Remove all active surface highlights.
 */
export function clearAllHighlights() {
	activeHighlights.forEach(function (group, surfaceId) {
		var tr = window.threeRenderer;
		if (tr && tr.scene) {
			tr.scene.remove(group);
		}
		group.traverse(function (child) {
			if (child.isMesh && child.material) {
				child.material.dispose();
			}
		});
	});
	activeHighlights.clear();

	var tr = window.threeRenderer;
	if (tr) tr.needsRender = true;
}
