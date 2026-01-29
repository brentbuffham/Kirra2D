// src/fileIO/TextIO/CustomBlastHoleTextParser.js
//=============================================================
// CUSTOM BLAST HOLE TEXT PARSER
//=============================================================
// Step 1) Parses custom CSV files with flexible column mapping
// Step 2) Extracted from kirra.js (lines 29783-32795)
// Step 3) Supports advanced geometry calculation and row detection
// Step 4) Created: 2026-01-04

import BaseParser from "../BaseParser.js";

// Step 5) HOLE_FIELD_MAPPING schema - defines all supported blast hole fields
const HOLE_FIELD_MAPPING = {
	entityName: {
		property: "entityName",
		type: "string",
		default: "Imported_Blast",
		required: false,
		validation: function (value) {
			return true;
		},
	},
	holeID: {
		property: "holeID",
		type: "string",
		required: true,
		validation: function (value) {
			return value && value.trim().length > 0;
		},
	},
	startXLocation: {
		property: "startXLocation",
		type: "number",
		required: true,
		validation: function (value) {
			return !isNaN(parseFloat(value));
		},
	},
	startYLocation: {
		property: "startYLocation",
		type: "number",
		required: true,
		validation: function (value) {
			return !isNaN(parseFloat(value));
		},
	},
	startZLocation: {
		property: "startZLocation",
		type: "number",
		required: true,
		validation: function (value) {
			return !isNaN(parseFloat(value));
		},
	},
	endXLocation: {
		property: "endXLocation",
		type: "number",
		default: null,
		validation: function (value) {
			return value === null || value === undefined || !isNaN(parseFloat(value));
		},
	},
	endYLocation: {
		property: "endYLocation",
		type: "number",
		default: null,
		validation: function (value) {
			return value === null || value === undefined || !isNaN(parseFloat(value));
		},
	},
	endZLocation: {
		property: "endZLocation",
		type: "number",
		default: null,
		validation: function (value) {
			return value === null || value === undefined || !isNaN(parseFloat(value));
		},
	},
	gradeXLocation: {
		property: "gradeXLocation",
		type: "number",
		default: null,
		validation: function (value) {
			return value === null || value === undefined || !isNaN(parseFloat(value));
		},
	},
	gradeYLocation: {
		property: "gradeYLocation",
		type: "number",
		default: null,
		validation: function (value) {
			return value === null || value === undefined || !isNaN(parseFloat(value));
		},
	},
	gradeZLocation: {
		property: "gradeZLocation",
		type: "number",
		default: null,
		validation: function (value) {
			return value === null || value === undefined || !isNaN(parseFloat(value));
		},
	},
	holeDiameter: {
		property: "holeDiameter",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
		},
	},
	holeAngle: {
		property: "holeAngle",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= -90 && parseFloat(value) <= 90);
		},
	},
	holeBearing: {
		property: "holeBearing",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) < 360);
		},
	},
	holeLengthCalculated: {
		property: "holeLengthCalculated",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
		},
	},
	subdrillAmount: {
		property: "subdrillAmount",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || !isNaN(parseFloat(value));
		},
	},
	benchHeight: {
		property: "benchHeight",
		type: "number",
		default: 10,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
		},
	},
	holeType: {
		property: "holeType",
		type: "string",
		default: "Production",
		validation: function (value) {
			return true;
		},
	},
	rowID: {
		property: "rowID",
		type: "integer",
		default: null,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseInt(value)) && parseInt(value) > 0);
		},
	},
	posID: {
		property: "posID",
		type: "integer",
		default: null,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseInt(value)) && parseInt(value) > 0);
		},
	},
	fromHoleID: {
		property: "fromHoleID",
		type: "string",
		default: null,
		validation: function (value) {
			return true;
		},
	},
	timingDelayMilliseconds: {
		property: "timingDelayMilliseconds",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
		},
	},
	holeTime: {
		property: "holeTime",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
		},
	},
	colorHexDecimal: {
		property: "colorHexDecimal",
		type: "string",
		default: "red",
		validation: function (value) {
			return true;
		},
	},
	measuredLength: {
		property: "measuredLength",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
		},
	},
	measuredMass: {
		property: "measuredMass",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
		},
	},
	measuredComment: {
		property: "measuredComment",
		type: "string",
		default: "None",
		validation: function (value) {
			return true;
		},
	},
	burden: {
		property: "burden",
		type: "number",
		default: 1,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
		},
	},
	spacing: {
		property: "spacing",
		type: "number",
		default: 1,
		validation: function (value) {
			return value === null || value === undefined || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
		},
	},
	connectorCurve: {
		property: "connectorCurve",
		type: "number",
		default: 0,
		validation: function (value) {
			return value === null || value === undefined || !isNaN(parseFloat(value));
		},
	},
};

