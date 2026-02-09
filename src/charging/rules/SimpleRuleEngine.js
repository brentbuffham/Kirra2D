/**
 * @fileoverview SimpleRuleEngine - Applies ChargeConfig templates to holes
 *
 * Each rule template is a function: (hole, config, products) -> HoleCharging
 * Templates: SIMPLE_SINGLE, STNDVS, STNDFS, AIRDEC, PRESPL, NOCHG
 */

import { HoleCharging } from "../HoleCharging.js";
import { Deck } from "../Deck.js";
import { Primer } from "../Primer.js";
import { DECK_TYPES, CHARGE_CONFIG_CODES } from "../ChargingConstants.js";

/**
 * Find a product by name from the loaded products Map
 * @param {string} nameOrID - Product name or ID
 * @returns {Object|null} Product object
 */
function findProduct(nameOrID) {
	if (!nameOrID || !window.loadedProducts) return null;
	var found = null;
	window.loadedProducts.forEach(function(p) {
		if (p.name === nameOrID || p.productID === nameOrID) {
			found = p;
		}
	});
	return found;
}

/**
 * Build a product snapshot from a full product object
 */
function snap(product) {
	if (!product) return null;
	return {
		productID: product.productID || null,
		name: product.name,
		productType: product.productType || null,
		productCategory: product.productCategory,
		density: product.density || 0,
		colorHex: product.colorHex || null
	};
}

/**
 * Apply a charge rule to a hole based on its ChargeConfig
 * @param {Object} hole - Blast hole from allBlastHoles
 * @param {Object} config - ChargeConfig instance
 * @returns {HoleCharging|null} New HoleCharging or null on failure
 */
export function applyChargeRule(hole, config) {
	if (!hole || !config) return null;

	var code = config.configCode || CHARGE_CONFIG_CODES.SIMPLE_SINGLE;

	switch (code) {
		case CHARGE_CONFIG_CODES.SIMPLE_SINGLE:
			return applySimpleSingle(hole, config);
		case CHARGE_CONFIG_CODES.STANDARD_VENTED:
			return applyStandardVented(hole, config);
		case CHARGE_CONFIG_CODES.STANDARD_FIXED_STEM:
			return applyStandardFixedStem(hole, config);
		case CHARGE_CONFIG_CODES.AIR_DECK:
			return applyAirDeck(hole, config);
		case CHARGE_CONFIG_CODES.PRESPLIT:
			return applyPresplit(hole, config);
		case CHARGE_CONFIG_CODES.NO_CHARGE:
			return applyNoCharge(hole, config);
		default:
			return applySimpleSingle(hole, config);
	}
}

// ============================================================
// SIMPLE_SINGLE: Stemming + Charge + 1 Primer
// ============================================================

function applySimpleSingle(hole, config) {
	var hc = new HoleCharging(hole);
	hc.clear();
	hc.decks = [];

	var holeLen = Math.abs(hc.holeLength);
	if (holeLen <= 0) return hc;

	var stemProduct = findProduct(config.stemmingProduct);
	var chargeProduct = findProduct(config.chargeProduct);
	var boosterProduct = findProduct(config.boosterProduct);
	var detProduct = findProduct(config.detonatorProduct);

	// Stemming from collar
	var stemLen = Math.min(config.preferredStemLength || 3.5, holeLen * 0.5);
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.INERT,
		topDepth: 0,
		baseDepth: stemLen,
		product: snap(stemProduct) || { name: "Stemming", density: 2.1 }
	}));

	// Charge from stem to toe
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.COUPLED,
		topDepth: stemLen,
		baseDepth: holeLen,
		product: snap(chargeProduct) || { name: "Explosive", density: 0.85 }
	}));

	// Primer at configured depth or 90% of hole length
	var primerDepth = config.primerDepthFromCollar || holeLen * 0.9;
	primerDepth = Math.min(primerDepth, holeLen - 0.1);

	hc.addPrimer(new Primer({
		holeID: hc.holeID,
		lengthFromCollar: primerDepth,
		detonator: {
			productID: detProduct ? detProduct.productID : null,
			productName: detProduct ? detProduct.name : null,
			initiatorType: detProduct ? (detProduct.initiatorType || detProduct.productType) : null,
			deliveryVodMs: detProduct ? (detProduct.deliveryVodMs || 0) : 0,
			delayMs: 0
		},
		booster: {
			productID: boosterProduct ? boosterProduct.productID : null,
			productName: boosterProduct ? boosterProduct.name : null,
			quantity: 1,
			massGrams: boosterProduct ? boosterProduct.massGrams : null
		}
	}));

	hc.sortDecks();
	return hc;
}

