# Surpac Surface Format - DTM + STR Paired Files

**Date:** 2026-01-05
**Status:** Complete
**Priority:** Critical Understanding

---

## Overview

Surpac surface files come as **PAIRS** with the same base filename:
- **STR file**: Contains VERTICES (point list with Y, X, Z coordinates)
- **DTM file**: Contains TRIANGULATION (triangle indices referencing the STR vertices)

Together they create a triangulated surface.

---

## File Format Details

### STR File Format (Vertices)

**Purpose:** Stores the vertex list for the surface

**Format:**
```
header_name,date,source,
0, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
1, Y1, X1, Z1
1, Y2, X2, Z2
1, Y3, X3, Z3
...
0, 0.000, 0.000, 0.000, END
```

**Example (251228_s4_226_406_topo.str):**
```
251226_s4, 28-Dec-25, RIEGL RiSCAN PRO 2.22,
0, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
1, 6771726.526, 477988.662, 237.442
1, 6771726.276, 477989.162, 237.175
1, 6771726.026, 477989.662, 236.984
...
```

**Characteristics:**
- String number is always 1 for surface vertices
- Y, X, Z coordinates (Northing, Easting, Elevation)
- Vertices are numbered sequentially starting from 1
- File contains ~72,236 vertices for reference surface

---

### DTM File Format (Triangulation)

**Purpose:** Stores triangle connectivity using vertex indices from the STR file

**Format:**
```
header_name,
0, 0.000, 0.000, 0.000, END
OBJECT, 1,
TRISOLATION, 1, neighbours=no,validated=true,closed=no
triangle_id, v1_index, v2_index, v3_index, 0, 0, 0,
triangle_id, v1_index, v2_index, v3_index, 0, 0, 0,
...
0, 0.000, 0.000, 0.000, END
```

**Example (251228_s4_226_406_topo.dtm):**
```
251228_s4_226_406_topo.str,
0, 0.000, 0.000, 0.000, END
OBJECT, 1,
TRISOLATION, 1, neighbours=no,validated=true,closed=no
1, 5, 3, 2, 0, 0, 0,
2, 3, 1, 2, 0, 0, 0,
3, 8, 6, 3, 0, 0, 0,
4, 8, 7, 6, 0, 0, 0,
...
```

**Characteristics:**
- `OBJECT, 1,` marks the start of object definition
- `TRISOLATION, 1, neighbours=no,validated=true,closed=no` marks start of triangle list
- Each line defines one triangle using 1-based vertex indices
- Format: `triangle_id, v1, v2, v3, 0, 0, 0,`
- File contains ~144,199 triangles for reference surface
- Triangle count is roughly 2x vertex count (typical for triangulated surfaces)

---

## Import Process

### Step 1: User selects both files
- User must select both `.dtm` and `.str` files with same base name
- Example: `251228_s4_226_406_topo.dtm` + `251228_s4_226_406_topo.str`

### Step 2: Parse STR file (vertices)
1. Read STR file line by line
2. Skip header (first 2 lines)
3. Parse vertex lines: `1, Y, X, Z`
4. Store vertices in array (0-based index)
5. Vertex array index = Surpac vertex number - 1

### Step 3: Parse DTM file (triangles)
1. Read DTM file line by line
2. Find `TRISOLATION` marker to start triangle parsing
3. Parse triangle lines: `triangle_id, v1, v2, v3, 0, 0, 0,`
4. Convert 1-based indices to 0-based (v1_index - 1)
5. Create triangle using vertices from STR array
6. Each triangle contains 3 vertex references

### Step 4: Create surface
1. Combine vertices and triangles into surface object
2. Add to `window.loadedSurfaces` Map
3. Render triangles on canvas

---

## Export Process

### Current Implementation (WRONG)

Currently exports:
- DTM file: Unique vertices (point cloud) ❌
- STR file: Triangles as closed polylines ❌

### Correct Implementation (TODO)

Should export:
- **STR file**: Unique vertices with string number 1
- **DTM file**: Triangle indices referencing STR vertices

**STR Export Format:**
```
surface_name,date,source,
0, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
1, Y1, X1, Z1
1, Y2, X2, Z2
1, Y3, X3, Z3
...
0, 0.000, 0.000, 0.000, END
```

**DTM Export Format:**
```
surface_name.str,
0, 0.000, 0.000, 0.000, END
OBJECT, 1,
TRISOLATION, 1, neighbours=no,validated=true,closed=no
1, v1_idx, v2_idx, v3_idx, 0, 0, 0,
2, v1_idx, v2_idx, v3_idx, 0, 0, 0,
...
0, 0.000, 0.000, 0.000, END
```

---

## Implementation Status

### ✅ Complete
- [x] SurpacSurfaceParser.js - Imports DTM + STR as surface
- [x] Registered surpac-surface parser
- [x] Updated import button to handle dual-file selection
- [x] Reads both files and combines into triangulated surface
- [x] Adds to window.loadedSurfaces

### ❌ TODO
- [ ] Update SurpacDTMWriter.js to export triangle indices
- [ ] Update SurpacSTRWriter.js surface export to export vertices only
- [ ] Ensure vertex indices match between STR and DTM export
- [ ] Test round-trip: export surface → import in Surpac → export from Surpac → import back to Kirra

---

## Reference Files

**Test Surface:**
- `/src/referenceFiles/251228_s4_226_406_topo.str` - 72,236 vertices
- `/src/referenceFiles/251228_s4_226_406_topo.dtm` - 144,199 triangles

**Blast Hole Examples:**
- `/src/referenceFiles/blastholes.str` - Surpac 6.3 blast hole format
- `/src/referenceFiles/S5_346_516_V2.str` - Basic string format (old style)

---

## Key Differences: Surface vs Blast Holes

| Feature | Surface STR | Blast Hole STR |
|---------|-------------|----------------|
| String Number | Always 1 | 1 (Surpac 6.3) or 512 (old) |
| Data Type | Vertices only | Collar + Toe with metadata |
| Companion File | DTM (triangulation) | None |
| Format | Simple Y,X,Z | Complex with 14 metadata fields |
| Purpose | Surface mesh | Drill hole design |

---

## Conclusion

Surpac surface format is fundamentally different from what was initially implemented:
- **STR = Vertices**, not triangles
- **DTM = Triangulation**, not point cloud
- They must be **paired** to create a complete surface

The import functionality is now correct. Export functionality needs updating to match this format.

---

**Status:** Import Complete ✓ | Export TODO ⚠️

**Ready for Testing:** Import YES | Export NO

---
