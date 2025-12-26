// Step 1) Confirmation Dialog Module
// Step 2) This module contains all confirmation dialog functions
// Step 3) Dependencies: FloatingDialog, Swal (for legacy dialogs)
// Step 4) Requires: darkModeEnabled, createSurfaceFromPoints, decimatePointCloud, saveSurfaceToDB from kirra.js
// Step 0) Converted to ES Module for Vite bundling - 2025-12-26

// Step 5) Standard confirmation dialog with 2 buttons (Confirm/Cancel)
export function showConfirmationDialog(title, message, confirmText = "Confirm", cancelText = "Cancel", onConfirm = null, onCancel = null) {
    console.log("showConfirmationDialog: " + title);

    // Step 5a) Create content with warning icon and message using inline styles for dark mode
    const textColor = darkModeEnabled ? "#ffffff" : "#000000";
    const content = '<div style="color: #ff9800; font-size: 24px; margin-bottom: 15px; text-align: center;">⚠️</div>' + '<div style="color: ' + textColor + '; font-size: 16px; line-height: 1.4;">' + message + "</div>";

    // Step 5b) Create FloatingDialog with confirm/cancel buttons
    const dialog = new FloatingDialog({
        title: title,
        content: content,
        width: 500,
        height: 350,
        showConfirm: true,
        showCancel: true,
        showDeny: false,
        showOption1: false,
        showOption2: false,
        confirmText: confirmText,
        cancelText: cancelText,
        draggable: true,
        resizable: false,
        closeOnOutsideClick: false, // Modal behavior
        layoutType: "default",
        onConfirm: () => {
            // Step 5c) Handle confirm button click
            console.log("Confirmation dialog confirmed: " + title);
            dialog.close();
            if (onConfirm && typeof onConfirm === "function") {
                onConfirm();
            }
        },
        onCancel: () => {
            // Step 5d) Handle cancel button click
            console.log("Confirmation dialog cancelled: " + title);
            dialog.close();
            if (onCancel && typeof onCancel === "function") {
                onCancel();
            }
        }
    });

    // Step 5e) Show the dialog
    dialog.show();
    return dialog;
}

// Step 6) Confirmation dialog with 3 buttons (Confirm/Option/Cancel)
export function showConfirmationThreeDialog(title, message, confirmText = "Confirm", cancelText = "Cancel", optionText = "Option", onConfirm = null, onCancel = null, onOption = null) {
    console.log("showConfirmationThreeDialog: " + title);

    // Step 6a) Create content with warning icon and message using inline styles for dark mode
    const textColor = darkModeEnabled ? "#ffffff" : "#000000";
    const content = '<div style="color: #ff9800; font-size: 24px; margin-bottom: 15px; text-align: center;">⚠️</div>' + '<div style="color: ' + textColor + '; font-size: 16px; line-height: 1.4;">' + message + "</div>";

    // Step 6b) Create FloatingDialog with confirm/cancel/option buttons
    const dialog = new FloatingDialog({
        title: title,
        content: content,
        width: 500,
        height: 350,
        showConfirm: true,
        showCancel: true,
        showDeny: false,
        showOption1: true, // Enable the third button
        showOption2: false,
        confirmText: confirmText,
        cancelText: cancelText,
        option1Text: optionText, // Use option1Text for the third button
        draggable: true,
        resizable: false,
        closeOnOutsideClick: false, // Modal behavior
        layoutType: "default",
        onConfirm: () => {
            // Step 6c) Handle confirm button click
            console.log("Three-button confirmation dialog confirmed: " + title);
            dialog.close();
            if (onConfirm && typeof onConfirm === "function") {
                onConfirm();
            }
        },
        onCancel: () => {
            // Step 6d) Handle cancel button click
            console.log("Three-button confirmation dialog cancelled: " + title);
            dialog.close();
            if (onCancel && typeof onCancel === "function") {
                onCancel();
            }
        },
        onOption1: () => {
            // Step 6e) Handle option button click
            console.log("Three-button confirmation dialog option selected: " + title);
            dialog.close();
            if (onOption && typeof onOption === "function") {
                onOption();
            }
        }
    });

    // Step 6f) Show the dialog
    dialog.show();
    return dialog;
}

