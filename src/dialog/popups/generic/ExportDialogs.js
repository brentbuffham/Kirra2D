// Step 1) Export Dialogs Module
// Step 2) This module contains file export dialog functions (IREDES, AQM)
// Step 3) Dependencies: Swal, FloatingDialog, createEnhancedFormContent, getFormData, showModalMessage
// Step 4) Requires: Globals from kirra.js including allBlastHoles, blastGroupVisible, localStorage settings, etc.

// ⚠️ WARNING: These functions are LARGE (150-250 lines each)
// ⚠️ They use Swal.fire with extensive HTML templates using template literals
// ⚠️ Manual review and testing required after extraction

// TODO: Extract the following functions from kirra.js:
// - saveIREDESPopup() - line ~9702 (~200+ lines with extensive form and validation)
// - saveAQMPopup() - line ~18728 (~150+ lines with complex HTML)

// These functions need:
// 1. Template literal conversion to string concatenation
// 2. Testing of file export logic (IREDES XML format, AQM format)
// 3. Verification that all file generation functions are accessible
// 4. localStorage settings persistence testing

// Step 5) Placeholder - Functions to be extracted
console.warn("⚠️ ExportDialogs.js: Functions not yet extracted from kirra.js");
console.warn("Functions needed: saveIREDESPopup, saveAQMPopup");

// Step 6) Note for developer
// These dialogs handle critical export functionality - test thoroughly!
// IREDES uses XML format with CRC calculation
// AQM uses custom text format

