// src/helpers/RowDetection/ClusteringAlgorithms.js
//=============================================================
// CLUSTERING-BASED ROW DETECTION
//=============================================================
// Step 0) HDBSCAN and DBSCAN clustering algorithms for row detection
// Extracted from kirra.js lines 39861-39954, 40432-40884

import {
	estimateRowDirection,
	assignClustersToRows,
	calculateDistanceXY,
	douglasPeucker,
	orderByNearestNeighborChain,
	mean,
	standardDeviation
} from "./MathUtilities.js";
import { buildMinimumSpanningTree } from "./GraphBasedDetection.js";

// Step 1) Detect rows using HDBSCAN clustering
// Originally at kirra.js:39861
export function detectRowsUsingHDBSCAN(holesData, entityName) {
	if (!holesData || holesData.length < 3) {
		console.log("Not enough holes for HDBSCAN");
		return [];
	}

	console.log("Running HDBSCAN clustering on " + holesData.length + " holes");

	// Calculate distance matrix
	var n = holesData.length;
	var distanceMatrix = [];
	for (var i = 0; i < n; i++) {
		distanceMatrix[i] = [];
		for (var j = 0; j < n; j++) {
			if (i === j) {
				distanceMatrix[i][j] = 0;
			} else {
				distanceMatrix[i][j] = calculateDistanceXY(
					holesData[i].startXLocation, holesData[i].startYLocation,
					holesData[j].startXLocation, holesData[j].startYLocation
				);
			}
		}
	}

	// HDBSCAN parameters
	var minClusterSize = Math.max(2, Math.floor(n * 0.1)); // At least 10% of holes
	var minPts = Math.max(2, Math.floor(minClusterSize / 2));

	// Calculate core distances (distance to minPts-th nearest neighbor)
	var coreDistances = [];
	for (var i = 0; i < n; i++) {
		var distances = distanceMatrix[i].slice().sort(function(a, b) { return a - b; });
		coreDistances[i] = distances[Math.min(minPts, n - 1)];
	}

	// Calculate mutual reachability distance
	var mutualReachability = [];
	for (var i = 0; i < n; i++) {
		mutualReachability[i] = [];
		for (var j = 0; j < n; j++) {
			mutualReachability[i][j] = Math.max(
				coreDistances[i],
				coreDistances[j],
				distanceMatrix[i][j]
			);
		}
	}

	// Build MST on mutual reachability graph
	var mst = buildMSTFromMatrix(mutualReachability);

	// Extract clusters by cutting long edges
	var clusters = extractClustersFromMST(mst, n, minClusterSize);

	if (clusters.length === 0) {
		console.log("HDBSCAN found no valid clusters");
		return [];
	}

	// Assign clusters to rows
	assignClustersToRows(holesData, clusters, entityName);

	console.log("HDBSCAN found " + clusters.length + " clusters/rows");
	return clusters;
}

// Step 2) Build MST from distance matrix using Prim's algorithm
function buildMSTFromMatrix(matrix) {
	var n = matrix.length;
	var inMST = new Array(n).fill(false);
	var edges = [];
	var minDist = new Array(n).fill(Infinity);
	var parent = new Array(n).fill(-1);

	minDist[0] = 0;

	for (var count = 0; count < n; count++) {
		// Find minimum distance vertex not in MST
		var u = -1;
		var minVal = Infinity;
		for (var i = 0; i < n; i++) {
			if (!inMST[i] && minDist[i] < minVal) {
				minVal = minDist[i];
				u = i;
			}
		}

		if (u === -1) break;
		inMST[u] = true;

		if (parent[u] !== -1) {
			edges.push({
				from: parent[u],
				to: u,
				weight: matrix[parent[u]][u]
			});
		}

		// Update distances
		for (var v = 0; v < n; v++) {
			if (!inMST[v] && matrix[u][v] < minDist[v]) {
				minDist[v] = matrix[u][v];
				parent[v] = u;
			}
		}
	}

	return edges;
}

