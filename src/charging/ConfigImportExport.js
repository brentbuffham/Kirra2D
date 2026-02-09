/**
 * @fileoverview Config Import/Export using zipped CSV files
 * No XLSX dependency - works with any spreadsheet software or text editor
 *
 * Export: "Export Base Config" -> downloads template .zip with CSV files
 * Import: User uploads .zip containing filled-in CSVs
 *
 * ZIP structure:
 *   config.zip
 *   ├── products.csv          (product definitions)
 *   ├── chargeConfigs.csv     (charge rule configurations)
 *   └── README.txt            (instructions for filling in)
 */

import JSZip from "jszip";
import { createProductFromJSON } from "./products/productFactory.js";
import { ChargeConfig } from "./ChargeConfig.js";

// ============ CSV TEMPLATES ============

var PRODUCTS_CSV_HEADER = [
    "productCategory",
    "productType",
    "name",
    "supplier",
    "density",
    "colorHex",
    "isCompressible",
    "minDensity",
    "maxDensity",
    "vodMs",
    "reKjKg",
    "rws",
    "waterResistant",
    "dampResistant",
    "massGrams",
    "diameterMm",
    "lengthMm",
    "initiatorType",
    "deliveryVodMs",
    "minDelayMs",
    "maxDelayMs",
    "delayIncrementMs",
    "delaySeriesMs",
    "coreLoadGramsPerMeter",
    "spacerType",
    "description"
].join(",");

var CHARGE_CONFIGS_CSV_HEADER = [
    "configCode",
    "configName",
    "stemmingProduct",
    "chargeProduct",
    "wetChargeProduct",
    "boosterProduct",
    "detonatorProduct",
    "gasBagProduct",
    "preferredStemLength",
    "minStemLength",
    "preferredChargeLength",
    "minChargeLength",
    "useMassOverLength",
    "targetChargeMassKg",
    "chargeRatio",
    "primerInterval",
    "primerDepthFromCollar",
    "maxPrimersPerDeck",
    "airDeckLength",
    "description"
].join(",");

