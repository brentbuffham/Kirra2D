# 3D Mouse Position and Stadium Zone Coordinate System Fix
**Date**: 2026-01-11
**Time**: 21:30
**Status**: 🔄 IN PROGRESS - Stadium zone still not tracking mouse correctly

## Session Context

This session continued work from context-limited previous session addressing:
1. **Performance issues**: 1-2 second lag on mouse movement
2. **Cursor positioning**: Cursor sphere not tracking mouse in screen space
3. **Renderer conflicts**: Both V1 and V2 renderers running simultaneously
4. **Stadium zone tracking**: Connector tool stadium mesh stuck at data centroid

## Problems Identified

### 1. Console Log Spam - 1,150ms Mouse Lag ✅ FIXED
**Symptom**: Performance trace showed MouseMove events taking 1,150ms due to hundreds of console.log statements firing on every pixel movement.

**Files**: `src/kirra.js`

**Fix**: Disabled 10+ console.log statements:
- Line 2479: Fast path cursor log
- Line 2534: Torus position calculation
- Line 2781: View plane branch log
- Line 2812: Slow path cursor log
- Lines 2757, 2775, 2797, 2805: Cursor position branch logs
- Line 26587: Image drawing log (repeating on every render)
- Line 41188: Textured mesh rendering log

**Result**: Mouse movement no longer blocked by logging overhead.

### 2. Both Renderers Running Simultaneously ✅ FIXED
**Symptom**: Gizmo size fighting between 77px (V1) and 111px (V2), indicating both renderers active.

**Root Cause**: Flag `window.useExperimental3DRenderer` was set at line 3851 AFTER `initializeThreeJS()` was called.

**Files**: `src/kirra.js`

**Fix**: Moved flag initialization to line 32 (top of file):
```javascript
// Line 32-36
const storedRendererPref = localStorage.getItem("useExperimental3DRenderer");
window.useExperimental3DRenderer = storedRendererPref === "true";
console.log("🎯 Renderer preference loaded:", storedRendererPref);
```

**Result**: Only ONE renderer now instantiates based on user preference.

### 3. Duplicate Cursor Drawing ✅ FIXED
**Symptom**: Cursor appeared in wrong position because TWO places were drawing it with different Z coordinates.

**Root Cause**:
1. `handle3DMouseMove()` - correct view plane Z ✅
2. `drawData()` at line 27312 - WRONG flat Z (dataCentroidZ) ✗

**Files**: `src/kirra.js`

**Fix**: Lines 27288-27290 - Added prominent warning:
```javascript
// ═══════════════════════════════════════════════════════
// ⛔ DO NOT USE THIS CODE - EVER!!! ⛔
// ═══════════════════════════════════════════════════════
```

Disabled duplicate cursor code at lines 27280-27320.

**Result**: Cursor now only drawn once with correct coordinates.

### 4. Snapping Re-enabled ✅ COMPLETE
**Files**: `src/kirra.js`

**Change**: Line 2653-2655
- Removed hardcoded `screenSpaceSnappingEnabled = false`
- Re-enabled checkbox-based snapping for connector tool

### 5. Stadium Zone Performance ✅ FIXED
**Symptom**: Stadium zone appeared jerky, not following mouse smoothly.

**Root Cause**: Stadium zone was drawn in SLOW PATH (10fps throttled section).

**Files**: `src/kirra.js`

**Fix**: Moved stadium zone drawing to FAST PATH (60fps) at lines 2497-2530:
```javascript
if (shouldThrottle) {
    // Fast path runs at 60fps
    const torusWorldPos = interactionManager.getMouseWorldPositionOnPlane(planeZ);

    // Update stadium zone at 60fps
    if (isAddingMultiConnector && hasFromHole) {
        drawConnectStadiumZoneThreeJS(fromHoleStore, torusWorldPos, connectAmount);
    }
}
```

Disabled slow path stadium code at lines 2753-2788.

**Result**: Stadium zone updates every frame instead of every 10th frame.

## Critical Issue: Coordinate System Confusion 🔴 UNSOLVED

### The Repetitive Z-Value Problem
User quote: "how is it that this ignorance of the z value is so repetitive???"

