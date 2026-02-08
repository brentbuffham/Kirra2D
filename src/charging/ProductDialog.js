/**
 * @fileoverview ProductDialog - Product management UI for the charging system
 * Uses FloatingDialog (per project conventions) for product CRUD operations
 */

import { FloatingDialog, createEnhancedFormContent, getFormData, showConfirmationDialog } from "../dialog/FloatingDialog.js";
import { Product } from "./products/Product.js";
import { NonExplosiveProduct } from "./products/NonExplosiveProduct.js";
import { BulkExplosiveProduct } from "./products/BulkExplosiveProduct.js";
import { HighExplosiveProduct } from "./products/HighExplosiveProduct.js";
import { InitiatorProduct, ElectronicDetonator, ShockTubeDetonator, ElectricDetonator, DetonatingCordProduct } from "./products/InitiatorProduct.js";
import { SpacerProduct } from "./products/SpacerProduct.js";
import {
	NON_EXPLOSIVE_TYPES,
	BULK_EXPLOSIVE_TYPES,
	HIGH_EXPLOSIVE_TYPES,
	INITIATOR_TYPES,
	SPACER_TYPES,
	DECK_COLORS
} from "./ChargingConstants.js";

// Product type options by category
var PRODUCT_TYPE_OPTIONS = {
	NonExplosive: Object.values(NON_EXPLOSIVE_TYPES),
	BulkExplosive: Object.values(BULK_EXPLOSIVE_TYPES),
	HighExplosive: Object.values(HIGH_EXPLOSIVE_TYPES),
	Initiator: Object.values(INITIATOR_TYPES),
	Spacer: Object.values(SPACER_TYPES)
};

var CATEGORY_LABELS = {
	NonExplosive: "Non-Explosive",
	BulkExplosive: "Bulk Explosive",
	HighExplosive: "High Explosive",
	Initiator: "Initiator",
	Spacer: "Spacer"
};

/**
 * Show the product manager dialog
 * Lists all products with add/edit/delete capability
 */
