# Plotly Time Window Inspector - Box Select Disabled

**Date:** 2025-11-25 13:00  
**File Modified:** src/kirra.js  
**Lines Modified:** 19896, 20074, 20078-20145

## Decision

After 5 iterations of attempting to fix Plotly's recursion errors with box select functionality, the pragmatic decision was made to **disable box select mode** entirely.

## Why This Was The Right Choice

### The Problem

Box select (`select2d` mode) in Plotly was causing intractable "too much recursion" errors:

-   Errors in `tinycolor`, `bound01`, `rgbToRgb`, `inputToRGB`
-   Chart would freeze during box selection resize operations
-   Multiple attempted fixes still resulted in failures

### Attempts Made (5 Iterations)

1. ❌ Fixed Y-axis range circular references
2. ❌ Added event throttling
3. ❌ Stopped copying from Plotly data objects
4. ❌ Fixed event handler array reuse
5. ❌ Fixed initial `Plotly.react()` color array
6. ✅ **Disabled box select mode** ← Final solution

### Why Single-Click is Sufficient

-   **Primary use case**: Users select individual time bins to see which holes fire in that window
-   **Single-click works perfectly**: No recursion issues, fast, reliable
-   **Box select was edge case**: Rarely needed for this particular chart
-   **User suggestion**: User proposed disabling it, confirming it's not essential

## Changes Made

### 1. Removed Box Select from Mode Bar (Lines 19896, 20074)

**Before:**

```javascript
modeBarButtonsToRemove: ["lasso2d", "hoverClosestCartesian", "hoverCompareCartesian", "toggleSpikelines"],
modeBarButtons: [["select2d", "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d", "toImage", "pan2d"]]
```

**After:**

```javascript
modeBarButtonsToRemove: ["lasso2d", "select2d", "hoverClosestCartesian", "hoverCompareCartesian", "toggleSpikelines"],
modeBarButtons: [["zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d", "toImage", "pan2d"]]
```

Moved `select2d` from enabled buttons to removed buttons list.

### 2. Removed Box Select Event Handler (Lines 20127-20147)

Completely removed the `plotly_selected` event handler since box selection is now disabled.

### 3. Simplified Color Array Function (Lines 20085-20096)

**Before:** Handled array of selected indices

```javascript
function createFreshColorArray(binCount, selectedIndices = []) {
    const colors = [];
    for (let i = 0; i < binCount; i++) {
        if (selectedIndices.includes(i)) {
            colors.push("lime");
        } else {
            colors.push("red");
        }
    }
    return colors;
}
```

**After:** Handles single selected index

```javascript
function createFreshColorArray(binCount, selectedIndex = -1) {
    const colors = [];
    for (let i = 0; i < binCount; i++) {
        if (i === selectedIndex) {
            colors.push("lime");
        } else {
            colors.push("red");
        }
    }
    return colors;
}
```

### 4. Simplified Selection Handler (Lines 20098-20125)

Now only handles single bin selection instead of multiple bins.

### 5. Updated Event Listener Cleanup (Line 20078)

Removed `plotly_selected` from the cleanup since that event is no longer used.

## Benefits

✅ **No more recursion errors** - Problem completely eliminated  
✅ **Simpler code** - Removed complex multi-selection logic  
✅ **Better performance** - No event throttling overhead for box select  
✅ **Better UX** - Chart is now stable and reliable  
✅ **Maintains core functionality** - Single-click selection works perfectly

## User Feedback

> "I'll just use the single click. Unless there is a better way. I mean that chart tool is mostly awesome"

User confirmed single-click is sufficient for their needs, validating this decision.

## Lesson Learned

Sometimes the best solution is the simplest one: **remove the problematic feature**.

When a feature causes more problems than it solves, and there's a simpler alternative that meets user needs, it's better to disable it than to fight endless bugs. This is especially true with third-party libraries like Plotly where you don't control the internal behavior.

## Available Modes After Change

-   ✅ **Single-click selection** - Select one time bin
-   ✅ **Zoom In/Out** - Zoom chart
-   ✅ **Auto Scale** - Reset view
-   ✅ **Reset** - Reset all interactions
-   ✅ **Export Image** - Save chart as image
-   ✅ **Pan** - Move chart view
-   ❌ **Box Select** - Disabled (was causing recursion errors)
