# Floating Toolbar to Sidenav Synchronization

**Date:** 2024-12-09 12:00  
**Task:** Link floating toolbar buttons to sidenav controls

## Summary

Added bi-directional synchronization between floating toolbar controls and their corresponding sidenav controls so users can access functionality without opening the sidenavs.

## Changes Made

### 1. holesAddingTool Event Listener (kirra.js ~line 4434)
- Added event listener for floating toolbar `holesAddingTool` checkbox
- When checked: activates sidenav `addHoleSwitch` and dispatches change event
- When unchecked: deactivates sidenav `addHoleSwitch`

### 2. resetFloatingToolbarButtons Update (kirra.js ~line 3358)
- Added `holesAddingTool` to the reset function with null check
- When switching tools, the holesAddingTool checkbox is properly reset

### 3. addHoleSwitch Cleanup (kirra.js ~line 3369)
- Added logic to uncheck `addHoleSwitch` and remove hole adding listeners when switching away from `holesAddingTool`
- Sets `isAddingHole = false` and removes click/touch event listeners

### 4. DOMContentLoaded Syncing (kirra.js ~line 17118)

#### KAD Color Sync (floatingKADColor ↔ drawingColor)
- Syncs from main `drawingColor` picker to `floatingKADColor`
- Syncs from `floatingKADColor` to main `drawingColor`
- Uses jscolor `onInput` event for real-time syncing

#### Elevation Sync (drawingElevationToolbar ↔ drawingElevation)
- Syncs both `input` and `change` events in both directions
- Updates `drawingZValue` when toolbar elevation changes

#### Hole Adding Sync (addHoleSwitch → holesAddingTool)
- When sidenav `addHoleSwitch` changes, updates floating toolbar `holesAddingTool`

### 5. Sidenav → Floating Toolbar Sync (when OFF)
Added code to uncheck floating toolbar buttons when sidenav controls are turned OFF:

- `addHoleSwitch` OFF → unchecks `holesAddingTool`
- `addPointDraw` OFF → unchecks `addKADPointsTool`
- `addLineDraw` OFF → unchecks `addKADLineTool`
- `addPolyDraw` OFF → unchecks `addKADPolygonTool`
- `addCircleDraw` OFF → unchecks `addKADCircleTool`
- `addTextDraw` OFF → unchecks `addKADTextTool`
- `addConnectorButton` OFF → unchecks `tieConnectTool`
- `addMultiConnectorButton` OFF → unchecks `tieConnectMultiTool`

### 6. addHoleSwitch ON → holesAddingTool
Changed `resetFloatingToolbarButtons("rulerTool", "bearingTool")` to `resetFloatingToolbarButtons("holesAddingTool")` so when sidenav addHoleSwitch is turned ON, the floating toolbar holesAddingTool is also checked.

## Controls Synced

| Floating Toolbar | Sidenav Control | Sync Direction |
|------------------|-----------------|----------------|
| holesAddingTool | addHoleSwitch | Bi-directional |
| addKADPointsTool | addPointDraw | Bi-directional |
| addKADLineTool | addLineDraw | Bi-directional |
| addKADPolygonTool | addPolyDraw | Bi-directional |
| addKADCircleTool | addCircleDraw | Bi-directional |
| addKADTextTool | addTextDraw | Bi-directional |
| tieConnectTool | addConnectorButton | Bi-directional |
| tieConnectMultiTool | addMultiConnectorButton | Bi-directional |
| drawingElevationToolbar | drawingElevation | Bi-directional |
| floatingKADColor | drawingColor | Bi-directional |

## Notes
- All tools now have full bi-directional sync
- Turning ON sidenav → checks floating toolbar (via resetFloatingToolbarButtons)
- Turning OFF sidenav → unchecks floating toolbar (via explicit uncheck code)
- Turning ON floating toolbar → checks sidenav (via dispatchEvent)
- Turning OFF floating toolbar → unchecks sidenav (via resetFloatingToolbarButtons)

