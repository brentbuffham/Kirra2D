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

				// Step 17j) Skip any description text after coordinates
				// Description is printable ASCII (0x20-0x7E) followed by null terminator
				while (pos < bytes.length && bytes[pos] >= 0x20 && bytes[pos] <= 0x7e) {
					pos++;
				}
				// Skip null terminator if present
				if (pos < bytes.length && bytes[pos] === 0x00) {
					pos++;
				}

				// Step 17k) Add vertex
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

		// Step 33) Find header end and format info
		var headerInfo = this.findBinaryHeaderEnd(buffer);
		var headerEnd = headerInfo.offset;
		var hasRecordType = headerInfo.hasRecordType;
		var hasEmbeddedVertices = headerInfo.hasEmbeddedVertices;
		var vertexDataEnd = headerInfo.vertexDataEnd;

		console.log("Binary DTM: headerEnd=" + headerEnd + ", hasRecordType=" + hasRecordType + 
			", hasEmbeddedVertices=" + hasEmbeddedVertices + ", totalSize=" + buffer.byteLength + 
			", strVertices=" + vertices.length);

		// Step 33b) If DTM has embedded vertices, try parsing them as they may be different from STR
		var useVertices = vertices;
		if (hasEmbeddedVertices && vertexDataEnd > 0) {
			var embeddedVertices = this.parseEmbeddedDTMVertices(buffer, vertexDataEnd);
			if (embeddedVertices.length > 0) {
				console.log("Parsed " + embeddedVertices.length + " embedded vertices from DTM file");
				// Use embedded vertices if they are different count (DTM may have more/different vertices)
				if (embeddedVertices.length !== vertices.length) {
					console.log("Using DTM embedded vertices (" + embeddedVertices.length + ") instead of STR vertices (" + vertices.length + ")");
					useVertices = embeddedVertices;
				}
			}
		}

		// Step 34) Parse binary triangle data
		var triangles = [];
		var view = new DataView(buffer, headerEnd);
		var pos = 0;

		// Step 35) Binary DTM format:
		// Format A (with record type): record_type(4), tri_id(4), v1(4), v2(4), v3(4), n1(4), n2(4), n3(4), padding(1) = 33 bytes
		// Format B (without record type): tri_id(4), v1(4), v2(4), v3(4), n1(4), n2(4), n3(4), padding(5) = 33 bytes
		// Both formats use 33-byte records!
		var recordSize = 33;
		var idOffset = hasRecordType ? 4 : 0;  // Offset to triangle ID within record
		var invalidCount = 0;

		try {
			while (pos + recordSize <= view.byteLength) {
				// Read triangle indices (1-based in Surpac, convert to 0-based)
				// Surpac binary uses BIG-ENDIAN
				var triangleId = view.getInt32(pos + idOffset, false);
				var v1Index = view.getInt32(pos + idOffset + 4, false) - 1;
				var v2Index = view.getInt32(pos + idOffset + 8, false) - 1;
				var v3Index = view.getInt32(pos + idOffset + 12, false) - 1;
				
				pos += recordSize;

				// Step 36) Validate indices
				if (v1Index < 0 || v1Index >= useVertices.length || v2Index < 0 || v2Index >= useVertices.length || v3Index < 0 || v3Index >= useVertices.length) {
					invalidCount++;
					// Only warn for first few errors to avoid console spam
					if (invalidCount <= 5) {
						console.warn("Binary triangle " + triangleId + " has invalid vertex index: v1=" + (v1Index + 1) + ", v2=" + (v2Index + 1) + ", v3=" + (v3Index + 1) + " (vertices.length=" + useVertices.length + ")");
					}
					continue;
				}

				// Step 37) Create triangle
				var triangle = {
					vertices: [useVertices[v1Index], useVertices[v2Index], useVertices[v3Index]]
				};

				triangles.push(triangle);
			}
		} catch (error) {
			console.warn("Error parsing binary DTM triangles:", error);
		}

		// Step 37b) Check for format issues - if too many invalid triangles, warn the user
		var totalAttempted = triangles.length + invalidCount;
		if (invalidCount > 0) {
			var invalidRatio = invalidCount / totalAttempted;
			console.warn("Skipped " + invalidCount + " of " + totalAttempted + " triangles with invalid vertex indices (" + Math.round(invalidRatio * 100) + "% invalid)");
			
			// Step 37c) If more than 30% invalid, this file likely has format issues
			if (invalidRatio > 0.3 && typeof FloatingDialog !== "undefined") {
				var darkMode = typeof window.darkModeEnabled !== "undefined" ? window.darkModeEnabled : false;
				var textColor = darkMode ? "#ffffff" : "#000000";
				var warningContent = 
					'<div style="text-align: center; padding: 10px;">' +
					'<div style="color: #ff9800; font-size: 32px; margin-bottom: 15px;">⚠️</div>' +
					'<div style="color: ' + textColor + '; font-size: 14px; font-weight: bold; margin-bottom: 15px;">' +
					Math.round(invalidRatio * 100) + '% of triangles have invalid vertex references.</div>' +
					'<div style="color: ' + textColor + '; font-size: 12px; margin-bottom: 15px; line-height: 1.6;">' +
					'This binary STR+DTM pair may be from an unsupported<br>Surpac version (e.g., 7.x binary format).</div>' +
					'<div style="color: ' + textColor + '; font-size: 12px; text-align: left; margin: 15px 20px; line-height: 1.8;">' +
					'<b>Suggestions:</b><br>' +
					'&nbsp;&nbsp;• Export as <b>ASCII text format</b> from Surpac<br>' +
					'&nbsp;&nbsp;• Use Surpac 6.x output format if available<br>' +
					'&nbsp;&nbsp;• Verify STR and DTM files are from same export</div>' +
					'<div style="color: #888; font-size: 11px; font-style: italic; margin-top: 15px;">' +
					'Imported ' + triangles.length + ' valid triangles (partial surface may be visible).</div>' +
					'</div>';
				
				var warningDialog = new FloatingDialog({
					title: "Surface Import Warning",
					content: warningContent,
					width: 420,
					height: 370,
					showConfirm: true,
					showCancel: false,
					confirmText: "OK",
					draggable: true,
					resizable: false,
					closeOnOutsideClick: false,
					layoutType: "default"
				});
				warningDialog.show();
			}
		}
		console.log("Parsed " + triangles.length + " valid triangles from binary DTM file");
		return triangles;
	}

	// Step 31b) Parse embedded vertices from DTM file (before END marker)
	parseEmbeddedDTMVertices(buffer, endMarkerPos) {
		var vertices = [];
		var view = new Uint8Array(buffer);
		
		// Step 31c) Find header end (skip text header line ending with CRLF)
		var headerEnd = 0;
		for (var i = 0; i < Math.min(view.length, 500); i++) {
			if (view[i] === 0x0A || view[i] === 0x0D) { // Line feed or carriage return
				headerEnd = i + 1;
				// Skip additional line ending characters and null padding
				while (headerEnd < view.length && (view[headerEnd] === 0x0A || view[headerEnd] === 0x0D || view[headerEnd] === 0x00)) {
					headerEnd++;
				}
				break;
			}
		}
		
		if (headerEnd === 0) {
			headerEnd = 80; // Typical header size fallback
		}
		
		console.log("Parsing embedded DTM vertices from offset " + headerEnd + " to " + endMarkerPos);
		
		// Step 31d) Parse vertices: 1-byte string# + 24-byte coords + 4-byte padding = 29 bytes per record
		var dataView = new DataView(buffer);
		var pos = headerEnd;
		var vertexRecordSize = 29; // 1 + 24 + 4 (with null padding)
		var consecutiveNulls = 0;
		
		try {
			while (pos + 25 <= endMarkerPos) { // At least string# + coords
				var stringNum = view[pos];
				
				// Step 31e) Check for end of vertex data (multiple consecutive nulls)
				if (stringNum === 0) {
					consecutiveNulls++;
					if (consecutiveNulls > 10) {
						// We've hit the padding before END marker
						console.log("End of vertex data detected at offset " + pos + " (found null padding)");
						break;
					}
					pos++;
					continue;
				}
				consecutiveNulls = 0;
				
				// Validate string number (should be small positive number)
				if (stringNum > 100) {
					pos++;
					continue;
				}
				
				// Step 31f) Read coordinates as big-endian doubles
				var y = dataView.getFloat64(pos + 1, false);
				var x = dataView.getFloat64(pos + 9, false);
				var z = dataView.getFloat64(pos + 17, false);
				
				// Validate coordinates (should be reasonable numbers)
				if (isFinite(x) && isFinite(y) && isFinite(z) && 
					Math.abs(x) < 1e10 && Math.abs(y) < 1e10 && Math.abs(z) < 1e6) {
					vertices.push({ x: x, y: y, z: z });
					// Move to next record (skip 4-byte padding after coordinates)
					pos += vertexRecordSize;
				} else {
					// Bad coordinates, skip this byte and try again
					pos++;
				}
			}
		} catch (error) {
			console.warn("Error parsing embedded DTM vertices:", error);
		}
		
		console.log("Parsed " + vertices.length + " embedded vertices from DTM");
		return vertices;
	}

	// Step 38) Find end of binary DTM header and start of triangle data
	// Returns: { offset: number, hasRecordType: boolean, hasEmbeddedVertices: boolean, vertexDataEnd: number }
	findBinaryHeaderEnd(buffer) {
		var view = new Uint8Array(buffer);

		// Step 38a) Binary DTM structure (two possible formats):
		// Format 1 (simple): Text header + triangle data (no END marker)
		// Format 2 (embedded): Text header + vertex data + END marker + metadata + triangle data

		// Step 38b) First, search for "END" marker (indicates embedded vertex format)
		var endMarkerPos = -1;
		for (var i = 0; i < view.length - 3; i++) {
			if (view[i] === 0x45 && view[i+1] === 0x4E && view[i+2] === 0x44) { // "END"
				endMarkerPos = i;
				console.log("Found END marker at offset " + endMarkerPos + " - DTM has embedded vertices");
				break;
			}
		}

		if (endMarkerPos !== -1) {
			// Step 38c) Format 2: Scan for triangle start pattern after END marker
			// Pattern A: 00 00 00 03 00 00 00 01 (record_type=3, tri_id=1)
			
			var scanStart = endMarkerPos + 3;
			var scanEnd = Math.min(view.length - 32, endMarkerPos + 500);
			
			// Step 38d) Look for the byte pattern 00 00 00 03 00 00 00 01
			for (var pos = scanStart; pos < scanEnd; pos++) {
				if (view[pos] === 0x00 && view[pos+1] === 0x00 && view[pos+2] === 0x00 && view[pos+3] === 0x03 &&
					view[pos+4] === 0x00 && view[pos+5] === 0x00 && view[pos+6] === 0x00 && view[pos+7] === 0x01) {
					// Found the pattern, verify vertex indices
					try {
						var testView = new DataView(buffer, pos);
						var v1 = testView.getInt32(8, false);
						var v2 = testView.getInt32(12, false);
						var v3 = testView.getInt32(16, false);
						
						if (v1 > 0 && v1 < 100000 && v2 > 0 && v2 < 100000 && v3 > 0 && v3 < 100000) {
							console.log("Found triangle data with record type at offset " + pos);
							return { offset: pos, hasRecordType: true, hasEmbeddedVertices: true, vertexDataEnd: endMarkerPos };
						}
					} catch (e) {
						// Continue scanning
					}
				}
			}
			
			// Step 38e) Also try pattern without record type after END marker
			for (var pos = scanStart; pos < scanEnd; pos++) {
				if (view[pos] === 0x00 && view[pos+1] === 0x00 && view[pos+2] === 0x00 && view[pos+3] === 0x01) {
					try {
						var testView = new DataView(buffer, pos);
						var triId = testView.getInt32(0, false);
						var v1 = testView.getInt32(4, false);
						var v2 = testView.getInt32(8, false);
						var v3 = testView.getInt32(12, false);
						
						if (triId === 1 && v1 > 0 && v1 < 100000 && v2 > 0 && v2 < 100000 && v3 > 0 && v3 < 100000) {
							console.log("Found triangle data without record type at offset " + pos);
							return { offset: pos, hasRecordType: false, hasEmbeddedVertices: true, vertexDataEnd: endMarkerPos };
						}
					} catch (e) {
						// Continue scanning
					}
				}
			}
			
			console.warn("Could not find triangle pattern after END marker");
		}

		// Step 38f) Format 1: No END marker - scan for triangle pattern near beginning (ORIGINAL BEHAVIOR)
		for (var scanPos = 50; scanPos < Math.min(view.length - 28, 500); scanPos++) {
			try {
				var testView = new DataView(buffer, scanPos);
				var triId = testView.getInt32(0, false);
				var v1 = testView.getInt32(4, false);
				var v2 = testView.getInt32(8, false);
				var v3 = testView.getInt32(12, false);
				
				if (triId === 1 && v1 > 0 && v1 < 100000 && v2 > 0 && v2 < 100000 && v3 > 0 && v3 < 100000) {
					console.log("Found binary triangle data at offset " + scanPos + " (simple format)");
					return { offset: scanPos, hasRecordType: false, hasEmbeddedVertices: false, vertexDataEnd: 0 };
				}
			} catch (e) {
				// Continue scanning
			}
		}

		console.warn("Could not find triangle data start, using default offset 200");
		return { offset: 200, hasRecordType: false, hasEmbeddedVertices: false, vertexDataEnd: 0 };
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
