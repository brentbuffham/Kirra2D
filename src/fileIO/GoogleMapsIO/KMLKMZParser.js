// KML/KMZ Parser (JavaScript)
// Use togeojson to convert KML to GeoJSON. For KMZ, unzip with JSZip first.
// Example for blast holes/KAD:

// Unzip KMZ: new JSZip().loadAsync(file).then(zip => zip.file('doc.kml').async('string'))
// Parse KML: toGeoJSON.kml(DOMParser.parseFromString(kmlString, 'text/xml'))
// Map GeoJSON features to BlastHole objects (LineString for holes, Point/Line/Poly for KAD geometries; extract properties like holeID).

// KML/KMZ Writer (JavaScript)
// Use tokml to convert GeoJSON to KML. For KMZ, zip with JSZip.
// Example for blast holes/KAD:

// Convert BlastHole to GeoJSON: {type: 'Feature', geometry: {type: 'LineString', coordinates: [[startX, startY, startZ], [endX, endY, endZ]]}, properties: {holeID, entityName, ...}} (similar for KAD points/lines/polys/text as names).
// Generate KML: tokml(geojson)
// For KMZ: new JSZip().file('doc.kml', kmlString).generateAsync({type: 'blob'})

// What a blast hole looks like in Kirra.
// class BlastHole {
//     constructor(data = {}) {
// this.entityName = data.entityName || "";
// this.entityType = data.entityType || "hole";
// this.holeID = data.holeID || null;
// this.startXLocation = data.startXLocation || 0;
// this.startYLocation = data.startYLocation || 0;
// this.startZLocation = data.startZLocation || 0;
// this.endXLocation = data.endXLocation || 0;
// this.endYLocation = data.endYLocation || 0;
// this.endZLocation = data.endZLocation || 0;
// this.gradeXLocation = data.gradeXLocation || 0;
// this.gradeYLocation = data.gradeYLocation || 0;
// this.gradeZLocation = data.gradeZLocation || 0;
// this.subdrillAmount = data.subdrillAmount || 0; //deltaZ of gradeZ to toeZ -> downhole =+ve uphole =-ve
// this.subdrillLength = data.subdrillLength || 0; //distance of subdrill from gradeXYZ to toeXYZ -> downhole =+ve uphole =-ve
// this.benchHeight = data.benchHeight || 0; //deltaZ of collarZ to gradeZ -> always Absolute
// this.holeDiameter = data.holeDiameter || 115;
// this.holeType = data.holeType || "Undefined";
// this.fromHoleID = data.fromHoleID || "";
// this.timingDelayMilliseconds = data.timingDelayMilliseconds || 0;
// this.colorHexDecimal = data.colorHexDecimal || "red";
// this.holeLengthCalculated = data.holeLengthCalculated || 0; //Distance from the collarXYZ to the ToeXYZ
// this.holeAngle = data.holeAngle || 0; //Angle of the blast hole from Collar to Toe --> 0° = Vertical
// this.holeBearing = data.holeBearing || 0;
// this.measuredLength = data.measuredLength || 0;
// this.measuredLengthTimeStamp = data.measuredLengthTimeStamp || "09/05/1975 00:00:00";
// this.measuredMass = data.measuredMass || 0;
// this.measuredMassTimeStamp = data.measuredMassTimeStamp || "09/05/1975 00:00:00";
// this.measuredComment = data.measuredComment || "None";
// this.measuredCommentTimeStamp = data.measuredCommentTimeStamp || "09/05/1975 00:00:00";
// this.rowID = data.rowID || null;
// this.posID = data.posID || null;
// this.visible = data.visible !== false;
// this.burden = data.burden || 1;
// this.spacing = data.spacing || 1;
// this.connectorCurve = data.connectorCurve || 0;
//     }
// }
// src/fileIO/GoogleMapsIO/KMLKMZParser.js
//=============================================================
// KML/KMZ PARSER
//=============================================================
// Step 1) Imports blast holes and geometry from KML/KMZ files
// Step 2) Supports coordinate transformation from WGS84 to local/UTM
// Step 3) Parses placemarks as blast holes or geometry
// Step 4) Created: 2026-01-10

