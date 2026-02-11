/**
 * @fileoverview SimpleRuleEngine - Applies ChargeConfig templates to holes
 *
 * Each rule template is a function: (hole, config, products) -> HoleCharging
 * Templates: SIMPLE_SINGLE, STNDVS, STNDFS, AIRDEC, PRESPL, NOCHG
 */

import { HoleCharging } from "../HoleCharging.js";
import { Deck } from "../Deck.js";
import { Primer } from "../Primer.js";
import { DECK_TYPES, CHARGE_CONFIG_CODES, SHORT_HOLE_TIERS, CHARGING_DEFAULTS } from "../ChargingConstants.js";
import { isFormula, evaluateFormula } from "../../helpers/FormulaEvaluator.js";

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
		colorHex: product.colorHex || null,
		diameterMm: product.diameterMm || null,
		lengthMm: product.lengthMm || null,
		massGrams: product.massGrams || null
	};
}

/**
 * Look up the SHORT_HOLE_TIERS entry for a given hole length.
 * Returns the tier object if the hole is short enough, or null for normal-length holes.
 * @param {number} holeLength - Hole length in metres
 * @returns {Object|null} Tier with chargeRatio or fixedMassKg, or null
 */
function getShortHoleTier(holeLength) {
	// Only apply short-hole tiers below the shortHoleLength threshold
	if (holeLength >= (CHARGING_DEFAULTS.shortHoleLength || 4.0)) {
		return null;
	}
	for (var i = 0; i < SHORT_HOLE_TIERS.length; i++) {
		var tier = SHORT_HOLE_TIERS[i];
		if (holeLength >= tier.minLength && holeLength < tier.maxLength) {
			return tier;
		}
	}
	return null;
}

/**
 * Build indexed charge variables from laid-out decks for primer formula context.
 * Counts COUPLED/DECOUPLED decks top-to-bottom with 1-based index.
 * Sets ctx.chargeBase_1, ctx.chargeTop_1, ctx.chargeLength_1, etc.
 * Also sets unindexed chargeBase/chargeTop/chargeLength to the deepest charge deck (backward compat).
 * Sets ctx.stemLength to the topDepth of the first charge deck.
 * @param {Array} decks - Array of Deck objects (sorted top-to-bottom)
 * @param {Object} ctx - Formula context object to populate
 */
function buildIndexedChargeVars(decks, ctx) {
	var chargeIndex = 0;
	var deepestBase = 0;
	var deepestTop = 0;
	var deepestLen = 0;
	var firstChargeTop = null;

	for (var i = 0; i < decks.length; i++) {
		var d = decks[i];
		var dt = d.deckType;
		if (dt === DECK_TYPES.COUPLED || dt === DECK_TYPES.DECOUPLED) {
			chargeIndex++;
			var cTop = d.topDepth;
			var cBase = d.baseDepth;
			var cLen = cBase - cTop;

			ctx["chargeBase_" + chargeIndex] = cBase;
			ctx["chargeTop_" + chargeIndex] = cTop;
			ctx["chargeLength_" + chargeIndex] = cLen;

			// Track deepest for unindexed vars
			if (cBase >= deepestBase) {
				deepestBase = cBase;
				deepestTop = cTop;
				deepestLen = cLen;
			}
			if (firstChargeTop === null) {
				firstChargeTop = cTop;
			}
		}
	}

	// Unindexed = deepest charge deck (backward compat)
	ctx.chargeBase = deepestBase;
	ctx.chargeTop = deepestTop;
	ctx.chargeLength = deepestLen;
	ctx.stemLength = firstChargeTop !== null ? firstChargeTop : 0;
}

/**
 * Apply short-hole tier overrides to charge/stem lengths.
 * If the tier has chargeRatio 0, returns null (signals NO_CHARGE).
 * If the tier has chargeRatio, overrides charge length.
 * If the tier has fixedMassKg, calculates charge length from mass and density.
 * @param {number} holeLen - Total hole length
 * @param {number} stemLen - Current stem length
 * @param {number} chargeLen - Current charge length
 * @param {Object} tier - SHORT_HOLE_TIERS entry
 * @param {Object} [chargeProduct] - Charge product (for density)
 * @param {number} holeDiameterMm - Hole diameter in mm
 * @returns {{ stemLen: number, chargeLen: number }|null} Adjusted values or null for NO_CHARGE
 */
