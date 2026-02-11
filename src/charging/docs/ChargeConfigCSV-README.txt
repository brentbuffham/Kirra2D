================================================================================
  CHARGE CONFIGURATION CSV FORMAT REFERENCE
================================================================================

OVERVIEW
--------
Kirra exports and imports charge configurations as a ZIP file containing CSV
files. This document describes the chargeConfigs.csv format -- specifically
the typed deck columns that define multi-deck charge designs in a
human-readable, spreadsheet-friendly format.


FILE STRUCTURE
--------------
  kirra-charging-config.zip
    products.csv          Product definitions (explosives, stemming, detonators)
    chargeConfigs.csv     Charge rule configurations (this document)
    README.txt            Quick-start instructions


================================================================================
  chargeConfigs.csv COLUMNS
================================================================================

  #   Column                  Type       Description
  --  ----------------------  ---------  ----------------------------------------
   1  configCode              string     Rule code: STNDFS, AIRDEC, CUSTOM, etc.
   2  configName              string     Human-readable rule name
   3  stemmingProduct         string     Stemming product name (from products.csv)
   4  chargeProduct           string     Primary charge product name
   5  wetChargeProduct        string     Wet hole charge product (optional)
   6  boosterProduct          string     Default booster product name
   7  detonatorProduct        string     Default detonator product name
   8  gasBagProduct           string     Gas bag/spacer product name
   9  preferredStemLength     number     Target stemming length (metres)
  10  minStemLength           number     Minimum stemming length (metres)
  11  preferredChargeLength   number     Target charge length (metres)
  12  minChargeLength         number     Minimum charge length (metres)
  13  useMassOverLength       boolean    true = charge by mass instead of length
  14  targetChargeMassKg      number     Target charge mass in kg
  15  chargeRatio             number     Fraction of hole for charge (0.0-1.0)
  16  primerInterval          number     Interval between primers (metres)
  17  primerDepthFromCollar   str/num    Single primer depth or fx: formula
  18  maxPrimersPerDeck       number     Maximum primers per charge deck
  19  airDeckLength           number     Air deck length (metres)
  20  applyShortHoleLogic     boolean    Apply short-hole charging tiers
  21  description             string     Free-text description
  22  inertDeck               string     Inert deck entries (brace notation)
  23  coupledDeck             string     Coupled explosive deck entries
  24  decoupledDeck           string     Decoupled explosive deck entries
  25  spacerDeck              string     Spacer deck entries
  26  primer                  string     Primer entries (brace notation)

Standard codes (STNDFS, AIRDEC, etc.) use columns 1-21 only.
Custom configs (CUSTOM) use columns 22-26 for explicit deck layouts.
Any config code can include typed deck columns to override the default layout.


================================================================================
  TYPED DECK COLUMN SYNTAX
================================================================================

INERT, COUPLED, AND DECOUPLED DECKS
------------------------------------
Format:  {idx,length,product}

  Multiple entries separated by ;

  idx      Integer deck order from collar (1-based). Deck 1 is at the top.
  length   Deck length -- see Length Modes below
  product  Product name, must match a name in products.csv

Length Modes:

  Syntax          Mode       Description
  -----------     -------    -------------------------------------------
  2.0             Fixed      Exact length in metres
  fill            Fill       Absorbs remaining hole length
  fx:holeLen-4    Formula    Calculated from hole properties at apply-time
  m:50            Mass       50 kg of product (length from density + diameter)

Examples:

  inertDeck:     {1,2.0,Stemming};{8,2.0,Stemming}
  coupledDeck:   {2,fill,ANFO};{4,2.0,ANFO};{6,2.0,ANFO}
  decoupledDeck: {3,1.5,PKG75mm}

[Screenshot placeholder: inertDeck column in Excel]


SPACER DECKS
------------
Format:  {idx,product}

  No length field -- length is derived from product.lengthMm / 1000.

  idx      Deck order position (1-based)
  product  Spacer product name

Example:

  spacerDeck: {3,GB230MM};{5,GB230MM};{7,GB230MM}

  GB230MM with lengthMm: 400 produces a 0.4m spacer deck.

[Screenshot placeholder: spacerDeck column in Excel]


PRIMER ENTRIES
--------------
Format:  {idx,depth,Det{name},HE{name}}

  Multiple entries separated by ;

  idx       Primer number (1-based)
  depth     Depth from collar in metres, or fx: formula
  Det{name} Detonator product name (inside Det{...})
  HE{name}  Booster / high-explosive product name (inside HE{...})

Examples:

  Single primer:
    {1,fx:chargeBase-chargeLength*0.1,Det{GENERIC-MS},HE{BS400G}}

  Two primers:
    {1,fx:chargeBase-0.3,Det{GENERIC-MS},HE{BS400G}};{2,fx:chargeBase-chargeLength*0.5,Det{GENERIC-MS},HE{BS400G}}

  Literal depth:
    {1,8.5,Det{GENERIC-E},HE{BS400G}}

[Screenshot placeholder: primer column in Excel]


================================================================================
  DECK ORDER AND HOLE LAYOUT
================================================================================

