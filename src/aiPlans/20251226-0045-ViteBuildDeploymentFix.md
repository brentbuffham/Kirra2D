# Vite Build Deployment Fix Plan
**Created:** 2025-12-26 00:45 AWST  
**Status:** In Progress  
**Author:** AI Agent

---

## Problem Summary

The Kirra app works perfectly in Vite dev mode but breaks when built for production deployment. The deployed version at `blastingapps.com/dist/kirra.html` has:
- Broken CSS (icons are oversized, layout is wrong)
- Missing functionality (15 dialog script files return 404 errors)
- Potential missing static assets

## Root Cause Analysis

### Issue 1: Absolute Asset Paths
- Vite builds with absolute paths by default (e.g., `/assets/main.css`)
- When deployed to a subdirectory (`/dist/`), these resolve incorrectly
- CSS file requested: `blastingapps.com/assets/main.css` (404)
- Should be: `blastingapps.com/dist/assets/main.css`

### Issue 2: Non-Bundled Script Tags
The following 15 files are loaded via `<script src="...">` tags in kirra.html but NOT bundled by Vite:

**Context Menus:**
- `src/dialog/contextMenu/HolesContextMenu.js`
- `src/dialog/contextMenu/KADContextMenu.js`
- `src/dialog/contextMenu/SurfacesContextMenu.js`
- `src/dialog/contextMenu/ImagesContextMenu.js`
- `src/dialog/contextMenu/ContextMenuManager.js`

**Settings:**
- `src/dialog/settings/ThreeDSettingsDialog.js`

**Popups:**
- `src/dialog/popups/confirm/ConfirmDialogs.js`
- `src/dialog/popups/error/ErrorDialogs.js`
- `src/dialog/popups/info/InfoDialogs.js`
- `src/dialog/popups/generic/PatternGenerationDialogs.js`
- `src/dialog/popups/generic/AddHoleDialog.js`
- `src/dialog/popups/generic/HolePatternDialogs.js`
- `src/dialog/popups/generic/HolePropertyDialogs.js`
- `src/dialog/popups/generic/ExportDialogs.js`
- `src/dialog/popups/generic/KADDialogs.js`

### Issue 3: Static Libraries
- `libs/jscolor.min.js` and `libs/d3.min.js` loaded via script tags
- These need to be in `public/` folder to be copied to dist

---

## Solution: Option B - Full ES Module Refactor

### Phase 1: Fix Vite Configuration
- [x] Identify the issue
- [ ] Add `base: './'` to vite.config.js for relative paths

### Phase 2: Convert Script Tags to ES Modules
- [ ] Import all 15 dialog modules in kirra.js
- [ ] Remove script tags from kirra.html
- [ ] Ensure all modules expose functions via proper exports

### Phase 3: Static Assets Configuration
- [ ] Create `public/` folder
- [ ] Move `libs/jscolor.min.js` to `public/libs/`
- [ ] Move `libs/d3.min.js` to `public/libs/`

### Phase 4: Verification
- [ ] Run `npm run build`
- [ ] Verify dist folder structure
- [ ] Test locally with `npx serve dist`
- [ ] Deploy and test on blastingapps.com

---

## Files to Modify

| File | Change |
|------|--------|
| `vite.config.js` | Add `base: './'` |
| `src/kirra.js` | Add 15 ES module imports |
| `kirra.html` | Remove 15 script tags |

## Files to Create/Move

| Source | Destination |
|--------|-------------|
| `libs/jscolor.min.js` | `public/libs/jscolor.min.js` |
| `libs/d3.min.js` | `public/libs/d3.min.js` |

---

## Future Work: Native App (Tauri/Electron)

### Goal
Enable Kirra to run as a standalone desktop application that works completely offline.

### Option Comparison

| Feature | Tauri | Electron |
|---------|-------|----------|
| Bundle Size | ~3-10 MB | ~150+ MB |
| Memory Usage | Lower (uses system WebView) | Higher (bundles Chromium) |
| Language | Rust backend | Node.js backend |
| Learning Curve | Steeper (Rust) | Easier (JavaScript) |
| Cross-platform | Windows, macOS, Linux | Windows, macOS, Linux |
| File System Access | Native Rust APIs | Node.js fs module |
| Auto-updates | Built-in | electron-updater |

### Recommendation: Tauri
- **Significantly smaller** bundle size (important for distribution)
- **Better performance** and lower memory usage
- **Security-focused** architecture
- Growing ecosystem and community support

### Tauri Migration Steps (Future)
1. Install Tauri CLI and prerequisites
2. Initialize Tauri in the project
3. Configure `tauri.conf.json` for build settings
4. Implement file system APIs for:
   - Loading/saving KAD files
   - Exporting CSV/DXF files
   - Managing user preferences
5. Add offline asset bundling
6. Implement auto-update mechanism
7. Build installers for Windows, macOS, Linux

### Considerations for Tauri-Proofing Now
- Keep file operations abstracted
- Avoid dependencies on server-side features
- Use IndexedDB for local storage where possible
- Ensure all assets can be bundled locally

---

## Progress Log

| Date | Time | Action | Status |
|------|------|--------|--------|
| 2025-12-26 | 00:45 | Plan created | Complete |
| 2025-12-26 | 00:45 | Begin Phase 1 | Complete |
| 2025-12-26 | 00:50 | vite.config.js updated with base: './' | Complete |
| 2025-12-26 | 00:52 | public/ folder created with libs/ | Complete |
| 2025-12-26 | 00:55 | 15 dialog modules converted to ES exports | Complete |
| 2025-12-26 | 01:00 | kirra.js imports added (side-effect style) | Complete |
| 2025-12-26 | 01:00 | 15 script tags removed from kirra.html | Complete |
| 2025-12-26 | 01:03 | Duplicate updatePopup() function commented out | Complete |
| 2025-12-26 | 01:05 | npm run build successful | Complete |
| 2025-12-26 | 01:05 | Local test with npx serve successful | Complete |

## Implementation Summary

### Changes Made

1. **vite.config.js** - Added `base: './'` for relative paths
2. **public/libs/** - Created folder with jscolor.min.js and d3.min.js  
3. **15 Dialog Modules** - Added `export` to all functions
4. **kirra.js** - Added side-effect imports for all dialog modules
5. **kirra.html** - Removed 15 script tags
6. **kirra.js (line 210)** - Commented out duplicate updatePopup() function

### Build Output
- Total build time: ~2 minutes
- Main JS bundle: 10.3 MB (3.4 MB gzipped)
- CSS bundle: 104 KB (39 KB gzipped)
- All assets properly hashed and relative-pathed


