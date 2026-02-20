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
	if (!mesh) return;

	var originalColor = mesh.userData.originalColor || "#4488FF";
	mesh.visible = true;

	// mesh is a Group containing solidFill (Mesh) + wireframe (LineSegments)
	mesh.traverse(function (child) {
		if (!child.material) return;
		if (child.name === "solidFill") {
			child.material.opacity = kept ? 0.3 : 0.08;
			child.material.color.set(kept ? originalColor : "#444444");
			child.material.needsUpdate = true;
		} else if (child.name === "wireframe") {
			child.material.opacity = kept ? 0.7 : 0.15;
			child.material.color.set(kept ? originalColor : "#444444");
			child.material.needsUpdate = true;
		}
	});
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

	// Optionally close the surface by capping boundary loops
	if (config.closeSurface) {
		var capTris = capBoundaryLoops(keptTriangles);
		if (capTris.length > 0) {
			console.log("Surface Boolean: capping with " + capTris.length + " triangles");
			for (var ct = 0; ct < capTris.length; ct++) {
				keptTriangles.push(capTris[ct]);
			}
		} else {
			console.log("Surface Boolean: no boundary loops found to cap");
		}
	}

	// Convert to surface format with vertex welding
	var snapTol = config.snapTolerance || 0;
	var welded = weldVertices(keptTriangles, snapTol);
	var worldPoints = welded.points;
	var triangles = welded.triangles;

	console.log("Surface Boolean: welded " + keptTriangles.length * 3 + " vertices → " +
		worldPoints.length + " unique points (tol=" + snapTol + "m)");

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
// Vertex welding — merge coincident points
// ────────────────────────────────────────────────────────

/**
 * Weld triangle soup into indexed mesh, merging vertices within tolerance.
 * Returns { points: [{x,y,z}], triangles: [{vertices:[{x,y,z},{x,y,z},{x,y,z}]}] }
 *
 * Uses spatial grid for O(n) welding instead of O(n²).
 */
