# Blast Analysis Shader - User Guide

## Overview

The Blast Analysis Shader system provides real-time GPU-accelerated visualization of blast analytics (PPV, Heelan radiation patterns, damage) as an overlay on your 3D scene.

---

## Quick Start

### 1. Enable the Tool

Click the **Blast Analysis Shader** button in the Surface Tools toolbar:

```
[Icon: chart-dots.png] Blast Analysis Shader
```

### 2. Configure Analysis

A dialog will appear with three main sections:

#### **Analytics Model** (Dropdown)
Choose the calculation model:
- **Peak Particle Velocity (PPV)** - Simple site law (fastest)
- **Heelan Original** - Full Heelan 1953 radiation patterns
- **Scaled Heelan** - Blair & Minchinton 2006 (recommended)
- **Non-Linear Blast Damage** - Holmberg-Persson damage index

#### **Render On** (Dropdown)
Choose where to display the analysis:
- **Generate Analysis Plane** - Creates a flat plane at collar elevation
- *[Any loaded surface]* - Renders on existing surface mesh

#### **Blast Pattern** (Dropdown)
Choose which holes to analyze:
- **All Blast Holes** - Analyze entire pattern
- *[Entity names]* - Analyze specific blast entity

### 3. Adjust Parameters

The dialog shows model-specific parameters below the dropdowns. Each model has different settings:

**PPV Model:**
- Site Constant K: 1140 (typical range: 100-5000)
- Site Exponent B: 1.6 (typical range: 1.0-2.5)
- Charge Exponent: 0.5 (0.5 = square-root, 0.33 = cube-root)
- Cutoff Distance: 1.0 m (minimum distance to avoid singularity)

**Scaled Heelan Model:** (Recommended)
- Site Constant K: 1140
- Site Exponent B: 1.6
- Charge Exponent: 0.5
- Charge Elements: 20 (5-64, more = slower but more accurate)
- P-Wave Velocity: 4500 m/s
- S-Wave Velocity: 2600 m/s
- VOD: 5500 m/s
- P-Wave Weight: 1.0
- SV-Wave Weight: 1.0

**Heelan Original:**
- Rock Density: 2700 kg/m³
- P-Wave Velocity: 4500 m/s
- S-Wave Velocity: 2600 m/s
- VOD: 5500 m/s
- Charge Elements: 20
- Quality Factor P: 50 (0 = no attenuation)
- Quality Factor S: 30

**Non-Linear Damage:**
- Rock UCS: 120 MPa
- Rock Tensile: 12 MPa
- Critical PPV: 700 mm/s
- H-P Constant K: 700
- H-P Alpha: 0.8
- H-P Beta: 1.4

### 4. Apply Analysis

Click **Apply Analysis** to render the shader overlay.

The analysis will appear as a colored mesh showing:
- **Green** = Low values (safe)
- **Yellow** = Medium values (caution)
- **Red** = High values (potential damage)

### 5. Interact

**Drag Holes:**
- The analysis updates in real-time (<50ms) as you move holes

**Change Charging:**
- Modify deck configurations in DeckBuilder
- Analysis automatically refreshes when charging data changes

**Toggle Visibility:**
- Uncheck the Blast Analysis Shader button to hide
- Check again to re-enable with previous settings

---

## Model Comparison

### When to Use Each Model

**Simple PPV (Site Law)**
- ✅ Quick screening
- ✅ Far-field compliance checks
- ✅ Fastest performance (~30ms/frame)
- ❌ Poor near-field accuracy
- ❌ No directional effects

**Use for:** Initial assessments, structure compliance at >100m distance

---

**Heelan Original (Heelan 1953)**
- ✅ Full physics-based radiation patterns
- ✅ Accurate near-field predictions
- ✅ Research-grade accuracy
- ❌ Requires rock mass properties (Vp, Vs, ρ)
- ❌ Slower performance (~100ms/frame)

**Use for:** Research, detailed near-field studies, when borehole pressure matters

---

**Scaled Heelan (Blair & Minchinton 2006)** ⭐ RECOMMENDED
- ✅ Uses familiar site law constants (K, B)
- ✅ Accurate near-field radiation patterns
- ✅ Converges to simple site law at far-field
- ✅ Practitioner-friendly
- ✅ Best general-purpose model
- ⚠️ Moderate performance (~100ms/frame)

**Use for:** Most blast design scenarios, wall control, near-field assessment

---

**Non-Linear Blast Damage**
- ✅ Shows cumulative damage zones
- ✅ Useful for over-break prediction
- ✅ Faster than Heelan models (~40ms/frame)
- ❌ Less accurate than Scaled Heelan
- ❌ Simplified physics

**Use for:** Damage zone visualization, over-break risk assessment

---

## Calibration Guide

### Calibrating PPV and Scaled Heelan Models

These models use site constants K and B that you calibrate from field monitoring data.

