# SPF File Format — Deep Analysis

## Overview

The **SPF** (ShotPlus File) is Orica's blast design format used by **SHOTPlus 5/6**. It's a standard **ZIP archive** containing multiple XML files that together define a complete blast design — holes, loading, timing, resources, surfaces, UI state, and more.

This document was produced from examining `TESTSPF.spf` (SHOTPlus 6.25.1), decomposing its XML components, and mapping the data structures.

---

## 1. ZIP Structure

| File | Size | Description |
|------|------|-------------|
| `Header.Xml` | 3,121 B | File metadata: author, app version, revision, thumbnail (base64 JPEG) |
| `BlastHeader.Xml` | 1,889 B | Blast identity: mine, location, GUID, Cosmos cloud settings |
| `SPNETData.Xml` | 1,021,816 B | **Core data model** — the full ShotPlus internal representation |
| `BlisData.Xml` | 123,454 B | **BLIS export** — Orica's interchange format (simplified view of holes, loading, timing) |
| `UIDefaults.Xml` | 23,883 B | Viewport camera state, hole label visibility, UI preferences |
| `Attachments\Attachments.Xml` | 163 B | File attachments container (empty in this file) |

**Key insight:** The SPF contains two parallel representations of the blast:
- **SPNETData.Xml** — The full internal object model (rich, everything)
- **BlisData.Xml** — A flattened BLIS namespace export (simpler, suitable for interchange)

The existing parser reads **BlisData.Xml** only, which is the right choice for import since it's cleaner and more stable. SPNETData.Xml contains the full state for round-tripping back to ShotPlus.

---

## 2. Header.Xml

Simple file-level metadata. No blast data.

```
FileHeader
  FileVersion: 1
  Title: (empty)
  Author: "scott"
  Description: (empty)
  Application: "SHOTPlus6/6.25.1"
  Revision: 21
  Thumbnail: (base64 JPEG, ~80x80 preview)
```

---

## 3. BlastHeader.Xml

Blast-level identity and Cosmos cloud connection settings.

```
BlastHeader
  BlastGuid: "3bf28a9b-ae97-4621-9d91-93efd3ac9a35"
  Mine: "Castle Hill"
  Location: "CHO1_5385_208_V1"
  Comment, ProfileComment, ShotFirer, FiringTime, BlastType, RockType, OrderNo
  MaxDrillLength: 5
  Surveyer, SurveyTime, Boretracker, BoretrackTime, Engineer
  StartLoadingTime, FinishLoadingTime, Customer, BlastId
  CosmosSettings
    SiteID: (GUID)
    SiteName: "Action Drill & Blast"
    CosmosSite
      Type: "OpenCut"
      TimeZone: "W. Australia Standard Time"
      CountryCode: "AUS"
    CosmosEnv: "Production"
```

**Parser note:** The `Mine` and `Location` fields are the primary blast identifier strings. `BlastGuid` is the unique identifier.

---

## 4. BlisData.Xml (BLIS Interchange Format)

**Namespace:** `http://www.orica.com/namespaces/blis`

This is what the existing SPFParser reads. It's a structured export of the blast design.

### 4.1 Top-Level Structure

```
BlisBlastData
  ├─ BlastIdentification     (app, version, GUID, author, thumbnail)
  ├─ BlastDescription         (volumes, powder factor, energy factor, flags)
  ├─ BlastDomains             (24x BlastDomain — hole type definitions)
  ├─ Holes                    (16x Hole — the actual blast holes)
  ├─ Horizons                 (25x Horizon — named intercept layers)
  ├─ HoleTypes                (24x HoleType — hole type names)
  ├─ MaterialTypes            (24x MaterialType — material type names)
  ├─ TieTypes                 (6x Ties — delay definitions)
  ├─ TieTable                 (15x Tie — hole-to-hole connections)
  ├─ Leadins                  (1x Leadin — initiation entry point)
  ├─ BlastBounds              (84x Coordinate — blast boundary polygon)
  ├─ UsageDesign              (11x Resource — bill of materials)
  ├─ UsageActual              (empty)
  ├─ Outcomes                 (post-blast KPIs — all zeros)
  ├─ FiringTimes              (16x FiringTime — per-charge timing)
  ├─ ToeLine                  (empty)
  ├─ CrestLine                (empty)
  ├─ Annotation               (empty)
  ├─ InactiveMiningZone       (empty)
  └─ TimingLines              (empty)
```

