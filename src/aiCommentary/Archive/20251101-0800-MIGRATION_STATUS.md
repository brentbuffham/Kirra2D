# Three.js Migration Status

## Completed ✅

### 1. Infrastructure Setup

-   ✅ Updated `package.json` with Three.js v0.170.0
-   ✅ Created `/src/three/ThreeRenderer.js` - Core rendering system
-   ✅ Created `/src/three/CameraControls.js` - Pan/zoom/rotate controls
-   ✅ Created `/src/three/GeometryFactory.js` - Geometry creation helpers
-   ✅ Added Three.js imports to `kirra.js`

### 2. Initialization

-   ✅ Added `initializeThreeJS()` function in `kirra.js` (lines 338-384)
-   ✅ Three.js canvas inserted before 2D canvas in DOM
-   ✅ 2D canvas configured as overlay (z-index: 2, pointer-events: none)
-   ✅ Three.js canvas handles all mouse interactions (z-index: 1)
-   ✅ Camera controls attached to Three.js canvas
-   ✅ Render loop started with `requestAnimationFrame`

### 3. Camera Synchronization

-   ✅ Added `syncCameraToThreeJS()` function (line 390)
-   ✅ Added `syncCameraFromThreeJS()` function (line 396)
-   ✅ Camera controls sync with existing `centroidX`, `centroidY`, `currentScale` variables
-   ✅ Wheel and mouse move events update both systems

### 4. Contour Worker Reintegration

-   ✅ Moved contour calculation from webworker to main thread (lines 40508-40749)
-   ✅ Created `calculateContoursSync()` function
-   ✅ Updated `delaunayContours()` to call synchronous version
-   ✅ Removed worker initialization and termination code
-   ✅ Deleted `/src/webWorkers/contourWorker.js` file

### 5. Three.js Drawing Helpers

-   ✅ Created `clearThreeJS()` function (line 11953)
-   ✅ Created `drawHoleThreeJS()` function (line 11960)
-   ✅ Created `drawHoleToeThreeJS()` function (line 11987)
-   ✅ Created `drawKADPointThreeJS()` function (line 11995)
-   ✅ Created `drawKADLineThreeJS()` function (line 12003)
-   ✅ Created `drawKADPolygonThreeJS()` function (line 12011)
-   ✅ Created `drawKADCircleThreeJS()` function (line 12019)
-   ✅ Created `drawSurfaceThreeJS()` function (line 12027)
-   ✅ Created `drawContoursThreeJS()` function (line 12041)
-   ✅ Created `drawDirectionArrowsThreeJS()` function (line 12049)
-   ✅ Created `drawBackgroundImageThreeJS()` function (line 12057)
-   ✅ Created `renderThreeJS()` function (line 12070)

### 6. Integration with drawData

-   ✅ Added `clearThreeJS()` call at start of `drawData()` (line 18328)
-   ✅ Added `renderThreeJS()` call at end of `drawData()` (line 18968)

## In Progress ⚠️

### 1. Hole Rendering Migration

-   ✅ Found main hole rendering loop in `drawData()` (lines 18806-18874)
-   ✅ Added `drawHoleThreeJS()` call for each hole (line 18864)
-   ✅ Added `drawHoleToeThreeJS()` call for toes (line 18869)
-   ✅ Holes now render in both canvas and Three.js
-   ⚠️ Need to test and verify hole rendering works correctly
-   ⚠️ Need to handle hole highlighting in Three.js

## Not Started ❌

### 1. Complete Hole Rendering

-   ❌ Integrate hole rendering into main `drawData()` loop
-   ❌ Handle different hole types (normal, dummy, hexagon, no-diameter)
-   ❌ Handle hole selection and highlighting
-   ❌ Handle hole tracks/stems

### 2. Surface Rendering Migration

-   ❌ Modify `drawSurface()` function (line 30211)
-   ❌ Call `drawSurfaceThreeJS()` with triangles and color functions
-   ❌ Handle hillshade gradients
-   ❌ Handle surface transparency
-   ❌ Handle multiple surfaces with different gradient types

### 3. KAD Drawings Migration

-   ❌ Modify KAD rendering in `drawData()` (lines 18115-18263)
-   ❌ Convert points to Three.js
-   ❌ Convert lines to Three.js
-   ❌ Convert polygons to Three.js
-   ❌ Convert circles to Three.js
-   ❌ Keep text on 2D canvas overlay (already correct)

