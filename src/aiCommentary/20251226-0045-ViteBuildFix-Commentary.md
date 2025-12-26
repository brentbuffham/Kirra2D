# AI Commentary: Vite Build Deployment Fix
**Date:** 2025-12-26 00:45 AWST  
**Session:** Fixing production build issues for blastingapps.com deployment

---

## Initial Investigation

### What We Found

1. **The dev server works** because Vite serves files directly from source
2. **The build breaks** because:
   - Vite only bundles ES module imports (not script tags)
   - Asset paths use absolute `/` prefix (breaks subdirectory deployment)

### Network Analysis of Production Site

From browser network requests at `blastingapps.com/dist/kirra.html`:

**404 Errors (Critical):**
- `/dist/assets/main-B0wcKCrg.js` - Main JS bundle (stale hash)
- `/dist/src/dialog/contextMenu/HolesContextMenu.js`
- `/dist/src/dialog/contextMenu/SurfacesContextMenu.js`
- `/dist/src/dialog/contextMenu/KADContextMenu.js`
- `/dist/src/dialog/contextMenu/ImagesContextMenu.js`
- `/dist/src/dialog/settings/ThreeDSettingsDialog.js`
- `/dist/src/dialog/contextMenu/ContextMenuManager.js`
- (and 9 more popup dialog files)

**200 OK (Working):**
- CSS file is loading (main-DpZd0ikW.css)
- Image assets are loading correctly
- jscolor.min.js and d3.min.js are loading

### CSS Issue Explanation

The CSS IS loading (status 200), but the visual issue is that without the full JavaScript initialization, some dynamic styles aren't being applied. The oversized icons appear because:
1. The base `button img { width: 24px; height: 24px; }` rule IS in the CSS
2. But without the context menu modules loading, JS errors break execution
3. This may prevent some CSS classes from being applied correctly

---

## Solution Approach: Option B

We're converting the 15 traditional script tags to ES module imports because:

1. **Better bundling** - Vite will tree-shake and optimize
2. **Cleaner architecture** - All JS goes through one entry point
3. **Proper dependency resolution** - No race conditions on load order
4. **Future-proof** - Ready for Tauri/native app migration

### Why Not Option A?

Option A (public folder with raw JS files) would:
- Require maintaining two copies of files
- Not benefit from Vite's optimizations
- Keep legacy script tag pattern
- Make Tauri migration harder later

---

## Implementation Notes

### Step 1: vite.config.js Change

Adding `base: './'` changes asset paths from:
```html
<!-- Before (absolute) -->
<link rel="stylesheet" href="/assets/main-xxx.css">

<!-- After (relative) -->
<link rel="stylesheet" href="./assets/main-xxx.css">
```

This ensures assets load correctly from any subdirectory.

### Step 2: Module Conversion Pattern

Each dialog file needs to:
1. Export its functions properly
2. Be imported in kirra.js
3. Have its script tag removed from kirra.html

Example conversion:
```javascript
// Before in HolesContextMenu.js:
function holesContextMenu(event) { ... }

// After (add export):
export function holesContextMenu(event) { ... }

// In kirra.js (add import):
import { holesContextMenu } from "./dialog/contextMenu/HolesContextMenu.js";
```

### Step 3: Window Global Exposure

Many functions are called via `window.functionName()`. After import, we need to expose them:
```javascript
// After importing
window.holesContextMenu = holesContextMenu;
```

Or better: refactor callers to not rely on window globals (future cleanup).

---

## Technical Details

### Current kirra.js Import Structure (Lines 1-128)

The file already uses ES modules extensively:
- Three.js and related modules
- Dialog modules (FloatingDialog, TreeView)
- Drawing modules
- Print modules
- Toolbar modules

Adding 15 more imports follows the established pattern.

### Files That Expose Window Globals

Based on code search, these modules set `window.*` properties:
- HolesContextMenu.js - context menu functions
- KADContextMenu.js - KAD editing functions
- ContextMenuManager.js - menu routing
- All popup dialogs - various show* functions

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Import order issues | Low | Vite handles dependency resolution |
| Missing exports | Medium | Test each module after conversion |
| Window global breaks | Medium | Verify window assignments exist |
| Dev mode regression | Low | Test dev mode after changes |

---

## Next Steps

1. Modify vite.config.js (add base path)
2. Create public/ folder with libs/
3. Convert each dialog module to ES module pattern
4. Update kirra.js with imports
5. Remove script tags from kirra.html
6. Build and test

---

## Session Progress

- [x] Analyzed production deployment issues
- [x] Identified root causes
- [x] Created plan document
- [x] Implementing Phase 1 (vite.config.js) - Added `base: './'`
- [x] Implementing Phase 2 (module conversion) - 15 modules converted
- [x] Implementing Phase 3 (static assets) - public/libs/ created
- [x] Testing and verification - Local test successful!

---

## Final Implementation Notes (2025-12-26 01:05)

### Issue Resolution

The original issue was caused by:
1. **Absolute paths** in built assets (solved with `base: './'`)
2. **Non-bundled scripts** (solved with ES module imports)

### Key Learning: Side-Effect Imports

We discovered that kirra.js has many functions with the same names as those in the dialog modules. To avoid "Identifier already declared" errors during bundling, we switched from named imports to side-effect imports:

```javascript
// Instead of this (causes duplicate identifier errors):
import { showErrorDialog, ... } from "./dialog/popups/error/ErrorDialogs.js";

// We use this (imports module for side effects only):
import "./dialog/popups/error/ErrorDialogs.js";
```

This works because each module already has `window.functionName = functionName` at the bottom, making functions globally available.

### Deployment Instructions

1. Run `npm run build` to generate the dist folder
2. Upload the entire `dist/` folder contents to blastingapps.com
3. Ensure the folder structure is preserved:
   - `dist/kirra.html` -> `blastingapps.com/dist/kirra.html`
   - `dist/assets/` -> `blastingapps.com/dist/assets/`
   - `dist/libs/` -> `blastingapps.com/dist/libs/`

### Verified Working
- CSS loads correctly
- Icons are properly sized
- JavaScript bundles load
- All dialog modules work through window globals

