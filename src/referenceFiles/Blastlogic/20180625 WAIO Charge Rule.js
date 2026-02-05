/**
* History
* 20180620 - Added Charge Rule Condition for Stem Style Short Holes - Brent Buffham
* 20180620 - Added Venting Condition on Vent Style Short Holes - Brent Buffham
* 20180621 - Added Charge Ratio considerations to Nominated Charge Amounts when holes are less than 20% of Design depth - Brent Buffham
* 20180621 - Altered the DNC code to use a specific stemming product
*
*
*
*
*/



/**
 * Main function.
 * @param {Params} params - Charge rule parameters.
 * @param {Hole} hole - The hole object.
 * @param {BuiltInProduct} products - Built-in blast products.
 */
function rule(params, hole, products) {
    // Fill the hole conditionally with either a load table or a single product.
    // Fill the hole conditionally with either a load table or a single product.
    fillConditionally(hole, params, products)

    var holeWaterDepth = hole.length - hole.waterLength;
    // Replace all explosive decks if any of them are affected by water.
    replaceAllDecksIfAnyAffectedByWater(hole, holeWaterDepth, params.dampTolerance, params.dampChargeProduct, true);

    var holeDampDepth = hole.length - hole.wetLength;
    // Replace all explosive decks if any of them are affected by wet sides.
    replaceAllDecksIfAnyAffectedByWater(hole, holeDampDepth, params.wetTolerance, params.wetChargeProduct, false);

    // Consolidate explosive decks shorter than minChargeLength with the adjacent explosive deck.
    replaceShortExplosiveDecksWithExplosive(hole, params.minChargeLength, false);

    var primersPerColumn = [];
    var explosiveIntervals = hole.allExplosives().intervals;
    for (var index = 0; index < explosiveIntervals.length; ++index) {
        primersPerColumn[index] = 1;
    }

    // Load primer(s) into the hole, 0.5m from the bottom of the hole,
    // and then evenly spaced from there.
    var primerProducts = [params.boosterProduct, params.downHoleDelay];
    loadPrimers(hole, primersPerColumn, primerProducts, hole.length*0.1);
}

//////////////////// FUNCTIONS ////////////////////

/**
 * Fill holes that are too short with appropriate charges and designated stemming Product.
 * @param {Hole} hole - The hole object.
 * @param {number} minimumHoleLength - Hole length minimum.
 * @param {BlastProduct} product - Product to use for backfill.
 * @return {boolean} - true if the hole was filled, false otherwise.
 */
//For Stemming Styled Hole Charge codes
function fillShortHoleStem(hole, minimumHoleLength, product) {
    if (hole.length < minimumHoleLength) {
        //debug("Hole is less than minimumHoleLength");
        if (hole.length > 4) {
			//message("Min Hole Length %fl", minimumHoleLength);
			hole.fill(hole.unallocated().lower(hole.length*0.50), params.dryChargeProduct);
			hole.fill(hole.unallocated(), params.stemmingProduct);
		}
		else if (hole.length <= 4 && hole.length >= 3) {
			//message("Min Hole Length %fl", minimumHoleLength);
			hole.fill(hole.unallocated().lower(hole.length*0.40), params.dryChargeProduct);
			hole.fill(hole.unallocated(), params.stemmingProduct);
		}
		else if (hole.length < 3 && hole.length >= 2) {
			//message("Min Hole Length %fl", minimumHoleLength);
			hole.fill(hole.unallocated().lower(hole.length*0.25), params.dryChargeProduct);
			hole.fill(hole.unallocated(), params.stemmingProduct);
		}
		else if (hole.length < 2 && hole.length >= 1) {
			//message("Min Hole Length %fl", minimumHoleLength);
			hole.fillToMass(hole.unallocated(), params.dryChargeProduct, 5);
			hole.fill(hole.unallocated(), params.stemmingProduct);
		}
		else if (hole.length < 1) {
			hole.fill(hole.unallocated(), product);
		}
		else {
			hole.fill(hole.unallocated(), product);
		}
        return true;
    }

    return false;
}
/**
 * Fill holes that are too short with appropriate charges and "Air".
 * @param {Hole} hole - The hole object.
 * @param {number} minimumHoleLength - Hole length minimum.
 * @param {BlastProduct} product - Product to use for backfill.
 * @return {boolean} - true if the hole was filled, false otherwise.
 */
