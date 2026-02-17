# Blast Analytics

## Overview

The Blast Analytics system provides GPU-accelerated vibration and damage modelling overlaid on blast patterns. All calculations run in real-time on the GPU via WebGL fragment shaders, enabling interactive what-if analysis as holes are moved or charges are modified.

**Key Features:**
- **Five Analytics Models**: PPV Site Law, Heelan Original, Scaled Heelan, Non-Linear Damage, and Scaled Depth of Burial (SDoB)
- **GPU-Accelerated**: All per-pixel calculations run in GLSL fragment shaders
- **Reactive Updates**: Shader refreshes in real-time during hole drag or charge edits
- **Charging-Aware**: Reads actual charge column bounds, product VOD, and deck masses from the charging system
- **Multiple Render Targets**: Flat analysis plane, surface overlay, duplicate surface, or baked texture
- **2D Flattening**: GPU output can be read back to a canvas for 2D view overlay
- **Colour Ramp System**: Six predefined ramps (ppv, jet, viridis, damage, compliance, grey)

---

## How to Use

### Opening the Dialog

The Blast Analysis Shader dialog is accessed from the application menu. It presents the following controls:

| Field | Description |
|-------|-------------|
| **Analytics Model** | Select from PPV, Heelan Original, Scaled Heelan, Non-Linear Damage, or SDoB |
| **Render On** | Choose a loaded surface or "Generate Analysis Plane" for a flat rectangle |
| **Blast Pattern** | Filter to a specific blast entity or "All Blast Holes" |
| **Apply Mode** | "Overlay on Original" or "Create Duplicate Surface" |
| **Bake as Texture** | Checkbox to UV-map the result as a persistent texture on the surface |
| **Analysis Plane Distance** | Padding (m) around blast extent when using generated plane (default 200m) |

Each model has an expandable **Model Parameters** section where site constants and rock properties can be tuned. An **info panel** at the bottom explains the selected model's theory and parameters.

### Typical Workflow

1. Load blast holes and (optionally) a surface
2. Assign charging to holes (optional but recommended for Heelan models)
3. Open the Blast Analysis Shader dialog
4. Select a model and adjust parameters to match site calibration data
5. Click **Apply Analysis** to render the overlay
6. Drag holes or modify charges to see the shader update in real-time

---

## Analytics Models

### 1. PPV Site Law (`ppv`)

The simplest model. Computes Peak Particle Velocity using the empirical scaled-distance law.

**Formula:**
```
PPV = K * (D / Q^n)^(-b)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| K | 1140 | Site constant (intercept), calibrated from blast monitoring |
| b | 1.6 | Site exponent (attenuation slope), typical range 1.5-2.0 |
| n (chargeExponent) | 0.5 | Charge weight scaling exponent (0.5 = square-root, 0.33 = cube-root) |
| cutoffDistance | 1.0 m | Minimum distance to avoid singularity |
| targetPPV | 0 mm/s | Draw a black contour line at this PPV value (0 = disabled) |

**Output unit:** mm/s
**Default colour ramp:** `ppv` (green-yellow-orange-red)
**Default range:** 0-200 mm/s

**Best for:** Compliance predictions and comparison with monitoring data.

### 2. Heelan Original (`heelan_original`)

Physics-based model implementing Heelan's (1953) analytical solution as formulated by Blair & Minchinton (1996). Divides each charge column into M elements and computes P-wave and SV-wave contributions with radiation patterns.

**Radiation Patterns (Heelan 1953):**
```
F1(phi) = sin(2*phi) * cos(phi)    -- P-wave
F2(phi) = sin(phi) * cos(2*phi)    -- SV-wave
```

Where `phi` is the angle between the hole axis and the direction to the observation point.

**Element Superposition:**
```
u_P(R, phi)  ~ (Pb * a^2 * dL) / (rho * Vp^2 * R) * F1(phi)
u_SV(R, phi) ~ (Pb * a^2 * dL) / (rho * Vs^2 * R) * F2(phi)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| rockDensity | 2700 kg/m^3 | Rock mass density |
| pWaveVelocity | 4500 m/s | P-wave velocity (from seismic testing) |
| sWaveVelocity | 2600 m/s | S-wave velocity (from seismic testing) |
| detonationVelocity (VOD) | 5500 m/s | Fallback VOD when no product VOD is assigned |
| numElements | 20 | Number of charge elements for integration (max 64) |
| qualityFactorP | 50 | P-wave viscoelastic attenuation Q_p (0 = elastic) |
| qualityFactorS | 30 | S-wave viscoelastic attenuation Q_s (0 = elastic) |
| cutoffDistance | 0.5 m | Minimum distance |

