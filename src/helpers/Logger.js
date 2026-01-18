/* prettier-ignore-file */
//=================================================
// Logger.js - Centralized Logging with Levels and Throttling
//=================================================
// Provides a clean logging interface with:
// - Log levels: ERROR, WARN, INFO, DEBUG
// - Throttling for repetitive logs
// - Conditional logging based on developerModeEnabled
// - Grouped logging for related messages
//
// Usage:
//   Logger.info("Message");
//   Logger.debug("Detailed info"); // Only shows if developerModeEnabled
//   Logger.error("Critical error");
//   Logger.throttle("mousemove", "Mouse moved", 1000); // Max once per second
//=================================================

// Step 1) Log levels enum
export var LogLevel = {
	ERROR: 0,
	WARN: 1,
	INFO: 2,
	DEBUG: 3
};

// Step 2) Logger class
class LoggerClass {
	constructor() {
		// Step 2a) Current log level (DEBUG in dev mode, INFO in production)
		this.level = LogLevel.INFO;
		
		// Step 2b) Throttle tracking
		this.throttleTimestamps = new Map();
		
		// Step 2c) Group tracking
		this.activeGroups = [];
		
		// Step 2d) Log prefixes
		this.prefixes = {
			error: "❌",
			warn: "⚠️",
			info: "ℹ️",
			debug: "🔧",
			perf: "⚡",
			render: "🎨",
			data: "📊"
		};
	}
	
	// Step 3) Set log level
	setLevel(level) {
		this.level = level;
	}
	
	// Step 4) Check if developer mode is enabled
	_isDevMode() {
		return window.developerModeEnabled === true;
	}
	
	// Step 5) Format message with prefix
	_format(prefix, message) {
		var timestamp = new Date().toISOString().substr(11, 12);
		return "[" + timestamp + "] " + prefix + " " + message;
	}
	
	// Step 6) Error logging (always shown)
	error(message) {
		var args = Array.prototype.slice.call(arguments, 1);
		console.error.apply(console, [this._format(this.prefixes.error, message)].concat(args));
	}
	
	// Step 7) Warning logging (shown at WARN level and above)
	warn(message) {
		if (this.level < LogLevel.WARN) return;
		var args = Array.prototype.slice.call(arguments, 1);
		console.warn.apply(console, [this._format(this.prefixes.warn, message)].concat(args));
	}
	
	// Step 8) Info logging (shown at INFO level and above)
	info(message) {
		if (this.level < LogLevel.INFO) return;
		var args = Array.prototype.slice.call(arguments, 1);
		console.log.apply(console, [this._format(this.prefixes.info, message)].concat(args));
	}
	
	// Step 9) Debug logging (only in developer mode)
	debug(message) {
		if (!this._isDevMode()) return;
		if (this.level < LogLevel.DEBUG) return;
		var args = Array.prototype.slice.call(arguments, 1);
		console.log.apply(console, [this._format(this.prefixes.debug, message)].concat(args));
	}
	
	// Step 10) Performance logging (only in developer mode)
	perf(message) {
		if (!this._isDevMode()) return;
		var args = Array.prototype.slice.call(arguments, 1);
		console.log.apply(console, [this._format(this.prefixes.perf, message)].concat(args));
	}
	
	// Step 11) Render logging (only in developer mode)
	render(message) {
		if (!this._isDevMode()) return;
		var args = Array.prototype.slice.call(arguments, 1);
		console.log.apply(console, [this._format(this.prefixes.render, message)].concat(args));
	}
	
	// Step 12) Data logging (only in developer mode)
	data(message) {
		if (!this._isDevMode()) return;
		var args = Array.prototype.slice.call(arguments, 1);
		console.log.apply(console, [this._format(this.prefixes.data, message)].concat(args));
	}
	
	// Step 13) Throttled logging - prevents spam
	throttle(key, message, intervalMs) {
		if (intervalMs === undefined) intervalMs = 1000;
		
		var now = Date.now();
		var lastTime = this.throttleTimestamps.get(key) || 0;
		
		if (now - lastTime >= intervalMs) {
			this.throttleTimestamps.set(key, now);
			var args = Array.prototype.slice.call(arguments, 3);
			console.log.apply(console, [message].concat(args));
			return true;
		}
		return false;
	}
	
	// Step 14) Throttled debug logging
	throttleDebug(key, message, intervalMs) {
		if (!this._isDevMode()) return false;
		if (intervalMs === undefined) intervalMs = 1000;
		
		var now = Date.now();
		var lastTime = this.throttleTimestamps.get(key) || 0;
		
		if (now - lastTime >= intervalMs) {
			this.throttleTimestamps.set(key, now);
			var args = Array.prototype.slice.call(arguments, 3);
			console.log.apply(console, [this._format(this.prefixes.debug, message)].concat(args));
			return true;
		}
		return false;
	}
	
	// Step 15) Start a console group
	group(label) {
		if (!this._isDevMode()) return;
		console.group(label);
		this.activeGroups.push(label);
	}
	
	// Step 16) Start a collapsed console group
	groupCollapsed(label) {
		if (!this._isDevMode()) return;
		console.groupCollapsed(label);
		this.activeGroups.push(label);
	}
	
	// Step 17) End a console group
	groupEnd() {
		if (!this._isDevMode()) return;
		if (this.activeGroups.length > 0) {
			console.groupEnd();
			this.activeGroups.pop();
		}
	}
	
	// Step 18) Time tracking
	time(label) {
		if (!this._isDevMode()) return;
		console.time(label);
	}
	
	// Step 19) Time end
	timeEnd(label) {
		if (!this._isDevMode()) return;
		console.timeEnd(label);
	}
	
	// Step 20) Table logging for arrays/objects
	table(data) {
		if (!this._isDevMode()) return;
		console.table(data);
	}
	
	// Step 21) Clear throttle cache (useful for testing)
	clearThrottleCache() {
		this.throttleTimestamps.clear();
	}
	
	// Step 22) Once-only logging (shows message only once per key)
	once(key, message) {
		if (this.throttleTimestamps.has("once_" + key)) return false;
		this.throttleTimestamps.set("once_" + key, Date.now());
		var args = Array.prototype.slice.call(arguments, 2);
		console.log.apply(console, [this._format(this.prefixes.info, message)].concat(args));
		return true;
	}
}

// Step 23) Export singleton instance
var Logger = new LoggerClass();
export { Logger };
export default Logger;

// Step 24) Expose to window for global access
if (typeof window !== "undefined") {
	window.Logger = Logger;
	window.LogLevel = LogLevel;
}
