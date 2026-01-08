// src/fileIO/MinestarIO/AQMWriter.js
//=============================================================
// MINESTAR AQM CSV WRITER
//=============================================================
// Step 1) Export blast hole data to MineStar AQM CSV format
// Step 2) Supports 11 columns: Pattern, Blast, Name, Easting, Northing, Elevation, Angle, Azimuth, Diameter, Material Type, Instruction
// Step 3) Dynamic column ordering via columnOrderArray parameter
// Step 4) Special azimuth calculation: (holeBearing - 180) % 360
// Step 5) Created: 2026-01-03

import BaseWriter from "../BaseWriter.js";

export default class AQMWriter extends BaseWriter {
	constructor(options = {}) {
		super();
		this.options = options;
	}

	// Step 1) Main write entry point
	async write(data) {
		// Step 2) Validate input data
		if (!data || !data.holes || !Array.isArray(data.holes)) {
			throw new Error("AQMWriter requires holes array");
		}

		// Step 3) Extract parameters from data object
		var holes = data.holes;
		var blastName = data.blastName || "";
		var patternName = data.patternName || "";
		var materialType = data.materialType || "";
		var instructionValue = data.instructionValue || "";
		var useHoleTypeAsInstruction = data.useHoleTypeAsInstruction || false;
		var writeIgnoreColumn = data.writeIgnoreColumn || false;
		var columnOrderArray = data.columnOrderArray || ["Pattern", "Blast", "Name", "Easting", "Northing", "Elevation", "Angle", "Azimuth", "Diameter", "Material Type", "Instruction"];

		// Step 4) Generate AQM CSV content
		var csvContent = this.generateAQMCSV(holes, blastName, patternName, materialType, instructionValue, useHoleTypeAsInstruction, writeIgnoreColumn, columnOrderArray);

		// Step 5) Create Blob for download
		var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

		return blob;
	}

	// Step 2) Core AQM CSV generation logic (extracted from kirra.js:10973-11045)
	generateAQMCSV(holes, blastName, patternName, materialType, instructionValue, useHoleTypeAsInstruction, writeIgnoreColumn, columnOrderArray) {
		// Step 3) Validate holes array
		if (!holes || !Array.isArray(holes) || holes.length === 0) {
			console.warn("AQMWriter: No holes to export");
			return "";
		}

		var aqm = "";
		var material = materialType;
		var pattern = patternName;
		var blast = blastName;
		var instruction = instructionValue;
		var columns = columnOrderArray; // 11 possible columns

		// Step 4) Iterate over holes and convert each to an AQM row
		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];

			var columnOrder = []; // Initialize the column order for each row

			var toeX = parseFloat(hole.endXLocation.toFixed(4));
			var toeY = parseFloat(hole.endYLocation.toFixed(4));
			var toeZ = parseFloat(hole.endZLocation.toFixed(4));

			// Step 5) Iterate over columns and map them to their corresponding values
			for (var j = 0; j < columns.length; j++) {
				if (columns[j] === "Pattern") {
					columnOrder.push(pattern);
				} else if (columns[j] === "Blast") {
					columnOrder.push(blast);
				} else if (columns[j] === "Name") {
					columnOrder.push(hole.holeID);
				} else if (columns[j] === "Easting") {
					columnOrder.push(toeX);
				} else if (columns[j] === "Northing") {
					columnOrder.push(toeY);
				} else if (columns[j] === "Elevation") {
					columnOrder.push(toeZ);
				} else if (columns[j] === "Angle") {
					columnOrder.push(Math.round(hole.holeAngle));
				} else if (columns[j] === "Azimuth") {
					// Special azimuth calculation: (holeBearing - 180) % 360
					var azimuth = parseFloat(((hole.holeBearing - 180) % 360).toFixed(1));
					if (azimuth < 0) {
						azimuth += 360;
					}
					columnOrder.push(azimuth);
				} else if (columns[j] === "Diameter") {
					columnOrder.push(hole.holeDiameter);
				} else if (columns[j] === "Material Type") {
					columnOrder.push(material);
				} else if (columns[j] === "Instruction") {
					if (useHoleTypeAsInstruction) {
						columnOrder.push(hole.holeType);
					} else {
						columnOrder.push(instruction);
					}
				} else if (columns[j] === "Ignore") {
					if (writeIgnoreColumn) {
						columnOrder.push("ignored");
					}
					// Do nothing if not writing ignore column
				}
			}

			// Step 6) Join the column values to create a row and add it to the AQM string
			var row = columnOrder.join(",");
			aqm += row + "\n";
		}

		console.log("AQM Writer: " + holes.length + " holes exported to AQM format");

		return aqm;
	}
}
