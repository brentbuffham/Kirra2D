# Plotly Time Window Inspector Recursion Fix
**Date:** 2025-11-25 12:15 (Updated 12:30, Final 12:45)  
**File Modified:** src/kirra.js  
**Lines Modified:** 19806-20180

## Issue
Time Window Inspector caused "Uncaught InternalError: too much recursion" and script timeout when adjusting the selection box resize handles. The errors occurred in Plotly's internal functions across multiple iterations:
- `isPlainObject`, `handleRangeDefaults`, `handleAxisDefaults` (initial error)
- `tinycolor`, `stringInputToObject`, `coerceFont` (after first fix)
- `tinycolor`, `bound01`, `rgbToRgb`, `inputToRGB` (after second fix)

## Root Causes

### 1. Circular Reference in Y-Axis Range (Line 20023)
**Problem:**
```javascript
range: preserveYRange && currentLayout ? [...currentLayout.yaxis.range] : [0, maxYValue - 0.5]
```
Spreading `currentLayout.yaxis.range` copied Plotly's internal objects which contain circular references, causing infinite recursion in `isPlainObject`.

**Solution:**
Extract only numeric values to create clean array:
```javascript
let yAxisRange = [0, maxYValue - 0.5];
if (preserveYRange && currentLayout && currentLayout.yaxis && currentLayout.yaxis.range) {
    const r0 = Number(currentLayout.yaxis.range[0]);
    const r1 = Number(currentLayout.yaxis.range[1]);
    if (!isNaN(r0) && !isNaN(r1) && isFinite(r0) && isFinite(r1)) {
        yAxisRange = [r0, r1];
    }
}
```

### 2. Event Handler Recursion Loop (Lines 20059-20112)
**Problem:**
- User adjusts selection box
- `plotly_selected` event fires
- Handler calls `drawData()`
- Other code calls `timeChart()` again
- `Plotly.react()` re-triggers `plotly_selected`
- Infinite loop

**Solution:**
Added `isUpdatingTimeChart` flag protection:
```javascript
chart.on("plotly_selected", function (eventData) {
    // ... update colors and selection ...
    
    // Prevent timeChart from being called during drawData
    const wasUpdating = isUpdatingTimeChart;
    isUpdatingTimeChart = true;
    drawData(allBlastHoles, selectedHole);
    isUpdatingTimeChart = wasUpdating;
});
```

### 3. Insufficient Timeout Duration (Line 20114)
**Problem:**
50ms timeout was too short - Plotly's internal processing could take longer, allowing new calls to slip through.

**Solution:**
Increased timeout to 200ms to ensure Plotly completes all internal updates before allowing new `timeChart()` calls.

## Changes Made

### 1. Added Recursion Guard (Line 19806)
```javascript
let isUpdatingTimeChart = false;

function timeChart() {
    if (isUpdatingTimeChart) {
        console.log("⚠️ Preventing recursive timechart call");
        return;
    }
    isUpdatingTimeChart = true;
    // ...
}
```

### 2. Fixed Y-Axis Range Extraction (Lines 19973-19979)
- Extract numeric values only from `currentLayout.yaxis.range`
- Validate values are numbers and finite
- Prevents circular reference copying

### 3. Protected Event Handlers (Lines 20059-20112)
All three event handlers now:
1. Process their events
2. Set `isUpdatingTimeChart = true` before calling `drawData()`
3. Restore previous flag state after
4. Prevents `timeChart()` from running during event handling

### 4. Extended Timeout (Lines 19893, 20124)
- Increased from 50ms to 300ms
- Uses `timeChartUpdateTimer` variable for proper cleanup
- Added timeout for blank chart case
- Ensures Plotly finishes processing before allowing new calls

### 5. Initial Data Color Array (Lines 20050-20057) **THE ACTUAL CULPRIT**
After fixing event handlers, recursion STILL occurred! The issue was in the INITIAL `Plotly.react()` call.

**Problem:** Line 20057 passed `defaultColor` directly to Plotly:
```javascript
const defaultColor = Array(numBins).fill("red");
const data = [{
    marker: {
        color: defaultColor  // ← Plotly modifies this array!
    }
}];
Plotly.react("timeChart", data, layout);
```

When `timeChart()` gets called multiple times (which happens frequently), even though `defaultColor` is recreated each time, Plotly's internal processing of the array creates circular references that persist.

**Solution:** Create a fresh array explicitly for Plotly:
```javascript
// Build fresh array with explicit loop
const initialColors = [];
for (let i = 0; i < numBins; i++) {
    initialColors.push("red");
}

const data = [{
    marker: {
        color: initialColors  // Fresh array, never reused
    }
}];
```

Removed `defaultColor` variable entirely since we now create fresh arrays everywhere.

### 6. Event Handler Color Array Safety (Lines 20073-20180) **ALSO CRITICAL**
After throttling fix, recursion STILL occurred in Plotly's color processing (`tinycolor`, `bound01`).

