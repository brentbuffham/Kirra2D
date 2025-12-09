// src/dialog/popups/generic/AddHoleDialog.js
//=============================================================
// ADD HOLE DIALOG MODULE
//=============================================================
// Step 1) Converted from Swal2 to FloatingDialog with Single/Multiple confirm buttons
// Step 2) Modeled after PatternGenerationDialogs.js structure

// Step 3) Main add hole dialog function
function showAddHoleDialog() {
    // Step 3a) Generate default blast name with timestamp
    const blastNameValue = "Added_hole_" + new Date().getTime();

    // Step 3b) Retrieve last entered values from localStorage
    const savedAddHolePopupSettings = JSON.parse(localStorage.getItem("savedAddHolePopupSettings")) || {};

    // Step 3b-1) Helper to convert string "true"/"false" to boolean
    const toBool = (value, defaultValue = false) => {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === "boolean") return value;
        if (typeof value === "string") return value === "true";
        return defaultValue;
    };

    const lastValues = {
        blastName: savedAddHolePopupSettings.blastName || blastNameValue,
        useCustomHoleID: toBool(savedAddHolePopupSettings.useCustomHoleID, false),
        useGradeZ: toBool(savedAddHolePopupSettings.useGradeZ, false),
        customHoleID: savedAddHolePopupSettings.customHoleID || "",
        elevation: savedAddHolePopupSettings.elevation || 0,
        gradeZ: savedAddHolePopupSettings.gradeZ || 0,
        diameter: savedAddHolePopupSettings.diameter || 115,
        type: savedAddHolePopupSettings.type || "Production",
        length: savedAddHolePopupSettings.length || 0,
        subdrill: savedAddHolePopupSettings.subdrill || 0,
        angle: savedAddHolePopupSettings.angle || 0,
        bearing: savedAddHolePopupSettings.bearing || 0,
        burden: savedAddHolePopupSettings.burden || 3.0,
        spacing: savedAddHolePopupSettings.spacing || 3.5
    };

    // Step 3c) Calculate default length/gradeZ based on useGradeZ
    const elevation = lastValues.elevation;
    if (lastValues.useGradeZ) {
        const angleRad = lastValues.angle * (Math.PI / 180);
        const calculatedLength = Math.abs((elevation - lastValues.gradeZ + lastValues.subdrill) / Math.cos(angleRad));
        lastValues.length = isNaN(calculatedLength) ? lastValues.length : calculatedLength;
    } else {
        const angleRad = lastValues.angle * (Math.PI / 180);
        const calculatedGradeZ = elevation - (lastValues.length - lastValues.subdrill) * Math.cos(angleRad);
        lastValues.gradeZ = isNaN(calculatedGradeZ) ? lastValues.gradeZ : calculatedGradeZ;
    }

    // Step 3d) Ensure values are valid numbers for toFixed
    const gradeZValue = (typeof lastValues.gradeZ === "number" && !isNaN(lastValues.gradeZ)) ? lastValues.gradeZ.toFixed(2) : lastValues.gradeZ;
    const lengthValue = (typeof lastValues.length === "number" && !isNaN(lastValues.length)) ? lastValues.length.toFixed(2) : lastValues.length;

    // Step 4) Retrieve additional saved values (delay, color, connector curve)
    const delay = savedAddHolePopupSettings.delay || 0;
    const delayColor = savedAddHolePopupSettings.delayColor || "#FF0000";
    const connectorCurve = savedAddHolePopupSettings.connectorCurve || 0;

    // Step 4a) Get world coordinates from global variables (set by canvas click)
    // Ensure values are numbers - canvasToWorldWithSnap returns numbers
    const clickWorldX = (window.worldX !== undefined && window.worldX !== null && typeof window.worldX === "number")
        ? window.worldX
        : 0;
    const clickWorldY = (window.worldY !== undefined && window.worldY !== null && typeof window.worldY === "number")
        ? window.worldY
        : 0;
    const clickWorldZ = (window.worldZ !== undefined && window.worldZ !== null && typeof window.worldZ === "number")
        ? window.worldZ
        : (typeof lastValues.elevation === "number" ? lastValues.elevation : parseFloat(lastValues.elevation) || 0);

    console.log("🔹 showAddHoleDialog - worldX:", clickWorldX, "worldY:", clickWorldY, "worldZ:", clickWorldZ);
    console.log("🔹 showAddHoleDialog - types:", typeof clickWorldX, typeof clickWorldY, typeof clickWorldZ);

    // Step 5) Build form fields array (matching Edit Hole structure)
    const fields = [
        { label: "Blast Name", name: "blastName", type: "text", value: lastValues.blastName, placeholder: "Blast Name" },
        { label: "Use Custom Hole ID", name: "useCustomHoleID", type: "checkbox", checked: lastValues.useCustomHoleID },
        { label: "Hole ID", name: "customHoleID", type: "text", value: lastValues.customHoleID, placeholder: "Custom Hole ID" },
        { label: "Location X", name: "locationX", type: "number", value: (typeof clickWorldX === "number" ? clickWorldX.toFixed(3) : "0.000"), step: 0.001 },
        { label: "Location Y", name: "locationY", type: "number", value: (typeof clickWorldY === "number" ? clickWorldY.toFixed(3) : "0.000"), step: 0.001 },
        { label: "Collar Z RL (m)", name: "elevation", type: "text", value: (typeof clickWorldZ === "number" && clickWorldZ !== 0) ? clickWorldZ.toFixed(2) : (typeof lastValues.elevation === "number" ? lastValues.elevation.toFixed(2) : lastValues.elevation) },
        { label: "Delay", name: "delay", type: "text", value: delay },
        { label: "Delay Color", name: "delayColor", type: "color", value: delayColor },
        { label: "Connector Curve (°)", name: "connectorCurve", type: "number", value: connectorCurve },
        { label: "Hole Type", name: "type", type: "text", value: lastValues.type, placeholder: "Type" },
        { label: "Diameter (mm)", name: "diameter", type: "text", value: lastValues.diameter },
        { label: "Bearing (°)", name: "bearing", type: "text", value: lastValues.bearing },
        { label: "Dip/Angle (°)", name: "angle", type: "text", value: lastValues.angle },
        { label: "Subdrill (m)", name: "subdrill", type: "text", value: lastValues.subdrill },
        { label: "Use Grade Z", name: "useGradeZ", type: "checkbox", checked: lastValues.useGradeZ },
        { label: "Grade Z RL (m)", name: "gradeZ", type: "text", value: gradeZValue, disabled: !lastValues.useGradeZ },
        { label: "Length (m)", name: "length", type: "text", value: lengthValue, disabled: lastValues.useGradeZ },
        { label: "Burden (m)", name: "burden", type: "text", value: lastValues.burden },
        { label: "Spacing (m)", name: "spacing", type: "text", value: lastValues.spacing }
    ];

    // Step 6) Create form content using createEnhancedFormContent
    const formContent = window.createEnhancedFormContent(fields, false);

    // Step 6a) Add comprehensive note at the bottom (matching Edit Hole style)
    const noteDiv = document.createElement("div");
    noteDiv.style.gridColumn = "1 / -1";
    noteDiv.style.marginTop = "10px";
    noteDiv.style.fontSize = "10px";
    noteDiv.style.color = "#888";
    noteDiv.style.lineHeight = "1.4";
    noteDiv.innerHTML = "<strong>Workflow:</strong><br>" +
        "1) Click switch/button → cursor changes to crosshair (2D) or sphere (3D)<br>" +
        "2) Click canvas to set XY location<br>" +
        "3) Dialog appears with parameters<br>" +
        "4) Single: Add one hole and close | Multiple: Add and continue<br>" +
        "5) ESC or Right-Click to end<br><br>" +
        "<strong>Tips:</strong><br>" +
        "• Curved connectors: 45° to 120°, -45° to -120° | Straight: 0°<br>" +
        "• Use Custom Hole ID to override auto-numbering<br>" +
        "• Use Grade Z calculates length from collar to grade elevation<br>" +
        "• Same blast name checks for duplicates/overlaps";
    formContent.appendChild(noteDiv);

    // Step 7) Create FloatingDialog with Single/Multiple/Cancel buttons (matching Edit Hole dimensions)
    const dialog = new window.FloatingDialog({
        title: "Add a hole to the Pattern?",
        content: formContent,
        layoutType: "compact",
        width: 350,
        height: 700,
        showConfirm: true,
        showCancel: true,
        showOption1: true,
        confirmText: "Single",
        cancelText: "Cancel",
        option1Text: "Multiple",
        draggable: true,
        resizable: true,
        onConfirm: () => {
            // Step 8) Handle Single confirm
            const formData = window.getFormData(formContent);
            processAddHole(formData, false, dialog); // false = single mode
        },
        onOption1: () => {
            // Step 9) Handle Multiple confirm
            const formData = window.getFormData(formContent);
            processAddHole(formData, true, dialog); // true = multiple mode
        },
        onCancel: () => {
            // Step 10) Handle cancel - reset tool state
            if (window.addHoleSwitch) {
                window.addHoleSwitch.checked = false;
                window.addHoleSwitch.dispatchEvent(new Event("change"));
            }
            window.worldX = null;
            window.worldY = null;
            window.worldZ = null;
            window.isAddingSingleHole = false;
            window.multipleAddHoleFormData = null; // Clear stored form data
            window.drawData(window.allBlastHoles, window.selectedHole); // Redraw to clear visuals
        }
    });

    // Step 11) Show dialog
    dialog.show();

    // Step 12) Setup event listeners for dynamic field updates
    setupAddHoleEventListeners(formContent);

    // Step 13) Store dialog reference for multiple mode
    window.currentAddHoleDialog = dialog;
}