### 4.2 BlastDescription

```
VolumeDesign: 1092.09 m³
VolumeDesignMethod: "ByHole"
PowderFactorDesign: 0.676 kg/m³
EnergyFactorDesign: 1.493 MJ/m³
IsEBS: false
BlastCentre: X=9549.02, Y=19293.26, Z=5390.02
OverlapTimeWindow: 8 ms
BackfillProductName: "Stemming Backfill - World"
```

### 4.3 BlastDomains (Hole Type Definitions)

24 pre-defined domains (indices 0–23). Each is a hole-type template:

```
BlastDomain (example: index 0)
  Name: "Hole type 1"
  Burden: 6          Spacing: 7
  Subdrill: 1.2      Angle: 0
  Diameter: 100 mm   BenchHeight: 20
  Pattern: "Staggered"
  Tolerances:
    BackfillTol: 0       RedrillTol: 0
    LoadingTol: 0.1      StemmingMaxTol: 4.4  StemmingMinTol: 3.6
    BurdenMaxTol: 6.6    BurdenMinTol: 5.4
    PowderFactorMaxTol: 0.110   PowderFactorMinTol: 0
    SubdrillMaxTol: 1.7  SubdrillMinTol: 0
```

**Parser note:** The hole `Domain` field (integer) indexes into this array. Domain defines the design pattern and QA tolerances.

### 4.4 Hole Structure (per hole)

Each hole contains:

```
Hole
  Index: 0                          (array position)
  Guid: {a336f886-...}              (unique ID)
  HoleId: "1"                       (display label)
  Domain: 0                         (→ BlastDomain index)
  MaterialType: 0                   (→ MaterialType index)
  DesignLength: 5.7 m
  Diameter: 127 mm
  WaterState: "Unknown"

  DesignCoordinates:                (collar position)
    X: 9544.091   Y: 19286.595   Z: 5390.0

  GeoCoordinates:                   (WGS84 — lat/lon)
    Latitude: -74.349   Longitude: -160.538   Hmsl: 0

  ActualCoordinates:                (same as design if unsurveyed)
    X: 9544.091   Y: 19286.595   Z: 5390.0

  DesignAngle: 0                    (from vertical, degrees)
  DesignBearing: 88.736             (azimuth, degrees)
  ActualAngle: 0                    ActualBearing: 88.736
  BenchHeight: 20
  Subdrill: 0.7
  GradeRL: 0
  FiringTime: 543.0003 ms
  Stemming: 2.4 m
  Backfill: 0
  PowderFactor: 0.672 kg/m³
  IsDummy: false
  Sequence: 6                       (firing sequence order)
  HasLoading: true
  HasActual: false
  RuleName: "** Manually edited loading **"
  LoadingLength: 5.7 m

  DesignLoading:                    (explosive decks)
    Deck 0:
      Explosive: "POLAR SX 1100"
      Abbreviation: "POLARSX1100"
      Horizon: 2.4 m                (top of charge from collar)
      Length: 3.3 m
      Density: 1.1 g/cm³
      Weight: 45.98 kg
      Type: "Explosive"
      RID: (product resource ID)

  InitSysLoading:                   (initiating system)
    Initiator 0:
      Product: "MAXNELT"
      Depth: 4.7 m
      FiringTime: 543 ms
      PrimerName: "MEGAPRIME - 0.035m x 0.123m x 0.15kg"
      PrimerWeight: 0.15 kg
      IsEBS: false
      RID: (resource IDs)
```

**Key observations:**
- `DesignCoordinates` use a **local mine grid** (not geographic), with X/Y in the 9000s/19000s and Z as RL (5390m)
- `GeoCoordinates` appear to be WGS84 but values look incorrect (-74°, -160°) — possibly not populated properly
- `BenchHeight` in BLIS is 20m which seems to be the **domain default**, not the actual bench at this hole (collar RL 5390 minus the `GradeRL` in SPNETData is 5m)
- `Subdrill` is 0.7m, `DesignLength` is 5.7m
- The `Horizon` value in deck loading (2.4m) represents the **top of charge depth from collar** — same as stemming
- `FiringTime` is in **milliseconds**
- `Sequence` is the firing order number

### 4.5 TieTypes (Delay Products)

```
Ties (6 types defined, example index 1):
  Name: "MAXNELT"
  Delay: 9 ms           MeanDelay: 9 ms
  StdDev: 0              PropDelay: 0
  Color: "0,255,0"       (RGB string)
  SelectorIndex: 0       SelectorType: 0
  RID: (resource IDs)
```

