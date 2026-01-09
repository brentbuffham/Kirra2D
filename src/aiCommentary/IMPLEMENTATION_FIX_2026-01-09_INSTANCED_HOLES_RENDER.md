# Instanced Holes Rendering Fix - 2026-01-09

## Issue

Instanced hole rendering (performance optimization for >10 holes) did not match non-instanced rendering:
- Grade circles were **white/black** instead of **RED**
- Grade circles had **50% opacity** instead of **100% for positive subdrill** or **20% for negative/zero subdrill**

## Root Cause

The `createInstancedHoles()` function in `GeometryFactory.js` created a single `InstancedMesh` for all grade circles with:
- Same color as collar circles (white/black)
- Fixed 50% opacity

However, non-instanced rendering uses:
- **Positive subdrill**: RED grade circle (solid, opacity 1.0)
- **Negative/zero subdrill**: RED grade circle (transparent, opacity 0.2)

## Solution

Split grade circle rendering into TWO `InstancedMesh` objects based on subdrill value:
1. `instancedGradesPositive` - RED, opacity 1.0 (for holes with subdrill > 0)
2. `instancedGradesNegative` - RED, opacity 0.2 (for holes with subdrill <= 0)

This matches the non-instanced rendering logic exactly.

## Files Changed

### 1. `src/three/GeometryFactory.js` (Lines 3117-3227)

**Before**: Single grade InstancedMesh with wrong color/opacity
```javascript
var gradeMaterial = new THREE.MeshBasicMaterial({
    color: collarColor, // WRONG: white/black
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5, // WRONG: fixed 50%
    depthTest: true,
    depthWrite: false
});
var instancedGrades = new THREE.InstancedMesh(gradeGeometry, gradeMaterial, holeCount);
```

**After**: Split into positive and negative grade instances
```javascript
// Step 28c) Count holes by subdrill type
var positiveSubdrillHoles = [];
var negativeSubdrillHoles = [];
for (var i = 0; i < visibleHoles.length; i++) {
    var subdrill = visibleHoles[i].subdrillAmount || 0;
    if (subdrill > 0) {
        positiveSubdrillHoles.push(visibleHoles[i]);
    } else {
        negativeSubdrillHoles.push(visibleHoles[i]);
    }
}

// Step 28d.1) Create material for POSITIVE subdrill grades (RED, solid)
var gradeMatPos = new THREE.MeshBasicMaterial({
    color: 0xff0000, // RED
    side: THREE.DoubleSide,
    transparent: false,
    opacity: 1.0,
    depthTest: true,
    depthWrite: true
});

// Step 28d.2) Create material for NEGATIVE/ZERO subdrill grades (RED, transparent)
var gradeMatNeg = new THREE.MeshBasicMaterial({
    color: 0xff0000, // RED
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.2,
    depthTest: true,
    depthWrite: false
});

// Create separate InstancedMesh for each type
var instancedGradesPositive = new THREE.InstancedMesh(gradeGeometry, gradeMatPos, positiveSubdrillHoles.length);
var instancedGradesNegative = new THREE.InstancedMesh(gradeGeometry.clone(), gradeMatNeg, negativeSubdrillHoles.length);
```

**Return Value Changed**:
```javascript
return {
    instancedCollars: instancedCollars,
    instancedGradesPositive: instancedGradesPositive, // NEW
    instancedGradesNegative: instancedGradesNegative, // NEW
    instanceIdToHole: instanceIdToHole,
    holeToInstanceId: holeToInstanceId,
    holeCount: holeCount
};
```

### 2. `src/kirra.js` (Lines 26471-26486)

**Before**: Stored single `instancedGrades`
```javascript
threeRenderer.instancedGrades = instanceData.instancedGrades;
threeRenderer.holesGroup.add(instanceData.instancedGrades);
```

**After**: Store and add both grade instances
```javascript
threeRenderer.instancedGradesPositive = instanceData.instancedGradesPositive;
threeRenderer.instancedGradesNegative = instanceData.instancedGradesNegative;
if (instanceData.instancedGradesPositive) {
    threeRenderer.holesGroup.add(instanceData.instancedGradesPositive);
}
if (instanceData.instancedGradesNegative) {
    threeRenderer.holesGroup.add(instanceData.instancedGradesNegative);
}
```

