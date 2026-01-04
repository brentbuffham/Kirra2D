// src/fileIO/BaseParser.js
//=============================================================
// BASE PARSER CLASS
//=============================================================
// Step 1) Abstract base class for all file parsers
// Step 2) Provides common file reading utilities and interface
// Step 3) Converted to ES Module for Vite bundling
// Step 4) Created: 2026-01-03

// Step 5) Base class for all parsers
class BaseParser {
	constructor(options = {}) {
		// Step 6) Store parser options
		this.options = options;

		// Step 7) Coordinate transform options (for UTM/large coordinates per RULES)
		this.centroidX = options.centroidX || 0;
		this.centroidY = options.centroidY || 0;
		this.coordinateSystem = options.coordinateSystem || "LOCAL";
	}

	// Step 8) Abstract method - must be implemented by subclass
	async parse(file) {
		throw new Error("parse() must be implemented by subclass");
	}

	// Step 9) Common helper - read file as text
	async readAsText(file) {
		return new Promise((resolve, reject) => {
			var reader = new FileReader();
			reader.onload = (e) => resolve(e.target.result);
			reader.onerror = (e) => reject(new Error("Failed to read file as text: " + e.target.error));
			reader.readAsText(file);
		});
	}

	// Step 10) Common helper - read file as array buffer
	async readAsArrayBuffer(file) {
		return new Promise((resolve, reject) => {
			var reader = new FileReader();
			reader.onload = (e) => resolve(e.target.result);
			reader.onerror = (e) => reject(new Error("Failed to read file as array buffer: " + e.target.error));
			reader.readAsArrayBuffer(file);
		});
	}

	// Step 11) Common helper - read file as data URL
	async readAsDataURL(file) {
		return new Promise((resolve, reject) => {
			var reader = new FileReader();
			reader.onload = (e) => resolve(e.target.result);
			reader.onerror = (e) => reject(new Error("Failed to read file as data URL: " + e.target.error));
			reader.readAsDataURL(file);
		});
	}

	// Step 12) Common helper - show progress dialog for large files
	showProgressDialog(message) {
		if (window.FloatingDialog) {
			// Step 13) Use FloatingDialog per RULES
			return window.FloatingDialog.showProgress(message);
		}
		return null;
	}

	// Step 14) Common helper - update progress dialog
	updateProgress(dialog, percent, message) {
		if (dialog && dialog.updateProgress) {
			dialog.updateProgress(percent, message);
		}
	}

	// Step 15) Common helper - close progress dialog
	closeProgress(dialog) {
		if (dialog && dialog.close) {
			dialog.close();
		}
	}

	// Step 16) Common helper - apply coordinate transform (per RULES)
	transformCoordinates(x, y) {
		// Step 17) For UTM/large coordinates, transform based on centroid
		if (this.options.applyTransform) {
			return {
				x: x - this.centroidX,
				y: y - this.centroidY
			};
		}
		return { x: x, y: y };
	}

	// Step 18) Common helper - reverse coordinate transform
	reverseTransformCoordinates(x, y) {
		// Step 19) Convert back from local to original coordinates
		if (this.options.applyTransform) {
			return {
				x: x + this.centroidX,
				y: y + this.centroidY
			};
		}
		return { x: x, y: y };
	}

	// Step 20) Common helper - calculate centroid from coordinate array
	calculateCentroid(coordinates) {
		if (!coordinates || coordinates.length === 0) {
			return { x: 0, y: 0 };
		}

		var sumX = 0;
		var sumY = 0;
		var count = coordinates.length;

		for (var i = 0; i < count; i++) {
			sumX += coordinates[i].x;
			sumY += coordinates[i].y;
		}

		return {
			x: sumX / count,
			y: sumY / count
		};
	}

	// Step 21) Common helper - validate file extension
	validateExtension(filename, expectedExtensions) {
		var parts = filename.split(".");
		var ext = parts[parts.length - 1].toLowerCase();

		if (Array.isArray(expectedExtensions)) {
			return expectedExtensions.includes(ext);
		}

		return ext === expectedExtensions.toLowerCase();
	}

	// Step 22) Common helper - get file extension
	getExtension(filename) {
		var parts = filename.split(".");
		return parts[parts.length - 1].toLowerCase();
	}
}

export default BaseParser;