// ============================================================
// STNDVS: Standard Vented Stemming (Stem + Charge + Air top)
// ============================================================

function applyStandardVented(hole, config) {
	var hc = new HoleCharging(hole);
	hc.clear();
	hc.decks = [];

	var holeLen = Math.abs(hc.holeLength);
	if (holeLen <= 0) return hc;

	var stemProduct = findProduct(config.stemmingProduct);
	var chargeProduct = findProduct(config.chargeProduct);
	var boosterProduct = findProduct(config.boosterProduct);
	var detProduct = findProduct(config.detonatorProduct);

	var stemLen = Math.min(config.preferredStemLength || 3.5, holeLen * 0.4);
	var chargeLen = config.preferredChargeLength || (holeLen - stemLen);
	chargeLen = Math.min(chargeLen, holeLen - stemLen);

	// Air at top (vented)
	var airLen = holeLen - stemLen - chargeLen;
	if (airLen > 0.1) {
		hc.decks.push(new Deck({
			holeID: hc.holeID,
			deckType: DECK_TYPES.INERT,
			topDepth: 0,
			baseDepth: airLen,
			product: { name: "Air", density: 0.0012 }
		}));
	}

	// Stemming
	var stemTop = airLen > 0.1 ? airLen : 0;
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.INERT,
		topDepth: stemTop,
		baseDepth: stemTop + stemLen,
		product: snap(stemProduct) || { name: "Stemming", density: 2.1 }
	}));

	// Charge to toe
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.COUPLED,
		topDepth: stemTop + stemLen,
		baseDepth: holeLen,
		product: snap(chargeProduct) || { name: "Explosive", density: 0.85 }
	}));

	// Primer near toe
	var primerDepth = holeLen * 0.9;
	hc.addPrimer(new Primer({
		holeID: hc.holeID,
		lengthFromCollar: primerDepth,
		detonator: {
			productID: detProduct ? detProduct.productID : null,
			productName: detProduct ? detProduct.name : null,
			initiatorType: detProduct ? (detProduct.initiatorType || detProduct.productType) : null,
			deliveryVodMs: detProduct ? (detProduct.deliveryVodMs || 0) : 0,
			delayMs: 0
		},
		booster: {
			productID: boosterProduct ? boosterProduct.productID : null,
			productName: boosterProduct ? boosterProduct.name : null,
			quantity: 1,
			massGrams: boosterProduct ? boosterProduct.massGrams : null
		}
	}));

	hc.sortDecks();
	return hc;
}

// ============================================================
// STNDFS: Standard Fixed Stemming (Fixed stem, fill rest)
// ============================================================

