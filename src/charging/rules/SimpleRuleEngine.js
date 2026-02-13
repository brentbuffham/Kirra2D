/**
 * @fileoverview SimpleRuleEngine - Unified template engine for charge rules
 *
 * All charge configs are template-based: deck arrays merged by idx → applyTemplate().
 * No hardcoded per-configCode functions. Short-hole logic integrated into the template engine.
 */

import { HoleCharging } from "../HoleCharging.js";
import { Deck } from "../Deck.js";
import { Primer } from "../Primer.js";
import { DECK_TYPES, SHORT_HOLE_TIERS, CHARGING_DEFAULTS } from "../ChargingConstants.js";
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
 * @param {number} holeLength - Hole length in metres
 * @param {number} [shortHoleThreshold] - Custom threshold (default 4.0)
 * @returns {Object|null} Tier with chargeRatio or fixedMassKg, or null
 */
function getShortHoleTier(holeLength, shortHoleThreshold) {
	var threshold = shortHoleThreshold || CHARGING_DEFAULTS.shortHoleLength || 4.0;
	if (holeLength >= threshold) return null;
	for (var i = 0; i < SHORT_HOLE_TIERS.length; i++) {
		var tier = SHORT_HOLE_TIERS[i];
		if (holeLength >= tier.minLength && holeLength < tier.maxLength) {
			return tier;
		}
	}
	return null;
}

/**
 * Apply short-hole tier overrides to charge/stem lengths.
 * @param {number} holeLen
 * @param {number} stemLen
 * @param {number} chargeLen
 * @param {Object} tier
 * @param {Object} [chargeProduct]
 * @param {number} holeDiameterMm
 * @returns {{ stemLen: number, chargeLen: number }|null} null = NO_CHARGE
 */
function applyShortHoleTier(holeLen, stemLen, chargeLen, tier, chargeProduct, holeDiameterMm) {
	if (tier.chargeRatio === 0) return null;

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
			chargeLen = Math.min(chargeLen, holeLen * 0.8);
			stemLen = holeLen - chargeLen;
		}
	}

	return { stemLen: stemLen, chargeLen: chargeLen };
}

/**
 * Build indexed charge variables from laid-out decks for primer formula context.
 * @param {Array} decks - Array of Deck objects (sorted top-to-bottom)
 * @param {Object} ctx - Formula context object to populate
 */
