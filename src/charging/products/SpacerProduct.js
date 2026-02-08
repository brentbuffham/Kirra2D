/**
 * @fileoverview SpacerProduct - GasBag, StemCap, StemBrush, StemPlug, StemLock
 * Used in SPACER decks
 */

import { Product } from "./Product.js";

export class SpacerProduct extends Product {
	constructor(options) {
		super(Object.assign({}, options, { productCategory: "Spacer" }));
		this.spacerType = options.spacerType || "GasBag";
		this.lengthMm = options.lengthMm || null;
		this.diameterMm = options.diameterMm || null;
	}

	toJSON() {
		return Object.assign(Product.prototype.toJSON.call(this), {
			spacerType: this.spacerType,
			lengthMm: this.lengthMm,
			diameterMm: this.diameterMm
		});
	}

	static fromJSON(obj) {
		return new SpacerProduct(obj);
	}
}
