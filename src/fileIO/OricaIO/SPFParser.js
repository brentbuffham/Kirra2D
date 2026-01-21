// src/fileIO/OricaIO/SPFParser.js
//=============================================================
// SPF FILE PARSER (Orica ShotPlus)
//=============================================================
// Step 1) Parses Orica ShotPlus .spf files (blast design files)
// Step 2) SPF files are ZIP archives containing XML files
// Step 3) Main data in BlisData.Xml with Orica BLIS namespace
// Step 4) Created: 2026-01-21

import BaseParser from "../BaseParser.js";
import JSZip from "jszip";

// Step 5) SPFParser class
class SPFParser extends BaseParser {
	constructor(options = {}) {
		super(options);

		// Step 6) Parser options
		this.offsetX = options.offsetX || this.centroidX || 0;
		this.offsetY = options.offsetY || this.centroidY || 0;
		this.showProgress = options.showProgress !== false;
	}

	// Step 7) Main parse method
	async parse(file) {
		// Step 8) Read file as ArrayBuffer
		var arrayBuffer = await this.readAsArrayBuffer(file);

		// Step 10) Extract ZIP contents
		var zip = await JSZip.loadAsync(arrayBuffer);

		// Step 11) Parse the XML files
		var result = {
			holes: [],
			header: null,
			blastHeader: null,
			resources: [],
			filename: file.name
		};

		// Step 12) Parse Header.Xml
		if (zip.files["Header.Xml"]) {
			var headerXml = await zip.files["Header.Xml"].async("string");
			result.header = this.parseHeaderXml(headerXml);
		}

		// Step 13) Parse BlastHeader.Xml
		if (zip.files["BlastHeader.Xml"]) {
			var blastHeaderXml = await zip.files["BlastHeader.Xml"].async("string");
			result.blastHeader = this.parseBlastHeaderXml(blastHeaderXml);
		}

		// Step 14) Parse BlisData.Xml (main hole data)
		if (zip.files["BlisData.Xml"]) {
			var blisDataXml = await zip.files["BlisData.Xml"].async("string");
			var blisData = this.parseBlisDataXml(blisDataXml);
			result.holes = blisData.holes;
			result.blastDescription = blisData.blastDescription;
		}

		// Step 15) Convert to Kirra blast holes array
		result.kirraHoles = this.convertToKirraHoles(result.holes, result.blastHeader);

		console.log("SPF Parse complete: " + result.holes.length + " holes found");

		return result;
	}

	// Step 16) Parse Header.Xml
	parseHeaderXml(xmlString) {
		var parser = new DOMParser();
		var doc = parser.parseFromString(xmlString, "text/xml");

		var fileHeader = doc.querySelector("FileHeader");
		if (!fileHeader) return null;

		return {
			fileVersion: this.getElementText(fileHeader, "FileVersion"),
			title: this.getElementText(fileHeader, "Title"),
			author: this.getElementText(fileHeader, "Author"),
			description: this.getElementText(fileHeader, "Description"),
			application: this.getElementText(fileHeader, "Application"),
			revision: this.getElementText(fileHeader, "Revision")
		};
	}

	// Step 17) Parse BlastHeader.Xml
	parseBlastHeaderXml(xmlString) {
		var parser = new DOMParser();
		var doc = parser.parseFromString(xmlString, "text/xml");

		var blastHeader = doc.querySelector("BlastHeader");
		if (!blastHeader) return null;

		return {
			blastGuid: this.getElementText(blastHeader, "BlastGuid"),
			mine: this.getElementText(blastHeader, "Mine"),
			location: this.getElementText(blastHeader, "Location"),
			comment: this.getElementText(blastHeader, "Comment"),
			shotFirer: this.getElementText(blastHeader, "ShotFirer"),
			firingTime: this.getElementText(blastHeader, "FiringTime"),
			blastType: this.getElementText(blastHeader, "BlastType"),
			rockType: this.getElementText(blastHeader, "RockType"),
			orderNo: this.getElementText(blastHeader, "OrderNo"),
			maxDrillLength: this.getElementFloat(blastHeader, "MaxDrillLength"),
			surveyor: this.getElementText(blastHeader, "Surveyer"),
			boretracker: this.getElementText(blastHeader, "Boretracker"),
			engineer: this.getElementText(blastHeader, "Engineer"),
			customer: this.getElementText(blastHeader, "Customer"),
			blastId: this.getElementText(blastHeader, "BlastId")
		};
	}

