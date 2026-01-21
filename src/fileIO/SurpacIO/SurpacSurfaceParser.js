// src/fileIO/SurpacIO/SurpacSurfaceParser.js
//=============================================================
// SURPAC SURFACE PARSER - DTM + STR PAIR
//=============================================================
// Step 1) Parses paired Surpac surface files (DTM + STR)
// Step 2) STR file: Vertex list (Y, X, Z coordinates) - text or binary
// Step 3) DTM file: Triangle list (indices into vertex list) - text or binary
// Step 4) Together they create a triangulated surface
// Step 5) Reference: 251228_s4_226_406_topo.dtm + .str (text)
// Step 6) Reference: mka_pd_stg4_202406_v1.dtm + .str (binary)
// Step 7) Created: 2026-01-05

import BaseParser from "../BaseParser.js";
// NOTE: SurpacBinarySTRParser import removed - binary parsing now handled inline

// Step 7) SurpacSurfaceParser class
class SurpacSurfaceParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	// Step 8) Main parse method - requires both STR and DTM content
	async parse(data) {
		// Step 9) Validate input
		if (!data || typeof data !== "object") {
			throw new Error("Invalid data: object with strContent and dtmContent required");
		}

		var strContent = data.strContent;
		var dtmContent = data.dtmContent;

		if (!strContent || !dtmContent) {
			throw new Error("Both STR and DTM content required for surface import");
		}

		// Step 10) Parse vertices from STR file (may be async for binary)
		var vertices = await this.parseVertices(strContent);

		// Step 11) Parse triangles from DTM file (text or binary)
		var isBinaryDTM = this.isBinaryContent(dtmContent);
		var triangleGroups;

		if (isBinaryDTM) {
			console.log("Parsing binary DTM triangles");
			var binaryTriangles = this.parseBinaryTriangles(dtmContent, vertices);
			triangleGroups = binaryTriangles.length > 0 ? [binaryTriangles] : [];
		} else {
			console.log("Parsing text DTM triangles");
			triangleGroups = this.parseTriangles(dtmContent, vertices);
		}

		// Step 12) Create surface objects fully in memory before exposing to UI
		var baseName = data.surfaceName || "Surpac_Surface";
		var surfaces = [];

		for (var gi = 0; gi < triangleGroups.length; gi++) {
			var groupTriangles = triangleGroups[gi];
			if (!groupTriangles || groupTriangles.length === 0) {
				continue;
			}

			// Step 12a) Name parts if multiple surfaces are present
			var surfaceName = baseName;
			if (triangleGroups.length > 1) {
				surfaceName = baseName + "_part" + (gi + 1);
			}

			// Step 12a.1) Calculate meshBounds from vertices for centroid calculation
			// CRITICAL: Without meshBounds, centroid calculation cannot use this surface data
			var minX = Infinity, maxX = -Infinity;
			var minY = Infinity, maxY = -Infinity;
			var minZ = Infinity, maxZ = -Infinity;
			for (var vi = 0; vi < vertices.length; vi++) {
				var v = vertices[vi];
				if (v.x < minX) minX = v.x;
				if (v.x > maxX) maxX = v.x;
				if (v.y < minY) minY = v.y;
				if (v.y > maxY) maxY = v.y;
				if (v.z < minZ) minZ = v.z;
				if (v.z > maxZ) maxZ = v.z;
			}
			var meshBounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ };

			// Step 12b) Create surface object
			var surface = {
				name: surfaceName,
				visible: true,
				color: data.color || "#00FF00",
				triangles: groupTriangles,
				points: vertices, // Expose vertices as points for tree view and rendering
				meshBounds: meshBounds, // CRITICAL: Add meshBounds for centroid calculation
				vertexCount: vertices.length,
				triangleCount: groupTriangles.length
			};

			surfaces.push(surface);
		}

		// Step 13) Return surface collection
		return {
			surfaces: surfaces
		};
	}

	// Step 14) Parse vertices from STR file (text or binary)
	async parseVertices(strContent) {
		// Step 15) Detect binary vs text format
		var isBinary = this.isBinaryContent(strContent);

		if (isBinary) {
			console.log("Parsing binary STR vertices");
			return await this.parseBinaryVertices(strContent);
		} else {
			console.log("Parsing text STR vertices");
			return this.parseTextVertices(strContent);
		}
	}

	// Step 16) Detect if content is binary
	isBinaryContent(content) {
		// Convert ArrayBuffer to Uint8Array for inspection
		var bytes;
		if (typeof content === "string") {
			// String content - check directly
			for (var i = 0; i < Math.min(content.length, 500); i++) {
				var code = content.charCodeAt(i);
				// Null bytes indicate binary
				if (code === 0) return true;
			}
			return false;
		} else if (content instanceof ArrayBuffer) {
			// ArrayBuffer - need to inspect bytes
			bytes = new Uint8Array(content);
		} else {
			// Unknown format
			return false;
		}

		// Check first 1000 bytes for binary patterns
		var checkLength = Math.min(bytes.length, 1000);
		var nullCount = 0;
		var highByteCount = 0;
		var printableCount = 0;

		for (var i = 0; i < checkLength; i++) {
			var byte = bytes[i];

			// Count null bytes
			if (byte === 0x00) {
				nullCount++;
			}

			// Count high bytes (>127)
			if (byte > 127) {
				highByteCount++;
			}

			// Count printable ASCII (space to ~, plus newlines/tabs)
			if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
				printableCount++;
			}
		}

		// If more than 5% null bytes, it's binary
		if (nullCount > checkLength * 0.05) {
			return true;
		}

		// If more than 90% printable ASCII, it's text
		if (printableCount > checkLength * 0.9) {
			return false;
		}

		// If more than 30% high bytes, it's binary
		if (highByteCount > checkLength * 0.3) {
			return true;
		}

		// Default: assume text
		return false;
	}

	// Step 17) Parse binary vertices for surface data
	async parseBinaryVertices(strContent) {
		// Step 17a) Convert to ArrayBuffer if needed
		var buffer;
		if (typeof strContent === "string") {
			buffer = this.stringToArrayBuffer(strContent);
		} else if (strContent instanceof ArrayBuffer) {
			buffer = strContent;
		} else {
			console.warn("Invalid STR content type for binary parsing");
			return [];
		}

		// Step 17b) Find header end
		var headerEnd = this.findBinarySTRHeaderEnd(buffer);
		console.log("Binary STR: headerEnd=" + headerEnd + ", totalSize=" + buffer.byteLength);

		// Step 17c) Parse binary vertex data
		// Binary STR format: skip null padding, then 1-byte string#, then Y,X,Z as big-endian doubles
		var vertices = [];
		var bytes = new Uint8Array(buffer, headerEnd);
		var pos = 0;

		try {
			while (pos < bytes.length - 25) {
				// Step 17d) Skip null padding to find next record
				while (pos < bytes.length && bytes[pos] === 0x00) {
					pos++;
				}

				if (pos >= bytes.length - 24) break;

				// Step 17e) Read string number (1 byte)
				// Surpac binary STR uses 1-byte string numbers
				var stringNumber = bytes[pos];
				pos++;

				// Step 17f) String# 0 = null record, skip; validate range (1-255)
				if (stringNumber === 0) {
					continue;
				}

				// Step 17g) Read Y, X, Z as doubles (BIG-ENDIAN for Surpac)
				if (pos + 24 > bytes.length) break;

				var view = new DataView(bytes.buffer, bytes.byteOffset + pos);
				var y = view.getFloat64(0, false); // big-endian
				var x = view.getFloat64(8, false);
				var z = view.getFloat64(16, false);
				pos += 24;

				// Step 17h) Validate coordinates - must be reasonable UTM-range values
				if (isNaN(x) || isNaN(y) || isNaN(z)) {
					continue;
				}

				// Step 17i) Additional validation: reject garbage values
				if (Math.abs(x) > 1e12 || Math.abs(y) > 1e12 || Math.abs(z) > 1e12) {
					continue;
				}

				// Step 17j) Add vertex
				vertices.push({
					x: x,
					y: y,
					z: z
				});
			}
		} catch (error) {
			console.warn("Error parsing binary STR vertices at position " + pos + ":", error);
		}

		console.log("Parsed " + vertices.length + " vertices from binary STR file");
		return vertices;
	}

	// Step 17k) Find end of binary STR header
	findBinarySTRHeaderEnd(buffer) {
		var view = new Uint8Array(buffer);
		var lineCount = 0;

		for (var i = 0; i < Math.min(view.length, 500); i++) {
			if (view[i] === 0x0A) {
				lineCount++;
				if (lineCount === 2) {
					return i + 1;
				}
			}
		}

		return 200;
	}

	// Step 18) Parse text vertices
	parseTextVertices(strContent) {
		// Convert ArrayBuffer to string if needed
		if (strContent instanceof ArrayBuffer) {
			var decoder = new TextDecoder("utf-8");
			strContent = decoder.decode(strContent);
		}

		var lines = strContent.split(/\r?\n/);
		var vertices = [];

		// Step 19) Skip header (first 2 lines)
		for (var i = 2; i < lines.length; i++) {
			var line = lines[i].trim();

			// Step 16) Skip empty lines
			if (!line) continue;

			// Step 17) Check for end marker
			if (line.indexOf("END") !== -1) {
				break;
			}

			// Step 18) Check for separator
			if (line.startsWith("0,") || line.startsWith("0 ")) {
				continue;
			}

			// Step 19) Parse vertex line
			// Format: "string_number, Y, X, Z"
			var parts = line.split(",").map(function(p) {
				return p.trim();
			});

			if (parts.length < 4) continue;

			var stringNumber = parseInt(parts[0]);
			if (stringNumber === 0) continue; // Skip separators

			var y = parseFloat(parts[1]);
			var x = parseFloat(parts[2]);
			var z = parseFloat(parts[3]);

			// Step 20) Validate coordinates
			if (isNaN(x) || isNaN(y) || isNaN(z)) {
				continue;
			}

			// Step 21) Add vertex (1-based index in Surpac)
			vertices.push({
				x: x,
				y: y,
				z: z
			});
		}

		console.log("Parsed " + vertices.length + " vertices from STR file");
		return vertices;
	}

	// Step 22) Parse triangles from DTM file
	parseTriangles(dtmContent, vertices) {
		// Convert ArrayBuffer to string if needed
		if (dtmContent instanceof ArrayBuffer) {
			var decoder = new TextDecoder("utf-8");
			dtmContent = decoder.decode(dtmContent);
		}

		var lines = dtmContent.split(/\r?\n/);
		var surfacesTriangles = [];
		var currentTriangles = [];
		var inTriangles = false;

		// Step 23) Parse DTM file
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();

			// Step 24) Skip empty lines
			if (!line) continue;

			// Step 26) Check for TRISOLATION marker (start of triangle list)
			if (line.indexOf("TRISOLATION") !== -1) {
				// Step 26a) If already collecting triangles, close previous surface group
				if (inTriangles && currentTriangles.length > 0) {
					surfacesTriangles.push(currentTriangles);
					currentTriangles = [];
				}
				inTriangles = true;
				continue;
			}

			// Step 25) Object break: "0, 0.000, 0.000, 0.000," signals a new surface group while staying in triangle mode
			if (line.startsWith("0,")) {
				if (inTriangles) {
					if (currentTriangles.length > 0) {
						surfacesTriangles.push(currentTriangles);
					}
					currentTriangles = [];
				}
				// Stay inTriangles (do not require another TRISOLATION)
				continue;
			}

			// Step 27) Check for OBJECT marker
			if (line.indexOf("OBJECT") !== -1) {
				continue;
			}

			// Step 27a) Ignore any lines until triangles start
			if (!inTriangles) {
				continue;
			}

			// Step 28) Parse triangle line
			if (inTriangles) {
				// Format: "triangle_id, v1_index, v2_index, v3_index, 0, 0, 0,"
				var parts = line.split(",").map(function(p) {
					return p.trim();
				});

				if (parts.length < 4) continue;

				var triangleId = parseInt(parts[0]);
				var v1Index = parseInt(parts[1]) - 1; // Convert from 1-based to 0-based
				var v2Index = parseInt(parts[2]) - 1;
				var v3Index = parseInt(parts[3]) - 1;

				// Step 29) Validate indices
				if (isNaN(v1Index) || isNaN(v2Index) || isNaN(v3Index)) {
					continue;
				}

				if (v1Index < 0 || v1Index >= vertices.length || v2Index < 0 || v2Index >= vertices.length || v3Index < 0 || v3Index >= vertices.length) {
					console.warn("Triangle " + triangleId + " has invalid vertex index");
					continue;
				}

				// Step 30) Create triangle
				var triangle = {
					vertices: [vertices[v1Index], vertices[v2Index], vertices[v3Index]]
				};

				currentTriangles.push(triangle);
			}
		}

		// Step 30a) Push any remaining triangles as final surface
		if (currentTriangles.length > 0) {
			surfacesTriangles.push(currentTriangles);
		}

		// Step 30b) Log summary
		var totalTriangles = 0;
		for (var si = 0; si < surfacesTriangles.length; si++) {
			totalTriangles += surfacesTriangles[si].length;
		}
		console.log("Parsed " + totalTriangles + " triangles across " + surfacesTriangles.length + " surface group" + (surfacesTriangles.length === 1 ? "" : "s") + " from DTM file");

		return surfacesTriangles;
	}

	// Step 31) Parse binary DTM triangles
	parseBinaryTriangles(dtmContent, vertices) {
		// Step 32) Convert to buffer if needed
		var buffer;
		if (typeof dtmContent === "string") {
			buffer = this.stringToArrayBuffer(dtmContent);
		} else if (dtmContent instanceof ArrayBuffer) {
			buffer = dtmContent;
		} else {
			console.warn("Invalid DTM content type for binary parsing");
			return [];
		}

		// Step 33) Find header end (skip text header)
		var headerEnd = this.findBinaryHeaderEnd(buffer);

		console.log("Binary DTM: headerEnd=" + headerEnd + ", totalSize=" + buffer.byteLength + ", vertices=" + vertices.length);

		// Step 34) Parse binary triangle data
		var triangles = [];
		var view = new DataView(buffer, headerEnd);
		var pos = 0;

		// Step 35) Binary DTM format:
		// Format: triangle_id, v1_index, v2_index, v3_index, neighbor1, neighbor2, neighbor3, padding
		// 7 integers (4 bytes each) = 28 bytes + 5 bytes padding = 33 bytes per record
		var recordSize = 33;

		try {
			while (pos + recordSize <= view.byteLength) {
				// Read triangle indices (1-based in Surpac, convert to 0-based)
				// Surpac binary uses BIG-ENDIAN
				var triangleId = view.getInt32(pos, false);
				var v1Index = view.getInt32(pos + 4, false) - 1;
				var v2Index = view.getInt32(pos + 8, false) - 1;
				var v3Index = view.getInt32(pos + 12, false) - 1;
				// Skip to next record (neighbor IDs at pos+16, +20, +24, then 5 bytes padding)
				pos += recordSize;

				// Step 36) Validate indices
				if (v1Index < 0 || v1Index >= vertices.length || v2Index < 0 || v2Index >= vertices.length || v3Index < 0 || v3Index >= vertices.length) {
					console.warn("Binary triangle " + triangleId + " has invalid vertex index: v1=" + (v1Index + 1) + ", v2=" + (v2Index + 1) + ", v3=" + (v3Index + 1) + " (vertices.length=" + vertices.length + ")");
					continue;
				}

				// Step 37) Create triangle
				var triangle = {
					vertices: [vertices[v1Index], vertices[v2Index], vertices[v3Index]]
				};

				triangles.push(triangle);
			}
		} catch (error) {
			console.warn("Error parsing binary DTM triangles:", error);
		}

		console.log("Parsed " + triangles.length + " triangles from binary DTM file");
		return triangles;
	}

	// Step 38) Find end of binary DTM header and start of triangle data
	findBinaryHeaderEnd(buffer) {
		var view = new Uint8Array(buffer);

		// Step 38a) Binary DTM structure:
		// - Text header (STR filename, checksum, algorithm info)
		// - Null padding
		// - "END" marker
		// - Metadata (neighbours=yes,validated=true,...)
		// - Binary triangle data (7 x 4-byte BIG-ENDIAN integers per triangle)

		// Step 38b) Search for first valid triangle record (triangle ID = 1)
		// Triangle format: triID, v1, v2, v3, n1, n2, n3 (7 x 4-byte int32 big-endian)
		// Scan byte-by-byte to find where triangle data starts (offset may not be 4-byte aligned)
		for (var scanPos = 50; scanPos < Math.min(view.length - 28, 500); scanPos++) {
			try {
				var testView = new DataView(buffer, scanPos);
				// Read as big-endian (Surpac binary format)
				var triId = testView.getInt32(0, false);
				var v1 = testView.getInt32(4, false);
				var v2 = testView.getInt32(8, false);
				var v3 = testView.getInt32(12, false);
				
				// Step 38c) Valid first triangle: ID = 1, vertices are small positive numbers
				if (triId === 1 && v1 > 0 && v1 < 100000 && v2 > 0 && v2 < 100000 && v3 > 0 && v3 < 100000) {
					console.log("Found binary triangle data start at offset " + scanPos + 
						": tri=" + triId + ", v1=" + v1 + ", v2=" + v2 + ", v3=" + v3);
					return scanPos;
				}
			} catch (e) {
				// Continue scanning
			}
		}

		// Step 38d) Fallback: look for "END" marker and skip past it
		for (var i = 0; i < Math.min(view.length, 500); i++) {
			if (view[i] === 0x45 && view[i+1] === 0x4E && view[i+2] === 0x44) { // "END"
				// Skip past END and any padding
				var pos = i + 3;
				while (pos < view.length && view[pos] === 0x00) {
					pos++;
				}
				// Skip metadata text
				while (pos < view.length && view[pos] >= 0x20 && view[pos] <= 0x7E) {
					pos++;
				}
				// Skip any trailing nulls
				while (pos < view.length && view[pos] === 0x00) {
					pos++;
				}
				console.log("Using END marker fallback, triangle data at offset " + pos);
				return pos;
			}
		}

		console.warn("Could not find triangle data start, using default offset 200");
		return 200;
	}

	// Step 39) Convert string to ArrayBuffer
	stringToArrayBuffer(str) {
		var buf = new ArrayBuffer(str.length);
		var bufView = new Uint8Array(buf);
		for (var i = 0; i < str.length; i++) {
			bufView[i] = str.charCodeAt(i) & 0xff;
		}
		return buf;
	}
}

export default SurpacSurfaceParser;
