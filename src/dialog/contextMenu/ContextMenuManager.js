// src/dialog/contextMenu/ContextMenuManager.js
//=============================================================
// CONTEXT MENU MANAGER
//=============================================================

// Import THREE.js for Vector3 projection
import * as THREE from "three";

// Step 1) Central dispatcher that handles all context menu routing
// Detects 2D vs 3D environment and routes right-clicks to appropriate context menu

// Step 2) Handle 2D context menu
function handle2DContextMenu(event) {
	event.preventDefault();
	closeAllContextMenus();

	// Step 2a) Prevent right-click from triggering drag behavior
	if (typeof window.isDragging !== "undefined") {
		window.isDragging = false;
	}
	if (typeof window.longPressTimeout !== "undefined") {
		clearTimeout(window.longPressTimeout);
	}

	const anyKADToolActive = window.addPointDraw.checked || window.addLineDraw.checked || window.addCircleDraw.checked || window.addPolyDraw.checked || window.addTextDraw.checked;

	const rect = window.canvas.getBoundingClientRect();
	const clickX = event.clientX - rect.left;
	const clickY = event.clientY - rect.top;

	// Step 2b) If a KAD tool is active, handle new object creation
	if (anyKADToolActive) {
		window.clearCurrentDrawingEntity();
		kadContextMenu(event);
		return;
	}

	// Step 2c) Get the clicked object to check if it's within snap radius
	const clickedHole = window.getClickedHole(clickX, clickY);
	const clickedKADObject = window.getClickedKADObject(clickX, clickY);

	console.log("🖱️  [2D Context Menu] Clicked objects - Hole:", clickedHole ? clickedHole.holeID : "null", "| KAD:", clickedKADObject ? clickedKADObject.entityType + " - " + clickedKADObject.entityName : "null");

	// Step 2d) Check if we clicked within snap radius of a selected object
	const snapRadius = window.getSnapToleranceInWorldUnits();
	const worldCoords = window.canvasToWorld(clickX, clickY);

	// Step 2e) For multiple KAD objects selected
	if (window.selectedMultipleKADObjects && window.selectedMultipleKADObjects.length > 1) {
		// Check if we clicked on one of the selected objects
		let clickedOnSelected = false;

		for (const kadObj of window.selectedMultipleKADObjects) {
			const entity = window.allKADDrawingsMap.get(kadObj.entityName);
			if (entity) {
				for (const point of entity.data) {
					const distance = Math.sqrt(Math.pow(point.pointXLocation - worldCoords[0], 2) + Math.pow(point.pointYLocation - worldCoords[1], 2));
					if (distance <= snapRadius) {
						clickedOnSelected = true;
						break;
					}
				}
			}
			if (clickedOnSelected) break;
		}

		if (clickedOnSelected) {
			window.showMultipleKADPropertyEditor(window.selectedMultipleKADObjects);
			window.debouncedUpdateTreeView();
			return;
		}
	}

	// Step 2f) For holes: Check multiple selection first, then single hole
	if (window.selectedMultipleHoles && window.selectedMultipleHoles.length > 1) {
		// Check if we clicked on one of the selected holes
		let clickedOnSelected = false;
		for (const hole of window.selectedMultipleHoles) {
			const distance = Math.sqrt(Math.pow(hole.startXLocation - worldCoords[0], 2) + Math.pow(hole.startYLocation - worldCoords[1], 2));
			if (distance <= snapRadius) {
				clickedOnSelected = true;
				break;
			}
		}

		if (clickedOnSelected) {
			window.showHolePropertyEditor(window.selectedMultipleHoles);
			window.debouncedUpdateTreeView();
			return;
		}
	}

	if (clickedHole) {
		const holeDistance = Math.sqrt(Math.pow(clickedHole.startXLocation - worldCoords[0], 2) + Math.pow(clickedHole.startYLocation - worldCoords[1], 2));
		if (holeDistance <= snapRadius) {
			window.showHolePropertyEditor(clickedHole);
			window.debouncedUpdateTreeView();
			return;
		}
	}

	// Step 2g) For KAD objects (Points, Lines, Polys, Circles, Text)
	// IMPORTANT: Show context menu for ANY clicked KAD object, not just when selection tools are active
	if (clickedKADObject) {
		console.log("📋 [2D Context Menu] KAD object detected:", clickedKADObject.entityType, clickedKADObject.entityName);
		// Check if within snap radius
		let withinSnapRadius = false;
		const entity = window.allKADDrawingsMap.get(clickedKADObject.entityName);

		if (entity) {
			if (clickedKADObject.selectionType === "vertex") {
				// For vertex selection, check distance to the specific vertex
				const point = entity.data[clickedKADObject.elementIndex];
				const distance = Math.sqrt(Math.pow(point.pointXLocation - worldCoords[0], 2) + Math.pow(point.pointYLocation - worldCoords[1], 2));
				withinSnapRadius = distance <= snapRadius;
				console.log("  📏 Vertex distance:", distance.toFixed(2), "| Snap radius:", snapRadius.toFixed(2), "| Within:", withinSnapRadius);
			} else if (clickedKADObject.selectionType === "segment") {
				// For segment selection, use the clicked position
				withinSnapRadius = true; // Already validated by getClickedKADObject
				console.log("  📏 Segment - auto within snap radius");
			}
		} else {
			console.log("  ❌ Entity not found in allKADDrawingsMap:", clickedKADObject.entityName);
		}

		if (withinSnapRadius) {
			console.log("  ✅ Showing KAD property editor");
			window.showKADPropertyEditorPopup(clickedKADObject);
			window.debouncedUpdateTreeView();
			return;
		} else {
			console.log("  ❌ Outside snap radius - not showing context menu");
		}
	} else {
		console.log("📋 [2D Context Menu] No KAD object detected");
	}

	// Step 2h) Check for surfaces and other context menus...
	const clickedSurfaceId = window.isPointInSurface(clickX, clickY);
	if (clickedSurfaceId) {
		window.showSurfaceContextMenu(clickX, clickY, clickedSurfaceId);
		return;
	}

	// Step 2i) Check for background images...
	let clickedImageId = null;
	for (const [imageId, image] of window.loadedImages.entries()) {
		if (image.visible && window.isPointInBackgroundImage(clickX, clickY, image)) {
			clickedImageId = imageId;
			break;
		}
	}

	if (clickedImageId) {
		window.showImageContextMenu(clickX, clickY, clickedImageId);
		return;
	}

	// Step 2j) Default canvas context menu...
	try {
		window.showContextMenu(event);
	} catch (err) {
		// Show status message for right clicks without objects
		window.updateStatusMessage("Right clicks need to be performed on an Object.");
		setTimeout(() => {
			window.updateStatusMessage("");
		}, 2000);
		console.log(err);
	}
}

