# Flyrock Model: Lundborg (1975/1981)

## Overview

The Lundborg model is an empirical **upper-bound** flyrock range estimate based solely on borehole diameter. It represents the maximum observed flyrock distance from Swedish blast data and is intentionally conservative — it does not account for stemming quality, burden, or confinement.

This model is useful as a worst-case screening tool when detailed blast design parameters are uncertain.

---

## References

> Lundborg, N., Persson, A., Ladegaard-Pedersen, A. & Holmberg, R. (1975) "Keeping the lid on flyrock in open-pit blasting", Engineering and Mining Journal, 176, pp. 77-81.

> Lundborg, N. (1981) "The probability of flyrock", SveDeFo Report DS 1981:14.

> Roth, J.A. (1979) — Cited Lundborg formula with units: d in inches, Lmax in feet.

---

## Input Parameters

| Parameter | Symbol | Unit | Default | Source |
|---|---|---|---|---|
| Hole diameter | ø | mm | 115 | Hole data |
| Factor of Safety | FoS | - | 2 | User input (dialog) |

This is the simplest of the three models — only hole diameter is required.

---

## Formula

```
Lmax (feet) = 260 × d^(2/3)
```

Where:
- d = borehole diameter in **inches**
- Lmax = maximum flyrock range in **feet**

Convert to metres:
```
Lmax (metres) = 260 × d^(2/3) × 0.3048
```

Clearance distance with safety factor:
```
Clearance = Lmax × FoS
```

### Unit Conversion Note

The original Lundborg/Roth formula uses **Imperial units** (inches and feet). The factor 0.3048 converts the result to metres. Early implementations that omitted this conversion produced ranges approximately 3.3× too large.

---

## Example Calculations

| Hole Diameter (mm) | d (inches) | Lmax (feet) | Lmax (metres) | Clearance (FoS=2) |
|---|---|---|---|---|
| 89 | 3.50 | 599 | 183 | 365 |
| 115 | 4.53 | 712 | 217 | 434 |
| 127 | 5.00 | 757 | 231 | 461 |
| 165 | 6.50 | 905 | 276 | 552 |
| 200 | 7.87 | 1031 | 314 | 628 |
| 311 | 12.24 | 1383 | 421 | 843 |

---

## Comparison with Other Models

Lundborg is typically the **most conservative** of the three models because it represents an empirical upper-bound envelope and ignores design parameters that mitigate flyrock (stemming, burden, confinement).

For a 165mm hole with typical blast parameters (burden=4m, stemming=2.5m, K=20, FoS=2):

| Model | Range (FoS=1) | Clearance (FoS=2) |
|---|---|---|
| Richards & Moore | ~165m | ~330m |
| McKenzie | ~212m | ~424m |
| Lundborg | ~276m | ~552m |

McKenzie typically sits between R&M and Lundborg because it accounts for charge confinement (SDoB) but uses a more conservative empirical envelope than R&M.

---

## Limitations

- **No confinement accounting**: Does not consider stemming, burden, or blast geometry
- **Conservative bias**: Represents worst-case Swedish data — may significantly overestimate for well-designed blasts
- **Diameter-only**: Cannot distinguish between a well-stemmed and poorly-stemmed blast of the same diameter
- **Historical data**: Based on 1970s Swedish quarrying practice — hole diameters, explosives, and drilling accuracy have changed

---

## When to Use

- **Screening assessments**: Quick upper-bound check before detailed analysis
- **Regulatory compliance**: Some jurisdictions accept Lundborg as a conservative clearance estimate
- **Comparison baseline**: Provides context for R&M and McKenzie results
- **Limited data**: When only hole diameter is known (no charging data available)

---

## File References

- **Implementation**: `src/tools/flyrock/FlyrockCalculator.js` — `lundborg()` function
- **3D Shroud**: `src/tools/flyrock/FlyrockShroudGenerator.js` — uses `envelopeAltitude()` with velocity derived from Lundborg range
- **Dialog**: `src/dialog/popups/analytics/FlyrockShroudDialog.js`