// Step 6) CustomBlastHoleTextParser class
class CustomBlastHoleTextParser extends BaseParser {
	constructor(options = {}) {
		super(options);

		// Step 7) Store column order configuration
		this.columnOrder = options.columnOrder || {};
		this.fileName = options.fileName || "imported_file.csv";

		// Step 8) Store reference to global allBlastHoles array if available
		this.allBlastHoles = options.allBlastHoles || [];
		this.developerModeEnabled = options.developerModeEnabled || false;
	}

	// Step 9) Main parse method
	async parse(file) {
		// Step 10) Read file as text
		var data = await this.readAsText(file);

		// Step 11) Parse CSV lines into array
		var lines = data.split("\n");
		var csvData = lines.map((line) => line.split(","));

		// Step 12) Process the CSV data
		return this.processCsvData(csvData, this.columnOrder, file.name || this.fileName);
	}

	// Step 13) Process CSV data with column mapping
	processCsvData(data, columnOrder, fileName) {
		var entityName = fileName.split(".")[0] || "Imported_Blast_" + Math.floor(Math.random() * 16777215).toString(16);
		var headerRows = parseInt(columnOrder.headerRows, 10) || 0;
		var angleConvention = columnOrder.angle_convention || "angle";
		var diameterUnit = columnOrder.diameter_unit || "mm";
		var duplicateHandling = columnOrder.duplicate_handling || "update-blast-hole";

		var addedHoles = [];
		var updatedHoles = [];

		// Step 14) Process each data row
		data.slice(headerRows).forEach((row, index) => {
			var getValue = (colName) => {
				var colIndex = columnOrder[colName];
				if (colIndex !== undefined && colIndex !== null && colIndex !== "" && colIndex !== "0") {
					var val = row[parseInt(colIndex, 10) - 1];
					return val !== undefined && val !== null ? String(val).trim() : undefined;
				}
				return undefined;
			};

			// Step 15) Validate mandatory fields
			var holeID = getValue("holeID");
			var startX = parseFloat(getValue("startXLocation"));
			var startY = parseFloat(getValue("startYLocation"));
			var startZ = parseFloat(getValue("startZLocation"));

			if (!holeID || isNaN(startX) || isNaN(startY) || isNaN(startZ)) {
				console.warn("Skipping row " + (index + headerRows + 1) + ": Missing mandatory fields");
				return;
			}

			var holeEntityName = getValue("entityName") || entityName;
			var rowID = getValue("rowID");
			var posID = getValue("posID");

			// Step 16) Get all optional field values (NOTE: burden, spacing, connectorCurve now in HOLE_FIELD_MAPPING)
			var measuredLength = getValue("measuredLength");
			var measuredMass = getValue("measuredMass");
			var measuredComment = getValue("measuredComment");
			var measuredLengthTimeStamp = getValue("measuredLengthTimeStamp");
			var measuredMassTimeStamp = getValue("measuredMassTimeStamp");
			var measuredCommentTimeStamp = getValue("measuredCommentTimeStamp");
			var colorHexDecimal = getValue("colorHexDecimal");
			var holeTime = getValue("holeTime");
			var timingDelayMilliseconds = getValue("timingDelayMilliseconds");
			var fromHoleID = getValue("fromHoleID");
			var holeType = getValue("holeType");
			var holeLengthCalculated = getValue("holeLengthCalculated");
			var holeAngle = getValue("holeAngle");
			var holeBearing = getValue("holeBearing");
			var holeDiameter = getValue("holeDiameter");
			var subdrillAmount = getValue("subdrillAmount");
			var subdrillLength = getValue("subdrillLength");
			var benchHeight = getValue("benchHeight");

			// Step 17) Parse integer values
			if (rowID && !isNaN(rowID)) rowID = parseInt(rowID);
			else rowID = null;
			if (posID && !isNaN(posID)) posID = parseInt(posID);
			else posID = null;

			// Step 18) Check for duplicates
			var existingHoleIndex = -1;
			var isUpdate = false;
			var hole = null;

			if (duplicateHandling === "update-blast-hole") {
				existingHoleIndex = this.allBlastHoles.findIndex((h) => {
					return h.entityName === holeEntityName && h.holeID === holeID;
				});
			} else if (duplicateHandling === "update-location") {
				existingHoleIndex = this.allBlastHoles.findIndex((h) => {
					return Math.abs(h.startXLocation - startX) <= 0.01 && Math.abs(h.startYLocation - startY) <= 0.01;
				});
			}

			// Step 19) Update existing hole or create new one
			if (existingHoleIndex !== -1 && duplicateHandling !== "skip") {
				hole = this.allBlastHoles[existingHoleIndex];
				isUpdate = true;
			} else if (existingHoleIndex !== -1 && duplicateHandling === "skip") {
				return;
			} else {
				// Step 20) Create new hole object
				hole = {
					entityName: holeEntityName,
					entityType: "hole",
					holeID: holeID,
					startXLocation: startX,
					startYLocation: startY,
					startZLocation: startZ,
					endXLocation: startX,
					endYLocation: startY,
					endZLocation: startZ,
					gradeXLocation: startX,
					gradeYLocation: startY,
					gradeZLocation: startZ - 10,
					subdrillAmount: subdrillAmount || 0,
					subdrillLength: subdrillLength || 0,
					benchHeight: benchHeight || 10,
					holeDiameter: holeDiameter || 0,
					holeType: holeType || "Production",
					fromHoleID: fromHoleID || holeEntityName + ":::" + holeID,
					timingDelayMilliseconds: timingDelayMilliseconds || 0,
					colorHexDecimal: colorHexDecimal || "red",
					holeLengthCalculated: holeLengthCalculated || 0,
					holeAngle: holeAngle || 0,
					holeBearing: holeBearing || 0,
					holeTime: holeTime || 0,
					measuredLength: measuredLength || 0,
					measuredLengthTimeStamp: measuredLengthTimeStamp || "09/05/1975 00:00:00",
					measuredMass: measuredMass || 0,
					measuredMassTimeStamp: measuredMassTimeStamp || "09/05/1975 00:00:00",
					measuredComment: measuredComment || "None",
					measuredCommentTimeStamp: measuredCommentTimeStamp || "09/05/1975 00:00:00",
					visible: true,
					rowID: rowID,
					posID: posID,
					// NOTE: burden, spacing, connectorCurve now handled by HOLE_FIELD_MAPPING in updateHoleFromCsvData()
				};
			}

			// Step 21) Update hole properties with geometry calculation
			try {
				this.updateHoleFromCsvData(hole, getValue, angleConvention, diameterUnit);

				// Step 21a) Validate that no NaN values exist in coordinates
				this.validateHoleCoordinates(hole);
			} catch (error) {
				console.error("Error updating hole " + holeID + ":", error);
				return;
			}

			// Step 22) Add to tracking arrays
			if (isUpdate) {
				updatedHoles.push(hole);
			} else {
				this.allBlastHoles.push(hole);
				addedHoles.push(hole);
			}
		});

		var importedHoles = addedHoles.concat(updatedHoles);
		console.log("CSV Import Results: added=" + addedHoles.length + ", updated=" + updatedHoles.length);

		return {
			holes: importedHoles,
			addedHoles: addedHoles,
			updatedHoles: updatedHoles,
		};
	}