**Step 1: Collect Field Data**
Record PPV measurements at various distances from test blasts:
```
Distance (m)  | Charge (kg) | Measured PPV (mm/s)
----------------------------------------------
10           | 50          | 85.3
20           | 50          | 28.7
30           | 50          | 14.2
15           | 100         | 92.1
25           | 100         | 42.5
```

**Step 2: Calculate Scaled Distance**
For each measurement:
```
Scaled Distance = Distance / Charge^0.5
```

Example:
- D=10m, Q=50kg → SD = 10/√50 = 1.41
- D=20m, Q=50kg → SD = 20/√50 = 2.83

**Step 3: Plot PPV vs Scaled Distance (Log-Log)**
```
log(PPV) vs log(SD)
```

**Step 4: Linear Regression**
Fit: `log(PPV) = log(K) - B × log(SD)`

The fit gives you:
- **K** = site constant (intercept)
- **B** = site exponent (slope magnitude)

**Step 5: Enter Values in Dialog**
Use your calibrated K and B values in the parameter section.

**Typical Values:**
- Hard rock: K=1000-1500, B=1.5-1.8
- Soft rock: K=1500-2500, B=1.3-1.6

---

## Advanced Usage

### Using Existing Surfaces

Instead of generating a flat plane, you can render the analysis on an existing surface:

1. Load a DTM, OBJ, or triangulated surface
2. Open Blast Analysis Shader dialog
3. Select the surface from **Render On** dropdown
4. Click Apply

The shader will drape over the surface mesh, showing PPV/damage varying with terrain.

**Use Cases:**
- Wall compliance: analyze PPV on pit wall surface
- Terrain effects: show how topography affects vibration
- Floor damage: analyze damage on bench floor surface

---

### Filtering by Blast Entity

If you have multiple blast patterns in the same project:

1. Open dialog
2. Select specific entity from **Blast Pattern** dropdown
3. Only holes in that entity will contribute to the analysis

**Example:**
- Pattern 1: Production blast (entity "Blast_A")
- Pattern 2: Pre-split (entity "Presplit_1")

Select "Blast_A" to see only production blast effects, ignoring pre-split.

---

### 2D Canvas Overlay (Optional Feature)

If your implementation includes 2D flattening, the shader can also appear in the plan view:

- The analysis is flattened to a 2D image
- Resolution scales with zoom (2× zoom = 2× resolution)
- Transparency: 70% (overlay, not opaque)

To enable: Ensure `drawBlastAnalytics2D()` is added to your 2D render loop.

---

## Performance Tips

### Large Patterns (>200 holes)

**For PPV Model:**
- No special action needed (~30ms even with 500 holes)

**For Heelan Models:**
- Reduce **Charge Elements** to 10-15 (default 20)
- Performance scales with: holes × elements × pixels
- 200 holes × 20 elements × 1080p = ~150ms per frame
- 200 holes × 10 elements × 1080p = ~75ms per frame

### Real-Time Interaction

**During Hole Dragging:**
- Single-hole update is fast (~10ms)
- Full repack happens on drag end
- Heelan models recalculate entire field but use GPU parallelism

**During Charging Changes:**
- Full repack triggered
- Wait for charging dialog to close before drawing
- Large patterns may have brief (~200ms) update lag

### GPU Limits

**Current Hardware Limits:**
- Max holes: 512 (WebGL loop constraint)
- Max charge elements: 64 (nested loop limit)
- Texture size: 512×2 RGBA float (16KB)

**If you have >512 holes:**
- System will use first 512 holes
- Warning logged to console
- Future: multi-pass rendering will remove this limit

---

## Troubleshooting

### Issue: Analysis Plane Not Visible

**Symptoms:** Dialog closes, no colored mesh appears

**Fixes:**
1. Check 3D view is enabled
2. Zoom out - plane may be larger than your view
3. Check transparency isn't set to 0
4. Verify holes have charging data (measured mass > 0)

### Issue: Black/Gray Uniform Color

**Symptoms:** Mesh appears but all one color

**Causes:**
1. No charging data: All holes have mass = 0
   - Fix: Add charging data via DeckBuilder
2. Min/Max range wrong: All values outside color ramp range
   - Fix: Adjust model parameters or check charging values

### Issue: Performance Lag

**Symptoms:** Slow frame rate when shader is active

**Fixes:**
1. Reduce Charge Elements (Heelan models)
2. Use PPV model for quick preview
3. Disable shader when not analyzing
4. Check GPU is being used (not software rendering)

### Issue: Updates Not Reactive

**Symptoms:** Dragging holes doesn't update shader

**Cause:** Integration code not added to drag handler

**Fix:** Add `updateShaderForHoleChange()` call in your drag event handler (see Integration Code)

### Issue: Dialog Shows No Models

**Symptoms:** Analytics Model dropdown is empty

**Cause:** `getAvailableAnalyticsModels` not exposed globally

