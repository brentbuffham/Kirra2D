# Application Architecture

## File Structure

```
Kirra/
├── kirra.html              # Main application HTML entry point
├── vite.config.js          # Vite build configuration
├── package.json            # NPM dependencies and scripts
│
├── src/                    # Application source code
│   ├── kirra.js           # Main application logic (~40,000 lines)
│   ├── kirra.css          # Application styles
│   │
│   ├── fileIO/            # File I/O system (modular architecture)
│   │   ├── FileManager.js      # Central parser/writer registry
│   │   ├── BaseParser.js       # Base class for all parsers
│   │   ├── BaseWriter.js       # Base class for all writers
│   │   ├── init.js             # Registration of all formats
│   │   │
│   │   ├── AutoCadIO/          # DXF ASCII + Binary parsers/writers
│   │   │   ├── DXFParser.js
│   │   │   ├── BinaryDXFParser.js
│   │   │   ├── DXFHOLESWriter.js
│   │   │   ├── DXFKADWriter.js
│   │   │   ├── DXFVulcanWriter.js
│   │   │   ├── DXF3DFACEWriter.js
│   │   │   ├── BinaryDXFWriter.js
│   │   │   └── DXFUtils.js
│   │   │
│   │   ├── CBlastIO/           # Orica CBLAST CSV format
│   │   │   ├── CBLASTParser.js
│   │   │   └── CBLASTWriter.js
│   │   │
│   │   ├── EpirocIO/           # Epiroc formats (IREDES, Surface Manager)
│   │   │   ├── IREDESParser.js
│   │   │   ├── IREDESWriter.js
│   │   │   ├── SurfaceManagerParser.js
│   │   │   └── SurfaceManagerWriter.js
│   │   │
│   │   ├── EsriIO/             # ESRI Shapefile formats
│   │   │   ├── SHPFileParser.js
│   │   │   └── SHPFileWriter.js
│   │   │
│   │   ├── GoogleMapsIO/       # KML/KMZ import/export
│   │   │   ├── KMLKMZParser.js
│   │   │   └── KMLKMZWriter.js
│   │   │
│   │   ├── ImageIO/            # GeoTIFF raster formats
│   │   │   ├── IMGParser.js
│   │   │   └── IMGWriter.js
│   │   │
│   │   ├── KirraIO/            # Kirra native KAD format
│   │   │   ├── KADParser.js
│   │   │   └── KADWriter.js
│   │   │
│   │   ├── LasFileIO/          # LiDAR LAS format
│   │   │   ├── LASParser.js
│   │   │   └── LASWriter.js
│   │   │
│   │   ├── MinestarIO/         # Cat MineStar AQM format
│   │   │   └── AQMWriter.js
│   │   │
│   │   ├── OricaIO/            # Orica ShotPlus SPF format
│   │   │   └── SPFParser.js
│   │   │
│   │   ├── PointCloudIO/       # XYZ, PTS, PTX, CSV point clouds
│   │   │   ├── PointCloudParser.js
│   │   │   └── PointCloudWriter.js
│   │   │
│   │   ├── SurpacIO/           # Surpac DTM/STR formats
│   │   │   ├── SurpacDTMParser.js
│   │   │   ├── SurpacDTMWriter.js
│   │   │   ├── SurpacSTRParser.js
│   │   │   ├── SurpacSTRWriter.js
│   │   │   └── SurpacSurfaceParser.js
│   │   │
│   │   ├── TextIO/             # CSV and text formats
│   │   │   ├── BlastHoleCSVParser.js
│   │   │   ├── BlastHoleCSVWriter.js
│   │   │   ├── CustomBlastHoleTextParser.js
│   │   │   └── CustomBlastHoleTextWriter.js
│   │   │
│   │   ├── ThreeJSMeshIO/      # 3D mesh formats (OBJ, PLY, GLTF)
│   │   │   ├── OBJParser.js
│   │   │   ├── OBJWriter.js
│   │   │   ├── PLYParser.js
│   │   │   ├── GLTFParser.js
│   │   │   └── GLTFWriter.js
│   │   │
│   │   └── WencoIO/            # Wenco NAV ASCII format
│   │       ├── NAVAsciiParser.js
│   │       └── NAVAsciiWriter.js
│   │
│   ├── dialog/                 # Dialog system
│   │   ├── FloatingDialog.js   # Base dialog class
│   │   ├── TreeView.js         # Tree view panel
│   │   ├── menuBar/            # Menu bar system
│   │   │   ├── fileMenu.js
│   │   │   ├── editMenu.js
│   │   │   ├── viewMenu.js
│   │   │   ├── patternMenu.js
│   │   │   └── settingsMenu.js
│   │   └── popups/
│   │       ├── generic/        # Generic dialogs
│   │       │   ├── AddPatternDialog.js
│   │       │   ├── PolygonPatternDialog.js
│   │       │   ├── LinePatternDialog.js
│   │       │   ├── HolePropertiesDialog.js
│   │       │   └── ProjectionDialog.js
│   │       └── export/         # Export dialogs
│   │           └── ExportOptionsDialog.js
│   │
│   ├── helpers/                # Utility functions
│   │   ├── BlastStatistics.js  # Statistics calculations
│   │   ├── FormulaEvaluator.js # Formula parser/evaluator
│   │   ├── GeoTIFFExporter.js  # GeoTIFF export orchestration
│   │   └── SurfaceRasterizer.js # Surface rendering to canvas
│   │
│   ├── print/                  # PDF/SVG export system
│   │   ├── PrintSystem.js      # Main print orchestration
│   │   ├── PrintStats.js       # Statistics formatting
│   │   └── PrintRendering.js   # SVG rendering functions
│   │
│   ├── charging/               # Charging system module
│   │   ├── index.js            # Module entry point
│   │   ├── ChargeConfig.js     # Charge configuration class
│   │   ├── Deck.js             # Deck definition class
│   │   ├── Primer.js           # Primer positioning class
│   │   ├── HoleCharging.js     # Per-hole charge application
│   │   ├── DecoupledContent.js # Decoupled deck calculations
│   │   ├── ChargingDatabase.js # IndexedDB operations
│   │   ├── ChargingValidation.js # Validation logic
│   │   ├── ChargingRemapper.js # Data transformation
│   │   ├── ChargingConstants.js # Constants and enums
│   │   ├── ConfigImportExport.js # CSV import/export
│   │   ├── ProductDialog.js    # Product management UI
│   │   │
│   │   ├── products/           # Product type classes
│   │   │   ├── Product.js
│   │   │   ├── BulkExplosiveProduct.js
│   │   │   ├── HighExplosiveProduct.js
│   │   │   ├── InitiatorProduct.js
│   │   │   ├── NonExplosiveProduct.js
│   │   │   ├── SpacerProduct.js
│   │   │   └── productFactory.js
│   │   │
│   │   ├── rules/              # Rule engine
│   │   │   └── SimpleRuleEngine.js
│   │   │
│   │   ├── ui/                 # Charging UI components
│   │   │   ├── DeckBuilderDialog.js
│   │   │   ├── HoleSectionView.js
│   │   │   └── ConnectorPresets.js
│   │   │
│   │   └── docs/               # Charging documentation
│   │       ├── ChargeConfigCSV-README.md
│   │       ├── 2DChargingView.jpg
│   │       ├── 2DholeLoadingView.jpg
│   │       └── 3DChargingView.jpg
│   │
│   ├── three/                  # Three.js 3D rendering
│   │   ├── ThreeRenderer.js    # Core Three.js setup
│   │   ├── CameraControls.js   # Custom orbit controls
│   │   ├── GeometryFactory.js  # Shape creation utilities
│   │   └── InteractionManager.js # Mouse/touch events
│   │
│   ├── draw/                   # Canvas drawing functions
│   │   ├── canvas2DDrawing.js  # 2D canvas rendering
│   │   └── canvas3DDrawing.js  # Three.js rendering
│   │
│   ├── tools/                  # Interactive tools
│   │   ├── MeasurementTool.js  # Distance/area measurement
│   │   └── SnapTool.js         # Snap-to-point logic
│   │
│   ├── toolbar/                # Toolbar UI
│   │   └── Toolbar.js
│   │
│   ├── overlay/                # Canvas overlays
│   │   └── CanvasOverlay.js
│   │
│   ├── fonts/                  # Web fonts
│   │   └── (font files)
│   │
│   ├── aiCommentary/           # Development documentation
│   │   └── (AI session notes)
│   │
│   ├── aiPlans/                # Development plans
│   │   └── (Planning documents)
│   │
│   └── referenceFiles/         # Reference documentation
│       └── (Spec files)
│
├── public/                     # Static assets
│   ├── translations/           # i18n JSON files
│   │   ├── en.json
│   │   ├── ru.json
│   │   └── es.json
│   └── icons/                  # Application icons
│
├── libs/                       # External libraries
│   ├── plotly-2.35.2.min.js
│   ├── d3.v7.min.js
│   └── (other vendor libs)
│
└── docs/                       # Documentation
    └── (GitHub Pages content)
```

