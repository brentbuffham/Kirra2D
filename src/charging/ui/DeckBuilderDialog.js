/**
 * @fileoverview DeckBuilderDialog - Drag-drop deck builder using FloatingDialog
 *
 * Layout:
 *   Left panel:  Product palette (draggable items from window.loadedProducts)
 *   Right panel: HoleSectionView (drop target, interactive canvas)
 *   Bottom:      Deck properties editor + action buttons
 *
 * Usage: showDeckBuilderDialog(referenceHole)
 */

import { FloatingDialog, createEnhancedFormContent, getFormData, showModalMessage, showConfirmationDialog } from "../../dialog/FloatingDialog.js";
import { HoleSectionView } from "./HoleSectionView.js";
import { HoleCharging } from "../HoleCharging.js";
import { Deck } from "../Deck.js";
import { Primer } from "../Primer.js";
import { DecoupledContent } from "../DecoupledContent.js";
import { DECK_TYPES, DECK_COLORS, DECOUPLED_CONTENT_CATEGORIES, CHARGE_CONFIG_CODES } from "../ChargingConstants.js";
import { ChargeConfig } from "../ChargeConfig.js";
import { isFormula, evaluateFormula } from "../../helpers/FormulaEvaluator.js";

/**
 * Determine the deck type for a product based on its category
 */
function deckTypeForProduct(product) {
    switch (product.productCategory) {
        case "NonExplosive":
            return DECK_TYPES.INERT;
        case "BulkExplosive":
            return DECK_TYPES.COUPLED;
        case "HighExplosive":
            return DECK_TYPES.DECOUPLED;
        case "Spacer":
            return DECK_TYPES.SPACER;
        default:
            return DECK_TYPES.INERT;
    }
}

/**
 * Build a product snapshot suitable for storing on a Deck
 */
function productSnapshot(product) {
    return {
        productID: product.productID || null,
        name: product.name,
        productType: product.productType || null,
        productCategory: product.productCategory,
        density: product.density || 0,
        colorHex: product.colorHex || null,
        diameterMm: product.diameterMm || null,
        lengthMm: product.lengthMm || null,
        massGrams: product.massGrams || null
    };
}

/**
 * Build indexed charge formula context from a HoleCharging's decks.
 * Mirrors SimpleRuleEngine.buildIndexedChargeVars() for local use in the dialog.
 */
function buildFormulaCtxFromDecks(workingCharging) {
    var holeLen = Math.abs(workingCharging.holeLength);
    var ctx = {
        holeLength: holeLen,
        holeDiameter: workingCharging.holeDiameterMm || 115,
        chargeLength: 0,
        chargeTop: 0,
        chargeBase: holeLen,
        stemLength: 0
    };
    var chargeIndex = 0;
    var deepestBase = 0;
    var deepestTop = 0;
    var deepestLen = 0;
    var firstChargeTop = null;

    for (var i = 0; i < workingCharging.decks.length; i++) {
        var d = workingCharging.decks[i];
        var dt = d.deckType;
        if (dt === DECK_TYPES.COUPLED || dt === DECK_TYPES.DECOUPLED) {
            chargeIndex++;
            var cTop = d.topDepth;
            var cBase = d.baseDepth;
            var cLen = cBase - cTop;
            ctx["chargeBase_" + chargeIndex] = cBase;
            ctx["chargeTop_" + chargeIndex] = cTop;
            ctx["chargeLength_" + chargeIndex] = cLen;
            if (cBase >= deepestBase) {
                deepestBase = cBase;
                deepestTop = cTop;
                deepestLen = cLen;
            }
            if (firstChargeTop === null) firstChargeTop = cTop;
        }
    }
    ctx.chargeBase = deepestBase;
    ctx.chargeTop = deepestTop;
    ctx.chargeLength = deepestLen;
    ctx.stemLength = firstChargeTop !== null ? firstChargeTop : 0;
    return ctx;
}

/**
 * Show the Deck Builder dialog
 * @param {Object} [referenceHole] - A blast hole to use as reference for dimensions
 */
