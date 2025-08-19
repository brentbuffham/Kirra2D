// src/dialog/FloatingDialog.js
//=============================================================
// FLOATING DIALOG SYSTEM
//=============================================================

// Step 1) Floating Dialog System - Alternative to Swal2 for non-blocking dialogs
// Update the FloatingDialog class to support 4 buttons and proper theme detection
class FloatingDialog {
    constructor(options) {
        this.options = {
            title: "Dialog",
            content: "",
            width: 400,
            height: 300,
            showConfirm: true,
            showCancel: true,
            showDeny: false,
            showOption1: false,
            showOption2: false,
            confirmText: "OK",
            cancelText: "Cancel",
            denyText: "Deny",
            option1Text: "Option 1",
            option2Text: "Option 2",
            layoutType: "default", // default, compact, wide
            draggable: true,
            resizable: true,
            closeOnOutsideClick: false,
            onConfirm: null,
            onCancel: null,
            onDeny: null,
            onOption1: null,
            onOption2: null,
            ...options,
        };

        this.element = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = {
            x: 0,
            y: 0,
        };
        this.initialSize = {
            width: 0,
            height: 0,
        };

        // Step 2) Validate layoutType
        const validLayouts = ["default", "compact", "wide"];
        if (!validLayouts.includes(this.options.layoutType)) {
            console.warn("Invalid layoutType '" + this.options.layoutType + "', using 'default'");
            this.options.layoutType = "default";
        }
    }

    show() {
        this.create();
        this.applyLayoutType();
        document.body.appendChild(this.element);
        this.center();
        this.setupEventListeners();

        // Step 3) Focus first input if any
        setTimeout(() => {
            const firstInput = this.element.querySelector("input:not([type='button']), select, textarea");
            if (firstInput && !firstInput.disabled) firstInput.focus();
        }, 100);
    }

    applyLayoutType() {
        // Step 4) Remove any existing layout classes
        this.element.classList.remove("floating-dialog-compact", "floating-dialog-wide");

        // Step 5) Apply the requested layout class
        if (this.options.layoutType === "compact") {
            this.element.classList.add("floating-dialog-compact");
        } else if (this.options.layoutType === "wide") {
            this.element.classList.add("floating-dialog-wide");
        }
        // "default" doesn't need a class - uses base styles
    }

    create() {
        // Step 6) Create main dialog container
        this.element = document.createElement("div");
        this.element.className = "floating-dialog";
        this.element.style.width = this.options.width + "px";
        this.element.style.height = this.options.height + "px";
        this.element.style.zIndex = "10000";

        // Step 7) Create header
        const header = this.createHeader();
        this.element.appendChild(header);

        // Step 8) Create content
        const content = this.createContent();
        this.element.appendChild(content);

        // Step 9) Create footer with buttons
        if (this.options.showConfirm || this.options.showCancel || this.options.showOption1 || this.options.showOption2) {
            const footer = this.createFooter();
            this.element.appendChild(footer);
        }
    }

    createHeader() {
        const header = document.createElement("div");
        header.className = "floating-dialog-header";

        // Step 10) Title
        const title = document.createElement("div");
        title.textContent = this.options.title;
        header.appendChild(title);

        // Step 11) Close button
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.style.background = "none";
        closeBtn.style.border = "none";
        closeBtn.style.fontSize = "18px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.padding = "0";
        closeBtn.style.width = "20px";
        closeBtn.style.height = "20px";
        closeBtn.style.display = "flex";
        closeBtn.style.alignItems = "center";
        closeBtn.style.justifyContent = "center";
        closeBtn.style.color = "inherit";

        closeBtn.onmouseover = () => {
            closeBtn.style.color = "#ff0000";
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.color = "inherit";
        };
        closeBtn.onclick = () => this.close();

        header.appendChild(closeBtn);

        return header;
    }

    createContent() {
        const content = document.createElement("div");
        content.className = "floating-dialog-content";

        // Step 12) Handle different content types
        if (typeof this.options.content === "string") {
            content.innerHTML = this.options.content;
        } else if (this.options.content instanceof HTMLElement) {
            content.appendChild(this.options.content);
        } else if (typeof this.options.content === "function") {
            const contentElement = this.options.content(this);
            if (contentElement) {
                content.appendChild(contentElement);
            }
        }

        return content;
    }

