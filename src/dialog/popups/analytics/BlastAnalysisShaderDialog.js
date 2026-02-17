// src/dialog/popups/analytics/BlastAnalysisShaderDialog.js
import { FloatingDialog, createEnhancedFormContent, getFormData } from "../../FloatingDialog.js";

/**
 * Show dialog for configuring blast analysis shader overlay.
 *
 * @param {Function} callback - Called with { model, surfaceId, blastName, params } on Apply
 */
var SETTINGS_STORAGE_KEY = "kirra_blast_analysis_settings";

/**
 * Load saved settings from localStorage.
 * @returns {Object|null}
 */
function loadSavedSettings() {
	try {
		var json = localStorage.getItem(SETTINGS_STORAGE_KEY);
		return json ? JSON.parse(json) : null;
	} catch (e) {
		console.warn("Failed to load blast analysis settings from localStorage:", e);
		return null;
	}
}

/**
 * Save settings to localStorage.
 * @param {Object} settings
 */
function saveSettingsToStorage(settings) {
	try {
		localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
	} catch (e) {
		console.warn("Failed to save blast analysis settings to localStorage:", e);
	}
}

export function showBlastAnalysisShaderDialog(callback) {
	// Get available models from the shader system
	var models = window.getAvailableAnalyticsModels ? window.getAvailableAnalyticsModels() : [];

	// Debug: check if models are loaded
	if (models.length === 0) {
		console.error("No analytics models available! Check if getAvailableAnalyticsModels is properly initialized.");
		return;
	}
	console.log("Available models:", models);

	// Load saved settings: window.blastAnalyticsSettings > localStorage > defaults
	var saved = window.blastAnalyticsSettings || loadSavedSettings();

	// Get available surfaces
	var surfaces = [];
	if (window.loadedSurfaces && window.loadedSurfaces.size > 0) {
		window.loadedSurfaces.forEach(function(surface, surfaceId) {
			surfaces.push({ value: surfaceId, text: surface.name || surfaceId });
		});
	}

	// Get available blast entities
	var blasts = [];
	var blastNames = new Set();
	if (window.allBlastHoles && window.allBlastHoles.length > 0) {
		window.allBlastHoles.forEach(function(hole) {
			if (hole.entityName && !blastNames.has(hole.entityName)) {
				blastNames.add(hole.entityName);
				blasts.push({ value: hole.entityName, text: hole.entityName });
			}
		});
	}

	// Add "All Holes" option
	blasts.unshift({ value: "__ALL__", text: "All Blast Holes" });

	// If no surfaces, create default plane option
	if (surfaces.length === 0) {
		surfaces.push({ value: "__PLANE__", text: "Generate Analysis Plane" });
	} else {
		surfaces.unshift({ value: "__PLANE__", text: "Generate Analysis Plane" });
	}

	// Convert models to dropdown options
	var modelOptions = models.map(function(m) {
		return {
			value: m.name,
			text: m.displayName + " (" + m.unit + ")"
		};
	});

	// Get current settings from in-memory or localStorage
	var currentModel = saved ? saved.model : "scaled_heelan";
	var currentSurface = saved ? saved.surfaceId : "__PLANE__";
	var currentBlast = saved ? saved.blastName : "__ALL__";
	var currentPlanePadding = saved ? saved.planePadding : 200;

	var fields = [
		{
			label: "Analytics Model",
			name: "model",
			type: "select",
			value: currentModel,
			options: modelOptions,
			required: true
		},
		{
			label: "Render On",
			name: "surfaceId",
			type: "select",
			value: currentSurface,
			options: surfaces,
			required: true
		},
		{
			label: "Blast Pattern",
			name: "blastName",
			type: "select",
			value: currentBlast,
			options: blasts,
			required: true
		},
		{
			label: "Analysis Plane Distance from Blast Holes (m)",
			name: "planePadding",
			type: "number",
			value: currentPlanePadding,
			min: 50,
			max: 1000,
			step: 10,
			required: false
		}
	];

	// Create form content
	var formContent = createEnhancedFormContent(fields);

	// Create container and append both parts
	var container = document.createElement("div");
	container.appendChild(formContent);

	// Add model-specific parameter section
	var parametersSection = document.createElement("div");
	parametersSection.id = "modelParametersSection";
	parametersSection.style.marginTop = "20px";
	parametersSection.style.padding = "12px 15px";
	parametersSection.style.background = "rgba(0,0,0,0.15)";
	parametersSection.style.borderRadius = "5px";
	parametersSection.style.border = "1px solid var(--light-mode-border)";

	var parametersTitle = document.createElement("h3");
	parametersTitle.style.marginTop = "0";
	parametersTitle.style.marginBottom = "12px";
	parametersTitle.style.fontSize = "14px";
	parametersTitle.style.fontWeight = "bold";
	parametersTitle.style.color = "var(--text-color)";
	parametersTitle.textContent = "Model Parameters";
	parametersSection.appendChild(parametersTitle);

	var parametersContent = document.createElement("div");
	parametersContent.id = "modelParametersContent";
	parametersContent.style.display = "flex";
	parametersContent.style.flexDirection = "column";
	parametersContent.style.gap = "4px";
	parametersContent.style.width = "100%";
	parametersSection.appendChild(parametersContent);

	container.appendChild(parametersSection);

	// Add model info section
	var infoSection = document.createElement("div");
	infoSection.id = "modelInfoSection";
	infoSection.style.marginTop = "15px";
	infoSection.style.padding = "12px 15px";
	infoSection.style.background = "rgba(0, 100, 200, 0.1)";
	infoSection.style.borderRadius = "5px";
	infoSection.style.border = "1px solid rgba(0, 150, 255, 0.3)";
	infoSection.style.fontSize = "11px";
	infoSection.style.color = "var(--text-color)";
	infoSection.style.lineHeight = "1.4";

	var infoTitle = document.createElement("h4");
	infoTitle.style.marginTop = "0";
	infoTitle.style.marginBottom = "8px";
	infoTitle.style.fontSize = "12px";
	infoTitle.style.fontWeight = "bold";
	infoTitle.style.color = "#4DA6FF";
	infoTitle.textContent = "ℹ️ Model Information";
	infoSection.appendChild(infoTitle);

	var infoContent = document.createElement("div");
	infoContent.id = "modelInfoContent";
	infoContent.style.maxHeight = "120px";
	infoContent.style.overflowY = "auto";
	infoSection.appendChild(infoContent);

	container.appendChild(infoSection);

	var dialog = new FloatingDialog({
		title: "Blast Analysis Shader",
		content: container,
		width: 650,
		height: 750,
		showConfirm: true,
		confirmText: "Apply Analysis",
		cancelText: "Cancel",
		onConfirm: function() {
			var formData = getFormData(this.content);

			// Get model-specific parameters
			var params = getModelParameters(formData.model);

			// Parse plane padding
			var planePadding = parseFloat(formData.planePadding) || 200;

			// Store settings in memory and localStorage
			window.blastAnalyticsSettings = {
				model: formData.model,
				surfaceId: formData.surfaceId,
				blastName: formData.blastName,
				planePadding: planePadding,
				params: params
			};
			saveSettingsToStorage(window.blastAnalyticsSettings);

			callback({
				model: formData.model,
				surfaceId: formData.surfaceId,
				blastName: formData.blastName,
				planePadding: planePadding,
				params: params
			});
		},
		onCancel: function() {
			// Do nothing
		}
	});

	dialog.show();

	// Wait for DOM to be ready, then populate initial parameters and info
	setTimeout(function() {
		if (!dialog.content) {
			console.error("Dialog content not available!");
			return;
		}

		// Add listener for model change and populate initial parameters
		var modelSelect = dialog.content.querySelector('[name="model"]');
		if (modelSelect) {
			console.log("Model select found, value:", modelSelect.value);
			// Populate parameters and info for the initially selected model
			updateModelParameters(modelSelect.value, dialog.content);
			updateModelInfo(modelSelect.value, dialog.content);

			// Add change listener
			modelSelect.addEventListener("change", function() {
				updateModelParameters(this.value, dialog.content);
				updateModelInfo(this.value, dialog.content);
			});
		} else {
			console.error("Model select element not found!");
		}
	}, 50);
}

