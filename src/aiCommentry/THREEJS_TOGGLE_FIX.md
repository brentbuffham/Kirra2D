# Three.js Toggle Visibility Fix

## Problems Fixed

1. **Both canvases invisible** when "Only Show Three.js" was checked
2. **Spurious "Canvas context not available" warnings** in Three.js-only mode
3. **2D canvas blocking Three.js** even when hidden (z-index issue)

## Root Cause

### Issue 1: Z-Index Blocking

**Original Setup**:

```
2D Canvas: z-index 2 (top)
Three.js:  z-index 1 (bottom)
```

**Problem**: When setting 2D canvas `opacity: 0`, it became invisible but still blocked pointer events and remained on top. Three.js canvas underneath was unreachable.

### Issue 2: Misleading Warning

**Original Code**:

```javascript
if (ctx && !onlyShowThreeJS) {
    // ... 2D drawing ...
} else {
    console.warn("⚠️ Canvas context not available"); // ❌ Triggered when onlyShowThreeJS = true!
}
```

**Problem**: The `else` clause triggered both when:

-   ctx was actually missing (rare, real error)
-   onlyShowThreeJS was true (normal, intentional)

This caused confusing warnings in the console during normal operation.

## Solutions

### 1. Dynamic Z-Index Swapping (kirra.js Line 494-516)

**When "Only Show Three.js" is CHECKED**:

```javascript
// 2D canvas: Move to back and hide
canvas.style.zIndex = "0"; // Behind Three.js
canvas.style.opacity = "0"; // Invisible
canvas.style.pointerEvents = "none"; // Don't block clicks

// Three.js canvas: Move to front
threeCanvas.style.zIndex = "2"; // On top
threeCanvas.style.pointerEvents = "auto"; // Receive clicks
```

**When UNCHECKED** (both visible):

```javascript
// 2D canvas: Restore to front (for text/UI overlay)
canvas.style.zIndex = "2"; // On top
canvas.style.opacity = "1"; // Visible
canvas.style.pointerEvents = "auto"; // Receive clicks

// Three.js canvas: Move to back
threeCanvas.style.zIndex = "1"; // Below 2D
threeCanvas.style.pointerEvents = "auto"; // Receive clicks
```

### 2. Improved Error Handling (kirra.js Line 19105-19111)

**Before**:

```javascript
if (ctx && !onlyShowThreeJS) {
    // ... draw 2D ...
} else {
    console.warn("⚠️ Canvas context not available"); // Misleading!
}
```

**After**:

```javascript
if (ctx && !onlyShowThreeJS) {
    // ... draw 2D ...
} else if (!ctx) {
    // Handle actual missing context (rare)
    console.warn("⚠️ Canvas context not available");
} else if (onlyShowThreeJS) {
    // Three.js-only mode: 2D canvas drawing intentionally skipped
    // This is normal, not an error - no warning needed
}
```

## Layer Visualization

### Dual Mode (Both Visible) - Default

```
┌──────────────────────────────────┐
│ 2D Canvas                        │  z-index: 2 (top)
│ • Text labels, UI overlays       │  opacity: 1 (visible)
│ • Transparent background         │  pointer-events: auto
│ • Can see Three.js through it    │
└──────────────────────────────────┘
              ↓ (transparent, can see through)
┌──────────────────────────────────┐
│ Three.js Canvas                  │  z-index: 1 (below)
│ • Hole geometry, surfaces        │  opacity: 1 (visible)
│ • WebGL rendering                │  pointer-events: auto
└──────────────────────────────────┘
```

### Three.js Only Mode

```
┌──────────────────────────────────┐
│ 2D Canvas                        │  z-index: 0 (back)
│ • Hidden, no drawing             │  opacity: 0 (invisible)
│ • Does not block events          │  pointer-events: none
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Three.js Canvas                  │  z-index: 2 (TOP)
│ • Hole geometry, surfaces        │  opacity: 1 (visible)
│ • Pure WebGL rendering           │  pointer-events: auto
│ • Fully interactive              │
└──────────────────────────────────┘
```

## Console Output

### Normal Operation

**Checking "Only Show Three.js"**:

```
🎨 Showing only Three.js rendering
📊 Layers: Three.js (z:2, top), 2D canvas (z:0, hidden)
```

**Unchecking "Only Show Three.js"**:

```
🎨 Showing both 2D canvas and Three.js
📊 Layers: 2D canvas (z:2, top), Three.js (z:1, below)
```

### No More Spurious Warnings

**Before**: ❌

```
⚠️ Canvas context not available
⚠️ Canvas context not available
⚠️ Canvas context not available
(Multiple warnings when toggling)
```

**After**: ✅

```
(No warnings - silent operation in Three.js-only mode)
```

## Technical Details

### Pointer Events

