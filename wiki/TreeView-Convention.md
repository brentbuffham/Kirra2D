# TreeView Convention

## ⚠️ CRITICAL WARNING: Braille Separator Character

The TreeView panel uses the **Braille Pattern U+28FF character `⣿`** as a separator in all tree node IDs. This character was **deliberately chosen** because it will **never appear in user data** (entity names, file names, hole IDs, etc.), making it a safe and unambiguous delimiter for composite keys.

### Why This Character?

- **Uniqueness**: Never occurs naturally in mining/CAD data
- **Visibility**: Easy to spot in debugging (not whitespace)
- **Safety**: Cannot be accidentally typed by users
- **Parsing**: Single-character split operation

### ⚠️ CORRUPTION WARNING

> **THIS SEPARATOR HAS BEEN ACCIDENTALLY REPLACED WITH `?` (QUESTION MARK) ON MULTIPLE OCCASIONS DURING EDITS, BREAKING ALL SHOW/HIDE, SELECTION, AND VISIBILITY CASCADING IN THE TREEVIEW.**
>
> **If show/hide stops working, check that `⣿` has not been corrupted to `?` or any other character in `kirra.js` and `TreeView.js`.**

**Common Corruption Scenarios**:
1. Copy-paste from terminals that don't support Unicode
2. Text editor encoding changes
3. Find/replace operations
4. AI code generation replacing with ASCII alternatives

**Verification Test**:
```javascript
// Quick test in browser console:
var testNode = "hole⣿Pattern_A⣿H001";
console.log(testNode.charCodeAt(4)); // Should print: 10495 (U+28FF)
console.log(testNode.split("⣿"));    // Should split correctly
```

---

## Node ID Formats

All node IDs follow the pattern: `prefix⣿part1⣿part2⣿...`

The number of parts varies by node type. Use `.split("⣿")` to parse.

### Complete Node ID Reference Table

| Node Type | Format | Parts | Example |
|---|---|---|---|
| **Blast Entity** | `entity⣿entityName` | 2 | `entity⣿Pattern_A` |
| **Hole** | `hole⣿entityName⣿holeID` | 3 | `hole⣿Pattern_A⣿H001` |
| **KAD Point Entity** | `points⣿entityName` | 2 | `points⣿SurveyPts` |
| **KAD Line Entity** | `line⣿entityName` | 2 | `line⣿Boundary` |
| **KAD Polygon Entity** | `poly⣿entityName` | 2 | `poly⣿Pit_Shell` |
| **KAD Circle Entity** | `circle⣿entityName` | 2 | `circle⣿DrillHoles` |
| **KAD Text Entity** | `text⣿entityName` | 2 | `text⣿Labels` |
| **KAD Element (vertex)** | `entityType⣿entityName⣿element⣿pointID` | 4 | `line⣿Boundary⣿element⣿42` |
| **KAD Chunk (lazy load)** | `entityType⣿entityName⣿chunk⣿start-end` | 4 | `points⣿SurveyPts⣿chunk⣿1-50` |
| **Surface** | `surface⣿surfaceId` | 2 | `surface⣿dtm_001` |
| **Image** | `image⣿imageId` | 2 | `image⣿ortho_01` |
| **Drawing Layer** | `layer-drawing⣿layerId` | 2 | `layer-drawing⣿layer_default_drawings` |
| **Drawing Layer Folder** | `layer-drawing⣿layerId⣿entityTypeFolder` | 3 | `layer-drawing⣿layer_default_drawings⣿points` |
| **Surface Layer** | `layer-surface⣿layerId` | 2 | `layer-surface⣿layer_default_surfaces` |

---

## Entity Type Prefix Mapping

There is a **critical discrepancy** between `entityType` values stored in data vs the node ID prefix used for entity-level nodes:

| Data entityType | Entity-Level Node Prefix | Element-Level Node Prefix |
|---|---|---|
| `"point"` | `"points"` **(with 's')** | `"point"` **(no 's')** |
| `"line"` | `"line"` | `"line"` |
| `"poly"` | `"poly"` | `"poly"` |
| `"circle"` | `"circle"` | `"circle"` |
| `"text"` | `"text"` | `"text"` |

### Why This Exception Exists

The `"point"` → `"points"` mapping is a UI convention for plural folder names:
- **Data storage**: `entityType = "point"` (singular)
- **TreeView entity node**: `points⣿SurveyPts` (plural)
- **TreeView element node**: `point⣿SurveyPts⣿element⣿5` (singular)