	// Step 23) Update hole from CSV data with field mapping
	updateHoleFromCsvData(hole, getValue, angleConvention, diameterUnit) {
		// Step 24) Update basic properties first
		Object.keys(HOLE_FIELD_MAPPING).forEach((fieldName) => {
			var mapping = HOLE_FIELD_MAPPING[fieldName];
			var rawValue = getValue(fieldName);

			// Step 25) Skip if no value provided and not required
			if ((rawValue === undefined || rawValue === null || rawValue === "") && !mapping.required) {
				if (hole[mapping.property] === undefined && mapping.default !== null) {
					hole[mapping.property] = mapping.default;
				}
				return;
			}

			// Step 26) Validate the value
			if (!mapping.validation(rawValue)) {
				console.warn("Invalid value for field " + fieldName + ": " + rawValue + ", using default: " + mapping.default);
				if (mapping.required) {
					throw new Error("Invalid value for required field " + fieldName + ": " + rawValue);
				}
				// Step 26a) For invalid non-required fields, use default value
				if (mapping.default !== null && mapping.default !== undefined) {
					hole[mapping.property] = mapping.default;
				}
				return;
			}

			// Step 27) Convert and assign the value
			var convertedValue;
			switch (mapping.type) {
				case "number":
					convertedValue = parseFloat(rawValue);
					// Step 28) Handle diameter units
					if (fieldName === "holeDiameter" && !isNaN(convertedValue)) {
						switch (diameterUnit) {
							case "m":
								convertedValue = convertedValue * 1000;
								break;
							case "in":
								convertedValue = convertedValue * 25.4;
								break;
						}
					}
					// Step 29) Handle angle convention
					if (fieldName === "holeAngle" && !isNaN(convertedValue)) {
						if (angleConvention === "dip") {
							convertedValue = 90 - convertedValue;
						}
					}
					break;
				case "integer":
					convertedValue = parseInt(rawValue);
					break;
				default:
					convertedValue = String(rawValue).trim();
					break;
			}

			hole[mapping.property] = convertedValue;
		});

		// Step 30) Ensure all required properties exist
		this.setHoleDefaults(hole);

		// Step 31) Set timingDelayMilliseconds to holeTime
		if (hole.holeTime !== undefined && !isNaN(hole.holeTime)) {
			hole.timingDelayMilliseconds = hole.holeTime;
		}

		// Step 32) Calculate missing geometry
		this.calculateMissingGeometry(hole);
	}

