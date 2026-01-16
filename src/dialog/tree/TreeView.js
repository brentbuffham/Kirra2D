/* prettier-ignore-file */
//=================================================
// TreeView.js - Tree View Panel for Data Explorer
//=================================================
// Manages hierarchical display of blast data, drawings, surfaces, and images

// PERFORMANCE FIX 2025-12-28: Chunked loading constants for KAD drawings
const TREE_CHUNK_SIZE = 50;       // Points per chunk group
const TREE_CHUNK_THRESHOLD = 20;  // Only chunk if more than this many points

export class TreeView {
	constructor(containerId) {
		this.container = document.getElementById(containerId);
		this.selectedNodes = new Set();
		this.expandedNodes = new Set();
		this.loadedChunks = new Set();  // PERFORMANCE FIX: Track loaded lazy chunks
		this.dragData = {
			isDragging: false,
			startX: 0,
			startY: 0,
		};
		this.isCollapsed = false;
		this.isSyncing = false; // Flag to prevent infinite loops

		this.init();
	}

	init() {
		this.setupEventListeners();
		this.updateTreeData();
	}

	setupEventListeners() {
		// Panel dragging
		const header = document.getElementById("treePanelHeader");
		header.addEventListener("mousedown", this.startDrag.bind(this));

		// Panel controls
		document.getElementById("treeCollapseBtn").addEventListener("click", this.toggleCollapse.bind(this));
		document.getElementById("treeCloseBtn").addEventListener("click", this.hide.bind(this));

		// Tree interactions
		const treeView = document.getElementById("treeView");
		treeView.addEventListener("click", this.handleTreeClick.bind(this));
		treeView.addEventListener("contextmenu", this.handleContextMenu.bind(this));

		// Context menu
		document.getElementById("treeContextMenu").style.display = "none";
		const contextMenu = document.getElementById("treeContextMenu");
		contextMenu.addEventListener("click", this.handleContextAction.bind(this));

		// Hide context menu on outside click
		document.addEventListener("click", this.hideContextMenu.bind(this));

		// Keyboard shortcuts
		document.addEventListener("keydown", this.handleKeyboard.bind(this));

		// Color swatch event delegation
		this.container.addEventListener("click", (e) => {
			if (e.target.classList.contains("color-swatch")) {
				e.stopPropagation();

				const entityName = e.target.dataset.entityName;
				const pointID = parseInt(e.target.dataset.pointId);

				if (entityName && !isNaN(pointID) && typeof window.openColorPickerForElement === "function") {
					window.openColorPickerForElement(e.target, entityName, pointID);
				}
			}
		});
	}

	selectRange(startNodeId, endNodeId) {
		const allTreeItems = Array.from(this.container.querySelectorAll(".tree-item"));
		const allNodeIds = allTreeItems.map((item) => item.dataset.nodeId);

		const startIndex = allNodeIds.indexOf(startNodeId);
		const endIndex = allNodeIds.indexOf(endNodeId);

		if (startIndex === -1 || endIndex === -1) return;

		const minIndex = Math.min(startIndex, endIndex);
		const maxIndex = Math.max(startIndex, endIndex);

		this.clearSelection();

		for (let i = minIndex; i <= maxIndex; i++) {
			const nodeId = allNodeIds[i];
			const treeItem = allTreeItems[i];

			this.selectedNodes.add(nodeId);
			treeItem.classList.add("multi-selected");
		}
	}

	clearSelection() {
		this.selectedNodes.clear();
		this.container.querySelectorAll(".tree-item").forEach((item) => {
			item.classList.remove("selected", "multi-selected");
		});
	}

	startDrag(e) {
		this.dragData.isDragging = true;
		this.dragData.startX = e.clientX - this.container.offsetLeft;
		this.dragData.startY = e.clientY - this.container.offsetTop;

		document.addEventListener("mousemove", this.drag.bind(this));
		document.addEventListener("mouseup", this.stopDrag.bind(this));
		e.preventDefault();
	}

	drag(e) {
		if (!this.dragData.isDragging) return;

		const x = e.clientX - this.dragData.startX;
		const y = e.clientY - this.dragData.startY;

		this.container.style.left = x + "px";
		this.container.style.top = y + "px";
	}

	stopDrag() {
		this.dragData.isDragging = false;
		document.removeEventListener("mousemove", this.drag);
		document.removeEventListener("mouseup", this.stopDrag);
	}

	toggleCollapse() {
		this.isCollapsed = !this.isCollapsed;
		this.container.classList.toggle("collapsed", this.isCollapsed);

		const btn = document.getElementById("treeCollapseBtn");
		btn.textContent = this.isCollapsed ? "+" : "−";
	}

	hide() {
		this.container.style.display = "none";
	}

	show() {
		this.container.style.display = "flex";

		// PERFORMANCE FIX 2025-12-28: Update tree if it was deferred while hidden
		if (window._treeNeedsUpdate) {
			window._treeNeedsUpdate = false;
			setTimeout(() => this.updateTreeData(), 50);
		}
	}

	// Step 1) BUG FIX 4: Fix individual hole highlighting with correct node ID format
	// Node ID format: "hole⣿entityName⣿holeID" (3 parts)
	highlightNodes(nodeIds) {
		this.isSyncing = true;
		this.clearSelection();

		nodeIds.forEach((nodeId) => {
			const element = this.container.querySelector("[data-node-id=\"" + nodeId + "\"]");
			if (element) {
				this.selectedNodes.add(nodeId);
				element.classList.add("selected");

				// Auto-expand parent if collapsed
				this.ensureNodeVisible(nodeId);
			}
		});

		this.isSyncing = false;
	}

	// Step 2) Ensure node is visible (expand parents if needed)
	ensureNodeVisible(nodeId) {
		const element = this.container.querySelector("[data-node-id=\"" + nodeId + "\"]");
		if (!element) return;

		// Find parent nodes and expand them
		let parent = element.parentElement;
		while (parent && parent !== this.container) {
			if (parent.classList.contains("tree-children")) {
				parent.classList.add("expanded");
				// Find the parent tree-item
				const parentItem = parent.previousElementSibling;
				if (parentItem && parentItem.classList.contains("tree-item")) {
					const parentNodeId = parentItem.dataset.nodeId;
					if (parentNodeId) {
						this.expandedNodes.add(parentNodeId);
						const expandBtn = parentItem.querySelector(".tree-expand");
						if (expandBtn) expandBtn.classList.add("expanded");
					}
				}
			}
			parent = parent.parentElement;
		}
	}

	handleTreeClick(e) {
		const treeItem = e.target.closest(".tree-item");
		if (!treeItem) return;

		const expandBtn = e.target.closest(".tree-expand");
		if (expandBtn && !expandBtn.classList.contains("leaf")) {
			this.toggleNode(treeItem);
			return;
		}

		const nodeId = treeItem.dataset.nodeId;

		if (e.shiftKey && this.lastClickedNode) {
			this.selectRange(this.lastClickedNode, nodeId);
		} else if (e.ctrlKey || e.metaKey) {
			if (this.selectedNodes.has(nodeId)) {
				this.selectedNodes.delete(nodeId);
				treeItem.classList.remove("selected", "multi-selected");
			} else {
				this.selectedNodes.add(nodeId);
				treeItem.classList.add("multi-selected");
			}
			this.lastClickedNode = nodeId;
		} else {
			this.clearSelection();
			this.selectedNodes.add(nodeId);
			treeItem.classList.add("selected");
			this.lastClickedNode = nodeId;
		}

		this.onSelectionChange();
	}

