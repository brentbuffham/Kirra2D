# Three.js Material Notes

## Overview

This page documents material choices and known pitfalls for Three.js rendering in Kirra's 3D view. Understanding these constraints prevents visual bugs when adding new 3D features.

---

## Material Types by Usage

| Surface Type | Material | Reason |
|---|---|---|
| Terrain (vertex-colored) | `MeshPhongMaterial` | Responds to scene lighting (ambient + directional) |
| Terrain (textured OBJ) | `MeshPhongMaterial` | Matches MTLLoader output; lighting-aware |
| Image planes (GeoTIFF) | `MeshBasicMaterial` | Unlit — satellite imagery should not be shaded |
| Flyrock shroud | `MeshPhongMaterial` | Must match terrain lighting — see below |
| Blast analysis overlay | `ShaderMaterial` | Custom GLSL for per-pixel analytics |

---

## Flyrock Shroud: MeshPhongMaterial (Not MeshBasicMaterial)

### Problem (2026-02-17)

The flyrock shroud was originally rendered with `MeshBasicMaterial` (unlit). This caused a visual issue:

- **From the lit side**: The shroud looked semi-transparent, terrain visible through it. Acceptable.
- **From the shadow side**: The terrain darkened (Phong shading responds to light direction) but the shroud stayed the same brightness (Basic material is unlit). The shroud appeared opaque and obscured the terrain completely.

### Root Cause

`MeshBasicMaterial` ignores scene lighting entirely — it renders at constant brightness regardless of the light direction. When the terrain underneath uses `MeshPhongMaterial`, the two surfaces respond differently to the camera angle relative to the light source. On the shadow side, terrain goes dark while the unlit shroud stays bright, destroying the transparency effect.

### Fix

Keep the shroud as `MeshPhongMaterial` (created by `GeometryFactory.createSurface()`) and only override the properties needed for correct compositing:

```javascript
if (surfaceData && surfaceData.isFlyrockShroud && surfaceMesh.material) {
    surfaceMesh.material.side = THREE.DoubleSide;
    surfaceMesh.material.transparent = true;
    surfaceMesh.material.depthWrite = false;
    surfaceMesh.renderOrder = 999;
}
```

**Key properties:**
- `side: DoubleSide` — shroud is a dome, must be visible from inside and outside
- `transparent: true` — enable alpha blending
- `depthWrite: false` — shroud must not block terrain behind it in the depth buffer
- `renderOrder: 999` — render after terrain so `depthTest` correctly rejects shroud fragments behind terrain

### Rule

**Any transparent overlay surface that sits above terrain MUST use the same material type as the terrain (`MeshPhongMaterial`).** Using `MeshBasicMaterial` will cause the overlay to appear opaque from the shadow direction.

---

## depthWrite on Transparent Surfaces

### DO NOT disable depthWrite on terrain

Setting `depthWrite: false` on transparent terrain surfaces causes self-intersection artifacts — terrain layers bleed through each other and look broken.

**Terrain surfaces must always have `depthWrite: true`**, even when transparent.

### DO disable depthWrite on overlay surfaces

Overlay surfaces (flyrock shroud, blast analysis meshes) that sit above terrain should have `depthWrite: false` so they don't block the terrain in the depth buffer.

---

## Texture Encoding (Three.js r150+)

```javascript
// Deprecated:
texture.encoding = THREE.sRGBEncoding;

// Correct (r150+):
texture.colorSpace = THREE.SRGBColorSpace;
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

---

## Material Cloning Pitfall

```javascript
// WRONG — loses texture reference:
child.material = material.clone();

// CORRECT — preserves texture:
var cloned = material.clone();
if (material.map) {
    cloned.map = material.map;
    cloned.needsUpdate = true;
}
child.material = cloned;
```

---

## File References

- `src/three/GeometryFactory.js` — `createSurface()` creates `MeshPhongMaterial` with vertex colors
- `src/draw/canvas3DDrawing.js` — `drawSurfaceThreeJS()` handles flyrock shroud material override (~line 1268)
- `src/three/ThreeRenderer.js` — Scene lighting setup (ambient 0.8, directional 0.5)
