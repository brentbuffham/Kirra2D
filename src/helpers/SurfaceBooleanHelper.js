/**
 * SurfaceBooleanHelper.js
 *
 * Interactive split-and-pick surface boolean (Vulcan TRIBOOL style).
 * Uses Moller tri-tri intersection to SPLIT straddling triangles at the
 * actual intersection boundary, then classifies sub-triangles by their
 * signed distance to the other surface's plane.
 *
 * Non-intersected triangles are classified by centroid Z vs the other surface.
 */

import * as THREE from "three";
import { AddSurfaceAction } from "../tools/UndoActions.js";
import {
	extractTriangles as ixExtractTriangles,
	estimateAvgEdge as ixEstimateAvgEdge,
	buildSpatialGrid as ixBuildSpatialGrid,
	queryGrid as ixQueryGrid,
	triBBox as ixTriBBox,
	triTriIntersectionDetailed,
	triNormal as ixTriNormal
} from "./SurfaceIntersectionHelper.js";

// ────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────

/**
 * Compute split groups for two surfaces using Moller intersection + triangle splitting.
 *
 * @param {string} surfaceIdA - First surface ID
 * @param {string} surfaceIdB - Second surface ID
 * @returns {Object|null} { splits: [{id, surfaceId, label, triangles, color, kept}], surfaceIdA, surfaceIdB }
 */