/**
 * Update the info section based on selected model.
 *
 * @param {string} modelName - Selected model name
 * @param {HTMLElement} dialogContent - Dialog content element
 */
function updateModelInfo(modelName, dialogContent) {
	var infoContent = dialogContent.querySelector("#modelInfoContent");
	if (!infoContent) return;

	var info = getModelInfo(modelName);
	infoContent.innerHTML = info;
}

/**
 * Get information text for a model.
 *
 * @param {string} modelName - Model name
 * @returns {string} - HTML info text
 */
function getModelInfo(modelName) {
	switch (modelName) {
		case "ppv":
			return `
				<p><strong>Peak Particle Velocity (PPV) - Site Law</strong></p>
				<p>Predicts ground vibration using empirical site constants from monitoring data.</p>
				<p><strong>Formula:</strong> PPV = K × (SD)<sup>-b</sup></p>
				<p>Where SD = Scaled Distance = D / W<sup>n</sup></p>
				<ul style="margin: 5px 0; padding-left: 20px;">
					<li><strong>K</strong> - Site constant (mm/s), calibrated from blast monitoring</li>
					<li><strong>b</strong> - Distance attenuation exponent (typical 1.5-2.0)</li>
					<li><strong>n</strong> - Charge weight scaling exponent (typically 0.5 for cube root)</li>
					<li><strong>D</strong> - Distance from charge (m), calculated per pixel</li>
					<li><strong>W</strong> - Charge mass per hole (kg), from charging data</li>
				</ul>
				<p style="margin-top: 8px; font-style: italic;">💡 Use this for compliance predictions and monitoring comparisons.</p>
			`;

		case "heelan_original":
			return `
				<p><strong>Heelan (1953) - Original Radiation Pattern</strong></p>
				<p>Physics-based model using elastic wave theory and cylindrical charge radiation patterns.</p>
				<p><strong>Theory:</strong> P-wave and S-wave propagation from cylindrical explosive charges</p>
				<ul style="margin: 5px 0; padding-left: 20px;">
					<li><strong>Rock Density</strong> - Mass per unit volume (kg/m³)</li>
					<li><strong>P-Wave Velocity</strong> - Compressional wave speed (m/s), from seismic testing</li>
					<li><strong>S-Wave Velocity</strong> - Shear wave speed (m/s), from seismic testing</li>
					<li><strong>VOD</strong> - Detonation velocity (m/s), <em>should come from explosive product database</em></li>
					<li><strong>Quality Factors</strong> - Rock attenuation (P and S waves)</li>
					<li><strong>Charge Elements</strong> - Discretization resolution (higher = more accurate)</li>
				</ul>
				<p style="margin-top: 8px; font-style: italic;">⚠️ Future: VOD and density should be extracted per-deck from charging products.</p>
			`;

		case "scaled_heelan":
			return `
				<p><strong>Scaled Heelan (Blair & Minchinton 2006) - Recommended</strong></p>
				<p>Combines site law calibration (K, b) with Heelan radiation patterns for directional accuracy.</p>
				<p><strong>Advantages:</strong> Calibrated to site data + physics-based directional effects</p>
				<ul style="margin: 5px 0; padding-left: 20px;">
					<li><strong>K, b, n</strong> - Site constants (same as PPV model above)</li>
					<li><strong>P/S-Wave Velocities</strong> - Control radiation pattern directionality</li>
					<li><strong>VOD</strong> - Explosive detonation velocity, <em>should come from product database</em></li>
					<li><strong>Wave Weights</strong> - Balance P-wave vs SV-wave contributions</li>
					<li><strong>Charge Elements</strong> - Number of point sources along hole depth</li>
				</ul>
				<p style="margin-top: 8px; font-style: italic;">✅ Best for: Compliance prediction with directional accuracy (structures near blast).</p>
			`;

		case "nonlinear_damage":
			return `
				<p><strong>Non-Linear Damage (Holmberg-Persson)</strong></p>
				<p>Predicts rock damage zones using Holmberg-Persson damage criterion with PPV and stress.</p>
				<p><strong>Output:</strong> Damage index (0 = no damage, 1 = full fracture)</p>
				<ul style="margin: 5px 0; padding-left: 20px;">
					<li><strong>Rock UCS</strong> - Uniaxial compressive strength (MPa)</li>
					<li><strong>Rock Tensile</strong> - Tensile strength (MPa), typically UCS/10</li>
					<li><strong>Critical PPV</strong> - Threshold for damage initiation (mm/s)</li>
					<li><strong>H-P Constants</strong> - K, alpha, beta calibrated from damage observations</li>
				</ul>
				<p style="margin-top: 8px; font-style: italic;">🎯 Use for: Fragmentation analysis, overbreak prediction, damage zone mapping.</p>
			`;

		case "sdob":
			return `
				<p><strong>Scaled Depth of Burial (McKenzie 2022)</strong></p>
				<p>Assesses flyrock risk by computing the ratio of stemming to charge mass.</p>
				<p><strong>Formula:</strong> SDoB = S<sub>t</sub> / W<sub>t,m</sub><sup>1/3</sup></p>
				<ul style="margin: 5px 0; padding-left: 20px;">
					<li><strong>S<sub>t</sub></strong> - Stemming length (m), depth from collar to first explosive deck</li>
					<li><strong>W<sub>t,m</sub></strong> - Contributing charge mass (kg), capped at 10 diameters</li>
					<li><strong>Target SDoB</strong> - Threshold contour (typical 1.5 m/kg<sup>1/3</sup>)</li>
					<li><strong>Max Display Distance</strong> - Voronoi cell radius limit (m)</li>
				</ul>
				<p style="margin-top: 8px;">Colour: <span style="color:#ff0000;">Red</span> = Low SDoB (flyrock risk) | <span style="color:#00cc00;">Green</span> = High SDoB (well confined)</p>
				<p style="font-style: italic;">Use for: Flyrock risk assessment, stemming adequacy checks, clearance zone planning.</p>
			`;

		default:
			return "<p>Select a model to see detailed information.</p>";
	}
}

