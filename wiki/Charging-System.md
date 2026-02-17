# Charging System

## Overview

The Charging System in Kirra provides comprehensive blast hole loading design using typed deck arrays, formula-driven positioning, and mass-based calculations. All charge configurations are template-based, with support for proportional scaling, fixed-length, and fixed-mass modes.

**Key Features:**
- **Typed Deck Arrays**: Inert (stemming), Coupled (in-contact explosive), Decoupled (packaged explosive), Spacer (air bags/inert gaps)
- **Formula-Driven Positioning**: Use `fx:` expressions with hole properties for dynamic deck sizing
- **Mass-Based Length Mode**: Specify deck mass (kg) instead of length — adapts to hole diameter
- **Multi-Deck Support**: Complex configurations with indexed primer targeting
- **Scaling Modes**: Proportional (default), Fixed Length, Fixed Mass, Variable (formula re-evaluation)
- **Visualization**: 2D radial view, 2D section view, 3D spatial view

---

## Typed Deck Arrays

Kirra uses four typed deck categories, each with specific behavior:

### 1. Inert Decks (Stemming)

**Purpose**: Non-explosive material at collar or between charges
**Common Products**: Crushed aggregate, drill cuttings, clay, water
**Syntax**: `{idx,length,product,FLAG}`

**Example**:
```
{1,3.5,Stemming,FL};{5,fx:holeLength-3.5,Stemming,VR}
```

### 2. Coupled Decks (In-Contact Explosive)

**Purpose**: Bulk explosive in direct contact with hole walls
**Common Products**: ANFO, emulsion, slurries
**Syntax**: `{idx,length,product,FLAG}`

**Example**:
```
{2,fx:(holeLength<3.5)?(holeLength*0.3):3.5,ANFO,VR};{4,2.0,ANFO,FL}
```

### 3. Decoupled Decks (Packaged Explosive)

**Purpose**: Cartridge explosive with air gap between package and wall
**Common Products**: Packaged emulsion, boosters
**Syntax**: `{idx,length,product,FLAG}` or with overlap pattern
**Overlap Pattern**: `{idx,length,product,FLAG,overlap:base=3;base-1=2;n=1;top=2}`

**Example**:
```
{3,1.5,PKG75mm,FL}
{3,3.0,PKG75mm,FL,overlap:base=3;base-1=2;n=1;top=1}
```

**Overlap Pattern Keys**:
- `base`: Number of packages at bottom position
- `base-1`: Number one position above base
- `n`: Default number for middle positions
- `top`: Number of packages at top position

### 4. Spacer Decks

**Purpose**: Air bags or inert separators with fixed product length
**Common Products**: Gas bags, foam spacers
**Syntax**: `{idx,product}` — no length field (derived from `product.lengthMm`)

**Example**:
```
{3,GB230MM};{5,GB230MM}
```

---

## Deck Scaling Modes

When applying a charge configuration to holes of different lengths, each deck's scaling mode controls its behavior:

| Mode | Flag | Behavior | Use Case |
|------|------|----------|----------|
| **Proportional** | `PR` (default) | Deck length scales proportionally with hole length | Variable stem matching hole depth |
| **Fixed Length** | `FL` | Deck keeps exact metre length | Stemming stays 3.5m regardless of hole length |
| **Fixed Mass** | `FM` | Deck recalculates length to maintain mass at new diameter | Toe charge must be exactly 50kg |
| **Variable** | `VR` | Deck re-evaluates formula with current hole properties | Auto-set for `fx:` formulas |

**Visual Indicators**: The section view shows badges:
- **F** (blue) — Fixed Length
- **M** (orange) — Fixed Mass  
- **VR** (green) — Variable (formula re-evaluation)

---

## Formula-Driven Positioning

Formulas use the `fx:` prefix and support mathematical expressions, conditionals, and custom functions.

### Available Variables

**Unindexed Variables** (refer to deepest charge deck):

