// src/fileIO/AutoCadIO/DXFUtils.js
//=============================================================
// DXF UTILITIES
//=============================================================
// Step 1) Utility functions for DXF file handling
// Step 2) Detects ASCII vs Binary DXF format
// Step 3) Provides unified parsing interface
// Step 4) Created: 2026-01-16, Updated: 2026-01-17

// Step 5) Binary DXF sentinel constant
const BINARY_DXF_SENTINEL = "AutoCAD Binary DXF\r\n\x1a\x00";
const BINARY_DXF_SENTINEL_LENGTH = 22;

// Step 6) DXFUtils static class
class DXFUtils {
	/**
	 * Step 7) Detect if file/buffer is Binary DXF or ASCII DXF
	 * @param {ArrayBuffer|Uint8Array|File} input - Input to check
	 * @returns {Promise<string>} - "binary", "ascii", or "unknown"
	 */
	static async detectFormat(input) {
		var buffer;

		// Step 8) Get ArrayBuffer from input
		if (input instanceof ArrayBuffer) {
			buffer = new Uint8Array(input);
		} else if (input instanceof Uint8Array) {
			buffer = input;
		} else if (input instanceof File || input instanceof Blob) {
			// Read first 30 bytes to determine format
			var slice = input.slice(0, 30);
			var arrayBuffer = await DXFUtils.readBlobAsArrayBuffer(slice);
			buffer = new Uint8Array(arrayBuffer);
		} else {
			return "unknown";
		}

		// Step 9) Check for binary DXF sentinel
		if (buffer.length >= BINARY_DXF_SENTINEL_LENGTH) {
			var sentinel = "";
			for (var i = 0; i < BINARY_DXF_SENTINEL_LENGTH; i++) {
				sentinel += String.fromCharCode(buffer[i]);
			}
			if (sentinel === BINARY_DXF_SENTINEL) {
				return "binary";
			}
		}

		// Step 10) Check for ASCII DXF (starts with "0" and "SECTION")
		if (buffer.length >= 10) {
			var header = "";
			for (var i = 0; i < Math.min(100, buffer.length); i++) {
				var char = buffer[i];
				if (char >= 32 && char <= 126) {
					header += String.fromCharCode(char);
				} else if (char === 10 || char === 13) {
					header += "\n";
				}
			}

			// Look for DXF markers
			if (header.indexOf("SECTION") !== -1 || (header.indexOf("0") !== -1 && header.indexOf("HEADER") !== -1)) {
				return "ascii";
			}
		}

		return "unknown";
	}

	/**
	 * Step 11) Read Blob as ArrayBuffer (Promise-based)
	 */
	static readBlobAsArrayBuffer(blob) {
		return new Promise(function(resolve, reject) {
			var reader = new FileReader();
			reader.onload = function() {
				resolve(reader.result);
			};
			reader.onerror = function() {
				reject(new Error("Failed to read blob"));
			};
			reader.readAsArrayBuffer(blob);
		});
	}

	/**
	 * Step 12) Read File as text (Promise-based)
	 */
	static readFileAsText(file) {
		return new Promise(function(resolve, reject) {
			var reader = new FileReader();
			reader.onload = function() {
				resolve(reader.result);
			};
			reader.onerror = function() {
				reject(new Error("Failed to read file"));
			};
			reader.readAsText(file);
		});
	}

	/**
	 * Step 13) Parse DXF file (auto-detects format and uses appropriate parser)
	 * This can be used standalone or via FileManager
	 * @param {File} file - DXF file to parse
	 * @param {Object} options - Parser options
	 * @returns {Promise<Object>} - Parsed data
	 */
	static async parseFile(file, options) {
		options = options || {};

		// Step 14) Detect format
		var format = await DXFUtils.detectFormat(file);
		console.log("Detected DXF format:", format);

		if (format === "binary") {
			// Step 15) Use BinaryDXFParser
			// Dynamic import to avoid circular dependencies
			var BinaryDXFParser = (await import("./BinaryDXFParser.js")).default;
			var parser = new BinaryDXFParser(options);
			return await parser.parse(file);
		} else if (format === "ascii") {
			// Step 16) Use standard DXFParser with dxf-parser library
			if (!window.DxfParser) {
				throw new Error("DxfParser library not available for ASCII DXF parsing");
			}

			// Read file as text
			var text = await DXFUtils.readFileAsText(file);

			// Parse with dxf-parser library
			var dxfParser = new window.DxfParser();
			var dxfData = dxfParser.parseSync(text);

			// Use DXFParser to convert to KAD format
			var DXFParser = (await import("./DXFParser.js")).default;
			var parser = new DXFParser(options);
			return await parser.parse({ dxfData: dxfData });
		} else {
			throw new Error("Unknown or unsupported DXF format");
		}
	}

