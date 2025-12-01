// src/dialog/contextMenu/SurfacesContextMenu.js
//=============================================================
// SURFACES CONTEXT MENU
//=============================================================

// Step 1) Show surface context menu
function showSurfaceContextMenu(x, y, surfaceId = null) {
    // Step 1a) Stop any ongoing drag operations
    window.isDragging = false;
    // Step 1b) Clear any pending long press timeouts
    if (typeof window.longPressTimeout !== "undefined") {
        clearTimeout(window.longPressTimeout);
        window.longPressTimeout = null;
    }

    // Step 1c) Reset pan start positions to prevent jump when next drag starts
    if (typeof window.startPanX !== "undefined") {
        window.startPanX = null;
        window.startPanY = null;
    }

    // Step 2) Get the specific surface if ID provided, otherwise first visible surface
    var surface = surfaceId
        ? window.loadedSurfaces.get(surfaceId)
        : Array.from(window.loadedSurfaces.values()).find(function (s) {
              return s.visible;
          });
    if (!surface) return;

    // Step 3) Store reference for dialog callbacks
    var currentSurface = surface;

    // Step 4) Define gradient options - include texture option for textured meshes
    var gradientOptions = [
        { value: "default", text: "Default" },
        { value: "hillshade", text: "Hillshade" },
        { value: "viridis", text: "Viridis" },
        { value: "turbo", text: "Turbo" },
        { value: "parula", text: "Parula" },
        { value: "cividis", text: "Cividis" },
        { value: "terrain", text: "Terrain" }
    ];

    // Step 4a) Add texture option if this is a textured mesh
    if (currentSurface.isTexturedMesh) {
        gradientOptions.unshift({ value: "texture", text: "Texture (Original)" });
    }

    // Step 5) Create fields array for form content
    var initialTransparency = Math.round((currentSurface.transparency || 1.0) * 100);
    var currentGradient = currentSurface.gradient || "default";

    var fields = [
        {
            label: "Transparency",
            name: "transparency",
            type: "range",
            value: initialTransparency,
            min: "0",
            max: "100",
            step: "1"
        },
        {
            label: "Color Gradient",
            name: "gradient",
            type: "select",
            value: currentGradient,
            options: gradientOptions
        }
    ];

    // Step 6) Create form content using enhanced form helper
    var formContent = window.createEnhancedFormContent ? window.createEnhancedFormContent(fields, false, false) : document.createElement("div");

    // Step 6a) Fallback if createEnhancedFormContent doesn't exist
    if (!window.createEnhancedFormContent) {
        fields.forEach(function (field) {
            var fieldDiv = document.createElement("div");
            fieldDiv.className = "form-field";
            fieldDiv.style.marginBottom = "10px";

            var label = document.createElement("label");
            label.textContent = field.label + ":";
            label.style.display = "inline-block";
            label.style.width = "100px";
            fieldDiv.appendChild(label);

            if (field.type === "select") {
                var select = document.createElement("select");
                select.name = field.name;
                field.options.forEach(function (opt) {
                    var option = document.createElement("option");
                    option.value = opt.value;
                    option.textContent = opt.text;
                    if (opt.value === field.value) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                fieldDiv.appendChild(select);
            } else {
                var input = document.createElement("input");
                input.type = field.type;
                input.name = field.name;
                input.value = field.value;
                if (field.type === "range") {
                    input.min = field.min;
                    input.max = field.max;
                    input.step = field.step;
                }
                fieldDiv.appendChild(input);
            }
            formContent.appendChild(fieldDiv);
        });
    }

    // Step 6b) Customize transparency slider to show percentage
    var transparencyInput = formContent.querySelector('input[name="transparency"]');
    if (transparencyInput && transparencyInput.type === "range") {
        transparencyInput.style.height = "12px";
        transparencyInput.style.cursor = "pointer";
        transparencyInput.style.appearance = "none";
        transparencyInput.style.webkitAppearance = "none";
        transparencyInput.style.background = "linear-gradient(to right, #ff0000 0%, #ff0000 " + initialTransparency + "%, #ddd " + initialTransparency + "%, #ddd 100%)";
        transparencyInput.style.borderRadius = "3px";
        transparencyInput.style.outline = "none";
        transparencyInput.style.width = "90%";
        transparencyInput.style.marginLeft = "-2px";

        // Create value display - modify the grid to accommodate slider + value
        var sliderRow = transparencyInput.closest(".button-container-2col");
        if (sliderRow) {
            // Change grid to 3 columns: label, slider, value
            sliderRow.style.gridTemplateColumns = "40% 1fr 50px";

            var valueSpan = document.createElement("span");
            valueSpan.textContent = initialTransparency + "%";
            valueSpan.style.fontSize = "12px";
            valueSpan.style.color = "#aaa";
            valueSpan.style.textAlign = "right";
            sliderRow.appendChild(valueSpan);

            // Update on input
            transparencyInput.oninput = function () {
                var val = parseInt(transparencyInput.value);
                valueSpan.textContent = val + "%";
                transparencyInput.style.background = "linear-gradient(to right, #ff0000 0%, #ff0000 " + val + "%, #ddd " + val + "%, #ddd 100%)";
            };
        }
    }

    // Step 6c) Add legend checkbox section
    var legendSection = document.createElement("div");
    legendSection.style.gridColumn = "1 / -1";
    legendSection.style.display = "flex";
    legendSection.style.alignItems = "center";
    legendSection.style.gap = "8px";
    legendSection.style.marginTop = "10px";

    var legendCheckbox = document.createElement("input");
    legendCheckbox.type = "checkbox";
    legendCheckbox.name = "showLegend";
    legendCheckbox.checked = window.showSurfaceLegend;
    legendCheckbox.style.width = "16px";
    legendCheckbox.style.height = "16px";
    legendCheckbox.style.cursor = "pointer";

    var legendLabel = document.createElement("label");
    legendLabel.textContent = "Show Legend";
    legendLabel.style.fontSize = "12px";
    legendLabel.style.color = "#aaa";
    legendLabel.style.cursor = "pointer";
    legendLabel.onclick = function () {
        legendCheckbox.click();
    };

    legendSection.appendChild(legendCheckbox);
    legendSection.appendChild(legendLabel);
    formContent.appendChild(legendSection);

    // Step 7) Create dialog with footer buttons
    var dialog = new window.FloatingDialog({
        title: currentSurface.name || "Surface Properties",
        content: formContent,
        layoutType: "compact",
        width: 350,
        height: 250,
        showConfirm: true, // "Ok" button
        showCancel: true, // "Cancel" button
        showOption1: true, // "Delete" button
        showOption2: true, // "Hide" button
        confirmText: "Ok",
        cancelText: "Cancel",
        option1Text: "Delete",
        option2Text: currentSurface.visible ? "Hide" : "Show",
        onConfirm: function () {
            // Step 7a) Get form values and commit changes
            var formData = window.getFormData ? window.getFormData(formContent) : {};
            var newTransparency = formData.transparency !== undefined ? parseFloat(formData.transparency) / 100 : currentSurface.transparency;
            var newGradient = formData.gradient !== undefined ? formData.gradient : currentSurface.gradient;
            var showLegend = formData.showLegend !== undefined ? formData.showLegend : window.showSurfaceLegend;

            currentSurface.transparency = newTransparency;
            currentSurface.gradient = newGradient;
            window.showSurfaceLegend = showLegend;

            // Save to database
            window.saveSurfaceToDB(currentSurface.id).catch(function (err) {
                console.error("Failed to save surface:", err);
            });

            window.drawData(window.allBlastHoles, window.selectedHole);
        },
        onCancel: function () {
            // Step 7b) Just close, no changes
        },
        onOption1: function () {
            // Step 7c) Delete surface
            window
                .deleteSurfaceFromDB(currentSurface.id)
                .then(function () {
                    window.loadedSurfaces.delete(currentSurface.id);
                    window.drawData(window.allBlastHoles, window.selectedHole);
                    window.debouncedUpdateTreeView();
                    console.log("Surface removed from both memory and database");
                })
                .catch(function (error) {
                    console.error("Error removing surface:", error);
                    window.loadedSurfaces.delete(currentSurface.id);
                    window.drawData(window.allBlastHoles, window.selectedHole);
                });
        },
        onOption2: function () {
            // Step 7d) Toggle visibility
            window.setSurfaceVisibility(currentSurface.id, !currentSurface.visible);
            window.drawData(window.allBlastHoles, window.selectedHole);
        }
    });

    dialog.show();

    // Step 8) Position dialog near click location (adjusted for viewport bounds)
    if (dialog.element) {
        var dialogWidth = 350;
        var dialogHeight = 250;
        var posX = Math.min(x, window.innerWidth - dialogWidth - 20);
        var posY = Math.min(y, window.innerHeight - dialogHeight - 20);
        posX = Math.max(10, posX);
        posY = Math.max(10, posY);
        dialog.element.style.left = posX + "px";
        dialog.element.style.top = posY + "px";
    }
}

//===========================================
// SURFACES CONTEXT MENU END
//===========================================

// Make functions available globally
window.showSurfaceContextMenu = showSurfaceContextMenu;
