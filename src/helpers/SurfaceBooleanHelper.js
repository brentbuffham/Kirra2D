/**
 * SurfaceBooleanHelper.js
 *
 * Interactive split-and-pick surface boolean (Vulcan TRIBOOL style).
 * Uses Moller tri-tri intersection polylines to physically SPLIT triangles
 * along the actual intersection boundary, then classifies the resulting
 * clean sub-triangles by centroid Z against the other surface.
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
	intersectSurfacePairTagged
} from "./SurfaceIntersectionHelper.js";

// ────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────

/**
 * Compute split groups for two surfaces using polyline-based triangle splitting.
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

	console.log("Surface Boolean: A=" + trisA.length + " tris, B=" + trisB.length + " tris");

	// Step 2) Get tagged intersection segments
	var taggedSegments = intersectSurfacePairTagged(trisA, trisB);
	console.log("Surface Boolean: " + taggedSegments.length + " intersection segments found");

	if (taggedSegments.length === 0) {
		console.warn("SurfaceBooleanHelper: No intersection found — classifying by centroid only");
	}

	// Step 3) Build crossed triangle sets from tagged segments
	var crossedSetA = {};
	var crossedSetB = {};
	for (var s = 0; s < taggedSegments.length; s++) {
		var seg = taggedSegments[s];
		if (!crossedSetA[seg.idxA]) crossedSetA[seg.idxA] = [];
		crossedSetA[seg.idxA].push(seg);
		if (!crossedSetB[seg.idxB]) crossedSetB[seg.idxB] = [];
		crossedSetB[seg.idxB].push(seg);
	}

	var crossedCountA = Object.keys(crossedSetA).length;
	var crossedCountB = Object.keys(crossedSetB).length;
	console.log("Surface Boolean: crossed A=" + crossedCountA + ", crossed B=" + crossedCountB);

	// Step 4) Split crossed triangles, pass through non-crossed
	var splitTrisA = splitSurfaceAlongSegments(trisA, crossedSetA);
	var splitTrisB = splitSurfaceAlongSegments(trisB, crossedSetB);

	console.log("Surface Boolean: after split A=" + splitTrisA.length + " tris, B=" + splitTrisB.length + " tris");

	// Step 5) Build spatial grids on ORIGINAL triangles for Z interpolation
	var avgEdgeA = ixEstimateAvgEdge(trisA);
	var avgEdgeB = ixEstimateAvgEdge(trisB);
	var cellSizeA = Math.max(avgEdgeA * 2, 0.1);
	var cellSizeB = Math.max(avgEdgeB * 2, 0.1);
	var gridA = ixBuildSpatialGrid(trisA, cellSizeA);
	var gridB = ixBuildSpatialGrid(trisB, cellSizeB);

	// Step 6) Classify all resulting triangles by centroid Z vs other surface
	var aAbove = [];
	var aBelow = [];
	var aOutside = [];

	for (var ia = 0; ia < splitTrisA.length; ia++) {
		var cA = triCentroid(splitTrisA[ia]);
		var zB = interpolateZAtPoint(cA.x, cA.y, trisB, gridB, cellSizeB);
		if (zB === null) {
			aOutside.push(splitTrisA[ia]);
		} else if (cA.z >= zB) {
			aAbove.push(splitTrisA[ia]);
		} else {
			aBelow.push(splitTrisA[ia]);
		}
	}

	var bAbove = [];
	var bBelow = [];
	var bOutside = [];

	for (var ib = 0; ib < splitTrisB.length; ib++) {
		var cB = triCentroid(splitTrisB[ib]);
		var zA = interpolateZAtPoint(cB.x, cB.y, trisA, gridA, cellSizeA);
		if (zA === null) {
			bOutside.push(splitTrisB[ib]);
		} else if (cB.z >= zA) {
			bAbove.push(splitTrisB[ib]);
		} else {
			bBelow.push(splitTrisB[ib]);
		}
	}

	console.log("Surface Boolean classification: " +
		"A=[" + aAbove.length + " above, " + aBelow.length + " below, " +
		aOutside.length + " outside] " +
		"B=[" + bAbove.length + " above, " + bBelow.length + " below, " +
		bOutside.length + " outside]");

	// Step 7) Build split groups (only non-empty)
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
// Polyline-based triangle splitting
// ────────────────────────────────────────────────────────

/**
 * Split all crossed triangles in a surface along their intersection segments.
 * Non-crossed triangles pass through unchanged.
 *
 * @param {Array} tris - All triangles {v0,v1,v2}
 * @param {Object} crossedMap - Map of triIndex -> [taggedSegments] for crossed tris
 * @returns {Array} Resulting triangles after splitting
 */
