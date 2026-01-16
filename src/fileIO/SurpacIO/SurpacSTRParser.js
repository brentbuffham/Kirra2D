// src/fileIO/SurpacIO/SurpacSTRParser.js
//=============================================================
// SURPAC STR PARSER - STRING FILE FORMAT
//=============================================================
// Step 1) Parses Surpac STR (String) format files
// Step 2) Supports Surpac 6.3 blast hole format with metadata
// Step 3) Format: Y, X, Z (Northing, Easting, Elevation order)
// Step 4) String numbers encode colors/types (1 = blast holes, 2-255 = colors)
// Step 5) Reference: blastholes.str, Surpac 6.3 documentation
// Step 6) Created: 2026-01-05

import BaseParser from "../BaseParser.js";
import SurpacBinarySTRParser from "./SurpacBinarySTRParser.js";

// Step 7) SurpacSTRParser class
class SurpacSTRParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	// Step 8) Main parse method
	async parse(content) {
		// Step 9) Validate input
		if (!content) {
			throw new Error("Invalid content: content required");
		}

		// Step 10) Binary detection disabled - only parse text format
		// TODO: Re-enable binary detection once binary format is properly tested
		// if (this.isBinaryContent(content)) {
		//     console.log("Detected binary STR format - delegating to binary parser");
		//     var binaryParser = new SurpacBinarySTRParser();
		//     return await binaryParser.parse(content);
		// }

		// Step 11) Parse as text format
		if (typeof content !== "string") {
			throw new Error("Invalid text content: string required");
		}

		// Step 10) Split into lines
		var lines = content.split(/\r?\n/);

		// Step 11) Initialize result containers
		// NOTE: This parser handles KAD geometry ONLY - blast holes use a separate parser
		var kadEntities = [];
		var currentString = [];
		var currentStringNumber = 0;
		var currentEntityName = "";
		var geometryMap = new Map(); // Group by entityName

		// Step 12) Parse header (skip first 2 lines)
		if (lines.length < 3) {
			throw new Error("Invalid STR file: too few lines");
		}

		// Skip header line (line 0)
		// Skip second line with zeros (line 1)

		// Step 13) Parse data lines
		for (var i = 2; i < lines.length; i++) {
			var line = lines[i].trim();

			// Step 14) Skip empty lines
			if (!line) continue;

			// Step 15) Parse line into parts (comma-separated)
			var parts = line.split(",").map(function(p) {
				return p.trim();
			});

			if (parts.length < 4) continue;

			// Step 16) Get string number and coordinates
			var stringNumber = parseInt(parts[0]);
			var y = parseFloat(parts[1]);
			var x = parseFloat(parts[2]);
			var z = parseFloat(parts[3]);

			// Step 16a) Validate coordinates - skip invalid data
			if (isNaN(stringNumber) || isNaN(x) || isNaN(y) || isNaN(z)) {
				console.warn("Skipping line " + (i + 1) + " - invalid coordinates:", line);
				continue;
			}

			// Step 17) Get entity name (D1 field) if present
			// Ignore D2 field (column 6) - only use column 5
			var entityName = parts.length > 4 ? parts[4].trim() : "";

			// Step 18) Check for separator or end marker
			if (stringNumber === 0) {
				// Separator or END marker
				if (parts[4] && parts[4].toUpperCase() === "END") {
					// End of file
					break;
				}

				// Step 19) Finalize current geometry string
				if (currentString.length > 0) {
					this.addGeometryToMap(geometryMap, currentString, currentStringNumber, currentEntityName);
					currentString = [];
					currentStringNumber = 0;
					currentEntityName = "";
				}

				continue;
			}

			// Step 20) KAD geometry (any string# 1-255)
			// This includes surface vertices (string# 1, Y, X, Z) and polylines (string# 2-255)
			// NOTE: Blast holes are handled by a separate dedicated parser

			// Check if starting new geometry (different string number or entity name)
			if (currentString.length > 0 && (currentStringNumber !== stringNumber || currentEntityName !== entityName)) {
				// Finalize previous geometry
				this.addGeometryToMap(geometryMap, currentString, currentStringNumber, currentEntityName);
				currentString = [];
			}

			// Add vertex to current string
			currentStringNumber = stringNumber;
			currentEntityName = entityName;
			currentString.push({
				x: x,
				y: y,
				z: z
			});
		}

		// Step 23) Finalize any remaining geometry
		if (currentString.length > 0) {
			this.addGeometryToMap(geometryMap, currentString, currentStringNumber, currentEntityName);
		}

		// Step 24) Convert geometryMap to kadEntities array
		kadEntities = this.convertGeometryMapToEntities(geometryMap);

		console.log("Parsed " + kadEntities.length + " KAD entities from STR");

		// Debug: Log entity structure to verify correctness
		if (kadEntities.length > 0) {
			console.log(
				"Entity names:",
				kadEntities
					.map(function(e) {
						return e.entityName;
					})
					.join(", ")
			);
			// Log first entity structure for verification
			var firstEntity = kadEntities[0];
			console.log("First entity structure:", {
				entityName: firstEntity.entityName,
				entityType: firstEntity.entityType,
				dataPointCount: firstEntity.data.length,
				firstPoint: firstEntity.data[0]
			});
		}

		// Step 25) Return parsed data
		// NOTE: This parser handles KAD geometry ONLY - blast holes use a separate dedicated parser
		return {
			kadEntities: kadEntities
		};
	}

	// Step 7a) Generate 4-character UID - uses global function if available
	generateUID() {
		// Use global function if available for consistency across codebase
		if (typeof window !== "undefined" && typeof window.generate4CharUID === "function") {
			return window.generate4CharUID();
		}
		// Fallback to local implementation
		var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
		var uid = "";
		for (var i = 0; i < 4; i++) {
			uid += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return uid;
	}

	// Add geometry to map, grouping by entity name
	addGeometryToMap(geometryMap, vertices, stringNumber, entityName) {
		if (vertices.length === 0) return;

		// Determine type based on vertex count and start/end match
		var isClosed = vertices.length > 2 && Math.abs(vertices[0].x - vertices[vertices.length - 1].x) < 0.001 && Math.abs(vertices[0].y - vertices[vertices.length - 1].y) < 0.001 && Math.abs(vertices[0].z - vertices[vertices.length - 1].z) < 0.001;

		// Generate entity name if not provided (empty D1 field)
		if (!entityName) {
			if (vertices.length === 1) {
				// Single point: use sequential numbering
				var pointNum = 1;
				while (geometryMap.has("surpac_pt_" + pointNum)) {
					pointNum++;
				}
				entityName = "surpac_pt_" + pointNum;
			} else if (isClosed) {
				// Closed polygon: use 4-char UID
				entityName = "surpac_poly_" + this.generateUID();
			} else {
				// Open line: use 4-char UID
				entityName = "surpac_line_" + this.generateUID();
			}
		} else {
			// D1 field provided: append 4-char UID
			entityName = entityName + "_" + this.generateUID();
		}

		// Ensure uniqueness (rare collision for UID-based names)
		var finalName = entityName;
		while (geometryMap.has(finalName)) {
			if (finalName.startsWith("surpac_pt_")) {
				// For points, increment the number
				var num = parseInt(finalName.replace("surpac_pt_", "")) + 1;
				finalName = "surpac_pt_" + num;
			} else {
				// For others, generate new UID
				finalName = finalName.replace(/_[a-z0-9]{4}$/, "_" + this.generateUID());
			}
		}

		// Create new entity in map with deep copy of vertices
		geometryMap.set(finalName, {
			entityName: finalName,
			stringNumber: stringNumber,
			vertices: vertices.map(function(v) {
				return { x: v.x, y: v.y, z: v.z };
			})
		});
	}

	// Convert geometry map to KAD entities array
	convertGeometryMapToEntities(geometryMap) {
		var entities = [];

		geometryMap.forEach(function(geom, entityName) {
			var vertices = geom.vertices;
			if (vertices.length === 0) return;

			// Determine entity type and closure status
			var entityType = "poly"; // Default
			var isClosed = false; // Initialize for all cases

			if (vertices.length === 1) {
				entityType = "point";
			} else if (vertices.length === 2) {
				entityType = "line";
			} else {
				// Check if closed (first vertex = last vertex)
				isClosed = Math.abs(vertices[0].x - vertices[vertices.length - 1].x) < 0.001 && Math.abs(vertices[0].y - vertices[vertices.length - 1].y) < 0.001 && Math.abs(vertices[0].z - vertices[vertices.length - 1].z) < 0.001;
				entityType = isClosed ? "poly" : "line";
			}

			// Convert string number to color
			var color = this.stringNumberToColor(geom.stringNumber);

			// Create KAD entity with EXACT structure matching user's specification
			// Entity level: ONLY entityName, entityType, data
			var entity = {
				entityName: entityName,
				entityType: entityType,
				data: vertices.map(function(v, index) {
					// Determine if this is the closing point
					var isLastPoint = index === vertices.length - 1;
					var isClosingPoint = isClosed && isLastPoint;

					var point = {
						entityName: entityName,
						entityType: entityType,
						pointID: index + 1, // INTEGER not string!
						pointXLocation: v.x,
						pointYLocation: v.y,
						pointZLocation: v.z,
						lineWidth: 1,
						color: color,
						closed: isClosingPoint
					};

					// Point entities need 'connected' field
					if (entityType === "point") {
						point.connected = false;
					}

					return point;
				})
			};

			entities.push(entity);
		}, this);

		return entities;
	}

	// Step 23) Parse blast hole collar line (Surpac 6.3 format)
	parseBlastHoleCollar(parts, holeIndex) {
		// Parts array:
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
		// 15: D12 - Unknown
		// 16: D13 - Empty
		// 17: D14 - Unknown

		var collarY = parseFloat(parts[1]);
		var collarX = parseFloat(parts[2]);
		var collarZ = parseFloat(parts[3]);

		// Parse metadata fields
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

		// Step 24) Convert Surpac dip to Kirra hole angle
		// Surpac: -90 = vertical down (dip), 0 = horizontal
		// Kirra: 0 = vertical down, 90 = horizontal (angle from vertical)
		// Conversion: Kirra angle = Surpac dip + 90
		// Example: Surpac -90° → Kirra 0° (vertical), Surpac 0° → Kirra 90° (horizontal)
		var holeAngle = dip + 90;

		// Step 25) Create BlastHole object
		var hole = {
			entityName: blastNameID,
			entityType: "hole",
			holeID: holeID.replace(/^0+/, "") || holeIndex.toString(), // Remove leading zeros
			startXLocation: collarX,
			startYLocation: collarY,
			startZLocation: collarZ,
			endXLocation: 0, // Will be set from toe line
			endYLocation: 0,
			endZLocation: 0,
			gradeXLocation: 0,
			gradeYLocation: 0,
			gradeZLocation: 0,
			subdrillAmount: subdrill, // Subdrill amount is the value from file
			subdrillLength: 0, // Subdrill length will be calculated
			benchHeight: 0,
			holeDiameter: diameter * 1000, // Convert meters to mm
			holeType: rigName,
			fromHoleID: blastNameID + ":::" + (holeID.replace(/^0+/, "") || holeIndex.toString()), // Format: "BlastName:::HoleID"
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
			holeTime: 0, // Changed from null to 0
			rowID: "", // Empty - will be calculated by Row/Pos scanner
			posID: "", // Empty - will be calculated by Row/Pos scanner
			visible: true,
			burden: 0,
			spacing: 0,
			connectorCurve: 0
		};

		return hole;
	}

	// Step 26) Recalculate hole geometry from collar-toe vector
	recalculateHoleGeometry(hole) {
		// Only recalculate if we have toe coordinates
		if (!hole.endXLocation || !hole.endYLocation || !hole.endZLocation || (hole.endXLocation === 0 && hole.endYLocation === 0 && hole.endZLocation === 0)) {
			return; // No toe data, keep original angle/bearing
		}

		// Calculate vector from collar to toe
		var deltaX = hole.endXLocation - hole.startXLocation;
		var deltaY = hole.endYLocation - hole.startYLocation;
		var deltaZ = hole.endZLocation - hole.startZLocation;

		// Calculate 3D length
		var length = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

		if (length === 0) {
			return; // Zero-length hole, keep original
		}

		// Calculate bearing (azimuth) from North
		// atan2(deltaX, deltaY) gives bearing where 0° = North, 90° = East
		var bearingRadians = Math.atan2(deltaX, deltaY);
		var bearing = bearingRadians * (180 / Math.PI);

		// Normalize to 0-360
		if (bearing < 0) {
			bearing += 360;
		}

		// Calculate angle from vertical
		// Angle from vertical = acos(|deltaZ| / length)
		// Use absolute value of deltaZ since we measure angle from vertical regardless of up/down
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
		var radBearing = (450 - bearing) % 360 * (Math.PI / 180);

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

		console.log("Recalculated hole " + hole.holeID + ": bearing=" + bearing.toFixed(2) + "°, angle=" + angle.toFixed(2) + "°, length=" + length.toFixed(3) + "m, benchHeight=" + hole.benchHeight.toFixed(2) + "m");
	}

	// Step 27) Finalize KAD string entity
	finalizeKADString(points, stringNumber, kadEntities) {
		if (points.length === 0) return;

		// Step 27) Determine entity type based on point count
		var entityType = "poly"; // Default to polyline
		if (points.length === 1) {
			entityType = "point";
		} else if (points.length === 2) {
			entityType = "line";
		}

		// Step 28) Convert string number to color
		var color = this.stringNumberToColor(stringNumber);

		// Step 29) Create KAD entity
		var entity = {
			entityName: "STR_String_" + stringNumber,
			entityType: entityType,
			color: color,
			visible: true,
			data: points.map(function(p, index) {
				return {
					pointID: index.toString(),
					pointXLocation: p.x,
					pointYLocation: p.y,
					pointZLocation: p.z
				};
			})
		};

		kadEntities.push(entity);
	}

	// Step 30) Convert Surpac string number to hex color
	stringNumberToColor(stringNumber) {
		// Handle separator (string# 0) - map to black
		if (stringNumber === 0) {
			return "#000000";
		}

		// Convert to 32-color palette index: Math.ceil(stringNumber / 32)
		// String#   1-32  → Math.ceil(1/32) to Math.ceil(32/32) = 1 → Position 1 (index 1)
		// String#  33-64  → Math.ceil(33/32) to Math.ceil(64/32) = 2 → Position 2 (index 2)
		// String# 481-512 → Math.ceil(481/32) to Math.ceil(512/32) = 16 → Position 16 (index 16)
		var paletteIndex = Math.ceil(stringNumber / 32);

		// Kirra 32-color palette (from jscolor configuration)
		var palette32 = [
			"#000000", // Position 0 (separator/default) - Black
			"#770000", // Position 1 (String# 1-32) - Dark Red
			"#FF0000", // Position 2 - Red
			"#FF9900", // Position 3 - Orange
			"#FFFF00", // Position 4 - Yellow
			"#00ff00", // Position 5 - Lime Green
			"#009900", // Position 6 - Green
			"#00ffFF", // Position 7 - Cyan
			"#0099ff", // Position 8 - Sky Blue
			"#0000FF", // Position 9 - Blue
			"#FF00FF", // Position 10 - Magenta
			"#550000", // Position 11 - Dark Maroon
			"#AA0000", // Position 12 - Dark Red
			"#883300", // Position 13 - Brown
			"#bbbb00", // Position 14 - Olive
			"#33AA00", // Position 15 - Forest Green
			"#006600", // Position 16 - Dark Green (String# 511 maps here)
			"#007F7F", // Position 17 - Teal
			"#002288", // Position 18 - Navy Blue
			"#000099", // Position 19 - Dark Blue
			"#7F007F", // Position 20 - Purple
			"#010101", // Position 21 - Almost Black
			"#222222", // Position 22 - Very Dark Gray
			"#333333", // Position 23 - Dark Gray
			"#444444", // Position 24 - Gray
			"#555555", // Position 25 - Medium Gray
			"#777777", // Position 26 - Light Gray
			"#888888", // Position 27 - Silver
			"#AAAAAA", // Position 28 - Light Silver
			"#cccccc", // Position 29 - Very Light Gray
			"#FEFEFE" // Position 30 - Almost White
		];

		// Clamp palette index to valid range
		if (paletteIndex < 0) paletteIndex = 0;
		if (paletteIndex >= palette32.length) paletteIndex = palette32.length - 1;

		return palette32[paletteIndex];
	}

	// Step 33) Convert HSL to hex color
	hslToHex(h, s, l) {
		s /= 100;
		l /= 100;

		var c = (1 - Math.abs(2 * l - 1)) * s;
		var x = c * (1 - Math.abs(h / 60 % 2 - 1));
		var m = l - c / 2;
		var r = 0,
			g = 0,
			b = 0;

		if (0 <= h && h < 60) {
			r = c;
			g = x;
			b = 0;
		} else if (60 <= h && h < 120) {
			r = x;
			g = c;
			b = 0;
		} else if (120 <= h && h < 180) {
			r = 0;
			g = c;
			b = x;
		} else if (180 <= h && h < 240) {
			r = 0;
			g = x;
			b = c;
		} else if (240 <= h && h < 300) {
			r = x;
			g = 0;
			b = c;
		} else if (300 <= h && h < 360) {
			r = c;
			g = 0;
			b = x;
		}

		var rHex = Math.round((r + m) * 255).toString(16).padStart(2, "0");
		var gHex = Math.round((g + m) * 255).toString(16).padStart(2, "0");
		var bHex = Math.round((b + m) * 255).toString(16).padStart(2, "0");

		return "#" + rHex + gHex + bHex;
	}

	// Step 34) Detect if content is binary
	isBinaryContent(content) {
		// Convert ArrayBuffer to Uint8Array for inspection
		var bytes;
		if (typeof content === "string") {
			// String content - check directly
			for (var i = 0; i < Math.min(content.length, 500); i++) {
				var code = content.charCodeAt(i);
				// Null bytes indicate binary
				if (code === 0) return true;
			}
			return false;
		} else if (content instanceof ArrayBuffer) {
			// ArrayBuffer - need to inspect bytes
			bytes = new Uint8Array(content);
		} else {
			// Unknown format
			return false;
		}

		// Check first 1000 bytes for binary patterns
		var checkLength = Math.min(bytes.length, 1000);
		var nullCount = 0;
		var highByteCount = 0;
		var printableCount = 0;

		for (var i = 0; i < checkLength; i++) {
			var byte = bytes[i];

			// Count null bytes
			if (byte === 0x00) {
				nullCount++;
			}

			// Count high bytes (>127)
			if (byte > 127) {
				highByteCount++;
			}

			// Count printable ASCII (space to ~, plus newlines/tabs)
			if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
				printableCount++;
			}
		}

		// If more than 5% null bytes, it's binary
		if (nullCount > checkLength * 0.05) {
			return true;
		}

		// If more than 90% printable ASCII, it's text
		if (printableCount > checkLength * 0.9) {
			return false;
		}

		// If more than 30% high bytes, it's binary
		if (highByteCount > checkLength * 0.3) {
			return true;
		}

		// Default: assume text
		return false;
	}
}

export default SurpacSTRParser;