export function showDeckBuilderDialog(referenceHole) {
    // Resolve reference hole
    var refHole = referenceHole || null;
    if (!refHole && window.selectedHole) {
        refHole = window.selectedHole;
    }
    if (!refHole && window.selectedMultipleHoles && window.selectedMultipleHoles.length > 0) {
        refHole = window.selectedMultipleHoles[0];
    }
    if (!refHole && window.allBlastHoles && window.allBlastHoles.length > 0) {
        refHole = window.allBlastHoles[0];
    }
    if (!refHole) {
        showModalMessage("Deck Builder", "No blast holes loaded. Import holes first.", "warning");
        return;
    }

    // Track the last applied charge config so we can re-run it per-hole.
    // Wrapped in an object so nested/external functions can mutate it.
    var configTracker = { config: null };

    // Build or clone HoleCharging for the reference hole
    var existingCharging = window.loadedCharging ? window.loadedCharging.get(refHole.holeID) : null;
    var workingCharging;
    if (existingCharging) {
        workingCharging = HoleCharging.fromJSON(existingCharging.toJSON());
    } else {
        workingCharging = new HoleCharging(refHole);
    }

    // ======== BUILD CONTENT ========
    var contentDiv = document.createElement("div");
    contentDiv.style.display = "flex";
    contentDiv.style.flexDirection = "column";
    contentDiv.style.height = "100%";
    contentDiv.style.gap = "0";

    // Header info bar
    var infoBar = document.createElement("div");
    infoBar.className = "deck-builder-info";
    infoBar.innerHTML = "<span>Hole: <b>" + (refHole.holeID || "N/A") + "</b></span>" + "<span>Entity: <b>" + (refHole.entityName || "N/A") + "</b></span>" + "<span>Dia: <b>" + (refHole.holeDiameter || 0) + "mm</b></span>" + "<span>Length: <b>" + (refHole.holeLengthCalculated || 0).toFixed(1) + "m</b></span>";
    contentDiv.appendChild(infoBar);

    // Dimension mismatch warning (only when opening with existing charging)
    if (existingCharging && typeof existingCharging.checkDimensionMismatch === "function") {
        var mismatch = existingCharging.checkDimensionMismatch(refHole);
        if (mismatch.lengthChanged || mismatch.diameterChanged) {
            var mismatchBanner = document.createElement("div");
            mismatchBanner.className = "deck-builder-mismatch";
            var mismatchText = "Dimension mismatch: ";
            if (mismatch.lengthChanged) {
                mismatchText += "Length " + mismatch.oldLength.toFixed(1) + "m \u2192 " + mismatch.newLength.toFixed(1) + "m";
            }
            if (mismatch.lengthChanged && mismatch.diameterChanged) mismatchText += ", ";
            if (mismatch.diameterChanged) {
                mismatchText += "Diameter " + mismatch.oldDiameter.toFixed(0) + "mm \u2192 " + mismatch.newDiameter.toFixed(0) + "mm";
            }
            mismatchBanner.textContent = mismatchText;
            contentDiv.appendChild(mismatchBanner);
        }
    }

    // Main area: product palette + section view
    var mainArea = document.createElement("div");
    mainArea.style.cssText = "display:flex;flex:1;overflow:hidden;min-height:0;";
    contentDiv.appendChild(mainArea);

    // -------- LEFT: Product Palette --------
    var paletteDiv = document.createElement("div");
    paletteDiv.className = "deck-builder-palette";
    mainArea.appendChild(paletteDiv);

    var paletteTitle = document.createElement("div");
    paletteTitle.className = "deck-builder-palette-title";
    paletteTitle.textContent = "Products";
    paletteDiv.appendChild(paletteTitle);

    buildProductPalette(paletteDiv);

    // -------- RIGHT: Section View --------
    var sectionDiv = document.createElement("div");
    sectionDiv.style.cssText = "flex:1;display:flex;flex-direction:column;min-width:0;";
    mainArea.appendChild(sectionDiv);

    var sectionCanvas = document.createElement("canvas");
    sectionCanvas.style.cssText = "flex:1;width:100%;";
    sectionDiv.appendChild(sectionCanvas);

    var sectionView = new HoleSectionView({
        canvas: sectionCanvas,
        padding: 25,
        holeDiameterMm: refHole.holeDiameter || 115,
        fontSizeOffset: -1,
        onDeckSelect: function (deck, index) {
            updateDeckPropertiesPanel(deck, index);
        },
        onDeckResize: function () {
            workingCharging.modified = new Date().toISOString();
            sectionView.draw();
            updateSummary();
        },
        onPrimerSelect: function (primer, index) {
            updatePrimerInfo(primer, index);
        },
        onContentSelect: function (content, deckIndex, contentIndex) {
            updateContentInfo(content, deckIndex, contentIndex);
        }
    });
    sectionView.setData(workingCharging);

    // -------- BOTTOM: Properties + Actions --------
    var bottomArea = document.createElement("div");
    bottomArea.className = "deck-builder-bottom";
    contentDiv.appendChild(bottomArea);

    // Properties row
    var propsRow = document.createElement("div");
    propsRow.className = "deck-builder-props";
    propsRow.id = "deckBuilderPropsRow";
    propsRow.innerHTML = "<span style='opacity:0.5;'>Click a deck to edit properties</span>";
    bottomArea.appendChild(propsRow);

    // Summary row
    var summaryRow = document.createElement("div");
    summaryRow.className = "deck-builder-summary";
    summaryRow.id = "deckBuilderSummary";
    bottomArea.appendChild(summaryRow);

    // Action buttons
    var actionRow = document.createElement("div");
    actionRow.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
    bottomArea.appendChild(actionRow);

    function makeBtn(text, className, onClick) {
        var btn = document.createElement("button");
        btn.className = "floating-dialog-btn " + className;
        btn.textContent = text;
        btn.style.cssText = "font-size:11px;padding:4px 10px;";
        btn.addEventListener("click", onClick);
        return btn;
    }

    actionRow.appendChild(
        makeBtn("Add Primer", "option1", function () {
            addPrimerToCharging(workingCharging, sectionView, refHole);
        })
    );

    actionRow.appendChild(
        makeBtn("Edit", "option2", function () {
            editSelected(workingCharging, sectionView, refHole, function () { updateSummary(); });
        })
    );

    actionRow.appendChild(
        makeBtn("Remove", "deny", function () {
            removeSelected(workingCharging, sectionView, function () { updateSummary(); }, showInlineWarning, isFixedSpacer, findGapFillDeck);
        })
    );

    actionRow.appendChild(
        makeBtn("Clear", "cancel", function () {
            configTracker.config = null;
            workingCharging.clear();
            sectionView.setData(workingCharging);
            updateSummary();
        })
    );

    var spacer = document.createElement("div");
    spacer.style.flex = "1";
    actionRow.appendChild(spacer);

    actionRow.appendChild(
        makeBtn("Apply Rule...", "option2", function () {
            showRuleSelector(workingCharging, sectionView, refHole, configTracker);
        })
    );

    actionRow.appendChild(
        makeBtn("Save as Rule", "option1", function () {
            showSaveAsRuleDialog(workingCharging, configTracker);
        })
    );

    actionRow.appendChild(
        makeBtn("Apply to Selected", "confirm", function () {
            applyToSelectedHoles(workingCharging, refHole, configTracker);
        })
    );

    // ======== DRAG & DROP SETUP ========
    setupDragDrop(sectionCanvas, sectionView, workingCharging, refHole, configTracker);

    // ======== CREATE DIALOG ========
    var dialog = new FloatingDialog({
        title: "Deck Builder",
        content: contentDiv,
        width: 680,
        height: 560,
        showConfirm: false,
        showCancel: true,
        cancelText: "Close",
        onCancel: function () {
            sectionView.destroy();
        }
    });
    dialog.show();

    // Size canvas after dialog is fully laid out (double-rAF for layout flush)
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            var rect = sectionCanvas.parentElement.getBoundingClientRect();
            sectionView.resize(Math.max(rect.width, 200) * (window.devicePixelRatio || 1), Math.max(rect.height, 200) * (window.devicePixelRatio || 1));
        });
    });

    updateSummary();

    // ======== HELPER FUNCTIONS (closures) ========

    function updateDeckPropertiesPanel(deck, index) {
        var row = document.getElementById("deckBuilderPropsRow");
        if (!row) return;
        var qtyLabel = "";
        if (deck.deckType === DECK_TYPES.DECOUPLED && deck.packageCount > 0) {
            qtyLabel = "<span>Qty: " + deck.packageCount + "</span>";
        }
        row.innerHTML =
            "<b>Deck " +
            (index + 1) +
            ":</b> " +
            "<span>Type: " +
            deck.deckType +
            "</span>" +
            "<span>Product: " +
            (deck.product ? deck.product.name : "None") +
            "</span>" +
            "<span>Top: " +
            deck.topDepth.toFixed(1) +
            "m</span>" +
            "<span>Base: " +
            deck.baseDepth.toFixed(1) +
            "m</span>" +
            "<span>Length: " +
            deck.length.toFixed(1) +
            "m</span>" +
            qtyLabel +
            "<span>Density: " +
            (deck.effectiveDensity || 0).toFixed(3) +
            " g/cc</span>";
    }

    function updatePrimerInfo(primer, index) {
        var row = document.getElementById("deckBuilderPropsRow");
        if (!row) return;
        var detQty = primer.detonator.quantity || 1;
        var detLabel = primer.detonator.productName || "None";
        if (detQty > 1) detLabel = detQty + "x " + detLabel;
        row.innerHTML = "<b>Primer " + (index + 1) + ":</b> " + "<span>Depth: " + (primer.lengthFromCollar || 0).toFixed(1) + "m</span>" + "<span>Det: " + detLabel + "</span>" + "<span>Booster: " + (primer.booster.productName || "None") + "</span>" + "<span>Delay: " + (primer.detonator.delayMs || 0) + "ms</span>";
    }

    function updateContentInfo(content, deckIndex, contentIndex) {
        var row = document.getElementById("deckBuilderPropsRow");
        if (!row) return;
        var mass = content.calculateMass ? content.calculateMass() : 0;
        row.innerHTML =
            "<b>Embedded Content:</b> " +
            "<span>" + (content.productName || content.contentType) + "</span>" +
            "<span>Depth: " + (content.lengthFromCollar || 0).toFixed(2) + "m</span>" +
            "<span>Length: " + (content.length || 0).toFixed(3) + "m</span>" +
            "<span>Dia: " + ((content.diameter || 0) * 1000).toFixed(0) + "mm</span>" +
            "<span>Mass: " + (mass ? mass.toFixed(1) : "0") + "kg</span>";
    }

    function updateSummary() {
        var el = document.getElementById("deckBuilderSummary");
        if (!el || !workingCharging) return;
        var mass = workingCharging.getTotalExplosiveMass();
        var pf = workingCharging.calculatePowderFactor(refHole.burden || 1, refHole.spacing || 1);
        el.textContent = "Decks: " + workingCharging.decks.length + " | Primers: " + workingCharging.primers.length + " | Explosive Mass: " + mass.toFixed(1) + " kg" + " | Powder Factor: " + pf.toFixed(3) + " kg/m\u00B3";
    }

    function showInlineWarning(message) {
        var row = document.getElementById("deckBuilderPropsRow");
        if (!row) return;
        row.innerHTML = '<span style="color:#ff9800;">\u26A0 ' + message + "</span>";
        setTimeout(function () {
            row.innerHTML = "<span style='opacity:0.5;'>Click a deck to edit properties</span>";
        }, 3000);
    }

    function isFixedSpacer(deck) {
        return deck && deck.deckType === DECK_TYPES.SPACER;
    }

    /**
     * Find the nearest non-spacer deck to absorb a gap.
     * Searches above (idx-1, idx-2...) then below (idx, idx+1...).
     */
    function findGapFillDeck(decks, removedIdx, removedTop, removedBase) {
        // Search above the removed position
        for (var i = removedIdx - 1; i >= 0; i--) {
            if (!isFixedSpacer(decks[i])) {
                decks[i].baseDepth = removedBase;
                return;
            }
        }
        // Search below (indices shifted after splice, so removedIdx is now next deck)
        for (var j = removedIdx; j < decks.length; j++) {
            if (!isFixedSpacer(decks[j])) {
                decks[j].topDepth = removedTop;
                return;
            }
        }
        // All remaining are spacers - expand last deck as fallback
        if (decks.length > 0) {
            decks[decks.length - 1].baseDepth = removedBase;
        }
    }

}

