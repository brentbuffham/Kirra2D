/**
 * @fileoverview Config Import/Export using zipped CSV files
 * No XLSX dependency - works with any spreadsheet software or text editor
 *
 * Export: "Export Base Config" -> downloads template .zip with CSV files
 * Import: User uploads .zip containing filled-in CSVs
 *
 * ZIP structure:
 *   config.zip
 *   ├── products.csv                    (product definitions)
 *   ├── chargeConfigs.csv               (charge rule configurations)
 *   ├── README.txt                      (quick-start instructions)
 *   ├── ChargeConfigCSV-README.txt      (full reference guide - plain text)
 *   └── ChargeConfigCSV-README.md       (full reference guide - markdown)
 */

import JSZip from "jszip";
import { createProductFromJSON } from "./products/productFactory.js";
import { ChargeConfig } from "./ChargeConfig.js";
import DOC_REFERENCE_TXT from "./docs/ChargeConfigCSV-README.txt?raw";
import DOC_REFERENCE_MD from "./docs/ChargeConfigCSV-README.md?raw";

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
    "delayMs",
    "coreLoadGramsPerMeter",
    "spacerType",
    "description"
].join(",");

// Transposed CSV field definitions: each becomes one row in chargeConfigs.csv
// { type: data type hint, field: config key, desc: human-readable description }
var TRANSPOSED_CONFIG_FIELDS = [
    { type: "code",    field: "configCode",       desc: "Charge config code (STNDFS, AIRDEC, CUSTOM, etc.)" },
    { type: "text",    field: "configName",        desc: "Human-readable config name" },
    { type: "text",    field: "description",       desc: "Description of the charge design" },
    { type: "number",  field: "primerInterval",    desc: "Interval between primers (m)" },
    { type: "bool",    field: "shortHoleLogic",    desc: "Apply short hole tier overrides" },
    { type: "number",  field: "shortHoleLength",   desc: "Short hole threshold length (m)" },
    { type: "bool",    field: "wetHoleSwap",       desc: "Swap product for wet holes" },
    { type: "product", field: "wetHoleProduct",    desc: "Wet hole replacement product name" },
    { type: "deck",    field: "inertDeck",         desc: "Inert deck template entries" },
    { type: "deck",    field: "coupledDeck",       desc: "Coupled deck template entries" },
    { type: "deck",    field: "decoupledDeck",     desc: "Decoupled deck template entries" },
    { type: "deck",    field: "spacerDeck",        desc: "Spacer deck template entries" },
    { type: "primer",  field: "primer",            desc: "Primer template entries" }
];

