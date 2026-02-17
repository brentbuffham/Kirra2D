# Plan: Top/Base Deck Template Architecture

## Context

**Problem**: The current deck template format stores `{idx, length, product, FLAG}` and the engine stacks decks sequentially from collar. This means:
1. The "Save as Rule" and CSV export only capture length — not the top/base depth formulas
2. When applying to different hole lengths, decks are stacked implicitly rather than positioned explicitly
3. A deck's top/base relationship to other decks (e.g., "charge top = stemming base") is lost

**Solution**: Change the template format to `{idx, top, base, [mass], product, [FLAG]}` where top and base are formula-aware depth values. Each deck independently knows its position via formulas like `fx:deckBase[1]` or `fx:holeLength`. Add new `deckBase[N]`/`deckTop[N]` formula variables that reference ALL decks by idx.

**Design Decisions**:
- **Clean break** — no backward compat with old length-based format
- **All decks by idx** — `deckBase[N]`/`deckTop[N]` reference any deck type
- **Separate mass field** — mass as 4th positional field in CSV brace notation
- **3 decimal places** (0.000) throughout to prevent rounding overlap
- **Mass keyword "mass"** — when mass field is the literal string `mass`, calculate mass FROM the deck length (informational). When a number, it's a target mass constraint.

---

## New Template Entry Structure

**Old format**:
```javascript
{ idx, type, product, lengthMode, length, formula, massKg, isFixedLength, ... }
```

**New format**:
```javascript
{
  idx: 1,              // Deck order position (1-based)
  type: "INERT",       // INERT | COUPLED | DECOUPLED | SPACER
  product: "Stemming",
  top: "0",            // String: number or "fx:formula" — depth from collar
  base: "fx:holeLength * 0.5",  // String: number or "fx:formula"
  massKg: null,        // null = no mass | number = target kg | "mass" = derive from length
  isFixedLength: false,
  isFixedMass: false,
  isVariable: true,
  isProportionalDeck: false,
  overlapPattern: null
}
```

### Mass Field Modes

| Value | Meaning | Engine Behavior |
|-------|---------|----------------|
| `null`/omitted | No mass tracking | Use top + base as given |
| `50` (number) | Target 50 kg | If top is empty → `top = base - massLength(50, density)`. If base is empty → `base = top + massLength(50, density)`. If both given → mass is informational. |
| `"mass"` (keyword) | Calculate mass from length | `mass = (base - top) * PI * (diam/2000)^2 * density * 1000` |

---

## New CSV Brace Notation

### Non-spacer decks (INERT, COUPLED, DECOUPLED)

```
{idx,top,base,product}                          — no mass, no flag
{idx,top,base,product,FLAG}                     — with flag
{idx,top,base,mass,product}                     — with mass (number), no flag
{idx,top,base,mass,product,FLAG}                — with mass and flag
{idx,top,base,mass,product,FLAG,overlap:...}    — full form
```

**Parse rule**: 4th field is numeric → mass field present, product is 5th. Otherwise 4th is product.

### Spacer decks

```
{idx,top,product}    — base derived: top + product.lengthMm/1000
```

### Examples

```
{1,0,fx:(holeLength<3?holeLength*0.7:holeLength<5?holeLength*0.55:2.5),Stemming,VR}
{2,fx:deckBase[1],fx:holeLength,ANFO,VR}
{3,fx:deckBase[1],fx:holeLength,50,ANFO,FM}          — 50kg target, top derived from base-massLength
{4,2.5,fx:holeLength,mass,ANFO}                       — mass calculated from length
{5,fx:deckBase[4],GB230MM}                             — spacer: 3 fields
```

---

## Implementation Steps

### Step 1: ChargeConfig.js — Template entry docs update

File: `src/charging/ChargeConfig.js`

Update the JSDoc header to reflect the new entry format:
```javascript
// Deck array entries:
//   { idx, type, product, top, base, massKg,
//     isFixedLength, isFixedMass, isVariable, isProportionalDeck, overlapPattern }
```

No structural changes needed — ChargeConfig just stores the arrays as-is.

### Step 2: FormulaEvaluator.js — Add deckBase/deckTop variables

File: `src/helpers/FormulaEvaluator.js`

The bracket notation transformer already handles `chargeBase[N]` → `chargeBase_N`. It will handle `deckBase[N]` → `deckBase_N` automatically since the pattern is generic.

No code changes needed in FormulaEvaluator itself — the variables are injected at the call site.

### Step 3: SimpleRuleEngine.js — Rewrite applyTemplate()

File: `src/charging/rules/SimpleRuleEngine.js`

**New `buildIndexedDeckVars()` function** — called incrementally after each deck is resolved:
```javascript
function buildIndexedDeckVars(decks, ctx) {
    // ALL decks get deckBase/deckTop/deckLength (not just charge decks)
    for (var i = 0; i < decks.length; i++) {
        var d = decks[i];
        var deckPos = i + 1;
        ctx["deckBase_" + deckPos] = d.baseDepth;
        ctx["deckTop_" + deckPos] = d.topDepth;
        ctx["deckLength_" + deckPos] = d.baseDepth - d.topDepth;
    }
    // Also maintain existing chargeBase[N] for backward compat in primer formulas
    buildIndexedChargeVars(decks, ctx);  // keep existing function
}
```

