/**
 * @fileoverview ChargingRemapper - Remap loadedCharging keys when holeIDs change
 *
 * When holes are renumbered, reordered, or renamed, the charging data
 * (keyed by holeID in window.loadedCharging) must follow the hole.
 */

/**
 * Remap window.loadedCharging map keys when holeIDs change.
 * Moves each entry from old key to new key and updates hc.holeID.
 *
 * @param {Map<string, string>} idRemapMap - Map of oldHoleID -> newHoleID (plain holeIDs)
 */
export function remapChargingKeys(idRemapMap) {
	if (!idRemapMap || idRemapMap.size === 0) return;
	if (!window.loadedCharging || window.loadedCharging.size === 0) return;

	var remapped = 0;

	// Collect all entries to move first (avoid mutating map during iteration)
	var toMove = [];
	idRemapMap.forEach(function(newID, oldID) {
		if (window.loadedCharging.has(oldID)) {
			toMove.push({ oldID: oldID, newID: newID });
		}
	});

	// Move entries
	for (var i = 0; i < toMove.length; i++) {
		var entry = toMove[i];
		var hc = window.loadedCharging.get(entry.oldID);

		// Update holeID on the HoleCharging object itself
		hc.holeID = entry.newID;

		// Update holeID on each deck
		if (hc.decks) {
			for (var d = 0; d < hc.decks.length; d++) {
				hc.decks[d].holeID = entry.newID;
			}
		}

		// Update holeID on each primer
		if (hc.primers) {
			for (var p = 0; p < hc.primers.length; p++) {
				hc.primers[p].holeID = entry.newID;
			}
		}

		// Move from old key to new key
		window.loadedCharging.delete(entry.oldID);
		window.loadedCharging.set(entry.newID, hc);
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

/**
 * Extract plain holeID remap map from an entityName:::holeID format remap map.
 * Used by ReorderRowsTool and RenumberHolesTool which store keys as "entity:::id".
 *
 * @param {Map<string, string>} combinedIdRemapMap - Map of "entity:::oldID" -> "entity:::newID"
 * @returns {Map<string, string>} Map of oldHoleID -> newHoleID (plain IDs)
 */
export function extractPlainIdRemap(combinedIdRemapMap) {
	var plainMap = new Map();
	combinedIdRemapMap.forEach(function(newCombined, oldCombined) {
		var oldParts = oldCombined.split(":::");
		var newParts = newCombined.split(":::");
		var oldID = oldParts.length === 2 ? oldParts[1] : oldCombined;
		var newID = newParts.length === 2 ? newParts[1] : newCombined;
		if (oldID !== newID) {
			plainMap.set(oldID, newID);
		}
	});
	return plainMap;
}
