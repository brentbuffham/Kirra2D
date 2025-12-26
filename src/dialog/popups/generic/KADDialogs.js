// src/dialog/popups/generic/KADDialogs.js
//=============================================================
// KAD DIALOG FUNCTIONS
//=============================================================
// Step 1) This file contains all KAD-related dialog functions previously in kirra.js
// Step 2) All functions use FloatingDialog for consistency and proper theming
// Step 0) Converted to ES Module for Vite bundling - 2025-12-26

//! SHOW TRIANGULATION POPUP
// Step 3) Dialog for creating Delaunay 2.5D triangulations
export function showTriangulationPopup() {
	const selectedPolygon = window.selectedKADObject && window.selectedKADObject.entityType == "poly" ? window.selectedKADObject : null;

	const fields = [
		{
			label: "Surface Name",
			name: "surfaceName",
			value: "Surface_" + Date.now(),
			placeholder: "Surface Name",
		},
		{
			label: "Blast Hole Points",
			name: "blastHolePoints",
			type: "select",
			value: "none",
			options: [
				{
					text: "None - Exclude blast holes",
					value: "none",
				},
				{
					text: "Collar points (surface)",
					value: "collar",
				},
				{
					text: "Grade points (mid-hole)",
					value: "grade",
				},
				{
					text: "Toe points (bottom)",
					value: "toe",
				},
				{
					text: "Measured length points (along hole)",
					value: "measuredLength",
				},
			],
		},
		{
			label: "KAD Breaklines",
			name: "useBreaklines",
			type: "select",
			value: "yes",
			options: [
				{
					text: "Include as constraints",
					value: "yes",
				},
				{
					text: "Points only (no constraints)",
					value: "no",
				},
			],
		},
		{
			label: "Boundary Clipping",
			name: "clipToBoundary",
			type: "select",
			value: selectedPolygon ? "selected" : "none",
			options: [
				{
					text: "No boundary clipping",
					value: "none",
				},
				{
					text: "Delete triangles outside selected polygon",
					value: "outside",
				},
				{
					text: "Delete triangles inside selected polygon",
					value: "inside",
				},
			],
		},
		{
			label: "Search Distance (XYZ duplicates)",
			name: "xyzTolerance",
			type: "number",
			value: 0.001,
			min: 0.001,
			max: 10,
			step: 0.01,
		},
		{
			label: "Minimum Internal Angle",
			name: "minInternalAngle",
			type: "number",
			value: 0, //0 = ignore culling
			min: 0,
			max: 60,
			step: 0.1,
		},
		{
			label: "Consider Angle in 3D?",
			name: "consider3DAngle",
			type: "checkbox",
			value: false,
		},
		{
			label: "Max Edge Length",
			name: "maxEdgeLength",
			type: "number",
			value: 0, //0 = ignore culling
			min: 0,
			max: 10000,
			step: 0.1,
		},
		{
			label: "Consider 3D edge length?",
			name: "consider3DLength",
			type: "checkbox",
			value: false,
		},
		{
			label: "Surface Style",
			name: "surfaceStyle",
			type: "select",
			value: "hillshade",
			options: [
				{
					text: "default",
					value: "default",
				},
				//{ text: "wireframe", value: "wireframe" },//! Never use wireframe it doesn't exist!//
				{
					text: "Hillshade",
					value: "hillshade",
				},
				{
					text: "Viridis",
					value: "viridis",
				},
				{
					text: "Turbo",
					value: "turbo",
				},
				{
					text: "Parula",
					value: "parpula",
				},
				{
					text: "Civi",
					value: "cividis",
				},
				{
					text: "terrain",
					value: "terrain",
				},
			],
		},
	];

	const formContent = window.createEnhancedFormContent(fields, false, true);

	// Step 4) Add boundary info if polygon is selected
	if (selectedPolygon) {
		const boundaryInfo = document.createElement("div");
		boundaryInfo.style.gridColumn = "1 / -1";
		boundaryInfo.style.padding = "8px";
		boundaryInfo.style.backgroundColor = "rgba(50, 255, 100, 0.2)";
		boundaryInfo.style.border = "1px solid #4caf50";
		boundaryInfo.style.borderRadius = "4px";
		boundaryInfo.style.fontSize = "11px";
		boundaryInfo.innerHTML = "✅ Selected boundary: " + selectedPolygon.entityName;
		formContent.insertBefore(boundaryInfo, formContent.firstChild);
	}

	// Step 5) Add HONEST notes section
	const notesDiv = document.createElement("div");
	notesDiv.style.gridColumn = "1 / -1";
	notesDiv.style.marginTop = "10px";
	notesDiv.style.fontSize = "10px";
	notesDiv.style.color = "#888";
	notesDiv.innerHTML = `
			<strong>Triangulation:</strong><br>
			✅ Handles XY duplicate points with different Z elevations<br>
			✅ Uses Constrainautor to constrain trianges to breaklines<br>
			✅ Cull triangles by internal angle, edge length, and boundary clipping<br>
			<strong>Approach:</strong><br>
			• Uses proven Delaunator + Constrainautor<br>
		`;

	formContent.appendChild(notesDiv);

	const dialog = new window.FloatingDialog({
		title: "Delaunay 2.5D Triangulation",
		content: formContent,
		layoutType: "wide",
		width: 520,
		height: 570,
		showConfirm: true,
		showCancel: true,
		confirmText: "Create",
		cancelText: "Cancel",
		onConfirm: async () => {
			const formData = window.getFormData(formContent);

			// Step 6) Validate surface name
			if (!formData.surfaceName || formData.surfaceName.trim() === "") {
				window.showErrorDialog("Invalid Surface Name", "Please enter a valid surface name");
				return;
			}

			// Step 7) Check for duplicate surface names
			const existingSurface = Array.from(window.loadedSurfaces.values()).find((surface) => surface.name === formData.surfaceName.trim());
			if (existingSurface) {
				window.showErrorDialog("Duplicate Surface Name", "A surface with this name already exists. Please choose a different name.");
				return;
			}

			// Step 8) Show loading message
			window.updateStatusMessage("Creating delaunay triangulation...");

			try {
				// Step 9) Process form data into triangulation parameters
				const params = processTriangulationFormData(formData);
				// ✅ FIX: Use surface name as the ID to maintain consistency
				const surfaceId = formData.surfaceName.trim();

				// ✅ FIX: Declare result as let instead of const for reassignment
				let result;

				// ✅ FIX: Choose triangulation method based on formData
				if (formData.useBreaklines === "yes") {
					console.log("🔗 Using constrained triangulation");

					// Step 10) Create progress dialog for triangulation
					const progressContent = `
                        <p>Creating Constrained Delaunay Triangulation</p>
                        <p>Please wait, this may take a moment...</p>
                        <div style="width: 100%; background-color: #333; border-radius: 5px; margin: 20px 0;">
                            <div id="triangulationProgressBar" style="width: 0%; height: 20px; background-color: #4CAF50; border-radius: 5px; transition: width 0.3s;"></div>
                        </div>
                        <p id="triangulationProgressText">Initializing...</p>
                    `;

					const progressDialog = new window.FloatingDialog({
						title: "Triangulation Progress",
						content: progressContent,
						layoutType: "standard",
						width: 400,
						height: 200,
						showConfirm: false,
						showCancel: false,
						allowOutsideClick: false,
					});

					progressDialog.show();

					// Step 11) Get progress bar and text elements
					const progressBar = document.getElementById("triangulationProgressBar");
					const progressText = document.getElementById("triangulationProgressText");

					// Step 12) Update progress function
					const updateProgress = (percent, message) => {
						if (progressBar) progressBar.style.width = percent + "%";
						if (progressText) progressText.textContent = message;
					};

					try {
						result = await window.createConstrainedDelaunayTriangulation(params, updateProgress);

						// Step 13) Close progress dialog
						setTimeout(() => {
							progressDialog.close();
						}, 500); // Small delay to show 100% completion
					} catch (error) {
						// Close dialog on error
						progressDialog.close();
						throw error;
					}

					// ✅ FIX: Fallback to basic triangulation if CDT fails
					if (!result || !result.resultTriangles || result.resultTriangles.length === 0) {
						console.warn("⚠️ CDT failed, falling back to basic triangulation");
						window.updateStatusMessage("CDT failed, using basic triangulation...");
						result = await window.createDelaunayTriangulation(params);
					}
				} else {
					console.log("🔺 Using basic Delaunay triangulation");
					result = await window.createDelaunayTriangulation(params);
				}

				if (result && result.resultTriangles && result.resultTriangles.length > 0) {
					const surface = {
						id: surfaceId,
						name: surfaceId,
						type: "delaunay",
						points: result.points || [],
						triangles: result.resultTriangles,
						created: new Date().toISOString(),
						visible: true,
						gradient: formData.surfaceStyle || "hillshade",
						transparency: 1.0,
						metadata: {
							algorithm: formData.useBreaklines === "yes" ? "constrained_delaunay" : "delaunay",
							pointCount: result.points ? result.points.length : 0,
							triangleCount: result.resultTriangles.length,
							constraintCount: result.constraintCount || 0,
							blastHolePointType: params.blastHolePoints || "none",
							cullingApplied: result.cullingStats || {},
						},
					};

					// Step 14) Add to loaded surfaces
					window.loadedSurfaces.set(surfaceId, surface);
					console.log("✅ Surface created:", surface.name, "with", result.resultTriangles.length, "triangles");

					// ✅ Apply boundary clipping if requested
					if (formData.clipToBoundary && formData.clipToBoundary !== "none") {
						const selectedPolygon = window.selectedKADObject && window.selectedKADObject.entityType === "poly" ? window.selectedKADObject : null;

						if (selectedPolygon) {
							console.log("🔪 Applying boundary clipping:", formData.clipToBoundary);
							window.updateStatusMessage("Applying boundary clipping...");

							const clippingSuccess = window.deleteTrianglesByClippingPolygon(surfaceId, formData.clipToBoundary);

							if (clippingSuccess) {
								const clippedSurface = window.loadedSurfaces.get(surfaceId);
								const clippedCount = result.resultTriangles.length - clippedSurface.triangles.length;
								console.log("✂️ Clipping applied:", clippedCount, "triangles removed,", clippedSurface.triangles.length, "remaining");
							} else {
								console.warn("⚠️ Boundary clipping failed");
							}
						}
					}

					// ✅ Apply internal angle filtering
					if (params.minAngle > 0) {
						console.log("📐 Applying internal angle filtering:", params.minAngle + "°", "3D:", params.consider3DAngle);
						window.updateStatusMessage("Filtering by internal angle...");

						const angleFilterSuccess = window.deleteTrianglesByInternalAngle(surfaceId, params.minAngle, params.consider3DAngle);
						if (angleFilterSuccess) {
							const filteredSurface = window.loadedSurfaces.get(surfaceId);
							console.log("📐 Angle filtering applied:", filteredSurface.triangles.length, "triangles remaining");
						}
					}

					// ✅ Apply edge length filtering
					if (params.maxEdgeLength > 0) {
						console.log("📏 Applying edge length filtering: max =", params.maxEdgeLength, "3D:", params.consider3DLength);
						window.updateStatusMessage("Filtering by edge length...");

						const edgeFilterSuccess = window.deleteTrianglesByEdgeLength(surfaceId, 0, params.maxEdgeLength, params.consider3DLength);
						if (edgeFilterSuccess) {
							const filteredSurface = window.loadedSurfaces.get(surfaceId);
							console.log("📏 Edge filtering applied:", filteredSurface.triangles.length, "triangles remaining");
						}
					}

					// Step 15) Final status message with all filtering applied
					const finalSurface = window.loadedSurfaces.get(surfaceId);
					const totalRemoved = result.resultTriangles.length - finalSurface.triangles.length;

					// Step 16) Save to database
					try {
						await window.saveSurfaceToDB(surfaceId);
						console.log("💾 Surface saved to database successfully");
					} catch (saveError) {
						console.error("❌ Failed to save surface to database:", saveError);
					}

					// Step 17) Update UI
					window.updateCentroids();
					window.drawData(window.allBlastHoles, window.selectedHole);
					window.debouncedUpdateTreeView();
					window.updateStatusMessage("Surface '" + surface.name + "' created with " + finalSurface.triangles.length + " triangles (" + totalRemoved + " filtered)");
				} else {
					window.updateStatusMessage("No triangles generated. Check your data and settings.");
				}
			} catch (error) {
				console.error("Error creating triangulation:", error);
				window.updateStatusMessage("Error creating triangulation: " + error.message);
			}

			// Step 18) Clear selections
			window.selectedKADPolygon = null;
			window.selectedKADObject = null;
			window.selectedPoint = null;
		},
		onCancel: () => {
			window.updateStatusMessage("");
			window.selectedKADPolygon = null;
			window.selectedKADObject = null;
			window.selectedPoint = null;
		},
	});

	dialog.show();

	// Step 19) Auto-focus the surface name field
	setTimeout(() => {
		const nameInput = formContent.querySelector("input[name='surfaceName']");
		if (nameInput) {
			nameInput.focus();
			nameInput.select();
		}
	}, 100);
}