var README_CONTENT = [
    "KIRRA CHARGING CONFIGURATION TEMPLATE",
    "======================================",
    "",
    "This ZIP contains CSV template files for configuring Kirra's charging system.",
    "Edit these files in any spreadsheet (Excel, Google Sheets, LibreOffice) or text editor.",
    "",
    "FILES:",
    "  products.csv       - Define blast products (explosives, stemming, detonators, etc.)",
    "  chargeConfigs.csv  - Charge rule configurations (transposed: rows=fields, columns=configs)",
    "",
    "INSTRUCTIONS:",
    "  1. Open each CSV file",
    "  2. products.csv: Fill in rows below the header (DO NOT modify the header row)",
    "  3. chargeConfigs.csv: Each column after the first 3 is a config. Add new columns for new configs.",
    "  4. Save as CSV (comma-separated)",
    "  5. Re-ZIP all files together",
    "  6. Import the ZIP into Kirra via File > Import Charging Config",
    "",
    "TRANSPOSED chargeConfigs.csv FORMAT:",
    "  Row 1 (header): Type,Description,Field,[1],[2],[3],...",
    "  Rows 2+: One row per config field. Columns 4+ are config values.",
    "  The first 3 columns (Type, Description, Field) are metadata; do not change these.",
    "  Add/remove columns to add/remove charge configurations.",
    "",
    "SIMPLIFIED CONFIG FIELDS:",
    "  configCode       - Unique code for the config (e.g. STNDFS, AIRDEC, CUSTOM)",
    "  configName       - Human-readable display name",
    "  description      - Description of the charge design",
    "  primerInterval   - Interval between primers in metres (for long charge columns)",
    "  shortHoleLogic   - true/false: apply short hole tier overrides",
    "  shortHoleLength  - Threshold length below which short hole logic applies (m)",
    "  wetHoleSwap      - true/false: swap product when hole is wet",
    "  wetHoleProduct   - Replacement product name for wet holes",
    "",
    "  All charge designs are expressed as deck arrays (inertDeck, coupledDeck,",
    "  decoupledDeck, spacerDeck) and a primer array.",
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
    "  ShockTube         - Fixed delay in ms (set delayMs)",
    "  Electric          - Fixed delay in ms (set delayMs)",
    "  DetonatingCord    - Continuous burn (set deliveryVodMs, coreLoadGramsPerMeter)",
    "  SurfaceConnector  - Surface shock tube connector (populates connector presets)",
    "  SurfaceWire       - Surface electronic wire connector",
    "  SurfaceCord       - Surface detonating cord connector",
    "",
    "DELIVERY VOD (m/s):",
    "  Electronic       - 0 (instant, speed of electricity)",
    "  ShockTube        - 2000 m/s",
    "  Electric         - 0 (instant, speed of electricity)",
    "  DetonatingCord   - 7000 m/s",
    "  Use 0 for instant delivery (no downhole burn time added)",
    "",
    "COLUMN REFERENCE BY CATEGORY (products.csv):",
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
    "  delayMs                 |         |          |          |     o     |",
    "  coreLoadGramsPerMeter   |         |          |          |     o     |",
    "  spacerType              |         |          |          |           |   x",
    "  description             |    o    |    o     |    o     |     o     |   o",
    "",
    "TYPED DECK ROWS (inertDeck, coupledDeck, decoupledDeck, spacerDeck, primer):",
    "  These rows define multi-deck charge configurations.",
    "  All charge designs use deck arrays — there are no flat-field shortcuts.",
    "",
    "  Deck Entry Syntax (inertDeck, coupledDeck, decoupledDeck):",
    "    {idx,length,product}      - proportional scaling (default)",
    "    {idx,length,product,FL}   - isFixedLength (length does not scale)",
    "    {idx,length,product,FM}   - isFixedMass (mass does not scale)",
    "    {idx,length,product,VR}   - isVariable (re-evaluates formula per hole)",
    "    {idx,length,product,PR}   - isProportionalDeck (explicit proportional)",
    "    Multiple entries separated by ;",
    "",
    "    idx     = integer deck order from collar (1-based)",
    "    length  = one of:",
    "      2.0           fixed metres (lengthMode: fixed)",
    "      fill          absorbs remaining space (lengthMode: fill)",
    "      fx:expr       formula e.g. fx:holeLength*0.5 (lengthMode: formula)",
    "      m:50          50kg of product (lengthMode: mass)",
    "      product       length derived from product.lengthMm (lengthMode: product)",
    "    product = product name (matched from products.csv)",
    "",
    "    Overlap syntax (appended after scaling flag):",
    "      {idx,length,product,FL,overlap:base=3;base-1=2;n=1;top=2}",
    "      Defines how many overlap charges per position in the deck.",
    "      Keys: base, base-1, n (general), top",
    "",
    "  Spacer Entry Syntax (spacerDeck):",
    "    {idx,product}  - length derived from product.lengthMm property",
    "",
    "  Primer Entry Syntax (primer):",
    "    {idx,depth,Det{name},HE{name}}  - multiple entries separated by ;",
    "    idx   = primer number (1-based)",
    "    depth = number (metres) or formula (fx:chargeBase[1]-0.3)",
    "    Det{} = detonator product name",
    "    HE{}  = booster/high-explosive product name (use HE{} for none)",
    "",
    "FORMULA GUIDE (primer depth and deck formulas):",
    "  Formulas are prefixed with fx: to avoid triggering spreadsheet formula parsing.",
    "",
    "  Available variables (unindexed = deepest charge deck):",
    "    holeLength      - Total hole length in metres (collar to toe)",
    "    chargeLength    - Length of the deepest charge deck in metres",
    "    chargeTop       - Depth from collar to top of deepest charge deck (m)",
    "    chargeBase      - Depth from collar to bottom of deepest charge deck",
    "    stemLength      - Length of stemming from collar (m)",
    "    holeDiameter    - Hole diameter in millimetres",
    "    benchHeight     - Bench height from hole data (m)",
    "    subdrillLength  - Subdrill length from hole data (m)",
    "",
    "  Indexed variables (use the deck position number shown in the section view):",
    "    chargeBase[N]   - Base depth of the charge deck at position N",
    "    chargeTop[N]    - Top depth of the charge deck at position N",
    "    chargeLength[N] - Length of the charge deck at position N",
    "    e.g. if COUPLED is at deck position 4, use chargeBase[4]",
    "",
    "  Math functions supported:",
    "    Math.min(a, b)   Math.max(a, b)   Math.abs(x)",
    "    Math.sqrt(x)     Math.PI          Math.round(x)",
    "",
    "  Conditional operators (ternary):",
    "    condition ? valueIfTrue : valueIfFalse    JavaScript ternary operator",
    "    Comparison: < > <= >= == !=",
    "    Logical: && (AND), || (OR), ! (NOT)",
    "    Example: holeLength < 5 ? 2.0 : 3.0   (if hole < 5m use 2.0m, else 3.0m)",
    "",
    "  Custom functions:",
    "    massLength(kg, density)          Length (m) for a given mass at holeDiameter",
    "                                     density in g/cc e.g. massLength(50, 0.85)",
    "    massLength(kg, \"ProductName\")    Length (m) using product density lookup",
    "                                     e.g. massLength(50, \"ANFO\")",
    "",
    "  PRIMER DEPTH EXAMPLES:",
    "    fx:chargeBase - 0.3                  Primer 0.3m above deepest charge base",
    "    fx:chargeBase[4] - 0.3              Primer 0.3m above charge at deck position 4",
    "    fx:chargeBase[8] - 0.6              Primer 0.6m above charge at deck position 8",
    "    fx:holeLength * 0.9                  Primer at 90% of total hole",
    "    fx:Math.max(chargeTop + 1, chargeBase - 0.5)   At least 1m below charge top",
    "",
    "  DECK LENGTH EXAMPLES:",
    "    fx:holeLength - 4                    Deck length = hole length minus 4m",
    "    fx:holeLength * 0.5                  Deck length = 50% of hole length",
    "    fx:holeLength - stemLength - 2       Deck fills hole minus stem and 2m",
    "    fx:Math.min(holeLength * 0.3, 5)     Deck is 30% of hole, capped at 5m",
    "",
    "  CONDITIONAL EXAMPLES (ternary operators):",
    "    fx:holeLength < 5 ? holeLength * 0.4 : 2.0           If hole < 5m use 40%, else 2m",
    "    fx:holeLength < 3 ? holeLength * 0.5 : holeLength < 4 ? holeLength * 0.4 : holeLength * 0.3",
    "                                                         Tiered: <3m=50%, <4m=40%, else 30%",
    "    fx:holeDiameter < 150 ? m:30 : m:50                  Mass by diameter",
    "",
    "  MASS-AWARE POSITIONING EXAMPLES:",
    "    fx:chargeTop[4] - massLength(50, 0.85)    Place deck above charge at position 4,",
    "                                               sized for 50kg of ANFO (0.85 g/cc)",
    "    fx:chargeTop[4] - massLength(50, \"ANFO\")  Same but using product name lookup",
    "    fx:holeLength - 2 - massLength(30, 1.2)   Position deck above a 2m toe charge,",
    "                                               with 30kg of emulsion above it",
    "",
    "  If the formula is omitted or blank, primer defaults to 90% of hole length.",
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
    { productCategory: "HighExplosive", productType: "PackagedEmulsion", name: "PRE32MM", density: 1.2, colorHex: "#770040", vodMs: 5000, reKjKg: 3400, waterResistant: true, massGrams: 386, diameterMm: 32, lengthMm: 400, description: "32mm packaged det sensitive emulsion" },
    // --- Initiator --- Generic Programmable Electronic Detonator
    { productCategory: "Initiator", productType: "Electronic", name: "GENERIC-E", initiatorType: "Electronic", deliveryVodMs: 0, minDelayMs: 0, maxDelayMs: 20000, delayIncrementMs: 1, colorHex: "#0000FF", description: "Generic Programmable Electronic Detonator" },
    // --- Initiator --- Shocktube Millisecond Downhole Detonator
    { productCategory: "Initiator", productType: "ShockTube", name: "GENERIC-MS", initiatorType: "ShockTube", deliveryVodMs: 2000, delayMs: 400, colorHex: "#00BFFF", description: "Shocktube Millisecond Downhole Detonator" },
    // --- Initiator --- Surface Connector (populates connector toolbar presets)
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-009", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, delayMs: 9, colorHex: "#22CC00", description: "9ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-017", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, delayMs: 17, colorHex: "#FFCC00", description: "17ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-025", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, delayMs: 25, colorHex: "#DD0000", description: "25ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-042", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, delayMs: 42, colorHex: "#BBBBBB", description: "42ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-067", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, delayMs: 67, colorHex: "#0055DD", description: "65ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    { productCategory: "Initiator", productType: "ShockTube", name: "SC-MS-109", initiatorType: "SurfaceConnector", deliveryVodMs: 2000, delayMs: 109, colorHex: "#550066", description: "109ms Surface Connector - Shocktube Millisecond Downhole Detonator" },
    // --- Initiator --- Harness Wire (future development for electronic detonators)
    { productCategory: "Initiator", productType: "HarnessWire", name: "HW-02MM", initiatorType: "SurfaceWire", deliveryVodMs: 30000000, delayMs: 0, colorHex: "#555522", description: "2mm Harness Wire - Electronic Detonator" },
    // --- Initiator --- Detonating Cord
    { productCategory: "Initiator", productType: "DetonatingCord", name: "10GCORD", initiatorType: "DetonatingCord", deliveryVodMs: 7000, coreLoadGramsPerMeter: 10, colorHex: "#AA0000", description: "10 gram per meter detonating cord" },
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
        description: "Single stemming + charge + primer",
        primerInterval: 8.0,
        inertDeckArray: [
            { idx: 1, type: "INERT", product: "Stemming", lengthMode: "fixed", length: 3.5, isFixedLength: true }
        ],
        coupledDeckArray: [
            { idx: 2, type: "COUPLED", product: "ANFO", lengthMode: "fill" }
        ],
        primerArray: [
            { depth: "fx:chargeBase - 0.3", detonator: "GENERIC-MS", booster: "BS400G" }
        ]
    },
    {
        configCode: "ST5050",
        configName: "50/50 Stem and Charge",
        description: "50% stemming 50% charge split",
        primerInterval: 8.0,
        inertDeckArray: [
            { idx: 1, type: "INERT", product: "Stemming", lengthMode: "formula", formula: "holeLength * 0.5" }
        ],
        coupledDeckArray: [
            { idx: 2, type: "COUPLED", product: "ANFO", lengthMode: "fill" }
        ],
        primerArray: [
            { depth: "fx:chargeBase - 0.3", detonator: "GENERIC-MS", booster: "BS400G" }
        ]
    },
    {
        configCode: "AIRDEC",
        configName: "Air Deck with Gas Bag",
        description: "Stem + gas bag + air + charge",
        primerInterval: 8.0,
        inertDeckArray: [
            { idx: 1, type: "INERT", product: "Stemming", lengthMode: "fixed", length: 3.0, isFixedLength: true },
            { idx: 3, type: "INERT", product: "Air", lengthMode: "fill" }
        ],
        spacerDeckArray: [
            { idx: 2, type: "SPACER", product: "GB230MM", lengthMode: "product" }
        ],
        coupledDeckArray: [
            { idx: 4, type: "COUPLED", product: "ANFO", lengthMode: "fixed", length: 6.0 }
        ],
        primerArray: [
            { depth: "fx:chargeBase - chargeLength * 0.1", detonator: "GENERIC-MS", booster: "BS400G" }
        ]
    },
    {
        configCode: "PRESPL",
        configName: "Presplit Charging",
        description: "AirStem (Vented) + decoupled charge",
        primerInterval: 20.0,
        inertDeckArray: [
            { idx: 1, type: "INERT", product: "Air", lengthMode: "fixed", length: 2.2, isFixedLength: true }
        ],
        decoupledDeckArray: [
            { idx: 2, type: "DECOUPLED", product: "PRE32MM", lengthMode: "fill" }
        ],
        primerArray: [
            { depth: "fx:holeLength * 0.9", detonator: "10GCORD", booster: null }
        ]
    },
    {
        configCode: "NOCHG",
        configName: "No Charge",
        description: "Do not charge - leave hole empty",
        primerInterval: 8.0,
        inertDeckArray: [
            { idx: 1, type: "INERT", product: "Air", lengthMode: "fill" }
        ],
        primerArray: []
    },
    {
        configCode: "AIRDEC",
        configName: "Two Air Decks",
        description: "Two air deck design with indexed primer formulas",
        primerInterval: 8.0,
        inertDeckArray: [
            { idx: 1, type: "INERT", product: "Stemming", lengthMode: "fill" },
            { idx: 3, type: "INERT", product: "Air", lengthMode: "fixed", length: 1.7 },
            { idx: 5, type: "INERT", product: "Stemming", lengthMode: "fixed", length: 0.97, isFixedLength: true },
            { idx: 7, type: "INERT", product: "Air", lengthMode: "fixed", length: 1.88 }
        ],
        spacerDeckArray: [
            { idx: 2, type: "SPACER", product: "GB230MM", lengthMode: "product" },
            { idx: 6, type: "SPACER", product: "GB230MM", lengthMode: "product" }
        ],
        coupledDeckArray: [
            { idx: 4, type: "COUPLED", product: "ANFO", lengthMode: "fixed", length: 2.2 },
            { idx: 8, type: "COUPLED", product: "ANFO", lengthMode: "fixed", length: 2.025 }
        ],
        primerArray: [
            { depth: "fx:chargeBase[8] - 0.3", detonator: "GENERIC-MS", booster: "BS400G" },
            { depth: "fx:chargeBase[4] - 0.3", detonator: "GENERIC-MS", booster: "BS400G" }
        ]
    },
    {
        configCode: "CUSTOM",
        configName: "Multi Deck with Spacers",
        description: "Stem + charge + spacer + charge + spacer + charge + stem",
        primerInterval: 8.0,
        inertDeckArray: [
            { idx: 1, type: "INERT", product: "Stemming", lengthMode: "fixed", length: 2.0, isFixedLength: true },
            { idx: 7, type: "INERT", product: "Stemming", lengthMode: "fixed", length: 2.0, isFixedLength: true }
        ],
        coupledDeckArray: [
            { idx: 2, type: "COUPLED", product: "ANFO", lengthMode: "fill" },
            { idx: 4, type: "COUPLED", product: "ANFO", lengthMode: "fixed", length: 2.0 },
            { idx: 6, type: "COUPLED", product: "ANFO", lengthMode: "fixed", length: 2.0 }
        ],
        spacerDeckArray: [
            { idx: 3, type: "SPACER", product: "GB230MM", lengthMode: "product" },
            { idx: 5, type: "SPACER", product: "GB230MM", lengthMode: "product" }
        ],
        primerArray: [
            { depth: "fx:chargeBase - chargeLength * 0.1", detonator: "GENERIC-MS", booster: "BS400G" }
        ]
    }
];