### 4.6 TieTable (Connections)

15 ties connecting holes:

```
Tie:
  Hole1Index: 2    Hole2Index: 1    TieTypeIndex: 1
```

**This is the timing network.** Each tie connects two holes with a specific delay product. The firing time of each hole is calculated from the network of ties starting from the leadin.

### 4.7 Leadins

```
Leadin:
  HoleIndex: 3           (initiation starts at hole index 3)
  Type: "Nonelectric"
  Time: 0 ms
```

### 4.8 BlastBounds

84-point polygon defining the blast boundary (closed polyline). All points have X, Y, Z coordinates.

### 4.9 UsageDesign (Bill of Materials)

11 resources used in the blast design:

```
Resource:
  ResourceType: "Initiator" | "Explosive" | "Primer" | ...
  Name: "MAXNEL Trunkline - 4.8m, 25ms, # 25ms"
  Amount: 4
  UnitType: "Count" | "Weight" | "Length"
  RID: (product resource ID)
```

### 4.10 FiringTimes

Per-charge timing data (one entry per explosive deck per hole):

```
FiringTime:
  HoleIndex: 0           ChargeIndex: 0
  HorizonIndex: 1        FiringTime: 543.0003 ms
  ChargeWeight: 45.98 kg
  DeviceMeanDelay: 500 ms   DeviceStdDev: 0
  ChargeTop: 2.4 m       ChargeBottom: 5.7 m
```

---

## 5. SPNETData.Xml (Full Internal Model)

This is the complete ShotPlus application state. It's much larger (~1MB) and contains everything needed to fully reconstruct the blast design in ShotPlus.

### 5.1 Top-Level Structure

```
root/SPBlast
  ├─ FileHeader
  ├─ Attachments
  ├─ BlastHeader              (same data as BlastHeader.Xml)
  ├─ ResourceMgr              (full product database)
  ├─ Defaults                 (design defaults, naming, EBS settings)
  ├─ Design                   (loading rules, EBS parameters)
  ├─ BaseEntityOwner          (CAD-style layers and entities, e.g. polylines)
  ├─ Nodes                    (16x SPHole — full hole objects)
  ├─ Rows                     (empty)
  ├─ Groups                   (empty)
  ├─ DipLinks                 (empty)
  ├─ LoadLinks                (empty)
  ├─ Ties                     (15x SPTie — timing connections)
  ├─ Leadins                  (1x SPLeadin)
  ├─ Baselines                (empty)
  ├─ SurveyStations           (empty)
  ├─ MonitorPoints            (empty)
  ├─ ActiveHorizon: 0
  ├─ HoleVisibilityMgr        (220x visibility data items)
  ├─ EBSFieldReport           (84x field report data)
  ├─ HorizonMask: 8191
  ├─ UserSettings              (surveying, wizards, volumes, DipPlus, exceptions)
  ├─ SPSurfaceMgr             (surface definitions — empty)
  ├─ SPBlastOutcomes           (KPI outcomes)
  ├─ Surfaces                  (empty)
  ├─ MSWModel
  ├─ BlastBearing, UseBlastBearing
  ├─ VibrationData, VibrationDataOffset
  ├─ EnvironmentalModelling
  ├─ FragmentationModelling
  ├─ ReferencePoint
  ├─ RockStrataDefinition
  ├─ EncoderLinks, EncoderDataMgr
  ├─ AvmDomain
  ├─ FlyrockCalculator
  ├─ SpatialTransform
  ├─ CosmosPlanNoteMgr
  ├─ TimingOverlapSettings
  └─ ...
```

### 5.2 ResourceMgr (Product Database)

Contains the full product catalogue available for this blast:

```
ResourceMgr
  Resources:
    13x ExplResource      (explosive products)
    17x ISResource        (initiation system products)
    1x  AirResource       (air deck product)
  SiteProducts:
    16x ExplResource
    18x ISResource
    2x  AccessoryResource
  Selectors: 15x RMISSelector   (product selection configurations)
```

Each **ExplResource** has: BaseResource, ICICode, Density, EffEnergy, Packaged, PackDiam, PackLen, PackWght, etc.
Each **ISResource** has: BaseResource, DelayNum, TieType, PropDel, Mean/Std deviation, UnitLength, etc.

### 5.3 SPHole (Full Hole Object)

