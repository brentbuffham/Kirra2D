// src/fileIO/KirraIO/KADParser.js
//=============================================================
// KAD FILE PARSER
//=============================================================
// Step 1) Parses Kirra proprietary KAD format files
// Step 2) Extracted from kirra.js parseKADFile() function (lines 10159-10485)
// Step 3) Supports point, line, poly, circle, text entity types
// Step 4) Created: 2026-01-03

import BaseParser from "../BaseParser.js";

// Step 5) KADParser class
class KADParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	// Step 6) Main parse method
	async parse(file) {
		// Step 7) Read file as text
		var fileData = await this.readAsText(file);

		// Step 8) Parse the KAD data
		return this.parseKADData(fileData);
	}

	// Step 9) Parse KAD data from string
	parseKADData(fileData) {
		var minX = Infinity;
		var minY = Infinity;
		var pointID, pointXLocation, pointYLocation, pointZLocation, text, radius, color, closed, lineWidth;

		// Step 10) Initialize result map
		var kadDrawingsMap = new Map();

		try {
			// Step 11) Use PapaParse with error handling (if available globally)
			if (!window.Papa) {
				throw new Error("PapaParse library not available");
			}

			var parseResult = window.Papa.parse(fileData, {
				delimiter: "",
				skipEmptyLines: true,
				trimHeaders: true,
				transform: (value) => value.trim()
			});

			// Step 12) Check for critical parsing errors
			var criticalErrors = parseResult.errors.filter((error) => error.type === "Delimiter" || error.type === "Quotes");

			if (criticalErrors.length > 0) {
				var errorMessages = criticalErrors.map((error) => error.message).join(", ");
				throw new Error("File parsing error: " + errorMessages);
			}

			// Step 13) Warn about minor parsing issues but continue
			if (parseResult.errors.length > 0) {
				console.warn("CSV parsing warnings:", parseResult.errors);
			}

			var dataRows = parseResult.data;

			// Step 14) Check if we got any data
			if (dataRows.length === 0) {
				throw new Error("The file appears to be empty or contains no valid data");
			}

			console.log("Parsed " + dataRows.length + " rows with delimiter: " + parseResult.meta.delimiter);

			var successCount = 0;
			var errorCount = 0;
			var errorDetails = [];

			// Step 15) Parse each row with individual error handling
			for (var i = 0; i < dataRows.length; i++) {
				try {
					var row = dataRows[i];

					// Step 16) Skip rows that don't have enough columns
					if (row.length < 3) {
						errorCount++;
						errorDetails.push("Row " + (i + 1) + ": Too few columns (" + row.length + ")");
						continue;
					}

					var entityName = row[0];
					var entityType = row[1];

					// Step 17) Skip if missing essential data
					if (!entityName || !entityType) {
						errorCount++;
						errorDetails.push("Row " + (i + 1) + ": Missing entity name or type");
						continue;
					}

					// Step 18) Validate entity type
					var validTypes = ["point", "line", "poly", "circle", "text"];
					if (!validTypes.includes(entityType)) {
						errorCount++;
						errorDetails.push("Row " + (i + 1) + ": Invalid entity type '" + entityType + "'");
						continue;
					}

					// Step 19) Parse based on entity type
					switch (entityType) {
						case "point":
							if (!kadDrawingsMap.has(entityName)) {
								kadDrawingsMap.set(entityName, {
									entityName: entityName,
									entityType: "point",
									data: []
								});
							}

							pointID = parseInt(row[2]);
							pointXLocation = parseFloat(row[3]);
							pointYLocation = parseFloat(row[4]);
							pointZLocation = parseFloat(row[5]);
							lineWidth = parseFloat(row[6]) || 1;
							color = this.cssColorToHex((row[7] || "#FF0000").replace(/\r$/, ""));

							kadDrawingsMap.get(entityName).data.push({
								entityName: entityName,
								entityType: entityType,
								pointID: pointID,
								pointXLocation: pointXLocation,
								pointYLocation: pointYLocation,
								pointZLocation: pointZLocation,
								lineWidth: lineWidth,
								color: color,
								connected: false,
								closed: false
							});
							break;

						case "poly":
							if (!kadDrawingsMap.has(entityName)) {
								kadDrawingsMap.set(entityName, {
									entityName: entityName,
									entityType: entityType,
									data: []
								});
							}

							pointID = parseInt(row[2]);
							pointXLocation = parseFloat(row[3]);
							pointYLocation = parseFloat(row[4]);
							pointZLocation = parseFloat(row[5]);
							lineWidth = parseFloat(row[6]);
							color = this.cssColorToHex((row[7] || "#FF0000").replace(/\r$/, ""));
							closed = String(row[8]).trim().toLowerCase() === "true";

							kadDrawingsMap.get(entityName).data.push({
								entityName: entityName,
								entityType: entityType,
								pointID: pointID,
								pointXLocation: pointXLocation,
								pointYLocation: pointYLocation,
								pointZLocation: pointZLocation,
								lineWidth: lineWidth,
								color: color,
								closed: closed
							});
							break;

						case "line":
							if (!kadDrawingsMap.has(entityName)) {
								kadDrawingsMap.set(entityName, {
									entityName: entityName,
									entityType: "line",
									data: []
								});
							}

							pointID = parseInt(row[2]);
							pointXLocation = parseFloat(row[3]);
							pointYLocation = parseFloat(row[4]);
							pointZLocation = parseFloat(row[5]);
							lineWidth = parseFloat(row[6]);
							color = this.cssColorToHex((row[7] || "#FF0000").replace(/\r$/, ""));

							kadDrawingsMap.get(entityName).data.push({
								entityName: entityName,
								entityType: "line",
								pointID: pointID,
								pointXLocation: pointXLocation,
								pointYLocation: pointYLocation,
								pointZLocation: pointZLocation,
								lineWidth: lineWidth,
								color: color,
								closed: false
							});
							break;

						case "circle":
							if (!kadDrawingsMap.has(entityName)) {
								kadDrawingsMap.set(entityName, {
									entityName: entityName,
									entityType: "circle",
									data: []
								});
							}

							pointID = parseInt(row[2]);
							pointXLocation = parseFloat(row[3]);
							pointYLocation = parseFloat(row[4]);
							pointZLocation = parseFloat(row[5]);
							radius = parseFloat(row[6]);
							lineWidth = parseFloat(row[7]) || 1;
							color = this.cssColorToHex((row[8] || "#FF0000").replace(/\r$/, ""));

							kadDrawingsMap.get(entityName).data.push({
								entityName: entityName,
								entityType: "circle",
								pointID: pointID,
								pointXLocation: pointXLocation,
								pointYLocation: pointYLocation,
								pointZLocation: pointZLocation,
								radius: radius,
								lineWidth: lineWidth,
								color: color
							});
							break;

						case "text":
							if (!kadDrawingsMap.has(entityName)) {
								kadDrawingsMap.set(entityName, {
									entityName: entityName,
									entityType: "text",
									data: []
								});
							}

							pointID = parseInt(row[2]);
							pointXLocation = parseFloat(row[3]);
							pointYLocation = parseFloat(row[4]);
							pointZLocation = parseFloat(row[5]);
							text = row[6] || "";
							color = this.cssColorToHex((row[7] || "#FF0000").replace(/\r$/, ""));
							var textFontHeight = row[8] ? parseFloat(row[8]) : 12;

							kadDrawingsMap.get(entityName).data.push({
								entityName: entityName,
								entityType: "text",
								pointID: pointID,
								pointXLocation: pointXLocation,
								pointYLocation: pointYLocation,
								pointZLocation: pointZLocation,
								text: text,
								color: color,
								fontHeight: textFontHeight
							});
							break;
					}

					successCount++;
				} catch (rowError) {
					errorCount++;
					errorDetails.push("Row " + (i + 1) + ": " + rowError.message);
					console.error("Error parsing row " + (i + 1) + ":", rowError);
				}
			}

			// Step 20) Calculate centroid
			var sumX = 0;
			var sumY = 0;
			var count = 0;

			for (var [key, value] of kadDrawingsMap) {
				for (var i = 0; i < value.data.length; i++) {
					sumX += value.data[i].pointXLocation;
					sumY += value.data[i].pointYLocation;
					count++;
				}
			}

			var centroidX = 0;
			var centroidY = 0;

			if (count > 0) {
				centroidX = sumX / count;
				centroidY = sumY / count;
			}

			// Step 21) Return parsed data
			return {
				kadDrawingsMap: kadDrawingsMap,
				successCount: successCount,
				errorCount: errorCount,
				errorDetails: errorDetails,
				centroidX: centroidX,
				centroidY: centroidY
			};
		} catch (error) {
			// Step 22) Catch any unexpected errors
			console.error("Unexpected error during KAD file parsing:", error);
			throw new Error("Unexpected error during KAD file parsing: " + error.message);
		}
	}

	// Step 23) Helper function to convert CSS color to hex
	cssColorToHex(colorString) {
		// Step 24) Check if color conversion function exists globally
		if (window.cssColorToHex) {
			return window.cssColorToHex(colorString);
		}

		// Step 25) Fallback: basic color conversion
		if (colorString.startsWith("#")) {
			return colorString;
		}

		// Step 26) Return default red if can't convert
		return "#FF0000";
	}
}

export default KADParser;
