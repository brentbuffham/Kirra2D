# FileManager Phase 7: Remaining Format Implementations

**Date:** 2026-01-10 02:00
**Status:** PLANNED
**Priority:** Medium
**Scope:** Implement parsers and writers for GLTF, KML/KMZ, LAS, and Shapefile formats

## Overview

Complete the FileManager implementation by adding support for four important geospatial and 3D formats. These formats enhance Kirra's interoperability with GIS software, 3D modeling tools, and web mapping applications.

## Target Formats

### 1. GLTF/GLB (GL Transmission Format)
**Purpose:** 3D model export for web and graphics applications
**Use Case:** Export Kirra 3D scenes for Blender, Three.js viewers, game engines

### 2. KML/KMZ (Keyhole Markup Language)
**Purpose:** Google Earth / Google Maps integration
**Use Case:** Share blast patterns and surfaces in Google Earth

### 3. LAS (LASer)
**Purpose:** Point cloud format for LiDAR data
**Use Case:** Import LiDAR point clouds as surfaces

### 4. Shapefile (SHP)
**Purpose:** ESRI vector format (industry standard GIS)
**Use Case:** Export holes, KADs, and surfaces as GIS layers

## Current Implementation Status

### Completed Formats
**Import:**
- ✅ CSV (blast holes)
- ✅ DXF (CAD)
- ✅ IREDES (Epiroc)
- ✅ CBLAST (Orica)
- ✅ Wenco (CSV variant)
- ✅ DTM/STR (Surpac surfaces)
- ✅ OBJ/MTL (3D meshes with textures)
- ✅ PLY (3D meshes)

**Export:**
- ✅ CSV (blast holes)
- ✅ DXF (holes + KADs)
- ✅ DTM (Surpac surfaces)
- ✅ OBJ (3D meshes)
- ✅ GeoTIFF (raster surfaces)

### FileManager Architecture
**File:** `src/fileIO/FileManager.js`

**Pattern:**
```javascript
class FileManager {
    registerParser(formatId, ParserClass, options) {
        // Register import parser
    }

    registerWriter(formatId, WriterClass, options) {
        // Register export writer
    }

    async import(file) {
        // Dispatch to appropriate parser based on extension
    }

    async export(formatId, data, options) {
        // Dispatch to appropriate writer
    }
}
```

## Implementation Plan

### Phase 7.1: GLTF Export (6-8 hours)

#### Overview
Export Kirra's 3D scene as GLTF/GLB for use in other 3D applications. GLTF is the "JPEG of 3D" - widely supported standard format.

#### File Structure
```
src/
└── fileIO/
    └── ThreeJSMeshIO/
        ├── GLTFExporter.js (already exists - Three.js addon)
        └── GLTFKirraWriter.js (new - Kirra-specific wrapper)
```

#### Implementation

**File:** `src/io/writers/GLTFKirraWriter.js` (new file)

