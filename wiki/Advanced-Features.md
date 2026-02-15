# Advanced Features

## Overview

Kirra includes several **advanced features** beyond basic pattern design, including duplicate detection, grade control, HDBScan clustering for burden/spacing analysis, Voronoi analysis, auto-timing algorithms, 3D surface visualization with gradients, textured OBJ mesh import, and GeoTIFF export.

These features enable sophisticated blast design workflows and integration with external mining software.

---

## Duplicate Detection

### Purpose

Prevent data integrity issues by identifying:
- **Duplicate hole IDs** - Multiple holes with same identifier
- **Duplicate positions** - Multiple holes at same location (within tolerance)
- **Overlapping holes** - Holes too close together (< 0.5m)

### Automatic Detection

**Triggers**:
- Importing CSV files
- Creating new patterns
- Copying/pasting holes
- Merging entities

**Detection Algorithm**:
```javascript
function detectDuplicates(newHoles, existingHoles) {
  var duplicateIDs = [];
  var duplicatePositions = [];
  var positionTolerance = 0.5; // meters
  
  newHoles.forEach(function(newHole) {
    // Check for duplicate IDs
    existingHoles.forEach(function(existingHole) {
      if (newHole.holeID === existingHole.holeID) {
        duplicateIDs.push(newHole.holeID);
      }
      
      // Check for duplicate positions
      var distance = Math.sqrt(
        Math.pow(newHole.x - existingHole.x, 2) +
        Math.pow(newHole.y - existingHole.y, 2)
      );
      
      if (distance < positionTolerance) {
        duplicatePositions.push({
          newHole: newHole.holeID,
          existingHole: existingHole.holeID,
          distance: distance
        });
      }
    });
  });
  
  return { duplicateIDs: duplicateIDs, duplicatePositions: duplicatePositions };
}
```

### Resolution Options

When duplicates are detected, Kirra prompts with options:

**Duplicate IDs**:
1. **Skip**: Don't import holes with duplicate IDs
2. **Rename**: Auto-rename new holes (append suffix: H001_1, H001_2)
3. **Replace**: Replace existing holes with new data
4. **Cancel**: Abort import

**Duplicate Positions**:
1. **Skip**: Don't import holes at duplicate positions
2. **Offset**: Shift new holes by 1m in X direction
3. **Replace**: Replace existing holes
4. **Ignore**: Import anyway (creates overlap - not recommended)

### Manual Duplicate Check

**Run Manually**:
- Tools → Check Pattern
- Scans all holes for:
  - Duplicate IDs
  - Overlapping positions
  - Invalid geometry (zero-length holes, NaN coordinates)
  - Orphaned timing references

**Report Format**:
```
Duplicate Check Report
======================

Duplicate IDs (3):
  - H042: 2 occurrences in Pattern_A
  - H103: 2 occurrences in Pattern_B
  - H200: 3 occurrences in Pattern_C

Overlapping Positions (2):
  - H042 and H043: 0.2m apart
  - H150 and H151: 0.35m apart

Invalid Geometry (1):
  - H999: Zero-length hole (collar = toe)

Orphaned Timing (4):
  - H055: fromHoleID="H999" (not found)
  - H056: fromHoleID="H055" (circular reference)
```

### Batch Renumbering

**Auto-Fix Duplicate IDs**:
1. Tools → Check Pattern → Detect duplicates
2. Click "Auto-Renumber"
3. System assigns sequential IDs:
   - Pattern_A: H001-H050
   - Pattern_B: H051-H100
   - Pattern_C: H101-H150

**Custom Renumbering**:
1. Select entity in TreeView
2. Edit → Renumber Holes
3. Enter:
   - Start ID: 1
   - Prefix: "H"
   - Padding: 3 (e.g., H001, H002, ..., H100)
4. Apply to selected entity

---

## Grade Control

### Purpose

