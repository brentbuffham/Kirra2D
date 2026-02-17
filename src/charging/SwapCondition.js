/**
 * @fileoverview SwapCondition - Per-deck product swap condition parsing, serialization, and evaluation
 *
 * Swap rule syntax:
 *   conditionCode{PRODUCT[,threshold]}
 *   Multiple rules separated by |:
 *   w{WR-ANFO}|r{Emulsion}|t{Emulsion,C>50}
 *
 * Condition codes:
 *   w  = wet hole
 *   d  = damp hole
 *   r  = reactive ground
 *   t  = temperature threshold (C>50, F>=122, C<30)
 *   x1..x20 = future user-defined conditions
 *
 * Temperature threshold format:
 *   [C|F][>|<|>=|<=]number
 */

/**
 * Parse a swap rule string into a structured array.
 *
 * Input:  "w{WR-ANFO}|r{Emulsion}|t{Emulsion,C>50}"
 * Output: [
 *   { code: "w", product: "WR-ANFO", threshold: null },
 *   { code: "r", product: "Emulsion", threshold: null },
 *   { code: "t", product: "Emulsion", threshold: { unit: "C", op: ">", value: 50 } }
 * ]
 *
 * @param {string} swapStr - Raw swap rule string
 * @returns {Array<{code:string, product:string, threshold:Object|null}>}
 */
