// src/dialog/popups/generic/ExportDialogs.js
//=============================================================
// EXPORT DIALOG FUNCTIONS
//=============================================================
// Step 1) This file contains all export-related dialog functions previously in kirra.js
// Step 2) Currently includes IREDES (Epiroc) XML export with 9 helper functions

//! IREDES (EPIROC) XML EXPORT
// Step 3) Dialog for exporting blast holes to IREDES XML format
function saveIREDESPopup() {
	//testEpirocCRC(); // Add this line to test
	// Step 4) Filter visible blast holes using factory function
	const visibleBlastHoles = window.allBlastHoles.filter((hole) => window.isHoleVisible(hole));

	if (visibleBlastHoles.length === 0) {
		window.showModalMessage("No Visible Holes", "There are no visible holes to export.", "warning");
		return;
	}

	let blastName = visibleBlastHoles[0].entityName;

	console.log("blastName: " + blastName);

	// Step 5) Create form content using the enhanced helper function
	const fields = [
		{
			label: "File Name",
			name: "fileName",
			value: blastName + "_XML",
			placeholder: "File Name",
		},
		{
			label: "Drill Plan ID",
			name: "planID",
			value: blastName,
			placeholder: "Plan ID",
		},
		{
			label: "Site ID",
			name: "siteID",
			value: "SiteName",
			placeholder: "Site ID",
		},
		{
			label: "Notes (max 200 chars)",
			name: "notes",
			value: "Notes",
			placeholder: "Enter notes for the XML file",
		},
		{
			label: "Hole Options On (required for mwd)",
			name: "holeOptions",
			type: "checkbox",
			checked: true,
		},
		{
			label: "Set Measure While Drilling On",
			name: "mwdOn",
			type: "checkbox",
			checked: true,
		},
		{
			label: "Checksum Type",
			name: "chksumValue",
			type: "select",
			value: "CRC32-DECIMAL",
			options: [
				{
					value: "CRC32-DECIMAL",
					text: "CRC32 Decimal (Epiroc)",
				},
				{
					value: "CRC32-HEXBINARY",
					text: "HexBinary (XSD Spec)",
				},
				{
					value: "ZERO",
					text: "Zero",
				},
				{
					value: "NONE",
					text: "None",
				},
			],
		},
	];

	// Step 6) Create the form content
	const formContent = window.createEnhancedFormContent(fields, false, false);

	// Step 7) Add radio buttons for hole type handling
	const holeTypeSection = document.createElement("div");
	holeTypeSection.style.marginTop = "10px";
	holeTypeSection.style.padding = "8px";
	holeTypeSection.style.border = "1px solid #666";
	holeTypeSection.style.borderRadius = "4px";
	holeTypeSection.style.backgroundColor = "rgba(255, 255, 255, 0.05)";

	const holeTypeLabel = document.createElement("label");
	holeTypeLabel.textContent = "Hole Type Handling:";
	holeTypeLabel.className = "labelWhite12";
	holeTypeLabel.style.display = "block";
	holeTypeLabel.style.marginBottom = "8px";
	holeTypeLabel.style.fontWeight = "bold";
	holeTypeSection.appendChild(holeTypeLabel);

	const radioOptions = [
		{
			value: "Undefined",
			text: 'Set all holes to "Undefined" (Epiroc Standard)',
		},
		{
			value: "convert",
			text: "Convert hole types to integers (not recommended - Groups holes by type and assigns 1-15)",
		},
		{
			value: "current",
			text: "Use hole types currently assigned (not recommended - diameters will be unavailable on RCS)",
		},
	];

	radioOptions.forEach((option, index) => {
		const radioContainer = document.createElement("div");
		radioContainer.style.display = "flex";
		radioContainer.style.alignItems = "flex-start";
		radioContainer.style.marginBottom = "6px";
		radioContainer.style.gap = "8px";

		const radio = document.createElement("input");
		radio.type = "radio";
		radio.name = "holeTypeHandling";
		radio.value = option.value;
		radio.id = "holeTypeHandling_" + option.value;
		radio.checked = index === 0; // Default to first option

		// Step 8) Apply checkbox-like styling to radio buttons
		radio.style.width = "12px";
		radio.style.height = "12px";
		radio.style.margin = "0";
		radio.style.padding = "0";
		radio.style.border = "1px solid #999";
		radio.style.borderRadius = "4px"; //
		radio.style.backgroundColor = "#fff";
		radio.style.appearance = "none";
		radio.style.webkitAppearance = "none";
		radio.style.mozAppearance = "none";
		radio.style.position = "relative";
		radio.style.cursor = "pointer";
		radio.style.marginTop = "0px";

		// Step 9) Force the radio button color update
		const updateRadioColor = () => {
			if (radio.checked) {
				radio.style.backgroundColor = "var(--selected-color)";
				radio.style.borderColor = "var(--selected-color)";
				// Add a white dot in the center for selected radio
				radio.style.backgroundImage = "radial-gradient(circle, white 50%, transparent 50%)";
			} else {
				radio.style.backgroundColor = "#fff";
				radio.style.borderColor = "#999";
				radio.style.backgroundImage = "none";
			}
		};

		// Initial color
		updateRadioColor();

		// Step 10) Update color on change and handle radio group behavior
		radio.addEventListener("change", () => {
			// Update all radio buttons in the group
			const allRadios = formContent.querySelectorAll('input[name="holeTypeHandling"]');
			allRadios.forEach((r) => {
				if (r !== radio) {
					r.checked = false;
					// Update the color of unchecked radios
					if (r.checked) {
						r.style.backgroundColor = "var(--selected-color)";
						r.style.borderColor = "var(--selected-color)";
						r.style.backgroundImage = "radial-gradient(circle, white 50%, transparent 50%)";
					} else {
						r.style.backgroundColor = "#fff";
						r.style.borderColor = "#999";
						r.style.backgroundImage = "none";
					}
				}
			});
			updateRadioColor();
		});

		const radioLabel = document.createElement("label");
		radioLabel.htmlFor = "holeTypeHandling_" + option.value;
		radioLabel.textContent = option.text;
		radioLabel.className = "labelWhite12";
		radioLabel.style.fontSize = "10px";
		radioLabel.style.lineHeight = "1.3";
		radioLabel.style.margin = "0";
		radioLabel.style.flex = "1";

		radioContainer.appendChild(radio);
		radioContainer.appendChild(radioLabel);
		holeTypeSection.appendChild(radioContainer);
	});
	// Step 11) Add the hole type section to the form
	formContent.appendChild(holeTypeSection);

	// Step 12) Add note at the bottom
	const noteDiv = document.createElement("div");
	noteDiv.style.gridColumn = "1 / -1";
	noteDiv.style.marginTop = "10px";
	noteDiv.style.fontSize = "10px";
	noteDiv.style.color = "#888";
	noteDiv.textContent = "This is an XML file in the format of an Epiroc Drill Plan Export. Warning - Using hole types already attached to the blast hole may result in the diameter of the hole being ignored at the file import. Hole type conversion takes alpha values and converts to integer values that represent IREDES hole types mostly related to underground drilling.";
	formContent.appendChild(noteDiv);

	const dialog = new window.FloatingDialog({
		title: "Export IREDES file?",
		content: formContent,
		layoutType: "wide",
		showConfirm: true,
		showCancel: true,
		confirmText: "Confirm",
		cancelText: "Cancel",
		width: 500,
		height: 460,
		onConfirm: () => {
			// Step 13) Get form values
			const formData = window.getFormData(formContent);

			// Get radio button value
			const holeTypeHandling = formContent.querySelector('input[name="holeTypeHandling"]:checked').value;

			// Step 14) Validate required fields
			if (!formData.fileName || formData.fileName.trim() === "") {
				const errorDialog = new window.FloatingDialog({
					title: "File Name is Null or Invalid",
					content: "Please enter a valid file name.",
					layoutType: "default",
					width: 300,
					height: 120,
					showConfirm: true,
					confirmText: "OK",
					showCancel: false,
				});
				errorDialog.show();
				return;
			}

			if (!formData.planID || formData.planID.trim() === "") {
				const errorDialog = new window.FloatingDialog({
					title: "Invalid Plan ID",
					content: "Please enter a Drill Plan ID.",
					layoutType: "default",
					width: 300,
					height: 120,
					showConfirm: true,
					confirmText: "OK",
					showCancel: false,
				});
				errorDialog.show();
				return;
			}

			if (!formData.siteID || formData.siteID.trim() === "") {
				const errorDialog = new window.FloatingDialog({
					title: "Invalid Site ID",
					content: "Please enter a Site ID.",
					layoutType: "default",
					width: 300,
					height: 120,
					showConfirm: true,
					confirmText: "OK",
					showCancel: false,
				});
				errorDialog.show();
				return;
			}

			// Step 15) Process notes - limit to 200 characters and remove line breaks
			let processedNotes = formData.notes || "Notes";
			processedNotes = processedNotes.replace(/[\r\n]/g, " ").substring(0, 200);

			// Additional validation for notes length
			if (processedNotes.length > 200) {
				const errorDialog = new window.FloatingDialog({
					title: "Notes Too Long",
					content: "Notes must be 200 characters or less. Your notes have been truncated.",
					layoutType: "default",
					width: 300,
					height: 120,
					showConfirm: true,
					confirmText: "OK",
					showCancel: false,
				});
				errorDialog.show();
				return;
			}

			// Step 16) Generate the XML content using the updated convertPointsToIREDESXML function
			const xmlContent = convertPointsToIREDESXML(visibleBlastHoles, formData.fileName, formData.planID, formData.siteID, formData.holeOptions === "true", formData.mwdOn === "true", formData.chksumValue, processedNotes, holeTypeHandling);

			if (window.isIOS()) {
				// Create a Blob with the XML data
				const blob = new Blob([xmlContent], {
					type: "text/xml;charset=utf-8",
				});

				// Create a URL for the Blob
				const url = URL.createObjectURL(blob);

				// Create an anchor element with the download link
				const link = document.createElement("a");
				link.href = url;
				link.download = formData.fileName + ".xml";
				link.textContent = "Click here to download";

				// Append the link to the document
				document.body.appendChild(link);

				// Programmatically trigger the click event on the link
				link.click();

				// Remove the link from the document
				document.body.removeChild(link);
			} else {
				// Create an invisible anchor element
				const link = document.createElement("a");
				link.style.display = "none";

				// Set the XML content as the "href" attribute
				link.href = "data:text/xml;charset=utf-8," + encodeURIComponent(xmlContent);
				link.download = formData.fileName + ".xml";

				// Append the link to the document
				document.body.appendChild(link);

				// Programmatically trigger the click event on the link
				link.click();

				// Remove the link from the document
				document.body.removeChild(link);
			}
		},
		onCancel: () => {
			// Step 17) Clear any dragging states when dialog closes
			window.isDragging = false;
			clearTimeout(window.longPressTimeout);
		},
	});

	dialog.show();
}

