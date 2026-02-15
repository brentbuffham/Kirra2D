# Blast Attribute Calculations

## Overview

This page documents the mathematical relationships between blast hole attributes in Kirra. Understanding these formulas is essential for data validation, hole geometry calculations, and pattern generation.

## Primary Coordinates

Every blast hole has three key 3D points:

```
┌─────────────────────────────────────────────────────────────┐
│  COLLAR (Start)     │  TOE (End)        │  GRADE (Floor)    │
│  StartX, StartY, StartZ │ EndX, EndY, EndZ │ GradeX, GradeY, GradeZ │
└─────────────────────────────────────────────────────────────┘
```

**Collar (Start)**: Top of hole at surface
**Toe (End)**: Bottom of hole (deepest point)
**Grade (Floor)**: Floor elevation intersection (may be interpolated between collar and toe)

## Vertical Calculations (Z-only)

These calculations use only Z-coordinates (elevations):

| Attribute | Primary Formula | Equivalent Formulas |
|-----------|-----------------|---------------------|
| **BenchHeight** | `StartZ - GradeZ` | `HoleLength × cos(Angle) - SubdrillAmount` |
| **SubdrillAmount** | `GradeZ - EndZ` | `HoleLength × cos(Angle) - BenchHeight` |
| **VerticalDrop** | `StartZ - EndZ` | `BenchHeight + SubdrillAmount` = `HoleLength × cos(Angle)` |

**Key Relationship**:
```
VerticalDrop = BenchHeight + SubdrillAmount
```

**Signs**:
- BenchHeight: Always positive (absolute distance)
- SubdrillAmount: Positive = downhole, Negative = uphole (rare)
- VerticalDrop: Always positive for normal holes

## Length Calculations

These calculations use 3D vector distances:

| Attribute | Primary Formula | Equivalent Formulas |
|-----------|-----------------|---------------------|
| **HoleLength** | `√[(ΔX)² + (ΔY)² + (ΔZ)²]` | `VerticalDrop / cos(Angle)` = `(BenchHeight + Subdrill) / cos(Angle)` |
| **HorizontalDisplacement** | `√[(EndX-StartX)² + (EndY-StartY)²]` | `HoleLength × sin(Angle)` = `VerticalDrop × tan(Angle)` |
| **SubdrillLength** | `√[(GradeX-EndX)² + (GradeY-EndY)² + (GradeZ-EndZ)²]` | `SubdrillAmount / cos(Angle)` |

**Key Relationship**:
```
HoleLength² = HorizontalDisplacement² + VerticalDrop²
```

## Angle Calculations

These calculations determine hole orientation:

| Attribute | Primary Formula | Equivalent Formulas |
|-----------|-----------------|---------------------|
| **HoleAngle** (from vertical) | `arccos(VerticalDrop / HoleLength)` | `arcsin(HorizDisp / HoleLength)` = `arctan(HorizDisp / VerticalDrop)` |
| **HoleBearing** (azimuth) | `atan2(ΔX, ΔY)` | — |

**Angle Range**: 0° to 90° (0° = vertical, 90° = horizontal)
**Bearing Range**: 0° to 359.99° (0° = North, clockwise)

**Relationship to Dip**:
```
Dip (Mast Angle) = 90° - Angle
```

## Equation Chains (What Calculates What)

```
                    ┌──────────────┐
                    │   StartZ     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ GradeZ  │  │  EndZ   │  │ StartXY │
        └────┬────┘  └────┬────┘  └────┬────┘
             │            │            │
             │            │            ▼
             │            │       ┌─────────┐
             │            │       │  EndXY  │
             │            │       └────┬────┘
             │            │            │
             ▼            ▼            ▼
      ┌─────────────────────────────────────┐
      │         DERIVED ATTRIBUTES          │
      └─────────────────────────────────────┘

StartZ - GradeZ ──────────────────────────────► BenchHeight
GradeZ - EndZ ────────────────────────────────► SubdrillAmount  
StartZ - EndZ ────────────────────────────────► VerticalDrop

√(ΔX² + ΔY² + ΔZ²) ───────────────────────────► HoleLength
√(ΔX² + ΔY²) ─────────────────────────────────► HorizontalDisplacement

arccos(VerticalDrop / HoleLength) ────────────► HoleAngle
atan2(ΔX, ΔY) ────────────────────────────────► HoleBearing
```

