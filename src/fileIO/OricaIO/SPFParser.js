// src/fileIO/OricaIO/SPFParser.js
//=============================================================
// SPF FILE PARSER (Orica ShotPlus)
//=============================================================
// Step 1) Parses Orica ShotPlus .spf files (blast design files)
// Step 2) SPF files are ZIP archives containing XML files
// Step 3) Main data in BlisData.Xml with Orica BLIS namespace
// Step 4) Created: 2026-01-21

import BaseParser from "../BaseParser.js";

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
		// Step 8) SPF files are ZIP archives - need JSZip
		if (!window.JSZip) {
			throw new Error("JSZip library required for SPF parsing. Include from https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
		}

		// Step 9) Read file as ArrayBuffer
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
			var hole = this.parseHoleElement(holeElem, ns);
			if (hole) {
				result.holes.push(hole);
			}
		}

		return result;
	}

	// Step 22) Parse individual Hole element
	parseHoleElement(holeElem, ns) {
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
		if (designCoords) {
			hole.designX = this.getElementFloatNS(designCoords, ns, "X");
			hole.designY = this.getElementFloatNS(designCoords, ns, "Y");
			hole.designZ = this.getElementFloatNS(designCoords, ns, "Z");
		}

		// Step 24) Parse ActualCoordinates
		var actualCoords = holeElem.getElementsByTagNameNS(ns, "ActualCoordinates")[0];
		if (actualCoords) {
			hole.actualX = this.getElementFloatNS(actualCoords, ns, "X");
			hole.actualY = this.getElementFloatNS(actualCoords, ns, "Y");
			hole.actualZ = this.getElementFloatNS(actualCoords, ns, "Z");
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
		var blastName = blastHeader ? (blastHeader.location || blastHeader.mine || "SPF_Blast") : "SPF_Blast";

		for (var i = 0; i < spfHoles.length; i++) {
			var spf = spfHoles[i];

			// Skip dummy holes
			if (spf.isDummy) continue;

			// Use design coordinates, fall back to actual
			var collarX = spf.designX !== null ? spf.designX : spf.actualX;
			var collarY = spf.designY !== null ? spf.designY : spf.actualY;
			var collarZ = spf.designZ !== null ? spf.designZ : spf.actualZ;

			if (collarX === null || collarY === null) continue;

			// Calculate toe position from bearing/angle/depth
			var depth = spf.designLength || 0;
			var angle = spf.designAngle || 0; // Angle from vertical (0 = vertical down)
			var bearing = spf.designBearing || 0; // Azimuth in degrees

			var toeX = collarX;
			var toeY = collarY;
			var toeZ = (collarZ || 0) - depth * Math.cos(angle * Math.PI / 180);

			// If angle > 0, calculate horizontal offset
			if (angle !== 0) {
				var horizontalDist = depth * Math.sin(angle * Math.PI / 180);
				toeX = collarX + horizontalDist * Math.sin(bearing * Math.PI / 180);
				toeY = collarY + horizontalDist * Math.cos(bearing * Math.PI / 180);
			}

			var kirraHole = {
				holeID: spf.holeId || String(i + 1),
				holeName: blastName + "_" + (spf.holeId || String(i + 1)),
				collarX: collarX - offsetX,
				collarY: collarY - offsetY,
				collarZ: collarZ || 0,
				toeX: toeX - offsetX,
				toeY: toeY - offsetY,
				toeZ: toeZ,
				designDepth: depth,
				actualDepth: depth,
				diameter: spf.diameter || 127,
				angle: angle,
				bearing: bearing,
				benchHeight: spf.benchHeight || 0,
				subdrill: spf.subdrill || 0,
				stemming: spf.stemming || 0,
				backfill: spf.backfill || 0,
				delay: spf.firingTime || 0,
				sequence: spf.sequence || i + 1,
				waterStatus: spf.waterState || "Unknown",
				powderFactor: spf.powderFactor || 0,
				comment: spf.comment || "",
				isLoaded: spf.isLoaded,
				isBoreTracked: spf.isBoreTracked,
				ruleName: spf.ruleName || "",
				visible: true,
				selected: false,
				color: "#00FF00"
			};

			// Add deck information if available
			if (spf.decks && spf.decks.length > 0) {
				kirraHole.decks = spf.decks;
			}

			kirraHoles.push(kirraHole);
		}

		return kirraHoles;
	}

	// Step 28) Helper: Get element text content
	getElementText(parent, tagName) {
		var elem = parent.querySelector(tagName);
		return elem ? elem.textContent : null;
	}

	// Step 29) Helper: Get element float value
	getElementFloat(parent, tagName) {
		var text = this.getElementText(parent, tagName);
		return text ? parseFloat(text) : null;
	}

	// Step 30) Helper: Get element text with namespace
	getElementTextNS(parent, ns, tagName) {
		var elem = parent.getElementsByTagNameNS(ns, tagName)[0];
		return elem ? elem.textContent : null;
	}

	// Step 31) Helper: Get element float with namespace
	getElementFloatNS(parent, ns, tagName) {
		var text = this.getElementTextNS(parent, ns, tagName);
		return text ? parseFloat(text) : null;
	}

	// Step 32) Helper: Get element int with namespace
	getElementIntNS(parent, ns, tagName) {
		var text = this.getElementTextNS(parent, ns, tagName);
		return text ? parseInt(text, 10) : null;
	}
}

export default SPFParser;
