/**
 * AnalysisCache.js - Two-Level Caching System for Voronoi, Slope, and Relief Maps
 * 
 * Level 1: Computational Pre-Cache
 *   - Pre-computes expensive calculations (Delaunator, ClipperLib) in background
 *   - Triggered after hole save/undo/redo operations
 *   - Survives metric changes, small zoom changes
 * 
 * Level 2: Canvas Cache
 *   - Pre-renders final image to offscreen canvas
 *   - Fast blit (~1-2ms) during pan/zoom
 *   - Invalidated on zoom threshold breach, metric change, data change
 * 
 * Created: 2026-01-22
 */

// ============================================================================
// #region CONFIGURATION
// ============================================================================

var ANALYSIS_CACHE_ZOOM_THRESHOLD = 1.5;  // Re-render if zoom changes by more than 50%
var ANALYSIS_CACHE_OVERSAMPLE = 1.0;      // Render at 1x resolution
var ANALYSIS_CACHE_MAX_SIZE = 4096;       // Max canvas dimension to prevent memory issues
var ANALYSIS_CACHE_MIN_HOLES = 10;        // Don't cache for very small datasets

// #endregion CONFIGURATION

// ============================================================================
// #region LEVEL 1: COMPUTATIONAL PRE-CACHES
// ============================================================================

// Step 1) Voronoi computational pre-cache
var voronoiPreCache = {
    holeCount: 0,
    holeDataHash: null,
    useToeLocation: false,
    voronoiMetrics: null,     // Delaunator voronoi results
    clippedCells: null,       // ClipperLib clipped cells
    timestamp: 0
};

// Step 2) Triangulation pre-cache (shared by Slope and Relief)
var triangulationPreCache = {
    holeCount: 0,
    holeDataHash: null,
    maxEdgeLength: null,
    resultTriangles: null,    // For Slope (geometry + elevation)
    reliefTriangles: null,    // For Relief (geometry + timing)
    timestamp: 0
};

// #endregion LEVEL 1

// ============================================================================
// #region LEVEL 2: CANVAS CACHES
// ============================================================================

// Step 3) Voronoi canvas cache - keyed by metric since colors differ
var voronoi2DCache = new Map();  // metric -> {canvas, zoom, bounds, holeDataHash, minValue, maxValue}

// Step 4) Slope canvas cache - single since colors are deterministic
var slope2DCache = null;  // {canvas, zoom, bounds, holeDataHash}

// Step 5) Relief canvas cache - single since colors are deterministic  
var relief2DCache = null;  // {canvas, zoom, bounds, holeDataHash}

// Step 5a) CRITICAL: Version counter for ultra-fast cache validation
// Instead of recalculating hash every frame, we use a simple incrementing counter
// that gets bumped whenever hole data changes
var analysisDataVersion = 0;
var lastKnownHoleCount = 0;

// Expose the cache map and version to window for kirra.js and canvas3DDrawing.js access
if (typeof window !== "undefined") {
    window.voronoi2DCache = voronoi2DCache;
    window.analysisDataVersion = analysisDataVersion;
}

// #endregion LEVEL 2

// ============================================================================
// #region HASH FUNCTIONS
// ============================================================================

/**
 * Step 6) Bump the data version - call this when holes change
 * This is MUCH faster than recalculating hash every frame
 */
function bumpDataVersion() {
    analysisDataVersion++;
    // Update window reference for 3D caching
    if (typeof window !== "undefined") {
        window.analysisDataVersion = analysisDataVersion;
    }
    console.log("📊 Analysis data version bumped to: " + analysisDataVersion);
}

/**
 * Step 6a) Get current data version (fast check)
 */
function getDataVersion() {
    return analysisDataVersion;
}

/**
 * Step 6b) Generate a hash of hole data to detect changes
 * Uses position and timing data for fast change detection
 * NOTE: Only call this when data actually changes, not every frame!
 * @param {Array} allBlastHoles - Array of blast hole objects
 * @returns {number} Hash value
 */
function getHoleDataHash(allBlastHoles) {
    if (!allBlastHoles || allBlastHoles.length === 0) return 0;
    
    var hash = allBlastHoles.length;
    
    // Sample holes for hash (every 10th hole for large datasets)
    var step = allBlastHoles.length > 100 ? Math.floor(allBlastHoles.length / 10) : 1;
    
    for (var i = 0; i < allBlastHoles.length; i += step) {
        var h = allBlastHoles[i];
        // Include position and timing in hash
        hash = ((hash << 5) - hash) + (h.startXLocation || 0);
        hash = ((hash << 5) - hash) + (h.startYLocation || 0);
        hash = ((hash << 5) - hash) + (h.holeTime || 0);
        hash = hash | 0; // Convert to 32-bit integer
    }
    
    return hash;
}

/**
 * Step 7) Generate timing-specific hash for relief map
 * Relief map specifically depends on hole timing values
 * @param {Array} allBlastHoles - Array of blast hole objects
 * @returns {number} Hash value including timing
 */