function splitSurfaceAlongSegments(tris, crossedMap) {
	var result = [];

	for (var i = 0; i < tris.length; i++) {
		if (!crossedMap[i]) {
			// Not crossed — pass through unchanged
			result.push(tris[i]);
			continue;
		}

		// This triangle is crossed by one or more intersection segments
		var segments = crossedMap[i];
		var subTris = splitTriangleBySegments(tris[i], segments);
		for (var j = 0; j < subTris.length; j++) {
			result.push(subTris[j]);
		}
	}

	return result;
}

/**
 * Split a single triangle by one or more intersection segments.
 * Uses iterative splitting: split by first segment, then check sub-triangles
 * against remaining segments.
 *
 * @param {Object} tri - {v0, v1, v2}
 * @param {Array} segments - Tagged segments that cross this triangle
 * @returns {Array} Resulting sub-triangles
 */
function splitTriangleBySegments(tri, segments) {
	var current = [tri];

	for (var s = 0; s < segments.length; s++) {
		var seg = segments[s];
		var next = [];

		for (var t = 0; t < current.length; t++) {
			var subResult = splitOneTriangleBySegment(current[t], seg.p0, seg.p1);
			for (var r = 0; r < subResult.length; r++) {
				next.push(subResult[r]);
			}
		}

		current = next;
	}

	return current;
}

/**
 * Split a single triangle by a single intersection segment.
 * Finds where the segment (or its infinite extension) crosses the triangle edges,
 * then splits the triangle at those crossing points.
 *
 * @param {Object} tri - {v0, v1, v2}
 * @param {Object} segP0 - First endpoint of intersection segment {x,y,z}
 * @param {Object} segP1 - Second endpoint of intersection segment {x,y,z}
 * @returns {Array} 1 or 3 triangles
 */
function splitOneTriangleBySegment(tri, segP0, segP1) {
	// Find crossings of the segment line with the triangle's 3 edges (in 2D XY)
	var verts = [tri.v0, tri.v1, tri.v2];
	var edges = [
		{ a: 0, b: 1 },
		{ a: 1, b: 2 },
		{ a: 2, b: 0 }
	];

	var crossings = [];
	var EPS = 1e-10;

	for (var e = 0; e < 3; e++) {
		var va = verts[edges[e].a];
		var vb = verts[edges[e].b];

		var hit = segSegIntersection2D(
			va.x, va.y, vb.x, vb.y,
			segP0.x, segP0.y, segP1.x, segP1.y
		);

		if (hit === null) continue;

		// hit.t is parameter along the triangle edge [0,1]
		// hit.u is parameter along the segment line (can be outside [0,1] for extended line)
		var t = hit.t;

		// Skip crossings at edge endpoints to avoid duplicates
		if (t < EPS || t > 1.0 - EPS) continue;

		// Interpolate 3D crossing point along the edge
		var crossPt = lerpVert(va, vb, t);

		crossings.push({
			edgeIdx: e,
			t: t,
			point: crossPt
		});
	}

	// Deduplicate crossings that are very close in space
	crossings = deduplicateCrossings(crossings);

	// Need exactly 2 crossings on 2 different edges to split
	if (crossings.length !== 2) {
		return [tri];
	}

	if (crossings[0].edgeIdx === crossings[1].edgeIdx) {
		return [tri];
	}

	return splitTriangleAtCrossings(tri, crossings[0], crossings[1]);
}

/**
 * 2D segment-segment intersection test.
 * Returns {t, u} where t is parameter on segment AB and u is parameter on segment CD.
 * Returns null if segments are parallel or don't intersect.
 * t in [0,1] means intersection is on segment AB.
 * u can be any value (we use the line extension of CD).
 */