// Step 7) Duplicate resolution dialog with 4 options
export function showDuplicateResolutionDialog(duplicateReport, actionType) {
    const duplicateCount = duplicateReport.duplicates.length;
    const entitiesAffected = [...new Set(duplicateReport.duplicates.map((d) => d.entityName))];

    // Step 7a) Build content using CSS classes that handle dark/light mode automatically
    const contentDiv = document.createElement("div");
    contentDiv.className = "button-container-2col";
    contentDiv.style.padding = "10px";
    contentDiv.style.minHeight = "200px";

    // Step 7b) Warning header - uses labelWhite18 class
    const warningHeader = document.createElement("label");
    warningHeader.className = "labelWhite15"; // Using existing CSS class
    warningHeader.style.gridColumn = "1 / -1";
    warningHeader.style.textAlign = "center";
    warningHeader.style.marginBottom = "10px";
    warningHeader.style.fontSize = "14px";
    warningHeader.style.fontWeight = "bold";
    warningHeader.textContent = "⚠️ Duplicate Hole IDs Detected";
    contentDiv.appendChild(warningHeader);

    // Step 7c) Conflict count - uses labelWhite15 class
    const conflictLabel = document.createElement("label");
    conflictLabel.className = "labelWhite15";
    conflictLabel.style.gridColumn = "1 / -1";
    conflictLabel.style.marginBottom = "5px";
    conflictLabel.textContent = "Found: " + duplicateCount + " conflicts";
    contentDiv.appendChild(conflictLabel);

    // Step 7d) Affected blasts - uses labelWhite15 class
    const blastsLabel = document.createElement("label");
    blastsLabel.className = "labelWhite15";
    blastsLabel.style.gridColumn = "1 / -1";
    blastsLabel.style.marginBottom = "10px";
    blastsLabel.textContent = "Blasts: " + entitiesAffected.join(", ");
    contentDiv.appendChild(blastsLabel);

    // Step 7e) Examples header - uses labelWhite12 class
    const examplesHeader = document.createElement("label");
    examplesHeader.className = "labelWhite12";
    examplesHeader.style.gridColumn = "1 / -1";
    examplesHeader.style.marginTop = "10px";
    examplesHeader.style.marginBottom = "5px";
    examplesHeader.textContent = "Examples:";
    contentDiv.appendChild(examplesHeader);

    // Step 7f) Example entries - uses labelWhite12 class
    duplicateReport.duplicates.slice(0, 3).forEach((dup) => {
        const exampleLabel = document.createElement("label");
        exampleLabel.className = "labelWhite12";
        exampleLabel.style.gridColumn = "1 / -1";
        exampleLabel.style.marginBottom = "2px";
        exampleLabel.textContent = "• " + dup.entityName + " - ID: " + dup.holeID;
        contentDiv.appendChild(exampleLabel);
    });

    // Step 7g) More indicator - uses labelWhite12 class
    if (duplicateReport.duplicates.length > 3) {
        const moreLabel = document.createElement("label");
        moreLabel.className = "labelWhite12";
        moreLabel.style.gridColumn = "1 / -1";
        moreLabel.textContent = "... and " + (duplicateReport.duplicates.length - 3) + " more";
        contentDiv.appendChild(moreLabel);
    }

    // Step 7h) Return promise exactly like original Swal2 version
    return new Promise((resolve) => {
        const dialog = new FloatingDialog({
            title: "Duplicate Resolution",
            content: contentDiv,
            width: 450,
            height: 350,
            layoutType: "default",
            draggable: true,
            resizable: false,
            closeOnOutsideClick: false,
            showConfirm: true,
            showCancel: true,
            showOption1: true,
            showOption2: true,
            confirmText: "Renumber",
            option1Text: "Keep First",
            option2Text: "Keep Last",
            cancelText: "Cancel",
            onConfirm: () => {
                resolve({
                    strategy: "auto-renumber"
                });
            },
            onOption1: () => {
                resolve({
                    strategy: "keep-first"
                });
            },
            onOption2: () => {
                resolve({
                    strategy: "keep-last"
                });
            },
            onCancel: () => {
                resolve({
                    strategy: "cancel"
                });
            }
        });

        dialog.show();
    });
}

