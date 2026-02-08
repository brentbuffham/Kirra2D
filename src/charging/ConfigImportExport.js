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
	"  Electronic       - Programmable delay (set minDelayMs, maxDelayMs, delayIncrementMs)",
	"  ShockTube        - Fixed delay series (set delaySeriesMs as semicolon-separated: 17;25;42;65)",
	"  Electric         - Fixed delay numbers (set delaySeriesMs)",
	"  DetonatingCord   - Continuous burn (set deliveryVodMs, coreLoadGramsPerMeter)",
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
	"NOTES:",
	"  - Leave cells blank for optional/not-applicable fields",
	"  - Density is in g/cc (grams per cubic centimeter)",
	"  - Lengths/diameters in millimeters unless noted otherwise",
	"  - Boolean fields: use true or false",
	""
].join("\n");

// ============ EXAMPLE PRODUCT ROWS ============

var EXAMPLE_PRODUCTS = [
	"NonExplosive,Air,Air,,0.0012,#FFFFFF,,,,,,,,,,,,,,,,,,,,",
	"NonExplosive,Water,Water,,1.00,#4169E1,,,,,,,,,,,,,,,,,,,,",
	"NonExplosive,Stemming,Crushed Rock Stemming,,2.10,#8B7355,,,,,,,,,,,,,,,,,,,,7-19mm aggregate",
	"BulkExplosive,ANFO,ANFO Standard,,0.85,#FFFF00,false,,,3200,3800,100,false,false,,,,,,,,,,,,Standard prilled ANFO",
	"BulkExplosive,BlendNonGassed,Heavy ANFO 70/30,,1.20,#FFD700,true,0.85,1.40,4500,4200,115,true,false,,,,,,,,,,,,70% emulsion 30% ANFO blend",
	"BulkExplosive,Emulsion,Bulk Emulsion,,1.15,#FF8C00,true,1.00,1.30,5500,3600,120,true,true,,,,,,,,,,,,Pumpable emulsion",
	"HighExplosive,Booster,400g Pentex Booster,,1.60,#FF0000,,,,7500,5200,,true,,400,76,110,,,,,,,,,Cast pentolite booster",
	"HighExplosive,PackagedEmulsion,Packaged Emulsion 75mm,,1.15,#FF4500,,,,5000,3400,,true,,2300,75,320,,,,,,,,,75mm packaged emulsion",
	"Initiator,Electronic,i-kon II Electronic,,,,,,,,,,,,,,7.6,98,Electronic,0,0,20000,1,,,,Orica i-kon II",
	"Initiator,ShockTube,Exel LP Shock Tube,,,,,,,,,,,,,,7.6,98,ShockTube,2000,,,,17;25;42;65;100;150;200;300;400;500,,,Orica Exel LP series",
	"Initiator,DetonatingCord,10g/m Det Cord,,,,,,,,,,,,,,,,DetonatingCord,7000,,,,,10,,10 gram per meter detonating cord",
	"Spacer,GasBag,400mm Gas Bag,,0.06,#ADD8E6,,,,,,,,,,230,400,,,,,,,,GasBag,,Standard 400mm gas bag"
];

// ============ EXPORT BASE CONFIG ============

/**
 * Export a template ZIP with CSV files for users to fill in and re-import
 */
export async function exportBaseConfigTemplate() {
	var zip = new JSZip();

	// Add README
	zip.file("README.txt", README_CONTENT);

	// Add products CSV with header + examples
	var productsCSV = PRODUCTS_CSV_HEADER + "\n" + EXAMPLE_PRODUCTS.join("\n") + "\n";
	zip.file("products.csv", productsCSV);

	// Add charge configs CSV with header + simple example
	var configsCSV = CHARGE_CONFIGS_CSV_HEADER + "\n" +
		"SIMPLE_SINGLE,Simple Single Deck,Crushed Rock Stemming,ANFO Standard,,400g Pentex Booster,i-kon II Electronic,,3.5,2.5,6.0,2.0,false,,8.0,,3,,,Single stemming + charge + primer\n";
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
		productsMap.forEach(function(product) {
			productsCSV += productToCSVRow(product) + "\n";
		});
	}
	zip.file("products.csv", productsCSV);

	// Charge configs CSV
	var configsCSV = CHARGE_CONFIGS_CSV_HEADER + "\n";
	if (configsMap && configsMap.size > 0) {
		configsMap.forEach(function(config) {
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
	var lines = text.split("\n").filter(function(l) { return l.trim().length > 0; });
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
				else if (val !== "" && !isNaN(val) && headers[j] !== "name" && headers[j] !== "description" && headers[j] !== "supplier" && headers[j] !== "colorHex") {
					val = parseFloat(val);
				}
				// Handle semicolon-separated arrays
				if (headers[j] === "delaySeriesMs" && typeof val === "string" && val.length > 0) {
					val = val.split(";").map(function(v) { return parseFloat(v.trim()); });
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
	var lines = text.split("\n").filter(function(l) { return l.trim().length > 0; });
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
				else if (val !== "" && !isNaN(val) && headers[j] !== "configName" && headers[j] !== "description" && headers[j] !== "stemmingProduct" && headers[j] !== "chargeProduct" && headers[j] !== "wetChargeProduct" && headers[j] !== "boosterProduct" && headers[j] !== "detonatorProduct" && headers[j] !== "gasBagProduct") {
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
