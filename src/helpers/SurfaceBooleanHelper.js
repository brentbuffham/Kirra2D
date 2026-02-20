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
import Delaunator from "delaunator";
import Constrainautor from "@kninnug/constrainautor";
import { MeshLine, MeshLineMaterial } from "./meshLineModified.js";
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
	// Initial pass: above / below / outside (null Z = no XY coverage on other surface)
	var classA = []; // per-triangle: 1=above, -1=below, 0=outside
	for (var ia = 0; ia < splitTrisA.length; ia++) {
		var cA = triCentroid(splitTrisA[ia]);
		var zB = interpolateZAtPoint(cA.x, cA.y, trisB, gridB, cellSizeB);
		if (zB === null) {
			classA.push(0);
		} else if (cA.z >= zB) {
			classA.push(1);
		} else {
			classA.push(-1);
		}
	}

	var classB = [];
	for (var ib = 0; ib < splitTrisB.length; ib++) {
		var cB = triCentroid(splitTrisB[ib]);
		var zA = interpolateZAtPoint(cB.x, cB.y, trisA, gridA, cellSizeA);
		if (zA === null) {
			classB.push(0);
		} else if (cB.z >= zA) {
			classB.push(1);
		} else {
			classB.push(-1);
		}
	}

	// Step 6b) Reclassify "outside" triangles by adjacency flood-fill.
	// Triangles outside the other surface's XY extent should inherit the
	// classification of their connected neighbors. Without this, the pit
	// surface gets artificially split into "above" and "outside" groups
	// even though they're the same connected region with no intersection
	// boundary between them.
	classA = reclassifyOutsideByAdjacency(splitTrisA, classA);
	classB = reclassifyOutsideByAdjacency(splitTrisB, classB);

	// Collect into arrays
	var aAbove = [], aBelow = [], aOutside = [];
	for (var ia2 = 0; ia2 < splitTrisA.length; ia2++) {
		if (classA[ia2] === 1) aAbove.push(splitTrisA[ia2]);
		else if (classA[ia2] === -1) aBelow.push(splitTrisA[ia2]);
		else aOutside.push(splitTrisA[ia2]);
	}

	var bAbove = [], bBelow = [], bOutside = [];
	for (var ib2 = 0; ib2 < splitTrisB.length; ib2++) {
		if (classB[ib2] === 1) bAbove.push(splitTrisB[ib2]);
		else if (classB[ib2] === -1) bBelow.push(splitTrisB[ib2]);
		else bOutside.push(splitTrisB[ib2]);
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
		surfaceIdB: surfaceIdB,
		taggedSegments: taggedSegments
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
	// Find crossings of the segment line with the triangle's 3 edges.
	// CRITICAL: Work in the triangle's local 2D coordinate frame, NOT world XY.
	// Using world XY causes incorrect splits on steep/vertical pit-wall triangles
	// because the XY projection distorts the geometry.
	var verts = [tri.v0, tri.v1, tri.v2];
	var edges = [
		{ a: 0, b: 1 },
		{ a: 1, b: 2 },
		{ a: 2, b: 0 }
	];

	// Build a local 2D coordinate frame on the triangle plane:
	//   U = normalize(V1 - V0)
	//   N = cross(V1-V0, V2-V0)
	//   V = cross(N, U), normalized
	var e1x = tri.v1.x - tri.v0.x;
	var e1y = tri.v1.y - tri.v0.y;
	var e1z = tri.v1.z - tri.v0.z;
	var e2x = tri.v2.x - tri.v0.x;
	var e2y = tri.v2.y - tri.v0.y;
	var e2z = tri.v2.z - tri.v0.z;

	// U axis = normalize(e1)
	var e1Len = Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z);
	if (e1Len < 1e-12) return [tri]; // degenerate triangle
	var ux = e1x / e1Len, uy = e1y / e1Len, uz = e1z / e1Len;

	// Normal = cross(e1, e2)
	var nx = e1y * e2z - e1z * e2y;
	var ny = e1z * e2x - e1x * e2z;
	var nz = e1x * e2y - e1y * e2x;
	var nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
	if (nLen < 1e-12) return [tri]; // degenerate triangle

	// V axis = cross(N, U), normalized
	var vx = ny * uz - nz * uy;
	var vy = nz * ux - nx * uz;
	var vz = nx * uy - ny * ux;
	var vLen = Math.sqrt(vx * vx + vy * vy + vz * vz);
	if (vLen < 1e-12) return [tri];
	vx /= vLen; vy /= vLen; vz /= vLen;

	// Project a 3D point to local 2D: dot with U and V axes, relative to V0
	var ox = tri.v0.x, oy = tri.v0.y, oz = tri.v0.z;
	function toLocal(p) {
		var dx = p.x - ox, dy = p.y - oy, dz = p.z - oz;
		return {
			u: dx * ux + dy * uy + dz * uz,
			v: dx * vx + dy * vy + dz * vz
		};
	}

	// Project all vertices and segment endpoints to local 2D
	var lv = [toLocal(verts[0]), toLocal(verts[1]), toLocal(verts[2])];
	var ls0 = toLocal(segP0);
	var ls1 = toLocal(segP1);

	var crossings = [];
	var EDGE_EPS = 0.001;

	for (var e = 0; e < 3; e++) {
		var la = lv[edges[e].a];
		var lb = lv[edges[e].b];

		var hit = segSegIntersection2D(
			la.u, la.v, lb.u, lb.v,
			ls0.u, ls0.v, ls1.u, ls1.v
		);

		if (hit === null) continue;

		var t = hit.t;

		// Skip crossings near edge endpoints to avoid slivers
		if (t < EDGE_EPS || t > 1.0 - EDGE_EPS) continue;

		// Interpolate 3D crossing point along the ORIGINAL 3D edge
		var crossPt = lerpVert(verts[edges[e].a], verts[edges[e].b], t);

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
// Outside reclassification — adjacency flood-fill
// ────────────────────────────────────────────────────────

/**
 * Reclassify "outside" triangles (class=0) by adjacency flood-fill.
 *
 * Triangles outside the other surface's XY extent are initially unclassified.
 * They should inherit the classification of their connected neighbors because
 * they're part of the same connected region — only the intersection line should
 * create region boundaries, not the XY extent of the other surface.
 *
 * Algorithm:
 * 1. Build edge→[triIndex] adjacency map using vertex keys
 * 2. Seed queue from all classified triangles (above=1 or below=-1)
 * 3. BFS: for each unclassified neighbor, adopt the seed's classification
 * 4. Iterate until all reachable "outside" triangles are reclassified
 *
 * @param {Array} tris - Triangle soup [{v0, v1, v2}, ...]
 * @param {Array} classes - Per-triangle classification: 1=above, -1=below, 0=outside
 * @returns {Array} Updated classification array
 */
function reclassifyOutsideByAdjacency(tris, classes) {
	var outsideCount = 0;
	for (var i = 0; i < classes.length; i++) {
		if (classes[i] === 0) outsideCount++;
	}
	if (outsideCount === 0) return classes;

	var PREC = 6;
	function vKey(v) {
		return v.x.toFixed(PREC) + "," + v.y.toFixed(PREC) + "," + v.z.toFixed(PREC);
	}
	function edgeKey(ka, kb) {
		return ka < kb ? ka + "|" + kb : kb + "|" + ka;
	}

	// Step 1) Build edge→[triIndex] adjacency
	var edgeToTris = {};
	for (var ti = 0; ti < tris.length; ti++) {
		var tri = tris[ti];
		var k0 = vKey(tri.v0);
		var k1 = vKey(tri.v1);
		var k2 = vKey(tri.v2);
		var edges = [edgeKey(k0, k1), edgeKey(k1, k2), edgeKey(k2, k0)];
		for (var e = 0; e < 3; e++) {
			if (!edgeToTris[edges[e]]) edgeToTris[edges[e]] = [];
			edgeToTris[edges[e]].push(ti);
		}
	}

	// Build per-triangle neighbor list
	var neighbors = new Array(tris.length);
	for (var ni = 0; ni < tris.length; ni++) neighbors[ni] = [];

	for (var ek in edgeToTris) {
		var list = edgeToTris[ek];
		for (var a = 0; a < list.length; a++) {
			for (var b = a + 1; b < list.length; b++) {
				neighbors[list[a]].push(list[b]);
				neighbors[list[b]].push(list[a]);
			}
		}
	}

	// Step 2) BFS from classified triangles into outside triangles
	var result = classes.slice(); // copy
	var queue = [];

	// Seed: all classified triangles that have at least one outside neighbor
	for (var si = 0; si < tris.length; si++) {
		if (result[si] !== 0) {
			queue.push(si);
		}
	}

	// Step 3) Flood-fill
	var reclassified = 0;
	var head = 0;
	while (head < queue.length) {
		var current = queue[head++];
		var currentClass = result[current];
		var nbrs = neighbors[current];

		for (var n = 0; n < nbrs.length; n++) {
			var nbr = nbrs[n];
			if (result[nbr] === 0) {
				result[nbr] = currentClass;
				reclassified++;
				queue.push(nbr);
			}
		}
	}

	if (reclassified > 0) {
		var remaining = 0;
		for (var ri = 0; ri < result.length; ri++) {
			if (result[ri] === 0) remaining++;
		}
		console.log("SurfaceBooleanHelper: reclassified " + reclassified + "/" + outsideCount +
			" outside tris by adjacency" + (remaining > 0 ? " (" + remaining + " disconnected remain)" : ""));
	}

	return result;
}

// ────────────────────────────────────────────────────────
// Public: Preview mesh creation
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
 * Create a 3D fat-line mesh showing the intersection polyline.
 * Uses MeshLine (project's existing fat-line library) for platform-independent
 * thick lines. Rendered on top with depthTest=false.
 *
 * @param {Array} taggedSegments - [{p0, p1, idxA, idxB}, ...]
 * @returns {THREE.Group|null}
 */
export function createIntersectionPolylineMesh(taggedSegments) {
	if (!taggedSegments || taggedSegments.length === 0) return null;

	var group = new THREE.Group();
	group.name = "intersectionPolyline";
	group.renderOrder = 999;
	group.userData = { isPreview: true };

	// Build polyline points — each segment is a separate fat line
	for (var i = 0; i < taggedSegments.length; i++) {
		var seg = taggedSegments[i];
		var l0 = window.worldToThreeLocal(seg.p0.x, seg.p0.y);
		var l1 = window.worldToThreeLocal(seg.p1.x, seg.p1.y);

		var points = [
			new THREE.Vector3(l0.x, l0.y, seg.p0.z),
			new THREE.Vector3(l1.x, l1.y, seg.p1.z)
		];

		var line = new MeshLine();
		var geom = new THREE.BufferGeometry().setFromPoints(points);
		line.setGeometry(geom);

		var material = new MeshLineMaterial({
			color: new THREE.Color(0xFFFF00),
			lineWidth: 3,
			resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
			depthTest: false,
			depthWrite: false,
			transparent: true,
			opacity: 1.0,
			sizeAttenuation: false
		});

		var mesh = new THREE.Mesh(line, material);
		mesh.renderOrder = 999;
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
	var closeMode = config.closeMode || "none";
	var floorOffset = config.floorOffset || 10;
	var snapTol = config.snapTolerance || 0;

	// ── Step 1: Collect kept triangles ──
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

	// Cleanup settings (all optional, defaults to off)
	var removeDegenerate = config.removeDegenerate !== false; // default on
	var removeSlivers = !!config.removeSlivers; // default off
	var cleanCrossings = !!config.cleanCrossings; // default off
	var sliverRatio = config.sliverRatio || 0.01;
	var minArea = config.minArea || 1e-6;

	console.log("SurfaceBooleanHelper: applyMerge — " + keptTriangles.length +
		" kept tris, closeMode=" + closeMode + ", snapTol=" + snapTol +
		", removeDegenerate=" + removeDegenerate + ", removeSlivers=" + removeSlivers +
		", cleanCrossings=" + cleanCrossings + ", sliverRatio=" + sliverRatio);

	// ── Step 2: Weld vertices (snap close vertices in 3D) ──
	var welded = weldVertices(keptTriangles, snapTol);
	console.log("SurfaceBooleanHelper: welded " + keptTriangles.length * 3 + " vertices → " +
		welded.points.length + " unique points (tol=" + snapTol + "m)");

	// Convert back to soup for subsequent operations
	var soup = weldedToSoup(welded.triangles);

	// ── Step 3: Remove degenerate / sliver triangles (if enabled) ──
	if (removeDegenerate || removeSlivers) {
		var effectiveSliver = removeSlivers ? sliverRatio : 0;
		soup = removeDegenerateTriangles(soup, minArea, effectiveSliver);
	}

	// ── Step 4: Clean crossing triangles (if enabled, iterative) ──
	if (cleanCrossings) {
		var prevLen = soup.length + 1;
		var cleanPass = 0;
		while (soup.length < prevLen && cleanPass < 5) {
			prevLen = soup.length;
			soup = cleanCrossingTriangles(soup);
			if (removeDegenerate || removeSlivers) {
				var effectiveSliver2 = removeSlivers ? sliverRatio : 0;
				soup = removeDegenerateTriangles(soup, minArea, effectiveSliver2);
			}
			cleanPass++;
		}
		if (cleanPass > 1) {
			console.log("SurfaceBooleanHelper: iterative clean took " + cleanPass + " passes");
		}
	}

	// ── Step 4b: Remove overlapping triangles / internal walls (if enabled) ──
	if (config.removeOverlapping) {
		var overlapTol = config.overlapTolerance || 0.5;
		soup = removeOverlappingTriangles(soup, overlapTol);
	}

	// ── Step 4c: Weld boundary vertices with higher tolerance to close seam gaps ──
	if (config.removeOverlapping || closeMode !== "none") {
		var seamTol = config.overlapTolerance || 0.5;
		soup = weldBoundaryVertices(soup, seamTol);
	}

	// ── Step 5: Stitch boundary edges by proximity (if mode includes stitch) ──
	if (closeMode === "stitch" || closeMode === "stitch+curtain") {
		var stitchTol = config.stitchTolerance || 1.0;
		var stitchTris = stitchByProximity(soup, stitchTol);
		if (stitchTris.length > 0) {
			console.log("SurfaceBooleanHelper: stitching added " + stitchTris.length + " triangles");
			for (var st = 0; st < stitchTris.length; st++) {
				soup.push(stitchTris[st]);
			}
		}
	}

	// ── Step 5b: Generate closing triangles — fill remaining boundary gaps ──
	if (closeMode !== "none") {
		var closeDist = config.stitchTolerance || 1.0;
		soup = generateClosingTriangles(soup, closeDist);
	}

	// ── Step 6: Curtain walls + bottom cap (if mode includes curtain) ──
	if (closeMode === "curtain" || closeMode === "stitch+curtain") {
		var curtainTris = buildCurtainAndCap(soup, floorOffset);
		if (curtainTris.length > 0) {
			console.log("SurfaceBooleanHelper: curtain+cap added " + curtainTris.length + " triangles");
			for (var ct = 0; ct < curtainTris.length; ct++) {
				soup.push(curtainTris[ct]);
			}
		}
	}

	// ── Step 7: Re-weld final soup (merge closing seams) ──
	var finalWelded = weldVertices(soup, snapTol);
	var worldPoints = finalWelded.points;
	var triangles = finalWelded.triangles;

	console.log("SurfaceBooleanHelper: final weld → " + worldPoints.length +
		" points, " + triangles.length + " triangles");

	// ── Step 7b: Force-close on indexed mesh (uses point indices, no precision issues) ──
	if (closeMode !== "none") {
		var closeResult = forceCloseIndexedMesh(worldPoints, triangles);
		worldPoints = closeResult.points;
		triangles = closeResult.triangles;
	}

	// ── Step 8: Log boundary stats ──
	var finalSoup = weldedToSoup(triangles);
	logBoundaryStats(finalSoup, closeMode);

	// ── Step 9: Store result surface ──
	var bounds = computeBounds(worldPoints);

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

	console.log("SurfaceBooleanHelper: applied " + surfaceId + " (" + triangles.length + " triangles)");
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
// Boundary loop extraction — reusable by stitch, curtain, cap
// ────────────────────────────────────────────────────────

/**
 * Extract boundary loops from triangle soup.
 * Boundary edges appear exactly once in the edge count map.
 * Returns { loops: [[ {x,y,z}, ... ]], boundaryEdgeCount: N, overSharedEdgeCount: N }
 *
 * @param {Array} tris - Triangle soup [{v0, v1, v2}, ...]
 * @returns {Object}
 */
function extractBoundaryLoops(tris) {
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

	// Step 2) Collect boundary edges (count === 1) and count over-shared edges (count > 2)
	var boundaryEdges = [];
	var overSharedCount = 0;
	for (var ek2 in edgeMap) {
		if (edgeMap[ek2].count === 1) {
			boundaryEdges.push(edgeMap[ek2]);
		} else if (edgeMap[ek2].count > 2) {
			overSharedCount++;
		}
	}

	if (boundaryEdges.length === 0) {
		return { loops: [], boundaryEdgeCount: 0, overSharedEdgeCount: overSharedCount };
	}

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

	return { loops: loops, boundaryEdgeCount: boundaryEdges.length, overSharedEdgeCount: overSharedCount };
}

// ────────────────────────────────────────────────────────
// Boundary capping — close open surfaces (thin wrapper)
// ────────────────────────────────────────────────────────

/**
 * Find boundary edges, chain into loops, triangulate each loop to cap.
 * Returns array of cap triangles {v0, v1, v2}.
 */
function capBoundaryLoops(tris) {
	var result = extractBoundaryLoops(tris);

	if (result.loops.length === 0) return [];

	console.log("SurfaceBooleanHelper: " + result.boundaryEdgeCount + " boundary edges, " +
		result.loops.length + " loop(s), sizes: " +
		result.loops.map(function (l) { return l.length; }).join(", "));

	// Triangulate each loop using ear-clipping
	var capTris = [];
	for (var li = 0; li < result.loops.length; li++) {
		var loopTris = triangulateLoop(result.loops[li]);
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

	// Compute loop normal to determine best projection plane (Newell's method)
	var nx = 0, ny = 0, nz = 0;
	for (var i = 0; i < loop.length; i++) {
		var curr = loop[i];
		var next = loop[(i + 1) % loop.length];
		nx += (curr.y - next.y) * (curr.z + next.z);
		ny += (curr.z - next.z) * (curr.x + next.x);
		nz += (curr.x - next.x) * (curr.y + next.y);
	}

	// Pick the 2D projection plane that preserves the most area
	var anx = Math.abs(nx), any = Math.abs(ny), anz = Math.abs(nz);
	var projU, projV;
	if (anz >= anx && anz >= any) {
		projU = function (p) { return p.x; };
		projV = function (p) { return p.y; };
	} else if (any >= anx) {
		projU = function (p) { return p.x; };
		projV = function (p) { return p.z; };
	} else {
		projU = function (p) { return p.y; };
		projV = function (p) { return p.z; };
	}

	// Build flat coords array for Delaunator
	var n = loop.length;
	var coords = new Float64Array(n * 2);
	for (var j = 0; j < n; j++) {
		coords[j * 2] = projU(loop[j]);
		coords[j * 2 + 1] = projV(loop[j]);
	}

	// Constrained Delaunay triangulation
	var del, con;
	try {
		del = new Delaunator(coords);
		con = new Constrainautor(del);

		// Constrain all boundary loop edges
		for (var ci = 0; ci < n; ci++) {
			var ni = (ci + 1) % n;
			try {
				con.constrainOne(ci, ni);
			} catch (e) {
				// Skip problematic constraint edges
			}
		}
	} catch (e) {
		console.warn("SurfaceBooleanHelper: triangulateLoop — Constrainautor failed, using Delaunator only:", e.message);
		try {
			del = new Delaunator(coords);
		} catch (e2) {
			console.warn("SurfaceBooleanHelper: triangulateLoop — Delaunator also failed:", e2.message);
			return [];
		}
	}

	// Filter triangles: only keep those whose centroid is inside the boundary loop
	var result = [];
	var tris = del.triangles;
	for (var k = 0; k < tris.length; k += 3) {
		var a = tris[k], b = tris[k + 1], c = tris[k + 2];

		// Centroid in 2D
		var cx = (coords[a * 2] + coords[b * 2] + coords[c * 2]) / 3;
		var cy = (coords[a * 2 + 1] + coords[b * 2 + 1] + coords[c * 2 + 1]) / 3;

		// Point-in-polygon test (ray casting) against the loop
		if (_pointInLoop2D(cx, cy, coords, n)) {
			result.push({
				v0: loop[a],
				v1: loop[b],
				v2: loop[c]
			});
		}
	}

	return result;
}

/**
 * Ray-casting point-in-polygon test on a 2D loop stored as flat coords.
 */
function _pointInLoop2D(px, py, coords, n) {
	var inside = false;
	for (var i = 0, j = n - 1; i < n; j = i++) {
		var xi = coords[i * 2], yi = coords[i * 2 + 1];
		var xj = coords[j * 2], yj = coords[j * 2 + 1];
		if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
			inside = !inside;
		}
	}
	return inside;
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

// ────────────────────────────────────────────────────────
// Utility helpers
// ────────────────────────────────────────────────────────

/**
 * 3D Euclidean distance between two points.
 * @param {Object} a - {x, y, z}
 * @param {Object} b - {x, y, z}
 * @returns {number}
 */
function dist3(a, b) {
	var dx = a.x - b.x;
	var dy = a.y - b.y;
	var dz = a.z - b.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Convert welded {points, triangles} back to triangle soup [{v0,v1,v2}, ...].
 * Each welded triangle has vertices: [{x,y,z}, {x,y,z}, {x,y,z}].
 *
 * @param {Array} weldedTriangles - Array of {vertices: [{x,y,z},{x,y,z},{x,y,z}]}
 * @returns {Array} Triangle soup [{v0, v1, v2}, ...]
 */
function weldedToSoup(weldedTriangles) {
	var soup = [];
	for (var i = 0; i < weldedTriangles.length; i++) {
		var verts = weldedTriangles[i].vertices;
		soup.push({
			v0: { x: verts[0].x, y: verts[0].y, z: verts[0].z },
			v1: { x: verts[1].x, y: verts[1].y, z: verts[1].z },
			v2: { x: verts[2].x, y: verts[2].y, z: verts[2].z }
		});
	}
	return soup;
}

/**
 * Log boundary / closure diagnostics to console.
 *
 * @param {Array} tris - Triangle soup [{v0,v1,v2}, ...]
 * @param {string} closeMode - The closing mode used
 */
function logBoundaryStats(tris, closeMode) {
	var result = extractBoundaryLoops(tris);
	var isClosed = result.boundaryEdgeCount === 0 && result.overSharedEdgeCount === 0;

	console.log("SurfaceBooleanHelper: ── Post-close diagnostics ──");
	console.log("SurfaceBooleanHelper:   closeMode = " + closeMode);
	console.log("SurfaceBooleanHelper:   triangles = " + tris.length);
	console.log("SurfaceBooleanHelper:   boundary edges = " + result.boundaryEdgeCount);
	console.log("SurfaceBooleanHelper:   over-shared edges = " + result.overSharedEdgeCount);
	console.log("SurfaceBooleanHelper:   loops = " + result.loops.length +
		(result.loops.length > 0 ? " (sizes: " + result.loops.map(function (l) { return l.length; }).join(", ") + ")" : ""));
	console.log("SurfaceBooleanHelper:   closed = " + isClosed);
}

// ────────────────────────────────────────────────────────
// Degenerate / sliver triangle removal
// ────────────────────────────────────────────────────────

/**
 * Compute the area of a triangle in 3D using the cross-product method.
 * @param {Object} tri - {v0, v1, v2}
 * @returns {number} Area in square metres
 */
function triangleArea3D(tri) {
	var ux = tri.v1.x - tri.v0.x;
	var uy = tri.v1.y - tri.v0.y;
	var uz = tri.v1.z - tri.v0.z;
	var vx = tri.v2.x - tri.v0.x;
	var vy = tri.v2.y - tri.v0.y;
	var vz = tri.v2.z - tri.v0.z;
	// cross product
	var cx = uy * vz - uz * vy;
	var cy = uz * vx - ux * vz;
	var cz = ux * vy - uy * vx;
	return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

/**
 * Remove degenerate and sliver triangles from a triangle soup.
 *
 * Degenerate: area < minArea (default 1e-6 m²)
 * Sliver: minimum altitude / maximum edge length < sliverRatio (default 0.01)
 *
 * The minimum altitude test catches long-thin triangles that have non-trivial
 * area but are effectively 1D — these cause over-shared edges, internal walls,
 * and prevent clean boundary loops.
 *
 * @param {Array} tris - Triangle soup [{v0, v1, v2}, ...]
 * @param {number} [minArea=1e-6] - Minimum triangle area in m²
 * @param {number} [sliverRatio=0.01] - Min altitude / max edge threshold
 * @returns {Array} Filtered triangle soup
 */
function removeDegenerateTriangles(tris, minArea, sliverRatio) {
	if (typeof minArea === "undefined") minArea = 1e-6;
	if (typeof sliverRatio === "undefined") sliverRatio = 0.01;

	var removed = 0;
	var result = [];

	for (var i = 0; i < tris.length; i++) {
		var tri = tris[i];
		var area = triangleArea3D(tri);

		// Remove near-zero-area triangles
		if (area < minArea) {
			removed++;
			continue;
		}

		// Compute edge lengths
		var e0 = dist3(tri.v0, tri.v1);
		var e1 = dist3(tri.v1, tri.v2);
		var e2 = dist3(tri.v2, tri.v0);
		var maxEdge = Math.max(e0, e1, e2);

		// Minimum altitude = 2 * area / maxEdge
		// If this is very small relative to maxEdge, it's a sliver
		if (maxEdge > 0) {
			var minAlt = (2 * area) / maxEdge;
			if (minAlt / maxEdge < sliverRatio) {
				removed++;
				continue;
			}
		}

		result.push(tri);
	}

	if (removed > 0) {
		console.log("SurfaceBooleanHelper: removeDegenerateTriangles — removed " +
			removed + " degenerate/sliver tris, " + result.length + " remain (was " + tris.length + ")");
	}

	return result;
}

// ────────────────────────────────────────────────────────
// Stitch by proximity — connect nearby boundary edges
// ────────────────────────────────────────────────────────

/**
 * Stitch open boundary edges that are close in 3D space.
 *
 * Instead of pairing entire loops and zipping them (which creates massive
 * spanning triangles), this finds individual boundary edge endpoints that
 * are within `stitchTolerance` of each other and connects them with quads.
 *
 * Algorithm:
 *   1. Extract all boundary edges (edges with count === 1)
 *   2. Build a spatial grid of boundary edge midpoints
 *   3. For each boundary edge, find nearby boundary edges
 *   4. If two boundary edges share close endpoints (within tolerance),
 *      connect them with 2 triangles (a quad)
 *   5. After proximity stitching, flat-cap any remaining small loops
 *
 * @param {Array} tris - Triangle soup [{v0, v1, v2}, ...]
 * @param {number} [stitchTolerance=1.0] - Max 3D distance to connect boundary edges
 * @returns {Array} Additional triangles from stitching
 */
function stitchByProximity(tris, stitchTolerance) {
	if (typeof stitchTolerance === "undefined") stitchTolerance = 1.0;

	var PREC = 6;
	function vKey(v) {
		return v.x.toFixed(PREC) + "," + v.y.toFixed(PREC) + "," + v.z.toFixed(PREC);
	}
	function edgeKey(ka, kb) {
		return ka < kb ? ka + "|" + kb : kb + "|" + ka;
	}

	// Step 1) Build edge count map — boundary edges appear exactly once
	var edgeMap = {};
	var halfEdges = {};

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
			halfEdges[keys[e] + "|" + keys[ne]] = true;
		}
	}

	// Collect boundary edges
	var boundaryEdges = [];
	for (var ek2 in edgeMap) {
		if (edgeMap[ek2].count === 1) {
			var be = edgeMap[ek2];
			// Orient: boundary direction opposite to existing half-edge
			if (halfEdges[be.k0 + "|" + be.k1]) {
				boundaryEdges.push({ v0: be.v1, v1: be.v0, k0: be.k1, k1: be.k0 });
			} else {
				boundaryEdges.push({ v0: be.v0, v1: be.v1, k0: be.k0, k1: be.k1 });
			}
		}
	}

	if (boundaryEdges.length === 0) {
		console.log("SurfaceBooleanHelper: stitchByProximity — no boundary edges");
		return [];
	}

	console.log("SurfaceBooleanHelper: stitchByProximity — " + boundaryEdges.length +
		" boundary edges, tolerance=" + stitchTolerance.toFixed(4) + "m");

	// Step 2) Build spatial grid of boundary vertex endpoints for fast lookup
	var cellSize = Math.max(stitchTolerance * 3, 0.1);
	var vertGrid = {}; // cellKey -> [{ edgeIdx, vertIdx (0 or 1), vertex }]

	function gridKey(v) {
		var gx = Math.floor(v.x / cellSize);
		var gy = Math.floor(v.y / cellSize);
		var gz = Math.floor(v.z / cellSize);
		return gx + "," + gy + "," + gz;
	}

	for (var bi = 0; bi < boundaryEdges.length; bi++) {
		var bEdge = boundaryEdges[bi];
		for (var vi = 0; vi < 2; vi++) {
			var vert = vi === 0 ? bEdge.v0 : bEdge.v1;
			var gk = gridKey(vert);
			if (!vertGrid[gk]) vertGrid[gk] = [];
			vertGrid[gk].push({ edgeIdx: bi, vertIdx: vi, vertex: vert });
		}
	}

	// Step 3) For each boundary vertex, find close boundary vertices from OTHER edges
	// and build a merge map: vertexKey → merged vertex position
	var mergeMap = {}; // vertexKey -> targetVertexKey
	var usedEdges = {}; // edgeIdx -> true (already stitched)
	var extraTris = [];
	var stitchedCount = 0;

	for (var si = 0; si < boundaryEdges.length; si++) {
		if (usedEdges[si]) continue;
		var srcEdge = boundaryEdges[si];

		// Find a nearby boundary edge where BOTH endpoints are within tolerance
		var bestMatch = -1;
		var bestTotalDist = Infinity;
		var bestFlip = false;

		// Check nearby cells for v0
		var gk0 = gridKey(srcEdge.v0);
		var gx0 = Math.floor(srcEdge.v0.x / cellSize);
		var gy0 = Math.floor(srcEdge.v0.y / cellSize);
		var gz0 = Math.floor(srcEdge.v0.z / cellSize);

		// Collect candidate edges from nearby vertices
		var candidates = {};
		for (var dx = -1; dx <= 1; dx++) {
			for (var dy = -1; dy <= 1; dy++) {
				for (var dz = -1; dz <= 1; dz++) {
					var checkKey = (gx0 + dx) + "," + (gy0 + dy) + "," + (gz0 + dz);
					var cell = vertGrid[checkKey];
					if (!cell) continue;
					for (var ci = 0; ci < cell.length; ci++) {
						var cand = cell[ci];
						if (cand.edgeIdx === si || usedEdges[cand.edgeIdx]) continue;
						candidates[cand.edgeIdx] = true;
					}
				}
			}
		}

		// Check each candidate edge: both endpoints must be within tolerance
		for (var candIdx in candidates) {
			var candEdge = boundaryEdges[candIdx];

			// Try both orientations: (src.v0↔cand.v0, src.v1↔cand.v1) and (src.v0↔cand.v1, src.v1↔cand.v0)
			var d00 = dist3(srcEdge.v0, candEdge.v0);
			var d11 = dist3(srcEdge.v1, candEdge.v1);
			var d01 = dist3(srcEdge.v0, candEdge.v1);
			var d10 = dist3(srcEdge.v1, candEdge.v0);

			var totalSame = d00 + d11;
			var totalFlip = d01 + d10;

			if (totalSame <= totalFlip) {
				if (d00 <= stitchTolerance && d11 <= stitchTolerance && totalSame < bestTotalDist) {
					bestMatch = parseInt(candIdx);
					bestTotalDist = totalSame;
					bestFlip = false;
				}
			} else {
				if (d01 <= stitchTolerance && d10 <= stitchTolerance && totalFlip < bestTotalDist) {
					bestMatch = parseInt(candIdx);
					bestTotalDist = totalFlip;
					bestFlip = true;
				}
			}
		}

		if (bestMatch >= 0) {
			var matchEdge = boundaryEdges[bestMatch];
			usedEdges[si] = true;
			usedEdges[bestMatch] = true;
			stitchedCount++;

			// Build quad between the two edges (2 triangles)
			// srcEdge: v0→v1, matchEdge: v0→v1 (or flipped)
			var mV0 = bestFlip ? matchEdge.v1 : matchEdge.v0;
			var mV1 = bestFlip ? matchEdge.v0 : matchEdge.v1;

			// Quad: srcEdge.v0, srcEdge.v1, mV1, mV0
			// Triangle 1: srcEdge.v0, srcEdge.v1, mV0
			extraTris.push({ v0: srcEdge.v0, v1: srcEdge.v1, v2: mV0 });
			// Triangle 2: srcEdge.v1, mV1, mV0
			extraTris.push({ v0: srcEdge.v1, v1: mV1, v2: mV0 });
		}
	}

	console.log("SurfaceBooleanHelper: stitchByProximity — stitched " + stitchedCount +
		" edge pairs → " + extraTris.length + " new triangles");

	// Step 4) After proximity stitching, check remaining boundary loops and flat-cap small ones
	if (extraTris.length > 0) {
		// Merge stitch triangles into a temporary soup to re-check boundaries
		var tempSoup = tris.slice();
		for (var et = 0; et < extraTris.length; et++) {
			tempSoup.push(extraTris[et]);
		}
		var postResult = extractBoundaryLoops(tempSoup);
		console.log("SurfaceBooleanHelper: after proximity stitch — " +
			postResult.boundaryEdgeCount + " boundary edges, " +
			postResult.loops.length + " loops remain");

		// Flat-cap ALL remaining boundary loops to close the mesh
		for (var li = 0; li < postResult.loops.length; li++) {
			var loop = postResult.loops[li];
			if (loop.length >= 3) {
				var capTris = triangulateLoop(loop);
				for (var ct = 0; ct < capTris.length; ct++) {
					extraTris.push(capTris[ct]);
				}
				console.log("SurfaceBooleanHelper:   flat-capped loop[" + li + "]: " +
					loop.length + " verts → " + capTris.length + " cap tris");
			}
		}
	} else {
		// No edge pairs found within tolerance — flat-cap all boundary loops
		var loopResult = extractBoundaryLoops(tris);
		for (var li2 = 0; li2 < loopResult.loops.length; li2++) {
			var loop2 = loopResult.loops[li2];
			if (loop2.length >= 3) {
				var capTris2 = triangulateLoop(loop2);
				for (var ct2 = 0; ct2 < capTris2.length; ct2++) {
					extraTris.push(capTris2[ct2]);
				}
				console.log("SurfaceBooleanHelper:   flat-capped loop[" + li2 + "]: " +
					loop2.length + " verts → " + capTris2.length + " cap tris");
			}
		}
	}

	return extraTris;
}

// ────────────────────────────────────────────────────────
// Curtain walls + bottom cap — extrude boundary to floor
// ────────────────────────────────────────────────────────

/**
 * Extrude remaining open boundary edges vertically down to a floor plane,
 * then triangulate the bottom cap with earcut.
 *
 * @param {Array} tris - Triangle soup [{v0, v1, v2}, ...]
 * @param {number} floorOffset - Metres below the minimum Z of the mesh
 * @returns {Array} Additional triangles (curtain walls + bottom cap)
 */
function buildCurtainAndCap(tris, floorOffset) {
	var result = extractBoundaryLoops(tris);
	if (result.loops.length === 0) {
		console.log("SurfaceBooleanHelper: buildCurtainAndCap — no boundary loops to curtain");
		return [];
	}

	// Compute floorZ from all triangle vertices
	var minZ = Infinity;
	for (var i = 0; i < tris.length; i++) {
		var tri = tris[i];
		if (tri.v0.z < minZ) minZ = tri.v0.z;
		if (tri.v1.z < minZ) minZ = tri.v1.z;
		if (tri.v2.z < minZ) minZ = tri.v2.z;
	}
	var floorZ = minZ - (floorOffset || 10);

	console.log("SurfaceBooleanHelper: buildCurtainAndCap — " + result.loops.length +
		" loop(s), floorZ=" + floorZ.toFixed(2));

	var extraTris = [];

	for (var li = 0; li < result.loops.length; li++) {
		var loop = result.loops[li];

		// Build curtain walls: for each boundary edge A→B, create 2 triangles (vertical quad)
		var floorVerts = []; // floor-level vertices for bottom cap
		for (var j = 0; j < loop.length; j++) {
			var a = loop[j];
			var b = loop[(j + 1) % loop.length];

			// Top vertices are the boundary vertices
			// Bottom vertices are at floorZ with same XY
			var aBot = { x: a.x, y: a.y, z: floorZ };
			var bBot = { x: b.x, y: b.y, z: floorZ };

			// Quad: A-top → B-top → B-bot → A-bot
			// Triangle 1: A-top, B-top, B-bot  (winding: outward)
			extraTris.push({ v0: a, v1: b, v2: bBot });
			// Triangle 2: A-top, B-bot, A-bot
			extraTris.push({ v0: a, v1: bBot, v2: aBot });

			floorVerts.push(aBot);
		}

		// Bottom cap: triangulate the floor polygon using Constrained Delaunay
		// Floor is flat at floorZ, so use triangulateLoop which projects to best-fit plane
		var capTris = triangulateLoop(floorVerts);
		for (var ci = 0; ci < capTris.length; ci++) {
			// Reverse winding so normals face downward
			extraTris.push({
				v0: capTris[ci].v2,
				v1: capTris[ci].v1,
				v2: capTris[ci].v0
			});
		}

		console.log("SurfaceBooleanHelper:   loop[" + li + "]: " + loop.length +
			" edges → " + (loop.length * 2) + " wall tris + " +
			capTris.length + " cap tris");
	}

	return extraTris;
}

// ────────────────────────────────────────────────────────
// Force-close indexed mesh — works on integer point indices
// ────────────────────────────────────────────────────────

/**
 * Operates on the INDEXED mesh (after weld). Uses integer point indices
 * to find boundary edges and close them — zero floating-point precision issues.
 *
 * For each boundary edge, finds the nearest point index (by 3D distance)
 * that won't create an over-shared edge, and adds a closing triangle.
 * Iterates until closed or no more progress.
 *
 * @param {Array} points - [{x,y,z}, ...]
 * @param {Array} triangles - [{vertices: [{x,y,z},{x,y,z},{x,y,z}]}, ...]
 * @returns {Object} - { points, triangles } — updated indexed mesh
 */
function forceCloseIndexedMesh(points, triangles) {
	// Convert to index-based representation for integer operations
	var ptIndex = {};
	for (var pi = 0; pi < points.length; pi++) {
		var pk = points[pi].x + "," + points[pi].y + "," + points[pi].z;
		ptIndex[pk] = pi;
	}

	var idxTris = [];
	for (var ti = 0; ti < triangles.length; ti++) {
		var v = triangles[ti].vertices;
		var i0 = ptIndex[v[0].x + "," + v[0].y + "," + v[0].z];
		var i1 = ptIndex[v[1].x + "," + v[1].y + "," + v[1].z];
		var i2 = ptIndex[v[2].x + "," + v[2].y + "," + v[2].z];
		if (i0 !== undefined && i1 !== undefined && i2 !== undefined) {
			idxTris.push([i0, i1, i2]);
		}
	}

	// Build spatial grid for fast nearest-point lookup
	var cellSize = 2.0;
	var grid = {};
	for (var gi = 0; gi < points.length; gi++) {
		var gp = points[gi];
		var gk = Math.floor(gp.x / cellSize) + "," + Math.floor(gp.y / cellSize) + "," + Math.floor(gp.z / cellSize);
		if (!grid[gk]) grid[gk] = [];
		grid[gk].push(gi);
	}

	var totalAdded = 0;
	var maxPasses = 30;

	for (var pass = 0; pass < maxPasses; pass++) {
		var edgeMap = {};
		for (var ei = 0; ei < idxTris.length; ei++) {
			var t = idxTris[ei];
			for (var e = 0; e < 3; e++) {
				var a = t[e], b = t[(e + 1) % 3];
				var ek = a < b ? a + "|" + b : b + "|" + a;
				edgeMap[ek] = (edgeMap[ek] || 0) + 1;
			}
		}

		var boundaryEdges = [];
		for (var bek in edgeMap) {
			if (edgeMap[bek] === 1) {
				var parts = bek.split("|");
				boundaryEdges.push([parseInt(parts[0]), parseInt(parts[1])]);
			}
		}

		if (boundaryEdges.length === 0) {
			console.log("SurfaceBooleanHelper: forceCloseIndexedMesh — CLOSED after " +
				pass + " passes, " + totalAdded + " triangles added");
			break;
		}

		var newTris = [];
		var usedEdges = {};

		for (var bi = 0; bi < boundaryEdges.length; bi++) {
			var be = boundaryEdges[bi];
			var beKey = be[0] < be[1] ? be[0] + "|" + be[1] : be[1] + "|" + be[0];
			if (usedEdges[beKey]) continue;

			var p0 = points[be[0]];
			var p1 = points[be[1]];
			var mid = {
				x: (p0.x + p1.x) / 2,
				y: (p0.y + p1.y) / 2,
				z: (p0.z + p1.z) / 2
			};

			var mgx = Math.floor(mid.x / cellSize);
			var mgy = Math.floor(mid.y / cellSize);
			var mgz = Math.floor(mid.z / cellSize);

			var bestIdx = -1;
			var bestDist = Infinity;

			for (var dx = -1; dx <= 1; dx++) {
				for (var dy = -1; dy <= 1; dy++) {
					for (var dz = -1; dz <= 1; dz++) {
						var cell = grid[(mgx + dx) + "," + (mgy + dy) + "," + (mgz + dz)];
						if (!cell) continue;
						for (var ci = 0; ci < cell.length; ci++) {
							var cIdx = cell[ci];
							if (cIdx === be[0] || cIdx === be[1]) continue;

							var cp = points[cIdx];
							var ddx = mid.x - cp.x, ddy = mid.y - cp.y, ddz = mid.z - cp.z;
							var d2 = ddx * ddx + ddy * ddy + ddz * ddz;
							if (d2 >= bestDist) continue;

							var ek0 = be[0] < cIdx ? be[0] + "|" + cIdx : cIdx + "|" + be[0];
							var ek1 = be[1] < cIdx ? be[1] + "|" + cIdx : cIdx + "|" + be[1];
							if ((edgeMap[ek0] || 0) >= 2) continue;
							if ((edgeMap[ek1] || 0) >= 2) continue;

							var abx = p1.x - p0.x, aby = p1.y - p0.y, abz = p1.z - p0.z;
							var acx = cp.x - p0.x, acy = cp.y - p0.y, acz = cp.z - p0.z;
							var cx2 = aby * acz - abz * acy;
							var cy2 = abz * acx - abx * acz;
							var cz2 = abx * acy - aby * acx;
							var area = cx2 * cx2 + cy2 * cy2 + cz2 * cz2;
							if (area < 1e-12) continue;

							bestIdx = cIdx;
							bestDist = d2;
						}
					}
				}
			}

			if (bestIdx >= 0) {
				idxTris.push([be[0], be[1], bestIdx]);
				newTris.push([be[0], be[1], bestIdx]);
				usedEdges[beKey] = true;

				var nek0 = be[0] < bestIdx ? be[0] + "|" + bestIdx : bestIdx + "|" + be[0];
				var nek1 = be[1] < bestIdx ? be[1] + "|" + bestIdx : bestIdx + "|" + be[1];
				edgeMap[nek0] = (edgeMap[nek0] || 0) + 1;
				edgeMap[nek1] = (edgeMap[nek1] || 0) + 1;
				edgeMap[beKey] = 2;
			}
		}

		if (newTris.length === 0) {
			console.log("SurfaceBooleanHelper: forceCloseIndexedMesh — no more closeable gaps after " +
				pass + " passes, " + totalAdded + " added, " + boundaryEdges.length + " boundary edges remain");
			break;
		}

		totalAdded += newTris.length;
		console.log("SurfaceBooleanHelper: forceCloseIndexedMesh pass " + pass +
			" — added " + newTris.length + " tris (" + boundaryEdges.length + " boundary edges)");
	}

	// Convert back to vertices format
	var outTris = [];
	for (var oi = 0; oi < idxTris.length; oi++) {
		var t2 = idxTris[oi];
		outTris.push({
			vertices: [
				{ x: points[t2[0]].x, y: points[t2[0]].y, z: points[t2[0]].z },
				{ x: points[t2[1]].x, y: points[t2[1]].y, z: points[t2[1]].z },
				{ x: points[t2[2]].x, y: points[t2[2]].y, z: points[t2[2]].z }
			]
		});
	}

	return { points: points, triangles: outTris };
}

// ────────────────────────────────────────────────────────
// Generate closing triangles — fill boundary gaps locally
// ────────────────────────────────────────────────────────

/**
 * For each boundary edge, find the nearest vertex (not already connected)
 * that can form a valid closing triangle. Iterates until no more gaps can
 * be filled or a pass adds no new triangles.
 *
 * @param {Array} tris - Triangle soup [{v0, v1, v2}, ...]
 * @param {number} maxDist - Maximum search distance for closing vertex
 * @returns {Array} - Updated triangle soup with closing triangles added
 */
function generateClosingTriangles(tris, maxDist) {
	var PREC = 6;
	function vKey(v) {
		return v.x.toFixed(PREC) + "," + v.y.toFixed(PREC) + "," + v.z.toFixed(PREC);
	}
	function edgeKey(ka, kb) {
		return ka < kb ? ka + "|" + kb : kb + "|" + ka;
	}
	function dist3sq(a, b) {
		var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
		return dx * dx + dy * dy + dz * dz;
	}
	function triArea(a, b, c) {
		var abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
		var acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
		var cx = aby * acz - abz * acy;
		var cy = abz * acx - abx * acz;
		var cz = abx * acy - aby * acx;
		return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
	}

	var maxDistSq = maxDist * maxDist;
	var totalAdded = 0;
	var maxPasses = 20;

	for (var pass = 0; pass < maxPasses; pass++) {
		// Build edge count map and vertex position map
		var edgeMap = {};  // edgeKey -> count
		var vertPos = {};  // vKey -> {x,y,z}

		for (var i = 0; i < tris.length; i++) {
			var tri = tris[i];
			var verts = [tri.v0, tri.v1, tri.v2];
			var keys = [vKey(verts[0]), vKey(verts[1]), vKey(verts[2])];

			for (var e = 0; e < 3; e++) {
				vertPos[keys[e]] = verts[e];
				var ne = (e + 1) % 3;
				var ek = edgeKey(keys[e], keys[ne]);
				edgeMap[ek] = (edgeMap[ek] || 0) + 1;
			}
		}

		// Collect boundary edges (count === 1)
		var boundaryEdges = [];
		var boundaryVertKeys = {};

		for (var ek2 in edgeMap) {
			if (edgeMap[ek2] === 1) {
				var parts = ek2.split("|");
				boundaryEdges.push({ k0: parts[0], k1: parts[1] });
				boundaryVertKeys[parts[0]] = true;
				boundaryVertKeys[parts[1]] = true;
			}
		}

		if (boundaryEdges.length === 0) {
			console.log("SurfaceBooleanHelper: generateClosingTriangles — mesh is closed after " +
				pass + " passes, " + totalAdded + " triangles added");
			return tris;
		}

		// Build spatial grid of ALL vertices for fast nearest-neighbor lookup
		var cellSize = Math.max(maxDist, 1.0);
		var grid = {};
		var allKeys = Object.keys(vertPos);
		for (var vi = 0; vi < allKeys.length; vi++) {
			var vp = vertPos[allKeys[vi]];
			var gk = Math.floor(vp.x / cellSize) + "," + Math.floor(vp.y / cellSize) + "," + Math.floor(vp.z / cellSize);
			if (!grid[gk]) grid[gk] = [];
			grid[gk].push(allKeys[vi]);
		}

		// For each boundary edge, find the best closing vertex
		var newTris = [];
		var usedEdges = {}; // prevent double-closing an edge in one pass

		for (var bi = 0; bi < boundaryEdges.length; bi++) {
			var be = boundaryEdges[bi];
			var bek = edgeKey(be.k0, be.k1);
			if (usedEdges[bek]) continue;

			var v0 = vertPos[be.k0];
			var v1 = vertPos[be.k1];

			// Midpoint of boundary edge
			var mid = {
				x: (v0.x + v1.x) / 2,
				y: (v0.y + v1.y) / 2,
				z: (v0.z + v1.z) / 2
			};

			// Search nearby cells for candidate vertex
			var bestKey = null;
			var bestDistSq = Infinity;
			var mgx = Math.floor(mid.x / cellSize);
			var mgy = Math.floor(mid.y / cellSize);
			var mgz = Math.floor(mid.z / cellSize);

			for (var dx = -1; dx <= 1; dx++) {
				for (var dy = -1; dy <= 1; dy++) {
					for (var dz = -1; dz <= 1; dz++) {
						var cell = grid[(mgx + dx) + "," + (mgy + dy) + "," + (mgz + dz)];
						if (!cell) continue;
						for (var ci = 0; ci < cell.length; ci++) {
							var ck = cell[ci];
							// Skip the edge's own vertices
							if (ck === be.k0 || ck === be.k1) continue;

							var cv = vertPos[ck];
							var d2 = dist3sq(mid, cv);
							if (d2 > maxDistSq) continue;
							if (d2 >= bestDistSq) continue;

							// Check the two new edges wouldn't be over-shared (>2 uses)
							var ek0c = edgeKey(be.k0, ck);
							var ek1c = edgeKey(be.k1, ck);
							var c0 = edgeMap[ek0c] || 0;
							var c1 = edgeMap[ek1c] || 0;
							if (c0 >= 2 || c1 >= 2) continue;

							// Check triangle has reasonable area (not degenerate)
							var area = triArea(v0, v1, cv);
							if (area < 1e-6) continue;

							bestKey = ck;
							bestDistSq = d2;
						}
					}
				}
			}

			if (bestKey !== null) {
				var cv2 = vertPos[bestKey];
				newTris.push({ v0: v0, v1: v1, v2: cv2 });

				// Update edge counts so we don't double-close in this pass
				usedEdges[bek] = true;
				var ek0c2 = edgeKey(be.k0, bestKey);
				var ek1c2 = edgeKey(be.k1, bestKey);
				edgeMap[ek0c2] = (edgeMap[ek0c2] || 0) + 1;
				edgeMap[ek1c2] = (edgeMap[ek1c2] || 0) + 1;
				edgeMap[bek] = 2; // boundary edge now shared by 2 tris
			}
		}

		if (newTris.length === 0) {
			console.log("SurfaceBooleanHelper: generateClosingTriangles — no more closeable gaps after " +
				pass + " passes, " + totalAdded + " triangles added, " +
				boundaryEdges.length + " boundary edges remain");
			return tris;
		}

		// Append new triangles
		for (var ni = 0; ni < newTris.length; ni++) {
			tris.push(newTris[ni]);
		}
		totalAdded += newTris.length;
		console.log("SurfaceBooleanHelper: generateClosingTriangles pass " + pass +
			" — added " + newTris.length + " closing tris (" + boundaryEdges.length + " boundary edges were open)");
	}

	console.log("SurfaceBooleanHelper: generateClosingTriangles — finished " + maxPasses +
		" passes, " + totalAdded + " triangles added total");
	return tris;
}

// ────────────────────────────────────────────────────────
// Crossing triangle cleanup — remove duplicates from splitting
// ────────────────────────────────────────────────────────

/**
 * Remove duplicate/conflicting triangles that cause over-shared edges (count > 2).
 * These typically result from triangle splitting where sub-triangles overlap.
 *
 * Two-pass approach:
 *   Pass 1: For each over-shared edge, sort its triangles by area (largest first)
 *           and mark the smallest ones for removal until only 2 remain per edge.
 *   Pass 2: Also remove exact fingerprint duplicates among flagged triangles.
 *
 * This is more aggressive than fingerprint-only dedup — it catches near-overlapping
 * slivers that share edges but aren't vertex-identical.
 *
 * @param {Array} tris - Triangle soup [{v0, v1, v2}, ...]
 * @returns {Array} Cleaned triangle soup
 */
function cleanCrossingTriangles(tris) {
	var PREC = 6;

	function vKey(v) {
		return v.x.toFixed(PREC) + "," + v.y.toFixed(PREC) + "," + v.z.toFixed(PREC);
	}

	function edgeKey(ka, kb) {
		return ka < kb ? ka + "|" + kb : kb + "|" + ka;
	}

	// Step 1) Precompute areas and build edge→[triIndex] map
	var areas = [];
	var edgeToTris = {}; // edgeKey -> [triIndex, ...]
	var triKeys = []; // per-triangle: [vKey0, vKey1, vKey2]

	for (var i = 0; i < tris.length; i++) {
		var tri = tris[i];
		areas.push(triangleArea3D(tri));
		var k0 = vKey(tri.v0);
		var k1 = vKey(tri.v1);
		var k2 = vKey(tri.v2);
		triKeys.push([k0, k1, k2]);

		var edges = [edgeKey(k0, k1), edgeKey(k1, k2), edgeKey(k2, k0)];
		for (var e = 0; e < 3; e++) {
			if (!edgeToTris[edges[e]]) edgeToTris[edges[e]] = [];
			edgeToTris[edges[e]].push(i);
		}
	}

	// Step 2) For each over-shared edge, mark smallest-area triangles for removal
	var removeSet = {}; // triIndex -> true
	var overSharedEdgeCount = 0;

	for (var ek in edgeToTris) {
		var triList = edgeToTris[ek];
		if (triList.length <= 2) continue;
		overSharedEdgeCount++;

		// Sort by area descending — keep the 2 largest, mark rest for removal
		var sorted = triList.slice().sort(function (a, b) { return areas[b] - areas[a]; });
		for (var r = 2; r < sorted.length; r++) {
			removeSet[sorted[r]] = true;
		}
	}

	// Step 3) Also remove exact fingerprint duplicates (catches vertex-identical copies)
	var seenFingerprints = {};
	var dupCount = 0;

	for (var j = 0; j < tris.length; j++) {
		if (removeSet[j]) continue; // already marked

		var keys = triKeys[j].slice().sort();
		var fingerprint = keys.join("||");
		if (seenFingerprints[fingerprint]) {
			removeSet[j] = true;
			dupCount++;
		} else {
			seenFingerprints[fingerprint] = true;
		}
	}

	// Step 4) Build result
	var removedCount = Object.keys(removeSet).length;
	if (removedCount === 0) {
		console.log("SurfaceBooleanHelper: cleanCrossingTriangles — no over-shared edges, nothing to clean");
		return tris;
	}

	var result = [];
	for (var k = 0; k < tris.length; k++) {
		if (!removeSet[k]) {
			result.push(tris[k]);
		}
	}

	console.log("SurfaceBooleanHelper: cleanCrossingTriangles — " +
		overSharedEdgeCount + " over-shared edges, " +
		removedCount + " removed (" + dupCount + " fingerprint dups), " +
		result.length + " remain (was " + tris.length + ")");

	return result;
}

// ────────────────────────────────────────────────────────
// Overlapping triangle removal — internal wall cleanup
// ────────────────────────────────────────────────────────

/**
 * Remove overlapping triangles that form internal walls.
 *
 * After boolean merge, triangles from both surfaces can overlap at the
 * intersection seam, creating internal partition walls (visible as stepped
 * faces inside the solid). This function detects and removes them.
 *
 * Detection: Two triangles overlap when:
 *   - Their centroids are within `tolerance` in 3D
 *   - Their normals are nearly anti-parallel (dot product < -0.5)
 *   - They have similar areas (ratio > 0.3)
 *
 * For each overlapping pair, the smaller triangle is removed.
 * If normals are nearly parallel (dot > 0.5) and centroids close, it's a
 * near-duplicate — the smaller one is also removed.
 *
 * @param {Array} tris - Triangle soup [{v0, v1, v2}, ...]
 * @param {number} [tolerance=0.5] - Max centroid distance to consider overlap
 * @returns {Array} Cleaned triangle soup
 */
function removeOverlappingTriangles(tris, tolerance) {
	if (typeof tolerance === "undefined") tolerance = 0.5;

	// Precompute centroids, normals, areas
	var centroids = [];
	var normals = [];
	var areas = [];

	for (var i = 0; i < tris.length; i++) {
		var tri = tris[i];
		// Centroid
		centroids.push({
			x: (tri.v0.x + tri.v1.x + tri.v2.x) / 3,
			y: (tri.v0.y + tri.v1.y + tri.v2.y) / 3,
			z: (tri.v0.z + tri.v1.z + tri.v2.z) / 3
		});
		// Normal (unnormalized cross product)
		var ux = tri.v1.x - tri.v0.x, uy = tri.v1.y - tri.v0.y, uz = tri.v1.z - tri.v0.z;
		var vx = tri.v2.x - tri.v0.x, vy = tri.v2.y - tri.v0.y, vz = tri.v2.z - tri.v0.z;
		var nx = uy * vz - uz * vy;
		var ny = uz * vx - ux * vz;
		var nz = ux * vy - uy * vx;
		var nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
		if (nLen > 0) { nx /= nLen; ny /= nLen; nz /= nLen; }
		normals.push({ x: nx, y: ny, z: nz });
		// Area
		areas.push(0.5 * nLen);
	}

	// Build spatial grid of centroids
	var cellSize = Math.max(tolerance * 2, 0.1);
	var grid = {};

	function gKey(c) {
		return Math.floor(c.x / cellSize) + "," + Math.floor(c.y / cellSize) + "," + Math.floor(c.z / cellSize);
	}

	for (var gi = 0; gi < tris.length; gi++) {
		var gk = gKey(centroids[gi]);
		if (!grid[gk]) grid[gk] = [];
		grid[gk].push(gi);
	}

	// Find overlapping pairs
	var removeSet = {};
	var overlapCount = 0;
	var dupCount = 0;

	for (var si = 0; si < tris.length; si++) {
		if (removeSet[si]) continue;

		var sc = centroids[si];
		var gx = Math.floor(sc.x / cellSize);
		var gy = Math.floor(sc.y / cellSize);
		var gz = Math.floor(sc.z / cellSize);

		for (var dx = -1; dx <= 1; dx++) {
			for (var dy = -1; dy <= 1; dy++) {
				for (var dz = -1; dz <= 1; dz++) {
					var cell = grid[(gx + dx) + "," + (gy + dy) + "," + (gz + dz)];
					if (!cell) continue;

					for (var ci = 0; ci < cell.length; ci++) {
						var ti = cell[ci];
						if (ti <= si || removeSet[ti]) continue;

						// Check centroid distance
						var cdist = dist3(sc, centroids[ti]);
						if (cdist > tolerance) continue;

						// Check area similarity (ratio > 0.3)
						var areaRatio = Math.min(areas[si], areas[ti]) / Math.max(areas[si], areas[ti]);
						if (areaRatio < 0.3) continue;

						// Check normal relationship
						var dot = normals[si].x * normals[ti].x +
							normals[si].y * normals[ti].y +
							normals[si].z * normals[ti].z;

						if (dot < -0.5) {
							// Anti-parallel normals → internal wall pair
							// Remove the smaller triangle
							if (areas[si] <= areas[ti]) {
								removeSet[si] = true;
							} else {
								removeSet[ti] = true;
							}
							overlapCount++;
						} else if (dot > 0.5) {
							// Parallel normals, close centroids → near-duplicate
							// Remove the smaller triangle
							if (areas[si] <= areas[ti]) {
								removeSet[si] = true;
							} else {
								removeSet[ti] = true;
							}
							dupCount++;
						}
					}
				}
			}
		}
	}

	var removedCount = Object.keys(removeSet).length;
	if (removedCount === 0) {
		console.log("SurfaceBooleanHelper: removeOverlappingTriangles — no overlaps found (tol=" + tolerance.toFixed(3) + ")");
		return tris;
	}

	var result = [];
	for (var ri = 0; ri < tris.length; ri++) {
		if (!removeSet[ri]) result.push(tris[ri]);
	}

	console.log("SurfaceBooleanHelper: removeOverlappingTriangles — " +
		"removed " + removedCount + " (" + overlapCount + " anti-parallel, " +
		dupCount + " near-dup), " + result.length + " remain (was " + tris.length + ", tol=" + tolerance.toFixed(3) + ")");

	return result;
}

// ────────────────────────────────────────────────────────
// Boundary vertex weld — close seam gaps by snapping open-edge vertices
// ────────────────────────────────────────────────────────

/**
 * Weld boundary vertices (open-edge endpoints) to nearby boundary vertices
 * using a higher tolerance than the general weld. This closes seam gaps at
 * the intersection without distorting interior geometry.
 *
 * Only vertices on boundary edges (count=1) are candidates for snapping.
 * Interior vertices are untouched.
 *
 * @param {Array} tris - Triangle soup [{v0, v1, v2}, ...]
 * @param {number} tolerance - Max 3D distance to snap boundary vertices
 * @returns {Array} Triangle soup with boundary vertices merged
 */
function weldBoundaryVertices(tris, tolerance) {
	if (tolerance <= 0) return tris;

	var PREC = 6;
	function vKey(v) {
		return v.x.toFixed(PREC) + "," + v.y.toFixed(PREC) + "," + v.z.toFixed(PREC);
	}
	function edgeKey(ka, kb) {
		return ka < kb ? ka + "|" + kb : kb + "|" + ka;
	}

	// Step 1) Build edge count map and collect boundary vertices
	var edgeMap = {};
	for (var i = 0; i < tris.length; i++) {
		var tri = tris[i];
		var verts = [tri.v0, tri.v1, tri.v2];
		var keys = [vKey(verts[0]), vKey(verts[1]), vKey(verts[2])];
		for (var e = 0; e < 3; e++) {
			var ne = (e + 1) % 3;
			var ek = edgeKey(keys[e], keys[ne]);
			if (!edgeMap[ek]) edgeMap[ek] = { count: 0, k0: keys[e], k1: keys[ne], v0: verts[e], v1: verts[ne] };
			edgeMap[ek].count++;
		}
	}

	// Collect unique boundary vertex keys and their positions
	var boundaryVerts = {}; // vKey -> {x, y, z}
	for (var ek2 in edgeMap) {
		if (edgeMap[ek2].count === 1) {
			boundaryVerts[edgeMap[ek2].k0] = edgeMap[ek2].v0;
			boundaryVerts[edgeMap[ek2].k1] = edgeMap[ek2].v1;
		}
	}

	var bvKeys = Object.keys(boundaryVerts);
	if (bvKeys.length === 0) return tris;

	// Step 2) Build spatial grid of boundary vertices
	var cellSize = Math.max(tolerance * 2, 0.01);
	var grid = {};
	var tolSq = tolerance * tolerance;

	for (var bi = 0; bi < bvKeys.length; bi++) {
		var bv = boundaryVerts[bvKeys[bi]];
		var gk = Math.floor(bv.x / cellSize) + "," + Math.floor(bv.y / cellSize) + "," + Math.floor(bv.z / cellSize);
		if (!grid[gk]) grid[gk] = [];
		grid[gk].push(bvKeys[bi]);
	}

	// Step 3) Build merge map: for each boundary vertex, find nearest boundary vertex
	// within tolerance. Use union-find to group them into clusters.
	var parent = {};
	for (var pi = 0; pi < bvKeys.length; pi++) {
		parent[bvKeys[pi]] = bvKeys[pi];
	}

	function find(k) {
		while (parent[k] !== k) {
			parent[k] = parent[parent[k]]; // path compression
			k = parent[k];
		}
		return k;
	}

	function union(a, b) {
		var ra = find(a), rb = find(b);
		if (ra !== rb) parent[ra] = rb;
	}

	for (var si = 0; si < bvKeys.length; si++) {
		var sv = boundaryVerts[bvKeys[si]];
		var sgx = Math.floor(sv.x / cellSize);
		var sgy = Math.floor(sv.y / cellSize);
		var sgz = Math.floor(sv.z / cellSize);

		for (var dx = -1; dx <= 1; dx++) {
			for (var dy = -1; dy <= 1; dy++) {
				for (var dz = -1; dz <= 1; dz++) {
					var cell = grid[(sgx + dx) + "," + (sgy + dy) + "," + (sgz + dz)];
					if (!cell) continue;
					for (var ci = 0; ci < cell.length; ci++) {
						if (cell[ci] === bvKeys[si]) continue;
						var cv = boundaryVerts[cell[ci]];
						var ddx = sv.x - cv.x, ddy = sv.y - cv.y, ddz = sv.z - cv.z;
						if (ddx * ddx + ddy * ddy + ddz * ddz <= tolSq) {
							union(bvKeys[si], cell[ci]);
						}
					}
				}
			}
		}
	}

	// Step 4) Compute cluster centroids (average position of merged vertices)
	var clusters = {}; // rootKey -> { sumX, sumY, sumZ, count }
	for (var ki = 0; ki < bvKeys.length; ki++) {
		var root = find(bvKeys[ki]);
		var v = boundaryVerts[bvKeys[ki]];
		if (!clusters[root]) {
			clusters[root] = { sumX: 0, sumY: 0, sumZ: 0, count: 0 };
		}
		clusters[root].sumX += v.x;
		clusters[root].sumY += v.y;
		clusters[root].sumZ += v.z;
		clusters[root].count++;
	}

	// Build final merge map: original vKey → new position
	var mergeMap = {}; // vKey -> {x, y, z}
	var mergedCount = 0;
	for (var mi = 0; mi < bvKeys.length; mi++) {
		var root2 = find(bvKeys[mi]);
		var cl = clusters[root2];
		if (cl.count > 1) {
			mergeMap[bvKeys[mi]] = {
				x: cl.sumX / cl.count,
				y: cl.sumY / cl.count,
				z: cl.sumZ / cl.count
			};
			mergedCount++;
		}
	}

	if (mergedCount === 0) {
		console.log("SurfaceBooleanHelper: weldBoundaryVertices — no boundary vertices within tolerance (" +
			tolerance.toFixed(3) + "m), " + bvKeys.length + " boundary verts checked");
		return tris;
	}

	// Step 5) Apply merge map to all triangles
	function remap(v) {
		var k = vKey(v);
		if (mergeMap[k]) return mergeMap[k];
		return v;
	}

	var result = [];
	var collapsed = 0;
	for (var ri = 0; ri < tris.length; ri++) {
		var rv0 = remap(tris[ri].v0);
		var rv1 = remap(tris[ri].v1);
		var rv2 = remap(tris[ri].v2);

		// Skip degenerate triangles where merging collapsed vertices
		var k0 = vKey(rv0), k1 = vKey(rv1), k2 = vKey(rv2);
		if (k0 === k1 || k1 === k2 || k0 === k2) {
			collapsed++;
			continue;
		}

		result.push({ v0: rv0, v1: rv1, v2: rv2 });
	}

	console.log("SurfaceBooleanHelper: weldBoundaryVertices — merged " + mergedCount +
		" boundary verts into " + Object.keys(clusters).filter(function (k) { return clusters[k].count > 1; }).length +
		" clusters (tol=" + tolerance.toFixed(3) + "m), " + collapsed + " collapsed tris, " +
		result.length + " remain (was " + tris.length + ")");

	return result;
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
