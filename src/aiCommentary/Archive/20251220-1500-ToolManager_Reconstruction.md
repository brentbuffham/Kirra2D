# ToolManager.js Reconstruction
**Date:** 20251220-1500  
**Status:** Complete  
**Author:** AI Agent (with Brent Buffham)

## Context

The `src/tools/ToolManager.js` file was previously populated in a worktree but was lost, leaving only an empty file in the Git repository. The user reported it had a source icon and was managing tools like KAD (Kirra Add Drawing) tools and selection tools.

## Analysis

Through investigation of `kirra.js`, I identified the existing tool management pattern:

### Tool Categories Found:
1. **Selection Tools** - `selectPointerTool`, `selectByPolygonTool`, `selectHoles`, `selectKAD`
2. **KAD Drawing Tools** - `addKADPointsTool`, `addKADLineTool`, `addKADPolygonTool`, `addKADCircleTool`, `addKADTextTool`
3. **Pattern Tools** - `patternInPolygonTool`, `holesAlongLineTool`, `holesAlongPolyLineTool`, `holesAddingTool`
4. **Transform Tools** - `moveToTool`, `bearingTool`, `assignSurfaceTool`, `assignGradeTool`, `offsetKADTool`, `radiiHolesOrKADsTool`
5. **Connector Tools** - `tieConnectTool`, `tieConnectMultiTool`
6. **Analysis Tools** - `triangulateTool`
7. **Measurement Tools** - `rulerTool`, `rulerProtractorTool`
8. **View Tools** - `resetViewTool`

### Existing Pattern in kirra.js:
- Line 3448-3547: `resetFloatingToolbarButtons()` function manages tool state
- Line 4521+: Individual tool event listeners
- Line 2777-2908: Tool state boolean variables (e.g., `isSelectionPointerActive`, `isMoveToolActive`)
- Line 24834-24861: `initializeToolbarConnections()` function

## Reconstruction

Created a comprehensive `ToolManager` class with the following features:

### Core Functionality:
1. **Tool Registration** - All tools registered with metadata (id, type, stateVar, elementId, linkedSwitch/Button)
2. **Activation/Deactivation** - Methods to activate, deactivate, and toggle tools
3. **State Management** - Track current and previous tool states
4. **Tool Queries** - Get tools by ID, type, or category
5. **DOM Synchronization** - Sync tool state with checkbox/radio button elements
6. **Status Messages** - Built-in status messages for each tool

### Key Methods:
- `activateTool(toolId)` - Activate a tool and deactivate others
- `deactivateTool(toolId)` - Deactivate a specific tool
- `toggleTool(toolId)` - Toggle tool on/off
- `getCurrentTool()` - Get currently active tool
- `getActiveTools()` - Get all active tools
- `getToolsByType(type)` - Get all tools of a specific type
- `isKADTool(toolId)` - Check if tool is a KAD drawing tool
- `getToolStatusMessage(toolId)` - Get user-friendly status message
- `resetAllTools()` - Reset all tools to default state

### Tool Structure:
Each tool has:
- `id` - Unique identifier (e.g., "addKADPointsTool")
- `elementId` - DOM element ID
- `active` - Boolean activation state
- `stateVar` - Global state variable name (e.g., "isAddKADPointsToolActive")
- `type` - Tool category (selection, kad, pattern, transform, connector, analysis, measurement, view)
- `linkedSwitch` - Optional linked switch element (for KAD tools)
- `linkedButton` - Optional linked button element (for connector tools)
- `group` - Optional radio button group name

## Integration Notes

### To integrate ToolManager into kirra.js:

1. **Import the manager:**
   ```javascript
   import toolManager from "./tools/ToolManager.js";
   ```

2. **Replace `resetFloatingToolbarButtons()` calls with:**
   ```javascript
   toolManager.activateTool(toolId);
   ```

3. **Query tool state:**
   ```javascript
   if (toolManager.isToolActive("addKADPoints")) {
       // Handle KAD point tool
   }
   ```

4. **Get status messages:**
   ```javascript
   updateStatusMessage(toolManager.getToolStatusMessage(toolId));
   ```

5. **Sync with existing state variables:**
   ```javascript
   isSelectionPointerActive = toolManager.isToolActive("selectPointer");
   ```

## Benefits

1. **Centralized Management** - Single source of truth for tool state
2. **Type Safety** - Categorized tools by type (kad, selection, transform, etc.)
3. **Reduced Code Duplication** - Eliminates repetitive tool management code
4. **Better Debugging** - `getToolInfo()` provides complete tool state
5. **Maintainability** - Easy to add new tools or modify existing ones
6. **Consistency** - Ensures tools are properly deactivated when switching

## Testing Recommendations

1. Test tool activation/deactivation
2. Verify DOM synchronization (checkboxes/radio buttons)
3. Test tool type queries (getKADTools, getSelectionTools, etc.)
4. Verify linked switches work correctly (KAD tools → drawing switches)
5. Test radio button group behavior (selectHoles vs selectKAD)
6. Verify status messages match user expectations

## Future Enhancements

1. **Event System** - Add tool activation/deactivation events
2. **Tool Validation** - Validate tool transitions (can switch from A to B?)
3. **Tool History** - Track full tool usage history, not just previous
4. **Keyboard Shortcuts** - Map keyboard shortcuts to tools
5. **Tool Groups** - Create tool groups for batch operations
6. **Persistence** - Save/restore tool state across sessions

## Files Modified

- `src/tools/ToolManager.js` - Created new ToolManager class (659 lines)

## Related Files

- `src/kirra.js` - Contains existing tool management code (lines 3448-3547, 4521+, 2777-2908)
- `kirra.html` - Contains tool UI elements (lines 2329-2460)

## Conclusion

The `ToolManager` class provides a robust, centralized system for managing all tools in the Kirra2D application. It maintains compatibility with the existing tool management pattern while providing a cleaner, more maintainable API for future development.

