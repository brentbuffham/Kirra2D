///------------------ SVG BUILDER MODULE ------------------///
// This module provides SVG string generation functions for vector PDF rendering

/**
 * Creates an SVG circle element
 * @param {number} cx - Center X coordinate
 * @param {number} cy - Center Y coordinate
 * @param {number} r - Radius
 * @param {string} fill - Fill color (CSS color)
 * @param {string} stroke - Stroke color (CSS color)
 * @param {number} strokeWidth - Stroke width
 * @returns {string} SVG circle element string
 */
export function createSVGCircle(cx, cy, r, fill = "none", stroke = "black", strokeWidth = 1) {
    return "<circle cx=\"" + cx + "\" cy=\"" + cy + "\" r=\"" + r + "\" fill=\"" + fill + "\" stroke=\"" + stroke + "\" stroke-width=\"" + strokeWidth + "\"/>";
}

/**
 * Creates an SVG line element
 * @param {number} x1 - Start X coordinate
 * @param {number} y1 - Start Y coordinate
 * @param {number} x2 - End X coordinate
 * @param {number} y2 - End Y coordinate
 * @param {string} stroke - Stroke color (CSS color)
 * @param {number} strokeWidth - Stroke width
 * @returns {string} SVG line element string
 */
export function createSVGLine(x1, y1, x2, y2, stroke = "black", strokeWidth = 1) {
    return "<line x1=\"" + x1 + "\" y1=\"" + y1 + "\" x2=\"" + x2 + "\" y2=\"" + y2 + "\" stroke=\"" + stroke + "\" stroke-width=\"" + strokeWidth + "\"/>";
}

/**
 * Creates an SVG polyline element
 * @param {Array<{x: number, y: number}>|Array<Array<number>>} points - Array of points
 * @param {string} fill - Fill color (CSS color) or "none"
 * @param {string} stroke - Stroke color (CSS color)
 * @param {number} strokeWidth - Stroke width
 * @param {boolean} closed - Whether to close the path
 * @returns {string} SVG polyline/polygon element string
 */
export function createSVGPolyline(points, fill = "none", stroke = "black", strokeWidth = 1, closed = false) {
    let pointsStr = "";
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const x = point.x !== undefined ? point.x : point[0];
        const y = point.y !== undefined ? point.y : point[1];
        pointsStr += x + "," + y + " ";
    }
    const tagName = closed ? "polygon" : "polyline";
    return "<" + tagName + " points=\"" + pointsStr.trim() + "\" fill=\"" + fill + "\" stroke=\"" + stroke + "\" stroke-width=\"" + strokeWidth + "\"/>";
}

/**
 * Creates an SVG path element from path commands
 * @param {string} pathData - SVG path data string (e.g., "M 10 10 L 20 20")
 * @param {string} fill - Fill color (CSS color) or "none"
 * @param {string} stroke - Stroke color (CSS color)
 * @param {number} strokeWidth - Stroke width
 * @param {string} strokeDasharray - Stroke dash array (e.g., "10,5" for dashed lines)
 * @returns {string} SVG path element string
 */
export function createSVGPath(pathData, fill = "none", stroke = "black", strokeWidth = 1, strokeDasharray = null) {
    let attrs = "fill=\"" + fill + "\" stroke=\"" + stroke + "\" stroke-width=\"" + strokeWidth + "\"";
    if (strokeDasharray) {
        attrs += " stroke-dasharray=\"" + strokeDasharray + "\"";
    }
    return "<path d=\"" + pathData + "\" " + attrs + "/>";
}

/**
 * Creates an SVG rectangle element
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {string} fill - Fill color (CSS color) or "none"
 * @param {string} stroke - Stroke color (CSS color)
 * @param {number} strokeWidth - Stroke width
 * @param {string} strokeDasharray - Stroke dash array for dashed lines
 * @returns {string} SVG rectangle element string
 */
export function createSVGRect(x, y, width, height, fill = "none", stroke = "black", strokeWidth = 1, strokeDasharray = null) {
    let attrs = "fill=\"" + fill + "\" stroke=\"" + stroke + "\" stroke-width=\"" + strokeWidth + "\"";
    if (strokeDasharray) {
        attrs += " stroke-dasharray=\"" + strokeDasharray + "\"";
    }
    return "<rect x=\"" + x + "\" y=\"" + y + "\" width=\"" + width + "\" height=\"" + height + "\" " + attrs + "/>";
}

/**
 * Creates an SVG text element
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} text - Text content
 * @param {string} fill - Fill color (CSS color)
 * @param {string} fontSize - Font size (e.g., "12px" or "12")
 * @param {string} fontFamily - Font family (default: "Arial")
 * @param {string} fontWeight - Font weight (default: "normal")
 * @param {string} textAnchor - Text anchor ("start", "middle", "end")
 * @param {string} dominantBaseline - Dominant baseline ("auto", "middle", "hanging", etc.)
 * @returns {string} SVG text element string
 */