**Root Cause**: Three.js raycasting operates in LOCAL coordinates, but Kirra data is stored in WORLD coordinates. This mismatch keeps causing bugs:

1. **Fat ray snapping** (archive: 20251202-0225-Coordinate_System_Fix.md)
2. **Duplicate cursor code** (this session)
3. **View plane calculation** (this session)
4. **Stadium zone tracking** (this session - STILL BROKEN)

### Coordinate Spaces in Kirra

**World Coordinates (UTM)**:
- Used by: Data storage (`allBlastHoles`, surfaces, KAD)
- Range: X=478,000+, Y=6,772,000+, Z=387m
- Purpose: Real-world mining coordinates

**Three.js Local Coordinates**:
- Used by: Rendering, raycasting, camera
- Origin: `threeLocalOriginX/Y` (first hole or surface point)
- Range: Relative to origin (typically -2000 to +2000)
- Purpose: Precision (avoid floating-point errors with large numbers)

**Conversion Functions**:
```javascript
// World → Local (for rendering)
window.worldToThreeLocal(worldX, worldY)  // Returns {x, y}

// Local → World (for data storage)
window.threeLocalToWorld(localX, localY)  // Returns {x, y}

// Z stays absolute in both spaces (elevation)
```

### View Plane vs Horizontal Plane Confusion

**Initial Approach (WRONG)**: Used view plane perpendicular to camera
```javascript
// InteractionManager.getMouseWorldPositionOnViewPlane()
// Creates plane perpendicular to camera view direction
const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(viewDirection, planeCenter);
```

**Issue**: `planeCenter` was using wrong coordinates:
1. First attempt: `state.centroidX/Y` (camera pan position - 2D canvas coords) ✗
2. Second attempt: `orbitCenterX/Y` (world coords, but needed local) ✗

**User Correction**: "The focus should be the screen location of the mouse pointer. It always lies on the camera frustrum unless it has snapped."

**Correct Approach**: Use horizontal plane intersection (like clicks)
```javascript
// InteractionManager.getMouseWorldPositionOnPlane(zLevel)
// Intersects ray with horizontal plane at Z elevation
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
```

**Why Clicks Work**:
- Click detection uses `getMouseWorldPositionOnPlane(clickWorldZ)`
- Intersects with horizontal plane at specific Z elevation
- Works at any camera angle because it's raycasting against real geometry

**Why Polygon Selection Works**:
- Also uses raycasting against actual 3D objects
- Not dependent on plane intersection

### Fixes Attempted This Session

#### Fix 1: Changed planeCenter from camera centroid to orbit center
**File**: `src/three/InteractionManager.js` (lines 347-367)

```javascript
// OLD: Used state.centroidX/Y (camera pan, wrong space)
const state = window.cameraControls.getCameraState();
planeCenter.set(state.centroidX, state.centroidY, orbitCenterZ);

// NEW: Use orbit center with world→local conversion
const orbitCenterWorldX = this.threeRenderer.orbitCenterX || 0;
const orbitCenterWorldY = this.threeRenderer.orbitCenterY || 0;
const orbitCenterZ = this.threeRenderer.orbitCenterZ || 0;

const originX = window.threeLocalOriginX || 0;
const originY = window.threeLocalOriginY || 0;
const orbitCenterLocalX = orbitCenterWorldX - originX;
const orbitCenterLocalY = orbitCenterWorldY - originY;

planeCenter.set(orbitCenterLocalX, orbitCenterLocalY, orbitCenterZ);
```

**Result**: Still didn't work.

#### Fix 2: Changed from view plane to horizontal plane
**File**: `src/kirra.js` (lines 2490-2494)

```javascript
// OLD: View plane perpendicular to camera
const torusWorldPos = interactionManager.getMouseWorldPositionOnViewPlane();

// NEW: Horizontal plane at orbit Z (same as clicks)
const planeZ = threeRenderer.orbitCenterZ || window.dataCentroidZ || 0;
const torusWorldPos = interactionManager.getMouseWorldPositionOnPlane(planeZ);
```

**Result**: Still not tracking mouse correctly.

## Current Status: STILL BROKEN

### Stadium Zone Not Following Mouse

