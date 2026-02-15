// src/models/BlastHole.js
// ============================================================
// BlastHole class - Data model for blast hole objects
// ============================================================
// Extracted from kirra.js (lines 4266-4353)
// Created: 2026-02-15
//
// TODO: This BlastHole class is currently NOT instantiated anywhere in the codebase.
// Blast holes are created as plain objects. The goal is to migrate all hole creation
// to use this class for type safety, validation, and computed properties (e.g. holeLength,
// angle calculations, grade interpolation). Migration steps:
// 1. Use `new BlastHole(data)` in CSV/KAP parsers and pattern generators
// 2. Add computed getters (holeLengthCalculated, subdrillLength, etc.)
// 3. Add validation methods
// 4. Ensure toJSON() round-trips with IndexedDB and CSV export

/**
 * The BlastHole class is used to store the data for a blast hole.
 *
 * @param {*} data
 * @param {string} entityName - The entity name
 * @param {string} entityType - The entity type (default: "hole")
 * @param {*} holeID - The hole identifier
 * @param {number} startXLocation - The start X location
 * @param {number} startYLocation - The start Y location
 * @param {number} startZLocation - The start Z location
 * @param {number} endXLocation - The end X location
 * @param {number} endYLocation - The end Y location
 * @param {number} endZLocation - The end Z location
 * @param {number} gradeXLocation - The grade X location
 * @param {number} gradeYLocation - The grade Y location
 * @param {number} gradeZLocation - The grade Z location
 * @param {number} subdrillAmount - The subdrill amount (deltaZ of gradeZ to toeZ -> downhole =+ve uphole =-ve)
 * @param {number} subdrillLength - The subdrill length (distance of subdrill from gradeXYZ to toeXYZ -> downhole =+ve uphole =-ve)
 * @param {number} benchHeight - The bench height (deltaZ of collarZ to gradeZ -> always Absolute)
 * @param {number} holeDiameter - The hole diameter
 * @param {string} holeType - The hole type
 * @param {string} fromHoleID - The from hole identifier
 * @param {number} timingDelayMilliseconds - The timing delay in milliseconds
 * @param {string} colorHexDecimal - The color in hex decimal format
 * @param {number} holeLengthCalculated - The calculated hole length (Distance from the collarXYZ to the ToeXYZ)
 * @param {number} holeAngle - The hole angle from Collar to Toe (0° = Vertical) --> 0° = Vertical, 90° = Horizontal, 180° = Inverted, 270° = Upside Down
 * @param {number} holeBearing - The hole bearing
 * @param {number} holeTime - The initiation time (holeTime and initiationTime are the same)
 * @param {number} measuredLength - The measured length
 * @param {string} measuredLengthTimeStamp - The measured length timestamp
 * @param {number} measuredMass - The measured mass
 * @param {string} measuredMassTimeStamp - The measured mass timestamp
 * @param {string} measuredComment - The measured comment
 * @param {string} measuredCommentTimeStamp - The measured comment timestamp
 * @param {*} rowID - The row identifier
 * @param {*} posID - The position identifier
 * @param {number} burden - The burden
 * @param {number} spacing - The spacing
 * @param {number} connectorCurve - The connector curve
 * @param {number} connectorVodMs - The VOD (m/s) of the surface connector product used to connect to this hole
 * @param {boolean} visible - The visibility flag
 * future properties:
 * @params {colorHexDecimal} holeColor - The color of the hole
 * @params {string} holeMarkerShape - The shape of the hole marker shape at collar - currently X for Dummy(no depth hole), square for no diameter hole and circle for a diameter hole
 * @params {float} holeMarkerSize - The size of the hole marker shape at collar - currently controlled by holescale and diameter.
 */
export class BlastHole {
	constructor(data = {}) {
		this.entityName = data.entityName || "";
		this.entityType = data.entityType || "hole";
		this.holeID = data.holeID || null;
		this.startXLocation = data.startXLocation || 0;
		this.startYLocation = data.startYLocation || 0;
		this.startZLocation = data.startZLocation || 0;
		this.endXLocation = data.endXLocation || 0;
		this.endYLocation = data.endYLocation || 0;
		this.endZLocation = data.endZLocation || 0;
		this.gradeXLocation = data.gradeXLocation || 0;
		this.gradeYLocation = data.gradeYLocation || 0;
		this.gradeZLocation = data.gradeZLocation || 0;
		this.subdrillAmount = data.subdrillAmount || 0; //deltaZ of gradeZ to toeZ -> downhole =+ve uphole =-ve
		this.subdrillLength = data.subdrillLength || 0; //distance of subdrill from gradeXYZ to toeXYZ -> downhole =+ve uphole =-ve
		this.benchHeight = data.benchHeight || 0; //deltaZ of collarZ to gradeZ -> always Absolute
		this.holeDiameter = data.holeDiameter || 115;
		this.holeType = data.holeType || "Undefined";
		this.fromHoleID = data.fromHoleID || "";
		this.timingDelayMilliseconds = data.timingDelayMilliseconds || 0;
		this.colorHexDecimal = data.colorHexDecimal || "red";
		this.holeTime = data.holeTime || 0; //initiation time and holeTime are the same
		this.holeLengthCalculated = data.holeLengthCalculated || 0; //Distance from the collarXYZ to the ToeXYZ
		this.holeAngle = data.holeAngle || 0; //Angle of the blast hole from Collar to Toe --> 0° = Vertical
		this.holeBearing = data.holeBearing || 0;
		this.measuredLength = data.measuredLength || 0;
		this.measuredLengthTimeStamp = data.measuredLengthTimeStamp || "09/05/1975 00:00:00";
		this.measuredMass = data.measuredMass || 0;
		this.measuredMassTimeStamp = data.measuredMassTimeStamp || "09/05/1975 00:00:00";
		this.measuredComment = data.measuredComment || "None";
		this.measuredCommentTimeStamp = data.measuredCommentTimeStamp || "09/05/1975 00:00:00";
		this.rowID = data.rowID || null;
		this.posID = data.posID || null;
		this.visible = data.visible !== false;
		this.burden = data.burden || 1;
		this.spacing = data.spacing || 1;
		this.connectorCurve = data.connectorCurve || 0;
		this.connectorVodMs = data.connectorVodMs || 0;
		this.massPerHole = data.massPerHole || 0; // Computed from charging system
	}
}
