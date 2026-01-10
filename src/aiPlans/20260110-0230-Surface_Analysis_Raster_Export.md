# Surface Analysis Raster Export Tool

**Date:** 2026-01-10 02:30
**Status:** PLANNED
**Priority:** Medium
**Scope:** Specialized export tool for relief maps, slope maps, aspect maps, and hillshade visualizations

## Overview

Create a dedicated "Surface Analysis Export" tool that exports surface visualizations (relief maps, slope maps, aspect maps, hillshade) as georeferenced raster images. This is separate from regular OBJ export because these are **2D raster products**, not 3D geometry.

## Use Cases

### Relief Map Export
**What:** Surface colored by elevation gradient
**Output:** GeoTIFF with gradient colors
**Use:** Elevation visualization, topographic maps, presentations

### Slope Map Export
**What:** Surface colored by slope angle/percentage
**Output:** GeoTIFF with slope classification colors
**Use:** Geotechnical analysis, slope stability assessment, excavation planning

### Aspect Map Export
**What:** Surface colored by slope direction (compass bearing)
**Output:** GeoTIFF with directional colors
**Use:** Drainage analysis, solar exposure studies, wind analysis

### Hillshade Export
**What:** Surface with lighting-based shading
**Output:** GeoTIFF with shaded relief
**Use:** Terrain visualization, cartographic base layers

## Architecture

### Tool Location
**New Dialog:** `src/dialog/popups/export/SurfaceAnalysisExportDialog.js`

**Access Points:**
1. File → Export → Surface Analysis...
2. Surface context menu → Export Analysis...
3. Surface Properties dialog → Export button

### Export Workflow

```
User selects surface
    ↓
Opens Surface Analysis Export dialog
    ↓
User selects analysis type (Relief/Slope/Aspect/Hillshade)
    ↓
User configures settings (resolution, gradient, range)
    ↓
Preview thumbnail generated
    ↓
User confirms export
    ↓
Render to high-resolution canvas
    ↓
Convert to GeoTIFF with CRS metadata
    ↓
Download file
```

## Implementation Plan

### Phase 1: Analysis Rendering Engine (4-5 hours)

#### 1.1 Surface Analysis Renderer
**File:** `src/helpers/SurfaceAnalysisRenderer.js` (new file)

