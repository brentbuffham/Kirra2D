/* prettier-ignore-file */
//=================================================
// CameraControls.js - Camera pan/zoom/rotate controls
//=================================================

export class CameraControls {
    constructor(threeRenderer, canvas2D) {
        // Step 1) Store references
        this.threeRenderer = threeRenderer;
        this.canvas2D = canvas2D;

        // Get the container that holds both canvases
        this.container = canvas2D.parentElement;

        // Step 2) Camera state
        this.centroidX = 0;
        this.centroidY = 0;
        this.scale = 1;
        this.rotation = 0; // Z-axis rotation (2D spin)
        this.orbitX = 0; // X-axis rotation (pitch/elevation)
        this.orbitY = 0; // Y-axis rotation (yaw/azimuth)

        // Step 3) Mouse state
        this.isDragging = false;
        this.isRotating = false;
        this.isOrbiting = false; // 3D orbit mode
        this.pendingPan = false; // Flag to track if pan is pending (will activate on drag)
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // Step 3a) Momentum/damping state for smooth controls
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityOrbitX = 0;
        this.velocityOrbitY = 0;
        this.velocityRotation = 0;
        this.damping = 0.85; // Damping factor (0-1, higher = less damping)
        this.minVelocity = 0.0001; // Stop animation below this velocity
        this.animationFrameId = null;

        // Step 4) Bind event handlers
        this.handleWheel = this.handleWheel.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.animate = this.animate.bind(this);

        // Step 5) Touch state
        this.lastTouchDistance = 0;
        this.touchStartCentroidX = 0;
        this.touchStartCentroidY = 0;
        this.touchStartScale = 1;
    }

    // Step 6) Initialize event listeners
    attachEvents() {
        // Attach to container that holds both canvases
        // This works regardless of which canvas is on top
        const container = this.container;

        container.addEventListener("wheel", this.handleWheel, { passive: false });
        container.addEventListener("mousedown", this.handleMouseDown);

        // Step 6b) Prevent context menu ONLY during active drag/rotation
        // Allow single right-click to show context menu
        container.addEventListener("contextmenu", (e) => {
            // Only prevent if we're actively dragging/rotating
            if (this.isDragging || this.isRotating || this.isOrbiting) {
                e.preventDefault();
                return false;
            }
        });

        // Step 6a) Attach mousemove and mouseup to document for better drag handling
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
        container.addEventListener("mouseleave", this.handleMouseUp);

        container.addEventListener("touchstart", this.handleTouchStart, { passive: false });
        container.addEventListener("touchmove", this.handleTouchMove, { passive: false });
        container.addEventListener("touchend", this.handleTouchEnd);

        console.log("🎮 Camera controls attached to canvas container");
    }

    // Step 7) Remove event listeners
    detachEvents() {
        const container = this.container;

        container.removeEventListener("wheel", this.handleWheel);
        container.removeEventListener("mousedown", this.handleMouseDown);
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
    }

    // Step 8) Set camera state and update renderer
    setCameraState(centroidX, centroidY, scale, rotation = 0, orbitX = 0, orbitY = 0) {
        this.centroidX = centroidX;
        this.centroidY = centroidY;
        this.scale = scale;
        this.rotation = rotation;
        this.orbitX = orbitX;
        this.orbitY = orbitY;
        this.threeRenderer.updateCamera(centroidX, centroidY, scale, rotation, orbitX, orbitY);
    }

    // Step 9) Get current camera state
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

    // Step 10) Handle mouse wheel for zoom with cursor zoom support
    handleWheel(event) {
        event.preventDefault();

        const canvas = this.threeRenderer.getCanvas();
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Step 11) Calculate zoom factor
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const oldScale = this.scale;
        const newScale = Math.max(0.01, Math.min(1000, oldScale * zoomFactor));
        this.scale = newScale;

