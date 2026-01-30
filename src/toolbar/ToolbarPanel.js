/**
 * ToolbarPanel - Draggable, collapsible floating toolbar
 * Handles positioning, state persistence, and user interactions
 * Supports multiple panel instances with independent state
 * Includes edge snapping and panel-to-panel snapping
 */

// Snapping constants
const EDGE_SNAP_THRESHOLD = 20;  // pixels from screen edge to trigger snap
const PANEL_SNAP_THRESHOLD = 15; // pixels between panels to trigger snap
const ALIGN_SNAP_THRESHOLD = 10; // pixels for aligning tops/lefts when snapping
const SIDEBAR_WIDTH = 350;       // pixels - width of the left sidebar when open

class ToolbarPanel {
    /**
     * @param {string} panelId - The ID of the panel element
     * @param {Object} options - Configuration options
     * @param {number} options.defaultTop - Default top position (px)
     * @param {number} options.defaultLeft - Default left position (px)
     */
    constructor(panelId, options = {}) {
        this.panelId = panelId;
        this.container = document.getElementById(panelId);
        this.isCollapsed = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.defaultTop = options.defaultTop || 60;
        this.defaultLeft = options.defaultLeft || 10;
        this.snappedEdge = { left: false, right: false, top: false, bottom: false };
        this.snappedToPanel = null; // { panelId, side: 'left'|'right'|'top'|'bottom' }
        this.sidebarOpen = false;
        this.preSidebarLeft = null; // Position before sidebar opened

        if (this.container) {
            this.init();
        }
    }

    init() {
        // Step 1) Setup collapse button (find within this panel)
        const collapseBtn = this.container.querySelector(".toolbar-collapse-btn");
        if (collapseBtn) {
            collapseBtn.addEventListener("click", () => this.toggleCollapse());
        }

        // Step 2) Setup close button (if exists)
        const closeBtn = this.container.querySelector(".toolbar-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => this.hide());
        }

        // Step 3) Setup dragging on header
        const header = this.container.querySelector(".tree-panel-header");
        if (header) {
            header.addEventListener("mousedown", (e) => this.startDrag(e));
        }

        // Step 4) Load saved position or use defaults
        this.loadPosition();

        // Step 5) Load saved collapse state
        this.loadCollapseState();

        // Step 5.1) Window resize listener
        window.addEventListener("resize", this.handleResize);
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        this.container.classList.toggle("collapsed", this.isCollapsed);

        const btn = this.container.querySelector(".toolbar-collapse-btn");
        if (btn) {
            btn.textContent = this.isCollapsed ? "+" : "−";
        }

        // Step 6) Save state with panel-specific key
        localStorage.setItem(`kirra-toolbar-collapsed-${this.panelId}`, this.isCollapsed);
    }

    hide() {
        this.container.style.display = "none";
        localStorage.setItem(`kirra-toolbar-visible-${this.panelId}`, "false");
    }

    show() {
        this.container.style.display = "flex";
        localStorage.setItem(`kirra-toolbar-visible-${this.panelId}`, "true");
    }

    startDrag(e) {
        if (e.target.closest(".tree-panel-controls")) return;

        this.isDragging = true;
        const rect = this.container.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        // Clear snapped state when starting drag
        this.clearSnapState();
        this.snappedToPanel = null;

        document.addEventListener("mousemove", this.handleDrag);
        document.addEventListener("mouseup", this.stopDrag);

        e.preventDefault();
    }

    handleDrag = (e) => {
        if (!this.isDragging) return;

        let x = e.clientX - this.dragOffset.x;
        let y = e.clientY - this.dragOffset.y;

        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Reset snap state
        this.snappedEdge = { left: false, right: false, top: false, bottom: false };
        this.snappedToPanel = null;

        // Clear visual state on other panels
        this.clearOtherPanelSnapVisuals();

        // Panel-to-panel snapping (check first, takes priority for alignment)
        const panelSnap = this.checkPanelSnapping(x, y, width, height);
        if (panelSnap) {
            x = panelSnap.x;
            y = panelSnap.y;
            this.snappedToPanel = panelSnap.snappedTo;
        }

        // Edge snapping detection (only if not snapped to panel on that axis)
        if (!panelSnap || !panelSnap.snappedHorizontal) {
            // Left edge - snap to sidebar edge if sidebar is open
            const leftSnapEdge = this.sidebarOpen ? SIDEBAR_WIDTH : 0;
            if (x < leftSnapEdge + EDGE_SNAP_THRESHOLD) {
                x = leftSnapEdge;
                this.snappedEdge.left = true;
            }
            // Right edge
            else if (x + width > viewportWidth - EDGE_SNAP_THRESHOLD) {
                x = viewportWidth - width;
                this.snappedEdge.right = true;
            }
        }

        if (!panelSnap || !panelSnap.snappedVertical) {
            // Top edge
            if (y < EDGE_SNAP_THRESHOLD) {
                y = 0;
                this.snappedEdge.top = true;
            }
            // Bottom edge
            else if (y + height > viewportHeight - EDGE_SNAP_THRESHOLD) {
                y = viewportHeight - height;
                this.snappedEdge.bottom = true;
            }
        }

        // Keep within viewport bounds (respecting sidebar if open)
        const minX = this.sidebarOpen ? SIDEBAR_WIDTH : 0;
        const maxX = viewportWidth - width;
        const maxY = viewportHeight - height;
        x = Math.max(minX, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));

