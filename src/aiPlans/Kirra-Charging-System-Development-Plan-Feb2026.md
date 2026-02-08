# Kirra Development Plan: February 2026

## Charging System, KAP File Format & Charge Rule Engine

**Version:** 3.0 (Revised after gap analysis)
**Author:** Brent Buffham / Development Team
**Date:** 2026-02-08
**Duration:** 4 Weeks (Feb 5 - Mar 1, 2026)
**Target Repository:** brentbuffham/Kirra2D

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Data Model](#core-data-model)
3. [Timing Integration](#timing-integration)
4. [Week 1: Data Model & Constants](#week-1-data-model--constants)
5. [Week 2: IndexedDB, Products & Config Import](#week-2-indexeddb-products--config-import)
6. [Week 3: KAP File Format](#week-3-kap-file-format)
7. [Week 4: Drag-Drop Deck Builder & Simple Rules](#week-4-drag-drop-deck-builder--simple-rules)
8. [Integration Points](#integration-points)
9. [Testing Checklist](#testing-checklist)
10. [Appendix: Product Categories](#appendix-product-categories)

---

## Executive Summary

This plan implements a complete charging system for Kirra2D:

| Week  | Focus              | Key Deliverables                                              |
| ----- | ------------------ | ------------------------------------------------------------- |
| **1** | Data Model         | Deck/Product/Initiator classes, ChargeConfig, validation      |
| **2** | Products & Storage | IndexedDB stores, product dialogs, CSV zip config import      |
| **3** | KAP Files          | `.kap` export/import with versioning                          |
| **4** | Rules & UI         | Drag-drop deck builder, section view, simple rule templates   |

### Key Design Decisions

1. **Every hole has at least one deck** (default: INERT Air)
2. **Depths are `lengthFromCollar`** - supports negative for uphole blasting
3. **Primers are separate entities** - can be placed in Inert, Coupled, or Decoupled decks (NOT Spacer)
4. **Decoupled deck contents** belong to parent deck; if outside bounds, attributed to containing deck
5. **Initiating elements** (detonators, cord traces) have `burnRateMs` and `delayMs`
6. **Surface timing stays on flat hole object** - `fromHoleID`, `timingDelayMilliseconds` unchanged
7. **Downhole timing is separate** - computed from primers/detonators within the charging model
8. **No XLSX dependency** - product/config import uses zipped CSVs
9. **Inert decks are always user-placeable** - no automatic deck merging or consolidation
10. **Drag-drop deck builder** is the primary UI for assigning charging to holes

### Dependencies

```json
{
  "jszip": "^3.10.1"
}
```

No XLSX library needed. Config/product import uses CSV files inside a ZIP archive.

---

## Core Data Model

### Visual Overview (from diagram)

![Blasthole Charging Example](BlastholeChargingExample.png)

---

### Data Model Architecture

```text
HOLE (existing flat Kirra blast hole - UNCHANGED)
|
+-- holeID, entityName, holeDiameter, holeLengthCalculated
+-- startX/Y/Z, endX/Y/Z (collar to toe)
+-- fromHoleID, timingDelayMilliseconds (SURFACE timing - stays here)
|
+-- Referenced by HoleCharging via holeID
     |
     HOLE CHARGING (new, stored in window.loadedCharging Map)
     |
     +-- DECKS[] (ordered by topDepth, contiguous)
     |    +-- INERT Deck      (stemming, air, water, drill cuttings)
     |    +-- COUPLED Deck    (bulk explosives fill hole diameter)
     |    +-- DECOUPLED Deck  (packages with annular backfill, contains[])
     |    +-- SPACER Deck     (gas bags, stem caps, stem plugs)
     |
     +-- PRIMERS[] (separate entities, positioned by lengthFromCollar)
          +-- Detonator (ref to InitiatorProduct)
          +-- Booster (ref to HighExplosiveProduct)

PRODUCTS (stored in window.loadedProducts Map)
|
+-- NonExplosiveProduct   (Air, Water, Stemming, StemGel, DrillCuttings)
+-- BulkExplosiveProduct  (ANFO, HeavyANFO, Emulsion, Blends)
+-- HighExplosiveProduct  (Boosters, PackagedEmulsion, Pentolite)
+-- InitiatorProduct      (base for all initiators)
|   +-- ElectronicDetonator   (programmable delay, ms accuracy)
|   +-- ShockTubeDetonator    (fixed delay series, tube burn rate)
|   +-- ElectricDetonator     (fixed delay numbers)
|   +-- DetonatingCordProduct (continuous burn, g/m core load)
+-- SpacerProduct         (GasBag, StemCap, StemBrush, StemPlug)

CHARGE CONFIGS (stored in window.loadedChargeConfigs Map)
|
+-- ChargeConfig (rule template: which products, what depths, how many primers)
```

---

## Timing Integration

### Two-Level Timing Model

Kirra's timing operates at two independent levels:

**Level 1: Surface Timing (EXISTING - UNCHANGED)**
```
hole.fromHoleID                  -> Which hole fires before this one
hole.timingDelayMilliseconds     -> Interval delay from that hole
hole.holeTime                    -> Calculated absolute time (via calculateTimes())
```
This drives connectors, time charts, contour coloring. The charging system does NOT touch this.

**Level 2: Downhole Timing (NEW - in charging model)**
```
Primer.detonator.delayMs         -> Detonator delay (programmed or from series)
Primer.detonator.burnRateMs      -> Burn rate through tube/cord to primer depth
DecoupledContent (cord trace)    -> burnRateMs * length for cord from collar
```

**Total initiation time at a primer:**
```
primerInitiationTime = hole.holeTime
                     + cordTrace.burnRateMs * cordTrace.length  (if cord from surface)
                     + detonator.delayMs                        (detonator firing delay)
```

The charging model computes `Primer.totalDownholeDelayMs` as a getter.
The existing `calculateTimes()` is untouched. UI can show both values if desired.

---

## Deck Types

| Type | Description | Products | `contains` |
| ---- | ----------- | -------- | ---------- |
| INERT | Non-explosive material (placeable by user) | Non-Explosive | `null` |
| COUPLED | Bulk explosive filling hole diameter | Bulk-Explosive | `null` |
| DECOUPLED | Packages with annular backfill | Non-Explosive backfill | `DecoupledContent[]` |
| SPACER | Gas bags, stem caps, physical devices | Spacer products | item details |

**Inert decks are always user-placeable.** No automatic merging or consolidation of small decks.

---

## Week 1: Data Model & Constants

**Dates:** February 5-8, 2026

**Goals:**
- Define JavaScript classes with JSDoc for IDE support
- Create constants/enums for all types
- Build validation functions
- Define ChargeConfig model (even though rule engine comes Week 4)
- No UI work yet

**Files to create:**

```text
src/charging/
├── ChargingConstants.js
├── Deck.js
├── DecoupledContent.js
├── Primer.js
├── HoleCharging.js
├── ChargeConfig.js
├── ChargingValidation.js
├── products/
│   ├── Product.js
│   ├── NonExplosiveProduct.js
│   ├── BulkExplosiveProduct.js
│   ├── HighExplosiveProduct.js
│   ├── InitiatorProduct.js
│   ├── ElectronicDetonator.js
│   ├── ShockTubeDetonator.js
│   ├── DetonatingCordProduct.js
│   ├── SpacerProduct.js
│   └── productFactory.js
└── index.js
```

---

### `src/charging/ChargingConstants.js`

```javascript
/**
 * @fileoverview Kirra Charging System Constants
 */

// DECK TYPES
export const DECK_TYPES = Object.freeze({
    INERT: "INERT",
    COUPLED: "COUPLED",
    DECOUPLED: "DECOUPLED",
    SPACER: "SPACER"
});

// NON-EXPLOSIVE TYPES
export const NON_EXPLOSIVE_TYPES = Object.freeze({
    AIR: "Air",
    WATER: "Water",
    STEMMING: "Stemming",
    STEM_GEL: "StemGel",
    DRILL_CUTTINGS: "DrillCuttings"
});

// BULK EXPLOSIVE TYPES
export const BULK_EXPLOSIVE_TYPES = Object.freeze({
    ANFO: "ANFO",
    HEAVY_ANFO: "HeavyANFO",
    BLEND_GASSED: "BlendGassed",
    BLEND_NON_GASSED: "BlendNonGassed",
    EMULSION: "Emulsion",
    MOLECULAR: "Molecular"
});

// HIGH EXPLOSIVE TYPES
export const HIGH_EXPLOSIVE_TYPES = Object.freeze({
    BOOSTER: "Booster",
    PACKAGED_EMULSION: "PackagedEmulsion",
    PACKAGED_WATERGEL: "PackagedWatergel",
    CAST_BOOSTER: "CastBooster",
    PENTOLITE: "Pentolite"
});

// INITIATOR TYPES (expanded from single DetonatorProduct)
export const INITIATOR_TYPES = Object.freeze({
    ELECTRONIC: "Electronic",
    SHOCK_TUBE: "ShockTube",
    ELECTRIC: "Electric",
    DETONATING_CORD: "DetonatingCord"
});

// SPACER TYPES
export const SPACER_TYPES = Object.freeze({
    GAS_BAG: "GasBag",
    STEM_CAP: "StemCap",
    STEM_BRUSH: "StemBrush",
    STEM_PLUG: "StemPlug",
    STEM_LOCK: "StemLock"
});

// DECOUPLED CONTENT CATEGORIES
export const DECOUPLED_CONTENT_CATEGORIES = Object.freeze({
    PHYSICAL: "Physical",      // Boosters, packages (have mass, volume)
    INITIATOR: "Initiator",    // Detonators (have timing properties)
    TRACE: "Trace"             // Cord traces (continuous, have burn rate * length)
});

// DECOUPLED CONTENT TYPES
export const DECOUPLED_CONTENT_TYPES = Object.freeze({
    BOOSTER: "Booster",
    DETONATOR: "Detonator",
    PACKAGE: "Package",
    DETONATING_CORD: "DetonatingCord",
    SHOCK_TUBE: "ShockTube"
});

// DEFAULT DECK
export const DEFAULT_DECK = Object.freeze({
    deckType: DECK_TYPES.INERT,
    productType: NON_EXPLOSIVE_TYPES.AIR,
    productName: "Air",
    density: 0.0012
});

// CHARGING DEFAULTS
export const CHARGING_DEFAULTS = Object.freeze({
    preferredStemLength: 3.5,
    minStemLength: 2.5,
    preferredChargeLength: 6.0,
    minChargeLength: 2.0,
    wetTolerance: 0.5,
    dampTolerance: 1.0,
    shortHoleLength: 4.0,
    primerInterval: 8.0,
    bottomOffsetRatio: 0.1,
    maxPrimersPerDeck: 3,
    hotHoleTemperature: 50
});

// SHORT HOLE TIERS
export const SHORT_HOLE_TIERS = Object.freeze([
    { minLength: 4.0, maxLength: Infinity, chargeRatio: 0.50 },
    { minLength: 3.0, maxLength: 4.0, chargeRatio: 0.40 },
    { minLength: 2.0, maxLength: 3.0, chargeRatio: 0.25 },
    { minLength: 1.0, maxLength: 2.0, fixedMassKg: 5 },
    { minLength: 0.0, maxLength: 1.0, chargeRatio: 0 }
]);

// VALIDATION MESSAGES
export const VALIDATION_MESSAGES = Object.freeze({
    NO_DIAMETER_OR_LENGTH: "This hole has no diameter or length and by definition is not a hole.",
    DECK_OVERLAP: "Decks cannot overlap.",
    DECK_GAP: "Gap detected between decks.",
    PRIMER_IN_SPACER: "Primers cannot be placed in Spacer decks.",
    ZERO_DECK_LENGTH: "Deck has zero length.",
    NO_PRODUCT_ASSIGNED: "Deck has no product assigned.",
    NO_DETONATOR: "Primer has no detonator assigned.",
    NO_BOOSTER: "Primer has no booster assigned.",
    PRIMER_OUTSIDE_DECKS: "Primer is outside all deck bounds.",
    NO_DECKS: "Hole has no decks defined."
});

// INDEXEDDB STORE NAMES
export const CHARGING_STORES = Object.freeze({
    PRODUCTS: "chargingProducts",
    DECKS: "chargingDecks",
    PRIMERS: "chargingPrimers",
    CHARGE_CONFIGS: "chargeConfigs"
});

// KAP FILE VERSION
export const KAP_VERSION = "1.0.0";
export const SCHEMA_VERSION = "1.0.0";

// COLORS FOR DECK VISUALIZATION
export const DECK_COLORS = Object.freeze({
    INERT_AIR: "#FFFFFF",
    INERT_WATER: "#4169E1",
    INERT_STEMMING: "#8B7355",
    INERT_STEM_GEL: "#9ACD32",
    INERT_DRILL_CUTTINGS: "#A0522D",
    COUPLED: "#FF69B4",
    COUPLED_ANFO: "#FFFF00",
    COUPLED_EMULSION: "#FF8C00",
    COUPLED_HEAVY_ANFO: "#FFD700",
    DECOUPLED: "#FFD700",
    SPACER: "#ADD8E6",
    BOOSTER: "#FF0000",
    DETONATOR: "#0000FF",
    DETONATING_CORD: "#FF4500"
});

// CHARGE CONFIG CODES (templates for rule engine)
export const CHARGE_CONFIG_CODES = Object.freeze({
    SIMPLE_SINGLE: "SIMPLE_SINGLE",       // One coupled deck + stemming + one primer
    STANDARD_VENTED: "STNDVS",            // Stemming + charge + air top
    STANDARD_FIXED_STEM: "STNDFS",        // Fixed stem + fill rest
    AIR_DECK: "AIRDEC",                   // Charge + air separation
    PRESPLIT: "PRESPL",                    // Packaged presplit
    NO_CHARGE: "NOCHG",                   // Do not charge
    CUSTOM: "CUSTOM"                       // User-defined via drag-drop
});
```

---

### `src/charging/Deck.js`

```javascript
/**
 * @fileoverview Deck Class - A section of a blast hole between two depths
 */

import { DECK_TYPES, VALIDATION_MESSAGES } from "./ChargingConstants.js";

export function generateUUID() {
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export class Deck {
    constructor(options) {
        this.deckID = options.deckID || generateUUID();
        this.holeID = options.holeID;
        this.deckType = options.deckType || DECK_TYPES.INERT;
        this.topDepth = options.topDepth;       // lengthFromCollar
        this.baseDepth = options.baseDepth;     // lengthFromCollar
        this.product = options.product || null;  // { productID, name, density, ... }
        this.contains = options.contains || null; // DecoupledContent[] or spacer item details

        // For compressible COUPLED decks (gassed emulsions)
        this.isCompressible = options.isCompressible || false;
        this.averageDensity = options.averageDensity || null;
        this.capDensity = options.capDensity || null;
        this.maxCompressibleDensity = options.maxCompressibleDensity || null;

        this.created = options.created || new Date().toISOString();
        this.modified = new Date().toISOString();
    }

    get length() {
        return Math.abs(this.baseDepth - this.topDepth);
    }

    get effectiveDensity() {
        if (this.isCompressible && this.averageDensity) return this.averageDensity;
        return this.product ? (this.product.density || 0) : 0;
    }

    /**
     * Calculate volume in cubic meters
     * @param {number} holeDiameterMm - Hole diameter in millimeters
     */
    calculateVolume(holeDiameterMm) {
        var radiusM = (holeDiameterMm / 1000) / 2;
        return Math.PI * radiusM * radiusM * this.length;
    }

    /**
     * Calculate mass in kilograms
     * density is in g/cc = tonnes/m3, so mass = volume * density * 1000 for kg
     * @param {number} holeDiameterMm - Hole diameter in millimeters
     */
    calculateMass(holeDiameterMm) {
        return this.calculateVolume(holeDiameterMm) * this.effectiveDensity * 1000;
    }

    containsDepth(depth) {
        var min = Math.min(this.topDepth, this.baseDepth);
        var max = Math.max(this.topDepth, this.baseDepth);
        return depth >= min && depth <= max;
    }

    validate() {
        var errors = [], warnings = [];
        if (this.topDepth === this.baseDepth) errors.push(VALIDATION_MESSAGES.ZERO_DECK_LENGTH);
        if (!this.product) warnings.push(VALIDATION_MESSAGES.NO_PRODUCT_ASSIGNED);
        if (this.deckType === DECK_TYPES.DECOUPLED && (!this.contains || this.contains.length === 0)) {
            warnings.push("Decoupled deck has no contents");
        }
        if (this.deckType === DECK_TYPES.SPACER && !this.contains) {
            warnings.push("Spacer deck has no item details");
        }
        return { valid: errors.length === 0, errors: errors, warnings: warnings };
    }

    toJSON() {
        return {
            deckID: this.deckID,
            holeID: this.holeID,
            deckType: this.deckType,
            topDepth: this.topDepth,
            baseDepth: this.baseDepth,
            product: this.product,
            contains: this.contains,
            isCompressible: this.isCompressible,
            averageDensity: this.averageDensity,
            capDensity: this.capDensity,
            maxCompressibleDensity: this.maxCompressibleDensity,
            created: this.created,
            modified: this.modified
        };
    }

    static fromJSON(obj) {
        return new Deck(obj);
    }
}
```

---

### `src/charging/DecoupledContent.js`

```javascript
/**
 * @fileoverview DecoupledContent - Items inside a DECOUPLED deck
 * Has contentCategory to distinguish physical products from initiators from traces
 */

import { generateUUID } from "./Deck.js";
import { DECOUPLED_CONTENT_CATEGORIES } from "./ChargingConstants.js";

export class DecoupledContent {
    constructor(options) {
        this.contentID = options.contentID || generateUUID();
        this.contentType = options.contentType;  // Booster, Detonator, Package, DetonatingCord, ShockTube
        this.contentCategory = options.contentCategory || DecoupledContent.inferCategory(options.contentType);
        this.lengthFromCollar = options.lengthFromCollar;
        this.length = options.length || null;          // Physical length in meters
        this.diameter = options.diameter || null;       // Physical diameter in meters
        this.density = options.density || null;         // g/cc
        this.productID = options.productID || null;
        this.productName = options.productName || null;

        // For initiators (Detonator, ShockTube)
        this.burnRateMs = options.burnRateMs || null;   // ms per meter
        this.delayMs = options.delayMs || null;         // assignable delay
        this.serialNumber = options.serialNumber || null;

        // For cord traces (DetonatingCord)
        this.coreLoadGramsPerMeter = options.coreLoadGramsPerMeter || null;
    }

    /**
     * Infer contentCategory from contentType
     */
    static inferCategory(contentType) {
        if (contentType === "DetonatingCord") return DECOUPLED_CONTENT_CATEGORIES.TRACE;
        if (contentType === "Detonator" || contentType === "ShockTube") return DECOUPLED_CONTENT_CATEGORIES.INITIATOR;
        return DECOUPLED_CONTENT_CATEGORIES.PHYSICAL;
    }

    get isInitiator() {
        return this.contentCategory === DECOUPLED_CONTENT_CATEGORIES.INITIATOR;
    }

    get isTrace() {
        return this.contentCategory === DECOUPLED_CONTENT_CATEGORIES.TRACE;
    }

    /**
     * Total delay for this content in milliseconds
     * For initiators: burnRate * length (tube/cord) + discrete delay
     * For cord traces: burnRate * length (continuous burn, no discrete delay)
     */
    get totalDelayMs() {
        if (this.contentCategory === DECOUPLED_CONTENT_CATEGORIES.TRACE) {
            return (this.burnRateMs || 0) * (this.length || 0);
        }
        if (this.isInitiator) {
            var burn = (this.burnRateMs || 0) * (this.length || 0);
            return (this.delayMs || 0) + burn;
        }
        return 0;
    }

    calculateMass() {
        if (!this.length || !this.diameter || !this.density) return null;
        var r = this.diameter / 2;
        return Math.PI * r * r * this.length * this.density * 1000;
    }

    toJSON() {
        return {
            contentID: this.contentID,
            contentType: this.contentType,
            contentCategory: this.contentCategory,
            lengthFromCollar: this.lengthFromCollar,
            length: this.length,
            diameter: this.diameter,
            density: this.density,
            productID: this.productID,
            productName: this.productName,
            burnRateMs: this.burnRateMs,
            delayMs: this.delayMs,
            serialNumber: this.serialNumber,
            coreLoadGramsPerMeter: this.coreLoadGramsPerMeter
        };
    }

    static fromJSON(obj) {
        return new DecoupledContent(obj);
    }
}
```

---

### `src/charging/Primer.js`

```javascript
/**
 * @fileoverview Primer Class - Detonator + Booster combination
 * Can be placed in INERT, COUPLED, DECOUPLED (NOT SPACER)
 */

import { generateUUID } from "./Deck.js";
import { DECK_TYPES, VALIDATION_MESSAGES } from "./ChargingConstants.js";

export class Primer {
    constructor(options) {
        this.primerID = options.primerID || generateUUID();
        this.holeID = options.holeID;
        this.lengthFromCollar = options.lengthFromCollar;

        this.detonator = {
            productID: options.detonator?.productID || null,
            productName: options.detonator?.productName || null,
            initiatorType: options.detonator?.initiatorType || null, // Electronic, ShockTube, Electric, DetonatingCord
            burnRateMs: options.detonator?.burnRateMs || 0,         // ms per meter (tube/cord burn)
            delayMs: options.detonator?.delayMs || 0,               // programmed or series delay
            serialNumber: options.detonator?.serialNumber || null
        };

        this.booster = {
            productID: options.booster?.productID || null,
            productName: options.booster?.productName || null,
            quantity: options.booster?.quantity || 1,
            massGrams: options.booster?.massGrams || null
        };

        this.deckID = options.deckID || null;  // Which deck this primer sits in
        this.created = options.created || new Date().toISOString();
        this.modified = new Date().toISOString();
    }

    /**
     * Total downhole delay for this primer in milliseconds
     * This is the INTRA-HOLE delay only.
     * Full initiation time = hole.holeTime + this.totalDownholeDelayMs
     */
    get totalDownholeDelayMs() {
        var burn = (this.detonator.burnRateMs || 0) * (this.lengthFromCollar || 0);
        return (this.detonator.delayMs || 0) + burn;
    }

    get totalBoosterMassGrams() {
        return (this.booster.massGrams || 0) * (this.booster.quantity || 1);
    }

    validate(decks) {
        var errors = [], warnings = [];
        var assignedDeck = null;

        for (var i = 0; i < decks.length; i++) {
            if (decks[i].containsDepth(this.lengthFromCollar)) {
                assignedDeck = decks[i];
                break;
            }
        }

        if (!assignedDeck) {
            errors.push(VALIDATION_MESSAGES.PRIMER_OUTSIDE_DECKS + " (depth: " + this.lengthFromCollar + "m)");
        } else if (assignedDeck.deckType === DECK_TYPES.SPACER) {
            errors.push(VALIDATION_MESSAGES.PRIMER_IN_SPACER);
        }

        if (!this.detonator.productID && !this.detonator.productName) {
            warnings.push(VALIDATION_MESSAGES.NO_DETONATOR);
        }
        if (!this.booster.productID && !this.booster.productName) {
            warnings.push(VALIDATION_MESSAGES.NO_BOOSTER);
        }

        return { valid: errors.length === 0, errors: errors, warnings: warnings, assignedDeck: assignedDeck };
    }

    toJSON() {
        return {
            primerID: this.primerID,
            holeID: this.holeID,
            lengthFromCollar: this.lengthFromCollar,
            detonator: Object.assign({}, this.detonator),
            booster: Object.assign({}, this.booster),
            deckID: this.deckID,
            created: this.created,
            modified: this.modified
        };
    }

    static fromJSON(obj) {
        return new Primer(obj);
    }
}
```

---

### `src/charging/HoleCharging.js`

```javascript
/**
 * @fileoverview HoleCharging - Manages all charging data for a single hole
 * Includes interval-based fill operations for rule engine support
 */

import { Deck, generateUUID } from "./Deck.js";
import { Primer } from "./Primer.js";
import { DECK_TYPES, DEFAULT_DECK, VALIDATION_MESSAGES } from "./ChargingConstants.js";

export class HoleCharging {
    constructor(hole) {
        this.holeID = hole.holeID;
        this.entityName = hole.entityName || null;
        this.holeDiameterMm = hole.holeDiameter || 0;           // mm
        this.holeLength = hole.holeLengthCalculated || hole.measuredLength || 0;

        this.decks = [];
        this.primers = [];

        this.created = new Date().toISOString();
        this.modified = new Date().toISOString();

        if (this.holeDiameterMm > 0 && this.holeLength !== 0) {
            this.initializeDefaultDeck();
        }
    }

    initializeDefaultDeck() {
        if (this.decks.length === 0) {
            var top = this.holeLength < 0 ? this.holeLength : 0;
            var base = this.holeLength < 0 ? 0 : this.holeLength;
            this.decks.push(new Deck({
                holeID: this.holeID,
                deckType: DECK_TYPES.INERT,
                topDepth: top,
                baseDepth: base,
                product: { name: "Air", density: DEFAULT_DECK.density }
            }));
        }
    }

    sortDecks() {
        this.decks.sort(function(a, b) { return a.topDepth - b.topDepth; });
    }

    // ============ INTERVAL OPERATIONS ============

    /**
     * Get unallocated intervals (gaps not yet assigned a non-Air product)
     * Returns array of {top, base} intervals
     */
    getUnallocated() {
        // For now, returns intervals that are INERT Air
        var unallocated = [];
        for (var i = 0; i < this.decks.length; i++) {
            var deck = this.decks[i];
            if (deck.deckType === DECK_TYPES.INERT && deck.product && deck.product.name === "Air") {
                unallocated.push({ top: deck.topDepth, base: deck.baseDepth, length: deck.length });
            }
        }
        return unallocated;
    }

    /**
     * Fill an interval with a product, creating the appropriate deck type
     * Automatically splits existing decks that overlap the interval
     */
    fillInterval(topDepth, baseDepth, deckType, product, options) {
        var newDeck = new Deck({
            holeID: this.holeID,
            deckType: deckType,
            topDepth: topDepth,
            baseDepth: baseDepth,
            product: product,
            isCompressible: options ? options.isCompressible : false,
            averageDensity: options ? options.averageDensity : null,
            capDensity: options ? options.capDensity : null,
            maxCompressibleDensity: options ? options.maxCompressibleDensity : null
        });
        return this.insertDeck(newDeck);
    }

    /**
     * Fill interval to a target mass in kg
     * Calculates required length based on product density and hole diameter
     */
    fillToMass(startFromBase, deckType, product, massKg) {
        if (!product || !product.density || product.density === 0) return null;
        var radiusM = (this.holeDiameterMm / 1000) / 2;
        var volumeM3 = massKg / (product.density * 1000);
        var lengthM = volumeM3 / (Math.PI * radiusM * radiusM);

        // Fill from base upward
        var unalloc = this.getUnallocated();
        if (unalloc.length === 0) return null;

        var lastUnalloc = unalloc[unalloc.length - 1];
        var actualLength = Math.min(lengthM, lastUnalloc.length);
        var topDepth = lastUnalloc.base - actualLength;
        var baseDepth = lastUnalloc.base;

        return this.fillInterval(topDepth, baseDepth, deckType, product);
    }

    /**
     * Insert a deck, splitting any existing decks that overlap
     */
    insertDeck(newDeck) {
        newDeck.holeID = this.holeID;
        var toRemove = [];
        var toAdd = [newDeck];
        var newMin = Math.min(newDeck.topDepth, newDeck.baseDepth);
        var newMax = Math.max(newDeck.topDepth, newDeck.baseDepth);

        for (var i = 0; i < this.decks.length; i++) {
            var existing = this.decks[i];
            var exMin = Math.min(existing.topDepth, existing.baseDepth);
            var exMax = Math.max(existing.topDepth, existing.baseDepth);

            if (newMin < exMax && newMax > exMin) {
                toRemove.push(existing);

                // Top portion of split deck
                if (exMin < newMin) {
                    toAdd.push(new Deck({
                        holeID: this.holeID,
                        deckType: existing.deckType,
                        topDepth: exMin,
                        baseDepth: newMin,
                        product: existing.product ? Object.assign({}, existing.product) : null
                    }));
                }
                // Bottom portion of split deck
                if (exMax > newMax) {
                    toAdd.push(new Deck({
                        holeID: this.holeID,
                        deckType: existing.deckType,
                        topDepth: newMax,
                        baseDepth: exMax,
                        product: existing.product ? Object.assign({}, existing.product) : null
                    }));
                }
            }
        }

        this.decks = this.decks.filter(function(d) { return toRemove.indexOf(d) === -1; });
        for (var j = 0; j < toAdd.length; j++) {
            this.decks.push(toAdd[j]);
        }
        this.sortDecks();
        this.modified = new Date().toISOString();
        return { success: true };
    }

    // ============ PRIMERS ============

    addPrimer(primer) {
        primer.holeID = this.holeID;
        var val = primer.validate(this.decks);
        if (!val.valid) return val;

        primer.deckID = val.assignedDeck ? val.assignedDeck.deckID : null;
        this.primers.push(primer);
        this.modified = new Date().toISOString();
        return { success: true, errors: [], warnings: val.warnings, assignedDeck: val.assignedDeck };
    }

    // ============ QUERIES ============

    getDeckAtDepth(depth) {
        for (var i = 0; i < this.decks.length; i++) {
            if (this.decks[i].containsDepth(depth)) return this.decks[i];
        }
        return null;
    }

    getExplosiveDecks() {
        return this.decks.filter(function(d) {
            return d.deckType === DECK_TYPES.COUPLED || d.deckType === DECK_TYPES.DECOUPLED;
        });
    }

    getTotalExplosiveMass() {
        var total = 0;
        var self = this;
        for (var i = 0; i < this.decks.length; i++) {
            var deck = this.decks[i];
            if (deck.deckType === DECK_TYPES.COUPLED) {
                total += deck.calculateMass(self.holeDiameterMm);
            } else if (deck.deckType === DECK_TYPES.DECOUPLED && deck.contains) {
                for (var j = 0; j < deck.contains.length; j++) {
                    var c = deck.contains[j];
                    if (c.contentCategory === "Physical") {
                        var mass = c.calculateMass ? c.calculateMass() : 0;
                        if (mass) total += mass;
                    }
                }
            }
        }
        for (var k = 0; k < this.primers.length; k++) {
            total += (this.primers[k].totalBoosterMassGrams || 0) / 1000;
        }
        return total;
    }

    calculatePowderFactor(burden, spacing) {
        var mass = this.getTotalExplosiveMass();
        var volume = burden * spacing * Math.abs(this.holeLength);
        return volume > 0 ? mass / volume : 0;
    }

    // ============ VALIDATION ============

    validate() {
        var errors = [], warnings = [];

        if (!this.holeDiameterMm || this.holeLength === 0) {
            warnings.push(VALIDATION_MESSAGES.NO_DIAMETER_OR_LENGTH);
        }
        if (this.decks.length === 0) {
            errors.push(VALIDATION_MESSAGES.NO_DECKS);
        }

        this.sortDecks();
        for (var i = 0; i < this.decks.length - 1; i++) {
            var gap = Math.abs(this.decks[i + 1].topDepth - this.decks[i].baseDepth);
            if (gap > 0.001) {
                warnings.push(VALIDATION_MESSAGES.DECK_GAP + " Gap: " + gap.toFixed(3) + "m");
            }
        }

        for (var j = 0; j < this.decks.length; j++) {
            var dv = this.decks[j].validate();
            errors = errors.concat(dv.errors);
            warnings = warnings.concat(dv.warnings);
        }

        for (var k = 0; k < this.primers.length; k++) {
            var pv = this.primers[k].validate(this.decks);
            errors = errors.concat(pv.errors);
            warnings = warnings.concat(pv.warnings);
        }

        return { valid: errors.length === 0, errors: errors, warnings: warnings };
    }

    clear() {
        this.decks = [];
        this.primers = [];
        this.initializeDefaultDeck();
    }

    toJSON() {
        return {
            holeID: this.holeID,
            entityName: this.entityName,
            holeDiameterMm: this.holeDiameterMm,
            holeLength: this.holeLength,
            decks: this.decks.map(function(d) { return d.toJSON(); }),
            primers: this.primers.map(function(p) { return p.toJSON(); }),
            created: this.created,
            modified: this.modified
        };
    }

    static fromJSON(obj, hole) {
        var hc = new HoleCharging(hole || {
            holeID: obj.holeID,
            entityName: obj.entityName,
            holeDiameter: obj.holeDiameterMm,
            holeLengthCalculated: obj.holeLength
        });
        hc.decks = [];
        hc.primers = [];
        if (obj.decks) {
            hc.decks = obj.decks.map(function(d) { return Deck.fromJSON(d); });
        }
        if (obj.primers) {
            hc.primers = obj.primers.map(function(p) { return Primer.fromJSON(p); });
        }
        hc.created = obj.created || hc.created;
        hc.modified = obj.modified || hc.modified;
        return hc;
    }
}
```

---

### `src/charging/ChargeConfig.js`

```javascript
/**
 * @fileoverview ChargeConfig - Rule template for auto-generating charge profiles
 * Defined in Week 1 so products, decks, and rules share the same vocabulary.
 * Rule engine implementation comes in Week 4.
 */

import { generateUUID } from "./Deck.js";
import { CHARGE_CONFIG_CODES, CHARGING_DEFAULTS } from "./ChargingConstants.js";

export class ChargeConfig {
    constructor(options) {
        this.configID = options.configID || generateUUID();
        this.configCode = options.configCode || CHARGE_CONFIG_CODES.SIMPLE_SINGLE;
        this.configName = options.configName || "Unnamed Config";
        this.description = options.description || "";

        // Product references (productID or name)
        this.stemmingProduct = options.stemmingProduct || null;
        this.chargeProduct = options.chargeProduct || null;
        this.wetChargeProduct = options.wetChargeProduct || null;
        this.dampChargeProduct = options.dampChargeProduct || null;
        this.boosterProduct = options.boosterProduct || null;
        this.detonatorProduct = options.detonatorProduct || null;
        this.gasBagProduct = options.gasBagProduct || null;

        // Stemming parameters
        this.preferredStemLength = options.preferredStemLength || CHARGING_DEFAULTS.preferredStemLength;
        this.minStemLength = options.minStemLength || CHARGING_DEFAULTS.minStemLength;

        // Charge parameters
        this.preferredChargeLength = options.preferredChargeLength || CHARGING_DEFAULTS.preferredChargeLength;
        this.minChargeLength = options.minChargeLength || CHARGING_DEFAULTS.minChargeLength;
        this.useMassOverLength = options.useMassOverLength || false;
        this.targetChargeMassKg = options.targetChargeMassKg || null;

        // Primer parameters
        this.primerInterval = options.primerInterval || CHARGING_DEFAULTS.primerInterval;
        this.primerOffsetFromToe = options.primerOffsetFromToe || CHARGING_DEFAULTS.bottomOffsetRatio;
        this.maxPrimersPerDeck = options.maxPrimersPerDeck || CHARGING_DEFAULTS.maxPrimersPerDeck;
        this.primerDepthFromCollar = options.primerDepthFromCollar || null; // For simple rules

        // Moisture handling
        this.wetTolerance = options.wetTolerance || CHARGING_DEFAULTS.wetTolerance;
        this.dampTolerance = options.dampTolerance || CHARGING_DEFAULTS.dampTolerance;

        // Short hole
        this.shortHoleLength = options.shortHoleLength || CHARGING_DEFAULTS.shortHoleLength;

        // Air deck
        this.airDeckLength = options.airDeckLength || null;

        this.created = options.created || new Date().toISOString();
        this.modified = new Date().toISOString();
    }

    toJSON() {
        var result = {};
        var keys = Object.keys(this);
        for (var i = 0; i < keys.length; i++) {
            result[keys[i]] = this[keys[i]];
        }
        return result;
    }

    static fromJSON(obj) {
        return new ChargeConfig(obj);
    }
}
```

---

### `src/charging/products/InitiatorProduct.js`

```javascript
/**
 * @fileoverview Initiator Product Hierarchy
 *
 * InitiatorProduct (base)
 * ├── ElectronicDetonator   (programmable delay, ms accuracy)
 * ├── ShockTubeDetonator    (fixed delay series, tube burn rate)
 * ├── ElectricDetonator     (fixed delay numbers)
 * └── DetonatingCordProduct (continuous burn, g/m core load)
 *
 * NOTE: Leg length selection is deliberately NOT restrictive.
 * Users set a single leg length value. No auto-selection from tables.
 */

import { Product } from "./Product.js";

// ============ BASE INITIATOR ============

export class InitiatorProduct extends Product {
    constructor(options) {
        super(Object.assign({}, options, { productCategory: "Initiator" }));
        this.initiatorType = options.initiatorType || "Electronic";
        this.burnRateMs = options.burnRateMs || 0;       // ms per meter (0 for electronic)
        this.shellDiameterMm = options.shellDiameterMm || 7.6;
        this.shellLengthMm = options.shellLengthMm || 98;
    }

    toJSON() {
        return Object.assign(Product.prototype.toJSON.call(this), {
            initiatorType: this.initiatorType,
            burnRateMs: this.burnRateMs,
            shellDiameterMm: this.shellDiameterMm,
            shellLengthMm: this.shellLengthMm
        });
    }

    static fromJSON(obj) {
        // Dispatch to correct subclass
        switch (obj.initiatorType) {
            case "Electronic": return ElectronicDetonator.fromJSON(obj);
            case "ShockTube": return ShockTubeDetonator.fromJSON(obj);
            case "Electric": return ElectricDetonator.fromJSON(obj);
            case "DetonatingCord": return DetonatingCordProduct.fromJSON(obj);
            default: return new InitiatorProduct(obj);
        }
    }
}

// ============ ELECTRONIC DETONATOR ============
// Programmable delay in 1ms increments

export class ElectronicDetonator extends InitiatorProduct {
    constructor(options) {
        super(Object.assign({}, options, { initiatorType: "Electronic", burnRateMs: 0 }));
        this.timingType = "programmable";
        this.minDelayMs = options.minDelayMs || 0;
        this.maxDelayMs = options.maxDelayMs || 20000;
        this.delayIncrementMs = options.delayIncrementMs || 1;
        this.accuracyMs = options.accuracyMs || null;  // e.g., +/- 0.5ms
    }

    toJSON() {
        return Object.assign(InitiatorProduct.prototype.toJSON.call(this), {
            timingType: this.timingType,
            minDelayMs: this.minDelayMs,
            maxDelayMs: this.maxDelayMs,
            delayIncrementMs: this.delayIncrementMs,
            accuracyMs: this.accuracyMs
        });
    }

    static fromJSON(obj) { return new ElectronicDetonator(obj); }
}

// ============ SHOCK TUBE DETONATOR ============
// Fixed delay series + tube burn rate

export class ShockTubeDetonator extends InitiatorProduct {
    constructor(options) {
        super(Object.assign({}, options, { initiatorType: "ShockTube" }));
        this.timingType = "fixed_series";
        this.burnRateMs = options.burnRateMs || 0.5;    // ~2000 m/s = 0.5 ms/m
        this.delaySeriesMs = options.delaySeriesMs || null;  // [17, 25, 42, 65, 100, ...]
    }

    toJSON() {
        return Object.assign(InitiatorProduct.prototype.toJSON.call(this), {
            timingType: this.timingType,
            delaySeriesMs: this.delaySeriesMs
        });
    }

    static fromJSON(obj) { return new ShockTubeDetonator(obj); }
}

// ============ ELECTRIC DETONATOR ============
// Fixed delay numbers

export class ElectricDetonator extends InitiatorProduct {
    constructor(options) {
        super(Object.assign({}, options, { initiatorType: "Electric", burnRateMs: 0 }));
        this.timingType = "fixed";
        this.delaySeriesMs = options.delaySeriesMs || null;  // [0, 25, 50, 75, ...]
    }

    toJSON() {
        return Object.assign(InitiatorProduct.prototype.toJSON.call(this), {
            timingType: this.timingType,
            delaySeriesMs: this.delaySeriesMs
        });
    }

    static fromJSON(obj) { return new ElectricDetonator(obj); }
}

// ============ DETONATING CORD ============
// Continuous burn, no discrete delay

export class DetonatingCordProduct extends InitiatorProduct {
    constructor(options) {
        super(Object.assign({}, options, { initiatorType: "DetonatingCord" }));
        this.timingType = "continuous";
        this.burnRateMs = options.burnRateMs || 0.15;    // ~6500 m/s = ~0.15 ms/m
        this.coreLoadGramsPerMeter = options.coreLoadGramsPerMeter || 10;  // 5, 10, 40, 80 g/m
    }

    toJSON() {
        return Object.assign(InitiatorProduct.prototype.toJSON.call(this), {
            timingType: this.timingType,
            coreLoadGramsPerMeter: this.coreLoadGramsPerMeter
        });
    }

    static fromJSON(obj) { return new DetonatingCordProduct(obj); }
}
```

---

### Other Product Classes

The remaining product classes (`Product.js`, `NonExplosiveProduct.js`, `BulkExplosiveProduct.js`, `HighExplosiveProduct.js`, `SpacerProduct.js`) remain as in v2.0 of the plan. `productFactory.js` dispatches `fromJSON` using `productCategory`:

```javascript
// src/charging/products/productFactory.js
import { NonExplosiveProduct } from "./NonExplosiveProduct.js";
import { BulkExplosiveProduct } from "./BulkExplosiveProduct.js";
import { HighExplosiveProduct } from "./HighExplosiveProduct.js";
import { InitiatorProduct } from "./InitiatorProduct.js";
import { SpacerProduct } from "./SpacerProduct.js";
import { Product } from "./Product.js";

export function createProductFromJSON(obj) {
    switch (obj.productCategory) {
        case "NonExplosive": return NonExplosiveProduct.fromJSON(obj);
        case "BulkExplosive": return BulkExplosiveProduct.fromJSON(obj);
        case "HighExplosive": return HighExplosiveProduct.fromJSON(obj);
        case "Initiator": return InitiatorProduct.fromJSON(obj);  // Dispatches to subclass
        case "Spacer": return SpacerProduct.fromJSON(obj);
        default: return new Product(obj);
    }
}
```

---

## Week 2: IndexedDB, Products & Config Import

**Dates:** February 9-15, 2026

**Goals:**
- Add IndexedDB stores for charging data
- Match existing Kirra patterns (`debouncedSave*`)
- Product management dialog
- CSV-based config import (zipped CSVs, NO XLSX dependency)
- "Export Base Config" template for users to customize

**Files to create:**

```text
src/charging/
├── ChargingDatabase.js
├── ConfigImportExport.js
├── ProductDialog.js
└── templates/
    └── baseConfig/
        ├── README.txt
        ├── products.csv
        ├── chargeConfigs.csv
        └── (zipped as base-config-template.zip)
```

---

### Config Import/Export (Zipped CSVs)

**Design:** No XLSX dependency. Users work with CSV files (openable in any spreadsheet or text editor). Multiple CSVs are zipped into a single `.zip` file for import. Kirra can export a "base config" template zip for users to fill in and re-import.

### `src/charging/ConfigImportExport.js`

```javascript
/**
 * @fileoverview Config Import/Export using zipped CSV files
 * No XLSX dependency - works with any spreadsheet software or text editor
 *
 * Export: "Export Base Config" -> downloads template .zip with CSV files
 * Import: User uploads .zip containing filled-in CSVs
 *
 * ZIP structure:
 *   config.zip
 *   ├── products.csv          (product definitions)
 *   ├── chargeConfigs.csv     (charge rule configurations)
 *   └── README.txt            (instructions for filling in)
 */

import JSZip from "jszip";
import { createProductFromJSON } from "./products/productFactory.js";
import { ChargeConfig } from "./ChargeConfig.js";

// ============ CSV TEMPLATES ============

var PRODUCTS_CSV_HEADER = [
    "productCategory",    // NonExplosive, BulkExplosive, HighExplosive, Initiator, Spacer
    "productType",        // Air, Stemming, ANFO, HeavyANFO, Booster, Electronic, ShockTube, etc.
    "name",               // Display name
    "supplier",           // Supplier name (optional)
    "density",            // g/cc (for explosives, stemming, etc.)
    "colorHex",           // Hex color e.g. #FF69B4
    "isCompressible",     // true/false (for BulkExplosive)
    "minDensity",         // g/cc (for compressible)
    "maxDensity",         // g/cc (for compressible)
    "vodMs",              // Velocity of detonation m/s
    "reKjKg",             // Relative energy kJ/kg
    "rws",                // Relative weight strength %
    "waterResistant",     // true/false
    "dampResistant",      // true/false
    "massGrams",          // For HighExplosive (booster mass)
    "diameterMm",         // Physical diameter mm
    "lengthMm",           // Physical length mm
    "initiatorType",      // Electronic, ShockTube, Electric, DetonatingCord
    "burnRateMs",         // ms per meter (for shock tube, det cord)
    "minDelayMs",         // Min programmable delay (electronic)
    "maxDelayMs",         // Max programmable delay (electronic)
    "delayIncrementMs",   // Delay step size (electronic)
    "delaySeriesMs",      // Semicolon-separated delay series (e.g. "17;25;42;65;100")
    "coreLoadGramsPerMeter",  // For det cord
    "spacerType",         // GasBag, StemCap, etc.
    "description"         // Free text description
].join(",");

var CHARGE_CONFIGS_CSV_HEADER = [
    "configCode",         // SIMPLE_SINGLE, STNDVS, STNDFS, AIRDEC, PRESPL, NOCHG, CUSTOM
    "configName",         // Display name
    "stemmingProduct",    // Product name reference
    "chargeProduct",      // Product name reference
    "wetChargeProduct",   // Product name reference (optional)
    "boosterProduct",     // Product name reference
    "detonatorProduct",   // Product name reference
    "gasBagProduct",      // Product name reference (optional)
    "preferredStemLength",// meters
    "minStemLength",      // meters
    "preferredChargeLength", // meters
    "minChargeLength",    // meters
    "useMassOverLength",  // true/false
    "targetChargeMassKg", // kg (if mass-based)
    "primerInterval",     // meters between primers
    "primerDepthFromCollar", // meters (for simple single-primer configs)
    "maxPrimersPerDeck",  // integer
    "airDeckLength",      // meters (for AIRDEC config)
    "description"         // Free text
].join(",");

var README_CONTENT = [
    "KIRRA CHARGING CONFIGURATION TEMPLATE",
    "======================================",
    "",
    "This ZIP contains CSV template files for configuring Kirra's charging system.",
    "Edit these files in any spreadsheet (Excel, Google Sheets, LibreOffice) or text editor.",
    "",
    "FILES:",
    "  products.csv       - Define blast products (explosives, stemming, detonators, etc.)",
    "  chargeConfigs.csv  - Define charge rule configurations",
    "",
    "INSTRUCTIONS:",
    "  1. Open each CSV file",
    "  2. Fill in rows below the header (DO NOT modify the header row)",
    "  3. Save as CSV (comma-separated)",
    "  4. Re-ZIP all files together",
    "  5. Import the ZIP into Kirra via File > Import Charging Config",
    "",
    "PRODUCT CATEGORIES:",
    "  NonExplosive    - Air, Water, Stemming, StemGel, DrillCuttings",
    "  BulkExplosive   - ANFO, HeavyANFO, BlendGassed, Emulsion, etc.",
    "  HighExplosive   - Booster, PackagedEmulsion, CastBooster, Pentolite",
    "  Initiator       - Electronic, ShockTube, Electric, DetonatingCord",
    "  Spacer          - GasBag, StemCap, StemBrush, StemPlug, StemLock",
    "",
    "INITIATOR TYPES:",
    "  Electronic       - Programmable delay (set minDelayMs, maxDelayMs, delayIncrementMs)",
    "  ShockTube        - Fixed delay series (set delaySeriesMs as semicolon-separated: 17;25;42;65)",
    "  Electric         - Fixed delay numbers (set delaySeriesMs)",
    "  DetonatingCord   - Continuous burn (set burnRateMs, coreLoadGramsPerMeter)",
    "",
    "CHARGE CONFIG CODES:",
    "  SIMPLE_SINGLE    - One stemming deck + one coupled deck + one primer",
    "  STNDVS           - Standard vented stemming (stem + charge + air top)",
    "  STNDFS           - Standard fixed stem (stem + fill rest with explosive)",
    "  AIRDEC           - Air deck design (charge + air separation)",
    "  PRESPL           - Presplit charges (packaged products)",
    "  NOCHG            - Do not charge",
    "  CUSTOM           - User-defined via drag-drop builder",
    "",
    "NOTES:",
    "  - Leave cells blank for optional/not-applicable fields",
    "  - Density is in g/cc (grams per cubic centimeter)",
    "  - Lengths/diameters in millimeters unless noted otherwise",
    "  - Boolean fields: use true or false",
    ""
].join("\n");

// ============ EXAMPLE PRODUCT ROWS ============

var EXAMPLE_PRODUCTS = [
    // NonExplosive
    "NonExplosive,Air,Air,,0.0012,#FFFFFF,,,,,,,,,,,,,,,,,,,",
    "NonExplosive,Water,Water,,1.00,#4169E1,,,,,,,,,,,,,,,,,,,",
    "NonExplosive,Stemming,Crushed Rock Stemming,,2.10,#8B7355,,,,,,,,,,,,,,,,,,7-19mm aggregate",
    // BulkExplosive
    "BulkExplosive,ANFO,ANFO Standard,,0.85,#FFFF00,false,,,3200,3800,100,false,false,,,,,,,,,,,Standard prilled ANFO",
    "BulkExplosive,HeavyANFO,Heavy ANFO 70/30,,1.20,#FFD700,true,0.85,1.40,4500,4200,115,true,false,,,,,,,,,,,70% emulsion 30% ANFO",
    "BulkExplosive,Emulsion,Bulk Emulsion,,1.15,#FF8C00,true,1.00,1.30,5500,3600,120,true,true,,,,,,,,,,,Pumpable emulsion",
    // HighExplosive
    "HighExplosive,Booster,400g Pentex Booster,,1.60,#FF0000,,,,7500,5200,,true,,400,76,110,,,,,,,,Cast pentolite booster",
    "HighExplosive,PackagedEmulsion,Packaged Emulsion 75mm,,1.15,#FF4500,,,,5000,3400,,true,,2300,75,320,,,,,,,,75mm packaged emulsion",
    // Initiator - Electronic
    "Initiator,Electronic,i-kon II Electronic,,,,,,,,,,,,,,Electronic,0,0,20000,1,,,,,Orica i-kon II",
    // Initiator - ShockTube
    "Initiator,ShockTube,Exel LP Shock Tube,,,,,,,,,,,,,,ShockTube,0.5,,,,17;25;42;65;100;150;200;300;400;500,,,,Orica Exel LP series",
    // Initiator - DetonatingCord
    "Initiator,DetonatingCord,10g/m Det Cord,,,,,,,,,,,,,,DetonatingCord,0.15,,,,,10,,,10 gram per meter detonating cord",
    // Spacer
    "Spacer,GasBag,400mm Gas Bag,,0.06,#ADD8E6,,,,,,,,,,230,400,,,,,,GasBag,,,Standard 400mm gas bag"
];

// ============ EXPORT BASE CONFIG ============

export async function exportBaseConfigTemplate() {
    var zip = new JSZip();

    // Add README
    zip.file("README.txt", README_CONTENT);

    // Add products CSV with header + examples
    var productsCSV = PRODUCTS_CSV_HEADER + "\n" + EXAMPLE_PRODUCTS.join("\n") + "\n";
    zip.file("products.csv", productsCSV);

    // Add charge configs CSV with header + simple example
    var configsCSV = CHARGE_CONFIGS_CSV_HEADER + "\n" +
        "SIMPLE_SINGLE,Simple Single Deck,Crushed Rock Stemming,ANFO Standard,,400g Pentex Booster,i-kon II Electronic,,3.5,2.5,6.0,2.0,false,,8.0,,3,,,Single stemming + charge + primer\n";
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

// ============ IMPORT CONFIG ============

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

// ============ CSV PARSING ============

function parseCSVLine(line) {
    // Handle quoted fields with commas
    var result = [];
    var current = "";
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
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
    var lines = text.split("\n").filter(function(l) { return l.trim().length > 0; });
    if (lines.length < 2) return [];

    var headers = parseCSVLine(lines[0]);
    var products = [];

    for (var i = 1; i < lines.length; i++) {
        try {
            var values = parseCSVLine(lines[i]);
            var obj = {};
            for (var j = 0; j < headers.length; j++) {
                var val = values[j] || "";
                // Convert types
                if (val === "true") val = true;
                else if (val === "false") val = false;
                else if (val !== "" && !isNaN(val) && headers[j] !== "name" && headers[j] !== "description") {
                    val = parseFloat(val);
                }
                // Handle semicolon-separated arrays
                if (headers[j] === "delaySeriesMs" && typeof val === "string" && val.length > 0) {
                    val = val.split(";").map(function(v) { return parseFloat(v.trim()); });
                }
                if (val !== "") obj[headers[j]] = val;
            }
            var product = createProductFromJSON(obj);
            products.push(product);
        } catch (err) {
            errors.push("Row " + (i + 1) + ": " + err.message);
        }
    }
    return products;
}

function parseChargeConfigsCSV(text, errors) {
    var lines = text.split("\n").filter(function(l) { return l.trim().length > 0; });
    if (lines.length < 2) return [];

    var headers = parseCSVLine(lines[0]);
    var configs = [];

    for (var i = 1; i < lines.length; i++) {
        try {
            var values = parseCSVLine(lines[i]);
            var obj = {};
            for (var j = 0; j < headers.length; j++) {
                var val = values[j] || "";
                if (val === "true") val = true;
                else if (val === "false") val = false;
                else if (val !== "" && !isNaN(val) && headers[j] !== "configName" && headers[j] !== "description") {
                    val = parseFloat(val);
                }
                if (val !== "") obj[headers[j]] = val;
            }
            configs.push(ChargeConfig.fromJSON(obj));
        } catch (err) {
            errors.push("Config row " + (i + 1) + ": " + err.message);
        }
    }
    return configs;
}
```

---

### `src/charging/ChargingDatabase.js`

Same as v2.0 plan (IndexedDB stores, debounced save, load functions), with the addition of:

```javascript
// Global storage - follows loadedSurfaces pattern
// window.loadedCharging = new Map();  // holeID -> HoleCharging
// window.loadedProducts = new Map();  // productID -> Product
// window.loadedChargeConfigs = new Map(); // configID -> ChargeConfig
```

Registered in kirra.js initialization alongside existing `loadedSurfaces`, `loadedImages`, `loadedKADs`.

---

## Week 3: KAP File Format

**Dates:** February 16-22, 2026

Same as v2.0 plan. KAP file structure:

```text
project.kap (ZIP archive)
├── manifest.json    (metadata, version info)
├── holes.json       (allBlastHoles - flat hole data including timing)
├── decks.json       (charging decks by holeID)
├── primers.json     (primers by holeID)
├── products.json    (product definitions)
├── configs.json     (charge configurations)
├── drawings.json    (KAD drawings)
├── surfaces.json    (surface metadata, no mesh data)
└── layers.json      (layer organization)
```

Uses JSZip (already a dependency for config import).

---

## Week 4: Drag-Drop Deck Builder & Simple Rules

**Dates:** February 23 - March 1, 2026

**Goals:**
- Drag-and-drop visual deck builder dialog
- Hole section view (cross-section visualization)
- Simple rule templates (not full Blastlogic-level engine)
- Apply charging to selected holes

**Files to create:**

```text
src/charging/
├── ui/
│   ├── DeckBuilderDialog.js      (drag-drop deck builder)
│   ├── HoleSectionView.js        (cross-section visualization)
│   └── ChargingToolbar.js        (toolbar additions)
├── rules/
│   ├── SimpleRuleEngine.js       (simple rule templates)
│   └── ruleTemplates.js          (SIMPLE_SINGLE, STNDVS, etc.)
└── index.js
```

---

### Drag-Drop Deck Builder (`DeckBuilderDialog.js`)

**This is the primary UI for assigning charging.**

Uses FloatingDialog as base (per project conventions).

```
+---------------------------------------------------+
| Deck Builder                              [X]     |
+---------------------------------------------------+
|                                                   |
| PRODUCT PALETTE           | HOLE SECTION VIEW     |
| (draggable items)         | (drop target)         |
|                           |                       |
| [Stemming]  drag -->      | ┌─── 0.0m ──────┐   |
| [ANFO]      drag -->      | │  Stemming      │   |
| [Heavy ANFO] drag -->     | │  (3.5m)        │   |
| [Emulsion]  drag -->      | ├─── 3.5m ──────┤   |
| [Air]       drag -->      | │                │   |
| [Water]     drag -->      | │  Heavy ANFO    │   |
| [Gas Bag]   drag -->      | │  (6.5m)        │   |
| [Booster]   drag -->      | │                │   |
| [Electronic Det]          | ├─── 10.0m ─────┤   |
| [Shock Tube Det]          | │  Water (1.4m)  │   |
| [Det Cord]                | └─── 11.4m ─────┘   |
|                           |                       |
| DECK PROPERTIES           | [P] Primer @ 9.8m    |
| Type: [COUPLED  v]        | [P] Primer @ 3.0m    |
| Product: [Heavy ANFO v]   |                       |
| Top: [3.5] Base: [10.0]   |                       |
| Density: [1.20]           |                       |
|                           |                       |
+---------------------------------------------------+
| [Apply to Selected Holes] [Apply Rule] [Clear]    |
+---------------------------------------------------+
```

**Interaction Flow:**

1. User selects holes in canvas (2D or 3D)
2. Opens Deck Builder from toolbar/menu
3. Left panel shows product palette (loaded from `window.loadedProducts`)
4. Right panel shows hole section view (vertical cross-section)
5. User drags products onto section view to create decks
6. Deck snaps to depth boundaries, splits existing decks
7. User can drag primer markers onto explosive decks
8. "Apply to Selected Holes" writes `HoleCharging` to all selected holes
9. "Apply Rule" opens dropdown of saved `ChargeConfig` templates

**Key Implementation Details:**

- FloatingDialog-based (project convention)
- Section view is a Canvas 2D element inside the dialog
- Product palette items are HTML drag sources
- Drop zones calculated from deck depth boundaries
- Deck colors from `DECK_COLORS` constants
- Primer placement validates against deck types (no Spacer placement)
- "Apply to Selected Holes" iterates `window.selectedHoles` or `window.allBlastHoles.filter(visible && selected)`

---

### Hole Section View (`HoleSectionView.js`)

Renders a vertical cross-section of a single hole's charging:

```
     ↕ holeDiameter
    ┌──────┐  0.0m (collar)
    │      │
    │ STEM │  Stemming (brown)
    │      │
    ├──────┤  3.5m
    │      │
    │ ANFO │  Coupled (yellow)
    │      │
    │  [P] │  Primer @ 6.0m (red dot)
    │      │
    ├──────┤  10.0m
    │ GAS  │  Spacer (light blue)
    ├──────┤  10.4m
    │ AIR  │  Inert Air (white)
    ├──────┤  11.0m
    │WATER │  Inert Water (blue)
    └──────┘  11.4m (toe)
```

- Colors from `DECK_COLORS`
- Primers shown as markers with detonator/booster labels
- Depth labels on right side
- Deck type labels centered
- Click deck to select and edit properties
- Drag deck boundary to resize

---

### Simple Rule Templates (`SimpleRuleEngine.js`)

**Not a full Blastlogic-level engine.** Simple templates that users can apply:

```javascript
/**
 * Simple rule templates for auto-generating charge profiles
 * Each template is a function: (hole, config, products) -> HoleCharging
 */

/**
 * SIMPLE_SINGLE: One stemming deck + one coupled deck + one primer at depth
 *
 * Layout:
 *   [Stemming] (config.preferredStemLength)
 *   [Charge]   (rest of hole)
 *   [Primer]   (config.primerDepthFromCollar or 90% of hole length)
 */
export function applySimpleSingle(hole, config, products) {
    var hc = new HoleCharging(hole);
    hc.clear();

    var stemLength = Math.min(config.preferredStemLength, Math.abs(hc.holeLength) * 0.5);
    var stemProduct = findProduct(products, config.stemmingProduct);
    var chargeProduct = findProduct(products, config.chargeProduct);
    var boosterProduct = findProduct(products, config.boosterProduct);
    var detProduct = findProduct(products, config.detonatorProduct);

    // Stemming from collar
    hc.fillInterval(0, stemLength, DECK_TYPES.INERT, stemProduct);

    // Charge from stem to toe
    hc.fillInterval(stemLength, Math.abs(hc.holeLength), DECK_TYPES.COUPLED, chargeProduct);

    // Primer at configured depth or 90% of hole length
    var primerDepth = config.primerDepthFromCollar || Math.abs(hc.holeLength) * 0.9;
    hc.addPrimer(new Primer({
        holeID: hole.holeID,
        lengthFromCollar: primerDepth,
        detonator: {
            productName: detProduct ? detProduct.name : null,
            productID: detProduct ? detProduct.productID : null,
            initiatorType: detProduct ? detProduct.initiatorType : null
        },
        booster: {
            productName: boosterProduct ? boosterProduct.name : null,
            productID: boosterProduct ? boosterProduct.productID : null,
            quantity: 1,
            massGrams: boosterProduct ? boosterProduct.massGrams : null
        }
    }));

    return hc;
}

// Additional templates: applyStandardVented, applyAirDeck, etc.
// Follow same pattern: read config, create decks, place primers
```

---

## Integration Points

### 1. Global Storage (new globals in kirra.js init)

```javascript
window.loadedCharging = new Map();       // holeID -> HoleCharging
window.loadedProducts = new Map();       // productID -> Product
window.loadedChargeConfigs = new Map();  // configID -> ChargeConfig
```

### 2. Existing Timing System (UNCHANGED)

```javascript
// These stay on the flat hole object:
hole.fromHoleID                   // Surface connector
hole.timingDelayMilliseconds      // Surface delay
hole.holeTime                     // Calculated by calculateTimes()

// Downhole timing is computed from charging model:
primer.totalDownholeDelayMs       // Intra-hole delay
// Full time = hole.holeTime + primer.totalDownholeDelayMs
```

### 3. File Menu Additions

```
File > Import
  > Import Charging Config (.zip)     <- CSV zip import
File > Export
  > Export Base Config Template        <- Template zip download
  > Export Project (.kap)              <- Full project archive
```

### 4. Toolbar/Menu Additions

```
Charging > Deck Builder               <- Opens drag-drop dialog
Charging > Apply Rule to Selected     <- Quick-apply saved config
Charging > Product Manager            <- Product CRUD dialog
Charging > View Hole Section          <- Section view for selected hole
```

### 5. Canvas Drawing

Future work: draw deck column on 2D/3D hole visualization. Not in scope for initial 4 weeks but the data model supports it.

---

## Testing Checklist

### Week 1: Data Model
- [ ] Create Deck with all types, verify toJSON/fromJSON roundtrip
- [ ] Create DecoupledContent with each contentCategory
- [ ] Create Primer, validate against deck types (fail on SPACER)
- [ ] Create HoleCharging, insert overlapping decks, verify splits
- [ ] HoleCharging.fillInterval creates correct deck
- [ ] HoleCharging.fillToMass calculates correct length
- [ ] Validate contiguity check (detect gaps, overlaps)
- [ ] ElectronicDetonator, ShockTubeDetonator, DetonatingCordProduct all serialize/deserialize
- [ ] InitiatorProduct.fromJSON dispatches to correct subclass

### Week 2: Products & Storage
- [ ] Save/load products to IndexedDB
- [ ] Export base config template (verify ZIP contains correct CSVs)
- [ ] Import config ZIP (verify products + configs load correctly)
- [ ] Handle malformed CSVs gracefully (error messages, not crashes)
- [ ] Product dialog: add, edit, delete products
- [ ] Products persist across page reload

### Week 3: KAP Files
- [ ] Export KAP with holes + charging + products
- [ ] Import KAP, verify all data restored
- [ ] Import KAP from older version (migration)
- [ ] KAP file opens correctly after clear + reload

### Week 4: UI
- [ ] Drag product onto section view creates deck
- [ ] Drag deck boundary resizes deck
- [ ] Primer placement validates deck type
- [ ] "Apply to Selected Holes" writes to all selected
- [ ] "Apply Rule" uses saved ChargeConfig
- [ ] Section view renders all deck types with correct colors
- [ ] Clear button resets to default single Air deck

---

## Appendix: Product Categories

| Category | Types | Properties | Used In |
| -------- | ----- | ---------- | ------- |
| NonExplosive | Air, Water, Stemming, StemGel, DrillCuttings | density, particleSizeMm | INERT decks, DECOUPLED backfill |
| BulkExplosive | ANFO, HeavyANFO, BlendGassed, BlendNonGassed, Emulsion, Molecular | density, isCompressible, minDensity, maxDensity, vodMs, reKjKg, rws, waterResistant, dampResistant | COUPLED decks |
| HighExplosive | Booster, PackagedEmulsion, PackagedWatergel, CastBooster, Pentolite | massGrams, diameterMm, lengthMm, density, vodMs, waterResistant, capSensitive | DECOUPLED contents, Primers |
| Initiator | Electronic, ShockTube, Electric, DetonatingCord | initiatorType, burnRateMs, shellDiameterMm, timingType + subclass-specific | Primers, DECOUPLED contents |
| Spacer | GasBag, StemCap, StemBrush, StemPlug, StemLock | spacerType, lengthMm, diameterMm, density | SPACER decks |

---

## Appendix: Changes from v2.0

| Change | Rationale |
| ------ | --------- |
| Added timing integration section | Clarifies how surface timing (existing) connects to downhole timing (new) |
| Expanded DetonatorProduct into InitiatorProduct hierarchy | Electronic, ShockTube, Electric, DetonatingCord have fundamentally different timing models |
| Added contentCategory to DecoupledContent | Distinguishes Physical products from Initiators from Traces |
| Added interval operations to HoleCharging | getUnallocated(), fillInterval(), fillToMass() for rule engine support |
| Added ChargeConfig class in Week 1 | Rule vocabulary defined upfront, not deferred to Week 4 |
| Replaced XLSX import with CSV ZIP | No external dependency, works with any text editor or spreadsheet |
| Added "Export Base Config" template | Users get a pre-filled template to customize and re-import |
| Removed deck consolidation/merging | Inert decks stay as placed by user; no automatic merging |
| Removed leg length auto-selection | Users set leg length manually; no restrictive Blastlogic-style tables |
| Added drag-drop deck builder as primary UI | Core interaction: drag products onto hole section view, apply to selected holes |
| Defined global storage pattern | window.loadedCharging Map follows loadedSurfaces convention |
| Added simple rule templates | SIMPLE_SINGLE, STNDVS, AIRDEC as starting templates, not full Blastlogic engine |
