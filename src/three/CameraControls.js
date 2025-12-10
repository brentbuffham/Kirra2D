/* prettier-ignore-file */
//=================================================
// CameraControls.js - Unified Orthographic Camera Controller
//=================================================
//
//
// Gimbal-lock-free orbit controls with angle normalization
//
// Coordinate System: Standard Right-Handed (Camera starts tilted down)
// - X+ = Easting (Points to the Right in Plan View)
// - Y+ = Northing (Points Up in plan view)
// - Z+ = Elevation (Points at the camera - Closer to Camera in Plan View)
// - Camera starts above scene, tilted down toward ground (not horizontal)
//
// Orbit Behavior:
// - axisLock = "none": Infinite SMOOTH ORBITING with angle normalization
//   * No clamping - camera can rotate through all angles
//   * Angles automatically normalize when passing through poles
//   * No flipping or gimbal lock
//
// - axisLock = "pitch": Constrain orbiting to X-axis rotation only
//   * Allows tilting camera up/down (pitch motion)
//   * Prevents horizontal rotation (roll) and camera spin (yaw)
//   * Maintains compass bearing, allows elevation changes
//   * Continuous rotation around X-axis NO FLIPPING very important
//
// - axisLock = "roll": Constrain orbiting to Y-axis rotation only
//   * Allows horizontal rotation / compass bearing changes (roll motion)
//   * Prevents tilting (pitch) and camera spin (yaw)
//   * Maintains elevation angle, allows rotation around Y-axis
//
// - axisLock = "yaw": Constrain orbiting to Z-axis rotation only
//   * Allows camera spin around focal point (yaw motion)
//   * Prevents tilting (pitch) and horizontal rotation (roll)
//   * Maintains upright orientation relative to scene
//
// Camera Roll Mode:
// - Shift + Alt + Left-click drag = Camera Roll mode
// * Rotates the camera around its focal line (Z-axis spin/2D rotation)
// * Works in PlanView 3D Mode or at any angle
// * No clamping - camera can rotate through all angles
// * No flipping or gimbal lock
// * Console message: "🔄 Camera Roll mode activated (Shift+Alt held)"
//
// Angles:
// - Pitch (orbitX): X-axis rotation (elevation angle from horizon) (Alt held + settings lock)
// - Roll(orbitY): Y-axis rotation (compass bearing) (Alt Held +settings Lock)
// - Yaw (orbitZ): Z-axis rotation (camera spin) (Alt Held + Settings Lock)
// - Camera Roll (rotation): camera spin around focal line (Alt+Shift Held
//
//=================================================

import * as THREE from "three";

export class CameraControls {
    constructor(threeRenderer, canvas2D) {
        // Step 1) Store references
        this.threeRenderer = threeRenderer;
        this.canvas2D = canvas2D;
        this.container = canvas2D.parentElement;

        // Step 1a) Gizmo display mode
        this.gizmoDisplayMode = "only_when_orbit_or_rotate"; // "always", "only_when_orbit_or_rotate", "never"

        // Step 1b) Axis lock mode (for constraining orbit)
        this.axisLock = "none"; // "none", "pitch", "roll", "yaw"

        // Step 2) Camera state
        this.centroidX = 0;
        this.centroidY = 0;
        this.scale = 1;
        this.rotation = 0; // Camera Roll (camera spin around focal line)
        this.orbitX = 0; // Pitch (X-axis rotation, elevation angle) - infinite, no gimbal lock
        this.orbitY = 0; // Roll (Y-axis rotation, compass bearing) - infinite, no gimbal lock

        // Step 3) Mouse interaction state
        this.isDragging = false;
        this.isRotating = false; // Shift+Alt+drag = Camera Roll mode
        this.isOrbiting = false; // Alt+drag = orbit mode
        this.pendingPan = false; // Flag for pending pan activation
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // Step 3a) Yaw-lock orbit tracking (for relative rotation calculation)
        this.yawLockStartAngle = 0; // Initial mouse angle from orbit center when yaw-lock orbit starts
        this.yawLockStartOrbitY = 0; // Initial orbitY value when yaw-lock orbit starts

        // Step 4) Momentum/damping system for smooth controls
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityOrbitX = 0;
        this.velocityOrbitY = 0;
        this.velocityRotation = 0;
        this.damping = 0.85; // Damping factor (0-1, higher = less damping)
        this.minVelocity = 0.0001; // Stop animation below this velocity
        this.animationFrameId = null;

        // Step 5) Context menu handler for cleanup
        this.contextMenuHandler = null;

        // Step 6) Bind event handlers
        this.handleWheel = this.handleWheel.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.animate = this.animate.bind(this);

        // Step 7) Touch state
        this.lastTouchDistance = 0;
        this.touchStartCentroidX = 0;
        this.touchStartCentroidY = 0;
        this.touchStartScale = 1;
    }

