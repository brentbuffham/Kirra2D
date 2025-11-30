// src/dialog/contextMenu/SurfacesContextMenu.js
//=============================================================
// SURFACES CONTEXT MENU
//=============================================================

// Step 1) Show surface context menu
function showSurfaceContextMenu(x, y, surfaceId = null) {
	// Step 2) Get the specific surface if ID provided, otherwise first visible surface
	var surface = surfaceId
		? window.loadedSurfaces.get(surfaceId)
		: Array.from(window.loadedSurfaces.values()).find(function (s) {
				return s.visible;
		  });
	if (!surface) return;

	// Step 3) Store reference for dialog callbacks
	var currentSurface = surface;
	var dialogInstance = null;

	// Step 4) Define gradient options - include texture option for textured meshes
	var gradientOptions = [
		{ value: "default", text: "Default" },
		{ value: "hillshade", text: "Hillshade" },
		{ value: "viridis", text: "Viridis" },
		{ value: "turbo", text: "Turbo" },
		{ value: "parula", text: "Parula" },
		{ value: "cividis", text: "Cividis" },
		{ value: "terrain", text: "Terrain" },
	];

	// Step 4a) Add texture option if this is a textured mesh
	if (currentSurface.isTexturedMesh) {
		gradientOptions.unshift({ value: "texture", text: "Texture (Original)" });
	}

	// Step 5) Create content builder function
	var contentBuilder = function (dialog) {
		var container = document.createElement("div");
		container.style.display = "flex";
		container.style.flexDirection = "column";
		container.style.gap = "12px";
		container.style.padding = "12px";

		// Step 6) Create action buttons section with full-width buttons
		var buttonsSection = document.createElement("div");
		buttonsSection.style.display = "flex";
		buttonsSection.style.flexDirection = "column";
		buttonsSection.style.gap = "8px";
		buttonsSection.style.marginBottom = "16px";

		// Step 6a) Helper function to create styled full-width button
		var createActionButton = function (text, onClick) {
			var btn = document.createElement("button");
			btn.className = "floating-dialog-btn";
			btn.textContent = text;
			btn.style.width = "100%";
			btn.style.padding = "10px 16px";
			btn.style.fontSize = "13px";
			btn.style.cursor = "pointer";
			btn.style.borderRadius = "4px";
			btn.style.border = "1px solid #ccc";
			btn.style.backgroundColor = "#f5f5f5";
			btn.style.color = "#333";
			btn.style.transition = "background-color 0.2s";
			btn.onmouseover = function () {
				btn.style.backgroundColor = "#e0e0e0";
			};
			btn.onmouseout = function () {
				btn.style.backgroundColor = "#f5f5f5";
			};
			btn.onclick = onClick;
			return btn;
		};

		// Step 7) Toggle visibility button
		buttonsSection.appendChild(
			createActionButton(currentSurface.visible ? "Hide Surface" : "Show Surface", function () {
				window.setSurfaceVisibility(currentSurface.id, !currentSurface.visible);
				window.drawData(window.allBlastHoles, window.selectedHole);
				if (dialogInstance) dialogInstance.close();
			})
		);

		// Step 8) Remove surface button
		buttonsSection.appendChild(
			createActionButton("Remove Surface", function () {
				window.deleteSurfaceFromDB(currentSurface.id)
					.then(function () {
						window.loadedSurfaces.delete(currentSurface.id);
						window.drawData(window.allBlastHoles, window.selectedHole);
						window.debouncedUpdateTreeView();
						console.log("Surface removed from both memory and database");
					})
					.catch(function (error) {
						console.error("Error removing surface:", error);
						window.loadedSurfaces.delete(currentSurface.id);
						window.drawData(window.allBlastHoles, window.selectedHole);
					});
				if (dialogInstance) dialogInstance.close();
			})
		);

		// Step 9) Delete all surfaces button
		buttonsSection.appendChild(
			createActionButton("Delete All Surfaces", function () {
				window.deleteAllSurfacesFromDB()
					.then(function () {
						window.loadedSurfaces.clear();
						window.drawData(window.allBlastHoles, window.selectedHole);
						console.log("All surfaces deleted from database and memory");
					})
					.catch(function (error) {
						console.error("Error deleting all surfaces:", error);
					});
				if (dialogInstance) dialogInstance.close();
			})
		);

		container.appendChild(buttonsSection);

		// Step 10) Create transparency slider section with proper styling
		var sliderSection = document.createElement("div");
		sliderSection.style.marginBottom = "12px";

		var sliderLabel = document.createElement("div");
		sliderLabel.textContent = "Transparency:";
		sliderLabel.style.fontSize = "13px";
		sliderLabel.style.marginBottom = "8px";
		sliderLabel.style.color = "#333";
		sliderSection.appendChild(sliderLabel);

		// Step 10a) Create styled range slider matching app theme
		var sliderContainer = document.createElement("div");
		sliderContainer.style.display = "flex";
		sliderContainer.style.alignItems = "center";
		sliderContainer.style.gap = "12px";

		var slider = document.createElement("input");
		slider.type = "range";
		slider.min = "0";
		slider.max = "100";
		slider.value = Math.round((currentSurface.transparency || 1.0) * 100);
		slider.style.flex = "1";
		slider.style.height = "6px";
		slider.style.cursor = "pointer";
		slider.style.appearance = "none";
		slider.style.webkitAppearance = "none";
		slider.style.background = "linear-gradient(to right, #ff0000 0%, #ff0000 " + slider.value + "%, #ddd " + slider.value + "%, #ddd 100%)";
		slider.style.borderRadius = "3px";
		slider.style.outline = "none";

		var sliderValue = document.createElement("span");
		sliderValue.textContent = slider.value + "%";
		sliderValue.style.minWidth = "45px";
		sliderValue.style.fontSize = "12px";
		sliderValue.style.color = "#666";
		sliderValue.style.textAlign = "right";

		// Step 10b) Update slider appearance and value on input
		slider.oninput = function () {
			var val = parseInt(slider.value);
			sliderValue.textContent = val + "%";
			slider.style.background = "linear-gradient(to right, #ff0000 0%, #ff0000 " + val + "%, #ddd " + val + "%, #ddd 100%)";
			var newTransparency = val / 100;
			currentSurface.transparency = newTransparency;
			window.saveSurfaceToDB(currentSurface.id).catch(function (err) {
				console.error("Failed to save surface transparency:", err);
			});
			window.drawData(window.allBlastHoles, window.selectedHole);
		};

		sliderContainer.appendChild(slider);
		sliderContainer.appendChild(sliderValue);
		sliderSection.appendChild(sliderContainer);
		container.appendChild(sliderSection);

		// Step 11) Create gradient select section
		var gradientSection = document.createElement("div");
		gradientSection.style.marginBottom = "12px";

		var gradientLabel = document.createElement("div");
		gradientLabel.textContent = "Color Gradient:";
		gradientLabel.style.fontSize = "13px";
		gradientLabel.style.marginBottom = "8px";
		gradientLabel.style.color = "#333";
		gradientSection.appendChild(gradientLabel);

		var gradientSelect = document.createElement("select");
		gradientSelect.style.width = "100%";
		gradientSelect.style.padding = "8px 12px";
		gradientSelect.style.fontSize = "13px";
		gradientSelect.style.borderRadius = "4px";
		gradientSelect.style.border = "1px solid #ccc";
		gradientSelect.style.backgroundColor = "#fff";
		gradientSelect.style.cursor = "pointer";

		gradientOptions.forEach(function (opt) {
			var option = document.createElement("option");
			option.value = opt.value;
			option.textContent = opt.text;
			if (opt.value === (currentSurface.gradient || "default")) {
				option.selected = true;
			}
			gradientSelect.appendChild(option);
		});

		gradientSelect.onchange = function () {
			currentSurface.gradient = gradientSelect.value;
			window.saveSurfaceToDB(currentSurface.id).catch(function (err) {
				console.error("Failed to save surface gradient:", err);
			});
			console.log("Updated gradient for surface '" + (currentSurface.name || currentSurface.id) + "' to: " + gradientSelect.value);
			window.drawData(window.allBlastHoles, window.selectedHole);
		};

		gradientSection.appendChild(gradientSelect);
		container.appendChild(gradientSection);

		// Step 12) Create legend checkbox section
		var legendSection = document.createElement("div");
		legendSection.style.display = "flex";
		legendSection.style.alignItems = "center";
		legendSection.style.gap = "8px";

		var legendCheckbox = document.createElement("input");
		legendCheckbox.type = "checkbox";
		legendCheckbox.checked = window.showSurfaceLegend;
		legendCheckbox.style.width = "16px";
		legendCheckbox.style.height = "16px";
		legendCheckbox.style.cursor = "pointer";

		var legendLabel = document.createElement("label");
		legendLabel.textContent = "Show Legend";
		legendLabel.style.fontSize = "13px";
		legendLabel.style.color = "#333";
		legendLabel.style.cursor = "pointer";
		legendLabel.onclick = function () {
			legendCheckbox.click();
		};

		legendCheckbox.onchange = function () {
			window.showSurfaceLegend = legendCheckbox.checked;
			window.drawData(window.allBlastHoles, window.selectedHole);
		};

		legendSection.appendChild(legendCheckbox);
		legendSection.appendChild(legendLabel);
		container.appendChild(legendSection);

		return container;
	};

	// Step 13) Create and show the FloatingDialog
	dialogInstance = new window.FloatingDialog({
		title: currentSurface.name || "Surface Properties",
		content: contentBuilder,
		width: 340,
		height: 420,
		showConfirm: false,
		showCancel: false,
		draggable: true,
		resizable: false,
		closeOnOutsideClick: true,
		layoutType: "compact",
	});

	dialogInstance.show();

	// Step 14) Position dialog near click location (adjusted for viewport bounds)
	if (dialogInstance.element) {
		var dialogWidth = 340;
		var dialogHeight = 420;
		var posX = Math.min(x, window.innerWidth - dialogWidth - 20);
		var posY = Math.min(y, window.innerHeight - dialogHeight - 20);
		posX = Math.max(10, posX);
		posY = Math.max(10, posY);
		dialogInstance.element.style.left = posX + "px";
		dialogInstance.element.style.top = posY + "px";
	}
}

//===========================================
// SURFACES CONTEXT MENU END
//===========================================

// Make functions available globally
window.showSurfaceContextMenu = showSurfaceContextMenu;