export function parseSwapRules(swapStr) {
	if (!swapStr || typeof swapStr !== "string") return [];

	var rules = [];
	var str = swapStr.trim();
	if (str.length === 0) return [];

	// Split on | at depth 0 (outside braces)
	var segments = [];
	var depth = 0;
	var current = "";
	for (var i = 0; i < str.length; i++) {
		var ch = str.charAt(i);
		if (ch === "{") depth++;
		else if (ch === "}") depth--;
		if (ch === "|" && depth === 0) {
			segments.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	if (current.length > 0) segments.push(current);

	for (var s = 0; s < segments.length; s++) {
		var seg = segments[s].trim();
		if (seg.length === 0) continue;

		// Find the opening brace
		var braceIdx = seg.indexOf("{");
		if (braceIdx === -1) continue;

		var code = seg.substring(0, braceIdx).trim();
		if (code.length === 0) continue;

		// Extract content between braces
		var endBrace = seg.lastIndexOf("}");
		if (endBrace <= braceIdx) continue;

		var content = seg.substring(braceIdx + 1, endBrace).trim();
		if (content.length === 0) continue;

		// For temperature code "t", look for threshold after comma
		var product = content;
		var threshold = null;

		if (code === "t") {
			// Find the last comma that separates product from threshold
			// Threshold looks like: C>50, F>=122, C<30, F<=100
			var lastComma = content.lastIndexOf(",");
			if (lastComma !== -1) {
				var possibleThreshold = content.substring(lastComma + 1).trim();
				var parsed = parseThreshold(possibleThreshold);
				if (parsed) {
					threshold = parsed;
					product = content.substring(0, lastComma).trim();
				}
			}
		}

		rules.push({
			code: code,
			product: product,
			threshold: threshold
		});
	}

	return rules;
}

/**
 * Parse a temperature threshold string.
 * Input: "C>50", "F>=122", "C<30", "F<=100"
 * Output: { unit: "C", op: ">", value: 50 } or null
 *
 * @param {string} threshStr
 * @returns {{unit:string, op:string, value:number}|null}
 */
function parseThreshold(threshStr) {
	if (!threshStr || threshStr.length < 3) return null;

	var unit = threshStr.charAt(0).toUpperCase();
	if (unit !== "C" && unit !== "F") return null;

	var rest = threshStr.substring(1);
	var op = null;
	var numStr = null;

	if (rest.substring(0, 2) === ">=" || rest.substring(0, 2) === "<=") {
		op = rest.substring(0, 2);
		numStr = rest.substring(2);
	} else if (rest.charAt(0) === ">" || rest.charAt(0) === "<") {
		op = rest.charAt(0);
		numStr = rest.substring(1);
	}

	if (!op || !numStr) return null;

	var value = parseFloat(numStr);
	if (isNaN(value) || !isFinite(value)) return null;

	return { unit: unit, op: op, value: value };
}

/**
 * Serialize structured swap rules back to string.
 * Inverse of parseSwapRules.
 *
 * @param {Array<{code:string, product:string, threshold:Object|null}>} rules
 * @returns {string}
 */
export function serializeSwapRules(rules) {
	if (!rules || rules.length === 0) return "";

	var parts = [];
	for (var i = 0; i < rules.length; i++) {
		var r = rules[i];
		var inner = r.product;
		if (r.threshold) {
			inner += "," + r.threshold.unit + r.threshold.op + r.threshold.value;
		}
		parts.push(r.code + "{" + inner + "}");
	}
	return parts.join("|");
}

/**
 * Convert temperature between Celsius and Fahrenheit.
 * @param {number} temp - Temperature value
 * @param {string} fromUnit - "C" or "F"
 * @param {string} toUnit - "C" or "F"
 * @returns {number}
 */
function convertTemp(temp, fromUnit, toUnit) {
	if (fromUnit === toUnit) return temp;
	if (fromUnit === "C" && toUnit === "F") return temp * 9 / 5 + 32;
	if (fromUnit === "F" && toUnit === "C") return (temp - 32) * 5 / 9;
	return temp;
}

/**
 * Compare a value against a threshold using the given operator.
 * @param {number} val
 * @param {string} op - ">", "<", ">=", "<="
 * @param {number} threshold
 * @returns {boolean}
 */
function compareOp(val, op, threshold) {
	switch (op) {
		case ">": return val > threshold;
		case ">=": return val >= threshold;
		case "<": return val < threshold;
		case "<=": return val <= threshold;
		default: return false;
	}
}

/**
 * Evaluate swap conditions against a hole's state.
 * Returns the product name to swap to, or null if no swap.
 *
 * Priority order: first matching rule wins (w, d, r, t, x1..x20).
 *
 * @param {Array} swapRules - Parsed swap rules (from parseSwapRules)
 * @param {Object} holeState - { conditions: Set<string>, temperature: number, tempUnit: "C"|"F" }
 * @returns {string|null} Replacement product name, or null
 */
export function evaluateSwap(swapRules, holeState) {
	if (!swapRules || swapRules.length === 0) return null;
	if (!holeState) return null;

	var conditions = holeState.conditions || new Set();
	var temp = holeState.temperature || 0;
	var tempUnit = holeState.tempUnit || "C";

	for (var i = 0; i < swapRules.length; i++) {
		var rule = swapRules[i];

		if (rule.code === "t") {
			// Temperature condition: check threshold
			if (rule.threshold && temp !== 0) {
				var compareTemp = temp;
				if (tempUnit !== rule.threshold.unit) {
					compareTemp = convertTemp(temp, tempUnit, rule.threshold.unit);
				}
				if (compareOp(compareTemp, rule.threshold.op, rule.threshold.value)) {
					return rule.product;
				}
			}
		} else {
			// Simple condition code: check if hole has this condition
			if (conditions.has(rule.code)) {
				return rule.product;
			}
		}
	}

	return null;
}

/**
 * Full resolution: check perHoleCondition first, then deck swap.
 * Returns replacement product name, or null (use original).
 *
 * Per-hole override takes priority over deck-level swap rules.
 *
 * @param {string} deckSwapStr - Deck's swap field
 * @param {string} holeSwapStr - Hole's perHoleCondition field
 * @param {Object} holeState - { conditions: Set, temperature: number, tempUnit: string }
 * @returns {string|null}
 */
export function resolveProductSwap(deckSwapStr, holeSwapStr, holeState) {
	if (!holeState) return null;

	var conditions = holeState.conditions || new Set();
	var hasConditions = conditions.size > 0 || (holeState.temperature && holeState.temperature !== 0);
	if (!hasConditions) return null;

	// Check per-hole override first
	if (holeSwapStr) {
		var holeRules = parseSwapRules(holeSwapStr);
		var holeResult = evaluateSwap(holeRules, holeState);
		if (holeResult) return holeResult;
	}

	// Fall back to deck swap rules
	if (deckSwapStr) {
		var deckRules = parseSwapRules(deckSwapStr);
		return evaluateSwap(deckRules, holeState);
	}

	return null;
}
