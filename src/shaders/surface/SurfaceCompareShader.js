// src/shaders/surface/SurfaceCompareShader.js
import * as THREE from "three";
import { BaseAnalyticsShader } from "../core/BaseAnalyticsShader.js";
import { ColourRampFactory } from "../core/ColourRampFactory.js";
import { ShaderFlattenHelper } from "../core/ShaderFlattenHelper.js";

var VERT_SOURCE = `
    precision highp float;
    varying vec3 vWorldPos;
    varying vec2 vUV;
    uniform vec3 uWorldOffset;

    void main() {
        vWorldPos = position.xyz + uWorldOffset;
        vUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

var FRAG_SOURCE = `
    precision highp float;

    // As-built surface (the mesh being rendered)
    varying vec3 vWorldPos;

    // Design wall polyline (as texture for horizontal distance)
    uniform sampler2D uWallPolyline;      // each texel = (x, y) of wall vertex
    uniform int uWallVertexCount;
    uniform float uWallTextureWidth;

    // Colour ramp
    uniform sampler2D uColourRamp;
    uniform float uMinValue;              // e.g. -2.0  (underbreak)
    uniform float uMaxValue;              // e.g. +2.0  (overbreak)
    uniform float uOpacity;

    vec2 getWallVertex(int index) {
        float u = (float(index) + 0.5) / uWallTextureWidth;
        vec4 data = texture2D(uWallPolyline, vec2(u, 0.5));
        return data.xy;
    }

    // Find minimum horizontal distance from point to polyline
    float distToPolyline(vec2 point) {
        float minDist = 1e10;

        for (int i = 0; i < 1024; i++) {
            if (i >= uWallVertexCount - 1) break;

            vec2 a = getWallVertex(i);
            vec2 b = getWallVertex(i + 1);

            // Project point onto segment
            vec2 ab = b - a;
            float t = clamp(dot(point - a, ab) / dot(ab, ab), 0.0, 1.0);
            vec2 closest = a + t * ab;

            float d = distance(point, closest);
            minDist = min(minDist, d);
        }

        return minDist;
    }

    // Determine sign (inside/outside design)
    float signedDistToPolyline(vec2 point) {
        float dist = distToPolyline(point);

        // Winding number test for inside/outside
        // Positive = outside design (overbreak), negative = inside (underbreak)
        int windingNumber = 0;
        for (int i = 0; i < 1024; i++) {
            if (i >= uWallVertexCount - 1) break;
            vec2 a = getWallVertex(i);
            vec2 b = getWallVertex(i + 1);

            if (a.y <= point.y) {
                if (b.y > point.y) {
                    float cross = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y);
                    if (cross > 0.0) windingNumber++;
                }
            } else {
                if (b.y <= point.y) {
                    float cross = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y);
                    if (cross < 0.0) windingNumber--;
                }
            }
        }

        return windingNumber != 0 ? -dist : dist;  // inside = negative
    }

    void main() {
        float signedDist = signedDistToPolyline(vWorldPos.xy);

        // Map signed distance to [0, 1] for colour ramp
        // minValue is typically negative (underbreak), maxValue positive (overbreak)
        float range = uMaxValue - uMinValue;
        float t = clamp((signedDist - uMinValue) / range, 0.0, 1.0);

        vec4 colour = texture2D(uColourRamp, vec2(t, 0.5));
        colour.a *= uOpacity;

        gl_FragColor = colour;
    }
