/**
 * ChargingMassHelper.js
 * Utility to recalculate massPerHole from the charging system.
 */

import { chargingKey } from "../charging/HoleCharging.js";

/**
 * Recalculate massPerHole for all blast holes from loadedCharging.
 * @param {Array} allBlastHoles - Array of blast hole objects
 * @param {Map} loadedCharging - Map of chargingKey -> HoleCharging
 */
export function recalcMassPerHole(allBlastHoles, loadedCharging) {
    if (!allBlastHoles) return;
    for (var i = 0; i < allBlastHoles.length; i++) {
        var hole = allBlastHoles[i];
        var charging = loadedCharging ? loadedCharging.get(chargingKey(hole)) : null;
        if (charging && typeof charging.getTotalExplosiveMass === "function") {
            hole.massPerHole = charging.getTotalExplosiveMass();
        } else {
            hole.massPerHole = 0;
        }
    }
}
