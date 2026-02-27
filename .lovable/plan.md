
# Use Real Hourly/Monthly Solar Data in the 8,760-Hour Simulation

## Problem
The simulation engine (`runAnnualEnergySimulation`) receives a single 24-hour solar profile and repeats it identically for all 365 days. This means every day looks the same regardless of season, even though:
- **PVGIS TMY** provides 8,760 individual hourly irradiance records with real seasonal variation
- **PVGIS Monthly** provides 12 monthly average GHI values that differ significantly between summer and winter

## Solution Overview

**Two-track approach** depending on the data source:

1. **TMY source**: Pass the full 8,760-hour GHI array from PVGIS through to the simulation engine, so each day has its own unique solar shape.
2. **Monthly source**: Scale the single typical-day profile by each month's real GHI ratio (from the PVGIS monthly data), so summer days produce more than winter days.

## Detailed Changes

### 1. Edge Function: `pvgis-tmy/index.ts`
- Add a new `hourly8760` array to the response containing all 8,760 hourly GHI values (in W/m2) in chronological order
- Also include a parallel `temp8760` array with hourly temperatures
- These arrays are compact (8,760 numbers each) and well within JSON payload limits (~150 KB)
- Keep the existing `typicalDay` and `monthly` fields for backward compatibility (charts, summaries)

### 2. Type Updates: `src/hooks/usePVGISProfile.ts`
- Add `hourly8760Ghi?: number[]` and `hourly8760Temp?: number[]` fields to `PVGISTMYResponse`
- These flow through the existing cache mechanism unchanged (stored in `data_json`)

### 3. Simulation Engine: `EnergySimulationEngine.ts`
- Change `runAnnualEnergySimulation` to accept an **optional** 8,760-element solar profile array (`annualSolarProfile?: number[]`) alongside the existing 24-hour `solarProfile`
- When `annualSolarProfile` is provided: use `annualSolarProfile[dayIndex * 24 + h]` for each hour's solar value
- When not provided (monthly/solcast sources): apply a monthly scaling factor to the 24-hour profile. The engine already has `month` on each calendar day -- multiply `solarProfile[h]` by `monthlyScaleFactors[month]`
- Add an optional `monthlyScaleFactors?: number[]` (12 elements) parameter

### 4. SimulationPanel: Build the 8,760-hour solar array
- **For TMY**: Convert the raw `hourly8760Ghi` from PVGIS into a 8,760-element kW generation array (applying DC capacity, temperature derating, system losses, inverter clipping -- the same per-hour calc currently in `useLoadProfileData`)
- **For Monthly**: Compute 12 monthly scale factors from `pvgisMonthlyData.monthly[].avgDailyGhi` relative to the annual average, and pass these to the engine
- **For Solcast**: Continue using the single 24-hour profile (Solcast only provides a single day forecast)

### 5. Chart Day Navigation
- When TMY data is active, the day-navigation slider will now show genuinely different solar curves per day (extracted from the 8,760-hour engine results as already implemented via `dailySlice`)
- No chart code changes needed -- the existing `dailySlice` filter already extracts per-day data from the annual results

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/pvgis-tmy/index.ts` | Add `hourly8760Ghi` and `hourly8760Temp` arrays to response |
| `src/hooks/usePVGISProfile.ts` | Add 8760 fields to `PVGISTMYResponse` type |
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Accept optional 8760 solar array or monthly scale factors |
| `src/components/projects/SimulationPanel.tsx` | Build 8760 solar array from TMY data; compute monthly factors from monthly data |

## Key Considerations

- **Cache compatibility**: Existing cached TMY data will not have `hourly8760Ghi`. The code will gracefully fall back to the 24-hour profile when the field is missing, and re-fetching will populate the new fields.
- **Performance**: 8,760 numbers is trivial for both network transfer and in-memory computation.
- **Calculation Firewall**: The solar profile construction (derating, clipping) stays in utility/memo logic, not in UI render code.
