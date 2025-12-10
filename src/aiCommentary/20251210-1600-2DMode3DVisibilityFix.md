# 2D Mode 3D Canvas Visibility Fix

**Date:** 2024-12-10 16:00  
**Issue:** 3D geometry visible below 2D KAD selections on startup  
**Task:** Ensure 3D canvas is properly cleared when in 2D mode

---

## Problem Description

**User Report:**  
"When the KAD objects are selected in 2D on startup, if a KAD is selected, the 3D is seen below it."

**Analysis:**  
Even though the app starts in 2D mode (default), residual 3D geometry from previous sessions or initialization could be visible "behind" the 2D canvas, creating visual confusion when selecting KAD objects.

---

## Root Cause

### Current Behavior:
1. App starts with `onlyShowThreeJS = false` (2D mode) - ✓ Correct
2. `dimension2D-3DBtn` is set to unchecked on startup - ✓ Correct  
3. Change event is dispatched to initialize canvas visibility - ✓ Correct
4. 3D canvas is set to `opacity: 0` and `z-index: 0` - ✓ Correct

### The Issue:
When switching to 2D mode, the 3D canvas was hidden but **not cleared**. This meant:
- If 3D geometry existed from a previous session (stored in Three.js scene)
- Even with `opacity: 0`, there could be visual bleeding or rendering artifacts
- Selection highlighting in 2D might show 3D geometry "underneath"

---

## Solution

### Added 3D Geometry Clearing on Mode Switch

**Location:** src/kirra.js lines ~2503-2515

**Before:**
```javascript
} else {
    // Step 1d) 2D-only mode - show only 2D canvas, hide 3D canvas
    onlyShowThreeJS = false;
    // ... reset camera pan ...
    console.log("🎨 2D-ONLY Mode: ON (3D canvas hidden)");

    if (threeCanvas) {
        threeCanvas.style.zIndex = "0"; // Three.js behind
        threeCanvas.style.opacity = "0"; // Hide 3D canvas
        threeCanvas.style.pointerEvents = "none"; // Don't block events
    }
    // ... rest of 2D setup ...
}
```

**After:**
```javascript
} else {
    // Step 1d) 2D-only mode - show only 2D canvas, hide 3D canvas
    onlyShowThreeJS = false;
    // ... reset camera pan ...
    console.log("🎨 2D-ONLY Mode: ON (3D canvas hidden)");

    // Step 1db) Clear all Three.js geometry when switching to 2D mode
    if (typeof clearThreeJS === "function") {
        clearThreeJS();
        console.log("🧹 Cleared Three.js geometry on switch to 2D mode");
    }

    if (threeCanvas) {
        threeCanvas.style.zIndex = "0"; // Three.js behind
        threeCanvas.style.opacity = "0"; // Hide 3D canvas
        threeCanvas.style.pointerEvents = "none"; // Don't block events
    }
    // ... rest of 2D setup ...
}
```

---

## How It Works

### Mode Switching Flow:

**Switching to 2D Mode (`dimension2D-3DBtn` unchecked):**
1. Set `onlyShowThreeJS = false`
2. Reset camera pan state
3. **NEW:** Call `clearThreeJS()` to remove all 3D geometry
4. Hide 3D canvas (opacity: 0, z-index: 0)
5. Show 2D canvas (opacity: 1, z-index: 2)
6. Reset 2D transform state
7. Show contour overlay
8. Redraw data

**Switching to 3D Mode (`dimension2D-3DBtn` checked):**
1. Set `onlyShowThreeJS = true`
2. Reset camera pan state
3. Show 3D canvas (opacity: 1, z-index: 2)
4. Hide 2D canvas (opacity: 0, z-index: 0)
5. Hide contour overlay
6. Redraw data (which will populate 3D geometry)

---

## Key Functions

### `clearThreeJS()`
- Removes all meshes, lines, points, and text from Three.js scene
- Called at the start of `drawData()` (line 21538)
- **NOW ALSO:** Called when switching to 2D mode
- Ensures no residual 3D geometry exists

### `drawData()`
- Main rendering function
- Always calls `clearThreeJS()` first (line 21538)
- Then conditionally renders based on `onlyShowThreeJS` flag
- If `onlyShowThreeJS = false` → Only 2D canvas draws
- If `onlyShowThreeJS = true` → Only 3D scene draws

---

## Correct Mode Detection

### The Right Way: `onlyShowThreeJS` Flag

✅ **Correct Variable:** `onlyShowThreeJS`  
- Set by `dimension2D-3DBtn` checkbox
- `false` = 2D mode (default)
- `true` = 3D mode

❌ **Wrong Variable:** `isIn3DMode` or camera orbit checks  
- These are developer/diagnostic tools
- NOT meant for production mode switching
- Can cause dual rendering issues

### Why This Matters:

The selection code **correctly** checks `onlyShowThreeJS`:
- 2D selection drawing is inside `if (ctx && !onlyShowThreeJS)` block (line 21540)
- 3D selection drawing is inside `if (onlyShowThreeJS)` block (line 22425)
- This ensures only one mode renders at a time

---

## Testing Recommendations