export function showProductManagerDialog() {
	var productsMap = window.loadedProducts || new Map();

	var contentDiv = document.createElement("div");
	contentDiv.style.display = "flex";
	contentDiv.style.flexDirection = "column";
	contentDiv.style.height = "100%";

	// Product list table
	var tableContainer = document.createElement("div");
	tableContainer.style.flex = "1";
	tableContainer.style.overflow = "auto";
	tableContainer.style.border = "1px solid #555";
	tableContainer.style.borderRadius = "4px";

	var table = document.createElement("table");
	table.style.width = "100%";
	table.style.borderCollapse = "collapse";
	table.style.fontSize = "11px";

	var thead = document.createElement("thead");
	thead.innerHTML = '<tr style="background: #333; color: #fff; position: sticky; top: 0;">' +
		'<th style="padding: 4px 6px; text-align: left;">Name</th>' +
		'<th style="padding: 4px 6px; text-align: left;">Category</th>' +
		'<th style="padding: 4px 6px; text-align: left;">Type</th>' +
		'<th style="padding: 4px 6px; text-align: right;">Density</th>' +
		'<th style="padding: 4px 6px; text-align: center;">Color</th>' +
		"</tr>";
	table.appendChild(thead);

	var tbody = document.createElement("tbody");
	table.appendChild(tbody);
	tableContainer.appendChild(table);
	contentDiv.appendChild(tableContainer);

	// Action bar - uses floating-dialog-footer/btn styling for consistency
	// Placed inside content so dialog stays open during CRUD operations
	var actionBar = document.createElement("div");
	actionBar.className = "floating-dialog-footer";

	var addBtn = document.createElement("button");
	addBtn.textContent = "Add Product";
	addBtn.className = "floating-dialog-btn confirm";

	var editBtn = document.createElement("button");
	editBtn.textContent = "Edit";
	editBtn.className = "floating-dialog-btn";

	var deleteBtn = document.createElement("button");
	deleteBtn.textContent = "Delete";
	deleteBtn.className = "floating-dialog-btn";

	actionBar.appendChild(deleteBtn);
	actionBar.appendChild(editBtn);
	actionBar.appendChild(addBtn);
	contentDiv.appendChild(actionBar);

	var selectedProductID = null;

	function refreshTable() {
		tbody.innerHTML = "";
		productsMap = window.loadedProducts || new Map();
		productsMap.forEach(function(product, productID) {
			var row = document.createElement("tr");
			row.style.cursor = "pointer";
			row.style.borderBottom = "1px solid #444";
			row.setAttribute("data-product-id", productID);

			if (productID === selectedProductID) {
				row.style.backgroundColor = "var(--selected-color, #1976d2)";
				row.style.color = "#fff";
			}

			row.innerHTML =
				'<td style="padding: 3px 6px;">' + (product.name || "") + "</td>" +
				'<td style="padding: 3px 6px;">' + (CATEGORY_LABELS[product.productCategory] || product.productCategory) + "</td>" +
				'<td style="padding: 3px 6px;">' + (product.productType || "") + "</td>" +
				'<td style="padding: 3px 6px; text-align: right;">' + (product.density != null ? product.density.toFixed(3) : "-") + "</td>" +
				'<td style="padding: 3px 6px; text-align: center;"><span style="display:inline-block;width:16px;height:16px;border-radius:2px;border:1px solid #999;background:' + (product.colorHex || "#ccc") + ';"></span></td>';

			row.addEventListener("click", function() {
				selectedProductID = productID;
				refreshTable();
			});

			row.addEventListener("dblclick", function() {
				selectedProductID = productID;
				showEditProductDialog(product, function(updatedProduct) {
					productsMap.set(productID, updatedProduct);
					window.loadedProducts = productsMap;
					triggerProductSave();
					refreshTable();
				});
			});

			tbody.appendChild(row);
		});
	}

	refreshTable();

	// Button handlers - dialog stays open, sub-dialogs overlay on top
	addBtn.addEventListener("click", function() {
		showAddProductDialog(function(newProduct) {
			productsMap.set(newProduct.productID, newProduct);
			window.loadedProducts = productsMap;
			triggerProductSave();
			selectedProductID = newProduct.productID;
			refreshTable();
		});
	});

	editBtn.addEventListener("click", function() {
		if (!selectedProductID) return;
		var product = productsMap.get(selectedProductID);
		if (!product) return;
		showEditProductDialog(product, function(updatedProduct) {
			productsMap.set(selectedProductID, updatedProduct);
			window.loadedProducts = productsMap;
			triggerProductSave();
			refreshTable();
		});
	});

	deleteBtn.addEventListener("click", function() {
		if (!selectedProductID) return;
		var product = productsMap.get(selectedProductID);
		if (!product) return;
		showConfirmationDialog(
			"Delete Product",
			"Delete product '" + product.name + "'?",
			"Delete",
			"Cancel",
			function() {
				productsMap.delete(selectedProductID);
				window.loadedProducts = productsMap;
				triggerProductSave();
				selectedProductID = null;
				refreshTable();
			}
		);
	});

	var dialog = new FloatingDialog({
		title: "Product Manager",
		content: contentDiv,
		width: 550,
		height: 400,
		showConfirm: false,
		showCancel: true,
		cancelText: "Close",
		draggable: true,
		resizable: true,
		layoutType: "standard"
	});

	dialog.show();
	return dialog;
}

/**
 * Show dialog for adding a new product
 */
