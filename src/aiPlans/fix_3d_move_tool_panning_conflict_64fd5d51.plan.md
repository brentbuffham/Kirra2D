---
name: Fix 3D Move Tool Panning Conflict
overview: Prevent panning when Move Tool is active in 3D mode by ensuring preventDefault/stopPropagation is called for ALL non-Alt clicks, not just when objects are clicked.
todos:
  - id: add-prevent-default-3d
    content: Add preventDefault/stopPropagation at start of 3D mode section in handleMoveToolMouseDown
    status: completed
  - id: remove-redundant-prevents-3d
    content: Remove redundant preventDefault calls from 3D object drag sections
    status: completed
  - id: test-3d-interactions
    content: "Test all 3D interactions: empty clicks, drag holes, drag KAD, Alt+drag orbit"
    status: pending
  - id: test-2d-still-works
    content: Verify 2D mode Move Tool still works correctly
    status: pending
---

# Fix 3D Move Tool Panning Conflict

## Problem Analysis

The Move Tool in 3D mode is not blocking camera panning because `preventDefault()` and `stopPropagation()` are only called when an object is successfully clicked. When clicking empty space, the event propagates to `CameraControls`, which initiates panning.

### Current Event Flow (Broken)

```
User left-clicks (no Alt) → handleMoveToolMouseDown
  ├─ Click on object → preventDefault ✅ → blocks panning ✅
  └─ Click empty space → no preventDefault ❌ → CameraControls pans ❌

User Alt+clicks → handleMoveToolMouseDown  
  └─ Returns early → CameraControls orbits ✅
```

### CameraControls Integration

`CameraControls.processMouseDown()` (line 460) checks `event.defaultPrevented`:

- If `true`: Returns early, no panning/orbit
- If `false`: Processes camera movement (pan/orbit/rotate based on keys)

## Solution

**Always call `preventDefault()` and `stopPropagation()` in 3D mode for non-Alt clicks**, regardless of whether an object was clicked. This ensures:

- ✅ Alt+click → passes through → orbits
- ✅ Alt+Shift+click → passes through → camera roll
- ✅ Left-click (no Alt) → prevented → no panning, Move Tool controls interaction

## Implementation

### File: [Kirra2D/src/kirra.js](Kirra2D/src/kirra.js)

#### Change 1: Block Panning in 3D Mode (after line ~26289)

Add `preventDefault()` and `stopPropagation()` immediately after entering 3D mode logic, BEFORE checking for objects:

```javascript
function handleMoveToolMouseDown(event) {
	// Step 1a) Allow Alt+drag to pass through for camera orbit/rotate
	if (event.altKey) {
		return; // Let CameraControls handle Alt+click, Alt+Shift+click
	}

	// Step 2) Check if we're in 3D mode
	if (moveToolIn3DMode && threeRenderer && interactionManager) {
		// Step 2a) BLOCK panning - Move Tool takes precedence over camera pan
		event.preventDefault();
		event.stopPropagation();
		
		// 3D Mode Logic
		const targetCanvas = threeRenderer.getCanvas();
		// ... rest of 3D logic ...
	}
	
	// Step 3) 2D Mode Logic
	// ... existing 2D code ...
}
```

#### Change 2: Remove Redundant preventDefault Calls

Since we're now calling preventDefault at the start of 3D mode, remove the redundant calls throughout the 3D section:

- Remove from KAD drag start (~line 26311)
- Remove from multi-hole drag start (~line 26369)  
- Remove from single hole drag start (~line 26383)
- Remove from clicked hole selection (~line 26408)

**Keep the preventDefault calls in 2D mode** - they're still needed there since 2D doesn't have the same camera control conflicts.

## State Management (Matching 2D Behavior)

**Current behavior** (both 2D and 3D): After moving an object and releasing the mouse, selections are cleared. **This is correct and will be preserved.**

**What's preserved**:

- Move Tool checkbox remains checked (tool stays active)
- `isDraggingHole = false` (drag operation complete)
- Event listeners removed
- `moveToolSelectedHole = null` (temporary drag state cleared)

**What's cleared** (matching 2D behavior):

- `selectedHole = null`
- `selectedMultipleHoles = []`
- `selectedPoint = null`

This means the tool stays active, but selections clear after each move (requires reselection for next move - same as 2D).

## Testing Checklist

### 3D Mode - Panning Conflict

- [ ] Load data with holes and KAD
- [ ] Activate Move Tool, switch to 3D mode
- [ ] **Left-click empty space** → should NOT pan camera
- [ ] **Left-click and drag hole** → should move hole (not pan)
- [ ] **Left-click and drag KAD vertex** → should move vertex (not pan)
- [ ] **Alt+drag** → should orbit camera
- [ ] **Alt+Shift+drag** → should rotate/roll camera
- [ ] **Scroll wheel** → should zoom

### 3D Behavior Matches 2D

- [ ] **Move single hole** → release mouse → selection clears (same as 2D)
- [ ] **Move multiple holes** → release mouse → selection clears (same as 2D)
- [ ] **Move KAD vertex** → release mouse → selection clears (same as 2D)
- [ ] Tool stays active after each move (checkbox remains checked)

### 2D Mode

- [ ] Switch to 2D mode, Move Tool active
- [ ] Click and drag hole → should move (no change from before)
- [ ] Click and drag KAD → should move (no change from before)

## Expected Behavior After Fix

### Interaction Model (Matching 2D)

1. **Activate Move Tool** → checkbox checked, tool active
2. **Select and drag hole** → hole moves, no panning
3. **Release mouse** → selection clears (same as 2D)
4. **Reselect hole** → can move it again
5. **Alt+drag anytime** → orbits camera (Move Tool doesn't interfere)
6. **Left-click empty space** → no panning (blocked by Move Tool)

### State Variables

- **`moveToTool.checked`**: Remains `true` (tool stays active)
- **`selectedHole`**: Cleared after move (matching 2D)
- **`selectedMultipleHoles`**: Cleared after move (matching 2D)
- **`selectedPoint`**: Cleared after move (matching 2D)
- **`moveToolSelectedHole`**: Cleared after move (temporary drag state)
- **`moveToolSelectedKAD`**: Cleared after move (temporary drag state)
- **`isDraggingHole`**: `false` after mouseup (drag operation complete)

## Technical Notes

### Why This Works

1. **Non-Alt clicks** in 3D with Move Tool → `preventDefault()` called → `CameraControls` sees `event.defaultPrevented === true` → returns early on line 460 → no panning ✅
2. **Alt clicks** → `handleMoveToolMouseDown` returns early → event not prevented → `CameraControls` processes normally → orbit/rotate works ✅
3. **3D matches 2D** → Both modes clear selections after moving, tool stays active for next operation ✅

### Event Order

The event listeners are attached to the same canvas in this order:

1. `handleMoveToolMouseDown` (attached when Move Tool activated)
2. `CameraControls.onMouseDown` (attached when ThreeRenderer initializes)

Since both use `addEventListener`, they execute in attachment order. Move Tool handler runs first, and if it calls `preventDefault()`, CameraControls respects it.

## Files Modified

- [Kirra2D/src/kirra.js](Kirra2D/src/kirra.js) - `handleMoveToolMouseDown()` function (~lines 26278-26460)
  - Add preventDefault/stopPropagation at start of 3D mode section
  - Remove redundant preventDefault calls from object click handlers

## Risk Assessment

**Low Risk** - Changes are isolated to Move Tool handler, with clear fallback (Alt key passthrough for camera controls).