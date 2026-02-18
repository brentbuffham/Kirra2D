// src/shaders/analytics/models/ElementDataPacker.js
import * as THREE from "three";

/**
 * ElementDataPacker packs per-element Em and detonation time values
 * into a Float DataTexture for use in GPU fragment shaders.
 *
 * Texture layout:
 *   Width  = maxElements (e.g., 64)
 *   Height = holeCount
 *   Format = RG Float
 *   R channel = Em value for this element
 *   G channel = detonation time (ms) for this element (-1 = no element)
 *
 * Shader lookup:
 *   vec2 elemData = texture2D(uElementData, vec2(
 *       (float(elemIndex) + 0.5) / float(uMaxElements),
 *       (float(holeIndex) + 0.5) / float(holeCount)
 *   )).rg;
 *   float Em = elemData.r;
 *   float detTime = elemData.g;
 */

/**
 * Pack element data for all holes into a DataTexture.
 *
 * @param {Array} allHoleElements - Array of arrays: allHoleElements[holeIndex] = [{Em, detTime}, ...]
 * @param {number} maxElements - Width of texture (max elements per hole, e.g. 64)
 * @param {number} holeCount - Number of holes (height of texture)
 * @returns {THREE.DataTexture} RG Float texture with Em and detTime per element
 */
export function packElementData(allHoleElements, maxElements, holeCount) {
	// RG float texture: 2 channels per texel
	var data = new Float32Array(maxElements * holeCount * 2);

	for (var h = 0; h < holeCount; h++) {
		var elements = allHoleElements[h] || [];
		for (var m = 0; m < maxElements; m++) {
			var idx = (h * maxElements + m) * 2;
			if (m < elements.length) {
				// Store in original spatial order (element 0 = bottom)
				data[idx] = elements[m].Em;          // R channel
				data[idx + 1] = elements[m].detTime; // G channel
			} else {
				data[idx] = 0.0;
				data[idx + 1] = -1.0;  // sentinel: no element
			}
		}
	}

	var tex = new THREE.DataTexture(
		data,
		maxElements,
		holeCount,
		THREE.RGFormat,
		THREE.FloatType
	);
	tex.minFilter = THREE.NearestFilter;
	tex.magFilter = THREE.NearestFilter;
	tex.needsUpdate = true;
	return tex;
}

/**
 * Create uniforms for element data texture.
 *
 * @param {THREE.DataTexture} elementTexture - Texture from packElementData
 * @param {number} maxElements - Width of texture
 * @returns {Object} Uniform definitions for shader material
 */
export function getElementDataUniforms(elementTexture, maxElements) {
	return {
		uElementData: { value: elementTexture },
		uMaxElements: { value: maxElements },
		uDisplayTime: { value: -1.0 }  // -1 = show all (no time filtering)
	};
}
