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
		window.allBlastHoles.forEach(function(hole) {
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
			label: "Explosive Density (kg/L)",
			name: "inholeDensity",
			type: "number",
			value: saved ? saved.inholeDensity : 1.2,
			min: 0.8,
			max: 1.6,
			step: 0.05
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
			label: "Transparency",
			name: "transparency",
			type: "slider",
			value: saved ? saved.transparency : 0.5,
			min: 0,
			max: 1,
			step: 0.05
		}
	];

	var formContent = createEnhancedFormContent(fields);

	var dialog = new FloatingDialog({
		title: "Flyrock Shroud Generator",
		content: formContent,
		width: 550,
		height: 620,
		showConfirm: true,
		confirmText: "Generate Shroud",
		cancelText: "Cancel",
		onConfirm: function() {
			var data = getFormData(this.content);

			var config = {
				blastName: data.blastName,
				algorithm: data.algorithm,
				K: parseFloat(data.K) || 20,
				factorOfSafety: parseFloat(data.factorOfSafety) || 2,
				stemEjectAngleDeg: parseFloat(data.stemEjectAngleDeg) || 80,
				inholeDensity: parseFloat(data.inholeDensity) || 1.2,
				rockDensity: parseFloat(data.rockDensity) || 2600,
				iterations: parseInt(data.iterations) || 40,
				endAngleDeg: parseFloat(data.endAngleDeg) || 85,
				transparency: parseFloat(data.transparency) || 0.5
			};

			saveSettings(config);
			callback(config);
		}
	});

	dialog.show();
}