    createFooter() {
        const footer = document.createElement("div");
        footer.className = "floating-dialog-footer";

        // Step 13) Option2 button (fourth button)
        if (this.options.showOption2) {
            const option2Btn = this.createButton(this.options.option2Text, "option2", () => {
                if (this.options.onOption2) this.options.onOption2();
                this.close();
            });
            footer.appendChild(option2Btn);
        }

        // Step 14) Option1 button (third button)
        if (this.options.showOption1) {
            const option1Btn = this.createButton(this.options.option1Text, "option1", () => {
                if (this.options.onOption1) this.options.onOption1();
                this.close();
            });
            footer.appendChild(option1Btn);
        }

        // Step 15) Deny button (before cancel)
        if (this.options.showDeny) {
            const denyBtn = this.createButton(this.options.denyText, "deny", () => {
                if (this.options.onDeny) this.options.onDeny();
                this.close();
            });
            footer.appendChild(denyBtn);
        }

        // Step 16) Cancel button
        if (this.options.showCancel) {
            const cancelBtn = this.createButton(this.options.cancelText, "cancel", () => {
                if (this.options.onCancel) this.options.onCancel();
                this.close();
            });
            footer.appendChild(cancelBtn);
        }

        // Step 17) Confirm button
        if (this.options.showConfirm) {
            const confirmBtn = this.createButton(this.options.confirmText, "confirm", () => {
                if (this.options.onConfirm) this.options.onConfirm();
                this.close();
            });
            footer.appendChild(confirmBtn);
        }

        return footer;
    }

    createButton(text, className, onClick) {
        const button = document.createElement("button");
        button.textContent = text;
        button.className = "floating-dialog-btn " + className;
        button.addEventListener("click", onClick);
        return button;
    }

    setupEventListeners() {
        // Step 18) Dragging functionality
        if (this.options.draggable) {
            const header = this.element.querySelector(".floating-dialog-header");
            header.addEventListener("mousedown", this.startDrag.bind(this));
        }

        // Step 19) Close on outside click
        if (this.options.closeOnOutsideClick) {
            setTimeout(() => {
                document.addEventListener("click", this.handleOutsideClick.bind(this));
            }, 0);
        }

        // Step 20) Keyboard shortcuts
        this.handleKeydownBound = this.handleKeydown.bind(this);
        document.addEventListener("keydown", this.handleKeydownBound);
    }

    startDrag(e) {
        if (e.target.tagName === "BUTTON") return;

        this.isDragging = true;
        const rect = this.element.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        this.dragBound = this.drag.bind(this);
        this.stopDragBound = this.stopDrag.bind(this);

        document.addEventListener("mousemove", this.dragBound);
        document.addEventListener("mouseup", this.stopDragBound);

        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;

        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        // Step 21) Keep dialog within viewport bounds
        const maxX = window.innerWidth - this.element.offsetWidth;
        const maxY = window.innerHeight - this.element.offsetHeight;

        this.element.style.left = Math.max(0, Math.min(x, maxX)) + "px";
        this.element.style.top = Math.max(0, Math.min(y, maxY)) + "px";
    }

    stopDrag() {
        this.isDragging = false;
        document.removeEventListener("mousemove", this.dragBound);
        document.removeEventListener("mouseup", this.stopDragBound);
    }

    center() {
        const rect = this.element.getBoundingClientRect();
        const x = (window.innerWidth - rect.width) / 2;
        const y = (window.innerHeight - rect.height) / 2;
        this.element.style.left = Math.max(0, x) + "px";
        this.element.style.top = Math.max(0, y) + "px";
    }

    handleOutsideClick(e) {
        if (!this.element.contains(e.target)) {
            this.close();
        }
    }

    handleKeydown(e) {
        if (e.key === "Escape" && this.element) {
            this.close();
        }
    }

    close() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        // Step 22) Clean up event listeners
        if (this.handleOutsideClickBound) {
            document.removeEventListener("click", this.handleOutsideClickBound);
        }
        if (this.handleKeydownBound) {
            document.removeEventListener("keydown", this.handleKeydownBound);
        }

        this.element = null;
    }

    // Step 23) Static method to create and show a dialog (similar to Swal.fire)
    static fire(options) {
        const dialog = new FloatingDialog(options);
        dialog.show();
        return dialog;
    }
}