var README_CONTENT = [
    "KIRRA CHARGING CONFIGURATION TEMPLATE",
    "======================================",
    "",
    "This ZIP contains CSV template files for configuring Kirra's charging system.",
    "Edit these files in any spreadsheet (Excel, Google Sheets, LibreOffice) or text editor.",
    "",
    "FILES:",
    "  products.csv       - Define blast products (explosives, stemming, detonators, etc.)",
    "  chargeConfigs.csv  - Define charge rule configurations",
    "",
    "INSTRUCTIONS:",
    "  1. Open each CSV file",
    "  2. Fill in rows below the header (DO NOT modify the header row)",
    "  3. Save as CSV (comma-separated)",
    "  4. Re-ZIP all files together",
    "  5. Import the ZIP into Kirra via File > Import Charging Config",
    "",
    "PRODUCT CATEGORIES:",
    "  NonExplosive    - Air, Water, Stemming, StemGel, DrillCuttings",
    "  BulkExplosive   - ANFO, BlendGassed, BlendNonGassed, Emulsion, Molecular",
    "  HighExplosive   - Booster, PackagedEmulsion, CastBooster, Pentolite",
    "  Initiator       - Electronic, ShockTube, Electric, DetonatingCord",
    "  Spacer          - GasBag, StemCap, StemBrush, StemPlug, StemLock",
    "",
    "INITIATOR TYPES:",
    "  Electronic        - Programmable delay (set minDelayMs, maxDelayMs, delayIncrementMs)",
    "  ShockTube         - Fixed delay series (set delaySeriesMs as semicolon-separated: 17;25;42;65)",
    "  Electric          - Fixed delay numbers (set delaySeriesMs)",
    "  DetonatingCord    - Continuous burn (set deliveryVodMs, coreLoadGramsPerMeter)",
    "  SurfaceConnector  - Surface shock tube connector (populates connector presets)",
    "  SurfaceWire       - Surface electronic wire connector",
    "  SurfaceCord       - Surface detonating cord connector",
    "",
    "CHARGE CONFIG CODES:",
    "  SIMPLE_SINGLE    - One stemming deck + one coupled deck + one primer",
    "  STNDVS           - Standard vented stemming (stem + charge + air top)",
    "  STNDFS           - Standard fixed stem (stem + fill rest with explosive)",
    "  AIRDEC           - Air deck design (charge + air separation)",
    "  PRESPL           - Presplit charges (packaged products)",
    "  NOCHG            - Do not charge",
    "  CUSTOM           - User-defined via drag-drop builder",
    "",
    "DELIVERY VOD (m/s):",
    "  Electronic       - 0 (instant, speed of electricity)",
    "  ShockTube        - 2000 m/s",
    "  Electric         - 0 (instant, speed of electricity)",
    "  DetonatingCord   - 7000 m/s",
    "  Use 0 for instant delivery (no downhole burn time added)",
    "",
    "COLUMN REFERENCE BY CATEGORY:",
    "  (x = required, o = optional, blank = not applicable)",
    "",
    "  Column                  | NonExpl | BulkExpl | HighExpl | Initiator | Spacer",
    "  ------------------------+---------+----------+----------+-----------+-------",
    "  productCategory         |    x    |    x     |    x     |     x     |   x",
    "  productType             |    x    |    x     |    x     |     x     |   x",
    "  name                    |    x    |    x     |    x     |     x     |   x",
    "  supplier                |    o    |    o     |    o     |     o     |   o",
    "  density                 |    x    |    x     |    x     |           |   o",
    "  colorHex                |    o    |    o     |    o     |           |   o",
    "  isCompressible          |         |    x     |          |           |",
    "  minDensity              |         |    o     |          |           |",
    "  maxDensity              |         |    o     |          |           |",
    "  vodMs                   |         |    x     |    x     |           |",
    "  reKjKg                  |         |    x     |    x     |           |",
    "  rws                     |         |    o     |          |           |",
    "  waterResistant          |         |    x     |    o     |           |",
    "  dampResistant           |         |    o     |          |           |",
    "  massGrams               |         |          |    x     |           |",
    "  diameterMm              |         |          |    x     |     o     |   o",
    "  lengthMm                |         |          |    x     |     o     |   x",
    "  initiatorType           |         |          |          |     x     |",
    "  deliveryVodMs           |         |          |          |     x     |",
    "  minDelayMs              |         |          |          |     o     |",
    "  maxDelayMs              |         |          |          |     o     |",
    "  delayIncrementMs        |         |          |          |     o     |",
    "  delaySeriesMs           |         |          |          |     o     |",
    "  coreLoadGramsPerMeter   |         |          |          |     o     |",
    "  spacerType              |         |          |          |           |   x",
    "  description             |    o    |    o     |    o     |     o     |   o",
    "",
    "NOTES:",
    "  - Leave cells blank for optional/not-applicable fields",
    "  - Density is in g/cc (grams per cubic centimeter)",
    "  - Lengths/diameters in millimeters unless noted otherwise",
    "  - Boolean fields: use true or false",
    ""
].join("\n");

// ============ EXAMPLE PRODUCT DATA ============

