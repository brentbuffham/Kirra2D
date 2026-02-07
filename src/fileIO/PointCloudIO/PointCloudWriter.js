// src/fileIO/PointCloudIO/PointCloudWriter.js
//=============================================================
// POINT CLOUD WRITER - MULTI-FORMAT SUPPORT
//=============================================================
// Supports multiple point cloud text formats:
//
// XYZ Format (.xyz, .txt):
//   - Simple text, one point per line: X Y Z
//   - Optional RGB: X Y Z R G B
//   - Space-separated by default
//
// PTS Format (.pts):
//   - First line: point count
//   - Data lines: X Y Z I R G B
//   - Intensity defaults to 0 if not present
//
// PTX Format (.ptx):
//   - Header: columns=1, rows=pointCount, scanner at origin, identity matrix
//   - Data lines: X Y Z I R G B
//   - Single scan output (simplified format)
//
// CSV Format (.csv):
//   - Comma-separated: X,Y,Z or X,Y,Z,R,G,B
//   - Optional header row
//
// Created: 2026-01-04, Updated: 2026-02-07

import BaseWriter from "../BaseWriter.js";

// Step 1) PointCloudWriter class
class PointCloudWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 2) Writer options
		this.format = options.format || "xyz"; // xyz, pts, ptx, csv
		this.includeColor = options.includeColor !== false; // Default true
		this.includeIntensity = options.includeIntensity || false;
		this.delimiter = options.delimiter || null; // Auto-detect based on format
		this.decimalPlaces = options.decimalPlaces || 6;
		this.includeHeader = options.includeHeader || false;
	}

	// Step 3) Get delimiter based on format
	getDelimiter() {
		if (this.delimiter) return this.delimiter;
		switch (this.format) {
			case "csv": return ",";
			case "pts":
			case "ptx":
			case "xyz":
			default: return " ";
		}
	}

	// Step 4) Main write method
	async write(data) {
		// Step 5) Validate input data
		if (!data || !Array.isArray(data.points)) {
			throw new Error("Invalid data: points array required");
		}

		var points = data.points;

		if (points.length === 0) {
			throw new Error("No points to export");
		}

		// Step 6) Route to format-specific writer
		var content;
		switch (this.format) {
			case "pts":
				content = this.writePTS(points);
				break;
			case "ptx":
				content = this.writePTX(points);
				break;
			case "csv":
				content = this.writeCSV(points);
				break;
			case "xyz":
			case "txt":
			default:
				content = this.writeXYZ(points);
				break;
		}

		// Step 7) Create and return blob
		return this.createBlob(content, "text/plain");
	}

	// Step 8) Write XYZ format
	writeXYZ(points) {
		var content = "";
		var delim = this.getDelimiter();

		// Optional header
		if (this.includeHeader) {
			content += this.includeColor ? "# X Y Z R G B\n" : "# X Y Z\n";
		}

		// Write each point
		for (var i = 0; i < points.length; i++) {
			content += this.formatPointLine(points[i], delim, false);
		}

		return content;
	}

	// Step 9) Write PTS format
	writePTS(points) {
		var content = "";
		var delim = " ";

		// PTS header: point count
		content += points.length + "\n";

		// Write each point with intensity
		for (var i = 0; i < points.length; i++) {
			content += this.formatPointLine(points[i], delim, true);
		}

		return content;
	}

	// Step 10) Write PTX format (simplified single-scan)
	writePTX(points) {
		var content = "";
		var delim = " ";

		// PTX header for single scan
		// Line 1: columns (1 for unsorted)
		content += "1\n";
		// Line 2: rows (point count)
		content += points.length + "\n";
		// Line 3: Scanner position (origin)
		content += "0 0 0\n";
		// Lines 4-6: Scanner orientation vectors
		content += "1 0 0\n"; // X axis
		content += "0 1 0\n"; // Y axis
		content += "0 0 1\n"; // Z axis
		// Lines 7-10: 4x4 identity transformation matrix
		content += "1 0 0 0\n";
		content += "0 1 0 0\n";
		content += "0 0 1 0\n";
		content += "0 0 0 1\n";

		// Write each point with intensity and RGB
		for (var i = 0; i < points.length; i++) {
			content += this.formatPointLine(points[i], delim, true);
		}

		return content;
	}

	// Step 11) Write CSV format
	writeCSV(points) {
		var content = "";
		var delim = ",";

		// CSV header
		if (this.includeHeader) {
			if (this.includeColor) {
				content += "X,Y,Z,R,G,B\n";
			} else {
				content += "X,Y,Z\n";
			}
		}

		// Write each point
		for (var i = 0; i < points.length; i++) {
			content += this.formatPointLine(points[i], delim, false);
		}

		return content;
	}

	// Step 12) Format a single point line
	formatPointLine(point, delim, includeIntensity) {
		// Extract coordinates
		var x = point.x || point.pointXLocation || 0;
		var y = point.y || point.pointYLocation || 0;
		var z = point.z || point.pointZLocation || 0;

		// Format coordinates
		var xStr = x.toFixed(this.decimalPlaces);
		var yStr = y.toFixed(this.decimalPlaces);
		var zStr = z.toFixed(this.decimalPlaces);

		var line = xStr + delim + yStr + delim + zStr;

		// Add intensity if requested (PTS/PTX format)
		if (includeIntensity) {
			var intensity = point.intensity !== undefined ? point.intensity : 0;
			line += delim + intensity.toFixed(4);
		}

		// Add color if enabled
		if (this.includeColor) {
			var r = this.extractColorComponent(point, "r");
			var g = this.extractColorComponent(point, "g");
			var b = this.extractColorComponent(point, "b");

			line += delim + r + delim + g + delim + b;
		}

		return line + "\n";
	}

	// Step 13) Extract color component from point
	extractColorComponent(point, component) {
		var value;
		if (component === "r") {
			value = point.r !== undefined ? point.r : (point.color ? this.extractR(point.color) : 128);
		} else if (component === "g") {
			value = point.g !== undefined ? point.g : (point.color ? this.extractG(point.color) : 128);
		} else {
			value = point.b !== undefined ? point.b : (point.color ? this.extractB(point.color) : 128);
		}
		return Math.max(0, Math.min(255, Math.floor(value)));
	}

	// Step 14) Extract red component from hex color
	extractR(color) {
		if (typeof color === "string" && color.startsWith("#")) {
			return parseInt(color.substring(1, 3), 16);
		}
		return 128;
	}

	// Step 15) Extract green component from hex color
	extractG(color) {
		if (typeof color === "string" && color.startsWith("#")) {
			return parseInt(color.substring(3, 5), 16);
		}
		return 128;
	}

	// Step 16) Extract blue component from hex color
	extractB(color) {
		if (typeof color === "string" && color.startsWith("#")) {
			return parseInt(color.substring(5, 7), 16);
		}
		return 128;
	}
}

export default PointCloudWriter;
