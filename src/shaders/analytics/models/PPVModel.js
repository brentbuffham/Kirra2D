// src/shaders/analytics/models/PPVModel.js

/**
 * PPVModel implements a simple Peak Particle Velocity site law.
 *
 * Formula: PPV = K * (D / Q^e)^(-B)
 * where:
 *   K = site constant (intercept)
 *   B = site exponent (slope)
 *   e = charge exponent (typically 0.5 for square-root scaling)
 *   D = distance from charge centroid to observation point
 *   Q = charge mass
 *
 * Improvements over original:
 * - Point source is at charge centroid (midpoint of charge column),
 *   not collar. Produces more physically accurate PPV contours.
 * - Timing window support: charges firing within a time window can be
 *   combined (mass-weighted centroid, summed mass) for cooperative PPV.
 */
export class PPVModel {
    constructor() {
        this.name = "ppv";
        this.displayName = "Peak Particle Velocity (PPV)";
        this.unit = "mm/s";
        this.defaultColourRamp = "ppv";
        this.defaultMin = 0;
        this.defaultMax = 200;   // mm/s
    }

    /**
     * Site law constants — these become shader uniforms.
     * PPV = K * (D / Q^e)^(-B)
     *   K = site constant (intercept)
     *   B = site exponent (slope)
     *   e = charge exponent (typically 0.5 for SD, 0.33 for cube-root)
     */
    getDefaultParams() {
        return {
            K: 1140,              // site constant
            B: 1.6,               // site exponent
            chargeExponent: 0.5,  // 0.5 = square-root scaling (SD)
            cutoffDistance: 1.0,  // minimum distance to avoid singularity (metres)
            targetPPV: 0.0,       // target PPV band (0 = disabled)
            timeWindow: 0.0,      // ms — charges within this window are combined (0 = per-hole peak)
            timeOffset: -1.0      // ms — centre of timing window (-1 = disabled)
        };
    }

