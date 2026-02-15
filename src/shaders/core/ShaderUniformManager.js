// src/shaders/core/ShaderUniformManager.js
import * as THREE from "three";

/**
 * ShaderUniformManager packs blast hole data into DataTextures for GPU consumption.
 *
 * Layout: Each hole occupies 3 pixels (12 floats total) in a 512×3 RGBA float texture.
 *
 * Pixel 0 (Row 0): [collarX, collarY, collarZ, totalChargeKg]
 * Pixel 1 (Row 1): [toeX, toeY, toeZ, holeLength_m]
 * Pixel 2 (Row 2): [MIC_kg, timing_ms, holeDiam_mm, unused]
 *
 * This enables reactive updates — when a hole moves or charge changes, only the
 * relevant texels are updated, avoiding full repack.
 */
export class ShaderUniformManager {
    /**
     * @param {number} maxHoles - Maximum number of holes to support (default 512)
     */
    constructor(maxHoles) {
        this.maxHoles = maxHoles || 512;

        // DataTexture layout: each hole occupies 3 pixels (12 floats)
        // Pixel 0: [collarX, collarY, collarZ, totalChargeKg]
        // Pixel 1: [toeX, toeY, toeZ, holeLength_m]
        // Pixel 2: [MIC_kg, timing_ms, holeDiam_mm, unused]
        this.textureWidth = this.maxHoles;
        this.textureHeight = 3;
        this.data = new Float32Array(this.textureWidth * this.textureHeight * 4);
        this.texture = null;
        this.holeCount = 0;
    }

    /**
     * Build or rebuild the data texture from an array of blast holes.
     *
     * @param {Array} holes - allBlastHoles array from Kirra
     * @param {Object} options - { useToeLocation: bool }
     * @returns {THREE.DataTexture}
     */
    packHoles(holes, options) {
        this.holeCount = Math.min(holes.length, this.maxHoles);
        this.data.fill(0);

        for (var i = 0; i < this.holeCount; i++) {
            var h = holes[i];
            var baseIdx = i * 4; // pixel 0 of this hole (row 0)

            // Row 0: collar position + total charge
            this.data[baseIdx + 0] = h.startXLocation || 0;
            this.data[baseIdx + 1] = h.startYLocation || 0;
            this.data[baseIdx + 2] = h.startZLocation || 0;
            this.data[baseIdx + 3] = parseFloat(h.measuredMass) || 0;

            // Row 1: toe position + hole length
            var row1Idx = (this.textureWidth * 4) + (i * 4);
            this.data[row1Idx + 0] = h.endXLocation || h.startXLocation || 0;
            this.data[row1Idx + 1] = h.endYLocation || h.startYLocation || 0;
            this.data[row1Idx + 2] = h.endZLocation || h.startZLocation || 0;
            this.data[row1Idx + 3] = parseFloat(h.holeLengthCalculated) || 0;

            // Row 2: MIC, timing, diameter, unused
            var row2Idx = (this.textureWidth * 2 * 4) + (i * 4);
            this.data[row2Idx + 0] = this._getMIC(h);       // Max Instantaneous Charge
            this.data[row2Idx + 1] = this._parseHoleTime(h.holeTime) || 0;  // firing time ms
            this.data[row2Idx + 2] = parseFloat(h.holeDiameter) || 115;
            this.data[row2Idx + 3] = 0; // unused
        }

        if (!this.texture) {
            this.texture = new THREE.DataTexture(
                this.data,
                this.textureWidth,
                this.textureHeight,
                THREE.RGBAFormat,
                THREE.FloatType
            );
            this.texture.minFilter = THREE.NearestFilter;
            this.texture.magFilter = THREE.NearestFilter;
            this.texture.needsUpdate = true;
        } else {
            this.texture.image.data.set(this.data);
            this.texture.needsUpdate = true;
        }

        return this.texture;
    }

    /**
     * Update a single hole (for drag operations — avoids full repack).
     *
     * @param {number} index - Hole index in array
     * @param {Object} hole - Updated hole object
     * @param {Object} options - { useToeLocation: bool }
     */
    updateHole(index, hole, options) {
        if (index >= this.holeCount) return;
        var useToe = options && options.useToeLocation;
        var baseIdx = index * 4;

        this.data[baseIdx + 0] = useToe ? (hole.endXLocation || hole.startXLocation) : hole.startXLocation;
        this.data[baseIdx + 1] = useToe ? (hole.endYLocation || hole.startYLocation) : hole.startYLocation;
        this.data[baseIdx + 2] = useToe ? (hole.endZLocation || hole.startZLocation) : hole.startZLocation;
        this.data[baseIdx + 3] = parseFloat(hole.measuredMass) || 0;

        // Update row 1 as well (in case charge changed)
        var row1Idx = (this.textureWidth * 4) + (index * 4);
        this.data[row1Idx + 0] = this._getMIC(hole);
        this.data[row1Idx + 1] = this._parseHoleTime(hole.holeTime) || 0;

        this.texture.needsUpdate = true;
    }

    /**
     * Calculate MIC (Maximum Instantaneous Charge) for a hole.
     * This is the largest single deck charge mass — used for PPV calculations.
     *
     * @param {Object} hole - Blast hole object
     * @returns {number} - MIC in kg
     * @private
     */
    _getMIC(hole) {
        // If charging data exists, find the largest explosive deck
        if (window.loadedCharging && window.loadedCharging.has(hole.holeID)) {
            var charging = window.loadedCharging.get(hole.holeID);
            if (charging && charging.decks) {
                var maxDeckMass = 0;
                charging.decks.forEach(function(deck) {
                    if (deck.deckType === "COUPLED" || deck.deckType === "DECOUPLED") {
                        var deckMass = parseFloat(deck.calculateMass(hole.holeDiameter)) || 0;
                        if (deckMass > maxDeckMass) maxDeckMass = deckMass;
                    }
                });
                if (maxDeckMass > 0) return maxDeckMass;
            }
        }
        // Fallback: total measured mass (single-deck assumption)
        return parseFloat(hole.measuredMass) || 0;
    }

    /**
     * Parse hole.holeTime to milliseconds.
     * Format can be: "Delay: 500ms" or "0ms" or number
     *
     * @param {string|number} holeTime - Hole timing string or number
     * @returns {number} - Time in milliseconds
     * @private
     */
    _parseHoleTime(holeTime) {
        if (typeof holeTime === "number") return holeTime;
        if (typeof holeTime === "string") {
            var match = holeTime.match(/(\d+)/);
            if (match) return parseFloat(match[1]);
        }
        return 0;
    }

    /**
     * Dispose of resources.
     */
    dispose() {
        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }
        this.data = null;
    }
}
