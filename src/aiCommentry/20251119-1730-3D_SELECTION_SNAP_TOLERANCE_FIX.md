# 3D Selection Snap Tolerance Fix
**Date**: 2025-11-19 17:30
**Status**: ✅ COMPLETE

## Overview
Fixed 3D KAD entity selection to respect snap tolerance slider. Previously, entities could only be selected by direct raycast hits on their geometry. Now, selection uses distance-based calculation as fallback, allowing selection within snap tolerance radius even when raycast misses the geometry.

## Problem Statement
- Snap tolerance slider adjusted raycaster threshold for Line and Points primitives
- KAD points rendered as Mesh (CircleGeometry) - raycaster threshold doesn't apply to Mesh
- KAD lines rendered as MeshLine (also Mesh) - same issue
- Result: Points needed direct hits, lines/text had offset issues
- Adjusting snap tolerance had no effect on entity selection

## Solution Strategy
Instead of creating hitbox geometry (memory wasteful), implemented distance-based selection fallback:
1. Try raycast intersection first (fast path - existing behavior)
2. If no KAD hit, get 3D click position on plane
3. Calculate 2D distances to all KAD entities
4. Select closest entity if within snap tolerance radius
5. Zero memory overhead, matches 2D canvas behavior exactly

## Implementation Details

### 1. Enhanced 3D Click Handler
**File**: `src/kirra.js` (lines 1073-1199)

Added distance-based selection fallback after raycast attempt:

**Step 12j.6.5) Distance-Based Selection Logic**:
- Get click world position using `interactionManager.getMouseWorldPositionOnPlane(dataCentroidZ)`
- Calculate snap tolerance in world units: `snapRadiusPixels / currentScale`
- Iterate through `allKADDrawingsMap` to find closest entity

**Distance Calculations by Entity Type**:
- **Points**: 2D Euclidean distance to point location
- **Lines/Polys**: Distance to closest segment using `pointToLineSegmentDistance()` helper
- **Circles**: Distance to circle outline (abs(distToCenter - radius))
- **Text**: Distance to text anchor point

**Selection Logic**:
- Find entity with minimum distance
- Check if distance <= snap tolerance
- Create KAD object descriptor if within tolerance
- Falls through to existing selection handler

### 2. Text Sprite Positioning
**File**: `src/draw/canvas3DDrawing.js` (lines 316-327)

Verified text sprite positioning is correct:
- Coordinates converted from world to local before sprite creation (lines 20748, 21059 in kirra.js)
- Sprite uses center alignment (createKADText in GeometryFactory.js line 369)
- Position matches text anchor point exactly
- No changes needed

### 3. Tolerance Calculation Update
**File**: `src/draw/canvas3DDrawSelection.js` (lines 79-82)

Updated tolerance variable to properly convert pixels to world units:
```javascript
// Before:
const tolerance = window.snapRadiusPixels || 1; // Incorrect - pixels not world units

// After:
const snapRadiusPixels = window.snapRadiusPixels || 20;
const currentScale = window.currentScale || 5;
const tolerance = snapRadiusPixels / currentScale; // Correct - world units
```

Note: This variable is defined for future use but not currently utilized. The distance-based selection in kirra.js handles tolerance checking.

## Technical Details

### Helper Functions Reused
- `pointToLineSegmentDistance()` - Calculate perpendicular distance to line segment
- `getClosestPointOnLineSegment()` - Available but not used in this implementation
- `interactionManager.getMouseWorldPositionOnPlane()` - Get 3D click position

### Performance Considerations
- **Fast Path**: Raycast intersects processed first (no change)
- **Fallback Path**: Only triggered when raycast finds no KAD objects
- **Distance Calculation**: O(n) where n = number of entities (acceptable for typical datasets)
- **Memory**: Zero overhead - no extra geometry created

### Coordinate Systems
- **Click Position**: World coordinates from plane intersection
- **Entity Positions**: World coordinates from allKADDrawingsMap
- **Tolerance**: World units (pixels / currentScale)
- All calculations in 2D (X, Y) - Z not considered for distance

## Testing Checklist
✅ Points - Click near point within snap tolerance → selects point
✅ Lines - Click near line within snap tolerance → selects line
✅ Polys - Click near polygon within snap tolerance → selects poly
✅ Circles - Click near circle outline within snap tolerance → selects circle
✅ Text - Click near text anchor within snap tolerance → selects text
✅ Snap tolerance slider - Larger values = easier selection
✅ Snap tolerance slider - Smaller values = harder selection
✅ Direct raycast hits - Still work (fast path preserved)
✅ Multiple selection with Shift - Works with distance-based selection
✅ No linter errors

## Files Modified

### 1. src/kirra.js
**Lines 1073-1199**: Added distance-based selection fallback
- Step 12j.6.5) If no raycast hit, try distance-based selection
- Step 12j.6.5a) Get 3D click position in world coordinates
- Step 12j.6.5b) Calculate snap tolerance in world units
- Step 12j.6.5c) Search all KAD entities for closest one within tolerance
- Step 12j.6.5d) Calculate distance based on entity type (point/line/poly/circle/text)
- Step 12j.6.5e) Check if closest entity is within tolerance
- Step 12j.6.5f) Create KAD object descriptor
- Step 12j.6.5g) Add type-specific properties

### 2. src/draw/canvas3DDrawSelection.js
**Lines 79-82**: Updated tolerance calculation
- Convert snapRadiusPixels to world units using currentScale
- Proper conversion: pixels / currentScale = world units

## Console Logging Added
- "🔍 [3D CLICK] No raycast hit, trying distance-based selection..."
- "📏 [3D CLICK] Click at (X, Y), tolerance: Zm"
- "✅ [3D CLICK] Found entity by distance: [name] type: [type] distance: Xm"
- "⚠️ [3D CLICK] Closest entity at Xm (outside tolerance Zm)"

## Expected Behavior

### Before Fix
- Click directly on point geometry → selects (raycast hit)
- Click 5px away from point → no selection (raycast miss)
- Adjust snap tolerance slider → no effect on selection

### After Fix
- Click directly on point geometry → selects (raycast hit - fast path)
- Click within snap tolerance of point → selects (distance calculation - fallback)
- Adjust snap tolerance slider → affects selection radius in 3D
- Larger tolerance = easier to click entities
- Smaller tolerance = more precise clicking required

## Integration with Existing Features
- Works with existing selection system (handleSelection logic)
- Respects Shift key for multiple selection
- Clears hole selections when KAD selected
- Updates tree view highlighting
- Triggers proper redraw with highlights
- No breaking changes to existing functionality

## Code Quality
- Step-numbered comments throughout
- No template literals (per user rules)
- Reused existing helper functions
- Zero memory overhead
- No breaking changes
- Follows established patterns

## Performance Notes
- Fast path (raycast) unchanged - no performance impact for direct hits
- Fallback path only runs when needed
- O(n) distance calculation acceptable for typical entity counts
- No geometry creation/disposal overhead
- Single plane intersection calculation

## Future Enhancements (Optional)
- Cache entity bounding boxes for faster distance calculation
- Spatial indexing (quadtree) for large entity counts
- Prioritize entity types (e.g., points over lines)
- Visual feedback showing snap tolerance radius
- Configurable tolerance per entity type

---
**Implementation Time**: ~45 minutes
**Complexity**: Medium
**Risk**: Low (fallback only, preserves existing behavior)
**Memory Impact**: Zero
**Status**: ✅ TESTED & WORKING

