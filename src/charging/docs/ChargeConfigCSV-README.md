# Charge Configuration CSV Format Reference

## Overview

Kirra exports and imports charge configurations as a **ZIP file** containing CSV files.
All charge designs use **deck arrays** — there are no flat-field shortcuts. Every config is a template of typed deck entries plus primer entries, applied per-hole by the unified template engine.

Each deck defines its position using **top and base depth values** (from collar), which can be fixed numbers or `fx:` formulas. Decks can reference each other using `deckBase[N]`/`deckTop[N]` indexed variables.

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

Format: `{idx,top,base,product}` or `{idx,top,base,product,FLAG}` — multiple entries separated by `|`

| Field | Description |
|-------|-------------|
| `idx` | Integer deck order position from collar (1-based). Deck 1 is at the top (collar), higher numbers go deeper. |
| `top` | Depth from collar to deck top — number or `fx:formula` |
| `base` | Depth from collar to deck base — number or `fx:formula` |
| `product` | Product name, must match a name in `products.csv` |
| `FLAG` | Optional scaling flag — see Scaling Flags below |

**With mass field:** `{idx,top,base,mass,product}` or `{idx,top,base,mass,product,FLAG}`

| Value | Meaning | Engine Behaviour |
|-------|---------|------------------|
| `50` (number) | Target 50 kg | If top empty → `top = base - massLength(50, density)`. If base empty → `base = top + massLength(50, density)`. If both given → mass is informational. |
| `"mass"` (keyword) | Calculate from length | `mass = (base - top) * PI * (diam/2000)^2 * density * 1000` |

**Parse rule:** If the 4th field is numeric or the keyword `mass`, it is the mass field and product is the 5th field. Otherwise the 4th field is the product name.

**Top/Base Values:**

| Syntax | Description |
|--------|-------------|
| `0` | Fixed depth at collar |
| `3.5` | Fixed depth at 3.5m from collar |
| `fx:deckBase[1]` | Start where deck 1 ends (formula) |
| `fx:holeLength` | At the toe of the hole |
| `fx:holeLength * 0.5` | At 50% of hole length |
| `fx:(holeLength<3 ? holeLength*0.65 : 2.5)` | Variable depth with ternary logic |

**Scaling Flags:**

| Flag | Name | Behaviour when applied to different hole lengths |
|------|------|--------------------------------------------------|
| `FL` | Fixed Length | Deck keeps its exact top/base positions regardless of hole length |
| `FM` | Fixed Mass | Deck recalculates its length to maintain the same mass at the new hole diameter |
| `VR` | Variable | Deck re-evaluates its top/base formula expressions using the current hole's properties. Formula decks are automatically set to Variable. |
| `PR` | Proportional | Deck scales top/base proportionally with hole length (default) |

When no flag is specified, the deck defaults to **proportional** scaling. Formula decks (`fx:...` in top or base) are automatically set to **Variable** scaling so the formula result adapts per hole instead of being proportionally stretched.

**Examples:**

```
inertDeck:     {1,0,3.5,Stemming,FL}|{5,fx:deckBase[4],fx:holeLength,Stemming,VR}
coupledDeck:   {2,fx:deckBase[1],fx:holeLength,ANFO,VR}|{4,fx:deckBase[3],fx:deckBase[3]+2.0,ANFO,FL}
decoupledDeck: {3,fx:deckBase[2],fx:deckBase[2]+1.5,PKG75mm,FL}

With mass:     {2,,fx:holeLength,50,ANFO,FM}     (top derived from 50kg mass)
Mass info:     {2,2.5,fx:holeLength,mass,ANFO}   (mass calculated from length)
```

### Overlap Pattern (Decoupled Decks)

For DECOUPLED decks with variable package stacking, an overlap pattern can be appended:

```
{idx,top,base,product,FLAG,overlap:base=3|base-1=2|n=1|top=2}
```

| Key | Description |
|-----|-------------|
| `base` | Number of packages at the base (bottom) position |
| `base-1` | Number of packages one position above base |
| `n` | Default number of packages for all middle positions |
| `top` | Number of packages at the top position |

### Swap Conditions (Per-Deck Product Swap)

Swap rules are appended after the scaling flag/overlap using `swap:` prefix. When the hole matches a condition, the deck product is replaced.

```
{idx,top,base,product,VR,swap:w{WR-ANFO}|r{Emulsion}|t{Emulsion,C>50}}
```

