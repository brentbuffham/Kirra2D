// src/dialog/popups/generic/PatternGenerationDialogs.js
//=============================================================
// PATTERN GENERATION DIALOGS MODULE
//=============================================================

// Step 1) Unified pattern dialog function
function showPatternDialog(mode, worldX, worldY) {
    // Step 1a) Determine mode and defaults
    const isAddPattern = (mode === "add_pattern");
    const title = isAddPattern ? "Add a Pattern?" : "Generate Pattern in Polygon";
    const localStorageKey = isAddPattern ? "savedAddPatternPopupSettings" : "savedPatternInPolygonSettings";
    
    // Step 1b) Load last values from localStorage
    const savedSettings = JSON.parse(localStorage.getItem(localStorageKey)) || {};
    const lastValues = {
        blastName: savedSettings.blastName || (isAddPattern ? "Created_Blast" + Date.now() : "PolygonPattern_" + Date.now()),
        nameTypeIsNumerical: savedSettings.nameTypeIsNumerical !== undefined ? savedSettings.nameTypeIsNumerical : !isAddPattern,
        startNumber: savedSettings.startNumber || 1,
        rowOrientation: savedSettings.rowOrientation || 90.0,
        x: savedSettings.x || (worldX !== undefined ? worldX : 0),
        y: savedSettings.y || (worldY !== undefined ? worldY : 0),
        z: savedSettings.z || 100,
        collarZ: savedSettings.collarZ || 0,
        useGradeZ: savedSettings.useGradeZ !== undefined ? savedSettings.useGradeZ : !isAddPattern,
        gradeZ: savedSettings.gradeZ || (isAddPattern ? 94 : -10),
        diameter: savedSettings.diameter || 115,
        type: savedSettings.type || "Production",
        angle: savedSettings.angle || 0,
        bearing: savedSettings.bearing || 180,
        length: savedSettings.length || (isAddPattern ? 6.2 : 10),
        subdrill: savedSettings.subdrill || (isAddPattern ? 0 : 1),
        spacingOffset: savedSettings.spacingOffset || 0.5,
        burden: savedSettings.burden || 3.0,
        spacing: savedSettings.spacing || 3.3,
        rows: savedSettings.rows || 6,
        holesPerRow: savedSettings.holesPerRow || 10
    };
    
    // Step 1c) Calculate defaults for length/gradeZ based on useGradeZ
    const elevation = isAddPattern ? lastValues.z : lastValues.collarZ;
    if (lastValues.useGradeZ) {
        const angleRad = lastValues.angle * (Math.PI / 180);
        const calculatedLength = Math.abs((elevation - lastValues.gradeZ + lastValues.subdrill) / Math.cos(angleRad));
        lastValues.length = isNaN(calculatedLength) ? lastValues.length : calculatedLength;
    } else {
        const angleRad = lastValues.angle * (Math.PI / 180);
        const calculatedGradeZ = elevation - (lastValues.length - lastValues.subdrill) * Math.cos(angleRad);
        lastValues.gradeZ = isNaN(calculatedGradeZ) ? lastValues.gradeZ : calculatedGradeZ;
    }
    
    // Step 1d) Ensure values are valid numbers for toFixed
    const gradeZValue = (typeof lastValues.gradeZ === 'number' && !isNaN(lastValues.gradeZ)) ? lastValues.gradeZ.toFixed(2) : lastValues.gradeZ;
    const lengthValue = (typeof lastValues.length === 'number' && !isNaN(lastValues.length)) ? lastValues.length.toFixed(2) : lastValues.length;
    
    // Step 2) Define form fields conditionally
    const fields = [
        { label: "Blast Name", name: "blastName", type: "text", value: lastValues.blastName, placeholder: "Blast Name" },
        { label: "Numerical Names", name: "nameTypeIsNumerical", type: "checkbox", checked: lastValues.nameTypeIsNumerical }
    ];
    
    // Step 2a) Add pattern-specific fields ONLY if mode is "add_pattern"
    if (isAddPattern) {
        fields.push(
            { label: "Orientation", name: "rowOrientation", type: "number", value: lastValues.rowOrientation, placeholder: "Orientation", step: 0.1, min: 0, max: 359.999 },
            { label: "Start X", name: "x", type: "number", value: worldX !== undefined ? worldX : lastValues.x, placeholder: "X" },
            { label: "Start Y", name: "y", type: "number", value: worldY !== undefined ? worldY : lastValues.y, placeholder: "Y" },
            { label: "Start Z", name: "z", type: "number", value: lastValues.z, placeholder: "Z" }
        );
    }
    
    // Step 2b) Add startNumber and elevation field (different for each mode)
    if (!isAddPattern) {
        fields.push({ label: "Starting Hole Number", name: "startNumber", type: "number", value: lastValues.startNumber, step: 1, min: 1, max: 9999 });
        fields.push({ label: "Burden (m)", name: "burden", type: "number", value: lastValues.burden, step: 0.1, min: 0.1, max: 50 });
        fields.push({ label: "Spacing (m)", name: "spacing", type: "number", value: lastValues.spacing, step: 0.1, min: 0.1, max: 50 });
        fields.push({ label: "Offset", name: "spacingOffset", type: "number", value: lastValues.spacingOffset, step: 0.1, min: -1.0, max: 1.0 });
        fields.push({ label: "Collar Elevation (m)", name: "collarZ", type: "number", value: lastValues.collarZ, step: 0.1, min: -1000, max: 5000 });
    }
    
    // Step 2c) Add common fields
    fields.push(
        { label: "Use Grade Z", name: "useGradeZ", type: "checkbox", checked: lastValues.useGradeZ },
        { label: "Grade Elevation (m)", name: "gradeZ", type: "number", value: gradeZValue, step: 0.1, disabled: !lastValues.useGradeZ },
        { label: "Length (m)", name: "length", type: "number", value: lengthValue, step: 0.1, disabled: lastValues.useGradeZ }
    );
    
    // Step 2d) Add remaining common fields (different order for add pattern)
    if (isAddPattern) {
        fields.push({ label: "Diameter (mm)", name: "diameter", type: "number", value: lastValues.diameter, step: 1, min: 0, max: 1000 });
        fields.push({ label: "Type", name: "type", type: "text", value: lastValues.type, placeholder: "Type" });
        fields.push({ label: "Angle (°)", name: "angle", type: "number", value: lastValues.angle, step: 1, min: 0, max: 60 });
        fields.push({ label: "Bearing (°)", name: "bearing", type: "number", value: lastValues.bearing, step: 0.1, min: 0, max: 359.999 });
        fields.push({ label: "Subdrill (m)", name: "subdrill", type: "number", value: lastValues.subdrill, step: 0.1, min: 0.0, max: 100 });
        fields.push({ label: "Offset", name: "spacingOffset", type: "number", value: lastValues.spacingOffset, step: 0.1, min: -1.0, max: 1.0 });
        fields.push({ label: "Burden (m)", name: "burden", type: "number", value: lastValues.burden, step: 0.1, min: 0.1, max: 50 });
        fields.push({ label: "Spacing (m)", name: "spacing", type: "number", value: lastValues.spacing, step: 0.1, min: 0.1, max: 50 });
        fields.push({ label: "Rows", name: "rows", type: "number", value: lastValues.rows, step: 1, min: 1, max: 500 });
        fields.push({ label: "Holes Per Row", name: "holesPerRow", type: "number", value: lastValues.holesPerRow, step: 1, min: 1, max: 500 });
    } else {
        fields.push({ label: "Subdrill (m)", name: "subdrill", type: "number", value: lastValues.subdrill, step: 0.1, min: -50, max: 50 });
        fields.push({ label: "Hole Angle (° from vertical)", name: "angle", type: "number", value: lastValues.angle, step: 1, min: 0, max: 60 });
        fields.push({ label: "Hole Bearing (°)", name: "bearing", type: "number", value: lastValues.bearing, step: 0.1, min: 0, max: 359.999 });
        fields.push({ label: "Diameter (mm)", name: "diameter", type: "number", value: lastValues.diameter, step: 1, min: 1, max: 1000 });
        fields.push({ label: "Hole Type", name: "type", type: "text", value: lastValues.type, placeholder: "Type" });
    }
    
    // Step 3) Create form content using createEnhancedFormContent
    const formContent = window.createEnhancedFormContent(fields, false, false);
    
    // Step 3a) Add offset information note
    const offsetNote = document.createElement("div");
    offsetNote.style.gridColumn = "1 / -1";
    offsetNote.style.fontSize = "10px";
    offsetNote.style.color = "#888";
    offsetNote.style.marginTop = "5px";
    offsetNote.textContent = "Offset Information: Staggered = -0.5 or 0.5, Square = -1, 0, 1";
    formContent.appendChild(offsetNote);
    
    // Step 3b) Add helpful tips section
    const tipsContainer = document.createElement("div");
    tipsContainer.style.gridColumn = "1 / -1";
    tipsContainer.style.marginTop = "20px";
    tipsContainer.style.padding = "10px";
    tipsContainer.style.backgroundColor = "rgba(100, 100, 100, 0.2)";
    tipsContainer.style.borderRadius = "4px";
    tipsContainer.style.border = "1px solid rgba(255, 255, 255, 0.1)";
    
    const tipsTitle = document.createElement("div");
    tipsTitle.style.fontSize = "11px";
    tipsTitle.style.fontWeight = "bold";
    tipsTitle.style.color = "#aaa";
    tipsTitle.style.marginBottom = "8px";
    tipsTitle.textContent = "💡 Tips:";
    tipsContainer.appendChild(tipsTitle);
    
    const tip1 = document.createElement("div");
    tip1.style.fontSize = "10px";
    tip1.style.color = "#999";
    tip1.style.marginBottom = "5px";
    tip1.style.lineHeight = "1.4";
    tip1.textContent = "• Naming a blast the same as another will check the addition of holes for duplicate and overlapping holes.";
    tipsContainer.appendChild(tip1);
    
    const tip2 = document.createElement("div");
    tip2.style.fontSize = "10px";
    tip2.style.color = "#999";
    tip2.style.lineHeight = "1.4";
    tip2.textContent = "• Last used values are kept in the browser memory.";
    tipsContainer.appendChild(tip2);
    
    formContent.appendChild(tipsContainer);
    
    // Step 4) Create FloatingDialog with mode-specific height
    const dialogHeight = isAddPattern ? 750 : 650; // Add Pattern has more fields
    
    const dialog = new window.FloatingDialog({
        title: title,
        content: formContent,
        layoutType: "default",
        width: 500,
        height: dialogHeight,
        showConfirm: true,
        showCancel: true,
        confirmText: "Confirm",
        cancelText: "Cancel",
        draggable: true,
        resizable: true,
        onConfirm: () => {
            const formData = window.getFormData(formContent);
            processPatternGeneration(formData, mode, worldX, worldY);
        },
        onCancel: () => {
            // Step 4a) Truly cancel - reset any tool states
            console.log("Pattern dialog cancelled - resetting tool states");
            
            // Reset pattern in polygon tool if active
            if (!isAddPattern && window.patternInPolygonTool) {
                window.patternInPolygonTool.checked = false;
                window.patternInPolygonTool.dispatchEvent(new Event("change"));
            }
            
            // Clear any selection states
            if (window.selectedPolygon) {
                window.selectedPolygon = null;
            }
            if (window.patternStartPoint) {
                window.patternStartPoint = null;
            }
            if (window.patternEndPoint) {
                window.patternEndPoint = null;
            }
            if (window.patternReferencePoint) {
                window.patternReferencePoint = null;
            }
            
            // Redraw to clear any visual indicators
            if (typeof window.drawData === "function" && window.allBlastHoles && window.selectedHole !== undefined) {
                window.drawData(window.allBlastHoles, window.selectedHole);
            }
            
            dialog.close();
        }
    });
    
    dialog.show();
    
    // Step 5) Add event listeners for dynamic field updates (after show)
    setupPatternDialogEventListeners(formContent, isAddPattern);
}

