// src/fileIO/AutoCadIO/BinaryDXFParser.js
//=============================================================
// BINARY DXF PARSER
//=============================================================
// Step 1) Parses Binary DXF files to KAD entities and surfaces
// Step 2) Binary DXF format introduced in AutoCAD Release 10 (1988)
// Step 3) Binary format is 25% smaller and 5x faster to load than ASCII
// Step 4) Handles standard DXF entities: POINT, LINE, POLYLINE, CIRCLE, TEXT, 3DFACE, etc.
// Step 5) Created: 2026-01-16, Updated: 2026-01-17

import BaseParser from "../BaseParser.js";

// Step 6) Binary DXF Constants
const BINARY_DXF_SENTINEL = "AutoCAD Binary DXF\r\n\x1a\x00";
const SENTINEL_LENGTH = 22;

// Step 7) BinaryDXFParser class
class BinaryDXFParser extends BaseParser {
	constructor(options = {}) {
		super(options);

		// Step 8) Parser options - use BaseParser centroid if available
		this.offsetX = options.offsetX || this.centroidX || 0;
		this.offsetY = options.offsetY || this.centroidY || 0;
		this.showProgress = options.showProgress !== false;

		// Step 9) Naming strategy option
		// "handle" = use DXF handle (most unique, e.g., "LINE_8A")
		// "layer_index" = use layer + index (e.g., "SP_2_line_001")
		// "layer_handle" = use layer + handle (e.g., "SP_2_8A")
		this.namingStrategy = options.namingStrategy || "layer_index";

		// Step 10) Internal state
		this.buffer = null;
		this.dataView = null;
		this.position = 0;
		this.fileSize = 0;
	}

	// Step 11) Main parse method - accepts File or ArrayBuffer
	async parse(input) {
		// Step 11) Get ArrayBuffer from input
		var arrayBuffer;

		if (input instanceof ArrayBuffer) {
			arrayBuffer = input;
		} else if (input instanceof File || input instanceof Blob) {
			arrayBuffer = await this.readAsArrayBuffer(input);
		} else if (input && input.buffer instanceof ArrayBuffer) {
			arrayBuffer = input.buffer;
		} else {
			throw new Error("Invalid input: expected File, Blob, or ArrayBuffer");
		}

		// Step 12) Initialize buffer and data view
		this.buffer = new Uint8Array(arrayBuffer);
		this.dataView = new DataView(arrayBuffer);
		this.position = 0;
		this.fileSize = arrayBuffer.byteLength;

		// Step 13) Validate binary DXF signature
		if (!this.validateSentinel()) {
			throw new Error("Invalid Binary DXF file: sentinel not found");
		}

		// Step 14) Skip sentinel (22 bytes)
		this.position = SENTINEL_LENGTH;

		// Step 15) Parse the binary DXF content
		return await this.parseBinaryDXF();
	}

	// Step 16) Read file as ArrayBuffer
	async readAsArrayBuffer(file) {
		return new Promise(function(resolve, reject) {
			var reader = new FileReader();
			reader.onload = function() {
				resolve(reader.result);
			};
			reader.onerror = function() {
				reject(new Error("Failed to read file"));
			};
			reader.readAsArrayBuffer(file);
		});
	}

	// Step 17) Validate binary DXF sentinel
	validateSentinel() {
		if (this.fileSize < SENTINEL_LENGTH) {
			return false;
		}

		// Step 18) Check for "AutoCAD Binary DXF" signature
		var sentinel = "";
		for (var i = 0; i < SENTINEL_LENGTH; i++) {
			sentinel += String.fromCharCode(this.buffer[i]);
		}

		return sentinel === BINARY_DXF_SENTINEL;
	}

	// Step 19) Static method to check if buffer is binary DXF
	static isBinaryDXF(arrayBuffer) {
		if (arrayBuffer.byteLength < SENTINEL_LENGTH) {
			return false;
		}

		var buffer = new Uint8Array(arrayBuffer);
		var sentinel = "";

		for (var i = 0; i < SENTINEL_LENGTH; i++) {
			sentinel += String.fromCharCode(buffer[i]);
		}

		return sentinel === BINARY_DXF_SENTINEL;
	}