**Condition Codes:**

| Code | Condition | Threshold | Example |
|------|-----------|-----------|---------|
| `w` | Wet hole | — | `w{WR-ANFO}` |
| `d` | Damp hole | — | `d{WR-ANFO}` |
| `r` | Reactive ground | — | `r{Emulsion}` |
| `t` | Temperature | `C>50`, `F>=122`, `C<30` | `t{Emulsion,C>50}` |
| `x1`..`x20` | Future | — | `x1{SpecialProduct}` |

**Temperature threshold format:** `[C|F][>|<|>=|<=]number`

Multiple rules separated by `|` — first match wins.

**Per-hole override:** Blast holes have a `perHoleCondition` field that uses the same syntax. Per-hole override takes priority over deck-level swap rules.

Spacer with swap: `{idx,top,product,swap:r{ALT-SPACER}}`

### Spacer Decks

Format: `{idx,top,product}` — no base field (derived from `top + product.lengthMm / 1000`)

| Field | Description |
|-------|-------------|
| `idx` | Deck order position (1-based) |
| `top` | Depth from collar to spacer position (number or `fx:formula`) |
| `product` | Spacer product name |

**Example:**

```
spacerDeck: {3,fx:deckBase[2],GB230MM}|{5,fx:deckBase[4],GB230MM}
```

### Primer Entries

Format: `{idx,depth,Det{name},HE{name}}` — multiple entries separated by `|`

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
  {1,fx:chargeBase[8]-0.3,Det{GENERIC-MS},HE{BS400G}}|{2,fx:chargeBase[4]-0.3,Det{GENERIC-MS},HE{BS400G}}

Literal depth:
  {1,8.5,Det{GENERIC-E},HE{BS400G}}

Detonating cord (no booster):
  {1,fx:chargeBase-0.3,Det{10GCORD},HE{}}
```

---

## Deck Order and Hole Layout

Decks are ordered from collar (top) to toe (bottom) using the `idx` field. Each deck's top/base formulas are resolved sequentially by idx, so `deckBase[1]` is available when resolving deck 2, `deckBase[2]` when resolving deck 3, etc.

```
Collar (0m)
  ┌─────────────────┐
  │  Deck idx=1      │  ← e.g. Stemming (INERT, top=0, base=3.5)
  ├─────────────────┤
  │  Deck idx=2      │  ← e.g. ANFO (COUPLED, top=fx:deckBase[1], base=fx:holeLength)
  ├─────────────────┤
  │  Deck idx=3      │  ← e.g. Gas Bag (SPACER, top=fx:deckBase[2])
  ├─────────────────┤
  │  Deck idx=4      │  ← e.g. ANFO (COUPLED, top=fx:deckBase[3])
  ├─────────────────┤
  │  Deck idx=5      │  ← e.g. Stemming (INERT, top=fx:deckBase[4])
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

### Indexed Deck Variables (ALL Deck Types)

Available during the sequential resolution pass — `deckBase[M]` is available when `M` was resolved in a prior iteration:

| Variable | Description |
|----------|-------------|
| `deckBase[N]` | Base depth of any deck at position N |
| `deckTop[N]` | Top depth of any deck at position N |
| `deckLength[N]` | Length of any deck at position N |

Use these to chain decks together: `top = fx:deckBase[1]` means "start where deck 1 ends".

### Indexed Charge Variables (COUPLED/DECOUPLED Only)

For **multi-deck** configs, indexed charge variables target a specific charge deck by its **deck position number**:

| Variable | Description |
|----------|-------------|
| `chargeBase[N]` | Base depth of the charge deck at position N |
| `chargeTop[N]` | Top depth of the charge deck at position N |
| `chargeLength[N]` | Length of the charge deck at position N |

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

The result varies per-hole because `holeDiameter` comes from the hole data.

### Formula Examples — Deck Top/Base

| Top | Base | Description |
|-----|------|-------------|
| `0` | `3.5` | Fixed 3.5m stemming from collar |
| `fx:deckBase[1]` | `fx:holeLength` | Charge from end of deck 1 to toe |
| `0` | `fx:(holeLength<3 ? holeLength*0.65 : 2.5)` | Variable stem with ternary logic |
| `fx:deckBase[1]` | `fx:deckBase[1] + 2.0` | Fixed 2m deck starting after deck 1 |
| `fx:deckBase[3]` | `fx:holeLength` | Charge from end of deck 3 to toe |

