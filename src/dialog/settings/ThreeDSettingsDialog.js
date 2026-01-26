// Step 1) 3D Settings Dialog Module
// Step 2) This module handles the 3D Scene, Camera and Lighting Settings dialog
// Step 3) Dependencies: FloatingDialog, createEnhancedFormContent, getFormData (from FloatingDialog.js)
// Step 4) Requires: load3DSettings, save3DSettings, apply3DSettings functions from kirra.js
// Step 0) Converted to ES Module for Vite bundling - 2025-12-26

// Step 5) Show 3D Scene, Camera and Lighting Settings dialog
export function show3DSettingsDialog() {
    // Step 5a) Access required functions from window (exposed by kirra.js)
    const load3DSettings = window.load3DSettings;
    const save3DSettings = window.save3DSettings;
    const apply3DSettings = window.apply3DSettings;

    if (!load3DSettings || !save3DSettings || !apply3DSettings) {
        console.error("❌ 3D Settings functions not available. Make sure they are exposed on window.");
        return;
    }

    // Step 5b) Load current settings
    const currentSettings = load3DSettings();

    // Step 5c) Create form fields (removed Grid and Clipping Plane settings)
    // Step 5c.1) Helper to find closest damping value for dropdown
    const dampingOptions = [0, 0.3, 0.5, 0.7, 1];
    const currentDamping = currentSettings.dampingFactor !== undefined ? currentSettings.dampingFactor : 0;
    const closestDamping = dampingOptions.reduce((prev, curr) => 
        Math.abs(curr - currentDamping) < Math.abs(prev - currentDamping) ? curr : prev
    );
    
    const fields = [
        {
            type: "select",
            name: "dampingFactor",
            label: "Damping Factor:",
            value: String(closestDamping),
            options: [
                { value: "0", text: "No Spin (0)" },
                { value: "0.3", text: "Low (0.3)" },
                { value: "0.5", text: "Medium (0.5)" },
                { value: "0.7", text: "High (0.7)" },
                { value: "1", text: "Max Spin (1)" }
            ]
        },
        {
            type: "select",
            name: "cursorZoom",
            label: "Cursor Zoom:",
            value: currentSettings.cursorZoom !== false ? "on" : "off",
            options: [
                { value: "on", text: "On" },
                { value: "off", text: "Off" }
            ]
        },
        {
            type: "select",
            name: "plumbLineDisplay",
            label: "Display Plumb Line to Drawing Z:",
            value: currentSettings.plumbLineDisplay || "off",
            options: [
                { value: "on", text: "On" },
                { value: "off", text: "Off" }
            ]
        },
        {
            type: "number",
            name: "lightBearing",
            label: "Light Bearing (deg):",
            value: currentSettings.lightBearing || 135,
            min: 0,
            max: 360,
            step: 1,
            placeholder: "135"
        },
        {
            type: "number",
            name: "lightElevation",
            label: "Light Elevation (deg):",
            value: currentSettings.lightElevation || 15,
            min: 0,
            max: 180,
            step: 1,
            placeholder: "15"
        },
        {
            type: "number",
            name: "ambientLightIntensity",
            label: "Ambient Light Intensity:",
            value: currentSettings.ambientLightIntensity !== undefined ? currentSettings.ambientLightIntensity : 0.8,
            min: 0,
            max: 2,
            step: 0.1,
            placeholder: "0.8 (0=off)"
        },
        {
            type: "number",
            name: "directionalLightIntensity",
            label: "Directional Light Intensity:",
            value: currentSettings.directionalLightIntensity !== undefined ? currentSettings.directionalLightIntensity : 2.5,
            min: 0,
            max: 10,
            step: 0.1,
            placeholder: "2.5"
        },
        {
            type: "number",
            name: "shadowIntensity",
            label: "Shadow Intensity:",
            value: currentSettings.shadowIntensity !== undefined ? currentSettings.shadowIntensity : 0.5,
            min: 0,
            max: 1,
            step: 0.05,
            placeholder: "0.5 (0=none, 1=max)"
        },
        {
            type: "select",
            name: "axisLock",
            label: "Axis Lock (Orbit Constraint):",
            value: currentSettings.axisLock || "none",
            options: [
                { value: "none", text: "None" },
                { value: "pitch", text: "Pitch" },
                { value: "roll", text: "Roll" },
                { value: "yaw", text: "Yaw" }
            ]
        },
        {
            type: "select",
            name: "gizmoDisplay",
            label: "Gizmo Display:",
            value: currentSettings.gizmoDisplay || "only_when_orbit_or_rotate",
            options: [
                { value: "always", text: "Always" },
                { value: "only_when_orbit_or_rotate", text: "Only When Orbit or Rotate" },
                { value: "never", text: "Never" }
            ]
        },
        {
            type: "select",
            name: "textBillboarding",
            label: "Text Billboarding:",
            value: currentSettings.textBillboarding || "off",
            options: [
                { value: "off", text: "Off" },
                { value: "holes", text: "On (Holes)" },
                { value: "kad", text: "On (KAD)" },
                { value: "all", text: "On (All)" }
            ]
        }
    ];

    // Step 5d) Create form content
    const formContent = createEnhancedFormContent(fields, false, false);

    // Step 5e) Create dialog
    const dialog = new FloatingDialog({
        title: "3D Scene, Camera and Lighting Settings",
        content: formContent,
        width: 520,
        height: 480,
        layoutType: "default",
        draggable: true,
        resizable: true,
        closeOnOutsideClick: false,
        showConfirm: true,
        showCancel: true,
        confirmText: "Save",
        cancelText: "Cancel",
        onConfirm: () => {
            // Step 5f) Get form data
            const formData = getFormData(formContent);

            // Step 5g) Convert form data types
            // Step 5g.1) Parse dampingFactor from dropdown (string to number)
            formData.dampingFactor = parseFloat(formData.dampingFactor) || 0;

            // Step 5h) Parse cursorZoom from dropdown (string "on"/"off" to boolean)
            formData.cursorZoom = formData.cursorZoom === "on";
            
            // Step 5h.1) Parse plumbLineDisplay from dropdown
            formData.plumbLineDisplay = formData.plumbLineDisplay || "off";

            // Step 5i) Parse number fields
            formData.lightBearing = parseInt(formData.lightBearing) || 135;
            formData.lightElevation = parseInt(formData.lightElevation) || 15;
            formData.ambientLightIntensity = parseFloat(formData.ambientLightIntensity);
            if (isNaN(formData.ambientLightIntensity)) formData.ambientLightIntensity = 0.8;
            formData.directionalLightIntensity = parseFloat(formData.directionalLightIntensity);
            if (isNaN(formData.directionalLightIntensity)) formData.directionalLightIntensity = 2.5;
            formData.shadowIntensity = parseFloat(formData.shadowIntensity);
            if (isNaN(formData.shadowIntensity)) formData.shadowIntensity = 0.5;
            formData.axisLock = formData.axisLock || "none";
            formData.gizmoDisplay = formData.gizmoDisplay || "only_when_orbit_or_rotate";
            formData.textBillboarding = formData.textBillboarding || "off";

            // Step 5j) Save settings
            console.log("💾 Saving 3D settings:", formData);
            save3DSettings(formData);

            // Step 5k) Apply settings
            console.log("⚙️ Applying 3D settings:", formData);
            apply3DSettings(formData);

            console.log("✅ 3D settings saved and applied");
        },
        onCancel: () => {
            console.log("❌ 3D settings dialog cancelled");
        }
    });

    // Step 5l) Show dialog
    dialog.show();
}

// Step 6) Expose function globally
window.show3DSettingsDialog = show3DSettingsDialog;
