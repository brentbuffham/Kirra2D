# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL RULE: Always Check Documentation First

**BEFORE making any changes to code, especially calculations, formulas, or data structures:**

1. ✅ **READ THE README.md** - Contains comprehensive documentation including:
   - Blast hole geometry formulas and relationships
   - Coordinate system conventions
   - Data structure definitions
   - Calculation chains and validation formulas
   - Example scenarios and test cases

2. ✅ **Check for existing implementation documentation** in:
   - `IMPLEMENTATION_*.md` files
   - Code comments in relevant files
   - User-provided diagrams or specifications

3. ✅ **Verify assumptions against documentation** before implementing fixes

**Example**: The README.md contains detailed blast hole geometry documentation (lines 318-658) including:
- `subdrillAmount` = VERTICAL distance (deltaZ)
- `subdrillLength` = VECTOR distance along hole
- Complete formulas for grade calculation
- Relationships between all hole attributes

**If documentation contradicts your understanding, the documentation is correct.**

## Build Commands

```bash
# Start development server (opens http://localhost:5173/kirra.html)
npm run dev

# Build for production
npm run build
```

The dev server auto-opens `kirra.html` in Chrome. Output directory for builds is `dist/`.

## Application Overview

**Kirra** is a web-based blasting pattern design application for mining/construction. It combines 2D canvas rendering with Three.js 3D visualization, supporting comprehensive blast hole management, surface triangulation, and multi-format file import/export.

**Core Technologies:**
- **Vite 7.1.12** - Build system with ES modules
- **Three.js r170** - 3D rendering (surfaces, textured meshes, OBJ/MTL)
- **Vanilla JavaScript** - No framework, custom dialog system
- **IndexedDB** - Client-side persistence for surfaces, holes, drawings
- **Canvas 2D API** - 2D blast pattern visualization

## Architecture

### 1. Main Entry Point: `src/kirra.js` (~40,000 lines)

Central monolithic file containing:
- **Global state management**: `window.allBlastHoles`, `window.loadedSurfaces`, `window.loadedImages`, `window.loadedKADs`
- **Three.js initialization**: Creates `window.threeRenderer`, `window.threeControls`, `window.geometryFactory`
- **Canvas 2D/3D rendering orchestration**: `drawData()` main rendering loop
- **IndexedDB operations**: `saveSurfaceToDB()`, `loadAllSurfacesIntoMemory()`, etc.
- **File import/export logic**: Delegates to FileManager but coordinates UI
- **Blast hole calculations**: Geometry, burden/spacing, timing calculations
- **Pattern generation**: Rectangular, polygon, line-based patterns

**Key Global Variables:**
```javascript
window.allBlastHoles = []           // Array of blast hole objects
window.selectedHole = null          // Currently selected hole
window.loadedSurfaces = new Map()   // surfaceId -> surface object
window.loadedImages = new Map()     // imageId -> GeoTIFF image object
window.loadedKADs = new Map()       // kadId -> KAD drawing object
window.threeRenderer                // ThreeRenderer instance
window.threeInitialized = false     // Three.js ready flag
window.canvas2D                     // 2D canvas element
window.ctx2D                        // 2D canvas context
```

### 2. FileManager System (`src/fileIO/FileManager.js`)

**Plugin-based I/O architecture** with parser/writer registration:

```javascript
// FileManager dispatches based on file extension
fileManager.registerParser('obj', OBJParser, { extensions: ['.obj'], category: 'mesh' })
fileManager.registerWriter('dxf', DXFHOLESWriter, { extensions: ['.dxf'], category: 'cad' })
```

**Parser/Writer Pattern:**
- All parsers extend `BaseParser` and implement `async parse(file)`
- All writers extend `BaseWriter` and implement `async write(data)`
- Located in `src/fileIO/` by category:
  - `AutoCadIO/` - DXF import/export
  - `SurpacIO/` - DTM/STR surface files (binary/text)
  - `ThreeJSMeshIO/` - OBJ/PLY mesh files
  - `KirraIO/` - KAD (Kirra App Drawing) format
  - `EsriIO/` - Shapefile support
  - `GoogleMapsIO/` - KML/KMZ
  - `LasFileIO/` - LAS point clouds

**Critical for File I/O Work:**
- FileManager instance created in `kirra.js` and exposed as `window.fileManager`
- To add new format: Create parser/writer classes, register in FileManager initialization
- See `src/io/writers/GeoTIFFImageryWriter.js` for recent export example

