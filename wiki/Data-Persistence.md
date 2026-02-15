# Data Persistence

## Overview

Kirra uses **two complementary storage mechanisms** to persist user data and preferences across sessions:

1. **localStorage** - For small, frequently accessed settings
2. **IndexedDB** - For large datasets (blast holes, surfaces, drawings)

This dual-storage approach balances performance, capacity, and data type support.

---

## Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Storage                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │   localStorage   │         │    IndexedDB     │     │
│  │  (5-10 MB max)   │         │  (50 MB - 2 GB)  │     │
│  ├──────────────────┤         ├──────────────────┤     │
│  │ • Theme          │         │ • Blast holes    │     │
│  │ • Language       │         │ • KAD drawings   │     │
│  │ • Snap tolerance │         │ • Surfaces       │     │
│  │ • Display flags  │         │ • Layers         │     │
│  │ • Print settings │         │ • Texture blobs  │     │
│  │ • Pattern params │         │ • OBJ meshes     │     │
│  └──────────────────┘         └──────────────────┘     │
│         ▲                              ▲                │
│         │                              │                │
│    Synchronous                   Asynchronous           │
│    String-based                  Typed data             │
│    Simple key-value              Complex structures     │
└─────────────────────────────────────────────────────────┘
```

---

## localStorage Usage

localStorage stores **user preferences and UI state** that need to be:
- Quickly accessible on startup
- Small in size (< 1 KB per item)
- Frequently updated
- Synchronously read

### Stored Preferences

| Key | Type | Description | Default |
|-----|------|-------------|---------|
| `kirra_theme` | string | UI theme ("dark" or "light") | "dark" |
| `kirra_language` | string | Display language ("en", "ru", "es") | "en" |
| `kirra_snapTolerance` | number | Snap distance in pixels | 10 |
| `kirra_showHoleID` | boolean | Display hole IDs on canvas | true |
| `kirra_showHoleLength` | boolean | Display hole lengths | false |
| `kirra_showHoleDiameter` | boolean | Display hole diameters | false |
| `kirra_showAngle` | boolean | Display hole angles | false |
| `kirra_showDip` | boolean | Display hole dips | false |
| `kirra_showBearing` | boolean | Display hole bearings | false |
| `kirra_showSubdrill` | boolean | Display subdrill values | false |
| `kirra_showTiming` | boolean | Display timing information | false |
| `kirra_showConnectors` | boolean | Show timing connectors | true |
| `kirra_lastPatternName` | string | Last used pattern name | "" |
| `kirra_lastBurden` | number | Last used burden (m) | 5.0 |
| `kirra_lastSpacing` | number | Last used spacing (m) | 6.0 |
| `kirra_lastAngle` | number | Last used hole angle (°) | 0 |
| `kirra_lastBearing` | number | Last used bearing (°) | 0 |
| `kirra_lastDiameter` | number | Last used diameter (mm) | 115 |
| `kirra_lastHoleType` | string | Last used hole type | "Production" |
| `kirra_printIncludeStats` | boolean | Include statistics in PDF | true |
| `kirra_printOrientation` | string | PDF orientation ("portrait"/"landscape") | "landscape" |

### Implementation

#### Saving to localStorage

```javascript
function savePreference(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save preference: " + key, e);
    if (e.name === 'QuotaExceededError') {
      console.warn("localStorage quota exceeded");
    }
  }
}

// Usage examples:
savePreference('kirra_theme', 'dark');
savePreference('kirra_snapTolerance', 10);
savePreference('kirra_showHoleID', true);
```

#### Loading from localStorage

```javascript
function loadPreference(key, defaultValue) {
  try {
    var value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue;
    }
    return JSON.parse(value);
  } catch (e) {
    console.error("Failed to load preference: " + key, e);
    return defaultValue;
  }
}

