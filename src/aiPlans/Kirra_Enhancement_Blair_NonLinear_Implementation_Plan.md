# Kirra Scaled Heelan Model — Blair Non-Linear Superposition Enhancement Plan

## Context

The existing `ScaledHeelanModel.js` (located at `src/shaders/analytics/models/ScaledHeelanModel.js`) implements Blair & Minchinton's (2006) Scaled Heelan model with Blair's (2008) non-linear superposition for a **single base-primed** detonation front. Kirra supports **multiple primers per hole, each with independent timing**. This plan extends the model to handle arbitrary primer configurations with correct detonation front simulation, collision detection, generalised Em computation, improved toe attenuation, and optional time-animated rendering.

## Reference Papers

- Blair & Minchinton (2006), "Near-field blast vibration models", Fragblast-8
- Blair (2008), "Non-linear superposition models of blast vibration", Int J Rock Mech Min Sci 45, 235–247

## Key Equations

### Blair (2008) Eq. 1 — Non-linear element contribution (base-primed)
```
Em = [m × we]^A − [(m−1) × we]^A
```
where `we` = element mass (kg), `A` = charge exponent, `m` = element initiation order (1-indexed).

### Blair (2008) Eq. 22 — Generalised for any primer position
For a primer at element M1 (from base), with M total elements:
- j = 1: primer element → E1 = we^A
- j = 2 to M1: two elements simultaneously → Ej = [(2j−1)×we]^A − [(2j−3)×we]^A, split between the two
- j = M1+1 to M−M1+1: single element → Ej = [(j+M1−1)×we]^A − [(j+M1−2)×we]^A

### Generalised for arbitrary multi-primer (this plan)
Sort all elements by detonation arrival time. Group simultaneous detonations. Compute Em from cumulative mass in initiation order:
```
Em_group = (cumulativeMass_after)^A − (cumulativeMass_before)^A
Em_per_element = Em_group / groupSize
```
This reduces to Eq. 1 for base-primed, Eq. 22 for mid-primed, and extends naturally to 2+ primers.

### Blair (2008) Eq. 3 — Scaled Heelan amplitude factor
```
vppv_element = K × Em × R^(−B) × F(φ)
```
where K, B are site constants, R = distance, F(φ) = Heelan radiation pattern.

---

## Architecture Overview

```
CPU-side (JavaScript)                    GPU-side (Fragment Shader)
─────────────────────                    ──────────────────────────
DetonationSimulator.js                   ScaledHeelanModel.js (shader)
  ├─ Front propagation                    ├─ Read Em from texture
  ├─ Collision detection                  ├─ Read detTime from texture
  ├─ Element ordering                     ├─ K × Em × R^(-B) × F(φ)
  └─ Em computation                       ├─ Toe confinement model
                                          ├─ Incoherent RMS sum
ElementDataPacker.js                      └─ Optional time filtering
  └─ Pack Em + detTime → texture
```

---

## Phase 1: Detonation Front Simulation (CPU-side)

### File: `src/shaders/analytics/models/DetonationSimulator.js`

Create a new module that takes hole geometry, charge column bounds, primer positions/times, and VOD, and produces a detonation time and Em value for every charge element.

### 1.1 — Input data structure

```javascript
/**
 * @typedef {Object} PrimerInfo
 * @property {number} depthAlongColumn - Distance from top of charge column (m)
 * @property {number} fireTime - Initiation time of this primer (ms)
 */

/**
 * @typedef {Object} ChargeColumnInfo
 * @property {number} chargeTopDepth - Distance from collar to top of charge (m)
 * @property {number} chargeBaseDepth - Distance from collar to bottom of charge (m)
 * @property {number} totalMass - Total explosive mass (kg)
 * @property {number} vod - Velocity of detonation (m/s)
 * @property {number} numElements - Number of discretisation elements (M)
 * @property {Array<PrimerInfo>} primers - One or more primers
 */
```

### 1.2 — Element discretisation

Split the charge column into M equal elements. Element 0 is at the **bottom** of the charge (closest to toe). Each element has:
- `centreDepth`: depth along column from top of charge
- `mass`: totalMass / M
- `detTime`: to be computed
- `Em`: to be computed