Decks are ordered from collar (top) to toe (bottom) using the idx field:

  Collar (0m)
    +-------------------+
    |  Deck idx=1        |  <- e.g. Stemming (INERT)
    +-------------------+
    |  Deck idx=2        |  <- e.g. ANFO (COUPLED, fill)
    +-------------------+
    |  Deck idx=3        |  <- e.g. Gas Bag (SPACER)
    +-------------------+
    |  Deck idx=4        |  <- e.g. ANFO (COUPLED, 2.0m)
    +-------------------+
    |  Deck idx=5        |  <- e.g. Gas Bag (SPACER)
    +-------------------+
    |  Deck idx=6        |  <- e.g. ANFO (COUPLED, 2.0m)
    +-------------------+
    |  Deck idx=7        |  <- e.g. Stemming (INERT)
    +-------------------+
  Toe (holeLength)

The idx values do NOT need to be sequential (gaps allowed), but must be
unique across all four deck columns. The engine sorts by idx for order.

[Screenshot placeholder: Deck Builder dialog showing 7-deck layout]


================================================================================
  FORMULA REFERENCE
================================================================================

Formulas are prefixed with fx: to avoid triggering spreadsheet formula parsing.

Available Variables:

  Variable          Description
  ----------------  --------------------------------------------------
  holeLength        Total hole length in metres (collar to toe)
  chargeLength      Length of the deepest charge deck (metres)
  chargeTop         Depth from collar to top of deepest charge (m)
  chargeBase        Depth from collar to bottom of deepest charge (m)
  stemLength        Length of stemming from collar (m)
  holeDiameter      Hole diameter in millimetres
  benchHeight       Bench height from hole data (m)
  subdrillLength    Subdrill length from hole data (m)

Math Functions:

  Math.min(a, b)   Math.max(a, b)   Math.abs(x)
  Math.sqrt(x)     Math.PI          Math.round(x)

Formula Examples:

  Formula                                     Description
  ------------------------------------------  ----------------------------
  fx:chargeBase - chargeLength * 0.1          Primer at 90% into charge
  fx:holeLength * 0.9                         Primer at 90% of total hole
  fx:Math.max(chargeTop+1, chargeBase-0.5)    At least 1m below charge top
  fx:holeLength - 4                           Deck length = hole minus 4m
  fx:chargeBase - 0.3                         Primer 0.3m above toe


================================================================================
  MASS-BASED LENGTH MODE
================================================================================

The m: prefix calculates deck length from a target mass in kilograms.

Formula used internally:

  length = massKg / (density * 1000 * PI * (diameter/2000)^2)

Where:
  density  = product density in g/cc (from products.csv)
  diameter = hole diameter in mm (from blast hole data)
  Result varies per-hole based on diameter

Example: m:50 with ANFO (0.85 g/cc) in a 115mm hole:

  area   = PI * (0.0575)^2 = 0.01039 m^2
  kg/m   = 0.85 * 1000 * 0.01039 = 8.83 kg/m
  length = 50 / 8.83 = 5.66 m

In a 250mm hole the same 50kg yields only 1.03m.


================================================================================
  COMPLETE CSV ROW EXAMPLE
================================================================================

A 7-deck custom config with spacers and a formula-depth primer:

configCode  configName              ...  inertDeck                            coupledDeck                                   decoupledDeck  spacerDeck               primer
CUSTOM      Multi Deck with Spacers ...  {1,2.0,Stemming};{7,2.0,Stemming}   {2,fill,ANFO};{4,2.0,ANFO};{6,2.0,ANFO}                     {3,GB230MM};{5,GB230MM}  {1,fx:chargeBase-chargeLength*0.1,Det{GENERIC-MS},HE{BS400G}}

[Screenshot placeholder: Full CSV row viewed in Excel]


================================================================================
  CONFIG CODE REFERENCE
================================================================================

  Code          Name                Description
  -----------   ------------------  ----------------------------------------
  SIMPLE_SINGLE Simple Single       One stemming + one charge + one primer
  STNDVS        Standard Vented     Air at top + stemming + charge at bottom
  STNDFS        Standard Fixed Stem Fixed stemming, fill rest with explosive
  ST5050        50/50 Split         50% stemming, 50% charge
  AIRDEC        Air Deck            Stemming + spacer + air + charge
  PRESPL        Presplit            Decoupled packaged explosive
  PRESPLIT      Presplit (alias)    Same as PRESPL
  NOCHG         No Charge           Leave hole empty (air-filled)
  CUSTOM        Custom              User-defined deck layout via typed columns


================================================================================
  WORKFLOW
================================================================================

EXPORT:
  1. Charging tab > Export Config (or File > Export Charging Config)
  2. Downloads kirra-charging-config.zip
  3. Open chargeConfigs.csv in Excel/Sheets/text editor
  4. Edit or add rows

IMPORT:
  1. Save CSV, re-ZIP all files
  2. Charging tab > Import Config (or File > Import Charging Config)
  3. Select the ZIP file
  4. Products and configs are loaded into memory

ROUND-TRIP VERIFICATION:
  1. Export config
  2. Re-import the same ZIP without changes
  3. Apply rules to holes
  4. Verify identical deck layouts


================================================================================
  SOURCE FILES
================================================================================

  File                                          Purpose
  --------------------------------------------  ----------------------------------
  src/charging/ConfigImportExport.js            CSV header, writer, parser
  src/charging/ChargeConfig.js                  ChargeConfig class
  src/charging/rules/SimpleRuleEngine.js        applyCustomTemplate() - engine
  src/charging/ui/DeckBuilderDialog.js          Deck Builder UI - Save as Rule
  src/helpers/FormulaEvaluator.js               fx: formula evaluation
  src/charging/ChargingConstants.js             DECK_TYPES, CONFIG_CODES enums