	// Step 18) Parse BlisData.Xml (main hole data)
	parseBlisDataXml(xmlString) {
		var parser = new DOMParser();
		var doc = parser.parseFromString(xmlString, "text/xml");

		// Step 19) Namespace handling for BLIS schema
		var ns = "http://www.orica.com/namespaces/blis";

		var result = {
			holes: [],
			blastDescription: null
		};

		// Step 20) Parse BlastDescription
		var blastDesc = doc.getElementsByTagNameNS(ns, "BlastDescription")[0];
		if (blastDesc) {
			result.blastDescription = {
				volumeDesign: this.getElementFloatNS(blastDesc, ns, "VolumeDesign"),
				powderFactorDesign: this.getElementFloatNS(blastDesc, ns, "PowderFactorDesign"),
				energyFactorDesign: this.getElementFloatNS(blastDesc, ns, "EnergyFactorDesign"),
				isEBS: this.getElementTextNS(blastDesc, ns, "IsEBS") === "true",
				numRedrills: this.getElementIntNS(blastDesc, ns, "NumRedrills"),
				numBackfills: this.getElementIntNS(blastDesc, ns, "NumBackfills")
			};
		}

		// Step 21) Parse all Hole elements
		var holeElements = doc.getElementsByTagNameNS(ns, "Hole");

		for (var i = 0; i < holeElements.length; i++) {
			var holeElem = holeElements[i];
			var hole = this.parseHoleElement(holeElem, ns, i === 0);
			if (hole) {
				result.holes.push(hole);
			}
		}

		return result;
	}