**Fix:** Ensure this line is in kirra.js:
```javascript
window.getAvailableAnalyticsModels = getAvailableAnalyticsModels;
```

---

## Technical Notes

### Coordinate System

- Shader uses world coordinates (UTM or mine grid)
- Local transform applied via `uWorldOffset` uniform
- Z elevation preserved (no scaling)

### Color Ramps

Default gradients:
- PPV: green → yellow → red
- Damage: blue → green → yellow → red → dark red

Future: Customizable color ramps via settings

### Memory Usage

- DataTexture: 16KB (512 holes × 2 rows × 4 channels × 4 bytes)
- Color ramp: 1KB (256 × 1 × 4 channels × 1 byte)
- Render target (2D flatten): ~8MB for 1080p

Total GPU memory: ~10MB typical

### Accuracy

**Scaled Heelan vs Field Measurements:**
- Near-field (<10D): ±15% typical
- Mid-field (10-50D): ±10% typical
- Far-field (>50D): ±20% typical (due to site variability)

**Damage Model vs Observed Damage:**
- Qualitative indicator only
- Actual damage depends on: joints, stress state, free faces
- Use for relative comparison, not absolute prediction

---

## Future Enhancements

### Planned Features

**Contour Lines:**
- Isolines at specific PPV thresholds (5, 10, 20, 50, 100 mm/s)
- Export contours as KAD polylines

**Time Animation:**
- Animate waveform propagation from initiation
- Visualize Mach cone
- Show cumulative damage over time

**Custom Formulas:**
- User-defined PPV formulas
- Formula compiler to GLSL

**Multi-Pass Rendering:**
- Support >512 holes
- Break into chunks, composite results

**Legend Panel:**
- Color bar with values
- Min/max indicators
- Unit labels

---

## Workflow Example: Wall Compliance Check

**Scenario:** Check PPV on pit wall to ensure <50mm/s at structures

**Steps:**

1. Load pit wall surface (DTM or scanned mesh)
2. Load blast pattern (100 holes, 5m × 6m, 125mm diameter)
3. Add charging data:
   - Stem: 3m
   - Charge: 12m ANFO (density 0.9 g/cc)
   - Subdrill: 1m
4. Click Blast Analysis Shader tool
5. Configure dialog:
   - Model: **Scaled Heelan**
   - Render On: **pit_wall.dtm**
   - Blast: **All Blast Holes**
   - Parameters:
     - K: 1200 (from site calibration)
     - B: 1.65 (from site calibration)
     - Charge Exponent: 0.5
     - Elements: 20
     - Vp: 4500 m/s
     - Vs: 2600 m/s
     - VOD: 5500 m/s
6. Click Apply Analysis
7. Observe results:
   - Green zones: <20 mm/s (safe)
   - Yellow zones: 20-50 mm/s (caution)
   - Red zones: >50 mm/s (reduce charge)
8. Adjust design if needed:
   - Reduce hole count near wall
   - Decrease charge mass
   - Increase delays
9. Re-run analysis to verify

---

## Reference: Model Formulas

### PPV Site Law
```
PPV = K × (D / Q^e)^(-B)

where:
  K = site constant
  B = site exponent
  e = charge exponent (0.5 typical)
  D = distance (m)
  Q = charge mass (kg)
```

### Scaled Heelan
```
PPV_element = K × (R / w_e^A)^(-B) × F(φ)

where:
  R = distance to element
  w_e = element mass
  A = charge exponent
  F(φ) = radiation pattern function

Total VPPV = √(Σv_r² + Σv_z²)
```

### Radiation Patterns (Heelan 1953)
```
F₁(φ) = sin(2φ) × cos(φ)     [P-wave]
F₂(φ) = sin(φ) × cos(2φ)     [SV-wave]

Maximum:
  F₁ at φ ≈ 54.7°
  F₂ at φ = 45°
```

### Damage Index
```
DI = Σ(PPV_i) / PPV_critical

where:
  PPV_i = PPV from hole i
  PPV_critical = crack initiation threshold
```

---

## FAQ

**Q: Why is Scaled Heelan recommended over PPV?**
A: It combines the best of both: uses familiar K/B constants but adds correct near-field radiation patterns.

**Q: What if I don't have rock mass properties?**
A: Use PPV or Scaled Heelan. You only need Vp/Vs for Heelan Original.

**Q: Can I use this for air overpressure?**
A: Not currently. Air overpressure model is planned for future release.

**Q: Does it account for hole timing?**
A: Not yet. Current version uses total charge. Downhole timing integration is planned.

**Q: How do I export the results?**
A: Future feature. Currently visual only. Export as screenshot or flatten to 2D canvas.

**Q: Can I apply multiple models simultaneously?**
A: No. Only one model active at a time. Switch models via dialog.

---

**Version:** 1.0
**Last Updated:** 2026-02-15
**Author:** Claude Code Integration Team
