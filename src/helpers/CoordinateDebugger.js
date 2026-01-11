/**
 * CoordinateDebugger - Diagnostic tool for Three.js coordinate transforms
 *
 * Traces mouse position through all coordinate spaces to find transform bugs
 *
 * Coordinate Spaces in Kirra:
 * 1. Screen Space - pixels on screen (0,0 = top-left)
 * 2. Canvas Space - pixels on canvas element (accounting for offsets)
 * 3. NDC (Normalized Device Coords) - (-1,-1) to (1,1)
 * 4. World Space - UTM coordinates (477040, 6772549)
 * 5. Local Space - Three.js geometry coords (world - origin)
 * 6. Camera Space - relative to camera position
 */

export class CoordinateDebugger {
	constructor(threeRenderer, interactionManager) {
		this.threeRenderer = threeRenderer;
		this.interactionManager = interactionManager;
		this.enabled = false;
		this.debugOverlay = null;
	}

	enable() {
		this.enabled = true;
		this.createDebugOverlay();
		console.log("🔍 CoordinateDebugger ENABLED");
	}

	disable() {
		this.enabled = false;
		if (this.debugOverlay) {
			this.debugOverlay.remove();
			this.debugOverlay = null;
		}
		console.log("🔍 CoordinateDebugger DISABLED");
	}

	createDebugOverlay() {
		if (this.debugOverlay) return;

		this.debugOverlay = document.createElement('div');
		this.debugOverlay.id = 'coordinate-debugger';
		this.debugOverlay.style.cssText = `
			position: fixed;
			top: 10px;
			right: 10px;
			background: rgba(0, 0, 0, 0.8);
			color: #00ff00;
			font-family: monospace;
			font-size: 11px;
			padding: 10px;
			z-index: 10000;
			pointer-events: none;
			max-width: 400px;
			border: 1px solid #00ff00;
		`;
		document.body.appendChild(this.debugOverlay);
	}

	traceMousePosition(event) {
		if (!this.enabled) return null;

		const canvas = this.threeRenderer.getCanvas();
		if (!canvas) return null;

		const trace = {
			timestamp: performance.now()
		};

		// 1. SCREEN SPACE (absolute pixels on screen)
		trace.screenSpace = {
			x: event.clientX,
			y: event.clientY,
			desc: "Pixels from browser window top-left"
		};

		// 2. CANVAS SPACE (relative to canvas element)
		const rect = canvas.getBoundingClientRect();
		trace.canvasSpace = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
			canvasWidth: rect.width,
			canvasHeight: rect.height,
			desc: "Pixels from canvas top-left"
		};

		// 3. NDC (Normalized Device Coordinates)
		const ndcX = (trace.canvasSpace.x / rect.width) * 2 - 1;
		const ndcY = -(trace.canvasSpace.y / rect.height) * 2 + 1;
		trace.ndc = {
			x: ndcX,
			y: ndcY,
			desc: "Three.js normalized coords (-1 to 1)"
		};

		// 4. INTERACTION MANAGER MOUSE (what InteractionManager sees)
		if (this.interactionManager && this.interactionManager.mouse) {
			trace.interactionManagerMouse = {
				x: this.interactionManager.mouse.x,
				y: this.interactionManager.mouse.y,
				desc: "InteractionManager.mouse values"
			};
		}

		// 5. RAYCASTER (ray through camera)
		if (this.interactionManager && this.interactionManager.raycaster) {
			const ray = this.interactionManager.raycaster.ray;
			trace.raycaster = {
				originX: ray.origin.x,
				originY: ray.origin.y,
				originZ: ray.origin.z,
				directionX: ray.direction.x,
				directionY: ray.direction.y,
				directionZ: ray.direction.z,
				desc: "Ray from camera through mouse"
			};
		}

		// 6. CAMERA STATE
		const camera = this.threeRenderer.camera;
		if (camera) {
			trace.camera = {
				posX: camera.position.x,
				posY: camera.position.y,
				posZ: camera.position.z,
				zoom: camera.zoom,
				left: camera.left,
				right: camera.right,
				top: camera.top,
				bottom: camera.bottom,
				desc: "Orthographic camera state"
			};
		}

		// 7. WORLD COORDINATES (from InteractionManager)
		if (this.interactionManager) {
			// View plane intersection
			if (typeof this.interactionManager.getMouseWorldPositionOnViewPlane === 'function') {
				const viewPlanePos = this.interactionManager.getMouseWorldPositionOnViewPlane();
				trace.viewPlaneWorld = viewPlanePos ? {
					x: viewPlanePos.x,
					y: viewPlanePos.y,
					z: viewPlanePos.z,
					desc: "World coords on view plane (perpendicular to camera)"
				} : { error: "getMouseWorldPositionOnViewPlane returned null" };
			}

			// Ground plane intersection (Z=0)
			if (typeof this.interactionManager.getMouseWorldPositionOnPlane === 'function') {
				const groundPlanePos = this.interactionManager.getMouseWorldPositionOnPlane(0);
				trace.groundPlaneWorld = groundPlanePos ? {
					x: groundPlanePos.x,
					y: groundPlanePos.y,
					z: groundPlanePos.z,
					desc: "World coords on Z=0 plane"
				} : { error: "getMouseWorldPositionOnPlane returned null" };
			}
		}

