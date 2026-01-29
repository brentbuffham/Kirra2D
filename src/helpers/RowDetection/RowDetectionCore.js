// src/helpers/RowDetection/RowDetectionCore.js
//=============================================================
// CORE ROW DETECTION FUNCTIONS
//=============================================================
// Step 0) Core detection algorithms: sequence-based, line fitting, adaptive grid
// Extracted from kirra.js lines 39096-39370, 40176-40322

import { estimateRowDirection, getNextRowID, calculateDistanceXY } from "./MathUtilities.js";

// Step 1) Try sequence-based detection using hole ID patterns
// Originally at kirra.js:39096
export function trySequenceBasedDetection(holesData, entityName) {
	// Initialize counters for different hole ID patterns
	var numericCount = 0; // Pure numbers: "1", "2", "123"
	var alphaNumericCount = 0; // Letter+number: "A1", "BUF5", "I23"
	var otherCount = 0; // Everything else

	// Analyze each hole ID to determine its pattern type
	holesData.forEach(function(hole) {
		if (/^\d+$/.test(hole.holeID)) {
			numericCount++;
		} else if (/^[A-Z]+\d+$/i.test(hole.holeID)) {
			alphaNumericCount++;
		} else {
			otherCount++;
		}
	});

	console.log("Hole ID pattern analysis:", {
		numeric: numericCount,
		alphaNumeric: alphaNumericCount,
		other: otherCount,
		total: holesData.length
	});

	// Determine primary pattern type
	var total = holesData.length;
	var numericRatio = numericCount / total;
	var alphaNumericRatio = alphaNumericCount / total;

	// Step 1a) Handle alphanumeric patterns (A1, A2, B1, B2...)
	if (alphaNumericRatio > 0.7) {
		console.log("Using alphanumeric sequence detection");
		return detectRowsFromAlphanumericPattern(holesData, entityName);
	}

	// Step 1b) Handle numeric patterns (1, 2, 3...)
	if (numericRatio > 0.7) {
		console.log("Using numeric sequence detection with line fitting");
		// Sort holes by numeric ID
		var numericHoles = holesData.filter(function(h) {
			return /^\d+$/.test(h.holeID);
		});
		numericHoles.sort(function(a, b) {
			return parseInt(a.holeID) - parseInt(b.holeID);
		});

		return detectRowsUsingLineFitting(numericHoles, entityName);
	}

	// Step 1c) Mixed or other patterns - let caller try other methods
	console.log("No clear sequence pattern found, falling back to spatial methods");
	return false;
}

// Step 2) Detect rows from alphanumeric patterns (A1, A2, B1, B2...)
function detectRowsFromAlphanumericPattern(holesData, entityName) {
	// Group holes by letter prefix
	var groups = {};

	holesData.forEach(function(hole) {
		var match = hole.holeID.match(/^([A-Z]+)(\d+)$/i);
		if (match) {
			var prefix = match[1].toUpperCase();
			var number = parseInt(match[2]);

			if (!groups[prefix]) {
				groups[prefix] = [];
			}
			groups[prefix].push({ hole: hole, number: number });
		}
	});

	// Check if we have meaningful groups
	var prefixes = Object.keys(groups);
	if (prefixes.length === 0) {
		return false;
	}

	// Sort groups by prefix and assign rows
	prefixes.sort();
	var startingRowID = getNextRowID(entityName);

	prefixes.forEach(function(prefix, rowIndex) {
		var group = groups[prefix];
		// Sort by number within group
		group.sort(function(a, b) {
			return a.number - b.number;
		});

		// Assign row and position IDs
		group.forEach(function(item, posIndex) {
			item.hole.rowID = startingRowID + rowIndex;
			item.hole.posID = posIndex + 1;
		});
	});

	console.log("Alphanumeric detection found " + prefixes.length + " rows");
	return true;
}