```javascript
export class SurfaceAnalysisRenderer {
    // Render relief map (elevation gradient)
    static renderReliefMap(canvas, surface, options = {}) {
        const { gradient = 'default', minLimit = null, maxLimit = null } = options;

        const ctx = canvas.getContext('2d');
        const { triangles, points, meshBounds } = surface;

        const minZ = minLimit !== null ? minLimit : meshBounds.minZ;
        const maxZ = maxLimit !== null ? maxLimit : meshBounds.maxZ;

        // Render each triangle with gradient color
        triangles.forEach(tri => {
            const p1 = points[tri.a];
            const p2 = points[tri.b];
            const p3 = points[tri.c];

            // Get colors for each vertex
            const color1 = window.elevationToColor(p1.z, minZ, maxZ, gradient);
            const color2 = window.elevationToColor(p2.z, minZ, maxZ, gradient);
            const color3 = window.elevationToColor(p3.z, minZ, maxZ, gradient);

            // Average color (or use gradient fill)
            const avgColor = this.averageColors([color1, color2, color3]);

            // Map to canvas coordinates
            const canvasCoords = this.worldToCanvas(
                [p1, p2, p3],
                meshBounds,
                canvas.width,
                canvas.height
            );

            // Draw triangle
            ctx.fillStyle = avgColor;
            ctx.beginPath();
            ctx.moveTo(canvasCoords[0].x, canvasCoords[0].y);
            ctx.lineTo(canvasCoords[1].x, canvasCoords[1].y);
            ctx.lineTo(canvasCoords[2].x, canvasCoords[2].y);
            ctx.closePath();
            ctx.fill();
        });
    }

    // Render slope map (angle-based coloring)
    static renderSlopeMap(canvas, surface, options = {}) {
        const { colorScheme = 'redgreen', angleType = 'degrees', ranges = null } = options;

        const ctx = canvas.getContext('2d');
        const { triangles, points, meshBounds } = surface;

        triangles.forEach(tri => {
            const p1 = points[tri.a];
            const p2 = points[tri.b];
            const p3 = points[tri.c];

            // Calculate slope angle for triangle
            const slopeAngle = this.calculateSlopeAngle(p1, p2, p3, angleType);

            // Get color for slope value
            const color = this.slopeToColor(slopeAngle, colorScheme, ranges);

            // Map to canvas coordinates
            const canvasCoords = this.worldToCanvas(
                [p1, p2, p3],
                meshBounds,
                canvas.width,
                canvas.height
            );

            // Draw triangle
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(canvasCoords[0].x, canvasCoords[0].y);
            ctx.lineTo(canvasCoords[1].x, canvasCoords[1].y);
            ctx.lineTo(canvasCoords[2].x, canvasCoords[2].y);
            ctx.closePath();
            ctx.fill();
        });
    }

    // Render aspect map (direction-based coloring)
    static renderAspectMap(canvas, surface, options = {}) {
        const { colorScheme = 'compass' } = options;

        const ctx = canvas.getContext('2d');
        const { triangles, points, meshBounds } = surface;

        triangles.forEach(tri => {
            const p1 = points[tri.a];
            const p2 = points[tri.b];
            const p3 = points[tri.c];

            // Calculate aspect (bearing) for triangle
            const aspect = this.calculateAspect(p1, p2, p3);

            // Get color for aspect direction
            const color = this.aspectToColor(aspect, colorScheme);

            // Map to canvas coordinates
            const canvasCoords = this.worldToCanvas(
                [p1, p2, p3],
                meshBounds,
                canvas.width,
                canvas.height
            );

            // Draw triangle
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(canvasCoords[0].x, canvasCoords[0].y);
            ctx.lineTo(canvasCoords[1].x, canvasCoords[1].y);
            ctx.lineTo(canvasCoords[2].x, canvasCoords[2].y);
            ctx.closePath();
            ctx.fill();
        });
    }

    // Render hillshade (lighting-based shading)
    static renderHillshade(canvas, surface, options = {}) {
        const {
            azimuth = 315,  // Light direction (degrees from north)
            altitude = 45,  // Light elevation angle
            zFactor = 1.0,  // Vertical exaggeration
            baseColor = '#808080'  // Base terrain color
        } = options;

        const ctx = canvas.getContext('2d');
        const { triangles, points, meshBounds } = surface;

        // Convert light direction to vector
        const lightVector = this.azimuthAltitudeToVector(azimuth, altitude);

        triangles.forEach(tri => {
            const p1 = points[tri.a];
            const p2 = points[tri.b];
            const p3 = points[tri.c];

            // Calculate triangle normal
            const normal = this.calculateNormal(p1, p2, p3);

            // Calculate illumination (dot product with light vector)
            const illumination = this.dotProduct(normal, lightVector);

            // Convert to brightness (0-255)
            const brightness = Math.max(0, Math.min(255, Math.round((illumination + 1) * 127.5)));

            // Apply to base color
            const color = this.applyBrightness(baseColor, brightness);

            // Map to canvas coordinates
            const canvasCoords = this.worldToCanvas(
                [p1, p2, p3],
                meshBounds,
                canvas.width,
                canvas.height
            );

            // Draw triangle
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(canvasCoords[0].x, canvasCoords[0].y);
            ctx.lineTo(canvasCoords[1].x, canvasCoords[1].y);
            ctx.lineTo(canvasCoords[2].x, canvasCoords[2].y);
            ctx.closePath();
            ctx.fill();
        });
    }

    // Helper: Calculate slope angle from triangle vertices
    static calculateSlopeAngle(p1, p2, p3, angleType) {
        // Calculate triangle normal
        const normal = this.calculateNormal(p1, p2, p3);

        // Angle from vertical (Z-axis)
        const verticalDot = Math.abs(normal.z);
        const angleRadians = Math.acos(verticalDot);

        if (angleType === 'degrees') {
            return angleRadians * (180 / Math.PI);
        } else if (angleType === 'percent') {
            return Math.tan(angleRadians) * 100;
        } else {
            return angleRadians;
        }
    }

    // Helper: Calculate aspect (bearing) from triangle normal
    static calculateAspect(p1, p2, p3) {
        const normal = this.calculateNormal(p1, p2, p3);

        // Project onto XY plane
        const bearing = Math.atan2(normal.x, normal.y) * (180 / Math.PI);

        // Normalize to 0-360
        return (bearing + 360) % 360;
    }

    // Helper: Calculate triangle normal vector
    static calculateNormal(p1, p2, p3) {
        // Two edge vectors
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
        const v2 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };

        // Cross product
        const normal = {
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x
        };

        // Normalize
        const length = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
        return {
            x: normal.x / length,
            y: normal.y / length,
            z: normal.z / length
        };
    }

    // Helper: Slope to color mapping
    static slopeToColor(slope, colorScheme, ranges) {
        if (colorScheme === 'redgreen') {
            // Green (flat) to Red (steep)
            const normalized = Math.min(slope / 90, 1); // 0-90 degrees → 0-1
            const r = Math.round(normalized * 255);
            const g = Math.round((1 - normalized) * 255);
            return `rgb(${r},${g},0)`;
        } else if (colorScheme === 'categorical') {
            // 5-class slope categories
            if (slope < 5) return '#00ff00';       // Flat (green)
            if (slope < 15) return '#ffff00';      // Gentle (yellow)
            if (slope < 30) return '#ff8800';      // Moderate (orange)
            if (slope < 45) return '#ff0000';      // Steep (red)
            return '#8800ff';                       // Very steep (purple)
        }
        return '#808080';
    }

    // Helper: Aspect to color mapping (compass rose)
    static aspectToColor(aspect, colorScheme) {
        if (colorScheme === 'compass') {
            // Hue based on bearing (0-360 → 0-360 hue)
            return `hsl(${aspect}, 100%, 50%)`;
        }
        return '#808080';
    }

    // Helper: World to canvas coordinate transform
    static worldToCanvas(points, meshBounds, canvasWidth, canvasHeight) {
        const rangeX = meshBounds.maxX - meshBounds.minX;
        const rangeY = meshBounds.maxY - meshBounds.minY;

        return points.map(p => ({
            x: ((p.x - meshBounds.minX) / rangeX) * canvasWidth,
            y: (1 - (p.y - meshBounds.minY) / rangeY) * canvasHeight  // Flip Y
        }));
    }

    // Helper: Average RGB colors
    static averageColors(colors) {
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

    static parseRGB(rgbString) {
        const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        return {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3])
        };
    }
}
```

