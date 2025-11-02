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
	window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
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

export function drawKADTexts(x, y, z, text, color) {
	//window.ctx.fillStyle = color;
	window.ctx.font = parseInt(window.currentFontSize - 2) + "px Arial";
	window.ctx.save(); // Save the context state before setting shadow
	drawMultilineText(window.ctx, text, x, y, window.currentFontSize, "left", color, color, false);
	window.ctx.restore(); // Restore context state
}