    // Step 8) Initialize event listeners for unified orthographic controls
    attachEvents() {
        // Step 8a) Reset all state flags to ensure clean state
        this.resetStateFlags();

        // Step 8b) Attach to container that holds both canvases
        const container = this.container;

        container.addEventListener("wheel", this.handleWheel, { passive: false });
        container.addEventListener("mousedown", this.handleMouseDown);

        // Step 8c) Prevent context menu ONLY during active drag/rotation
        // Allow single right-click to show context menu
        this.contextMenuHandler = (e) => {
            // Only prevent if we're actively dragging/rotating/orbiting
            if (this.isDragging || this.isRotating || this.isOrbiting) {
                e.preventDefault();
                return false;
            }
        };
        container.addEventListener("contextmenu", this.contextMenuHandler);

        // Step 8d) Attach mousemove and mouseup to document for better drag handling
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
        container.addEventListener("mouseleave", this.handleMouseUp);

        container.addEventListener("touchstart", this.handleTouchStart, { passive: false });
        container.addEventListener("touchmove", this.handleTouchMove, { passive: false });
        container.addEventListener("touchend", this.handleTouchEnd);

        console.log("🎮 Unified orthographic camera controls attached");
    }

    // Step 10) Reset pan state (call when switching between 2D/3D contexts)
    resetPanState() {
        // Reset all pan-related flags to prevent stuck states
        const wasDragging = this.isDragging;
        const hadPendingPan = this.pendingPan;

        if (wasDragging || hadPendingPan) {
            console.log("🔄 Pan state reset (prevented stuck drag) - wasDragging:", wasDragging, "pendingPan:", hadPendingPan);
        }

        this.isDragging = false;
        this.pendingPan = false;
        this.velocityX = 0;
        this.velocityY = 0;

        // Stop any momentum animation
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Step 9) Remove event listeners
    detachEvents() {
        // Step 9a) Reset all state flags to prevent stuck states
        this.resetStateFlags();

        // Step 9b) Hide gizmo when detaching events
        this.threeRenderer.showAxisHelper(false);

        // Step 9c) Remove event listeners
        const container = this.container;

        container.removeEventListener("wheel", this.handleWheel);
        container.removeEventListener("mousedown", this.handleMouseDown);

        // Step 9d) Remove contextmenu handler if it exists
        if (this.contextMenuHandler) {
            container.removeEventListener("contextmenu", this.contextMenuHandler);
            this.contextMenuHandler = null;
        }

        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
        container.removeEventListener("mouseleave", this.handleMouseUp);

        container.removeEventListener("touchstart", this.handleTouchStart);
        container.removeEventListener("touchmove", this.handleTouchMove);
        container.removeEventListener("touchend", this.handleTouchEnd);

        // Stop animation loop if running
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        console.log("🎮 Unified orthographic camera controls detached");
    }

    // Step 10) Set gizmo display mode
    setGizmoDisplayMode(mode) {
        // Step 10a) Validate mode
        const validModes = ["always", "only_when_orbit_or_rotate", "never"];
        if (!validModes.includes(mode)) {
            console.warn("Invalid gizmo display mode:", mode, "- using 'only_when_orbit_or_rotate'");
            mode = "only_when_orbit_or_rotate";
        }

        this.gizmoDisplayMode = mode;
        console.log("🎯 Gizmo display mode set to:", mode);
    }

