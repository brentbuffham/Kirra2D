/* prettier-ignore-file */
//=================================================
// PrintCaptureManager.js - Unified 2D/3D View Capture
//=================================================
// Captures current view for printing in both 2D and 3D modes

export class PrintCaptureManager {
    // Step 1) Main capture method - routes to 2D or 3D
    static captureCurrentView(mode, context) {
        if (mode === "2D") {
            return this.capture2DView(context);
        } else if (mode === "3D") {
            return this.capture3DView(context);
        } else {
            throw new Error("Invalid mode: " + mode + ". Must be '2D' or '3D'");
        }
    }

    // Step 2) Capture 2D canvas view
    static capture2DView(context) {
        const { canvas, getPrintBoundary, currentScale, centroidX, centroidY } = context;

        // Step 2a) Get print boundary (must be in print preview mode)
        const boundary = getPrintBoundary(canvas);
        if (!boundary) {
            throw new Error("Print Preview Mode must be active for 2D capture");
        }

        // Step 2b) Calculate inner boundary (print-safe area - blue dashed lines)
        const innerMargin = boundary.width * boundary.marginPercent;
        const innerBoundary = {
            x: boundary.x + innerMargin,
            y: boundary.y + innerMargin,
            width: boundary.width - innerMargin * 2,
            height: boundary.height - innerMargin * 2
        };

        // Step 2c) Convert screen coordinates to world coordinates
        const world_x1 = (innerBoundary.x - canvas.width / 2) / currentScale + centroidX;
        const world_y1 = -(innerBoundary.y + innerBoundary.height - canvas.height / 2) / currentScale + centroidY;
        const world_x2 = (innerBoundary.x + innerBoundary.width - canvas.width / 2) / currentScale + centroidX;
        const world_y2 = -(innerBoundary.y - canvas.height / 2) / currentScale + centroidY;

        const minX = Math.min(world_x1, world_x2);
        const maxX = Math.max(world_x1, world_x2);
        const minY = Math.min(world_y1, world_y2);
        const maxY = Math.max(world_y1, world_y2);

        // Step 2d) Return capture info
        return {
            worldBounds: {
                minX: minX,
                maxX: maxX,
                minY: minY,
                maxY: maxY
            },
            screenBounds: innerBoundary,
            scale: currentScale,
            mode: "2D"
        };
    }

    // Step 3) Capture 3D scene view
    static capture3DView(context) {
        const { threeRenderer, cameraControls, get3DPrintBoundary } = context;

        // Step 3a) Get 3D print boundary info (must be in 3D print preview mode)
        const boundaryInfo = get3DPrintBoundary ? get3DPrintBoundary() : null;
        if (!boundaryInfo) {
            throw new Error("3D Print Preview Mode must be active for 3D capture");
        }

        // Step 3b) Get current camera state
        const cameraState = cameraControls.getCameraState();

        // Step 3c) Calculate world bounds visible within boundary
        const camera = threeRenderer.camera;
        const canvas = threeRenderer.getCanvas();

        // Convert boundary pixels to normalized coordinates
        const boundaryLeft = (boundaryInfo.x / canvas.width) * 2 - 1;
        const boundaryRight = ((boundaryInfo.x + boundaryInfo.width) / canvas.width) * 2 - 1;
        const boundaryTop = 1 - (boundaryInfo.y / canvas.height) * 2;
        const boundaryBottom = 1 - ((boundaryInfo.y + boundaryInfo.height) / canvas.height) * 2;

        // Calculate world coordinates at boundary edges
        const frustumWidth = camera.right - camera.left;
        const frustumHeight = camera.top - camera.bottom;

        const worldLeft = camera.left + (boundaryLeft + 1) * frustumWidth / 2;
        const worldRight = camera.left + (boundaryRight + 1) * frustumWidth / 2;
        const worldTop = camera.bottom + (boundaryTop + 1) * frustumHeight / 2;
        const worldBottom = camera.bottom + (boundaryBottom + 1) * frustumHeight / 2;

        const worldBounds = {
            minX: worldLeft,
            maxX: worldRight,
            minY: worldBottom,
            maxY: worldTop
        };

        // Step 3d) Capture WebGL canvas
        const imageData = canvas.toDataURL("image/png", 1.0);

        // Step 3e) Return capture info
        return {
            worldBounds: worldBounds,
            imageData: imageData,
            boundaryInfo: boundaryInfo,
            cameraState: cameraState,
            scale: cameraState.scale,
            mode: "3D"
        };
    }

