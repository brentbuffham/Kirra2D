// src/fileIO/TextIO/GeofenceWriter.js
//=============================================================
// GEOFENCE/HAZARD/SOCKETS WRITER - Y,X FORMAT
//=============================================================
// Step 1) Exports points to Y,X coordinate files
// Step 2) Supports .geofence, .hazard, .sockets file formats
// Step 3) Format: Each line contains Y,X coordinates
// Step 4) Created: 2026-01-04
// Step 5) Note: Y,X order (NOT X,Y)

import BaseWriter from "../BaseWriter.js";

// Step 6) GeofenceWriter class
class GeofenceWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 7) Writer options
		this.delimiter = options.delimiter || ",";
		this.includeZ = options.includeZ || false; // Include Z coordinate
		this.decimalPlaces = options.decimalPlaces || 4;
		this.includeHeader = options.includeHeader || false;
		this.headerText = options.headerText || "# Y,X Coordinates";
	}

	// Step 8) Main write method
	async write(data) {
		// Step 9) Validate input data
		if (!data || !Array.isArray(data.points)) {
			throw new Error("Invalid data: points array required");
		}

		// Step 10) Filter visible points
		var visiblePoints = data.points.filter(function (point) {
			return point.visible !== false;
		});

		if (visiblePoints.length === 0) {
			throw new Error("No visible points to export");
		}

		// Step 11) Generate file content
		var content = "";

		// Step 12) Add header if enabled
		if (this.includeHeader) {
			content += this.headerText + "\n";
		}

		// Step 13) Write each point as Y,X (or Y,X,Z)
		for (var i = 0; i < visiblePoints.length; i++) {
			var point = visiblePoints[i];

			// Step 14) Extract coordinates
			var x = point.pointXLocation || 0;
			var y = point.pointYLocation || 0;
			var z = point.pointZLocation || 0;

			// Step 15) Format to decimal places
			var yStr = y.toFixed(this.decimalPlaces);
			var xStr = x.toFixed(this.decimalPlaces);

			// Step 16) Write Y,X (NOTE: Y comes first!)
			if (this.includeZ) {
				var zStr = z.toFixed(this.decimalPlaces);
				content += yStr + this.delimiter + xStr + this.delimiter + zStr + "\n";
			} else {
				content += yStr + this.delimiter + xStr + "\n";
			}
		}

		// Step 17) Create and return blob
		return this.createBlob(content, "text/plain");
	}
}

export default GeofenceWriter;