//! IREDES HELPER FUNCTIONS
// Step 18) Helper function to convert blast holes to IREDES XML format
/**
 * Convert the allBlastHoles to an IREDES XML file
 * @param {object[]} allBlastHoles - The allBlastHoles to convert
 * @param {string} filename - The filename to use
 * @param {string} planID - The plan ID to use
 * @param {string} siteID - The site ID to use
 * @param {boolean} holeOptions - Whether to include hole options
 * @param {boolean} mwd - Whether to enable measure while drilling
 * @param {string} chksumType - The checksum type to use
 * @param {string} notes - Notes for the XML file
 * @param {string} holeTypeHandling - How to handle hole types (Undefined, convert, current)
 */
function convertPointsToIREDESXML(allBlastHoles, filename, planID, siteID, holeOptions, mwd, chksumType, notes, holeTypeHandling) {
	if (!allBlastHoles || !Array.isArray(allBlastHoles) || allBlastHoles.length === 0) return;

	const now = new Date();
	//convert now to the computer time zone
	now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

	let iredesPoints = [];

	// Step 19) Process hole types based on the selected handling option
	let holeTypeMapping = {};

	if (holeTypeHandling === "convert") {
		// Group holes by type and assign integers 1-15
		const holeTypes = [...new Set(allBlastHoles.map((hole) => hole.holeType || "Production"))];
		holeTypes.forEach((type, index) => {
			if (index < 15) {
				// Limit to 15 types as per IREDES standard
				holeTypeMapping[type] = (index + 1).toString();
			}
		});
	} else if (holeTypeHandling === "Undefined") {
		// Set all hole types to "Undefined"
		allBlastHoles.forEach((hole) => {
			holeTypeMapping[hole.holeType || "Production"] = "Undefined";
		});
	}
	// For "current" option, we don't modify the hole types

	allBlastHoles.forEach((hole) => {
		let processedHoleType = hole.holeType || "Production";

		// Apply hole type processing based on the selected option
		if (holeTypeHandling === "convert" && holeTypeMapping[processedHoleType]) {
			processedHoleType = holeTypeMapping[processedHoleType];
		} else if (holeTypeHandling === "Undefined") {
			processedHoleType = "Undefined";
		}

		iredesPoints.push({
			holeID: hole.holeID,
			startXLocation: hole.startXLocation,
			startYLocation: hole.startYLocation,
			startZLocation: hole.startZLocation,
			endXLocation: hole.endXLocation,
			endYLocation: hole.endYLocation,
			endZLocation: hole.endZLocation,
			holeDiameter: hole.holeDiameter,
			holeType: processedHoleType,
		});
	});

	iredesPoints.sort((a, b) => a.holeID.localeCompare(b.holeID));

	// Step 20) Format the date as YYYY-MM-DDTHH:mm:ss
	const formattedDate = now.toISOString().slice(0, 19);

	// Use the provided notes or default
	const processedNotes = notes || "Notes";

	const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>\r\n<!-- Generated by Kirra - https://blastingapps.com/kirra.html -->\r\n`;
	let xml = "" + xmlHeader + "<DRPPlan xmlns:IR=\"http://www.iredes.org/xml\" IRVersion=\"V 1.0\" IRDownwCompat=\"V 1.0\" DRPPlanDownwCompat=\"V 1.0\" DRPPlanVersion=\"V 1.0\" xmlns=\"http://www.iredes.org/xml/DrillRig\">\r\n";

	// Step 21) General Header
	xml += "  <IR:GenHead>\r\n";
	xml += "    <IR:FileCreateDate>" + formattedDate + "</IR:FileCreateDate>\r\n";
	xml += "      <IR:IRversion DownwCompat=\"V 1.0\">V 1.0</IR:IRversion>\r\n";
	xml += "    </IR:GenHead>\r\n";
	xml += "    <IR:PlanId>" + planID + "</IR:PlanId>\r\n";
	xml += "    <IR:PlanName>" + planID + "</IR:PlanName>\r\n";
	xml += "    <IR:Comment>" + processedNotes + "</IR:Comment>\r\n";
	xml += "    <IR:Project>" + siteID + "(Site)</IR:Project>\r\n";
	xml += "    <IR:WorkOrder>" + siteID + "(WorkOrder)</IR:WorkOrder>\r\n";

	// Step 22) Drill Position Plan
	xml += "  <DrillPosPlan IRVersion=\"V 1.0\" IRDownwCompat=\"V 1.0\">\r\n";
	xml += "    <IR:GenHead>\r\n";
	xml += "      <IR:FileCreateDate>" + formattedDate + "</IR:FileCreateDate>\r\n";
	xml += "      <IR:IRversion DownwCompat=\"V 1.0\">V 1.0</IR:IRversion>\r\n";
	xml += "    </IR:GenHead>\r\n";
	xml += "    <IR:PlanId>" + planID + "</IR:PlanId>\r\n";
	xml += "    <IR:PlanName>" + planID + "</IR:PlanName>\r\n";
	xml += "    <IR:Comment>" + processedNotes + "</IR:Comment>\r\n";
	xml += "    <IR:Project>" + siteID + "(Site)</IR:Project>\r\n";
	xml += "    <IR:WorkOrder>" + siteID + "(WorkOrder)</IR:WorkOrder>\r\n";

	// Step 23) Position Data
	xml += "    <PositionData>\r\n";
	xml += "      <Coordsystem>\r\n";
	xml += "        <IR:CoordSysName>local</IR:CoordSysName>\r\n";
	xml += "        <IR:TMatrix>\r\n";
	xml += "          <IR:Col>\r\n";
	xml += "            <IR:x>1.000</IR:x>\r\n";
	xml += "            <IR:y>0.000</IR:y>\r\n";
	xml += "            <IR:z>0.000</IR:z>\r\n";
	xml += "            <IR:w>0.000</IR:w>\r\n";
	xml += "          </IR:Col>\r\n";
	xml += "          <IR:Col>\r\n";
	xml += "            <IR:x>0.000</IR:x>\r\n";
	xml += "            <IR:y>1.000</IR:y>\r\n";
	xml += "            <IR:z>0.000</IR:z>\r\n";
	xml += "            <IR:w>0.000</IR:w>\r\n";
	xml += "          </IR:Col>\r\n";
	xml += "          <IR:Col>\r\n";
	xml += "            <IR:x>0.000</IR:x>\r\n";
	xml += "            <IR:y>0.000</IR:y>\r\n";
	xml += "            <IR:z>1.000</IR:z>\r\n";
	xml += "            <IR:w>0.000</IR:w>\r\n";
	xml += "          </IR:Col>\r\n";
	xml += "          <IR:Col>\r\n";
	xml += "            <IR:x>0.000</IR:x>\r\n";
	xml += "            <IR:y>0.000</IR:y>\r\n";
	xml += "            <IR:z>0.000</IR:z>\r\n";
	xml += "            <IR:w>1.000</IR:w>\r\n";
	xml += "          </IR:Col>\r\n";
	xml += "        </IR:TMatrix>\r\n";
	xml += "        <IR:CsysType>L</IR:CsysType>\r\n";
	xml += "      </Coordsystem>\r\n";
	xml += "      <PlanIdRef />\r\n";
	xml += "      <Bearing>0.000</Bearing>\r\n";
	xml += "    </PositionData>\r\n";
	xml += "  </DrillPosPlan>\r\n";

	// Step 24) DrillPlan
	xml += "  <DrillPlan>\r\n";
	xml += "  <NumberOfHoles>" + iredesPoints.length + "</NumberOfHoles>\r\n";

	// Step 25) Holes
	for (let i = 0; i < iredesPoints.length; i++) {
		const iredesPoint = iredesPoints[i];
		xml += "    <Hole>\r\n";
		xml += "      <HoleId>" + iredesPoint.holeID.trim() + "</HoleId>\r\n";
		xml += "      <HoleName>" + iredesPoint.holeID.trim() + "</HoleName>\r\n";
		xml += "      <StartPoint>\r\n";
		xml += "        <IR:PointX>" + iredesPoint.startYLocation.toFixed(3) + "</IR:PointX>\r\n";
		xml += "        <IR:PointY>" + iredesPoint.startXLocation.toFixed(3) + "</IR:PointY>\r\n";
		xml += "        <IR:PointZ>" + iredesPoint.startZLocation.toFixed(3) + "</IR:PointZ>\r\n";
		xml += "      </StartPoint>\r\n";
		xml += "      <EndPoint>\r\n";
		xml += "        <IR:PointX>" + iredesPoint.endYLocation.toFixed(3) + "</IR:PointX>\r\n";
		xml += "        <IR:PointY>" + iredesPoint.endXLocation.toFixed(3) + "</IR:PointY>\r\n";
		xml += "        <IR:PointZ>" + iredesPoint.endZLocation.toFixed(3) + "</IR:PointZ>\r\n";
		xml += "      </EndPoint>\r\n";
		xml += "      <TypeOfHole>" + iredesPoint.holeType.trim() + "</TypeOfHole>\r\n";
		xml += "      <DrillBitDia>" + iredesPoint.holeDiameter + "</DrillBitDia>\r\n";
		xml += "      <MwdOn>" + (mwd ? "1" : "0") + "</MwdOn>\r\n";
		xml += "      <HoleOptions xmlns:opt=\"opt\">\r\n";
		xml += "        <opt:HoleData>\r\n";
		xml += "          <ExtendedHoleStatus>" + (iredesPoint.measuredLength ? "Drilled" : "Undrilled") + "</ExtendedHoleStatus>\r\n";
		xml += "        </opt:HoleData>\r\n";
		xml += "      </HoleOptions>\r\n";
		xml += "    </Hole>\r\n";
	}

	// Step 26) Placeholder for the checksum with the string "0"
	const checksumPlaceholder = "0";

	// Step 27) Closing the XML
	xml += "    <EquipmentData xmlns=\"\">\r\n";
	xml += "      <IR:OptionData />\r\n";
	xml += "    </EquipmentData>\r\n";
	xml += "  </DrillPlan>\r\n";
	xml += "  <IR:GenTrailer>\r\n";
	xml += "    <IR:FileCloseDate>" + formattedDate + "</IR:FileCloseDate>\r\n";
	xml += "    <IR:ChkSum>" + checksumPlaceholder + "</IR:ChkSum>\r\n";
	xml += "  </IR:GenTrailer>\r\n";
	xml += "</DRPPlan>";

	// Step 28) Calculate CRC32 of the ENTIRE XML (including the "0")
	let checksum = crc32(xml, chksumType);

	// Step 29) Replace the "0" with the calculated checksum
	if (chksumType === "CRC32-DECIMAL") {
		xml = xml.replace(/<IR:ChkSum>0<\/IR:ChkSum>/, "<IR:ChkSum>" + checksum + "</IR:ChkSum>");
	} else if (chksumType === "CRC32-HEXBINARY") {
		xml = xml.replace(/<IR:ChkSum>0<\/IR:ChkSum>/, "<IR:ChkSum>" + checksum + "</IR:ChkSum>");
	} else if (chksumType === "NONE") {
		xml = xml.replace(/<IR:ChkSum>0<\/IR:ChkSum>/, "<IR:ChkSum> </IR:ChkSum>");
	} else {
	}

	return xml;
}

