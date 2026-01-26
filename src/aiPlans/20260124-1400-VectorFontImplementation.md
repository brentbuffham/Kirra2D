# Vector Font Implementation Plan - Hershey Simplex for 2D & 3D Text
**Date:** 2026-01-24 14:00
**Author:** AI Agent
**Status:** In Progress

## Overview

Replace text rendering in both 2D canvas and 3D view with Hershey Simplex vector font rendering for:
- **3D:** Improved performance by eliminating Troika SDF overhead
- **2D:** Consistent visual appearance with 3D, infinite zoom quality
- **Both:** Same engineering-style font aesthetic across views

## Performance Benefits

### 3D View (Troika → Vector)

| Metric | Troika (Current) | Vector Font (Proposed) |
|--------|------------------|------------------------|
| 2586 holes text render | 2-5 seconds | <0.5 seconds |
| Draw calls (text only) | ~50-100 | 0 (batched with lines) |
| Memory (text) | 50-100MB | ~2MB |
| FPS during orbit | 15-30 | 60 |
| Sync time per text | ~1ms | 0ms |

### 2D Canvas (Native → Vector)

| Metric | Native ctx.fillText | Vector Font (Proposed) |
|--------|---------------------|------------------------|
| Visual consistency | Different from 3D | Same as 3D |
| Zoom quality | Can blur at extremes | Infinitely sharp |
| Font style | System font | Engineering style |
| Export to DXF | Text entities | Polylines (editable) |

## Implementation Phases

### Phase 1: Create VectorFont.js Module
- **File:** `/src/three/VectorFont.js`
- **Contents:** Hershey Simplex font data (95 ASCII characters)
- **Functions:**
  - `getCharacterLines(char)` - Returns line segments for a character
  - `getTextLines(text, size, anchorX)` - Returns all line segments for text string
  - `hasCharacter(char)` - Check if character is supported

### Phase 2: Add createVectorText() to GeometryFactory
- **File:** `/src/three/GeometryFactory.js`
- **Function:** `createVectorText(x, y, z, text, fontSize, color, anchorX)`
- **Returns:** THREE.LineSegments (not THREE.Group or Troika Text)
- **Features:**
  - Proper text positioning with anchor support (left, center, right)
  - Color as THREE.Color
  - Adds to existing line batch when possible

### Phase 3: Developer Toggle
- **Location:** Developer settings/state
- **Setting:** `useVectorTextIn3D` (boolean, default: false for testing)
- **UI:** Toggle in developer menu

### Phase 4: Update 3D Drawing Functions
- **File:** `/src/draw/canvas3DDrawing.js`
- **Functions to update:**
  - `drawHoleTextThreeJS()` (line 436-447)
  - `drawHoleTextsAndConnectorsThreeJS()` (line 450-581)
  - `drawKADTextThreeJS()` (line 737-764)
- **Logic:** Check `useVectorText` flag, use vector or Troika accordingly

### Phase 5: Update 2D Canvas Drawing Functions
- **File:** `/src/draw/canvasDrawing.js` (or equivalent)
- **Functions to update:**
  - Hole label drawing functions
  - KAD text drawing functions
- **Implementation:**
  - Add `drawVectorText(ctx, x, y, text, size, color, anchor)` function
  - Uses `ctx.beginPath()`, `ctx.moveTo()`, `ctx.lineTo()`, `ctx.stroke()`
  - Respects canvas transform (pan/zoom) automatically

### Phase 6: Testing & Optimization
- Test with large hole datasets (2500+ holes)
- Verify text readability at various zoom levels
- Check billboard behavior (text facing camera)
- Optimize line batching for maximum performance

## Hershey Simplex Font Data

The Hershey Simplex font is public domain, created by Dr. A.V. Hershey at the U.S. National Bureau of Standards in 1967. It consists of:

- **Characters:** 95 ASCII characters (space to tilde, 32-126)
- **Format:** Each character is a list of (x, y) coordinates with pen-up markers
- **Strokes:** All single-line strokes (no filled shapes)
- **Special:** Number "8" is one continuous stroke that crosses itself

### Character Complexity Examples

| Character | Vertices | Strokes | Notes |
|-----------|----------|---------|-------|
| I | 2 | 1 | Single vertical line |
| A | 8 | 3 | Two diagonals + crossbar |
| B | 23 | 3 | Stem + two curves |
| 8 | 29 | 1 | Single continuous figure-8 |
| @ | 55 | 1 | Most complex character |

## File Structure

```
src/
├── three/
│   ├── VectorFont.js          ← NEW: Hershey Simplex data + utilities
│   ├── GeometryFactory.js     ← MODIFY: Add createVectorText()
│   └── ThreeRenderer.js       ← May need billboard updates
├── draw/
│   ├── canvas3DDrawing.js     ← MODIFY: Use vector text conditionally
│   └── canvasDrawing.js       ← MODIFY: Add drawVectorText2D()
├── print/
│   ├── SVGBuilder.js          ← MODIFY: Add createSVGVectorText()
│   └── PrintVectorPDF.js      ← MODIFY: Use vector text for labels
└── kirra.js                   ← MODIFY: Add developer toggle state
```

## Print Module Integration

The VectorFont.js module will provide a `getTextSVGPath()` function that returns an SVG path string for use in PDF/print output. This ensures:

1. **Consistent appearance** - Same font in screen and print
2. **Scalable output** - Vector paths scale without pixelation
3. **Editable in CAD** - Text exports as polylines, not fonts
4. **No font embedding** - No need to embed fonts in PDF

## Fallback Strategy

If a character is not supported by Hershey Simplex:
1. Check `hasCharacter(char)` before rendering
2. Replace unsupported characters with `?` or skip
3. Log warning to console in development mode

## Future Enhancements

1. **2D Canvas Vector Text:** Use same font data for 2D consistency
2. **Relief SingleLine Font:** Add bezier curve support for smoother fonts
3. **Custom Font Loader:** Allow users to load custom vector fonts
4. **Font Caching:** Cache line segment data for repeated strings

## Related Files

- `/src/referenceFiles/BUFF_TextToPolylines_v2.pm` - Perl font reference (your original)
- Paul Bourke's Hershey font documentation: https://paulbourke.net/dataformats/hershey/

## Success Criteria

1. 3D hole labels render 10x faster with 2500+ holes
2. FPS during orbit remains at 60fps
3. Text is readable and properly positioned
4. Toggle works to switch between Troika and Vector text
5. KAD text entities also support vector rendering
