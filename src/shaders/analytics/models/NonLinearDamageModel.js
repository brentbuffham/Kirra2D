// src/shaders/analytics/models/NonLinearDamageModel.js

/**
 * NonLinearDamageModel implements the Holmberg-Persson damage model.
 *
 * Computes cumulative damage index based on PPV threshold. The damage index
 * represents the ratio of cumulative PPV to critical PPV threshold for crack
 * initiation and propagation.
 */
export class NonLinearDamageModel {
    constructor() {
        this.name = "nonlinear_damage";
        this.displayName = "Non-Linear Blast Damage";
        this.unit = "DI";   // Damage Index 0-1
        this.defaultColourRamp = "damage";
        this.defaultMin = 0;
        this.defaultMax = 1.0;
    }

    /**
     * Holmberg-Persson damage model parameters.
     */
    getDefaultParams() {
        return {
            // Holmberg-Persson damage model parameters
            rockUCS: 120,              // MPa — Unconfined Compressive Strength
            rockTensile: 12,           // MPa — Tensile Strength
            rockDensity: 2700,         // kg/m³
            pWaveVelocity: 4500,       // m/s
            crackVelocity: 2000,       // m/s (Rayleigh wave)
            K_hp: 700,                 // H-P site constant
            alpha_hp: 0.8,             // H-P alpha (charge length exponent)
            beta_hp: 1.4,              // H-P beta (distance exponent)
            ppvCritical: 700,          // mm/s — PPV threshold for new crack initiation
            cutoffDistance: 0.3
        };
    }

    /**
     * Fragment shader for damage index calculation.
     *
     * Computes cumulative PPV from all holes and calculates damage index
     * as the ratio to critical PPV threshold.
     */
    getFragmentSource() {
        return `
            precision highp float;

            uniform sampler2D uHoleData;
            uniform int uHoleCount;
            uniform float uHoleDataWidth;
            uniform float uRockUCS;
            uniform float uRockTensile;
            uniform float uPPVCritical;
            uniform float uK_hp;
            uniform float uAlpha;
            uniform float uBeta;
            uniform float uCutoff;
            uniform sampler2D uColourRamp;
            uniform float uMinValue;
            uniform float uMaxValue;
            uniform float uOpacity;

            varying vec3 vWorldPos;

            vec4 getHoleData(int index, int row) {
                float u = (float(index) + 0.5) / uHoleDataWidth;
                float v = (float(row) + 0.5) / 2.0;
                return texture2D(uHoleData, vec2(u, v));
            }

            void main() {
                // Cumulative damage from all holes
                float cumulativePPV = 0.0;
                float peakPPV = 0.0;

                for (int i = 0; i < 512; i++) {
                    if (i >= uHoleCount) break;

                    vec4 posCharge = getHoleData(i, 0);
                    vec4 holeProps = getHoleData(i, 1);

                    vec3 holePos = posCharge.xyz;
                    float charge = posCharge.w;
                    float holeLen = holeProps.w;

                    if (charge <= 0.0) continue;

                    float dist = max(distance(vWorldPos, holePos), uCutoff);

                    // Holmberg-Persson: PPV from each charge element
                    // Simplified: treat each hole as single charge
                    float linearCharge = holeLen > 0.0 ? charge / holeLen : charge;
                    float ppv = uK_hp * pow(linearCharge, uAlpha) * pow(dist, -uBeta);

                    peakPPV = max(peakPPV, ppv);
                    cumulativePPV += ppv;
                }

                // Damage index: ratio of cumulative PPV to critical PPV
                float damageIndex = clamp(cumulativePPV / uPPVCritical, 0.0, 1.0);

                float t = clamp((damageIndex - uMinValue) / (uMaxValue - uMinValue), 0.0, 1.0);
                vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));
                colour.a *= uOpacity;

                if (damageIndex < 0.01) discard;
                gl_FragColor = colour;
            }
        `;
    }

    getUniforms(params) {
        var p = Object.assign(this.getDefaultParams(), params || {});
        return {
            uRockUCS: { value: p.rockUCS },
            uRockTensile: { value: p.rockTensile },
            uPPVCritical: { value: p.ppvCritical },
            uK_hp: { value: p.K_hp },
            uAlpha: { value: p.alpha_hp },
            uBeta: { value: p.beta_hp },
            uCutoff: { value: p.cutoffDistance }
        };
    }
}