### Phase 2: Export Dialog (3-4 hours)

#### 2.1 Surface Analysis Export Dialog
**File:** `src/dialog/popups/export/SurfaceAnalysisExportDialog.js` (new file)

```javascript
import { FloatingDialog } from '../../FloatingDialog.js';
import { SurfaceAnalysisRenderer } from '../../../helpers/SurfaceAnalysisRenderer.js';
import { GeoTIFFImageryWriter } from '../../../io/writers/GeoTIFFImageryWriter.js';

export function showSurfaceAnalysisExportDialog(surface) {
    // Dynamic form based on selected analysis type
    const fields = [
        {
            type: 'select',
            id: 'analysisType',
            label: 'Analysis Type',
            value: 'relief',
            options: [
                { value: 'relief', label: 'Relief Map (Elevation)' },
                { value: 'slope', label: 'Slope Map (Angle/Percent)' },
                { value: 'aspect', label: 'Aspect Map (Direction)' },
                { value: 'hillshade', label: 'Hillshade (Shaded Relief)' }
            ],
            onChange: function() {
                updateFormFields();
            }
        },
        // Relief-specific options
        {
            type: 'select',
            id: 'gradient',
            label: 'Color Gradient',
            value: surface.gradient || 'default',
            options: [
                { value: 'default', label: 'Default (Blue-Red)' },
                { value: 'viridis', label: 'Viridis (Scientific)' },
                { value: 'turbo', label: 'Turbo (Rainbow)' },
                { value: 'terrain', label: 'Terrain (Green-Brown)' },
                { value: 'parula', label: 'Parula (Matlab)' }
            ],
            visible: function() {
                return getFieldValue('analysisType') === 'relief';
            }
        },
        // Slope-specific options
        {
            type: 'select',
            id: 'slopeType',
            label: 'Slope Type',
            value: 'degrees',
            options: [
                { value: 'degrees', label: 'Degrees (0-90°)' },
                { value: 'percent', label: 'Percent (0-∞%)' }
            ],
            visible: function() {
                return getFieldValue('analysisType') === 'slope';
            }
        },
        {
            type: 'select',
            id: 'slopeColorScheme',
            label: 'Color Scheme',
            value: 'redgreen',
            options: [
                { value: 'redgreen', label: 'Green-Red Gradient' },
                { value: 'categorical', label: '5-Class Categories' }
            ],
            visible: function() {
                return getFieldValue('analysisType') === 'slope';
            }
        },
        // Hillshade-specific options
        {
            type: 'number',
            id: 'azimuth',
            label: 'Sun Azimuth (degrees)',
            value: 315,
            min: 0,
            max: 360,
            description: '0=North, 90=East, 180=South, 270=West',
            visible: function() {
                return getFieldValue('analysisType') === 'hillshade';
            }
        },
        {
            type: 'number',
            id: 'altitude',
            label: 'Sun Altitude (degrees)',
            value: 45,
            min: 0,
            max: 90,
            description: '0=horizon, 90=overhead',
            visible: function() {
                return getFieldValue('analysisType') === 'hillshade';
            }
        },
        // Common options
        {
            type: 'select',
            id: 'resolution',
            label: 'Output Resolution',
            value: '2048',
            options: [
                { value: '1024', label: '1K (1024px)' },
                { value: '2048', label: '2K (2048px) - Recommended' },
                { value: '4096', label: '4K (4096px)' },
                { value: '8192', label: '8K (8192px)' }
            ]
        },
        {
            type: 'number',
            id: 'epsg',
            label: 'EPSG Code',
            value: 32756,
            description: 'Coordinate system (e.g., 32756 = UTM 56S)'
        }
    ];

    const content = createEnhancedFormContent(fields);

    // Add preview canvas
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 256;
    previewCanvas.height = 256;
    previewCanvas.style.border = '1px solid #666';
    previewCanvas.style.marginTop = '10px';
    content.appendChild(previewCanvas);

    // Generate preview
    updatePreview();

    const dialog = new FloatingDialog({
        title: 'Export Surface Analysis',
        content: content,
        width: 500,
        showConfirm: true,
        confirmText: 'Export',
        onConfirm: async function() {
            const formData = getFormData(content);

            try {
                await exportSurfaceAnalysis(surface, formData);
                showSuccessMessage("Surface analysis exported successfully!");
            } catch (error) {
                showErrorDialog("Export Failed", error.message);
            }
        }
    });

    function updatePreview() {
        const formData = getFormData(content);
        const analysisType = formData.analysisType;

        const options = {
            gradient: formData.gradient,
            angleType: formData.slopeType,
            colorScheme: formData.slopeColorScheme || 'compass',
            azimuth: parseFloat(formData.azimuth) || 315,
            altitude: parseFloat(formData.altitude) || 45
        };

        if (analysisType === 'relief') {
            SurfaceAnalysisRenderer.renderReliefMap(previewCanvas, surface, options);
        } else if (analysisType === 'slope') {
            SurfaceAnalysisRenderer.renderSlopeMap(previewCanvas, surface, options);
        } else if (analysisType === 'aspect') {
            SurfaceAnalysisRenderer.renderAspectMap(previewCanvas, surface, options);
        } else if (analysisType === 'hillshade') {
            SurfaceAnalysisRenderer.renderHillshade(previewCanvas, surface, options);
        }
    }

    dialog.show();
}

async function exportSurfaceAnalysis(surface, options) {
    const resolution = parseInt(options.resolution);
    const analysisType = options.analysisType;

    // Create high-resolution canvas
    const canvas = document.createElement('canvas');

    // Calculate dimensions maintaining aspect ratio
    const { meshBounds } = surface;
    const width = meshBounds.maxX - meshBounds.minX;
    const height = meshBounds.maxY - meshBounds.minY;
    const aspectRatio = width / height;

    if (aspectRatio > 1) {
        canvas.width = resolution;
        canvas.height = Math.round(resolution / aspectRatio);
    } else {
        canvas.height = resolution;
        canvas.width = Math.round(resolution * aspectRatio);
    }

    // Render analysis
    const renderOptions = {
        gradient: options.gradient,
        angleType: options.slopeType,
        colorScheme: options.slopeColorScheme || 'compass',
        azimuth: parseFloat(options.azimuth) || 315,
        altitude: parseFloat(options.altitude) || 45
    };

    if (analysisType === 'relief') {
        SurfaceAnalysisRenderer.renderReliefMap(canvas, surface, renderOptions);
    } else if (analysisType === 'slope') {
        SurfaceAnalysisRenderer.renderSlopeMap(canvas, surface, renderOptions);
    } else if (analysisType === 'aspect') {
        SurfaceAnalysisRenderer.renderAspectMap(canvas, surface, renderOptions);
    } else if (analysisType === 'hillshade') {
        SurfaceAnalysisRenderer.renderHillshade(canvas, surface, renderOptions);
    }

    // Convert to GeoTIFF
    const filename = `${surface.name}_${analysisType}_${resolution}.tif`;
    const writer = new GeoTIFFImageryWriter();

    await writer.write({
        canvas: canvas,
        bounds: meshBounds,
        epsg: parseInt(options.epsg),
        filename: filename
    });

    console.log(`✅ Exported ${analysisType} map: ${filename}`);
}
```