/**
 * Update the parameters section based on selected model.
 *
 * @param {string} modelName - Selected model name
 * @param {HTMLElement} dialogContent - Dialog content element
 */
function updateModelParameters(modelName, dialogContent) {
	console.log("updateModelParameters called with model:", modelName);
	var paramsContent = dialogContent.querySelector("#modelParametersContent");
	console.log("Found paramsContent element:", paramsContent);
	if (!paramsContent) {
		console.error("Could not find #modelParametersContent element!");
		return;
	}

	// Get default parameters for the model
	var params = getDefaultParametersForModel(modelName);

	// Override defaults with saved values if model matches
	var savedSettings = window.blastAnalyticsSettings || loadSavedSettings();
	if (savedSettings && savedSettings.model === modelName && savedSettings.params) {
		for (var key in params) {
			if (params.hasOwnProperty(key) && savedSettings.params[key] !== undefined) {
				params[key].value = savedSettings.params[key];
			}
		}
	}
	console.log("Parameters for model:", params);

	var html = "";

	// Generate input fields for each parameter using 2-column grid layout
	for (var key in params) {
		if (params.hasOwnProperty(key)) {
			var param = params[key];
			var unitSpan = param.unit ? `<span style="margin-left: 8px; color: #888; font-size: 11px;">${param.unit}</span>` : '';
			html += `
				<div class="button-container-2col" style="display: grid; grid-template-columns: 40% 60%; column-gap: 8px; row-gap: 2px; align-items: center; width: 100%; margin-bottom: 8px;">
					<label class="labelWhite12" style="font-size: 11px; font-family: sans-serif; text-align: right; padding-right: 8px;">${param.label}:</label>
					<div style="display: flex; align-items: center;">
						<input type="number"
							   name="param_${key}"
							   value="${param.value}"
							   step="${param.step || 'any'}"
							   min="${param.min || ''}"
							   max="${param.max || ''}"
							   style="width: 120px; padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">
						${unitSpan}
					</div>
				</div>
			`;
		}
	}

	console.log("Generated HTML length:", html.length);
	paramsContent.innerHTML = html;
	console.log("Parameters populated");
}

