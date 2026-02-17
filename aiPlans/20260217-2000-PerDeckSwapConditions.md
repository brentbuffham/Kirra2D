# Per-Deck Product Swap Conditions — Implementation Summary

**Date:** 2026-02-17
**Status:** Implemented

## What Changed

Replaced the skeleton `wetHoleSwap`/`wetHoleProduct` fields on ChargeConfig with a full per-deck swap condition system.

### New File
- `src/charging/SwapCondition.js` — Parse, serialize, and evaluate swap conditions

### Modified Files
| File | Change |
|------|--------|
| `src/charging/ChargeConfig.js` | Removed `wetHoleSwap`/`wetHoleProduct` |
| `src/charging/Deck.js` | Added `swap`, `swappedFrom` fields |
| `src/charging/rules/SimpleRuleEngine.js` | Swap evaluation in `applyTemplate()`, `buildHoleState()` helper |
| `src/charging/ConfigImportExport.js` | `swap:` brace notation, removed wetHole CSV fields, swap examples in STNDFS |
| `src/charging/ui/DeckBuilderDialog.js` | Swap field per deck in Save As Rule dialog |
| `src/kirra.js` | Hole fields: `holeConditions`, `measuredTemperature`, `measuredTemperatureUnit`, `measuredTemperatureTimeStamp`, `perHoleCondition` |
| `src/fileIO/TextIO/BlastHoleCSVParser.js` | Parse new hole fields from CSV headers |
| `src/fileIO/TextIO/BlastHoleCSVWriter.js` | Export new hole fields in 35-column format |
| `src/dialog/popups/generic/HolePropertyDialogs.js` | `measuredTemperaturePopup()`, `holeConditionsPopup()` |
| `src/charging/docs/ChargeConfigCSV-README.txt` | Swap condition syntax docs |
| `src/charging/docs/ChargeConfigCSV-README.md` | Swap condition syntax docs (markdown) |

## Swap Rule Syntax

```
conditionCode{PRODUCT[,threshold]}
```

Multiple rules: `w{WR-ANFO}|r{Emulsion}|t{Emulsion,C>50}`

Condition codes: `w`=wet, `d`=damp, `r`=reactive, `t`=temperature, `x1`..`x20`=future

## CSV Deck Notation

```
{idx,top,base,product,VR,swap:w{WR-ANFO}|r{Emulsion}}
```

## Engine Resolution Flow

1. Build holeState from hole properties (conditions Set + temperature)
2. Check perHoleCondition (override) first
3. Fall back to deck swap rules
4. First matching condition wins
5. If swap product found and exists in loaded products, replace deck product