//! FORM CONTENT HELPERS GO HERE
// Step 24) Updated helper function with proper checkbox handling and layout
function createFormContent(fields, centerCheckboxes = false) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "6px";
    container.style.width = "100%";
    container.style.marginTop = "4px";

    fields.forEach((field) => {
        // Step 25) Create row container
        const row = document.createElement("div");

        if (field.type === "checkbox") {
            // Step 26) Special handling for checkboxes - use 2-column layout
            row.className = "checkbox-row";
            row.style.display = "grid";

            // Step 27) Conditionally apply centered layout for checkboxes
            if (centerCheckboxes) {
                // Use same layout as regular inputs for centered alignment
                row.style.gridTemplateColumns = "60% 40%";
                row.style.columnGap = "8px";
                row.style.alignItems = "center";
                row.style.width = "100%";
            } else {
                // Original checkbox layout (60% label, 40% checkbox)
                row.style.gridTemplateColumns = "60% 40%";
                row.style.columnGap = "8px";
                row.style.alignItems = "center";
                row.style.width = "100%";
            }
        } else {
            // Regular input fields
            row.className = "button-container-2col";
            row.style.display = "grid";
            row.style.gridTemplateColumns = "140px 1fr";
            row.style.columnGap = "8px";
            row.style.alignItems = "center";
            row.style.width = "100%";
        }

        // Step 28) Label
        const label = document.createElement("label");
        label.textContent = field.label;

        // Step 29) Apply different label classes based on type
        if (field.type === "checkbox") {
            label.className = "labelWhite12";
            label.style.fontSize = "11px";
            label.style.textAlign = "left"; // Left align for checkbox labels
            label.style.paddingRight = "0"; // No padding for checkbox labels
        } else if (field.label.length > 20) {
            label.className = "labelWhite12";
            label.style.fontSize = "11px";
            label.style.textAlign = "right";
            label.style.paddingRight = "4px";
        } else {
            label.className = "labelWhite15";
            label.style.fontSize = "12px";
            label.style.textAlign = "right";
            label.style.paddingRight = "4px";
        }

        label.style.fontFamily = "sans-serif";
        label.style.color = "var(--light-mode-text)";
        label.style.lineHeight = "1.2";
        label.style.margin = "0";
        label.style.whiteSpace = "nowrap";
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";

        // Step 30) Input
        const input = document.createElement("input");
        input.type = field.type || "text";
        input.id = field.id || field.name;
        input.name = field.name;
        input.placeholder = field.placeholder || "";
        input.value = field.value || "";

        if (field.type === "number") {
            input.step = field.step || "1";
            input.min = field.min || "";
            input.max = field.max || "";
            input.inputMode = "decimal";
            input.pattern = "[0-9]*";
        }

        if (field.type === "checkbox") {
            input.checked = field.checked || false;
            input.style.width = "14px";
            input.style.height = "14px";
            input.style.margin = "0";
            input.style.padding = "0";
            input.style.border = "1px solid #999";
            input.style.borderRadius = "2px";
            input.style.backgroundColor = "#fff";
            input.style.appearance = "none";
            input.style.webkitAppearance = "none";
            input.style.mozAppearance = "none";
            input.style.position = "relative";
            input.style.cursor = "pointer";
            input.style.justifySelf = "center"; // Center in right column

            // Step 31) Force the checkbox color update
            const updateCheckboxColor = () => {
                if (input.checked) {
                    input.style.backgroundColor = "var(--selected-color)";
                    input.style.borderColor = "var(--selected-color)";
                } else {
                    input.style.backgroundColor = "#fff";
                    input.style.borderColor = "#999";
                }
            };

            // Initial color
            updateCheckboxColor();

            // Update color on change
            input.addEventListener("change", updateCheckboxColor);
        } else {
            // Step 32) Regular input styling with proper expansion
            input.style.fontSize = "11px";
            input.style.height = "20px";
            input.style.padding = "2px 4px";
            input.style.width = "100%"; // Fill available space
            input.style.minWidth = "80px"; // Minimum width
            input.style.borderRadius = "3px";
            input.style.backgroundColor = "#fff";
            input.style.color = "#000";
            input.style.border = "1px solid #999";
            input.style.appearance = "none";
            input.style.boxSizing = "border-box";
        }

        // Step 33) Add to row
        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
    });

    return container;
}

