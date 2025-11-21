/* prettier-ignore-file */
//=================================================
// ArcballCameraControls.js - Arcball camera controls wrapper
//=================================================

import { ArcballControls } from "three/addons/controls/ArcballControls.js";

export class ArcballCameraControls {
    constructor(threeRenderer, canvas2D) {
        // Step 1) Store references
        this.threeRenderer = threeRenderer;
        this.canvas2D = canvas2D;
        
        // Step 2) Get the container that holds both canvases
        this.container = canvas2D.parentElement;
        
        // Step 3) Get Three.js camera and renderer
        this.camera = threeRenderer.camera;
        this.renderer = threeRenderer.renderer;
        this.scene = threeRenderer.scene;
        
        // Step 4) Initialize ArcballControls
        this.arcballControls = new ArcballControls(this.camera, this.renderer.domElement, this.scene);
        
        // Step 5) Configure mouse buttons to match custom controls behavior
        // Alt + Drag = Orbit (3D rotation)
        // Right-click + Drag = 2D Rotation (Z-axis spin)
        // Left-click + Drag = Pan
        // Wheel = Zoom
        this.arcballControls.mouseButtons = {
            LEFT: 0, // Pan
            MIDDLE: null, // Disabled
            RIGHT: 2, // Rotation (2D spin)
        };
        
        // Step 5a) Default settings
        this.arcballControls.dampingFactor = 0.05;
        this.arcballControls.cursorZoom = false; // We'll handle cursor zoom manually for orthographic cameras
        this.arcballControls.enablePan = true;
        this.arcballControls.enableRotate = true;
        this.arcballControls.enableZoom = true;
        
        // Step 5b) Store original wheel handler to override for cursor zoom
        this.originalWheelHandler = null;
        
        // Step 6) Camera state tracking
        this.centroidX = 0;
        this.centroidY = 0;
        this.scale = 1;
        this.rotation = 0;
        this.orbitX = 0;
        this.orbitY = 0;
        
        // Step 7) Settings
        this.settings = {
            dampingFactor: 0.05,
            cursorZoom: true,
            enablePan: true,
            enableRotate: true,
            enableZoom: true
        };
        
        // Step 8) Bind event handlers
        this.handleChange = this.handleChange.bind(this);
        
        // Step 9) Listen for changes
        this.arcballControls.addEventListener("change", this.handleChange);
    }
    
    // Step 10) Handle change event
    handleChange() {
        // Step 10a) Request render when controls change
        this.threeRenderer.requestRender();
    }
    
    // Step 11) Attach events (ArcballControls handles this internally)
    attachEvents() {
        // Step 11a) Disable ArcballControls built-in handlers - we'll handle events manually
        this.arcballControls.enabled = false;
        
        // Step 11b) Set up custom event handlers to match custom controls behavior
        const domElement = this.renderer.domElement;
        const container = this.container;
        
        // Step 11c) Override wheel handler for proper cursor zoom with orthographic camera
        this.customWheelHandler = this.handleWheel.bind(this);
        container.addEventListener("wheel", this.customWheelHandler, { passive: false });
        
        // Step 11d) Set up mouse handlers to match custom controls
        this.customMouseDownHandler = this.handleMouseDown.bind(this);
        this.customMouseMoveHandler = this.handleMouseMove.bind(this);
        this.customMouseUpHandler = this.handleMouseUp.bind(this);
        
        container.addEventListener("mousedown", this.customMouseDownHandler);
        document.addEventListener("mousemove", this.customMouseMoveHandler);
        document.addEventListener("mouseup", this.customMouseUpHandler);
        container.addEventListener("mouseleave", this.customMouseUpHandler);
        
        // Step 11e) Mouse state tracking
        this.isDragging = false;
        this.isRotating = false;
        this.isOrbiting = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;
        
        console.log("🎮 Arcball controls attached");
    }
    
