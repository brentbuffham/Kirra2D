/**
 * @fileoverview HoleCharging - Manages all charging data for a single hole
 * Includes interval-based fill operations for rule engine support
 */

import { Deck, generateUUID } from "./Deck.js";
import { Primer } from "./Primer.js";
import { DECK_TYPES, DEFAULT_DECK, VALIDATION_MESSAGES } from "./ChargingConstants.js";

export class HoleCharging {
	constructor(hole) {
		this.holeID = hole.holeID;
		this.entityName = hole.entityName || null;
		this.holeDiameterMm = hole.holeDiameter || 0;           // mm
		this.holeLength = hole.holeLengthCalculated || hole.measuredLength || 0;
		this.autoRecalculate = hole.autoRecalculate !== undefined ? hole.autoRecalculate : true;

		this.decks = [];
		this.primers = [];

		this.created = new Date().toISOString();
		this.modified = new Date().toISOString();

		if (this.holeDiameterMm > 0 && this.holeLength !== 0) {
			this.initializeDefaultDeck();
		}
	}

	initializeDefaultDeck() {
		if (this.decks.length === 0) {
			var top = this.holeLength < 0 ? this.holeLength : 0;
			var base = this.holeLength < 0 ? 0 : this.holeLength;
			this.decks.push(new Deck({
				holeID: this.holeID,
				deckType: DECK_TYPES.INERT,
				topDepth: top,
				baseDepth: base,
				product: { name: "Air", density: DEFAULT_DECK.density }
			}));
		}
	}

	sortDecks() {
		this.decks.sort(function(a, b) { return a.topDepth - b.topDepth; });
	}

	// ============ INTERVAL OPERATIONS ============

	/**
	 * Get unallocated intervals (gaps not yet assigned a non-Air product)
	 * Returns array of {top, base} intervals
	 */
	getUnallocated() {
		var unallocated = [];
		for (var i = 0; i < this.decks.length; i++) {
			var deck = this.decks[i];
			if (deck.deckType === DECK_TYPES.INERT && deck.product && deck.product.name === "Air") {
				unallocated.push({ top: deck.topDepth, base: deck.baseDepth, length: deck.length });
			}
		}
		return unallocated;
	}

	/**
	 * Fill an interval with a product, creating the appropriate deck type
	 * Automatically splits existing decks that overlap the interval
	 */
	fillInterval(topDepth, baseDepth, deckType, product, options) {
		var newDeck = new Deck({
			holeID: this.holeID,
			deckType: deckType,
			topDepth: topDepth,
			baseDepth: baseDepth,
			product: product,
			isCompressible: options ? options.isCompressible : false,
			averageDensity: options ? options.averageDensity : null,
			capDensity: options ? options.capDensity : null,
			maxCompressibleDensity: options ? options.maxCompressibleDensity : null
		});
		return this.insertDeck(newDeck);
	}

	/**
	 * Fill interval to a target mass in kg
	 * Calculates required length based on product density and hole diameter
	 */
	fillToMass(startFromBase, deckType, product, massKg) {
		if (!product || !product.density || product.density === 0) return null;
		var radiusM = (this.holeDiameterMm / 1000) / 2;
		var volumeM3 = massKg / (product.density * 1000);
		var lengthM = volumeM3 / (Math.PI * radiusM * radiusM);

		// Fill from base upward
		var unalloc = this.getUnallocated();
		if (unalloc.length === 0) return null;

		var lastUnalloc = unalloc[unalloc.length - 1];
		var actualLength = Math.min(lengthM, lastUnalloc.length);
		var topDepth = lastUnalloc.base - actualLength;
		var baseDepth = lastUnalloc.base;

		return this.fillInterval(topDepth, baseDepth, deckType, product);
	}

