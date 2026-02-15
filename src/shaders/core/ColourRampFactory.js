// src/shaders/core/ColourRampFactory.js
import * as THREE from "three";

/**
 * ColourRampFactory generates 1D DataTexture objects for colour mapping in fragment shaders.
 * Each ramp is a 256×1 RGBA texture that maps normalized values [0,1] to RGB colors.
 *
 * Usage:
 *   var rampTexture = ColourRampFactory.create("ppv");
 *   // Use in shader: texture2D(uColourRamp, vec2(t, 0.5))
 */
export class ColourRampFactory {
    /**
     * Predefined colour ramps.
     * Each ramp is an array of RGB triplets [r,g,b] in range [0,1].
     * Values are linearly interpolated across the 256-pixel texture.
     */
    static RAMPS = {
        // PPV-style: green → yellow → orange → red
        "ppv": [[0, 0.8, 0], [0.5, 1, 0], [1, 1, 0], [1, 0.6, 0], [1, 0, 0]],

        // Jet: blue → cyan → green → yellow → red
        "jet": [[0, 0, 0.5], [0, 0, 1], [0, 1, 1], [0, 1, 0], [1, 1, 0], [1, 0, 0], [0.5, 0, 0]],

        // Viridis-style (scientific colormap)
        "viridis": [[0.267, 0.004, 0.329], [0.283, 0.141, 0.458], [0.127, 0.566, 0.551], [0.544, 0.774, 0.286], [0.993, 0.906, 0.144]],

        // Damage: blue (none) → green (cosmetic) → yellow (minor) → red (major) → dark red (crushing)
        "damage": [[0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 0, 0], [0.3, 0, 0]],

        // Compliance: green (ok) → yellow (marginal) → red (fail)
        "compliance": [[0, 0.8, 0], [1, 1, 0], [1, 0, 0]],

        // Greyscale
        "grey": [[0, 0, 0], [1, 1, 1]]
    };

    /**
     * Create a 256×1 DataTexture from a named ramp.
     *
     * @param {string} rampName - Key from RAMPS dictionary
     * @returns {THREE.DataTexture} - 256×1 RGBA texture for shader use
     */
    static create(rampName) {
        var stops = ColourRampFactory.RAMPS[rampName] || ColourRampFactory.RAMPS["jet"];
        var data = new Uint8Array(256 * 4);

        for (var i = 0; i < 256; i++) {
            var t = i / 255.0;
            var rgb = ColourRampFactory._interpolate(stops, t);
            data[i * 4 + 0] = Math.round(rgb[0] * 255);
            data[i * 4 + 1] = Math.round(rgb[1] * 255);
            data[i * 4 + 2] = Math.round(rgb[2] * 255);
            data[i * 4 + 3] = 255;
        }

        var tex = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        return tex;
    }

    /**
     * Linearly interpolate between color stops.
     *
     * @param {Array} stops - Array of [r,g,b] triplets
     * @param {number} t - Normalized position [0,1]
     * @returns {Array} - Interpolated [r,g,b]
     * @private
     */
    static _interpolate(stops, t) {
        var n = stops.length - 1;
        var idx = t * n;
        var lo = Math.floor(idx);
        var hi = Math.min(lo + 1, n);
        var frac = idx - lo;
        return [
            stops[lo][0] + (stops[hi][0] - stops[lo][0]) * frac,
            stops[lo][1] + (stops[hi][1] - stops[lo][1]) * frac,
            stops[lo][2] + (stops[hi][2] - stops[lo][2]) * frac
        ];
    }
}