export function computeSplits(surfaceIdA, surfaceIdB) {
	var surfaceA = window.loadedSurfaces ? window.loadedSurfaces.get(surfaceIdA) : null;
	var surfaceB = window.loadedSurfaces ? window.loadedSurfaces.get(surfaceIdB) : null;

	if (!surfaceA || !surfaceB) {
		console.error("SurfaceBooleanHelper: One or both surfaces not found");
		return null;
	}

	// Step 1) Extract triangles
	var trisA = ixExtractTriangles(surfaceA);
	var trisB = ixExtractTriangles(surfaceB);

	if (trisA.length === 0 || trisB.length === 0) {
		console.error("SurfaceBooleanHelper: One or both surfaces have no triangles");
		return null;
	}

	// Step 2) Build spatial grids
	var avgEdgeA = ixEstimateAvgEdge(trisA);
	var avgEdgeB = ixEstimateAvgEdge(trisB);
	var cellSizeA = Math.max(avgEdgeA * 2, 0.1);
	var cellSizeB = Math.max(avgEdgeB * 2, 0.1);
	var gridA = ixBuildSpatialGrid(trisA, cellSizeA);
	var gridB = ixBuildSpatialGrid(trisB, cellSizeB);

	// ──────────────────────────────────────────────────
	// Phase A: Find all intersecting triangle pairs
	// ──────────────────────────────────────────────────
	// splitMapA[i] = best record for triangle A_i (longest intersection segment)
	// splitMapB[j] = best record for triangle B_j
	var splitMapA = {};
	var splitMapB = {};

	for (var i = 0; i < trisA.length; i++) {
		var triA = trisA[i];
		var bbA = ixTriBBox(triA);
		var candidates = ixQueryGrid(gridB, bbA, cellSizeB);

		for (var c = 0; c < candidates.length; c++) {
			var j = candidates[c];
			var triB = trisB[j];

			var record = triTriIntersectionDetailed(triA, triB);
			if (!record) continue;

			// Keep the record with the longest segment for each triangle
			if (!splitMapA[i] || record.segLen > splitMapA[i].segLen) {
				splitMapA[i] = { dA: record.dA, segLen: record.segLen };
			}
			if (!splitMapB[j] || record.segLen > splitMapB[j].segLen) {
				splitMapB[j] = { dB: record.dB, segLen: record.segLen };
			}
		}
	}

	// ──────────────────────────────────────────────────
	// Phase B: Split intersected triangles + classify all
	// ──────────────────────────────────────────────────
	var aAbove = [];
	var aBelow = [];
	var aOutside = [];

	for (var ia = 0; ia < trisA.length; ia++) {
		if (splitMapA[ia]) {
			// This triangle straddles the intersection — split it
			var subTris = splitTriangleByDistances(trisA[ia], splitMapA[ia].dA);
			for (var st = 0; st < subTris.length; st++) {
				if (subTris[st].sign > 0) {
					aAbove.push(subTris[st].tri);
				} else {
					aBelow.push(subTris[st].tri);
				}
			}
		} else {
			// Non-intersected triangle — classify by centroid
			var cA = triCentroid(trisA[ia]);
			var zB = interpolateZAtPoint(cA.x, cA.y, trisB, gridB, cellSizeB);
			if (zB === null) {
				aOutside.push(trisA[ia]);
			} else if (cA.z >= zB) {
				aAbove.push(trisA[ia]);
			} else {
				aBelow.push(trisA[ia]);
			}
		}
	}

	var bAbove = [];
	var bBelow = [];
	var bOutside = [];

	for (var ib = 0; ib < trisB.length; ib++) {
		if (splitMapB[ib]) {
			// This triangle straddles the intersection — split it
			var subTrisB = splitTriangleByDistances(trisB[ib], splitMapB[ib].dB);
			for (var stb = 0; stb < subTrisB.length; stb++) {
				if (subTrisB[stb].sign > 0) {
					bAbove.push(subTrisB[stb].tri);
				} else {
					bBelow.push(subTrisB[stb].tri);
				}
			}
		} else {
			// Non-intersected triangle — classify by centroid
			var cB = triCentroid(trisB[ib]);
			var zA = interpolateZAtPoint(cB.x, cB.y, trisA, gridA, cellSizeA);
			if (zA === null) {
				bOutside.push(trisB[ib]);
			} else if (cB.z >= zA) {
				bAbove.push(trisB[ib]);
			} else {
				bBelow.push(trisB[ib]);
			}
		}
	}

	console.log("Surface Boolean classification: " +
		"A=[" + aAbove.length + " above, " + aBelow.length + " below, " +
		aOutside.length + " outside] " +
		"B=[" + bAbove.length + " above, " + bBelow.length + " below, " +
		bOutside.length + " outside] " +
		"(total A=" + trisA.length + ", B=" + trisB.length + ", " +
		"split A=" + Object.keys(splitMapA).length + ", split B=" + Object.keys(splitMapB).length + ")");

	// ──────────────────────────────────────────────────
	// Phase C: Build split groups (only non-empty)
	// ──────────────────────────────────────────────────
	var splits = [];
	var nameA = surfaceA.name || surfaceIdA;
	var nameB = surfaceB.name || surfaceIdB;

	if (aAbove.length > 0) {
		splits.push({
			id: "A_above",
			surfaceId: surfaceIdA,
			label: nameA + " (above B)",
			triangles: aAbove,
			color: "#FF0000",
			kept: true
		});
	}
	if (aBelow.length > 0) {
		splits.push({
			id: "A_below",
			surfaceId: surfaceIdA,
			label: nameA + " (below B)",
			triangles: aBelow,
			color: "#FFFF00",
			kept: true
		});
	}
	if (aOutside.length > 0) {
		splits.push({
			id: "A_outside",
			surfaceId: surfaceIdA,
			label: nameA + " (outside)",
			triangles: aOutside,
			color: "#FF00FF",
			kept: true
		});
	}
	if (bAbove.length > 0) {
		splits.push({
			id: "B_above",
			surfaceId: surfaceIdB,
			label: nameB + " (above A)",
			triangles: bAbove,
			color: "#00FF00",
			kept: true
		});
	}
	if (bBelow.length > 0) {
		splits.push({
			id: "B_below",
			surfaceId: surfaceIdB,
			label: nameB + " (below A)",
			triangles: bBelow,
			color: "#0099FF",
			kept: true
		});
	}
	if (bOutside.length > 0) {
		splits.push({
			id: "B_outside",
			surfaceId: surfaceIdB,
			label: nameB + " (outside)",
			triangles: bOutside,
			color: "#009900",
			kept: true
		});
	}

	if (splits.length === 0) {
		console.warn("SurfaceBooleanHelper: No overlap found between surfaces");
		return null;
	}

	console.log("Surface Boolean: " + splits.length + " split groups created");

	return {
		splits: splits,
		surfaceIdA: surfaceIdA,
		surfaceIdB: surfaceIdB
	};
}