    // Step 11f) Handle mouse down
    handleMouseDown(event) {
        // Step 11f1) Check if we're in 3D mode and if an object was clicked (selection takes priority)
        if (window.onlyShowThreeJS && !event.altKey && !event.metaKey && !event.ctrlKey && event.button !== 2) {
            if (event.defaultPrevented) {
                return;
            }
        }
        
        // Step 11f2) Store initial position
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
        
        // Step 11f3) Determine interaction mode based on button and modifiers
        if (event.altKey) {
            // Alt + Drag = Orbit (3D rotation)
            event.preventDefault();
            this.isOrbiting = true;
            this.isRotating = false;
            this.isDragging = false;
            this.pendingPan = false;
            console.log("🌐 Arcball: 3D Orbit mode activated (Alt held)");
        } else if (event.button === 2) {
            // Right-click - set up delayed drag for rotation to allow context menu
            // Don't prevent default immediately - let context menu handler run first
            this.pendingRightClickDrag = true;
            this.pendingRightClickEvent = {
                clientX: event.clientX,
                clientY: event.clientY,
            };
            
            // Set timeout for right-click drag
            if (this.rightClickDragTimeout !== null) {
                clearTimeout(this.rightClickDragTimeout);
            }
            this.rightClickDragTimeout = setTimeout(() => {
                if (this.pendingRightClickDrag && this.pendingRightClickEvent) {
                    this.pendingRightClickDrag = false;
                    this.isRotating = true;
                    this.isOrbiting = false;
                    this.isDragging = false;
                    this.pendingPan = false;
                    this.lastMouseX = this.pendingRightClickEvent.clientX;
                    this.lastMouseY = this.pendingRightClickEvent.clientY;
                    console.log("🔄 Arcball: Right-click drag rotation activated after delay");
                }
                this.rightClickDragTimeout = null;
                this.pendingRightClickEvent = null;
            }, this.rightClickDragDelay || 300);
        } else if (event.metaKey || event.ctrlKey) {
            // Cmd/Ctrl + Drag = 2D Rotation (Z-axis spin)
            event.preventDefault();
            this.isRotating = true;
            this.isOrbiting = false;
            this.isDragging = false;
            this.pendingPan = false;
            console.log("🔄 Arcball: 2D Rotation mode activated (⌘/Ctrl)");
        } else if (event.button === 0) {
            // Left-click = Pan (will activate on drag)
            this.isDragging = false;
            this.isRotating = false;
            this.isOrbiting = false;
            this.pendingPan = true;
        }
    }
    
    // Step 11g) Handle mouse move
    handleMouseMove(event) {
        // Step 11g1) Check if right-click drag rotation was activated after delay
        if (this.isRotating && this.pendingRightClickDrag === false && this.rightClickDragTimeout === null) {
            // Right-click drag rotation is active - prevent default to block context menu during drag
            event.preventDefault();
        }
        
        // Step 11g2) Check if Alt is released - stop orbit if it was active
        // Orbit should only be activated via Alt+mousedown, not during mousemove
        if (!event.altKey) {
            // Step 11g2a) If Alt is released and we were orbiting, release orbit mode
            if (this.isOrbiting && !this.isDragging && !this.isRotating) {
                this.isOrbiting = false;
                // Allow pan to resume if mouse is still down
                if (this.pendingPan) {
                    // Pan can resume
                }
            }
        }
        
        // Step 11g2) Check if pan is pending and activate on drag threshold
        if (this.pendingPan && !this.isDragging && !this.isRotating && !this.isOrbiting) {
            const dragThreshold = 3;
            const deltaX = Math.abs(event.clientX - this.dragStartX);
            const deltaY = Math.abs(event.clientY - this.dragStartY);
            
            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                this.isDragging = true;
                this.pendingPan = false;
            }
        }
        
