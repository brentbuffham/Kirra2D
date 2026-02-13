/**
 * @fileoverview Kirra Charging System Constants
 * All enums, defaults, validation messages, and configuration codes
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

// INITIATOR TYPES
export const INITIATOR_TYPES = Object.freeze({
	ELECTRONIC: "Electronic",
	SHOCK_TUBE: "ShockTube",
	ELECTRIC: "Electric",
	DETONATING_CORD: "DetonatingCord",
	SURFACE_CONNECTOR: "SurfaceConnector",
	SURFACE_WIRE: "SurfaceWire",
	SURFACE_CORD: "SurfaceCord"
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
	PHYSICAL: "Physical",
	INITIATOR: "Initiator",
	TRACE: "Trace"
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
	DETONATING_CORD: "#FF4500",
	SHOCK_TUBE_LINE: "#FF8C00",
	ELECTRONIC_LINE: "#1E90FF"
});

// DECK SCALING MODES
export const DECK_SCALING_MODES = Object.freeze({
	FIXED_LENGTH: "fixedLength",
	FIXED_MASS: "fixedMass",
	PROPORTIONAL: "proportional"
});

// CHARGE CONFIG CODES (informational label only, not a dispatch key)
export const CHARGE_CONFIG_CODES = Object.freeze({
	SIMPLE_SINGLE: "SIMPLE_SINGLE",
	STANDARD_VENTED: "STNDVS",
	STANDARD_FIXED_STEM: "STNDFS",
	AIR_DECK: "AIRDEC",
	PRESPLIT: "PRESPL",
	NO_CHARGE: "NOCHG",
	CUSTOM: "CUSTOM"
});
