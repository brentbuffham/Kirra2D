// src/helpers/TransformMath.js
//=============================================================
// TRANSFORM MATH UTILITIES
//=============================================================
// Rotation and translation math for Transform Tool
// Created: 2026-02-03

import * as THREE from "three";

/**
 * Rotate a point around a pivot using Euler angles (YXZ order)
 * Kirra coordinate system: Z-up, X-East, Y-North
 * Bearing: 0=North, 90=East (clockwise from above)
 *
 * @param {Object} point - {x, y, z} point to rotate
 * @param {Object} pivot - {x, y, z} pivot point
 * @param {number} bearingRad - Rotation around Z-axis (Yaw) in radians
 * @param {number} pitchRad - Rotation around X-axis in radians
 * @param {number} rollRad - Rotation around Y-axis in radians
 * @returns {Object} - {x, y, z} rotated point
 */
export function rotatePointAroundPivot(point, pivot, bearingRad, pitchRad, rollRad) {
	// Kirra coordinate system: Z-up, X-East, Y-North
	// Bearing: 0=North, 90=East (CLOCKWISE from above)
	// Three.js: positive rotation is COUNTER-CLOCKWISE
	// So we negate bearing to make clockwise positive

	// In Kirra Z-up system:
	// - Bearing (Yaw) = rotation around Z axis (negated for clockwise)
	// - Pitch = rotation around X axis
	// - Roll = rotation around Y axis

	// Create rotation using quaternion for precision
	// Negate bearingRad so positive = clockwise when viewed from above
	const euler = new THREE.Euler(pitchRad, rollRad, -bearingRad, "ZYX");
	const quaternion = new THREE.Quaternion().setFromEuler(euler);

	// Translate point to origin (relative to pivot)
	const relativePoint = new THREE.Vector3(
		point.x - pivot.x,
		point.y - pivot.y,
		point.z - pivot.z
	);

	// Apply rotation
	relativePoint.applyQuaternion(quaternion);

	// Translate back
	return {
		x: relativePoint.x + pivot.x,
		y: relativePoint.y + pivot.y,
		z: relativePoint.z + pivot.z
	};
}

/**
 * Apply full transform (translation + rotation) to a point
 * Order: Rotate first (around pivot), then translate
 *
 * @param {Object} point - {x, y, z} point to transform
 * @param {Object} pivot - {x, y, z} pivot point for rotation
 * @param {Object} translation - {x, y, z} translation to apply
 * @param {Object} rotation - {bearing, pitch, roll} rotation in radians
 * @returns {Object} - {x, y, z} transformed point
 */
export function applyTransform(point, pivot, translation, rotation) {
	// First rotate around pivot
	const rotated = rotatePointAroundPivot(
		point,
		pivot,
		rotation.bearing || 0,
		rotation.pitch || 0,
		rotation.roll || 0
	);

	// Then translate
	return {
		x: rotated.x + (translation.x || 0),
		y: rotated.y + (translation.y || 0),
		z: rotated.z + (translation.z || 0)
	};
}

/**
 * Recalculate blast hole geometry (bearing, angle, length) from collar/toe positions
 * Call after transforming a hole to update derived attributes
 *
 * @param {Object} hole - Blast hole object with startX/Y/Z, endX/Y/Z
 */
export function recalculateHoleGeometry(hole) {
	// Calculate delta from collar to toe
	const dx = hole.endXLocation - hole.startXLocation;
	const dy = hole.endYLocation - hole.startYLocation;
	const dz = hole.endZLocation - hole.startZLocation;

	// Calculate hole length (3D distance)
	const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
	hole.holeLengthCalculated = length;

	// Calculate bearing (0 = North, clockwise)
	// atan2(dx, dy) gives angle from Y-axis (North)
	let bearing = Math.atan2(dx, dy) * 180 / Math.PI;
	if (bearing < 0) bearing += 360;
	hole.holeBearing = bearing;

	// Calculate angle from vertical (0 = vertical down, 90 = horizontal)
	// Vertical drop is negative dz (going down)
	const horizontalDistance = Math.sqrt(dx * dx + dy * dy);
	const verticalDrop = -dz; // Positive when toe is below collar

	if (length > 0.0001) {
		// Angle from vertical = acos(verticalDrop / length)
		const angleRad = Math.acos(Math.abs(verticalDrop) / length);
		hole.holeAngle = angleRad * 180 / Math.PI;
	} else {
		hole.holeAngle = 0;
	}

	return hole;
}

/**
 * Calculate centroid from an array of points
 *
 * @param {Array} points - Array of {x, y, z} points
 * @returns {Object|null} - {x, y, z} centroid or null if no points
 */
export function calculateCentroid(points) {
	if (!points || points.length === 0) return null;

	let sumX = 0, sumY = 0, sumZ = 0;
	let count = 0;

	for (const point of points) {
		if (point && typeof point.x === "number" && typeof point.y === "number") {
			sumX += point.x;
			sumY += point.y;
			sumZ += point.z || 0;
			count++;
		}
	}

	if (count === 0) return null;

	return {
		x: sumX / count,
		y: sumY / count,
		z: sumZ / count
	};
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} radians
 */
export function degreesToRadians(degrees) {
	return degrees * Math.PI / 180;
}

/**
 * Convert radians to degrees
 * @param {number} radians
 * @returns {number} degrees
 */
export function radiansToDegrees(radians) {
	return radians * 180 / Math.PI;
}

/**
 * Normalize bearing to 0-360 range
 * @param {number} bearing - Bearing in degrees
 * @returns {number} - Normalized bearing (0-360)
 */
export function normalizeBearing(bearing) {
	let normalized = bearing % 360;
	if (normalized < 0) normalized += 360;
	return normalized;
}
