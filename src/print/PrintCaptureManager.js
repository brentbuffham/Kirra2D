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

        // Step 4a) Create canvas for north arrow (larger to fit "N" label)
        const arrowCanvas = document.createElement("canvas");
        arrowCanvas.width = 120;
        arrowCanvas.height = 120;
        const ctx = arrowCanvas.getContext("2d");

        // Step 4b) Clear background
        ctx.clearRect(0, 0, 120, 120);

        // Step 4c) Draw arrow rotated to show true north
        ctx.save();
        ctx.translate(60, 65); // Center slightly lower to make room for "N" above
        ctx.rotate(-currentRotation || 0); // Counter-rotate canvas rotation

        // Step 4d) Draw arrow shape (scaled to fit with "N")
        ctx.fillStyle = darkModeEnabled ? "#ffffff" : "#000000";
        ctx.beginPath();
        ctx.moveTo(0, -30);      // Arrow point (top)
        ctx.lineTo(-12, 25);     // Left wing
        ctx.lineTo(0, 15);       // Center notch
        ctx.lineTo(12, 25);      // Right wing
        ctx.closePath();
        ctx.fill();

        // Step 4e) Draw "N" label above arrow
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("N", 0, -35);

        ctx.restore();

        // Step 4f) Return image data URL
        return arrowCanvas.toDataURL("image/png");
    }

    // Step 5) Capture XYZ gizmo for 3D mode
    // Programmatically draws XYZ axes based on camera orientation
    // Returns an object with { canvas, dataURL } for flexibility
    static captureXYZGizmo(context) {
        try {
            console.log("[Gizmo] ===== captureXYZGizmo START =====");
            console.log("[Gizmo] context:", context ? "exists" : "null");
            
            if (!context) {
                console.error("[Gizmo] Context is null/undefined");
                return this.drawDefaultGizmo();
            }
            
            console.log("[Gizmo] context keys:", Object.keys(context).join(", "));
            
            var threeRenderer = context.threeRenderer;
            var cameraControls = context.cameraControls;

            console.log("[Gizmo] threeRenderer:", !!threeRenderer, "cameraControls:", !!cameraControls);
            
            if (!cameraControls) {
                console.warn("[Gizmo] cameraControls not available for gizmo capture");
                // Still try to draw a default gizmo even without camera state
                return this.drawDefaultGizmo();
            }

            // Step 5a) Get camera state for orientation
            console.log("[Gizmo] Getting camera state from cameraControls...");
            console.log("[Gizmo] getCameraState method exists:", typeof cameraControls.getCameraState === "function");
            
            var cameraState = cameraControls.getCameraState ? cameraControls.getCameraState() : null;
            console.log("[Gizmo] cameraState:", JSON.stringify(cameraState));
            const orbitX = cameraState ? (cameraState.orbitX || 0) : 0; // Pitch (elevation angle)
            const orbitY = cameraState ? (cameraState.orbitY || 0) : 0; // Yaw (azimuth angle)
            const rotation = cameraState ? (cameraState.rotation || 0) : 0; // Z rotation
            
            // Note: orbitX and orbitY are already in RADIANS (see CameraControls.js line 754)
            // rotation is in radians too
            const orbitXDeg = (orbitX * 180 / Math.PI).toFixed(1);
            const orbitYDeg = (orbitY * 180 / Math.PI).toFixed(1);
            const rotationDeg = (rotation * 180 / Math.PI).toFixed(1);
            console.log("[Gizmo] Camera state - orbitX:", orbitXDeg + "°", "orbitY:", orbitYDeg + "°", "rotation:", rotationDeg + "°");
            
            // Step 5b) Create gizmo canvas
            const gizmoCanvas = document.createElement("canvas");
            const size = 150;
            gizmoCanvas.width = size;
            gizmoCanvas.height = size;
            const ctx = gizmoCanvas.getContext("2d");
            
            // Step 5c) Clear with white background
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, size, size);
            
            // Step 5d) Calculate axis endpoints based on camera orientation
            // ThreeRenderer uses spherical coordinates:
            // - orbitX = zenith angle (0 = looking down Z-axis, π/2 = horizon) - IN RADIANS
            // - orbitY = azimuth angle in XY plane - IN RADIANS
            // - rotation = camera roll around view axis - IN RADIANS
            
            // Values are already in radians, use directly
            const zenith = orbitX;   // Angle from Z-axis (radians)
            const azimuth = orbitY;  // Azimuth in XY plane (radians)
            const roll = rotation;   // Camera roll (radians)
            
            // Axis length (in pixels)
            const axisLength = 50;
            const center = { x: size / 2, y: size / 2 };
            
            // Step 5e) Calculate camera coordinate frame
            // Camera position in spherical coords: (sin(zenith)*sin(azimuth), sin(zenith)*cos(azimuth), cos(zenith))
            // Camera looks from this position toward origin
            
            // Forward vector (from camera to target, normalized)
            const fwdX = -Math.sin(zenith) * Math.sin(azimuth);
            const fwdY = -Math.sin(zenith) * Math.cos(azimuth);
            const fwdZ = -Math.cos(zenith);
            
            // Base up vector (world Z-up, before roll)
            // Calculate right vector as cross(forward, world_up)
            // Right = forward × (0,0,1)
            let rightX = fwdY * 1 - fwdZ * 0;  // fwdY
            let rightY = fwdZ * 0 - fwdX * 1;  // -fwdX  
            let rightZ = fwdX * 0 - fwdY * 0;  // 0
            
            // Normalize right vector (handle looking straight down/up)
            let rightLen = Math.sqrt(rightX * rightX + rightY * rightY + rightZ * rightZ);
            if (rightLen < 0.001) {
                // Looking straight down or up - use world X as right
                rightX = 1; rightY = 0; rightZ = 0;
                rightLen = 1;
            }
            rightX /= rightLen;
            rightY /= rightLen;
            rightZ /= rightLen;
            
            // Up = right × forward (perpendicular to both)
            let upX = rightY * fwdZ - rightZ * fwdY;
            let upY = rightZ * fwdX - rightX * fwdZ;
            let upZ = rightX * fwdY - rightY * fwdX;
            
            // Apply camera roll (rotate right and up around forward axis)
            const cosRoll = Math.cos(roll);
            const sinRoll = Math.sin(roll);
            const newRightX = rightX * cosRoll + upX * sinRoll;
            const newRightY = rightY * cosRoll + upY * sinRoll;
            const newRightZ = rightZ * cosRoll + upZ * sinRoll;
            const newUpX = -rightX * sinRoll + upX * cosRoll;
            const newUpY = -rightY * sinRoll + upY * cosRoll;
            const newUpZ = -rightZ * sinRoll + upZ * cosRoll;
            
            // Step 5f) Transform world axes to screen space
            // Project world axis onto camera right (screen X) and camera up (screen Y)
            function worldToScreen(wx, wy, wz) {
                // Screen X = dot(world_point, camera_right)
                // Screen Y = dot(world_point, camera_up)
                const screenX = wx * newRightX + wy * newRightY + wz * newRightZ;
                const screenY = wx * newUpX + wy * newUpY + wz * newUpZ;
                // Depth for sorting (dot with forward)
                const depth = wx * fwdX + wy * fwdY + wz * fwdZ;
                return {
                    x: center.x + screenX * axisLength,
                    y: center.y - screenY * axisLength, // Flip Y for canvas coords
                    z: depth
                };
            }
            
            // Get transformed axis endpoints
            const xEnd = worldToScreen(1, 0, 0);  // X axis (East) - Red
            const yEnd = worldToScreen(0, 1, 0);  // Y axis (North) - Green
            const zEnd = worldToScreen(0, 0, 1);  // Z axis (Up) - Blue
            
            // Step 5g) Draw axes with proper depth ordering (painter's algorithm)
            const axes = [
                { end: xEnd, color: "#FF0000", label: "X", z: xEnd.z },
                { end: yEnd, color: "#00AA00", label: "Y", z: yEnd.z },
                { end: zEnd, color: "#0000FF", label: "Z", z: zEnd.z }
            ];
            
            // Sort by z (draw furthest first so closest is on top)
            axes.sort((a, b) => a.z - b.z);
            
            // Step 5g) Draw each axis
            ctx.lineCap = "round";
            ctx.lineWidth = 3;
            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            for (const axis of axes) {
                // Draw axis line
                ctx.strokeStyle = axis.color;
                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.lineTo(axis.end.x, axis.end.y);
                ctx.stroke();
                
                // Draw arrowhead
                const angle = Math.atan2(axis.end.y - center.y, axis.end.x - center.x);
                const arrowSize = 8;
                ctx.fillStyle = axis.color;
                ctx.beginPath();
                ctx.moveTo(axis.end.x, axis.end.y);
                ctx.lineTo(
                    axis.end.x - arrowSize * Math.cos(angle - Math.PI / 6),
                    axis.end.y - arrowSize * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                    axis.end.x - arrowSize * Math.cos(angle + Math.PI / 6),
                    axis.end.y - arrowSize * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fill();
                
                // Draw label beyond the arrow
                const labelDist = axisLength + 18;
                const labelX = center.x + (axis.end.x - center.x) / axisLength * labelDist;
                const labelY = center.y + (axis.end.y - center.y) / axisLength * labelDist;
                ctx.fillStyle = axis.color;
                ctx.fillText(axis.label, labelX, labelY);
            }
            
            // Step 5h) Draw center dot
            ctx.fillStyle = "#333333";
            ctx.beginPath();
            ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Step 5i) Draw border
            ctx.strokeStyle = "#CCCCCC";
            ctx.lineWidth = 1;
            ctx.strokeRect(1, 1, size - 2, size - 2);
            
            console.log("[Gizmo] Generated XYZ gizmo for camera orientation");
            
            // Return both canvas and dataURL for flexibility
            // Canvas-to-canvas drawing is synchronous, Image from dataURL is async
            return {
                canvas: gizmoCanvas,
                dataURL: gizmoCanvas.toDataURL("image/png")
            };
            
        } catch (e) {
            console.error("[Gizmo] Failed to generate XYZ gizmo:", e);
            return this.drawDefaultGizmo();
        }
    }

    // Step 5j) Draw default gizmo (fallback when camera state unavailable)
    static drawDefaultGizmo() {
        console.log("[Gizmo] Drawing default gizmo (no camera state)");
        try {
            var size = 150;
            var gizmoCanvas = document.createElement("canvas");
            gizmoCanvas.width = size;
            gizmoCanvas.height = size;
            var ctx = gizmoCanvas.getContext("2d");
            
            // White background
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, size, size);
            
            var center = { x: size / 2, y: size / 2 };
            var axisLength = 50;
            
            // Draw X axis (Red) - pointing right
            ctx.strokeStyle = "#FF0000";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(center.x + axisLength, center.y);
            ctx.stroke();
            ctx.fillStyle = "#FF0000";
            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.fillText("X", center.x + axisLength + 12, center.y + 5);
            
            // Draw Y axis (Green) - pointing up
            ctx.strokeStyle = "#00AA00";
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(center.x, center.y - axisLength);
            ctx.stroke();
            ctx.fillStyle = "#00AA00";
            ctx.fillText("Y", center.x, center.y - axisLength - 8);
            
            // Draw Z axis (Blue) - pointing diagonally (isometric)
            ctx.strokeStyle = "#0000FF";
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(center.x - axisLength * 0.7, center.y + axisLength * 0.7);
            ctx.stroke();
            ctx.fillStyle = "#0000FF";
            ctx.fillText("Z", center.x - axisLength * 0.7 - 12, center.y + axisLength * 0.7 + 5);
            
            // Center dot
            ctx.fillStyle = "#333333";
            ctx.beginPath();
            ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = "#CCCCCC";
            ctx.lineWidth = 1;
            ctx.strokeRect(1, 1, size - 2, size - 2);
            
            // Return both canvas and dataURL for flexibility
            return {
                canvas: gizmoCanvas,
                dataURL: gizmoCanvas.toDataURL("image/png")
            };
        } catch (e) {
            console.error("[Gizmo] Failed to draw default gizmo:", e);
            return null;
        }
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

