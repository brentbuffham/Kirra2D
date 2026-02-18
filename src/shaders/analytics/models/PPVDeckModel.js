// src/shaders/analytics/models/PPVDeckModel.js
import * as THREE from "three";

/**
 * PPVDeckModel implements per-deck Peak Particle Velocity analysis.
 *
 * For each charged deck, evaluates PPV at 3 positions along the deck
 * (top, centre, base) using the deck's own mass. Takes the maximum
 * across all deck evaluations.
 *
 * Formula per evaluation point: PPV = K * (D / Q^e)^(-B)
 *
 * Advantages over point PPV:
 * - Multi-deck holes show per-deck influence zones
 * - Air gaps between decks are naturally excluded
 * - Each deck uses its own mass (not total hole mass)
 *
 * Supports timing window: decks firing within a time window can be
 * combined (mass-weighted centroid of deck midpoints, summed mass).
 */
export class PPVDeckModel {
	constructor() {
		this.name = "ppv_deck";
		this.displayName = "PPV (Per-Deck)";
		this.unit = "mm/s";
		this.defaultColourRamp = "ppv";
		this.defaultMin = 0;
		this.defaultMax = 200;   // mm/s
	}

	getDefaultParams() {
		return {
			K: 1140,              // site constant
			B: 1.6,               // site exponent
			chargeExponent: 0.5,  // 0.5 = square-root scaling (SD)
			cutoffDistance: 1.0,  // minimum distance (metres)
			targetPPV: 0.0,       // target PPV band (0 = disabled)
			timeWindow: 0.0,      // ms — decks within this window are combined (0 = per-deck peak)
			timeOffset: -1.0,     // ms — centre of timing window (-1 = disabled)
			maxDisplayDistance: 200.0  // m — max distance to render
		};
	}

