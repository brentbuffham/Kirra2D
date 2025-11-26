# Syntax Error Fix & Animation Loop Safeguard

## Date
2025-11-14 18:10

## User Report

"I think there might be something wrong as the popup is not showing and firefox is at 1.29gb memory perhaps another memory leak or something disposed was not cleaned up?

```
Uncaught SyntaxError: redeclaration of const isIn3DMode kirra.js:18811:8
note: Previously declared at line 18696, column 8
```"

Two issues:
1. **Syntax error**: `const isIn3DMode` declared twice
2. **Potential memory leak**: Animation loop might not be stopping properly

## Issue 1: Syntax Error - Duplicate const Declaration

### Problem

I declared `const isIn3DMode` three times in `drawData()`:
- **Line 18479**: Inside hole drawing loop (okay - different scope)
- **Line 18696**: Function level (first declaration)
- **Line 18811**: Function level (DUPLICATE - causes error)

JavaScript doesn't allow redeclaring `const` variables in the same scope.

### Solution

**File**: `kirra.js` (line 18810-18814)

**Before:**
```javascript
// Step 2) Render Three.js scene only when in 3D mode or Three.js-only mode
const isIn3DMode = cameraControls && (cameraControls.orbitX !== 0 || cameraControls.orbitY !== 0);
if (isIn3DMode || onlyShowThreeJS) {
    renderThreeJS();
}
```

**After:**
```javascript
// Step 2) Render Three.js scene only when in 3D mode or Three.js-only mode
// (reuse isIn3DMode variable declared above)
if (isIn3DMode || onlyShowThreeJS) {
    renderThreeJS();
}
```

**Result**: Variable declared once at line 18696, reused at line 18812.

## Issue 2: Animation Loop Safeguard

### Problem

If user starts a new drag while momentum animation is still running, the animation loop continues in the background. This could cause:
- Conflicting camera updates (drag + momentum)
- Animation loop never stops
- Memory leak from infinite `requestAnimationFrame`

### Solution

Added cleanup at the start of `handleMouseDown()` to stop any ongoing animation.

**File**: `CameraControls.js` (lines 166-177)

**Added:**
```javascript
handleMouseDown(event) {
    // Step 16a) Stop any ongoing momentum animation
    if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }

    // Step 16b) Reset velocities
    this.velocityX = 0;
    this.velocityY = 0;
    this.velocityOrbitX = 0;
    this.velocityOrbitY = 0;
    this.velocityRotation = 0;

    // ... rest of function
}
```

**How It Works**:
1. User drags and releases → momentum animation starts
2. Before momentum stops, user drags again
3. `handleMouseDown` cancels the animation frame
4. Resets all velocities to zero
5. User has clean slate for new drag

### Why This Helps

Without this safeguard:
```
User drags (velocity = 0.5)
↓
Release → animation starts
↓
User drags again (while animation running)
↓
Animation still applying velocity 0.5
+ New drag movement
= Weird combined motion
+ Animation never stops properly
= Memory leak
```

With safeguard:
```
User drags (velocity = 0.5)
↓
Release → animation starts
↓
User drags again
↓
handleMouseDown: Cancel animation, reset velocities
↓
Clean new drag, no interference
```

## Memory Leak Analysis

### Potential Causes

1. ✅ **Animation loop not stopping** - FIXED with safeguard
2. ✅ **Three.js geometry not disposed** - Already fixed in previous PR
3. ⚠️ **Too many objects in 3D mode** - Monitor via DevTools
4. ⚠️ **Textures not disposed** - Check CanvasTexture cleanup

### How to Check for Memory Leaks

#### Method 1: Firefox Memory Tool

1. Open Firefox DevTools (F12)
2. Go to **Memory** tab
3. Click **Take snapshot**
4. Interact with app (pan, orbit, zoom)
5. Click **Take snapshot** again
6. Click **Compare** to see memory growth
7. Look for growing arrays or retained objects