### Phase 3: Menu Integration (1 hour)

**File:** `src/dialog/menuBar/fileMenu.js`

Add to Export submenu:
```javascript
{
    label: 'Surface Analysis Maps...',
    action: () => {
        // Get selected surface or prompt user to select
        const surface = getSelectedSurface();
        if (surface) {
            showSurfaceAnalysisExportDialog(surface);
        } else {
            showSelectSurfaceDialog((selectedSurface) => {
                showSurfaceAnalysisExportDialog(selectedSurface);
            });
        }
    },
    enabled: () => window.loadedSurfaces && window.loadedSurfaces.size > 0
}
```

**File:** `src/dialog/contextMenus/surfaceContextMenu.js`

Add to context menu:
```javascript
{
    label: 'Export Analysis Map...',
    action: () => showSurfaceAnalysisExportDialog(surface),
    icon: '📊'
}
```

## Success Criteria

1. ✅ Relief maps export with accurate gradient colors
2. ✅ Slope maps classify terrain by steepness correctly
3. ✅ Aspect maps show directional colors accurately
4. ✅ Hillshade rendering matches cartographic standards
5. ✅ All exports georeferenced correctly (CRS + geotransform)
6. ✅ Preview updates in real-time
7. ✅ Export completes in < 10 seconds for 4K resolution

## Timeline Estimate

- **Phase 1 (Rendering Engine):** 4-5 hours
- **Phase 2 (Export Dialog):** 3-4 hours
- **Phase 3 (Menu Integration):** 1 hour
- **Testing:** 2 hours

**Total:** 10-12 hours (1.5 days)

## Future Enhancements

- **Curvature maps** - Convex/concave terrain analysis
- **Roughness maps** - Surface texture variation
- **TPI/TRI** - Topographic position/ruggedness indices
- **Drainage maps** - Flow direction and accumulation
- **Solar radiation maps** - Sun exposure analysis
- **Viewshed analysis** - Visibility from points
