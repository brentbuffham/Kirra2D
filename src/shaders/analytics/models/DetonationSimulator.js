// src/shaders/analytics/models/DetonationSimulator.js

/**
 * DetonationSimulator computes per-element detonation times and Em values
 * for multi-primer charge columns.
 *
 * Uses Blair (2008) non-linear superposition generalised for arbitrary
 * primer configurations with front propagation and collision detection.
 *
 * Reference: Blair (2008), "Non-linear superposition models of blast vibration",
 *            Int J Rock Mech Min Sci 45, 235–247
 */

/**
 * Create charge elements for a column.
 *
 * @param {number} chargeLength - Length of charge column (m)
 * @param {number} totalMass - Total explosive mass (kg)
 * @param {number} numElements - Number of discretisation elements (M)
 * @returns {Array} Array of element objects
 */
function createElements(chargeLength, totalMass, numElements) {
	var dL = chargeLength / numElements;
	var elementMass = totalMass / numElements;
	var elements = [];

	for (var i = 0; i < numElements; i++) {
		// Element 0 = bottom of charge (toe end), element M-1 = top (collar end)
		// centreDepth measured from top of charge column downward
		var centreDepth = chargeLength - (i + 0.5) * dL;
		elements.push({
			index: i,
			centreDepth: centreDepth,
			mass: elementMass,
			detTime: Infinity,
			Em: 0
		});
	}

	return elements;
}

/**
 * Check if a detonation front from a primer is blocked by collision
 * with an adjacent primer's opposing front.
 *
 * @param {number} elemDepth - Depth of element along charge column
 * @param {Object} primer - The primer generating this front
 * @param {Array} sortedPrimers - All primers sorted by depth
 * @param {number} primerIndex - Index of primer in sortedPrimers
 * @param {number} vod - Velocity of detonation (m/s)
 * @returns {boolean} True if front is blocked
 */
function isFrontBlocked(elemDepth, primer, sortedPrimers, primerIndex, vod) {
	// Check collision with the primer above (smaller depth)
	if (elemDepth < primer.depthAlongColumn && primerIndex > 0) {
		var other = sortedPrimers[primerIndex - 1];
		// collisionDepth = midpoint + VOD × timeDifference correction
		var collisionDepth = (other.depthAlongColumn + primer.depthAlongColumn) / 2
			+ vod * (primer.fireTime - other.fireTime) / 2000;
		// Front from 'primer' going upward is blocked if element is above collision point
		if (elemDepth < collisionDepth) return true;
	}

	// Check collision with the primer below (larger depth)
	if (elemDepth > primer.depthAlongColumn && primerIndex < sortedPrimers.length - 1) {
		var other = sortedPrimers[primerIndex + 1];
		var collisionDepth = (primer.depthAlongColumn + other.depthAlongColumn) / 2
			+ vod * (other.fireTime - primer.fireTime) / 2000;
		// Front from 'primer' going downward is blocked if element is below collision point
		if (elemDepth > collisionDepth) return true;
	}

	return false;
}

/**
 * Simulate detonation front propagation for a charge column with
 * one or more primers.
 *
 * @param {Object} column - Charge column info
 * @param {number} column.chargeTopDepth - Distance from collar to top of charge (m)
 * @param {number} column.chargeBaseDepth - Distance from collar to bottom of charge (m)
 * @param {number} column.totalMass - Total explosive mass (kg)
 * @param {number} column.vod - Velocity of detonation (m/s)
 * @param {number} column.numElements - Number of discretisation elements (M)
 * @param {Array} column.primers - Array of {depthAlongColumn, fireTime} objects
 * @returns {Array} Array of element objects with detTime populated
 */
export function simulateDetonation(column) {
	var chargeLength = column.chargeBaseDepth - column.chargeTopDepth;
	if (chargeLength <= 0 || column.totalMass <= 0) return [];

	var elements = createElements(chargeLength, column.totalMass, column.numElements);

	// Ensure primers have depth relative to top of charge column
	var primers = column.primers;
	if (!primers || primers.length === 0) {
		// Default: single base primer (at bottom of charge column)
		primers = [{ depthAlongColumn: chargeLength, fireTime: 0 }];
	}

	// Sort primers by depth
	var sortedPrimers = primers.slice().sort(function (a, b) {
		return a.depthAlongColumn - b.depthAlongColumn;
	});

	// For each element, find earliest detonation arrival from any unblocked front
	for (var ei = 0; ei < elements.length; ei++) {
		var elem = elements[ei];
		var minTime = Infinity;

		for (var pi = 0; pi < sortedPrimers.length; pi++) {
			var primer = sortedPrimers[pi];
			var dist = Math.abs(elem.centreDepth - primer.depthAlongColumn);
			var arrivalTime = primer.fireTime + (dist / column.vod) * 1000; // ms

			// Check if this front is blocked by collision with adjacent primer's front
			if (!isFrontBlocked(elem.centreDepth, primer, sortedPrimers, pi, column.vod)) {
				minTime = Math.min(minTime, arrivalTime);
			}
		}

		elem.detTime = minTime;
	}

	return elements;
}

/**
 * Compute Em (non-linear superposition equivalent mass) values
 * for elements based on their detonation order.
 *
 * Uses Blair (2008) generalised cumulative mass approach:
 *   Em_group = cumulativeMass_after^A - cumulativeMass_before^A
 *   Em_per_element = Em_group / groupSize
 *
 * Invariant: Σ Em = totalMass^A
 *
 * @param {Array} elements - Array of element objects with detTime and mass populated
 * @param {number} chargeExponent - Exponent A (typically 0.5 to 0.8)
 * @returns {Array} Same elements array with Em values populated
 */
export function computeEmValues(elements, chargeExponent) {
	if (!elements || elements.length === 0) return elements;

	// Sort by detonation time (preserve original array)
	var sorted = elements.slice().sort(function (a, b) {
		return a.detTime - b.detTime;
	});

	// Group simultaneous detonations (within small tolerance)
	var tol = 0.01; // ms tolerance for simultaneous detonation
	var groups = [];
	var currentGroup = [sorted[0]];

	for (var i = 1; i < sorted.length; i++) {
		if (Math.abs(sorted[i].detTime - currentGroup[0].detTime) < tol) {
			currentGroup.push(sorted[i]);
		} else {
			groups.push(currentGroup);
			currentGroup = [sorted[i]];
		}
	}
	groups.push(currentGroup);

	// Compute Em per group using cumulative mass
	var cumulativeMass = 0;
	for (var gi = 0; gi < groups.length; gi++) {
		var group = groups[gi];
		var groupMass = 0;
		for (var j = 0; j < group.length; j++) {
			groupMass += group[j].mass;
		}

		var prevMass = cumulativeMass;
		cumulativeMass += groupMass;

		var groupEm = Math.pow(cumulativeMass, chargeExponent)
			- (prevMass > 0 ? Math.pow(prevMass, chargeExponent) : 0);

		// Split equally among simultaneously detonating elements
		var emPerElement = groupEm / group.length;
		for (var j = 0; j < group.length; j++) {
			group[j].Em = emPerElement;
		}
	}

	return elements; // Em values written back by reference
}

/**
 * Full pipeline: simulate detonation and compute Em values.
 *
 * @param {Object} column - Charge column info (see simulateDetonation)
 * @param {number} chargeExponent - Blair charge exponent A
 * @returns {Array} Array of element objects with detTime and Em
 */
export function processHoleDetonation(column, chargeExponent) {
	var elements = simulateDetonation(column);
	computeEmValues(elements, chargeExponent);
	return elements;
}
