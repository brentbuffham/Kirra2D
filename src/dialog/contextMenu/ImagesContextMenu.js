// src/dialog/contextMenu/ImagesContextMenu.js
//=============================================================
// IMAGES CONTEXT MENU
//=============================================================

// Step 1) Show image context menu
function showImageContextMenu(x, y, imageId = null) {
	// Step 2) Get the specific image if ID provided, otherwise first visible image
	var image = imageId
		? window.loadedImages.get(imageId)
		: Array.from(window.loadedImages.values()).find(function (img) {
				return img.visible;
		  });
	if (!image) return;

	// Step 3) Store reference for dialog callbacks
	var currentImage = image;
	var currentImageId = imageId;
	var dialogInstance = null;

	// Step 4) Create content builder function
	var contentBuilder = function (dialog) {
		var container = document.createElement("div");
		container.style.display = "flex";
		container.style.flexDirection = "column";
		container.style.gap = "12px";
		container.style.padding = "12px";

		// Step 5) Create action buttons section with full-width buttons
		var buttonsSection = document.createElement("div");
		buttonsSection.style.display = "flex";
		buttonsSection.style.flexDirection = "column";
		buttonsSection.style.gap = "8px";
		buttonsSection.style.marginBottom = "16px";

		// Step 5a) Helper function to create styled full-width button
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

		// Step 6) Toggle visibility button
		buttonsSection.appendChild(
			createActionButton(currentImage.visible ? "Hide Image" : "Show Image", function () {
				if (currentImageId && window.loadedImages.has(currentImageId)) {
					var targetImage = window.loadedImages.get(currentImageId);
					if (targetImage) {
						targetImage.visible = !targetImage.visible;
					}
				} else {
					currentImage.visible = !currentImage.visible;
				}
				window.drawData(window.allBlastHoles, window.selectedHole);
				if (dialogInstance) dialogInstance.close();
			})
		);

		// Step 7) Remove image button
		buttonsSection.appendChild(
			createActionButton("Remove Image", function () {
				if (currentImageId && window.loadedImages.has(currentImageId)) {
					window.deleteImageFromDB(currentImageId)
						.then(function () {
							window.loadedImages.delete(currentImageId);
							window.drawData(window.allBlastHoles, window.selectedHole);
							window.debouncedUpdateTreeView();
						})
						.catch(function (error) {
							console.error("Error removing image:", error);
							window.loadedImages.delete(currentImageId);
							window.drawData(window.allBlastHoles, window.selectedHole);
						});
				}
				if (dialogInstance) dialogInstance.close();
			})
		);

		// Step 8) Delete all images button
		buttonsSection.appendChild(
			createActionButton("Delete All Images", function () {
				window.deleteAllImagesFromDB()
					.then(function () {
						window.loadedImages.clear();
						window.debouncedUpdateTreeView();
						window.drawData(window.allBlastHoles, window.selectedHole);
					})
					.catch(function (error) {
						console.error("Error deleting all images:", error);
					});
				if (dialogInstance) dialogInstance.close();
			})
		);

		container.appendChild(buttonsSection);

		// Step 9) Create transparency slider section with proper styling
		var sliderSection = document.createElement("div");
		sliderSection.style.marginBottom = "12px";

		var sliderLabel = document.createElement("div");
		sliderLabel.textContent = "Transparency:";
		sliderLabel.style.fontSize = "13px";
		sliderLabel.style.marginBottom = "8px";
		sliderLabel.style.color = "#333";
		sliderSection.appendChild(sliderLabel);

		// Step 9a) Create styled range slider matching app theme
		var sliderContainer = document.createElement("div");
		sliderContainer.style.display = "flex";
		sliderContainer.style.alignItems = "center";
		sliderContainer.style.gap = "12px";

		var initialValue = Math.round((currentImage.transparency !== undefined ? currentImage.transparency : 1.0) * 100);
		var slider = document.createElement("input");
		slider.type = "range";
		slider.min = "0";
		slider.max = "100";
		slider.value = initialValue;
		slider.style.flex = "1";
		slider.style.height = "6px";
		slider.style.cursor = "pointer";
		slider.style.appearance = "none";
		slider.style.webkitAppearance = "none";
		slider.style.background = "linear-gradient(to right, #ff0000 0%, #ff0000 " + initialValue + "%, #ddd " + initialValue + "%, #ddd 100%)";
		slider.style.borderRadius = "3px";
		slider.style.outline = "none";

		var sliderValue = document.createElement("span");
		sliderValue.textContent = initialValue + "%";
		sliderValue.style.minWidth = "45px";
		sliderValue.style.fontSize = "12px";
		sliderValue.style.color = "#666";
		sliderValue.style.textAlign = "right";

		// Step 9b) Update slider appearance and value on input
		slider.oninput = function () {
			var val = parseInt(slider.value);
			sliderValue.textContent = val + "%";
			slider.style.background = "linear-gradient(to right, #ff0000 0%, #ff0000 " + val + "%, #ddd " + val + "%, #ddd 100%)";
			var newTransparency = val / 100;

			if (currentImageId && window.loadedImages.has(currentImageId)) {
				var targetImage = window.loadedImages.get(currentImageId);
				if (targetImage) {
					targetImage.transparency = newTransparency;
				}
			} else {
				currentImage.transparency = newTransparency;
			}
			window.drawData(window.allBlastHoles, window.selectedHole);
		};

		sliderContainer.appendChild(slider);
		sliderContainer.appendChild(sliderValue);
		sliderSection.appendChild(sliderContainer);
		container.appendChild(sliderSection);

		// Step 10) Create Z elevation section for 3D positioning
		var zSection = document.createElement("div");
		zSection.style.marginBottom = "12px";

		var zLabel = document.createElement("div");
		zLabel.textContent = "Z Elevation:";
		zLabel.style.fontSize = "13px";
		zLabel.style.marginBottom = "8px";
		zLabel.style.color = "#333";
		zSection.appendChild(zLabel);

		var zInput = document.createElement("input");
		zInput.type = "number";
		zInput.value = currentImage.zElevation !== undefined ? currentImage.zElevation : window.drawingZLevel || 0;
		zInput.style.width = "100%";
		zInput.style.padding = "8px 12px";
		zInput.style.fontSize = "13px";
		zInput.style.borderRadius = "4px";
		zInput.style.border = "1px solid #ccc";
		zInput.style.backgroundColor = "#fff";
		zInput.style.boxSizing = "border-box";

	zInput.onchange = function () {
		var newZ = parseFloat(zInput.value) || 0;
		if (currentImageId && window.loadedImages.has(currentImageId)) {
			var targetImage = window.loadedImages.get(currentImageId);
			if (targetImage) {
				targetImage.zElevation = newZ;
			}
		} else {
			currentImage.zElevation = newZ;
		}
		window.drawData(window.allBlastHoles, window.selectedHole);
	};

		zSection.appendChild(zInput);
		container.appendChild(zSection);

		return container;
	};

	// Step 11) Create and show the FloatingDialog
	dialogInstance = new window.FloatingDialog({
		title: currentImage.name || "Image Properties",
		content: contentBuilder,
		width: 320,
		height: 380,
		showConfirm: false,
		showCancel: false,
		draggable: true,
		resizable: false,
		closeOnOutsideClick: true,
		layoutType: "compact",
	});

	dialogInstance.show();

	// Step 12) Position dialog near click location (adjusted for viewport bounds)
	if (dialogInstance.element) {
		var dialogWidth = 320;
		var dialogHeight = 380;
		var posX = Math.min(x, window.innerWidth - dialogWidth - 20);
		var posY = Math.min(y, window.innerHeight - dialogHeight - 20);
		posX = Math.max(10, posX);
		posY = Math.max(10, posY);
		dialogInstance.element.style.left = posX + "px";
		dialogInstance.element.style.top = posY + "px";
	}
}

//===========================================
// IMAGES CONTEXT MENU END
//===========================================

// Make functions available globally
window.showImageContextMenu = showImageContextMenu;