	// Step 33) Set default properties
	setHoleDefaults(hole) {
		hole.entityType = "hole";
		if (hole.visible === undefined) hole.visible = true;
		if (!hole.fromHoleID || hole.fromHoleID === null) {
			hole.fromHoleID = hole.entityName + ":::" + hole.holeID;
		}
		if (!hole.measuredLengthTimeStamp) hole.measuredLengthTimeStamp = "09/05/1975 00:00:00";
		if (!hole.measuredMassTimeStamp) hole.measuredMassTimeStamp = "09/05/1975 00:00:00";
		if (!hole.measuredCommentTimeStamp) hole.measuredCommentTimeStamp = "09/05/1975 00:00:00";

		// Step 34) Ensure numeric properties are valid
		var numericProps = ["startXLocation", "startYLocation", "startZLocation", "endXLocation", "endYLocation", "endZLocation", "gradeXLocation", "gradeYLocation", "gradeZLocation", "holeLengthCalculated", "holeAngle", "holeBearing", "holeDiameter", "subdrillAmount", "benchHeight", "timingDelayMilliseconds", "holeTime", "measuredLength", "measuredMass"];

		numericProps.forEach((prop) => {
			if (isNaN(hole[prop])) {
				switch (prop) {
					case "startXLocation":
					case "startYLocation":
					case "startZLocation":
						throw new Error("Invalid coordinates for hole " + hole.holeID);
					case "endXLocation":
						hole[prop] = hole.startXLocation;
						break;
					case "endYLocation":
						hole[prop] = hole.startYLocation;
						break;
					case "endZLocation":
						hole[prop] = hole.startZLocation;
						break;
					case "gradeXLocation":
						hole[prop] = hole.startXLocation;
						break;
					case "gradeYLocation":
						hole[prop] = hole.startYLocation;
						break;
					case "gradeZLocation":
						hole[prop] = hole.startZLocation - 10;
						break;
					case "holeLengthCalculated":
						hole[prop] = 10;
						break;
					case "benchHeight":
						hole[prop] = 10;
						break;
					default:
						hole[prop] = 0;
						break;
				}
			}
		});
	}

	// Step 35) Calculate missing geometry with priority-based resolution
	calculateMissingGeometry(hole) {
		// Step 36) Determine what data we have
		var hasCollarXYZ = this.isValidCoordinate(hole.startXLocation) &&
			this.isValidCoordinate(hole.startYLocation) &&
			this.isValidCoordinate(hole.startZLocation);

		var hasToeXYZ = this.isValidCoordinate(hole.endXLocation) &&
			this.isValidCoordinate(hole.endYLocation) &&
			this.isValidCoordinate(hole.endZLocation) &&
			this.coordsDifferFromCollar(hole, "end");

		var hasLAB = (hole.holeLengthCalculated > 0) &&
			(hole.holeAngle !== undefined && hole.holeAngle !== null) &&
			(hole.holeBearing !== undefined && hole.holeBearing !== null);

		var hasSubdrill = hole.subdrillAmount !== undefined &&
			hole.subdrillAmount !== null &&
			!isNaN(hole.subdrillAmount);

		// Step 37) PRIORITY 1: CollarXYZ + ToeXYZ (coordinates take precedence)
		if (hasCollarXYZ && hasToeXYZ) {
			console.log("CSV Import: PRIORITY 1 - Using CollarXYZ + ToeXYZ (ignoring L/A/B if provided)");
			this.calculateFromCollarAndToe(hole, hasSubdrill);
			return;
		}

		// Step 38) PRIORITY 2: CollarXYZ + L/A/B + Subdrill (forward calculation)
		if (hasCollarXYZ && hasLAB && hasSubdrill) {
			console.log("CSV Import: PRIORITY 2 - Using CollarXYZ + L/A/B + Subdrill");
			this.calculateFromDesignParams(hole);
			return;
		}

		// Step 39) PRIORITY 3: ToeXYZ + L/A/B + Subdrill (REVERSE calculation)
		if (!hasCollarXYZ && hasToeXYZ && hasLAB && hasSubdrill) {
			console.log("CSV Import: PRIORITY 3 - REVERSE CALC - ToeXYZ + L/A/B -> CollarXYZ");
			this.calculateCollarFromToe(hole);
			return;
		}

		// Step 40) PRIORITY 4: CollarXYZ + L/A/B (no subdrill)
		if (hasCollarXYZ && hasLAB && !hasSubdrill) {
			console.log("CSV Import: PRIORITY 4 - Using CollarXYZ + L/A/B (default subdrill)");
			hole.subdrillAmount = 1;
			this.calculateFromDesignParams(hole);
			return;
		}

		// Step 41) PRIORITY 5: CollarXYZ only (use defaults)
		if (hasCollarXYZ) {
			console.log("CSV Import: PRIORITY 5 - Using CollarXYZ only (applying defaults)");
			this.applyDefaultGeometry(hole);
			this.calculateFromDesignParams(hole);
			return;
		}

		// Step 42) No valid data
		console.warn("CSV Import: No valid geometry data found for hole " + hole.holeID);
	}

