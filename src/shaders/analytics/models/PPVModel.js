// src/shaders/analytics/models/PPVModel.js

/**
 * PPVModel implements a simple Peak Particle Velocity site law.
 *
 * Formula: PPV = K * (D / Q^e)^(-B)
 * where:
 *   K = site constant (intercept)
 *   B = site exponent (slope)
 *   e = charge exponent (typically 0.5 for square-root scaling)
 *   D = distance from charge to observation point
 *   Q = charge mass
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
            K: 1140,          // site constant
            B: 1.6,           // site exponent
            chargeExponent: 0.5,  // 0.5 = square-root scaling (SD)
            cutoffDistance: 1.0,   // minimum distance to avoid singularity (metres)
            targetPPV: 0.0         // target PPV band (0 = disabled)
        };
    }

    /**
     * Return the GLSL fragment source for this model.
     * The shader receives:
     *   - uHoleData: DataTexture with hole positions & charges
     *   - uHoleCount: int
     *   - uK, uB, uChargeExp, uCutoff: float
     *   - uColourRamp: 1D sampler
     *   - uMinValue, uMaxValue: float (for normalisation)
     *   - vWorldPos: vec3 (from vertex shader)
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
            uniform float uDisplayTime;  // -1 = show all (no time filter)
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

                    vec4 posCharge = getHoleData(i, 0);
                    vec3 holePos = posCharge.xyz;
                    float charge = posCharge.w;

                    if (charge <= 0.0) continue;

                    // Time filtering: skip holes that haven't fired yet
                    if (uDisplayTime >= 0.0) {
                        vec4 props = getHoleData(i, 2);
                        float timing_ms = props.y;
                        if (timing_ms > uDisplayTime) continue;
                    }

                    // 3D distance from fragment to hole
                    float dist = max(distance(vWorldPos, holePos), uCutoff);

                    // Scaled distance
                    float sd = dist / pow(charge, uChargeExp);

                    // PPV = K * SD^(-B)
                    float ppv = uK * pow(sd, -uB);

                    peakPPV = max(peakPPV, ppv);
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
            uDisplayTime: { value: p.displayTime !== undefined ? p.displayTime : -1.0 }
        };
    }
}