| Variable | Description |
|----------|-------------|
| `holeLength` | Total hole length (collar to toe) in metres |
| `chargeLength` | Length of deepest charge deck (m) |
| `chargeTop` | Depth from collar to top of deepest charge (m) |
| `chargeBase` | Depth from collar to bottom of deepest charge (m) |
| `stemLength` | Depth to top of first charge deck (m) |
| `holeDiameter` | Hole diameter in millimetres |
| `benchHeight` | Collar Z to grade Z (m) |
| `subdrillLength` | Grade to toe along hole vector (m) |

**Indexed Variables** (target specific deck positions):

| Variable | Description |
|----------|-------------|
| `chargeBase[N]` | Base depth of charge deck at position N |
| `chargeTop[N]` | Top depth of charge deck at position N |
| `chargeLength[N]` | Length of charge deck at position N |

**Note**: The index `N` matches the deck position shown in section view (e.g., `COUPLED[4]`).

### Supported Math Functions

```javascript
Math.min(a, b)    Math.max(a, b)    Math.abs(x)
Math.sqrt(x)      Math.PI           Math.round(x)
```

### Conditional Operators (Ternary)

```javascript
condition ? valueIfTrue : valueIfFalse
```

**Comparison**: `<` `>` `<=` `>=` `==` `!=`  
**Logical**: `&&` (AND), `||` (OR), `!` (NOT)

**Examples**:
```javascript
fx:holeLength < 5 ? 2.0 : 3.0
fx:benchHeight > 8 && holeDiameter > 150 ? m:75 : m:50
```

### Custom Functions

#### massLength()

Calculates deck length for a target mass at the hole's diameter.

**Syntax**:
```javascript
massLength(massKg, density)       // density in g/cc
massLength(massKg, "ProductName") // lookup density from product
```

**Formula**:
```
length = massKg / (density × 1000 × π × (diameter/2000)²)
```

**Example**:
```javascript
fx:chargeTop[4] - massLength(50, 0.85)           // 50kg ANFO
fx:chargeTop[4] - massLength(50, "ANFO")         // Same, using product lookup
fx:holeLength - 2 - massLength(30, 1.2)          // 30kg emulsion above 2m toe
fx:chargeBase[3] - massLength(25, "GENERIC4060") // 25kg ending at position 3 base
```

---

## Mass-Based Length Mode

The `m:` prefix specifies a target mass in kilograms. Length is calculated per-hole based on diameter.

**Formula**:
```
length = massKg / (density × 1000 × π × (diameter/2000)²)
```

**Example**: `m:50` with ANFO (0.85 g/cc):
- **115mm hole**: `area = π × 0.0575² = 0.01039 m²` → `kg/m = 8.83` → `length = 5.66m`
- **250mm hole**: `area = π × 0.125² = 0.04909 m²` → `kg/m = 48.52` → `length = 1.03m`

**Use Cases**:
```
m:50    // 50kg deck (length varies by diameter)
m:30    // 30kg deck
m:75    // 75kg deck
```

---

## Primer System

Primers are detonators with optional boosters, positioned by depth from collar or formula.

**Syntax**: `{idx,depth,Det{name},HE{name}}`

| Field | Description |
|-------|-------------|
| `idx` | Primer number (1-based) |
| `depth` | Literal metres or `fx:` formula |
| `Det{name}` | Detonator product (inside `Det{...}`) |
| `HE{name}` | Booster product (inside `HE{...}`), or `HE{}` for none |

### Indexed Primer Targeting

Multi-deck configs can target primers to specific charge decks using indexed variables:

```
Single primer:
  {1,fx:chargeBase-0.3,Det{GENERIC-MS},HE{BS400G}}

Two primers targeting decks 4 and 8:
  {1,fx:chargeBase[8]-0.3,Det{GENERIC-MS},HE{BS400G}};
  {2,fx:chargeBase[4]-0.3,Det{GENERIC-MS},HE{BS400G}}

Literal depth:
  {1,8.5,Det{GENERIC-E},HE{BS400G}}

Detonating cord (no booster):
  {1,fx:chargeBase-0.3,Det{10GCORD},HE{}}
```

---

## Deck Order and Hole Layout

Decks are ordered from collar (top) to toe (bottom) using the `idx` field. Gaps in numbering are allowed.