        // Apply position
        this.container.style.left = x + "px";
        this.container.style.top = y + "px";

        // Update visual snap indicator
        this.updateSnapVisual();
    };

    /**
     * Check for snapping to other panels
     * @returns {Object|null} { x, y, snappedTo, snappedHorizontal, snappedVertical }
     */
    checkPanelSnapping(x, y, width, height) {
        if (!window.toolbarManager) return null;

        const otherPanels = window.toolbarManager.getOthers(this.panelId);
        let result = { x, y, snappedTo: null, snappedHorizontal: false, snappedVertical: false };
        let bestHorizontalDist = PANEL_SNAP_THRESHOLD;
        let bestVerticalDist = PANEL_SNAP_THRESHOLD;

        for (const other of otherPanels) {
            if (other.container.style.display === 'none') continue;

            const otherRect = other.getRect();

            // Current panel's edges (proposed position)
            const myLeft = x;
            const myRight = x + width;
            const myTop = y;
            const myBottom = y + height;

            // Other panel's edges
            const theirLeft = otherRect.left;
            const theirRight = otherRect.right;
            const theirTop = otherRect.top;
            const theirBottom = otherRect.bottom;

            // Check vertical overlap (panels must overlap vertically to snap horizontally)
            const verticalOverlap = myBottom > theirTop && myTop < theirBottom;

            // Check horizontal overlap (panels must overlap horizontally to snap vertically)
            const horizontalOverlap = myRight > theirLeft && myLeft < theirRight;

            if (verticalOverlap) {
                // Snap my right edge to their left edge
                const distRightToLeft = Math.abs(myRight - theirLeft);
                if (distRightToLeft < bestHorizontalDist) {
                    bestHorizontalDist = distRightToLeft;
                    result.x = theirLeft - width;
                    result.snappedHorizontal = true;
                    result.snappedTo = { panelId: other.panelId, side: 'left' };

                    // Align tops if close
                    if (Math.abs(myTop - theirTop) < ALIGN_SNAP_THRESHOLD) {
                        result.y = theirTop;
                    }

                    // Highlight target panel
                    other.container.classList.add('snap-target');
                }

                // Snap my left edge to their right edge
                const distLeftToRight = Math.abs(myLeft - theirRight);
                if (distLeftToRight < bestHorizontalDist) {
                    bestHorizontalDist = distLeftToRight;
                    result.x = theirRight;
                    result.snappedHorizontal = true;
                    result.snappedTo = { panelId: other.panelId, side: 'right' };

                    // Align tops if close
                    if (Math.abs(myTop - theirTop) < ALIGN_SNAP_THRESHOLD) {
                        result.y = theirTop;
                    }

                    // Highlight target panel
                    other.container.classList.add('snap-target');
                }
            }

            if (horizontalOverlap) {
                // Snap my bottom edge to their top edge
                const distBottomToTop = Math.abs(myBottom - theirTop);
                if (distBottomToTop < bestVerticalDist) {
                    bestVerticalDist = distBottomToTop;
                    result.y = theirTop - height;
                    result.snappedVertical = true;
                    result.snappedTo = { panelId: other.panelId, side: 'top' };

                    // Align lefts if close
                    if (Math.abs(myLeft - theirLeft) < ALIGN_SNAP_THRESHOLD) {
                        result.x = theirLeft;
                    }

                    // Highlight target panel
                    other.container.classList.add('snap-target');
                }

                // Snap my top edge to their bottom edge
                const distTopToBottom = Math.abs(myTop - theirBottom);
                if (distTopToBottom < bestVerticalDist) {
                    bestVerticalDist = distTopToBottom;
                    result.y = theirBottom;
                    result.snappedVertical = true;
                    result.snappedTo = { panelId: other.panelId, side: 'bottom' };

                    // Align lefts if close
                    if (Math.abs(myLeft - theirLeft) < ALIGN_SNAP_THRESHOLD) {
                        result.x = theirLeft;
                    }

                    // Highlight target panel
                    other.container.classList.add('snap-target');
                }
            }
        }

        if (result.snappedHorizontal || result.snappedVertical) {
            return result;
        }
        return null;
    }

    /**
     * Clear snap visual on other panels
     */
    clearOtherPanelSnapVisuals() {
        if (!window.toolbarManager) return;
        window.toolbarManager.getOthers(this.panelId).forEach(panel => {
            panel.container.classList.remove('snap-target');
        });
    }

    stopDrag = () => {
        this.isDragging = false;
        document.removeEventListener("mousemove", this.handleDrag);
        document.removeEventListener("mouseup", this.stopDrag);

        // Clear snap target visuals on other panels
        this.clearOtherPanelSnapVisuals();

        // If sidebar is open and this panel was shifted, update preSidebarLeft
        if (this.sidebarOpen && this.preSidebarLeft !== null) {
            const currentLeft = parseInt(this.container.style.left) || 0;
            // Calculate where the panel would be if sidebar were closed
            this.preSidebarLeft = Math.max(0, currentLeft - SIDEBAR_WIDTH);
        }

        // Save position
        this.savePosition();
    };

    /**
     * Clear snap visual state
     */
    clearSnapState() {
        this.container.classList.remove(
            "snapped-edge", "snapped-left", "snapped-right",
            "snapped-top", "snapped-bottom", "snapped-panel"
        );
    }

    /**
     * Update visual indicator for snapped state
     */
    updateSnapVisual() {
        this.clearSnapState();

        const isEdgeSnapped = this.snappedEdge.left || this.snappedEdge.right ||
                              this.snappedEdge.top || this.snappedEdge.bottom;

        if (isEdgeSnapped) {
            this.container.classList.add("snapped-edge");
            if (this.snappedEdge.left) this.container.classList.add("snapped-left");
            if (this.snappedEdge.right) this.container.classList.add("snapped-right");
            if (this.snappedEdge.top) this.container.classList.add("snapped-top");
            if (this.snappedEdge.bottom) this.container.classList.add("snapped-bottom");
        }

        if (this.snappedToPanel) {
            this.container.classList.add("snapped-panel");
        }
    }

    savePosition() {
        // Save the "original" position (without sidebar offset)
        let leftToSave = this.container.style.left;

        // If sidebar is open and panel was shifted, save the pre-sidebar position
        if (this.sidebarOpen && this.preSidebarLeft !== null) {
            leftToSave = this.preSidebarLeft + "px";
        }
        // If sidebar is open but panel wasn't shifted, save current position as-is

        const position = {
            left: leftToSave,
            top: this.container.style.top,
            snappedEdge: this.snappedEdge,
            snappedToPanel: this.snappedToPanel
        };
        localStorage.setItem(`kirra-toolbar-position-${this.panelId}`, JSON.stringify(position));
    }

    loadPosition() {
        const saved = localStorage.getItem(`kirra-toolbar-position-${this.panelId}`);
        if (saved) {
            try {
                const position = JSON.parse(saved);
                if (position.left) this.container.style.left = position.left;
                if (position.top) this.container.style.top = position.top;
                if (position.snappedEdge) {
                    this.snappedEdge = position.snappedEdge;
                }
                if (position.snappedToPanel) {
                    this.snappedToPanel = position.snappedToPanel;
                }
                this.updateSnapVisual();
            } catch (e) {
                console.error(`Error loading toolbar position for ${this.panelId}:`, e);
            }
        } else {
            // Apply default position
            this.container.style.left = this.defaultLeft + "px";
            this.container.style.top = this.defaultTop + "px";
        }
    }

    loadCollapseState() {
        const collapsed = localStorage.getItem(`kirra-toolbar-collapsed-${this.panelId}`) === "true";
        if (collapsed) {
            this.toggleCollapse();
        }

        const visible = localStorage.getItem(`kirra-toolbar-visible-${this.panelId}`) !== "false";
        if (!visible) {
            this.hide();
        }
    }

    // Handle window resize
    handleResize = () => {
        const isMobile = window.matchMedia("(max-width: 1024px)").matches;
        if (isMobile) {
            this.container.classList.remove("sidebar-open");
        }

        // Re-apply edge snapping if panel was snapped to right or bottom edge
        if (this.snappedEdge.right || this.snappedEdge.bottom) {
            const rect = this.container.getBoundingClientRect();
            if (this.snappedEdge.right) {
                this.container.style.left = (window.innerWidth - rect.width) + "px";
            }
            if (this.snappedEdge.bottom) {
                this.container.style.top = (window.innerHeight - rect.height) + "px";
            }
            this.savePosition();
        }
    };

    // Handle sidebar state changes - shift panel position
    updateSidebarState(sidebarOpen) {
        const isMobile = window.matchMedia("(max-width: 1024px)").matches;
        if (isMobile) return; // Don't shift on mobile

        const currentLeft = parseInt(this.container.style.left) || 0;

        if (sidebarOpen && !this.sidebarOpen) {
            // Sidebar opening
            this.sidebarOpen = true;

            // Only shift if panel is in the sidebar zone
            if (currentLeft < SIDEBAR_WIDTH) {
                this.preSidebarLeft = currentLeft;
                const newLeft = currentLeft + SIDEBAR_WIDTH;
                this.container.style.left = newLeft + "px";
                this.container.style.transition = "left 0.3s ease";

                // Clear snapped-left state since we're no longer at left edge
                if (this.snappedEdge.left) {
                    this.snappedEdge.left = false;
                    this.container.classList.remove("snapped-left");
                    if (!this.snappedEdge.right && !this.snappedEdge.top && !this.snappedEdge.bottom) {
                        this.container.classList.remove("snapped-edge");
                    }
                }
            } else {
                // Panel is already clear of sidebar - don't track for restoration
                this.preSidebarLeft = null;
            }
        } else if (!sidebarOpen && this.sidebarOpen) {
            // Sidebar closing - restore original position only if panel was shifted
            this.sidebarOpen = false;

            if (this.preSidebarLeft !== null) {
                this.container.style.left = this.preSidebarLeft + "px";
                this.container.style.transition = "left 0.3s ease";

                // Restore snapped-left state if it was at the left edge
                if (this.preSidebarLeft === 0) {
                    this.snappedEdge.left = true;
                    this.container.classList.add("snapped-edge", "snapped-left");
                }

                this.preSidebarLeft = null;
            }
        }

        // Remove transition after animation completes
        setTimeout(() => {
            this.container.style.transition = "";
        }, 300);
    }

    /**
     * Get the bounding rectangle of this panel
     */
    getRect() {
        return this.container.getBoundingClientRect();
    }
}

