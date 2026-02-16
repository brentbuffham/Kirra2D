// src/shaders/analytics/models/SDoBModel.js

/**
 * SDoBModel implements Scaled Depth of Burial analysis (McKenzie 2022).
 *
 * Formula: SDoB = St / Wt_m^(1/3)  (m/kg^(1/3))
 * where:
 *   St   = stemming length (m) = chargeTopDepth from ShaderUniformManager Row 3
 *   Wt_m = mass (kg) of explosive in contributing charge length
 *   Contributing length = min(chargeLen, m × ø)
 *   m    = 10 for ø >= 100mm, 8 for smaller holes
 *
 * Per-hole charging data (mass, stemming, charge column) is read from the
 * DataTexture packed by ShaderUniformManager. The fallback explosive density
 * is only used when a hole has NO charging data at all.
 *
 * Each pixel shows the SDoB of its nearest hole, rendered as a smooth
 * gradient ramp: Red (0, flyrock risk) → Lime green (target) → Blue (high, safe).
 */
export class SDoBModel {
	constructor() {
		this.name = "sdob";
		this.displayName = "Scaled Depth of Burial (SDoB)";
		this.unit = "m/kg^(1/3)";
		this.defaultColourRamp = "sdob";
		this.defaultMin = 0;
		this.defaultMax = 3.0;   // m/kg^(1/3)
	}

	/**
	 * Default parameters.
	 * inholeDensity is ONLY used as fallback when a hole has no charging data.
	 */
	getDefaultParams() {
		return {
			targetSDoB: 1.5,           // target SDoB contour (lime green line)
			maxDisplayDistance: 50.0,   // max distance from nearest hole to render (m)
			fallbackDensity: 1.2       // fallback explosive density (kg/L) — only when no charging data
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
			uniform float uTargetSDoB;
			uniform float uMaxDisplayDistance;
			uniform float uFallbackDensity;
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

			// Compute SDoB for a single hole from its packed data
			float computeHoleSDoB(int index) {
				vec4 row1 = getHoleData(index, 1);   // toe + holeLength
				vec4 row2 = getHoleData(index, 2);   // MIC, timing, holeDiam_mm
				vec4 row3 = getHoleData(index, 3);   // chargeTopDepth, chargeBaseDepth, vod, totalMassKg

				float holeLength = row1.w;
				float holeDiam_mm = row2.z;
				float holeDiam_m = holeDiam_mm / 1000.0;
				float chargeTopDepth = row3.x;   // stemming (m from collar)
				float chargeBaseDepth = row3.y;
				float totalMassKg = row3.w;

				// Stemming length (St)
				float St = chargeTopDepth;
				if (St <= 0.0 && holeLength > 0.0) {
					St = holeLength * 0.3;  // fallback: 30% of hole length
				}

				// Charge length
				float chargeLen = chargeBaseDepth - chargeTopDepth;
				if (chargeLen <= 0.0 && holeLength > 0.0) {
					chargeLen = holeLength * 0.7;  // fallback
				}

				// Contributing diameters cap
				float m = (holeDiam_mm >= 100.0) ? 10.0 : 8.0;
				float contributingLen = min(chargeLen, m * holeDiam_m);

				// Contributing charge mass (Wt_m)
				float Wt_m = 0.0;
				if (totalMassKg > 0.0 && chargeLen > 0.0) {
					// Use actual per-hole charging data (mass / charge length = density per metre)
					float massPerMetre = totalMassKg / chargeLen;
					Wt_m = massPerMetre * contributingLen;
				} else if (holeDiam_m > 0.0) {
					// Fallback: estimate from fallback density and hole diameter
					float radius_m = holeDiam_m / 2.0;
					float massPerMetre = 3.14159 * radius_m * radius_m * uFallbackDensity * 1000.0;
					Wt_m = massPerMetre * contributingLen;
				}

				if (Wt_m <= 0.0 || St <= 0.0) return 0.0;

				return St / pow(Wt_m, 1.0 / 3.0);
			}

			void main() {
				float nearestDist = 1e10;
				float nearestSDoB = 0.0;

				for (int i = 0; i < 512; i++) {
					if (i >= uHoleCount) break;

					vec4 posCharge = getHoleData(i, 0);
					vec3 holePos = posCharge.xyz;

					// 2D plan-view distance
					float dist = distance(vWorldPos.xy, holePos.xy);

					if (dist > uMaxDisplayDistance) continue;

					if (dist < nearestDist) {
						nearestDist = dist;
						nearestSDoB = computeHoleSDoB(i);
					}
				}

				// Discard beyond range or no valid SDoB
				if (nearestDist > uMaxDisplayDistance) discard;
				if (nearestSDoB <= 0.0) discard;

				// Normalise to [0,1] for colour ramp
				float t = clamp((nearestSDoB - uMinValue) / (uMaxValue - uMinValue), 0.0, 1.0);

				// Sample colour ramp (red=0 → lime green=target → blue=safe)
				vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));

				// Fade alpha near the edge of display distance
				float edgeFade = 1.0 - smoothstep(uMaxDisplayDistance * 0.85, uMaxDisplayDistance, nearestDist);
				colour.a *= uOpacity * edgeFade;

				// Target SDoB contour — lime green highlight band
				if (uTargetSDoB > 0.0) {
					float targetT = (uTargetSDoB - uMinValue) / (uMaxValue - uMinValue);
					float lineWidth = (uMaxValue - uMinValue) * 0.015;
					float distToTarget = abs(nearestSDoB - uTargetSDoB);

					if (distToTarget < lineWidth) {
						// Bright lime green contour at target SDoB
						float lineFactor = 1.0 - (distToTarget / lineWidth);
						colour.rgb = mix(colour.rgb, vec3(0.2, 1.0, 0.0), lineFactor * 0.8);
						colour.a = max(colour.a, uOpacity * lineFactor);
					}
				}

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
			uTargetSDoB: { value: p.targetSDoB },
			uMaxDisplayDistance: { value: p.maxDisplayDistance },
			uFallbackDensity: { value: p.fallbackDensity }
		};
	}
}