	/**
	 * Insert a deck, splitting any existing decks that overlap
	 */
	insertDeck(newDeck) {
		newDeck.holeID = this.holeID;
		var toRemove = [];
		var toAdd = [newDeck];
		var newMin = Math.min(newDeck.topDepth, newDeck.baseDepth);
		var newMax = Math.max(newDeck.topDepth, newDeck.baseDepth);

		for (var i = 0; i < this.decks.length; i++) {
			var existing = this.decks[i];
			var exMin = Math.min(existing.topDepth, existing.baseDepth);
			var exMax = Math.max(existing.topDepth, existing.baseDepth);

			if (newMin < exMax && newMax > exMin) {
				toRemove.push(existing);

				// Top portion of split deck
				if (exMin < newMin) {
					toAdd.push(new Deck({
						holeID: this.holeID,
						deckType: existing.deckType,
						topDepth: exMin,
						baseDepth: newMin,
						product: existing.product ? Object.assign({}, existing.product) : null
					}));
				}
				// Bottom portion of split deck
				if (exMax > newMax) {
					toAdd.push(new Deck({
						holeID: this.holeID,
						deckType: existing.deckType,
						topDepth: newMax,
						baseDepth: exMax,
						product: existing.product ? Object.assign({}, existing.product) : null
					}));
				}
			}
		}

		this.decks = this.decks.filter(function(d) { return toRemove.indexOf(d) === -1; });
		for (var j = 0; j < toAdd.length; j++) {
			this.decks.push(toAdd[j]);
		}
		this.sortDecks();
		this.modified = new Date().toISOString();
		return { success: true };
	}

	// ============ PRIMERS ============

	addPrimer(primer) {
		primer.holeID = this.holeID;
		var val = primer.validate(this.decks);
		if (!val.valid) return val;

		primer.deckID = val.assignedDeck ? val.assignedDeck.deckID : null;
		this.primers.push(primer);
		this.modified = new Date().toISOString();
		return { success: true, errors: [], warnings: val.warnings, assignedDeck: val.assignedDeck };
	}

	// ============ QUERIES ============

	getDeckAtDepth(depth) {
		for (var i = 0; i < this.decks.length; i++) {
			if (this.decks[i].containsDepth(depth)) return this.decks[i];
		}
		return null;
	}

	getExplosiveDecks() {
		return this.decks.filter(function(d) {
			return d.deckType === DECK_TYPES.COUPLED || d.deckType === DECK_TYPES.DECOUPLED;
		});
	}

	getTotalExplosiveMass() {
		var total = 0;
		var self = this;
		for (var i = 0; i < this.decks.length; i++) {
			var deck = this.decks[i];
			if (deck.deckType === DECK_TYPES.COUPLED) {
				total += deck.calculateMass(self.holeDiameterMm);
			} else if (deck.deckType === DECK_TYPES.DECOUPLED) {
				var contentMass = 0;
				if (deck.contains && deck.contains.length > 0) {
					for (var j = 0; j < deck.contains.length; j++) {
						var c = deck.contains[j];
						if (c.contentCategory === "Physical") {
							var mass = c.calculateMass ? c.calculateMass() : 0;
							if (mass) contentMass += mass;
						}
					}
				}
				if (contentMass === 0) {
					contentMass = deck.calculateMass(self.holeDiameterMm);
				}
				total += contentMass;
			}
		}
		for (var k = 0; k < this.primers.length; k++) {
			total += (this.primers[k].totalBoosterMassGrams || 0) / 1000;
		}
		return total;
	}

	calculatePowderFactor(burden, spacing) {
		var mass = this.getTotalExplosiveMass();
		var volume = burden * spacing * Math.abs(this.holeLength);
		return volume > 0 ? mass / volume : 0;
	}

	// ============ VALIDATION ============

	validate() {
		var errors = [], warnings = [];

		if (!this.holeDiameterMm || this.holeLength === 0) {
			warnings.push(VALIDATION_MESSAGES.NO_DIAMETER_OR_LENGTH);
		}
		if (this.decks.length === 0) {
			errors.push(VALIDATION_MESSAGES.NO_DECKS);
		}

		this.sortDecks();
		for (var i = 0; i < this.decks.length - 1; i++) {
			var gap = Math.abs(this.decks[i + 1].topDepth - this.decks[i].baseDepth);
			if (gap > 0.001) {
				warnings.push(VALIDATION_MESSAGES.DECK_GAP + " Gap: " + gap.toFixed(3) + "m");
			}
		}

		for (var j = 0; j < this.decks.length; j++) {
			var dv = this.decks[j].validate();
			errors = errors.concat(dv.errors);
			warnings = warnings.concat(dv.warnings);
		}

		for (var k = 0; k < this.primers.length; k++) {
			var pv = this.primers[k].validate(this.decks);
			errors = errors.concat(pv.errors);
			warnings = warnings.concat(pv.warnings);
		}

		return { valid: errors.length === 0, errors: errors, warnings: warnings };
	}