function showAddProductDialog(onSave) {
	var category = "NonExplosive";

	var contentDiv = document.createElement("div");
	contentDiv.style.display = "flex";
	contentDiv.style.flexDirection = "column";
	contentDiv.style.gap = "4px";

	// Category selector (changes available fields)
	var categoryFields = [
		{
			label: "Category",
			name: "productCategory",
			type: "select",
			value: category,
			options: [
				{ value: "NonExplosive", text: "Non-Explosive" },
				{ value: "BulkExplosive", text: "Bulk Explosive" },
				{ value: "HighExplosive", text: "High Explosive" },
				{ value: "Initiator", text: "Initiator" },
				{ value: "Spacer", text: "Spacer" }
			]
		}
	];

	var categoryForm = createEnhancedFormContent(categoryFields);
	contentDiv.appendChild(categoryForm);

	// Dynamic fields container
	var fieldsContainer = document.createElement("div");
	contentDiv.appendChild(fieldsContainer);

	function buildFields(cat) {
		fieldsContainer.innerHTML = "";
		var fields = getFieldsForCategory(cat, null);
		var form = createEnhancedFormContent(fields);
		fieldsContainer.appendChild(form);
	}

	buildFields(category);

	// Listen for category change
	var catSelect = categoryForm.querySelector('select[name="productCategory"]');
	if (catSelect) {
		catSelect.addEventListener("change", function() {
			category = this.value;
			buildFields(category);
		});
	}

	var dialog = new FloatingDialog({
		title: "Add Product",
		content: contentDiv,
		width: 400,
		height: 500,
		showConfirm: true,
		showCancel: true,
		confirmText: "Add",
		draggable: true,
		resizable: true,
		layoutType: "standard",
		onConfirm: function() {
			var catData = getFormData(categoryForm);
			var fieldData = getFormData(fieldsContainer);
			var merged = Object.assign({}, catData, fieldData);
			var product = createProductFromFormData(merged);
			dialog.close();
			if (onSave) onSave(product);
		}
	});

	dialog.show();
}

/**
 * Show dialog for editing an existing product
 */
function showEditProductDialog(product, onSave) {
	var json = product.toJSON();
	var fields = getFieldsForCategory(json.productCategory, json);

	// Add category as read-only info
	var categoryLabel = document.createElement("div");
	categoryLabel.style.fontSize = "11px";
	categoryLabel.style.padding = "4px 0";
	categoryLabel.style.color = "#999";
	categoryLabel.textContent = "Category: " + (CATEGORY_LABELS[json.productCategory] || json.productCategory);

	var formContent = createEnhancedFormContent(fields);

	var contentDiv = document.createElement("div");
	contentDiv.appendChild(categoryLabel);
	contentDiv.appendChild(formContent);

	var dialog = new FloatingDialog({
		title: "Edit Product: " + product.name,
		content: contentDiv,
		width: 400,
		height: 500,
		showConfirm: true,
		showCancel: true,
		confirmText: "Save",
		draggable: true,
		resizable: true,
		layoutType: "standard",
		onConfirm: function() {
			var formData = getFormData(formContent);
			formData.productCategory = json.productCategory;
			formData.productID = json.productID;
			formData.created = json.created;
			var updatedProduct = createProductFromFormData(formData);
			dialog.close();
			if (onSave) onSave(updatedProduct);
		}
	});

	dialog.show();
}

/**
 * Get form field definitions for a product category
 */
