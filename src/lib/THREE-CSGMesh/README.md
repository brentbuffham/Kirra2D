# THREE-CSGMesh (vendored)

Source: https://github.com/manthrax/THREE-CSGMesh

Vendored because the repository does not publish to npm. Files downloaded from GitHub master branch.

## Usage

```javascript
import CSG from "./lib/THREE-CSGMesh/three-csg.js";

// Subtract mesh B from mesh A
let result = CSG.toMesh(
  CSG.subtract(CSG.fromMesh(meshA), CSG.fromMesh(meshB)),
  meshA.matrix,
  meshA.material
);
scene.add(result);
```

Operations: `.subtract()`, `.union()`, `.intersect()`