/**
 * Build example configs array from EXAMPLE_CONFIG_DATA.
 * @returns {ChargeConfig[]}
 */
function buildExampleConfigs() {
    var configs = [];
    for (var i = 0; i < EXAMPLE_CONFIG_DATA.length; i++) {
        configs.push(ChargeConfig.fromJSON(EXAMPLE_CONFIG_DATA[i]));
    }
    return configs;
}

// ============ EXPORT BASE CONFIG ============

/**
 * Export a template ZIP with CSV files for users to fill in and re-import
 */
export async function exportBaseConfigTemplate() {
    var zip = new JSZip();

    // Add README and reference documentation
    zip.file("README.txt", README_CONTENT);
    zip.file("ChargeConfigCSV-README.txt", DOC_REFERENCE_TXT);
    zip.file("ChargeConfigCSV-README.md", DOC_REFERENCE_MD);

    // Add products CSV with header + examples (programmatically generated for alignment)
    var exampleRows = buildExampleProductRows();
    var productsCSV = PRODUCTS_CSV_HEADER + "\n" + exampleRows.join("\n") + "\n";
    zip.file("products.csv", productsCSV);

    // Add charge configs CSV in transposed format
    var exampleConfigs = buildExampleConfigs();
    var configsCSV = configsToTransposedCSV(exampleConfigs);
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

    // Charge configs CSV in transposed format
    var configsArray = [];
    if (configsMap && configsMap.size > 0) {
        configsMap.forEach(function (config) {
            configsArray.push(config);
        });
    }
    zip.file("chargeConfigs.csv", configsToTransposedCSV(configsArray));

    zip.file("README.txt", README_CONTENT);
    zip.file("ChargeConfigCSV-README.txt", DOC_REFERENCE_TXT);
    zip.file("ChargeConfigCSV-README.md", DOC_REFERENCE_MD);

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
        escapeCSV(json.delayMs != null ? json.delayMs : ""),
        escapeCSV(json.coreLoadGramsPerMeter || ""),
        escapeCSV(json.spacerType || ""),
        escapeCSV(json.description)
    ].join(",");
}

