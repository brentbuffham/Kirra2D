# Performance Optimizations: TreeView Lazy Loading & Surface Caching

**Date:** 2025-12-28 16:00
**Priority:** High
**Status:** Planning

---

## Problem Summary

### 1. TreeView Freezes on Load
**Current Behavior:**
- `buildDrawingData()` creates ALL element children for every KAD entity upfront
- For entities with 3000+ points, this creates 3000+ DOM nodes immediately  
- `renderTree()` generates all HTML recursively in one pass
- Even smaller files freeze the app during tree construction

**Impact:** App freezes for seconds during load with DXF files containing many points

### 2. Surface 2D Rendering Slow
**Current Behavior:**
- `drawSurface()` iterates through EVERY triangle on EVERY draw call
- For 100k+ triangles, this is extremely slow
- Each pan/zoom triggers full re-render of all triangles

**Impact:** App becomes sluggish/unresponsive after creating large triangulations

---

## Solution 1: TreeView Lazy Loading with Grouped Nodes

### Strategy: Chunked/Grouped Point Nodes

Instead of creating 3000 individual point nodes, create grouped placeholder nodes:
- "Points 1-50"
- "Points 51-100"  
- "Points 101-150"
- etc.

Only expand to individual points when user clicks on a group.

### Implementation Steps:

#### Step 1: Add Grouping Constants
```javascript
const TREE_CHUNK_SIZE = 50;  // Points per group
const TREE_CHUNK_THRESHOLD = 20;  // Only chunk if more than this many points
```

#### Step 2: Modify `buildDrawingData()` in TreeView.js
```javascript
// Current (slow):
const elementChildren = entity.data.map((element, index) => ({
    id: entity.entityType + "⣿" + entityName + "⣿element⣿" + (element.pointID || index + 1),
    // ... creates ALL nodes
}));

// New (lazy):
let elementChildren;
if (entity.data.length > TREE_CHUNK_THRESHOLD) {
    // Create grouped/chunked nodes
    elementChildren = this.createChunkedChildren(entity, entityName);
} else {
    // Small entity - create all nodes (fast enough)
    elementChildren = entity.data.map(...);
}
```

#### Step 3: Add `createChunkedChildren()` Method
```javascript
createChunkedChildren(entity, entityName) {
    const chunks = [];
    const chunkSize = 50;
    const totalPoints = entity.data.length;
    
    for (let i = 0; i < totalPoints; i += chunkSize) {
        const start = i + 1;
        const end = Math.min(i + chunkSize, totalPoints);
        
        chunks.push({
            id: entity.entityType + "⣿" + entityName + "⣿chunk⣿" + start + "-" + end,
            type: "point-chunk",
            label: "Points " + start + "-" + end,
            meta: "(" + (end - start + 1) + " points)",
            isLazyChunk: true,
            chunkStart: i,
            chunkEnd: end - 1,
            entityName: entityName,
            entityType: entity.entityType,
            children: []  // Empty - will be populated on expand
        });
    }
    
    return chunks;
}
```

#### Step 4: Modify `toggleNode()` to Handle Lazy Loading
```javascript
toggleNode(treeItem) {
    const nodeId = treeItem.dataset.nodeId;
    const children = treeItem.parentNode.querySelector(".tree-children");
    const expandBtn = treeItem.querySelector(".tree-expand");
    
    if (!children) return;
    
    // Check if this is a lazy chunk that needs loading
    if (nodeId.includes("⣿chunk⣿") && !this.loadedChunks.has(nodeId)) {
        this.loadChunkChildren(nodeId, treeItem, children);
    }
    
    // Normal toggle logic...
}

loadChunkChildren(nodeId, treeItem, childrenContainer) {
    const parts = nodeId.split("⣿");
    const entityType = parts[0];
    const entityName = parts[1];
    const range = parts[3].split("-");
    const startIdx = parseInt(range[0]) - 1;
    const endIdx = parseInt(range[1]) - 1;
    
    const entity = window.allKADDrawingsMap.get(entityName);
    if (!entity) return;
    
    // Generate children HTML for this chunk only
    const chunkChildren = [];
    for (let i = startIdx; i <= endIdx && i < entity.data.length; i++) {
        const element = entity.data[i];
        chunkChildren.push({
            id: entityType + "⣿" + entityName + "⣿element⣿" + (element.pointID || i + 1),
            type: entityType + "⣿element",
            label: "Point " + (element.pointID || i + 1),
            meta: "(" + (element.pointXLocation || 0).toFixed(1) + "...)",
            elementData: { ...element, entityName: entityName }
        });
    }
    
    // Render and insert
    const html = this.renderTree(chunkChildren, 0);
    childrenContainer.innerHTML = html;
    
    // Mark as loaded
    this.loadedChunks.add(nodeId);
}
```

