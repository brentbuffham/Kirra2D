// src/fileIO/AutoCadIO/DXFParser.js
//=============================================================
// DXF PARSER
//=============================================================
// Step 1) Parses DXF files to KAD entities and surfaces
// Step 2) Extracted from kirra.js parseDXFtoKadMaps() function (lines 8663-9091)
// Step 3) Handles 9 DXF entity types: POINT, INSERT, LINE, POLYLINE, CIRCLE, ELLIPSE, TEXT, MTEXT, 3DFACE
// Step 4) Created: 2026-01-03

import BaseParser from "../BaseParser.js";

// Step 5) DXFParser class
class DXFParser extends BaseParser {
	constructor(options = {}) {
		super(options);

		// Step 6) DXF-specific options
		this.offsetX = options.offsetX || 0;
		this.offsetY = options.offsetY || 0;
		this.showProgress = options.showProgress !== false; // default true
	}

	// Step 7) Main parse method
	async parse(data) {
		// Step 8) Validate input - expect dxf object from DxfParser library
		if (!data || !data.dxfData) {
			throw new Error("Invalid input: dxfData object required");
		}

		var dxf = data.dxfData;

		// Step 9) Check if DxfParser library is available globally
		if (!window.DxfParser) {
			console.warn("window.DxfParser not available - DXF parsing may require external library");
		}

		// Step 10) Parse DXF data
		return await this.parseDXFData(dxf);
	}

