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

// src/fileIO/GoogleMapsIO/KMLKMZWriter.js
//=============================================================
// KML/KMZ WRITER
//=============================================================
// Step 1) Writes blast holes and geometry data to KML/KMZ files
// Step 2) Supports coordinate transformation from local/UTM to WGS84
// Step 3) Two export modes: blast holes (placemarks) and geometry (KAD)
// Step 4) Created: 2026-01-10

import BaseWriter from "../BaseWriter.js";
import JSZip from "jszip";
import proj4 from "proj4";

// Step 5) KMLKMZWriter class
class KMLKMZWriter extends BaseWriter {
	constructor(options = {}) {
		super(options);

		// Step 6) Writer options
		this.exportType = options.exportType || "blastholes"; // "blastholes" or "geometry"
		this.compressed = options.compressed || false; // KML or KMZ (zip compressed)
		this.proj4Source = options.proj4Source || null; // Source projection
		this.epsgCode = options.epsgCode || null; // Source EPSG code
		this.includeDescription = options.includeDescription !== false;
	}

	// Step 7) Main write method
	async write(data) {
		// Step 8) Validate input data
		if (!data) {
			throw new Error("Invalid data: data object required");
		}

		// Step 9) Check if projection is configured
		if (!this.proj4Source && !this.epsgCode) {
			throw new Error("Projection configuration required. Please provide proj4Source or epsgCode.");
		}

		// Step 10) Generate KML based on export type
		var kmlString = "";

		if (this.exportType === "blastholes") {
			kmlString = await this.generateBlastHolesKML(data);
		} else if (this.exportType === "geometry") {
			kmlString = await this.generateGeometryKML(data);
		} else {
			throw new Error("Unsupported export type: " + this.exportType);
		}

		// Step 11) Create blob - KML or KMZ (compressed)
		if (this.compressed) {
			return await this.createKMZ(kmlString, data.filename || "export.kml");
		} else {
			return this.createBlob(kmlString, "application/vnd.google-earth.kml+xml");
		}
	}

	// Step 12) Transform coordinates from source projection to WGS84
	transformToWGS84(x, y, z) {
		// Step 13) Define source and target projections
		var sourceDef = this.proj4Source || "EPSG:" + this.epsgCode;
		var targetDef = "EPSG:4326"; // WGS84

		// Step 14) Transform X,Y coordinates
		var transformed = proj4(sourceDef, targetDef, [x, y]);

		// Step 15) Return [longitude, latitude, elevation]
		// KML uses lon,lat,elevation format
		return {
			lon: transformed[0],
			lat: transformed[1],
			elevation: z || 0
		};
	}

	// Step 16) Generate KML for blast holes
	async generateBlastHolesKML(data) {
		// Step 17) Validate holes array
		if (!data.holes || !Array.isArray(data.holes)) {
			throw new Error("Invalid data: holes array required");
		}

		// Step 18) Filter visible holes
		var visibleHoles = this.filterVisibleHoles(data.holes);

		if (visibleHoles.length === 0) {
			throw new Error("No visible holes to export");
		}

		// Step 19) Start building KML document
		var kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
		kml += '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom">\n';
		kml += "<Document>\n";

		// Step 20) Document name
		var docName = data.documentName || "KIRRA_BLASTS_" + this.generateTimestamp();
		kml += "	<name>" + this.escapeXML(docName) + "</name>\n";
		kml += "	<open>1</open>\n";
		kml += '	<atom:link rel="app" href="https://www.kirra2d.com" title="Kirra2D"></atom:link>\n';

		// Step 21) Define styles for placemarks
		kml += this.generateKMLStyles();

		// Step 22) Group holes by entity name
		var holesByEntity = this.groupHolesByEntity(visibleHoles);

		// Step 23) Create folders for each entity
		var entityNames = Object.keys(holesByEntity);
		for (var i = 0; i < entityNames.length; i++) {
			var entityName = entityNames[i];
			var holesInEntity = holesByEntity[entityName];

			kml += "	<Folder>\n";
			kml += "		<name>" + this.escapeXML(entityName) + "</name>\n";
			kml += "		<open>1</open>\n";

			// Step 24) Create placemark for each hole
			for (var j = 0; j < holesInEntity.length; j++) {
				var hole = holesInEntity[j];
				kml += this.generateHolePlacemark(hole);
			}

			kml += "	</Folder>\n";
		}

		// Step 25) Close document
		kml += "</Document>\n";
		kml += "</kml>\n";

		return kml;
	}

