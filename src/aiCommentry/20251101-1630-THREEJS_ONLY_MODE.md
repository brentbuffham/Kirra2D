# Three.js Only Mode - Toggle Between Dual and Single Rendering

## Feature Overview

Added a toggle checkbox to show **only Three.js rendering** or **both 2D canvas and Three.js** simultaneously. This allows:

-   Visual verification that Three.js rendering is working correctly
-   Comparison between 2D canvas and Three.js rendering
-   Performance testing of Three.js alone
-   Debugging coordinate alignment issues

## Location

**Checkbox**: In the "About" accordion panel in `kirra.html`

```html
<input type="checkbox" id="onlyShowThreeJS" /> <label for="onlyShowThreeJS">Only Show Three.js</label>
```

## Implementation

### 1. Global State Variable (kirra.js Line 338)

```javascript
let onlyShowThreeJS = false; // Toggle to show only Three.js rendering
```

### 2. Event Listener Setup (kirra.js Line 484-503)

```javascript
document.addEventListener("DOMContentLoaded", function () {
    const onlyThreeJSCheckbox = document.getElementById("onlyShowThreeJS");
    if (onlyThreeJSCheckbox) {
        onlyThreeJSCheckbox.addEventListener("change", function () {
            onlyShowThreeJS = this.checked;
            console.log(onlyShowThreeJS ? "🎨 Showing only Three.js rendering" : "🎨 Showing both 2D canvas and Three.js");

            // Update canvas opacity based on toggle
            if (onlyShowThreeJS) {
                canvas.style.opacity = "0"; // Hide 2D canvas completely
            } else {
                canvas.style.opacity = "1"; // Show 2D canvas
            }

            // Redraw to apply changes
            drawData(allBlastHoles);
        });
    }
});
```

### 3. Conditional 2D Canvas Rendering (kirra.js Line 18446-18447)

```javascript
// Step 1a) Only process 2D canvas if not in Three.js-only mode
if (ctx && !onlyShowThreeJS) {
    clearCanvas();
    ctx.imageSmoothingEnabled = false;
    // ... all 2D canvas drawing code ...
}
```

### 4. Always Render Three.js (kirra.js Line 19091-19092)

```javascript
// Step 2) Always render Three.js scene after all geometry is added (regardless of 2D canvas state)
renderThreeJS();
```

**Key Point**: Three.js rendering moved **outside** the `if (ctx)` block so it always executes, whether or not 2D canvas drawing is enabled.

## How It Works

### Dual Mode (Default) - Checkbox Unchecked

```
┌─────────────────────────────────────┐
│ 2D Canvas (z-index: 2)              │ ← Visible (opacity: 1)
│ • Text, labels, UI overlays         │ ← Drawing enabled
│ • Transparent background            │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Three.js Canvas (z-index: 1)        │ ← Visible
│ • Holes, surfaces, geometry         │ ← Always rendering
│ • WebGL rendering                   │
└─────────────────────────────────────┘
```

**Rendering**:

-   2D canvas: ✅ Draws holes, text, UI
-   Three.js: ✅ Renders geometry
-   Result: Both layers visible, Three.js underneath 2D overlay

### Three.js Only Mode - Checkbox Checked

```
┌─────────────────────────────────────┐
│ 2D Canvas (z-index: 2)              │ ← Hidden (opacity: 0)
│ • No drawing performed              │ ← Drawing skipped
│ • Transparent, invisible            │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Three.js Canvas (z-index: 1)        │ ← Visible
│ • Holes, surfaces, geometry         │ ← Always rendering
│ • Pure WebGL visualization          │
└─────────────────────────────────────┘
```

**Rendering**:

-   2D canvas: ❌ Drawing skipped (opacity: 0)
-   Three.js: ✅ Renders geometry
-   Result: Only Three.js visible, no 2D overlay

## Benefits

### 1. Visual Verification

**Use Case**: Verify Three.js rendering is working correctly

-   Check checkbox → Only see Three.js output
-   Confirms geometry is rendering properly
-   No confusion with 2D canvas overlay

### 2. Alignment Testing

**Use Case**: Compare coordinate systems

-   Toggle on/off quickly
-   Compare hole positions between layers
-   Identify any offset or misalignment issues

### 3. Performance Testing

**Use Case**: Measure Three.js performance alone

-   Skip 2D canvas drawing overhead
-   Isolate Three.js rendering performance
-   Test with large datasets

### 4. Development/Debugging

**Use Case**: Develop new Three.js features

-   See only what Three.js renders
-   Test without 2D canvas interference
-   Easier to spot Three.js issues

## User Experience

### Toggling the Checkbox

1. **Check** "Only Show Three.js"

    - 2D canvas fades to transparent (opacity: 0)
    - Console logs: "🎨 Showing only Three.js rendering"
    - View redraws automatically
    - See pure Three.js rendering

