# KAD Right-Click and Segment Modification Fix

**Date:** 2024-12-09 14:30  
**Commit Reference:** Post #517749a  
**Task:** Fix right-click entity ending behavior and segment modification targeting

---

## Issues Fixed

### Issue 1: Right-Click Not Properly Ending Entity

**Problem:**  
When using KAD drawing tools (line, polygon, circle, point, text), right-clicking was supposed to end the current entity and allow starting a new one while keeping the tool active. However, the right-click behavior was incomplete compared to the Escape key functionality.

**Symptoms:**
- Right-click showed tooltip message "Starting new object - continue drawing"
- But the drawing state wasn't fully reset
- Next click would continue on the same entity instead of starting a new one
- Escape key worked correctly, but right-click did not

**Root Cause:**  
The `kadContextMenu()` function in `ContextMenuManager.js` (lines 568-590) only set:
- `window.createNewEntity = true`
- `window.lastKADDrawPoint = null`

But it did NOT reset:
- `window.entityName` - causing next click to reuse same entity name
- Didn't call `clearCurrentDrawingEntity()` properly

**Fix Location:** `src/dialog/contextMenu/ContextMenuManager.js` lines 567-592

**Solution:**  
Updated `kadContextMenu()` to fully mimic the Escape key behavior from `endKadTools()`:

```javascript
// Step 5a) Start a new object within the same tool (mimics Escape key behavior)
window.createNewEntity = true; // This will create a new entity name on next click
window.lastKADDrawPoint = null; // Reset preview line
window.entityName = null; // CRITICAL: Reset entityName so next click creates NEW entity

// Step 5b) Clear current drawing entity state
if (typeof window.clearCurrentDrawingEntity === "function") {
    window.clearCurrentDrawingEntity();
}

// Step 5c) Show status message
const toolName = window.isDrawingLine ? "line" : window.isDrawingPoly ? "polygon" : 
                 window.isDrawingCircle ? "circle" : window.isDrawingPoint ? "point" : "text";
window.updateStatusMessage("Entity finished. Click to start new " + toolName);

// Step 5d) Brief visual feedback
setTimeout(() => {
    window.updateStatusMessage("");
}, 2000);

// Step 5e) Redraw to clear any preview lines
window.drawData(window.allBlastHoles, window.selectedHole);
```

**Changes Made:**
1. Added `window.entityName = null` to force new entity creation
2. Added proper call to `clearCurrentDrawingEntity()`
3. Changed message from "Starting new object" to "Entity finished. Click to start new [toolname]"
4. Extended timeout from 1500ms to 2000ms to match Escape key behavior

---

### Issue 2: Wrong Segment Being Modified in Context Menu

**Problem:**  
When right-clicking on a segment of a line or polygon to modify its color/properties, the WRONG segment was being modified. 

**Example from User:**
- User highlighted and clicked on a specific segment (shown in magenta in Image 1)
- Changed the color to orange in the context menu
- But a DIFFERENT segment changed color (Image 2)
- The segment "before" the selected segment was being modified

**Root Cause Analysis:**

**Segment Color Logic:**  
In Kirra's drawing system, a segment from point[i] to point[i+1] gets its color from point[i+1] (the "to" point, the endpoint). This was fixed in commit #517749a where we corrected:
```javascript
// BEFORE: var color = currentPoint.color;
// AFTER:  var color = nextPoint.color;
```

**Click Detection:**  
When you click on a segment in `getClickedKADObject()` (kirra.js line 26554-26577), it correctly identifies:
- `elementIndex: i` - the index of the first point (segment start)
- `segmentIndex: i` - same as elementIndex
- `selectionType: "segment"`

So clicking segment from point[2] to point[3] gives `elementIndex = 2`.

**The Bug:**  
In `updateKADObjectProperties()` (KADContextMenu.js line 398-422), when scope was "element":
```javascript
const elementIndex = kadObject.elementIndex; // This is 2
const item = entity.data[elementIndex];      // Modifying point[2]
if (newProperties.color) item.color = newProperties.color;
```

This modified point[2]'s color, which affects the segment from point[1] to point[2] (the PREVIOUS segment), not the selected segment from point[2] to point[3].

