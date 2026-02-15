# Statistics and Reporting

## Overview

Kirra provides comprehensive statistical analysis and reporting capabilities for blast pattern evaluation, including per-entity statistics, Voronoi analysis for rock distribution, and detailed blast calculations.

---

## Per-Entity Statistics

Statistics are calculated for each blast entity, providing detailed metrics for pattern evaluation.

### Hole Count Statistics

**Basic Counts:**
- Total holes in entity
- Holes by type (Production, Presplit, Buffer, etc.)
- Visible vs hidden holes
- Selected holes

**Example Output:**
```
Entity: Pattern_A
Total Holes: 156
  Production: 142
  Presplit: 12
  Buffer: 2
```

### Length Statistics

**Calculated Lengths:**
- Total hole length (sum of all holes)
- Average hole length
- Minimum/maximum hole lengths
- Standard deviation
- Mode (most common length)

**Example Output:**
```
Total Length: 1,234.56 m
Average Length: 7.92 m
Min/Max: 6.50 / 9.80 m
Std Dev: 0.85 m
Mode: 8.00 m
```

### Volume Statistics

**Drill Volume:**
Based on hole diameter and length:

```
Volume = π × (diameter/2)² × length
```

**Calculated Values:**
- Total drill volume (m³)
- Average volume per hole
- Volume by hole type

**Example Output:**
```
Total Drill Volume: 15.67 m³
Average per Hole: 0.100 m³
```

### Burden and Spacing Statistics

**Distribution Analysis:**
- Average burden
- Average spacing
- Burden/spacing ratio
- Mode burden (most common)
- Mode spacing
- Standard deviation

**Tolerance Grouping:**
Burden/spacing values grouped with tolerance (e.g., 3.48m and 3.52m both count as 3.5m).

**Example Output:**
```
Average Burden: 3.52 m
Mode Burden: 3.50 m (72 holes)
Std Dev: 0.18 m

Average Spacing: 4.03 m
Mode Spacing: 4.00 m (68 holes)
Std Dev: 0.21 m

B:S Ratio: 1:1.14
```

### Timing Statistics

**Firing Time Range:**
- Earliest firing time
- Latest firing time
- Total blast duration
- Average delay between holes

**Example Output:**
```
Firing Time Range: 0ms - 2,450ms
Blast Duration: 2.45 seconds
Average Delay: 25ms
```

### Delay Distribution

**Delay Statistics:**
- Count of holes per delay value
- Most common delay
- Delay sequence validation

**Example Output:**
```
Delay Distribution:
  0ms: 12 holes
  25ms: 18 holes
  50ms: 15 holes
  75ms: 20 holes
  ...
```

### Connector Statistics

**Timing Connectors:**
Count of timing connections between holes, grouped by delay type.

**Process:**
1. Identify holes with `fromHoleID` pointing to another hole
2. Group by delay value
3. Count connectors per delay
4. Determine most common connector color per delay

**Example Output:**
```
Connectors by Delay:
  25ms: 12 connectors (color: #ff0000)
  50ms: 10 connectors (color: #00ff00)
  75ms: 8 connectors (color: #0000ff)
```

---

## Voronoi Analysis

Voronoi analysis calculates the area of influence for each hole, providing rock distribution metrics.

### Voronoi Diagram Calculation

**Algorithm:**
1. Generate Voronoi diagram from hole collar positions (X, Y)
2. Calculate polygon area for each hole's cell
3. Handle edge cases (infinite cells bounded by blast boundary)

**Voronoi Cell:**
The region closer to a given hole than to any other hole.

### Rock Distribution Metrics

**Per-Hole Voronoi Area:**
- Area (m²) of Voronoi cell
- Percentage of total blast area
- Comparison to nominal burden × spacing

**Example:**
```
Hole: H001
Voronoi Area: 14.23 m²
Nominal Area: 14.00 m² (3.5m × 4.0m)
Variance: +1.6%
```

### Powder Factor Calculation

Using Voronoi area and charge mass:

```
Powder Factor = Charge Mass (kg) / (Voronoi Area (m²) × Bench Height (m))
```