// Step 3) Extract clusters from MST by cutting long edges
function extractClustersFromMST(mst, n, minClusterSize) {
	if (mst.length === 0) return [];

	// Sort edges by weight descending
	var sortedEdges = mst.slice().sort(function(a, b) { return b.weight - a.weight; });

	// Calculate threshold (e.g., edges longer than mean + 1.5*std are cut)
	var weights = mst.map(function(e) { return e.weight; });
	var meanWeight = weights.reduce(function(a, b) { return a + b; }, 0) / weights.length;
	var variance = weights.reduce(function(sum, w) {
		return sum + (w - meanWeight) * (w - meanWeight);
	}, 0) / weights.length;
	var stdWeight = Math.sqrt(variance);
	var threshold = meanWeight + 1.5 * stdWeight;

	// Build adjacency list excluding long edges
	var adj = [];
	for (var i = 0; i < n; i++) {
		adj[i] = [];
	}

	mst.forEach(function(edge) {
		if (edge.weight <= threshold) {
			adj[edge.from].push(edge.to);
			adj[edge.to].push(edge.from);
		}
	});

	// Find connected components (clusters)
	var visited = new Array(n).fill(false);
	var clusters = [];

	for (var start = 0; start < n; start++) {
		if (visited[start]) continue;

		var cluster = [];
		var stack = [start];

		while (stack.length > 0) {
			var node = stack.pop();
			if (visited[node]) continue;
			visited[node] = true;
			cluster.push(node);

			adj[node].forEach(function(neighbor) {
				if (!visited[neighbor]) {
					stack.push(neighbor);
				}
			});
		}

		if (cluster.length >= minClusterSize) {
			clusters.push(cluster);
		}
	}

	return clusters;
}

// Step 4) Sequence-weighted HDBSCAN (uses hole ID sequence as additional dimension)
// Originally at kirra.js:40432
export function detectRowsUsingSequenceWeightedHDBSCAN(holesData, entityName) {
	if (!holesData || holesData.length < 3) {
		console.log("Not enough holes for sequence-weighted HDBSCAN");
		return [];
	}

	console.log("Running sequence-weighted HDBSCAN on " + holesData.length + " holes");

	// Extract numeric IDs where possible
	var indexedHoles = holesData.map(function(hole, index) {
		var numericId = 0;
		if (/^\d+$/.test(hole.holeID)) {
			numericId = parseInt(hole.holeID);
		} else {
			var match = hole.holeID.match(/\d+/);
			if (match) {
				numericId = parseInt(match[0]);
			}
		}
		return {
			originalIndex: index,
			hole: hole,
			numericId: numericId
		};
	});

	// Sort by numeric ID to establish sequence
	indexedHoles.sort(function(a, b) { return a.numericId - b.numericId; });

	// Assign sequence positions
	indexedHoles.forEach(function(item, seqIndex) {
		item.sequencePosition = seqIndex;
	});

	// Calculate weighted distance matrix
	// Weight: spatial distance + sequence discontinuity penalty
	var n = holesData.length;
	var maxSpatialDist = 0;

	// First pass: find max spatial distance for normalization
	for (var i = 0; i < n; i++) {
		for (var j = i + 1; j < n; j++) {
			var dist = calculateDistanceXY(
				holesData[i].startXLocation, holesData[i].startYLocation,
				holesData[j].startXLocation, holesData[j].startYLocation
			);
			if (dist > maxSpatialDist) maxSpatialDist = dist;
		}
	}

	if (maxSpatialDist === 0) maxSpatialDist = 1;

	// Build weighted distance matrix
	var distanceMatrix = [];
	var sequenceWeight = 0.3; // How much to weight sequence discontinuity

	for (var i = 0; i < n; i++) {
		distanceMatrix[i] = [];
		var itemI = indexedHoles.find(function(item) { return item.originalIndex === i; });

		for (var j = 0; j < n; j++) {
			if (i === j) {
				distanceMatrix[i][j] = 0;
				continue;
			}

			var itemJ = indexedHoles.find(function(item) { return item.originalIndex === j; });

			// Spatial distance (normalized)
			var spatialDist = calculateDistanceXY(
				holesData[i].startXLocation, holesData[i].startYLocation,
				holesData[j].startXLocation, holesData[j].startYLocation
			) / maxSpatialDist;

			// Sequence distance (normalized by n)
			var seqDist = Math.abs(itemI.sequencePosition - itemJ.sequencePosition) / n;

			// Combined weighted distance
			distanceMatrix[i][j] = (1 - sequenceWeight) * spatialDist + sequenceWeight * seqDist;
		}
	}

	// Run HDBSCAN on weighted matrix
	var minClusterSize = Math.max(2, Math.floor(n * 0.1));
	var minPts = Math.max(2, Math.floor(minClusterSize / 2));

	// Calculate core distances
	var coreDistances = [];
	for (var i = 0; i < n; i++) {
		var distances = distanceMatrix[i].slice().sort(function(a, b) { return a - b; });
		coreDistances[i] = distances[Math.min(minPts, n - 1)];
	}

	// Mutual reachability
	var mutualReachability = [];
	for (var i = 0; i < n; i++) {
		mutualReachability[i] = [];
		for (var j = 0; j < n; j++) {
			mutualReachability[i][j] = Math.max(
				coreDistances[i],
				coreDistances[j],
				distanceMatrix[i][j]
			);
		}
	}

	var mst = buildMSTFromMatrix(mutualReachability);
	var clusters = extractClustersFromMST(mst, n, minClusterSize);

	if (clusters.length === 0) {
		console.log("Sequence-weighted HDBSCAN found no valid clusters");
		return [];
	}

	assignClustersToRows(holesData, clusters, entityName);

	console.log("Sequence-weighted HDBSCAN found " + clusters.length + " clusters/rows");
	return clusters;
}

