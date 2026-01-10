# DXF Export Dialog - Combined Type and Filename Selection
**Date:** 2026-01-10 08:00
**Task:** Combine export type selection and filename input into single dialog

## Summary
Improved DXF export UX by combining export type selection and filename input into a single dialog, eliminating redundant user interactions.

## Key Improvement
**Before:** 2 dialogs per export
1. Select export type → Click Continue
2. Enter filename → Click Export

**After:** 1 dialog per export
1. Select export type + enter filename → Click Export

## Implementation
- Added filename input field to main dialog
- Dynamic filename updates when user changes export type
- Pre-generated default filenames for each type
- Radio buttons trigger filename field updates via event listeners

## Benefits
- Faster workflow (one less click)
- Live filename preview
- Better user experience
- Less interruption

## Files Modified
- `src/dialog/popups/export/DXFExportDialog.js` - Combined dialog, removed nested filename prompts

## Status
✅ Complete - Single dialog with dynamic filename updates