### Formula Examples — Primer Depth

| Formula | Description |
|---------|-------------|
| `fx:chargeBase - 0.3` | Primer 0.3m above deepest charge deck base |
| `fx:chargeBase[4] - 0.3` | Primer 0.3m above charge deck at position 4 |
| `fx:chargeBase[8] - 0.6` | Primer 0.6m above charge deck at position 8 |
| `fx:holeLength * 0.9` | Primer at 90% of total hole |
| `fx:Math.max(chargeTop + 1, chargeBase - 0.5)` | At least 1m below charge top |

### Formula Examples — Conditional (Ternary) Expressions

Kirra supports JavaScript ternary operators for conditional logic in formulas. Syntax: `condition ? valueIfTrue : valueIfFalse`

| # | Function (fx:) | Description | Example Result |
|---|----------------|-------------|----------------|
| 1 | `fx:holeLength < 5 ? holeLength * 0.4 : 2.0` | If hole < 5m use 40%, else use fixed 2.0m | 4m hole → 1.6m<br>8m hole → 2.0m |
| 2 | `fx:holeLength < 3 ? holeLength * 0.5 : holeLength < 4 ? holeLength * 0.4 : holeLength * 0.3` | Tiered stem: <3m=50%, <4m=40%, else 30% | 2.5m → 1.25m<br>3.5m → 1.4m<br>6m → 1.8m |
| 3 | `fx:holeDiameter < 150 ? m:30 : holeDiameter < 200 ? m:50 : m:75` | Mass by diameter: <150mm=30kg, <200mm=50kg, else 75kg | 115mm → 30kg<br>165mm → 50kg<br>250mm → 75kg |
| 4 | `fx:benchHeight < 6 ? chargeBase - 0.2 : benchHeight < 10 ? chargeBase - 0.4 : chargeBase - 0.6` | Primer offset by bench: <6m=0.2m, <10m=0.4m, else 0.6m | 5m bench → base-0.2m<br>8m bench → base-0.4m<br>12m bench → base-0.6m |
| 5 | `fx:subdrillLength > 1 ? (holeLength - subdrillLength) * 0.8 : holeLength * 0.7` | If subdrill >1m charge to 80% above grade, else 70% of hole | 10m hole, 2m sub → 6.4m<br>10m hole, 0.5m sub → 7m |

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
Deck [3] (50kg emulsion):  top = fx:chargeTop[4] - massLength(50, 1.2), base = fx:chargeTop[4]
Deck [4] (2m ANFO):        top = fx:holeLength - 2.0, base = fx:holeLength
```

When applied to a 165mm hole: `massLength(50, 1.2) = 50 / (1.2 x 1000 x PI x 0.0825^2) = 1.95m`
When applied to a 250mm hole: `massLength(50, 1.2) = 50 / (1.2 x 1000 x PI x 0.125^2) = 0.85m`

The mass stays constant at 50kg; the length adapts to the hole diameter.

---

## Mass Field Modes

The mass field in deck entries controls mass-aware positioning:

| Value | Meaning | Engine Behaviour |
|-------|---------|------------------|
| (empty) | No mass tracking | Use top and base as given |
| `50` (number) | Target 50 kg | If top empty → `top = base - massLength(50, density)`. If base empty → `base = top + massLength(50, density)`. If both given → mass is informational. |
| `"mass"` (keyword) | Calculate from length | `mass = (base - top) * PI * (diam/2000)^2 * density * 1000` |

---

## Scaling Flags and Hole Application

When a charge config is applied to holes of different lengths, each deck's scaling flag controls its behaviour:

- **Variable** (`VR`): Deck re-evaluates its top/base formula expressions using the current hole's properties (holeLength, holeDiameter, benchHeight, subdrillLength, deckBase[N], etc.). Formula decks are automatically set to Variable mode.
- **Fixed Length** (`FL`): Deck keeps its exact top/base positions unchanged.
- **Fixed Mass** (`FM`): Deck recalculates its length to maintain the same mass at the new hole diameter.
- **Proportional** (default): Deck scales top/base proportionally with hole length.

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
3. Edit top/base depth formulas per deck — use `fx:deckBase[N]` to chain decks
4. Edit primer depth formulas — indexed formulas like `fx:chargeBase[4] - 0.3` are auto-generated
5. The saved rule appears in the config list and is included in exports

### Round-trip Verification

1. Export config
2. Re-import the same ZIP without changes
3. Apply rules to holes
4. Verify identical deck layouts

---

## 20 Useful Formula Examples for Decks and Charges

This table provides practical formula examples for common charging scenarios. All formulas use the `fx:` prefix.

| # | Scenario | Top | Base | Description |
|---|----------|-----|------|-------------|
| 1 | **Stem 30% of Hole** | `0` | `fx:holeLength * 0.3` | Stemming fills top 30% |
| 2 | **Fixed 3.5m Stem** | `0` | `3.5` | Fixed stemming with FL flag |
| 3 | **Charge After Stem** | `fx:deckBase[1]` | `fx:holeLength` | ANFO from end of stem to toe |
| 4 | **Fixed 2m Mid-Deck** | `fx:deckBase[2]` | `fx:deckBase[2] + 2.0` | 2m deck after deck 2 |
| 5 | **Charge Ends 2m Above Toe** | `fx:deckBase[1]` | `fx:holeLength - 2` | Leave 2m toe gap |
| 6 | **Variable Stem (Ternary)** | `0` | `fx:(holeLength<3 ? holeLength*0.65 : holeLength<5 ? holeLength*0.5 : 2.5)` | Tiered stem |
| 7 | **Spacer After Charge** | `fx:deckBase[2]` | (spacer) | Gas bag after deck 2 |
| 8 | **Air Deck** | `fx:deckBase[2]` | `fx:holeLength - 6.0` | Air gap above toe charge |
| 9 | **Toe Charge 6m** | `fx:holeLength - 6.0` | `fx:holeLength` | 6m at hole bottom |
| 10 | **Capped Proportional** | `0` | `fx:Math.min(holeLength * 0.4, 6)` | 40% capped at 6m |
| 11 | **Subdrill Charge** | `fx:holeLength - subdrillLength` | `fx:holeLength` | Fill subdrill zone |
| 12 | **Bench-Based** | `0` | `fx:benchHeight - 1` | Stem to near-grade |
| 13 | **50kg ANFO Mass** | (empty) | `fx:holeLength` | `mass=50` derives top from mass |
| 14 | **Mass Above Deck 4** | `fx:deckBase[3] - massLength(50, 0.85)` | `fx:deckBase[3]` | 50kg ANFO above deck 3 |
| 15 | **Conditional Stem** | `0` | `fx:holeLength < 5 ? holeLength * 0.4 : 2.0` | <5m=40%, else 2m |
| 16 | **Mass by Diameter** | (empty) | `fx:holeLength` | `mass=fx:holeDiameter<150?30:50` adapts |
| 17 | **Primer at 95%** | — | — | `fx:holeLength * 0.95` (primer depth) |
| 18 | **Primer Above Charge** | — | — | `fx:chargeBase - 0.3` |
| 19 | **Primer Multi-Deck** | — | — | `fx:chargeBase[4] - 0.3` |
| 20 | **Bench-Dependent Primer** | — | — | `fx:benchHeight<6?chargeBase-0.2:chargeBase-0.4` |

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
| `src/charging/ConfigImportExport.js` | CSV writer, parser, brace notation with top/base and FL/FM/PR/VR flags |
| `src/charging/ChargeConfig.js` | ChargeConfig class with typed deck arrays and primerArray |
| `src/charging/rules/SimpleRuleEngine.js` | Unified `applyTemplate()` engine — resolves top/base formulas, mass, primers |
| `src/charging/Deck.js` | Deck class with `topDepthFormula`, `baseDepthFormula`, scaling flags, `overlapPattern` |
| `src/charging/Primer.js` | Primer class with `depthFormula` for deferred evaluation |
| `src/charging/HoleCharging.js` | Flag-aware `updateDimensions()` for top/base formula re-evaluation |
| `src/charging/ui/DeckBuilderDialog.js` | Deck Builder UI — "Save as Rule" with top/base fields |
| `src/charging/ui/HoleSectionView.js` | Section view with scaling flag badges (F/M/VR) |
| `src/helpers/FormulaEvaluator.js` | `fx:` formula evaluation with bracket notation (`deckBase[N]`, `chargeBase[N]`) |
| `src/charging/ChargingConstants.js` | `DECK_TYPES`, `DECK_SCALING_MODES` enums |
