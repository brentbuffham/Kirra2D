// DXFExportDialog.js
// Handles DXF export type selection and routing to appropriate writers
// Created: 2026-01-10 to modularize DXF export logic from kirra.js

/**
 * Show DXF export type selection dialog with radio buttons and filename input
 * Routes to appropriate export handler based on user selection
 */
export function showDXFExportDialog() {
	// Step 1) Generate default filenames for each type
	var timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "_");
	var defaultFilenames = {
		holes: "KIRRA_Holes_DXF_" + timestamp + ".dxf",
		kad: "KIRRA_DXF_Drawings_" + timestamp + ".dxf",
		vulcan: "KIRRA_Holes_VULCAN_DXF_" + timestamp + ".dxf",
		"3dface": "KIRRA_Surface_3DFACE_" + timestamp + ".dxf"
	};

	// Step 2) Build dialog content with radio button options and filename input
	var contentHTML = '<div style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">';

	// Step 2a) Export type selection
	contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
	contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Export Type:</p>';

	contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
	contentHTML += '<input type="radio" id="dxf-holes" name="dxf-type" value="holes" checked style="margin: 0;">';
	contentHTML += '<label for="dxf-holes" class="labelWhite15" style="margin: 0; cursor: pointer;">Blast Holes (2-layer format)</label>';
	contentHTML += "</div>";

	contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
	contentHTML += '<input type="radio" id="dxf-kad" name="dxf-type" value="kad" style="margin: 0;">';
	contentHTML += '<label for="dxf-kad" class="labelWhite15" style="margin: 0; cursor: pointer;">KAD Drawings (points, lines, polygons, circles, text)</label>';
	contentHTML += "</div>";

	contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
	contentHTML += '<input type="radio" id="dxf-vulcan" name="dxf-type" value="vulcan" style="margin: 0;">';
	contentHTML += '<label for="dxf-vulcan" class="labelWhite15" style="margin: 0; cursor: pointer;">Vulcan Tagged (3D POLYLINE with XData)</label>';
	contentHTML += "</div>";

	contentHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
	contentHTML += '<input type="radio" id="dxf-3dface" name="dxf-type" value="3dface" style="margin: 0;">';
	contentHTML += '<label for="dxf-3dface" class="labelWhite15" style="margin: 0; cursor: pointer;">Surface 3DFACE (triangulated mesh)</label>';
	contentHTML += "</div>";

	contentHTML += "</div>";

	// Step 2b) Filename input
	contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
	contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Filename:</p>';
	contentHTML += '<input type="text" id="dxf-filename" value="' + defaultFilenames.holes + '" style="width: 100%; padding: 6px; border: 1px solid var(--light-mode-border); border-radius: 4px; background: var(--input-bg); color: var(--text-color); font-family: monospace;">';
	contentHTML += "</div>";

	contentHTML += "</div>";

	// Step 3) Create dialog
	var dialog = new window.FloatingDialog({
		title: "Export DXF",
		content: contentHTML,
		layoutType: "default",
		width: 550,
		height: 380,
		showConfirm: true,
		showCancel: true,
		confirmText: "Export",
		cancelText: "Cancel",
		onConfirm: async function() {
			var exportType = document.querySelector('input[name="dxf-type"]:checked').value;
			var filename = document.getElementById("dxf-filename").value.trim();

			// Step 4) Validate filename
			if (!filename) {
				window.showModalMessage("Export Cancelled", "No filename provided", "warning");
				return;
			}

			// Step 5) Ensure .dxf extension
			if (!filename.toLowerCase().endsWith(".dxf")) {
				filename += ".dxf";
			}

			dialog.close();

			// Step 6) Route to appropriate export handler with filename
			if (exportType === "holes") {
				await exportDXFHoles(filename);
			} else if (exportType === "kad") {
				await exportDXFKAD(filename);
			} else if (exportType === "vulcan") {
				await exportDXFVulcan(filename);
			} else if (exportType === "3dface") {
				await exportDXF3DFace(filename);
			}
		},
		onCancel: function() {
			dialog.close();
		}
	});

	dialog.show();

	// Step 4) Add event listener to update filename when export type changes
	var radioButtons = document.querySelectorAll('input[name="dxf-type"]');
	var filenameInput = document.getElementById("dxf-filename");
	radioButtons.forEach(function(radio) {
		radio.addEventListener("change", function() {
			filenameInput.value = defaultFilenames[radio.value];
		});
	});
}

