// Step 1) Error Dialog Module
// Step 2) This module contains all error dialog functions
// Step 3) Dependencies: FloatingDialog, showModalMessage (from FloatingDialog.js)
// Step 4) Requires: darkModeEnabled from kirra.js
// Step 0) Converted to ES Module for Vite bundling - 2025-12-26

// Step 5) Generic error dialog with red text
export function showErrorDialog(title, content) {
    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = content;
    contentDiv.style.color = "#ff6b6b";

    const dialog = new FloatingDialog({
        title: title,
        content: contentDiv,
        layoutType: "default",
        width: 350,
        height: 200,
        showConfirm: true,
        showCancel: false,
        confirmText: "OK",
        onConfirm: () => {
            // Dialog will close automatically
        }
    });

    dialog.show();
}

// Step 6) File format error popup
export function fileFormatPopup(error) {
    console.log("File format error");
    showModalMessage("Error " + error, "This could be related to the data structure or file.<br><br>" + "Or there are NO blasts or Holes yet, if so ignore.<br><br>" + "Only files with 4, 7, 9, 14, 30, 32 and 35 columns are Accepted<br><br>" + "Column Order and Types are important.", "error");
}

// Step 7) Calculation error popup with helpful suggestions
export function showCalculationErrorPopup(originalText, errorMessage) {
    return new Promise((resolve) => {
        // Step 7a) Generate helpful error message
        let helpfulMessage = "Unknown calculation error";
        let suggestions = "";

        if (errorMessage.includes("Unexpected token")) {
            helpfulMessage = "Invalid mathematical expression";
            suggestions = "• Check for typos in operators (+, -, *, /)<br>• Make sure parentheses are balanced<br>• Use only numbers and basic math operators";
        } else if (errorMessage.includes("not defined")) {
            helpfulMessage = "Unknown variable or function";
            suggestions = "• Only use numbers and basic math operators (+, -, *, /, ())<br>• Variables and custom functions are not supported";
        } else if (errorMessage.includes("not a valid number")) {
            helpfulMessage = "Calculation result is invalid";
            suggestions = "• Check for division by zero<br>• Ensure the result is a finite number";
        } else {
            suggestions = "• Use format: =5+3 or =10*2<br>• Only basic math operators are supported<br>• Check for syntax errors";
        }

        // Step 7b) Create content with error details using inline styles for dark mode
        const textColor = darkModeEnabled ? "#ffffff" : "#000000";
        const content = '<div style="text-align: center;">' +
            '<label style="color: ' + textColor + '; font-size: 16px; font-weight: bold;"><strong>Formula:</strong> ' + originalText + '</label><br><br>' +
            '<label style="color: ' + textColor + '; font-size: 14px; font-weight: bold;"><strong>Error:</strong> ' + helpfulMessage + '</label><br><br>' +
            '<label style="color: ' + textColor + '; font-size: 12px; font-weight: bold;"><strong>Suggestions:</strong></label><br>' +
            '<div style="text-align: center; margin: 10px 20px;">' +
            '<label style="color: ' + textColor + '; font-size: 10px;">' + suggestions + '</label>' +
            '</div><br>' +
            '<label style="color: ' + textColor + '; font-size: 12px; font-weight: bold;"><strong>Examples:</strong></label><br>' +
            '<label style="color: ' + textColor + '; font-size: 10px;">=5+3 → 8</label><br>' +
            '<label style="color: ' + textColor + '; font-size: 10px;">=10*2.5 → 25</label><br>' +
            '<label style="color: ' + textColor + '; font-size: 10px;">=(100+50)/2 → 75</label>' +
            '</div>';

        // Step 7c) Create FloatingDialog with three buttons
        const dialog = new FloatingDialog({
            title: "Calculation Error",
            content: content,
            width: 400,
            height: 300,
            showConfirm: true,
            showCancel: true,
            showDeny: false,
            showOption1: true, // Enable the third button
            showOption2: false,
            confirmText: "Fix It",
            cancelText: "Cancel",
            option1Text: "As Text", // Third button
            draggable: true,
            resizable: false,
            closeOnOutsideClick: false, // Modal behavior
            layoutType: "default",
            onConfirm: () => {
                // Step 7d) User wants to fix it - keep the text field focused for editing
                console.log("Calculation error dialog - Fix It selected");
                dialog.close();
                resolve(null); // Signal to not save and let user edit
            },
            onCancel: () => {
                // Step 7e) User cancelled - don't save anything
                console.log("Calculation error dialog - Cancel selected");
                dialog.close();
                resolve(null);
            },
            onOption1: () => {
                // Step 7f) User wants to use as regular text (remove the = sign)
                console.log("Calculation error dialog - As Text selected");
                dialog.close();
                resolve(originalText.substring(1)); // Remove = and store as plain text
            }
        });

        // Step 7g) Show the dialog
        dialog.show();
    });
}

// Step 8) Expose functions globally
window.showErrorDialog = showErrorDialog;
window.fileFormatPopup = fileFormatPopup;
window.showCalculationErrorPopup = showCalculationErrorPopup;