`;

/**
 * SurfaceCompareShader computes horizontal distance between an as-built surface
 * and a design wall polyline, for wall compliance visualization.
 *
 * Usage:
 *   var compare = new SurfaceCompareShader(threeRenderer);
 *   compare.setDesignWall([{x, y}, {x, y}, ...]); // design wall vertices
 *   var mesh = compare.buildOnSurface(surfaceGeometry, worldOffset);
 *   scene.add(mesh);
 */
export class SurfaceCompareShader extends BaseAnalyticsShader {
    constructor(sceneManager, options) {
        super(sceneManager, options);

        this.displayName = "Wall Compliance (Horizontal Distance)";
        this.unit = "m";
        this.colourRampName = "compliance";
        this.minValue = -2.0;   // 2m underbreak
        this.maxValue = 2.0;    // 2m overbreak

        // Wall polyline data
        this.wallVertices = [];
        this.wallTexture = null;
        this.wallTextureWidth = 1024;

        this.flattenHelper = null;
        this._worldOffset = new THREE.Vector3(0, 0, 0);
    }

    /**
     * Set the design wall polyline.
     * @param {Array} vertices - [{x, y}, ...] in world coordinates
     */
    setDesignWall(vertices) {
        this.wallVertices = vertices;
        this._packWallTexture();
        if (this.material) {
            this.material.uniforms.uWallPolyline.value = this.wallTexture;
            this.material.uniforms.uWallVertexCount.value = vertices.length;
            this.material.uniformsNeedUpdate = true;
        }
    }

    /**
     * Build the shader on a triangulated as-built surface mesh.
     *
     * @param {THREE.BufferGeometry} surfaceGeometry - As-built surface geometry
     * @param {Object} worldOffset - { x, y, z } world offset
     * @returns {THREE.Mesh}
     */
    buildOnSurface(surfaceGeometry, worldOffset) {
        this._buildMaterial();

        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            this.mesh.geometry.dispose();
        }

        this.mesh = new THREE.Mesh(surfaceGeometry, this.material);
        this.mesh.userData = { type: "surfaceCompare" };

        if (worldOffset) {
            this._worldOffset.set(worldOffset.x || 0, worldOffset.y || 0, worldOffset.z || 0);
            this.material.uniforms.uWorldOffset.value.copy(this._worldOffset);
        }

        return this.mesh;
    }

    /**
     * Flatten to 2D canvas.
     *
     * @param {THREE.WebGLRenderer} renderer - Three.js renderer
     * @param {Object} bounds - { minX, minY, maxX, maxY }
     * @param {number} pixelsPerMetre - Resolution (default 2.0)
     * @returns {{ canvas, bounds, width, height, pixelsPerMetre }}
     */
    flatten(renderer, bounds, pixelsPerMetre) {
        if (!this.flattenHelper) {
            this.flattenHelper = new ShaderFlattenHelper(renderer);
        }
        return this.flattenHelper.flatten(this.mesh, bounds, pixelsPerMetre || 2.0);
    }

    // --- Internal ---

    /**
     * Pack wall vertices into a DataTexture.
     * @private
     */
    _packWallTexture() {
        var data = new Float32Array(this.wallTextureWidth * 4);
        data.fill(0);

        for (var i = 0; i < Math.min(this.wallVertices.length, this.wallTextureWidth); i++) {
            data[i * 4 + 0] = this.wallVertices[i].x;
            data[i * 4 + 1] = this.wallVertices[i].y;
            data[i * 4 + 2] = 0;
            data[i * 4 + 3] = 1;
        }

        if (!this.wallTexture) {
            this.wallTexture = new THREE.DataTexture(
                data, this.wallTextureWidth, 1,
                THREE.RGBAFormat, THREE.FloatType
            );
            this.wallTexture.minFilter = THREE.NearestFilter;
            this.wallTexture.magFilter = THREE.NearestFilter;
        } else {
            this.wallTexture.image.data.set(data);
        }
        this.wallTexture.needsUpdate = true;
    }

    /**
     * Build the shader material.
     * @private
     */
    _buildMaterial() {
        if (this.material) this.material.dispose();
        if (this.colourRampTexture) this.colourRampTexture.dispose();

        if (!this.wallTexture) this._packWallTexture();
        this.colourRampTexture = ColourRampFactory.create(this.colourRampName);

        this.material = new THREE.ShaderMaterial({
            vertexShader: VERT_SOURCE,
            fragmentShader: FRAG_SOURCE,
            uniforms: {
                uWorldOffset: { value: this._worldOffset.clone() },
                uWallPolyline: { value: this.wallTexture },
                uWallVertexCount: { value: this.wallVertices.length },
                uWallTextureWidth: { value: this.wallTextureWidth },
                uColourRamp: { value: this.colourRampTexture },
                uMinValue: { value: this.minValue },
                uMaxValue: { value: this.maxValue },
                uOpacity: { value: this.transparency }
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
    }

    /**
     * Dispose of all resources.
     */
    dispose() {
        if (this.wallTexture) this.wallTexture.dispose();
        if (this.flattenHelper) this.flattenHelper.dispose();
        if (this.colourRampTexture) this.colourRampTexture.dispose();
        if (this.material) this.material.dispose();
        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
        }
    }
}
