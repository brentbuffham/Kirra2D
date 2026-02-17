// src/dialog/popups/analytics/FlyrockShroudDialog.js
import { FloatingDialog, createEnhancedFormContent, getFormData } from "../../FloatingDialog.js";

var FLYROCK_SETTINGS_KEY = "kirra_flyrock_shroud_settings";

/**
 * Load saved flyrock settings from localStorage.
 */
function loadSavedSettings() {
	try {
		var json = localStorage.getItem(FLYROCK_SETTINGS_KEY);
		return json ? JSON.parse(json) : null;
	} catch (e) {
		return null;
	}
}

/**
 * Save flyrock settings to localStorage.
 */
function saveSettings(settings) {
	try {
		localStorage.setItem(FLYROCK_SETTINGS_KEY, JSON.stringify(settings));
	} catch (e) {
		console.warn("Failed to save flyrock settings:", e);
	}
}

/**
 * Show the Flyrock Shroud configuration dialog.
 *
 * @param {Function} callback - Called with config object on Apply
 */
export function showFlyrockShroudDialog(callback) {
	// Get available blast entities
	var blasts = [];
	var blastNames = new Set();
	if (window.allBlastHoles && window.allBlastHoles.length > 0) {
		window.allBlastHoles.forEach(function (hole) {
			if (hole.entityName && !blastNames.has(hole.entityName)) {
				blastNames.add(hole.entityName);
				blasts.push({ value: hole.entityName, text: hole.entityName });
			}
		});
	}
	blasts.unshift({ value: "__ALL__", text: "All Blast Holes" });

	// Load saved settings
	var saved = loadSavedSettings();

	var fields = [
		{
			label: "Blast Pattern",
			name: "blastName",
			type: "select",
			value: saved ? saved.blastName : "__ALL__",
			options: blasts,
			required: true
		},
		{
			label: "Algorithm",
			name: "algorithm",
			type: "select",
			value: saved ? saved.algorithm : "richardsMoore",
			options: [
				{ value: "richardsMoore", text: "Richards & Moore (2004)" },
				{ value: "lundborg", text: "Lundborg (1981)" },
				{ value: "mckenzie", text: "McKenzie (2009/2022)" }
			],
			required: true
		},
		{
			label: "Flyrock Constant K",
			name: "K",
			type: "number",
			value: saved ? saved.K : 20,
			min: 5,
			max: 50,
			step: 1
		},
		{
			label: "Factor of Safety",
			name: "factorOfSafety",
			type: "number",
			value: saved ? saved.factorOfSafety : 2,
			min: 1,
			max: 5,
			step: 0.5
		},
		{
			label: "Stem Eject Angle (degrees)",
			name: "stemEjectAngleDeg",
			type: "number",
			value: saved ? saved.stemEjectAngleDeg : 80,
			min: 30,
			max: 90,
			step: 5
		},
		{
			label: "Rock Density (kg/m3)",
			name: "rockDensity",
			type: "number",
			value: saved ? saved.rockDensity : 2600,
			min: 1500,
			max: 4000,
			step: 100
		},
		{
			label: "Extend Below Collar (m)",
			name: "extendBelowCollar",
			type: "number",
			value: saved ? saved.extendBelowCollar : 0,
			min: 0,
			max: 500,
			step: 1
		},
		{
			label: "Grid Resolution (iterations)",
			name: "iterations",
			type: "number",
			value: saved ? saved.iterations : 40,
			min: 10,
			max: 100,
			step: 5
		},
		{
			label: "End Angle (degrees)",
			name: "endAngleDeg",
			type: "number",
			value: saved ? saved.endAngleDeg : 85,
			min: 30,
			max: 90,
			step: 5
		},
		{
			label: "Transparency (0-1)",
			name: "transparency",
			type: "number",
			value: saved ? saved.transparency : 0.5,
			min: 0,
			max: 1,
			step: 0.05
		}
	];

	var formContent = createEnhancedFormContent(fields);

	// Wrap form + tips in a container
	var container = document.createElement("div");
	container.appendChild(formContent);

	// Algorithm info section (updates when algorithm changes)
	var infoSection = document.createElement("div");
	infoSection.id = "flyrockInfoSection";
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
	infoTitle.textContent = "Algorithm & Tips";
	infoSection.appendChild(infoTitle);

	var infoContent = document.createElement("div");
	infoContent.id = "flyrockInfoContent";
	infoContent.style.maxHeight = "180px";
	infoContent.style.overflowY = "auto";
	infoSection.appendChild(infoContent);

	container.appendChild(infoSection);

	var dialog = new FloatingDialog({
		title: "Flyrock Shroud Generator",
		content: container,
		width: 550,
		height: 620,
		showConfirm: true,
		confirmText: "Generate Shroud",
		cancelText: "Cancel",
		onConfirm: function () {
			var data = getFormData(this.content);

			var config = {
				blastName: data.blastName,
				algorithm: data.algorithm,
				K: parseFloat(data.K) || 20,
				factorOfSafety: parseFloat(data.factorOfSafety) || 2,
				stemEjectAngleDeg: parseFloat(data.stemEjectAngleDeg) || 80,
				rockDensity: parseFloat(data.rockDensity) || 2600,
				extendBelowCollar: parseFloat(data.extendBelowCollar) || 0,
				iterations: parseInt(data.iterations) || 40,
				endAngleDeg: parseFloat(data.endAngleDeg) || 85,
				transparency: parseFloat(data.transparency) || 0.5
			};

			saveSettings(config);
			callback(config);
		}
	});

	dialog.show();

	// Populate algorithm info and listen for changes
	setTimeout(function () {
		if (!dialog.content) return;
		var algoSelect = dialog.content.querySelector('[name="algorithm"]');
		if (algoSelect) {
			updateFlyrockInfo(algoSelect.value, dialog.content);
			algoSelect.addEventListener("change", function () {
				updateFlyrockInfo(this.value, dialog.content);
			});
		}
	}, 50);
}

