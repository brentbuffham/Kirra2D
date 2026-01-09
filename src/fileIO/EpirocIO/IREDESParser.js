// src/fileIO/EpirocIO/IREDESParser.js
//=============================================================
// IREDES (EPIROC) XML PARSER
//=============================================================
// Step 1) Parse Epiroc IREDES XML drill plan files
// Step 2) Extracts blast holes from XML and creates hole objects
// Step 3) Validates CRC32 checksum if present
// Step 4) Created: 2026-01-07

import BaseParser from "../BaseParser.js";

export default class IREDESParser extends BaseParser {
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
			throw new Error("IREDESParser requires XML content string");
		}

		// Step 8) Get filename
		var filename = file.name || "unknown.xml";

		// Step 9) Parse XML using DOMParser
		var parser = new DOMParser();
		var xmlDoc = parser.parseFromString(content, "text/xml");

		// Step 10) Check for parsing errors
		var parseError = xmlDoc.querySelector("parsererror");
		if (parseError) {
			throw new Error("XML parsing error: " + parseError.textContent);
		}

		// Step 11) Validate checksum if present
		var checksumValid = this.validateChecksum(content);
		if (checksumValid === false) {
			console.warn("IREDES checksum validation failed - file may be corrupted");
		}

		// Step 12) Extract metadata
		var metadata = this.extractMetadata(xmlDoc);

		// Step 13) Extract holes
		var holes = this.extractHoles(xmlDoc, filename);

		// Step 14) Return parsed data
		return {
			holes: holes,
			metadata: metadata,
			checksumValid: checksumValid
		};
	}

	// Step 13) Extract metadata from IREDES XML
	extractMetadata(xmlDoc) {
		// Step 14) Helper function to get text content safely
		var getTextContent = function (element, tagName, defaultValue) {
			if (!element) return defaultValue || "";
			var node = element.querySelector(tagName);
			return node ? node.textContent.trim() : defaultValue || "";
		};

		// Step 15) Get root element
		var root = xmlDoc.querySelector("DRPPlan");
		if (!root) {
			console.warn("IREDESParser: No DRPPlan root element found");
			return {};
		}

		// Step 16) Extract metadata fields
		var metadata = {
			planId: getTextContent(root, "IR\\:PlanId", "Unknown"),
			planName: getTextContent(root, "IR\\:PlanName", "Unknown"),
			comment: getTextContent(root, "IR\\:Comment", ""),
			project: getTextContent(root, "IR\\:Project", ""),
			workOrder: getTextContent(root, "IR\\:WorkOrder", ""),
			fileCreateDate: getTextContent(root, "IR\\:FileCreateDate", ""),
			fileCloseDate: getTextContent(xmlDoc, "IR\\:FileCloseDate", "")
		};

		// Step 17) Get number of holes
		var numberOfHolesNode = xmlDoc.querySelector("NumberOfHoles");
		if (numberOfHolesNode) {
			metadata.numberOfHoles = parseInt(numberOfHolesNode.textContent.trim());
		}

		return metadata;
	}

	// Step 18) Extract holes from IREDES XML
	extractHoles(xmlDoc, filename) {
		// Step 19) Get all Hole elements
		var holeElements = xmlDoc.querySelectorAll("Hole");
		if (!holeElements || holeElements.length === 0) {
			console.warn("IREDESParser: No holes found in XML");
			return [];
		}

		var holes = [];
		var entityName = filename || "IREDES_Import";

		// Step 20) Remove file extension from entity name
		if (entityName.indexOf(".") !== -1) {
			entityName = entityName.substring(0, entityName.lastIndexOf("."));
		}

		// Step 21) Parse each hole
		for (var i = 0; i < holeElements.length; i++) {
			var holeElement = holeElements[i];

			// Step 22) Extract hole ID
			var holeIdNode = holeElement.querySelector("HoleId");
			var holeId = holeIdNode ? holeIdNode.textContent.trim() : "H" + (i + 1);

			// Step 23) Extract start point - CRITICAL: IREDES uses Y,X order (Northing, Easting)
			var startPoint = holeElement.querySelector("StartPoint");
			var startX = 0;
			var startY = 0;
			var startZ = 0;

			if (startPoint) {
				// Step 1) IREDES namespace
				var irNamespace = "http://www.iredes.org/xml";

				// Step 2) Try multiple methods to find the elements (namespace handling varies by browser)
				var pointXNode = startPoint.getElementsByTagNameNS(irNamespace, "PointX")[0] ||
								 startPoint.getElementsByTagName("IR:PointX")[0] ||
								 startPoint.getElementsByTagName("PointX")[0];

				var pointYNode = startPoint.getElementsByTagNameNS(irNamespace, "PointY")[0] ||
								 startPoint.getElementsByTagName("IR:PointY")[0] ||
								 startPoint.getElementsByTagName("PointY")[0];

				var pointZNode = startPoint.getElementsByTagNameNS(irNamespace, "PointZ")[0] ||
								 startPoint.getElementsByTagName("IR:PointZ")[0] ||
								 startPoint.getElementsByTagName("PointZ")[0];

				// Step 3) IREDES: PointX = Northing (Y), PointY = Easting (X)
				if (pointXNode) {
					startY = parseFloat(pointXNode.textContent);
					if (isNaN(startY)) startY = 0;
				}
				if (pointYNode) {
					startX = parseFloat(pointYNode.textContent);
					if (isNaN(startX)) startX = 0;
				}
				if (pointZNode) {
					startZ = parseFloat(pointZNode.textContent);
					if (isNaN(startZ)) startZ = 0;
				}
			}

			// Step 24) Extract end point - CRITICAL: IREDES uses Y,X order
			var endPoint = holeElement.querySelector("EndPoint");
			var endX = 0;
			var endY = 0;
			var endZ = 0;

			if (endPoint) {
				// Step 1) IREDES namespace
				var irNamespace = "http://www.iredes.org/xml";

				// Step 2) Try multiple methods to find the elements (namespace handling varies by browser)
				var pointXNode = endPoint.getElementsByTagNameNS(irNamespace, "PointX")[0] ||
								 endPoint.getElementsByTagName("IR:PointX")[0] ||
								 endPoint.getElementsByTagName("PointX")[0];

				var pointYNode = endPoint.getElementsByTagNameNS(irNamespace, "PointY")[0] ||
								 endPoint.getElementsByTagName("IR:PointY")[0] ||
								 endPoint.getElementsByTagName("PointY")[0];

				var pointZNode = endPoint.getElementsByTagNameNS(irNamespace, "PointZ")[0] ||
								 endPoint.getElementsByTagName("IR:PointZ")[0] ||
								 endPoint.getElementsByTagName("PointZ")[0];

				// Step 3) IREDES: PointX = Northing (Y), PointY = Easting (X)
				if (pointXNode) {
					endY = parseFloat(pointXNode.textContent);
					if (isNaN(endY)) endY = 0;
				}
				if (pointYNode) {
					endX = parseFloat(pointYNode.textContent);
					if (isNaN(endX)) endX = 0;
				}
				if (pointZNode) {
					endZ = parseFloat(pointZNode.textContent);
					if (isNaN(endZ)) endZ = 0;
				}
			}

			// Step 25) Extract hole type
			var holeTypeNode = holeElement.querySelector("TypeOfHole");
			var holeType = holeTypeNode ? holeTypeNode.textContent.trim() : "Production";

			// Step 26) Convert "Undefined" back to "Production"
			if (holeType === "Undefined" || holeType === "") {
				holeType = "Production";
			}

			// Step 27) Extract drill bit diameter (keep as 0 if 0 in XML - no defaults)
			var drillBitDiaNode = holeElement.querySelector("DrillBitDia");
			var holeDiameter = drillBitDiaNode ? parseFloat(drillBitDiaNode.textContent) : 0;

			// Step 28) Extract MWD flag
			var mwdOnNode = holeElement.querySelector("MwdOn");
			var mwdOn = mwdOnNode ? mwdOnNode.textContent.trim() === "1" : false;

			// Step 29) Extract extended hole status (Drilled/Undrilled)
			var statusNode = holeElement.querySelector("ExtendedHoleStatus");
			var isDrilled = statusNode ? statusNode.textContent.trim() === "Drilled" : false;

			// Step 30) Calculate hole geometry
			var dx = endX - startX;
			var dy = endY - startY;
			var dz = endZ - startZ;
			var holeLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
			var horizontalLength = Math.sqrt(dx * dx + dy * dy);

			// Step 30a) Validate calculations
			if (isNaN(holeLength)) {
				console.warn("IREDESParser: NaN holeLength for hole " + holeId + " - dx=" + dx + ", dy=" + dy + ", dz=" + dz);
				holeLength = 0;
			}
			if (isNaN(horizontalLength)) {
				horizontalLength = 0;
			}

			// Step 31) Calculate bearing (0-360, North = 0, clockwise)
			var bearing = 0;
			if (horizontalLength > 0.001) {
				bearing = Math.atan2(dx, dy) * (180 / Math.PI);
				if (bearing < 0) {
					bearing += 360;
				}
				if (isNaN(bearing)) bearing = 0;
			}

			// Step 32) Calculate angle from vertical (0 = vertical, 90 = horizontal)
			var angle = 90;
			if (holeLength > 0.001) {
				angle = Math.acos(Math.abs(dz) / holeLength) * (180 / Math.PI);
				if (isNaN(angle)) angle = 90;
			}

			// Step 33) Extract extended hole status for comment field
			var statusNode = holeElement.querySelector("ExtendedHoleStatus");
			var comment = statusNode ? statusNode.textContent.trim() : "";

			// Step 34) Validate coordinates - skip holes with invalid data
			if (startX === 0 && startY === 0 && endX === 0 && endY === 0) {
				console.warn("IREDESParser: Skipping hole " + holeId + " - invalid coordinates (all zeros)");
				continue;
			}

			if (isNaN(startX) || isNaN(startY) || isNaN(startZ) || isNaN(endX) || isNaN(endY) || isNaN(endZ)) {
				console.warn("IREDESParser: Skipping hole " + holeId + " - NaN coordinates detected");
				continue;
			}

			if (isNaN(holeLength) || holeLength === 0) {
				console.warn("IREDESParser: Skipping hole " + holeId + " - invalid hole length: " + holeLength);
				continue;
			}

			// Step 35) Create hole object EXACTLY matching BlastHole class defaults
			// CRITICAL: Must match BlastHole constructor defaults for compatibility
			// RULE #9: Return MINIMAL hole data - addHole() will create proper geometry
			// CRITICAL: Grade must lie on hole vector - IREDES has no subdrill so grade = toe
			var hole = {
				entityType: "hole", // CRITICAL: All imported holes are type "hole"
				holeID: holeId,
				startXLocation: parseFloat(startX.toFixed(3)),
				startYLocation: parseFloat(startY.toFixed(3)),
				startZLocation: parseFloat(startZ.toFixed(3)),
				gradeXLocation: parseFloat(endX.toFixed(3)), // Grade = toe (no subdrill)
				gradeYLocation: parseFloat(endY.toFixed(3)),
				gradeZLocation: parseFloat(endZ.toFixed(3)),
				holeDiameter: holeDiameter,
				holeType: holeType,
				holeLengthCalculated: parseFloat(holeLength.toFixed(3)),
				subdrillAmount: 0, // IREDES doesn't have subdrill
				holeAngle: parseFloat(angle.toFixed(1)),
				holeBearing: parseFloat(bearing.toFixed(1)),
				measuredComment: comment || "None",
				burden: 1, // Default - recalculated by HDBSCAN
				spacing: 1 // Default - recalculated by HDBSCAN
			};

			holes.push(hole);
		}

		// Step 36) Report parsing results
		var totalHoles = holeElements.length;
		var validHoles = holes.length;
		var skippedHoles = totalHoles - validHoles;

		console.log("IREDESParser: Extracted " + validHoles + " valid holes from " + filename);
		if (skippedHoles > 0) {
			console.warn("IREDESParser: Skipped " + skippedHoles + " holes due to invalid data (check warnings above)");
		}

		return holes;
	}

	// Step 34) Validate CRC32 checksum
	validateChecksum(xmlContent) {
		// Step 35) Extract checksum from XML
		var checksumMatch = xmlContent.match(/<IR:ChkSum>([^<]+)<\/IR:ChkSum>/);
		if (!checksumMatch) {
			console.warn("IREDESParser: No checksum found in XML");
			return null; // No checksum to validate
		}

		var originalChecksum = checksumMatch[1].trim();

		// Step 36) Skip validation if checksum is empty or "NONE"
		if (originalChecksum === "" || originalChecksum === " " || originalChecksum === "NONE") {
			return null;
		}

		// Step 37) Replace checksum with "0" for validation
		var xmlForValidation = xmlContent.replace(/<IR:ChkSum>[^<]+<\/IR:ChkSum>/, "<IR:ChkSum>0</IR:ChkSum>");

		// Step 38) Calculate CRC32
		var calculatedChecksum = this.calculateCRC32(xmlForValidation);

		// Step 39) Compare checksums (handle both decimal and hex formats)
		var calculatedStr = calculatedChecksum.toString();
		var calculatedHex = calculatedChecksum.toString(16).toUpperCase();

		if (originalChecksum === calculatedStr) {
			return true; // Decimal match
		} else if (originalChecksum.toUpperCase() === calculatedHex) {
			return true; // Hex match
		} else {
			console.warn("IREDESParser: Checksum mismatch - Expected: " + originalChecksum + ", Calculated: " + calculatedStr + " (Hex: " + calculatedHex + ")");
			return false;
		}
	}

	// Step 40) Calculate CRC32 checksum (same algorithm as writer)
	calculateCRC32(str) {
		// Step 41) Build CRC32 lookup table
		var table = new Uint32Array(256);
		for (var i = 256; i--; ) {
			var tmp = i;
			for (var k = 8; k--; ) {
				tmp = tmp & 1 ? 3988292384 ^ (tmp >>> 1) : tmp >>> 1;
			}
			table[i] = tmp;
		}

		// Step 42) Calculate CRC32
		var crc = 0xffffffff;
		for (var i = 0, l = str.length; i < l; i++) {
			crc = (crc >>> 8) ^ table[(crc ^ str.charCodeAt(i)) & 255];
		}

		crc = crc >>> 0; // Ensure unsigned

		return crc;
	}
}

