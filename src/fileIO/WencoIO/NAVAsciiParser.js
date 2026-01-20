// src/fileIO/WencoIO/NAVAsciiParser.js
//=============================================================
// WENCO NAV ASCII PARSER
//=============================================================
// Step 1) Parse Wenco NAV ASCII files for fleet management
// Step 2) Format: HEADER VERSION,1 followed by TEXT/POINT/LINE records
// Step 3) Reference: BRENTBUFFHAM_FiletoASCII-NAV.pm
// Step 4) Created: 2026-01-07

import BaseParser from "../BaseParser.js";

export default class NAVAsciiParser extends BaseParser {
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
			throw new Error("NAV ASCII Parser requires text content");
		}

		// Step 7a) Check for binary content (Wenco NAV should be ASCII text only)
		if (this.isBinaryContent(content)) {
			throw new Error("Binary NAV files are not supported. Only ASCII/text-based NAV files can be imported. Please use an ASCII NAV export from Wenco.");
		}

		// Step 8) Get filename for entity name
		var filename = file.name || "unknown.nav";
		var entityName = filename.replace(/\.nav$/i, "");

		// Step 9) Parse NAV data
		var result = this.parseNAVData(content, entityName);

		return result;
	}

	// Step 10) Parse NAV data string
	parseNAVData(data, entityName) {
		// Step 11) Split into lines
		var lines = data.split(/\r?\n/);
		var entities = [];
		var trianglesByLayer = {}; // Group triangles by layer name for surface creation
		var warnings = [];

		// Step 12) Process each line
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();

			// Step 13) Skip empty lines
			if (!line) continue;

			// Step 14) Check for header
			if (line.toUpperCase().startsWith("HEADER VERSION")) {
				continue; // Skip header line
			}

			// Step 15) Parse record based on type
			try {
				if (line.toUpperCase().startsWith("TEXT")) {
					var textEntity = this.parseTextRecord(line, entityName);
					if (textEntity) entities.push(textEntity);
				} else if (line.toUpperCase().startsWith("POINT")) {
					var pointEntity = this.parsePointRecord(line, entityName);
					if (pointEntity) entities.push(pointEntity);
				} else if (line.toUpperCase().startsWith("LINE")) {
					var lineEntity = this.parseLineRecord(line, entityName);
					if (lineEntity) entities.push(lineEntity);
				} else if (line.toUpperCase().startsWith("TRIANGLE")) {
					// Parse triangle and group by layer for surface creation
					var triangleData = this.parseTriangleForSurface(line, entityName);
					if (triangleData) {
						var layer = triangleData.layer;
						if (!trianglesByLayer[layer]) {
							trianglesByLayer[layer] = {
								triangles: [],
								color: triangleData.color,
								colorHex: triangleData.colorHex
							};
						}
						trianglesByLayer[layer].triangles.push(triangleData.triangle);
					}
				} else {
					warnings.push("Line " + (i + 1) + ": Unknown record type - " + line.substring(0, 30));
				}
			} catch (error) {
				warnings.push("Line " + (i + 1) + ": Error parsing - " + error.message);
			}
		}

		// Step 16) Create surface objects from grouped triangles
		var surfaces = [];
		for (var layer in trianglesByLayer) {
			if (trianglesByLayer.hasOwnProperty(layer)) {
				var layerData = trianglesByLayer[layer];

				// Step 16a) Extract all vertices for surface bounds
				var vertices = [];
				for (var ti = 0; ti < layerData.triangles.length; ti++) {
					var triangle = layerData.triangles[ti];
					vertices.push(triangle.vertices[0]);
					vertices.push(triangle.vertices[1]);
					vertices.push(triangle.vertices[2]);
				}

				// Step 16a.1) Calculate meshBounds from vertices for centroid calculation
				// CRITICAL: Without meshBounds, centroid calculation cannot use this surface data
				var minX = Infinity, maxX = -Infinity;
				var minY = Infinity, maxY = -Infinity;
				var minZ = Infinity, maxZ = -Infinity;
				for (var vi = 0; vi < vertices.length; vi++) {
					var v = vertices[vi];
					if (v.x < minX) minX = v.x;
					if (v.x > maxX) maxX = v.x;
					if (v.y < minY) minY = v.y;
					if (v.y > maxY) maxY = v.y;
					if (v.z < minZ) minZ = v.z;
					if (v.z > maxZ) maxZ = v.z;
				}
				var meshBounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ };

				// Step 16b) Create surface object with hillshade coloring
				var surface = {
					name: entityName + "_" + layer,
					visible: true,
					gradient: "hillshade", // Use hillshade rendering mode
					hillshadeColor: layerData.colorHex, // Use TRIANGLE color from NAV
					transparency: 1.0,
					triangles: layerData.triangles,
					points: vertices,
					meshBounds: meshBounds, // CRITICAL: Add meshBounds for centroid calculation
					vertexCount: vertices.length,
					triangleCount: layerData.triangles.length
				};

				surfaces.push(surface);
			}
		}

		return {
			entities: entities,
			surfaces: surfaces,
			warnings: warnings
		};
	}

	// Step 16) Parse TEXT record
	// Format: TEXT,color,layer,fontsize,text_value,rotation x,y,z
	// Example: TEXT,1,DISPLAY,10.000000,Some_Text,0.000000 123.456,789.012,345.678
	parseTextRecord(line, entityName) {
		// Split on space to separate metadata from coordinates
		var spaceIndex = line.lastIndexOf(" ");
		if (spaceIndex === -1) {
			throw new Error("TEXT record missing coordinate data");
		}

		var metadata = line.substring(0, spaceIndex);
		var coordString = line.substring(spaceIndex + 1).trim();

		// Parse metadata: TEXT,color,layer,fontsize,text_value,rotation
		var parts = metadata.split(",");
		if (parts.length < 6) {
			throw new Error("TEXT record requires at least 6 metadata fields");
		}

		var color = parseInt(parts[1]) || 1;
		var layer = parts[2] || "DEFAULT";
		var fontsize = parseFloat(parts[3]) || 1.0;
		var text = parts[4] || "";
		var rotation = parseFloat(parts[5]) || 0;

		// Parse coordinates: x,y,z
		var coords = coordString.split(",");
		if (coords.length < 3) {
			throw new Error("TEXT record requires x,y,z coordinates");
		}

		var x = parseFloat(coords[0]) || 0;
		var y = parseFloat(coords[1]) || 0;
		var z = parseFloat(coords[2]) || 0;

		// Step 17) Replace underscores with spaces in text
		text = text.replace(/_/g, " ");

		// Step 18) Create KAD text entity
		return {
			entityType: "text",
			entityName: entityName + "_" + layer,
			layer: layer,
			points: [{ x: x, y: y, z: z }],
			text: text,
			textSize: fontsize,
			rotation: rotation,
			color: color,
			colorHexDecimal: this.colorToHex(color),
			visible: true,
			connected: false,
			closed: false
		};
	}

	// Step 19) Parse POINT record
	// Format: POINT,color,layer,,0.000000,0.000000 x,y,z 0.000000,0.000000,0.000000
	// Example: POINT,1,DEFAULT,,0.000000,0.000000 123.456,789.012,345.678 0.000000,0.000000,0.000000
	parsePointRecord(line, entityName) {
		// Split on first comma to get type
		var firstComma = line.indexOf(",");
		var rest = line.substring(firstComma + 1);

		// Get color (next field)
		var secondComma = rest.indexOf(",");
		var color = parseInt(rest.substring(0, secondComma)) || 1;
		rest = rest.substring(secondComma + 1);

		// Get layer (next field)
		var thirdComma = rest.indexOf(",");
		var layer = rest.substring(0, thirdComma) || "DEFAULT";
		rest = rest.substring(thirdComma + 1);

		// Now split on space to get coordinate groups
		var coordGroups = rest.split(/\s+/);
		if (coordGroups.length < 1) {
			throw new Error("POINT record missing coordinate data");
		}

		// First coordinate group after the padding fields (,,0.000000,0.000000) is the actual point
		// Find first group with 3 comma-separated values
		var coords = null;
		for (var i = 0; i < coordGroups.length; i++) {
			var parts = coordGroups[i].split(",");
			if (parts.length === 3) {
				coords = parts;
				break;
			}
		}

		if (!coords) {
			throw new Error("POINT record requires x,y,z coordinates");
		}

		var x = parseFloat(coords[0]) || 0;
		var y = parseFloat(coords[1]) || 0;
		var z = parseFloat(coords[2]) || 0;

		// Step 20) Create KAD point entity
		return {
			entityType: "point",
			entityName: entityName + "_" + layer,
			layer: layer,
			points: [{ x: x, y: y, z: z }],
			color: color,
			colorHexDecimal: this.colorToHex(color),
			visible: true,
			connected: false,
			closed: false
		};
	}

	// Step 21) Parse LINE record
	// Format: LINE,color,layer x1,y1,z1 x2,y2,z2 x3,y3,z3 ...
	// Example: LINE,1,DEFAULT 123.456,789.012,345.678 234.567,890.123,456.789
	parseLineRecord(line, entityName) {
		// Split on first comma to get type
		var firstComma = line.indexOf(",");
		var rest = line.substring(firstComma + 1);

		// Get color (next field)
		var secondComma = rest.indexOf(",");
		var color = parseInt(rest.substring(0, secondComma)) || 1;
		rest = rest.substring(secondComma + 1);

		// Get layer (next field) - ends at first space
		var spaceIndex = rest.indexOf(" ");
		var layer = rest.substring(0, spaceIndex) || "DEFAULT";
		rest = rest.substring(spaceIndex + 1);

		// Rest is coordinate data: space-separated triplets like "x1,y1,z1 x2,y2,z2 x3,y3,z3"
		var coordGroups = rest.trim().split(/\s+/);
		if (coordGroups.length < 2) {
			throw new Error("LINE record requires at least 2 coordinate triplets");
		}

		// Step 22) Parse each coordinate triplet
		var points = [];
		for (var i = 0; i < coordGroups.length; i++) {
			var coords = coordGroups[i].split(",");
			if (coords.length === 3) {
				var x = parseFloat(coords[0]) || 0;
				var y = parseFloat(coords[1]) || 0;
				var z = parseFloat(coords[2]) || 0;
				points.push({ x: x, y: y, z: z });
			}
		}

		if (points.length < 2) {
			throw new Error("LINE record requires at least 2 valid points");
		}

		// Step 23) Check if line is closed (first point equals last point)
		var closed = false;
		if (points.length > 2) {
			var first = points[0];
			var last = points[points.length - 1];
			var tolerance = 0.001;

			if (
				Math.abs(first.x - last.x) < tolerance &&
				Math.abs(first.y - last.y) < tolerance &&
				Math.abs(first.z - last.z) < tolerance
			) {
				closed = true;
			}
		}

		// Step 24) Create KAD line/poly entity
		return {
			entityType: closed ? "poly" : "line",
			entityName: entityName + "_" + layer,
			layer: layer,
			points: points,
			color: color,
			colorHexDecimal: this.colorToHex(color),
			visible: true,
			connected: true,
			closed: closed
		};
	}

	// Step 25) Parse TRIANGLE record for surface creation
	// Format: TRIANGLE,color,layer x1,y1,z1 x2,y2,z2 x3,y3,z3
	// Example: TRIANGLE,9,SURF 123.456,789.012,345.678 234.567,890.123,456.789 345.678,901.234,567.890
	// Returns: { layer, color, colorHex, triangle } for surface grouping
	parseTriangleForSurface(line, entityName) {
		// Split on first comma to get type
		var firstComma = line.indexOf(",");
		var rest = line.substring(firstComma + 1);

		// Get color (next field)
		var secondComma = rest.indexOf(",");
		var color = parseInt(rest.substring(0, secondComma)) || 9;
		rest = rest.substring(secondComma + 1);

		// Get layer (next field) - find space after layer name
		var spaceIndex = rest.indexOf(" ");
		var layer = rest.substring(0, spaceIndex) || "SURF";
		rest = rest.substring(spaceIndex + 1);

		// Rest is coordinate data: space-separated triplets like "x1,y1,z1 x2,y2,z2 x3,y3,z3"
		var coordGroups = rest.trim().split(/\s+/);
		if (coordGroups.length < 3) {
			throw new Error("TRIANGLE record requires exactly 3 coordinate triplets");
		}

		// Step 26) Parse each coordinate triplet (must be exactly 3)
		var vertices = [];
		for (var i = 0; i < 3; i++) {
			var coords = coordGroups[i].split(",");
			if (coords.length === 3) {
				var x = parseFloat(coords[0]) || 0;
				var y = parseFloat(coords[1]) || 0;
				var z = parseFloat(coords[2]) || 0;
				vertices.push({ x: x, y: y, z: z });
			}
		}

		if (vertices.length !== 3) {
			throw new Error("TRIANGLE record requires exactly 3 valid points");
		}

		// Step 27) Return triangle data for surface creation
		return {
			layer: layer,
			color: color,
			colorHex: this.colorToHex(color),
			triangle: {
				vertices: vertices
			}
		};
	}

	// Step 28) Convert AutoCAD Color Index (ACI) to hex color
	colorToHex(colorIndex) {
		// Step 29) Full AutoCAD ACI color palette (first 50 colors)
		var aciPalette = [
			"#000000", // 0 - ByBlock (black)
			"#FF0000", // 1 - Red
			"#FFFF00", // 2 - Yellow
			"#00FF00", // 3 - Green
			"#00FFFF", // 4 - Cyan
			"#0000FF", // 5 - Blue
			"#FF00FF", // 6 - Magenta
			"#FFFFFF", // 7 - White/Black (context dependent)
			"#808080", // 8 - Dark Gray
			"#C0C0C0", // 9 - Light Gray
			"#FF0000", // 10 - Red
			"#FF7F7F", // 11 - Light Red
			"#CC0000", // 12 - Dark Red
			"#990000", // 13 - Darker Red
			"#660000", // 14 - Very Dark Red
			"#330000", // 15 - Almost Black Red
			"#FF3F00", // 16 - Red-Orange
			"#FF7F00", // 17 - Orange
			"#FFBF00", // 18 - Yellow-Orange
			"#FFFF00", // 19 - Yellow
			"#BFFF00", // 20 - Yellow-Green
			"#7FFF00", // 21 - Light Green
			"#3FFF00", // 22 - Green-Yellow
			"#00FF00", // 23 - Green
			"#00FF3F", // 24 - Green-Cyan
			"#00FF7F", // 25 - Cyan-Green
			"#00FFBF", // 26 - Light Cyan
			"#00FFFF", // 27 - Cyan
			"#00BFFF", // 28 - Cyan-Blue
			"#007FFF", // 29 - Light Blue
			"#BD5A00", // 30 - Orange (Wenco standard)
			"#0000FF", // 31 - Blue
			"#3F00FF", // 32 - Blue-Magenta
			"#7F00FF", // 33 - Purple
			"#BF00FF", // 34 - Magenta-Blue
			"#FF00FF", // 35 - Magenta
			"#FF00BF", // 36 - Magenta-Red
			"#FF007F", // 37 - Pink
			"#FF003F", // 38 - Red-Magenta
			"#CCCCCC", // 39 - Light Gray
			"#999999", // 40 - Medium Gray
			"#666666", // 41 - Dark Gray
			"#333333", // 42 - Darker Gray
			"#000000", // 43 - Black
			"#FFFFFF", // 44 - White
			"#FF9999", // 45 - Light Pink
			"#FFCC99", // 46 - Peach
			"#FFFF99", // 47 - Light Yellow
			"#CCFF99", // 48 - Light Yellow-Green
			"#99FF99"  // 49 - Light Green
		];

		// Step 30) Return color from palette, or default to white if out of range
		if (colorIndex >= 0 && colorIndex < aciPalette.length) {
			return aciPalette[colorIndex];
		}

		// For colors beyond our palette, generate a simple color
		// Colors 50-255 follow a pattern in AutoCAD but we'll use a fallback
		return "#808080"; // Default to gray for unknown colors
	}

	// Step 30) Check if content is binary (Wenco NAV should be ASCII text only)
	isBinaryContent(content) {
		// Step 31) Check first 512 bytes for binary indicators
		var checkLength = Math.min(512, content.length);
		var nullCount = 0;
		var highByteCount = 0;

		for (var i = 0; i < checkLength; i++) {
			var code = content.charCodeAt(i);

			// Count null bytes (binary files often have nulls)
			if (code === 0) nullCount++;

			// Count high bytes (> 127, excluding replacement char 0xFFFD)
			if (code > 127 && code !== 0xFFFD) highByteCount++;
		}

		// Step 32) If more than 1% null bytes, it's binary
		if (nullCount > checkLength * 0.01) return true;

		// Step 33) If more than 30% high bytes, it's likely binary
		if (highByteCount > checkLength * 0.3) return true;

		return false;
	}
}
