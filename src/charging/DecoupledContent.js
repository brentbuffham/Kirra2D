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
		this.deliveryVodMs = options.deliveryVodMs != null ? options.deliveryVodMs : null;  // m/s (0 = instant)
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
		var vod = this.deliveryVodMs || 0;
		var burnRateMs = (vod === 0) ? 0 : 1000 / vod;  // 0 VOD = instant, no burn time
		if (this.contentCategory === DECOUPLED_CONTENT_CATEGORIES.TRACE) {
			return burnRateMs * (this.length || 0);
		}
		if (this.isInitiator) {
			var burn = burnRateMs * (this.length || 0);
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
			deliveryVodMs: this.deliveryVodMs,
			delayMs: this.delayMs,
			serialNumber: this.serialNumber,
			coreLoadGramsPerMeter: this.coreLoadGramsPerMeter
		};
	}

	static fromJSON(obj) {
		return new DecoupledContent(obj);
	}
}