The SPHole in SPNETData is much richer than the BLIS Hole:

```
SPHole
  BaseEntity:               (CAD entity properties)
    Owner, Layer, Handle, Version, Color
  BasePoint:
    Coords: (X, Y, Z)      (collar position)
  BaseNode:
    NodeMean, NodeNominal, NodeVariance   (timing statistics)
    Mean, Nominal, Variance               (firing time ms)
    ProgramTime                           (programmed delay)
    NotionalCoords                        (notional position)
  BaseHole:
    HoleID: "1"             (display label)
    HoleType: 0             (domain index)
    MaterialType: 0
    Guid, Comment
    Angle: 0 (radians!)     Bearing: 1.549 (radians!)
    Length: 5.7 m
    DesignAngle, DesignBearing, DesignLength   (also radians)
    Backfill: 0             UseBackfill: false
    SubDrill: 0.7           BenchHeight: 20
    WetState, Temperature
    Loading: HoleLoading    (design loading with deck details)
    ActualLoading: HoleLoading
    ToeRL: 5385             (toe elevation as RL)
    GradeRL: 5385           (grade elevation as RL)
    GradeKnown: true
    DrillDiameter: 127 mm
    DesignDiameter: 127 mm
    DesignSubDrill: 0.7
    DesignBenchHeight: 20
    DesignGradeRL: 5385
    DesignCoords: T3DVector  (collar XYZ)
    DesignToe: T3DVector     (toe XYZ)
    CollarLocked: false
    IsRedrilled: false
    MaintainTrack: true
  Intercepts: 24x Double     (horizon intercept depths)
  Flags: 4x Boolean
  ActualsDefined: 1
  Tracking: HoleLoadingTracking
```

**Critical differences from BLIS:**
1. **Angles are in RADIANS** in SPNETData (Bearing 1.549 rad = 88.7°) vs **DEGREES** in BlisData
2. **GradeRL** is properly populated (5385) vs often 0 in BLIS
3. **ToeRL** is available (5385) — direct toe elevation
4. Has `DesignCoords` and `DesignToe` as `T3DVector` objects
5. Contains full loading/actual loading history
6. Has all drill data (actual measurements, drill data UTC, etc.)

### 5.4 SPTie (Timing Connection)

```
SPTie
  BaseEntity: (Owner, Layer, Handle, Color)
  BaseTie:
    Hole1, Hole2            (references to SPHole handles)
    TieType                 (delay product index)
    InitPoint
  Selector: (empty)
  LengthInx: 0
  IkonID: 0
  ProgramDelay: -1          (-1 = use nominal)
  Bent: 0
```

### 5.5 UserSettings

Contains extensive QA and operational preferences:

```
UserSettings
  Surveying: TargetHeight1/2/3, FloorElevation
  Wizards: MoveDelta, AngleDelta, BearingDelta
  Volumes:
    UseDesignBurSP, UseSubDrill
    PerimeterOverbreak, BackBreak, SideBreak
    RockDensity, ManualBlastVolume
    SummaryBlockVolumeCalculation
  DipPlus:
    Temperature thresholds and colors
    DipResourceExportOption
  Exceptions:
    RechargeMin/Max, PowderFactorMin/Max
    DrillDepthMin/Max, DrillingVariance
    LoadingTolerance/ToleranceKg
  ExclusionArea:
    KFactors for burden/ejection/cratering
    SafetyFactor, MaxDistances
```

---

## 6. UIDefaults.Xml

Viewport and display state. Not needed for data parsing but useful context:

```
UIDefaultValues
  ViewportState:
    Perspective: false
    Centre: X=9544.73, Y=19295.63, Z=5387.26
    OrthoScale: 24.07
    UpVector, Offset, Clip distances
  HoleVisibility: (220x items)
    VisType + IsVisible (which labels/annotations are shown)
  TieTypeVisibility: (which tie types are displayed)
  HorizonVisibility, MachineModelVisibility
  EntityFilters, PrinterSettings
  FontScale, SymbolScale, TieScale, LeadinScale
```

---

## 7. What the Current Parser Captures vs What's Available

### Currently Parsed (from BlisData.Xml)

