/* prettier-ignore-file */
//=================================================
// canvas2DDrawing.js - 2D Canvas Drawing Functions
//=================================================
// All 2D canvas drawing functions extracted from kirra.js
// This module handles 2D rendering on the main canvas

// These functions access globals via window object:
// - ctx, canvas, currentScale, currentFontSize
// - strokeColor, fillColor, textFillColor, depthColor, angleDipColor
// - holeScale, toeSizeInMeters, connScale, firstMovementSize
// - darkModeEnabled, worldToCanvas()

//=================================================
// Canvas Utilities
//=================================================

export function clearCanvas() {
	// Step 1) Reset transform state to identity matrix
	// This prevents 3D rotation state from affecting 2D rendering
	// Fixes quirk where surfaces render above KAD and Holes after 3D rotation
	window.ctx.setTransform(1, 0, 0, 1, 0, 0);
	
	// Step 2) Clear the canvas
	window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
	
	// Step 3) Reset other context state that may have been modified
	window.ctx.globalAlpha = 1.0;
	window.ctx.globalCompositeOperation = "source-over";
}

//=================================================
// Text Drawing Functions
//=================================================

export function drawText(x, y, text, color) {
	window.ctx.font = parseInt(window.currentFontSize - 2) + "px Arial";
	window.ctx.fillStyle = color;
	window.ctx.fillText(text, x, y);
}

export function drawRightAlignedText(x, y, text, color) {
	window.ctx.font = parseInt(window.currentFontSize - 2) + "px Arial";
	const textWidth = window.ctx.measureText(text).width;
	window.ctx.fillStyle = color;
	// Draw the text at an x position minus the text width for right alignment
	drawText(x - textWidth, y, text, color);
}

export function drawMultilineText(ctx, text, x, y, lineHeight = 16, alignment = "left", textColor, boxColor, showBox = false) {
	if (!text) return; //if no text, return
	if (!ctx) return; //if no context, return
	const lines = text.split("\n");
	//calculate the text width of the widest line NOT the the entire sting.
	let textWidth = 0;
	for (let i = 0; i < lines.length; i++) {
		const lineWidth = ctx.measureText(lines[i]).width;
		if (lineWidth > textWidth) {
			textWidth = lineWidth;
		}
	}
	//colorise the text
	ctx.fillStyle = textColor;
	for (let i = 0; i < lines.length; i++) {
		if (alignment == "left") {
			ctx.fillText(lines[i], x, y + i * lineHeight);
		} else if (alignment == "right") {
			ctx.fillText(lines[i], x - textWidth, y + i * lineHeight);
		} else if (alignment == "center") {
			// Center each line individually based on its own width
			const lineWidth = ctx.measureText(lines[i]).width;
			ctx.fillText(lines[i], x - lineWidth / 2, y + i * lineHeight);
		}
	}

	if (showBox) {
		//colorise the box
		//ctx.fillStyle = boxColor;
		ctx.strokeStyle = boxColor;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.roundRect(x - 5 - textWidth / 2, y - 6 - lineHeight / 2, textWidth + 10, lines.length * lineHeight + 6, 4);
		ctx.stroke();
	}
}

//=================================================
// Hole Drawing Functions
//=================================================

export function drawTrack(lineStartX, lineStartY, lineEndX, lineEndY, gradeX, gradeY, strokeColor, subdrillAmount) {
	window.ctx.lineWidth = 1;

	if (subdrillAmount < 0) {
		// NEGATIVE SUBDRILL: Draw only from start to toe (bypass grade)
		// Use 20% opacity for the entire line since it represents "over-drilling"
		window.ctx.beginPath();
		window.ctx.strokeStyle = strokeColor;
		window.ctx.moveTo(lineStartX, lineStartY);
		window.ctx.lineTo(lineEndX, lineEndY);
		window.ctx.stroke();
		// Draw from grade to toe (subdrill portion - red)
		window.ctx.beginPath();
		window.ctx.strokeStyle = "rgba(255, 0, 0, 0.2)"; // Red line (full opacity)
		window.ctx.moveTo(lineEndX, lineEndY);
		window.ctx.lineTo(gradeX, gradeY);
		window.ctx.stroke();
		// Draw grade marker with 20% opacity
		window.ctx.beginPath();
		window.ctx.arc(gradeX, gradeY, 3, 0, 2 * Math.PI);
		window.ctx.fillStyle = `rgba(255, 0, 0, 0.2)`; // Red marker with 20% opacity
		window.ctx.fill();
	} else {
		// POSITIVE SUBDRILL: Draw from start to grade (dark), then grade to toe (red)

		// Draw from start to grade point (bench drill portion - dark)
		window.ctx.beginPath();
		window.ctx.strokeStyle = strokeColor; // Dark line (full opacity)
		window.ctx.moveTo(lineStartX, lineStartY);
		window.ctx.lineTo(gradeX, gradeY);
		window.ctx.stroke();

		// Draw from grade to toe (subdrill portion - red)
		window.ctx.beginPath();
		window.ctx.strokeStyle = "rgba(255, 0, 0, 1.0)"; // Red line (full opacity)
		window.ctx.moveTo(gradeX, gradeY);
		window.ctx.lineTo(lineEndX, lineEndY);
		window.ctx.stroke();

		// Draw grade marker (full opacity)
		window.ctx.beginPath();
		window.ctx.arc(gradeX, gradeY, 3, 0, 2 * Math.PI);
		window.ctx.fillStyle = "rgba(255, 0, 0, 1.0)"; // Red marker (full opacity)
		window.ctx.fill();
	}
}