// =============================================================================
// DBSCAN + DOUGLAS-PEUCKER FALLBACK (Phase 5)
// =============================================================================

// Step 5) Estimate epsilon parameter for DBSCAN using k-distance graph method
/**
 * Estimates optimal epsilon for DBSCAN using the k-distance graph "elbow" method
 * @param {Array} holesData - Array of hole objects
 * @param {number} k - k for k-nearest neighbor (default: 4)
 * @returns {number} - Estimated epsilon value
 */
export function estimateEpsilon(holesData, k) {
	if (!holesData || holesData.length < 2) return 10; // Default fallback

	k = k || Math.min(4, holesData.length - 1);
	var n = holesData.length;

	// Calculate k-distance for each point (distance to k-th nearest neighbor)
	var kDistances = [];

	for (var i = 0; i < n; i++) {
		var distances = [];
		for (var j = 0; j < n; j++) {
			if (i !== j) {
				distances.push(calculateDistanceXY(
					holesData[i].startXLocation, holesData[i].startYLocation,
					holesData[j].startXLocation, holesData[j].startYLocation
				));
			}
		}
		distances.sort(function(a, b) { return a - b; });
		kDistances.push(distances[Math.min(k - 1, distances.length - 1)]);
	}

	// Sort k-distances in ascending order
	kDistances.sort(function(a, b) { return a - b; });

	// Find the "elbow" point using maximum curvature
	// Simple approach: use the point where the slope changes most dramatically
	var maxCurvature = 0;
	var elbowIndex = Math.floor(kDistances.length * 0.9); // Default to 90th percentile

	if (kDistances.length > 5) {
		for (var i = 2; i < kDistances.length - 2; i++) {
			// Approximate second derivative (curvature)
			var curvature = Math.abs(
				kDistances[i + 1] - 2 * kDistances[i] + kDistances[i - 1]
			);
			if (curvature > maxCurvature) {
				maxCurvature = curvature;
				elbowIndex = i;
			}
		}
	}

	// Use the k-distance at the elbow as epsilon
	var epsilon = kDistances[elbowIndex];

	// Sanity check: epsilon should be reasonable (between min spacing and 3x median)
	var medianDist = kDistances[Math.floor(kDistances.length / 2)];
	epsilon = Math.max(medianDist * 0.5, Math.min(epsilon, medianDist * 3));

	console.log("DBSCAN epsilon estimated: " + epsilon.toFixed(2) + "m (median k-dist: " + medianDist.toFixed(2) + "m)");
	return epsilon;
}

