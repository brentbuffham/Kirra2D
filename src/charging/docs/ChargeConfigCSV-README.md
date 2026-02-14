# Charge Configuration CSV Format Reference

## Overview

Kirra exports and imports charge configurations as a **ZIP file** containing CSV files.
All charge designs use **deck arrays** — there are no flat-field shortcuts. Every config is a template of typed deck entries plus primer entries, applied per-hole by the unified template engine.

---

## File Structure

```
kirra-charging-config.zip
├── products.csv          Product definitions (explosives, stemming, detonators, spacers)
├── chargeConfigs.csv     Charge rule configurations (transposed: rows=fields, columns=configs)
└── README.txt            Quick-start instructions
```

---

## chargeConfigs.csv — Transposed Format

### Layout

Row 1 is the header: `Type,Description,Field,[1],[2],[3],...`

Each subsequent row contains one field. Columns 4+ hold config values:

```
Type,Description,Field,[1],[2],[3]
code,Charge config code,configCode,STNDFS,AIRDEC,MULTDEC
text,Human-readable config name,configName,Standard Single Deck,Air Deck,Multi Deck
text,Description,description,Single deck,Gas bag air deck,Custom layout
...
```

The first 3 columns (`Type`, `Description`, `Field`) are metadata — do not change these. Add or remove **columns** to add or remove configurations.

### Field Reference

| # | Type | Field | Description |
|---|------|-------|-------------|
| 1 | code | `configCode` | Rule code identifier (e.g. `STNDFS`, `AIRDEC`, `MULTDEC`) |
| 2 | text | `configName` | Human-readable rule name |
| 3 | text | `description` | Free-text description |
| 4 | number | `primerInterval` | Interval between primers in long charges (metres) |
| 5 | bool | `wetHoleSwap` | Swap product for wet holes |
| 6 | product | `wetHoleProduct` | Wet hole replacement product name |
| 7 | deck | `inertDeck` | Inert deck entries (brace notation) |
| 8 | deck | `coupledDeck` | Coupled explosive deck entries (brace notation) |
| 9 | deck | `decoupledDeck` | Decoupled explosive deck entries (brace notation) |
| 10 | deck | `spacerDeck` | Spacer deck entries (brace notation) |
| 11 | primer | `primer` | Primer entries (brace notation) |

---

## Typed Deck Field Syntax

### Inert, Coupled, and Decoupled Decks

Format: `{idx,length,product}` or `{idx,length,product,FLAG}` — multiple entries separated by `;`

| Field | Description |
|-------|-------------|
| `idx` | Integer deck order position from collar (1-based). Deck 1 is at the top (collar), higher numbers go deeper. |
| `length` | Deck length — see Length Modes below |
| `product` | Product name, must match a name in `products.csv` |
| `FLAG` | Optional scaling flag — see Scaling Flags below |

**Length Modes:**

| Syntax | Mode | Description |
|--------|------|-------------|
| `2.0` | Fixed | Exact length in metres |
| `fx:holeLength-4` | Formula | Calculated from hole properties at apply-time |
| `m:50` | Mass | 50 kg of product — length calculated from density and hole diameter |
| `product` | Product | Length derived from product.lengthMm (for spacer-like entries) |

**Scaling Flags:**

| Flag | Name | Behaviour when applied to different hole lengths |
|------|------|--------------------------------------------------|
| `FL` | Fixed Length | Deck keeps its exact metre length regardless of hole length |
| `FM` | Fixed Mass | Deck recalculates length from mass at the new hole diameter |
| `VR` | Variable | Deck re-evaluates its formula with the current hole's properties (auto-set for formula decks) |
| `PR` | Proportional | Deck scales proportionally with hole length (default) |

When no flag is specified, the deck defaults to **proportional** scaling. Formula decks (`fx:...` length mode) are automatically set to **Variable** scaling so their formula is re-evaluated for each hole rather than being proportionally stretched.

**Examples:**

```
inertDeck:     {1,3.5,Stemming,FL};{5,fx:holeLength - 3.5,Stemming,VR}
coupledDeck:   {2,fx:(holeLength<3.5)?(holeLength*0.3):3.5,ANFO,VR};{4,2.0,ANFO,FL}
decoupledDeck: {3,1.5,PKG75mm,FL}
```

