/**
 * @fileoverview SimpleRuleEngine - Unified template engine for charge rules
 *
 * All charge configs are template-based: deck arrays merged by idx -> applyTemplate().
 * No hardcoded per-configCode functions.
 *
 * Template entries use top/base depth formulas:
 *   top  = "0" | "fx:deckBase[1]" | "2.5"  (depth from collar)
 *   base = "fx:holeLength" | "3.5" | "fx:deckBase[1]"  (depth from collar)
 *
 * Mass field modes:
 *   null     = no mass tracking
 *   number   = target kg (derive missing top or base from mass length)
 *   "mass"   = calculate mass from (base - top) for display
 */

import { HoleCharging } from "../HoleCharging.js";
import { Deck } from "../Deck.js";
import { Primer } from "../Primer.js";
import { DECK_TYPES } from "../ChargingConstants.js";
import { isFormula, evaluateFormula } from "../../helpers/FormulaEvaluator.js";
import { resolveProductSwap } from "../SwapCondition.js";

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
		massGrams: product.massGrams || null,
		vodMs: product.vodMs || null
	};
}

/**
 * Build indexed charge variables from laid-out decks for primer formula context.
 * Only indexes COUPLED and DECOUPLED decks for chargeBase[N], chargeTop[N], chargeLength[N].
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
			var deckPos = i + 1; // 1-based deck array position
			var cTop = d.topDepth;
			var cBase = d.baseDepth;
			var cLen = cBase - cTop;

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
 * Build indexed deck variables from resolved decks for deckBase[N]/deckTop[N]/deckLength[N].
 * ALL deck types get indexed (not just charge decks).
 * @param {Array} resolvedDecks - Array of {topDepth, baseDepth} objects
 * @param {Object} ctx - Formula context object to populate
 */
function buildIndexedDeckVars(resolvedDecks, ctx) {
	for (var i = 0; i < resolvedDecks.length; i++) {
		var d = resolvedDecks[i];
		var deckPos = i + 1;
		ctx["deckBase_" + deckPos] = d.baseDepth;
		ctx["deckTop_" + deckPos] = d.topDepth;
		ctx["deckLength_" + deckPos] = d.baseDepth - d.topDepth;
	}
}

/**
 * Resolve a top or base depth value from a template entry field.
 * Handles: numeric string, "fx:formula", null/empty.
 * @param {string|null} depthStr - The depth field value
 * @param {number} fallback - Fallback value if null/empty/error
 * @param {Object} ctx - Formula context
 * @returns {{ value: number, formula: string|null }} Resolved depth and original formula
 */
function resolveDepth(depthStr, fallback, ctx) {
	if (depthStr == null || depthStr === "") {
		return { value: fallback, formula: null };
	}
	var str = String(depthStr).trim();
	if (isFormula(str)) {
		var result = evaluateFormula(str, ctx);
		return { value: (result != null && isFinite(result)) ? result : fallback, formula: str };
	}
	var num = parseFloat(str);
	if (!isNaN(num) && isFinite(num)) {
		return { value: num, formula: null };
	}
	return { value: fallback, formula: null };
}

/**
 * Calculate the length of explosive column needed to hold a given mass.
 * length = massKg / (density * 1000 * PI * (diameter/2000)^2)
 * @param {number} massKg - Target mass in kilograms
 * @param {number} density - Product density in g/cc
 * @param {number} holeDiameterMm - Hole diameter in millimetres
 * @returns {number} Length in metres
 */
function massToLength(massKg, density, holeDiameterMm) {
	if (!massKg || massKg <= 0 || !density || density <= 0) return 0;
	var diamM = (holeDiameterMm || 115) / 1000;
	var radiusM = diamM / 2;
	var area = Math.PI * radiusM * radiusM;
	var kgPerMetre = density * 1000 * area;
	if (kgPerMetre <= 0) return 0;
	return massKg / kgPerMetre;
}

/**
 * Build hole state object for swap condition evaluation.
 * @param {Object} hole - Blast hole object
 * @returns {{ conditions: Set<string>, temperature: number, tempUnit: string }}
 */