	// Step 22) Parse individual Hole element
	parseHoleElement(holeElem, ns, isFirstHole) {
		// Debug: Dump XML for first hole to see coordinate structure
		if (isFirstHole) {
			console.log("SPF First hole XML:", holeElem.outerHTML ? holeElem.outerHTML.substring(0, 2000) : "No outerHTML");
		}

		var hole = {
			index: this.getElementIntNS(holeElem, ns, "Index"),
			guid: this.getElementTextNS(holeElem, ns, "Guid"),
			holeId: this.getElementTextNS(holeElem, ns, "HoleId"),
			domain: this.getElementIntNS(holeElem, ns, "Domain"),
			diameter: this.getElementFloatNS(holeElem, ns, "Diameter"),
			designLength: this.getElementFloatNS(holeElem, ns, "DesignLength"),
			designAngle: this.getElementFloatNS(holeElem, ns, "DesignAngle"),
			designBearing: this.getElementFloatNS(holeElem, ns, "DesignBearing"),
			actualAngle: this.getElementFloatNS(holeElem, ns, "ActualAngle"),
			actualBearing: this.getElementFloatNS(holeElem, ns, "ActualBearing"),
			benchHeight: this.getElementFloatNS(holeElem, ns, "BenchHeight"),
			subdrill: this.getElementFloatNS(holeElem, ns, "Subdrill"),
			gradeRL: this.getElementFloatNS(holeElem, ns, "GradeRL"),
			stemming: this.getElementFloatNS(holeElem, ns, "Stemming"),
			backfill: this.getElementFloatNS(holeElem, ns, "Backfill"),
			firingTime: this.getElementFloatNS(holeElem, ns, "FiringTime"),
			sequence: this.getElementIntNS(holeElem, ns, "Sequence"),
			comment: this.getElementTextNS(holeElem, ns, "Comment"),
			waterState: this.getElementTextNS(holeElem, ns, "WaterState"),
			powderFactor: this.getElementFloatNS(holeElem, ns, "PowderFactor"),
			isDummy: this.getElementTextNS(holeElem, ns, "IsDummy") === "true",
			isLoaded: this.getElementTextNS(holeElem, ns, "IsLoaded") === "true",
			isBoreTracked: this.getElementTextNS(holeElem, ns, "IsBoreTraked") === "true",
			hasLoading: this.getElementTextNS(holeElem, ns, "HasLoading") === "true",
			hasActual: this.getElementTextNS(holeElem, ns, "HasActual") === "true",
			ruleName: this.getElementTextNS(holeElem, ns, "RuleName"),
			loadingLength: this.getElementFloatNS(holeElem, ns, "LoadingLength")
		};

		// Step 23) Parse DesignCoordinates
		var designCoords = holeElem.getElementsByTagNameNS(ns, "DesignCoordinates")[0];
		if (!designCoords) {
			// Try without namespace
			designCoords = holeElem.getElementsByTagName("DesignCoordinates")[0];
		}
		if (designCoords) {
			// Try with namespace first, then without namespace
			hole.designX = this.getElementFloatNS(designCoords, ns, "X") || this.getElementFloat(designCoords, "X");
			hole.designY = this.getElementFloatNS(designCoords, ns, "Y") || this.getElementFloat(designCoords, "Y");
			hole.designZ = this.getElementFloatNS(designCoords, ns, "Z") || this.getElementFloat(designCoords, "Z");

			// Also try Easting/Northing/Elevation naming convention
			if (hole.designX == null) {
				hole.designX = this.getElementFloatNS(designCoords, ns, "Easting") || this.getElementFloat(designCoords, "Easting");
			}
			if (hole.designY == null) {
				hole.designY = this.getElementFloatNS(designCoords, ns, "Northing") || this.getElementFloat(designCoords, "Northing");
			}
			if (hole.designZ == null) {
				hole.designZ = this.getElementFloatNS(designCoords, ns, "Elevation") || this.getElementFloat(designCoords, "Elevation") || this.getElementFloatNS(designCoords, ns, "RL") || this.getElementFloat(designCoords, "RL");
			}
		}

		// Step 24) Parse ActualCoordinates
		var actualCoords = holeElem.getElementsByTagNameNS(ns, "ActualCoordinates")[0];
		if (!actualCoords) {
			// Try without namespace
			actualCoords = holeElem.getElementsByTagName("ActualCoordinates")[0];
		}
		if (actualCoords) {
			// Try with namespace first, then without namespace
			hole.actualX = this.getElementFloatNS(actualCoords, ns, "X") || this.getElementFloat(actualCoords, "X");
			hole.actualY = this.getElementFloatNS(actualCoords, ns, "Y") || this.getElementFloat(actualCoords, "Y");
			hole.actualZ = this.getElementFloatNS(actualCoords, ns, "Z") || this.getElementFloat(actualCoords, "Z");

			// Also try Easting/Northing/Elevation naming convention
			if (hole.actualX == null) {
				hole.actualX = this.getElementFloatNS(actualCoords, ns, "Easting") || this.getElementFloat(actualCoords, "Easting");
			}
			if (hole.actualY == null) {
				hole.actualY = this.getElementFloatNS(actualCoords, ns, "Northing") || this.getElementFloat(actualCoords, "Northing");
			}
			if (hole.actualZ == null) {
				hole.actualZ = this.getElementFloatNS(actualCoords, ns, "Elevation") || this.getElementFloat(actualCoords, "Elevation") || this.getElementFloatNS(actualCoords, ns, "RL") || this.getElementFloat(actualCoords, "RL");
			}
		}

		// Step 25) Parse DesignLoading (decks)
		var designLoading = holeElem.getElementsByTagNameNS(ns, "DesignLoading")[0];
		if (designLoading) {
			hole.decks = this.parseDecks(designLoading, ns);
		}

		return hole;
	}

