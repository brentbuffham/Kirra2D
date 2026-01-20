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
import SurpacBinarySTRParser from "./SurpacBinarySTRParser.js";

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

		// Step 11) Text-only: build triangle groups from ASCII DTM; STR only supplies vertices
		var triangleGroups = this.parseTriangles(dtmContent, vertices);

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

	// Step 14) Parse vertices from STR file (text only)
	async parseVertices(strContent) {
		// Step 15) Binary detection disabled - only parse text format
		// TODO: Re-enable binary detection once binary format is properly tested
		// var isBinary = this.isBinaryContent(strContent);

		console.log("Parsing text STR vertices");
		return this.parseTextVertices(strContent);
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

	// Step 17) Parse binary vertices using SurpacBinarySTRParser
	async parseBinaryVertices(strContent) {
		var parser = new SurpacBinarySTRParser();
		var data = await parser.parse(strContent);
		return data.vertices || [];
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

		// Step 35) Binary DTM format (based on text format analysis):
		// Format: triangle_id, v1_index, v2_index, v3_index, neighbor1, neighbor2, neighbor3
		// 7 integers (4 bytes each) = 28 bytes per triangle
		var recordSize = 28;

		try {
			while (pos + recordSize <= view.byteLength) {
				// Read triangle indices (1-based in Surpac, convert to 0-based)
				var triangleId = view.getInt32(pos, true);
				pos += 4;
				var v1Index = view.getInt32(pos, true) - 1;
				pos += 4;
				var v2Index = view.getInt32(pos, true) - 1;
				pos += 4;
				var v3Index = view.getInt32(pos, true) - 1;
				pos += 4;
				// Skip neighbor triangle IDs (we don't need topology for rendering)
				pos += 12; // Skip 3 more integers (neighbor1, neighbor2, neighbor3)

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

	// Step 38) Find end of binary DTM header
	findBinaryHeaderEnd(buffer) {
		var view = new Uint8Array(buffer);

		// Look for double newline or first null byte sequence
		for (var i = 0; i < Math.min(view.length, 1000); i++) {
			// Check for \r\n pattern followed by binary data
			if (view[i] === 0x0d && view[i + 1] === 0x0a) {
				// Check if next byte looks like binary data
				if (i + 2 < view.length && (view[i + 2] === 0x00 || view[i + 2] < 0x20)) {
					return i + 2;
				}
			}
			// Check for null byte
			if (view[i] === 0x00) {
				return i;
			}
		}

		// Default: assume header is first 100 bytes
		return 100;
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