### Overlap Pattern (Decoupled Decks)

For DECOUPLED decks with variable package stacking, an overlap pattern can be appended:

```
{idx,length,product,FLAG,overlap:base=3;base-1=2;n=1;top=2}
```

| Key | Description |
|-----|-------------|
| `base` | Number of packages at the base (bottom) position |
| `base-1` | Number of packages one position above base |
| `n` | Default number of packages for all middle positions |
| `top` | Number of packages at the top position |

### Spacer Decks

Format: `{idx,product}` — no length field (derived from product)

| Field | Description |
|-------|-------------|
| `idx` | Deck order position (1-based) |
| `product` | Spacer product name — length is `product.lengthMm / 1000` |

**Example:**

```
spacerDeck: {3,GB230MM};{5,GB230MM}
```

### Primer Entries

Format: `{idx,depth,Det{name},HE{name}}` — multiple entries separated by `;`

| Field | Description |
|-------|-------------|
| `idx` | Primer number (1-based) |
| `depth` | Depth from collar in metres, or `fx:` formula (supports indexed variables) |
| `Det{name}` | Detonator product name (inside `Det{...}`) |
| `HE{name}` | Booster / high-explosive product name (inside `HE{...}`). Use `HE{}` for no booster. |

**Examples:**

```
Single primer:
  {1,fx:chargeBase-0.3,Det{GENERIC-MS},HE{BS400G}}

Two primers targeting specific charge decks (index = deck position):
  {1,fx:chargeBase[8]-0.3,Det{GENERIC-MS},HE{BS400G}};{2,fx:chargeBase[4]-0.3,Det{GENERIC-MS},HE{BS400G}}

Literal depth:
  {1,8.5,Det{GENERIC-E},HE{BS400G}}

Detonating cord (no booster):
  {1,fx:chargeBase-0.3,Det{10GCORD},HE{}}
```

---

## Deck Order and Hole Layout

Decks are ordered from collar (top) to toe (bottom) using the `idx` field:

```
Collar (0m)
  ┌─────────────────┐
  │  Deck idx=1      │  ← e.g. Stemming (INERT, FL)
  ├─────────────────┤
  │  Deck idx=2      │  ← e.g. ANFO (COUPLED, formula)
  ├─────────────────┤
  │  Deck idx=3      │  ← e.g. Gas Bag (SPACER)
  ├─────────────────┤
  │  Deck idx=4      │  ← e.g. ANFO (COUPLED, 2.0m, FL)
  ├─────────────────┤
  │  Deck idx=5      │  ← e.g. Stemming (INERT, formula)
  └─────────────────┘
Toe (holeLength)
```

The `idx` values do NOT need to be sequential (gaps are allowed), but they must be unique across all four deck fields. The engine sorts all entries by `idx` to determine the collar-to-toe order.

---

## Formula Reference

Formulas are prefixed with `fx:` to avoid triggering spreadsheet formula parsing (Excel interprets `=` as a formula).

### Available Variables (Unindexed)

Unindexed variables refer to the **deepest** charge deck:

| Variable | Description |
|----------|-------------|
| `holeLength` | Total hole length in metres (collar to toe) |
| `chargeLength` | Length of the deepest charge deck (metres) |
| `chargeTop` | Depth from collar to top of deepest charge deck (m) |
| `chargeBase` | Depth from collar to bottom of deepest charge deck (m) |
| `stemLength` | Depth to top of first charge deck (m) |
| `holeDiameter` | Hole diameter in millimetres |
| `benchHeight` | Bench height from hole data (m) |
| `subdrillLength` | Subdrill length from hole data (m) |

### Indexed Charge Variables

For **multi-deck** configs, indexed variables target a specific charge deck (COUPLED or DECOUPLED) by its **deck position number** — the same number shown in the section view labels (e.g. `COUPLED[4]`):

| Variable | Description |
|----------|-------------|
| `chargeBase[N]` | Base depth of the charge deck at position N |
| `chargeTop[N]` | Top depth of the charge deck at position N |
| `chargeLength[N]` | Length of the charge deck at position N |