```javascript
const dL = chargeLength / numElements;
const elementMass = totalMass / numElements;
const elements = [];

for (let i = 0; i < numElements; i++) {
    // Element 0 = bottom of charge, element M-1 = top of charge
    // Depth measured from top of charge column downward
    const centreDepth = chargeLength - (i + 0.5) * dL;
    elements.push({
        index: i,
        centreDepth,
        mass: elementMass,
        detTime: Infinity,
        Em: 0
    });
}
```

### 1.3 — Front propagation and collision detection

Each primer generates two fronts: one propagating toward the collar (decreasing depth) and one propagating toward the toe (increasing depth). A front is blocked when:
1. It reaches the end of the charge column
2. It meets an opposing front from another primer
3. It hits a deck/air gap (future: for decked charges)

**Collision detection between two inward-facing fronts:**

For primers at depths p1, p2 (p1 < p2) with fire times t1, t2:
```
collisionDepth = (p1 + p2) / 2 + VOD × (t2 − t1) / 2000
```
(divide by 2000 because times in ms, distances in m, VOD in m/s)

If `collisionDepth` is outside the range [p1, p2], the fronts don't collide between these primers (one primer consumes all the column between them before the other front arrives).

**Algorithm:**

```javascript
export function simulateDetonation(column) {
    const { chargeLength, vod, numElements, primers } = column;
    const elements = createElements(column);
    
    // Sort primers by depth
    const sortedPrimers = [...primers].sort((a, b) => a.depthAlongColumn - b.depthAlongColumn);
    
    // For each element, find earliest detonation arrival from any front
    for (const elem of elements) {
        let minTime = Infinity;
        
        for (let pi = 0; pi < sortedPrimers.length; pi++) {
            const primer = sortedPrimers[pi];
            const dist = Math.abs(elem.centreDepth - primer.depthAlongColumn);
            const arrivalTime = primer.fireTime + (dist / vod) * 1000; // ms
            
            // Check if this front is blocked by a collision with an adjacent primer's front
            if (!isFrontBlocked(elem.centreDepth, primer, sortedPrimers, pi, vod)) {
                minTime = Math.min(minTime, arrivalTime);
            }
        }
        
        elem.detTime = minTime;
    }
    
    return elements;
}
```

**Front blocking logic:**

```javascript
function isFrontBlocked(elemDepth, primer, sortedPrimers, primerIndex, vod) {
    // Check collision with the primer above (smaller depth)
    if (elemDepth < primer.depthAlongColumn && primerIndex > 0) {
        const other = sortedPrimers[primerIndex - 1];
        const collisionDepth = (other.depthAlongColumn + primer.depthAlongColumn) / 2
            + vod * (primer.fireTime - other.fireTime) / 2000;
        // Front from 'primer' going upward is blocked if element is above collision point
        if (elemDepth < collisionDepth) return true;
    }
    
    // Check collision with the primer below (larger depth)
    if (elemDepth > primer.depthAlongColumn && primerIndex < sortedPrimers.length - 1) {
        const other = sortedPrimers[primerIndex + 1];
        const collisionDepth = (primer.depthAlongColumn + other.depthAlongColumn) / 2
            + vod * (other.fireTime - primer.fireTime) / 2000;
        // Front from 'primer' going downward is blocked if element is below collision point
        if (elemDepth > collisionDepth) return true;
    }
    
    return false;
}
```

### 1.4 — Em computation from detonation sequence

Once all elements have detonation times:

```javascript
export function computeEmValues(elements, chargeExponent) {
    // Sort by detonation time
    const sorted = [...elements].sort((a, b) => a.detTime - b.detTime);
    
    // Group simultaneous detonations (within VOD timing tolerance)
    // Tolerance: time for detonation to cross half an element
    const tol = sorted.length > 0 
        ? (sorted[0].mass > 0 ? 0.01 : 0.001) // small tolerance in ms
        : 0.001;
    
    const groups = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
        if (Math.abs(sorted[i].detTime - currentGroup[0].detTime) < tol) {
            currentGroup.push(sorted[i]);
        } else {
            groups.push(currentGroup);
            currentGroup = [sorted[i]];
        }
    }
    groups.push(currentGroup);
    
    // Compute Em per group using cumulative mass
    let cumulativeMass = 0;
    for (const group of groups) {
        const groupMass = group.reduce((sum, e) => sum + e.mass, 0);
        const prevMass = cumulativeMass;
        cumulativeMass += groupMass;
        
        const groupEm = Math.pow(cumulativeMass, chargeExponent)
                       - (prevMass > 0 ? Math.pow(prevMass, chargeExponent) : 0);
        
        // Split equally among simultaneously detonating elements
        const emPerElement = groupEm / group.length;
        for (const elem of group) {
            elem.Em = emPerElement;
        }
    }
    
    return elements; // Em values written back to original elements by reference
}
```