	// Step 26) Generate KML for geometry (KAD entities)
	async generateGeometryKML(data) {
		// Step 27) Validate geometry data
		if (!data.entities || !Array.isArray(data.entities)) {
			throw new Error("Invalid data: entities array required");
		}

		// Step 28) Filter visible entities
		var visibleEntities = this.filterVisibleEntities(data.entities);

		if (visibleEntities.length === 0) {
			throw new Error("No visible entities to export");
		}

		// Step 29) Start building KML document
		var kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
		kml += '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom">\n';
		kml += "<Document>\n";

		// Step 30) Document name
		var docName = data.documentName || "KIRRA_GEOMETRY_" + this.generateTimestamp();
		kml += "	<name>" + this.escapeXML(docName) + "</name>\n";
		kml += "	<open>1</open>\n";
		kml += '	<atom:link rel="app" href="https://www.kirra2d.com" title="Kirra2D"></atom:link>\n';

		// Step 31) Define default styles
		kml += this.generateKMLStyles();

		// Step 31a) Generate entity-specific styles
		for (var i = 0; i < visibleEntities.length; i++) {
			var entity = visibleEntities[i];
			var styleId = "style_entity_" + i;
			entity.styleId = styleId; // Store for later reference
			kml += this.generateEntityStyle(entity, styleId);
		}

		// Step 32) Group entities by type
		var entitiesByType = this.groupEntitiesByType(visibleEntities);

		// Step 33) Create folders for each type
		var types = ["point", "line", "poly", "circle", "text"];
		var folderNames = {
			point: "POINTS",
			line: "LINES",
			poly: "POLYGONS",
			circle: "CIRCLES",
			text: "TEXT"
		};

		for (var i = 0; i < types.length; i++) {
			var type = types[i];
			var entities = entitiesByType[type];

			if (entities && entities.length > 0) {
				kml += "	<Folder>\n";
				kml += "		<name>" + folderNames[type] + "</name>\n";
				kml += "		<open>1</open>\n";

				for (var j = 0; j < entities.length; j++) {
					// For points, text, and circles, create separate placemarks for each coordinate
					if (type === "point" || type === "text" || type === "circle") {
						kml += this.generateMultiPointPlacemarks(entities[j], type);
					} else {
						kml += this.generateEntityPlacemark(entities[j]);
					}
				}

				kml += "	</Folder>\n";
			}
		}

		// Step 34) Close document
		kml += "</Document>\n";
		kml += "</kml>\n";

		return kml;
	}

	// Step 35) Group entities by type
	groupEntitiesByType(entities) {
		var grouped = {
			point: [],
			line: [],
			poly: [],
			circle: [],
			text: []
		};

		for (var i = 0; i < entities.length; i++) {
			var entity = entities[i];
			var type = entity.type || entity.entityType || "point";

			if (grouped[type]) {
				grouped[type].push(entity);
			}
		}

		return grouped;
	}