function buildHoleState(hole) {
	var conditions = new Set();
	var condStr = hole.holeConditions || "";
	if (condStr) {
		var parts = condStr.split(",");
		for (var i = 0; i < parts.length; i++) {
			var trimmed = parts[i].trim();
			if (trimmed) conditions.add(trimmed);
		}
	}
	return {
		conditions: conditions,
		temperature: hole.measuredTemperature || 0,
		tempUnit: hole.measuredTemperatureUnit || "C"
	};
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
 * Each template entry has top/base depth fields (numeric or fx:formula).
 * Decks are resolved sequentially by idx so deckBase[M] is available for M < current.
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
	if (holeLen <= 0) {
		console.warn("[applyTemplate] holeLen=0 for hole " + hole.holeID + ", holeLengthCalc=" + hole.holeLengthCalculated + ", measuredLen=" + hole.measuredLength);
		return hc;
	}

	var holeDiameterMm = hole.holeDiameter || 115;
	console.log("[applyTemplate] hole=" + hole.holeID + " holeLen=" + holeLen.toFixed(3) + " dia=" + holeDiameterMm);

	// Formula context — grows incrementally as each deck is resolved
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

	// Track resolved decks for deckBase[N]/deckTop[N] variables
	var resolvedDecks = [];

	// Single pass: resolve each deck sequentially by idx
	for (var t = 0; t < deckSequence.length; t++) {
		var entry = deckSequence[t];
		var deckType = entry.type || DECK_TYPES.INERT;
		var product = findProduct(entry.product);
		var topDepth, baseDepth;
		var topFormula = null, baseFormula = null;

		if (deckType === DECK_TYPES.SPACER) {
			// Spacer: top from entry.top, base derived from product length
			var spacerProduct = product;
			var spacerLen = (spacerProduct && spacerProduct.lengthMm > 0) ? spacerProduct.lengthMm / 1000 : 0.4;

			var spacerTop = resolveDepth(entry.top, resolvedDecks.length > 0 ? resolvedDecks[resolvedDecks.length - 1].baseDepth : 0, formulaCtx);
			topDepth = spacerTop.value;
			topFormula = spacerTop.formula;
			baseDepth = topDepth + spacerLen;
			baseFormula = null;
		} else {
			// Non-spacer: resolve top and base from entry
			var prevBase = resolvedDecks.length > 0 ? resolvedDecks[resolvedDecks.length - 1].baseDepth : 0;
			var topResult = resolveDepth(entry.top, prevBase, formulaCtx);
			var baseResult = resolveDepth(entry.base, holeLen, formulaCtx);
			topDepth = topResult.value;
			baseDepth = baseResult.value;
			topFormula = topResult.formula;
			baseFormula = baseResult.formula;

			// Handle mass field
			var massKg = entry.massKg;
			if (massKg != null && massKg !== "mass" && typeof massKg !== "string") {
				// Numeric mass target — derive missing end
				var density = product ? (product.density || 0.85) : 0.85;
				var massLen = massToLength(massKg, density, holeDiameterMm);

				if (entry.top == null || entry.top === "") {
					// Top is unset — derive from base
					topDepth = baseDepth - massLen;
				} else if (entry.base == null || entry.base === "") {
					// Base is unset — derive from top
					baseDepth = topDepth + massLen;
				}
				// If both are set, mass is informational only
			}

			console.log("[applyTemplate] deck idx=" + entry.idx + " top=" + topDepth.toFixed(3) + " base=" + baseDepth.toFixed(3));
		}

		// Clamp to 3 decimal places
		topDepth = parseFloat(topDepth.toFixed(3));
		baseDepth = parseFloat(baseDepth.toFixed(3));

		// Clamp to hole bounds
		if (topDepth < 0) topDepth = 0;
		if (baseDepth > holeLen) baseDepth = parseFloat(holeLen.toFixed(3));
		if (baseDepth <= topDepth) {
			// Zero or negative length — skip this deck
			resolvedDecks.push({ topDepth: topDepth, baseDepth: topDepth });
			buildIndexedDeckVars(resolvedDecks, formulaCtx);
			continue;
		}

		// Determine scaling flags
		var isVariableDeck = entry.isVariable || false;
		if (!isVariableDeck && (topFormula || baseFormula)) {
			isVariableDeck = true;
		}

		// Resolve product — check for swap conditions
		var resolvedProduct = snap(product) || { name: entry.product || "Unknown", density: 0 };
		var swappedFrom = null;
		var swapField = entry.swap || null;

		if (swapField || hole.perHoleCondition) {
			var holeState = buildHoleState(hole);
			var swapProduct = resolveProductSwap(swapField, hole.perHoleCondition, holeState);
			if (swapProduct) {
				var altProduct = findProduct(swapProduct);
				if (altProduct) {
					swappedFrom = resolvedProduct.name || entry.product;
					resolvedProduct = snap(altProduct);
				} else {
					console.warn("[applyTemplate] swap product not found: " + swapProduct);
				}
			}
		}

		var deckOpts = {
			holeID: hc.holeID,
			deckType: deckType,
			topDepth: topDepth,
			baseDepth: baseDepth,
			product: resolvedProduct,
			isFixedLength: entry.isFixedLength || false,
			isFixedMass: entry.isFixedMass || false,
			isVariable: isVariableDeck,
			isProportionalDeck: entry.isProportionalDeck !== undefined
				? entry.isProportionalDeck
				: (!entry.isFixedLength && !entry.isFixedMass && !isVariableDeck),
			overlapPattern: entry.overlapPattern || null,
			topDepthFormula: topFormula,
			baseDepthFormula: baseFormula,
			// Keep lengthFormula for backward compat display
			lengthFormula: null,
			swap: swapField,
			swappedFrom: swappedFrom
		};

		// DECOUPLED decks get empty contains array for package tracking
		if (deckType === DECK_TYPES.DECOUPLED) {
			deckOpts.contains = [];
		}

		hc.decks.push(new Deck(deckOpts));

		// Track resolved position for deckBase[N]/deckTop[N]
		resolvedDecks.push({ topDepth: topDepth, baseDepth: baseDepth });
		buildIndexedDeckVars(resolvedDecks, formulaCtx);

		// Also add chargeBase[N]/chargeTop[N] incrementally for COUPLED/DECOUPLED decks
		// so subsequent deck formulas can reference them (not just primers)
		if (deckType === DECK_TYPES.COUPLED || deckType === DECK_TYPES.DECOUPLED) {
			var chargeIdx = resolvedDecks.length; // 1-based (matches deckBase[N] numbering)
			formulaCtx["chargeBase_" + chargeIdx] = baseDepth;
			formulaCtx["chargeTop_" + chargeIdx] = topDepth;
			formulaCtx["chargeLength_" + chargeIdx] = baseDepth - topDepth;
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
	buildIndexedChargeVars(hc.decks, primerFormulaCtx);
	buildIndexedDeckVars(resolvedDecks, primerFormulaCtx);

	// Place primers from primerArray
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
					delayMs: pt.delayMs || (ptDet ? (ptDet.delayMs || 0) : 0)
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
