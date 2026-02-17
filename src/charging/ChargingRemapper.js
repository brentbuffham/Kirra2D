/**
 * @fileoverview ChargingRemapper - Remap loadedCharging keys when holeIDs change
 *
 * When holes are renumbered, reordered, or renamed, the charging data
 * (keyed by entityName:::holeID in window.loadedCharging) must follow the hole.
 */

import { chargingKey } from "./HoleCharging.js";

/**
 * Remap window.loadedCharging map keys when holeIDs change.
 * Keys are composite: "entityName:::holeID".
 * Accepts a map of oldCompositeKey -> newCompositeKey.
 *
 * @param {Map<string, string>} idRemapMap - Map of "entity:::oldID" -> "entity:::newID"
 */
export function remapChargingKeys(idRemapMap) {
	if (!idRemapMap || idRemapMap.size === 0) return;
	if (!window.loadedCharging || window.loadedCharging.size === 0) return;

	var remapped = 0;

	// Collect all entries to move first (avoid mutating map during iteration)
	var toMove = [];
	idRemapMap.forEach(function(newKey, oldKey) {
		if (window.loadedCharging.has(oldKey)) {
			toMove.push({ oldKey: oldKey, newKey: newKey });
		}
	});

	// Move entries
	for (var i = 0; i < toMove.length; i++) {
		var entry = toMove[i];
		var hc = window.loadedCharging.get(entry.oldKey);

		// Extract new holeID from composite key
		var newParts = entry.newKey.split(":::");
		var newID = newParts.length === 2 ? newParts[1] : entry.newKey;

		// Update holeID on the HoleCharging object itself
		hc.holeID = newID;

		// Update holeID on each deck
		if (hc.decks) {
			for (var d = 0; d < hc.decks.length; d++) {
				hc.decks[d].holeID = newID;
			}
		}

		// Update holeID on each primer
		if (hc.primers) {
			for (var p = 0; p < hc.primers.length; p++) {
				hc.primers[p].holeID = newID;
			}
		}

		// Move from old key to new key
		window.loadedCharging.delete(entry.oldKey);
		window.loadedCharging.set(entry.newKey, hc);
		remapped++;
	}

	if (remapped > 0) {
		console.log("ChargingRemapper: Remapped", remapped, "charging entries");

		// Persist updated charging to IndexedDB via window wrapper (closes over db ref)
		if (typeof window.debouncedSaveCharging === "function") {
			window.debouncedSaveCharging();
		}
	}
}
