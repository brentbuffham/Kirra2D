================================================================================
  CHARGE CONFIGURATION CSV FORMAT REFERENCE
================================================================================

OVERVIEW
--------
Kirra exports and imports charge configurations as a ZIP file containing CSV
files. All charge designs use deck arrays -- there are no flat-field shortcuts.
Every config is a template of typed deck entries plus primer entries, applied
per-hole by the unified template engine.

Each deck defines its position using top and base depth values (from collar),
which can be fixed numbers or fx: formulas. Decks can reference each other
using deckBase[N]/deckTop[N] indexed variables.


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
   1  configCode           code       Rule code identifier (e.g. STNDFS, MULTDEC)
   2  configName           text       Human-readable rule name
   3  description          text       Free-text description
   4  primerInterval       number     Interval between primers (metres)
   5  wetHoleSwap          bool       Swap product for wet holes
   6  wetHoleProduct       product    Wet hole replacement product name
   7  inertDeck            deck       Inert deck template entries (brace notation)
   8  coupledDeck          deck       Coupled explosive deck entries
   9  decoupledDeck        deck       Decoupled explosive deck entries
  10  spacerDeck           deck       Spacer deck entries
  11  primer               primer     Primer template entries (brace notation)


================================================================================
  TYPED DECK COLUMN SYNTAX
================================================================================

INERT, COUPLED, AND DECOUPLED DECKS
------------------------------------
Format:  {idx,top,base,product} or {idx,top,base,product,FLAG}

  Multiple entries separated by |

  idx      Integer deck order from collar (1-based). Deck 1 is at the top.
  top      Depth from collar to deck top (number or fx:formula)
  base     Depth from collar to deck base (number or fx:formula)
  product  Product name, must match a name in products.csv
  FLAG     Optional scaling flag -- see Scaling Flags below

With mass field:  {idx,top,base,mass,product} or {idx,top,base,mass,product,FLAG}

  mass     Mass field:
           number (e.g. 50)  = target kg, derive missing top or base from mass length
           "mass"            = calculate mass from (base - top) for display

  Parse rule: If 4th field is numeric or "mass", it is the mass field and
  product is the 5th field. Otherwise 4th field is the product name.

Top/Base Values:

  Syntax              Description
  ------------------  -------------------------------------------
  0                   Fixed depth at collar (0m)
  3.5                 Fixed depth at 3.5m from collar
  fx:deckBase[1]      Start where deck 1 ends (formula)
  fx:holeLength       At the toe of the hole (formula)
  fx:holeLength*0.5   At 50% of hole length (formula)

Scaling Flags:

  Flag    Name              Behaviour
  ----    ----------------  ------------------------------------------------
  FL      Fixed Length       Keeps exact top/base positions regardless of hole
  FM      Fixed Mass         Recalculates length from mass at new diameter
  VR      Variable           Re-evaluates top/base formulas per hole
  PR      Proportional       Scales positions proportionally with hole length

  When no flag is specified, the deck defaults to proportional scaling.
  Formula decks (fx: top or base) are automatically set to Variable.

Examples:

  inertDeck:     {1,0,3.5,Stemming,FL}|{5,fx:deckBase[4],fx:holeLength,Stemming,VR}
  coupledDeck:   {2,fx:deckBase[1],fx:holeLength,ANFO,VR}|{4,fx:deckBase[3],fx:deckBase[3]+2.0,ANFO,FL}
  decoupledDeck: {3,fx:deckBase[2],fx:deckBase[2]+1.5,PKG75mm,FL}

  With mass: {2,,fx:holeLength,50,ANFO,FM}  (top derived from 50kg mass length)
  Mass info: {2,2.5,fx:holeLength,mass,ANFO}  (mass calculated from top/base)


OVERLAP PATTERN (DECOUPLED DECKS)
----------------------------------
For variable package stacking, append overlap syntax:

  {idx,top,base,product,FLAG,overlap:base=3|base-1=2|n=1|top=2}

  base     Packages at the base (bottom) position
  base-1   Packages one position above base
  n        Default packages for all middle positions
  top      Packages at the top position


