---
name: Safe Unicode Fix Plan
overview: Fix 182 corrupted Unicode characters in console.log statements using a careful, batch-by-batch approach with verification at each step to prevent encoding issues, wrong replacements, and code corruption.
todos:
  - id: batch1
    content: "Fix first batch (Findings 1-15): Lines 307, 540, 568, 714, 822, 890, 898, 913, 965, 2426, 3133, 3385, 5713, 6977, 7196"
    status: completed
  - id: verify_batch1
    content: "Verify batch 1: Check UTF-8 encoding, verify replacements, ensure no surrounding code modified"
    status: completed
    dependencies:
      - batch1
  - id: batch2
    content: "Fix second batch (Findings 16-30): Lines 7213, 7237, 7682, 8086, 10673-10676, 10778, 10780, 10799, 10802-10808"
    status: completed
    dependencies:
      - verify_batch1
  - id: verify_batch2
    content: "Verify batch 2: Check UTF-8 encoding, verify replacements, ensure no surrounding code modified"
    status: completed
    dependencies:
      - batch2
  - id: batch3
    content: "Fix third batch (Findings 31-50): Continue with next 20 findings from analysis document"
    status: completed
    dependencies:
      - verify_batch2
  - id: verify_batch3
    content: "Verify batch 3: Check UTF-8 encoding, verify replacements, ensure no surrounding code modified"
    status: completed
    dependencies:
      - batch3
  - id: remaining_batches
    content: "Fix remaining batches (Findings 51-182): Process remaining ~130 findings in batches of 10-15"
    status: completed
    dependencies:
      - verify_batch3
  - id: final_verification
    content: "Final verification: Compare key sections with backup file, verify all 182 replacements completed, ensure file parses correctly"
    status: completed
    dependencies:
      - remaining_batches
---

# Safe Unicode Character Restoration Plan

## Objective

Restore 182 corrupted Unicode characters in `src/kirra.js` console.log statements, replacing `"??"` and `"?"` placeholders with correct Unicode symbols (emojis, degree symbols, arrows, etc.) from the analysis document.

## Safety Strategy

### 1. Batch Processing

- Process in small batches of 10-15 replacements at a time
- Verify each batch before proceeding
- Stop if any issues are detected

### 2. Context Verification

- For each replacement, include 3-5 lines of context before and after
- Verify the exact string match before replacing
- Ensure surrounding code structure is preserved

### 3. Encoding Safety

- Ensure file is saved as UTF-8 encoding
- Verify Unicode characters display correctly after each batch
- Use exact Unicode code points from the analysis document

### 4. Verification Process

- After each batch:
- Read back the modified lines to verify correct replacement
- Check that no surrounding code was modified
- Verify file encoding is still UTF-8
- Test that the file still parses correctly

## Implementation Approach

### Phase 1: High-Confidence Replacements (Match Score = 1.00)

Start with the 150+ findings that have perfect match scores (1.00). These are the safest to fix first.

### Phase 2: Lower-Confidence Replacements (Match Score < 1.00)

Review and fix the ~30 findings with lower match scores (0.72-0.95) individually with extra verification.

### Phase 3: Verification

- Run a final verification pass
- Compare key sections with backup file
- Ensure all 182 replacements were completed correctly

## Replacement Pattern

For each finding in the analysis document:

1. Read the current line with context (3-5 lines before/after)
2. Verify the corrupted text matches exactly
3. Replace with the Unicode symbol from the "Original" text
4. Verify the replacement in context
5. Move to next finding

## Example Replacement

**Finding 1 (Line 307):**

- Current: `console.log("? Preferences loaded successfully");`
- Replace with: `console.log("✅ Preferences loaded successfully");`
- Context: Lines 305-309 to ensure function structure is preserved

**Finding 2 (Line 540):**

- Current: `console.log("?? Three.js local origin set from first hole:", threeLocalOriginX, threeLocalOriginY);`
- Replace with: `console.log("📍 Three.js local origin set from first hole:", threeLocalOriginX, threeLocalOriginY);`
- Context: Lines 538-542 to ensure function logic is preserved

## Files to Modify

- `src/kirra.js` - Main file with 182 corrupted console.log statements

## Reference Files

- `src/kirra.js.backup2` - Backup file with correct Unicode characters (for verification)
- `src/aiPlans/20251220-2300-Unicode-issue-analysis.md` - Analysis document with exact line numbers and replacements

## Risk Mitigation

1. **Wrong Replacements**: Use exact string matching with context verification
2. **Encoding Loss**: Explicitly ensure UTF-8 encoding after each batch
3. **Too Many at Once**: Process in batches of 10-15 replacements
4. **Context Loss**: Include 3-5 lines of context in each replacement operation
5. **File Corruption**: Verify file structure after each batch

## Success Criteria

- All 182 console.log statements have correct Unicode characters restored
- File encoding remains UTF-8
- No surrounding code was modified
- File parses correctly (no syntax errors)