### 3. Three.js 3D System

**Modular Three.js Architecture:**

- **`ThreeRenderer.js`**: Core Three.js setup, scene management, lighting
  - Creates scene, camera, WebGL renderer
  - Manages ambient + directional lights (MeshPhongMaterial compatible)
  - Handles window resize, background color, render loop

- **`CameraControls.js`**: Custom orbit controls
  - Pan, zoom, rotate camera around centroid
  - Bearing/elevation tracking for lighting updates

- **`GeometryFactory.js`**: Shape creation utilities
  - Cylinder blast holes, text labels, image planes
  - Geometry caching for performance

- **`InteractionManager.js`**: Mouse/touch event handling
  - Raycasting for 3D object selection
  - Polygon selection mode

- **`canvas3DDrawing.js`**: Three.js rendering functions
  - `drawHoleThreeJS()`, `drawSurfaceThreeJS()`, `drawKADPointThreeJS()`, etc.
  - **CRITICAL FOR SURFACES**: `drawSurfaceThreeJS()` at line ~510
    - Handles both elevation-gradient meshes and textured OBJ meshes
    - Gradient "texture" uses pre-loaded Three.js mesh with textures
    - Other gradients (viridis, hillshade, etc.) use dynamically colored triangles

**Surface Rendering Pipeline:**
1. Surface imported (DTM, STR, OBJ) → stored in `window.loadedSurfaces`
2. Triangulated (Delaunator, Earcut, Constrainautor) → `{triangles: [], points: []}`
3. **2D**: Rasterized to canvas with gradient colors → cached in `window.surface2DCache`
4. **3D**: Either:
   - **Textured mesh**: Use `surface.threeJSMesh` (pre-loaded OBJ with MTL materials)
   - **Gradient mesh**: Create colored BufferGeometry from triangles

### 4. Textured OBJ Import System

**Two-Phase Loading Architecture:**

**Phase 1: Initial Load** (`loadOBJWithTextureThreeJS()` at kirra.js:~11905)
- Uses Three.js `MTLLoader` + `OBJLoader`
- MTLLoader parses MTL file → creates `MeshPhongMaterial` with properties
- Texture blobs stored in `surface.textureBlobs` for persistence
- Material properties extracted and stored in `surface.materialProperties`
- Complete mesh stored as `surface.threeJSMesh`

**Phase 2: Rebuild from IndexedDB** (`rebuildTexturedMesh()` at kirra.js:~12245)
- Recreates texture URLs from stored blobs
- Parses OBJ without MTL (geometry only)
- **CRITICAL**: Manually recreates materials using `createMaterialFromProperties()`
- Must match MTLLoader's material creation EXACTLY

**Known Issue (see `IMPLEMENTATION_REVIEW_2026-01-09.md`):**
- Textured meshes visible on initial load, invisible after page reload
- All diagnostics pass (UV, texture, material type), but texture doesn't render
- Material type was changed from `MeshStandardMaterial` to `MeshPhongMaterial` to match MTLLoader
- Issue still unresolved - likely missing material property or state

**When working on textured OBJ reload:**
1. Compare `loadOBJWithTextureThreeJS()` vs `createMaterialFromProperties()`
2. Check MTLLoader source to see what properties it sets
3. Material properties stored: `Ka`, `Kd`, `Ks`, `Ns`, `map_Kd`, `illum`
4. Texture properties: `colorSpace`, `wrapS`, `wrapT`, `flipY`

### 5. Surface Gradient System

**Color Gradients Applied to Surfaces:**
- Stored in `surface.gradient` (default: "default")
- Applied in both 2D canvas and 3D Three.js rendering

**Available Gradients:**
- `"default"` - Simple elevation-based blue-red
- `"texture"` - Use OBJ texture (requires `surface.isTexturedMesh = true`)
- `"hillshade"` - Lighting-based shading with configurable color
- `"viridis"`, `"turbo"`, `"parula"`, `"cividis"`, `"terrain"` - Scientific colormaps

**Gradient Implementation:**
- 2D: `elevationToColor()` function in kirra.js returns RGB based on Z value
- 3D: Either texture mapping OR per-vertex color attributes on BufferGeometry
- Gradient color calculation uses `surface.minLimit` / `surface.maxLimit` for clamping

**Elevation Limits:**
- User-configurable via Surface Properties dialog
- `surface.minLimit` / `surface.maxLimit` clamp color mapping range
- If null, uses actual surface min/max Z values

### 6. IndexedDB Persistence

