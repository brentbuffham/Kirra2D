/* prettier-ignore-file */
//=================================================
// InteractionManager.js - 3D Object Interaction & Selection
//=================================================
// Handles raycasting, object picking, and interaction for Three.js canvas

import * as THREE from "three";

export class InteractionManager {
	constructor(threeRenderer, camera) {
		this.threeRenderer = threeRenderer;
		this.camera = camera;

		// Step 1) Create raycaster for object picking
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();

		// Step 2) Store currently hovered object
		this.hoveredObject = null;
		this.hoveredHole = null;
		
		// Step 2a) Track warning messages to prevent spam
		this.lastWarningTime = 0;
		this.warningThrottle = 1000; // Only show warning once per second

		console.log("✨ InteractionManager initialized");
	}

	//=================================================
	// Mouse Position Conversion
	//=================================================

	// Step 3) Convert mouse coordinates to normalized device coordinates (-1 to +1)
	updateMousePosition(event, canvas) {
		const rect = canvas.getBoundingClientRect();
		this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
	}

	//=================================================
	// Raycasting & Object Detection
	//=================================================

	// Step 4) Perform raycast and return intersected objects
	raycast() {
		// Step 4a) Use current camera state from threeRenderer (not stored reference)
		// This ensures raycasting works with current camera orientation/orbit/rotation
		const currentCamera = this.threeRenderer.camera;
		this.raycaster.setFromCamera(this.mouse, currentCamera);

		// Step 4a.1) Set raycaster threshold for detecting lines/points
		// Convert snap tolerance from pixels to world units (rough approximation)
		const snapTolerancePixels = window.snapRadiusPixels || 20;
		const currentScale = window.currentScale || 5;
		const thresholdWorld = (snapTolerancePixels / currentScale) * 0.5;
		
		// Step 4a.2) Configure raycaster parameters for better line/point detection
		this.raycaster.params.Line = { threshold: thresholdWorld };
		this.raycaster.params.Points = { threshold: thresholdWorld };

		// Step 4b) Raycast against all scene objects
		const scene = this.threeRenderer.scene;
		const intersects = this.raycaster.intersectObjects(scene.children, true);

		// Debug: Log raycast details
		if (intersects.length > 0) {
			//console.log("🔍 Raycast hit", intersects.length, "objects. First:", intersects[0].object.userData, "distance:", intersects[0].distance.toFixed(2));
		}

		return intersects;
	}

	// Step 5) Find clicked hole from intersects
	findClickedHole(intersects, allBlastHoles) {
		if (!intersects || intersects.length === 0) return null;

		// Step 5a) Loop through intersects to find hole
		for (const intersect of intersects) {
			let object = intersect.object;
			let userData = object.userData;

			// Step 5b) Traverse up the parent chain to find hole userData
			// Raycast might hit child meshes that don't have userData
			while (object && (!userData || !userData.holeId)) {
				object = object.parent;
				if (object) {
					userData = object.userData;
				} else {
					break;
				}
			}

			// Step 5c) Check if this object represents a hole
			if (userData && userData.type === "hole" && userData.holeId) {
				// Step 5d) Find the corresponding hole data
				// userData.holeId is now unique: entityName:::holeID (e.g. "PolygonPattern_123:::5")
				// Match against the combined identifier
				const hole = allBlastHoles.find((h) => h.entityName + ":::" + h.holeID === userData.holeId);
				if (hole) {
					console.log("🎯 Clicked hole:", hole.holeID, "in", hole.entityName, "at distance:", intersect.distance.toFixed(2));
					return hole;
				} else {
					console.log("⚠️ Could not find hole with holeId:", userData.holeId);
				}
			}

			// Step 5e) Check for hole toe (also traverse up)
			if (userData && userData.type === "holeToe" && userData.holeId) {
				const hole = allBlastHoles.find((h) => h.entityName + ":::" + h.holeID === userData.holeId);
				if (hole) {
					console.log("🎯 Clicked hole toe:", hole.holeID);
					return hole;
				}
			}

			// Step 5f) Also check if parent is a Group with hole userData
			if (object && object.parent) {
				const parentUserData = object.parent.userData;
				if (parentUserData && parentUserData.type === "hole" && parentUserData.holeId) {
					const hole = allBlastHoles.find((h) => h.entityName + ":::" + h.holeID === parentUserData.holeId);
					if (hole) {
						console.log("🎯 Clicked hole (via parent):", hole.holeID, "in", hole.entityName);
						return hole;
					}
				}
			}
		}

		return null;
	}

	// Step 6) Find clicked KAD object from intersects
	findClickedKAD(intersects, kadEntities) {
		if (!intersects || intersects.length === 0) return null;

		for (const intersect of intersects) {
			const userData = intersect.object.userData;

			// Step 6a) Check if this object is a KAD entity
			if (userData && userData.type && userData.type.startsWith("kad")) {
				const kadId = userData.kadId;
				if (kadId) {
					console.log("🎯 Clicked KAD object:", userData.type, kadId);
					return { type: userData.type, id: kadId, userData: userData };
				}
			}
		}

		return null;
	}

