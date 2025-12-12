# WebGL Retry Storm Fix
**Date**: 2025-12-11 16:30
**Status**: ✅ COMPLETE

## Critical Issue

### Problem: Infinite Retry Loop Creating Hundreds of WebGL Context Attempts

**Symptoms:**
- Console flooded with hundreds of "Failed to create WebGL context" errors
- Error repeats on every mouse move
- Browser completely frozen/unresponsive
- `threeInitializationFailed` flag not preventing retries

**Root Cause:**
In `drawData()` function (line 21673), the code was calling `initializeThreeJS()` without checking the `threeInitializationFailed` flag:

```javascript
// BEFORE - BROKEN:
// Step 0) Initialize Three.js on first draw
if (!threeInitialized) {
    initializeThreeJS();  // ← Retries forever if failed!
}
```

**Why This Happened:**
1. WebGL contexts exhausted (from previous sessions or large OBJ)
2. ThreeJS initialization fails → sets `threeInitializationFailed = true`
3. BUT `drawData()` only checks `!threeInitialized`, not the failure flag
4. Every mouse move calls `drawData()`
5. `drawData()` tries to initialize ThreeJS again → fails → repeats
6. Result: **Hundreds of initialization attempts per second**

## The Fix

**File:** `src/kirra.js` line 21673

**Changed:**
```javascript
// AFTER - FIXED:
// Step 0) Initialize Three.js on first draw
if (!threeInitialized && !threeInitializationFailed) {
    initializeThreeJS();
}
```

**Impact:**
- ✅ Respects the `threeInitializationFailed` flag
- ✅ Prevents retry storm on mouse move
- ✅ One failure = no more attempts (until page reload)
- ✅ Browser remains responsive even if WebGL unavailable

## Complete Context Exhaustion Solution

### Summary of All Fixes

1. **Flattened Image Persistence** (prevents redundant context creation)
   - Save flattened image data URL to IndexedDB
   - Load from DB instead of recreating with WebGL
   - Eliminates offscreen renderer creation on reload

2. **WebGL Availability Checks** (prevents context creation when unavailable)
   - Check `threeInitialized` before creating offscreen renderer
   - Check `threeInitializationFailed` before creating offscreen renderer
   - Skip flattening if ThreeJS not ready

3. **Retry Storm Prevention** (THIS FIX)
   - Check `threeInitializationFailed` in `drawData()`
   - One failure = no more retry attempts
   - Prevents hundreds of failed context creation attempts

4. **Comprehensive Loading Progress** (user feedback)
   - Shows all data types being loaded
   - Progress bar with detailed status
   - "Start Fresh" button to clear and restart

## User Instructions

### If You See This Error:

**Symptoms:**
- "Failed to create WebGL context"
- "FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS"
- App appears frozen or unresponsive

**Solution:**
1. **Close browser completely** (all windows, all tabs)
2. **Reopen browser**
3. **Load Kirra app**
4. If problem persists:
   - Click "Start Fresh" in loading dialog
   - OR clear IndexedDB data manually

### Why Closing Browser is Necessary:

WebGL contexts are **browser-wide**, not per-tab. They persist until:
- Browser closes completely
- GPU driver releases them (unpredictable timing)
- System restart

Simply refreshing the tab does NOT release contexts!

## Technical Details

### Browser WebGL Context Limits:
- Firefox/Chrome: **8-16 contexts** across ALL tabs
- Each `new THREE.WebGLRenderer()` = 1 context
- Contexts include:
  - Main scene renderer
  - Offscreen renderers (texture flattening)
  - Other tabs with WebGL content
  - Browser DevTools (if using canvas inspector)

### Context Creation Points in Kirra:
1. **Main renderer**: `initializeThreeJS()` → `new ThreeRenderer()` → `new THREE.WebGLRenderer()`
2. **Offscreen renderer**: `flattenTexturedMeshToImage()` → `new THREE.WebGLRenderer()`
3. **Multiple attempts**: If retry storm not prevented → hundreds of failed attempts

### Why Retry Storm Was So Bad:
```
Mouse Move (every 16ms)
  ↓
drawData()
  ↓
initializeThreeJS() (no flag check)
  ↓
new THREE.WebGLRenderer() → FAIL
  ↓
threeInitializationFailed = true (but drawData doesn't check it!)
  ↓
Next Mouse Move (16ms later)
  ↓
REPEAT → 60 failures per second → Browser freeze
```

## Prevention for Future

### Developer Checklist:

When adding any WebGL-dependent code:

1. ✅ Check `threeInitialized` before using ThreeJS features
2. ✅ Check `threeInitializationFailed` before attempting initialization
3. ✅ Never create WebGL contexts in loops or event handlers
4. ✅ Always dispose offscreen renderers immediately after use
5. ✅ Cache expensive WebGL operations (like texture flattening)
6. ✅ Provide fallback behavior when WebGL unavailable

### Code Pattern to Follow:

```javascript
// GOOD - Respects both flags
if (!threeInitialized && !threeInitializationFailed) {
    initializeThreeJS();
}

// BAD - Ignores failure flag
if (!threeInitialized) {
    initializeThreeJS();  // ← Will retry forever!
}
```

## Files Modified

1. **src/kirra.js** line 21673 - Added `!threeInitializationFailed` check
2. **src/kirra.js** line 8700-8714 - Save flattened image to IndexedDB
3. **src/kirra.js** line 23990-23996 - Persist flattened image data
4. **src/kirra.js** line 24167-24177 - Load flattened image from DB
5. **src/kirra.js** line 8509-8558 - Added `loadFlattenedImageFromData()` function
6. **src/kirra.js** line 8498-8510 - Conditional flattening with saved data check
7. **src/kirra.js** line 25064-25117 - `loadAllDataWithProgress()` function

## Testing

- [x] Retry storm prevented when WebGL unavailable
- [x] Browser remains responsive after failure
- [x] Console only shows one failure message (not hundreds)
- [x] Mouse moves don't trigger retry attempts
- [x] Flattened image loads from IndexedDB on reload
- [x] No WebGL context created for flattening on reload
- [x] Progress dialog shows all data types
- [x] "Start Fresh" button works
- [x] No linter errors

## Known Limitations

1. **User must close browser** to release exhausted contexts
   - No programmatic way to force release
   - Browser-dependent timing

2. **First load with large OBJ** may still exhaust contexts
   - If multiple tabs open with WebGL
   - Solution: Close other tabs before loading large OBJs

3. **Flattened image only saved after first successful flatten**
   - If first load fails, no saved image
   - Will retry flatten on next reload

## Future Improvements

1. **Detect context exhaustion proactively**
   - Check available contexts before large operations
   - Warn user before loading large OBJs

2. **Lazy flattening**
   - Only flatten when switching to 2D mode
   - Don't flatten on initial load

3. **Context pooling**
   - Reuse single offscreen renderer for all operations
   - Create once, reuse many times

4. **Progressive degradation**
   - Show 3D mesh without flattening if contexts low
   - Offer manual flatten button

---
**Implementation Time**: ~15 minutes
**Complexity**: Low (single line change + existing infrastructure)
**Risk**: None (only adds safety check)
**Impact**: CRITICAL FIX - Prevents browser freeze
**Status**: ✅ PRODUCTION READY

