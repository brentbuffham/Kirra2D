# Plan: Analysis Models — Per-Deck Data, PPV Enhancement, WebGL Fix
## Implemented: 2026-02-18

## Summary of Changes

### Part A: Fix WebGL Context Leak ✅
**File:** `src/helpers/ShaderTextureBaker.js`
- Added static `_offscreenRenderer` and `_offscreenCanvas` class properties
- Added `_getOffscreenRenderer(resolution)` static method — creates once, resizes on reuse
- Removed per-call `new THREE.WebGLRenderer()` and `.dispose()`
- Prevents exhausting browser's ~8-16 WebGL context limit during rapid shader bakes

### Part B: Enhanced Deck Data Texture ✅
**File:** `src/shaders/analytics/models/PowderFactorModel.js` — `prepareDeckDataTexture()`
- Expanded from 2-row to 3-row layout:
  - Row 0: [topWorldX, topWorldY, topWorldZ, deckMassKg]
  - Row 1: [baseWorldX, baseWorldY, baseWorldZ, densityKgPerL]
  - Row 2: [vodMs, holeDiamMm, timing_ms, holeIndex]
- Extracts product density and VOD per deck
- Updated PowderFactorModel shader `getDeckData()` row denominator from 2.0 to 3.0

**File:** `src/helpers/BlastAnalysisShaderHelper.js`
- `prepareDeckDataTexture()` now called for ALL models (not just PowderFactor)
- Added `ppv_deck` to MODEL_DISPLAY_NAMES and legend info

### Part C1: PressureModel — Per-Deck with distToSegment ✅
**File:** `src/shaders/analytics/models/PressureModel.js`
- Completely rewritten to use per-deck data texture
- Uses `distToSegment` for smooth contours (no discrete element artifacts)
- Per-deck density/VOD for accurate Pb calculation
- Removed `uNumElements` uniform

### Part C2: NonLinearDamageModel — Per-Deck Sub-Elements ✅
**File:** `src/shaders/analytics/models/NonLinearDamageModel.js`
- Rewritten to iterate over actual decks from deck texture
- Sub-divides each deck into `uElemsPerDeck` (default 8) sub-elements
- Air gaps between decks naturally excluded
- Replaced `uNumElements` with `uElemsPerDeck`

### Part C2: JointedRockDamageModel — Per-Deck Sub-Elements ✅
**File:** `src/shaders/analytics/models/JointedRockDamageModel.js`
- Rewritten to use per-deck data texture with sub-elements
- Same pattern as NonLinearDamage but with joint failure calculation
- Replaced `uNumElements` with `uElemsPerDeck`

### Part C3: HeelanOriginalModel — Per-Deck with Radiation Patterns ✅
**File:** `src/shaders/analytics/models/HeelanOriginalModel.js`
- Rewritten to use per-deck data texture
- Gets hole axis via `holeIndex` from deck data → main hole texture
- Each deck uses its own VOD for frequency/attenuation
- Replaced `uNumElements` with `uElemsPerDeck`

### Part C3: ScaledHeelanModel — Per-Deck with Blair Superposition ✅
**File:** `src/shaders/analytics/models/ScaledHeelanModel.js`
- Rewritten to use per-deck data texture
- Blair's non-linear superposition (Em) applied per deck
- Replaced `uNumElements` with `uElemsPerDeck`

### Part D1: PPV Model Enhancement ✅
**File:** `src/shaders/analytics/models/PPVModel.js`
- Point source moved from collar to charge centroid (midpoint of charge column)
- Added timing window support: `timeWindow` and `timeOffset` parameters
- When timing window active: mass-weighted centroid of in-window charges
- When timeWindow=0: per-hole peak from charge centroid (improved default)

### Part D2: New PPV Deck Model ✅
**New file:** `src/shaders/analytics/models/PPVDeckModel.js`
- Per-deck PPV using deck data texture
- 3-point evaluation per deck (top, centre, base), takes max
- Timing window support: combines in-window deck masses
- Registered in BlastAnalyticsShader.js

### Models NOT Changed
- **SDoBModel** — Already uses segment distance
- **SEEModel** — IDW hole-level, adequate
- **DetonationSimulator** — JS pre-processing, not a shader model
- **PowderFactorModel shader** — Already used per-deck data (only texture layout updated)
