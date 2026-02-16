// src/tools/flyrock/FlyrockCalculator.js

/**
 * FlyrockCalculator provides pure computation functions for flyrock range prediction.
 *
 * Three algorithms:
 *   1. Richards & Moore (2004) — empirical face burst / cratering / stem eject distances
 *   2. Lundborg (1981) — diameter-based maximum range
 *   3. McKenzie (2009/2022) — SDoB-based range + velocity prediction
 *
 * Reference: BRENTBUFFHAM_FlyrockShroud_Vulcan12Macros.pm (Perl lines 183-218)
 * Reference: McKenzie 2009 & 2022 PDFs
 *
 * No Three.js or DOM dependencies — pure math.
 */

var GRAVITY = 9.80665;
var PI = Math.PI;

/**
 * Richards & Moore flyrock distance calculations.
 *
 * From Perl reference (lines 183-192):
 *   faceBurst = (K²/g) × (√(massPerMetre)/burden)^2.6 × FoS
 *   cratering = (K²/g) × (√(massPerMetre)/stemming)^2.6 × FoS
 *   stemEject = cratering × sin(2×stemAngle) × FoS
 *
 * @param {Object} params
 * @param {number} params.holeDiameterMm - Hole diameter (mm)
 * @param {number} params.benchHeight - Bench height (m)
 * @param {number} params.stemmingLength - Stemming length (m)
 * @param {number} params.burden - Burden (m)
 * @param {number} params.subdrill - Subdrill (m)
 * @param {number} params.inholeDensity - Explosive density (kg/L), default 1.2
 * @param {number} params.K - Flyrock constant (default 20)
 * @param {number} params.factorOfSafety - Safety factor (default 2)
 * @param {number} params.stemEjectAngleDeg - Stem eject angle (degrees, default 80)
 * @returns {Object} { faceBurst, cratering, stemEject, maxDistance, maxVelocity, massPerMetre }
 */
export function richardsMoore(params) {
	var holeDiamMm = params.holeDiameterMm || 115;
	var benchHeight = params.benchHeight || 12;
	var stemming = params.stemmingLength || 2;
	var burden = params.burden || 3.6;
	var subdrill = params.subdrill || 1;
	var inholeDensity = params.inholeDensity || 1.2;
	var K = params.K || 20;
	var FoS = params.factorOfSafety || 2;
	var stemAngleDeg = params.stemEjectAngleDeg || 80;

	// Charge length and mass per metre (from Perl line 177-179)
	var chargeLength = benchHeight + subdrill - stemming;
	var radiusM = (holeDiamMm / 2) / 1000;
	var massPerMetre = PI * (radiusM * radiusM) * inholeDensity * 1000; // kg/m

	// Max horizontal distances (from Perl lines 183-192)
	var faceBurst = (Math.pow(K, 2) / GRAVITY) * Math.pow(Math.sqrt(massPerMetre) / burden, 2.6) * FoS;
	var cratering = (Math.pow(K, 2) / GRAVITY) * Math.pow(Math.sqrt(massPerMetre) / stemming, 2.6) * FoS;
	var stemEject = cratering * Math.sin(2 * stemAngleDeg * (PI / 180)) * FoS;

	var maxDistance = Math.max(faceBurst, cratering, stemEject);

	// Launch velocities (from Perl lines 200-206)
	var launchVelocityFB = Math.sqrt(faceBurst * GRAVITY);
	var launchVelocityCR = Math.sqrt((cratering * GRAVITY) / Math.sin(2 * 45 * (PI / 180)));
	var launchVelocitySE = Math.sqrt((stemEject * GRAVITY) / Math.sin(2 * stemAngleDeg * (PI / 180)));
	var maxVelocity = Math.max(launchVelocityFB, launchVelocityCR, launchVelocitySE);

	return {
		faceBurst: faceBurst,
		cratering: cratering,
		stemEject: stemEject,
		maxDistance: maxDistance,
		maxVelocity: maxVelocity,
		massPerMetre: massPerMetre,
		chargeLength: chargeLength
	};
}