**Why `pointer-events: none` is critical**:

Even with `opacity: 0`, an element still:

-   Takes up space in layout
-   Blocks mouse/touch events from elements below
-   Prevents clicking through to underlying layers

By setting `pointer-events: none` on the hidden 2D canvas, we ensure:

-   Click events pass through to Three.js canvas
-   Mouse hover works on Three.js geometry
-   Camera controls work correctly

### Z-Index Swapping vs. Display None

**Why swap z-index instead of using `display: none`?**

```javascript
// ❌ Don't use display: none
canvas.style.display = "none";

// ✅ Use z-index swap + opacity + pointer-events
canvas.style.zIndex = "0";
canvas.style.opacity = "0";
canvas.style.pointerEvents = "none";
```

**Reasons**:

1. **No layout reflow**: Browser doesn't recalculate layout
2. **Fast toggle**: Instant switching between modes
3. **Canvas state preserved**: Context and state remain intact
4. **Animations possible**: Can animate opacity if desired

### Drawing Performance

**When onlyShowThreeJS = true**:

-   2D canvas drawing: ❌ Skipped (entire block bypassed at line 18466)
-   Three.js rendering: ✅ Full render (line 19114)
-   Result: Faster frame rates, lower CPU usage

**When onlyShowThreeJS = false**:

-   2D canvas drawing: ✅ Full render
-   Three.js rendering: ✅ Full render
-   Result: Both layers, normal performance

## User Experience

### Expected Behavior

1. **Initial Load**: Both canvases visible (default)
2. **Check "Only Show Three.js"**:
    - 2D canvas disappears instantly
    - Three.js geometry stays visible
    - Can interact with Three.js (pan, zoom, select)
    - No console warnings
3. **Uncheck**:
    - 2D canvas reappears with text/UI
    - Three.js moves to background
    - Both layers visible and interactive

### Visual Confirmation

**Three.js Only Mode**:

-   ✅ Holes visible (circles + lines)
-   ✅ Surfaces visible (if loaded)
-   ❌ No text labels
-   ❌ No UI overlays
-   ✅ Console: "📊 Layers: Three.js (z:2, top), 2D canvas (z:0, hidden)"

**Both Visible**:

-   ✅ Holes visible (both 2D and Three.js)
-   ✅ Text labels (from 2D canvas)
-   ✅ UI overlays (from 2D canvas)
-   ✅ Console: "📊 Layers: 2D canvas (z:2, top), Three.js (z:1, below)"

## Testing

### Quick Test

1. Load holes
2. Check "Only Show Three.js" checkbox
3. **Verify**:
    - Holes visible (Three.js circles + lines)
    - No text labels
    - No "Canvas context not available" warnings
    - Can pan/zoom normally
4. Uncheck checkbox
5. **Verify**:
    - Text labels reappear
    - Both layers visible
    - No visual glitches

### Debug Commands

```javascript
// In browser console:

// Check current mode
onlyShowThreeJS; // Should be true or false

// Check canvas states
canvas.style.zIndex; // "2" (both) or "0" (Three.js only)
canvas.style.opacity; // "1" (both) or "0" (Three.js only)
canvas.style.pointerEvents; // "auto" (both) or "none" (Three.js only)

// Check Three.js canvas
const threeCanvas = document.getElementById("threeCanvas");
threeCanvas.style.zIndex; // "1" (both) or "2" (Three.js only)
threeCanvas.style.pointerEvents; // Always "auto"
```

## Troubleshooting

### Three.js Still Not Visible

**Check**:

```javascript
// Is Three.js initialized?
threeInitialized; // Should be true

// Does Three.js canvas exist?
document.getElementById("threeCanvas"); // Should return canvas element

// Is it visible?
const tc = document.getElementById("threeCanvas");
tc.style.display; // Should NOT be "none"
tc.style.visibility; // Should NOT be "hidden"
tc.style.zIndex; // Should be "2" when only showing Three.js
```

### Both Canvases Visible When Should Show Only Three.js

**Check**:

```javascript
onlyShowThreeJS; // Should be true
canvas.style.opacity; // Should be "0"
canvas.style.zIndex; // Should be "0"
```

**Fix**: Click the checkbox again to toggle state.

### Still Getting "Canvas context not available" Warnings

**Check**: You might be on an older version. Refresh browser to load latest code.

## Files Changed

-   **src/kirra.js**:
    -   Line 494-516: Dynamic z-index swapping and layer management
    -   Line 19105-19111: Improved error handling logic
    -   Added detailed console logging for layer states

## Related Documentation

-   **THREEJS_ONLY_MODE.md**: Original toggle feature documentation
-   **RESTORATION_FIX.md**: Canvas layering system
-   **LOCAL_COORDINATES_FIX.md**: Three.js coordinate system