2. **Uncheck** "Only Show Three.js"
    - 2D canvas becomes visible (opacity: 1)
    - Console logs: "🎨 Showing both 2D canvas and Three.js"
    - View redraws automatically
    - See both layers overlaid

### Visual Indicators

**Console Messages**:

```
// When checked:
🎨 Showing only Three.js rendering

// When unchecked:
🎨 Showing both 2D canvas and Three.js
```

## Technical Details

### Canvas Opacity vs Display

**Why opacity instead of display:none?**

```javascript
// Using opacity: 0
canvas.style.opacity = "0"; // ✅ Canvas still takes up space, events still work

// NOT using display: none
canvas.style.display = "none"; // ❌ Would break layout and event handling
```

**Reasons**:

-   **Layout preserved**: Canvas dimensions and position unchanged
-   **Event handling**: Mouse events still work correctly
-   **Quick toggle**: Fast transition between modes
-   **No reflow**: Browser doesn't need to recalculate layout

### Drawing Performance

**When onlyShowThreeJS = true**:

-   **2D canvas drawing**: Skipped (entire `if` block bypassed)
-   **Three.js rendering**: Still executes (moved outside conditional)
-   **Performance**: Faster draw cycles (no 2D canvas operations)

**When onlyShowThreeJS = false**:

-   **2D canvas drawing**: Full execution
-   **Three.js rendering**: Full execution
-   **Performance**: Normal dual-layer rendering

### Code Flow

```javascript
drawData(allBlastHoles, selectedHole) {
    // Always: Initialize Three.js
    if (!threeInitialized) initializeThreeJS();

    // Always: Clear Three.js geometry
    clearThreeJS();

    // Conditional: 2D canvas drawing
    if (ctx && !onlyShowThreeJS) {
        clearCanvas();
        // ... draw holes, text, UI ...
    }

    // Always: Render Three.js
    renderThreeJS();
}
```

## Use Cases

### 1. Initial Setup/Testing

**Scenario**: Just implemented Three.js rendering

1. Load holes
2. Check "Only Show Three.js"
3. Verify holes appear correctly
4. Check alignment, sizing, colors
5. Uncheck to compare with 2D canvas

### 2. Debugging Coordinate Issues

**Scenario**: Holes seem offset or misaligned

1. Toggle between modes
2. Note differences in position
3. Check console for coordinate values
4. Adjust local origin or camera settings

### 3. Performance Comparison

**Scenario**: Testing rendering performance

1. Load large dataset (1000+ holes)
2. Check "Only Show Three.js" → measure FPS
3. Uncheck → measure FPS with 2D canvas
4. Compare performance metrics

### 4. Feature Development

**Scenario**: Adding new Three.js feature (e.g., contours)

1. Enable "Only Show Three.js"
2. Develop and test new feature in isolation
3. Uncheck to see how it looks with full UI
4. Iterate until perfect

## Future Enhancements

### Potential Additions

1. **Keyboard Shortcut**: `T` key to toggle Three.js only mode
2. **Visual Indicator**: On-screen badge showing current mode
3. **Performance Stats**: FPS counter in Three.js only mode
4. **Export Options**: Export Three.js rendering as image
5. **Layer Controls**: Individual toggles for different Three.js layers

### Advanced Features

1. **Render Mode Selection**:

    - 2D Canvas Only
    - Three.js Only
    - Both (current default)

2. **Opacity Slider**: Adjust 2D canvas opacity (0-100%)

3. **WebGL Info**: Display renderer info, vertex count, draw calls

## Troubleshooting

### Checkbox Doesn't Respond

**Check**:

```javascript
// In console
document.getElementById("onlyShowThreeJS");
// Should return: <input type="checkbox" id="onlyShowThreeJS">
```

**Fix**: Ensure checkbox exists in kirra.html

### Both Layers Still Visible

**Check**:

```javascript
// In console
canvas.style.opacity; // Should be "0" when checked
onlyShowThreeJS; // Should be true when checked
```

**Fix**: Verify event listener is attached

### Three.js Doesn't Render

**Check**:

```javascript
// In console
threeInitialized; // Should be true
threeRenderer; // Should be ThreeRenderer object
```

**Fix**: Ensure Three.js initialized before toggling

## Files Changed

-   **kirra.html** (Line 2087): Added checkbox in About accordion
-   **src/kirra.js**:
    -   Line 338: Added `onlyShowThreeJS` state variable
    -   Line 484-503: Event listener for checkbox
    -   Line 18446-18447: Conditional 2D canvas rendering
    -   Line 19091-19092: Always render Three.js (moved outside conditional)

## Related Documentation

-   **LOCAL_COORDINATES_FIX.md**: Coordinate system and precision
-   **RESTORATION_FIX.md**: Canvas layering system
-   **THREEJS_TIMING_FIX.md**: Initialization and rendering flow