//For Vented Style Charging Codes
function fillShortHoleAir(hole, minimumHoleLength, product) {
    if (hole.length < minimumHoleLength) {
        //debug("Hole is less than minimumHoleLength");
        if (hole.length > 4) {
			//message("Min Hole Length %fl", minimumHoleLength);
			hole.fill(hole.unallocated().lower(hole.length*0.50), params.dryChargeProduct);
			hole.fill(hole.unallocated(), params.air);
		}
		else if (hole.length <= 4 && hole.length >= 3) {
			//message("Min Hole Length %fl", minimumHoleLength);
			hole.fill(hole.unallocated().lower(hole.length*0.30), params.dryChargeProduct);
			hole.fill(hole.unallocated(), params.air);
		}
		else if (hole.length < 3 && hole.length >= 2) {
			//message("Min Hole Length %fl", minimumHoleLength);
			hole.fill(hole.unallocated().lower(hole.length*0.20), params.dryChargeProduct);
			hole.fill(hole.unallocated(), params.air);
		}
		else if (hole.length < 2 && hole.length >= 1) {
			//message("Min Hole Length %fl", minimumHoleLength);
			hole.fillToMass(hole.unallocated(), params.dryChargeProduct, 5);
			hole.fill(hole.unallocated(), params.air);
		}
		else if (hole.length < 1) {
			hole.fill(hole.unallocated(), product);
		}
		else {
			hole.fill(hole.unallocated(), product);
		}
        return true;
    }

    return false;
}

/**
 * Fill holes that have a NOMINATED CHARGE and are off design depth by greater than 80% with a ratio adjusted amount.
 * @param {Hole} hole - The hole object.
 * @param {number} designLength - Hole length designed.
 * @param {number} lastKnownLength - Hole length current.
 * @param {number} adjustedChargeMass - Ratio adjusted nominated charge
 * @param {BlastProduct} product - Product to use for backfill.
 * @return {boolean} - true if the hole was filled, false otherwise.
 */
function nominatedChargeRatioAdjust(hole, designLength, lastKnownLength, product) {
	//Declare and instantiate a variable named adjustedChargeMass
	var adjustedChargeMass = 0;
	// if hole is less than 80% of the designed hole then work out the adjusted nominated charge and fill hole appropraitely
	if (lastKnownLength < (designLength*0.8)) { 
		adjustedChargeMass = (hole.length/(hole.targetLength/params.chargeDeckMass));
		hole.fillToMass(hole.unallocated(), product, adjustedChargeMass);
	}
	else
		hole.fillToMass(hole.unallocated(), product, params.chargeDeckMass);
}

