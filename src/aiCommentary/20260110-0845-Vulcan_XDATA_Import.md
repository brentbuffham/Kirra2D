# Vulcan DXF XDATA Import Enhancement
**Date:** 2026-01-10 08:45
**Task:** Add Vulcan XDATA detection and entity creation in DXFParser

## Overview
Modified `DXFParser.js` to detect Vulcan XDATA in POLYLINE entities and automatically create appropriate line and text entities in Kirra.

## Problem
When importing Vulcan DXF files with XDATA:
- POLYLINE entities contained embedded metadata (VulcanName, VulcanBearing, VulcanDip, etc.)
- This metadata was being ignored during import
- No visual labels were created for blast holes

## Solution
Added XDATA parsing logic to:
1. Detect `MAPTEK_VULCAN` application data in POLYLINE entities
2. Extract `VulcanName` from XDATA (e.g., "ABC-001")
3. Create two Kirra entities:
   - **Line entity:** Named `lineVN_{VulcanName}` - the polyline geometry
   - **Text entity:** Named `textVN_{VulcanName}` - label at collar (first vertex)

## Implementation Details

### Modified Sections
**File:** `src/fileIO/AutoCadIO/DXFParser.js`

**Lines 213-299:** Enhanced POLYLINE parsing
- Added Vulcan XDATA detection call
- Modified entity naming logic
- Added text entity creation at collar position

**Lines 547-598:** New helper method `extractVulcanName()`
- Parses XDATA in multiple formats (different DXF parsers structure it differently)
- Looks for `VulcanName=` pattern in XDATA strings
- Handles both `extendedData` and `xdata` properties
- Returns null for non-Vulcan entities

### Entity Naming Convention
- **Standard entities:** `lineEntity_1`, `polyEntity_1`, etc. (existing behavior)
- **Vulcan entities:** `lineVN_ABC-001`, `textVN_ABC-001` (new behavior)

### Example XDATA Structure
```
POLYLINE
  ...vertices...
  1001 MAPTEK_VULCAN
  1000 VulcanName=ABC-001
  1000 VulcanBearing=45.0
  1000 VulcanDip=70.0
  1000 VulcanLength=15.5
```

### Created Entities in Kirra
```javascript
// Line entity
{
  entityName: "lineVN_ABC-001",
  entityType: "line",
  data: [
    { pointXLocation: x1, pointYLocation: y1, pointZLocation: z1, ... },
    { pointXLocation: x2, pointYLocation: y2, pointZLocation: z2, ... },
    { pointXLocation: x3, pointYLocation: y3, pointZLocation: z3, ... }
  ]
}

// Text entity at collar
{
  entityName: "textVN_ABC-001",
  entityType: "text",
  data: [{
    pointXLocation: x1,  // Same as first vertex
    pointYLocation: y1,
    pointZLocation: z1,
    text: "ABC-001",
    fontHeight: 12
  }]
}
```

## Benefits
1. ✅ **Preserves metadata:** Vulcan hole names retained during import
2. ✅ **Visual labels:** Text entities automatically created for identification
3. ✅ **Consistent naming:** `VN_` prefix makes Vulcan entities easily identifiable
4. ✅ **Non-destructive:** Standard DXF entities still work as before
5. ✅ **Flexible parsing:** Handles multiple XDATA formats from different parsers

## Future Enhancements
Could extract additional Vulcan properties:
- VulcanBearing → store in entity metadata
- VulcanDip → store in entity metadata
- VulcanLength → store in entity metadata
- VulcanDescription → use as tooltip

## Testing Recommendations
1. Import Vulcan DXF with XDATA
2. Verify `lineVN_` and `textVN_` entities appear in TreeView
3. Check text labels display at collar positions
4. Ensure standard DXF files still import correctly (no regression)

## Related Files
- `src/fileIO/AutoCadIO/DXFVulcanWriter.js` - Exports with XDATA
- `src/dialog/popups/export/DXFExportDialog.js` - Export dialog (disables text for Vulcan)