	toggleNode(treeItem) {
		const nodeId = treeItem.dataset.nodeId;
		const children = treeItem.parentNode.querySelector(".tree-children");
		const expandBtn = treeItem.querySelector(".tree-expand");

		if (!children) return;

		// PERFORMANCE FIX 2025-12-28: Check if this is a lazy entity that needs loading
		// Entity nodes: "line⣿entityName", "poly⣿entityName", "points⣿entityName", etc.
		var isEntityNode = (nodeId.startsWith("line⣿") || nodeId.startsWith("poly⣿") || 
			nodeId.startsWith("points⣿") || nodeId.startsWith("circle⣿") || nodeId.startsWith("text⣿")) &&
			nodeId.split("⣿").length === 2;  // Only 2 parts = entity level
		
		if (isEntityNode && !this.loadedChunks.has(nodeId)) {
			this.loadEntityChildren(nodeId, treeItem, children);
		}

		// PERFORMANCE FIX 2025-12-28: Check if this is a lazy chunk that needs loading
		if (nodeId.includes("⣿chunk⣿") && !this.loadedChunks.has(nodeId)) {
			this.loadChunkChildren(nodeId, treeItem, children);
		}

		if (this.expandedNodes.has(nodeId)) {
			this.expandedNodes.delete(nodeId);
			children.classList.remove("expanded");
			expandBtn.classList.remove("expanded");
		} else {
			this.expandedNodes.add(nodeId);
			children.classList.add("expanded");
			expandBtn.classList.add("expanded");
		}
	}

	// PERFORMANCE FIX 2025-12-28: Lazy load entity children when expanded
	loadEntityChildren(nodeId, treeItem, childrenContainer) {
		// Parse entity node ID format: "entityType⣿entityName"
		var parts = nodeId.split("⣿");
		if (parts.length < 2) return;

		var entityTypePrefix = parts[0];  // "line", "poly", "points", "circle", "text"
		var entityName = parts[1];

		// Map prefix to actual entity type
		var entityType = entityTypePrefix;
		if (entityTypePrefix === "points") entityType = "point";

		var entity = window.allKADDrawingsMap ? window.allKADDrawingsMap.get(entityName) : null;
		if (!entity || !entity.data) return;

		var pointCount = entity.data.length;
		console.log("📁 Loading entity: " + entityName + " (" + pointCount + " points)");

		var elementChildren;
		if (pointCount > TREE_CHUNK_THRESHOLD) {
			// Large entity - create chunked placeholder nodes
			elementChildren = this.createChunkedChildren(entity, entityName);
		} else {
			// Small entity - create all children directly
			elementChildren = [];
			for (var i = 0; i < entity.data.length; i++) {
				var element = entity.data[i];
				var pointID = element.pointID || (i + 1);

				var label = "";
				var meta = "";
				if (entity.entityType === "text") {
					label = element.text || "Text " + pointID;
					meta = "(" + (Number(element.pointXLocation) || 0).toFixed(1) + "," + (Number(element.pointYLocation) || 0).toFixed(1) + ")";
				} else if (entity.entityType === "circle") {
					label = "Circle " + pointID;
					meta = "R:" + (Number(element.radius) || 0).toFixed(1);
				} else {
					label = "Point " + pointID;
					meta = "(" + (Number(element.pointXLocation) || 0).toFixed(1) + "," + (Number(element.pointYLocation) || 0).toFixed(1) + "," + (Number(element.pointZLocation) || 0).toFixed(1) + ")";
				}

				elementChildren.push({
					id: entity.entityType + "⣿" + entityName + "⣿element⣿" + pointID,
					type: entity.entityType + "⣿element",
					label: label,
					meta: meta,
					elementData: {
						...element,
						entityName: entityName
					}
				});
			}
		}

		// Render entity children HTML
		var html = this.renderTree(elementChildren, 0);
		childrenContainer.innerHTML = html;

		// Mark as loaded
		this.loadedChunks.add(nodeId);
		console.log("✅ Loaded entity children: " + elementChildren.length + " items");
	}

	// PERFORMANCE FIX 2025-12-28: Create chunked placeholder nodes for large entities
	createChunkedChildren(entity, entityName) {
		var chunks = [];
		var totalPoints = entity.data ? entity.data.length : 0;
		var entityType = entity.entityType;

		for (var i = 0; i < totalPoints; i += TREE_CHUNK_SIZE) {
			var start = i + 1;  // 1-based for display
			var end = Math.min(i + TREE_CHUNK_SIZE, totalPoints);
			var chunkPointCount = end - start + 1;

			chunks.push({
				id: entityType + "⣿" + entityName + "⣿chunk⣿" + start + "-" + end,
				type: "point-chunk",
				label: "Points " + start + "-" + end,
				meta: "(" + chunkPointCount + " points)",
				isLazyChunk: true,
				children: []  // Empty - will be populated on expand
			});
		}

		console.log("📦 Created " + chunks.length + " chunks for " + entityName + " (" + totalPoints + " points)");
		return chunks;
	}

	// PERFORMANCE FIX 2025-12-28: Lazy load chunk children when expanded
	loadChunkChildren(nodeId, treeItem, childrenContainer) {
		// Parse chunk node ID format: "entityType⣿entityName⣿chunk⣿startIdx-endIdx"
		var parts = nodeId.split("⣿");
		if (parts.length < 4) return;

		var entityType = parts[0];
		var entityName = parts[1];
		var rangeStr = parts[3];
		var rangeParts = rangeStr.split("-");
		var startIdx = parseInt(rangeParts[0]) - 1;  // Convert to 0-based
		var endIdx = parseInt(rangeParts[1]) - 1;

		var entity = window.allKADDrawingsMap ? window.allKADDrawingsMap.get(entityName) : null;
		if (!entity || !entity.data) return;

		console.log("📦 Loading chunk: " + entityName + " points " + (startIdx + 1) + "-" + (endIdx + 1));

		// Generate children for this chunk only
		var chunkChildren = [];
		for (var i = startIdx; i <= endIdx && i < entity.data.length; i++) {
			var element = entity.data[i];
			var pointID = element.pointID || (i + 1);

			var label = "";
			var meta = "";
			if (entityType === "text") {
				label = element.text || "Text " + pointID;
				meta = "(" + (Number(element.pointXLocation) || 0).toFixed(1) + "," + (Number(element.pointYLocation) || 0).toFixed(1) + ")";
			} else if (entityType === "circle") {
				label = "Circle " + pointID;
				meta = "R:" + (Number(element.radius) || 0).toFixed(1);
			} else {
				label = "Point " + pointID;
				meta = "(" + (Number(element.pointXLocation) || 0).toFixed(1) + "," + (Number(element.pointYLocation) || 0).toFixed(1) + "," + (Number(element.pointZLocation) || 0).toFixed(1) + ")";
			}

			chunkChildren.push({
				id: entityType + "⣿" + entityName + "⣿element⣿" + pointID,
				type: entityType + "⣿element",
				label: label,
				meta: meta,
				elementData: {
					...element,
					entityName: entityName
				}
			});
		}

		// Render chunk children HTML
		var html = this.renderTree(chunkChildren, 0);
		childrenContainer.innerHTML = html;

		// Mark as loaded
		this.loadedChunks.add(nodeId);
		console.log("✅ Loaded " + chunkChildren.length + " points for chunk");
	}

