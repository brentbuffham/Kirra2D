// src/fileIO/PointCloudIO/PointCloudParser.js
//=============================================================
// POINT CLOUD CSV PARSER
//=============================================================
// Step 1) Parse CSV point cloud files (x,y,z format)
// Step 2) Auto-detects header row
// Step 3) Returns array of {x, y, z} points
// Step 4) Created: 2026-01-03

import BaseParser from "../BaseParser.js";

export default class PointCloudParser extends BaseParser {
	constructor() {
		super();
	}

	// Step 1) Main parse entry point
	async parse(data) {
		// Step 2) Validate input data
		if (!data || (!data.content && !data.csvContent)) {
			throw new Error("PointCloudParser requires content or csvContent parameter");
		}

		var content = data.content || data.csvContent;

		// Step 3) Call the core parsing logic
		var points = this.parseCSVData(content);

		return { points: points };
	}

	// Step 2) Core CSV point cloud parsing logic (extracted from kirra.js:36859-36890)
	parseCSVData(content) {
		// Step 3) Split content into lines
		var lines = content.split("\n");
		var points = [];
		var hasHeader = false;

		// Step 4) Check if first line looks like a header
		var firstLine = lines[0].trim();
		if (firstLine.toLowerCase().includes("x") || firstLine.toLowerCase().includes("y") || firstLine.toLowerCase().includes("z")) {
			hasHeader = true;
		}

		var startIndex = hasHeader ? 1 : 0;

		// Step 5) Parse each line as comma-separated x,y,z values
		for (var i = startIndex; i < lines.length; i++) {
			var parts = lines[i].trim().split(",");
			if (parts.length >= 3) {
				var x = parseFloat(parts[0]);
				var y = parseFloat(parts[1]);
				var z = parseFloat(parts[2]);

				if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
					points.push({
						x: x,
						y: y,
						z: z,
					});
				}
			}
		}

		console.log("Point Cloud Parser: " + points.length + " points loaded");

		return points;
	}
}
