// src/shaders/analytics/models/HeelanOriginalModel.js

/**
 * HeelanOriginalModel implements the Original Heelan model based on Heelan's (1953)
 * analytical solution as formulated by Blair & Minchinton (1996).
 *
 * The model divides the charge column into M elements and computes P-wave and SV-wave
 * contributions with radiation patterns F₁(φ) and F₂(φ).
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
     *   u_P(R, φ)  ∝ (Pb * a² * dL) / (ρ * Vp² * R) * F₁(φ)
     *   u_SV(R, φ) ∝ (Pb * a² * dL) / (ρ * Vs² * R) * F₂(φ)
     *
     * where:
     *   Pb  = borehole wall pressure
     *   a   = borehole radius
     *   ρ   = rock density
     *   Vp  = P-wave velocity
     *   Vs  = S-wave velocity
     *   R   = distance from element to observation point
     *   φ   = angle between hole axis and direction to observation point
     *   F₁  = P-wave radiation pattern function
     *   F₂  = SV-wave radiation pattern function
     */
    getDefaultParams() {
        return {
            rockDensity: 2700,         // ρ, kg/m³
            pWaveVelocity: 4500,       // Vp, m/s
            sWaveVelocity: 2600,       // Vs, m/s
            detonationVelocity: 5500,  // VOD, m/s
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
     * Radiation pattern functions (Heelan 1953):
     *   F₁(φ) = sin(2φ) * cos(φ)     — P-wave (radial-vertical plane)
     *   F₂(φ) = sin(φ) * cos(2φ)     — SV-wave (radial-vertical plane)
     */
    getFragmentSource() {
        return `
            precision highp float;

            uniform sampler2D uHoleData;
            uniform int uHoleCount;
            uniform float uHoleDataWidth;

            // Rock mass properties
            uniform float uRockDensity;    // ρ (kg/m³)
            uniform float uPWaveVel;       // Vp (m/s)
            uniform float uSWaveVel;       // Vs (m/s)
            uniform float uVOD;            // Detonation velocity (m/s)
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
                float v = (float(row) + 0.5) / 2.0;
                return texture2D(uHoleData, vec2(u, v));
            }

            // Heelan radiation pattern F1 — P-wave
            // F1(phi) = sin(2*phi) * cos(phi)
            // Maximum at phi ≈ 54.7°
            float F1(float sinPhi, float cosPhi) {
                return 2.0 * sinPhi * cosPhi * cosPhi;
            }

            // Heelan radiation pattern F2 — SV-wave
            // F2(phi) = sin(phi) * cos(2*phi)
            // Maximum at phi = 45°
            float F2(float sinPhi, float cosPhi) {
                return sinPhi * (2.0 * cosPhi * cosPhi - 1.0);
            }

            void main() {
                float peakVPPV = 0.0;

                for (int i = 0; i < 512; i++) {
                    if (i >= uHoleCount) break;

                    vec4 posCharge = getHoleData(i, 0);
                    vec4 holeProps = getHoleData(i, 1);

                    vec3 holePos = posCharge.xyz;   // collar position
                    float totalCharge = posCharge.w; // kg
                    float holeDiam = holeProps.z;    // mm
                    float holeLen = holeProps.w;     // m

                    if (totalCharge <= 0.0 || holeLen <= 0.0) continue;

                    float holeRadius = holeDiam * 0.0005;  // mm → m radius
                    float chargeLen = holeLen * 0.7;        // approx charge length (excl stem)

                    // Linear charge density (kg/m)
                    float linearDensity = totalCharge / chargeLen;

                    // Borehole pressure estimate: Pb = ρ_e * VOD² / 8
                    // (detonation pressure / 2 for wall pressure)
                    float area = 3.14159 * holeRadius * holeRadius;
                    float expDensity = totalCharge / (chargeLen * area) * 0.001; // approx g/cc
                    float Pb = expDensity * 1000.0 * uVOD * uVOD * 0.125;

                    // Hole axis direction (assumed vertical, downward)
                    vec3 holeAxis = vec3(0.0, 0.0, -1.0);

                    // Element length
                    float dL = chargeLen / float(uNumElements);
                    float elementMass = linearDensity * dL;

                    // Superpose contributions from each element
                    float sumVr = 0.0;
                    float sumVz = 0.0;

                    for (int m = 0; m < 64; m++) {
                        if (m >= uNumElements) break;

                        // Element centre position along the charge
                        float elemOffset = (float(m) + 0.5) * dL;
                        vec3 elemPos = holePos + holeAxis * elemOffset;

                        // Vector from element to observation point
                        vec3 toObs = vWorldPos - elemPos;
                        float R = max(length(toObs), uCutoff);

                        // Angle φ between hole axis and direction to observation point
                        float cosPhi = abs(dot(normalize(toObs), holeAxis));
                        float sinPhi = sqrt(1.0 - cosPhi * cosPhi);

                        // Radiation pattern amplitudes
                        float f1 = F1(sinPhi, cosPhi);
                        float f2 = F2(sinPhi, cosPhi);

                        // Heelan far-field displacement amplitudes (velocity = ω * displacement)
                        // Amplitude scaling: (Pb * a² * dL) / (ρ * V² * R)
                        float scaleP  = (Pb * holeRadius * holeRadius * dL) /
                                        (uRockDensity * uPWaveVel * uPWaveVel * R);
                        float scaleSV = (Pb * holeRadius * holeRadius * dL) /
                                        (uRockDensity * uSWaveVel * uSWaveVel * R);

                        // Viscoelastic attenuation (Blair & Minchinton 2006)
                        // exp(-ω*R / (2*Q*V)) — using characteristic frequency
                        float omega = uVOD / (2.0 * holeRadius); // characteristic angular freq
                        float attP = 1.0;
                        float attS = 1.0;
                        if (uQp > 0.0) attP = exp(-omega * R / (2.0 * uQp * uPWaveVel));
                        if (uQs > 0.0) attS = exp(-omega * R / (2.0 * uQs * uSWaveVel));

                        // PPV from this element (convert displacement to velocity with ω)
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
