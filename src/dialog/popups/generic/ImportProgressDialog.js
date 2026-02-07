// src/dialog/popups/generic/ImportProgressDialog.js
//=============================================================
// IMPORT PROGRESS DIALOG
//=============================================================
// Step 0) Shows progress during blast hole CSV imports
// Displays current stage, progress bar, and allows cancellation
// Created: 2026-01-30 (Phase 8)

import { FloatingDialog } from "../../FloatingDialog.js";

// =============================================================================
// IMPORT STAGES DEFINITION
// =============================================================================

export var IMPORT_STAGES = {
	PARSING: { label: "Parsing file...", weight: 20 },
	GEOMETRY: { label: "Calculating geometry...", weight: 15 },
	PATTERN_ANALYSIS: { label: "Analyzing pattern type...", weight: 10 },
	ROW_DETECTION: { label: "Detecting rows...", weight: 30 },
	POSITION_ORDERING: { label: "Ordering positions...", weight: 15 },
	BURDEN_SPACING: { label: "Calculating burden/spacing...", weight: 5 },
	FINALIZING: { label: "Finalizing import...", weight: 5 }
};

// Calculate cumulative weights for progress calculation
var cumulativeWeights = {};
var runningTotal = 0;
Object.keys(IMPORT_STAGES).forEach(function(key) {
	cumulativeWeights[key] = runningTotal;
	runningTotal += IMPORT_STAGES[key].weight;
});
var totalWeight = runningTotal;

// =============================================================================
// IMPORT PROGRESS DIALOG CLASS
// =============================================================================

/**
 * ImportProgressDialog - Shows progress during blast hole imports
 */
export function ImportProgressDialog(filename, options) {
	options = options || {};

	this.filename = filename;
	this.currentStage = null;
	this.stageProgress = 0;
	this.totalHoles = 0;
	this.processedHoles = 0;
	this.isCancelled = false;
	this.onCancel = options.onCancel || null;

	// Create dialog content
	this.contentDiv = document.createElement("div");
	this.contentDiv.className = "import-progress-container";
	this.contentDiv.innerHTML =
		'<div class="import-filename" style="font-weight: bold; margin-bottom: 10px; word-break: break-all;">' +
			this.escapeHtml(filename) +
		'</div>' +
		'<div class="import-progress-bar" style="width: 100%; height: 20px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 10px;">' +
			'<div class="import-progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); transition: width 0.3s ease;"></div>' +
		'</div>' +
		'<div class="import-stage-label" style="font-size: 14px; color: #666; margin-bottom: 5px;">Initializing...</div>' +
		'<div class="import-details" style="font-size: 12px; color: #888;"></div>' +
		'<div class="import-metrics" style="font-size: 12px; color: #888; margin-top: 10px; display: none;"></div>';

	// Get references to elements
	this.progressFill = this.contentDiv.querySelector(".import-progress-fill");
	this.stageLabel = this.contentDiv.querySelector(".import-stage-label");
	this.detailsDiv = this.contentDiv.querySelector(".import-details");
	this.metricsDiv = this.contentDiv.querySelector(".import-metrics");

	// Create the dialog
	var self = this;
	this.dialog = new FloatingDialog({
		title: "Importing Blast Data",
		content: this.contentDiv,
		width: 420,
		height: 220,
		showConfirm: false,
		showCancel: true,
		cancelText: "Cancel Import",
		onCancel: function() {
			self.isCancelled = true;
			window.holeGenerationCancelled = true;
			if (self.onCancel) {
				self.onCancel();
			}
		}
	});
}

/**
 * Show the dialog
 */
ImportProgressDialog.prototype.show = function() {
	this.dialog.show();
};

/**
 * Close the dialog
 */
ImportProgressDialog.prototype.close = function() {
	this.dialog.close();
};

/**
 * Update to a new stage
 * @param {string} stageName - Key from IMPORT_STAGES
 * @param {string} customLabel - Optional custom label override
 */
ImportProgressDialog.prototype.setStage = function(stageName, customLabel) {
	if (this.isCancelled) return;

	this.currentStage = stageName;
	this.stageProgress = 0;

	var stage = IMPORT_STAGES[stageName];
	if (stage) {
		var label = customLabel || stage.label;
		this.stageLabel.textContent = label;

		// Calculate overall progress
		var baseProgress = cumulativeWeights[stageName] || 0;
		var progressPercent = (baseProgress / totalWeight) * 100;
		this.progressFill.style.width = progressPercent + "%";
	}
};