function applyShortHoleTier(holeLen, stemLen, chargeLen, tier, chargeProduct, holeDiameterMm) {
	if (tier.chargeRatio === 0) {
		return null; // NO_CHARGE
	}

	if (tier.chargeRatio != null) {
		chargeLen = holeLen * tier.chargeRatio;
		stemLen = holeLen - chargeLen;
	} else if (tier.fixedMassKg != null && tier.fixedMassKg > 0) {
		var density = chargeProduct ? (chargeProduct.density || 0.85) : 0.85;
		var diamM = (holeDiameterMm || 115) / 1000;
		var radiusM = diamM / 2;
		var area = Math.PI * radiusM * radiusM;
		var kgPerMetre = density * 1000 * area;
		if (kgPerMetre > 0) {
			chargeLen = tier.fixedMassKg / kgPerMetre;
			chargeLen = Math.min(chargeLen, holeLen * 0.8); // Never exceed 80% of hole
			stemLen = holeLen - chargeLen;
		}
	}

	return { stemLen: stemLen, chargeLen: chargeLen };
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
		case "ST5050":
			return applyStandardFixedStem(hole, config);
		case CHARGE_CONFIG_CODES.AIR_DECK:
			return applyAirDeck(hole, config);
		case CHARGE_CONFIG_CODES.PRESPLIT:
		case "PRESPLIT":
			return applyPresplit(hole, config);
		case CHARGE_CONFIG_CODES.NO_CHARGE:
			return applyNoCharge(hole, config);
		case CHARGE_CONFIG_CODES.CUSTOM:
		default:
			if (config.deckTemplate && config.deckTemplate.length > 0) {
				return applyCustomTemplate(hole, config);
			}
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
	var chargeLen = holeLen - stemLen;

	// Check short-hole tiers (skipped if config disables short hole logic)
	if (config.applyShortHoleLogic !== false) {
		var tier = getShortHoleTier(holeLen);
		if (tier) {
			var adjusted = applyShortHoleTier(holeLen, stemLen, chargeLen, tier, chargeProduct, hole.holeDiameter || 115);
			if (!adjusted) return applyNoCharge(hole, config); // tier says NO_CHARGE
			stemLen = adjusted.stemLen;
			chargeLen = adjusted.chargeLen;
		}
	}

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
	var primerDepth;
	if (config.primerDepthFromCollar != null && isFormula(String(config.primerDepthFromCollar))) {
		primerDepth = evaluateFormula(String(config.primerDepthFromCollar), {
			holeLength: holeLen, chargeLength: holeLen - stemLen,
			chargeTop: stemLen, chargeBase: holeLen,
			stemLength: stemLen, holeDiameter: (hole.holeDiameter || 115)
		});
		if (primerDepth == null) primerDepth = holeLen * 0.9;
	} else {
		primerDepth = config.primerDepthFromCollar || holeLen * 0.9;
	}
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

	// Check short-hole tiers (skipped if config disables short hole logic)
	if (config.applyShortHoleLogic !== false) {
		var tier = getShortHoleTier(holeLen);
		if (tier) {
			var adjusted = applyShortHoleTier(holeLen, stemLen, chargeLen, tier, chargeProduct, hole.holeDiameter || 115);
			if (!adjusted) return applyNoCharge(hole, config); // tier says NO_CHARGE
			stemLen = adjusted.stemLen;
			chargeLen = adjusted.chargeLen;
		}
	}

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

	// Check short-hole tiers first - they override config ratios for very short holes
	// (skipped if config disables short hole logic)
	var tier = (config.applyShortHoleLogic !== false) ? getShortHoleTier(holeLen) : null;
	if (tier) {
		var adjusted = applyShortHoleTier(holeLen, stemLen, chargeLen, tier, chargeProduct, hole.holeDiameter || 115);
		if (!adjusted) return applyNoCharge(hole, config); // tier says NO_CHARGE
		stemLen = adjusted.stemLen;
		chargeLen = adjusted.chargeLen;
	}
	// Apply chargeRatio if set (e.g. 0.5 = 50% charge, rest becomes top stemming)
	else if (config.chargeRatio != null && config.chargeRatio > 0 && config.chargeRatio < 1) {
		chargeLen = holeLen * config.chargeRatio;
		chargeLen = Math.max(chargeLen, config.minChargeLength || 2.0);
		stemLen = holeLen - chargeLen;
	}

	// Apply mass-based charging if configured (only when chargeRatio not active)
	else if (config.useMassOverLength && config.targetChargeMassKg > 0) {
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

	// Check for configured primer depth (literal or formula)
	var configuredPrimerDepth = null;
	if (config.primerDepthFromCollar != null) {
		var depthVal = config.primerDepthFromCollar;
		if (isFormula(String(depthVal))) {
			configuredPrimerDepth = evaluateFormula(String(depthVal), {
				holeLength: holeLen, chargeLength: actualChargeLen,
				chargeTop: chargeTop, chargeBase: chargeBase,
				stemLength: stemLen, holeDiameter: (hole.holeDiameter || 115)
			});
		} else if (typeof depthVal === "number" && depthVal > 0) {
			configuredPrimerDepth = depthVal;
		}
	}

	var primerCount = Math.max(1, Math.min(maxPrimers, Math.ceil(actualChargeLen / interval)));
	for (var p = 0; p < primerCount; p++) {
		var depth;
		if (p === 0 && configuredPrimerDepth != null) {
			// First primer uses configured depth
			depth = Math.max(chargeTop + 0.1, Math.min(configuredPrimerDepth, chargeBase - 0.1));
		} else if (primerCount === 1) {
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
// AIRDEC: Air Deck (Stem → Spacer → Air → Charge)
// Layout: Stemming at collar, gas bag spacer, air gap fills middle,
//         single charge column at bottom with primer.
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

	// 1) Stemming length (from collar)
	var stemLen = Math.min(config.preferredStemLength || 3.5, holeLen * 0.4);

	// 2) Spacer length (fixed from gas bag product, or default 0.4m)
	var spacerLen = 0.4;
	if (gasBagProduct && gasBagProduct.lengthMm > 0) {
		spacerLen = gasBagProduct.lengthMm / 1000;
	}

	// 3) Charge length (from config or default to 40% of hole)
	var chargeLen = config.preferredChargeLength || (holeLen * 0.4);
	// Cap charge to available space below stem + spacer
	var available = holeLen - stemLen - spacerLen;
	chargeLen = Math.min(chargeLen, available - 0.1);
	chargeLen = Math.max(chargeLen, config.minChargeLength || 1.0);

	// Deck boundaries (from collar down)
	var spacerTop = stemLen;
	var spacerBase = stemLen + spacerLen;
	var chargeTop = holeLen - chargeLen;
	var chargeBase = holeLen;
	// Air deck fills the gap between spacer and charge
	var airTop = spacerBase;
	var airBase = chargeTop;

	// Safety: if air deck has no space, collapse it
	if (airBase <= airTop) {
		airBase = airTop;
	}

	// Deck 1: Stemming (INERT)
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.INERT,
		topDepth: 0,
		baseDepth: spacerTop,
		product: snap(stemProduct) || { name: "Stemming", density: 2.1 }
	}));

	// Deck 2: Gas bag spacer (SPACER, fixed length)
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.SPACER,
		topDepth: spacerTop,
		baseDepth: spacerBase,
		product: snap(gasBagProduct) || { name: "Gas Bag", density: 0.01 }
	}));

	// Deck 3: Air deck (INERT, fills gap)
	if (airBase > airTop + 0.01) {
		hc.decks.push(new Deck({
			holeID: hc.holeID,
			deckType: DECK_TYPES.INERT,
			topDepth: airTop,
			baseDepth: airBase,
			product: { name: "Air", density: 0.0012 }
		}));
	}

	// Deck 4: Charge (COUPLED, at bottom)
	hc.decks.push(new Deck({
		holeID: hc.holeID,
		deckType: DECK_TYPES.COUPLED,
		topDepth: chargeTop,
		baseDepth: chargeBase,
		product: snap(chargeProduct) || { name: "Explosive", density: 0.85 }
	}));

	// Primer depth: use formula from config, or default 90% into charge
	var actualChargeLen = chargeBase - chargeTop;
	var primerDepth;
	if (config.primerDepthFromCollar != null && isFormula(String(config.primerDepthFromCollar))) {
		primerDepth = evaluateFormula(String(config.primerDepthFromCollar), {
			holeLength: holeLen, chargeLength: actualChargeLen,
			chargeTop: chargeTop, chargeBase: chargeBase,
			stemLength: stemLen, holeDiameter: (hole.holeDiameter || 115)
		});
		if (primerDepth == null) primerDepth = chargeBase - actualChargeLen * 0.1;
	} else if (typeof config.primerDepthFromCollar === "number" && config.primerDepthFromCollar > 0) {
		primerDepth = config.primerDepthFromCollar;
	} else {
		primerDepth = chargeBase - actualChargeLen * 0.1;
	}
	primerDepth = Math.max(chargeTop + 0.1, Math.min(primerDepth, chargeBase - 0.1));

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
	var chargeLen = holeLen - stemLen;

	// Check short-hole tiers (skipped if config disables short hole logic)
	if (config.applyShortHoleLogic !== false) {
		var tier = getShortHoleTier(holeLen);
		if (tier) {
			var adjusted = applyShortHoleTier(holeLen, stemLen, chargeLen, tier, chargeProduct, hole.holeDiameter || 115);
			if (!adjusted) return applyNoCharge(hole, config); // tier says NO_CHARGE
			stemLen = adjusted.stemLen;
		}
	}

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