	// Step 26) Parse deck loading information
	parseDecks(loadingElem, ns) {
		var decks = [];
		var deckElements = loadingElem.getElementsByTagNameNS(ns, "Decks");

		for (var i = 0; i < deckElements.length; i++) {
			var deckElem = deckElements[i];
			var deck = {
				index: this.getElementIntNS(deckElem, ns, "Index"),
				product: this.getElementTextNS(deckElem, ns, "Product"),
				length: this.getElementFloatNS(deckElem, ns, "Length"),
				weight: this.getElementFloatNS(deckElem, ns, "Weight"),
				density: this.getElementFloatNS(deckElem, ns, "Density"),
				topDepth: this.getElementFloatNS(deckElem, ns, "TopDepth"),
				bottomDepth: this.getElementFloatNS(deckElem, ns, "BottomDepth")
			};
			decks.push(deck);
		}

		return decks;
	}

	// Step 27) Convert SPF holes to Kirra blast hole format
	convertToKirraHoles(spfHoles, blastHeader) {
		var kirraHoles = [];
		var offsetX = this.offsetX;
		var offsetY = this.offsetY;

		// Step 27a) Try to extract blast name from first hole's comment field
		// Format observed: "CH01_5420_114_:::1" where blast name is before ":::"
		var blastName = "SPF_Blast";
		if (spfHoles.length > 0 && spfHoles[0].comment) {
			var comment = spfHoles[0].comment;
			var separatorIndex = comment.indexOf(":::");
			if (separatorIndex > 0) {
				blastName = comment.substring(0, separatorIndex);
				// Remove trailing underscore if present
				if (blastName.endsWith("_")) {
					blastName = blastName.substring(0, blastName.length - 1);
				}
				console.log("SPF Extracted blast name from comment:", blastName);
			}
		}

		// Step 27b) Fall back to blast header if no name extracted from comment
		if (blastName === "SPF_Blast" && blastHeader) {
			blastName = blastHeader.location || blastHeader.mine || blastName;
		}

		// Debug: Log first hole to check coordinate structure
		if (spfHoles.length > 0) {
			console.log("SPF First hole raw data:", JSON.stringify(spfHoles[0], null, 2));
		}

		var skippedDummy = 0;
		var skippedNoCoords = 0;

		for (var i = 0; i < spfHoles.length; i++) {
			var spf = spfHoles[i];

			// Step 28) Skip dummy holes
			if (spf.isDummy) {
				skippedDummy++;
				continue;
			}

			// Step 29) Use design coordinates, fall back to actual
			// Check for both null AND undefined using != instead of !==
			var collarX = spf.designX != null ? spf.designX : spf.actualX;
			var collarY = spf.designY != null ? spf.designY : spf.actualY;
			var collarZ = spf.designZ != null ? spf.designZ : spf.actualZ;

			// Step 30) Skip holes without valid coordinates (check for null, undefined, or NaN)
			if (collarX == null || collarY == null || isNaN(collarX) || isNaN(collarY)) {
				skippedNoCoords++;
				if (skippedNoCoords <= 3) {
					console.log("SPF Skipped hole " + i + " - no coords. designX:", spf.designX, "actualX:", spf.actualX, "designY:", spf.designY, "actualY:", spf.actualY);
				}
				continue;
			}

			// Step 31) Get hole geometry parameters
			var depth = spf.designLength || 0;
			var angle = spf.designAngle || 0; // Angle from vertical (0 = vertical down)
			var bearing = spf.designBearing || 0; // Azimuth in degrees

			// Step 31a) SPF subdrill is used directly
			// Negative subdrill means hole stops above grade (valid)
			// Positive subdrill means hole extends below grade
			var subdrillAmount = spf.subdrill || 0;

			// Step 31b) Calculate benchHeight from depth and subdrill
			// benchHeight = vertical distance from collar to grade
			// For positive subdrill (toe below grade): benchHeight = depth - subdrill
			// For negative subdrill (toe above grade): benchHeight = depth - subdrill (same formula)
			// Example: depth=5.5, subdrill=+0.5 => benchHeight = 5.0m, grade 5m below collar, toe 5.5m below
			// Example: depth=5.5, subdrill=-0.5 => benchHeight = 6.0m, grade 6m below collar, toe 5.5m below (above grade)
			var benchHeight = depth - subdrillAmount;

			// Step 32) Convert angle and bearing to radians
			var angleRad = angle * Math.PI / 180;
			var bearingRad = bearing * Math.PI / 180;

			// Step 33) Calculate toe position from collar + bearing/angle/depth
			var toeX = collarX;
			var toeY = collarY;
			var toeZ = (collarZ || 0) - depth * Math.cos(angleRad);

			// Step 34) If angle > 0, calculate horizontal offset for toe
			if (angle !== 0) {
				var horizontalDist = depth * Math.sin(angleRad);
				toeX = collarX + horizontalDist * Math.sin(bearingRad);
				toeY = collarY + horizontalDist * Math.cos(bearingRad);
			}

			// Step 35) Calculate grade position
			// Grade is at floor level, toe is below grade by subdrill amount
			// So: gradeZ = toeZ + subdrill (vertical component)
			var gradeX = collarX;
			var gradeY = collarY;
			var gradeZ;

			// Step 35a) Use gradeRL from SPF if it's a valid elevation (not 0 or null)
			if (spf.gradeRL != null && spf.gradeRL !== 0) {
				gradeZ = spf.gradeRL;
				console.log("SPF Using gradeRL directly:", gradeZ);
			} else {
				// Step 35b) Calculate grade from toe + subdrill
				// Per README: SubdrillAmount = GradeZ - EndZ
				// Therefore: GradeZ = EndZ + SubdrillAmount (toe is below grade, add to go up)
				gradeZ = toeZ + subdrillAmount;
				console.log("SPF Calculated gradeZ from toeZ + subdrill:", toeZ, "+", subdrillAmount, "=", gradeZ);
			}

			// Step 35c) Calculate benchHeight from collar to grade (vertical)
			benchHeight = Math.abs((collarZ || 0) - gradeZ);

			// Step 36) If angle > 0, calculate horizontal offset for grade
			if (angle !== 0 && benchHeight > 0) {
				var benchDrillLength = benchHeight / Math.cos(angleRad);
				var horizontalToGrade = benchDrillLength * Math.sin(angleRad);
				gradeX = collarX + horizontalToGrade * Math.sin(bearingRad);
				gradeY = collarY + horizontalToGrade * Math.cos(bearingRad);
			}

			// Step 37) Calculate subdrillLength (3D distance from grade to toe)
			var subdrillLength = Math.sqrt(Math.pow(toeX - gradeX, 2) + Math.pow(toeY - gradeY, 2) + Math.pow(toeZ - gradeZ, 2));

			// Step 38) Calculate total charge mass from all decks (for measuredMass)
			var totalChargeMass = 0;
			if (spf.decks && spf.decks.length > 0) {
				for (var d = 0; d < spf.decks.length; d++) {
					var deck = spf.decks[d];
					if (deck.weight !== null && deck.weight !== undefined) {
						totalChargeMass += deck.weight;
					}
				}
			}

			// Step 39) Create Kirra blast hole object
			var kirraHole = {
				entityName: blastName,
				entityType: "hole",
				holeID: spf.holeId || String(i + 1),
				startXLocation: collarX - offsetX,
				startYLocation: collarY - offsetY,
				startZLocation: collarZ || 0,
				endXLocation: toeX - offsetX,
				endYLocation: toeY - offsetY,
				endZLocation: toeZ,
				gradeXLocation: gradeX - offsetX,
				gradeYLocation: gradeY - offsetY,
				gradeZLocation: gradeZ,
				subdrillAmount: subdrillAmount,
				subdrillLength: subdrillLength,
				benchHeight: benchHeight,
				holeDiameter: spf.diameter || 127,
				holeType: "Production",
				holeLengthCalculated: depth,
				holeAngle: angle,
				holeBearing: bearing,
				fromHoleID: this.parseFromHoleID(spf.comment, blastName, spf.holeId || String(i + 1)),
				timingDelayMilliseconds: Math.round(spf.firingTime || 0), // SPF firingTime rounded to integer milliseconds
				colorHexDecimal: "#00FF00",
				measuredLength: 0,
				measuredLengthTimeStamp: "09/05/1975 00:00:00",
				measuredMass: Math.round(totalChargeMass * 10) / 10, // Round to 1 decimal place
				measuredMassTimeStamp: totalChargeMass > 0 ? new Date().toISOString() : "09/05/1975 00:00:00",
				measuredComment: "None", // SPF comment field contains fromHoleID, not actual comment
				measuredCommentTimeStamp: "09/05/1975 00:00:00",
				rowID: null,
				posID: null,
				visible: true,
				burden: 0,
				spacing: 0,
				connectorCurve: 0
			};

			// Debug: Log first hole geometry
			if (kirraHoles.length === 0) {
				console.log("SPF First hole geometry - depth:", depth, "angle:", angle, "subdrill:", subdrillAmount, "calculated benchHeight:", benchHeight, "subdrillLength:", subdrillLength);
			}

			kirraHoles.push(kirraHole);
		}

		// Debug: Log conversion summary
		console.log("SPF Conversion: " + spfHoles.length + " input holes, " + kirraHoles.length + " converted, " + skippedDummy + " dummy, " + skippedNoCoords + " no coords");

		return kirraHoles;
	}

