

# Use Full 8,760-Hour TMY Data for Realistic Solar Simulation

## Overview
When the TMY data source is selected, instead of averaging 8,760 hourly irradiance values into a single repeated 24-hour profile, we will pass all 8,760 hourly GHI values directly into the annual simulation engine. Each hour will undergo the full PV calculation chain: irradiance on collector area, module STC conversion, PVsyst loss chain, and inverter output -- producing a unique solar generation value for every hour of the year.

## Current Problem
- The TMY edge function returns 8,760 real hourly GHI readings (W/m2), but these are immediately averaged into a single 24-hour profile
- The annual engine then repeats this identical profile for all 365 days
- Result: every day produces the same solar output regardless of season or weather

## Architecture

```text
TMY Raw Data (8,760 hourly GHI in W/m2)
  |
  v
Per-Hour PV Calculation:
  GHI (W/m2) x 1h = Wh/m2
  Wh/m2 / 1000 = kWh/m2
  kWh/m2 x Collector Area (m2) = Energy on Collectors (kWh)
  x STC Efficiency = Array Nominal (kWh)
  x PVsyst Loss Chain (irradiance + array + inverter + post-inverter losses)
  = Inverter Output (kWh) for that hour
  |
  v
8,760-hour solar generation array (kWh per hour)
  |
  v
Annual Simulation Engine (replaces single 24h profile)
```

## Changes

### 1. Store Full 8,760 TMY Hourly Data (SimulationPanel.tsx)

Currently, the TMY response's `tmy_hourly` array (8,760 records with GHI in W/m2) is averaged into 24 hourly values and discarded. We need to preserve the raw hourly data.

- Add a new memo `tmyHourlyGhi8760` that extracts all 8,760 GHI values from the TMY edge function response, ordered chronologically (hour 0 of day 0 through hour 23 of day 364)
- The PVGIS TMY edge function already returns hour-by-hour data in `outputs.tmy_hourly` -- we just need to pass it through

### 2. Update the TMY Edge Function Response (pvgis-tmy/index.ts)

The edge function currently processes the 8,760 records but only returns the 24-hour average. We need it to also return the raw 8,760 hourly GHI array.

- Add a new field `hourlyGhi8760: number[]` to the response -- an array of 8,760 GHI values in W/m2, in chronological order
- Keep the existing `typicalDay` summary for backward compatibility and chart display

### 3. Update the Hook Type (usePVGISProfile.ts)

- Add `hourlyGhi8760?: number[]` to the `PVGISTMYResponse` interface so the 8,760 array flows through caching and state

### 4. Create an Hourly PV Conversion Utility (src/utils/calculators/)

A pure function that converts 8,760 hourly GHI values (W/m2) into 8,760 hourly inverter output values (kWh), applying the full PVsyst loss chain:

```text
function convertTMYToSolarGeneration(
  hourlyGhiWm2: number[],       // 8,760 GHI values in W/m2
  collectorAreaM2: number,       // From module metrics
  stcEfficiency: number,         // From module preset
  pvsystConfig: PVsystLossChainConfig,
  reductionFactor: number        // Production reduction %
): number[]                      // 8,760 inverter output values in kWh
```

For each hour:
1. `ghiKwhM2 = ghiWm2 / 1000` (W/m2 x 1h = Wh/m2, /1000 = kWh/m2)
2. `energyOnCollectors = ghiKwhM2 * collectorAreaM2`
3. `eArrNom = energyOnCollectors * stcEfficiency`
4. Apply PVsyst loss factors multiplicatively (irradiance losses, array losses, inverter losses, post-inverter losses) -- reusing the existing loss percentages from the `PVsystLossChainConfig`
5. Multiply by `reductionFactor`

This follows the "Calculation Firewall" rule -- pure math, no UI.

### 5. Update the Annual Engine to Accept 8,760-Hour Solar (EnergySimulationEngine.ts)

Modify `runAnnualEnergySimulation` to accept an optional `solarProfile8760: number[]` parameter:

- If `solarProfile8760` is provided (8,760 values), use `solarProfile8760[day.dayIndex * 24 + h]` for each hour instead of `solarProfile[h]`
- If not provided, fall back to the existing 24-hour repeated profile
- No other logic changes needed -- the dispatch, battery, and grid calculations all work on the per-hour `solar` value already

### 6. Wire It Up in SimulationPanel.tsx

When `solarDataSource === "pvgis_tmy"` and TMY 8,760 data is available:

- Compute `solarProfile8760` using the new utility with module metrics and PVsyst config
- Pass it to `runAnnualEnergySimulation` as the new parameter
- The existing 24-hour `solarProfile` continues to be used for the daily chart shape and for non-TMY sources

For PVGIS Monthly and Generic sources, behaviour is unchanged -- they continue using the 24-hour repeated profile (with optional monthly irradiance scaling as a future enhancement).

## Files Modified

1. **`supabase/functions/pvgis-tmy/index.ts`** -- Add `hourlyGhi8760` array to response (~5 lines)
2. **`src/hooks/usePVGISProfile.ts`** -- Add `hourlyGhi8760` to `PVGISTMYResponse` type (~1 line)
3. **`src/utils/calculators/tmySolarConversion.ts`** -- New file: pure conversion function (~60 lines)
4. **`src/components/projects/simulation/EnergySimulationEngine.ts`** -- Add optional `solarProfile8760` parameter to `runAnnualEnergySimulation` (~5 lines changed)
5. **`src/components/projects/SimulationPanel.tsx`** -- Compute and pass 8,760 solar profile when TMY is active (~20 lines)

## Impact

- TMY source will produce unique solar generation for every hour of the year reflecting real seasonal and weather patterns
- Summer days will naturally produce more energy; winter days less; cloudy days within the TMY will show reduced output
- All downstream KPIs (grid import, self-consumption, battery cycles, financial projections) will reflect this variation
- PVGIS Monthly and Generic sources remain unchanged
- The daily chart view will show different solar shapes when navigating to different days of the year