```
Collar (0m)
  ┌─────────────────┐
  │  Deck idx=1      │  ← Stemming (INERT, FL)
  ├─────────────────┤
  │  Deck idx=2      │  ← ANFO (COUPLED, formula)
  ├─────────────────┤
  │  Deck idx=3      │  ← Gas Bag (SPACER)
  ├─────────────────┤
  │  Deck idx=4      │  ← ANFO (COUPLED, 2.0m, FL)
  ├─────────────────┤
  │  Deck idx=5      │  ← Stemming (INERT, formula)
  └─────────────────┘
Toe (holeLength)
```

The template engine uses a **two-pass layout**:
1. **Pass 1**: Fixed-length, fixed-mass, and variable decks claim space first
2. **Pass 2**: Remaining space distributed among proportional decks

---

## Charging Visualization

### 2D Radial View

Shows complete charge configuration for all holes in blast pattern:
- Color-coded deck types
- Mass distribution visualization
- Radial layout around hole collar

**Access**: Charging tab → 2D View

### 2D Hole Section View

Detailed deck-by-deck breakdown:
- Deck lengths and masses
- Product information
- Scaling mode badges (F, M, VR)
- Primer positions
- Used in Deck Builder for design

**Access**: Select hole → Charging tab → Section View

### 3D Charging View

Spatial visualization of charge configurations:
- Blast holes with charge layouts in 3D context
- Color-coded decks
- Pattern-wide visualization

**Access**: Enable 3D mode → Charging tab → 3D View

---

## Workflow

### 1. Import Charge Configuration

1. **Charging tab** → **Import Config** (or File → Import Charging Config)
2. Select ZIP file containing `products.csv` and `chargeConfigs.csv`
3. Products and configs loaded into memory

### 2. Build Custom Configuration (Deck Builder)

1. Open **Deck Builder** dialog
2. Add decks by type (Inert, Coupled, Decoupled, Spacer)
3. Set lengths (fixed, formula, mass)
4. Add primers with depth formulas
5. Preview in section view
6. Click **Save as Rule**
7. Set scaling mode per deck (Proportional, Fixed Length, Fixed Mass)
8. Edit primer depth formulas (indexed formulas auto-generated)
9. Saved rule appears in config list

### 3. Apply Configuration to Holes

1. Select holes (individual, entity, or pattern)
2. **Charging tab** → Select config from dropdown
3. Click **Apply to Selected**
4. Review section view for applied charges
5. Adjust if needed

### 4. Export Configuration

1. **Charging tab** → **Export Config** (or File → Export Charging Config)
2. Downloads `kirra-charging-config.zip`
3. Edit in Excel/Sheets/text editor
4. Re-ZIP and import

### 5. Verify Round-Trip

1. Export config
2. Re-import same ZIP without changes
3. Apply rules to holes
4. Verify identical deck layouts

---

## Formula Examples

### Length Formulas (Deck Sizing)

| Formula | Description | Use Case |
|---------|-------------|----------|
| `fx:holeLength * 0.3` | 30% of hole length | Variable stem |
| `fx:holeLength - 8` | Hole minus 8m | Leave 8m for explosives |
| `fx:holeLength - 2` | Fill to 2m from bottom | Bottom charge with toe gap |
| `fx:Math.min(holeLength * 0.4, 6)` | 40% of hole, max 6m | Capped proportional |
| `fx:Math.max(holeLength - 4, 2)` | Hole minus 4m, min 2m | Ensure minimum charge |
| `fx:subdrillLength - 0.5` | Subdrill minus 0.5m | Fill subdrill zone |
| `fx:benchHeight - 1` | Bench height minus 1m | Charge to near-grade |
| `fx:(holeLength - 4) * 0.5` | Half of available charge zone | Even split after stem |

### Mass Formulas (Fixed Mass Decks)