        if (this.isDragging) {
            // Step 11g2) Pan mode
            const currentState = this.getCameraState();
            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;
            
            // Rotate delta values to account for Z-axis rotation
            const cos = Math.cos(-currentState.rotation);
            const sin = Math.sin(-currentState.rotation);
            
            const rotatedDeltaX = deltaX * cos - deltaY * sin;
            const rotatedDeltaY = deltaX * sin + deltaY * cos;
            
            const newCentroidX = currentState.centroidX - rotatedDeltaX / currentState.scale;
            const newCentroidY = currentState.centroidY + rotatedDeltaY / currentState.scale;
            
            this.setCameraState(newCentroidX, newCentroidY, currentState.scale, currentState.rotation, currentState.orbitX, currentState.orbitY);
            
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
        } else if (this.isRotating) {
            // Step 11g3) 2D Rotation mode (Z-axis spin)
            const currentState = this.getCameraState();
            const canvas = this.threeRenderer.getCanvas();
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const startAngle = Math.atan2(this.lastMouseY - centerY, this.lastMouseX - centerX);
            const currentAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
            const deltaAngle = currentAngle - startAngle;
            
            const newRotation = currentState.rotation + deltaAngle;
            this.setCameraState(currentState.centroidX, currentState.centroidY, currentState.scale, newRotation, currentState.orbitX, currentState.orbitY);
            
            // Step 11g3a) Show axis helper based on gizmo display mode
            this.updateGizmoDisplayForControls();
            
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
        } else if (this.isOrbiting) {
            // Step 11g4) 3D Orbit mode (X and Y axis rotation)
            const currentState = this.getCameraState();
            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;
            
            const sensitivity = 0.005;
            const deltaOrbitY = deltaX * sensitivity;
            const deltaOrbitX = deltaY * sensitivity;
            
            // Step 11g4a) No axis limits - allow unlimited rotation
            const newOrbitX = currentState.orbitX + deltaOrbitX;
            const newOrbitY = currentState.orbitY + deltaOrbitY;
            
            this.setCameraState(currentState.centroidX, currentState.centroidY, currentState.scale, currentState.rotation, newOrbitX, newOrbitY);
            
            // Step 11g4b) Show axis helper based on gizmo display mode
            this.updateGizmoDisplayForControls();
            
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
        }
    }
    
    // Step 11h) Handle mouse up
    handleMouseUp(event) {
        // Step 11h1) Update gizmo display based on mode
        this.updateGizmoDisplayForControls();
        
        this.isDragging = false;
        this.isRotating = false;
        this.isOrbiting = false;
        this.pendingPan = false;
    }
    
    // Step 11i) Helper to update gizmo display
    updateGizmoDisplayForControls() {
        if (this.gizmoDisplayMode === "always") {
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
            // Never show
            this.threeRenderer.showAxisHelper(false);
        }
    }
    
    // Step 11f) Handle wheel event with cursor zoom support
    handleWheel(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Step 11f1) Get cursor position
        const canvas = this.threeRenderer.getCanvas();
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Step 11f2) Get current camera state
        const currentState = this.getCameraState();
        const oldScale = currentState.scale;
        
        // Step 11f3) Calculate zoom factor
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        // Step 11f3a) Remove zoom limits - allow unlimited zoom
        const newScale = oldScale * zoomFactor;
        
        // Step 11f4) If cursor zoom is enabled, adjust centroid to keep cursor position fixed
        const useCursorZoom = this.settings.cursorZoom === true;
        if (useCursorZoom) {
            // Step 11f5) Calculate world position under cursor before zoom
            // For orthographic camera, calculate screen-to-world conversion
            const worldX = (mouseX - canvas.width / 2) / oldScale + currentState.centroidX;
            const worldY = -((mouseY - canvas.height / 2) / oldScale) + currentState.centroidY;
            
            // Step 11f6) Calculate new centroid to keep cursor position fixed after zoom
            const newCentroidX = worldX - (mouseX - canvas.width / 2) / newScale;
            const newCentroidY = worldY + (mouseY - canvas.height / 2) / newScale;
            
            // Step 11f7) Update camera state with new scale and centroid
            this.setCameraState(newCentroidX, newCentroidY, newScale, currentState.rotation, currentState.orbitX, currentState.orbitY);
        } else {
            // Step 11f8) Zoom to orbit center (target)
            this.setCameraState(currentState.centroidX, currentState.centroidY, newScale, currentState.rotation, currentState.orbitX, currentState.orbitY);
        }
    }
    
    // Step 12) Detach events
    detachEvents() {
        // Step 12a) Remove custom event handlers
        const container = this.container;
        
        if (this.customWheelHandler) {
            container.removeEventListener("wheel", this.customWheelHandler);
        }
        if (this.customMouseDownHandler) {
            container.removeEventListener("mousedown", this.customMouseDownHandler);
        }
        if (this.customMouseMoveHandler) {
            document.removeEventListener("mousemove", this.customMouseMoveHandler);
        }
        if (this.customMouseUpHandler) {
            document.removeEventListener("mouseup", this.customMouseUpHandler);
            container.removeEventListener("mouseleave", this.customMouseUpHandler);
        }
        
        // Step 12b) Disable ArcballControls
        this.arcballControls.enabled = false;
        console.log("🎮 Arcball controls detached");
    }
    
    // Step 13) Set camera state (convert from custom format to Arcball)
    setCameraState(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0) {
        // Step 13a) Store state
        this.centroidX = centroidX;
        this.centroidY = centroidY;
        this.scale = scale;
        this.rotation = rotation;
        this.orbitX = orbitX;
        this.orbitY = orbitY;
        
        // Step 13b) Update ArcballControls target (orbit center)
        // ArcballControls uses a target point that the camera orbits around
        this.arcballControls.target.set(centroidX, centroidY, this.threeRenderer.orbitCenterZ);
        
        // Step 13c) Calculate camera distance based on scale
        // For orthographic camera, scale affects the frustum size
        // We need to position camera at appropriate distance
        const cameraDistance = 5000; // Base distance
        const distance = cameraDistance / scale;
        
        // Step 13d) If orbit angles are non-zero, calculate 3D camera position
        if (orbitX !== 0 || orbitY !== 0) {
            // Spherical to Cartesian conversion
            const x = distance * Math.cos(orbitX) * Math.sin(orbitY);
            const y = distance * Math.sin(orbitX);
            const z = distance * Math.cos(orbitX) * Math.cos(orbitY);
            
            // Position camera relative to target
            this.camera.position.set(centroidX + x, centroidY + y, this.threeRenderer.orbitCenterZ + z);
        } else {
            // Standard 2D top-down view
            this.camera.position.set(centroidX, centroidY, this.threeRenderer.orbitCenterZ + distance);
        }
        
        // Step 13e) Update camera to look at target
        this.camera.lookAt(this.arcballControls.target);
        
        // Step 13f) Apply Z-axis rotation (2D spin)
        this.camera.rotateZ(rotation);
        
        // Step 13g) Update orthographic bounds
        const canvas = this.threeRenderer.getCanvas();
        const viewportWidthInWorldUnits = canvas.width / scale;
        const viewportHeightInWorldUnits = canvas.height / scale;
        
        this.camera.left = -viewportWidthInWorldUnits / 2;
        this.camera.right = viewportWidthInWorldUnits / 2;
        this.camera.top = viewportHeightInWorldUnits / 2;
        this.camera.bottom = -viewportHeightInWorldUnits / 2;
        this.camera.updateProjectionMatrix();
        
        // Step 13h) Update ArcballControls internal state
        this.arcballControls.update();
        
        // Step 13i) Request render
        this.threeRenderer.requestRender();
    }
    
    // Step 14) Get current camera state
    getCameraState() {
        // Step 14a) Extract state from camera and ArcballControls
        const target = this.arcballControls.target;
        const position = this.camera.position;
        
        // Step 14b) Calculate centroid from target
        this.centroidX = target.x;
        this.centroidY = target.y;
        
        // Step 14c) Calculate scale from orthographic camera bounds
        const canvas = this.threeRenderer.getCanvas();
        const viewportWidth = this.camera.right - this.camera.left;
        this.scale = canvas.width / viewportWidth;
        
        // Step 14d) Extract rotation from camera
        this.rotation = this.camera.rotation.z;
        
        // Step 14e) Calculate orbit angles from camera position relative to target
        const dx = position.x - target.x;
        const dy = position.y - target.y;
        const dz = position.z - target.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance > 0.001) {
            this.orbitX = Math.asin(dy / distance);
            this.orbitY = Math.atan2(dx, dz);
        } else {
            this.orbitX = 0;
            this.orbitY = 0;
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
    
    // Step 15) Reset camera to default view
    resetCamera() {
        this.setCameraState(0, 0, 1, 0, 0, 0);
    }
    
    // Step 16) Fit content to view
    fitToView(minX, minY, maxX, maxY, padding = 1.1) {
        const canvas = this.threeRenderer.getCanvas();
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Step 16a) Calculate center
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Step 16b) Calculate scale to fit
        const scaleX = canvas.width / (width * padding);
        const scaleY = canvas.height / (height * padding);
        const scale = Math.min(scaleX, scaleY);
        
        // Step 16c) Set camera state
        this.setCameraState(centerX, centerY, scale, 0, 0, 0);
    }
    
    // Step 17) Update settings
    updateSettings(settings) {
        // Step 17a) Update damping
        if (settings.dampingFactor !== undefined) {
            this.arcballControls.dampingFactor = settings.dampingFactor;
            this.settings.dampingFactor = settings.dampingFactor;
        }
        
        // Step 17b) Update cursor zoom
        if (settings.cursorZoom !== undefined) {
            this.arcballControls.cursorZoom = settings.cursorZoom;
            this.settings.cursorZoom = settings.cursorZoom;
        }
        
        // Step 17c) Update enable flags
        if (settings.enablePan !== undefined) {
            this.arcballControls.enablePan = settings.enablePan;
            this.settings.enablePan = settings.enablePan;
        }
        if (settings.enableRotate !== undefined) {
            this.arcballControls.enableRotate = settings.enableRotate;
            this.settings.enableRotate = settings.enableRotate;
        }
        if (settings.enableZoom !== undefined) {
            this.arcballControls.enableZoom = settings.enableZoom;
            this.settings.enableZoom = settings.enableZoom;
        }
        
        // Step 17d) Update min/max distance
        if (settings.minDistance !== undefined) {
            this.arcballControls.minDistance = settings.minDistance;
            this.settings.minDistance = settings.minDistance;
        }
        if (settings.maxDistance !== undefined) {
            this.arcballControls.maxDistance = settings.maxDistance;
            this.settings.maxDistance = settings.maxDistance;
        }
        
        // Step 17e) Update min/max zoom
        if (settings.minZoom !== undefined) {
            this.arcballControls.minZoom = settings.minZoom;
            this.settings.minZoom = settings.minZoom;
        }
        if (settings.maxZoom !== undefined) {
            this.arcballControls.maxZoom = settings.maxZoom;
            this.settings.maxZoom = settings.maxZoom;
        }
    }
    
    // Step 18) Update method (call in render loop)
    update() {
        // Step 18a) Update ArcballControls
        this.arcballControls.update();
    }
    
    // Step 19) Dispose
    dispose() {
        // Step 19a) Remove event listeners
        this.arcballControls.removeEventListener("change", this.handleChange);
        
        // Step 19b) Dispose ArcballControls
        this.arcballControls.dispose();
    }
}