**Borehole pressure** is auto-calculated: `Pb = rho_e * VOD^2 / 8`

**Output unit:** mm/s (Vector PPV)
**Default colour ramp:** `jet` (blue-cyan-green-yellow-red)
**Default range:** 0-300 mm/s

**Features:**
- Supports angled holes (uses collar-to-toe axis)
- Reads actual charge column bounds from charging data (falls back to 70% estimate)
- Per-hole VOD from assigned explosive products
- Viscoelastic attenuation (Blair & Minchinton 2006 extension)
- Below-toe attenuation for physical confinement

**References:**
- Heelan, P.A. (1953). "Radiation from a cylindrical source of finite length"
- Blair, D.P. & Minchinton, A. (1996). "On the damage zone surrounding a single blasthole", Fragblast-5
- Blair, D.P. & Minchinton, A. (2006). "Near-field blast vibration models", Fragblast-8

### 3. Scaled Heelan (`scaled_heelan`)

Bridges the site law with Heelan radiation patterns. Each elemental waveform peak is given by the site law, while retaining directional radiation from the Heelan model. Developed by Blair & Minchinton (2006).

**Element PPV (Blair's Non-Linear Superposition):**
```
Em = [m*we]^A - [(m-1)*we]^A       -- incremental effective mass
SD = R / Em                          -- scaled distance
PPV_element = K * SD^(-B) * F(phi)   -- per-element PPV
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| K | 1140 | Site constant (same as PPV model) |
| B | 1.6 | Site exponent |
| chargeExponent | 0.5 | Charge weight scaling exponent |
| numElements | 20 | Charge discretisation count (max 64) |
| pWaveVelocity | 4500 m/s | Controls radiation pattern shape |
| sWaveVelocity | 2600 m/s | Controls radiation pattern shape |
| detonationVelocity | 5500 m/s | Fallback VOD |
| pWaveWeight | 1.0 | Relative P-wave contribution weight |
| svWaveWeight | 1.0 | Relative SV-wave contribution weight |
| cutoffDistance | 0.5 m | Minimum distance |
| qualityFactorP | 50 | P-wave attenuation (0 = none) |
| qualityFactorS | 30 | S-wave attenuation (0 = none) |

**Output unit:** mm/s (Vector PPV)
**Default colour ramp:** `ppv`
**Default range:** 0-300 mm/s

**Best for:** Compliance prediction with directional accuracy. Recommended for sites with calibrated K and b values where structures are near the blast.

**Reference:** Blair, D.P. & Minchinton, A. (2006). "Near-field blast vibration models", Fragblast-8

### 4. Non-Linear Blast Damage (`nonlinear_damage`)

Implements the Holmberg-Persson damage model. Computes cumulative damage index based on PPV threshold for crack initiation and propagation.

**Formula:**
```
PPV_hole = K_hp * (linearCharge)^alpha * D^(-beta)
DamageIndex = cumulative_PPV / PPV_critical
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| rockUCS | 120 MPa | Unconfined Compressive Strength |
| rockTensile | 12 MPa | Tensile Strength (typically UCS/10) |
| ppvCritical | 700 mm/s | PPV threshold for new crack initiation |
| K_hp | 700 | Holmberg-Persson site constant |
| alpha_hp | 0.8 | Charge length exponent |
| beta_hp | 1.4 | Distance exponent |
| cutoffDistance | 0.3 m | Minimum distance |

**Output unit:** DI (Damage Index, 0-1)
**Default colour ramp:** `damage` (blue-green-yellow-red-dark red)
**Default range:** 0-1

**Best for:** Fragmentation analysis, overbreak prediction, damage zone mapping.

### 5. Scaled Depth of Burial (`sdob`)

Implements the Chiappetta & Treleven (1997) Scaled Depth of Burial analysis. Each pixel shows the SDoB of its nearest hole, rendered as a colour gradient from red (flyrock risk) through lime green (target) to blue (safe). An optional contour line highlights the target SDoB value.

**Formula (Chiappetta & Treleven 1997):**
```
D    = St + 0.5 × contributingLen     (distance from surface to centre of contributing charge)
SDoB = D / Wt_m^(1/3)                 (m/kg^(1/3))
```

**Contributing charge:**
```
m = 10 for ø >= 100mm, 8 for smaller holes
contributingLen = min(chargeLen, m × ø_m)
Wt_m = massPerMetre × contributingLen
```

Where `massPerMetre = π × r² × density × 1000` (kg/m).

| Parameter | Default | Description |
|-----------|---------|-------------|
| targetSDoB | 1.5 m/kg^(1/3) | Target SDoB contour (lime green highlight band) |
| maxDisplayDistance | 50 m | Maximum distance from nearest hole to render |
| fallbackDensity | 1.2 kg/L | Fallback explosive density when no charging data |

**Output unit:** m/kg^(1/3)
**Default colour ramp:** `sdob` (red-orange-lime green-cyan-blue)
**Default range:** 0-3.0 m/kg^(1/3)

**SDoB risk levels:**

| SDoB (m/kg^(1/3)) | Colour | Interpretation |
|---|---|---|
| < 0.8 | Red | Severe flyrock risk — crater formation likely |
| 0.8 – 1.2 | Orange | Elevated flyrock risk — review stemming |
| 1.2 – 1.8 | Lime green | Normal blast conditions (target zone) |
| 1.8 – 2.5 | Cyan | Well-confined blast |
| > 2.5 | Blue | Over-confined — may affect fragmentation |

**Features:**
- Reads actual per-hole charging data (stemming, charge column, density) from the DataTexture
- Fallback explosive density only used when a hole has no charging data at all
- Target SDoB contour rendered as a bright lime green band
- Edge fade near the maximum display distance for smooth visualisation

**References:**
- Chiappetta, R.F. & Treleven, J.P. (1997). Scaled Depth of Burial concept
- McKenzie, C. (2009/2022). Flyrock range prediction using SDoB — see [Flyrock Model: McKenzie](Flyrock-Model-McKenzie)

---

## Architecture

### File Structure

```
src/shaders/
  analytics/
    BlastAnalyticsShader.js         -- Main orchestrator
    models/
      PPVModel.js                   -- PPV site law model
      HeelanOriginalModel.js        -- Heelan (1953) model
      ScaledHeelanModel.js          -- Blair & Minchinton (2006) model
      NonLinearDamageModel.js        -- Holmberg-Persson damage model
      SDoBModel.js                  -- Chiappetta Scaled Depth of Burial
  core/
    BaseAnalyticsShader.js          -- Abstract base class
    ShaderUniformManager.js         -- Packs hole data into GPU textures
    ColourRampFactory.js            -- Generates 1D colour ramp textures
    ShaderFlattenHelper.js          -- Renders shader to 2D canvas
src/helpers/
    BlastAnalysisShaderHelper.js    -- High-level API (apply, clear, refresh)
    ShaderTextureBaker.js           -- Bakes shader to persistent UV-mapped texture
src/dialog/popups/analytics/
    BlastAnalysisShaderDialog.js    -- User interface dialog
```

### Data Flow

```
User Dialog  -->  BlastAnalysisShaderHelper.applyBlastAnalysisShader()
                       |
                       v
              BlastAnalyticsShader.setModel(name, params)
              BlastAnalyticsShader.update(allBlastHoles)
              BlastAnalyticsShader.buildPlane(bounds, elevation)
                       |
                       v
              ShaderUniformManager.packHoles()  -->  DataTexture (GPU)
              ActiveModel.getFragmentSource()   -->  GLSL shader
              ColourRampFactory.create()        -->  Colour ramp texture
                       |
                       v
              THREE.ShaderMaterial  -->  THREE.Mesh  -->  Scene
                       |
                       v (optional)
              ShaderFlattenHelper.flatten()  -->  2D Canvas overlay
              ShaderTextureBaker.bake()      -->  Persistent surface texture
```

### GPU Data Texture Layout

Hole data is packed into a `512 x 4` RGBA float DataTexture via `ShaderUniformManager`. Each hole occupies one column (4 pixels = 16 floats):

| Row | RGBA Channels | Content |
|-----|---------------|---------|
| 0 | R, G, B, A | collarX, collarY, collarZ, totalChargeKg |
| 1 | R, G, B, A | toeX, toeY, toeZ, holeLengthM |
| 2 | R, G, B, A | MIC_kg, timing_ms, holeDiam_mm, unused |
| 3 | R, G, B, A | chargeTopDepth_m, chargeBaseDepth_m, vodMs, totalExplosiveMassKg |

**Row 3** is populated from actual charging data (`window.loadedCharging`) when available:
- `chargeTopDepth` = depth from collar to top of first explosive deck (stemming length)
- `chargeBaseDepth` = depth from collar to bottom of deepest explosive deck
- `vodMs` = mass-weighted average VOD across all explosive decks
- `totalExplosiveMassKg` = sum of all explosive deck masses

When no charging data exists, Row 3 values are 0 and the shader falls back to estimating 70% of hole length as charged.

### Colour Ramps

Available ramps defined in `ColourRampFactory`:

| Name | Stops | Use Case |
|------|-------|----------|
| `ppv` | green-yellow-orange-red | PPV and Scaled Heelan models |
| `jet` | blue-cyan-green-yellow-red | Heelan Original model |
| `viridis` | purple-teal-green-yellow | Scientific visualization |
| `damage` | blue-green-yellow-red-dark red | Damage index |
| `compliance` | green-yellow-red | Pass/fail compliance |
| `sdob` | red-orange-lime green-cyan-blue | Scaled Depth of Burial |
| `grey` | black-white | Greyscale output |

---

## Render Modes

### 1. Analysis Plane (Default)

Generates a flat `THREE.PlaneGeometry` covering the blast extent with configurable padding (default 200m). The plane is positioned at collar elevation. Good for quick overview analysis.

### 2. Surface Overlay

Applies the shader directly to an existing loaded surface mesh. The original surface is hidden and replaced with the shader-driven version.

### 3. Duplicate Surface

Creates a copy of the selected surface and applies the shader to the duplicate. The original surface remains untouched. Useful for side-by-side comparison.

### 4. Baked Texture

Renders the shader to a persistent UV-mapped texture on the surface. The texture is saved to IndexedDB and persists across sessions. Visible in both 2D and 3D views without requiring the shader to be active.

---

## Reactive Updates

The shader system supports two update paths:

### Full Update
Called when hole data changes significantly (add/remove holes, charge assignment changes):
```javascript
BlastAnalyticsShader.update(allBlastHoles, options)
```
Repacks the entire DataTexture via `ShaderUniformManager.packHoles()`.

### Single-Hole Update
Called during drag operations for real-time feedback:
```javascript
BlastAnalyticsShader.updateSingleHole(index, hole, options)
```
Updates only the relevant texels in the DataTexture without a full repack.

### Charging Change Refresh
When charging data is modified, call:
```javascript
BlastAnalysisShaderHelper.refreshShaderForChargingChange()
```
This re-applies the current shader settings with updated charging data.

---

## Limitations

- **Maximum 512 holes** per analysis (DataTexture width constraint)
- **Maximum 64 charge elements** per hole for Heelan/Scaled Heelan models (GLSL loop limit)
- Fragment shader loops over all holes for every pixel, so performance scales with hole count
- The PPV site law model treats each hole as a single point charge; Heelan models discretise the charge column
- Below-toe attenuation in Heelan models uses an exponential decay approximation
- Borehole pressure in Heelan Original is estimated from VOD; field-measured values are not yet supported

---

## Programmatic API

```javascript
// Create shader instance
var analytics = new BlastAnalyticsShader(sceneManager);

// List available models
var models = analytics.getAvailableModels();
// => [{ name: "ppv", displayName: "Peak Particle Velocity (PPV)", unit: "mm/s" }, ...]

// Set model and parameters
analytics.setModel("scaled_heelan", { K: 1140, B: 1.6, chargeExponent: 0.5 });

// Update with hole data
analytics.update(window.allBlastHoles);

// Build plane mesh and add to scene
var mesh = analytics.buildPlane(bounds, elevation, padding);
scene.add(mesh);

// Update single hole during drag
analytics.updateSingleHole(index, updatedHole);

// Flatten to 2D canvas
var result = analytics.flatten(renderer, bounds, pixelsPerMetre);
// result.canvas is an HTMLCanvasElement

// Dispose when done
analytics.dispose();
```

### High-Level Helper API

```javascript
import { applyBlastAnalysisShader, clearBlastAnalysisShader } from "./helpers/BlastAnalysisShaderHelper.js";

// Apply via dialog config
applyBlastAnalysisShader({
    model: "scaled_heelan",
    surfaceId: "__PLANE__",
    blastName: "__ALL__",
    applyMode: "overlay",
    applyAsTexture: false,
    planePadding: 200,
    params: { K: 1140, B: 1.6 }
});

// Clear overlay
clearBlastAnalysisShader();
```