// Step 30) Calculate the CRC32 checksum of a string - CORRECTED VERSION
/**
 * Calculate the CRC32 checksum of a string
 * @param {string} str - The string to calculate the checksum of
 * @param {string} chksumType - The type of checksum to calculate
 * @returns {number|string} - The checksum in the specified format
 */
function crc32(str, chksumType) {
	const table = new Uint32Array(256);
	for (let i = 256; i--;) {
		let tmp = i;
		for (let k = 8; k--;) {
			tmp = tmp & 1 ? 3988292384 ^ (tmp >>> 1) : tmp >>> 1;
		}
		table[i] = tmp;
	}

	let crc = 0xffffffff;
	for (let i = 0, l = str.length; i < l; i++) {
		crc = (crc >>> 8) ^ table[(crc ^ str.charCodeAt(i)) & 255];
	}

	crc = crc >>> 0; // Ensure unsigned

	// Format depending on chksumType
	if (chksumType === "CRC32-HEXBINARY") {
		return crc.toString(16).toUpperCase();
	} else {
		return crc;
	}
}

// Step 31) Validate the IREDES XML file - CORRECTED VERSION
/**
 * Validate the IREDES XML file
 * @param {string} xmlContent - The XML content to validate
 * @returns {object} - An object containing the validation result
 * @returns {boolean} valid - Whether the checksum is valid
 * @returns {string} originalChecksum - The original checksum
 * @returns {string} calculatedChecksum - The calculated checksum
 * @returns {string} error - The error message if the checksum is invalid
 */