// Step 6) DBSCAN clustering algorithm
/**
 * DBSCAN (Density-Based Spatial Clustering of Applications with Noise)
 * @param {Array} holesData - Array of hole objects
 * @param {number} eps - Maximum distance for neighborhood
 * @param {number} minPts - Minimum points to form a dense region
 * @returns {Array} - Array of clusters (each cluster is array of point indices)
 */
export function runDBSCAN(holesData, eps, minPts) {
	if (!holesData || holesData.length < minPts) {
		return [];
	}

	var n = holesData.length;
	var labels = new Array(n).fill(-1); // -1 = unvisited, 0 = noise, >0 = cluster ID
	var clusterID = 0;

	// Helper: find all points within eps distance
	function regionQuery(pointIdx) {
		var neighbors = [];
		for (var i = 0; i < n; i++) {
			if (i !== pointIdx) {
				var dist = calculateDistanceXY(
					holesData[pointIdx].startXLocation, holesData[pointIdx].startYLocation,
					holesData[i].startXLocation, holesData[i].startYLocation
				);
				if (dist <= eps) {
					neighbors.push(i);
				}
			}
		}
		return neighbors;
	}

	// Main DBSCAN loop
	for (var i = 0; i < n; i++) {
		if (labels[i] !== -1) continue; // Already processed

		var neighbors = regionQuery(i);

		if (neighbors.length < minPts - 1) { // -1 because regionQuery doesn't include the point itself
			labels[i] = 0; // Mark as noise
			continue;
		}

		// Start a new cluster
		clusterID++;
		labels[i] = clusterID;

		// Expand cluster
		var seedSet = neighbors.slice();
		var seedIdx = 0;

		while (seedIdx < seedSet.length) {
			var q = seedSet[seedIdx];

			if (labels[q] === 0) {
				labels[q] = clusterID; // Change noise to border point
			}

			if (labels[q] === -1) {
				labels[q] = clusterID;
				var qNeighbors = regionQuery(q);

				if (qNeighbors.length >= minPts - 1) {
					// Add new neighbors to seed set
					for (var k = 0; k < qNeighbors.length; k++) {
						if (seedSet.indexOf(qNeighbors[k]) === -1) {
							seedSet.push(qNeighbors[k]);
						}
					}
				}
			}

			seedIdx++;
		}
	}

	// Convert labels to cluster arrays
	var clusters = [];
	var clusterMap = new Map();

	for (var i = 0; i < n; i++) {
		if (labels[i] > 0) {
			if (!clusterMap.has(labels[i])) {
				clusterMap.set(labels[i], []);
			}
			clusterMap.get(labels[i]).push(i);
		}
	}

	clusterMap.forEach(function(cluster) {
		clusters.push(cluster);
	});

	console.log("DBSCAN found " + clusters.length + " clusters, " +
		labels.filter(function(l) { return l === 0; }).length + " noise points");

	return clusters;
}

// Step 7) Assign points to simplified chain segments
/**
 * Assigns original cluster points to the nearest segment of the simplified chain
 * @param {Array} clusterHoles - Array of hole objects in the cluster
 * @param {Array} simplifiedChain - Array of hole objects representing simplified polyline
 * @returns {Array} - Array of segment groups (each group is holes belonging to that segment)
 */
function assignPointsToChainSegments(clusterHoles, simplifiedChain) {
	if (simplifiedChain.length < 2) {
		return [clusterHoles]; // Single segment containing all holes
	}

	// Create segments from simplified chain
	var segments = [];
	for (var i = 0; i < simplifiedChain.length - 1; i++) {
		segments.push({
			start: simplifiedChain[i],
			end: simplifiedChain[i + 1],
			holes: []
		});
	}

	// Assign each hole to nearest segment
	clusterHoles.forEach(function(hole) {
		var nearestSegIdx = 0;
		var nearestDist = Infinity;

		for (var i = 0; i < segments.length; i++) {
			var seg = segments[i];
			var dist = pointToSegmentDistance(
				hole.startXLocation, hole.startYLocation,
				seg.start.startXLocation, seg.start.startYLocation,
				seg.end.startXLocation, seg.end.startYLocation
			);
			if (dist < nearestDist) {
				nearestDist = dist;
				nearestSegIdx = i;
			}
		}

		segments[nearestSegIdx].holes.push(hole);
	});

	return segments.map(function(seg) { return seg.holes; });
}

