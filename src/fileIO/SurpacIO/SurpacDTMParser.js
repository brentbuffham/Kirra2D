// src/fileIO/SurpacIO/SurpacDTMParser.js
//=============================================================
// SURPAC DTM PARSER - DIGITAL TERRAIN MODEL FORMAT
//=============================================================
// Step 1) Parses Surpac DTM (Digital Terrain Model) format files
// Step 2) Format: Y, X, Z, label, description (point cloud)
// Step 3) Note: Y comes BEFORE X (Northing, Easting order)
// Step 4) DTM files contain unique vertices from surfaces
// Step 5) Reference: mka_pd_stg4_202406_v1.dtm
// Step 6) Created: 2026-01-05

import BaseParser from "../BaseParser.js";

// Step 7) SurpacDTMParser class
class SurpacDTMParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	// Step 8) Main parse method
	async parse(content) {
		// Step 9) Validate input
		if (!content || typeof content !== "string") {
			throw new Error("Invalid content: string required");
		}

		// Step 10) Split into lines
		var lines = content.split(/\r?\n/);

		// Step 11) Initialize point cloud array
		var points = [];

		// Step 12) Parse header (skip first 2 lines)
		if (lines.length < 3) {
			throw new Error("Invalid DTM file: too few lines");
		}

		// Skip header line (line 0) - contains name, date, ssi path
		// Skip second line (line 1) - contains zeros

		// Step 13) Parse data lines
		for (var i = 2; i < lines.length; i++) {
			var line = lines[i].trim();

			// Step 14) Skip empty lines
			if (!line) continue;

			// Step 15) Check for end marker
			if (line.indexOf("END") !== -1) {
				break;
			}

			// Step 16) Check for separator (starts with "0,")
			if (line.startsWith("0,") || line.startsWith("0 ")) {
				continue;
			}

			// Step 17) Parse point line
			// Format: "        Y X Z label,description"
			// Example: "        6771714.007 478114.535 239.000 0,Surface_0"

			// Split by whitespace and commas
			var cleanLine = line.replace(/\s+/g, " ").trim();
			var parts = cleanLine.split(" ");

			if (parts.length < 3) continue;

			// Step 18) Extract coordinates
			var y = parseFloat(parts[0]);
			var x = parseFloat(parts[1]);
			var z = parseFloat(parts[2]);

			// Step 19) Extract label and description (if present)
			var label = "";
			var description = "";

			if (parts.length >= 4) {
				// Remaining parts form label,description
				var rest = parts.slice(3).join(" ");
				var labelParts = rest.split(",");
				label = labelParts[0] || "";
				description = labelParts[1] || "";
			}

			// Step 20) Validate coordinates
			if (isNaN(x) || isNaN(y) || isNaN(z)) {
				continue;
			}

			// Step 21) Add point to array
			points.push({
				x: x,
				y: y,
				z: z,
				label: label,
				description: description
			});
		}

		// Step 22) Return parsed data as point cloud
		return {
			pointCloud: points
		};
	}
}

export default SurpacDTMParser;
