# Canvas to TreeView Sync Implementation Plan
**Date:** 2024-12-19 15:45

## Issue 1: Canvas Selection → TreeView Sync

### Problem
When selecting holes or KAD objects on the canvas, the TreeView doesn't update to highlight the selected items.

### Solution
Add a `syncCanvasToTreeView()` function that converts canvas selections into TreeView node IDs and calls `treeView.highlightNodes()`.

### Implementation Points

#### A. Add Helper Function (after TreeView initialization)
```javascript
// Step 1) Function to sync canvas selections to TreeView
function syncCanvasToTreeView() {
	if (!treeView) return;
	
	const nodeIds = [];
	
	// Step 2) Convert hole selections to node IDs
	if (selectedHole) {
		const nodeId = "hole⣿" + selectedHole.entityName + "⣿" + selectedHole.holeID;
		nodeIds.push(nodeId);
	} else if (selectedMultipleHoles && selectedMultipleHoles.length > 0) {
		selectedMultipleHoles.forEach(hole => {
			const nodeId = "hole⣿" + hole.entityName + "⣿" + hole.holeID;
			nodeIds.push(nodeId);
		});
	}
	
	// Step 3) Convert KAD selections to node IDs
	if (selectedKADObject) {
		// Check if vertex-level selection
		if (selectedPoint) {
			// Individual vertex
			const nodeId = selectedKADObject.entityType + "⣿" + selectedKADObject.entityName + "⣿element⣿" + selectedPoint.pointID;
			nodeIds.push(nodeId);
		} else {
			// Entity-level selection
			const entityType = selectedKADObject.entityType === "point" ? "points" : selectedKADObject.entityType;
			const nodeId = entityType + "⣿" + selectedKADObject.entityName;
			nodeIds.push(nodeId);
		}
	} else if (selectedMultipleKADObjects && selectedMultipleKADObjects.length > 0) {
		selectedMultipleKADObjects.forEach(kadObj => {
			if (kadObj.selectionType === "vertex") {
				// Vertex selection
				const entity = allKADDrawingsMap.get(kadObj.entityName);
				if (entity && entity.data[kadObj.elementIndex]) {
					const pointID = entity.data[kadObj.elementIndex].pointID;
					const nodeId = kadObj.entityType + "⣿" + kadObj.entityName + "⣿element⣿" + pointID;
					nodeIds.push(nodeId);
				}
			} else {
				// Entity selection
				const entityType = kadObj.entityType === "point" ? "points" : kadObj.entityType;
				const nodeId = entityType + "⣿" + kadObj.entityName;
				nodeIds.push(nodeId);
			}
		});
	}
	
	// Step 4) Highlight nodes in TreeView
	if (nodeIds.length > 0) {
		treeView.highlightNodes(nodeIds);
	} else {
		treeView.clearSelection();
	}
}
```

#### B. Add Calls After Canvas Selections

**Location 1: After hole selection (line ~1393)**
```javascript
drawData(allBlastHoles, selectedHole);
syncCanvasToTreeView(); // ADD THIS
```

**Location 2: After KAD selection (line ~1680)**
```javascript
drawData(allBlastHoles, selectedHole);
syncCanvasToTreeView(); // ADD THIS
```

**Location 3: After clearing selection (Escape key, etc.)**
```javascript
selectedHole = null;
selectedMultipleHoles = [];
// ...
syncCanvasToTreeView(); // ADD THIS
```

---

## Issue 2: Vertex Highlighting Missing

### Problem
When a KAD polygon/line vertex is selected, there's no visual highlight (pink sphere/circle).

### Current State
- `selectedPoint` variable exists but isn't used for highlighting
- Draw functions (`drawKADEntityHighlight`) only highlight entities, not individual vertices

### Solution
Add vertex highlighting to both 2D and 3D draw selection functions.

### Implementation

#### A. Update 2D Selection Drawing (canvas2DDrawSelection.js)

**Add after entity highlighting:**
```javascript
// Step X) Draw individual vertex highlight if selectedPoint is set
if (selectedPoint && selectedKADObject) {
	const entity = allKADDrawingsMap.get(selectedKADObject.entityName);
	if (entity && entity.data) {
		// Find the selected point
		const point = entity.data.find(p => p.pointID === selectedPoint.pointID);
		if (point) {
			const canvasPos = worldToCanvas(point.pointXLocation, point.pointYLocation);
			
			// Draw pink circle for selected vertex
			ctx.beginPath();
			ctx.arc(canvasPos.x, canvasPos.y, 8, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(255, 68, 255, 0.4)"; // Pink with transparency
			ctx.fill();
			ctx.strokeStyle = "rgba(255, 68, 255, 1.0)"; // Solid pink
			ctx.lineWidth = 2;
			ctx.stroke();
		}
	}
}
```

#### B. Update 3D Selection Drawing (canvas3DDrawSelection.js)

**Add after entity highlighting:**
```javascript
// Step X) Draw individual vertex highlight if selectedPoint is set
if (selectedPoint && selectedKADObject) {
	const entity = window.allKADDrawingsMap.get(selectedKADObject.entityName);
	if (entity && entity.data) {
		// Find the selected point
		const point = entity.data.find(p => p.pointID === selectedPoint.pointID);
		if (point) {
			const localPos = worldToThreeLocal(point.pointXLocation, point.pointYLocation);
			const worldZ = (point.pointZLocation || 0) - dataCentroidZ;
			
			// Create pink sphere for selected vertex
			const geometry = new THREE.SphereGeometry(5, 16, 16); // 5m radius sphere
			const material = new THREE.MeshBasicMaterial({
				color: 0xFF44FF, // Pink
				transparent: true,
				opacity: 0.8,
				depthTest: false
			});
			const sphere = new THREE.Mesh(geometry, material);
			sphere.position.set(localPos.x, localPos.y, worldZ);
			sphere.userData.type = "vertexSelectionHighlight";
			
			threeRenderer.scene.add(sphere);
		}
	}
}
```

#### C. Update selectedPoint Assignment

**Need to track where selectedPoint is set during vertex clicks**
Currently `selectedPoint` is only cleared, never assigned. Need to find KAD vertex click logic and set it there.

---

## Implementation Order

1. ✅ Add `syncCanvasToTreeView()` function to kirra.js
2. ✅ Add calls after all canvas selection points
3. ✅ Add 2D vertex highlighting
4. ✅ Add 3D vertex highlighting
5. ⚠️ Find and fix `selectedPoint` assignment during vertex clicks

---

**Next Step:** Implement syncCanvasToTreeView() function