    // Step 4) Capture north arrow for 2D mode
    static captureNorthArrow(context) {
        const { currentRotation, darkModeEnabled } = context;

        // Step 4a) Create canvas for north arrow
        const arrowCanvas = document.createElement("canvas");
        arrowCanvas.width = 100;
        arrowCanvas.height = 100;
        const ctx = arrowCanvas.getContext("2d");

        // Step 4b) Clear background
        ctx.clearRect(0, 0, 100, 100);

        // Step 4c) Draw arrow rotated to show true north
        ctx.save();
        ctx.translate(50, 50);
        ctx.rotate(-currentRotation || 0); // Counter-rotate canvas rotation

        // Step 4d) Draw arrow shape
        ctx.fillStyle = darkModeEnabled ? "#ffffff" : "#000000";
        ctx.beginPath();
        ctx.moveTo(0, -40);      // Arrow point (top)
        ctx.lineTo(-10, 20);     // Left wing
        ctx.lineTo(0, 10);       // Center notch
        ctx.lineTo(10, 20);      // Right wing
        ctx.closePath();
        ctx.fill();

        // Step 4e) Draw "N" label
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("N", 0, -50);

        ctx.restore();

        // Step 4f) Return image data URL
        return arrowCanvas.toDataURL("image/png");
    }

    // Step 5) Capture XYZ gizmo for 3D mode
    static captureXYZGizmo(context) {
        const { threeRenderer, cameraControls } = context;

        if (!threeRenderer || !cameraControls) {
            console.warn("3D renderer not available for gizmo capture");
            return null;
        }

        // Step 5a) Save current gizmo state
        const originalMode = cameraControls.gizmoDisplayMode;

        // Step 5b) Force gizmo visible at corner position
        const cameraState = cameraControls.getCameraState();
        const cornerX = -threeRenderer.camera.right * 0.8;  // Bottom-left
        const cornerY = -threeRenderer.camera.top * 0.8;
        
        threeRenderer.showAxisHelper(true, cornerX, cornerY, cameraState.scale);

        // Step 5c) Render scene to capture gizmo
        threeRenderer.requestRender();

        // Give a moment for render to complete
        // Note: In production, may need to wait for render callback
        
        // Step 5d) Extract gizmo region from canvas
        const canvas = threeRenderer.getCanvas();
        const gizmoCanvas = document.createElement("canvas");
        gizmoCanvas.width = 150;
        gizmoCanvas.height = 150;
        const ctx = gizmoCanvas.getContext("2d");

        // Copy bottom-left corner region where gizmo is positioned
        try {
            ctx.drawImage(
                canvas,
                50, canvas.height - 200,  // Source x, y
                150, 150,                  // Source width, height
                0, 0,                      // Dest x, y
                150, 150                   // Dest width, height
            );
        } catch (e) {
            console.warn("Failed to capture XYZ gizmo:", e);
        }

        // Step 5e) Restore original gizmo state
        if (originalMode === "never" || originalMode === "only_when_orbit_or_rotate") {
            threeRenderer.showAxisHelper(false);
        }

        // Step 5f) Return image data URL
        return gizmoCanvas.toDataURL("image/png");
    }

    // Step 6) Capture QR code image
    static captureQRCode() {
        // Step 6a) Create QR code image if not already cached
        return new Promise(function(resolve, reject) {
            const qrImg = new Image();
            qrImg.crossOrigin = "anonymous";
            
            qrImg.onload = function() {
                try {
                    // Step 6b) Draw to canvas to get data URL
                    const qrCanvas = document.createElement("canvas");
                    qrCanvas.width = 110;
                    qrCanvas.height = 110;
                    const qrCtx = qrCanvas.getContext("2d");
                    qrCtx.drawImage(qrImg, 0, 0, 110, 110);
                    
                    const dataURL = qrCanvas.toDataURL("image/png");
                    resolve(dataURL);
                } catch (e) {
                    console.warn("Failed to prepare QR code:", e);
                    resolve(null);
                }
            };
            
            qrImg.onerror = function() {
                console.warn("Failed to load QR code image");
                resolve(null);
            };
            
            qrImg.src = "icons/kirra2d-qr-code.png";
        });
    }

    // Step 7) Helper to validate capture data
    static validateCaptureData(captureData) {
        if (!captureData) {
            return { valid: false, error: "No capture data" };
        }

        if (!captureData.worldBounds) {
            return { valid: false, error: "Missing world bounds" };
        }

        if (!captureData.mode) {
            return { valid: false, error: "Missing mode" };
        }

        if (captureData.mode === "3D" && !captureData.imageData) {
            return { valid: false, error: "Missing 3D image data" };
        }

        return { valid: true };
    }
}