// Step 14) Event listener setup function
function setupAddHoleEventListeners(formContent) {
    const useGradeZCheckbox = formContent.querySelector("#useGradeZ");
    const gradeZInput = formContent.querySelector("#gradeZ");
    const lengthInput = formContent.querySelector("#length");
    const elevationInput = formContent.querySelector("#elevation");
    const angleInput = formContent.querySelector("#angle");
    const subdrillInput = formContent.querySelector("#subdrill");

    if (!useGradeZCheckbox || !gradeZInput || !lengthInput || !elevationInput || !angleInput || !subdrillInput) {
        console.error("Missing required form elements for Add Hole dialog");
        return;
    }

    function updateFieldsBasedOnUseGradeZ() {
        const useGradeZ = useGradeZCheckbox.checked;
        gradeZInput.disabled = !useGradeZ;
        lengthInput.disabled = useGradeZ;

        // Update opacity to match disabled state
        if (useGradeZ) {
            gradeZInput.style.opacity = "1";
            lengthInput.style.opacity = "0.5";
        } else {
            gradeZInput.style.opacity = "0.5";
            lengthInput.style.opacity = "1";
        }

        if (useGradeZ) {
            // Calculate length from grade
            const elevation = parseFloat(elevationInput.value) || 0;
            const gradeZ = parseFloat(gradeZInput.value) || 0;
            const subdrill = parseFloat(subdrillInput.value) || 0;
            const angle = parseFloat(angleInput.value) || 0;
            const angleRad = angle * (Math.PI / 180);

            const calculatedLength = Math.abs((elevation - gradeZ + subdrill) / Math.cos(angleRad));
            lengthInput.value = calculatedLength.toFixed(2);
        } else {
            // Calculate grade from length
            const elevation = parseFloat(elevationInput.value) || 0;
            const length = parseFloat(lengthInput.value) || 0;
            const subdrill = parseFloat(subdrillInput.value) || 0;
            const angle = parseFloat(angleInput.value) || 0;
            const angleRad = angle * (Math.PI / 180);

            const calculatedGradeZ = elevation - (length - subdrill) * Math.cos(angleRad);
            gradeZInput.value = calculatedGradeZ.toFixed(2);
        }
    }

    // Add listeners
    useGradeZCheckbox.addEventListener("change", updateFieldsBasedOnUseGradeZ);
    gradeZInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
    lengthInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
    elevationInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
    angleInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);
    subdrillInput.addEventListener("input", updateFieldsBasedOnUseGradeZ);

    // Initial update
    updateFieldsBasedOnUseGradeZ();
}

