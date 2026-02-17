# Kirra Wiki Documentation Summary

## Overview

This directory contains comprehensive documentation for the Kirra application - a web-based blasting pattern design tool for mining and construction.

## Complete File Listing (18 pages, 312 KB total)

| File | Size | Lines | Description |
|------|------|-------|-------------|
| Home.md | 3.2KB | 57 | Main landing page with navigation |
| Application-Architecture.md | 12KB | 269 | File structure and source organization |
| File-Formats.md | 30KB | 848 | **Comprehensive** file I/O system (20+ formats) |
| Blast-Hole-Management.md | 7.7KB | 217 | Complete field definitions |
| Pattern-Generation.md | 8.8KB | 297 | Pattern creation methods |
| Coordinate-System.md | 7.3KB | 293 | 3D coordinates and angle conventions |
| Blast-Attribute-Calculations.md | 16KB | 414 | Geometry formulas and relationships |
| Charging-System.md | 15KB | 422 | Charge design and deck management |
| Charge-Config-CSV-Reference.md | 21KB | 469 | CSV format specification |
| User-Interface.md | 15KB | 651 | Menu structure and UI |
| Measurement-Tools.md | 9.3KB | 434 | Distance, area, and snap tools |
| TreeView-Convention.md | 20KB | 685 | Node ID formats (⚠️ Braille separator) |
| Print-and-PDF-System.md | 16KB | 628 | SVG-based PDF generation |
| Statistics-and-Reporting.md | 11KB | 531 | Per-entity stats and Voronoi |
| IndexedDB-Schema.md | 27KB | 955 | Database structure with ER diagrams |
| Data-Persistence.md | 27KB | 921 | localStorage and IndexedDB usage |
| Blast-Design-Workflow.md | 23KB | 865 | Complete workflow guide |
| Advanced-Features.md | 24KB | 865 | Duplicate detection, clustering, etc. |
| Flyrock-Model-Richards-Moore.md | 5KB | 145 | Richards & Moore (2004) flyrock model |
| Flyrock-Model-Lundborg.md | 4KB | 120 | Lundborg (1975/1981) flyrock model |
| Flyrock-Model-McKenzie.md | 6KB | 170 | McKenzie (2009/2022) SDoB-based flyrock model |
| ThreeJS-Material-Notes.md | 4KB | 110 | Three.js material choices and Phong vs Basic pitfalls |

**Total: 331 KB across 10,366 lines**

## Key Documentation Highlights

### Most Comprehensive Pages
1. **File-Formats.md** (30KB) - Complete FileManager architecture, all parsers/writers, format specifications
2. **IndexedDB-Schema.md** (27KB) - Full Mermaid ER diagram, all 4 object stores
3. **Data-Persistence.md** (27KB) - Complete data lifecycle and persistence strategy
4. **Advanced-Features.md** (24KB) - All advanced features with examples
5. **Blast-Design-Workflow.md** (23KB) - Step-by-step complete workflow

### Critical Safety Pages
- **TreeView-Convention.md** - ⚠️ Braille separator U+28FF warnings
- **Blast-Hole-Management.md** - ⚠️ IREDES X/Y swap warning
- **Coordinate-System.md** - ⚠️ Angle convention differences

### Technical Reference
- **Blast-Attribute-Calculations.md** - 7 input scenarios with formulas
- **Charge-Config-CSV-Reference.md** - Complete CSV format with 20 formula examples
- **Application-Architecture.md** - Full source tree with 18 fileIO modules

## Documentation Standards Met

✅ **No build instructions** - No npm install, npm run dev, or build steps  
✅ **No live app URL** - No links to GitHub Pages deployment  
✅ **Comprehensive File-Formats page** - Main detailed page as requested  
✅ **GitHub wiki link format** - All links use `[Page Title](Page-Title)` format  
✅ **Code examples** - Extensive examples throughout  
✅ **ASCII diagrams** - Included from README where applicable  
✅ **Cross-references** - Pages link to related documentation  
✅ **Consistent structure** - All pages follow same format

## Author

**Brent Buffham**  
**Website**: blastingapps.com  
**Copyright**: © 2023–2025  
**License**: MIT License

---

*These wiki files are ready to be published to the GitHub Wiki for the Kirra repository.*