```javascript
import { BaseWriter } from '../../fileIO/BaseWriter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export class GLTFKirraWriter extends BaseWriter {
    async write(data) {
        const { scene, filename, binary = true, includeHoles = true, includeSurfaces = true, includeKADs = true } = data;

        // Step 1) Validate Three.js scene exists
        if (!window.threeRenderer || !window.threeRenderer.scene) {
            throw new Error("3D scene not initialized");
        }

        // Step 2) Clone scene to avoid modifying original
        const exportScene = window.threeRenderer.scene.clone(true);

        // Step 3) Filter objects based on options
        const objectsToRemove = [];
        exportScene.traverse((object) => {
            const userData = object.userData || {};

            // Remove UI elements (grids, axes, labels)
            if (userData.type === 'grid' || userData.type === 'axis' || userData.isUIElement) {
                objectsToRemove.push(object);
            }

            // Optional: Remove holes if not included
            if (!includeHoles && (userData.type === 'hole' || userData.type === 'toeCircle')) {
                objectsToRemove.push(object);
            }

            // Optional: Remove surfaces if not included
            if (!includeSurfaces && userData.type === 'surface') {
                objectsToRemove.push(object);
            }

            // Optional: Remove KADs if not included
            if (!includeKADs && userData.type === 'kad') {
                objectsToRemove.push(object);
            }
        });

        // Remove filtered objects
        objectsToRemove.forEach(obj => {
            if (obj.parent) obj.parent.remove(obj);
        });

        // Step 4) Transform to world coordinates
        // CRITICAL: GLTF should use world coordinates (UTM), not local Three.js coords
        const originX = window.threeLocalOriginX || 0;
        const originY = window.threeLocalOriginY || 0;

        exportScene.traverse((object) => {
            if (object.isMesh || object.isLine || object.isPoints) {
                // Translate back to world coordinates
                object.position.x += originX;
                object.position.y += originY;
                object.updateMatrix();
            }
        });

        // Step 5) Configure GLTF exporter
        const exporter = new GLTFExporter();

        const options = {
            binary: binary, // true = .glb, false = .gltf
            embedImages: true, // Include textures in file
            maxTextureSize: 4096, // Limit texture size
            trs: false, // Use matrix instead of translation/rotation/scale
            onlyVisible: true, // Skip invisible objects
        };

        // Step 6) Export scene
        return new Promise((resolve, reject) => {
            exporter.parse(
                exportScene,
                (result) => {
                    let blob;
                    const extension = binary ? '.glb' : '.gltf';
                    const finalFilename = filename.replace(/\.[^.]+$/, '') + extension;

                    if (binary) {
                        // Binary .glb format
                        blob = new Blob([result], { type: 'application/octet-stream' });
                    } else {
                        // Text .gltf format (JSON)
                        const output = JSON.stringify(result, null, 2);
                        blob = new Blob([output], { type: 'application/json' });
                    }

                    // Step 7) Trigger download
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = finalFilename;
                    link.click();
                    URL.revokeObjectURL(url);

                    console.log(`✅ Exported GLTF: ${finalFilename} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
                    resolve({ filename: finalFilename, size: blob.size });
                },
                (error) => {
                    console.error("❌ GLTF export failed:", error);
                    reject(error);
                },
                options
            );
        });
    }
}
```

#### Export Dialog

**File:** `src/dialog/popups/export/GLTFExportDialog.js` (new file)

```javascript
import { FloatingDialog } from '../../FloatingDialog.js';

export function showGLTFExportDialog() {
    const fields = [
        {
            type: 'select',
            id: 'format',
            label: 'Format',
            value: 'binary',
            options: [
                { value: 'binary', label: 'GLB (Binary)' },
                { value: 'text', label: 'GLTF (Text + separate textures)' }
            ]
        },
        {
            type: 'checkbox',
            id: 'includeHoles',
            label: 'Include blast holes',
            value: true
        },
        {
            type: 'checkbox',
            id: 'includeSurfaces',
            label: 'Include surfaces',
            value: true
        },
        {
            type: 'checkbox',
            id: 'includeKADs',
            label: 'Include KAD drawings',
            value: true
        },
        {
            type: 'checkbox',
            id: 'includeContours',
            label: 'Include timing contours',
            value: true
        }
    ];

    const content = createEnhancedFormContent(fields);

    const dialog = new FloatingDialog({
        title: 'Export 3D Scene as GLTF',
        content: content,
        showConfirm: true,
        confirmText: 'Export',
        onConfirm: async function() {
            const formData = getFormData(content);

            try {
                const writer = new GLTFKirraWriter();
                await writer.write({
                    scene: window.threeRenderer.scene,
                    filename: 'kirra_scene.glb',
                    binary: formData.format === 'binary',
                    includeHoles: formData.includeHoles,
                    includeSurfaces: formData.includeSurfaces,
                    includeKADs: formData.includeKADs
                });

                showSuccessMessage("GLTF exported successfully!");
            } catch (error) {
                showErrorDialog("GLTF Export Failed", error.message);
            }
        }
    });

    dialog.show();
}
```

#### Menu Integration

**File:** `src/dialog/menuBar/fileMenu.js`

Add to Export submenu:
```javascript
{
    label: 'Export 3D Scene as GLTF...',
    action: () => showGLTFExportDialog(),
    enabled: () => window.threeInitialized
}
```

### Phase 7.2: KML/KMZ Export (4-6 hours)

#### Overview
Export blast patterns and surfaces as KML for Google Earth. KMZ is zipped KML with embedded images.

#### File Structure
```
src/
└── io/
    └── writers/
        ├── KMLWriter.js (new - blast holes + KADs)
        └── KMZWriter.js (new - with surface images)
```

#### Implementation

**File:** `src/io/writers/KMLWriter.js` (new file)

```javascript
import { BaseWriter } from '../../fileIO/BaseWriter.js';

