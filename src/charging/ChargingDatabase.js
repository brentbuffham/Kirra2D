/**
 * @fileoverview ChargingDatabase - IndexedDB persistence for charging system
 * Follows existing Kirra patterns: debouncedSave*, save*ToDB, load*FromDB
 *
 * Stores:
 *   CHARGING_PRODUCTS  - Product definitions (Map: productID -> Product)
 *   CHARGING_DATA      - HoleCharging per hole (Map: holeID -> HoleCharging)
 *   CHARGE_CONFIGS     - ChargeConfig templates (Map: configID -> ChargeConfig)
 *
 * Uses the same DB instance as kirra.js (window.db / passed db reference)
 */

import { HoleCharging } from "./HoleCharging.js";
import { ChargeConfig } from "./ChargeConfig.js";
import { createProductFromJSON } from "./products/productFactory.js";

// Store names - must be added to REQUIRED_STORES in kirra.js
export const CHARGING_PRODUCTS_STORE = "CHARGING_PRODUCTS";
export const CHARGING_DATA_STORE = "CHARGING_DATA";
export const CHARGE_CONFIGS_STORE = "CHARGE_CONFIGS";

// All charging stores for registration
export const ALL_CHARGING_STORES = [
	CHARGING_PRODUCTS_STORE,
	CHARGING_DATA_STORE,
	CHARGE_CONFIGS_STORE
];

// ============ PRODUCTS ============

/**
 * Save all products to IndexedDB
 * @param {IDBDatabase} db - Database instance
 * @param {Map} productsMap - productID -> Product
 */
export function saveProductsToDB(db, productsMap) {
	if (!db) {
		console.error("DB not initialized. Cannot save products.");
		return;
	}

	var transaction = db.transaction([CHARGING_PRODUCTS_STORE], "readwrite");
	var store = transaction.objectStore(CHARGING_PRODUCTS_STORE);
	var request;

	if (!productsMap || productsMap.size === 0) {
		request = store.delete("chargingProductsData");
	} else {
		var dataToStore = [];
		productsMap.forEach(function(product, productID) {
			dataToStore.push([productID, product.toJSON()]);
		});
		request = store.put({
			id: "chargingProductsData",
			data: dataToStore
		});
	}

	request.onerror = function(event) {
		console.error("Error saving products to IndexedDB:", event.target.error);
	};

	request.onsuccess = function() {
		console.log("Products saved to IndexedDB (" + (productsMap ? productsMap.size : 0) + " products)");
	};
}

/**
 * Load all products from IndexedDB
 * @param {IDBDatabase} db - Database instance
 * @returns {Promise<Map>} productID -> Product
 */
export function loadProductsFromDB(db) {
	return new Promise(function(resolve, reject) {
		if (!db) {
			console.error("DB not initialized. Cannot load products.");
			return reject("DB not initialized");
		}

		var transaction = db.transaction([CHARGING_PRODUCTS_STORE], "readonly");
		var store = transaction.objectStore(CHARGING_PRODUCTS_STORE);
		var request = store.get("chargingProductsData");

		request.onsuccess = function(event) {
			var result = event.target.result;
			var productsMap = new Map();

			if (result && result.data && result.data.length > 0) {
				for (var i = 0; i < result.data.length; i++) {
					var entry = result.data[i];
					var productID = entry[0];
					var productJSON = entry[1];
					try {
						var product = createProductFromJSON(productJSON);
						productsMap.set(productID, product);
					} catch (err) {
						console.error("Error deserializing product " + productID + ":", err);
					}
				}
				console.log("Loaded " + productsMap.size + " products from IndexedDB");
			} else {
				console.log("No products data found in IndexedDB");
			}

			resolve(productsMap);
		};

		request.onerror = function(event) {
			console.error("Error loading products from IndexedDB:", event.target.error);
			reject(event.target.error);
		};
	});
}

// ============ HOLE CHARGING ============

/**
 * Save all hole charging data to IndexedDB
 * @param {IDBDatabase} db - Database instance
 * @param {Map} chargingMap - holeID -> HoleCharging
 */
export function saveChargingToDB(db, chargingMap) {
	if (!db) {
		console.error("DB not initialized. Cannot save charging data.");
		return;
	}

	var transaction = db.transaction([CHARGING_DATA_STORE], "readwrite");
	var store = transaction.objectStore(CHARGING_DATA_STORE);
	var request;

	if (!chargingMap || chargingMap.size === 0) {
		request = store.delete("chargingData");
	} else {
		var dataToStore = [];
		chargingMap.forEach(function(holeCharging, holeID) {
			dataToStore.push([holeID, holeCharging.toJSON()]);
		});
		request = store.put({
			id: "chargingData",
			data: dataToStore
		});
	}

	request.onerror = function(event) {
		console.error("Error saving charging data to IndexedDB:", event.target.error);
	};

	request.onsuccess = function() {
		console.log("Charging data saved to IndexedDB (" + (chargingMap ? chargingMap.size : 0) + " holes)");
	};
}

/**
 * Load all hole charging data from IndexedDB
 * @param {IDBDatabase} db - Database instance
 * @returns {Promise<Map>} holeID -> HoleCharging
 */