**Rewrite `applyTemplate()`** — single-pass, sequential by idx:

```
For each deck template entry (sorted by idx):
  1. Evaluate top formula (using ctx which has deckBase[M] for all M < current)
  2. Evaluate base formula
  3. Handle mass field:
     - If massKg is a number AND one of top/base is empty: derive missing end
     - If massKg is "mass": compute mass from (base-top), store for display
  4. Clamp to 3 decimal places: parseFloat(val.toFixed(3))
  5. Create Deck object with topDepth, baseDepth, topDepthFormula, baseDepthFormula
  6. Add deckBase[N], deckTop[N] to formula context for subsequent decks
  7. Push to hc.decks

Then: place primers (same as today, using primerFormulaCtx)
```

**Key detail**: Formula evaluation order must be idx-ascending. `deckBase[M]` only available if M was resolved in a prior iteration. Circular references naturally prevented.

**Remove**: `lengthMode`, `length`, `formula` field handling. Replace with `top`/`base` field handling.

**Keep**: `findProduct()`, `snap()`, `buildIndexedChargeVars()` (for primer backward compat).

### Step 4: HoleCharging.js — Update updateDimensions()

File: `src/charging/HoleCharging.js`

**Rewrite `updateDimensions()`** to use top/base formulas:

```
For each deck (in topDepth order):
  IF deck.isVariable (VR):
    Re-evaluate deck.topDepthFormula and deck.baseDepthFormula
    with new hole context + deckBase/deckTop of already-processed decks
    Update topDepth, baseDepth from results
  ELSE IF deck.isFixedLength (FL):
    Keep topDepth and baseDepth unchanged (exact numeric values)
  ELSE IF deck.isFixedMass (FM):
    Recalc length from mass at new diameter
    Adjust the derived end (whichever was mass-derived)
  ELSE (PR — Proportional):
    Scale both topDepth and baseDepth proportionally:
      newTop = oldTop * (newHoleLength / oldHoleLength)
      newBase = oldBase * (newHoleLength / oldHoleLength)

  Round to 3 decimal places
  Add to incremental deckBase/deckTop context
```

### Step 5: ConfigImportExport.js — CSV format change

File: `src/charging/ConfigImportExport.js`

**A. Update `configToFieldMap()`** — serialization

Replace all 4 deck array serializers. For each entry:
```javascript
// Non-spacer: {idx,top,base,product[,FLAG[,overlap]]} or {idx,top,base,mass,product[,FLAG[,overlap]]}
var topStr = entry.top || "0";
var baseStr = entry.base || "fx:holeLength";
var massStr = entry.massKg != null ? String(entry.massKg) : null;
var flag = getScalingFlagSuffix(entry);
var overlap = serializeOverlapPattern(entry.overlapPattern);

var parts = [idx, topStr, baseStr];
if (massStr != null) parts.push(massStr);
parts.push(entry.product || "Unknown");
if (flag) parts.push(flag);
if (overlap) parts.push(overlap);
deckStr = "{" + parts.join(",") + "}";
```

Spacer serialization:
```javascript
// Spacer: {idx,top,product}
var topStr = entry.top || "fx:deckBase[" + (previousIdx) + "]";
spacerEntries.push("{" + idx + "," + topStr + "," + (entry.product || "Unknown") + "}");
```

**B. Update `parseDeckColumn()`** — parsing

New parsing logic for non-spacer:
```
Strip braces, split on comma
If deckType === "SPACER":
  3 fields: {idx, top, product}
Else:
  4+ fields: {idx, top, base, ...}
  If 4th field is numeric: it's mass → product is 5th
  Else: 4th is product, no mass
  Remaining: FLAG, overlap
```

**C. Update `serializeDeckLength()`** — REMOVE (replaced by top/base serialization)

**D. Update `EXAMPLE_CONFIG_DATA`** — all examples rewritten with top/base format

**E. Update `README_CONTENT`** — reflect new syntax

### Step 6: DeckBuilderDialog.js — Save As Rule dialog

File: `src/charging/ui/DeckBuilderDialog.js`

**Update `showSaveAsRuleDialog()`** (~line 1713):

Currently shows one "deckLength" field per deck. Change to show **two fields** per deck: "Top Depth" and "Base Depth".

```javascript
// For each deck, show top and base formula fields
var defaultTop = deck.topDepthFormula || String(parseFloat(deck.topDepth.toFixed(3)));
var defaultBase = deck.baseDepthFormula || String(parseFloat(deck.baseDepth.toFixed(3)));

fields.push({
    key: "deckTop_" + di,
    label: "[" + (di+1) + "] " + deck.deckType + " " + productName + " Top",
    type: "text", value: defaultTop
});
fields.push({
    key: "deckBase_" + di,
    label: "[" + (di+1) + "] " + deck.deckType + " " + productName + " Base",
    type: "text", value: defaultBase
});
```

