# Flyrock Model: Richards & Moore (2004)

## Overview

The Richards & Moore model is an empirical flyrock distance prediction method based on three distinct flyrock mechanisms: **face burst**, **cratering**, and **stem eject**. It uses the flyrock constant K, explosive linear charge density, and blast geometry to compute maximum throw distances for each mechanism.

The 3D flyrock shroud is generated using the **Chernigovskii ballistic envelope** from the maximum launch velocity.

---

## Reference

> Richards, A.B. & Moore, A.J. (2004) "Flyrock control — by chance or design", Proceedings of the 30th Annual Conference on Explosives and Blasting Technique, ISEE.

Implementation also references: `BRENTBUFFHAM_FlyrockShroud_Vulcan12Macros.pm` (Perl lines 183-218)

---

## Input Parameters

| Parameter | Symbol | Unit | Default | Source |
|---|---|---|---|---|
| Hole diameter | ø | mm | 115 | Hole data |
| Bench height | H | m | 12 | Hole geometry (collar Z - grade Z) |
| Stemming length | St | m | 2 | Charging data (top explosive deck depth) |
| Burden | B | m | 3.6 | Hole geometry |
| Subdrill | Sd | m | 1 | Hole geometry (grade Z - toe Z) |
| Explosive density | ρ | kg/L | 1.2 | Charging data (weighted avg across decks) |
| Flyrock constant | K | - | 20 | User input (dialog), typical range 14–30 |
| Factor of Safety | FoS | - | 2 | User input (dialog) |
| Stem eject angle | θ | degrees | 80 | User input (dialog) |

---

## Formulas

### Charge Properties

```
Charge length:    Lc = H + Sd - St                    (m)
Hole radius:      r  = (ø / 2) / 1000                 (m)
Mass per metre:   W  = π × r² × ρ × 1000             (kg/m)
```

### Base Distances (FoS = 1)

```
Face Burst:    FB_base = (K² / g) × (√W / B)^2.6     (m)
Cratering:     CR_base = (K² / g) × (√W / St)^2.6    (m)
Stem Eject:    SE_base = CR_base × sin(2θ)            (m)
```

Where g = 9.80665 m/s²

### Clearance Distances (FoS-scaled)

```
Face Burst:    FB = FB_base × FoS
Cratering:     CR = CR_base × FoS
Stem Eject:    SE = SE_base × FoS
Max Distance:  D_max = max(FB, CR, SE)
```

### Launch Velocities (from BASE distances, not FoS-scaled)

Velocities are derived from the base (FoS=1) distances to avoid double-counting the safety factor:

```
V_fb = √(FB_base × g)                                Face burst (45° launch)
V_cr = √(CR_base × g / sin(2 × 45°))                Cratering (vertical)
V_se = √(SE_base × g / sin(2θ))                      Stem eject (angled)
V_max = max(V_fb, V_cr, V_se)
```

### Chernigovskii Ballistic Envelope

The 3D shroud surface uses the Chernigovskii safety envelope — the maximum altitude a projectile can reach at a given horizontal distance for any launch angle:

```
altitude(d) = (V⁴ - g²d²) / (2gV²)
```

Where d = horizontal distance from the hole. This defines a parabolic dome above each hole.

---

## Mechanisms Explained

### Face Burst
Horizontal projection of rock from the free face. Governed by burden — smaller burden relative to charge density produces greater throw. This is typically the dominant mechanism in well-designed blasts.

### Cratering
Vertical projection of rock from the collar area. Governed by stemming length — insufficient stemming allows gases to vent upward, ejecting material vertically. Dominant when stemming is inadequate.

### Stem Eject
Angled projection of stemming material itself. Derived from cratering distance modulated by the stem eject angle. The angle is typically 70–85° from horizontal for granular stemming.

---

## Example Calculation

For a 115mm hole, H=12m, St=2m, B=3.6m, Sd=1m, ρ=1.2 kg/L, K=20, FoS=2:

```
Lc = 12 + 1 - 2 = 11m
r  = 0.0575m
W  = π × 0.0575² × 1.2 × 1000 = 12.47 kg/m

FB_base = (400/9.81) × (√12.47 / 3.6)^2.6 = 40.8 × (0.981)^2.6 = 39.1m
CR_base = (400/9.81) × (√12.47 / 2.0)^2.6 = 40.8 × (1.766)^2.6 = 165.8m
SE_base = 165.8 × sin(160°) = 165.8 × 0.342 = 56.7m

FB = 39.1 × 2 = 78.2m
CR = 165.8 × 2 = 331.6m
SE = 56.7 × 2 = 113.4m

V_max from CR_base: √(165.8 × 9.81) = 40.3 m/s
Envelope height: V²/(2g) = 82.9m
Envelope radius: V²/g = 165.8m
```

---

## File References

- **Implementation**: `src/tools/flyrock/FlyrockCalculator.js` — `richardsMoore()` function
- **Envelope**: `src/tools/flyrock/FlyrockCalculator.js` — `envelopeAltitude()` function
- **3D Shroud**: `src/tools/flyrock/FlyrockShroudGenerator.js` — grid sampling with envelope
- **Dialog**: `src/dialog/popups/analytics/FlyrockShroudDialog.js`
- **Orchestration**: `src/helpers/FlyrockShroudHelper.js`