// Step 3) Handle 3D context menu - COPIED FROM LEFT-CLICK LOGIC (handle3DClick)
function handle3DContextMenu(event) {
	// CRITICAL: Prevent default context menu FIRST (before any other logic)
	event.preventDefault();
	event.stopImmediatePropagation();

	console.log("🔴 [3D CONTEXT] Function called - browser menu should be blocked");

	// Step 3a) Only handle if in 3D mode
	if (!window.onlyShowThreeJS) {
		console.log("⏭️ [3D CONTEXT] Not in 3D mode, exiting");
		return;
	}

	// Step 3a1) Cancel right-click drag delay if context menu is shown
	if (window.cameraControls && typeof window.cameraControls.cancelRightClickDrag === "function") {
		window.cameraControls.cancelRightClickDrag();
	}

	// Step 3b) Close all existing context menus
	closeAllContextMenus();

	// Step 3c) Early return if dependencies not ready
	if (!window.threeInitialized || !window.threeRenderer || !window.interactionManager) {
		if (typeof window.updateStatusMessage === "function") {
			window.updateStatusMessage("Right clicks need to be performed on an Object.");
			setTimeout(() => {
				window.updateStatusMessage("");
			}, 2000);
		}
		return;
	}

	// Step 3d) Get 3D canvas
	const threeCanvas = window.threeRenderer.getCanvas();
	if (!threeCanvas) {
		return;
	}

	// Step 3e) Update mouse position and perform raycast (COPIED FROM LEFT-CLICK)
	window.interactionManager.updateMousePosition(event, threeCanvas);
	const intersects = window.interactionManager.raycast();

	console.log("🎯 [3D CONTEXT] Raycast results:", intersects.length, "intersects");

	// Step 3f) Find clicked hole (same as left-click)
	const clickedHole = window.interactionManager.findClickedHole ? window.interactionManager.findClickedHole(intersects, window.allBlastHoles || []) : null;

	if (clickedHole) {
		console.log("✅ [3D CONTEXT] Found hole:", clickedHole.holeID);
		// Show hole context menu
		if (typeof window.showHolePropertyEditor === "function") {
			window.showHolePropertyEditor(clickedHole);
		}
		if (typeof window.debouncedUpdateTreeView === "function") {
			window.debouncedUpdateTreeView();
		}
		return;
	}

	// Step 3g) No hole found - check for KAD objects (COPIED FROM LEFT-CLICK lines 1213-1515)
	let clickedKADObject = null;

	// Step 3g.1) Search raycast intersects for KAD objects
	for (const intersect of intersects) {
		let object = intersect.object;

		// Skip selection highlights
		let isHighlight = false;
		let checkObj = object;
		let depth = 0;
		while (checkObj && depth < 10) {
			if (checkObj.userData && checkObj.userData.type === "kadSelectionHighlight") {
				isHighlight = true;
				break;
			}
			checkObj = checkObj.parent;
			depth++;
		}

		if (isHighlight) {
			continue;
		}

		// Traverse up to find actual KAD object
		depth = 0;
		while (object && depth < 10) {
			if (object.userData && object.userData.kadId && object.userData.type && (object.userData.type === "kadPoint" || object.userData.type === "kadLine" || object.userData.type === "kadPolygon" || object.userData.type === "kadCircle" || object.userData.type === "kadText")) {
				console.log("✅ [3D CONTEXT] Found KAD object via raycast:", object.userData.kadId, "type:", object.userData.type);

				const entity = window.allKADDrawingsMap ? window.allKADDrawingsMap.get(object.userData.kadId) : null;
				if (entity) {
					let closestElementIndex = 0;
					let minDistance = Infinity;

					if (entity.data && entity.data.length > 1 && intersect.point) {
						const intersectWorldX = intersect.point.x + (window.threeLocalOriginX || 0);
						const intersectWorldY = intersect.point.y + (window.threeLocalOriginY || 0);

						entity.data.forEach((element, index) => {
							const elemX = element.pointXLocation || element.centerX;
							const elemY = element.pointYLocation || element.centerY;
							const dx = elemX - intersectWorldX;
							const dy = elemY - intersectWorldY;
							const distance = Math.sqrt(dx * dx + dy * dy);

							if (distance < minDistance) {
								minDistance = distance;
								closestElementIndex = index;
							}
						});
					}

					clickedKADObject = {
						entityName: object.userData.kadId,
						entityType: entity.entityType,
						elementIndex: closestElementIndex,
						selectionType: "vertex",
					};

					break;
				}
			}
			object = object.parent;
			depth++;
		}

		if (clickedKADObject) {
			break;
		}
	}

	// Step 3g.2) FALLBACK: Screen-space distance selection (COPIED FROM LEFT-CLICK lines 1308-1515)
	if (!clickedKADObject && window.allKADDrawingsMap && window.allKADDrawingsMap.size > 0) {
		console.log("🔍 [3D CONTEXT] No raycast hit, trying screen-space distance selection...");

		const camera = window.threeRenderer.camera;
		const canvas = window.threeRenderer.getCanvas();

		if (camera && canvas) {
			const rect = canvas.getBoundingClientRect();
			const mouseScreenX = event.clientX - rect.left;
			const mouseScreenY = event.clientY - rect.top;
			const canvasWidth = rect.width;
			const canvasHeight = rect.height;

			const snapTolerancePixels = window.snapRadiusPixels || 20;
			console.log("📏 [3D CONTEXT] Mouse at (" + mouseScreenX.toFixed(0) + "px, " + mouseScreenY.toFixed(0) + "px), tolerance: " + snapTolerancePixels + "px");

			// Helper function to project 3D world position to 2D screen pixels
			const worldToScreen = function (worldX, worldY, worldZ) {
				const local = window.worldToThreeLocal(worldX, worldY);
				const vector = new THREE.Vector3(local.x, local.y, worldZ);
				vector.project(camera);
				const screenX = ((vector.x + 1) * canvasWidth) / 2;
				const screenY = ((-vector.y + 1) * canvasHeight) / 2;
				return { x: screenX, y: screenY };
			};

			// Helper function for segment distance
			const screenPointToSegmentDistance = function (px, py, x1, y1, x2, y2) {
				const A = px - x1;
				const B = py - y1;
				const C = x2 - x1;
				const D = y2 - y1;
				const dot = A * C + B * D;
				const lenSq = C * C + D * D;

				if (lenSq === 0) {
					return Math.sqrt(A * A + B * B);
				}

				let t = dot / lenSq;
				t = Math.max(0, Math.min(1, t));

				const projX = x1 + t * C;
				const projY = y1 + t * D;
				const dx = px - projX;
				const dy = py - projY;

				return Math.sqrt(dx * dx + dy * dy);
			};

			let closestEntity = null;
			let closestEntityName = null;
			let closestDistance = Infinity;
			let closestElementIndex = 0;

			window.allKADDrawingsMap.forEach((entity, entityName) => {
				if (!entity.data || entity.data.length === 0) return;

				if (entity.entityType === "point") {
					entity.data.forEach((point, index) => {
						const screenPos = worldToScreen(point.pointXLocation, point.pointYLocation, point.pointZLocation || window.dataCentroidZ || 0);
						const dx = screenPos.x - mouseScreenX;
						const dy = screenPos.y - mouseScreenY;
						const distance = Math.sqrt(dx * dx + dy * dy);

						if (distance < closestDistance) {
							closestDistance = distance;
							closestEntity = entity;
							closestEntityName = entityName;
							closestElementIndex = index;
						}
					});
				} else if (entity.entityType === "line" || entity.entityType === "poly") {
					const points = entity.data;
					if (points.length >= 2) {
						const numSegments = entity.entityType === "poly" ? points.length : points.length - 1;

						let closestSegmentIndex = 0;
						let closestSegmentDistance = Infinity;

						for (let i = 0; i < numSegments; i++) {
							const p1 = points[i];
							const p2 = points[(i + 1) % points.length];

							const screen1 = worldToScreen(p1.pointXLocation, p1.pointYLocation, p1.pointZLocation || window.dataCentroidZ || 0);
							const screen2 = worldToScreen(p2.pointXLocation, p2.pointYLocation, p2.pointZLocation || window.dataCentroidZ || 0);

							const segmentDist = screenPointToSegmentDistance(mouseScreenX, mouseScreenY, screen1.x, screen1.y, screen2.x, screen2.y);

							if (segmentDist < closestSegmentDistance) {
								closestSegmentDistance = segmentDist;
								closestSegmentIndex = i;
							}
						}

						if (closestSegmentDistance < closestDistance) {
							closestDistance = closestSegmentDistance;
							closestEntity = entity;
							closestEntityName = entityName;
							closestElementIndex = closestSegmentIndex;
						}
					}
				} else if (entity.entityType === "circle") {
					entity.data.forEach((circle, index) => {
						const centerX = circle.pointXLocation || circle.centerX;
						const centerY = circle.pointYLocation || circle.centerY;
						const centerZ = circle.pointZLocation || window.dataCentroidZ || 0;

						const screenCenter = worldToScreen(centerX, centerY, centerZ);
						const dx = screenCenter.x - mouseScreenX;
						const dy = screenCenter.y - mouseScreenY;
						const distance = Math.sqrt(dx * dx + dy * dy);

						if (distance < closestDistance) {
							closestDistance = distance;
							closestEntity = entity;
							closestEntityName = entityName;
							closestElementIndex = index;
						}
					});
				} else if (entity.entityType === "text") {
					entity.data.forEach((text, index) => {
						const screenPos = worldToScreen(text.pointXLocation, text.pointYLocation, text.pointZLocation || window.dataCentroidZ || 0);
						const dx = screenPos.x - mouseScreenX;
						const dy = screenPos.y - mouseScreenY;
						const distance = Math.sqrt(dx * dx + dy * dy);

						if (distance < closestDistance) {
							closestDistance = distance;
							closestEntity = entity;
							closestEntityName = entityName;
							closestElementIndex = index;
						}
					});
				}
			});

			// Check if within tolerance
			if (closestEntity && closestDistance <= snapTolerancePixels) {
				console.log("✅ [3D CONTEXT] Found entity by screen distance:", closestEntityName, "type:", closestEntity.entityType, "distance:", closestDistance.toFixed(1) + "px");

				let selectionType = "vertex";
				if (closestEntity.entityType === "line" || closestEntity.entityType === "poly") {
					selectionType = "segment";
				}

				clickedKADObject = {
					entityName: closestEntityName,
					entityType: closestEntity.entityType,
					elementIndex: closestElementIndex,
					segmentIndex: closestElementIndex,
					selectionType: selectionType,
				};

				// Add type-specific properties
				if (closestEntity.data && closestEntity.data[closestElementIndex]) {
					const clickedElement = closestEntity.data[closestElementIndex];
					if (closestEntity.entityType === "circle") {
						clickedKADObject.pointXLocation = clickedElement.pointXLocation || clickedElement.centerX;
						clickedKADObject.pointYLocation = clickedElement.pointYLocation || clickedElement.centerY;
						clickedKADObject.radius = clickedElement.radius;
					} else if (closestEntity.entityType === "text") {
						clickedKADObject.pointXLocation = clickedElement.pointXLocation;
						clickedKADObject.pointYLocation = clickedElement.pointYLocation;
						clickedKADObject.text = clickedElement.text;
					} else {
						clickedKADObject.pointXLocation = clickedElement.pointXLocation;
						clickedKADObject.pointYLocation = clickedElement.pointYLocation;
					}
				}
			}
		}
	}

	// Step 3h) Now show context menu based on what was clicked
	console.log("🖱️  [3D CONTEXT] Final result - Hole:", clickedHole ? clickedHole.holeID : "null", "| KAD:", clickedKADObject ? clickedKADObject.entityType + " - " + clickedKADObject.entityName : "null");

	// Step 3i) Show context menu for KAD objects
	if (clickedKADObject) {
		console.log("📋 [3D CONTEXT] Showing context menu for KAD:", clickedKADObject.entityType, clickedKADObject.entityName);
		if (typeof window.showKADPropertyEditorPopup === "function") {
			window.showKADPropertyEditorPopup(clickedKADObject);
		}
		if (typeof window.debouncedUpdateTreeView === "function") {
			window.debouncedUpdateTreeView();
		}
		return;
	}

	// Step 3j) Show context menu for surfaces
	const clickedSurfaceId = window.interactionManager.findClickedSurface ? window.interactionManager.findClickedSurface(intersects) : null;
	if (clickedSurfaceId) {
		console.log("📋 [3D CONTEXT] Showing context menu for surface:", clickedSurfaceId);
		if (typeof window.showSurfaceContextMenu === "function") {
			window.showSurfaceContextMenu(event.clientX, event.clientY, clickedSurfaceId);
		}
		if (typeof window.debouncedUpdateTreeView === "function") {
			window.debouncedUpdateTreeView();
		}
		return;
	}

	// Step 3k) Show context menu for images
	const clickedImageId = window.interactionManager.findClickedImage ? window.interactionManager.findClickedImage(intersects) : null;
	if (clickedImageId) {
		console.log("📋 [3D CONTEXT] Showing context menu for image:", clickedImageId);
		if (typeof window.showImageContextMenu === "function") {
			window.showImageContextMenu(event.clientX, event.clientY, clickedImageId);
		}
		if (typeof window.debouncedUpdateTreeView === "function") {
			window.debouncedUpdateTreeView();
		}
		return;
	}

	// Step 3l) Default - no object clicked
	console.log("📋 [3D CONTEXT] No object clicked - showing default message");
	if (typeof window.updateStatusMessage === "function") {
		window.updateStatusMessage("Right clicks need to be performed on an Object.");
		setTimeout(() => {
			window.updateStatusMessage("");
		}, 2000);
	}
}

