// src/helpers/DownholeTimingCalculator.js
// Calculates per-deck fire times for downhole timing visualization and export.
// Created: 2026-02-15
//
// Each explosive deck has a fire time = holeTime + downholeDelay
// holeTime: accumulated surface time (all upstream delays + VOD travel)
// downholeDelay: primer.totalDownholeDelayMs (detonator delay + burn time to depth)

import { DECK_TYPES } from "../charging/ChargingConstants.js";

/**
 * @typedef {Object} DeckTimingEntry
 * @property {string} holeID
 * @property {string} entityName
 * @property {number} deckIndex - Index of the deck in the HoleCharging.decks array
 * @property {string} deckID
 * @property {string} deckType - COUPLED or DECOUPLED
 * @property {number} topDepthM - Top depth from collar in metres
 * @property {number} baseDepthM - Base depth from collar in metres
 * @property {number} lengthM - Deck length in metres
 * @property {string} productName
 * @property {number} massKg - Explosive mass in kg
 * @property {number} surfaceDelayMs - Surface connector delay in ms
 * @property {number} downholeDelayMs - Downhole delay (detonator + burn) in ms
 * @property {number} totalFireTimeMs - Total fire time (surface + downhole) in ms
 * @property {string|null} primerID - Associated primer ID, if any
 */

/**
 * Calculate fire times for all explosive decks across all holes.
 *
 * @param {Array} allBlastHoles - Array of blast hole objects
 * @param {Map} chargingMap - Map<holeID, HoleCharging>
 * @param {Object} [options]
 * @param {boolean} [options.visibleOnly=true] - Only include visible holes
 * @param {string} [options.entityFilter] - Filter by entityName
 * @returns {DeckTimingEntry[]} Array of timing entries sorted by totalFireTimeMs
 */
export function calculateDownholeTimings(allBlastHoles, chargingMap, options) {
	if (!allBlastHoles || !chargingMap) return [];

	var visibleOnly = !options || options.visibleOnly !== false;
	var entityFilter = options ? options.entityFilter : null;
	var entries = [];

	for (var i = 0; i < allBlastHoles.length; i++) {
		var hole = allBlastHoles[i];

		if (visibleOnly && hole.visible === false) continue;
		if (entityFilter && hole.entityName !== entityFilter) continue;

		var charging = chargingMap.get(hole.holeID);
		if (!charging) continue;

		// Use accumulated hole time (includes all upstream surface delays + VOD travel)
		// holeTime is pre-calculated by calculateTimes() in kirra.js
		var surfaceDelay = hole.holeTime || 0;

		for (var d = 0; d < charging.decks.length; d++) {
			var deck = charging.decks[d];
			if (deck.deckType !== DECK_TYPES.COUPLED && deck.deckType !== DECK_TYPES.DECOUPLED) continue;

			var massKg = deck.calculateMass(charging.holeDiameterMm);

			// Find primer for this deck
			var downholeDelay = 0;
			var primerID = null;

			// First: check by deckID match
			for (var p = 0; p < charging.primers.length; p++) {
				if (charging.primers[p].deckID === deck.deckID) {
					downholeDelay = charging.primers[p].totalDownholeDelayMs;
					primerID = charging.primers[p].primerID;
					break;
				}
			}
			// Fallback: find primer within deck depth bounds
			if (primerID === null) {
				for (var p2 = 0; p2 < charging.primers.length; p2++) {
					if (deck.containsDepth(charging.primers[p2].lengthFromCollar)) {
						downholeDelay = charging.primers[p2].totalDownholeDelayMs;
						primerID = charging.primers[p2].primerID;
						break;
					}
				}
			}

			entries.push({
				holeID: hole.holeID,
				entityName: hole.entityName || "",
				deckIndex: d,
				deckID: deck.deckID,
				deckType: deck.deckType,
				topDepthM: deck.topDepth,
				baseDepthM: deck.baseDepth,
				lengthM: deck.length,
				productName: deck.product ? deck.product.name : "",
				massKg: massKg,
				surfaceDelayMs: surfaceDelay,
				downholeDelayMs: downholeDelay,
				totalFireTimeMs: surfaceDelay + downholeDelay,
				primerID: primerID
			});
		}
	}

	// Sort by fire time
	entries.sort(function(a, b) { return a.totalFireTimeMs - b.totalFireTimeMs; });

	return entries;
}

/**
 * Get the min and max fire times across all entries.
 * @param {DeckTimingEntry[]} entries
 * @returns {{minMs: number, maxMs: number, rangeMs: number}}
 */
export function getTimingRange(entries) {
	if (!entries || entries.length === 0) {
		return { minMs: 0, maxMs: 0, rangeMs: 0 };
	}
	var minMs = entries[0].totalFireTimeMs;
	var maxMs = entries[entries.length - 1].totalFireTimeMs;
	return { minMs: minMs, maxMs: maxMs, rangeMs: maxMs - minMs };
}

/**
 * Get timing entries grouped by holeID.
 * @param {DeckTimingEntry[]} entries
 * @returns {Map<string, DeckTimingEntry[]>}
 */
export function groupTimingsByHole(entries) {
	var grouped = new Map();
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i];
		if (!grouped.has(entry.holeID)) {
			grouped.set(entry.holeID, []);
		}
		grouped.get(entry.holeID).push(entry);
	}
	return grouped;
}

/**
 * Map a fire time to a normalized 0-1 value within the timing range.
 * @param {number} fireTimeMs
 * @param {number} minMs
 * @param {number} rangeMs
 * @returns {number} 0-1
 */
export function normalizeFireTime(fireTimeMs, minMs, rangeMs) {
	if (rangeMs <= 0) return 0.5;
	return Math.max(0, Math.min(1, (fireTimeMs - minMs) / rangeMs));
}

/**
 * Get a color for a normalized fire time (0=blue/early, 0.5=green, 1=red/late).
 * @param {number} t - Normalized 0-1 value
 * @returns {string} Hex color string
 */
export function fireTimeToColor(t) {
	var r, g, b;
	if (t < 0.5) {
		// Blue to Green
		var s = t * 2;
		r = 0;
		g = Math.round(s * 255);
		b = Math.round((1 - s) * 255);
	} else {
		// Green to Red
		var s2 = (t - 0.5) * 2;
		r = Math.round(s2 * 255);
		g = Math.round((1 - s2) * 255);
		b = 0;
	}
	return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