// Step 34) Enhanced form content creator for complex forms with special field types
function createEnhancedFormContent(fields, isMultiple, centerCheckboxes = false) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "6px";
    container.style.width = "100%";
    container.style.marginTop = "4px";

    fields.forEach((field) => {
        const row = document.createElement("div");

        if (field.type === "checkbox") {
            // Step 35) Special handling for checkboxes - use 2-column layout
            row.className = "checkbox-row";
            row.style.display = "grid";
            row.style.gridTemplateColumns = "60% 40%"; // More space for long labels
            row.style.columnGap = "8px";
            row.style.alignItems = "center";
            row.style.width = "100%";
        } else {
            // Regular input fields
            row.className = "button-container-2col";
            row.style.display = "grid";
            row.style.gridTemplateColumns = "60% 40%";
            row.style.columnGap = "8px";
            row.style.rowGap = "4px";
            row.style.alignItems = "center";
            row.style.width = "100%";
        }

        // Step 36) Label
        const label = document.createElement("label");
        label.textContent = field.label;

        // Step 37) Apply different label classes based on type
        if (field.type === "checkbox") {
            label.className = "labelWhite12";
            label.style.fontSize = "11px";
            label.style.textAlign = "left"; // Left align for checkbox labels
            label.style.paddingRight = "0"; // No padding for checkbox labels
        } else {
            label.className = "labelWhite12";
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
        }

        // Step 38) Input element based on type
        let input;

        if (field.type === "checkbox") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = field.checked || false;
            input.style.width = "14px";
            input.style.height = "14px";
            input.style.margin = "0";
            input.style.padding = "0";
            input.style.border = "1px solid #999";
            input.style.borderRadius = "2px";
            input.style.backgroundColor = "#fff";
            input.style.appearance = "none";
            input.style.webkitAppearance = "none";
            input.style.mozAppearance = "none";
            input.style.position = "relative";
            input.style.cursor = "pointer";
            // Step 39) Conditionally center the checkbox
            if (centerCheckboxes) {
                input.style.justifySelf = "start"; // Align to start of right column (like other inputs)
            } else {
                input.style.justifySelf = "center"; // Center in right column (original behavior)
            }

            // Step 40) Force the checkbox color update
            const updateCheckboxColor = () => {
                if (input.checked) {
                    input.style.backgroundColor = "var(--selected-color)";
                    input.style.borderColor = "var(--selected-color)";
                } else {
                    input.style.backgroundColor = "#fff";
                    input.style.borderColor = "#999";
                }
            };

            // Initial color
            updateCheckboxColor();

            // Update color on change
            input.addEventListener("change", updateCheckboxColor);
        } else if (field.type === "select") {
            input = document.createElement("select");
            input.className = "floating-dialog-select";
            field.options.forEach((option) => {
                const optionElement = document.createElement("option");
                optionElement.value = option.value;
                optionElement.textContent = option.text;
                if (option.value === field.value) {
                    optionElement.selected = true;
                }
                input.appendChild(optionElement);
            });

            // Step 41) Special handling for hole type dropdown
            if (field.name === "holeType") {
                input.addEventListener("change", function () {
                    const customTypeRow = container.querySelector('[data-field="customType"]');
                    const customTypeInput = customTypeRow.querySelector("input");
                    const customTypeLabel = customTypeRow.querySelector("label");

                    if (this.value === "__CUSTOM__") {
                        customTypeInput.style.opacity = "1";
                        customTypeInput.disabled = false;
                        customTypeLabel.style.opacity = "1";
                        customTypeInput.focus();
                    } else {
                        customTypeInput.style.opacity = "0.3";
                        customTypeInput.disabled = true;
                        customTypeLabel.style.opacity = "0.3";
                        customTypeInput.value = "";
                    }
                });
            }
        } else if (field.type === "color") {
            input = document.createElement("input");
            input.type = "button";
            input.setAttribute("data-jscolor", "{value:'" + field.value + "'}");
            input.title = "Delay Color";
            input.className = "swal2-input";
        } else {
            input = document.createElement("input");
            input.type = field.type || "text";
        }

        input.id = field.name;
        input.name = field.name;
        input.placeholder = field.placeholder || "";

        if (field.type !== "select" && field.type !== "color" && field.type !== "checkbox") {
            input.value = field.value !== undefined && field.value !== null ? field.value : "";
        }
        // Step 42) Set number input attributes
        if (field.type === "number") {
            if (field.min !== undefined) input.min = field.min;
            if (field.max !== undefined) input.max = field.max;
            if (field.step !== undefined) input.step = field.step;
        }

        if (field.disabled) {
            input.disabled = true;
            input.style.opacity = "0.3";
            label.style.opacity = "0.3";
        }

        // Step 43) Standard input styling (for non-checkbox inputs)
        if (field.type !== "color" && field.type !== "checkbox") {
            input.style.fontSize = "11px";
            input.style.height = "20px";
            input.style.padding = "2px 4px";
            input.style.width = "100%";
            input.style.minWidth = "80px";
            input.style.borderRadius = "3px";
            input.style.backgroundColor = "#fff";
            input.style.color = "#000";
            input.style.border = "1px solid #999";
            input.style.appearance = "none";
            input.style.boxSizing = "border-box";
        }

        // Step 44) Mark the row with field name for easy reference
        row.setAttribute("data-field", field.name);

        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
    });

    // Step 45) Initialize JSColor after adding color inputs with proper z-index
    setTimeout(() => {
        if (typeof jscolor !== "undefined") {
            jscolor.install();

            // Force z-index on any JSColor elements
            const colorInputs = container.querySelectorAll("[data-jscolor]");
            colorInputs.forEach((input) => {
                if (input.jscolor) {
                    // Set z-index on the JSColor instance
                    input.jscolor.option("zIndex", 20000);
                }

                // Also set it when the color picker is shown
                input.addEventListener("click", () => {
                    setTimeout(() => {
                        const picker = document.querySelector(".jscolor-picker-wrap");
                        if (picker) {
                            picker.style.zIndex = "20000";
                            picker.style.position = "fixed";
                        }
                        const pickerInner = document.querySelector(".jscolor-picker");
                        if (pickerInner) {
                            pickerInner.style.zIndex = "20000";
                        }
                    }, 10);
                });
            });
        }
    }, 100);

    return container;
}