		// 8. LOCAL COORDINATES (Three.js geometry space)
		if (window.threeLocalOriginX !== undefined && window.threeLocalOriginY !== undefined) {
			trace.localOrigin = {
				x: window.threeLocalOriginX,
				y: window.threeLocalOriginY,
				desc: "Three.js local origin offset"
			};

			if (trace.viewPlaneWorld && !trace.viewPlaneWorld.error) {
				trace.viewPlaneLocal = {
					x: trace.viewPlaneWorld.x - window.threeLocalOriginX,
					y: trace.viewPlaneWorld.y - window.threeLocalOriginY,
					z: trace.viewPlaneWorld.z,
					desc: "Local coords (world - origin)"
				};
			}
		}

		// 9. CURSOR INDICATOR POSITION (where the torus actually is)
		// Look for mouseIndicator in connectorsGroup (it's not stored in threeRenderer.mouseIndicator)
		if (this.threeRenderer && this.threeRenderer.connectorsGroup) {
			const mouseIndicator = this.threeRenderer.connectorsGroup.children.find(
				child => child.userData && child.userData.type === "mouseIndicator"
			);
			if (mouseIndicator) {
				// The indicator is a Group with a sphere mesh inside
				// The sphere mesh has the actual position
				let sphereMesh = mouseIndicator.children.find(child => child.isMesh);
				if (sphereMesh) {
					trace.cursorIndicator = {
						groupX: mouseIndicator.position.x,
						groupY: mouseIndicator.position.y,
						groupZ: mouseIndicator.position.z,
						meshX: sphereMesh.position.x,
						meshY: sphereMesh.position.y,
						meshZ: sphereMesh.position.z,
						visible: mouseIndicator.visible,
						desc: "Group position + sphere mesh position inside group"
					};
				} else {
					trace.cursorIndicator = {
						x: mouseIndicator.position.x,
						y: mouseIndicator.position.y,
						z: mouseIndicator.position.z,
						visible: mouseIndicator.visible,
						desc: "Group only (no mesh child found)"
					};
				}
			} else {
				trace.cursorIndicator = {
					error: "No mouseIndicator found in connectorsGroup"
				};
			}
		}