**Units:** kg/m³

**Example:**
```
Hole: H001
Charge Mass: 50 kg
Voronoi Area: 14.23 m²
Bench Height: 10 m
Rock Volume: 142.3 m³
Powder Factor: 0.35 kg/m³
```

### Blast Efficiency Analysis

**Voronoi Variance:**
Measure of pattern uniformity:

```
Variance = (Actual Voronoi Area - Nominal Area) / Nominal Area × 100%
```

**Pattern Quality Metrics:**
- Average variance (target: <5%)
- Standard deviation of Voronoi areas
- Coefficient of variation

**Example:**
```
Voronoi Analysis:
  Average Area: 14.05 m²
  Std Dev: 0.87 m²
  Coefficient of Variation: 6.2%
  Pattern Quality: Good
```

### Voronoi Visualization

**Display Modes:**
- Voronoi polygon outlines
- Color by area (gradient)
- Color by variance from nominal
- Labels showing area values

---

## Blast Statistics Calculations

### Rock Volume

**Per Entity:**
```
Rock Volume = Σ(Voronoi Area × Bench Height)
```

**Total Blast:**
```
Total Rock Volume = Σ(All Entities)
```

**Example:**
```
Entity: Pattern_A
Holes: 156
Total Voronoi Area: 2,190 m²
Average Bench Height: 10.5 m
Rock Volume: 22,995 m³
```

### Explosive Consumption

**From Charging System:**
If holes have charge configurations applied:

**Per Hole:**
- Sum mass of all COUPLED decks
- Sum mass of all DECOUPLED decks
- Total charge mass

**Per Entity:**
```
Total Explosive Mass = Σ(All Hole Charge Masses)
Average Mass per Hole = Total Mass / Hole Count
```

**Example:**
```
Entity: Pattern_A
Total Explosive Mass: 7,234 kg
Average per Hole: 46.4 kg
Explosive Type Breakdown:
  ANFO: 6,450 kg (89%)
  Emulsion: 784 kg (11%)
```

### Powder Factor by Entity

**Calculation:**
```
Powder Factor = Total Explosive Mass (kg) / Total Rock Volume (m³)
```

**Example:**
```
Entity: Pattern_A
Total Explosive: 7,234 kg
Rock Volume: 22,995 m³
Powder Factor: 0.31 kg/m³
```

### Stemming Statistics

**From Charging System:**
- Total stemming length
- Average stemming per hole
- Stemming depth range
- Stemming material breakdown

**Example:**
```
Entity: Pattern_A
Total Stemming: 546 m
Average per Hole: 3.5 m
Stemming Material:
  Crushed Aggregate: 520 m (95%)
  Drill Cuttings: 26 m (5%)
```

### Subdrill Statistics

**Subdrill Analysis:**
- Average subdrill amount (vertical Z difference)
- Average subdrill length (along hole vector)
- Subdrill range (min/max)
- Holes with zero subdrill
- Holes with negative subdrill (uphole)

**Example:**
```
Entity: Pattern_A
Average Subdrill Amount: 1.2 m
Average Subdrill Length: 1.25 m
Range: 0.5 m to 2.0 m
Zero Subdrill: 0 holes
Negative Subdrill: 0 holes
```

---

## Firing Time Calculations

### Time-Based Statistics

**Firing Sequence:**
- Start time (earliest hole)
- End time (latest hole)
- Duration (end - start)
- Average time between adjacent holes

**Example:**
```
Firing Sequence Analysis:
  Start Time: 0ms
  End Time: 2,450ms
  Duration: 2.45 seconds
  Average Interval: 15.7ms
```

### Delay Distribution Graph

**Histogram:**
- X-axis: Delay values (ms)
- Y-axis: Hole count
- Bars colored by entity or delay type

**Statistics:**
- Most common delay
- Delay range
- Holes per delay group

---

## Row-Based Statistics

When rows are detected (automatic or manual):

### Per-Row Metrics

**Row Identification:**
- Row ID
- Hole count
- Average spacing within row
- Row angle/bearing