export function drawHoleToe(x, y, fillColor, strokeColor, radius) {
	// Don't draw toe circle if radius is 0 or less
	if (radius <= 0) return;

	window.ctx.beginPath();
	// Use the toeSizeInMeters directly to set the radius
	window.ctx.lineWidth = 1;
	window.ctx.arc(x, y, radius, 0, 2 * Math.PI);
	window.ctx.fillStyle = fillColor;
	window.ctx.strokeStyle = strokeColor;
	window.ctx.stroke();
	window.ctx.fill();
}

export function drawHole(x, y, radius, fillColor, strokeColor) {
	window.ctx.strokeStyle = strokeColor;
	window.ctx.fillStyle = strokeColor;
	window.ctx.lineWidth = 1;
	window.ctx.beginPath();
	const minRadius = 1.5;
	const drawRadius = radius > minRadius ? radius : minRadius;
	window.ctx.arc(x, y, drawRadius, 0, 2 * Math.PI);
	window.ctx.fill(); // fill the circle with the fill color
	window.ctx.stroke(); // draw the circle border with the stroke color
}

export function drawDummy(x, y, radius, strokeColor) {
	window.ctx.strokeStyle = strokeColor;
	window.ctx.lineWidth = 2; // Adjust the line width as needed
	window.ctx.beginPath();
	window.ctx.moveTo(x - radius, y - radius);
	window.ctx.lineTo(x + radius, y + radius);
	window.ctx.moveTo(x - radius, y + radius);
	window.ctx.lineTo(x + radius, y - radius);
	window.ctx.stroke();
}

export function drawNoDiameterHole(x, y, sideLength, strokeColor) {
	window.ctx.strokeStyle = strokeColor;
	window.ctx.lineWidth = 2; // Adjust the line width as needed
	const halfSide = sideLength / 2;
	window.ctx.beginPath();
	window.ctx.moveTo(x - halfSide, y - halfSide);
	window.ctx.lineTo(x + halfSide, y - halfSide);
	window.ctx.lineTo(x + halfSide, y + halfSide);
	window.ctx.lineTo(x - halfSide, y + halfSide);
	window.ctx.closePath(); // Close the path to form a square
	window.ctx.stroke();
}

export function drawHiHole(x, y, radius, fillColor, strokeColor) {
	window.ctx.strokeStyle = strokeColor;
	window.ctx.beginPath();
	window.ctx.arc(x, y, radius, 0, 2 * Math.PI);
	window.ctx.fillStyle = fillColor;
	window.ctx.fill(); // fill the circle with the fill color
	window.ctx.lineWidth = 5;
	window.ctx.stroke(); // draw the circle border with the stroke color
}

export function drawExplosion(x, y, spikes, outerRadius, innerRadius, color1, color2) {
	let rotation = (Math.PI / 2) * 3;
	let step = Math.PI / spikes;
	let start = rotation;

	// Start the drawing path
	window.ctx.beginPath();
	window.ctx.moveTo(x, y - outerRadius);
	for (let i = 0; i < spikes; i++) {
		window.ctx.lineTo(x + Math.cos(start) * outerRadius, y - Math.sin(start) * outerRadius);
		start += step;

		window.ctx.lineTo(x + Math.cos(start) * innerRadius, y - Math.sin(start) * innerRadius);
		start += step;
	}
	window.ctx.lineTo(x, y - outerRadius);
	window.ctx.closePath();
	window.ctx.lineWidth = 5;
	window.ctx.strokeStyle = color1;
	window.ctx.stroke();
	window.ctx.fillStyle = color2;
	window.ctx.fill();
}

