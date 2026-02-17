// src/dialog/contextMenu/SurfaceShaderContextMenu.js

/**
 * Context menu items for surfaces with shader overlays.
 * Add these to your existing surface context menu.
 */

import { showBlastAnalysisShaderDialog } from "../popups/analytics/BlastAnalysisShaderDialog.js";

/**
 * Get shader-related context menu items for a surface.
 *
 * @param {string} surfaceId - Surface ID
 * @returns {Array} - Menu items array
 */
export function getShaderContextMenuItems(surfaceId) {
	var items = [];

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
				});
			});
		}
	});

	// If legend is showing, add hide option
	if (window.blastAnalyticsSettings) {
		items.push({
			text: "Hide Analysis Legend",
			icon: "icons/cylinder-off.png",
			action: function() {
				import("../../helpers/BlastAnalysisShaderHelper.js").then(function(module) {
					module.clearBlastAnalysisShader();
				});
			}
		});
	}

	return items;
}