var EXAMPLE_PRODUCT_DATA = [
    // --- NonExplosive ---
    { productCategory: "NonExplosive", productType: "Air", name: "Air", density: 0.0012, colorHex: "#FFFFFF", description: "" },
    { productCategory: "NonExplosive", productType: "Water", name: "Water", density: 1.0, colorHex: "#4169E1", description: "" },
    { productCategory: "NonExplosive", productType: "Stemming", name: "Stemming", density: 2.1, colorHex: "#8B7355", description: "25-40mm aggregate" },
    // --- BulkExplosive ---
    { productCategory: "BulkExplosive", productType: "ANFO", name: "ANFO", density: 0.85, colorHex: "#FFAAFF", isCompressible: false, vodMs: 3200, reKjKg: 3800, rws: 100, waterResistant: false, dampResistant: false, description: "Standard prilled ANFO" },
    { productCategory: "BulkExplosive", productType: "BlendNonGassed", name: "GENERIC4060", density: 1.2, colorHex: "#FFFF77", isCompressible: false, minDensity: 1.24, maxDensity: 1.4, vodMs: 4500, reKjKg: 4200, rws: 115, waterResistant: false, dampResistant: true, description: "40% emulsion 60% ANFO blend" },
    { productCategory: "BulkExplosive", productType: "BlendGassed", name: "GENERIC7030G", density: 1.15, colorHex: "#AA00AA", isCompressible: true, minDensity: 1.0, maxDensity: 1.3, vodMs: 5500, reKjKg: 3600, rws: 120, waterResistant: true, dampResistant: true, description: "70% Emulsion Pumpable Gassed" },
    // --- HighExplosive ---
    { productCategory: "HighExplosive", productType: "Booster", name: "BS400G", density: 1.6, colorHex: "#FF0000", vodMs: 7500, reKjKg: 5200, waterResistant: true, massGrams: 400, diameterMm: 76, lengthMm: 110, description: "400 gram cast pentolite booster" },
    { productCategory: "HighExplosive", productType: "PackagedEmulsion", name: "PKG75mm", density: 1.15, colorHex: "#AA0044", vodMs: 5000, reKjKg: 3400, waterResistant: true, massGrams: 2300, diameterMm: 75, lengthMm: 320, description: "75mm packaged det sensitive emulsion" },
    // Initiators all need to have a colour. We will use the colorHex field to set the colour.
    // --- Initiator --- Generic Programmable Electronic Detonator
    { productCategory: "Initiator", productType: "Electronic", name: "GENERIC-E", initiatorType: "Electronic", deliveryVodMs: 0, shellDiameterMm: 7.6, shellLengthMm: 98, minDelayMs: 0, maxDelayMs: 20000, delayIncrementMs: 1, colorHex: "#0000FF", description: "Generic Programmable Electronic Detonator" },
    // --- Initiator --- Shocktube Millisecond Downhole Detonator
    { productCategory: "Initiator", productType: "ShockTube", name: "GENERIC-MS", initiatorType: "ShockTube", deliveryVodMs: 2000, shellDiameterMm: 7.6, shellLengthMm: 98, delaySeriesMs: [400, 450, 500], colorHex: "#00BFFF", description: "Shocktube Millisecond Downhole Detonator" },
    // --- Initiator --- Surface Connector - ( this will populate the connector tool box as a preset connectors)
    // Initiators all need to have a colour. We will use the colorHex field to set the colour.
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-009", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, shellDiameterMm: 7.6, shellLengthMm: 98, delaySeriesMs: [9], colorHex: "#FF0000", description: "9ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-017", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, shellDiameterMm: 7.6, shellLengthMm: 98, delaySeriesMs: [17], colorHex: "#FF6600", description: "17ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-025", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, shellDiameterMm: 7.6, shellLengthMm: 98, delaySeriesMs: [25], colorHex: "#FFCC00", description: "25ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-042", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, shellDiameterMm: 7.6, shellLengthMm: 98, delaySeriesMs: [42], colorHex: "#00CC00", description: "42ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-067", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, shellDiameterMm: 7.6, shellLengthMm: 98, delaySeriesMs: [67], colorHex: "#0066FF", description: "65ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-109", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, shellDiameterMm: 7.6, shellLengthMm: 98, delaySeriesMs: [109], colorHex: "#9900FF", description: "109ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    // --- Initiator --- Harness Wire - (this will be a future developement for electronic detonators)
    { productCategory: "Initiator", productType: "HarnessWire", name: "HW-02MM", initiatorType: "HarnessWire", deliveryVodMs: 30000000, shellDiameterMm: 0, shellLengthMm: 0, delaySeriesMs: [], colorHex: "#FFD700", description: "2mm Harness Wire - Electronic Detonator" },
    // --- Initiator --- Detonating Cord
    { productCategory: "Initiator", productType: "DetonatingCord", name: "10GRAMCORD", initiatorType: "DetonatingCord", deliveryVodMs: 7000, coreLoadGramsPerMeter: 10, colorHex: "#FF4500", description: "10 gram per meter detonating cord" },
    // --- Spacer ---
    { productCategory: "Spacer", productType: "GasBag", name: "GB230MM", density: 0.06, colorHex: "#ADD8E6", spacerType: "GasBag", diameterMm: 230, lengthMm: 400, description: "230mm gas bag 400mm in Length" }
];

