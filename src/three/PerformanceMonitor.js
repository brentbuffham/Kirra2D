/* prettier-ignore-file */
//=================================================
// PerformanceMonitor.js - Real-time 3D Performance Stats
//=================================================
// Provides live performance metrics for diagnosing rendering issues
// Displays FPS, draw calls, triangles, memory, and frame timing
//
// Usage:
//   const monitor = new PerformanceMonitor(threeRenderer);
//   monitor.show(); // Display overlay
//   monitor.hide(); // Hide overlay
//   monitor.update(); // Call each frame in render loop
//=================================================

export class PerformanceMonitor {
	constructor(threeRenderer) {
		// Step 1) Store renderer reference
		this.renderer = threeRenderer ? threeRenderer.renderer : null;
		this.threeRenderer = threeRenderer;
		
		// Step 2) FPS calculation variables
		this.frameCount = 0;
		this.lastFPSUpdate = performance.now();
		this.currentFPS = 0;
		this.fpsHistory = []; // Last 60 frames for averaging
		this.maxHistoryLength = 60;
		
		// Step 3) Frame timing
		this.lastFrameTime = performance.now();
		this.frameTime = 0;
		this.frameTimeHistory = [];
		
		// Step 4) Stats storage
		this.stats = {
			fps: 0,
			avgFps: 0,
			minFps: 60,
			maxFps: 0,
			frameTime: 0,
			avgFrameTime: 0,
			drawCalls: 0,
			triangles: 0,
			geometries: 0,
			textures: 0,
			programs: 0,
			points: 0,
			lines: 0,
			sceneObjects: 0,
			holesCount: 0,
			kadCount: 0,
			surfacesCount: 0
		};
		
		// Step 5) Performance thresholds for color coding
		this.thresholds = {
			fps: { good: 55, warn: 30 },        // Green > 55, Yellow 30-55, Red < 30
			frameTime: { good: 16, warn: 33 },   // Green < 16ms, Yellow 16-33ms, Red > 33ms
			drawCalls: { good: 100, warn: 500 }, // Green < 100, Yellow 100-500, Red > 500
			triangles: { good: 100000, warn: 500000 }
		};
		
		// Step 6) Create overlay DOM element
		this.overlay = null;
		this.isVisible = false;
		
		// Step 7) Update throttle (update display every 100ms, not every frame)
		this.lastDisplayUpdate = 0;
		this.displayUpdateInterval = 100; // ms
		
		console.log("📊 PerformanceMonitor initialized");
	}
	
	// Step 8) Set renderer reference (can be called after construction)
	setRenderer(threeRenderer) {
		this.threeRenderer = threeRenderer;
		this.renderer = threeRenderer ? threeRenderer.renderer : null;
	}
	
	// Step 9) Create the overlay DOM element
	_createOverlay() {
		if (this.overlay) return;
		
		// Step 9a) Create container
		this.overlay = document.createElement("div");
		this.overlay.id = "perf-monitor-overlay";
		this.overlay.style.cssText = 
			"position: fixed;" +
			"top: 10px;" +
			"right: 10px;" +
			"background: rgba(0, 0, 0, 0.85);" +
			"color: #00ff00;" +
			"font-family: 'Consolas', 'Monaco', monospace;" +
			"font-size: 12px;" +
			"padding: 10px 15px;" +
			"border-radius: 8px;" +
			"z-index: 10000;" +
			"pointer-events: none;" +
			"min-width: 220px;" +
			"box-shadow: 0 2px 10px rgba(0,0,0,0.5);" +
			"border: 1px solid rgba(0,255,0,0.3);";
		
		// Step 9b) Create header
		var header = document.createElement("div");
		header.style.cssText = 
			"font-weight: bold;" +
			"margin-bottom: 8px;" +
			"padding-bottom: 5px;" +
			"border-bottom: 1px solid rgba(255,255,255,0.2);" +
			"color: #ffffff;";
		header.textContent = "⚡ Performance Monitor";
		this.overlay.appendChild(header);
		
		// Step 9c) Create stats container
		this.statsContainer = document.createElement("div");
		this.statsContainer.style.cssText = "line-height: 1.6;";
		this.overlay.appendChild(this.statsContainer);
		
		// Step 9d) Add to document
		document.body.appendChild(this.overlay);
	}
	