#### Step 5: Add Background Tree Building (Optional Enhancement)
```javascript
// Build tree in chunks using requestIdleCallback
async buildTreeDataAsync() {
    // Build blast data first (usually smaller)
    await this.yieldToEventLoop();
    const blastData = this.buildBlastData();
    
    // Build drawing data in chunks
    await this.yieldToEventLoop();  
    const drawingData = this.buildDrawingDataLazy();
    
    // ... etc
}

yieldToEventLoop() {
    return new Promise(resolve => setTimeout(resolve, 0));
}
```

---

## Solution 2: Surface 2D Canvas Caching

### Strategy: Offscreen Canvas Cache

Render each surface to an offscreen canvas ONCE, then blit to main canvas.

### Implementation Steps:

#### Step 1: Add Cache Storage
```javascript
// In kirra.js or a new SurfaceCache module
const surfaceCanvasCache = new Map();  // surfaceId -> { canvas, ctx, zoomLevel, valid }
```

#### Step 2: Create Cache Update Function
```javascript
function updateSurfaceCache(surfaceId, surface) {
    // Calculate bounds in world coordinates
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    surface.points.forEach(point => {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    });
    
    // Create offscreen canvas sized for the surface
    const padding = 10;
    const width = (maxX - minX) * scale + padding * 2;
    const height = (maxY - minY) * scale + padding * 2;
    
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.ceil(width);
    offscreen.height = Math.ceil(height);
    const offCtx = offscreen.getContext('2d');
    
    // Render all triangles to offscreen canvas
    const surfaceMinZ = Math.min(...surface.points.map(p => p.z));
    const surfaceMaxZ = Math.max(...surface.points.map(p => p.z));
    
    surface.triangles.forEach(triangle => {
        drawTriangleToCache(offCtx, triangle, minX, minY, surfaceMinZ, surfaceMaxZ, 
                           surface.gradient, surface.transparency);
    });
    
    // Store in cache
    surfaceCanvasCache.set(surfaceId, {
        canvas: offscreen,
        ctx: offCtx,
        bounds: { minX, minY, maxX, maxY },
        zoomLevel: scale,
        gradient: surface.gradient,
        transparency: surface.transparency,
        valid: true
    });
}
```

#### Step 3: Modify `drawSurface()` to Use Cache
```javascript
function drawSurface() {
    if (!surfacesGroupVisible) return;
    if (loadedSurfaces.size === 0) return;
    
    loadedSurfaces.forEach((surface, surfaceId) => {
        if (!surface.visible) return;
        
        // 3D rendering (unchanged)
        const should3DRender = threeInitialized && onlyShowThreeJS;
        if (should3DRender) {
            drawSurfaceThreeJS(surfaceId, surface.triangles, ...);
            return;
        }
        
        // 2D rendering - use cache
        if (!onlyShowThreeJS) {
            drawSurfaceFromCache(surfaceId, surface);
        }
    });
}

function drawSurfaceFromCache(surfaceId, surface) {
    let cache = surfaceCanvasCache.get(surfaceId);
    
    // Check if cache needs rebuild
    const needsRebuild = !cache || 
                         !cache.valid ||
                         Math.abs(cache.zoomLevel - scale) > scale * 0.5 ||  // 50% zoom change
                         cache.gradient !== surface.gradient ||
                         cache.transparency !== surface.transparency;
    
    if (needsRebuild) {
        updateSurfaceCache(surfaceId, surface);
        cache = surfaceCanvasCache.get(surfaceId);
    }
    
    // Blit cached canvas to main canvas
    const screenX = (cache.bounds.minX - centroidX) * scale + canvasCenterX;
    const screenY = canvasCenterY - (cache.bounds.minY - centroidY) * scale;
    
    ctx.drawImage(cache.canvas, 
                  screenX, 
                  screenY - cache.canvas.height,
                  cache.canvas.width,
                  cache.canvas.height);
}
```

#### Step 4: Invalidate Cache on Surface Modification
```javascript
function invalidateSurfaceCache(surfaceId) {
    const cache = surfaceCanvasCache.get(surfaceId);
    if (cache) {
        cache.valid = false;
    }
}

// Call invalidateSurfaceCache() when:
// - Surface triangles are added/removed
// - Surface gradient changes
// - Surface transparency changes
// - deleteTrianglesByClippingPolygon()
// - deleteTrianglesByInternalAngle()
// - deleteTrianglesByEdgeLength()
```

---

## Priority Order

1. **TreeView Chunked Loading** (High Impact, Medium Effort)
   - Immediately fixes app freeze on load
   - Users notice this every time they open a file

2. **Surface 2D Caching** (High Impact, Medium Effort)
   - Fixes sluggishness after triangulation
   - Makes large surfaces interactive

3. **Background Tree Building** (Medium Impact, Low Effort)
   - Enhancement to make UI always responsive
   - Can show "Loading tree..." placeholder

---

## Testing Plan

1. Load a DXF with 3000+ points in one entity
   - Verify tree opens quickly
   - Verify grouped nodes appear
   - Verify expanding a group loads children

2. Create a triangulation with 100k+ triangles
   - Verify panning is smooth
   - Verify zooming is smooth
   - Verify gradient change regenerates cache

3. Monitor memory usage
   - Cached canvases use memory
   - May need to implement cache eviction for many surfaces