//Fill Conditionally Code
function fillConditionally(hole, params, products) {

    var chargeCode = hole.properties.chargeConfig;

    //assign stemming to short holes based on table
    var chargeParameters = params.chargeParameters;

	//Decclaration of Variables
    var minimumHoleLength = NaN;
    var stemLength = NaN;
    var percStem = NaN;

    var holeHardness = hole.properties.hardness

    if (holeHardness == null) {
        error("Hole hardness has not been set under hole properties")
    }

    if (chargeCode == null) {
        error("Charge Code has not been set under hole properties")
    }

    if (isNaN(hole.diameter)) {
        error("Hole diameter has not been set under hole properties")
    }

    // split short table array
    var chargeParametersLines = chargeParameters.split("\n");
    for (var i = 0; i < chargeParametersLines.length; i++) {
        var stLine = chargeParametersLines[i];
        if (stLine.slice(0, 2) != "//") {
            var chargeInfo = stLine.split(",");

            if (chargeInfo.length < 5)
                error(" Charge Parameters defined at line" + i + " has missing values.");
            else if (chargeInfo.length > 5)
                error(" Charge Parameters defined at line" + i + " has extra values and could not be parsed.");
            else {

                var targetDiameter = Number(chargeInfo[0]);
                var hardness = chargeInfo[1].trim();

                if (isClose(hole.diameter, targetDiameter, 0.001) && hole.properties.hardness == hardness) {
                    minimumHoleLength = Number(chargeInfo[2]);
                    stemLength = Number(chargeInfo[3]);
                    percStem = Number(chargeInfo[4]);

                }
            }
        }
    }

    if (isNaN(minimumHoleLength) || isNaN(stemLength) || isNaN(percStem)) {
        error("Could not find an entry for hole with diameter %.03fL and hardness %s. Please review your hole parameters",
            hole.diameter, holeHardness)
    }

    if (stemLength > percStem * hole.unallocated().length) {
        stemLength = percStem * hole.unallocated().length
    }

    // Fill short holes with air
	//var holeFilled = 
	//fillShortHoleStem(hole, minimumHoleLength, products.air);
    //Charge Code SC
    if ((chargeCode == "SC")) {
		//Used for Venting Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "SC");
		// apply the Nominated Charge Mass Adjustment method to avoid overloads on nominated charges.
        nominatedChargeRatioAdjust(hole, hole.targetLength, hole.unallocated.length, params.dryChargeProduct);
        hole.fill(hole.unallocated(), params.stemmingProduct);
		message("CONFIG: SC");
    }
    //Charge Code SCSB
    else if ((chargeCode == "SCSB")) {
		//Used for Venting Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "SCSB");
        // apply the Nominated Charge Mass Adjustment method to avoid overloads on nominated charges.
        nominatedChargeRatioAdjust(hole, hole.targetLength, hole.unallocated.length, params.dryChargeProduct);
        hole.fill(hole.unallocated().upper(params.stemLength), params.stemmingProduct);
        if (hole.unallocated().length > params.gBag.length) {
            hole.fill(hole.unallocated().upper(params.gBag.length), params.gBag);
        }
        hole.fill(hole.unallocated(), params.air);
		message("CONFIG: SCSB");
    }
    //Charge Code SCS
    else if ((chargeCode == "SCS")) {
		//Used for Venting Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "SCS");
        // apply the Nominated Charge Mass Adjustment method to avoid overloads on nominated charges.
        nominatedChargeRatioAdjust(hole, hole.targetLength, hole.unallocated.length, params.dryChargeProduct);
        hole.fill(hole.unallocated().lower(params.stemLength), params.stemmingProduct);
        hole.fill(hole.unallocated(), params.air);
		message("CONFIG: SCS");
    }
    //Charge Code UC
    else if ((chargeCode == "UC")) {
		//Used for Venting Style Charge Codes
		fillShortHoleAir(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "UC");
        // apply the Nominated Charge Mass Adjustment method to avoid overloads on nominated charges.
        nominatedChargeRatioAdjust(hole, hole.targetLength, hole.unallocated.length, params.dryChargeProduct);
        hole.fill(hole.unallocated(), params.air);
		message("CONFIG: UC");
    }
    //Charge Code SSAB
    else if ((chargeCode == "SSAB")) {
		//Used for Venting Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "SSAB");
        hole.fill(hole.unallocated().upper(params.stemLength), params.stemmingProduct);

        if (hole.unallocated().length > params.gBag.length) {
            hole.fill(hole.unallocated().upper(params.gBag.length), params.gBag);
        }
        hole.fill(hole.unallocated().upper(params.airDeckLength), params.air);
        hole.fill(hole.unallocated(), params.dryChargeProduct);
		message("CONFIG: SSAB");
    }

    //Charge Code SSDB - Additional code where Charge takes priority
    else if ((chargeCode == "SSDB")) {
		//Used for Venting Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "SSDB");
        //Charge hole stemming component
        hole.fill(hole.unallocated().upper(params.stemLength), params.stemmingProduct);
        //Charge the Design KG
        hole.fill(hole.unallocated().lower(hole.targetLength - params.stemLength - params.airDeckLength), params.dryChargeProduct);
		//Place an airbag in the hole
		if (hole.unallocated().length > params.gBag.length) {
            hole.fill(hole.unallocated().upper(params.gBag.length), params.gBag);
        }
		//Charge the leftover hole with air - if designed state it will be the airDeckLength
        hole.fill(hole.unallocated(), params.air);
		message("CONFIG: SSDB");
    }
    //
    //Charge Code STS
    else if ((chargeCode == "STS")) {
		//Used for Venting Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
		debug(params.t__debug, "STS");
        // apply the Nominated Charge Mass Adjustment method to avoid overloads on nominated charges.
        nominatedChargeRatioAdjust(hole, hole.targetLength, hole.unallocated.length, params.dryChargeProduct);
        hole.fillToMass(hole.unallocated(), params.toeChargeProduct, params.chargeDeckMass);
        hole.fill(hole.unallocated(), params.dryChargeProduct);
		message("CONFIG: STS");
    }
    //Charge Code SS
    else if ((chargeCode == "SS")) {
		//Used for Venting Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "SS");
        hole.fill(hole.unallocated().upper(params.stemLength), params.stemmingProduct);
        hole.fill(hole.unallocated(), params.dryChargeProduct);
		message("CONFIG: SS");
    }
    //Charge Code S
    else if ((chargeCode == "S")) {
		//Used for Venting Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "S");
        hole.fill(hole.unallocated().upper(stemLength), params.stemmingProduct);
        hole.fill(hole.unallocated(), params.dryChargeProduct);
		message("CONFIG: S");
    }
    //Charge Code U
    else if ((chargeCode == "U")) {
		//Used for Venting Style Charge Codes
		fillShortHoleAir(hole, minimumHoleLength, products.air); 
        debug(params.t__debug, "U");
        hole.fill(hole.unallocated().upper(stemLength), params.air);
        hole.fill(hole.unallocated(), params.dryChargeProduct);
		message("CONFIG: U");
    }
    //Charge Code ST
    else if ((chargeCode == "ST")) {
		//Used for Stemmed Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "ST");
        hole.fill(hole.unallocated().upper(stemLength), params.stemmingProduct);
        // apply the Nominated Charge Mass Adjustment method to avoid overloads on nominated charges.
        nominatedChargeRatioAdjust(hole, hole.targetLength, hole.unallocated.length, params.dryChargeProduct);
        hole.fill(hole.unallocated(), params.dryChargeProduct);
		message("CONFIG: ST");
    }
    //Charge Code PP
    else if ((chargeCode == "PP")) {
		//Used for Venting Style Charge Codes
		fillShortHoleStem(hole, minimumHoleLength, products.air);
        debug(params.t__debug, "PP");
        stemLength = (1 - params.ratioExplosive) * hole.unallocated().length;
        hole.fill(hole.unallocated().upper(stemLength), params.stemmingProduct);
        hole.fill(hole.unallocated(), params.dryChargeProduct);
		message("CONFIG: PP");
    }
    //Charge Code DNC
    else if ((chargeCode == "DNC")) {
		hole.fill(hole.unallocated(), params.doNotCharge); //Make a new Product called DO_NOT_CHARGE
		message("NO EXCEPTIONS");
		message("DO NOT CHARGE");

    }
	// All OTHER CASES FILL WITH AIR
	else {
        debug(params.t__debug, "DNC");
        hole.fill(hole.unallocated(), products.air);
    }
}