import BaseParser from "../BaseParser.js";
import JSZip from "jszip";
import proj4 from "proj4";
import { top100EPSGCodes } from "../../dialog/popups/generic/ProjectionDialog.js";

// Step 5) KMLKMZParser class
class KMLKMZParser extends BaseParser {
	constructor(options = {}) {
		super(options);
	}

	// Step 6) Main parse method
	async parse(file) {
		try {
			// Step 7) Check if file is KMZ (zipped) or KML (XML)
			var isKMZ = file.name.toLowerCase().endsWith(".kmz");
			var kmlString = "";

			if (isKMZ) {
				// Step 8) Extract KML from KMZ zip file
				kmlString = await this.extractKMLFromKMZ(file);
			} else {
				// Step 9) Read KML file as text
				kmlString = await this.readFileAsText(file);
			}

			// Step 10) Parse KML XML
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(kmlString, "text/xml");

			// Step 11) Check for parse errors
			var parserError = xmlDoc.querySelector("parsererror");
			if (parserError) {
				throw new Error("XML parse error: " + parserError.textContent);
			}

			// Step 12) Detect coordinate system by sampling coordinates
			var isWGS84 = await this.detectCoordinateSystem(xmlDoc);

			// Step 13) Ask user for import configuration
			var config = await this.promptForImportConfiguration(file.name, isWGS84);

			if (config.cancelled) {
				return { cancelled: true, success: false, message: "Import cancelled by user" };
			}

			// Step 14) Parse placemarks
			var placemarks = xmlDoc.querySelectorAll("Placemark");
			console.log("Found " + placemarks.length + " placemarks");

			// Step 15) Determine import type and parse accordingly
			var result = {};

			if (config.importType === "blastholes") {
				result = await this.parseAsBlastHoles(placemarks, config, file.name);
			} else if (config.importType === "geometry") {
				result = await this.parseAsGeometry(placemarks, config, file.name);
			}

			return result;
		} catch (error) {
			console.error("KML/KMZ parse error:", error);
			throw error;
		}
	}

	// Step 16) Extract KML from KMZ file
	async extractKMLFromKMZ(file) {
		// Step 17) Load file as array buffer
		var arrayBuffer = await this.readFileAsArrayBuffer(file);

		// Step 18) Unzip with JSZip
		var zip = await JSZip.loadAsync(arrayBuffer);

		// Step 19) Find doc.kml or first .kml file
		var kmlFile = zip.file("doc.kml") || zip.file(/\.kml$/i)[0];

		if (!kmlFile) {
			throw new Error("No KML file found in KMZ archive");
		}

		// Step 20) Extract KML content as text
		return await kmlFile.async("string");
	}

	// Step 21) Detect if coordinates are in WGS84
	detectCoordinateSystem(xmlDoc) {
		// Step 22) Sample first coordinate from placemarks
		var coordinatesNodes = xmlDoc.querySelectorAll("coordinates");

		if (coordinatesNodes.length === 0) {
			return true; // Default to WGS84
		}

		// Step 23) Parse first coordinate
		var coordsText = coordinatesNodes[0].textContent.trim();
		var coords = coordsText.split(/[\s,]+/).filter(function (c) {
			return c.length > 0;
		});

		if (coords.length < 2) {
			return true;
		}

		var lon = parseFloat(coords[0]);
		var lat = parseFloat(coords[1]);

		// Step 24) Check if values are in WGS84 range
		return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
	}