/**
 * Build example product CSV rows from structured data objects.
 * Uses createProductFromJSON + productToCSVRow to guarantee column alignment.
 */
function buildExampleProductRows() {
    var rows = [];
    for (var i = 0; i < EXAMPLE_PRODUCT_DATA.length; i++) {
        var product = createProductFromJSON(EXAMPLE_PRODUCT_DATA[i]);
        rows.push(productToCSVRow(product));
    }
    return rows;
}

// ============ EXAMPLE CHARGE CONFIG DATA ============

var EXAMPLE_CONFIG_DATA = [
    {
        configCode: "STNDFS",
        configName: "Standard Single Deck",
        stemmingProduct: "Stemming",
        chargeProduct: "ANFO",
        boosterProduct: "BS400G",
        detonatorProduct: "GENERIC-MS",
        preferredStemLength: 3.5,
        minStemLength: 2.5,
        preferredChargeLength: 6.0,
        minChargeLength: 2.0,
        useMassOverLength: false,
        primerInterval: 8.0,
        maxPrimersPerDeck: 3,
        description: "Single stemming + charge + primer"
    },
    {
        configCode: "STNDFS",
        configName: "50/50 Stem and Charge",
        stemmingProduct: "Crushed Rock Stemming",
        chargeProduct: "ANFO",
        boosterProduct: "BS400G",
        detonatorProduct: "GENERIC-MS",
        preferredStemLength: 3.5,
        minStemLength: 2.0,
        minChargeLength: 2.0,
        useMassOverLength: false,
        chargeRatio: 0.5,
        primerInterval: 8.0,
        maxPrimersPerDeck: 3,
        description: "50% stemming 50% charge split"
    },
    {
        configCode: "STNDFS",
        configName: "20kg Mass Based",
        stemmingProduct: "Crushed Rock Stemming",
        chargeProduct: "ANFO",
        boosterProduct: "BS400G",
        detonatorProduct: "GENERIC-MS",
        preferredStemLength: 3.5,
        minStemLength: 2.0,
        minChargeLength: 1.0,
        useMassOverLength: true,
        targetChargeMassKg: 20,
        primerInterval: 8.0,
        maxPrimersPerDeck: 3,
        description: "Charge to target mass of 20kg then stem remainder"
    },
    {
        configCode: "AIRDEC",
        configName: "Air Deck with Gas Bag",
        stemmingProduct: "Crushed Rock Stemming",
        chargeProduct: "ANFO",
        boosterProduct: "BS400G",
        detonatorProduct: "GENERIC-MS",
        gasBagProduct: "GB230MM",
        preferredStemLength: 3.0,
        minStemLength: 2.0,
        minChargeLength: 2.0,
        useMassOverLength: false,
        airDeckLength: 1.0,
        primerInterval: 8.0,
        maxPrimersPerDeck: 3,
        description: "Stem + charge + gas bag air deck + charge"
    },
    {
        configCode: "NOCHG",
        configName: "No Charge",
        stemmingProduct: "Air",
        description: "Do not charge - leave hole empty"
    }
];