/**
 * This function will replace all explosive decks in a hole with the given product. 
 * Replacement will occur if the provided water/wet sides level sits at least 
 * maximumWetLength above the bottom most explosive deck.
 * @param {Hole} hole - The hole object.
 * @param {number} wetDepth - The depth in the hole where water/wet sides begins.
 * @param {number} maximumWetLength - Maximum length of water/wet sides, 
 *                                   taken from the bottom of the hole.
 * @param {BlastProduct} product - Product to replace water affected decks with.
 * @param {bool} replacingWater - True if this function is used to replace water
 *                                affected decks. False if it used to replace
 *                                decks with wet sides.
 */
function replaceAllDecksIfAnyAffectedByWater(hole, wetDepth, maximumWetLength, product, replacingWater) {

    var explosiveIntervals = hole.allExplosives().intervals;
    if (explosiveIntervals.length == 0) return;

    var bottomDeck = explosiveIntervals[explosiveIntervals.length - 1];
    var bottomDeckWetLimit = bottomDeck.bottom - maximumWetLength;

    // If the wet depth does not exceed the maximum allowed then we have no
    // work to do.
    if (isNaN(wetDepth) || wetDepth > bottomDeckWetLimit) return;

    // Give the user a warning if the product to swap in is not water/damp resistant.
    if (replacingWater && !product.isWaterResistant) {
        message("WARNING: Product selected to swap with water affected decks is " +
            "not water resistant: %s", product.name);
    } else if (!product.isDampResistant) {
        message("WARNING: Product selected to swap with wet sides affected decks is " +
            "not damp resistant: %s", product.name);
    }

    // Otherwise, replace all the products.
    var decks = hole.allDecks().decks;
    for (var index = 0; index < decks.length; ++index) {
        var deck = decks[index];
        if (!deck.product.isExplosive) continue;

        // No need to swap products if the product is already water resistant.
        if (replacingWater && deck.product.isWaterResistant) continue;
        else if (deck.product.isDampResistant) continue;

        var interval = deck.interval;
        hole.fill(interval, product);

        if (params.t__debug) {
            message("@Replaced deck (%.1fL(m|ft) -> %.1fL(m|ft)) with %s",
                interval.top, interval.bottom, product.name);
        }
    }
}