**Problem 1:** Line 20136 copied colors from Plotly's internal data object:
```javascript
const currentColors = data.points[0].data.marker.color.slice();
```
This `.slice()` was copying Plotly's internal color objects (with circular references).

**Problem 2:** Reusing `defaultColor` or any color array:
```javascript
const newColors = defaultColor.map(...); // defaultColor gets contaminated!
```
Once you pass ANY array to `Plotly.restyle()`, Plotly may modify it internally or store references. Reusing that array causes circular reference issues.

**Solution:** ALWAYS create completely fresh color arrays:
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

// Use in event handlers
const newColors = createFreshColorArray(numBins, selectedHoles);
```

This ensures:
- **No array reuse** - fresh array every time
- **Plain string literals** - "red" and "lime" only
- **No references** to any previous arrays or Plotly internals

### 7. Event Throttling (Lines 20073-20180) **CRITICAL UPDATE**
After initial fix, rapid selection box adjustments still caused timeouts. Added:

**Problem:** Multiple `plotly_selected` events fire in quick succession during resize handle dragging, overwhelming the guard mechanism.

**Solution:**
- Added 100ms throttle timer (`eventThrottleTimer`) to batch rapid events
- Early return in all event handlers if `isUpdatingTimeChart` is true
- Try-catch around `Plotly.restyle` to prevent uncaught errors
- Centralized selection handling in `handleSelection()` function
- Visual feedback (color updates) happens immediately
- Canvas redraw (`drawData`) is throttled to prevent overload

```javascript
function handleSelection(selectedHoles, newColors) {
    if (eventThrottleTimer) {
        clearTimeout(eventThrottleTimer);
    }
    
    eventThrottleTimer = setTimeout(() => {
        // Update selection and redraw
        // ... (throttled to 100ms)
    }, 100);
}
```

## Testing Performed (Multiple Iterations)
**Iteration 1:** Fixed Y-axis range circular refs ❌ Still failed  
**Iteration 2:** Added event throttling ❌ Still failed  
**Iteration 3:** Fixed color copying from Plotly data ❌ Still failed  
**Iteration 4:** Fixed event handler array reuse ❌ Still failed  
**Iteration 5:** Fixed initial `Plotly.react()` color array ✅ **SUCCESS**

Final validation:
✅ Initial selection box draw - works  
✅ Single resize handle adjustment - works  
✅ Multiple rapid resize adjustments - no hang (throttled)  
✅ Rapid dragging for 5+ seconds - stable  
✅ Click selection on bars - works  
✅ Deselect - works  
✅ Empty chart state - works  
✅ Switching between mass/count modes - works  

## Technical Details
- **Recursion Prevention**: Flag-based guard at function entry
- **Circular Reference Fix**: Numeric extraction instead of spread operator
- **Event Isolation**: Protected drawData calls in event handlers
- **Timing Safety**: 200ms buffer for Plotly internal processing

## Prevention Strategy
To prevent similar issues:
1. **Never spread Plotly layout objects** - extract values explicitly to avoid circular references
2. **Never copy from Plotly data objects** - `.slice()` or spread on `data.points[...].data.marker.color` copies internal objects with circular refs
3. **NEVER reuse arrays passed to Plotly** - once an array goes to `Plotly.restyle()`, it's contaminated. Create fresh arrays EVERY time
4. **Always build fresh arrays** - use loops with plain string literals ("red", "lime"), not `.map()` or `.fill()` on existing arrays
5. **Always guard recursive paths** with flags when calling `Plotly.react()`/`Plotly.restyle()`
6. **Protect expensive operations** in Plotly event handlers with throttling/debouncing
7. **Early return in event handlers** if update is already in progress
8. **Wrap Plotly calls in try-catch** to prevent cascading errors
9. **Use adequate timeouts** (300ms+) for complex chart operations
10. **Throttle rapid events** (100ms+) during interactive operations like selection box resizing

## Key Lessons
1. **Event Throttling**: When Plotly fires events during interactive operations (like selection box resize handles), multiple events can fire in milliseconds. Simple flag guards aren't enough - you need **throttling** to batch rapid events.

2. **Never Touch Plotly Internals**: Any time you access Plotly's internal data structures (`chart._fullLayout`, `data.points[].data.*`), you risk copying objects with circular references. Always extract primitive values (numbers, strings) or build fresh arrays from your own data.

3. **Array Contamination** ⚠️ **CRITICAL**: Once you pass an array to `Plotly.restyle()` or `Plotly.react()`, consider it **contaminated**. Plotly may:
   - Modify the array in place
   - Store internal references to it
   - Convert string values to complex objects
   
   **Solution**: Create a completely new array for every Plotly call. Use explicit loops with string literals, not `.map()` or methods on existing arrays.

4. **Symptoms of Circular Reference Issues**:
   - Errors in `isPlainObject`, `tinycolor`, `bound01`, `rgbToRgb`
   - "too much recursion" in color/font/layout processing
   - Works once but fails on subsequent interactions
   - Errors appear only after user interactions (clicks, selections)

