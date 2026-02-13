/**
 * @fileoverview Safe formula evaluator for primer depth and charge calculations.
 * Supports two prefixes:
 *   "="   - internal/programmatic use (Kirra UI, IndexedDB)
 *   "fx:" - Excel-safe prefix for CSV templates (won't trigger spreadsheet formula)
 *
 * Available variables: holeLength, chargeLength, chargeTop, chargeBase, stemLength, holeDiameter
 * Indexed variables: chargeBase[N], chargeTop[N], etc. where N = deck position from section view
 *   Internally mapped: chargeBase[4] → chargeBase_4
 * Math functions available: Math.min(), Math.max(), Math.abs(), Math.PI, Math.sqrt(), etc.
 *
 * Custom functions:
 *   massLength(kg, density)         - Length from mass using numeric density (g/cc) and holeDiameter
 *   massLength(kg, "ProductName")   - Length from mass using product name lookup for density
 *
 * Examples: "=chargeBase - chargeLength * 0.1"  or  "fx:chargeBase[4] - 0.3"
 *           "fx:chargeTop[4] - massLength(50, 1.2)"
 *           "fx:chargeTop[4] - massLength(50, \"GENERIC4060\")"
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
 * Create a massLength function bound to a specific hole diameter.
 * Calculates the deck length required to hold a given mass of product.
 *
 * Formula: length = massKg / (density * 1000 * PI * (holeDiameter/2000)^2)
 *
 * @param {number} holeDiameterMm - Hole diameter in millimetres
 * @returns {Function} massLength(kg, densityOrProductName)
 */
function createMassLengthFn(holeDiameterMm) {
	return function massLength(massKg, densityOrProduct) {
		if (!massKg || massKg <= 0) return 0;

		var density = 0;

		if (typeof densityOrProduct === "number") {
			// Direct density in g/cc
			density = densityOrProduct;
		} else if (typeof densityOrProduct === "string") {
			// Product name lookup
			if (window.loadedProducts) {
				window.loadedProducts.forEach(function (p) {
					if (p.name === densityOrProduct && p.density) {
						density = p.density;
					}
				});
			}
			if (density <= 0) {
				console.warn("massLength: product '" + densityOrProduct + "' not found or has no density");
				return 0;
			}
		} else {
			return 0;
		}

		if (density <= 0) return 0;

		var diamM = (holeDiameterMm || 115) / 1000;
		var radiusM = diamM / 2;
		var area = Math.PI * radiusM * radiusM;
		var kgPerMetre = density * 1000 * area;
		if (kgPerMetre <= 0) return 0;

		return massKg / kgPerMetre;
	};
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

	// Add massLength as a callable function bound to holeDiameter
	var holeDia = variables.holeDiameter || 115;
	names.push("massLength");
	values.push(createMassLengthFn(holeDia));

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
