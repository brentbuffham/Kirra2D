// src/fileIO/SurpacIO/SurpacSTRParser.js
//=============================================================
// SURPAC STR PARSER - STRING FILE FORMAT (TEXT & BINARY)
//=============================================================
// Step 1) Parses Surpac STR (String) format files per official specification
// Step 2) Reference: https://www.cse.unr.edu/~fredh/papers/working/vr-mining/string.html
//
// FILE STRUCTURE:
//   Line 1: Header record - location, date, purpose, memo (4 fields)
//   Line 2: Axis record - 0, y1, x1, z1, y2, x2, z2 (string# always 0)
//   Lines 3+: String records - string#, Y, X, Z, D1, D2, D3...
//   Null record: 0, 0.000, 0.000, 0.000, (marks end of string/segment)
//   End record: 0, 0.000, 0.000, 0.000, END (marks end of file)
//
// KEY RULES:
//   - String numbers range 1-32000 and encode color/type
//   - Points between null records form a connected string (polyline)
//   - NULL RECORD (string# = 0) is the delimiter that ends a string
//   - Multiple strings can share the same string number (separated by nulls)
//   - D1-D100 are optional description fields (32 chars each, 512 total)
//   - Coordinates: Y=Northing, X=Easting, Z=Elevation
//
// BLAST HOLE SUPPORT:
//   - Detects Surpac 6.3 blast hole format with collar+toe pairs
//   - Metadata in D1-D14 fields (DrillBlast ID, depth, diameter, bearing, dip, etc.)
//
// Created: 2026-01-05, Updated: 2026-01-21

import BaseParser from "../BaseParser.js";

class SurpacSTRParser extends BaseParser {
	constructor(options = {}) {
		super(options);
		// Step 3) Entity counter for generating unique names
		this.entityCounter = 0;
		this.entityNameSet = new Set(); // O(1) uniqueness check
	}

	// Step 4) Main parse method - handles both text and binary
	async parse(content) {
		if (!content) {
			throw new Error("Invalid content: content required");
		}

		// Step 5) Reset counter for this parse session
		this.entityCounter = 0;
		this.entityNameSet = new Set();

		// Step 6) Detect binary vs text content
		var isBinary = this.isBinaryContent(content);

		if (isBinary) {
			console.log("Detected binary STR format");
			return await this.parseBinary(content);
		} else {
			console.log("Detected text STR format");
			return this.parseText(content);
		}
	}

	// =========================================================================
	// TEXT PARSING
	// =========================================================================

	// Step 7) Parse text STR file
	parseText(content) {
		if (typeof content !== "string") {
			// Step 8) Convert ArrayBuffer to string if needed
			if (content instanceof ArrayBuffer) {
				var decoder = new TextDecoder("utf-8");
				content = decoder.decode(content);
			} else {
				throw new Error("Invalid text content: string required");
			}
		}

		var lines = content.split(/\r?\n/);
		var kadEntities = [];
		var blastHoles = [];
		var currentString = [];
		var isBlastHoleFile = false;

		if (lines.length < 3) {
			throw new Error("Invalid STR file: too few lines");
		}

		// Step 9) Detect if this is a blast hole file by checking first data line
		for (var checkIdx = 2; checkIdx < Math.min(lines.length, 10); checkIdx++) {
			var checkLine = lines[checkIdx].trim();
			if (!checkLine) continue;
			var checkParts = checkLine.split(",");
			// Step 10) Blast holes have many D fields (DrillBlast1.1,BLASTID,00001,13.500,...)
			if (checkParts.length > 10 && checkParts[4] && checkParts[4].indexOf("DrillBlast") !== -1) {
				isBlastHoleFile = true;
				console.log("Detected Surpac 6.3 blast hole format");
				break;
			}
		}

		// Step 11) Parse based on file type
		if (isBlastHoleFile) {
			blastHoles = this.parseTextBlastHoles(lines);
			console.log("Parsed " + blastHoles.length + " blast holes from STR");
			return {
				blastHoles: blastHoles,
				kadEntities: []
			};
		}

		// Step 12) Parse as KAD geometry (strings/polylines)
		// Parse string records starting from line 3 (index 2)
		// Line 1 = Header, Line 2 = Axis record
		for (var i = 2; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line) continue;

			var parts = line.split(",").map(function(p) {
				return p.trim();
			});

			if (parts.length < 4) continue;

			var stringNumber = parseInt(parts[0]);
			var y = parseFloat(parts[1]); // Northing
			var x = parseFloat(parts[2]); // Easting
			var z = parseFloat(parts[3]); // Elevation

			// Step 13) Extract description fields D1, D2, D3...
			var descriptions = [];
			for (var d = 4; d < parts.length; d++) {
				descriptions.push(parts[d].trim());
			}

			// Step 14) NULL RECORD (string# = 0) - end of current string
			// This is the CORRECT delimiter per specification
			if (stringNumber === 0) {
				// Step 15) Check for END marker
				if (descriptions.length > 0 && descriptions[0].toUpperCase() === "END") {
					if (currentString.length > 0) {
						this.finalizeString(kadEntities, currentString);
						currentString = [];
					}
					break;
				}

				// Step 16) Regular null record - finalize current string
				if (currentString.length > 0) {
					this.finalizeString(kadEntities, currentString);
					currentString = [];
				}
				continue;
			}

			// Step 17) Validate coordinates
			if (isNaN(stringNumber) || isNaN(x) || isNaN(y) || isNaN(z)) {
				console.warn("Skipping line " + (i + 1) + " - invalid data");
				continue;
			}

			// Step 18) Add point to current string
			currentString.push({
				stringNumber: stringNumber,
				x: x,
				y: y,
				z: z,
				d1: descriptions[0] || "",
				d2: descriptions[1] || "",
				descriptions: descriptions
			});
		}