function validateIREDESXML(xmlContent) {
	// Extract the checksum from the XML
	const checksumMatch = xmlContent.match(/<IR:ChkSum>([^<]+)<\/IR:ChkSum>/);
	if (!checksumMatch) {
		return {
			valid: false,
			error: "No checksum found in XML",
		};
	}

	const originalChecksum = checksumMatch[1].trim(); // FIXED: Added trim to handle whitespace

	// Replace the checksum with "0" for validation
	const xmlForValidation = xmlContent.replace(/<IR:ChkSum>[^<]+<\/IR:ChkSum>/, "<IR:ChkSum>0</IR:ChkSum>");

	// Calculate the checksum of the modified XML
	const calculatedChecksum = crc32(xmlForValidation);

	// Compare checksums (handle both decimal and hex formats)
	let isValid = false;
	const originalTrimmed = originalChecksum.trim();
	const calculatedStr = calculatedChecksum.toString();

	if (originalTrimmed === calculatedStr) {
		isValid = true; // Decimal match
	} else if (originalTrimmed.toUpperCase() === parseInt(calculatedChecksum, 10).toString(16).toUpperCase()) {
		isValid = true; // Hex match
	} else if (parseInt(originalTrimmed, 16).toString(10) === calculatedStr) {
		isValid = true; // Original was hex, calculated is decimal
	}

	return {
		valid: isValid,
		originalChecksum: originalChecksum,
		calculatedChecksum: calculatedChecksum,
		xmlForValidation: xmlForValidation, // ADDED: For debugging
		xmlLength: xmlForValidation.length, // ADDED: For debugging
		error: isValid ? null : "Checksum validation failed",
	};
}

