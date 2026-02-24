

## Update Tab Descriptions and Align Charts to Their Definitions

### Problem

Currently, Building Profile and Load Profile render the **exact same chart** (both use `LoadChart` with the `total` data series). They need to be differentiated to match their intended purposes.

### Definitions Recap

| Tab | Purpose | Chart Content |
|-----|---------|---------------|
| Building Profile | Cumulative view of all energy flows | Composite chart: load + solar + grid + battery overlaid |
| Load Profile | Tenant consumption | Raw demand (`total` series) -- the existing `LoadChart` |
| Grid Profile | Network operator's perspective | Import/export (`gridImport`/`gridExport`) -- already correct |
| PV Profile | PV production output | Solar generation -- already correct |
| Battery Profile | Charge and discharge power | Charge/discharge areas + SoC line -- already correct |
| Load Shedding | Unchanged | Unchanged |

### Changes

**1. Remove icon from Grid Profile tab trigger**

Remove the `ArrowDownToLine` icon and `className="gap-1"` from the Grid Profile `TabsTrigger` so it reads as plain text.

**2. Update all tab descriptions**

| Tab | Old Description | New Description |
|-----|----------------|-----------------|
| Building Profile | "Building consumption before renewable intervention" | "Cumulative profile: load, grid, PV, and battery combined" |
| Load Profile | "Hourly site consumption" | "Tenant load and estimated downstream tenant consumption" |
| Grid Profile | "Grid import & export flows" | "kW and kWh as perceived by the network operator" |
| PV Profile | "Solar output with DC/AC ratio and clipping analysis" | "PV production output" |
| Battery Profile | "Charge/discharge cycles and state of charge" | "Charging power and discharging power" |

**3. Create a new `BuildingProfileChart` component**

A new chart component at `src/components/projects/load-profile/charts/BuildingProfileChart.tsx` that overlays all four energy flows on a single `ComposedChart`:

- **Load** (primary colour area) -- the `total` data series representing building demand
- **PV Generation** (amber area) -- the `pvGeneration` series
- **Grid Import** (red area) -- the `gridImport` series
- **Grid Export** (green area, shown as negative or separate) -- the `gridExport` series
- **Battery Charge** (green line) -- `batteryCharge` series (conditional on battery being enabled)
- **Battery Discharge** (orange line) -- `batteryDischarge` series (conditional on battery being enabled)

The chart will include:
- A shared legend at the top showing all active series
- TOU background shading (reusing the existing pattern)
- Tooltip showing all values at the hovered hour
- The 25th-hour data point for visual continuity

**4. Update Building Profile tab to use the new chart**

Replace the `LoadChart` in the Building Profile `TabsContent` with the new `BuildingProfileChart`, passing the existing `simulationChartData` and flags for whether battery is included.

**5. Update the `SolarChart` component styling**

Remove the top border and margin (`border-t`, `mt-4`, `pt-4`) from `SolarChart` since it now lives in its own dedicated tab (same cleanup previously done for `GridFlowChart`).

**6. Update the `BatteryChart` component styling**

Remove the top border and margin (`border-t`, `mt-4`, `pt-4`) from `BatteryChart` for the same reason.

### Technical Details

**New file:** `src/components/projects/load-profile/charts/BuildingProfileChart.tsx`

- Accepts `ChartDataPoint[]`, `showTOU`, `isWeekend`, `unit`, and `includesBattery` props
- Uses `ComposedChart` from recharts with multiple `Area` and `Line` elements
- Each series uses a distinct colour with gradient fills for areas
- TOU `ReferenceArea` blocks rendered when `showTOU` is true
- Custom tooltip displaying all active series values

**Modified files:**

- `src/components/projects/SimulationPanel.tsx`
  - Lines 2254-2256: Remove Building2 icon from Building Profile trigger (keep text only, matching other tabs)
  - Lines 2259-2262: Remove ArrowDownToLine icon from Grid Profile trigger
  - Line 2290: Update Building Profile `CardDescription`
  - Lines 2304-2310: Replace `LoadChart` with `BuildingProfileChart`
  - Line 2327: Update Load Profile `CardDescription`
  - Line 2364: Update Grid Profile `CardDescription`
  - Line 2397: Update PV Profile `CardDescription`
  - Line 2429: Update Battery Profile `CardDescription`

- `src/components/projects/load-profile/charts/SolarChart.tsx`
  - Line 36: Remove `mt-4 pt-4 border-t` classes from the wrapper div

- `src/components/projects/load-profile/charts/BatteryChart.tsx`
  - Line 13: Remove `mt-4 pt-4 border-t` classes from the wrapper div

No new dependencies required. All data series already exist in `ChartDataPoint`.