	// Step 11) Parse DXF data from parsed DXF object
	async parseDXFData(dxf) {
		// Step 12) Create progress dialog for DXF parsing
		var progressUpdateDXF = null;
		var progressDialog = null;
		var progressBar = null;
		var progressText = null;
		var totalEntities = dxf.entities ? dxf.entities.length : 0;

		if (this.showProgress && totalEntities > 10 && window.FloatingDialog) {
			var progressContent = "<p>Parsing DXF File</p>" + "<p>Please wait, this may take a moment...</p>" + '<div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">' + '<div id="dxfProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>' + "</div>" + '<p id="dxfProgressText">Initializing...</p>';

			progressDialog = new window.FloatingDialog({
				title: "DXF Import Progress",
				content: progressContent,
				layoutType: "standard",
				width: 400,
				height: 200,
				showConfirm: false,
				showCancel: false,
				draggable: true
			});

			progressDialog.show();

			// Step 13) Wait for dialog to render, then get progress elements
			await new Promise(function (resolve) {
				setTimeout(resolve, 50);
			});

			progressBar = document.getElementById("dxfProgressBar");
			progressText = document.getElementById("dxfProgressText");

			// Step 14) Update progress function
			progressUpdateDXF = function (percent, message) {
				if (progressBar) progressBar.style.width = percent + "%";
				if (progressText) progressText.textContent = message;
			};
		}

		// Step 15) Initialize result maps
		var kadDrawingsMap = new Map();
		var surfacePoints = [];
		var surfaceTriangles = [];

		// Step 16) Seed counters for unique naming
		var counts = {
			point: 0,
			line: 0,
			poly: 0,
			circle: 0,
			text: 0
		};

		// Step 17) Coordinate offsets
		var offsetX = this.offsetX;
		var offsetY = this.offsetY;

		// Step 18) Iterate over every entity with progress updates
		for (var index = 0; index < dxf.entities.length; index++) {
			var ent = dxf.entities[index];

			// Step 19) Update progress every entity and yield to UI periodically
			if (progressUpdateDXF) {
				var percent = Math.round((index / totalEntities) * 100);
				var message = "Processing entity " + (index + 1) + " of " + totalEntities;
				progressUpdateDXF(percent, message);

				// Step 20) Yield to UI every 50 entities to allow progress bar to update
				if (index % 50 === 0) {
					await new Promise(function (resolve) {
						setTimeout(resolve, 0);
					});
				}
			}

			var t = ent.type.toUpperCase();
			var color = this.getColor(ent.color);

			// Step 21) Parse POINT or VERTEX entities
			if (t === "POINT" || t === "VERTEX") {
				var x = (ent.position && ent.position.x != null ? ent.position.x : ent.x) - offsetX;
				var y = (ent.position && ent.position.y != null ? ent.position.y : ent.y) - offsetY;
				var z = (ent.position && ent.position.z != null ? ent.position.z : ent.z) || 0;

				if (x == null || y == null) {
					console.warn("POINT/VERTEX missing coords:", ent);
				} else {
					var baseName = ent.name || "pointEntity_" + ++counts.point;
					var name = this.getUniqueEntityName(baseName, "point", kadDrawingsMap);

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "point",
						data: [{
							entityName: name,
							entityType: "point",
							pointID: 1,
							pointXLocation: x,
							pointYLocation: y,
							pointZLocation: z,
							color: color
						}]
					});
				}
			}
			// Step 22) Parse INSERT entities (block inserts as points)
			else if (t === "INSERT") {
				if (!ent.position) {
					console.warn("INSERT missing position:", ent);
				} else {
					var xi = ent.position.x - offsetX;
					var yi = ent.position.y - offsetY;
					var zi = ent.position.z || 0;

					var baseNameI = ent.name || "pointEntity_" + ++counts.point;
					var nameI = this.getUniqueEntityName(baseNameI, "point", kadDrawingsMap);

					kadDrawingsMap.set(nameI, {
						entityName: nameI,
						entityType: "point",
						data: [{
							entityName: nameI,
							entityType: "point",
							pointID: 1,
							pointXLocation: xi,
							pointYLocation: yi,
							pointZLocation: zi,
							color: color
						}]
					});
				}
			}
			// Step 23) Parse LINE entities
			else if (t === "LINE") {
				var v = ent.vertices;
				if (!v || v.length < 2) {
					console.warn("LINE missing vertices:", ent);
				} else {
					var baseNameL = ent.name || "lineEntity_" + ++counts.line;
					var nameL = this.getUniqueEntityName(baseNameL, "line", kadDrawingsMap);

					kadDrawingsMap.set(nameL, {
						entityName: nameL,
						entityType: "line",
						data: [
							{
								entityName: nameL,
								entityType: "line",
								pointID: 1,
								pointXLocation: v[0].x - offsetX,
								pointYLocation: v[0].y - offsetY,
								pointZLocation: v[0].z || 0,
								lineWidth: 1,
								color: color,
								closed: false
							},
							{
								entityName: nameL,
								entityType: "line",
								pointID: 2,
								pointXLocation: v[1].x - offsetX,
								pointYLocation: v[1].y - offsetY,
								pointZLocation: v[1].z || 0,
								lineWidth: 1,
								color: color,
								closed: false
							}
						]
					});
				}
			}
			// Step 24) Parse LWPOLYLINE or POLYLINE entities (poly if closed, line if open)
			else if (t === "LWPOLYLINE" || t === "POLYLINE") {
				var verts = ent.vertices || ent.controlPoints || [];
				if (!verts.length) {
					console.warn("POLYLINE missing vertices:", ent);
				} else {
					var isClosed = !!(ent.closed || ent.shape);
					var entityType = isClosed ? "poly" : "line";
					var nameP;

					if (isClosed) {
						var baseNameP = ent.name || "polyEntity_" + ++counts.poly;
						nameP = this.getUniqueEntityName(baseNameP, "poly", kadDrawingsMap);
					} else {
						var baseNameP = ent.name || "lineEntity_" + ++counts.line;
						nameP = this.getUniqueEntityName(baseNameP, "line", kadDrawingsMap);
					}

					kadDrawingsMap.set(nameP, {
						entityName: nameP,
						entityType: entityType,
						data: []
					});

					var dataP = kadDrawingsMap.get(nameP).data;
					verts.forEach(function (v, i) {
						dataP.push({
							entityName: nameP,
							entityType: entityType,
							pointID: i + 1,
							pointXLocation: v.x - offsetX,
							pointYLocation: v.y - offsetY,
							pointZLocation: v.z || 0,
							lineWidth: 1,
							color: color,
							closed: false
						});
					});

					// Step 25) Close polygon if flagged
					if (isClosed) {
						var v0p = verts[0];
						dataP.push({
							entityName: nameP,
							entityType: entityType,
							pointID: dataP.length + 1,
							pointXLocation: v0p.x - offsetX,
							pointYLocation: v0p.y - offsetY,
							pointZLocation: v0p.z || 0,
							lineWidth: 1,
							color: color,
							closed: true
						});
					}
				}
			}
			// Step 26) Parse CIRCLE entities
			else if (t === "CIRCLE") {
				if (!ent.center) {
					console.warn("CIRCLE missing center:", ent);
				} else {
					var baseNameC = ent.name || "circleEntity_" + ++counts.circle;
					var nameC = this.getUniqueEntityName(baseNameC, "circle", kadDrawingsMap);

					kadDrawingsMap.set(nameC, {
						entityName: nameC,
						entityType: "circle",
						data: [{
							entityName: nameC,
							entityType: "circle",
							pointID: 1,
							pointXLocation: ent.center.x - offsetX,
							pointYLocation: ent.center.y - offsetY,
							pointZLocation: ent.center.z || 0,
							radius: ent.radius,
							lineWidth: 1,
							color: color
						}]
					});
				}
			}
			// Step 27) Parse ELLIPSE entities (sampled as 64-segment closed polygon)
			else if (t === "ELLIPSE") {
				if (!ent.center) {
					console.warn("ELLIPSE missing center:", ent);
				} else {
					var baseNameE = ent.name || "polyEntity_" + ++counts.poly;
					var nameE = this.getUniqueEntityName(baseNameE, "poly", kadDrawingsMap);

					kadDrawingsMap.set(nameE, {
						entityName: nameE,
						entityType: "poly",
						data: []
					});

					var dataE = kadDrawingsMap.get(nameE).data;
					var segs = 64;

					for (var i = 0; i < segs; i++) {
						var angle = ent.startAngle + (ent.endAngle - ent.startAngle) * (i / (segs - 1));
						var px = ent.center.x + ent.xRadius * Math.cos(angle) - offsetX;
						var py = ent.center.y + ent.yRadius * Math.sin(angle) - offsetY;
						var closed = true;

						dataE.push({
							entityName: nameE,
							entityType: "poly",
							pointID: i + 1,
							pointXLocation: px,
							pointYLocation: py,
							pointZLocation: ent.center.z || 0,
							lineWidth: 1,
							color: color,
							closed: closed
						});
					}

					// Step 28) Close ellipse loop
					dataE.push(Object.assign({}, dataE[0], {
						pointID: dataE.length + 1
					}));
				}
			}
			// Step 29) Parse TEXT or MTEXT entities
			else if (t === "TEXT" || t === "MTEXT") {
				var pos = ent.startPoint || ent.position;
				if (!pos) {
					console.warn("TEXT missing position:", ent);
				} else {
					var baseNameT = ent.name || "textEntity_" + ++counts.text;
					var nameT = this.getUniqueEntityName(baseNameT, "text", kadDrawingsMap);

					kadDrawingsMap.set(nameT, {
						entityName: nameT,
						entityType: "text",
						data: [{
							entityName: nameT,
							entityType: "text",
							pointID: 1,
							pointXLocation: pos.x - offsetX,
							pointYLocation: pos.y - offsetY,
							pointZLocation: pos.z || 0,
							text: ent.text,
							color: color,
							fontHeight: ent.height || 12
						}]
					});
				}
			}
			// Step 30) Parse 3DFACE entities (surface triangles)
			else if (t === "3DFACE") {
				var verts = ent.vertices;
				if (!verts || verts.length < 3) {
					console.warn("3DFACE missing vertices:", ent);
				} else {
					// Step 31) Extract three unique vertices for the triangle
					var p1 = {
						x: verts[0].x - offsetX,
						y: verts[0].y - offsetY,
						z: verts[0].z || 0
					};
					var p2 = {
						x: verts[1].x - offsetX,
						y: verts[1].y - offsetY,
						z: verts[1].z || 0
					};
					var p3 = {
						x: verts[2].x - offsetX,
						y: verts[2].y - offsetY,
						z: verts[2].z || 0
					};

					// Step 32) Add points to surface points collection (with deduplication)
					var p1Index = this.addUniquePoint(surfacePoints, p1);
					var p2Index = this.addUniquePoint(surfacePoints, p2);
					var p3Index = this.addUniquePoint(surfacePoints, p3);

					// Step 33) Create triangle referencing the point indices
					surfaceTriangles.push({
						vertices: [surfacePoints[p1Index], surfacePoints[p2Index], surfacePoints[p3Index]],
						minZ: Math.min(p1.z, p2.z, p3.z),
						maxZ: Math.max(p1.z, p2.z, p3.z)
					});
				}
			}
			// Step 34) Skip unsupported entity types
			else {
				console.warn("Unsupported DXF entity:", ent.type);
			}
		}

		// Step 35) Create surface data if 3DFACE triangles were found
		var surfaces = new Map();
		if (surfaceTriangles.length > 0) {
			var surfaceName = "DXF_Surface_" + Date.now();
			var surfaceId = this.getUniqueEntityName(surfaceName, "surface", surfaces);

			console.log("Creating surface from DXF 3DFACE entities: " + surfaceTriangles.length + " triangles, " + surfacePoints.length + " points");

			surfaces.set(surfaceId, {
				id: surfaceId,
				name: surfaceId,
				points: surfacePoints,
				triangles: surfaceTriangles,
				visible: true,
				gradient: "hillshade",
				transparency: 1.0,
				minLimit: null,
				maxLimit: null
			});
		}

		// Step 36) Update progress to 100% and close dialog
		if (progressUpdateDXF) {
			progressUpdateDXF(100, "DXF import complete!");
			setTimeout(function () {
				if (progressDialog) {
					progressDialog.close();
				}
			}, 500);
		}

		// Step 37) Return parsed data
		return {
			kadDrawings: kadDrawingsMap,
			surfaces: surfaces,
			entityCounts: counts
		};
	}

	// Step 38) Helper: Get color from DXF color index
	getColor(idx) {
		// Step 39) Pick the DXF color (decimal) or default grey
		var dec = idx != null && idx >= 0 ? idx : 0x777777;

		// Step 40) Convert to hex, pad to 6 digits
		var hex = dec.toString(16).padStart(6, "0").toUpperCase();
		return "#" + hex;
	}

	// Step 41) Helper: Get unique entity name (collision-free)
	getUniqueEntityName(baseName, entityType, existingMap) {
		// Step 42) If baseName doesn't exist in the map, use it as-is
		if (!existingMap.has(baseName)) {
			return baseName;
		}

		// Step 43) Otherwise, increment until we find a unique name
		var counter = 1;
		var uniqueName = baseName + "_" + counter;

		while (existingMap.has(uniqueName)) {
			counter++;
			uniqueName = baseName + "_" + counter;
		}

		console.log("Entity name collision avoided: '" + baseName + "' → '" + uniqueName + "'");
		return uniqueName;
	}

	// Step 44) Helper: Add unique point to array (deduplication with tolerance)
	addUniquePoint(pointsArray, newPoint, tolerance = 0.001) {
		// Step 45) Check if point already exists within tolerance
		for (var i = 0; i < pointsArray.length; i++) {
			var p = pointsArray[i];
			var dx = Math.abs(p.x - newPoint.x);
			var dy = Math.abs(p.y - newPoint.y);
			var dz = Math.abs(p.z - newPoint.z);

			if (dx < tolerance && dy < tolerance && dz < tolerance) {
				return i; // Return existing point index
			}
		}

		// Step 46) Point doesn't exist, add it
		pointsArray.push(newPoint);
		return pointsArray.length - 1;
	}
}

export default DXFParser;