Align blast patterns with **actual terrain topography** rather than using fixed elevations. This ensures:
- Proper subdrill into floor
- Consistent bench height
- Optimal hole loading
- Reduced overbreak/underbreak

### Surface-Based Grade Control

**Workflow**:
1. Import DTM/STR surface (File → Import → Surface)
2. Surface represents floor or grade elevation
3. Select holes to adjust
4. Edit → Apply Grade from Surface
5. System interpolates surface Z at each hole collar XY
6. Updates gradeZ, maintains toe positions

**Algorithm**:
```javascript
function applyGradeFromSurface(hole, surface) {
  // Find surface Z at hole XY position
  var gradeZ = interpolateSurfaceZ(surface, hole.x, hole.y);
  
  // Update hole grade
  hole.gradeX = hole.x;
  hole.gradeY = hole.y;
  hole.gradeZ = gradeZ;
  
  // Recalculate toe based on subdrill
  hole.endZ = gradeZ - hole.subdrillAmount;
  
  // Recalculate bench height
  hole.benchHeight = hole.startZ - hole.gradeZ;
  
  // Recalculate angle and length
  recalculateHoleGeometry(hole);
}

function interpolateSurfaceZ(surface, x, y) {
  // Find triangle containing XY point
  var triangle = findTriangleAtXY(surface, x, y);
  
  if (!triangle) {
    console.warn("Point outside surface bounds");
    return null;
  }
  
  // Barycentric interpolation of Z
  var p1 = surface.points[triangle.a];
  var p2 = surface.points[triangle.b];
  var p3 = surface.points[triangle.c];
  
  var bary = barycentricCoordinates(x, y, p1, p2, p3);
  var z = bary.u * p1.z + bary.v * p2.z + bary.w * p3.z;
  
  return z;
}
```

### Fixed Subdrill Mode

**Use Case**: Maintain constant subdrill depth across entire pattern.

**Workflow**:
1. Import surface for grade
2. Select holes
3. Edit → Set Fixed Subdrill
4. Enter subdrill amount (e.g., 1.5m)
5. System updates:
   - gradeZ from surface
   - toeZ = gradeZ - subdrill
   - Maintains collar positions

**Result**: All holes have same subdrill, regardless of terrain variation.

### Fixed Bench Height Mode

**Use Case**: Maintain constant bench height (vertical distance collar→grade).

**Workflow**:
1. Import surface for grade
2. Select holes
3. Edit → Set Fixed Bench Height
4. Enter bench height (e.g., 10.0m)
5. System updates:
   - gradeZ from surface
   - collarZ = gradeZ + benchHeight
   - Maintains toe positions (subdrill varies)

**Result**: Collar elevations follow terrain + fixed offset.

### Multi-Surface Grade Control

**Use Case**: Complex pit designs with multiple bench levels.

**Workflow**:
1. Import surfaces for each bench:
   - Surface_Bench_150 (grade at 150m elevation)
   - Surface_Bench_140 (grade at 140m elevation)
   - Surface_Bench_130 (grade at 130m elevation)
2. Select holes in Bench_150 pattern
3. Edit → Apply Grade from Surface → Select "Surface_Bench_150"
4. Repeat for other benches

**Benefits**:
- Each bench uses appropriate grade surface
- Handles undulating floors
- Accounts for excavation sequence

---

## HDBScan Clustering

### Purpose

**HDBScan (Hierarchical Density-Based Spatial Clustering)** automatically identifies:
- **Rows**: Groups of holes aligned parallel
- **Positions**: Hole sequence within each row
- **Burden**: Inter-row spacing
- **Spacing**: Intra-row hole spacing

This is especially useful for:
- Irregular imported patterns (no original row/position data)
- Verification of pattern geometry
- Auto-calculation of burden/spacing statistics

### Algorithm Overview

HDBScan identifies clusters based on:
1. **Density**: Holes close together form clusters (rows)
2. **Hierarchy**: Nested clusters merged hierarchically
3. **Outliers**: Isolated holes marked as noise (-1)

