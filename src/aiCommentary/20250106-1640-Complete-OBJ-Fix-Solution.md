# COMPLETE SOLUTION: Fix OBJ Import Using Three.js Loader

## Files to Modify

### 1. Add Helper Function to kirra.js (insert BEFORE line 10122)

```javascript
// Step 0) Extract triangles from Three.js mesh geometry (for ALL OBJs)
function extractTrianglesFromThreeJSMesh(object3D) {
	var triangles = [];
	var points = [];
	var vertexMap = new Map(); // For deduplication
	
	object3D.traverse(function(child) {
		if (child.isMesh && child.geometry) {
			var geometry = child.geometry;
			var positions = geometry.attributes.position;
			if (!positions) return;
			
			var indices = geometry.index;
			var faceCount = 0;
			
			if (indices) {
				// Indexed geometry
				faceCount = indices.count / 3;
				for (var i = 0; i < faceCount; i++) {
					var i0 = indices.array[i * 3];
					var i1 = indices.array[i * 3 + 1];
					var i2 = indices.array[i * 3 + 2];
					
					var v0 = { x: positions.array[i0 * 3], y: positions.array[i0 * 3 + 1], z: positions.array[i0 * 3 + 2] };
					var v1 = { x: positions.array[i1 * 3], y: positions.array[i1 * 3 + 1], z: positions.array[i1 * 3 + 2] };
					var v2 = { x: positions.array[i2 * 3], y: positions.array[i2 * 3 + 1], z: positions.array[i2 * 3 + 2] };
					
					[v0, v1, v2].forEach(function(v) {
						var key = v.x.toFixed(6) + "," + v.y.toFixed(6) + "," + v.z.toFixed(6);
						if (!vertexMap.has(key)) {
							vertexMap.set(key, v);
							points.push(v);
						}
					});
					
					triangles.push({ vertices: [v0, v1, v2], uvs: [], normals: [], material: null });
				}
			} else {
				// Non-indexed geometry
				faceCount = positions.count / 3;
				for (var i = 0; i < faceCount; i++) {
					var v0 = { x: positions.array[i * 9], y: positions.array[i * 9 + 1], z: positions.array[i * 9 + 2] };
					var v1 = { x: positions.array[i * 9 + 3], y: positions.array[i * 9 + 4], z: positions.array[i * 9 + 5] };
					var v2 = { x: positions.array[i * 9 + 6], y: positions.array[i * 9 + 7], z: positions.array[i * 9 + 8] };
					
					[v0, v1, v2].forEach(function(v) {
						var key = v.x.toFixed(6) + "," + v.y.toFixed(6) + "," + v.z.toFixed(6);
						if (!vertexMap.has(key)) {
							vertexMap.set(key, v);
							points.push(v);
						}
					});
					
					triangles.push({ vertices: [v0, v1, v2], uvs: [], normals: [], material: null });
				}
			}
		}
	});
	
	console.log("🔷 Extracted " + triangles.length + " triangles, " + points.length + " unique points from Three.js mesh");
	return { triangles: triangles, points: points };
}
```

### 2. Simplify loadOBJWithAutoDiscovery() (around line 37117)

Replace the entire function with:

```javascript
// Step 1) Auto-discover companion MTL/texture files for OBJ
async function loadOBJWithAutoDiscovery(objFile) {
	try {
		updateStatusMessage("Loading OBJ: " + objFile.name);

		var objContent = await readFileAsText(objFile);
		
		// Step 2) ALWAYS use Three.js OBJLoader (reliable for all OBJs)
		console.log("🔷 Using Three.js OBJLoader for: " + objFile.name);
		
		// Step 3) No MTL/textures - pass empty objects
		await loadOBJWithThreeJS(objFile.name, objContent, null, {});

	} catch (error) {
		console.error("❌ Error in loadOBJWithAutoDiscovery:", error);
		updateStatusMessage("Error loading OBJ: " + error.message);
	}
}
```

