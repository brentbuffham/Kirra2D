// src/fileIO/WencoIO/NAVAsciiWriter.js
//=============================================================
// WENCO NAV ASCII WRITER
//=============================================================
// Step 1) Export KAD entities and blast holes to Wenco NAV ASCII format
// Step 2) Format: HEADER VERSION,1 followed by TEXT/POINT/LINE records
// Step 3) Reference: BRENTBUFFHAM_FiletoASCII-NAV.pm
// Step 4) Created: 2026-01-07

import BaseWriter from "../BaseWriter.js";

export default class NAVAsciiWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);
		this.options = options;
		this.defaultLayer = options.layer || "DEFAULT";
	}

	// Step 5) Main write entry point
	async write(data) {
		// Step 6) Validate input
		if (!data) {
			throw new Error("NAV ASCII Writer requires data");
		}

		// Step 7) Extract entities from data
		var entities = [];

		// Step 8) Check for KAD entities
		if (data.entities && Array.isArray(data.entities)) {
			entities = entities.concat(data.entities);
		}

		// Step 9) Check for blast holes
		if (data.holes && Array.isArray(data.holes)) {
			entities = entities.concat(data.holes);
		}

		// Step 10) If data is an array, use it directly
		if (Array.isArray(data)) {
			entities = data;
		}

		// Step 10a) Extract surfaces from data
		var surfaces = [];
		if (data.surfaces && Array.isArray(data.surfaces)) {
			surfaces = data.surfaces;
		}

		// Step 11) Filter visible entities only
		var visibleEntities = entities.filter(function (entity) {
			return entity.visible !== false;
		});

		// Step 11a) Filter visible surfaces only
		var visibleSurfaces = surfaces.filter(function (surface) {
			return surface.visible !== false;
		});

		if (visibleEntities.length === 0 && visibleSurfaces.length === 0) {
			throw new Error("No visible entities or surfaces to export");
		}

		// Step 12) Generate NAV ASCII content
		var navContent = this.generateNAV(visibleEntities, visibleSurfaces);

		// Step 13) Determine filename
		var filename = this.options.filename || "Wenco_Export.nav";
		if (!filename.toLowerCase().endsWith(".nav")) {
			filename += ".nav";
		}

		// Step 14) Create Blob and download file
		var blob = this.createBlob(navContent, "text/plain");
		this.downloadFile(blob, filename);

		return {
			success: true,
			filename: filename,
			entitiesExported: visibleEntities.length
		};
	}

	// Step 15) Generate NAV ASCII content
	generateNAV(entities, surfaces) {
		var lines = [];

		// Step 16) Add header
		lines.push("HEADER VERSION,1");

		// Step 17) Process each entity
		for (var i = 0; i < entities.length; i++) {
			var entity = entities[i];

			// Step 18) Determine entity type
			if (entity.holeID) {
				// Step 19) Blast hole - export as LINE
				var holeLine = this.generateHoleLine(entity);
				if (holeLine) lines.push(holeLine);
			} else if (entity.entityType === "text") {
				// Step 20) Text entity (KAD format uses entity.data)
				var textLine = this.generateTextLine(entity);
				if (textLine) lines.push(textLine);
			} else if (entity.entityType === "point" && entity.data && entity.data.length >= 1) {
				// Step 21) Point entity (KAD format uses entity.data)
				var pointLine = this.generatePointLine(entity);
				if (pointLine) lines.push(pointLine);
			} else if ((entity.entityType === "line" || entity.entityType === "poly") && entity.data && entity.data.length > 1) {
				// Step 22) Line/Polyline entity (KAD format uses entity.data)
				var lineLine = this.generateLineLine(entity);
				if (lineLine) lines.push(lineLine);
			}
		}

		// Step 22a) Process surfaces (triangulations)
		if (surfaces && Array.isArray(surfaces)) {
			for (var i = 0; i < surfaces.length; i++) {
				var surface = surfaces[i];

				// Each surface has triangles array
				if (surface.triangles && Array.isArray(surface.triangles)) {
					for (var j = 0; j < surface.triangles.length; j++) {
						var triangle = surface.triangles[j];
						var triangleLine = this.generateTriangleLine(triangle, surface);
						if (triangleLine) lines.push(triangleLine);
					}
				}
			}
		}

		// Step 23) Join all lines with newline
		return lines.join("\n");
	}

	// Step 24) Generate TEXT record for text entity
	// Format: TEXT,color,layer,size,text,rotation x,y,z
	generateTextLine(entity) {
		// Get color from KAD data structure
		var colorHex = entity.data && entity.data[0] ? entity.data[0].color : "#FF0000";
		var colorIndex = this.hexToColorIndex(colorHex);

		var layer = entity.layer || entity.entityName || this.defaultLayer;

		// Get text and size from KAD data structure
		var text = entity.data && entity.data[0] && entity.data[0].text ? entity.data[0].text : "";
		text = text.replace(/\s+/g, "_"); // Replace spaces with underscores
		var size = entity.data && entity.data[0] && entity.data[0].fontHeight ? entity.data[0].fontHeight : 1.0;
		var rotation = 0; // NAV doesn't store rotation in KAD format

		// Get coordinates from KAD data structure
		var dataPoint = entity.data && entity.data[0] ? entity.data[0] : { pointXLocation: 0, pointYLocation: 0, pointZLocation: 0 };
		var x = (dataPoint.pointXLocation || 0).toFixed(6);
		var y = (dataPoint.pointYLocation || 0).toFixed(6);
		var z = (dataPoint.pointZLocation || 0).toFixed(6);

		// Step 25) Limit layer name to 15 characters
		if (layer.length > 15) {
			layer = layer.substring(0, 15);
		}

		return "TEXT," + colorIndex + "," + layer + "," + size.toFixed(6) + "," + text + "," + rotation.toFixed(6) + " " + x + "," + y + "," + z;
	}

	// Step 26) Generate POINT record for point entity
	// Format: POINT,color,layer,,0.000000,0.000000 x,y,z 0.000000,0.000000,0.000000
	generatePointLine(entity) {
		// Get color from KAD data structure
		var colorHex = entity.data && entity.data[0] ? entity.data[0].color : "#FF0000";
		var colorIndex = this.hexToColorIndex(colorHex);

		var layer = entity.layer || entity.entityName || this.defaultLayer;

		// Get coordinates from KAD data structure
		var dataPoint = entity.data && entity.data[0] ? entity.data[0] : { pointXLocation: 0, pointYLocation: 0, pointZLocation: 0 };
		var x = (dataPoint.pointXLocation || 0).toFixed(6);
		var y = (dataPoint.pointYLocation || 0).toFixed(6);
		var z = (dataPoint.pointZLocation || 0).toFixed(6);

		// Step 27) Limit layer name to 15 characters
		if (layer.length > 15) {
			layer = layer.substring(0, 15);
		}

		return "POINT," + colorIndex + "," + layer + ",,0.000000,0.000000 " + x + "," + y + "," + z + " 0.000000,0.000000,0.000000";
	}

	// Step 28) Generate LINE record for line/poly entity
	// Format: LINE,color,layer x1,y1,z1 x2,y2,z2 ...
	generateLineLine(entity) {
		// Get color from KAD data structure
		var colorHex = entity.data && entity.data[0] ? entity.data[0].color : "#FF0000";
		var colorIndex = this.hexToColorIndex(colorHex);

		var layer = entity.layer || entity.entityName || this.defaultLayer;

		// Step 29) Limit layer name to 15 characters
		if (layer.length > 15) {
			layer = layer.substring(0, 15);
		}

		// Step 30) Build coordinate string from KAD data structure
		var coordsArray = [];
		var dataPoints = entity.data || [];

		for (var i = 0; i < dataPoints.length; i++) {
			var dataPoint = dataPoints[i];
			var x = (dataPoint.pointXLocation || 0).toFixed(6);
			var y = (dataPoint.pointYLocation || 0).toFixed(6);
			var z = (dataPoint.pointZLocation || 0).toFixed(6);
			coordsArray.push(x + "," + y + "," + z);
		}

		// Step 31) If entity is closed (poly) and doesn't have duplicate last point, add it
		if (entity.entityType === "poly" && dataPoints.length > 0) {
			var first = dataPoints[0];
			var last = dataPoints[dataPoints.length - 1];
			var tolerance = 0.001;

			if (
				Math.abs(first.pointXLocation - last.pointXLocation) > tolerance ||
				Math.abs(first.pointYLocation - last.pointYLocation) > tolerance ||
				Math.abs(first.pointZLocation - last.pointZLocation) > tolerance
			) {
				// Add closing point
				var x = (first.pointXLocation || 0).toFixed(6);
				var y = (first.pointYLocation || 0).toFixed(6);
				var z = (first.pointZLocation || 0).toFixed(6);
				coordsArray.push(x + "," + y + "," + z);
			}
		}

		// Step 32) Join coordinates with spaces
		var coordsString = coordsArray.join(" ");

		return "LINE," + colorIndex + "," + layer + " " + coordsString;
	}

	// Step 33) Generate LINE record for blast hole (collar to toe)
	generateHoleLine(hole) {
		var color = 1; // Red
		var layer = hole.entityName || "HOLES";

		// Step 34) Limit layer name to 15 characters
		if (layer.length > 15) {
			layer = layer.substring(0, 15);
		}

		// Step 35) Format collar and toe coordinates
		var collarX = (hole.startXLocation || 0).toFixed(6);
		var collarY = (hole.startYLocation || 0).toFixed(6);
		var collarZ = (hole.startZLocation || 0).toFixed(6);

		var toeX = (hole.endXLocation || 0).toFixed(6);
		var toeY = (hole.endYLocation || 0).toFixed(6);
		var toeZ = (hole.endZLocation || 0).toFixed(6);

		return "LINE," + color + "," + layer + " " + collarX + "," + collarY + "," + collarZ + " " + toeX + "," + toeY + "," + toeZ;
	}

	// Step 35a) Generate TRIANGLE record for surface triangle
	// Format: TRIANGLE,color,layer x1,y1,z1 x2,y2,z2 x3,y3,z3
	// Example: TRIANGLE,9,SURF 123.456,789.012,345.678 234.567,890.123,456.789 345.678,901.234,567.890
	generateTriangleLine(triangle, surface) {
		// Default color for surfaces (color 9 = light gray per reference script)
		var colorIndex = 9;
		var layer = surface.name || surface.entityName || "SURF";

		// Limit layer name to 15 characters
		if (layer.length > 15) {
			layer = layer.substring(0, 15);
		}

		// Extract three vertices from triangle
		if (!triangle.vertices || triangle.vertices.length < 3) {
			return null; // Invalid triangle
		}

		var v1 = triangle.vertices[0];
		var v2 = triangle.vertices[1];
		var v3 = triangle.vertices[2];

		// Format coordinates
		var x1 = (v1.x || 0).toFixed(6);
		var y1 = (v1.y || 0).toFixed(6);
		var z1 = (v1.z || 0).toFixed(6);

		var x2 = (v2.x || 0).toFixed(6);
		var y2 = (v2.y || 0).toFixed(6);
		var z2 = (v2.z || 0).toFixed(6);

		var x3 = (v3.x || 0).toFixed(6);
		var y3 = (v3.y || 0).toFixed(6);
		var z3 = (v3.z || 0).toFixed(6);

		return "TRIANGLE," + colorIndex + "," + layer + " " + x1 + "," + y1 + "," + z1 + " " + x2 + "," + y2 + "," + z2 + " " + x3 + "," + y3 + "," + z3;
	}

	// Step 36) Convert hex color string to AutoCAD Color Index (ACI)
	hexToColorIndex(hexColor) {
		// Step 37) Full AutoCAD ACI color palette (matches NAVAsciiParser)
		var aciPalette = [
			"#000000", // 0 - ByBlock (black)
			"#FF0000", // 1 - Red
			"#FFFF00", // 2 - Yellow
			"#00FF00", // 3 - Green
			"#00FFFF", // 4 - Cyan
			"#0000FF", // 5 - Blue
			"#FF00FF", // 6 - Magenta
			"#FFFFFF", // 7 - White/Black
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

		// Step 38) Normalize hex color to uppercase
		var normalized = (hexColor || "#FF0000").toUpperCase();

		// Step 39) Find exact match in palette
		for (var i = 0; i < aciPalette.length; i++) {
			if (aciPalette[i] === normalized) {
				return i;
			}
		}

		// Step 40) No exact match - return default red
		return 1;
	}
}