/**
 * Build draggable product palette items from window.loadedProducts
 */
function buildProductPalette(container) {
    var products = window.loadedProducts || new Map();

    if (products.size === 0) {
        var empty = document.createElement("div");
        empty.style.cssText = "color:#666;font-size:11px;padding:8px;text-align:center;";
        empty.textContent = "No products loaded. Import a config first.";
        container.appendChild(empty);
        return;
    }

    // Group by category
    var categories = {};
    products.forEach(function (product) {
        var cat = product.productCategory || "Other";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(product);
    });

    var catOrder = ["NonExplosive", "BulkExplosive", "HighExplosive", "Initiator", "Spacer"];
    var catLabels = {
        NonExplosive: "Non-Explosive",
        BulkExplosive: "Bulk Explosive",
        HighExplosive: "High Explosive",
        Initiator: "Initiators",
        Spacer: "Spacers"
    };

    for (var ci = 0; ci < catOrder.length; ci++) {
        var cat = catOrder[ci];
        var items = categories[cat];
        if (!items || items.length === 0) continue;

        var catHeader = document.createElement("div");
        catHeader.className = "deck-builder-cat-header";
        catHeader.textContent = catLabels[cat] || cat;
        container.appendChild(catHeader);

        for (var pi = 0; pi < items.length; pi++) {
            var product = items[pi];
            var item = document.createElement("div");
            item.className = "deck-palette-item";
            item.setAttribute("draggable", "true");
            item.dataset.productId = product.productID || product.name;
            item.dataset.productCategory = product.productCategory;

            // Color swatch
            var swatch = document.createElement("span");
            swatch.style.cssText = "width:12px;height:12px;border-radius:2px;flex-shrink:0;border:1px solid #555;";
            swatch.style.backgroundColor = product.colorHex || "#CCCCCC";
            item.appendChild(swatch);

            // Name
            var nameSpan = document.createElement("span");
            nameSpan.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
            nameSpan.textContent = product.name;
            nameSpan.title = product.name + " (" + product.productCategory + ")";
            item.appendChild(nameSpan);

            // Drag start
            (function (prod) {
                item.addEventListener("dragstart", function (e) {
                    e.dataTransfer.setData(
                        "text/plain",
                        JSON.stringify({
                            productID: prod.productID || prod.name,
                            name: prod.name,
                            productCategory: prod.productCategory,
                            productType: prod.productType,
                            density: prod.density,
                            colorHex: prod.colorHex
                        })
                    );
                    e.dataTransfer.effectAllowed = "copy";
                });
            })(product);

            container.appendChild(item);
        }
    }
}

/**
 * Setup drag-and-drop from palette to section view canvas
 */
function setupDragDrop(canvas, sectionView, workingCharging, refHole, configTracker) {
    canvas.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    });

    canvas.addEventListener("drop", function (e) {
        e.preventDefault();

        var dataStr = e.dataTransfer.getData("text/plain");
        if (!dataStr) return;

        var productData;
        try {
            productData = JSON.parse(dataStr);
        } catch (err) {
            return;
        }

        // Find the full product from loaded products
        var fullProduct = null;
        if (window.loadedProducts) {
            window.loadedProducts.forEach(function (p) {
                if ((p.productID && p.productID === productData.productID) || p.name === productData.name) {
                    fullProduct = p;
                }
            });
        }
        if (!fullProduct) {
            fullProduct = productData; // Use the drag data as fallback
        }

        // Manual drop invalidates any tracked rule config
        if (configTracker) configTracker.config = null;

        // Determine drop depth from Y position
        var dropDepth = sectionView.yToDepth((e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height));

        // Clamp to hole range
        var minD = 0;
        var maxD = Math.abs(workingCharging.holeLength);
        dropDepth = Math.max(minD, Math.min(maxD, dropDepth));

        // Determine deck type from product
        var deckType = deckTypeForProduct(fullProduct);

        // For initiator products, add as primer instead
        if (fullProduct.productCategory === "Initiator") {
            var primer = new Primer({
                holeID: workingCharging.holeID,
                lengthFromCollar: parseFloat(dropDepth.toFixed(2)),
                detonator: {
                    productID: fullProduct.productID || null,
                    productName: fullProduct.name,
                    initiatorType: fullProduct.initiatorType || fullProduct.productType || null,
                    deliveryVodMs: fullProduct.deliveryVodMs || 0,
                    delayMs: 0
                },
                booster: {
                    productName: null,
                    quantity: 1
                }
            });
            var result = workingCharging.addPrimer(primer);
            if (!result.success && result.errors && result.errors.length > 0) {
                showModalMessage("Primer Error", result.errors.join("\n"), "warning");
            }
            sectionView.setData(workingCharging);
            return;
        }

        var defaultDeckLength = 2.0;
        if (fullProduct.productCategory === "HighExplosive") {
            // Default to 1 package unit length
            defaultDeckLength = fullProduct.lengthMm ? fullProduct.lengthMm / 1000 : 0.4;
        } else if (fullProduct.productCategory === "Spacer") {
            defaultDeckLength = 0.4; // Short for spacers
        }

        // Calculate interval: drop point is center of new deck
        var halfLen = defaultDeckLength / 2;
        var topD = Math.max(minD, dropDepth - halfLen);
        var baseD = Math.min(maxD, topD + defaultDeckLength);

        workingCharging.fillInterval(parseFloat(topD.toFixed(2)), parseFloat(baseD.toFixed(2)), deckType, productSnapshot(fullProduct));

        sectionView.setData(workingCharging);
    });
}

