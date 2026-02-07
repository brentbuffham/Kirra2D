# LAS Point Cloud Import Fixes Plan

## Date: 2026-02-07

## Issues

1. **Point Cloud Import Freezes App** - Decimation/deduplication only applied when meshing, not when importing as point cloud
2. **LAS Colors Lost for Surfaces** - No option to preserve LAS RGB colors when creating surface mesh
3. **Max Points Not Applied** - Dialog has "Max Points" field but value is not used for point cloud imports

## Solution Overview

### Fix 1: Apply Decimation to Point Cloud Imports

**File:** `src/fileIO/LasFileIO/LASParser.js`

**Location:** Lines 101-108 (the else branch for point cloud)

**Current Code:**
```javascript
} else {
    // Original point cloud behavior
    rawData.kadDrawingsMap = this.convertToKadFormat(rawData.points, rawData.header);
    return {
        ...rawData,
        config: config,
        dataType: "pointcloud",
        success: true
    };
}
```

**New Code:**
```javascript
} else {
    // Point cloud behavior with decimation/deduplication
    var points = rawData.points;

    // Apply decimation if maxPoints specified
    if (config.maxPoints > 0 && points.length > config.maxPoints) {
        points = decimatePoints(points, config.maxPoints);
        console.log("Point cloud decimated: " + rawData.points.length + " -> " + points.length);
    }

    // Apply deduplication (use small tolerance for point clouds)
    var dedupResult = deduplicatePoints(points, 0.01);
    points = dedupResult.uniquePoints;
    console.log("Point cloud deduplicated: " + dedupResult.originalCount + " -> " + dedupResult.uniqueCount);

    rawData.kadDrawingsMap = this.convertToKadFormat(points, rawData.header);
    return {
        ...rawData,
        config: config,
        dataType: "pointcloud",
        success: true,
        originalPointCount: rawData.points.length,
        decimatedPointCount: points.length
    };
}
```

### Fix 2: Add "Use LAS Colors" Option for Surfaces

**File:** `src/fileIO/LasFileIO/LASParser.js`

**Step 2a:** Add checkbox to surface options in `promptForImportConfiguration()` (around line 1100):
```javascript
// Use LAS Colors option
contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; margin-left: 140px;">';
contentHTML += '<input type="checkbox" id="las-use-point-colors" style="margin: 0;">';
contentHTML += '<label for="las-use-point-colors" class="labelWhite15" style="margin: 0; cursor: pointer; font-size: 11px;">Use LAS point colors (if available)</label>';
contentHTML += "</div>";
```

**Step 2b:** Capture the value in the config (around line 1152):
```javascript
config.usePointColors = document.getElementById("las-use-point-colors").checked;
```

**Step 2c:** Modify `createTriangulatedSurface()` to preserve colors (around line 746):
```javascript
var vertices = points.map(function(pt) {
    var vertex = {
        x: parseFloat(pt.x),
        y: parseFloat(pt.y),
        z: parseFloat(pt.z)
    };
    // Preserve color if available and option enabled
    if (config.usePointColors && pt.color) {
        vertex.color = pt.color;
    }
    return vertex;
});
```

**Step 2d:** Add "lasColors" gradient option and store colors in surface:
```javascript
// If using LAS colors, set gradient to "lasColors"
var surfaceGradient = config.usePointColors ? "lasColors" : surfaceStyle;

var surface = {
    // ... existing properties
    gradient: surfaceGradient,
    hasVertexColors: config.usePointColors && vertices.some(v => v.color),
    // ...
};
```

### Fix 3: Update Surface Renderer for Vertex Colors

**File:** `src/draw/canvas3DDrawing.js` or `src/three/renderers/SurfaceRenderer.js`

Add handling for `gradient === "lasColors"` to use per-vertex colors instead of elevation-based gradient.

## Files to Modify

| File | Changes |
|------|---------|
| `src/fileIO/LasFileIO/LASParser.js` | Apply decimation/dedup to point clouds, add "Use LAS Colors" option |
| `src/draw/canvas3DDrawing.js` | Handle "lasColors" gradient for vertex-colored surfaces |

## Testing Checklist

1. Import LAS as Point Cloud with 100k points - should not freeze
2. Import LAS as Surface with "Use LAS Colors" checked - should show original colors
3. Verify decimation reduces point count as expected
4. Verify deduplication removes duplicate XY points

## Priority Order

1. **Critical:** Fix point cloud decimation (prevents freezing)
2. **Important:** Add LAS colors option for surfaces
3. **Optional:** Improve surface renderer for vertex colors