export class KMLWriter extends BaseWriter {
    async write(data) {
        const { holes = [], surfaces = [], kads = [], filename = 'kirra_export.kml' } = data;

        // Step 1) Build KML document
        let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
        kml += '<Document>\n';
        kml += '  <name>Kirra Blast Design</name>\n';

        // Step 2) Add styles for different hole types
        kml += this.generateStyles();

        // Step 3) Add blast holes as placemarks
        if (holes && holes.length > 0) {
            kml += '  <Folder>\n';
            kml += '    <name>Blast Holes</name>\n';

            holes.forEach(hole => {
                kml += this.holeToKML(hole);
            });

            kml += '  </Folder>\n';
        }

        // Step 4) Add KAD drawings (points, lines, polygons)
        if (kads && kads.length > 0) {
            kml += '  <Folder>\n';
            kml += '    <name>Drawings</name>\n';

            kads.forEach(kad => {
                kml += this.kadToKML(kad);
            });

            kml += '  </Folder>\n';
        }

        // Step 5) Add surfaces as ground overlays (requires KMZ)
        // Note: Full surface support requires KMZ with embedded images

        kml += '</Document>\n';
        kml += '</kml>';

        // Step 6) Download KML file
        const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        console.log(`✅ Exported KML: ${filename}`);
    }

    generateStyles() {
        return `
  <Style id="hole-production">
    <IconStyle>
      <color>ff0000ff</color>
      <scale>0.8</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
    </IconStyle>
  </Style>
  <Style id="hole-presplit">
    <IconStyle>
      <color>ff00ff00</color>
      <scale>0.6</scale>
    </IconStyle>
  </Style>
        `;
    }

    holeToKML(hole) {
        // Convert to WGS84 lat/lon (Google Earth requires geographic coords)
        const { lat, lon } = this.utmToLatLon(hole.startXLocation, hole.startYLocation);

        return `
    <Placemark>
      <name>${hole.holeID || 'Hole'}</name>
      <description>
        <![CDATA[
          <b>Type:</b> ${hole.holeType}<br/>
          <b>Depth:</b> ${hole.holeLengthCalculated.toFixed(2)}m<br/>
          <b>Angle:</b> ${hole.holeAngle.toFixed(1)}°<br/>
          <b>Bearing:</b> ${hole.holeBearing.toFixed(1)}°<br/>
          <b>Diameter:</b> ${hole.holeDiameter}mm
        ]]>
      </description>
      <styleUrl>#hole-${hole.holeType.toLowerCase()}</styleUrl>
      <Point>
        <extrude>1</extrude>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>${lon},${lat},${hole.startZLocation}</coordinates>
      </Point>
    </Placemark>
        `;
    }

    kadToKML(kad) {
        // Convert KAD entity (point/line/polygon) to KML geometry
        // Implementation details...
    }

    utmToLatLon(easting, northing, zone = 56, hemisphere = 'S') {
        // Convert UTM to WGS84 geographic coordinates
        // Use proj4.js or implement algorithm
        // For now, placeholder return
        return { lat: -28.0, lon: 153.0 }; // Example coordinates
    }
}
```

**Note:** Full UTM → WGS84 conversion requires a projection library like `proj4.js`.

#### Dependencies

**Add to package.json:**
```json
{
  "dependencies": {
    "proj4": "^2.9.0"
  }
}
```

### Phase 7.3: LAS Point Cloud Import (6-8 hours)

#### Overview
Import LiDAR point clouds (LAS format) as surfaces. LAS is binary format with XYZ + classification + color.

#### File Structure
```
src/
└── fileIO/
    └── LasFileIO/
        ├── LASParser.js (new - read binary LAS)
        └── LASPointCloudToSurface.js (new - triangulate points)
```

#### Implementation

**File:** `src/fileIO/LasFileIO/LASParser.js` (new file)

```javascript
import { BaseParser } from '../BaseParser.js';

export class LASParser extends BaseParser {
    async parse(file) {
        // Step 1) Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();
        const dataView = new DataView(buffer);

        // Step 2) Parse LAS header
        const header = this.parseLASHeader(dataView);
        console.log("LAS Header:", header);

        // Step 3) Validate version (support 1.2, 1.3, 1.4)
        if (header.versionMajor !== 1 || header.versionMinor < 2) {
            throw new Error(`Unsupported LAS version: ${header.versionMajor}.${header.versionMinor}`);
        }

        // Step 4) Parse point records
        const points = this.parsePoints(dataView, header);
        console.log(`Parsed ${points.length} LAS points`);

        // Step 5) Decimate if too many points (optional)
        const decimatedPoints = this.decimatePoints(points, 50000); // Limit to 50k points

        // Step 6) Return as surface data
        return {
            formatType: 'surface',
            points: decimatedPoints,
            triangles: null, // Will triangulate later
            sourceFormat: 'LAS',
            metadata: {
                pointCount: points.length,
                bounds: header.bounds,
                crs: header.crs || 'Unknown'
            }
        };
    }

