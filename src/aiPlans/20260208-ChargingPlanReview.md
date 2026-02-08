# Charging Plan Review & Gap Analysis

**Date:** 2026-02-08
**Reviewer:** Claude
**Documents Reviewed:**
- `Kirra-Charging-System-Development-Plan-Feb2026.md`
- `BlastholeChargingExample.png` (diagram)
- `src/referenceFiles/Blastlogic/` (API reference)
- Current Kirra timing system in `kirra.js`

---

## 1. OVERALL ALIGNMENT VERDICT

The plan is **75% aligned** with the diagram and Blastlogic reference. The core deck/product/primer model is sound, but there are structural gaps that will cause rework if not addressed before coding starts.

**What's good:**
- Deck types (INERT, COUPLED, DECOUPLED, SPACER) match the diagram exactly
- Product categories are comprehensive
- Validation rules are sensible
- IndexedDB storage pattern matches existing Kirra conventions

**What needs work:**
- Timing/initiation integration is absent
- Detonator model is too flat (not extensible)
- Missing interval-based operations (Blastlogic's strongest pattern)
- Deck `contains` structure conflates different concerns
- No bridge between existing flat hole timing and new deck-level timing

---

## 2. CRITICAL GAPS

### 2.1 Timing Integration is Missing Entirely

**Current system:** Each hole has `fromHoleID` and `timingDelayMilliseconds` on the flat hole object. These drive the connector system, timing propagation (`calculateTimes()`), contour coloring, and time charts.

**The plan:** Mentions `burnRateMs` and `delayMs` on detonators/primers, but never addresses how this integrates with the existing hole-level timing.

**The real-world flow is:**
```
Surface Delay (hole.timingDelayMilliseconds / fromHoleID)
  --> Detonating Cord / Shock Tube down-the-hole burn time
    --> Detonator delay (electronic delay or pyrotechnic delay)
      --> Booster initiation
        --> Explosive column detonation
```

**What's needed:**
- Keep `fromHoleID` and `timingDelayMilliseconds` on the hole (surface timing - unchanged)
- Each primer has a detonator with its own `delayMs` (in-hole delay)
- Detonating cord trace has a `burnRateMs` per meter and a `length` (burn time = rate * length)
- Total initiation time at any primer = `hole.holeTime + cordBurnTime + detonatorDelay`
- The plan's `Primer.totalDelayMs` getter is close but doesn't account for cord traces that run from collar to primer depth

**Recommendation:** Add a section explicitly mapping how surface timing (existing) flows into downhole timing (new). The charging system should consume `hole.holeTime` as input and compute per-primer absolute times.

### 2.2 Detonator Class Hierarchy is Too Flat

**The plan has:** A single `DetonatorProduct` class with `detonatorType` string field and flat properties.

**The problem:** Different detonator types have fundamentally different properties:

| Type | Key Properties | Timing Model |
|------|---------------|--------------|
| **Electronic** | programmable delay (1ms increments), accuracy +/-0.5ms, min/max delay range | `delayMs` (programmed) |
| **Non-Electric (Shock Tube)** | fixed delay series (e.g., 17ms, 25ms, 42ms...), burn rate ~2000m/s through tube | `delayMs` (from series) + `burnRateMs * tubeLength` |
| **Electric** | fixed delay numbers, simple ignition | `delayMs` (fixed) |
| **Detonating Cord** | continuous burn, no discrete delay, burn rate ~6500-7000m/s | `burnRateMs * length` (no discrete delay) |

**The plan's `DetonatorProduct`** tries to put all of these into one class with optional fields. This works but isn't extensible.

**Recommendation:** Use a base `InitiatorProduct` class with subclasses:

```javascript
// Base
class InitiatorProduct extends Product {
    initiatorType;       // "Electronic", "ShockTube", "Electric", "DetonatingCord"
    burnRateMs;          // ms per meter (0 for electronic, ~0.5 for shock tube, ~0.15 for det cord)
    shellDiameterMm;
    shellLengthMm;
}

// Electronic - programmable
class ElectronicDetonator extends InitiatorProduct {
    minDelayMs;          // e.g., 0
    maxDelayMs;          // e.g., 20000
    delayIncrementMs;    // e.g., 1
    accuracyMs;          // e.g., 0.5
    legLengthsM;         // [4, 6, 9, 12, 15, 18, 24, 30]
    timingType = "programmable";
}

// Shock Tube (Non-Electric)
class ShockTubeDetonator extends InitiatorProduct {
    delaySeriesMs;       // [17, 25, 42, 65, 100, ...] fixed delays
    legLengthsM;         // [4.2, 4.8, 6, 9, 12, ...]
    timingType = "fixed_series";
}

// Detonating Cord
class DetonatingCord extends InitiatorProduct {
    coreLoadGramsPerMeter;  // e.g., 5, 10, 40, 80 g/m
    // No discrete delay - continuous burn
    timingType = "continuous";
}
```

This lets each type validate its own constraints (e.g., shock tube can only use delays from its series; electronic can use any ms value in range).

### 2.3 The `contains` Array Conflates Different Things

**In the diagram**, a DECOUPLED deck's `contains` array holds:
- Boosters (physical products with dimensions)
- Detonators (initiators with timing)
- Packages (explosive cartridges)
- Detonating cord (continuous element with length)

**The plan's `DecoupledContent` class** tries to represent all of these with one flat structure. This works for storage but makes it hard to:
- Distinguish physical products from initiating elements
- Calculate timing chains through the contents
- Validate that a detonator is paired with a booster

**Recommendation:** The `DecoupledContent` class is fine as a storage/serialization format, but add a `contentCategory` enum:

```javascript
DECOUPLED_CONTENT_CATEGORIES = {
    PHYSICAL: "Physical",      // Boosters, packages (have mass, volume)
    INITIATOR: "Initiator",    // Detonators, cord (have timing properties)
    TRACE: "Trace"             // Cord traces that run through but aren't placed AT a depth
}
```

Or better yet, use the Primer class (which already pairs detonator + booster) for initiation assemblies inside decoupled decks, and only use `contains` for physical packages and cord traces.

### 2.4 Missing Interval-Based Operations

**Blastlogic's strongest pattern** is the interval system:
```javascript
hole.unallocated()              // Get remaining unfilled space
hole.unallocated().lower(6.0)   // Bottom 6m of unfilled space
hole.unallocated().upper(3.5)   // Top 3.5m of unfilled space
hole.fill(interval, product)    // Fill interval with product
hole.fillToMass(interval, product, massKg)  // Fill to target mass
```

**The plan** uses `insertDeck()` which splits existing decks. This is mathematically correct but much harder to use for rule-based charging.

**Recommendation:** Add an `IntervalManager` utility to `HoleCharging`:

```javascript
class HoleCharging {
    // Existing...

    getUnallocated() {
        // Returns intervals not yet assigned a product
        // Starts as full hole length, shrinks as decks are added
    }

    fillInterval(top, base, product, options) {
        // Creates appropriate deck type based on product category
        // Handles splitting existing decks automatically
    }

    fillToMass(top, base, product, massKg) {
        // Calculates required length for target mass
        // Creates deck of calculated length
    }

    fillPackaged(top, base, product, quantity) {
        // For discrete products (presplit cartridges, etc.)
    }
}
```

This makes the rule engine (Week 4) much simpler to implement.

---

## 3. STRUCTURAL IMPROVEMENTS

### 3.1 Hole-to-Charging Bridge

The plan creates `HoleCharging` as a standalone object. But there's no defined relationship to the existing `allBlastHoles` array.

**Questions the plan doesn't answer:**
- Is `HoleCharging` stored ON the hole object? (e.g., `hole.charging = new HoleCharging(hole)`)
- Or separately in a Map? (e.g., `chargingMap.get(hole.holeID)`)
- When a hole is deleted, how does charging data get cleaned up?
- When holes are imported from CSV, do they get default charging?

**Recommendation:** Use a separate Map (like `loadedSurfaces`), stored as a global:
```javascript
window.loadedCharging = new Map();  // holeID -> HoleCharging
```

This keeps the flat hole structure untouched (important for backward compatibility with CSV import/export) and follows the existing Kirra pattern for surfaces/images/KADs.

### 3.2 Product Families (from Blastlogic)

Blastlogic has `BlastProductFamily` - a collection of product variants (e.g., "Orica i-kon Electronic Detonator" family with different leg lengths and delay ranges).

**The plan** only has individual products. This means if a site uses the same detonator in 6 leg lengths, they need 6 separate product entries.

**Recommendation:** Add a lightweight `ProductFamily` concept:
```javascript
class ProductFamily {
    familyID;
    familyName;
    productCategory;
    variants;   // Array of Product objects

    getVariant(criteria) {
        // e.g., getNearestLegLength(12.5) -> returns 15m variant
    }
}
```

This makes the rule engine's product selection much cleaner (pick family, then select variant based on hole conditions).

### 3.3 Charge Configuration Codes

**Blastlogic** uses 20+ charge codes (STNDVS, STNDFS, PERCHG, AIRDEC, PRESPL, etc.) that define the fill strategy. Each code is essentially a recipe.

**The plan** mentions a "Charge Rule Engine" in Week 4 but doesn't define the configuration model.

**Recommendation:** Define a `ChargeConfig` class now (Week 1), even if the rule engine comes later:

```javascript
class ChargeConfig {
    configID;
    configCode;          // "STNDVS", "AIRDEC", etc.
    configName;          // "Standard Vented Stemming"
    description;

    // Rule parameters
    stemmingProduct;     // ProductID or ProductFamilyID
    chargeProduct;       // ProductID or ProductFamilyID
    wetChargeProduct;    // Alternative for wet holes
    boosterProduct;
    detonatorFamily;

    preferredStemLength;
    minStemLength;
    preferredChargeLength;
    minChargeLength;

    primerInterval;      // Spacing between primers
    primerOffset;        // Distance from toe for first primer

    shortHoleLength;     // Threshold for short hole treatment
    shortHoleTiers;      // Array of {minLength, maxLength, chargeRatio}

    useMassOverLength;   // boolean
    chargeMass;          // Target mass if mass-based

    wetTolerance;
    dampTolerance;

    airDeckLength;       // For AIRDEC configs
    gasBagProduct;
}
```

This means the rule engine in Week 4 can just read configurations rather than needing to also define the data model.

---

## 4. DIAGRAM CROSS-CHECK

Checking every element in `BlastholeChargingExample.png` against the plan:

| Diagram Element | In Plan? | Notes |
|----------------|----------|-------|
| INERT Deck (Stemming, top) | YES | Deck with deckType=INERT, product=Stemming |
| DECOUPLED Deck with package explosive | YES | Deck with deckType=DECOUPLED, contains array |
| Booster inside DECOUPLED | YES | DecoupledContent with contentType=Booster |
| 2x Detonators inside DECOUPLED | YES | DecoupledContent with contentType=Detonator |
| Package explosive (emulsion) | YES | DecoupledContent with contentType=Package |
| Detonating cord trace | PARTIAL | DecoupledContent supports it, but burn rate timing model is incomplete |
| INERT Deck (Stemming, mid) | YES | Standard INERT deck |
| SPACER Deck (GasBag) | YES | Deck with deckType=SPACER, contains={type:GASBAG} |
| INERT Deck (Air) | YES | Standard INERT deck |
| COUPLED Deck (Bulk ANFO) | YES | Deck with deckType=COUPLED, isCompressible |
| Compressible density fields | YES | averageDensity, capDensity, maxCompressibleDensity |
| SPACER Deck (GasBag, lower) | YES | Same as above |
| INERT Deck (Air, lower) | YES | Standard INERT deck |
| INERT Deck (Water) | YES | Standard INERT deck with product=Water |
| Primer (Detonator + Booster) | YES | Primer class with detonator/booster sub-objects |
| `fromHoleID` timing | NO | Not addressed in charging plan |
| `timingDelayMilliseconds` | NO | Not addressed in charging plan |
| Deck contiguity (no gaps) | YES | Validation rule covers this |
| Depths as `lengthFromCollar` | YES | Core design decision |

**Score: 14/16 elements present, 1 partial, 1 missing**

---

## 5. BLASTLOGIC PATTERNS WORTH ADOPTING

### 5.1 Conditional Product Substitution (HIGH VALUE)
Before applying charge rules, swap products based on conditions:
- Wet hole -> water-resistant explosive
- Damp hole -> damp-resistant explosive
- Reactive hole -> inhibited explosive
- Hot hole (>50C) -> do not charge

The plan has water resistance flags on products but no substitution logic.

### 5.2 Deck Consolidation (MEDIUM VALUE)
After filling, check for explosive decks shorter than `minChargeLength`:
- Merge with adjacent explosive deck
- Or revert to inert if sandwiched between inert decks

Prevents impractical thin explosive columns.

### 5.3 Mass vs Length Filling Modes (HIGH VALUE)
The plan's `Deck.calculateMass()` does the math, but there's no `fillToMass()` operation. Many sites specify charge by mass (e.g., "450kg per hole") not length.

### 5.4 Short Hole Tiered Logic (MEDIUM VALUE)
Already in the plan's constants (`SHORT_HOLE_TIERS`) but no implementation path described.

### 5.5 Cavity-Aware Charging (LOW VALUE for initial release)
Complex multi-zone charging around voids. Blastlogic supports this but it's an advanced feature.

---

## 6. SPECIFIC RECOMMENDATIONS

### R1: Keep Flat Hole Timing Untouched
- `fromHoleID`, `timingDelayMilliseconds`, `holeTime` stay on the hole object
- These represent SURFACE initiation timing (inter-hole)
- Charging system adds DOWNHOLE timing (intra-hole) as a separate concern
- Total time at primer = `hole.holeTime` + downhole delay chain

### R2: Expand Initiator/Detonator Hierarchy
Replace the single `DetonatorProduct` with:
```
InitiatorProduct (base)
├── ElectronicDetonator (programmable delay)
├── ShockTubeDetonator (fixed delay series)
├── ElectricDetonator (fixed delay numbers)
└── DetonatingCordProduct (continuous burn, no discrete delay)
```

### R3: Add `contentCategory` to DecoupledContent
```javascript
contentCategory: "Physical" | "Initiator" | "Trace"
```
This enables proper validation and timing calculation.

### R4: Add Interval Operations to HoleCharging
```javascript
getUnallocated(), fillInterval(), fillToMass(), fillPackaged()
```
Essential for the rule engine in Week 4.

### R5: Define ChargeConfig Data Model in Week 1
Even if the rule engine comes later, the config structure should be designed upfront so products, decks, and rules all share the same vocabulary.

### R6: Add ProductFamily Concept
Group product variants (especially detonators with different leg lengths) under families. The rule engine selects a family, then picks the right variant.

### R7: Define the Charging-to-Hole Bridge
Explicitly decide: `window.loadedCharging = new Map()` with holeID keys, following the `loadedSurfaces` pattern.

---

## 7. REVISED FILE STRUCTURE

```
src/charging/
├── constants/
│   └── ChargingConstants.js          (enums, defaults, messages)
├── models/
│   ├── Deck.js                       (Deck class)
│   ├── DecoupledContent.js           (content items)
│   ├── Primer.js                     (detonator + booster assembly)
│   ├── HoleCharging.js               (deck collection + interval ops)
│   ├── ChargeConfig.js               (rule configuration)
│   └── IntervalManager.js            (unallocated/fill operations)
├── products/
│   ├── Product.js                    (base class)
│   ├── NonExplosiveProduct.js
│   ├── BulkExplosiveProduct.js
│   ├── HighExplosiveProduct.js
│   ├── InitiatorProduct.js           (base initiator)
│   ├── ElectronicDetonator.js
│   ├── ShockTubeDetonator.js
│   ├── DetonatingCordProduct.js
│   ├── SpacerProduct.js
│   ├── ProductFamily.js              (variant grouping)
│   └── productFactory.js             (fromJSON dispatcher)
├── storage/
│   ├── ChargingDatabase.js           (IndexedDB CRUD)
│   └── defaultProducts.json          (seed data)
├── rules/
│   ├── ChargeRuleEngine.js           (Week 4)
│   └── ruleTemplates/                (STNDVS.js, AIRDEC.js, etc.)
├── validation/
│   └── ChargingValidation.js
└── index.js                          (barrel exports)
```

---

## 8. SUMMARY OF CHANGES TO PLAN

| # | Change | Priority | Effort |
|---|--------|----------|--------|
| 1 | Document timing integration (surface vs downhole) | CRITICAL | Low (documentation) |
| 2 | Expand detonator into initiator hierarchy | HIGH | Medium (4 classes) |
| 3 | Add IntervalManager for fill operations | HIGH | Medium (1 class) |
| 4 | Define ChargeConfig model upfront | HIGH | Low (1 class) |
| 5 | Add ProductFamily concept | MEDIUM | Low (1 class) |
| 6 | Add contentCategory to DecoupledContent | MEDIUM | Trivial |
| 7 | Define HoleCharging storage pattern (Map) | HIGH | Trivial |
| 8 | Add conditional product substitution | MEDIUM | Low (logic in rule engine) |
| 9 | Add fillToMass operation | MEDIUM | Low |
| 10 | Revise file structure to separate concerns | LOW | Reorganization only |

---

## 9. WHAT THE PLAN GETS RIGHT

To be clear, the plan has a strong foundation:

- **Deck model is correct** - INERT/COUPLED/DECOUPLED/SPACER matches industry practice
- **Depths as lengthFromCollar** - correct, supports uphole
- **Primers separate from decks** - correct, allows repositioning without rebuilding decks
- **Contiguity validation** - correct, real holes don't have gaps
- **SPACER contains item details** - matches diagram (GasBag with quantity, dimensions)
- **Compressible density model** - averageDensity/capDensity/maxCompressibleDensity is exactly right for gassed emulsions
- **KAP file format** - ZIP archive with JSON files is a good approach
- **IndexedDB patterns** - matches existing Kirra conventions perfectly