The index `N` is the 1-based deck array position, matching the `[N]` shown in the section view. For example, if your layout is `INERT[1], INERT[2], COUPLED[3], COUPLED[4]`, use `chargeBase[3]` and `chargeBase[4]` to target those charge decks.

### Supported Math Functions

`Math.min(a, b)` `Math.max(a, b)` `Math.abs(x)` `Math.sqrt(x)` `Math.PI` `Math.round(x)`

### Conditional Operators

`condition ? valueIfTrue : valueIfFalse` (JavaScript ternary operator)

Comparison operators: `<` `>` `<=` `>=` `==` `!=`

Logical operators: `&&` (AND), `||` (OR), `!` (NOT)

**Examples:**
- `holeLength < 5 ? 2.0 : 3.0` → If hole < 5m use 2.0m, else 3.0m
- `benchHeight > 8 && holeDiameter > 150 ? m:75 : m:50` → 75kg if bench >8m AND diameter >150mm

### Custom Functions

| Function | Description |
|----------|-------------|
| `massLength(kg, density)` | Length in metres for a given mass (kg) at the hole's diameter. Density in g/cc. |
| `massLength(kg, "ProductName")` | Same, but looks up density from the loaded product by name. |

**How `massLength` works:**

```
massLength(massKg, density) = massKg / (density * 1000 * PI * (holeDiameter/2000)^2)
```

The result varies per-hole because `holeDiameter` comes from the hole data. This makes it possible to write formulas that position decks relative to mass-derived lengths — something that can't be done with a fixed number.

### Formula Examples — Primer Depth

| Formula | Description |
|---------|-------------|
| `fx:chargeBase - 0.3` | Primer 0.3m above deepest charge deck base |
| `fx:chargeBase[4] - 0.3` | Primer 0.3m above charge deck at position 4 |
| `fx:chargeBase[8] - 0.6` | Primer 0.6m above charge deck at position 8 |
| `fx:holeLength * 0.9` | Primer at 90% of total hole |
| `fx:Math.max(chargeTop + 1, chargeBase - 0.5)` | At least 1m below charge top |

### Formula Examples — Deck Length

| Formula | Description |
|---------|-------------|
| `fx:holeLength - 4` | Deck length = hole length minus 4m |
| `fx:holeLength * 0.5` | Deck length = 50% of hole length |
| `fx:holeLength - stemLength - 2` | Deck fills hole minus stem and 2m subdrill |
| `fx:Math.min(holeLength * 0.3, 5)` | 30% of hole capped at 5m max |

### Formula Examples — Conditional (Ternary) Expressions

Kirra supports JavaScript ternary operators for conditional logic in formulas. Syntax: `condition ? valueIfTrue : valueIfFalse`

| Example # | Function (fx:) | Description | Example Result |
|-----------|----------------|-------------|----------------|
| 1 | `fx:holeLength < 5 ? holeLength * 0.4 : 2.0` | If hole < 5m use 40%, else use fixed 2.0m | 4m hole → 1.6m<br>8m hole → 2.0m |
| 2 | `fx:holeLength < 3 ? holeLength * 0.5 : holeLength < 4 ? holeLength * 0.4 : holeLength * 0.3` | Tiered stem: <3m=50%, <4m=40%, else 30% | 2.5m → 1.25m<br>3.5m → 1.4m<br>6m → 1.8m |
| 3 | `fx:holeDiameter < 150 ? m:30 : holeDiameter < 200 ? m:50 : m:75` | Mass by diameter: <150mm=30kg, <200mm=50kg, else 75kg | 115mm → 30kg<br>165mm → 50kg<br>250mm → 75kg |
| 4 | `fx:benchHeight < 6 ? chargeBase - 0.2 : benchHeight < 10 ? chargeBase - 0.4 : chargeBase - 0.6` | Primer offset by bench: <6m=0.2m, <10m=0.4m, else 0.6m | 5m bench → base-0.2m<br>8m bench → base-0.4m<br>12m bench → base-0.6m |
| 5 | `fx:subdrillLength > 1 ? (holeLength - subdrillLength) * 0.8 : holeLength * 0.7` | If subdrill >1m charge to 80% above grade, else 70% of hole | 10m hole, 2m sub → 6.4m<br>10m hole, 0.5m sub → 7m |