/**
 * Update progress within current stage
 * @param {number} current - Current item number
 * @param {number} total - Total items
 */
ImportProgressDialog.prototype.updateProgress = function(current, total) {
	if (this.isCancelled) return;

	this.processedHoles = current;
	this.totalHoles = total;

	// Update details
	this.detailsDiv.textContent = "Processing hole " + current + " of " + total;

	// Calculate progress within stage
	var stageProgressPercent = total > 0 ? (current / total) : 0;

	// Calculate overall progress
	var stage = IMPORT_STAGES[this.currentStage];
	if (stage) {
		var baseProgress = cumulativeWeights[this.currentStage] || 0;
		var stageWeight = stage.weight;
		var overallProgress = baseProgress + (stageWeight * stageProgressPercent);
		var progressPercent = (overallProgress / totalWeight) * 100;
		this.progressFill.style.width = progressPercent + "%";
	}
};

/**
 * Set custom details text
 * @param {string} text - Details text to display
 */
ImportProgressDialog.prototype.setDetails = function(text) {
	if (this.isCancelled) return;
	this.detailsDiv.textContent = text;
};

/**
 * Show metrics after import completion
 * @param {Object} metrics - Metrics object from row detection
 */
ImportProgressDialog.prototype.showMetrics = function(metrics) {
	if (!metrics) return;

	this.metricsDiv.style.display = "block";
	this.metricsDiv.innerHTML =
		'<div style="border-top: 1px solid #ddd; padding-top: 8px; margin-top: 5px;">' +
			'<strong>Import Summary:</strong><br>' +
			'Rows: ' + (metrics.rowCount || 0) + ' | ' +
			'Avg Spacing: ' + (metrics.avgSpacing || 0).toFixed(2) + 'm | ' +
			'Avg Burden: ' + (metrics.avgBurden || 0).toFixed(2) + 'm<br>' +
			'Pattern: ' + (metrics.patternStyle || 'unknown') +
		'</div>';
};

/**
 * Mark import as complete
 * @param {number} holeCount - Number of holes imported
 * @param {Object} metrics - Optional metrics to display
 */
ImportProgressDialog.prototype.complete = function(holeCount, metrics) {
	this.progressFill.style.width = "100%";
	this.progressFill.style.background = "linear-gradient(90deg, #4CAF50, #81C784)";
	this.stageLabel.textContent = "Import complete!";
	this.detailsDiv.textContent = "Successfully imported " + holeCount + " holes";

	if (metrics) {
		this.showMetrics(metrics);
	}

	// Change cancel button to Continue
	var cancelBtn = this.dialog.element.querySelector(".floating-dialog-btn.cancel");
	if (cancelBtn) {
		cancelBtn.textContent = "Continue";
	}
};

/**
 * Mark import as failed
 * @param {string} errorMessage - Error message to display
 */
ImportProgressDialog.prototype.fail = function(errorMessage) {
	this.progressFill.style.background = "#f44336";
	this.stageLabel.textContent = "Import failed";
	this.detailsDiv.textContent = errorMessage || "An error occurred during import";
	this.detailsDiv.style.color = "#f44336";

	// Change cancel button to Close
	var cancelBtn = this.dialog.element.querySelector(".floating-dialog-btn.cancel");
	if (cancelBtn) {
		cancelBtn.textContent = "Close";
	}
};

/**
 * Check if import was cancelled
 * @returns {boolean}
 */
ImportProgressDialog.prototype.wasCancelled = function() {
	return this.isCancelled;
};

/**
 * Escape HTML to prevent XSS
 */
ImportProgressDialog.prototype.escapeHtml = function(text) {
	var div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
};

// =============================================================================
// HELPER FUNCTION
// =============================================================================

/**
 * Create and show an import progress dialog
 * @param {string} filename - Name of file being imported
 * @param {Object} options - Options including onCancel callback
 * @returns {ImportProgressDialog}
 */
export function showImportProgressDialog(filename, options) {
	var dialog = new ImportProgressDialog(filename, options);
	dialog.show();
	return dialog;
}

// Expose to window for use in kirra.js
window.ImportProgressDialog = ImportProgressDialog;
window.showImportProgressDialog = showImportProgressDialog;
window.IMPORT_STAGES = IMPORT_STAGES;