export function drawHexagon(x, y, sideLength, fillColor, strokeColor) {
	window.ctx.strokeStyle = strokeColor;
	window.ctx.beginPath();
	const rotationAngleRadians = (Math.PI / 180) * 30;
	for (let i = 0; i < 6; i++) {
		const angle = rotationAngleRadians + (Math.PI / 3) * i;
		const offsetX = sideLength * Math.cos(angle);
		const offsetY = sideLength * Math.sin(angle);

		if (i === 0) {
			window.ctx.moveTo(x + offsetX, y + offsetY);
		} else {
			window.ctx.lineTo(x + offsetX, y + offsetY);
		}
	}

	window.ctx.closePath();
	window.ctx.fillStyle = fillColor;
	window.ctx.fill(); // fill the hexagon with the fill color
	window.ctx.lineWidth = 5;
	window.ctx.stroke(); // draw the hexagon border with the stroke color
}

//=================================================
// KAD Drawing Functions
//=================================================

export function drawKADPoints(x, y, z, lineWidth = 1, strokeColor) {
	window.ctx.beginPath();
	window.ctx.arc(x, y, lineWidth, 0, 2 * Math.PI);
	window.ctx.strokeStyle = strokeColor;
	window.ctx.fillStyle = strokeColor;
	// Don't use line width use the line width as a proxy for diameter.
	window.ctx.stroke();
	window.ctx.fill();
}

export function drawKADLines(sx, sy, ex, ey, sz, ez, lineWidth, strokeColor) {
	window.ctx.beginPath();
	window.ctx.moveTo(sx, sy);
	window.ctx.lineTo(ex, ey);
	window.ctx.strokeStyle = strokeColor;
	window.ctx.lineWidth = lineWidth;
	window.ctx.stroke();
}

export function drawKADPolys(sx, sy, ex, ey, sz, ez, lineWidth, strokeColor, isClosed) {
	window.ctx.beginPath();
	window.ctx.moveTo(sx, sy);
	window.ctx.lineTo(ex, ey);
	window.ctx.strokeStyle = strokeColor;
	window.ctx.lineWidth = lineWidth;
	window.ctx.stroke();
	if (isClosed) {
		window.ctx.closePath();
	}
}

export function drawKADCircles(x, y, z, radius, lineWidth, strokeColor) {
	window.ctx.strokeStyle = strokeColor;
	window.ctx.beginPath();
	// Convert radius from world units to screen pixels
	const radiusInPixels = radius * window.currentScale;
	window.ctx.arc(x, y, radiusInPixels, 0, 2 * Math.PI);
	window.ctx.lineWidth = lineWidth;
	window.ctx.stroke();
}

export function drawKADTexts(x, y, z, text, color, fontHeight) {
	// Step B2) Use fontHeight if provided, otherwise fall back to window.currentFontSize
	var fontSize = fontHeight || window.currentFontSize || 12;
	window.ctx.font = parseInt(fontSize) + "px Arial";
	window.ctx.save(); // Save the context state before setting shadow
	drawMultilineText(window.ctx, text, x, y, fontSize, "left", color, color, false);
	window.ctx.restore(); // Restore context state
}

//=================================================
// Arrow/Connector Drawing Functions
//=================================================

