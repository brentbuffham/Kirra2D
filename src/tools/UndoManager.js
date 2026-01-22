/**
 * UndoManager.js
 * Manages undo/redo operations for Kirra2D using the Command Pattern
 * Author: AI Assistant
 * Created: 2026-01-22
 * 
 * Supports:
 * - 20 levels of undo/redo (configurable)
 * - Batch operations for pattern generation
 * - Automatic UI state updates
 * - Integration with drawData, IndexedDB saves, and TreeView
 */

// Step 1) Define Action Types
var ActionTypes = {
    // Hole actions
    ADD_HOLE: "ADD_HOLE",
    DELETE_HOLE: "DELETE_HOLE",
    MOVE_HOLE: "MOVE_HOLE",
    EDIT_HOLE_PROPS: "EDIT_HOLE_PROPS",
    ADD_PATTERN: "ADD_PATTERN",
    
    // KAD actions
    ADD_KAD_ENTITY: "ADD_KAD_ENTITY",
    DELETE_KAD_ENTITY: "DELETE_KAD_ENTITY",
    ADD_KAD_VERTEX: "ADD_KAD_VERTEX",
    DELETE_KAD_VERTEX: "DELETE_KAD_VERTEX",
    MOVE_KAD_VERTEX: "MOVE_KAD_VERTEX",
    EDIT_KAD_PROPS: "EDIT_KAD_PROPS",
    
    // Batch action (wraps multiple actions)
    BATCH: "BATCH"
};

// Step 2) Define Base UndoableAction Class
class UndoableAction {
    constructor(type, affectsHoles, affectsKAD) {
        this.type = type;
        this.affectsHoles = affectsHoles || false;
        this.affectsKAD = affectsKAD || false;
        this.description = "";
        this.timestamp = Date.now();
    }
    
    // Step 3) Execute the action (called when action is first performed)
    execute() {
        throw new Error("execute() must be implemented by subclass");
    }
    
    // Step 4) Undo the action
    undo() {
        throw new Error("undo() must be implemented by subclass");
    }
    
    // Step 5) Redo the action
    redo() {
        // Default implementation is same as execute
        this.execute();
    }
    
    // Step 6) Refresh the UI after undo/redo
    refresh() {
        // Step 6a) Mark 3D scene for rebuild
        window.threeDataNeedsRebuild = true;
        
        // Step 6b) Redraw canvas (2D and 3D)
        if (window.drawData) {
            window.drawData(window.allBlastHoles, window.selectedHole);
        }
        
        // Step 6c) Save to IndexedDB
        if (this.affectsHoles && window.debouncedSaveHoles) {
            window.debouncedSaveHoles();
        }
        if (this.affectsKAD && window.debouncedSaveKAD) {
            window.debouncedSaveKAD();
        }
        
        // Step 6d) Update TreeView
        if (window.debouncedUpdateTreeView) {
            window.debouncedUpdateTreeView();
        } else if (window.updateTreeView) {
            window.updateTreeView();
        }
    }
    
    // Step 7) Get a human-readable description
    getDescription() {
        return this.description || this.type;
    }
}

// Step 8) Define Batch Action for grouping multiple actions
class BatchAction extends UndoableAction {
    constructor(description) {
        super(ActionTypes.BATCH, false, false);
        this.description = description || "Batch Operation";
        this.actions = [];
    }
    
    // Step 9) Add an action to the batch
    addAction(action) {
        this.actions.push(action);
        // Update affectsHoles/affectsKAD based on contained actions
        if (action.affectsHoles) this.affectsHoles = true;
        if (action.affectsKAD) this.affectsKAD = true;
    }
    
    // Step 10) Execute all actions in the batch
    execute() {
        for (var i = 0; i < this.actions.length; i++) {
            this.actions[i].execute();
        }
    }
    
    // Step 11) Undo all actions in reverse order
    undo() {
        for (var i = this.actions.length - 1; i >= 0; i--) {
            this.actions[i].undo();
        }
    }
    
    // Step 12) Redo all actions in original order
    redo() {
        for (var i = 0; i < this.actions.length; i++) {
            this.actions[i].redo();
        }
    }
    
