/* prettier-ignore-file */
//=================================================
// PrintDialog.js - User Input Dialog for Printing
//=================================================
// Collects designer, paper size, orientation, and output type

import { FloatingDialog } from "../dialog/FloatingDialog.js";

// Step 1) Show print settings dialog
export function showPrintDialog(mode, context, onConfirm) {
    // Step 1a) Build form content manually (FloatingDialog createFormContent doesn't support radio buttons)
    var formContent = document.createElement("div");
    formContent.style.display = "flex";
    formContent.style.flexDirection = "column";
    formContent.style.gap = "12px";
    formContent.style.padding = "10px";
    
    // Step 1a1) Determine if dark mode is active
    var isDarkMode = document.body.classList.contains("dark-mode");
    var textColor = isDarkMode ? "var(--dark-mode-text)" : "var(--light-mode-text)";
    
    // Step 1a2) Retrieve last designer name from localStorage
    var lastDesigner = localStorage.getItem("kirra_print_designer") || "";
    
    // Step 1b) Designer input row
    var designerRow = document.createElement("div");
    designerRow.style.display = "grid";
    designerRow.style.gridTemplateColumns = "100px 1fr";
    designerRow.style.columnGap = "8px";
    designerRow.style.alignItems = "center";
    
    var designerLabel = document.createElement("label");
    designerLabel.textContent = "Designer:";
    designerLabel.style.fontSize = "12px";
    designerLabel.style.fontFamily = "sans-serif";
    designerLabel.style.color = textColor;
    designerLabel.style.textAlign = "right";
    designerLabel.style.paddingRight = "4px";
    
    var designerInput = document.createElement("input");
    designerInput.type = "text";
    designerInput.name = "designer";
    designerInput.placeholder = "Enter designer name";
    designerInput.value = lastDesigner;
    designerInput.style.fontSize = "11px";
    designerInput.style.height = "24px";
    designerInput.style.padding = "2px 6px";
    designerInput.style.width = "100%";
    designerInput.style.borderRadius = "3px";
    designerInput.style.backgroundColor = "#fff";
    designerInput.style.color = "#000";
    designerInput.style.border = "1px solid #999";
    designerInput.style.boxSizing = "border-box";
    
    designerRow.appendChild(designerLabel);
    designerRow.appendChild(designerInput);
    formContent.appendChild(designerRow);
    
    // Step 1c) Output type radio group
    var outputRow = document.createElement("div");
    outputRow.style.display = "grid";
    outputRow.style.gridTemplateColumns = "100px 1fr";
    outputRow.style.columnGap = "8px";
    outputRow.style.alignItems = "start";
    
    var outputLabel = document.createElement("label");
    outputLabel.textContent = "Output Type:";
    outputLabel.style.fontSize = "12px";
    outputLabel.style.fontFamily = "sans-serif";
    outputLabel.style.color = textColor;
    outputLabel.style.textAlign = "right";
    outputLabel.style.paddingRight = "4px";
    outputLabel.style.paddingTop = "4px";
    
    var radioContainer = document.createElement("div");
    radioContainer.style.display = "flex";
    radioContainer.style.flexDirection = "column";
    radioContainer.style.gap = "6px";
    
    // Vector option
    var vectorLabel = document.createElement("label");
    vectorLabel.style.display = "flex";
    vectorLabel.style.alignItems = "center";
    vectorLabel.style.gap = "6px";
    vectorLabel.style.fontSize = "11px";
    vectorLabel.style.fontFamily = "sans-serif";
    vectorLabel.style.color = textColor;
    vectorLabel.style.cursor = "pointer";
    
    var vectorRadio = document.createElement("input");
    vectorRadio.type = "radio";
    vectorRadio.name = "outputType";
    vectorRadio.value = "vector";
    vectorRadio.checked = true;
    vectorRadio.style.margin = "0";
    vectorRadio.style.cursor = "pointer";
    
    vectorLabel.appendChild(vectorRadio);
    vectorLabel.appendChild(document.createTextNode("Vector PDF (scalable, smaller file)"));
    
    // Raster option
    var rasterLabel = document.createElement("label");
    rasterLabel.style.display = "flex";
    rasterLabel.style.alignItems = "center";
    rasterLabel.style.gap = "6px";
    rasterLabel.style.fontSize = "11px";
    rasterLabel.style.fontFamily = "sans-serif";
    rasterLabel.style.color = textColor;
    rasterLabel.style.cursor = "pointer";
    
    var rasterRadio = document.createElement("input");
    rasterRadio.type = "radio";
    rasterRadio.name = "outputType";
    rasterRadio.value = "raster";
    rasterRadio.style.margin = "0";
    rasterRadio.style.cursor = "pointer";
    
    rasterLabel.appendChild(rasterRadio);
    rasterLabel.appendChild(document.createTextNode("High-Res Image PDF (pixel-perfect)"));
    
    radioContainer.appendChild(vectorLabel);
    radioContainer.appendChild(rasterLabel);
    
    outputRow.appendChild(outputLabel);
    outputRow.appendChild(radioContainer);
    formContent.appendChild(outputRow);

    // Step 1d) Create dialog
    var dialog = new FloatingDialog({
        title: "Print Settings (" + mode + " Mode)",
        content: formContent,
        layoutType: "standard",
        width: 400,
        height: 180,
        showConfirm: true,
        showCancel: true,
        confirmText: "Generate PDF",
        cancelText: "Cancel",
        allowOutsideClick: false,
        onConfirm: function() {
            // Step 1d1) Collect form data
            var formData = {};
            
            // Get designer input
            formData.designer = designerInput.value || "";
            
            // Step 1d1a) Save designer name to localStorage for next time
            if (formData.designer) {
                localStorage.setItem("kirra_print_designer", formData.designer);
            }
            
            // Get checked radio button for outputType
            if (vectorRadio.checked) {
                formData.outputType = "vector";
            } else if (rasterRadio.checked) {
                formData.outputType = "raster";
            } else {
                formData.outputType = "vector"; // Default
            }
            
            // Step 1d2) Call confirm callback with data
            if (onConfirm) {
                onConfirm(formData);
            }
            
            // Close dialog
            dialog.close();
        },
        onCancel: function() {
            dialog.close();
        }
    });

    // Step 1e) Show dialog
    dialog.show();
    
    return dialog;
}

