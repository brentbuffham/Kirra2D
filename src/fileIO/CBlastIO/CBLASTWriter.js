// src/fileIO/CBlastIO/CBLASTWriter.js
//=============================================================
// CBLAST CSV WRITER
//=============================================================
// Step 1) Export blast holes to CBLAST CSV format
// Step 2) CBLAST uses 4 records per hole: HOLE, PRODUCT, DETONATOR, STRATA
// Step 3) Reference: CBLASTExport.bas
// Step 4) Created: 2026-01-07

import BaseWriter from "../BaseWriter.js";
import { chargingKey } from "../../charging/HoleCharging.js";

export default class CBLASTWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);
		this.options = options;
	}

	// Step 5) Main write entry point
	async write(data) {
		// Step 6) Validate input
		if (!data || (!data.holes && !Array.isArray(data))) {
			throw new Error("CBLAST Writer requires holes array");
		}

		// Step 7) Extract holes from data
		var holes = Array.isArray(data) ? data : data.holes || [];

		// Step 8) Filter visible holes only
		var visibleHoles = holes.filter(function (hole) {
			return hole.visible !== false;
		});

		if (visibleHoles.length === 0) {
			throw new Error("No visible holes to export");
		}

		// Step 9) Generate CBLAST CSV content
		var csvContent = this.generateCSV(visibleHoles);

		// Step 10) Determine filename
		var filename = this.options.filename || "CBLAST_Export.csv";
		if (!filename.toLowerCase().endsWith(".csv")) {
			filename += ".csv";
		}

		// Step 11) Create Blob and download file
		var blob = this.createBlob(csvContent, "text/csv");
		this.downloadFile(blob, filename);

		return {
			success: true,
			filename: filename,
			holesExported: visibleHoles.length
		};
	}

	// Step 12) Generate CBLAST CSV content
	generateCSV(holes) {
		var lines = [];

		// Step 13) Process each hole
		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];

			// Step 14) Generate HOLE record
			var holeRecord = this.generateHoleRecord(hole);
			lines.push(holeRecord);

			// Step 15) Generate PRODUCT record
			var productRecord = this.generateProductRecord(hole);
			lines.push(productRecord);

			// Step 16) Generate DETONATOR record
			var detonatorRecord = this.generateDetonatorRecord(hole);
			lines.push(detonatorRecord);

			// Step 17) Generate STRATA record
			var strataRecord = this.generateStrataRecord(hole);
			lines.push(strataRecord);

			// Step 17b) Generate CHARGE records from loadedCharging (if available)
			var chargeRecords = this.generateChargeRecords(hole);
			for (var cr = 0; cr < chargeRecords.length; cr++) {
				lines.push(chargeRecords[cr]);
			}
		}

		// Step 18) Join all lines with newline
		return lines.join("\n");
	}

	// Step 19) Generate HOLE record
	// Format: HOLE,,holeID,easting,northing,elevation,bearing,angle,depth,diameter,,,
	generateHoleRecord(hole) {
		var holeID = hole.holeID || "";
		var easting = (hole.startXLocation || 0).toFixed(3);
		var northing = (hole.startYLocation || 0).toFixed(3);
		var elevation = (hole.startZLocation || 0).toFixed(3);
		var bearing = (hole.holeBearing || 0).toFixed(3);

		// Step 20) Export holeAngle directly (no conversion)
		var angle = (hole.holeAngle || 0).toFixed(3);
		var depth = (hole.holeLength || hole.holeLengthCalculated || 0).toFixed(3);
		var diameter = ((hole.holeDiameter || 0) / 1000).toFixed(3); // Convert mm to meters

		// Step 21) Build HOLE record (fixed format with blank fields)
		var fields = ["HOLE", "", holeID, easting, northing, elevation, bearing, angle, depth, diameter, "", "", ""];

		return fields.join(",");
	}

	// Step 22) Generate PRODUCT record
	// Format: PRODUCT,,holeID,deckCount,product1,length1,product2,length2,...
	generateProductRecord(hole) {
		var holeID = hole.holeID || "";

		// Step 23) Check if hole has custom products array (from CBLAST import or user-defined)
		if (hole.products && Array.isArray(hole.products) && hole.products.length > 0) {
			// Step 24) Use existing products array
			var deckCount = hole.products.length;
			var fields = ["PRODUCT", "", holeID, deckCount.toString()];

			for (var i = 0; i < hole.products.length; i++) {
				var product = hole.products[i];
				var productName = product.name || "Unknown";
				var productLength = (product.length || 0).toFixed(3);

				// Step 25) Escape commas in product names
				if (productName.indexOf(",") > -1) {
					productName = '"' + productName + '"';
				}

				fields.push(productName, productLength);
			}

			// Step 26) Pad with empty fields to maintain format
			while (fields.length < 12) {
				fields.push("");
			}

			return fields.join(",");
		}

		// Step 27) Generate default 2-deck configuration (stemming + explosive)
		var holeType = hole.holeType || "Production";
		var stemHeight = hole.stemHeight || 0;
		var chargeLength = hole.chargeLength || 0;

		// Step 28) Check if hole should be charged
		if (holeType.toUpperCase() === "NO CHARGE" || holeType.toUpperCase() === "DO NOT CHARGE" || chargeLength === 0) {
			// Step 29) No charge - single deck with stemming/air
			var totalDepth = (hole.holeLength || 0).toFixed(3);
			return "PRODUCT,," + holeID + ",1,Do Not Charge," + totalDepth + ",,,,,,,";
		}

		// Step 30) Normal blast hole - 2 decks (stemming + explosive)
		var stemmingType = "Stemming";
		var stemmingLength = stemHeight.toFixed(3);
		var explosiveType = hole.productType || "ANFO";
		var explosiveLength = chargeLength.toFixed(3);

		// Step 31) Escape commas in product names
		if (explosiveType.indexOf(",") > -1) {
			explosiveType = '"' + explosiveType + '"';
		}

		return "PRODUCT,," + holeID + ",2," + stemmingType + "," + stemmingLength + "," + explosiveType + "," + explosiveLength + ",,,,,";
	}

	// Step 32) Generate DETONATOR record
	// Format: DETONATOR,,holeID,detCount,detType,depth,timeDelay,...
	generateDetonatorRecord(hole) {
		var holeID = hole.holeID || "";
		var holeType = hole.holeType || "Production";

		// Step 33) Check if hole has detonator
		if (holeType.toUpperCase() === "NO CHARGE" || holeType.toUpperCase() === "DO NOT CHARGE") {
			// Step 34) No detonator for non-charged holes
			return "DETONATOR,," + holeID + ",0,,,,,,,,,,";
		}

		// Step 35) Get detonator information
		var detonatorType = hole.detonatorType || hole.initiationSystem || "Non-Electric";
		var detonatorDepth = hole.holeLengthCalculated || hole.holeLength || 0; // Use full hole length (no reduction)
		var timeDelay = hole.timeDelay || hole.nominalDelay || 0;

		// Step 36) Format values
		var detDepth = detonatorDepth.toFixed(3);
		var delay = timeDelay.toFixed(3);

		// Step 37) Escape commas in detonator type
		if (detonatorType.indexOf(",") > -1) {
			detonatorType = '"' + detonatorType + '"';
		}

		return "DETONATOR,," + holeID + ",1," + detonatorType + "," + detDepth + "," + delay + ",,,,,,";
	}

	// Step 38) Generate STRATA record
	// Format: STRATA,,holeID,0,,,,,,,,,,
	generateStrataRecord(hole) {
		var holeID = hole.holeID || "";

		// Step 39) CBLAST STRATA record is typically minimal (geological data not used in Kirra)
		return "STRATA,," + holeID + ",0,,,,,,,,,,";
	}

	// Step 40) Generate CHARGE and PRIMER records from loadedCharging
	// Format: CHARGE,,holeID,deckType,topDepth,baseDepth,productName,density,mass
	// Format: PRIMER,,holeID,lengthFromCollar,detonatorName,delayMs,boosterName,boosterMassG
	generateChargeRecords(hole) {
		var records = [];
		if (!window.loadedCharging) return records;

		var charging = window.loadedCharging.get(chargingKey(hole));
		if (!charging) return records;

		var holeID = hole.holeID || "";
		var diamMm = charging.holeDiameterMm || hole.holeDiameter || 115;

		// Write CHARGE records (one per deck)
		if (charging.decks) {
			for (var d = 0; d < charging.decks.length; d++) {
				var deck = charging.decks[d];
				var deckType = deck.deckType || "INERT";
				var topDepth = (deck.topDepth || 0).toFixed(3);
				var baseDepth = (deck.baseDepth || 0).toFixed(3);
				var productName = (deck.product && deck.product.name) ? deck.product.name : "";
				var density = (deck.product && deck.product.density) ? deck.product.density.toFixed(4) : "0";
				var mass = (typeof deck.calculateMass === "function") ? deck.calculateMass(diamMm).toFixed(3) : "0";

				// Escape commas in product name
				if (productName.indexOf(",") > -1) {
					productName = '"' + productName + '"';
				}

				records.push("CHARGE,," + holeID + "," + deckType + "," + topDepth + "," + baseDepth + "," + productName + "," + density + "," + mass);
			}
		}

		// Write PRIMER records (one per primer)
		if (charging.primers) {
			for (var p = 0; p < charging.primers.length; p++) {
				var primer = charging.primers[p];
				var primerDepth = (primer.lengthFromCollar || 0).toFixed(3);
				var detName = (primer.detonator && primer.detonator.productName) ? primer.detonator.productName : "";
				var delayMs = (primer.detonator && primer.detonator.delayMs) ? primer.detonator.delayMs.toFixed(1) : "0";
				var boosterName = (primer.booster && primer.booster.productName) ? primer.booster.productName : "";
				var boosterMass = (primer.booster && primer.booster.massGrams) ? primer.booster.massGrams.toFixed(1) : "0";

				records.push("PRIMER,," + holeID + "," + primerDepth + "," + detName + "," + delayMs + "," + boosterName + "," + boosterMass);
			}
		}

		return records;
	}
}
