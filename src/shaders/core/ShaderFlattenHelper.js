// src/shaders/core/ShaderFlattenHelper.js
import * as THREE from "three";

/**
 * ShaderFlattenHelper renders a 3D shader mesh to a WebGLRenderTarget, then reads
 * it back as a canvas image for 2D view overlay.
 *
 * This mirrors the existing renderSurfaceToCanvas pattern but uses the GPU pipeline
 * for shader-based analytics.
 *
 * Supports arbitrary surface orientations via optional surfaceNormal parameter.
 */
export class ShaderFlattenHelper {
    /**
     * @param {THREE.WebGLRenderer} renderer - Three.js WebGL renderer
     */
    constructor(renderer) {
        this.renderer = renderer;  // THREE.WebGLRenderer
        this.renderTarget = null;
        this.orthoCamera = null;
        this.scene = null;
    }

    /**
     * Flatten a shader mesh to a 2D canvas.
     *
     * @param {THREE.Mesh} mesh - The shader-driven mesh
     * @param {Object} bounds - { minX, minY, maxX, maxY } in world coords
     * @param {number} pixelsPerMetre - Resolution (default 1.0)
     * @param {Object} [options] - Optional settings
     * @param {Object} [options.surfaceNormal] - {x, y, z} surface normal for camera orientation
     * @param {Object} [options.projectionBasis] - { tangent, bitangent, normal } for non-horizontal surfaces
     * @returns {{ canvas, bounds, width, height, pixelsPerMetre }}
     */
    flatten(mesh, bounds, pixelsPerMetre, options) {
        pixelsPerMetre = pixelsPerMetre || 1.0;
        options = options || {};

        var worldW = bounds.maxX - bounds.minX;
        var worldH = bounds.maxY - bounds.minY;
        var pxW = Math.min(Math.ceil(worldW * pixelsPerMetre), 4096);
        var pxH = Math.min(Math.ceil(worldH * pixelsPerMetre), 4096);

        // Create or resize render target
        if (!this.renderTarget || this.renderTarget.width !== pxW || this.renderTarget.height !== pxH) {
            if (this.renderTarget) this.renderTarget.dispose();
            this.renderTarget = new THREE.WebGLRenderTarget(pxW, pxH, {
                format: THREE.RGBAFormat,
                type: THREE.UnsignedByteType
            });
        }

        // Orthographic camera — oriented based on surface normal
        if (!this.orthoCamera) {
            this.orthoCamera = new THREE.OrthographicCamera();
        }

        var centerX = (bounds.minX + bounds.maxX) / 2;
        var centerY = (bounds.minY + bounds.maxY) / 2;

        var surfaceNormal = options.surfaceNormal;
        var isNonHorizontal = surfaceNormal &&
            (Math.abs(surfaceNormal.z) < 0.95);

        if (isNonHorizontal && options.projectionBasis) {
            // Non-horizontal surface — orient camera along surface normal
            var basis = options.projectionBasis;
            var n = surfaceNormal;

            // Camera frustum uses projected bounds
            this.orthoCamera.left = -worldW / 2;
            this.orthoCamera.right = worldW / 2;
            this.orthoCamera.top = worldH / 2;
            this.orthoCamera.bottom = -worldH / 2;
            this.orthoCamera.near = -1000;
            this.orthoCamera.far = 1000;

            // Position camera along surface normal
            this.orthoCamera.position.set(
                centerX + n.x * 500,
                centerY + n.y * 500,
                (bounds.minZ || 0) + n.z * 500
            );
            this.orthoCamera.up.set(basis.bitangent.x, basis.bitangent.y, basis.bitangent.z);
            this.orthoCamera.lookAt(centerX, centerY, bounds.minZ || 0);
        } else {
            // Horizontal surface — looking straight down (existing behavior)
            this.orthoCamera.left = bounds.minX;
            this.orthoCamera.right = bounds.maxX;
            this.orthoCamera.top = bounds.maxY;
            this.orthoCamera.bottom = bounds.minY;
            this.orthoCamera.near = -1000;
            this.orthoCamera.far = 1000;
            this.orthoCamera.position.set(centerX, centerY, 500);
            this.orthoCamera.up.set(0, 1, 0);
            this.orthoCamera.lookAt(centerX, centerY, 0);
        }
        this.orthoCamera.updateProjectionMatrix();

        // Temporary scene with just the shader mesh
        if (!this.scene) this.scene = new THREE.Scene();
        this.scene.children = [];
        this.scene.add(mesh.clone());

        // Render to target
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.render(this.scene, this.orthoCamera);
        this.renderer.setRenderTarget(null);

        // Read pixels to canvas
        var pixels = new Uint8Array(pxW * pxH * 4);
        this.renderer.readRenderTargetPixels(this.renderTarget, 0, 0, pxW, pxH, pixels);

        var canvas = document.createElement("canvas");
        canvas.width = pxW;
        canvas.height = pxH;
        var ctx = canvas.getContext("2d");
        var imageData = ctx.createImageData(pxW, pxH);

        // WebGL reads bottom-up, canvas is top-down — flip Y
        for (var y = 0; y < pxH; y++) {
            var srcRow = (pxH - 1 - y) * pxW * 4;
            var dstRow = y * pxW * 4;
            for (var x = 0; x < pxW * 4; x++) {
                imageData.data[dstRow + x] = pixels[srcRow + x];
            }
        }
        ctx.putImageData(imageData, 0, 0);

        return {
            canvas: canvas,
            bounds: [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY],
            width: pxW,
            height: pxH,
            pixelsPerMetre: pixelsPerMetre
        };
    }

    /**
     * Dispose of resources.
     */
    dispose() {
        if (this.renderTarget) this.renderTarget.dispose();
        this.renderTarget = null;
        this.orthoCamera = null;
        this.scene = null;
    }
}