SWAP CONDITIONS (PER-DECK PRODUCT SWAP)
-----------------------------------------
Swap rules are appended after the scaling flag/overlap using swap: prefix.
When the hole matches a condition, the deck product is replaced.

  {idx,top,base,product,VR,swap:w{WR-ANFO}|r{Emulsion}|t{Emulsion,C>50}}

Condition codes:
  w          Wet hole
  d          Damp hole
  r          Reactive ground
  t          Temperature threshold (with C/F and operator)
  x1..x20    Future user-defined conditions

Temperature threshold format:  [C|F][>|<|>=|<=]number
  t{Emulsion,C>50}      Celsius greater than 50
  t{Emulsion,F>=122}    Fahrenheit greater than or equal to 122
  t{Emulsion,C<30}      Celsius less than 30

Multiple rules separated by | -- first match wins.

Per-hole override: blast holes have a perHoleCondition field that uses the
same syntax. Per-hole override takes priority over deck-level swap rules.

Spacer with swap:
  {idx,top,product,swap:r{ALT-SPACER}}


SPACER DECKS
------------
Format:  {idx,top,product}

  No base field -- base is derived from top + product.lengthMm / 1000.

  idx      Deck order position (1-based)
  top      Depth from collar to spacer position (number or fx:formula)
  product  Spacer product name

Example:

  spacerDeck: {3,fx:deckBase[2],GB230MM}|{5,fx:deckBase[4],GB230MM}


PRIMER ENTRIES
--------------
Format:  {idx,depth,Det{name},HE{name}}

  Multiple entries separated by |

  idx       Primer number (1-based)
  depth     Depth from collar in metres, or fx: formula
  Det{name} Detonator product name (inside Det{...})
  HE{name}  Booster product name (inside HE{...}). Use HE{} for no booster.

Examples:

  Single primer:
    {1,fx:chargeBase-0.3,Det{GENERIC-MS},HE{BS400G}}

  Two primers targeting specific charge decks (index = deck position):
    {1,fx:chargeBase[8]-0.3,Det{GENERIC-MS},HE{BS400G}}|{2,fx:chargeBase[4]-0.3,Det{GENERIC-MS},HE{BS400G}}

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
    |  Deck idx=1        |  <- e.g. Stemming (INERT, top=0, base=3.5)
    +-------------------+
    |  Deck idx=2        |  <- e.g. ANFO (COUPLED, top=fx:deckBase[1], base=fx:holeLength)
    +-------------------+
    |  Deck idx=3        |  <- e.g. Gas Bag (SPACER, top=fx:deckBase[2])
    +-------------------+
    |  Deck idx=4        |  <- e.g. ANFO (COUPLED, top=fx:deckBase[3])
    +-------------------+
    |  Deck idx=5        |  <- e.g. Stemming (INERT, top=fx:deckBase[4])
    +-------------------+
  Toe (holeLength)

The idx values do NOT need to be sequential (gaps allowed), but must be
unique across all four deck columns. The engine sorts by idx for order.

Each deck's top/base formulas are resolved sequentially by idx. This means
deckBase[1] is available when resolving deck 2, deckBase[2] when resolving
deck 3, etc. Circular references are naturally prevented.


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

Indexed Deck Variables (ALL deck types):

  deckBase[N]       Base depth of any deck at position N
  deckTop[N]        Top depth of any deck at position N
  deckLength[N]     Length of any deck at position N
  e.g. deckBase[1] = base of stemming at deck 1

  Available during sequential resolution: deckBase[M] available when M < current

Indexed Charge Variables (COUPLED/DECOUPLED only, for primer formulas):

  chargeBase[N]     Base depth of the charge deck at position N
  chargeTop[N]      Top depth of the charge deck at position N
  chargeLength[N]   Length of the charge deck at position N
  e.g. if COUPLED is at deck position 4, use chargeBase[4]

Math Functions:

  Math.min(a, b)   Math.max(a, b)   Math.abs(x)
  Math.sqrt(x)     Math.PI          Math.round(x)

