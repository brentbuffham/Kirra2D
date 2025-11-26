# 3D Feature Roadmap - Full 3D Interaction & Display

## Current Status

### ✅ Completed (Phase 1 & 2)
- **3D Rendering**: Holes, toes, KAD entities, surfaces, contours, direction arrows
- **3D Navigation**: Pan, zoom, 2D rotation, 3D orbit (Alt+drag)
- **Coordinate System**: Local origin offset for precision, Z-centroid orbit
- **Performance**: Optimized drawing functions with local variable caching
- **2D-3D Toggle**: New toolbar button to show/hide 3D canvas with icon swap
- **Module Extraction**: 35 functions extracted (793 lines) from kirra.js

### ⚠️ Current Limitations
1. **3D canvas is view-only** - no selection, no interaction tools
2. **2D text doesn't appear in 3D** - KAD text labels, hole annotations missing in 3D-only mode
3. **Selection doesn't work in 3D** - can't click holes, KAD objects, or polygons in 3D view

---

## Roadmap: Making 3D Fully Interactive

### Priority 1: 3D Text Rendering ⭐⭐⭐
**Goal**: Display all 2D text annotations in 3D space

#### What's Missing
- KAD text labels (`drawKADTexts`)
- Hole annotations (ID, length, depth, angle)
- Measurement labels
- Tool overlay text (ruler, protractor)

#### Current 3D Text Functions
```javascript
// Already implemented:
- drawHoleTextThreeJS() - Single hole label
- drawHoleTextsAndConnectorsThreeJS() - All hole labels
- drawKADTextThreeJS() - KAD text in 3D
```

#### What Needs to be Done
1. **Ensure all text functions call 3D equivalents**
   - Check `drawData()` hole loop
   - Check KAD rendering sections
   - Check measurement tool rendering

2. **Add missing 3D text functions**
   - Measurement text (ruler, protractor)
   - Voronoi/Delaunay labels
   - Legend text (may stay 2D overlay)

3. **Fix text positioning**
   - Ensure `worldToThreeLocal()` is used for all coordinates
   - Test with different camera angles
   - Verify text always faces camera (billboard effect)

---

### Priority 2: 3D Selection & Interaction ⭐⭐⭐
**Goal**: Make 3D canvas fully interactive like 2D

#### Current State
- 2D canvas: Click selection, hover detection, tool interaction all work
- 3D canvas: View-only, no raycasting, no object picking

#### What Needs to be Implemented

##### A. Three.js Raycasting System
```javascript
// Need to add to ThreeRenderer.js or new InteractionManager.js
class ThreeInteractionManager {
    constructor(threeRenderer, camera) {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        // ...
    }
    
    // Step 1) Convert mouse coords to Three.js space
    getMousePosition(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    // Step 2) Raycast to find intersected objects
    getIntersectedObjects(camera, scene) {
        this.raycaster.setFromCamera(this.mouse, camera);
        return this.raycaster.intersectObjects(scene.children, true);
    }
    
    // Step 3) Identify clicked hole/KAD object
    findClickedHole(intersects, allBlastHoles) {
        for (const intersect of intersects) {
            // Check userData for hole ID
            if (intersect.object.userData.holeId) {
                return allBlastHoles.find(h => h.entityName === intersect.object.userData.holeId);
            }
        }
        return null;
    }
}
```

##### B. Mouse Event Handlers for 3D
```javascript
// Add to kirra.js or new file
function setup3DInteraction() {
    const threeCanvas = document.getElementById("threeCanvas");
    
    // Step 1) Click handler
    threeCanvas.addEventListener("click", (event) => {
        if (!threeRenderer || !threeInitialized) return;
        
        const intersects = interactionManager.raycast(event);
        const clickedHole = interactionManager.findClickedHole(intersects);
        
        if (clickedHole) {
            selectHole(clickedHole); // Use existing selection logic
            drawData(allBlastHoles);
        }
    });
    
    // Step 2) Hover handler
    threeCanvas.addEventListener("mousemove", (event) => {
        const intersects = interactionManager.raycast(event);
        const hoveredHole = interactionManager.findClickedHole(intersects);
        
        updateHoverState(hoveredHole);
        // Could show tooltip or highlight
    });
    
    // Step 3) Context menu
    threeCanvas.addEventListener("contextmenu", (event) => {
        // Right-click actions
    });
}
```