// Step 15) Helper function to get next hole ID for an entity
function getNextHoleIDForEntity(entityName, useCustomHoleID, customHoleID) {
    // Step 15a) Find all holes in this entity
    const entityHoles = window.allBlastHoles ? window.allBlastHoles.filter((hole) => hole.entityName === entityName) : [];

    if (entityHoles.length === 0) {
        // Step 15b) No holes yet - use custom ID if provided, otherwise start at 1
        if (useCustomHoleID && customHoleID && customHoleID.trim() !== "") {
            return customHoleID.trim();
        }
        return "1";
    }

    // Step 15c) If using custom hole ID, check if it's numeric and increment from max
    if (useCustomHoleID && customHoleID && customHoleID.trim() !== "") {
        const customIDStr = customHoleID.trim();
        // If custom ID is numeric, increment from max in entity
        if (/^\d+$/.test(customIDStr)) {
            let maxNumericID = parseInt(customIDStr) - 1; // Start from custom ID - 1
            entityHoles.forEach((hole) => {
                const holeIDStr = hole.holeID ? hole.holeID.toString() : "";
                if (/^\d+$/.test(holeIDStr)) {
                    const numericID = parseInt(holeIDStr);
                    if (!isNaN(numericID)) {
                        maxNumericID = Math.max(maxNumericID, numericID);
                    }
                }
            });
            return (maxNumericID + 1).toString();
        } else {
            // Non-numeric custom ID - use as-is (will be validated by addHole for duplicates)
            return customIDStr;
        }
    }

    // Step 15d) Auto-numbering: Find the highest numeric hole ID and increment
    let maxNumericID = 0;
    entityHoles.forEach((hole) => {
        const holeIDStr = hole.holeID ? hole.holeID.toString() : "";
        // Check if it's a pure number
        if (/^\d+$/.test(holeIDStr)) {
            const numericID = parseInt(holeIDStr);
            if (!isNaN(numericID)) {
                maxNumericID = Math.max(maxNumericID, numericID);
            }
        }
    });

    // Step 15e) Return next ID (increment from max)
    return (maxNumericID + 1).toString();
}

