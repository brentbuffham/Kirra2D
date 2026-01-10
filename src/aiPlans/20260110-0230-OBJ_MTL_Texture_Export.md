# OBJ/MTL/Texture Export with Material Support

**Date:** 2026-01-10 02:30
**Status:** PLANNED
**Priority:** High
**Scope:** Export surfaces as textured OBJ files with MTL materials and texture images (gradient or imported)

## Overview

Implement complete OBJ export functionality that includes:
1. **OBJ file** - Geometry with UV coordinates
2. **MTL file** - Material definitions referencing textures
3. **JPG/PNG file** - Texture image (gradient-generated OR original imported texture)

This creates a complete, portable 3D model that opens correctly in Blender, MeshLab, CloudCompare, and other 3D software.

## Current State

### Existing OBJ Export
**File:** `src/io/writers/OBJWriter.js`

**Current Capabilities:**
- ✅ Exports surface geometry (vertices, faces)
- ✅ Exports vertex normals
- ❌ No UV coordinates
- ❌ No MTL file generation
- ❌ No texture export
- ❌ Vertices in local coordinates (should be world/UTM)

**Current Output:**
```obj
# Vertices
v 478478.06 6772462.00 382.56
v 478479.12 6772463.45 381.22
...

# Faces (no UVs)
f 1 2 3
f 2 4 3
...
```

### Missing Components

1. **UV Coordinates** - Required for texture mapping
2. **MTL File** - Material library defining textures/colors
3. **Texture Export** - Actual image file (.jpg/.png)
4. **Coordinate Transform** - Reverse local → world coords

## Implementation Plan

### Phase 1: OBJ Export Enhancement (4-6 hours)

#### 1.1 Add UV Coordinate Generation
**File:** `src/io/writers/OBJWriter.js`

**Problem:** Current surfaces may not have UV coordinates. Need to generate them.

**Solution:** Use planar projection (simple XY mapping)

```javascript
function generateUVCoordinates(surface) {
    const { points, meshBounds } = surface;

    // Calculate UV extent (world coords)
    const minX = meshBounds.minX;
    const maxX = meshBounds.maxX;
    const minY = meshBounds.minY;
    const maxY = meshBounds.maxY;

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    // Generate UV for each point (0-1 normalized)
    const uvCoords = points.map(point => {
        const u = (point.x - minX) / rangeX;
        const v = (point.y - minY) / rangeY;

        return { u, v };
    });

    return uvCoords;
}
```

**UV Storage:**
- For imported OBJ meshes: Already have UVs from `geometry.attributes.uv`
- For generated surfaces (DTM, STR): Generate planar UVs
- Store UVs in surface data structure for reuse

#### 1.2 Update OBJ Writer with UV Export
**File:** `src/io/writers/OBJWriter.js`

