// src/fileIO/CBlastIO/CBLASTParser.js
//=============================================================
// CBLAST CSV PARSER
//=============================================================
// Step 1) Parse CBLAST CSV files for blast design data
// Step 2) CBLAST uses 4 records per hole: HOLE, PRODUCT, DETONATOR, STRATA
// Step 3) Reference: CBLASTExport.bas
// Step 4) Created: 2026-01-07

import BaseParser from "../BaseParser.js";

export default class CBLASTParser extends BaseParser {
	constructor(options = {}) {
		super(options);
		this.options = options;
	}

	// Step 5) Main parse entry point
	async parse(file) {
		// Step 6) Read file as text
		var content = await this.readAsText(file);

		// Step 7) Validate input
		if (!content || typeof content !== "string") {
			throw new Error("CBLAST Parser requires CSV content string");
		}

		// Step 8) Parse CSV data
		var result = this.parseCSVData(content);

		return result;
	}

	// Step 9) Parse CSV data string
	parseCSVData(data) {
		// Step 10) Split into lines
		var lines = data.split(/\r?\n/);
		var holes = [];
		var warnings = [];

		// Step 11) Process lines in groups of 4 (HOLE, PRODUCT, DETONATOR, STRATA)
		var i = 0;
		while (i < lines.length) {
			var line = lines[i].trim();

			// Step 12) Skip empty lines
			if (!line) {
				i++;
				continue;
			}

			// Step 13) Check if this is a HOLE record
			if (!line.toUpperCase().startsWith("HOLE")) {
				warnings.push("Line " + (i + 1) + ": Expected HOLE record, found: " + line.substring(0, 30));
				i++;
				continue;
			}

			// Step 14) Ensure we have 4 records for this hole
			if (i + 3 >= lines.length) {
				warnings.push("Line " + (i + 1) + ": Incomplete hole record (missing PRODUCT, DETONATOR, or STRATA)");
				break;
			}

			// Step 15) Parse all 4 records
			try {
				var holeRecord = this.parseCSVLine(lines[i]);
				var productRecord = this.parseCSVLine(lines[i + 1]);
				var detonatorRecord = this.parseCSVLine(lines[i + 2]);
				var strataRecord = this.parseCSVLine(lines[i + 3]);

				// Step 16) Validate record types
				if (holeRecord[0].toUpperCase() !== "HOLE") {
					throw new Error("Expected HOLE record");
				}
				if (productRecord[0].toUpperCase() !== "PRODUCT") {
					throw new Error("Expected PRODUCT record");
				}
				if (detonatorRecord[0].toUpperCase() !== "DETONATOR") {
					throw new Error("Expected DETONATOR record");
				}
				if (strataRecord[0].toUpperCase() !== "STRATA") {
					throw new Error("Expected STRATA record");
				}

				// Step 17) Extract hole data
				var hole = this.createHoleFromRecords(holeRecord, productRecord, detonatorRecord, strataRecord);

				// Step 17b) Consume any CHARGE and PRIMER records that follow
				var chargeRecords = [];
				var primerRecords = [];
				var nextIdx = i + 4;
				while (nextIdx < lines.length) {
					var nextLine = lines[nextIdx].trim();
					if (!nextLine) { nextIdx++; continue; }
					var nextUpper = nextLine.toUpperCase();
					if (nextUpper.startsWith("CHARGE")) {
						chargeRecords.push(this.parseCSVLine(lines[nextIdx]));
						nextIdx++;
					} else if (nextUpper.startsWith("PRIMER")) {
						primerRecords.push(this.parseCSVLine(lines[nextIdx]));
						nextIdx++;
					} else {
						break; // Next HOLE or unknown record
					}
				}

				// Step 17c) Attach charging data to hole if present
				if (chargeRecords.length > 0 || primerRecords.length > 0) {
					hole._chargeRecords = chargeRecords;
					hole._primerRecords = primerRecords;
				}

				holes.push(hole);

				// Step 18) Move past consumed records
				i = nextIdx;
			} catch (error) {
				warnings.push("Line " + (i + 1) + ": Error parsing hole - " + error.message);
				i += 4; // Skip this hole
			}
		}

		return {
			holes: holes,
			warnings: warnings
		};
	}