**Correct Implementation**:
```javascript
// When constructing entity-level node IDs programmatically:
var entityTypePrefix = entity.entityType === "point" ? "points" : entity.entityType;
var nodeId = entityTypePrefix + "⣿" + entityName;
```

**Example**:
```javascript
// Entity with entityType="point"
var entity = { entityType: "point", entityName: "SurveyPts" };

// Entity-level node ID:
var entityNodeId = "points⣿SurveyPts";  // ✅ CORRECT (plural)

// Element-level node ID:
var elementNodeId = "point⣿SurveyPts⣿element⣿1";  // ✅ CORRECT (singular)

// WRONG:
var wrongNodeId = "point⣿SurveyPts";  // ❌ WRONG (no 's')
```

---

## Tree Hierarchy (Layer-Based Structure)

The TreeView organizes data into four top-level sections with nested layers:

```
blast                                          (top-level)
  entity⣿entityName                           (blast entity group)
    hole⣿entityName⣿holeID                   (individual hole)

drawings                                       (top-level)
  layer-drawing⣿layerId                       (drawing layer)
    layer-drawing⣿layerId⣿points             (entity type folder)
      points⣿entityName                       (individual KAD entity)
        points⣿entityName⣿element⣿pointID   (individual vertex)
    layer-drawing⣿layerId⣿lines
      line⣿entityName
    layer-drawing⣿layerId⣿polygons
      poly⣿entityName
    layer-drawing⣿layerId⣿circles
      circle⣿entityName
    layer-drawing⣿layerId⣿texts
      text⣿entityName

surfaces                                       (top-level)
  layer-surface⣿layerId                       (surface layer)
    surface⣿surfaceId                         (individual surface)

images                                         (top-level)
  image⣿imageId                               (individual image)
```

### Hierarchy Breakdown

#### Blast Section
```
📦 blast
  └─ 📂 entity⣿Pattern_A
      ├─ 🔵 hole⣿Pattern_A⣿H001
      ├─ 🔵 hole⣿Pattern_A⣿H002
      └─ 🔵 hole⣿Pattern_A⣿H003
```

#### Drawings Section (Layer-Based)
```
📦 drawings
  └─ 📂 layer-drawing⣿layer_2025-01-10_12-30
      ├─ 📂 layer-drawing⣿layer_2025-01-10_12-30⣿points
      │   └─ 🔴 points⣿SurveyPts
      │       ├─ 📍 points⣿SurveyPts⣿element⣿1
      │       ├─ 📍 points⣿SurveyPts⣿element⣿2
      │       └─ 📦 points⣿SurveyPts⣿chunk⣿51-100 (lazy load)
      ├─ 📂 layer-drawing⣿layer_2025-01-10_12-30⣿lines
      │   └─ 📏 line⣿Road
      ├─ 📂 layer-drawing⣿layer_2025-01-10_12-30⣿polygons
      │   └─ 🔷 poly⣿Pit_Shell
      ├─ 📂 layer-drawing⣿layer_2025-01-10_12-30⣿circles
      │   └─ ⭕ circle⣿Markers
      └─ 📂 layer-drawing⣿layer_2025-01-10_12-30⣿texts
          └─ 📝 text⣿Labels
```

#### Surfaces Section (Layer-Based)
```
📦 surfaces
  └─ 📂 layer-surface⣿layer_default_surfaces
      ├─ 🗻 surface⣿terrain_001.obj
      └─ 🗻 surface⣿pit_floor.dtm
```

#### Images Section
```
📦 images
  ├─ 🖼️ image⣿ortho_2024_Q1
  └─ 🖼️ image⣿satellite_base
```

---

## Parsing Node IDs

Always use `.split("⣿")` to extract node ID parts:

### Basic Parsing

```javascript
function parseNodeId(nodeId) {
  var parts = nodeId.split("⣿");
  var type = parts[0];                      // e.g. "hole", "line", "layer-drawing"
  var itemId = parts.slice(1).join("⣿");   // remaining parts rejoined
  
  return { type: type, parts: parts, itemId: itemId };
}

// Examples:
parseNodeId("hole⣿Pattern_A⣿H001");
// → { type: "hole", parts: ["hole", "Pattern_A", "H001"], itemId: "Pattern_A⣿H001" }

parseNodeId("line⣿Boundary");
// → { type: "line", parts: ["line", "Boundary"], itemId: "Boundary" }

parseNodeId("layer-drawing⣿layer_123⣿points");
// → { type: "layer-drawing", parts: ["layer-drawing", "layer_123", "points"], itemId: "layer_123⣿points" }
```