		// Step 19) Finalize any remaining string
		if (currentString.length > 0) {
			this.finalizeString(kadEntities, currentString);
		}

		console.log("Parsed " + kadEntities.length + " KAD entities from STR");

		return {
			kadEntities: kadEntities
		};
	}

	// Step 20) Parse text blast holes (Surpac 6.3 format)
	parseTextBlastHoles(lines) {
		var blastHoles = [];
		var currentHole = null;
		var holeCounter = 1;

		for (var i = 2; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line) continue;

			var parts = line.split(",").map(function(p) {
				return p.trim();
			});

			if (parts.length < 4) continue;

			var stringNumber = parseInt(parts[0]);

			// Step 21) Skip null records and END
			if (stringNumber === 0) {
				if (parts[4] && parts[4].toUpperCase() === "END") {
					break;
				}
				continue;
			}

			var y = parseFloat(parts[1]); // Northing
			var x = parseFloat(parts[2]); // Easting
			var z = parseFloat(parts[3]); // Elevation

			if (isNaN(x) || isNaN(y) || isNaN(z)) {
				continue;
			}

			// Step 22) Check if this is a collar line (has metadata) or toe line
			if (parts.length > 10 && parts[4] && parts[4].indexOf("DrillBlast") !== -1) {
				// Step 23) Finalize previous hole if exists
				if (currentHole) {
					this.recalculateHoleGeometry(currentHole);
					blastHoles.push(currentHole);
				}

				// Step 24) Parse collar line metadata
				currentHole = this.parseBlastHoleCollar(x, y, z, parts, holeCounter++);
			} else if (currentHole) {
				// Step 25) This is a toe line
				currentHole.endXLocation = x;
				currentHole.endYLocation = y;
				currentHole.endZLocation = z;
			}
		}

		// Step 26) Finalize last hole
		if (currentHole) {
			this.recalculateHoleGeometry(currentHole);
			blastHoles.push(currentHole);
		}

		return blastHoles;
	}

	// Step 27) Parse blast hole collar from line parts
	parseBlastHoleCollar(collarX, collarY, collarZ, parts, holeIndex) {
		// Parts array (Surpac 6.3 format):
		// 0: String number (1)
		// 1: Collar Y
		// 2: Collar X
		// 3: Collar Z
		// 4: D1 - Blast design identifier (e.g., "DrillBlast1.1")
		// 5: D2 - Blast name ID (e.g., "BLASTID")
		// 6: D3 - Hole ID (e.g., "00001")
		// 7: D4 - Planned depth (e.g., "13.500")
		// 8: D5 - Diameter in meters (e.g., "0.229")
		// 9: D6 - Empty (burden/spacing)
		// 10: D7 - Rig name (e.g., "Rig-1")
		// 11: D8 - Subdrill length (e.g., "1.500")
		// 12: D9 - Bearing/azimuth (e.g., "0.0000")
		// 13: D10 - Dip (e.g., "-90.0000")
		// 14: D11 - Blast method (e.g., "BLASTMETHOD")

		var blastDesignID = parts[4] || "";
		var blastNameID = parts[5] || "BLASTID";
		var holeID = parts[6] || holeIndex.toString();
		var plannedDepth = parseFloat(parts[7]) || 0;
		var diameter = parseFloat(parts[8]) || 0; // In meters
		var rigName = parts[10] || "Undefined";
		var subdrill = parseFloat(parts[11]) || 0;
		var bearing = parseFloat(parts[12]) || 0;
		var dip = parseFloat(parts[13]) || -90; // Surpac dip (negative = down)
		var blastMethod = parts[14] || "METHOD";

		// Step 28) Convert Surpac dip to Kirra hole angle
		// Surpac: -90 = vertical down (dip), 0 = horizontal
		// Kirra: 0 = vertical down, 90 = horizontal (angle from vertical)
		var holeAngle = dip + 90;

		var cleanHoleID = holeID.replace(/^0+/, "") || holeIndex.toString();

		// Step 29) Create BlastHole object
		var hole = {
			entityName: blastNameID,
			entityType: "hole",
			holeID: cleanHoleID,
			startXLocation: collarX,
			startYLocation: collarY,
			startZLocation: collarZ,
			endXLocation: 0,
			endYLocation: 0,
			endZLocation: 0,
			gradeXLocation: 0,
			gradeYLocation: 0,
			gradeZLocation: 0,
			subdrillAmount: subdrill,
			subdrillLength: 0,
			benchHeight: 0,
			holeDiameter: diameter * 1000, // Convert meters to mm
			holeType: rigName,
			fromHoleID: blastNameID + ":::" + cleanHoleID,
			timingDelayMilliseconds: 0,
			colorHexDecimal: "red",
			holeLengthCalculated: plannedDepth,
			holeAngle: holeAngle,
			holeBearing: bearing,
			measuredLength: 0,
			measuredLengthTimeStamp: "09/05/1975 00:00:00",
			measuredMass: 0,
			measuredMassTimeStamp: "09/05/1975 00:00:00",
			measuredComment: "None",
			measuredCommentTimeStamp: "09/05/1975 00:00:00",
			holeTime: 0,
			rowID: "",
			posID: "",
			visible: true,
			burden: 0,
			spacing: 0,
			connectorCurve: 0
		};

		return hole;
	}

	// Step 30) Finalize a string into a KAD entity with unique name
	finalizeString(kadEntities, vertices) {
		if (vertices.length === 0) return;

		var stringNumber = vertices[0].stringNumber;

		// Step 31) Determine entity type
		var entityType = "poly";
		var isClosed = false;

		if (vertices.length === 1) {
			entityType = "point";
		} else if (vertices.length === 2) {
			entityType = "line";
		} else {
			var first = vertices[0];
			var last = vertices[vertices.length - 1];
			var tolerance = 0.001;

			isClosed = Math.abs(first.x - last.x) < tolerance && Math.abs(first.y - last.y) < tolerance && Math.abs(first.z - last.z) < tolerance;

			entityType = isClosed ? "poly" : "line";
		}

		var color = this.stringNumberToColor(stringNumber);

		// Step 32) Generate UNIQUE entity name
		var entityName = this.generateUniqueName(vertices, stringNumber, entityType, kadEntities);

		// Step 33) Create KAD entity
		var entity = {
			entityName: entityName,
			entityType: entityType,
			data: []
		};

		for (var i = 0; i < vertices.length; i++) {
			var v = vertices[i];

			var point = {
				entityName: entityName,
				entityType: entityType,
				pointID: i + 1,
				pointXLocation: v.x,
				pointYLocation: v.y,
				pointZLocation: v.z,
				lineWidth: 1,
				color: color,
				closed: isClosed && i === vertices.length - 1,
				visible: true
			};

			if (v.d1) {
				point.label = v.d1;
			}

			entity.data.push(point);
		}

		kadEntities.push(entity);
	}

	// Step 34) Generate unique entity name - ALWAYS unique for Kirra layers
	generateUniqueName(vertices, stringNumber, entityType, kadEntities) {
		this.entityCounter++;

		var firstVertex = vertices[0];
		var baseName = "";

		// Step 35) Try to extract meaningful name from description fields
		if (firstVertex.d1) {
			var d1 = firstVertex.d1;
			// Step 36) Check if D1 is numeric (point index) - if so, try D2
			if (/^\d+$/.test(d1)) {
				if (firstVertex.d2 && firstVertex.d2.length > 0) {
					baseName = firstVertex.d2;
				}
			} else {
				baseName = d1;
			}
		}

		// Step 37) If no meaningful name found, use type + string number
		if (!baseName) {
			var typePrefix = entityType === "poly" ? "Polygon" : entityType === "line" ? "Line" : entityType === "point" ? "Point" : "String";
			baseName = typePrefix + "_" + stringNumber;
		}

		// Step 38) Sanitize baseName - remove characters invalid in CSS selectors
		baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");

		// Step 38b) Always append unique counter to guarantee uniqueness
		var uniqueName = baseName + "_" + this.padNumber(this.entityCounter, 4);

		// Step 39) Double-check uniqueness via O(1) Set lookup (was O(n) Array.some scan)
		while (this.entityNameSet.has(uniqueName)) {
			this.entityCounter++;
			uniqueName = baseName + "_" + this.padNumber(this.entityCounter, 4);
		}

		this.entityNameSet.add(uniqueName);
		return uniqueName;
	}

	// =========================================================================
	// BINARY PARSING
	// =========================================================================

	// Step 40) Parse binary STR file
	async parseBinary(content) {
		// Step 41) Convert to ArrayBuffer if needed
		var buffer;
		if (typeof content === "string") {
			buffer = this.stringToArrayBuffer(content);
		} else if (content instanceof ArrayBuffer) {
			buffer = content;
		} else {
			throw new Error("Invalid binary content type");
		}

		// Step 42) Parse header
		var headerEnd = this.findBinaryHeaderEnd(buffer);
		var headerBytes = new Uint8Array(buffer, 0, headerEnd);
		var header = String.fromCharCode.apply(null, headerBytes);
		console.log("Binary STR header:", header.substring(0, 100));

		// Step 43) Parse binary data
		var bytes = new Uint8Array(buffer, headerEnd);
		var kadEntities = [];
		var blastHoles = [];
		var currentString = [];
		var currentHole = null;
		var holeCounter = 1;

		// Step 44) AUTO-DETECT: Determine format (1-byte vs 2-byte string#, and endianness)
		var format = this.detectBinaryFormat(bytes);
		var use2ByteStringNum = format.use2Byte;
		var littleEndian = format.littleEndian;
		console.log("Binary STR format: " + (use2ByteStringNum ? "2-byte" : "1-byte") + " string numbers, " + (littleEndian ? "little" : "big") + "-endian");

		var pos = 0;

		try {
			while (pos < bytes.length - 26) {
				// Step 45) Skip null padding to find next record
				var nullCount = 0;
				while (pos < bytes.length && bytes[pos] === 0x00) {
					pos++;
					nullCount++;
				}

				// Step 46) 8+ nulls indicates separator (end of string)
				if (nullCount >= 8 && currentString.length > 0) {
					this.finalizeString(kadEntities, currentString);
					currentString = [];
				}

				// Step 47) Check remaining bytes
				var minBytes = use2ByteStringNum ? 26 : 25;
				if (pos >= bytes.length - minBytes) break;

				// Step 48) Read string number (1-byte or 2-byte, with correct endianness)
				var stringNumber;
				if (use2ByteStringNum) {
					// 2-byte uint16 (supports string# 1-32000)
					if (littleEndian) {
						stringNumber = bytes[pos] | (bytes[pos + 1] << 8);
					} else {
						stringNumber = (bytes[pos] << 8) | bytes[pos + 1];
					}
					pos += 2;

					// Skip invalid/separator values
					if (stringNumber === 0 || stringNumber > 32000) {
						continue;
					}
				} else {
					// 1-byte (supports string# 1-255)
					stringNumber = bytes[pos];
					pos++;

					if (stringNumber === 0) {
						if (currentString.length > 0) {
							this.finalizeString(kadEntities, currentString);
							currentString = [];
						}
						continue;
					}
				}

				// Step 49) Read Y, X, Z as doubles (endianness from auto-detection)
				if (pos + 24 > bytes.length) break;

				var coordView = new DataView(bytes.buffer, bytes.byteOffset + pos);
				var y = coordView.getFloat64(0, littleEndian);
				var x = coordView.getFloat64(8, littleEndian);
				var z = coordView.getFloat64(16, littleEndian);
				pos += 24;

			// Step 50) Validate coordinates - must be reasonable values
			if (isNaN(x) || isNaN(y) || isNaN(z)) {
				continue;
			}

			// Step 50b) Reject garbage values - use full coordinate validation
			// This catches misaligned reads that produce denormalized floats (e-100, etc.)
			if (!this.isValidCoordinate(x, y, z)) {
				console.warn("Garbage coordinates at pos " + (pos - 24) + ", attempting re-sync...");
				// Step 50c) Re-sync: back up and scan for next 8+ null separator
				pos = pos - 24; // Go back to before the bad coordinates
				var resyncFound = false;
				while (pos < bytes.length - 32) {
					// Look for 8+ consecutive nulls (record separator)
					var nullRun = 0;
					while (pos + nullRun < bytes.length && bytes[pos + nullRun] === 0x00) {
						nullRun++;
					}
					if (nullRun >= 8) {
						pos += nullRun; // Skip past the nulls
						resyncFound = true;
						console.log("Re-synced at position " + pos);
						break;
					}
					pos++;
				}
				if (!resyncFound) {
					console.warn("Could not re-sync, stopping binary parse");
					break;
				}
				continue;
			}

				// Step 51) Read description safely - look for pattern: nulls + printable text + null
				var desc = "";
				
				// Step 51a) Check if there's a description (non-null byte within reasonable distance)
				var descStart = pos;
				var foundDesc = false;
				
				// Skip up to 8 padding nulls looking for description start
				while (descStart < bytes.length && descStart < pos + 8 && bytes[descStart] === 0x00) {
					descStart++;
				}
				
				// Step 51b) If we found a printable byte, read description
				if (descStart < bytes.length && bytes[descStart] >= 0x20 && bytes[descStart] <= 0x7e) {
					var descEnd = descStart;
					// Read printable ASCII until null or non-printable
					while (descEnd < bytes.length && descEnd < descStart + 512) {
						var byte = bytes[descEnd];
						if (byte >= 0x20 && byte <= 0x7e) {
							descEnd++;
						} else {
							break;
						}
					}
					desc = String.fromCharCode.apply(null, bytes.slice(descStart, descEnd)).trim();
					pos = descEnd;
					// Skip the null terminator
					if (pos < bytes.length && bytes[pos] === 0x00) {
						pos++;
					}
					foundDesc = true;
				}
				
				// Step 51c) If no description found, don't advance pos - let outer loop handle nulls

				// Step 54) Check if this is a blast hole (string# 1 with metadata)
				if (stringNumber === 1 && desc && desc.indexOf(",") !== -1 && desc.indexOf("DrillBlast") !== -1) {
					// Step 55) Finalize previous hole
					if (currentHole) {
						this.recalculateHoleGeometry(currentHole);
						blastHoles.push(currentHole);
					}
					// Step 56) Parse collar from binary metadata
					var metaParts = desc.split(",").map(function(p) {
						return p.trim();
					});
					var fullParts = ["1", y.toString(), x.toString(), z.toString()].concat(metaParts);
					currentHole = this.parseBlastHoleCollar(x, y, z, fullParts, holeCounter++);
				} else if (stringNumber === 1 && currentHole && !desc) {
					// Step 57) Toe line for current hole
					currentHole.endXLocation = x;
					currentHole.endYLocation = y;
					currentHole.endZLocation = z;
				} else {
					// Step 58) Regular geometry point
					currentString.push({
						stringNumber: stringNumber,
						x: x,
						y: y,
						z: z,
						d1: desc,
						d2: "",
						descriptions: desc ? [desc] : []
					});
				}
			}

			// Step 59) Finalize remaining data
			if (currentString.length > 0) {
				this.finalizeString(kadEntities, currentString);
			}
			if (currentHole) {
				this.recalculateHoleGeometry(currentHole);
				blastHoles.push(currentHole);
			}
		} catch (error) {
			console.warn("Error parsing binary STR at position " + pos + ":", error);
		}

		// Step 60z) Return appropriate format
		if (blastHoles.length > 0) {
			console.log("Parsed " + blastHoles.length + " blast holes from binary STR");
			return {
				blastHoles: blastHoles,
				kadEntities: kadEntities.length > 0 ? kadEntities : []
			};
		} else {
			console.log("Parsed " + kadEntities.length + " KAD entities from binary STR");
			return {
				kadEntities: kadEntities
			};
		}
	}

	// =========================================================================
	// UTILITY METHODS
	// =========================================================================
	// Step 61) Detect binary format: string number size (1 or 2 bytes) AND endianness
	// Returns: { use2Byte: boolean, littleEndian: boolean }
	detectBinaryFormat(bytes) {
		// Step 62) Find first non-null position after any initial padding
		var pos = 0;
		while (pos < bytes.length && bytes[pos] === 0x00) {
			pos++;
		}

		if (pos >= bytes.length - 26) {
			return { use2Byte: true, littleEndian: false }; // Default
		}

		// Step 63) Try all 4 combinations and find which produces valid coordinates
		var combinations = [
			{ use2Byte: true, littleEndian: false, name: "2-byte big-endian" },
			{ use2Byte: true, littleEndian: true, name: "2-byte little-endian" },
			{ use2Byte: false, littleEndian: false, name: "1-byte big-endian" },
			{ use2Byte: false, littleEndian: true, name: "1-byte little-endian" }
		];

		for (var i = 0; i < combinations.length; i++) {
			var combo = combinations[i];
			var offset = combo.use2Byte ? 2 : 1;
			var minBytes = combo.use2Byte ? 26 : 25;

			if (pos + minBytes > bytes.length) continue;

			// Step 64) Read string number
			var stringNum;
			if (combo.use2Byte) {
				if (combo.littleEndian) {
					stringNum = bytes[pos] | (bytes[pos + 1] << 8);
				} else {
					stringNum = (bytes[pos] << 8) | bytes[pos + 1];
				}
			} else {
				stringNum = bytes[pos];
			}

			// Step 65) Validate string number range
			if (stringNum <= 0 || stringNum > 32000) continue;

			// Step 66) Read coordinates with this endianness
			var view = new DataView(bytes.buffer, bytes.byteOffset + pos + offset);
			var y = view.getFloat64(0, combo.littleEndian);
			var x = view.getFloat64(8, combo.littleEndian);
			var z = view.getFloat64(16, combo.littleEndian);

			// Step 67) Check if coordinates are valid
			if (this.isValidCoordinate(x, y, z)) {
				console.log("Detected binary format: " + combo.name + " (string#=" + stringNum + ", coords: " + y.toFixed(3) + ", " + x.toFixed(3) + ", " + z.toFixed(3) + ")");
				return { use2Byte: combo.use2Byte, littleEndian: combo.littleEndian };
			}
		}

		console.warn("Could not auto-detect binary format, defaulting to 2-byte big-endian");
		return { use2Byte: true, littleEndian: false };
	}

	// Step 66) Check if coordinates are valid (any coordinate system)
	isValidCoordinate(x, y, z) {
		// Step 66a) Must be valid numbers
		if (isNaN(x) || isNaN(y) || isNaN(z)) {
			return false;
		}

		// Step 66b) Must not be infinity
		if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
			return false;
		}

		// Step 66c) Must be within reasonable range (not garbage from misaligned reads)
		// Most coordinate systems are within +/- 10 billion
		if (Math.abs(x) > 1e10 || Math.abs(y) > 1e10 || Math.abs(z) > 1e10) {
			return false;
		}

		// Step 66d) X and Y should have similar magnitude (within factor of 10000)
		// This catches misaligned reads where one value is garbage
		var xMag = Math.abs(x) > 1 ? Math.abs(x) : 1;
		var yMag = Math.abs(y) > 1 ? Math.abs(y) : 1;
		var ratio = xMag > yMag ? xMag / yMag : yMag / xMag;
		if (ratio > 10000) {
			return false;
		}

		// Step 66e) Z (elevation) should be much smaller than X/Y typically
		// But don't enforce this strictly - just check it's not wildly different
		// Skip this check as some mine grids have large Z values

		return true;
	}
	// Step 60) Recalculate hole geometry from collar-toe vector
	recalculateHoleGeometry(hole) {
		if (!hole.endXLocation || !hole.endYLocation || !hole.endZLocation || (hole.endXLocation === 0 && hole.endYLocation === 0 && hole.endZLocation === 0)) {
			return;
		}

		var deltaX = hole.endXLocation - hole.startXLocation;
		var deltaY = hole.endYLocation - hole.startYLocation;
		var deltaZ = hole.endZLocation - hole.startZLocation;

		var length = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
		if (length === 0) return;

		// Step 61) Calculate bearing (azimuth) from North
		var bearingRadians = Math.atan2(deltaX, deltaY);
		var bearing = bearingRadians * (180 / Math.PI);
		if (bearing < 0) bearing += 360;

		// Step 62) Calculate angle from vertical
		var angleRadians = Math.acos(Math.abs(deltaZ) / length);
		var angle = angleRadians * (180 / Math.PI);

		hole.holeBearing = bearing;
		hole.holeAngle = angle;
		hole.holeLengthCalculated = length;

		// Step 63) Calculate benchHeight and grade point
		hole.benchHeight = Math.abs(deltaZ) - hole.subdrillAmount;

		var radAngle = angle * (Math.PI / 180);
		var cosAngle = Math.cos(radAngle);
		var sinAngle = Math.sin(radAngle);
		var radBearing = (450 - bearing) % 360 * (Math.PI / 180);

		if (Math.abs(cosAngle) > 1e-9) {
			hole.subdrillLength = hole.subdrillAmount / cosAngle;
			var benchDrillLength = hole.benchHeight / cosAngle;
			hole.gradeZLocation = hole.startZLocation - hole.benchHeight;
			var horizontalProjectionToGrade = benchDrillLength * sinAngle;
			hole.gradeXLocation = hole.startXLocation + horizontalProjectionToGrade * Math.cos(radBearing);
			hole.gradeYLocation = hole.startYLocation + horizontalProjectionToGrade * Math.sin(radBearing);
		} else {
			hole.subdrillLength = 0;
			hole.gradeXLocation = hole.endXLocation;
			hole.gradeYLocation = hole.endYLocation;
			hole.gradeZLocation = hole.endZLocation;
		}
	}

	// Step 64) Detect if content is binary
	isBinaryContent(content) {
		var bytes;
		if (typeof content === "string") {
			for (var i = 0; i < Math.min(content.length, 500); i++) {
				var code = content.charCodeAt(i);
				if (code === 0) return true;
			}
			return false;
		} else if (content instanceof ArrayBuffer) {
			bytes = new Uint8Array(content);
		} else {
			return false;
		}

		var checkLength = Math.min(bytes.length, 1000);
		var nullCount = 0;
		var highByteCount = 0;
		var printableCount = 0;

		for (var i = 0; i < checkLength; i++) {
			var byte = bytes[i];
			if (byte === 0x00) nullCount++;
			if (byte > 127) highByteCount++;
			if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
				printableCount++;
			}
		}

		if (nullCount > checkLength * 0.05) return true;
		if (printableCount > checkLength * 0.9) return false;
		if (highByteCount > checkLength * 0.3) return true;

		return false;
	}

	// Step 65) Find end of binary header
	findBinaryHeaderEnd(buffer) {
		var view = new Uint8Array(buffer);
		var lineCount = 0;

		for (var i = 0; i < Math.min(view.length, 500); i++) {
			if (view[i] === 0x0a) {
				lineCount++;
				if (lineCount === 2) {
					return i + 1;
				}
			}
		}

		return 200;
	}

	// Step 66) Pad number with leading zeros
	padNumber(num, width) {
		var str = num.toString();
		while (str.length < width) {
			str = "0" + str;
		}
		return str;
	}

	// Step 67) Convert string number to color
	stringNumberToColor(stringNumber) {
		if (stringNumber === 0) {
			return "#000000";
		}

		var paletteIndex = Math.ceil(stringNumber / 32);

		var palette32 = ["#000000", "#770000", "#FF0000", "#FF9900", "#FFFF00", "#00FF00", "#009900", "#00FFFF", "#0099FF", "#0000FF", "#FF00FF", "#550000", "#AA0000", "#883300", "#BBBB00", "#33AA00", "#006600", "#007F7F", "#002288", "#000099", "#7F007F", "#010101", "#222222", "#333333", "#444444", "#555555", "#777777", "#888888", "#AAAAAA", "#CCCCCC", "#FEFEFE"];

		if (paletteIndex < 0) paletteIndex = 0;
		if (paletteIndex >= palette32.length) paletteIndex = palette32.length - 1;

		return palette32[paletteIndex];
	}

	// Step 68) Convert string to ArrayBuffer
	stringToArrayBuffer(str) {
		var buf = new ArrayBuffer(str.length);
		var bufView = new Uint8Array(buf);
		for (var i = 0; i < str.length; i++) {
			bufView[i] = str.charCodeAt(i) & 0xff;
		}
		return buf;
	}
}

export default SurpacSTRParser;
