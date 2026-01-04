// src/fileIO/ThreeJSMeshIO/PLYParser.js
//=============================================================
// PLY PARSER - ASCII AND BINARY FORMATS
//=============================================================
// Step 1) Parses PLY (Polygon File Format) files
// Step 2) Supports ASCII and Binary (little-endian/big-endian) formats
// Step 3) Extracts vertices, faces, normals, colors, UVs
// Step 4) Created: 2026-01-04

import BaseParser from "../BaseParser.js";

// Step 5) PLYParser class
class PLYParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	// Step 6) Main parse method
	async parse(file) {
		// Step 7) Read file as ArrayBuffer (supports both ASCII and binary)
		var arrayBuffer = await this.readAsArrayBuffer(file);
		var dataView = new DataView(arrayBuffer);

		// Step 8) Parse header to determine format
		var header = this.parseHeader(arrayBuffer);

		// Step 9) Parse body based on format
		var result;
		if (header.format === "ascii") {
			result = this.parseASCII(arrayBuffer, header);
		} else if (header.format === "binary_little_endian") {
			result = this.parseBinaryLittleEndian(dataView, header);
		} else if (header.format === "binary_big_endian") {
			result = this.parseBinaryBigEndian(dataView, header);
		} else {
			throw new Error("Unknown PLY format: " + header.format);
		}

		// Step 10) Return parsed data
		return {
			vertices: result.vertices,
			faces: result.faces,
			normals: result.normals,
			colors: result.colors,
			uvs: result.uvs,
			metadata: {
				format: header.format,
				vertexCount: header.vertexCount,
				faceCount: header.faceCount,
				fileName: file.name
			}
		};
	}

	// Step 11) Parse PLY header
	parseHeader(arrayBuffer) {
		// Step 12) Convert to text to read header
		var decoder = new TextDecoder("utf-8");
		var text = decoder.decode(arrayBuffer);
		var lines = text.split("\n");

		var header = {
			format: null,
			vertexCount: 0,
			faceCount: 0,
			vertexProperties: [],
			faceProperties: [],
			headerEndOffset: 0
		};

		var currentElement = null;
		var offset = 0;

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			offset += lines[i].length + 1; // +1 for newline

			// Step 13) Check for header end
			if (line === "end_header") {
				header.headerEndOffset = offset;
				break;
			}

			// Step 14) Parse magic number
			if (line.startsWith("ply")) {
				continue;
			}

			// Step 15) Parse format
			if (line.startsWith("format")) {
				var parts = line.split(/\s+/);
				header.format = parts[1];
				continue;
			}

			// Step 16) Parse element definitions
			if (line.startsWith("element")) {
				var parts = line.split(/\s+/);
				var elementType = parts[1];
				var count = parseInt(parts[2]);

				if (elementType === "vertex") {
					header.vertexCount = count;
					currentElement = "vertex";
				} else if (elementType === "face") {
					header.faceCount = count;
					currentElement = "face";
				}
				continue;
			}

			// Step 17) Parse property definitions
			if (line.startsWith("property")) {
				var parts = line.split(/\s+/);

				if (currentElement === "vertex") {
					// property float x
					// property uchar red
					var propertyType = parts[1];
					var propertyName = parts[2];

					header.vertexProperties.push({
						type: propertyType,
						name: propertyName
					});
				} else if (currentElement === "face") {
					// property list uchar int vertex_indices
					if (parts[1] === "list") {
						var countType = parts[2];
						var indexType = parts[3];
						var propertyName = parts[4];

						header.faceProperties.push({
							type: "list",
							countType: countType,
							indexType: indexType,
							name: propertyName
						});
					}
				}
				continue;
			}
		}

		return header;
	}

	// Step 18) Parse ASCII PLY format
	parseASCII(arrayBuffer, header) {
		// Step 19) Convert to text
		var decoder = new TextDecoder("utf-8");
		var text = decoder.decode(arrayBuffer);
		var lines = text.split("\n");

		// Step 20) Skip header lines
		var dataStartLine = 0;
		for (var i = 0; i < lines.length; i++) {
			if (lines[i].trim() === "end_header") {
				dataStartLine = i + 1;
				break;
			}
		}

		var vertices = [];
		var faces = [];
		var normals = [];
		var colors = [];
		var uvs = [];

		// Step 21) Parse vertices
		for (var i = 0; i < header.vertexCount; i++) {
			var line = lines[dataStartLine + i].trim();
			if (line === "") continue;

			var values = line.split(/\s+/);
			var vertex = { x: 0, y: 0, z: 0 };
			var normal = null;
			var color = null;
			var uv = null;

			// Step 22) Map properties to values
			for (var j = 0; j < header.vertexProperties.length; j++) {
				var prop = header.vertexProperties[j];
				var value = parseFloat(values[j]);

				if (prop.name === "x") vertex.x = value;
				else if (prop.name === "y") vertex.y = value;
				else if (prop.name === "z") vertex.z = value;
				else if (prop.name === "nx") {
					if (!normal) normal = { x: 0, y: 0, z: 0 };
					normal.x = value;
				} else if (prop.name === "ny") {
					if (!normal) normal = { x: 0, y: 0, z: 0 };
					normal.y = value;
				} else if (prop.name === "nz") {
					if (!normal) normal = { x: 0, y: 0, z: 0 };
					normal.z = value;
				} else if (prop.name === "red" || prop.name === "r") {
					if (!color) color = { r: 0, g: 0, b: 0 };
					color.r = this.normalizeColor(value, prop.type);
				} else if (prop.name === "green" || prop.name === "g") {
					if (!color) color = { r: 0, g: 0, b: 0 };
					color.g = this.normalizeColor(value, prop.type);
				} else if (prop.name === "blue" || prop.name === "b") {
					if (!color) color = { r: 0, g: 0, b: 0 };
					color.b = this.normalizeColor(value, prop.type);
				} else if (prop.name === "u" || prop.name === "s" || prop.name === "texture_u") {
					if (!uv) uv = { u: 0, v: 0 };
					uv.u = value;
				} else if (prop.name === "v" || prop.name === "t" || prop.name === "texture_v") {
					if (!uv) uv = { u: 0, v: 0 };
					uv.v = value;
				}
			}

			vertices.push(vertex);
			if (normal) normals.push(normal);
			if (color) colors.push(color);
			if (uv) uvs.push(uv);
		}

		// Step 23) Parse faces
		var faceStartLine = dataStartLine + header.vertexCount;
		for (var i = 0; i < header.faceCount; i++) {
			var line = lines[faceStartLine + i].trim();
			if (line === "") continue;

			var values = line.split(/\s+/);
			var vertexCount = parseInt(values[0]);
			var indices = [];

			for (var j = 0; j < vertexCount; j++) {
				indices.push(parseInt(values[j + 1]));
			}

			faces.push({ indices: indices });
		}

		return {
			vertices: vertices,
			faces: faces,
			normals: normals,
			colors: colors,
			uvs: uvs
		};
	}

	// Step 24) Parse Binary Little-Endian PLY format
	parseBinaryLittleEndian(dataView, header) {
		var vertices = [];
		var faces = [];
		var normals = [];
		var colors = [];
		var uvs = [];

		var offset = header.headerEndOffset;

		// Step 25) Parse vertices
		for (var i = 0; i < header.vertexCount; i++) {
			var vertex = { x: 0, y: 0, z: 0 };
			var normal = null;
			var color = null;
			var uv = null;

			// Step 26) Read each property
			for (var j = 0; j < header.vertexProperties.length; j++) {
				var prop = header.vertexProperties[j];
				var value = this.readBinaryValue(dataView, offset, prop.type, true);
				offset += this.getTypeSize(prop.type);

				if (prop.name === "x") vertex.x = value;
				else if (prop.name === "y") vertex.y = value;
				else if (prop.name === "z") vertex.z = value;
				else if (prop.name === "nx") {
					if (!normal) normal = { x: 0, y: 0, z: 0 };
					normal.x = value;
				} else if (prop.name === "ny") {
					if (!normal) normal = { x: 0, y: 0, z: 0 };
					normal.y = value;
				} else if (prop.name === "nz") {
					if (!normal) normal = { x: 0, y: 0, z: 0 };
					normal.z = value;
				} else if (prop.name === "red" || prop.name === "r") {
					if (!color) color = { r: 0, g: 0, b: 0 };
					color.r = this.normalizeColor(value, prop.type);
				} else if (prop.name === "green" || prop.name === "g") {
					if (!color) color = { r: 0, g: 0, b: 0 };
					color.g = this.normalizeColor(value, prop.type);
				} else if (prop.name === "blue" || prop.name === "b") {
					if (!color) color = { r: 0, g: 0, b: 0 };
					color.b = this.normalizeColor(value, prop.type);
				} else if (prop.name === "u" || prop.name === "s") {
					if (!uv) uv = { u: 0, v: 0 };
					uv.u = value;
				} else if (prop.name === "v" || prop.name === "t") {
					if (!uv) uv = { u: 0, v: 0 };
					uv.v = value;
				}
			}

			vertices.push(vertex);
			if (normal) normals.push(normal);
			if (color) colors.push(color);
			if (uv) uvs.push(uv);
		}

		// Step 27) Parse faces
		for (var i = 0; i < header.faceCount; i++) {
			var faceProp = header.faceProperties[0];
			var vertexCount = this.readBinaryValue(dataView, offset, faceProp.countType, true);
			offset += this.getTypeSize(faceProp.countType);

			var indices = [];
			for (var j = 0; j < vertexCount; j++) {
				var index = this.readBinaryValue(dataView, offset, faceProp.indexType, true);
				offset += this.getTypeSize(faceProp.indexType);
				indices.push(index);
			}

			faces.push({ indices: indices });
		}

		return {
			vertices: vertices,
			faces: faces,
			normals: normals,
			colors: colors,
			uvs: uvs
		};
	}

	// Step 28) Parse Binary Big-Endian PLY format
	parseBinaryBigEndian(dataView, header) {
		// Step 29) Same as little-endian but with littleEndian = false
		var vertices = [];
		var faces = [];
		var normals = [];
		var colors = [];
		var uvs = [];

		var offset = header.headerEndOffset;

		// Step 30) Parse vertices
		for (var i = 0; i < header.vertexCount; i++) {
			var vertex = { x: 0, y: 0, z: 0 };
			var normal = null;
			var color = null;
			var uv = null;

			for (var j = 0; j < header.vertexProperties.length; j++) {
				var prop = header.vertexProperties[j];
				var value = this.readBinaryValue(dataView, offset, prop.type, false);
				offset += this.getTypeSize(prop.type);

				if (prop.name === "x") vertex.x = value;
				else if (prop.name === "y") vertex.y = value;
				else if (prop.name === "z") vertex.z = value;
				else if (prop.name === "nx") {
					if (!normal) normal = { x: 0, y: 0, z: 0 };
					normal.x = value;
				} else if (prop.name === "ny") {
					if (!normal) normal = { x: 0, y: 0, z: 0 };
					normal.y = value;
				} else if (prop.name === "nz") {
					if (!normal) normal = { x: 0, y: 0, z: 0 };
					normal.z = value;
				} else if (prop.name === "red" || prop.name === "r") {
					if (!color) color = { r: 0, g: 0, b: 0 };
					color.r = this.normalizeColor(value, prop.type);
				} else if (prop.name === "green" || prop.name === "g") {
					if (!color) color = { r: 0, g: 0, b: 0 };
					color.g = this.normalizeColor(value, prop.type);
				} else if (prop.name === "blue" || prop.name === "b") {
					if (!color) color = { r: 0, g: 0, b: 0 };
					color.b = this.normalizeColor(value, prop.type);
				} else if (prop.name === "u" || prop.name === "s") {
					if (!uv) uv = { u: 0, v: 0 };
					uv.u = value;
				} else if (prop.name === "v" || prop.name === "t") {
					if (!uv) uv = { u: 0, v: 0 };
					uv.v = value;
				}
			}

			vertices.push(vertex);
			if (normal) normals.push(normal);
			if (color) colors.push(color);
			if (uv) uvs.push(uv);
		}

		// Step 31) Parse faces
		for (var i = 0; i < header.faceCount; i++) {
			var faceProp = header.faceProperties[0];
			var vertexCount = this.readBinaryValue(dataView, offset, faceProp.countType, false);
			offset += this.getTypeSize(faceProp.countType);

			var indices = [];
			for (var j = 0; j < vertexCount; j++) {
				var index = this.readBinaryValue(dataView, offset, faceProp.indexType, false);
				offset += this.getTypeSize(faceProp.indexType);
				indices.push(index);
			}

			faces.push({ indices: indices });
		}

		return {
			vertices: vertices,
			faces: faces,
			normals: normals,
			colors: colors,
			uvs: uvs
		};
	}

	// Step 32) Read binary value from DataView
	readBinaryValue(dataView, offset, type, littleEndian) {
		if (type === "char" || type === "int8") {
			return dataView.getInt8(offset);
		} else if (type === "uchar" || type === "uint8") {
			return dataView.getUint8(offset);
		} else if (type === "short" || type === "int16") {
			return dataView.getInt16(offset, littleEndian);
		} else if (type === "ushort" || type === "uint16") {
			return dataView.getUint16(offset, littleEndian);
		} else if (type === "int" || type === "int32") {
			return dataView.getInt32(offset, littleEndian);
		} else if (type === "uint" || type === "uint32") {
			return dataView.getUint32(offset, littleEndian);
		} else if (type === "float" || type === "float32") {
			return dataView.getFloat32(offset, littleEndian);
		} else if (type === "double" || type === "float64") {
			return dataView.getFloat64(offset, littleEndian);
		}
		return 0;
	}

	// Step 33) Get byte size of type
	getTypeSize(type) {
		if (type === "char" || type === "uchar" || type === "int8" || type === "uint8") {
			return 1;
		} else if (type === "short" || type === "ushort" || type === "int16" || type === "uint16") {
			return 2;
		} else if (type === "int" || type === "uint" || type === "int32" || type === "uint32" || type === "float" || type === "float32") {
			return 4;
		} else if (type === "double" || type === "float64") {
			return 8;
		}
		return 0;
	}

	// Step 34) Normalize color value to 0-255 range
	normalizeColor(value, type) {
		// Step 35) If type is uchar/uint8, value is already 0-255
		if (type === "uchar" || type === "uint8") {
			return value;
		}
		// Step 36) If type is float, value is 0-1, scale to 0-255
		if (type === "float" || type === "float32" || type === "double" || type === "float64") {
			return Math.floor(value * 255);
		}
		// Step 37) Otherwise assume 0-255
		return value;
	}
}

export default PLYParser;