```javascript
export class OBJWriter extends BaseWriter {
    async write(data) {
        const { surface, filename, includeTexture = true } = data;

        // Step 1) Transform vertices from local to world coordinates
        // CRITICAL: Reverse the coordinate transformation from import
        const originX = window.threeLocalOriginX || 0;
        const originY = window.threeLocalOriginY || 0;

        const worldPoints = surface.points.map(p => ({
            x: p.x + originX,  // Add back origin offset
            y: p.y + originY,
            z: p.z  // Z elevation unchanged
        }));

        // Step 2) Generate or retrieve UV coordinates
        let uvCoords;
        if (surface.isTexturedMesh && surface.uvCoords) {
            // Use existing UVs from imported mesh
            uvCoords = surface.uvCoords;
        } else {
            // Generate planar UVs for gradient surfaces
            uvCoords = this.generateUVCoordinates(surface);
        }

        // Step 3) Build OBJ content
        let objContent = `# Kirra OBJ Export\n`;
        objContent += `# Surface: ${surface.name}\n`;
        objContent += `# Points: ${worldPoints.length}\n`;
        objContent += `# Triangles: ${surface.triangles.length}\n\n`;

        // Material library reference
        const mtlFilename = filename.replace('.obj', '.mtl');
        objContent += `mtllib ${mtlFilename}\n\n`;

        // Vertices
        objContent += `# Vertices\n`;
        worldPoints.forEach(p => {
            objContent += `v ${p.x.toFixed(6)} ${p.y.toFixed(6)} ${p.z.toFixed(6)}\n`;
        });
        objContent += `\n`;

        // UV coordinates (texture coordinates)
        objContent += `# Texture Coordinates\n`;
        uvCoords.forEach(uv => {
            objContent += `vt ${uv.u.toFixed(6)} ${uv.v.toFixed(6)}\n`;
        });
        objContent += `\n`;

        // Vertex normals (if available)
        if (surface.normals) {
            objContent += `# Vertex Normals\n`;
            surface.normals.forEach(n => {
                objContent += `vn ${n.x.toFixed(6)} ${n.y.toFixed(6)} ${n.z.toFixed(6)}\n`;
            });
            objContent += `\n`;
        }

        // Material usage
        objContent += `usemtl ${surface.name}_material\n\n`;

        // Faces (1-indexed, with UV and normal)
        objContent += `# Faces\n`;
        surface.triangles.forEach(tri => {
            // Format: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3
            if (surface.normals) {
                objContent += `f ${tri.a+1}/${tri.a+1}/${tri.a+1} ${tri.b+1}/${tri.b+1}/${tri.b+1} ${tri.c+1}/${tri.c+1}/${tri.c+1}\n`;
            } else {
                objContent += `f ${tri.a+1}/${tri.a+1} ${tri.b+1}/${tri.b+1} ${tri.c+1}/${tri.c+1}\n`;
            }
        });

        // Step 4) Download OBJ file
        const objBlob = new Blob([objContent], { type: 'text/plain' });
        this.downloadFile(objBlob, filename);

        // Step 5) Generate and download MTL file
        if (includeTexture) {
            await this.generateMTL(surface, mtlFilename);
            await this.generateTexture(surface, filename);
        }

        console.log(`✅ Exported OBJ: ${filename}`);
    }

    generateUVCoordinates(surface) {
        const { points, meshBounds } = surface;

        const minX = meshBounds.minX;
        const maxX = meshBounds.maxX;
        const minY = meshBounds.minY;
        const maxY = meshBounds.maxY;

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;

        return points.map(point => ({
            u: (point.x - minX) / rangeX,
            v: (point.y - minY) / rangeY
        }));
    }

    async generateMTL(surface, mtlFilename) {
        // Generate MTL file (see Phase 2)
    }

    async generateTexture(surface, objFilename) {
        // Generate texture image (see Phase 3)
    }
}
```

### Phase 2: MTL File Generation (2-3 hours)

#### 2.1 Create MTL Writer
**File:** `src/io/writers/MTLWriter.js` (new file)

```javascript
export class MTLWriter {
    static generate(surface, textureFilename) {
        const materialName = `${surface.name}_material`;

        let mtlContent = `# Kirra MTL Export\n`;
        mtlContent += `# Material for: ${surface.name}\n\n`;

        mtlContent += `newmtl ${materialName}\n`;

        // Ambient color (Ka)
        mtlContent += `Ka 0.2 0.2 0.2\n`;

        // Diffuse color (Kd) - white (texture will provide color)
        mtlContent += `Kd 1.0 1.0 1.0\n`;

        // Specular color (Ks) - low specular for terrain
        mtlContent += `Ks 0.1 0.1 0.1\n`;

        // Specular exponent (Ns)
        mtlContent += `Ns 10.0\n`;

        // Illumination model (2 = highlight on)
        mtlContent += `illum 2\n`;

        // Texture map reference
        mtlContent += `map_Kd ${textureFilename}\n`;

        return mtlContent;
    }
}
```

#### 2.2 Integrate MTL Generation in OBJ Writer

```javascript
async generateMTL(surface, mtlFilename) {
    const textureFilename = mtlFilename.replace('.mtl', '.jpg');
    const mtlContent = MTLWriter.generate(surface, textureFilename);

    const mtlBlob = new Blob([mtlContent], { type: 'text/plain' });
    this.downloadFile(mtlBlob, mtlFilename);

    console.log(`✅ Generated MTL: ${mtlFilename}`);
}
```

### Phase 3: Texture Generation/Export (4-6 hours)

#### 3.1 Texture Export Strategy

**Two Cases:**

**Case 1: Imported Textured Mesh**
- Surface has `surface.isTexturedMesh = true`
- Original texture stored in `surface.textureBlobs`
- Export original texture directly

**Case 2: Gradient Surface (DTM, STR, etc.)**
- No original texture
- Generate texture by rendering surface with current gradient
- Use `SurfaceRasterizer` to create texture image

#### 3.2 Implement Texture Export
**File:** `src/io/writers/OBJWriter.js`

```javascript
async generateTexture(surface, objFilename) {
    const textureFilename = objFilename.replace('.obj', '.jpg');

    if (surface.isTexturedMesh && surface.textureBlobs) {
        // Case 1: Export original imported texture
        await this.exportOriginalTexture(surface, textureFilename);
    } else {
        // Case 2: Generate gradient texture
        await this.generateGradientTexture(surface, textureFilename);
    }
}

