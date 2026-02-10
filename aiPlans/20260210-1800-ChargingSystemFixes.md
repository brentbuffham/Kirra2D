# Charging System Fixes - Plan

**Date:** 2026-02-10
**Status:** COMPLETE

## Context

After verifying the template export, presplit config codes, and connector toolbar refresh, full charging workflow testing revealed 9 issues in the Deck Builder, rule engine, product editor, and cross-section rendering.

## Issues

| # | Issue | Priority | Files |
|---|-------|----------|-------|
| 1 | AIRDEC layout wrong (Stem→Charge→Spacer→Charge, should be Stem→Spacer→Air→Charge) | HIGH | SimpleRuleEngine.js |
| 2 | Spacers must stay fixed length from product definition | HIGH | HoleSectionView.js, DeckBuilderDialog.js |
| 3 | Deck deletion resizes spacers | HIGH | DeckBuilderDialog.js |
| 4 | Downhole detonator line from primer to collar missing | MED | HoleSectionView.js |
| 5 | No way to save/modify custom charge rules | HIGH | DeckBuilderDialog.js, ChargeConfig.js |
| 6 | Surface Connector edit loses delay (shows 0ms) | HIGH | ProductDialog.js |
| 7 | Cross-section text unreadable at small sizes | MED | HoleSectionView.js |
| 8 | Need "Remove Spacer" button (small spacers hard to select) | MED | DeckBuilderDialog.js |
| 9 | Multi-deck rule export (save complex designs as rules) | HIGH | DeckBuilderDialog.js, ChargeConfig.js |

## Fixes

### Fix 1: AIRDEC Layout - `src/charging/rules/SimpleRuleEngine.js`

**Function:** `applyAirDeck()` (lines 438-525)

**Current order:** Stem → Charge → Spacer/Air → Charge (charge split above/below air)
**Correct order (per Example 3):** Stem → Spacer → Air → Charge (single charge at bottom)

Rewrite deck creation:
1. Stemming deck (INERT) from collar: `0 → stemLen`
2. Gas bag spacer (SPACER): `stemLen → stemLen + spacerLen` (spacerLen from product `lengthMm/1000`)
3. Air deck (INERT, Air product): `stemLen + spacerLen → holeLen - chargeLen`
4. Charge deck (COUPLED) at bottom: `holeLen - chargeLen → holeLen`
5. Primer at `fx:chargeBase - chargeLength * 0.1` (90% into charge)

### Fix 2: Spacer Fixed Length Enforcement - `src/charging/ui/DeckBuilderDialog.js`

- Add helper: `isFixedSpacer(deck)` checks deck type and product `lengthMm`
- In gap-fill logic: skip SPACER decks, expand next non-spacer instead

### Fix 3: Deck Deletion Spacer Protection - `src/charging/ui/DeckBuilderDialog.js`

**Function:** `removeDeck()` (lines 285-314)

- When finding deck to expand for gap-fill, skip SPACER decks
- Walk further up/down to find next non-spacer deck to absorb gap
- If only spacers remain, expand closest inert deck

### Fix 4: Downhole Detonator Line - `src/charging/ui/HoleSectionView.js`

**Function:** `_drawPrimer()` (lines 577-670)

- Add dashed line from detonator position UP to collar for ShockTube (orange) and Electronic (blue)
- Currently only DetonatingCord gets a trace line (lines 660-669)

### Fix 5 + Fix 9: Save/Modify Rules - `src/charging/ui/DeckBuilderDialog.js` + `src/charging/ChargeConfig.js`

**New "Save as Rule" button** in DeckBuilderDialog footer.

**ChargeConfig extension:** Add `deckTemplate` array field:
```javascript
deckTemplate: [
    { type: "INERT", product: "Stemming", lengthMode: "fixed", length: 3.0 },
    { type: "SPACER", product: "GB230MM", lengthMode: "fixed", length: 0.4 },
    { type: "INERT", product: "Air", lengthMode: "fill" },
    { type: "COUPLED", product: "ANFO", lengthMode: "fixed", length: 6.0 }
]
```

**New rule engine function:** `applyCustomTemplate(hole, config)`:
- Lay out fixed-length decks from collar down
- "fill" deck gets remaining space
- If deck can't fit, replace with inert
- Primer at configured formula depth

### Fix 6: Surface Connector Delay Bug - `src/charging/ProductDialog.js`

**Root cause:** `getFieldsForCategory("Initiator")` shows all fields for all initiator types.

**Fix:** Conditional fields by `initiatorType`:
- Electronic/SurfaceWire: `minDelayMs`, `maxDelayMs`, `delayIncrementMs`
- ShockTube/SurfaceConnector/SurfaceCord/Electric: `delaySeriesMs`
- DetonatingCord: `coreLoadGramsPerMeter`

Dynamic rebuild on `initiatorType` select change.

### Fix 7: Cross-Section Text Scaling - `src/charging/ui/HoleSectionView.js`

Add `_fontScale = Math.max(0.8, Math.min(1.5, cssW / 350))` and multiply all hardcoded font sizes.

### Fix 8: "Remove Spacer" Button - `src/charging/ui/DeckBuilderDialog.js`

Add button next to "Remove Deck". If selected deck is SPACER, remove and expand adjacent non-spacer.

## Implementation Order

1. Fix 6 - Surface Connector delay bug (quick, isolated)
2. Fix 1 - AIRDEC layout (one function rewrite)
3. Fix 4 - Detonator line rendering (one function addition)
4. Fix 8 - Remove Spacer button (small UI addition)
5. Fix 2 + Fix 3 - Spacer protection (related changes)
6. Fix 7 - Font scaling (isolated)
7. Fix 5 + Fix 9 - Save/modify rules (largest feature)

## Verification

1. Apply AIRDEC rule → layout matches Example 3 (Stem→Spacer→Air→Charge)
2. Edit SurfaceConnector → delay series retained, no 0ms
3. Apply rule with primer → dashed line from primer to collar
4. Select spacer → Remove Spacer → adjacent deck fills gap, spacers untouched
5. Delete deck adjacent to spacer → spacer length unchanged
6. Edit Hole dialog → cross-section text readable at small size
7. Build multi-deck design → Save as Rule → Apply to another hole → layout matches