	// Step 34) Generate KML styles
	generateKMLStyles() {
		var styles = "";

		// Step 35) Point style (target)
		styles += '	<Style id="s_point">\n';
		styles += "		<IconStyle>\n";
		styles += "			<scale>1.2</scale>\n";
		styles += "			<Icon>\n";
		styles += "				<href>http://maps.google.com/mapfiles/kml/shapes/target.png</href>\n";
		styles += "			</Icon>\n";
		styles += "		</IconStyle>\n";
		styles += "		<ListStyle>\n";
		styles += "		</ListStyle>\n";
		styles += "	</Style>\n";

		// Step 36) Point highlight style
		styles += '	<Style id="s_point_hl">\n';
		styles += "		<IconStyle>\n";
		styles += "			<scale>1.4</scale>\n";
		styles += "			<Icon>\n";
		styles += "				<href>http://maps.google.com/mapfiles/kml/shapes/target.png</href>\n";
		styles += "			</Icon>\n";
		styles += "		</IconStyle>\n";
		styles += "		<ListStyle>\n";
		styles += "		</ListStyle>\n";
		styles += "	</Style>\n";

		// Step 37) Point style map
		styles += '	<StyleMap id="style_point">\n';
		styles += "		<Pair>\n";
		styles += "			<key>normal</key>\n";
		styles += "			<styleUrl>#s_point</styleUrl>\n";
		styles += "		</Pair>\n";
		styles += "		<Pair>\n";
		styles += "			<key>highlight</key>\n";
		styles += "			<styleUrl>#s_point_hl</styleUrl>\n";
		styles += "		</Pair>\n";
		styles += "	</StyleMap>\n";

		// Step 38) Text style (open-diamond)
		styles += '	<Style id="s_text">\n';
		styles += "		<IconStyle>\n";
		styles += "			<scale>1.2</scale>\n";
		styles += "			<Icon>\n";
		styles += "				<href>http://maps.google.com/mapfiles/kml/shapes/open-diamond.png</href>\n";
		styles += "			</Icon>\n";
		styles += "		</IconStyle>\n";
		styles += "		<ListStyle>\n";
		styles += "		</ListStyle>\n";
		styles += "	</Style>\n";

		// Step 39) Text highlight style
		styles += '	<Style id="s_text_hl">\n';
		styles += "		<IconStyle>\n";
		styles += "			<scale>1.4</scale>\n";
		styles += "			<Icon>\n";
		styles += "				<href>http://maps.google.com/mapfiles/kml/shapes/open-diamond.png</href>\n";
		styles += "			</Icon>\n";
		styles += "		</IconStyle>\n";
		styles += "		<ListStyle>\n";
		styles += "		</ListStyle>\n";
		styles += "	</Style>\n";

		// Step 40) Text style map
		styles += '	<StyleMap id="style_text">\n';
		styles += "		<Pair>\n";
		styles += "			<key>normal</key>\n";
		styles += "			<styleUrl>#s_text</styleUrl>\n";
		styles += "		</Pair>\n";
		styles += "		<Pair>\n";
		styles += "			<key>highlight</key>\n";
		styles += "			<styleUrl>#s_text_hl</styleUrl>\n";
		styles += "		</Pair>\n";
		styles += "	</StyleMap>\n";

		// Step 41) Default placemark style (for blast holes)
		styles += '	<Style id="s_ylw-pushpin">\n';
		styles += "		<IconStyle>\n";
		styles += "			<scale>1.2</scale>\n";
		styles += "			<Icon>\n";
		styles += "				<href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>\n";
		styles += "			</Icon>\n";
		styles += "		</IconStyle>\n";
		styles += "		<ListStyle>\n";
		styles += "		</ListStyle>\n";
		styles += "	</Style>\n";

		// Step 42) Default highlight style
		styles += '	<Style id="s_ylw-pushpin_hl">\n';
		styles += "		<IconStyle>\n";
		styles += "			<scale>1.2</scale>\n";
		styles += "			<Icon>\n";
		styles += "				<href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle_highlight.png</href>\n";
		styles += "			</Icon>\n";
		styles += "		</IconStyle>\n";
		styles += "		<ListStyle>\n";
		styles += "		</ListStyle>\n";
		styles += "	</Style>\n";

		// Step 43) Default style map
		styles += '	<StyleMap id="style1">\n';
		styles += "		<Pair>\n";
		styles += "			<key>normal</key>\n";
		styles += "			<styleUrl>#s_ylw-pushpin</styleUrl>\n";
		styles += "		</Pair>\n";
		styles += "		<Pair>\n";
		styles += "			<key>highlight</key>\n";
		styles += "			<styleUrl>#s_ylw-pushpin_hl</styleUrl>\n";
		styles += "		</Pair>\n";
		styles += "	</StyleMap>\n";

		return styles;
	}
	// Step 38) Generate entity-specific style
	generateEntityStyle(entity, styleId) {
		var style = "";
		var color = entity.color || "#FFFF00"; // Default yellow
		var lineWidth = 2;
		var entityType = entity.type || entity.entityType || "point";

		// Get line width from first coordinate if available
		if (entity.coordinates && entity.coordinates.length > 0 && entity.coordinates[0].lineWidth) {
			lineWidth = entity.coordinates[0].lineWidth;
		}

		var kmlColor = this.hexToKMLColor(color, lineWidth);

		// Select appropriate icon based on entity type
		var iconHref = "http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png";
		if (entityType === "point") {
			iconHref = "http://maps.google.com/mapfiles/kml/shapes/target.png";
		} else if (entityType === "text") {
			iconHref = "http://maps.google.com/mapfiles/kml/shapes/open-diamond.png";
		}

		style += '	<Style id="' + styleId + '">\n';
		style += "		<IconStyle>\n";
		style += "			<scale>1.2</scale>\n";
		style += "			<Icon>\n";
		style += "				<href>" + iconHref + "</href>\n";
		style += "			</Icon>\n";
		style += "		</IconStyle>\n";
		style += "		<LineStyle>\n";
		style += "			<color>" + kmlColor + "</color>\n";
		style += "			<width>" + lineWidth + "</width>\n";
		style += "		</LineStyle>\n";
		style += "		<PolyStyle>\n";
		style += "			<fill>0</fill>\n"; // No fill for polygons
		style += "		</PolyStyle>\n";
		style += "	</Style>\n";

		return style;
	}
	// Step 38) Generate placemark for a single blast hole
	generateHolePlacemark(hole) {
		var placemark = "";

		placemark += "		<Placemark>\n";

		// Step 39) Hole ID as name
		placemark += "			<name>" + this.escapeXML(String(hole.holeID || "")) + "</name>\n";

		// Step 40) Description with hole metadata
		if (this.includeDescription) {
			var description = this.generateHoleDescription(hole);
			placemark += "			<description>" + this.escapeXML(description) + "</description>\n";
		}

		// Step 41) Style reference
		placemark += "			<styleUrl>#style1</styleUrl>\n";

		// Step 42) Transform collar coordinates to WGS84
		var collarWGS84 = this.transformToWGS84(hole.startXLocation, hole.startYLocation, hole.startZLocation);

		// Step 43) Point geometry at collar location
		placemark += "			<Point>\n";
		placemark += "				<coordinates>" + collarWGS84.lon.toFixed(12) + "," + collarWGS84.lat.toFixed(12) + "," + collarWGS84.elevation.toFixed(3) + "</coordinates>\n";
		placemark += "			</Point>\n";

		placemark += "		</Placemark>\n";

		return placemark;
	}

