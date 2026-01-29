// src/helpers/RowDetection/GraphBasedDetection.js
//=============================================================
// GRAPH-BASED ROW DETECTION
//=============================================================
// Step 0) MST and KNN graph algorithms for row detection
// Extracted from kirra.js lines 39955-40047

import { calculateDistanceXY } from "./MathUtilities.js";

// Step 1) Build Minimum Spanning Tree from points using Prim's algorithm
// Originally at kirra.js:40047
export function buildMinimumSpanningTree(points, distances, minPts) {
	var n = points.length;
	if (n < 2) return [];

	// If distances not provided, calculate them
	if (!distances) {
		distances = [];
		for (var i = 0; i < n; i++) {
			distances[i] = [];
			for (var j = 0; j < n; j++) {
				if (i === j) {
					distances[i][j] = 0;
				} else {
					distances[i][j] = calculateDistanceXY(
						points[i].x || points[i].startXLocation,
						points[i].y || points[i].startYLocation,
						points[j].x || points[j].startXLocation,
						points[j].y || points[j].startYLocation
					);
				}
			}
		}
	}

	return buildMinimumSpanningTreeFromMatrix(distances, minPts || 2);
}

// Step 2) Build MST from distance matrix
// Originally at kirra.js:39955
export function buildMinimumSpanningTreeFromMatrix(distanceMatrix, minPts) {
	var n = distanceMatrix.length;
	if (n < 2) return [];

	var inMST = new Array(n).fill(false);
	var edges = [];
	var minDist = new Array(n).fill(Infinity);
	var parent = new Array(n).fill(-1);

	// Start from vertex 0
	minDist[0] = 0;

	for (var count = 0; count < n; count++) {
		// Find minimum distance vertex not yet in MST
		var u = -1;
		var minVal = Infinity;

		for (var i = 0; i < n; i++) {
			if (!inMST[i] && minDist[i] < minVal) {
				minVal = minDist[i];
				u = i;
			}
		}

		if (u === -1) break; // No more reachable vertices
		inMST[u] = true;

		// Add edge to MST
		if (parent[u] !== -1) {
			edges.push({
				from: parent[u],
				to: u,
				weight: distanceMatrix[parent[u]][u]
			});
		}

		// Update distances to neighboring vertices
		for (var v = 0; v < n; v++) {
			if (!inMST[v] && distanceMatrix[u][v] < minDist[v]) {
				minDist[v] = distanceMatrix[u][v];
				parent[v] = u;
			}
		}
	}

	return edges;
}

// Step 3) Build K-Nearest Neighbors graph
export function buildKNNGraph(points, k) {
	var n = points.length;
	if (n < 2) return [];

	k = Math.min(k, n - 1);
	var graph = [];

	for (var i = 0; i < n; i++) {
		// Calculate distances to all other points
		var distances = [];
		for (var j = 0; j < n; j++) {
			if (i !== j) {
				distances.push({
					index: j,
					dist: calculateDistanceXY(
						points[i].x || points[i].startXLocation,
						points[i].y || points[i].startYLocation,
						points[j].x || points[j].startXLocation,
						points[j].y || points[j].startYLocation
					)
				});
			}
		}

		// Sort by distance and take k nearest
		distances.sort(function(a, b) { return a.dist - b.dist; });
		var neighbors = distances.slice(0, k);

		graph.push({
			index: i,
			neighbors: neighbors
		});
	}

	return graph;
}

// Step 4) Find endpoints in graph (nodes with degree <= 1)
export function findGraphEndpoints(graph) {
	var endpoints = [];

	// Build adjacency count
	var degrees = new Array(graph.length).fill(0);

	graph.forEach(function(node) {
		node.neighbors.forEach(function(neighbor) {
			degrees[node.index]++;
		});
	});

	// Find nodes with low degree
	for (var i = 0; i < degrees.length; i++) {
		if (degrees[i] <= 2) {
			endpoints.push(i);
		}
	}

	return endpoints;
}