## Cross-Check Equivalencies (Validation)

These should all resolve to TRUE if data is consistent:

```
✓ BenchHeight + SubdrillAmount = VerticalDrop

✓ SubdrillAmount = HoleLength × cos(Angle) - BenchHeight

✓ HoleLength² = HorizontalDisplacement² + VerticalDrop²

✓ HoleLength = (BenchHeight + SubdrillAmount) / cos(Angle)

✓ tan(Angle) = HorizontalDisplacement / VerticalDrop

✓ GradeXY = StartXY + (HorizontalDisplacement × BenchHeight/VerticalDrop) × [sin(Bearing), cos(Bearing)]
```

## Grade Point Interpolation (Angled Holes)

For angled holes, the grade point (floor intersection) must be interpolated along the hole vector:

```
                     Start (Collar)
                        ●
                       /│
                      / │ BenchHeight
                     /  │
                    /   │
           Grade  ●─────┤ ← GradeZ elevation
                  │    /│
      SubdrillLen │   / │ SubdrillAmount (vertical)
                  │  /  │
                  │ /   │
                  ▼/    ▼
                 ● Toe (End)
```

**Formulas**:
```
GradeX = StartX + (EndX - StartX) × (BenchHeight / VerticalDrop)
GradeY = StartY + (EndY - StartY) × (BenchHeight / VerticalDrop)
```

**Explanation**: The grade point is positioned along the hole vector at a distance proportional to the bench height relative to the total vertical drop.

## Accuracy Hierarchy

Calculation accuracy degrades with complexity and angle proximity to vertical:

| Rank | Calculation | Error Source | Typical Accuracy |
|------|-------------|--------------|------------------|
| 1 | BenchHeight | Single Z difference | ±0.01m |
| 2 | SubdrillAmount | Single Z difference | ±0.01m |
| 3 | VerticalDrop | Single Z difference | ±0.01m |
| 4 | HoleBearing | 2D XY ratio | ±0.5° (degrades near vertical) |
| 5 | HoleLength | 3D compound | ±0.02m |
| 6 | HoleAngle | Inverse trig | ±1° (very poor near vertical) |
| 7 | GradeXY interpolation | Depends on angle accuracy | ±0.05m to ±0.5m |
| 8 | Burden/Spacing | Pattern geometry | ±0.1m |

**Near-Vertical Degradation**: Bearing and angle calculations become unstable for holes with Angle < 5° (nearly vertical). Use exact vertical (Angle = 0°) when possible.

## Quick Reference: "I have X, I need Y"

| If you have... | You can calculate... |
|----------------|---------------------|
| StartZ, GradeZ | BenchHeight |
| GradeZ, EndZ | SubdrillAmount |
| StartZ, EndZ | VerticalDrop |
| StartXYZ, EndXYZ | HoleLength, HoleAngle, HoleBearing |
| BenchHeight, SubdrillAmount | VerticalDrop |
| HoleLength, Angle | VerticalDrop, HorizontalDisplacement |
| VerticalDrop, Angle | HoleLength |
| BenchHeight, HoleLength, Angle | SubdrillAmount |
| StartXY, EndXY, BenchHeight, VerticalDrop | GradeXY |

## Input Scenarios: "I have these inputs, what can I calculate?"

### Scenario 1: StartXYZ + BenchHeight (Design from Collar)
```
GIVEN:  StartX, StartY, StartZ, BenchHeight
CALC:   GradeZ = StartZ - BenchHeight
NEED:   Angle, Bearing, (Subdrill OR Length OR ToeXYZ) to complete
```

**To complete the hole, add ONE of**:
- Subdrill + Angle + Bearing → ToeXYZ, Length, GradeXY
- Length + Angle + Bearing → ToeXYZ, Subdrill, GradeXY
- ToeXYZ → Length, Angle, Bearing, Subdrill, GradeXY

