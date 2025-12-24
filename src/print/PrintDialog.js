/* prettier-ignore-file */
//=================================================
// PrintDialog.js - User Input Dialog for Printing
//=================================================
// Collects blast name, designer, paper size, orientation, and output type

import { FloatingDialog } from "../dialog/FloatingDialog.js";

// Step 1) Show print settings dialog
export function showPrintDialog(mode, context, onConfirm) {
    // Step 1a) Create form fields (paper size and orientation already set in UI)
    const fields = [
        // {
        //     //REDUNDANT FIELD - WILL BE REMOVED IN FUTURE
        //     type: "text",
        //     name: "blastName",
        //     label: "Blast Name:",
        //     value: "Untitled Blast",
        //     placeholder: "Enter blast name"
        // },
        {
            type: "text",
            name: "designer",
            label: "Designer:",
            value: "",
            placeholder: "Enter designer name"
        },
        // {
        //     //NOT IN USE - Might be added later but for now it is not used
        //     type: "textarea",
        //     name: "notes",
        //     label: "Additional Notes:",
        //     value: "",
        //     placeholder: "Optional notes (not currently displayed on PDF)",
        //     rows: 3
        // },
        {
            type: "radio",
            name: "outputType",
            label: "Output Type:",
            value: "vector",
            options: [
                { value: "vector", text: "Vector PDF (scalable, smaller file)" },
                { value: "raster", text: "High-Res Image PDF (pixel-perfect)" }
            ]
        }
    ];

    // Step 1b) Create form content HTML
    const formContent = createFormContent(fields);

    // Step 1c) Create dialog
    const dialog = new FloatingDialog({
        title: "Print Settings (" + mode + " Mode)",
        content: formContent,
        layoutType: "standard",
        width: 450,
        height: 300,
        showConfirm: true,
        showCancel: true,
        confirmText: "Generate PDF",
        cancelText: "Cancel",
        allowOutsideClick: false,
        onConfirm: function() {
            // Step 1c1) Collect form data
            const formData = collectFormData(fields);
            
            // // Step 1c2) Validate
            // if (!formData.blastName || formData.blastName.trim() === "") {
            //     formData.blastName = "Untitled Blast";
            // }
            
            // Step 1c3) Call confirm callback with data
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

    // Step 1d) Show dialog
    dialog.show();
    
    return dialog;
}

// Step 2) Create form content HTML
function createFormContent(fields) {
    let html = "<div style=\"padding: 10px;\">";
    
    fields.forEach(function(field) {
        html += "<div style=\"margin-bottom: 12px;\">";
        
        // Label
        html += "<label style=\"display: block; margin-bottom: 5px;\">";
        html += field.label;
        html += "</label>";
        
        // Input based on type
        if (field.type === "text") {
            html += "<input type=\"text\" ";
            html += "name=\"" + field.name + "\" ";
            html += "value=\"" + (field.value || "") + "\" ";
            html += "placeholder=\"" + (field.placeholder || "") + "\" ";
            html += "style=\"width: 100%; padding: 5px; box-sizing: border-box;\" />";
            
        // } else if (field.type === "textarea") {
        //     html += "<textarea ";
        //     html += "name=\"" + field.name + "\" ";
        //     html += "rows=\"" + (field.rows || 3) + "\" ";
        //     html += "placeholder=\"" + (field.placeholder || "") + "\" ";
        //     html += "style=\"width: 100%; padding: 5px; box-sizing: border-box;\">";
        //     html += field.value || "";
        //     html += "</textarea>";
            
        } else if (field.type === "select") {
            html += "<select name=\"" + field.name + "\" ";
            html += "style=\"width: 100%; padding: 5px;\">";
            
            field.options.forEach(function(option) {
                html += "<option value=\"" + option.value + "\"";
                if (option.value === field.value) {
                    html += " selected";
                }
                html += ">" + option.text + "</option>";
            });
            
            html += "</select>";
            
        } else if (field.type === "radio") {
            field.options.forEach(function(option) {
                html += "<label style=\"display: block; margin-bottom: 5px;\">";
                html += "<input type=\"radio\" ";
                html += "name=\"" + field.name + "\" ";
                html += "value=\"" + option.value + "\"";
                if (option.value === field.value) {
                    html += " checked";
                }
                html += " /> ";
                html += option.text;
                html += "</label>";
            });
        }
        
        html += "</div>";
    });
    
    html += "</div>";
    
    return html;
}

// Step 3) Collect form data
function collectFormData(fields) {
    const formData = {};
    
    fields.forEach(function(field) {
        if (field.type === "radio") {
            // Get checked radio button
            const radios = document.getElementsByName(field.name);
            for (let i = 0; i < radios.length; i++) {
                if (radios[i].checked) {
                    formData[field.name] = radios[i].value;
                    break;
                }
            }
        } else {
            // Get input/select/textarea value
            const element = document.getElementsByName(field.name)[0];
            if (element) {
                formData[field.name] = element.value;
            }
        }
    });
    
    return formData;
}

// Step 4) Helper to create enhanced form with better styling (optional)
export function createEnhancedFormContent(fields) {
    const container = document.createElement("div");
    container.style.padding = "10px";
    container.style.maxHeight = "450px";
    container.style.overflowY = "auto";
    
    fields.forEach(function(field) {
        const fieldDiv = document.createElement("div");
        fieldDiv.style.marginBottom = "12px";
        
        // Label
        const label = document.createElement("label");
        label.textContent = field.label;
        label.style.display = "block";
        label.style.marginBottom = "5px";
        label.style.fontSize = "11px";
        label.style.fontFamily = "sans-serif";
        label.style.color = "var(--light-mode-text)";
        label.style.lineHeight = "1.2";
        label.style.margin = "0";
        label.style.whiteSpace = "nowrap";
        label.style.textAlign = "left";
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";
        label.style.paddingRight = "4px";
        // label.style.fontWeight = "bold";
        fieldDiv.appendChild(label);
        
        // Input
        if (field.type === "text") {
            const input = document.createElement("input");
            input.type = "text";
            input.name = field.name;
            input.value = field.value || "";
            input.placeholder = field.placeholder || "";
            input.style.width = "100%";
            input.style.padding = "5px";
            input.style.boxSizing = "border-box";
            fieldDiv.appendChild(input);
            
        // } else if (field.type === "textarea") {
        //     const textarea = document.createElement("textarea");
        //     textarea.name = field.name;
        //     textarea.rows = field.rows || 3;
        //     textarea.placeholder = field.placeholder || "";
        //     textarea.value = field.value || "";
        //     textarea.style.width = "100%";
        //     textarea.style.padding = "5px";
        //     textarea.style.boxSizing = "border-box";
        //     fieldDiv.appendChild(textarea);
            
        } else if (field.type === "select") {
            const select = document.createElement("select");
            select.name = field.name;
            select.style.width = "100%";
            select.style.padding = "5px";
            
            field.options.forEach(function(option) {
                const opt = document.createElement("option");
                opt.value = option.value;
                opt.textContent = option.text;
                if (option.value === field.value) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
            
            fieldDiv.appendChild(select);
            
        } else if (field.type === "radio") {
            field.options.forEach(function(option) {
                const radioLabel = document.createElement("label");
                radioLabel.style.display = "block";
                radioLabel.style.marginBottom = "5px";
                
                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = field.name;
                radio.value = option.value;
                if (option.value === field.value) {
                    radio.checked = true;
                }
                
                radioLabel.appendChild(radio);
                radioLabel.appendChild(document.createTextNode(" " + option.text));
                fieldDiv.appendChild(radioLabel);
            });
        }
        
        container.appendChild(fieldDiv);
    });
    
    return container;
}

