// src/fileIO/PointCloudIO/PointCloudWriter.js
//=============================================================
// POINT CLOUD WRITER - XYZ/TXT FORMAT
//=============================================================
// Step 1) Exports point clouds to XYZ/TXT/CSV formats
// Step 2) Supports X,Y,Z and X,Y,Z,R,G,B formats
// Step 3) Created: 2026-01-04

import BaseWriter from "../BaseWriter.js";

// Step 4) PointCloudWriter class
class PointCloudWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 5) Writer options
		this.includeColor = options.includeColor !== false; // Default true
		this.delimiter = options.delimiter || " "; // Space-delimited by default
		this.decimalPlaces = options.decimalPlaces || 6;
		this.includeHeader = options.includeHeader || false;
		this.headerText = options.headerText || "# X Y Z R G B";
	}

	// Step 6) Main write method
	async write(data) {
		// Step 7) Validate input data
		if (!data || !Array.isArray(data.points)) {
			throw new Error("Invalid data: points array required");
		}

		var points = data.points;

		if (points.length === 0) {
			throw new Error("No points to export");
		}

		// Step 8) Generate file content
		var content = "";

		// Step 9) Add header if enabled
		if (this.includeHeader) {
			if (this.includeColor) {
				content += "# X Y Z R G B\n";
			} else {
				content += "# X Y Z\n";
			}
		}

		// Step 10) Write each point
		for (var i = 0; i < points.length; i++) {
			var point = points[i];

			// Step 11) Extract coordinates
			var x = point.x || point.pointXLocation || 0;
			var y = point.y || point.pointYLocation || 0;
			var z = point.z || point.pointZLocation || 0;

			// Step 12) Format coordinates
			var xStr = x.toFixed(this.decimalPlaces);
			var yStr = y.toFixed(this.decimalPlaces);
			var zStr = z.toFixed(this.decimalPlaces);

			// Step 13) Write X Y Z
			content += xStr + this.delimiter + yStr + this.delimiter + zStr;

			// Step 14) Add color if enabled and available
			if (this.includeColor) {
				var r = point.r !== undefined ? point.r : (point.color ? this.extractR(point.color) : 128);
				var g = point.g !== undefined ? point.g : (point.color ? this.extractG(point.color) : 128);
				var b = point.b !== undefined ? point.b : (point.color ? this.extractB(point.color) : 128);

				// Step 15) Ensure RGB values are 0-255
				r = Math.max(0, Math.min(255, Math.floor(r)));
				g = Math.max(0, Math.min(255, Math.floor(g)));
				b = Math.max(0, Math.min(255, Math.floor(b)));

				content += this.delimiter + r + this.delimiter + g + this.delimiter + b;
			}

			content += "\n";
		}

		// Step 16) Create and return blob
		return this.createBlob(content, "text/plain");
	}

	// Step 17) Extract red component from hex color
	extractR(color) {
		if (typeof color === "string" && color.startsWith("#")) {
			return parseInt(color.substring(1, 3), 16);
		}
		return 128;
	}

	// Step 18) Extract green component from hex color
	extractG(color) {
		if (typeof color === "string" && color.startsWith("#")) {
			return parseInt(color.substring(3, 5), 16);
		}
		return 128;
	}

	// Step 19) Extract blue component from hex color
	extractB(color) {
		if (typeof color === "string" && color.startsWith("#")) {
			return parseInt(color.substring(5, 7), 16);
		}
		return 128;
	}
}

export default PointCloudWriter;
