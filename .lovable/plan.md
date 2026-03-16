

## Replace PVGIS with Global Solar Atlas in the Simulation Engine

### Problem
The simulation engine currently uses PVGIS (JRC) as its solar data source for GHI and derives specific yield via `GHI × 0.85`. You want Global Solar Atlas (GSA) to be the primary data source instead, providing both **kWh/m²/yr (GHI)** and **kWh/kWp (PVOUT_csi)** directly.

### What Changes

**1. Add `"gsa"` as a new `SolarDataSource` in `useSolarProfiles.ts`**
- Import `useGlobalSolarAtlas` hook
- Add auto-fetch effect: when `solarDataSource === "gsa"`, call the GSA edge function with project lat/lng
- Compute `annualGHI` from GSA's `annual.GHI` when source is `"gsa"`
- Expose GSA's `PVOUT_csi` (specific yield) so SimulationPanel can use it directly instead of `GHI × 0.85`
- Generate a synthetic 24-hour profile from GSA monthly GHI data (same pattern as PVGIS monthly)
- Expose `gsaSpecificYield` and `gsaData` in the return object

**2. Update `SimulationPanel.tsx`**
- When `solarDataSource === "gsa"` and GSA data is available, use `gsaSpecificYield` directly as `simplifiedSpecificYield` instead of `annualGHI × 0.85`
- This gives you the GSA-sourced kWh/kWp flowing into Annual Production, Daily Output, and all downstream KPIs

**3. Update `SimulationToolbar.tsx`**
- Add a 4th toggle button: **"GSA"** (with Sun icon) alongside Solcast, PVGIS, TMY
- Wire up the new `"gsa"` data source value

**4. Add `SolarForecastCard` to the Solar Forecast tab**
- In `ProjectDetail.tsx`, render `<SolarForecastCard>` below `ProjectLocationMap` in the "solar-forecast" tab, passing project lat/lng as defaults
- This gives users a visual display of GSA data alongside the map

### Data Flow (Simplified Mode)
```text
GSA API → PVOUT_csi (kWh/kWp/yr) → simplifiedSpecificYield
        → GHI (kWh/m²/yr)        → annualGHI (for PVsyst mode)
        → Monthly GHI[12]        → synthetic 24-hour profile → solarProfile
```

### Files Modified
- `src/components/projects/simulation/useSolarProfiles.ts` — add GSA hook, auto-fetch, annualGHI from GSA, expose gsaSpecificYield
- `src/components/projects/SimulationPanel.tsx` — use GSA specific yield when source is "gsa"
- `src/components/projects/simulation/SimulationToolbar.tsx` — add GSA toggle button
- `src/pages/ProjectDetail.tsx` — render SolarForecastCard in solar-forecast tab