	handleContextMenu(e) {
		const treeItem = e.target.closest(".tree-item");
		if (!treeItem) return;

		e.preventDefault();

		const nodeId = treeItem.dataset.nodeId;
		if (!this.selectedNodes.has(nodeId)) {
			this.clearSelection();
			this.selectedNodes.add(nodeId);
			treeItem.classList.add("selected");
		}

		this.showContextMenu(e.clientX, e.clientY);
	}

	showContextMenu(x, y) {
		const menu = document.getElementById("treeContextMenu");
		const selectedNodeIds = Array.from(this.selectedNodes);
		const isTopLevelParent = selectedNodeIds.some((nodeId) => nodeId === "blast" || nodeId === "drawings" || nodeId === "surfaces" || nodeId === "images");
		const hasHoles = selectedNodeIds.some((nodeId) => nodeId.startsWith("hole⣿"));
		const isSubGroup = selectedNodeIds.some((nodeId) => nodeId.startsWith("drawings⣿") && nodeId.split("⣿").length === 2);
		// Step 276c) Check if any selected node is an entity node (line⣿name, poly⣿name, etc.) or chunk node
		const hasEntityOrChunk = selectedNodeIds.some((nodeId) => {
			const parts = nodeId.split("⣿");
			const isEntityNode = (parts[0] === "line" || parts[0] === "poly" || parts[0] === "points" || parts[0] === "circle" || parts[0] === "text") && parts.length === 2;
			const isChunkNode = parts.length === 4 && parts[2] === "chunk";
			return isEntityNode || isChunkNode;
		});
		
		// Step 4) Check if selection is a KAD layer (entity-level node like line⣿name, poly⣿name, etc.)
		const isKADLayer = selectedNodeIds.some((nodeId) => {
			const parts = nodeId.split("⣿");
			return (parts[0] === "line" || parts[0] === "poly" || parts[0] === "points" || parts[0] === "circle" || parts[0] === "text") && parts.length === 2;
		});
		
		// Step 5) Check if ALL selected nodes are KAD layers (for multi-layer operations)
		const allAreKADLayers = selectedNodeIds.length > 0 && selectedNodeIds.every((nodeId) => {
			const parts = nodeId.split("⣿");
			return (parts[0] === "line" || parts[0] === "poly" || parts[0] === "points" || parts[0] === "circle" || parts[0] === "text") && parts.length === 2;
		});
		
		const renameItem = menu.querySelector("[data-action=\"rename\"]");
		const resetConnectionsItem = menu.querySelector("[data-action=\"reset-connections\"]");
		const propertiesItem = menu.querySelector("[data-action=\"properties\"]");
		const deleteItem = menu.querySelector("[data-action=\"delete\"]");
		const hideItem = menu.querySelector("[data-action=\"hide\"]");
		const showItem = menu.querySelector("[data-action=\"show\"]");
		// Step 6) Get layer-specific menu items
		const showLayerItem = menu.querySelector("[data-action=\"show-layer\"]");
		const hideLayerItem = menu.querySelector("[data-action=\"hide-layer\"]");
		const deleteLayerItem = menu.querySelector("[data-action=\"delete-layer\"]");
		const layerSeparator = menu.querySelector(".layer-separator");

		if (resetConnectionsItem) {
			resetConnectionsItem.style.display = hasHoles ? "flex" : "none";
		}

		if (deleteItem) {
			deleteItem.style.display = isTopLevelParent || isSubGroup ? "none" : "flex";
		}

		// Step 7) Show/hide regular hide/show options (hide when layer options are shown)
		if (hideItem) {
			hideItem.style.display = isKADLayer ? "none" : "flex";
		}
		
		if (showItem) {
			showItem.style.display = isKADLayer ? "none" : "flex";
		}
		
		// Step 8) Show/hide layer-specific menu items (only for KAD layer nodes)
		if (showLayerItem) {
			showLayerItem.style.display = isKADLayer ? "flex" : "none";
		}
		
		if (hideLayerItem) {
			hideLayerItem.style.display = isKADLayer ? "flex" : "none";
		}
		
		if (deleteLayerItem) {
			deleteLayerItem.style.display = isKADLayer ? "flex" : "none";
		}
		
		if (layerSeparator) {
			layerSeparator.style.display = isKADLayer ? "block" : "none";
		}

		if (propertiesItem) {
			// Show properties for entity nodes, chunk nodes, and regular elements 
			// Hide only for top-level parents and subgroups that don't contain entity or chunk nodes
			propertiesItem.style.display = (isTopLevelParent || isSubGroup) && !hasEntityOrChunk ? "none" : "flex";  
		}

		let showRename = false;
		if (selectedNodeIds.length === 1) {
			const nodeId = selectedNodeIds[0];
			const parts = nodeId.split("⣿");
			if ((parts[0] === "points" || parts[0] === "line" || parts[0] === "poly" || parts[0] === "circle" || parts[0] === "text") && parts.length === 2) {
				showRename = true;
			}
			if (parts[0] === "entity" && parts.length === 2) {
				showRename = true;
			}
			if (parts[0] === "surface" && parts.length === 2) {
				showRename = true;
			}
			if (parts[0] === "image" && parts.length === 2) {
				showRename = true;
			}
			// Step 276a) Allow renaming individual holes (HoleID rename)
			// Node ID format: "hole⣿entityName⣿holeID"
			if (parts[0] === "hole" && parts.length === 3) {
				showRename = true;
			}
		}
		// Step 276b) Allow renaming when multiple holes are selected (BlastName reassignment)
		// Only show if ALL selected items are holes
		if (selectedNodeIds.length > 1) {
			const allAreHoles = selectedNodeIds.every((id) => id.startsWith("hole⣿"));
			if (allAreHoles) {
				showRename = true;
			}
		}

		if (renameItem) {
			renameItem.style.display = showRename ? "flex" : "none";
		}

		menu.style.left = x + "px";
		menu.style.top = y + "px";
		menu.style.display = "block";
	}

	hideContextMenu() {
		document.getElementById("treeContextMenu").style.display = "none";
	}

	handleContextAction(e) {
		const action = e.target.closest(".tree-context-item")?.dataset.action;
		if (!action) return;

		this.hideContextMenu();

		switch (action) {
			case "rename":
				this.renameEntity();
				break;
			case "delete":
				this.deleteSelected();
				break;
			case "hide":
				this.hideSelected();
				break;
			case "show":
				this.showSelected();
				break;
			case "reset-connections":
				this.resetConnections();
				break;
			case "properties":
				this.showProperties();
				break;
			// Step 9) Layer-specific actions for KAD entities
			case "show-layer":
				this.showLayerSelected();
				break;
			case "hide-layer":
				this.hideLayerSelected();
				break;
			case "delete-layer":
				this.deleteLayerSelected();
				break;
		}
		document.getElementById("treeContextMenu").style.display = "none";
	}

	// Methods that rely on global functions will be implemented
	// These need access to global state from kirra.js
	renumberSelected() {
		console.log("Renumber not yet implemented");
	}

	resetConnections() {
		if (this.selectedNodes.size === 0) return;

		const nodeIds = Array.from(this.selectedNodes);
		const holeNodeIds = nodeIds.filter((nodeId) => nodeId.startsWith("hole⣿"));

		if (holeNodeIds.length === 0) return;

		// Delegate to global functions
		if (typeof window.handleTreeViewResetConnections === "function") {
			window.handleTreeViewResetConnections(holeNodeIds);
		}
	}

