// src/fileIO/EpirocIO/SurfaceManagerParser.js
//=============================================================
// EPIROC SURFACE MANAGER PARSER - GEOFENCE/HAZARD/SOCKETS
//=============================================================
// Step 1) Parses Epiroc Surface Manager Y,X coordinate files
// Step 2) Supports .geofence, .hazard, .sockets file formats
// Step 3) Format: Each line contains Y,X coordinates
// Step 4) Created: 2026-01-04, Moved to EpirocIO: 2026-01-07
// Step 5) Note: Y,X order (NOT X,Y)

import BaseParser from "../BaseParser.js";

// Step 6) SurfaceManagerParser class
class SurfaceManagerParser extends BaseParser {
	constructor(options = {}) {
		super(options);

		// Step 7) Parser options
		this.delimiter = options.delimiter || ",";
		this.skipEmptyLines = options.skipEmptyLines !== false; // Default true
		this.skipHeaderLines = options.skipHeaderLines || 0;
	}

	// Step 8) Main parse method
	async parse(file) {
		// Step 9) Read file as text
		var data = await this.readAsText(file);

		// Step 10) Split into lines
		var lines = data.split("\n");

		// Step 11) Process lines into points
		var points = [];
		var lineNumber = 0;

		for (var i = 0; i < lines.length; i++) {
			lineNumber++;
			var line = lines[i].trim();

			// Step 12) Skip empty lines if configured
			if (this.skipEmptyLines && line === "") {
				continue;
			}

			// Step 13) Skip header lines if configured
			if (lineNumber <= this.skipHeaderLines) {
				continue;
			}

			// Step 14) Skip comment lines (starting with # or //)
			if (line.startsWith("#") || line.startsWith("//")) {
				continue;
			}

			// Step 15) Split by delimiter
			var parts = line.split(this.delimiter);

			// Step 16) Expect at least 2 values (Y, X)
			if (parts.length < 2) {
				console.warn("SurfaceManagerParser: Line " + lineNumber + " has insufficient values: " + line);
				continue;
			}

			// Step 17) Parse Y,X coordinates (NOTE: Y comes first!)
			var y = parseFloat(parts[0].trim());
			var x = parseFloat(parts[1].trim());
			var z = parts.length >= 3 ? parseFloat(parts[2].trim()) : 0;

			// Step 18) Validate coordinates
			if (isNaN(x) || isNaN(y)) {
				console.warn("SurfaceManagerParser: Line " + lineNumber + " has invalid coordinates: " + line);
				continue;
			}

			// Step 19) Create point object
			var point = {
				pointXLocation: x, // Note: stored as X
				pointYLocation: y, // Note: stored as Y
				pointZLocation: isNaN(z) ? 0 : z,
				entityType: "point",
				entityName: this.getEntityNameFromFile(file),
				visible: true
			};

			points.push(point);
		}

		// Step 20) Return parsed points (raw data - elevation will be applied by import handler)
		return {
			points: points,
			entityName: this.getEntityNameFromFile(file),
			metadata: {
				totalLines: lines.length,
				parsedPoints: points.length,
				fileType: this.getFileTypeFromExtension(file.name)
			}
		};
	}

	// Step 21) Get entity name from filename
	getEntityNameFromFile(file) {
		var fileName = file.name || "Unknown";
		var baseName = fileName.split(".")[0];
		return baseName || "Imported_Points";
	}

	// Step 22) Get file type from extension
	getFileTypeFromExtension(fileName) {
		var ext = fileName.split(".").pop().toLowerCase();

		if (ext === "geofence") return "Geofence";
		if (ext === "hazard") return "Hazard";
		if (ext === "sockets") return "Sockets";

		return "Unknown";
	}
}

export default SurfaceManagerParser;