	// Step 43) Helper: Check if coordinate is valid
	isValidCoordinate(value) {
		return value !== undefined && value !== null && !isNaN(value);
	}

	// Step 44) Helper: Check if end coordinates differ from collar
	coordsDifferFromCollar(hole, type) {
		if (type === "end") {
			return (hole.endXLocation !== hole.startXLocation ||
				hole.endYLocation !== hole.startYLocation ||
				hole.endZLocation !== hole.startZLocation);
		}
		return false;
	}

	// Step 45) Calculate Length, Angle, Bearing from CollarXYZ and ToeXYZ
	calculateFromCollarAndToe(hole, hasSubdrill) {
		var dx = hole.endXLocation - hole.startXLocation;
		var dy = hole.endYLocation - hole.startYLocation;
		var dz = hole.startZLocation - hole.endZLocation;

		// Step 46) Calculate Length
		hole.holeLengthCalculated = Math.sqrt(dx * dx + dy * dy + dz * dz);

		if (hole.holeLengthCalculated > 0) {
			// Step 47) Calculate Bearing: 0=North, 90=East
			var bearing = Math.atan2(dx, dy) * (180 / Math.PI);
			if (bearing < 0) bearing += 360;
			hole.holeBearing = bearing;

			// Step 48) Calculate Angle: 0=vertical, 90=horizontal
			var horizontalDist = Math.sqrt(dx * dx + dy * dy);
			if (horizontalDist > 0) {
				hole.holeAngle = Math.atan2(horizontalDist, dz) * (180 / Math.PI);
			} else {
				hole.holeAngle = 0;
			}

			// Step 49) Calculate GradeXYZ from subdrill
			if (hasSubdrill) {
				this.calculateGradeFromSubdrill(hole);
			} else {
				hole.subdrillAmount = Math.min(hole.holeLengthCalculated * 0.1, 1);
				this.calculateGradeFromSubdrill(hole);
			}

			// Step 50) Calculate BenchHeight
			hole.benchHeight = hole.startZLocation - hole.gradeZLocation;
		}
	}

	// Step 51) Calculate GradeXYZ from ToeXYZ and subdrillAmount (VERTICAL distance)
	// CRITICAL: subdrillAmount is VERTICAL (deltaZ), NOT along hole vector
	// subdrillAmount > 0: Grade ABOVE toe (downhole positive)
	// subdrillAmount < 0: Grade BELOW toe (uphole negative)
	calculateGradeFromSubdrill(hole) {
		var angleRad = hole.holeAngle * (Math.PI / 180);
		var bearingRad = hole.holeBearing * (Math.PI / 180);
		var subdrillAmount = hole.subdrillAmount || 0; // VERTICAL distance

		// Grade Z is simple: toeZ + vertical subdrill amount
		hole.gradeZLocation = hole.endZLocation + subdrillAmount;

		// Horizontal offset from toe to grade (projected onto horizontal plane)
		var horizontalOffset = subdrillAmount * Math.tan(angleRad);

		// Grade XY moves horizontally back toward collar
		hole.gradeXLocation = hole.endXLocation - horizontalOffset * Math.sin(bearingRad);
		hole.gradeYLocation = hole.endYLocation - horizontalOffset * Math.cos(bearingRad);

		// Calculate subdrillLength (3D distance along hole vector from grade to toe)
		// subdrillLength = subdrillAmount / cos(angle)
		hole.subdrillLength = Math.abs(hole.holeAngle) < 0.001 ? subdrillAmount : subdrillAmount / Math.cos(angleRad);
	}

	// Step 52) Calculate ToeXYZ and GradeXYZ from design parameters
	calculateFromDesignParams(hole) {
		var angleRad = hole.holeAngle * (Math.PI / 180);
		var bearingRad = hole.holeBearing * (Math.PI / 180);

		var horizontalDist = hole.holeLengthCalculated * Math.sin(angleRad);
		var verticalDist = hole.holeLengthCalculated * Math.cos(angleRad);

		// Step 53) Calculate ToeXYZ
		hole.endXLocation = hole.startXLocation + horizontalDist * Math.sin(bearingRad);
		hole.endYLocation = hole.startYLocation + horizontalDist * Math.cos(bearingRad);
		hole.endZLocation = hole.startZLocation - verticalDist;

		// Step 54) Calculate GradeXYZ
		this.calculateGradeFromSubdrill(hole);

		// Step 55) Calculate BenchHeight
		hole.benchHeight = hole.startZLocation - hole.gradeZLocation;
	}