// Step 8) Proximity warning dialog with 3 options (Continue/Skip/Cancel)
export function showProximityWarning(proximityHoles, newHoleInfo) {
    const holeList = proximityHoles.map((ph) => "• " + ph.hole.entityName + ":" + ph.hole.holeID + " (" + ph.distance.toFixed(3) + "m apart, need " + ph.requiredDistance.toFixed(3) + "m)").join("\n");

    return Swal.fire({
        title: "Hole Proximity Warning",
        html: '<div style="text-align: left; max-height: 300px; overflow-y: auto;">' +
              '<p><strong>New hole would be too close to existing holes:</strong></p>' +
              '<p>New hole: ' + newHoleInfo.entityName + ':' + newHoleInfo.holeID + ' at (' + newHoleInfo.x.toFixed(3) + ', ' + newHoleInfo.y.toFixed(3) + ')</p>' +
              '<br>' +
              '<p><strong>Conflicting holes:</strong></p>' +
              '<pre style="font-size: 12px; color: #ff6b6b;">' + holeList + '</pre>' +
              '<br>' +
              '<p><strong>Options:</strong></p>' +
              '<ul style="text-align: left;">' +
              '<li><strong>Continue:</strong> Add this hole and continue adding others</li>' +
              '<li><strong>Skip:</strong> Skip this hole and continue with pattern</li>' +
              '<li><strong>Cancel:</strong> Cancel the entire operation</li>' +
              '</ul>' +
              '</div>',
        icon: "warning",
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: "Continue",
        denyButtonText: "Skip",
        cancelButtonText: "Cancel",
        customClass: {
            container: "custom-popup-container",
            title: "swal2-title",
            confirmButton: "confirm",
            denyButton: "deny",
            cancelButton: "cancel",
            content: "swal2-content",
            htmlContainer: "swal2-html-container"
        }
    });
}

// Step 9) Decimation warning dialog for large point clouds
export function showDecimationWarning(points, fileName) {
    const pointCount = points.length;

    Swal.fire({
        title: "Large Point Cloud Detected",
        showCancelButton: true,
        confirmButtonText: "Load All",
        cancelButtonText: "Decimate",
        icon: "warning",
        html: '<div style="text-align: center;">' +
              '<label class="labelWhite16"><strong>' + fileName + '</strong></label><br>' +
              '<label class="labelWhite14">Contains ' + pointCount.toLocaleString() + ' points</label><br><br>' +
              '<label class="labelWhite12">⚠️ Large point clouds may cause performance issues</label><br>' +
              '<label class="labelWhite12">Recommended: Decimate to ~5,000 points for better performance</label>' +
              '</div>',
        customClass: {
            container: "custom-popup-container",
            title: "swal2-title",
            confirmButton: "confirm",
            cancelButton: "cancel",
            content: "swal2-content",
            htmlContainer: "swal2-html-container",
            icon: "swal2-icon"
        }
    }).then(async (result) => {
        // Step 9a) Make this async
        if (result.isConfirmed) {
            createSurfaceFromPoints(points, fileName, false);

            // Step 9b) ADD SURFACE SAVE HERE
            try {
                await saveSurfaceToDB(fileName || "surface_full_" + Date.now());
                // console.log("✅ Full surface saved from decimation dialog:", fileName);
            } catch (saveError) {
                console.error("❌ Failed to save full surface:", saveError);
            }
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            const decimatedPoints = decimatePointCloud(points, 5000);
            createSurfaceFromPoints(decimatedPoints, fileName, false);

            // Step 9c) ADD DECIMATED SURFACE SAVE HERE
            try {
                await saveSurfaceToDB(fileName ? fileName + "_decimated" : "surface_decimated_" + Date.now());
                // console.log("✅ Decimated surface saved from decimation dialog:", fileName);
            } catch (saveError) {
                console.error("❌ Failed to save decimated surface:", saveError);
            }
        }
    });
}

// Step 10) Expose functions globally
window.showConfirmationDialog = showConfirmationDialog;
window.showConfirmationThreeDialog = showConfirmationThreeDialog;
window.showDuplicateResolutionDialog = showDuplicateResolutionDialog;
window.showProximityWarning = showProximityWarning;
window.showDecimationWarning = showDecimationWarning;