/**
 * Get default parameters for a model with UI metadata.
 *
 * @param {string} modelName - Model name
 * @returns {Object} - Parameter definitions
 */
function getDefaultParametersForModel(modelName) {
	switch (modelName) {
		case "ppv":
			return {
				K: { label: "Site Constant K", value: 1140, min: 100, max: 5000, step: 10, unit: "" },
				B: { label: "Site Exponent b", value: 1.6, min: 1.0, max: 2.5, step: 0.1, unit: "" },
				chargeExponent: { label: "Scaled Weight Exponent n", value: 0.5, min: 0.3, max: 0.8, step: 0.05, unit: "" },
				targetPPV: { label: "Target PPV (mm/s) - 0 = disabled", value: 0, min: 0, max: 500, step: 5, unit: "mm/s" }
			};

		case "heelan_original":
			return {
				rockDensity: { label: "Rock Density", value: 2700, min: 2000, max: 3500, step: 50, unit: "kg/m³" },
				pWaveVelocity: { label: "P-Wave Velocity", value: 4500, min: 2000, max: 7000, step: 100, unit: "m/s" },
				sWaveVelocity: { label: "S-Wave Velocity", value: 2600, min: 1500, max: 4000, step: 100, unit: "m/s" },
				detonationVelocity: { label: "VOD", value: 5500, min: 3000, max: 8000, step: 100, unit: "m/s" },
				numElements: { label: "Charge Elements", value: 20, min: 5, max: 64, step: 1, unit: "" },
				qualityFactorP: { label: "Quality Factor P", value: 50, min: 0, max: 200, step: 5, unit: "" },
				qualityFactorS: { label: "Quality Factor S", value: 30, min: 0, max: 200, step: 5, unit: "" }
			};

		case "scaled_heelan":
			return {
				K: { label: "Site Constant K", value: 1140, min: 100, max: 5000, step: 10, unit: "" },
				B: { label: "Site Exponent B", value: 1.6, min: 1.0, max: 2.5, step: 0.1, unit: "" },
				chargeExponent: { label: "Charge Exponent", value: 0.5, min: 0.3, max: 0.8, step: 0.05, unit: "" },
				numElements: { label: "Charge Elements", value: 20, min: 5, max: 64, step: 1, unit: "" },
				pWaveVelocity: { label: "P-Wave Velocity", value: 4500, min: 2000, max: 7000, step: 100, unit: "m/s" },
				sWaveVelocity: { label: "S-Wave Velocity", value: 2600, min: 1500, max: 4000, step: 100, unit: "m/s" },
				detonationVelocity: { label: "VOD", value: 5500, min: 3000, max: 8000, step: 100, unit: "m/s" },
				pWaveWeight: { label: "P-Wave Weight", value: 1.0, min: 0, max: 2, step: 0.1, unit: "" },
				svWaveWeight: { label: "SV-Wave Weight", value: 1.0, min: 0, max: 2, step: 0.1, unit: "" }
			};

		case "nonlinear_damage":
			return {
				K_hp: { label: "H-P Constant K", value: 700, min: 100, max: 2000, step: 50, unit: "" },
				alpha_hp: { label: "H-P Alpha (α)", value: 0.7, min: 0.3, max: 1.5, step: 0.05, unit: "" },
				beta_hp: { label: "H-P Beta (β)", value: 1.5, min: 1.0, max: 2.5, step: 0.1, unit: "" },
				ppvCritical: { label: "Critical PPV", value: 700, min: 100, max: 2000, step: 50, unit: "mm/s" },
				numElements: { label: "Charge Elements", value: 20, min: 5, max: 50, step: 1, unit: "" },
				cutoffDistance: { label: "Min Distance", value: 0.3, min: 0.1, max: 2.0, step: 0.1, unit: "m" }
			};

		case "sdob":
			return {
				targetSDoB: { label: "Target SDoB Threshold", value: 1.5, min: 0.5, max: 5.0, step: 0.1, unit: "m/kg^(1/3)" },
				maxDisplayDistance: { label: "Max Display Distance", value: 50, min: 10, max: 500, step: 10, unit: "m" },
				fallbackDensity: { label: "Fallback Explosive Density (no charging)", value: 1.2, min: 0.8, max: 1.6, step: 0.05, unit: "kg/L" }
			};

		default:
			return {};
	}
}

/**
 * Extract parameter values from form data.
 *
 * @param {string} modelName - Model name
 * @returns {Object} - Parameter values
 */
function getModelParameters(modelName) {
	var params = {};
	var defaults = getDefaultParametersForModel(modelName);

	// Get values from form inputs
	for (var key in defaults) {
		if (defaults.hasOwnProperty(key)) {
			var input = document.querySelector('[name="param_' + key + '"]');
			if (input) {
				params[key] = parseFloat(input.value) || defaults[key].value;
			} else {
				params[key] = defaults[key].value;
			}
		}
	}

	return params;
}
