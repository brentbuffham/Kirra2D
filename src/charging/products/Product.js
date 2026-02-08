/**
 * @fileoverview Product Base Class
 * All charging products (explosives, stemming, initiators, spacers) extend this.
 */

import { generateUUID } from "../Deck.js";

export class Product {
	constructor(options) {
		this.productID = options.productID || generateUUID();
		this.productCategory = options.productCategory || "Unknown";
		this.productType = options.productType || "";
		this.name = options.name || "Unnamed Product";
		this.supplier = options.supplier || "";
		this.density = options.density || 0;
		this.colorHex = options.colorHex || "#CCCCCC";
		this.description = options.description || "";
		this.created = options.created || new Date().toISOString();
		this.modified = new Date().toISOString();
	}

	toJSON() {
		return {
			productID: this.productID,
			productCategory: this.productCategory,
			productType: this.productType,
			name: this.name,
			supplier: this.supplier,
			density: this.density,
			colorHex: this.colorHex,
			description: this.description,
			created: this.created,
			modified: this.modified
		};
	}

	static fromJSON(obj) {
		return new Product(obj);
	}
}
