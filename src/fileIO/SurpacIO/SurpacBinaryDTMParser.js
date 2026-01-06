// src/fileIO/SurpacIO/SurpacBinaryDTMParser.js
//=============================================================
// SURPAC BINARY DTM PARSER - DIGITAL TERRAIN MODEL (BINARY)
//=============================================================
// Step 1) Parses binary Surpac DTM files
// Step 2) Format: Text header + binary point data
// Step 3) Binary data: double-precision floats (8 bytes each)
// Step 4) Reference: mka_pd_stg4_202406_v1.dtm
// Step 5) Created: 2026-01-05

import BaseParser from "../BaseParser.js";

// Step 6) SurpacBinaryDTMParser class
class SurpacBinaryDTMParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	// Step 7) Main parse method
	async parse(content) {
		// Step 8) Validate input (content should be ArrayBuffer for binary)
		if (!content) {
			throw new Error("Invalid content: ArrayBuffer or string required");
		}

		// Step 9) Handle both ArrayBuffer and string inputs
		var buffer;
		if (typeof content === "string") {
			// Convert string to ArrayBuffer
			buffer = this.stringToArrayBuffer(content);
		} else if (content instanceof ArrayBuffer) {
			buffer = content;
		} else {
			throw new Error("Invalid content type: ArrayBuffer or string expected");
		}

		// Step 10) Parse header (first line is text)
		var headerEnd = this.findHeaderEnd(buffer);
		var headerBytes = new Uint8Array(buffer, 0, headerEnd);
		var header = String.fromCharCode.apply(null, headerBytes);

		console.log("Binary DTM header:", header);

		// Step 11) Parse binary point data
		var points = this.parseBinaryPoints(buffer, headerEnd);

		console.log("Parsed " + points.length + " points from binary DTM");

		// Step 12) Return point cloud
		return {
			pointCloud: points
		};
	}

	// Step 13) Find end of text header (look for \n\n or \r\n\r\n or first 0x00 byte)
	findHeaderEnd(buffer) {
		var view = new Uint8Array(buffer);

		// Look for double newline or first null byte
		for (var i = 0; i < Math.min(view.length, 1000); i++) {
			// Check for \r\n pattern followed by binary data
			if (view[i] === 0x0D && view[i + 1] === 0x0A) {
				// Check if next byte looks like binary data (not ASCII)
				if (i + 2 < view.length && view[i + 2] === 0x00) {
					return i + 2; // Start of binary data
				}
			}
			// Check for null byte
			if (view[i] === 0x00) {
				return i;
			}
		}

		// Default: assume header is first line
		return 100;
	}

	// Step 14) Parse binary point data
	parseBinaryPoints(buffer, offset) {
		var view = new DataView(buffer, offset);
		var points = [];
		var pos = 0;

		// Step 15) Binary format appears to be:
		// - 1 byte: flag/marker (0x00 or 0x01)
		// - 8 bytes: Y (double)
		// - 8 bytes: X (double)
		// - 8 bytes: Z (double)
		// Total: 25 bytes per point

		var recordSize = 25; // 1 + 8 + 8 + 8

		try {
			while (pos + recordSize <= view.byteLength) {
				// Read flag byte
				var flag = view.getUint8(pos);
				pos += 1;

				// Skip if not a valid flag (only process 0x00 or 0x01)
				if (flag > 1) {
					break;
				}

				// Read Y, X, Z as doubles (little-endian)
				var y = view.getFloat64(pos, true);
				pos += 8;

				var x = view.getFloat64(pos, true);
				pos += 8;

				var z = view.getFloat64(pos, true);
				pos += 8;

				// Validate coordinates (check for NaN or unreasonable values)
				if (isNaN(x) || isNaN(y) || isNaN(z)) {
					continue;
				}

				// Add point
				points.push({
					x: x,
					y: y,
					z: z,
					flag: flag
				});
			}
		} catch (error) {
			console.warn("Error parsing binary DTM at position " + pos + ":", error);
		}

		return points;
	}

	// Step 16) Convert string to ArrayBuffer (for when file is read as text)
	stringToArrayBuffer(str) {
		var buf = new ArrayBuffer(str.length);
		var bufView = new Uint8Array(buf);
		for (var i = 0; i < str.length; i++) {
			bufView[i] = str.charCodeAt(i) & 0xFF;
		}
		return buf;
	}
}

export default SurpacBinaryDTMParser;
