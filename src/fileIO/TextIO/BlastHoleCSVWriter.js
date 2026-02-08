// src/fileIO/TextIO/BlastHoleCSVWriter.js
//=============================================================
// BLAST HOLE CSV WRITER
//=============================================================
// Step 1) Writes blast hole data to CSV files in various formats
// Step 2) Extracted from kirra.js convertPointsTo*CSV() functions (lines 11125-11268)
// Step 3) Supports all CSV formats: 4, 7, 9, 12, 14, 30, 32, 35 columns, actual (measured), and allcolumns (dynamic)
// Step 4) Created: 2026-01-03
// Step 5) Updated: 2026-01-04 - Added generateAllColumnsCSV() for future-proof export
// Step 6) Updated: 2026-01-04 - Added all remaining column formats (4, 7, 9, 30, 32)

import BaseWriter from "../BaseWriter.js";

// Step 5) BlastHoleCSVWriter class
class BlastHoleCSVWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 6) Writer options
		this.format = options.format || "35column"; // 4column, 7column, 9column, 12column, 14column, 30column, 32column, 35column, actual, allcolumns
		this.decimalPlaces = options.decimalPlaces || 4;
	}

	// Step 7) Helper function to safely format numeric values
	safeToFixed(value, dp) {
		// Step 7a) Convert to number and check if valid
		var num = parseFloat(value);
		if (isNaN(num)) {
			return "0." + "0".repeat(dp); // Return "0.0000" for invalid values
		}
		return num.toFixed(dp);
	}

	// Step 8) Main write method
	async write(data) {
		// Step 9) Validate input data
		if (!data || !Array.isArray(data.holes)) {
			throw new Error("Invalid data: holes array required");
		}

		// Step 10) Filter visible holes using base class helper
		var visibleHoles = this.filterVisibleHoles(data.holes);

		if (visibleHoles.length === 0) {
			throw new Error("No visible holes to export");
		}

		// Step 10) Generate CSV based on format
		var csv = "";

		if (this.format === "4column") {
			csv = this.generate4ColumnCSV(visibleHoles);
		} else if (this.format === "7column") {
			csv = this.generate7ColumnCSV(visibleHoles);
		} else if (this.format === "9column") {
			csv = this.generate9ColumnCSV(visibleHoles);
		} else if (this.format === "12column") {
			csv = this.generate12ColumnCSV(visibleHoles);
		} else if (this.format === "14column") {
			csv = this.generate14ColumnCSV(visibleHoles);
		} else if (this.format === "30column") {
			csv = this.generate30ColumnCSV(visibleHoles);
		} else if (this.format === "32column") {
			csv = this.generate32ColumnCSV(visibleHoles);
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

	// Step 12) Generate 4 column CSV format: [ID, CollarX, CollarY, CollarZ]
	generate4ColumnCSV(holes) {
		var csv = "";
		var dp = this.decimalPlaces;

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var row = (hole.holeID || "") + "," +
				this.safeToFixed(hole.startXLocation, dp) + "," +
				this.safeToFixed(hole.startYLocation, dp) + "," +
				this.safeToFixed(hole.startZLocation, dp);
			csv += row + "\n";
		}

		return csv;
	}

	// Step 13) Generate 7 column CSV format: [ID, CX, CY, CZ, TX, TY, TZ]
	generate7ColumnCSV(holes) {
		var csv = "";
		var dp = this.decimalPlaces;

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var row = (hole.holeID || "") + "," +
				this.safeToFixed(hole.startXLocation, dp) + "," +
				this.safeToFixed(hole.startYLocation, dp) + "," +
				this.safeToFixed(hole.startZLocation, dp) + "," +
				this.safeToFixed(hole.endXLocation, dp) + "," +
				this.safeToFixed(hole.endYLocation, dp) + "," +
				this.safeToFixed(hole.endZLocation, dp);
			csv += row + "\n";
		}

		return csv;
	}

	// Step 14) Generate 9 column CSV format: [ID, CX, CY, CZ, TX, TY, TZ, DIAM, HOLETYPE]
	generate9ColumnCSV(holes) {
		var csv = "";
		var dp = this.decimalPlaces;

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var row = (hole.holeID || "") + "," +
				this.safeToFixed(hole.startXLocation, dp) + "," +
				this.safeToFixed(hole.startYLocation, dp) + "," +
				this.safeToFixed(hole.startZLocation, dp) + "," +
				this.safeToFixed(hole.endXLocation, dp) + "," +
				this.safeToFixed(hole.endYLocation, dp) + "," +
				this.safeToFixed(hole.endZLocation, dp) + "," +
				this.safeToFixed(hole.holeDiameter, dp) + "," +
				(hole.holeType || "");
			csv += row + "\n";
		}

		return csv;
	}

	// Step 15) Generate 12 column CSV format: [ID, X, Y, Z, ToeX, ToeY, ToeZ, Diameter, Type, FromHole, Delay, Color]
	generate12ColumnCSV(holes) {
		var csv = "";
		var dp = this.decimalPlaces;

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var row = (hole.holeID || "") + "," +
				this.safeToFixed(hole.startXLocation, dp) + "," +
				this.safeToFixed(hole.startYLocation, dp) + "," +
				this.safeToFixed(hole.startZLocation, dp) + "," +
				this.safeToFixed(hole.endXLocation, dp) + "," +
				this.safeToFixed(hole.endYLocation, dp) + "," +
				this.safeToFixed(hole.endZLocation, dp) + "," +
				this.safeToFixed(hole.holeDiameter, dp) + "," +
				(hole.holeType || "") + "," +
				(hole.fromHoleID || "") + "," +
				(hole.timingDelayMilliseconds || 0) + "," +
				(hole.colorHexDecimal || "");
			csv += row + "\n";
		}

		return csv;
	}

	// Step 16) Generate 14 column CSV format: [entityName, entityType, ID, X, Y, Z, ToeX, ToeY, ToeZ, Diameter, Type, FromHole, Delay, Color]
	generate14ColumnCSV(holes) {
		var csv = "";
		var dp = this.decimalPlaces;

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var row = (hole.entityName || "") + "," +
				(hole.entityType || "") + "," +
				(hole.holeID || "") + "," +
				this.safeToFixed(hole.startXLocation, dp) + "," +
				this.safeToFixed(hole.startYLocation, dp) + "," +
				this.safeToFixed(hole.startZLocation, dp) + "," +
				this.safeToFixed(hole.endXLocation, dp) + "," +
				this.safeToFixed(hole.endYLocation, dp) + "," +
				this.safeToFixed(hole.endZLocation, dp) + "," +
				this.safeToFixed(hole.holeDiameter, dp) + "," +
				(hole.holeType || "") + "," +
				(hole.fromHoleID || "") + "," +
				(hole.timingDelayMilliseconds || 0) + "," +
				(hole.colorHexDecimal || "");
			csv += row + "\n";
		}

		return csv;
	}

	// Step 17) Generate 30 column CSV format (35 columns minus measured data)
	generate30ColumnCSV(holes) {
		var csv = "";
		var header = "entityName,entityType,holeID,startXLocation,startYLocation,startZLocation,endXLocation,endYLocation,endZLocation,gradeXLocation,gradeYLocation,gradeZLocation,subdrillAmount,subdrillLength,benchHeight,holeDiameter,holeType,fromHoleID,timingDelayMilliseconds,colorHexDecimal,holeLengthCalculated,holeAngle,holeBearing,holeTime,rowID,posID,burden,spacing,connectorCurve";
		csv += header + "\n";

		var dp = this.decimalPlaces;

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];

			// 30 columns: All standard data without measured fields
			var row = (hole.entityName || "") + "," +
				(hole.entityType || "") + "," +
				(hole.holeID || "") + "," +
				this.safeToFixed(hole.startXLocation, dp) + "," +
				this.safeToFixed(hole.startYLocation, dp) + "," +
				this.safeToFixed(hole.startZLocation, dp) + "," +
				this.safeToFixed(hole.endXLocation, dp) + "," +
				this.safeToFixed(hole.endYLocation, dp) + "," +
				this.safeToFixed(hole.endZLocation, dp) + "," +
				this.safeToFixed(hole.gradeXLocation, dp) + "," +
				this.safeToFixed(hole.gradeYLocation, dp) + "," +
				this.safeToFixed(hole.gradeZLocation, dp) + "," +
				this.safeToFixed(hole.subdrillAmount, dp) + "," +
				this.safeToFixed(hole.subdrillLength, dp) + "," +
				this.safeToFixed(hole.benchHeight, dp) + "," +
				this.safeToFixed(hole.holeDiameter, dp) + "," +
				(hole.holeType || "") + "," +
				(hole.fromHoleID || "") + "," +
				(hole.timingDelayMilliseconds || 0) + "," +
				(hole.colorHexDecimal || "") + "," +
				this.safeToFixed(hole.holeLengthCalculated, dp) + "," +
				this.safeToFixed(hole.holeAngle, dp) + "," +
				this.safeToFixed(hole.holeBearing, dp) + "," +
				(hole.holeTime || "") + "," +
				(hole.rowID || "") + "," +
				(hole.posID || "") + "," +
				this.safeToFixed(hole.burden, dp) + "," +
				this.safeToFixed(hole.spacing, dp) + "," +
				(hole.connectorCurve || "");

			csv += row + "\n";
		}

		return csv;
	}

	// Step 18) Generate 32 column CSV format (30 columns plus measuredLength and measuredMass)
	generate32ColumnCSV(holes) {
		var csv = "";
		var header = "entityName,entityType,holeID,startXLocation,startYLocation,startZLocation,endXLocation,endYLocation,endZLocation,gradeXLocation,gradeYLocation,gradeZLocation,subdrillAmount,subdrillLength,benchHeight,holeDiameter,holeType,fromHoleID,timingDelayMilliseconds,colorHexDecimal,holeLengthCalculated,holeAngle,holeBearing,holeTime,measuredLength,measuredMass,rowID,posID,burden,spacing,connectorCurve";
		csv += header + "\n";

		var dp = this.decimalPlaces;

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];

			// 32 columns: 30 columns plus measuredLength and measuredMass
			var row = (hole.entityName || "") + "," +
				(hole.entityType || "") + "," +
				(hole.holeID || "") + "," +
				this.safeToFixed(hole.startXLocation, dp) + "," +
				this.safeToFixed(hole.startYLocation, dp) + "," +
				this.safeToFixed(hole.startZLocation, dp) + "," +
				this.safeToFixed(hole.endXLocation, dp) + "," +
				this.safeToFixed(hole.endYLocation, dp) + "," +
				this.safeToFixed(hole.endZLocation, dp) + "," +
				this.safeToFixed(hole.gradeXLocation, dp) + "," +
				this.safeToFixed(hole.gradeYLocation, dp) + "," +
				this.safeToFixed(hole.gradeZLocation, dp) + "," +
				this.safeToFixed(hole.subdrillAmount, dp) + "," +
				this.safeToFixed(hole.subdrillLength, dp) + "," +
				this.safeToFixed(hole.benchHeight, dp) + "," +
				this.safeToFixed(hole.holeDiameter, dp) + "," +
				(hole.holeType || "") + "," +
				(hole.fromHoleID || "") + "," +
				(hole.timingDelayMilliseconds || 0) + "," +
				(hole.colorHexDecimal || "") + "," +
				this.safeToFixed(hole.holeLengthCalculated, dp) + "," +
				this.safeToFixed(hole.holeAngle, dp) + "," +
				this.safeToFixed(hole.holeBearing, dp) + "," +
				(hole.holeTime || "") + "," +
				this.safeToFixed(hole.measuredLength, dp) + "," +
				this.safeToFixed(hole.measuredMass, dp) + "," +
				(hole.rowID || "") + "," +
				(hole.posID || "") + "," +
				this.safeToFixed(hole.burden, dp) + "," +
				this.safeToFixed(hole.spacing, dp) + "," +
				(hole.connectorCurve || "");

			csv += row + "\n";
		}

		return csv;
	}

	// Step 14) Generate 35 column CSV format (all data)
	generate35ColumnCSV(holes) {
		var csv = "";
		var header = "entityName,entityType,holeID,startXLocation,startYLocation,startZLocation,endXLocation,endYLocation,endZLocation,gradeXLocation,gradeYLocation,gradeZLocation,subdrillAmount,subdrillLength,benchHeight,holeDiameter,holeType,fromHoleID,timingDelayMilliseconds,colorHexDecimal,holeLengthCalculated,holeAngle,holeBearing,holeTime,measuredLength,measuredLengthTimeStamp,measuredMass,measuredMassTimeStamp,measuredComment,measuredCommentTimeStamp,rowID,posID,burden,spacing,connectorCurve";
		csv += header + "\n";

		var dp = this.decimalPlaces;

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];

			// Step 15) Build row with safe decimal formatting
			var row = (hole.entityName || "") + "," +
				(hole.entityType || "") + "," +
				(hole.holeID || "") + "," +
				this.safeToFixed(hole.startXLocation, dp) + "," +
				this.safeToFixed(hole.startYLocation, dp) + "," +
				this.safeToFixed(hole.startZLocation, dp) + "," +
				this.safeToFixed(hole.endXLocation, dp) + "," +
				this.safeToFixed(hole.endYLocation, dp) + "," +
				this.safeToFixed(hole.endZLocation, dp) + "," +
				this.safeToFixed(hole.gradeXLocation, dp) + "," +
				this.safeToFixed(hole.gradeYLocation, dp) + "," +
				this.safeToFixed(hole.gradeZLocation, dp) + "," +
				this.safeToFixed(hole.subdrillAmount, dp) + "," +
				this.safeToFixed(hole.subdrillLength, dp) + "," +
				this.safeToFixed(hole.benchHeight, dp) + "," +
				this.safeToFixed(hole.holeDiameter, dp) + "," +
				(hole.holeType || "") + "," +
				(hole.fromHoleID || "") + "," +
				(hole.timingDelayMilliseconds || 0) + "," +
				(hole.colorHexDecimal || "") + "," +
				this.safeToFixed(hole.holeLengthCalculated, dp) + "," +
				this.safeToFixed(hole.holeAngle, dp) + "," +
				this.safeToFixed(hole.holeBearing, dp) + "," +
				(hole.holeTime || "") + "," +
				this.safeToFixed(hole.measuredLength, dp) + "," +
				(hole.measuredLengthTimeStamp || "") + "," +
				this.safeToFixed(hole.measuredMass, dp) + "," +
				(hole.measuredMassTimeStamp || "") + "," +
				(hole.measuredComment || "") + "," +
				(hole.measuredCommentTimeStamp || "") + "," +
				(hole.rowID || "") + "," +
				(hole.posID || "") + "," +
				this.safeToFixed(hole.burden, dp) + "," +
				this.safeToFixed(hole.spacing, dp) + "," +
				(hole.connectorCurve || "");

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
					// Use safeToFixed to handle NaN values
					if (isNaN(value)) {
						rowValues.push("0." + "0".repeat(this.decimalPlaces));
					} else if (value % 1 !== 0) {
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