	// Step 7) Get 3D world position from raycast hit
	getWorldPosition(intersects) {
		if (!intersects || intersects.length === 0) return null;

		// Step 7a) Get the first intersection point
		const point = intersects[0].point;
		if (!point || !isFinite(point.x) || !isFinite(point.y) || !isFinite(point.z)) {
			return null;
		}

		// Step 7b) Convert from local Three.js coords to world coords
		// Note: threeLocalOriginX/Y are exposed via window
		// Ensure they are valid numbers, default to 0 if undefined
		const originX = window.threeLocalOriginX !== undefined && isFinite(window.threeLocalOriginX) ? window.threeLocalOriginX : 0;
		const originY = window.threeLocalOriginY !== undefined && isFinite(window.threeLocalOriginY) ? window.threeLocalOriginY : 0;

		const worldX = point.x + originX;
		const worldY = point.y + originY;
		const worldZ = point.z;

		// Step 7c) Validate the result before returning
		if (!isFinite(worldX) || !isFinite(worldY) || !isFinite(worldZ)) {
			console.warn("getWorldPosition: Invalid world coordinates", {
				point: point,
				originX: originX,
				originY: originY,
				worldX: worldX,
				worldY: worldY,
				worldZ: worldZ,
			});
			return null;
		}

		return { x: worldX, y: worldY, z: worldZ };
	}

	// Step 7.4b) Get mouse world position on camera view plane (frustum plane)
	// This returns position on a plane perpendicular to camera view direction
	// passing through the orbit center or specified point
	getMouseWorldPositionOnViewPlane(centerPoint = null) {
		// Step 7.4b.1) Use current camera for raycasting
		const currentCamera = this.threeRenderer.camera;
		this.raycaster.setFromCamera(this.mouse, currentCamera);

		// Step 7.4b.2) Get camera view direction (normal to the view plane)
		const viewDirection = new THREE.Vector3();
		currentCamera.getWorldDirection(viewDirection);

		// Step 7.4b.3) Determine the center point the plane passes through
		// Use orbit center if available, or provided centerPoint, or data centroid
		let planeCenter = new THREE.Vector3();
		if (centerPoint && isFinite(centerPoint.x) && isFinite(centerPoint.y) && isFinite(centerPoint.z)) {
			planeCenter.set(centerPoint.x, centerPoint.y, centerPoint.z);
		} else if (window.cameraControls) {
			const state = window.cameraControls.getCameraState();
			const orbitCenterZ = this.threeRenderer.orbitCenterZ || 0;
			planeCenter.set(state.centroidX, state.centroidY, orbitCenterZ);
		} else {
			const fallbackZ = window.dataCentroidZ || 0;
			planeCenter.set(0, 0, fallbackZ);
		}

		// Step 7.4b.4) Create view plane perpendicular to camera direction
		const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(viewDirection, planeCenter);

		// Step 7.4b.5) Get intersection point with the view plane
		const intersectionPoint = new THREE.Vector3();
		const hasIntersection = this.raycaster.ray.intersectPlane(plane, intersectionPoint);

		if (!hasIntersection) {
			// Step 7.4b.6) Fallback: project to plane center
			console.warn("View plane intersection failed - using plane center");
			return {
				x: planeCenter.x,
				y: planeCenter.y,
				z: planeCenter.z
			};
		}

		// Step 7.4b.7) Convert to world coordinates
		const originX = window.threeLocalOriginX !== undefined ? window.threeLocalOriginX : 0;
		const originY = window.threeLocalOriginY !== undefined ? window.threeLocalOriginY : 0;
		const worldX = intersectionPoint.x + originX;
		const worldY = intersectionPoint.y + originY;
		const worldZ = intersectionPoint.z;

		return { x: worldX, y: worldY, z: worldZ };
	}

	// Step 7.5) Get mouse world position using plane intersection (always returns valid position)
	getMouseWorldPositionOnPlane(zLevel = null) {
		// Step 7.5a) Use current camera for raycasting
		const currentCamera = this.threeRenderer.camera;
		this.raycaster.setFromCamera(this.mouse, currentCamera);

		// Step 7.5b) Determine Z level for the plane
		// Use provided zLevel, or fallback to dataCentroidZ, or 0
		const planeZ = zLevel !== null && isFinite(zLevel) ? zLevel : window.dataCentroidZ !== undefined && isFinite(window.dataCentroidZ) ? window.dataCentroidZ : 0;

		// Step 7.5c) Create a horizontal plane at the Z level
		// Plane normal points up (0, 0, 1) and passes through (0, 0, planeZ)
		// THREE.Plane(normal, constant) where constant = -distance from origin along normal
		// For a plane at Z = planeZ, we want normal (0,0,1) and constant = -planeZ
		const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);

		// Step 7.5d) Get intersection point with the plane
		const intersectionPoint = new THREE.Vector3();
		const hasIntersection = this.raycaster.ray.intersectPlane(plane, intersectionPoint);