function buildIndexedChargeVars(decks, ctx) {
	var deepestBase = 0;
	var deepestTop = 0;
	var deepestLen = 0;
	var firstChargeTop = null;

	for (var i = 0; i < decks.length; i++) {
		var d = decks[i];
		var dt = d.deckType;
		if (dt === DECK_TYPES.COUPLED || dt === DECK_TYPES.DECOUPLED) {
			var deckPos = i + 1; // 1-based deck array position — matches UI labels
			var cTop = d.topDepth;
			var cBase = d.baseDepth;
			var cLen = cBase - cTop;

			// Index by deck array position so chargeBase[4] matches COUPLED[4] in the UI
			ctx["chargeBase_" + deckPos] = cBase;
			ctx["chargeTop_" + deckPos] = cTop;
			ctx["chargeLength_" + deckPos] = cLen;

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

	ctx.chargeBase = deepestBase;
	ctx.chargeTop = deepestTop;
	ctx.chargeLength = deepestLen;
	ctx.stemLength = firstChargeTop !== null ? firstChargeTop : 0;
}

/**
 * Apply a charge rule to a hole based on its ChargeConfig.
 * Merges the config's 4 deck arrays into a sorted sequence, then applies as a template.
 * @param {Object} hole - Blast hole from allBlastHoles
 * @param {Object} config - ChargeConfig instance
 * @returns {HoleCharging|null} New HoleCharging or null on failure
 */
export function applyChargeRule(hole, config) {
	if (!hole || !config) return null;

	var deckSequence = config.getMergedDeckSequence();

	// If config has no deck arrays, create a simple no-charge (air fill)
	if (deckSequence.length === 0) {
		return new HoleCharging(hole);
	}

	return applyTemplate(hole, config, deckSequence);
}

/**
 * Unified template engine. Lays out decks from a template sequence into a HoleCharging.
 *
 * LengthModes:
 *   "fixed"   - exact metres
 *   "fill"    - absorbs remaining space after all fixed/formula/mass/product decks
 *   "formula" - fx:expression evaluated with hole variables
 *   "mass"    - kg-based length calculation from product density
 *   "product" - length from product.lengthMm (spacers)
 *
 * @param {Object} hole - Blast hole object
 * @param {Object} config - ChargeConfig
 * @param {Array} deckSequence - Sorted deck template entries
 * @returns {HoleCharging}
 */
function applyTemplate(hole, config, deckSequence) {
	var hc = new HoleCharging(hole);
	hc.clear();
	hc.decks = [];

	var holeLen = Math.abs(hc.holeLength);
	if (holeLen <= 0) return hc;

	var holeDiameterMm = hole.holeDiameter || 115;

	// Short-hole check: find the charge product for tier calculations
	var chargeProduct = null;
	for (var si = 0; si < deckSequence.length; si++) {
		var sEntry = deckSequence[si];
		if (sEntry.type === DECK_TYPES.COUPLED || sEntry.type === DECK_TYPES.DECOUPLED) {
			chargeProduct = findProduct(sEntry.product);
			break;
		}
	}

	// Apply short-hole tier if enabled — per-hole override takes priority over config
	var shortHoleTier = null;
	var useShortHole = (hole.applyShortHoleCharging != null)
		? hole.applyShortHoleCharging
		: (config.shortHoleLogic !== false);
	var shortHoleThreshold = (hole.shortHoleThreshold != null)
		? hole.shortHoleThreshold
		: config.shortHoleLength;
	if (useShortHole) {
		shortHoleTier = getShortHoleTier(holeLen, shortHoleThreshold);
		if (shortHoleTier && shortHoleTier.chargeRatio === 0) {
			// NO_CHARGE: return empty hole
			return hc;
		}
	}

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

	for (var t = 0; t < deckSequence.length; t++) {
		var entry = deckSequence[t];
		var deckLen = 0;

		switch (entry.lengthMode) {
			case "fill":
				fillIndex = t;
				deckLen = 0;
				break;

			case "formula":
				if (entry.formula) {
					var formulaStr = entry.formula;
					if (formulaStr.indexOf("fx:") !== 0 && formulaStr.indexOf("=") !== 0) {
						formulaStr = "fx:" + formulaStr;
					}
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
				var spacerProduct = findProduct(entry.product);
				if (spacerProduct && spacerProduct.lengthMm > 0) {
					deckLen = spacerProduct.lengthMm / 1000;
				} else {
					deckLen = 0.4;
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

	// Short-hole tier adjustment: scale the fill deck's share
	// If short-hole tier provides a chargeRatio, adjust total charge vs stem
	if (shortHoleTier && fillIndex >= 0) {
		var fillEntry = deckSequence[fillIndex];
		var isFillCharge = fillEntry.type === DECK_TYPES.COUPLED || fillEntry.type === DECK_TYPES.DECOUPLED;
		if (isFillCharge && shortHoleTier.chargeRatio != null) {
			// Limit total charge to the tier ratio
			var maxCharge = holeLen * shortHoleTier.chargeRatio;
			var currentCharge = 0;
			for (var sc = 0; sc < deckSequence.length; sc++) {
				if (sc === fillIndex) continue;
				var scType = deckSequence[sc].type;
				if (scType === DECK_TYPES.COUPLED || scType === DECK_TYPES.DECOUPLED) {
					currentCharge += resolvedLengths[sc];
				}
			}
			// Fill deck gets whatever charge allocation remains
			resolvedLengths[fillIndex] = Math.max(0.1, maxCharge - currentCharge);
			// Recalculate totalFixed minus fill (fill was 0)
			var newTotal = 0;
			for (var ns = 0; ns < resolvedLengths.length; ns++) {
				if (ns !== fillIndex) newTotal += resolvedLengths[ns];
			}
			totalFixed = newTotal;
		}
	}

	// Calculate fill length
	if (fillIndex >= 0 && resolvedLengths[fillIndex] === 0) {
		resolvedLengths[fillIndex] = Math.max(0.1, holeLen - totalFixed);
	}

	// Pass 2: lay out decks from collar down
	var cursor = 0;
	for (var i = 0; i < deckSequence.length; i++) {
		var deckLen2 = resolvedLengths[i];

		// Truncate if exceeding hole
		if (cursor + deckLen2 > holeLen) {
			deckLen2 = holeLen - cursor;
		}
		if (deckLen2 <= 0) continue;

		var product = findProduct(deckSequence[i].product);
		var deckType = deckSequence[i].type || DECK_TYPES.INERT;

		var entry = deckSequence[i];

		// Preserve formula strings from template entries
		var lengthFormula = null;
		if (entry.lengthMode === "formula" && entry.formula) {
			lengthFormula = entry.formula;
			if (lengthFormula.indexOf("fx:") !== 0) lengthFormula = "fx:" + lengthFormula;
		} else if (entry.lengthMode === "fill") {
			lengthFormula = "fill";
		} else if (entry.lengthMode === "mass" && entry.massKg > 0) {
			lengthFormula = "m:" + entry.massKg;
		}

		var isVariableDeck = (entry.lengthMode === "formula") || (entry.isVariable || false);
		var deckOpts = {
			holeID: hc.holeID,
			deckType: deckType,
			topDepth: parseFloat(cursor.toFixed(3)),
			baseDepth: parseFloat((cursor + deckLen2).toFixed(3)),
			product: snap(product) || { name: entry.product || "Unknown", density: 0 },
			// Copy scaling flags from template entry
			isFixedLength: entry.isFixedLength || false,
			isFixedMass: entry.isFixedMass || false,
			isVariable: isVariableDeck,
			isProportionalDeck: entry.isProportionalDeck !== undefined
				? entry.isProportionalDeck
				: (!entry.isFixedLength && !entry.isFixedMass && !isVariableDeck),
			// Copy overlap pattern for DECOUPLED decks
			overlapPattern: entry.overlapPattern || null,
			// Store formula for display in Edit Deck dialog
			lengthFormula: lengthFormula
		};

		// DECOUPLED decks get empty contains array for package tracking
		if (deckType === DECK_TYPES.DECOUPLED) {
			deckOpts.contains = [];
		}

		hc.decks.push(new Deck(deckOpts));
		cursor += deckLen2;
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
	buildIndexedChargeVars(hc.decks, primerFormulaCtx);

	// Pass 3: place primers from primerArray
	if (config.primerArray && config.primerArray.length > 0) {
		for (var pi = 0; pi < config.primerArray.length; pi++) {
			var pt = config.primerArray[pi];

			// Resolve depth: formula or literal
			var primerDepth;
			var depthFormula = null;
			if (pt.depth != null && isFormula(String(pt.depth))) {
				depthFormula = String(pt.depth);
				primerDepth = evaluateFormula(depthFormula, primerFormulaCtx);
				if (primerDepth == null) primerDepth = holeLen * 0.9;
			} else if (typeof pt.depth === "number" && pt.depth > 0) {
				primerDepth = pt.depth;
			} else {
				primerDepth = holeLen * 0.9;
			}
			primerDepth = Math.max(0.1, Math.min(primerDepth, holeLen - 0.1));

			var ptDet = findProduct(pt.detonator);
			var ptBooster = findProduct(pt.booster);

			hc.addPrimer(new Primer({
				holeID: hc.holeID,
				lengthFromCollar: parseFloat(primerDepth.toFixed(2)),
				depthFormula: depthFormula,
				detonator: {
					productID: ptDet ? ptDet.productID : null,
					productName: ptDet ? ptDet.name : (pt.detonator || null),
					initiatorType: ptDet ? (ptDet.initiatorType || ptDet.productType) : null,
					deliveryVodMs: ptDet ? (ptDet.deliveryVodMs || 0) : 0,
					delayMs: 0
				},
				booster: {
					productID: ptBooster ? ptBooster.productID : null,
					productName: ptBooster ? ptBooster.name : (pt.booster || null),
					quantity: 1,
					massGrams: ptBooster ? ptBooster.massGrams : null
				}
			}));
		}
	}

	hc.sortDecks();
	return hc;
}