### 1.5 — Validation checks

After computation, verify the telescoping sum:
```javascript
const totalEm = elements.reduce((sum, e) => sum + e.Em, 0);
const expected = Math.pow(totalMass, chargeExponent);
console.assert(Math.abs(totalEm - expected) < 1e-6, 
    `Em sum ${totalEm} != expected ${expected}`);
```

This must hold regardless of primer count, positions, or timing. If it doesn't, there's a bug.

---

## Phase 2: Element Data Packing (CPU-side)

### File: `src/shaders/analytics/models/ElementDataPacker.js`

Pack the computed Em and detonation time values into a texture that the fragment shader can read.

### 2.1 — Texture layout

Create a 2D `DataTexture` with:
- **Width** = maxElements (e.g., 64 to match current shader loop limit)
- **Height** = holeCount
- **Format** = RGFloat (two channels per texel)
- **Channel R** = Em value for this element
- **Channel G** = detonation time (ms) for this element

```javascript
export function packElementData(allHoleElements, maxElements, holeCount) {
    // RG float texture: R = Em, G = detTime
    const data = new Float32Array(maxElements * holeCount * 2);
    
    for (let h = 0; h < holeCount; h++) {
        const elements = allHoleElements[h];
        for (let m = 0; m < maxElements; m++) {
            const idx = (h * maxElements + m) * 2;
            if (m < elements.length) {
                // Store in original spatial order (element 0 = bottom)
                data[idx]     = elements[m].Em;       // R channel
                data[idx + 1] = elements[m].detTime;  // G channel
            } else {
                data[idx]     = 0.0;
                data[idx + 1] = -1.0;  // sentinel: no element
            }
        }
    }
    
    return new THREE.DataTexture(
        data,
        maxElements,
        holeCount,
        THREE.RGFormat,
        THREE.FloatType
    );
}
```

### 2.2 — Uniform additions

Add to the shader's uniform set:
```javascript
uElementData: { value: elementDataTexture },
uMaxElements: { value: maxElements },
uDisplayTime: { value: -1.0 }  // -1 = show all (no time filtering)
```

---

## Phase 3: Toe Confinement Model (GPU-side)

### Modifications to: `ScaledHeelanModel.js`

Replace the current hard-coded exponential toe attenuation with a user-selectable confinement model.

### 3.1 — New parameters

Add to `getDefaultParams()`:
```javascript
// Toe attenuation model
toeAttenuationMode: 0,       // 0 = none (Heelan natural), 1 = exponential, 2 = confinement
subDrillLength: 0.0,         // m — sub-drill distance below design floor (0 = auto from hole data)
confinementFactor: 0.7,      // PPV multiplier for fully confined rock below sub-drill (0.0–1.0)
toeDecayLength: 2.0          // m — characteristic decay length beyond sub-drill zone
```

### 3.2 — New uniforms

```javascript
uToeMode: { value: p.toeAttenuationMode },
uSubDrill: { value: p.subDrillLength },
uConfinement: { value: p.confinementFactor },
uToeDecayLen: { value: p.toeDecayLength }
```

### 3.3 — Shader replacement

Replace the existing below-toe attenuation block:

