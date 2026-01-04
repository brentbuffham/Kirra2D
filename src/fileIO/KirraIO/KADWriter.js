// src/fileIO/KirraIO/KADWriter.js
//=============================================================
// KAD FILE WRITER
//=============================================================
// Step 1) Writes Kirra proprietary KAD format files
// Step 2) Extracted from kirra.js exportKADFile() function (lines 10489-10590)
// Step 3) Supports point, line, poly, circle, text entity types
// Step 4) Created: 2026-01-03

import BaseWriter from "../BaseWriter.js";

// Step 5) KADWriter class
class KADWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);
	}

	// Step 6) Main write method
	async write(data) {
		// Step 7) Validate input data
		if (!data || !data.kadDrawingsMap) {
			throw new Error("Invalid data: kadDrawingsMap required");
		}

		var kadDrawingsMap = data.kadDrawingsMap;

		// Step 8) Check if we have data to export
		if (!kadDrawingsMap || kadDrawingsMap.size === 0) {
			throw new Error("No data to export. Please add some drawings first.");
		}

		console.log("Exporting KAD data, map size:", kadDrawingsMap.size);

		// Step 9) Prepare the CSV content for .kad file
		var csvContentKAD = "";
		var csvContentTXT = "";

		try {
			// Step 10) Iterate through the kadDrawingsMap
			for (var [entityName, entityData] of kadDrawingsMap.entries()) {
				// Step 11) Check visibility using global function if available
				if (window.isEntityVisible && !window.isEntityVisible(entityName)) {
					console.log("Skipping hidden entity:", entityName);
					continue;
				}

				// Step 12) Validate entity data
				if (!entityData || !entityData.entityType) {
					console.warn("Skipping invalid entity: " + entityName);
					continue;
				}

				// Step 13) Process based on entity type
				if (entityData.entityType.trim() === "point") {
					for (var i = 0; i < entityData.data.length; i++) {
						var point = entityData.data[i];
						var csvLine = entityName + "," + entityData.entityType + "," + point.pointID + "," + point.pointXLocation + "," + point.pointYLocation + "," + point.pointZLocation + "," + (point.lineWidth || 1) + "," + point.color + "\n";
						csvContentKAD += csvLine;
						csvContentTXT += csvLine;
					}
				}
				// Step 14) Export poly entities
				else if (entityData.entityType.trim() === "poly") {
					for (var i = 0; i < entityData.data.length; i++) {
						var polygon = entityData.data[i];
						var isLast = i === entityData.data.length - 1;
						var csvLine = entityName + "," + entityData.entityType + "," + polygon.pointID + "," + polygon.pointXLocation + "," + polygon.pointYLocation + "," + polygon.pointZLocation + "," + polygon.lineWidth + "," + polygon.color + "," + (isLast ? "1" : "0") + "\n";
						csvContentKAD += csvLine;
						csvContentTXT += csvLine;
					}
				}
				// Step 15) Export line entities
				else if (entityData.entityType.trim() === "line") {
					for (var i = 0; i < entityData.data.length; i++) {
						var entityLine = entityData.data[i];
						var csvLine = entityName + "," + entityData.entityType + "," + entityLine.pointID + "," + entityLine.pointXLocation + "," + entityLine.pointYLocation + "," + entityLine.pointZLocation + "," + entityLine.lineWidth + "," + entityLine.color + "\n";
						csvContentKAD += csvLine;
						csvContentTXT += csvLine;
					}
				}
				// Step 16) Export circle entities
				else if (entityData.entityType.trim() === "circle") {
					for (var i = 0; i < entityData.data.length; i++) {
						var circle = entityData.data[i];
						var csvLine = entityName + "," + entityData.entityType + "," + circle.pointID + "," + circle.pointXLocation + "," + circle.pointYLocation + "," + circle.pointZLocation + "," + circle.radius + "," + circle.lineWidth + "," + circle.color + "\n";
						csvContentKAD += csvLine;
						csvContentTXT += csvLine;
					}
				}
				// Step 17) Export text entities
				else if (entityData.entityType.trim() === "text") {
					for (var i = 0; i < entityData.data.length; i++) {
						var text = entityData.data[i];
						var exportFontHeight = text.fontHeight || 12;
						var csvLine = entityName + "," + entityData.entityType + "," + text.pointID + "," + text.pointXLocation + "," + text.pointYLocation + "," + text.pointZLocation + "," + text.text + "," + text.color + "," + exportFontHeight + "\n";
						csvContentKAD += csvLine;
						csvContentTXT += csvLine;
					}
				}
			}
		} catch (error) {
			console.error("Error generating KAD export:", error);
			throw new Error("Error exporting KAD file: " + error.message);
		}

		// Step 18) Check if we generated any content
		if (!csvContentKAD) {
			throw new Error("No visible data to export");
		}

		// Step 19) Create blobs for both file types
		var blobKAD = this.createBlob(csvContentKAD, "text/csv");
		var blobTXT = this.createBlob(csvContentTXT, "text/plain");

		// Step 20) Generate timestamp for filenames
		var timestamp = this.generateTimestamp();

		// Step 21) Return both files for download
		return {
			kadFile: blobKAD,
			txtFile: blobTXT,
			kadFilename: "KAD_EXPORT_" + timestamp + ".kad",
			txtFilename: "TXT_EXPORT_" + timestamp + ".txt"
		};
	}
}

export default KADWriter;