function getFieldsForCategory(category, existingData) {
	var d = existingData || {};
	var typeOptions = (PRODUCT_TYPE_OPTIONS[category] || []).map(function(t) {
		return { value: t, text: t };
	});

	// Common fields
	var fields = [
		{ label: "Type", name: "productType", type: "select", value: d.productType || "", options: typeOptions },
		{ label: "Name", name: "name", type: "text", value: d.name || "" },
		{ label: "Supplier", name: "supplier", type: "text", value: d.supplier || "" },
		{ label: "Density (g/cc)", name: "density", type: "number", value: d.density || "", step: "0.001" },
		{ label: "Color", name: "colorHex", type: "color", value: d.colorHex || "#CCCCCC" },
		{ label: "Description", name: "description", type: "text", value: d.description || "" }
	];

	// Category-specific fields
	if (category === "NonExplosive") {
		fields.push({ label: "Particle Size (mm)", name: "particleSizeMm", type: "number", value: d.particleSizeMm || "", step: "0.1" });
	} else if (category === "BulkExplosive") {
		fields.push(
			{ label: "Compressible", name: "isCompressible", type: "checkbox", checked: d.isCompressible || false },
			{ label: "Min Density (g/cc)", name: "minDensity", type: "number", value: d.minDensity || "", step: "0.01" },
			{ label: "Max Density (g/cc)", name: "maxDensity", type: "number", value: d.maxDensity || "", step: "0.01" },
			{ label: "VOD (m/s)", name: "vodMs", type: "number", value: d.vodMs || "", step: "1" },
			{ label: "RE (kJ/kg)", name: "reKjKg", type: "number", value: d.reKjKg || "", step: "1" },
			{ label: "RWS (%)", name: "rws", type: "number", value: d.rws || "", step: "1" },
			{ label: "Water Resistant", name: "waterResistant", type: "checkbox", checked: d.waterResistant || false },
			{ label: "Damp Resistant", name: "dampResistant", type: "checkbox", checked: d.dampResistant || false }
		);
	} else if (category === "HighExplosive") {
		fields.push(
			{ label: "Mass (grams)", name: "massGrams", type: "number", value: d.massGrams || "", step: "1" },
			{ label: "Diameter (mm)", name: "diameterMm", type: "number", value: d.diameterMm || "", step: "0.1" },
			{ label: "Length (mm)", name: "lengthMm", type: "number", value: d.lengthMm || "", step: "0.1" },
			{ label: "VOD (m/s)", name: "vodMs", type: "number", value: d.vodMs || "", step: "1" },
			{ label: "RE (kJ/kg)", name: "reKjKg", type: "number", value: d.reKjKg || "", step: "1" },
			{ label: "Water Resistant", name: "waterResistant", type: "checkbox", checked: d.waterResistant || false },
			{ label: "Cap Sensitive", name: "capSensitive", type: "checkbox", checked: d.capSensitive || false }
		);
	} else if (category === "Initiator") {
		fields.push(
			{ label: "Initiator Type", name: "initiatorType", type: "select", value: d.initiatorType || "Electronic", options: [
				{ value: "Electronic", text: "Electronic" },
				{ value: "ShockTube", text: "Shock Tube" },
				{ value: "Electric", text: "Electric" },
				{ value: "DetonatingCord", text: "Detonating Cord" }
			]},
			{ label: "Delivery VOD (m/s)", name: "deliveryVodMs", type: "number", value: d.deliveryVodMs != null ? d.deliveryVodMs : "", step: "1" },
			{ label: "Shell Dia. (mm)", name: "shellDiameterMm", type: "number", value: d.shellDiameterMm || "7.6", step: "0.1" },
			{ label: "Shell Len. (mm)", name: "shellLengthMm", type: "number", value: d.shellLengthMm || "98", step: "0.1" },
			{ label: "Min Delay (ms)", name: "minDelayMs", type: "number", value: d.minDelayMs != null ? d.minDelayMs : "", step: "1" },
			{ label: "Max Delay (ms)", name: "maxDelayMs", type: "number", value: d.maxDelayMs || "", step: "1" },
			{ label: "Delay Inc. (ms)", name: "delayIncrementMs", type: "number", value: d.delayIncrementMs || "", step: "0.1" },
			{ label: "Delay Series (;)", name: "delaySeriesMs", type: "text", value: d.delaySeriesMs ? (Array.isArray(d.delaySeriesMs) ? d.delaySeriesMs.join(";") : d.delaySeriesMs) : "" },
			{ label: "Core Load (g/m)", name: "coreLoadGramsPerMeter", type: "number", value: d.coreLoadGramsPerMeter || "", step: "1" }
		);
	} else if (category === "Spacer") {
		fields.push(
			{ label: "Spacer Type", name: "spacerType", type: "select", value: d.spacerType || "GasBag", options: [
				{ value: "GasBag", text: "Gas Bag" },
				{ value: "StemCap", text: "Stem Cap" },
				{ value: "StemBrush", text: "Stem Brush" },
				{ value: "StemPlug", text: "Stem Plug" },
				{ value: "StemLock", text: "Stem Lock" }
			]},
			{ label: "Length (mm)", name: "lengthMm", type: "number", value: d.lengthMm || "", step: "0.1" },
			{ label: "Diameter (mm)", name: "diameterMm", type: "number", value: d.diameterMm || "", step: "0.1" }
		);
	}

	return fields;
}

/**
 * Create a product instance from form data
 */
