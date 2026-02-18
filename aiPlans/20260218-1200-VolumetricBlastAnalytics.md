# Plan: Volumetric Blast Analytics — Support Arbitrary Surface Orientations

## Status: IMPLEMENTED

## Changes Made

### 1. SDoBModel 2D distance fix
**File:** `src/shaders/analytics/models/SDoBModel.js` (line 133)
- Changed `distance(vWorldPos.xy, posCharge.xy)` to `distance(vWorldPos, posCharge.xyz)`
- Now uses full 3D distance, consistent with all other models

### 2. ShaderTextureBaker.js — Major update
- **Z centering:** `uWorldOffset` now includes Z: `(centerX, centerY, centerZ)` instead of `(centerX, centerY, 0)`
- **`_buildSurfaceGeometry()`:** Now accepts and subtracts `centerZ` from vertex Z coords
- **`_computeSurfaceNormal(surface)`:** Area-weighted average normal with `isHorizontal` (|nz| > 0.95) and `isVertical` (|nz| < 0.05) flags
- **`_resolveTriangleVertices(tri, points)`:** Shared helper replacing 4 duplicated vertex resolution blocks
- **`_buildProjectionBasis(normal)`:** Gram-Schmidt orthonormal basis from surface normal
- **`_projectPointsToBasis(points, center, basis)`:** Projects points onto tangent/bitangent plane
- **`generateBasisUVs()`:** New UV generation method using projection basis
- **Adaptive camera:** Non-horizontal surfaces get camera oriented along surface normal
- **Return value:** Now includes `projectionBasis`, `surfaceNormal`, `center3D`, `isHorizontal`, `isVertical`

### 3. BlastAnalysisShaderHelper.js — Routing + direct shader mesh
- **`applyBlastAnalysisShader()`:** Routes based on `bakeResult.isHorizontal`:
  - Horizontal → existing bake pipeline (no behavior change)
  - Non-horizontal → `buildDirectShaderAnalysisMesh()` for 3D + adaptive bake for 2D
- **`buildDirectShaderAnalysisMesh()`:** New function that applies ShaderMaterial directly to mesh geometry (no UVs needed — fragment shader uses `vWorldPos`)
- **`buildAndRegisterAnalysisMesh()`:** Updated with basis-aware UV generation for non-horizontal baked surfaces

### 4. ShaderFlattenHelper.js — Surface normal support
- **`flatten()`:** New optional 4th parameter `options` with `surfaceNormal` and `projectionBasis`
- Non-horizontal surfaces get camera oriented along surface normal
- Horizontal surfaces unchanged (backward compatible)

## Backward Compatibility
- Horizontal surfaces auto-detected → existing bake pipeline → identical behavior
- `_computeSurfaceNormal()` threshold (`|nz| > 0.95`) ensures slight tilts use proven bake path
- SDoBModel 2D→3D distance change negligible for horizontal planes (Z difference ≈ 0)
- `ShaderFlattenHelper.flatten()` 4th param is optional — existing callers unaffected
