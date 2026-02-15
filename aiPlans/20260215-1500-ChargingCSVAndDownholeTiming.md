# Charging CSV Export & Downhole Timing Implementation

**Date:** 2026-02-15
**Status:** COMPLETE

## Summary

Added 4 charging-specific CSV export formats to BlastHoleCSVWriter, a ChargingExportDialog for format selection, a DownholeTimingCalculator helper, and downhole timing visualization in both 2D and 3D views.

## Files Created (3 new files)

| File | Lines | Purpose |
|------|-------|---------|
| `src/dialog/popups/export/ChargingExportDialog.js` | ~160 | FloatingDialog for charging CSV export format selection |
| `src/helpers/DownholeTimingCalculator.js` | ~160 | Per-deck fire time calculation with color mapping |

## Files Modified (4 files)

| File | Changes |
|------|---------|
| `src/fileIO/TextIO/BlastHoleCSVWriter.js` | Added 4 charging formats + escapeCSV helper |
| `src/draw/canvas3DDrawing.js` | Added downhole timing 3D labels with color coding |
| `src/kirra.js` | Import DownholeTimingCalculator, import ChargingExportDialog, add `downholeTiming` to getDisplayOptions(), add 2D timing rendering, add charging format intercept in CSV export handler |
| `kirra.html` | Added 4 charging options to holesColumnFormat dropdown, added display6D toggle for downhole timing |

## New CSV Charging Formats

### charging-summary
One row per hole. Columns: entityName, holeID, holeType, holeDiameterMm, holeLengthCalculated, collarXYZ, toeXYZ, surfaceDelayMs, totalExplosiveMassKg, powderFactor, deckCount, explosiveDeckCount, primerCount, stemLengthM, chargeLengthM, hasCharging.

### charging-detail
One row per deck per hole. Columns: entityName, holeID, deckIndex, deckID, deckType, topDepthM, baseDepthM, lengthM, productName, productDensity, massKg, scalingMode, holeDiameterMm.

### charging-primers
One row per primer per hole. Columns: entityName, holeID, primerIndex, primerID, lengthFromCollarM, deckID, detonatorName/Type/DelayMs/VodMs/Qty, boosterName/MassGrams/Qty, totalDownholeDelayMs, totalBoosterMassGrams.

### charging-timing
One row per explosive deck with fire times. Columns: entityName, holeID, deckIndex, deckType, topDepthM, baseDepthM, lengthM, productName, massKg, surfaceDelayMs, downholeDelayMs, totalFireTimeMs.

## Downhole Timing Visualization

- **Color scheme:** Blue (early) -> Green (mid) -> Red (late), normalized across all holes
- **2D:** Text labels on right side of toe showing "Xms" per explosive deck
- **3D:** Same labels using drawHoleTextThreeJS with color-coded fire times
- **Toggle:** Checkbox `display6D` in display toolbar (uses holetimes.png icon)
- **Cache:** Global timing range cached per draw cycle, cleared on clearThreeJS() and drawData()

## DownholeTimingCalculator API

```javascript
// Calculate all deck fire times
const entries = calculateDownholeTimings(allBlastHoles, chargingMap, options);
// entries: [{holeID, deckIndex, deckType, topDepthM, baseDepthM, massKg, surfaceDelayMs, downholeDelayMs, totalFireTimeMs, primerID}, ...]

// Get min/max range
const range = getTimingRange(entries); // {minMs, maxMs, rangeMs}

// Normalize and colorize
const t = normalizeFireTime(fireTimeMs, range.minMs, range.rangeMs); // 0-1
const color = fireTimeToColor(t); // "#RRGGBB"
```

## Build Status
- Build: PASS (no new errors)
- All imports resolve correctly