/**
 * Add a primer via a simple dialog prompt
 */
function addPrimerToCharging(workingCharging, sectionView, refHole) {
    // Gather initiator products for selection
    var initiators = [];
    var boosters = [];
    if (window.loadedProducts) {
        window.loadedProducts.forEach(function (p) {
            if (p.productCategory === "Initiator") initiators.push(p);
            if (p.productCategory === "HighExplosive") boosters.push(p);
        });
    }

    var detOptions = [{ value: "", text: "-- None --" }];
    for (var i = 0; i < initiators.length; i++) {
        detOptions.push({ value: initiators[i].name, text: initiators[i].name });
    }

    var boosterOptions = [{ value: "", text: "-- None --" }];
    for (var b = 0; b < boosters.length; b++) {
        boosterOptions.push({ value: boosters[b].name, text: boosters[b].name });
    }

    var holeLen = Math.abs(workingCharging.holeLength);
    var defaultDepth = holeLen * 0.9;

    var fields = [
        { label: "Depth from Collar (m)", name: "depthFromCollar", type: "text", value: defaultDepth.toFixed(1), placeholder: "e.g. 8.5 or fx:chargeBase[1]-0.3" },
        { label: "Detonator", name: "detonatorName", type: "select", options: detOptions, value: detOptions.length > 1 ? detOptions[1].value : "" },
        { label: "Detonator Qty", name: "detonatorQty", type: "number", value: "1", step: "1", min: "1", max: "10" },
        { label: "Delay (ms)", name: "delayMs", type: "number", value: "0", step: "1" },
        { label: "Booster", name: "boosterName", type: "select", options: boosterOptions, value: boosterOptions.length > 1 ? boosterOptions[1].value : "" },
        { label: "Booster Qty", name: "boosterQty", type: "number", value: "1", step: "1" }
    ];

    var formContent = createEnhancedFormContent(fields);

    var primerDialog = new FloatingDialog({
        title: "Add Primer",
        content: formContent,
        width: 350,
        height: 320,
        showConfirm: true,
        confirmText: "Add",
        showCancel: true,
        onConfirm: function () {
            var data = getFormData(formContent);
            var depthInput = (data.depthFromCollar || "").trim();
            var depth;

            if (isFormula(depthInput)) {
                var ctx = buildFormulaCtxFromDecks(workingCharging);
                depth = evaluateFormula(depthInput, ctx);
                if (depth == null) {
                    showModalMessage("Formula Error", "Could not evaluate: " + depthInput, "warning");
                    return;
                }
            } else {
                depth = parseFloat(depthInput) || defaultDepth;
            }

            // Find product details
            var detProduct = null;
            var boosterProduct = null;
            if (data.detonatorName && window.loadedProducts) {
                window.loadedProducts.forEach(function (p) {
                    if (p.name === data.detonatorName) detProduct = p;
                });
            }
            if (data.boosterName && window.loadedProducts) {
                window.loadedProducts.forEach(function (p) {
                    if (p.name === data.boosterName) boosterProduct = p;
                });
            }

            var primer = new Primer({
                holeID: workingCharging.holeID,
                lengthFromCollar: depth,
                detonator: {
                    productID: detProduct ? detProduct.productID : null,
                    productName: data.detonatorName || null,
                    initiatorType: detProduct ? detProduct.initiatorType || detProduct.productType : null,
                    deliveryVodMs: detProduct ? detProduct.deliveryVodMs || 0 : 0,
                    delayMs: parseFloat(data.delayMs) || 0,
                    quantity: Math.max(1, Math.min(10, parseInt(data.detonatorQty) || 1))
                },
                booster: {
                    productID: boosterProduct ? boosterProduct.productID : null,
                    productName: data.boosterName || null,
                    quantity: parseInt(data.boosterQty) || 1,
                    massGrams: boosterProduct ? boosterProduct.massGrams : null
                }
            });

            var result = workingCharging.addPrimer(primer);
            if (!result.success && result.errors && result.errors.length > 0) {
                showModalMessage("Primer Error", result.errors.join("\n"), "warning");
            }
            sectionView.setData(workingCharging);
        }
    });
    primerDialog.show();
}

/**
 * Edit an existing primer via dialog pre-populated with its current values.
 * Updates the primer in-place on confirm.
 */
function editPrimer(workingCharging, sectionView, refHole) {
    var idx = sectionView.selectedPrimerIndex;
    if (idx < 0 || idx >= workingCharging.primers.length) {
        var row = document.getElementById("deckBuilderPropsRow");
        if (row) {
            row.innerHTML = '<span style="color:#ff9800;">\u26A0 Select a primer to edit first.</span>';
            setTimeout(function () {
                row.innerHTML = "<span style='opacity:0.5;'>Click a deck to edit properties</span>";
            }, 3000);
        }
        return;
    }

    var primer = workingCharging.primers[idx];

    // Gather initiator and booster products for selection
    var initiators = [];
    var boosters = [];
    if (window.loadedProducts) {
        window.loadedProducts.forEach(function (p) {
            if (p.productCategory === "Initiator") initiators.push(p);
            if (p.productCategory === "HighExplosive") boosters.push(p);
        });
    }

    var detOptions = [{ value: "", text: "-- None --" }];
    for (var i = 0; i < initiators.length; i++) {
        detOptions.push({ value: initiators[i].name, text: initiators[i].name });
    }

    var boosterOptions = [{ value: "", text: "-- None --" }];
    for (var b = 0; b < boosters.length; b++) {
        boosterOptions.push({ value: boosters[b].name, text: boosters[b].name });
    }

    var fields = [
        { label: "Depth from Collar (m)", name: "depthFromCollar", type: "text", value: (primer.lengthFromCollar || 0).toFixed(1), placeholder: "e.g. 8.5 or fx:chargeBase[1]-0.3" },
        { label: "Detonator", name: "detonatorName", type: "select", options: detOptions, value: primer.detonator.productName || "" },
        { label: "Detonator Qty", name: "detonatorQty", type: "number", value: String(primer.detonator.quantity || 1), step: "1", min: "1", max: "10" },
        { label: "Delay (ms)", name: "delayMs", type: "number", value: String(primer.detonator.delayMs || 0), step: "1" },
        { label: "Booster", name: "boosterName", type: "select", options: boosterOptions, value: primer.booster.productName || "" },
        { label: "Booster Qty", name: "boosterQty", type: "number", value: String(primer.booster.quantity || 1), step: "1" }
    ];

    var formContent = createEnhancedFormContent(fields);

    var editDialog = new FloatingDialog({
        title: "Edit Primer " + (idx + 1),
        content: formContent,
        width: 350,
        height: 320,
        showConfirm: true,
        confirmText: "Update",
        showCancel: true,
        onConfirm: function () {
            var data = getFormData(formContent);
            var depthInput = (data.depthFromCollar || "").trim();
            var depth;

            if (isFormula(depthInput)) {
                var ctx = buildFormulaCtxFromDecks(workingCharging);
                depth = evaluateFormula(depthInput, ctx);
                if (depth == null) {
                    showModalMessage("Formula Error", "Could not evaluate: " + depthInput, "warning");
                    return;
                }
            } else {
                depth = parseFloat(depthInput);
                if (isNaN(depth)) depth = primer.lengthFromCollar;
            }

            // Clamp depth to hole range
            var holeLen = Math.abs(workingCharging.holeLength);
            depth = Math.max(0, Math.min(holeLen, depth));

            // Find product details
            var detProduct = null;
            var boosterProduct = null;
            if (data.detonatorName && window.loadedProducts) {
                window.loadedProducts.forEach(function (p) {
                    if (p.name === data.detonatorName) detProduct = p;
                });
            }
            if (data.boosterName && window.loadedProducts) {
                window.loadedProducts.forEach(function (p) {
                    if (p.name === data.boosterName) boosterProduct = p;
                });
            }

            // Update primer in-place
            primer.lengthFromCollar = depth;
            primer.detonator.productID = detProduct ? detProduct.productID : null;
            primer.detonator.productName = data.detonatorName || null;
            primer.detonator.initiatorType = detProduct ? detProduct.initiatorType || detProduct.productType : null;
            primer.detonator.deliveryVodMs = detProduct ? detProduct.deliveryVodMs || 0 : 0;
            primer.detonator.delayMs = parseFloat(data.delayMs) || 0;
            primer.detonator.quantity = Math.max(1, Math.min(10, parseInt(data.detonatorQty) || 1));
            primer.booster.productID = boosterProduct ? boosterProduct.productID : null;
            primer.booster.productName = data.boosterName || null;
            primer.booster.quantity = parseInt(data.boosterQty) || 1;
            primer.booster.massGrams = boosterProduct ? boosterProduct.massGrams : null;

            workingCharging.modified = new Date().toISOString();
            sectionView.setData(workingCharging);
        }
    });
    editDialog.show();
}