function createProductFromFormData(data) {
	// Parse numeric fields
	var opts = {
		productID: data.productID || undefined,
		productCategory: data.productCategory,
		productType: data.productType,
		name: data.name,
		supplier: data.supplier,
		density: data.density ? parseFloat(data.density) : 0,
		colorHex: data.colorHex || "#CCCCCC",
		description: data.description || "",
		created: data.created || undefined
	};

	switch (data.productCategory) {
		case "NonExplosive":
			opts.particleSizeMm = data.particleSizeMm ? parseFloat(data.particleSizeMm) : null;
			return new NonExplosiveProduct(opts);

		case "BulkExplosive":
			opts.isCompressible = data.isCompressible === "true" || data.isCompressible === true;
			opts.minDensity = data.minDensity ? parseFloat(data.minDensity) : null;
			opts.maxDensity = data.maxDensity ? parseFloat(data.maxDensity) : null;
			opts.vodMs = data.vodMs ? parseFloat(data.vodMs) : null;
			opts.reKjKg = data.reKjKg ? parseFloat(data.reKjKg) : null;
			opts.rws = data.rws ? parseFloat(data.rws) : null;
			opts.waterResistant = data.waterResistant === "true" || data.waterResistant === true;
			opts.dampResistant = data.dampResistant === "true" || data.dampResistant === true;
			return new BulkExplosiveProduct(opts);

		case "HighExplosive":
			opts.massGrams = data.massGrams ? parseFloat(data.massGrams) : null;
			opts.diameterMm = data.diameterMm ? parseFloat(data.diameterMm) : null;
			opts.lengthMm = data.lengthMm ? parseFloat(data.lengthMm) : null;
			opts.vodMs = data.vodMs ? parseFloat(data.vodMs) : null;
			opts.reKjKg = data.reKjKg ? parseFloat(data.reKjKg) : null;
			opts.waterResistant = data.waterResistant === "true" || data.waterResistant === true;
			opts.capSensitive = data.capSensitive === "true" || data.capSensitive === true;
			return new HighExplosiveProduct(opts);

		case "Initiator":
			opts.initiatorType = data.initiatorType || "Electronic";
			opts.deliveryVodMs = data.deliveryVodMs != null && data.deliveryVodMs !== "" ? parseFloat(data.deliveryVodMs) : 0;
			opts.shellDiameterMm = data.shellDiameterMm ? parseFloat(data.shellDiameterMm) : 7.6;
			opts.shellLengthMm = data.shellLengthMm ? parseFloat(data.shellLengthMm) : 98;
			opts.minDelayMs = data.minDelayMs !== "" && data.minDelayMs != null ? parseFloat(data.minDelayMs) : 0;
			opts.maxDelayMs = data.maxDelayMs ? parseFloat(data.maxDelayMs) : null;
			opts.delayIncrementMs = data.delayIncrementMs ? parseFloat(data.delayIncrementMs) : null;
			opts.coreLoadGramsPerMeter = data.coreLoadGramsPerMeter ? parseFloat(data.coreLoadGramsPerMeter) : null;
			// Parse delay series from semicolon-separated string
			if (data.delaySeriesMs && typeof data.delaySeriesMs === "string" && data.delaySeriesMs.trim().length > 0) {
				opts.delaySeriesMs = data.delaySeriesMs.split(";").map(function(v) { return parseFloat(v.trim()); }).filter(function(v) { return !isNaN(v); });
			}
			// Create correct subclass based on initiatorType
			switch (opts.initiatorType) {
				case "Electronic": return new ElectronicDetonator(opts);
				case "ShockTube": return new ShockTubeDetonator(opts);
				case "Electric": return new ElectricDetonator(opts);
				case "DetonatingCord": return new DetonatingCordProduct(opts);
				default: return new InitiatorProduct(opts);
			}

		case "Spacer":
			opts.spacerType = data.spacerType || "GasBag";
			opts.lengthMm = data.lengthMm ? parseFloat(data.lengthMm) : null;
			opts.diameterMm = data.diameterMm ? parseFloat(data.diameterMm) : null;
			return new SpacerProduct(opts);

		default:
			return new Product(opts);
	}
}

/**
 * Trigger debounced save of products via window function
 */
function triggerProductSave() {
	if (typeof window.debouncedSaveProducts === "function") {
		window.debouncedSaveProducts();
	}
}
