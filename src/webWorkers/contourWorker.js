//src/webWorkers/contourWorker.js

// This worker is used to calculate the contours of the blast holes

// Import D3 for Delaunay triangulation in worker
importScripts("/libs/d3.min.js");

self.onmessage = function (e) {
    const { type, data } = e.data;

    try {
        switch (type) {
            case "CALCULATE_CONTOURS":
                const result = calculateContoursInWorker(data);
                self.postMessage({
                    type: "CONTOURS_RESULT",
                    data: result,
                    success: true,
                });
                break;

            default:
                throw new Error("Unknown message type: " + type);
        }
    } catch (error) {
        self.postMessage({
            type: "ERROR",
            error: error.message,
            success: false,
        });
    }
};

// Step 1) Interpolation function - essential for contour crossing points
function interpolate(p1, p2, contourLevel) {
    const t = (contourLevel - p1.z) / (p2.z - p1.z);
    return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
    };
}

// Step 2) Main contour calculation function - fixed to match sync version
function calculateContoursInWorker(workerData) {
    const {
        contourData,
        contourLevels, // Changed: now expects array of levels
        maxEdgeLength,
        displayContours,
        displayFirstMovements,
        displayRelief,
        firstMovementSize = 2,
    } = workerData;

    // Step 3) Early return if no display options enabled
    if (!displayContours && !displayFirstMovements && !displayRelief) {
        return {
            contourLinesArray: [],
            directionArrows: [],
        };
    }

    if (!contourData || !Array.isArray(contourData) || contourData.length === 0) {
        return { contourLinesArray: [], directionArrows: [] };
    }

    const factor = 1.6;
    const minAngleThreshold = 5;
    const surfaceAreaThreshold = 0.1;

    // Step 4) Filter out holes where holeTime is null
    const filteredContourData = contourData.filter((hole) => hole.holeTime !== null);

    if (filteredContourData.length < 3) {
        return { contourLinesArray: [], directionArrows: [] };
    }

    // Step 5) Helper function for distance calculation
    function getLocalAverageDistance(targetPoint, allPoints, neighborCount = 6) {
        const distances = [];

        for (let i = 0; i < allPoints.length; i++) {
            if (allPoints[i] === targetPoint) continue;

            const dx = targetPoint.x - allPoints[i].x;
            const dy = targetPoint.y - allPoints[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            distances.push(distance);
        }

        distances.sort((a, b) => a - b);
        const nearestDistances = distances.slice(0, Math.min(neighborCount, distances.length));

        return nearestDistances.length > 0 ? nearestDistances.reduce((sum, dist) => sum + dist, 0) / nearestDistances.length : maxEdgeLength;
    }

    // Step 6) Cache for performance
    const localAverageCache = new Map();
    function getCachedLocalAverage(point) {
        if (!localAverageCache.has(point)) {
            localAverageCache.set(point, getLocalAverageDistance(point, filteredContourData, 6));
        }
        return localAverageCache.get(point);
    }

    // Step 7) Compute Delaunay triangulation
    const delaunay = d3.Delaunay.from(filteredContourData.map((hole) => [hole.x, hole.y]));
    const triangles = delaunay.triangles;

    if (!triangles || triangles.length === 0) {
        return { contourLinesArray: [], directionArrows: [] };
    }

    const contourLinesArray = [];
    const directionArrows = [];

    // Step 8) Process each contour level
    for (let levelIndex = 0; levelIndex < contourLevels.length; levelIndex++) {
        const contourLevel = contourLevels[levelIndex];
        const contourLines = [];

        // Step 9) Process triangles for this contour level
        for (let i = 0; i < triangles.length; i += 3) {
            const contourLine = [];

            const p1 = contourData[triangles[i]];
            const p2 = contourData[triangles[i + 1]];
            const p3 = contourData[triangles[i + 2]];

            // Step 10) Get cached local average distances for adaptive filtering
            const p1LocalAvg = getCachedLocalAverage(p1);
            const p2LocalAvg = getCachedLocalAverage(p2);
            const p3LocalAvg = getCachedLocalAverage(p3);

            const triangleLocalAverage = (p1LocalAvg + p2LocalAvg + p3LocalAvg) / 3;
            const adaptiveMaxEdgeLength = Math.min(maxEdgeLength, triangleLocalAverage * factor);

            // Step 11) Calculate triangle properties for direction arrows
            const centroidX = (p1.x + p2.x + p3.x) / 3;
            const centroidY = (p1.y + p2.y + p3.y) / 3;

            // Step 12) Calculate edge lengths and check filtering
            const edge1Length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const edge2Length = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));
            const edge3Length = Math.sqrt(Math.pow(p1.x - p3.x, 2) + Math.pow(p1.y - p3.y, 2));

            let trianglePassesFilter = true;
            if (edge1Length > adaptiveMaxEdgeLength || edge2Length > adaptiveMaxEdgeLength || edge3Length > adaptiveMaxEdgeLength) {
                trianglePassesFilter = false;
            }

            // Step 13) Check triangle angles to reject acute triangles
            if (trianglePassesFilter) {
                const edge1Squared = edge1Length * edge1Length;
                const edge2Squared = edge2Length * edge2Length;
                const edge3Squared = edge3Length * edge3Length;

                const angle1 = Math.acos(Math.max(-1, Math.min(1, (edge2Squared + edge3Squared - edge1Squared) / (2 * edge2Length * edge3Length)))) * (180 / Math.PI);
                const angle2 = Math.acos(Math.max(-1, Math.min(1, (edge1Squared + edge3Squared - edge2Squared) / (2 * edge1Length * edge3Length)))) * (180 / Math.PI);
                const angle3 = Math.acos(Math.max(-1, Math.min(1, (edge1Squared + edge2Squared - edge3Squared) / (2 * edge1Length * edge2Length)))) * (180 / Math.PI);

                const minAngle = Math.min(angle1, angle2, angle3);
                if (minAngle < minAngleThreshold) {
                    trianglePassesFilter = false;
                }
            }

            // Step 14) Only process triangles that pass filtering
            if (trianglePassesFilter) {
                // Step 15) Create direction arrows for first movement
                if (levelIndex === 0 && displayFirstMovements) {
                    const surfaceArea = Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2);

                    if (surfaceArea > surfaceAreaThreshold) {
                        const v1X = p2.x - p1.x;
                        const v1Y = p2.y - p1.y;
                        const v1Z = p2.z - p1.z;

                        const v2X = p3.x - p1.x;
                        const v2Y = p3.y - p1.y;
                        const v2Z = p3.z - p1.z;

                        const slopeX = v1Y * v2Z - v1Z * v2Y;
                        const slopeY = v1Z * v2X - v1X * v2Z;
                        const slopeLength = Math.sqrt(slopeX * slopeX + slopeY * slopeY);

                        if (slopeLength > 0) {
                            const normSlopeX = slopeX / slopeLength;
                            const normSlopeY = slopeY / slopeLength;

                            const arrowEndX = centroidX - normSlopeX * firstMovementSize;
                            const arrowEndY = centroidY - normSlopeY * firstMovementSize;

                            directionArrows.push([centroidX, centroidY, arrowEndX, arrowEndY, "goldenrod", firstMovementSize]);
                        }
                    }
                }

                // Step 16) FIXED: Check each edge for contour level crossings
                for (let j = 0; j < 3; j++) {
                    const edgeP1 = contourData[triangles[i + j]];
                    const edgeP2 = contourData[triangles[i + ((j + 1) % 3)]];

                    // Step 17) Calculate distance between edge points
                    const distance = Math.sqrt(Math.pow(edgeP2.x - edgeP1.x, 2) + Math.pow(edgeP2.y - edgeP1.y, 2));

                    // Step 18) CRITICAL: Only create contour point if level crosses the edge
                    if (distance <= adaptiveMaxEdgeLength && ((edgeP1.z < contourLevel && edgeP2.z >= contourLevel) || (edgeP1.z >= contourLevel && edgeP2.z < contourLevel))) {
                        // Step 19) Interpolate to find exact crossing point
                        const point = interpolate(edgeP1, edgeP2, contourLevel);
                        contourLine.push(point);
                    }
                }

                // Step 20) Only add contour line if it has exactly 2 points (proper line segment)
                if (contourLine.length === 2) {
                    contourLines.push(contourLine);
                }
            }
        }

        // Step 21) Add this level's contour lines to the array
        contourLinesArray.push(contourLines);
    }

    // Step 22) Filter direction arrows
    const interval = 1;
    const filteredArrows = directionArrows.filter((arrow, index) => index % interval === 0);

    return {
        contourLinesArray,
        directionArrows: filteredArrows,
    };
}

console.log("Contour worker ready");
