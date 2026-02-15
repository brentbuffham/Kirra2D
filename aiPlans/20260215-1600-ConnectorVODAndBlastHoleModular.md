# Connector VOD Travel Time + BlastHole Modularization

**Date:** 2026-02-15
**Status:** COMPLETE

## Summary

Two changes implemented:

### 1. BlastHole Class Modularization
- Moved `BlastHole` class from `src/kirra.js` to `src/models/BlastHole.js`
- Added `connectorVodMs` field to the class
- Added TODO block describing future migration plan
- Updated kirra.js import

### 2. Connector VOD Travel Time
When a surface connector product (e.g., shock tube 2000 m/s, 25ms delay) connects two holes, the VOD travel time (distance / VOD * 1000ms) is now included in the timing calculation. Manual delay entry does not add travel time.

**Files created:**
- `src/models/BlastHole.js` - Modularized BlastHole class
- `src/helpers/ConnectorTimingHelper.js` - Pure math helpers for distance and travel time

**Files modified:**
- `src/kirra.js` - Removed BlastHole class, added import, added `window.activeConnectorVodMs`, modified delay listeners, connector click handlers, `calculateTimes`/`updateSurfaceTimes`, 2D/3D delay text display, legacy CSV header
- `src/charging/ui/ConnectorPresets.js` - Stores `window.activeConnectorVodMs` on preset click
- `src/fileIO/TextIO/BlastHoleCSVParser.js` - Parses `connectorVodMs` from header-mapped CSV
- `src/fileIO/TextIO/BlastHoleCSVWriter.js` - Exports `connectorVodMs` in 35-column format
- `src/helpers/DownholeTimingCalculator.js` - Uses effective surface delay (programmed + travel)

## Verification
- Build passes cleanly
- `connectorVodMs` round-trips via CSV export/import (allcolumns and 35-column formats)
- `timingDelayMilliseconds` remains the programmed delay only
- Fixed-column CSV formats (4, 7, 9, 12, 14, 30, 32) unchanged