    // Step 11) Set axis lock mode
    setAxisLock(mode) {
        // Step 11a) Validate mode
        const validModes = ["none", "pitch", "roll", "yaw"];
        if (!validModes.includes(mode)) {
            console.warn("Invalid axis lock mode:", mode, "- using 'none'");
            mode = "none";
        }

        this.axisLock = mode;
        console.log("🔒 Axis lock mode set to:", mode);

        // Step 11b) Immediately update camera to apply new axis lock (prevents delayed response)
        this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);
    }

    // Step 12) Set camera state and update renderer
    setCameraState(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0) {
        // Step 12a) Update internal state
        this.centroidX = centroidX;
        this.centroidY = centroidY;
        this.scale = scale;
        this.rotation = rotation;
        this.orbitX = orbitX;
        this.orbitY = orbitY;

        // Step 12b) Update Three.js renderer
        this.threeRenderer.updateCamera(centroidX, centroidY, scale, rotation, orbitX, orbitY);
    }

    // Step 13) Get current camera state
    getCameraState() {
        return {
            centroidX: this.centroidX,
            centroidY: this.centroidY,
            scale: this.scale,
            rotation: this.rotation,
            orbitX: this.orbitX,
            orbitY: this.orbitY
        };
    }

    // Step 14) Handle mouse wheel for zoom with cursor zoom support
    handleWheel(event) {
        event.preventDefault();

        const canvas = this.threeRenderer.getCanvas();
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Step 15) Calculate zoom factor
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const oldScale = this.scale;
        const newScale = Math.max(0.01, Math.min(1000, oldScale * zoomFactor));

        // Step 16) Cursor zoom - adjust centroid to keep cursor position fixed in world space
        // Works in both 2D and 3D modes
        if (this.orbitX === 0 && this.orbitY === 0) {
            // 2D mode - perfect cursor zoom
            const worldX = (mouseX - canvas.width / 2) / oldScale + this.centroidX;
            const worldY = -((mouseY - canvas.height / 2) / oldScale) + this.centroidY;

            this.centroidX = worldX - (mouseX - canvas.width / 2) / newScale;
            this.centroidY = worldY + (mouseY - canvas.height / 2) / newScale;
            this.scale = newScale;
        } else {
            // 3D orbit mode - raycast to mouse position and adjust centroid for cursor zoom
            const groundZ = this.threeRenderer.orbitCenterZ || 0;
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -groundZ); // Z-up plane

            // Step 16a) Raycast mouse position to ground plane at old scale
            const ndcX = ((mouseX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((mouseY - rect.top) / rect.height) * 2 + 1;
            const raycasterOld = new THREE.Raycaster();
            raycasterOld.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.threeRenderer.camera);
            const targetOld = new THREE.Vector3();
            const hitOld = raycasterOld.ray.intersectPlane(plane, targetOld);

            if (hitOld) {
                // Step 16b) Get world point under mouse at old scale
                const worldPointOld = targetOld.clone();

                // Step 16c) Update scale and camera to new scale (skip render during zoom)
                this.scale = newScale;
                this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY, 0, true);

                // Step 16d) Raycast again at new scale
                const raycasterNew = new THREE.Raycaster();
                raycasterNew.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.threeRenderer.camera);
                const targetNew = new THREE.Vector3();
                const hitNew = raycasterNew.ray.intersectPlane(plane, targetNew);

                if (hitNew) {
                    // Step 16e) Adjust centroid so the world point stays under the mouse
                    const worldPointNew = targetNew.clone();
                    const deltaX = worldPointOld.x - worldPointNew.x;
                    const deltaY = worldPointOld.y - worldPointNew.y;

                    this.centroidX += deltaX;
                    this.centroidY += deltaY;

                    // Step 16f) Update camera again with adjusted centroid (skip render during zoom)
                    this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY, 0, true);
                } else {
                    // If raycast fails at new scale, just update scale (skip render during zoom)
                    this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY, 0, true);
                }
            } else {
                // If raycast fails, just update scale (skip render during zoom)
                this.scale = newScale;
                this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY, 0, true);
            }

            // Early return since camera was already updated in 3D mode
            // Step 17) Update gizmo display during zoom
            if (this.gizmoDisplayMode !== "always") {
                this.threeRenderer.showAxisHelper(false);
            }

            // Step 19) Re-show gizmo if always mode
            if (this.gizmoDisplayMode === "always") {
                this.updateGizmoDisplayForControls();
            }

            return {
                centroidX: this.centroidX,
                centroidY: this.centroidY,
                scale: this.scale,
                rotation: this.rotation,
                orbitX: this.orbitX,
                orbitY: this.orbitY
            };
        }

        // Step 17) Update gizmo display during zoom
        if (this.gizmoDisplayMode !== "always") {
            this.threeRenderer.showAxisHelper(false);
        }

        // Step 18) Update camera with preserved orbit state (skip render during zoom)
        this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY, 0, true);

        // Step 19) Re-show gizmo if always mode
        if (this.gizmoDisplayMode === "always") {
            this.updateGizmoDisplayForControls();
        }

        return {
            centroidX: this.centroidX,
            centroidY: this.centroidY,
            scale: this.scale,
            rotation: this.rotation,
            orbitX: this.orbitX,
            orbitY: this.orbitY
        };
    }

    // Step 20) Handle mouse down
    handleMouseDown(event) {
        // Step 20a) Right-click - allow context menu only, no camera interaction
        if (event.button === 2) {
            // Let context menu handler process right-click
            return;
        }

        // Step 20b) Process non-right-click events normally
        this.processMouseDown(event);
    }

    // Step 21) Process mouse down (extracted for reuse)
    processMouseDown(event) {
        // Step 21a) Check for Camera Roll mode (Shift + Alt keys) - activate immediately
        if (event.shiftKey && event.altKey) {
            event.preventDefault();
            this.isRotating = true;
            this.isOrbiting = false;
            this.isDragging = false;
            this.pendingPan = false;
            console.log("🔄 Camera Roll mode activated (Shift+Alt held)");
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
            return;
        }

        // Step 21b) Check for orbit mode (Alt key only) - activate immediately
        if (event.altKey) {
            event.preventDefault();
            this.isOrbiting = true;
            this.isRotating = false;
            this.isDragging = false;
            this.pendingPan = false;
            console.log("🌐 Tumble/Orbit mode activated (Alt held)");
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;

            // Step 21b.1) Initialize yaw-lock tracking if yaw-axis is locked
            if (this.axisLock === "yaw") {
                // Calculate initial angle from orbit center to mouse
                const canvas = this.threeRenderer.getCanvas();
                const rect = canvas.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;

                // Project orbit center to screen space
                const camera = this.threeRenderer.camera;
                const orbitCenterWorld = new THREE.Vector3(this.centroidX, this.centroidY, this.threeRenderer.orbitCenterZ || 0);
                const orbitCenterScreen = orbitCenterWorld.clone().project(camera);
                const centerScreenX = (orbitCenterScreen.x * 0.5 + 0.5) * rect.width;
                const centerScreenY = (-orbitCenterScreen.y * 0.5 + 0.5) * rect.height;

                // Store initial angle and current orbitY
                this.yawLockStartAngle = Math.atan2(mouseY - centerScreenY, mouseX - centerScreenX);
                this.yawLockStartOrbitY = this.orbitY;
                console.log("🔒 Yaw-lock orbit started - Initial angle:", ((this.yawLockStartAngle * 180) / Math.PI).toFixed(1), "° Initial orbitY:", ((this.yawLockStartOrbitY * 180) / Math.PI).toFixed(1), "°");
            }

            return;
        }

        // Step 21c) Check if we're in 3D mode and if an object was clicked (selection takes priority)
        // Only check if onlyShowThreeJS is true and no modifier keys
        if (window.onlyShowThreeJS && !event.altKey && !event.metaKey && !event.ctrlKey && event.button !== 2) {
            // If event.defaultPrevented, selection handler stopped us - don't start any camera movement
            if (event.defaultPrevented) {
                console.log("🎯 Camera controls: Selection handler prevented camera movement");
                return; // Don't start camera drag/orbit/rotate
            }
        }

        // Step 21d) Stop any ongoing momentum animation
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Step 21e) Reset velocities
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityOrbitX = 0;
        this.velocityOrbitY = 0;
        this.velocityRotation = 0;

        // Step 21f) Default pan mode - but DON'T activate until mouse moves (drag detected)
        // In 3D mode, single click should select, not pan. Pan only happens on drag.
        this.isDragging = false; // Start as false, will be set to true on first mousemove
        this.isRotating = false;
        this.isOrbiting = false;
        this.pendingPan = true; // Flag to indicate pan is pending (will activate on drag)

        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
    }

    // Step 22) Handle mouse move
    handleMouseMove(event) {
        // Step 22a) Check if Alt is released - stop orbit/roll if it was active
        if (!event.altKey) {
            // If Alt is released and we were orbiting, release orbit mode
            if (this.isOrbiting && !this.isDragging && !this.isRotating) {
                this.isOrbiting = false;
                if (this.pendingPan) {
                    // Pan can resume
                }
            }
        }

        // Step 22b) Check if Shift+Alt is released - stop roll if it was active
        if (!(event.shiftKey && event.altKey)) {
            // If Shift+Alt is released and we were rotating, release rotation mode
            if (this.isRotating && !this.isDragging && !this.isOrbiting) {
                this.isRotating = false;
                if (this.pendingPan) {
                    // Pan can resume
                }
            }
        }

        // Step 22c) Check if pan is pending and activate on drag threshold
        if (this.pendingPan && !this.isDragging && !this.isRotating && !this.isOrbiting) {
            const dragThreshold = 3; // pixels
            const deltaX = Math.abs(event.clientX - this.dragStartX);
            const deltaY = Math.abs(event.clientY - this.dragStartY);

            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                this.isDragging = true;
                this.pendingPan = false;
                console.log("👆 2D Pan mode activated (drag detected)");
            }
        }

        if (this.isDragging) {
            // Step 23) Pan mode - account for current rotation and 3D orbit
            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;

            // Step 23a) If camera is orbited in 3D, use Raycast Pan on Ground Plane
            if (this.orbitX !== 0 || this.orbitY !== 0) {
                // Calculate intersection of ray from previous mouse position to ground (Z=orbitCenterZ)
                const groundZ = this.threeRenderer.orbitCenterZ || 0;
                const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -groundZ); // Z-up plane

                const getRayIntersection = (clientX, clientY) => {
                    const canvas = this.threeRenderer.getCanvas();
                    const rect = canvas.getBoundingClientRect();
                    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.threeRenderer.camera);
                    const target = new THREE.Vector3();
                    const hit = raycaster.ray.intersectPlane(plane, target);
                    return hit ? target : null;
                };

                const startPoint = getRayIntersection(this.lastMouseX, this.lastMouseY);
                const endPoint = getRayIntersection(event.clientX, event.clientY);

                if (startPoint && endPoint) {
                    // Move camera by the difference
                    const moveX = startPoint.x - endPoint.x;
                    const moveY = startPoint.y - endPoint.y;

                    this.centroidX += moveX;
                    this.centroidY += moveY;

                    // Store velocity
                    this.velocityX = moveX;
                    this.velocityY = moveY;
                } else {
                    // Fallback to screen-space pan if raycast fails (e.g. looking at horizon)
                    const panDeltaX = deltaX / this.scale;
                    const panDeltaY = -deltaY / this.scale; // Screen Y is inverted

                    const cosRoll = Math.cos(this.orbitY); // orbitY is Roll (compass bearing)
                    const sinRoll = Math.sin(this.orbitY);

                    // Transform screen movement to world XY (Z-up)
                    // Screen X moves Right (East-ish depending on Roll)
                    // Screen Y moves Up (North-ish depending on Roll, ignoring Z)
                    this.centroidX += panDeltaX * cosRoll - panDeltaY * sinRoll;
                    this.centroidY += panDeltaX * sinRoll + panDeltaY * cosRoll;

                    this.velocityX = panDeltaX * cosRoll - panDeltaY * sinRoll;
                    this.velocityY = panDeltaX * sinRoll + panDeltaY * cosRoll;
                }
            } else {
                // Step 23b) 2D mode - rotate delta values to account for current Z-axis rotation
                const cos = Math.cos(-this.rotation);
                const sin = Math.sin(-this.rotation);

                const rotatedDeltaX = deltaX * cos - deltaY * sin;
                const rotatedDeltaY = deltaX * sin + deltaY * cos;

                this.centroidX -= rotatedDeltaX / this.scale;
                this.centroidY += rotatedDeltaY / this.scale;

                // Store velocity for momentum
                this.velocityX = -rotatedDeltaX / this.scale;
                this.velocityY = rotatedDeltaY / this.scale;
            }

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;

            // Update gizmo display during pan
            if (this.gizmoDisplayMode !== "always") {
                this.threeRenderer.showAxisHelper(false);
            }
            this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);

            if (this.gizmoDisplayMode === "always") {
                this.updateGizmoDisplayForControls();
            }

            return { centroidX: this.centroidX, centroidY: this.centroidY, mode: "pan" };
        } else if (this.isRotating) {
            // Step 24) Camera Roll mode (Z-axis rotation/camera spin around focal line) - INFINITE
            this.updateGizmoDisplayForControls();

            const canvas = this.threeRenderer.getCanvas();
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate angle from center (no gimbal lock for roll)
            const startAngle = Math.atan2(this.lastMouseY - centerY, this.lastMouseX - centerX);
            const currentAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
            const deltaAngle = currentAngle - startAngle;

            this.rotation += deltaAngle;
            this.velocityRotation = deltaAngle; // Store for momentum

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;

            this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);

            return { rotation: this.rotation, mode: "roll" };
        } else if (this.isOrbiting) {
            // Step 25) 3D Orbit mode (X and Y axis rotation) - INFINITE, NO GIMBAL LOCK
            this.updateGizmoDisplayForControls();

            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;

            const sensitivity = 0.005;

            // Step 25a) For yaw-axis lock, calculate angle from orbit center to mouse
            if (this.axisLock === "yaw") {
                // Step 25a.1) Get canvas and mouse position
                const canvas = this.threeRenderer.getCanvas();
                const rect = canvas.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;

                // Step 25a.2) Get orbit center in screen space
                const camera = this.threeRenderer.camera;
                const orbitCenterWorld = new THREE.Vector3(this.centroidX, this.centroidY, this.threeRenderer.orbitCenterZ || 0);

                // Step 25a.3) Project orbit center to screen space
                const orbitCenterScreen = orbitCenterWorld.clone().project(camera);
                const centerScreenX = (orbitCenterScreen.x * 0.5 + 0.5) * rect.width;
                const centerScreenY = (-orbitCenterScreen.y * 0.5 + 0.5) * rect.height;

                // Step 25a.4) Calculate current angle from orbit center to mouse
                const currentAngle = Math.atan2(mouseY - centerScreenY, mouseX - centerScreenX);

                // Step 25a.5) Calculate angular offset from initial angle
                // This gives us how much the mouse has rotated relative to where orbit started
                let angleOffset = currentAngle - this.yawLockStartAngle;

                // Step 25a.6) Normalize angle offset to [-PI, PI]
                if (angleOffset > Math.PI) angleOffset -= 2 * Math.PI;
                if (angleOffset < -Math.PI) angleOffset += 2 * Math.PI;

                // Step 25a.7) Apply offset to initial orbitY (relative rotation from start)
                // Invert to match expected rotation direction (CCW = positive angle in math, but CW in screen)
                this.orbitY = this.yawLockStartOrbitY - angleOffset;

                // Step 25a.8) No pitch change (locked to yaw-axis rotation)
                // Keep current pitch, but ensure it is in safe range to avoid singularity
                const minPitch = 0.1; // ~5.7 degrees from top
                const maxPitch = Math.PI - 0.1; // ~5.7 degrees from bottom
                this.orbitX = Math.max(minPitch, Math.min(maxPitch, this.orbitX));

                // Step 25a.9) Store velocity for momentum (calculate from last frame for smoothness)
                const lastMouseXCanvas = this.lastMouseX - rect.left;
                const lastMouseYCanvas = this.lastMouseY - rect.top;
                const lastAngle = Math.atan2(lastMouseYCanvas - centerScreenY, lastMouseXCanvas - centerScreenX);
                let deltaAngle = currentAngle - lastAngle;
                if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
                this.velocityOrbitX = 0;
                this.velocityOrbitY = -deltaAngle;
            } else {
                // Step 25b) Normal orbit mode (pitch, roll, or no lock)
                // Apply axis lock constraints
                let deltaOrbitX = deltaY * sensitivity;
                let deltaOrbitY = deltaX * sensitivity;

                switch (this.axisLock) {
                    case "pitch": // Lock to Pitch (X-axis rotation only)
                        deltaOrbitY = 0; // No roll (Y-axis rotation)
                        break;
                    case "roll": // Lock to Roll (Y-axis rotation only)
                        deltaOrbitX = 0; // No pitch (X-axis rotation)
                        break;
                    case "none": // No constraints - infinite orbit in all directions
                    default:
                        // Allow full rotation - no gimbal lock
                        break;
                }

                // Apply orbit changes (infinite, no clamping)
                this.orbitX += deltaOrbitX;
                this.orbitY += deltaOrbitY;

                // Store velocity for momentum
                this.velocityOrbitX = deltaOrbitX;
                this.velocityOrbitY = deltaOrbitY;
            }

            // Debug logging for orbit values
            const cameraPos = this.threeRenderer.camera.position;
            // In Z-up: orbitX is Pitch (angle from Zenith, 0 = top-down). orbitY is Roll (compass bearing).
            const pitchDeg = ((this.orbitX * 180) / Math.PI).toFixed(1);
            const rollDeg = ((this.orbitY * 180) / Math.PI).toFixed(1);
            console.log("📍 Camera XYZ: (" + cameraPos.x.toFixed(2) + ", " + cameraPos.y.toFixed(2) + ", " + cameraPos.z.toFixed(2) + ") | Pitch: " + pitchDeg + "° | Roll: " + rollDeg + "°");

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;

            this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);

            return { orbitX: this.orbitX, orbitY: this.orbitY, mode: "orbit" };
        }

        return null;
    }

    // Step 22) Handle mouse up
    handleMouseUp(event) {
        // Step 22a) Log 2D pan release if it was active
        if (this.isDragging) {
            console.log("👆 2D Pan mode released");
        }

        // Step 22b) Reset pending pan flag if mouse up without drag
        if (this.pendingPan && !this.isDragging) {
            this.pendingPan = false;
            // This was a click, not a drag - selection handler should have handled it
        }

        // Step 22c) Update axis helper based on gizmo display mode
        this.updateGizmoDisplayForControls();

        // Step 22d) Start momentum animation if there's significant velocity
        const hasVelocity = Math.abs(this.velocityX) > this.minVelocity || Math.abs(this.velocityY) > this.minVelocity || Math.abs(this.velocityOrbitX) > this.minVelocity || Math.abs(this.velocityOrbitY) > this.minVelocity || Math.abs(this.velocityRotation) > this.minVelocity;

        if (hasVelocity && this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(this.animate);
        }

        this.isDragging = false;
        this.isRotating = false;
        this.isOrbiting = false;
        this.pendingPan = false;
    }

    // Step 22d) Reset all state flags
    resetStateFlags() {
        this.isDragging = false;
        this.isRotating = false;
        this.isOrbiting = false;
        this.pendingPan = false;
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityOrbitX = 0;
        this.velocityOrbitY = 0;
        this.velocityRotation = 0;

        // Step 22d1) Stop animation loop if running
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Step 22e) Helper to update gizmo display
    updateGizmoDisplayForControls() {
        // Step 22e1) Always respect "never" mode first
        if (this.gizmoDisplayMode === "never") {
            this.threeRenderer.showAxisHelper(false);
            return;
        }

        if (this.gizmoDisplayMode === "always") {
            // Keep gizmo visible if mode is "always"
            const currentState = this.getCameraState();
            this.threeRenderer.showAxisHelper(true, currentState.centroidX, currentState.centroidY, currentState.scale);
        } else if (this.gizmoDisplayMode === "only_when_orbit_or_rotate") {
            // Show only when actively orbiting or rotating
            if (this.isOrbiting || this.isRotating) {
                const currentState = this.getCameraState();
                this.threeRenderer.showAxisHelper(true, currentState.centroidX, currentState.centroidY, currentState.scale);
            } else {
                this.threeRenderer.showAxisHelper(false);
            }
        } else {
            // Default to never show if mode is unknown
            this.threeRenderer.showAxisHelper(false);
        }
    }

    // Step 23) Handle touch start
    handleTouchStart(event) {
        event.preventDefault();

        if (event.touches.length === 1) {
            // Step 24) Single touch - pan
            this.isDragging = true;
            this.lastMouseX = event.touches[0].clientX;
            this.lastMouseY = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
            // Step 25) Two fingers - pinch zoom
            this.isDragging = false;
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            this.lastTouchDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
            this.touchStartCentroidX = this.centroidX;
            this.touchStartCentroidY = this.centroidY;
            this.touchStartScale = this.scale;
        }
    }

    // Step 26) Handle touch move
    handleTouchMove(event) {
        event.preventDefault();

        if (event.touches.length === 1 && this.isDragging) {
            // Step 27) Single touch pan - account for rotation
            const deltaX = event.touches[0].clientX - this.lastMouseX;
            const deltaY = event.touches[0].clientY - this.lastMouseY;

            // Rotate the delta values to account for current Z-axis rotation
            const cos = Math.cos(-this.rotation);
            const sin = Math.sin(-this.rotation);

            const rotatedDeltaX = deltaX * cos - deltaY * sin;
            const rotatedDeltaY = deltaX * sin + deltaY * cos;

            this.centroidX -= rotatedDeltaX / this.scale;
            this.centroidY += rotatedDeltaY / this.scale;

            this.lastMouseX = event.touches[0].clientX;
            this.lastMouseY = event.touches[0].clientY;

            // Step 27b) Hide axis helper during touch pan (transient behavior)
            this.threeRenderer.showAxisHelper(false);
            this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);

            return { centroidX: this.centroidX, centroidY: this.centroidY, mode: "pan" };
        } else if (event.touches.length === 2) {
            // Step 28) Pinch zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

            if (this.lastTouchDistance > 0) {
                const scaleFactor = currentDistance / this.lastTouchDistance;
                this.scale = Math.max(0.01, Math.min(1000, this.touchStartScale * scaleFactor));

                // Step 28b) Hide axis helper during pinch zoom (transient behavior)
                this.threeRenderer.showAxisHelper(false);
                this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);
            }

            this.lastTouchDistance = currentDistance;

            return { scale: this.scale, mode: "zoom" };
        }

        return null;
    }

    // Step 29) Handle touch end
    handleTouchEnd(event) {
        event.preventDefault();

        // Step 29a) Hide axis helper when touch ends (if it was visible)
        if (this.isRotating || this.isOrbiting) {
            this.threeRenderer.showAxisHelper(false);
            console.log("🎯 Axis helper hidden - touch ended");
        }

        this.isDragging = false;
        this.isRotating = false;
        this.isOrbiting = false;
        this.lastTouchDistance = 0;
    }

    // Step 30) Reset camera to default view
    resetCamera() {
        // Step 30a) If using arcball mode, delegate to arcball controls
        if (this.controlMode === "arcball" && this.arcballControls) {
            this.arcballControls.resetCamera();
            return;
        }

        // Step 30b) Custom controls
        this.centroidX = 0;
        this.centroidY = 0;
        this.scale = 1;
        this.rotation = 0;
        this.orbitX = 0;
        this.orbitY = 0;
        this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);
    }

    // Step 31) Fit content to view
    fitToView(minX, minY, maxX, maxY, padding = 1.1) {
        // Step 31a) If using arcball mode, delegate to arcball controls
        if (this.controlMode === "arcball" && this.arcballControls) {
            this.arcballControls.fitToView(minX, minY, maxX, maxY, padding);
            return;
        }

        // Step 31b) Custom controls
        const canvas = this.threeRenderer.getCanvas();
        const width = maxX - minX;
        const height = maxY - minY;

        // Step 32) Calculate center
        this.centroidX = (minX + maxX) / 2;
        this.centroidY = (minY + maxY) / 2;

        // Step 33) Calculate scale to fit
        const scaleX = canvas.width / (width * padding);
        const scaleY = canvas.height / (height * padding);
        this.scale = Math.min(scaleX, scaleY);

        this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);
    }

    // Step 34) Update settings from external configuration
    updateSettings(settings) {
        // Update gizmo display mode
        if (settings.gizmoDisplay) {
            this.setGizmoDisplayMode(settings.gizmoDisplay);
        }

        // Update axis lock mode
        if (settings.axisLock) {
            this.setAxisLock(settings.axisLock);
        }

        // Update damping factor
        if (settings.dampingFactor !== undefined) {
            this.damping = Math.max(0, Math.min(1, settings.dampingFactor));
        }

        console.log("⚙️ Camera controls settings updated");
    }

    // Step 35) Update method (call in render loop if needed)
    update() {
        // Unified system doesn't need continuous updates like arcball controls
        // This method is kept for API compatibility
    }

    // Step 32) Animation loop for smooth momentum/damping
    animate() {
        // Step 32a) Apply damping to velocities
        this.velocityX *= this.damping;
        this.velocityY *= this.damping;
        this.velocityOrbitX *= this.damping;
        this.velocityOrbitY *= this.damping;
        this.velocityRotation *= this.damping;

        // Step 32b) Check if velocities are below threshold
        const hasVelocity = Math.abs(this.velocityX) > this.minVelocity || Math.abs(this.velocityY) > this.minVelocity || Math.abs(this.velocityOrbitX) > this.minVelocity || Math.abs(this.velocityOrbitY) > this.minVelocity || Math.abs(this.velocityRotation) > this.minVelocity;

        if (!hasVelocity) {
            // Stop animation
            this.animationFrameId = null;
            this.velocityX = 0;
            this.velocityY = 0;
            this.velocityOrbitX = 0;
            this.velocityOrbitY = 0;
            this.velocityRotation = 0;
            return;
        }

        // Step 32c) Apply velocities to camera state
        let updated = false;

        if (Math.abs(this.velocityX) > this.minVelocity || Math.abs(this.velocityY) > this.minVelocity) {
            this.centroidX += this.velocityX;
            this.centroidY += this.velocityY;
            updated = true;
        }

        if (Math.abs(this.velocityOrbitX) > this.minVelocity || Math.abs(this.velocityOrbitY) > this.minVelocity) {
            this.orbitX += this.velocityOrbitX;
            this.orbitY += this.velocityOrbitY;
            updated = true;
        }

        if (Math.abs(this.velocityRotation) > this.minVelocity) {
            this.rotation += this.velocityRotation;
            updated = true;
        }

        // Step 32d) Update camera if anything changed
        if (updated) {
            this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);
        }

        // Step 32e) Continue animation loop
        this.animationFrameId = requestAnimationFrame(this.animate);
    }

    // Step 33) Dispose method to cleanup all resources and prevent memory leaks
    dispose() {
        // Step 33a) Cancel animation frame if active
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Step 33b) Detach all event listeners
        this.detachEvents();

        // Step 33c) Clear all references
        this.threeRenderer = null;
        this.canvas2D = null;
        this.container = null;
        this.contextMenuHandler = null;

        // Step 33d) Reset all state
        this.resetStateFlags();
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityOrbitX = 0;
        this.velocityOrbitY = 0;
        this.velocityRotation = 0;

        console.log("🧹 CameraControls disposed - all resources cleaned up");
    }
}
