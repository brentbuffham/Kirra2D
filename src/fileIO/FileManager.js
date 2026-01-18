// src/fileIO/FileManager.js
//=============================================================
// FILE MANAGER - CENTRAL FILE IO REGISTRY
//=============================================================
// Step 1) Central manager for all file import/export operations
// Step 2) Manages parser and writer registration and dispatching
// Step 3) Converted to ES Module for Vite bundling
// Step 4) Created: 2026-01-03, Updated: 2026-01-17

// Step 5) Define FileManager class
class FileManager {
	constructor() {
		// Step 6) Initialize parser and writer registries
		this.parsers = new Map(); // format -> ParserClass
		this.writers = new Map(); // format -> WriterClass

		// Step 7) Format metadata for better format detection
		this.formatMetadata = new Map(); // format -> { extensions: [], description: "", category: "" }
	}

	// Step 8) Register a parser for a specific format
	registerParser(format, ParserClass, metadata = {}) {
		this.parsers.set(format, ParserClass);

		// Step 9) Store metadata for this format
		if (metadata.extensions || metadata.description) {
			this.formatMetadata.set(format, {
				extensions: metadata.extensions || [format],
				description: metadata.description || "",
				category: metadata.category || "general"
			});
		}
	}

	// Step 10) Register a writer for a specific format
	registerWriter(format, WriterClass, metadata = {}) {
		this.writers.set(format, WriterClass);

		// Step 11) Update or create metadata for this format
		var existing = this.formatMetadata.get(format) || {};
		this.formatMetadata.set(format, {
			extensions: metadata.extensions || existing.extensions || [format],
			description: metadata.description || existing.description || "",
			category: metadata.category || existing.category || "general"
		});
	}

	// Step 12) Parse file based on extension or explicit format
	async parse(file, options = {}) {
		// Step 13) Determine format from explicit option or file extension
		var format = options.format;

		if (!format) {
			// Step 13a) Check if this is a DXF file that needs binary detection
			var ext = this.getExtension(file.name);
			if (ext === "dxf" && !options.skipBinaryDetection) {
				format = await this.detectDXFFormat(file);
			} else {
				format = this.detectFormat(file.name, options);
			}
		}

		if (!format) {
			throw new Error("Could not detect file format for: " + file.name);
		}

		// Step 14) Get parser class for this format
		var Parser = this.parsers.get(format);

		if (!Parser) {
			throw new Error("No parser registered for format: " + format);
		}

		// Step 15) Create parser instance and parse file
		try {
			var parser = new Parser(options);
			return await parser.parse(file);
		} catch (error) {
			throw new Error("Parse error for " + file.name + ": " + error.message);
		}
	}

	// Step 15a) Detect DXF format (binary vs ASCII) by reading file header
	async detectDXFFormat(file) {
		var BINARY_SENTINEL = "AutoCAD Binary DXF\r\n\x1a\x00";
		var SENTINEL_LENGTH = 22;

		try {
			// Read first 22 bytes of the file
			var slice = file.slice(0, SENTINEL_LENGTH);
			var arrayBuffer = await this.readBlobAsArrayBuffer(slice);
			var buffer = new Uint8Array(arrayBuffer);

			// Check for binary DXF sentinel
			if (buffer.length >= SENTINEL_LENGTH) {
				var sentinel = "";
				for (var i = 0; i < SENTINEL_LENGTH; i++) {
					sentinel += String.fromCharCode(buffer[i]);
				}
				if (sentinel === BINARY_SENTINEL) {
					console.log("Detected Binary DXF format");
					return "dxf-binary";
				}
			}

			// Default to ASCII DXF
			console.log("Detected ASCII DXF format");
			return "dxf";
		} catch (error) {
			console.warn("DXF format detection failed, defaulting to ASCII:", error);
			return "dxf";
		}
	}

	// Step 15b) Helper to read blob as array buffer
	readBlobAsArrayBuffer(blob) {
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

	// Step 16) Write data to specified format
	async write(data, format, options = {}) {
		// Step 17) Get writer class for this format
		var Writer = this.writers.get(format);

		if (!Writer) {
			throw new Error("No writer registered for format: " + format);
		}

		// Step 18) Create writer instance and generate output
		try {
			var writer = new Writer(options);
			return await writer.write(data);
		} catch (error) {
			throw new Error("Write error for format " + format + ": " + error.message);
		}
	}

	// Step 19) Detect format from filename (synchronous, for non-DXF files)
	detectFormat(filename, options = {}) {
		// Step 20) Get file extension
		var ext = this.getExtension(filename);

		// Step 21) Check for ambiguous extensions that need heuristics
		if (ext === "csv") {
			// Step 22) CSV could be blast holes or point cloud
			return options.formatHint || "blasthole-csv";
		}

		if (ext === "txt") {
			// Step 23) TXT could be KAD, CSV, or other formats
			return options.formatHint || "kad";
		}

		// Step 24) For non-ambiguous extensions, find matching format
		for (var [format, metadata] of this.formatMetadata.entries()) {
			if (metadata.extensions && metadata.extensions.includes(ext)) {
				return format;
			}
		}

		// Step 25) Fallback to extension as format
		return ext;
	}

	// Step 26) Get supported formats
	getSupportedFormats() {
		return {
			parsers: Array.from(this.parsers.keys()),
			writers: Array.from(this.writers.keys())
		};
	}

	// Step 27) Get format info
	getFormatInfo(format) {
		return this.formatMetadata.get(format) || null;
	}

	// Step 28) Get all formats by category
	getFormatsByCategory(category) {
		var formats = [];

		for (var [format, metadata] of this.formatMetadata.entries()) {
			if (metadata.category === category) {
				formats.push({
					format: format,
					metadata: metadata
				});
			}
		}

		return formats;
	}

	// Step 29) Helper to extract file extension
	getExtension(filename) {
		if (!filename || typeof filename !== "string") {
			return "";
		}

		var parts = filename.split(".");

		if (parts.length < 2) {
			return "";
		}

		return parts[parts.length - 1].toLowerCase();
	}

	// Step 30) Check if format has parser
	canParse(format) {
		return this.parsers.has(format);
	}

	// Step 31) Check if format has writer
	canWrite(format) {
		return this.writers.has(format);
	}

	// Step 32) Get parser instance for a format
	getParser(format, options = {}) {
		var ParserClass = this.parsers.get(format);
		if (!ParserClass) {
			return null;
		}
		return new ParserClass(options);
	}

	// Step 33) Get writer instance for a format
	getWriter(format, options = {}) {
		var WriterClass = this.writers.get(format);
		if (!WriterClass) {
			return null;
		}
		return new WriterClass(options);
	}

	// Step 34) Get file filter string for file picker dialogs
	getFileFilter(category = null) {
		var extensions = new Set();

		// Step 35) Collect all extensions, optionally filtered by category
		for (var [format, metadata] of this.formatMetadata.entries()) {
			if (category === null || metadata.category === category) {
				if (metadata.extensions) {
					metadata.extensions.forEach(ext => extensions.add(ext));
				}
			}
		}

		// Step 36) Convert to array and format for file picker
		var extArray = Array.from(extensions);

		if (extArray.length === 0) {
			return "";
		}

		// Step 37) Create filter string (e.g., ".csv,.kad,.dxf")
		return extArray.map(ext => "." + ext).join(",");
	}
}

// Step 38) Create singleton instance
var fileManager = new FileManager();

// Step 39) Export singleton instance
export default fileManager;
