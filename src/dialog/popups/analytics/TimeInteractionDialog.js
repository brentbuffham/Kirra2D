// src/dialog/popups/analytics/TimeInteractionDialog.js
import { FloatingDialog } from "../../FloatingDialog.js";
import { bakeLiveShaderTo2D, removeLiveFlattenedImage } from "../../../helpers/BlastAnalysisShaderHelper.js";

/**
 * TimeInteractionDialog provides real-time time-slice control for
 * blast analysis shader models that support timing (PPV, Scaled Heelan,
 * Heelan Original, Non-Linear Damage).
 *
 * The slider updates the shader's uDisplayTime uniform in real-time,
 * updating the 3D view. A debounced re-bake updates the 2D canvas view.
 * [Freeze] bakes the current time-slice as a permanent surface.
 * [Cancel] removes the live shader and reverts.
 *
 * @param {Object} config - Configuration object
 * @param {string} config.surfaceId - ID of the live analysis surface
 * @param {THREE.ShaderMaterial} config.shaderMaterial - Direct reference to live shader material
 * @param {string} config.modelName - Active model name
 * @param {Object} config.params - Model parameters
 * @param {Object} config.liveConfig - Full config for re-baking ({ model, surfaceId, blastName, planePadding, params })
 * @param {Function} config.onFreeze - Callback when [Freeze] is clicked, receives { surfaceId, timeMs }
 * @param {Function} config.onClose - Callback when dialog is closed/cancelled
 */
