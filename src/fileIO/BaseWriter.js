// src/fileIO/BaseWriter.js
//=============================================================
// BASE WRITER CLASS
//=============================================================
// Step 1) Abstract base class for all file writers
// Step 2) Provides common file writing utilities and interface
// Step 3) Converted to ES Module for Vite bundling
// Step 4) Created: 2026-01-03

// Step 5) Base class for all writers
class BaseWriter {
	constructor(options = {}) {
		// Step 6) Store writer options
		this.options = options;

		// Step 7) Coordinate transform options (for UTM/large coordinates per RULES)
		this.centroidX = options.centroidX || 0;
		this.centroidY = options.centroidY || 0;
		this.coordinateSystem = options.coordinateSystem || "LOCAL";
	}

	// Step 8) Abstract method - must be implemented by subclass
	async write(data) {
		throw new Error("write() must be implemented by subclass");
	}

	// Step 9) Common helper - create Blob from string content
	createBlob(content, mimeType = "text/plain") {
		return new Blob([content], { type: mimeType });
	}

	// Step 10) Common helper - create Blob from array buffer
	createBlobFromBuffer(buffer, mimeType = "application/octet-stream") {
		return new Blob([buffer], { type: mimeType });
	}

	// Step 11) Common helper - trigger file download
	downloadFile(blob, filename) {
		// Step 12) Create temporary anchor element to trigger download
		var a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = filename;

		// Step 13) Trigger click and cleanup
		a.click();

		// Step 14) Clean up object URL after download
		setTimeout(() => {
			URL.revokeObjectURL(a.href);
		}, 100);
	}

	// Step 15) Common helper - download multiple files
	downloadMultipleFiles(files) {
		// Step 16) files array format: [{ blob: Blob, filename: "name.ext" }, ...]
		files.forEach((file, index) => {
			// Step 17) Stagger downloads slightly to avoid browser blocking
			setTimeout(() => {
				this.downloadFile(file.blob, file.filename);
			}, index * 100);
		});
	}

	// Step 18) Common helper - generate timestamp for filenames
	generateTimestamp() {
		// Step 19) Format: YYYYMMDD_HHMMSS (no template literals per RULES)
		var now = new Date();
		var year = now.getFullYear();
		var month = String(now.getMonth() + 1).padStart(2, "0");
		var day = String(now.getDate()).padStart(2, "0");
		var hours = String(now.getHours()).padStart(2, "0");
		var minutes = String(now.getMinutes()).padStart(2, "0");
		var seconds = String(now.getSeconds()).padStart(2, "0");

		return year + month + day + "_" + hours + minutes + seconds;
	}

	// Step 20) Common helper - show progress dialog for large exports
	showProgressDialog(message) {
		if (window.FloatingDialog) {
			// Step 21) Use FloatingDialog per RULES
			return window.FloatingDialog.showProgress(message);
		}
		return null;
	}

	// Step 22) Common helper - update progress dialog
	updateProgress(dialog, percent, message) {
		if (dialog && dialog.updateProgress) {
			dialog.updateProgress(percent, message);
		}
	}

	// Step 23) Common helper - close progress dialog
	closeProgress(dialog) {
		if (dialog && dialog.close) {
			dialog.close();
		}
	}

	// Step 24) Common helper - apply coordinate transform (per RULES)
	transformCoordinates(x, y) {
		// Step 25) For UTM/large coordinates, transform based on centroid
		if (this.options.applyTransform) {
			return {
				x: x - this.centroidX,
				y: y - this.centroidY
			};
		}
		return { x: x, y: y };
	}

	// Step 26) Common helper - reverse coordinate transform
	reverseTransformCoordinates(x, y) {
		// Step 27) Convert back from local to original coordinates
		if (this.options.applyTransform) {
			return {
				x: x + this.centroidX,
				y: y + this.centroidY
			};
		}
		return { x: x, y: y };
	}

	// Step 28) Common helper - filter visible entities
	filterVisibleEntities(entities) {
		// Step 29) Filter entities based on visibility
		if (!Array.isArray(entities)) {
			return [];
		}

		return entities.filter((entity) => {
			// Step 30) Check entity visibility using global function if available
			if (window.isEntityVisible && entity.entityName) {
				return window.isEntityVisible(entity.entityName);
			}

			// Step 31) Fallback to visible property
			return entity.visible !== false;
		});
	}

	// Step 32) Common helper - filter visible blast holes
	filterVisibleHoles(holes) {
		// Step 33) Filter blast holes based on visibility
		if (!Array.isArray(holes)) {
			return [];
		}

		return holes.filter((hole) => {
			// Step 34) Check hole visibility using global function if available
			if (window.isHoleVisible) {
				return window.isHoleVisible(hole);
			}

			// Step 35) Fallback to visible property and group visibility
			return window.blastGroupVisible && hole.visible !== false;
		});
	}

	// Step 36) Common helper - sanitize filename
	sanitizeFilename(filename) {
		// Step 37) Remove invalid characters from filename
		return filename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
	}
}

export default BaseWriter;