// Step 6) Create event listener setup function
function setupPatternDialogEventListeners(formContent, isAddPattern) {
    const useGradeZCheckbox = formContent.querySelector('#useGradeZ');
    const gradeZInput = formContent.querySelector('#gradeZ');
    const lengthInput = formContent.querySelector('#length');
    const angleInput = formContent.querySelector('#angle');
    const subdrillInput = formContent.querySelector('#subdrill');
    
    // For polygon mode, use collarZ; for pattern mode, use z
    const elevationInput = isAddPattern 
        ? formContent.querySelector('#z') 
        : formContent.querySelector('#collarZ');
    
    function updateFieldsBasedOnUseGradeZ() {
        const useGradeZ = useGradeZCheckbox.checked;
        gradeZInput.disabled = !useGradeZ;
        lengthInput.disabled = useGradeZ;
        
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

// Step 7) Create processing function with validation
function processPatternGeneration(formData, mode, worldX, worldY) {
    const isAddPattern = (mode === "add_pattern");
    
    // Step 7a) Validation checks
    if (!formData.blastName || formData.blastName.trim() === "") {
        window.showModalMessage("Invalid Blast Name", "Please enter a Blast Name.", "warning");
        return;
    }
    
    if (isNaN(formData.spacingOffset) || formData.spacingOffset < -1 || formData.spacingOffset > 1) {
        window.showModalMessage("Invalid Offset", "Please enter an offset between -1 and 1.", "warning");
        return;
    }
    
    if (isNaN(formData.burden) || formData.burden < 0.1 || formData.burden > 50) {
        window.showModalMessage("Invalid Burden", "Please enter burden between 0.1 and 50 meters.", "warning");
        return;
    }
    
    if (isNaN(formData.spacing) || formData.spacing < 0.1 || formData.spacing > 50) {
        window.showModalMessage("Invalid Spacing", "Please enter spacing between 0.1 and 50 meters.", "warning");
        return;
    }
    
    if (isNaN(formData.diameter) || formData.diameter < 0 || formData.diameter > 1000) {
        window.showModalMessage("Invalid Diameter", "Please enter diameter between 0 and 1000mm.", "warning");
        return;
    }
    
    if (!formData.type || formData.type.trim() === "") {
        window.showModalMessage("Invalid Type", "Please enter a hole type.", "warning");
        return;
    }
    
    if (isNaN(formData.angle) || formData.angle < 0 || formData.angle > 60) {
        window.showModalMessage("Invalid Angle", "Please enter angle between 0 and 60 degrees.", "warning");
        return;
    }
    
    if (isNaN(formData.bearing) || formData.bearing < 0 || formData.bearing > 360) {
        window.showModalMessage("Invalid Bearing", "Please enter bearing between 0 and 360 degrees.", "warning");
        return;
    }
    
    if (isNaN(formData.subdrill) || formData.subdrill < (isAddPattern ? 0 : -50) || formData.subdrill > (isAddPattern ? 100 : 50)) {
        const min = isAddPattern ? 0 : -50;
        const max = isAddPattern ? 100 : 50;
        window.showModalMessage("Invalid Subdrill", "Please enter subdrill between " + min + " and " + max + " meters.", "warning");
        return;
    }
    
    if (isNaN(formData.length) || formData.length < 0.1 || formData.length > 1000) {
        window.showModalMessage("Invalid Length", "Please enter length between 0.1 and 1000 meters.", "warning");
        return;
    }
    
    // Additional validation for add pattern mode
    if (isAddPattern) {
        if (isNaN(formData.rows) || formData.rows < 1 || formData.rows > 500) {
            window.showModalMessage("Invalid Rows", "Please enter rows between 1 and 500.", "warning");
            return;
        }
        
        if (isNaN(formData.holesPerRow) || formData.holesPerRow < 1 || formData.holesPerRow > 500) {
            window.showModalMessage("Invalid Holes Per Row", "Please enter holes per row between 1 and 500.", "warning");
            return;
        }
        
        if (isNaN(formData.rowOrientation) || formData.rowOrientation < 0 || formData.rowOrientation > 360) {
            window.showModalMessage("Invalid Orientation", "Please enter orientation between 0 and 360 degrees.", "warning");
            return;
        }
    }
    
    // Step 7b) Save to localStorage
    const localStorageKey = isAddPattern ? "savedAddPatternPopupSettings" : "savedPatternInPolygonSettings";
    localStorage.setItem(localStorageKey, JSON.stringify(formData));
    
    // Step 7c) Call appropriate generation function
    if (isAddPattern) {
        // Call addPattern with all parameters
        console.log("patternnameTypeIsNumerical set to:", formData.nameTypeIsNumerical);
        window.addPattern(
            formData.spacingOffset,
            formData.blastName,
            formData.nameTypeIsNumerical,
            formData.useGradeZ,
            formData.rowOrientation,
            formData.x,
            formData.y,
            formData.z,
            formData.gradeZ,
            formData.diameter,
            formData.type,
            formData.angle,
            formData.bearing,
            formData.length,
            formData.subdrill,
            formData.burden,
            formData.spacing,
            formData.rows,
            formData.holesPerRow
        );
        
        // Update TreeView after adding the pattern
        if (typeof window.debouncedUpdateTreeView === "function") {
            window.debouncedUpdateTreeView();
        } else if (typeof window.updateTreeView === "function") {
            window.updateTreeView();
        }
    } else {
        // Initialize allBlastHoles array if it's null
        if (window.allBlastHoles === null) {
            window.allBlastHoles = [];
        }
        
        // Call generatePatternInPolygon with parameters object
        window.generatePatternInPolygon({
            blastName: formData.blastName,
            nameTypeIsNumerical: formData.nameTypeIsNumerical,
            useGradeZ: formData.useGradeZ,
            startNumber: formData.startNumber,
            burden: formData.burden,
            spacing: formData.spacing,
            spacingOffset: formData.spacingOffset,
            collarZ: formData.collarZ,
            gradeZ: formData.gradeZ,
            length: formData.length,
            subdrill: formData.subdrill,
            angle: formData.angle,
            bearing: formData.bearing,
            diameter: formData.diameter,
            type: formData.type,
            patternType: formData.spacingOffset === 0 ? "square" : "staggered"
        });
        
        // Update TreeView
        if (typeof window.debouncedUpdateTreeView === "function") {
            window.debouncedUpdateTreeView();
        }
        
        // Reset pattern in polygon tool
        if (window.patternInPolygonTool) {
            window.patternInPolygonTool.checked = false;
            window.patternInPolygonTool.dispatchEvent(new Event("change"));
        }
    }
}

//=============================================================
// EXPOSE GLOBALS
//=============================================================

window.showPatternDialog = showPatternDialog;
window.setupPatternDialogEventListeners = setupPatternDialogEventListeners;
window.processPatternGeneration = processPatternGeneration;

