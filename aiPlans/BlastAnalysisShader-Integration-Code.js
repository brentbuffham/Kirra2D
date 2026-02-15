// ============================================================================
// BLAST ANALYSIS SHADER INTEGRATION CODE
// Add this to src/kirra.js around line ~22000 (near other analysis tools)
// ============================================================================

// Import the shader system helpers
import {
	applyBlastAnalysisShader,
	clearBlastAnalysisShader,
	getAnalyticsModels,
	refreshShaderForChargingChange,
	updateShaderForHoleChange
} from "./helpers/BlastAnalysisShaderHelper.js";

import { showBlastAnalysisShaderDialog } from "./dialog/popups/analytics/BlastAnalysisShaderDialog.js";

import { getAvailableAnalyticsModels } from "./draw/canvas3DDrawing.js";

// ============================================================================
// Global State for Blast Analysis Shader
// ============================================================================

// Store current shader settings
window.blastAnalyticsSettings = null;

// Make getAvailableAnalyticsModels globally available for the dialog
window.getAvailableAnalyticsModels = getAvailableAnalyticsModels;

// ============================================================================
// Blast Analysis Shader Toggle Function
// ============================================================================

/**
 * Toggle blast analysis shader tool.
 * Called when user clicks the blast analysis shader button.
 */
function toggleBlastAnalysisShaderTool() {
	var checkbox = document.getElementById("blastAnalysisShaderTool");

	if (!checkbox) {
		console.warn("Blast analysis shader checkbox not found");
		return;
	}

	if (checkbox.checked) {
		// Enable: Show configuration dialog
		showBlastAnalysisShaderDialog(function(config) {
			// User clicked Apply
			applyBlastAnalysisShader(config);

			// Enable display in 3D view
			if (window.displayOptions3D) {
				window.displayOptions3D.blastAnalytics = true;
			}

			// Redraw
			drawData(allBlastHoles, selectedHole);
		});
	} else {
		// Disable: Clear shader
		clearBlastAnalysisShader();

		if (window.displayOptions3D) {
			window.displayOptions3D.blastAnalytics = false;
		}

		window.blastAnalyticsSettings = null;

		// Redraw
		drawData(allBlastHoles, selectedHole);
	}
}

// Make function globally accessible
window.toggleBlastAnalysisShaderTool = toggleBlastAnalysisShaderTool;

// ============================================================================
// Integration with Hole Drag Operations
// ============================================================================

// Add to existing hole drag handler (around line where holes are updated during drag)
// Example integration point in your drag handler:

/*
// EXISTING CODE (example):
function onHoleDrag(index, hole) {
	allBlastHoles[index].startXLocation = hole.startXLocation;
	allBlastHoles[index].startYLocation = hole.startYLocation;

	// ADD THIS: Update shader if active
	if (window.blastAnalyticsSettings && window.blastAnalyticsSettings.model) {
		updateShaderForHoleChange(index, allBlastHoles[index]);
	}

	drawData(allBlastHoles, selectedHole);
}
*/

// ============================================================================
// Integration with Charging System
// ============================================================================

// Add to charging update handlers (e.g., DeckBuilder, mass recalculation)
// Example integration point:

/*
// EXISTING CODE (example):
function onChargingDataChanged(holeID) {
	// Recalculate masses
	ChargingMassHelper.updateHoleMass(holeID);

	// ADD THIS: Refresh shader if active
	if (window.blastAnalyticsSettings && window.blastAnalyticsSettings.model) {
		refreshShaderForChargingChange();
	}

	drawData(allBlastHoles, selectedHole);
}
*/

// ============================================================================
// Display Options Integration
// ============================================================================

// Add to existing displayOptions3D object (if it exists)
if (!window.displayOptions3D) {
	window.displayOptions3D = {};
}

window.displayOptions3D.blastAnalytics = false;
window.displayOptions3D.blastAnalyticsModel = "scaled_heelan";

// ============================================================================
// 2D Canvas Integration (Optional)
// ============================================================================

// If you want to show shader overlay in 2D canvas, add this to your 2D drawing function:

/*
// In canvas2DDrawing.js or equivalent:
function drawBlastAnalytics2D(ctx, zoom, panX, panY) {
	if (!window.displayOptions3D.blastAnalytics) return;
	if (!window.blastAnalyticsSettings) return;

	// Import and flatten
	import("../helpers/BlastAnalysisShaderHelper.js").then(function(module) {
		module.exportShaderTo2D(zoom * 2).then(function(result) {
			if (!result || !result.canvas) return;

			var bounds = result.bounds; // [minX, minY, maxX, maxY]

			// Convert world bounds to screen coords
			var screenX = (bounds[0] - panX) * zoom;
			var screenY = (panY - bounds[3]) * zoom; // Y flipped
			var screenW = (bounds[2] - bounds[0]) * zoom;
			var screenH = (bounds[3] - bounds[1]) * zoom;

			// Set transparency
			ctx.globalAlpha = 0.7;
			ctx.drawImage(result.canvas, screenX, screenY, screenW, screenH);
			ctx.globalAlpha = 1.0;
		});
	});
}
*/

// ============================================================================
// HTML Integration
// ============================================================================

/*
Add this to your kirra.html in the Surface Tools section:

<!-- Blast Analysis Shader Tools-->
<input type="checkbox" id="blastAnalysisShaderTool" name="blastAnalysisShaderTool"
       value="blastAnalysisShaderTool"
       onchange="window.toggleBlastAnalysisShaderTool()">
<label for="blastAnalysisShaderTool" class="toggle-buttons-custom icon-button"
       title="Blast Analysis Shader">
    <img src="icons/chart-dots.png" alt="Blast Analysis Shader">
</label>

Note: Make sure you have icons/chart-dots.png or change to an existing icon
*/

// ============================================================================
// Cleanup on File Load/Clear
// ============================================================================

// Add to existing file load/clear handlers:

/*
function onClearProject() {
	// ... existing clear code ...

	// Clear blast analysis shader
	clearBlastAnalysisShader();
	window.blastAnalyticsSettings = null;

	var checkbox = document.getElementById("blastAnalysisShaderTool");
	if (checkbox) checkbox.checked = false;
}
*/

// ============================================================================
// Context Menu Integration (Optional)
// ============================================================================

// Add to Surface Context Menu:

/*
// In SurfaceContextMenu.js or equivalent:

{
	text: "Apply Blast Analysis Shader",
	icon: "icons/chart-dots.png",
	action: function(surfaceId) {
		// Pre-select this surface in the dialog
		showBlastAnalysisShaderDialog(function(config) {
			// Force use of this surface
			config.surfaceId = surfaceId;
			applyBlastAnalysisShader(config);
			drawData(allBlastHoles, selectedHole);
		});
	}
}
*/

// ============================================================================
// END OF INTEGRATION CODE
// ============================================================================

console.log("✅ Blast Analysis Shader integration loaded");