	// ============ DIMENSION MISMATCH ============

	/**
	 * Check if hole dimensions have changed since charging was created.
	 * @param {Object} hole - Current blast hole object
	 * @returns {{ lengthChanged: boolean, diameterChanged: boolean, oldLength: number, newLength: number, oldDiameter: number, newDiameter: number }}
	 */
	checkDimensionMismatch(hole) {
		var currentLength = hole.holeLengthCalculated || hole.measuredLength || 0;
		var currentDiameter = hole.holeDiameter || 0;
		var lengthDelta = Math.abs(currentLength - this.holeLength);
		var diameterDelta = Math.abs(currentDiameter - this.holeDiameterMm);

		return {
			lengthChanged: lengthDelta > 0.01,
			diameterChanged: diameterDelta > 0.1,
			oldLength: this.holeLength,
			newLength: currentLength,
			oldDiameter: this.holeDiameterMm,
			newDiameter: currentDiameter
		};
	}

	/**
	 * Update cached dimensions and proportionally rescale deck depths when length changes.
	 * @param {Object} hole - Current blast hole object
	 * @returns {{ lengthRescaled: boolean, diameterUpdated: boolean }}
	 */
	updateDimensions(hole) {
		var currentLength = hole.holeLengthCalculated || hole.measuredLength || 0;
		var currentDiameter = hole.holeDiameter || 0;
		var result = { lengthRescaled: false, diameterUpdated: false };

		// Rescale deck depths proportionally if length changed
		if (this.holeLength !== 0 && Math.abs(currentLength - this.holeLength) > 0.01) {
			var ratio = currentLength / this.holeLength;
			for (var i = 0; i < this.decks.length; i++) {
				this.decks[i].topDepth = this.decks[i].topDepth * ratio;
				this.decks[i].baseDepth = this.decks[i].baseDepth * ratio;
			}
			// Rescale primer depths too
			for (var j = 0; j < this.primers.length; j++) {
				if (this.primers[j].depth != null) {
					this.primers[j].depth = this.primers[j].depth * ratio;
				}
			}
			this.holeLength = currentLength;
			result.lengthRescaled = true;
		} else if (this.holeLength === 0 && currentLength !== 0) {
			this.holeLength = currentLength;
			result.lengthRescaled = true;
		}

		// Update diameter (no rescale needed, but flag it)
		if (Math.abs(currentDiameter - this.holeDiameterMm) > 0.1) {
			this.holeDiameterMm = currentDiameter;
			result.diameterUpdated = true;
		}

		if (result.lengthRescaled || result.diameterUpdated) {
			this.modified = new Date().toISOString();
		}

		return result;
	}

	clear() {
		this.decks = [];
		this.primers = [];
		this.initializeDefaultDeck();
	}

	toJSON() {
		return {
			holeID: this.holeID,
			entityName: this.entityName,
			holeDiameterMm: this.holeDiameterMm,
			holeLength: this.holeLength,
			autoRecalculate: this.autoRecalculate,
			decks: this.decks.map(function(d) { return d.toJSON(); }),
			primers: this.primers.map(function(p) { return p.toJSON(); }),
			created: this.created,
			modified: this.modified
		};
	}

	static fromJSON(obj, hole) {
		var hc = new HoleCharging(hole || {
			holeID: obj.holeID,
			entityName: obj.entityName,
			holeDiameter: obj.holeDiameterMm,
			holeLengthCalculated: obj.holeLength,
			autoRecalculate: obj.autoRecalculate
		});
		hc.autoRecalculate = obj.autoRecalculate !== undefined ? obj.autoRecalculate : true;
		hc.decks = [];
		hc.primers = [];
		if (obj.decks) {
			hc.decks = obj.decks.map(function(d) { return Deck.fromJSON(d); });
		}
		if (obj.primers) {
			hc.primers = obj.primers.map(function(p) { return Primer.fromJSON(p); });
		}
		hc.created = obj.created || hc.created;
		hc.modified = obj.modified || hc.modified;
		return hc;
	}
}