**Example:**
```
Row Analysis:
  Row 1: 12 holes, Avg Spacing: 4.0m, Bearing: 0°
  Row 2: 12 holes, Avg Spacing: 4.1m, Bearing: 0°
  Row 3: 12 holes, Avg Spacing: 3.9m, Bearing: 0°
```

### Inter-Row Statistics

**Burden Between Rows:**
- Average burden between consecutive rows
- Burden variance
- Stagger offset (for staggered patterns)

**Example:**
```
Inter-Row Burden:
  Row 1-2: 3.5m
  Row 2-3: 3.6m
  Average: 3.55m
  Variance: 2.8%
```

---

## Statistics Export

Export statistics to CSV or formatted report.

### CSV Export Format

**Per-Hole Statistics:**
```csv
Entity,HoleID,Length,Burden,Spacing,Voronoi Area,Charge Mass,Powder Factor
Pattern_A,H001,7.92,3.5,4.0,14.23,50,0.35
Pattern_A,H002,7.85,3.5,4.0,13.98,50,0.36
...
```

**Entity Summary:**
```csv
Entity,Holes,Total Length,Avg Length,Total Rock,Total Explosive,Powder Factor
Pattern_A,156,1234.56,7.92,22995,7234,0.31
Pattern_B,84,689.34,8.21,14520,4825,0.33
```

### Report Generation

**PDF Report Sections:**
1. **Header**: Project name, date, blast entity
2. **Summary Statistics**: Hole count, lengths, volumes
3. **Burden/Spacing Analysis**: Distributions, modes, averages
4. **Timing Analysis**: Delay distribution, firing sequence
5. **Voronoi Analysis**: Area distribution, variance
6. **Powder Factor**: Per-hole and entity averages
7. **Footer**: Copyright, timestamp

---

## Statistical Functions

### Mode Calculation with Tolerance

**getModeWithTolerance(values, tolerance):**

Finds the most common value, grouping values within tolerance.

**Process:**
1. Round each value to nearest tolerance increment
2. Count occurrences in each bin
3. Return bin with highest count

**Example:**
```javascript
values = [3.48, 3.52, 3.50, 4.01, 3.49, 3.51]
tolerance = 0.1
bins = {
  3.5: 5 occurrences,  // 3.48, 3.52, 3.50, 3.49, 3.51
  4.0: 1 occurrence    // 4.01
}
mode = 3.5
```

### Grouping Functions

**groupHolesByEntity(holes):**
Returns map of `entityName` → array of holes.

**groupHolesByRow(holes):**
Returns map of `rowID` → array of holes.

**groupHolesByDelay(holes):**
Returns map of `delay` → `{count, color}`.

**groupConnectorsByType(holes):**
Returns map of `delay` → `{count, color}` for actual timing connectors.

---

## Statistics Display

### Statistics Panel

Collapsible panel showing real-time statistics:

**Location:** Right sidebar (default) or floating window

**Sections:**
- Entity Statistics
- Hole Statistics
- Timing Statistics
- Voronoi Analysis
- Charge Statistics (if charging data present)

**Update Triggers:**
- Hole added/deleted
- Property changed
- Selection changed
- Pattern generated
- Timing recalculated

### Statistics Overlay

Display statistics directly on canvas:

**2D Canvas Overlay:**
- Entity summary box
- Per-hole Voronoi areas
- Timing labels

**3D Overlay:**
- Billboarded text labels
- Statistics positioned in 3D space
- Theme-aware colors

---

## Performance Considerations

**Large Datasets:**
- Statistics cached until data changes
- Incremental updates when possible
- Background calculation for Voronoi (async)

**Debouncing:**
- Statistics recalculated after 500ms idle
- Avoids recalculation during rapid edits

---

See also:
- [Blast-Hole-Management.md](Blast-Hole-Management.md) — Hole data structure
- [Charging-System.md](Charging-System.md) — Charge mass calculations
- [Print-and-PDF-System.md](Print-and-PDF-System.md) — Statistics in PDF reports