/**
 * Universal Edit: auto-detect whether a primer or deck is selected and open the right editor.
 */
function editSelected(workingCharging, sectionView, refHole, onUpdate) {
    // Primer selection takes priority (more specific)
    if (sectionView.selectedPrimerIndex >= 0 && sectionView.selectedPrimerIndex < workingCharging.primers.length) {
        editPrimer(workingCharging, sectionView, refHole);
        return;
    }
    // Embedded content selection
    if (sectionView._selectedContentDeckIndex >= 0 && sectionView._selectedContentIndex >= 0) {
        editEmbeddedContent(workingCharging, sectionView, onUpdate);
        return;
    }
    if (sectionView.selectedDeckIndex >= 0 && sectionView.selectedDeckIndex < workingCharging.decks.length) {
        editDeck(workingCharging, sectionView, refHole, onUpdate);
        return;
    }
    // Nothing selected
    var row = document.getElementById("deckBuilderPropsRow");
    if (row) {
        row.innerHTML = '<span style="color:#ff9800;">\u26A0 Select a deck or primer to edit first.</span>';
        setTimeout(function () {
            row.innerHTML = "<span style='opacity:0.5;'>Click a deck to edit properties</span>";
        }, 3000);
    }
}

/**
 * Universal Remove: auto-detect whether a primer, spacer, or deck is selected and remove it.
 */
function removeSelected(workingCharging, sectionView, onUpdate, showInlineWarning, isFixedSpacer, findGapFillDeck) {
    // Check primer first
    if (sectionView.selectedPrimerIndex >= 0 && sectionView.selectedPrimerIndex < workingCharging.primers.length) {
        workingCharging.primers.splice(sectionView.selectedPrimerIndex, 1);
        sectionView.selectedPrimerIndex = -1;
        sectionView.setData(workingCharging);
        onUpdate();
        return;
    }
    // Check embedded content
    if (sectionView._selectedContentDeckIndex >= 0 && sectionView._selectedContentIndex >= 0) {
        var cDeck = workingCharging.decks[sectionView._selectedContentDeckIndex];
        if (cDeck && cDeck.contains && cDeck.contains[sectionView._selectedContentIndex]) {
            var contentID = cDeck.contains[sectionView._selectedContentIndex].contentID;
            workingCharging.removeContent(contentID);
            sectionView._selectedContentDeckIndex = -1;
            sectionView._selectedContentIndex = -1;
            sectionView.setData(workingCharging);
            onUpdate();
        }
        return;
    }
    // Check deck
    var idx = sectionView.selectedDeckIndex;
    if (idx >= 0 && idx < workingCharging.decks.length) {
        if (workingCharging.decks.length <= 1) {
            showInlineWarning("Cannot remove the last deck. Use Clear instead.");
            return;
        }
        var removed = workingCharging.decks[idx];
        var removedTop = removed.topDepth;
        var removedBase = removed.baseDepth;
        workingCharging.decks.splice(idx, 1);
        findGapFillDeck(workingCharging.decks, idx, removedTop, removedBase);
        workingCharging.sortDecks();
        sectionView.selectedDeckIndex = -1;
        sectionView.setData(workingCharging);
        onUpdate();
        return;
    }
    showInlineWarning("Select a deck or primer to remove first.");
}

/**
 * Edit an existing deck via dialog pre-populated with its current values.
 * Supports fx: formulas for topDepth and baseDepth.
 */
