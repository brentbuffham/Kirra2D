// src/shaders/analytics/models/ScaledHeelanModel.js

/**
 * ScaledHeelanModel implements the Scaled Heelan model developed by Blair & Minchinton (2006).
 *
 * This model bridges the Original Heelan waveform model with the familiar charge weight
 * scaling law. Each elemental waveform has a peak particle velocity given by the site law,
 * while retaining the directional radiation patterns from the Original Heelan model.
 *
 * Reference: Blair & Minchinton (2006), "Near-field blast vibration models", Fragblast-8
 */
export class ScaledHeelanModel {
    constructor() {
        this.name = "scaled_heelan";
        this.displayName = "Scaled Heelan (Blair & Minchinton 2006)";
        this.unit = "mm/s";
        this.defaultColourRamp = "ppv";
        this.defaultMin = 0;
        this.defaultMax = 300;  // mm/s VPPV
    }

    /**
     * Scaled Heelan parameters.
     *
     * The key insight from Blair & Minchinton (2006) is that each charge
     * element of mass w_e produces a peak velocity at distance R given by:
     *
     *   vppv_element = K * (R / w_e^A)^(-B) * F(phi)
     *
     * where:
     *   K, B = site law constants (from regression of field data)
     *   A    = charge exponent (typically 0.5 for square-root scaling)
     *   w_e  = element mass (kg) = linear_density x dL
     *   R    = distance from element to observation point
     *   phi  = angle from hole axis to observation direction
     *   F(phi) = combined radiation pattern (retains Heelan directional structure)
     */
    getDefaultParams() {
        return {
            // Site law constants — calibrate from field PPV measurements
            K: 1140,                   // Site constant (intercept)
            B: 1.6,                    // Site exponent (slope, negative gradient)
            chargeExponent: 0.5,       // A — typically 0.5 (square-root) or 0.33 (cube-root)

            // Charge column discretisation
            numElements: 20,           // M — number of charge elements

            // Rock mass properties (for radiation pattern)
            pWaveVelocity: 4500,       // Vp, m/s — affects radiation pattern shape
            sWaveVelocity: 2600,       // Vs, m/s — affects radiation pattern shape
            detonationVelocity: 5500,  // VOD, m/s — fallback when no product VOD assigned

            // Radiation pattern weighting
            pWaveWeight: 1.0,          // Relative weight of P-wave contribution
            svWaveWeight: 1.0,         // Relative weight of SV-wave contribution

            // Distance limits
            cutoffDistance: 0.5,       // Minimum distance (m) to avoid singularity

            // Viscoelastic attenuation
            qualityFactorP: 50,        // Q_p (0 = no attenuation)
            qualityFactorS: 30         // Q_s (0 = no attenuation)
        };
    }