	// Step 25) Prompt user for import configuration
	async promptForImportConfiguration(filename, isWGS84) {
		return new Promise(function (resolve) {
			// Step 26) Create dialog using FloatingDialog
			var contentHTML = '<div style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">';

			// Step 27) File information
			contentHTML += '<div style="text-align: left;">';
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 10px 0;"><strong>File:</strong> ' + filename + "</p>";
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 10px 0;">Detected coordinate system: <strong>' + (isWGS84 ? "WGS84 (latitude/longitude)" : "Projected (UTM/local)") + "</strong></p>";
			contentHTML += "</div>";

			// Step 28) Import type selection
			contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Import As:</p>';

			contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
			contentHTML += '<input type="radio" id="import-blastholes" name="import-type" value="blastholes" checked style="margin: 0;">';
			contentHTML += '<label for="import-blastholes" class="labelWhite15" style="margin: 0; cursor: pointer;">Blast Holes</label>';
			contentHTML += "</div>";

			contentHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
			contentHTML += '<input type="radio" id="import-geometry" name="import-type" value="geometry" style="margin: 0;">';
			contentHTML += '<label for="import-geometry" class="labelWhite15" style="margin: 0; cursor: pointer;">Geometry (KAD)</label>';
			contentHTML += "</div>";

			contentHTML += "</div>";

			// Step 29) Coordinate transformation options
			if (isWGS84) {
				contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
				contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Target Coordinate System:</p>';

				contentHTML += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">';
				contentHTML += '<input type="radio" id="keep-wgs84" name="transform" value="keep" style="margin: 0;">';
				contentHTML += '<label for="keep-wgs84" class="labelWhite15" style="margin: 0; cursor: pointer;">Keep as WGS84 (latitude/longitude)</label>';
				contentHTML += "</div>";

				contentHTML += '<div style="display: flex; align-items: center; gap: 8px;">';
				contentHTML += '<input type="radio" id="transform-utm" name="transform" value="transform" checked style="margin: 0;">';
				contentHTML += '<label for="transform-utm" class="labelWhite15" style="margin: 0; cursor: pointer;">Transform to projected coordinates</label>';
				contentHTML += "</div>";

				// EPSG dropdown (shown when transform is selected)
				contentHTML += '<div id="epsg-section" style="margin-top: 10px; display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: center;">';
				contentHTML += '<label class="labelWhite15">EPSG Code:</label>';
				contentHTML += '<select id="kml-import-epsg-code" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
				contentHTML += '<option value="">-- Select EPSG Code --</option>';

				// Use top 100 EPSG codes from ProjectionDialog
				var epsgCodes = top100EPSGCodes;

				for (var i = 0; i < epsgCodes.length; i++) {
					contentHTML += '<option value="' + epsgCodes[i].code + '">' + epsgCodes[i].code + " - " + epsgCodes[i].name + "</option>";
				}

				contentHTML += "</select>";
				contentHTML += "</div>";

				// Custom Proj4
				contentHTML += '<div style="margin-top: 8px; display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: start;">';
				contentHTML += '<label class="labelWhite15" style="padding-top: 4px;">Or Custom Proj4:</label>';
				contentHTML += '<textarea id="kml-import-custom-proj4" placeholder="+proj=utm +zone=50 +south +datum=WGS84 +units=m +no_defs" style="height: 60px; padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 11px; font-family: monospace; resize: vertical;"></textarea>';
				contentHTML += "</div>";

				contentHTML += "</div>";
			}

			// Step 30) Default elevation for blast holes (if Z is missing)
			contentHTML += '<div style="border: 1px solid var(--light-mode-border); border-radius: 4px; padding: 10px; background: var(--dark-mode-bg);">';
			contentHTML += '<p class="labelWhite15" style="margin: 0 0 8px 0; font-weight: bold;">Default Values:</p>';

			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center; margin-bottom: 6px;">';
			contentHTML += '<label class="labelWhite15">Default Elevation:</label>';
			contentHTML += '<input type="number" id="default-elevation" value="0" step="0.1" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += "</div>";

			contentHTML += '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; align-items: center;">';
			contentHTML += '<label class="labelWhite15">Blast Name:</label>';
			contentHTML += '<input type="text" id="default-blast-name" value="' + filename.replace(/\.(kml|kmz)$/i, "") + '" style="padding: 4px 8px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--light-mode-border); border-radius: 3px; font-size: 12px;">';
			contentHTML += "</div>";

			contentHTML += "</div>";

			// Error message
			contentHTML += '<div id="kml-import-error-message" style="display: none; margin-top: 8px; padding: 6px; background: #f44336; color: white; border-radius: 3px; font-size: 11px;"></div>';

			contentHTML += "</div>";

			// Step 31) Create dialog
			var dialog = new window.FloatingDialog({
				title: "Import KML/KMZ",
				content: contentHTML,
				layoutType: "default",
				width: 600,
				height: 750,
				showConfirm: true,
				showCancel: true,
				confirmText: "Import",
				cancelText: "Cancel",
				onConfirm: async function () {
					try {
						// Get form values
						var importType = document.querySelector('input[name="import-type"]:checked').value;
						var defaultElevation = parseFloat(document.getElementById("default-elevation").value);
						var blastName = document.getElementById("default-blast-name").value.trim();
						var errorDiv = document.getElementById("kml-import-error-message");

						var config = {
							cancelled: false,
							importType: importType,
							defaultElevation: defaultElevation || 0,
							blastName: blastName || "Imported",
							masterRLX: 0,
							masterRLY: 0,
							transform: false,
							epsgCode: null,
							proj4Source: null
						};

						// Check transformation options if WGS84
						if (isWGS84) {
							var transformRadio = document.querySelector('input[name="transform"]:checked');
							if (transformRadio && transformRadio.value === "transform") {
								config.transform = true;
								var epsgCode = document.getElementById("kml-import-epsg-code").value.trim();
								var customProj4 = document.getElementById("kml-import-custom-proj4").value.trim();

								if (!epsgCode && !customProj4) {
									errorDiv.textContent = "Please select an EPSG code or provide a custom Proj4 definition for transformation";
									errorDiv.style.display = "block";
									return;
								}

								config.epsgCode = epsgCode || null;
								config.proj4Source = customProj4 || null;

								// Load EPSG definition if needed
								if (epsgCode) {
									await window.loadEPSGCode(epsgCode);
								}
							}
						}

						dialog.close();
						resolve(config);
					} catch (error) {
						var errorDiv = document.getElementById("kml-import-error-message");
						if (errorDiv) {
							errorDiv.textContent = "Configuration error: " + error.message;
							errorDiv.style.display = "block";
						}
						console.error("KML import configuration error:", error);
					}
				},
				onCancel: function () {
					dialog.close();
					resolve({ cancelled: true });
				}
			});

			dialog.show();

			// Toggle EPSG section visibility
			if (isWGS84) {
				var transformRadios = document.querySelectorAll('input[name="transform"]');
				var epsgSection = document.getElementById("epsg-section");

				transformRadios.forEach(function (radio) {
					radio.addEventListener("change", function () {
						if (radio.value === "transform") {
							epsgSection.style.display = "grid";
						} else {
							epsgSection.style.display = "none";
						}
					});
				});
			}
		});
	}