	// Step 10) Get color based on value and thresholds
	_getColor(value, thresholdKey, inverse = false) {
		var threshold = this.thresholds[thresholdKey];
		if (!threshold) return "#00ff00";
		
		if (inverse) {
			// Higher is worse (frameTime, drawCalls)
			if (value < threshold.good) return "#00ff00"; // Green
			if (value < threshold.warn) return "#ffff00"; // Yellow
			return "#ff4444"; // Red
		} else {
			// Higher is better (fps)
			if (value > threshold.good) return "#00ff00"; // Green
			if (value > threshold.warn) return "#ffff00"; // Yellow
			return "#ff4444"; // Red
		}
	}
	
	// Step 11) Format number with commas
	_formatNumber(num) {
		if (num === undefined || num === null) return "0";
		return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}
	
	// Step 12) Update stats display
	_updateDisplay() {
		if (!this.statsContainer) return;
		
		var s = this.stats;
		var html = "";
		
		// FPS section
		html += "<div style='margin-bottom: 6px;'>";
		html += "<span style='color: " + this._getColor(s.fps, "fps", false) + "; font-size: 16px; font-weight: bold;'>" + s.fps + " FPS</span>";
		html += "<span style='color: #888; font-size: 10px;'> (avg: " + s.avgFps + ", min: " + s.minFps + ")</span>";
		html += "</div>";
		
		// Frame time
		html += "<div style='color: " + this._getColor(s.frameTime, "frameTime", true) + ";'>";
		html += "Frame: " + s.frameTime.toFixed(1) + "ms";
		html += "<span style='color: #888;'> (avg: " + s.avgFrameTime.toFixed(1) + "ms)</span>";
		html += "</div>";
		
		// Separator
		html += "<div style='border-top: 1px solid rgba(255,255,255,0.1); margin: 6px 0;'></div>";
		
		// Draw calls
		html += "<div style='color: " + this._getColor(s.drawCalls, "drawCalls", true) + ";'>";
		html += "Draw Calls: " + this._formatNumber(s.drawCalls);
		html += "</div>";
		
		// Triangles
		html += "<div style='color: " + this._getColor(s.triangles, "triangles", true) + ";'>";
		html += "Triangles: " + this._formatNumber(s.triangles);
		html += "</div>";
		
		// Points and Lines
		html += "<div style='color: #aaa;'>";
		html += "Points: " + this._formatNumber(s.points) + " | Lines: " + this._formatNumber(s.lines);
		html += "</div>";
		
		// Separator
		html += "<div style='border-top: 1px solid rgba(255,255,255,0.1); margin: 6px 0;'></div>";
		
		// Memory
		html += "<div style='color: #88ccff;'>";
		html += "Geometries: " + this._formatNumber(s.geometries);
		html += "</div>";
		html += "<div style='color: #88ccff;'>";
		html += "Textures: " + this._formatNumber(s.textures);
		html += "</div>";
		html += "<div style='color: #88ccff;'>";
		html += "Programs: " + this._formatNumber(s.programs);
		html += "</div>";
		
		// Separator
		html += "<div style='border-top: 1px solid rgba(255,255,255,0.1); margin: 6px 0;'></div>";
		
		// Scene objects
		html += "<div style='color: #ffaa00;'>";
		html += "Scene Objects: " + this._formatNumber(s.sceneObjects);
		html += "</div>";
		html += "<div style='color: #ffaa00; font-size: 11px;'>";
		html += "Holes: " + this._formatNumber(s.holesCount) + " | KAD: " + this._formatNumber(s.kadCount);
		html += "</div>";
		html += "<div style='color: #ffaa00; font-size: 11px;'>";
		html += "Surfaces: " + this._formatNumber(s.surfacesCount);
		html += "</div>";
		
		// Separator
		html += "<div style='border-top: 1px solid rgba(255,255,255,0.1); margin: 6px 0;'></div>";
		
		// Renderer version
		var rendererName = window.currentRendererVersion || "Unknown";
		html += "<div style='color: #888; font-size: 10px;'>";
		html += "Renderer: " + rendererName;
		html += "</div>";
		
		this.statsContainer.innerHTML = html;
	}
	
