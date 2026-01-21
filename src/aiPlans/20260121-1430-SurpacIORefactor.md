# Surpac IO Refactor Plan
**Date**: 2026-01-21 14:30
**Status**: Completed (pending testing)

## Overview
Refactor Surpac file parsers and writers to comply with official specification and add binary support.

## Reference Specification
- URL: https://www.cse.unr.edu/~fredh/papers/working/vr-mining/string.html
- STR Format: Header, Axis, String records, Null records, End record
- DTM Format: Triangle connectivity referencing STR vertices

## Key Findings from Review

### STR Format Rules (Specification)
1. **Header Record** (Line 1): location, date, purpose, memo - 4 fields
2. **Axis Record** (Line 2): `0, y1, x1, z1, y2, x2, z2` - string# always 0
3. **String Records**: `string#, Y, X, Z, D1, D2, D3...` - the actual data
4. **Null Record**: `0, 0.000, 0.000, 0.000,` - marks END of a string/segment
5. **End Record**: `0, 0.000, 0.000, 0.000, END` - marks end of file

### Critical Issue Found
- **Current Bug**: `SurpacSTRParser.js` uses "change in string#" as delimiter
- **Correct Per Spec**: NULL RECORD (string# = 0) is the delimiter that ends a string
- Points with same string# between null records form a connected string (polyline)

### Working Files
- `SurpacSurfaceParser.js` - Correctly combines STR + DTM for surfaces (text works)
- `SurpacSTRWriter.js` - Works for blast holes with Surpac 6.3 format
- `SurpacDTMWriter.js` - Works for text DTM export

### Files Needing Fixes
- `SurpacSTRParser.js` - Fix NULL RECORD handling, add unique names, add binary
- `SurpacSurfaceParser.js` - Enable binary support (already has code, just disabled)

### Files to Deprecate
- `SurpacDTMParser.js` - Standalone, incorrect (treats DTM as point cloud)
- `SurpacBinaryDTMParser.js` - Standalone, incorrect approach
- `V2Surpac/` folder - Remove after extracting useful code

## Implementation Tasks

### Task 1: Fix SurpacSTRParser.js ✅ COMPLETED
- [x] Change delimiter from string# change to NULL RECORD
- [x] Add entity counter for unique names (baseName_0001 format)
- [x] Extract D1, D2, D3... description fields properly
- [x] Maintain blast hole import support

### Task 2: Add Binary Support to SurpacSTRParser.js ✅ COMPLETED
- [x] Enable binary detection
- [x] Integrate binary parsing logic directly into SurpacSTRParser
- [x] Return consistent data structure (kadEntities and/or blastHoles)

### Task 3: Enable Binary in SurpacSurfaceParser.js ✅ COMPLETED
- [x] Enable binary detection for both STR and DTM
- [x] Implement parseBinaryVertices() method
- [x] Improve findBinaryHeaderEnd() to locate triangle data start

### Task 4: Deprecate Unused Files ✅ COMPLETED
- [x] Mark SurpacDTMParser.js as deprecated (added warning header)
- [x] Mark SurpacBinaryDTMParser.js as deprecated (added warning header)
- [x] Mark SurpacBinarySTRParser.js as deprecated (functionality moved to SurpacSTRParser)
- [x] Remove V2Surpac folder

### Task 5: Testing
- [ ] Test with text STR files
- [ ] Test with binary STR files
- [ ] Test with text DTM+STR surface pairs
- [ ] Test with binary DTM+STR surface pairs
- [ ] Verify unique naming works correctly

## Binary Format Notes

### Binary STR Format
- Text header (2 lines) followed by binary data
- Each record: string# (1 byte) + Y,X,Z (3x double little-endian) + description (null-terminated)
- 8+ consecutive null bytes indicate record separator

### Binary DTM Format
- Text header referencing STR file
- OBJECT and TRISOLATION metadata
- Triangle data: 7 x 4-byte int32 little-endian per triangle
- Format: triangleID, v1, v2, v3, neighbor1, neighbor2, neighbor3

## Files Modified
- `src/fileIO/SurpacIO/SurpacSTRParser.js` - **Major refactor**: NULL RECORD delimiter, unique naming, binary support, blast hole detection
- `src/fileIO/SurpacIO/SurpacSurfaceParser.js` - **Enhanced**: Enable binary STR+DTM parsing, improved header finding
- `src/fileIO/SurpacIO/SurpacDTMParser.js` - **Deprecated**: Added warning header
- `src/fileIO/SurpacIO/SurpacBinaryDTMParser.js` - **Deprecated**: Added warning header
- `src/fileIO/SurpacIO/SurpacBinarySTRParser.js` - **Deprecated**: Functionality moved to SurpacSTRParser

## Files Removed
- `src/fileIO/SurpacIO/V2Surpac/` folder (7 files) - Code extracted and integrated
