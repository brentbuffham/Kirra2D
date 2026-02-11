# Charge Configuration CSV Format Reference

## Overview

Kirra exports and imports charge configurations as a **ZIP file** containing CSV files.
This document describes the `chargeConfigs.csv` format — a **transposed layout** where rows are fields and columns are configurations. This makes configs easy to read and compare side-by-side in a spreadsheet.

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
code,Charge config code,configCode,STNDFS,AIRDEC,CUSTOM
text,Human-readable config name,configName,Standard Single Deck,Air Deck with Gas Bag,Multi Deck
text,Description,description,Single deck,Gas bag air deck,Custom layout
product,Stemming product,stemmingProduct,Stemming,Stemming,Stemming
...
```

The first 3 columns (`Type`, `Description`, `Field`) are metadata — do not change these. Add or remove **columns** to add or remove configurations.

### Field Reference

| # | Type | Field | Description |
|---|------|-------|-------------|
| 1 | code | `configCode` | Rule code: `STNDFS`, `AIRDEC`, `CUSTOM`, etc. |
| 2 | text | `configName` | Human-readable rule name |
| 3 | text | `description` | Free-text description |
| 4 | product | `stemmingProduct` | Stemming product name (from products.csv) |
| 5 | product | `chargeProduct` | Primary charge product name |
| 6 | product | `boosterProduct` | Default booster product name |
| 7 | product | `detonatorProduct` | Default detonator product name |
| 8 | product | `gasBagProduct` | Gas bag/spacer product name |
| 9 | number | `preferredStemLength` | Target stemming length (metres) |
| 10 | number | `minStemLength` | Minimum stemming length (metres) |
| 11 | number | `preferredChargeLength` | Target charge length (metres) |
| 12 | number | `minChargeLength` | Minimum charge length (metres) |
| 13 | bool | `useMassOverLength` | `true` to charge by mass instead of length |
| 14 | number | `targetChargeMassKg` | Target charge mass in kg (when useMassOverLength=true) |
| 15 | number | `chargeRatio` | Fraction of hole for charge (0.0–1.0, e.g. 0.5 = 50%) |
| 16 | number | `primerInterval` | Interval between primers in long charges (metres) |
| 17 | formula | `primerDepthFromCollar` | Single primer depth — number or `fx:` formula |
| 18 | number | `maxPrimersPerDeck` | Maximum primers per charge deck |
| 19 | number | `airDeckLength` | Air deck length for AIRDEC rules (metres) |
| 20 | bool | `applyShortHoleLogic` | Apply short-hole charging tiers |
| 21 | deck | `inertDeck` | Inert deck entries (brace notation) |
| 22 | deck | `coupledDeck` | Coupled explosive deck entries (brace notation) |
| 23 | deck | `decoupledDeck` | Decoupled explosive deck entries (brace notation) |
| 24 | deck | `spacerDeck` | Spacer deck entries (brace notation) |
| 25 | primer | `primer` | Primer entries (brace notation) |

### Standard vs Custom Configs

- **Standard codes** (`STNDFS`, `AIRDEC`, `ST5050`, etc.) use fields 1–20 only. The engine calculates deck layout from stemming/charge parameters.
- **Custom configs** (`CUSTOM`) use fields 21–25 to define explicit multi-deck layouts. Any config code can also include typed deck fields to override the default layout.

---

## Typed Deck Field Syntax

### Inert, Coupled, and Decoupled Decks

Format: `{idx,length,product}` — multiple entries separated by `;`

| Field | Description |
|-------|-------------|
| `idx` | Integer deck order position from collar (1-based). Deck 1 is at the top (collar), higher numbers go deeper. |
| `length` | Deck length — see Length Modes below |
| `product` | Product name, must match a name in `products.csv` |

**Length Modes:**

| Syntax | Mode | Description |
|--------|------|-------------|
| `2.0` | Fixed | Exact length in metres |
| `fill` | Fill | Absorbs all remaining hole length after fixed decks are placed |
| `fx:holeLength-4` | Formula | Calculated from hole properties at apply-time |
| `m:50` | Mass | 50 kg of product — length calculated from density and hole diameter |

**Examples:**

```
inertDeck:     {1,2.0,Stemming};{8,2.0,Stemming}
coupledDeck:   {2,fill,ANFO};{4,2.0,ANFO};{6,2.0,ANFO}
decoupledDeck: {3,1.5,PKG75mm}
```

### Spacer Decks

Format: `{idx,product}` — no length field (derived from product)

| Field | Description |
|-------|-------------|
| `idx` | Deck order position (1-based) |
| `product` | Spacer product name — length is `product.lengthMm / 1000` |

**Example:**

```
spacerDeck: {3,GB230MM};{5,GB230MM};{7,GB230MM}
```

A `GB230MM` gas bag with `lengthMm: 400` produces a 0.4m spacer deck.

### Primer Entries

Format: `{idx,depth,Det{name},HE{name}}` — multiple entries separated by `;`

| Field | Description |
|-------|-------------|
| `idx` | Primer number (1-based) |
| `depth` | Depth from collar in metres, or `fx:` formula (supports indexed variables) |
| `Det{name}` | Detonator product name (inside `Det{...}`) |
| `HE{name}` | Booster / high-explosive product name (inside `HE{...}`) |

**Examples:**

```
Single primer:
  {1,fx:chargeBase-0.3,Det{GENERIC-MS},HE{BS400G}}