// Step 3) Detect rows using line fitting algorithm
// Originally at kirra.js:39370
export function detectRowsUsingLineFitting(holesData, entityName) {
	if (!holesData || holesData.length < 2) {
		console.log("Not enough holes for line fitting");
		return false;
	}

	// Parameters for line fitting
	var MAX_PERPENDICULAR_DISTANCE = 2.0; // meters - holes within this distance are same row
	var MIN_HOLES_PER_ROW = 2;

	var rows = [];
	var unassigned = holesData.slice(); // Copy array

	while (unassigned.length >= MIN_HOLES_PER_ROW) {
		// Start new row with first unassigned hole
		var currentRow = [unassigned.shift()];

		// Find direction from first two holes
		if (unassigned.length > 0) {
			// Try to establish row direction
			var rowDirection = estimateRowDirection([currentRow[0], unassigned[0]]);

			// Find all collinear holes
			var i = 0;
			while (i < unassigned.length) {
				var hole = unassigned[i];
				var isCollinear = checkIfCollinear(currentRow, hole, rowDirection, MAX_PERPENDICULAR_DISTANCE);

				if (isCollinear) {
					currentRow.push(unassigned.splice(i, 1)[0]);
					// Update row direction with new hole
					rowDirection = estimateRowDirection(currentRow);
				} else {
					i++;
				}
			}
		}

		if (currentRow.length >= MIN_HOLES_PER_ROW) {
			rows.push(currentRow);
		} else {
			// Put back holes that didn't form a valid row
			unassigned = unassigned.concat(currentRow);
			break; // Prevent infinite loop
		}
	}

	// Assign any remaining holes to nearest row
	unassigned.forEach(function(hole) {
		var nearestRow = findNearestRow(hole, rows);
		if (nearestRow) {
			nearestRow.push(hole);
		} else if (rows.length > 0) {
			rows[rows.length - 1].push(hole);
		}
	});

	// Assign row and position IDs
	var startingRowID = getNextRowID(entityName);
	rows.forEach(function(row, rowIndex) {
		// Sort by position along row direction
		var direction = estimateRowDirection(row);
		row.sort(function(a, b) {
			var projA = a.startXLocation * Math.cos(direction) + a.startYLocation * Math.sin(direction);
			var projB = b.startXLocation * Math.cos(direction) + b.startYLocation * Math.sin(direction);
			return projA - projB;
		});

		row.forEach(function(hole, posIndex) {
			hole.rowID = startingRowID + rowIndex;
			hole.posID = posIndex + 1;
		});
	});

	console.log("Line fitting found " + rows.length + " rows");
	return rows.length > 0;
}

// Step 4) Check if a hole is collinear with existing row
function checkIfCollinear(row, hole, rowDirection, maxDistance) {
	if (row.length === 0) return true;

	// Calculate perpendicular distance from hole to row line
	var rowCentroidX = 0, rowCentroidY = 0;
	row.forEach(function(h) {
		rowCentroidX += h.startXLocation;
		rowCentroidY += h.startYLocation;
	});
	rowCentroidX /= row.length;
	rowCentroidY /= row.length;

	// Project hole onto perpendicular direction
	var perpDirection = rowDirection + Math.PI / 2;
	var dx = hole.startXLocation - rowCentroidX;
	var dy = hole.startYLocation - rowCentroidY;
	var perpDistance = Math.abs(dx * Math.cos(perpDirection) + dy * Math.sin(perpDirection));

	return perpDistance <= maxDistance;
}

// Step 5) Find nearest row for orphan hole
function findNearestRow(hole, rows) {
	var nearestRow = null;
	var nearestDistance = Infinity;

	rows.forEach(function(row) {
		var centroidX = 0, centroidY = 0;
		row.forEach(function(h) {
			centroidX += h.startXLocation;
			centroidY += h.startYLocation;
		});
		centroidX /= row.length;
		centroidY /= row.length;

		var dist = calculateDistanceXY(hole.startXLocation, hole.startYLocation, centroidX, centroidY);
		if (dist < nearestDistance) {
			nearestDistance = dist;
			nearestRow = row;
		}
	});

	return nearestRow;
}

