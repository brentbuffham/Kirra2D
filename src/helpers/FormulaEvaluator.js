/**
 * @fileoverview Safe formula evaluator for primer depth and charge calculations.
 * Formulas start with "=" and can reference hole/charge variables.
 *
 * Available variables: holeLength, chargeLength, chargeTop, chargeBase, stemLength, holeDiameter
 * Example: "=chargeBase - chargeLength * 0.1"
 */

/**
 * Check if a value is a formula string (starts with "=")
 * @param {*} value
 * @returns {boolean}
 */
export function isFormula(value) {
	return typeof value === "string" && value.length > 1 && value.charAt(0) === "=";
}

/**
 * Evaluate a formula string with provided variables.
 * Strips the leading "=" and evaluates the expression in strict mode.
 * Only numeric results are returned; NaN/Infinity returns null.
 *
 * @param {string} formula - Formula string starting with "="
 * @param {Object} variables - Map of variable names to numeric values
 * @returns {number|null} Evaluated result or null on error
 */
export function evaluateFormula(formula, variables) {
	if (!isFormula(formula)) return null;

	var expr = formula.substring(1).trim();
	if (expr.length === 0) return null;

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