// Step 16) Process add hole function with validation
function processAddHole(formData, isMultipleMode, dialog) {
    // Step 15a) Basic validation
    if (!formData.blastName || formData.blastName.trim() === "") {
        window.showModalMessage("Invalid Blast Name", "Please enter a Blast Name.", "warning");
        return;
    }

    if (!formData.type || formData.type.trim() === "") {
        window.showModalMessage("Invalid Type", "Please enter a hole type.", "warning");
        return;
    }

    // Step 15b) Save to localStorage (including new fields)
    localStorage.setItem("savedAddHolePopupSettings", JSON.stringify(formData));

    // Step 15c) Get world coordinates - check for undefined/null, not falsy (0 is valid!)
    if (window.worldX === undefined || window.worldX === null || window.worldY === undefined || window.worldY === null) {
        console.error("❌ No location set - worldX:", window.worldX, "worldY:", window.worldY);
        window.showModalMessage("No Location", "Please click on the canvas to set hole location.", "warning");
        return;
    }

    const worldX = window.worldX;
    const worldY = window.worldY;

    console.log("🔹 Adding hole at:", worldX, worldY, "Multiple mode:", isMultipleMode);

    // Step 15d) Check for nearby holes before adding
    const proximityHoles = window.checkHoleProximity(
        parseFloat(worldX),
        parseFloat(worldY),
        parseFloat(formData.diameter),
        window.allBlastHoles || []
    );

    if (proximityHoles.length > 0) {
        const newHoleInfo = {
            entityName: formData.blastName,
            holeID: formData.useCustomHoleID ? formData.customHoleID : (window.allBlastHoles ? window.allBlastHoles.length + 1 : 1).toString(),
            x: parseFloat(worldX),
            y: parseFloat(worldY),
            diameter: parseFloat(formData.diameter)
        };

        // Step 15e) Show proximity warning with resolution - use existing Swal dialog
        window.showProximityWarning(proximityHoles, newHoleInfo).then((proximityResult) => {
            if (proximityResult.isConfirmed) {
                // User chose to continue - add the hole
                addHoleToBlast(formData, worldX, worldY, isMultipleMode, dialog);
            } else if (proximityResult.isDenied) {
                // User chose to skip - don't add this hole
                console.log("Skipped hole due to proximity");
                if (isMultipleMode) {
                    // Reset for next placement in multiple mode
                    window.worldX = null;
                    window.worldY = null;
                }
            }
            // If proximityResult.isDismissed (cancel), do nothing
        });
    } else {
        // Step 15f) No proximity issues - add the hole directly
        addHoleToBlast(formData, worldX, worldY, isMultipleMode, dialog);
    }
}