	deleteSelected() {
		if (this.selectedNodes.size === 0) return;

		const nodeIds = Array.from(this.selectedNodes);

		// Delegate to global function
		if (typeof window.handleTreeViewDelete === "function") {
			window.handleTreeViewDelete(nodeIds, this);
		}
	}

	hideSelected() {
		this.selectedNodes.forEach((nodeId) => {
			const element = this.container.querySelector("[data-node-id=\"" + nodeId + "\"]");
			if (element) {
				element.style.opacity = "0.5";
				element.classList.add("hidden-node");

				const type = nodeId.split("⣿")[0];
				const itemId = nodeId.split("⣿").slice(1).join("⣿");

				// Step 1) Handle top-level nodes (hide all children)
				if (nodeId === "blast" || nodeId === "drawings" || nodeId === "surfaces" || nodeId === "images") {
					this.hideAllChildren(nodeId);
				}
				// Step 2) Handle subgroup nodes
				else if (nodeId.startsWith("drawings⣿")) {
					this.hideAllChildren(nodeId);
				}
				// Step 3) Handle individual items
				else if (typeof window.handleTreeViewVisibility === "function") {
					window.handleTreeViewVisibility(nodeId, type, itemId, false);
				}
			}
		});

		this.clearSelection();
		if (typeof window.updateTreeViewVisibilityStates === "function") {
			window.updateTreeViewVisibilityStates();
		}
	}

	showSelected() {
		this.selectedNodes.forEach((nodeId) => {
			const element = this.container.querySelector("[data-node-id=\"" + nodeId + "\"]");
			if (element) {
				element.style.opacity = "1";
				element.classList.remove("hidden-node");

				const type = nodeId.split("⣿")[0];
				const itemId = nodeId.split("⣿").slice(1).join("⣿");

				// Step 1) Handle top-level nodes (show all children)
				if (nodeId === "blast" || nodeId === "drawings" || nodeId === "surfaces" || nodeId === "images") {
					this.showAllChildren(nodeId);
				}
				// Step 2) Handle subgroup nodes
				else if (nodeId.startsWith("drawings⣿")) {
					this.showAllChildren(nodeId);
				}
				// Step 3) Handle individual items
				else if (typeof window.handleTreeViewVisibility === "function") {
					window.handleTreeViewVisibility(nodeId, type, itemId, true);
				}
			}
		});

		this.clearSelection();
		if (typeof window.updateTreeViewVisibilityStates === "function") {
			window.updateTreeViewVisibilityStates();
		}
	}

	// Step 10) Show Layer - Show selected KAD entity layers
	showLayerSelected() {
		this.selectedNodes.forEach((nodeId) => {
			const parts = nodeId.split("⣿");
			// Check if this is a KAD layer node (format: entityType⣿entityName)
			if ((parts[0] === "line" || parts[0] === "poly" || parts[0] === "points" || parts[0] === "circle" || parts[0] === "text") && parts.length === 2) {
				const entityName = parts[1];
				const entity = window.allKADDrawingsMap ? window.allKADDrawingsMap.get(entityName) : null;
				
				if (entity) {
					// Step 10a) Set entity visibility to true
					entity.visible = true;
					console.log("✅ [TreeView] Show layer: " + entityName);
					
					// Step 10b) Update tree view visual state
					const element = this.container.querySelector("[data-node-id=\"" + nodeId + "\"]");
					if (element) {
						element.style.opacity = "1";
						element.classList.remove("hidden-node");
					}
				}
			}
		});

		// Step 10c) Save changes and redraw
		if (typeof window.debouncedSaveKAD === "function") {
			window.debouncedSaveKAD();
		}
		
		this.clearSelection();
		
		if (typeof window.updateTreeViewVisibilityStates === "function") {
			window.updateTreeViewVisibilityStates();
		}
		
		if (typeof window.drawData === "function") {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}
	}

	// Step 11) Hide Layer - Hide selected KAD entity layers
	hideLayerSelected() {
		this.selectedNodes.forEach((nodeId) => {
			const parts = nodeId.split("⣿");
			// Check if this is a KAD layer node (format: entityType⣿entityName)
			if ((parts[0] === "line" || parts[0] === "poly" || parts[0] === "points" || parts[0] === "circle" || parts[0] === "text") && parts.length === 2) {
				const entityName = parts[1];
				const entity = window.allKADDrawingsMap ? window.allKADDrawingsMap.get(entityName) : null;
				
				if (entity) {
					// Step 11a) Set entity visibility to false
					entity.visible = false;
					console.log("✅ [TreeView] Hide layer: " + entityName);
					
					// Step 11b) Update tree view visual state
					const element = this.container.querySelector("[data-node-id=\"" + nodeId + "\"]");
					if (element) {
						element.style.opacity = "0.5";
						element.classList.add("hidden-node");
					}
				}
			}
		});

		// Step 11c) Save changes and redraw
		if (typeof window.debouncedSaveKAD === "function") {
			window.debouncedSaveKAD();
		}
		
		this.clearSelection();
		
		if (typeof window.updateTreeViewVisibilityStates === "function") {
			window.updateTreeViewVisibilityStates();
		}
		
		if (typeof window.drawData === "function") {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}
	}

	// Step 12) Delete Layer - Delete selected KAD entity layers
	deleteLayerSelected() {
		const layersToDelete = [];
		
		this.selectedNodes.forEach((nodeId) => {
			const parts = nodeId.split("⣿");
			// Check if this is a KAD layer node (format: entityType⣿entityName)
			if ((parts[0] === "line" || parts[0] === "poly" || parts[0] === "points" || parts[0] === "circle" || parts[0] === "text") && parts.length === 2) {
				const entityName = parts[1];
				layersToDelete.push(entityName);
			}
		});

		if (layersToDelete.length === 0) return;

		// Step 12a) Confirm deletion with user
		const layerCount = layersToDelete.length;
		const confirmMessage = layerCount === 1
			? "Are you sure you want to delete layer '" + layersToDelete[0] + "'?"
			: "Are you sure you want to delete " + layerCount + " layers?";

		if (typeof window.showConfirmationDialog === "function") {
			window.showConfirmationDialog(
				"Delete Layer" + (layerCount > 1 ? "s" : ""),
				confirmMessage,
				() => {
					this.performLayerDeletion(layersToDelete);
				},
				null
			);
		} else if (confirm(confirmMessage)) {
			this.performLayerDeletion(layersToDelete);
		}
	}

	// Step 13) Perform the actual layer deletion
	performLayerDeletion(layersToDelete) {
		layersToDelete.forEach((entityName) => {
			if (window.allKADDrawingsMap && window.allKADDrawingsMap.has(entityName)) {
				// Step 13a) Remove from map
				window.allKADDrawingsMap.delete(entityName);
				console.log("✅ [TreeView] Deleted layer: " + entityName);
			}
		});

		// Step 13b) Save changes
		if (typeof window.debouncedSaveKAD === "function") {
			window.debouncedSaveKAD();
		}

		// Step 13c) Update tree view
		this.clearSelection();
		this.updateTreeData();

		// Step 13d) Redraw canvas
		if (typeof window.drawData === "function") {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}

		console.log("✅ [TreeView] Layer deletion complete. Deleted " + layersToDelete.length + " layer(s).");
	}

