/**
 * @fileoverview Product Factory - Dispatches fromJSON to correct product subclass
 */

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