**Correct Behavior:**  
To modify segment from point[i] to point[i+1], we need to modify point[i+1]'s properties because:
- The segment uses the endpoint's (point[i+1]) color
- The segment uses the endpoint's (point[i+1]) lineWidth
- For polygons, this wraps around (last segment uses point[0]'s properties)

**Fix Location:** `src/dialog/contextMenu/KADContextMenu.js` lines 398-439

**Solution:**  
Modified `updateKADObjectProperties()` to detect segment selections and adjust the target index:

```javascript
if (scope === "element") {
    // Step 8a) Only this point/segment
    let elementIndex = kadObject.elementIndex;
    
    // Step 8a.1) CRITICAL FIX: For segments in lines/polygons, modify the endpoint (next point)
    // A segment from point[i] to point[i+1] uses point[i+1]'s color/properties
    const isLineOrPoly = entity.entityType === "line" || entity.entityType === "poly";
    if (isLineOrPoly && kadObject.selectionType === "segment") {
        // For a segment, we want to modify the "to" point (endpoint), not the "from" point
        const isPoly = entity.entityType === "poly";
        const numPoints = entity.data.length;
        elementIndex = isPoly ? (elementIndex + 1) % numPoints : elementIndex + 1;
        console.log("🔧 [KAD MODIFY] Segment selected - modifying endpoint at index " + 
                    elementIndex + " instead of " + kadObject.elementIndex);
    }
    
    // Now modify the correct point
    if (elementIndex !== undefined && elementIndex < entity.data.length) {
        const item = entity.data[elementIndex];
        // ... apply properties to correct point
    }
}
```

**Additional Fix:**  
Updated the dialog title to show "Segment X" instead of "Element X" when a segment is selected (KADContextMenu.js lines 28-43):

```javascript
// Step 1c) Create title showing correct element/segment number
let displayIndex = kadObject.elementIndex + 1;
let elementTypeLabel = "Element";

// For segments, show "Segment X" instead of "Element X"
if (kadObject.selectionType === "segment") {
    elementTypeLabel = "Segment";
    displayIndex = kadObject.elementIndex + 1; // Segments are numbered starting from 1
}

const title = hasMultipleElements ? 
    "Edit " + kadObject.entityType.toUpperCase() + " - " + kadObject.entityName + 
    " - " + elementTypeLabel + " " + displayIndex : 
    "Edit " + kadObject.entityType.toUpperCase() + " - " + kadObject.entityName;
```

**Color Swatch Fix (Follow-up #1):**  
After initial implementation, discovered that the color swatch was showing the PREVIOUS segment's color when the dialog first opened. This was because Step 1a was only populating MISSING kadObject properties using `if (property === undefined)` checks.

Initial fix adjusted the data index when loading properties for segment selections (KADContextMenu.js lines 13-30).

**Color Swatch Fix (Follow-up #2 - 2D Mode):**  
Testing revealed the fix worked in 3D but NOT in 2D. Investigation showed that 2D's `getClickedKADObject()` (kirra.js line 26566) does:
```javascript
closestMatch = {
    ...point1,  // ← Spreads ALL properties from start point
    mapType: "allKADDrawingsMap",
    entityName: entityName,
    entityType: entity.entityType,
    elementIndex: i,
    segmentIndex: i,
    selectionType: "segment",
    // ...
};
```

The `...point1` spread operator copies ALL properties (including color, lineWidth, etc.) from the segment's START point into kadObject. When kadObject reached the dialog, these properties were already defined, so the `if (property === undefined)` checks failed and didn't override them.

**Final Fix:** Changed from conditional assignment to ALWAYS override:
```javascript
// Step 1a) Populate kadObject with element data
// CRITICAL: For segments, ALWAYS get properties from the endpoint (next point)
// The 2D getClickedKADObject spreads point1 properties, so we must override them here
if (entity && entity.data && kadObject.elementIndex !== undefined) {
    let dataIndex = kadObject.elementIndex;
    
    // For segment selections in lines/polygons, use the endpoint (next point)
    const isLineOrPolySegment = (kadObject.entityType === "line" || kadObject.entityType === "poly") && 
                                 kadObject.selectionType === "segment";
    if (isLineOrPolySegment) {
        const isPoly = kadObject.entityType === "poly";
        const numPoints = entity.data.length;
        dataIndex = isPoly ? (dataIndex + 1) % numPoints : dataIndex + 1;
        console.log("🎨 [KAD DIALOG] Segment selected - loading properties from endpoint index " + 
                    dataIndex + " instead of " + kadObject.elementIndex);
    }
    
    const element = entity.data[dataIndex];
    if (element) {
        // ALWAYS populate from correct element (override any spread properties)
        kadObject.pointXLocation = element.pointXLocation || 0;
        kadObject.pointYLocation = element.pointYLocation || 0;
        kadObject.pointZLocation = element.pointZLocation || 0;
        kadObject.color = element.color || "#FF0000";
        kadObject.lineWidth = element.lineWidth || 1;
        kadObject.radius = element.radius;
        kadObject.text = element.text || "";
    }
}
```

This ensures the color swatch and all properties shown in the dialog match the segment that will be modified, in BOTH 2D and 3D modes.

---

## Files Modified

1. **src/dialog/contextMenu/ContextMenuManager.js**
   - Lines 567-592: Enhanced `kadContextMenu()` to properly reset entity state
   - Added `entityName` reset
   - Added `clearCurrentDrawingEntity()` call
   - Improved status messages

2. **src/dialog/contextMenu/KADContextMenu.js**
   - Lines 10-30: Fixed property loading to get values from correct endpoint for segments
   - Lines 31-43: Updated title generation to show "Segment X" vs "Element X"
   - Lines 410-451: Fixed `updateKADObjectProperties()` to modify correct endpoint for segments
   - Added segment detection logic
   - Added polygon wrap-around handling

---

## Testing Recommendations

### Test 1: Right-Click Entity Ending
1. Activate any KAD drawing tool (line, polygon, point, etc.)
2. Click to add several points
3. Right-click to end the entity
4. Verify status message says "Entity finished. Click to start new [toolname]"
5. Click again - should start a NEW entity with a different name
6. Verify in tree view that two separate entities were created

### Test 2: Segment Color Modification
1. Draw a polygon or line with at least 4 segments
2. Give each segment a different color while drawing
3. Right-click on segment 2 (between point 2 and point 3)
4. Dialog should say "Edit POLY - [name] - Segment 2"
5. Change color to orange, click "This"
6. Verify that segment 2 (the highlighted/selected segment) turns orange
7. Verify that segment 1 and segment 3 remain unchanged
8. Repeat for different segments including the last segment (wraps to first point in polygons)

### Test 3: Vertex vs Segment Selection
1. Draw a polygon with 5 vertices, each segment a different color
2. Click DIRECTLY on a vertex (should select vertex)
3. Dialog should say "Edit POLY - [name] - Element X"
4. Change color - should affect segments connected to that vertex
5. Click on the MIDDLE of a segment (away from vertices)
6. Dialog should say "Edit POLY - [name] - Segment X"
7. Change color - should affect only that segment

---

## Technical Notes

### Segment Indexing Convention
- Segment index `i` refers to the segment from point[i] to point[i+1]
- For polygons, segment index `n-1` refers to segment from point[n-1] to point[0] (wraps)
- Segments are numbered starting from 0 internally, but displayed as 1-based to users

### Color Application Logic
- When drawing: `nextPoint.color` determines the segment color leading TO that point
- When modifying: Changing point[i+1]'s color changes the segment from point[i] to point[i+1]
- This maintains consistency between drawing and editing

### Relationship to Previous Fixes
This fix builds on the segment color fix from commit #517749a (documented in 20251209-1230-KADToolEscapeAndColorFix.md):
- That fix corrected the drawing logic to use `nextPoint.color`
- This fix corrects the editing logic to modify the correct point
- Both ensure segment colors are consistent between drawing and editing

---

## Summary

**Right-Click Issue:**  
Right-click now properly ends the current KAD entity and prepares for a new entity, matching the Escape key behavior. The critical missing piece was resetting `entityName` to null.

**Segment Modification Issue:**  
When modifying a segment's properties (color, lineWidth), the code now:
1. Shows the correct current properties in the dialog (from the endpoint)
2. Modifies the correct endpoint (point[i+1]) rather than the start point (point[i])
3. Ensures that the highlighted segment is the one that changes

Both the dialog display AND the modification now target the same point, ensuring consistency.

Both fixes ensure that the KAD drawing and editing tools behave intuitively and consistently in both 2D and 3D modes.