/**
 * Replace explosive decks that are deemed too short, with the closest explosive product.
 * @param {Hole} hole - The hole object.
 * @param {number} tolerance - Deck length tolerance.
 * @param {bool} revertToAlternateProduct - 
 *               If set to true, short explosive decks sandwiched
 *               between two other inert decks will consolidate
 *               with the top inert deck.
 */
function replaceShortExplosiveDecksWithExplosive(hole, tolerance, revertToAlternateProduct) {
    var allDecks = hole.allDecks().decks;
    if (allDecks.length <= 1) return;

    for (var index = 0; index < allDecks.length; ++index) {
        var deck = allDecks[index];

        if (!deck.product.isExplosive) continue;

        if (deck.span <= tolerance) {
            if (index == 0) {
                if (!allDecks[index + 1].product.isExplosive && revertToAlternateProduct) {
                    // Product below is inert and the fallback is enabled.
                    allDecks[index + 1] = combineDecks(hole, deck, allDecks[index + 1]);
                } else {
                    error("Product below the deck (%.2fL(m|ft) -> %.2fL(m|ft)) is explosive.\n" +
                        "It cannot be consolidated with an explosive deck.",
                        deck.top, deck.bottom);
                }
            } else if (index == (allDecks.length - 1)) {
                // Last deck in the hole, only check the deck above.
                if (allDecks[index - 1].product.isExplosive || revertToAlternateProduct) {
                    allDecks[index] = combineDecks(hole, allDecks[index - 1], deck);
                } else {
                    error("Product above the deck (%.2fL(m|ft) -> %.2fL(m|ft)) is inert.\n" +
                        "Consider consolidating with an inert deck, or using the revert option.",
                        deck.top, deck.bottom);
                }
            } else {
                if (isUndefined(deck.product) || deck.product.isExplosive) {
                    // Current deck product is either undefined or is explosive.
                    if (allDecks[index + 1].product.isExplosive) {
                        // Product below is explosive, use that product.
                        allDecks[index + 1] = combineDecks(hole, deck, allDecks[index + 1]);
                    } else if (allDecks[index - 1].product.isExplosive || revertToAlternateProduct) {
                        // Product above is explosive so we can use that, OR
                        // revert to using above inert product.
                        allDecks[index] = combineDecks(hole, allDecks[index - 1], deck);
                    } else {
                        error("Products closest to the deck (%.2fL(m|ft) -> %.2fL(m|ft)) are inert.\n" +
                            "Consider consolidating with an inert deck, or using the revert option.",
                            deck.top, deck.bottom);
                    }
                }
            }
        }
    }
}