function applyStandardFixedStem(hole, config) {
	var hc = new HoleCharging(hole);
	hc.clear();
	hc.decks = [];

	var holeLen = Math.abs(hc.holeLength);
	if (holeLen <= 0) return hc;

	var stemProduct = findProduct(config.stemmingProduct);
	var chargeProduct = findProduct(config.chargeProduct);
	var boosterProduct = findProduct(config.boosterProduct);
	var detProduct = findProduct(config.detonatorProduct);

	var stemLen = config.preferredStemLength || 3.5;
	stemLen = Math.min(stemLen, holeLen - (config.minChargeLength || 2.0));

	var chargeLen = holeLen - stemLen;
	var chargeBase = holeLen;

	// Apply chargeRatio if set (e.g. 0.5 = 50% charge, rest becomes top stemming)
	if (config.chargeRatio != null && config.chargeRatio > 0 && config.chargeRatio < 1) {
		chargeLen = holeLen * config.chargeRatio;
		chargeLen = Math.max(chargeLen, config.minChargeLength || 2.0);
		stemLen = holeLen - chargeLen;
	}

	// Apply mass-based charging if configured
	if (config.useMassOverLength && config.targetChargeMassKg > 0) {
		var chargeDensity = chargeProduct ? (chargeProduct.density || 0.85) : 0.85;
		var holeDiameterM = (hole.holeDiameter || 115) / 1000;
		var holeRadiusM = holeDiameterM / 2;
		var crossSectionArea = Math.PI * holeRadiusM * holeRadiusM; // m^2
		var kgPerMetre = chargeDensity * 1000 * crossSectionArea; // density g/cc -> kg/m^3, times area = kg/m

		if (kgPerMetre > 0) {
			chargeLen = config.targetChargeMassKg / kgPerMetre;
			chargeLen = Math.max(chargeLen, config.minChargeLength || 1.0);
			chargeLen = Math.min(chargeLen, holeLen - (config.minStemLength || 2.0));
			stemLen = holeLen - chargeLen;
		}
	}

	// Charge sits at bottom, stemming at top
	var chargeTop = stemLen;
	chargeBase = holeLen;

	// Stemming from collar
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.INERT,
		topDepth: 0,
		baseDepth: stemLen,
		product: snap(stemProduct) || { name: "Stemming", density: 2.1 }
	}));

	// Charge deck
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.COUPLED,
		topDepth: chargeTop,
		baseDepth: chargeBase,
		product: snap(chargeProduct) || { name: "Explosive", density: 0.85 }
	}));

	// Place primers at intervals within charge column
	var interval = config.primerInterval || 8.0;
	var maxPrimers = config.maxPrimersPerDeck || 3;
	var actualChargeLen = chargeBase - chargeTop;

	var primerCount = Math.max(1, Math.min(maxPrimers, Math.ceil(actualChargeLen / interval)));
	for (var p = 0; p < primerCount; p++) {
		var depth;
		if (primerCount === 1) {
			depth = chargeBase - actualChargeLen * 0.1;
		} else {
			// Distribute evenly within charge column
			depth = chargeTop + (actualChargeLen * (p + 1)) / (primerCount + 1) + actualChargeLen * 0.1;
			depth = Math.min(depth, chargeBase - 0.1);
		}

		hc.addPrimer(new Primer({
			holeID: hc.holeID,
			lengthFromCollar: parseFloat(depth.toFixed(2)),
			detonator: {
				productID: detProduct ? detProduct.productID : null,
				productName: detProduct ? detProduct.name : null,
				initiatorType: detProduct ? (detProduct.initiatorType || detProduct.productType) : null,
				deliveryVodMs: detProduct ? (detProduct.deliveryVodMs || 0) : 0,
				delayMs: 0
			},
			booster: {
				productID: boosterProduct ? boosterProduct.productID : null,
				productName: boosterProduct ? boosterProduct.name : null,
				quantity: 1,
				massGrams: boosterProduct ? boosterProduct.massGrams : null
			}
		}));
	}

	hc.sortDecks();
	return hc;
}

// ============================================================
// AIRDEC: Air Deck (Stem + Charge + Air Gap + Charge)
// ============================================================

