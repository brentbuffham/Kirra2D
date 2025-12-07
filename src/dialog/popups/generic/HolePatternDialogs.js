// Step 1) Hole Pattern Dialogs Module
// Step 2) This module contains blast hole pattern generation dialog functions
// Step 3) Dependencies: FloatingDialog, Swal (for legacy dialogs), showModalMessage, showProximityWarning
// Step 4) Requires: Many globals from kirra.js including allBlastHoles, selectedHole, worldX, worldY, etc.

// ⚠️ WARNING: These functions are VERY LARGE (300-600 lines each) and use Swal.fire extensively
// ⚠️ They contain many template literals that need conversion to string concatenation
// ⚠️ Manual review and testing required after extraction

// TODO: Extract the following functions from kirra.js:
// - addHolePopup() - line ~19135 (337 lines)
// - addPatternPopup(worldX, worldY) - line ~19510 (lots of validation logic)
// - showHolesAlongLinePopup() - line ~32403
// - showPatternInPolygonPopup() - line ~33009
// - showHolesAlongPolylinePopup(vertices) - line ~33812

// These functions need:
// 1. Template literal conversion to string concatenation
// 2. Swal.fire conversion to FloatingDialog where appropriate
// 3. Testing of all form validation logic
// 4. Verification that all dependencies are available

// Step 5) Placeholder - Functions to be extracted
console.warn("⚠️ HolePatternDialogs.js: Functions not yet extracted from kirra.js");
console.warn("Functions needed: addHolePopup, addPatternPopup, showHolesAlongLinePopup, showPatternInPolygonPopup, showHolesAlongPolylinePopup");

// Step 6) Note for developer
// These dialogs are complex with extensive form handling, validation, and proximity checks.
// Recommend extracting them one at a time with full testing after each extraction.