/**
 * Serialize a scaling flag suffix for a deck entry.
 * Returns "FL", "FM", "PR", or "" (empty for default proportional).
 * @param {Object} entry - Deck entry with optional isFixedLength, isFixedMass, isProportionalDeck
 * @returns {string}
 */
function getScalingFlagSuffix(entry) {
    if (entry.isFixedLength) return "FL";
    if (entry.isFixedMass) return "FM";
    if (entry.isVariable) return "VR";
    if (entry.isProportionalDeck) return "PR";
    return "";
}

/**
 * Serialize an overlap pattern object to overlap syntax string.
 * Input: { base: 3, "base-1": 2, n: 1, top: 2 }
 * Output: "overlap:base=3;base-1=2;n=1;top=2"
 * @param {Object} overlapPattern
 * @returns {string}
 */
function serializeOverlapPattern(overlapPattern) {
    if (!overlapPattern) return "";
    var parts = [];
    var keys = Object.keys(overlapPattern);
    for (var i = 0; i < keys.length; i++) {
        parts.push(keys[i] + "=" + overlapPattern[keys[i]]);
    }
    if (parts.length === 0) return "";
    return "overlap:" + parts.join(";");
}

/**
 * Convert a ChargeConfig into a flat field->value map keyed by TRANSPOSED_CONFIG_FIELDS.field.
 * Serializes deck arrays into typed deck columns (inertDeck, coupledDeck, etc.) and
 * primerArray into the primer column using brace notation.
 * @param {ChargeConfig} config
 * @returns {Object} field -> string value
 */
