# Phase 2 Progress Summary

**Date**: 2025-12-20  
**Time**: 17:30  
**Status**: HIGH-PRIORITY ITEMS PARTIALLY COMPLETE

---

## Completed ✅

### 1. Export Syntax Error Check ✅
- **Result**: No ES6 export statements found in kirra.js
- **Status**: All clear - using proper `window.functionName` pattern

### 2. Remove Obsolete Functions ✅
- **addHolePopup()** - Already a 3-line wrapper ✅ No action needed
- **addPatternPopup()** - Already a 2-line wrapper ✅ No action needed  
- **showKADPropertyEditorPopup()** - Replaced 209-line implementation with delegation wrapper ✅

**Changes Made to kirra.js**:
```javascript
// Line 28276-28285 (was 28276-28485, now just 11 lines)
// Step 1) Obsolete function replaced by KADContextMenu.js
// Step 2) Original implementation: 209 lines (28276-28485) - had template literals and no Delete button
// Step 3) New implementation in src/dialog/contextMenu/KADContextMenu.js has:
//         - Delete button with auto-renumbering
//         - Proper segment endpoint handling
//         - No template literal violations
//         - Better edge case handling
// Step 4) This wrapper maintains backward compatibility for existing code
function showKADPropertyEditorPopup(kadObject) {
	// Delegate to the new implementation in KADContextMenu.js
	window.showKADPropertyEditorPopup(kadObject);
}
```

**Benefits**:
- Removed 198 lines of duplicate code from kirra.js
- Eliminated template literal violations
- Users now get Delete button functionality in KAD property editor
- Better segment handling
- Code reuse and maintainability improved

---

## In Progress / Pending ⚠️

### 3. Export Dialog Extraction - SIZE ANALYSIS

#### saveIREDESPopup() - Line 10230-10571 (342 lines)
- **Status**: ⚠️ Ready for extraction but complex
- **Current Implementation**: Uses FloatingDialog ✅ (good!)
- **Template Literals**: None found ✅
- **Size**: 342 lines
- **Complexity**:
  - Custom radio button styling (100+ lines)
  - CRC calculation logic
  - XML generation (calls `convertPointsToIREDESXML`)
  - iOS vs non-iOS download handling
  - Extensive validation
  - Hole type handling options
  
**Dependencies**:
- `window.allBlastHoles`
- `window.blastGroupVisible`
- `window.showModalMessage`
- `window.createEnhancedFormContent`
- `window.getFormData`
- `window.FloatingDialog`
- `window.convertPointsToIREDESXML` (separate function, line 10588+)
- `window.isIOS()`
- `window.isDragging`, `window.longPressTimeout`

**Extraction Strategy**:
1. Keep function intact - already using FloatingDialog
2. Move to `src/dialog/popups/generic/ExportDialogs.js`
3. Replace in kirra.js with wrapper delegation
4. Test thoroughly with actual IREDES export

#### saveAQMPopup() - Line 19402-19804 (402 lines)
- **Status**: ⚠️ Needs conversion AND extraction
- **Current Implementation**: Uses **Swal.fire** ❌ (needs conversion!)
- **Template Literals**: **MANY** ❌ (lines 19417-19601+)
- **Size**: 402 lines
- **Complexity**:
  - Massive Swal HTML template with 11 column dropdowns
  - Column selection system
  - Checkbox for ignore columns
  - Uses localStorage for settings persistence
  - Custom file generation logic

**Major Issues**:
1. ❌ **Extensive template literals throughout** (violates coding rules)
2. ❌ **Uses Swal.fire with inline HTML** (needs FloatingDialog conversion)
3. ❌ **11 dropdown selects hardcoded in template** (needs form builder)
4. ⚠️ **Complex column mapping logic** (preserve carefully)

**Conversion Requirements**:
1. Convert all template literals to string concatenation
2. Replace Swal.fire with FloatingDialog
3. Use `createEnhancedFormContent` for form fields
4. Manually build column dropdowns (11 of them!)
5. Preserve column mapping and file generation logic
6. Test extensively