#### Method 2: Performance Monitor

1. Open Firefox DevTools → **Performance** tab
2. Click record
3. Interact with app for 30 seconds
4. Stop recording
5. Check **Memory** graph at bottom
6. Should be relatively flat with garbage collection spikes
7. Continuous upward trend = memory leak

### Expected Memory Usage

| Scenario | Expected Memory |
|----------|-----------------|
| Empty project | ~50-100 MB |
| 100 holes | ~150-200 MB |
| 1000 holes | ~300-500 MB |
| 1000 holes + surfaces | ~500-800 MB |
| After clear/reload | Back to ~50-100 MB |

**1.29GB** seems high - might indicate:
- Very large dataset loaded (10,000+ holes?)
- Previous memory not fully cleared
- Need to reload page to release GPU memory

### Memory Cleanup Checklist

✅ **Three.js disposal** - Added in previous PR (disposeObject/disposeGroup)  
✅ **Animation loop cleanup** - Added in this PR (cancelAnimationFrame)  
⚠️ **Canvas textures** - Need to verify CanvasTexture.dispose() calls  
⚠️ **Event listeners** - Verify all listeners removed on cleanup  
⚠️ **Large arrays** - Check if any global arrays growing unbounded

## Testing Verification

### Test Syntax Error Fix

1. **Reload page** in browser
2. **Check console** - no more "redeclaration of const" error
3. **Try Alt+drag** - 3D orbit should work
4. **Check Three.js rendering** - should activate correctly

**Expected**: No syntax errors, 3D mode works perfectly.

### Test Animation Loop Cleanup

1. **Drag quickly** and release
2. **Watch momentum** animation
3. **Before it stops**, **drag again**
4. **Release** - new momentum from second drag
5. **Repeat** several times
6. **Check DevTools** → Performance → Memory graph

**Expected**: Memory flat or slight saw-tooth (GC), no upward trend.

### Test Memory Leak

1. **Open Firefox DevTools** → Memory tab
2. **Take baseline snapshot**
3. **Drag around 100 times** (with momentum)
4. **Take second snapshot**
5. **Compare snapshots**
6. **Look for growth** in:
   - Float32Array (geometries)
   - CanvasTexture
   - requestAnimationFrame

**Expected**: Minimal growth (<50MB), objects properly released.

## Files Modified

### 1. kirra.js
- **Line 18811**: Removed duplicate `const isIn3DMode` declaration

### 2. CameraControls.js
- **Lines 166-177**: Added animation cleanup in `handleMouseDown()`

## If Memory Still High After Fix

### Quick Fixes

1. **Reload page** - Clears all accumulated memory
2. **Close other tabs** - Firefox shares memory across tabs
3. **Check dataset size** - How many holes/surfaces loaded?
4. **Disable 3D temporarily** - Use "Only Show Three.js" to check 2D memory

### Diagnostic Steps

```javascript
// Add to console to check Three.js memory
console.log('Geometries:', window.threeRenderer.scene.children.length);
console.log('Holes group:', window.threeRenderer.holesGroup.children.length);
console.log('Surfaces group:', window.threeRenderer.surfacesGroup.children.length);
console.log('KAD group:', window.threeRenderer.kadGroup.children.length);
```

### If Memory Leak Persists

Check these areas:
1. **CanvasTexture for text** - Are textures being disposed?
2. **Event listeners** - Are they properly removed?
3. **Global arrays** - Are any arrays growing unbounded?
4. **Three.js scene** - Are old objects removed before adding new?

## Summary

✅ **Fixed syntax error** - Removed duplicate const declaration  
✅ **Added animation safeguard** - Stops momentum on new drag  
✅ **Prevents memory leak** - Cancels animation frames properly  
✅ **Better cleanup** - Resets velocities on mouse down  
🔍 **Memory monitoring** - Use Firefox tools to track usage  
📝 **Documentation** - Added memory leak debugging guide

