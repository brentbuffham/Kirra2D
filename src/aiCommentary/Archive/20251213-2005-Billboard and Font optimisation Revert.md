# Revert Troika Text Optimization and Fix Billboarding

## Summary

This update reverts troika text global optimizations and fixes billboard text rotation to ensure correct label facing during all camera operations.

---

## Changes

### `src/kirra.js`
- **Troika optimization imports** (`configureTextBuilder`, `preloadFont`, `Text`) are now commented out.
- The global `troikaFontBaked` flag is commented out.
- The `optimizeTroikaFont()` function declaration is commented out.
- `initializeThreeJS()` is reverted from `async` to synchronous.
- The call to `await optimizeTroikaFont()` in the initialization sequence is now commented out.

### `src/three/ThreeRenderer.js`
- **Billboard update logic is restored to run on every render frame** (not only on camera rotation).
- The conditional updates that depended on camera rotation changes are removed.
- As a result, text labels now correctly face the camera during scroll/zoom and even when the camera is flat on the XY-plane.

### `src/three/GeometryFactory.js`
- **Per-instance font loading** is restored in `createKADText()` (lines 485-492). 
- A `try/catch` block ensures `Roboto-Regular.ttf` is loaded, with fallback to `Arial` on failure.
- The original per-instance font assignment in `createContourLabel()` is preserved.
- Both text creation functions now load fonts per label rather than using a shared texture atlas.

---

## Impact

- **Performance:** Slightly slower initial label loading due to per-instance font assignment, but ensures correctness.
- **Functionality:** Text always properly billboards toward the camera, including during zoom and when the camera is rotated in the plane.
- **Behavior:** Returns to original approach with one label = one text geometry and font assignment, removing shared texture/atlas dependency.

---

## Files Modified

- `src/kirra.js`
- `src/three/ThreeRenderer.js`
- `src/three/GeometryFactory.js`