	// Step 19) Parse CSV line with proper handling of quoted fields
	parseCSVLine(line) {
		var fields = [];
		var currentField = "";
		var inQuotes = false;

		for (var i = 0; i < line.length; i++) {
			var char = line[i];

			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === "," && !inQuotes) {
				fields.push(currentField.trim());
				currentField = "";
			} else {
				currentField += char;
			}
		}

		// Step 20) Add last field
		fields.push(currentField.trim());

		return fields;
	}

	// Step 21) Create blast hole object from 4 CBLAST records
	createHoleFromRecords(holeRec, prodRec, detRec, strataRec) {
		// Step 22) Detect format variant - check if field [1] is blank or contains holeID
		// Format A (with blank): HOLE,,holeID,easting,northing,elevation,bearing,angle,depth,diameter,...
		// Format B (no blank):   HOLE,holeID,easting,northing,elevation,bearing,angle,depth,diameter,...
		var offset = 0;
		if (holeRec[1] === "" || holeRec[1] === null || holeRec[1] === undefined) {
			// Format A: blank field at [1], holeID at [2]
			offset = 1;
		} else if (!isNaN(parseFloat(holeRec[2])) && !isNaN(parseFloat(holeRec[3]))) {
			// Format B: holeID at [1], easting at [2] (both are numbers)
			offset = 0;
		} else {
			// Default to format A (with blank field) for safety
			offset = 1;
		}

		// Step 22a) Extract hole geometry from HOLE record
		var holeID = holeRec[1 + offset] || "";
		var easting = parseFloat(holeRec[2 + offset]) || 0;
		var northing = parseFloat(holeRec[3 + offset]) || 0;
		var elevation = parseFloat(holeRec[4 + offset]) || 0;
		var bearing = parseFloat(holeRec[5 + offset]) || 0;
		var angle = parseFloat(holeRec[6 + offset]) || 0; // 0 = vertical down, 90 = horizontal
		var depth = parseFloat(holeRec[7 + offset]) || 0;
		var diameter = parseFloat(holeRec[8 + offset]) || 0;

		// Step 23) Use angle directly (no conversion) - matches CBLASTWriter export
		var holeAngle = angle;

		// Step 24) Calculate end point based on bearing and angle
		var radBearing = bearing * Math.PI / 180;
		var radAngle = holeAngle * Math.PI / 180;

		// Step 25) Calculate horizontal distance
		var horizDist = depth * Math.sin(radAngle);
		var vertDist = depth * Math.cos(radAngle);

		// Step 26) Calculate end coordinates (Kirra uses Y=North, X=East)
		var endEasting = easting + horizDist * Math.sin(radBearing);
		var endNorthing = northing + horizDist * Math.cos(radBearing);
		var endElevation = elevation - vertDist; // Down is negative

		// Step 27) Extract product information from PRODUCT record
		// Format A (with blank): PRODUCT,,holeID,deckCount,product1,length1,...
		// Format B (no blank):   PRODUCT,holeID,deckCount,product1,length1,...
		var prodOffset = (prodRec[1] === "" || prodRec[1] === null || prodRec[1] === undefined) ? 1 : 0;
		var deckCount = parseInt(prodRec[2 + prodOffset]) || 0;
		var products = [];
		var chargeLength = 0;

		for (var i = 0; i < deckCount; i++) {
			var productName = prodRec[3 + prodOffset + i * 2] || "";
			var productLength = parseFloat(prodRec[4 + prodOffset + i * 2]) || 0;

			products.push({
				name: productName,
				length: productLength
			});

			// Step 28) Calculate total charge length (exclude stemming types)
			if (productName.toUpperCase() !== "AIR" && 
				!productName.toUpperCase().includes("STEMMING") &&
				!productName.toUpperCase().includes("CRUSHED") &&
				!productName.toUpperCase().includes("AGGREGATE")) {
				chargeLength += productLength;
			}
		}

		// Step 29) Extract detonator information from DETONATOR record
		// Format A (with blank): DETONATOR,,holeID,detCount,detType,depth,timeDelay,...
		// Format B (no blank):   DETONATOR,holeID,detCount,detType,depth,timeDelay,...
		var detOffset = (detRec[1] === "" || detRec[1] === null || detRec[1] === undefined) ? 1 : 0;
		var detCount = parseInt(detRec[2 + detOffset]) || 0;
		var detonatorType = detCount > 0 ? detRec[3 + detOffset] || "" : "";
		// Extract detonator depth if there is at least one detonator, otherwise set to hole length (depth)
		var detonatorDepth = detCount > 0 ? parseFloat(detRec[4 + detOffset]) || depth : depth;
		var timeDelay = detCount > 0 ? parseFloat(detRec[5 + detOffset]) || 0 : 0;

		// Step 30) Calculate stemming height
		var stemmingHeight = depth - chargeLength;
		if (stemmingHeight < 0) stemmingHeight = 0;

		// Step 31) Determine hole type based on products
		var holeType = "Production";
		if (deckCount === 0 || products.length === 0) {
			holeType = "No Charge";
		} else {
			var hasExplosive = products.some(function(p) {
				return p.name.toUpperCase() !== "AIR" && 
					!p.name.toUpperCase().includes("STEMMING") && 
					!p.name.toUpperCase().includes("CRUSHED") &&
					!p.name.toUpperCase().includes("AGGREGATE") &&
					!p.name.toUpperCase().includes("GAS BAG") &&
					p.name.toUpperCase() !== "DO NOT CHARGE";
			});
			if (!hasExplosive) {
				holeType = "No Charge";
			}
		}

		// Step 32) Calculate grade along hole vector (CBLAST doesn't separate grade/toe, assume no subdrill)
		// CRITICAL: Grade must lie on hole vector, not just vertical drop
		// For CBLAST: depth = hole length, subdrill = 0, so grade = toe
		// Toe is at collar + depth along hole vector

		// Calculate toe first (end of hole) - using radBearing (fix variable name bug)
		var toeX = easting + horizDist * Math.sin(radBearing);
		var toeY = northing + horizDist * Math.cos(radBearing);
		var toeZ = elevation - vertDist;

		// Grade is at toe (CBLAST has no subdrill, grade = toe)
		var gradeX = toeX;
		var gradeY = toeY;
		var gradeZ = toeZ;

		// Step 33) RULE #9: Return MINIMAL hole data - addHole() will create proper geometry
		var hole = {
			entityType: "hole", // CRITICAL: All imported holes are type "hole"
			holeID: holeID,
			startXLocation: easting,
			startYLocation: northing,
			startZLocation: elevation,
			gradeXLocation: gradeX, // Grade lies on hole vector
			gradeYLocation: gradeY,
			gradeZLocation: gradeZ,
			holeDiameter: diameter * 1000, // Convert to mm
			holeType: holeType,
			holeLengthCalculated: depth,
			subdrillAmount: 0, // CBLAST doesn't provide subdrill
			holeAngle: holeAngle, // Import directly (no conversion)
			holeBearing: bearing, // From North
			burden: 1, // Default - will be recalculated
			spacing: 1, // Default - will be recalculated
			// CBLAST-specific data (not used by addHole, but stored for export)
			stemHeight: stemmingHeight,
			chargeLength: chargeLength,
			products: products,
			detonatorType: detonatorType,
			detonatorDepth: detonatorDepth,
			timeDelay: timeDelay
		};

		return hole;
	}
}