export function showTimeInteractionDialog(config) {
	if (!config || !config.surfaceId) {
		console.error("TimeInteractionDialog: Missing surfaceId");
		return;
	}

	// Direct reference to the live shader material
	var shaderMat = config.shaderMaterial || null;

	// Calculate timing range from blast holes
	var maxFireTime = 0;
	var minFireTime = Infinity;
	if (window.allBlastHoles) {
		for (var i = 0; i < window.allBlastHoles.length; i++) {
			var hole = window.allBlastHoles[i];
			var t = parseFloat(hole.holeTime || hole.timingDelayMilliseconds || 0);
			if (typeof hole.holeTime === "string") {
				var match = hole.holeTime.match(/(\d+)/);
				if (match) t = parseFloat(match[1]);
			}
			if (t > maxFireTime) maxFireTime = t;
			if (t < minFireTime) minFireTime = t;
		}
	}
	if (!isFinite(minFireTime)) minFireTime = 0;
	if (maxFireTime <= 0) maxFireTime = 1000;

	// Add 10% buffer to max
	var sliderMax = Math.ceil(maxFireTime * 1.1);
	var sliderStep = Math.max(1, Math.round(sliderMax / 500));

	// Track the live flattened image ID for cleanup
	var liveFlattenedImageId = null;

	// Debounce timer for 2D bake
	var bakeDebounceTimer = null;
	var BAKE_DEBOUNCE_MS = 200;

	// Build dialog content
	var container = document.createElement("div");
	container.style.padding = "12px";
	container.style.display = "flex";
	container.style.flexDirection = "column";
	container.style.height = "100%";
	container.style.boxSizing = "border-box";

	// Title label
	var titleLabel = document.createElement("div");
	titleLabel.style.fontSize = "12px";
	titleLabel.style.color = "var(--text-color)";
	titleLabel.style.marginBottom = "12px";
	titleLabel.style.flexShrink = "0";
	titleLabel.textContent = "Drag the slider to view the analysis at different time slices. "
		+ "Holes appear progressively as their firing time is reached.";
	container.appendChild(titleLabel);

	// Time slider section — takes up most of the space
	var sliderSection = document.createElement("div");
	sliderSection.style.flex = "1";
	sliderSection.style.display = "flex";
	sliderSection.style.flexDirection = "column";
	sliderSection.style.justifyContent = "center";

	var sliderLabel = document.createElement("label");
	sliderLabel.style.fontSize = "12px";
	sliderLabel.style.fontWeight = "bold";
	sliderLabel.style.color = "var(--text-color)";
	sliderLabel.style.display = "block";
	sliderLabel.style.marginBottom = "8px";
	sliderLabel.textContent = "Time Slice:";
	sliderSection.appendChild(sliderLabel);

	var slider = document.createElement("input");
	slider.type = "range";
	slider.min = "0";
	slider.max = String(sliderMax);
	slider.step = String(sliderStep);
	slider.value = String(sliderMax);
	slider.style.width = "100%";
	slider.style.cursor = "pointer";
	slider.style.height = "28px";
	slider.style.margin = "0";
	sliderSection.appendChild(slider);

	container.appendChild(sliderSection);

	// Current time display
	var timeDisplay = document.createElement("div");
	timeDisplay.style.textAlign = "center";
	timeDisplay.style.fontSize = "28px";
	timeDisplay.style.fontWeight = "bold";
	timeDisplay.style.color = "#4DA6FF";
	timeDisplay.style.margin = "12px 0";
	timeDisplay.style.padding = "10px";
	timeDisplay.style.background = "rgba(0,0,0,0.2)";
	timeDisplay.style.borderRadius = "5px";
	timeDisplay.style.flexShrink = "0";
	timeDisplay.textContent = sliderMax.toFixed(1) + " ms";
	container.appendChild(timeDisplay);

	// Min/Max info
	var rangeInfo = document.createElement("div");
	rangeInfo.style.display = "flex";
	rangeInfo.style.justifyContent = "space-between";
	rangeInfo.style.fontSize = "11px";
	rangeInfo.style.color = "#888";
	rangeInfo.style.flexShrink = "0";
	rangeInfo.innerHTML = "<span>Min: " + minFireTime.toFixed(0) + " ms</span>"
		+ "<span>Max: " + maxFireTime.toFixed(0) + " ms</span>";
	container.appendChild(rangeInfo);

	// Debounced 2D bake function
	function debouncedBake2D(timeMs) {
		if (bakeDebounceTimer) clearTimeout(bakeDebounceTimer);
		bakeDebounceTimer = setTimeout(function() {
			if (config.liveConfig) {
				// Create a params copy with current displayTime
				var bakeParams = Object.assign({}, config.liveConfig.params, { displayTime: timeMs });
				var bakeConfig = Object.assign({}, config.liveConfig, { params: bakeParams });
				liveFlattenedImageId = bakeLiveShaderTo2D(config.surfaceId, bakeConfig);
			}
		}, BAKE_DEBOUNCE_MS);
	}

	// Update function for real-time shader update
	function updateTimeSlice(timeMs) {
		timeDisplay.textContent = timeMs.toFixed(1) + " ms";

		// Update via direct material reference (preferred) — immediate 3D update
		if (shaderMat && shaderMat.uniforms && shaderMat.uniforms.uDisplayTime) {
			shaderMat.uniforms.uDisplayTime.value = timeMs;
			shaderMat.uniformsNeedUpdate = true;
		}

		// Re-render 3D
		if (window.threeRenderer) {
			window.threeRenderer.needsRender = true;
		}

		// Debounced 2D bake
		debouncedBake2D(timeMs);
	}

	// Wire up slider input event
	slider.addEventListener("input", function () {
		var timeMs = parseFloat(this.value);
		updateTimeSlice(timeMs);
	});

	var dialog = new FloatingDialog({
		title: "Time Interaction — " + (config.modelName || "Analysis"),
		content: container,
		width: 480,
		height: 320,
		showConfirm: true,
		confirmText: "Freeze",
		cancelText: "Cancel",
		onConfirm: function () {
			var timeMs = parseFloat(slider.value);

			// Clear debounce timer
			if (bakeDebounceTimer) clearTimeout(bakeDebounceTimer);

			// Cleanup live flattened image
			removeLiveFlattenedImage(config.surfaceId);

			// Freeze: callback to bake a permanent surface at this time
			if (config.onFreeze) {
				config.onFreeze({
					surfaceId: config.surfaceId,
					timeMs: timeMs,
					modelName: config.modelName,
					params: config.params
				});
			}
		},
		onCancel: function () {
			// Clear debounce timer
			if (bakeDebounceTimer) clearTimeout(bakeDebounceTimer);

			// Cleanup live flattened image
			removeLiveFlattenedImage(config.surfaceId);

			// Cleanup — remove live shader surface
			if (config.onClose) {
				config.onClose();
			}
		}
	});

	dialog.show();
}