	/**
	 * Step 17) Get the correct FileManager format key based on file content
	 * @param {File} file - DXF file to check
	 * @returns {Promise<string>} - "dxf" or "dxf-binary"
	 */
	static async getFileManagerFormat(file) {
		var format = await DXFUtils.detectFormat(file);
		return format === "binary" ? "dxf-binary" : "dxf";
	}

	/**
	 * Step 18) Convert ASCII DXF to Binary DXF
	 * @param {string} asciiDxf - ASCII DXF content
	 * @returns {Uint8Array} - Binary DXF content
	 */
	static asciiToBinary(asciiDxf) {
		var buffer = [];

		// Step 19) Write sentinel
		for (var i = 0; i < BINARY_DXF_SENTINEL.length; i++) {
			buffer.push(BINARY_DXF_SENTINEL.charCodeAt(i));
		}

		// Step 20) Parse ASCII DXF lines
		var lines = asciiDxf.split(/\r?\n/);
		var lineIndex = 0;

		while (lineIndex < lines.length) {
			var groupCodeLine = lines[lineIndex];
			var valueLine = lines[lineIndex + 1];

			if (groupCodeLine === undefined) {
				break;
			}

			// Skip empty lines
			if (groupCodeLine.trim() === "") {
				lineIndex++;
				continue;
			}

			var groupCode = parseInt(groupCodeLine.trim(), 10);

			if (isNaN(groupCode)) {
				lineIndex++;
				continue;
			}

			// Step 21) Write group code
			if (groupCode > 254) {
				buffer.push(255);
				DXFUtils.writeInt16ToBuffer(buffer, groupCode);
			} else {
				buffer.push(groupCode & 0xff);
			}

			// Step 22) Write value based on group code type
			var valueType = DXFUtils.getGroupCodeType(groupCode);
			var value = valueLine !== undefined ? valueLine.trim() : "";

			switch (valueType) {
				case "string":
					DXFUtils.writeStringToBuffer(buffer, value);
					break;

				case "double":
					var doubleVal = parseFloat(value) || 0;
					DXFUtils.writeDoubleToBuffer(buffer, doubleVal);
					break;

				case "int16":
					var int16Val = parseInt(value, 10) || 0;
					DXFUtils.writeInt16ToBuffer(buffer, int16Val);
					break;

				case "int32":
					var int32Val = parseInt(value, 10) || 0;
					DXFUtils.writeInt32ToBuffer(buffer, int32Val);
					break;

				default:
					DXFUtils.writeStringToBuffer(buffer, value);
			}

			lineIndex += 2;
		}

		return new Uint8Array(buffer);
	}