// Step 20) Process form data into triangulation parameters
export function processTriangulationFormData(formData) {
	return {
		// Fix parameter names to match what createDelaunayTriangulation expects
		useCollars: formData.blastHolePoints === "collar",
		useGrade: formData.blastHolePoints === "grade",
		useToe: formData.blastHolePoints === "toe",
		useMLength: formData.blastHolePoints === "measuredLength",
		blastHolePoints: formData.blastHolePoints,
		xyzTolerance: parseFloat(formData.xyzTolerance),
		minAngle: parseFloat(formData.minInternalAngle),
		consider3DAngle: formData.consider3DAngle === "true",
		maxEdgeLength: parseFloat(formData.maxEdgeLength),
		consider3DLength: formData.consider3DLength === "true",
	};
}

//! SHOW OFFSET KAD POPUP
// Step 21) Dialog for offsetting KAD entities (lines and polygons)
export function showOffsetKADPopup(kadObject) {
	const entity = window.getEntityFromKADObject(kadObject);
	if (!entity) return;

	// Step 22) Create form content using the helper function
	const fields = [
		{
			label: "Offset (m) -ve = in, +ve = out",
			name: "offsetAmount",
			type: "number",
			value: "1.0",
			step: "0.1",
			min: "-100",
			max: "100",
		},
		{
			label: "Projection (°) +ve° = up, -ve° = dn",
			name: "projectionAngle",
			type: "number",
			value: "0",
			step: "1",
			min: "-90",
			max: "90",
		},
		{
			label: "Number of Offsets",
			name: "numberOfOffsets",
			type: "number",
			value: "1",
			step: "1",
			min: "1",
			max: "10",
		},
		{
			label: "Priority Mode",
			name: "priorityMode",
			type: "select",
			value: "distance",
			options: [
				{
					value: "distance",
					text: "Distance Priority (total distance)",
				},
				{
					value: "vertical",
					text: "Vertical Priority (vertical distance)",
				},
			],
		},
		{
			label: "Offset Color",
			name: "offsetColor",
			type: "color",
			value: "#FF0000",
		},
		{
			label: "Handle Crossovers",
			name: "handleCrossovers",
			type: "checkbox",
			checked: true,
			labelInLeftColumn: false,
		},
	];

	const formContent = window.createEnhancedFormContent(fields, false, false);

	// Step 23) Add notes section
	const notesDiv = document.createElement("div");
	notesDiv.style.gridColumn = "1 / -1";
	notesDiv.style.marginTop = "10px";
	notesDiv.style.fontSize = "10px";
	notesDiv.style.color = "#888";
	notesDiv.innerHTML = `
                <strong>Notes:</strong><br>
                • Lines: Positive values offset to the right, negative to the left<br>
                • Polygons: Positive values offset outwards, negative to the left<br>
                • 0° = horizontal, +° = up slope, -° = down slope<br>
                • Distance Priority: 12m total distance from line<br>
                • Vertical Priority: 12m vertical offset (may be >12m total distance)<br>
                • Multiple offsets create lines at distance × 1, distance × 2, etc.<br>
                • Handle Crossovers creates clean connections at intersections
    `;
	formContent.appendChild(notesDiv);

	const dialog = new window.FloatingDialog({
		title: "Offset " + kadObject.entityType.toUpperCase() + ": " + kadObject.entityName,
		content: formContent,
		layoutType: "wide",
		width: 400,
		height: 400,
		showConfirm: true,
		showCancel: true,
		confirmText: "Offset",
		cancelText: "Cancel",
		onConfirm: () => {
			// Step 24) Get form values
			const formData = window.getFormData(formContent);

			const offsetParams = {
				baseAmount: parseFloat(formData.offsetAmount),
				projectionAngle: parseFloat(formData.projectionAngle),
				numberOfOffsets: parseInt(formData.numberOfOffsets),
				priorityMode: formData.priorityMode,
				color: formData.offsetColor,
				handleCrossovers: formData.handleCrossovers === "true",
				originalEntityName: kadObject.entityName,
			};

			// Step 25) Perform the offset operation
			window.performKADOffset(entity, offsetParams);
			window.selectedKADPolygon = null;
			window.selectedKADObject = null;
			window.selectedPoint = null;
			window.offsetKADButton.checked = false;
			window.isOffsetKAD = false;
			window.canvas.removeEventListener("click", window.handleOffsetKADClick);
			window.canvas.removeEventListener("touchstart", window.handleOffsetKADClick);
			window.updateStatusMessage("");
		},
		onCancel: () => {
			// Step 26) After popup closes, deactivate the offset tool
			window.offsetKADButton.checked = false;
			window.isOffsetKAD = false;
			window.canvas.removeEventListener("click", window.handleOffsetKADClick);
			window.canvas.removeEventListener("touchstart", window.handleOffsetKADClick);
			window.updateStatusMessage("");
			window.drawData(window.allBlastHoles, window.selectedHole);
			window.selectedKADPolygon = null;
			window.selectedKADObject = null;
			window.selectedPoint = null;
		},
	});

	dialog.show();

	// Step 27) Initialize JSColor after dialog shows
	setTimeout(() => {
		jscolor.install();
		// Force z-index on any JSColor elements
		const colorInputs = formContent.querySelectorAll("[data-jscolor]");
		colorInputs.forEach((input) => {
			if (input.jscolor) {
				input.jscolor.option("zIndex", 20000);
			}
		});
	}, 100);
}

