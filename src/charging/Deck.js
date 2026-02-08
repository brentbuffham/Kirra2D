/**
 * @fileoverview Deck Class - A section of a blast hole between two depths
 */

import { DECK_TYPES, VALIDATION_MESSAGES } from "./ChargingConstants.js";

export function generateUUID() {
	if (crypto && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0;
		var v = c === "x" ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

export class Deck {
	constructor(options) {
		this.deckID = options.deckID || generateUUID();
		this.holeID = options.holeID;
		this.deckType = options.deckType || DECK_TYPES.INERT;
		this.topDepth = options.topDepth;       // lengthFromCollar
		this.baseDepth = options.baseDepth;     // lengthFromCollar
		this.product = options.product || null;  // { productID, name, density, ... }
		this.contains = options.contains || null; // DecoupledContent[] or spacer item details

		// For compressible COUPLED decks (gassed emulsions)
		this.isCompressible = options.isCompressible || false;
		this.averageDensity = options.averageDensity || null;
		this.capDensity = options.capDensity || null;
		this.maxCompressibleDensity = options.maxCompressibleDensity || null;

		this.created = options.created || new Date().toISOString();
		this.modified = new Date().toISOString();
	}

	get length() {
		return Math.abs(this.baseDepth - this.topDepth);
	}

	get effectiveDensity() {
		if (this.isCompressible && this.averageDensity) return this.averageDensity;
		return this.product ? (this.product.density || 0) : 0;
	}

	/**
	 * Calculate volume in cubic meters
	 * @param {number} holeDiameterMm - Hole diameter in millimeters
	 */
	calculateVolume(holeDiameterMm) {
		var radiusM = (holeDiameterMm / 1000) / 2;
		return Math.PI * radiusM * radiusM * this.length;
	}

	/**
	 * Calculate mass in kilograms
	 * density is in g/cc = tonnes/m3, so mass = volume * density * 1000 for kg
	 * @param {number} holeDiameterMm - Hole diameter in millimeters
	 */
	calculateMass(holeDiameterMm) {
		return this.calculateVolume(holeDiameterMm) * this.effectiveDensity * 1000;
	}

	containsDepth(depth) {
		var min = Math.min(this.topDepth, this.baseDepth);
		var max = Math.max(this.topDepth, this.baseDepth);
		return depth >= min && depth <= max;
	}

	validate() {
		var errors = [], warnings = [];
		if (this.topDepth === this.baseDepth) errors.push(VALIDATION_MESSAGES.ZERO_DECK_LENGTH);
		if (!this.product) warnings.push(VALIDATION_MESSAGES.NO_PRODUCT_ASSIGNED);
		if (this.deckType === DECK_TYPES.DECOUPLED && (!this.contains || this.contains.length === 0)) {
			warnings.push("Decoupled deck has no contents");
		}
		if (this.deckType === DECK_TYPES.SPACER && !this.contains) {
			warnings.push("Spacer deck has no item details");
		}
		return { valid: errors.length === 0, errors: errors, warnings: warnings };
	}

	toJSON() {
		return {
			deckID: this.deckID,
			holeID: this.holeID,
			deckType: this.deckType,
			topDepth: this.topDepth,
			baseDepth: this.baseDepth,
			product: this.product,
			contains: this.contains,
			isCompressible: this.isCompressible,
			averageDensity: this.averageDensity,
			capDensity: this.capDensity,
			maxCompressibleDensity: this.maxCompressibleDensity,
			created: this.created,
			modified: this.modified
		};
	}

	static fromJSON(obj) {
		return new Deck(obj);
	}
}
