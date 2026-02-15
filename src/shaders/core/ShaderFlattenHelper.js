// src/shaders/core/ShaderFlattenHelper.js
import * as THREE from "three";

/**
 * ShaderFlattenHelper renders a 3D shader mesh to a WebGLRenderTarget, then reads
 * it back as a canvas image for 2D view overlay.
 *
 * This mirrors the existing renderSurfaceToCanvas pattern but uses the GPU pipeline
 * for shader-based analytics.
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
     * @returns {{ canvas, bounds, width, height, pixelsPerMetre }}
     */
    flatten(mesh, bounds, pixelsPerMetre) {
        pixelsPerMetre = pixelsPerMetre || 1.0;

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

        // Orthographic camera looking straight down
        if (!this.orthoCamera) {
            this.orthoCamera = new THREE.OrthographicCamera();
        }
        this.orthoCamera.left = bounds.minX;
        this.orthoCamera.right = bounds.maxX;
        this.orthoCamera.top = bounds.maxY;
        this.orthoCamera.bottom = bounds.minY;
        this.orthoCamera.near = -1000;
        this.orthoCamera.far = 1000;
        this.orthoCamera.position.set(
            (bounds.minX + bounds.maxX) / 2,
            (bounds.minY + bounds.maxY) / 2,
            500
        );
        this.orthoCamera.lookAt(
            (bounds.minX + bounds.maxX) / 2,
            (bounds.minY + bounds.maxY) / 2,
            0
        );
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