// Step 32) Test the IREDES XML checksum validation with debug output
/**
 * Test the IREDES XML checksum validation with debug output
 * @param {string} xmlContent - The XML content to test
 * @returns {object} - Debug information and validation result
 */
function testIREDESChecksumDebug(xmlContent) {
	console.log("=== IREDES CHECKSUM DEBUG TEST ===");

	// Extract original checksum
	const checksumMatch = xmlContent.match(/<IR:ChkSum>([^<]+)<\/IR:ChkSum>/);
	if (!checksumMatch) {
		console.log("ERROR: No checksum found in XML");
		return { error: "No checksum found" };
	}

	const originalChecksum = checksumMatch[1];
	console.log("Original checksum: " + originalChecksum);

	// Create validation XML with "0" placeholder
	const xmlForValidation = xmlContent.replace(/<IR:ChkSum>[^<]+<\/IR:ChkSum>/, "<IR:ChkSum>0</IR:ChkSum>");
	console.log("XML length with '0' placeholder: " + xmlForValidation.length);

	// Calculate CRC32
	const calculatedChecksum = crc32(xmlForValidation);
	console.log("Calculated CRC32: " + calculatedChecksum);
	console.log("Calculated CRC32 (hex): " + calculatedChecksum.toString(16).toUpperCase());

	// Test matches
	const decimalMatch = originalChecksum === calculatedChecksum.toString();
	const hexToDecimalMatch = parseInt(originalChecksum, 16).toString() === calculatedChecksum.toString();
	const decimalToHexMatch = originalChecksum.toUpperCase() === calculatedChecksum.toString(16).toUpperCase();

	console.log("Decimal match: " + decimalMatch);
	console.log("Hex to decimal match: " + hexToDecimalMatch);
	console.log("Decimal to hex match: " + decimalToHexMatch);

	const isValid = decimalMatch || hexToDecimalMatch || decimalToHexMatch;
	console.log("Final validation result: " + isValid);

	return {
		originalChecksum: originalChecksum,
		calculatedChecksum: calculatedChecksum,
		xmlLength: xmlForValidation.length,
		valid: isValid,
		decimalMatch: decimalMatch,
		hexToDecimalMatch: hexToDecimalMatch,
		decimalToHexMatch: decimalToHexMatch,
	};
}