// Helper: point to line segment distance
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	var lengthSq = dx * dx + dy * dy;

	if (lengthSq === 0) {
		return calculateDistanceXY(px, py, x1, y1);
	}

	var t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));

	var nearestX = x1 + t * dx;
	var nearestY = y1 + t * dy;

	return calculateDistanceXY(px, py, nearestX, nearestY);
}

// Step 8) Combined DBSCAN + Douglas-Peucker method (Phase 5 fallback)
/**
 * Detects rows using DBSCAN clustering followed by Douglas-Peucker chain simplification
 * This is a robust fallback for irregular patterns
 * @param {Array} holesData - Array of hole objects
 * @param {string} entityName - Entity name for row assignment
 * @returns {Object} - { success: boolean, rows: Array, method: string }
 */
export function detectRowsUsingDBSCANWithDouglasPeucker(holesData, entityName) {
	if (!holesData || holesData.length < 3) {
		console.log("Not enough holes for DBSCAN + Douglas-Peucker");
		return { success: false, rows: [], method: "dbscan-dp" };
	}

	console.log("Running DBSCAN + Douglas-Peucker fallback on " + holesData.length + " holes");

	// Step 1) Estimate epsilon using k-distance graph
	var eps = estimateEpsilon(holesData, 4);

	// Step 2) Run DBSCAN
	var minPts = Math.max(2, Math.floor(holesData.length * 0.05)); // At least 5% of holes
	minPts = Math.min(minPts, 5); // But cap at 5 for small patterns
	var clusters = runDBSCAN(holesData, eps, minPts);

	if (clusters.length === 0) {
		console.log("DBSCAN found no clusters, trying with larger epsilon");
		// Retry with larger epsilon
		eps = eps * 1.5;
		clusters = runDBSCAN(holesData, eps, minPts);

		if (clusters.length === 0) {
			console.log("DBSCAN + Douglas-Peucker: No clusters found");
			return { success: false, rows: [], method: "dbscan-dp" };
		}
	}

	// Step 3) For each cluster, order points using nearest-neighbor chain
	var processedClusters = [];

	clusters.forEach(function(cluster, clusterIdx) {
		if (cluster.length < 2) {
			processedClusters.push(cluster);
			return;
		}

		// Get holes for this cluster
		var clusterHoles = cluster.map(function(idx) { return holesData[idx]; });

		// Order by nearest-neighbor chain
		var chainOrder = orderByNearestNeighborChain(clusterHoles);
		var orderedHoles = chainOrder.map(function(idx) { return clusterHoles[idx]; });

		// Step 4) Apply Douglas-Peucker to simplify the chain
		// Use spacing-based epsilon (simplified chain should be within half spacing)
		var spacings = [];
		for (var i = 0; i < orderedHoles.length - 1; i++) {
			spacings.push(calculateDistanceXY(
				orderedHoles[i].startXLocation, orderedHoles[i].startYLocation,
				orderedHoles[i + 1].startXLocation, orderedHoles[i + 1].startYLocation
			));
		}
		var avgSpacing = spacings.length > 0 ? mean(spacings) : eps;
		var dpEpsilon = avgSpacing * 0.3; // Allow deviation up to 30% of spacing

		var simplifiedChain = douglasPeucker(orderedHoles, dpEpsilon);

		// Step 5) Check if chain should be split (large gaps or direction changes)
		// For now, treat each cluster as one row
		// (Advanced: could split at sharp angles or large gaps)

		// Map back to original indices
		var orderedIndices = chainOrder.map(function(localIdx) {
			return cluster[localIdx];
		});

		processedClusters.push(orderedIndices);

		console.log("Cluster " + (clusterIdx + 1) + ": " + cluster.length + " holes, " +
			"simplified to " + simplifiedChain.length + " vertices");
	});

	// Step 6) Assign to rows
	assignClustersToRows(holesData, processedClusters, entityName);

	console.log("DBSCAN + Douglas-Peucker found " + processedClusters.length + " rows");

	return {
		success: true,
		rows: processedClusters,
		method: "dbscan-dp",
		clusterCount: processedClusters.length
	};
}
