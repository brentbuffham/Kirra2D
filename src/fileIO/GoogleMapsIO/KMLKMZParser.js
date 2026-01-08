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
