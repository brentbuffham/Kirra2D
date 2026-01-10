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
			// Step 11) Export surfaces as DTM (TRISOLATION format)
			// Use baseFileName if provided (for DTM/STR pairing), otherwise fileName
			var baseFileName = data.baseFileName || data.fileName || "surface";
			dtm = this.generateDTMFromSurfaces(data.surfaces, baseFileName);
		} else {
			throw new Error("Invalid data: surfaces required for DTM export");
		}

		// Step 12) Create and return blob
		return this.createBlob(dtm, "text/plain");
	}

	// Step 13) Generate DTM from surfaces (TRISOLATION format)
	generateDTMFromSurfaces(surfaces, fileName) {
		var dtm = "";

		// Step 14) Write header line - references the STR filename
		var strFileName = fileName + ".str";
		dtm += strFileName + ",\n";

		// Step 15) Write second line (simple END marker)
		dtm += "0, 0.000, 0.000, 0.000, END\n";

		// Step 16) Write TRISOLATION section header
		dtm += "OBJECT, 1,\n";
		dtm += "TRISOLATION, 1, neighbours=no,validated=true,closed=no\n";

		// Step 17) Build vertex index map from all surfaces
		// This must match EXACTLY the order written in STR file
		var vertexMap = new Map();
		var vertexIndex = 1; // Surpac vertices start at 1

		surfaces.forEach(function(surface) {
			if (surface.visible === false) return;

			if (surface.triangles && Array.isArray(surface.triangles)) {
				for (var i = 0; i < surface.triangles.length; i++) {
					var triangle = surface.triangles[i];
					if (!triangle.vertices || triangle.vertices.length < 3) continue;

					// Step 18) Add each vertex to map if not already present
					for (var j = 0; j < triangle.vertices.length; j++) {
						var vertex = triangle.vertices[j];
						
						// Step 19) Use same key format as STR writer (3 decimal places)
						var key = this.formatNumber(vertex.x, 3) + "_" + 
								 this.formatNumber(vertex.y, 3) + "_" + 
								 this.formatNumber(vertex.z || 0, 3);

						if (!vertexMap.has(key)) {
							vertexMap.set(key, vertexIndex);
							vertexIndex++;
						}
					}
				}
			}
		}, this);

		// Step 20) Write triangle definitions (vertex indices only, no neighbor info)
		var triangleId = 1;
		surfaces.forEach(function(surface) {
			if (surface.visible === false) return;

			if (surface.triangles && Array.isArray(surface.triangles)) {
				for (var i = 0; i < surface.triangles.length; i++) {
					var triangle = surface.triangles[i];
					if (!triangle.vertices || triangle.vertices.length < 3) continue;

					// Step 21) Get vertex indices for this triangle
					var indices = [];
					for (var j = 0; j < 3; j++) {
						var vertex = triangle.vertices[j];
						var key = this.formatNumber(vertex.x, 3) + "_" + 
								 this.formatNumber(vertex.y, 3) + "_" + 
								 this.formatNumber(vertex.z || 0, 3);

						var index = vertexMap.get(key);
						if (index !== undefined) {
							indices.push(index);
						}
					}

					// Step 22) Write triangle line: id, v1, v2, v3, neighbor1, neighbor2, neighbor3, 0,
					// Neighbors all set to 0 (no neighbor info calculated)
					if (indices.length === 3) {
						dtm += triangleId + ", " + indices[0] + ", " + indices[1] + ", " + 
							   indices[2] + ", 0, 0, 0,\n";
						triangleId++;
					}
				}
			}
		}, this);

		// Step 23) Write end marker
		dtm += "END\n";

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
