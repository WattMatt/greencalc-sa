

# Fix: Annual Simulation Accumulators Not Incremented + Chart TOU Context Missing

## Two Bugs Found

### Bug 1: Annual 8,760-hour simulation returns zeroed totals (Critical)

In `runAnnualEnergySimulation` (EnergySimulationEngine.ts), the accumulator variables (`totalGridImport`, `totalGridExport`, `totalSolarUsed`, `totalBatteryCharge`, `totalBatteryDischarge`, `totalBatteryChargeFromGrid`, `totalLoad`, `totalSolar`, `peakGridImport`) are declared at lines 822-830 but **never incremented** inside the 8,760-hour loop. Only `batteryState` is updated.

Compare with the 24-hour `runEnergySimulation` which correctly increments at lines 558-563:
```text
totalGridImport += result.gridImport;
totalGridExport += result.gridExport;
totalSolarUsed += result.solarUsed;
...
```

The annual function is missing this entirely, so:
- `totalAnnualSolarUsed` = 0
- `totalAnnualGridImport` = 0
- `totalAnnualBatteryDischarge` = 0
- All derived rates in the financial model are broken (divide by zero or NaN)

**Fix:** Add accumulator increments after line 875, matching the pattern from the 24-hour simulation. Also track `peakGridImport` as the max of each hour's grid import.

### Bug 2: 24-hour chart simulation ignores TOU selection matrix

The 24-hour `runEnergySimulation` at line 543 calls `dispatchTouArbitrage(hourState, h, effectiveDispatchConfig, permissions)` without passing `touContext`. The function then falls back to static `dischargeWindows` instead of the `dischargeTouSelection` matrix. This causes the building profile chart to show battery discharge at fixed clock hours regardless of which season/day-type the user is viewing.

**Fix:** The 24-hour simulation needs to receive a representative `touContext` for chart visualisation (based on the `showHighSeason` toggle state). This requires passing the TOU settings and season selection into `runEnergySimulation`, or adding a `touContext` override to the config.

The simpler approach: add an optional `touSettings` and `representativeSeason` to `EnergySimulationConfig`. When present, `runEnergySimulation` resolves each hour's TOU period from the appropriate hour map and passes the `touContext` to dispatch functions.

## Changes

### File: `src/components/projects/simulation/EnergySimulationEngine.ts`

1. **Add accumulator increments** inside `runAnnualEnergySimulation` loop (after line 875):

```text
totalGridImport += result.gridImport;
totalGridExport += result.gridExport;
totalSolarUsed += result.solarUsed;
totalBatteryCharge += result.batteryCharge;
totalBatteryDischarge += result.batteryDischarge;
totalBatteryChargeFromGrid += result.batteryChargeFromGrid;
totalLoad += load;
totalSolar += solar;
peakGridImport = Math.max(peakGridImport, result.gridImport);
```

2. **Add optional TOU context support to `EnergySimulationConfig`**: New optional fields `touSettings` and `representativeSeason` (default `'high'`). When present, the 24-hour simulation resolves `touContext` per hour and passes it to dispatch functions.

3. **Update `runEnergySimulation`** to use `touSettings` when available: derive `dayType` from a representative day (weekday), resolve `hourMap` from the settings, and pass `touContext` to `dispatchTouArbitrage` and `dispatchScheduled`.

### File: `src/components/projects/SimulationPanel.tsx`

4. **Pass `touSettings` and `representativeSeason` into `energyConfig`**: Use `touSettingsData` and `showHighSeason` to inform the 24-hour engine of the correct TOU context for chart display.

## Impact

- Financial model receives correct annual totals instead of zeros
- Building profile chart shows battery behaviour that matches the TOU selection matrix for the selected season
- Battery rate in cashflow will correctly reflect peak-only discharge when configured

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Add missing accumulator increments in annual loop; add optional TOU context to 24-hour simulation |
| `src/components/projects/SimulationPanel.tsx` | Pass `touSettings` and season into energy config for chart accuracy |