**Parameters**:
- `minClusterSize`: Minimum holes per row (default: 3)
- `minSamples`: Minimum neighbors for core point (default: 2)
- `epsilon`: Maximum distance for neighbor search (default: auto)

### Running HDBScan

**Automatic**:
- Pattern → Generate Pattern → HDBScan runs automatically on irregular patterns
- Assigns `rowID` and `posID` to each hole
- Calculates `burden` and `spacing` based on cluster geometry

**Manual**:
- Tools → Analyze Pattern → Run HDBScan
- Select entity
- System analyzes hole positions
- Updates `rowID`, `posID`, `burden`, `spacing` fields

### Cluster Interpretation

**Example Result**:
```
Cluster Analysis Results
========================

Cluster 0 (Row 1): 12 holes
  - Average spacing: 6.2m
  - Burden to Cluster 1: 5.0m

Cluster 1 (Row 2): 12 holes
  - Average spacing: 6.1m
  - Burden to Cluster 2: 5.1m

Cluster 2 (Row 3): 11 holes
  - Average spacing: 6.3m
  - Burden to Cluster 3: 4.9m

Outliers: 2 holes (presplit or buffer)
  - H099 at (1234.5, 5678.9)
  - H100 at (1240.2, 5680.1)
```

**Visualization**:
- Each row colored differently
- Outliers shown in gray
- Burden lines drawn between row centroids

### Use Cases

**1. Verify Pattern Quality**:
- Import pattern from drill rig
- Run HDBScan
- Check burden/spacing consistency
- Identify mis-drilled holes (outliers)

**2. Calculate Statistics**:
- No need to manually specify burden/spacing
- System calculates from actual geometry
- More accurate powder factor calculations

**3. Pattern Correction**:
- Identify irregular rows
- Highlight holes that don't fit pattern
- Guide manual adjustments

### Limitations

- Requires at least 3 holes per row (minClusterSize)
- Doesn't work on single-row patterns (use line pattern instead)
- Sensitive to large variations in spacing (outliers detected)
- Assumes roughly parallel rows (not radial patterns)

---

## Voronoi Analysis

### Purpose

**Voronoi diagrams** partition space into cells, one per hole, where each cell contains all points closer to that hole than any other. This enables:
- **Rock volume per hole**: Calculate cubic meters of rock assigned to each hole
- **Powder factor per hole**: kg explosive / m³ rock for each hole
- **Load balancing**: Identify over/under-loaded holes
- **Pattern efficiency**: Quantify coverage and uniformity

### Algorithm

**Voronoi Generation**:
1. Project all hole collars to 2D (XY plane)
2. Generate Voronoi diagram using Delaunay triangulation dual
3. Clip cells to blast boundary polygon
4. Calculate cell area for each hole

**Volume Calculation**:
```javascript
function calculateRockVolumePerHole(hole, voronoiCell, benchHeight) {
  var cellArea = calculatePolygonArea(voronoiCell);
  var volume = cellArea * benchHeight;
  return volume;
}

function calculatePowderFactor(hole, rockVolume) {
  var explosiveMass = hole.totalExplosiveMass; // from charge config
  var powderFactor = explosiveMass / rockVolume;
  return powderFactor;
}
```

### Running Voronoi Analysis

**Steps**:
1. Ensure all holes have bench height set
2. Tools → Voronoi Analysis
3. System generates diagram and calculates volumes
4. Results displayed:
   - Voronoi cells overlaid on canvas
   - Color-coded by powder factor
   - Statistics table

**Visualization**:
- **Green cells**: Powder factor within tolerance (0.3-0.6 kg/m³)
- **Yellow cells**: Slightly high/low (0.2-0.3 or 0.6-0.8)
- **Red cells**: Too high/low (< 0.2 or > 0.8)

### Interpreting Results