// ToolbarManager - Manages multiple toolbar panels
class ToolbarManager {
    constructor() {
        this.panels = new Map();
    }

    /**
     * Register a toolbar panel
     * @param {string} panelId - The panel element ID
     * @param {Object} options - Configuration options
     */
    register(panelId, options = {}) {
        const panel = new ToolbarPanel(panelId, options);
        this.panels.set(panelId, panel);
        return panel;
    }

    /**
     * Get a panel by ID
     * @param {string} panelId
     */
    get(panelId) {
        return this.panels.get(panelId);
    }

    /**
     * Show all panels
     */
    showAll() {
        this.panels.forEach(panel => panel.show());
    }

    /**
     * Hide all panels
     */
    hideAll() {
        this.panels.forEach(panel => panel.hide());
    }

    /**
     * Update sidebar state for all panels
     * @param {boolean} sidebarOpen
     */
    updateSidebarState(sidebarOpen) {
        this.panels.forEach(panel => panel.updateSidebarState(sidebarOpen));
    }

    /**
     * Get all panel instances
     */
    getAll() {
        return Array.from(this.panels.values());
    }

    /**
     * Get all other panels (excluding one)
     * @param {string} excludePanelId - Panel ID to exclude
     */
    getOthers(excludePanelId) {
        return Array.from(this.panels.values()).filter(p => p.panelId !== excludePanelId);
    }
}