async exportOriginalTexture(surface, textureFilename) {
    // Get first texture blob (assume single texture for now)
    const textureName = Object.keys(surface.textureBlobs)[0];
    const textureBlob = surface.textureBlobs[textureName];

    if (!textureBlob) {
        console.warn("No texture blob found for textured mesh");
        return;
    }

    // Download original texture
    this.downloadFile(textureBlob, textureFilename);
    console.log(`✅ Exported original texture: ${textureFilename}`);
}

async generateGradientTexture(surface, textureFilename) {
    // Use SurfaceRasterizer to render surface to canvas
    const resolution = 2048; // Texture resolution (2K standard)

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate aspect ratio
    const { meshBounds } = surface;
    const width = meshBounds.maxX - meshBounds.minX;
    const height = meshBounds.maxY - meshBounds.minY;
    const aspectRatio = width / height;

    // Set canvas dimensions maintaining aspect ratio
    if (aspectRatio > 1) {
        canvas.width = resolution;
        canvas.height = Math.round(resolution / aspectRatio);
    } else {
        canvas.height = resolution;
        canvas.width = Math.round(resolution * aspectRatio);
    }

    // Render surface triangles with gradient colors
    const gradient = surface.gradient || 'default';
    const minZ = meshBounds.minZ;
    const maxZ = meshBounds.maxZ;

    surface.triangles.forEach(tri => {
        const p1 = surface.points[tri.a];
        const p2 = surface.points[tri.b];
        const p3 = surface.points[tri.c];

        // Map world coords to texture UV coords
        const u1 = (p1.x - meshBounds.minX) / width;
        const v1 = (p1.y - meshBounds.minY) / height;
        const u2 = (p2.x - meshBounds.minX) / width;
        const v2 = (p2.y - meshBounds.minY) / height;
        const u3 = (p3.x - meshBounds.minX) / width;
        const v3 = (p3.y - meshBounds.minY) / height;

        // Get colors for each vertex
        const color1 = window.elevationToColor(p1.z, minZ, maxZ, gradient);
        const color2 = window.elevationToColor(p2.z, minZ, maxZ, gradient);
        const color3 = window.elevationToColor(p3.z, minZ, maxZ, gradient);

        // Draw triangle with gradient fill
        this.drawGradientTriangle(ctx, canvas.width, canvas.height,
            u1, v1, color1,
            u2, v2, color2,
            u3, v3, color3
        );
    });

    // Convert canvas to JPEG blob
    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.95);
    });

    // Download texture
    this.downloadFile(blob, textureFilename);
    console.log(`✅ Generated gradient texture: ${textureFilename} (${canvas.width}x${canvas.height})`);
}