### Scenario 2: StartXYZ + BenchHeight + Subdrill (Vertical Hole, Bench Design)
```
GIVEN:  StartX, StartY, StartZ, BenchHeight, SubdrillAmount
ASSUME: Vertical hole (Angle = 0°)
```

| Can Calculate | Formula |
|---------------|---------|
| GradeZ | StartZ - BenchHeight |
| EndZ (ToeZ) | GradeZ - SubdrillAmount |
| VerticalDrop | BenchHeight + SubdrillAmount |
| HoleLength | VerticalDrop (same for vertical) |
| EndX, EndY | StartX, StartY (vertical = no XY change) |
| GradeX, GradeY | StartX, StartY |
| Angle | 0° |
| Bearing | Undefined (vertical) |

✅ **Complete geometry for vertical holes**

### Scenario 3: StartXYZ + BenchHeight + Subdrill + Angle + Bearing (Angled Hole Design)
```
GIVEN:  StartX, StartY, StartZ, BenchHeight, SubdrillAmount, Angle, Bearing
```

| Can Calculate | Formula |
|---------------|---------|
| GradeZ | StartZ - BenchHeight |
| EndZ (ToeZ) | GradeZ - SubdrillAmount |
| VerticalDrop | BenchHeight + SubdrillAmount |
| HoleLength | VerticalDrop / cos(Angle) |
| HorizDisplacement | HoleLength × sin(Angle) |
| EndX | StartX + HorizDisp × sin(Bearing) |
| EndY | StartY + HorizDisp × cos(Bearing) |
| GradeX | StartX + (HorizDisp × BenchHeight/VerticalDrop) × sin(Bearing) |
| GradeY | StartY + (HorizDisp × BenchHeight/VerticalDrop) × cos(Bearing) |

✅ **Complete geometry**

### Scenario 4: ToeXYZ + Length + Subdrill (Working Backwards from Toe)
```
GIVEN:  EndX, EndY, EndZ, HoleLength, SubdrillAmount
NEED:   Angle + Bearing to solve
```

| Can Calculate | Formula | Notes |
|---------------|---------|-------|
| GradeZ | EndZ + SubdrillAmount | ✅ Always |

**With Angle added**:

| Can Calculate | Formula |
|---------------|---------|
| VerticalDrop | HoleLength × cos(Angle) |
| StartZ | EndZ + VerticalDrop |
| BenchHeight | VerticalDrop - SubdrillAmount |
| HorizDisplacement | HoleLength × sin(Angle) |

**With Angle + Bearing added**:

| Can Calculate | Formula |
|---------------|---------|
| StartX | EndX - HorizDisp × sin(Bearing) |
| StartY | EndY - HorizDisp × cos(Bearing) |
| GradeX | EndX - (HorizDisp × Subdrill/VerticalDrop) × sin(Bearing) |
| GradeY | EndY - (HorizDisp × Subdrill/VerticalDrop) × cos(Bearing) |

✅ **Complete geometry**

### Scenario 5: ToeXYZ + GradeZ + Angle + Bearing (Toe Survey + Grade RL)
```
GIVEN:  EndX, EndY, EndZ, GradeZ, Angle, Bearing
```

| Can Calculate | Formula |
|---------------|---------|
| SubdrillAmount | GradeZ - EndZ |
| SubdrillLength | SubdrillAmount / cos(Angle) |

**Need StartZ OR BenchHeight OR Length to complete**

### Scenario 6: StartXYZ + ToeXYZ (Full Survey - Most Common)
```
GIVEN:  StartX, StartY, StartZ, EndX, EndY, EndZ
```

| Can Calculate | Formula |
|---------------|---------|
| HoleLength | √[(ΔX)² + (ΔY)² + (ΔZ)²] |
| VerticalDrop | StartZ - EndZ |
| HorizDisplacement | √[(ΔX)² + (ΔY)²] |
| HoleAngle | arccos(VerticalDrop / HoleLength) |
| HoleBearing | atan2(ΔX, ΔY) |

**Need GradeZ to get Bench/Subdrill split**:

