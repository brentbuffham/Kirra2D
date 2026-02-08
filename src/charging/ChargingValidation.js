/**
 * @fileoverview ChargingValidation - Validates charging data for a hole or set of holes
 * Checks deck contiguity, primer placement, product assignments, and deck overlap
 */

import { DECK_TYPES, VALIDATION_MESSAGES } from "./ChargingConstants.js";

/**
 * Validate a single HoleCharging instance
 * @param {import('./HoleCharging.js').HoleCharging} holeCharging
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateHoleCharging(holeCharging) {
	return holeCharging.validate();
}

/**
 * Validate deck contiguity - checks for gaps and overlaps between decks
 * @param {import('./Deck.js').Deck[]} decks - Sorted array of decks
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateDeckContiguity(decks) {
	var errors = [], warnings = [];

	if (decks.length === 0) {
		errors.push(VALIDATION_MESSAGES.NO_DECKS);
		return { valid: false, errors: errors, warnings: warnings };
	}

	// Sort by topDepth
	var sorted = decks.slice().sort(function(a, b) { return a.topDepth - b.topDepth; });

	for (var i = 0; i < sorted.length - 1; i++) {
		var currentBase = sorted[i].baseDepth;
		var nextTop = sorted[i + 1].topDepth;
		var gap = nextTop - currentBase;

		if (gap > 0.001) {
			warnings.push(VALIDATION_MESSAGES.DECK_GAP + " Between deck " + (i + 1) + " and " + (i + 2) + ": " + gap.toFixed(3) + "m");
		} else if (gap < -0.001) {
			errors.push(VALIDATION_MESSAGES.DECK_OVERLAP + " Between deck " + (i + 1) + " and " + (i + 2) + ": " + Math.abs(gap).toFixed(3) + "m");
		}
	}

	return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

/**
 * Validate primer placement against decks
 * @param {import('./Primer.js').Primer[]} primers
 * @param {import('./Deck.js').Deck[]} decks
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validatePrimers(primers, decks) {
	var errors = [], warnings = [];

	for (var i = 0; i < primers.length; i++) {
		var result = primers[i].validate(decks);
		errors = errors.concat(result.errors);
		warnings = warnings.concat(result.warnings);
	}

	return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

/**
 * Validate all charging across multiple holes
 * @param {Map} chargingMap - holeID -> HoleCharging
 * @returns {{ totalErrors: number, totalWarnings: number, results: Object[] }}
 */
export function validateAllCharging(chargingMap) {
	var results = [];
	var totalErrors = 0;
	var totalWarnings = 0;

	chargingMap.forEach(function(holeCharging, holeID) {
		var result = holeCharging.validate();
		results.push({
			holeID: holeID,
			entityName: holeCharging.entityName,
			valid: result.valid,
			errors: result.errors,
			warnings: result.warnings
		});
		totalErrors += result.errors.length;
		totalWarnings += result.warnings.length;
	});

	return {
		totalErrors: totalErrors,
		totalWarnings: totalWarnings,
		allValid: totalErrors === 0,
		results: results
	};
}
