# 3D Initial Render Fix
**Date**: 2025-11-20 01:30
**Status**: ✅ COMPLETE

## Problem

3D scene was blank on initial data load - geometry only appeared when mouse moved.

### Symptoms:
1. **Blank 3D screen** on fresh load with blast holes
2. **Text only shows** when mouse moves
3. **Console shows** "Three.js scene rendered" but nothing visible
4. **No errors** - just missing initial render

## Root Causes

Found **two separate timing issues** preventing initial render:

### Issue 1: Initialization Race Condition

**Problem**: Data loads BEFORE ThreeJS initializes

**Flow:**
1. User loads CSV file
2. `parseK2Dcsv()` parses data (line 5675)
3. `drawData()` called (line 5692)
4. `drawHoleThreeJS()` checks `!window.threeInitialized` → **early return**
5. No geometry added to scene
6. Later: `initializeThreeJS()` runs on first mouse move
7. ThreeJS ready but geometry was never added
8. Scene is empty until next mouse move triggers redraw

**Timeline:**
```
T+0ms:  File loads → parseK2Dcsv()
T+5ms:  drawData() called
T+6ms:  drawHoleThreeJS() early returns (!threeInitialized)
T+10ms: User moves mouse
T+11ms: initializeThreeJS() completes
T+12ms: drawData() called again
T+13ms: Geometry added
T+14ms: Render happens → NOW VISIBLE
```

### Issue 2: Troika Text Async Loading

**Problem**: Troika text uses async `sync()` without triggering render

**Code in GeometryFactory.js (line 392):**
```javascript
textMesh.sync(() => {
    // Material configured here
    if (textMesh.material) {
        textMesh.material.depthTest = true;
        textMesh.material.depthWrite = false;
        textMesh.material.transparent = true;
    }
    // ❌ NO RENDER REQUEST HERE
});
```

**What Happens:**
1. Text object created and added to scene
2. Font loading starts (async)
3. `drawData()` completes → `renderThreeJS()` called
4. **First render**: Text geometry not ready yet → renders without text
5. Font finishes loading → `sync()` callback runs
6. Text geometry ready **BUT NO RENDER TRIGGERED**
7. Text remains invisible until something else triggers render (mouse move)

**Why Mouse Move Shows Text:**
- Mouse move → `drawData()` → `renderThreeJS()` → triggers render
- By this time, troika sync already completed
- Text geometry exists and renders correctly

## Solutions Implemented

### Fix 1: Redraw After Initialization (kirra.js Line 594-600)

```javascript
console.log("✅ Three.js rendering system initialized");

// Step 10c) If data was already loaded, redraw it now that 3D is ready
if (allBlastHoles && allBlastHoles.length > 0) {
    console.log("🔄 Redrawing existing data in 3D...");
    drawData(allBlastHoles, selectedHole);
}
```

**How it works:**
- After ThreeJS initializes, check if data already exists
- If yes, immediately redraw all geometry
- Ensures geometry is added to scene even if data loaded first

### Fix 2: Render After Troika Sync (GeometryFactory.js Line 405-409)

```javascript
textMesh.sync(() => {
    // Step 5a) Configure material
    if (textMesh.material) {
        textMesh.material.depthTest = true;
        textMesh.material.depthWrite = false;
        textMesh.material.transparent = true;
    }
    
    // Step 5b) Request render after text is ready (troika is async)
    if (window.threeRenderer) {
        window.threeRenderer.requestRender();
    }
});
```

**How it works:**
- After troika finishes font loading and geometry generation
- Callback requests a render
- Text appears immediately when ready

## Timing Comparison

### Before Fix:
```
Load Data → ThreeJS Init → Mouse Move → Render → VISIBLE
   0ms        100ms          500ms      501ms     ✅
   
OR

ThreeJS Init → Load Data → (no render) → Mouse Move → Render → VISIBLE
     0ms          100ms         ...          500ms      501ms     ✅

Text appears on render but may be invisible (troika not synced yet)
```

### After Fix:
```
Load Data → ThreeJS Init → Auto Redraw → Render → VISIBLE
   0ms        100ms           101ms       102ms     ✅
   
OR

ThreeJS Init → Load Data → drawData → Render → (text loading)
     0ms          100ms       101ms     102ms
                                              ↓
                                    Text Sync → Render → TEXT VISIBLE
                                       150ms      151ms      ✅
```

## On-Demand Rendering System

The render loop uses an on-demand approach for performance:

**Render Loop (ThreeRenderer.js Line 428-436):**
```javascript
startRenderLoop() {
    const animate = () => {
        this.animationFrameId = requestAnimationFrame(animate);
        if (this.needsRender) {  // ← Only renders when needed
            this.render();
        }
    };
    animate();
}
```

**When needsRender = true:**
- Geometry added/removed
- Camera moves (pan, zoom, orbit)
- Background color changes
- Axis helper toggled
- **NOW: Troika text syncs** ← NEW

**Benefits:**
- ✅ No continuous rendering (saves battery/GPU)
- ✅ Renders only when scene changes
- ✅ Performance friendly
- ✅ Still responsive to all changes

## Files Modified

### 1. src/kirra.js (Lines 594-600)

**Added**: Auto-redraw after initialization

**Location**: End of `initializeThreeJS()` function