// Step 6) Detect rows using adaptive grid method
// Originally at kirra.js:40176
export function detectRowsUsingAdaptiveGrid(holesData, entityName) {
	if (!holesData || holesData.length < 2) {
		return false;
	}

	// Calculate data extent
	var minX = Infinity, maxX = -Infinity;
	var minY = Infinity, maxY = -Infinity;

	holesData.forEach(function(hole) {
		if (hole.startXLocation < minX) minX = hole.startXLocation;
		if (hole.startXLocation > maxX) maxX = hole.startXLocation;
		if (hole.startYLocation < minY) minY = hole.startYLocation;
		if (hole.startYLocation > maxY) maxY = hole.startYLocation;
	});

	var extentX = maxX - minX;
	var extentY = maxY - minY;

	// Determine grid orientation based on extent
	var isHorizontalPattern = extentX > extentY;

	// Estimate spacing (average nearest neighbor distance)
	var spacing = estimateSpacing(holesData);
	if (spacing < 0.5) spacing = 3.0; // Default if estimation fails

	// Create bins along the shorter axis
	var binSize = spacing * 0.8;
	var numBins = Math.ceil((isHorizontalPattern ? extentY : extentX) / binSize);

	// Assign holes to bins
	var bins = [];
	for (var i = 0; i < numBins; i++) {
		bins.push([]);
	}

	holesData.forEach(function(hole) {
		var coord = isHorizontalPattern ? hole.startYLocation : hole.startXLocation;
		var binIndex = Math.floor((coord - (isHorizontalPattern ? minY : minX)) / binSize);
		binIndex = Math.max(0, Math.min(numBins - 1, binIndex));
		bins[binIndex].push(hole);
	});

	// Filter empty bins and assign rows
	var rows = bins.filter(function(bin) { return bin.length > 0; });
	var startingRowID = getNextRowID(entityName);

	rows.forEach(function(row, rowIndex) {
		// Sort by position along row
		var sortCoord = isHorizontalPattern ? "startXLocation" : "startYLocation";
		row.sort(function(a, b) {
			return a[sortCoord] - b[sortCoord];
		});

		row.forEach(function(hole, posIndex) {
			hole.rowID = startingRowID + rowIndex;
			hole.posID = posIndex + 1;
		});
	});

	console.log("Adaptive grid found " + rows.length + " rows");
	return rows.length > 0;
}

// Step 7) Estimate spacing from data
function estimateSpacing(holesData) {
	if (holesData.length < 2) return 3.0;

	var distances = [];
	var sampleSize = Math.min(20, holesData.length);

	for (var i = 0; i < sampleSize; i++) {
		var hole = holesData[i];
		var minDist = Infinity;

		for (var j = 0; j < holesData.length; j++) {
			if (i === j) continue;
			var dist = calculateDistanceXY(
				hole.startXLocation, hole.startYLocation,
				holesData[j].startXLocation, holesData[j].startYLocation
			);
			if (dist < minDist) minDist = dist;
		}

		if (minDist < Infinity) {
			distances.push(minDist);
		}
	}

	if (distances.length === 0) return 3.0;

	// Return median distance
	distances.sort(function(a, b) { return a - b; });
	return distances[Math.floor(distances.length / 2)];
}

// Step 8) Detect rows using PCA rotation + LOESS adaptive binning
// Originally Enhancement 4 in the plan
export function detectRowsUsingPCAWithLOESS(holesData, entityName) {
	if (!holesData || holesData.length < 4) {
		console.log("Not enough holes for PCA + LOESS detection");
		return false;
	}

	console.log("Using PCA + LOESS for row detection on " + holesData.length + " holes");

	// Step 8a) Calculate PCA to find dominant direction
	var pca = calculatePCA(holesData);
	console.log("PCA direction: " + (pca.angle * 180 / Math.PI).toFixed(1) + " degrees");

	// Step 8b) Rotate data so principal axis is horizontal
	var rotatedData = rotateData(holesData, -pca.angle, pca.meanX, pca.meanY);

	// Step 8c) Apply LOESS smoothing to estimate curved "row axis"
	var loessCurve = loessSmooth(rotatedData, 0.3);

	// Step 8d) Calculate perpendicular distance from each point to LOESS curve
	var distances = calculateDistancesToCurve(rotatedData, loessCurve);

	// Step 8e) Estimate spacing and bin by perpendicular distance
	var spacing = estimateSpacing(holesData);
	var bins = adaptiveBinning(distances, spacing * 0.8);

	// Step 8f) Assign row and position IDs
	var startingRowID = getNextRowID(entityName);

	bins.forEach(function(bin, binIndex) {
		var rowID = startingRowID + binIndex;

		// Sort holes in bin by position along curve (x in rotated space)
		bin.sort(function(a, b) {
			return rotatedData[a.originalIndex].x - rotatedData[b.originalIndex].x;
		});

		bin.forEach(function(item, posIndex) {
			holesData[item.originalIndex].rowID = rowID;
			holesData[item.originalIndex].posID = posIndex + 1;
		});
	});

	console.log("PCA + LOESS found " + bins.length + " rows");
	return bins.length > 0;
}