    parseLASHeader(dataView) {
        let offset = 0;

        // LAS Header (227 bytes for LAS 1.2)
        const fileSignature = String.fromCharCode(
            dataView.getUint8(offset++),
            dataView.getUint8(offset++),
            dataView.getUint8(offset++),
            dataView.getUint8(offset++)
        );

        if (fileSignature !== 'LASF') {
            throw new Error("Not a valid LAS file");
        }

        // Skip file source ID, global encoding, GUID (offset 4-44)
        offset = 24;

        // Version
        const versionMajor = dataView.getUint8(offset++);
        const versionMinor = dataView.getUint8(offset++);

        // Skip system ID, generating software (offset 26-122)
        offset = 96;

        // Header size
        const headerSize = dataView.getUint16(offset, true); // Little-endian
        offset += 2;

        // Offset to point data
        const pointDataOffset = dataView.getUint32(offset, true);
        offset += 4;

        // Number of variable length records
        const numVLRs = dataView.getUint32(offset, true);
        offset += 4;

        // Point data format
        const pointDataFormat = dataView.getUint8(offset++);

        // Point record length
        const pointRecordLength = dataView.getUint16(offset, true);
        offset += 2;

        // Number of point records
        const numPointRecords = dataView.getUint32(offset, true);
        offset += 4;

        // Skip points by return (offset 110-130)
        offset = 131;

        // Scale factors
        const scaleX = dataView.getFloat64(offset, true); offset += 8;
        const scaleY = dataView.getFloat64(offset, true); offset += 8;
        const scaleZ = dataView.getFloat64(offset, true); offset += 8;

        // Offsets
        const offsetX = dataView.getFloat64(offset, true); offset += 8;
        const offsetY = dataView.getFloat64(offset, true); offset += 8;
        const offsetZ = dataView.getFloat64(offset, true); offset += 8;

        // Bounds
        const maxX = dataView.getFloat64(offset, true); offset += 8;
        const minX = dataView.getFloat64(offset, true); offset += 8;
        const maxY = dataView.getFloat64(offset, true); offset += 8;
        const minY = dataView.getFloat64(offset, true); offset += 8;
        const maxZ = dataView.getFloat64(offset, true); offset += 8;
        const minZ = dataView.getFloat64(offset, true); offset += 8;

        return {
            versionMajor,
            versionMinor,
            pointDataOffset,
            pointDataFormat,
            pointRecordLength,
            numPointRecords,
            scale: { x: scaleX, y: scaleY, z: scaleZ },
            offset: { x: offsetX, y: offsetY, z: offsetZ },
            bounds: { minX, maxX, minY, maxY, minZ, maxZ }
        };
    }

    parsePoints(dataView, header) {
        const points = [];
        let offset = header.pointDataOffset;

        for (let i = 0; i < header.numPointRecords; i++) {
            // Read raw coordinates (32-bit integers)
            const rawX = dataView.getInt32(offset, true); offset += 4;
            const rawY = dataView.getInt32(offset, true); offset += 4;
            const rawZ = dataView.getInt32(offset, true); offset += 4;

            // Convert to actual coordinates
            const x = rawX * header.scale.x + header.offset.x;
            const y = rawY * header.scale.y + header.offset.y;
            const z = rawZ * header.scale.z + header.offset.z;

            points.push({ x, y, z });

            // Skip rest of point record (intensity, return, classification, etc.)
            offset += (header.pointRecordLength - 12);
        }

        return points;
    }

    decimatePoints(points, maxPoints) {
        if (points.length <= maxPoints) return points;

        // Simple regular decimation (every Nth point)
        const step = Math.ceil(points.length / maxPoints);
        const decimated = [];

        for (let i = 0; i < points.length; i += step) {
            decimated.push(points[i]);
        }

        console.log(`Decimated ${points.length} points → ${decimated.length} points`);
        return decimated;
    }
}
```

#### Integration

**Register in FileManager:**
```javascript
fileManager.registerParser('las', LASParser, {
    extensions: ['.las', '.laz'],
    category: 'surface',
    description: 'LAS Point Cloud'
});
```

### Phase 7.4: Shapefile Export (8-10 hours)

#### Overview
Export blast holes, KADs, and surfaces as ESRI Shapefiles - the industry standard GIS format. Shapefile is actually 3+ files (.shp, .shx, .dbf, .prj).

#### File Structure
```
src/
└── io/
    └── writers/
        ├── ShapefileWriter.js (new - coordinate wrapper)
        ├── SHPGeometryWriter.js (new - .shp binary)
        ├── SHXIndexWriter.js (new - .shx binary)
        ├── DBFAttributeWriter.js (new - .dbf binary)
        └── PRJProjectionWriter.js (new - .prj text)