// Step 16) Add hole to blast function
function addHoleToBlast(formData, worldX, worldY, isMultipleMode, dialog) {
    console.log("🔹 addHoleToBlast called with data:", {
        blastName: formData.blastName,
        worldX: worldX,
        worldY: worldY,
        isMultiple: isMultipleMode
    });

    // Step 16a) Use locationX/locationY from form if provided, otherwise use worldX/worldY
    const finalX = formData.locationX !== undefined ? parseFloat(formData.locationX) : parseFloat(worldX);
    const finalY = formData.locationY !== undefined ? parseFloat(formData.locationY) : parseFloat(worldY);

    console.log("🔹 Final coordinates - X:", finalX, "Y:", finalY);

    // Step 16b) Get next hole ID for this entity (properly increments from last ID)
    const holeID = getNextHoleIDForEntity(
        formData.blastName,
        formData.useCustomHoleID,
        formData.customHoleID
    );

    console.log("🔹 Calling window.addHole with holeID:", holeID);

    // Step 16c) Use the shared function to add hole
    if (typeof window.addHole === "function") {
        addHoleToBlastDirect(formData, finalX, finalY, holeID);
    } else {
        console.error("❌ addHole function not found");
        window.showModalMessage("Error", "Could not add hole - function not available.", "error");
        return;
    }

    // Step 16d) Handle dialog and tool state based on mode (display update happens in addHoleToBlastDirect)
    if (isMultipleMode) {
        // Multiple mode: Store form data for reuse, close dialog, keep tool active
        console.log("🔹 Multiple mode: Storing form data for reuse, closing dialog");

        // Store form data globally for multiple mode reuse
        window.multipleAddHoleFormData = formData;
        window.isAddingSingleHole = true; // Flag to indicate multiple mode is active

        // Close the current dialog
        if (dialog) {
            dialog.close();
        }
        window.currentAddHoleDialog = null;

        // Reset world coordinates for next click
        window.worldX = null;
        window.worldY = null;

        // Redraw to show the added hole and keep crosshair visible
        window.drawData(window.allBlastHoles, window.selectedHole);
    } else {
        // Single mode: close dialog and reset tool completely
        console.log("🔹 Single mode: Closing dialog and resetting tool");
        if (dialog) {
            dialog.close();
        }
        if (window.currentAddHoleDialog) {
            window.currentAddHoleDialog = null;
        }
        // Turn off the tool completely
        if (window.addHoleSwitch) {
            window.addHoleSwitch.checked = false;
            window.addHoleSwitch.dispatchEvent(new Event("change"));
        }
        window.worldX = null;
        window.worldY = null;
        window.worldZ = null;
        window.isAddingHole = false;
        window.isAddingSingleHole = false;
        window.multipleAddHoleFormData = null; // Clear stored form data
        // Remove event listeners
        if (window.canvas) {
            window.canvas.removeEventListener("click", window.handleHoleAddingClick);
            window.canvas.removeEventListener("touchstart", window.handleHoleAddingClick);
        }
        window.drawData(window.allBlastHoles, window.selectedHole);
    }
}