function getTimingHash(allBlastHoles) {
    if (!allBlastHoles || allBlastHoles.length === 0) return 0;
    
    var hash = allBlastHoles.length;
    
    for (var i = 0; i < allBlastHoles.length; i++) {
        var h = allBlastHoles[i];
        hash = ((hash << 5) - hash) + (h.holeTime || 0);
        hash = ((hash << 5) - hash) + (h.timingDelayMilliseconds || 0);
        hash = hash | 0;
    }
    
    return hash;
}

// #endregion HASH FUNCTIONS

// ============================================================================
// #region LEVEL 1: CACHE VALIDATION & PRE-COMPUTATION
// ============================================================================

/**
 * Step 8) Check if Voronoi computational cache is valid
 * OPTIMIZED: Uses dataVersion (simple integer) instead of recalculating hash every frame
 */
function isVoronoiPreCacheValid(allBlastHoles, useToeLocation) {
    // Step 8a) Check if cache exists
    if (!voronoiPreCache.clippedCells) return false;
    
    // Step 8b) FAST CHECK: Compare dataVersion (integer comparison)
    // dataVersion is bumped by bumpDataVersion() when hole data changes
    if (voronoiPreCache.dataVersion !== analysisDataVersion) return false;
    
    // Step 8c) Check if useToeLocation changed
    if (voronoiPreCache.useToeLocation !== useToeLocation) return false;
    
    return true;
}

/**
 * Step 9) Check if triangulation pre-cache is valid
 */
function isTriangulationPreCacheValid(allBlastHoles, maxEdgeLength) {
    if (!triangulationPreCache.resultTriangles) return false;
    if (triangulationPreCache.holeCount !== allBlastHoles.length) return false;
    if (triangulationPreCache.maxEdgeLength !== maxEdgeLength) return false;
    
    var currentHash = getHoleDataHash(allBlastHoles);
    if (triangulationPreCache.holeDataHash !== currentHash) return false;
    
    return true;
}

/**
 * Step 10) Pre-compute Voronoi calculations in background
 * Call this after debouncedSaveHoles or undo/redo
 */
function preCacheVoronoiCalculations(allBlastHoles, useToeLocation, getVoronoiMetrics, clipVoronoiCells) {
    // Step 10a) Skip if too few holes
    if (!allBlastHoles || allBlastHoles.length < ANALYSIS_CACHE_MIN_HOLES) {
        return;
    }
    
    // Step 10b) Skip if already cached at current dataVersion
    if (voronoiPreCache.dataVersion === analysisDataVersion && 
        voronoiPreCache.useToeLocation === useToeLocation) {
        return;
    }
    
    try {
        // Step 10c) Compute expensive Voronoi metrics (Delaunator)
        var voronoiMetrics = getVoronoiMetrics(allBlastHoles, useToeLocation);
        
        // Step 10d) Compute expensive clipping operations (ClipperLib)
        var clippedCells = clipVoronoiCells(voronoiMetrics);
        
        // Step 10e) Store results with dataVersion for FAST validation
        voronoiPreCache = {
            dataVersion: analysisDataVersion,
            useToeLocation: useToeLocation,
            voronoiMetrics: voronoiMetrics,
            clippedCells: clippedCells,
            timestamp: Date.now()
        };
        
        console.log("🔄 Pre-cached Voronoi calculations for " + allBlastHoles.length + " holes (" + clippedCells.length + " cells) at dataVersion: " + analysisDataVersion);
        
    } catch (error) {
        console.warn("Failed to pre-cache Voronoi:", error);
    }
}

/**
 * Step 11) Pre-compute triangulation for Slope/Relief
 */
function preCacheTriangulation(allBlastHoles, maxEdgeLength, delaunayTriangles) {
    // Step 11a) Skip if too few holes
    if (!allBlastHoles || allBlastHoles.length < ANALYSIS_CACHE_MIN_HOLES) {
        return;
    }
    
    // Step 11b) Skip if already cached
    var currentHash = getHoleDataHash(allBlastHoles);
    if (triangulationPreCache.holeDataHash === currentHash && 
        triangulationPreCache.maxEdgeLength === maxEdgeLength) {
        return;
    }
    
    try {
        // Step 11c) Compute triangulation
        var result = delaunayTriangles(allBlastHoles, maxEdgeLength);
        
        // Step 11d) Store results
        triangulationPreCache = {
            holeCount: allBlastHoles.length,
            holeDataHash: currentHash,
            maxEdgeLength: maxEdgeLength,
            resultTriangles: result.resultTriangles,
            reliefTriangles: result.reliefTriangles,
            timestamp: Date.now()
        };
        
        console.log("🔄 Pre-cached triangulation for " + allBlastHoles.length + " holes (" + 
                    (result.resultTriangles ? result.resultTriangles.length : 0) + " slope, " +
                    (result.reliefTriangles ? result.reliefTriangles.length : 0) + " relief triangles)");
        
    } catch (error) {
        console.warn("Failed to pre-cache triangulation:", error);
    }
}