	// Step 4) Add helper methods to hide/show all children recursively
	hideAllChildren(parentNodeId) {
		if (parentNodeId === "blast") {
			// Hide all blast entities and holes
			if (window.allBlastHoles) {
				window.allBlastHoles.forEach((hole) => {
					hole.visible = false;
				});
				if (typeof window.debouncedSaveHoles === "function") {
					window.debouncedSaveHoles();
				}
			}
			if (typeof window.setBlastGroupVisibility === "function") {
				window.setBlastGroupVisibility(false);
			}
		} else if (parentNodeId === "drawings") {
			// Hide all KAD entities
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					entity.visible = false;
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setDrawingsGroupVisibility === "function") {
				window.setDrawingsGroupVisibility(false);
			}
		} else if (parentNodeId === "surfaces") {
			// Hide all surfaces
			if (window.loadedSurfaces) {
				for (const [surfaceId, surface] of window.loadedSurfaces.entries()) {
					surface.visible = false;
				}
				if (typeof window.debouncedSaveSurfaces === "function") {
					window.debouncedSaveSurfaces();
				}
			}
			if (typeof window.setSurfacesGroupVisibility === "function") {
				window.setSurfacesGroupVisibility(false);
			}
		} else if (parentNodeId === "images") {
			// Hide all images
			if (window.loadedImages) {
				for (const [imageId, image] of window.loadedImages.entries()) {
					image.visible = false;
				}
				if (typeof window.debouncedSaveImages === "function") {
					window.debouncedSaveImages();
				}
			}
			if (typeof window.setImagesGroupVisibility === "function") {
				window.setImagesGroupVisibility(false);
			}
		} else if (parentNodeId === "drawings⣿points") {
			// Hide all point entities
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "point") {
						entity.visible = false;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setPointsGroupVisibility === "function") {
				window.setPointsGroupVisibility(false);
			}
		} else if (parentNodeId === "drawings⣿lines") {
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "line") {
						entity.visible = false;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setLinesGroupVisibility === "function") {
				window.setLinesGroupVisibility(false);
			}
		} else if (parentNodeId === "drawings⣿polygons") {
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "poly") {
						entity.visible = false;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setPolygonsGroupVisibility === "function") {
				window.setPolygonsGroupVisibility(false);
			}
		} else if (parentNodeId === "drawings⣿circles") {
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "circle") {
						entity.visible = false;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setCirclesGroupVisibility === "function") {
				window.setCirclesGroupVisibility(false);
			}
		} else if (parentNodeId === "drawings⣿texts") {
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "text") {
						entity.visible = false;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setTextsGroupVisibility === "function") {
				window.setTextsGroupVisibility(false);
			}
		}
	}

	showAllChildren(parentNodeId) {
		if (parentNodeId === "blast") {
			// Show all blast entities and holes
			if (window.allBlastHoles) {
				window.allBlastHoles.forEach((hole) => {
					hole.visible = true;
				});
				if (typeof window.debouncedSaveHoles === "function") {
					window.debouncedSaveHoles();
				}
			}
			if (typeof window.setBlastGroupVisibility === "function") {
				window.setBlastGroupVisibility(true);
			}
		} else if (parentNodeId === "drawings") {
			// Show all KAD entities
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					entity.visible = true;
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setDrawingsGroupVisibility === "function") {
				window.setDrawingsGroupVisibility(true);
			}
		} else if (parentNodeId === "surfaces") {
			// Show all surfaces
			if (window.loadedSurfaces) {
				for (const [surfaceId, surface] of window.loadedSurfaces.entries()) {
					surface.visible = true;
				}
				if (typeof window.debouncedSaveSurfaces === "function") {
					window.debouncedSaveSurfaces();
				}
			}
			if (typeof window.setSurfacesGroupVisibility === "function") {
				window.setSurfacesGroupVisibility(true);
			}
		} else if (parentNodeId === "images") {
			// Show all images
			if (window.loadedImages) {
				for (const [imageId, image] of window.loadedImages.entries()) {
					image.visible = true;
				}
				if (typeof window.debouncedSaveImages === "function") {
					window.debouncedSaveImages();
				}
			}
			if (typeof window.setImagesGroupVisibility === "function") {
				window.setImagesGroupVisibility(true);
			}
		} else if (parentNodeId === "drawings⣿points") {
			// Show all point entities
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "point") {
						entity.visible = true;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setPointsGroupVisibility === "function") {
				window.setPointsGroupVisibility(true);
			}
		} else if (parentNodeId === "drawings⣿lines") {
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "line") {
						entity.visible = true;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setLinesGroupVisibility === "function") {
				window.setLinesGroupVisibility(true);
			}
		} else if (parentNodeId === "drawings⣿polygons") {
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "poly") {
						entity.visible = true;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setPolygonsGroupVisibility === "function") {
				window.setPolygonsGroupVisibility(true);
			}
		} else if (parentNodeId === "drawings⣿circles") {
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "circle") {
						entity.visible = true;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setCirclesGroupVisibility === "function") {
				window.setCirclesGroupVisibility(true);
			}
		} else if (parentNodeId === "drawings⣿texts") {
			if (window.allKADDrawingsMap) {
				for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
					if (entity.entityType === "text") {
						entity.visible = true;
					}
				}
				if (typeof window.debouncedSaveKAD === "function") {
					window.debouncedSaveKAD();
				}
			}
			if (typeof window.setTextsGroupVisibility === "function") {
				window.setTextsGroupVisibility(true);
			}
		}
	}

	showProperties() {
		if (this.selectedNodes.size === 1) {
			// Single selection - use existing handler
			const nodeId = Array.from(this.selectedNodes)[0];
			const type = nodeId.split("⣿")[0];

			if (typeof window.handleTreeViewShowProperties === "function") {
				window.handleTreeViewShowProperties(nodeId, type);
			}
		} else if (this.selectedNodes.size > 1) {
			// Multiple selection - check if all are KAD entities/chunks/elements
			const selectedNodeIds = Array.from(this.selectedNodes);

			// Check if all selected nodes are KAD-related (entities, chunks, or elements)
			const allKAD = selectedNodeIds.every((nodeId) => {
				const parts = nodeId.split("⣿");
				return (parts[0] === "line" || parts[0] === "poly" || parts[0] === "points" ||
						parts[0] === "circle" || parts[0] === "text");
			});

			if (allKAD && window.selectedMultipleKADObjects && window.selectedMultipleKADObjects.length > 1) {
				// Show multiple KAD property editor
				if (typeof window.showMultipleKADPropertyEditor === "function") {
					window.showMultipleKADPropertyEditor(window.selectedMultipleKADObjects);
				}
			}
		}
	}

	handleKeyboard(e) {
		if (!this.container.style.display === "none") return;

		switch (e.key) {
			case "Delete":
				this.deleteSelected();
				break;
			case "Escape":
				this.clearSelection();
				break;
		}
	}

	updateTreeData() {
		var treePanel = document.getElementById("treePanel");
		var isPanelVisible = treePanel && treePanel.style.display !== "none";
		
		// Prevent concurrent updates
		if (this._isUpdating) {
			this._pendingUpdate = true;
			return;
		}

		// PERFORMANCE FIX 2025-12-28: Clear loaded chunks on tree rebuild
		this.loadedChunks.clear();

		// FIX: Always build tree data in background (even when panel hidden)
		// This ensures tree is cached and ready when user opens panel
		this.buildTreeDataAsync(isPanelVisible);
	}

	// PERFORMANCE FIX 2025-12-28: Async tree building with batching
	// FIX: Accept isPanelVisible parameter to control rendering
	async buildTreeDataAsync(isPanelVisible = true) {
		this._isUpdating = true;
		var startTime = Date.now();

		try {
			// Build in stages with yields
			var blastData = this.buildBlastData();
			await this.yieldToUI();

			var drawingData = this.buildDrawingData();

			await this.yieldToUI();

			var surfaceData = this.buildSurfaceData();
			var imageData = this.buildImageData();
			
			// Store tree data in cache even if panel is hidden
			this._cachedTreeData = {
				blastData: blastData,
				drawingData: drawingData,
				surfaceData: surfaceData,
				imageData: imageData
			};

			var tree = [
				{ id: "blast", type: "blast", label: "Blast", expanded: true, children: blastData },
				{ id: "drawings", type: "drawing", label: "Drawings", expanded: true, children: drawingData },
				{ id: "surfaces", type: "surface", label: "Surfaces", expanded: true, children: surfaceData },
				{ id: "images", type: "image", label: "Images", expanded: true, children: imageData }
			];

			await this.yieldToUI();

			// Only render HTML if panel is visible (or was just opened)
			if (isPanelVisible) {
				var html = this.renderTree(tree);
				var treeViewElement = document.getElementById("treeView");
				if (treeViewElement) {
					treeViewElement.innerHTML = html;
				}
			}

			var elapsed = Date.now() - startTime;
			if (elapsed > 100) {
				console.log("🌲 TreeView built in " + elapsed + "ms");
			}
		} finally {
			this._isUpdating = false;

			// Handle pending update if any
			if (this._pendingUpdate) {
				this._pendingUpdate = false;
				setTimeout(() => this.updateTreeData(), 100);
			}
		}
	}

	// Helper to yield to UI thread
	yieldToUI() {
		return new Promise(function(resolve) { setTimeout(resolve, 0); });
	}

	buildTreeData() {
		const tree = [
			{
				id: "blast",
				type: "blast",
				label: "Blast",
				expanded: true,
				children: this.buildBlastData(),
			},
			{
				id: "drawings",
				type: "drawing",
				label: "Drawings",
				expanded: true,
				children: this.buildDrawingData(),
			},
			{
				id: "surfaces",
				type: "surface",
				label: "Surfaces",
				expanded: true,
				children: this.buildSurfaceData(),
			},
			{
				id: "images",
				type: "image",
				label: "Images",
				expanded: true,
				children: this.buildImageData(),
			},
		];

		return tree;
	}

	buildBlastData() {
		if (!window.allBlastHoles || window.allBlastHoles.length === 0) return [];

		const entities = {};
		window.allBlastHoles.forEach((hole) => {
			const entityName = hole.entityName || "Unknown";
			if (!entities[entityName]) {
				entities[entityName] = [];
			}
			entities[entityName].push(hole);
		});

		return Object.keys(entities).map((entityName) => {
			const holes = entities[entityName];

			holes.sort((a, b) => {
				const aRow = a.rowID && a.rowID > 0 ? a.rowID : 999999;
				const bRow = b.rowID && b.rowID > 0 ? b.rowID : 999999;

				if (aRow !== bRow) {
					return aRow - bRow;
				}

				const aPos = a.posID && a.posID > 0 ? a.posID : 999999;
				const bPos = b.posID && b.posID > 0 ? b.posID : 999999;

				return aPos - bPos;
			});

			const totalLength = holes.reduce((sum, hole) => sum + (hole.holeLengthCalculated || 0), 0);
			const metrics = typeof window.getVoronoiMetrics === "function" ? window.getVoronoiMetrics(holes) : null;
			const volume = metrics && metrics.length > 0 ? metrics.reduce((sum, cell) => sum + (cell.volume || 0), 0) : 0;

			return {
				id: "entity⣿" + entityName,
				type: "entity",
				label: entityName,
				meta: "(" + holes.length + ", " + parseFloat(totalLength).toFixed(1) + "m, " + parseFloat(volume).toFixed(1) + "m³)",
				// BUG FIX 2025-12-28: Wrap all numeric properties with parseFloat() to handle string values
				children: holes.map((hole, index) => ({
					id: "hole⣿" + entityName + "⣿" + (hole.holeID || index),
					type: "hole",
					label: hole.holeID || "Hole " + (index + 1),
					meta: "L:" + parseFloat(hole.holeLengthCalculated || 0).toFixed(2) + "m, S:" + parseFloat(hole.subdrillAmount || 0).toFixed(2) + "m, R:" + (hole.rowID || 0) + ", P:" + (hole.posID || 0),
					children: [
						{
							id: (hole.holeID || index) + "⣿startx",
							type: "property",
							label: "Start X",
							meta: parseFloat(hole.startXLocation || 0).toFixed(3),
						},
						{
							id: (hole.holeID || index) + "⣿starty",
							type: "property",
							label: "Start Y",
							meta: parseFloat(hole.startYLocation || 0).toFixed(3),
						},
						{
							id: (hole.holeID || index) + "⣿startz",
							type: "property",
							label: "Start Z",
							meta: parseFloat(hole.startZLocation || 0).toFixed(3),
						},
						{
							id: (hole.holeID || index) + "⣿gradez",
							type: "property",
							label: "Grade Z",
							meta: parseFloat(hole.gradeZLocation || 0).toFixed(3),
						},
						{
							id: (hole.holeID || index) + "⣿diameter",
							type: "property",
							label: "Diameter",
							meta: parseFloat(hole.holeDiameter || 115) + "mm",
						},
						{
							id: (hole.holeID || index) + "⣿angle",
							type: "property",
							label: "Angle",
							meta: parseFloat(hole.holeAngle || 0).toFixed(0) + "°",
						},
						{
							id: (hole.holeID || index) + "⣿bearing",
							type: "property",
							label: "Bearing",
							meta: parseFloat(hole.holeBearing || 0).toFixed(2) + "°",
						},
						{
							id: (hole.holeID || index) + "⣿length",
							type: "property",
							label: "Length",
							meta: parseFloat(hole.holeLengthCalculated || 0).toFixed(2) + "m",
						},
						{
							id: (hole.holeID || index) + "⣿subdrill",
							type: "property",
							label: "Subdrill",
							meta: parseFloat(hole.subdrillAmount || 0).toFixed(2) + "m",
						},
						{
							id: (hole.holeID || index) + "⣿type",
							type: "property",
							label: "Hole Type",
							meta: hole.holeType || "Undefined",
						},
						{
							id: (hole.holeID || index) + "⣿rowid",
							type: "property",
							label: "Row ID",
							meta: hole.rowID || 0,
						},
						{
							id: (hole.holeID || index) + "⣿posid",
							type: "property",
							label: "Position ID",
							meta: hole.posID || 0,
						},
					],
				})),
			};
		});
	}

	buildDrawingData() {
		const drawingChildren = [];
		const pointsChildren = [];
		const linesChildren = [];
		const polysChildren = [];
		const circlesChildren = [];
		const textsChildren = [];

		// PERFORMANCE FIX 2025-12-28: Just create entity-level nodes with EMPTY children
		// Children will be loaded lazily when entity is expanded
		if (typeof window.allKADDrawingsMap !== "undefined" && window.allKADDrawingsMap && window.allKADDrawingsMap.size > 0) {
			// Pre-calculate entity counts for summary (fast)
			var entityTypes = { point: 0, line: 0, poly: 0, circle: 0, text: 0 };

			for (const [entityName, entity] of window.allKADDrawingsMap.entries()) {
				// PERFORMANCE: Minimize work per entity - just count and categorize
				var pointCount = entity.data ? entity.data.length : 0;
				var entityType = entity.entityType;
				entityTypes[entityType]++;

				// Create minimal entity node - will be lazy loaded
				var nodeId, nodeType;
				switch (entityType) {
					case "point":
						nodeId = "points⣿" + entityName;
						nodeType = "points-group";
						pointsChildren.push({ id: nodeId, type: nodeType, label: entityName, meta: "(" + pointCount + ")", children: [] });
						break;
					case "line":
						nodeId = "line⣿" + entityName;
						nodeType = "line-group";
						linesChildren.push({ id: nodeId, type: nodeType, label: entityName, meta: "(" + pointCount + ")", children: [] });
						break;
					case "poly":
						nodeId = "poly⣿" + entityName;
						nodeType = "polygon-group";
						polysChildren.push({ id: nodeId, type: nodeType, label: entityName, meta: "(" + pointCount + ")", children: [] });
						break;
					case "circle":
						nodeId = "circle⣿" + entityName;
						nodeType = "circle-group";
						circlesChildren.push({ id: nodeId, type: nodeType, label: entityName, meta: "(" + pointCount + ")", children: [] });
						break;
					case "text":
						nodeId = "text⣿" + entityName;
						nodeType = "text-group";
						textsChildren.push({ id: nodeId, type: nodeType, label: entityName, meta: "(" + pointCount + ")", children: [] });
						break;
				}
			}
		}

		if (pointsChildren.length > 0) {
			drawingChildren.push({
				id: "drawings⣿points",
				type: "points-folder",
				label: "Points",
				children: pointsChildren,
			});
		}

		if (linesChildren.length > 0) {
			drawingChildren.push({
				id: "drawings⣿lines",
				type: "lines-folder",
				label: "Lines",
				children: linesChildren,
			});
		}

		if (polysChildren.length > 0) {
			drawingChildren.push({
				id: "drawings⣿polygons",
				type: "polygons-folder",
				label: "Polygons",
				children: polysChildren,
			});
		}

		if (circlesChildren.length > 0) {
			drawingChildren.push({
				id: "drawings⣿circles",
				type: "circle-folder",
				label: "Circles",
				children: circlesChildren,
			});
		}

		if (textsChildren.length > 0) {
			drawingChildren.push({
				id: "drawings⣿texts",
				type: "text-folder",
				label: "Texts",
				children: textsChildren,
			});
		}

		return drawingChildren;
	}

	buildSurfaceData() {
		const surfaceChildren = [];

		if (window.loadedSurfaces) {
			window.loadedSurfaces.forEach((surface, surfaceId) => {
				surfaceChildren.push({
					id: "surface⣿" + surfaceId,
					type: "surface",
					label: surface.name,
					meta: "(" + (surface.points?.length || 0) + " points | " + (surface.triangles?.length || 0) + " triangles)",
				});
			});
		}

		return surfaceChildren;
	}

	buildImageData() {
		const imageChildren = [];

		if (window.loadedImages) {
			window.loadedImages.forEach((image, imageId) => {
				imageChildren.push({
					id: "image⣿" + imageId,
					type: "image",
					label: image.name,
					meta: image.size ? (image.size / (1024 * 1024)).toFixed(2) + " MB" : "Unknown size",
				});
			});
		}

		return imageChildren;
	}

	renderTree(nodes, level = 0) {
		return nodes
			.map((node) => {
				// Step 1) Check if node has children OR is an entity node that can be lazy-loaded
				var hasChildren = node.children && node.children.length > 0;
				// Entity nodes with empty children arrays should still show expand button for lazy loading
				var isEntityNode = (node.id && (node.id.startsWith("line⣿") || node.id.startsWith("poly⣿") || 
					node.id.startsWith("points⣿") || node.id.startsWith("circle⣿") || node.id.startsWith("text⣿")) &&
					node.id.split("⣿").length === 2);
				var isChunkNode = node.type === "point-chunk" || (node.id && node.id.includes("⣿chunk⣿"));
				var shouldShowExpand = hasChildren || isEntityNode || isChunkNode;
				
				const isExpanded = this.expandedNodes.has(node.id) || node.expanded;
				const isSelected = this.selectedNodes.has(node.id);

				let colorSwatchHtml = "";
				if (node.elementData && node.type.includes("⣿element")) {
					const color = node.elementData.color || "#777777";
					colorSwatchHtml = "<span class=\"color-swatch\" style=\"background-color: " + color + ";\" data-element-id=\"" + node.id + "\" data-entity-name=\"" + node.elementData.entityName + "\" data-point-id=\"" + node.elementData.pointID + "\"></span>";
				}

				let html = "<li class=\"tree-node\"><div class=\"tree-item " + (isSelected ? "selected" : "") + "\" data-node-id=\"" + node.id + "\"><span class=\"tree-expand " + (shouldShowExpand ? (isExpanded ? "expanded" : "") : "leaf") + "\"></span><span class=\"tree-icon " + node.type + "\"></span>" + colorSwatchHtml + "<span class=\"tree-label\">" + node.label + "</span>" + (node.meta ? "<span class=\"tree-meta\">" + node.meta + "</span>" : "") + "</div>";

				// Step 2) Always create children container for entity nodes (even if empty) for lazy loading
				if (shouldShowExpand) {
					html += "<ul class=\"tree-children " + (isExpanded ? "expanded" : "") + "\">";
					if (hasChildren) {
						html += this.renderTree(node.children, level + 1);
					}
					html += "</ul>";
				}

				html += "</li>";
				return html;
			})
			.join("");
	}

	// Step 3) BUG FIX 4 & 5: Fix onSelectionChange to handle individual holes and KAD vertices
	onSelectionChange() {
		if (this.isSyncing) return;

		// Clear canvas selections
		if (window.selectedMultipleHoles) window.selectedMultipleHoles.length = 0;
		if (window.selectedMultipleKADObjects) window.selectedMultipleKADObjects.length = 0;
		if (window.selectedMultiplePoints) window.selectedMultiplePoints = [];
		if (window.selectedHole) window.selectedHole = null;
		if (window.selectedKADObject) window.selectedKADObject = null;
		if (window.selectedPoint) window.selectedPoint = null;

		this.selectedNodes.forEach((nodeId) => {
			const parts = nodeId.split("⣿");

			// BUG FIX 4: Correct hole node ID parsing
			// Node ID format: "hole⣿entityName⣿holeID" (3 parts)
			if (parts[0] === "hole" && parts.length === 3) {
				const entityName = parts[1]; // Extract entityName
				const holeID = parts[2]; // Extract holeID
				const hole = window.allBlastHoles.find((h) => h.entityName === entityName && h.holeID === holeID);
				if (hole && window.selectedMultipleHoles) window.selectedMultipleHoles.push(hole);
			} else if (parts[0] === "entity") {
				// Blast entities
				const entityName = parts.slice(1).join("⣿");
				window.allBlastHoles.forEach((hole) => {
					if (hole.entityName === entityName && window.selectedMultipleHoles) {
						window.selectedMultipleHoles.push(hole);
					}
				});
			} else if (parts.length >= 4 && parts[2] === "element") {
				// BUG FIX 5: KAD vertex selection - Individual element selection
				// Node ID format: "entityType⣿entityName⣿element⣿pointID" (4 parts)
				const entityType = parts[0];
				const entityName = parts[1];
				const elementId = parts[3];

				const entity = window.allKADDrawingsMap.get(entityName);
				if (entity) {
					const element = entity.data.find((el) => el.pointID == elementId);
					if (element && window.selectedMultipleKADObjects) {
						const elementIndex = entity.data.indexOf(element);
						window.selectedMultipleKADObjects.push({
							entityName: entityName,
							entityType: entityType,
							elementIndex: elementIndex,
							selectionType: "vertex",
							pointID: elementId // Add pointID for easier reference
						});
					}
				}
			} else if (parts.length === 4 && parts[2] === "chunk") {
				// Chunk selection - Select all points in the chunk range
				// Node ID format: "entityType⣿entityName⣿chunk⣿1-50" (4 parts)
				const entityType = parts[0];
				const entityName = parts[1];
				const rangeStr = parts[3]; // e.g., "1-50"
				const rangeParts = rangeStr.split("-");
				const startIndex = parseInt(rangeParts[0]) - 1; // Convert to 0-based index
				const endIndex = parseInt(rangeParts[1]) - 1; // Convert to 0-based index

				const entity = window.allKADDrawingsMap.get(entityName);
				if (entity && entity.data && window.selectedMultipleKADObjects) {
					// Add all points in the chunk range as vertex selections
					for (let i = startIndex; i <= endIndex && i < entity.data.length; i++) {
						const element = entity.data[i];
						if (element) {
							window.selectedMultipleKADObjects.push({
								entityName: entityName,
								entityType: entityType,
								elementIndex: i,
								selectionType: "vertex",
								pointID: element.pointID
							});
						}
					}
				}
			} else if (["points", "line", "poly", "circle", "text"].includes(parts[0])) {
				// KAD entity-level selection
				const entityType = parts[0];
				const entityName = parts.slice(1).join("⣿");
				const entity = window.allKADDrawingsMap.get(entityName);
				if (entity && window.selectedMultipleKADObjects) {
					window.selectedMultipleKADObjects.push({
						entityName: entityName,
						entityType: entityType,
						elementIndex: 0,
						selectionType: "entity",
					});
				}
			}
		});

		// If single selection, set singular variables
		if (this.selectedNodes.size === 1) {
			if (window.selectedMultipleHoles && window.selectedMultipleHoles.length === 1) {
				window.selectedHole = window.selectedMultipleHoles[0];
			} else if (window.selectedMultipleKADObjects && window.selectedMultipleKADObjects.length === 1) {
				const kadObject = window.selectedMultipleKADObjects[0];
				let pointToSet = null;

				// CRITICAL: Set selectedPoint for vertex-level selections
				if (kadObject.selectionType === "vertex") {
					const entity = window.allKADDrawingsMap.get(kadObject.entityName);
					if (entity && entity.data && entity.data[kadObject.elementIndex]) {
						pointToSet = entity.data[kadObject.elementIndex];
						console.log("✅ [TreeView] Set selectedPoint for vertex selection:", pointToSet.pointID);
					}
				}

				// Use setter function to update kirra.js local variables
				if (typeof window.setSelectionFromTreeView === "function") {
					window.setSelectionFromTreeView({
						selectedKADObject: kadObject,
						selectedPoint: pointToSet
					});
				} else {
					// Fallback to direct window assignment (if setter not available)
					window.selectedKADObject = kadObject;
					window.selectedPoint = pointToSet;
				}
			}
		} else if (this.selectedNodes.size > 1) {
			// Multiple selection - check if all are vertices
			const allVertices = window.selectedMultipleKADObjects &&
				window.selectedMultipleKADObjects.every((obj) => obj.selectionType === "vertex");

			if (allVertices) {
				// Set selectedMultiplePoints for pink highlighting
				const multiplePoints = [];
				window.selectedMultipleKADObjects.forEach((kadObj) => {
					const entity = window.allKADDrawingsMap.get(kadObj.entityName);
					if (entity && entity.data && entity.data[kadObj.elementIndex]) {
						multiplePoints.push(entity.data[kadObj.elementIndex]);
					}
				});
				console.log("✅ [TreeView] Set selectedMultiplePoints:", multiplePoints.length, "vertices");

				// Use setter function
				if (typeof window.setSelectionFromTreeView === "function") {
					window.setSelectionFromTreeView({
						selectedMultiplePoints: multiplePoints
					});
				} else {
					window.selectedMultiplePoints = multiplePoints;
				}
			} else {
				if (typeof window.setSelectionFromTreeView === "function") {
					window.setSelectionFromTreeView({
						selectedMultiplePoints: []
					});
				} else {
					window.selectedMultiplePoints = [];
				}
			}
		}

		// VERIFICATION: Check if drawing conditions are met for vertex selection
		if (window.selectedKADObject && window.selectedKADObject.selectionType === "vertex") {
			console.log("🔍 [TreeView] Verification before drawData:");
			console.log("  selectedKADObject:", window.selectedKADObject);
			console.log("  selectedPoint:", window.selectedPoint);

			if (window.selectedPoint && window.selectedKADObject) {
				console.log("✅ [TreeView] BOTH CONDITIONS MET - Pink highlight should appear!");
			} else {
				console.error("❌ [TreeView] MISSING CONDITIONS - Pink highlight will NOT appear!");
				console.error("  selectedPoint:", window.selectedPoint ? "SET" : "NULL");
				console.error("  selectedKADObject:", window.selectedKADObject ? "SET" : "NULL");
			}
		}

		// PERFORMANCE FIX 2025-12-28: Warn about large selections from TreeView
		var LARGE_SELECTION_WARNING_THRESHOLD = 500;
		var totalKADSelected = window.selectedMultipleKADObjects ? window.selectedMultipleKADObjects.length : 0;
		var totalHolesSelected = window.selectedMultipleHoles ? window.selectedMultipleHoles.length : 0;
		var totalSelected = totalKADSelected + totalHolesSelected;
		
		if (totalSelected > LARGE_SELECTION_WARNING_THRESHOLD) {
			console.log("⚠️ [TreeView] Large selection: " + totalSelected + " items");
			if (typeof window.updateStatusMessage === "function") {
				window.updateStatusMessage("Large selection: " + totalSelected + " items (rendering may be limited)");
				setTimeout(function() { window.updateStatusMessage(""); }, 3000);
			}
		}

		// Redraw canvas
		if (typeof window.drawData === "function") {
			window.drawData(window.allBlastHoles, window.selectedHole);
		}
	}

	deleteNode(nodeId) {
		console.log("Delete node:", nodeId);
	}

	renameEntity() {
		// Step 947a) Support single selection rename
		if (this.selectedNodes.size === 1) {
			const nodeId = Array.from(this.selectedNodes)[0];
			if (typeof window.handleTreeViewRename === "function") {
				window.handleTreeViewRename(nodeId, this);
			}
			return;
		}
		
		// Step 947b) Support multiple hole selection rename (BlastName reassignment)
		if (this.selectedNodes.size > 1) {
			const nodeIds = Array.from(this.selectedNodes);
			const allAreHoles = nodeIds.every((id) => id.startsWith("hole⣿"));
			if (allAreHoles && typeof window.handleTreeViewRenameMultipleHoles === "function") {
				window.handleTreeViewRenameMultipleHoles(nodeIds, this);
			}
		}
	}

	showNodeProperties(nodeId) {
		// Delegate to global function
		if (typeof window.handleTreeViewShowProperties === "function") {
			window.handleTreeViewShowProperties(nodeId);
		}
	}
}

// Export singleton instance
export function initializeTreeView(containerId) {
	const treeView = new TreeView(containerId);
	window.treeView = treeView;
	return treeView;
}