// Step 9) Calculate PCA for data
function calculatePCA(holesData) {
	var n = holesData.length;

	// Calculate mean
	var sumX = 0, sumY = 0;
	for (var i = 0; i < n; i++) {
		sumX += holesData[i].startXLocation;
		sumY += holesData[i].startYLocation;
	}
	var meanX = sumX / n;
	var meanY = sumY / n;

	// Calculate covariance matrix
	var covarXX = 0, covarXY = 0, covarYY = 0;
	for (var j = 0; j < n; j++) {
		var dx = holesData[j].startXLocation - meanX;
		var dy = holesData[j].startYLocation - meanY;
		covarXX += dx * dx;
		covarXY += dx * dy;
		covarYY += dy * dy;
	}

	// Calculate principal direction
	var trace = covarXX + covarYY;
	var det = covarXX * covarYY - covarXY * covarXY;
	var eigenvalue1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;

	var angle;
	if (Math.abs(covarXY) > 1e-10) {
		angle = Math.atan2(eigenvalue1 - covarXX, covarXY);
	} else {
		angle = covarXX > covarYY ? 0 : Math.PI / 2;
	}

	return { meanX: meanX, meanY: meanY, angle: angle };
}

// Step 10) Rotate data around center point
function rotateData(holesData, angle, centerX, centerY) {
	var cos = Math.cos(angle);
	var sin = Math.sin(angle);

	return holesData.map(function(hole, index) {
		var dx = hole.startXLocation - centerX;
		var dy = hole.startYLocation - centerY;
		return {
			x: dx * cos - dy * sin,
			y: dx * sin + dy * cos,
			originalIndex: index
		};
	});
}

// Step 11) LOESS smoothing for curve estimation
function loessSmooth(rotatedData, bandwidth) {
	// Sort by x
	var sorted = rotatedData.slice().sort(function(a, b) { return a.x - b.x; });
	var n = sorted.length;
	var windowSize = Math.max(3, Math.floor(n * bandwidth));

	var curve = [];
	var step = Math.max(1, Math.floor(n / 50)); // Sample at most 50 points

	for (var i = 0; i < n; i += step) {
		// Find window
		var halfWindow = Math.floor(windowSize / 2);
		var startIdx = Math.max(0, i - halfWindow);
		var endIdx = Math.min(n, i + halfWindow + 1);

		// Tricube weighted average
		var sumWeights = 0;
		var sumX = 0, sumY = 0;

		for (var j = startIdx; j < endIdx; j++) {
			var u = Math.abs(j - i) / halfWindow;
			if (u >= 1) continue;

			var weight = Math.pow(1 - Math.pow(u, 3), 3);
			sumWeights += weight;
			sumX += weight * sorted[j].x;
			sumY += weight * sorted[j].y;
		}

		if (sumWeights > 0) {
			curve.push({
				x: sumX / sumWeights,
				y: sumY / sumWeights
			});
		}
	}

	return curve;
}

// Step 12) Calculate distances from points to LOESS curve
function calculateDistancesToCurve(rotatedData, curve) {
	return rotatedData.map(function(point, index) {
		// Find closest point on curve
		var minDist = Infinity;
		for (var i = 0; i < curve.length - 1; i++) {
			var dist = pointToSegmentDistance(
				point.x, point.y,
				curve[i].x, curve[i].y,
				curve[i + 1].x, curve[i + 1].y
			);
			if (dist < minDist) minDist = dist;
		}
		return {
			originalIndex: index,
			distance: minDist,
			x: point.x
		};
	});
}

// Step 13) Point to segment distance
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	var lengthSq = dx * dx + dy * dy;

	if (lengthSq < 0.0001) {
		return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
	}

	var t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));

	var nearestX = x1 + t * dx;
	var nearestY = y1 + t * dy;

	return Math.sqrt((px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY));
}

// Step 14) Adaptive binning based on spacing
function adaptiveBinning(distances, binSize) {
	// Sort by perpendicular distance
	var sorted = distances.slice().sort(function(a, b) { return a.distance - b.distance; });

	var bins = [];
	var currentBin = [];
	var binStart = sorted[0].distance;

	for (var i = 0; i < sorted.length; i++) {
		var item = sorted[i];

		if (item.distance - binStart > binSize && currentBin.length > 0) {
			bins.push(currentBin);
			currentBin = [item];
			binStart = item.distance;
		} else {
			currentBin.push(item);
		}
	}

	if (currentBin.length > 0) {
		bins.push(currentBin);
	}

	return bins;
}