	// Step 56) Apply default geometry values
	applyDefaultGeometry(hole) {
		if (!hole.holeLengthCalculated || hole.holeLengthCalculated <= 0) {
			var benchHeight = hole.benchHeight || 10;
			var subdrill = hole.subdrillAmount || 1;
			hole.holeLengthCalculated = benchHeight + subdrill;
		}
		if (hole.holeAngle === undefined || hole.holeAngle === null) {
			hole.holeAngle = 0;
		}
		if (hole.holeBearing === undefined || hole.holeBearing === null) {
			hole.holeBearing = 0;
		}
		if (hole.subdrillAmount === undefined || hole.subdrillAmount === null) {
			hole.subdrillAmount = 1;
		}
	}

	// Step 56a) Validate hole coordinates to prevent NaN values
	validateHoleCoordinates(hole) {
		var coordinateFields = [
			"startXLocation", "startYLocation", "startZLocation",
			"endXLocation", "endYLocation", "endZLocation",
			"gradeXLocation", "gradeYLocation", "gradeZLocation"
		];

		var hasNaN = false;
		coordinateFields.forEach((field) => {
			if (isNaN(hole[field])) {
				console.warn("NaN detected in hole " + hole.holeID + " field: " + field);
				hasNaN = true;

				// Step 56b) Replace NaN with collar coordinates as fallback
				if (field.startsWith("end") || field.startsWith("grade")) {
					if (field.endsWith("XLocation")) hole[field] = hole.startXLocation || 0;
					else if (field.endsWith("YLocation")) hole[field] = hole.startYLocation || 0;
					else if (field.endsWith("ZLocation")) hole[field] = hole.startZLocation || 0;
				} else {
					hole[field] = 0;
				}
			}
		});

		// Step 56c) Validate numeric fields
		var numericFields = ["holeLengthCalculated", "holeAngle", "holeBearing", "holeDiameter", "subdrillAmount", "benchHeight"];
		numericFields.forEach((field) => {
			if (isNaN(hole[field]) || hole[field] === undefined || hole[field] === null) {
				var defaultValue = (field === "benchHeight") ? 10 : 0;
				hole[field] = defaultValue;
			}
		});

		if (hasNaN) {
			console.warn("Repaired NaN values in hole " + hole.holeID);
		}
	}

	// Step 57) REVERSE GEOMETRY: Calculate CollarXYZ from ToeXYZ
	calculateCollarFromToe(hole) {
		var length = hole.holeLengthCalculated;
		var angleRad = hole.holeAngle * (Math.PI / 180);
		var bearingRad = hole.holeBearing * (Math.PI / 180);
		var subdrill = hole.subdrillAmount || 0;

		var horizontalDist = length * Math.sin(angleRad);
		var verticalDist = length * Math.cos(angleRad);

		// Step 58) Back-calculate CollarXYZ
		hole.startXLocation = hole.endXLocation - horizontalDist * Math.sin(bearingRad);
		hole.startYLocation = hole.endYLocation - horizontalDist * Math.cos(bearingRad);
		hole.startZLocation = hole.endZLocation + verticalDist;

		// Step 59) Calculate GradeXYZ
		var subdrillVertical = subdrill;
		var subdrillHorizontal = subdrill * Math.tan(angleRad);

		hole.gradeXLocation = hole.endXLocation - subdrillHorizontal * Math.sin(bearingRad);
		hole.gradeYLocation = hole.endYLocation - subdrillHorizontal * Math.cos(bearingRad);
		hole.gradeZLocation = hole.endZLocation + subdrillVertical;

		// Step 60) Calculate BenchHeight
		hole.benchHeight = hole.startZLocation - hole.gradeZLocation;

		console.log("Reverse geometry calculated: CollarZ=" + hole.startZLocation.toFixed(2) +
			", GradeZ=" + hole.gradeZLocation.toFixed(2) +
			", ToeZ=" + hole.endZLocation.toFixed(2) +
			", BenchHeight=" + hole.benchHeight.toFixed(2));
	}

	// Step 61) Perform row detection on imported holes
	performRowDetection(holes, entityName) {
		if (!holes || holes.length === 0) return;

		// Step 62) Group holes that need row detection
		var holesNeedingDetection = holes.filter((hole) => {
			return hole.rowID === null || hole.rowID === 0 || hole.posID === null || hole.posID === 0;
		});

		if (holesNeedingDetection.length === 0) return;

		console.log("Performing row detection for " + holesNeedingDetection.length + " holes in entity: " + entityName);

		// Step 63) Try improved smart row detection
		this.improvedSmartRowDetection(holesNeedingDetection, entityName);
	}

