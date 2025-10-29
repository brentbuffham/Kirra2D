# View Buttons and Hole Sizing Fix

## Problems Fixed

1. **View buttons at bottom not responding** - Toggle buttons were covered by Three.js canvas
2. **Test square still visible** - Blocking view after verification
3. **Hole sizing not matching 2D canvas** - Incorrect scale factor applied

## Solutions

### 1. Fixed Toggle Buttons Z-Index (kirra.js Line 382-387)

**Problem**: The `.toggle-buttons-container` at the bottom had no z-index, defaulting to 0. The Three.js canvas (z-index: 1) and 2D canvas (z-index: 2) were covering the buttons.

**Solution**: Set toggle buttons container to z-index: 10

```javascript
// Step 5b) Ensure toggle buttons are above both canvases
const toggleButtonsContainer = document.querySelector(".toggle-buttons-container");
if (toggleButtonsContainer) {
    toggleButtonsContainer.style.zIndex = "10"; // Above both canvases
    console.log("📍 Set toggle buttons z-index to 10");
}
```

### 2. Removed Test Square (kirra.js Line 405)

**Problem**: Red test square was still in the scene after verification.

**Solution**: Removed test square creation code

```javascript
// Before - Lines 405-416
const testGeometry = new THREE.PlaneGeometry(20, 20);
const testMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide,
    transparent: false
});
const testMesh = new THREE.Mesh(testGeometry, testMaterial);
testMesh.position.set(0, 0, 10);
threeRenderer.scene.add(testMesh);
console.log("🔴 Added small red test square at center (0,0,10) - 20x20 units");

// After - Line 405
// Step 8) Test square removed - Three.js is working!
```

### 3. Fixed Hole Sizing (GeometryFactory.js Line 9-18)

**Problem**: Hole collar circles didn't match 2D canvas size.

**2D Canvas Formula**:

```javascript
// kirra.js Line 19270
const diameterPx = parseInt((hole.holeDiameter / 1000) * currentScale * holeScale);
```

-   `holeDiameter` is in mm
-   Convert to meters: `/ 1000`
-   Scale to screen: `* currentScale` (handled by camera in Three.js)
-   Apply user scale: `* holeScale` (from slider)

**Three.js Fix**:

```javascript
// Before
const radiusInMeters = (diameter / 1000) * 0.5;
const visualRadius = radiusInMeters * 5; // Arbitrary multiplier!

// After
const diameterInMeters = diameter / 1000;
const radiusInMeters = (diameterInMeters / 2) * holeScale; // Match 2D canvas
```

**Updated Function Signature**:

```javascript
static createHole(
    collarX, collarY, collarZ,
    gradeX, gradeY, gradeZ,
    toeX, toeY, toeZ,
    diameter,
    color,
    holeScale = 1  // Added parameter
)
```

**Updated Function Call** (kirra.js Line 12017):

```javascript
const holeGroup = GeometryFactory.createHole(
    collarX,
    collarY,
    collarZ,
    gradeX,
    gradeY,
    gradeZ,
    toeX,
    toeY,
    toeZ,
    hole.holeDiameter,
    hole.holeColor || "#FF0000",
    holeScale // Pass holeScale from global variable
);
```

## Z-Index Layer Stack

After fixes:

```
z-index: 10 → Toggle Buttons Container (bottom toolbar)
z-index: 2  → 2D Canvas (text, labels, UI overlay)
z-index: 1  → Three.js Canvas (geometry)
z-index: 0  → Background/Page
```

## What You Should See Now

### Visual Changes

1. ✅ **No red test square**
2. ✅ **View buttons work** - Can toggle X/Y/Z display, hole IDs, etc.
3. ✅ **Hole collars sized correctly** - Match 2D canvas circles exactly
4. ✅ **Lines visible** - Black (collar→grade) and red (grade→toe)

### Test Interactions

1. **Toggle Buttons Work**:

    - Click hole ID icon → text labels appear/disappear
    - Click X/Y/Z icons → coordinates appear/disappear
    - All bottom toolbar buttons responsive

2. **Hole Slider Works**:

    - Adjust hole size slider
    - Both 2D canvas and Three.js holes resize together

3. **Alignment Perfect**:
    - Zoom in/out → holes stay aligned
    - Pan around → no drift
    - Collars exactly overlay 2D canvas circles

## Console Messages

On initialization, you should see:

```
🎬 Initializing Three.js rendering system...
📍 Set toggle buttons z-index to 10
🎮 Camera controls attached to Three.js canvas
📷 Camera initialized with centroid: X Y scale: S
✅ Three.js rendering system initialized
```

## Technical Details

### Hole Sizing Formula

**World Coordinates** (what Three.js renders):

```
Hole radius (meters) = (diameter_mm / 1000 / 2) * holeScale
```

**Screen Pixels** (what user sees):

```
Hole radius (pixels) = (diameter_mm / 1000 / 2) * holeScale * currentScale
                     = radiusInMeters * currentScale
```

The `currentScale` is automatically applied by the orthographic camera frustum:

-   Camera frustum width = `canvas.width / currentScale` world units
-   So 1 world unit = `currentScale` pixels

### Why This Works

1. **Consistent sizing**: Both 2D canvas and Three.js use same formula
2. **User control**: `holeScale` slider affects both layers
3. **Zoom scale**: Camera handles `currentScale` automatically
4. **No hardcoded multipliers**: Sizing based on actual hole diameter

## Testing Checklist

-   [x] View buttons responsive
-   [x] Test square removed
-   [x] Holes sized correctly
-   [x] Hole slider affects Three.js
-   [ ] Zoom maintains alignment
-   [ ] Pan maintains alignment
-   [ ] All view toggles work (ID, XYZ, angle, etc.)

## Files Changed

-   **src/kirra.js**:

    -   Line 382-387: Added toggle buttons z-index fix
    -   Line 405: Removed test square code
    -   Line 12017: Pass `holeScale` to GeometryFactory

-   **src/three/GeometryFactory.js**:
    -   Line 9: Added `holeScale` parameter
    -   Line 13-18: Fixed hole sizing calculation to match 2D canvas

## Related Fixes

-   **COORDINATE_PRECISION_FIX.md**: Camera frustum calculation
-   **THREEJS_TIMING_FIX.md**: Initialization timing
-   **RESTORATION_FIX.md**: Canvas layering