    // Step 13) Get count for description
    getDescription() {
        return this.description + " (" + this.actions.length + " items)";
    }
}

// Step 14) Define UndoManager Class
class UndoManager {
    constructor(options) {
        options = options || {};
        
        // Step 15) Initialize stacks and settings
        this.maxUndoLevels = options.maxLevels || 20;
        this.undoStack = [];
        this.redoStack = [];
        
        // Step 16) Batch tracking
        this.currentBatch = null;
        this.batchDepth = 0;
        
        // Step 17) UI callback
        this.onStateChange = options.onStateChange || null;
        
        // Step 18) Status message callback
        this.onStatusMessage = options.onStatusMessage || null;
        
        console.log("UndoManager initialized with " + this.maxUndoLevels + " undo levels");
    }
    
    // Step 19) Execute an action and add to undo stack
    execute(action) {
        // Step 19a) If in batch mode, add to batch instead
        if (this.currentBatch) {
            this.currentBatch.addAction(action);
            return;
        }
        
        // Step 19b) Execute the action
        action.execute();
        
        // Step 19c) Add to undo stack
        this.undoStack.push(action);
        
        // Step 19d) Clear redo stack (new action invalidates redo history)
        this.redoStack = [];
        
        // Step 19e) Trim stack if exceeds max levels
        while (this.undoStack.length > this.maxUndoLevels) {
            this.undoStack.shift();
        }
        
        // Step 19f) Refresh UI after action
        action.refresh();
        
        // Step 19g) Update button states
        this.updateButtonStates();
        
        console.log("UndoManager: Executed action - " + action.getDescription() + " (undo stack: " + this.undoStack.length + ")");
    }
    
    // Step 20) Add action to undo stack without executing (for wrapping existing operations)
    pushAction(action) {
        // Step 20a) If in batch mode, add to batch instead
        if (this.currentBatch) {
            this.currentBatch.addAction(action);
            return;
        }
        
        // Step 20b) Add to undo stack
        this.undoStack.push(action);
        
        // Step 20c) Clear redo stack
        this.redoStack = [];
        
        // Step 20d) Trim stack if exceeds max levels
        while (this.undoStack.length > this.maxUndoLevels) {
            this.undoStack.shift();
        }
        
        // Step 20e) Update button states
        this.updateButtonStates();
        
        console.log("UndoManager: Pushed action - " + action.getDescription() + " (undo stack: " + this.undoStack.length + ")");
    }
    
    // Step 21) Undo the last action
    undo() {
        if (!this.canUndo()) {
            console.log("UndoManager: Nothing to undo");
            if (this.onStatusMessage) {
                this.onStatusMessage("Nothing to undo");
            }
            return false;
        }
        
        // Step 21a) Pop from undo stack
        var action = this.undoStack.pop();
        
        // Step 21b) Undo the action
        action.undo();
        
        // Step 21c) Push to redo stack
        this.redoStack.push(action);
        
        // Step 21d) Refresh UI after undo
        action.refresh();
        
        // Step 21e) Update button states
        this.updateButtonStates();
        
        // Step 21f) Show status message
        var message = "Undid: " + action.getDescription() + " (" + this.undoStack.length + " remaining)";
        console.log("UndoManager: " + message);
        if (this.onStatusMessage) {
            this.onStatusMessage(message);
        }
        
        return true;
    }
    
    // Step 22) Redo the last undone action
    redo() {
        if (!this.canRedo()) {
            console.log("UndoManager: Nothing to redo");
            if (this.onStatusMessage) {
                this.onStatusMessage("Nothing to redo");
            }
            return false;
        }
        
        // Step 22a) Pop from redo stack
        var action = this.redoStack.pop();
        
        // Step 22b) Redo the action
        action.redo();
        
        // Step 22c) Push back to undo stack
        this.undoStack.push(action);
        
        // Step 22d) Refresh UI after redo
        action.refresh();
        
        // Step 22e) Update button states
        this.updateButtonStates();
        
        // Step 22f) Show status message
        var message = "Redid: " + action.getDescription() + " (" + this.redoStack.length + " redo remaining)";
        console.log("UndoManager: " + message);
        if (this.onStatusMessage) {
            this.onStatusMessage(message);
        }
        
        return true;
    }
    