/**
 * Build example charge config CSV rows from structured data objects.
 * Uses ChargeConfig + configToCSVRow to guarantee column alignment.
 */
function buildExampleConfigRows() {
    var rows = [];
    for (var i = 0; i < EXAMPLE_CONFIG_DATA.length; i++) {
        var config = ChargeConfig.fromJSON(EXAMPLE_CONFIG_DATA[i]);
        rows.push(configToCSVRow(config));
    }
    return rows;
}

// ============ EXPORT BASE CONFIG ============

/**
 * Export a template ZIP with CSV files for users to fill in and re-import
 */
export async function exportBaseConfigTemplate() {
    var zip = new JSZip();

    // Add README
    zip.file("README.txt", README_CONTENT);

    // Add products CSV with header + examples (programmatically generated for alignment)
    var exampleRows = buildExampleProductRows();
    var productsCSV = PRODUCTS_CSV_HEADER + "\n" + exampleRows.join("\n") + "\n";
    zip.file("products.csv", productsCSV);

    // Add charge configs CSV with header + example configs (programmatically generated)
    var exampleConfigs = buildExampleConfigRows();
    var configsCSV = CHARGE_CONFIGS_CSV_HEADER + "\n" + exampleConfigs.join("\n") + "\n";
    zip.file("chargeConfigs.csv", configsCSV);

    // Generate and download
    var blob = await zip.generateAsync({ type: "blob" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "kirra-charging-config-template.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Export current products and configs as a ZIP
 * @param {Map} productsMap - productID -> Product
 * @param {Map} configsMap - configID -> ChargeConfig
 */
export async function exportCurrentConfig(productsMap, configsMap) {
    var zip = new JSZip();

    // Products CSV
    var productsCSV = PRODUCTS_CSV_HEADER + "\n";
    if (productsMap && productsMap.size > 0) {
        productsMap.forEach(function (product) {
            productsCSV += productToCSVRow(product) + "\n";
        });
    }
    zip.file("products.csv", productsCSV);

    // Charge configs CSV
    var configsCSV = CHARGE_CONFIGS_CSV_HEADER + "\n";
    if (configsMap && configsMap.size > 0) {
        configsMap.forEach(function (config) {
            configsCSV += configToCSVRow(config) + "\n";
        });
    }
    zip.file("chargeConfigs.csv", configsCSV);

    zip.file("README.txt", README_CONTENT);

    // Generate and download
    var blob = await zip.generateAsync({ type: "blob" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "kirra-charging-config.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============ IMPORT CONFIG ============

/**
 * Import products and configs from a ZIP file
 * @param {File} file - ZIP file from file input
 * @returns {{ products: Product[], configs: ChargeConfig[], errors: string[] }}
 */
export async function importConfigFromZip(file) {
    var zip = await JSZip.loadAsync(file);
    var results = { products: [], configs: [], errors: [] };

    // Parse products.csv
    var productsFile = zip.file("products.csv");
    if (productsFile) {
        var productsText = await productsFile.async("string");
        results.products = parseProductsCSV(productsText, results.errors);
    }

    // Parse chargeConfigs.csv
    var configsFile = zip.file("chargeConfigs.csv");
    if (configsFile) {
        var configsText = await configsFile.async("string");
        results.configs = parseChargeConfigsCSV(configsText, results.errors);
    }

    return results;
}

// ============ CSV SERIALIZATION ============

function escapeCSV(val) {
    if (val === null || val === undefined) return "";
    var str = String(val);
    if (str.indexOf(",") !== -1 || str.indexOf('"') !== -1 || str.indexOf("\n") !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function productToCSVRow(product) {
    var json = product.toJSON();
    var delaySeriesStr = "";
    if (json.delaySeriesMs && Array.isArray(json.delaySeriesMs)) {
        delaySeriesStr = json.delaySeriesMs.join(";");
    }

    return [
        escapeCSV(json.productCategory),
        escapeCSV(json.productType),
        escapeCSV(json.name),
        escapeCSV(json.supplier),
        escapeCSV(json.density || ""),
        escapeCSV(json.colorHex),
        escapeCSV(json.isCompressible != null ? json.isCompressible : ""),
        escapeCSV(json.minDensity || ""),
        escapeCSV(json.maxDensity || ""),
        escapeCSV(json.vodMs || ""),
        escapeCSV(json.reKjKg || ""),
        escapeCSV(json.rws || ""),
        escapeCSV(json.waterResistant != null ? json.waterResistant : ""),
        escapeCSV(json.dampResistant != null ? json.dampResistant : ""),
        escapeCSV(json.massGrams || ""),
        escapeCSV(json.diameterMm || ""),
        escapeCSV(json.lengthMm || ""),
        escapeCSV(json.initiatorType || ""),
        escapeCSV(json.deliveryVodMs != null ? json.deliveryVodMs : ""),
        escapeCSV(json.minDelayMs != null ? json.minDelayMs : ""),
        escapeCSV(json.maxDelayMs || ""),
        escapeCSV(json.delayIncrementMs || ""),
        escapeCSV(delaySeriesStr),
        escapeCSV(json.coreLoadGramsPerMeter || ""),
        escapeCSV(json.spacerType || ""),
        escapeCSV(json.description)
    ].join(",");
}

function configToCSVRow(config) {
    var json = config.toJSON();
    return [
        escapeCSV(json.configCode),
        escapeCSV(json.configName),
        escapeCSV(json.stemmingProduct),
        escapeCSV(json.chargeProduct),
        escapeCSV(json.wetChargeProduct),
        escapeCSV(json.boosterProduct),
        escapeCSV(json.detonatorProduct),
        escapeCSV(json.gasBagProduct),
        escapeCSV(json.preferredStemLength),
        escapeCSV(json.minStemLength),
        escapeCSV(json.preferredChargeLength),
        escapeCSV(json.minChargeLength),
        escapeCSV(json.useMassOverLength),
        escapeCSV(json.targetChargeMassKg || ""),
        escapeCSV(json.chargeRatio != null ? json.chargeRatio : ""),
        escapeCSV(json.primerInterval),
        escapeCSV(json.primerDepthFromCollar || ""),
        escapeCSV(json.maxPrimersPerDeck),
        escapeCSV(json.airDeckLength || ""),
        escapeCSV(json.description)
    ].join(",");
}

// ============ CSV PARSING ============

function parseCSVLine(line) {
    var result = [];
    var current = "";
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function parseProductsCSV(text, errors) {
    var lines = text.split("\n").filter(function (l) {
        return l.trim().length > 0;
    });
    if (lines.length < 2) return [];

    var headers = parseCSVLine(lines[0]);
    var products = [];

    for (var i = 1; i < lines.length; i++) {
        try {
            var values = parseCSVLine(lines[i]);
            var obj = {};
            for (var j = 0; j < headers.length; j++) {
                var val = values[j] || "";
                // Convert types
                if (val === "true") val = true;
                else if (val === "false") val = false;
                else if (val !== "" && !isNaN(val) && headers[j] !== "name" && headers[j] !== "description" && headers[j] !== "supplier" && headers[j] !== "colorHex" && headers[j] !== "delaySeriesMs") {
                    val = parseFloat(val);
                }
                // Handle semicolon-separated arrays (or single numeric values)
                if (headers[j] === "delaySeriesMs" && val !== "") {
                    if (typeof val === "number") {
                        val = [val]; // Single number -> array of one
                    } else if (typeof val === "string") {
                        val = val.split(";").map(function (v) {
                            return parseFloat(v.trim());
                        });
                    }
                }
                if (val !== "") obj[headers[j]] = val;
            }
            var product = createProductFromJSON(obj);
            products.push(product);
        } catch (err) {
            errors.push("Products row " + (i + 1) + ": " + err.message);
        }
    }
    return products;
}

function parseChargeConfigsCSV(text, errors) {
    var lines = text.split("\n").filter(function (l) {
        return l.trim().length > 0;
    });
    if (lines.length < 2) return [];

    var headers = parseCSVLine(lines[0]);
    var configs = [];

    for (var i = 1; i < lines.length; i++) {
        try {
            var values = parseCSVLine(lines[i]);
            var obj = {};
            for (var j = 0; j < headers.length; j++) {
                var val = values[j] || "";
                if (val === "true") val = true;
                else if (val === "false") val = false;
                else if (val !== "" && !isNaN(val) && headers[j] !== "configName" && headers[j] !== "description" && headers[j] !== "stemmingProduct" && headers[j] !== "chargeProduct" && headers[j] !== "wetChargeProduct" && headers[j] !== "boosterProduct" && headers[j] !== "detonatorProduct" && headers[j] !== "gasBagProduct" && headers[j] !== "primerDepthFromCollar") {
                    val = parseFloat(val);
                }
                if (val !== "") obj[headers[j]] = val;
            }
            configs.push(ChargeConfig.fromJSON(obj));
        } catch (err) {
            errors.push("Config row " + (i + 1) + ": " + err.message);
        }
    }
    return configs;
}

// ============ CLEAR & BACKUP OPERATIONS ============

/**
 * Clear all products from memory and IndexedDB with confirmation dialog.
 */
export function clearAllProducts() {
    if (!window.loadedProducts || window.loadedProducts.size === 0) {
        if (typeof window.showModalMessage === "function") {
            window.showModalMessage("Clear Products", "No products to clear.", "info");
        }
        return;
    }

    var count = window.loadedProducts.size;

    window.showConfirmationDialog(
        "Clear All Products",
        "This will permanently remove all " + count + " product(s).\nThis cannot be reverted.\n\nExport your configuration first if needed.",
        "Clear All",
        "Cancel",
        function() {
            window.loadedProducts.clear();
            if (typeof window.debouncedSaveProducts === "function") window.debouncedSaveProducts();
            // Rebuild connector presets (now empty)
            if (typeof window.buildSurfaceConnectorPresets === "function") window.buildSurfaceConnectorPresets();
            if (typeof window.showModalMessage === "function") {
                window.showModalMessage("Products Cleared", "Removed " + count + " product(s).", "success");
            }
        }
    );
}

/**
 * Clear all charge configs from memory and IndexedDB with confirmation dialog.
 */
export function clearAllChargeConfigs() {
    if (!window.loadedChargeConfigs || window.loadedChargeConfigs.size === 0) {
        if (typeof window.showModalMessage === "function") {
            window.showModalMessage("Clear Charge Configs", "No charge configs to clear.", "info");
        }
        return;
    }

    var count = window.loadedChargeConfigs.size;

    window.showConfirmationDialog(
        "Clear All Charge Rules",
        "This will permanently remove all " + count + " charge rule(s).\nThis cannot be reverted.\n\nExport your configuration first if needed.",
        "Clear All",
        "Cancel",
        function() {
            window.loadedChargeConfigs.clear();
            if (typeof window.debouncedSaveConfigs === "function") window.debouncedSaveConfigs();
            if (typeof window.showModalMessage === "function") {
                window.showModalMessage("Charge Rules Cleared", "Removed " + count + " charge rule(s).", "success");
            }
        }
    );
}

/**
 * Backup (export) only products as a ZIP file.
 */
export async function backupProducts() {
    await exportCurrentConfig(window.loadedProducts || new Map(), new Map());
}

/**
 * Backup (export) only charge configs as a ZIP file.
 */
export async function backupChargeConfigs() {
    await exportCurrentConfig(new Map(), window.loadedChargeConfigs || new Map());
}
