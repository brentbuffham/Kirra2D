// src/fileIO/FileManager.js
//=============================================================
// FILE MANAGER - CENTRAL FILE IO REGISTRY
//=============================================================
// Step 1) Central manager for all file import/export operations
// Step 2) Manages parser and writer registration and dispatching
// Step 3) Converted to ES Module for Vite bundling
// Step 4) Created: 2026-01-03

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
		var format = options.format || this.detectFormat(file.name, options);

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

	// Step 19) Detect format from filename
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
