/**
 * @fileoverview Deck Class - A section of a blast hole between two depths
 */

import { DECK_TYPES, VALIDATION_MESSAGES } from "./ChargingConstants.js";
import { DecoupledContent } from "./DecoupledContent.js";

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

	/** Number of whole packages that fit in this deck */
	get packageCount() {
		if (this.deckType !== DECK_TYPES.DECOUPLED) return 0;
		if (!this.product || !this.product.lengthMm) return 0;
		var packageLenM = this.product.lengthMm / 1000;
		if (packageLenM <= 0) return 0;
		return Math.floor(this.length / packageLenM);
	}

	/**
	 * Calculate volume in cubic meters.
	 * DECOUPLED decks use product diameter (smaller than hole bore).
	 * @param {number} holeDiameterMm - Hole diameter in millimeters
	 */
	calculateVolume(holeDiameterMm) {
		if (this.deckType === DECK_TYPES.DECOUPLED && this.product && this.product.diameterMm) {
			var rM = (this.product.diameterMm / 1000) / 2;
			var count = this.packageCount;
			if (count > 0) {
				return count * Math.PI * rM * rM * (this.product.lengthMm / 1000);
			}
			return Math.PI * rM * rM * this.length;
		}
		var radiusM = (holeDiameterMm / 1000) / 2;
		return Math.PI * radiusM * radiusM * this.length;
	}

	/**
	 * Calculate mass in kilograms.
	 * DECOUPLED decks use discrete package counting with product dimensions.
	 * Mass = PI * r² * packageLength * density × packageCount
	 * Always calculated from geometry (diameter × length × density) for consistency.
	 * COUPLED/INERT/SPACER decks use hole diameter (original behaviour).
	 * @param {number} holeDiameterMm - Hole diameter in millimeters
	 */
	calculateMass(holeDiameterMm) {
		if (this.deckType === DECK_TYPES.DECOUPLED && this.product) {
			var count = this.packageCount;
			// Discrete packages: count × single-package mass from geometry
			if (count > 0 && this.product.diameterMm && this.effectiveDensity > 0) {
				var pkgLenM = this.product.lengthMm / 1000;
				var rM = (this.product.diameterMm / 1000) / 2;
				var unitMassKg = Math.PI * rM * rM * pkgLenM * this.effectiveDensity * 1000;
				return count * unitMassKg;
			}
			// No package length — continuous fill with product diameter
			if (this.product.diameterMm && this.effectiveDensity > 0) {
				var rM2 = (this.product.diameterMm / 1000) / 2;
				return Math.PI * rM2 * rM2 * this.length * this.effectiveDensity * 1000;
			}
		}
		// COUPLED / INERT / SPACER — use hole diameter (original behaviour)
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
			contains: this.contains ? this.contains.map(function(c) { return c.toJSON ? c.toJSON() : c; }) : null,
			isCompressible: this.isCompressible,
			averageDensity: this.averageDensity,
			capDensity: this.capDensity,
			maxCompressibleDensity: this.maxCompressibleDensity,
			created: this.created,
			modified: this.modified
		};
	}

	static fromJSON(obj) {
		var deck = new Deck(obj);
		if (obj.contains && Array.isArray(obj.contains)) {
			deck.contains = obj.contains.map(function(c) {
				return c instanceof DecoupledContent ? c : DecoupledContent.fromJSON(c);
			});
		}
		return deck;
	}
}