//First movement direction arrows need to work independant of releif and contour lines. Currently they are not.
export function drawDirectionArrow(startX, startY, endX, endY, fillColor, strokeColor, connScale) {
	try {
		// Step 1) Cache globals for performance
		const ctx = window.ctx;
		const scale = window.currentScale;
		const movementSize = window.firstMovementSize;
		
		// Step 2) Set up the arrow parameters
		var arrowWidth = (movementSize / 4) * scale;
		var arrowLength = 2 * (movementSize / 4) * scale;
		var tailWidth = arrowWidth * 0.7;
		const angle = Math.atan2(endY - startY, endX - startX);

		// Step 3) Set the stroke and fill colors and line width
		ctx.strokeStyle = strokeColor;
		ctx.fillStyle = fillColor;
		ctx.lineWidth = 1; // Ensure consistent border width regardless of contour settings

		// Step 4) Begin drawing the arrow as a single path
		ctx.beginPath();

		// Move to the start point of the arrow
		ctx.moveTo(startX + (tailWidth / 2) * Math.sin(angle), startY - (tailWidth / 2) * Math.cos(angle));

		// Draw to the end point of the tail (top-right corner)
		ctx.lineTo(endX - arrowLength * Math.cos(angle) + (tailWidth / 2) * Math.sin(angle), endY - arrowLength * Math.sin(angle) - (tailWidth / 2) * Math.cos(angle));

		// Draw the right base of the arrowhead
		ctx.lineTo(endX - arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle), endY - arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle));

		// Draw the tip of the arrowhead
		ctx.lineTo(endX, endY);

		// Draw the left base of the arrowhead
		ctx.lineTo(endX - arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle), endY - arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle));

		// Draw back to the bottom-right corner of the tail
		ctx.lineTo(endX - arrowLength * Math.cos(angle) - (tailWidth / 2) * Math.sin(angle), endY - arrowLength * Math.sin(angle) + (tailWidth / 2) * Math.cos(angle));

		// Draw to the bottom-left corner of the tail
		ctx.lineTo(startX - (tailWidth / 2) * Math.sin(angle), startY + (tailWidth / 2) * Math.cos(angle));

		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	} catch (error) {
		console.error("Error while drawing arrow:", error);
	}
}

export function drawArrow(startX, startY, endX, endY, color, connScale, connectorCurve = 0) {
	try {
		// Step 1) Cache globals for performance
		const ctx = window.ctx;
		const scale = window.currentScale;
		
		// Step 2) Set up the arrow parameters
		var arrowWidth = (connScale / 4) * scale;
		var arrowLength = 2 * (connScale / 4) * scale;

		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = 2;

		// Step 3) Handle straight arrow (0 degrees)
		if (connectorCurve === 0) {
			// Draw straight line
			ctx.beginPath();
			ctx.moveTo(parseInt(startX), parseInt(startY));
			ctx.lineTo(parseInt(endX), parseInt(endY));
			ctx.stroke();

			// Calculate angle for arrowhead
			const angle = Math.atan2(startX - endX, startY - endY);
		} else {
			// Step 4) Draw curved arrow
			const midX = (startX + endX) / 2;
			const midY = (startY + endY) / 2;
			const dx = endX - startX;
			const dy = endY - startY;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// Step 5) Calculate control point based on angle in degrees
			const radians = (connectorCurve * Math.PI) / 180;
			const curveFactor = (connectorCurve / 90) * distance * 0.5;

			// Perpendicular vector for curve direction
			const perpX = -dy / distance;
			const perpY = dx / distance;

			const controlX = midX + perpX * curveFactor;
			const controlY = midY + perpY * curveFactor;

			// Step 6) Draw curved line using quadratic bezier
			ctx.beginPath();
			ctx.moveTo(parseInt(startX), parseInt(startY));
			ctx.quadraticCurveTo(parseInt(controlX), parseInt(controlY), parseInt(endX), parseInt(endY));
			ctx.stroke();
		}

		// Step 7) Draw arrowhead
		if (endX == startX && endY == startY) {
			// Draw house shape for self-referencing
			var size = (connScale / 4) * scale;
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(endX, endY);
			ctx.lineTo(endX - size / 2, endY + size);
			ctx.lineTo(endX - size / 2, endY + 1.5 * size);
			ctx.lineTo(endX + size / 2, endY + 1.5 * size);
			ctx.lineTo(endX + size / 2, endY + size);
			ctx.closePath();
			ctx.stroke();
		} else {
			// Step 8) Calculate arrowhead angle for curved or straight arrows
			let angle;
			if (connectorCurve !== 0) {
				// For curved arrows, calculate angle at the end point
				const dx = endX - startX;
				const dy = endY - startY;
				const distance = Math.sqrt(dx * dx + dy * dy);
				const curveFactor = (connectorCurve / 90) * distance * 0.5;
				const perpX = -dy / distance;
				const perpY = dx / distance;
				const controlX = (startX + endX) / 2 + perpX * curveFactor;
				const controlY = (startY + endY) / 2 + perpY * curveFactor;

				// Calculate tangent at end point (derivative of quadratic bezier at t=1)
				const tangentX = 2 * (endX - controlX);
				const tangentY = 2 * (endY - controlY);
				angle = Math.atan2(tangentY, tangentX);

				// Draw arrowhead for curved arrows
				ctx.beginPath();
				ctx.moveTo(parseInt(endX), parseInt(endY));
				ctx.lineTo(endX - arrowLength * Math.cos(angle - Math.PI / 6), endY - arrowLength * Math.sin(angle - Math.PI / 6));
				ctx.lineTo(endX - arrowLength * Math.cos(angle + Math.PI / 6), endY - arrowLength * Math.sin(angle + Math.PI / 6));
				ctx.closePath();
				ctx.fill();
			} else {
				// For straight arrows - use the original working calculation
				angle = Math.atan2(startX - endX, startY - endY);

				// Draw arrowhead for straight arrows (original working method)
				ctx.beginPath();
				ctx.moveTo(parseInt(endX), parseInt(endY));
				ctx.lineTo(endX - arrowLength * Math.cos((Math.PI / 2) * 3 - angle) - arrowWidth * Math.sin((Math.PI / 2) * 3 - angle), endY - arrowLength * Math.sin((Math.PI / 2) * 3 - angle) + arrowWidth * Math.cos((Math.PI / 2) * 3 - angle));
				ctx.lineTo(endX - arrowLength * Math.cos((Math.PI / 2) * 3 - angle) + arrowWidth * Math.sin((Math.PI / 2) * 3 - angle), endY - arrowLength * Math.sin((Math.PI / 2) * 3 - angle) - arrowWidth * Math.cos((Math.PI / 2) * 3 - angle));
				ctx.closePath();
				ctx.fill();
			}
		}
	} catch (error) {
		console.error("Error while drawing arrow:", error);
	}
}