Conditional Operators:

  condition ? valueIfTrue : valueIfFalse    (JavaScript ternary operator)

  Comparison operators: < > <= >= == !=
  Logical operators: && (AND), || (OR), ! (NOT)

  Examples:
    holeLength < 5 ? 2.0 : 3.0                   If hole < 5m use 2.0m, else 3.0m
    benchHeight > 8 && holeDiameter > 150 ? m:75 : m:50   75kg if bench >8m AND dia >150mm

Custom Functions:

  massLength(kg, density)          Length (m) for a given mass at holeDiameter
                                   density in g/cc  e.g. massLength(50, 0.85)
  massLength(kg, "ProductName")    Length (m) using product density lookup
                                   e.g. massLength(50, "ANFO")

  How massLength works:
    massLength = massKg / (density * 1000 * PI * (holeDiameter/2000)^2)
    Result varies per-hole because holeDiameter comes from hole data.

Deck Top/Base Examples:

  Formula                                           Description
  ------------------------------------------------  -----------------------------------
  top=0, base=3.5                                   Fixed 3.5m stemming from collar
  top=fx:deckBase[1], base=fx:holeLength            Charge from end of deck 1 to toe
  top=0, base=fx:(holeLength<3?holeLength*0.65:2.5) Variable stem with ternary logic
  top=fx:deckBase[1], base=fx:deckBase[1]+2.0       Fixed 2m deck starting after deck 1

Primer Depth Examples:

  Formula                                           Description
  ------------------------------------------------  -----------------------------------
  fx:chargeBase - 0.3                               Primer 0.3m above deepest charge base
  fx:chargeBase[4] - 0.3                            Primer 0.3m above charge at deck position 4
  fx:chargeBase[8] - 0.6                            Primer 0.6m above charge at deck position 8
  fx:holeLength * 0.9                               Primer at 90% of total hole
  fx:Math.max(chargeTop + 1, chargeBase - 0.5)      At least 1m below charge top

Conditional Examples (Ternary Operators):

  fx:holeLength < 5 ? holeLength * 0.4 : 2.0                           If hole < 5m use 40%, else fixed 2m
  fx:holeLength < 3 ? holeLength * 0.5 : holeLength < 4 ? holeLength * 0.4 : holeLength * 0.3
                                                                       Tiered stem: <3m=50%, <4m=40%, else 30%
  fx:holeDiameter < 150 ? m:30 : holeDiameter < 200 ? m:50 : m:75     Mass by diameter: <150mm=30kg, <200mm=50kg, else 75kg
  fx:benchHeight < 6 ? chargeBase - 0.2 : benchHeight < 10 ? chargeBase - 0.4 : chargeBase - 0.6
                                                                       Primer offset by bench height
  fx:subdrillLength > 1 ? (holeLength - subdrillLength) * 0.8 : holeLength * 0.7
                                                                       Charge strategy adapts to subdrill

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

  Variable (VR):       Re-evaluates top/base formulas with new hole properties
  Fixed Length (FL):    Keeps exact top/base positions unchanged
  Fixed Mass (FM):     Recalculates length to maintain mass at new diameter
  Proportional (PR):   Scales top/base proportionally with hole length (default)

Formula decks (fx: in top or base) are automatically set to Variable mode.

The section view shows badges: F (blue) for fixed-length, M (orange) for
fixed-mass, VR (green) for variable. No badge for proportional (default).


================================================================================
  MASS FIELD MODES
================================================================================

The mass field in deck entries controls mass-aware positioning:

  Value     Meaning                Engine Behaviour
  --------  ---------------------  ------------------------------------------------
  (empty)   No mass tracking       Use top and base as given
  50        Target 50 kg           If top empty: top = base - massLength(50, density)
                                   If base empty: base = top + massLength(50, density)
                                   If both given: mass is informational only
  "mass"    Calculate from length  mass = (base - top) * PI * (diam/2000)^2 * density * 1000

Mass varies in length but stays constant in kg across different hole diameters.


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
  3. Edit top/base depth formulas per deck (e.g. fx:deckBase[1], fx:holeLength)
  4. Edit primer depth formulas (auto-generated using deck position index)
  5. The saved rule appears in the config list and exports

ROUND-TRIP VERIFICATION:
  1. Export config
  2. Re-import the same ZIP without changes
  3. Apply rules to holes
  4. Verify identical deck layouts