**Database: "KirraDB"**

**Object Stores:**
- `blastHoles` - Blast hole data (collar, toe, properties)
- `surfaces` - Surface triangulations, OBJ meshes, texture blobs
- `images` - GeoTIFF imported images
- `kads` - KAD vector drawings (points, lines, polygons, circles, text)

**Critical for Surface Persistence:**
- Texture blobs stored as Blob objects in `surfaces.textureBlobs`
- MTL content stored as string in `surfaces.mtlContent`
- Material properties stored as objects in `surfaces.materialProperties`
- Three.js mesh NOT stored (too large) - rebuilt on load via `rebuildTexturedMesh()`

**Surface Object Structure:**
```javascript
{
  id: "filename.obj",
  name: "filename.obj",
  points: [{x, y, z}, ...],
  triangles: [{a, b, c}, ...],
  visible: true,
  gradient: "texture",
  transparency: 1.0,
  isTexturedMesh: true,
  threeJSMesh: THREE.Group,  // NOT persisted
  meshBounds: {minX, maxX, minY, maxY, minZ, maxZ},
  objContent: "...",         // OBJ file as string
  mtlContent: "...",         // MTL file as string
  textureBlobs: {            // Texture images as Blobs
    "texture.jpg": Blob
  },
  materialProperties: {      // Extracted MTL properties
    "materialName": {
      Ka: [r, g, b],
      Kd: [r, g, b],
      Ks: [r, g, b],
      Ns: shininess,
      map_Kd: "texture.jpg",
      illum: 2
    }
  }
}
```

### 7. Coordinate System

**World Coordinates:**
- **X-axis**: East-West (meters east)
- **Y-axis**: North-South (meters north)
- **Z-axis**: Elevation (meters altitude)
- **Bearing**: 0° = North, 90° = East (clockwise)
- **Angle**: From vertical (0° = vertical, 90° = horizontal)

**Three.js Local Coordinates:**
- Large world coordinates cause precision issues in Three.js
- Uses local origin: `window.threeLocalOriginX`, `window.threeLocalOriginY`
- All Three.js objects positioned relative to this origin
- Conversion: `localX = worldX - originX`

**Blast Hole Geometry:**
- **Collar (Start)**: `{x, y, z}` - Top of hole
- **Toe (End)**: `{x, y, z}` - Bottom of hole
- **Grade**: Interpolated point at floor elevation
- See README.md for comprehensive geometry calculations

### 8. Dialog System (`FloatingDialog.js`)

**Custom Modal Dialog Framework:**
- No external dialog library used
- `new FloatingDialog({ title, content, showConfirm, onConfirm, ... })`
- Supports draggable, resizable dialogs
- Used throughout application for forms, confirmations, properties

**Form Utilities:**
- `createEnhancedFormContent(fields)` - Generates form HTML from field definitions
- `getFormData(formElement)` - Extracts values from form
- Field types: text, number, select, checkbox, slider, color

**Common Dialog Patterns:**
```javascript
// Confirmation
showConfirmationDialog("Title", "Message", onConfirm, onCancel);

// Property editor
var dialog = new FloatingDialog({
  title: "Properties",
  content: createEnhancedFormContent(fields),
  onConfirm: function() {
    var data = getFormData(formContent);
    // Apply changes
  }
});
dialog.show();
```

### 9. Menu Bar System (`src/dialog/menuBar/`)

**Menu Structure:**
- `fileMenu.js` - Import/Export operations
- `editMenu.js` - Hole editing operations
- `viewMenu.js` - Display toggles, zoom controls
- `patternMenu.js` - Pattern generation dialogs
- `settingsMenu.js` - Language, theme, preferences

**Adding Export Options:**
See `fileMenu.js` for pattern - menu items call functions in kirra.js

### 10. GeoTIFF Export System (Recent Addition)

**Export Pipeline:**
1. User selects "Export GeoTIFF" from File menu
2. `ProjectionDialog.js` prompts for EPSG code and resolution
3. `SurfaceRasterizer.js` renders surfaces to canvas with gradients
4. `GeoTIFFImageryWriter.js` creates GeoTIFF with geotransform
5. File saved to user's download folder

**Resolution Modes:**
- **Screen**: Use cached 2D surface canvas resolution
- **DPI**: User-specified DPI (converted to pixels/meter)
- **Pixels-per-meter**: Direct specification
- **Full**: High-resolution export

