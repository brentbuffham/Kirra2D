# Text Rendering and Orbit Control Fixes

## Overview

Fixed critical issues with Three.js 3D mode: text rendering, orbit controls, Z centroid positioning, and polygon hole coordinate offsets.

## Problems Fixed

### 1. Text Not Rendering in 3D Mode

**Issue**: Hole labels (ID, length, diameter, etc.) and KAD text didn't appear in Three.js-only mode.

**Root Cause**: The `drawHoleTextsAndConnectors` function used 2D canvas `drawText`, which was hidden when `onlyShowThreeJS = true` (canvas opacity: 0).

**Solution**: Created parallel Three.js text rendering functions.

### 2. Orbit Modifier Keys

**Issue**: Orbit mode required Shift+Command/Ctrl, which was awkward and conflicted with 2D rotation.

**User Request**: Change to Alt+drag for orbit, keep Command/Ctrl for 2D rotation.

**Solution**: Updated CameraControls to use Alt key exclusively for orbit.

### 3. Orbit Z Center

**Issue**: Camera orbited around Z=0 instead of the actual data centroid, making orbiting feel disconnected from the data.

**Solution**: Calculate Z centroid from all holes and surfaces, use it as orbit center.

### 4. Polygon Hole Offset

**Issue**: Holes generated inside polygons appeared at correct positions in 2D but offset in 3D mode.

**Root Cause**: Polygons used world coordinates directly while holes were converted to local coordinates, causing inconsistent coordinate systems.

**Solution**: Convert all KAD geometry to local coordinates using `worldToThreeLocal`.

## Implementation Details

### Text Rendering Functions

**File**: `Kirra2D/src/kirra.js`

#### 1. drawHoleTextThreeJS (Line 12238)

Helper function to draw individual text labels in 3D:

```javascript
function drawHoleTextThreeJS(worldX, worldY, worldZ, text, fontSize, color) {
    if (!threeInitialized || !threeRenderer) return;
    if (!text || text === "" || text === "null" || text === "undefined") return;

    const local = worldToThreeLocal(worldX, worldY);
    const textSprite = GeometryFactory.createKADText(local.x, local.y, worldZ, String(text), fontSize, color, null);
    threeRenderer.kadGroup.add(textSprite);
}
```

**Features**:
- Converts world to local coordinates
- Validates text content
- Uses existing KAD text infrastructure
- Transparent background for clean appearance

#### 2. drawHoleTextsAndConnectorsThreeJS (Line 19607)

Comprehensive function matching 2D canvas hole label layout:

```javascript
function drawHoleTextsAndConnectorsThreeJS(hole, displayOptions) {
    const fontSize = parseInt(currentFontSize) || 12;
    const textOffset = (hole.holeDiameter / 1000) * holeScale;
    
    // Collar labels (right side)
    if (displayOptions.holeID) {
        drawHoleTextThreeJS(collarX + textOffset, collarY + textOffset, collarZ, 
            hole.holeID, fontSize, textFillColor);
    }
    // ... more labels
}
```

**Label Positioning**:
- **Right of collar**: Hole ID, diameter, length, type, measured comment
- **Left of collar**: Angle, initiation time, X/Y/Z coords, row/pos ID, measured length/mass
- **Near toe**: Dip, bearing, subdrill

**Integration**: Called after `drawHoleThreeJS` in main hole loop (Line 19137)

### Orbit Control Changes

**File**: `Kirra2D/src/three/CameraControls.js`

**Before** (Line 157):
```javascript
if (event.shiftKey && isCommandOrCtrl) {
    this.isOrbiting = true;
    console.log("🌐 3D Orbit mode activated (Shift+⌘/Ctrl held)");
}
```

**After** (Line 154):
```javascript
if (event.altKey) {
    this.isOrbiting = true;
    console.log("🌐 3D Orbit mode activated (Alt held)");
}
```

**Control Summary**:
- **Mouse drag**: Pan
- **Alt + drag**: 3D orbit (NEW)
- **Ctrl/Cmd + drag**: 2D rotation
- **Right-click + drag**: 2D rotation
- **Mouse wheel**: Zoom

### Z Centroid Calculation

**File**: `Kirra2D/src/kirra.js`

#### Global Variable (Line 349)

```javascript
let dataCentroidZ = 0; // Z centroid of all data for orbit center
```

#### Calculation Function (Line 390)

```javascript
function calculateDataZCentroid() {
    let sumZ = 0;
    let count = 0;

    // Step 1) Add hole Z values (collar, grade, toe)
    if (allBlastHoles && allBlastHoles.length > 0) {
        for (const hole of allBlastHoles) {
            sumZ += hole.startZLocation || 0;
            sumZ += hole.gradeZLocation || 0;
            sumZ += hole.endZLocation || 0;
            count += 3;
        }
    }

    // Step 2) Add surface Z values if available
    if (loadedSurfaces && loadedSurfaces.size > 0) {
        for (const [surfaceId, surface] of loadedSurfaces.entries()) {
            if (surface.triangles && surface.triangles.length > 0) {
                for (const tri of surface.triangles) {
                    sumZ += tri.minZ || 0;
                    sumZ += tri.maxZ || 0;
                    count += 2;
                }
            }
        }
    }

    return count > 0 ? sumZ / count : 0;
}
```

**Called**: In `drawData` before rendering (Line 18584)

#### ThreeRenderer Integration

**File**: `Kirra2D/src/three/ThreeRenderer.js`

**Property** (Line 15):
```javascript
this.orbitCenterZ = 0; // Z coordinate for orbit center
```

**Setter** (Line 241):
```javascript
setOrbitCenterZ(z) {
    this.orbitCenterZ = z || 0;
}
```