export function drawArrowDelayText(startX, startY, endX, endY, color, text, connectorCurve = 0) {
	// Step 1) Cache globals for performance
	const ctx = window.ctx;
	const fontSize = window.currentFontSize;
	
	// Step 2) Calculate text position and angle
	let textX, textY, textAngle;

	if (connectorCurve === 0) {
		// Straight arrow - use midpoint
		const midX = (startX + endX) / 2;
		const midY = (startY + endY) / 2;
		textAngle = Math.atan2(endY - startY, endX - startX);

		// Calculate perpendicular offset to move text above the line
		const perpAngle = textAngle - Math.PI / 2;
		const offsetDistance = (fontSize - 2) * 0.1;

		textX = midX + Math.cos(perpAngle) * offsetDistance;
		textY = midY + Math.sin(perpAngle) * offsetDistance;
	} else {
		// Step 3) Curved arrow - calculate actual point on curve at t=0.5
		const dx = endX - startX;
		const dy = endY - startY;
		const distance = Math.sqrt(dx * dx + dy * dy);
		const curveFactor = (connectorCurve / 90) * distance * 0.5;

		const perpX = -dy / distance;
		const perpY = dx / distance;

		// Control point
		const controlX = (startX + endX) / 2 + perpX * curveFactor;
		const controlY = (startY + endY) / 2 + perpY * curveFactor;

		// Calculate actual point on quadratic bezier curve at t=0.5 (midpoint)
		const t = 0.5;
		const oneMinusT = 1 - t;
		const curveX = oneMinusT * oneMinusT * startX + 2 * oneMinusT * t * controlX + t * t * endX;
		const curveY = oneMinusT * oneMinusT * startY + 2 * oneMinusT * t * controlY + t * t * endY;

		// Calculate tangent angle at t=0.5 for proper text rotation
		const tangentX = 2 * oneMinusT * (controlX - startX) + 2 * t * (endX - controlX);
		const tangentY = 2 * oneMinusT * (controlY - startY) + 2 * t * (endY - controlY);
		textAngle = Math.atan2(tangentY, tangentX);

		// Calculate perpendicular offset to move text above the curve
		const perpAngle = textAngle - Math.PI / 2;
		const offsetDistance = (fontSize - 2) * 0.1;

		textX = curveX + Math.cos(perpAngle) * offsetDistance;
		textY = curveY + Math.sin(perpAngle) * offsetDistance;
	}

	// Step 4) Draw the text above the curve/line
	ctx.save();
	ctx.translate(textX, textY);
	ctx.rotate(textAngle);

	ctx.fillStyle = color;
	ctx.font = parseInt(fontSize - 2) + "px Arial";

	// Center the text horizontally and position baseline properly
	const textWidth = ctx.measureText(text).width;
	ctx.fillText(text, -textWidth / 2, 0);

	ctx.restore();
}