	// Step 32) Parse placemarks as blast holes
	async parseAsBlastHoles(placemarks, config, filename) {
		var holes = [];
		var holeIDCounter = 1;

		// Step 33) Iterate through placemarks
		for (var i = 0; i < placemarks.length; i++) {
			var placemark = placemarks[i];

			// Step 34) Get hole ID from name
			var nameNode = placemark.querySelector("name");
			var holeID = nameNode ? nameNode.textContent.trim() : "H" + holeIDCounter;
			holeIDCounter++;

			// Step 35) Get coordinates
			var coordsNode = placemark.querySelector("coordinates");
			if (!coordsNode) {
				console.warn("Skipping placemark without coordinates:", holeID);
				continue;
			}

			var coordsText = coordsNode.textContent.trim();
			var coords = coordsText.split(/[\s,]+/).filter(function (c) {
				return c.length > 0;
			});

			if (coords.length < 2) {
				console.warn("Invalid coordinates for placemark:", holeID);
				continue;
			}

			var lon = parseFloat(coords[0]);
			var lat = parseFloat(coords[1]);
			var elevation = coords.length > 2 ? parseFloat(coords[2]) : config.defaultElevation;

			// Step 36) Transform coordinates if needed
			var x, y, z;

			if (config.transform) {
				var transformed = this.transformFromWGS84(lon, lat, elevation, config);
				x = transformed.x;
				y = transformed.y;
				z = transformed.z;
			} else {
				x = lon;
				y = lat;
				z = elevation;
			}

			// Step 36a) Apply Master RL offset
			x += config.masterRLX;
			y += config.masterRLY;

			// Step 37) Parse description for additional hole properties
			var holeProps = this.parseHoleDescription(placemark);

			// Step 38) Create blast hole object
			var hole = {
				entityName: config.blastName,
				entityType: "hole",
				holeID: holeID,
				startXLocation: x,
				startYLocation: y,
				startZLocation: z,
				endXLocation: holeProps.endXLocation || x,
				endYLocation: holeProps.endYLocation || y,
				endZLocation: holeProps.endZLocation || z - 3, // Default 3m depth
				gradeXLocation: holeProps.gradeXLocation || x,
				gradeYLocation: holeProps.gradeYLocation || y,
				gradeZLocation: holeProps.gradeZLocation || z,
				subdrillAmount: holeProps.subdrillAmount || 0,
				subdrillLength: holeProps.subdrillLength || 0,
				benchHeight: holeProps.benchHeight || 0,
				holeDiameter: holeProps.diameter || holeProps.holeDiameter || 115,
				holeType: holeProps.holeType || "Undefined",
				fromHoleID: "",
				timingDelayMilliseconds: 0,
				colorHexDecimal: "#FF0000",
				holeLengthCalculated: holeProps.calculatedHoleLength || holeProps.holeLengthCalculated || 3,
				holeAngle: 0,
				holeBearing: 0,
				measuredLength: 0,
				measuredLengthTimeStamp: "09/05/1975 00:00:00",
				measuredMass: 0,
				measuredMassTimeStamp: "09/05/1975 00:00:00",
				measuredComment: "None",
				measuredCommentTimeStamp: "09/05/1975 00:00:00",
				rowID: null,
				posID: null,
				visible: true,
				burden: 1,
				spacing: 1,
				connectorCurve: 0
			};

			holes.push(hole);
		}

		console.log("Parsed " + holes.length + " blast holes from KML/KMZ");

		return {
			success: true,
			dataType: "blastholes",
			holes: holes,
			message: "Imported " + holes.length + " blast holes"
		};
	}

