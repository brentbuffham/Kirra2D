// src/shaders/core/BaseAnalyticsShader.js
import * as THREE from "three";

/**
 * BaseAnalyticsShader is the abstract base class that both BlastAnalyticsShader
 * and SurfaceCompareShader extend.
 *
 * Provides common functionality for:
 * - Lifecycle management (init, update, dispose)
 * - Colour ramp management
 * - 2D flattening for canvas overlay
 * - Visibility and transparency control
 */
export class BaseAnalyticsShader {
    constructor(sceneManager, options) {
        this.sceneManager = sceneManager;
        this.mesh = null;
        this.material = null;
        this.renderTarget = null;      // For 2D flattening
        this.flattenedCanvas = null;   // Cached 2D canvas
        this.dirty = true;             // Needs uniform update
        this.visible = false;
        this.transparency = 0.7;

        // Colour ramp
        this.colourRampTexture = null;
        this.minValue = 0;
        this.maxValue = 100;
        this.colourRampName = "jet";   // default ramp

        // Contour lines
        this.contourInterval = null;   // null = auto
        this.showContours = false;

        // Subclass config
        this.config = Object.assign({
            resolution: 1.0,           // metres per pixel for flattening
            maxTextureSize: 4096,
            autoUpdate: true
        }, options || {});
    }

    // --- Lifecycle ---

    /**
     * Initialize with geometry and bounds.
     * Subclasses should override to create mesh and material.
     *
     * @param {THREE.BufferGeometry} geometry
     * @param {Object} bounds - { minX, minY, maxX, maxY, minZ, maxZ }
     */
    init(geometry, bounds) {
        throw new Error("BaseAnalyticsShader.init() must be implemented by subclass");
    }

    /**
     * Update uniforms with new data.
     * Subclasses should override to handle their specific data.
     *
     * @param {*} data - Model-specific data
     * @param {Object} params - Model-specific parameters
     */
    update(data, params) {
        throw new Error("BaseAnalyticsShader.update() must be implemented by subclass");
    }

    /**
     * Set visibility of the shader mesh.
     *
     * @param {boolean} v - Visible flag
     */
    setVisible(v) {
        this.visible = v;
        if (this.mesh) {
            this.mesh.visible = v;
        }
    }

    /**
     * Dispose of all resources.
     */
    dispose() {
        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            this.mesh = null;
        }
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
        if (this.colourRampTexture) {
            this.colourRampTexture.dispose();
            this.colourRampTexture = null;
        }
        if (this.renderTarget) {
            this.renderTarget.dispose();
            this.renderTarget = null;
        }
        this.flattenedCanvas = null;
    }

    // --- Colour ramp ---

    /**
     * Set colour ramp and value range.
     *
     * @param {string} rampName - Name from ColourRampFactory.RAMPS
     * @param {number} min - Minimum value for color mapping
     * @param {number} max - Maximum value for color mapping
     */
    setColourRamp(rampName, min, max) {
        this.colourRampName = rampName;
        if (min !== undefined) this.minValue = min;
        if (max !== undefined) this.maxValue = max;

        // Subclasses should rebuild colour ramp texture and update uniforms
        this._markDirty();
    }

    // --- 2D Flattening ---

    /**
     * Render to WebGLRenderTarget and return canvas.
     * Subclasses should implement or use ShaderFlattenHelper.
     *
     * @param {THREE.Camera} camera - Camera for rendering
     * @returns {HTMLCanvasElement}
     */
    flatten(camera) {
        throw new Error("BaseAnalyticsShader.flatten() must be implemented by subclass");
    }

    /**
     * Get flattened bounds in world coordinates.
     *
     * @returns {{ minX, minY, maxX, maxY }}
     */
    getFlattenedBounds() {
        if (!this.mesh || !this.mesh.geometry) return null;

        var geom = this.mesh.geometry;
        if (!geom.boundingBox) geom.computeBoundingBox();

        var bbox = geom.boundingBox;
        return {
            minX: bbox.min.x,
            minY: bbox.min.y,
            maxX: bbox.max.x,
            maxY: bbox.max.y
        };
    }

    // --- Contours ---

    /**
     * Generate contour lines from shader output.
     * This would read back pixels and run marching squares.
     *
     * @param {number} interval - Contour interval
     * @returns {Array} - Array of polyline contours
     */
    generateContours(interval) {
        // Future implementation: marching squares on render target pixels
        console.warn("BaseAnalyticsShader.generateContours() not yet implemented");
        return [];
    }

    // --- Internal ---

    /**
     * Create a ShaderMaterial with given sources and uniforms.
     *
     * @param {string} vertSrc - Vertex shader source
     * @param {string} fragSrc - Fragment shader source
     * @param {Object} uniforms - Uniform definitions
     * @returns {THREE.ShaderMaterial}
     * @protected
     */
    _createMaterial(vertSrc, fragSrc, uniforms) {
        return new THREE.ShaderMaterial({
            vertexShader: vertSrc,
            fragmentShader: fragSrc,
            uniforms: uniforms,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
    }

    /**
     * Mark as needing update.
     * @protected
     */
    _markDirty() {
        this.dirty = true;
        this.flattenedCanvas = null;  // Invalidate cached canvas
    }
}