**Estimated Conversion Time**: 2-3 hours due to:
- 11 select dropdowns to convert
- Complex HTML template to rebuild
- Template literal conversion (~30+ instances)
- Testing column mapping logic

---

## Decision Point 🤔

### Options for saveAQMPopup():

**Option A: Extract Now (High Effort)**
- Pros: Complete Phase 2.3 task, remove Swal dependency
- Cons: 2-3 hours of careful conversion work, high risk of bugs
- Effort: ⚠️⚠️⚠️ High

**Option B: Extract Later (Deferred)**
- Pros: Focus on simpler extractions first, build confidence
- Cons: Swal dependency remains, inconsistent dialog system
- Effort: ✅ Low (just mark as pending)

**Option C: Keep as Wrapper (Minimal)**
- Pros: Works as-is, focus on other priorities
- Cons: No modernization benefit
- Effort: ✅ Minimal

### Recommendation: **Option B** - Extract Later

**Rationale**:
1. `saveIREDESPopup()` is already modern (uses FloatingDialog)
2. `saveAQMPopup()` needs extensive rework (Swal + many template literals)
3. Both functions work correctly as-is
4. Higher value targets exist (pattern dialogs are simpler)
5. Can revisit in dedicated "AQM Modernization" task

---

## Remaining Phase 2 Tasks

### Medium Priority (Simpler Extractions)

#### Pattern Dialogs (3 functions)
- `showHolesAlongLinePopup()` - Line 33551
- `showPatternInPolygonPopup()` - Line 34158  
- `showHolesAlongPolylinePopup()` - Line 34731

**Estimated Size**: ~200-400 lines each  
**Complexity**: Medium (likely Swal-based, need conversion)  
**Value**: High (frequently used features)

#### Property Dialogs (~7 functions)
- `editBlastNamePopup()` - Line 41565
- `editHoleTypePopup()` - Line 41794
- Others TBD

**Estimated Size**: ~100-200 lines each  
**Complexity**: Low-Medium  
**Value**: Medium (less frequently used)

### Low Priority (Advanced Features)

#### KAD Dialogs (3 functions)
- `showOffsetKADPopup()` - Line 14849
- `showRadiiConfigPopup()` - Line 15508
- `showTriangulationPopup()` - Line 13285

**Estimated Size**: ~150-300 lines each  
**Complexity**: High (geometric algorithms)  
**Value**: Low (advanced users only)

---

## Summary Statistics

### Code Removed from kirra.js
- ✅ **showKADPropertyEditorPopup**: 198 lines removed (209 → 11 line wrapper)
- ✅ **Template literal violations**: Fixed 2 instances

### Current kirra.js Size
- **Original**: ~43,000 lines (estimated)
- **After Phase 2.2**: ~42,800 lines
- **Potential Reduction**: ~10,000+ lines if all extractions complete

### Phase 2 Progress
- ✅ **Completed**: 2/9 tasks (22%)
- ⚠️ **In Analysis**: 2/9 tasks (22%)
- 📋 **Pending**: 5/9 tasks (56%)

---

## Recommended Next Steps

### Immediate (Continue Phase 2)
1. ✅ Mark export dialog extraction as "analyzed" 
2. ⚠️ Extract simpler pattern dialogs first (showHolesAlongLinePopup, etc.)
3. ⚠️ Build confidence with medium-complexity extractions
4. 📋 Revisit AQM export later as dedicated task

### Alternative (Move to Phase 3)
1. ✅ Mark Phase 2 as "partially complete"
2. ⚠️ Begin Phase 3 (Save System Redesign)
3. ⚠️ More value to users (new functionality vs code cleanup)
4. 📋 Return to Phase 2 after Phase 3/4 complete

---

## Question for User

**Should we**:
A. Continue with Phase 2 pattern dialog extractions (medium effort)?
B. Defer export dialogs and move to Phase 3 Save System (new features)?
C. Extract save IREDES now (easy) and defer AQM (hard)?

All three paths are valid - just need direction on priorities!


