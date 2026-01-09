// src/dialog/popups/generic/ProjectionDialog.js
//=============================================================
// COORDINATE PROJECTION DIALOG
//=============================================================
// Step 1) Modern dialog for GeoTIFF coordinate system conversion
// Step 2) Converts WGS84 (lat/lon) to MGA/UTM using Proj4
// Step 3) Created: 2026-01-08

import { FloatingDialog } from "../../FloatingDialog.js";
import proj4 from "proj4";

/**
 * Top 100 most commonly used EPSG codes worldwide
 * Used for GeoTIFF coordinate system conversion dropdown
 */
const top100EPSGCodes = [
	{ code: "4326", name: "WGS 84" },
	{ code: "3857", name: "WGS 84 / Pseudo-Mercator" },
	{ code: "4269", name: "NAD83" },
	{ code: "4267", name: "NAD27" },
	{ code: "32633", name: "WGS 84 / UTM zone 33N" },
	{ code: "32634", name: "WGS 84 / UTM zone 34N" },
	{ code: "32635", name: "WGS 84 / UTM zone 35N" },
	{ code: "32636", name: "WGS 84 / UTM zone 36N" },
	{ code: "32637", name: "WGS 84 / UTM zone 37N" },
	{ code: "32638", name: "WGS 84 / UTM zone 38N" },
	{ code: "32639", name: "WGS 84 / UTM zone 39N" },
	{ code: "32640", name: "WGS 84 / UTM zone 40N" },
	{ code: "32641", name: "WGS 84 / UTM zone 41N" },
	{ code: "32642", name: "WGS 84 / UTM zone 42N" },
	{ code: "32643", name: "WGS 84 / UTM zone 43N" },
	{ code: "32644", name: "WGS 84 / UTM zone 44N" },
	{ code: "32645", name: "WGS 84 / UTM zone 45N" },
	{ code: "32646", name: "WGS 84 / UTM zone 46N" },
	{ code: "32647", name: "WGS 84 / UTM zone 47N" },
	{ code: "32648", name: "WGS 84 / UTM zone 48N" },
	{ code: "32649", name: "WGS 84 / UTM zone 49N" },
	{ code: "32650", name: "WGS 84 / UTM zone 50N" },
	{ code: "32651", name: "WGS 84 / UTM zone 51N" },
	{ code: "32652", name: "WGS 84 / UTM zone 52N" },
	{ code: "32653", name: "WGS 84 / UTM zone 53N" },
	{ code: "32654", name: "WGS 84 / UTM zone 54N" },
	{ code: "32655", name: "WGS 84 / UTM zone 55N" },
	{ code: "32656", name: "WGS 84 / UTM zone 56N" },
	{ code: "32657", name: "WGS 84 / UTM zone 57N" },
	{ code: "32658", name: "WGS 84 / UTM zone 58N" },
	{ code: "32659", name: "WGS 84 / UTM zone 59N" },
	{ code: "32660", name: "WGS 84 / UTM zone 60N" },
	{ code: "32733", name: "WGS 84 / UTM zone 33S" },
	{ code: "32734", name: "WGS 84 / UTM zone 34S" },
	{ code: "32735", name: "WGS 84 / UTM zone 35S" },
	{ code: "32736", name: "WGS 84 / UTM zone 36S" },
	{ code: "32737", name: "WGS 84 / UTM zone 37S" },
	{ code: "32738", name: "WGS 84 / UTM zone 38S" },
	{ code: "32739", name: "WGS 84 / UTM zone 39S" },
	{ code: "32740", name: "WGS 84 / UTM zone 40S" },
	{ code: "32741", name: "WGS 84 / UTM zone 41S" },
	{ code: "32742", name: "WGS 84 / UTM zone 42S" },
	{ code: "32743", name: "WGS 84 / UTM zone 43S" },
	{ code: "32744", name: "WGS 84 / UTM zone 44S" },
	{ code: "32745", name: "WGS 84 / UTM zone 45S" },
	{ code: "32746", name: "WGS 84 / UTM zone 46S" },
	{ code: "32747", name: "WGS 84 / UTM zone 47S" },
	{ code: "32748", name: "WGS 84 / UTM zone 48S" },
	{ code: "32749", name: "WGS 84 / UTM zone 49S" },
	{ code: "32750", name: "WGS 84 / UTM zone 50S" },
	{ code: "32751", name: "WGS 84 / UTM zone 51S" },
	{ code: "32752", name: "WGS 84 / UTM zone 52S" },
	{ code: "32753", name: "WGS 84 / UTM zone 53S" },
	{ code: "32754", name: "WGS 84 / UTM zone 54S" },
	{ code: "32755", name: "WGS 84 / UTM zone 55S" },
	{ code: "32756", name: "WGS 84 / UTM zone 56S" },
	{ code: "28348", name: "GDA94 / MGA zone 48" },
	{ code: "28349", name: "GDA94 / MGA zone 49" },
	{ code: "28350", name: "GDA94 / MGA zone 50" },
	{ code: "28351", name: "GDA94 / MGA zone 51" },
	{ code: "28352", name: "GDA94 / MGA zone 52" },
	{ code: "28353", name: "GDA94 / MGA zone 53" },
	{ code: "28354", name: "GDA94 / MGA zone 54" },
	{ code: "28355", name: "GDA94 / MGA zone 55" },
	{ code: "28356", name: "GDA94 / MGA zone 56" },
	{ code: "28357", name: "GDA94 / MGA zone 57" },
	{ code: "28358", name: "GDA94 / MGA zone 58" },
	{ code: "7848", name: "GDA2020 / MGA zone 48" },
	{ code: "7849", name: "GDA2020 / MGA zone 49" },
	{ code: "7850", name: "GDA2020 / MGA zone 50" },
	{ code: "7851", name: "GDA2020 / MGA zone 51" },
	{ code: "7852", name: "GDA2020 / MGA zone 52" },
	{ code: "7853", name: "GDA2020 / MGA zone 53" },
	{ code: "7854", name: "GDA2020 / MGA zone 54" },
	{ code: "7855", name: "GDA2020 / MGA zone 55" },
	{ code: "7856", name: "GDA2020 / MGA zone 56" },
	{ code: "7857", name: "GDA2020 / MGA zone 57" },
	{ code: "7858", name: "GDA2020 / MGA zone 58" },
	{ code: "3111", name: "GDA94 / Vicgrid" },
	{ code: "3112", name: "GDA94 / Geoscience Australia Lambert" },
	{ code: "2193", name: "NZGD2000 / New Zealand Transverse Mercator 2000" },
	{ code: "2157", name: "IRENET95 / Irish Transverse Mercator" },
	{ code: "2154", name: "RGF93 / Lambert-93" },
	{ code: "3006", name: "SWEREF99 TM" },
	{ code: "25832", name: "ETRS89 / UTM zone 32N" },
	{ code: "25833", name: "ETRS89 / UTM zone 33N" },
	{ code: "4277", name: "OSGB 1936" },
	{ code: "27700", name: "OSGB 1936 / British National Grid" },
	{ code: "2180", name: "ETRS89 / Poland CS92" },
	{ code: "3003", name: "Monte Mario / Italy zone 1" },
	{ code: "3004", name: "Monte Mario / Italy zone 2" },
	{ code: "31370", name: "Belge 1972 / Belgian Lambert 72" },
	{ code: "28992", name: "Amersfoort / RD New" },
	{ code: "2056", name: "CH1903+ / LV95" },
	{ code: "5514", name: "S-JTSK / Krovak East North" },
	{ code: "102100", name: "WGS 1984 Web Mercator Auxiliary Sphere" }
];

