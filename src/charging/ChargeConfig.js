/**
 * @fileoverview ChargeConfig - Template-only rule for auto-generating charge profiles
 *
 * All charge rules are expressed as deck arrays + primer arrays.
 * No hardcoded rule dispatch — the rule engine applies templates directly.
 *
 * Deck array entries:
 *   { idx, type, product, lengthMode, length, formula, massKg,
 *     isFixedLength, isFixedMass, isProportionalDeck, overlapPattern }
 *
 * Primer array entries:
 *   { depth (number or "fx:" formula), detonator, booster }
 */

import { generateUUID } from "./Deck.js";
import { CHARGE_CONFIG_CODES, CHARGING_DEFAULTS } from "./ChargingConstants.js";

export class ChargeConfig {
	constructor(options) {
		this.configID = options.configID || generateUUID();
		this.configCode = options.configCode || CHARGE_CONFIG_CODES.CUSTOM;
		this.configName = options.configName || "Unnamed Config";
		this.description = options.description || "";

		// Primer spacing interval (metres between primers in long charge columns)
		this.primerInterval = options.primerInterval || CHARGING_DEFAULTS.primerInterval;

		// Short hole logic
		this.shortHoleLogic = options.shortHoleLogic !== false;
		this.shortHoleLength = options.shortHoleLength || CHARGING_DEFAULTS.shortHoleLength;

		// Wet hole product swap (future)
		this.wetHoleSwap = options.wetHoleSwap || false;
		this.wetHoleProduct = options.wetHoleProduct || null;

		// Typed deck arrays — merged at apply-time sorted by idx
		this.inertDeckArray = options.inertDeckArray || [];
		this.coupledDeckArray = options.coupledDeckArray || [];
		this.decoupledDeckArray = options.decoupledDeckArray || [];
		this.spacerDeckArray = options.spacerDeckArray || [];

		// Primer template array
		// Each: { depth: number|"fx:formula", detonator: productName, booster: productName }
		this.primerArray = options.primerArray || [];

		this.created = options.created || new Date().toISOString();
		this.modified = new Date().toISOString();
	}

	/**
	 * Merge all deck arrays into a single sorted sequence by idx.
	 * @returns {Array} Sorted deck template entries
	 */
	getMergedDeckSequence() {
		var all = [].concat(
			this.inertDeckArray,
			this.coupledDeckArray,
			this.decoupledDeckArray,
			this.spacerDeckArray
		);
		all.sort(function(a, b) { return (a.idx || 0) - (b.idx || 0); });
		return all;
	}

	toJSON() {
		return {
			configID: this.configID,
			configCode: this.configCode,
			configName: this.configName,
			description: this.description,
			primerInterval: this.primerInterval,
			shortHoleLogic: this.shortHoleLogic,
			shortHoleLength: this.shortHoleLength,
			wetHoleSwap: this.wetHoleSwap,
			wetHoleProduct: this.wetHoleProduct,
			inertDeckArray: this.inertDeckArray,
			coupledDeckArray: this.coupledDeckArray,
			decoupledDeckArray: this.decoupledDeckArray,
			spacerDeckArray: this.spacerDeckArray,
			primerArray: this.primerArray,
			created: this.created,
			modified: this.modified
		};
	}

	static fromJSON(obj) {
		return new ChargeConfig(obj);
	}
}