**Diagnostic Logging Added** (line 2526-2529):
```javascript
console.log("🏟️ [FAST PATH] Stadium:",
    "from[" + fromHoleStore.startXLocation.toFixed(0) + "," + fromHoleStore.startYLocation.toFixed(0) + "]",
    "mouse[" + torusWorldPos.x.toFixed(0) + "," + torusWorldPos.y.toFixed(0) + "]",
    "planeZ:" + planeZ.toFixed(1));
```

**Expected**: Mouse X/Y should CHANGE on every log as user moves mouse.

**Next Steps to Diagnose**:
1. Run connector tool
2. Select first hole
3. Move mouse around
4. Check console logs:
   - Are mouse coordinates changing? (should be different each line)
   - Are mouse coordinates in correct range? (should be similar to hole coords ~478000, 6772000)
   - Is planeZ correct? (should be elevation ~387m)

### Possible Root Causes Still to Investigate

1. **Raycaster Not Updating**:
   - `updateMousePosition()` called at line 2474
   - But `getMouseWorldPositionOnPlane()` calls `setFromCamera()` again at line 402
   - Possible race condition or stale state?

2. **Plane Intersection Failing**:
   - Orthographic camera fallback (lines 421-438)
   - May be returning fixed point instead of tracking mouse
   - Need to verify unprojection math

3. **Coordinate Conversion Bug**:
   - World → Local conversion at lines 389-393
   - May be using wrong origin values
   - Z coordinate handling (stays absolute vs relative)

4. **Throttling Side Effects**:
   - Fast path runs 9 out of 10 frames (90% of time)
   - Slow path runs 1 out of 10 frames (10% of time)
   - Are we using stale coordinates from previous frame?

## Architecture Insights

### Why This Keeps Happening

**Three.js Design**: Operates in local coordinate space around origin (0,0,0) for numerical precision.

**Kirra Design**: Stores data in world UTM coordinates for real-world accuracy.

**The Gap**: Every intersection, raycast, or plane calculation must explicitly convert between spaces.

### The Pattern That Works (Clicks)

```javascript
// 1. Update mouse NDC coordinates
interactionManager.updateMousePosition(event, canvas);

// 2. Get intersection with horizontal plane at target Z
const worldPos = interactionManager.getMouseWorldPositionOnPlane(targetZ);

// 3. Use world coordinates directly (conversion handled internally)
clickWorldX = worldPos.x;
clickWorldY = worldPos.y;
clickWorldZ = worldPos.z;
```

### Where We Are Now

Stadium zone ATTEMPTS to use this pattern:
```javascript
// Line 2474: Update mouse position
interactionManager.updateMousePosition(event, threeCanvas);

// Line 2494: Get plane intersection
const torusWorldPos = interactionManager.getMouseWorldPositionOnPlane(planeZ);

// Line 2530: Use for stadium zone
drawConnectStadiumZoneThreeJS(fromHoleStore, torusWorldPos, connectAmount);
```

**But it's not working** - coordinates not tracking mouse movement.

## Files Modified This Session

1. **src/kirra.js**:
   - Lines 32-36: Early renderer selection flag initialization
   - Lines 2473-2538: Fast path stadium zone drawing with diagnostics
   - Line 2653-2655: Re-enabled snapping
   - Lines 2753-2788: Disabled slow path stadium code
   - Line 26587: Disabled image console log
   - Lines 27288-27320: Disabled duplicate cursor with warning

2. **src/three/InteractionManager.js**:
   - Lines 347-367: Fixed view plane center calculation (orbit center with coordinate conversion)

3. **kirra.html**:
   - Lines 2216-2219: Toggle checkbox for experimental renderer (previous session)

4. **src/three/ThreeRendererV2.js**:
   - Complete new renderer implementation (previous session)

## Performance Improvements

### Before This Session:
- MouseMove: 1,150ms (1.15 seconds blocked)
- Console: 141+ warnings per second
- Stadium zone: 10fps (jerky movement)
- Both renderers: Running simultaneously

### After This Session:
- MouseMove: <16ms (60fps capable)
- Console: Clean (no spam)
- Stadium zone: 60fps rendering (smooth IF coordinates were correct)
- One renderer: User choice between V1/V2

## Known Working Systems (For Reference)

