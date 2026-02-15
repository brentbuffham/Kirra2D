// src/shaders/analytics/models/HeelanOriginalModel.js

/**
 * HeelanOriginalModel implements the Original Heelan model based on Heelan's (1953)
 * analytical solution as formulated by Blair & Minchinton (1996).
 *
 * The model divides the charge column into M elements and computes P-wave and SV-wave
 * contributions with radiation patterns F1(phi) and F2(phi).
 *
 * Reference: Blair & Minchinton (1996), "On the damage zone surrounding a single
 * blasthole", Fragblast-5
 */
export class HeelanOriginalModel {
    constructor() {
        this.name = "heelan_original";
        this.displayName = "Heelan Original (Blair & Minchinton 1996)";
        this.unit = "mm/s";
        this.defaultColourRamp = "jet";
        this.defaultMin = 0;
        this.defaultMax = 300;   // mm/s VPPV
    }

    /**
     * Parameters for the Original Heelan model.
     *
     * The Heelan solution models each elemental charge as a pressurised
     * cylindrical cavity of length dL and radius a. The far-field displacement
     * for each element has P and SV components:
     *
     *   u_P(R, phi)  ~ (Pb * a^2 * dL) / (rho * Vp^2 * R) * F1(phi)
     *   u_SV(R, phi) ~ (Pb * a^2 * dL) / (rho * Vs^2 * R) * F2(phi)
     *
     * where:
     *   Pb  = borehole wall pressure
     *   a   = borehole radius
     *   rho = rock density
     *   Vp  = P-wave velocity
     *   Vs  = S-wave velocity
     *   R   = distance from element to observation point
     *   phi = angle between hole axis and direction to observation point
     *   F1  = P-wave radiation pattern function
     *   F2  = SV-wave radiation pattern function
     */
    getDefaultParams() {
        return {
            rockDensity: 2700,         // rho, kg/m^3
            pWaveVelocity: 4500,       // Vp, m/s
            sWaveVelocity: 2600,       // Vs, m/s
            detonationVelocity: 5500,  // VOD, m/s — fallback when no product VOD assigned
            boreholePressure: 0,       // Pb, Pa (0 = auto-calculate)
            numElements: 20,           // M — number of charge elements for integration
            cutoffDistance: 0.5,       // minimum distance, m
            // Viscoelastic attenuation (Blair & Minchinton 2006 extension)
            qualityFactorP: 50,        // Q_p — P-wave quality factor (0 = elastic)
            qualityFactorS: 30         // Q_s — S-wave quality factor (0 = elastic)
        };
    }