/**
 * Export blast holes to DXF format (2-layer: collars + traces)
 * @param {string} filename - The filename for the export
 */
async function exportDXFHoles(filename) {
	var visibleHoles = window.allBlastHoles.filter(hole => window.isHoleVisible(hole));
	if (visibleHoles.length === 0) {
		window.showModalMessage("No Data", "No visible holes to export", "warning");
		return;
	}

	try {
		var Writer = window.fileManager.writers.get("dxf-holes");
		if (!Writer) {
			throw new Error("DXF Holes writer not registered");
		}

		var writer = new Writer();
		var blob = await writer.write({ holes: visibleHoles });

		if (window.showSaveFilePicker) {
			try {
				var handle = await window.showSaveFilePicker({
					suggestedName: filename,
					types: [
						{
							description: "DXF Files",
							accept: { "application/dxf": [".dxf"] }
						}
					]
				});
				var writable = await handle.createWritable();
				await writable.write(blob);
				await writable.close();
				window.showModalMessage("Export Success", "Exported " + visibleHoles.length + " holes to " + filename, "success");
			} catch (err) {
				if (err.name !== "AbortError") {
					throw err;
				}
			}
		} else {
			writer.downloadFile(blob, filename);
			window.showModalMessage("Export Success", "Exported " + visibleHoles.length + " holes to " + filename, "success");
		}

		console.log("Exported " + visibleHoles.length + " holes to compact 2-layer DXF");
	} catch (error) {
		console.error("DXF export error:", error);
		window.showModalMessage("Export Failed", error.message, "error");
	}
}

/**
 * Export KAD drawings to DXF format (points, lines, polygons, circles, text)
 * @param {string} filename - The filename for the export
 */
async function exportDXFKAD(filename) {
	if (!window.allKADDrawingsMap || window.allKADDrawingsMap.size === 0) {
		window.showModalMessage("No Data", "No drawings to export. Please create some drawings first.", "warning");
		return;
	}

	try {
		var Writer = window.fileManager.writers.get("dxf-kad");
		if (!Writer) {
			throw new Error("DXF KAD writer not found in FileManager");
		}

		var visibleKADMap = new Map();
		window.allKADDrawingsMap.forEach(function(entity, entityName) {
			if (window.isEntityVisible && !window.isEntityVisible(entityName)) {
				return;
			}
			visibleKADMap.set(entityName, entity);
		});

		if (visibleKADMap.size === 0) {
			window.showModalMessage("No Visible Data", "No visible drawings to export", "warning");
			return;
		}

		var writer = new Writer();
		var blob = await writer.write({ kadDrawingsMap: visibleKADMap });

		if (window.showSaveFilePicker) {
			try {
				var handle = await window.showSaveFilePicker({
					suggestedName: filename,
					types: [
						{
							description: "DXF Files",
							accept: { "application/dxf": [".dxf"] }
						}
					]
				});
				var writable = await handle.createWritable();
				await writable.write(blob);
				await writable.close();
				window.showModalMessage("Export Success", "Exported " + visibleKADMap.size + " drawings to " + filename, "success");
			} catch (err) {
				if (err.name !== "AbortError") {
					throw err;
				}
			}
		} else {
			writer.downloadFile(blob, filename);
			window.showModalMessage("Export Success", "Exported " + visibleKADMap.size + " drawings to " + filename, "success");
		}

		console.log("Exported " + visibleKADMap.size + " KAD entities to DXF");
	} catch (error) {
		console.error("DXF KAD export error:", error);
		window.showModalMessage("Export Failed", error.message, "error");
	}
}