function applyAirDeck(hole, config) {
	var hc = new HoleCharging(hole);
	hc.clear();
	hc.decks = [];

	var holeLen = Math.abs(hc.holeLength);
	if (holeLen <= 0) return hc;

	var stemProduct = findProduct(config.stemmingProduct);
	var chargeProduct = findProduct(config.chargeProduct);
	var gasBagProduct = findProduct(config.gasBagProduct);
	var boosterProduct = findProduct(config.boosterProduct);
	var detProduct = findProduct(config.detonatorProduct);

	var stemLen = Math.min(config.preferredStemLength || 3.5, holeLen * 0.3);
	var airDeckLen = config.airDeckLength || 1.0;
	var chargeLen = (holeLen - stemLen - airDeckLen) / 2;
	chargeLen = Math.max(chargeLen, config.minChargeLength || 2.0);

	var topChargeBase = stemLen + chargeLen;
	var airTop = topChargeBase;
	var airBase = airTop + airDeckLen;
	var bottomChargeTop = airBase;

	// Ensure we don't exceed hole length
	if (bottomChargeTop + chargeLen > holeLen) {
		chargeLen = holeLen - bottomChargeTop;
	}

	// Stemming
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.INERT,
		topDepth: 0,
		baseDepth: stemLen,
		product: snap(stemProduct) || { name: "Stemming", density: 2.1 }
	}));

	// Top charge
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.COUPLED,
		topDepth: stemLen,
		baseDepth: topChargeBase,
		product: snap(chargeProduct) || { name: "Explosive", density: 0.85 }
	}));

	// Air deck (gas bag or air)
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: gasBagProduct ? DECK_TYPES.SPACER : DECK_TYPES.INERT,
		topDepth: airTop,
		baseDepth: airBase,
		product: snap(gasBagProduct) || { name: "Air", density: 0.0012 }
	}));

	// Bottom charge
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.COUPLED,
		topDepth: bottomChargeTop,
		baseDepth: holeLen,
		product: snap(chargeProduct) || { name: "Explosive", density: 0.85 }
	}));

	// Primer in bottom charge
	var primerDepth = holeLen * 0.9;
	hc.addPrimer(new Primer({
		holeID: hc.holeID,
		lengthFromCollar: primerDepth,
		detonator: {
			productID: detProduct ? detProduct.productID : null,
			productName: detProduct ? detProduct.name : null,
			initiatorType: detProduct ? (detProduct.initiatorType || detProduct.productType) : null,
			deliveryVodMs: detProduct ? (detProduct.deliveryVodMs || 0) : 0,
			delayMs: 0
		},
		booster: {
			productID: boosterProduct ? boosterProduct.productID : null,
			productName: boosterProduct ? boosterProduct.name : null,
			quantity: 1,
			massGrams: boosterProduct ? boosterProduct.massGrams : null
		}
	}));

	hc.sortDecks();
	return hc;
}

// ============================================================
// PRESPL: Presplit (Packaged products, decoupled)
// ============================================================

function applyPresplit(hole, config) {
	var hc = new HoleCharging(hole);
	hc.clear();
	hc.decks = [];

	var holeLen = Math.abs(hc.holeLength);
	if (holeLen <= 0) return hc;

	var stemProduct = findProduct(config.stemmingProduct);
	var chargeProduct = findProduct(config.chargeProduct);
	var detProduct = findProduct(config.detonatorProduct);

	var stemLen = Math.min(config.preferredStemLength || 3.5, holeLen * 0.4);

	// Stemming
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.INERT,
		topDepth: 0,
		baseDepth: stemLen,
		product: snap(stemProduct) || { name: "Stemming", density: 2.1 }
	}));

	// Decoupled charge (packaged explosive)
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.DECOUPLED,
		topDepth: stemLen,
		baseDepth: holeLen,
		product: snap(chargeProduct) || { name: "Packaged Explosive", density: 1.15 },
		contains: []
	}));

	// Primer near toe
	hc.addPrimer(new Primer({
		holeID: hc.holeID,
		lengthFromCollar: holeLen * 0.9,
		detonator: {
			productID: detProduct ? detProduct.productID : null,
			productName: detProduct ? detProduct.name : null,
			initiatorType: detProduct ? (detProduct.initiatorType || detProduct.productType) : null,
			deliveryVodMs: detProduct ? (detProduct.deliveryVodMs || 0) : 0,
			delayMs: 0
		},
		booster: { productName: null, quantity: 1 }
	}));

	hc.sortDecks();
	return hc;
}

// ============================================================
// NOCHG: No Charge (full hole is Air/Inert)
// ============================================================

function applyNoCharge(hole, config) {
	var hc = new HoleCharging(hole);
	// Already initialized with default Air deck
	return hc;
}
