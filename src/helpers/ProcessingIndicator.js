//=================================================
// ProcessingIndicator.js - Processing Overlay Component
//=================================================
// Shows a "Please Wait" overlay during heavy operations
// Prevents user interaction and provides feedback
//
// Usage:
//   ProcessingIndicator.show("Loading 10,000 holes...");
//   // ... heavy operation ...
//   ProcessingIndicator.hide();
//
// Or with wrap:
//   ProcessingIndicator.wrap(heavyOperation, "Processing...")();
//=================================================

var ProcessingIndicator = {
	overlay: null,
	messageElement: null,
	startTime: 0,
	updateInterval: null,

	/**
	 * Step 1) Show the processing overlay
	 * @param {string} message - Message to display (default: "Kirra is processing your request. Please wait...")
	 */
	show: function(message) {
		// Step 1a) Don't create duplicate overlays
		if (this.overlay) {
			// Just update message if already showing
			if (this.messageElement && message) {
				this.messageElement.textContent = message;
			}
			return;
		}

		message = message || "Kirra is processing your request. Please wait...";
		this.startTime = performance.now();

		// Step 1b) Create overlay container
		this.overlay = document.createElement("div");
		this.overlay.id = "kirra-processing-overlay";
		this.overlay.style.cssText = 
			"position: fixed;" +
			"top: 0;" +
			"left: 0;" +
			"width: 100%;" +
			"height: 100%;" +
			"background: rgba(0, 0, 0, 0.75);" +
			"z-index: 99999;" +
			"display: flex;" +
			"align-items: center;" +
			"justify-content: center;" +
			"flex-direction: column;";

		// Step 1c) Create content container
		var content = document.createElement("div");
		content.style.cssText = 
			"text-align: center;" +
			"padding: 40px;" +
			"background: rgba(30, 30, 30, 0.95);" +
			"border-radius: 12px;" +
			"border: 1px solid rgba(255, 255, 255, 0.2);" +
			"box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);";

		// Step 1d) Create spinner (CSS animation)
		var spinner = document.createElement("div");
		spinner.id = "kirra-processing-spinner";
		spinner.style.cssText = 
			"width: 50px;" +
			"height: 50px;" +
			"border: 4px solid rgba(255, 255, 255, 0.2);" +
			"border-top: 4px solid #00aaff;" +
			"border-radius: 50%;" +
			"margin: 0 auto 20px auto;" +
			"animation: kirra-spin 1s linear infinite;";

		// Step 1e) Add CSS animation if not already present
		if (!document.getElementById("kirra-processing-styles")) {
			var style = document.createElement("style");
			style.id = "kirra-processing-styles";
			style.textContent = 
				"@keyframes kirra-spin {" +
				"  0% { transform: rotate(0deg); }" +
				"  100% { transform: rotate(360deg); }" +
				"}";
			document.head.appendChild(style);
		}

		// Step 1f) Create message element
		this.messageElement = document.createElement("div");
		this.messageElement.id = "kirra-processing-message";
		this.messageElement.style.cssText = 
			"color: #ffffff;" +
			"font-size: 16px;" +
			"font-family: Arial, sans-serif;" +
			"margin-bottom: 10px;";
		this.messageElement.textContent = message;

		// Step 1g) Create elapsed time element
		var timeElement = document.createElement("div");
		timeElement.id = "kirra-processing-time";
		timeElement.style.cssText = 
			"color: rgba(255, 255, 255, 0.6);" +
			"font-size: 12px;" +
			"font-family: Arial, sans-serif;";
		timeElement.textContent = "Elapsed: 0.0s";

		// Step 1h) Assemble and add to DOM
		content.appendChild(spinner);
		content.appendChild(this.messageElement);
		content.appendChild(timeElement);
		this.overlay.appendChild(content);
		document.body.appendChild(this.overlay);

		// Step 1i) Start timer update
		var self = this;
		this.updateInterval = setInterval(function() {
			var elapsed = (performance.now() - self.startTime) / 1000;
			timeElement.textContent = "Elapsed: " + elapsed.toFixed(1) + "s";
		}, 100);

		console.log("ProcessingIndicator: Show - " + message);
	},

	/**
	 * Step 2) Hide the processing overlay
	 */
	hide: function() {
		// Step 2a) Clear timer
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}

		// Step 2b) Remove overlay
		if (this.overlay) {
			var elapsed = (performance.now() - this.startTime) / 1000;
			console.log("ProcessingIndicator: Hide - completed in " + elapsed.toFixed(2) + "s");

			if (this.overlay.parentNode) {
				document.body.removeChild(this.overlay);
			}
			this.overlay = null;
			this.messageElement = null;
		}
	},

	/**
	 * Step 3) Update the message while showing
	 * @param {string} message - New message to display
	 */
	updateMessage: function(message) {
		if (this.messageElement) {
			this.messageElement.textContent = message;
		}
	},

	/**
	 * Step 4) Check if overlay is currently showing
	 * @returns {boolean} True if overlay is visible
	 */
	isShowing: function() {
		return this.overlay !== null;
	},

	/**
	 * Step 5) Wrap an async function to show/hide overlay automatically
	 * @param {Function} asyncFn - Async function to wrap
	 * @param {string} message - Message to display
	 * @returns {Function} Wrapped function
	 */
	wrap: function(asyncFn, message) {
		var self = this;
		return function() {
			var args = arguments;
			var context = this;

			self.show(message);

			// Use setTimeout to allow overlay to render before heavy work
			return new Promise(function(resolve, reject) {
				setTimeout(function() {
					try {
						var result = asyncFn.apply(context, args);
						
						// Handle both sync and async functions
						if (result && typeof result.then === "function") {
							result
								.then(function(value) {
									self.hide();
									resolve(value);
								})
								.catch(function(error) {
									self.hide();
									reject(error);
								});
						} else {
							self.hide();
							resolve(result);
						}
					} catch (error) {
						self.hide();
						reject(error);
					}
				}, 50); // Small delay to allow overlay to render
			});
		};
	},

	/**
	 * Step 6) Show overlay for a synchronous operation (uses requestAnimationFrame)
	 * @param {Function} syncFn - Synchronous function to run
	 * @param {string} message - Message to display
	 * @param {Function} callback - Optional callback after completion
	 */
	runWithOverlay: function(syncFn, message, callback) {
		var self = this;
		
		this.show(message);
		
		// Use requestAnimationFrame to ensure overlay renders before heavy work
		requestAnimationFrame(function() {
			requestAnimationFrame(function() {
				try {
					var result = syncFn();
					self.hide();
					if (callback) callback(null, result);
				} catch (error) {
					self.hide();
					if (callback) callback(error);
					else console.error("ProcessingIndicator.runWithOverlay error:", error);
				}
			});
		});
	}
};

// Step 7) Export for use in modules and global scope
if (typeof module !== "undefined" && module.exports) {
	module.exports = ProcessingIndicator;
}

// Step 8) Also attach to window for global access
if (typeof window !== "undefined") {
	window.ProcessingIndicator = ProcessingIndicator;
}