/**
 * Step 12) Get cached or compute Voronoi clipped cells
 * IMPORTANT: Also populates Level 1 cache when computing
 */
function getCachedVoronoiCells(allBlastHoles, useToeLocation, getVoronoiMetrics, clipVoronoiCells) {
    // Check if pre-cache is valid - SILENT for performance (called every frame)
    if (isVoronoiPreCacheValid(allBlastHoles, useToeLocation)) {
        return voronoiPreCache.clippedCells;
    }
    
    // Fallback to live calculation - store in Level 1 cache
    // This only happens when data changes (dataVersion bumped), not during pan/zoom
    var voronoiMetrics = getVoronoiMetrics(allBlastHoles, useToeLocation);
    var clippedCells = clipVoronoiCells(voronoiMetrics);
    
    // Store in Level 1 cache using dataVersion (fast integer comparison on next check)
    voronoiPreCache = {
        dataVersion: analysisDataVersion,
        useToeLocation: useToeLocation,
        voronoiMetrics: voronoiMetrics,
        clippedCells: clippedCells,
        timestamp: Date.now()
    };
    
    return clippedCells;
}

/**
 * Step 13) Get cached or compute triangulation
 */
function getCachedTriangulation(allBlastHoles, maxEdgeLength, delaunayTriangles) {
    // Check if pre-cache is valid
    if (isTriangulationPreCacheValid(allBlastHoles, maxEdgeLength)) {
        console.log("⚡ Using pre-cached triangulation");
        return {
            resultTriangles: triangulationPreCache.resultTriangles,
            reliefTriangles: triangulationPreCache.reliefTriangles
        };
    }
    
    // Fallback to live calculation
    console.log("📊 Computing triangulation (cache miss)");
    return delaunayTriangles(allBlastHoles, maxEdgeLength);
}

// #endregion LEVEL 1

// ============================================================================
// #region LEVEL 2: CANVAS CACHE VALIDATION
// ============================================================================

/**
 * Step 14) Check if Voronoi canvas cache is valid for current view
 * OPTIMIZED: Uses version number instead of recalculating hash every frame
 */
function isVoronoiCanvasCacheValid(metric, currentScale, allBlastHoles) {
    var cache = voronoi2DCache.get(metric);
    if (!cache) return false;
    
    // FAST CHECK: Use version number instead of expensive hash recalculation
    if (cache.dataVersion !== analysisDataVersion) return false;
    
    // Check zoom threshold (fast comparison)
    var zoomRatio = currentScale / cache.zoom;
    if (zoomRatio > ANALYSIS_CACHE_ZOOM_THRESHOLD || zoomRatio < (1 / ANALYSIS_CACHE_ZOOM_THRESHOLD)) {
        return false;
    }
    
    return true;
}

/**
 * Step 15) Check if Slope canvas cache is valid
 * OPTIMIZED: Uses version number instead of recalculating hash every frame
 */
function isSlopeCanvasCacheValid(currentScale, allBlastHoles) {
    if (!slope2DCache) return false;
    
    // FAST CHECK: Use version number
    if (slope2DCache.dataVersion !== analysisDataVersion) return false;
    
    var zoomRatio = currentScale / slope2DCache.zoom;
    if (zoomRatio > ANALYSIS_CACHE_ZOOM_THRESHOLD || zoomRatio < (1 / ANALYSIS_CACHE_ZOOM_THRESHOLD)) {
        return false;
    }
    
    return true;
}

/**
 * Step 16) Check if Relief canvas cache is valid
 * OPTIMIZED: Uses version number instead of recalculating hash every frame
 * Note: Timing changes are tracked via bumpDataVersion() when debouncedSaveHoles is called
 */
function isReliefCanvasCacheValid(currentScale, allBlastHoles) {
    if (!relief2DCache) return false;
    
    // FAST CHECK: Use version number (includes timing changes)
    if (relief2DCache.dataVersion !== analysisDataVersion) return false;
    
    var zoomRatio = currentScale / relief2DCache.zoom;
    if (zoomRatio > ANALYSIS_CACHE_ZOOM_THRESHOLD || zoomRatio < (1 / ANALYSIS_CACHE_ZOOM_THRESHOLD)) {
        return false;
    }
    
    return true;
}

// #endregion LEVEL 2 VALIDATION

// ============================================================================
// #region LEVEL 2: VORONOI CANVAS RENDERING
// ============================================================================

/**
 * Step 17) Render Voronoi cells to offscreen canvas cache
 */
