================================================================================
  CHARGE CONFIGURATION CSV FORMAT REFERENCE
================================================================================

OVERVIEW
--------
Kirra exports and imports charge configurations as a ZIP file containing CSV
files. All charge designs use deck arrays -- there are no flat-field shortcuts.
Every config is a template of typed deck entries plus primer entries, applied
per-hole by the unified template engine.


FILE STRUCTURE
--------------
  kirra-charging-config.zip
    products.csv          Product definitions (explosives, stemming, detonators)
    chargeConfigs.csv     Charge rule configurations (transposed format)
    README.txt            Quick-start instructions


================================================================================
  chargeConfigs.csv FIELDS
================================================================================

  #   Field                Type       Description
  --  -------------------  ---------  ----------------------------------------
   1  configCode           code       Rule code identifier (e.g. STNDFS, CUSTOM)
   2  configName           text       Human-readable rule name
   3  description          text       Free-text description
   4  primerInterval       number     Interval between primers (metres)
   5  shortHoleLogic       bool       Apply short-hole charging tiers
   6  shortHoleLength      number     Short hole threshold length (m, default 4.0)
   7  wetHoleSwap          bool       Swap product for wet holes
   8  wetHoleProduct       product    Wet hole replacement product name
   9  inertDeck            deck       Inert deck template entries (brace notation)
  10  coupledDeck          deck       Coupled explosive deck entries
  11  decoupledDeck        deck       Decoupled explosive deck entries
  12  spacerDeck           deck       Spacer deck entries
  13  primer               primer     Primer template entries (brace notation)


================================================================================
  TYPED DECK COLUMN SYNTAX
================================================================================

INERT, COUPLED, AND DECOUPLED DECKS
------------------------------------
Format:  {idx,length,product} or {idx,length,product,FLAG}

  Multiple entries separated by ;

  idx      Integer deck order from collar (1-based). Deck 1 is at the top.
  length   Deck length -- see Length Modes below
  product  Product name, must match a name in products.csv
  FLAG     Optional scaling flag -- see Scaling Flags below

Length Modes:

  Syntax          Mode       Description
  -----------     -------    -------------------------------------------
  2.0             Fixed      Exact length in metres
  fill            Fill       Absorbs remaining hole length
  fx:holeLen-4    Formula    Calculated from hole properties at apply-time
  m:50            Mass       50 kg of product (length from density + diameter)
  product         Product    Length from product.lengthMm

Scaling Flags:

  Flag    Name              Behaviour
  ----    ----------------  ------------------------------------------------
  FL      Fixed Length       Keeps exact metre length regardless of hole length
  FM      Fixed Mass         Recalculates length from mass at new diameter
  PR      Proportional       Scales proportionally with hole length (default)

  When no flag is specified, the deck defaults to proportional scaling.

Examples:

  inertDeck:     {1,3.5,Stemming,FL};{5,fill,Stemming}
  coupledDeck:   {2,fill,ANFO};{4,2.0,ANFO,FL}
  decoupledDeck: {3,1.5,PKG75mm,FL}


OVERLAP PATTERN (DECOUPLED DECKS)
----------------------------------
For variable package stacking, append overlap syntax:

  {idx,length,product,FLAG,overlap:base=3;base-1=2;n=1;top=2}

  base     Packages at the base (bottom) position
  base-1   Packages one position above base
  n        Default packages for all middle positions
  top      Packages at the top position


SPACER DECKS
------------
Format:  {idx,product}

  No length field -- length is derived from product.lengthMm / 1000.

  idx      Deck order position (1-based)
  product  Spacer product name

Example:

  spacerDeck: {3,GB230MM};{5,GB230MM}


PRIMER ENTRIES
--------------
Format:  {idx,depth,Det{name},HE{name}}

  Multiple entries separated by ;

  idx       Primer number (1-based)
  depth     Depth from collar in metres, or fx: formula
  Det{name} Detonator product name (inside Det{...})
  HE{name}  Booster product name (inside HE{...}). Use HE{} for no booster.

Examples:

  Single primer:
    {1,fx:chargeBase-0.3,Det{GENERIC-MS},HE{BS400G}}

  Two primers targeting specific charge decks (index = deck position):
    {1,fx:chargeBase[8]-0.3,Det{GENERIC-MS},HE{BS400G}};{2,fx:chargeBase[4]-0.3,Det{GENERIC-MS},HE{BS400G}}

  Literal depth:
    {1,8.5,Det{GENERIC-E},HE{BS400G}}

  Detonating cord (no booster):
    {1,fx:chargeBase-0.3,Det{10GCORD},HE{}}


================================================================================
  DECK ORDER AND HOLE LAYOUT
================================================================================