/**
 * Envelope altitude at a given horizontal distance.
 * Chernigovskii trajectory (from Perl line 218):
 *   alt = (V⁴ - g²d²) / (2gV²)
 *
 * @param {number} distance - Horizontal distance from hole (m)
 * @param {number} maxVelocity - Maximum launch velocity (m/s)
 * @returns {number} - Altitude above collar (m), or 0 if beyond range
 */
export function envelopeAltitude(distance, maxVelocity) {
	var V2 = maxVelocity * maxVelocity;
	var V4 = V2 * V2;
	var g2d2 = GRAVITY * GRAVITY * distance * distance;

	if (V4 <= g2d2) return 0; // Beyond ballistic range

	return (V4 - g2d2) / (2 * GRAVITY * V2);
}

/**
 * Lundborg (1981) maximum flyrock range.
 * Simple diameter-based empirical formula.
 *
 * Range = 260 × d^(2/3)  where d is hole diameter in inches, range in metres.
 *
 * @param {number} holeDiameterMm - Hole diameter (mm)
 * @returns {number} - Maximum range (m)
 */
export function lundborg(holeDiameterMm) {
	var dInches = (holeDiameterMm || 115) / 25.4;
	return 260 * Math.pow(dInches, 2.0 / 3.0);
}

/**
 * McKenzie (2009/2022) SDoB-based flyrock prediction.
 *
 * SDoB = St / Wt_m^(1/3)                         [McKenzie 2022 Eq.4]
 * Kv = 0.0728 × SDoB^(-3.251)                    [McKenzie 2009 Eq.5]
 * Rangemax = 9.74 × (ø_mm / SDoB^2.167)^(2/3)   [McKenzie 2022 Eq.5]
 *
 * @param {Object} params
 * @param {number} params.holeDiameterMm - Hole diameter (mm)
 * @param {number} params.stemmingLength - Stemming (m)
 * @param {number} params.chargeLength - Charge column length (m)
 * @param {number} params.inholeDensity - Explosive density (kg/L)
 * @param {number} params.rockDensity - Rock density (kg/m³), default 2600
 * @param {number} params.factorOfSafety - Safety factor (default 2)
 * @returns {Object} { sdob, kv, rangeMax, clearance, v0 }
 */
export function mckenzie(params) {
	var holeDiamMm = params.holeDiameterMm || 115;
	var holeDiamM = holeDiamMm / 1000;
	var stemming = params.stemmingLength || 2;
	var chargeLen = params.chargeLength || 10;
	var inholeDensity = params.inholeDensity || 1.2;
	var rockDensity = params.rockDensity || 2600;
	var FoS = params.factorOfSafety || 2;

	// Contributing diameters: m = 10 for ø >= 100mm, 8 for smaller
	var m = holeDiamMm >= 100 ? 10 : 8;
	var contributingLen = Math.min(chargeLen, m * holeDiamM);

	// Mass per metre from hole geometry
	var radiusM = holeDiamM / 2;
	var massPerMetre = PI * radiusM * radiusM * inholeDensity * 1000; // kg/m

	// Contributing charge mass
	var Wt_m = massPerMetre * contributingLen;

	// SDoB = St / Wt_m^(1/3)
	var sdob = Wt_m > 0 ? stemming / Math.pow(Wt_m, 1.0 / 3.0) : 999;

	// Velocity coefficient (McKenzie 2009 Eq.5)
	var kv = sdob > 0 ? 0.0728 * Math.pow(sdob, -3.251) : 0;

	// Maximum range (McKenzie 2022 Eq.5)
	var rangeBase = sdob > 0 ? Math.pow(holeDiamMm / Math.pow(sdob, 2.167), 2.0 / 3.0) : 0;
	var rangeMax = 9.74 * rangeBase;

	// Clearance distance with safety factor
	var clearance = rangeMax * FoS;

	// Launch velocity derived from clearance range so envelope matches predicted distance
	var v0 = clearance > 0 ? Math.sqrt(clearance * GRAVITY) : 0;

	return {
		sdob: sdob,
		kv: kv,
		rangeMax: rangeMax,
		clearance: clearance,
		v0: v0,
		contributingMass: Wt_m,
		massPerMetre: massPerMetre
	};
}