On confirm, build entries with `top`/`base` instead of `lengthMode`/`length`/`formula`:
```javascript
entry.top = (data["deckTop_" + i] || "0").trim();
entry.base = (data["deckBase_" + i] || "fx:holeLength").trim();
// Mass handling: check for "m:" prefix or "mass" keyword
```

### Step 7: Documentation updates

Files:
- `src/charging/docs/ChargeConfigCSV-README.txt`
- `src/charging/docs/ChargeConfigCSV-README.md`
- `README_CONTENT` string in ConfigImportExport.js

Update all deck syntax sections, examples, and field references.

### Step 8: Deck.js — Minor cleanup

File: `src/charging/Deck.js`

`lengthFormula` property becomes secondary (kept for display compatibility but `topDepthFormula`/`baseDepthFormula` are the source of truth). No structural changes needed — the class already stores all three formula properties.

---

## Example Config Migration

### STNDFS (Standard Single Deck)

**Old**:
```javascript
inertDeckArray: [{ idx: 1, product: "Stemming", lengthMode: "fixed", length: 3.5, isFixedLength: true }]
coupledDeckArray: [{ idx: 2, product: "ANFO", lengthMode: "formula", formula: "holeLength - 3.5" }]
```

**New**:
```javascript
inertDeckArray: [{ idx: 1, product: "Stemming", top: "0", base: "3.5", isFixedLength: true }]
coupledDeckArray: [{ idx: 2, product: "ANFO", top: "fx:deckBase[1]", base: "fx:holeLength", isVariable: true }]
```

### SINGVAR (Variable Stem)

**Old**:
```javascript
inertDeckArray: [{ idx: 1, product: "Stemming", lengthMode: "formula",
  formula: "(holeLength < 3 ? holeLength*0.65 : holeLength < 5 ? holeLength*0.5 : 2.5)", isVariable: true }]
coupledDeckArray: [{ idx: 2, product: "ANFO", lengthMode: "formula",
  formula: "(holeLength < 3 ? holeLength*0.35 : holeLength < 5 ? holeLength*0.5 : holeLength - 2.5)", isVariable: true }]
```

**New**:
```javascript
inertDeckArray: [{ idx: 1, product: "Stemming",
  top: "0", base: "fx:(holeLength<3 ? holeLength*0.65 : holeLength<5 ? holeLength*0.5 : 2.5)", isVariable: true }]
coupledDeckArray: [{ idx: 2, product: "ANFO",
  top: "fx:deckBase[1]", base: "fx:holeLength", isVariable: true }]
```

### Mass example (50kg ANFO, base at holeLength)

```javascript
coupledDeckArray: [{ idx: 2, product: "ANFO",
  top: null, base: "fx:holeLength", massKg: 50, isFixedMass: true }]
// Engine: top = holeLength - massLength(50, 0.85)
```

### Mass-from-length example (calculate mass info)

```javascript
coupledDeckArray: [{ idx: 2, product: "ANFO",
  top: "2.5", base: "fx:holeLength", massKg: "mass" }]
// Engine: mass = (holeLength - 2.5) * PI * (diam/2000)^2 * density * 1000
```

---

## Files Modified Summary

| File | Change |
|------|--------|
| `src/charging/ChargeConfig.js` | JSDoc update for new entry format |
| `src/charging/rules/SimpleRuleEngine.js` | **Major rewrite**: applyTemplate() uses top/base, add buildIndexedDeckVars() |
| `src/charging/HoleCharging.js` | **Rewrite** updateDimensions() to use top/base formulas |
| `src/charging/ConfigImportExport.js` | CSV format change: serialize/parse top/base; rewrite EXAMPLE_CONFIG_DATA + README_CONTENT |
| `src/charging/ui/DeckBuilderDialog.js` | Save As Rule: top/base fields instead of length field |
| `src/charging/docs/ChargeConfigCSV-README.txt` | Full rewrite of deck syntax sections |
| `src/charging/docs/ChargeConfigCSV-README.md` | Full rewrite of deck syntax sections |

---

## Verification

1. **Apply rule to holes**: Create a variable-stem config with `fx:` top/base formulas → apply to holes of different lengths → verify each deck position adapts independently
2. **deckBase[N] reference**: Verify deck 2's top = deckBase[1] chains correctly
3. **Mass field**: Test `{2,,fx:holeLength,50,ANFO}` → verify top is derived from 50kg at hole diameter
4. **Mass keyword**: Test `{2,2.5,fx:holeLength,mass,ANFO}` → verify mass is calculated from length
5. **CSV round-trip**: Export → re-import → verify identical config
6. **Save As Rule**: Build charging in Deck Builder → Save as Rule → verify top/base formulas captured
7. **updateDimensions**: Change hole length → verify VR decks re-evaluate, FL decks stay fixed
8. **Build**: `npm run build` — no errors