/**
 * Load EPSG code definition from epsg.io
 * @param {string} epsgCode - EPSG code (e.g., "28350")
 */
async function loadEPSGCode(epsgCode) {
	try {
		const url = `https://epsg.io/${epsgCode}.proj4`;
		const response = await fetch(url);
		if (!response.ok) throw new Error("Failed to fetch EPSG definition");

		const proj4def = await response.text();
		proj4.defs(`EPSG:${epsgCode}`, proj4def.trim());

		console.log(`Loaded EPSG:${epsgCode} →`, proj4def.trim());
		return true;
	} catch (err) {
		console.error("Error loading EPSG:", err);
		throw err;
	}
}

/**
 * Detect if coordinates are likely WGS84 (latitude/longitude)
 * @param {number[]} bbox - Bounding box [minX, minY, maxX, maxY]
 * @returns {boolean}
 */
export function isLikelyWGS84(bbox) {
	// WGS84 coordinates typically range from -180 to 180 for longitude
	// and -90 to 90 for latitude
	return (
		bbox[0] >= -180 &&
		bbox[0] <= 180 &&
		bbox[2] >= -180 &&
		bbox[2] <= 180 &&
		bbox[1] >= -90 &&
		bbox[1] <= 90 &&
		bbox[3] >= -90 &&
		bbox[3] <= 90
	);
}

