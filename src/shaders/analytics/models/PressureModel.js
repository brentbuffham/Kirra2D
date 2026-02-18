// src/shaders/analytics/models/PressureModel.js

/**
 * PressureModel implements borehole pressure analysis.
 *
 * Borehole wall pressure: Pb = ρ_e × VOD² / 8
 * Attenuation with distance: P(R) = Pb × (a / R)^α
 *
 * where:
 *   ρ_e  = explosive density (kg/m³)
 *   VOD  = velocity of detonation (m/s)
 *   a    = borehole radius (m)
 *   R    = distance from charge element to observation point (m)
 *   α    = attenuation exponent (≈ 2 for cylindrical divergence)
 *
 * Integrates along the charge column, taking the peak pressure
 * contribution across all elements and all holes.
 */
export class PressureModel {
	constructor() {
		this.name = "pressure";
		this.displayName = "Borehole Pressure";
		this.unit = "MPa";
		this.defaultColourRamp = "pressure";
		this.defaultMin = 0;
		this.defaultMax = 100;   // MPa
	}

	getDefaultParams() {
		return {
			attenuationExponent: 2.0,   // α — geometric spreading exponent
			fallbackDensity: 1.2,       // kg/L — only when no charging data
			fallbackVOD: 5000,          // m/s — only when no per-hole VOD
			numElements: 20,            // M — charge column discretisation
			cutoffDistance: 0.3,        // minimum distance (m) to avoid singularity
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
			uniform float uAttenuationExp;
			uniform float uFallbackDensity;
			uniform float uFallbackVOD;
			uniform int uNumElements;
			uniform float uCutoff;
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

			void main() {
				float peakPressure = 0.0;
				float minDist = 1e10;

				for (int i = 0; i < 512; i++) {
					if (i >= uHoleCount) break;

					vec4 collar = getHoleData(i, 0);
					vec4 toe = getHoleData(i, 1);
					vec4 props = getHoleData(i, 2);
					vec4 charging = getHoleData(i, 3);

					vec3 collarPos = collar.xyz;
					vec3 toePos = toe.xyz;
					float totalCharge = collar.w;
					float holeLen = toe.w;
					float holeDiam_mm = props.z;
					float chargeTopDepth = charging.x;
					float chargeBaseDepth = charging.y;
					float holeVOD = charging.z;
					float totalMassKg = charging.w;

					if (totalCharge <= 0.0 || holeLen <= 0.0) continue;

					float holeRadius = holeDiam_mm * 0.0005;  // mm -> m radius

					// Quick distance check to collar
					float distToCollar = distance(vWorldPos, collarPos);
					if (distToCollar > uMaxDisplayDistance) continue;
					minDist = min(minDist, distToCollar);

					// Charge column bounds
					float chargeLen;
					float chargeStartOffset;
					if (chargeBaseDepth > 0.0 && chargeBaseDepth > chargeTopDepth) {
						chargeLen = chargeBaseDepth - chargeTopDepth;
						chargeStartOffset = chargeTopDepth;
					} else {
						chargeLen = holeLen * 0.7;
						chargeStartOffset = holeLen * 0.3;
					}

					// Per-hole VOD
					float effectiveVOD = holeVOD > 0.0 ? holeVOD : uFallbackVOD;

					// Explosive density
					float area = 3.14159 * holeRadius * holeRadius;
					float massFinal = totalMassKg > 0.0 ? totalMassKg : totalCharge;
					float rho_e;
					if (chargeLen > 0.0 && area > 0.0) {
						rho_e = massFinal / (chargeLen * area);  // kg/m³
					} else {
						rho_e = uFallbackDensity * 1000.0;  // kg/L -> kg/m³
					}

					// Borehole wall pressure: Pb = ρ_e × VOD² / 8 (Pa)
					float Pb = rho_e * effectiveVOD * effectiveVOD * 0.125;
					// Convert to MPa
					float Pb_MPa = Pb / 1000000.0;

					// Hole axis
					vec3 holeAxis = normalize(toePos - collarPos);
					vec3 chargeEndPos = collarPos + holeAxis * (chargeStartOffset + chargeLen);

					// Element length
					float dL = chargeLen / float(uNumElements);

					// Integrate along charge column, take peak
					for (int m = 0; m < 64; m++) {
						if (m >= uNumElements) break;

						float elemOffset = (float(m) + 0.5) * dL;
						vec3 elemPos = chargeEndPos - holeAxis * elemOffset;

						float R = max(distance(vWorldPos, elemPos), uCutoff);

						// P(R) = Pb × (a / R)^α
						float P_elem = Pb_MPa * pow(holeRadius / R, uAttenuationExp);
						peakPressure = max(peakPressure, P_elem);
					}
				}

				if (peakPressure <= 0.0 || minDist > uMaxDisplayDistance) discard;

				float t = clamp((peakPressure - uMinValue) / (uMaxValue - uMinValue), 0.0, 1.0);
				vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));

				// Edge fade
				float edgeFade = 1.0 - smoothstep(uMaxDisplayDistance * 0.85, uMaxDisplayDistance, minDist);
				colour.a *= uOpacity * edgeFade;

				if (peakPressure < uMinValue * 0.01) discard;
				gl_FragColor = colour;
			}
		`;
	}

	getUniforms(params) {
		var p = Object.assign(this.getDefaultParams(), params || {});
		return {
			uAttenuationExp: { value: p.attenuationExponent },
			uFallbackDensity: { value: p.fallbackDensity },
			uFallbackVOD: { value: p.fallbackVOD },
			uNumElements: { value: p.numElements },
			uCutoff: { value: p.cutoffDistance },
			uMaxDisplayDistance: { value: p.maxDisplayDistance }
		};
	}
}