// Step 46) Helper function to extract form data
function getFormData(formContainer) {
    const data = {};
    const inputs = formContainer.querySelectorAll("input, select");

    inputs.forEach((input) => {
        if (input.name) {
            if (input.type === "button" && input.jscolor) {
                data[input.name] = input.jscolor.toHEXString();
            } else if (input.type === "checkbox") {
                // Handle checkboxes - use checked property instead of value
                data[input.name] = input.checked.toString();
            } else {
                data[input.name] = input.value;
            }
        }
    });

    return data;
}

//! CONFIRMATION DIALOG
// Step 47) Create utility function for confirmation dialogs - FIXED VERSION
function showConfirmationDialog(title, message, confirmText = "Confirm", cancelText = "Cancel", onConfirm = null, onCancel = null) {
    console.log("showConfirmationDialog: " + title);

    // Step 48) Create content with warning icon and message using inline styles for dark mode
    const darkModeEnabled = typeof window.darkModeEnabled !== "undefined" ? window.darkModeEnabled : false;
    const textColor = darkModeEnabled ? "#ffffff" : "#000000";
    const content = '<div style="color: #ff9800; font-size: 24px; margin-bottom: 15px; text-align: center;">⚠️</div>' + '<div style="color: ' + textColor + '; font-size: 16px; line-height: 1.4;">' + message + "</div>";

    // Step 49) Create FloatingDialog with confirm/cancel buttons
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
            // Step 50) Handle confirm button click
            console.log("Confirmation dialog confirmed: " + title);
            dialog.close();
            if (onConfirm && typeof onConfirm === "function") {
                onConfirm();
            }
        },
        onCancel: () => {
            // Step 51) Handle cancel button click
            console.log("Confirmation dialog cancelled: " + title);
            dialog.close();
            if (onCancel && typeof onCancel === "function") {
                onCancel();
            }
        },
    });

    // Step 52) Show the dialog
    dialog.show();
    return dialog;
}

