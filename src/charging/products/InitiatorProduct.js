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
		this.deliveryVodMs = options.deliveryVodMs != null ? options.deliveryVodMs : 0;  // m/s (0 = instant/infinity)
		this.shellDiameterMm = options.shellDiameterMm || 7.6;
		this.shellLengthMm = options.shellLengthMm || 98;
	}

	/**
	 * Computed burn rate in ms per meter from delivery VOD
	 * 0 VOD = instant (infinite speed) → 0 ms/m burn rate
	 */
	get burnRateMs() {
		if (!this.deliveryVodMs || this.deliveryVodMs === 0) return 0;
		return 1000 / this.deliveryVodMs;
	}

	toJSON() {
		return Object.assign(Product.prototype.toJSON.call(this), {
			initiatorType: this.initiatorType,
			deliveryVodMs: this.deliveryVodMs,
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
		super(Object.assign({}, options, { initiatorType: "Electronic", deliveryVodMs: 0 }));  // instant
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
		super(Object.assign({}, options, {
			initiatorType: "ShockTube",
			deliveryVodMs: options.deliveryVodMs != null ? options.deliveryVodMs : 2000  // 2000 m/s
		}));
		this.timingType = "fixed_series";
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
		super(Object.assign({}, options, { initiatorType: "Electric", deliveryVodMs: 0 }));  // instant
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
		super(Object.assign({}, options, {
			initiatorType: "DetonatingCord",
			deliveryVodMs: options.deliveryVodMs != null ? options.deliveryVodMs : 7000  // 7000 m/s
		}));
		this.timingType = "continuous";
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