function configToFieldMap(config) {
    var json = config.toJSON();
    var map = {};

    // Simple fields (scalar values from config)
    map.configCode = json.configCode || "";
    map.configName = json.configName || "";
    map.description = json.description || "";
    map.primerInterval = json.primerInterval != null ? String(json.primerInterval) : "";
    map.shortHoleLogic = json.shortHoleLogic != null ? String(json.shortHoleLogic) : "";
    map.shortHoleLength = json.shortHoleLength != null ? String(json.shortHoleLength) : "";
    map.wetHoleSwap = json.wetHoleSwap != null ? String(json.wetHoleSwap) : "";
    map.wetHoleProduct = json.wetHoleProduct || "";

    // Serialize deck arrays into typed deck columns
    var inertEntries = [];
    var coupledEntries = [];
    var decoupledEntries = [];
    var spacerEntries = [];

    // Serialize inertDeckArray
    if (json.inertDeckArray && json.inertDeckArray.length > 0) {
        for (var ia = 0; ia < json.inertDeckArray.length; ia++) {
            var ie = json.inertDeckArray[ia];
            var idx = ie.idx || (ia + 1);
            var lengthStr = serializeDeckLength(ie);
            var flag = getScalingFlagSuffix(ie);
            var overlap = serializeOverlapPattern(ie.overlapPattern);
            var deckStr = "{" + idx + "," + lengthStr + "," + (ie.product || "Unknown");
            if (flag) deckStr += "," + flag;
            if (overlap) deckStr += "," + overlap;
            deckStr += "}";
            inertEntries.push(deckStr);
        }
    }

    // Serialize coupledDeckArray
    if (json.coupledDeckArray && json.coupledDeckArray.length > 0) {
        for (var ca = 0; ca < json.coupledDeckArray.length; ca++) {
            var ce = json.coupledDeckArray[ca];
            var cidx = ce.idx || (ca + 1);
            var clengthStr = serializeDeckLength(ce);
            var cflag = getScalingFlagSuffix(ce);
            var coverlap = serializeOverlapPattern(ce.overlapPattern);
            var cdeckStr = "{" + cidx + "," + clengthStr + "," + (ce.product || "Unknown");
            if (cflag) cdeckStr += "," + cflag;
            if (coverlap) cdeckStr += "," + coverlap;
            cdeckStr += "}";
            coupledEntries.push(cdeckStr);
        }
    }

    // Serialize decoupledDeckArray
    if (json.decoupledDeckArray && json.decoupledDeckArray.length > 0) {
        for (var da = 0; da < json.decoupledDeckArray.length; da++) {
            var de = json.decoupledDeckArray[da];
            var didx = de.idx || (da + 1);
            var dlengthStr = serializeDeckLength(de);
            var dflag = getScalingFlagSuffix(de);
            var doverlap = serializeOverlapPattern(de.overlapPattern);
            var ddeckStr = "{" + didx + "," + dlengthStr + "," + (de.product || "Unknown");
            if (dflag) ddeckStr += "," + dflag;
            if (doverlap) ddeckStr += "," + doverlap;
            ddeckStr += "}";
            decoupledEntries.push(ddeckStr);
        }
    }

    // Serialize spacerDeckArray
    if (json.spacerDeckArray && json.spacerDeckArray.length > 0) {
        for (var sa = 0; sa < json.spacerDeckArray.length; sa++) {
            var se = json.spacerDeckArray[sa];
            var sidx = se.idx || (sa + 1);
            spacerEntries.push("{" + sidx + "," + (se.product || "Unknown") + "}");
        }
    }

    map.inertDeck = inertEntries.join(";");
    map.coupledDeck = coupledEntries.join(";");
    map.decoupledDeck = decoupledEntries.join(";");
    map.spacerDeck = spacerEntries.join(";");

    // Serialize primerArray
    var primerEntries = [];
    if (json.primerArray && json.primerArray.length > 0) {
        for (var p = 0; p < json.primerArray.length; p++) {
            var pt = json.primerArray[p];
            var primerIdx = p + 1;
            var depthStr = pt.depth != null ? String(pt.depth) : "";
            var detStr = pt.detonator ? "Det{" + pt.detonator + "}" : "";
            var heStr = pt.booster ? "HE{" + pt.booster + "}" : "";
            primerEntries.push("{" + primerIdx + "," + depthStr + "," + detStr + "," + heStr + "}");
        }
    }
    map.primer = primerEntries.join(";");

    return map;
}

/**
 * Serialize a deck entry's length to brace notation length string.
 * @param {Object} entry - Deck template entry
 * @returns {string} Length string (e.g. "2.0", "fill", "fx:expr", "m:50", "product")
 */
function serializeDeckLength(entry) {
    switch (entry.lengthMode) {
        case "fill": return "fill";
        case "formula": return "fx:" + (entry.formula || "holeLength");
        case "mass": return "m:" + (entry.massKg || 0);
        case "product": return "product";
        default: return String(entry.length || 0);
    }
}

/**
 * Generate transposed CSV from an array of ChargeConfig objects.
 * Format: rows = fields, columns = configs.
 * Header: Type,Description,Field,[1],[2],[3],...
 * @param {ChargeConfig[]} configsArray
 * @returns {string} CSV text
 */
