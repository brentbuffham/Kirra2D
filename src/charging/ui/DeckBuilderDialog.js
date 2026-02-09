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
import { DECK_TYPES, DECK_COLORS, CHARGE_CONFIG_CODES } from "../ChargingConstants.js";

/**
 * Determine the deck type for a product based on its category
 */
function deckTypeForProduct(product) {
	switch (product.productCategory) {
		case "NonExplosive": return DECK_TYPES.INERT;
		case "BulkExplosive": return DECK_TYPES.COUPLED;
		case "HighExplosive": return DECK_TYPES.DECOUPLED;
		case "Spacer": return DECK_TYPES.SPACER;
		default: return DECK_TYPES.INERT;
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
		colorHex: product.colorHex || null
	};
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
	infoBar.innerHTML =
		"<span>Hole: <b>" + (refHole.holeID || "N/A") + "</b></span>" +
		"<span>Entity: <b>" + (refHole.entityName || "N/A") + "</b></span>" +
		"<span>Dia: <b>" + (refHole.holeDiameter || 0) + "mm</b></span>" +
		"<span>Length: <b>" + (refHole.holeLengthCalculated || 0).toFixed(1) + "m</b></span>";
	contentDiv.appendChild(infoBar);

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
		onDeckSelect: function(deck, index) {
			updateDeckPropertiesPanel(deck, index);
		},
		onDeckResize: function() {
			workingCharging.modified = new Date().toISOString();
			sectionView.draw();
			updateSummary();
		},
		onPrimerSelect: function(primer, index) {
			updatePrimerInfo(primer, index);
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

	actionRow.appendChild(makeBtn("Add Primer", "option1", function() {
		addPrimerToCharging(workingCharging, sectionView, refHole);
	}));

	actionRow.appendChild(makeBtn("Remove Deck", "deny", function() {
		removeDeck(workingCharging, sectionView);
	}));

	actionRow.appendChild(makeBtn("Remove Primer", "deny", function() {
		removePrimer(workingCharging, sectionView);
	}));

	actionRow.appendChild(makeBtn("Clear", "cancel", function() {
		workingCharging.clear();
		sectionView.setData(workingCharging);
		updateSummary();
	}));

	var spacer = document.createElement("div");
	spacer.style.flex = "1";
	actionRow.appendChild(spacer);

	actionRow.appendChild(makeBtn("Apply Rule...", "option2", function() {
		showRuleSelector(workingCharging, sectionView, refHole);
	}));

	actionRow.appendChild(makeBtn("Apply to Selected", "confirm", function() {
		applyToSelectedHoles(workingCharging, refHole);
	}));

	// ======== DRAG & DROP SETUP ========
	setupDragDrop(sectionCanvas, sectionView, workingCharging, refHole);

	// ======== CREATE DIALOG ========
	var dialog = new FloatingDialog({
		title: "Deck Builder",
		content: contentDiv,
		width: 680,
		height: 560,
		showConfirm: false,
		showCancel: true,
		cancelText: "Close",
		onCancel: function() {
			sectionView.destroy();
		}
	});
	dialog.show();

	// Size canvas after dialog is visible
	requestAnimationFrame(function() {
		var rect = sectionCanvas.parentElement.getBoundingClientRect();
		sectionView.resize(
			Math.max(rect.width, 200) * (window.devicePixelRatio || 1),
			Math.max(rect.height, 200) * (window.devicePixelRatio || 1)
		);
	});

	updateSummary();

	// ======== HELPER FUNCTIONS (closures) ========

	function updateDeckPropertiesPanel(deck, index) {
		var row = document.getElementById("deckBuilderPropsRow");
		if (!row) return;
		row.innerHTML =
			"<b>Deck " + (index + 1) + ":</b> " +
			"<span>Type: " + deck.deckType + "</span>" +
			"<span>Product: " + (deck.product ? deck.product.name : "None") + "</span>" +
			"<span>Top: " + deck.topDepth.toFixed(1) + "m</span>" +
			"<span>Base: " + deck.baseDepth.toFixed(1) + "m</span>" +
			"<span>Length: " + deck.length.toFixed(1) + "m</span>" +
			"<span>Density: " + (deck.effectiveDensity || 0).toFixed(3) + " g/cc</span>";
	}

	function updatePrimerInfo(primer, index) {
		var row = document.getElementById("deckBuilderPropsRow");
		if (!row) return;
		var detQty = primer.detonator.quantity || 1;
		var detLabel = (primer.detonator.productName || "None");
		if (detQty > 1) detLabel = detQty + "x " + detLabel;
		row.innerHTML =
			"<b>Primer " + (index + 1) + ":</b> " +
			"<span>Depth: " + (primer.lengthFromCollar || 0).toFixed(1) + "m</span>" +
			"<span>Det: " + detLabel + "</span>" +
			"<span>Booster: " + (primer.booster.productName || "None") + "</span>" +
			"<span>Delay: " + (primer.detonator.delayMs || 0) + "ms</span>";
	}

	function updateSummary() {
		var el = document.getElementById("deckBuilderSummary");
		if (!el || !workingCharging) return;
		var mass = workingCharging.getTotalExplosiveMass();
		var pf = workingCharging.calculatePowderFactor(refHole.burden || 1, refHole.spacing || 1);
		el.textContent =
			"Decks: " + workingCharging.decks.length +
			" | Primers: " + workingCharging.primers.length +
			" | Explosive Mass: " + mass.toFixed(1) + " kg" +
			" | Powder Factor: " + pf.toFixed(3) + " kg/m\u00B3";
	}

	function showInlineWarning(message) {
		var row = document.getElementById("deckBuilderPropsRow");
		if (!row) return;
		row.innerHTML = '<span style="color:#ff9800;">\u26A0 ' + message + '</span>';
		setTimeout(function() {
			row.innerHTML = "<span style='opacity:0.5;'>Click a deck to edit properties</span>";
		}, 3000);
	}

	function removeDeck(hc, sv) {
		var idx = sv.selectedDeckIndex;
		if (idx < 0 || idx >= hc.decks.length) {
			showInlineWarning("Select a deck to remove first.");
			return;
		}
		if (hc.decks.length <= 1) {
			showInlineWarning("Cannot remove the last deck. Use Clear instead.");
			return;
		}
		var removed = hc.decks[idx];
		hc.decks.splice(idx, 1);

		// Expand adjacent deck to fill the gap left by the removed deck
		if (idx === 0 && hc.decks.length > 0) {
			// Removed first deck: expand next deck upward
			hc.decks[0].topDepth = removed.topDepth;
		} else if (idx >= hc.decks.length && hc.decks.length > 0) {
			// Removed last deck: expand previous deck downward
			hc.decks[hc.decks.length - 1].baseDepth = removed.baseDepth;
		} else if (hc.decks.length > 0) {
			// Removed middle deck: expand deck above downward
			hc.decks[idx - 1].baseDepth = removed.baseDepth;
		}

		hc.sortDecks();
		sv.selectedDeckIndex = -1;
		sv.setData(hc);
		updateSummary();
	}

	function removePrimer(hc, sv) {
		var idx = sv.selectedPrimerIndex;
		if (idx < 0 || idx >= hc.primers.length) {
			showInlineWarning("Select a primer to remove first.");
			return;
		}
		hc.primers.splice(idx, 1);
		sv.selectedPrimerIndex = -1;
		sv.setData(hc);
		updateSummary();
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
	products.forEach(function(product) {
		var cat = product.productCategory || "Other";
		if (!categories[cat]) categories[cat] = [];
		categories[cat].push(product);
	});

	var catOrder = ["NonExplosive", "BulkExplosive", "HighExplosive", "Initiator", "Spacer"];
	var catLabels = {
		"NonExplosive": "Non-Explosive",
		"BulkExplosive": "Bulk Explosive",
		"HighExplosive": "High Explosive",
		"Initiator": "Initiators",
		"Spacer": "Spacers"
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
			(function(prod) {
				item.addEventListener("dragstart", function(e) {
					e.dataTransfer.setData("text/plain", JSON.stringify({
						productID: prod.productID || prod.name,
						name: prod.name,
						productCategory: prod.productCategory,
						productType: prod.productType,
						density: prod.density,
						colorHex: prod.colorHex
					}));
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
function setupDragDrop(canvas, sectionView, workingCharging, refHole) {
	canvas.addEventListener("dragover", function(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	});

	canvas.addEventListener("drop", function(e) {
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
			window.loadedProducts.forEach(function(p) {
				if ((p.productID && p.productID === productData.productID) || p.name === productData.name) {
					fullProduct = p;
				}
			});
		}
		if (!fullProduct) {
			fullProduct = productData; // Use the drag data as fallback
		}

		// Determine drop depth from Y position
		var dropDepth = sectionView.yToDepth(
			(e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.getBoundingClientRect().height)
		);

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
			defaultDeckLength = 0.5; // Short deck for packages
		} else if (fullProduct.productCategory === "Spacer") {
			defaultDeckLength = 0.4; // Short for spacers
		}

		// Calculate interval: drop point is center of new deck
		var halfLen = defaultDeckLength / 2;
		var topD = Math.max(minD, dropDepth - halfLen);
		var baseD = Math.min(maxD, topD + defaultDeckLength);

		workingCharging.fillInterval(
			parseFloat(topD.toFixed(2)),
			parseFloat(baseD.toFixed(2)),
			deckType,
			productSnapshot(fullProduct)
		);

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
		window.loadedProducts.forEach(function(p) {
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
		{ label: "Depth from Collar (m)", name: "depthFromCollar", type: "number", value: defaultDepth.toFixed(1), step: "0.1" },
		{ label: "Detonator", name: "detonatorName", type: "select", options: detOptions, value: detOptions.length > 1 ? detOptions[1].value : "" },
		{ label: "Detonator Qty", name: "detonatorQty", type: "number", value: "1", step: "1" },
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
		onConfirm: function() {
			var data = getFormData(formContent);
			var depth = parseFloat(data.depthFromCollar) || defaultDepth;

			// Find product details
			var detProduct = null;
			var boosterProduct = null;
			if (data.detonatorName && window.loadedProducts) {
				window.loadedProducts.forEach(function(p) {
					if (p.name === data.detonatorName) detProduct = p;
				});
			}
			if (data.boosterName && window.loadedProducts) {
				window.loadedProducts.forEach(function(p) {
					if (p.name === data.boosterName) boosterProduct = p;
				});
			}

			var primer = new Primer({
				holeID: workingCharging.holeID,
				lengthFromCollar: depth,
				detonator: {
					productID: detProduct ? detProduct.productID : null,
					productName: data.detonatorName || null,
					initiatorType: detProduct ? (detProduct.initiatorType || detProduct.productType) : null,
					deliveryVodMs: detProduct ? (detProduct.deliveryVodMs || 0) : 0,
					delayMs: parseFloat(data.delayMs) || 0,
					quantity: parseInt(data.detonatorQty) || 1
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
 * Show rule selection dropdown and apply selected rule
 */
function showRuleSelector(workingCharging, sectionView, refHole) {
	var configs = window.loadedChargeConfigs || new Map();
	if (configs.size === 0) {
		showModalMessage("Apply Rule", "No charge configs loaded. Import a config template first.", "warning");
		return;
	}

	var configOptions = [];
	configs.forEach(function(config, configID) {
		configOptions.push({ value: configID, text: config.configName || configID });
	});

	var fields = [
		{ label: "Charge Configuration", name: "configID", type: "select", options: configOptions, value: configOptions[0].value }
	];
	var formContent = createEnhancedFormContent(fields);

	var ruleDialog = new FloatingDialog({
		title: "Apply Rule",
		content: formContent,
		width: 350,
		height: 180,
		showConfirm: true,
		confirmText: "Apply",
		showCancel: true,
		onConfirm: function() {
			var data = getFormData(formContent);
			var config = configs.get(data.configID);
			if (!config) return;

			// Apply rule via SimpleRuleEngine (imported dynamically to avoid circular deps)
			if (typeof window.applyChargeRule === "function") {
				var newCharging = window.applyChargeRule(refHole, config);
				if (newCharging) {
					workingCharging.decks = newCharging.decks;
					workingCharging.primers = newCharging.primers;
					workingCharging.modified = new Date().toISOString();
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
 * Apply working charging to all selected holes
 */
function applyToSelectedHoles(workingCharging, refHole) {
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

	showConfirmationDialog(
		"Apply Charging",
		"Apply this charging design to " + targets.length + " hole(s)?",
		"Apply",
		"Cancel",
		function() {
			var chargingJSON = workingCharging.toJSON();

			for (var i = 0; i < targets.length; i++) {
				var hole = targets[i];
				// Clone the design for each hole, adjusting for different hole lengths
				var clone = JSON.parse(JSON.stringify(chargingJSON));
				clone.holeID = hole.holeID;
				clone.entityName = hole.entityName;
				clone.holeDiameterMm = hole.holeDiameter || workingCharging.holeDiameterMm;
				clone.holeLength = hole.holeLengthCalculated || workingCharging.holeLength;

				var hc = HoleCharging.fromJSON(clone);

				if (!window.loadedCharging) {
					window.loadedCharging = new Map();
				}
				window.loadedCharging.set(hole.holeID, hc);
			}

			// Save to IndexedDB
			if (typeof window.debouncedSaveCharging === "function") {
				window.debouncedSaveCharging();
			}

			// Redraw
			if (typeof window.drawData === "function") {
				window.drawData(window.allBlastHoles, window.selectedHole);
			}

			showModalMessage("Charging Applied", "Applied charging to " + targets.length + " hole(s).", "success");
		}
	);
}
