/**
 * @fileoverview Dynamic surface connector preset buttons.
 * Queries loadedProducts for Surface* initiator types and builds
 * colored delay buttons in the Connect toolbar panel.
 */

/**
 * Determine whether text on a given background color should be light or dark.
 * @param {string} hex - Hex color string e.g. "#FF0000"
 * @returns {string} "#000000" or "#FFFFFF"
 */
function contrastText(hex) {
    if (!hex || hex.length < 7) return "#000000";
    var r = parseInt(hex.substring(1, 3), 16);
    var g = parseInt(hex.substring(3, 5), 16);
    var b = parseInt(hex.substring(5, 7), 16);
    // Relative luminance (ITU-R BT.709)
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

/**
 * Build surface connector preset buttons from loaded products.
 * Appends colored delay buttons to the Connect toolbar panel.
 * Click sets floatingDelay value and floatingConnectorColor jscolor.
 */
export function buildSurfaceConnectorPresets() {
    var grid = document.querySelector("#toolbarPanelConnect .toolbar-grid");
    if (!grid) return;

    // Remove any previously built preset container
    var existing = grid.querySelector(".connector-presets");
    if (existing) existing.remove();

    var products = window.loadedProducts;
    if (!products || products.size === 0) return;

    // Gather surface initiator products
    var surfaceProducts = [];
    products.forEach(function (p) {
        if (p.initiatorType && p.initiatorType.indexOf("Surface") === 0) {
            surfaceProducts.push(p);
        }
    });

    if (surfaceProducts.length === 0) return;

    // Sort by delay value
    surfaceProducts.sort(function (a, b) {
        var aDelay = a.delayMs != null ? a.delayMs : 0;
        var bDelay = b.delayMs != null ? b.delayMs : 0;
        return aDelay - bDelay;
    });

    // Create preset container - "single" class spans full grid width
    var container = document.createElement("div");
    container.className = "connector-presets single";
    container.style.cssText = "display: flex; flex-wrap: wrap; gap: 3px; padding: 3px 0;";

    for (var i = 0; i < surfaceProducts.length; i++) {
        (function (product) {
            var delay = product.delayMs != null ? product.delayMs : 0;
            var color = product.colorHex || "#888888";
            var textColor = contrastText(color);

            var btn = document.createElement("button");
            btn.className = "connector-preset-btn single";
            btn.title = product.name + " (" + delay + "ms)";
            btn.textContent = delay + "ms";
            btn.style.cssText = "background:" + color + ";color:" + textColor + ";border:1px solid #555;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;font-weight:bold;min-width:36px;";

            btn.addEventListener("click", function () {
                // Set the floating delay input
                var delayInput = document.getElementById("floatingDelay");
                if (delayInput) delayInput.value = delay;

                // Set the connector color via jscolor
                var colorInput = document.getElementById("floatingConnectorColor");
                if (colorInput && colorInput.jscolor) {
                    colorInput.jscolor.fromString(color);
                } else if (colorInput) {
                    colorInput.value = color;
                    colorInput.style.backgroundColor = color;
                }

                // Also sync the main sidebar delay and connectorColor inputs if they exist
                var sidebarDelay = document.getElementById("delay");
                if (sidebarDelay) sidebarDelay.value = delay;
                var sidebarColor = document.getElementById("connectorColor");
                if (sidebarColor && sidebarColor.jscolor) {
                    sidebarColor.jscolor.fromString(color);
                }
            });

            container.appendChild(btn);
        })(surfaceProducts[i]);
    }

    grid.appendChild(container);
}