### 4. Contours & Voronoi Migration

-   ❌ Modify contour rendering to use `drawContoursThreeJS()`
-   ❌ Modify direction arrows to use `drawDirectionArrowsThreeJS()`
-   ❌ Convert voronoi cell rendering to Three.js
-   ❌ Handle timing contour visualization

### 5. Background Images Migration

-   ❌ Modify `drawBackgroundImage()` function (line 32472)
-   ❌ Call `drawBackgroundImageThreeJS()` for each image
-   ❌ Handle GeoTIFF images
-   ❌ Handle image transparency

### 6. Selection & Highlighting

-   ❌ Implement Three.js raycasting for object selection
-   ❌ Replace `drawHiHole()` with Three.js highlighting
-   ❌ Handle multi-selection
-   ❌ Handle KAD object selection
-   ❌ Handle surface selection

### 7. Event Handler Updates

-   ❌ Update mouse/touch handlers to use Three.js raycaster
-   ❌ Implement world-to-screen coordinate conversion for Three.js
-   ❌ Update worldToCanvas conversions
-   ❌ Handle rotation mode (Ctrl+drag)

### 8. Render Synchronization

-   ❌ Ensure all render triggers call both canvas and Three.js
-   ❌ Update `refreshPoints()` function
-   ❌ Update all zoom/pan handlers
-   ❌ Update all visibility toggle handlers

### 9. Performance Optimization

-   ❌ Implement instanced rendering for large hole counts
-   ❌ Add frustum culling optimizations
-   ❌ Batch geometry updates
-   ❌ Only render on changes (not continuous)

### 10. Print Mode Support

-   ❌ Capture Three.js canvas for printing
-   ❌ Composite Three.js and 2D canvas for print output
-   ❌ Handle print boundaries
-   ❌ Update `printCanvasHiRes()` function

### 11. CSS Styling

-   ❌ Add Three.js canvas styling to `kirra.css`
-   ❌ Ensure proper layering of canvases
-   ❌ Handle responsive resizing

### 12. Testing

-   ❌ Test hole rendering
-   ❌ Test surface rendering
-   ❌ Test KAD drawings
-   ❌ Test pan/zoom/rotate
-   ❌ Test selection
-   ❌ Test performance with large datasets

## Known Issues

1. **Camera Sync Timing**: The camera synchronization happens after initialization, but the controls might not be available immediately. May need to move sync into a callback.

2. **Coordinate System**: Need to verify that the Three.js Y-up orientation matches the Kirra UTM coordinate system correctly.

3. **2D Canvas Overlay**: Text and UI elements on 2D canvas need to be positioned correctly relative to Three.js geometry. May need updated worldToCanvas calculations.

4. **Pointer Events**: 2D canvas has `pointer-events: none` which means it won't receive any mouse events. This is correct for geometry interaction, but may need special handling for UI overlays that need clicks.

## Next Steps (Priority Order)

1. **Verify Basic Setup**: Test the dev server and confirm Three.js initializes without errors
2. **Migrate Hole Rendering**: This is the most critical piece - find the main hole loop and add Three.js calls
3. **Test Hole Rendering**: Verify holes appear correctly in Three.js
4. **Migrate Surfaces**: Second most important visual element
5. **Migrate KAD Drawings**: Lines, polygons, circles, points
6. **Implement Selection**: Get raycasting working for object selection
7. **Complete Remaining Items**: Work through the "Not Started" list above

## Development Server

Run `npm run dev` to start the Vite development server. The app should now have:

-   Three.js renderer initialized
-   2D canvas as overlay
-   Camera controls active
-   Contour calculations in main thread

## File Structure

```
Kirra2D/
├── src/
│   ├── kirra.js (40,750+ lines) - Main application
│   ├── three/
│   │   ├── ThreeRenderer.js - Core rendering system
│   │   ├── CameraControls.js - Camera interactions
│   │   └── GeometryFactory.js - Geometry creation helpers
│   ├── dialog/
│   │   └── FloatingDialog.js
│   └── toolbar/
│       └── ToolbarPanel.js
├── kirra.html
├── kirra.css
└── package.json
```

## Notes

-   The existing 2D canvas rendering is still active and will display normally
-   Three.js is rendering underneath but won't show anything until geometry is added
-   Both systems coexist during migration - canvas can be gradually phased out
-   All camera movements are synced between both systems
-   Contour calculations no longer have sync issues (running in main thread)