**Files:**
- `src/helpers/GeoTIFFExporter.js` - Main export orchestration
- `src/helpers/SurfaceRasterizer.js` - Surface-to-canvas rendering
- `src/dialog/popups/generic/ProjectionDialog.js` - CRS/resolution UI
- `src/io/writers/GeoTIFFImageryWriter.js` - RGB GeoTIFF generation
- `src/io/writers/GeoTIFFElevationWriter.js` - Elevation raster export

## Development Patterns

### Adding a New Surface Import Format

1. Create parser in `src/fileIO/{Category}IO/{Format}Parser.js`:
```javascript
import { BaseParser } from '../BaseParser.js';

export class MyFormatParser extends BaseParser {
  async parse(file) {
    // Read file content
    // Parse to points array: [{x, y, z}, ...]
    // Return {points, triangles: null} or pre-triangulated
  }
}
```

2. Register in FileManager (in kirra.js initialization):
```javascript
fileManager.registerParser('myformat', MyFormatParser, {
  extensions: ['.myext'],
  category: 'surface'
});
```

3. Add to file menu import options

### Adding a New Export Format

1. Create writer in `src/io/writers/{Format}Writer.js`:
```javascript
import { BaseWriter } from '../../fileIO/BaseWriter.js';

export class MyFormatWriter extends BaseWriter {
  async write(data) {
    // Generate file content
    // Trigger download
  }
}
```

2. Register in FileManager
3. Add to file menu export options

### Debugging Three.js Rendering Issues

**Enable Developer Mode:**
```javascript
window.developerModeEnabled = true;  // In browser console
```
This enables verbose console logging for Three.js operations.

**Check Surface State:**
```javascript
console.log(window.loadedSurfaces.get('surface.obj'));
console.log(window.threeRenderer.surfaceMeshMap);
```

**Check Scene Contents:**
```javascript
window.threeRenderer.scene.traverse(obj => console.log(obj.type, obj.name));
```

**Material Inspection:**
```javascript
var mesh = window.threeRenderer.surfaceMeshMap.get('surface.obj');
mesh.traverse(child => {
  if (child.isMesh) {
    console.log('Material:', child.material.type);
    console.log('Has texture:', !!child.material.map);
    console.log('Visible:', child.visible);
  }
});
```

### Working with Blast Hole Geometry

Blast holes have complex interdependent geometry. Key relationships:

- `HoleLength = √[(ΔX)² + (ΔY)² + (ΔZ)²]`
- `VerticalDrop = StartZ - EndZ = BenchHeight + SubdrillAmount`
- `HoleAngle = arccos(VerticalDrop / HoleLength)`
- `HoleBearing = atan2(ΔX, ΔY)`

See README.md "Blast Attribute Calculation Relationships" for comprehensive formulas.

**Hole Object Structure:**
```javascript
{
  id: "unique-id",
  x, y, z: collar coordinates,
  endX, endY, endZ: toe coordinates,
  gradeX, gradeY, gradeZ: floor elevation point,
  diameter: mm,
  holeLength: meters,
  angle: degrees from vertical,
  bearing: degrees from north,
  benchHeight: meters,
  subdrill: meters,
  holeType: "Production" | "Presplit" | ...,
  timing: { fromHole, delay, totalTime },
  color: "#RRGGBB",
  entityName: "Pattern_01"
}
```

## Important Constraints

### Three.js Material Types
- **Image planes**: Use `MeshBasicMaterial` (unlit)
- **Textured OBJ meshes**: Use `MeshPhongMaterial` (matches MTLLoader)
- **Gradient surfaces**: Use `MeshBasicMaterial` with vertex colors
- Lighting setup: AmbientLight (0.8 intensity) + DirectionalLight (0.5 intensity)

### Texture Encoding (Three.js r150+)
```javascript
// OLD (deprecated):
texture.encoding = THREE.sRGBEncoding;
renderer.outputEncoding = THREE.sRGBEncoding;

// NEW (r150+):
texture.colorSpace = THREE.SRGBColorSpace;
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

### Material Cloning Pitfall
```javascript
// WRONG - loses texture reference:
child.material = material.clone();

