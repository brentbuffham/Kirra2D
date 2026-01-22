/**
 * UndoActions.js
 * Action classes for undo/redo operations on Holes and KAD entities
 * Author: AI Assistant
 * Created: 2026-01-22
 */

import { UndoableAction, ActionTypes } from "./UndoManager.js";

// ============================================================
// HOLE ACTIONS
// ============================================================

// Step 1) AddHoleAction - Undo: remove hole, Redo: add hole back
class AddHoleAction extends UndoableAction {
    constructor(holeData) {
        super(ActionTypes.ADD_HOLE, true, false);
        // Step 1a) Store a deep copy of the hole data
        this.holeData = JSON.parse(JSON.stringify(holeData));
        this.holeId = holeData.holeID;
        this.entityName = holeData.entityName;
        this.description = "Add hole " + (this.holeId || "");
    }
    
    execute() {
        // Step 1b) Add hole to allBlastHoles array
        if (window.allBlastHoles) {
            window.allBlastHoles.push(JSON.parse(JSON.stringify(this.holeData)));
        }
    }
    
    undo() {
        // Step 1c) Remove hole from allBlastHoles array
        if (window.allBlastHoles) {
            var index = window.allBlastHoles.findIndex(function(h) {
                return h.holeID === this.holeId && h.entityName === this.entityName;
            }.bind(this));
            if (index !== -1) {
                window.allBlastHoles.splice(index, 1);
            }
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 2) AddMultipleHolesAction - For adding multiple holes at once
class AddMultipleHolesAction extends UndoableAction {
    constructor(holesData) {
        super(ActionTypes.ADD_HOLE, true, false);
        // Step 2a) Store deep copies of all hole data
        this.holesData = holesData.map(function(h) {
            return JSON.parse(JSON.stringify(h));
        });
        this.description = "Add " + this.holesData.length + " holes";
    }
    
    execute() {
        // Step 2b) Add all holes to allBlastHoles array
        if (window.allBlastHoles) {
            for (var i = 0; i < this.holesData.length; i++) {
                window.allBlastHoles.push(JSON.parse(JSON.stringify(this.holesData[i])));
            }
        }
    }
    
    undo() {
        // Step 2c) Remove all holes from allBlastHoles array
        if (window.allBlastHoles) {
            for (var i = 0; i < this.holesData.length; i++) {
                var holeData = this.holesData[i];
                var index = window.allBlastHoles.findIndex(function(h) {
                    return h.holeID === holeData.holeID && h.entityName === holeData.entityName;
                });
                if (index !== -1) {
                    window.allBlastHoles.splice(index, 1);
                }
            }
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 3) DeleteHoleAction - Undo: restore hole, Redo: delete again
class DeleteHoleAction extends UndoableAction {
    constructor(holeData, originalIndex) {
        super(ActionTypes.DELETE_HOLE, true, false);
        // Step 3a) Store a deep copy of the hole data
        this.holeData = JSON.parse(JSON.stringify(holeData));
        this.originalIndex = originalIndex !== undefined ? originalIndex : -1;
        this.holeId = holeData.holeID;
        this.entityName = holeData.entityName;
        this.description = "Delete hole " + (this.holeId || "");
    }
    
    execute() {
        // Step 3b) Remove hole from allBlastHoles array
        if (window.allBlastHoles) {
            var index = window.allBlastHoles.findIndex(function(h) {
                return h.holeID === this.holeId && h.entityName === this.entityName;
            }.bind(this));
            if (index !== -1) {
                window.allBlastHoles.splice(index, 1);
            }
        }
    }
    
    undo() {
        // Step 3c) Restore hole to allBlastHoles array
        if (window.allBlastHoles) {
            var holeToRestore = JSON.parse(JSON.stringify(this.holeData));
            if (this.originalIndex !== -1 && this.originalIndex < window.allBlastHoles.length) {
                window.allBlastHoles.splice(this.originalIndex, 0, holeToRestore);
            } else {
                window.allBlastHoles.push(holeToRestore);
            }
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 4) DeleteMultipleHolesAction - For deleting multiple holes at once
class DeleteMultipleHolesAction extends UndoableAction {
    constructor(holesData) {
        super(ActionTypes.DELETE_HOLE, true, false);
        // Step 4a) Store deep copies with original indices
        this.holesData = holesData.map(function(item) {
            return {
                holeData: JSON.parse(JSON.stringify(item.holeData || item)),
                originalIndex: item.originalIndex !== undefined ? item.originalIndex : -1
            };
        });
        this.description = "Delete " + this.holesData.length + " holes";
    }
    
    execute() {
        // Step 4b) Remove all holes (in reverse order to preserve indices)
        if (window.allBlastHoles) {
            // Sort by index descending to remove from end first
            var sortedData = this.holesData.slice().sort(function(a, b) {
                return b.originalIndex - a.originalIndex;
            });
            
            for (var i = 0; i < sortedData.length; i++) {
                var holeData = sortedData[i].holeData;
                var index = window.allBlastHoles.findIndex(function(h) {
                    return h.holeID === holeData.holeID && h.entityName === holeData.entityName;
                });
                if (index !== -1) {
                    window.allBlastHoles.splice(index, 1);
                }
            }
        }
    }
    
    undo() {
        // Step 4c) Restore all holes (in original order by index)
        if (window.allBlastHoles) {
            // Sort by index ascending to restore in order
            var sortedData = this.holesData.slice().sort(function(a, b) {
                return a.originalIndex - b.originalIndex;
            });
            
            for (var i = 0; i < sortedData.length; i++) {
                var item = sortedData[i];
                var holeToRestore = JSON.parse(JSON.stringify(item.holeData));
                if (item.originalIndex !== -1 && item.originalIndex <= window.allBlastHoles.length) {
                    window.allBlastHoles.splice(item.originalIndex, 0, holeToRestore);
                } else {
                    window.allBlastHoles.push(holeToRestore);
                }
            }
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 5) MoveHoleAction - Undo: restore original position, Redo: apply new position
class MoveHoleAction extends UndoableAction {
    constructor(holeId, entityName, originalPosition, newPosition) {
        super(ActionTypes.MOVE_HOLE, true, false);
        this.holeId = holeId;
        this.entityName = entityName;
        // Step 5a) Store original and new positions
        this.originalPosition = JSON.parse(JSON.stringify(originalPosition));
        this.newPosition = JSON.parse(JSON.stringify(newPosition));
        this.description = "Move hole " + (holeId || "");
    }
    
    execute() {
        this._applyPosition(this.newPosition);
    }
    
    undo() {
        this._applyPosition(this.originalPosition);
    }
    
    redo() {
        this._applyPosition(this.newPosition);
    }
    
    // Step 5b) Helper to apply position to hole
    _applyPosition(position) {
        if (window.allBlastHoles) {
            var hole = window.allBlastHoles.find(function(h) {
                return h.holeID === this.holeId && h.entityName === this.entityName;
            }.bind(this));
            
            if (hole) {
                // Apply collar position
                if (position.startXLocation !== undefined) hole.startXLocation = position.startXLocation;
                if (position.startYLocation !== undefined) hole.startYLocation = position.startYLocation;
                if (position.startZLocation !== undefined) hole.startZLocation = position.startZLocation;
                
                // Apply toe position
                if (position.endXLocation !== undefined) hole.endXLocation = position.endXLocation;
                if (position.endYLocation !== undefined) hole.endYLocation = position.endYLocation;
                if (position.endZLocation !== undefined) hole.endZLocation = position.endZLocation;
                
                // Apply grade position
                if (position.gradeXLocation !== undefined) hole.gradeXLocation = position.gradeXLocation;
                if (position.gradeYLocation !== undefined) hole.gradeYLocation = position.gradeYLocation;
                if (position.gradeZLocation !== undefined) hole.gradeZLocation = position.gradeZLocation;
            }
        }
    }
}

// Step 6) MoveMultipleHolesAction - For moving multiple holes at once
class MoveMultipleHolesAction extends UndoableAction {
    constructor(moveData) {
        super(ActionTypes.MOVE_HOLE, true, false);
        // Step 6a) Store move data for each hole
        // moveData is array of { holeId, entityName, originalPosition, newPosition }
        this.moveData = moveData.map(function(m) {
            return {
                holeId: m.holeId,
                entityName: m.entityName,
                originalPosition: JSON.parse(JSON.stringify(m.originalPosition)),
                newPosition: JSON.parse(JSON.stringify(m.newPosition))
            };
        });
        this.description = "Move " + this.moveData.length + " holes";
    }
    
    execute() {
        for (var i = 0; i < this.moveData.length; i++) {
            this._applyPosition(this.moveData[i], this.moveData[i].newPosition);
        }
    }
    
    undo() {
        for (var i = 0; i < this.moveData.length; i++) {
            this._applyPosition(this.moveData[i], this.moveData[i].originalPosition);
        }
    }
    
    redo() {
        this.execute();
    }
    
    _applyPosition(moveItem, position) {
        if (window.allBlastHoles) {
            var hole = window.allBlastHoles.find(function(h) {
                return h.holeID === moveItem.holeId && h.entityName === moveItem.entityName;
            });
            
            if (hole) {
                if (position.startXLocation !== undefined) hole.startXLocation = position.startXLocation;
                if (position.startYLocation !== undefined) hole.startYLocation = position.startYLocation;
                if (position.startZLocation !== undefined) hole.startZLocation = position.startZLocation;
                if (position.endXLocation !== undefined) hole.endXLocation = position.endXLocation;
                if (position.endYLocation !== undefined) hole.endYLocation = position.endYLocation;
                if (position.endZLocation !== undefined) hole.endZLocation = position.endZLocation;
                if (position.gradeXLocation !== undefined) hole.gradeXLocation = position.gradeXLocation;
                if (position.gradeYLocation !== undefined) hole.gradeYLocation = position.gradeYLocation;
                if (position.gradeZLocation !== undefined) hole.gradeZLocation = position.gradeZLocation;
            }
        }
    }
}

// Step 7) EditHolePropsAction - Undo: restore original props, Redo: apply new props
class EditHolePropsAction extends UndoableAction {
    constructor(holeId, entityName, originalProps, newProps) {
        super(ActionTypes.EDIT_HOLE_PROPS, true, false);
        this.holeId = holeId;
        this.entityName = entityName;
        this.originalProps = JSON.parse(JSON.stringify(originalProps));
        this.newProps = JSON.parse(JSON.stringify(newProps));
        this.description = "Edit hole " + (holeId || "") + " properties";
    }
    
    execute() {
        this._applyProps(this.newProps);
    }
    
    undo() {
        this._applyProps(this.originalProps);
    }
    
    redo() {
        this._applyProps(this.newProps);
    }
    
    _applyProps(props) {
        if (window.allBlastHoles) {
            var hole = window.allBlastHoles.find(function(h) {
                return h.holeID === this.holeId && h.entityName === this.entityName;
            }.bind(this));
            
            if (hole) {
                for (var key in props) {
                    if (props.hasOwnProperty(key)) {
                        hole[key] = props[key];
                    }
                }
            }
        }
    }
}

// Step 8) EditMultipleHolesPropsAction - For editing multiple holes at once
class EditMultipleHolesPropsAction extends UndoableAction {
    constructor(editData) {
        super(ActionTypes.EDIT_HOLE_PROPS, true, false);
        // editData is array of { holeId, entityName, originalProps, newProps }
        this.editData = editData.map(function(e) {
            return {
                holeId: e.holeId,
                entityName: e.entityName,
                originalProps: JSON.parse(JSON.stringify(e.originalProps)),
                newProps: JSON.parse(JSON.stringify(e.newProps))
            };
        });
        this.description = "Edit " + this.editData.length + " holes properties";
    }
    
    execute() {
        for (var i = 0; i < this.editData.length; i++) {
            this._applyProps(this.editData[i], this.editData[i].newProps);
        }
    }
    
    undo() {
        for (var i = 0; i < this.editData.length; i++) {
            this._applyProps(this.editData[i], this.editData[i].originalProps);
        }
    }
    
    redo() {
        this.execute();
    }
    
    _applyProps(editItem, props) {
        if (window.allBlastHoles) {
            var hole = window.allBlastHoles.find(function(h) {
                return h.holeID === editItem.holeId && h.entityName === editItem.entityName;
            });
            
            if (hole) {
                for (var key in props) {
                    if (props.hasOwnProperty(key)) {
                        hole[key] = props[key];
                    }
                }
            }
        }
    }
}

// ============================================================
// KAD ACTIONS
// ============================================================

// Step 9) AddKADEntityAction - Undo: remove entity, Redo: add entity back
class AddKADEntityAction extends UndoableAction {
    constructor(entityName, entityData) {
        super(ActionTypes.ADD_KAD_ENTITY, false, true);
        this.entityName = entityName;
        // Step 9a) Store deep copy of entity data
        this.entityData = JSON.parse(JSON.stringify(entityData));
        this.description = "Add KAD entity '" + entityName + "'";
    }
    
    execute() {
        if (window.allKADDrawingsMap) {
            window.allKADDrawingsMap.set(this.entityName, JSON.parse(JSON.stringify(this.entityData)));
        }
    }
    
    undo() {
        if (window.allKADDrawingsMap) {
            window.allKADDrawingsMap.delete(this.entityName);
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 10) DeleteKADEntityAction - Undo: restore entity, Redo: delete again
class DeleteKADEntityAction extends UndoableAction {
    constructor(entityName, entityData) {
        super(ActionTypes.DELETE_KAD_ENTITY, false, true);
        this.entityName = entityName;
        this.entityData = JSON.parse(JSON.stringify(entityData));
        this.description = "Delete KAD entity '" + entityName + "'";
    }
    
    execute() {
        if (window.allKADDrawingsMap) {
            window.allKADDrawingsMap.delete(this.entityName);
        }
    }
    
    undo() {
        if (window.allKADDrawingsMap) {
            window.allKADDrawingsMap.set(this.entityName, JSON.parse(JSON.stringify(this.entityData)));
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 10a) AddMultipleKADEntitiesAction - For adding multiple entities at once (e.g., radii tool)
class AddMultipleKADEntitiesAction extends UndoableAction {
    constructor(entityNames) {
        super(ActionTypes.ADD_KAD_ENTITY, false, true);
        // Step #) Store entity names - we'll capture data on first undo
        this.entityNames = entityNames.slice();
        this.entitiesData = null; // Captured lazily
        this.description = "Add " + entityNames.length + " KAD entities";
    }
    
    execute() {
        // Step #) Re-add entities from stored data
        if (window.allKADDrawingsMap && this.entitiesData) {
            for (var i = 0; i < this.entitiesData.length; i++) {
                var item = this.entitiesData[i];
                window.allKADDrawingsMap.set(item.name, JSON.parse(JSON.stringify(item.data)));
            }
        }
    }
    
    undo() {
        // Step #) Capture entity data before removing (for redo)
        if (!this.entitiesData && window.allKADDrawingsMap) {
            this.entitiesData = [];
            for (var i = 0; i < this.entityNames.length; i++) {
                var name = this.entityNames[i];
                var data = window.allKADDrawingsMap.get(name);
                if (data) {
                    this.entitiesData.push({
                        name: name,
                        data: JSON.parse(JSON.stringify(data))
                    });
                }
            }
        }
        
        // Step #) Remove all entities
        if (window.allKADDrawingsMap) {
            for (var i = 0; i < this.entityNames.length; i++) {
                window.allKADDrawingsMap.delete(this.entityNames[i]);
            }
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 10b) DeleteMultipleKADEntitiesAction - For deleting multiple entities at once
class DeleteMultipleKADEntitiesAction extends UndoableAction {
    constructor(entitiesData) {
        super(ActionTypes.DELETE_KAD_ENTITY, false, true);
        // Step #) Store deep copies of all entity data
        // entitiesData is array of { name, data } or we capture from names
        this.entitiesData = entitiesData.map(function(item) {
            return {
                name: item.name || item.entityName,
                data: JSON.parse(JSON.stringify(item.data || item))
            };
        });
        this.description = "Delete " + this.entitiesData.length + " KAD entities";
    }
    
    execute() {
        if (window.allKADDrawingsMap) {
            for (var i = 0; i < this.entitiesData.length; i++) {
                window.allKADDrawingsMap.delete(this.entitiesData[i].name);
            }
        }
    }
    
    undo() {
        if (window.allKADDrawingsMap) {
            for (var i = 0; i < this.entitiesData.length; i++) {
                var item = this.entitiesData[i];
                window.allKADDrawingsMap.set(item.name, JSON.parse(JSON.stringify(item.data)));
            }
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 11) AddKADVertexAction - Undo: remove vertex, Redo: add vertex back
class AddKADVertexAction extends UndoableAction {
    constructor(entityName, vertexData, vertexIndex) {
        super(ActionTypes.ADD_KAD_VERTEX, false, true);
        this.entityName = entityName;
        this.vertexData = JSON.parse(JSON.stringify(vertexData));
        this.vertexIndex = vertexIndex;
        this.pointID = vertexData.pointID;
        this.description = "Add vertex to '" + entityName + "'";
    }
    
    execute() {
        if (window.allKADDrawingsMap) {
            var entity = window.allKADDrawingsMap.get(this.entityName);
            
            // Step #) If entity doesn't exist (was deleted), recreate it
            if (!entity) {
                entity = {
                    entityName: this.entityName,
                    entityType: this.vertexData.entityType || "line",
                    data: [],
                    visible: true
                };
                window.allKADDrawingsMap.set(this.entityName, entity);
            }
            
            if (entity && entity.data) {
                var vertex = JSON.parse(JSON.stringify(this.vertexData));
                if (this.vertexIndex !== undefined && this.vertexIndex < entity.data.length) {
                    entity.data.splice(this.vertexIndex, 0, vertex);
                } else {
                    entity.data.push(vertex);
                }
            }
        }
    }
    
    undo() {
        if (window.allKADDrawingsMap) {
            var entity = window.allKADDrawingsMap.get(this.entityName);
            if (entity && entity.data) {
                var index = entity.data.findIndex(function(v) {
                    return v.pointID === this.pointID;
                }.bind(this));
                if (index !== -1) {
                    entity.data.splice(index, 1);
                    
                    // Step #) If entity is now empty, delete it
                    if (entity.data.length === 0) {
                        window.allKADDrawingsMap.delete(this.entityName);
                    }
                }
            }
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 12) DeleteKADVertexAction - Undo: restore vertex, Redo: delete again
class DeleteKADVertexAction extends UndoableAction {
    constructor(entityName, vertexData, vertexIndex) {
        super(ActionTypes.DELETE_KAD_VERTEX, false, true);
        this.entityName = entityName;
        this.vertexData = JSON.parse(JSON.stringify(vertexData));
        this.vertexIndex = vertexIndex;
        this.pointID = vertexData.pointID;
        this.description = "Delete vertex from '" + entityName + "'";
    }
    
    execute() {
        if (window.allKADDrawingsMap) {
            var entity = window.allKADDrawingsMap.get(this.entityName);
            if (entity && entity.data) {
                var index = entity.data.findIndex(function(v) {
                    return v.pointID === this.pointID;
                }.bind(this));
                if (index !== -1) {
                    entity.data.splice(index, 1);
                }
            }
        }
    }
    
    undo() {
        if (window.allKADDrawingsMap) {
            var entity = window.allKADDrawingsMap.get(this.entityName);
            
            // Step #) If entity doesn't exist (was deleted when empty), recreate it
            if (!entity) {
                entity = {
                    entityName: this.entityName,
                    entityType: this.vertexData.entityType || "line",
                    data: [],
                    visible: true
                };
                window.allKADDrawingsMap.set(this.entityName, entity);
            }
            
            if (entity && entity.data) {
                var vertex = JSON.parse(JSON.stringify(this.vertexData));
                if (this.vertexIndex !== undefined && this.vertexIndex <= entity.data.length) {
                    entity.data.splice(this.vertexIndex, 0, vertex);
                } else {
                    entity.data.push(vertex);
                }
            }
        }
    }
    
    redo() {
        this.execute();
    }
}

// Step 13) MoveKADVertexAction - Undo: restore original position, Redo: apply new position
class MoveKADVertexAction extends UndoableAction {
    constructor(entityName, pointID, originalPosition, newPosition) {
        super(ActionTypes.MOVE_KAD_VERTEX, false, true);
        this.entityName = entityName;
        this.pointID = pointID;
        this.originalPosition = JSON.parse(JSON.stringify(originalPosition));
        this.newPosition = JSON.parse(JSON.stringify(newPosition));
        this.description = "Move vertex in '" + entityName + "'";
    }
    
    execute() {
        this._applyPosition(this.newPosition);
    }
    
    undo() {
        this._applyPosition(this.originalPosition);
    }
    
    redo() {
        this._applyPosition(this.newPosition);
    }
    
    _applyPosition(position) {
        if (window.allKADDrawingsMap) {
            var entity = window.allKADDrawingsMap.get(this.entityName);
            if (entity && entity.data) {
                var vertex = entity.data.find(function(v) {
                    return v.pointID === this.pointID;
                }.bind(this));
                
                if (vertex) {
                    if (position.pointXLocation !== undefined) vertex.pointXLocation = position.pointXLocation;
                    if (position.pointYLocation !== undefined) vertex.pointYLocation = position.pointYLocation;
                    if (position.pointZLocation !== undefined) vertex.pointZLocation = position.pointZLocation;
                }
            }
        }
    }
}

// Step 14) MoveMultipleKADVerticesAction - For moving multiple vertices at once
class MoveMultipleKADVerticesAction extends UndoableAction {
    constructor(moveData) {
        super(ActionTypes.MOVE_KAD_VERTEX, false, true);
        // moveData is array of { entityName, pointID, originalPosition, newPosition }
        this.moveData = moveData.map(function(m) {
            return {
                entityName: m.entityName,
                pointID: m.pointID,
                originalPosition: JSON.parse(JSON.stringify(m.originalPosition)),
                newPosition: JSON.parse(JSON.stringify(m.newPosition))
            };
        });
        this.description = "Move " + this.moveData.length + " vertices";
    }
    
    execute() {
        for (var i = 0; i < this.moveData.length; i++) {
            this._applyPosition(this.moveData[i], this.moveData[i].newPosition);
        }
    }
    
    undo() {
        for (var i = 0; i < this.moveData.length; i++) {
            this._applyPosition(this.moveData[i], this.moveData[i].originalPosition);
        }
    }
    
    redo() {
        this.execute();
    }
    
    _applyPosition(moveItem, position) {
        if (window.allKADDrawingsMap) {
            var entity = window.allKADDrawingsMap.get(moveItem.entityName);
            if (entity && entity.data) {
                var vertex = entity.data.find(function(v) {
                    return v.pointID === moveItem.pointID;
                });
                
                if (vertex) {
                    if (position.pointXLocation !== undefined) vertex.pointXLocation = position.pointXLocation;
                    if (position.pointYLocation !== undefined) vertex.pointYLocation = position.pointYLocation;
                    if (position.pointZLocation !== undefined) vertex.pointZLocation = position.pointZLocation;
                }
            }
        }
    }
}

// Step 15) EditKADPropsAction - For editing KAD entity or vertex properties
class EditKADPropsAction extends UndoableAction {
    constructor(entityName, pointID, originalProps, newProps) {
        super(ActionTypes.EDIT_KAD_PROPS, false, true);
        this.entityName = entityName;
        this.pointID = pointID; // null if editing entity-level props
        this.originalProps = JSON.parse(JSON.stringify(originalProps));
        this.newProps = JSON.parse(JSON.stringify(newProps));
        this.description = pointID 
            ? "Edit vertex properties in '" + entityName + "'"
            : "Edit entity '" + entityName + "' properties";
    }
    
    execute() {
        this._applyProps(this.newProps);
    }
    
    undo() {
        this._applyProps(this.originalProps);
    }
    
    redo() {
        this._applyProps(this.newProps);
    }
    
    _applyProps(props) {
        if (window.allKADDrawingsMap) {
            var entity = window.allKADDrawingsMap.get(this.entityName);
            if (entity) {
                if (this.pointID !== null && entity.data) {
                    // Apply to specific vertex
                    var vertex = entity.data.find(function(v) {
                        return v.pointID === this.pointID;
                    }.bind(this));
                    
                    if (vertex) {
                        for (var key in props) {
                            if (props.hasOwnProperty(key)) {
                                vertex[key] = props[key];
                            }
                        }
                    }
                } else {
                    // Apply to entity level
                    for (var key in props) {
                        if (props.hasOwnProperty(key)) {
                            entity[key] = props[key];
                        }
                    }
                }
            }
        }
    }
}

// Step 16) Export all action classes
export {
    // Hole actions
    AddHoleAction,
    AddMultipleHolesAction,
    DeleteHoleAction,
    DeleteMultipleHolesAction,
    MoveHoleAction,
    MoveMultipleHolesAction,
    EditHolePropsAction,
    EditMultipleHolesPropsAction,
    
    // KAD actions
    AddKADEntityAction,
    AddMultipleKADEntitiesAction,
    DeleteKADEntityAction,
    DeleteMultipleKADEntitiesAction,
    AddKADVertexAction,
    DeleteKADVertexAction,
    MoveKADVertexAction,
    MoveMultipleKADVerticesAction,
    EditKADPropsAction
};
