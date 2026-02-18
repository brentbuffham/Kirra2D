# Implementation: 10 Blast Analysis Features

## Completed: 2026-02-18

## Summary of Changes

### Phase 1: Voronoi SDoB Metric
- `kirra.html` — Added `<option value="sdob">Scaled Depth of Burial</option>` to voronoi dropdown
- `src/kirra.js` — Added SDoB calculation in `getVoronoiMetrics()` using `window.loadedCharging` data
- `src/kirra.js` — Added `getSDoBColor()` function (Red→Orange→Lime→Cyan→Blue spectrum)
- `src/kirra.js` — Added `case "sdob":` blocks for 2D and 3D voronoi rendering with Fixed (0–3.0) and Min-Max modes
- `src/kirra.js` — Added translation case for sdob
- `src/overlay/panels/LegendPanel.js` — Added SDoB gradient to `getGradientForMetric()`

### Phase 2: New GPU Shader Models
- **NEW** `src/shaders/analytics/models/SEEModel.js` — Specific Explosive Energy (SEE = 0.5 × ρ_e × VOD²)
- **NEW** `src/shaders/analytics/models/PressureModel.js` — Borehole Pressure with distance attenuation
- **NEW** `src/shaders/analytics/models/PowderFactorModel.js` — Volumetric Powder Factor with influence radius
- `src/shaders/analytics/BlastAnalyticsShader.js` — Registered all 3 new models
- `src/shaders/core/ColourRampFactory.js` — Added "pressure" colour ramp
- `src/shaders/index.js` — Exported all 3 new model classes

### Phase 3: Jointed Rock Damage Model
- **NEW** `src/shaders/analytics/models/JointedRockDamageModel.js` — PPV → stress → joint Mohr-Coulomb failure
- Registered and exported in BlastAnalyticsShader and index.js

### Phase 4a: CPU-side Detonation Simulation
- **NEW** `src/shaders/analytics/models/DetonationSimulator.js` — Multi-primer front propagation, collision detection, Em computation
- **NEW** `src/shaders/analytics/models/ElementDataPacker.js` — Pack Em + detonation time to RG Float DataTexture

### Phase 4b: Shader Time-Filtering
- `src/shaders/analytics/models/PPVModel.js` — Added `uDisplayTime` uniform + per-hole time filter
- `src/shaders/analytics/models/ScaledHeelanModel.js` — Added `uDisplayTime` uniform + per-hole time filter
- `src/shaders/analytics/models/HeelanOriginalModel.js` — Added `uDisplayTime` uniform + per-hole time filter
- `src/shaders/analytics/models/NonLinearDamageModel.js` — Added `uDisplayTime` uniform + per-hole time filter
- All backward compatible: `uDisplayTime = -1` means no filtering (show all)

### Phase 4c: Time Interaction UI
- **NEW** `src/dialog/popups/analytics/TimeInteractionDialog.js` — Real-time time slider dialog
- `src/dialog/popups/analytics/BlastAnalysisShaderDialog.js` — Added [Interact] button (Option1), conditional visibility for timing-capable models, model info and parameters for all new models
- `src/helpers/BlastAnalysisShaderHelper.js` — Updated MODEL_DISPLAY_NAMES and legend info for new models

## Dropped Items
- Items 4 (RWS) and 5 (RBS) — Not value-add per user decision
- Items 3 (SDoB shader) and 8 (Damage model) — Already implemented, verified correct

## New Files Created (8)
1. `src/shaders/analytics/models/SEEModel.js`
2. `src/shaders/analytics/models/PressureModel.js`
3. `src/shaders/analytics/models/PowderFactorModel.js`
4. `src/shaders/analytics/models/JointedRockDamageModel.js`
5. `src/shaders/analytics/models/DetonationSimulator.js`
6. `src/shaders/analytics/models/ElementDataPacker.js`
7. `src/dialog/popups/analytics/TimeInteractionDialog.js`
8. `src/aiPlans/20260218-1122-10BlastAnalysisFeatures.md`

## Modified Files (13)
1. `kirra.html` — Voronoi dropdown option
2. `src/kirra.js` — Voronoi SDoB metric (calc, color, 2D/3D switch cases, legend, translation)
3. `src/overlay/panels/LegendPanel.js` — SDoB gradient
4. `src/shaders/analytics/BlastAnalyticsShader.js` — Register 4 new models
5. `src/shaders/core/ColourRampFactory.js` — Pressure colour ramp
6. `src/shaders/index.js` — Export 4 new models
7. `src/shaders/analytics/models/PPVModel.js` — uDisplayTime time filter
8. `src/shaders/analytics/models/ScaledHeelanModel.js` — uDisplayTime time filter
9. `src/shaders/analytics/models/HeelanOriginalModel.js` — uDisplayTime time filter
10. `src/shaders/analytics/models/NonLinearDamageModel.js` — uDisplayTime time filter
11. `src/dialog/popups/analytics/BlastAnalysisShaderDialog.js` — [Interact] button, new model params/info
12. `src/helpers/BlastAnalysisShaderHelper.js` — Display names, legend info for new models