	// Step 39) Parse description field for hole properties
	parseHoleDescription(placemark) {
		var props = {};

		var descNode = placemark.querySelector("description");
		if (!descNode) {
			return props;
		}

		var descText = descNode.textContent.trim();

		// Step 40) Try to parse JSON-like format: {key:value, key:value}
		var jsonMatch = descText.match(/\{([^}]+)\}/);
		if (jsonMatch) {
			var content = jsonMatch[1];
			var pairs = content.split(",");

			for (var i = 0; i < pairs.length; i++) {
				var pair = pairs[i].trim();
				var colonIndex = pair.indexOf(":");
				if (colonIndex > 0) {
					var key = pair.substring(0, colonIndex).trim();
					var value = pair.substring(colonIndex + 1).trim();

					// Parse numeric values
					if (/^-?\d+\.?\d*$/.test(value)) {
						props[key] = parseFloat(value);
					} else {
						props[key] = value;
					}
				}
			}
		}

		return props;
	}

	// Step 41) Parse placemarks as geometry (KAD)
	async parseAsGeometry(placemarks, config, filename) {
		var kadEntities = new Map();
		var pointCounter = 1;

		// Step 42) Build style map from KML styles
		var styleMap = this.parseKMLStyles(placemarks[0].ownerDocument);

		// Step 43) Iterate through placemarks
		for (var i = 0; i < placemarks.length; i++) {
			var placemark = placemarks[i];

			// Step 44) Get entity name from placemark name or folder
			var nameNode = placemark.querySelector("name");
			var entityName = nameNode ? nameNode.textContent.trim() : "Entity_" + i;

			// Step 45) Get style from styleUrl or inline style
			var styleUrl = placemark.querySelector("styleUrl");
			var styleId = styleUrl ? styleUrl.textContent.trim().replace("#", "") : null;
			var style = (styleId && styleMap[styleId]) ? styleMap[styleId] : this.parseInlineStyle(placemark);

			// Step 46) Parse description for additional properties
			var descProps = this.parseEntityDescription(placemark);

			// Step 47) Determine geometry type
			var pointNode = placemark.querySelector("Point");
			var lineNode = placemark.querySelector("LineString");
			var polyNode = placemark.querySelector("Polygon");

			var entityType = descProps.entityType || "point";
			var coordsNode = null;

			// Override type based on geometry
			if (polyNode) {
				entityType = "poly";
				coordsNode = polyNode.querySelector("coordinates");
			} else if (lineNode) {
				entityType = "line";
				coordsNode = lineNode.querySelector("coordinates");
			} else if (pointNode) {
				// Could be point, text, or circle - check description
				if (descProps.entityType === "text") {
					entityType = "text";
				} else if (descProps.entityType === "circle" || descProps.radius !== undefined) {
					entityType = "circle";
				} else {
					entityType = "point";
				}
				coordsNode = pointNode.querySelector("coordinates");
			}

			if (!coordsNode) {
				console.warn("Skipping placemark without coordinates:", entityName);
				continue;
			}

			// Step 48) Parse coordinates
			var coordsText = coordsNode.textContent.trim();
			var coordPairs = coordsText.split(/\s+/).filter(function (c) {
				return c.length > 0;
			});

			var entityData = [];

			for (var j = 0; j < coordPairs.length; j++) {
				var coords = coordPairs[j].split(",");
				if (coords.length < 2) continue;

				var lon = parseFloat(coords[0]);
				var lat = parseFloat(coords[1]);
				var elevation = coords.length > 2 ? parseFloat(coords[2]) : config.defaultElevation;

				// Transform if needed
				var x, y, z;
				if (config.transform) {
					var transformed = this.transformFromWGS84(lon, lat, elevation, config);
					x = transformed.x;
					y = transformed.y;
					z = transformed.z;
				} else {
					x = lon;
					y = lat;
					z = elevation;
				}

				// Step 49) Apply Master RL offset
				x += config.masterRLX;
				y += config.masterRLY;

				// Step 50) Create KAD point object with extracted or default properties
				var point = {
					pointID: pointCounter++,
					pointXLocation: x,
					pointYLocation: y,
					pointZLocation: z,
					lineWidth: descProps.lineWidth || style.lineWidth || 1,
					color: descProps.color || style.color || "#FFFF00"
				};

				// Add text if text entity
				if (entityType === "text") {
					// Try to get text from description, or use entity name, or placemark name
					point.text = descProps.text || entityName;
					point.fontHeight = descProps.fontHeight || 12;
				}

				// Add radius if circle entity
				if (entityType === "circle") {
					point.radius = descProps.radius || 10;
				}

				entityData.push(point);
			}

			// Step 51) Add to kadEntities map
			if (entityData.length > 0) {
				kadEntities.set(entityName, {
					entityName: entityName,
					entityType: entityType,
					data: entityData
				});
			}
		}

		console.log("Parsed " + kadEntities.size + " geometry entities from KML/KMZ");

		return {
			success: true,
			dataType: "geometry",
			kadEntities: kadEntities,
			message: "Imported " + kadEntities.size + " geometry entities"
		};
	}

	// Step 52) Parse KML styles into a lookup map
	parseKMLStyles(xmlDoc) {
		var styleMap = {};
		var styles = xmlDoc.querySelectorAll("Style[id]");

		for (var i = 0; i < styles.length; i++) {
			var style = styles[i];
			var styleId = style.getAttribute("id");

			var lineStyle = style.querySelector("LineStyle");
			var iconStyle = style.querySelector("IconStyle");
			var polyStyle = style.querySelector("PolyStyle");

			var color = "#FFFF00";
			var lineWidth = 1;

			// Extract color from LineStyle first, then IconStyle
			if (lineStyle) {
				var lineColor = lineStyle.querySelector("color");
				if (lineColor) {
					color = this.kmlColorToHex(lineColor.textContent.trim());
				}
				var width = lineStyle.querySelector("width");
				if (width) {
					lineWidth = parseFloat(width.textContent.trim()) || 1;
				}
			} else if (iconStyle) {
				var iconColor = iconStyle.querySelector("color");
				if (iconColor) {
					color = this.kmlColorToHex(iconColor.textContent.trim());
				}
			}

			styleMap[styleId] = {
				color: color,
				lineWidth: lineWidth
			};
		}

		return styleMap;
	}

	// Step 53) Parse inline style from placemark
	parseInlineStyle(placemark) {
		var style = {
			color: "#FFFF00",
			lineWidth: 1
		};

		var inlineStyle = placemark.querySelector("Style");
		if (!inlineStyle) {
			return style;
		}

		var lineStyle = inlineStyle.querySelector("LineStyle");
		var iconStyle = inlineStyle.querySelector("IconStyle");

		if (lineStyle) {
			var lineColor = lineStyle.querySelector("color");
			if (lineColor) {
				style.color = this.kmlColorToHex(lineColor.textContent.trim());
			}
			var width = lineStyle.querySelector("width");
			if (width) {
				style.lineWidth = parseFloat(width.textContent.trim()) || 1;
			}
		} else if (iconStyle) {
			var iconColor = iconStyle.querySelector("color");
			if (iconColor) {
				style.color = this.kmlColorToHex(iconColor.textContent.trim());
			}
		}

		return style;
	}

	// Step 54) Convert KML color (AABBGGRR) to hex (#RRGGBB)
	kmlColorToHex(kmlColor) {
		if (!kmlColor || kmlColor.length < 6) {
			return "#FFFF00";
		}

		// KML format: AABBGGRR
		// Extract RR GG BB (skip AA alpha)
		var rr = kmlColor.substring(6, 8);
		var gg = kmlColor.substring(4, 6);
		var bb = kmlColor.substring(2, 4);

		return "#" + rr.toUpperCase() + gg.toUpperCase() + bb.toUpperCase();
	}

	// Step 55) Parse entity description for properties
	parseEntityDescription(placemark) {
		var props = {};

		var descNode = placemark.querySelector("description");
		if (!descNode) {
			return props;
		}

		var descText = descNode.textContent.trim();

		// Step 56) Try to parse object format: pointObject = {...}
		var objectMatch = descText.match(/(pointObject|textObject|lineObject|polyObject|circleObject)\s*=\s*\{([^}]+)\}/);
		if (objectMatch) {
			var entityType = objectMatch[1].replace("Object", "");
			props.entityType = entityType;

			var content = objectMatch[2];
			var pairs = content.split(",");

			for (var i = 0; i < pairs.length; i++) {
				var pair = pairs[i].trim();
				var colonIndex = pair.indexOf(":");
				if (colonIndex > 0) {
					var key = pair.substring(0, colonIndex).trim();
					var value = pair.substring(colonIndex + 1).trim();

					// Remove quotes and comments
					value = value.replace(/\/\/.*$/, "").trim();
					value = value.replace(/["']/g, "");

					// Parse numeric values
					if (/^-?\d+\.?\d*$/.test(value)) {
						props[key] = parseFloat(value);
					} else {
						props[key] = value;
					}
				}
			}
		}

		return props;
	}

	// Step 47) Transform coordinates from WGS84 to target projection
	transformFromWGS84(lon, lat, elevation, config) {
		var sourceDef = "EPSG:4326"; // WGS84
		var targetDef = config.proj4Source || "EPSG:" + config.epsgCode;

		var transformed = proj4(sourceDef, targetDef, [lon, lat]);

		return {
			x: transformed[0],
			y: transformed[1],
			z: elevation
		};
	}

	// Step 48) Helper - read file as text
	readFileAsText(file) {
		return new Promise(function (resolve, reject) {
			var reader = new FileReader();
			reader.onload = function (e) {
				resolve(e.target.result);
			};
			reader.onerror = function (e) {
				reject(new Error("Failed to read file"));
			};
			reader.readAsText(file);
		});
	}

	// Step 49) Helper - read file as array buffer
	readFileAsArrayBuffer(file) {
		return new Promise(function (resolve, reject) {
			var reader = new FileReader();
			reader.onload = function (e) {
				resolve(e.target.result);
			};
			reader.onerror = function (e) {
				reject(new Error("Failed to read file"));
			};
			reader.readAsArrayBuffer(file);
		});
	}
}

export default KMLKMZParser;
