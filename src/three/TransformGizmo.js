// src/three/TransformGizmo.js
//=============================================================
// TRANSFORM GIZMO - 3D Visualization for Transform Tool
//=============================================================
// Renders translation arrows and rotation arcs at selection centroid
// Supports mouse interaction for dragging
// Created: 2026-02-03

import * as THREE from "three";

/**
 * TransformGizmo - 3D gizmo for translate/rotate operations
 * Creates arrows for X/Y/Z translation and arcs for rotation
 */
export class TransformGizmo {
	constructor(threeRenderer) {
		this.threeRenderer = threeRenderer;
		this.gizmoGroup = new THREE.Group();
		this.gizmoGroup.name = "TransformGizmo";
		this.gizmoGroup.renderOrder = 9999; // Render on top

		// Base size for screen-space scaling
		this.baseSize = 50; // World units

		// Gizmo components
		this.xArrow = null;
		this.yArrow = null;
		this.zArrow = null;
		this.bearingArc = null;
		this.pitchArc = null;
		this.rollArc = null;

		// Interaction state
		this.activeHandle = null; // "x", "y", "z", "bearing", "pitch", "roll"
		this.isDragging = false;
		this.dragStartPoint = null;
		this.dragStartMouseX = 0;
		this.dragStartMouseY = 0;
		this.dragStartTranslation = { x: 0, y: 0, z: 0 };
		this.dragStartRotation = { bearing: 0, pitch: 0, roll: 0 };

		// Current values
		this.currentTranslation = { x: 0, y: 0, z: 0 };
		this.currentRotation = { bearing: 0, pitch: 0, roll: 0 };
		this.worldPosition = { x: 0, y: 0, z: 0 };

		// Raycaster for hit testing
		this.raycaster = new THREE.Raycaster();
		this.raycaster.params.Line.threshold = 5; // Increase hit tolerance for lines

		// Callbacks
		this.onTranslationChange = null;
		this.onRotationChange = null;

		// Create gizmo geometry
		this.createGizmo();

		// Add to scene
		if (threeRenderer && threeRenderer.scene) {
			threeRenderer.scene.add(this.gizmoGroup);
		}

		// Bind event handlers
		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.handleMouseMove = this.handleMouseMove.bind(this);
		this.handleMouseUp = this.handleMouseUp.bind(this);

		// Add global mouse listeners for drag
		document.addEventListener("mousemove", this.handleMouseMove);
		document.addEventListener("mouseup", this.handleMouseUp);
	}

	/**
	 * Create all gizmo components
	 */
	createGizmo() {
		const arrowLength = this.baseSize;
		const arcRadius = this.baseSize * 0.8;

		// Create translation arrows
		this.xArrow = this.createArrow(0xff4444, new THREE.Vector3(1, 0, 0), arrowLength, "x");
		this.yArrow = this.createArrow(0x44ff44, new THREE.Vector3(0, 1, 0), arrowLength, "y");
		this.zArrow = this.createArrow(0x4444ff, new THREE.Vector3(0, 0, 1), arrowLength, "z");

		// Create rotation arcs
		this.bearingArc = this.createRotationArc(0x4444ff, "z", arcRadius, "bearing");
		this.pitchArc = this.createRotationArc(0xff4444, "x", arcRadius, "pitch");
		this.rollArc = this.createRotationArc(0x44ff44, "y", arcRadius, "roll");

		// Add to group
		this.gizmoGroup.add(this.xArrow);
		this.gizmoGroup.add(this.yArrow);
		this.gizmoGroup.add(this.zArrow);
		this.gizmoGroup.add(this.bearingArc);
		this.gizmoGroup.add(this.pitchArc);
		this.gizmoGroup.add(this.rollArc);
	}

	/**
	 * Create a translation arrow (cylinder + cone)
	 */
	createArrow(color, direction, length, handleId) {
		const group = new THREE.Group();
		group.userData = { type: "translateAxis", handleId: handleId };

		const shaftRadius = length * 0.02;
		const headRadius = length * 0.06;
		const headLength = length * 0.15;
		const shaftLength = length - headLength;

		// Shaft (cylinder)
		const shaftGeometry = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 8);
		const material = new THREE.MeshBasicMaterial({
			color: color,
			transparent: true,
			opacity: 0.9,
			depthTest: false
		});
		const shaft = new THREE.Mesh(shaftGeometry, material);
		shaft.position.y = shaftLength / 2;
		shaft.userData = { type: "translateAxis", handleId: handleId };