/**
 * Update the info section based on selected algorithm.
 */
function updateFlyrockInfo(algorithm, dialogContent) {
	var infoContent = dialogContent.querySelector("#flyrockInfoContent");
	if (!infoContent) return;
	infoContent.innerHTML = getAlgorithmInfo(algorithm);
}

/**
 * Get information and tips HTML for each algorithm.
 */
function getAlgorithmInfo(algorithm) {
	var common = '<p style="margin-top: 8px; border-top: 1px solid rgba(100,150,200,0.3); padding-top: 8px;">' +
		'<strong>Data Requirements</strong></p>' +
		'<ul style="margin: 4px 0; padding-left: 20px;">' +
		'<li><strong>Charging data required</strong> &mdash; stemming length, charge column, and explosive ' +
		'density are derived from assigned decks (Deck Builder)</li>' +
		'<li><strong>Burden</strong> &mdash; from hole geometry (values &le; 1.5m treated as placeholders)</li>' +
		'<li><strong>Bench height &amp; subdrill</strong> &mdash; from hole geometry</li>' +
		'</ul>' +
		'<p style="margin-top: 6px; font-style: italic;">Tip: Right-click a hole and use the Deck Builder to assign charging before generating the shroud.</p>';

	switch (algorithm) {
		case "richardsMoore":
			return '<p><strong>Richards &amp; Moore (2004)</strong></p>' +
				'<p>Empirical flyrock distance model using face burst, cratering, and stem eject mechanisms.</p>' +
				'<p><strong>Envelope:</strong> Chernigovskii ballistic trajectory &mdash; max height = V&sup2;/(2g), max range = V&sup2;/g</p>' +
				'<ul style="margin: 5px 0; padding-left: 20px;">' +
				'<li><strong>K</strong> &mdash; Flyrock constant (typical 14&ndash;30, default 20)</li>' +
				'<li><strong>FoS</strong> &mdash; Factor of Safety applied to clearance distances (not velocity)</li>' +
				'<li><strong>Stem Eject Angle</strong> &mdash; Launch angle for stem eject mechanism (typically 70&ndash;85&deg;)</li>' +
				'</ul>' +
				'<p style="margin-top: 6px;"><strong>Mechanisms:</strong></p>' +
				'<ul style="margin: 4px 0; padding-left: 20px;">' +
				'<li><strong>Face Burst</strong> &mdash; horizontal projection from free face, depends on burden</li>' +
				'<li><strong>Cratering</strong> &mdash; vertical projection from collar, depends on stemming</li>' +
				'<li><strong>Stem Eject</strong> &mdash; angled projection of stemming material</li>' +
				'</ul>' +
				'<p style="margin-top: 6px; font-style: italic;">Ref: Richards, A.B. &amp; Moore, A.J. (2004) ' +
				'&ldquo;Flyrock control &mdash; by chance or design&rdquo;, Proc. 30th ISEE Conf.</p>' +
				common;

		case "lundborg":
			return '<p><strong>Lundborg (1981)</strong></p>' +
				'<p>Simple empirical formula based solely on hole diameter.</p>' +
				'<p><strong>Formula:</strong> Range = 260 &times; d<sup>2/3</sup> &nbsp;(d in inches)</p>' +
				'<ul style="margin: 5px 0; padding-left: 20px;">' +
				'<li>Uses only hole diameter &mdash; no charging or geometry detail</li>' +
				'<li>Conservative upper-bound estimate for well-confined blasts</li>' +
				'<li>Charging data still required for consistency (stemming check)</li>' +
				'</ul>' +
				'<p style="margin-top: 6px; font-style: italic;">Ref: Lundborg, N. (1981) ' +
				'&ldquo;The probability of flyrock&rdquo;, SveDeFo Report DS 1981:14.</p>' +
				common;

		case "mckenzie":
			return '<p><strong>McKenzie (2009/2022)</strong></p>' +
				'<p>Scaled Depth of Burial (SDoB) based flyrock prediction with contributing charge mass.</p>' +
				'<p><strong>Key formula:</strong> SDoB = S<sub>t</sub> / W<sub>t,m</sub><sup>1/3</sup></p>' +
				'<ul style="margin: 5px 0; padding-left: 20px;">' +
				'<li><strong>SDoB</strong> &mdash; Scaled Depth of Burial (m/kg<sup>1/3</sup>)</li>' +
				'<li><strong>S<sub>t</sub></strong> &mdash; Stemming length (m), from charging deck top</li>' +
				'<li><strong>W<sub>t,m</sub></strong> &mdash; Contributing charge mass (kg), capped at 10 diameters</li>' +
				'<li><strong>Range<sub>max</sub></strong> = 9.74 &times; (&oslash;<sub>mm</sub> / SDoB<sup>2.167</sup>)<sup>2/3</sup></li>' +
				'</ul>' +
				'<p style="margin-top: 6px; font-style: italic;">Ref: McKenzie, C. (2009) &ldquo;Flyrock range and fragment size ' +
				'prediction&rdquo;; McKenzie, C. (2022) &ldquo;Flyrock model validation&rdquo;.</p>' +
				common;

		default:
			return '<p>Select an algorithm to see details.</p>' + common;
	}
}