| With GradeZ | Formula |
|-------------|---------|
| BenchHeight | StartZ - GradeZ |
| SubdrillAmount | GradeZ - EndZ |
| GradeX | StartX + ΔX × (BenchHeight / VerticalDrop) |
| GradeY | StartY + ΔY × (BenchHeight / VerticalDrop) |

✅ **Complete geometry with GradeZ**

### Scenario 7: StartXYZ + Length + Angle + Bearing (Design Projection)
```
GIVEN:  StartX, StartY, StartZ, HoleLength, Angle, Bearing
```

| Can Calculate | Formula |
|---------------|---------|
| VerticalDrop | HoleLength × cos(Angle) |
| HorizDisplacement | HoleLength × sin(Angle) |
| EndX | StartX + HorizDisp × sin(Bearing) |
| EndY | StartY + HorizDisp × cos(Bearing) |
| EndZ | StartZ - VerticalDrop |

**Need GradeZ OR BenchHeight OR Subdrill to split**:

| With GradeZ | Formula |
|-------------|---------|
| BenchHeight | StartZ - GradeZ |
| SubdrillAmount | GradeZ - EndZ |

| With BenchHeight | Formula |
|------------------|---------|
| GradeZ | StartZ - BenchHeight |
| SubdrillAmount | VerticalDrop - BenchHeight |

| With SubdrillAmount | Formula |
|---------------------|---------|
| BenchHeight | VerticalDrop - SubdrillAmount |
| GradeZ | EndZ + SubdrillAmount |

✅ **Complete geometry with one additional parameter**

## Summary Matrix: Minimum Inputs Required

| Hole Type | Minimum Inputs | What You Get |
|-----------|----------------|--------------|
| **Vertical** | StartXYZ + BenchHeight + Subdrill | Full geometry |
| **Angled** | StartXYZ + BenchHeight + Subdrill + Angle + Bearing | Full geometry |
| **From Survey** | StartXYZ + ToeXYZ + GradeZ | Full geometry |
| **From Toe** | ToeXYZ + Length + Subdrill + Angle + Bearing | Full geometry |
| **Design** | StartXYZ + Length + Angle + Bearing + (GradeZ OR Bench OR Sub) | Full geometry |

## The Three Ways to Define a Hole

```
METHOD 1: Two Points + Grade
┌─────────────────────────────────────┐
│  StartXYZ + ToeXYZ + GradeZ         │
│  (Survey data - most accurate)      │
└─────────────────────────────────────┘

METHOD 2: Collar + Vector + Depths
┌─────────────────────────────────────┐
│  StartXYZ + Angle + Bearing +       │
│  BenchHeight + Subdrill             │
│  (Design data - typical input)      │
└─────────────────────────────────────┘

METHOD 3: Toe + Vector + Depths
┌─────────────────────────────────────┐
│  ToeXYZ + Angle + Bearing +         │
│  Length + Subdrill                  │
│  (Reverse engineering)              │
└─────────────────────────────────────┘
```

## Subdrill Concepts

### subdrillAmount (Vertical Distance)

**Definition**: Vertical distance from grade elevation to toe elevation
```
subdrillAmount = gradeZ - toeZ
```

**Sign Convention**:
- Positive = downhole (toe below grade) - **Normal**
- Negative = uphole (toe above grade) - **Rare**
- Zero = toe at grade level

### subdrillLength (Vector Distance)

**Definition**: Distance along the hole from grade point to toe point
```
subdrillLength = √[(gradeX-toeX)² + (gradeY-toeY)² + (gradeZ-toeZ)²]
```

**For vertical holes**: `subdrillLength = subdrillAmount`
**For angled holes**: `subdrillLength = subdrillAmount / cos(angle)`

### Relationship Diagram

```
        Collar ●
              /│
             / │ Bench Height
            /  │
           /   │
    Grade ●────┤ ← Grade Elevation
          │   /│
Subdrill  │  / │ subdrillAmount (vertical ΔZ)
Length    │ /  │
(vector)  │/   │
          ●────┘ Toe
     subdrillLength
```

---

*For coordinate system conventions, see [Coordinate System](Coordinate-System).*  
*For hole data structure, see [Blast Hole Management](Blast-Hole-Management).*