function weldVertices(tris, tolerance) {
	var points = [];
	var triangles = [];

	if (tolerance <= 0) {
		// No welding — fast path: store vertices per triangle (original behavior)
		for (var i = 0; i < tris.length; i++) {
			var tri = tris[i];
			points.push(
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
		return { points: points, triangles: triangles };
	}

	// Spatial grid for fast nearest-vertex lookup
	var cellSize = Math.max(tolerance * 2, 0.002);
	var grid = {}; // "gx,gy,gz" -> [pointIndex, ...]
	var tolSq = tolerance * tolerance;

	function getOrAddPoint(v) {
		var gx = Math.floor(v.x / cellSize);
		var gy = Math.floor(v.y / cellSize);
		var gz = Math.floor(v.z / cellSize);

		// Search nearby cells
		for (var dx = -1; dx <= 1; dx++) {
			for (var dy = -1; dy <= 1; dy++) {
				for (var dz = -1; dz <= 1; dz++) {
					var key = (gx + dx) + "," + (gy + dy) + "," + (gz + dz);
					var cell = grid[key];
					if (!cell) continue;
					for (var c = 0; c < cell.length; c++) {
						var p = points[cell[c]];
						var ddx = p.x - v.x, ddy = p.y - v.y, ddz = p.z - v.z;
						if (ddx * ddx + ddy * ddy + ddz * ddz <= tolSq) {
							return cell[c];
						}
					}
				}
			}
		}

		// New unique point
		var idx = points.length;
		points.push({ x: v.x, y: v.y, z: v.z });
		var homeKey = gx + "," + gy + "," + gz;
		if (!grid[homeKey]) grid[homeKey] = [];
		grid[homeKey].push(idx);
		return idx;
	}

	for (var i2 = 0; i2 < tris.length; i2++) {
		var tri2 = tris[i2];
		var i0 = getOrAddPoint(tri2.v0);
		var i1 = getOrAddPoint(tri2.v1);
		var i22 = getOrAddPoint(tri2.v2);

		// Skip degenerate triangles where welding collapsed vertices
		if (i0 === i1 || i1 === i22 || i0 === i22) continue;

		triangles.push({
			vertices: [
				{ x: points[i0].x, y: points[i0].y, z: points[i0].z },
				{ x: points[i1].x, y: points[i1].y, z: points[i1].z },
				{ x: points[i22].x, y: points[i22].y, z: points[i22].z }
			]
		});
	}

	return { points: points, triangles: triangles };
}

// ────────────────────────────────────────────────────────
// Boundary capping — close open surfaces
// ────────────────────────────────────────────────────────

/**
 * Find boundary edges, chain into loops, triangulate each loop to cap.
 * Returns array of cap triangles {v0, v1, v2}.
 */
function capBoundaryLoops(tris) {
	// Step 1) Build edge count map — boundary edges appear exactly once
	var edgeMap = {}; // "x1,y1,z1|x2,y2,z2" -> { count, v0, v1 }
	var PREC = 6;

	function vKey(v) {
		return v.x.toFixed(PREC) + "," + v.y.toFixed(PREC) + "," + v.z.toFixed(PREC);
	}

	function edgeKey(ka, kb) {
		return ka < kb ? ka + "|" + kb : kb + "|" + ka;
	}

	// Also build a directed half-edge map for winding order
	var halfEdges = {}; // "ka|kb" -> true (directed: ka → kb exists as a triangle edge)

	for (var i = 0; i < tris.length; i++) {
		var tri = tris[i];
		var verts = [tri.v0, tri.v1, tri.v2];
		var keys = [vKey(verts[0]), vKey(verts[1]), vKey(verts[2])];

		for (var e = 0; e < 3; e++) {
			var ne = (e + 1) % 3;
			var ek = edgeKey(keys[e], keys[ne]);
			if (!edgeMap[ek]) {
				edgeMap[ek] = { count: 0, v0: verts[e], v1: verts[ne], k0: keys[e], k1: keys[ne] };
			}
			edgeMap[ek].count++;
			// Record directed half-edge
			halfEdges[keys[e] + "|" + keys[ne]] = true;
		}
	}

	// Step 2) Collect boundary edges (count === 1)
	var boundaryEdges = [];
	for (var ek2 in edgeMap) {
		if (edgeMap[ek2].count === 1) {
			boundaryEdges.push(edgeMap[ek2]);
		}
	}

	if (boundaryEdges.length === 0) return [];

	console.log("Surface Boolean: " + boundaryEdges.length + " boundary edges found");

	// Step 3) Build adjacency for boundary vertices and chain into loops
	// Determine correct winding: boundary edge direction should be OPPOSITE to the
	// existing half-edge (so the cap triangle normals face outward)
	var adj = {}; // vertexKey -> [{ key: neighborKey, vertex: {x,y,z} }]

	for (var b = 0; b < boundaryEdges.length; b++) {
		var be = boundaryEdges[b];
		// The existing mesh has half-edge k0→k1, so boundary should go k1→k0
		// for consistent outward normals on the cap
		var fromKey, toKey, fromVert, toVert;
		if (halfEdges[be.k0 + "|" + be.k1]) {
			fromKey = be.k1; toKey = be.k0;
			fromVert = be.v1; toVert = be.v0;
		} else {
			fromKey = be.k0; toKey = be.k1;
			fromVert = be.v0; toVert = be.v1;
		}
		if (!adj[fromKey]) adj[fromKey] = [];
		adj[fromKey].push({ key: toKey, vertex: toVert, fromVertex: fromVert });
	}

	// Chain into loops
	var used = {};
	var loops = [];

	for (var startKey in adj) {
		if (used[startKey]) continue;

		var loop = [];
		var currentKey = startKey;
		var safety = boundaryEdges.length + 1;

		while (safety-- > 0) {
			if (used[currentKey]) break;
			used[currentKey] = true;

			var neighbors = adj[currentKey];
			if (!neighbors || neighbors.length === 0) break;

			// Pick first unused neighbor
			var next = null;
			for (var n = 0; n < neighbors.length; n++) {
				if (!used[neighbors[n].key] || (neighbors[n].key === startKey && loop.length > 2)) {
					next = neighbors[n];
					break;
				}
			}

			if (!next) break;

			loop.push(next.fromVertex);
			currentKey = next.key;

			// Closed the loop?
			if (currentKey === startKey) break;
		}

		if (loop.length >= 3) {
			loops.push(loop);
		}
	}

	console.log("Surface Boolean: " + loops.length + " boundary loop(s) found, sizes: " +
		loops.map(function (l) { return l.length; }).join(", "));

	// Step 4) Triangulate each loop using ear-clipping
	var capTris = [];
	for (var li = 0; li < loops.length; li++) {
		var loopTris = triangulateLoop(loops[li]);
		for (var lt = 0; lt < loopTris.length; lt++) {
			capTris.push(loopTris[lt]);
		}
	}

	return capTris;
}

/**
 * Triangulate a 3D polygon loop using ear-clipping projected onto the
 * best-fit 2D plane (the plane with the largest projected area).
 *
 * @param {Array} loop - Array of {x, y, z} vertices in order
 * @returns {Array} Array of {v0, v1, v2} triangles
 */
function triangulateLoop(loop) {
	if (loop.length < 3) return [];
	if (loop.length === 3) {
		return [{ v0: loop[0], v1: loop[1], v2: loop[2] }];
	}

	// Compute loop normal to determine best projection plane
	var nx = 0, ny = 0, nz = 0;
	for (var i = 0; i < loop.length; i++) {
		var curr = loop[i];
		var next = loop[(i + 1) % loop.length];
		// Newell's method
		nx += (curr.y - next.y) * (curr.z + next.z);
		ny += (curr.z - next.z) * (curr.x + next.x);
		nz += (curr.x - next.x) * (curr.y + next.y);
	}

	// Pick the 2D projection plane that preserves the most area
	var anx = Math.abs(nx), any = Math.abs(ny), anz = Math.abs(nz);
	var projU, projV; // functions to project 3D -> 2D
	if (anz >= anx && anz >= any) {
		// Project onto XY
		projU = function (p) { return p.x; };
		projV = function (p) { return p.y; };
	} else if (any >= anx) {
		// Project onto XZ
		projU = function (p) { return p.x; };
		projV = function (p) { return p.z; };
	} else {
		// Project onto YZ
		projU = function (p) { return p.y; };
		projV = function (p) { return p.z; };
	}

	// Build index array
	var indices = [];
	for (var j = 0; j < loop.length; j++) indices.push(j);

	// Determine polygon winding in 2D
	var signedArea = 0;
	for (var k = 0; k < indices.length; k++) {
		var k1 = (k + 1) % indices.length;
		signedArea += projU(loop[indices[k]]) * projV(loop[indices[k1]]);
		signedArea -= projU(loop[indices[k1]]) * projV(loop[indices[k]]);
	}
	var ccw = signedArea > 0;

	var result = [];
	var maxIter = loop.length * loop.length;

	while (indices.length > 2 && maxIter-- > 0) {
		var earFound = false;

		for (var ei = 0; ei < indices.length; ei++) {
			var pi = (ei + indices.length - 1) % indices.length;
			var ni = (ei + 1) % indices.length;

			var pv = loop[indices[pi]];
			var cv = loop[indices[ei]];
			var nv = loop[indices[ni]];

			// Check if this is a convex vertex (an ear candidate)
			var cross2D = (projU(cv) - projU(pv)) * (projV(nv) - projV(pv))
				- (projV(cv) - projV(pv)) * (projU(nv) - projU(pv));

			var isConvex = ccw ? cross2D > 0 : cross2D < 0;
			if (!isConvex) continue;

			// Check no other vertex is inside this ear triangle
			var earOk = true;
			for (var ci = 0; ci < indices.length; ci++) {
				if (ci === pi || ci === ei || ci === ni) continue;
				if (pointInTri2D(
					projU(loop[indices[ci]]), projV(loop[indices[ci]]),
					projU(pv), projV(pv),
					projU(cv), projV(cv),
					projU(nv), projV(nv)
				)) {
					earOk = false;
					break;
				}
			}

			if (earOk) {
				result.push({ v0: pv, v1: cv, v2: nv });
				indices.splice(ei, 1);
				earFound = true;
				break;
			}
		}

		if (!earFound) {
			// Degenerate — force clip to avoid infinite loop
			if (indices.length >= 3) {
				result.push({
					v0: loop[indices[0]],
					v1: loop[indices[1]],
					v2: loop[indices[2]]
				});
				indices.splice(1, 1);
			} else {
				break;
			}
		}
	}

	return result;
}

/**
 * 2D point-in-triangle test for ear clipping.
 */
function pointInTri2D(px, py, ax, ay, bx, by, cx, cy) {
	var d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
	var d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
	var d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
	var hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
	var hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
	return !(hasNeg && hasPos);
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

	var group = new THREE.Group();
	group.userData.originalColor = color;

	// Semi-transparent solid fill (matches extrude preview style)
	var solidMaterial = new THREE.MeshBasicMaterial({
		color: new THREE.Color(color || "#4488FF"),
		transparent: true,
		opacity: visible ? 0.3 : 0.08,
		side: THREE.DoubleSide,
		depthWrite: false
	});
	var solidMesh = new THREE.Mesh(geometry.clone(), solidMaterial);
	solidMesh.name = "solidFill";
	group.add(solidMesh);

	// Wireframe overlay
	var wireGeometry = new THREE.WireframeGeometry(geometry);
	var wireMaterial = new THREE.LineBasicMaterial({
		color: new THREE.Color(color || "#4488FF"),
		transparent: true,
		opacity: visible ? 0.7 : 0.15
	});
	var wireframe = new THREE.LineSegments(wireGeometry, wireMaterial);
	wireframe.name = "wireframe";
	group.add(wireframe);

	return group;
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