//! SHOW RADII CONFIG POPUP
// Step 28) Dialog for creating radii/circles around selected entities
export function showRadiiConfigPopup(selectedEntities) {
	// Step 29) Analyze selected entities for counts and descriptions
	const entityCount = selectedEntities.length;
	const holeCount = selectedEntities.filter((e) => e.type === "hole").length;
	const kadCount = selectedEntities.filter((e) => e.type.startsWith("kad")).length;

	let entityDescription = "";
	if (holeCount > 0 && kadCount > 0) {
		entityDescription = holeCount + " hole(s) and " + kadCount + " KAD point(s)";
	} else if (holeCount > 0) {
		entityDescription = holeCount + " hole(s)";
	} else {
		entityDescription = kadCount + " KAD point(s)";
	}

	// Step 30) Inherit properties from first selected entity
	let inheritedLineWidth = 2.0; // Default fallback
	let inheritedColor = "#00FF00"; // Default fallback

	if (selectedEntities.length > 0) {
		const firstEntity = selectedEntities[0];

		// Step 31) Check for lineWidth in entity data
		if (firstEntity.data && firstEntity.data.lineWidth !== undefined) {
			inheritedLineWidth = firstEntity.data.lineWidth;
		} else if (firstEntity.data && firstEntity.data.data && firstEntity.data.data.length > 0) {
			// Check first point in KAD data array
			const firstPoint = firstEntity.data.data[0];
			if (firstPoint && firstPoint.lineWidth !== undefined) {
				inheritedLineWidth = firstPoint.lineWidth;
			}
		}

		// Step 32) Check for color in entity data
		if (firstEntity.data && firstEntity.data.color !== undefined) {
			inheritedColor = firstEntity.data.color;
		} else if (firstEntity.data && firstEntity.data.colour !== undefined) {
			inheritedColor = firstEntity.data.colour;
		} else if (firstEntity.data && firstEntity.data.data && firstEntity.data.data.length > 0) {
			// Check first point in KAD data array
			const firstPoint = firstEntity.data.data[0];
			if (firstPoint && firstPoint.color !== undefined) {
				inheritedColor = firstPoint.color;
			} else if (firstPoint && firstPoint.colour !== undefined) {
				inheritedColor = firstPoint.colour;
			}
		}
	}

	// Step 33) Create form fields with inherited values and new rotation/starburst fields
	const fields = [
		{
			label: "Radius (m)",
			name: "radiiRadius",
			type: "number",
			value: "5.0",
			step: "0.1",
			min: "0.1",
			max: "100",
		},
		{
			label: "Circle Steps",
			name: "radiiSteps",
			type: "number",
			value: "16",
			step: "1",
			min: "3",
			max: "100",
		},
		{
			label: "Rotation Offset (°)",
			name: "rotationOffset",
			type: "number",
			value: "0.0",
			step: "1.0",
			min: "-360.0",
			max: "360.0",
		},
		{
			label: "Starburst Offset (%)",
			name: "starburstOffset",
			type: "number",
			value: "100.0",
			step: "1.0",
			min: "0.0",
			max: "100.0",
			disabled: true, // Step 34) Initially disabled - will be enabled if steps >= 8
		},
		{
			label: "Point Location",
			name: "radiiLocation",
			type: "select",
			value: "start",
			options: [
				{
					value: "start",
					text: "Start/Collar Location",
				},
				{
					value: "end",
					text: "End/Toe Location",
				},
			],
		},
		{
			label: "Line Width",
			name: "lineWidth",
			type: "number",
			value: inheritedLineWidth.toString(),
			step: "0.1",
			min: "0.1",
			max: "20",
		},
		{
			label: "Polygon Color",
			name: "radiiColor",
			type: "color",
			value: inheritedColor,
		},
		{
			label: "Union Circles",
			name: "unionCircles",
			type: "checkbox",
			checked: true,
			labelInLeftColumn: false,
		},
	];

	// Step 35) Create enhanced form content
	const formContent = window.createEnhancedFormContent(fields, false, false);

	// Step 36) Add dynamic behavior for starburst field based on steps
	const stepsInput = formContent.querySelector('input[name="radiiSteps"]');
	const starburstInput = formContent.querySelector('input[name="starburstOffset"]');
	const starburstLabel = formContent.querySelector('label[for="starburstOffset"]') || Array.from(formContent.querySelectorAll("label")).find((label) => label.textContent.includes("Starburst"));

	function updateStarburstAvailability() {
		const currentSteps = parseInt(stepsInput.value) || 0;
		const isStarburstEnabled = currentSteps >= 8;

		if (starburstInput) {
			starburstInput.disabled = !isStarburstEnabled;
			starburstInput.style.opacity = isStarburstEnabled ? "1" : "0.4";
			if (!isStarburstEnabled) {
				starburstInput.value = "100.0"; // Reset to 100% when disabled
			}
		}

		if (starburstLabel) {
			starburstLabel.style.opacity = isStarburstEnabled ? "1" : "0.4";
		}
	}

	// Step 37) Add event listener for steps input
	if (stepsInput) {
		stepsInput.addEventListener("input", updateStarburstAvailability);
		stepsInput.addEventListener("change", updateStarburstAvailability);
		// Initial check
		updateStarburstAvailability();
	}

	// Step 38) Add informational notes section with starburst limitation info
	const notesDiv = document.createElement("div");
	notesDiv.style.gridColumn = "1 / -1";
	notesDiv.style.marginTop = "10px";
	notesDiv.style.fontSize = "10px";
	notesDiv.style.color = "var(--text-color)";
	notesDiv.innerHTML =
		`
        <strong>Selected:</strong> ` +
		entityDescription +
		`<br>
        • Creates circular polygons around each point<br>
        • Union option combines overlapping circles<br>
        • Higher steps create smoother circles<br>
        • Line width inherited from first selected entity<br>
        • Rotation: 0° = no rotation, +45° = clockwise, -45° = counter-clockwise<br>
        • <strong>Starburst: Requires 8+ steps minimum</strong> (disabled for < 8 steps)<br>
        • Starburst: 100% = circle, 50% = even points at half radius, 0% = star shape<br>
        • Example: 5m radius + 50% starburst = odd points at 5m, even at 2.5m
    `;
	formContent.appendChild(notesDiv);

	// Step 39) Create FloatingDialog instance
	const dialog = new window.FloatingDialog({
		title: "Create Radii Polygons",
		content: formContent,
		layoutType: "wide",
		width: 420,
		height: 470, // Slightly taller for the extra note
		showConfirm: true,
		showCancel: true,
		confirmText: "Create",
		cancelText: "Cancel",
		onConfirm: () => {
			// Step 40) Get form values and validate
			const formData = window.getFormData(formContent);

			const radius = parseFloat(formData.radiiRadius);
			const steps = parseInt(formData.radiiSteps);
			const rotationOffset = parseFloat(formData.rotationOffset);
			let starburstOffset = parseFloat(formData.starburstOffset);
			const location = formData.radiiLocation;
			const lineWidth = parseFloat(formData.lineWidth);
			const unionCircles = formData.unionCircles === "true";
			const color = formData.radiiColor;

			// Step 41) Enhanced validation with starburst step requirement
			if (isNaN(radius) || radius <= 0) {
				window.showErrorDialog("Invalid Radius", "Please enter a valid radius > 0");
				return;
			}

			if (isNaN(steps) || steps < 3 || steps > 100) {
				window.showErrorDialog("Invalid Steps", "Steps must be between 3 and 100");
				return;
			}

			if (isNaN(rotationOffset) || rotationOffset < -360.0 || rotationOffset > 360.0) {
				window.showErrorDialog("Invalid Rotation", "Rotation offset must be between -360° and +360°");
				return;
			}

			// Step 42) Validate starburst only if it should be enabled
			if (steps >= 8) {
				if (isNaN(starburstOffset) || starburstOffset < 0.0 || starburstOffset > 100.0) {
					window.showErrorDialog("Invalid Starburst", "Starburst offset must be between 0% and 100%");
					return;
				}
			} else {
				// Force starburst to 100% for steps < 8 (now this works because starburstOffset is let)
				starburstOffset = 100.0;
			}

			if (isNaN(lineWidth) || lineWidth < 0.1 || lineWidth > 20) {
				window.showErrorDialog("Invalid Line Width", "Line width must be between 0.1 and 20");
				return;
			}

			// Step 43) Create radii parameters object (simplified logic since we handled it above)
			const radiiParams = {
				radius: radius,
				steps: steps,
				rotationOffset: rotationOffset,
				starburstOffset: starburstOffset / 100.0, // Convert percentage to decimal ratio
				useToeLocation: location === "end",
				unionCircles: unionCircles,
				color: color,
				lineWidth: lineWidth,
			};

			// Step 44) Perform radii creation
			window.createRadiiFromSelectedEntitiesFixed(selectedEntities, radiiParams);

			// Step 45) Clean up selection state using centralized function
			window.clearAllSelectionState();
			window.radiiHolesOrKADsTool.checked = false;
			window.resetFloatingToolbarButtons("none");
			window.updateStatusMessage("");
		},
		onCancel: () => {
			// Step 46) Clean up on cancel using centralized function
			window.clearAllSelectionState();
			window.radiiHolesOrKADsTool.checked = false;
			window.resetFloatingToolbarButtons("none");
			window.updateStatusMessage("");
		},
	});

	// Step 47) Show dialog and initialize color picker
	dialog.show();

	// Step 48) Initialize JSColor after dialog shows and recheck starburst availability
	setTimeout(() => {
		jscolor.install();
		// Force z-index on any JSColor elements
		const colorInputs = formContent.querySelectorAll("[data-jscolor]");
		colorInputs.forEach((input) => {
			if (input.jscolor) {
				input.jscolor.option("zIndex", 20000);
			}
		});

		// Final check of starburst availability after dialog is fully loaded
		updateStarburstAvailability();
	}, 100);
}

//===========================================
// EXPOSE FUNCTIONS GLOBALLY
//===========================================
// Step 49) Expose all functions globally for access from kirra.js
window.showTriangulationPopup = showTriangulationPopup;
window.showOffsetKADPopup = showOffsetKADPopup;
window.showRadiiConfigPopup = showRadiiConfigPopup;

console.log("✅ KADDialogs.js loaded successfully - 3 KAD dialogs extracted from kirra.js");