	// Step 44) Generate description text for blast hole
	generateHoleDescription(hole) {
		// Step 45) Build description similar to reference KML
		var desc = "Origin:\n";
		desc += "{startXLocation:" + (hole.startXLocation || 0).toFixed(3) + ", ";
		desc += "startYLocation:" + (hole.startYLocation || 0).toFixed(3) + ", ";
		desc += "startZLocation:" + (hole.startZLocation || 0).toFixed(3) + ", ";
		desc += "endXLocation:" + (hole.endXLocation || 0).toFixed(3) + ", ";
		desc += "endYLocation:" + (hole.endYLocation || 0).toFixed(3) + ", ";
		desc += "endZLocation:" + (hole.endZLocation || 0).toFixed(3) + ", ";
		desc += "subdrillAmount:" + (hole.subdrillAmount || 0).toFixed(1) + ", ";
		desc += "calculatedHoleLength:" + (hole.holeLengthCalculated || 0).toFixed(1) + "m ";
		desc += "diameter:" + (hole.holeDiameter || 0).toFixed(0) + "mm}";

		return desc;
	}

	// Step 45) Generate multiple placemarks for point/text/circle entities (one per coordinate)
	generateMultiPointPlacemarks(entity, entityType) {
		var placemarks = "";
		var baseEntityName = entity.name || entity.entityName || "Unnamed";

		if (!entity.coordinates || entity.coordinates.length === 0) {
			return "";
		}

		// Step 45a) Iterate through each coordinate and create a separate placemark
		for (var i = 0; i < entity.coordinates.length; i++) {
			var coord = entity.coordinates[i];
			var pointID = coord.id || coord.pointID || i + 1;

			// Pad point ID with zeros (e.g., 00001, 00002)
			var paddedID = String(pointID).padStart(5, "0");

			// Get color from coordinate (each point can have its own color)
			var pointColor = coord.color || entity.color || "#FFFF00";

			// For text entities, the text value is stored in coord.text or entity.text
			var textValue = coord.text || entity.text || "";

			// Create individual entity object for this point
			var pointEntity = {
				name: baseEntityName + "_" + paddedID,
				entityName: baseEntityName,
				type: entityType,
				entityType: entityType,
				color: pointColor, // Use coordinate-specific color
				coordinates: [coord], // Single coordinate
				text: textValue, // For text entities
				radius: coord.radius || entity.radius || 10, // For circle entities
				pointID: pointID,
				x: coord.x || coord[0] || 0,
				y: coord.y || coord[1] || 0,
				z: coord.z || coord[2] || 0,
				lineWidth: coord.lineWidth || 1
			};

			// For text entities, use the actual text value in the name
			if (entityType === "text" && textValue) {
				pointEntity.name = textValue + "_" + baseEntityName + "_" + paddedID;
			}

			// Generate individual style for this point with its specific color
			var styleId = "style_" + entityType + "_" + baseEntityName + "_" + paddedID;
			pointEntity.styleId = styleId;
			placemarks += this.generatePointStyle(pointEntity, styleId, entityType);

			placemarks += this.generateSinglePointPlacemark(pointEntity, entityType);
		}

		return placemarks;
	}

