// src/fileIO/TextIO/BlastHoleCSVWriter.js
//=============================================================
// BLAST HOLE CSV WRITER
//=============================================================
// Step 1) Writes blast hole data to CSV files in various formats
// Step 2) Extracted from kirra.js convertPointsTo*CSV() functions (lines 11125-11268)
// Step 3) Supports 12, 14, 35 column formats, actual (measured), and allcolumns (dynamic)
// Step 4) Created: 2026-01-03
// Step 5) Updated: 2026-01-04 - Added generateAllColumnsCSV() for future-proof export

import BaseWriter from "../BaseWriter.js";

// Step 5) BlastHoleCSVWriter class
class BlastHoleCSVWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 6) Writer options
		this.format = options.format || "35column"; // 12column, 14column, 35column, actual, allcolumns
		this.decimalPlaces = options.decimalPlaces || 4;
	}

	// Step 7) Main write method
	async write(data) {
		// Step 8) Validate input data
		if (!data || !Array.isArray(data.holes)) {
			throw new Error("Invalid data: holes array required");
		}

		// Step 9) Filter visible holes using base class helper
		var visibleHoles = this.filterVisibleHoles(data.holes);

		if (visibleHoles.length === 0) {
			throw new Error("No visible holes to export");
		}

		// Step 10) Generate CSV based on format
		var csv = "";

		if (this.format === "12column") {
			csv = this.generate12ColumnCSV(visibleHoles);
		} else if (this.format === "14column") {
			csv = this.generate14ColumnCSV(visibleHoles);
		} else if (this.format === "35column") {
			csv = this.generate35ColumnCSV(visibleHoles);
		} else if (this.format === "actual") {
			csv = this.generateActualDataCSV(visibleHoles);
		} else if (this.format === "allcolumns" || this.format === "all") {
			csv = this.generateAllColumnsCSV(visibleHoles);
		} else {
			throw new Error("Unsupported CSV format: " + this.format);
		}

		// Step 11) Create and return blob
		return this.createBlob(csv, "text/csv");
	}

	// Step 12) Generate 12 column CSV format
	generate12ColumnCSV(holes) {
		var csv = "";

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var row = hole.entityName + "," + hole.entityType + "," + hole.holeID + "," + hole.startXLocation + "," + hole.startYLocation + "," + hole.startZLocation + "," + hole.endXLocation + "," + hole.endYLocation + "," + hole.endZLocation + "," + hole.holeDiameter + "," + hole.holeType + "," + hole.fromHoleID + "," + hole.timingDelayMilliseconds + "," + hole.colorHexDecimal;
			csv += row + "\n";
		}

		return csv;
	}

	// Step 13) Generate 14 column CSV format (same as 12 column currently)
	generate14ColumnCSV(holes) {
		var csv = "";

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var row = hole.entityName + "," + hole.entityType + "," + hole.holeID + "," + hole.startXLocation + "," + hole.startYLocation + "," + hole.startZLocation + "," + hole.endXLocation + "," + hole.endYLocation + "," + hole.endZLocation + "," + hole.holeDiameter + "," + hole.holeType + "," + hole.fromHoleID + "," + hole.timingDelayMilliseconds + "," + hole.colorHexDecimal;
			csv += row + "\n";
		}

		return csv;
	}

	// Step 14) Generate 35 column CSV format (all data)
	generate35ColumnCSV(holes) {
		var csv = "";
		var header = "entityName,entityType,holeID,startXLocation,startYLocation,startZLocation,endXLocation,endYLocation,endZLocation,gradeXLocation, gradeYLocation, gradeZLocation, subdrillAmount, subdrillLength, benchHeight, holeDiameter,holeType,fromHoleID,timingDelayMilliseconds,colorHexDecimal,holeLengthCalculated,holeAngle,holeBearing,initiationTime,measuredLength,measuredLengthTimeStamp,measuredMass,measuredMassTimeStamp,measuredComment,measuredCommentTimeStamp, rowID, posID, burden, spacing, connectorCurve";
		csv += header + "\n";

		var dp = this.decimalPlaces;

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];

			// Step 15) Build row with proper decimal formatting (no template literals per RULES)
			var row = hole.entityName + "," + hole.entityType + "," + hole.holeID + "," + hole.startXLocation.toFixed(dp) + "," + hole.startYLocation.toFixed(dp) + "," + hole.startZLocation + "," + hole.endXLocation.toFixed(dp) + "," + hole.endYLocation.toFixed(dp) + "," + hole.endZLocation.toFixed(dp) + "," + hole.gradeXLocation.toFixed(dp) + "," + hole.gradeYLocation.toFixed(dp) + "," + hole.gradeZLocation.toFixed(dp) + "," + hole.subdrillAmount.toFixed(dp) + "," + hole.subdrillLength.toFixed(dp) + "," + hole.benchHeight.toFixed(dp) + "," + hole.holeDiameter.toFixed(dp) + "," + hole.holeType + "," + hole.fromHoleID + "," + hole.timingDelayMilliseconds + "," + hole.colorHexDecimal + "," + hole.holeLengthCalculated.toFixed(dp) + "," + hole.holeAngle.toFixed(dp) + "," + hole.holeBearing.toFixed(dp) + "," + hole.holeTime + "," + hole.measuredLength.toFixed(dp) + "," + hole.measuredLengthTimeStamp + "," + hole.measuredMass.toFixed(dp) + "," + hole.measuredMassTimeStamp + "," + hole.measuredComment + "," + hole.measuredCommentTimeStamp + "," + hole.rowID + "," + hole.posID + "," + hole.burden + "," + hole.spacing + "," + hole.connectorCurve;

			csv += row + "\n";
		}

		return csv;
	}

	// Step 16) Generate actual data CSV (measured data only)
	generateActualDataCSV(holes) {
		var csv = "";
		var header = "entityName,entityType,holeID,measuredLength,measuredLengthTimeStamp,measuredMass,measuredMassTimeStamp,measuredComment,measuredCommentTimeStamp";
		csv += header + "\n";

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var row = hole.entityName + "," + hole.entityType + "," + hole.holeID + "," + hole.measuredLength + "," + hole.measuredLengthTimeStamp + "," + hole.measuredMass + "," + hole.measuredMassTimeStamp + "," + hole.measuredComment + "," + hole.measuredCommentTimeStamp;
			csv += row + "\n";
		}

		return csv;
	}

	// Step 17) Generate ALL columns CSV (dynamically includes every property)
	generateAllColumnsCSV(holes) {
		// Step 18) Validate holes array
		if (!holes || holes.length === 0) {
			return "";
		}

		var csv = "";

		// Step 19) Get all property names from the first hole (dynamic column detection)
		var firstHole = holes[0];
		var allProperties = Object.keys(firstHole);

		// Step 20) Build header row
		var header = allProperties.join(",");
		csv += header + "\n";

		// Step 21) Build data rows
		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var rowValues = [];

			// Step 22) Iterate through all properties in order
			for (var j = 0; j < allProperties.length; j++) {
				var propName = allProperties[j];
				var value = hole[propName];

				// Step 23) Handle different value types
				if (value === null || value === undefined) {
					rowValues.push("");
				} else if (typeof value === "number") {
					// Step 24) Format numbers with decimal places if they have decimals
					if (value % 1 !== 0) {
						rowValues.push(value.toFixed(this.decimalPlaces));
					} else {
						rowValues.push(value);
					}
				} else if (typeof value === "string") {
					// Step 25) Escape strings that contain commas or quotes
					if (value.indexOf(",") !== -1 || value.indexOf('"') !== -1 || value.indexOf("\n") !== -1) {
						// Step 26) Wrap in quotes and escape internal quotes
						var escapedValue = value.replace(/"/g, '""');
						rowValues.push('"' + escapedValue + '"');
					} else {
						rowValues.push(value);
					}
				} else {
					// Step 27) Convert objects/arrays to JSON strings (wrapped in quotes)
					var stringValue = JSON.stringify(value);
					rowValues.push('"' + stringValue.replace(/"/g, '""') + '"');
				}
			}

			// Step 28) Join row values and add to CSV
			csv += rowValues.join(",") + "\n";
		}

		console.log("All Columns CSV: Exported " + holes.length + " holes with " + allProperties.length + " columns");
		return csv;
	}
}

export default BlastHoleCSVWriter;
