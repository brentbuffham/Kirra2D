# Three.js Initialization Timing Fix

## Problem

Three.js wasn't rendering at all - no test square, no 3D geometry visible. Only 2D canvas rendering was working.

## Root Cause

**Timing Issue**: `initializeThreeJS()` was being called on `DOMContentLoaded`, but the canvas element didn't exist yet or wasn't ready.

### What Was Happening

```javascript
// Module level - runs immediately when script loads
const canvas = document.getElementById("canvas"); // → null (canvas doesn't exist yet)

// Later...
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeThreeJS);
} else {
    initializeThreeJS(); // → Tries to use null canvas → fails silently
}
```

The try-catch block caught the error but didn't give clear feedback, so Three.js silently failed to initialize.

## Solution

### Changed Initialization Strategy

**Before**: Try to initialize on DOMContentLoaded (too early)

**After**: Initialize lazily on first draw call

### Implementation

#### 1. Added Safety Checks (kirra.js Line 342-357)

```javascript
function initializeThreeJS() {
    if (threeInitialized) return;

    // Step 1) Check if canvas exists
    if (!canvas) {
        console.warn("⚠️ Canvas not ready yet, deferring Three.js initialization");
        return;
    }

    try {
        console.log("🎬 Initializing Three.js rendering system...");

        const canvasContainer = canvas.parentElement;

        if (!canvasContainer) {
            console.error("❌ Canvas container not found");
            return;
        }

        // ... rest of initialization
    } catch (error) {
        console.error("❌ Failed to initialize Three.js:", error);
    }
}
```

#### 2. Call from drawData() (kirra.js Line 18386-18389)

```javascript
function drawData(allBlastHoles, selectedHole) {
    if (canvas) {
        // Ensure canvas is sized correctly
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }
    }

    // Step 0) Initialize Three.js on first draw
    if (!threeInitialized) {
        initializeThreeJS();
    }

    // Rest of drawing...
}
```

#### 3. Removed Premature Initialization

```javascript
// REMOVED - was line 450-455
// if (document.readyState === "loading") {
//     document.addEventListener("DOMContentLoaded", initializeThreeJS);
// } else {
//     initializeThreeJS();
// }
```

## Why This Works

### Guaranteed Canvas Availability

`drawData()` is only called when:

1. Canvas element exists (checked at line 18377)
2. Canvas is properly sized
3. The app is ready to render

### Lazy Initialization Benefits

-   **Safe**: Canvas is guaranteed to exist
-   **One-time**: `threeInitialized` flag prevents re-initialization
-   **Automatic**: No manual initialization needed
-   **Visible errors**: Console logs clearly show initialization status

### Initialization Flow

```
1. App loads
2. Canvas element created
3. First render triggered (holes loaded, zoom, etc.)
4. drawData() called
   ├─ Canvas exists? ✓
   ├─ Three.js initialized? ✗
   └─ Call initializeThreeJS()
      ├─ Create ThreeRenderer
      ├─ Setup camera
      ├─ Add test square
      └─ Start render loop
5. Three.js now rendering!
6. All subsequent drawData() calls skip initialization
```

## What You Should See Now

### Console Messages

When you load the app or first trigger a render, you should see:

```
🎬 Initializing Three.js rendering system...
🔴 Added small red test square at center (0,0,10) - 20x20 units
📷 Camera initialized with centroid: X Y scale: S
✅ Three.js rendering system initialized
```

### Visual Elements

1. **Red test square** at center of viewport (20x20 units)
2. **Holes rendered twice**:
    - 2D canvas version (existing)
    - Three.js version (collar + lines)
3. **Both layers visible** simultaneously during transition

### Browser Console

Open browser console (F12) and check for:

-   ✅ Initialization messages
-   ✅ No errors
-   ✅ `threeRenderer` is not null
-   ✅ `threeInitialized` is true

### Test Commands

```javascript
// In browser console after loading data:

threeInitialized;
// Should be: true

threeRenderer;
// Should be: ThreeRenderer object

threeRenderer.scene.children;
// Should show: lights, groups, test mesh

threeRenderer.holeMeshMap.size;
// Should show: number of holes loaded

// Force a re-render
drawData(allBlastHoles);
```

## Troubleshooting

### If No Console Messages

**Problem**: `drawData()` isn't being called

**Check**:

```javascript
// Manually trigger
drawData(allBlastHoles);
```

### If "Canvas not ready" Warning

**Problem**: Canvas element doesn't exist

**Check**:

```javascript
document.getElementById("canvas"); // Should not be null
```

### If Error on Initialization

**Check console for**:

-   Import errors (Three.js not installed?)
-   ThreeRenderer class errors
-   Canvas container missing

**Fix**: Check terminal for npm install completion

### If Test Square Not Visible

**After initialization succeeds**, if you still don't see the red square:

1. **Check camera position**:

```javascript
cameraControls.getCameraState();
// Should show reasonable centroid and scale
```

2. **Force camera reset**:

```javascript
cameraControls.setCameraState(0, 0, 1, 0);
```

3. **Check scene**:

```javascript
threeRenderer.scene.children;
// Should include the test mesh
```

## Next Steps

Once you see the red test square:

1. ✅ **Three.js is working**
2. ✅ **Camera is positioned correctly**
3. ✅ **Layering is correct**
4. Load holes → should see both 2D and Three.js versions
5. Load surface → (next step in migration)
6. Remove test square once verified

## Files Changed

-   `/src/kirra.js`:
    -   Added canvas existence checks to `initializeThreeJS()`
    -   Call `initializeThreeJS()` from `drawData()`
    -   Removed premature DOMContentLoaded initialization
    -   Added console logging for better debugging
