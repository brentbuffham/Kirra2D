# Blast Analysis Enhancement Plan

## Context

The Blast Analysis dialog currently loses all settings on page reload. We need to add localStorage persistence, a new Scaled Depth of Burial (SDoB) analysis model, persist baked shader textures to IndexedDB, flatten analytics to 2D for GeoTIFF export, and generate 3D flyrock shroud surfaces using Richards & Moore, Lundborg, and McKenzie algorithms.

## Implementation Order

1. **Task 1** — localStorage persistence (standalone, unblocks all others)
2. **Task 2** — SDoB analysis model (new GPU shader model, needed by Task 5)
3. **Task 3** — Save baked analysis to IndexedDB (canvas→blob persistence)
4. **Task 4** — Flatten analytic to 2D image + GeoTIFF export
5. **Task 5** — Flyrock shroud surface (3D geometry generation)

---

## Task 1: Retain Dialog Settings in localStorage

**Key:** `kirra_blast_analysis_settings`

**Modify:** `src/dialog/popups/analytics/BlastAnalysisShaderDialog.js`

- On dialog open: `JSON.parse(localStorage.getItem("kirra_blast_analysis_settings"))` — use as fallback before `window.blastAnalyticsSettings`
- On Apply (onConfirm): `localStorage.setItem(key, JSON.stringify(settings))` — saves model, surfaceId, blastName, applyMode, planePadding, applyAsTexture, params
- In `updateModelParameters()`: Override default param values with saved values when model matches
- Wrap in try/catch (matching existing `kirra_csv_export_prefs` pattern)

---

## Task 2: SDoB Analysis Model

**Formula:** `SDoB = stemming / (massPerMetre × contributingLength)^(1/3)`
- `contributingLength = min(chargeLength, 10 × holeDiameter_m)` (from VBA line 162)
- `stemming = chargeTopDepth` (depth from collar to first explosive deck)
- Data already packed in shader DataTexture Row 3

**Create:** `src/shaders/analytics/models/SDoBModel.js` (~180 lines)
- Follows exact PPVModel pattern (3 methods: getDefaultParams, getFragmentSource, getUniforms)
- GLSL shader computes SDoB per-hole, assigns nearest (Voronoi-like) to each pixel
- Params: targetSDoB (1.5), maxDisplayDistance (50m), showVoronoiBorders (0/1)
- Colour ramp: Red (low SDoB, flyrock risk) → Yellow → Green (high SDoB, well confined)
- Black contour line at target SDoB threshold

**Modify:**
- `src/shaders/analytics/BlastAnalyticsShader.js` — import + `_registerModel(new SDoBModel())`
- `src/shaders/core/ColourRampFactory.js` — add `"sdob"` ramp
- `src/dialog/popups/analytics/BlastAnalysisShaderDialog.js` — add `case "sdob"` in getDefaultParametersForModel() and getModelInfo()
- `src/helpers/BlastAnalysisShaderHelper.js` — add SDoB to getShaderLegendInfo()

---

## Task 3: Save Baked Analysis to IndexedDB

**Problem:** Canvas/Texture objects cannot be serialized to IndexedDB.

**Solution:** Convert canvas → PNG Blob via `canvas.toBlob()`, store blob (blobs ARE serializable).

**Modify:** `src/helpers/BlastAnalysisShaderHelper.js` — bakeShaderToSurfaceTexture()
**Modify:** `src/kirra.js` — saveSurfaceToDB() and loadSurfaceIntoMemory()
**Create:** `src/helpers/AnalysisTextureRebuilder.js` (~60 lines) — blob → Image → canvas → THREE.CanvasTexture

---

## Task 4: Flatten Analytic to 2D Image

Use existing `ShaderFlattenHelper.flatten()` to render 3D shader to canvas.

**Modify:** `src/helpers/BlastAnalysisShaderHelper.js` — add flattenAnalysisTo2D()
**Modify:** `src/kirra.js` — 2D drawData() to render flattened overlay
**Modify:** `src/helpers/GeoTIFFExporter.js` — include flattened analysis in export list

---

## Task 5: Flyrock Shroud Surface

Reference: `src/referenceFiles/Perl-Lava/BRENTBUFFHAM_FlyrockShroud_Vulcan12Macros.pm`

**Create:** `src/tools/flyrock/FlyrockCalculator.js` — 3 algorithms:
  - Richards & Moore: faceBurst/cratering/stemEject + trajectory envelope alt=(V⁴-g²d²)/(2gV²)
  - Lundborg: Range = 260 × d^(2/3) (d in inches)
  - McKenzie 2009: Rangemax = 11×(ø/(Fs×SDoB^2.167))^0.667, Kv=0.0728×SDoB^(-3.251)
    SDoB_m = (St + 0.0005×ø×m) / (0.00923×ø³×ρexp)^(1/3)
**Create:** `src/tools/flyrock/FlyrockShroudGenerator.js` — concentric rings → triangulated surface
**Create:** `src/dialog/popups/analytics/FlyrockShroudDialog.js` — FloatingDialog
**Create:** `src/helpers/FlyrockShroudHelper.js` — orchestration
**Modify:** `src/kirra.js` — button handler, saveSurfaceToDB, loadSurfaceIntoMemory

## New Files (6)

| File | Purpose |
|------|---------|
| `src/shaders/analytics/models/SDoBModel.js` | SDoB GPU shader model |
| `src/helpers/AnalysisTextureRebuilder.js` | Rebuild baked texture from IndexedDB blob |
| `src/tools/flyrock/FlyrockCalculator.js` | Pure flyrock computation (3 algorithms) |
| `src/tools/flyrock/FlyrockShroudGenerator.js` | 3D shroud triangulation generator |
| `src/dialog/popups/analytics/FlyrockShroudDialog.js` | FloatingDialog for flyrock params |
| `src/helpers/FlyrockShroudHelper.js` | Orchestration helper |
