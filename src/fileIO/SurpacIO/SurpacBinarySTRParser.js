// src/fileIO/SurpacIO/SurpacBinarySTRParser.js
//=============================================================
// SURPAC BINARY STR PARSER - STRING FILE (BINARY)
//=============================================================
// Step 1) Parses binary Surpac STR files (vertices)
// Step 2) Format: Text header (2 lines) + binary vertex data
// Step 3) Binary format: separator + flag + Y + X + Z + description
// Step 4) Reference: mka_pd_stg4_202406_v1.str
// Step 5) Created: 2026-01-05

import BaseParser from "../BaseParser.js";

// Step 6) SurpacBinarySTRParser class
class SurpacBinarySTRParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	// Step 7) Main parse method
	async parse(content) {
		// Step 8) Validate input (content should be ArrayBuffer for binary)
		if (!content) {
			throw new Error("Invalid content: ArrayBuffer or string required");
		}

		// Step 9) Handle both ArrayBuffer and string inputs
		var buffer;
		if (typeof content === "string") {
			// Convert string to ArrayBuffer
			buffer = this.stringToArrayBuffer(content);
		} else if (content instanceof ArrayBuffer) {
			buffer = content;
		} else {
			throw new Error("Invalid content type: ArrayBuffer or string expected");
		}

		// Step 10) Parse header (first 2 lines are text)
		var headerEnd = this.findHeaderEnd(buffer);
		var headerBytes = new Uint8Array(buffer, 0, headerEnd);
		var header = String.fromCharCode.apply(null, headerBytes);

		console.log("Binary STR header:", header.substring(0, 100));

		// Step 11) Parse binary data (could be vertices or blast holes)
		var parsedData = this.parseBinaryData(buffer, headerEnd);

		if (parsedData.blastHoles) {
			console.log("Parsed " + parsedData.blastHoles.length + " blast holes from binary STR");
		} else if (parsedData.vertices) {
			console.log("Parsed " + parsedData.vertices.length + " vertices from binary STR");
		}

		// Step 12) Return appropriate data format
		return parsedData;
	}

	// Step 13) Find end of text header
	findHeaderEnd(buffer) {
		var view = new Uint8Array(buffer);
		var lineCount = 0;
		var lastNewline = -1;

		// Find the second newline (end of line 2)
		for (var i = 0; i < Math.min(view.length, 500); i++) {
			if (view[i] === 0x0A) { // LF
				lineCount++;
				lastNewline = i;
				if (lineCount === 2) {
					// Check if followed by null bytes (start of binary data)
					if (i + 1 < view.length && view[i + 1] === 0x00) {
						return i + 1;
					}
					return i + 1;
				}
			}
		}

		return lastNewline + 1 || 200;
	}

	// Step 14) Parse binary data (vertices or blast holes)
	parseBinaryData(buffer, offset) {
		var view = new DataView(buffer, offset);
		var bytes = new Uint8Array(buffer, offset);
		var vertices = [];
		var blastHoles = [];
		var currentHole = null;
		var holeCounter = 1;
		var pos = 0;

		try {
			while (pos < view.byteLength - 40) {
				// Step 15) Skip any null padding bytes to find next record
				while (pos < view.byteLength && bytes[pos] === 0x00) {
					pos++;
				}

				// Step 16) Check if we have enough bytes left
				if (pos >= view.byteLength - 40) break;

				// Step 17) Read string number byte (should be 1-255)
				var stringNumber = bytes[pos];
				pos += 1;

				// Skip if string number is 0 or too high (invalid/separator)
				if (stringNumber === 0 || stringNumber > 255) {
					continue;
				}

				// Step 18) Read Y, X, Z as doubles (little-endian)
				if (pos + 24 > view.byteLength) break;

				var y = view.getFloat64(pos, true);
				pos += 8;

				var x = view.getFloat64(pos, true);
				pos += 8;

				var z = view.getFloat64(pos, true);
				pos += 8;

				// Step 19) Validate coordinates
				if (isNaN(x) || isNaN(y) || isNaN(z)) {
					continue;
				}

				// Step 20) Read description string (variable length, null-terminated or until next separator)
				var description = "";
				var descStart = pos;
				var maxDescLength = 500;

				for (var j = 0; j < maxDescLength && pos < bytes.length; j++) {
					var byte = bytes[pos];

					// Stop at null byte or if we find 8 consecutive nulls (next separator)
					if (byte === 0x00) {
						// Check if this is start of next separator (8 nulls)
						var isNextSeparator = true;
						for (var k = 0; k < 8 && pos + k < bytes.length; k++) {
							if (bytes[pos + k] !== 0x00) {
								isNextSeparator = false;
								break;
							}
						}

						if (isNextSeparator) {
							// Found next separator, stop here
							break;
						}
					}

					if (byte >= 0x20 && byte <= 0x7E) {
						// Printable ASCII character
						description += String.fromCharCode(byte);
						pos++;
					} else if (byte === 0x00 || byte === 0x0D || byte === 0x0A) {
						// Null, CR, or LF terminator
						pos++;
						if (byte === 0x0D && pos < bytes.length && bytes[pos] === 0x0A) {
							pos++; // Skip LF after CR
						}
						break;
					} else {
						// Non-printable, stop
						break;
					}
				}

				// Step 21) Process based on string number
				if (stringNumber === 1) {
					// Blast hole record
					var desc = description.trim();
					if (desc && desc.indexOf(",") !== -1) {
						// This is a collar line with metadata
						if (currentHole) {
							// Finalize previous hole before starting new one
							this.recalculateHoleGeometry(currentHole);
							blastHoles.push(currentHole);
						}
						currentHole = this.parseBlastHoleCollar(x, y, z, desc, holeCounter++);
					} else if (currentHole) {
						// This is a toe line (just coordinates, no metadata)
						currentHole.endXLocation = x;
						currentHole.endYLocation = y;
						currentHole.endZLocation = z;
					}
				} else {
					// Surface vertex or other geometry
					vertices.push({
						x: x,
						y: y,
						z: z,
						description: description.trim(),
						stringNumber: stringNumber
					});
				}
			}

			// Finalize last hole if exists
			if (currentHole) {
				this.recalculateHoleGeometry(currentHole);
				blastHoles.push(currentHole);
			}

		} catch (error) {
			console.warn("Error parsing binary STR at position " + pos + ":", error);
		}

		// Return appropriate format based on what was parsed
		if (blastHoles.length > 0) {
			return {
				blastHoles: blastHoles,
				kadEntities: []
			};
		} else {
			return {
				vertices: vertices
			};
		}
	}

	// Parse blast hole collar from coordinates and metadata string
	parseBlastHoleCollar(collarX, collarY, collarZ, metadataString, holeIndex) {
		// Parse metadata: "DrillBlast1.1,BLASTID,00001,13.500,0.229,,Rig-1,1.500,0.0000,-90.0000,BLASTMETHOD,0.000,,0.000"
		var parts = metadataString.split(",").map(function(p) { return p.trim(); });

		var blastDesignID = parts[0] || "";
		var blastNameID = parts[1] || "BLASTID";
		var holeID = parts[2] || holeIndex.toString();
		var plannedDepth = parseFloat(parts[3]) || 0;
		var diameter = parseFloat(parts[4]) || 0; // In meters
		var rigName = parts[6] || "Undefined";
		var subdrill = parseFloat(parts[7]) || 0;
		var bearing = parseFloat(parts[8]) || 0;
		var dip = parseFloat(parts[9]) || -90; // Surpac dip (negative = down)
		var blastMethod = parts[10] || "METHOD";

		// Convert Surpac dip to Kirra hole angle
		// Surpac: -90 = vertical down, 0 = horizontal
		// Kirra: 0 = vertical down, 90 = horizontal
		var holeAngle = dip + 90;

		var cleanHoleID = holeID.replace(/^0+/, "") || holeIndex.toString();

		var hole = {
			entityName: blastNameID,
			entityType: "hole",
			holeID: cleanHoleID,
			startXLocation: collarX,
			startYLocation: collarY,
			startZLocation: collarZ,
			endXLocation: 0, // Will be set from toe line
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

	// Recalculate hole geometry from collar-toe vector
	recalculateHoleGeometry(hole) {
		// Only recalculate if we have toe coordinates
		if (!hole.endXLocation || !hole.endYLocation || !hole.endZLocation ||
			hole.endXLocation === 0 && hole.endYLocation === 0 && hole.endZLocation === 0) {
			return;
		}

		// Calculate vector from collar to toe
		var deltaX = hole.endXLocation - hole.startXLocation;
		var deltaY = hole.endYLocation - hole.startYLocation;
		var deltaZ = hole.endZLocation - hole.startZLocation;

		// Calculate 3D length
		var length = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

		if (length === 0) {
			return;
		}

		// Calculate bearing (azimuth) from North
		var bearingRadians = Math.atan2(deltaX, deltaY);
		var bearing = bearingRadians * (180 / Math.PI);
		if (bearing < 0) bearing += 360;

		// Calculate angle from vertical
		var angleRadians = Math.acos(Math.abs(deltaZ) / length);
		var angle = angleRadians * (180 / Math.PI);

		// Update hole with calculated values
		hole.holeBearing = bearing;
		hole.holeAngle = angle;
		hole.holeLengthCalculated = length;

		// Calculate benchHeight (vertical drop minus subdrill)
		hole.benchHeight = Math.abs(deltaZ) - hole.subdrillAmount;

		// Calculate gradeXYZ and subdrillLength using geometry
		var radAngle = angle * (Math.PI / 180);
		var cosAngle = Math.cos(radAngle);
		var sinAngle = Math.sin(radAngle);
		var radBearing = ((450 - bearing) % 360) * (Math.PI / 180);

		if (Math.abs(cosAngle) > 1e-9) {
			// Calculate subdrill length along hole axis
			hole.subdrillLength = hole.subdrillAmount / cosAngle;

			// Calculate grade point (toe without subdrill)
			var benchDrillLength = hole.benchHeight / cosAngle;
			hole.gradeZLocation = hole.startZLocation - hole.benchHeight;
			var horizontalProjectionToGrade = benchDrillLength * sinAngle;
			hole.gradeXLocation = hole.startXLocation + horizontalProjectionToGrade * Math.cos(radBearing);
			hole.gradeYLocation = hole.startYLocation + horizontalProjectionToGrade * Math.sin(radBearing);
		} else {
			// Horizontal hole (angle = 90°)
			hole.subdrillLength = 0;
			hole.gradeXLocation = hole.endXLocation;
			hole.gradeYLocation = hole.endYLocation;
			hole.gradeZLocation = hole.endZLocation;
		}

		console.log("Recalculated binary hole " + hole.holeID + ": bearing=" + bearing.toFixed(2) + "°, angle=" + angle.toFixed(2) + "°, length=" + length.toFixed(3) + "m");
	}

	// Step 22) Convert string to ArrayBuffer
	stringToArrayBuffer(str) {
		var buf = new ArrayBuffer(str.length);
		var bufView = new Uint8Array(buf);
		for (var i = 0; i < str.length; i++) {
			bufView[i] = str.charCodeAt(i) & 0xFF;
		}
		return buf;
	}
}

export default SurpacBinarySTRParser;