**Nested Ternary Readability Tip:**

Complex nested conditions can be made clearer with parentheses:

```
fx:(holeLength < 3) ? (holeLength * 0.5) : (holeLength < 4) ? (holeLength * 0.4) : (holeLength * 0.3)
```

**Combining Conditionals with Math Functions:**

```
fx:holeLength < 5 ? Math.min(holeLength * 0.4, 2.5) : Math.max(holeLength * 0.3, 2.0)
```
Short holes: 40% capped at 2.5m | Long holes: 30% with 2m minimum

---

### Formula Examples — Mass-Aware Positioning

These formulas use `massLength()` to position decks relative to mass-derived lengths, so the layout adapts when hole diameter changes:

| Formula | Description |
|---------|-------------|
| `fx:chargeTop[4] - massLength(50, 0.85)` | Place deck above charge at position 4, 50kg ANFO (0.85 g/cc) |
| `fx:chargeTop[4] - massLength(50, "ANFO")` | Same, using product name lookup for density |
| `fx:holeLength - 2 - massLength(30, 1.2)` | Position above a 2m toe charge, with 30kg emulsion |
| `fx:chargeBase[3] - massLength(25, "GENERIC4060")` | Place 25kg ending at charge deck position 3 base |

**Scenario:** You have a 2m fixed deck at position 4 (toe) and want to place a 50kg mass deck at position 3 directly above it:

```
Deck [3] (50kg emulsion):  topDepth = fx:chargeTop[4] - massLength(50, 1.2)
Deck [4] (2m ANFO):        fixed 2.0m at the toe
```

When applied to a 165mm hole: `massLength(50, 1.2) = 50 / (1.2 × 1000 × π × 0.0825²) = 1.95m`
When applied to a 250mm hole: `massLength(50, 1.2) = 50 / (1.2 × 1000 × π × 0.125²) = 0.85m`

The mass stays constant at 50kg; the length adapts to the hole diameter.

---

## Mass-Based Length Mode

The `m:` prefix calculates deck length from a target mass in kilograms.

**Formula used internally:**

```
length = massKg / (density * 1000 * PI * (diameter/2000)^2)
```

Where:
- `density` = product density in g/cc (from products.csv)
- `diameter` = hole diameter in mm (from blast hole data)
- Result varies per-hole based on diameter

**Example:** `m:50` with ANFO (0.85 g/cc) in a 115mm hole:

```
area   = PI * (0.0575)^2 = 0.01039 m^2
kg/m   = 0.85 * 1000 * 0.01039 = 8.83 kg/m
length = 50 / 8.83 = 5.66 m
```

In a 250mm hole the same 50kg yields only 1.03m — the mass is constant, the length adapts.

---

## Scaling Flags and Hole Application

When a charge config is applied to holes of different lengths, each deck's scaling flag controls its behaviour:

- **Proportional** (default): Deck length scales proportionally with hole length
- **Fixed Length** (`FL`): Deck keeps its exact metre length. Stemming stays 3.5m whether the hole is 8m or 15m.
- **Fixed Mass** (`FM`): Deck recalculates its length to maintain the same mass at the new hole diameter.
- **Variable** (`VR`): Deck re-evaluates its formula expression using the current hole's properties (holeLength, holeDiameter, benchHeight, subdrillLength). Formula decks are automatically set to Variable mode so the formula result adapts per hole instead of being proportionally stretched.

The template engine uses a two-pass layout:
1. **Pass 1**: Fixed-length, fixed-mass, and variable decks claim their space first (variable decks re-evaluate their formula)
2. **Pass 2**: Remaining space is distributed among proportional decks

The section view shows badges: **F** (blue) for fixed-length, **M** (orange) for fixed-mass, **VR** (green) for variable.

---

## Workflow

### Export

1. **Charging tab** > **Export Config** (or File > Export Charging Config)
2. Downloads `kirra-charging-config.zip`
3. Open `chargeConfigs.csv` in Excel/Sheets/text editor
4. Each column after `Type,Description,Field` is a config — add columns for new configs

### Import