	// Step 45b) Generate individual style for each point with its specific color
	generatePointStyle(entity, styleId, entityType) {
		var style = "";
		var color = entity.color || "#FFFF00";
		var lineWidth = parseFloat(entity.lineWidth || 1);

		var kmlColor = this.hexToKMLColor(color, lineWidth);

		// Select appropriate icon based on entity type
		var iconHref = "http://maps.google.com/mapfiles/kml/shapes/target.png";
		if (entityType === "text") {
			iconHref = "http://maps.google.com/mapfiles/kml/shapes/open-diamond.png";
		}

		style += '	<Style id="' + styleId + '">\n';
		style += "		<IconStyle>\n";
		style += "			<color>" + kmlColor + "</color>\n";
		style += "			<scale>1.2</scale>\n";
		style += "			<Icon>\n";
		style += "				<href>" + iconHref + "</href>\n";
		style += "			</Icon>\n";
		style += "		</IconStyle>\n";
		style += "		<LineStyle>\n";
		style += "			<color>" + kmlColor + "</color>\n";
		style += "			<width>" + lineWidth + "</width>\n";
		style += "		</LineStyle>\n";
		style += "		<PolyStyle>\n";
		style += "			<fill>0</fill>\n";
		style += "		</PolyStyle>\n";
		style += "	</Style>\n";

		return style;
	}

	// Step 45c) Generate a single point placemark with description
	generateSinglePointPlacemark(entity, entityType) {
		var placemark = "";

		placemark += "		<Placemark>\n";
		placemark += "			<name>" + this.escapeXML(entity.name) + "</name>\n";

		// Add description
		placemark += this.generateEntityDescription(entity, entityType);

		// Style reference
		var styleRef = entity.styleId ? "#" + entity.styleId : "#style1";
		placemark += "			<styleUrl>" + styleRef + "</styleUrl>\n";

		// Generate geometry
		if (entityType === "circle") {
			placemark += this.generateCircleAsPolygon(entity);
		} else {
			// Point or text
			placemark += this.generatePointGeometry(entity);
		}

		placemark += "		</Placemark>\n";

		return placemark;
	}

