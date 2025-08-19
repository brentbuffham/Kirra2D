/**
 * ToolbarPanel - Draggable, collapsible floating toolbar
 * Handles positioning, state persistence, and user interactions
 */
class ToolbarPanel {
    constructor() {
        this.container = document.getElementById("toolbarPanel");
        this.isCollapsed = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };

        if (this.container) {
            this.init();
        }
    }

    init() {
        // Step 1) Setup collapse button
        const collapseBtn = document.getElementById("toolbarCollapseBtn");
        if (collapseBtn) {
            collapseBtn.addEventListener("click", () => this.toggleCollapse());
        }

        // Step 2) Setup close button
        const closeBtn = document.getElementById("toolbarCloseBtn");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => this.hide());
        }

        // Step 3) Setup dragging
        const header = document.getElementById("toolbarPanelHeader");
        if (header) {
            header.addEventListener("mousedown", (e) => this.startDrag(e));
        }

        // Step 4) Load saved position
        this.loadPosition();

        // Step 5) Load saved collapse state
        this.loadCollapseState();
        // Step 5.1) Update sidebar resize listener
        window.addEventListener("resize", this.handleResize);
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        this.container.classList.toggle("collapsed", this.isCollapsed);

        const btn = document.getElementById("toolbarCollapseBtn");
        if (btn) {
            btn.textContent = this.isCollapsed ? "+" : "−";
        }

        // Step 6) Save state
        localStorage.setItem("kirra-toolbar-collapsed", this.isCollapsed);
    }

    hide() {
        this.container.style.display = "none";
        localStorage.setItem("kirra-toolbar-visible", "false");
    }

    show() {
        this.container.style.display = "flex";
        localStorage.setItem("kirra-toolbar-visible", "true");
    }

    startDrag(e) {
        if (e.target.closest(".tree-panel-controls")) return;

        this.isDragging = true;
        const rect = this.container.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        document.addEventListener("mousemove", this.handleDrag);
        document.addEventListener("mouseup", this.stopDrag);

        e.preventDefault();
    }

    handleDrag = (e) => {
        if (!this.isDragging) return;

        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        // Step 7) Keep within viewport
        const maxX = window.innerWidth - this.container.offsetWidth;
        const maxY = window.innerHeight - this.container.offsetHeight;

        this.container.style.left = Math.max(0, Math.min(x, maxX)) + "px";
        this.container.style.top = Math.max(0, Math.min(y, maxY)) + "px";
    };

    stopDrag = () => {
        this.isDragging = false;
        document.removeEventListener("mousemove", this.handleDrag);
        document.removeEventListener("mouseup", this.stopDrag);

        // Step 8) Save position
        this.savePosition();
    };

    savePosition() {
        const position = {
            left: this.container.style.left,
            top: this.container.style.top,
        };
        localStorage.setItem("kirra-toolbar-position", JSON.stringify(position));
    }

    loadPosition() {
        const saved = localStorage.getItem("kirra-toolbar-position");
        if (saved) {
            try {
                const position = JSON.parse(saved);
                if (position.left) this.container.style.left = position.left;
                if (position.top) this.container.style.top = position.top;
            } catch (e) {
                console.error("Error loading toolbar position:", e);
            }
        }
    }

    loadCollapseState() {
        const collapsed = localStorage.getItem("kirra-toolbar-collapsed") === "true";
        if (collapsed) {
            this.toggleCollapse();
        }

        const visible = localStorage.getItem("kirra-toolbar-visible") !== "false";
        if (!visible) {
            this.hide();
        }
    }

    // Step 3) Add method to handle window resize
    handleResize = () => {
        const isMobile = window.matchMedia("(max-width: 1024px)").matches;
        if (isMobile) {
            // Remove sidebar class on mobile
            this.container.classList.remove("sidebar-open");
        }
    };
    // Step 9) Add method to handle sidebar state changes
    updateSidebarState(sidebarOpen) {
        // Step 10) Only adjust on desktop (not mobile)
        const isMobile = window.matchMedia("(max-width: 1024px)").matches;
        if (!isMobile) {
            if (sidebarOpen) {
                this.container.classList.add("sidebar-open");
            } else {
                this.container.classList.remove("sidebar-open");
            }
        }
    }
}

// Step 11) Export the class
export default ToolbarPanel;

// Step 12) Export utility function for external toolbar management
export function showToolbar() {
    // Step 13) Use global toolbarPanel instance if available
    if (window.toolbarPanel) {
        window.toolbarPanel.show();
    } else {
        const toolbar = document.getElementById("toolbarPanel");
        if (toolbar) {
            toolbar.style.display = "flex";
        }
    }
}