// Step 4) Helper function to close all context menus
function closeAllContextMenus() {
	// Find all elements that could be context menus
	const existingMenus = document.querySelectorAll('.context-menu, [style*="position: absolute"][style*="background"], div[onclick]');

	existingMenus.forEach((menu) => {
		// Check if it looks like a context menu (has background and position styling)
		const style = menu.style;
		if (style.position === "absolute" && (style.background || style.backgroundColor) && document.body.contains(menu)) {
			try {
				document.body.removeChild(menu);
				console.log("🗑️ Removed existing context menu");
				if (typeof window.debouncedUpdateTreeView === "function") {
					window.debouncedUpdateTreeView(); // Use debounced version
				}
			} catch (error) {
				// Menu already removed
			}
		}
	});
}

// Step 5) KAD context menu for when KAD tools are active
function kadContextMenu(e) {
	e.preventDefault(); // Prevent context menu

	// Check if any KAD drawing tool is active
	const anyKADToolActive = window.addPointDraw.checked || window.addLineDraw.checked || window.addCircleDraw.checked || window.addPolyDraw.checked || window.addTextDraw.checked;

	if (anyKADToolActive) {
		// Start a new object within the same tool
		window.createNewEntity = true; // This will create a new entity name on next click
		window.lastKADDrawPoint = null; // Reset preview line

		// Show status message
		window.updateStatusMessage("Starting new object - continue drawing");

		// Brief visual feedback
		setTimeout(() => {
			window.updateStatusMessage("");
		}, 1500);

		// Redraw to clear any preview lines
		window.drawData(window.allBlastHoles, window.selectedHole);
	}
}

//===========================================
// CONTEXT MENU MANAGER END
//===========================================

// Export functions as ES6 module
export { handle2DContextMenu, handle3DContextMenu, closeAllContextMenus, kadContextMenu };