    /**
     * The fragment shader implements the Heelan elemental superposition.
     *
     * Reads actual charging data from Row 3 of the data texture:
     *   - Charge column bounds (chargeTopDepth, chargeBaseDepth)
     *   - Per-hole product VOD
     * Falls back to 70% estimate and uniform VOD when no charging data exists.
     *
     * Radiation pattern functions (Heelan 1953):
     *   F1(phi) = sin(2*phi) * cos(phi)     — P-wave (radial-vertical plane)
     *   F2(phi) = sin(phi) * cos(2*phi)     — SV-wave (radial-vertical plane)
     */
    getFragmentSource() {
        return `
            precision highp float;

            uniform sampler2D uHoleData;
            uniform int uHoleCount;
            uniform float uHoleDataWidth;

            // Rock mass properties
            uniform float uRockDensity;    // rho (kg/m^3)
            uniform float uPWaveVel;       // Vp (m/s)
            uniform float uSWaveVel;       // Vs (m/s)
            uniform float uVOD;            // Fallback detonation velocity (m/s)
            uniform float uCutoff;         // Minimum distance (m)
            uniform int uNumElements;      // M — charge discretisation count
            uniform float uQp;             // P-wave quality factor
            uniform float uQs;             // S-wave quality factor

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

            // Heelan radiation pattern F1 — P-wave
            // F1(phi) = sin(2*phi) * cos(phi)
            // Maximum at phi ~ 54.7 deg
            float F1(float sinPhi, float cosPhi) {
                return 2.0 * sinPhi * cosPhi * cosPhi;
            }

            // Heelan radiation pattern F2 — SV-wave
            // F2(phi) = sin(phi) * cos(2*phi)
            // Maximum at phi = 45 deg
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
                    float totalCharge = collar.w;         // kg
                    float holeLen = toe.w;                 // m
                    float holeDiam = props.z;              // mm

                    // Charging data from Row 3
                    float chargeTopDepth = charging.x;     // m from collar (stemming length)
                    float chargeBaseDepth = charging.y;    // m from collar (bottom of charge)
                    float holeVOD = charging.z;            // m/s (0 = use uniform fallback)

                    if (totalCharge <= 0.0 || holeLen <= 0.0) continue;

                    float holeRadius = holeDiam * 0.0005;  // mm -> m radius

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

                    // Linear charge density (kg/m)
                    float linearDensity = totalCharge / chargeLen;

                    // Borehole pressure estimate: Pb = rho_e * VOD^2 / 8
                    // (detonation pressure / 2 for wall pressure)
                    float area = 3.14159 * holeRadius * holeRadius;
                    float expDensity = totalCharge / (chargeLen * area) * 0.001; // approx g/cc
                    float Pb = expDensity * 1000.0 * effectiveVOD * effectiveVOD * 0.125;

                    // Hole axis from collar to toe (supports angled holes)
                    vec3 holeAxis = normalize(toePos - collarPos);

                    // Charge column start and end positions along hole axis
                    vec3 chargeStartPos = collarPos + holeAxis * chargeStartOffset;
                    vec3 chargeEndPos = collarPos + holeAxis * (chargeStartOffset + chargeLen);

                    // Element length
                    float dL = chargeLen / float(uNumElements);
                    float elementMass = linearDensity * dL;

                    // Superpose contributions from each element
                    float sumVr = 0.0;
                    float sumVz = 0.0;

                    for (int m = 0; m < 64; m++) {
                        if (m >= uNumElements) break;

                        // Element centre within charge column (from bottom up)
                        // Element 0 is at the bottom of charge, element M-1 is at the top
                        float elemOffset = (float(m) + 0.5) * dL;
                        vec3 elemPos = chargeEndPos - holeAxis * elemOffset;

                        // Vector from element to observation point
                        vec3 toObs = vWorldPos - elemPos;
                        float R = max(length(toObs), uCutoff);

                        // Angle phi between hole axis and direction to observation point
                        float cosPhi = abs(dot(normalize(toObs), holeAxis));
                        float sinPhi = sqrt(1.0 - cosPhi * cosPhi);

                        // Radiation pattern amplitudes
                        float f1 = F1(sinPhi, cosPhi);
                        float f2 = F2(sinPhi, cosPhi);

                        // Heelan far-field displacement amplitudes (velocity = omega * displacement)
                        // Amplitude scaling: (Pb * a^2 * dL) / (rho * V^2 * R)
                        float scaleP  = (Pb * holeRadius * holeRadius * dL) /
                                        (uRockDensity * uPWaveVel * uPWaveVel * R);
                        float scaleSV = (Pb * holeRadius * holeRadius * dL) /
                                        (uRockDensity * uSWaveVel * uSWaveVel * R);

                        // Viscoelastic attenuation (Blair & Minchinton 2006)
                        // exp(-omega*R / (2*Q*V)) — using characteristic frequency
                        float omega = effectiveVOD / (2.0 * holeRadius); // characteristic angular freq
                        float attP = 1.0;
                        float attS = 1.0;
                        if (uQp > 0.0) attP = exp(-omega * R / (2.0 * uQp * uPWaveVel));
                        if (uQs > 0.0) attS = exp(-omega * R / (2.0 * uQs * uSWaveVel));

                        // PPV from this element (convert displacement to velocity with omega)
                        float vP  = scaleP  * f1 * omega * attP;
                        float vSV = scaleSV * f2 * omega * attS;

                        // Resolve into radial and vertical components
                        sumVr += vP * sinPhi + vSV * cosPhi;
                        sumVz += vP * cosPhi - vSV * sinPhi;
                    }

                    // Vector peak particle velocity (mm/s)
                    float vppv = sqrt(sumVr * sumVr + sumVz * sumVz) * 1000.0;
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
            uRockDensity: { value: p.rockDensity },
            uPWaveVel: { value: p.pWaveVelocity },
            uSWaveVel: { value: p.sWaveVelocity },
            uVOD: { value: p.detonationVelocity },
            uCutoff: { value: p.cutoffDistance },
            uNumElements: { value: p.numElements },
            uQp: { value: p.qualityFactorP },
            uQs: { value: p.qualityFactorS }
        };
    }
}
