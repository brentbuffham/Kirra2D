// src/fileIO/AutoCadIO/DXFParser.js
//=============================================================
// DXF PARSER (CORRECTED)
//=============================================================
// Step 1) Parses DXF files to KAD entities and surfaces
// Step 2) Extracted from kirra.js parseDXFtoKadMaps() function (lines 8663-9091)
// Step 3) Handles 9 DXF entity types: POINT, INSERT, LINE, POLYLINE, CIRCLE, ELLIPSE, TEXT, MTEXT, 3DFACE
// Step 4) CORRECTED: Proper entity naming using DXF handles + layer names
// Step 5) DXF SPEC: Group code 8 = Layer name, Group code 5 = Handle (unique ID)
// Step 6) Created: 2026-01-03, Updated: 2026-01-17

import BaseParser from "../BaseParser.js";

// Step 7) DXFParser class
class DXFParser extends BaseParser {
	constructor(options = {}) {
		super(options);

		// Step 8) DXF-specific options - use BaseParser centroid if available
		this.offsetX = options.offsetX || this.centroidX || 0;
		this.offsetY = options.offsetY || this.centroidY || 0;
		this.showProgress = options.showProgress !== false; // default true

		// Step 9) Naming strategy option
		// "handle" = use DXF handle (most unique, e.g., "LINE_8A")
		// "layer_index" = use layer + index (e.g., "SP_2_line_001")
		// "layer_handle" = use layer + handle (e.g., "SP_2_8A")
		this.namingStrategy = options.namingStrategy || "layer_index";
	}

	// Step 10) Main parse method
	async parse(data) {
		// Step 11) Validate input - expect dxf object from DxfParser library
		if (!data || !data.dxfData) {
			throw new Error("Invalid input: dxfData object required");
		}

		var dxf = data.dxfData;

		// Step 12) Check if DxfParser library is available globally
		if (!window.DxfParser) {
			console.warn("window.DxfParser not available - DXF parsing may require external library");
		}

		// Step 13) Parse DXF data
		return await this.parseDXFData(dxf);
	}

	// Step 14) Parse DXF data from parsed DXF object
	async parseDXFData(dxf) {
		// Step 15) Create progress dialog for DXF parsing
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

			// Step 16) Wait for dialog to render, then get progress elements
			await new Promise(function(resolve) {
				setTimeout(resolve, 50);
			});

			progressBar = document.getElementById("dxfProgressBar");
			progressText = document.getElementById("dxfProgressText");

			// Step 17) Update progress function
			progressUpdateDXF = function(percent, message) {
				if (progressBar) progressBar.style.width = percent + "%";
				if (progressText) progressText.textContent = message;
			};
		}

		// Step 18) Initialize result maps
		var kadDrawingsMap = new Map();
		var surfacePoints = [];
		var surfaceTriangles = [];
		var pointHashMap = {}; // Spatial hash for O(1) point deduplication

		// Step 19) Entity counters for unique naming (per layer and per type)
		var layerCounters = {}; // { "SP_2": { point: 0, line: 0, poly: 0, ... }, ... }
		var globalCounters = { point: 0, line: 0, poly: 0, circle: 0, text: 0, face: 0 };

		// Step 20) Coordinate offsets
		var offsetX = this.offsetX;
		var offsetY = this.offsetY;
		var self = this;

		// Step 20b) Scaled progress interval — ~100 updates regardless of file size
		var progressInterval = Math.max(1, Math.floor(totalEntities / 100));