```glsl
// REMOVE this block:
// float belowToe = projOnAxis - holeLen;
// if (belowToe > 0.0) {
//     float decayLen = max(chargeLen * 0.15, holeRadius * 4.0);
//     float att = exp(-belowToe / decayLen);
//     sumEnergy *= att * att;
// }

// REPLACE with:
float projOnAxis = dot(vWorldPos - collarPos, holeAxis);
float belowToe = projOnAxis - holeLen;

if (belowToe > 0.0 && uToeMode > 0) {
    float att = 1.0;
    
    if (uToeMode == 1) {
        // Mode 1: Simple exponential decay (legacy behaviour, now user-tuneable)
        att = exp(-belowToe / uToeDecayLen);
        
    } else if (uToeMode == 2) {
        // Mode 2: Confinement model
        // - Full PPV through sub-drill zone (this rock is meant to be broken)
        // - Gradual transition to confinement factor beyond sub-drill
        // - Accounts for absence of free face below toe
        float beyondSubDrill = max(belowToe - uSubDrill, 0.0);
        if (beyondSubDrill > 0.0) {
            // Asymptotic decay toward confinement factor
            // At beyondSubDrill = 0: att = 1.0 (full PPV)
            // At beyondSubDrill >> toeDecayLen: att → confinementFactor
            att = uConfinement + (1.0 - uConfinement) * exp(-beyondSubDrill / uToeDecayLen);
        }
    }
    
    sumEnergy *= att * att;  // att² because energy ∝ amplitude²
}
```

### 3.4 — Rationale for confinement model

The Heelan analytical model radiates symmetrically above and below the charge column. In reality:
- **Above the charge**: stemming column and free surface vent energy → PPV converts to rock movement
- **Within sub-drill**: fully confined, all energy absorbed as rock damage → high PPV is physical and correct
- **Below sub-drill**: confined rock with no free face → stress waves propagate but with reduced PPV conversion due to absence of free surface boundary condition

The confinement factor (default 0.7) accounts for the reduced displacement response in fully confined rock. Setting it to 1.0 gives no additional attenuation beyond Heelan's natural R^-B decay. Setting it to 0.0 gives full attenuation to zero beyond the sub-drill.

---

## Phase 4: Updated Fragment Shader (GPU-side)

### Modifications to: `ScaledHeelanModel.js` — `getFragmentSource()`

### 4.1 — Add texture sampler and uniforms

```glsl
uniform sampler2D uElementData;   // Per-element Em and detTime
uniform int uMaxElements;          // Width of element data texture
uniform float uDisplayTime;        // Animation time (-1 = all)

// Toe model uniforms
uniform int uToeMode;
uniform float uSubDrill;
uniform float uConfinement;
uniform float uToeDecayLen;
```

### 4.2 — Element data lookup function

```glsl
vec2 getElementInfo(int holeIndex, int elemIndex) {
    float u = (float(elemIndex) + 0.5) / float(uMaxElements);
    float v = (float(holeIndex) + 0.5) / float(uHoleCount);
    return texture2D(uElementData, vec2(u, v)).rg;  // R = Em, G = detTime
}
```

### 4.3 — Modified inner loop

Replace the current Em computation in the fragment shader with a texture lookup:

```glsl
// REMOVE this block from inner loop:
// float mwe = float(m + 1) * elementMass;
// float m1we = float(m) * elementMass;
// float Em = pow(mwe, uChargeExp) - (m1we > 0.0 ? pow(m1we, uChargeExp) : 0.0);

// REPLACE with:
vec2 elemInfo = getElementInfo(i, m);
float Em = elemInfo.x;           // Pre-computed on CPU
float elemDetTime = elemInfo.y;  // ms

// Skip if no element data
if (Em <= 0.0) continue;

// Optional: time filtering for animated display
if (uDisplayTime >= 0.0 && elemDetTime > uDisplayTime) continue;
```

The rest of the inner loop (distance calc, radiation patterns, attenuation, energy accumulation) remains unchanged.

### 4.4 — Fallback behaviour

