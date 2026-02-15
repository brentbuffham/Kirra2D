// src/dialog/contextMenu/SurfaceShaderContextMenu.js

/**
 * Context menu items for surfaces with shader overlays.
 * Add these to your existing surface context menu.
 */

import { revertShaderOnSurface } from "../../helpers/BlastAnalysisShaderHelper.js";
import { showBlastAnalysisShaderDialog } from "../popups/analytics/BlastAnalysisShaderDialog.js";

/**
 * Get shader-related context menu items for a surface.
 *
 * @param {string} surfaceId - Surface ID
 * @returns {Array} - Menu items array
 */
export function getShaderContextMenuItems(surfaceId) {
	var items = [];

	// Check if this is a shader duplicate
	var isShaderDuplicate = window.shaderDuplicateSurfaces && window.shaderDuplicateSurfaces.has(surfaceId);

	// Always show "Apply Blast Analysis Shader" option
	items.push({
		text: "Apply Blast Analysis Shader",
		icon: "icons/chart-dots.png",
		action: function() {
			showBlastAnalysisShaderDialog(function(config) {
				// Pre-select this surface
				config.surfaceId = surfaceId;

				// Import helper and apply
				import("../../helpers/BlastAnalysisShaderHelper.js").then(function(module) {
					module.applyBlastAnalysisShader(config);

					// Redraw
					if (window.drawData) {
						window.drawData(window.allBlastHoles, window.selectedHole);
					}
				});
			});
		}
	});

	// If this is a shader duplicate, add revert option
	if (isShaderDuplicate) {
		items.push({
			text: "Revert Shader Analysis",
			icon: "icons/circle-minus.png",
			action: function() {
				revertShaderOnSurface(surfaceId);
			}
		});
	}

	// If shader is currently active, add clear option
	if (window.blastAnalyticsSettings && window.blastAnalyticsSettings.surfaceId === surfaceId) {
		items.push({
			text: "Clear Shader Overlay",
			icon: "icons/cylinder-off.png",
			action: function() {
				import("../../helpers/BlastAnalysisShaderHelper.js").then(function(module) {
					module.clearBlastAnalysisShader();

					// Redraw
					if (window.drawData) {
						window.drawData(window.allBlastHoles, window.selectedHole);
					}
				});
			}
		});
	}

	return items;
}

/**
 * Example integration into existing surface context menu.
 *
 * Add this to your existing surface context menu creation:
 */

/*
// In your existing SurfaceContextMenu.js or equivalent:

import { getShaderContextMenuItems } from "./SurfaceShaderContextMenu.js";

function showSurfaceContextMenu(surfaceId, x, y) {
	var items = [
		// ... existing menu items ...
		{
			text: "Surface Properties",
			icon: "icons/adjustments.png",
			action: function() { showSurfaceProperties(surfaceId); }
		},
		// ... more items ...
	];

	// Add shader menu items
	var shaderItems = getShaderContextMenuItems(surfaceId);
	if (shaderItems.length > 0) {
		// Add separator
		items.push({ separator: true });

		// Add shader items
		items = items.concat(shaderItems);
	}

	// Show menu
	showContextMenu(items, x, y);
}
*/