// Usage examples:
var theme = loadPreference('kirra_theme', 'dark');
var snapTolerance = loadPreference('kirra_snapTolerance', 10);
var showHoleID = loadPreference('kirra_showHoleID', true);
```

#### Initialization on Startup

```javascript
function initializePreferences() {
  // Load theme
  var theme = loadPreference('kirra_theme', 'dark');
  applyTheme(theme);
  
  // Load language
  var language = loadPreference('kirra_language', 'en');
  setLanguage(language);
  
  // Load display options
  window.showHoleIDEnabled = loadPreference('kirra_showHoleID', true);
  window.showHoleLengthEnabled = loadPreference('kirra_showHoleLength', false);
  window.showDiameterEnabled = loadPreference('kirra_showHoleDiameter', false);
  
  // Load snap tolerance
  window.snapTolerance = loadPreference('kirra_snapTolerance', 10);
  
  // Load last pattern parameters
  window.lastPatternName = loadPreference('kirra_lastPatternName', '');
  window.lastBurden = loadPreference('kirra_lastBurden', 5.0);
  window.lastSpacing = loadPreference('kirra_lastSpacing', 6.0);
  
  console.log("Preferences loaded from localStorage");
}

// Call on application load
window.addEventListener('load', initializePreferences);
```

### Clearing localStorage

```javascript
function resetPreferences() {
  var keys = Object.keys(localStorage);
  var kirraKeys = keys.filter(function(key) {
    return key.startsWith('kirra_');
  });
  
  kirraKeys.forEach(function(key) {
    localStorage.removeItem(key);
  });
  
  console.log("Reset " + kirraKeys.length + " preferences");
}
```

---

## IndexedDB Usage

IndexedDB stores **large datasets** that:
- Exceed localStorage capacity (5-10 MB limit)
- Contain complex nested structures
- Include binary data (Blobs, ArrayBuffers)
- Require asynchronous operations

See [IndexedDB Schema](IndexedDB-Schema) for complete database structure.

### Stored Data Types

| Object Store | Data Type | Typical Size | Primary Use |
|--------------|-----------|--------------|-------------|
| **BLASTHOLES** | Blast hole arrays | 1 KB per hole | Pattern storage |
| **KADDRAWINGS** | Vector drawings | 500 B per point | CAD entities |
| **KADSURFACE** | Surface triangulations | 100 KB - 10 MB | 3D terrain |
| **KADLAYERS** | Layer metadata | < 10 KB | Organization |

### Database Operations

#### Opening Database

```javascript
async function openKirraDB() {
  return new Promise((resolve, reject) => {
    var request = indexedDB.open("KirraDB", 1);
    
    request.onsuccess = function(event) {
      resolve(event.target.result);
    };
    
    request.onerror = function(event) {
      reject("Database error: " + event.target.errorCode);
    };
    
    request.onupgradeneeded = function(event) {
      var db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains("blastHoles")) {
        db.createObjectStore("blastHoles", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("kadDrawings")) {
        db.createObjectStore("kadDrawings", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("kadSurfaces")) {
        db.createObjectStore("kadSurfaces", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("kadLayers")) {
        db.createObjectStore("kadLayers", { keyPath: "id" });
      }
    };
  });
}
```

#### Saving Blast Holes

```javascript
async function saveBlastHolesToDB(holes) {
  try {
    var db = await openKirraDB();
    var transaction = db.transaction(["blastHoles"], "readwrite");
    var store = transaction.objectStore("blastHoles");
    
    var data = {
      id: "blastHolesData",
      data: holes,
      timestamp: new Date().toISOString()
    };
    
    var request = store.put(data);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = function() {
        console.log("Saved " + holes.length + " blast holes to IndexedDB");
        resolve();
      };
      request.onerror = function() {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("Failed to save blast holes:", error);
    throw error;
  }
}
```

#### Loading Blast Holes

```javascript
async function loadBlastHolesFromDB() {
  try {
    var db = await openKirraDB();
    var transaction = db.transaction(["blastHoles"], "readonly");
    var store = transaction.objectStore("blastHoles");
    var request = store.get("blastHolesData");
    
    return new Promise((resolve, reject) => {
      request.onsuccess = function() {
        if (request.result) {
          var holes = request.result.data || [];
          console.log("Loaded " + holes.length + " blast holes from IndexedDB");
          resolve(holes);
        } else {
          resolve([]);
        }
      };
      request.onerror = function() {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("Failed to load blast holes:", error);
    return [];
  }
}
```

#### Saving Surfaces with Texture Blobs

```javascript
async function saveSurfaceToDB(surface) {
  try {
    var db = await openKirraDB();
    var transaction = db.transaction(["kadSurfaces"], "readwrite");
    var store = transaction.objectStore("kadSurfaces");
    
    // Surface object includes:
    // - points: 3D vertices
    // - triangles: face definitions
    // - textureBlobs: {filename: Blob} for textures
    // - materialProperties: MTL data
    // - objContent: OBJ file as string
    
    var request = store.put(surface);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = function() {
        console.log("Saved surface: " + surface.id);
        resolve();
      };
      request.onerror = function() {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("Failed to save surface:", error);
    throw error;
  }
}
```

#### Loading All Surfaces

```javascript
async function loadAllSurfacesIntoMemory() {
  try {
    var db = await openKirraDB();
    var transaction = db.transaction(["kadSurfaces"], "readonly");
    var store = transaction.objectStore("kadSurfaces");
    var request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = function() {
        var surfaces = request.result || [];
        
        // Rebuild texture URLs from Blobs
        surfaces.forEach(function(surface) {
          if (surface.textureBlobs) {
            Object.keys(surface.textureBlobs).forEach(function(filename) {
              var blob = surface.textureBlobs[filename];
              var url = URL.createObjectURL(blob);
              surface.textureURLs = surface.textureURLs || {};
              surface.textureURLs[filename] = url;
            });
          }
        });
        
        console.log("Loaded " + surfaces.length + " surfaces from IndexedDB");
        resolve(surfaces);
      };
      request.onerror = function() {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("Failed to load surfaces:", error);
    return [];
  }
}
```

---

## Data Lifecycle

### Import → Edit → Save → Export

```
┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
│  Import  │   →   │   Edit   │   →   │   Save   │   →   │  Export  │
│  (File)  │       │ (Memory) │       │  (IDB)   │       │  (File)  │
└──────────┘       └──────────┘       └──────────┘       └──────────┘
     │                   │                   │                   │
     │                   │                   │                   │
   CSV/DXF         window.allBlastHoles  IndexedDB          CSV/DXF
   OBJ/DTM         window.loadedSurfaces  4 stores          KAD/PDF
   KAD files       window.loadedKADs                        GeoTIFF
```

#### 1. Import Phase

Data flows from files into memory:

```javascript
// CSV import → blast holes
async function importCSVFile(file) {
  var text = await file.text();
  var holes = parseCSV(text);
  
  // Add to in-memory array
  window.allBlastHoles = window.allBlastHoles.concat(holes);
  
  // Don't save to IndexedDB yet (user may want to edit)
  drawData(window.allBlastHoles, window.selectedHole);
}

// OBJ import → surface
async function importOBJFile(objFile, mtlFile, textureFiles) {
  var surface = await parseOBJWithTextures(objFile, mtlFile, textureFiles);
  
  // Add to in-memory Map
  window.loadedSurfaces.set(surface.id, surface);
  
  // Save to IndexedDB immediately (large data)
  await saveSurfaceToDB(surface);
  
  drawSurfaceThreeJS(surface);
}
```

#### 2. Edit Phase

All edits happen in memory for performance:

```javascript
// Edit hole properties
function updateHoleProperties(holeID, updates) {
  var hole = window.allBlastHoles.find(function(h) {
    return h.holeID === holeID;
  });
  
  if (hole) {
    Object.assign(hole, updates);
    
    // Recalculate dependent properties
    recalculateHoleGeometry(hole);
    
    // Redraw canvas
    drawData(window.allBlastHoles, window.selectedHole);
    
    // Don't save to IndexedDB on every edit (too slow)
  }
}
```

#### 3. Save Phase

Explicit save operations persist to IndexedDB:

```javascript
// User clicks "Save Project"
async function saveProject() {
  try {
    // Save blast holes
    await saveBlastHolesToDB(window.allBlastHoles);
    
    // Save drawings
    await saveKADDrawingsCompleteToDB();
    
    // Save layers
    await saveLayersToDB(window.drawingLayers, window.surfaceLayers);
    
    // Surfaces already saved on import
    
    showNotification("Project saved successfully");
  } catch (error) {
    showError("Failed to save project: " + error.message);
  }
}
```

#### 4. Export Phase

Export generates files from in-memory data:

```javascript
// Export to CSV
function exportToCSV() {
  var csv = generateCSV(window.allBlastHoles);
  var blob = new Blob([csv], { type: 'text/csv' });
  downloadFile(blob, 'blast_pattern.csv');
}

// Export to DXF
function exportToDXF() {
  var dxf = generateDXF(window.allBlastHoles, window.loadedKADs);
  var blob = new Blob([dxf], { type: 'application/dxf' });
  downloadFile(blob, 'blast_pattern.dxf');
}

// Export to KAD
async function exportToKAD() {
  var kad = {
    version: "1.0",
    blastHoles: window.allBlastHoles,
    drawings: Array.from(window.loadedKADs.values()),
    surfaces: Array.from(window.loadedSurfaces.keys()),
    layers: {
      drawing: window.drawingLayers,
      surface: window.surfaceLayers
    }
  };
  
  var json = JSON.stringify(kad, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  downloadFile(blob, 'project.kad');
}
```

---

## Performance Considerations

### localStorage Performance

**Advantages**:
- Synchronous access (no async/await needed)
- Instant reads (~0.1ms per key)
- Simple string-based API

**Limitations**:
- 5-10 MB storage limit (browser dependent)
- String-only storage (requires JSON.stringify/parse)
- Blocks main thread on large writes
- No structured queries

**Best Practices**:
```javascript
// ✅ Good: Small, frequently accessed data
localStorage.setItem('kirra_theme', 'dark');

// ❌ Bad: Large arrays
localStorage.setItem('allBlastHoles', JSON.stringify(holes)); // Blocks UI!

// ✅ Good: Batch reads on startup
function loadAllPreferences() {
  var prefs = {};
  var keys = ['kirra_theme', 'kirra_language', 'kirra_snapTolerance'];
  keys.forEach(function(key) {
    prefs[key] = localStorage.getItem(key);
  });
  return prefs;
}
```

### IndexedDB Performance

**Advantages**:
- Large storage capacity (50 MB - 2 GB)
- Asynchronous (doesn't block UI)
- Supports complex data types (Blobs, Arrays, Objects)
- Transactional integrity

**Limitations**:
- Async API (requires promises/callbacks)
- Slower than localStorage (~10-50ms per operation)
- More complex API

**Best Practices**:
```javascript
// ✅ Good: Batch operations in single transaction
async function saveAllData() {
  var db = await openKirraDB();
  var transaction = db.transaction(["blastHoles", "kadDrawings"], "readwrite");
  
  var holesStore = transaction.objectStore("blastHoles");
  var drawingsStore = transaction.objectStore("kadDrawings");
  
  holesStore.put({ id: "blastHolesData", data: window.allBlastHoles });
  drawingsStore.put({ id: "kadDrawingData", data: Array.from(window.loadedKADs) });
  
  return new Promise((resolve, reject) => {
    transaction.oncomplete = function() { resolve(); };
    transaction.onerror = function() { reject(transaction.error); };
  });
}

// ❌ Bad: Multiple separate transactions
async function saveAllDataSlow() {
  await saveBlastHolesToDB(window.allBlastHoles);        // Transaction 1
  await saveKADDrawingsCompleteToDB();                   // Transaction 2
  await saveLayersToDB(window.drawingLayers, window.surfaceLayers); // Transaction 3
}
```

### Memory Management

**In-Memory Data Structures**:
```javascript
window.allBlastHoles = [];           // ~1 KB per hole
window.loadedSurfaces = new Map();   // ~100 KB - 10 MB per surface
window.loadedKADs = new Map();       // ~500 bytes per point
window.loadedImages = new Map();     // ~1-5 MB per image
```

**Memory Optimization**:
```javascript
// Clear unused surface data
function unloadSurface(surfaceId) {
  var surface = window.loadedSurfaces.get(surfaceId);
  
  if (surface.threeJSMesh) {
    // Dispose Three.js resources
    surface.threeJSMesh.geometry.dispose();
    surface.threeJSMesh.material.dispose();
    window.threeRenderer.scene.remove(surface.threeJSMesh);
  }
  
  // Revoke texture URLs
  if (surface.textureURLs) {
    Object.values(surface.textureURLs).forEach(function(url) {
      URL.revokeObjectURL(url);
    });
  }
  
  window.loadedSurfaces.delete(surfaceId);
}

// Clear canvas caches
function invalidateSurfaceCache(surfaceId) {
  if (window.surface2DCache) {
    delete window.surface2DCache[surfaceId];
  }
  if (window.surface3DCache) {
    delete window.surface3DCache[surfaceId];
  }
}
```

### Auto-Save Strategy

Balance between data safety and performance:

```javascript
var AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
var lastSaveTime = Date.now();
var isDirty = false;

// Mark data as needing save
function markDirty() {
  isDirty = true;
}

// Auto-save timer
setInterval(async function() {
  if (isDirty && (Date.now() - lastSaveTime) > AUTO_SAVE_INTERVAL) {
    console.log("Auto-saving project...");
    await saveProject();
    isDirty = false;
    lastSaveTime = Date.now();
  }
}, 60 * 1000); // Check every minute

// Save on page unload
window.addEventListener('beforeunload', function(event) {
  if (isDirty) {
    event.preventDefault();
    event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
  }
});
```

---

## Browser Compatibility

### Storage Support

| Browser | localStorage | IndexedDB | Notes |
|---------|-------------|-----------|-------|
| Chrome 4+ | ✅ 10 MB | ✅ ~60% disk | Full support |
| Firefox 3.5+ | ✅ 10 MB | ✅ ~50% disk | Full support |
| Safari 4+ | ✅ 5 MB | ✅ 1 GB | Quota prompt |
| Edge (all) | ✅ 10 MB | ✅ ~60% disk | Full support |
| Mobile Chrome | ✅ 5-10 MB | ✅ 50-200 MB | Limited on mobile |
| Mobile Safari | ✅ 5 MB | ✅ 50 MB | Aggressive cleanup |

### Quota Management

Check available quota (Chrome/Edge only):

```javascript
async function checkStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    var estimate = await navigator.storage.estimate();
    var usage = estimate.usage || 0;
    var quota = estimate.quota || 0;
    var percentUsed = (usage / quota) * 100;
    
    console.log("Storage used: " + (usage / 1024 / 1024).toFixed(2) + " MB");
    console.log("Storage quota: " + (quota / 1024 / 1024).toFixed(2) + " MB");
    console.log("Percent used: " + percentUsed.toFixed(2) + "%");
    
    if (percentUsed > 80) {
      showWarning("Storage is " + percentUsed.toFixed(0) + "% full. Consider exporting and clearing old data.");
    }
  }
}
```

Request persistent storage (prevents automatic cleanup):

```javascript
async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    var isPersisted = await navigator.storage.persist();
    if (isPersisted) {
      console.log("Storage will not be cleared automatically");
    } else {
      console.log("Storage may be cleared by the browser");
    }
  }
}
```

### Private/Incognito Mode

Storage behaves differently in private browsing:

```javascript
function isPrivateMode() {
  try {
    // Test localStorage (throws in some private modes)
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    return false;
  } catch (e) {
    return true;
  }
}

if (isPrivateMode()) {
  showWarning("Running in private mode. Data will be cleared when you close the browser.");
}
```

---

## Error Handling

### Quota Exceeded

```javascript
async function saveWithQuotaCheck(saveFn) {
  try {
    await saveFn();
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      // Prompt user to free space
      var shouldClear = confirm(
        "Storage is full. Delete old surfaces to make room?"
      );
      
      if (shouldClear) {
        await clearOldSurfaces();
        await saveFn(); // Retry
      }
    } else {
      throw error;
    }
  }
}

async function clearOldSurfaces() {
  var surfaces = Array.from(window.loadedSurfaces.values());
  surfaces.sort(function(a, b) {
    return new Date(a.created) - new Date(b.created);
  });
  
  // Delete oldest 50%
  var toDelete = surfaces.slice(0, Math.floor(surfaces.length / 2));
  for (var i = 0; i < toDelete.length; i++) {
    await deleteSurfaceFromDB(toDelete[i].id);
  }
  
  console.log("Deleted " + toDelete.length + " old surfaces");
}
```

### Database Corruption

```javascript
async function openKirraDBWithRecovery() {
  try {
    return await openKirraDB();
  } catch (error) {
    console.error("Database corrupted:", error);
    
    // Attempt recovery
    var shouldRecover = confirm(
      "Database is corrupted. Delete and start fresh?"
    );
    
    if (shouldRecover) {
      indexedDB.deleteDatabase("KirraDB");
      return await openKirraDB(); // Recreate
    } else {
      throw error;
    }
  }
}
```

---

## Data Export and Backup

### Full Project Backup

```javascript
async function exportFullBackup() {
  var backup = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    
    // localStorage preferences
    preferences: {},
    
    // IndexedDB data
    blastHoles: await loadBlastHolesFromDB(),
    drawings: await loadAllKADDrawingsIntoMemory(),
    layers: await loadLayersFromDB(),
    surfaces: [] // Surface IDs only (textures too large)
  };
  
  // Copy localStorage
  Object.keys(localStorage).forEach(function(key) {
    if (key.startsWith('kirra_')) {
      backup.preferences[key] = localStorage.getItem(key);
    }
  });
  
  // Surface IDs (user must export surfaces separately)
  backup.surfaces = Array.from(window.loadedSurfaces.keys());
  
  var json = JSON.stringify(backup, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  downloadFile(blob, 'kirra_backup_' + Date.now() + '.json');
}
```

### Import Full Backup

```javascript
async function importFullBackup(file) {
  try {
    var text = await file.text();
    var backup = JSON.parse(text);
    
    // Restore preferences to localStorage
    Object.keys(backup.preferences).forEach(function(key) {
      localStorage.setItem(key, backup.preferences[key]);
    });
    
    // Restore blast holes
    window.allBlastHoles = backup.blastHoles || [];
    await saveBlastHolesToDB(window.allBlastHoles);
    
    // Restore drawings
    backup.drawings.forEach(function([entityName, entity]) {
      window.loadedKADs.set(entityName, entity);
    });
    await saveKADDrawingsCompleteToDB();
    
    // Restore layers
    window.drawingLayers = backup.layers.drawingLayers || [];
    window.surfaceLayers = backup.layers.surfaceLayers || [];
    await saveLayersToDB(window.drawingLayers, window.surfaceLayers);
    
    // Note: Surfaces not included in backup (too large)
    showNotification("Backup restored. Import surfaces separately.");
    
    // Reload UI
    initializePreferences();
    drawData(window.allBlastHoles, window.selectedHole);
    updateTreeView();
    
  } catch (error) {
    showError("Failed to restore backup: " + error.message);
  }
}
```

---

## Migration and Versioning

### Version Check on Load

```javascript
var CURRENT_STORAGE_VERSION = 1;

function checkStorageVersion() {
  var version = loadPreference('kirra_storageVersion', 0);
  
  if (version < CURRENT_STORAGE_VERSION) {
    console.log("Migrating storage from version " + version + " to " + CURRENT_STORAGE_VERSION);
    migrateStorage(version, CURRENT_STORAGE_VERSION);
    savePreference('kirra_storageVersion', CURRENT_STORAGE_VERSION);
  }
}

async function migrateStorage(fromVersion, toVersion) {
  if (fromVersion === 0 && toVersion === 1) {
    // Migration 0→1: Add layer structure
    var layers = await loadLayersFromDB();
    if (!layers) {
      await initializeDefaultLayers();
    }
  }
  
  // Future migrations...
}
```

---

## Related Documentation

- [IndexedDB Schema](IndexedDB-Schema) - Complete database structure and ER diagrams
- [File Formats](File-Formats) - Import/export file I/O
- [Blast Design Workflow](Blast-Design-Workflow) - Complete design process
- [Application Architecture](Application-Architecture) - Source code organization

---

*For implementation details, see `src/kirra.js` functions: `openKirraDB()`, `saveBlastHolesToDB()`, `loadPreference()`, `savePreference()`*