// ────────────────────────────────────────────────────────
// Phase B: Split a triangle using signed distances to the other surface's plane
// ────────────────────────────────────────────────────────

/**
 * Split a triangle into sub-triangles based on signed distances [d0, d1, d2]
 * of its vertices to the other surface's plane.
 *
 * Returns array of { tri: {v0,v1,v2}, sign: +1 or -1 }
 * where sign indicates which side of the plane.
 *
 * If all vertices are on the same side (shouldn't happen if called correctly),
 * returns the whole triangle with that sign.
 */
function splitTriangleByDistances(tri, dists) {
	var d0 = dists[0], d1 = dists[1], d2 = dists[2];
	var verts = [tri.v0, tri.v1, tri.v2];
	var ds = [d0, d1, d2];

	// Use a small tolerance to decide if a vertex is "on" the plane
	var EPS = 1e-8;

	// Count vertices on each side
	var pos = 0, neg = 0, zero = 0;
	for (var i = 0; i < 3; i++) {
		if (ds[i] > EPS) pos++;
		else if (ds[i] < -EPS) neg++;
		else zero++;
	}

	// All on one side (or on the plane) — no split needed
	if (neg === 0) {
		return [{ tri: tri, sign: 1 }];
	}
	if (pos === 0) {
		return [{ tri: tri, sign: -1 }];
	}

	// Find the "lone" vertex (the one on the opposite side from the other two)
	// lone vertex has a different sign from the majority
	var loneIdx = -1;
	if (pos === 1) {
		// One positive, two negative (or one negative + one zero)
		for (var ip = 0; ip < 3; ip++) {
			if (ds[ip] > EPS) { loneIdx = ip; break; }
		}
	} else if (neg === 1) {
		// One negative, two positive (or one positive + one zero)
		for (var in2 = 0; in2 < 3; in2++) {
			if (ds[in2] < -EPS) { loneIdx = in2; break; }
		}
	}

	if (loneIdx === -1) {
		// Edge case: shouldn't happen, return whole triangle
		return [{ tri: tri, sign: d0 + d1 + d2 >= 0 ? 1 : -1 }];
	}

	var nextIdx = (loneIdx + 1) % 3;
	var prevIdx = (loneIdx + 2) % 3;

	var vLone = verts[loneIdx];
	var vNext = verts[nextIdx];
	var vPrev = verts[prevIdx];

	var dLone = ds[loneIdx];
	var dNext = ds[nextIdx];
	var dPrev = ds[prevIdx];

	// Compute edge-crossing points
	var tLoneNext = dLone / (dLone - dNext);
	var pLoneNext = lerpVert(vLone, vNext, tLoneNext);

	var tLonePrev = dLone / (dLone - dPrev);
	var pLonePrev = lerpVert(vLone, vPrev, tLonePrev);

	var loneSign = dLone > 0 ? 1 : -1;
	var otherSign = -loneSign;

	// Lone side: 1 triangle
	var loneTri = { v0: vLone, v1: pLoneNext, v2: pLonePrev };

	// Other side: 2 triangles (quad split)
	var otherTri1 = { v0: pLoneNext, v1: vNext, v2: vPrev };
	var otherTri2 = { v0: pLoneNext, v1: vPrev, v2: pLonePrev };

	return [
		{ tri: loneTri, sign: loneSign },
		{ tri: otherTri1, sign: otherSign },
		{ tri: otherTri2, sign: otherSign }
	];
}

/**
 * Linearly interpolate between two vertices.
 */
function lerpVert(a, b, t) {
	return {
		x: a.x + t * (b.x - a.x),
		y: a.y + t * (b.y - a.y),
		z: a.z + t * (b.z - a.z)
	};
}

