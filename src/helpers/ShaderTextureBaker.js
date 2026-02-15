// src/helpers/ShaderTextureBaker.js
import * as THREE from "three";

/**
 * ShaderTextureBaker renders blast analysis shaders to offscreen canvas
 * and generates UV-mapped textures for persistent surface visualization.
 *
 * Key Features:
 * - Offscreen rendering to 2048×2048 canvas (configurable)
 * - Planar UV mapping (top-down projection)
 * - Creates THREE.CanvasTexture for 3D rendering
 * - Stores canvas for 2D rendering
 * - Handles coordinate transformations
 */
export class ShaderTextureBaker {

    /**
     * Bake a blast analysis shader to a texture.
     *
     * @param {Object} surface - Surface object with points array
     * @param {THREE.ShaderMaterial} shaderMaterial - Configured shader material
     * @param {Object} options - { resolution: 2048, padding: 10 }
     * @returns {Object} - { texture, canvas, uvBounds: {minU, maxU, minV, maxV} }
     */
    static bakeShaderToTexture(surface, shaderMaterial, options) {
        options = options || {};
        var resolution = options.resolution || 2048;
        var padding = options.padding || 10; // meters of padding around surface

        // Calculate surface bounds in world coordinates
        var bounds = this._calculateSurfaceBounds(surface);
        bounds.minX -= padding;
        bounds.maxX += padding;
        bounds.minY -= padding;
        bounds.maxY += padding;

        var width = bounds.maxX - bounds.minX;
        var height = bounds.maxY - bounds.minY;

        // Create offscreen rendering setup
        var offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = resolution;
        offscreenCanvas.height = resolution;

        var offscreenRenderer = new THREE.WebGLRenderer({
            canvas: offscreenCanvas,
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true // CRITICAL: allows reading pixels
        });
        offscreenRenderer.setSize(resolution, resolution);
        offscreenRenderer.setClearColor(0x000000, 0); // Transparent background

        // Create orthographic camera looking down (top-down view)
        var camera = new THREE.OrthographicCamera(
            bounds.minX, bounds.maxX, // left, right
            bounds.maxY, bounds.minY, // top, bottom (Y inverted for texture space)
            -1000, 1000               // near, far
        );
        camera.position.set(
            (bounds.minX + bounds.maxX) / 2,
            (bounds.minY + bounds.maxY) / 2,
            500
        );
        camera.lookAt(
            (bounds.minX + bounds.maxX) / 2,
            (bounds.minY + bounds.maxY) / 2,
            0
        );

        // Create scene with shader mesh
        var scene = new THREE.Scene();

        // Build mesh from surface triangles
        var geometry = this._buildSurfaceGeometry(surface, window.threeLocalOriginX, window.threeLocalOriginY);
        var mesh = new THREE.Mesh(geometry, shaderMaterial);
        scene.add(mesh);

        // Render to offscreen canvas
        offscreenRenderer.render(scene, camera);

        // Create THREE.CanvasTexture from rendered canvas
        var texture = new THREE.CanvasTexture(offscreenCanvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // Cleanup
        geometry.dispose();
        offscreenRenderer.dispose();

        console.log("Baked shader texture: " + resolution + "×" + resolution +
                    " covering (" + width.toFixed(1) + "m × " + height.toFixed(1) + "m)");

        return {
            texture: texture,
            canvas: offscreenCanvas,
            uvBounds: {
                minU: bounds.minX,
                maxU: bounds.maxX,
                minV: bounds.minY,
                maxV: bounds.maxY
            }
        };
    }

    /**
     * Generate planar UV coordinates for surface vertices.
     * Top-down projection: X,Y world coords → U,V texture coords [0,1]
     *
     * @param {Array} points - Surface points [{x, y, z}, ...]
     * @param {Object} uvBounds - {minU, maxU, minV, maxV} world coordinate bounds
     * @returns {Float32Array} - UV coordinates [u0, v0, u1, v1, ...]
     */
    static generatePlanarUVs(points, uvBounds) {
        var uvs = new Float32Array(points.length * 2);
        var width = uvBounds.maxU - uvBounds.minU;
        var height = uvBounds.maxV - uvBounds.minV;

        for (var i = 0; i < points.length; i++) {
            var point = points[i];
            var u = (point.x - uvBounds.minU) / width;
            var v = (point.y - uvBounds.minV) / height;

            // Clamp to [0,1] to avoid texture sampling issues
            uvs[i * 2] = Math.max(0, Math.min(1, u));
            uvs[i * 2 + 1] = Math.max(0, Math.min(1, v));
        }

        return uvs;
    }

    /**
     * Apply baked texture to a surface mesh in the 3D scene.
     *
     * @param {THREE.Mesh} surfaceMesh - Existing surface mesh
     * @param {THREE.Texture} bakedTexture - Baked shader texture
     * @param {Object} surface - Surface object with points
     * @param {Object} uvBounds - UV coordinate bounds
     */
    static applyBakedTextureToMesh(surfaceMesh, bakedTexture, surface, uvBounds) {
        if (!surfaceMesh || !surfaceMesh.geometry) {
            console.error("Invalid surface mesh for texture application");
            return;
        }

        // Generate UV coordinates
        var uvs = this.generatePlanarUVs(surface.points, uvBounds);

        // Apply UVs to geometry
        surfaceMesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        // Create material with baked texture
        var material = new THREE.MeshBasicMaterial({
            map: bakedTexture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: surface.transparency || 1.0
        });

        surfaceMesh.material = material;
        surfaceMesh.material.needsUpdate = true;

        console.log("Applied baked texture to surface mesh with planar UVs");
    }

    /**
     * Render baked texture to 2D canvas.
     * Rasterizes texture using point-by-point lookup.
     *
     * @param {HTMLCanvasElement} canvas2D - Target 2D canvas
     * @param {CanvasRenderingContext2D} ctx2D - 2D canvas context
     * @param {Object} surface - Surface object with triangles and points
     * @param {HTMLCanvasElement} textureCanvas - Baked texture canvas
     * @param {Object} uvBounds - UV coordinate bounds
     * @param {Function} worldToCanvas - Transform function (worldX, worldY) => {x, y}
     */
    static renderBakedTextureTo2D(canvas2D, ctx2D, surface, textureCanvas, uvBounds, worldToCanvas) {
        if (!surface.triangles || !surface.points) {
            console.error("Surface missing triangles or points for 2D rendering");
            return;
        }

        var textureCtx = textureCanvas.getContext("2d");
        var textureData = textureCtx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
        var texWidth = textureCanvas.width;
        var texHeight = textureCanvas.height;

        var uvWidth = uvBounds.maxU - uvBounds.minU;
        var uvHeight = uvBounds.maxV - uvBounds.minV;

        // Draw each triangle with texture sampling
        for (var i = 0; i < surface.triangles.length; i++) {
            var tri = surface.triangles[i];

            // Handle multiple triangle formats
            var idx0, idx1, idx2;
            if (tri.vertices && Array.isArray(tri.vertices) && tri.vertices.length === 3) {
                // OBJ format: {vertices: [0, 1, 2]}
                idx0 = tri.vertices[0];
                idx1 = tri.vertices[1];
                idx2 = tri.vertices[2];
            } else if (tri.indices && Array.isArray(tri.indices)) {
                // Format: {indices: [0, 1, 2]}
                idx0 = tri.indices[0];
                idx1 = tri.indices[1];
                idx2 = tri.indices[2];
            } else if (tri.a !== undefined && tri.b !== undefined && tri.c !== undefined) {
                // Format: {a: 0, b: 1, c: 2}
                idx0 = tri.a;
                idx1 = tri.b;
                idx2 = tri.c;
            } else {
                continue;
            }

            var p0 = surface.points[idx0];
            var p1 = surface.points[idx1];
            var p2 = surface.points[idx2];

            if (!p0 || !p1 || !p2) continue;

            // Transform to canvas coordinates
            var c0 = worldToCanvas(p0.x, p0.y);
            var c1 = worldToCanvas(p1.x, p1.y);
            var c2 = worldToCanvas(p2.x, p2.y);

            // Calculate UVs for vertices
            var u0 = (p0.x - uvBounds.minU) / uvWidth;
            var v0 = (p0.y - uvBounds.minV) / uvHeight;
            var u1 = (p1.x - uvBounds.minU) / uvWidth;
            var v1 = (p1.y - uvBounds.minV) / uvHeight;
            var u2 = (p2.x - uvBounds.minU) / uvWidth;
            var v2 = (p2.y - uvBounds.minV) / uvHeight;

            // Sample texture at triangle centroid (simplified approach)
            var uCentroid = (u0 + u1 + u2) / 3;
            var vCentroid = (v0 + v1 + v2) / 3;

            var texX = Math.floor(uCentroid * texWidth);
            var texY = Math.floor(vCentroid * texHeight);

            // Clamp texture coordinates
            texX = Math.max(0, Math.min(texWidth - 1, texX));
            texY = Math.max(0, Math.min(texHeight - 1, texY));

            var pixelIndex = (texY * texWidth + texX) * 4;
            var r = textureData.data[pixelIndex];
            var g = textureData.data[pixelIndex + 1];
            var b = textureData.data[pixelIndex + 2];
            var a = textureData.data[pixelIndex + 3];

            // Skip fully transparent pixels
            if (a === 0) continue;

            // Draw triangle with sampled color
            ctx2D.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (a / 255) + ")";
            ctx2D.beginPath();
            ctx2D.moveTo(c0.x, c0.y);
            ctx2D.lineTo(c1.x, c1.y);
            ctx2D.lineTo(c2.x, c2.y);
            ctx2D.closePath();
            ctx2D.fill();
        }

        console.log("Rendered baked texture to 2D canvas (" + surface.triangles.length + " triangles)");
    }

    /**
     * Calculate bounding box of surface in world coordinates.
     *
     * @param {Object} surface - Surface with points array
     * @returns {Object} - {minX, maxX, minY, maxY, minZ, maxZ}
     * @private
     */
    static _calculateSurfaceBounds(surface) {
        if (!surface.points || surface.points.length === 0) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100, minZ: 0, maxZ: 0 };
        }