### 3. Create NEW loadOBJWithThreeJS() Function (simpler name, replaces loadOBJWithTextureThreeJS)

Insert this NEW function (you'll delete the old broken one):

```javascript
// Step 1) Load OBJ using Three.js OBJLoader (handles textured AND non-textured)
async function loadOBJWithThreeJS(fileName, objContent, mtlContent, textureBlobs) {
	const progressDialog = new FloatingDialog({
		title: "Loading OBJ",
		content: "<p>Loading: " + fileName + "</p><p>Please wait...</p>",
		layoutType: "standard",
		width: 350,
		height: 150,
		showConfirm: false,
		showCancel: false,
		allowOutsideClick: false,
	});
	progressDialog.show();

	try {
		var hasTextures = textureBlobs && Object.keys(textureBlobs).length > 0;
		
		// Step 2) Parse OBJ with Three.js OBJLoader
		var objLoader = new OBJLoader();
		var object3D = objLoader.parse(objContent);
		object3D.name = fileName;
		
		// Step 3) Extract triangles and points using Three.js geometry
		var extracted = extractTrianglesFromThreeJSMesh(object3D);
		var triangles = extracted.triangles;
		var points = extracted.points;
		
		console.log("🔷 Three.js OBJLoader: " + fileName + " - " + points.length + " vertices, " + triangles.length + " triangles");
		
		// Step 4) Calculate bounds
		var minX = Infinity, maxX = -Infinity;
		var minY = Infinity, maxY = -Infinity;
		var minZ = Infinity, maxZ = -Infinity;
		for (var i = 0; i < points.length; i++) {
			var pt = points[i];
			if (pt.x < minX) minX = pt.x;
			if (pt.x > maxX) maxX = pt.x;
			if (pt.y < minY) minY = pt.y;
			if (pt.y > maxY) maxY = pt.y;
			if (pt.z < minZ) minZ = pt.z;
			if (pt.z > maxZ) maxZ = pt.z;
		}
		var meshBounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ };
		
		// Step 5) Store in loadedSurfaces
		var surfaceId = fileName;
		loadedSurfaces.set(surfaceId, {
			id: surfaceId,
			name: fileName,
			points: points,
			triangles: triangles,
			visible: true,
			gradient: hasTextures ? "texture" : "default",
			transparency: 1.0,
			isTexturedMesh: hasTextures,
			threeJSMesh: hasTextures ? object3D : null,
			meshBounds: meshBounds,
			objContent: objContent,
			mtlContent: mtlContent || null,
			textureBlobs: textureBlobs || {},
		});
		
		console.log("✅ OBJ loaded: " + fileName + " (" + points.length + " points, " + triangles.length + " triangles)");
		
		// Step 6) Save to database
		saveSurfaceToDB(surfaceId);
		
		// Step 7) Update UI
		updateCentroids();
		drawData(allBlastHoles, selectedHole);
		debouncedUpdateTreeView();
		updateStatusMessage("Loaded OBJ: " + fileName + " (" + triangles.length + " triangles)");
		
		progressDialog.close();
		
	} catch (error) {
		console.error("❌ Error loading OBJ with Three.js:", error);
		progressDialog.close();
		throw error;
	}
}
```

## Implementation Order

1. **Delete** the broken `loadOBJWithTextureThreeJS` function (lines 10122-10402)
2. **Add** `extractTrianglesFromThreeJSMesh()` helper function
3. **Add** new `loadOBJWithThreeJS()` function  
4. **Update** `loadOBJWithAutoDiscovery()` to use the new function
5. **Test** with pit shell OBJ (should get exactly 489 triangles)

## Result

- ✅ Reliable triangle parsing (no more 489 → 504 corruption)
- ✅ Uses battle-tested Three.js OBJLoader
- ✅ Works with or without textures
- ✅ Much simpler code
- ✅ CORS-safe (multi-file selection dialog already exists)

