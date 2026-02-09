/**
 * @fileoverview Primer Class - Detonator + Booster combination
 * Can be placed in INERT, COUPLED, DECOUPLED (NOT SPACER)
 */

import { generateUUID } from "./Deck.js";
import { DECK_TYPES, VALIDATION_MESSAGES } from "./ChargingConstants.js";

export class Primer {
	constructor(options) {
		this.primerID = options.primerID || generateUUID();
		this.holeID = options.holeID;
		this.lengthFromCollar = options.lengthFromCollar;

		this.detonator = {
			productID: options.detonator?.productID || null,
			productName: options.detonator?.productName || null,
			initiatorType: options.detonator?.initiatorType || null, // Electronic, ShockTube, Electric, DetonatingCord
			deliveryVodMs: options.detonator?.deliveryVodMs != null ? options.detonator.deliveryVodMs : 0,  // m/s (0 = instant)
			delayMs: options.detonator?.delayMs || 0,               // programmed or series delay
			quantity: options.detonator?.quantity || 1,              // number of detonators (e.g. 2 for Twinplex)
			serialNumber: options.detonator?.serialNumber || null
		};

		this.booster = {
			productID: options.booster?.productID || null,
			productName: options.booster?.productName || null,
			quantity: options.booster?.quantity || 1,
			massGrams: options.booster?.massGrams || null
		};

		this.deckID = options.deckID || null;  // Which deck this primer sits in
		this.created = options.created || new Date().toISOString();
		this.modified = new Date().toISOString();
	}

	/**
	 * Total downhole delay for this primer in milliseconds
	 * This is the INTRA-HOLE delay only.
	 * Full initiation time = hole.holeTime + this.totalDownholeDelayMs
	 */
	get totalDownholeDelayMs() {
		var vod = this.detonator.deliveryVodMs || 0;
		var burnRateMs = (vod === 0) ? 0 : 1000 / vod;  // 0 VOD = instant, no burn time
		var burn = burnRateMs * (this.lengthFromCollar || 0);
		return (this.detonator.delayMs || 0) + burn;
	}

	get totalBoosterMassGrams() {
		return (this.booster.massGrams || 0) * (this.booster.quantity || 1);
	}

	validate(decks) {
		var errors = [], warnings = [];
		var assignedDeck = null;

		for (var i = 0; i < decks.length; i++) {
			if (decks[i].containsDepth(this.lengthFromCollar)) {
				assignedDeck = decks[i];
				break;
			}
		}

		if (!assignedDeck) {
			errors.push(VALIDATION_MESSAGES.PRIMER_OUTSIDE_DECKS + " (depth: " + this.lengthFromCollar + "m)");
		} else if (assignedDeck.deckType === DECK_TYPES.SPACER) {
			errors.push(VALIDATION_MESSAGES.PRIMER_IN_SPACER);
		}

		if (!this.detonator.productID && !this.detonator.productName) {
			warnings.push(VALIDATION_MESSAGES.NO_DETONATOR);
		}
		if (!this.booster.productID && !this.booster.productName) {
			warnings.push(VALIDATION_MESSAGES.NO_BOOSTER);
		}

		return { valid: errors.length === 0, errors: errors, warnings: warnings, assignedDeck: assignedDeck };
	}

	toJSON() {
		return {
			primerID: this.primerID,
			holeID: this.holeID,
			lengthFromCollar: this.lengthFromCollar,
			detonator: Object.assign({}, this.detonator),
			booster: Object.assign({}, this.booster),
			deckID: this.deckID,
			created: this.created,
			modified: this.modified
		};
	}

	static fromJSON(obj) {
		return new Primer(obj);
	}
}
