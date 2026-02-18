// src/helpers/ShaderTextureBaker.js
import * as THREE from "three";

/**
 * ShaderTextureBaker renders blast analysis shaders to offscreen canvas
 * and generates UV-mapped textures for persistent surface visualization.
 *
 * Key Features:
 * - Offscreen rendering to 2048×2048 canvas (configurable)
 * - Adaptive camera orientation based on surface normal
 * - Projection basis for non-horizontal surfaces
 * - Creates THREE.CanvasTexture for 3D rendering
 * - Stores canvas for 2D rendering
 * - Handles coordinate transformations
 */
export class ShaderTextureBaker {

    /**
     * Bake a blast analysis shader to a texture.
     *
     * For horizontal surfaces, the camera looks straight down (Z-down) — same as before.
     * For non-horizontal surfaces, the camera is oriented along the surface normal so
     * the bake captures the surface extent correctly.
     *
     * @param {Object} surface - Surface object with points array
     * @param {THREE.ShaderMaterial} shaderMaterial - Configured shader material
     * @param {Object} options - { resolution: 2048, padding: 10 }
     * @returns {Object} - { texture, canvas, uvBounds, projectionBasis, surfaceNormal, center3D }
     */
    static bakeShaderToTexture(surface, shaderMaterial, options) {
        options = options || {};
        var resolution = options.resolution || 2048;
        var padding = options.padding || 10; // meters of padding around surface

        // Calculate surface bounds in world coordinates
        var bounds = this._calculateSurfaceBounds(surface);

        // Compute surface normal for routing decisions (returned to caller)
        var normalInfo = this._computeSurfaceNormal(surface);
        var basis = this._buildProjectionBasis(normalInfo.normal);

        // Center point in world coordinates — used to avoid float32 precision loss
        // UTM coords like 500000, 6000000 exceed Float32 precision (~7 digits).
        var centerX = (bounds.minX + bounds.maxX) / 2;
        var centerY = (bounds.minY + bounds.maxY) / 2;
        var centerZ = (bounds.minZ + bounds.maxZ) / 2;

        // Always add padding to XY bounds
        bounds.minX -= padding;
        bounds.maxX += padding;
        bounds.minY -= padding;
        bounds.maxY += padding;

        var width = bounds.maxX - bounds.minX;
        var height = bounds.maxY - bounds.minY;

        // Bake always uses top-down (Z-down) orthographic camera.
        // This produces the correct XY-planar projection for 2D canvas rendering.
        // For non-horizontal surfaces, the 3D view uses a direct ShaderMaterial
        // instead of this baked texture (see BlastAnalysisShaderHelper).

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

        // Create orthographic camera — always top-down in LOCAL space
        var halfW = width / 2;
        var halfH = height / 2;
        var camera = new THREE.OrthographicCamera(
            -halfW, halfW,   // left, right
            halfH, -halfH,   // top, bottom (Y inverted for texture space)
            -1000, 1000      // near, far
        );
        camera.position.set(0, 0, 500);
        camera.lookAt(0, 0, 0);

        // Create scene with shader mesh
        var scene = new THREE.Scene();

        // Build mesh in LOCAL space (centered around bounds center, including Z)
        var geometry = this._buildSurfaceGeometry(surface, centerX, centerY, centerZ);

        // Set uWorldOffset so the shader reconstructs world positions:
        // vWorldPos = localPos + uWorldOffset = (worldPos - center) + center = worldPos
        if (shaderMaterial.uniforms && shaderMaterial.uniforms.uWorldOffset) {
            shaderMaterial.uniforms.uWorldOffset.value.set(centerX, centerY, centerZ);
        }

        var mesh = new THREE.Mesh(geometry, shaderMaterial);
        scene.add(mesh);

        // Render to offscreen WebGL canvas
        offscreenRenderer.render(scene, camera);

        // Copy WebGL result to a standard 2D canvas
        // (WebGL canvas can't get a 2D context — needed for 2D rendering + getImageData)
        var canvas2D = document.createElement("canvas");
        canvas2D.width = resolution;
        canvas2D.height = resolution;
        var ctx2D = canvas2D.getContext("2d");
        ctx2D.drawImage(offscreenCanvas, 0, 0);

        // Create texture from the 2D canvas copy
        var texture = new THREE.CanvasTexture(canvas2D);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // Cleanup WebGL resources
        geometry.dispose();
        offscreenRenderer.dispose();

        console.log("Baked shader texture: " + resolution + "×" + resolution +
                    " covering (" + width.toFixed(1) + "m × " + height.toFixed(1) + "m)" +
                    (normalInfo.isHorizontal ? " [horizontal]" : " [non-horizontal]"));

        return {
            texture: texture,
            canvas: canvas2D,
            uvBounds: {
                minU: bounds.minX,
                maxU: bounds.maxX,
                minV: bounds.minY,
                maxV: bounds.maxY
            },
            projectionBasis: basis,
            surfaceNormal: normalInfo.normal,
            center3D: { x: centerX, y: centerY, z: centerZ },
            isHorizontal: normalInfo.isHorizontal,
            isVertical: normalInfo.isVertical
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
     * Generate projection-basis UV coordinates for surface vertices.
     * Projects vertices onto the tangent/bitangent plane for non-horizontal surfaces.
     *
     * @param {Array} points - Surface points [{x, y, z}, ...]
     * @param {Object} center - {x, y, z} center of surface
     * @param {Object} basis - { tangent, bitangent, normal } from _buildProjectionBasis
     * @param {number} width - Projected width (maxU - minU)
     * @param {number} height - Projected height (maxV - minV)
     * @param {number} minU - Minimum U in projected space
     * @param {number} minV - Minimum V in projected space
     * @returns {Float32Array} - UV coordinates [u0, v0, u1, v1, ...]
     */
    static generateBasisUVs(points, center, basis, width, height, minU, minV) {
        var uvs = new Float32Array(points.length * 2);
        var t = basis.tangent;
        var b = basis.bitangent;

        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            var dx = p.x - center.x;
            var dy = p.y - center.y;
            var dz = p.z - center.z;

            // Project onto tangent/bitangent
            var projU = dx * t.x + dy * t.y + dz * t.z;
            var projV = dx * b.x + dy * b.y + dz * b.z;

            var u = (projU - minU) / width;
            var v = (projV - minV) / height;

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
            var verts = this._resolveTriangleVertices(tri, surface.points);
            if (!verts) continue;

            var p0 = verts[0], p1 = verts[1], p2 = verts[2];

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
     * Compute area-weighted average normal of a surface.
     *
     * @param {Object} surface - Surface with points and triangles
     * @returns {Object} - { normal: {x,y,z}, isHorizontal, isVertical }
     */
    static _computeSurfaceNormal(surface) {
        if (!surface.triangles || surface.triangles.length === 0 || !surface.points) {
            return { normal: { x: 0, y: 0, z: 1 }, isHorizontal: true, isVertical: false };
        }

        var nx = 0, ny = 0, nz = 0;

        for (var i = 0; i < surface.triangles.length; i++) {
            var tri = surface.triangles[i];
            var verts = this._resolveTriangleVertices(tri, surface.points);
            if (!verts) continue;

            var p0 = verts[0], p1 = verts[1], p2 = verts[2];

            // Edge vectors
            var e1x = p1.x - p0.x, e1y = p1.y - p0.y, e1z = p1.z - p0.z;
            var e2x = p2.x - p0.x, e2y = p2.y - p0.y, e2z = p2.z - p0.z;

            // Cross product (area-weighted normal)
            nx += e1y * e2z - e1z * e2y;
            ny += e1z * e2x - e1x * e2z;
            nz += e1x * e2y - e1y * e2x;
        }

        // Normalize
        var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 1e-10) {
            return { normal: { x: 0, y: 0, z: 1 }, isHorizontal: true, isVertical: false };
        }
        nx /= len;
        ny /= len;
        nz /= len;

        // Ensure normal points "upward" (positive Z component) for consistency
        if (nz < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
        }

        var absNz = Math.abs(nz);
        var isHorizontal = absNz > 0.95;   // Nearly flat
        var isVertical = absNz < 0.05;      // Nearly vertical

        return {
            normal: { x: nx, y: ny, z: nz },
            isHorizontal: isHorizontal,
            isVertical: isVertical
        };
    }

    /**
     * Resolve triangle vertices from multiple storage formats.
     * Shared helper to replace duplicated vertex resolution blocks.
     *
     * @param {Object} tri - Triangle object (may have .a/.b/.c, .indices, or .vertices)
     * @param {Array} points - Surface points array
     * @returns {Array|null} - [p0, p1, p2] or null if unresolvable
     */
    static _resolveTriangleVertices(tri, points) {
        var p0, p1, p2;

        if (tri.a !== undefined && tri.b !== undefined && tri.c !== undefined) {
            p0 = points[tri.a];
            p1 = points[tri.b];
            p2 = points[tri.c];
        } else if (tri.indices && Array.isArray(tri.indices)) {
            p0 = points[tri.indices[0]];
            p1 = points[tri.indices[1]];
            p2 = points[tri.indices[2]];
        } else if (tri.vertices && Array.isArray(tri.vertices) && tri.vertices.length === 3) {
            if (typeof tri.vertices[0] === "object") {
                p0 = tri.vertices[0];
                p1 = tri.vertices[1];
                p2 = tri.vertices[2];
            } else {
                p0 = points[tri.vertices[0]];
                p1 = points[tri.vertices[1]];
                p2 = points[tri.vertices[2]];
            }
        } else {
            return null;
        }

        if (!p0 || !p1 || !p2) return null;
        return [p0, p1, p2];
    }

    /**
     * Build orthonormal tangent/bitangent/normal basis from a surface normal.
     *
     * For horizontal surfaces (normal ≈ [0,0,1]):
     *   tangent = [1,0,0] (X/East), bitangent = [0,1,0] (Y/North)
     *
     * For other surfaces, uses Gram-Schmidt to find tangent in the surface plane.
     *
     * @param {Object} normal - {x, y, z} unit normal
     * @returns {Object} - { tangent: {x,y,z}, bitangent: {x,y,z}, normal: {x,y,z} }
     */
    static _buildProjectionBasis(normal) {
        var nx = normal.x, ny = normal.y, nz = normal.z;

        // Choose a reference vector not parallel to the normal
        var refX, refY, refZ;
        if (Math.abs(nz) > 0.9) {
            // Normal is near-vertical — use Y as reference
            refX = 0; refY = 1; refZ = 0;
        } else {
            // Normal is tilted — use Z as reference
            refX = 0; refY = 0; refZ = 1;
        }

        // Tangent = normalize(ref - (ref·n)n)  (Gram-Schmidt)
        var dot = refX * nx + refY * ny + refZ * nz;
        var tx = refX - dot * nx;
        var ty = refY - dot * ny;
        var tz = refZ - dot * nz;
        var tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
        tx /= tLen; ty /= tLen; tz /= tLen;

        // Bitangent = normal × tangent
        var bx = ny * tz - nz * ty;
        var by = nz * tx - nx * tz;
        var bz = nx * ty - ny * tx;

        return {
            tangent: { x: tx, y: ty, z: tz },
            bitangent: { x: bx, y: by, z: bz },
            normal: { x: nx, y: ny, z: nz }
        };
    }

    /**
     * Project surface points onto a 2D basis and return bounds.
     *
     * @param {Array} points - [{x, y, z}, ...]
     * @param {Object} center - {x, y, z} center of projection
     * @param {Object} basis - { tangent, bitangent, normal }
     * @returns {Object} - { minU, maxU, minV, maxV }
     */
    static _projectPointsToBasis(points, center, basis) {
        var t = basis.tangent;
        var b = basis.bitangent;
        var minU = Infinity, maxU = -Infinity;
        var minV = Infinity, maxV = -Infinity;

        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            var dx = p.x - center.x;
            var dy = p.y - center.y;
            var dz = p.z - center.z;

            var u = dx * t.x + dy * t.y + dz * t.z;
            var v = dx * b.x + dy * b.y + dz * b.z;

            if (u < minU) minU = u;
            if (u > maxU) maxU = u;
            if (v < minV) minV = v;
            if (v > maxV) maxV = v;
        }

        return { minU: minU, maxU: maxU, minV: minV, maxV: maxV };
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
     * @param {number} centerX - Center X to subtract (for float precision)
     * @param {number} centerY - Center Y to subtract (for float precision)
     * @param {number} centerZ - Center Z to subtract (for float precision)
     * @returns {THREE.BufferGeometry}
     * @private
     */
    static _buildSurfaceGeometry(surface, centerX, centerY, centerZ) {
        centerX = centerX || 0;
        centerY = centerY || 0;
        centerZ = centerZ || 0;
        var vertices = [];

        for (var i = 0; i < surface.triangles.length; i++) {
            var tri = surface.triangles[i];
            var verts = this._resolveTriangleVertices(tri, surface.points);
            if (!verts) continue;

            // Local space — subtract center to keep coords small for Float32
            // Shader reconstructs world positions via uWorldOffset
            vertices.push(
                verts[0].x - centerX, verts[0].y - centerY, verts[0].z - centerZ,
                verts[1].x - centerX, verts[1].y - centerY, verts[1].z - centerZ,
                verts[2].x - centerX, verts[2].y - centerY, verts[2].z - centerZ
            );
        }

        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();

        return geometry;
    }
}
