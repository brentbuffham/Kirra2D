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

	// Label + transport controls row
	var labelRow = document.createElement("div");
	labelRow.style.display = "flex";
	labelRow.style.alignItems = "center";
	labelRow.style.marginBottom = "8px";
	labelRow.style.gap = "8px";

	var sliderLabel = document.createElement("label");
	sliderLabel.style.fontSize = "12px";
	sliderLabel.style.fontWeight = "bold";
	sliderLabel.style.color = "var(--text-color)";
	sliderLabel.textContent = "Time Slice:";
	labelRow.appendChild(sliderLabel);

	// Transport controls: Reset, Play, Pause
	var transportBtnStyle = "padding: 2px 8px; font-size: 14px; cursor: pointer; " +
		"background: rgba(77,166,255,0.15); border: 1px solid rgba(77,166,255,0.4); " +
		"border-radius: 3px; color: var(--text-color); line-height: 1;";

	var resetBtn = document.createElement("button");
	resetBtn.type = "button";
	resetBtn.textContent = "\u23EE";
	resetBtn.title = "Reset to 0";
	resetBtn.setAttribute("style", transportBtnStyle);
	labelRow.appendChild(resetBtn);

	var playBtn = document.createElement("button");
	playBtn.type = "button";
	playBtn.textContent = "\u25B6";
	playBtn.title = "Play";
	playBtn.setAttribute("style", transportBtnStyle);
	labelRow.appendChild(playBtn);

	var pauseBtn = document.createElement("button");
	pauseBtn.type = "button";
	pauseBtn.textContent = "\u23F8";
	pauseBtn.title = "Pause";
	pauseBtn.setAttribute("style", transportBtnStyle);
	labelRow.appendChild(pauseBtn);

	// Speed label
	var speedLabel = document.createElement("span");
	speedLabel.style.fontSize = "10px";
	speedLabel.style.color = "#888";
	speedLabel.style.marginLeft = "auto";
	speedLabel.textContent = "1x";
	labelRow.appendChild(speedLabel);

	sliderSection.appendChild(labelRow);

	// Playback state
	var playAnimId = null;
	var playSpeed = 1;   // multiplier
	var lastFrameTime = 0;

	function startPlayback() {
		if (playAnimId) return;  // already playing
		lastFrameTime = performance.now();
		function animateStep(now) {
			var dt = now - lastFrameTime;
			lastFrameTime = now;
			var currentVal = parseFloat(slider.value);
			var advance = dt * playSpeed;   // 1ms of blast time per 1ms wall-clock at 1x
			var newVal = currentVal + advance;
			if (newVal >= parseFloat(slider.max)) {
				newVal = parseFloat(slider.max);
				slider.value = String(newVal);
				updateTimeSlice(newVal);
				stopPlayback();
				return;
			}
			slider.value = String(Math.round(newVal / parseFloat(slider.step)) * parseFloat(slider.step));
			updateTimeSlice(parseFloat(slider.value));
			playAnimId = requestAnimationFrame(animateStep);
		}
		playAnimId = requestAnimationFrame(animateStep);
	}

	function stopPlayback() {
		if (playAnimId) {
			cancelAnimationFrame(playAnimId);
			playAnimId = null;
		}
	}

	playBtn.addEventListener("click", function() {
		startPlayback();
	});

	pauseBtn.addEventListener("click", function() {
		stopPlayback();
	});

	resetBtn.addEventListener("click", function() {
		stopPlayback();
		slider.value = "0";
		updateTimeSlice(0);
	});

	// Speed cycling on double-click of play button
	playBtn.addEventListener("dblclick", function() {
		if (playSpeed === 1) playSpeed = 2;
		else if (playSpeed === 2) playSpeed = 5;
		else playSpeed = 1;
		speedLabel.textContent = playSpeed + "x";
	});

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
	var tiDark = typeof window.darkModeEnabled !== "undefined" ? window.darkModeEnabled : true;
	var timeDisplay = document.createElement("div");
	timeDisplay.style.textAlign = "center";
	timeDisplay.style.fontSize = "18px";
	timeDisplay.style.fontWeight = "bold";
	timeDisplay.style.color = "#4DA6FF";
	timeDisplay.style.margin = "12px 0";
	timeDisplay.style.padding = "10px";
	timeDisplay.style.background = tiDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.06)";
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
		confirmText: "Generate",
		cancelText: "Cancel",
		onConfirm: function () {
			var timeMs = parseFloat(slider.value);

			// Stop playback animation
			stopPlayback();

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
			// Stop playback animation
			stopPlayback();

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