Two primers targeting specific charge decks:
  {1,fx:chargeBase[2]-0.3,Det{GENERIC-MS},HE{BS400G}};{2,fx:chargeBase[1]-0.3,Det{GENERIC-MS},HE{BS400G}}

Literal depth:
  {1,8.5,Det{GENERIC-E},HE{BS400G}}
```

---

## Deck Order and Hole Layout

Decks are ordered from collar (top) to toe (bottom) using the `idx` field:

```
Collar (0m)
  ┌─────────────────┐
  │  Deck idx=1      │  ← e.g. Stemming (INERT)
  ├─────────────────┤
  │  Deck idx=2      │  ← e.g. ANFO (COUPLED, fill)
  ├─────────────────┤
  │  Deck idx=3      │  ← e.g. Gas Bag (SPACER)
  ├─────────────────┤
  │  Deck idx=4      │  ← e.g. ANFO (COUPLED, 2.0m)
  ├─────────────────┤
  │  Deck idx=5      │  ← e.g. Gas Bag (SPACER)
  ├─────────────────┤
  │  Deck idx=6      │  ← e.g. ANFO (COUPLED, 2.0m)
  ├─────────────────┤
  │  Deck idx=7      │  ← e.g. Stemming (INERT)
  └─────────────────┘
Toe (holeLength)
```

The `idx` values do NOT need to be sequential (gaps are allowed), but they must be unique across all four deck fields. The engine sorts all entries by `idx` to determine the collar-to-toe order.

---

## Formula Reference

Formulas are prefixed with `fx:` to avoid triggering spreadsheet formula parsing (Excel interprets `=` as a formula).

### Available Variables (Unindexed)

Unindexed variables refer to the **deepest** charge deck (backward compatible):

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

For **multi-deck** configs, indexed variables target a specific charge deck (COUPLED or DECOUPLED), numbered 1-based from collar:

| Variable | Description |
|----------|-------------|
| `chargeBase[1]` | Base depth of the 1st charge deck from collar |
| `chargeTop[1]` | Top depth of the 1st charge deck |
| `chargeLength[1]` | Length of the 1st charge deck |
| `chargeBase[2]` | Base depth of the 2nd charge deck |
| `chargeTop[2]` | Top depth of the 2nd charge deck |
| `chargeLength[2]` | Length of the 2nd charge deck |

**How indexing works:**

Given a deck layout: Stemming → Spacer → Air → ANFO(1) → Stemming → Spacer → Air → ANFO(2):
- `chargeBase[1]` = base of the first ANFO deck (deck 4)
- `chargeBase[2]` = base of the second ANFO deck (deck 8)
- `chargeBase` (unindexed) = base of the deepest charge deck = `chargeBase[2]`

### Supported Math Functions

`Math.min(a, b)` `Math.max(a, b)` `Math.abs(x)` `Math.sqrt(x)` `Math.PI` `Math.round(x)`

### Formula Examples

| Formula | Description |
|---------|-------------|
| `fx:chargeBase - 0.3` | Primer 0.3m above deepest charge deck base |
| `fx:chargeBase[1] - 0.3` | Primer 0.3m above 1st charge deck base |
| `fx:chargeBase[2] - 0.3` | Primer 0.3m above 2nd charge deck base |
| `fx:holeLength * 0.9` | Primer at 90% of total hole |
| `fx:Math.max(chargeTop + 1, chargeBase - 0.5)` | At least 1m below charge top |
| `fx:holeLength - 4` | Deck length = hole length minus 4m |

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

## Config Code Reference

| Code | Name | Description |
|------|------|-------------|
| `SIMPLE_SINGLE` | Simple Single | One stemming + one charge + one primer |
| `STNDVS` | Standard Vented | Air at top + stemming + charge at bottom |
| `STNDFS` | Standard Fixed Stem | Fixed stemming, fill rest with explosive |
| `ST5050` | 50/50 Split | 50% stemming, 50% charge |
| `AIRDEC` | Air Deck | Stemming + spacer + air + charge at bottom |
| `PRESPL` / `PRESPLIT` | Presplit | Decoupled packaged explosive |
| `NOCHG` | No Charge | Leave hole empty (air-filled) |
| `CUSTOM` | Custom | User-defined deck layout via typed fields |

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
5. Both transposed and legacy row-based formats are auto-detected on import

### Deck Builder — Save as Rule

1. Build a charging design in the Deck Builder
2. Click **Save as Rule**
3. Choose a **Config Code** (CUSTOM, STNDFS, AIRDEC, etc.)
4. Edit primer depth formulas — indexed formulas like `fx:chargeBase[1] - 0.3` are auto-generated for multi-deck layouts
5. The saved rule appears in the config list and is included in exports

### Edit Primer with Formulas

The Add Primer and Edit Primer dialogs accept formulas in the depth field:
- Enter a number like `8.5` for a literal depth
- Enter `fx:chargeBase[1] - 0.3` for a formula that resolves at apply-time
- The formula is evaluated immediately using the current deck layout for preview

### Round-trip Verification

1. Export config
2. Re-import the same ZIP without changes
3. Apply rules to holes
4. Verify identical deck layouts

---

## Backward Compatibility

The import parser **auto-detects** the CSV format:
- **Transposed** (new): Header starts with `Type,Description,Field,...`
- **Legacy row-based**: Header starts with `configCode,configName,...`

Both formats are fully supported on import. Exports always use the transposed format.

---

## Source Files

| File | Purpose |
|------|---------|
| `src/charging/ConfigImportExport.js` | Transposed CSV writer (`configsToTransposedCSV`), parser (`parseChargeConfigsCSV`), auto-detect |
| `src/charging/ChargeConfig.js` | ChargeConfig class with `deckTemplate` and `primerTemplate` fields |
| `src/charging/rules/SimpleRuleEngine.js` | `applyCustomTemplate()` — resolves lengths, formulas, mass, primers; `buildIndexedChargeVars()` |
| `src/charging/ui/DeckBuilderDialog.js` | Deck Builder UI — formula-aware primer editing, configCode selector, "Save as Rule" |
| `src/helpers/FormulaEvaluator.js` | `fx:` formula evaluation with bracket notation (`chargeBase[1]` → `chargeBase_1`) |
| `src/charging/ChargingConstants.js` | `DECK_TYPES`, `CHARGE_CONFIG_CODES` enums |