	// Step 46) Generate placemark for geometry entity
	generateEntityPlacemark(entity) {
		var placemark = "";
		var entityType = entity.type || entity.entityType || "point";

		placemark += "		<Placemark>\n";

		// Step 47) Entity name
		var name = entity.name || entity.entityName || "Unnamed";

		placemark += "			<name>" + this.escapeXML(name) + "</name>\n";

		// Step 47a) Add description
		placemark += this.generateEntityDescription(entity, entityType);

		// Step 48) Style reference - use entity-specific style if available
		var styleRef = entity.styleId ? "#" + entity.styleId : "#style1";
		placemark += "			<styleUrl>" + styleRef + "</styleUrl>\n";

		// Step 49) Generate geometry based on entity type
		if (entityType === "line") {
			placemark += this.generateLineGeometry(entity);
		} else if (entityType === "poly") {
			placemark += this.generatePolygonGeometry(entity);
		}

		placemark += "		</Placemark>\n";

		return placemark;
	}

	// Step 51) Generate point geometry
	generatePointGeometry(entity) {
		// For points, use the first coordinate or entity x/y/z
		var x, y, z;

		if (entity.coordinates && entity.coordinates.length > 0) {
			var coord = entity.coordinates[0];
			x = coord.x || coord[0] || 0;
			y = coord.y || coord[1] || 0;
			z = coord.z || coord[2] || 0;
		} else {
			x = entity.x || 0;
			y = entity.y || 0;
			z = entity.z || 0;
		}

		var wgs84 = this.transformToWGS84(x, y, z);

		var geom = "			<Point>\n";
		geom += "				<coordinates>" + wgs84.lon.toFixed(12) + "," + wgs84.lat.toFixed(12) + "," + wgs84.elevation.toFixed(3) + "</coordinates>\n";
		geom += "			</Point>\n";

		return geom;
	}

	// Step 52) Generate line geometry
	generateLineGeometry(entity) {
		if (!entity.coordinates || !Array.isArray(entity.coordinates)) {
			return "";
		}

		var geom = "			<LineString>\n";
		geom += "				<tessellate>1</tessellate>\n";
		geom += "				<coordinates>\n";

		// Step 53) Transform each coordinate
		for (var i = 0; i < entity.coordinates.length; i++) {
			var coord = entity.coordinates[i];
			var x = coord.x || coord[0] || 0;
			var y = coord.y || coord[1] || 0;
			var z = coord.z || coord[2] || 0;
			var wgs84 = this.transformToWGS84(x, y, z);

			geom += "					" + wgs84.lon.toFixed(12) + "," + wgs84.lat.toFixed(12) + "," + wgs84.elevation.toFixed(3);

			// Add space separator except for last coordinate
			if (i < entity.coordinates.length - 1) {
				geom += " ";
			}
		}

		geom += "\n";
		geom += "				</coordinates>\n";
		geom += "			</LineString>\n";

		return geom;
	}

	// Step 54) Generate polygon geometry
	generatePolygonGeometry(entity) {
		if (!entity.coordinates || !Array.isArray(entity.coordinates)) {
			return "";
		}

		var geom = "			<Polygon>\n";
		geom += "				<tessellate>1</tessellate>\n";
		geom += "				<outerBoundaryIs>\n";
		geom += "					<LinearRing>\n";
		geom += "						<coordinates>\n";

		// Step 55) Transform each coordinate
		for (var i = 0; i < entity.coordinates.length; i++) {
			var coord = entity.coordinates[i];
			var x = coord.x || coord[0] || 0;
			var y = coord.y || coord[1] || 0;
			var z = coord.z || coord[2] || 0;
			var wgs84 = this.transformToWGS84(x, y, z);

			geom += "							" + wgs84.lon.toFixed(12) + "," + wgs84.lat.toFixed(12) + "," + wgs84.elevation.toFixed(3);

			// Add space separator except for last coordinate
			if (i < entity.coordinates.length - 1) {
				geom += " ";
			}
		}

		// Step 56) Close polygon by repeating first point
		if (entity.coordinates.length > 0) {
			var firstCoord = entity.coordinates[0];
			var x = firstCoord.x || firstCoord[0] || 0;
			var y = firstCoord.y || firstCoord[1] || 0;
			var z = firstCoord.z || firstCoord[2] || 0;
			var wgs84First = this.transformToWGS84(x, y, z);
			geom += " " + wgs84First.lon.toFixed(12) + "," + wgs84First.lat.toFixed(12) + "," + wgs84First.elevation.toFixed(3);
		}

		geom += " \n";
		geom += "						</coordinates>\n";
		geom += "					</LinearRing>\n";
		geom += "				</outerBoundaryIs>\n";
		geom += "			</Polygon>\n";

		return geom;
	}

