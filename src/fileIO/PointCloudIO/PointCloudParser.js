// src/fileIO/PointCloudIO/PointCloudParser.js
//=============================================================
// POINT CLOUD PARSER - Using PapaParse for robust CSV handling
//=============================================================
// Supports multiple point cloud text formats:
//
// XYZ Format (.xyz, .txt):
//   - Simple text, one point per line: X Y Z
//   - Optional RGB: X Y Z R G B
//   - Optional intensity: X Y Z I or X Y Z I R G B
//   - Delimiters: auto-detected by PapaParse
//   - Comments: // or # prefix
//
// PTS Format (.pts):
//   - First line: point count (integer)
//   - Data lines: X Y Z I R G B (intensity + RGB)
//
// PTX Format (.ptx) - Leica scanner format:
//   - Header: columns, rows, scanner position, transform matrix (4x4)
//   - Data lines: X Y Z I R G B (local coords, transformed by matrix)
//   - Multiple scans can be concatenated
//
// CSV Format (.csv):
//   - Comma-separated with optional header row
//   - PapaParse auto-detects delimiter and headers
//
// Created: 2026-01-03, Updated: 2026-02-07

import BaseParser from "../BaseParser.js";
import Papa from "papaparse";

export default class PointCloudParser extends BaseParser {
	constructor() {
		super();
	}

	// Step 1) Main parse entry point
	async parse(data) {
		if (!data || (!data.content && !data.csvContent)) {
			throw new Error("PointCloudParser requires content or csvContent parameter");
		}

		var content = data.content || data.csvContent;
		var fileName = data.fileName || "";

		return this.parsePointCloudData(content, fileName);
	}

	// Step 2) Detect format type (PTX, PTS, or general CSV/XYZ)
	detectFormat(lines) {
		for (var i = 0; i < Math.min(lines.length, 5); i++) {
			var line = lines[i].trim();
			if (!line) continue;

			// PTX format: two consecutive integers (columns, rows)
			if (/^\d+$/.test(line) && i + 1 < lines.length) {
				var nextLine = lines[i + 1].trim();
				if (/^\d+$/.test(nextLine)) {
					return { format: "ptx", startIndex: i };
				}
				// Single integer = PTS format (point count)
				return { format: "pts", startIndex: i + 1, pointCount: parseInt(line) };
			}

			// Skip comments
			if (line.startsWith("//") || line.startsWith("#")) {
				continue;
			}

			// General format - let PapaParse handle it
			return { format: "csv", startIndex: i };
		}

		return { format: "csv", startIndex: 0 };
	}

	// Step 3) Core point cloud parsing logic
	parsePointCloudData(content, fileName) {
		var lines = content.split("\n");
		var formatInfo = this.detectFormat(lines);

		console.log("Point Cloud Parser: Detected format:", formatInfo.format);

		// PTX requires special handling (transformation matrix)
		if (formatInfo.format === "ptx") {
			return this.parsePTXData(lines, fileName);
		}

		// For PTS and CSV/XYZ, use PapaParse
		return this.parseWithPapaParse(content, formatInfo, fileName);
	}