| Data | Status | Notes |
|------|--------|-------|
| Hole coordinates (X, Y, Z) | ✅ Design + Actual | Collar position |
| Hole geometry (length, angle, bearing) | ✅ | Angle from vertical, degrees |
| Diameter | ✅ | mm |
| Stemming, Backfill | ✅ | metres |
| Subdrill, BenchHeight | ✅ | metres |
| FiringTime, Sequence | ✅ | ms, order number |
| PowderFactor | ✅ | kg/m³ |
| DesignLoading (decks) | ✅ | Product, length, weight, density |
| BlastDescription summary | ✅ | Volume, PF, EF |
| Header info | ✅ | Mine, location, author |

### Not Yet Parsed (available in BlisData.Xml)

| Data | Source | Potential Use |
|------|--------|---------------|
| **TieTable** | BlisData.Xml/TieTable | Timing network connectivity (fromHoleID) |
| **TieTypes** | BlisData.Xml/TieTypes | Delay product definitions and colors |
| **Leadins** | BlisData.Xml/Leadins | Initiation start point |
| **BlastBounds** | BlisData.Xml/BlastBounds | Blast boundary polygon (84 points) |
| **BlastDomains** | BlisData.Xml/BlastDomains | Design pattern params per hole type |
| **UsageDesign** | BlisData.Xml/UsageDesign | Bill of materials / resource list |
| **FiringTimes** | BlisData.Xml/FiringTimes | Per-charge timing with charge top/bottom |
| **InitSysLoading** | BlisData.Xml/Hole/InitSysLoading | Detonator and primer details |
| **GeoCoordinates** | BlisData.Xml/Hole/GeoCoordinates | WGS84 lat/lon (if populated) |
| **Horizons** | BlisData.Xml/Horizons | Named intercept layer definitions |
| **MaterialTypes** | BlisData.Xml/MaterialTypes | Material type names |
| **Outcomes** | BlisData.Xml/Outcomes | Post-blast KPI scores |

### Only in SPNETData.Xml (not in BLIS)

| Data | Description |
|------|-------------|
| **ToeRL, GradeRL** (per hole) | Direct elevations (often more reliable than BLIS GradeRL=0) |
| **DesignToe vector** | 3D toe position as XYZ |
| **Full product database** | All explosives, IS products, accessories with properties |
| **Loading rules** | Design rules, tolerances, NewDeckTolerance |
| **EBS settings** | Inter/intra deck delays, timing methods |
| **CAD entities** | Polylines, layers, entity handles |
| **Drill data** | DrillCollar, DrillToe, DrillAngle, DrillBearing, DrillDiameter |
| **Bore track data** | Downhole survey data |
| **Surfaces** | DTM surfaces for collar/toe calculations |
| **Vibration modelling** | VibrationData, environmental modelling |
| **Fragmentation modelling** | Fragment prediction parameters |
| **Flyrock calculator** | Exclusion zone parameters |
| **Exclusion area settings** | K-factors, safety distances |
| **Temperature data** | Hole temperatures |
| **Water data** | WaterState, DepthToWater, WetSides |

---

## 8. Recommendations for Parser Enhancement

### Priority 1: TieTable → fromHoleID (High Value)

Currently the parser derives `fromHoleID` from the comment field, which is fragile. The TieTable provides the actual timing connections:

```xml
<Tie>
  <Hole1Index>2</Hole1Index>
  <Hole2Index>1</Hole2Index>
  <TieTypeIndex>1</TieTypeIndex>
</Tie>
```

Combined with `Leadins/Leadin/HoleIndex=3` (the initiation start), this gives the full timing network tree.

### Priority 2: BlastBounds → Boundary Polygon

84 XYZ coordinates defining a closed polygon. Could be rendered as a polyline in Kirra.

### Priority 3: GradeRL from SPNETData

The BLIS `GradeRL` is often 0 while SPNETData has `GradeRL: 5385` (correct). If accurate grade is needed, could optionally parse SPNETData.Xml for the `GradeRL` and `ToeRL` values.

### Priority 4: InitSysLoading Details

Detonator product, primer name/weight, and depth per hole. Useful for loading reports.

---

## 9. Coordinate System Notes

- **Local mine grid:** X ~9544, Y ~19287, Z ~5390 (RL in metres)
- **Collar Z:** 5390.0 RL
- **GradeRL:** 5385.0 RL (from SPNETData) → bench height = 5.0m (not 20m)
- **ToeRL:** 5385.0 RL → subdrill below grade = 0.0 in this case
- The `BenchHeight: 20` in BLIS appears to be the **domain default**, not actual bench
- SPNETData angles are in **radians**, BLIS angles are in **degrees**
- Bearing 88.736° = 1.549 rad (confirmed by SPNETData)