/**
 * Show projection conversion dialog for GeoTIFF imports
 * @param {number[]} bbox - Bounding box [minX, minY, maxX, maxY]
 * @returns {Promise<Object>} Result object with transformed coordinates
 */
export async function promptForProjection(bbox) {
	return new Promise((resolve) => {
		// Step 1) Create dialog content HTML
		var contentHTML = '<div style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">';

		// Step 2) Information section
		contentHTML += '<div style="text-align: left;">';
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 10px 0;">The GeoTIFF appears to use WGS84 (latitude/longitude) coordinates:</p>';
		contentHTML += '<pre style="background: var(--dark-mode-bg); padding: 8px; border-radius: 4px; border: 1px solid var(--light-mode-border); color: var(--text-color); font-size: 11px; margin: 0 0 10px 0; overflow-x: auto;">';
		contentHTML += bbox[0].toFixed(6) + ", " + bbox[1].toFixed(6) + " to\\n" + bbox[2].toFixed(6) + ", " + bbox[3].toFixed(6);
		contentHTML += '</pre>';
		contentHTML += '<p class="labelWhite15" style="margin: 0;">Kirra2D uses meters East(X)/North(Y). Please select a target coordinate system:</p>';
		contentHTML += '</div>';

		// Step 3) EPSG dropdown
		contentHTML += '<div class="button-container-2col" style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center;">';
		contentHTML += '<label class="labelWhite15">EPSG Code:</label>';
		contentHTML += '<select id="proj-epsg-code" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
		contentHTML += '<option value="">Select EPSG Code</option>';

		// Add all EPSG codes to dropdown
		top100EPSGCodes.forEach(function(item) {
			contentHTML += '<option value="' + item.code + '">' + item.code + ' - ' + item.name + '</option>';
		});

		contentHTML += '</select>';
		contentHTML += '</div>';

		// Step 4) Custom Proj4 textarea
		contentHTML += '<div class="button-container-2col" style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: start;">';
		contentHTML += '<label class="labelWhite15" style="padding-top: 4px;">Or Custom Proj4:</label>';
		contentHTML += '<textarea id="proj-custom-proj4" placeholder="+proj=utm +zone=50 +south +datum=WGS84 +units=m +no_defs" style="height: 60px; padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 11px; font-family: monospace; resize: vertical;"></textarea>';
		contentHTML += '</div>';

		// Step 5) Error message area (hidden by default)
		contentHTML += '<div id="proj-error-message" style="display: none; padding: 8px; background: #f44336; color: white; border-radius: 4px; font-size: 11px;"></div>';

		contentHTML += '</div>';

		// Step 6) Create FloatingDialog
		var dialog = new FloatingDialog({
			title: "Coordinate System Conversion Required",
			content: contentHTML,
			layoutType: "default",
			width: 600,
			height: 450,
			showConfirm: true,
			showCancel: true,
			confirmText: "Transform",
			cancelText: "Cancel",
			onConfirm: async function () {
				try {
					// Step 7) Get form values
					var epsgCode = document.getElementById("proj-epsg-code").value.trim();
					var customProj4 = document.getElementById("proj-custom-proj4").value.trim();
					var errorDiv = document.getElementById("proj-error-message");

					// Step 8) Validate input
					if (!epsgCode && !customProj4) {
						errorDiv.textContent = "Please select an EPSG code or provide a custom Proj4 definition";
						errorDiv.style.display = "block";
						return; // Don't close dialog
					}

					errorDiv.style.display = "none";

					// Step 9) Prepare transformation
					var sourceDef = "+proj=longlat +datum=WGS84 +no_defs";
					var targetDef = "";

					if (epsgCode) {
						// Load EPSG code from epsg.io
						await loadEPSGCode(epsgCode);
						targetDef = "EPSG:" + epsgCode;
					} else if (customProj4) {
						targetDef = customProj4;
					}

					// Step 10) Transform the bounding box coordinates
					var ll = proj4(sourceDef, targetDef, [bbox[0], bbox[1]]);
					var ur = proj4(sourceDef, targetDef, [bbox[2], bbox[3]]);

					console.log("Transformed coordinates:", { ll, ur });

					// Step 11) Close dialog and resolve with result
					dialog.close();
					resolve({
						transformed: true,
						bbox: [ll[0], ll[1], ur[0], ur[1]],
						epsgCode: epsgCode || null,
						customProj4: customProj4 || null
					});
				} catch (error) {
					// Step 12) Show error message
					var errorDiv = document.getElementById("proj-error-message");
					if (errorDiv) {
						errorDiv.textContent = "Transformation error: " + error.message;
						errorDiv.style.display = "block";
					}
					console.error("Projection transformation error:", error);
					// Don't close dialog - let user fix the error
				}
			},
			onCancel: function () {
				// Step 13) User cancelled transformation
				dialog.close();
				resolve({
					transformed: false
				});
			}
		});

		// Step 14) Show the dialog
		dialog.show();
	});
}