        var bounds = {
            minX: Infinity, maxX: -Infinity,
            minY: Infinity, maxY: -Infinity,
            minZ: Infinity, maxZ: -Infinity
        };

        for (var i = 0; i < surface.points.length; i++) {
            var p = surface.points[i];
            bounds.minX = Math.min(bounds.minX, p.x);
            bounds.maxX = Math.max(bounds.maxX, p.x);
            bounds.minY = Math.min(bounds.minY, p.y);
            bounds.maxY = Math.max(bounds.maxY, p.y);
            bounds.minZ = Math.min(bounds.minZ, p.z);
            bounds.maxZ = Math.max(bounds.maxZ, p.z);
        }

        return bounds;
    }

    /**
     * Build THREE.js BufferGeometry from surface triangles.
     *
     * @param {Object} surface - Surface with points and triangles
     * @param {number} originX - Three.js local origin X
     * @param {number} originY - Three.js local origin Y
     * @returns {THREE.BufferGeometry}
     * @private
     */
    static _buildSurfaceGeometry(surface, originX, originY) {
        var vertices = [];

        for (var i = 0; i < surface.triangles.length; i++) {
            var tri = surface.triangles[i];

            // Handle multiple triangle formats
            var idx0, idx1, idx2;
            if (tri.vertices && Array.isArray(tri.vertices) && tri.vertices.length === 3) {
                // OBJ format: {vertices: [0, 1, 2]}
                idx0 = tri.vertices[0];
                idx1 = tri.vertices[1];
                idx2 = tri.vertices[2];
            } else if (tri.indices && Array.isArray(tri.indices)) {
                // Format: {indices: [0, 1, 2]}
                idx0 = tri.indices[0];
                idx1 = tri.indices[1];
                idx2 = tri.indices[2];
            } else if (tri.a !== undefined && tri.b !== undefined && tri.c !== undefined) {
                // Format: {a: 0, b: 1, c: 2}
                idx0 = tri.a;
                idx1 = tri.b;
                idx2 = tri.c;
            } else {
                console.warn("ShaderTextureBaker: Invalid triangle format at index " + i);
                continue;
            }

            var p0 = surface.points[idx0];
            var p1 = surface.points[idx1];
            var p2 = surface.points[idx2];

            if (!p0 || !p1 || !p2) {
                console.warn("ShaderTextureBaker: Missing points for triangle " + i);
                continue;
            }

            // Transform to Three.js local space
            vertices.push(
                p0.x - originX, p0.y - originY, p0.z,
                p1.x - originX, p1.y - originY, p1.z,
                p2.x - originX, p2.y - originY, p2.z
            );
        }

        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();

        return geometry;
    }
}
