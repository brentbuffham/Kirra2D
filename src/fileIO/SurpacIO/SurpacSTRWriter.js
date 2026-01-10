// src/fileIO/SurpacIO/SurpacSTRWriter.js
//=============================================================
// SURPAC STR WRITER - STRING FILE FORMAT
//=============================================================
// Step 1) Exports data to Surpac STR (String) format
// Step 2) Format: string_number, Y, X, Z, label, description
// Step 3) Note: Y comes BEFORE X (Northing, Easting order)
// Step 4) String numbers encode colors (1-255)
// Step 5) Reference: BRENTBUFFHAM_BlastToSurpac.pm, geotutes.com/surpac-strings
// Step 6) Created: 2026-01-05, Updated: 2026-01-05

import BaseWriter from "../BaseWriter.js";

// Step 7) SurpacSTRWriter class
class SurpacSTRWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 8) Writer options
		this.decimalPlaces = options.decimalPlaces !== undefined ? options.decimalPlaces : 3;
		this.defaultStringNumber = options.defaultStringNumber !== undefined ? options.defaultStringNumber : 512;
		this.defaultLabel = options.defaultLabel || "";
		this.defaultDescription = options.defaultDescription || "";
	}

	// Step 9) Convert hex color to Surpac string number (1-255)
	colorToStringNumber(hexColor) {
		// Step 10) Map common colors to Surpac string numbers
		// Reference: Surpac uses string numbers 1-255 for colors
		var colorMap = {
			"#FF0000": 1,   // Red
			"#00FF00": 2,   // Green
			"#0000FF": 3,   // Blue
			"#FFFF00": 4,   // Yellow
			"#FF00FF": 5,   // Magenta
			"#00FFFF": 6,   // Cyan
			"#FFFFFF": 7,   // White
			"#000000": 8,   // Black
			"#FFA500": 9,   // Orange
			"#800080": 10   // Purple
		};

		// Step 11) Check if color is in map
		if (hexColor && colorMap[hexColor.toUpperCase()]) {
			return colorMap[hexColor.toUpperCase()];
		}

		// Step 12) If color not mapped, hash the color to a number (1-255)
		if (hexColor && hexColor.startsWith("#")) {
			var hash = 0;
			for (var i = 1; i < hexColor.length; i++) {
				hash = hexColor.charCodeAt(i) + ((hash << 5) - hash);
			}
			return (Math.abs(hash) % 255) + 1;
		}

		// Step 13) Default to 512 (blast hole style)
		return this.defaultStringNumber;
	}

	// Step 14) Main write method
	async write(data) {
		// Step 15) Validate input data
		if (!data) {
			throw new Error("Invalid data: data object required");
		}

		// Step 16) Generate STR content
		var str = "";

		if (data.holes && Array.isArray(data.holes)) {
			// Step 17) Export blast holes as strings
			str = this.generateSTRFromHoles(data.holes, data.fileName || "blastmaster");
		} else if (data.kadDrawingsMap) {
			// Step 18) Export KAD drawings as strings
			str = this.generateSTRFromKAD(data.kadDrawingsMap, data.fileName || "drawing");
		} else if (data.surfaces && data.surfaces.size > 0) {
			// Step 19) Export surfaces as unique vertices (for DTM pairing)
			// Use baseFileName if provided (for DTM/STR pairing), otherwise fileName
			var baseFileName = data.baseFileName || data.fileName || "surface";
			str = this.generateSTRFromSurfaces(data.surfaces, baseFileName);
		} else {
			throw new Error("Invalid data: holes, kadDrawingsMap, or surfaces required");
		}

		// Step 20) Create and return blob
		return this.createBlob(str, "text/plain");
	}

	// Step 21) Generate STR from blast holes (Surpac 6.3 format)
	generateSTRFromHoles(holes, fileName) {
		var str = "";

		// Step 22) Get current date in dd-Mmm-yy format
		var dateString = this.getDateString();

		// Step 23) Write header line (name, date, empty, ssi path)
		str += fileName + "," + dateString + ",,ssi_styles:survey.ssi\n";

		// Step 24) Write second line (all zeros - 7 columns)
		str += "0,           0.000,           0.000,           0.000,           0.000,           0.000,           0.000\n";

		// Step 25) Write each hole as a string (collar + toe with metadata)
		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];

			// Step 26) Skip invisible holes
			if (hole.visible === false) continue;

			// Step 27) String number is always 1 for Surpac 6.3 blast holes
			var stringNumber = 1;

			// Step 28) Format collar coordinates
			var collarY = this.formatNumber(hole.startYLocation);
			var collarX = this.formatNumber(hole.startXLocation);
			var collarZ = this.formatNumber(hole.startZLocation);

			// Step 29) Prepare description fields for collar line
			var d1 = "DrillBlast1.1"; // Blast design identifier
			var d2 = hole.entityName || "BLASTID"; // Blast name ID
			var d3 = this.padHoleID(hole.holeID || (i + 1).toString()); // Padded hole ID (00001, 00002, etc)
			var d4 = this.formatNumber(hole.holeLengthCalculated || 0); // Planned depth
			var d5 = this.formatNumber((hole.holeDiameter || 0) / 1000); // Diameter in meters (convert from mm)
			var d6 = ""; // Empty - possibly burden/spacing
			var d7 = hole.holeType || "Rig-1"; // Rig name (use holeType)
			var d8 = this.formatNumber(hole.subdrillLength || 0); // Subdrill length
			var d9 = this.formatNumber(hole.holeBearing || 0, 4); // Bearing/azimuth (4 decimals)
			var d10 = this.formatNumber((hole.holeAngle || 90) - 90, 4); // Dip (SurpacDip = KirraAngle - 90, e.g. Kirra 0° vertical = Surpac -90°)
			var d11 = "METHOD"; // Blast method
			var d12 = "0.000"; // Unknown/optional
			var d13 = ""; // Empty
			var d14 = "0.000"; // Unknown/optional

			// Step 30) Write collar line with all description fields
			str += stringNumber + ", " + collarY + ", " + collarX + ", " + collarZ + ", ";
			str += d1 + "," + d2 + "," + d3 + "," + d4 + "," + d5 + "," + d6 + "," + d7 + "," + d8 + "," + d9 + "," + d10 + "," + d11 + "," + d12 + "," + d13 + "," + d14 + "\n";

			// Step 31) Write toe line (no description fields, just coordinates with trailing space)
			if (hole.endXLocation !== undefined && hole.endYLocation !== undefined && hole.endZLocation !== undefined) {
				var toeY = this.formatNumber(hole.endYLocation);
				var toeX = this.formatNumber(hole.endXLocation);
				var toeZ = this.formatNumber(hole.endZLocation);

				str += stringNumber + ", " + toeY + ", " + toeX + ", " + toeZ + ", \n";
			}

			// Step 32) Write separator (0,0,0,0) after each hole
			str += "0, 0.000, 0.000, 0.000,\n";
		}

		// Step 33) Write end marker
		str += "0, 0.000, 0.000, 0.000, END\n";

		return str;
	}

	// Step 34) Pad hole ID with zeros (e.g., "1" -> "00001")
	padHoleID(holeID) {
		var idStr = holeID.toString();
		// Pad to 5 digits with leading zeros
		while (idStr.length < 5) {
			idStr = "0" + idStr;
		}
		return idStr;
	}

	// Step 32) Generate STR from surfaces (unique vertices only - for DTM pairing)
	generateSTRFromSurfaces(surfaces, fileName) {
		var str = "";

		// Step 33) Get current date
		var dateString = this.getDateString();

		// Step 34) Write header line (4 fields: name, date, empty, description/ssi)
		str += fileName + ", " + dateString + ",,\n";

		// Step 35) Write second line (7 zeros with spacing)
		str += "0, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000\n";

		// Step 36) Collect all unique vertices from all surfaces
		var uniqueVertices = [];
		var vertexMap = new Map();

		surfaces.forEach(function(surface) {
			// Step 37) Skip invisible surfaces
			if (surface.visible === false) return;

			// Step 38) Process all triangles to extract unique vertices
			if (surface.triangles && Array.isArray(surface.triangles)) {
				for (var i = 0; i < surface.triangles.length; i++) {
					var triangle = surface.triangles[i];
					if (!triangle.vertices || triangle.vertices.length < 3) continue;

					// Step 39) Process each vertex
					for (var j = 0; j < triangle.vertices.length; j++) {
						var vertex = triangle.vertices[j];

						// Step 40) Create key with formatted coordinates (3 decimal places)
						var key = this.formatNumber(vertex.x, 3) + "_" + 
								 this.formatNumber(vertex.y, 3) + "_" + 
								 this.formatNumber(vertex.z || 0, 3);

						// Step 41) Add to map if not already present
						if (!vertexMap.has(key)) {
							vertexMap.set(key, uniqueVertices.length + 1); // 1-based index
							uniqueVertices.push(vertex);
						}
					}
				}
			}
		}, this);

		// Step 42) Write unique vertices (string number 32000 for surfaces, no label/description)
		for (var i = 0; i < uniqueVertices.length; i++) {
			var vertex = uniqueVertices[i];
			var y = this.formatNumber(vertex.y);
			var x = this.formatNumber(vertex.x);
			var z = this.formatNumber(vertex.z || 0);

			// Step 43) STR format for surfaces: 32000, Y, X, Z, 
			str += "32000, " + y + ", " + x + ", " + z + ", \n";
		}

		// Step 44) Write end marker
		str += "0, 0.000, 0.000, 0.000, END\n";

		return str;
	}

	// Step 44) Generate STR from KAD drawings
	generateSTRFromKAD(kadDrawingsMap, fileName) {
		var str = "";

		// Step 45) Get current date
		var dateString = this.getDateString();

		// Step 46) Write header line
		str += fileName + "," + dateString + ",0.000,0.000\n";

		// Step 47) Write second line (all zeros)
		str += "0, 0.000, 0.000, 0.000,\n";

		// Step 48) Iterate through KAD entities
		kadDrawingsMap.forEach(function(entity) {
			// Step 49) Skip invisible entities
			if (entity.visible === false) return;

			// Step 50) Get color from first data item or entity
			var firstItem = entity.data && entity.data.length > 0 ? entity.data[0] : null;
			var entityColor = firstItem ? firstItem.color : entity.color;

			// Step 51) Get string number based on entity color
			var stringNumber = this.colorToStringNumber(entityColor);

			// Step 52) Export point entities
			if (entity.entityType === "point" && entity.data && Array.isArray(entity.data)) {
				for (var i = 0; i < entity.data.length; i++) {
					var point = entity.data[i];

					// Skip invisible points
					if (point.visible === false) continue;

					var y = this.formatNumber(point.pointYLocation || 0);
					var x = this.formatNumber(point.pointXLocation || 0);
					var z = this.formatNumber(point.pointZLocation || 0);

					var label = point.pointID || i.toString();
					var description = entity.entityName || this.defaultDescription;

					// Get color from individual point or use entity color
					var pointColor = point.color || entityColor;
					var pointStringNumber = this.colorToStringNumber(pointColor);

					str += pointStringNumber + "," + y + "," + x + "," + z + "," + label + "," + description + "\n";

					// Separator after each point
					str += "0, 0.000, 0.000, 0.000,\n";
				}
			}
			// Step 53) Export text entities (as points with text in D1 field)
			else if (entity.entityType === "text" && entity.data && Array.isArray(entity.data)) {
				for (var i = 0; i < entity.data.length; i++) {
					var textPoint = entity.data[i];

					// Skip invisible text
					if (textPoint.visible === false) continue;

					var y = this.formatNumber(textPoint.pointYLocation || 0);
					var x = this.formatNumber(textPoint.pointXLocation || 0);
					var z = this.formatNumber(textPoint.pointZLocation || 0);

					// Use the text value in D1 field (label)
					var label = textPoint.text || "TEXT";
					var description = entity.entityName || this.defaultDescription;

					// Get color from individual text or use entity color
					var textColor = textPoint.color || entityColor;
					var textStringNumber = this.colorToStringNumber(textColor);

					str += textStringNumber + "," + y + "," + x + "," + z + "," + label + "," + description + "\n";

					// Separator after each text
				str += "0, 0.000, 0.000, 0.000,\n";
				}
			}
			// Step 54) Export line/polyline entities
			else if ((entity.entityType === "line" || entity.entityType === "poly") && entity.data && Array.isArray(entity.data)) {
				// Filter visible points
				var visiblePoints = entity.data.filter(function(pt) {
					return pt.visible !== false;
				});

				if (visiblePoints.length < 2) return;

				for (var i = 0; i < visiblePoints.length; i++) {
					var point = visiblePoints[i];

					var y = this.formatNumber(point.pointYLocation || 0);
					var x = this.formatNumber(point.pointXLocation || 0);
					var z = this.formatNumber(point.pointZLocation || 0);

					var label = point.pointID || i.toString();
					var description = entity.entityName || this.defaultDescription;

					// Get color from individual point or use entity color
					var pointColor = point.color || entityColor;
					var lineStringNumber = this.colorToStringNumber(pointColor);

					str += lineStringNumber + "," + y + "," + x + "," + z + "," + label + "," + description + "\n";
				}

				// Step 55) Separator after each line/poly
				str += "0, 0.000, 0.000, 0.000,\n";
			}
			// Step 56) Export circle entities as polygons (36 segments)
			else if (entity.entityType === "circle" && entity.data && Array.isArray(entity.data)) {
				for (var i = 0; i < entity.data.length; i++) {
					var circle = entity.data[i];

					// Skip invisible circles
					if (circle.visible === false) continue;

					var centerX = circle.pointXLocation || 0;
					var centerY = circle.pointYLocation || 0;
					var centerZ = circle.pointZLocation || 0;
					var radius = circle.radius || 10;

					// Get color from individual circle or use entity color
					var circleColor = circle.color || entityColor;
					var circleStringNumber = this.colorToStringNumber(circleColor);

					// Generate 36 segments
					var segments = 36;
					for (var j = 0; j <= segments; j++) {
						var angle = (j / segments) * 2 * Math.PI;
						var x = centerX + radius * Math.cos(angle);
						var y = centerY + radius * Math.sin(angle);
						var z = centerZ;

						var formattedY = this.formatNumber(y);
						var formattedX = this.formatNumber(x);
						var formattedZ = this.formatNumber(z);

						var label = "C" + i + "_" + j;
						var description = entity.entityName || this.defaultDescription;

						str += circleStringNumber + "," + formattedY + "," + formattedX + "," + formattedZ + "," + label + "," + description + "\n";
					}

					// Separator after each circle
					str += "0, 0.000, 0.000, 0.000,\n";
				}
			}
		}, this);

		// Step 57) Write end marker
		str += "0, 0.000, 0.000, 0.000, END\n";

		return str;
	}

	// Step 45) Format number with specified decimal places
	formatNumber(value, decimals) {
		// Use provided decimals or default to this.decimalPlaces
		var dp = decimals !== undefined ? decimals : this.decimalPlaces;

		if (value === undefined || value === null || isNaN(value)) {
			// Return zeros with correct decimal places
			return "0." + "0".repeat(dp);
		}

		return parseFloat(value).toFixed(dp);
	}

	// Step 46) Get date string in dd-Mmm-yy format
	getDateString() {
		var date = new Date();
		var day = date.getDate().toString().padStart(2, "0");
		var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		var month = monthNames[date.getMonth()];
		var year = date.getFullYear().toString().slice(-2);

		return day + "-" + month + "-" + year;
	}
}

export default SurpacSTRWriter;