**Example Output**:
```
Voronoi Analysis Results
========================

Hole ID  | Cell Area (m²) | Rock Volume (m³) | Explosive (kg) | Powder Factor (kg/m³)
---------|----------------|------------------|----------------|----------------------
H001     | 30.2          | 302.0            | 150.0          | 0.50
H002     | 31.5          | 315.0            | 155.0          | 0.49
H003     | 28.8          | 288.0            | 145.0          | 0.50
H004     | 42.1          | 421.0            | 180.0          | 0.43  ← Low PF (large cell)
H005     | 25.3          | 253.0            | 130.0          | 0.51
...

Average Powder Factor: 0.49 kg/m³
Min Powder Factor: 0.38 kg/m³ (H010)
Max Powder Factor: 0.65 kg/m³ (H023)
```

**Action**:
- **H004**: Large cell (42.1 m²) → Increase charge to 210 kg
- **H010**: Low PF (0.38) → Increase charge or reduce cell area
- **H023**: High PF (0.65) → Reduce charge or increase cell area

### Boundary Handling

**Voronoi cells at pattern edges** extend to infinity in theory. Kirra handles this by:
1. **Auto-boundary**: Generate convex hull of hole positions
2. **Polygon boundary**: Clip to user-defined polygon
3. **Surface boundary**: Clip to surface outline

**Clipping Example**:
```javascript
function clipVoronoiCell(cell, boundary) {
  // Sutherland-Hodgman polygon clipping
  var clippedCell = cell;
  
  boundary.edges.forEach(function(edge) {
    clippedCell = clipPolygonToEdge(clippedCell, edge);
  });
  
  return clippedCell;
}
```

### Use Cases

**1. Load Balancing**:
- Identify holes with disproportionate rock volumes
- Adjust charges accordingly
- Achieve uniform powder factor across pattern

**2. Pattern Verification**:
- Visualize spacing inconsistencies
- Large cells indicate gaps in pattern
- Small cells indicate over-drilling

**3. Optimization**:
- Find optimal burden/spacing for uniform cells
- Minimize powder factor variance
- Reduce cost while maintaining fragmentation

---

## Auto-Timing Algorithms

### Purpose

Automatically sequence blast hole firing to achieve desired face movement and fragmentation. Kirra includes several algorithms:
- **Row-by-Row**: Sequential rows with inter-row delay
- **Echelon (Diagonal)**: Diagonal wave across pattern
- **V-Cut (Chevron)**: Center-out firing for relief
- **Custom**: Manual sequence definition

### Row-by-Row Timing

**Algorithm**:
```javascript
function autoTimeRowByRow(holes, interRowDelay, intraHoleDelay) {
  // Group holes by rowID (requires HDBScan)
  var rows = groupHolesByRow(holes);
  
  var totalTime = 0;
  
  rows.forEach(function(row, rowIndex) {
    row.holes.forEach(function(hole, posIndex) {
      if (rowIndex === 0 && posIndex === 0) {
        // First hole: no fromHole
        hole.fromHoleID = "";
        hole.timingDelayMilliseconds = 0;
        hole.holeTime = 0;
      } else if (posIndex === 0) {
        // First hole in row: delay from last hole of previous row
        var prevRowLastHole = rows[rowIndex - 1].holes[rows[rowIndex - 1].holes.length - 1];
        hole.fromHoleID = prevRowLastHole.holeID;
        hole.timingDelayMilliseconds = interRowDelay;
        hole.holeTime = prevRowLastHole.holeTime + interRowDelay;
      } else {
        // Within row: delay from previous hole in same row
        var prevHole = row.holes[posIndex - 1];
        hole.fromHoleID = prevHole.holeID;
        hole.timingDelayMilliseconds = intraHoleDelay;
        hole.holeTime = prevHole.holeTime + intraHoleDelay;
      }
    });
  });
}
```