function configsToTransposedCSV(configsArray) {
    if (!configsArray || configsArray.length === 0) {
        // Return header-only with field rows but no config columns
        var headerOnly = "Type,Description,Field\n";
        for (var h = 0; h < TRANSPOSED_CONFIG_FIELDS.length; h++) {
            var f = TRANSPOSED_CONFIG_FIELDS[h];
            headerOnly += escapeCSV(f.type) + "," + escapeCSV(f.desc) + "," + escapeCSV(f.field) + "\n";
        }
        return headerOnly;
    }

    // Convert each config to a field map
    var fieldMaps = [];
    for (var c = 0; c < configsArray.length; c++) {
        fieldMaps.push(configToFieldMap(configsArray[c]));
    }

    // Header row: Type,Description,Field,[1],[2],...
    var header = "Type,Description,Field";
    for (var ci = 0; ci < configsArray.length; ci++) {
        header += ",[" + (ci + 1) + "]";
    }

    var lines = [header];

    // One row per field
    for (var fi = 0; fi < TRANSPOSED_CONFIG_FIELDS.length; fi++) {
        var fieldDef = TRANSPOSED_CONFIG_FIELDS[fi];
        var row = escapeCSV(fieldDef.type) + "," + escapeCSV(fieldDef.desc) + "," + escapeCSV(fieldDef.field);
        for (var mi = 0; mi < fieldMaps.length; mi++) {
            row += "," + escapeCSV(fieldMaps[mi][fieldDef.field] || "");
        }
        lines.push(row);
    }

    return lines.join("\n") + "\n";
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
                var hdr = headers[j];
                var val = values[j] || "";
                // Convert types
                if (val === "true") val = true;
                else if (val === "false") val = false;
                else if (val !== "" && !isNaN(val) && hdr !== "name" && hdr !== "description" && hdr !== "supplier" && hdr !== "colorHex") {
                    val = parseFloat(val);
                }
                // Backward compat: old CSV with delaySeriesMs header → map to delayMs
                if (hdr === "delaySeriesMs" && val !== "") {
                    if (typeof val === "string") {
                        val = parseFloat(val.split(";")[0].trim());
                    }
                    obj["delayMs"] = val;
                } else if (val !== "") {
                    obj[hdr] = val;
                }
            }
            var product = createProductFromJSON(obj);
            products.push(product);
        } catch (err) {
            errors.push("Products row " + (i + 1) + ": " + err.message);
        }
    }
    return products;
}

/**
 * Parse a typed deck column (inertDeck, coupledDeck, decoupledDeck) from brace notation.
 * Input: "{1,2.0,Stemming};{8,fill,Stemming}"
 * Supports 4th element scaling flag: FL (isFixedLength), FM (isFixedMass), PR (isProportionalDeck)
 * Supports optional overlap syntax: {idx,length,product,FL,overlap:base=3;base-1=2;n=1;top=2}
 * Returns array of deck template entries with idx for sorting.
 * @param {string} text - Raw cell value
 * @param {string} deckType - "INERT", "COUPLED", "DECOUPLED", or "SPACER"
 * @returns {Array} Deck template entries with idx property
 */
function parseDeckColumn(text, deckType) {
    if (!text || text.trim().length === 0) return [];

    var entries = text.split(";");
    var result = [];

    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i].trim();
        if (entry.length === 0) continue;

        // Strip outer braces
        if (entry.charAt(0) === "{") entry = entry.substring(1);
        if (entry.charAt(entry.length - 1) === "}") entry = entry.substring(0, entry.length - 1);

        var parts = entry.split(",");
        if (parts.length < 2) continue;

        var idx = parseInt(parts[0].trim(), 10);

        if (deckType === "SPACER") {
            // Spacer: {idx,product} — length derived from product.lengthMm
            result.push({
                idx: idx,
                type: "SPACER",
                product: parts[1].trim(),
                lengthMode: "product",
                length: null
            });
        } else {
            // Non-spacer: {idx,length,product} or {idx,length,product,FLAG} or {idx,length,product,FLAG,overlap:...}
            if (parts.length < 3) continue;
            var lengthStr = parts[1].trim();
            var product = parts[2].trim();

            var templateEntry = {
                idx: idx,
                type: deckType,
                product: product,
                lengthMode: "fixed",
                length: null
            };

            if (lengthStr === "fill") {
                templateEntry.lengthMode = "fill";
            } else if (lengthStr === "product") {
                templateEntry.lengthMode = "product";
            } else if (lengthStr.length > 3 && lengthStr.substring(0, 3) === "fx:") {
                templateEntry.lengthMode = "formula";
                templateEntry.formula = lengthStr.substring(3);
            } else if (lengthStr.length > 2 && lengthStr.substring(0, 2) === "m:") {
                templateEntry.lengthMode = "mass";
                templateEntry.massKg = parseFloat(lengthStr.substring(2)) || 0;
            } else {
                templateEntry.lengthMode = "fixed";
                templateEntry.length = parseFloat(lengthStr) || 0;
            }

            // Parse optional 4th element: scaling flag (FL, FM, PR, VR)
            if (parts.length >= 4) {
                var fourthPart = parts[3].trim();
                // Check if it's a scaling flag or overlap syntax
                if (fourthPart === "FL") {
                    templateEntry.isFixedLength = true;
                } else if (fourthPart === "FM") {
                    templateEntry.isFixedMass = true;
                } else if (fourthPart === "VR") {
                    templateEntry.isVariable = true;
                } else if (fourthPart === "PR") {
                    templateEntry.isProportionalDeck = true;
                } else if (fourthPart.length > 8 && fourthPart.substring(0, 8) === "overlap:") {
                    templateEntry.overlapPattern = parseOverlapSyntax(fourthPart);
                }
            }

            // Parse optional 5th element: overlap syntax (when flag was 4th)
            if (parts.length >= 5) {
                var fifthPart = parts[4].trim();
                if (fifthPart.length > 8 && fifthPart.substring(0, 8) === "overlap:") {
                    templateEntry.overlapPattern = parseOverlapSyntax(fifthPart);
                }
            }

            result.push(templateEntry);
        }
    }

    return result;
}