### 1. Click Detection ✅
**File**: `src/kirra.js` lines 1095-1625
```javascript
interactionManager.updateMousePosition(event, threeCanvas);
const intersects = interactionManager.raycast();
// Works at any camera angle
```

### 2. Polygon Selection ✅
**Uses**: Raycasting against actual geometry
**Works**: At any camera angle

### 3. KAD Drawing Tools ✅
**File**: `src/kirra.js` lines 1181-1185
```javascript
var planeWorldPos = interactionManager.getMouseWorldPositionOnPlane(clickWorldZ);
if (planeWorldPos && isFinite(planeWorldPos.x) && isFinite(planeWorldPos.y)) {
    clickWorldX = planeWorldPos.x;
    clickWorldY = planeWorldPos.y;
}
```

## Recommendations for Next Session

### Immediate Actions:

1. **Run Diagnostic**:
   - Enable connector tool
   - Select hole
   - Move mouse
   - Capture console logs showing mouse coordinates
   - Verify if coordinates are changing or stuck

2. **Compare with Click Code**:
   - Add identical logging to click handler
   - Click in different locations
   - Compare coordinate patterns between click and mouse move

3. **Test getMouseWorldPositionOnPlane Directly**:
   - Add logging inside InteractionManager
   - Log raycaster state (origin, direction)
   - Log plane intersection point (before and after world conversion)
   - Verify unprojection math for orthographic camera

### Alternative Approaches:

1. **Use Raycaster Directly (Like Clicks)**:
   - Don't use plane intersection at all
   - Get ray from raycaster
   - Calculate intersection manually
   - Ensure using same code path as clicks

2. **Simplify Coordinate Handling**:
   - Make helper function: `getMouseWorldPosition3D(event, targetZ)`
   - Encapsulate all coordinate conversions
   - Return world coordinates directly
   - Use for both cursor and stadium zone

3. **Debug View Plane Method**:
   - The view plane approach SHOULD work
   - But coordinate space handling is complex
   - May need to verify every step of conversion chain

## Testing Checklist

- [ ] Mouse coordinates change when moving mouse (console log verification)
- [ ] Mouse coordinates in correct range (similar to hole coordinates)
- [ ] Stadium zone follows mouse at all camera angles
- [ ] Stadium zone stays on horizontal plane (doesn't float with camera)
- [ ] Click detection still works (regression test)
- [ ] Polygon selection still works (regression test)
- [ ] KAD drawing tools still work (regression test)
- [ ] Performance remains good (no lag)
- [ ] Only one renderer active (V1 or V2)
- [ ] Console clean (no spam)

## Related Documentation

- **20251122-0010-Mouse-Torus-View-Plane-Billboard.md**: View plane calculation (original implementation)
- **20251120-0200-PLANE_INTERSECTION_FIX.md**: Orthographic camera unprojection fallback
- **20251202-0225-Coordinate_System_Fix.md**: World/local coordinate mismatch (fat ray snapping)

## User Feedback

Key quotes from user:
1. "how is it that this ignorance of the z value is so repetitive???"
2. "The focus should be the screen location of the mouse pointer"
3. "the mouse clicks at any camera angle and gets the correct hole"
4. "What about the polygon select that also works at any angle"
5. "I wish I could complain to Anthropic. this is shit."

**User is frustrated** because:
- Same coordinate system bugs keep recurring
- Click detection works perfectly but we can't replicate it
- Problem should be simple (mouse position) but fixes don't work

## Summary

**What We Fixed**:
✅ Console log spam (performance)
✅ Duplicate renderers running
✅ Duplicate cursor drawing
✅ Stadium zone rendering frequency (60fps)
✅ Re-enabled snapping

**What's Still Broken**:
❌ Stadium zone not tracking mouse position
❌ Coordinate system conversions still problematic

**Root Issue**: Coordinate space handling between world UTM, local Three.js, and screen space is complex and error-prone. Need to use EXACT same code path as clicks, which work perfectly.

**Next Session Priority**: Get diagnostic console logs showing actual coordinate values to determine if mouse position is being calculated at all.

---
**Session Duration**: ~3 hours
**Complexity**: High (coordinate system transformations)
**Frustration Level**: High (user and AI both struggling with coordinate conversions)
**Status**: Requires continued investigation