### Type-Specific Parsing

```javascript
function parseHoleNodeId(nodeId) {
  var parts = nodeId.split("⣿");
  if (parts.length !== 3 || parts[0] !== "hole") {
    throw new Error("Invalid hole node ID");
  }
  return {
    type: "hole",
    entityName: parts[1],
    holeID: parts[2]
  };
}

function parseEntityNodeId(nodeId) {
  var parts = nodeId.split("⣿");
  if (parts.length !== 2) {
    throw new Error("Invalid entity node ID");
  }
  return {
    entityType: parts[0],
    entityName: parts[1]
  };
}

function parseElementNodeId(nodeId) {
  var parts = nodeId.split("⣿");
  if (parts.length !== 4 || parts[2] !== "element") {
    throw new Error("Invalid element node ID");
  }
  return {
    entityType: parts[0],
    entityName: parts[1],
    pointID: parseInt(parts[3])
  };
}
```

### Layer Node Parsing

```javascript
function parseLayerNodeId(nodeId) {
  var parts = nodeId.split("⣿");
  
  if (parts[0] === "layer-drawing") {
    return {
      type: "drawing-layer",
      layerId: parts[1],
      folder: parts[2] || null  // null if layer, "points"/"lines"/etc if folder
    };
  } else if (parts[0] === "layer-surface") {
    return {
      type: "surface-layer",
      layerId: parts[1]
    };
  }
  
  throw new Error("Invalid layer node ID");
}

// Examples:
parseLayerNodeId("layer-drawing⣿layer_123");
// → { type: "drawing-layer", layerId: "layer_123", folder: null }

parseLayerNodeId("layer-drawing⣿layer_123⣿points");
// → { type: "drawing-layer", layerId: "layer_123", folder: "points" }
```

---

## Visibility Cascading

Visibility in the TreeView is **hierarchical and cascading**:

### Cascading Rules

1. **Layer Visibility**: Hiding a layer hides all entities/folders within it
2. **Folder Visibility**: Hiding an entity type folder hides all entities of that type
3. **Entity Visibility**: Hiding an entity hides all its elements
4. **Element Visibility**: Individual elements can be hidden independently

### Implementation

```javascript
function setNodeVisibility(nodeId, visible) {
  var parts = nodeId.split("⣿");
  var type = parts[0];
  
  if (type === "layer-drawing") {
    // Cascade to all entities in layer
    var layerId = parts[1];
    var folder = parts[2];
    
    if (folder) {
      // Hide all entities in this folder
      setLayerFolderVisibility(layerId, folder, visible);
    } else {
      // Hide entire layer
      setLayerVisibility(layerId, visible);
    }
  } else if (type === "hole") {
    // Set individual hole visibility
    var entityName = parts[1];
    var holeID = parts[2];
    setHoleVisibility(entityName, holeID, visible);
  } else if (["points", "line", "poly", "circle", "text"].includes(type)) {
    var entityName = parts[1];
    if (parts[2] === "element") {
      // Hide individual element
      setElementVisibility(type, entityName, parts[3], visible);
    } else {
      // Hide entire entity
      setEntityVisibility(type, entityName, visible);
    }
  }
}
```

### Example Cascade

```
❌ layer-drawing⣿layer_123 (hidden)
  └─ ❌ layer-drawing⣿layer_123⣿points (hidden by layer)
      └─ ❌ points⣿SurveyPts (hidden by layer)
          └─ ❌ points⣿SurveyPts⣿element⣿1 (hidden by layer)
```

If you toggle `points⣿SurveyPts` to visible while layer is hidden:
```
❌ layer-drawing⣿layer_123 (hidden)
  └─ ❌ layer-drawing⣿layer_123⣿points (hidden by layer)
      └─ ✅ points⣿SurveyPts (visible, but not rendered due to layer)
          └─ ❌ points⣿SurveyPts⣿element⣿1 (hidden by parent visibility)
```

The entity's `visible` property is `true`, but it won't render because the parent layer is hidden.

---

## Lazy Loading with Chunks

Large entities (thousands of points) use chunked loading:

### Chunk Node Format

```
entityType⣿entityName⣿chunk⣿start-end
```

Example: `points⣿SurveyPts⣿chunk⣿51-100`

### Chunk Implementation