    // Step 23) Check if undo is available
    canUndo() {
        return this.undoStack.length > 0;
    }
    
    // Step 24) Check if redo is available
    canRedo() {
        return this.redoStack.length > 0;
    }
    
    // Step 25) Get undo count
    getUndoCount() {
        return this.undoStack.length;
    }
    
    // Step 26) Get redo count
    getRedoCount() {
        return this.redoStack.length;
    }
    
    // Step 27) Clear all history
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentBatch = null;
        this.batchDepth = 0;
        this.updateButtonStates();
        console.log("UndoManager: History cleared");
    }
    
    // Step 28) Begin a batch operation
    beginBatch(description) {
        this.batchDepth++;
        
        // Step 28a) Only create batch on first level
        if (this.batchDepth === 1) {
            this.currentBatch = new BatchAction(description);
            console.log("UndoManager: Begin batch - " + description);
        }
    }
    
    // Step 29) End a batch operation
    endBatch() {
        if (this.batchDepth <= 0) {
            console.warn("UndoManager: endBatch called without matching beginBatch");
            return;
        }
        
        this.batchDepth--;
        
        // Step 29a) Only finalize batch on last level
        if (this.batchDepth === 0 && this.currentBatch) {
            // Step 29b) Only add batch if it has actions
            if (this.currentBatch.actions.length > 0) {
                // Step 29c) Add batch to undo stack
                this.undoStack.push(this.currentBatch);
                
                // Step 29d) Clear redo stack
                this.redoStack = [];
                
                // Step 29e) Trim stack if needed
                while (this.undoStack.length > this.maxUndoLevels) {
                    this.undoStack.shift();
                }
                
                console.log("UndoManager: End batch - " + this.currentBatch.getDescription());
            } else {
                console.log("UndoManager: End batch - empty batch discarded");
            }
            
            this.currentBatch = null;
            
            // Step 29f) Update button states
            this.updateButtonStates();
        }
    }
    
    // Step 30) Cancel current batch (discard without adding to undo stack)
    cancelBatch() {
        if (this.currentBatch) {
            console.log("UndoManager: Batch cancelled - " + this.currentBatch.description);
            this.currentBatch = null;
            this.batchDepth = 0;
        }
    }
    
    // Step 31) Check if currently in batch mode
    isInBatch() {
        return this.currentBatch !== null;
    }
    
    // Step 32) Update UI button states
    updateButtonStates() {
        // Step 32a) Update undo button
        var undoBtn = document.getElementById("undoBtn");
        if (undoBtn) {
            undoBtn.disabled = !this.canUndo();
            var undoCount = this.getUndoCount();
            undoBtn.title = this.canUndo() 
                ? "Undo (Ctrl+Z) - " + undoCount + " action" + (undoCount !== 1 ? "s" : "") 
                : "Undo (Ctrl+Z) - Nothing to undo";
        }
        
        // Step 32b) Update redo button
        var redoBtn = document.getElementById("redoBtn");
        if (redoBtn) {
            redoBtn.disabled = !this.canRedo();
            var redoCount = this.getRedoCount();
            redoBtn.title = this.canRedo() 
                ? "Redo (Ctrl+Y) - " + redoCount + " action" + (redoCount !== 1 ? "s" : "") 
                : "Redo (Ctrl+Y) - Nothing to redo";
        }
        
        // Step 32c) Call state change callback if provided
        if (this.onStateChange) {
            this.onStateChange({
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                undoCount: this.getUndoCount(),
                redoCount: this.getRedoCount()
            });
        }
    }
    
    // Step 33) Get last action description (for UI display)
    getLastActionDescription() {
        if (this.undoStack.length > 0) {
            return this.undoStack[this.undoStack.length - 1].getDescription();
        }
        return null;
    }
    
    // Step 34) Get next redo action description (for UI display)
    getNextRedoDescription() {
        if (this.redoStack.length > 0) {
            return this.redoStack[this.redoStack.length - 1].getDescription();
        }
        return null;
    }
}

// Step 35) Export classes
export { 
    UndoManager, 
    UndoableAction, 
    BatchAction, 
    ActionTypes 
};

// Step 36) Export default
export default UndoManager;