drawGradientTriangle(ctx, canvasWidth, canvasHeight, u1, v1, color1, u2, v2, color2, u3, v3, color3) {
    // Convert UV (0-1) to canvas pixels
    const x1 = u1 * canvasWidth;
    const y1 = (1 - v1) * canvasHeight; // Flip Y (UV origin is bottom-left)
    const x2 = u2 * canvasWidth;
    const y2 = (1 - v2) * canvasHeight;
    const x3 = u3 * canvasWidth;
    const y3 = (1 - v3) * canvasHeight;

    // Simple approach: Fill triangle with average color
    // (Per-pixel gradient would require custom shader/rasterizer)
    const avgColor = this.averageColors([color1, color2, color3]);

    ctx.fillStyle = avgColor;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
}

averageColors(colors) {
    // Average RGB values
    let r = 0, g = 0, b = 0;
    colors.forEach(color => {
        const rgb = this.parseRGB(color);
        r += rgb.r;
        g += rgb.g;
        b += rgb.b;
    });
    r = Math.round(r / colors.length);
    g = Math.round(g / colors.length);
    b = Math.round(b / colors.length);
    return `rgb(${r},${g},${b})`;
}

parseRGB(rgbString) {
    // Parse "rgb(255,128,64)" format
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
    };
}
```

### Phase 4: Export Dialog (2-3 hours)

#### 4.1 Create OBJ Export Dialog
**File:** `src/dialog/popups/export/OBJExportDialog.js` (enhance existing)

```javascript
export function showOBJExportDialog(surface) {
    const fields = [
        {
            type: 'text',
            id: 'filename',
            label: 'Filename',
            value: surface.name.replace(/\.[^.]+$/, '') + '.obj',
            required: true
        },
        {
            type: 'checkbox',
            id: 'includeTexture',
            label: 'Include texture (MTL + JPG)',
            value: true,
            description: 'Export material and texture files with geometry'
        },
        {
            type: 'select',
            id: 'textureResolution',
            label: 'Texture resolution',
            value: '2048',
            options: [
                { value: '1024', label: '1K (1024x1024)' },
                { value: '2048', label: '2K (2048x2048) - Recommended' },
                { value: '4096', label: '4K (4096x4096)' },
                { value: '8192', label: '8K (8192x8192) - High quality' }
            ],
            visible: function() {
                return document.getElementById('includeTexture').checked;
            }
        },
        {
            type: 'checkbox',
            id: 'worldCoordinates',
            label: 'Use world coordinates (UTM)',
            value: true,
            description: 'Vertices in UTM coordinates (recommended for GIS)'
        }
    ];

    const content = createEnhancedFormContent(fields);

    const dialog = new FloatingDialog({
        title: 'Export Surface as OBJ',
        content: content,
        showConfirm: true,
        confirmText: 'Export',
        onConfirm: async function() {
            const formData = getFormData(content);

            try {
                const writer = new OBJWriter();
                await writer.write({
                    surface: surface,
                    filename: formData.filename,
                    includeTexture: formData.includeTexture,
                    textureResolution: parseInt(formData.textureResolution),
                    worldCoordinates: formData.worldCoordinates
                });

                showSuccessMessage("OBJ exported successfully!");
            } catch (error) {
                showErrorDialog("OBJ Export Failed", error.message);
            }
        }
    });

    dialog.show();
}
```

#### 4.2 Add to Context Menu
**File:** `src/dialog/contextMenus/surfaceContextMenu.js`

```javascript
{
    label: 'Export as OBJ...',
    action: () => showOBJExportDialog(surface),
    icon: '📦'
}
```

### Phase 5: Specialized Surface Analysis Export Tool (4-6 hours)

See separate plan: `20260110-0230-Surface_Analysis_Raster_Export.md`

## Technical Considerations

### Coordinate System
- **OBJ Export:** Vertices in **world coordinates (UTM)** - standard for GIS
- **UV Coordinates:** Normalized 0-1 range
- **Texture Mapping:** Planar XY projection (simple and effective for terrain)

### Texture Quality
**Resolution Guidelines:**
- 1K (1024px): Low detail, small file size (~200KB)
- 2K (2048px): Good balance, recommended default (~800KB)
- 4K (4096px): High detail for closeups (~3MB)
- 8K (8192px): Maximum quality, large files (~12MB)

### Performance
**Target Times:**
- OBJ generation (10k vertices): < 1 second
- Texture rendering (2K): < 3 seconds
- Texture rendering (4K): < 8 seconds
- Total export time (2K): < 5 seconds

### File Format Compatibility

**Tested Software:**
- ✅ Blender 3.0+ (industry standard)
- ✅ MeshLab (mesh analysis)
- ✅ CloudCompare (point cloud software)
- ✅ QGIS (with plugin for 3D)
- ✅ Three.js OBJLoader (web)

### Memory Management
- Generate texture on-demand (not cached)
- Clean up temporary canvases after export
- Use offscreen canvas for large textures (if available)

## Testing Plan

### Test Case 1: Gradient Surface Export
1. Load DTM surface
2. Apply "viridis" gradient
3. Export as OBJ with 2K texture
4. Import into Blender
5. Verify: Geometry correct, texture displays, colors match Kirra

### Test Case 2: Imported Textured Mesh Export
1. Import OBJ with texture
2. View in Kirra 3D mode
3. Export as OBJ with texture
4. Import into Blender
5. Verify: Original texture preserved, geometry intact

### Test Case 3: World Coordinates Verification
1. Load surface with known UTM coordinates
2. Export as OBJ
3. Import into QGIS (with 3D plugin)
4. Verify: Coordinates match original data (within 1 meter)

### Test Case 4: Large Surface (Stress Test)
1. Load large DTM (50k+ triangles)
2. Export with 4K texture
3. Monitor: Memory usage, export time
4. Verify: No crashes, reasonable performance

## Success Criteria

1. ✅ OBJ files include UV coordinates
2. ✅ MTL files correctly reference texture images
3. ✅ Gradient textures accurately represent surface visualization
4. ✅ Imported textures preserved on re-export
5. ✅ Exported files open correctly in Blender/MeshLab
6. ✅ Coordinates in world space (UTM) for GIS compatibility
7. ✅ Export completes in < 10 seconds for typical surfaces

## Timeline Estimate

- **Phase 1 (OBJ Enhancement):** 4-6 hours
- **Phase 2 (MTL Generation):** 2-3 hours
- **Phase 3 (Texture Export):** 4-6 hours
- **Phase 4 (Export Dialog):** 2-3 hours
- **Phase 5 (See separate plan):** 4-6 hours
- **Testing:** 2-3 hours

**Total:** 18-27 hours (2.5-3.5 days)

## Dependencies

### Existing Code
- `src/io/writers/OBJWriter.js` - Current OBJ exporter (needs enhancement)
- `src/helpers/SurfaceRasterizer.js` - Surface-to-canvas rendering
- `window.elevationToColor()` - Gradient color calculation

### New Files
- `src/io/writers/MTLWriter.js` - MTL file generation
- `src/dialog/popups/export/OBJExportDialog.js` - Enhanced export dialog

### No New Libraries
- All functionality using native Canvas 2D API
- No external texture generation libraries needed

## Future Enhancements

- **Normal maps** - Export bump/normal maps for realistic lighting
- **Multiple textures** - Support for multiple material regions
- **Per-vertex colors** - Alternative to textures for smaller files
- **LOD export** - Generate multiple resolution versions
- **Batch export** - Export all surfaces at once
- **FBX format** - Alternative to OBJ with better features