```javascript
var CHUNK_SIZE = 50;

function createChunkedNodes(entity) {
  var nodes = [];
  var totalPoints = entity.data.length;
  
  for (var i = 0; i < totalPoints; i += CHUNK_SIZE) {
    var start = i + 1;
    var end = Math.min(i + CHUNK_SIZE, totalPoints);
    
    var chunkNodeId = entity.entityType + "⣿" + 
                      entity.entityName + "⣿" + 
                      "chunk⣿" + start + "-" + end;
    
    nodes.push({
      nodeId: chunkNodeId,
      label: "Points " + start + "-" + end,
      hasChildren: false
    });
  }
  
  return nodes;
}
```

### Expanding Chunks

When a chunk node is expanded, load the actual element nodes:

```javascript
function expandChunkNode(chunkNodeId) {
  var parts = chunkNodeId.split("⣿");
  var entityType = parts[0];
  var entityName = parts[1];
  var range = parts[3].split("-");
  var start = parseInt(range[0]);
  var end = parseInt(range[1]);
  
  var entity = findEntity(entityType, entityName);
  var elementNodes = [];
  
  for (var i = start - 1; i < end; i++) {
    var point = entity.data[i];
    var elementNodeId = entityType + "⣿" + entityName + "⣿element⣿" + point.pointID;
    
    elementNodes.push({
      nodeId: elementNodeId,
      label: "Point " + point.pointID,
      hasChildren: false
    });
  }
  
  return elementNodes;
}
```

---

## Selection and Highlighting

The TreeView supports:
- **Single selection**: One node at a time
- **Highlighting**: Visual feedback for selected node
- **Synchronization**: Canvas selection syncs with TreeView

### Selection Flow

1. User clicks canvas → selects hole
2. `selectTreeNode("hole⣿Pattern_A⣿H001")` called
3. TreeView highlights node with CSS class
4. Parent nodes expand if collapsed

### Implementation

```javascript
function selectTreeNode(nodeId) {
  // Clear previous selection
  document.querySelectorAll('.tree-node-selected').forEach(function(el) {
    el.classList.remove('tree-node-selected');
  });
  
  // Find and select new node
  var nodeElement = document.querySelector('[data-node-id="' + nodeId + '"]');
  if (nodeElement) {
    nodeElement.classList.add('tree-node-selected');
    
    // Expand parent nodes
    expandParentNodes(nodeId);
    
    // Scroll into view
    nodeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function expandParentNodes(nodeId) {
  var parts = nodeId.split("⣿");
  
  // Build parent node IDs
  for (var i = 1; i < parts.length; i++) {
    var parentNodeId = parts.slice(0, i).join("⣿");
    var parentElement = document.querySelector('[data-node-id="' + parentNodeId + '"]');
    if (parentElement) {
      parentElement.classList.add('tree-node-expanded');
    }
  }
}
```

---

## Files That Use This Convention

The TreeView convention is implemented across multiple files:

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/dialog/tree/TreeView.js` | Main TreeView implementation | `buildTree()`, `toggleVisibility()`, `selectNode()` |
| `src/kirra.js` | Visibility state management | `updateTreeViewVisibilityStates()`, `handleTreeViewVisibility()` |
| `src/kirra.js` | Selection synchronization | `selectTreeNodeFromCanvas()`, `selectHoleFromTree()` |
| `src/kirra.js` | Layer operations | `deleteLayerFromTreeView()`, `renameLayerInTreeView()` |

### Key Function Examples

#### TreeView.js

```javascript
// Building blast entity nodes
var entityNodeId = "entity⣿" + entityName;
var holeNodeId = "hole⣿" + entityName + "⣿" + hole.holeID;

// Building KAD entity nodes
var entityTypePrefix = entity.entityType === "point" ? "points" : entity.entityType;
var entityNodeId = entityTypePrefix + "⣿" + entity.entityName;

// Building element nodes
var elementNodeId = entity.entityType + "⣿" + entity.entityName + "⣿element⣿" + point.pointID;