/**
 * Parse overlap syntax string into an object.
 * Input: "overlap:base=3;base-1=2;n=1;top=2"
 * Output: { base: 3, "base-1": 2, n: 1, top: 2 }
 * @param {string} overlapStr
 * @returns {Object}
 */
function parseOverlapSyntax(overlapStr) {
    var pattern = {};
    // Strip "overlap:" prefix
    var body = overlapStr.substring(8);
    var pairs = body.split(";");
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].trim();
        if (pair.length === 0) continue;
        var eqIdx = pair.indexOf("=");
        if (eqIdx === -1) continue;
        var key = pair.substring(0, eqIdx).trim();
        var val = parseFloat(pair.substring(eqIdx + 1).trim());
        if (!isNaN(val)) {
            pattern[key] = val;
        }
    }
    return pattern;
}

/**
 * Split primer entries on ";" respecting nested braces (e.g. Det{...}, HE{...}).
 * @param {string} text
 * @returns {string[]}
 */
function splitPrimerEntries(text) {
    var entries = [];
    var depth = 0;
    var current = "";

    for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (ch === "{") depth++;
        else if (ch === "}") depth--;

        if (ch === ";" && depth === 0) {
            entries.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.trim().length > 0) entries.push(current);

    return entries;
}

/**
 * Parse the primer column from brace notation.
 * Input: "{1,fx:chargeBase-0.3,Det{MSHD500},HE{BS400G}};{2,8.5,Det{GENERIC-MS},HE{BS400G}}"
 * Returns array of primer template entries.
 * @param {string} text
 * @returns {Array} Primer template entries
 */
function parsePrimerColumn(text) {
    if (!text || text.trim().length === 0) return [];

    var result = [];
    var entries = splitPrimerEntries(text);

    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i].trim();
        if (entry.length === 0) continue;

        // Strip outer braces
        if (entry.charAt(0) === "{") entry = entry.substring(1);
        if (entry.charAt(entry.length - 1) === "}") entry = entry.substring(0, entry.length - 1);

        // Extract Det{...} and HE{...} first (they contain nested braces)
        var detonator = null;
        var booster = null;

        var detMatch = entry.match(/Det\{([^}]*)\}/);
        if (detMatch) {
            detonator = detMatch[1];
            entry = entry.replace(detMatch[0], "").trim();
        }

        var heMatch = entry.match(/HE\{([^}]*)\}/);
        if (heMatch) {
            booster = heMatch[1] || null;
            entry = entry.replace(heMatch[0], "").trim();
        }

        // Clean up trailing/leading commas after extraction
        entry = entry.replace(/,\s*,/g, ",").replace(/^,|,$/g, "").trim();

        // Remaining: idx,depth
        var parts = entry.split(",").filter(function (p) { return p.trim().length > 0; });
        var idx = parts.length >= 1 ? parseInt(parts[0].trim(), 10) : (i + 1);
        var depth = null;
        if (parts.length >= 2) {
            var depthStr = parts[1].trim();
            // Keep as string if it's a formula, otherwise parse to number
            if (depthStr.length > 3 && depthStr.substring(0, 3) === "fx:") {
                depth = depthStr;
            } else if (depthStr !== "" && !isNaN(depthStr)) {
                depth = parseFloat(depthStr);
            } else {
                depth = depthStr; // keep raw string
            }
        }

        result.push({
            idx: idx,
            depth: depth,
            detonator: detonator,
            booster: booster
        });
    }

    return result;
}

/**
 * Parse chargeConfigs.csv - auto-detects transposed vs legacy row-based format.
 * Transposed: header starts with "Type,Description,Field,..."
 * Legacy: header starts with "configCode,configName,..."
 */
function parseChargeConfigsCSV(text, errors) {
    var lines = text.split("\n").filter(function (l) {
        return l.trim().length > 0;
    });
    if (lines.length < 2) return [];

    var headers = parseCSVLine(lines[0]);

    // Detect format: transposed CSV has "Type" and "Field" in first row
    if (headers.length >= 3 && headers[0] === "Type" && headers[2] === "Field") {
        return parseTransposedChargeConfigsCSV(lines, headers, errors);
    }

    // Legacy row-based format
    return parseLegacyChargeConfigsCSV(lines, headers, errors);
}

/**
 * Parse transposed chargeConfigs.csv (rows=fields, columns=configs).
 * Header: Type,Description,Field,[1],[2],...
 * Each subsequent row: type,desc,fieldName,val1,val2,...
 */