export function loadChargingFromDB(db) {
	return new Promise(function(resolve, reject) {
		if (!db) {
			console.error("DB not initialized. Cannot load charging data.");
			return reject("DB not initialized");
		}

		var transaction = db.transaction([CHARGING_DATA_STORE], "readonly");
		var store = transaction.objectStore(CHARGING_DATA_STORE);
		var request = store.get("chargingData");

		request.onsuccess = function(event) {
			var result = event.target.result;
			var chargingMap = new Map();

			if (result && result.data && result.data.length > 0) {
				for (var i = 0; i < result.data.length; i++) {
					var entry = result.data[i];
					var holeID = entry[0];
					var chargingJSON = entry[1];
					try {
						var holeCharging = HoleCharging.fromJSON(chargingJSON);
						chargingMap.set(holeID, holeCharging);
					} catch (err) {
						console.error("Error deserializing charging for hole " + holeID + ":", err);
					}
				}
				console.log("Loaded " + chargingMap.size + " hole charging records from IndexedDB");
			} else {
				console.log("No charging data found in IndexedDB");
			}

			resolve(chargingMap);
		};

		request.onerror = function(event) {
			console.error("Error loading charging data from IndexedDB:", event.target.error);
			reject(event.target.error);
		};
	});
}

// ============ CHARGE CONFIGS ============

/**
 * Save all charge configs to IndexedDB
 * @param {IDBDatabase} db - Database instance
 * @param {Map} configsMap - configID -> ChargeConfig
 */
export function saveChargeConfigsToDB(db, configsMap) {
	if (!db) {
		console.error("DB not initialized. Cannot save charge configs.");
		return;
	}

	var transaction = db.transaction([CHARGE_CONFIGS_STORE], "readwrite");
	var store = transaction.objectStore(CHARGE_CONFIGS_STORE);
	var request;

	if (!configsMap || configsMap.size === 0) {
		request = store.delete("chargeConfigsData");
	} else {
		var dataToStore = [];
		configsMap.forEach(function(config, configID) {
			dataToStore.push([configID, config.toJSON()]);
		});
		request = store.put({
			id: "chargeConfigsData",
			data: dataToStore
		});
	}

	request.onerror = function(event) {
		console.error("Error saving charge configs to IndexedDB:", event.target.error);
	};

	request.onsuccess = function() {
		console.log("Charge configs saved to IndexedDB (" + (configsMap ? configsMap.size : 0) + " configs)");
	};
}

/**
 * Load all charge configs from IndexedDB
 * @param {IDBDatabase} db - Database instance
 * @returns {Promise<Map>} configID -> ChargeConfig
 */
export function loadChargeConfigsFromDB(db) {
	return new Promise(function(resolve, reject) {
		if (!db) {
			console.error("DB not initialized. Cannot load charge configs.");
			return reject("DB not initialized");
		}

		var transaction = db.transaction([CHARGE_CONFIGS_STORE], "readonly");
		var store = transaction.objectStore(CHARGE_CONFIGS_STORE);
		var request = store.get("chargeConfigsData");

		request.onsuccess = function(event) {
			var result = event.target.result;
			var configsMap = new Map();

			if (result && result.data && result.data.length > 0) {
				for (var i = 0; i < result.data.length; i++) {
					var entry = result.data[i];
					var configID = entry[0];
					var configJSON = entry[1];
					try {
						var config = ChargeConfig.fromJSON(configJSON);
						configsMap.set(configID, config);
					} catch (err) {
						console.error("Error deserializing charge config " + configID + ":", err);
					}
				}
				console.log("Loaded " + configsMap.size + " charge configs from IndexedDB");
			} else {
				console.log("No charge configs found in IndexedDB");
			}

			resolve(configsMap);
		};

		request.onerror = function(event) {
			console.error("Error loading charge configs from IndexedDB:", event.target.error);
			reject(event.target.error);
		};
	});
}

// ============ DEBOUNCED SAVE HELPERS ============

var _productsSaveTimeout;
var _chargingSaveTimeout;
var _configsSaveTimeout;

/**
 * Debounced save for products (2 second delay)
 * @param {IDBDatabase} db
 * @param {Map} productsMap
 */
export function debouncedSaveProducts(db, productsMap) {
	clearTimeout(_productsSaveTimeout);
	_productsSaveTimeout = setTimeout(function() {
		console.log("Auto-saving products to DB...");
		if (db) {
			saveProductsToDB(db, productsMap);
		}
	}, 2000);
}

/**
 * Debounced save for hole charging (2 second delay)
 * @param {IDBDatabase} db
 * @param {Map} chargingMap
 */
export function debouncedSaveCharging(db, chargingMap) {
	clearTimeout(_chargingSaveTimeout);
	_chargingSaveTimeout = setTimeout(function() {
		console.log("Auto-saving charging data to DB...");
		if (db) {
			saveChargingToDB(db, chargingMap);
		}
	}, 2000);
}

/**
 * Debounced save for charge configs (2 second delay)
 * @param {IDBDatabase} db
 * @param {Map} configsMap
 */
export function debouncedSaveConfigs(db, configsMap) {
	clearTimeout(_configsSaveTimeout);
	_configsSaveTimeout = setTimeout(function() {
		console.log("Auto-saving charge configs to DB...");
		if (db) {
			saveChargeConfigsToDB(db, configsMap);
		}
	}, 2000);
}