1. Save CSV, re-ZIP all files
2. **Charging tab** > **Import Config** (or File > Import Charging Config)
3. Select the ZIP file
4. Products and configs are loaded into memory

### Deck Builder — Save as Rule

1. Build a charging design in the Deck Builder
2. Click **Save as Rule**
3. Set scaling mode per deck (Proportional, Fixed Length, Fixed Mass)
4. Edit primer depth formulas — indexed formulas like `fx:chargeBase[4] - 0.3` are auto-generated using deck position
5. The saved rule appears in the config list and is included in exports

### Round-trip Verification

1. Export config
2. Re-import the same ZIP without changes
3. Apply rules to holes
4. Verify identical deck layouts

---

## 20 Useful Formula Examples for Decks and Charges

This table provides practical formula examples for common charging scenarios. All formulas use the `fx:` prefix to avoid spreadsheet formula interpretation.

| # | Scenario | Formula | Description | Use Case |
|---|----------|---------|-------------|----------|
| 1 | **Stem Length as % of Hole** | `fx:holeLength * 0.3` | 30% of total hole length | Variable stem matching hole depth |
| 2 | **Fixed Stem Minus Charge** | `fx:holeLength - 8` | Hole length minus 8m charge | Leave 8m for explosives |
| 3 | **Charge to 2m Above Toe** | `fx:holeLength - 2` | Fill to 2m from bottom | Bottom charge with toe gap |
| 4 | **Primer at 95% Depth** | `fx:holeLength * 0.95` | Primer at 95% of hole depth | Deep primer positioning |
| 5 | **Primer Above Charge Base** | `fx:chargeBase - 0.3` | 0.3m above deepest charge | Standard primer offset |
| 6 | **Primer in Multi-Deck** | `fx:chargeBase[4] - 0.3` | 0.3m above deck position 4 | Target specific charge deck |
| 7 | **Mass-Based Deck (50kg)** | `m:50` | 50kg at hole diameter | Fixed mass, variable length |
| 8 | **Mass-Based Deck (30kg)** | `m:30` | 30kg at hole diameter | Smaller mass deck |
| 9 | **Capped Proportional Deck** | `fx:Math.min(holeLength * 0.4, 6)` | 40% of hole, max 6m | Proportional with upper limit |
| 10 | **Min/Max Charge Length** | `fx:Math.max(holeLength - 4, 2)` | Hole minus 4m, minimum 2m | Ensure minimum charge |
| 11 | **Subdrill Charge Length** | `fx:subdrillLength - 0.5` | Subdrill minus 0.5m | Fill subdrill zone |
| 12 | **Bench-Based Charge** | `fx:benchHeight - 1` | Bench height minus 1m | Charge to near-grade |
| 13 | **Dynamic Deck Split** | `fx:(holeLength - 4) * 0.5` | Half of available charge zone | Even split after stem |
| 14 | **Mass Above Charge Deck** | `fx:chargeTop[4] - massLength(50, 0.85)` | 50kg ANFO above position 4 | Mass-aware spacing |
| 15 | **Mass by Product Name** | `fx:chargeTop[4] - massLength(50, "ANFO")` | 50kg using product lookup | Product density auto-lookup |
| 16 | **Conditional Stem Length** | `fx:holeLength < 5 ? holeLength * 0.4 : 2.0` | <5m use 40%, else fixed 2m | Short hole adaptive stem |
| 17 | **Tiered Stem Percentage** | `fx:holeLength < 3 ? holeLength * 0.5 : holeLength < 4 ? holeLength * 0.4 : holeLength * 0.3` | Multi-tier: 50%/40%/30% | Variable stem by depth |
| 18 | **Diameter-Based Mass** | `fx:holeDiameter < 150 ? m:30 : holeDiameter < 200 ? m:50 : m:75` | Mass scales with diameter | Adaptive charge mass |
| 19 | **Bench-Dependent Primer** | `fx:benchHeight < 6 ? chargeBase - 0.2 : benchHeight < 10 ? chargeBase - 0.4 : chargeBase - 0.6` | Primer offset by bench height | Safety depth scaling |
| 20 | **Subdrill Conditional** | `fx:subdrillLength > 1 ? (holeLength - subdrillLength) * 0.8 : holeLength * 0.7` | Charge strategy by subdrill | Adapt to toe conditions |

