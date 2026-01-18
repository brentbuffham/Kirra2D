// src/dialog/contextMenu/ImagesContextMenu.js
//=============================================================
// IMAGES CONTEXT MENU
//=============================================================
// Step 0) Converted to ES Module for Vite bundling - 2025-12-26

// Step 1) Show image context menu
export function showImageContextMenu(x, y, imageId = null) {
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
    // Step 2) Get the specific image if ID provided, otherwise first visible image
    var image = imageId
        ? window.loadedImages.get(imageId)
        : Array.from(window.loadedImages.values()).find(function (img) {
              return img.visible;
          });
    if (!image) return;

    // Step 3) Store reference for dialog callbacks
    var currentImage = image;
    var currentImageId = imageId;

    // Step 4) Create fields array for form content
    var initialTransparency = Math.round((currentImage.transparency !== undefined ? currentImage.transparency : 1.0) * 100);
    var initialZ = currentImage.zElevation !== undefined ? currentImage.zElevation : window.drawingZLevel || 0;

    var fields = [
        {
            label: "Transparency",
            name: "transparency",
            type: "slider",
            value: initialTransparency,
            min: 0,
            max: 100,
            step: 1,
            minLabel: "0%",
            maxLabel: "100%"
        },
        {
            label: "Z Elevation",
            name: "zElevation",
            type: "number",
            value: initialZ,
            step: "0.1"
        }
    ];

    // Step 5) Create form content using enhanced form helper
    var formContent = window.createEnhancedFormContent ? window.createEnhancedFormContent(fields, false, false) : document.createElement("div");

    // Step 5a) Fallback if createEnhancedFormContent doesn't exist
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

            var input = document.createElement("input");
            input.type = field.type;
            input.name = field.name;
            input.value = field.value;

            if (field.type === "number") {
                input.step = field.step || "1";
                if (field.min) input.min = field.min;
                if (field.max) input.max = field.max;
            }

            fieldDiv.appendChild(input);
            formContent.appendChild(fieldDiv);
        });
    }

    // Step 6) Create dialog with footer buttons
    var dialog = new window.FloatingDialog({
        title: currentImage.name || "Image Properties",
        content: formContent,
        layoutType: "compact",
        width: 350,
        height: 200,
        showConfirm: true, // "Ok" button
        showCancel: true, // "Cancel" button
        showOption1: true, // "Delete" button
        showOption2: true, // "Hide" button
        confirmText: "Ok",
        cancelText: "Cancel",
        option1Text: "Delete",
        option2Text: currentImage.visible ? "Hide" : "Show",
        onConfirm: function () {
            // Step 6a) Get form values and commit changes
            var formData = window.getFormData ? window.getFormData(formContent) : {};
            var newTransparency = formData.transparency !== undefined ? parseFloat(formData.transparency) / 100 : currentImage.transparency;
            var newZ = formData.zElevation !== undefined ? parseFloat(formData.zElevation) : currentImage.zElevation;

            if (currentImageId && window.loadedImages.has(currentImageId)) {
                var targetImage = window.loadedImages.get(currentImageId);
                if (targetImage) {
                    targetImage.transparency = newTransparency;
                    targetImage.zElevation = newZ;
                }
            } else {
                currentImage.transparency = newTransparency;
                currentImage.zElevation = newZ;
            }
            if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
        },
        onCancel: function () {
            // Step 6b) Just close, no changes
        },
        onOption1: function () {
            // Step 6c) Delete image
            if (currentImageId && window.loadedImages.has(currentImageId)) {
                window
                    .deleteImageFromDB(currentImageId)
                    .then(function () {
                        window.loadedImages.delete(currentImageId);
                        if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
                        window.debouncedUpdateTreeView();
                    })
                    .catch(function (error) {
                        console.error("Error removing image:", error);
                        window.loadedImages.delete(currentImageId);
                        if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
                    });
            }
        },
        onOption2: function () {
            // Step 6d) Toggle visibility
            if (currentImageId && window.loadedImages.has(currentImageId)) {
                var targetImage = window.loadedImages.get(currentImageId);
                if (targetImage) {
                    targetImage.visible = !targetImage.visible;
                }
            } else {
                currentImage.visible = !currentImage.visible;
            }
            if (typeof window.redraw3D === "function") { window.redraw3D(); } else { window.drawData(window.allBlastHoles, window.selectedHole); }
        }
    });

    dialog.show();

    // Step 7) Position dialog near click location (adjusted for viewport bounds)
    if (dialog.element) {
        var dialogWidth = 350;
        var dialogHeight = 200;
        var posX = Math.min(x, window.innerWidth - dialogWidth - 20);
        var posY = Math.min(y, window.innerHeight - dialogHeight - 20);
        posX = Math.max(10, posX);
        posY = Math.max(10, posY);
        dialog.element.style.left = posX + "px";
        dialog.element.style.top = posY + "px";
    }
}

//===========================================
// IMAGES CONTEXT MENU END
//===========================================

// Make functions available globally
window.showImageContextMenu = showImageContextMenu;