## Key Source Files

| File | Lines | Description |
|------|-------|-------------|
| `src/kirra.js` | ~40,000 | Main application logic, global state, canvas orchestration |
| `src/fileIO/FileManager.js` | ~275 | Central file I/O registry with parser/writer dispatch |
| `src/fileIO/init.js` | ~478 | Registration of all parsers and writers |
| `src/charging/index.js` | ~1,500 | Charging system entry point and exports |
| `src/three/ThreeRenderer.js` | ~800 | Three.js scene, camera, lighting setup |
| `src/dialog/FloatingDialog.js` | ~600 | Reusable dialog system |
| `src/helpers/BlastStatistics.js` | ~400 | Statistics calculation engine |
| `src/print/PrintSystem.js` | ~1,200 | SVG-based PDF generation |

## Technology Stack

- **Build System**: Vite 7.1.12
- **3D Rendering**: Three.js r170
- **Visualization**: Plotly.js 2.35.2, D3.js v7
- **Language**: Vanilla JavaScript (ES6+ modules)
- **Storage**: IndexedDB (via native API)
- **UI**: Custom dialog system, no framework dependencies

## Architecture Patterns

### FileManager System

The FileManager uses a plugin-based architecture:
- **Singleton instance** exported from `FileManager.js`
- **Registry pattern** with `Map` objects for parsers and writers
- **Base classes** (`BaseParser`, `BaseWriter`) for consistent interfaces
- **Auto-initialization** via `init.js` module loading
- **Format detection** from file extensions with fallback to content sniffing

### Global State Management

Key global variables in `kirra.js`:
- `window.allBlastHoles` - Array of all blast hole objects
- `window.loadedSurfaces` - Map of surface ID to surface object
- `window.loadedImages` - Map of image ID to GeoTIFF object
- `window.loadedKADs` - Map of KAD ID to drawing object
- `window.threeRenderer` - ThreeRenderer singleton instance

### Module Organization

- **Core logic**: Monolithic `kirra.js` (being gradually modularized)
- **File I/O**: Fully modularized in `src/fileIO/`
- **Charging**: Self-contained module in `src/charging/`
- **Dialogs**: Centralized in `src/dialog/` with popup subfolders
- **Utilities**: Isolated in `src/helpers/`

## Build Output

Production builds go to `dist/` directory with:
- Bundled and minified JavaScript
- Optimized assets
- Source maps for debugging

---

*For file format details, see [File Formats](File-Formats).*