		if (!hasIntersection) {
			// Step 7.5d.1) Fallback for orthographic camera in plan view
			// Calculate intersection manually using camera projection
			if (currentCamera.isOrthographicCamera) {
				// For orthographic camera, rays are parallel
				// Unproject at Z=0 (near plane) and Z=1 (far plane) to get ray direction
				const near = new THREE.Vector3(this.mouse.x, this.mouse.y, 0);
				near.unproject(currentCamera);
				
				const far = new THREE.Vector3(this.mouse.x, this.mouse.y, 1);
				far.unproject(currentCamera);
				
				// Calculate ray direction
				const direction = new THREE.Vector3().subVectors(far, near).normalize();
				
				// Find where ray intersects Z = planeZ
				// ray: p = near + t * direction
				// Solve for t where z = planeZ:  near.z + t * direction.z = planeZ
				const t = (planeZ - near.z) / direction.z;
				
				intersectionPoint.copy(near).addScaledVector(direction, t);
				
				console.log("✅ Using orthographic unprojection fallback at Z=" + planeZ);
			} else {
				// Step 7.5d.2) Debug why intersection failed for perspective camera (throttled)
				const now = Date.now();
				if (now - this.lastWarningTime > this.warningThrottle) {
					this.lastWarningTime = now;
					const rayDir = this.raycaster.ray.direction;
					const planeNormal = plane.normal;
					const dotProduct = rayDir.dot(planeNormal);
					
					console.warn("getMouseWorldPositionOnPlane: No plane intersection", {
						planeZ: planeZ,
						rayOrigin: this.raycaster.ray.origin.toArray(),
						rayDirection: rayDir.toArray(),
						planeNormal: planeNormal.toArray(),
						planeConstant: plane.constant,
						dotProduct: dotProduct,
						cameraPosition: currentCamera.position.toArray(),
						cameraRotation: currentCamera.rotation.toArray()
					});
				}
				return null;
			}
		}

		// Step 7.5e) Convert from local Three.js coords to world coords
		const originX = window.threeLocalOriginX !== undefined && isFinite(window.threeLocalOriginX) ? window.threeLocalOriginX : 0;
		const originY = window.threeLocalOriginY !== undefined && isFinite(window.threeLocalOriginY) ? window.threeLocalOriginY : 0;

		const worldX = intersectionPoint.x + originX;
		const worldY = intersectionPoint.y + originY;
		const worldZ = intersectionPoint.z;

		// Step 7.5f) Validate result
		if (!isFinite(worldX) || !isFinite(worldY) || !isFinite(worldZ)) {
			console.warn("getMouseWorldPositionOnPlane: Invalid coordinates", {
				intersectionPoint: intersectionPoint,
				worldX: worldX,
				worldY: worldY,
				worldZ: worldZ,
			});
			return null;
		}

		return { x: worldX, y: worldY, z: worldZ };
	}

	//=================================================
	// Hover Detection
	//=================================================

	// Step 8) Update hover state
	updateHover(intersects, allBlastHoles) {
		const hoveredHole = this.findClickedHole(intersects, allBlastHoles);

		// Step 8a) Check if hover changed
		if (hoveredHole !== this.hoveredHole) {
			// Step 8b) Clear previous hover
			if (this.hoveredObject) {
				this.clearHoverHighlight(this.hoveredObject);
			}

			// Step 8c) Set new hover
			this.hoveredHole = hoveredHole;

			if (hoveredHole && intersects.length > 0) {
				this.hoveredObject = intersects[0].object;
				this.applyHoverHighlight(this.hoveredObject);
			} else {
				this.hoveredObject = null;
			}
		}

		return hoveredHole;
	}

	// Step 9) Apply hover highlight
	applyHoverHighlight(object) {
		if (!object || !object.material) return;

		// Step 9a) Store original emissive color
		if (!object.userData.originalEmissive) {
			object.userData.originalEmissive = object.material.emissive ? object.material.emissive.clone() : new THREE.Color(0x000000);
			object.userData.originalEmissiveIntensity = object.material.emissiveIntensity || 0;
		}

		// Step 9b) Apply hover highlight (slight yellow glow)
		if (object.material.emissive) {
			object.material.emissive = new THREE.Color(0xffff88);
			object.material.emissiveIntensity = 0.3;
		}
	}

	// Step 10) Clear hover highlight
	clearHoverHighlight(object) {
		if (!object || !object.material || !object.userData.originalEmissive) return;

		// Step 10a) Restore original emissive
		if (object.material.emissive) {
			object.material.emissive = object.userData.originalEmissive;
			object.material.emissiveIntensity = object.userData.originalEmissiveIntensity;
		}

		// Step 10b) Clean up userData
		delete object.userData.originalEmissive;
		delete object.userData.originalEmissiveIntensity;
	}

	// Step 11) Clear all hovers
	clearAllHovers() {
		if (this.hoveredObject) {
			this.clearHoverHighlight(this.hoveredObject);
			this.hoveredObject = null;
		}
		this.hoveredHole = null;
	}
}
