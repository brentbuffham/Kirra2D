/**
 * @fileoverview HighExplosiveProduct - Boosters, PackagedEmulsion, Pentolite
 * Used in DECOUPLED deck contents and Primer boosters
 */

import { Product } from "./Product.js";

export class HighExplosiveProduct extends Product {
	constructor(options) {
		super(Object.assign({}, options, { productCategory: "HighExplosive" }));
		this.massGrams = options.massGrams || null;
		this.diameterMm = options.diameterMm || null;
		this.lengthMm = options.lengthMm || null;
		this.vodMs = options.vodMs || null;           // Velocity of detonation m/s
		this.reKjKg = options.reKjKg || null;         // Relative energy kJ/kg
		this.waterResistant = options.waterResistant || false;
		this.capSensitive = options.capSensitive || false;
	}

	toJSON() {
		return Object.assign(Product.prototype.toJSON.call(this), {
			massGrams: this.massGrams,
			diameterMm: this.diameterMm,
			lengthMm: this.lengthMm,
			vodMs: this.vodMs,
			reKjKg: this.reKjKg,
			waterResistant: this.waterResistant,
			capSensitive: this.capSensitive
		});
	}

	static fromJSON(obj) {
		return new HighExplosiveProduct(obj);
	}
}
