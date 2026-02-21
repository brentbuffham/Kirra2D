/**
 * SolidCSGHelper.js
 *
 * 3D CSG boolean operations on surface meshes using three-bvh-csg.
 * Operations: Union, Intersect, Subtract, Reverse Subtract, Difference (XOR).
 *
 * Grabs the actual Three.js meshes from the scene (surfaceMeshMap) to ensure
 * the geometry used for CSG exactly matches what's rendered.
 *
 * Includes undo/redo via AddSurfaceAction.
 */

import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, ADDITION, SUBTRACTION, REVERSE_SUBTRACTION, INTERSECTION, DIFFERENCE } from "three-bvh-csg";
import { AddSurfaceAction } from "../tools/UndoActions.js";
import { getOrCreateSurfaceLayer } from "./LayerHelper.js";

// ────────────────────────────────────────────────────────
// Operation constant mapping
// ────────────────────────────────────────────────────────

var OPERATION_MAP = {
	union: ADDITION,
	intersect: INTERSECTION,
	subtract: SUBTRACTION,
	reverseSubtract: REVERSE_SUBTRACTION,
	difference: DIFFERENCE
};

var OPERATION_LABELS = {
	union: "UNION",
	intersect: "INTERSECT",
	subtract: "SUBTRACT",
	reverseSubtract: "REV_SUBTRACT",
	difference: "DIFFERENCE"
};

var LAYER_NAMES = {
	union: "Unions",
	intersect: "Intersects",
	subtract: "Subtracts",
	reverseSubtract: "Subtracts",
	difference: "Differences"
};

// ────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────

/**
 * Execute a CSG boolean operation on two surfaces.
 *
 * @param {Object} config
 * @param {string} config.surfaceIdA  - ID of surface A in loadedSurfaces
 * @param {string} config.surfaceIdB  - ID of surface B in loadedSurfaces
 * @param {string} config.operation   - "union" | "intersect" | "subtract" | "reverseSubtract" | "difference"
 * @param {string} config.gradient    - Gradient for result surface
 * @returns {string | null} - Surface ID of result, or null on failure
 */
export function solidCSG(config) {
	var surfaceA = window.loadedSurfaces ? window.loadedSurfaces.get(config.surfaceIdA) : null;
	var surfaceB = window.loadedSurfaces ? window.loadedSurfaces.get(config.surfaceIdB) : null;

	if (!surfaceA || !surfaceB) {
		console.error("SolidCSGHelper: One or both surfaces not found");
		return null;
	}

	// Step 1) Build Brush from each surface's scene mesh
	var brushA = sceneMeshToBrush(config.surfaceIdA);
	var brushB = sceneMeshToBrush(config.surfaceIdB);

	if (!brushA || !brushB) {
		console.error("SolidCSGHelper: Failed to create brush from scene mesh");
		return null;
	}

	// Step 2) Look up the three-bvh-csg operation constant
	var opConstant = OPERATION_MAP[config.operation];
	if (opConstant === undefined) {
		console.error("SolidCSGHelper: Unknown operation: " + config.operation);
		return null;
	}

	// Step 3) Perform CSG via Evaluator
	var evaluator = new Evaluator();
	evaluator.attributes = ["position", "normal"];
	evaluator.useGroups = false;
	var result;
	try {
		result = evaluator.evaluate(brushA, brushB, opConstant);
	} catch (err) {
		console.error("SolidCSGHelper: CSG operation failed:", err);
		return null;
	}

	// Step 4) Extract geometry from result
	var resultGeometry = result.geometry;
	if (!resultGeometry || !resultGeometry.attributes || !resultGeometry.attributes.position) {
		console.error("SolidCSGHelper: Result has no geometry");
		return null;
	}

	// Diagnostics
	var posCount = resultGeometry.attributes.position.count;
	var idxCount = resultGeometry.index ? resultGeometry.index.count : 0;
	console.log("SolidCSGHelper: Result: " + posCount + " verts, " +
		(idxCount ? (idxCount / 3) + " indexed tris" : (posCount / 3) + " non-indexed tris"));

	// Step 5) Extract world-coordinate points and triangles from result
	var positions = resultGeometry.attributes.position.array;
	var index = resultGeometry.index ? resultGeometry.index.array : null;
	var worldPoints = [];
	var triangles = [];

	// Result positions are in Three.js local coords — convert back to world
	for (var i = 0; i < positions.length; i += 3) {
		var world = window.threeLocalToWorld(positions[i], positions[i + 1]);
		worldPoints.push({
			x: world.x,
			y: world.y,
			z: positions[i + 2]
		});
	}

	// Build triangles in saveSurfaceToDB format
	if (index) {
		for (var t = 0; t < index.length; t += 3) {
			triangles.push({
				vertices: [
					{ x: worldPoints[index[t]].x, y: worldPoints[index[t]].y, z: worldPoints[index[t]].z },
					{ x: worldPoints[index[t + 1]].x, y: worldPoints[index[t + 1]].y, z: worldPoints[index[t + 1]].z },
					{ x: worldPoints[index[t + 2]].x, y: worldPoints[index[t + 2]].y, z: worldPoints[index[t + 2]].z }
				]
			});
		}
	} else {
		for (var p = 0; p < worldPoints.length; p += 3) {
			triangles.push({
				vertices: [
					{ x: worldPoints[p].x, y: worldPoints[p].y, z: worldPoints[p].z },
					{ x: worldPoints[p + 1].x, y: worldPoints[p + 1].y, z: worldPoints[p + 1].z },
					{ x: worldPoints[p + 2].x, y: worldPoints[p + 2].y, z: worldPoints[p + 2].z }
				]
			});
		}
	}

	if (triangles.length === 0) {
		console.warn("SolidCSGHelper: Operation produced no triangles");
		return null;
	}

	// Step 6) Compute bounds
	var bounds = computeBounds(worldPoints);

	// Step 7) Create surface object
	var shortId = Math.random().toString(36).substring(2, 6);
	var opPrefix = OPERATION_LABELS[config.operation] || "CSG";
	var layerName = LAYER_NAMES[config.operation] || "CSG Results";
	var surfaceId = opPrefix + "_" + shortId;
	var layerId = getOrCreateSurfaceLayer(layerName);

	var surface = {
		id: surfaceId,
		name: surfaceId,
		layerId: layerId,
		type: "triangulated",
		points: worldPoints,
		triangles: triangles,
		visible: true,
		gradient: config.gradient || "default",
		transparency: 1.0,
		meshBounds: bounds,
		isTexturedMesh: false
	};

	// Step 8) Store and persist
	window.loadedSurfaces.set(surfaceId, surface);

	// Step 8a) Add to layer's entity set
	var layer = window.allSurfaceLayers ? window.allSurfaceLayers.get(layerId) : null;
	if (layer && layer.entities) layer.entities.add(surfaceId);

	if (typeof window.saveSurfaceToDB === "function") {
		window.saveSurfaceToDB(surfaceId).catch(function (err) {
			console.error("Failed to save CSG result surface:", err);
		});
	}

	// Step 9) Undo support
	if (window.undoManager) {
		var action = new AddSurfaceAction(surface);
		window.undoManager.pushAction(action);
	}

	// Step 10) Trigger redraw
	window.threeKADNeedsRebuild = true;
	if (typeof window.drawData === "function") {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}
	if (typeof window.debouncedUpdateTreeView === "function") {
		window.debouncedUpdateTreeView();
	}

	// Step 11) Clean up temp geometry (only the clones we made, not the scene meshes)
	brushA.geometry.dispose();
	brushB.geometry.dispose();
	resultGeometry.dispose();

	console.log("CSG " + opPrefix + " complete: " + surfaceId + " (" + triangles.length + " triangles)");
	return surfaceId;
}