**Purpose**: Handle race condition where data loads before ThreeJS ready

### 2. src/three/GeometryFactory.js (Lines 405-409)

**Added**: Render request after troika sync

**Location**: Inside `createKADText()` sync callback

**Purpose**: Trigger render when async text geometry is ready

## Testing Checklist

✅ **Fresh load with blast holes** - Geometry appears immediately
✅ **Text appears** without mouse move
✅ **Hole labels visible** on initial render
✅ **KAD text visible** on initial render
✅ **No blank screen** on data load
✅ **Performance** - Still on-demand rendering
✅ **No render spam** - Single render per frame regardless of text count
✅ **No linter errors**

## Troika Text Async Behavior

### How Troika Works:

1. **Create Text Object**
   ```javascript
   const textMesh = new Text();
   textMesh.text = "Hello";
   textMesh.fontSize = 16;
   ```

2. **Add to Scene** (immediately)
   ```javascript
   scene.add(textMesh); // ← Text exists but no geometry yet
   ```

3. **Sync Geometry** (async)
   ```javascript
   textMesh.sync(() => {
       // ← Geometry ready NOW
       // Material configured
       // Need to trigger render!
   });
   ```

4. **Font Processing**
   - SDF (Signed Distance Field) generation
   - Glyph layout calculation
   - Texture atlas creation
   - **Takes 10-50ms** depending on text complexity

### Why It's Async:

- **Font loading** - HTTP request for TTF files
- **SDF generation** - Complex computation
- **Web Workers** - Troika uses workers for processing
- **Performance** - Doesn't block main thread

### Multiple Text Objects:

If you create 100 text labels:
- Each calls `sync()` independently
- Each requests render when ready
- `requestRender()` just sets flag = true
- **Only ONE render per frame** (efficient!)

## Performance Impact

### Before:
- **Initial render**: Blank screen
- **User interaction**: Required to show content
- **User perception**: "App is broken"

### After:
- **Initial render**: Full geometry visible
- **Text render**: Appears 10-50ms after geometry
- **User perception**: "App is fast"

### Render Frequency:

**Before fix:**
- Manual trigger only (mouse move)
- 0 FPS when idle
- Inconsistent visibility

**After fix:**
- On-demand (smart triggers)
- 0 FPS when idle (same efficiency)
- Immediate visibility
- Auto-renders when:
  - Data loads
  - Geometry added
  - Text syncs
  - Camera moves

## Known Limitations

1. **Font loading delay** - Text may appear 10-50ms after geometry (acceptable)
2. **Multiple redraws** - Each text sync triggers render (mitigated by frame batching)
3. **No loading indicator** - Users don't see "Loading fonts..." message

## Future Enhancements

### Potential Improvements:
1. **Loading indicator** - Show "Loading fonts..." while troika syncs
2. **Font preloading** - Preload Roboto font at app startup
3. **Batch sync** - Wait for all text to sync before rendering
4. **Progressive render** - Show geometry first, text when ready (already happens!)

### To Preload Fonts:
```javascript
// At app startup
import { preloadFont } from "troika-three-text";
preloadFont(
    { font: "/fonts/Roboto-Regular.ttf" },
    () => console.log("✅ Font preloaded")
);
```

## Related Issues

### WebGL Context Exhaustion (20251120-1930)
- **Related**: That fix prevented retry storm
- **Sequential**: Must fix context exhaustion FIRST
- **This fix**: Assumes WebGL is working

### Troika Text Implementation (20251119-1900)
- **Related**: Introduced async text loading
- **Exposed**: Initialization timing issues
- **This fix**: Completes troika integration

## Common Pitfalls

### Pitfall 1: Forgetting Async Nature
```javascript
// ❌ WRONG - Text won't appear
const text = new Text();
text.text = "Hello";
scene.add(text);
renderer.render(scene, camera); // ← Text has no geometry yet!
```

```javascript
// ✅ CORRECT - Text appears
const text = new Text();
text.text = "Hello";
scene.add(text);
text.sync(() => {
    renderer.render(scene, camera); // ← Now text has geometry
});
```

### Pitfall 2: Not Checking Initialization
```javascript
// ❌ WRONG - Early return if not initialized
function drawText() {
    if (!threeInitialized) return;
    // Text never drawn if called before init
}
```

```javascript
// ✅ CORRECT - Redraw after init
function initThreeJS() {
    // ... initialization ...
    threeInitialized = true;
    
    // Redraw any data that was loaded early
    if (hasData) {
        drawAllGeometry();
    }
}
```

### Pitfall 3: Missing Render Request
```javascript
// ❌ WRONG - Scene changes but no render
scene.add(newMesh);
// ... nothing happens ...
```

```javascript
// ✅ CORRECT - Request render after changes
scene.add(newMesh);
threeRenderer.requestRender();
```

## Code Quality

- ✅ No template literals (per user rules)
- ✅ Step-numbered comments
- ✅ Concise implementation
- ✅ No linter errors
- ✅ Backward compatible
- ✅ Performance optimized

---
**Implementation Time**: ~20 minutes
**Complexity**: Low (simple timing fixes)
**Risk**: None (only adds safety checks)
**Impact**: CRITICAL FIX - Makes 3D visible on load
**Status**: ✅ PRODUCTION READY