If `uElementData` is not provided (e.g., for simple single-primer holes where the CPU computation hasn't run), fall back to the current in-shader Em calculation. This can be signalled by `uMaxElements == 0`:

```glsl
float Em;
if (uMaxElements > 0) {
    vec2 elemInfo = getElementInfo(i, m);
    Em = elemInfo.x;
    if (Em <= 0.0) continue;
} else {
    // Fallback: original in-shader computation (base-primed assumption)
    float mwe = float(m + 1) * elementMass;
    float m1we = float(m) * elementMass;
    Em = pow(mwe, uChargeExp) - (m1we > 0.0 ? pow(m1we, uChargeExp) : 0.0);
}
```

---

## Phase 5: Time-Animated Rendering (Optional Enhancement)

### 5.1 — Display time uniform

Add a time slider to the Kirra UI that controls `uDisplayTime`:
- Value = -1.0: show final state (all elements, all holes)
- Value ≥ 0.0: show PPV field at this blast time (ms)

### 5.2 — Per-hole time filtering

In the outer hole loop, also filter by hole initiation time:
```glsl
float holeFireTime = props.y;  // timing_ms from Row 2
if (uDisplayTime >= 0.0 && holeFireTime > uDisplayTime) continue;
```

### 5.3 — Optional amplitude fade-in

For smooth animation, fade element contributions over a short rise time:
```glsl
if (uDisplayTime >= 0.0) {
    float timeSinceDet = uDisplayTime - elemDetTime;
    if (timeSinceDet < 0.0) continue;
    
    // Fade in over ~0.5ms (adjustable)
    float riseFactor = clamp(timeSinceDet / 0.5, 0.0, 1.0);
    vP *= riseFactor;
    vSV *= riseFactor;
}
```

### 5.4 — Animation loop (CPU-side)

```javascript
// In the rendering loop or UI controller:
let currentTime = 0;
const maxTime = getMaxBlastTime(); // latest hole initiation + column burn time

function animate() {
    currentTime += deltaTime * playbackSpeed;
    if (currentTime > maxTime) currentTime = 0; // loop
    
    shaderMaterial.uniforms.uDisplayTime.value = currentTime;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

---

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `src/shaders/analytics/models/DetonationSimulator.js` | **NEW** — Front propagation, collision detection, Em computation | 1 |
| `src/shaders/analytics/models/ElementDataPacker.js` | **NEW** — Pack Em + detTime into GPU texture | 2 |
| `src/shaders/analytics/models/ScaledHeelanModel.js` | **MODIFY** — Add element texture lookup, toe confinement model, time filtering | 3, 4, 5 |
| UI components (panels, sliders) | **MODIFY** — Add toe model controls, time animation slider | 3, 5 |

---

## Testing & Validation

### Unit tests for DetonationSimulator

1. **Single base primer**: Em values should match current in-shader computation exactly. Σ Em = totalMass^A.
2. **Single mid-column primer**: Em values should match Blair Eq. 22. Symmetric elements should have equal Em. Σ Em = totalMass^A.
3. **Single top primer**: Mirror of base-primed case. Σ Em = totalMass^A.
4. **Two primers, same time**: Fronts collide at midpoint. Elements near collision get simultaneous detonation grouping. Σ Em = totalMass^A.
5. **Two primers, different times**: Collision point shifts toward later primer. Verify front blocking logic. Σ Em = totalMass^A.
6. **Three+ primers**: Verify all collision pairs detected correctly. Σ Em = totalMass^A.

### Visual regression tests

1. Single base-primed hole should produce identical PPV field to current shader (fallback path).
2. Mid-primed hole should show symmetric damage lobe (currently asymmetric due to base-primed assumption).
3. Toe attenuation mode 0 (none) should show full Heelan radiation below toe.
4. Time animation at t=0 should show only primer element contribution; at t=max should match static view.

### Telescoping sum invariant

**Critical**: For ANY primer configuration, the sum of all Em values MUST equal totalMass^chargeExponent. This is the fundamental conservation property of Blair's non-linear superposition. Add an assertion that runs on every computation and logs a warning if violated.

---

## Implementation Priority

1. **Phase 1 + 2** (DetonationSimulator + ElementDataPacker): Immediate — fixes physics for multi-primer holes
2. **Phase 3** (Toe confinement model): Quick win — user-tuneable, improves sub-bench damage accuracy
3. **Phase 4** (Shader modifications): Required for Phase 1+2 to take effect on GPU
4. **Phase 5** (Time animation): Enhancement — high visual impact for presentations and design review

---

## Notes for Implementation

- The `uMaxElements` uniform doubling as a fallback flag (0 = use in-shader Em) keeps backward compatibility
- Element data texture uses RGFormat + FloatType — verify Three.js version supports this, otherwise use RGBAFormat and waste two channels
- The 64-element inner loop cap in the shader is sufficient (Blair shows convergence at M ≥ 21)
- The 512-hole outer loop cap may need increasing for large blasts — consider a `#define` or dynamic loop
- All detonation times in the system should use milliseconds for consistency with Kirra's timing model
- VOD is per-hole (from explosive product assignment) with a uniform fallback — this is already handled in the current shader