// ────────────────────────────────────────────────────────
// Centroid classification for non-intersected triangles
// ────────────────────────────────────────────────────────

function triCentroid(tri) {
	return {
		x: (tri.v0.x + tri.v1.x + tri.v2.x) / 3,
		y: (tri.v0.y + tri.v1.y + tri.v2.y) / 3,
		z: (tri.v0.z + tri.v1.z + tri.v2.z) / 3
	};
}

/**
 * 2D point-in-triangle test using barycentric coordinates (XY only).
 */
function pointInTriangle2D(px, py, tri) {
	var ax = tri.v0.x, ay = tri.v0.y;
	var bx = tri.v1.x, by = tri.v1.y;
	var cx = tri.v2.x, cy = tri.v2.y;

	var denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
	if (Math.abs(denom) < 1e-12) return false;

	var u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom;
	var v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom;
	var w = 1 - u - v;

	return u >= -1e-8 && v >= -1e-8 && w >= -1e-8;
}

/**
 * Interpolate Z at point (px, py) on a triangle using barycentric coordinates.
 */
function interpolateZOnTriangle(px, py, tri) {
	var ax = tri.v0.x, ay = tri.v0.y, az = tri.v0.z;
	var bx = tri.v1.x, by = tri.v1.y, bz = tri.v1.z;
	var cx = tri.v2.x, cy = tri.v2.y, cz = tri.v2.z;

	var denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
	if (Math.abs(denom) < 1e-12) return (az + bz + cz) / 3;

	var u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom;
	var v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom;
	var w = 1 - u - v;

	return u * az + v * bz + w * cz;
}

/**
 * Find the Z of the other surface at (px, py) using spatial grid lookup.
 * Returns interpolated Z or null if outside.
 */
function interpolateZAtPoint(px, py, tris, grid, cellSize) {
	var candidates = ixQueryGrid(grid, { minX: px, maxX: px, minY: py, maxY: py }, cellSize);

	for (var c = 0; c < candidates.length; c++) {
		var tri = tris[candidates[c]];
		if (pointInTriangle2D(px, py, tri)) {
			return interpolateZOnTriangle(px, py, tri);
		}
	}

	return null;
}

// ────────────────────────────────────────────────────────
// Public: Preview mesh creation (unchanged)
// ────────────────────────────────────────────────────────

/**
 * Create 3D preview meshes for split groups.
 */
export function createSplitPreviewMeshes(splits) {
	var group = new THREE.Group();
	group.name = "surfaceBooleanPreview";
	group.userData = { isPreview: true };

	for (var s = 0; s < splits.length; s++) {
		var split = splits[s];
		var mesh = trianglesToMesh(split.triangles, split.color, split.kept);
		mesh.name = "split_" + split.id;
		mesh.userData = {
			splitId: split.id,
			splitIndex: s,
			isPreview: true
		};
		group.add(mesh);
	}

	return group;
}

/**
 * Update a split mesh's visibility/appearance based on kept state.
 */
export function updateSplitMeshAppearance(mesh, kept) {
	if (!mesh || !mesh.material) return;
	if (kept) {
		mesh.material.opacity = 0.6;
		mesh.material.color.set(mesh.userData.originalColor || "#4488FF");
		mesh.visible = true;
	} else {
		mesh.material.opacity = 0.15;
		mesh.material.color.set("#444444");
		mesh.visible = true;
	}
	mesh.material.needsUpdate = true;
}

/**
 * Merge kept splits into a new surface and store it.
 */