        // Step 12) Cursor zoom - adjust centroid to keep cursor position fixed in world space
        // This works in both 2D and 3D modes
        if (this.orbitX === 0 && this.orbitY === 0) {
            // 2D mode - standard cursor zoom
            const worldX = (mouseX - canvas.width / 2) / oldScale + this.centroidX;
            const worldY = -((mouseY - canvas.height / 2) / oldScale) + this.centroidY;

            this.centroidX = worldX - (mouseX - canvas.width / 2) / this.scale;
            this.centroidY = worldY + (mouseY - canvas.height / 2) / this.scale;
        } else {
            // 3D mode - scale the orbit distance
            // This effectively zooms toward/away from the orbit center
            // The visual effect is zoom toward cursor in 3D space
            const scaleDelta = newScale / oldScale;

            // Adjust centroid based on mouse offset from center
            // This shifts the orbit center toward the cursor
            const centerOffsetX = (mouseX - canvas.width / 2) / oldScale;
            const centerOffsetY = -((mouseY - canvas.height / 2) / oldScale);

            // Apply a portion of the offset to create cursor-directed zoom
            const cursorInfluence = 1 - scaleDelta; // More influence when zooming in
            this.centroidX += centerOffsetX * cursorInfluence * 0.3;
            this.centroidY += centerOffsetY * cursorInfluence * 0.3;
        }

        // Step 13) Hide axis helper during zoom (transient behavior)
        this.threeRenderer.showAxisHelper(false);

