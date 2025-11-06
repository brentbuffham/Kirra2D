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
		this.raycaster.setFromCamera(this.mouse, this.camera);
		
		// Step 4a) Raycast against all scene objects
		const scene = this.threeRenderer.scene;
		const intersects = this.raycaster.intersectObjects(scene.children, true);
		
		return intersects;
	}
	
	// Step 5) Find clicked hole from intersects
	findClickedHole(intersects, allBlastHoles) {
		if (!intersects || intersects.length === 0) return null;
		
		// Step 5a) Loop through intersects to find hole
		for (const intersect of intersects) {
			const userData = intersect.object.userData;
			
			// Step 5b) Check if this object represents a hole
			if (userData && userData.type === "hole" && userData.holeId) {
				// Step 5c) Find the corresponding hole data
				const hole = allBlastHoles.find(h => h.entityName === userData.holeId);
				if (hole) {
					console.log("🎯 Clicked hole:", hole.holeID, "at distance:", intersect.distance.toFixed(2));
					return hole;
				}
			}
			
			// Step 5d) Check for hole toe
			if (userData && userData.type === "holeToe" && userData.holeId) {
				const hole = allBlastHoles.find(h => h.entityName === userData.holeId);
				if (hole) {
					console.log("🎯 Clicked hole toe:", hole.holeID);
					return hole;
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
		
		// Step 7b) Convert from local Three.js coords to world coords
		// Note: threeLocalOriginX/Y are exposed via window
		const worldX = point.x + window.threeLocalOriginX;
		const worldY = point.y + window.threeLocalOriginY;
		const worldZ = point.z;
		
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