### Test Case 1: Fresh Startup
1. Close and reopen app
2. Verify app starts in 2D mode
3. Select a KAD object
4. **Expected:** Only 2D selection highlights visible, no 3D geometry underneath

### Test Case 2: Mode Switching
1. Start in 2D mode, select KAD object
2. Switch to 3D mode
3. **Expected:** 3D geometry visible, 2D canvas hidden
4. Switch back to 2D mode
5. **Expected:** Only 2D visible, no residual 3D geometry

### Test Case 3: Multiple Selections
1. In 2D mode, select multiple KAD objects (segment, vertex, whole entity)
2. Verify no 3D geometry visible during any selection
3. Switch to 3D mode
4. Verify 3D geometry appears correctly
5. Switch back to 2D
6. **Expected:** Clean 2D view, no 3D artifacts

### Test Case 4: Session Persistence
1. Work in 3D mode, create complex scene
2. Switch to 2D mode
3. **Expected:** No 3D geometry visible (fully cleared)
4. Reload page
5. **Expected:** Starts in 2D mode with clean canvas

---

## Related Code References

### Initialization (lines 2551-2554):
```javascript
// Step 12) Set initial state (2D visible by default)
dimension2D3DBtn.checked = false;
dimension2D3DBtn.dispatchEvent(new Event("change"));
```

### Main Rendering Guard (line 21540):
```javascript
// Step 1b) Only process 2D drawing if not in Three.js-only mode
if (ctx && !onlyShowThreeJS) {
    // All 2D rendering here
}
```

### 3D Rendering Guard (line 22425):
```javascript
// RULE: Use ONLY the onlyShowThreeJS flag
if (onlyShowThreeJS && threeInitialized) {
    // All 3D rendering here
}
```

---

## Benefits of This Fix

1. **Cleaner Visuals:** No 3D geometry bleeding through in 2D mode
2. **Better Performance:** Clearing 3D geometry frees up GPU memory
3. **Consistent Behavior:** Mode switching now fully cleans up previous mode
4. **User Confidence:** What you see is truly "2D only" or "3D only"
5. **Debugging Easier:** Clear separation between modes makes issues easier to diagnose

---

## Design Philosophy

### Strict Mode Separation

**Core Principle:** When in one mode, the other mode should not exist at all.

- **2D Mode:** 3D canvas hidden AND cleared, no 3D geometry in scene
- **3D Mode:** 2D canvas hidden, no 2D drawing operations

This prevents:
- Visual confusion
- Performance overhead
- Rendering conflicts
- User uncertainty about which mode they're in

---

## Future Considerations

### Potential Enhancements:
1. Add visual indicator showing mode switch is complete
2. Store mode preference in localStorage for persistence
3. Add transition animation when switching modes
4. Implement "hybrid" mode toggle if needed (both visible)

### Warning Signs to Watch For:
- If users report seeing "ghost geometry" in either mode
- If switching modes becomes slow (check clearThreeJS performance)
- If mode doesn't persist correctly across sessions
- If canvas z-index/opacity gets out of sync

---

## Summary

Fixed 3D geometry visibility in 2D mode by:

1. **Adding explicit `clearThreeJS()` call** when switching to 2D mode (line ~2511)
2. **Removing misplaced `highlightSelectedKADThreeJS()` call** from 2D rendering block (line ~22278)

This ensures that:

- ✅ No residual 3D geometry exists when in 2D mode
- ✅ Selected entities don't trigger 3D highlights in 2D mode
- ✅ Mode switching is clean and complete
- ✅ Visual artifacts and confusion are eliminated
- ✅ App correctly uses `onlyShowThreeJS` flag for mode detection
- ✅ Selection highlighting works cleanly in both modes without cross-mode rendering

---

## Follow-up Fix: Selected Entities Showing 3D in 2D Mode

**User Report:** "Actually it is still happening but only on selected entities."

**Root Cause Found:**  
The function `highlightSelectedKADThreeJS()` was being called **inside the 2D rendering block** at line 22278, even though the comment said "Three.js highlights happen in 3D-only block".

**Location:** src/kirra.js line ~22278 (inside `if (ctx && !onlyShowThreeJS)` block)

**Problem Code:**
```javascript
// Step 7) Highlight selected KAD objects in 2D only (no 3D highlights in 2D mode)
// Three.js highlights happen in 3D-only block
highlightSelectedKADThreeJS();  // ← This was calling 3D highlight in 2D mode!
```

**Fix Applied:**
```javascript
// Step 7) Highlight selected KAD objects in 2D mode
// Draw 2D selection visuals only (3D highlights happen in 3D-only block below)
// highlightSelectedKADThreeJS(); // ← REMOVED: This was causing 3D highlights in 2D mode
```

**Correct Location:**  
The function **is still called** at line 22849, which is inside the 3D-only rendering block:
```javascript
// Inside: if (onlyShowThreeJS && threeInitialized) { ... }
// Step 6) Highlight selected KAD objects in Three.js (after KAD drawing)
highlightSelectedKADThreeJS();  // ← CORRECT: Only called in 3D mode
```

**Result:**  
- In 2D mode: Only 2D selection visuals are drawn
- In 3D mode: Only 3D selection highlights are drawn
- No cross-mode rendering for selected entities