function renderVoronoiToCache(metric, clippedCells, allBlastHoles, currentScale, centroidX, centroidY, getColorForMetric) {
    // Step 17a) Skip if no cells
    if (!clippedCells || clippedCells.length === 0) {
        return null;
    }
    
    // Step 17b) Calculate bounds from clipped cells
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (var i = 0; i < clippedCells.length; i++) {
        var cell = clippedCells[i];
        if (!cell.polygon) continue;
        
        for (var j = 0; j < cell.polygon.length; j++) {
            var pt = cell.polygon[j];
            var x = pt.x !== undefined ? pt.x : pt[0];
            var y = pt.y !== undefined ? pt.y : pt[1];
            
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    
    // Step 17c) Add padding to bounds (5% each side)
    var padX = (maxX - minX) * 0.05;
    var padY = (maxY - minY) * 0.05;
    minX -= padX; maxX += padX;
    minY -= padY; maxY += padY;
    
    // Step 17d) Calculate canvas size
    var worldWidth = maxX - minX;
    var worldHeight = maxY - minY;
    var cacheWidth = Math.ceil(worldWidth * currentScale * ANALYSIS_CACHE_OVERSAMPLE);
    var cacheHeight = Math.ceil(worldHeight * currentScale * ANALYSIS_CACHE_OVERSAMPLE);
    
    // Step 17e) Limit max cache size
    if (cacheWidth > ANALYSIS_CACHE_MAX_SIZE || cacheHeight > ANALYSIS_CACHE_MAX_SIZE) {
        var scaleDown = ANALYSIS_CACHE_MAX_SIZE / Math.max(cacheWidth, cacheHeight);
        cacheWidth = Math.ceil(cacheWidth * scaleDown);
        cacheHeight = Math.ceil(cacheHeight * scaleDown);
    }
    
    // Minimum size
    if (cacheWidth < 10 || cacheHeight < 10) {
        return null;
    }
    
    // Step 17f) Create offscreen canvas
    var cacheCanvas = document.createElement("canvas");
    cacheCanvas.width = cacheWidth;
    cacheCanvas.height = cacheHeight;
    var cacheCtx = cacheCanvas.getContext("2d");
    
    // Step 17g) Set up transform: cache canvas origin is at (minX, maxY) in world coords
    var cacheScale = cacheWidth / worldWidth;
    
    // Step 17h) Clear canvas
    cacheCtx.clearRect(0, 0, cacheWidth, cacheHeight);
    
    // Step 17i) Draw each cell to cache canvas
    for (var i = 0; i < clippedCells.length; i++) {
        var cell = clippedCells[i];
        var value = cell[metric];
        if (!cell.polygon || value == null) continue;
        
        cacheCtx.beginPath();
        
        for (var j = 0; j < cell.polygon.length; j++) {
            var pt = cell.polygon[j];
            var wx = pt.x !== undefined ? pt.x : pt[0];
            var wy = pt.y !== undefined ? pt.y : pt[1];
            
            // Convert world coords to cache canvas coords
            var cx = (wx - minX) * cacheScale;
            var cy = (maxY - wy) * cacheScale; // Y flipped
            
            if (j === 0) cacheCtx.moveTo(cx, cy);
            else cacheCtx.lineTo(cx, cy);
        }
        
        cacheCtx.closePath();
        cacheCtx.fillStyle = getColorForMetric(value);
        cacheCtx.fill();
        cacheCtx.strokeStyle = "#222";
        cacheCtx.lineWidth = 1;
        cacheCtx.stroke();
    }
    
    // Step 17j) Store cache entry (use dataVersion for FAST validation)
    var cacheEntry = {
        canvas: cacheCanvas,
        zoom: currentScale,
        bounds: { minX: minX, maxX: maxX, minY: minY, maxY: maxY },
        dataVersion: analysisDataVersion,
        metric: metric
    };
    
    voronoi2DCache.set(metric, cacheEntry);
    
    console.log("📦 Voronoi canvas cache created for " + metric + ": " + cacheWidth + "x" + cacheHeight);
    
    return cacheEntry;
}

/**
 * Step 18) Draw cached Voronoi canvas to main canvas
 */
function drawCachedVoronoi(cache, ctx, canvas, currentScale, centroidX, centroidY) {
    if (!cache || !cache.canvas) return false;
    
    // Step 18a) Calculate where to draw the cached image on main canvas
    // Convert world bounds to canvas coordinates
    var topLeftX = (cache.bounds.minX - centroidX) * currentScale + canvas.width / 2;
    var topLeftY = (-cache.bounds.maxY + centroidY) * currentScale + canvas.height / 2;
    var bottomRightX = (cache.bounds.maxX - centroidX) * currentScale + canvas.width / 2;
    var bottomRightY = (-cache.bounds.minY + centroidY) * currentScale + canvas.height / 2;
    
    var destWidth = bottomRightX - topLeftX;
    var destHeight = bottomRightY - topLeftY;
    
    // Step 18b) Draw the cached canvas image
    ctx.drawImage(cache.canvas, topLeftX, topLeftY, destWidth, destHeight);
    
    return true;
}

// #endregion VORONOI CANVAS

// ============================================================================
// #region LEVEL 2: SLOPE CANVAS RENDERING
// ============================================================================

/**
 * Step 19) Get slope color for a given angle (extracted from drawDelauanySlopeMap)
 */
function getSlopeColor(maxSlopeAngle) {
    if (maxSlopeAngle >= 0 && maxSlopeAngle < 5) {
        return "rgb(51, 139, 255)";  // Cornflower blue
    } else if (maxSlopeAngle >= 5 && maxSlopeAngle < 7) {
        return "rgb(0, 102, 204)";
    } else if (maxSlopeAngle >= 7 && maxSlopeAngle < 9) {
        return "rgb(0, 204, 204)";
    } else if (maxSlopeAngle >= 9 && maxSlopeAngle < 12) {
        return "rgb(102, 204, 0)";
    } else if (maxSlopeAngle >= 12 && maxSlopeAngle < 15) {
        return "rgb(204, 204, 0)";
    } else if (maxSlopeAngle >= 15 && maxSlopeAngle < 17) {
        return "rgb(255, 128, 0)";
    } else if (maxSlopeAngle >= 17 && maxSlopeAngle < 20) {
        return "rgb(255, 0, 0)";
    } else {
        return "rgb(153, 0, 76)";  // Default dark pink
    }
}

/**
 * Step 20) Render Slope map to offscreen canvas cache
 */
function renderSlopeToCache(resultTriangles, allBlastHoles, currentScale, centroidX, centroidY, getDipAngle) {
    // Step 20a) Skip if no triangles
    if (!resultTriangles || resultTriangles.length === 0) {
        return null;
    }
    
    // Step 20b) Calculate bounds from triangles
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (var i = 0; i < resultTriangles.length; i++) {
        var tri = resultTriangles[i];
        for (var j = 0; j < 3; j++) {
            var x = tri[j][0];
            var y = tri[j][1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    
    // Step 20c) Add padding
    var padX = (maxX - minX) * 0.05;
    var padY = (maxY - minY) * 0.05;
    minX -= padX; maxX += padX;
    minY -= padY; maxY += padY;
    
    // Step 20d) Calculate canvas size
    var worldWidth = maxX - minX;
    var worldHeight = maxY - minY;
    var cacheWidth = Math.ceil(worldWidth * currentScale * ANALYSIS_CACHE_OVERSAMPLE);
    var cacheHeight = Math.ceil(worldHeight * currentScale * ANALYSIS_CACHE_OVERSAMPLE);
    
    // Limit size
    if (cacheWidth > ANALYSIS_CACHE_MAX_SIZE || cacheHeight > ANALYSIS_CACHE_MAX_SIZE) {
        var scaleDown = ANALYSIS_CACHE_MAX_SIZE / Math.max(cacheWidth, cacheHeight);
        cacheWidth = Math.ceil(cacheWidth * scaleDown);
        cacheHeight = Math.ceil(cacheHeight * scaleDown);
    }
    
    if (cacheWidth < 10 || cacheHeight < 10) {
        return null;
    }
    
    // Step 20e) Create offscreen canvas
    var cacheCanvas = document.createElement("canvas");
    cacheCanvas.width = cacheWidth;
    cacheCanvas.height = cacheHeight;
    var cacheCtx = cacheCanvas.getContext("2d");
    
    var cacheScale = cacheWidth / worldWidth;
    cacheCtx.clearRect(0, 0, cacheWidth, cacheHeight);
    
    // Step 20f) Draw each triangle
    for (var i = 0; i < resultTriangles.length; i++) {
        var triangle = resultTriangles[i];
        
        // Get dip angle for coloring
        var maxSlopeAngle = getDipAngle(triangle);
        var fillColor = getSlopeColor(maxSlopeAngle);
        
        // Calculate RGB for stroke
        var minRGB = [225, 225, 225];
        var maxRGB = [100, 100, 100];
        var r = Math.round(minRGB[0] + (maxRGB[0] - minRGB[0]) * (maxSlopeAngle / 50));
        var g = Math.round(minRGB[1] + (maxRGB[1] - minRGB[1]) * (maxSlopeAngle / 50));
        var b = Math.round(minRGB[2] + (maxRGB[2] - minRGB[2]) * (maxSlopeAngle / 50));
        var strokeColor = "rgb(" + r + ", " + g + ", " + b + ")";
        
        // Convert to cache canvas coords
        var x0 = (triangle[0][0] - minX) * cacheScale;
        var y0 = (maxY - triangle[0][1]) * cacheScale;
        var x1 = (triangle[1][0] - minX) * cacheScale;
        var y1 = (maxY - triangle[1][1]) * cacheScale;
        var x2 = (triangle[2][0] - minX) * cacheScale;
        var y2 = (maxY - triangle[2][1]) * cacheScale;
        
        cacheCtx.strokeStyle = strokeColor;
        cacheCtx.fillStyle = fillColor;
        cacheCtx.lineWidth = 1;
        
        cacheCtx.beginPath();
        cacheCtx.moveTo(x0, y0);
        cacheCtx.lineTo(x1, y1);
        cacheCtx.lineTo(x2, y2);
        cacheCtx.closePath();
        cacheCtx.stroke();
        cacheCtx.fill();
    }
    
    // Step 20g) Store cache (use dataVersion for FAST validation)
    slope2DCache = {
        canvas: cacheCanvas,
        zoom: currentScale,
        bounds: { minX: minX, maxX: maxX, minY: minY, maxY: maxY },
        dataVersion: analysisDataVersion
    };
    
    console.log("📦 Slope canvas cache created: " + cacheWidth + "x" + cacheHeight + " (" + resultTriangles.length + " triangles)");
    
    return slope2DCache;
}

/**
 * Step 21) Draw cached Slope canvas to main canvas
 */
function drawCachedSlope(ctx, canvas, currentScale, centroidX, centroidY) {
    if (!slope2DCache || !slope2DCache.canvas) return false;
    
    var cache = slope2DCache;
    
    // Convert world bounds to canvas coordinates
    var topLeftX = (cache.bounds.minX - centroidX) * currentScale + canvas.width / 2;
    var topLeftY = (-cache.bounds.maxY + centroidY) * currentScale + canvas.height / 2;
    var bottomRightX = (cache.bounds.maxX - centroidX) * currentScale + canvas.width / 2;
    var bottomRightY = (-cache.bounds.minY + centroidY) * currentScale + canvas.height / 2;
    
    var destWidth = bottomRightX - topLeftX;
    var destHeight = bottomRightY - topLeftY;
    
    ctx.drawImage(cache.canvas, topLeftX, topLeftY, destWidth, destHeight);
    
    return true;
}

// #endregion SLOPE CANVAS

// ============================================================================
// #region LEVEL 2: RELIEF CANVAS RENDERING
// ============================================================================

/**
 * Step 22) Get relief color for a given burden relief value (ms/m)
 */
function getReliefColor(burdenRelief) {
    if (burdenRelief < 4) {
        return "rgb(75, 20, 20)";    // fast - dark red
    } else if (burdenRelief < 7) {
        return "rgb(255, 40, 40)";   // red
    } else if (burdenRelief < 10) {
        return "rgb(255, 120, 50)";  // orange
    } else if (burdenRelief < 13) {
        return "rgb(255, 255, 50)";  // yellow
    } else if (burdenRelief < 16) {
        return "rgb(50, 255, 70)";   // green
    } else if (burdenRelief < 19) {
        return "rgb(50, 255, 200)";  // cyan-green
    } else if (burdenRelief < 22) {
        return "rgb(50, 230, 255)";  // cyan
    } else if (burdenRelief < 25) {
        return "rgb(50, 180, 255)";  // light blue
    } else if (burdenRelief < 30) {
        return "rgb(50, 100, 255)";  // blue
    } else if (burdenRelief < 40) {
        return "rgb(0, 0, 180)";     // navy
    } else {
        return "rgb(75, 0, 150)";    // slow - purple
    }
}

/**
 * Step 23) Calculate burden relief for a triangle (timing difference / distance)
 */
function calculateBurdenRelief(triangle) {
    var tAZ = triangle[0][2];
    var tBZ = triangle[1][2];
    var tCZ = triangle[2][2];
    
    var earliestTime = Math.min(tAZ, tBZ, tCZ);
    var latestTime = Math.max(tAZ, tBZ, tCZ);
    var timeDifference = latestTime - earliestTime;
    
    // Find points for earliest and latest times
    var p1, p2;
    if (earliestTime === tAZ) {
        p1 = { x: triangle[0][0], y: triangle[0][1] };
    } else if (earliestTime === tBZ) {
        p1 = { x: triangle[1][0], y: triangle[1][1] };
    } else {
        p1 = { x: triangle[2][0], y: triangle[2][1] };
    }
    
    if (latestTime === tAZ) {
        p2 = { x: triangle[0][0], y: triangle[0][1] };
    } else if (latestTime === tBZ) {
        p2 = { x: triangle[1][0], y: triangle[1][1] };
    } else {
        p2 = { x: triangle[2][0], y: triangle[2][1] };
    }
    
    var distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    
    if (distance === 0) return 0;
    return timeDifference / distance;
}

/**
 * Step 24) Render Relief map to offscreen canvas cache
 */
function renderReliefToCache(reliefTriangles, allBlastHoles, currentScale, centroidX, centroidY) {
    // Step 24a) Skip if no triangles
    if (!reliefTriangles || reliefTriangles.length === 0) {
        return null;
    }
    
    // Step 24b) Calculate bounds
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (var i = 0; i < reliefTriangles.length; i++) {
        var tri = reliefTriangles[i];
        for (var j = 0; j < 3; j++) {
            var x = tri[j][0];
            var y = tri[j][1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    
    // Step 24c) Add padding
    var padX = (maxX - minX) * 0.05;
    var padY = (maxY - minY) * 0.05;
    minX -= padX; maxX += padX;
    minY -= padY; maxY += padY;
    
    // Step 24d) Calculate canvas size
    var worldWidth = maxX - minX;
    var worldHeight = maxY - minY;
    var cacheWidth = Math.ceil(worldWidth * currentScale * ANALYSIS_CACHE_OVERSAMPLE);
    var cacheHeight = Math.ceil(worldHeight * currentScale * ANALYSIS_CACHE_OVERSAMPLE);
    
    // Limit size
    if (cacheWidth > ANALYSIS_CACHE_MAX_SIZE || cacheHeight > ANALYSIS_CACHE_MAX_SIZE) {
        var scaleDown = ANALYSIS_CACHE_MAX_SIZE / Math.max(cacheWidth, cacheHeight);
        cacheWidth = Math.ceil(cacheWidth * scaleDown);
        cacheHeight = Math.ceil(cacheHeight * scaleDown);
    }
    
    if (cacheWidth < 10 || cacheHeight < 10) {
        return null;
    }
    
    // Step 24e) Create offscreen canvas
    var cacheCanvas = document.createElement("canvas");
    cacheCanvas.width = cacheWidth;
    cacheCanvas.height = cacheHeight;
    var cacheCtx = cacheCanvas.getContext("2d");
    
    var cacheScale = cacheWidth / worldWidth;
    cacheCtx.clearRect(0, 0, cacheWidth, cacheHeight);
    cacheCtx.strokeStyle = "#333";
    cacheCtx.lineWidth = 1;
    
    // Step 24f) Draw each triangle
    for (var i = 0; i < reliefTriangles.length; i++) {
        var triangle = reliefTriangles[i];
        
        // Calculate burden relief and get color
        var burdenRelief = calculateBurdenRelief(triangle);
        var fillColor = getReliefColor(burdenRelief);
        
        // Convert to cache canvas coords
        var x0 = (triangle[0][0] - minX) * cacheScale;
        var y0 = (maxY - triangle[0][1]) * cacheScale;
        var x1 = (triangle[1][0] - minX) * cacheScale;
        var y1 = (maxY - triangle[1][1]) * cacheScale;
        var x2 = (triangle[2][0] - minX) * cacheScale;
        var y2 = (maxY - triangle[2][1]) * cacheScale;
        
        cacheCtx.fillStyle = fillColor;
        
        cacheCtx.beginPath();
        cacheCtx.moveTo(x0, y0);
        cacheCtx.lineTo(x1, y1);
        cacheCtx.lineTo(x2, y2);
        cacheCtx.closePath();
        cacheCtx.stroke();
        cacheCtx.fill();
    }
    
    // Step 24g) Store cache (use dataVersion for FAST validation)
    relief2DCache = {
        canvas: cacheCanvas,
        zoom: currentScale,
        bounds: { minX: minX, maxX: maxX, minY: minY, maxY: maxY },
        dataVersion: analysisDataVersion
    };
    
    console.log("📦 Relief canvas cache created: " + cacheWidth + "x" + cacheHeight + " (" + reliefTriangles.length + " triangles)");
    
    return relief2DCache;
}

/**
 * Step 25) Draw cached Relief canvas to main canvas
 */
function drawCachedRelief(ctx, canvas, currentScale, centroidX, centroidY) {
    if (!relief2DCache || !relief2DCache.canvas) return false;
    
    var cache = relief2DCache;
    
    // Convert world bounds to canvas coordinates
    var topLeftX = (cache.bounds.minX - centroidX) * currentScale + canvas.width / 2;
    var topLeftY = (-cache.bounds.maxY + centroidY) * currentScale + canvas.height / 2;
    var bottomRightX = (cache.bounds.maxX - centroidX) * currentScale + canvas.width / 2;
    var bottomRightY = (-cache.bounds.minY + centroidY) * currentScale + canvas.height / 2;
    
    var destWidth = bottomRightX - topLeftX;
    var destHeight = bottomRightY - topLeftY;
    
    ctx.drawImage(cache.canvas, topLeftX, topLeftY, destWidth, destHeight);
    
    return true;
}

// #endregion RELIEF CANVAS

// ============================================================================
// #region CACHE INVALIDATION
// ============================================================================

/**
 * Step 26) Invalidate all analysis caches
 * Call when hole data changes significantly
 */
function invalidateAllAnalysisCaches() {
    // Clear Level 1 pre-caches
    voronoiPreCache = {
        holeCount: 0,
        holeDataHash: null,
        useToeLocation: false,
        voronoiMetrics: null,
        clippedCells: null,
        timestamp: 0
    };
    
    triangulationPreCache = {
        holeCount: 0,
        holeDataHash: null,
        maxEdgeLength: null,
        resultTriangles: null,
        reliefTriangles: null,
        timestamp: 0
    };
    
    // Clear Level 2 canvas caches
    voronoi2DCache.clear();
    slope2DCache = null;
    relief2DCache = null;
    
    console.log("🗑️ All analysis caches invalidated");
}

/**
 * Step 27) Invalidate Voronoi caches only
 */
function invalidateVoronoiCaches() {
    voronoiPreCache = {
        holeCount: 0,
        holeDataHash: null,
        useToeLocation: false,
        voronoiMetrics: null,
        clippedCells: null,
        timestamp: 0
    };
    
    voronoi2DCache.clear();
    
    console.log("🗑️ Voronoi caches invalidated");
}

/**
 * Step 28) Invalidate Slope cache only
 */
function invalidateSlopeCache() {
    slope2DCache = null;
    console.log("🗑️ Slope cache invalidated");
}

/**
 * Step 29) Invalidate Relief cache only
 */
function invalidateReliefCache() {
    relief2DCache = null;
    console.log("🗑️ Relief cache invalidated");
}

/**
 * Step 30) Invalidate Triangulation caches (affects both Slope and Relief)
 */
function invalidateTriangulationCaches() {
    triangulationPreCache = {
        holeCount: 0,
        holeDataHash: null,
        maxEdgeLength: null,
        resultTriangles: null,
        reliefTriangles: null,
        timestamp: 0
    };
    
    slope2DCache = null;
    relief2DCache = null;
    
    console.log("🗑️ Triangulation caches invalidated");
}

// #endregion CACHE INVALIDATION

// ============================================================================
// #region BACKGROUND PRE-CACHE TRIGGER
// ============================================================================

/**
 * Step 31) Pre-cache all analysis in background
 * Call this after debouncedSaveHoles completes
 */
function preCacheAllAnalysis(allBlastHoles, useToeLocation, maxEdgeLength, 
                              getVoronoiMetrics, clipVoronoiCells, delaunayTriangles,
                              displayVoronoiCells, displaySlope, displayRelief) {
    
    // Step 31a) Check if we should cache
    var shouldCache = (displayVoronoiCells && displayVoronoiCells.checked) ||
                      (displaySlope && displaySlope.checked) ||
                      (displayRelief && displayRelief.checked) ||
                      (allBlastHoles && allBlastHoles.length > 50);
    
    if (!shouldCache) {
        return;
    }
    
    // Step 31b) Use requestIdleCallback or setTimeout to not block UI
    var schedulePreCache = window.requestIdleCallback || function(cb) { setTimeout(cb, 100); };
    
    schedulePreCache(function() {
        // Step 31c) Pre-cache triangulation (shared by Slope & Relief)
        if ((displaySlope && displaySlope.checked) || (displayRelief && displayRelief.checked)) {
            preCacheTriangulation(allBlastHoles, maxEdgeLength, delaunayTriangles);
        }
        
        // Step 31d) Pre-cache Voronoi calculations
        if (displayVoronoiCells && displayVoronoiCells.checked) {
            preCacheVoronoiCalculations(allBlastHoles, useToeLocation, getVoronoiMetrics, clipVoronoiCells);
        }
        
        console.log("🔄 Background pre-caching complete for " + allBlastHoles.length + " holes");
        
    }, { timeout: 500 });
}

// #endregion BACKGROUND PRE-CACHE

// ============================================================================
// #region EXPORTS
// ============================================================================

export {
    // Configuration
    ANALYSIS_CACHE_ZOOM_THRESHOLD,
    ANALYSIS_CACHE_MIN_HOLES,
    
    // Version management (CRITICAL for fast cache validation)
    bumpDataVersion,
    getDataVersion,
    
    // Hash functions
    getHoleDataHash,
    getTimingHash,
    
    // Level 1: Pre-cache validation
    isVoronoiPreCacheValid,
    isTriangulationPreCacheValid,
    
    // Level 1: Pre-cache computation
    preCacheVoronoiCalculations,
    preCacheTriangulation,
    
    // Level 1: Get cached data
    getCachedVoronoiCells,
    getCachedTriangulation,
    
    // Level 2: Canvas cache validation
    isVoronoiCanvasCacheValid,
    isSlopeCanvasCacheValid,
    isReliefCanvasCacheValid,
    
    // Level 2: Canvas rendering
    renderVoronoiToCache,
    drawCachedVoronoi,
    renderSlopeToCache,
    drawCachedSlope,
    renderReliefToCache,
    drawCachedRelief,
    
    // Color functions (for external use)
    getSlopeColor,
    getReliefColor,
    calculateBurdenRelief,
    
    // Cache invalidation
    invalidateAllAnalysisCaches,
    invalidateVoronoiCaches,
    invalidateSlopeCache,
    invalidateReliefCache,
    invalidateTriangulationCaches,
    
    // Background pre-cache
    preCacheAllAnalysis
};

// #endregion EXPORTS