**Parameters**:
- `interRowDelay`: Delay between rows (e.g., 200ms)
- `intraHoleDelay`: Delay between holes in same row (e.g., 42ms)

**Result**:
```
Row 1: H001(0ms) → H002(42ms) → H003(84ms) → ... → H012(462ms)
Row 2: H013(662ms) → H014(704ms) → H015(746ms) → ... → H024(1124ms)
Row 3: H025(1324ms) → H026(1366ms) → ...
```

### Echelon (Diagonal) Timing

**Algorithm**:
```javascript
function autoTimeEchelon(holes, angle, delay) {
  // Calculate echelon parameter for each hole
  holes.forEach(function(hole) {
    var echelonParam = hole.x * Math.cos(angle) + hole.y * Math.sin(angle);
    hole.echelonParam = echelonParam;
  });
  
  // Sort by echelon parameter
  holes.sort(function(a, b) {
    return a.echelonParam - b.echelonParam;
  });
  
  // Assign timing
  holes.forEach(function(hole, index) {
    if (index === 0) {
      hole.fromHoleID = "";
      hole.timingDelayMilliseconds = 0;
      hole.holeTime = 0;
    } else {
      hole.fromHoleID = holes[index - 1].holeID;
      hole.timingDelayMilliseconds = delay;
      hole.holeTime = holes[index - 1].holeTime + delay;
    }
  });
}
```

**Parameters**:
- `angle`: Echelon angle (degrees from east)
  - 0° = East-to-West wave
  - 90° = South-to-North wave
  - 45° = Southwest-to-Northeast diagonal
- `delay`: Delay between sequential holes (e.g., 42ms)

**Visualization**:
- Connector lines show diagonal progression
- Smooth face movement
- Ideal for long benches

### V-Cut (Chevron) Timing

**Algorithm**:
```javascript
function autoTimeVCut(holes, centerX, centerY, delay) {
  // Calculate distance from center
  holes.forEach(function(hole) {
    var dist = Math.sqrt(
      Math.pow(hole.x - centerX, 2) +
      Math.pow(hole.y - centerY, 2)
    );
    hole.distFromCenter = dist;
  });
  
  // Sort by distance (closest to farthest)
  holes.sort(function(a, b) {
    return a.distFromCenter - b.distFromCenter;
  });
  
  // Assign timing (center fires first)
  holes.forEach(function(hole, index) {
    if (index === 0) {
      hole.fromHoleID = "";
      hole.timingDelayMilliseconds = 0;
      hole.holeTime = 0;
    } else {
      hole.fromHoleID = holes[index - 1].holeID;
      hole.timingDelayMilliseconds = delay;
      hole.holeTime = holes[index - 1].holeTime + delay;
    }
  });
}
```

**Parameters**:
- `centerX`, `centerY`: Center point of V-cut
- `delay`: Delay between sequential holes

**Use Case**:
- Tunnel blasting
- Bench blasting with free face on multiple sides
- Creating relief in center before firing perimeter

---

## 3D Surface Visualization with Gradients

### Purpose

Kirra supports **multiple gradient visualization modes** for surfaces:
- **Elevation-based**: Color by Z value (blue→green→red)
- **Hillshade**: Lighting simulation for topographic relief
- **Scientific colormaps**: Viridis, Turbo, Parula, Cividis, Terrain
- **Texture**: Use OBJ texture mapping (photos, orthoimagery)

### Gradient Types

| Gradient | Description | Use Case |
|----------|-------------|----------|
| `default` | Simple blue-red elevation | Quick visualization |
| `hillshade` | Lighting-based shading | Terrain analysis |
| `viridis` | Perceptually uniform | Scientific data |
| `turbo` | Rainbow-like | High dynamic range |
| `parula` | MATLAB default | Engineering |
| `cividis` | Colorblind-friendly | Accessibility |
| `terrain` | Green-brown | Natural appearance |
| `texture` | OBJ texture map | Photo-realistic |

