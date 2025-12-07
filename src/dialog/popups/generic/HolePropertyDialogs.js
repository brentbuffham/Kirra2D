// Step 1) Hole Property Editor Dialogs Module
// Step 2) This module contains blast hole property editing dialog functions
// Step 3) Dependencies: FloatingDialog, createFormContent, getFormData
// Step 4) Requires: Globals from kirra.js including selectedHole, allBlastHoles, clickedHole, isHoleVisible, etc.

// ⚠️ WARNING: These functions are MEDIUM-LARGE (100-200 lines each)
// ⚠️ They use FloatingDialog but some still have template literals to convert
// ⚠️ Manual review and testing required after extraction

// TODO: Extract the following functions from kirra.js:
// - editBlastNamePopup(selectedHole) - line ~44653 (~150 lines)
// - editHoleTypePopup() - line ~44884
// - editHoleLengthPopup() - line ~44968
// - measuredLengthPopup() - line ~45087
// - measuredMassPopup() - line ~45165
// - measuredCommentPopup() - line ~45243
// - renameEntityDialog(entityType, oldEntityName) - line ~44599

// These functions need:
// 1. Template literal conversion to string concatenation where present
// 2. Testing of all form validation logic
// 3. Verification of checkAndResolveDuplicateHoleIDs integration
// 4. Verification that all dependencies are available

// Step 5) Placeholder - Functions to be extracted
console.warn("⚠️ HolePropertyDialogs.js: Functions not yet extracted from kirra.js");
console.warn("Functions needed: editBlastNamePopup, editHoleTypePopup, editHoleLengthPopup, measuredLengthPopup, measuredMassPopup, measuredCommentPopup, renameEntityDialog");

// Step 6) Note for developer
// These dialogs use FloatingDialog which is good, but still need extraction with care.
// They modify selectedHole and interact with tree view updates.

