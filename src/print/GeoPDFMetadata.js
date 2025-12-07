///------------------ GEOPDF METADATA MODULE ------------------///
// This module generates georeferencing metadata for GeoPDF files

/**
 * Detects UTM zone from coordinate bounds
 * @param {number} minX - Minimum X coordinate (easting)
 * @param {number} maxX - Maximum X coordinate (easting)
 * @param {number} minY - Minimum Y coordinate (northing)
 * @param {number} maxY - Maximum Y coordinate (northing)
 * @returns {Object} UTM zone information {zone: number, hemisphere: 'N'|'S'}
 */
export function detectUTMZone(minX, maxX, minY, maxY) {
    // UTM zones are 6 degrees wide, starting at -180
    // Zone = floor((longitude + 180) / 6) + 1
    // For UTM coordinates, we need to work backwards
    // Typical UTM easting: 200000-900000 (zone-dependent)
    // Typical UTM northing: 0-10000000
    
    // If coordinates are in hundreds of thousands, likely UTM
    // Estimate zone from X coordinate (rough approximation)
    // This is a simplified detection - user should specify if known
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Default assumptions
    let zone = 56; // Common Australian zone
    let hemisphere = centerY < 10000000 ? "S" : "N"; // Southern hemisphere if northing < 10M
    
    return {zone, hemisphere};
}

/**
 * Gets EPSG code for UTM zone
 * @param {number} zone - UTM zone number (1-60)
 * @param {string} hemisphere - 'N' or 'S'
 * @returns {string} EPSG code (e.g., "EPSG:32656" for UTM Zone 56N)
 */
export function getEPSGCode(zone, hemisphere) {
    const baseEPSG = hemisphere === "N" ? 32600 : 32700;
    return "EPSG:" + (baseEPSG + zone);
}

/**
 * Generates WKT (Well-Known Text) for coordinate system
 * @param {number} zone - UTM zone number
 * @param {string} hemisphere - 'N' or 'S'
 * @returns {string} WKT string
 */
export function generateWKT(zone, hemisphere) {
    const epsg = getEPSGCode(zone, hemisphere);
    // Simplified WKT - full WKT would be more complex
    return "PROJCS[\"WGS 84 / UTM zone " + zone + hemisphere + "\",GEOGCS[\"WGS 84\",DATUM[\"WGS_1984\",SPHEROID[\"WGS 84\",6378137,298.257223563]],PRIMEM[\"Greenwich\",0],UNIT[\"degree\",0.0174532925199433]],PROJECTION[\"Transverse_Mercator\"],PARAMETER[\"latitude_of_origin\",0],PARAMETER[\"central_meridian\"," + ((zone - 1) * 6 - 180 + 3) + "],PARAMETER[\"scale_factor\",0.9996],PARAMETER[\"false_easting\",500000],PARAMETER[\"false_northing\"," + (hemisphere === "S" ? 10000000 : 0) + "],UNIT[\"metre\",1]]";
}

/**
 * Calculates georeferencing transformation matrix
 * Maps PDF coordinates to UTM coordinates
 * @param {number} pdfMinX - Minimum X in PDF coordinates
 * @param {number} pdfMinY - Minimum Y in PDF coordinates
 * @param {number} pdfMaxX - Maximum X in PDF coordinates
 * @param {number} pdfMaxY - Maximum Y in PDF coordinates
 * @param {number} utmMinX - Minimum X in UTM coordinates
 * @param {number} utmMinY - Minimum Y in UTM coordinates
 * @param {number} utmMaxX - Maximum X in UTM coordinates
 * @param {number} utmMaxY - Maximum Y in UTM coordinates
 * @returns {Object} Transformation parameters
 */
export function calculateGeoreferencingTransform(pdfMinX, pdfMinY, pdfMaxX, pdfMaxY, utmMinX, utmMinY, utmMaxX, utmMaxY) {
    const pdfWidth = pdfMaxX - pdfMinX;
    const pdfHeight = pdfMaxY - pdfMinY;
    const utmWidth = utmMaxX - utmMinX;
    const utmHeight = utmMaxY - utmMinY;
    
    // Scale factors
    const scaleX = utmWidth / pdfWidth;
    const scaleY = utmHeight / pdfHeight;
    
    // Origin offset
    const originX = utmMinX - pdfMinX * scaleX;
    const originY = utmMinY - pdfMinY * scaleY;
    
    return {
        scaleX,
        scaleY,
        originX,
        originY,
        rotation: 0 // No rotation for now
    };
}

/**
 * Generates GeoPDF metadata dictionary
 * @param {Object} params - Parameters object
 * @param {number} params.zone - UTM zone
 * @param {string} params.hemisphere - 'N' or 'S'
 * @param {Object} params.bounds - Coordinate bounds {minX, maxX, minY, maxY}
 * @param {Object} params.transform - Transformation parameters
 * @returns {Object} GeoPDF metadata dictionary structure
 */
export function generateGeoPDFMetadata(params) {
    const {zone, hemisphere, bounds, transform} = params;
    const epsg = getEPSGCode(zone, hemisphere);
    const wkt = generateWKT(zone, hemisphere);
    
    return {
        VP: {
            // Viewport dictionary
            Type: "Viewport",
            BBox: [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY],
            Measure: {
                Type: "Measure",
                Subtype: "GEO",
                X: {
                    // X coordinate system
                    F: bounds.minX, // First value
                    D: transform.scaleX, // Delta (scale)
                    C: [transform.originX, transform.originY] // Coefficients
                },
                Y: {
                    // Y coordinate system
                    F: bounds.minY,
                    D: transform.scaleY,
                    C: [transform.originX, transform.originY]
                }
            },
            CS: wkt // Coordinate system WKT
        },
        Measure: {
            Type: "Measure",
            Subtype: "GEO",
            GPTS: [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY], // Geographic points
            LPTS: [0, 0, 100, 100], // Logical points (PDF coordinates)
            GCS: epsg // Geographic coordinate system
        },
        Location: {
            // Location dictionary for coordinate display
            Type: "Location",
            X: bounds.minX,
            Y: bounds.minY,
            CS: epsg
        }
    };
}

/**
 * Converts PDF coordinates to UTM coordinates
 * @param {number} pdfX - PDF X coordinate
 * @param {number} pdfY - PDF Y coordinate
 * @param {Object} transform - Transformation parameters
 * @returns {Object} UTM coordinates {x, y}
 */
export function pdfToUTM(pdfX, pdfY, transform) {
    return {
        x: pdfX * transform.scaleX + transform.originX,
        y: pdfY * transform.scaleY + transform.originY
    };
}

/**
 * Converts UTM coordinates to PDF coordinates
 * @param {number} utmX - UTM X coordinate
 * @param {number} utmY - UTM Y coordinate
 * @param {Object} transform - Transformation parameters
 * @returns {Object} PDF coordinates {x, y}
 */
export function utmToPDF(utmX, utmY, transform) {
    return {
        x: (utmX - transform.originX) / transform.scaleX,
        y: (utmY - transform.originY) / transform.scaleY
    };
}