	// Step 40) Helper: Get element text content
	getElementText(parent, tagName) {
		var elem = parent.querySelector(tagName);
		return elem ? elem.textContent : null;
	}

	// Step 41) Helper: Get element float value
	getElementFloat(parent, tagName) {
		var text = this.getElementText(parent, tagName);
		return text ? parseFloat(text) : null;
	}

	// Step 42) Helper: Get element text with namespace
	getElementTextNS(parent, ns, tagName) {
		var elem = parent.getElementsByTagNameNS(ns, tagName)[0];
		return elem ? elem.textContent : null;
	}

	// Step 43) Helper: Get element float with namespace
	getElementFloatNS(parent, ns, tagName) {
		var text = this.getElementTextNS(parent, ns, tagName);
		return text ? parseFloat(text) : null;
	}

	// Step 44) Helper: Get element int with namespace
	getElementIntNS(parent, ns, tagName) {
		var text = this.getElementTextNS(parent, ns, tagName);
		return text ? parseInt(text, 10) : null;
	}

	// Step 45) Helper: Parse fromHoleID from SPF comment field
	// Format: "CH01_5420_114_:::1" where "1" is the fromHoleID
	// Returns combined format: "blastName:::holeID"
	// If no connection found, connects to self (blastName:::currentHoleID)
	parseFromHoleID(comment, blastName, currentHoleID) {
		var fromHoleNum = null;

		// Step 45a) Try to extract fromHoleID from comment
		if (comment && typeof comment === "string") {
			var separatorIndex = comment.indexOf(":::");
			if (separatorIndex >= 0 && separatorIndex < comment.length - 3) {
				var extracted = comment.substring(separatorIndex + 3);
				if (extracted && extracted.trim() !== "") {
					fromHoleNum = extracted.trim();
				}
			}
		}

		// Step 45b) If no connection found, connect to self
		if (!fromHoleNum) {
			fromHoleNum = String(currentHoleID);
		}

		// Step 45c) Return combined format: blastName:::holeID
		return blastName + ":::" + fromHoleNum;
	}
}

export default SPFParser;
