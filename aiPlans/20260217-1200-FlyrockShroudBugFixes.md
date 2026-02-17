# Fix Flyrock Shroud - Calculator Bugs & Data-Driven Parameters

**Date:** 2026-02-17
**Status:** COMPLETED (Phase 2)

## Phase 1: Calculator Bug Fixes

### `src/tools/flyrock/FlyrockCalculator.js`
- Split `richardsMoore()` into base values (FoS=1) and FoS-scaled distances
- Removed double FoS on `stemEject` (was FoS² due to deriving from `cratering`)
- Derive launch velocity from BASE distances (not FoS-inflated)

## Phase 2: Data-Driven Parameters (Charging Required)

### `src/dialog/popups/analytics/FlyrockShroudDialog.js`
- **Removed** fields: Stemming Length, Burden, Bench Height, Subdrill, Explosive Density
- These are now derived from per-hole data and charging decks
- **Kept**: Blast Pattern, Algorithm, K, FoS, Stem Eject Angle, Rock Density, Grid Resolution, End Angle, Transparency

### `src/tools/flyrock/FlyrockShroudGenerator.js`
- Rewrote `getHoleFlyrockParams()` to require charging data:
  - Stemming = topmost explosive deck depth
  - Charge length = explosive deck span
  - Explosive density = volume-weighted average across all explosive decks
  - Returns `null` if no charging data → hole is skipped
- Burden, benchHeight, subdrill from hole geometry (with placeholder detection)
- `generate()` returns `{ error: "NO_CHARGING" }` when all holes lack charging
- Logs first hole params for Excel verification

### `src/helpers/FlyrockShroudHelper.js`
- Handles `NO_CHARGING` error with a polite FloatingDialog warning
- Guides user to use Deck Builder to assign charging first
- Logs count of skipped holes when some but not all lack charging

## Known Issue: Charging Key Collision
`loadedCharging` is keyed by `hole.holeID` alone. If PRESPLIT has holeID=1 and PROBLAST also has holeID=1, they share charging data. The key should be `entityName + holeID` (e.g. "PRESPLIT:::1"). This is a systemic issue across the codebase, not specific to flyrock.