// CORRECT - preserves texture:
var cloned = material.clone();
if (material.map) {
  cloned.map = material.map;
  cloned.needsUpdate = true;
}
child.material = cloned;
```

### IndexedDB Blob Storage
- Texture Blobs must be stored/retrieved as Blob type (not ArrayBuffer)
- Use `URL.createObjectURL(blob)` to create texture URLs
- Clean up blob URLs with `URL.revokeObjectURL()` after use

### Surface Cache Invalidation
After modifying surface properties (gradient, transparency, limits):
```javascript
window.invalidateSurfaceCache(surfaceId);  // Clears 2D canvas cache
window.drawData(window.allBlastHoles, window.selectedHole);  // Redraw
```

## Current Known Issues

### 1. OBJ Texture Reload (CRITICAL)
- **Status**: IN PROGRESS
- **Symptom**: Textured OBJ meshes visible on import, invisible after page reload
- **Diagnostics**: All properties correct (UV, texture, material), but not rendering
- **Investigation**: Material type mismatch suspected, changed to MeshPhongMaterial
- **Next Step**: Compare initial load vs rebuild material properties
- **See**: `IMPLEMENTATION_REVIEW_2026-01-09.md` for full investigation timeline

### 2. GeoTIFF CRS (PENDING)
- User mentioned CRS issue but not yet investigated
- Likely related to coordinate system metadata in export

## Testing Patterns

### Test OBJ Texture Reload
1. Clear IndexedDB (Application tab in DevTools)
2. Import textured OBJ file with MTL and JPG texture
3. Verify texture visible in 3D view (gradient = "texture")
4. Reload page (F5)
5. Check if texture still visible after reload

### Test Surface Export
1. Load/create surface
2. Apply gradient (e.g., "viridis")
3. File → Export Images as GeoTIFF
4. Select EPSG code and resolution
5. Verify GeoTIFF opens correctly in QGIS with proper coordinates

### Test Pattern Generation
1. Create rectangular pattern (Pattern → Add Pattern)
2. Verify holes created with correct spacing/burden
3. Export to CSV
4. Re-import and verify data integrity

## Recent Changes (2026-01-09)

**Completed:**
- GeoTIFF export system (5 new files, ~1500 lines)
- Multi-resolution export modes
- CRS/projection dialog
- Surface rasterization with gradient preservation

**In Progress:**
- OBJ texture reload fix (material type changed, issue persists)
- Added extensive diagnostics for material comparison

**Modified Files:**
- `src/kirra.js` - Material creation, texture encoding updates
- `src/three/ThreeRenderer.js` - Renderer color space
- `src/three/GeometryFactory.js` - Image plane materials
- `src/draw/canvas3DDrawing.js` - Texture diagnostics

See `IMPLEMENTATION_REVIEW_2026-01-09.md` for complete session details.


Reducing the size of kirra.js is important.  
Code should go in appropriate modularised folders.
That is, helper code goes in src/helpers, tools go in src/tools, etc.

Hole Details context for Kirra's Data Model:

- Angle is 0 degrees vertical (horizontal is 90 degrees)
- Dip is 90 degrees vertical (horizontal is 0 degrees - also known as Mast Angle)
- Bearing is 0 degrees North, 180 degrees South, 90 degrees East and 270 degrees West
- Other systems use different settings, Surpac is -90 vertical down etc. Be aware to ask if unsure.

TreeView Hole Node
Node ID format: "hole⣿entityName⣿holeID" (3 parts)

TreeViewEntity Node
Node ID format: "entityType⣿entityName⣿element⣿pointID" (4 parts)

Use Factory code, do not make custom code if there is an existing function that can be reused.  
Avoid "Code Bloat".  
Example 1, the GeometryFactory is where all the threeJS Geometry is base code is,
And it should be reused for UX consistency.
Example 2, the FloatingDialog Class is what all Dialogs Popups, Menus should be constructed from FloatingDialog.js

Plans should be saved in the folder called "aiPlans" with the naming convention of YYYMMDD-hhmm-PlanName.md

Use Factory code, do not make custom code if there is an existing function that can be reused.  

Avoid "Code Bloat".  
Example 1, the GeometryFactory is where all the threeJS Geometry is base code is, and it should be reused for UX consistency.
Example 2, the FloatingDialog Class is what all Dialogs Popups, Menus should be constructed from

Selection in threeJS is a tunnel.
A fat ray cast from the camera to infinity.  
It is displayed in screen space or camera frustrum space.
Use Frustrum culling

Do not transform Z elevations.

Do not scale the 3D transform.  Use the same XY transform as 2D.

Data used in this application can be very large values.  It is often UTM.
2D approach is to transform the data based on the data centroid.  
The data centroid is 0,0,Average Z and the XY needs to be transformed.  
Do not scale the 3D use the same 2D transform.

ThreeJS Rules

- Orbit in 3D should be around the Mouse Screen X Y and the Data Z centroid.
- Zoom should zoom to the Same Mouse Screen XY and the Data Z centroid
- The 3D entitys should mimic the 2D entitys except that the scene can orbit and Rotate.
- Pan is the default mode
- Selection and interaction should interact the same as the 2D selection and Interaction.
- Generally the Data loaded will be in UTM or a cutom mine grid.  
- 2D translates the large UTM coords to the 2D local by minusing off the centroid.  
- Always Check the 3D is in the correct coordinate space to be drawn.

Bearing moves clockwise, North is 0° bearing, 90° is west, 180°is south, 270° is East.

The canvas in the Kirra App is Y up is North +ve and Y down is South -ve,
West is X -ve and East is X +ve.  
Kirra is a UTM styled Real World Coordinate app.

Data structure for blast holes:
 entityName = data.entityName || "";
 entityType = data.entityType || "hole";
 holeID = data.holeID || null;
 startXLocation  = data.startXLocation || 0;
 startYLocation  = data.startYLocation || 0;
 startZLocation = data.startZLocation || 0;
 endXLocation = data.endXLocation || 0;
 endYLocation = data.endYLocation || 0;
 endZLocation = data.endZLocation || 0;
 gradeXLocation = data.gradeXLocation || 0;
 gradeYLocation = data.gradeYLocation || 0;
 gradeZLocation = data.gradeZLocation || 0;
 subdrillAmount = data.subdrillAmount || 0; //deltaZ of gradeZ to toeZ -> downhole =+ve uphole =-ve
 subdrillLength = data.subdrillLength || 0; //distance of subdrill from gradeXYZ to toeXYZ -> downhole =+ve uphole =-ve
 benchHeight = data.benchHeight || 0; //deltaZ of collarZ to gradeZ -> always Absolute
 holeDiameter = data.holeDiameter || 115;
 holeType = data.holeType || "Undefined";
 fromHoleID = data.fromHoleID || "";
 timingDelayMilliseconds = data.timingDelayMilliseconds || 0;
 colorHexDecimal = data.colorHexDecimal || "red";
 holeLengthCalculated = data.holeLengthCalculated || 0; //Distance from the collarXYZ to the ToeXYZ
 holeAngle = data.holeAngle || 0; //Angle of the blast hole from Collar to Toe --> 0° = Vertical
 holeBearing = data.holeBearing || 0;
 measuredLength = data.measuredLength || 0;
 measuredLengthTimeStamp = data.measuredLengthTimeStamp || "09/05/1975 00:00:00";
 measuredMass = data.measuredMass || 0;
 measuredMassTimeStamp = data.measuredMassTimeStamp || "09/05/1975 00:00:00";
 measuredComment = data.measuredComment || "None";
 measuredCommentTimeStamp = data.measuredCommentTimeStamp || "09/05/1975 00:00:00";
 rowID = data.rowID || null;
 posID = data.posID || null;
 visible = data.visible !== false;
 burden = data.burden || 1;
 spacing = data.spacing || 1;
 connectorCurve = data.connectorCurve || 0;

pointObject = {
   entityName: entityName,
   entityType: entityType,
   pointID: pointID,
   pointXLocation: pointXLocation,
   pointYLocation: pointYLocation,
   pointZLocation: pointZLocation,
   lineWidth: lineWidth, // This is added for inter-changable types. points > lines > polys
   color: color,
   connected: false,
   closed: false,
   visible: true,
  };
lineObject = {
   entityName: entityName,
   entityType: entityType,
   pointID: pointID,
   pointXLocation: pointXLocation,
   pointYLocation: pointYLocation,
   pointZLocation: pointZLocation,
   lineWidth: lineWidth,
   color: color,
   closed: false, // Added: lines are open
   visible: true,
  };
polyObject = {
   entityName: entityName,
   entityType: entityType,
   pointID: pointID,
   pointXLocation: pointXLocation,
   pointYLocation: pointYLocation,
   pointZLocation: pointZLocation,
   lineWidth: lineWidth,
   color: color,
   closed: closed, // Set to true if the polygon is closed
   visible: true,
  };

textObject = {
   entityName: entityName,
   entityType: entityType,
   pointID: pointID,
   pointXLocation: pointXLocation,
   pointYLocation: pointYLocation,
   pointZLocation: pointZLocation,
   text: text, // ? Now using the processed text
   color: color,
   fontHeight: 12, // Step B1) Default fontHeight for new text entities
   connected: false,
   closed: false,
   visible: true,
  };