```

#### Dependencies

**Add to package.json:**
```json
{
  "dependencies": {
    "shpjs": "^4.0.4"
  }
}
```

Or implement from scratch (complex but doable).

#### Implementation (using shpwrite library)

**File:** `src/io/writers/ShapefileWriter.js` (new file)

```javascript
import { BaseWriter } from '../../fileIO/BaseWriter.js';
import shpwrite from 'shp-write'; // Or custom implementation

export class ShapefileWriter extends BaseWriter {
    async write(data) {
        const { type, entities, filename, epsg = 32756 } = data;

        // Step 1) Convert entities to GeoJSON
        const geojson = this.entitiesToGeoJSON(type, entities);

        // Step 2) Convert GeoJSON to Shapefile buffers
        const shapefileBuffers = await this.geojsonToShapefile(geojson, epsg);

        // Step 3) Package as ZIP (shapefile = .shp + .shx + .dbf + .prj)
        const zip = this.packageShapefile(shapefileBuffers, filename);

        // Step 4) Download ZIP file
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.replace(/\.[^.]+$/, '') + '.zip';
        link.click();
        URL.revokeObjectURL(url);

        console.log(`✅ Exported Shapefile: ${filename}`);
    }

    entitiesToGeoJSON(type, entities) {
        // Convert Kirra entities to GeoJSON FeatureCollection
        const features = [];

        if (type === 'holes') {
            entities.forEach(hole => {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [hole.startXLocation, hole.startYLocation, hole.startZLocation]
                    },
                    properties: {
                        holeID: hole.holeID,
                        holeType: hole.holeType,
                        depth: hole.holeLengthCalculated,
                        diameter: hole.holeDiameter,
                        angle: hole.holeAngle,
                        bearing: hole.holeBearing
                    }
                });
            });
        } else if (type === 'lines') {
            // KAD lines as LineString
        } else if (type === 'polygons') {
            // KAD polygons as Polygon
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    async geojsonToShapefile(geojson, epsg) {
        // Use shpwrite library or custom implementation
        // Returns { shp, shx, dbf, prj }
    }

    packageShapefile(buffers, filename) {
        // Package .shp, .shx, .dbf, .prj into ZIP
        const JSZip = require('jszip'); // Or use existing zip library
        const zip = new JSZip();

        const baseName = filename.replace(/\.[^.]+$/, '');

        zip.file(`${baseName}.shp`, buffers.shp);
        zip.file(`${baseName}.shx`, buffers.shx);
        zip.file(`${baseName}.dbf`, buffers.dbf);
        zip.file(`${baseName}.prj`, buffers.prj);

        return zip;
    }
}
```

## Testing Plan

### GLTF Export Tests
1. Export scene with holes + surfaces
2. Import into Blender - verify geometry correct
3. Import into Three.js viewer - verify materials/textures
4. Check file size reasonable (< 50MB typical)

### KML Export Tests
1. Export blast holes as KML
2. Open in Google Earth - verify coordinates correct
3. Verify hole descriptions readable
4. Check icons/colors display correctly

### LAS Import Tests
1. Import small LAS file (< 1MB, ~100k points)
2. Verify points parsed correctly
3. Triangulate to surface
4. Check performance (< 5 seconds for 50k points)

### Shapefile Export Tests
1. Export holes as point shapefile
2. Import into QGIS - verify CRS correct
3. Verify attribute table complete
4. Export KADs as line/polygon shapefiles

## Timeline Estimate

- **Phase 7.1 (GLTF):** 6-8 hours
- **Phase 7.2 (KML):** 4-6 hours
- **Phase 7.3 (LAS):** 6-8 hours
- **Phase 7.4 (Shapefile):** 8-10 hours
- **Testing:** 4 hours

**Total:** 28-36 hours (4-5 days)

## Success Criteria

1. ✅ GLTF export opens correctly in Blender/Three.js viewers
2. ✅ KML displays blast patterns accurately in Google Earth
3. ✅ LAS point clouds import and triangulate successfully
4. ✅ Shapefiles open in QGIS with correct CRS and attributes
5. ✅ All formats registered in FileManager
6. ✅ Menu items added to File → Import/Export

## Future Enhancements

- **LAS export** - Save Kirra data as point cloud
- **KMZ surfaces** - Embed surface images in KMZ
- **Shapefile import** - Read GIS data into Kirra
- **GeoJSON** - Lightweight web-friendly format
- **FBX/COLLADA** - Additional 3D formats
- **IFC** - BIM format for construction