function editDeck(workingCharging, sectionView, refHole, onUpdate) {
    var idx = sectionView.selectedDeckIndex;
    if (idx < 0 || idx >= workingCharging.decks.length) return;

    var deck = workingCharging.decks[idx];

    // Build product options filtered to categories that match this deck type
    var productOptions = [{ value: "", text: "-- None --" }];
    if (window.loadedProducts) {
        window.loadedProducts.forEach(function (p) {
            productOptions.push({ value: p.name, text: p.name + " (" + p.productCategory + ")" });
        });
    }

    // For DECOUPLED decks, compute quantity from product unit length
    var isDecoupled = deck.deckType === DECK_TYPES.DECOUPLED;
    var unitLenM = 0;
    if (isDecoupled && deck.product && deck.product.lengthMm) {
        unitLenM = deck.product.lengthMm / 1000;
    } else if (isDecoupled && deck.product && deck.product.name && window.loadedProducts) {
        window.loadedProducts.forEach(function (p) {
            if (p.name === deck.product.name && p.lengthMm) unitLenM = p.lengthMm / 1000;
        });
    }
    var currentQty = (unitLenM > 0) ? Math.round(deck.length / unitLenM) : 1;
    if (currentQty < 1) currentQty = 1;

    var fields = [
        {
            label: "Deck Type", name: "deckType", type: "select",
            options: [
                { value: DECK_TYPES.INERT, text: "INERT" },
                { value: DECK_TYPES.COUPLED, text: "COUPLED" },
                { value: DECK_TYPES.DECOUPLED, text: "DECOUPLED" },
                { value: DECK_TYPES.SPACER, text: "SPACER" }
            ],
            value: deck.deckType
        },
        {
            label: "Product", name: "productName", type: "select",
            options: productOptions,
            value: deck.product ? deck.product.name : ""
        },
        { label: "Top Depth (m)", name: "topDepth", type: "text", value: deck.topDepth.toFixed(3), placeholder: "e.g. 3.5 or fx:stemLength" }
    ];

    // DECOUPLED: show quantity instead of base depth (length = qty × product length)
    if (isDecoupled && unitLenM > 0) {
        fields.push({ label: "Quantity (units)", name: "quantity", type: "number", value: String(currentQty), step: "1", min: "1" });
    } else {
        fields.push({ label: "Base Depth (m)", name: "baseDepth", type: "text", value: deck.baseDepth.toFixed(3), placeholder: "e.g. 10.0 or fx:holeLength" });
    }

    var formContent = createEnhancedFormContent(fields);

    var editDialog = new FloatingDialog({
        title: "Edit Deck " + (idx + 1),
        content: formContent,
        width: 380,
        height: 300,
        showConfirm: true,
        confirmText: "Update",
        showCancel: true,
        onConfirm: function () {
            var data = getFormData(formContent);
            var ctx = buildFormulaCtxFromDecks(workingCharging);
            var holeLen = Math.abs(workingCharging.holeLength);

            // Resolve topDepth
            var topInput = (data.topDepth || "").trim();
            var newTop;
            if (isFormula(topInput)) {
                newTop = evaluateFormula(topInput, ctx);
                if (newTop == null) {
                    showModalMessage("Formula Error", "Could not evaluate top depth: " + topInput, "warning");
                    return;
                }
            } else {
                newTop = parseFloat(topInput);
                if (isNaN(newTop)) newTop = deck.topDepth;
            }

            var newBase;
            // DECOUPLED with quantity: derive base from top + qty × unit length
            if (isDecoupled && unitLenM > 0 && data.quantity != null) {
                var qty = Math.max(1, parseInt(data.quantity) || 1);
                newBase = newTop + qty * unitLenM;
            } else {
                // Resolve baseDepth
                var baseInput = (data.baseDepth || "").trim();
                if (isFormula(baseInput)) {
                    newBase = evaluateFormula(baseInput, ctx);
                    if (newBase == null) {
                        showModalMessage("Formula Error", "Could not evaluate base depth: " + baseInput, "warning");
                        return;
                    }
                } else {
                    newBase = parseFloat(baseInput);
                    if (isNaN(newBase)) newBase = deck.baseDepth;
                }
            }

            // Clamp to hole range
            newTop = Math.max(0, Math.min(holeLen, newTop));
            newBase = Math.max(0, Math.min(holeLen, newBase));
            if (newBase <= newTop) {
                showModalMessage("Deck Error", "Base depth must be greater than top depth.", "warning");
                return;
            }

            // Update deck type
            deck.deckType = data.deckType || deck.deckType;

            // Update product
            var newProductName = data.productName || "";
            if (newProductName && window.loadedProducts) {
                var found = null;
                window.loadedProducts.forEach(function (p) {
                    if (p.name === newProductName) found = p;
                });
                if (found) {
                    deck.product = productSnapshot(found);
                }
            } else if (!newProductName) {
                deck.product = null;
            }

            // Update depths — also adjust adjacent INERT deck to fill gap
            var oldBase = deck.baseDepth;
            deck.topDepth = parseFloat(newTop.toFixed(3));
            deck.baseDepth = parseFloat(newBase.toFixed(3));

            // Adjust the adjacent deck below to absorb the size change
            var nextIdx = workingCharging.decks.indexOf(deck) + 1;
            if (nextIdx < workingCharging.decks.length) {
                workingCharging.decks[nextIdx].topDepth = parseFloat(newBase.toFixed(3));
            }

            workingCharging.modified = new Date().toISOString();
            workingCharging.sortDecks();
            sectionView.setData(workingCharging);
            if (onUpdate) onUpdate();
        }
    });
    editDialog.show();
}

/**
 * Edit an embedded content item (DecoupledContent) via dialog.
 */
function editEmbeddedContent(workingCharging, sectionView, onUpdate) {
    var di = sectionView._selectedContentDeckIndex;
    var ci = sectionView._selectedContentIndex;
    if (di < 0 || di >= workingCharging.decks.length) return;
    var deck = workingCharging.decks[di];
    if (!deck.contains || ci < 0 || ci >= deck.contains.length) return;
    var content = deck.contains[ci];

    var fields = [
        { label: "Depth from Collar (m)", name: "depthFromCollar", type: "number", value: (content.lengthFromCollar || 0).toFixed(3), step: "0.001" },
        { label: "Length (m)", name: "length", type: "number", value: (content.length || 0).toFixed(3), step: "0.001" },
        { label: "Diameter (mm)", name: "diameterMm", type: "number", value: ((content.diameter || 0) * 1000).toFixed(0), step: "1" },
        { label: "Density (g/cc)", name: "density", type: "number", value: (content.density || 0).toFixed(3), step: "0.001" }
    ];

    var formContent = createEnhancedFormContent(fields);

    var editDialog = new FloatingDialog({
        title: "Edit Embedded Content",
        content: formContent,
        width: 350,
        height: 280,
        showConfirm: true,
        confirmText: "Update",
        showCancel: true,
        onConfirm: function () {
            var data = getFormData(formContent);
            var newDepth = parseFloat(data.depthFromCollar);
            var newLength = parseFloat(data.length);
            var newDiaMm = parseFloat(data.diameterMm);
            var newDensity = parseFloat(data.density);

            if (!isNaN(newDepth)) content.lengthFromCollar = newDepth;
            if (!isNaN(newLength) && newLength > 0) content.length = newLength;
            if (!isNaN(newDiaMm) && newDiaMm > 0) content.diameter = newDiaMm / 1000;
            if (!isNaN(newDensity) && newDensity >= 0) content.density = newDensity;

            workingCharging.modified = new Date().toISOString();
            sectionView.setData(workingCharging);
            if (onUpdate) onUpdate();
        }
    });
    editDialog.show();
}

/**
 * Show rule selection dropdown and apply selected rule
 */
function showRuleSelector(workingCharging, sectionView, refHole, configTracker) {
    var configs = window.loadedChargeConfigs || new Map();
    if (configs.size === 0) {
        showModalMessage("Apply Rule", "No charge configs loaded. Import a config template first.", "warning");
        return;
    }

    var configOptions = [];
    configs.forEach(function (config, configID) {
        configOptions.push({ value: configID, text: config.configName || configID });
    });

    // Get initial config to read its applyShortHoleLogic default
    var initialConfig = configs.get(configOptions[0].value);

    var fields = [
        { label: "Charge Configuration", name: "configID", type: "select", options: configOptions, value: configOptions[0].value },
        { label: "Apply Short Hole Logic", name: "applyShortHoleLogic", type: "checkbox", checked: initialConfig ? initialConfig.applyShortHoleLogic !== false : true }
    ];
    var formContent = createEnhancedFormContent(fields);

    // Update checkbox when config selection changes
    var configSelect = formContent.querySelector('select[name="configID"]');
    var shortHoleCheckbox = formContent.querySelector('input[name="applyShortHoleLogic"]');
    if (configSelect && shortHoleCheckbox) {
        configSelect.addEventListener("change", function () {
            var selectedConfig = configs.get(this.value);
            if (selectedConfig) {
                shortHoleCheckbox.checked = selectedConfig.applyShortHoleLogic !== false;
            }
        });
    }

    var ruleDialog = new FloatingDialog({
        title: "Apply Rule",
        content: formContent,
        width: 350,
        height: 220,
        showConfirm: true,
        confirmText: "Apply",
        showCancel: true,
        onConfirm: function () {
            var data = getFormData(formContent);
            var config = configs.get(data.configID);
            if (!config) return;

            // Override short hole logic from checkbox
            var useShortHole = data.applyShortHoleLogic === "true" || data.applyShortHoleLogic === true;
            config.applyShortHoleLogic = useShortHole;

            // Apply rule via SimpleRuleEngine (imported dynamically to avoid circular deps)
            if (typeof window.applyChargeRule === "function") {
                var newCharging = window.applyChargeRule(refHole, config);
                if (newCharging) {
                    workingCharging.decks = newCharging.decks;
                    workingCharging.primers = newCharging.primers;
                    workingCharging.modified = new Date().toISOString();
                    if (configTracker) configTracker.config = config;
                    sectionView.setData(workingCharging);
                }
            } else {
                showModalMessage("Apply Rule", "Rule engine not loaded.", "warning");
            }
        }
    });
    ruleDialog.show();
}

