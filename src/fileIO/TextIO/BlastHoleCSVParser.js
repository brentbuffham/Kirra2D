// src/fileIO/TextIO/BlastHoleCSVParser.js
//=============================================================
// BLAST HOLE CSV PARSER
//=============================================================
// Step 1) Parses blast hole CSV files with multiple column format support
// Step 2) Extracted from kirra.js parseK2Dcsv() function (lines 8305-8622)
// Step 3) Supports 4, 7, 9, 12, 14, 20, 25, 30, 32, 35 column formats
// Step 4) Created: 2026-01-03

import BaseParser from "../BaseParser.js";

// Step 5) BlastHoleCSVParser class
class BlastHoleCSVParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	// Step 6) Main parse method
	async parse(file) {
		// Step 7) Read file as text
		var data = await this.readAsText(file);

		// Step 8) Parse the CSV data
		return this.parseCSVData(data);
	}

	// Step 9) Parse CSV data from string
	parseCSVData(data) {
		// Step 10) Initialize result arrays
		var parsedHoles = [];
		var randomHex = Math.floor(Math.random() * 16777215).toString(16);

		var lines = data.split("\n");
		var minX = Infinity;
		var minY = Infinity;

		var supportedLengths = [4, 7, 9, 12, 14, 20, 25, 30, 32, 35];
		var warnings = [];
		var newHolesForRowDetection = [];

		var blastNameValue = "BLAST_" + randomHex;

		// Step 11) Parse each line
		for (var i = 0; i < lines.length; i++) {
			var rawLine = lines[i].trim();
			if (rawLine === "") continue;

			var values = rawLine.split(",");
			var len = values.length;

			// Step 12) Skip empty lines
			if (values.every((v) => v.trim() === "")) continue;

			// Step 12a) CRITICAL FIX: Skip header row by checking if coordinate columns contain text instead of numbers
			// For valid hole data, columns 3,4,5 (startX, startY, startZ) must be numeric
			// If they're NOT numeric, this is likely a header row
			if (len >= 6 && i < 3) { // Only check first 3 lines for headers
				var col3 = values[3] ? values[3].trim() : "";
				var col4 = values[4] ? values[4].trim() : "";
				var col5 = values[5] ? values[5].trim() : "";

				// Check if these coordinate columns are non-numeric (header keywords)
				var isHeader = isNaN(parseFloat(col3)) || isNaN(parseFloat(col4)) || isNaN(parseFloat(col5));

				if (isHeader) {
					console.log("📋 Skipping header row at line " + (i + 1) + ": " + values.slice(0, 5).join(","));
					continue;
				}
			}

			// Step 13) Validate column count
			if (!supportedLengths.includes(len)) {
				warnings.push("Line " + (i + 1) + " skipped: unsupported column count (" + len + ")");
				continue;
			}

			// Step 14) Initialize hole properties with defaults
			var entityName = blastNameValue;
			var holeID, startX, startY, startZ, endX, endY, endZ;
			var holeDiameter = 0,
				holeType = "Undefined",
				fromHoleID = "",
				delay = 0,
				color = "red";
			var measuredLength = 0,
				measuredLengthTimeStamp = "09/05/1975 00:00:00";
			var measuredMass = 0,
				measuredMassTimeStamp = "09/05/1975 00:00:00";
			var measuredComment = "None",
				measuredCommentTimeStamp = "09/05/1975 00:00:00";
			var subdrill = 0;
			var rowID = 0;
			var posID = 0;
			var burden = 0;
			var spacing = 0;
			var connectorCurve = 0;

			// Step 15) Parse based on column count (35 column format - full data)
			if (len === 35) {
				entityName = values[0];
				holeID = values[2];
				startX = parseFloat(values[3]);
				startY = parseFloat(values[4]);
				startZ = parseFloat(values[5]);
				endX = parseFloat(values[6]);
				endY = parseFloat(values[7]);
				endZ = parseFloat(values[8]);
				subdrill = parseFloat(values[12]);
				holeDiameter = parseFloat(values[15]);
				holeType = values[16];
				fromHoleID = values[17];
				delay = parseInt(values[18]);
				color = values[19].replace(/\r$/, "");
				measuredLength = parseFloat(values[24]);
				measuredLengthTimeStamp = values[25];
				measuredMass = parseFloat(values[26]);
				measuredMassTimeStamp = values[27];
				measuredComment = values[28];
				measuredCommentTimeStamp = values[29];
				rowID = values[30] && values[30].trim() !== "" ? parseInt(values[30]) : null;
				posID = values[31] && values[31].trim() !== "" ? parseInt(values[31]) : null;
				burden = parseFloat(values[32]);
				spacing = parseFloat(values[33]);
				connectorCurve = parseInt(values[34]);
			}
			// Step 16) Parse 32 column format
			else if (len === 32) {
				entityName = values[0];
				holeID = values[2];
				startX = parseFloat(values[3]);
				startY = parseFloat(values[4]);
				startZ = parseFloat(values[5]);
				endX = parseFloat(values[6]);
				endY = parseFloat(values[7]);
				endZ = parseFloat(values[8]);
				subdrill = parseFloat(values[12]);
				holeDiameter = parseFloat(values[15]);
				holeType = values[16];
				fromHoleID = values[17];
				delay = parseInt(values[18]);
				color = values[19].replace(/\r$/, "");
				measuredLength = parseFloat(values[24]);
				measuredLengthTimeStamp = values[25];
				measuredMass = parseFloat(values[26]);
				measuredMassTimeStamp = values[27];
				measuredComment = values[28];
				measuredCommentTimeStamp = values[29];
				rowID = values[30] && values[30].trim() !== "" ? parseInt(values[30]) : null;
				posID = values[31] && values[31].trim() !== "" ? parseInt(values[31]) : null;
			}
			// Step 17) Parse 30 column format
			else if (len === 30) {
				entityName = values[0];
				holeID = values[2];
				startX = parseFloat(values[3]);
				startY = parseFloat(values[4]);
				startZ = parseFloat(values[5]);
				endX = parseFloat(values[6]);
				endY = parseFloat(values[7]);
				endZ = parseFloat(values[8]);
				subdrill = parseFloat(values[12]);
				holeDiameter = parseFloat(values[15]);
				holeType = values[16];
				fromHoleID = values[17];
				delay = parseInt(values[18]);
				color = values[19].replace(/\r$/, "");
				measuredLength = parseFloat(values[24]);
				measuredLengthTimeStamp = values[25];
				measuredMass = parseFloat(values[26]);
				measuredMassTimeStamp = values[27];
				measuredComment = values[28];
				measuredCommentTimeStamp = values[29];
			}
			// Step 18) Parse 14 column format
			else if (len === 14) {
				entityName = values[0];
				holeID = values[2];
				startX = parseFloat(values[3]);
				startY = parseFloat(values[4]);
				startZ = parseFloat(values[5]);
				endX = parseFloat(values[6]);
				endY = parseFloat(values[7]);
				endZ = parseFloat(values[8]);
				holeDiameter = parseFloat(values[9]);
				holeType = values[10];
				fromHoleID = values[11];
				delay = parseInt(values[12]);
				color = values[13].replace(/\r$/, "");
			}
			// Step 19) Parse 12 column format
			else if (len === 12) {
				holeID = values[0];
				startX = parseFloat(values[1]);
				startY = parseFloat(values[2]);
				startZ = parseFloat(values[3]);
				endX = parseFloat(values[4]);
				endY = parseFloat(values[5]);
				endZ = parseFloat(values[6]);
				holeDiameter = parseFloat(values[7]);
				holeType = values[8];
				fromHoleID = values[9].includes(":::") ? values[9] : blastNameValue + ":::" + values[9];
				delay = parseInt(values[10]);
				color = values[11].replace(/\r$/, "");
			}
			// Step 20) Parse 9 column format
			else if (len === 9) {
				holeID = values[0];
				startX = parseFloat(values[1]);
				startY = parseFloat(values[2]);
				startZ = parseFloat(values[3]);
				endX = parseFloat(values[4]);
				endY = parseFloat(values[5]);
				endZ = parseFloat(values[6]);
				holeDiameter = parseFloat(values[7]);
				holeType = values[8];
				fromHoleID = blastNameValue + ":::" + holeID;
			}
			// Step 21) Parse 7 column format
			else if (len === 7) {
				holeID = values[0];
				startX = parseFloat(values[1]);
				startY = parseFloat(values[2]);
				startZ = parseFloat(values[3]);
				endX = parseFloat(values[4]);
				endY = parseFloat(values[5]);
				endZ = parseFloat(values[6]);
				fromHoleID = blastNameValue + ":::" + holeID;
			}
			// Step 22) Parse 4 column format (collar only)
			else if (len === 4) {
				holeID = values[0];
				startX = parseFloat(values[1]);
				startY = parseFloat(values[2]);
				startZ = parseFloat(values[3]);
				endX = startX;
				endY = startY;
				endZ = startZ;
				fromHoleID = blastNameValue + ":::" + holeID;
			}

			// Step 23) Calculate basic hole properties
			var dx = endX - startX;
			var dy = endY - startY;
			var dz = endZ - startZ;
			var length = Math.sqrt(dx * dx + dy * dy + dz * dz);

			var epsilon = 1e-10;
			var magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
			var dotProduct = dz;
			var normalizedDotProduct = magnitude < epsilon ? 0 : dotProduct / magnitude;

			var angle = 180 - Math.acos(normalizedDotProduct) * (180 / Math.PI);
			var bearing = (450 - Math.atan2(dy, dx) * (180 / Math.PI)) % 360;

			// Step 24) Validate coordinates and create hole object
			if (!isNaN(startX) && !isNaN(startY) && !isNaN(startZ) && !isNaN(endX) && !isNaN(endY) && !isNaN(endZ)) {
				// Step 25) CRITICAL: Calculate grade from subdrillAmount (VERTICAL distance)
				// subdrillAmount is VERTICAL deltaZ (like benchHeight), NOT vector distance
				// subdrillAmount > 0: Grade ABOVE toe (downhole positive)
				// subdrillAmount < 0: Grade BELOW toe (uphole negative)

				// Grade Z is simple: toeZ + vertical subdrill amount
				var gradeZ = endZ + subdrill;

				// Horizontal offset from toe to grade (projected onto horizontal plane)
				// For vertical holes (angle=0): horizontal offset = 0
				// For angled holes: horizontal offset = subdrillAmount * tan(angle)
				var angleRad = angle * (Math.PI / 180);
				var bearingRad = bearing * (Math.PI / 180);
				var horizontalOffset = subdrill * Math.tan(angleRad);

				// Grade XY moves horizontally back toward collar
				var gradeX = endX - horizontalOffset * Math.sin(bearingRad);
				var gradeY = endY - horizontalOffset * Math.cos(bearingRad);

				// Calculate subdrillLength (3D distance along hole vector from grade to toe)
				// subdrillLength = subdrillAmount / cos(angle)
				var subdrillLength = Math.abs(angle) < 0.001 ? subdrill : subdrill / Math.cos(angleRad);

				var hole = {
					entityName: entityName,
					entityType: "hole", // CRITICAL: All imported holes are type "hole"
					holeID: holeID,
					startXLocation: startX,
					startYLocation: startY,
					startZLocation: startZ,
					gradeXLocation: gradeX, // Grade lies on hole vector
					gradeYLocation: gradeY,
					gradeZLocation: gradeZ,
					holeDiameter: holeDiameter,
					holeType: holeType,
					holeLengthCalculated: length,
					subdrillAmount: subdrill, // Vertical distance (deltaZ)
					subdrillLength: subdrillLength, // Vector distance along hole
					holeAngle: angle,
					holeBearing: bearing,
					measuredLength: measuredLength,
					measuredLengthTimeStamp: measuredLengthTimeStamp,
					measuredMass: measuredMass,
					measuredMassTimeStamp: measuredMassTimeStamp,
					measuredComment: measuredComment,
					measuredCommentTimeStamp: measuredCommentTimeStamp,
					fromHoleID: fromHoleID,
					timingDelayMilliseconds: delay,
					colorHexDecimal: color,
					rowID: rowID || null,
					posID: posID || null,
					burden: burden || 1,
					spacing: spacing || 1,
					connectorCurve: connectorCurve || 0
				};

				// Step 26) Add to parsed holes array
				parsedHoles.push(hole);

				// Step 27) Track holes that need row detection
				if (rowID === null || rowID === 0 || posID === null || posID === 0) {
					newHolesForRowDetection.push(hole);
				}

				minX = Math.min(minX, startX);
				minY = Math.min(minY, startY);
			}
		}

		// Step 32) Group holes by entity for row detection
		var entitiesForRowDetection = new Map();
		newHolesForRowDetection.forEach((hole) => {
			if (!entitiesForRowDetection.has(hole.entityName)) {
				entitiesForRowDetection.set(hole.entityName, []);
			}
			entitiesForRowDetection.get(hole.entityName).push(hole);
		});

		// Step 33) Perform row detection using global function if available
		if (window.improvedSmartRowDetection) {
			entitiesForRowDetection.forEach((holes, entityName) => {
				window.improvedSmartRowDetection(holes, entityName);
			});
		}

		// Step 34) Auto-assign rowID/posID for holes that still don't have them
		var unassignedHoles = parsedHoles.filter((hole) => hole.rowID === null || hole.rowID === 0 || hole.posID === null || hole.posID === 0);
		unassignedHoles.forEach((hole) => {
			if (window.getNextRowID && (!hole.rowID || hole.rowID === 0)) {
				hole.rowID = window.getNextRowID(hole.entityName);
			}
			if (window.getNextPosID && (!hole.posID || hole.posID === 0)) {
				hole.posID = window.getNextPosID(hole.entityName, hole.rowID);
			}
		});

		// Step 35) Log warnings if any
		if (warnings.length > 0) {
			console.warn("BlastHoleCSVParser warnings:\n" + warnings.join("\n"));
		}

		// Step 36) Return parsed data
		return {
			holes: parsedHoles,
			warnings: warnings,
			minX: minX,
			minY: minY
		};
	}
}

export default BlastHoleCSVParser;