function segSegIntersection2D(ax, ay, bx, by, cx, cy, dx, dy) {
	var dABx = bx - ax;
	var dABy = by - ay;
	var dCDx = dx - cx;
	var dCDy = dy - cy;

	var denom = dABx * dCDy - dABy * dCDx;
	if (Math.abs(denom) < 1e-12) return null;

	var dACx = cx - ax;
	var dACy = cy - ay;

	var t = (dACx * dCDy - dACy * dCDx) / denom;
	var u = (dACx * dABy - dACy * dABx) / denom;

	// t must be in [0,1] (on the triangle edge)
	// u can be anything (we use the extended line of the intersection segment)
	if (t < -1e-10 || t > 1.0 + 1e-10) return null;

	return { t: Math.max(0, Math.min(1, t)), u: u };
}

/**
 * Remove duplicate crossings that are very close in 3D space.
 */
function deduplicateCrossings(crossings) {
	if (crossings.length <= 1) return crossings;

	var result = [crossings[0]];
	var DIST_SQ_THRESH = 1e-12;

	for (var i = 1; i < crossings.length; i++) {
		var isDup = false;
		for (var j = 0; j < result.length; j++) {
			var dx = crossings[i].point.x - result[j].point.x;
			var dy = crossings[i].point.y - result[j].point.y;
			var dz = crossings[i].point.z - result[j].point.z;
			if (dx * dx + dy * dy + dz * dz < DIST_SQ_THRESH) {
				isDup = true;
				break;
			}
		}
		if (!isDup) result.push(crossings[i]);
	}

	return result;
}

/**
 * Split a triangle at two edge crossings into 3 sub-triangles.
 *
 * Given crossings on two different edges, the vertex shared by those
 * two edges is the "lone" vertex. The split creates:
 *   T1: (V_lone, Pa, Pb)     — the lone-side triangle
 *   T2: (Pa, V_a, V_b)       — quad part 1
 *   T3: (Pa, V_b, Pb)        — quad part 2
 *
 * Where V_a and V_b are the other two vertices (not V_lone).
 */
function splitTriangleAtCrossings(tri, crossing0, crossing1) {
	var verts = [tri.v0, tri.v1, tri.v2];
	var edges = [
		{ a: 0, b: 1 },
		{ a: 1, b: 2 },
		{ a: 2, b: 0 }
	];

	var e0 = edges[crossing0.edgeIdx];
	var e1 = edges[crossing1.edgeIdx];
	var Pa = crossing0.point;
	var Pb = crossing1.point;

	// Find the lone vertex: shared by both crossed edges
	var loneIdx = -1;
	if (e0.a === e1.a || e0.a === e1.b) {
		loneIdx = e0.a;
	} else if (e0.b === e1.a || e0.b === e1.b) {
		loneIdx = e0.b;
	}

	if (loneIdx === -1) {
		// Crossed edges don't share a vertex — shouldn't happen with 2 crossings
		// on different edges of same triangle, but handle gracefully
		return [tri];
	}

	// Pa is on the edge containing loneIdx as one endpoint
	// Make sure Pa is on the edge from loneIdx
	// crossing0 is on edge e0 (verts[e0.a] to verts[e0.b])
	// crossing1 is on edge e1 (verts[e1.a] to verts[e1.b])
	// We need: Pa on edge from loneIdx, Pb on the other edge from loneIdx
	// Pa = point on the edge of crossing that has loneIdx, similarly Pb

	// The other two vertex indices
	var otherA = -1, otherB = -1;
	if (loneIdx === 0) { otherA = 1; otherB = 2; }
	else if (loneIdx === 1) { otherA = 2; otherB = 0; }
	else { otherA = 0; otherB = 1; }

	// Figure out which crossing is on which edge relative to loneIdx
	// crossing0 is on edge e0. If e0 contains otherA, then Pa is between lone and otherA
	var PaOnEdgeToA, PbOnEdgeToA;
	if (e0.a === otherA || e0.b === otherA) {
		PaOnEdgeToA = true;
	} else {
		PaOnEdgeToA = false;
	}

	var pToA, pToB;
	if (PaOnEdgeToA) {
		pToA = Pa;
		pToB = Pb;
	} else {
		pToA = Pb;
		pToB = Pa;
	}

	var vLone = verts[loneIdx];
	var vA = verts[otherA];
	var vB = verts[otherB];

	// T1: lone-side triangle
	var t1 = { v0: vLone, v1: pToA, v2: pToB };
	// T2, T3: quad on the other side, split into 2 triangles
	var t2 = { v0: pToA, v1: vA, v2: vB };
	var t3 = { v0: pToA, v1: vB, v2: pToB };

	return [t1, t2, t3];
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