// Step 53) Create utility function for confirmation dialogs with 3 buttons
function showConfirmationThreeDialog(title, message, confirmText = "Confirm", cancelText = "Cancel", optionText = "Option", onConfirm = null, onCancel = null, onOption = null) {
    console.log("showConfirmationThreeDialog: " + title);

    // Step 54) Create content with warning icon and message using inline styles for dark mode
    const darkModeEnabled = typeof window.darkModeEnabled !== "undefined" ? window.darkModeEnabled : false;
    const textColor = darkModeEnabled ? "#ffffff" : "#000000";
    const content = '<div style="color: #ff9800; font-size: 24px; margin-bottom: 15px; text-align: center;">⚠️</div>' + '<div style="color: ' + textColor + '; font-size: 16px; line-height: 1.4;">' + message + "</div>";

    // Step 55) Create FloatingDialog with confirm/cancel/option buttons
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
            // Step 56) Handle confirm button click
            console.log("Three-button confirmation dialog confirmed: " + title);
            dialog.close();
            if (onConfirm && typeof onConfirm === "function") {
                onConfirm();
            }
        },
        onCancel: () => {
            // Step 57) Handle cancel button click
            console.log("Three-button confirmation dialog cancelled: " + title);
            dialog.close();
            if (onCancel && typeof onCancel === "function") {
                onCancel();
            }
        },
        onOption1: () => {
            // Step 58) Handle option button click
            console.log("Three-button confirmation dialog option selected: " + title);
            dialog.close();
            if (onOption && typeof onOption === "function") {
                onOption();
            }
        },
    });

    // Step 59) Show the dialog
    dialog.show();
    return dialog;
}

//! WARNING - SUCCESS - ERROR - INFO - QUESTION - ACTION Dialog
// Step 60) Create utility function for modal warning/error/success popups - FIXED VERSION
function showModalMessage(title, message, type = "info", callback = null) {
    console.log("showModalMessage: " + title + " - " + message + " (" + type + ")");

    // Step 61) Determine icon and styling based on type
    let iconHtml = "";
    const darkModeEnabled = typeof window.darkModeEnabled !== "undefined" ? window.darkModeEnabled : false;
    const textColor = darkModeEnabled ? "#ffffff" : "#000000";

    if (type === "warning") {
        iconHtml = '<div style="color: #ff9800; font-size: 24px; margin-bottom: 10px; text-align: center;">⚠️</div>';
    } else if (type === "error") {
        iconHtml = '<div style="color: #f44336; font-size: 24px; margin-bottom: 10px; text-align: center;">❌</div>';
    } else if (type === "success") {
        iconHtml = '<div style="color: #4caf50; font-size: 24px; margin-bottom: 10px; text-align: center;">✅</div>';
    } else {
        iconHtml = '<div style="color: #2196f3; font-size: 24px; margin-bottom: 10px; text-align: center;">ℹ️</div>';
    }

    // Step 62) Create content with icon and message using inline styles
    const content = iconHtml + '<div style="color: ' + textColor + '; font-size: 16px; line-height: 1.4; text-align: center;">' + message + "</div>";

    // Step 63) Create modal FloatingDialog
    const dialog = new FloatingDialog({
        title: title,
        content: content,
        width: 400,
        height: 200,
        showConfirm: true,
        showCancel: false,
        showDeny: false,
        showOption1: false,
        showOption2: false,
        confirmText: "OK",
        draggable: true,
        resizable: false,
        closeOnOutsideClick: false, // Modal behavior - must click OK
        layoutType: "compact",
        onConfirm: () => {
            // Step 64) Handle OK button click
            console.log("Modal message acknowledged: " + title);
            dialog.close();
            if (callback && typeof callback === "function") {
                callback();
            }
        },
    });

    // Step 65) Show the dialog
    dialog.show();
    return dialog;
}

//===========================================
// FLOATING DIALOG END
//===========================================
// If you want to make these available globally in the browser:
window.FloatingDialog = FloatingDialog;
window.createFormContent = createFormContent;
window.createEnhancedFormContent = createEnhancedFormContent;
window.getFormData = getFormData;
window.showConfirmationDialog = showConfirmationDialog;
window.showConfirmationThreeDialog = showConfirmationThreeDialog;
window.showModalMessage = showModalMessage;