##### C. Object Metadata (userData)
All Three.js geometry must have identifying metadata:

```javascript
// In drawHoleThreeJS():
const holeMesh = GeometryFactory.createCylinder(...);
holeMesh.userData = {
    type: "hole",
    holeId: hole.entityName,
    holeData: hole // Store full data for tooltips
};

// In drawKADPointThreeJS():
const pointMesh = GeometryFactory.createSphere(...);
pointMesh.userData = {
    type: "kadPoint",
    kadId: point.id,
    kadData: point
};
```

##### D. Selection Highlighting in 3D
```javascript
// Add to ThreeRenderer.js
highlightObject(object, color = 0xffff00) {
    if (object.material) {
        object.material.emissive = new THREE.Color(color);
        object.material.emissiveIntensity = 0.5;
    }
}

clearHighlight(object) {
    if (object.material) {
        object.material.emissive = new THREE.Color(0x000000);
        object.material.emissiveIntensity = 0;
    }
}
```

---

### Priority 3: Unify 2D and 3D Selection State ⭐⭐
**Goal**: Selection in 2D reflects in 3D and vice versa

#### Implementation Strategy

```javascript
// Shared selection state (already exists)
let selectedHole = null;
let selectedKADObject = null;
let selectedMultipleHoles = [];

// Step 1) When selecting in 2D (already works):
function handle2DClick(x, y) {
    const hole = findHoleAt2DCoords(x, y);
    if (hole) {
        selectHole(hole); // Updates global state
        highlightHoleIn3D(hole); // NEW: Also highlight in 3D
        drawData(allBlastHoles);
    }
}

// Step 2) When selecting in 3D (NEW):
function handle3DClick(intersects) {
    const hole = findHoleFromIntersects(intersects);
    if (hole) {
        selectHole(hole); // Updates global state (same function!)
        drawData(allBlastHoles); // Redraws both 2D and 3D
    }
}

// Step 3) Unified highlight function:
function selectHole(hole) {
    selectedHole = hole;
    
    // Step 3a) Highlight in 2D (already works in drawData)
    // ... existing 2D drawing code ...
    
    // Step 3b) Highlight in 3D
    if (threeInitialized && threeRenderer) {
        threeRenderer.clearAllHighlights();
        const holeMesh = threeRenderer.findMeshByHoleId(hole.entityName);
        if (holeMesh) {
            threeRenderer.highlightObject(holeMesh);
        }
    }
}
```

---

### Priority 4: 3D Tools & Measurements ⭐
**Goal**: Make ruler, protractor, and other tools work in 3D

#### Tools to Implement in 3D
1. **Ruler** - 3D line measurement
2. **Protractor** - 3D angle measurement  
3. **Snap to point** - Snap to 3D geometry
4. **Create KAD** - Place KAD objects in 3D space
5. **Pattern tools** - Polygon patterns in 3D

#### Example: 3D Ruler
```javascript
// When user clicks in 3D for ruler start point:
function handleRuler3DClick(intersects) {
    if (intersects.length === 0) return;
    
    const point = intersects[0].point; // THREE.Vector3 in local coords
    
    // Convert to world coords
    const worldX = point.x + threeLocalOriginX;
    const worldY = point.y + threeLocalOriginY;
    const worldZ = point.z;
    
    if (!rulerStartPoint) {
        rulerStartPoint = {x: worldX, y: worldY, z: worldZ};
    } else {
        rulerEndPoint = {x: worldX, y: worldY, z: worldZ};
        // Calculate 3D distance
        const dx = rulerEndPoint.x - rulerStartPoint.x;
        const dy = rulerEndPoint.y - rulerStartPoint.y;
        const dz = rulerEndPoint.z - rulerStartPoint.z;
        const distance3D = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Show result
        console.log("3D Distance: " + distance3D.toFixed(2) + "m");
    }
}
```

---