	/**
	 * Step 23) Convert Binary DXF to ASCII DXF
	 * @param {ArrayBuffer|Uint8Array} binaryDxf - Binary DXF content
	 * @returns {string} - ASCII DXF content
	 */
	static binaryToAscii(binaryDxf) {
		var buffer = binaryDxf instanceof Uint8Array ? binaryDxf : new Uint8Array(binaryDxf);
		var dataView = new DataView(buffer.buffer);
		var position = 0;
		var result = "";

		// Step 24) Skip sentinel
		if (buffer.length < BINARY_DXF_SENTINEL_LENGTH) {
			throw new Error("Invalid binary DXF: too short");
		}

		// Verify sentinel
		var sentinel = "";
		for (var i = 0; i < BINARY_DXF_SENTINEL_LENGTH; i++) {
			sentinel += String.fromCharCode(buffer[i]);
		}

		if (sentinel !== BINARY_DXF_SENTINEL) {
			throw new Error("Invalid binary DXF: sentinel mismatch");
		}

		position = BINARY_DXF_SENTINEL_LENGTH;

		// Step 25) Read group-value pairs
		while (position < buffer.length) {
			// Read group code
			var groupCode;
			var firstByte = buffer[position++];

			if (firstByte === 255) {
				if (position + 2 > buffer.length) break;
				groupCode = dataView.getInt16(position, true);
				position += 2;
			} else {
				groupCode = firstByte;
			}

			// Read value
			var valueType = DXFUtils.getGroupCodeType(groupCode);
			var value;

			switch (valueType) {
				case "string":
					value = "";
					while (position < buffer.length) {
						var byte = buffer[position++];
						if (byte === 0) break;
						value += String.fromCharCode(byte);
					}
					break;

				case "double":
					if (position + 8 > buffer.length) break;
					value = dataView.getFloat64(position, true);
					position += 8;
					break;

				case "int16":
					if (position + 2 > buffer.length) break;
					value = dataView.getInt16(position, true);
					position += 2;
					break;

				case "int32":
					if (position + 4 > buffer.length) break;
					value = dataView.getInt32(position, true);
					position += 4;
					break;

				default:
					value = "";
					while (position < buffer.length) {
						var byte = buffer[position++];
						if (byte === 0) break;
						value += String.fromCharCode(byte);
					}
			}

			// Step 26) Format output
			result += "  " + groupCode + "\n";

			if (typeof value === "number") {
				if (valueType === "double") {
					result += value.toFixed(6) + "\n";
				} else {
					result += value + "\n";
				}
			} else {
				result += value + "\n";
			}
		}

		return result;
	}

	/**
	 * Step 27) Get value type for group code
	 */
	static getGroupCodeType(code) {
		// String group codes
		if ((code >= 0 && code <= 9) || (code >= 100 && code <= 102) || code === 105 || (code >= 300 && code <= 369) || (code >= 390 && code <= 399) || (code >= 410 && code <= 419) || (code >= 430 && code <= 439) || (code >= 470 && code <= 481) || code === 999 || (code >= 1000 && code <= 1009)) {
			return "string";
		}

		// Double (floating-point) group codes
		if ((code >= 10 && code <= 59) || (code >= 110 && code <= 149) || (code >= 210 && code <= 239) || (code >= 460 && code <= 469) || (code >= 1010 && code <= 1059)) {
			return "double";
		}

		// 16-bit integer group codes
		if ((code >= 60 && code <= 79) || (code >= 170 && code <= 179) || (code >= 270 && code <= 289) || (code >= 370 && code <= 389) || (code >= 400 && code <= 409) || (code >= 1060 && code <= 1070)) {
			return "int16";
		}

		// 32-bit integer group codes
		if ((code >= 90 && code <= 99) || (code >= 420 && code <= 429) || (code >= 440 && code <= 449) || code === 1071) {
			return "int32";
		}

		return "string";
	}

	/**
	 * Step 28) Write null-terminated string to buffer
	 */
	static writeStringToBuffer(buffer, str) {
		for (var i = 0; i < str.length; i++) {
			buffer.push(str.charCodeAt(i) & 0xff);
		}
		buffer.push(0);
	}

	/**
	 * Step 29) Write 16-bit integer to buffer (little-endian)
	 */
	static writeInt16ToBuffer(buffer, value) {
		buffer.push(value & 0xff);
		buffer.push((value >> 8) & 0xff);
	}

	/**
	 * Step 30) Write 32-bit integer to buffer (little-endian)
	 */
	static writeInt32ToBuffer(buffer, value) {
		buffer.push(value & 0xff);
		buffer.push((value >> 8) & 0xff);
		buffer.push((value >> 16) & 0xff);
		buffer.push((value >> 24) & 0xff);
	}

	/**
	 * Step 31) Write 64-bit double to buffer (little-endian)
	 */
	static writeDoubleToBuffer(buffer, value) {
		var float64 = new Float64Array(1);
		float64[0] = value;
		var bytes = new Uint8Array(float64.buffer);

		for (var i = 0; i < 8; i++) {
			buffer.push(bytes[i]);
		}
	}

	/**
	 * Step 32) Get file extension suggestion based on format
	 */
	static getFileExtension(format) {
		return ".dxf"; // Both binary and ASCII use .dxf
	}

	/**
	 * Step 33) Create download link for DXF blob
	 */
	static downloadBlob(blob, filename) {
		var url = URL.createObjectURL(blob);
		var a = document.createElement("a");
		a.href = url;
		a.download = filename || "export.dxf";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
}

export default DXFUtils;
