# HUD Overlay Sidebar Shift Implementation
**Date:** 2026-01-09 15:00  
**Task:** Make HUD legends and status panels shift with the left side nav when it opens

## Problem
The HUD overlay panels (Stats, Legend, Surface Legend, Status) were getting covered by the left side nav when it opened. The user requested they should shift to the right like the toolbar does.

## Solution Overview
Implemented the same sidebar shift pattern used by the toolbar:
1. Added `updateSidebarState()` method to HUDOverlay.js
2. Called this method from kirra.js when sidebar opens/closes
3. Added CSS rules to shift left-side HUD panels 350px right when sidebar is open
4. Mobile responsive - panels stay in original position on screens < 1024px

## Files Modified

### 1. `/src/overlay/HUDOverlay.js` (Lines 136-149)
**Added:**
```javascript
// Step 9) Handle sidebar state changes (shift HUD panels when sidebar opens)
export function updateSidebarState(sidebarOpen) {
	if (!hudContainer) return;
	
	// Step 9a) Only adjust on desktop (not mobile)
	var isMobile = window.matchMedia("(max-width: 1024px)").matches;
	if (!isMobile) {
		if (sidebarOpen) {
			hudContainer.classList.add("sidebar-open");
		} else {
			hudContainer.classList.remove("sidebar-open");
		}
	}
}
```

**Purpose:** Adds/removes `sidebar-open` class on HUD container when sidebar state changes.

### 2. `/src/overlay/index.js` (Line 16)
**Added:**
```javascript
export { 
    initHUD, 
    clearHUD, 
    destroyHUD, 
    getHUDContainer,
    isHUDInitialized,
    setHUDVisible,
    updateSidebarState  // NEW: Export sidebar state handler
} from "./HUDOverlay.js";
```

**Purpose:** Export new function for use in kirra.js

### 3. `/src/kirra.js`
**Location 1 - Import (Line 121):**
```javascript
import {
	initHUD,
	updateSidebarState as updateHUDSidebarState,  // NEW: Import as alias
	OverlayEventBus,
	OverlayEvents,
	// ... rest of imports
```

**Location 2 - openNavLeft() (After line 29858):**
```javascript
	// Update toolbar position using ToolbarPanel class
	if (toolbarPanel) {
		toolbarPanel.updateSidebarState(true);
	}
	
	// Step #) Update HUD overlay position
	updateHUDSidebarState(true);  // NEW: Shift HUD panels right
}
```

**Location 3 - closeNavLeft() (After line 29882):**
```javascript
	// Update floating toolbar position
	if (toolbarPanel) {
		toolbarPanel.updateSidebarState(false);
	}
	
	// Step #) Update HUD overlay position
	updateHUDSidebarState(false);  // NEW: Shift HUD panels back
}
```

**Purpose:** Call HUD sidebar state handler when sidebar opens/closes.

### 4. `/src/kirra.css` (Lines 3336-3382)
**Added CSS rules after `.hud-panel` base styles:**

```css
/* Step 2) Base panel styles */
.hud-panel {
    position: absolute;
    pointer-events: auto;
    color: #ffffff;
    /* ... other styles ... */
    /* Step 2a) Add smooth transition for sidebar shifts */
    transition: left 0.5s ease;
}

/* Step 2b) When sidebar is open, shift left-side panels to the right */
.hud-overlay.sidebar-open .hud-stats {
    left: 360px !important;
    /* Shift stats panel right by sidebar width + gap */
}

.hud-overlay.sidebar-open .hud-legend {
    left: 358px !important;
    /* Shift legend panel right by sidebar width + gap */
}

.hud-overlay.sidebar-open .hud-surface-legend {
    left: 358px !important;
    /* Shift surface legend panel right by sidebar width + gap */
}

/* Step 2c) Mobile - don't shift panels when sidebar opens */
@media (max-width: 1024px) {
    .hud-overlay.sidebar-open .hud-stats {
        left: 10px !important;
        /* Keep original position on mobile */
    }

    .hud-overlay.sidebar-open .hud-legend {
        left: 8px !important;
        /* Keep original position on mobile */
    }

    .hud-overlay.sidebar-open .hud-surface-legend {
        left: 8px !important;
        /* Keep original position on mobile */
    }
}
```

**Purpose:** Shift left-side HUD panels when sidebar-open class is applied.

## Technical Details

### Sidebar Width
- Sidebar width: **350px**
- Panel shift: **358-360px** (sidebar width + small gap)
- Matches toolbar shift pattern: `left: 350px`

### Affected Panels
1. **Stats Panel** (`.hud-stats`) - Bottom left
   - Default position: `left: 10px`
   - Sidebar open: `left: 360px`

2. **Legend Panel** (`.hud-legend`) - Left side
   - Default position: `left: 8px`
   - Sidebar open: `left: 358px`

3. **Surface Legend Panel** (`.hud-surface-legend`) - Left side
   - Default position: `left: 8px`
   - Sidebar open: `left: 358px`

### NOT Affected
- **Status Panel** (`.hud-status`) - Top center (uses `left: 50%` with `translateX(-50%)`)
- This panel is centered and doesn't need adjustment

### Animation
- Smooth transition: `transition: left 0.5s ease;` (matches toolbar timing)
- Transition synchronized with sidebar animation

### Mobile Behavior
- On screens < 1024px wide:
  - `sidebar-open` class is NOT applied (JavaScript check)
  - CSS media query provides fallback to keep panels in original position
  - Sidebar behavior is different on mobile (overlays instead of pushing content)

## Testing Checklist

### Desktop (> 1024px)
- [ ] Open left sidebar - panels shift right smoothly
- [ ] Close left sidebar - panels return to original position
- [ ] Panels don't overlap with sidebar when open
- [ ] Animation is smooth (0.5s)
- [ ] All three left-side panels shift correctly

### Mobile (< 1024px)
- [ ] Open left sidebar - panels stay in original position
- [ ] Close left sidebar - no unexpected behavior
- [ ] Sidebar overlays content (doesn't push)

### Edge Cases
- [ ] Rapid sidebar toggle - no animation glitches
- [ ] Page reload with sidebar open - correct panel position
- [ ] Window resize across mobile/desktop breakpoint

## Pattern Used
This implementation follows the **existing toolbar shift pattern**:
1. JavaScript adds/removes `sidebar-open` class on container
2. CSS uses class selector to shift positions with transition
3. Mobile media query overrides for different behavior
4. Consistent with existing codebase architecture

## Related Code
- **Toolbar shift:** `/src/toolbar/ToolbarPanel.js` (lines 147-157)
- **Toolbar CSS:** `/src/kirra.css` (lines 3292-3304)
- **Sidebar functions:** `/src/kirra.js` - `openNavLeft()`, `closeNavLeft()`

## Notes
- No template literals used (per user rules)
- Step comments added for code clarity
- Factory pattern maintained (reusing existing sidebar notification system)
- No code bloat - follows established patterns