### Applying Gradients

**Steps**:
1. Load surface (DTM, STR, OBJ)
2. Right-click surface in TreeView
3. Surface Properties → Gradient
4. Select gradient type
5. Click "Apply"
6. Surface updates in both 2D and 3D views

**Elevation Limits**:
- Set min/max Z for color mapping
- Clamps values outside range
- Improves contrast in specific elevation range

**Example**:
```
Surface: terrain_001.dtm
  Min Z: 100.0m, Max Z: 200.0m
  Gradient: viridis
  Color Mapping:
    100m → Dark purple
    150m → Green
    200m → Yellow
```

### Hillshade Gradient

**Parameters**:
- `hillshadeColor`: Base color (default: gray)
- `azimuth`: Light direction (0-360°, default: 315° = NW)
- `altitude`: Light angle (0-90°, default: 45°)

**Algorithm**:
```javascript
function calculateHillshade(normal, azimuth, altitude) {
  var lightDir = {
    x: Math.cos(azimuth * Math.PI / 180) * Math.cos(altitude * Math.PI / 180),
    y: Math.sin(azimuth * Math.PI / 180) * Math.cos(altitude * Math.PI / 180),
    z: Math.sin(altitude * Math.PI / 180)
  };
  
  var intensity = dotProduct(normal, lightDir);
  intensity = Math.max(0, intensity); // Clamp to [0, 1]
  
  return intensity;
}
```

**Use Case**:
- Visualize terrain features (ridges, valleys)
- Identify slopes and aspects
- Quality check for DTM accuracy

---

## Textured OBJ Mesh Import

### Purpose

Import **photo-realistic 3D models** with texture mapping:
- Aerial surveys (drone imagery)
- Photogrammetry meshes
- CAD models with materials
- Textured terrain models

### Import Process

**Required Files**:
1. **OBJ file**: 3D geometry (vertices, faces, UV coordinates)
2. **MTL file**: Material definitions (colors, textures)
3. **Texture images**: JPG/PNG referenced by MTL

**Import Steps**:
1. File → Import → OBJ Mesh with Textures
2. Select OBJ file
3. System prompts for MTL file (if not auto-detected)
4. System prompts for texture images
5. Mesh loads with textures applied

**Storage**:
- OBJ content stored as string in IndexedDB
- MTL content stored as string
- Texture images stored as Blobs
- Material properties extracted and cached

### Texture Persistence

**Challenge**: Three.js meshes cannot be serialized to IndexedDB.

**Solution**: Rebuild on load.

**Save Phase**:
```javascript
surface = {
  id: "mesh.obj",
  objContent: "v 1000 2000 150\n...",
  mtlContent: "newmtl Material\n...",
  textureBlobs: {
    "texture.jpg": Blob
  },
  materialProperties: {
    "Material": { Ka: [...], Kd: [...], map_Kd: "texture.jpg" }
  }
  // threeJSMesh NOT saved (too large)
};
```

**Load Phase**:
```javascript
async function rebuildTexturedMesh(surface) {
  // 1. Recreate texture URLs from Blobs
  var textureURLs = {};
  Object.keys(surface.textureBlobs).forEach(function(filename) {
    textureURLs[filename] = URL.createObjectURL(surface.textureBlobs[filename]);
  });
  
  // 2. Parse OBJ (geometry only)
  var geometry = parseOBJ(surface.objContent);
  
  // 3. Recreate materials from stored properties
  var materials = {};
  Object.keys(surface.materialProperties).forEach(function(name) {
    var props = surface.materialProperties[name];
    var material = new THREE.MeshPhongMaterial({
      color: new THREE.Color().fromArray(props.Kd),
      map: props.map_Kd ? new THREE.TextureLoader().load(textureURLs[props.map_Kd]) : null
    });
    materials[name] = material;
  });
  
  // 4. Build mesh
  var mesh = new THREE.Mesh(geometry, materials);
  surface.threeJSMesh = mesh;
}
```