		// Head (cone)
		const headGeometry = new THREE.ConeGeometry(headRadius, headLength, 12);
		const head = new THREE.Mesh(headGeometry, material.clone());
		head.position.y = shaftLength + headLength / 2;
		head.userData = { type: "translateAxis", handleId: handleId };

		group.add(shaft);
		group.add(head);

		// Rotate group to point in direction
		if (direction.x === 1) {
			group.rotation.z = -Math.PI / 2;
		} else if (direction.z === 1) {
			group.rotation.x = Math.PI / 2;
		}
		// Y direction is default (no rotation needed)

		return group;
	}

	/**
	 * Create a rotation arc (semi-circle line)
	 */
	createRotationArc(color, axis, radius, handleId) {
		const group = new THREE.Group();
		group.userData = { type: "rotateAxis", handleId: handleId };

		// Create arc curve (270 degrees for better visibility)
		const segments = 48;
		const points = [];
		const startAngle = -Math.PI * 0.75;
		const endAngle = Math.PI * 0.75;

		for (let i = 0; i <= segments; i++) {
			const angle = startAngle + (endAngle - startAngle) * (i / segments);
			points.push(new THREE.Vector3(
				Math.cos(angle) * radius,
				Math.sin(angle) * radius,
				0
			));
		}

		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const material = new THREE.LineBasicMaterial({
			color: color,
			transparent: true,
			opacity: 0.6,
			linewidth: 2,
			depthTest: false
		});

		const arc = new THREE.Line(geometry, material);
		arc.userData = { type: "rotateAxis", handleId: handleId };
		group.add(arc);

		// Add small spheres at arc ends for easier grabbing
		const sphereGeometry = new THREE.SphereGeometry(radius * 0.08, 8, 8);
		const sphereMaterial = new THREE.MeshBasicMaterial({
			color: color,
			transparent: true,
			opacity: 0.8,
			depthTest: false
		});

		const startSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		startSphere.position.copy(points[0]);
		startSphere.userData = { type: "rotateAxis", handleId: handleId };
		group.add(startSphere);

		const endSphere = new THREE.Mesh(sphereGeometry, sphereMaterial.clone());
		endSphere.position.copy(points[points.length - 1]);
		endSphere.userData = { type: "rotateAxis", handleId: handleId };
		group.add(endSphere);

		// Rotate arc to appropriate plane
		if (axis === "x") {
			// Pitch - rotate around X, arc in YZ plane
			group.rotation.y = Math.PI / 2;
		} else if (axis === "y") {
			// Roll - rotate around Y, arc in XZ plane
			group.rotation.x = Math.PI / 2;
		}
		// Z axis (bearing) is default - arc in XY plane

		return group;
	}

	/**
	 * Update gizmo position (world coordinates)
	 */
	updatePosition(worldX, worldY, worldZ) {
		this.worldPosition = { x: worldX, y: worldY, z: worldZ };

		// Convert to Three.js local coordinates
		const localX = worldX - (window.threeLocalOriginX || 0);
		const localY = worldY - (window.threeLocalOriginY || 0);

		this.gizmoGroup.position.set(localX, localY, worldZ);

		if (this.threeRenderer) {
			this.threeRenderer.requestRender();
		}
	}

	/**
	 * Update gizmo rotation visualization
	 */
	updateRotation(bearingRad, pitchRad, rollRad) {
		this.currentRotation = {
			bearing: bearingRad,
			pitch: pitchRad,
			roll: rollRad
		};

		// Don't rotate the entire gizmo - just update internal state
		// The gizmo axes should stay aligned with world axes

		if (this.threeRenderer) {
			this.threeRenderer.requestRender();
		}
	}

	/**
	 * Update gizmo scale for screen-space sizing
	 * @param {number} scale - Current view scale (pixels per world unit)
	 */
	updateScale(scale) {
		if (!scale || scale <= 0) return;

		// Maintain fixed screen size (approximately 100 pixels)
		const desiredScreenPixels = 100;
		const worldUnitsForFixedSize = desiredScreenPixels / scale;
		const scaleFactor = worldUnitsForFixedSize / this.baseSize;

		this.gizmoGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

		if (this.threeRenderer) {
			this.threeRenderer.requestRender();
		}
	}

	/**
	 * Set gizmo visibility
	 */
	setVisible(visible) {
		this.gizmoGroup.visible = visible;

		if (this.threeRenderer) {
			this.threeRenderer.requestRender();
		}
	}

	/**
	 * Handle mouse down - check for gizmo hit
	 * @param {MouseEvent} event
	 * @returns {boolean} - true if gizmo was hit
	 */
	handleMouseDown(event) {
		if (!this.gizmoGroup.visible) return false;

		const canvas = this.threeRenderer?.getCanvas();
		if (!canvas) return false;

		// Calculate normalized device coordinates
		const rect = canvas.getBoundingClientRect();
		const mouseNDC = new THREE.Vector2(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);

		// Raycast against gizmo
		const camera = this.threeRenderer?.camera;
		if (!camera) return false;

		camera.updateMatrixWorld(true);
		camera.updateProjectionMatrix();

		this.raycaster.setFromCamera(mouseNDC, camera);
		const intersects = this.raycaster.intersectObject(this.gizmoGroup, true);

		if (intersects.length > 0) {
			// Find the handle that was hit
			let hitObject = intersects[0].object;
			while (hitObject && !hitObject.userData.handleId) {
				hitObject = hitObject.parent;
			}

			if (hitObject && hitObject.userData.handleId) {
				this.activeHandle = hitObject.userData.handleId;
				this.isDragging = true;
				this.dragStartMouseX = event.clientX;
				this.dragStartMouseY = event.clientY;
				this.dragStartTranslation = { ...this.currentTranslation };
				this.dragStartRotation = { ...this.currentRotation };
				this.dragStartPoint = intersects[0].point.clone();

				// Prevent default to stop camera controls
				event.preventDefault();
				event.stopPropagation();

				console.log("Gizmo handle grabbed:", this.activeHandle);
				return true;
			}
		}

		return false;
	}

	/**
	 * Handle mouse move during drag
	 */
	handleMouseMove(event) {
		if (!this.isDragging || !this.activeHandle) return;

		const deltaX = event.clientX - this.dragStartMouseX;
		const deltaY = event.clientY - this.dragStartMouseY;

		// Get scale for world unit conversion
		const scale = window.currentScale || 1;
		const sensitivity = 1 / scale;
		const rotationSensitivity = 0.005; // radians per pixel

		if (this.activeHandle === "x" || this.activeHandle === "y" || this.activeHandle === "z") {
			// Translation
			const newTranslation = { ...this.dragStartTranslation };

			if (this.activeHandle === "x") {
				newTranslation.x = this.dragStartTranslation.x + deltaX * sensitivity;
			} else if (this.activeHandle === "y") {
				newTranslation.y = this.dragStartTranslation.y - deltaY * sensitivity;
			} else if (this.activeHandle === "z") {
				newTranslation.z = this.dragStartTranslation.z - deltaY * sensitivity;
			}

			this.currentTranslation = newTranslation;

			// Notify callback
			if (this.onTranslationChange) {
				this.onTranslationChange(newTranslation);
			}
		} else {
			// Rotation
			const newRotation = { ...this.dragStartRotation };

			if (this.activeHandle === "bearing") {
				newRotation.bearing = this.dragStartRotation.bearing + deltaX * rotationSensitivity;
			} else if (this.activeHandle === "pitch") {
				newRotation.pitch = this.dragStartRotation.pitch + deltaY * rotationSensitivity;
			} else if (this.activeHandle === "roll") {
				newRotation.roll = this.dragStartRotation.roll + deltaX * rotationSensitivity;
			}

			this.currentRotation = newRotation;

			// Notify callback
			if (this.onRotationChange) {
				this.onRotationChange(newRotation);
			}
		}
	}

	/**
	 * Handle mouse up - end drag
	 */
	handleMouseUp(event) {
		if (this.isDragging) {
			console.log("Gizmo drag ended:", this.activeHandle);
		}
		this.isDragging = false;
		this.activeHandle = null;
	}

	/**
	 * Dispose of gizmo resources
	 */
	dispose() {
		// Remove event listeners
		document.removeEventListener("mousemove", this.handleMouseMove);
		document.removeEventListener("mouseup", this.handleMouseUp);

		// Remove from scene
		if (this.threeRenderer && this.threeRenderer.scene) {
			this.threeRenderer.scene.remove(this.gizmoGroup);
		}

		// Dispose geometry and materials
		this.gizmoGroup.traverse((obj) => {
			if (obj.geometry) {
				obj.geometry.dispose();
			}
			if (obj.material) {
				if (Array.isArray(obj.material)) {
					obj.material.forEach(m => m.dispose());
				} else {
					obj.material.dispose();
				}
			}
		});

		console.log("TransformGizmo disposed");
	}
}

// Export for global access
window.TransformGizmo = TransformGizmo;

export default TransformGizmo;