		// Step 21) Iterate over every entity with progress updates
		for (var index = 0; index < dxf.entities.length; index++) {
			var ent = dxf.entities[index];

			// Step 22) Update progress at scaled intervals
			if (progressUpdateDXF && index % progressInterval === 0) {
				var percent = Math.round(index / totalEntities * 100);
				var message = "Processing entity " + (index + 1) + " of " + totalEntities;
				progressUpdateDXF(percent, message);

				// Step 23) Yield to UI at same scaled interval
				await new Promise(function(resolve) {
					setTimeout(resolve, 0);
				});
			}

			var t = ent.type.toUpperCase();
			var color = this.getColor(ent.color);

			// Step 24) Get layer name (DXF group code 8) - default to "0"
			var layerName = ent.layer || "0";

			// Step 25) Get handle (DXF group code 5) - unique entity identifier
			var handle = ent.handle || null;

			// Step 26) Initialize layer counters if needed
			if (!layerCounters[layerName]) {
				layerCounters[layerName] = { point: 0, line: 0, poly: 0, circle: 0, text: 0, face: 0 };
			}

			// Step 27) Parse POINT or VERTEX entities
			if (t === "POINT" || t === "VERTEX") {
				var x = (ent.position && ent.position.x != null ? ent.position.x : ent.x) - offsetX;
				var y = (ent.position && ent.position.y != null ? ent.position.y : ent.y) - offsetY;
				var z = (ent.position && ent.position.z != null ? ent.position.z : ent.z) || 0;

				if (x == null || y == null) {
					console.warn("POINT/VERTEX missing coords:", ent);
				} else {
					layerCounters[layerName].point++;
					globalCounters.point++;

					var name = this.generateEntityName(layerName, "point", handle, layerCounters[layerName].point, globalCounters.point, kadDrawingsMap);

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "point",
						layer: layerName,
						handle: handle,
						data: [
							{
								entityName: name,
								entityType: "point",
								pointID: 1,
								pointXLocation: x,
								pointYLocation: y,
								pointZLocation: z,
								color: color
							}
						]
					});
				}
			} else if (t === "INSERT") {
				// Step 28) Parse INSERT entities (block inserts as points)
				if (!ent.position) {
					console.warn("INSERT missing position:", ent);
				} else {
					var xi = ent.position.x - offsetX;
					var yi = ent.position.y - offsetY;
					var zi = ent.position.z || 0;

					layerCounters[layerName].point++;
					globalCounters.point++;

					// Use block name if available for INSERT entities
					var blockName = ent.name || ent.block || null;
					var name = this.generateEntityName(layerName, "point", handle, layerCounters[layerName].point, globalCounters.point, kadDrawingsMap, blockName);

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "point",
						layer: layerName,
						handle: handle,
						blockName: blockName,
						data: [
							{
								entityName: name,
								entityType: "point",
								pointID: 1,
								pointXLocation: xi,
								pointYLocation: yi,
								pointZLocation: zi,
								color: color
							}
						]
					});
				}
			} else if (t === "LINE") {
				// Step 29) Parse LINE entities
				var v = ent.vertices;
				if (!v || v.length < 2) {
					console.warn("LINE missing vertices:", ent);
				} else {
					layerCounters[layerName].line++;
					globalCounters.line++;

					var name = this.generateEntityName(layerName, "line", handle, layerCounters[layerName].line, globalCounters.line, kadDrawingsMap);

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "line",
						layer: layerName,
						handle: handle,
						data: [
							{
								entityName: name,
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
								entityName: name,
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
			} else if (t === "LWPOLYLINE" || t === "POLYLINE") {
				// Step 30) Parse LWPOLYLINE or POLYLINE entities
				var verts = ent.vertices || ent.controlPoints || [];
				if (!verts.length) {
					console.warn("POLYLINE missing vertices:", ent);
				} else {
					// Step 31) Check for Vulcan XDATA
					var vulcanName = this.extractVulcanName(ent);
					var isVulcanEntity = vulcanName !== null;

					if (isVulcanEntity) {
						console.log("✅ Vulcan entity detected! Name:", vulcanName);
					}

					var isClosed = !!(ent.closed || ent.shape);
					var entityType = isClosed ? "poly" : "line";

					// Step 32) Increment appropriate counter
					if (isClosed) {
						layerCounters[layerName].poly++;
						globalCounters.poly++;
					} else {
						layerCounters[layerName].line++;
						globalCounters.line++;
					}

					// Step 33) Generate unique name
					var name;
					if (isVulcanEntity) {
						// For Vulcan entities, use VulcanName but ensure uniqueness
						var baseName = "VN_" + vulcanName;
						name = this.getUniqueEntityName(baseName, entityType, kadDrawingsMap);
					} else {
						var counterValue = isClosed ? layerCounters[layerName].poly : layerCounters[layerName].line;
						var globalValue = isClosed ? globalCounters.poly : globalCounters.line;
						name = this.generateEntityName(layerName, entityType, handle, counterValue, globalValue, kadDrawingsMap);
					}

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: entityType,
						layer: layerName,
						handle: handle,
						vulcanName: vulcanName,
						data: []
					});

					var dataP = kadDrawingsMap.get(name).data;
					for (var vi = 0; vi < verts.length; vi++) {
						var v = verts[vi];
						dataP.push({
							entityName: name,
							entityType: entityType,
							pointID: vi + 1,
							pointXLocation: v.x - offsetX,
							pointYLocation: v.y - offsetY,
							pointZLocation: v.z || 0,
							lineWidth: 1,
							color: color,
							closed: false
						});
					}

					// Step 34) Close polygon if flagged
					if (isClosed && verts.length > 0) {
						var v0p = verts[0];
						dataP.push({
							entityName: name,
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

					// Step 35) Create text entity at collar for Vulcan entities
					if (isVulcanEntity && verts.length > 0) {
						var firstVert = verts[0];
						var textBaseName = "VN_" + vulcanName + "_text";
						var textName = this.getUniqueEntityName(textBaseName, "text", kadDrawingsMap);

						kadDrawingsMap.set(textName, {
							entityName: textName,
							entityType: "text",
							layer: layerName,
							vulcanName: vulcanName,
							data: [
								{
									entityName: textName,
									entityType: "text",
									pointID: 1,
									pointXLocation: firstVert.x - offsetX,
									pointYLocation: firstVert.y - offsetY,
									pointZLocation: firstVert.z || 0,
									text: vulcanName,
									color: color,
									fontHeight: 12
								}
							]
						});
					}
				}
			} else if (t === "CIRCLE") {
				// Step 36) Parse CIRCLE entities
				if (!ent.center) {
					console.warn("CIRCLE missing center:", ent);
				} else {
					layerCounters[layerName].circle++;
					globalCounters.circle++;

					var name = this.generateEntityName(layerName, "circle", handle, layerCounters[layerName].circle, globalCounters.circle, kadDrawingsMap);

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "circle",
						layer: layerName,
						handle: handle,
						data: [
							{
								entityName: name,
								entityType: "circle",
								pointID: 1,
								pointXLocation: ent.center.x - offsetX,
								pointYLocation: ent.center.y - offsetY,
								pointZLocation: ent.center.z || 0,
								radius: ent.radius,
								lineWidth: 1,
								color: color
							}
						]
					});
				}
			} else if (t === "ELLIPSE") {
				// Step 37) Parse ELLIPSE entities (sampled as 64-segment closed polygon)
				if (!ent.center) {
					console.warn("ELLIPSE missing center:", ent);
				} else {
					layerCounters[layerName].poly++;
					globalCounters.poly++;

					var name = this.generateEntityName(layerName, "poly", handle, layerCounters[layerName].poly, globalCounters.poly, kadDrawingsMap);

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "poly",
						layer: layerName,
						handle: handle,
						data: []
					});

					var dataE = kadDrawingsMap.get(name).data;
					var segs = 64;

					for (var i = 0; i < segs; i++) {
						var angle = ent.startAngle + (ent.endAngle - ent.startAngle) * (i / (segs - 1));
						var px = ent.center.x + ent.xRadius * Math.cos(angle) - offsetX;
						var py = ent.center.y + ent.yRadius * Math.sin(angle) - offsetY;

						dataE.push({
							entityName: name,
							entityType: "poly",
							pointID: i + 1,
							pointXLocation: px,
							pointYLocation: py,
							pointZLocation: ent.center.z || 0,
							lineWidth: 1,
							color: color,
							closed: true
						});
					}

					// Close ellipse loop
					dataE.push(
						Object.assign({}, dataE[0], {
							pointID: dataE.length + 1
						})
					);
				}
			} else if (t === "TEXT" || t === "MTEXT") {
				// Step 38) Parse TEXT or MTEXT entities
				var pos = ent.startPoint || ent.position;
				if (!pos) {
					console.warn("TEXT missing position:", ent);
				} else {
					layerCounters[layerName].text++;
					globalCounters.text++;

					var name = this.generateEntityName(layerName, "text", handle, layerCounters[layerName].text, globalCounters.text, kadDrawingsMap);

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "text",
						layer: layerName,
						handle: handle,
						data: [
							{
								entityName: name,
								entityType: "text",
								pointID: 1,
								pointXLocation: pos.x - offsetX,
								pointYLocation: pos.y - offsetY,
								pointZLocation: pos.z || 0,
								text: ent.text,
								color: color,
								fontHeight: ent.height || 12
							}
						]
					});
				}
			} else if (t === "3DFACE") {
				// Step 39) Parse 3DFACE entities (surface triangles)
				var verts = ent.vertices;
				if (!verts || verts.length < 3) {
					console.warn("3DFACE missing vertices:", ent);
				} else {
					// Step 40) Extract three unique vertices for the triangle
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

					// Step 41) Add points via spatial hash (O(1) dedup instead of O(n) scan)
					var p1Index = this.addUniquePointHashed(surfacePoints, pointHashMap, p1);
					var p2Index = this.addUniquePointHashed(surfacePoints, pointHashMap, p2);
					var p3Index = this.addUniquePointHashed(surfacePoints, pointHashMap, p3);

					// Step 42) Create triangle referencing the point indices
					surfaceTriangles.push({
						vertices: [surfacePoints[p1Index], surfacePoints[p2Index], surfacePoints[p3Index]],
						minZ: Math.min(p1.z, p2.z, p3.z),
						maxZ: Math.max(p1.z, p2.z, p3.z),
						layer: layerName,
						handle: handle
					});

					globalCounters.face++;
				}
			} else if (t === "ARC") {
				// Step 43) Parse ARC entities (sampled as polyline)
				if (!ent.center) {
					console.warn("ARC missing center:", ent);
				} else {
					layerCounters[layerName].line++;
					globalCounters.line++;

					var name = this.generateEntityName(layerName, "line", handle, layerCounters[layerName].line, globalCounters.line, kadDrawingsMap);

					kadDrawingsMap.set(name, {
						entityName: name,
						entityType: "line",
						layer: layerName,
						handle: handle,
						data: []
					});

					var dataArc = kadDrawingsMap.get(name).data;
					var arcSegs = 32;
					var startAngle = (ent.startAngle || 0) * (Math.PI / 180);
					var endAngle = (ent.endAngle || 360) * (Math.PI / 180);
					var radius = ent.radius || 1;

					// Handle arc direction
					if (endAngle < startAngle) {
						endAngle += 2 * Math.PI;
					}

					for (var i = 0; i <= arcSegs; i++) {
						var angle = startAngle + (endAngle - startAngle) * (i / arcSegs);
						var px = ent.center.x + radius * Math.cos(angle) - offsetX;
						var py = ent.center.y + radius * Math.sin(angle) - offsetY;

						dataArc.push({
							entityName: name,
							entityType: "line",
							pointID: i + 1,
							pointXLocation: px,
							pointYLocation: py,
							pointZLocation: ent.center.z || 0,
							lineWidth: 1,
							color: color,
							closed: false
						});
					}
				}
			} else {
				// Step 44) Skip unsupported entity types
				console.warn("Unsupported DXF entity type:", ent.type);
			}
		}

		// Step 45) Create surface data if 3DFACE triangles were found
		var surfaces = new Map();
		if (surfaceTriangles.length > 0) {
			var surfaceName = "DXF_Surface_" + Date.now();
			var surfaceId = this.getUniqueEntityName(surfaceName, "surface", surfaces);

			console.log("Creating surface from DXF 3DFACE entities: " + surfaceTriangles.length + " triangles, " + surfacePoints.length + " points");

			// Step 45a) Calculate meshBounds from points for centroid calculation
			// CRITICAL: Without meshBounds, centroid calculation cannot use this surface data
			var minX = Infinity, maxX = -Infinity;
			var minY = Infinity, maxY = -Infinity;
			var minZ = Infinity, maxZ = -Infinity;
			for (var bi = 0; bi < surfacePoints.length; bi++) {
				var bp = surfacePoints[bi];
				if (bp.x < minX) minX = bp.x;
				if (bp.x > maxX) maxX = bp.x;
				if (bp.y < minY) minY = bp.y;
				if (bp.y > maxY) maxY = bp.y;
				if (bp.z < minZ) minZ = bp.z;
				if (bp.z > maxZ) maxZ = bp.z;
			}
			var meshBounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ };

			surfaces.set(surfaceId, {
				id: surfaceId,
				name: surfaceId,
				points: surfacePoints,
				triangles: surfaceTriangles,
				meshBounds: meshBounds, // CRITICAL: Add meshBounds for centroid calculation
				visible: true,
				gradient: "hillshade",
				transparency: 1.0,
				minLimit: null,
				maxLimit: null
			});
		}

		// Step 46) Update progress to 100% and close dialog
		if (progressUpdateDXF) {
			progressUpdateDXF(100, "DXF import complete!");
			setTimeout(function() {
				if (progressDialog) {
					progressDialog.close();
				}
			}, 500);
		}

		// Step 47) Log summary
		console.log("DXF Import Summary:");
		console.log("  - Total entities: " + totalEntities);
		console.log("  - Points: " + globalCounters.point);
		console.log("  - Lines: " + globalCounters.line);
		console.log("  - Polygons: " + globalCounters.poly);
		console.log("  - Circles: " + globalCounters.circle);
		console.log("  - Text: " + globalCounters.text);
		console.log("  - 3D Faces: " + globalCounters.face);
		console.log("  - KAD entities created: " + kadDrawingsMap.size);

		// Step 48) Return parsed data
		return {
			kadDrawings: kadDrawingsMap,
			surfaces: surfaces,
			entityCounts: globalCounters,
			layerCounts: layerCounters
		};
	}

	// Step 49) Generate unique entity name based on naming strategy
	generateEntityName(layerName, entityType, handle, layerIndex, globalIndex, existingMap, blockName) {
		var baseName;

		switch (this.namingStrategy) {
			case "handle":
				// Use DXF handle if available, otherwise fall back to global index
				if (handle) {
					baseName = entityType.toUpperCase() + "_" + handle;
				} else {
					baseName = entityType + "_" + String(globalIndex).padStart(5, "0");
				}
				break;

			case "layer_handle":
				// Use layer + handle
				if (handle) {
					baseName = layerName + "_" + handle;
				} else {
					baseName = layerName + "_" + entityType + "_" + String(layerIndex).padStart(4, "0");
				}
				break;

			case "block_name":
				// Use block name if available (for INSERT entities)
				if (blockName) {
					baseName = blockName;
				} else {
					baseName = layerName + "_" + entityType + "_" + String(layerIndex).padStart(4, "0");
				}
				break;

			case "layer_index":
			default:
				// Default: layer + type + padded index (most readable)
				baseName = layerName + "_" + entityType + "_" + String(layerIndex).padStart(4, "0");
				break;
		}

		// Step 50) Ensure uniqueness
		return this.getUniqueEntityName(baseName, entityType, existingMap);
	}

	// Step 51) Helper: Get color from DXF color index
	getColor(idx) {
		// Step 52) DXF uses ACI (AutoCAD Color Index) 1-255
		// Common ACI colors:
		// 1 = Red, 2 = Yellow, 3 = Green, 4 = Cyan, 5 = Blue, 6 = Magenta, 7 = White/Black
		var aciColors = {
			1: "#FF0000", // Red
			2: "#FFFF00", // Yellow
			3: "#00FF00", // Green
			4: "#00FFFF", // Cyan
			5: "#0000FF", // Blue
			6: "#FF00FF", // Magenta
			7: "#FFFFFF", // White
			8: "#808080", // Dark gray
			9: "#C0C0C0" // Light gray
		};

		if (idx != null && aciColors[idx]) {
			return aciColors[idx];
		}

		// For other indices or if color is already a decimal RGB
		if (idx != null && idx >= 0) {
			if (idx > 255) {
				// True color (24-bit RGB stored as integer)
				var hex = idx.toString(16).padStart(6, "0").toUpperCase();
				return "#" + hex;
			}
			// Map other ACI colors to approximate RGB
			// This is a simplified mapping
			var h = idx * 137 % 360;
			return this.hslToHex(h, 70, 50);
		}

		// Default grey
		return "#777777";
	}

	// Step 53) Helper: Convert HSL to Hex color
	hslToHex(h, s, l) {
		s /= 100;
		l /= 100;
		var c = (1 - Math.abs(2 * l - 1)) * s;
		var x = c * (1 - Math.abs(h / 60 % 2 - 1));
		var m = l - c / 2;
		var r = 0,
			g = 0,
			b = 0;

		if (h < 60) {
			r = c;
			g = x;
			b = 0;
		} else if (h < 120) {
			r = x;
			g = c;
			b = 0;
		} else if (h < 180) {
			r = 0;
			g = c;
			b = x;
		} else if (h < 240) {
			r = 0;
			g = x;
			b = c;
		} else if (h < 300) {
			r = x;
			g = 0;
			b = c;
		} else {
			r = c;
			g = 0;
			b = x;
		}

		r = Math.round((r + m) * 255);
		g = Math.round((g + m) * 255);
		b = Math.round((b + m) * 255);

		return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
	}

	// Step 54) Helper: Get unique entity name (collision-free)
	getUniqueEntityName(baseName, entityType, existingMap) {
		// Step 55) If baseName doesn't exist in the map, use it as-is
		if (!existingMap.has(baseName)) {
			return baseName;
		}

		// Step 56) Otherwise, increment until we find a unique name
		var counter = 1;
		var uniqueName = baseName + "_" + counter;

		while (existingMap.has(uniqueName)) {
			counter++;
			uniqueName = baseName + "_" + counter;
		}

		console.log("Entity name collision avoided: '" + baseName + "' → '" + uniqueName + "'");
		return uniqueName;
	}

	// Step 57) Helper: Add unique point to array (deduplication with tolerance)
	// NOTE: Legacy O(n) method — kept for non-3DFACE use. Use addUniquePointHashed for bulk 3DFACE.
	addUniquePoint(pointsArray, newPoint, tolerance) {
		tolerance = tolerance || 0.001;

		// Step 58) Check if point already exists within tolerance
		for (var i = 0; i < pointsArray.length; i++) {
			var p = pointsArray[i];
			var dx = Math.abs(p.x - newPoint.x);
			var dy = Math.abs(p.y - newPoint.y);
			var dz = Math.abs(p.z - newPoint.z);

			if (dx < tolerance && dy < tolerance && dz < tolerance) {
				return i; // Return existing point index
			}
		}

		// Step 59) Point doesn't exist, add it
		pointsArray.push(newPoint);
		return pointsArray.length - 1;
	}

	// Step 57b) Spatial-hash point deduplication — O(1) average lookup
	// Snaps coordinates to a grid (tolerance = cell size) and uses a hash map.
	addUniquePointHashed(pointsArray, hashMap, newPoint, tolerance) {
		tolerance = tolerance || 0.001;

		// Snap to grid — points within tolerance land in the same cell
		var invTol = 1 / tolerance;
		var kx = Math.round(newPoint.x * invTol);
		var ky = Math.round(newPoint.y * invTol);
		var kz = Math.round(newPoint.z * invTol);
		var key = kx + "," + ky + "," + kz;

		if (hashMap[key] !== undefined) {
			return hashMap[key];
		}

		// Check adjacent cells to handle points near cell boundaries
		for (var dx = -1; dx <= 1; dx++) {
			for (var dy = -1; dy <= 1; dy++) {
				for (var dz = -1; dz <= 1; dz++) {
					if (dx === 0 && dy === 0 && dz === 0) continue;
					var neighborKey = (kx + dx) + "," + (ky + dy) + "," + (kz + dz);
					if (hashMap[neighborKey] !== undefined) {
						var existing = pointsArray[hashMap[neighborKey]];
						if (Math.abs(existing.x - newPoint.x) < tolerance &&
							Math.abs(existing.y - newPoint.y) < tolerance &&
							Math.abs(existing.z - newPoint.z) < tolerance) {
							// Also register in this cell for future lookups
							hashMap[key] = hashMap[neighborKey];
							return hashMap[neighborKey];
						}
					}
				}
			}
		}

		// New unique point
		var idx = pointsArray.length;
		pointsArray.push(newPoint);
		hashMap[key] = idx;
		return idx;
	}

	// Step 60) Helper: Extract VulcanName from XDATA
	extractVulcanName(entity) {
		// Step 61) Check if entity has extendedData (XDATA)
		if (!entity.extendedData) {
			return null;
		}

		// Step 62) The DXF parser structures XDATA as { applicationName, customStrings }
		// Loop through all extended data entries
		if (Array.isArray(entity.extendedData)) {
			for (var i = 0; i < entity.extendedData.length; i++) {
				var xdata = entity.extendedData[i];

				// Check if this is MAPTEK_VULCAN data
				if (xdata.applicationName === "MAPTEK_VULCAN" && Array.isArray(xdata.customStrings)) {
					// Look for VulcanName= in customStrings array
					for (var j = 0; j < xdata.customStrings.length; j++) {
						var str = xdata.customStrings[j];
						if (typeof str === "string" && str.indexOf("VulcanName=") === 0) {
							var vulcanName = str.substring(11).trim();

							// Validate the name is meaningful
							if (vulcanName && vulcanName !== "--" && vulcanName !== "-") {
								return vulcanName;
							}
						}
					}
				}
			}
		} else if (typeof entity.extendedData === "object") {
			// Handle object format (keyed by application name)
			var vulcanData = entity.extendedData.MAPTEK_VULCAN || entity.extendedData["MAPTEK_VULCAN"];
			if (vulcanData) {
				var customStrings = vulcanData.customStrings || vulcanData;
				if (Array.isArray(customStrings)) {
					for (var k = 0; k < customStrings.length; k++) {
						var str = customStrings[k];
						if (typeof str === "string" && str.indexOf("VulcanName=") === 0) {
							var vulcanName = str.substring(11).trim();

							if (vulcanName && vulcanName !== "--" && vulcanName !== "-") {
								return vulcanName;
							}
						}
					}
				}
			}
		}

		return null;
	}
}

export default DXFParser;