### Texture Quality

**UV Mapping**:
- OBJ must include `vt` (texture coordinates)
- UV coords must be normalized [0, 1]
- Proper UV unwrapping ensures no distortion

**Texture Resolution**:
- 1024×1024 typical for terrain (1 MB)
- 2048×2048 for detailed meshes (4 MB)
- 4096×4096 maximum (16 MB)

**Compression**:
- JPG for photos (80-90% quality)
- PNG for graphics (lossless, larger files)

---

## GeoTIFF Export

### Purpose

Export surfaces as **georeferenced raster images** for use in GIS software (QGIS, ArcGIS, Global Mapper).

### Export Process

**Steps**:
1. Load surface with gradient applied
2. File → Export → Export Images as GeoTIFF
3. Configure:
   - **EPSG Code**: Coordinate reference system (e.g., EPSG:32755 for UTM 55S)
   - **Resolution Mode**:
     - Screen: Use cached 2D canvas resolution
     - DPI: Specify DPI (e.g., 300 DPI for printing)
     - Pixels-per-meter: Direct specification (e.g., 10 px/m)
     - Full: Maximum resolution
4. Click "Export"
5. GeoTIFF file downloads

### GeoTIFF Structure

**Components**:
1. **Raster Data**: RGB pixels (8-bit per channel)
2. **Geotransform**: Maps pixel coordinates to world coordinates
   ```
   [originX, pixelWidth, 0, originY, 0, -pixelHeight]
   ```
3. **CRS Definition**: EPSG code embedded in metadata

**Georeferencing**:
```javascript
var geotransform = [
  bounds.minX,              // Top-left X (Easting)
  (bounds.maxX - bounds.minX) / width,  // Pixel width (m/px)
  0,                        // Rotation (0 for north-up)
  bounds.maxY,              // Top-left Y (Northing)
  0,                        // Rotation (0 for north-up)
  -(bounds.maxY - bounds.minY) / height // Pixel height (m/px, negative)
];
```

### Use Cases

**1. GIS Integration**:
- Import into QGIS as base layer
- Overlay blast patterns (export DXF, import to GIS)
- Volume calculations using GIS tools

**2. Reporting**:
- Generate high-resolution images for reports
- Include in presentations
- Print at large scales without pixelation

**3. Archive**:
- Preserve surface visualization
- Document pre/post-blast conditions
- Historical records with embedded coordinates

### Resolution Considerations

| Resolution Mode | Pixels per Meter | File Size | Use Case |
|-----------------|------------------|-----------|----------|
| Screen (Low) | 0.5-1 px/m | 1-5 MB | Quick preview |
| DPI 150 | 5-10 px/m | 10-50 MB | Screen display |
| DPI 300 | 10-20 px/m | 50-200 MB | Print quality |
| Full (High) | 50+ px/m | 200+ MB | Maximum detail |

**Trade-off**:
- Higher resolution = larger file, slower export
- Lower resolution = faster export, less detail
- Choose based on final use (screen vs print)

---

## Related Documentation

- [Blast Design Workflow](Blast-Design-Workflow) - Complete design process using advanced features
- [Statistics and Reporting](Statistics-and-Reporting) - Voronoi analysis and statistics
- [Pattern Generation](Pattern-Generation) - Pattern creation methods
- [User Interface](User-Interface) - Accessing advanced features via menus
- [File Formats](File-Formats) - Import/export for GeoTIFF, OBJ, DTM/STR
- [IndexedDB Schema](IndexedDB-Schema) - Storage of textured meshes and surfaces

---

*For implementation details, see `src/kirra.js`, `src/helpers/VoronoiAnalysis.js`, `src/helpers/HDBScanCluster.js`, `src/helpers/GeoTIFFExporter.js`, and `src/three/ThreeRenderer.js`*