    /**
     * The Scaled Heelan fragment shader.
     *
     * For each hole:
     * 1. Read charge column bounds from Row 3 (actual charging data)
     *    - If charging data exists: use chargeTopDepth and chargeBaseDepth
     *    - If no charging data: fall back to 70% of hole length estimate
     * 2. Read per-hole VOD from Row 3, fall back to uniform uVOD if 0
     * 3. Divide the charge column into M elements starting from the bottom
     * 4. For each element:
     *    a. Compute distance R and angle phi to observation point
     *    b. Compute element PPV using site law with Blair's non-linear superposition
     *    c. Apply Heelan radiation patterns F1(phi), F2(phi)
     *    d. Decompose into radial and vertical velocity components
     * 5. Superpose all elements (envelope for static map)
     * 6. Take peak across all holes
     */
    getFragmentSource() {
        return `
            precision highp float;

            uniform sampler2D uHoleData;
            uniform int uHoleCount;
            uniform float uHoleDataWidth;

            // Site law constants
            uniform float uK;             // Site constant K
            uniform float uB;             // Site exponent B (attenuation slope)
            uniform float uChargeExp;     // Charge exponent A (0.5 or 0.33)

            // Rock and explosive properties
            uniform float uPWaveVel;      // Vp (m/s)
            uniform float uSWaveVel;      // Vs (m/s)
            uniform float uVOD;           // Fallback detonation velocity (m/s)
            uniform float uPWeight;       // P-wave weighting factor
            uniform float uSVWeight;      // SV-wave weighting factor

            // Discretisation
            uniform int uNumElements;     // M
            uniform float uCutoff;        // Minimum distance

            // Attenuation
            uniform float uQp;            // P-wave quality factor
            uniform float uQs;            // S-wave quality factor

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

            // Heelan P-wave radiation pattern
            // F1(phi) = sin(2*phi) * cos(phi)
            float F1(float sinPhi, float cosPhi) {
                return 2.0 * sinPhi * cosPhi * cosPhi;
            }

            // Heelan SV-wave radiation pattern
            // F2(phi) = sin(phi) * cos(2*phi)
            float F2(float sinPhi, float cosPhi) {
                return sinPhi * (2.0 * cosPhi * cosPhi - 1.0);
            }

            void main() {
                float peakVPPV = 0.0;

                for (int i = 0; i < 512; i++) {
                    if (i >= uHoleCount) break;

                    // Read from 4-row DataTexture layout:
                    // Row 0: [collarX, collarY, collarZ, totalChargeKg]
                    // Row 1: [toeX, toeY, toeZ, holeLength_m]
                    // Row 2: [MIC_kg, timing_ms, holeDiam_mm, unused]
                    // Row 3: [chargeTopDepth_m, chargeBaseDepth_m, vodMs, totalExplosiveMassKg]
                    vec4 collar = getHoleData(i, 0);
                    vec4 toe = getHoleData(i, 1);
                    vec4 props = getHoleData(i, 2);
                    vec4 charging = getHoleData(i, 3);

                    vec3 collarPos = collar.xyz;
                    vec3 toePos = toe.xyz;
                    float totalCharge = collar.w;        // kg
                    float holeLen = toe.w;                // m
                    float holeDiam = props.z;             // mm

                    // Charging data from Row 3
                    float chargeTopDepth = charging.x;    // m from collar (stemming length)
                    float chargeBaseDepth = charging.y;   // m from collar (bottom of charge)
                    float holeVOD = charging.z;           // m/s (0 = use uniform fallback)

                    if (totalCharge <= 0.0 || holeLen <= 0.0) continue;

                    // Use actual charge column bounds if available, else fall back to 70% estimate
                    float chargeLen;
                    float chargeStartOffset;  // distance from collar to start of charge
                    if (chargeBaseDepth > 0.0 && chargeBaseDepth > chargeTopDepth) {
                        chargeLen = chargeBaseDepth - chargeTopDepth;
                        chargeStartOffset = chargeTopDepth;
                    } else {
                        // Fallback: 70% of hole is charged, starting after 30% stemming
                        chargeLen = holeLen * 0.7;
                        chargeStartOffset = holeLen * 0.3;
                    }

                    // Per-hole VOD (from assigned product) or uniform fallback
                    float effectiveVOD = holeVOD > 0.0 ? holeVOD : uVOD;

                    float holeRadius = holeDiam * 0.0005;

                    // Hole axis from collar to toe (supports angled holes)
                    vec3 holeAxis = normalize(toePos - collarPos);

                    // Charge column start and end positions along hole axis
                    vec3 chargeStartPos = collarPos + holeAxis * chargeStartOffset;
                    vec3 chargeEndPos = collarPos + holeAxis * (chargeStartOffset + chargeLen);

                    // Element properties
                    float dL = chargeLen / float(uNumElements);
                    float elementMass = (totalCharge / chargeLen) * dL;  // w_e (kg)

                    // Superpose elemental contributions
                    float sumVr = 0.0;
                    float sumVz = 0.0;

                    for (int m = 0; m < 64; m++) {
                        if (m >= uNumElements) break;

                        // Element centre within charge column (from bottom up)
                        // Element 0 is at the bottom of charge, element M-1 is at the top
                        float elemOffset = (float(m) + 0.5) * dL;
                        vec3 elemPos = chargeEndPos - holeAxis * elemOffset;

                        // Vector and distance to observation point
                        vec3 toObs = vWorldPos - elemPos;
                        float R = max(length(toObs), uCutoff);

                        // Angle phi from hole axis
                        float cosPhi = abs(dot(normalize(toObs), holeAxis));
                        float sinPhi = sqrt(max(1.0 - cosPhi * cosPhi, 0.0));

                        // === BLAIR'S NON-LINEAR SUPERPOSITION (Blair 2008) ===
                        // Em = [m*we]^A - [(m-1)*we]^A
                        // This gives the incremental effective mass contribution of element m
                        float mwe = float(m + 1) * elementMass;      // (m+1)*we (m starts at 0)
                        float m1we = float(m) * elementMass;         // m*we
                        float Em = pow(mwe, uChargeExp) - pow(m1we, uChargeExp);

                        // Scaled distance using Em (not raw elementMass)
                        // SD = R / Em  (Em already has charge exponent applied)
                        float scaledDist = R / Em;

                        // PPV_element = K * SD^(-B)  [mm/s]
                        float vppvElement = uK * pow(scaledDist, -uB);

                        // Radiation patterns
                        float f1 = F1(sinPhi, cosPhi);
                        float f2 = F2(sinPhi, cosPhi);

                        // Viscoelastic attenuation (using per-hole VOD for frequency)
                        float attP = 1.0;
                        float attS = 1.0;
                        if (uQp > 0.0) {
                            float omega = effectiveVOD / (2.0 * holeRadius);
                            attP = exp(-omega * R / (2.0 * uQp * uPWaveVel));
                            attS = exp(-omega * R / (2.0 * uQs * uSWaveVel));
                        }

                        // P-wave and SV-wave velocity contributions
                        float vP  = vppvElement * f1 * uPWeight * attP;
                        float vSV = vppvElement * f2 * uSVWeight * attS;

                        // Resolve into radial and vertical components
                        sumVr += vP * sinPhi + vSV * cosPhi;
                        sumVz += vP * cosPhi - vSV * sinPhi;
                    }

                    // Vector peak particle velocity
                    float vppv = sqrt(sumVr * sumVr + sumVz * sumVz);
                    peakVPPV = max(peakVPPV, vppv);
                }

                float t = clamp((peakVPPV - uMinValue) / (uMaxValue - uMinValue), 0.0, 1.0);
                vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));
                colour.a *= uOpacity;

                if (peakVPPV < uMinValue * 0.01) discard;
                gl_FragColor = colour;
            }
        `;
    }

    getUniforms(params) {
        var p = Object.assign(this.getDefaultParams(), params || {});
        return {
            uK: { value: p.K },
            uB: { value: p.B },
            uChargeExp: { value: p.chargeExponent },
            uPWaveVel: { value: p.pWaveVelocity },
            uSWaveVel: { value: p.sWaveVelocity },
            uVOD: { value: p.detonationVelocity },
            uPWeight: { value: p.pWaveWeight },
            uSVWeight: { value: p.svWaveWeight },
            uNumElements: { value: p.numElements },
            uCutoff: { value: p.cutoffDistance },
            uQp: { value: p.qualityFactorP },
            uQs: { value: p.qualityFactorS }
        };
    }
}
