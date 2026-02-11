/**
 * @fileoverview ChargeConfig - Rule template for auto-generating charge profiles
 * Defined in Week 1 so products, decks, and rules share the same vocabulary.
 * Rule engine implementation comes in Week 4.
 */

import { generateUUID } from "./Deck.js";
import { CHARGE_CONFIG_CODES, CHARGING_DEFAULTS } from "./ChargingConstants.js";

export class ChargeConfig {
	constructor(options) {
		this.configID = options.configID || generateUUID();
		this.configCode = options.configCode || CHARGE_CONFIG_CODES.SIMPLE_SINGLE;
		this.configName = options.configName || "Unnamed Config";
		this.description = options.description || "";

		// Product references (productID or name)
		this.stemmingProduct = options.stemmingProduct || null;
		this.chargeProduct = options.chargeProduct || null;
		this.wetChargeProduct = options.wetChargeProduct || null;
		this.dampChargeProduct = options.dampChargeProduct || null;
		this.boosterProduct = options.boosterProduct || null;
		this.detonatorProduct = options.detonatorProduct || null;
		this.gasBagProduct = options.gasBagProduct || null;

		// Stemming parameters
		this.preferredStemLength = options.preferredStemLength || CHARGING_DEFAULTS.preferredStemLength;
		this.minStemLength = options.minStemLength || CHARGING_DEFAULTS.minStemLength;

		// Charge parameters
		this.preferredChargeLength = options.preferredChargeLength || CHARGING_DEFAULTS.preferredChargeLength;
		this.minChargeLength = options.minChargeLength || CHARGING_DEFAULTS.minChargeLength;
		this.useMassOverLength = options.useMassOverLength || false;
		this.targetChargeMassKg = options.targetChargeMassKg || null;

		// Primer parameters
		this.primerInterval = options.primerInterval || CHARGING_DEFAULTS.primerInterval;
		this.primerOffsetFromToe = options.primerOffsetFromToe || CHARGING_DEFAULTS.bottomOffsetRatio;
		this.maxPrimersPerDeck = options.maxPrimersPerDeck || CHARGING_DEFAULTS.maxPrimersPerDeck;
		this.primerDepthFromCollar = options.primerDepthFromCollar || null; // For simple rules

		// Moisture handling
		this.wetTolerance = options.wetTolerance || CHARGING_DEFAULTS.wetTolerance;
		this.dampTolerance = options.dampTolerance || CHARGING_DEFAULTS.dampTolerance;

		// Short hole
		this.shortHoleLength = options.shortHoleLength || CHARGING_DEFAULTS.shortHoleLength;
		this.applyShortHoleLogic = options.applyShortHoleLogic !== false; // default true

		// Charge ratio (0.0 to 1.0): fraction of available hole used for charge
		// e.g. 0.5 = 50% charge, remaining = stemming
		this.chargeRatio = options.chargeRatio != null ? options.chargeRatio : null;

		// Air deck
		this.airDeckLength = options.airDeckLength || null;

		// Multi-deck template: array of { type, product, lengthMode, length, formula, massKg }
		// lengthMode: "fixed" = exact meters, "fill" = absorb remaining,
		//             "formula" = fx:expression, "mass" = kg-based, "product" = spacer (from product.lengthMm)
		this.deckTemplate = options.deckTemplate || null;

		// Multi-primer template: array of { depth, detonator, booster }
		// depth: number (metres) or formula string "fx:chargeBase-0.3"
		// Replaces single primerDepthFromCollar for configs with multiple primers
		this.primerTemplate = options.primerTemplate || [];

		this.created = options.created || new Date().toISOString();
		this.modified = new Date().toISOString();
	}

	toJSON() {
		var result = {};
		var keys = Object.keys(this);
		for (var i = 0; i < keys.length; i++) {
			result[keys[i]] = this[keys[i]];
		}
		return result;
	}

	static fromJSON(obj) {
		return new ChargeConfig(obj);
	}
}