// Step 18) Add hole directly without dialog (for multiple mode)
function addHoleMultipleMode(worldX, worldY) {
    // Step 18a) Check if we have stored form data from first dialog
    if (!window.multipleAddHoleFormData) {
        console.error("❌ No stored form data for multiple mode");
        return;
    }

    const formData = window.multipleAddHoleFormData;

    // Step 18b) Use provided coordinates
    const finalX = parseFloat(worldX);
    const finalY = parseFloat(worldY);

    console.log("🔹 Multiple mode: Adding hole at", finalX, finalY, "with stored parameters");

    // Step 18c) Get next hole ID (will increment properly)
    const holeID = getNextHoleIDForEntity(
        formData.blastName,
        formData.useCustomHoleID,
        formData.customHoleID
    );

    console.log("🔹 Multiple mode: Using holeID:", holeID);

    // Step 18d) Add hole directly
    addHoleToBlastDirect(formData, finalX, finalY, holeID);
}

// Step 19) Add hole to blast directly (without dialog parameter)
function addHoleToBlastDirect(formData, finalX, finalY, holeID) {
    // Step 19a) Call the global addHole function from kirra.js
    if (typeof window.addHole === "function") {
        // CRITICAL: Convert string "true"/"false" to boolean
        // getFormData returns checkbox values as strings, but addHole expects strict boolean
        const useCustomIDBoolean = formData.useCustomHoleID === "true" || formData.useCustomHoleID === true;
        const useGradeZBoolean = formData.useGradeZ === "true" || formData.useGradeZ === true;

        window.addHole(
            useCustomIDBoolean,
            useGradeZBoolean,
            formData.blastName,
            holeID,
            finalX,
            finalY,
            parseFloat(formData.elevation),
            parseFloat(formData.gradeZ),
            parseFloat(formData.diameter),
            formData.type,
            parseFloat(formData.length),
            parseFloat(formData.subdrill),
            parseFloat(formData.angle),
            parseFloat(formData.bearing),
            null, // rowID
            null, // posID
            parseFloat(formData.burden),
            parseFloat(formData.spacing)
        );

        console.log("✅ Hole added successfully with ID:", holeID);
    } else {
        console.error("❌ addHole function not found");
        window.showModalMessage("Error", "Could not add hole - function not available.", "error");
        return;
    }

    // Step 19b) Save to IndexedDB
    if (typeof window.debouncedSaveHoles === "function") {
        window.debouncedSaveHoles();
    }

    // Step 19c) Update tree view
    if (typeof window.updateTreeFromBlastHoles === "function") {
        window.updateTreeFromBlastHoles();
    }

    // Step 19d) Update display
    window.drawData(window.allBlastHoles, window.selectedHole);
    window.updateStatusMessage("Hole added to " + formData.blastName);
}

// Step 20) Expose functions globally
window.showAddHoleDialog = showAddHoleDialog;
window.setupAddHoleEventListeners = setupAddHoleEventListeners;
window.processAddHole = processAddHole;
window.addHoleToBlast = addHoleToBlast;
window.addHoleMultipleMode = addHoleMultipleMode;
window.addHoleToBlastDirect = addHoleToBlastDirect;
window.getNextHoleIDForEntity = getNextHoleIDForEntity;

