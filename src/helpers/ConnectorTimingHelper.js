// src/helpers/ConnectorTimingHelper.js
// ============================================================
// Pure math helpers for surface connector VOD travel time.
// Created: 2026-02-15
// ============================================================

/**
 * Calculate the 3D collar-to-collar distance between two blast holes.
 * @param {Object} fromHole - Source hole (needs startXLocation, startYLocation, startZLocation)
 * @param {Object} toHole - Target hole (needs startXLocation, startYLocation, startZLocation)
 * @returns {number} Distance in metres
 */
export function calculateCollarDistance3D(fromHole, toHole) {
	var dx = toHole.startXLocation - fromHole.startXLocation;
	var dy = toHole.startYLocation - fromHole.startYLocation;
	var dz = toHole.startZLocation - fromHole.startZLocation;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate the travel time (ms) for a surface connector given distance and VOD.
 * Returns 0 if vodMs is 0 or falsy (manual delay mode — no travel time).
 * @param {number} distance3D - Collar-to-collar distance in metres
 * @param {number} vodMs - Velocity of detonation in m/s (0 = no travel time)
 * @returns {number} Travel time in milliseconds
 */
export function calculateConnectorTravelTimeMs(distance3D, vodMs) {
	if (!vodMs || vodMs <= 0) return 0;
	return (distance3D / vodMs) * 1000;
}
