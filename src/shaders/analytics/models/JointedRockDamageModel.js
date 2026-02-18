// src/shaders/analytics/models/JointedRockDamageModel.js

/**
 * JointedRockDamageModel implements a simplified jointed rock damage analysis.
 *
 * Combines intact rock fracture with joint-controlled failure:
 *
 * 1. Compute PPV using Holmberg-Persson integration along charge column
 *    PPV = K × Σ (q × dL)^α / R_i^β  (incoherent / RMS sum)
 *
 * 2. Convert PPV to dynamic stress:
 *    σ_d = ρ_rock × Vp × PPV
 *
 * 3. Intact rock fracture ratio:
 *    FR_rock = σ_d / σ_t  (tensile strength)
 *
 * 4. Resolve stress onto joint planes:
 *    σ_n = σ_d × cos²(θ)   (normal stress on joint)
 *    τ   = σ_d × sin(θ) × cos(θ)  (shear stress on joint)
 *
 * 5. Mohr-Coulomb failure on joints:
 *    FR_joint = τ / (c + μ × σ_n)
 *    where μ = tan(frictionAngle), c = joint cohesion
 *
 * 6. Output = max(FR_rock, FR_joint)
 *
 * Values > 1.0 indicate damage/failure.
 */
export class JointedRockDamageModel {
	constructor() {
		this.name = "jointed_rock";
		this.displayName = "Jointed Rock Damage";
		this.unit = "damage ratio";
		this.defaultColourRamp = "damage";
		this.defaultMin = 0;
		this.defaultMax = 2.0;
	}

	getDefaultParams() {
		return {
			// Holmberg-Persson site law constants
			K_hp: 700,                  // site constant
			alpha_hp: 0.7,              // charge exponent
			beta_hp: 1.5,               // distance exponent
			// Rock mass properties
			rockTensileStrength: 10,    // MPa
			rockDensity: 2700,          // kg/m³
			pWaveVelocity: 4500,        // m/s
			// Joint properties
			jointSetAngle: 45,          // degrees — angle between joint plane normal and vertical
			jointCohesion: 0.1,         // MPa
			jointFrictionAngle: 30,     // degrees — friction angle for Mohr-Coulomb
			// Numerical
			numElements: 20,            // charge column discretisation
			cutoffDistance: 0.3,        // minimum distance (m)
			maxDisplayDistance: 50.0     // m
		};
	}

	getFragmentSource() {
		return `
			precision highp float;

			uniform sampler2D uHoleData;
			uniform int uHoleCount;
			uniform float uHoleDataWidth;

			// Holmberg-Persson constants
			uniform float uK_hp;
			uniform float uAlpha_hp;
			uniform float uBeta_hp;

			// Rock mass properties
			uniform float uRockTensile;    // MPa
			uniform float uRockDensity;    // kg/m³
			uniform float uPWaveVel;       // m/s

			// Joint properties
			uniform float uJointAngleRad;  // radians
			uniform float uJointCohesion;  // MPa
			uniform float uJointFriction;  // tan(frictionAngle)

			// Numerical
			uniform int uNumElements;
			uniform float uCutoff;
			uniform float uMaxDisplayDistance;

			// Colour mapping
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
				float peakDamageRatio = 0.0;
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
					float chargeTopDepth = charging.x;
					float chargeBaseDepth = charging.y;

					if (totalCharge <= 0.0 || holeLen <= 0.0) continue;

					// Quick distance check
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

					// Hole axis
					vec3 holeAxis = normalize(toePos - collarPos);
					vec3 chargeEndPos = collarPos + holeAxis * (chargeStartOffset + chargeLen);

					// Element properties
					float dL = chargeLen / float(uNumElements);
					float linearDensity = totalCharge / chargeLen;  // kg/m
					float q = linearDensity * dL;  // element mass (kg)

					// Holmberg-Persson integration (incoherent RMS sum)
					float sumPPV2 = 0.0;

					for (int m = 0; m < 64; m++) {
						if (m >= uNumElements) break;

						float elemOffset = (float(m) + 0.5) * dL;
						vec3 elemPos = chargeEndPos - holeAxis * elemOffset;
						float R = max(distance(vWorldPos, elemPos), uCutoff);

						// PPV_i = K × q^α / R^β
						float ppv_i = uK_hp * pow(q, uAlpha_hp) / pow(R, uBeta_hp);
						sumPPV2 += ppv_i * ppv_i;
					}

					float ppv = sqrt(sumPPV2);  // mm/s (RMS)

					// Convert PPV to dynamic stress
					// σ_d = ρ_rock × Vp × PPV (Pa)
					// PPV is in mm/s, convert to m/s: ÷ 1000
					// Result in Pa, convert to MPa: ÷ 1e6
					float sigma_d = uRockDensity * uPWaveVel * ppv * 0.001 / 1000000.0;  // MPa

					// Intact rock fracture ratio
					float FR_rock = sigma_d / max(uRockTensile, 0.001);

					// Joint failure — resolve stress onto joint plane
					float cosTheta = cos(uJointAngleRad);
					float sinTheta = sin(uJointAngleRad);
					float sigma_n = sigma_d * cosTheta * cosTheta;  // normal stress
					float tau = sigma_d * sinTheta * cosTheta;      // shear stress

					// Mohr-Coulomb: FR_joint = τ / (c + μ × σ_n)
					float denominator = uJointCohesion + uJointFriction * sigma_n;
					float FR_joint = denominator > 0.001 ? tau / denominator : 0.0;

					// Take maximum damage ratio
					float damageRatio = max(FR_rock, FR_joint);
					peakDamageRatio = max(peakDamageRatio, damageRatio);
				}

				if (peakDamageRatio <= 0.0 || minDist > uMaxDisplayDistance) discard;

				float t = clamp((peakDamageRatio - uMinValue) / (uMaxValue - uMinValue), 0.0, 1.0);
				vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));

				// Edge fade
				float edgeFade = 1.0 - smoothstep(uMaxDisplayDistance * 0.85, uMaxDisplayDistance, minDist);
				colour.a *= uOpacity * edgeFade;

				if (peakDamageRatio < uMinValue * 0.01) discard;
				gl_FragColor = colour;
			}
		`;
	}

	getUniforms(params) {
		var p = Object.assign(this.getDefaultParams(), params || {});
		var jointAngleRad = p.jointSetAngle * Math.PI / 180.0;
		var frictionCoeff = Math.tan((p.jointFrictionAngle || 30) * Math.PI / 180.0);
		return {
			uK_hp: { value: p.K_hp },
			uAlpha_hp: { value: p.alpha_hp },
			uBeta_hp: { value: p.beta_hp },
			uRockTensile: { value: p.rockTensileStrength },
			uRockDensity: { value: p.rockDensity },
			uPWaveVel: { value: p.pWaveVelocity },
			uJointAngleRad: { value: jointAngleRad },
			uJointCohesion: { value: p.jointCohesion },
			uJointFriction: { value: frictionCoeff },
			uNumElements: { value: p.numElements },
			uCutoff: { value: p.cutoffDistance },
			uMaxDisplayDistance: { value: p.maxDisplayDistance }
		};
	}
}