export function createSVGText(x, y, text, fill = "black", fontSize = "12", fontFamily = "Arial", fontWeight = "normal", textAnchor = "start", dominantBaseline = "auto") {
    // Convert text to string if it's not already
    const textStr = String(text);
    // Escape XML special characters
    const escapedText = textStr.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    return "<text x=\"" + x + "\" y=\"" + y + "\" fill=\"" + fill + "\" font-size=\"" + fontSize + "\" font-family=\"" + fontFamily + "\" font-weight=\"" + fontWeight + "\" text-anchor=\"" + textAnchor + "\" dominant-baseline=\"" + dominantBaseline + "\">" + escapedText + "</text>";
}

/**
 * Creates an SVG group element
 * @param {string} content - SVG content to wrap in group
 * @param {string} id - Group ID (optional)
 * @param {string} transform - Transform attribute (optional, e.g., "translate(10,20)")
 * @returns {string} SVG group element string
 */
export function createSVGGroup(content, id = null, transform = null) {
    let attrs = "";
    if (id) {
        attrs += " id=\"" + id + "\"";
    }
    if (transform) {
        attrs += " transform=\"" + transform + "\"";
    }
    return "<g" + attrs + ">" + content + "</g>";
}

/**
 * Creates an SVG linear gradient definition
 * @param {string} gradientId - Unique ID for the gradient
 * @param {Array<{offset: number, color: string}>} stops - Array of color stops
 * @param {number} x1 - Start X coordinate (0-1)
 * @param {number} y1 - Start Y coordinate (0-1)
 * @param {number} x2 - End X coordinate (0-1)
 * @param {number} y2 - End Y coordinate (0-1)
 * @returns {string} SVG linearGradient definition string
 */
export function createSVGLinearGradient(gradientId, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 0) {
    let stopsStr = "";
    for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        stopsStr += "<stop offset=\"" + stop.offset + "\" stop-color=\"" + stop.color + "\"/>";
    }
    return "<defs><linearGradient id=\"" + gradientId + "\" x1=\"" + x1 + "\" y1=\"" + y1 + "\" x2=\"" + x2 + "\" y2=\"" + y2 + "\">" + stopsStr + "</linearGradient></defs>";
}

/**
 * Creates a complete SVG document wrapper
 * @param {string} content - SVG content
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @param {string} viewBox - ViewBox attribute (optional, defaults to "0 0 width height")
 * @returns {string} Complete SVG document string
 */
export function createSVGDocument(content, width, height, viewBox = null) {
    const vb = viewBox || ("0 0 " + width + " " + height);
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width + "\" height=\"" + height + "\" viewBox=\"" + vb + "\">" + content + "</svg>";
}

/**
 * Converts RGB color to hex format
 * @param {string} rgb - RGB color string (e.g., "rgb(255,0,0)" or "rgba(255,0,0,0.5)")
 * @returns {string} Hex color string (e.g., "#ff0000" or "#ff000080")
 */
export function rgbToHex(rgb) {
    if (!rgb || rgb.startsWith("#")) {
        return rgb || "#000000";
    }
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) {
        return rgb; // Return as-is if not RGB format
    }
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    const a = match[4] ? Math.round(parseFloat(match[4]) * 255).toString(16).padStart(2, "0") : "";
    return "#" + r + g + b + a;
}

/**
 * Creates an SVG path for an arrow
 * @param {number} startX - Start X coordinate
 * @param {number} startY - Start Y coordinate
 * @param {number} endX - End X coordinate
 * @param {number} endY - End Y coordinate
 * @param {number} arrowLength - Length of arrowhead
 * @param {number} arrowAngle - Angle of arrowhead in radians
 * @returns {string} SVG path data string for arrow
 */
export function createSVGArrowPath(startX, startY, endX, endY, arrowLength = 10, arrowAngle = Math.PI / 6) {
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);
    
    // Arrowhead points
    const arrowX1 = endX - arrowLength * Math.cos(angle - arrowAngle);
    const arrowY1 = endY - arrowLength * Math.sin(angle - arrowAngle);
    const arrowX2 = endX - arrowLength * Math.cos(angle + arrowAngle);
    const arrowY2 = endY - arrowLength * Math.sin(angle + arrowAngle);
    
    return "M " + startX + " " + startY + " L " + endX + " " + endY + " M " + arrowX1 + " " + arrowY1 + " L " + endX + " " + endY + " L " + arrowX2 + " " + arrowY2;
}