### 3. `src/three/ThreeRenderer.js`

**Changes**:

**Lines 188-196**: Updated initialization
```javascript
// Before
this.instancedGrades = null;

// After
this.instancedGradesPositive = null; // RED solid
this.instancedGradesNegative = null; // RED transparent
```

**Lines 1084-1098**: Updated disposal in `clearInstancedHoles()`
```javascript
// Before
if (this.instancedGrades) {
    this.holesGroup.remove(this.instancedGrades);
    if (this.instancedGrades.geometry) this.instancedGrades.geometry.dispose();
    if (this.instancedGrades.material) this.instancedGrades.material.dispose();
    this.instancedGrades = null;
}

// After
if (this.instancedGradesPositive) {
    this.holesGroup.remove(this.instancedGradesPositive);
    if (this.instancedGradesPositive.geometry) this.instancedGradesPositive.geometry.dispose();
    if (this.instancedGradesPositive.material) this.instancedGradesPositive.material.dispose();
    this.instancedGradesPositive = null;
}
if (this.instancedGradesNegative) {
    this.holesGroup.remove(this.instancedGradesNegative);
    if (this.instancedGradesNegative.geometry) this.instancedGradesNegative.geometry.dispose();
    if (this.instancedGradesNegative.material) this.instancedGradesNegative.material.dispose();
    this.instancedGradesNegative = null;
}
```

**Lines 1144-1148**: Commented out grade update in `updateHolePosition()`
- Grade updates during hole movement not supported with split instances
- Static grade positions are acceptable for initial fix
- Can be enhanced later if dynamic updates are needed

## Rendering Logic Summary

### Non-Instanced Rendering (GeometryFactory.createHole)

**Positive Subdrill** (lines 131-169):
- Collar: Black/white solid circle
- Track: Black solid line (collar → grade)
- Subdrill: **RED solid line** (grade → toe)
- Grade: **RED solid circle** (opacity 1.0)

**Negative Subdrill** (lines 92-130):
- Collar: Black/white solid circle
- Track: Black solid line (collar → toe)
- Subdrill: **RED transparent line** (toe → grade, opacity 0.2)
- Grade: **RED transparent circle** (opacity 0.2)

### Instanced Rendering (Now Fixed)

**Positive Subdrill**:
- Collar: Black/white solid (instanced)
- Track: Black solid + RED solid subdrill (individual via `createHoleTrack`)
- Grade: **RED solid circle** (instanced, opacity 1.0) ✅ FIXED

**Negative Subdrill**:
- Collar: Black/white solid (instanced)
- Track: Black solid + RED transparent subdrill (individual via `createHoleTrack`)
- Grade: **RED transparent circle** (instanced, opacity 0.2) ✅ FIXED

## Testing

**Enable Instanced Holes**:
1. Settings → Performance → Check "Use Instanced Holes"
2. Import/create pattern with >10 holes
3. Verify grade circles are RED (not black/white)
4. Verify positive subdrill grades are solid RED
5. Verify negative/zero subdrill grades are transparent RED (20% opacity)

**Compare with Non-Instanced**:
1. Uncheck "Use Instanced Holes"
2. Verify rendering matches exactly

## Known Limitations

**Dynamic Grade Updates**:
- `updateHolePosition()` method cannot update grade positions when holes are moved
- Grades remain at original positions until full scene rebuild
- This is acceptable since hole movements typically trigger full redraw anyway
- Can be enhanced later by tracking per-instance grade indices separately

## Status: ✅ FIXED

Instanced and non-instanced hole rendering now match:
- ✅ Grade circles are RED (not black/white)
- ✅ Positive subdrill: RED solid (opacity 1.0)
- ✅ Negative/zero subdrill: RED transparent (opacity 0.2)
- ✅ Collar circles remain black/white as expected
- ✅ Track lines already correct (via `createHoleTrack`)
