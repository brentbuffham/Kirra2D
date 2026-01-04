// src/fileIO/ThreeJSMeshIO/OBJParser.js
//=============================================================
// OBJ FILE PARSER
//=============================================================
// Step 1) Parse Wavefront OBJ files into structured mesh data
// Step 2) Supports vertices, UVs, normals, faces, materials
// Step 3) Handles n-gon faces via fan triangulation
// Step 4) Returns Kirra-format triangles for surface rendering
// Step 5) Created: 2026-01-03

import BaseParser from "../BaseParser.js";

export default class OBJParser extends BaseParser {
	constructor() {
		super();
	}

	// Step 1) Main parse entry point
	async parse(data) {
		// Step 2) Validate input data
		if (!data || (!data.objContent && !data.content)) {
			throw new Error("OBJParser requires objContent or content parameter");
		}

		var objContent = data.objContent || data.content;
		var mtlContent = data.mtlContent || null;

		// Step 3) Call the core parsing logic
		var result = this.parseOBJData(objContent, mtlContent);

		return result;
	}

	// Step 2) Core OBJ parsing logic (extracted from kirra.js:36644-36828)
	parseOBJData(content, mtlContent) {
		// Step 3) Initialize data structures
		var vertices = []; // Vertex positions (v lines)
		var uvs = []; // Texture coordinates (vt lines)
		var normals = []; // Vertex normals (vn lines)
		var faces = []; // Face indices (f lines)
		var materialLibrary = ""; // MTL file reference (mtllib line)
		var currentMaterial = ""; // Current material name (usemtl line)
		var materialGroups = []; // Track which faces use which material

		// Step 4) Parse OBJ content line by line
		var lines = content.split("\n");

		for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
			var line = lines[lineIdx];
			var trimmedLine = line.trim();

			// Step 5) Skip empty lines and comments
			if (!trimmedLine || trimmedLine.startsWith("#")) {
				continue;
			}

			var parts = trimmedLine.split(/\s+/);
			var command = parts[0];

			// Step 6) Parse vertex positions (v x y z)
			if (command === "v" && parts.length >= 4) {
				var x = parseFloat(parts[1]);
				var y = parseFloat(parts[2]);
				var z = parseFloat(parts[3]);

				if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
					vertices.push({ x: x, y: y, z: z });
				}
			}
			// Step 7) Parse texture coordinates (vt u v)
			else if (command === "vt" && parts.length >= 3) {
				var u = parseFloat(parts[1]);
				var v = parseFloat(parts[2]);

				if (!isNaN(u) && !isNaN(v)) {
					uvs.push({ u: u, v: v });
				}
			}
			// Step 8) Parse vertex normals (vn x y z)
			else if (command === "vn" && parts.length >= 4) {
				var nx = parseFloat(parts[1]);
				var ny = parseFloat(parts[2]);
				var nz = parseFloat(parts[3]);

				if (!isNaN(nx) && !isNaN(ny) && !isNaN(nz)) {
					normals.push({ x: nx, y: ny, z: nz });
				}
			}
			// Step 9) Parse faces (f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 ...)
			else if (command === "f" && parts.length >= 4) {
				var faceVertices = [];
				var faceUVs = [];
				var faceNormals = [];

				// Step 10) Parse each vertex reference in the face
				for (var i = 1; i < parts.length; i++) {
					var indices = parts[i].split("/");

					// Vertex index (1-based in OBJ, convert to 0-based)
					var vIdx = parseInt(indices[0], 10) - 1;
					if (!isNaN(vIdx)) {
						faceVertices.push(vIdx);
					}

					// UV index (optional)
					if (indices.length > 1 && indices[1] !== "") {
						var uvIdx = parseInt(indices[1], 10) - 1;
						if (!isNaN(uvIdx)) {
							faceUVs.push(uvIdx);
						}
					}

					// Normal index (optional)
					if (indices.length > 2 && indices[2] !== "") {
						var nIdx = parseInt(indices[2], 10) - 1;
						if (!isNaN(nIdx)) {
							faceNormals.push(nIdx);
						}
					}
				}

				// Step 11) Triangulate faces with more than 3 vertices (fan triangulation)
				if (faceVertices.length >= 3) {
					for (var j = 1; j < faceVertices.length - 1; j++) {
						var triangle = {
							vertices: [faceVertices[0], faceVertices[j], faceVertices[j + 1]],
							uvs: [],
							normals: [],
							material: currentMaterial,
						};

						if (faceUVs.length >= faceVertices.length) {
							triangle.uvs = [faceUVs[0], faceUVs[j], faceUVs[j + 1]];
						}

						if (faceNormals.length >= faceVertices.length) {
							triangle.normals = [faceNormals[0], faceNormals[j], faceNormals[j + 1]];
						}

						faces.push(triangle);
					}
				}
			}
			// Step 12) Parse material library reference (mtllib filename.mtl)
			else if (command === "mtllib") {
				materialLibrary = parts.slice(1).join(" ");
			}
			// Step 13) Parse material usage (usemtl materialname)
			else if (command === "usemtl") {
				currentMaterial = parts.slice(1).join(" ");
				materialGroups.push({
					name: currentMaterial,
					startFace: faces.length,
				});
			}
		}

		// Step 14) Create points array for backward compatibility (same as vertices)
		var points = vertices.map(function (v) {
			return { x: v.x, y: v.y, z: v.z };
		});

		// Step 15) Build triangles array for surface rendering (Kirra format)
		var triangles = [];
		for (var faceIdx = 0; faceIdx < faces.length; faceIdx++) {
			var face = faces[faceIdx];
			if (face.vertices.length === 3) {
				var v0 = vertices[face.vertices[0]];
				var v1 = vertices[face.vertices[1]];
				var v2 = vertices[face.vertices[2]];

				if (v0 && v1 && v2) {
					var minZ = Math.min(v0.z, v1.z, v2.z);
					var maxZ = Math.max(v0.z, v1.z, v2.z);

					var triangleObj = {
						vertices: [
							{ x: v0.x, y: v0.y, z: v0.z },
							{ x: v1.x, y: v1.y, z: v1.z },
							{ x: v2.x, y: v2.y, z: v2.z },
						],
						minZ: minZ,
						maxZ: maxZ,
						uvs: face.uvs.length === 3 ? [uvs[face.uvs[0]], uvs[face.uvs[1]], uvs[face.uvs[2]]] : null,
						material: face.material,
					};

					triangles.push(triangleObj);
				}
			}
		}

		// Step 16) Determine if this OBJ has texture data
		var hasTexture = uvs.length > 0 && materialLibrary !== "";
		var hasFaces = faces.length > 0;

		console.log("OBJ Parser: " + vertices.length + " vertices, " + faces.length + " faces, " + uvs.length + " UVs, " + normals.length + " normals, hasTexture: " + hasTexture);

		// Step 17) Return enhanced data structure
		return {
			// For backward compatibility
			points: points,

			// Enhanced data
			vertices: vertices,
			faces: faces,
			uvs: uvs,
			normals: normals,
			triangles: triangles,

			// Material information
			materialLibrary: materialLibrary,
			materialGroups: materialGroups,

			// Flags
			hasTexture: hasTexture,
			hasFaces: hasFaces,

			// Raw content for persistence
			objContent: content,
			mtlContent: mtlContent || null,
		};
	}
}
