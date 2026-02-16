// src/helpers/FlyrockShroudHelper.js

/**
 * FlyrockShroudHelper orchestrates the flyrock shroud generation workflow:
 *   1. Filter holes by blast pattern selection
 *   2. Call FlyrockShroudGenerator to create 3D triangulated surface
 *   3. Add surface to loadedSurfaces via undo-able action
 *   4. Undo action refresh handles: save to IndexedDB, update TreeView, redraw
 */

import { generate } from "../tools/flyrock/FlyrockShroudGenerator.js";
import { AddSurfaceAction } from "../tools/UndoActions.js";

/**
 * Apply flyrock shroud: filter holes, generate surface, add to scene.
 *
 * @param {Object} config - From FlyrockShroudDialog callback
 * @param {string} config.blastName - Blast entity name or "__ALL__"
 * @param {string} config.algorithm - Algorithm name
 * @param {number} config.K - Flyrock constant
 * @param {number} config.factorOfSafety - Safety factor
 * @param {number} config.stemEjectAngleDeg - Stem eject angle
 * @param {number} config.inholeDensity - Explosive density
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
		console.warn("FlyrockShroudHelper: No holes found for blast: " + config.blastName);
		return;
	}

	console.log("Generating flyrock shroud for " + holes.length + " holes using " + config.algorithm);

	// Generate the shroud surface
	var surface = generate(holes, config);
	if (!surface) {
		console.error("FlyrockShroudHelper: Failed to generate shroud surface");
		return;
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
