// src/shaders/analytics/models/SDoBModel.js

/**
 * SDoBModel implements Volumetric Scaled Depth of Burial analysis.
 *
 * For each observation point P, computes the nearest 3D distance D to the
 * charge column segment, then:
 *   SDoB = D / Wt_m^(1/3)  (m/kg^(1/3))
 *
 * where:
 *   D      = distToSegment(P, chargeTop3D, chargeBase3D) — varies per pixel
 *   Wt_m   = mass (kg) of explosive in contributing charge length
 *   Contributing length = min(chargeLen, m × ø)
 *   m      = 10 for ø >= 100mm, 8 for smaller holes
 *
 * Key behaviors:
 * - On collar plane directly above hole: D ≈ stemming length → standard SDoB
 * - On plane cutting through charge zone: D ≈ 0 → SDoB ≈ 0 (high flyrock risk)
 * - On vertical face: D = lateral distance to charge → volumetric SDoB
 * - Far from any hole: no contribution (edge fade)
 *
 * Colour ramp: Red (0, flyrock risk) → Lime green (target) → Blue (high, safe).
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
	 * fallbackDensity is ONLY used as fallback when a hole has no charging data.
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

			// Distance from point P to nearest point on line segment AB
			float distToSegment(vec3 P, vec3 A, vec3 B) {
				vec3 AB = B - A;
				float lenSq = dot(AB, AB);
				if (lenSq < 0.0001) return distance(P, A);
				float t = clamp(dot(P - A, AB) / lenSq, 0.0, 1.0);
				vec3 closest = A + t * AB;
				return distance(P, closest);
			}

			void main() {
				float weightedSum = 0.0;
				float weightTotal = 0.0;
				float minDist = 1e10;

				for (int i = 0; i < 512; i++) {
					if (i >= uHoleCount) break;

					vec4 row0 = getHoleData(i, 0);   // collar + totalCharge
					vec4 row1 = getHoleData(i, 1);   // toe + holeLength
					vec4 row2 = getHoleData(i, 2);   // MIC, timing, holeDiam_mm
					vec4 row3 = getHoleData(i, 3);   // chargeTopDepth, chargeBaseDepth, vod, totalMassKg

					vec3 collarPos = row0.xyz;
					vec3 toePos = row1.xyz;
					float holeLength = row1.w;
					float holeDiam_mm = row2.z;
					float holeDiam_m = holeDiam_mm / 1000.0;
					float chargeTopDepth = row3.x;
					float chargeBaseDepth = row3.y;
					float totalMassKg = row3.w;

					if (holeLength <= 0.0) continue;

					// Quick distance check to collar for culling
					float distToCollar = distance(vWorldPos, collarPos);
					if (distToCollar > uMaxDisplayDistance) continue;
					minDist = min(minDist, distToCollar);

					// Hole axis direction
					vec3 holeAxis = normalize(toePos - collarPos);

					// Charge column bounds (depth along hole from collar)
					float chargeTopD = chargeTopDepth;
					float chargeBaseD = chargeBaseDepth;
					if (chargeBaseD <= 0.0 || chargeBaseD <= chargeTopD) {
						// Fallback: stemming = 30%, charge = 70%
						chargeTopD = holeLength * 0.3;
						chargeBaseD = holeLength;
					}

					float chargeLen = chargeBaseD - chargeTopD;
					if (chargeLen <= 0.0) continue;

					// 3D charge column endpoints
					vec3 chargeTop3D = collarPos + holeAxis * chargeTopD;
					vec3 chargeBase3D = collarPos + holeAxis * chargeBaseD;

					// Distance from observation point to charge segment
					float D = distToSegment(vWorldPos, chargeTop3D, chargeBase3D);

					// Contributing diameters cap (Chiappetta)
					float m = (holeDiam_mm >= 100.0) ? 10.0 : 8.0;
					float contributingLen = min(chargeLen, m * holeDiam_m);

					// Contributing charge mass (Wt_m)
					float Wt_m = 0.0;
					if (totalMassKg > 0.0 && chargeLen > 0.0) {
						float massPerMetre = totalMassKg / chargeLen;
						Wt_m = massPerMetre * contributingLen;
					} else if (holeDiam_m > 0.0) {
						float radius_m = holeDiam_m / 2.0;
						float massPerMetre = 3.14159 * radius_m * radius_m * uFallbackDensity * 1000.0;
						Wt_m = massPerMetre * contributingLen;
					}

					if (Wt_m <= 0.0) continue;

					// SDoB = D / Wt_m^(1/3)
					float sdob = D / pow(Wt_m, 1.0 / 3.0);

					// IDW blending using distance to collar (spatial weighting)
					float w = 1.0 / max(distToCollar * distToCollar, 0.01);
					weightedSum += sdob * w;
					weightTotal += w;
				}

				if (weightTotal <= 0.0 || minDist > uMaxDisplayDistance) discard;

				float blendedSDoB = weightedSum / weightTotal;
				float t = clamp((blendedSDoB - uMinValue) / (uMaxValue - uMinValue), 0.0, 1.0);
				vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));

				// Edge fade
				float edgeFade = 1.0 - smoothstep(uMaxDisplayDistance * 0.85, uMaxDisplayDistance, minDist);
				colour.a *= uOpacity * edgeFade;

				// Target SDoB contour
				if (uTargetSDoB > 0.0) {
					float distToTarget = abs(blendedSDoB - uTargetSDoB);
					float lineWidth = (uMaxValue - uMinValue) * 0.015;
					if (distToTarget < lineWidth) {
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