/**
 * Apply working charging to all selected holes.
 * If a charge config was tracked (rule-based), re-run applyChargeRule per hole.
 * Otherwise (manual design), proportionally scale deck depths by hole length ratio.
 */
function applyToSelectedHoles(workingCharging, refHole, configTracker) {
    var targets = [];

    // Gather target holes
    if (window.selectedMultipleHoles && window.selectedMultipleHoles.length > 0) {
        targets = window.selectedMultipleHoles;
    } else if (window.selectedHole) {
        targets = [window.selectedHole];
    } else {
        targets = [refHole];
    }

    if (targets.length === 0) {
        showModalMessage("Apply Charging", "No holes selected.", "warning");
        return;
    }

    var activeConfig = configTracker ? configTracker.config : null;
    var modeLabel = activeConfig ? "rule-based" : "proportional";

    showConfirmationDialog("Apply Charging", "Apply this charging design (" + modeLabel + ") to " + targets.length + " hole(s)?", "Apply", "Cancel", function () {
        var refLen = Math.abs(workingCharging.holeLength);

        for (var i = 0; i < targets.length; i++) {
            var hole = targets[i];
            var hc;

            if (activeConfig && typeof window.applyChargeRule === "function") {
                // Re-run the rule engine for each target hole individually
                hc = window.applyChargeRule(hole, activeConfig);
                if (!hc) {
                    // Fallback: proportional scale if rule fails
                    hc = scaleChargingToHole(workingCharging, hole, refLen);
                }
            } else {
                // Manual design: proportionally scale deck depths
                hc = scaleChargingToHole(workingCharging, hole, refLen);
            }

            if (!window.loadedCharging) {
                window.loadedCharging = new Map();
            }
            window.loadedCharging.set(hole.holeID, hc);
        }

        // Recalculate massPerHole for all holes
        if (typeof window.recalcMassPerHole === "function") {
            window.recalcMassPerHole();
        }

        // Save to IndexedDB
        if (typeof window.debouncedSaveCharging === "function") {
            window.debouncedSaveCharging();
        }

        // Redraw
        if (typeof window.drawData === "function") {
            window.drawData(window.allBlastHoles, window.selectedHole);
        }

        showModalMessage("Charging Applied", "Applied charging (" + modeLabel + ") to " + targets.length + " hole(s).", "success");
    });
}

/**
 * Proportionally scale a charging design from a reference hole to a target hole.
 * Deck depths and primer positions are scaled by (targetLength / referenceLength).
 * @param {HoleCharging} sourceCharging - The reference charging design
 * @param {Object} targetHole - The target blast hole
 * @param {number} refLen - The reference hole length
 * @returns {HoleCharging} New HoleCharging sized for the target hole
 */
function scaleChargingToHole(sourceCharging, targetHole, refLen) {
    var chargingJSON = sourceCharging.toJSON();
    var clone = JSON.parse(JSON.stringify(chargingJSON));

    var targetLen = Math.abs(targetHole.holeLengthCalculated || 0);
    clone.holeID = targetHole.holeID;
    clone.entityName = targetHole.entityName;
    clone.holeDiameterMm = targetHole.holeDiameter || sourceCharging.holeDiameterMm;
    clone.holeLength = targetLen;

    // Scale ratio (guard against zero-length reference)
    var ratio = refLen > 0 ? targetLen / refLen : 1;

    // Scale deck depths
    if (clone.decks && clone.decks.length > 0) {
        for (var d = 0; d < clone.decks.length; d++) {
            var deck = clone.decks[d];
            deck.topDepth = Math.max(0, Math.min(targetLen, deck.topDepth * ratio));
            deck.baseDepth = Math.max(0, Math.min(targetLen, deck.baseDepth * ratio));
            // Ensure minimum deck thickness
            if (deck.baseDepth - deck.topDepth < 0.01 && d < clone.decks.length - 1) {
                deck.baseDepth = Math.min(targetLen, deck.topDepth + 0.01);
            }
            // Scale embedded content positions
            if (deck.contains && deck.contains.length > 0) {
                for (var ci = 0; ci < deck.contains.length; ci++) {
                    if (deck.contains[ci].lengthFromCollar != null) {
                        deck.contains[ci].lengthFromCollar = deck.contains[ci].lengthFromCollar * ratio;
                    }
                }
            }
        }
        // Ensure last deck extends to hole bottom
        clone.decks[clone.decks.length - 1].baseDepth = targetLen;
    }

    // Scale primer depths
    if (clone.primers && clone.primers.length > 0) {
        for (var p = 0; p < clone.primers.length; p++) {
            var primer = clone.primers[p];
            primer.lengthFromCollar = Math.max(0, Math.min(targetLen - 0.1, primer.lengthFromCollar * ratio));
        }
    }

    return HoleCharging.fromJSON(clone);
}

/**
 * Show a dialog to save the current deck layout as a reusable ChargeConfig rule.
 * Extracts deck layout as a deckTemplate array with "fixed" or "fill" lengths.
 */