Decks are ordered from collar (top) to toe (bottom) using the idx field:

  Collar (0m)
    +-------------------+
    |  Deck idx=1        |  <- e.g. Stemming (INERT, FL)
    +-------------------+
    |  Deck idx=2        |  <- e.g. ANFO (COUPLED, fill)
    +-------------------+
    |  Deck idx=3        |  <- e.g. Gas Bag (SPACER)
    +-------------------+
    |  Deck idx=4        |  <- e.g. ANFO (COUPLED, 2.0m, FL)
    +-------------------+
    |  Deck idx=5        |  <- e.g. Stemming (INERT, fill)
    +-------------------+
  Toe (holeLength)

The idx values do NOT need to be sequential (gaps allowed), but must be
unique across all four deck columns. The engine sorts by idx for order.


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

Indexed Variables (use deck position number from section view):

  chargeBase[N]     Base depth of the charge deck at position N
  chargeTop[N]      Top depth of the charge deck at position N
  chargeLength[N]   Length of the charge deck at position N
  e.g. if COUPLED is at deck position 4, use chargeBase[4]

Math Functions:

  Math.min(a, b)   Math.max(a, b)   Math.abs(x)
  Math.sqrt(x)     Math.PI          Math.round(x)

Custom Functions:

  massLength(kg, density)          Length (m) for a given mass at holeDiameter
                                   density in g/cc  e.g. massLength(50, 0.85)
  massLength(kg, "ProductName")    Length (m) using product density lookup
                                   e.g. massLength(50, "ANFO")

  How massLength works:
    massLength = massKg / (density * 1000 * PI * (holeDiameter/2000)^2)
    Result varies per-hole because holeDiameter comes from hole data.

Primer Depth Examples:

  Formula                                           Description
  ------------------------------------------------  -----------------------------------
  fx:chargeBase - 0.3                               Primer 0.3m above deepest charge base
  fx:chargeBase[4] - 0.3                            Primer 0.3m above charge at deck position 4
  fx:chargeBase[8] - 0.6                            Primer 0.6m above charge at deck position 8
  fx:holeLength * 0.9                               Primer at 90% of total hole
  fx:Math.max(chargeTop + 1, chargeBase - 0.5)      At least 1m below charge top

Deck Length Examples:

  fx:holeLength - 4                                 Deck = hole length minus 4m
  fx:holeLength * 0.5                               Deck = 50% of hole length
  fx:holeLength - stemLength - 2                    Fills hole minus stem and 2m
  fx:Math.min(holeLength * 0.3, 5)                  30% of hole capped at 5m max

Mass-Aware Positioning Examples:

  fx:chargeTop[4] - massLength(50, 0.85)            Place above charge at position 4, 50kg ANFO
  fx:chargeTop[4] - massLength(50, "ANFO")          Same, using product name lookup
  fx:holeLength - 2 - massLength(30, 1.2)           Above a 2m toe charge, 30kg emulsion
  fx:chargeBase[3] - massLength(25, "GENERIC4060")  25kg ending at charge deck position 3 base

  Scenario: 2m fixed deck at position 4 (toe), 50kg mass deck at position 3 above it:
    Deck [3]: topDepth = fx:chargeTop[4] - massLength(50, 1.2)
    Deck [4]: fixed 2.0m at the toe

    In a 165mm hole: massLength(50, 1.2) = 1.95m
    In a 250mm hole: massLength(50, 1.2) = 0.85m
    Mass stays 50kg; length adapts to hole diameter.


================================================================================
  SCALING FLAGS AND HOLE APPLICATION
================================================================================

When a config is applied to holes of different lengths, scaling flags control
each deck's behaviour:

  Proportional (default): Deck length scales proportionally with hole length
  Fixed Length (FL):       Keeps exact metre length (e.g. 3.5m stemming)
  Fixed Mass (FM):        Recalculates length to maintain mass at new diameter

Two-pass layout algorithm:
  Pass 1: Fixed-length and fixed-mass decks claim their space first
  Pass 2: Remaining space is distributed among proportional decks

The section view shows badges: F (blue) for fixed-length, M (orange) for
fixed-mass. No badge for proportional (default).


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
  WORKFLOW
================================================================================

EXPORT:
  1. Charging tab > Export Config (or File > Export Charging Config)
  2. Downloads kirra-charging-config.zip
  3. Open chargeConfigs.csv in Excel/Sheets/text editor
  4. Each column is a config -- add columns for new configs

IMPORT:
  1. Save CSV, re-ZIP all files
  2. Charging tab > Import Config (or File > Import Charging Config)
  3. Select the ZIP file
  4. Products and configs are loaded into memory

DECK BUILDER -- SAVE AS RULE:
  1. Build a charging design in the Deck Builder
  2. Click Save as Rule
  3. Set scaling mode per deck (Proportional, Fixed Length, Fixed Mass)
  4. Edit primer depth formulas (auto-generated using deck position index)
  5. The saved rule appears in the config list and exports

ROUND-TRIP VERIFICATION:
  1. Export config
  2. Re-import the same ZIP without changes
  3. Apply rules to holes
  4. Verify identical deck layouts
