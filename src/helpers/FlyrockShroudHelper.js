// src/helpers/FlyrockShroudHelper.js

/**
 * FlyrockShroudHelper orchestrates the flyrock shroud generation workflow:
 *   1. Filter holes by blast pattern selection
 *   2. Check charging data availability (required)
 *   3. Call FlyrockShroudGenerator to create 3D triangulated surface
 *   4. Add surface to loadedSurfaces via undo-able action
 *   5. Undo action refresh handles: save to IndexedDB, update TreeView, redraw
 */

import { generate } from "../tools/flyrock/FlyrockShroudGenerator.js";
import { AddSurfaceAction } from "../tools/UndoActions.js";
import { FloatingDialog } from "../dialog/FloatingDialog.js";
import { getOrCreateSurfaceLayer } from "./LayerHelper.js";

/**
 * Apply flyrock shroud: filter holes, generate surface, add to scene.
 *
 * @param {Object} config - From FlyrockShroudDialog callback
 * @param {string} config.blastName - Blast entity name or "__ALL__"
 * @param {string} config.algorithm - Algorithm name
 * @param {number} config.K - Flyrock constant
 * @param {number} config.factorOfSafety - Safety factor
 * @param {number} config.stemEjectAngleDeg - Stem eject angle
 * @param {number} config.rockDensity - Rock density
 * @param {number} config.iterations - Grid resolution factor
 * @param {number} config.endAngleDeg - Face angle culling threshold (degrees from horizontal)
 * @param {number} config.transparency - Surface transparency
 */
export function applyFlyrockShroud(config) {
	if (!config) {
		console.error("FlyrockShroudHelper: No config provided");
		return;
	}

	// Filter holes by entity
	var holes = [];
	if (window.allBlastHoles && window.allBlastHoles.length > 0) {
		if (config.blastName === "__ALL__") {
			holes = window.allBlastHoles;
		} else {
			holes = window.allBlastHoles.filter(function(hole) {
				return hole.entityName === config.blastName;
			});
		}
	}

	if (holes.length === 0) {
		showWarning("No blast holes found for the selected pattern.");
		return;
	}

	console.log("Generating flyrock shroud for " + holes.length + " holes using " + config.algorithm);

	// Generate the shroud surface
	var result = generate(holes, config);

	// Handle error return (no charging data)
	if (result && result.error === "NO_CHARGING") {
		showWarning(
			"Flyrock shroud requires charging data.\n\n" +
			result.total + " hole(s) selected but none have charging assigned.\n\n" +
			"Use the Deck Builder (right-click a hole) to assign explosive " +
			"products before generating a flyrock shroud."
		);
		return;
	}

	if (!result || result.error) {
		console.error("FlyrockShroudHelper: Failed to generate shroud surface");
		return;
	}

	var surface = result;

	// Log if some holes were skipped
	if (surface.flyrockParams && surface.flyrockParams.holesSkipped > 0) {
		console.warn("Flyrock shroud: " + surface.flyrockParams.holesSkipped +
			" hole(s) skipped (no charging data), " +
			surface.flyrockParams.holeCount + " hole(s) used");
	}

	// Assign to "Flyrock" layer
	var layerId = getOrCreateSurfaceLayer("Flyrock");
	if (layerId) {
		surface.layerId = layerId;
		var layer = window.allSurfaceLayers.get(layerId);
		if (layer && layer.entities) layer.entities.add(surface.id);
	}

	// Execute via UndoManager (handles: add to loadedSurfaces, save, TreeView, redraw)
	if (window.undoManager) {
		var action = new AddSurfaceAction(surface);
		window.undoManager.execute(action);
	} else {
		// Fallback: direct add without undo support
		if (window.loadedSurfaces) {
			window.loadedSurfaces.set(surface.id, surface);
		}
		if (window.saveSurfaceToDB) {
			window.saveSurfaceToDB(surface.id).catch(function(err) {
				console.error("Failed to save flyrock shroud to IndexedDB:", err);
			});
		}
		if (window.debouncedUpdateTreeView) {
			window.debouncedUpdateTreeView();
		}
		if (window.drawData) {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}
	}

	console.log("Flyrock shroud surface added: " + surface.id +
		" (" + surface.points.length + " points, " + surface.triangles.length + " triangles)");
}

/**
 * Show a warning dialog using FloatingDialog.
 * @param {string} message - Warning text
 */
function showWarning(message) {
	var content = document.createElement("div");
	content.style.padding = "15px";
	content.style.whiteSpace = "pre-wrap";
	content.textContent = message;

	var dialog = new FloatingDialog({
		title: "Flyrock Shroud - Warning",
		content: content,
		width: 450,
		height: 250,
		showConfirm: true,
		confirmText: "OK",
		showCancel: false
	});
	dialog.show();
}
