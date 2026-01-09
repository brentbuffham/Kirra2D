# Status Panel Position Adjustment
**Date:** 2026-01-09 15:15  
**Updated:** 2026-01-09 15:20 (increased clearance)  
**Task:** Lift status panel to avoid covering view buttons at top center

## Problem
The HUD status panel (top center) was positioned at `top: 6px`, which caused it to overlap with the view option buttons (2D/3D toggle, Reset View, Tree, Settings) that are in the `.top-controls` container at `top: 0` with `height: 80px`.

## Solution (Updated)
Moved the status panel down 79px to clear the entire view buttons area:
- **Original position:** `top: 6px`
- **First attempt:** `top: 46px` (still covering - user reported)
- **Final position:** `top: 85px` (clears the 80px tall .top-controls container)

## File Modified

### `/src/kirra.css` (Line 3387)

**Final Version:**
```css
/* Step 3) Status panel - top center */
.hud-status {
    top: 85px;
    /* Step 3-1) Moved down to 85px to clear .top-controls (height: 80px) and view buttons */
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    background: rgba(0, 0, 0, 0.75);
    padding: 6px 12px;
    border-radius: 4px;
    max-width: 80%;
    white-space: pre-wrap;
}
```

**Previous (Original):**
```css
.hud-status {
    top: 6px;
    /* ... rest same ... */
}
```

## Technical Details

### View Buttons Area
- **Container:** `.top-controls`
- **Position:** `top: 0`, `height: 80px`
- **Z-index:** `1`
- **Contents:** 
  - Reset View button
  - Show Tree button
  - 2D/3D toggle button
  - 3D Settings button

### Status Panel
- **Position:** Top center (horizontally centered with `left: 50%` + `transform: translateX(-50%)`)
- **Z-index:** `100` (via `.hud-overlay`)
- **Purpose:** Display status messages, selection info, tooltips
- **Now clears:** View buttons by 5px vertical gap (85px - 80px = 5px)

### Visual Layout (Top of Screen)
```
0px   ┌─────────────────────────────────────┐
      │   .top-controls (height: 80px)      │
      │   [View Buttons Here]               │
80px  ├─────────────────────────────────────┤
      │   (5px gap)                         │
85px  ├─────────────────────────────────────┤
      │   [Status Panel appears here]       │
      │   .hud-status                       │
      └─────────────────────────────────────┘
```

## Why 85px?
- `.top-controls` height is 80px
- Additional 5px provides minimal but sufficient visual spacing
- Ensures view buttons are fully visible and clickable
- Status panel still high enough to be immediately visible
- Verified by user screenshot showing overlap at 46px

## Related Components
- **View buttons:** Located in `kirra.html` lines 2666-2683
- **Top controls CSS:** `kirra.css` lines 581-594
- **HUD overlay:** `src/overlay/HUDOverlay.js` (status panel created at line 32-34)
- **Status panel logic:** `src/overlay/panels/StatusPanel.js`

## Testing History
- ❌ `top: 6px` - Original position, covered view buttons
- ❌ `top: 46px` - Still covering (user reported with screenshot)
- ✅ `top: 85px` - Clears .top-controls container completely

## Build Status
✅ **Build successful** - no errors

## Notes
- This is a CSS-only change, no JavaScript modifications needed
- Status panel remains horizontally centered
- Z-index hierarchy maintained (HUD overlay at 100, top controls at 1)
- Step comment added for clarity (per user rules)
- Position calculated to clear the full 80px height of .top-controls