| Formula | Description | Use Case |
|---------|-------------|----------|
| `m:50` | 50kg at hole diameter | Fixed mass, variable length |
| `m:30` | 30kg at hole diameter | Smaller mass deck |
| `fx:chargeTop[4] - massLength(50, 0.85)` | 50kg ANFO above position 4 | Mass-aware spacing |
| `fx:chargeTop[4] - massLength(50, "ANFO")` | 50kg using product lookup | Auto density lookup |
| `fx:holeLength - 2 - massLength(30, 1.2)` | 30kg emulsion above 2m toe | Mass with toe gap |

### Primer Depth Formulas

| Formula | Description | Use Case |
|---------|-------------|----------|
| `fx:holeLength * 0.95` | Primer at 95% depth | Deep primer |
| `fx:chargeBase - 0.3` | 0.3m above deepest charge | Standard offset |
| `fx:chargeBase[4] - 0.3` | 0.3m above deck position 4 | Multi-deck targeting |
| `fx:chargeBase[8] - 0.6` | 0.6m above deck position 8 | Multiple primers |
| `fx:Math.max(chargeTop + 1, chargeBase - 0.5)` | At least 1m below charge top | Safety positioning |

### Conditional Formulas (Ternary)

| Formula | Description | Example Result |
|---------|-------------|----------------|
| `fx:holeLength < 5 ? holeLength * 0.4 : 2.0` | <5m use 40%, else 2m | 4m → 1.6m<br>8m → 2.0m |
| `fx:holeLength < 3 ? holeLength * 0.5 : holeLength < 4 ? holeLength * 0.4 : holeLength * 0.3` | Tiered stem: 50%/40%/30% | 2.5m → 1.25m<br>3.5m → 1.4m<br>6m → 1.8m |
| `fx:holeDiameter < 150 ? m:30 : holeDiameter < 200 ? m:50 : m:75` | Mass by diameter | 115mm → 30kg<br>165mm → 50kg<br>250mm → 75kg |
| `fx:benchHeight < 6 ? chargeBase - 0.2 : benchHeight < 10 ? chargeBase - 0.4 : chargeBase - 0.6` | Primer offset by bench | 5m → base-0.2m<br>8m → base-0.4m<br>12m → base-0.6m |
| `fx:subdrillLength > 1 ? (holeLength - subdrillLength) * 0.8 : holeLength * 0.7` | Charge strategy by subdrill | 10m, 2m sub → 6.4m<br>10m, 0.5m sub → 7m |

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
| `src/charging/ui/HoleSectionView.js` | Section view with scaling flag badges (F/M/VR) |
| `src/charging/ChargingDatabase.js` | Product and config storage |
| `src/charging/ChargingValidation.js` | Validation for deck and primer syntax |
| `src/charging/DecoupledContent.js` | Decoupled deck overlap pattern handling |
| `src/charging/ProductDialog.js` | Product library management UI |
| `src/helpers/FormulaEvaluator.js` | `fx:` formula evaluation with bracket notation |
| `src/helpers/ChargingMassHelper.js` | Mass calculation utilities |
| `src/charging/ChargingConstants.js` | `DECK_TYPES`, `DECK_SCALING_MODES` enums |

---

## Deck Terminology Reference

| Term | Definition |
|------|------------|
| **Collar** | Top of blast hole (start point) |
| **Toe** | Bottom of blast hole (end point) |
| **Grade** | Floor elevation point where hole intersects bench floor |
| **Stemming** | Inert material at top of hole |
| **Charge** | Explosive material (coupled or decoupled) |
| **Coupled** | Explosive in direct contact with hole wall |
| **Decoupled** | Packaged explosive with air gap |
| **Subdrill** | Portion of hole below grade (toe deeper than floor) |
| **Primer** | Detonator assembly (detonator + optional booster) |
| **Booster** | High-explosive cartridge to initiate main charge |
| **Spacer** | Air bag or inert separator between charges |
| **Deck** | Individual loading zone in hole (one material/product) |
| **Multi-Deck** | Configuration with multiple charge zones separated by inerts/spacers |

---

See also:
- [Charge Config CSV Reference](Charge-Config-CSV-Reference) — Complete CSV format specification
- [Blast Hole Management](Blast-Hole-Management) — Hole data structure and geometry
- [File Formats](File-Formats) — Import/export formats
