# WebGL Context Exhaustion - User-Facing Solutions

**Date**: 2024-12-06  
**Time**: 16:30  
**Issue**: Browser WebGL context limit exhausted

## Problem

Browsers limit the total number of WebGL contexts (typically 8-16 across ALL tabs). Once exhausted:
- New contexts fail with `FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS`
- Three.js initialization fails
- Texture flattening fails (we added graceful fallback)
- Vector PDF may fail

## Causes

1. **Multiple browser tabs** with WebGL content (other 3D apps, games, etc.)
2. **Previous Kirra sessions** that didn't properly clean up
3. **Print operations** creating temporary renderers
4. **Texture flattening** creating offscreen renderers (fixed to check availability)
5. **Browser not releasing** old contexts fast enough

## Current Protections ✅

1. **Retry Storm Prevention** - `threeInitializationFailed` flag (line 713)
2. **Texture Flattening Check** - `isWebGLAvailable()` checks before creating renderer
3. **Error Dialog** - Shows user-friendly message explaining the issue
4. **Graceful Degradation** - 2D mode continues working
5. **Cleanup on Unload** - `beforeunload` event listener (line 25720)

## User Solutions

### Immediate Fixes (Tell Users):

1. **Refresh the page** (F5) - Releases Kirra's context
2. **Close other tabs** with 3D content (Google Maps 3D, games, etc.)
3. **Close browser and reopen** - Clears all contexts
4. **Try different browser** - Fresh context pool

### System-Level Fixes:

1. **Update graphics drivers** - Old drivers have lower limits
2. **Restart computer** - GPU reset
3. **Disable hardware acceleration** (last resort) - Uses software rendering

## Developer Solutions

### Option A: Add Manual Context Release Button (Recommended)

Add a "Release WebGL Context" button that:
1. Calls `cleanupAllResources()`
2. Waits 100ms
3. Attempts to reinitialize
4. Shows success/failure message

```javascript
function manualContextRelease() {
    console.log("🔄 Manual WebGL context release requested...");
    
    // Step 1) Clean up everything
    cleanupAllResources();
    
    // Step 2) Reset failure flags to allow retry
    threeInitializationFailed = false;
    threeErrorDialogShown = false;
    
    // Step 3) Wait for browser to release context
    setTimeout(function() {
        // Step 4) Attempt reinitialization
        initializeThreeJS();
        
        // Step 5) Check if successful
        if (threeInitialized) {
            showModalMessage("Success", "WebGL context released and reinitialized!", "success");
            drawData(allBlastHoles, selectedHole);
        } else {
            showModalMessage("Still Failed", "WebGL context still unavailable. Try closing other browser tabs with 3D content.", "warning");
        }
    }, 100);
}
```

### Option B: Context Pooling (Complex)

Create a single shared WebGL context and reuse it:
- Main renderer uses primary context
- Texture flattening reuses same context
- Print operations use canvas2D or reuse context

**Pros**: Reduces context count
**Cons**: Complex, may have rendering conflicts

### Option C: Lazy Context Creation (Partial Solution)

Don't create Three.js context until user switches to 3D mode:
- Start in 2D-only mode
- Only create context when clicking "3D" button
- This is already somewhat implemented

## Recommended Implementation

### 1. Improve Error Message

Current message is good, but add specific instructions:

```javascript
const dialog = new FloatingDialog({
    title: "3D Rendering Unavailable",
    message: "WebGL context limit reached. Your browser has exhausted its WebGL context limit. " +
        "This is usually caused by:\n" +
        "• Too many browser tabs with 3D content (Google Maps, games, etc.)\n" +
        "• Previous Kirra sessions not fully closed\n\n" +
        "Quick fixes:\n" +
        "1. Close other tabs with 3D content\n" +
        "2. Click 'Release Context' button below\n" +
        "3. Refresh this page (F5)\n" +
        "4. Close and reopen your browser\n\n" +
        "2D mode will continue working normally.",
    buttons: [
        {
            text: "Release Context",
            action: function() {
                dialog.close();
                manualContextRelease();
            }
        },
        {
            text: "OK",
            action: function() {
                dialog.close();
            }
        }
    ]
});
```

### 2. Add Context Diagnostics

Add a debug function to show context usage:

```javascript
function diagnoseWebGLContexts() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    
    if (!gl) {
        console.log("❌ WebGL not available at all");
        return false;
    }
    
    // Get WebGL info
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        console.log("🎮 GPU Vendor:", vendor);
        console.log("🎮 GPU Renderer:", renderer);
    }
    
    console.log("✅ WebGL available (but may be at limit)");
    
    // Clean up test context
    const loseContext = gl.getExtension("WEBGL_lose_context");
    if (loseContext) {
        loseContext.loseContext();
    }
    
    return true;
}
```

### 3. Add to Settings Panel

Add a "Release WebGL Context" button in the settings/debug panel for power users.

## Why This Keeps Happening

Your workflow likely involves:
1. Loading page → Context 1 (main Three.js)
2. Loading OBJ surface → Context 2 attempt (now gracefully fails)
3. Opening print dialog → Shows vector option
4. Testing prints → May create temporary contexts
5. **Accumulation over time** → Hits limit (8-16 contexts)

## Browser Context Limits

| Browser | Max Contexts | Notes |
|---------|--------------|-------|
| Chrome | 16 | Per process |
| Firefox | 16 | Per process |
| Edge | 16 | Per process |
| Safari | 8 | Per tab |

**Note**: These are TOTAL across all tabs, not per tab!

## Long-Term Solution

The best approach is:
1. ✅ **Keep texture flattening check** (already done)
2. ✅ **Keep retry storm prevention** (already done)
3. ✅ **Keep graceful degradation** (already done)
4. 🔄 **Add manual release button** (recommended)
5. 📝 **Improve error message** with actionable steps
6. 📊 **Add context diagnostics** for debugging

## Quick Fix for Development

When developing, frequently:
1. Close unused tabs
2. Refresh page to release contexts
3. Use browser task manager to kill renderer processes
4. Restart browser every few hours

## Files to Modify

To implement manual release button:
1. `src/kirra.js` - Add `manualContextRelease()` function
2. `src/kirra.js` - Update error dialog with release button
3. `kirra.html` - Add "Release Context" button to settings (optional)

## Current Status

✅ **Protection in place** - Won't retry on failure  
✅ **Texture flattening safe** - Checks availability first  
✅ **User message shown** - Explains the issue  
✅ **2D mode works** - App continues functioning  
⚠️ **Manual release needed** - User must refresh page  

## Implementation Priority

1. **High**: Improve error dialog message with specific steps
2. **Medium**: Add manual context release button to error dialog
3. **Low**: Add diagnostics to settings panel
4. **Future**: Context pooling/reuse architecture

---

**Bottom Line**: This is a **browser limitation**, not a bug. The current protections are good. Adding a manual release button in the error dialog would be the best UX improvement.