// ============================================================
// CUSTOM: Apply a saved multi-deck template (deckTemplate array)
// Each entry: { type, product, lengthMode, length, formula, massKg }
// lengthMode: "fixed" = exact meters, "fill" = absorb remainder,
//             "formula" = fx:expression, "mass" = kg-based,
//             "product" = spacer (length from product.lengthMm)
// ============================================================

function applyCustomTemplate(hole, config) {
	var hc = new HoleCharging(hole);
	hc.clear();
	hc.decks = [];

	var holeLen = Math.abs(hc.holeLength);
	if (holeLen <= 0) return hc;

	var template = config.deckTemplate;
	var boosterProduct = findProduct(config.boosterProduct);
	var detProduct = findProduct(config.detonatorProduct);
	var holeDiameterMm = hole.holeDiameter || 115;

	// Formula context for deck length formulas
	var formulaCtx = {
		holeLength: holeLen,
		holeDiameter: holeDiameterMm,
		benchHeight: hole.benchHeight || 0,
		subdrillLength: hole.subdrillLength || 0,
		chargeLength: 0,
		chargeTop: 0,
		chargeBase: holeLen,
		stemLength: 0
	};

	// Pass 1: resolve all deck lengths, find fill deck
	var resolvedLengths = [];
	var totalFixed = 0;
	var fillIndex = -1;

	for (var t = 0; t < template.length; t++) {
		var entry = template[t];
		var deckLen = 0;

		switch (entry.lengthMode) {
			case "fill":
				fillIndex = t;
				deckLen = 0; // resolved after totalling fixed
				break;

			case "formula":
				if (entry.formula) {
					var formulaStr = "fx:" + entry.formula;
					var fLen = evaluateFormula(formulaStr, formulaCtx);
					deckLen = (fLen != null && fLen > 0) ? fLen : (entry.length || 1.0);
				} else {
					deckLen = entry.length || 1.0;
				}
				totalFixed += deckLen;
				break;

			case "mass":
				if (entry.massKg > 0) {
					var massProduct = findProduct(entry.product);
					var density = massProduct ? (massProduct.density || 0.85) : 0.85;
					var diamM = holeDiameterMm / 1000;
					var radiusM = diamM / 2;
					var area = Math.PI * radiusM * radiusM;
					var kgPerMetre = density * 1000 * area;
					deckLen = kgPerMetre > 0 ? (entry.massKg / kgPerMetre) : 1.0;
				} else {
					deckLen = entry.length || 1.0;
				}
				totalFixed += deckLen;
				break;

			case "product":
				// Spacer: length from product.lengthMm
				var spacerProduct = findProduct(entry.product);
				if (spacerProduct && spacerProduct.lengthMm > 0) {
					deckLen = spacerProduct.lengthMm / 1000;
				} else {
					deckLen = 0.4; // default spacer length
				}
				totalFixed += deckLen;
				break;

			default: // "fixed"
				deckLen = entry.length || 0;
				totalFixed += deckLen;
				break;
		}

		resolvedLengths.push(deckLen);
	}

	// Calculate fill length
	if (fillIndex >= 0) {
		resolvedLengths[fillIndex] = Math.max(0.1, holeLen - totalFixed);
	}

	// Pass 2: lay out decks from collar down
	var cursor = 0;
	for (var i = 0; i < template.length; i++) {
		var deckLen2 = resolvedLengths[i];

		// If we'd exceed the hole, truncate
		if (cursor + deckLen2 > holeLen) {
			deckLen2 = holeLen - cursor;
		}
		if (deckLen2 <= 0) continue;

		var product = findProduct(template[i].product);
		var deckType = template[i].type || DECK_TYPES.INERT;

		hc.decks.push(new Deck({
			holeID: hc.holeID,
			deckType: deckType,
			topDepth: parseFloat(cursor.toFixed(3)),
			baseDepth: parseFloat((cursor + deckLen2).toFixed(3)),
			product: snap(product) || { name: template[i].product || "Unknown", density: 0 }
		}));

		cursor += deckLen2;
	}

	// Find deepest charge deck index for legacy single-primer fallback
	var chargeDeckIdx = -1;
	for (var c = hc.decks.length - 1; c >= 0; c--) {
		var dt = hc.decks[c].deckType;
		if (dt === DECK_TYPES.COUPLED || dt === DECK_TYPES.DECOUPLED) {
			chargeDeckIdx = c;
			break;
		}
	}

	// Build primer formula context with indexed charge variables
	var primerFormulaCtx = {
		holeLength: holeLen,
		holeDiameter: holeDiameterMm,
		benchHeight: hole.benchHeight || 0,
		subdrillLength: hole.subdrillLength || 0,
		chargeLength: 0,
		chargeTop: 0,
		chargeBase: holeLen,
		stemLength: 0
	};

	// Populate chargeBase_1, chargeTop_1, chargeLength_1, etc. + unindexed defaults
	buildIndexedChargeVars(hc.decks, primerFormulaCtx);

	// Pass 3: place primers using primerTemplate or legacy single-primer logic
	if (config.primerTemplate && config.primerTemplate.length > 0) {
		// Multi-primer from primerTemplate
		for (var pi = 0; pi < config.primerTemplate.length; pi++) {
			var pt = config.primerTemplate[pi];

			// Resolve depth: formula or literal
			var primerDepth;
			if (pt.depth != null && isFormula(String(pt.depth))) {
				primerDepth = evaluateFormula(String(pt.depth), primerFormulaCtx);
				if (primerDepth == null) primerDepth = holeLen * 0.9;
			} else if (typeof pt.depth === "number" && pt.depth > 0) {
				primerDepth = pt.depth;
			} else {
				primerDepth = holeLen * 0.9;
			}
			primerDepth = Math.max(0.1, Math.min(primerDepth, holeLen - 0.1));

			// Look up detonator and booster products
			var ptDet = findProduct(pt.detonator) || detProduct;
			var ptBooster = findProduct(pt.booster) || boosterProduct;

			hc.addPrimer(new Primer({
				holeID: hc.holeID,
				lengthFromCollar: parseFloat(primerDepth.toFixed(2)),
				detonator: {
					productID: ptDet ? ptDet.productID : null,
					productName: ptDet ? ptDet.name : null,
					initiatorType: ptDet ? (ptDet.initiatorType || ptDet.productType) : null,
					deliveryVodMs: ptDet ? (ptDet.deliveryVodMs || 0) : 0,
					delayMs: 0
				},
				booster: {
					productID: ptBooster ? ptBooster.productID : null,
					productName: ptBooster ? ptBooster.name : null,
					quantity: 1,
					massGrams: ptBooster ? ptBooster.massGrams : null
				}
			}));
		}
	} else if (chargeDeckIdx >= 0) {
		// Legacy single-primer logic using primerDepthFromCollar
		var actualChargeLen = primerFormulaCtx.chargeLength;
		var chargeTop = primerFormulaCtx.chargeTop;
		var chargeBase = primerFormulaCtx.chargeBase;

		var primerDepth2;
		if (config.primerDepthFromCollar != null && isFormula(String(config.primerDepthFromCollar))) {
			primerDepth2 = evaluateFormula(String(config.primerDepthFromCollar), primerFormulaCtx);
			if (primerDepth2 == null) primerDepth2 = chargeBase - actualChargeLen * 0.1;
		} else if (typeof config.primerDepthFromCollar === "number" && config.primerDepthFromCollar > 0) {
			primerDepth2 = config.primerDepthFromCollar;
		} else {
			primerDepth2 = chargeBase - actualChargeLen * 0.1;
		}
		primerDepth2 = Math.max(chargeTop + 0.1, Math.min(primerDepth2, chargeBase - 0.1));

		hc.addPrimer(new Primer({
			holeID: hc.holeID,
			lengthFromCollar: parseFloat(primerDepth2.toFixed(2)),
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