		this.updateDebugOverlay(trace);
		return trace;
	}

	updateDebugOverlay(trace) {
		if (!this.debugOverlay) return;

		let html = '<strong>🔍 COORDINATE TRACE</strong><br><br>';

		// Screen Space
		html += `<strong>1. SCREEN SPACE</strong><br>`;
		html += `   X: ${trace.screenSpace.x.toFixed(1)} Y: ${trace.screenSpace.y.toFixed(1)}<br><br>`;

		// Canvas Space
		html += `<strong>2. CANVAS SPACE</strong><br>`;
		html += `   X: ${trace.canvasSpace.x.toFixed(1)} Y: ${trace.canvasSpace.y.toFixed(1)}<br>`;
		html += `   Canvas: ${trace.canvasSpace.canvasWidth}x${trace.canvasSpace.canvasHeight}<br><br>`;

		// NDC
		html += `<strong>3. NDC</strong><br>`;
		html += `   X: ${trace.ndc.x.toFixed(3)} Y: ${trace.ndc.y.toFixed(3)}<br><br>`;

		// InteractionManager mouse
		if (trace.interactionManagerMouse) {
			html += `<strong>4. INTERACTION MGR</strong><br>`;
			html += `   X: ${trace.interactionManagerMouse.x.toFixed(3)} Y: ${trace.interactionManagerMouse.y.toFixed(3)}<br>`;
			const ndcMatch = Math.abs(trace.ndc.x - trace.interactionManagerMouse.x) < 0.001 &&
			                Math.abs(trace.ndc.y - trace.interactionManagerMouse.y) < 0.001;
			html += `   <span style="color: ${ndcMatch ? '#00ff00' : '#ff0000'}">${ndcMatch ? '✓ Matches NDC' : '✗ NDC MISMATCH!'}</span><br><br>`;
		}

		// Camera
		if (trace.camera) {
			html += `<strong>5. CAMERA</strong><br>`;
			html += `   Pos: (${trace.camera.posX.toFixed(1)}, ${trace.camera.posY.toFixed(1)}, ${trace.camera.posZ.toFixed(1)})<br>`;
			html += `   Zoom: ${trace.camera.zoom.toFixed(3)}<br>`;
			html += `   Frustum: L:${trace.camera.left.toFixed(0)} R:${trace.camera.right.toFixed(0)} T:${trace.camera.top.toFixed(0)} B:${trace.camera.bottom.toFixed(0)}<br><br>`;
		}

		// World coords
		html += `<strong>6. WORLD COORDS</strong><br>`;
		if (trace.viewPlaneWorld && !trace.viewPlaneWorld.error) {
			html += `   View Plane: (${trace.viewPlaneWorld.x.toFixed(2)}, ${trace.viewPlaneWorld.y.toFixed(2)}, ${trace.viewPlaneWorld.z.toFixed(2)})<br>`;
		} else if (trace.viewPlaneWorld) {
			html += `   <span style="color: #ff0000">View Plane: ${trace.viewPlaneWorld.error}</span><br>`;
		}
		if (trace.groundPlaneWorld && !trace.groundPlaneWorld.error) {
			html += `   Ground Plane: (${trace.groundPlaneWorld.x.toFixed(2)}, ${trace.groundPlaneWorld.y.toFixed(2)}, ${trace.groundPlaneWorld.z.toFixed(2)})<br>`;
		}
		html += `<br>`;

		// Local coords
		if (trace.localOrigin) {
			html += `<strong>7. LOCAL COORDS</strong><br>`;
			html += `   Origin: (${trace.localOrigin.x.toFixed(2)}, ${trace.localOrigin.y.toFixed(2)})<br>`;
			if (trace.viewPlaneLocal) {
				html += `   View Plane Local: (${trace.viewPlaneLocal.x.toFixed(2)}, ${trace.viewPlaneLocal.y.toFixed(2)}, ${trace.viewPlaneLocal.z.toFixed(2)})<br>`;
			}
			html += `<br>`;
		}

		// Cursor indicator
		if (trace.cursorIndicator) {
			html += `<strong>8. CURSOR SPHERE</strong><br>`;
			if (trace.cursorIndicator.error) {
				html += `   <span style="color: #ff0000">✗ ${trace.cursorIndicator.error}</span><br>`;
			} else if (trace.cursorIndicator.meshX !== undefined) {
				// Group + Mesh structure
				html += `   Group: (${trace.cursorIndicator.groupX.toFixed(2)}, ${trace.cursorIndicator.groupY.toFixed(2)}, ${trace.cursorIndicator.groupZ.toFixed(2)})<br>`;
				html += `   Mesh: (${trace.cursorIndicator.meshX.toFixed(2)}, ${trace.cursorIndicator.meshY.toFixed(2)}, ${trace.cursorIndicator.meshZ.toFixed(2)})<br>`;
				html += `   Visible: ${trace.cursorIndicator.visible}<br>`;

				// Check if cursor mesh matches expected position
				if (trace.viewPlaneWorld && !trace.viewPlaneWorld.error && trace.localOrigin) {
					const expectedLocalX = trace.viewPlaneWorld.x - trace.localOrigin.x;
					const expectedLocalY = trace.viewPlaneWorld.y - trace.localOrigin.y;
					const deltaX = Math.abs(trace.cursorIndicator.meshX - expectedLocalX);
					const deltaY = Math.abs(trace.cursorIndicator.meshY - expectedLocalY);
					const isClose = deltaX < 1 && deltaY < 1;
					html += `   <span style="color: ${isClose ? '#00ff00' : '#ff0000'}">${isClose ? '✓ Mesh matches expected position' : `✗ OFF by (${deltaX.toFixed(1)}, ${deltaY.toFixed(1)})`}</span><br>`;
				}
			} else {
				// Simple position
				html += `   Pos: (${trace.cursorIndicator.x.toFixed(2)}, ${trace.cursorIndicator.y.toFixed(2)}, ${trace.cursorIndicator.z.toFixed(2)})<br>`;
				html += `   Visible: ${trace.cursorIndicator.visible}<br>`;

				// Check if cursor matches world coords
				if (trace.viewPlaneWorld && !trace.viewPlaneWorld.error && trace.localOrigin) {
					const expectedLocalX = trace.viewPlaneWorld.x - trace.localOrigin.x;
					const expectedLocalY = trace.viewPlaneWorld.y - trace.localOrigin.y;
					const deltaX = Math.abs(trace.cursorIndicator.x - expectedLocalX);
					const deltaY = Math.abs(trace.cursorIndicator.y - expectedLocalY);
					const isClose = deltaX < 1 && deltaY < 1;
					html += `   <span style="color: ${isClose ? '#00ff00' : '#ff0000'}">${isClose ? '✓ Matches expected position' : `✗ OFF by (${deltaX.toFixed(1)}, ${deltaY.toFixed(1)})`}</span><br>`;
				}
			}
		}

		this.debugOverlay.innerHTML = html;
	}

	// Export trace data to console for analysis
	logTrace(trace) {
		console.group("🔍 Coordinate Trace");
		console.log("Screen Space:", trace.screenSpace);
		console.log("Canvas Space:", trace.canvasSpace);
		console.log("NDC:", trace.ndc);
		console.log("InteractionManager Mouse:", trace.interactionManagerMouse);
		console.log("Raycaster:", trace.raycaster);
		console.log("Camera:", trace.camera);
		console.log("View Plane World:", trace.viewPlaneWorld);
		console.log("Ground Plane World:", trace.groundPlaneWorld);
		console.log("Local Origin:", trace.localOrigin);
		console.log("View Plane Local:", trace.viewPlaneLocal);
		console.log("Cursor Indicator:", trace.cursorIndicator);
		console.groupEnd();
	}
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
	window.CoordinateDebugger = CoordinateDebugger;
}