/**
 * Show projection selection dialog for GeoTIFF exports
 * @param {number[]} bbox - Bounding box [minX, minY, maxX, maxY]
 * @returns {Promise<Object>} Result object with EPSG code, resolution mode, and custom values
 */
export async function promptForExportProjection(bbox) {
	return new Promise((resolve) => {
		// Step 1) Create dialog content HTML
		var contentHTML = '<div style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">';

		// Step 2) Information section
		contentHTML += '<div style="text-align: left;">';
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 10px 0;">Configure export settings for GeoTIFF:</p>';
		contentHTML += '<pre style="background: var(--dark-mode-bg); padding: 8px; border-radius: 4px; border: 1px solid var(--light-mode-border); color: var(--text-color); font-size: 11px; margin: 0 0 10px 0; overflow-x: auto;">';
		contentHTML += 'Bounds: ' + bbox[0].toFixed(2) + ', ' + bbox[1].toFixed(2) + ' to\\n';
		contentHTML += '        ' + bbox[2].toFixed(2) + ', ' + bbox[3].toFixed(2);
		contentHTML += '</pre>';
		contentHTML += '</div>';

		// Step 3) Resolution mode selection
		contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Export Resolution:</p>';

		// Radio option 1: Screen Zoom Resolution
		contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
		contentHTML += '<input type="radio" id="res-screen" name="resolution-mode" value="screen" checked style="margin: 0;">';
		contentHTML += '<label for="res-screen" class="labelWhite15" style="margin: 0; cursor: pointer;">Screen Zoom Resolution (current view)</label>';
		contentHTML += '</div>';

		// Radio option 2: DPI
		contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
		contentHTML += '<input type="radio" id="res-dpi" name="resolution-mode" value="dpi" style="margin: 0;">';
		contentHTML += '<label for="res-dpi" class="labelWhite15" style="margin: 0; cursor: pointer;">DPI:</label>';
		contentHTML += '<input type="number" id="dpi-value" value="300" min="72" max="600" step="1" style="width: 80px; padding: 2px 6px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;" onfocus="document.getElementById(\'res-dpi\').checked = true;">';
		contentHTML += '<span class="labelWhite15" style="margin: 0;">dpi</span>';
		contentHTML += '</div>';

		// Radio option 3: Resolution (pixels per meter)
		contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
		contentHTML += '<input type="radio" id="res-ppm" name="resolution-mode" value="ppm" style="margin: 0;">';
		contentHTML += '<label for="res-ppm" class="labelWhite15" style="margin: 0; cursor: pointer;">Resolution:</label>';
		contentHTML += '<input type="number" id="ppm-value" value="10" min="1" max="1000" step="0.1" style="width: 80px; padding: 2px 6px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;" onfocus="document.getElementById(\'res-ppm\').checked = true;">';
		contentHTML += '<span class="labelWhite15" style="margin: 0;">pixels/meter</span>';
		contentHTML += '</div>';

		// Radio option 4: Full Resolution
		contentHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
		contentHTML += '<input type="radio" id="res-full" name="resolution-mode" value="full" style="margin: 0;">';
		contentHTML += '<label for="res-full" class="labelWhite15" style="margin: 0; cursor: pointer;">Full Resolution (1 pixel = 0.1 meters)</label>';
		contentHTML += '</div>';

		contentHTML += '</div>';

		// Step 4) EPSG dropdown (REQUIRED)
		contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Coordinate Reference System (Required):</p>';
		contentHTML += '<div class="button-container-2col" style="display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: center;">';
		contentHTML += '<label class="labelWhite15">EPSG Code:</label>';
		contentHTML += '<select id="export-proj-epsg-code" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
		contentHTML += '<option value="">-- Select EPSG Code --</option>';

		// Add all EPSG codes to dropdown
		top100EPSGCodes.forEach(function(item) {
			contentHTML += '<option value="' + item.code + '">' + item.code + ' - ' + item.name + '</option>';
		});

		contentHTML += '</select>';
		contentHTML += '</div>';

		// Error message for missing EPSG
		contentHTML += '<div id="epsg-error-message" style="display: none; margin-top: 8px; padding: 6px; background: #f44336; color: white; border-radius: 3px; font-size: 11px;">EPSG code is required for GeoTIFF export</div>';

		contentHTML += '</div>';

		// Step 5) Information about export process
		contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
		contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-size: 11px; line-height: 1.4; word-wrap: break-word; white-space: normal;"><strong>Export Information:</strong></p>';
		contentHTML += '<ul class="labelWhite15" style="margin: 0; padding-left: 20px; font-size: 11px; line-height: 1.4; word-wrap: break-word; white-space: normal;">';
		contentHTML += '<li>You will be prompted <strong>twice</strong>: once for the <strong>.tif</strong> file, then for the <strong>.prj</strong> file</li>';
		contentHTML += '<li><strong>IMPORTANT:</strong> Save both files in the <strong>same folder</strong> with the <strong>same base name</strong> (e.g., "test.tif" and "test.prj")</li>';
		contentHTML += '<li>The .prj file contains CRS/projection data - QGIS/ArcGIS will only recognize it if it\'s in the same folder with matching filename</li>';
		contentHTML += '<li>Files are <strong>uncompressed</strong> and may be very large</li>';
		contentHTML += '</ul>';
		contentHTML += '<p class="labelWhite15" style="margin: 8px 0 0 0; font-size: 11px; line-height: 1.4; word-wrap: break-word; white-space: normal;"><strong>Technical Note:</strong> GeoKey injection into TIFF files is disabled due to file corruption risks. The beta <code>writeArrayBuffer</code> API from geotiff.js does not reliably write GeoTIFF tags. The .prj file provides a proven, industry-standard alternative that all major GIS software supports.</p>';
		contentHTML += '<p class="labelWhite15" style="margin: 8px 0 0 0; font-size: 11px; line-height: 1.4; word-wrap: break-word; white-space: normal;">For more information: <a href="https://geotiffjs.github.io/geotiff.js/" target="_blank" style="color: #4CAF50; text-decoration: underline;">https://geotiffjs.github.io/geotiff.js/</a></p>';
		contentHTML += '</div>';

		contentHTML += '</div>';

		// Step 5) Create FloatingDialog
		var dialog = new FloatingDialog({
			title: "GeoTIFF Export Settings",
			content: contentHTML,
			layoutType: "default",
			width: 600,
			height: 680,
			showConfirm: true,
			showCancel: true,
			confirmText: "Export",
			cancelText: "Cancel",
			onConfirm: function () {
				// Step 6) Get form values
				var epsgCode = document.getElementById("export-proj-epsg-code").value.trim();
				var errorDiv = document.getElementById("epsg-error-message");

				// Validate EPSG code is required
				if (!epsgCode) {
					errorDiv.style.display = "block";
					return false; // Prevent dialog from closing
				}

				errorDiv.style.display = "none";

				// Get selected resolution mode
				var resolutionMode = document.querySelector('input[name="resolution-mode"]:checked').value;
				var dpiValue = parseFloat(document.getElementById("dpi-value").value);
				var ppmValue = parseFloat(document.getElementById("ppm-value").value);

				// Step 7) Close dialog and resolve with result
				dialog.close();
				resolve({
					cancelled: false,
					epsgCode: epsgCode,
					resolutionMode: resolutionMode,
					dpi: dpiValue,
					pixelsPerMeter: ppmValue
				});
			},
			onCancel: function () {
				// Step 8) User cancelled export
				dialog.close();
				resolve({
					cancelled: true,
					epsgCode: null
				});
			}
		});

		// Step 9) Show the dialog
		dialog.show();
	});
}

// Export for use in kirra.js
window.promptForProjection = promptForProjection;
window.isLikelyWGS84 = isLikelyWGS84;
window.promptForExportProjection = promptForExportProjection;
