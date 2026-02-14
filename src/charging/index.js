/**
 * @fileoverview Kirra Charging System - Public API
 * Re-exports all charging classes and utilities
 */

// Constants
export {
	DECK_TYPES,
	NON_EXPLOSIVE_TYPES,
	BULK_EXPLOSIVE_TYPES,
	HIGH_EXPLOSIVE_TYPES,
	INITIATOR_TYPES,
	SPACER_TYPES,
	DECOUPLED_CONTENT_CATEGORIES,
	DECOUPLED_CONTENT_TYPES,
	DEFAULT_DECK,
	CHARGING_DEFAULTS,
	VALIDATION_MESSAGES,
	CHARGING_STORES,
	KAP_VERSION,
	SCHEMA_VERSION,
	DECK_COLORS,
	CHARGE_CONFIG_CODES
} from "./ChargingConstants.js";

// Core classes
export { Deck, generateUUID } from "./Deck.js";
export { DecoupledContent } from "./DecoupledContent.js";
export { Primer } from "./Primer.js";
export { HoleCharging } from "./HoleCharging.js";
export { ChargeConfig } from "./ChargeConfig.js";

// Products
export { Product } from "./products/Product.js";
export { NonExplosiveProduct } from "./products/NonExplosiveProduct.js";
export { BulkExplosiveProduct } from "./products/BulkExplosiveProduct.js";
export { HighExplosiveProduct } from "./products/HighExplosiveProduct.js";
export {
	InitiatorProduct,
	ElectronicDetonator,
	ShockTubeDetonator,
	ElectricDetonator,
	DetonatingCordProduct
} from "./products/InitiatorProduct.js";
export { SpacerProduct } from "./products/SpacerProduct.js";
export { createProductFromJSON } from "./products/productFactory.js";

// Validation
export {
	validateHoleCharging,
	validateDeckContiguity,
	validatePrimers,
	validateAllCharging
} from "./ChargingValidation.js";

// Database persistence
export {
	ALL_CHARGING_STORES,
	saveProductsToDB,
	loadProductsFromDB,
	saveChargingToDB,
	loadChargingFromDB,
	saveChargeConfigsToDB,
	loadChargeConfigsFromDB,
	debouncedSaveProducts,
	debouncedSaveCharging,
	debouncedSaveConfigs
} from "./ChargingDatabase.js";

// Config import/export
export {
	exportBaseConfigTemplate,
	exportCurrentConfig,
	importConfigFromZip
} from "./ConfigImportExport.js";

// UI
export { showProductManagerDialog } from "./ProductDialog.js";
export { showDeckBuilderDialog } from "./ui/DeckBuilderDialog.js";
export { HoleSectionView } from "./ui/HoleSectionView.js";

// Rule engine
export { applyChargeRule } from "./rules/SimpleRuleEngine.js";

// Charging key remapper
export { remapChargingKeys, extractPlainIdRemap } from "./ChargingRemapper.js";