	// Step 57) Generate circle as polygon (approximate circle with 36 segments)
	generateCircleAsPolygon(entity) {
		if (!entity.coordinates || entity.coordinates.length === 0) {
			return "";
		}

		var center = entity.coordinates[0];
		var centerX = center.x || center[0] || 0;
		var centerY = center.y || center[1] || 0;
		var centerZ = center.z || center[2] || 0;
		var radius = entity.radius || 10;

		// Generate circle points
		var segments = 36;
		var circleCoords = [];

		for (var i = 0; i <= segments; i++) {
			var angle = i * 360 / segments * (Math.PI / 180);
			var x = centerX + radius * Math.cos(angle);
			var y = centerY + radius * Math.sin(angle);
			circleCoords.push({ x: x, y: y, z: centerZ });
		}

		var geom = "			<Polygon>\n";
		geom += "				<tessellate>1</tessellate>\n";
		geom += "				<outerBoundaryIs>\n";
		geom += "					<LinearRing>\n";
		geom += "						<coordinates>\n";

		for (var i = 0; i < circleCoords.length; i++) {
			var wgs84 = this.transformToWGS84(circleCoords[i].x, circleCoords[i].y, circleCoords[i].z);
			geom += "							" + wgs84.lon.toFixed(12) + "," + wgs84.lat.toFixed(12) + "," + wgs84.elevation.toFixed(3);
			if (i < circleCoords.length - 1) {
				geom += " ";
			}
		}

		geom += " \n";
		geom += "						</coordinates>\n";
		geom += "					</LinearRing>\n";
		geom += "				</outerBoundaryIs>\n";
		geom += "			</Polygon>\n";

		return geom;
	}