// ────────────────────────────────────────────────────────
// Internal utilities
// ────────────────────────────────────────────────────────

/**
 * Get the actual Three.js mesh from the scene for a surface and convert to a Brush.
 * This uses the exact geometry that's already rendering correctly on screen.
 */
function sceneMeshToBrush(surfaceId) {
	var tr = window.threeRenderer;
	if (!tr || !tr.surfaceMeshMap) {
		console.error("SolidCSGHelper: ThreeRenderer or surfaceMeshMap not available");
		return null;
	}

	var sceneMesh = tr.surfaceMeshMap.get(surfaceId);
	if (!sceneMesh) {
		console.error("SolidCSGHelper: No scene mesh found for " + surfaceId);
		return null;
	}

	// Collect all positions from the scene mesh (may be a Group with child meshes)
	var allPositions = [];
	sceneMesh.traverse(function (child) {
		if (child.isMesh && child.geometry && child.geometry.attributes.position) {
			var geo = child.geometry;
			var posAttr = geo.attributes.position;
			var idx = geo.index;

			if (idx) {
				// Indexed geometry — read via indices
				for (var i = 0; i < idx.count; i++) {
					var vi = idx.getX(i);
					allPositions.push(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi));
				}
			} else {
				// Non-indexed — read sequentially
				for (var i = 0; i < posAttr.count; i++) {
					allPositions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
				}
			}
		}
	});

	if (allPositions.length === 0) {
		console.error("SolidCSGHelper: Scene mesh has no position data for " + surfaceId);
		return null;
	}

	// Build a clean position-only geometry, then merge to indexed
	var geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(allPositions, 3));

	// mergeVertices creates indexed geometry with shared vertices
	geometry = mergeVertices(geometry, 1e-4);
	geometry.computeVertexNormals();

	var posCount = geometry.attributes.position.count;
	var triCount = geometry.index ? geometry.index.count / 3 : posCount / 3;
	console.log("SolidCSGHelper: Brush for '" + surfaceId + "': " +
		posCount + " unique verts, " + triCount + " tris, indexed=" + !!geometry.index);

	var brush = new Brush(geometry);
	brush.updateMatrixWorld();

	return brush;
}

/**
 * Compute axis-aligned bounding box.
 */
function computeBounds(points) {
	var minX = Infinity, minY = Infinity, minZ = Infinity;
	var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

	for (var i = 0; i < points.length; i++) {
		var p = points[i];
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.z < minZ) minZ = p.z;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
		if (p.z > maxZ) maxZ = p.z;
	}

	return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ };
}