	/**
	 * Fragment shader using per-deck data texture.
	 *
	 * Deck DataTexture layout (3 rows × deckCount):
	 *   Row 0: [topX, topY, topZ, deckMassKg]
	 *   Row 1: [baseX, baseY, baseZ, densityKgPerL]
	 *   Row 2: [vodMs, holeDiamMm, timing_ms, holeIndex]
	 */
	getFragmentSource() {
		return `
			precision highp float;

			// Standard hole data (unused by deck PPV but required by base uniforms)
			uniform sampler2D uHoleData;
			uniform int uHoleCount;
			uniform float uHoleDataWidth;

			// Per-deck data texture (3 rows × deckCount columns)
			uniform sampler2D uDeckData;
			uniform int uDeckCount;
			uniform float uDeckDataWidth;

			uniform float uK;
			uniform float uB;
			uniform float uChargeExp;
			uniform float uCutoff;
			uniform float uTargetPPV;
			uniform float uTimeWindow;
			uniform float uTimeOffset;
			uniform float uMaxDisplayDistance;
			uniform float uDisplayTime;
			uniform sampler2D uColourRamp;
			uniform float uMinValue;
			uniform float uMaxValue;
			uniform float uOpacity;

			varying vec3 vWorldPos;

			vec4 getDeckData(int index, int row) {
				float u = (float(index) + 0.5) / uDeckDataWidth;
				float v = (float(row) + 0.5) / 3.0;
				return texture2D(uDeckData, vec2(u, v));
			}

			void main() {
				float peakPPV = 0.0;
				float minDist = 1e10;

				bool useTimeWindow = uTimeWindow > 0.0;

				if (useTimeWindow) {
					// Fixed-width time bins for MIC calculation.
					// Bins: [offset, offset+W), [offset+W, offset+2W), ...
					// Edge bin: [0, offset) for holes before the first full bin.
					// Each deck belongs to exactly one bin.
					// MIC per bin = sum of masses from all decks in that bin.
					// PPV evaluated at top/mid/base of each deck using its bin's MIC.

					for (int d = 0; d < 2048; d++) {
						if (d >= uDeckCount) break;

						vec4 top_d = getDeckData(d, 0);
						vec4 bot_d = getDeckData(d, 1);
						vec4 extra_d = getDeckData(d, 2);

						float mass_d = top_d.w;
						if (mass_d <= 0.0) continue;

						float timing_d = extra_d.z;
						if (uDisplayTime >= 0.0 && timing_d > uDisplayTime) continue;

						// Quick distance check
						vec3 midPos_d = (top_d.xyz + bot_d.xyz) * 0.5;
						float distCheck = distance(vWorldPos, midPos_d);
						if (distCheck > uMaxDisplayDistance) continue;
						minDist = min(minDist, distCheck);

						// Determine bin index for deck d
						float bin_d = (uTimeOffset > 0.0 && timing_d < uTimeOffset)
							? -1.0
							: floor((timing_d - uTimeOffset) / uTimeWindow);

						// Sum masses of all decks in the same bin → MIC
						float mic = 0.0;
						for (int j = 0; j < 2048; j++) {
							if (j >= uDeckCount) break;
							vec4 top_j = getDeckData(j, 0);
							float mass_j = top_j.w;
							if (mass_j <= 0.0) continue;

							vec4 extra_j = getDeckData(j, 2);
							float t_j = extra_j.z;
							if (uDisplayTime >= 0.0 && t_j > uDisplayTime) continue;

							float bin_j = (uTimeOffset > 0.0 && t_j < uTimeOffset)
								? -1.0
								: floor((t_j - uTimeOffset) / uTimeWindow);

							if (abs(bin_j - bin_d) < 0.5) {
								mic += mass_j;
							}
						}

						if (mic <= 0.0) continue;

						// Evaluate PPV at top/mid/base of this deck using bin MIC
						vec3 topPos = top_d.xyz;
						vec3 botPos = bot_d.xyz;
						vec3 midPos = (topPos + botPos) * 0.5;

						float sd, ppv;
						sd = max(distance(vWorldPos, topPos), uCutoff) / pow(mic, uChargeExp);
						ppv = uK * pow(sd, -uB);
						peakPPV = max(peakPPV, ppv);

						sd = max(distance(vWorldPos, midPos), uCutoff) / pow(mic, uChargeExp);
						ppv = uK * pow(sd, -uB);
						peakPPV = max(peakPPV, ppv);

						sd = max(distance(vWorldPos, botPos), uCutoff) / pow(mic, uChargeExp);
						ppv = uK * pow(sd, -uB);
						peakPPV = max(peakPPV, ppv);
					}
				} else {
					// Per-deck peak: evaluate each deck at 3 points (top, mid, base)
					for (int d = 0; d < 2048; d++) {
						if (d >= uDeckCount) break;

						vec4 top = getDeckData(d, 0);
						vec4 bot = getDeckData(d, 1);
						vec4 extra = getDeckData(d, 2);

						vec3 topPos = top.xyz;
						vec3 botPos = bot.xyz;
						float deckMass = top.w;
						float timing_d = extra.z;

						if (deckMass <= 0.0) continue;

						// Display time filter
						if (uDisplayTime >= 0.0 && timing_d > uDisplayTime) continue;

						// Quick distance check to midpoint
						vec3 midPos = (topPos + botPos) * 0.5;
						float distToMid = distance(vWorldPos, midPos);
						if (distToMid > uMaxDisplayDistance) continue;
						minDist = min(minDist, distToMid);

						// Evaluate PPV at 3 deck positions, take max
						float sd_top = max(distance(vWorldPos, topPos), uCutoff) / pow(deckMass, uChargeExp);
						float sd_mid = max(distance(vWorldPos, midPos), uCutoff) / pow(deckMass, uChargeExp);
						float sd_bot = max(distance(vWorldPos, botPos), uCutoff) / pow(deckMass, uChargeExp);

						float ppv_top = uK * pow(sd_top, -uB);
						float ppv_mid = uK * pow(sd_mid, -uB);
						float ppv_bot = uK * pow(sd_bot, -uB);

						float deckPPV = max(ppv_top, max(ppv_mid, ppv_bot));
						peakPPV = max(peakPPV, deckPPV);
					}
				}

				if (peakPPV <= 0.0 || minDist > uMaxDisplayDistance) discard;

				// Normalise to [0,1] for colour ramp
				float t = clamp((peakPPV - uMinValue) / (uMaxValue - uMinValue), 0.0, 1.0);

				vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));

				// Edge fade
				float edgeFade = 1.0 - smoothstep(uMaxDisplayDistance * 0.85, uMaxDisplayDistance, minDist);
				colour.a *= uOpacity * edgeFade;

				// Target PPV line
				if (uTargetPPV > 0.0) {
					float lineWidth = (uMaxValue - uMinValue) * 0.005;
					float distToTarget = abs(peakPPV - uTargetPPV);
					if (distToTarget < lineWidth) {
						colour.rgb = vec3(0.0, 0.0, 0.0);
						colour.a = 1.0;
					}
				}

				if (peakPPV < uMinValue * 0.01) discard;
				gl_FragColor = colour;
			}
		`;
	}

	getUniforms(params) {
		var p = Object.assign(this.getDefaultParams(), params || {});
		var deckData = p._deckData;

		var uniforms = {
			uK: { value: p.K },
			uB: { value: p.B },
			uChargeExp: { value: p.chargeExponent },
			uCutoff: { value: p.cutoffDistance },
			uTargetPPV: { value: p.targetPPV || 0.0 },
			uTimeWindow: { value: p.timeWindow || 0.0 },
			uTimeOffset: { value: p.timeOffset !== undefined ? p.timeOffset : -1.0 },
			uMaxDisplayDistance: { value: p.maxDisplayDistance },
			uDisplayTime: { value: p.displayTime !== undefined ? p.displayTime : -1.0 }
		};

		// Deck texture from prepareDeckDataTexture
		if (deckData && deckData.texture) {
			uniforms.uDeckData = { value: deckData.texture };
			uniforms.uDeckCount = { value: deckData.count };
			uniforms.uDeckDataWidth = { value: deckData.width };
		} else {
			// Fallback: empty 1x3 texture
			var emptyData = new Float32Array(1 * 3 * 4);
			var emptyTex = new THREE.DataTexture(emptyData, 1, 3, THREE.RGBAFormat, THREE.FloatType);
			emptyTex.minFilter = THREE.NearestFilter;
			emptyTex.magFilter = THREE.NearestFilter;
			emptyTex.needsUpdate = true;
			uniforms.uDeckData = { value: emptyTex };
			uniforms.uDeckCount = { value: 0 };
			uniforms.uDeckDataWidth = { value: 1.0 };
		}

		return uniforms;
	}
}