/**
 * Fill 'deck' with the same product as 'deckBelow'.
 * @param {Hole} hole - The hole object.
 * @param {Deck} deck - Deck to fill.
 * @param {Deck} deckBelow - The deck object below 'deck'.
 * @returns {Deck} - The new deck. A combination of the current deck, 
 *                   and the one below.
 */
function fillUsingProductBelow(hole, deck, deckBelow) {
    var productBelow = deckBelow.product;

    if (isUndefined(productBelow)) {
        error("Product below the deck (%.2fL(m|ft) -> %.2fL(m|ft)) is undefined.",
            deck.top, deck.bottom);
    }

    if (params.t__debug) {
        message("@Filling deck (%.2fL(m|ft) -> %.2fL(m|ft)) with product from deck below (%s)",
            deck.top, deck.bottom, productBelow.name);
    }

    hole.fill(deck.interval, productBelow);

    // Create a new deck that encapsulates the combined decks we have just made.
    var newInterval = deck.interval.unionWith(deckBelow.interval);
    var newQuantity = deck.quantity + deckBelow.quantity;
    return new Deck(hole, newInterval, productBelow, newQuantity);
}

/**
 * Fill 'deck' with the same product as 'deckAbove'.
 * @param {Hole} hole - The hole object.
 * @param {Deck} deck - Deck to fill.
 * @param {Deck} deckAbove - The deck object above 'deck'.
 * @returns {Deck} - The new deck. A combination of the current deck, 
 *                   and the one above.
 */
function fillUsingProductAbove(hole, deck, deckAbove) {
    var productAbove = deckAbove.product;

    if (isUndefined(productAbove)) {
        error("Product above the deck (%.2fL(m|ft) -> %.2fL(m|ft)) is undefined.",
            deck.top, deck.bottom);
    }

    if (params.t__debug) {
        message("@Filling deck (%.2fL(m|ft) -> %.2fL(m|ft)) with product from deck above (%s)",
            deck.top, deck.bottom, productAbove.name);
    }

    hole.fill(deck.interval, productAbove);

    // Create a new deck that encapsulates the combined decks we have just made.
    var newInterval = deck.interval.unionWith(deckAbove.interval);
    var newQuantity = deck.quantity + deckAbove.quantity;
    return new Deck(hole, newInterval, productAbove, newQuantity);
}

/**
 * Combines two decks. The product from the larger of the two decks is used
 * to fill the combined length of the decks.
 * @param {Hole} hole - The hole object.
 * @param {Deck} deck - Deck to fill.
 * @param {Deck} deckBelow - The deck object below 'deck'.
 * @returns {Deck} - A new deck - the combination of the two decks.
 */
function combineDecks(hole, deck, deckBelow) {
    if (deck.length > deckBelow.length) {
        return fillUsingProductAbove(hole, deckBelow, deck);
    }

    return fillUsingProductBelow(hole, deck, deckBelow);
}
/**
 * Place primers in each explosive column. The number of primers and specific
 * primer products are controlled by the 'numberOfPrimers' and 'primerProducts'
 * parameters.
 * After the first primer is placed, the remaining primers are loaded evenly
 * into the remaining space.
 * @param {Hole} hole - The hole object.
 * @param {int[]} primersPerColumn - Number of primers to be placed in each explosive column.
 *                                   Primers per column are specified top down.
 * @param {BlastProduct[]} products - Primer products to put down the hole.
 * @param {number} primerSpacing - Position in the explosive column to place the first primer.
 *                                (For the "evenly spaced" loading scenario, this is the
 *                                 minimum spacing between adjacent primers.
 *                                 For the "clustered" loading scenario, this is the
 *                                 position within the column to load all primers.)
 */
