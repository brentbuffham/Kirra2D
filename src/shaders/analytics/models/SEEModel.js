// src/shaders/analytics/models/SEEModel.js

/**
 * SEEModel implements Specific Explosive Energy analysis.
 *
 * SEE = 0.5 × ρ_e × VOD²  (J/m³ → GJ/m³)
 *
 * where:
 *   ρ_e  = explosive density (kg/m³) = totalMass / chargeVolume
 *   VOD  = velocity of detonation (m/s) — from per-hole product or fallback
 *
 * Each pixel shows an IDW-weighted blend of all nearby hole SEE values,
 * rendered as a smooth gradient heatmap.
 */
export class SEEModel {
	constructor() {
		this.name = "see";
		this.displayName = "Specific Explosive Energy (SEE)";
		this.unit = "GJ/m³";
		this.defaultColourRamp = "jet";
		this.defaultMin = 0;
		this.defaultMax = 25;   // GJ/m³ (ANFO ~8.6, Emulsion ~18.9)
	}

	getDefaultParams() {
		return {
			fallbackDensity: 1.2,       // kg/L (= 1200 kg/m³) — only when no charging data
			fallbackVOD: 5000,          // m/s — only when no per-hole VOD
			maxDisplayDistance: 50.0     // m — max distance from nearest hole to render
		};
	}

	/**
	 * GLSL fragment shader source.
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
			uniform float uFallbackDensity;
			uniform float uFallbackVOD;
			uniform float uMaxDisplayDistance;
			uniform sampler2D uColourRamp;
			uniform float uMinValue;
			uniform float uMaxValue;
			uniform float uOpacity;

			varying vec3 vWorldPos;

			vec4 getHoleData(int index, int row) {
				float u = (float(index) + 0.5) / uHoleDataWidth;
				float v = (float(row) + 0.5) / 4.0;
				return texture2D(uHoleData, vec2(u, v));
			}

			// Compute SEE for a single hole
			float computeHoleSEE(int index) {
				vec4 row0 = getHoleData(index, 0);   // collar + totalCharge
				vec4 row1 = getHoleData(index, 1);   // toe + holeLength
				vec4 row2 = getHoleData(index, 2);   // MIC, timing, holeDiam_mm
				vec4 row3 = getHoleData(index, 3);   // chargeTopDepth, chargeBaseDepth, vod, totalMassKg

				float totalCharge = row0.w;           // kg
				float holeLength = row1.w;            // m
				float holeDiam_mm = row2.z;           // mm
				float holeDiam_m = holeDiam_mm / 1000.0;
				float chargeTopDepth = row3.x;
				float chargeBaseDepth = row3.y;
				float holeVOD = row3.z;               // m/s (0 = use fallback)
				float totalMassKg = row3.w;

				if (holeLength <= 0.0) return 0.0;

				// Charge length
				float chargeLen;
				if (chargeBaseDepth > 0.0 && chargeBaseDepth > chargeTopDepth) {
					chargeLen = chargeBaseDepth - chargeTopDepth;
				} else {
					chargeLen = holeLength * 0.7;
				}
				if (chargeLen <= 0.0) return 0.0;

				// Charge volume (m³)
				float radius_m = holeDiam_m / 2.0;
				float chargeVolume = 3.14159 * radius_m * radius_m * chargeLen;
				if (chargeVolume <= 0.0) return 0.0;

				// Explosive density (kg/m³)
				// Use mass/volume when charging data exists, otherwise fallback density
				float massFinal = totalMassKg > 0.0 ? totalMassKg : totalCharge;
				float rho_e;
				if (massFinal > 0.0) {
					rho_e = massFinal / chargeVolume;
				} else {
					// No mass data — use fallback density (kg/L → kg/m³)
					rho_e = uFallbackDensity * 1000.0;
				}

				// VOD
				float vod = holeVOD > 0.0 ? holeVOD : uFallbackVOD;

				// SEE = 0.5 × ρ_e × VOD² (J/m³)
				// Convert to GJ/m³ by dividing by 1e9
				float see = 0.5 * rho_e * vod * vod / 1000000000.0;
				return see;
			}

			void main() {
				float weightedSum = 0.0;
				float weightTotal = 0.0;
				float minDist = 1e10;

				for (int i = 0; i < 512; i++) {
					if (i >= uHoleCount) break;

					vec4 posCharge = getHoleData(i, 0);
					float dist = distance(vWorldPos, posCharge.xyz);
					if (dist > uMaxDisplayDistance) continue;

					float see = computeHoleSEE(i);
					if (see <= 0.0) continue;

					float w = 1.0 / max(dist * dist, 0.01);
					weightedSum += see * w;
					weightTotal += w;
					minDist = min(minDist, dist);
				}

				if (weightTotal <= 0.0 || minDist > uMaxDisplayDistance) discard;

				float blendedSEE = weightedSum / weightTotal;
				float t = clamp((blendedSEE - uMinValue) / (uMaxValue - uMinValue), 0.0, 1.0);
				vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));

				// Edge fade
				float edgeFade = 1.0 - smoothstep(uMaxDisplayDistance * 0.85, uMaxDisplayDistance, minDist);
				colour.a *= uOpacity * edgeFade;

				if (blendedSEE < uMinValue * 0.01) discard;
				gl_FragColor = colour;
			}
		`;
	}

	getUniforms(params) {
		var p = Object.assign(this.getDefaultParams(), params || {});
		return {
			uFallbackDensity: { value: p.fallbackDensity },
			uFallbackVOD: { value: p.fallbackVOD },
			uMaxDisplayDistance: { value: p.maxDisplayDistance }
		};
	}
}