export function applyMerge(splits, config) {
	var keptTriangles = [];
	for (var s = 0; s < splits.length; s++) {
		if (splits[s].kept) {
			for (var t = 0; t < splits[s].triangles.length; t++) {
				keptTriangles.push(splits[s].triangles[t]);
			}
		}
	}

	if (keptTriangles.length === 0) {
		console.warn("SurfaceBooleanHelper: No triangles kept");
		return null;
	}

	// Convert to surface format
	var worldPoints = [];
	var triangles = [];

	for (var i = 0; i < keptTriangles.length; i++) {
		var tri = keptTriangles[i];
		worldPoints.push(
			{ x: tri.v0.x, y: tri.v0.y, z: tri.v0.z },
			{ x: tri.v1.x, y: tri.v1.y, z: tri.v1.z },
			{ x: tri.v2.x, y: tri.v2.y, z: tri.v2.z }
		);
		triangles.push({
			vertices: [
				{ x: tri.v0.x, y: tri.v0.y, z: tri.v0.z },
				{ x: tri.v1.x, y: tri.v1.y, z: tri.v1.z },
				{ x: tri.v2.x, y: tri.v2.y, z: tri.v2.z }
			]
		});
	}

	// Compute bounds
	var bounds = computeBounds(worldPoints);

	// Create surface
	var shortId = Math.random().toString(36).substring(2, 6);
	var surfaceId = "BOOL_SURFACE_" + shortId;
	var layerId = getOrCreateSurfaceLayer("Surface Booleans");

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

	// Store and persist
	window.loadedSurfaces.set(surfaceId, surface);

	// Add to layer
	var layer = window.allSurfaceLayers ? window.allSurfaceLayers.get(layerId) : null;
	if (layer && layer.entities) layer.entities.add(surfaceId);

	if (typeof window.saveSurfaceToDB === "function") {
		window.saveSurfaceToDB(surfaceId).catch(function (err) {
			console.error("Failed to save boolean surface:", err);
		});
	}

	// Undo support
	if (window.undoManager) {
		var action = new AddSurfaceAction(surface);
		window.undoManager.pushAction(action);
	}

	// Trigger redraw
	window.threeKADNeedsRebuild = true;
	if (typeof window.drawData === "function") {
		window.drawData(window.allBlastHoles, window.selectedHole);
	}
	if (typeof window.debouncedUpdateTreeView === "function") {
		window.debouncedUpdateTreeView();
	}

	console.log("Surface Boolean applied: " + surfaceId + " (" + triangles.length + " triangles)");
	return surfaceId;
}

// ────────────────────────────────────────────────────────
// Internal: Mesh creation for preview
// ────────────────────────────────────────────────────────

function trianglesToMesh(tris, color, visible) {
	var positions = [];
	for (var i = 0; i < tris.length; i++) {
		var local0 = window.worldToThreeLocal(tris[i].v0.x, tris[i].v0.y);
		var local1 = window.worldToThreeLocal(tris[i].v1.x, tris[i].v1.y);
		var local2 = window.worldToThreeLocal(tris[i].v2.x, tris[i].v2.y);
		positions.push(
			local0.x, local0.y, tris[i].v0.z,
			local1.x, local1.y, tris[i].v1.z,
			local2.x, local2.y, tris[i].v2.z
		);
	}

	var geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();

	var material = new THREE.MeshBasicMaterial({
		color: new THREE.Color(color || "#4488FF"),
		transparent: true,
		opacity: visible ? 0.6 : 0.15,
		side: THREE.DoubleSide,
		depthWrite: false
	});

	var mesh = new THREE.Mesh(geometry, material);
	mesh.userData.originalColor = color;
	return mesh;
}

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

/**
 * Get or create a named surface layer in allSurfaceLayers.
 */
function getOrCreateSurfaceLayer(layerName) {
	if (!window.allSurfaceLayers) return null;

	for (var [layerId, layer] of window.allSurfaceLayers) {
		if (layer.layerName === layerName) return layerId;
	}

	var newLayerId = "slayer_" + Math.random().toString(36).substring(2, 6);
	window.allSurfaceLayers.set(newLayerId, {
		layerId: newLayerId,
		layerName: layerName,
		visible: true,
		sourceFile: null,
		importDate: new Date().toISOString(),
		entities: new Set()
	});

	if (typeof window.debouncedSaveLayers === "function") window.debouncedSaveLayers();
	return newLayerId;
}