        // Step 14) Update camera (preserve orbit state during zoom)
        this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);

        return { centroidX: this.centroidX, centroidY: this.centroidY, scale: this.scale, rotation: this.rotation, orbitX: this.orbitX, orbitY: this.orbitY };
    }

    // Step 16) Handle mouse down
    handleMouseDown(event) {
        // Step 16a) Check if we're in 3D mode and if an object was clicked (selection takes priority)
        // Only check if onlyShowThreeJS is true and no modifier keys (selection handler runs in capture phase)
        if (window.onlyShowThreeJS && !event.altKey && !event.metaKey && !event.ctrlKey && event.button !== 2) {
            // Check if selection handler already handled this (it runs in capture phase)
            // If event.defaultPrevented, selection handler stopped us - don't start any camera movement
            if (event.defaultPrevented) {
                console.log("🎯 Camera controls: Selection handler prevented camera movement");
                return; // Don't start camera drag/orbit/rotate
            }
        }

        // Step 16b) Stop any ongoing momentum animation
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Step 16c) Reset velocities
        this.velocityX = 0;
        this.velocityY = 0;
        this.velocityOrbitX = 0;
        this.velocityOrbitY = 0;
        this.velocityRotation = 0;

        // Step 17) Prevent context menu on right-click ONLY if we're starting a drag/rotation
        // Allow single right-click to show context menu
        if (event.button === 2 && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
        }
        // Step 18) Check for orbit mode (Alt key) - activate immediately
        if (event.altKey) {
            event.preventDefault(); // Prevent any browser shortcuts
            this.isOrbiting = true;
            this.isRotating = false;
            this.isDragging = false;
            console.log("🌐 3D Orbit mode activated (Alt held)");
        }
        // Step 19) Check for 2D rotation mode (Command/Ctrl or right-click) - activate immediately
        // metaKey = Command on Mac, Windows key on PC
        else if (event.metaKey || event.ctrlKey || event.button === 2) {
            event.preventDefault(); // Prevent context menu and browser shortcuts
            this.isRotating = true;
            this.isOrbiting = false;
            this.isDragging = false;
            console.log("🔄 2D Rotation mode activated (⌘/Ctrl/Right-click)");
        }
        // Step 20) Default pan mode - but DON'T activate until mouse moves (drag detected)
        // In 3D mode, single click should select, not pan. Pan only happens on drag.
        else {
            // Don't set isDragging = true yet - wait for mousemove to detect actual drag
            // Store initial position to detect drag threshold
            this.isDragging = false; // Start as false, will be set to true on first mousemove
            this.isRotating = false;
            this.isOrbiting = false;
            this.pendingPan = true; // Flag to indicate pan is pending (will activate on drag)
        }

        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
    }

    // Step 18) Handle mouse move
    handleMouseMove(event) {
        // Step 18a) Check if pan is pending and activate on first movement (drag threshold)
        if (this.pendingPan && !this.isDragging && !this.isRotating && !this.isOrbiting) {
            // Check if mouse has moved enough to consider it a drag (not just a click)
            const dragThreshold = 3; // pixels
            const deltaX = Math.abs(event.clientX - this.dragStartX);
            const deltaY = Math.abs(event.clientY - this.dragStartY);

            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                // Mouse has moved enough - this is a drag, activate pan
                this.isDragging = true;
                this.pendingPan = false;
                console.log("👆 Pan mode activated (drag detected)");
            }
        }

        if (this.isDragging) {
            // Step 19) Pan mode - account for current rotation
            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;

            // Rotate the delta values to account for current Z-axis rotation
            // This makes panning follow the rotated coordinate system
            const cos = Math.cos(-this.rotation); // Negative because we're rotating screen space
            const sin = Math.sin(-this.rotation);

            const rotatedDeltaX = deltaX * cos - deltaY * sin;
            const rotatedDeltaY = deltaX * sin + deltaY * cos;

            this.centroidX -= rotatedDeltaX / this.scale;
            this.centroidY += rotatedDeltaY / this.scale;

            // Store velocity for momentum
            this.velocityX = -rotatedDeltaX / this.scale;
            this.velocityY = rotatedDeltaY / this.scale;

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;

            // Step 19b) Hide axis helper during pan (transient behavior)
            this.threeRenderer.showAxisHelper(false);
            this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);

            return { centroidX: this.centroidX, centroidY: this.centroidY, mode: "pan" };
        } else if (this.isRotating) {
            // Step 20) 2D Rotation mode (Z-axis spin)
            // Step 20a) Show axis helper while actively rotating
            this.threeRenderer.showAxisHelper(true, this.centroidX, this.centroidY, this.scale);

            const canvas = this.threeRenderer.getCanvas();
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Step 21) Calculate angle from center
            const startAngle = Math.atan2(this.lastMouseY - centerY, this.lastMouseX - centerX);
            const currentAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
            const deltaAngle = currentAngle - startAngle;

            this.rotation += deltaAngle;
            this.velocityRotation = deltaAngle; // Store for momentum

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;

            this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);

            return { rotation: this.rotation, mode: "rotate" };
        } else if (this.isOrbiting) {
            // Step 22) 3D Orbit mode (X and Y axis rotation)
            // Step 22a) Show axis helper while actively orbiting
            this.threeRenderer.showAxisHelper(true, this.centroidX, this.centroidY, this.scale);

            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;

            // Use smaller sensitivity for smoother control (reduced from 0.01 to 0.005)
            const sensitivity = 0.005;

            // Horizontal movement = Y-axis rotation (yaw/azimuth)
            const deltaOrbitY = deltaX * sensitivity;
            this.orbitY += deltaOrbitY;
            this.velocityOrbitY = deltaOrbitY; // Store for momentum

            // Vertical movement = X-axis rotation (pitch/elevation)
            // No clamping - allow full rotation in all directions
            const deltaOrbitX = deltaY * sensitivity;
            this.orbitX += deltaOrbitX;
            this.velocityOrbitX = deltaOrbitX; // Store for momentum

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;

            this.threeRenderer.updateCamera(this.centroidX, this.centroidY, this.scale, this.rotation, this.orbitX, this.orbitY);

            return { orbitX: this.orbitX, orbitY: this.orbitY, mode: "orbit" };
        }

        return null;
    }

    // Step 22) Handle mouse up
    handleMouseUp(event) {
        // Step 22a) Reset pending pan flag if mouse up without drag
        if (this.pendingPan && !this.isDragging) {
            this.pendingPan = false;
            // This was a click, not a drag - selection handler should have handled it
        }

        // Step 22b) Hide axis helper when rotation/orbit ends
        if (this.isRotating || this.isOrbiting) {
            this.threeRenderer.showAxisHelper(false);
            console.log("🎯 Axis helper hidden - keys released");
        }

        // Step 22b) Start momentum animation if there's significant velocity
        const hasVelocity = Math.abs(this.velocityX) > this.minVelocity || Math.abs(this.velocityY) > this.minVelocity || Math.abs(this.velocityOrbitX) > this.minVelocity || Math.abs(this.velocityOrbitY) > this.minVelocity || Math.abs(this.velocityRotation) > this.minVelocity;

        if (hasVelocity && this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(this.animate);
        }

        this.isDragging = false;
        this.isRotating = false;
        this.isOrbiting = false;
        this.pendingPan = false;
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
}