// Step 5) Trace path through graph using bearing continuity
export function tracePathWithBearingContinuity(startIndex, graph, visited, maxBearingChange) {
	maxBearingChange = maxBearingChange || 45; // degrees

	var path = [startIndex];
	visited[startIndex] = true;

	var current = startIndex;
	var prevBearing = null;

	while (true) {
		var node = graph[current];
		var bestNeighbor = null;
		var bestBearingDiff = Infinity;

		node.neighbors.forEach(function(neighbor) {
			if (visited[neighbor.index]) return;

			// Calculate bearing to neighbor
			var currentPoint = graph[current];
			var neighborPoint = graph[neighbor.index];

			// Note: This assumes graph nodes have x,y coordinates
			// In practice, you'd need to pass the points array separately
			var bearing = Math.atan2(
				neighborPoint.x - currentPoint.x,
				neighborPoint.y - currentPoint.y
			) * 180 / Math.PI;

			if (prevBearing !== null) {
				var bearingDiff = Math.abs(bearing - prevBearing);
				if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;

				if (bearingDiff <= maxBearingChange && bearingDiff < bestBearingDiff) {
					bestBearingDiff = bearingDiff;
					bestNeighbor = neighbor;
				}
			} else {
				// First step - accept closest neighbor
				if (!bestNeighbor || neighbor.dist < bestNeighbor.dist) {
					bestNeighbor = neighbor;
				}
			}
		});

		if (!bestNeighbor) break;

		// Calculate bearing for next iteration
		var currentPoint = graph[current];
		var nextPoint = graph[bestNeighbor.index];
		prevBearing = Math.atan2(
			nextPoint.x - currentPoint.x,
			nextPoint.y - currentPoint.y
		) * 180 / Math.PI;

		visited[bestNeighbor.index] = true;
		path.push(bestNeighbor.index);
		current = bestNeighbor.index;
	}

	return path;
}

// Step 6) Extract rows from MST by finding longest paths
export function extractRowsFromMST(mst, numPoints) {
	if (mst.length === 0) return [];

	// Build adjacency list
	var adj = [];
	for (var i = 0; i < numPoints; i++) {
		adj[i] = [];
	}

	mst.forEach(function(edge) {
		adj[edge.from].push({ to: edge.to, weight: edge.weight });
		adj[edge.to].push({ to: edge.from, weight: edge.weight });
	});

	// Find leaf nodes (degree 1)
	var leaves = [];
	for (var i = 0; i < numPoints; i++) {
		if (adj[i].length === 1) {
			leaves.push(i);
		}
	}

	// If no leaves, tree is a cycle - pick any node
	if (leaves.length === 0 && numPoints > 0) {
		leaves.push(0);
	}

	// Find longest paths between pairs of leaves
	var rows = [];
	var usedNodes = new Set();

	leaves.forEach(function(startLeaf) {
		if (usedNodes.has(startLeaf)) return;

		// BFS/DFS to find farthest leaf
		var visited = new Array(numPoints).fill(false);
		var path = dfsLongestPath(startLeaf, adj, visited);

		if (path.length >= 2) {
			path.forEach(function(node) {
				usedNodes.add(node);
			});
			rows.push(path);
		}
	});

	return rows;
}

// Step 7) DFS to find longest path from start node
function dfsLongestPath(start, adj, visited) {
	var longestPath = [start];
	visited[start] = true;

	function dfs(node, currentPath) {
		var hasUnvisitedNeighbor = false;

		adj[node].forEach(function(edge) {
			if (!visited[edge.to]) {
				hasUnvisitedNeighbor = true;
				visited[edge.to] = true;
				currentPath.push(edge.to);
				dfs(edge.to, currentPath);

				if (currentPath.length > longestPath.length) {
					longestPath = currentPath.slice();
				}

				currentPath.pop();
				visited[edge.to] = false;
			}
		});
	}

	dfs(start, [start]);
	return longestPath;
}