	// Step 57a) Generate entity description with raw details
	generateEntityDescription(entity, entityType) {
		var desc = "";
		var entityName = entity.entityName || entity.name || "Unnamed";

		// Get coordinate data
		var coord = null;
		if (entity.coordinates && entity.coordinates.length > 0) {
			coord = entity.coordinates[0];
		}

		var x = parseFloat(entity.x || (coord ? coord.x || coord.pointXLocation || 0 : 0));
		var y = parseFloat(entity.y || (coord ? coord.y || coord.pointYLocation || 0 : 0));
		var z = parseFloat(entity.z || (coord ? coord.z || coord.pointZLocation || 0 : 0));
		var pointID = entity.pointID || (coord ? coord.id || coord.pointID || 1 : 1);
		var lineWidth = parseFloat(entity.lineWidth || (coord ? coord.lineWidth || 1 : 1));
		var color = entity.color || "#FFFF00";

		desc += "			<description>";

		if (entityType === "text") {
			// Text object description
			var text = entity.text || "TEXT";
			var fontHeight = parseFloat(entity.fontHeight || 12);

			desc += "textObject = {\n";
			desc += "   entityName: " + entityName + ",\n";
			desc += "   entityType: " + entityType + ",\n";
			desc += "   pointID: " + pointID + ",\n";
			desc += "   pointXLocation: " + x.toFixed(3) + ",\n";
			desc += "   pointYLocation: " + y.toFixed(3) + ",\n";
			desc += "   pointZLocation: " + z.toFixed(3) + ",\n";
			desc += "   text: " + text + ", // ? Now using the processed text\n";
			desc += "   color: " + color + ",\n";
			desc += "   fontHeight: " + fontHeight.toFixed(0) + ", // Step B1) Default fontHeight for new text entities\n";
			desc += "   connected: false,\n";
			desc += "   closed: false,\n";
			desc += "   visible: true,\n";
			desc += "  }";
		} else if (entityType === "point") {
			// Point object description
			desc += "pointObject = {\n";
			desc += "   entityName: " + entityName + ",\n";
			desc += "   entityType: " + entityType + ",\n";
			desc += "   pointID: " + pointID + ",\n";
			desc += "   pointXLocation: " + x.toFixed(3) + ",\n";
			desc += "   pointYLocation: " + y.toFixed(3) + ",\n";
			desc += "   pointZLocation: " + z.toFixed(3) + ",\n";
			desc += "   lineWidth: " + lineWidth.toFixed(3) + ", // This is added for inter-changable types. points &gt; lines &gt; polys\n";
			desc += "   color: " + color + ",\n";
			desc += "   connected: false,\n";
			desc += "   closed: false,\n";
			desc += "   visible: true,\n";
			desc += "  }";
		} else if (entityType === "line") {
			// Line object description
			desc += "lineObject = {\n";
			desc += "   entityName: " + entityName + ",\n";
			desc += "   entityType: " + entityType + ",\n";
			desc += "   points: " + (entity.coordinates ? entity.coordinates.length : 0) + ",\n";
			desc += "   lineWidth: " + lineWidth.toFixed(3) + ",\n";
			desc += "   color: " + color + ",\n";
			desc += "   connected: true,\n";
			desc += "   closed: false,\n";
			desc += "   visible: true,\n";
			desc += "  }";
		} else if (entityType === "poly") {
			// Polygon object description
			desc += "polyObject = {\n";
			desc += "   entityName: " + entityName + ",\n";
			desc += "   entityType: " + entityType + ",\n";
			desc += "   points: " + (entity.coordinates ? entity.coordinates.length : 0) + ",\n";
			desc += "   lineWidth: " + lineWidth.toFixed(3) + ",\n";
			desc += "   color: " + color + ",\n";
			desc += "   connected: true,\n";
			desc += "   closed: true,\n";
			desc += "   visible: true,\n";
			desc += "  }";
		} else if (entityType === "circle") {
			// Circle object description
			var radius = parseFloat(entity.radius || 10);
			desc += "circleObject = {\n";
			desc += "   entityName: " + entityName + ",\n";
			desc += "   entityType: " + entityType + ",\n";
			desc += "   centerX: " + x.toFixed(3) + ",\n";
			desc += "   centerY: " + y.toFixed(3) + ",\n";
			desc += "   centerZ: " + z.toFixed(3) + ",\n";
			desc += "   radius: " + radius.toFixed(3) + ",\n";
			desc += "   lineWidth: " + lineWidth.toFixed(3) + ",\n";
			desc += "   color: " + color + ",\n";
			desc += "   visible: true,\n";
			desc += "  }";
		}

		desc += "</description>\n";

		return desc;
	}

	// Step 57b) Group holes by entity name
	groupHolesByEntity(holes) {
		var grouped = {};

		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			var entityName = hole.entityName || "Unnamed";

			if (!grouped[entityName]) {
				grouped[entityName] = [];
			}

			grouped[entityName].push(hole);
		}

		return grouped;
	}

	// Step 58) Create KMZ file (zipped KML)
	async createKMZ(kmlString, kmlFilename) {
		// Step 59) Create JSZip instance
		var zip = new JSZip();

		// Step 60) Add KML file to zip as doc.kml (standard KMZ convention)
		zip.file("doc.kml", kmlString);

		// Step 61) Generate blob
		var blob = await zip.generateAsync({
			type: "blob",
			compression: "DEFLATE",
			compressionOptions: {
				level: 9
			}
		});

		return blob;
	}

	// Step 62) Escape XML special characters
	escapeXML(str) {
		if (!str) return "";

		return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
	}

	// Step 63) Convert hex color to KML format (AABBGGRR)
	hexToKMLColor(hexColor, lineWidth) {
		// Remove # if present
		var hex = hexColor.replace("#", "");

		// Ensure 6 characters
		if (hex.length === 3) {
			hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		}

		// Extract RGB
		var r = hex.substring(0, 2);
		var g = hex.substring(2, 4);
		var b = hex.substring(4, 6);

		// KML format: AABBGGRR (alpha, blue, green, red)
		// FF = fully opaque
		return "ff" + b + g + r;
	}
}
export default KMLKMZWriter;