	// Step 64) Improved smart row detection (main entry point)
	// UPDATED: Now delegates to the comprehensive RowDetection module
	improvedSmartRowDetection(holesData, entityName) {
		if (!holesData || holesData.length === 0) return;

		console.log("CustomBlastHoleTextParser: Delegating to RowDetection module for " + holesData.length + " holes");

		// Step 65) Use the global improvedSmartRowDetection from RowDetection module
		// This includes: sequence-based, HDBSCAN, adaptive grid, and serpentine detection
		if (typeof window.improvedSmartRowDetection === "function") {
			var result = window.improvedSmartRowDetection(holesData, entityName);
			console.log("RowDetection module result:", result);
			return;
		}

		// Step 66) Fallback if RowDetection module not available
		console.warn("RowDetection module not available, using legacy fallback");

		// Try local sequence-based detection
		if (this.trySequenceBasedDetection(holesData, entityName)) {
			console.log("Used local sequence-based row detection");
			return;
		}

		// Step 67) Final fallback: Auto-assign rowID/posID for unassigned holes
		holesData.forEach((hole) => {
			if (!hole.rowID || hole.rowID === 0) {
				hole.rowID = this.getNextRowID(entityName);
			}
			if (!hole.posID || hole.posID === 0) {
				hole.posID = this.getNextPosID(entityName, hole.rowID);
			}
		});

		console.log("Used auto-assignment row detection as fallback");
	}

	// Step 67) Try sequence-based detection
	trySequenceBasedDetection(holesData, entityName) {
		var numericCount = 0;
		var alphaNumericCount = 0;
		var otherCount = 0;

		holesData.forEach((hole) => {
			if (/^\d+$/.test(hole.holeID)) {
				numericCount++;
			} else if (/^[A-Z]+\d+$/i.test(hole.holeID)) {
				alphaNumericCount++;
			} else {
				otherCount++;
			}
		});

		console.log("Hole ID pattern analysis:", {
			numeric: numericCount,
			alphaNumeric: alphaNumericCount,
			other: otherCount,
		});

		// Step 68) CASE 1: All alphanumeric
		if (alphaNumericCount === holesData.length) {
			console.log("All holes are alphanumeric - analyzing pattern");
			return this.handleAlphaNumericHoles(holesData, entityName);
		}

		// Step 69) CASE 2: Mixed patterns
		if (numericCount > 0 && alphaNumericCount > 0) {
			console.log("Mixed numeric and alphanumeric pattern detected");
			return this.handleMixedPattern(holesData, entityName);
		}

		// Step 70) CASE 3: Pure numeric
		var numericHoles = holesData
			.map((hole) => ({ hole, num: parseInt(hole.holeID) }))
			.filter((item) => !isNaN(item.num))
			.sort((a, b) => a.num - b.num);

		if (numericHoles.length !== holesData.length || numericHoles.length < 4) {
			return false;
		}

		// Step 71) Check if sequence is continuous
		var firstNum = numericHoles[0].num;
		var isSequential = numericHoles.every((item, index) => item.num === firstNum + index);

		if (!isSequential) {
			return false;
		}

		// Step 72) Use line fitting for sequential numeric holes
		console.log("Using Sequential Line Fitting Algorithm");
		return this.detectRowsUsingLineFitting(numericHoles, entityName);
	}

	// Step 73) Handle alphanumeric holes (A1, A2, B1, B2...)
	handleAlphaNumericHoles(holesData, entityName) {
		var rowGroups = new Map();
		var parsedHoles = [];

		holesData.forEach((hole) => {
			var match = hole.holeID.match(/^([A-Z]+)(\d+)$/i);
			if (match) {
				var letter = match[1].toUpperCase();
				var number = parseInt(match[2]);

				parsedHoles.push({ hole: hole, letter: letter, number: number });

				if (!rowGroups.has(letter)) {
					rowGroups.set(letter, []);
				}
				rowGroups.get(letter).push({ hole: hole, letter: letter, number: number });
			}
		});

		var letterGroups = Array.from(rowGroups.keys());
		console.log("Found letter groups:", letterGroups.join(", "));

		var singleLetters = letterGroups.filter((l) => l.length === 1).sort();
		var multiLetters = letterGroups.filter((l) => l.length > 1);

		var isSequentialRows = false;
		if (singleLetters.length >= 2) {
			isSequentialRows = singleLetters.every((letter, index) => {
				if (index === 0) return true;
				return letter.charCodeAt(0) - singleLetters[index - 1].charCodeAt(0) === 1;
			});
		}

		var useLettersAsRows = isSequentialRows && singleLetters.length >= 3 && multiLetters.length === 0;

		if (useLettersAsRows) {
			console.log("Letters appear to represent rows (A, B, C pattern)");

			var startingRowID = this.getNextRowID(entityName);

			singleLetters.forEach((rowLetter, rowIndex) => {
				var row = rowGroups.get(rowLetter);
				row.sort((a, b) => a.number - b.number);

				var rowID = startingRowID + rowIndex;

				row.forEach((item, index) => {
					item.hole.rowID = rowID;
					item.hole.posID = index + 1;
				});

				console.log("Row " + rowLetter + " -> rowID " + rowID + " with " + row.length + " holes");
			});

			return true;
		} else {
			console.log("Letters appear to be hole type prefixes - falling back");
			return false;
		}
	}