function loadPrimers(hole, primersPerColumn, primerProducts, primerSpacing) {
    for (var primerIndex = 0; primerIndex < primerProducts.length; ++primerIndex) {
        var primerProduct = primerProducts[primerIndex];

        if (primerProduct instanceof BlastProductFamily ||
            primerProduct instanceof FilteredBlastProductFamily) {
            // Blast product families are valid primer products.
            continue;
        }

        if (!primerProduct.isPrimerProduct) {
            error("The product provided to 'loadPrimers' (%s) is not a valid primer product",
                primerProduct.name);
        }
    }

    var explosiveIntervals = hole.allExplosives().intervals;
    if (primersPerColumn.length < explosiveIntervals.length) {
        error("The array 'primersPerColumn' must contain at least the same number " +
            "of elements as the number of explosive columns in the hole.");
    }

    for (var index = 0; index < explosiveIntervals.length; ++index) {
        var interval = explosiveIntervals[index];

        // Cannot load primers into intervals with span < 0.05m.
        if (interval.length < 0.05) {
            error("Primer at depth %.1fL(m|ft) cannot be loaded into column with " +
                "length less than %.2fL(m|ft)", interval.top, 0.05);
        }

        loadPrimersInColumnFromBottom(hole, interval, primersPerColumn[index], primerProducts, primerSpacing);
    }
}

/**
 * Place a primer 'firstPrimerSpacing' from the bottom of the hole, and then
 * place the remaining primers evenly within the remaining space.
 * @param {Hole} hole - The hole object.
 * @param {Interval} interval - The explosive column that will be loaded with primers.
 * @param {int} numberOfPrimers - Number of primers to be placed in each explosive column.
 * @param {BlastProduct[]} primerProducts - Primer products to put down the hole.
 * @param {number} firstPrimerSpacing - Position from the bottom of the explosive column to place the first primer.
 */
function loadPrimersInColumnFromBottom(hole, interval, numberOfPrimers, primerProducts, firstPrimerSpacing) {

    if (numberOfPrimers <= 0) return;

    var bottomPrimer = interval.bottom - firstPrimerSpacing;
    var primerSpacer = (bottomPrimer - interval.top) / numberOfPrimers;

    // Cannot load above the provided explosive interval.
    if (bottomPrimer < interval.top) {
        message("@Primers will be positioned outside the explosive column.\n" +
            "Minimum primer depth for this interval is %%.1fL(m|ft)",
            interval.top);

        bottomPrimer = interval.top + 0.1;
        primerSpacer = 0.01;
    }

    for (var primerIndex = 0; primerIndex < numberOfPrimers; ++primerIndex) {
        var primerDepth = bottomPrimer - (primerSpacer * primerIndex);
        debug("Placing primer at depth %%.1fL(m|ft)", primerDepth);

        hole.addPrimer(primerDepth, primerProducts);
    }
}

/**
 * Prints a simple debug message when the 'active' boolean is true
 * @param {string} information - Message to display to the user.
 * @param {value} argument1 - Argument to display within the message.
 * @param {value} argument2 - Argument to display within the message.
 */
function debug(information, argument1, argument2) {
    if (params.t__debug) {
        // The '@' symbol will stop messages from being displayed on the tablet.
        information = "@" + information;
        if (isUndefined(argument1) && isUndefined(argument2)) {
            message(information);
        } else if (isUndefined(argument2)) {
            message(information, argument1);
        } else {
            message(information, argument1, argument2);
        }
    }
}

/////////////////// FOR INTERACTIVE DEBUGGING PURPOSES ONLY ////////////////////

// The following allows for this script to be debugged using an external
// IDE with debugging support. It does not run when executed on the BlastLogic
// Desktop. It can be safely left at the bottom of this script.

if (typeof process !== 'undefined' && process.argv.includes('--debug')) {
    try {
        // ChargeCalculations and supporting objects are included in here:
        eval(require('fs').readFileSync('debug/TestHarness.js') + '');

        // Run the charge rule.
        rule(params, hole, products);

        // Print out a table of primers and decks that were loaded.
        printDecksAndPrimers(hole);
    } catch (err) {
        if (typeof err.args === 'undefined') {
            errorMsg(err.message);
        } else {
            errorMsg(err.args);
        }
    }
}
