// src/fileIO/SurpacIO/SurpacDTMWriter.js
//=============================================================
// SURPAC DTM WRITER - DIGITAL TERRAIN MODEL FORMAT
//=============================================================
// Step 1) Exports SURFACES ONLY to Surpac DTM (Digital Terrain Model) format
// Step 2) Format: Y, X, Z, label, description (no string number)
// Step 3) Note: Y comes BEFORE X (Northing, Easting order)
// Step 4) DTM is for point cloud data from surfaces
// Step 5) Reference: BRENTBUFFHAM_BlastToSurpac.pm (adapted for DTM)
// Step 6) Created: 2026-01-05, Updated: 2026-01-05

import BaseWriter from "../BaseWriter.js";

// Step 6) SurpacDTMWriter class
class SurpacDTMWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 7) Writer options
		this.decimalPlaces = options.decimalPlaces !== undefined ? options.decimalPlaces : 3;
		this.defaultLabel = options.defaultLabel || "";
		this.defaultDescription = options.defaultDescription || "";
		this.ssiStyle = options.ssiStyle || "survey.ssi";
	}

	// Step 8) Main write method
	async write(data) {
		// Step 9) Validate input data
		if (!data) {
			throw new Error("Invalid data: data object required");
		}

		// Step 10) Generate DTM content (surfaces only)
		var dtm = "";

		if (data.surfaces && data.surfaces.size > 0) {
			// Step 11) Export surfaces as DTM points (triangle vertices)
			dtm = this.generateDTMFromSurfaces(data.surfaces, data.fileName || "surface");
		} else {
			throw new Error("Invalid data: surfaces required for DTM export");
		}

		// Step 12) Create and return blob
		return this.createBlob(dtm, "text/plain");
	}

	// Step 13) Generate DTM from surfaces (triangle vertices as points)
	generateDTMFromSurfaces(surfaces, fileName) {
		var dtm = "";

		// Step 14) Get current date in dd-Mmm-yy format
		var dateString = this.getDateString();

		// Step 15) Write header line
		dtm += fileName + "," + dateString + ",,ssi_styles:" + this.ssiStyle + "\n";

		// Step 16) Write second line (all zeros)
		dtm += "0,           0.000,           0.000,           0.000,           0.000,           0.000,           0.000\n";

		// Step 17) Collect all unique vertices from all surfaces
		var uniquePoints = new Map();
		var pointIndex = 0;

		surfaces.forEach(function(surface) {
			// Step 18) Skip invisible surfaces
			if (surface.visible === false) return;

			// Step 19) Extract points from triangles
			if (surface.triangles && Array.isArray(surface.triangles)) {
				for (var i = 0; i < surface.triangles.length; i++) {
					var triangle = surface.triangles[i];

					if (!triangle.vertices || triangle.vertices.length < 3) continue;

					// Step 20) Add each vertex as a unique point
					for (var j = 0; j < triangle.vertices.length; j++) {
						var vertex = triangle.vertices[j];
						var key = vertex.x + "_" + vertex.y + "_" + (vertex.z || 0);

						if (!uniquePoints.has(key)) {
							uniquePoints.set(key, {
								x: vertex.x,
								y: vertex.y,
								z: vertex.z || 0,
								surfaceName: surface.name || "Surface",
								index: pointIndex
							});
							pointIndex++;
						}
					}
				}
			}
		});

		// Step 21) Write unique points to DTM
		uniquePoints.forEach(function(point) {
			var formattedY = this.formatNumber(point.y);
			var formattedX = this.formatNumber(point.x);
			var formattedZ = this.formatNumber(point.z);

			var label = point.index.toString();
			var description = point.surfaceName;

			// Step 22) DTM format: Y, X, Z, label, description (with commas)
			dtm += formattedY + "," + formattedX + "," + formattedZ + "," + label + "," + description + "\n";
		}, this);

		// Step 23) Write end marker
		dtm += "0, 0.000, 0.000, 0.000, END\n";

		return dtm;
	}


	// Step 42) Format number with specified decimal places
	formatNumber(value) {
		if (value === undefined || value === null || isNaN(value)) {
			return "0.000";
		}

		// Step 43) DTM uses simple fixed notation (no padding, no scientific notation)
		return parseFloat(value).toFixed(this.decimalPlaces);
	}

	// Step 45) Get date string in dd-Mmm-yy format
	getDateString() {
		var date = new Date();
		var day = date.getDate().toString().padStart(2, "0");
		var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		var month = monthNames[date.getMonth()];
		var year = date.getFullYear().toString().slice(-2);

		return day + "-" + month + "-" + year;
	}
}

export default SurpacDTMWriter;
