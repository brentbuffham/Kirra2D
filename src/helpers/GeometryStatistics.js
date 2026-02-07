/**
 * GeometryStatistics.js
 * Geometry statistics calculations for KAD drawings
 */

/**
 * Calculate 2D area of a polygon using Shoelace formula
 * Works for both convex and concave polygons (any simple polygon)
 * Uses only X,Y coordinates (ignores Z elevation)
 * @param {Array} points - Array of objects with pointXLocation, pointYLocation
 * @returns {number} Area in square meters (always positive)
 */
export function calculatePolygonArea2D(points) {
    if (!points || points.length < 3) return 0;

    var area = 0;
    var n = points.length;

    for (var i = 0; i < n; i++) {
        var x1 = Number(points[i].pointXLocation) || 0;
        var y1 = Number(points[i].pointYLocation) || 0;
        var x2 = Number(points[(i + 1) % n].pointXLocation) || 0;
        var y2 = Number(points[(i + 1) % n].pointYLocation) || 0;
        area += x1 * y2 - x2 * y1;
    }

    return Math.abs(area / 2);
}

/**
 * Calculate total length of a polyline (2D only, ignores Z)
 * @param {Array} points - Array of objects with pointXLocation, pointYLocation
 * @returns {number} Total length in meters
 */
export function calculatePolylineLength2D(points) {
    if (!points || points.length < 2) return 0;

    var totalLength = 0;

    for (var i = 0; i < points.length - 1; i++) {
        var dx = (Number(points[i + 1].pointXLocation) || 0) - (Number(points[i].pointXLocation) || 0);
        var dy = (Number(points[i + 1].pointYLocation) || 0) - (Number(points[i].pointYLocation) || 0);
        totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    return totalLength;
}

/**
 * Calculate number of segments
 * For polygons (closed): segments = vertices
 * For lines (open): segments = vertices - 1
 * @param {number} vertexCount - Number of vertices
 * @param {boolean} isClosed - Whether the shape is closed (polygon)
 * @returns {number} Number of segments
 */
export function calculateSegmentCount(vertexCount, isClosed) {
    if (vertexCount < 2) return 0;
    return isClosed ? vertexCount : vertexCount - 1;
}

/**
 * Format statistics string for entity node meta in TreeView
 * @param {string} entityType - 'point', 'line', 'poly', 'circle', 'text'
 * @param {Array} data - Entity data array
 * @returns {string} Formatted statistics string
 */
export function formatEntityStatistics(entityType, data) {
    if (!data || data.length === 0) return "V=0";

    var vertexCount = data.length;

    switch (entityType) {
        case "point":
        case "circle":
        case "text":
            return "V=" + vertexCount;

        case "line": {
            var length = calculatePolylineLength2D(data);
            var lineSegments = calculateSegmentCount(vertexCount, false);
            return "L=" + length.toFixed(1) + "m S=" + lineSegments;
        }

        case "poly": {
            var area = calculatePolygonArea2D(data);
            var polySegments = calculateSegmentCount(vertexCount, true);
            return "A=" + area.toFixed(1) + "m\u00B2 S=" + polySegments;
        }

        default:
            return "V=" + vertexCount;
    }
}