**Usage** (Line 209):
```javascript
// OLD: this.camera.lookAt(centroidX, centroidY, 0);
// NEW:
this.camera.lookAt(centroidX, centroidY, this.orbitCenterZ);
```

**Update**: Called in `renderThreeJS` (Line 12311)

### Polygon Coordinate Fix

**File**: `Kirra2D/src/kirra.js` (Lines 19162-19211)

**Before** (using world coordinates directly):
```javascript
const points = visiblePoints.map((p) => ({
    x: p.pointXLocation,
    y: p.pointYLocation,
    z: p.pointZLocation || 0
}));
```

**After** (converting to local coordinates):
```javascript
const points = visiblePoints.map((p) => {
    const local = worldToThreeLocal(p.pointXLocation, p.pointYLocation);
    return {
        x: local.x,
        y: local.y,
        z: p.pointZLocation || 0
    };
});
```

**Applied to**:
- KAD Points (Line 19162)
- KAD Lines (Line 19170)
- KAD Polygons (Line 19186)
- KAD Circles (Line 19204)
- KAD Text (Line 19210)

**Result**: All KAD geometry now uses consistent local coordinate system, matching holes.

## Benefits

### Text Rendering
- Hole labels now visible in 3D-only mode
- Billboard text always faces camera
- Proper positioning relative to holes
- Matches 2D canvas layout

### Orbit Controls
- Simpler, single-key modifier (Alt)
- No conflicts with system shortcuts
- Consistent with standard 3D software
- Clear console feedback

### Z Centroid
- Orbit feels natural, centered on data
- Works with holes-only, surfaces-only, or mixed data
- Dynamically updates when data changes
- Smoother navigation in 3D view

### Coordinate Consistency
- Polygons and holes align perfectly in 3D
- Generated patterns inside polygons work correctly
- Eliminates visual offset issues
- Maintains precision with large UTM coordinates

## Testing

### Text Rendering Tests

1. **Load holes in 3D-only mode**
   - Enable "Only Show Three.js" checkbox
   - Verify hole labels appear (ID, length, diameter)
   - Test different display options (angle, bearing, coordinates)
   - Check text is readable and positioned correctly

2. **KAD Text**
   - Create KAD text objects
   - Switch to 3D-only mode
   - Verify text appears at correct positions

### Orbit Control Tests

1. **Alt+drag orbit**
   - Hold Alt, drag mouse
   - Verify 3D orbit activates
   - Check smooth camera movement
   - Test pitch clamping (prevents upside-down)

2. **Old modifiers no longer work**
   - Try Shift+Command/Ctrl+drag
   - Verify it does NOT trigger orbit
   - Should trigger 2D rotation instead

### Z Centroid Tests

1. **Holes-only data**
   - Load holes at various elevations
   - Enter orbit mode
   - Verify camera orbits around mid-elevation
   - Check smooth orbiting motion

2. **Surface-only data**
   - Load surface without holes
   - Test orbit centers on surface Z

3. **Mixed data**
   - Load both holes and surfaces
   - Verify orbit uses combined centroid

### Polygon Coordinate Tests

1. **Generate holes in polygon**
   - Draw polygon in 2D mode
   - Use pattern generation tool
   - Generate holes inside polygon
   - Switch to 3D mode
   - Verify holes remain inside polygon outline
   - Check alignment in plan view

2. **Imported polygons**
   - Import KAD polygons with holes nearby
   - Switch between 2D and 3D modes
   - Verify consistent positioning

## Files Modified

1. **Kirra2D/src/three/CameraControls.js**
   - Line 154-159: Orbit modifier changed to Alt key
   - Line 163-168: Removed Alt from 2D rotation triggers

2. **Kirra2D/src/three/ThreeRenderer.js**
   - Line 15: Added `orbitCenterZ` property
   - Line 209: Updated `camera.lookAt` to use `orbitCenterZ`
   - Line 241-243: Added `setOrbitCenterZ` setter method

3. **Kirra2D/src/kirra.js**
   - Line 349: Added `dataCentroidZ` global variable
   - Line 390-418: Added `calculateDataZCentroid` function
   - Line 18584: Calculate Z centroid in `drawData`
   - Line 12238-12246: Added `drawHoleTextThreeJS` function
   - Line 12311: Update orbit center Z in `renderThreeJS`
   - Line 19162-19211: Fixed KAD coordinate transformations
   - Line 19607-19674: Added `drawHoleTextsAndConnectorsThreeJS` function
   - Line 19137-19139: Integrated text rendering in hole loop

4. **Kirra2D/src/aiCommentry/TEXT_AND_ORBIT_FIXES.md**
   - This documentation file (NEW)

## Known Limitations

1. **Text Scaling**: Text sprites maintain fixed screen size regardless of zoom
2. **Text Occlusion**: Text always renders on top (depthTest: false), may overlap with far geometry
3. **Performance**: One texture per text label (minimal impact for typical hole counts)
4. **Connectors**: Timing connectors not yet implemented in 3D mode

## Future Enhancements

### Text Rendering
- Distance-based text scaling
- Text culling for performance
- Texture atlas for multiple labels
- 3D extruded text option

### Orbit Controls
- Damping/smoothing for camera movement
- Preset camera angles (Top, Front, Side, Isometric)
- Keyboard shortcuts for view reset
- Animation transitions between views

### Z Centroid
- User-adjustable orbit center
- Focus on selected holes
- Automatic framing of visible data

## Status

✅ **COMPLETE** - All fixes implemented and integrated:
- Text rendering fully functional in 3D mode
- Orbit controls simplified to Alt+drag
- Z centroid calculated and used for orbit center
- Polygon coordinates fixed for consistent 2D/3D positioning














