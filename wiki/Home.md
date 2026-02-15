# Kirra

## Overview

**Kirra** is a web-based blasting pattern design application developed for mining and construction industries. It provides comprehensive tools for creating, editing, and managing blast hole patterns with extensive file format support and advanced visualization capabilities.

## Key Features

- **Multi-Format Support**: Import and export blast data in 20+ industry-standard formats including CSV, DXF, Surpac DTM/STR, IREDES XML, and more
- **Interactive Canvas**: Combined 2D/3D visualization with pan, zoom, measurement tools, and real-time rendering
- **Pattern Generation**: Multiple pattern creation methods including rectangular grids, polygon patterns, and line-based layouts
- **Surface Management**: Import, triangulate, and visualize 3D surfaces with gradient coloring and texture mapping
- **Charging System**: Comprehensive charge design with typed decks, formula-driven positioning, and mass-based calculations
- **Data Persistence**: Browser-based IndexedDB storage for blast holes, surfaces, drawings, and layers
- **Internationalization**: Full support for English, Russian, and Spanish languages
- **Theme Support**: Dark/Light mode with customizable color schemes
- **Vector PDF Export**: High-quality SVG-based PDF generation with statistics and metadata

## Wiki Navigation

### Architecture and System Design
- [Application Architecture](Application-Architecture) - File structure and source organization
- [File Formats](File-Formats) - Comprehensive file I/O system documentation
- [IndexedDB Schema](IndexedDB-Schema) - Database structure with ER diagrams ✨ **NEW**
- [Data Persistence](Data-Persistence) - localStorage and IndexedDB usage ✨ **NEW**

### Blast Hole Design
- [Blast Hole Management](Blast-Hole-Management) - Field definitions and data structures
- [Pattern Generation](Pattern-Generation) - Pattern creation methods and tools
- [Coordinate System](Coordinate-System) - 3D coordinates and angle conventions
- [Blast Attribute Calculations](Blast-Attribute-Calculations) - Geometry formulas and relationships

### Charging Module
- [Charging System](Charging-System) - Charge configuration and deck management
- [Charge Config CSV Reference](Charge-Config-CSV-Reference) - Configuration file format specification

### User Interface
- [User Interface](User-Interface) - Menu structure, themes, and internationalization
- [Measurement Tools](Measurement-Tools) - Distance, area, and snap tools
- [TreeView Convention](TreeView-Convention) - Node ID formats and separator warnings ✨ **NEW**
- [Print and PDF System](Print-and-PDF-System) - SVG-based export system

### Analysis and Workflow
- [Statistics and Reporting](Statistics-and-Reporting) - Per-entity statistics and Voronoi analysis
- [Blast Design Workflow](Blast-Design-Workflow) - Complete design process from setup to export ✨ **NEW**
- [Advanced Features](Advanced-Features) - Duplicate detection, grade control, clustering ✨ **NEW**

## About

**Author**: Brent Buffham  
**Website**: [blastingapps.com](https://blastingapps.com)  
**Copyright**: © 2023–2025  
**License**: MIT License

---

*For technical implementation details, see the source code comments and AI commentary files in the repository.*