	// Step 74) Handle mixed pattern
	handleMixedPattern(holesData, entityName) {
		console.log("Mixed pattern - using auto-assignment");
		return false;
	}

	// Step 75) Detect rows using line fitting
	detectRowsUsingLineFitting(numericHoles, entityName) {
		if (numericHoles.length < 2) return false;

		var holeDiameter = numericHoles[0].hole.holeDiameter || 115;
		var tolerance = (holeDiameter * 2) / 1000;

		console.log("Line fitting tolerance:", tolerance.toFixed(3) + "m (2x diameter)");

		var rows = [];
		var used = new Set();

		for (var startIdx = 0; startIdx < numericHoles.length; startIdx++) {
			if (used.has(startIdx)) continue;

			var row = this.findLongestLineSequence(numericHoles, startIdx, tolerance, used);

			if (row.length >= 2) {
				rows.push(row);
				row.forEach((hole) => used.add(numericHoles.indexOf(hole)));
				console.log("Found row with", row.length, "holes:", row.map((h) => h.num).join(","));
			}
		}

		for (var i = 0; i < numericHoles.length; i++) {
			if (!used.has(i)) {
				rows.push([numericHoles[i]]);
				console.log("Single hole row:", numericHoles[i].num);
			}
		}

		var startingRowID = this.getNextRowID(entityName);
		rows.forEach((row, rowIndex) => {
			var rowID = startingRowID + rowIndex;
			row.forEach((item, posIndex) => {
				item.hole.rowID = rowID;
				item.hole.posID = posIndex + 1;
			});
		});

		console.log("Line fitting detected", rows.length, "rows");
		return rows.length > 0;
	}

	// Step 76) Find longest line sequence
	findLongestLineSequence(numericHoles, startIdx, tolerance, used) {
		var sequence = [numericHoles[startIdx]];

		for (var nextIdx = startIdx + 1; nextIdx < numericHoles.length; nextIdx++) {
			if (used.has(nextIdx)) continue;

			var testSequence = [...sequence, numericHoles[nextIdx]];

			if (this.sequenceFitsLine(testSequence, tolerance)) {
				sequence.push(numericHoles[nextIdx]);
			} else {
				break;
			}
		}

		return sequence;
	}

	// Step 77) Test if sequence fits line
	sequenceFitsLine(sequence, tolerance) {
		if (sequence.length < 2) return true;

		var points = sequence.map((item) => ({
			x: item.hole.startXLocation,
			y: item.hole.startYLocation,
		}));

		var start = points[0];
		var end = points[points.length - 1];

		for (var i = 1; i < points.length - 1; i++) {
			var distance = this.distancePointToLine(points[i], start, end);
			if (distance > tolerance) {
				return false;
			}
		}

		return true;
	}

	// Step 78) Calculate point-to-line distance
	distancePointToLine(point, lineStart, lineEnd) {
		var dx = lineEnd.x - lineStart.x;
		var dy = lineEnd.y - lineStart.y;
		var lineLength = Math.sqrt(dx * dx + dy * dy);

		if (lineLength === 0) return 0;

		var distance = Math.abs((dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / lineLength);

		return distance;
	}

	// Step 79) Get next row ID
	getNextRowID(entityName) {
		if (!this.allBlastHoles || this.allBlastHoles.length === 0) {
			return 1;
		}

		var entityHoles = this.allBlastHoles.filter((hole) => hole.entityName === entityName);
		if (entityHoles.length === 0) {
			return 1;
		}

		var maxRowID = 0;
		entityHoles.forEach((hole) => {
			if (hole.rowID && !isNaN(hole.rowID)) {
				maxRowID = Math.max(maxRowID, parseInt(hole.rowID));
			}
		});

		return maxRowID + 1;
	}

	// Step 80) Get next position ID
	getNextPosID(entityName, rowID) {
		if (!this.allBlastHoles || this.allBlastHoles.length === 0) {
			return 1;
		}

		var rowHoles = this.allBlastHoles.filter((hole) => hole.entityName === entityName && hole.rowID === rowID);

		if (rowHoles.length === 0) {
			return 1;
		}

		var maxPosID = 0;
		rowHoles.forEach((hole) => {
			if (hole.posID && !isNaN(hole.posID)) {
				maxPosID = Math.max(maxPosID, parseInt(hole.posID));
			}
		});

		return maxPosID + 1;
	}
}

export default CustomBlastHoleTextParser;
export { HOLE_FIELD_MAPPING };