	// Step 20) Read group code (1 or 3 bytes)
	readGroupCode() {
		if (this.position >= this.fileSize) {
			return null;
		}

		var firstByte = this.buffer[this.position++];

		// Step 21) If first byte is 255, next two bytes are the actual group code
		if (firstByte === 255) {
			if (this.position + 2 > this.fileSize) {
				return null;
			}
			var code = this.dataView.getInt16(this.position, true); // Little-endian
			this.position += 2;
			return code;
		}

		return firstByte;
	}

	// Step 22) Read value based on group code
	readValue(groupCode) {
		// Step 23) Determine value type from group code
		var valueType = this.getValueType(groupCode);

		switch (valueType) {
			case "string":
				return this.readString();

			case "double":
				return this.readDouble();

			case "int16":
				return this.readInt16();

			case "int32":
				return this.readInt32();

			case "int64":
				return this.readInt64();

			case "binary":
				return this.readBinaryChunk();

			default:
				console.warn("Unknown value type for group code:", groupCode);
				return this.readString(); // Default to string
		}
	}

	// Step 24) Determine value type from group code
	getValueType(code) {
		// Step 25) String group codes
		if ((code >= 0 && code <= 9) || (code >= 100 && code <= 102) || code === 105 || (code >= 300 && code <= 369) || (code >= 390 && code <= 399) || (code >= 410 && code <= 419) || (code >= 430 && code <= 439) || (code >= 470 && code <= 481) || code === 999 || (code >= 1000 && code <= 1009)) {
			return "string";
		}

		// Step 26) Double (floating-point) group codes
		if ((code >= 10 && code <= 59) || (code >= 110 && code <= 149) || (code >= 210 && code <= 239) || (code >= 460 && code <= 469) || (code >= 1010 && code <= 1059)) {
			return "double";
		}

		// Step 27) 16-bit integer group codes
		if ((code >= 60 && code <= 79) || (code >= 170 && code <= 179) || (code >= 270 && code <= 289) || (code >= 370 && code <= 389) || (code >= 400 && code <= 409) || (code >= 1060 && code <= 1070)) {
			return "int16";
		}

		// Step 28) 32-bit integer group codes
		if ((code >= 90 && code <= 99) || (code >= 420 && code <= 429) || (code >= 440 && code <= 449) || code === 1071) {
			return "int32";
		}

		// Step 29) Binary chunk (extended data)
		if (code === 1004) {
			return "binary";
		}

		// Step 30) Default to string for unknown codes
		return "string";
	}

	// Step 31) Read null-terminated string
	readString() {
		var result = "";
		while (this.position < this.fileSize) {
			var byte = this.buffer[this.position++];
			if (byte === 0) {
				break;
			}
			result += String.fromCharCode(byte);
		}
		return result;
	}

	// Step 32) Read 8-byte IEEE double (little-endian)
	readDouble() {
		if (this.position + 8 > this.fileSize) {
			console.warn("Unexpected end of file reading double");
			return 0;
		}
		var value = this.dataView.getFloat64(this.position, true);
		this.position += 8;
		return value;
	}

	// Step 33) Read 2-byte signed integer (little-endian)
	readInt16() {
		if (this.position + 2 > this.fileSize) {
			console.warn("Unexpected end of file reading int16");
			return 0;
		}
		var value = this.dataView.getInt16(this.position, true);
		this.position += 2;
		return value;
	}

	// Step 34) Read 4-byte signed integer (little-endian)
	readInt32() {
		if (this.position + 4 > this.fileSize) {
			console.warn("Unexpected end of file reading int32");
			return 0;
		}
		var value = this.dataView.getInt32(this.position, true);
		this.position += 4;
		return value;
	}