	// Step 4) Parse using PapaParse for robust delimiter detection
	parseWithPapaParse(content, formatInfo, fileName) {
		var points = [];

		// Pre-process: remove comment lines (PapaParse doesn't handle // comments)
		var processedLines = content.split("\n").filter(function(line) {
			var trimmed = line.trim();
			return trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("#");
		});

		// For PTS format, skip the point count line
		if (formatInfo.format === "pts" && processedLines.length > 0) {
			var firstLine = processedLines[0].trim();
			if (/^\d+$/.test(firstLine)) {
				processedLines.shift();
			}
		}

		var processedContent = processedLines.join("\n");

		// Use PapaParse with auto-detection
		var parseResult = Papa.parse(processedContent, {
			dynamicTyping: true,      // Auto-convert numbers
			skipEmptyLines: true,     // Skip empty lines
			delimitersToGuess: [",", "\t", ";", " ", "|"]  // Common delimiters
		});

		if (parseResult.errors.length > 0) {
			console.warn("Point Cloud Parser: PapaParse warnings:", parseResult.errors);
		}

		// Determine column structure from first valid row
		var hasIntensity = false;
		var hasRGB = false;
		var columnCount = 0;

		if (parseResult.data.length > 0) {
			// Find first row with numeric data
			for (var i = 0; i < Math.min(parseResult.data.length, 5); i++) {
				var row = parseResult.data[i];
				if (row.length >= 3 && typeof row[0] === "number") {
					columnCount = row.length;
					break;
				}
			}

			// Determine fields based on column count
			// 3 cols: X Y Z
			// 4 cols: X Y Z I (intensity)
			// 6 cols: X Y Z R G B
			// 7 cols: X Y Z I R G B (PTS format)
			if (columnCount >= 7) {
				hasIntensity = true;
				hasRGB = true;
			} else if (columnCount >= 6) {
				hasRGB = true;
			} else if (columnCount >= 4) {
				hasIntensity = true;
			}
		}

		console.log("Point Cloud Parser: Columns:", columnCount,
			"Intensity:", hasIntensity, "RGB:", hasRGB);

		// Process each row
		for (var i = 0; i < parseResult.data.length; i++) {
			var row = parseResult.data[i];

			// Need at least X, Y, Z
			if (row.length >= 3) {
				var x = row[0];
				var y = row[1];
				var z = row[2];

				// Skip non-numeric rows (headers)
				if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
					continue;
				}

				if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
					var point = { x: x, y: y, z: z };

					// Parse optional fields
					if (columnCount >= 7 && row.length >= 7) {
						// X Y Z I R G B format
						point.intensity = row[3];
						point.r = Math.round(row[4]);
						point.g = Math.round(row[5]);
						point.b = Math.round(row[6]);
					} else if (columnCount >= 6 && row.length >= 6) {
						// X Y Z R G B format
						point.r = Math.round(row[3]);
						point.g = Math.round(row[4]);
						point.b = Math.round(row[5]);
					} else if (columnCount >= 4 && row.length >= 4) {
						// X Y Z I format
						point.intensity = row[3];
					}

					points.push(point);
				}
			}
		}

		console.log("Point Cloud Parser: " + points.length + " points loaded" +
			(hasRGB ? " with RGB" : "") +
			(hasIntensity ? " with intensity" : ""));

		return {
			points: points,
			metadata: {
				format: formatInfo.format,
				hasRGB: hasRGB,
				hasIntensity: hasIntensity,
				columnCount: columnCount,
				fileName: fileName
			}
		};
	}

	// Step 5) PTX format parser (Leica scanner format)
	parsePTXData(lines, fileName) {
		var points = [];
		var scanCount = 0;
		var i = 0;

		while (i < lines.length) {
			var line = lines[i].trim();
			if (!line) {
				i++;
				continue;
			}

			// Read PTX header: columns, rows
			var columns = parseInt(lines[i].trim());
			if (isNaN(columns) || i + 1 >= lines.length) break;

			var rows = parseInt(lines[i + 1].trim());
			if (isNaN(rows)) break;

			var pointCount = columns * rows;
			i += 2;

			// Read scanner position and orientation (4 lines)
			if (i + 4 > lines.length) break;
			i += 4;

			// Read 4x4 transformation matrix
			if (i + 4 > lines.length) break;
			var matrix = [];
			for (var m = 0; m < 4; m++) {
				var matrixLine = lines[i + m].trim().split(/\s+/);
				matrix.push([
					parseFloat(matrixLine[0]) || 0,
					parseFloat(matrixLine[1]) || 0,
					parseFloat(matrixLine[2]) || 0,
					parseFloat(matrixLine[3]) || 0
				]);
			}
			i += 4;

			console.log("Point Cloud Parser: PTX scan " + (scanCount + 1) +
				" - " + columns + "x" + rows + " = " + pointCount + " points");

			// Read point data
			var scanPoints = 0;
			while (scanPoints < pointCount && i < lines.length) {
				line = lines[i].trim();
				if (!line) {
					i++;
					continue;
				}

				var parts = line.split(/\s+/);
				if (parts.length >= 3) {
					var localX = parseFloat(parts[0]);
					var localY = parseFloat(parts[1]);
					var localZ = parseFloat(parts[2]);

					if (!isNaN(localX) && !isNaN(localY) && !isNaN(localZ)) {
						// Skip null points (0 0 0 with 0 intensity)
						if (localX !== 0 || localY !== 0 || localZ !== 0 || parts.length > 3) {
							// Apply transformation matrix
							var worldX = matrix[0][0] * localX + matrix[0][1] * localY + matrix[0][2] * localZ + matrix[0][3];
							var worldY = matrix[1][0] * localX + matrix[1][1] * localY + matrix[1][2] * localZ + matrix[1][3];
							var worldZ = matrix[2][0] * localX + matrix[2][1] * localY + matrix[2][2] * localZ + matrix[2][3];

							var point = { x: worldX, y: worldY, z: worldZ };

							if (parts.length >= 4) {
								point.intensity = parseFloat(parts[3]);
							}
							if (parts.length >= 7) {
								point.r = parseInt(parts[4]);
								point.g = parseInt(parts[5]);
								point.b = parseInt(parts[6]);
							}

							points.push(point);
						}
					}
				}
				scanPoints++;
				i++;
			}

			scanCount++;
		}

		console.log("Point Cloud Parser: PTX total " + points.length + " points from " + scanCount + " scan(s)");

		return {
			points: points,
			metadata: {
				format: "ptx",
				hasRGB: points.length > 0 && points[0].r !== undefined,
				hasIntensity: points.length > 0 && points[0].intensity !== undefined,
				scanCount: scanCount,
				fileName: fileName
			}
		};
	}

	// Step 6) Legacy method for backward compatibility
	parseCSVData(content) {
		var result = this.parsePointCloudData(content, "");
		return result.points;
	}
}
