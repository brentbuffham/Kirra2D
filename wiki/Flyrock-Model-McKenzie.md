# Flyrock Model: McKenzie (2009/2022)

## Overview

The McKenzie model predicts flyrock range using the **Scaled Depth of Burial (SDoB)** concept from Chiappetta & Treleven (1997). It considers the contributing charge mass near the stemming zone and provides both a range prediction and a velocity coefficient.

This is the most physically-grounded of the three models, accounting for charge confinement, hole diameter, explosive density, and stemming length through the SDoB parameter.

---

## References

> Chiappetta, R.F. & Treleven, J.P. (1997) — Scaled Depth of Burial (SDoB) concept for flyrock risk assessment.

> McKenzie, C. (2009) "Flyrock range and fragment size prediction" — Eq.5: velocity coefficient Kv.

> McKenzie, C. (2022) "Flyrock model validation" — Eq.5: maximum range formula.

---

## Input Parameters

| Parameter | Symbol | Unit | Default | Source |
|---|---|---|---|---|
| Hole diameter | ø | mm | 115 | Hole data |
| Stemming length | St | m | 2 | Charging data (top explosive deck depth) |
| Charge length | Lc | m | 10 | Charging data (bottom - top deck depths) |
| Explosive density | ρ | kg/L | 1.2 | Charging data (weighted avg across decks) |
| Rock density | ρr | kg/m³ | 2600 | User input (dialog) |
| Factor of Safety | FoS | - | 2 | User input (dialog) |

---

## Formulas

### Step 1: Contributing Charge

The contributing charge is the portion of the explosive column nearest to the stemming zone — the charge most responsible for crater-type flyrock. It is capped at a number of hole diameters:

```
m = 10    for ø ≥ 100mm
m = 8     for ø < 100mm

Contributing length:  Lcon = min(Lc, m × ø_m)        (m)
```

Where ø_m = ø / 1000 (diameter in metres).

### Step 2: Mass Per Metre and Contributing Mass

```
Hole radius:      r = ø_m / 2                         (m)
Mass per metre:   W = π × r² × ρ × 1000              (kg/m)
Contributing mass: Wt_m = W × Lcon                    (kg)
```

### Step 3: Chiappetta Scaled Depth of Burial

The SDoB uses the distance from the surface to the **centre** of the contributing charge, not just the stemming length:

```
D = St + 0.5 × Lcon                                   (m)
SDoB = D / Wt_m^(1/3)                                 (m/kg^(1/3))
```

**Important**: Earlier implementations incorrectly used `D = St` (stemming only). The correct Chiappetta formulation uses the distance to the centre of the contributing charge: `D = St + 0.5 × Lcon`.

### Step 4: Velocity Coefficient (McKenzie 2009 Eq.5)

```
Kv = 0.0728 × SDoB^(-3.251)
```

### Step 5: Maximum Range (McKenzie 2022 Eq.5)

```
Rmax = 9.74 × (ø_mm / SDoB^2.167)^(2/3)              (m)
```

### Step 6: Clearance and Velocity

```
Clearance = Rmax × FoS                                (m)
V₀ = √(Rmax × g)                                     (m/s)
```

Where g = 9.80665 m/s². The velocity is derived from the **base** range (not FoS-scaled) to avoid double-counting the safety factor.

---

## SDoB Physical Meaning

The Scaled Depth of Burial characterises how well-confined the explosive charge is relative to its energy. Lower SDoB means:
- Less confinement (closer to surface, more explosive per unit depth)
- Higher flyrock risk
- Greater predicted range

Typical SDoB values and their implications:

| SDoB (m/kg^(1/3)) | Risk Level | Interpretation |
|---|---|---|
| < 0.8 | Very High | Severe flyrock risk — crater formation likely |
| 0.8 – 1.2 | High | Elevated flyrock risk — review stemming |
| 1.2 – 1.8 | Moderate | Normal blast conditions |
| 1.8 – 2.5 | Low | Well-confined blast |
| > 2.5 | Very Low | Over-confined — may affect fragmentation |

The Kirra blast analytics shader (`SDoBModel.js`) visualises SDoB as a colour ramp: Red (low, flyrock risk) → Lime green (target, typically 1.5) → Blue (high, safe).

---

## Example Calculation

For a 115mm hole, St=2.0m, Lc=10m, ρ=1.2 kg/L, FoS=2:

```
ø_m = 0.115m
m = 10 (since ø ≥ 100mm)
Lcon = min(10, 10 × 0.115) = min(10, 1.15) = 1.15m

r = 0.0575m
W = π × 0.0575² × 1.2 × 1000 = 12.47 kg/m
Wt_m = 12.47 × 1.15 = 14.34 kg

D = 2.0 + 0.5 × 1.15 = 2.575m
SDoB = 2.575 / 14.34^(1/3) = 2.575 / 2.431 = 1.059 m/kg^(1/3)

Kv = 0.0728 × 1.059^(-3.251) = 0.0728 / 1.198 = 0.0607
Rmax = 9.74 × (115 / 1.059^2.167)^(2/3) = 9.74 × (115 / 1.132)^(2/3)
     = 9.74 × (101.6)^(2/3) = 9.74 × 21.8 = 212m

Clearance = 212 × 2 = 424m
V₀ = √(212 × 9.81) = 45.6 m/s
```

---

## Comparison with Other Models

McKenzie typically produces ranges **between** Richards & Moore and Lundborg:

- **R&M** uses empirical K-factor with burden/stemming geometry — tends to be lower for well-designed blasts
- **McKenzie** uses physics-based SDoB — more sensitive to actual charge confinement
- **Lundborg** is a diameter-only upper bound — always the most conservative

McKenzie is particularly useful because:
1. It directly uses the SDoB parameter, which is widely understood in the industry
2. It links flyrock risk to charge confinement quality
3. The same SDoB calculation feeds the blast analytics heat map

---

## Relationship to Blast Analytics SDoB Shader

The blast analytics system (`SDoBModel.js`) uses the **same Chiappetta SDoB formula** to render a per-hole colour map across the blast pattern. Both implementations share:

- Same contributing charge calculation (m = 10 or 8 hole diameters)
- Same `D = St + 0.5 × Lcon` numerator
- Same `Wt_m^(1/3)` denominator

The GLSL shader computes SDoB per pixel in the fragment shader, while `FlyrockCalculator.js` computes it per hole in JavaScript. The formulas are identical.

---

## File References

- **Implementation**: `src/tools/flyrock/FlyrockCalculator.js` — `mckenzie()` function
- **SDoB Shader**: `src/shaders/analytics/models/SDoBModel.js` — GLSL implementation
- **3D Shroud**: `src/tools/flyrock/FlyrockShroudGenerator.js` — grid sampling with envelope
- **Dialog**: `src/dialog/popups/analytics/FlyrockShroudDialog.js`
- **Orchestration**: `src/helpers/FlyrockShroudHelper.js`
