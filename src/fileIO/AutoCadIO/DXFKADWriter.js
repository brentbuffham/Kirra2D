// src/fileIO/AutoCadIO/DXFKADWriter.js
//=============================================================
// DXF KAD WRITER - Export KAD Drawings to DXF
//=============================================================
// Step 1) Exports KAD (Kirra CAD) drawings to DXF format
// Step 2) Supports points, lines, polylines, polygons, circles, text
// Step 3) Each entity becomes a layer in DXF
// Step 4) Created: 2026-01-10

import BaseWriter from "../BaseWriter.js";

// Step 5) DXFKADWriter class
class DXFKADWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);
	}

	// Step 6) Main write method
	async write(data) {
		// Step 7) Validate input data
		if (!data || !data.kadDrawingsMap) {
			throw new Error("Invalid data: kadDrawingsMap required");
		}

		var kadDrawingsMap = data.kadDrawingsMap;

		if (kadDrawingsMap.size === 0) {
			throw new Error("No KAD drawings to export");
		}

		// Step 8) Generate DXF content
		var dxf = this.generateDXFFromKAD(kadDrawingsMap);

		// Step 9) Create and return blob
		return this.createBlob(dxf, "application/dxf");
	}

	// Step 10) Generate DXF from KAD drawings
	generateDXFFromKAD(kadDrawingsMap) {
		// Step 11) DXF header
		var dxf = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n";
		dxf += "0\nSECTION\n2\nTABLES\n0\nENDSEC\n";
		dxf += "0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n";
		dxf += "0\nSECTION\n2\nENTITIES\n";

		// Step 12) Iterate through KAD entities
		for (var [entityName, entityData] of kadDrawingsMap.entries()) {
			var type = entityData.entityType ? entityData.entityType.trim() : "point";
			var data = entityData.data;

			if (!data || !Array.isArray(data) || data.length === 0) {
				console.warn("Skipping empty entity:", entityName);
				continue;
			}

			// Step 13) Export each entity based on type
			for (var i = 0; i < data.length; i++) {
				var item = data[i];

				// Step 14) Skip hidden elements
				if (item.visible === false) {
					continue;
				}

				// Step 15) Get color
				var color = typeof item.color === "string" ? this.getColorInteger(item.color) : 1;

				// Step 16) Export based on type
				if (type === "point") {
					dxf += this.generatePoint(item, entityName, color);
				} else if (type === "line") {
					// Export line as polyline (only once for the entire line)
					if (i === 0 && data.length > 1) {
						dxf += this.generatePolyline(data, entityName, color, false);
					}
					break; // Exit after first iteration for lines
				} else if (type === "poly") {
					// Export polygon as closed polyline (only once)
					if (i === 0 && data.length > 1) {
						dxf += this.generatePolyline(data, entityName, color, true);
					}
					break; // Exit after first iteration for polygons
				} else if (type === "circle") {
					dxf += this.generateCircle(item, entityName, color);
				} else if (type === "text") {
					dxf += this.generateText(item, entityName, color);
				}
			}
		}

		// Step 17) DXF footer
		dxf += "0\nENDSEC\n0\nEOF\n";

		return dxf;
	}

	// Step 18) Generate DXF point
	generatePoint(item, layerName, color) {
		var dxf = "0\nPOINT\n8\n" + layerName + "\n";
		dxf += "10\n" + (item.pointXLocation || 0) + "\n";
		dxf += "20\n" + (item.pointYLocation || 0) + "\n";
		dxf += "30\n" + (item.pointZLocation || 0) + "\n";
		dxf += "62\n" + color + "\n";
		return dxf;
	}

	// Step 19) Generate DXF polyline
	generatePolyline(data, layerName, color, closed) {
		// Filter visible points
		var visiblePoints = data.filter(function(pt) {
			return pt.visible !== false;
		});

		if (visiblePoints.length < 2) {
			return "";
		}

		var dxf = "0\nPOLYLINE\n8\n" + layerName + "\n66\n1\n";
		dxf += "70\n" + (closed ? "1" : "0") + "\n";
		dxf += "62\n" + color + "\n";

		// Add vertices
		for (var i = 0; i < visiblePoints.length; i++) {
			var pt = visiblePoints[i];
			dxf += "0\nVERTEX\n8\n" + layerName + "\n";
			dxf += "10\n" + (pt.pointXLocation || 0) + "\n";
			dxf += "20\n" + (pt.pointYLocation || 0) + "\n";
			dxf += "30\n" + (pt.pointZLocation || 0) + "\n";
		}

		dxf += "0\nSEQEND\n8\n" + layerName + "\n";
		return dxf;
	}

	// Step 20) Generate DXF circle
	generateCircle(item, layerName, color) {
		var dxf = "0\nCIRCLE\n8\n" + layerName + "\n";
		dxf += "10\n" + (item.pointXLocation || 0) + "\n";
		dxf += "20\n" + (item.pointYLocation || 0) + "\n";
		dxf += "30\n" + (item.pointZLocation || 0) + "\n";
		dxf += "40\n" + (item.radius || 10) + "\n";
		dxf += "62\n" + color + "\n";
		return dxf;
	}

	// Step 21) Generate DXF text
	generateText(item, layerName, color) {
		var dxf = "0\nTEXT\n8\n" + layerName + "\n";
		dxf += "10\n" + (item.pointXLocation || 0) + "\n";
		dxf += "20\n" + (item.pointYLocation || 0) + "\n";
		dxf += "30\n" + (item.pointZLocation || 0) + "\n";
		dxf += "40\n" + (item.fontHeight || 12) + "\n";
		dxf += "1\n" + (item.text || "TEXT") + "\n";
		dxf += "62\n" + color + "\n";
		return dxf;
	}

	// Step 22) Convert hex color to DXF color integer (1-255)
	getColorInteger(hexColor) {
		// Common color mappings
		var colorMap = {
			"#FF0000": 1,   // Red
			"#FFFF00": 2,   // Yellow
			"#00FF00": 3,   // Green
			"#00FFFF": 4,   // Cyan
			"#0000FF": 5,   // Blue
			"#FF00FF": 6,   // Magenta
			"#FFFFFF": 7,   // White
			"#808080": 8,   // Gray
			"#C0C0C0": 9,   // Light Gray
			"#FFA500": 30,  // Orange
			"#800080": 200  // Purple
		};

		// Check if color is in map
		if (hexColor && colorMap[hexColor.toUpperCase()]) {
			return colorMap[hexColor.toUpperCase()];
		}

		// Hash color to 1-255 range
		if (hexColor && hexColor.startsWith("#")) {
			var hash = 0;
			for (var i = 1; i < hexColor.length; i++) {
				hash = hexColor.charCodeAt(i) + ((hash << 5) - hash);
			}
			return (Math.abs(hash) % 255) + 1;
		}

		return 1; // Default to red
	}
}

export default DXFKADWriter;
