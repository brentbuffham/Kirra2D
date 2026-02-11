/**
 * @fileoverview Safe formula evaluator for primer depth and charge calculations.
 * Supports two prefixes:
 *   "="   - internal/programmatic use (Kirra UI, IndexedDB)
 *   "fx:" - Excel-safe prefix for CSV templates (won't trigger spreadsheet formula)
 *
 * Available variables: holeLength, chargeLength, chargeTop, chargeBase, stemLength, holeDiameter
 * Indexed variables: chargeBase[1], chargeTop[2], etc. → internally mapped to chargeBase_1, chargeTop_2
 * Math functions available: Math.min(), Math.max(), Math.abs(), Math.PI, Math.sqrt(), etc.
 * Examples: "=chargeBase - chargeLength * 0.1"  or  "fx:chargeBase[1] - 0.3"
 */

/**
 * Check if a value is a formula string (starts with "=" or "fx:")
 * @param {*} value
 * @returns {boolean}
 */
export function isFormula(value) {
	if (typeof value !== "string" || value.length < 2) return false;
	if (value.charAt(0) === "=") return true;
	if (value.length > 3 && value.substring(0, 3) === "fx:") return true;
	return false;
}

/**
 * Strip the formula prefix ("=" or "fx:") and return the expression body.
 * @param {string} formula
 * @returns {string} Expression without prefix
 */
function stripPrefix(formula) {
	if (formula.charAt(0) === "=") return formula.substring(1).trim();
	if (formula.substring(0, 3) === "fx:") return formula.substring(3).trim();
	return formula.trim();
}

/**
 * Evaluate a formula string with provided variables.
 * Strips the prefix ("=" or "fx:") and evaluates the expression in strict mode.
 * Only numeric results are returned; NaN/Infinity returns null.
 *
 * @param {string} formula - Formula string starting with "=" or "fx:"
 * @param {Object} variables - Map of variable names to numeric values
 * @returns {number|null} Evaluated result or null on error
 */
export function evaluateFormula(formula, variables) {
	if (!isFormula(formula)) return null;

	var expr = stripPrefix(formula);
	if (expr.length === 0) return null;

	// Transform bracket notation: chargeBase[1] → chargeBase_1
	// This allows indexed variables while keeping valid JS identifiers
	expr = expr.replace(/([a-zA-Z_]\w*)\[(\d+)\]/g, "$1_$2");

	// Build argument names and values from variables
	var names = [];
	var values = [];
	for (var key in variables) {
		if (variables.hasOwnProperty(key)) {
			names.push(key);
			values.push(Number(variables[key]) || 0);
		}
	}

	try {
		// Create function with variable names as parameters
		var fn = new Function(names.join(","), '"use strict"; return (' + expr + ");");
		var result = fn.apply(null, values);

		if (typeof result !== "number" || !isFinite(result)) return null;
		return result;
	} catch (e) {
		console.warn("FormulaEvaluator: error evaluating '" + formula + "':", e.message);
		return null;
	}
}