function parseTransposedChargeConfigsCSV(lines, headers, errors) {
    var configCount = headers.length - 3; // Columns beyond Type,Description,Field
    if (configCount <= 0) return [];

    // Initialize config objects
    var configObjs = [];
    for (var c = 0; c < configCount; c++) {
        configObjs.push({});
    }

    // String fields that should never be auto-parsed as numbers
    var stringFields = {
        configName: true, description: true, wetHoleProduct: true,
        inertDeck: true, coupledDeck: true, decoupledDeck: true,
        spacerDeck: true, primer: true
    };

    // Deck column fields that need special parsing
    var deckFields = { inertDeck: true, coupledDeck: true, decoupledDeck: true, spacerDeck: true };

    // Read each field row
    for (var r = 1; r < lines.length; r++) {
        var values = parseCSVLine(lines[r]);
        if (values.length < 3) continue;

        var fieldName = values[2]; // Field column
        if (!fieldName) continue;

        for (var ci = 0; ci < configCount; ci++) {
            var val = values[ci + 3] || "";
            if (val === "") continue;

            // Type conversion
            if (deckFields[fieldName] || fieldName === "primer") {
                // Keep raw string for deck/primer parsing later
                configObjs[ci][fieldName] = val;
            } else if (val === "true") {
                configObjs[ci][fieldName] = true;
            } else if (val === "false") {
                configObjs[ci][fieldName] = false;
            } else if (!isNaN(val) && !stringFields[fieldName]) {
                configObjs[ci][fieldName] = parseFloat(val);
            } else {
                configObjs[ci][fieldName] = val;
            }
        }
    }

    // Convert to ChargeConfig objects, parsing deck/primer columns into deck arrays
    var configs = [];
    for (var k = 0; k < configObjs.length; k++) {
        try {
            var obj = configObjs[k];
            if (!obj.configCode && !obj.configName) continue; // Skip empty columns

            // Parse typed deck columns directly into deck arrays
            obj.inertDeckArray = obj.inertDeck ? parseDeckColumn(obj.inertDeck, "INERT") : [];
            obj.coupledDeckArray = obj.coupledDeck ? parseDeckColumn(obj.coupledDeck, "COUPLED") : [];
            obj.decoupledDeckArray = obj.decoupledDeck ? parseDeckColumn(obj.decoupledDeck, "DECOUPLED") : [];
            obj.spacerDeckArray = obj.spacerDeck ? parseDeckColumn(obj.spacerDeck, "SPACER") : [];

            // Parse primer column into primerArray
            if (obj.primer) {
                var primers = parsePrimerColumn(obj.primer);
                if (primers.length > 0) {
                    obj.primerArray = [];
                    for (var pk = 0; pk < primers.length; pk++) {
                        obj.primerArray.push({
                            depth: primers[pk].depth,
                            detonator: primers[pk].detonator,
                            booster: primers[pk].booster
                        });
                    }
                }
            }

            // Clean up raw deck/primer strings before creating config
            delete obj.inertDeck;
            delete obj.coupledDeck;
            delete obj.decoupledDeck;
            delete obj.spacerDeck;
            delete obj.primer;

            configs.push(ChargeConfig.fromJSON(obj));
        } catch (err) {
            errors.push("Config column " + (k + 1) + ": " + err.message);
        }
    }
    return configs;
}

/**
 * Parse legacy row-based chargeConfigs.csv (backward compatibility).
 * Header: configCode,configName,...,inertDeck,coupledDeck,...
 */
function parseLegacyChargeConfigsCSV(lines, headers, errors) {
    var configs = [];

    var hasTypedDeckCols = headers.indexOf("inertDeck") !== -1;
    var hasLegacyDeckTemplate = headers.indexOf("deckTemplate") !== -1;

    var stringHeaders = {
        configName: true, description: true, wetHoleProduct: true,
        inertDeck: true, coupledDeck: true, decoupledDeck: true,
        spacerDeck: true, primer: true, deckTemplate: true
    };

    for (var i = 1; i < lines.length; i++) {
        try {
            var values = parseCSVLine(lines[i]);
            var obj = {};
            var typedDeckColumns = {
                inertDeck: "", coupledDeck: "", decoupledDeck: "",
                spacerDeck: "", primer: ""
            };

            for (var j = 0; j < headers.length; j++) {
                var hdr = headers[j];
                var val = values[j] || "";

                if (hasTypedDeckCols && typedDeckColumns.hasOwnProperty(hdr)) {
                    typedDeckColumns[hdr] = val;
                    continue;
                }

                if (val === "true") val = true;
                else if (val === "false") val = false;
                else if (val !== "" && !isNaN(val) && !stringHeaders[hdr]) {
                    val = parseFloat(val);
                }
                if (val !== "") obj[hdr] = val;
            }

            if (hasTypedDeckCols) {
                // Parse typed deck columns directly into deck arrays
                obj.inertDeckArray = parseDeckColumn(typedDeckColumns.inertDeck, "INERT");
                obj.coupledDeckArray = parseDeckColumn(typedDeckColumns.coupledDeck, "COUPLED");
                obj.decoupledDeckArray = parseDeckColumn(typedDeckColumns.decoupledDeck, "DECOUPLED");
                obj.spacerDeckArray = parseDeckColumn(typedDeckColumns.spacerDeck, "SPACER");

                if (!obj.configCode &&
                    (obj.inertDeckArray.length > 0 || obj.coupledDeckArray.length > 0 ||
                     obj.decoupledDeckArray.length > 0 || obj.spacerDeckArray.length > 0)) {
                    obj.configCode = "CUSTOM";
                }

                var primers = parsePrimerColumn(typedDeckColumns.primer);
                if (primers.length > 0) {
                    obj.primerArray = [];
                    for (var pk = 0; pk < primers.length; pk++) {
                        obj.primerArray.push({
                            depth: primers[pk].depth,
                            detonator: primers[pk].detonator,
                            booster: primers[pk].booster
                        });
                    }
                }
            } else if (hasLegacyDeckTemplate && typeof obj.deckTemplate === "string" && obj.deckTemplate.length > 0) {
                try {
                    obj.deckTemplate = JSON.parse(obj.deckTemplate);
                } catch (parseErr) {
                    obj.deckTemplate = [];
                }
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
        function () {
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
        function () {
            window.loadedChargeConfigs.clear();
            if (typeof window.debouncedSaveConfigs === "function") window.debouncedSaveConfigs();
            if (typeof window.showModalMessage === "function") {
                window.showModalMessage("Charge Rules Cleared", "Removed " + count + " charge rule(s).", "success");
            }
        }
    );
}

/**
 * Backup (export) all products and charge configs as a single ZIP file.
 */
export async function backupChargingConfig() {
    await exportCurrentConfig(window.loadedProducts || new Map(), window.loadedChargeConfigs || new Map());
}