	// Step 13) Update method - call every frame
	update() {
		var now = performance.now();
		
		// Step 13a) Calculate frame time
		this.frameTime = now - this.lastFrameTime;
		this.lastFrameTime = now;
		
		// Step 13b) Track frame time history
		this.frameTimeHistory.push(this.frameTime);
		if (this.frameTimeHistory.length > this.maxHistoryLength) {
			this.frameTimeHistory.shift();
		}
		
		// Step 13c) Increment frame count
		this.frameCount++;
		
		// Step 13d) Calculate FPS every second
		var elapsed = now - this.lastFPSUpdate;
		if (elapsed >= 1000) {
			this.currentFPS = Math.round((this.frameCount * 1000) / elapsed);
			this.frameCount = 0;
			this.lastFPSUpdate = now;
			
			// Track FPS history
			this.fpsHistory.push(this.currentFPS);
			if (this.fpsHistory.length > this.maxHistoryLength) {
				this.fpsHistory.shift();
			}
			
			// Calculate min/max FPS
			if (this.fpsHistory.length > 0) {
				this.stats.minFps = Math.min.apply(null, this.fpsHistory);
				this.stats.maxFps = Math.max.apply(null, this.fpsHistory);
			}
		}
		
		// Step 13e) Update stats object
		this.stats.fps = this.currentFPS;
		this.stats.frameTime = this.frameTime;
		
		// Calculate averages
		if (this.fpsHistory.length > 0) {
			var fpsSum = 0;
			for (var i = 0; i < this.fpsHistory.length; i++) {
				fpsSum += this.fpsHistory[i];
			}
			this.stats.avgFps = Math.round(fpsSum / this.fpsHistory.length);
		}
		
		if (this.frameTimeHistory.length > 0) {
			var ftSum = 0;
			for (var i = 0; i < this.frameTimeHistory.length; i++) {
				ftSum += this.frameTimeHistory[i];
			}
			this.stats.avgFrameTime = ftSum / this.frameTimeHistory.length;
		}
		
		// Step 13f) Get renderer stats
		if (this.renderer && this.renderer.info) {
			var info = this.renderer.info;
			this.stats.drawCalls = info.render.calls || 0;
			this.stats.triangles = info.render.triangles || 0;
			this.stats.points = info.render.points || 0;
			this.stats.lines = info.render.lines || 0;
			this.stats.geometries = info.memory.geometries || 0;
			this.stats.textures = info.memory.textures || 0;
			this.stats.programs = info.programs ? info.programs.length : 0;
		}
		
		// Step 13g) Get scene object counts
		if (this.threeRenderer) {
			this.stats.sceneObjects = this._countSceneObjects();
			this.stats.holesCount = this.threeRenderer.holesGroup ? this.threeRenderer.holesGroup.children.length : 0;
			this.stats.kadCount = this.threeRenderer.kadGroup ? this.threeRenderer.kadGroup.children.length : 0;
			this.stats.surfacesCount = this.threeRenderer.surfacesGroup ? this.threeRenderer.surfacesGroup.children.length : 0;
		}
		
		// Step 13h) Throttle display updates
		if (this.isVisible && (now - this.lastDisplayUpdate) >= this.displayUpdateInterval) {
			this._updateDisplay();
			this.lastDisplayUpdate = now;
		}
	}
	
	// Step 14) Count all scene objects
	_countSceneObjects() {
		if (!this.threeRenderer || !this.threeRenderer.scene) return 0;
		
		var count = 0;
		this.threeRenderer.scene.traverse(function() {
			count++;
		});
		return count;
	}
	
	// Step 15) Show the overlay
	show() {
		if (!this.overlay) {
			this._createOverlay();
		}
		this.overlay.style.display = "block";
		this.isVisible = true;
		console.log("📊 Performance Monitor: VISIBLE");
	}
	
	// Step 16) Hide the overlay
	hide() {
		if (this.overlay) {
			this.overlay.style.display = "none";
		}
		this.isVisible = false;
		console.log("📊 Performance Monitor: HIDDEN");
	}
	
	// Step 17) Toggle visibility
	toggle() {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
		return this.isVisible;
	}
	
	// Step 18) Get current stats (for external use)
	getStats() {
		return Object.assign({}, this.stats);
	}
	
	// Step 19) Reset stats history
	reset() {
		this.fpsHistory = [];
		this.frameTimeHistory = [];
		this.stats.minFps = 60;
		this.stats.maxFps = 0;
		console.log("📊 Performance Monitor: Stats reset");
	}
	
	// Step 20) Dispose and cleanup
	dispose() {
		if (this.overlay && this.overlay.parentNode) {
			this.overlay.parentNode.removeChild(this.overlay);
		}
		this.overlay = null;
		this.statsContainer = null;
		this.renderer = null;
		this.threeRenderer = null;
		console.log("📊 Performance Monitor: Disposed");
	}
}

// Step 21) Export singleton instance creator
var _perfMonitorInstance = null;

export function getPerformanceMonitor(threeRenderer) {
	if (!_perfMonitorInstance) {
		_perfMonitorInstance = new PerformanceMonitor(threeRenderer);
	} else if (threeRenderer) {
		_perfMonitorInstance.setRenderer(threeRenderer);
	}
	return _perfMonitorInstance;
}