## Implementation Timeline

### Phase 3A: 3D Text (1-2 hours)
1. ✅ Audit all text rendering in `drawData()`
2. ✅ Ensure 3D text functions are called
3. ✅ Test in 3D-only mode
4. ✅ Fix any positioning issues

### Phase 3B: 3D Interaction Foundation (2-3 hours)
1. ✅ Create `ThreeInteractionManager` class
2. ✅ Add raycasting system
3. ✅ Implement click detection
4. ✅ Add object metadata (userData)
5. ✅ Test hole selection in 3D

### Phase 3C: Unified Selection (1 hour)
1. ✅ Unify `selectHole()` function
2. ✅ Add 3D highlighting
3. ✅ Test bidirectional selection
4. ✅ Add hover effects

### Phase 3D: 3D Tools (3-4 hours)
1. ✅ Implement 3D ruler
2. ✅ Implement 3D protractor
3. ✅ Add snap-to-3D-geometry
4. ✅ Test all measurement tools

### Phase 4: Polish & Optimization (2-3 hours)
1. ✅ Performance profiling
2. ✅ LOD (Level of Detail) for far objects
3. ✅ Frustum culling optimization
4. ✅ Smooth camera transitions
5. ✅ Documentation

---

## Files That Need Modification

### Core Files
- ✅ `src/kirra.js` - Add 3D event listeners, interaction logic
- ✅ `src/three/ThreeRenderer.js` - Add selection/highlight methods
- 📝 `src/three/InteractionManager.js` - **NEW FILE** for 3D interaction
- ✅ `src/three/CameraControls.js` - Already handles navigation

### Drawing Functions
- ✅ `src/draw/canvas3DDrawing.js` - Ensure all functions add userData
- ✅ Check text rendering calls in main draw loop

### New Files to Create
- 📝 `src/three/InteractionManager.js` - Raycasting, object picking
- 📝 `src/three/SelectionManager.js` - Highlight management
- 📝 `src/tools/MeasurementTools3D.js` - 3D ruler, protractor

---

## Testing Checklist

### 3D Text Display
- [ ] KAD text labels appear in 3D
- [ ] Hole ID labels appear in 3D
- [ ] Hole depth/length/angle labels appear in 3D
- [ ] Text always faces camera
- [ ] Text scales appropriately with zoom

### 3D Selection
- [ ] Click hole in 3D to select
- [ ] Selected hole highlights in both 2D and 3D
- [ ] Select in 2D, see highlight in 3D
- [ ] Multi-select works (Ctrl+click)
- [ ] Right-click context menu

### 3D Tools
- [ ] Ruler works in 3D space
- [ ] Protractor works in 3D space
- [ ] Snap to holes/KAD works in 3D
- [ ] Create KAD objects in 3D

### Performance
- [ ] 60 FPS with 1000+ holes
- [ ] Smooth camera movement
- [ ] No lag on selection
- [ ] Efficient raycasting

---

## Quick Wins (Do First)

1. **✅ 2D-3D Toggle Button** (DONE)
   - Added toolbar button with icon swap
   - Toggle 3D canvas visibility

2. **Fix Existing 3D Text** (30 min)
   - Ensure `drawHoleTextsAndConnectorsThreeJS()` is called
   - Ensure `drawKADTextThreeJS()` is called for all KAD text

3. **Add userData to All 3D Objects** (1 hour)
   - Update `drawHoleThreeJS()` to add `userData.holeId`
   - Update `drawKADPointThreeJS()` to add `userData.kadId`
   - Update all other 3D drawing functions

4. **Basic Click Selection** (1 hour)
   - Add click listener to threeCanvas
   - Basic raycasting
   - Call existing `selectHole()` function
   - Redraw to show selection

---

## Notes

- All coordinate conversions use `worldToThreeLocal()` for precision
- Z-centroid is calculated for proper orbit centering
- Camera state is independent - not synced from 2D
- 2D canvas overlays on top for UI elements (z-index: 2)
- 3D canvas renders below (z-index: 1)

**Current State**: 3D rendering works well, but is view-only. With the roadmap above, we can make it fully interactive.