function showSaveAsRuleDialog(workingCharging, configTracker) {
    if (!workingCharging || workingCharging.decks.length === 0) {
        showModalMessage("Save as Rule", "No decks to save. Build a charging design first.", "warning");
        return;
    }

    var holeLen = Math.abs(workingCharging.holeLength);

    // Build list of charge decks with 1-based index for primer formula generation
    var chargeDecks = [];
    for (var ci = 0; ci < workingCharging.decks.length; ci++) {
        var cd = workingCharging.decks[ci];
        if (cd.deckType === DECK_TYPES.COUPLED || cd.deckType === DECK_TYPES.DECOUPLED) {
            chargeDecks.push({ index: chargeDecks.length + 1, topDepth: cd.topDepth, baseDepth: cd.baseDepth });
        }
    }

    var fields = [
        { key: "configName", label: "Rule Name", type: "text", value: "Custom Rule" },
        { key: "configCode", label: "Config Code", type: "select", options: [
            { value: "CUSTOM", label: "CUSTOM - Explicit deck layout" },
            { value: "STNDFS", label: "STNDFS - Standard fixed stem" },
            { value: "AIRDEC", label: "AIRDEC - Air deck design" },
            { value: "ST5050", label: "ST5050 - 50/50 stem/charge" },
            { value: "SIMPLE_SINGLE", label: "SIMPLE_SINGLE - Simple single" },
            { value: "STNDVS", label: "STNDVS - Standard vented" },
            { value: "PRESPL", label: "PRESPL - Presplit" },
            { value: "NOCHG", label: "NOCHG - No charge" }
        ], value: "CUSTOM" },
        { key: "description", label: "Description", type: "text", value: "" },
        {
            key: "fillDeckIndex",
            label: "Fill Deck (absorbs remaining space)",
            type: "select",
            options: workingCharging.decks.map(function (d, i) {
                var label = i + 1 + ": " + d.deckType + " - " + (d.product ? d.product.name : "Empty");
                return { value: String(i), label: label };
            }),
            value: String(findBestFillDeck(workingCharging))
        },
        { key: "applyShortHoleLogic", label: "Apply Short Hole Logic", type: "checkbox", checked: true }
    ];

    // Add dynamic primer depth formula fields with smart defaults
    if (workingCharging.primers && workingCharging.primers.length > 0) {
        for (var pi = 0; pi < workingCharging.primers.length; pi++) {
            var p = workingCharging.primers[pi];
            var primerD = p.lengthFromCollar || 0;
            var defaultFormula;

            // Find which charge deck contains this primer
            var containingDeck = null;
            for (var cdi = 0; cdi < chargeDecks.length; cdi++) {
                if (primerD >= chargeDecks[cdi].topDepth - 0.01 && primerD <= chargeDecks[cdi].baseDepth + 0.01) {
                    containingDeck = chargeDecks[cdi];
                    break;
                }
            }

            if (containingDeck) {
                var offset = containingDeck.baseDepth - primerD;
                var offsetRounded = Math.round(offset * 100) / 100;
                if (chargeDecks.length > 1) {
                    // Multi-deck: use indexed variable
                    defaultFormula = "fx:chargeBase[" + containingDeck.index + "] - " + offsetRounded;
                } else {
                    // Single deck: use unindexed variable
                    defaultFormula = "fx:chargeBase - " + offsetRounded;
                }
            } else {
                // Primer not in any charge deck — use fraction of holeLength
                var fraction = holeLen > 0 ? primerD / holeLen : 0.9;
                var rounded = Math.round(fraction * 1000) / 1000;
                defaultFormula = "fx:holeLength * " + rounded;
            }

            fields.push({
                key: "primerDepth_" + pi,
                label: "Primer " + (pi + 1) + " Depth (" + primerD.toFixed(1) + "m)",
                type: "text",
                value: defaultFormula
            });
        }
    }

    var formContent = createEnhancedFormContent(fields);

    var primerCount = workingCharging.primers ? workingCharging.primers.length : 0;
    var saveDialogHeight = 300 + primerCount * 50;

    var dialog = new FloatingDialog({
        title: "Save as Rule",
        content: formContent,
        width: 420,
        height: saveDialogHeight,
        showConfirm: true,
        confirmText: "Save",
        showCancel: true,
        cancelText: "Cancel",
        onConfirm: function () {
            var data = getFormData(formContent);
            var fillIdx = parseInt(data.fillDeckIndex, 10);

            // Build deckTemplate from current decks with correct lengthModes
            var template = [];
            for (var i = 0; i < workingCharging.decks.length; i++) {
                var deck = workingCharging.decks[i];
                var deckLen = Math.abs(deck.baseDepth - deck.topDepth);

                var entry = {
                    type: deck.deckType,
                    product: deck.product ? deck.product.name : "Air"
                };

                if (i === fillIdx) {
                    // Fill deck absorbs remaining space
                    entry.lengthMode = "fill";
                    entry.length = 0;
                } else if (deck.deckType === DECK_TYPES.SPACER) {
                    // Spacer: length derived from product.lengthMm at apply-time
                    entry.lengthMode = "product";
                    entry.length = null;
                } else {
                    // Fixed length
                    entry.lengthMode = "fixed";
                    entry.length = parseFloat(deckLen.toFixed(3));
                }

                template.push(entry);
            }

            // Build primerTemplate from workingCharging.primers with formula depths
            var primerTemplate = [];
            if (workingCharging.primers && workingCharging.primers.length > 0) {
                for (var pi = 0; pi < workingCharging.primers.length; pi++) {
                    var p = workingCharging.primers[pi];
                    var depthField = (data["primerDepth_" + pi] || "").trim();
                    var depthValue;

                    if (depthField.indexOf("fx:") === 0) {
                        // Store as formula string
                        depthValue = depthField;
                    } else if (depthField !== "" && !isNaN(parseFloat(depthField))) {
                        // Plain number — store as literal
                        depthValue = parseFloat(depthField);
                    } else {
                        // Empty or invalid — fallback to formula
                        var fallbackFraction = holeLen > 0 ? p.lengthFromCollar / holeLen : 0.9;
                        depthValue = "fx:holeLength * " + (Math.round(fallbackFraction * 1000) / 1000);
                    }

                    primerTemplate.push({
                        depth: depthValue,
                        detonator: p.detonator ? p.detonator.productName : null,
                        booster: p.booster ? p.booster.productName : null
                    });
                }
            }

            // Extract product references from first matching deck types
            var stemmingProd = null,
                chargeProd = null,
                gasBagProd = null;
            var boosterProd = null,
                detProd = null;
            for (var d = 0; d < workingCharging.decks.length; d++) {
                var dk = workingCharging.decks[d];
                if (dk.deckType === DECK_TYPES.INERT && !stemmingProd && dk.product) stemmingProd = dk.product.name;
                if ((dk.deckType === DECK_TYPES.COUPLED || dk.deckType === DECK_TYPES.DECOUPLED) && !chargeProd && dk.product) chargeProd = dk.product.name;
                if (dk.deckType === DECK_TYPES.SPACER && !gasBagProd && dk.product) gasBagProd = dk.product.name;
            }
            if (workingCharging.primers && workingCharging.primers.length > 0) {
                var primer = workingCharging.primers[0];
                if (primer.booster) boosterProd = primer.booster.productName;
                if (primer.detonator) detProd = primer.detonator.productName;
            }

            var newConfig = new ChargeConfig({
                configCode: data.configCode || CHARGE_CONFIG_CODES.CUSTOM,
                configName: data.configName || "Custom Rule",
                description: data.description || "",
                stemmingProduct: stemmingProd,
                chargeProduct: chargeProd,
                gasBagProduct: gasBagProd,
                boosterProduct: boosterProd,
                detonatorProduct: detProd,
                deckTemplate: template,
                primerTemplate: primerTemplate,
                applyShortHoleLogic: data.applyShortHoleLogic === "true" || data.applyShortHoleLogic === true
            });

            if (!window.loadedChargeConfigs) {
                window.loadedChargeConfigs = new Map();
            }
            window.loadedChargeConfigs.set(newConfig.configID, newConfig);

            if (typeof window.debouncedSaveConfigs === "function") {
                window.debouncedSaveConfigs();
            }

            // Update the config tracker so "Apply to Selected" uses this rule
            if (configTracker) {
                configTracker.config = newConfig;
            }

            showModalMessage("Rule Saved", '"' + newConfig.configName + '" saved with ' + template.length + " deck template.", "success");
        }
    });
    dialog.show();
}

/**
 * Find the best candidate deck for "fill" mode (the largest non-spacer deck).
 */
function findBestFillDeck(hc) {
    var bestIdx = 0;
    var bestLen = 0;
    for (var i = 0; i < hc.decks.length; i++) {
        var d = hc.decks[i];
        if (d.deckType === DECK_TYPES.SPACER) continue;
        var len = Math.abs(d.baseDepth - d.topDepth);
        if (len > bestLen) {
            bestLen = len;
            bestIdx = i;
        }
    }
    return bestIdx;
}
