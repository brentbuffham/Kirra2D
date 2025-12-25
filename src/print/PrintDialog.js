/* prettier-ignore-file */
//=================================================
// PrintDialog.js - User Input Dialog for Printing
//=================================================
// Collects file name, designer, and output type

import { FloatingDialog } from "../dialog/FloatingDialog.js";

// Step 1) Generate default file name based on date and output type
function generateDefaultFileName(outputType) {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    var dateStr = year + month + day;
    var typeStr = outputType === "raster" ? "Raster" : "Vector";
    return dateStr + "-Kirra-" + typeStr + "-Print";
}

// Step 2) Show print settings dialog
export function showPrintDialog(mode, context, onConfirm) {
    // Step 2a) Build form content manually (FloatingDialog createFormContent doesn't support radio buttons)
    var formContent = document.createElement("div");
    formContent.style.display = "flex";
    formContent.style.flexDirection = "column";
    formContent.style.gap = "12px";
    formContent.style.padding = "10px";
    
    // Step 2a1) Determine if dark mode is active
    var isDarkMode = document.body.classList.contains("dark-mode");
    var textColor = isDarkMode ? "var(--dark-mode-text)" : "var(--light-mode-text)";
    
    // Step 2a2) Retrieve last values from localStorage
    var lastDesigner = localStorage.getItem("kirra_print_designer") || "";
    var lastFileName = localStorage.getItem("kirra_print_filename") || "";
    
    // Step 2b) File name input row
    var fileNameRow = document.createElement("div");
    fileNameRow.style.display = "grid";
    fileNameRow.style.gridTemplateColumns = "100px 1fr";
    fileNameRow.style.columnGap = "8px";
    fileNameRow.style.alignItems = "center";
    
    var fileNameLabel = document.createElement("label");
    fileNameLabel.textContent = "File Name:";
    fileNameLabel.style.fontSize = "12px";
    fileNameLabel.style.fontFamily = "sans-serif";
    fileNameLabel.style.color = textColor;
    fileNameLabel.style.textAlign = "right";
    fileNameLabel.style.paddingRight = "4px";
    
    var fileNameInput = document.createElement("input");
    fileNameInput.type = "text";
    fileNameInput.name = "fileName";
    fileNameInput.placeholder = "Leave blank for auto-generated name";
    fileNameInput.value = lastFileName;
    fileNameInput.style.fontSize = "11px";
    fileNameInput.style.height = "24px";
    fileNameInput.style.padding = "2px 6px";
    fileNameInput.style.width = "100%";
    fileNameInput.style.borderRadius = "3px";
    fileNameInput.style.backgroundColor = "#fff";
    fileNameInput.style.color = "#000";
    fileNameInput.style.border = "1px solid #999";
    fileNameInput.style.boxSizing = "border-box";
    
    fileNameRow.appendChild(fileNameLabel);
    fileNameRow.appendChild(fileNameInput);
    formContent.appendChild(fileNameRow);
    
    // Step 2c) Designer input row
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
    
    // Step 2d) Output type radio group
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

    // Step 2e) Create dialog (height increased by 50px from 180 to 230)
    var dialog = new FloatingDialog({
        title: "Print Settings (" + mode + " Mode)",
        content: formContent,
        layoutType: "standard",
        width: 400,
        height: 230,
        showConfirm: true,
        showCancel: true,
        confirmText: "Generate PDF",
        cancelText: "Cancel",
        allowOutsideClick: false,
        onConfirm: function() {
            // Step 2e1) Collect form data
            var formData = {};
            
            // Get designer input
            formData.designer = designerInput.value || "";
            
            // Step 2e1a) Save designer name to localStorage for next time
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
            
            // Step 2e1b) Get file name - use input value or generate default
            var userFileName = fileNameInput.value.trim();
            if (userFileName) {
                formData.fileName = userFileName;
                localStorage.setItem("kirra_print_filename", userFileName);
            } else {
                formData.fileName = generateDefaultFileName(formData.outputType);
            }
            
            // Step 2e2) Call confirm callback with data
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

    // Step 2f) Show dialog
    dialog.show();
    
    return dialog;
}

