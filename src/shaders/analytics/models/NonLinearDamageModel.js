// src/shaders/analytics/models/NonLinearDamageModel.js

/**
 * NonLinearDamageModel implements the Holmberg-Persson near-field damage model.
 *
 * The Holmberg-Persson (H-P) approach integrates PPV contributions along the
 * full charge column of each hole, rather than treating each hole as a point
 * source. This captures the near-field effect where distance to individual
 * charge elements varies significantly along the column.
 *
 * For each hole the charge column is divided into M elements and each element
 * contributes:
 *   PPV_i = K * (q * dL)^α / R_i^β
 *
 * where q = linear charge density (kg/m), dL = element length (m),
 * R_i = distance from element centre to observation point, and K, α, β are
 * site-calibrated constants.
 *
 * Elements are summed incoherently (RMS) within each hole:
 *   PPV_hole = sqrt( Σ PPV_i² )
 *
 * The damage index is: DI = PPV_nearest_hole / PPV_critical
 * where PPV_critical is the threshold for crack initiation in the rock mass.
 *
 * Reference: Holmberg & Persson (1979), "Design of tunnel perimeter blasthole
 * patterns to prevent rock damage", Tunnelling and Underground Space Technology.
 */
export class NonLinearDamageModel {
    constructor() {
        this.name = "nonlinear_damage";
        this.displayName = "Holmberg-Persson Damage";
        this.unit = "DI";   // Damage Index 0-1
        this.defaultColourRamp = "damage";
        this.defaultMin = 0;
        this.defaultMax = 1.0;
    }

    /**
     * Holmberg-Persson near-field damage model parameters.
     *
     * PPV per element = K * (q * dL)^α / R^β
     *
     * Default K, α, β from NIOSH Modified H-P (Perimeter Blast Design):
     *   K = 700, α = 0.7, β = 1.5
     *
     * ppvCritical: Threshold PPV (mm/s) at which new crack initiation begins.
     * Typical range 700-1000 mm/s for competent rock.
     */
    getDefaultParams() {
        return {
            K_hp: 700,                 // H-P site constant
            alpha_hp: 0.7,             // H-P charge exponent
            beta_hp: 1.5,              // H-P distance exponent
            ppvCritical: 700,          // mm/s — PPV threshold for crack initiation
            numElements: 20,           // M — charge column discretisation
            cutoffDistance: 0.3        // Minimum distance (m) to avoid singularity
        };
    }

    /**
     * Fragment shader for Holmberg-Persson near-field damage calculation.
     *
     * For each hole:
     * 1. Read charge column bounds from Row 3 (chargeTopDepth, chargeBaseDepth)
     * 2. Divide charge column into M elements
     * 3. For each element: PPV_i = K * (q*dL)^α / R_i^β
     * 4. Incoherent (RMS) sum within hole: PPV_hole = sqrt(Σ PPV_i²)
     * 5. Take peak PPV across all holes (nearest hole dominates damage)
     * 6. Damage index = peakPPV / ppvCritical
     */
    getFragmentSource() {
        return `
            precision highp float;

            uniform sampler2D uHoleData;
            uniform int uHoleCount;
            uniform float uHoleDataWidth;

            // H-P site constants
            uniform float uK_hp;          // Site constant K
            uniform float uAlpha;         // Charge exponent α
            uniform float uBeta;          // Distance exponent β
            uniform float uPPVCritical;   // Critical PPV (mm/s)

            // Discretisation
            uniform int uNumElements;     // M — number of charge elements
            uniform float uCutoff;        // Minimum distance (m)

            // Colour mapping
            uniform sampler2D uColourRamp;
            uniform float uMinValue;
            uniform float uMaxValue;
            uniform float uOpacity;

            varying vec3 vWorldPos;

            vec4 getHoleData(int index, int row) {
                float u = (float(index) + 0.5) / uHoleDataWidth;
                float v = (float(row) + 0.5) / 4.0;  // 4 rows per hole
                return texture2D(uHoleData, vec2(u, v));
            }

            void main() {
                float peakPPV = 0.0;

                for (int i = 0; i < 512; i++) {
                    if (i >= uHoleCount) break;

                    // Read from 4-row DataTexture layout:
                    // Row 0: [collarX, collarY, collarZ, totalChargeKg]
                    // Row 1: [toeX, toeY, toeZ, holeLength_m]
                    // Row 2: [MIC_kg, timing_ms, holeDiam_mm, unused]
                    // Row 3: [chargeTopDepth_m, chargeBaseDepth_m, vodMs, totalExplosiveMassKg]
                    vec4 collar = getHoleData(i, 0);
                    vec4 toe = getHoleData(i, 1);
                    vec4 charging = getHoleData(i, 3);

                    vec3 collarPos = collar.xyz;
                    vec3 toePos = toe.xyz;
                    float totalCharge = collar.w;        // kg
                    float holeLen = toe.w;                // m

                    // Charging data from Row 3
                    float chargeTopDepth = charging.x;    // m from collar
                    float chargeBaseDepth = charging.y;   // m from collar

                    if (totalCharge <= 0.0 || holeLen <= 0.0) continue;

                    // Use actual charge column bounds if available, else fall back to 70% estimate
                    float chargeLen;
                    float chargeStartOffset;
                    if (chargeBaseDepth > 0.0 && chargeBaseDepth > chargeTopDepth) {
                        chargeLen = chargeBaseDepth - chargeTopDepth;
                        chargeStartOffset = chargeTopDepth;
                    } else {
                        chargeLen = holeLen * 0.7;
                        chargeStartOffset = holeLen * 0.3;
                    }

                    // Hole axis from collar to toe (supports angled holes)
                    vec3 holeAxis = normalize(toePos - collarPos);

                    // Charge column end position (bottom of charge)
                    vec3 chargeEndPos = collarPos + holeAxis * (chargeStartOffset + chargeLen);

                    // Element properties
                    float dL = chargeLen / float(uNumElements);
                    float linearChargeDensity = totalCharge / chargeLen;  // q (kg/m)
                    float elementCharge = linearChargeDensity * dL;       // q*dL (kg)

                    // Incoherent (RMS) sum of element contributions
                    float sumPPVsq = 0.0;

                    for (int m = 0; m < 64; m++) {
                        if (m >= uNumElements) break;

                        // Element centre (from bottom up, same convention as Scaled Heelan)
                        float elemOffset = (float(m) + 0.5) * dL;
                        vec3 elemPos = chargeEndPos - holeAxis * elemOffset;

                        // Distance from element to observation point
                        float R = max(length(vWorldPos - elemPos), uCutoff);

                        // Holmberg-Persson per element: PPV_i = K * (q*dL)^α / R^β
                        float ppvElem = uK_hp * pow(elementCharge, uAlpha) * pow(R, -uBeta);

                        sumPPVsq += ppvElem * ppvElem;
                    }

                    // RMS PPV for this hole
                    float holePPV = sqrt(sumPPVsq);

                    // Peak across all holes (nearest hole dominates damage)
                    peakPPV = max(peakPPV, holePPV);
                }

                // Damage index: ratio of peak PPV to critical PPV
                float damageIndex = clamp(peakPPV / uPPVCritical, 0.0, 1.0);

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
            uK_hp: { value: p.K_hp },
            uAlpha: { value: p.alpha_hp },
            uBeta: { value: p.beta_hp },
            uPPVCritical: { value: p.ppvCritical },
            uNumElements: { value: p.numElements },
            uCutoff: { value: p.cutoffDistance }
        };
    }
}