### Formula Categories

#### **Length Formulas** (Deck Sizing)
- Formulas 1-3: Basic proportional and fixed-offset lengths
- Formulas 9-10: Capped and bounded lengths using Math functions
- Formulas 12-13: Zone-based calculations using hole properties

#### **Mass Formulas** (Fixed Mass Decks)
- Formulas 7-8: Direct mass specification with `m:` prefix
- Formulas 14-15: Mass-aware positioning using `massLength()` function
- Mass varies in length but stays constant in kg across different hole diameters

#### **Primer Depth Formulas** (Detonator Positioning)
- Formulas 4-6: Depth-based primer placement (% or offset from charge)
- Formula 19: Bench-dependent primer positioning with tiered offsets

#### **Conditional Formulas** (Ternary Operators)
- Formulas 16-20: Use ternary operators for adaptive charging logic
- Support hole length, diameter, bench height, and subdrill conditions
- Enable multi-tier strategies that respond to hole geometry

#### **Multi-Deck Formulas** (Indexed Variables)
- Formulas 6, 14-15: Use bracket notation `[N]` to target specific deck positions
- Enables precise control in complex multi-deck configurations

### Using These Formulas

1. **Copy Formula to CSV**: Paste the formula directly into the appropriate field (deck length or primer depth)
2. **Adjust Parameters**: Modify numbers (0.3, 50, 4, etc.) to match your design requirements
3. **Combine Functions**: Mix Math functions and variables for complex logic
4. **Test with Real Holes**: Apply config to holes with different lengths/diameters to verify behavior

### Formula Variables Quick Reference

| Variable | Scope | Description |
|----------|-------|-------------|
| `holeLength` | Global | Total hole length (m) |
| `benchHeight` | Global | Collar to grade (m) |
| `subdrillLength` | Global | Grade to toe along hole (m) |
| `chargeBase` | Deepest | Base of deepest charge deck |
| `chargeTop` | Deepest | Top of deepest charge deck |
| `chargeLength` | Deepest | Length of deepest charge |
| `chargeBase[N]` | Indexed | Base of charge at position N |
| `chargeTop[N]` | Indexed | Top of charge at position N |
| `holeDiameter` | Global | Diameter in mm |

---

## Charging Visualization

Kirra provides multiple views for visualizing and editing charge configurations:

### 2D Charging View
![2D Charging View](2DChargingView.jpg)

The 2D radial view shows the complete charge configuration for all holes in a blast pattern, with color-coded deck types and mass distribution.

### 2D Hole Loading View
![2D Hole Loading View](2DholeLoadingView.jpg)

The hole section view displays detailed deck-by-deck breakdown with lengths, masses, and product information. This view is used in the Deck Builder for designing and editing charge configurations.

### 3D Charging View
![3D Charging View](3DChargingView.jpg)

The 3D view renders blast holes with their charge configurations in the spatial context, allowing visualization of deck layouts across the entire pattern.

---

## Source Files

| File | Purpose |
|------|---------|
| `src/charging/ConfigImportExport.js` | CSV writer, parser, brace notation with FL/FM/PR flags |
| `src/charging/ChargeConfig.js` | ChargeConfig class with typed deck arrays and primerArray |
| `src/charging/rules/SimpleRuleEngine.js` | Unified `applyTemplate()` engine — resolves lengths, formulas, mass, primers |
| `src/charging/Deck.js` | Deck class with `isFixedLength`, `isFixedMass`, `isProportionalDeck`, `overlapPattern` |
| `src/charging/Primer.js` | Primer class with `depthFormula` for deferred evaluation |
| `src/charging/HoleCharging.js` | Flag-aware `updateDimensions()` for scaling |
| `src/charging/ui/DeckBuilderDialog.js` | Deck Builder UI — scaling mode selector, "Save as Rule" |
| `src/charging/ui/HoleSectionView.js` | Section view with scaling flag badges (F/M) |
| `src/helpers/FormulaEvaluator.js` | `fx:` formula evaluation with bracket notation |
| `src/charging/ChargingConstants.js` | `DECK_TYPES`, `DECK_SCALING_MODES` enums |
