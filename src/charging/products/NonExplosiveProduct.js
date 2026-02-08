/**
 * @fileoverview NonExplosiveProduct - Air, Water, Stemming, StemGel, DrillCuttings
 * Used in INERT decks and as DECOUPLED deck backfill
 */

import { Product } from "./Product.js";

export class NonExplosiveProduct extends Product {
	constructor(options) {
		super(Object.assign({}, options, { productCategory: "NonExplosive" }));
		this.particleSizeMm = options.particleSizeMm || null;
	}

	toJSON() {
		return Object.assign(Product.prototype.toJSON.call(this), {
			particleSizeMm: this.particleSizeMm
		});
	}

	static fromJSON(obj) {
		return new NonExplosiveProduct(obj);
	}
}