// Building layer nodes
var layerNodeId = "layer-drawing⣿" + layer.layerId;
var folderNodeId = "layer-drawing⣿" + layer.layerId + "⣿points";
```

#### kirra.js

```javascript
function handleTreeViewVisibility(nodeId, visible) {
  var parts = nodeId.split("⣿");
  var type = parts[0];
  
  if (type === "hole") {
    var entityName = parts[1];
    var holeID = parts[2];
    setBlastHoleVisibility(entityName, holeID, visible);
  } else if (type === "entity") {
    var entityName = parts[1];
    setEntityVisibility(entityName, visible);
  } else if (type === "layer-drawing") {
    var layerId = parts[1];
    var folder = parts[2];
    if (folder) {
      setLayerFolderVisibility(layerId, folder, visible);
    } else {
      setDrawingLayerVisibility(layerId, visible);
    }
  }
  // ... more cases
}
```

---

## Testing and Validation

### Separator Integrity Check

Add this to startup validation:

```javascript
function validateSeparator() {
  var testSeparator = "⣿";
  var expectedCharCode = 10495; // U+28FF
  
  if (testSeparator.charCodeAt(0) !== expectedCharCode) {
    console.error("CRITICAL: TreeView separator corrupted!");
    console.error("Expected U+28FF (⣿), got: " + testSeparator.charCodeAt(0).toString(16));
    alert("TreeView separator corrupted. Contact developer.");
    return false;
  }
  
  return true;
}

// Run on startup
window.addEventListener('load', function() {
  if (!validateSeparator()) {
    // Disable TreeView functionality
    document.getElementById('treeViewPanel').style.display = 'none';
  }
});
```

### Node ID Format Validation

```javascript
function validateNodeId(nodeId, expectedType) {
  var parts = nodeId.split("⣿");
  
  if (parts.length === 0) {
    throw new Error("Invalid node ID: empty");
  }
  
  if (expectedType && parts[0] !== expectedType) {
    throw new Error("Invalid node ID type. Expected: " + expectedType + ", got: " + parts[0]);
  }
  
  // Validate no empty parts
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === "") {
      throw new Error("Invalid node ID: empty part at index " + i);
    }
  }
  
  return true;
}
```

---

## Migration and Compatibility

### Fixing Corrupted Node IDs

If the separator has been corrupted to `?`, run this migration:

```javascript
function fixCorruptedNodeIds() {
  var corruptedSeparator = "?";
  var correctSeparator = "⣿";
  
  // Fix in-memory data
  window.allBlastHoles.forEach(function(hole) {
    if (hole.entityName && hole.entityName.includes(corruptedSeparator)) {
      hole.entityName = hole.entityName.replace(new RegExp(corruptedSeparator, 'g'), correctSeparator);
    }
  });
  
  // Fix in DOM
  document.querySelectorAll('[data-node-id]').forEach(function(el) {
    var nodeId = el.getAttribute('data-node-id');
    if (nodeId.includes(corruptedSeparator)) {
      el.setAttribute('data-node-id', nodeId.replace(new RegExp(corruptedSeparator, 'g'), correctSeparator));
    }
  });
  
  console.log("Fixed corrupted node IDs");
}
```

### Backward Compatibility

If old data exists with different separators, convert on load:

```javascript
function normalizeNodeId(nodeId) {
  // List of historical separators that may have been used
  var oldSeparators = ["|", "/", ":", "?"];
  var correctSeparator = "⣿";
  
  for (var i = 0; i < oldSeparators.length; i++) {
    if (nodeId.includes(oldSeparators[i])) {
      return nodeId.replace(new RegExp("\\" + oldSeparators[i], 'g'), correctSeparator);
    }
  }
  
  return nodeId;
}
```

---

## Best Practices

### DO:
✅ Always use `.split("⣿")` to parse node IDs  
✅ Validate separator on application startup  
✅ Use `entityType === "point" ? "points" : entityType` for entity nodes  
✅ Document any new node ID formats in this file  
✅ Test visibility cascading after adding new node types  

### DON'T:
❌ Hard-code separator character in multiple places (use constant)  
❌ Assume node ID format without parsing  
❌ Use `.indexOf()` or `.includes()` without considering multiple parts  
❌ Copy-paste code from terminals that mangle Unicode  
❌ Edit this file without UTF-8 encoding  

### Recommended Constants

Define separator as constant at top of files:

```javascript
// At top of TreeView.js and kirra.js
var TREE_NODE_SEPARATOR = "⣿";  // U+28FF Braille Pattern

// Usage:
var nodeId = "hole" + TREE_NODE_SEPARATOR + entityName + TREE_NODE_SEPARATOR + holeID;
var parts = nodeId.split(TREE_NODE_SEPARATOR);
```

---

## Related Documentation

- [IndexedDB Schema](IndexedDB-Schema) - Database structure with entity relationships
- [User Interface](User-Interface) - TreeView panel UI documentation
- [Blast Hole Management](Blast-Hole-Management) - Hole data structures
- [Application Architecture](Application-Architecture) - Source code organization

---

*For implementation details, see `src/dialog/tree/TreeView.js` and visibility functions in `src/kirra.js`*