/**
 * Export blast holes to Vulcan tagged DXF format (3D POLYLINE with XData)
 * @param {string} filename - The filename for the export
 */
async function exportDXFVulcan(filename) {
	var visibleHoles = window.allBlastHoles.filter(hole => window.isHoleVisible(hole));
	if (visibleHoles.length === 0) {
		window.showModalMessage("No Data", "No visible holes to export", "warning");
		return;
	}

	try {
		var Writer = window.fileManager.writers.get("dxf-vulcan");
		if (!Writer) {
			throw new Error("DXF Vulcan writer not registered");
		}

		// Vulcan DXF should only have POLYLINE with XDATA, no separate text entities
		var writer = new Writer({ includeText: false });
		var blob = await writer.write({ holes: visibleHoles });

		if (window.showSaveFilePicker) {
			try {
				var handle = await window.showSaveFilePicker({
					suggestedName: filename,
					types: [
						{
							description: "DXF Files",
							accept: { "application/dxf": [".dxf"] }
						}
					]
				});
				var writable = await handle.createWritable();
				await writable.write(blob);
				await writable.close();
				window.showModalMessage("Export Success", "Exported " + visibleHoles.length + " holes to " + filename, "success");
			} catch (err) {
				if (err.name !== "AbortError") {
					throw err;
				}
			}
		} else {
			writer.downloadFile(blob, filename);
			window.showModalMessage("Export Success", "Exported " + visibleHoles.length + " holes to " + filename, "success");
		}

		console.log("Exported " + visibleHoles.length + " holes to Vulcan DXF format");
	} catch (error) {
		console.error("DXF Vulcan export error:", error);
		window.showModalMessage("Export Failed", "Error: " + error.message, "error");
	}
}

/**
 * Export surface triangles to DXF 3DFACE format
 * @param {string} filename - The filename for the export
 */
async function exportDXF3DFace(filename) {
	if (!window.loadedSurfaces || window.loadedSurfaces.size === 0) {
		window.showModalMessage("No Data", "No surfaces loaded to export. Please load a surface first.", "warning");
		return;
	}

	var allTriangles = [];
	var surfaceNames = [];
	window.loadedSurfaces.forEach(function(surface) {
		if (surface.visible && surface.triangles && Array.isArray(surface.triangles)) {
			allTriangles = allTriangles.concat(surface.triangles);
			if (surface.name) {
				surfaceNames.push(surface.name);
			}
		}
	});

	if (allTriangles.length === 0) {
		window.showModalMessage("No Data", "No triangles found in loaded surfaces", "warning");
		return;
	}

	try {
		var Writer = window.fileManager.writers.get("dxf-3dface");
		if (!Writer) {
			throw new Error("DXF 3DFACE writer not registered");
		}

		var writer = new Writer();
		var blob = await writer.write({
			triangles: allTriangles,
			layerName: "SURFACE"
		});

		if (window.showSaveFilePicker) {
			try {
				var handle = await window.showSaveFilePicker({
					suggestedName: filename,
					types: [
						{
							description: "DXF Files",
							accept: { "application/dxf": [".dxf"] }
						}
					]
				});
				var writable = await handle.createWritable();
				await writable.write(blob);
				await writable.close();
				window.showModalMessage("Export Success", "Exported " + allTriangles.length + " triangles to " + filename, "success");
			} catch (err) {
				if (err.name !== "AbortError") {
					throw err;
				}
			}
		} else {
			writer.downloadFile(blob, filename);
			window.showModalMessage("Export Success", "Exported " + allTriangles.length + " triangles to " + filename, "success");
		}

		console.log("DXF 3DFACE export completed: " + allTriangles.length + " triangles");
	} catch (error) {
		console.error("DXF 3DFACE export error:", error);
		window.showModalMessage("Export Failed", "Error: " + error.message, "error");
	}
}

// Expose globally for kirra.js to access
window.showDXFExportDialog = showDXFExportDialog;
