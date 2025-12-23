# Surface/Grade Assignment Persistence Fix

## Issue
The surface and grade assignment tools (lines 35205-35612) were modifying hole properties but not saving changes to IndexedDB. When the application was reloaded, holes would revert to their last saved DB values.

## Root Cause
The `assignHoleToSurfaceElevation()` function and related code were updating hole properties (startZLocation, benchHeight, holeLength, etc.) but failing to call `debouncedSaveHoles()` to persist these changes to the database.

## Solution
Added `debouncedSaveHoles()` calls in three strategic locations:

1. **In `assignHoleToSurfaceElevation()` for collar assignments** (after surface elevation assignment)
2. **In `assignHoleToSurfaceElevation()` for grade assignments** (after grade elevation assignment)
3. **In `assignHolesToFixedElevation()`** (after processing all selected holes for fixed elevation assignment)

## Files Modified
- `src/kirra.js`: Added debouncedSaveHoles() calls at lines 35221, 35241, and 35588

## Testing
The fix ensures that:
- Single hole surface/grade assignments are saved immediately
- Multiple hole assignments are saved after all holes are processed
- Changes persist across application reloads
- No linter errors introduced

## Related Rules
- Follows existing pattern of calling debouncedSaveHoles() after hole modifications
- Maintains 2-second debounced save to avoid excessive DB writes
- Uses existing debouncedSaveHoles() function for consistency