	// Step 35) Read 8-byte integer (as BigInt, little-endian)
	readInt64() {
		if (this.position + 8 > this.fileSize) {
			console.warn("Unexpected end of file reading int64");
			return 0;
		}
		// Read as two 32-bit integers and combine
		var low = this.dataView.getUint32(this.position, true);
		var high = this.dataView.getInt32(this.position + 4, true);
		this.position += 8;
		return high * 0x100000000 + low;
	}

	// Step 36) Read binary chunk (for extended data 1004)
	readBinaryChunk() {
		if (this.position >= this.fileSize) {
			return new Uint8Array(0);
		}
		var length = this.buffer[this.position++];
		if (this.position + length > this.fileSize) {
			console.warn("Unexpected end of file reading binary chunk");
			length = this.fileSize - this.position;
		}
		var chunk = this.buffer.slice(this.position, this.position + length);
		this.position += length;
		return chunk;
	}

	// Step 37) Main binary DXF parsing logic
	async parseBinaryDXF() {
		// Step 38) Initialize result structures
		var kadDrawingsMap = new Map();
		var surfacePoints = [];
		var surfaceTriangles = [];

		// Step 39) Entity counters for unique naming
		var counts = {
			point: 0,
			line: 0,
			poly: 0,
			circle: 0,
			text: 0,
			face: 0
		};

		// Step 40) Current section and entity tracking
		var currentSection = null;
		var currentEntity = null;
		var currentEntityType = null;
		var entities = [];
		var polylineVertices = [];
		var inPolyline = false;
		var polylineHeader = null;

		// Step 41) Extended data tracking
		var currentXData = null;
		var xdataAppName = null;

		// Step 42) Progress tracking
		var lastProgressUpdate = 0;
		var progressDialog = null;
		var progressBar = null;
		var progressText = null;

		if (this.showProgress && this.fileSize > 100000 && window.FloatingDialog) {
			var progressContent = "<p>Parsing Binary DXF File</p>" + '<div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">' + '<div id="binDxfProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px;"></div>' + "</div>" + '<p id="binDxfProgressText">Reading file...</p>';

			progressDialog = new window.FloatingDialog({
				title: "Binary DXF Import",
				content: progressContent,
				layoutType: "standard",
				width: 400,
				height: 200,
				showConfirm: false,
				showCancel: false,
				draggable: true
			});
			progressDialog.show();

			await new Promise(function(resolve) {
				setTimeout(resolve, 50);
			});

			progressBar = document.getElementById("binDxfProgressBar");
			progressText = document.getElementById("binDxfProgressText");
		}

		// Step 43) Read group-value pairs until EOF
		while (this.position < this.fileSize) {
			// Step 44) Update progress periodically
			if (progressBar && this.position - lastProgressUpdate > 10000) {
				var percent = Math.round(this.position / this.fileSize * 100);
				progressBar.style.width = percent + "%";
				progressText.textContent = "Processing: " + percent + "% (" + entities.length + " entities found)";
				lastProgressUpdate = this.position;

				// Yield to UI
				await new Promise(function(resolve) {
					setTimeout(resolve, 0);
				});
			}

			// Step 45) Read group code
			var groupCode = this.readGroupCode();
			if (groupCode === null) {
				break;
			}

			// Step 46) Read value
			var value = this.readValue(groupCode);

			// Step 47) Process based on group code
			if (groupCode === 0) {
				// Step 48) Entity/section separator
				var entityType = value.toUpperCase();

				// Step 49) Handle section markers
				if (entityType === "SECTION") {
					currentSection = null;
					currentEntity = null;
				} else if (entityType === "ENDSEC") {
					currentSection = null;
				} else if (entityType === "EOF") {
					break;
				} else if (currentSection === "ENTITIES" || currentSection === null) {
					// Step 50) Save previous entity if exists
					if (currentEntity && currentEntityType) {
						// Handle POLYLINE completion
						if (currentEntityType === "POLYLINE" && polylineVertices.length > 0) {
							currentEntity.vertices = polylineVertices.slice();
							polylineVertices = [];
							inPolyline = false;
						}
						entities.push({
							type: currentEntityType,
							data: currentEntity
						});
					}

					// Step 51) Handle VERTEX within POLYLINE
					if (entityType === "VERTEX" && inPolyline) {
						currentEntity = {};
						currentEntityType = "VERTEX";
					} else if (entityType === "SEQEND") {
						// End of POLYLINE vertices
						if (inPolyline && polylineHeader) {
							polylineHeader.vertices = polylineVertices.slice();
							entities.push({
								type: "POLYLINE",
								data: polylineHeader
							});
						}
						polylineVertices = [];
						inPolyline = false;
						polylineHeader = null;
						currentEntity = null;
						currentEntityType = null;
					} else if (entityType === "POLYLINE" || entityType === "LWPOLYLINE") {
						// Start new POLYLINE
						currentEntity = { vertices: [] };
						currentEntityType = entityType;
						inPolyline = entityType === "POLYLINE"; // LWPOLYLINE has inline vertices
						if (inPolyline) {
							polylineHeader = currentEntity;
							polylineVertices = [];
						}
					} else {
						// Start new entity
						currentEntity = {};
						currentEntityType = entityType;
					}
				}
			} else if (groupCode === 2) {
				// Step 52) Section or block name
				if (currentEntity === null && currentSection === null) {
					currentSection = value.toUpperCase();
				} else if (currentEntity) {
					currentEntity.name = value;
				}
			} else if (groupCode === 8) {
				// Step 53) Layer name
				if (currentEntity) {
					currentEntity.layer = value;
				}
			} else if (groupCode === 1) {
				// Step 54) Text content
				if (currentEntity) {
					currentEntity.text = value;
				}
			} else if (groupCode === 6) {
				// Step 55) Line type
				if (currentEntity) {
					currentEntity.lineType = value;
				}
			} else if (groupCode === 62) {
				// Step 56) Color number
				if (currentEntity) {
					currentEntity.color = value;
				}
			} else if (groupCode === 10) {
				// Step 57) Primary X coordinate
				if (currentEntityType === "VERTEX") {
					var vertex = { x: value, y: 0, z: 0 };
					currentEntity.position = vertex;
				} else if (currentEntityType === "LWPOLYLINE") {
					// LWPOLYLINE stores vertices inline
					if (!currentEntity.vertices) {
						currentEntity.vertices = [];
					}
					currentEntity.vertices.push({ x: value, y: 0, z: 0 });
				} else if (currentEntity) {
					if (!currentEntity.position) {
						currentEntity.position = { x: 0, y: 0, z: 0 };
					}
					currentEntity.position.x = value;
				}
			} else if (groupCode === 20) {
				// Step 58) Primary Y coordinate
				if (currentEntityType === "VERTEX" && currentEntity.position) {
					currentEntity.position.y = value;
				} else if (currentEntityType === "LWPOLYLINE" && currentEntity.vertices && currentEntity.vertices.length > 0) {
					currentEntity.vertices[currentEntity.vertices.length - 1].y = value;
				} else if (currentEntity && currentEntity.position) {
					currentEntity.position.y = value;
				}
			} else if (groupCode === 30) {
				// Step 59) Primary Z coordinate
				if (currentEntityType === "VERTEX" && currentEntity.position) {
					currentEntity.position.z = value;
					// Add vertex to polyline
					polylineVertices.push({
						x: currentEntity.position.x,
						y: currentEntity.position.y,
						z: currentEntity.position.z
					});
				} else if (currentEntityType === "LWPOLYLINE" && currentEntity.vertices && currentEntity.vertices.length > 0) {
					currentEntity.vertices[currentEntity.vertices.length - 1].z = value;
				} else if (currentEntity && currentEntity.position) {
					currentEntity.position.z = value;
				}
			} else if (groupCode === 11) {
				// Step 60) Secondary X coordinate (for LINE end point, 3DFACE vertex 2)
				if (currentEntity) {
					if (!currentEntity.endPoint) {
						currentEntity.endPoint = { x: 0, y: 0, z: 0 };
					}
					currentEntity.endPoint.x = value;
				}
			} else if (groupCode === 21) {
				// Step 61) Secondary Y coordinate
				if (currentEntity && currentEntity.endPoint) {
					currentEntity.endPoint.y = value;
				}
			} else if (groupCode === 31) {
				// Step 62) Secondary Z coordinate
				if (currentEntity && currentEntity.endPoint) {
					currentEntity.endPoint.z = value;
				}
			} else if (groupCode === 12) {
				// Step 63) Third X coordinate (for 3DFACE vertex 3)
				if (currentEntity) {
					if (!currentEntity.vertex3) {
						currentEntity.vertex3 = { x: 0, y: 0, z: 0 };
					}
					currentEntity.vertex3.x = value;
				}
			} else if (groupCode === 22) {
				if (currentEntity && currentEntity.vertex3) {
					currentEntity.vertex3.y = value;
				}
			} else if (groupCode === 32) {
				if (currentEntity && currentEntity.vertex3) {
					currentEntity.vertex3.z = value;
				}
			} else if (groupCode === 13) {
				// Step 64) Fourth X coordinate (for 3DFACE vertex 4)
				if (currentEntity) {
					if (!currentEntity.vertex4) {
						currentEntity.vertex4 = { x: 0, y: 0, z: 0 };
					}
					currentEntity.vertex4.x = value;
				}
			} else if (groupCode === 23) {
				if (currentEntity && currentEntity.vertex4) {
					currentEntity.vertex4.y = value;
				}
			} else if (groupCode === 33) {
				if (currentEntity && currentEntity.vertex4) {
					currentEntity.vertex4.z = value;
				}
			} else if (groupCode === 40) {
				// Step 65) Radius, text height, or other primary size
				if (currentEntity) {
					if (currentEntityType === "CIRCLE" || currentEntityType === "ARC") {
						currentEntity.radius = value;
					} else if (currentEntityType === "TEXT" || currentEntityType === "MTEXT") {
						currentEntity.height = value;
					} else {
						currentEntity.size = value;
					}
				}
			} else if (groupCode === 50) {
				// Step 66) Rotation angle
				if (currentEntity) {
					currentEntity.rotation = value;
				}
			} else if (groupCode === 70) {
				// Step 67) Flags (closed polyline, etc.)
				if (currentEntity) {
					currentEntity.flags = value;
					// Check if polyline is closed (bit 0)
					if (currentEntityType === "POLYLINE" || currentEntityType === "LWPOLYLINE") {
						currentEntity.closed = (value & 1) !== 0;
					}
				}
			} else if (groupCode === 1001) {
				// Step 68) Extended data application name
				xdataAppName = value;
				if (currentEntity) {
					if (!currentEntity.extendedData) {
						currentEntity.extendedData = [];
					}
					currentXData = {
						applicationName: value,
						customStrings: []
					};
					currentEntity.extendedData.push(currentXData);
				}
			} else if (groupCode === 1000) {
				// Step 69) Extended data string
				if (currentXData) {
					currentXData.customStrings.push(value);
				}
			}
		}

		// Step 70) Save final entity if any
		if (currentEntity && currentEntityType) {
			if (currentEntityType === "POLYLINE" && polylineVertices.length > 0) {
				currentEntity.vertices = polylineVertices.slice();
			}
			entities.push({
				type: currentEntityType,
				data: currentEntity
			});
		}

		// Step 71) Convert entities to KAD format with proper naming
		var offsetX = this.offsetX;
		var offsetY = this.offsetY;
		var self = this;

		// Layer-based counters for unique naming
		var layerCounters = {}; // { "layerName": { point: 0, line: 0, poly: 0, ... } }

		for (var i = 0; i < entities.length; i++) {
			var entity = entities[i];
			var type = entity.type;
			var data = entity.data;
			var color = this.getColor(data.color);
			var layerName = data.layer || "0";
			var handle = data.handle || null;

			// Initialize layer counters if needed
			if (!layerCounters[layerName]) {
				layerCounters[layerName] = { point: 0, line: 0, poly: 0, circle: 0, text: 0 };
			}

			if (type === "POINT") {
				// Step 72) Convert POINT entity
				if (data.position) {
					layerCounters[layerName].point++;
					counts.point++;

					var name = this.generateEntityName(layerName, "point", handle, layerCounters[layerName].point, counts.point, kadDrawingsMap);
					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "point",
						layer: layerName,
						handle: handle,
						data: [
							{
								entityName: name,
								entityType: "point",
								pointID: 1,
								pointXLocation: data.position.x - offsetX,
								pointYLocation: data.position.y - offsetY,
								pointZLocation: data.position.z || 0,
								color: color
							}
						]
					});
				}
			} else if (type === "LINE") {
				// Step 73) Convert LINE entity
				if (data.position && data.endPoint) {
					layerCounters[layerName].line++;
					counts.line++;

					var name = this.generateEntityName(layerName, "line", handle, layerCounters[layerName].line, counts.line, kadDrawingsMap);
					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "line",
						layer: layerName,
						handle: handle,
						data: [
							{
								entityName: name,
								entityType: "line",
								pointID: 1,
								pointXLocation: data.position.x - offsetX,
								pointYLocation: data.position.y - offsetY,
								pointZLocation: data.position.z || 0,
								lineWidth: 1,
								color: color,
								closed: false
							},
							{
								entityName: name,
								entityType: "line",
								pointID: 2,
								pointXLocation: data.endPoint.x - offsetX,
								pointYLocation: data.endPoint.y - offsetY,
								pointZLocation: data.endPoint.z || 0,
								lineWidth: 1,
								color: color,
								closed: false
							}
						]
					});
				}
			} else if (type === "POLYLINE" || type === "LWPOLYLINE") {
				// Step 74) Convert POLYLINE entity
				if (data.vertices && data.vertices.length > 1) {
					var isClosed = data.closed || false;
					var entityType = isClosed ? "poly" : "line";

					// Check for Vulcan name in extended data
					var vulcanName = this.extractVulcanName(data);
					var name;

					if (isClosed) {
						layerCounters[layerName].poly++;
						counts.poly++;
					} else {
						layerCounters[layerName].line++;
						counts.line++;
					}

					if (vulcanName) {
						// For Vulcan entities, use VN_ prefix but ensure uniqueness
						var baseName = "VN_" + vulcanName;
						name = this.getUniqueEntityName(baseName, entityType, kadDrawingsMap);
					} else {
						var counterValue = isClosed ? layerCounters[layerName].poly : layerCounters[layerName].line;
						var globalValue = isClosed ? counts.poly : counts.line;
						name = this.generateEntityName(layerName, entityType, handle, counterValue, globalValue, kadDrawingsMap);
					}

					var kadData = [];

					for (var j = 0; j < data.vertices.length; j++) {
						var v = data.vertices[j];
						kadData.push({
							entityName: name,
							entityType: entityType,
							pointID: j + 1,
							pointXLocation: v.x - offsetX,
							pointYLocation: v.y - offsetY,
							pointZLocation: v.z || 0,
							lineWidth: 1,
							color: color,
							closed: isClosed && j === data.vertices.length - 1
						});
					}

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: entityType,
						layer: layerName,
						handle: handle,
						vulcanName: vulcanName,
						data: kadData
					});

					// Create text label for Vulcan entities
					if (vulcanName && data.vertices.length > 0) {
						var firstVert = data.vertices[0];
						var textBaseName = "VN_" + vulcanName + "_text";
						var textName = this.getUniqueEntityName(textBaseName, "text", kadDrawingsMap);

						kadDrawingsMap.set(textName, {
							entityName: textName,
							entityType: "text",
							layer: layerName,
							vulcanName: vulcanName,
							data: [
								{
									entityName: textName,
									entityType: "text",
									pointID: 1,
									pointXLocation: firstVert.x - offsetX,
									pointYLocation: firstVert.y - offsetY,
									pointZLocation: firstVert.z || 0,
									text: vulcanName,
									color: color,
									fontHeight: 12
								}
							]
						});
					}
				}
			} else if (type === "CIRCLE") {
				// Step 75) Convert CIRCLE entity
				if (data.position && data.radius) {
					layerCounters[layerName].circle++;
					counts.circle++;

					var name = this.generateEntityName(layerName, "circle", handle, layerCounters[layerName].circle, counts.circle, kadDrawingsMap);
					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "circle",
						data: [
							{
								entityName: name,
								entityType: "circle",
								pointID: 1,
								pointXLocation: data.position.x - offsetX,
								pointYLocation: data.position.y - offsetY,
								pointZLocation: data.position.z || 0,
								radius: data.radius,
								lineWidth: 1,
								color: color
							}
						]
					});
				}
			} else if (type === "TEXT" || type === "MTEXT") {
				// Step 76) Convert TEXT entity
				if (data.position) {
					layerCounters[layerName].text++;
					counts.text++;

					var name = this.generateEntityName(layerName, "text", handle, layerCounters[layerName].text, counts.text, kadDrawingsMap);
					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "text",
						layer: layerName,
						handle: handle,
						data: [
							{
								entityName: name,
								entityType: "text",
								pointID: 1,
								pointXLocation: data.position.x - offsetX,
								pointYLocation: data.position.y - offsetY,
								pointZLocation: data.position.z || 0,
								text: data.text || "",
								color: color,
								fontHeight: data.height || 12
							}
						]
					});
				}
			} else if (type === "3DFACE") {
				// Step 77) Convert 3DFACE to surface triangle
				if (data.position && data.endPoint && data.vertex3) {
					var p1 = {
						x: data.position.x - offsetX,
						y: data.position.y - offsetY,
						z: data.position.z || 0
					};
					var p2 = {
						x: data.endPoint.x - offsetX,
						y: data.endPoint.y - offsetY,
						z: data.endPoint.z || 0
					};
					var p3 = {
						x: data.vertex3.x - offsetX,
						y: data.vertex3.y - offsetY,
						z: data.vertex3.z || 0
					};

					var p1Index = this.addUniquePoint(surfacePoints, p1);
					var p2Index = this.addUniquePoint(surfacePoints, p2);
					var p3Index = this.addUniquePoint(surfacePoints, p3);

					surfaceTriangles.push({
						vertices: [surfacePoints[p1Index], surfacePoints[p2Index], surfacePoints[p3Index]],
						minZ: Math.min(p1.z, p2.z, p3.z),
						maxZ: Math.max(p1.z, p2.z, p3.z)
					});

					counts.face++;
				}
			}
		}

		// Step 78) Create surface from 3DFACE triangles
		var surfaces = new Map();
		if (surfaceTriangles.length > 0) {
			var surfaceName = "BinaryDXF_Surface_" + Date.now();

			// Step 78a) Calculate meshBounds from points for centroid calculation
			// CRITICAL: Without meshBounds, centroid calculation cannot use this surface data
			var minX = Infinity, maxX = -Infinity;
			var minY = Infinity, maxY = -Infinity;
			var minZ = Infinity, maxZ = -Infinity;
			for (var bi = 0; bi < surfacePoints.length; bi++) {
				var bp = surfacePoints[bi];
				if (bp.x < minX) minX = bp.x;
				if (bp.x > maxX) maxX = bp.x;
				if (bp.y < minY) minY = bp.y;
				if (bp.y > maxY) maxY = bp.y;
				if (bp.z < minZ) minZ = bp.z;
				if (bp.z > maxZ) maxZ = bp.z;
			}
			var meshBounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ };

			surfaces.set(surfaceName, {
				id: surfaceName,
				name: surfaceName,
				points: surfacePoints,
				triangles: surfaceTriangles,
				meshBounds: meshBounds, // CRITICAL: Add meshBounds for centroid calculation
				visible: true,
				gradient: "hillshade",
				transparency: 1.0,
				minLimit: null,
				maxLimit: null
			});
		}

		// Step 79) Close progress dialog
		if (progressDialog) {
			progressBar.style.width = "100%";
			progressText.textContent = "Complete! " + entities.length + " entities processed.";
			setTimeout(function() {
				progressDialog.close();
			}, 500);
		}

		// Step 80) Return results
		console.log("Binary DXF parsed:", kadDrawingsMap.size, "KAD entities,", surfaceTriangles.length, "surface triangles");

		return {
			kadDrawings: kadDrawingsMap,
			surfaces: surfaces,
			entityCounts: counts,
			rawEntities: entities
		};
	}

	// Step 81) Helper: Get color from DXF color index
	getColor(idx) {
		var dec = idx != null && idx >= 0 ? idx : 0x777777;
		var hex = dec.toString(16).padStart(6, "0").toUpperCase();
		return "#" + hex;
	}

	// Step 82) Generate unique entity name based on naming strategy
	generateEntityName(layerName, entityType, handle, layerIndex, globalIndex, existingMap, blockName) {
		var baseName;

		switch (this.namingStrategy) {
			case "handle":
				// Use DXF handle if available, otherwise fall back to global index
				if (handle) {
					baseName = entityType.toUpperCase() + "_" + handle;
				} else {
					baseName = entityType + "_" + String(globalIndex).padStart(5, "0");
				}
				break;

			case "layer_handle":
				// Use layer + handle
				if (handle) {
					baseName = layerName + "_" + handle;
				} else {
					baseName = layerName + "_" + entityType + "_" + String(layerIndex).padStart(4, "0");
				}
				break;

			case "block_name":
				// Use block name if available (for INSERT entities)
				if (blockName) {
					baseName = blockName;
				} else {
					baseName = layerName + "_" + entityType + "_" + String(layerIndex).padStart(4, "0");
				}
				break;

			case "layer_index":
			default:
				// Default: layer + type + padded index (most readable)
				baseName = layerName + "_" + entityType + "_" + String(layerIndex).padStart(4, "0");
				break;
		}

		// Ensure uniqueness
		return this.getUniqueEntityName(baseName, entityType, existingMap);
	}

	// Step 83) Helper: Get unique entity name
	getUniqueEntityName(baseName, entityType, existingMap) {
		if (!existingMap.has(baseName)) {
			return baseName;
		}

		var counter = 1;
		var uniqueName = baseName + "_" + counter;

		while (existingMap.has(uniqueName)) {
			counter++;
			uniqueName = baseName + "_" + counter;
		}

		return uniqueName;
	}

	// Step 83) Helper: Add unique point with tolerance
	addUniquePoint(pointsArray, newPoint, tolerance) {
		tolerance = tolerance || 0.001;

		for (var i = 0; i < pointsArray.length; i++) {
			var p = pointsArray[i];
			var dx = Math.abs(p.x - newPoint.x);
			var dy = Math.abs(p.y - newPoint.y);
			var dz = Math.abs(p.z - newPoint.z);

			if (dx < tolerance && dy < tolerance && dz < tolerance) {
				return i;
			}
		}

		pointsArray.push(newPoint);
		return pointsArray.length - 1;
	}

	// Step 84) Helper: Extract Vulcan name from extended data
	extractVulcanName(entity) {
		if (!entity.extendedData) {
			return null;
		}

		for (var i = 0; i < entity.extendedData.length; i++) {
			var xdata = entity.extendedData[i];

			if (xdata.applicationName === "MAPTEK_VULCAN" && Array.isArray(xdata.customStrings)) {
				for (var j = 0; j < xdata.customStrings.length; j++) {
					var str = xdata.customStrings[j];
					if (typeof str === "string" && str.indexOf("VulcanName=") === 0) {
						var vulcanName = str.substring(11).trim();
						if (vulcanName && vulcanName !== "--" && vulcanName !== "-") {
							return vulcanName;
						}
					}
				}
			}
		}

		return null;
	}
}

export default BinaryDXFParser;