    /**
     * Return the GLSL fragment source for this model.
     *
     * Data layout (from ShaderUniformManager):
     *   Row 0: [collarX, collarY, collarZ, totalChargeKg]
     *   Row 1: [toeX, toeY, toeZ, holeLength_m]
     *   Row 2: [MIC_kg, timing_ms, holeDiam_mm, unused]
     *   Row 3: [chargeTopDepth_m, chargeBaseDepth_m, vodMs, totalExplosiveMassKg]
     */
    getFragmentSource() {
        return `
            precision highp float;

            uniform sampler2D uHoleData;
            uniform int uHoleCount;
            uniform float uHoleDataWidth;
            uniform float uK;
            uniform float uB;
            uniform float uChargeExp;
            uniform float uCutoff;
            uniform float uTargetPPV;
            uniform float uDisplayTime;   // -1 = show all (no time filter)
            uniform float uTimeWindow;    // ms — cooperative window (0 = per-hole peak)
            uniform float uTimeOffset;    // ms — centre of timing window (-1 = disabled)
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

            // Compute charge centroid for a hole — midpoint of charge column
            vec3 getChargeCentroid(int idx) {
                vec4 collar = getHoleData(idx, 0);
                vec4 toe = getHoleData(idx, 1);
                vec4 charging = getHoleData(idx, 3);

                vec3 collarPos = collar.xyz;
                vec3 toePos = toe.xyz;
                float holeLen = toe.w;
                float chargeTopDepth = charging.x;
                float chargeBaseDepth = charging.y;

                vec3 holeAxis = normalize(toePos - collarPos);

                float centroidDepth;
                if (chargeBaseDepth > 0.0 && chargeBaseDepth > chargeTopDepth) {
                    centroidDepth = (chargeTopDepth + chargeBaseDepth) * 0.5;
                } else {
                    // Fallback: 30%-100% charge column, centroid at 65%
                    centroidDepth = holeLen * 0.65;
                }

                return collarPos + holeAxis * centroidDepth;
            }

            void main() {
                float peakPPV = 0.0;

                // Time-bin MIC mode: fixed-width bins, PPV from bin MIC
                bool useTimeWindow = uTimeWindow > 0.0;

                if (useTimeWindow) {
                    // Fixed bins: [offset, offset+W), [offset+W, offset+2W), ...
                    // Edge bin:   [0, offset) for any holes before the first full bin.
                    // Each hole belongs to exactly one bin.
                    // MIC per bin = sum of charges from all holes in that bin.
                    // PPV evaluated at top/center/base of each hole using its bin's MIC.

                    for (int i = 0; i < 512; i++) {
                        if (i >= uHoleCount) break;

                        vec4 posCharge_i = getHoleData(i, 0);
                        float charge_i = posCharge_i.w;
                        if (charge_i <= 0.0) continue;

                        vec4 props_i = getHoleData(i, 2);
                        float timing_i = props_i.y;
                        if (uDisplayTime >= 0.0 && timing_i > uDisplayTime) continue;

                        // Determine bin index for hole i
                        // Edge bin (timing < offset) gets index -1
                        float bin_i = (uTimeOffset > 0.0 && timing_i < uTimeOffset)
                            ? -1.0
                            : floor((timing_i - uTimeOffset) / uTimeWindow);

                        // Sum charges of all holes in the same bin → MIC
                        float mic = 0.0;
                        for (int j = 0; j < 512; j++) {
                            if (j >= uHoleCount) break;
                            vec4 pc_j = getHoleData(j, 0);
                            float q_j = pc_j.w;
                            if (q_j <= 0.0) continue;

                            vec4 pr_j = getHoleData(j, 2);
                            float t_j = pr_j.y;
                            if (uDisplayTime >= 0.0 && t_j > uDisplayTime) continue;

                            float bin_j = (uTimeOffset > 0.0 && t_j < uTimeOffset)
                                ? -1.0
                                : floor((t_j - uTimeOffset) / uTimeWindow);

                            if (abs(bin_j - bin_i) < 0.5) {
                                mic += q_j;
                            }
                        }

                        if (mic <= 0.0) continue;

                        // Evaluate PPV at top/center/base of this hole using bin MIC
                        vec3 chargeCenter = getChargeCentroid(i);

                        vec4 collar = getHoleData(i, 0);
                        vec4 toe = getHoleData(i, 1);
                        vec4 charging = getHoleData(i, 3);
                        vec3 collarPos = collar.xyz;
                        vec3 toePos = toe.xyz;
                        float holeLen = toe.w;

                        float ctd = charging.x;
                        float cbd = charging.y;
                        if (cbd <= 0.0 || cbd <= ctd) {
                            ctd = holeLen * 0.3;
                            cbd = holeLen;
                        }

                        vec3 holeAxis = (holeLen > 0.001) ? normalize(toePos - collarPos) : vec3(0.0);
                        vec3 chargeTop = collarPos + holeAxis * ctd;
                        vec3 chargeBase = collarPos + holeAxis * cbd;

                        float sd, ppv;
                        sd = max(distance(vWorldPos, chargeTop), uCutoff) / pow(mic, uChargeExp);
                        ppv = uK * pow(sd, -uB);
                        peakPPV = max(peakPPV, ppv);

                        sd = max(distance(vWorldPos, chargeCenter), uCutoff) / pow(mic, uChargeExp);
                        ppv = uK * pow(sd, -uB);
                        peakPPV = max(peakPPV, ppv);

                        sd = max(distance(vWorldPos, chargeBase), uCutoff) / pow(mic, uChargeExp);
                        ppv = uK * pow(sd, -uB);
                        peakPPV = max(peakPPV, ppv);
                    }
                } else {
                    // Per-hole peak mode — each hole evaluated independently from charge centroid
                    for (int i = 0; i < 512; i++) {
                        if (i >= uHoleCount) break;

                        vec4 posCharge = getHoleData(i, 0);
                        float charge = posCharge.w;

                        if (charge <= 0.0) continue;

                        // Time filtering: skip holes that haven't fired yet
                        if (uDisplayTime >= 0.0) {
                            vec4 props = getHoleData(i, 2);
                            float timing_ms = props.y;
                            if (timing_ms > uDisplayTime) continue;
                        }

                        // Use charge centroid instead of collar position
                        vec3 chargeCenter = getChargeCentroid(i);
                        float dist = max(distance(vWorldPos, chargeCenter), uCutoff);

                        // Scaled distance
                        float sd = dist / pow(charge, uChargeExp);

                        // PPV = K * SD^(-B)
                        float ppv = uK * pow(sd, -uB);

                        peakPPV = max(peakPPV, ppv);
                    }
                }

                // Normalise to [0,1] for colour ramp
                float t = clamp((peakPPV - uMinValue) / (uMaxValue - uMinValue), 0.0, 1.0);

                // Sample colour ramp
                vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));
                colour.a *= uOpacity;

                // Target PPV line - black contour at target value
                if (uTargetPPV > 0.0) {
                    float lineWidth = (uMaxValue - uMinValue) * 0.005; // 0.5% line width
                    float distToTarget = abs(peakPPV - uTargetPPV);

                    if (distToTarget < lineWidth) {
                        // Draw black line at target PPV
                        colour.rgb = vec3(0.0, 0.0, 0.0);
                        colour.a = 1.0; // Fully opaque
                    }
                }

                // Discard fragments below threshold (keep transparent)
                if (peakPPV < uMinValue * 0.01) discard;

                gl_FragColor = colour;
            }
        `;
    }

    /**
     * Return model-specific uniform definitions.
     */
    getUniforms(params) {
        var p = Object.assign(this.getDefaultParams(), params || {});
        return {
            uK: { value: p.K },
            uB: { value: p.B },
            uChargeExp: { value: p.chargeExponent },
            uCutoff: { value: p.cutoffDistance },
            uTargetPPV: { value: p.targetPPV || 0.0 },
            uDisplayTime: { value: p.displayTime !== undefined ? p.displayTime : -1.0 },
            uTimeWindow: { value: p.timeWindow || 0.0 },
            uTimeOffset: { value: p.timeOffset !== undefined ? p.timeOffset : -1.0 }
        };
    }
}