// Export classes
export default ToolbarPanel;
export { ToolbarManager };

// Export utility function for external toolbar management
export function showToolbar() {
    if (window.toolbarManager) {
        window.toolbarManager.showAll();
    }
}

// Initialize default 7-panel layout
export function initializeToolbarPanels() {
    const manager = new ToolbarManager();

    // Panel positions (staggered grid layout)
    const panelConfigs = [
        { id: "toolbarPanelSelect", defaultTop: 60, defaultLeft: 10 },
        { id: "toolbarPanelDesign", defaultTop: 60, defaultLeft: 120 },
        { id: "toolbarPanelSurface", defaultTop: 60, defaultLeft: 230 },
        { id: "toolbarPanelDraw", defaultTop: 220, defaultLeft: 10 },
        { id: "toolbarPanelModify", defaultTop: 220, defaultLeft: 120 },
        { id: "toolbarPanelConnect", defaultTop: 220, defaultLeft: 230 },
        { id: "toolbarPanelView", defaultTop: 380, defaultLeft: 10 },
    ];

    panelConfigs.forEach(config => {
        if (document.getElementById(config.id)) {
            manager.register(config.id, {
                defaultTop: config.defaultTop,
                defaultLeft: config.defaultLeft
            });
        }
    });

    // Expose globally
    window.toolbarManager = manager;

    return manager;
}