// Step 33) Test with the actual Epiroc XML content
function testEpirocCRC() {
	// Copy the entire Epiroc XML content and replace the checksum with "0"
	const epirocXML = "PASTE XML HERE";

	const calculatedCRC = crc32(epirocXML, "CRC32-DECIMAL");
	console.log("Epiroc test - Expected: 1723439548, Got:", calculatedCRC);
	console.log("Match:", calculatedCRC === 1723439548);
}

//! ALTERNATE CHECKSUMS
// Step 34) Alternative checksum functions for testing/validation
function decimalChecksum(str) {
	let checksum = 0;
	for (let i = 0; i < str.length; i++) {
		checksum += str.charCodeAt(i);
	}
	return checksum;
}

function calculateMD5Checksum(data) {
	const hash = CryptoJS.MD5(data);
	return hash.toString();
}

function calculateSHA1Checksum(data) {
	const hash = CryptoJS.SHA1(data);
	return hash.toString();
}

function calculateSHA256Checksum(data) {
	const hash = CryptoJS.SHA256(data);
	return hash.toString();
}

//===========================================
// EXPOSE FUNCTIONS GLOBALLY
//===========================================
// Step 35) Expose all functions globally for access from kirra.js
window.saveIREDESPopup = saveIREDESPopup;
window.convertPointsToIREDESXML = convertPointsToIREDESXML;
window.crc32 = crc32;
window.validateIREDESXML = validateIREDESXML;
window.testIREDESChecksumDebug = testIREDESChecksumDebug;
window.testEpirocCRC = testEpirocCRC;
window.decimalChecksum = decimalChecksum;
window.calculateMD5Checksum = calculateMD5Checksum;
window.calculateSHA1Checksum = calculateSHA1Checksum;
window.calculateSHA256Checksum = calculateSHA256Checksum;

console.log("✅ ExportDialogs.js loaded successfully - IREDES (Epiroc) export with 9 helpers extracted from kirra.js");
